import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSensorPipeline } from '../../hooks/useSensorPipeline';
import { useBLE } from '../../functionality/BLEContext';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
type TimelineTab = 'Day' | 'Week' | 'Month' | 'Year';
interface PPGSample { ir: number; red: number; ts: number }

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
            <Text style={ax.val}>{val > 0 ? '+' : ''}{val} {unit}</Text>
          </View>
        );
      })}
      <Text style={ax.mag}>|mag| = {mag.toFixed(0)} {unit}</Text>
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

// ─── Static sleep data ────────────────────────────────────────────────────────
const SLEEP_STAGES = [
  { stage: 'Awake', duration: 43,  color: '#EF4444', pct: 9  },
  { stage: 'REM',   duration: 90,  color: '#F59E0B', pct: 19 },
  { stage: 'Light', duration: 204, color: '#3B82F6', pct: 43 },
  { stage: 'Deep',  duration: 137, color: '#10B981', pct: 29 },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PhysiologicalInsightScreen() {
  const [selectedTab, setSelectedTab] = useState<TimelineTab>('Day');
  const { live } = useSensorPipeline();
  const { isConnected } = useBLE();

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
  }, [ppgTs]);

  const ppgLive  = live.ppg.lastUpdated  !== null;
  const tempLive = live.temperature.lastUpdated !== null;
  const edaLive  = live.eda.lastUpdated  !== null;
  const imuLive  = live.accel.lastUpdated !== null;
  const activeSensors = [ppgLive, tempLive, edaLive, imuLive].filter(Boolean).length;
  const tempCat  = tempLive ? tempCategory(live.temperature.tempC) : null;
  const bpmColor = !bpm ? '#94A3B8' : bpm < 60 ? '#3B82F6' : bpm > 100 ? '#EF4444' : '#10B981';
  const timelineTabs: TimelineTab[] = ['Day', 'Week', 'Month', 'Year'];

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
            {isConnected ? `${activeSensors} / 4 sensors active` : 'Device not connected — connect wristband'}
          </Text>
        </View>
        <View style={[styles.connDot, { backgroundColor: isConnected ? '#10B981' : '#EF4444' }]} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Timeline tabs */}
        <View style={styles.tabsRow}>
          {timelineTabs.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, selectedTab === tab && styles.tabBtnActive]}
              onPress={() => setSelectedTab(tab)}>
              <Text style={[styles.tabTxt, selectedTab === tab && styles.tabTxtActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedTab !== 'Day' && (
          <View style={styles.noteBanner}>
            <Ionicons name="information-circle-outline" size={14} color="#5DADE2" />
            <Text style={styles.noteTxt}>Weekly / Monthly / Yearly views coming soon.</Text>
          </View>
        )}

        {/* ── CARDIAC ──────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>CARDIAC</Text>

        {/* Heart Rate */}
        <SensorCard accent="#EF4444" icon="heart" title="Heart Rate" isLive={ppgLive}>
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
                <ChannelPill label="IR"    value={live.ppg.ir}    color="#DC2626" />
                <ChannelPill label="RED"   value={live.ppg.red}   color="#EF4444" />
                <ChannelPill label="GREEN" value={live.ppg.green} color="#10B981" />
              </View>
              <InfoBox text="MAX30101 · IR = infrared · SpO₂ via Beer-Lambert ratio-of-ratios (±2% estimate)" />
            </>
          )}
          {!ppgLive && (
            <Text style={styles.waiting}>Place the wristband on your wrist to begin heartbeat monitoring.</Text>
          )}
        </SensorCard>

        {/* HRV */}
        <SensorCard accent="#F97316" icon="pulse" title="Heart Rate Variability (HRV)" isLive={ppgLive}>
          {ppgLive ? (
            <>
              <BigMetric value="--" unit=" ms RMSSD" color="#F97316" />
              <Text style={styles.sub}>Requires ≥60 s of still-wrist data · {ppgBuf.current.length} samples collected</Text>
              <InfoBox text="HRV reflects autonomic nervous system balance. Higher RMSSD = better recovery and resilience." />
            </>
          ) : (
            <Text style={styles.waiting}>Waiting for PPG sensor…</Text>
          )}
        </SensorCard>

        {/* ── METABOLISM ────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>METABOLISM</Text>

        {/* Skin Temperature */}
        <SensorCard accent="#F59E0B" icon="thermometer" title="Skin Temperature" isLive={tempLive}>
          {tempLive ? (
            <>
              <View style={styles.hrRow}>
                <View style={{ flex: 1 }}>
                  <BigMetric value={live.temperature.tempC.toFixed(2)} unit=" °C" color="#B45309" />
                  <Text style={styles.sub}>{live.temperature.tempF.toFixed(2)} °F</Text>
                </View>
                {tempCat && <MetricBadge label={tempCat.label} color={tempCat.color} />}
              </View>
              <InfoBox text={`AS6221 · Updated ${live.temperature.lastUpdated!.toLocaleTimeString()} · Wrist skin normal: 33–36 °C`} />
            </>
          ) : (
            <Text style={styles.waiting}>Waiting for AS6221 temperature sensor…</Text>
          )}
        </SensorCard>

        {/* ── STRESS ───────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>STRESS & AUTONOMIC</Text>

        {/* EDA */}
        <SensorCard accent="#8B5CF6" icon="flash" title="Electrodermal Activity (EDA / GSR)" isLive={edaLive}>
          {edaLive ? (
            <>
              <View style={styles.hrRow}>
                <View style={{ flex: 1 }}>
                  <BigMetric value={live.eda.conductance_uS.toFixed(3)} unit=" µS" color="#6D28D9" />
                  <Text style={styles.sub}>{live.eda.mv} mV · Raw ADC {live.eda.rawADC}</Text>
                </View>
                <View style={[styles.stressBadge, { backgroundColor: stressColor(live.eda.stressLevel) + '20', borderColor: stressColor(live.eda.stressLevel) }]}>
                  <Text style={[styles.stressBadgeText, { color: stressColor(live.eda.stressLevel) }]}>
                    {stressLabel(live.eda.stressLevel)}
                  </Text>
                </View>
              </View>
              <View style={styles.conductanceBarWrap}>
                <View style={[styles.conductanceBar, { width: `${Math.min(live.eda.conductance_uS * 10, 100)}%`, backgroundColor: stressColor(live.eda.stressLevel) }]} />
              </View>
              <InfoBox text="ADS1113 · GSR electrodes on inner wrist · Sweat-gland conductance rises with arousal & stress" />
            </>
          ) : (
            <Text style={styles.waiting}>Waiting for ADS1113 EDA sensor…</Text>
          )}
        </SensorCard>

        {/* ── MOTION ───────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>MOTION</Text>

        {/* IMU */}
        <SensorCard accent="#3B82F6" icon="navigate" title="Motion & Orientation" isLive={imuLive}>
          {imuLive ? (
            <>
              <AxisRow label="Accelerometer" x={live.accel.x} y={live.accel.y} z={live.accel.z} unit="mg"   color="#3B82F6" />
              <AxisRow label="Gyroscope"     x={live.gyro.x}  y={live.gyro.y}  z={live.gyro.z}  unit="mdps" color="#6366F1" />
              <InfoBox text={`LSM6DSO 6-axis IMU · Updated ${live.accel.lastUpdated!.toLocaleTimeString()}`} />
            </>
          ) : (
            <Text style={styles.waiting}>Waiting for LSM6DSO IMU sensor…</Text>
          )}
        </SensorCard>

        {/* ── CARDIOVASCULAR ────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>CARDIOVASCULAR</Text>
        <View style={[scard.wrap, { borderLeftColor: '#94A3B8' }]}>
          <View style={scard.header}>
            <View style={[scard.iconCircle, { backgroundColor: '#F1F5F9' }]}>
              <Ionicons name="fitness" size={18} color="#94A3B8" />
            </View>
            <Text style={scard.title}>Blood Pressure & Hardware SpO₂</Text>
            <MetricBadge label="SOON" color="#94A3B8" />
          </View>
          <Text style={styles.sub}>Cuffless BP and hardware-computed SpO₂ will arrive in a future firmware update.</Text>
        </View>

        {/* ── SLEEP ────────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>SLEEP</Text>
        <SensorCard accent="#1D4ED8" icon="bed" title="Sleep Insight" isLive={false}>
          <View style={styles.hrRow}>
            <View>
              <BigMetric value="7h 34m" unit="" color="#1D4ED8" />
              <Text style={styles.sub}>11:53 PM — 7:04 AM · Last night</Text>
            </View>
            <MetricBadge label="PLACEHOLDER" color="#94A3B8" />
          </View>
          <View style={styles.sleepTimeline}>
            {SLEEP_STAGES.map((s, i) => (
              <View key={i} style={[styles.sleepBlock, { flex: s.pct, backgroundColor: s.color }]} />
            ))}
          </View>
          <View style={styles.sleepTicks}>
            <Text style={styles.tick}>11:53 PM</Text>
            <Text style={styles.tick}>3:28 AM</Text>
            <Text style={styles.tick}>7:04 AM</Text>
          </View>
          {SLEEP_STAGES.map((s, i) => (
            <View key={i} style={styles.stageRow}>
              <View style={[styles.stageDot, { backgroundColor: s.color }]} />
              <Text style={styles.stageName}>{s.stage}</Text>
              <View style={styles.stageTrack}>
                <View style={[styles.stageFill, { width: `${s.pct}%`, backgroundColor: s.color }]} />
              </View>
              <Text style={styles.stageDur}>{s.duration} min</Text>
            </View>
          ))}
          <InfoBox text="Sleep staging will be automated from IMU + PPG sensor fusion in a future firmware update." />
        </SensorCard>

        {/* ── ACTIVITY ─────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>ACTIVITY</Text>
        <SensorCard accent="#10B981" icon="walk" title="Activity Insight" isLive={imuLive}>
          <BigMetric value="--" unit=" / 100" color="#10B981" />
          <Text style={styles.sub}>Daily activity score · derived from IMU magnitude</Text>
          <View style={styles.actGrid}>
            {[
              { type: 'Sedentary',   color: '#64748B', pct: 25 },
              { type: 'Light',       color: '#F59E0B', pct: 40 },
              { type: 'Fair Active', color: '#3B82F6', pct: 20 },
              { type: 'Very Active', color: '#10B981', pct: 15 },
            ].map((a, i) => (
              <View key={i} style={styles.actRow}>
                <View style={[styles.actDot, { backgroundColor: a.color }]} />
                <Text style={styles.actLabel}>{a.type}</Text>
                <View style={styles.actTrack}>
                  <View style={[styles.actFill, { width: `${a.pct}%`, backgroundColor: a.color }]} />
                </View>
                <Text style={styles.actPct}>{a.pct}%</Text>
              </View>
            ))}
          </View>
          <InfoBox text="Real-time activity classification uses IMU accelerometer magnitude thresholds." />
        </SensorCard>

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

  tabsRow:     { flexDirection: 'row', backgroundColor: '#A3D9F0', paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  tabBtn:      { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center' },
  tabBtnActive:{ backgroundColor: '#FFFFFF' },
  tabTxt:      { fontSize: 13, fontWeight: '600', color: '#475569' },
  tabTxtActive:{ color: '#5DADE2', fontWeight: '800' },

  noteBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E0F2FE', marginHorizontal: 16, marginTop: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  noteTxt:    { fontSize: 12, color: '#0369A1', flex: 1 },

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

  sleepTimeline: { flexDirection: 'row', height: 36, borderRadius: 8, overflow: 'hidden', marginBottom: 4 },
  sleepBlock:    { height: '100%' },
  sleepTicks:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  tick:          { fontSize: 10, color: '#94A3B8' },

  stageRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  stageDot:   { width: 10, height: 10, borderRadius: 5 },
  stageName:  { width: 46, fontSize: 12, fontWeight: '600', color: '#334155' },
  stageTrack: { flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  stageFill:  { height: '100%', borderRadius: 3 },
  stageDur:   { width: 44, fontSize: 11, color: '#64748B', textAlign: 'right' },

  actGrid:  { marginTop: 8, gap: 8 },
  actRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actDot:   { width: 10, height: 10, borderRadius: 5 },
  actLabel: { width: 72, fontSize: 12, fontWeight: '600', color: '#334155' },
  actTrack: { flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  actFill:  { height: '100%', borderRadius: 3 },
  actPct:   { width: 30, fontSize: 11, color: '#64748B', textAlign: 'right' },
});
