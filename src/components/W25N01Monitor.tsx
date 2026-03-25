import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import base64 from 'react-native-base64';
import { LOG_SERVICE_UUID, LOG_NOTIFY_UUID } from '../functionality/BLEProtocols';
import { useAuth } from '../auth/AuthContext';
import { saveSensorLog } from '../firebase/dataLogger';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

interface FlashOperation {
  timestamp: number;
  type: 'ERASE' | 'PROGRAM' | 'READ' | 'VERIFY' | 'STATUS' | 'OTHER';
  status: string;
  details: string;
}

interface FlashStats {
  totalOps: number;
  successCount: number;
  failCount: number;
  lastVerify: 'PASS' | 'FAIL' | 'PENDING';
  dataRead: string;
  statusRegister: string;
}

export const W25N01Monitor: React.FC = () => {
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [operations, setOperations] = useState<FlashOperation[]>([]);
  const [stats, setStats] = useState<FlashStats>({
    totalOps: 0,
    successCount: 0,
    failCount: 0,
    lastVerify: 'PENDING',
    dataRead: '',
    statusRegister: '0x00',
  });
  const [saveToFirebase, setSaveToFirebase] = useState(false);
  const [firebaseSaveCount, setFirebaseSaveCount] = useState(0);

  const { user } = useAuth();
  const bleManager = new BleManager();
  
  // Buffer to reassemble fragmented BLE notifications into complete lines
  const rxBuffer = useRef<string>('');
  const subscriptionRef = useRef<any>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[W25N01Monitor] Cleaning up...');
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      rxBuffer.current = '';
      bleManager.destroy();
    };
  }, []);

  const parseLogLine = (line: string): FlashOperation | null => {
    const timestamp = Date.now();

    // Parse different log patterns from w25n01_task.c
    
    // Erase operation: "Erase issued for block=1 (page=64)"
    if (line.includes('Erase issued')) {
      const blockMatch = line.match(/block=(\d+)/);
      const pageMatch = line.match(/page=(\d+)/);
      return {
        timestamp,
        type: 'ERASE',
        status: 'IN_PROGRESS',
        details: `Block ${blockMatch?.[1] || '?'}, Page ${pageMatch?.[1] || '?'}`,
      };
    }

    // Erase result: "ERASE: READY (STATUS=0xXX)" and "Erase OK"
    if (line.includes('ERASE: READY')) {
      const statusMatch = line.match(/STATUS=0x([0-9A-F]+)/i);
      return {
        timestamp,
        type: 'STATUS',
        status: 'READY',
        details: `Erase Ready - Status: 0x${statusMatch?.[1] || '??'}`,
      };
    }
    if (line.includes('Erase OK')) {
      return {
        timestamp,
        type: 'ERASE',
        status: 'SUCCESS',
        details: 'Erase completed successfully',
      };
    }
    if (line.includes('ERASE FAILED')) {
      const statusMatch = line.match(/STATUS=0x([0-9A-F]+)/i);
      return {
        timestamp,
        type: 'ERASE',
        status: 'FAILED',
        details: `Erase failed - Status: 0x${statusMatch?.[1] || '??'}`,
      };
    }

    // Program operation: "Program execute issued (page=64)"
    if (line.includes('Program execute issued')) {
      const pageMatch = line.match(/page=(\d+)/);
      return {
        timestamp,
        type: 'PROGRAM',
        status: 'IN_PROGRESS',
        details: `Programming page ${pageMatch?.[1] || '?'}`,
      };
    }

    // Program result: "PROGRAM: READY (STATUS=0xXX)" and "Program OK"
    if (line.includes('PROGRAM: READY')) {
      const statusMatch = line.match(/STATUS=0x([0-9A-F]+)/i);
      return {
        timestamp,
        type: 'STATUS',
        status: 'READY',
        details: `Program Ready - Status: 0x${statusMatch?.[1] || '??'}`,
      };
    }
    if (line.includes('Program OK')) {
      return {
        timestamp,
        type: 'PROGRAM',
        status: 'SUCCESS',
        details: 'Program completed successfully',
      };
    }
    if (line.includes('PROGRAM FAILED')) {
      const statusMatch = line.match(/STATUS=0x([0-9A-F]+)/i);
      return {
        timestamp,
        type: 'PROGRAM',
        status: 'FAILED',
        details: `Program failed - Status: 0x${statusMatch?.[1] || '??'}`,
      };
    }

    // Read operation: "PAGE_READ: READY (STATUS=0xXX)"
    if (line.includes('PAGE_READ: READY')) {
      const statusMatch = line.match(/STATUS=0x([0-9A-F]+)/i);
      return {
        timestamp,
        type: 'READ',
        status: 'SUCCESS',
        details: `Page read - Status: 0x${statusMatch?.[1] || '??'}`,
      };
    }

    // Data dump: "SUMMARY STRING: 'HELLO NAND'" or "DUMP: 48 45 4C..."
    if (line.includes('SUMMARY STRING:')) {
      const dataMatch = line.match(/SUMMARY STRING: '([^']*)'/);
      const data = dataMatch?.[1] || '';
      return {
        timestamp,
        type: 'READ',
        status: 'DATA',
        details: `Data: "${data}"`,
      };
    }
    if (line.includes('DUMP:')) {
      // Extract hex bytes and ASCII
      const parts = line.split('|');
      const hexPart = parts[0]?.replace('DUMP:', '').trim();
      const asciiPart = parts[1]?.trim();
      return {
        timestamp,
        type: 'READ',
        status: 'DATA',
        details: `HEX: ${hexPart} | ASCII: ${asciiPart || ''}`,
      };
    }

    // Verify result: "VERIFY: PASS" or "VERIFY: FAIL"
    if (line.includes('VERIFY:')) {
      const result = line.includes('PASS') ? 'PASS' : 'FAIL';
      return {
        timestamp,
        type: 'VERIFY',
        status: result,
        details: `Verification ${result}`,
      };
    }

    // Demo markers
    if (line.includes('W25N01 NAND DEMO START')) {
      return {
        timestamp,
        type: 'OTHER',
        status: 'INFO',
        details: '=== DEMO START ===',
      };
    }
    if (line.includes('W25N01 NAND DEMO END')) {
      return {
        timestamp,
        type: 'OTHER',
        status: 'INFO',
        details: '=== DEMO END | next run in 30s ===',
      };
    }

    // NAND reset
    if (line.includes('NAND reset')) {
      return {
        timestamp,
        type: 'OTHER',
        status: 'INFO',
        details: 'NAND reset',
      };
    }

    // Protection cleared
    if (line.includes('Protection cleared')) {
      return {
        timestamp,
        type: 'OTHER',
        status: 'INFO',
        details: 'Protection cleared (A0=0x00)',
      };
    }

    return null;
  };

  const updateStats = (operation: FlashOperation) => {
    setStats(prev => {
      const newStats = { ...prev };
      
      newStats.totalOps++;

      if (operation.status === 'SUCCESS') {
        newStats.successCount++;
      } else if (operation.status === 'FAILED') {
        newStats.failCount++;
      }

      if (operation.type === 'VERIFY') {
        newStats.lastVerify = operation.status === 'PASS' ? 'PASS' : 'FAIL';
      }

      if (operation.type === 'READ' && operation.status === 'DATA') {
        // Extract data string
        const dataMatch = operation.details.match(/Data: "([^"]*)"/);
        if (dataMatch) {
          newStats.dataRead = dataMatch[1];
        } else if (operation.details.includes('ASCII:')) {
          const asciiMatch = operation.details.match(/ASCII: (.*)/);
          if (asciiMatch) {
            newStats.dataRead = asciiMatch[1];
          }
        }
      }

      // Extract status register values
      if (operation.details.includes('Status: 0x')) {
        const statusMatch = operation.details.match(/Status: (0x[0-9A-F]+)/i);
        if (statusMatch) {
          newStats.statusRegister = statusMatch[1];
        }
      }

      return newStats;
    });
  };

  const saveToFirebaseDb = async (operation: FlashOperation) => {
    if (!saveToFirebase || !user) return;

    try {
      // Save to sensor_logs
      await saveSensorLog(user.uid, {
        module: 'w25n01_mem',
        message: `[${operation.type}] ${operation.status}: ${operation.details}`,
      });

      // Save detailed flash operation data
      await addDoc(collection(db, 'users', user.uid, 'flash_operations'), {
        type: operation.type,
        status: operation.status,
        details: operation.details,
        timestamp: serverTimestamp(),
      });

      // Update stats every 10 operations
      if (stats.totalOps % 10 === 0) {
        await addDoc(collection(db, 'users', user.uid, 'flash_stats'), {
          totalOps: stats.totalOps,
          successCount: stats.successCount,
          failCount: stats.failCount,
          lastVerify: stats.lastVerify,
          dataRead: stats.dataRead,
          statusRegister: stats.statusRegister,
          timestamp: serverTimestamp(),
        });
      }

      setFirebaseSaveCount(prev => prev + 1);
    } catch (error) {
      console.error('[W25N01Monitor] Firebase save error:', error);
    }
  };

  const startMonitoring = async () => {
    try {
      const devices = await bleManager.connectedDevices([LOG_SERVICE_UUID]);
      
      if (devices.length === 0) {
        Alert.alert('Error', 'No device connected. Please connect a device first.');
        return;
      }

      const device = devices[0];
      setConnectedDevice(device);
      
      // Clear buffer on new monitoring session
      rxBuffer.current = '';

      // Subscribe to BLE log notifications
      subscriptionRef.current = device.monitorCharacteristicForService(
        LOG_SERVICE_UUID,
        LOG_NOTIFY_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('[W25N01Monitor] BLE Error:', error);
            return;
          }

          if (characteristic?.value) {
            try {
              const chunk = base64.decode(characteristic.value);
              
              // Accumulate chunks into buffer
              rxBuffer.current += chunk;
              
              // Normalize newlines
              rxBuffer.current = rxBuffer.current.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
              
              // Process complete lines only
              while (rxBuffer.current.includes('\n')) {
                const newlineIndex = rxBuffer.current.indexOf('\n');
                const line = rxBuffer.current.substring(0, newlineIndex).trim();
                rxBuffer.current = rxBuffer.current.substring(newlineIndex + 1);
                
                if (!line) continue;
                
                // Only process w25n01_mem logs
                if (line.includes('w25n01_mem:')) {
                  console.log('[W25N01Monitor] 📝', line);
                  const operation = parseLogLine(line);
                  
                  if (operation) {
                    // Extra logging for VERIFY and READ operations
                    if (operation.type === 'VERIFY') {
                      if (operation.status === 'FAIL') {
                        console.error('[W25N01Monitor] ❌ VERIFY FAILED:', operation.details);
                      } else {
                        console.log('[W25N01Monitor] ✅ VERIFY PASSED');
                      }
                    } else if (operation.type === 'READ' && operation.status === 'DATA') {
                      console.log('[W25N01Monitor] 📖 DATA:', operation.details);
                    } else if (operation.status === 'FAILED') {
                      console.error('[W25N01Monitor] ❌ OPERATION FAILED:', operation.details);
                    }
                    
                    setOperations(prev => [operation, ...prev].slice(0, 100));
                    updateStats(operation);
                    saveToFirebaseDb(operation);
                  }
                }
              }
            } catch (err) {
              console.error('[W25N01Monitor] Decode error:', err);
            }
          }
        }
      );

      setIsMonitoring(true);
      console.log('[W25N01Monitor] Started monitoring W25N01 flash operations');
    } catch (error) {
      console.error('[W25N01Monitor] Start monitoring error:', error);
      Alert.alert('Error', 'Failed to start monitoring');
      setIsMonitoring(false);
    }
  };

  const stopMonitoring = () => {
    console.log('[W25N01Monitor] Stopping monitoring...');
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    rxBuffer.current = '';
    setIsMonitoring(false);
    setConnectedDevice(null);
    console.log('[W25N01Monitor] Stopped monitoring');
  };

  const clearData = () => {
    setOperations([]);
    setStats({
      totalOps: 0,
      successCount: 0,
      failCount: 0,
      lastVerify: 'PENDING',
      dataRead: '',
      statusRegister: '0x00',
    });
    setFirebaseSaveCount(0);
  };

  const getOperationColor = (type: string, status: string) => {
    if (status === 'SUCCESS' || status === 'PASS') return '#4CAF50';
    if (status === 'FAILED' || status === 'FAIL') return '#f44336';
    if (status === 'IN_PROGRESS') return '#FF9800';
    if (status === 'DATA') return '#2196F3';
    return '#757575';
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'ERASE': return '🗑️';
      case 'PROGRAM': return '✍️';
      case 'READ': return '📖';
      case 'VERIFY': return '✅';
      case 'STATUS': return 'ℹ️';
      default: return '📌';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💾 W25N01 NAND Flash Monitor</Text>
        <Text style={styles.subtitle}>128Mb NAND Flash Memory Operations</Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, isMonitoring ? styles.buttonStop : styles.buttonStart]}
          onPress={isMonitoring ? stopMonitoring : startMonitoring}
        >
          <Text style={styles.buttonText}>
            {isMonitoring ? '⏹ Stop' : '▶️ Start'} Monitoring
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonClear]}
          onPress={clearData}
        >
          <Text style={styles.buttonText}>🗑️ Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Firebase Toggle */}
      <View style={styles.firebaseToggle}>
        <Text style={styles.toggleLabel}>Save to Firebase</Text>
        <Switch
          value={saveToFirebase}
          onValueChange={setSaveToFirebase}
          disabled={!user}
        />
        {!user && <Text style={styles.firebaseWarning}>Login required</Text>}
        {saveToFirebase && user && (
          <Text style={styles.firebaseSaved}>Saved: {firebaseSaveCount}</Text>
        )}
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>📊 Flash Statistics</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Ops</Text>
            <Text style={styles.statValue}>{stats.totalOps}</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Success</Text>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>
              {stats.successCount}
            </Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Failed</Text>
            <Text style={[styles.statValue, { color: '#f44336' }]}>
              {stats.failCount}
            </Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Last Verify</Text>
            <Text style={[
              styles.statValue,
              { color: stats.lastVerify === 'PASS' ? '#4CAF50' : stats.lastVerify === 'FAIL' ? '#f44336' : '#757575' }
            ]}>
              {stats.lastVerify}
            </Text>
          </View>
        </View>

        <View style={styles.dataSection}>
          <Text style={styles.dataLabel}>Last Data Read:</Text>
          <Text style={styles.dataValue}>
            {stats.dataRead || 'No data yet'}
          </Text>
        </View>

        <View style={styles.dataSection}>
          <Text style={styles.dataLabel}>Status Register:</Text>
          <Text style={styles.dataValue}>{stats.statusRegister}</Text>
        </View>
      </View>

      {/* Operations Log */}
      <View style={styles.logContainer}>
        <Text style={styles.sectionTitle}>📋 Operations Log</Text>
        <Text style={styles.logSubtitle}>
          {operations.length} operations (last 100)
        </Text>
        
        {operations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {isMonitoring 
                ? 'Waiting for W25N01 flash operations...\nDemo runs every 30 seconds.'
                : 'Press Start to begin monitoring'}
            </Text>
          </View>
        ) : (
          operations.map((op, index) => (
            <View
              key={`${op.timestamp}-${index}`}
              style={[
                styles.logEntry,
                { borderLeftColor: getOperationColor(op.type, op.status) }
              ]}
            >
              <View style={styles.logHeader}>
                <Text style={styles.logIcon}>{getOperationIcon(op.type)}</Text>
                <Text style={styles.logType}>{op.type}</Text>
                <Text style={[
                  styles.logStatus,
                  { color: getOperationColor(op.type, op.status) }
                ]}>
                  {op.status}
                </Text>
              </View>
              <Text style={styles.logDetails}>{op.details}</Text>
              <Text style={styles.logTimestamp}>
                {new Date(op.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#9C27B0',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  controls: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonStart: {
    backgroundColor: '#4CAF50',
  },
  buttonStop: {
    backgroundColor: '#f44336',
  },
  buttonClear: {
    backgroundColor: '#757575',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  firebaseToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 8,
    gap: 10,
  },
  toggleLabel: {
    fontSize: 16,
    flex: 1,
  },
  firebaseWarning: {
    color: '#f44336',
    fontSize: 12,
  },
  firebaseSaved: {
    color: '#4CAF50',
    fontSize: 12,
  },
  statsContainer: {
    backgroundColor: 'white',
    margin: 15,
    padding: 15,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  dataSection: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 5,
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  dataValue: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'monospace',
  },
  logContainer: {
    backgroundColor: 'white',
    margin: 15,
    padding: 15,
    borderRadius: 8,
    marginBottom: 30,
  },
  logSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  logEntry: {
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 8,
  },
  logIcon: {
    fontSize: 18,
  },
  logType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  logStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  logDetails: {
    fontSize: 13,
    color: '#666',
    marginLeft: 26,
    marginBottom: 3,
  },
  logTimestamp: {
    fontSize: 11,
    color: '#999',
    marginLeft: 26,
  },
});
