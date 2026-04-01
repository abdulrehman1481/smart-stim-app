import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { unstable_batchedUpdates } from 'react-native';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Device } from 'react-native-ble-plx';
import { bleService, BLEDevice } from '../functionality/BLEService';
import { 
  BLEProtocol, 
  BLEProtocolType, 
  SUPPORTED_PROTOCOLS,
  NORDIC_UART_PROTOCOL,
  ESP32_PROTOCOL 
} from './BLEProtocols';

// Always use real BLE service
console.log('[BLE] Using REAL BLE Service');

const LAST_DEVICE_KEY = 'ble_last_connected_device';

interface BLEContextType {
  // State
  isScanning: boolean;
  isConnected: boolean;
  discoveredDevices: BLEDevice[];
  connectedDevice: Device | null;
  connectedDeviceName: string | null;
  receivedMessages: string[];
  statusMessage: string;
  currentProtocol: BLEProtocol;
  availableProtocols: BLEProtocol[];
  selectedProtocols: BLEProtocol[];
  
  // Actions
  startScan: () => Promise<void>;
  stopScan: () => void;
  connectToDevice: (deviceId: string) => Promise<void>;
  disconnectDevice: () => Promise<void>;
  sendCommand: (command: string) => Promise<void>;
  clearMessages: () => void;
  requestPermissions: () => Promise<boolean>;
  setProtocolFilter: (protocols: BLEProtocol[]) => void;
  toggleProtocol: (protocol: BLEProtocol) => void;
}

const BLEContext = createContext<BLEContextType | undefined>(undefined);

export const useBLE = () => {
  const context = useContext(BLEContext);
  if (!context) {
    throw new Error('useBLE must be used within BLEProvider');
  }
  return context;
};

interface BLEProviderProps {
  children: ReactNode;
}

export const BLEProvider: React.FC<BLEProviderProps> = ({ children }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<BLEDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [currentProtocol, setCurrentProtocol] = useState<BLEProtocol>(NORDIC_UART_PROTOCOL);
  const [selectedProtocols, setSelectedProtocols] = useState<BLEProtocol[]>(SUPPORTED_PROTOCOLS);
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  const isMountedRef = React.useRef(true);
  const disconnectInFlightRef = React.useRef(false);

  // Auto-connect on startup
  useEffect(() => {
    // Initialize BLE service
    const initBLE = async () => {
      setStatusMessage('Initializing Bluetooth...');
      const initialized = await bleService.initialize();
      if (initialized) {
        // Check current Bluetooth state
        const state = await bleService.getBluetoothState();
        if (state === 'PoweredOn') {
          setStatusMessage('✓ Bluetooth ready');
          // Auto-connect removed - user must manually scan
        } else if (state === 'PoweredOff') {
          setStatusMessage('⚠️ Bluetooth is OFF. Please enable Bluetooth.');
        } else {
          setStatusMessage(`⚠️ Bluetooth state: ${state}`);
        }
      } else {
        setStatusMessage('❌ Bluetooth not available');
      }
    };

    initBLE();

    // Setup callbacks
    bleService.setDataCallback((data: string) => {
      if (!isMountedRef.current) return;
      const timestamp = new Date().toLocaleTimeString();
      const message = `[${timestamp}] RX: ${data}`;
      // Keep last 2000 messages for the log monitor UI.
      // NOTE: we intentionally trim from the BACK (keep newest) so that
      // useSensorPipeline's absolute-index pointer is never invalidated.
      // The pipeline processes new messages by comparing length, so any
      // front-trim would cause it to miss all subsequent messages.
      setReceivedMessages((prev) =>
        prev.length >= 2000 ? [...prev.slice(-1999), message] : [...prev, message]
      );
    });

    bleService.setConnectionCallback((connected: boolean, device) => {
      if (!isMountedRef.current) return;
      // Wrap ALL setState calls in unstable_batchedUpdates so that native BLE
      // callbacks (which run outside React's event loop) produce ONE render
      // instead of 4-5 separate renders — preventing the disconnect crash and
      // reducing overall re-render pressure.
      unstable_batchedUpdates(() => {
        setIsConnected(connected);
        if (connected && device) {
          setConnectedDevice(bleService.getConnectedDevice());
          setConnectedDeviceName(device.name || 'Unknown Device');
          const protocol = bleService.getCurrentProtocol();
          setCurrentProtocol(protocol);
          setStatusMessage(`Connected to ${device.name || device.id} (${protocol.name})`);
          // Save last connected device (async, no setState)
          saveLastDevice(device.id, device.name || 'Unknown Device');
        } else {
          setConnectedDevice(null);
          setConnectedDeviceName(null);
          setStatusMessage('Disconnected');
        }
      });
    });

    bleService.setErrorCallback((error: string) => {
      if (!isMountedRef.current) return;
      setStatusMessage(`Error: ${error}`);
      const timestamp = new Date().toLocaleTimeString();
      setReceivedMessages((prev) => [...prev, `[${timestamp}] ERROR: ${error}`]);
    });

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      bleService.setDataCallback(() => {});
      bleService.setConnectionCallback(() => {});
      bleService.setErrorCallback(() => {});
      bleService.destroy();
    };
  }, []);

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 31) {
          // Android 12+ requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]);

          return (
            granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          // Android 11 and below
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch (error) {
        console.error('Permission request error:', error);
        return false;
      }
    }
    return true; // iOS handles permissions automatically
  };

  const saveLastDevice = async (deviceId: string, deviceName: string) => {
    try {
      await AsyncStorage.setItem(LAST_DEVICE_KEY, JSON.stringify({ deviceId, deviceName }));
      console.log('[BLEContext] Saved last device:', deviceName);
    } catch (error) {
      console.error('Failed to save last device:', error);
    }
  };

  const getLastDevice = async (): Promise<{ deviceId: string; deviceName: string } | null> => {
    try {
      const saved = await AsyncStorage.getItem(LAST_DEVICE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load last device:', error);
    }
    return null;
  };

  const attemptAutoConnect = async () => {
    if (autoConnectAttempted) return;
    setAutoConnectAttempted(true);

    const lastDevice = await getLastDevice();
    if (!lastDevice) {
      console.log('[BLEContext] No last device found for auto-connect');
      return;
    }

    console.log('[BLEContext] Attempting auto-connect to:', lastDevice.deviceName);
    setStatusMessage(`Auto-connecting to ${lastDevice.deviceName}...`);

    // Start a quick scan to find the device
    setIsScanning(true);
    let foundDevice: BLEDevice | null = null;

    await bleService.startScan(
      (device: BLEDevice) => {
        if (device.id === lastDevice.deviceId) {
          foundDevice = device;
          console.log('[BLEContext] Found last device:', device.name);
          bleService.stopScan();
        }
      },
      5 // Quick 5-second scan
    );

    setTimeout(async () => {
      setIsScanning(false);
      if (foundDevice) {
        console.log('[BLEContext] Connecting to last device...');
        await connectToDevice(foundDevice.id);
      } else {
        console.log('[BLEContext] Last device not found during auto-connect scan');
        setStatusMessage('Last device not found. Please scan manually.');
      }
    }, 5500);
  };

  const startScan = async () => {
    // First check if Bluetooth is enabled
    const state = await bleService.getBluetoothState();
    console.log('[BLEContext] Bluetooth state:', state);
    
    if (state !== 'PoweredOn') {
      let message = 'Bluetooth is not available';
      if (state === 'PoweredOff') {
        message = '⚠️ Bluetooth is OFF. Please turn on Bluetooth in your device settings.';
      } else if (state === 'Unauthorized') {
        message = '⚠️ Bluetooth permission denied. Please enable Bluetooth permissions.';
      }
      setStatusMessage(message);
      return;
    }

    const hasPermissions = await requestPermissions();
    if (!hasPermissions) {
      setStatusMessage('⚠️ Bluetooth permissions denied. Please grant permissions in settings.');
      return;
    }

    console.log('[BLEContext] Starting BLE scan...');
    setIsScanning(true);
    setDiscoveredDevices([]);
    setStatusMessage('Scanning for devices...');

    await bleService.startScan(
      (device: BLEDevice) => {
        console.log('[BLEContext] Device found:', device.name || device.id);
        setDiscoveredDevices((prev) => {
          // Avoid duplicates
          if (prev.some((d) => d.id === device.id)) {
            return prev;
          }
          // Sort: preferred device first, then by name
          const newDevices = [...prev, device];
          return newDevices.sort((a, b) => {
            if (a.name === 'DeepSleepDongle') return -1;
            if (b.name === 'DeepSleepDongle') return 1;
            return (a.name || '').localeCompare(b.name || '');
          });
        });
      },
      10 // scan for 10 seconds
    );

    // Update scanning status after scan completes
    setTimeout(() => {
      setIsScanning(false);
      setStatusMessage((prevMsg) => {
        // Only update if we're still showing scanning message
        if (prevMsg.includes('Scanning')) {
          return `Scan complete`;
        }
        return prevMsg;
      });
    }, 10500); // Slightly longer than scan duration to ensure callback finishes
  };

  const stopScan = () => {
    console.log('[BLEContext] Stopping scan');
    bleService.stopScan();
    setIsScanning(false);
    setStatusMessage('Scan stopped');
  };

  const connectToDevice = async (deviceId: string) => {
    console.log('[BLEContext] Attempting to connect to device:', deviceId);
    setStatusMessage('Connecting...');
    const success = await bleService.connect(deviceId);
    if (!success) {
      setStatusMessage('Connection failed');
    }
  };

  const disconnectDevice = async () => {
    if (disconnectInFlightRef.current) {
      console.log('[BLEContext] Disconnect already in progress, ignoring duplicate request');
      return;
    }

    disconnectInFlightRef.current = true;
    console.log('[BLEContext] 🔌 Starting BLE disconnect sequence...');
    
    try {
      // Attempt graceful disconnect with timeout protection
      console.log('[BLEContext] Calling bleService.disconnect()...');
      try {
        // Wrap disconnect in timeout to prevent hanging
        await Promise.race([
          bleService.disconnect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('BLE disconnect timeout')), 15000)
          )
        ]);
        console.log('[BLEContext] ✅ BLE disconnect completed successfully');
      } catch (bleErr: any) {
        console.warn('[BLEContext] ⚠️  BLE disconnect error (will force state reset):', bleErr?.message || bleErr);
        // Even if BLE disconnect fails, continue to next step
      }

      // State is updated via the connectionCallback registered above.
      // DO NOT call setIsConnected/setConnectedDevice here — doing so fires
      // a second React state update and can cause a render-loop crash on Android.
    } catch (err: any) {
      console.error('[BLEContext] ❌ Unexpected error during disconnect:', err?.message || err);
    } finally {
      // CRITICAL: Always ensure state is cleared to avoid app hanging
      try {
        console.log('[BLEContext] Forcing React state reset...');
        setIsConnected(false);
        setConnectedDevice(null);
        setConnectedDeviceName(null);
        setStatusMessage('Disconnected');
        console.log('[BLEContext] ✅ React state cleared');
      } catch (stateErr: any) {
        console.error('[BLEContext] ❌ Failed to clear state:', stateErr?.message || stateErr);
      }

      // Allow new disconnect requests
      disconnectInFlightRef.current = false;
      console.log('[BLEContext] ✅ Disconnect sequence complete');
    }
  };

  const sendCommand = async (command: string) => {
    if (!isConnected) {
      setStatusMessage('Not connected to any device');
      return;
    }

    // ESP/NUS firmwares in this project parse line-based commands terminated by '\n'.
    const dataToSend = command.endsWith('\n') ? command : `${command}\n`;
    
    console.log('[BLEContext] Sending command:', JSON.stringify(dataToSend));
    const success = await bleService.sendData(dataToSend, true); // true = with response (Python default)
    
    if (success) {
      const timestamp = new Date().toLocaleTimeString();
      const message = `[${timestamp}] TX: ${command}`;
      setReceivedMessages((prev) => [...prev, message]);
    } else {
      setStatusMessage('Failed to send command');
    }
  };

  const clearMessages = () => {
    setReceivedMessages([]);
  };

  const setProtocolFilter = (protocols: BLEProtocol[]) => {
    setSelectedProtocols(protocols);
    bleService.setProtocolFilter(protocols);
    console.log('[BLEContext] Protocol filter updated:', protocols.map(p => p.name).join(', '));
  };

  const toggleProtocol = (protocol: BLEProtocol) => {
    setSelectedProtocols(prev => {
      const isSelected = prev.some(p => p.type === protocol.type);
      let newSelection: BLEProtocol[];
      
      if (isSelected) {
        // Remove protocol (but ensure at least one remains)
        newSelection = prev.filter(p => p.type !== protocol.type);
        if (newSelection.length === 0) {
          console.warn('[BLEContext] Cannot remove last protocol');
          return prev;
        }
      } else {
        // Add protocol
        newSelection = [...prev, protocol];
      }
      
      bleService.setProtocolFilter(newSelection);
      console.log('[BLEContext] Protocols toggled. Active:', newSelection.map(p => p.name).join(', '));
      return newSelection;
    });
  };

  const value: BLEContextType = {
    isScanning,
    isConnected,
    discoveredDevices,
    connectedDevice,
    connectedDeviceName,
    receivedMessages,
    statusMessage,
    currentProtocol,
    availableProtocols: SUPPORTED_PROTOCOLS,
    selectedProtocols,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
    sendCommand,
    clearMessages,
    requestPermissions,
    setProtocolFilter,
    toggleProtocol,
  };

  return <BLEContext.Provider value={value}>{children}</BLEContext.Provider>;
};
