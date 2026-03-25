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
import { savePPGReading, saveHeartRateReading } from '../firebase/dataLogger';
import { LOG_SERVICE_UUID, LOG_NOTIFY_UUID } from '../functionality/BLEProtocols';
import base64 from 'react-native-base64';
import { theme } from '../styles/theme';
import { Card, SectionHeader, StatsCard, Badge, InfoRow } from './shared/StyledComponents';

const WINDOW_SIZE = 100;

interface PPGData {
  red: number;
  ir: number;
  green: number;
}

/**
 * MAX30101Monitor - PPG/Heart Rate/SpO2 Sensor
 * 
 * Monitors MAX30101 sensor data from NRF device logs
 * Parses log format: "max30101_demo: [MAX30101] RED=... IR=... GREEN=..."
 */
export const MAX30101Monitor: React.FC = () => {
  const { connectedDevice, isConnected } = useBLE();
  const { user } = useAuth();

  const [ppgData, setPPGData] = useState<PPGData>({ red: 0, ir: 0, green: 0 });
  const [redBuffer, setRedBuffer] = useState<number[]>([]);
  const [irBuffer, setIRBuffer] = useState<number[]>([]);
  const [greenBuffer, setGreenBuffer] = useState<number[]>([]);
  const [heartRate, setHeartRate] = useState<number>(0);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [enableFirebase, setEnableFirebase] = useState<boolean>(false);

  const rxBuffer = useRef<string>('');
  const sampleCounter = useRef<number>(0);
  const subscriptionRef = useRef<any>(null);

  /**
   * Parse MAX30101 log line
   * Format: "max30101_demo: PPG FIFO | RED=12345 | IR=12346 | GREEN=12347 | avail=11"
   * or: "max30101_demo: [MAX30101] RED=12345 IR=12346 GREEN=12347"
   */
  const parsePPGLine = useCallback((line: string): PPGData | null => {
    if (!line.includes('max30101_demo:')) {
      return null;
    }

    // Match both formats with or without pipes
    const redMatch = line.match(/RED[=\s]+(\d+)/);
    const irMatch = line.match(/IR[=\s]+(\d+)/);
    const greenMatch = line.match(/GREEN[=\s]+(\d+)/);

    if (redMatch && irMatch && greenMatch) {
      return {
        red: parseInt(redMatch[1]),
        ir: parseInt(irMatch[1]),
        green: parseInt(greenMatch[1]),
      };
    }

    return null;
  }, []);

  /**
   * Simple heart rate estimation from IR signal peaks
   * (Basic implementation - can be improved with proper DSP)
   */
  const estimateHeartRate = useCallback((irData: number[]): number => {
    if (irData.length < 50) return 0;

    // Count peaks in last 50 samples (assuming ~50Hz sample rate = 1 second)
    const recent = irData.slice(-50);
    const threshold = Math.max(...recent) * 0.7; // 70% of max
    let peaks = 0;
    let inPeak = false;

    for (let i = 1; i < recent.length - 1; i++) {
      if (recent[i] > threshold && recent[i] > recent[i - 1] && recent[i] > recent[i + 1]) {
        if (!inPeak) {
          peaks++;
          inPeak = true;
        }
      } else if (recent[i] < threshold * 0.8) {
        inPeak = false;
      }
    }

    // Convert peaks per second to BPM
    return peaks * 60;
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
        const ppg = parsePPGLine(line);
        if (ppg) {
          console.log('[MAX30101Monitor] 💓 PPG:', `RED=${ppg.red} IR=${ppg.ir} GREEN=${ppg.green}`);
          setPPGData(ppg);

          setRedBuffer(prev => {
            const updated = [...prev, ppg.red];
            if (updated.length > WINDOW_SIZE) return updated.slice(-WINDOW_SIZE);
            return updated;
          });

          setIRBuffer(prev => {
            const updated = [...prev, ppg.ir];
            if (updated.length > WINDOW_SIZE) return updated.slice(-WINDOW_SIZE);

            // Update heart rate every 10 samples
            if (sampleCounter.current % 10 === 0) {
              const hr = estimateHeartRate(updated);
              setHeartRate(hr);
            }

            return updated;
          });

          setGreenBuffer(prev => {
            const updated = [...prev, ppg.green];
            if (updated.length > WINDOW_SIZE) return updated.slice(-WINDOW_SIZE);
            return updated;
          });

          // Save to Firebase (throttled - every 50 samples)
          sampleCounter.current++;
          if (enableFirebase && user && sampleCounter.current % 50 === 0) {
            // Save PPG data
            savePPGReading(user.uid, {
              channel: 'IR',
              rawValue: ppg.ir,
              signalQuality: ppg.ir > 10000 ? 80 : 50,
              skinContact: ppg.ir > 10000,
              deviceId: connectedDevice?.id,
              deviceName: connectedDevice?.name || undefined,
            }).catch(err => console.error('[PPG] ❌ Failed to save IR:', err));
            
            // Save heart rate if calculated
            if (heartRate > 40 && heartRate < 200) {
              saveHeartRateReading(user.uid, {
                heartRate: heartRate,
                confidence: ppg.ir > 50000 ? 90 : 70,
                derivedFrom: 'PPG_IR',
                deviceId: connectedDevice?.id,
                deviceName: connectedDevice?.name || undefined,
              }).catch(err => console.error('[HR] ❌ Failed to save:', err));
            }
          }
        }
      }
    }
  }, [parsePPGLine, estimateHeartRate, enableFirebase, user, connectedDevice]);

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
            console.error('[MAX30101Monitor] Error:', error);
            return;
          }

          if (characteristic?.value) {
            try {
              const decoded = base64.decode(characteristic.value);
              handleNotification(decoded);
            } catch (err) {
              console.error('[MAX30101Monitor] Decode error:', err);
            }
          }
        }
      );

      setIsMonitoring(true);
      console.log('[MAX30101Monitor] Started monitoring');
    } catch (error) {
      console.error('[MAX30101Monitor] Failed to start:', error);
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
      console.log('[MAX30101Monitor] Cleaning up...');
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
    propsForDots: {
      r: '0',
    },
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <SectionHeader
          title="MAX30101 PPG Sensor"
          subtitle={isConnected ? (isMonitoring ? 'Monitoring' : 'Ready') : 'Not Connected'}
          rightElement={
            <Badge variant={isConnected ? 'success' : 'error'} text={isConnected ? 'Connected' : 'Disconnected'} />
          }
        />
      </View>

      {/* Heart Rate Display */}
      <View style={styles.content}>
        <StatsCard
          icon="❤️"
          label="Heart Rate"
          value={heartRate > 0 ? heartRate.toString() : '--'}
          unit="BPM"
          color={theme.colors.error}
        />
        {heartRate > 0 && (
          <Text style={styles.hrSubtext}>
            {heartRate < 60 ? 'Low' : heartRate > 100 ? 'High' : 'Normal'}
          </Text>
        )}
      </View>

      {/* Current Values */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Current Readings</Text>
        <InfoRow label="RED LED" value={ppgData.red.toString()} icon="🔴" />
        <InfoRow label="IR LED" value={ppgData.ir.toString()} icon="🟣" />
        <InfoRow label="GREEN LED" value={ppgData.green.toString()} icon="🟢" />
      </Card>

      {/* Charts */}
      {irBuffer.length > 10 && (
        <>
          <Card style={styles.card}>
            <Text style={styles.chartTitle}>IR Signal (Heart Rate)</Text>
            <LineChart
              data={{
                labels: [],
                datasets: [{ data: irBuffer.length > 0 ? irBuffer : [0] }],
              }}
              width={chartWidth}
              height={180}
              chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})` }}
              bezier
              withDots={false}
              withInnerLines={false}
              withOuterLines={true}
              withVerticalLabels={false}
              style={styles.chart}
            />
          </Card>

          <Card style={styles.card}>
            <Text style={styles.chartTitle}>RED Signal (Oxygenation)</Text>
            <LineChart
              data={{
                labels: [],
                datasets: [{ data: redBuffer.length > 0 ? redBuffer : [0] }],
              }}
              width={chartWidth}
              height={180}
              chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})` }}
              bezier
              withDots={false}
              withInnerLines={false}
              withOuterLines={true}
              withVerticalLabels={false}
              style={styles.chart}
            />
          </Card>

          <Card style={styles.card}>
            <Text style={styles.chartTitle}>GREEN Signal</Text>
            <LineChart
              data={{
                labels: [],
                datasets: [{ data: greenBuffer.length > 0 ? greenBuffer : [0] }],
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
          </Card>
        </>
      )}

      {irBuffer.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {isConnected ? '⏳ Waiting for PPG data...' : '🔌 Connect device to start'}
          </Text>
        </View>
      )}
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
    alignItems: 'center',
  },
  hrSubtext: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
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
  chartTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  chart: {
    borderRadius: theme.borderRadius.md,
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
});
