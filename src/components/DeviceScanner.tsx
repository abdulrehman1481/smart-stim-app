import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useBLE } from '../functionality/BLEContext';
import { BLEDevice } from '../functionality/BLEService';
import { BLEProtocol } from '../functionality/BLEProtocols';
import { BluetoothStatusBanner } from './BluetoothStatusBanner';
import { theme } from '../styles/theme';
import { Button, Badge, Card } from './shared/StyledComponents';

export const DeviceScanner: React.FC = () => {
  const {
    isScanning,
    isConnecting,
    discoveredDevices,
    connectedDevice,
    connectedDeviceName,
    isConnected,
    isEarbudConnected,
    isEarbudConnecting,
    availableProtocols,
    selectedProtocols,
    currentProtocol,
    startScan,
    stopScan,
    connectToDeviceRouter,
    disconnectDevice,
    disconnectEarbud,
    disconnectAll,
    toggleProtocol,
  } = useBLE();

  const renderDevice = (device: BLEDevice) => {
    // 1. BULLETPROOF DETECTION: Check name, protocol, AND the exact MAC address
    const name = (device.name || '').toUpperCase();
    const protocol = (device.protocol?.name || '').toUpperCase();
    
    const isEarbud = 
      name.includes('ESP') || 
      name.includes('SIGNAL') || 
      protocol.includes('ESP') || 
      device.id === '3C:0F:02:D7:2E:05'; // Hardcoded fallback from logs

    // 2. Isolate states
    const isThisDeviceConnecting = isEarbud ? isEarbudConnecting : isConnecting; 
    const isThisDeviceConnected = isEarbud ? isEarbudConnected : (connectedDevice?.id === device.id);

    return (
      <View key={device.id} style={styles.deviceCard}>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{device.name || 'Unknown Device'}</Text>
          <Text style={styles.deviceType}>{isEarbud ? '🎧 ESP Earbud' : '⌚ Smartwatch'}</Text>
          <View style={styles.statusRow}>
            <View style={[
              styles.statusDot,
              { backgroundColor: isThisDeviceConnected ? '#22c55e' : '#6b7280' }
            ]} />
            <Text style={[
              styles.statusText,
              { color: isThisDeviceConnected ? '#22c55e' : '#6b7280' }
            ]}>
              {isThisDeviceConnecting ? 'Connecting...' : isThisDeviceConnected ? 'Connected' : 'Not Connected'}
            </Text>
          </View>
        </View>

        <View style={styles.buttonCol}>
          {isThisDeviceConnecting ? (
            <ActivityIndicator color="#6366f1" size="small" />
          ) : isThisDeviceConnected ? (
            <TouchableOpacity
              style={styles.disconnectBtn}
              onPress={() => {
                console.log(`[UI] Disconnect tapped: ${device.id} isEarbud=${isEarbud}`);
                if (isEarbud) {
                  disconnectEarbud();
                } else {
                  disconnectDevice();
                }
              }}
            >
              <Text style={styles.disconnectBtnText}>Disconnect</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.connectBtn}
              onPress={() => {
                console.log(`[UI] Connect tapped: ${device.id} isEarbud=${isEarbud}`);
                connectToDeviceRouter(device.id);
              }}
            >
              <Text style={styles.connectBtnText}>Connect</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Bluetooth Status Banner */}
      <BluetoothStatusBanner />
      
      <View style={styles.header}>
        <Text style={styles.title}>📡 BLE Devices</Text>
        {(isConnected || isEarbudConnected) && (
          <View>
            {isConnected && (
              <Text style={styles.connectedInfo}>
                📡 Smartwatch: {connectedDeviceName} ({currentProtocol.name})
              </Text>
            )}
            {isEarbudConnected && (
              <Text style={styles.connectedInfo}>
                👂 Earbud: Connected (ESP_SIGNAL_CTRL)
              </Text>
            )}
          </View>
        )}
        
        {/* Protocol Filter */}
        <View style={styles.protocolFilter}>
          <Text style={styles.filterLabel}>Scan for:</Text>
          <View style={styles.protocolChips}>
            {availableProtocols.map((protocol) => {
              const isSelected = selectedProtocols.some(p => p.type === protocol.type);
              return (
                <TouchableOpacity
                  key={protocol.type}
                  style={[
                    styles.protocolChip,
                    isSelected && styles.protocolChipSelected,
                    protocol.type === 'NORDIC_UART' && isSelected && styles.nordicChip,
                    protocol.type === 'ESP32_CUSTOM' && isSelected && styles.esp32Chip,
                    protocol.type === 'ESP_SIGNAL_CTRL' && isSelected && styles.esp32Chip,
                  ]}
                  onPress={() => toggleProtocol(protocol)}
                  disabled={isScanning}
                >
                  <Text style={[
                    styles.protocolChipText,
                    isSelected && styles.protocolChipTextSelected,
                  ]}>
                    {protocol.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        
        <View style={styles.buttonRow}>
          <Button
            variant="primary"
            size="md"
            onPress={startScan}
            disabled={isScanning}
            style={{ flex: 1 }}
          >
            {isScanning ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              'Scan'
            )}
          </Button>
          {isScanning && (
            <Button
              variant="danger"
              size="md"
              onPress={stopScan}
              style={{ flex: 1 }}
            >
              Stop
            </Button>
          )}
        </View>
      </View>

      {discoveredDevices.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {isScanning 
              ? `Scanning for ${selectedProtocols.map(p => p.name).join(' and ')}...\n\nMake sure your device is:\n• Powered on\n• Broadcasting BLE advertisements\n• Within range` 
              : `No devices found. Tap "Scan" to search.\n\nSelect protocol(s) above to filter devices.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={discoveredDevices}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderDevice(item)}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            isConnected && isEarbudConnected ? (
              <TouchableOpacity
                style={styles.disconnectAllBtn}
                onPress={() => {
                  console.log('[UI] Disconnect All tapped');
                  disconnectAll();
                }}
              >
                <Text style={styles.disconnectAllBtnText}>⚠️ Disconnect All Devices</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  title: {
    ...theme.typography.h3,
    color: '#fff',
    marginBottom: theme.spacing.xs,
  },
  connectedInfo: {
    ...theme.typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: theme.spacing.sm,
  },
  protocolFilter: {
    marginBottom: theme.spacing.md,
  },
  filterLabel: {
    ...theme.typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: theme.spacing.xs,
    fontWeight: '600',
  },
  protocolChips: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  protocolChip: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  protocolChipSelected: {
    borderWidth: 2,
  },
  nordicChip: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderColor: theme.colors.info,
  },
  esp32Chip: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderColor: theme.colors.success,
  },
  protocolChipText: {
    ...theme.typography.caption,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
  },
  protocolChipTextSelected: {
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  deviceName: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  deviceDetails: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  connectingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  connectingText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: '#fff',
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
    elevation: 1,
  },
  deviceInfoWrapper: {
    flex: 1,
  },
  deviceType: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
    marginTop: theme.spacing.xs,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  connectButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  disconnectButton: {
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  deviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: '#fff',
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...theme.typography.caption,
    fontWeight: '600',
  },
  buttonCol: {
    marginLeft: theme.spacing.md,
  },
  disconnectBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  disconnectBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  connectBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  connectBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  disconnectAllBtn: {
    backgroundColor: '#7f1d1d',
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  disconnectAllBtnText: {
    color: '#fca5a5',
    fontWeight: '700',
    fontSize: 14,
  },
});
