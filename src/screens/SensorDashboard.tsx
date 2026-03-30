/**
 * SensorDashboard: Complete production-grade sensor monitoring screen
 *
 * Integrates all layers of the pipeline:
 * - useSensorStream hook (Layer 4: state management)
 * - Memoized components (Layer 5: isolated re-renders)
 * - Error boundary (Layer 6: crash protection)
 * - BLE reconnect logic (Layer 6: connection resilience)
 *
 * Per the specification, this screen:
 * ✓ Receives data via 200ms batches from native module
 * ✓ Displays normal readings at 5Hz (via UI poller)
 * ✓ Immediately shows spike alerts when detected
 * ✓ Prevents UI freezes via memoization and ref-based state
 * ✓ Gracefully handles disconnection with exponential backoff reconnect
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSensorStream } from '../hooks/useSensorStream';
import {
  HeartRateCard,
  TemperatureCard,
  EDACard,
  GyroscopeCard,
  SpikeAlert,
  SensorStatus,
} from '../components/SensorDisplayComponents';
import {
  SensorErrorBoundary,
  SensorDashboardErrorBoundary,
} from '../components/SensorErrorBoundary';

interface SensorDashboardProps {
  deviceId?: string;
  onDisconnect?: () => void;
  onReconnect?: () => Promise<void>;
}

const SensorDashboardContent: React.FC<SensorDashboardProps> = ({
  deviceId = 'unknown',
  onDisconnect,
  onReconnect,
}) => {
  const insets = useSafeAreaInsets();
  const {
    displayHR,
    displayEDA,
    displayTemp,
    displayGyro,
    spikeAlert,
    clearAlert,
    isConnected,
    sensorModes,
  } = useSensorStream();

  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectingRef = useRef(false);

  // ===== RECONNECTION LOGIC: Exponential backoff with max 30s =====
  const attemptReconnect = useCallback(async (attempt = 1) => {
    if (isReconnectingRef.current) return;

    isReconnectingRef.current = true;
    setReconnectAttempt(attempt);

    try {
      if (onReconnect) {
        await onReconnect();
      }
      // Reset on successful reconnect
      setReconnectAttempt(0);
      isReconnectingRef.current = false;
    } catch (err) {
      console.error(`[SensorDashboard] Reconnect attempt ${attempt} failed:`, err);

      // Calculate backoff: min(1s * 2^attempt, 30s)
      const delayMs = Math.min(1000 * Math.pow(2, attempt), 30000);
      const nextAttempt = attempt + 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        attemptReconnect(nextAttempt);
      }, delayMs);

      isReconnectingRef.current = false;
    }
  }, [onReconnect]);

  // ===== DETECT DISCONNECTION =====
  useEffect(() => {
    if (!isConnected && !isReconnectingRef.current) {
      console.log('[SensorDashboard] Device disconnected, attempting reconnect...');
      if (onDisconnect) {
        onDisconnect();
      }
      attemptReconnect(1);
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isConnected, onDisconnect, attemptReconnect]);

  const handleManualReconnect = useCallback(() => {
    setReconnectAttempt(0);
    attemptReconnect(1);
  }, [attemptReconnect]);

  // ===== RENDER =====
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* Header with device info and connection status */}
      <View style={styles.header}>
        <View>
          <Text style={styles.deviceName}>Smart Stim Wristband</Text>
          <Text style={styles.deviceId}>ID: {deviceId}</Text>
        </View>
        <View
          style={[
            styles.connectionIndicator,
            { backgroundColor: isConnected ? '#4CAF50' : '#FF5722' },
          ]}
        >
          <Text style={styles.connectionStatus}>
            {isConnected ? '● Connected' : '● Disconnected'}
          </Text>
        </View>
      </View>

      {/* Reconnecting indicator */}
      {!isConnected && reconnectAttempt > 0 && (
        <View style={styles.reconnectingBanner}>
          <ActivityIndicator color="#2196F3" size="small" />
          <Text style={styles.reconnectingText}>
            Reconnecting... (Attempt {reconnectAttempt})
          </Text>
          <TouchableOpacity onPress={handleManualReconnect}>
            <Text style={styles.manualRetryText}>Retry Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Spike alert banner (floats above content when active) */}
      {spikeAlert && (
        <SensorErrorBoundary>
          <View style={styles.alertContainer}>
            <SpikeAlert
              sensor={spikeAlert.sensor}
              value={spikeAlert.value}
              delta={spikeAlert.delta}
            />
            <TouchableOpacity
              style={styles.alertCloseButton}
              onPress={clearAlert}
              activeOpacity={0.7}
            >
              <Text style={styles.alertCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </SensorErrorBoundary>
      )}

      {/* Sensor cards in scrollable content */}
      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContentInner}
      >
        {/* Sensor status badges */}
        <View style={styles.statusRow}>
          <SensorErrorBoundary>
            <SensorStatus
              sensor="hr"
              isInSpikeMode={sensorModes.hr || false}
              isConnected={isConnected}
            />
          </SensorErrorBoundary>
          <SensorErrorBoundary>
            <SensorStatus
              sensor="temp"
              isInSpikeMode={sensorModes.temp || false}
              isConnected={isConnected}
            />
          </SensorErrorBoundary>
          <SensorErrorBoundary>
            <SensorStatus
              sensor="eda"
              isInSpikeMode={sensorModes.eda || false}
              isConnected={isConnected}
            />
          </SensorErrorBoundary>
          <SensorErrorBoundary>
            <SensorStatus
              sensor="gyro"
              isInSpikeMode={sensorModes.gyro || false}
              isConnected={isConnected}
            />
          </SensorErrorBoundary>
        </View>

        {/* Heart Rate Card */}
        <SensorErrorBoundary>
          <HeartRateCard
            bpm={displayHR}
            mode={sensorModes.hr ? 'spike' : 'normal'}
          />
        </SensorErrorBoundary>

        {/* Temperature Card */}
        <SensorErrorBoundary>
          <TemperatureCard
            celsius={displayTemp}
            mode={sensorModes.temp ? 'spike' : 'normal'}
          />
        </SensorErrorBoundary>

        {/* EDA Card */}
        <SensorErrorBoundary>
          <EDACard value={displayEDA} mode={sensorModes.eda ? 'spike' : 'normal'} />
        </SensorErrorBoundary>

        {/* Gyroscope Card */}
        <SensorErrorBoundary>
          <GyroscopeCard x={displayGyro.x} y={displayGyro.y} z={displayGyro.z} />
        </SensorErrorBoundary>

        {/* Debug info (development only) */}
        {__DEV__ && (
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>Debug Info</Text>
            <Text style={styles.debugText}>Connection: {isConnected ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>HR Mode: {sensorModes.hr ? 'Spike' : 'Normal'}</Text>
            <Text style={styles.debugText}>
              Temp Mode: {sensorModes.temp ? 'Spike' : 'Normal'}
            </Text>
            <Text style={styles.debugText}>
              EDA Mode: {sensorModes.eda ? 'Spike' : 'Normal'}
            </Text>
            <Text style={styles.debugText}>
              Gyro Mode: {sensorModes.gyro ? 'Spike' : 'Normal'}
            </Text>
            {spikeAlert && (
              <Text style={styles.debugText}>
                Last Spike: {spikeAlert.sensor} @ {new Date(spikeAlert.timestamp).toLocaleTimeString()}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

/**
 * Main export: Wrapped in both SensorDashboardErrorBoundary and SensorErrorBoundary
 */
export const SensorDashboard: React.FC<SensorDashboardProps> = (props) => {
  return (
    <SensorDashboardErrorBoundary
      onDisconnect={props.onDisconnect}
    >
      <SensorDashboardContent {...props} />
    </SensorDashboardErrorBoundary>
  );
};

// ===== STYLES =====
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },

  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },

  deviceId: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },

  connectionIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },

  connectionStatus: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  reconnectingBanner: {
    backgroundColor: '#FFF3E0',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },

  reconnectingText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#E65100',
  },

  manualRetryText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2196F3',
    textDecorationLine: 'underline',
  },

  alertContainer: {
    position: 'relative',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  alertCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  alertCloseText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#999',
  },

  scrollContent: {
    flex: 1,
  },

  scrollContentInner: {
    padding: 16,
    paddingBottom: 32,
  },

  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    justifyContent: 'center',
  },

  debugSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#666',
  },

  debugTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  debugText: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});

export default SensorDashboard;
