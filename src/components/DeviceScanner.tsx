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
    discoveredDevices,
    connectedDeviceName,
    isConnected,
    availableProtocols,
    selectedProtocols,
    currentProtocol,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
    toggleProtocol,
  } = useBLE();

  const renderDevice = ({ item }: { item: BLEDevice }) => {
    const deviceName = item.name || 'Unknown Device';
    const isPreferred = item.protocol !== undefined;
    const isThisConnected = isConnected && connectedDeviceName === item.name;
    const protocolBadge = item.protocol?.name.split(' ')[0] || '?';
    const protocolVariant = item.protocol?.type === 'NORDIC_UART' ? 'info' as const : 'success' as const;

    return (
      <TouchableOpacity
        onPress={() => !isConnected && connectToDevice(item.id)}
        disabled={isConnected}
        style={{ marginBottom: theme.spacing.sm }}
      >
        <Card
          variant={isThisConnected ? 'elevated' : isPreferred ? 'outlined' : 'default'}
          style={[
            isThisConnected && { borderColor: theme.colors.success, borderWidth: 2, backgroundColor: '#f0fdf4' },
            isPreferred && !isThisConnected && { borderColor: theme.colors.primary }
          ]}
        >
          <View style={styles.deviceInfo}>
            <View style={styles.deviceNameRow}>
              <Text style={[styles.deviceName, isThisConnected && { color: theme.colors.success }]}>
                {deviceName}
                {isThisConnected && ' (Connected)'}
              </Text>
              {item.protocol && (
                <Badge variant={protocolVariant}>{protocolBadge}</Badge>
              )}
            </View>
            <Text style={styles.deviceDetails}>
              {item.id} | RSSI: {item.rssi || 'N/A'}
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Bluetooth Status Banner */}
      <BluetoothStatusBanner />
      
      <View style={styles.header}>
        <Text style={styles.title}>📡 BLE Devices</Text>
        {isConnected && (
          <Text style={styles.connectedInfo}>
            Connected: {connectedDeviceName} ({currentProtocol.name})
          </Text>
        )}
        
        {/* Protocol Filter */}
        {!isConnected && (
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
        )}
        
        <View style={styles.buttonRow}>
          {!isConnected ? (
            <>
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
            </>
          ) : (
            <Button
              variant="danger"
              size="md"
              onPress={disconnectDevice}
              style={{ flex: 1 }}
            >
              Disconnect
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
          renderItem={renderDevice}
          style={styles.list}
          contentContainerStyle={styles.listContent}
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
});
