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

    return (
      <TouchableOpacity
        style={[
          styles.deviceItem,
          isPreferred && styles.preferredDevice,
          isThisConnected && styles.connectedDevice,
        ]}
        onPress={() => !isConnected && connectToDevice(item.id)}
        disabled={isConnected}
      >
        <View style={styles.deviceInfo}>
          <View style={styles.deviceNameRow}>
            <Text style={[styles.deviceName, isThisConnected && styles.connectedText]}>
              {deviceName}
              {isThisConnected && ' (Connected)'}
            </Text>
            {item.protocol && (
              <View style={[
                styles.protocolBadge,
                item.protocol.type === 'NORDIC_UART' && styles.nordicBadge,
                item.protocol.type === 'ESP32_CUSTOM' && styles.esp32Badge,
              ]}>
                <Text style={styles.protocolBadgeText}>{protocolBadge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.deviceDetails}>
            {item.id} | RSSI: {item.rssi || 'N/A'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
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
              <TouchableOpacity
                style={[styles.button, styles.scanButton, isScanning && styles.buttonDisabled]}
                onPress={startScan}
                disabled={isScanning}
              >
                {isScanning ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Scan</Text>
                )}
              </TouchableOpacity>
              {isScanning && (
                <TouchableOpacity
                  style={[styles.button, styles.stopButton]}
                  onPress={stopScan}
                >
                  <Text style={styles.buttonText}>Stop</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.disconnectButton]}
              onPress={disconnectDevice}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1e3a8a',
    padding: 16,
    paddingTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  connectedInfo: {
    fontSize: 12,
    color: '#93c5fd',
    marginBottom: 8,
  },
  protocolFilter: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    color: '#93c5fd',
    marginBottom: 6,
    fontWeight: '600',
  },
  protocolChips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  protocolChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
  },
  protocolChipSelected: {
    borderWidth: 2,
  },
  nordicChip: {
    backgroundColor: '#1e40af',
    borderColor: '#3b82f6',
  },
  esp32Chip: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  protocolChipText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  protocolChipTextSelected: {
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButton: {
    backgroundColor: '#3b82f6',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  disconnectButton: {
    backgroundColor: '#ef4444',
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 12,
  },
  deviceItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  preferredDevice: {
    borderColor: '#3b82f6',
    borderWidth: 2,
    backgroundColor: '#eff6ff',
  },
  connectedDevice: {
    borderColor: '#10b981',
    borderWidth: 2,
    backgroundColor: '#d1fae5',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  protocolBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginLeft: 8,
  },
  nordicBadge: {
    backgroundColor: '#dbeafe',
  },
  esp32Badge: {
    backgroundColor: '#d1fae5',
  },
  protocolBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1f2937',
  },
  connectedText: {
    color: '#059669',
  },
  deviceDetails: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});
