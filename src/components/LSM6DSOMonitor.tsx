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
import { saveIMUReading } from '../firebase/dataLogger';
import { LOG_SERVICE_UUID, LOG_NOTIFY_UUID } from '../functionality/BLEProtocols';
import base64 from 'react-native-base64';
import { theme } from '../styles/theme';
import { Card, SectionHeader, StatsCard, Badge } from './shared/StyledComponents';

const WINDOW_SIZE = 100;

interface IMUData {
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
}

/**
 * LSM6DSOMonitor - 6-Axis IMU Sensor
 * 
 * Monitors LSM6DSO accelerometer and gyroscope data from NRF device logs
 * Parses log format: "lsm6dso_app: [LSM6DSO] ACC: X=... Y=... Z=... | GYRO: X=... Y=... Z=..."
 */
export const LSM6DSOMonitor: React.FC = () => {
  const { connectedDevice, isConnected } = useBLE();
  const { user } = useAuth();

  const [imuData, setIMUData] = useState<IMUData>({
    accel: { x: 0, y: 0, z: 0 },
    gyro: { x: 0, y: 0, z: 0 },
  });

  const [accelXBuffer, setAccelXBuffer] = useState<number[]>([]);
  const [accelYBuffer, setAccelYBuffer] = useState<number[]>([]);
  const [accelZBuffer, setAccelZBuffer] = useState<number[]>([]);
  
  const [gyroXBuffer, setGyroXBuffer] = useState<number[]>([]);
  const [gyroYBuffer, setGyroYBuffer] = useState<number[]>([]);
  const [gyroZBuffer, setGyroZBuffer] = useState<number[]>([]);

  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [enableFirebase, setEnableFirebase] = useState<boolean>(false);

  const rxBuffer = useRef<string>('');
  const sampleCounter = useRef<number>(0);
  const subscriptionRef = useRef<any>(null);
  
  // Store last known values since gyro and accel come on separate lines
  const lastGyro = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const lastAccel = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  /**
   * Parse LSM6DSO log line
   * Format: "lsm6dso_app: [LSM6DSO] G RAW [x y z] mdps [x y z]" (gyro)
   *     or: "lsm6dso_app: [LSM6DSO] A RAW [x y z] mg [x y z]" (accel)
   */
  const parseIMULine = useCallback((line: string): { type: 'gyro' | 'accel' | null; values: { x: number; y: number; z: number } | null } => {
    if (!line.includes('lsm6dso_app:') || !line.includes('[LSM6DSO]')) {
      return { type: null, values: null };
    }

    // Gyro line: "G RAW [...] mdps [x y z]"
    if (line.includes('G RAW')) {
      const mdpsMatch = line.match(/mdps\s*\[\s*([-\d]+)\s+([-\d]+)\s+([-\d]+)\s*\]/);
      if (mdpsMatch) {
        return {
          type: 'gyro',
          values: {
            x: parseInt(mdpsMatch[1]),
            y: parseInt(mdpsMatch[2]),
            z: parseInt(mdpsMatch[3]),
          },
        };
      }
    }

    // Accel line: "A RAW [...] mg [x y z]"
    if (line.includes('A RAW')) {
      const mgMatch = line.match(/mg\s*\[\s*([-\d]+)\s+([-\d]+)\s+([-\d]+)\s*\]/);
      if (mgMatch) {
        return {
          type: 'accel',
          values: {
            x: parseInt(mgMatch[1]),
            y: parseInt(mgMatch[2]),
            z: parseInt(mgMatch[3]),
          },
        };
      }
    }

    return { type: null, values: null };
  }, []);

  /**
   * Calculate magnitude of acceleration vector
   */
  const calculateMagnitude = useCallback((x: number, y: number, z: number): number => {
    return Math.sqrt(x * x + y * y + z * z);
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
        const parsed = parseIMULine(line);
        
        if (parsed.type === 'gyro' && parsed.values) {
          // Update gyro values
          lastGyro.current = parsed.values;
          console.log('[LSM6DSOMonitor] 🔄 GYRO:', `X=${parsed.values.x} Y=${parsed.values.y} Z=${parsed.values.z} mdps`);
          
          // Update display with combined data
          setIMUData({
            gyro: parsed.values,
            accel: lastAccel.current,
          });

          // Update gyro buffers
          setGyroXBuffer(prev => {
            const updated = [...prev, parsed.values!.x / 1000]; // Convert mdps to dps
            if (updated.length > WINDOW_SIZE) return updated.slice(-WINDOW_SIZE);
            return updated;
          });

          setGyroYBuffer(prev => {
            const updated = [...prev, parsed.values!.y / 1000];
            if (updated.length > WINDOW_SIZE) return updated.slice(-WINDOW_SIZE);
            return updated;
          });

          setGyroZBuffer(prev => {
            const updated = [...prev, parsed.values!.z / 1000];
            if (updated.length > WINDOW_SIZE) return updated.slice(-WINDOW_SIZE);
            return updated;
          });
        } else if (parsed.type === 'accel' && parsed.values) {
          // Update accel values
          lastAccel.current = parsed.values;
          console.log('[LSM6DSOMonitor] 📊 ACCEL:', `X=${parsed.values.x} Y=${parsed.values.y} Z=${parsed.values.z} mg`);
          
          // Update display with combined data
          setIMUData({
            gyro: lastGyro.current,
            accel: parsed.values,
          });

          // Update accel buffers
          setAccelXBuffer(prev => {
            const updated = [...prev, parsed.values!.x / 1000]; // Convert mg to g
            if (updated.length > WINDOW_SIZE) return updated.slice(-WINDOW_SIZE);
            return updated;
          });

          setAccelYBuffer(prev => {
            const updated = [...prev, parsed.values!.y / 1000];
            if (updated.length > WINDOW_SIZE) return updated.slice(-WINDOW_SIZE);
            return updated;
          });

          setAccelZBuffer(prev => {
            const updated = [...prev, parsed.values!.z / 1000];
            if (updated.length > WINDOW_SIZE) return updated.slice(-WINDOW_SIZE);
            return updated;
          });

          // Save to Firebase (on accel updates, throttled - every 20 samples)
          sampleCounter.current++;
          if (enableFirebase && user && sampleCounter.current % 20 === 0) {
            // Save combined IMU reading with both accel and gyro
            saveIMUReading(user.uid, {
              accelerometer: {
                x: lastAccel.current.x,
                y: lastAccel.current.y,
                z: lastAccel.current.z,
                magnitude: calculateMagnitude(lastAccel.current.x, lastAccel.current.y, lastAccel.current.z)
              },
              gyroscope: {
                x: lastGyro.current.x,
                y: lastGyro.current.y,
                z: lastGyro.current.z,
                magnitude: calculateMagnitude(lastGyro.current.x, lastGyro.current.y, lastGyro.current.z)
              },
              deviceId: connectedDevice?.id,
              deviceName: connectedDevice?.name || undefined,
            }).catch(err => console.error('[IMU] ❌ Failed to save:', err));
          }
        }
      }
    }
  }, [parseIMULine, calculateMagnitude, enableFirebase, user, connectedDevice]);

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
            console.error('[LSM6DSOMonitor] Error:', error);
            return;
          }

          if (characteristic?.value) {
            try {
              const decoded = base64.decode(characteristic.value);
              handleNotification(decoded);
            } catch (err) {
              console.error('[LSM6DSOMonitor] Decode error:', err);
            }
          }
        }
      );

      setIsMonitoring(true);
      console.log('[LSM6DSOMonitor] Started monitoring');
    } catch (error) {
      console.error('[LSM6DSOMonitor] Failed to start:', error);
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
      console.log('[LSM6DSOMonitor] Cleaning up...');
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      rxBuffer.current = '';
    };
  }, []);

  const accelMag = calculateMagnitude(imuData.accel.x, imuData.accel.y, imuData.accel.z);
  const gyroMag = calculateMagnitude(imuData.gyro.x, imuData.gyro.y, imuData.gyro.z);

  const chartWidth = Dimensions.get('window').width - 40;

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: '#2a3f5f',
    decimalPlaces: 2,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(224, 231, 255, ${opacity})`,
    style: { borderRadius: theme.borderRadius.lg },
    propsForDots: { r: '0' },
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <SectionHeader
          title="LSM6DSO IMU Sensor"
          subtitle={isConnected ? (isMonitoring ? 'Monitoring' : 'Ready') : 'Not Connected'}
          rightElement={
            <Badge variant={isConnected ? 'success' : 'error'} text={isConnected ? 'Connected' : 'Disconnected'} />
          }
        />
      </View>

      {/* Magnitude Cards */}
      <View style={styles.cardsRow}>
        <StatsCard
          icon="📐"
          label="Accel Mag"
          value={(accelMag / 1000).toFixed(2)}
          unit="g"
          color={theme.colors.sensors.accel}
        />
        <StatsCard
          icon="🔄"
          label="Gyro Mag"
          value={(gyroMag / 1000).toFixed(1)}
          unit="°/s"
          color={theme.colors.sensors.gyro}
        />
      </View>

      {/* Accelerometer Values */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>⬇️ Accelerometer (mg)</Text>
        <View style={styles.axisRow}>
          <View style={styles.axisItem}>
            <Text style={styles.axisLabel}>X</Text>
            <Text style={[styles.axisValue, { color: theme.colors.error }]}>{imuData.accel.x}</Text>
          </View>
          <View style={styles.axisItem}>
            <Text style={styles.axisLabel}>Y</Text>
            <Text style={[styles.axisValue, { color: theme.colors.success }]}>{imuData.accel.y}</Text>
          </View>
          <View style={styles.axisItem}>
            <Text style={styles.axisLabel}>Z</Text>
            <Text style={[styles.axisValue, { color: theme.colors.info }]}>{imuData.accel.z}</Text>
          </View>
        </View>
      </Card>

      {/* Gyroscope Values */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>🔄 Gyroscope (m°/s)</Text>
        <View style={styles.axisRow}>
          <View style={styles.axisItem}>
            <Text style={styles.axisLabel}>X</Text>
            <Text style={[styles.axisValue, { color: theme.colors.error }]}>{imuData.gyro.x}</Text>
          </View>
          <View style={styles.axisItem}>
            <Text style={styles.axisLabel}>Y</Text>
            <Text style={[styles.axisValue, { color: theme.colors.success }]}>{imuData.gyro.y}</Text>
          </View>
          <View style={styles.axisItem}>
            <Text style={styles.axisLabel}>Z</Text>
            <Text style={[styles.axisValue, { color: theme.colors.info }]}>{imuData.gyro.z}</Text>
          </View>
        </View>
      </Card>

      {/* Accelerometer Chart */}
      {accelXBuffer.length > 10 && (
        <Card style={styles.card}>
          <Text style={styles.chartTitle}>Accelerometer (g)</Text>
          <LineChart
            data={{
              labels: [],
              datasets: [
                { data: accelXBuffer.length > 0 ? accelXBuffer : [0], color: () => theme.colors.error },
                { data: accelYBuffer.length > 0 ? accelYBuffer : [0], color: () => theme.colors.success },
                { data: accelZBuffer.length > 0 ? accelZBuffer : [0], color: () => theme.colors.info },
              ],
              legend: ['X', 'Y', 'Z'],
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
        </Card>
      )}

      {/* Gyroscope Chart */}
      {gyroXBuffer.length > 10 && (
        <Card style={styles.card}>
          <Text style={styles.chartTitle}>Gyroscope (°/s)</Text>
          <LineChart
            data={{
              labels: [],
              datasets: [
                { data: gyroXBuffer.length > 0 ? gyroXBuffer : [0], color: () => theme.colors.error },
                { data: gyroYBuffer.length > 0 ? gyroYBuffer : [0], color: () => theme.colors.success },
                { data: gyroZBuffer.length > 0 ? gyroZBuffer : [0], color: () => theme.colors.info },
              ],
              legend: ['X', 'Y', 'Z'],
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
        </Card>
      )}

      {accelXBuffer.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {isConnected ? '⏳ Waiting for IMU data...' : '🔌 Connect device to start'}
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

  cardsRow: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  card: {
    margin: theme.spacing.md,
    marginTop: 0,
  },
  cardTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  axisItem: {
    alignItems: 'center',
  },
  axisLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  axisValue: {
    ...theme.typography.h3,
    fontWeight: '700',
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
