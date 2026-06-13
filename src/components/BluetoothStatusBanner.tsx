import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { useBLE } from '../functionality/BLEContext';

interface BluetoothStatusBannerProps {
  onStatusChange?: (status: string) => void;
}

/**
 * BluetoothStatusBanner - Shows Bluetooth status and guides user to fix issues
 */
export const BluetoothStatusBanner: React.FC<BluetoothStatusBannerProps> = ({ onStatusChange }) => {
  const { bluetoothState, enableBluetooth } = useBLE();
  const [showBanner, setShowBanner] = useState<boolean>(true);

  useEffect(() => {
    onStatusChange?.(bluetoothState);
    if (bluetoothState === 'PoweredOn') {
      setShowBanner(false);
    } else {
      setShowBanner(true);
    }
  }, [bluetoothState, onStatusChange]);

  const openBluetoothSettings = () => {
    if (Platform.OS === 'android') {
      Alert.alert(
        'Enable Bluetooth',
        'Please enable Bluetooth in your device settings:\n\n1. Swipe down from top of screen\n2. Tap and hold Bluetooth icon\n3. Turn ON Bluetooth\n\nThen return to this app.',
        [
          {
            text: 'Open Settings',
            onPress: () => {
              Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS')
                .catch(() => {
                  // Fallback to general settings
                  Linking.openSettings();
                });
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      Alert.alert(
        'Enable Bluetooth',
        'Please enable Bluetooth in your device settings.',
        [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleAction = async () => {
    if (bluetoothState === 'PoweredOff' && Platform.OS === 'android') {
      const success = await enableBluetooth();
      if (success) {
        return;
      }
    }
    openBluetoothSettings();
  };

  const getBannerConfig = () => {
    switch (bluetoothState) {
      case 'PoweredOff':
        return {
          icon: '📴',
          title: 'Bluetooth is OFF',
          message: Platform.OS === 'android' ? 'Tap below to turn on Bluetooth directly' : 'Turn on Bluetooth in settings',
          color: '#ef4444',
          bgColor: '#fef2f2',
          showAction: true,
          actionText: Platform.OS === 'android' ? 'Turn On Bluetooth' : 'Open Settings',
        };
      case 'Unauthorized':
        return {
          icon: '🔒',
          title: 'Bluetooth Permission Denied',
          message: 'Grant Bluetooth permissions in app settings',
          color: '#f59e0b',
          bgColor: '#fffbeb',
          showAction: true,
          actionText: 'Open Settings',
        };
      case 'Unsupported':
        return {
          icon: '❌',
          title: 'Bluetooth Not Supported',
          message: 'This device does not support Bluetooth',
          color: '#dc2626',
          bgColor: '#fef2f2',
          showAction: false,
          actionText: '',
        };
      case 'PoweredOn':
        return {
          icon: '✅',
          title: 'Bluetooth Ready',
          message: 'Tap "Scan Devices" to find BLE devices',
          color: '#22c55e',
          bgColor: '#f0fdf4',
          showAction: false,
          actionText: '',
        };
      default:
        return {
          icon: '⏳',
          title: 'Checking Bluetooth...',
          message: 'Please wait while we check Bluetooth status',
          color: '#6b7280',
          bgColor: '#f9fafb',
          showAction: false,
          actionText: '',
        };
    }
  };

  if (!showBanner && bluetoothState === 'PoweredOn') {
    return null;
  }

  const config = getBannerConfig();

  return (
    <View style={[styles.banner, { backgroundColor: config.bgColor, borderColor: config.color }]}>
      <View style={styles.bannerContent}>
        <Text style={styles.bannerIcon}>{config.icon}</Text>
        <View style={styles.bannerText}>
          <Text style={[styles.bannerTitle, { color: config.color }]}>
            {config.title}
          </Text>
          <Text style={styles.bannerMessage}>{config.message}</Text>
        </View>
      </View>

      {config.showAction && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: config.color }]}
          onPress={handleAction}
        >
          <Text style={styles.actionButtonText}>{config.actionText}</Text>
        </TouchableOpacity>
      )}

      {bluetoothState === 'PoweredOn' && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => setShowBanner(false)}
        >
          <Text style={styles.dismissButtonText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    margin: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bannerIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerMessage: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  dismissButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    fontSize: 18,
    color: '#9ca3af',
  },
});
