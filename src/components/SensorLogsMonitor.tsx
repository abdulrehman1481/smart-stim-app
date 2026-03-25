import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  FlatList,
} from 'react-native';
import { useBLE } from '../functionality/BLEContext';
import { BleError, Characteristic } from 'react-native-ble-plx';
import { useAuth } from '../auth/AuthContext';
import { saveSensorLog } from '../firebase/dataLogger';
import { LOG_SERVICE_UUID, LOG_NOTIFY_UUID } from '../functionality/BLEProtocols';
import base64 from 'react-native-base64';

interface LogEntry {
  id: string;
  module: string;
  message: string;
  timestamp: Date;
}

interface ModuleTab {
  name: string;
  count: number;
}

/**
 * SensorLogsMonitor - Real-time log viewer for NRF sensor device
 * 
 * Features:
 * - Subscribe to BLE log notifications
 * - Display logs grouped by module (like Python viewer)
 * - Optional Firebase logging
 * - Filter by module/tab
 * - Auto-scroll to latest
 */
export const SensorLogsMonitor: React.FC = () => {
  const { connectedDevice, isConnected } = useBLE();
  const { user } = useAuth();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [modules, setModules] = useState<ModuleTab[]>([{ name: 'All', count: 0 }]);
  const [selectedModule, setSelectedModule] = useState<string>('All');
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [enableFirebase, setEnableFirebase] = useState<boolean>(false);
  
  const rxBuffer = useRef<string>('');
  const scrollViewRef = useRef<ScrollView>(null);
  const logIdCounter = useRef<number>(0);
  const subscriptionRef = useRef<any>(null);

  // Filtered logs based on selected module
  const filteredLogs = selectedModule === 'All'
    ? logs
    : logs.filter(log => log.module === selectedModule);

  /**
   * Parse module name from a BLE log line.
   *
   * Handles both Zephyr deferred-log format and plain module: format:
   *   Zephyr: "[00:00:01.234,000] <inf> as6221_demo: message"
   *   Plain:  "as6221_demo: message"
   */
  const parseModule = (line: string): string => {
    // Zephyr format: "[HH:MM:SS.mmm,mmm] <level> module_name: ..."
    const zephyrMatch = line.match(/^\[[\d:.,]+\]\s*<\w+>\s+([\w_]+)\s*:/);
    if (zephyrMatch) return zephyrMatch[1];
    // Plain format: "module_name: message"
    if (line.includes(':')) {
      const module = line.split(':', 1)[0].trim();
      return module || 'Unknown';
    }
    return 'Unknown';
  };

  /**
   * Add log entry and update module tabs
   */
  const addLogEntry = useCallback((module: string, message: string) => {
    const logEntry: LogEntry = {
      id: `log-${logIdCounter.current++}-${Date.now()}`,
      module,
      message,
      timestamp: new Date(),
    };

    setLogs(prev => {
      const newLogs = [...prev, logEntry];
      // Keep only last 500 logs to prevent memory issues
      if (newLogs.length > 500) {
        return newLogs.slice(-500);
      }
      return newLogs;
    });

    // Update module tabs
    setModules(prev => {
      const allTab = prev.find(m => m.name === 'All');
      const moduleTab = prev.find(m => m.name === module);
      
      const updated = prev.map(m => {
        if (m.name === 'All') {
          return { ...m, count: m.count + 1 };
        }
        if (m.name === module) {
          return { ...m, count: m.count + 1 };
        }
        return m;
      });

      // Add new module tab if not exists
      if (!moduleTab && module !== 'Unknown') {
        updated.push({ name: module, count: 1 });
      }

      return updated;
    });

    // Save to Firebase if enabled
    if (enableFirebase && user) {
      saveSensorLog(user.uid, {
        module,
        message,
        logLevel: 'INFO',
        deviceName: connectedDevice?.name || undefined,
      }).catch(err => {
        console.error('[SensorLogsMonitor] Firebase save failed:', err);
      });
    }

    // Auto-scroll to bottom after a short delay
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [enableFirebase, user, connectedDevice]);

  /**
   * Handle incoming BLE notifications
   * Reassembles fragmented messages into complete lines
   */
  const handleNotification = useCallback((data: string) => {
    // Append to buffer
    rxBuffer.current += data;

    // Normalize line endings
    rxBuffer.current = rxBuffer.current.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Process complete lines
    while (rxBuffer.current.includes('\n')) {
      const newlineIndex = rxBuffer.current.indexOf('\n');
      const line = rxBuffer.current.substring(0, newlineIndex).trim();
      rxBuffer.current = rxBuffer.current.substring(newlineIndex + 1);

      if (line) {
        const module = parseModule(line);
        addLogEntry(module, line);
      }
    }
  }, [addLogEntry]);

  /**
   * Subscribe to BLE log notifications
   */
  const startMonitoring = async () => {
    if (!connectedDevice || !isConnected) {
      Alert.alert('Not Connected', 'Please connect to a device first.');
      return;
    }

    try {
      console.log('[SensorLogsMonitor] Starting notifications for:', LOG_NOTIFY_UUID);

      // Clear any existing subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      
      // Clear buffer
      rxBuffer.current = '';

      // Subscribe to notifications
      subscriptionRef.current = connectedDevice.monitorCharacteristicForService(
        LOG_SERVICE_UUID,
        LOG_NOTIFY_UUID,
        (error: BleError | null, characteristic: Characteristic | null) => {
          if (error) {
            console.error('[SensorLogsMonitor] Notification error:', error);
            Alert.alert('Error', `Failed to receive logs: ${error.message}`);
            setIsMonitoring(false);
            return;
          }

          if (characteristic?.value) {
            try {
              const decoded = base64.decode(characteristic.value);
              handleNotification(decoded);
            } catch (err) {
              console.error('[SensorLogsMonitor] Decode error:', err);
            }
          }
        }
      );

      setIsMonitoring(true);
      addLogEntry('System', '✅ Log monitoring started');
      console.log('[SensorLogsMonitor] Started monitoring');
    } catch (error: any) {
      console.error('[SensorLogsMonitor] Failed to start monitoring:', error);
      Alert.alert('Error', `Failed to start monitoring: ${error.message}`);
    }
  };

  /**
   * Stop monitoring
   */
  const stopMonitoring = () => {
    console.log('[SensorLogsMonitor] Stopping monitoring...');
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setIsMonitoring(false);
    rxBuffer.current = '';
    addLogEntry('System', '🛑 Log monitoring stopped');
  };

  /**
   * Clear logs
   */
  const clearLogs = () => {
    Alert.alert(
      'Clear Logs',
      `Clear all logs in "${selectedModule}" tab?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            if (selectedModule === 'All') {
              setLogs([]);
              setModules([{ name: 'All', count: 0 }]);
            } else {
              setLogs(prev => prev.filter(log => log.module !== selectedModule));
              setModules(prev =>
                prev.map(m =>
                  m.name === selectedModule ? { ...m, count: 0 } : m
                )
              );
            }
          },
        },
      ]
    );
  };

  /**
   * Auto-start monitoring when device connects
   */
  useEffect(() => {
    if (isConnected && connectedDevice && !isMonitoring) {
      // Auto-start after 1 second to allow device to initialize
      const timer = setTimeout(() => {
        startMonitoring();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, connectedDevice]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      console.log('[SensorLogsMonitor] Cleaning up...');
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      rxBuffer.current = '';
    };
  }, []);

  const renderLogItem = ({ item }: { item: LogEntry }) => {
    const timeStr = item.timestamp.toLocaleTimeString();
    
    return (
      <View style={styles.logItem}>
        <Text style={styles.logTime}>{timeStr}</Text>
        <Text style={styles.logMessage}>{item.message}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Connection Status */}
      <View style={styles.statusBar}>
        <View style={styles.statusInfo}>
          <View style={[styles.statusDot, isConnected ? styles.connected : styles.disconnected]} />
          <Text style={styles.statusText}>
            {isConnected ? `Connected: ${connectedDevice?.name || 'Unknown'}` : 'Not Connected'}
          </Text>
        </View>
        <View style={styles.monitoringBadge}>
          <Text style={styles.monitoringText}>
            {isMonitoring ? '📡 Monitoring' : '⏸️ Paused'}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, isMonitoring ? styles.buttonStop : styles.buttonStart]}
          onPress={isMonitoring ? stopMonitoring : startMonitoring}
          disabled={!isConnected}
        >
          <Text style={styles.buttonText}>
            {isMonitoring ? 'Stop' : 'Start'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonClear]}
          onPress={clearLogs}
        >
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>

        <View style={styles.firebaseToggle}>
          <Text style={styles.toggleLabel}>Firebase</Text>
          <Switch
            value={enableFirebase}
            onValueChange={setEnableFirebase}
            disabled={!user}
          />
        </View>
      </View>

      {/* Module Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {modules.map(module => (
          <TouchableOpacity
            key={module.name}
            style={[
              styles.tab,
              selectedModule === module.name && styles.tabActive,
            ]}
            onPress={() => setSelectedModule(module.name)}
          >
            <Text style={[
              styles.tabText,
              selectedModule === module.name && styles.tabTextActive,
            ]}>
              {module.name}
            </Text>
            <Text style={[
              styles.tabCount,
              selectedModule === module.name && styles.tabCountActive,
            ]}>
              {module.count}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Logs Display */}
      <View style={styles.logsContainer}>
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {isMonitoring ? '⏳ Waiting for logs...' : '🔌 Connect device and start monitoring'}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={scrollViewRef as any}
            data={filteredLogs}
            renderItem={renderLogItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.logsList}
            showsVerticalScrollIndicator={true}
            onContentSizeChange={() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }}
          />
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} • {modules.length - 1} module{modules.length !== 2 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1a1f3a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a3f5f',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  connected: {
    backgroundColor: '#4ade80',
  },
  disconnected: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    color: '#e0e7ff',
    fontSize: 14,
    fontWeight: '500',
  },
  monitoringBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#374151',
    borderRadius: 12,
  },
  monitoringText: {
    color: '#e0e7ff',
    fontSize: 12,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#1a1f3a',
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonStart: {
    backgroundColor: '#22c55e',
  },
  buttonStop: {
    backgroundColor: '#ef4444',
  },
  buttonClear: {
    backgroundColor: '#6366f1',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  firebaseToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  toggleLabel: {
    color: '#e0e7ff',
    fontSize: 12,
    fontWeight: '600',
  },
  tabsContainer: {
    maxHeight: 50,
    backgroundColor: '#1a1f3a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a3f5f',
  },
  tabsContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#374151',
    borderRadius: 16,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabCount: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#1f2937',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 20,
    textAlign: 'center',
  },
  tabCountActive: {
    color: '#6366f1',
    backgroundColor: '#fff',
  },
  logsContainer: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  logsList: {
    padding: 12,
  },
  logItem: {
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#1a1f3a',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  logTime: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  logMessage: {
    color: '#e0e7ff',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
  },
  footer: {
    padding: 10,
    backgroundColor: '#1a1f3a',
    borderTopWidth: 1,
    borderTopColor: '#2a3f5f',
    alignItems: 'center',
  },
  footerText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
  },
});
