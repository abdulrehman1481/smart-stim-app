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

export const DeviceScanner: React.FC = () => {
  const {
    isScanning,
    discoveredDevices,
    connectedDeviceName,
    isConnected,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
  } = useBLE();

  const renderDevice = ({ item }: { item: BLEDevice }) => {
    const deviceName = item.name || 'Unknown Device';
    const isPreferred = item.name === 'DeepSleepDongle';
    const isThisConnected = isConnected && connectedDeviceName === item.name;

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
          <Text style={[styles.deviceName, isThisConnected && styles.connectedText]}>
            {deviceName}
            {isThisConnected && ' (Connected)'}
            {isPreferred && ' ⭐'}
          </Text>
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
              ? 'Scanning for devices with Nordic UART Service...\n\nMake sure your device is:\n• Powered on\n• Broadcasting BLE advertisements\n• Within range' 
              : 'No devices found. Tap "Scan" to search for BLE devices.\n\nNote: Only devices with Nordic UART Service (NUS) will appear.'}
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
    marginBottom: 12,
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
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
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
