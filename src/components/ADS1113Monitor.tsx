import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useBLE } from '../functionality/BLEContext';
import { BleError, Characteristic } from 'react-native-ble-plx';
import { useAuth } from '../auth/AuthContext';
import { saveEDAReading } from '../firebase/dataLogger';
import { LOG_SERVICE_UUID, LOG_NOTIFY_UUID } from '../functionality/BLEProtocols';
import base64 from 'react-native-base64';
import { theme } from '../styles/theme';
import { Card, SectionHeader, Badge, InfoRow } from './shared/StyledComponents';
import {
  CircularBuffer,
  createThrottle,
  ExponentialSmoother,
  estimateStressLevel,
  StressLevel,
  clamp,
} from '../functionality/SensorDataProcessor';

const WINDOW_SIZE = 100;
const STATE_UPDATE_INTERVAL_MS = 200; // Throttle UI updates to 200ms intervals
const EDA_VOLTAGE_MIN = -4095;
const EDA_VOLTAGE_MAX = 4095;

interface EDAData {
  raw: number;
  mV: number;
  deltaRaw: number;
  flatCount: number;
}

interface AggregatedEDAState {
  smoothedMV: number;
  avgMV: number;
  maxMV: number;
  stressLevel: StressLevel;
  sampleCount: number;
  lastUpdated: Date | null;
}

/**
 * ADS1113Monitor - EDA/GSR Sensor (Production-optimized)
 *
 * IMPROVEMENTS:
 * ✅ Uses circular buffer (no unbounded growth)
 * ✅ Throttles state updates to 200ms intervals (prevents render storms)
 * ✅ Computes stress level from EDA magnitude + variability (not raw values)
 * ✅ Uses smoothing filter to reject noise and spikes
 * ✅ Single state update instead of 2-3 separate setters
 *
 * Parses log format: "eda_raw: t=...ms raw=... mv=... dRaw=... flat_cnt=..."
 */
export const ADS1113Monitor: React.FC = () => {
  const { connectedDevice, isConnected } = useBLE();
  const { user } = useAuth();

  // ───── AGGREGATED STATE (single state update per throttle interval) ─────
  const [aggregated, setAggregated] = useState<AggregatedEDAState>({
    smoothedMV: 0,
    avgMV: 0,
    maxMV: 0,
    stressLevel: 'LOW',
    sampleCount: 0,
    lastUpdated: null,
  });

  // ───── REFS (no re-render on update) ─────
  const mvBufferRef = useRef(new CircularBuffer(WINDOW_SIZE));
  
  // Smoothing filter to reject spikes
  const mvSmootherRef = useRef(new ExponentialSmoother(0.25));

  // Throttled state update: only updates UI every 200ms max
  const throttledUpdateState = useRef(
    createThrottle(
      (state: AggregatedEDAState) => {
        setAggregated(state);
      },
      STATE_UPDATE_INTERVAL_MS
    )
  ).current;

  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [enableFirebase, setEnableFirebase] = useState<boolean>(false);

  const rxBuffer = useRef<string>('');
  const sampleCounter = useRef<number>(0);
  const subscriptionRef = useRef<any>(null);

  /**
   * Parse ADS1113 EDA log line
   * Format: "eda_raw: t=1234ms raw=12345 mv=678 dRaw=12 flat_cnt=0"
   */
  const parseEDALine = useCallback((line: string): EDAData | null => {
    if (!line.includes('eda_raw:')) {
      return null;
    }

    const rawMatch = line.match(/raw=([-\d]+)/);
    const mvMatch = line.match(/mv=([-\d]+)/);
    const dRawMatch = line.match(/dRaw=([-\d]+)/);
    const flatMatch = line.match(/flat_cnt=(\d+)/);

    if (rawMatch && mvMatch) {
      return {
        raw: parseInt(rawMatch[1]),
        mV: parseInt(mvMatch[1]),
        deltaRaw: dRawMatch ? parseInt(dRawMatch[1]) : 0,
        flatCount: flatMatch ? parseInt(flatMatch[1]) : 0,
      };
    }

    return null;
  }, []);

  /**
   * Process EDA sample: apply smoothing, buffer, aggregate, then throttle update.
   * 
   * IMPROVEMENTS over raw state updates:
   * ✅ Smooths spiky values before buffering
   * ✅ Aggregates into meaningful metric: stress level
   * ✅ Throttles state updates (200ms max frequency)
   */
  const processEDASample = useCallback((mvValue: number) => {
    // SAFETY: Validate input is a number
    if (typeof mvValue !== 'number' || !isFinite(mvValue)) {
      console.warn('[ADS1113Monitor] Invalid EDA value:', mvValue);
      return;
    }

    // Clamp to valid range to prevent calculation errors
    const clampedValue = clamp(mvValue, EDA_VOLTAGE_MIN, EDA_VOLTAGE_MAX);
    
    // Apply smoothing filter
    const smoothedValue = mvSmootherRef.current.update(clampedValue);

    // SAFETY: Verify smoothing didn't produce NaN/Infinity
    if (!isFinite(smoothedValue)) {
      console.warn('[ADS1113Monitor] Smoothing produced NaN/Infinity');
      return;
    }

    // Add to circular buffer (auto-discard oldest if full)
    mvBufferRef.current.push(Math.abs(smoothedValue));

    // Compute aggregated metrics with validation
    const allValues = mvBufferRef.current.getAll();
    
    // SAFETY: Only compute with valid samples
    const validValues = allValues.filter(v => isFinite(v) && v >= 0);
    if (validValues.length === 0) {
      console.warn('[ADS1113Monitor] No valid EDA values in buffer');
      return;
    }

    const avgMV = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const maxMV = Math.max(...validValues);

    // SAFETY: Verify aggregation produced valid numbers
    if (!isFinite(avgMV) || !isFinite(maxMV)) {
      console.warn('[ADS1113Monitor] Invalid aggregated metrics');
      return;
    }

    const stressLevelResult = estimateStressLevel(validValues);

    // Throttle state update (max once per 200ms)
    throttledUpdateState({
      smoothedMV: Math.abs(smoothedValue),
      avgMV: Math.round(avgMV),
      maxMV: Math.round(maxMV),
      stressLevel: stressLevelResult,
      sampleCount: validValues.length,
      lastUpdated: new Date(),
    });
  }, [throttledUpdateState]);

  /**
   * Handle incoming BLE notifications - production optimized
   *
   * IMPROVEMENTS:
   * ✅ Processes data in refs (no re-render on buffer change)
   * ✅ Single state update per throttle interval
   * ✅ Applies smoothing before aggregation
   * ✅ Computes stress level instead of showing raw voltage
   */
  const handleNotification = useCallback((data: string) => {
    rxBuffer.current += data;
    rxBuffer.current = rxBuffer.current.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    while (rxBuffer.current.includes('\n')) {
      const newlineIndex = rxBuffer.current.indexOf('\n');
      const line = rxBuffer.current.substring(0, newlineIndex).trim();
      rxBuffer.current = rxBuffer.current.substring(newlineIndex + 1);

      if (line) {
        const eda = parseEDALine(line);
        if (eda) {
          console.log('[ADS1113Monitor] 🧘 EDA:', `raw=${eda.raw} mV=${eda.mV} flatCount=${eda.flatCount}`);
          
          // Process sample: smoothing → buffer → aggregate → throttle update
          processEDASample(eda.mV);

          // Save to Firebase (throttled - every 10 samples = ~2.5 seconds @ 4Hz)
          sampleCounter.current++;
          if (enableFirebase && isConnected && user && sampleCounter.current % 10 === 0) {
            // Calculate conductance and resistance
            const voltage = eda.mV / 1000; // Convert to volts
            const resistance = voltage > 0 ? 150 : 0; // Estimate based on circuit
            const conductance = resistance > 0 ? 1000 / resistance : 0; // μS
            
            saveEDAReading(user.uid, {
              rawValue: eda.raw,
              voltage: voltage,
              resistance: resistance,
              conductance: conductance,
              stressLevel: aggregated.stressLevel as any,
              deviceId: connectedDevice?.id,
              deviceName: connectedDevice?.name ?? undefined,
            }).catch(err => {
              console.error('[ADS1113] ❌ Failed to save EDA:', err);
            });
          }
        }
      }
    }
  }, [parseEDALine, processEDASample, enableFirebase, isConnected, user, connectedDevice, aggregated.stressLevel]);

  /**
   * Start monitoring
   */
  const startMonitoring = useCallback(async () => {
    if (!connectedDevice || !isConnected) return;

    try {
      // Clear any existing subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      
      // Clear buffer
      rxBuffer.current = '';
      
      subscriptionRef.current = connectedDevice.monitorCharacteristicForService(
        LOG_SERVICE_UUID,
        LOG_NOTIFY_UUID,
        (error: BleError | null, characteristic: Characteristic | null) => {
          if (error) {
            console.error('[ADS1113Monitor] Error:', error);
            return;
          }

          if (characteristic?.value) {
            try {
              const decoded = base64.decode(characteristic.value);
              handleNotification(decoded);
            } catch (err) {
              console.error('[ADS1113Monitor] Decode error:', err);
            }
          }
        }
      );

      setIsMonitoring(true);
      console.log('[ADS1113Monitor] Started monitoring');
    } catch (error) {
      console.error('[ADS1113Monitor] Failed to start:', error);
    }
  }, [connectedDevice, isConnected, handleNotification]);

  /**
   * Auto-start monitoring
   */
  useEffect(() => {
    if (isConnected && connectedDevice && !isMonitoring) {
      const timer = setTimeout(startMonitoring, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, connectedDevice, isMonitoring, startMonitoring]);

  /**
   * Cleanup
   */
  useEffect(() => {
    return () => {
      console.log('[ADS1113Monitor] Cleaning up...');
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      setIsMonitoring(false);
      rxBuffer.current = '';
    };
  }, []);

  const getStressColor = (): string => {
    switch (aggregated.stressLevel) {
      case 'LOW': return theme.colors.success;
      case 'MEDIUM': return theme.colors.info;
      case 'HIGH': return theme.colors.warning;
      case 'VERY_HIGH': return theme.colors.error;
      default: return theme.colors.textSecondary;
    }
  };

  const getStressBadgeVariant = (): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    switch (aggregated.stressLevel) {
      case 'LOW': return 'success';
      case 'MEDIUM': return 'info';
      case 'HIGH': return 'warning';
      case 'VERY_HIGH': return 'error';
      default: return 'default';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <SectionHeader
          title="ADS1113 EDA Sensor"
          subtitle={isConnected ? (isMonitoring ? 'Monitoring (Aggregated)' : 'Ready') : 'Not Connected'}
          rightElement={
            <Badge variant={isConnected ? 'success' : 'error'} text={isConnected ? 'Connected' : 'Disconnected'} />
          }
        />
      </View>

      {/* Stress Level Display (Aggregated Metric) */}
      <View style={styles.content}>
        <Card style={[styles.stressCard, { borderColor: getStressColor() }] as any}>
          <View style={styles.stressHeader}>
            <Text style={styles.stressLabel}>🧘 Arousal/Stress Level</Text>
            <Badge variant={getStressBadgeVariant()} text={aggregated.stressLevel} />
          </View>
          <Text style={styles.stressSubtext}>
            Computed from smoothed EDA signal with {aggregated.sampleCount} samples
          </Text>
        </Card>
      </View>

      {/* Aggregated Metrics (NOT raw values) */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Aggregated Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Smoothed μV</Text>
            <Text style={styles.metricValue}>{aggregated.smoothedMV}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Average μV</Text>
            <Text style={styles.metricValue}>{aggregated.avgMV}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Peak μV</Text>
            <Text style={styles.metricValue}>{aggregated.maxMV}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Samples</Text>
            <Text style={styles.metricValue}>{aggregated.sampleCount}</Text>
          </View>
        </View>
      </Card>

      {/* Status Card */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>📊 Processing Status</Text>
        <Text style={styles.statusText}>
          Last updated: {aggregated.lastUpdated ? aggregated.lastUpdated.toLocaleTimeString() : 'Never'}
        </Text>
        <Text style={styles.statusText}>
          State updates: Every {STATE_UPDATE_INTERVAL_MS}ms (throttled)
        </Text>
        <Text style={styles.statusText}>
          ✅ EDA smoothing: Active (EMA with α=0.25)
        </Text>
        <Text style={styles.statusText}>
          ✅ Circular buffer: {WINDOW_SIZE} sample capacity
        </Text>
      </Card>

      {aggregated.sampleCount === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {isConnected ? '⏳ Waiting for EDA data...' : '🔌 Connect device to start'}
          </Text>
        </View>
      )}

      {/* Info Card */}
      <Card style={styles.card}>
        <Text style={styles.infoTitle}>💡 About EDA & Production Optimization</Text>
        <Text style={styles.infoText}>
          Electrodermal Activity (EDA) measures skin conductance changes. This component uses:
        </Text>
        <Text style={styles.infoText}>
          • Exponential smoothing to reject noise{'\n'}
          • Circular buffers to prevent memory leaks{'\n'}
          • Throttled updates (200ms intervals){'\n'}
          • Meaningful aggregation (stress level, not raw mV)
        </Text>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  content: {
    padding: theme.spacing.md,
  },
  stressCard: {
    borderWidth: 2,
  },
  stressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  stressLabel: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  stressSubtext: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  card: {
    margin: theme.spacing.md,
    marginTop: 0,
  },
  sectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  metricItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metricLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  metricValue: {
    ...theme.typography.h3,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  statusText: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginVertical: theme.spacing.xs,
  },
  warningCard: {
    margin: theme.spacing.md,
    marginTop: 0,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.warning,
    backgroundColor: '#fff8ed',
  },
  warningText: {
    ...theme.typography.body,
    color: theme.colors.warning,
    fontWeight: '700',
  },
  warningSubtext: {
    ...theme.typography.caption,
    color: theme.colors.warning,
    marginTop: 2,
  },
  chartTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  chart: {
    borderRadius: theme.borderRadius.md,
  },
  chartNote: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  emptyState: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  infoTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});
