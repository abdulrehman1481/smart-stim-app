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

const WINDOW_SIZE = 100;

interface EDAData {
  raw: number;
  mV: number;
  deltaRaw: number;
  flatCount: number;
}

/**
 * ADS1113Monitor - EDA/GSR Sensor
 * 
 * Monitors ADS1113 ADC for Electrodermal Activity (EDA) / Galvanic Skin Response
 * Parses log format: "eda_raw: t=...ms raw=... mv=... dRaw=... flat_cnt=..."
 */
export const ADS1113Monitor: React.FC = () => {
  const { connectedDevice, isConnected } = useBLE();
  const { user } = useAuth();

  const [edaData, setEDAData] = useState<EDAData>({
    raw: 0,
    mV: 0,
    deltaRaw: 0,
    flatCount: 0,
  });

  const [rawBuffer, setRawBuffer] = useState<number[]>([]);
  const [mvBuffer, setMVBuffer] = useState<number[]>([]);
  const [stressLevel, setStressLevel] = useState<string>('Normal');
  
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);

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
   * Estimate stress level from EDA magnitude and variability
   * Higher EDA typically indicates higher arousal/stress
   */
  const estimateStressLevel = useCallback((mvData: number[]): string => {
    if (mvData.length < 10) return 'Calibrating';

    const recent = mvData.slice(-20);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recent.length;
    const stdDev = Math.sqrt(variance);

    // Rough heuristics (adjust based on your sensor calibration)
    if (avg < 100 && stdDev < 10) return 'Very Low';
    if (avg < 200 && stdDev < 20) return 'Low';
    if (avg < 400 && stdDev < 40) return 'Normal';
    if (avg < 600 && stdDev < 60) return 'Elevated';
    return 'High';
  }, []);

  /**
   * Handle incoming BLE notifications
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
          setEDAData(eda);

          setRawBuffer(prev => {
            const updated = [...prev, eda.raw];
            if (updated.length > WINDOW_SIZE) return updated.slice(-WINDOW_SIZE);
            return updated;
          });

          setMVBuffer(prev => {
            const updated = [...prev, eda.mV];
            if (updated.length > WINDOW_SIZE) return updated.slice(-WINDOW_SIZE);

            // Update stress level every 5 samples
            if (sampleCounter.current % 5 === 0) {
              const level = estimateStressLevel(updated);
              setStressLevel(level);
            }

            return updated;
          });

          // Save to Firebase (throttled - every 10 samples = ~2.5 seconds @ 4Hz)
          sampleCounter.current++;
          if (isConnected && user && sampleCounter.current % 10 === 0) {
            // Calculate conductance and resistance
            const voltage = eda.mV / 1000; // Convert to volts
            const resistance = voltage > 0 ? 150 : 0; // Estimate based on circuit
            const conductance = resistance > 0 ? 1000 / resistance : 0; // μS
            
            saveEDAReading(user.uid, {
              rawValue: eda.raw,
              voltage: voltage,
              resistance: resistance,
              conductance: conductance,
              stressLevel: stressLevel as any,
              deviceId: connectedDevice?.id,
              deviceName: connectedDevice?.name,
            }).catch(err => {
              console.error('[ADS1113] ❌ Failed to save EDA:', err);
            });
          }
        }
      }
    }
  }, [parseEDALine, estimateStressLevel, isConnected, user, connectedDevice]);

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

  const chartWidth = Dimensions.get('window').width - 40;

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: '#2a3f5f',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(224, 231, 255, ${opacity})`,
    style: { borderRadius: theme.borderRadius.lg },
    propsForDots: { r: '0' },
  };

  const getStressColor = () => {
    switch (stressLevel) {
      case 'Very Low': return theme.colors.success;
      case 'Low': return '#84cc16';
      case 'Normal': return theme.colors.info;
      case 'Elevated': return theme.colors.warning;
      case 'High': return theme.colors.error;
      default: return theme.colors.textSecondary;
    }
  };

  const getStressBadgeVariant = (): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    switch (stressLevel) {
      case 'Very Low': return 'success';
      case 'Low': return 'success';
      case 'Normal': return 'info';
      case 'Elevated': return 'warning';
      case 'High': return 'error';
      default: return 'default';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <SectionHeader
          title="ADS1113 EDA Sensor"
          subtitle={isConnected ? (isMonitoring ? 'Monitoring' : 'Ready') : 'Not Connected'}
          rightElement={
            <Badge variant={isConnected ? 'success' : 'error'} text={isConnected ? 'Connected' : 'Disconnected'} />
          }
        />
      </View>

      {/* Stress Level Display */}
      <View style={styles.content}>
        <Card style={[styles.stressCard, { borderColor: getStressColor() }] as any}>
          <View style={styles.stressHeader}>
            <Text style={styles.stressLabel}>🧘 Arousal Level</Text>
            <Badge variant={getStressBadgeVariant()} text={stressLevel} />
          </View>
          <Text style={styles.stressSubtext}>
            Based on EDA signal analysis
          </Text>
        </Card>
      </View>

      {/* Current Values */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Current Readings</Text>
        <InfoRow label="RAW ADC" value={edaData.raw.toString()} icon="📊" />
        <InfoRow label="Voltage" value={`${edaData.mV} mV`} icon="⚡" />
        <InfoRow label="Delta" value={edaData.deltaRaw.toString()} icon="📈" />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm }}>
          <InfoRow label="Flat Count" value={edaData.flatCount.toString()} icon="📉" />
          {edaData.flatCount > 10 && (
            <Badge variant="warning" text="High" style={{ marginLeft: theme.spacing.sm }} />
          )}
        </View>
      </Card>

      {/* Flatline Warning */}
      {edaData.flatCount >= 20 && (
        <Card variant="outlined" style={styles.warningCard}>
          <Text style={styles.warningText}>⚠️ Signal flatline detected</Text>
          <Text style={styles.warningSubtext}>Check sensor connection</Text>
        </Card>
      )}

      {/* EDA Signal Chart (mV) */}
      {mvBuffer.length > 10 && (
        <Card style={styles.card}>
          <Text style={styles.chartTitle}>EDA Signal (mV)</Text>
          <LineChart
            data={{
              labels: [],
              datasets: [{ data: mvBuffer.length > 0 ? mvBuffer : [0] }],
            }}
            width={chartWidth}
            height={220}
            chartConfig={chartConfig}
            bezier
            withDots={false}
            withInnerLines={true}
            withOuterLines={true}
            withVerticalLabels={false}
            style={styles.chart}
          />
          <Text style={styles.chartNote}>
            Sample Rate: 4 Hz • Window: {mvBuffer.length} samples
          </Text>
        </Card>
      )}

      {/* RAW ADC Chart */}
      {rawBuffer.length > 10 && (
        <Card style={styles.card}>
          <Text style={styles.chartTitle}>Raw ADC Values</Text>
          <LineChart
            data={{
              labels: [],
              datasets: [{ data: rawBuffer.length > 0 ? rawBuffer : [0] }],
            }}
            width={chartWidth}
            height={180}
            chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})` }}
            bezier
            withDots={false}
            withInnerLines={false}
            withOuterLines={true}
            withVerticalLabels={false}
            style={styles.chart}
          />
          <Text style={styles.chartNote}>Higher values indicate increased arousal/stress</Text>
        </Card>
      )}

      {mvBuffer.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {isConnected ? '⏳ Waiting for EDA data...' : '🔌 Connect device to start'}
          </Text>
        </View>
      )}

      {/* Info Card */}
      <Card style={styles.card}>
        <Text style={styles.infoTitle}>💡 About EDA</Text>
        <Text style={styles.infoText}>
          Electrodermal Activity (EDA), also known as Galvanic Skin Response (GSR), measures skin conductance changes 
          related to sweat gland activity. It's commonly used as an indicator of psychological or physiological arousal.
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
