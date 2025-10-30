import { BleManager, Device, Characteristic, State } from 'react-native-ble-plx';
import { Platform } from 'react-native';
import * as ExpoDevice from 'expo-device';
import base64 from 'react-native-base64';

// Nordic UART Service UUIDs (same as your Python GUI)
export const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NUS_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write to device
export const NUS_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Receive from device (notify)

export const PREFERRED_DEVICE_NAME = 'DeepSleepDongle';

export interface BLEDevice {
  id: string;
  name: string | null;
  rssi: number | null;
}

export type BLEConnectionCallback = (isConnected: boolean, device?: Device) => void;
export type BLEDataCallback = (data: string) => void;
export type BLEErrorCallback = (error: string) => void;

class BLEService {
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  private isScanning: boolean = false;
  private dataCallback: BLEDataCallback | null = null;
  private errorCallback: BLEErrorCallback | null = null;
  private connectionCallback: BLEConnectionCallback | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  // Initialize BLE Manager
  async initialize(): Promise<boolean> {
    try {
      const state = await this.manager.state();
      if (state === State.PoweredOn) {
        return true;
      }
      
      return new Promise((resolve) => {
        const subscription = this.manager.onStateChange((newState) => {
          if (newState === State.PoweredOn) {
            subscription.remove();
            resolve(true);
          }
        }, true);
      });
    } catch (error) {
      this.handleError(`BLE initialization failed: ${error}`);
      return false;
    }
  }

  // Check if device has proper BLE permissions
  async checkPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      // For Android 12+ (SDK 31+), we need BLUETOOTH_SCAN and BLUETOOTH_CONNECT
      // These should be requested in your app before calling BLE functions
      return true; // Permissions should be handled by expo-dev-client or in app.json
    }
    return true; // iOS permissions are handled automatically
  }

  // Check Bluetooth state
  async getBluetoothState(): Promise<State> {
    return await this.manager.state();
  }

  // Scan for BLE devices
  async startScan(
    onDeviceFound: (device: BLEDevice) => void,
    durationSeconds: number = 10
  ): Promise<void> {
    if (this.isScanning) {
      console.log('[BLE] Already scanning, ignoring request');
      return;
    }

    try {
      // Check Bluetooth state before scanning
      const state = await this.manager.state();
      console.log('[BLE] Current Bluetooth state:', state);
      
      if (state !== State.PoweredOn) {
        let stateMessage = 'Bluetooth is not available';
        
        switch (state) {
          case State.PoweredOff:
            stateMessage = 'Bluetooth is turned off. Please enable Bluetooth in your device settings.';
            break;
          case State.Unauthorized:
            stateMessage = 'Bluetooth permission not granted. Please enable Bluetooth permissions.';
            break;
          case State.Unsupported:
            stateMessage = 'Bluetooth is not supported on this device.';
            break;
          case State.Resetting:
            stateMessage = 'Bluetooth is resetting. Please wait a moment.';
            break;
          case State.Unknown:
            stateMessage = 'Bluetooth state is unknown. Please check your device settings.';
            break;
        }
        
        this.handleError(stateMessage);
        return;
      }

      console.log('[BLE] Starting device scan for', durationSeconds, 'seconds');
      console.log('[BLE] Looking for devices with Nordic UART Service (NUS)...');
      this.isScanning = true;
      const discoveredDevices = new Map<string, BLEDevice>();

      this.manager.startDeviceScan(
        [NUS_SERVICE_UUID], // Scan specifically for Nordic UART Service - filters out most random devices
        { 
          allowDuplicates: false, // Don't report same device multiple times
          scanMode: Platform.OS === 'android' ? 2 : undefined, // Use balanced scan mode on Android
        },
        (error, device) => {
          if (error) {
            console.error('[BLE] Scan error:', error.message);
            this.handleError(`Scan error: ${error.message}`);
            this.stopScan();
            return;
          }

          if (device) {
            // Get device name, preferring 'name' over 'localName'
            const deviceName = device.name || device.localName || 'Unknown Device';
            
            // Only process devices with reasonable RSSI (signal strength)
            // RSSI < -100 means very weak signal, likely not useful
            if (device.rssi && device.rssi < -100) {
              console.log('[BLE] Ignoring device with weak signal:', {
                id: device.id,
                name: deviceName,
                rssi: device.rssi,
              });
              return;
            }

            // Log discovered device with NUS
            console.log('[BLE] ✓ Found NUS device:', {
              id: device.id,
              name: deviceName,
              rssi: device.rssi,
              isPreferred: deviceName === PREFERRED_DEVICE_NAME,
            });

            // Add to discovered devices map (prevents duplicates)
            if (!discoveredDevices.has(device.id)) {
              const bleDevice: BLEDevice = {
                id: device.id,
                name: deviceName,
                rssi: device.rssi,
              };
              discoveredDevices.set(device.id, bleDevice);
              onDeviceFound(bleDevice);
              
              // Highlight if this is our preferred device
              if (deviceName === PREFERRED_DEVICE_NAME) {
                console.log(`[BLE] 🎯 Found preferred device: ${PREFERRED_DEVICE_NAME}`);
              }
            }
          }
        }
      );

      // Auto-stop scan after duration
      setTimeout(() => {
        const deviceCount = discoveredDevices.size;
        console.log(`[BLE] Scan completed. Found ${deviceCount} device(s) with Nordic UART Service.`);
        this.stopScan();
      }, durationSeconds * 1000);
    } catch (error) {
      console.error('[BLE] Failed to start scan:', error);
      this.handleError(`Failed to start scan: ${error}`);
      this.isScanning = false;
    }
  }

  // Stop scanning
  stopScan(): void {
    if (this.isScanning) {
      console.log('[BLE] Stopping device scan');
      this.manager.stopDeviceScan();
      this.isScanning = false;
    }
  }

  // Connect to a device
  async connect(deviceId: string): Promise<boolean> {
    try {
      console.log('[BLE] Attempting to connect to device:', deviceId);
      
      // Disconnect from any existing device
      await this.disconnect();

      console.log('[BLE] Connecting to device...');
      // Connect to device with timeout
      const device = await this.manager.connectToDevice(deviceId, {
        requestMTU: 512, // Request larger MTU for better throughput
        timeout: 10000, // 10 second timeout
      });

      console.log('[BLE] Device connected, discovering services...');
      // Discover services and characteristics
      await device.discoverAllServicesAndCharacteristics();

      console.log('[BLE] Services discovered, checking for NUS service...');
      // Verify that the device has the Nordic UART Service
      const services = await device.services();
      const hasNUS = services.some(service => service.uuid.toLowerCase() === NUS_SERVICE_UUID.toLowerCase());
      
      if (!hasNUS) {
        console.warn('[BLE] Device does not have Nordic UART Service');
        // Continue anyway - device might still work
      } else {
        console.log('[BLE] ✓ Nordic UART Service found');
      }

      this.connectedDevice = device;

      // Setup notifications for incoming data (NUS TX characteristic)
      console.log('[BLE] Setting up notifications...');
      await this.setupNotifications();

      // Monitor disconnection
      device.onDisconnected((error, disconnectedDevice) => {
        console.log('[BLE] Device disconnected:', disconnectedDevice?.name || disconnectedDevice?.id);
        this.connectedDevice = null;
        if (this.connectionCallback) {
          this.connectionCallback(false);
        }
        if (error) {
          this.handleError(`Disconnected with error: ${error.message}`);
        }
      });

      console.log('[BLE] ✓ Successfully connected to', device.name || device.id);
      if (this.connectionCallback) {
        this.connectionCallback(true, device);
      }

      return true;
    } catch (error: any) {
      console.error('[BLE] Connection failed:', error);
      this.handleError(`Connection failed: ${error?.message || error}`);
      this.connectedDevice = null;
      return false;
    }
  }

  // Setup notifications for receiving data from device
  private async setupNotifications(): Promise<void> {
    if (!this.connectedDevice) {
      return;
    }

    try {
      console.log('[BLE] Setting up notifications for NUS TX characteristic');
      
      // Monitor NUS TX characteristic (device sends data to app)
      this.connectedDevice.monitorCharacteristicForService(
        NUS_SERVICE_UUID,
        NUS_TX_CHAR_UUID,
        (error, characteristic) => {
          if (error) {
            // Some errors are expected during normal operation (like when device disconnects)
            // Only log severe errors to avoid spamming the console
            if (error.errorCode !== 2 && !error.message?.includes('was cancelled')) {
              console.warn('[BLE] Notification error:', error.message, 'Code:', error.errorCode);
            }
            return;
          }

          if (characteristic?.value) {
            try {
              const decodedData = this.decodeBase64(characteristic.value);
              console.log('[BLE] Received data from device:', decodedData);
              if (this.dataCallback) {
                this.dataCallback(decodedData);
              }
            } catch (decodeError) {
              console.error('[BLE] Failed to decode received data:', decodeError);
            }
          }
        }
      );
      
      console.log('[BLE] ✓ Notifications enabled');
    } catch (error: any) {
      console.error('[BLE] Failed to setup notifications:', error);
      this.handleError(`Failed to setup notifications: ${error?.message || error}`);
    }
  }

  // Send data to device
  async sendData(data: string, withResponse: boolean = true): Promise<boolean> {
    if (!this.connectedDevice) {
      this.handleError('No device connected');
      return false;
    }

    try {
      console.log('[BLE] Sending data to device:', JSON.stringify(data), `(${data.length} bytes, withResponse: ${withResponse})`);
      
      // Encode data to base64
      const encodedData = base64.encode(data);
      console.log('[BLE] Base64 encoded:', encodedData);

      // Write to NUS RX characteristic (app sends data to device)
      // Use write-with-response by default (like Python GUI default)
      if (withResponse) {
        await this.connectedDevice.writeCharacteristicWithResponseForService(
          NUS_SERVICE_UUID,
          NUS_RX_CHAR_UUID,
          encodedData
        );
      } else {
        await this.connectedDevice.writeCharacteristicWithoutResponseForService(
          NUS_SERVICE_UUID,
          NUS_RX_CHAR_UUID,
          encodedData
        );
      }

      console.log('[BLE] ✓ Data sent successfully');
      return true;
    } catch (error: any) {
      console.error('[BLE] Failed to send data:', error);
      this.handleError(`Failed to send data: ${error?.message || error}`);
      return false;
    }
  }

  // Disconnect from device
  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      try {
        console.log('[BLE] Disconnecting from device:', this.connectedDevice.name || this.connectedDevice.id);
        await this.manager.cancelDeviceConnection(this.connectedDevice.id);
        this.connectedDevice = null;
        if (this.connectionCallback) {
          this.connectionCallback(false);
        }
        console.log('[BLE] ✓ Disconnected successfully');
      } catch (error: any) {
        console.error('[BLE] Disconnect error:', error);
        this.handleError(`Disconnect error: ${error?.message || error}`);
      }
    }
  }

  // Check if currently connected
  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  // Get connected device info
  getConnectedDevice(): Device | null {
    return this.connectedDevice;
  }

  // Set callback for received data
  setDataCallback(callback: BLEDataCallback): void {
    this.dataCallback = callback;
  }

  // Set callback for connection status changes
  setConnectionCallback(callback: BLEConnectionCallback): void {
    this.connectionCallback = callback;
  }

  // Set callback for errors
  setErrorCallback(callback: BLEErrorCallback): void {
    this.errorCallback = callback;
  }

  // Decode base64 string to UTF-8
  private decodeBase64(base64String: string): string {
    try {
      return base64.decode(base64String);
    } catch (error) {
      return base64String; // Return as-is if decode fails
    }
  }

  // Handle errors
  private handleError(message: string): void {
    console.error('BLE Error:', message);
    if (this.errorCallback) {
      this.errorCallback(message);
    }
  }

  // Cleanup
  destroy(): void {
    this.stopScan();
    this.disconnect();
    this.manager.destroy();
  }
}

// Export singleton instance
export const bleService = new BLEService();
export default BLEService;
