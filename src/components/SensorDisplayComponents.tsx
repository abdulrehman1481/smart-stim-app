/**
 * Memoized sensor display components
 *
 * LAYER 5: Each component wrapped in React.memo with isolated prop slices.
 * Heart rate updates do NOT re-render gyroscope or EDA components.
 *
 * This prevents cascading re-renders and keeps the UI responsive even under
 * high-frequency sensor updates.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// ===== HEART RATE CARD =====
interface HeartRateCardProps {
  bpm: number;
  mode?: 'normal' | 'spike';
}

export const HeartRateCard = React.memo(({ bpm, mode = 'normal' }: HeartRateCardProps) => (
  <View style={[styles.card, mode === 'spike' && styles.cardSpike]}>
    <Text style={styles.label}>Heart Rate</Text>
    <Text style={[styles.value, mode === 'spike' && styles.valueAlert]}>
      {bpm.toFixed(0)}
    </Text>
    <Text style={styles.unit}>bpm</Text>
    {mode === 'spike' && <Text style={styles.badge}>SPIKE MODE</Text>}
  </View>
));

HeartRateCard.displayName = 'HeartRateCard';

// ===== TEMPERATURE CARD =====
interface TemperatureCardProps {
  celsius: number;
  mode?: 'normal' | 'spike';
}

export const TemperatureCard = React.memo(({ celsius, mode = 'normal' }: TemperatureCardProps) => (
  <View style={[styles.card, mode === 'spike' && styles.cardSpike]}>
    <Text style={styles.label}>Temperature</Text>
    <Text style={[styles.value, mode === 'spike' && styles.valueAlert]}>
      {celsius.toFixed(1)}
    </Text>
    <Text style={styles.unit}>°C</Text>
    {mode === 'spike' && <Text style={styles.badge}>SPIKE MODE</Text>}
  </View>
));

TemperatureCard.displayName = 'TemperatureCard';

// ===== EDA CARD =====
interface EDACardProps {
  value: number;
  mode?: 'normal' | 'spike';
}

export const EDACard = React.memo(({ value, mode = 'normal' }: EDACardProps) => (
  <View style={[styles.card, mode === 'spike' && styles.cardSpike]}>
    <Text style={styles.label}>EDA</Text>
    <Text style={[styles.value, mode === 'spike' && styles.valueAlert]}>
      {value.toFixed(2)}
    </Text>
    <Text style={styles.unit}>µS</Text>
    {mode === 'spike' && <Text style={styles.badge}>SPIKE MODE</Text>}
  </View>
));

EDACard.displayName = 'EDACard';

// ===== GYROSCOPE CARD =====
interface GyroscopeCardProps {
  x: number;
  y: number;
  z: number;
}

export const GyroscopeCard = React.memo(({ x, y, z }: GyroscopeCardProps) => {
  const magnitude = Math.sqrt(x * x + y * y + z * z);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Gyroscope</Text>
      <View style={styles.gyroValues}>
        <Text style={styles.gyroAxis}>X: {x.toFixed(2)}°/s</Text>
        <Text style={styles.gyroAxis}>Y: {y.toFixed(2)}°/s</Text>
        <Text style={styles.gyroAxis}>Z: {z.toFixed(2)}°/s</Text>
      </View>
      <Text style={styles.gyroMagnitude}>Magnitude: {magnitude.toFixed(2)}g</Text>
    </View>
  );
});

GyroscopeCard.displayName = 'GyroscopeCard';

// ===== SPIKE ALERT BANNER =====
interface SpikeAlertProps {
  sensor: string;
  value: number;
  delta: number;
}

export const SpikeAlert = React.memo(({ sensor, value, delta }: SpikeAlertProps) => {
  const sensorLabel = {
    hr: 'Heart Rate',
    temp: 'Temperature',
    eda: 'EDA',
    gyro: 'Gyroscope',
  }[sensor] || sensor.toUpperCase();

  const unit = {
    hr: 'bpm',
    temp: '°C',
    eda: 'µS',
    gyro: 'g',
  }[sensor] || '';

  return (
    <View style={styles.alertBanner}>
      <Text style={styles.alertTitle}>⚠️ SPIKE DETECTED</Text>
      <Text style={styles.alertText}>
        {sensorLabel}: {value.toFixed(2)} {unit} (Δ{delta.toFixed(2)})
      </Text>
    </View>
  );
});

SpikeAlert.displayName = 'SpikeAlert';

// ===== SENSOR STATUS BADGE =====
interface SensorStatusProps {
  sensor: string;
  isInSpikeMode: boolean;
  isConnected: boolean;
}

export const SensorStatus = React.memo(
  ({ sensor, isInSpikeMode, isConnected }: SensorStatusProps) => {
    const sensorName = {
      hr: 'Heart Rate',
      temp: 'Temperature',
      eda: 'EDA',
      gyro: 'Gyroscope',
    }[sensor] || sensor.toUpperCase();

    let statusColor = '#4CAF50'; // green = normal
    let statusText = 'Normal';

    if (!isConnected) {
      statusColor = '#9E9E9E'; // gray = disconnected
      statusText = 'Disconnected';
    } else if (isInSpikeMode) {
      statusColor = '#FF5722'; // red = spike
      statusText = 'Spike Mode';
    }

    return (
      <View style={styles.statusBadge}>
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: statusColor },
          ]}
        />
        <Text style={styles.statusLabel}>{sensorName}</Text>
        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusText}
        </Text>
      </View>
    );
  }
);

SensorStatus.displayName = 'SensorStatus';

// ===== STYLES =====
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  cardSpike: {
    backgroundColor: '#fff3e0',
    borderLeftColor: '#FF5722',
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  value: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },

  valueAlert: {
    color: '#FF5722',
  },

  unit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
    marginTop: 4,
  },

  badge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FF5722',
    backgroundColor: '#FFE0B2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },

  gyroValues: {
    marginVertical: 8,
  },

  gyroAxis: {
    fontSize: 13,
    color: '#333',
    fontFamily: 'monospace',
    marginVertical: 2,
  },

  gyroMagnitude: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginTop: 6,
  },

  alertBanner: {
    backgroundColor: '#FF5722',
    padding: 16,
    borderRadius: 8,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#E64A19',
  },

  alertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },

  alertText: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.95,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 4,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },

  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },

  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },

  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
