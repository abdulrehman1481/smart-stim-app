import { BleManager, Device, Characteristic, State } from 'react-native-ble-plx';
import { Platform } from 'react-native';
import * as ExpoDevice from 'expo-device';
import base64 from 'react-native-base64';
import { 
  BLEProtocol, 
  BLEProtocolType, 
  NORDIC_UART_PROTOCOL, 
  ESP32_PROTOCOL,
  SUPPORTED_PROTOCOLS,
  getProtocolByServiceUUID,
  matchesPreferredDeviceName,
  LOG_SERVICE_UUID,
  LOG_NOTIFY_UUID,
  NRF_LOG_PROTOCOL,
} from './BLEProtocols';

// For backward compatibility
export const NUS_SERVICE_UUID = NORDIC_UART_PROTOCOL.serviceUUID;
export const NUS_RX_CHAR_UUID = NORDIC_UART_PROTOCOL.rxCharUUID;
export const NUS_TX_CHAR_UUID = NORDIC_UART_PROTOCOL.txCharUUID;
export const PREFERRED_DEVICE_NAME = NORDIC_UART_PROTOCOL.preferredDeviceName;

export interface BLEDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  protocol?: BLEProtocol; // Which protocol this device supports
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
  private currentProtocol: BLEProtocol = NORDIC_UART_PROTOCOL;
  private selectedProtocols: BLEProtocol[] = SUPPORTED_PROTOCOLS;

  /**
   * Set to true while an intentional disconnect is in progress.
   * Prevents the `onDisconnected` event handler (registered during connect)
   * from firing the connectionCallback a second time when we explicitly call
   * cancelDeviceConnection(), which would cause duplicate React state updates
   * and potentially crash the app.
   */
  private isIntentionalDisconnect = false;

  /**
   * Line-reassembly buffer.
   *
   * The nRF52840 BLE log backend sends log messages as raw UTF-8 bytes
   * followed by a separate \r\n packet. The BLE radio fragments payloads
   * into MTU-sized chunks (~20 bytes at 23-byte MTU). Each chunk arrives
   * as its own GATT notification, so we must buffer them and only emit
   * a line to callers once we see a newline terminator.
   */
  private rxLineBuffer: string = '';

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

  // Set which protocols to scan for
  setProtocolFilter(protocols: BLEProtocol[]): void {
    this.selectedProtocols = protocols.length > 0 ? protocols : SUPPORTED_PROTOCOLS;
    console.log('[BLE] Protocol filter set:', this.selectedProtocols.map(p => p.name).join(', '));
  }

  // Get current protocol
  getCurrentProtocol(): BLEProtocol {
    return this.currentProtocol;
  }

  // Set protocol (useful when connecting to a specific device)
  setProtocol(protocol: BLEProtocol): void {
    this.currentProtocol = protocol;
    console.log('[BLE] Protocol changed to:', protocol.name);
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
      console.log('[BLE] Looking for devices with protocols:', this.selectedProtocols.map(p => p.name).join(', '));
      this.isScanning = true;
      const discoveredDevices = new Map<string, BLEDevice>();

      // Scan for ALL BLE devices (null = no service filter)
      // We'll detect protocols when connecting, not during scan
      console.log('[BLE] Scanning for ALL BLE devices...');

      this.manager.startDeviceScan(
        null, // Scan for ALL devices (no service filter)
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
            const advertisedServiceUUIDs = (device.serviceUUIDs ?? []).map((uuid) => uuid.toLowerCase());
            
            // Show ALL devices regardless of signal strength
            // Let user decide which to connect to

            // Try to determine which protocol this device uses based on name
            // or advertised services. We'll verify this during connection too.
            let detectedProtocol: BLEProtocol | undefined;

            // Prefer advertised service UUID match when available.
            for (const protocol of this.selectedProtocols) {
              if (advertisedServiceUUIDs.includes(protocol.serviceUUID.toLowerCase())) {
                detectedProtocol = protocol;
                break;
              }
            }

            // Fallback to tolerant device-name matching.
            for (const protocol of this.selectedProtocols) {
              if (!detectedProtocol && matchesPreferredDeviceName(protocol, deviceName)) {
                detectedProtocol = protocol;
                break;
              }
            }

            // Log discovered device
            console.log('[BLE] ✓ Found BLE device:', {
              id: device.id,
              name: deviceName,
              rssi: device.rssi,
              detectedProtocol: detectedProtocol?.name || 'Unknown',
            });

            // Add to discovered devices map (prevents duplicates)
            if (!discoveredDevices.has(device.id)) {
              const bleDevice: BLEDevice = {
                id: device.id,
                name: deviceName,
                rssi: device.rssi,
                protocol: detectedProtocol,
              };
              discoveredDevices.set(device.id, bleDevice);
              onDeviceFound(bleDevice);
              
              // Highlight if this is a preferred device
              if (detectedProtocol) {
                console.log(`[BLE] 🎯 Found preferred device: ${deviceName} (${detectedProtocol.name})`);
              }
            }
          }
        }
      );

      // Auto-stop scan after duration
      setTimeout(() => {
        const deviceCount = discoveredDevices.size;
        console.log(`[BLE] Scan completed. Found ${deviceCount} device(s).`);
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
  async connect(deviceId: string, retries: number = 3): Promise<boolean> {
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[BLE] Connection attempt ${attempt}/${retries} for device:`, deviceId);
        
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

        console.log('[BLE] Services discovered, checking for supported services...');
        // Verify that the device has a supported service and auto-detect protocol
        const services = await device.services();
        let detectedProtocol: BLEProtocol | null = null;
        
        for (const service of services) {
          const protocol = getProtocolByServiceUUID(service.uuid);
          if (protocol) {
            detectedProtocol = protocol;
            console.log('[BLE] ✓ Detected protocol:', protocol.name);
            break;
          }
        }
        
        if (!detectedProtocol) {
          console.warn('[BLE] Device does not have any recognized service protocol');
          // Try to use the current protocol anyway
          detectedProtocol = this.currentProtocol;
        } else {
          // Update current protocol to the detected one
          this.currentProtocol = detectedProtocol;
        }

        console.log('[BLE] Using protocol:', this.currentProtocol.name);
        this.connectedDevice = device;

        // Setup notifications for incoming data
        console.log('[BLE] Setting up notifications...');
        await this.setupNotifications();

        // Monitor disconnection (unexpected / BLE-initiated only)
        device.onDisconnected((error, disconnectedDevice) => {
          // If we called disconnect() intentionally, skip — it already fires
          // connectionCallback and setting the flag prevents a double-trigger
          // which can cause React state thrashing and app crashes on Android.
          if (this.isIntentionalDisconnect) return;

          console.log('[BLE] Device disconnected (remote):', disconnectedDevice?.name || disconnectedDevice?.id);
          this.connectedDevice = null;
          this.rxLineBuffer = '';
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
        lastError = error;
        console.error(`[BLE] Connection attempt ${attempt} failed:`, error.message);
        
        if (attempt < retries) {
          console.log(`[BLE] Retrying in 2 seconds... (${retries - attempt} attempts remaining)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // All retries failed
    console.error('[BLE] All connection attempts failed');
    this.handleError(`Connection failed after ${retries} attempts: ${lastError?.message || lastError}`);
    this.connectedDevice = null;
    return false;
  }

  // Setup notifications for receiving data from device
  private async setupNotifications(): Promise<void> {
    if (!this.connectedDevice) {
      return;
    }

    // Clear any stale fragment from a previous session
    this.rxLineBuffer = '';

    try {
      const protocol = this.currentProtocol;
      console.log('[BLE] Setting up notifications for', protocol.name, 'TX characteristic');
      
      /**
       * Shared notification handler with line-reassembly.
       *
       * BLE MTU fragments (~20 bytes) are accumulated in `rxLineBuffer`.
       * Complete lines (terminated by \n) are extracted and forwarded to
       * `dataCallback` one at a time.  Partial fragments are held in the
       * buffer until the next notification completes them.
       */
      const handleRawNotify = (error: any, characteristic: Characteristic | null, source: string) => {
        if (error) {
          if (error.errorCode !== 2 && !error.message?.includes('was cancelled')) {
            console.warn(`[BLE] ${source} notification error:`, error.message);
          }
          return;
        }
        if (!characteristic?.value) return;

        try {
          const chunk = this.decodeBase64(characteristic.value);

          // Append chunk to the reassembly buffer
          this.rxLineBuffer += chunk;

          // Normalise CRLF → LF
          this.rxLineBuffer = this.rxLineBuffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

          // Extract every complete line from the buffer
          let newlineIdx: number;
          while ((newlineIdx = this.rxLineBuffer.indexOf('\n')) !== -1) {
            const completeLine = this.rxLineBuffer.slice(0, newlineIdx).trim();
            this.rxLineBuffer = this.rxLineBuffer.slice(newlineIdx + 1);

            if (completeLine && this.dataCallback) {
              this.dataCallback(completeLine);
            }
          }

          // Guard: if somehow the buffer grows beyond 4 KB without a newline
          // (e.g. binary garbage), discard it to prevent memory bloat.
          if (this.rxLineBuffer.length > 4096) {
            console.warn('[BLE] rxLineBuffer overflow – discarding stale data');
            this.rxLineBuffer = '';
          }
        } catch (decodeError) {
          console.error('[BLE] Failed to decode received data:', decodeError);
        }
      };

      // ── 1. Primary TX / notify characteristic ─────────────────────────────
      // For NRF_LOG_PROTOCOL: protocol.txCharUUID IS the log notify char.
      // For UART protocols: this is the UART TX (data from device).
      this.connectedDevice.monitorCharacteristicForService(
        protocol.serviceUUID,
        protocol.txCharUUID,
        (error, char) => handleRawNotify(error, char, 'PRIMARY-NOTIFY')
      );

      // ── 2. nRF Zephyr BLE Log Service (secondary fallback) ────────────────
      // Only subscribe separately when the current protocol is NOT already the
      // log service (otherwise we'd double-subscribe the same characteristic).
      if (protocol.type !== BLEProtocolType.NRF_LOG_SERVICE) {
        try {
          this.connectedDevice.monitorCharacteristicForService(
            LOG_SERVICE_UUID,
            LOG_NOTIFY_UUID,
            (error, char) => handleRawNotify(error, char, 'LOG-NOTIFY')
          );
          console.log('[BLE] ✓ Sensor-log notifications enabled (LOG_NOTIFY_UUID)');
        } catch (logErr: any) {
          console.log('[BLE] Log-service not available on this device (OK):', logErr?.message);
        }
      }

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
      const protocol = this.currentProtocol;
      console.log('[BLE] TX:', data.substring(0, 50) + (data.length > 50 ? '...' : ''), `(${data.length} bytes)`);
      
      // Encode data to base64
      const encodedData = base64.encode(data);

      // Write to RX characteristic (app sends data to device)
      // Use write-with-response by default (like Python GUI default)
      if (withResponse) {
        await this.connectedDevice.writeCharacteristicWithResponseForService(
          protocol.serviceUUID,
          protocol.rxCharUUID,
          encodedData
        );
      } else {
        await this.connectedDevice.writeCharacteristicWithoutResponseForService(
          protocol.serviceUUID,
          protocol.rxCharUUID,
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
    if (!this.connectedDevice) return;
    try {
      console.log('[BLE] Disconnecting from device:', this.connectedDevice.name || this.connectedDevice.id);
      // Guard flag prevents onDisconnected from firing a 2nd connectionCallback
      this.isIntentionalDisconnect = true;
      await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      this.connectedDevice = null;
      this.rxLineBuffer = ''; // discard any partial line
      // Single authoritative callback — onDisconnected is suppressed by flag
      if (this.connectionCallback) {
        this.connectionCallback(false);
      }
      console.log('[BLE] ✓ Disconnected successfully');
    } catch (error: any) {
      console.error('[BLE] Disconnect error:', error);
      this.connectedDevice = null;
      this.rxLineBuffer = '';
      if (this.connectionCallback) {
        this.connectionCallback(false);
      }
      this.handleError(`Disconnect error: ${error?.message || error}`);
    } finally {
      this.isIntentionalDisconnect = false;
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
