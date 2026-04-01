import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSharedSensorPipeline } from '../../hooks/SensorPipelineContext';
import { useBLE } from '../../functionality/BLEContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PPGSample { ir: number; red: number; ts: number }
type SensorPanelKey = 'ppg' | 'temperature' | 'eda' | 'accel' | 'gyro';

// ─── Constants ────────────────────────────────────────────────────────────────
const PPG_WINDOW_MS   = 15_000;
const PPG_MIN_SAMPLES = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function tempCategory(c: number): { label: string; color: string } {
  if (c < 34.0)  return { label: 'Cold',         color: '#3B82F6' };
  if (c < 35.5)  return { label: 'Below Normal', color: '#60A5FA' };
  if (c <= 37.5) return { label: 'Normal',        color: '#10B981' };
  if (c < 38.0)  return { label: 'Elevated',      color: '#F59E0B' };
  return               { label: 'Fever',          color: '#EF4444' };
}

function stressColor(level: string): string {
  switch (level) {
    case 'LOW':       return '#10B981';
    case 'MEDIUM':    return '#F59E0B';
    case 'HIGH':      return '#F97316';
    case 'VERY_HIGH': return '#EF4444';
    default:          return '#64748B';
  }
}

function stressLabel(level: string): string {
  switch (level) {
    case 'LOW':       return 'Calm';
    case 'MEDIUM':    return 'Moderate';
    case 'HIGH':      return 'Stressed';
    case 'VERY_HIGH': return 'High Stress';
    default:          return level;
  }
}

function finiteOr(value: number | null | undefined, fallback = 0): number {
  // Explicitly handle null and undefined
  if (value === null || value === undefined) return fallback;
  return Number.isFinite(value) ? value : fallback;
}

function safeFormat(val: number | null | undefined, decimals: number = 1): string {
  if (val === null || val === undefined || Number.isNaN(val) || !Number.isFinite(val)) return '--';
  return val.toFixed(decimals);
}

function isFresh(updatedAt: Date | null, maxAgeMs = 15_000): boolean {
  if (!updatedAt) return false;
  const ts = updatedAt.getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= maxAgeMs;
}

function detectPeaks(vals: number[]): number[] {
  const n = vals.length;
  if (n < 3) return [];
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const peaks: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (vals[i] > vals[i - 1] && vals[i] > vals[i + 1] && vals[i] > mean) {
      peaks.push(i);
    }
  }
  return peaks;
}

function computeSpO2(irVals: number[], redVals: number[]): number | null {
  if (irVals.length < PPG_MIN_SAMPLES) return null;
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const ir_dc  = mean(irVals);
  const red_dc = mean(redVals);
  if (ir_dc === 0 || red_dc === 0) return null;
  const ir_ac  = Math.max(...irVals)  - Math.min(...irVals);
  const red_ac = Math.max(...redVals) - Math.min(...redVals);
  if (ir_ac === 0) return null;
  const R    = (red_ac / red_dc) / (ir_ac / ir_dc);
  const spo2 = Math.round(110 - 25 * R);
  return spo2 >= 70 && spo2 <= 100 ? spo2 : null;
}

// ─── MetricBadge ──────────────────────────────────────────────────────────────
interface MetricBadgeProps { label: string; color: string; dotIcon?: boolean }
function MetricBadge({ label, color, dotIcon }: MetricBadgeProps) {
  return (
    <View style={[badge.wrap, { backgroundColor: color + '22', borderColor: color }]}>
      {dotIcon && <View style={[badge.dot, { backgroundColor: color }]} />}
      <Text style={[badge.text, { color }]}>{label}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 99, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, gap: 4 },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});

// ─── SensorCard ───────────────────────────────────────────────────────────────
interface SensorCardProps { accent: string; icon: string; title: string; isLive: boolean; children: React.ReactNode }
function SensorCard({ accent, icon, title, isLive, children }: SensorCardProps) {
  return (
    <View style={[scard.wrap, { borderLeftColor: accent }]}>
      <View style={scard.header}>
        <View style={[scard.iconCircle, { backgroundColor: accent + '18' }]}>
          <Ionicons name={icon as any} size={18} color={accent} />
        </View>
        <Text style={scard.title}>{title}</Text>
        <MetricBadge label={isLive ? 'LIVE' : 'WAITING'} color={isLive ? '#10B981' : '#94A3B8'} dotIcon={isLive} />
      </View>
      {children}
    </View>
  );
}
const scard = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    marginHorizontal: 16, marginBottom: 14, padding: 18, borderLeftWidth: 4,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  header:     { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title:      { flex: 1, fontSize: 15, fontWeight: '700', color: '#1E293B' },
});

// ─── BigMetric ────────────────────────────────────────────────────────────────
function BigMetric({ value, unit, color = '#1E293B' }: { value: string; unit: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 }}>
      <Text style={[styles.bigNumber, { color }]}>{value}</Text>
      <Text style={styles.bigUnit}>{unit}</Text>
    </View>
  );
}

// ─── AxisRow ──────────────────────────────────────────────────────────────────
function AxisRow({ label, x, y, z, unit, color }: { label: string; x: number; y: number; z: number; unit: string; color: string }) {
  const maxAbs = Math.max(Math.abs(x), Math.abs(y), Math.abs(z), 1);
  const mag = Math.sqrt(x * x + y * y + z * z);
  return (
    <View style={ax.section}>
      <Text style={[ax.label, { color }]}>{label}</Text>
      {(['X', 'Y', 'Z'] as const).map((a, i) => {
        const val = [x, y, z][i];
        return (
          <View key={a} style={ax.row}>
            <Text style={ax.axLabel}>{a}</Text>
            <View style={ax.track}>
              <View style={[ax.fill, { width: `${Math.min((Math.abs(val) / maxAbs) * 100, 100)}%`, backgroundColor: val >= 0 ? color : color + '88' }]} />
            </View>
            <Text style={ax.val}>{val > 0 ? '+' : ''}{Math.round(val)} {unit}</Text>
          </View>
        );
      })}
      <Text style={ax.mag}>|mag| = {Math.round(mag)} {unit}</Text>
    </View>
  );
}
const ax = StyleSheet.create({
  section: { marginTop: 10 },
  label:   { fontSize: 11, fontWeight: '800', marginBottom: 6, letterSpacing: 0.6, textTransform: 'uppercase' },
  row:     { flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 6 },
  axLabel: { width: 16, fontSize: 12, fontWeight: '700', color: '#64748B' },
  track:   { flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  fill:    { height: '100%', borderRadius: 3 },
  val:     { width: 90, fontSize: 11, color: '#334155', textAlign: 'right' },
  mag:     { fontSize: 11, color: '#94A3B8', marginTop: 2 },
});

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ samples, color }: { samples: PPGSample[]; color: string }) {
  const N = 24;
  const pts = samples.slice(-N);
  if (pts.length < 3) return null;
  const vals  = pts.map(s => s.ir);
  const min   = Math.min(...vals);
  const range = Math.max(...vals) - min || 1;
  return (
    <View style={spark.wrap}>
      {pts.map((s, i) => {
        const h = Math.max(Math.round(((s.ir - min) / range) * 28) + 4, 3);
        return <View key={i} style={[spark.bar, { height: h, backgroundColor: color, opacity: 0.35 + (i / N) * 0.65 }]} />;
      })}
    </View>
  );
}
const spark = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', height: 36, gap: 2, marginTop: 10, marginBottom: 6 },
  bar:  { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
});

// ─── ChannelPill ──────────────────────────────────────────────────────────────
function ChannelPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[cpill.wrap, { backgroundColor: color + '14', borderColor: color + '44' }]}>
      <Text style={[cpill.label, { color }]}>{label}</Text>
      <Text style={cpill.value}>{value.toLocaleString()}</Text>
    </View>
  );
}
const cpill = StyleSheet.create({
  wrap:  { flex: 1, borderRadius: 10, borderWidth: 1, padding: 8, alignItems: 'center', marginHorizontal: 3 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  value: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginTop: 2 },
});

// ─── InfoBox ──────────────────────────────────────────────────────────────────
function InfoBox({ text }: { text: string }) {
  return (
    <View style={ib.box}>
      <Ionicons name="information-circle-outline" size={13} color="#94A3B8" style={{ marginTop: 1 }} />
      <Text style={ib.text}>{text}</Text>
    </View>
  );
}
const ib = StyleSheet.create({
  box:  { flexDirection: 'row', gap: 6, marginTop: 8, backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  text: { fontSize: 11, color: '#94A3B8', flex: 1, lineHeight: 16 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PhysiologicalInsightScreen() {
  const { live } = useSharedSensorPipeline();
  const { isConnected } = useBLE();
  const [selectedPanel, setSelectedPanel] = useState<SensorPanelKey>('ppg');

  const ppgBuf = useRef<PPGSample[]>([]);
  const [bpm,  setBpm]  = useState<number | null>(null);
  const [spo2, setSpo2] = useState<number | null>(null);

  // Numeric timestamp — primitive value, safe as dep (no new object each render)
  const ppgTs = live.ppg.lastUpdated?.getTime() ?? 0;
  // Throttle BPM computation: only recompute every 500 ms to avoid
  // queuing 50+ React updates at 25 Hz → "Maximum update depth exceeded"
  const lastComputeTs = useRef(0);

  useEffect(() => {
    if (!ppgTs) return;

    ppgBuf.current.push({ ir: live.ppg.ir, red: live.ppg.red, ts: ppgTs });
    const cutoff = ppgTs - PPG_WINDOW_MS;
    ppgBuf.current = ppgBuf.current.filter(s => s.ts >= cutoff);

    if (selectedPanel !== 'ppg') return;

    // Only run heavy computation at most every 500 ms
    if (ppgTs - lastComputeTs.current < 500) return;
    lastComputeTs.current = ppgTs;

    const buf = ppgBuf.current;
    if (buf.length < PPG_MIN_SAMPLES) return;
    const irVals  = buf.map(s => s.ir);
    const redVals = buf.map(s => s.red);
    const peakIdxs = detectPeaks(irVals);
    if (peakIdxs.length >= 2) {
      const winMs = buf[buf.length - 1].ts - buf[0].ts;
      if (winMs >= 3000) {
        const computedBpm = Math.round((peakIdxs.length / winMs) * 60_000);
        if (computedBpm >= 35 && computedBpm <= 220) {
          // Functional updater: React bails out (no re-render) when value is unchanged
          setBpm(prev => (prev === computedBpm ? prev : computedBpm));
        }
      }
    }
    const s = computeSpO2(irVals, redVals);
    if (s !== null) {
      setSpo2(prev => (prev === s ? prev : s));
    }
  // ppgTs is a primitive number — safe to use as effect dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ppgTs, selectedPanel]);

  const ppgLive  = (live?.ppg?.lastUpdated ?? null) !== null;
  const tempLive = (live?.temperature?.lastUpdated ?? null) !== null;
  const edaLive  = (live?.eda?.lastUpdated ?? null) !== null;
  const accelLive = (live?.accel?.lastUpdated ?? null) !== null;
  const gyroLive  = (live?.gyro?.lastUpdated ?? null) !== null;
  const activeSensors = [ppgLive, tempLive, edaLive, accelLive, gyroLive].filter(Boolean).length;
  const bpmColor = !bpm ? '#94A3B8' : bpm < 60 ? '#3B82F6' : bpm > 100 ? '#EF4444' : '#10B981';
  const safeTempC = finiteOr(live?.temperature?.tempC);
  const safeTempF = finiteOr(live?.temperature?.tempF);
  const safeEdaUS = finiteOr(live?.eda?.conductance_uS);
  const safeEdaMv = finiteOr(live?.eda?.mv);
  const safeEdaRaw = finiteOr(live?.eda?.rawADC);
  const safePpgIr = finiteOr(live?.ppg?.ir);
  const safePpgRed = finiteOr(live?.ppg?.red);
  const safePpgGreen = finiteOr(live?.ppg?.green);
  const safeAccelX = finiteOr(live?.accel?.x);
  const safeAccelY = finiteOr(live?.accel?.y);
  const safeAccelZ = finiteOr(live?.accel?.z);
  const safeGyroX = finiteOr(live?.gyro?.x);
  const safeGyroY = finiteOr(live?.gyro?.y);
  const safeGyroZ = finiteOr(live?.gyro?.z);
  const safeRawGyroX = finiteOr(live?.gyro?.rawX);
  const safeRawGyroY = finiteOr(live?.gyro?.rawY);
  const safeRawGyroZ = finiteOr(live?.gyro?.rawZ);
  const tempCat  = tempLive ? tempCategory(safeTempC) : null;
  const summaryTiles = [
    { key: 'temp', label: 'Temp', value: `${safeFormat(safeTempC, 2)} C`, live: isFresh(live?.temperature?.lastUpdated ?? null), color: '#F59E0B' },
    { key: 'ppg', label: 'PPG-IR', value: safePpgIr.toLocaleString(), live: isFresh(live?.ppg?.lastUpdated ?? null), color: '#EF4444' },
    { key: 'eda', label: 'EDA', value: `${safeFormat(safeEdaUS, 3)} uS`, live: isFresh(live?.eda?.lastUpdated ?? null), color: '#8B5CF6' },
    { key: 'accel', label: 'Accel |mag|', value: `${safeFormat(finiteOr(live?.accel?.magnitude), 5)} mg`, live: isFresh(live?.accel?.lastUpdated ?? null), color: '#3B82F6' },
    { key: 'gyro', label: 'Gyro |mag|', value: `${Math.round(finiteOr(live?.gyro?.magnitude))} mdps`, live: isFresh(live?.gyro?.lastUpdated ?? null), color: '#6366F1' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="stats-chart" size={22} color="#5DADE2" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Physiological Insights</Text>
          <Text style={styles.headerSub}>
            {isConnected ? `${activeSensors} / 5 sensors active` : 'Device not connected — connect wristband'}
          </Text>
        </View>
        <View style={[styles.connDot, { backgroundColor: isConnected ? '#10B981' : '#EF4444' }]} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.panelTabsWrap}>
          {[
            { key: 'ppg', label: 'PPG', icon: 'heart' },
            { key: 'temperature', label: 'Temp', icon: 'thermometer' },
            { key: 'eda', label: 'EDA', icon: 'flash' },
            { key: 'accel', label: 'Accel', icon: 'speedometer' },
            { key: 'gyro', label: 'Gyro', icon: 'navigate' },
          ].map((panel) => {
            const active = selectedPanel === panel.key;
            return (
              <TouchableOpacity
                key={panel.key}
                style={[
                  styles.panelTab,
                  active && styles.panelTabActive,
                ]}
                onPress={() => setSelectedPanel(panel.key as SensorPanelKey)}>
                <Ionicons
                  name={panel.icon as any}
                  size={13}
                  color={active ? '#0F172A' : '#64748B'}
                />
                <Text style={[styles.panelTabText, active && styles.panelTabTextActive]}>
                  {panel.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.summaryGrid}>
          {summaryTiles.map((tile) => (
            <View key={tile.key} style={styles.summaryTile}>
              <View style={styles.summaryTileHeader}>
                <View style={[styles.summaryDot, { backgroundColor: tile.live ? '#10B981' : '#94A3B8' }]} />
                <Text style={styles.summaryLabel}>{tile.label}</Text>
              </View>
              <Text style={[styles.summaryValue, { color: tile.live ? '#1E293B' : '#94A3B8' }]}>{tile.value}</Text>
              <View style={[styles.summaryAccent, { backgroundColor: tile.color }]} />
            </View>
          ))}
        </View>

        {/* ── PPG ──────────────────────────────────────────────────────────── */}
        {selectedPanel === 'ppg' && <Text style={styles.sectionLabel}>MAX30101 PPG</Text>}

        {/* Heart Rate */}
        {selectedPanel === 'ppg' && <SensorCard accent="#EF4444" icon="heart" title="Heart Rate" isLive={ppgLive}>
          <View style={styles.hrRow}>
            <View style={{ flex: 1 }}>
              <BigMetric value={bpm != null ? String(bpm) : '--'} unit=" bpm" color={bpmColor} />
              <Text style={styles.sub}>
                {bpm != null
                  ? bpm < 60  ? 'Bradycardia range'
                  : bpm > 100 ? 'Tachycardia range'
                              : 'Normal sinus rhythm'
                  : ppgLive ? 'Accumulating signal…' : 'Awaiting PPG sensor'}
              </Text>
            </View>
            {ppgLive && (
              <View style={styles.spo2Bubble}>
                <Text style={styles.spo2Value}>{spo2 != null ? `${spo2}%` : '--'}</Text>
                <Text style={styles.spo2Label}>SpO₂</Text>
                {spo2 != null && spo2 < 94 && <Text style={styles.spo2Warn}>low</Text>}
              </View>
            )}
          </View>
          {ppgLive && (
            <>
              <Sparkline samples={ppgBuf.current} color="#EF4444" />
              <View style={styles.channelRow}>
                <ChannelPill label="IR" value={safePpgIr} color="#DC2626" />
                <ChannelPill label="RED" value={safePpgRed} color="#EF4444" />
                <ChannelPill label="GREEN" value={safePpgGreen} color="#10B981" />
              </View>
              <InfoBox text="MAX30101 · IR = infrared · SpO₂ via Beer-Lambert ratio-of-ratios (±2% estimate)" />
            </>
          )}
          {!ppgLive && (
            <Text style={styles.waiting}>Place the wristband on your wrist to begin heartbeat monitoring.</Text>
          )}
        </SensorCard>}

        {/* HRV */}
        {selectedPanel === 'ppg' && <SensorCard accent="#F97316" icon="pulse" title="Heart Rate Variability (HRV)" isLive={ppgLive}>
          {ppgLive ? (
            <>
              <BigMetric value="--" unit=" ms RMSSD" color="#F97316" />
              <Text style={styles.sub}>Requires ≥60 s of still-wrist data · {ppgBuf.current.length} samples collected</Text>
              <InfoBox text="HRV computation is not finalized in this firmware build. Raw PPG is live; HRV will be enabled when validated." />
            </>
          ) : (
            <Text style={styles.waiting}>Waiting for PPG sensor…</Text>
          )}
        </SensorCard>}

        {/* ── TEMP ─────────────────────────────────────────────────────────── */}
        {selectedPanel === 'temperature' && <Text style={styles.sectionLabel}>AS6221 TEMPERATURE</Text>}

        {/* Skin Temperature */}
        {selectedPanel === 'temperature' && <SensorCard accent="#F59E0B" icon="thermometer" title="Skin Temperature" isLive={tempLive}>
          {tempLive ? (
            <>
              <View style={styles.hrRow}>
                <View style={{ flex: 1 }}>
                  <BigMetric value={safeFormat(safeTempC, 2)} unit=" °C" color="#B45309" />
                  <Text style={styles.sub}>{safeFormat(safeTempF, 2)} °F</Text>
                </View>
                {tempCat && <MetricBadge label={tempCat.label} color={tempCat.color} />}
              </View>
              <InfoBox text={`AS6221 · Updated ${live?.temperature?.lastUpdated ? live.temperature.lastUpdated.toLocaleTimeString() : '--'} · Wrist skin normal: 33–36 °C`} />
            </>
          ) : (
            <Text style={styles.waiting}>Waiting for AS6221 temperature sensor…</Text>
          )}
        </SensorCard>}

        {/* ── EDA ──────────────────────────────────────────────────────────── */}
        {selectedPanel === 'eda' && <Text style={styles.sectionLabel}>ADS1113 EDA / GSR</Text>}

        {/* EDA */}
        {selectedPanel === 'eda' && <SensorCard accent="#8B5CF6" icon="flash" title="Electrodermal Activity (EDA / GSR)" isLive={edaLive}>
          {edaLive ? (
            <>
              <View style={styles.hrRow}>
                <View style={{ flex: 1 }}>
                  <BigMetric value={safeFormat(safeEdaUS, 3)} unit=" µS" color="#6D28D9" />
                  <Text style={styles.sub}>{safeFormat(safeEdaMv, 3)} mV · Raw ADC {safeEdaRaw}</Text>
                </View>
                <View style={[styles.stressBadge, { backgroundColor: stressColor(live?.eda?.stressLevel ?? 'LOW') + '20', borderColor: stressColor(live?.eda?.stressLevel ?? 'LOW') }]}>
                  <Text style={[styles.stressBadgeText, { color: stressColor(live?.eda?.stressLevel ?? 'LOW') }]}> 
                    {stressLabel(live?.eda?.stressLevel ?? 'LOW')}
                  </Text>
                </View>
              </View>
              <View style={styles.conductanceBarWrap}>
                <View style={[styles.conductanceBar, { width: `${Math.min(safeEdaUS * 10, 100)}%`, backgroundColor: stressColor(live?.eda?.stressLevel ?? 'LOW') }]} />
              </View>
              <InfoBox text="ADS1113 · GSR electrodes on inner wrist · Sweat-gland conductance rises with arousal & stress" />
            </>
          ) : (
            <Text style={styles.waiting}>Waiting for ADS1113 EDA sensor…</Text>
          )}
        </SensorCard>}

        {/* ── ACCEL ────────────────────────────────────────────────────────── */}
        {selectedPanel === 'accel' && <Text style={styles.sectionLabel}>LSM6DSO ACCELEROMETER</Text>}

        {selectedPanel === 'accel' && <SensorCard accent="#3B82F6" icon="speedometer" title="Acceleration" isLive={accelLive}>
          {accelLive ? (
            <>
              <AxisRow label="Accelerometer" x={safeAccelX} y={safeAccelY} z={safeAccelZ} unit="mg" color="#3B82F6" />
              <InfoBox text={`LSM6DSO 6-axis IMU · Updated ${live?.accel?.lastUpdated ? live.accel.lastUpdated.toLocaleTimeString() : '--'}`} />
            </>
          ) : (
            <Text style={styles.waiting}>Waiting for LSM6DSO accelerometer…</Text>
          )}
        </SensorCard>}

        {/* ── GYRO ─────────────────────────────────────────────────────────── */}
        {selectedPanel === 'gyro' && <Text style={styles.sectionLabel}>LSM6DSO GYROSCOPE</Text>}

        {selectedPanel === 'gyro' && <SensorCard accent="#6366F1" icon="navigate" title="Angular Velocity" isLive={gyroLive}>
          {gyroLive ? (
            <>
              <AxisRow label="Gyroscope (Stabilized)" x={safeGyroX} y={safeGyroY} z={safeGyroZ} unit="mdps" color="#6366F1" />
              <AxisRow label="Gyroscope (Raw)" x={safeRawGyroX} y={safeRawGyroY} z={safeRawGyroZ} unit="mdps" color="#4338CA" fullScale={60000} />
              <InfoBox text={`LSM6DSO 6-axis IMU · Raw values match Python GUI log format · Updated ${live?.gyro?.lastUpdated ? live.gyro.lastUpdated.toLocaleTimeString() : '--'}`} />
            </>
          ) : (
            <Text style={styles.waiting}>Waiting for LSM6DSO gyroscope…</Text>
          )}
        </SensorCard>}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F0F7FF' },

  header:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#A3D9F0', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  headerIcon:  { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  headerSub:   { fontSize: 12, color: '#334155', marginTop: 1 },
  connDot:     { width: 10, height: 10, borderRadius: 5 },

  scroll: { flex: 1 },

  panelTabsWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    backgroundColor: '#E2ECF8',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  panelTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  panelTabActive: {
    backgroundColor: '#FFFFFF',
  },
  panelTabText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  panelTabTextActive: {
    color: '#0F172A',
  },

  summaryGrid: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryTile: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  summaryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  summaryAccent: {
    marginTop: 8,
    height: 2,
    borderRadius: 2,
  },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.2, textTransform: 'uppercase', marginHorizontal: 20, marginTop: 20, marginBottom: 8 },

  bigNumber: { fontSize: 44, fontWeight: '800', lineHeight: 52 },
  bigUnit:   { fontSize: 18, fontWeight: '600', color: '#64748B', marginBottom: 8, lineHeight: 52 },

  hrRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },

  spo2Bubble: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEE2E2', borderWidth: 2, borderColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  spo2Value:  { fontSize: 20, fontWeight: '800', color: '#EF4444' },
  spo2Label:  { fontSize: 10, fontWeight: '700', color: '#EF4444' },
  spo2Warn:   { fontSize: 10, color: '#EF4444', fontWeight: '700' },

  channelRow: { flexDirection: 'row', marginTop: 4, marginBottom: 4 },

  sub:     { fontSize: 12, color: '#64748B', marginBottom: 4 },
  waiting: { fontSize: 14, color: '#94A3B8', fontStyle: 'italic', marginTop: 4 },

  stressBadge:     { borderRadius: 99, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  stressBadgeText: { fontSize: 13, fontWeight: '800' },

  conductanceBarWrap: { height: 8, backgroundColor: '#EDE9FE', borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  conductanceBar:     { height: '100%', borderRadius: 4 },
});
