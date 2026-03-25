import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBLE } from '../functionality/BLEContext';
import { BLEDevice } from '../functionality/BLEService';

interface BluetoothScanModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BluetoothScanModal: React.FC<BluetoothScanModalProps> = ({ visible, onClose }) => {
  const {
    isScanning,
    isConnected,
    discoveredDevices,
    connectedDeviceName,
    statusMessage,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
    requestPermissions,
  } = useBLE();

  const [connecting, setConnecting] = useState<string | null>(null);

  // Auto-start scan when modal opens
  useEffect(() => {
    if (visible) {
      handleStartScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleStartScan = async () => {
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Bluetooth permissions are required to scan for devices. Please grant permissions in Settings.',
        [{ text: 'OK' }]
      );
      return;
    }
    await startScan();
  };

  const handleConnect = async (device: BLEDevice) => {
    try {
      setConnecting(device.id);
      await connectToDevice(device.id);
    } catch (err: any) {
      Alert.alert('Connection Failed', err.message || 'Could not connect to device.');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert('Disconnect', 'Disconnect from the current device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await disconnectDevice();
        },
      },
    ]);
  };

  const handleClose = () => {
    if (isScanning) stopScan();
    onClose();
  };

  const renderDevice = ({ item }: { item: BLEDevice }) => {
    const isThisDevice = isConnected && connectedDeviceName === item.name;
    const isConnecting = connecting === item.id;
    const name = item.name || 'Unknown Device';
    const rssi = item.rssi ?? 'N/A';
    const protocol = item.protocol?.name?.split(' ')[0] ?? '?';

    // Signal strength icon
    let signalIcon: 'cellular' | 'cellular-outline' | 'wifi-outline' = 'cellular-outline';
    if (item.rssi !== null && item.rssi !== undefined) {
      if (item.rssi > -60) signalIcon = 'cellular';
      else if (item.rssi > -80) signalIcon = 'cellular-outline';
    }

    return (
      <View style={[styles.deviceCard, isThisDevice && styles.deviceCardConnected]}>
        <View style={styles.deviceLeft}>
          <View style={[styles.deviceIconBg, isThisDevice && styles.deviceIconBgConnected]}>
            <Ionicons
              name={isThisDevice ? 'bluetooth' : 'bluetooth-outline'}
              size={24}
              color={isThisDevice ? '#ffffff' : '#5DADE2'}
            />
          </View>
          <View style={styles.deviceInfo}>
            <Text style={[styles.deviceName, isThisDevice && styles.deviceNameConnected]}>
              {name}
              {isThisDevice && ' ✓'}
            </Text>
            <Text style={styles.deviceMeta}>
              {item.id.toUpperCase().slice(0, 17)}
            </Text>
            <View style={styles.deviceBadges}>
              <View style={styles.badge}>
                <Ionicons name={signalIcon} size={12} color="#64748b" />
                <Text style={styles.badgeText}>{rssi} dBm</Text>
              </View>
              {item.protocol && (
                <View style={[styles.badge, styles.badgeProtocol]}>
                  <Text style={[styles.badgeText, { color: '#5DADE2' }]}>{protocol}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {isThisDevice ? (
          <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
            <Text style={styles.disconnectBtnText}>Disconnect</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.connectBtn, (isConnecting || isConnected) && styles.connectBtnDisabled]}
            onPress={() => handleConnect(item)}
            disabled={isConnecting || isConnected}>
            {isConnecting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.connectBtnText}>{isConnected ? 'Busy' : 'Connect'}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Ionicons name="chevron-down" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Connect Device</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Status Bar */}
        <View style={[styles.statusBar, isConnected && styles.statusBarConnected]}>
          <Ionicons
            name={isConnected ? 'checkmark-circle' : isScanning ? 'radio-outline' : 'bluetooth'}
            size={18}
            color={isConnected ? '#10b981' : '#5DADE2'}
          />
          <Text style={[styles.statusText, isConnected && styles.statusTextConnected]}>
            {isConnected ? `Connected: ${connectedDeviceName}` : statusMessage}
          </Text>
          {isScanning && <ActivityIndicator size="small" color="#5DADE2" style={{ marginLeft: 8 }} />}
        </View>

        {/* Connected Device Banner */}
        {isConnected && (
          <View style={styles.connectedBanner}>
            <Ionicons name="watch" size={40} color="#5DADE2" />
            <View style={styles.connectedBannerInfo}>
              <Text style={styles.connectedBannerTitle}>{connectedDeviceName}</Text>
              <Text style={styles.connectedBannerSub}>Receiving sensor data</Text>
            </View>
            <TouchableOpacity style={styles.connectedCloseBtn} onPress={handleClose}>
              <Text style={styles.connectedCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scan Controls */}
        <View style={styles.scanControls}>
          <Text style={styles.sectionLabel}>
            {discoveredDevices.length > 0
              ? `${discoveredDevices.length} device${discoveredDevices.length !== 1 ? 's' : ''} found`
              : isScanning
              ? 'Scanning for devices...'
              : 'No devices found'}
          </Text>
          <View style={styles.scanButtons}>
            {isScanning ? (
              <TouchableOpacity style={styles.stopBtn} onPress={stopScan}>
                <Ionicons name="stop-circle" size={18} color="#ef4444" />
                <Text style={styles.stopBtnText}>Stop</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.scanBtn} onPress={handleStartScan}>
                <Ionicons name="search" size={18} color="#ffffff" />
                <Text style={styles.scanBtnText}>Scan Again</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Device List */}
        {discoveredDevices.length === 0 ? (
          <View style={styles.emptyState}>
            {isScanning ? (
              <>
                <ActivityIndicator size="large" color="#5DADE2" />
                <Text style={styles.emptyTitle}>Searching for devices...</Text>
                <Text style={styles.emptySubtitle}>Make sure your wristband is powered on and nearby</Text>
              </>
            ) : (
              <>
                <Ionicons name="bluetooth-outline" size={64} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>No devices found</Text>
                <Text style={styles.emptySubtitle}>
                  Ensure your wristband is turned on, then tap Scan Again
                </Text>
              </>
            )}
          </View>
        ) : (
          <FlatList
            data={discoveredDevices}
            keyExtractor={(d) => d.id}
            renderItem={renderDevice}
            contentContainerStyle={styles.deviceList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Info Footer */}
        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={16} color="#94a3b8" />
          <Text style={styles.footerText}>
            {Platform.OS === 'android'
              ? 'Ensure Location permission is granted for BLE scanning'
              : 'Allow Bluetooth access in Settings if prompted'}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  statusBarConnected: {
    backgroundColor: '#f0fdf4',
  },
  statusText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
    flex: 1,
  },
  statusTextConnected: {
    color: '#10b981',
  },
  connectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#10b981',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  connectedBannerInfo: {
    flex: 1,
  },
  connectedBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  connectedBannerSub: {
    fontSize: 13,
    color: '#10b981',
    marginTop: 2,
  },
  connectedCloseBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectedCloseBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  scanControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  scanButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5DADE2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  scanBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  stopBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  deviceList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 10,
  },
  deviceCardConnected: {
    borderColor: '#10b981',
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
  },
  deviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  deviceIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceIconBgConnected: {
    backgroundColor: '#5DADE2',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  deviceNameConnected: {
    color: '#10b981',
  },
  deviceMeta: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  deviceBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  badgeProtocol: {
    backgroundColor: '#e0f2fe',
  },
  badgeText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  connectBtn: {
    backgroundColor: '#5DADE2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  connectBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  connectBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  disconnectBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  disconnectBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
  },
});
