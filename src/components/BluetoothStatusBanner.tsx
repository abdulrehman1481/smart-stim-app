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
import { bleService } from '../functionality/BLEService';

interface BluetoothStatusBannerProps {
  onStatusChange?: (status: string) => void;
}

/**
 * BluetoothStatusBanner - Shows Bluetooth status and guides user to fix issues
 */
export const BluetoothStatusBanner: React.FC<BluetoothStatusBannerProps> = ({ onStatusChange }) => {
  const [btState, setBtState] = useState<string>('Unknown');
  const [showBanner, setShowBanner] = useState<boolean>(true);

  useEffect(() => {
    checkBluetoothStatus();

    // Check status every 2 seconds
    const interval = setInterval(checkBluetoothStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  const checkBluetoothStatus = async () => {
    try {
      const state = await bleService.getBluetoothState();
      setBtState(state);
      onStatusChange?.(state);

      // Auto-hide banner if Bluetooth is on
      if (state === 'PoweredOn') {
        setShowBanner(false);
      } else {
        setShowBanner(true);
      }
    } catch (error) {
      console.error('[BTStatusBanner] Error checking state:', error);
    }
  };

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

  const getBannerConfig = () => {
    switch (btState) {
      case 'PoweredOff':
        return {
          icon: '📴',
          title: 'Bluetooth is OFF',
          message: 'Turn on Bluetooth to scan for devices',
          color: '#ef4444',
          bgColor: '#fef2f2',
          showAction: true,
        };
      case 'Unauthorized':
        return {
          icon: '🔒',
          title: 'Bluetooth Permission Denied',
          message: 'Grant Bluetooth permissions in app settings',
          color: '#f59e0b',
          bgColor: '#fffbeb',
          showAction: true,
        };
      case 'Unsupported':
        return {
          icon: '❌',
          title: 'Bluetooth Not Supported',
          message: 'This device does not support Bluetooth',
          color: '#dc2626',
          bgColor: '#fef2f2',
          showAction: false,
        };
      case 'PoweredOn':
        return {
          icon: '✅',
          title: 'Bluetooth Ready',
          message: 'Tap "Scan Devices" to find BLE devices',
          color: '#22c55e',
          bgColor: '#f0fdf4',
          showAction: false,
        };
      default:
        return {
          icon: '⏳',
          title: 'Checking Bluetooth...',
          message: 'Please wait while we check Bluetooth status',
          color: '#6b7280',
          bgColor: '#f9fafb',
          showAction: false,
        };
    }
  };

  if (!showBanner && btState === 'PoweredOn') {
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
          onPress={openBluetoothSettings}
        >
          <Text style={styles.actionButtonText}>Open Settings</Text>
        </TouchableOpacity>
      )}

      {btState === 'PoweredOn' && (
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
