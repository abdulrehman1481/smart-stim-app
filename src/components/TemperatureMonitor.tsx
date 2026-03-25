import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import base64 from 'react-native-base64';
import { useBLE } from '../functionality/BLEContext';
import { LOG_SERVICE_UUID, LOG_NOTIFY_UUID } from '../functionality/BLEProtocols';
import { useAuth } from '../auth/AuthContext';
import { saveTemperatureReading } from '../firebase/dataLogger';

/**
 * Temperature Monitor Component
 * 
 * Monitors AS6221 temperature sensor data from device logs
 * Parses log format: "as6221_demo: [AS6221] Temperature: 24.5°C"
 */
export const TemperatureMonitor: React.FC = () => {
  const { connectedDevice, isConnected } = useBLE();
  const { user } = useAuth();
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [temperature, setTemperature] = useState<string>('--');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const subscriptionRef = useRef<any>(null);
  const rxBuffer = useRef<string>('');
  const sampleCounter = useRef<number>(0);

  /**
   * Parse temperature from AS6221 log line
   * Format: "as6221_demo: [AS6221] Temperature: 24.5°C"
   */
  const parseTemperature = useCallback((line: string): number | null => {
    if (!line.includes('as6221_demo:') && !line.includes('[AS6221]')) {
      return null;
    }

    // Match patterns like: "Temperature: 24.5°C" or "Temp: 24.5" or "T=24.5"
    const tempMatch = line.match(/(?:Temperature|Temp|T)[:\s=]+?([-\d.]+)/i);
    if (tempMatch) {
      const temp = parseFloat(tempMatch[1]);
      if (!isNaN(temp)) {
        return temp;
      }
    }

    return null;
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
        const temp = parseTemperature(line);
        if (temp !== null) {
          setTemperature(temp.toFixed(1));
          setLastUpdate(new Date());
          console.log('[TempMonitor] Temperature:', temp.toFixed(1), '°C');

          // Save to Firebase (throttled - every 10 samples)
          sampleCounter.current++;
          if (isConnected && user && sampleCounter.current % 10 === 0) {
            saveTemperatureReading(user.uid, {
              temperature: temp,
              temperatureFahrenheit: (temp * 9/5) + 32,
              bodyLocation: 'WRIST',
              skinContact: temp > 25 && temp < 45,
              deviceId: connectedDevice?.id,
              deviceName: connectedDevice?.name || undefined,
            }).catch(err => {
              console.error('[Temperature] ❌ Failed to save:', err);
            });
          }
        }
      }
    }
  }, [parseTemperature, user, connectedDevice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[TempMonitor] Cleaning up...');
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.remove();
        } catch (err) {
          console.error('[TempMonitor] Cleanup error:', err);
        }
        subscriptionRef.current = null;
      }
    };
  }, []);

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
        (error, characteristic) => {
          if (error) {
            console.error('[TempMonitor] Error:', error.message);
            return;
          }

          if (characteristic?.value) {
            try {
              const decoded = base64.decode(characteristic.value);
              handleNotification(decoded);
            } catch (err) {
              console.error('[TempMonitor] Decode error:', err);
            }
          }
        }
      );

      setIsMonitoring(true);
      console.log('[TempMonitor] Started monitoring');
    } catch (error: any) {
      console.error('[TempMonitor] Failed to start:', error.message);
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
      console.log('[TempMonitor] Cleaning up...');
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      rxBuffer.current = '';
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>🌡️ Temperature Monitor</Text>
          <View style={[styles.statusBadge, isMonitoring && styles.statusBadgeActive]}>
            <Text style={styles.statusText}>
              {isMonitoring ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        {!isConnected ? (
          <View style={styles.disconnectedState}>
            <Text style={styles.disconnectedText}>
              Please connect to a device first
            </Text>
            <Text style={styles.hintText}>
              Device must have AS6221 temperature sensor
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.displayContainer}>
              <Text style={styles.temperatureLabel}>Temperature</Text>
              <View style={styles.temperatureDisplay}>
                {isMonitoring && temperature !== '--' ? (
                  <>
                    <Text style={styles.temperatureValue}>{temperature}</Text>
                    <Text style={styles.temperatureUnit}>°C</Text>
                  </>
                ) : (
                  <Text style={styles.temperatureValue}>--</Text>
                )}
              </View>
              {lastUpdate && (
                <Text style={styles.lastUpdate}>
                  Last update: {lastUpdate.toLocaleTimeString()}
                </Text>
              )}
            </View>

            <View style={styles.info}>
              <Text style={styles.infoText}>
                ℹ️ Monitoring AS6221 temperature sensor via device logs
              </Text>
              <Text style={styles.infoSubtext}>
                Auto-starts when device is connected
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  statusBadgeActive: {
    backgroundColor: '#10b981',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  disconnectedState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  disconnectedText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  displayContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 20,
  },
  temperatureLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 8,
  },
  temperatureDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  temperatureValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  temperatureUnit: {
    fontSize: 24,
    color: '#f59e0b',
    marginLeft: 4,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
  info: {
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1e40af',
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 11,
    color: '#60a5fa',
    fontStyle: 'italic',
  },
});
