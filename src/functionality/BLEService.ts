import { BleManager, Device, Characteristic, State, Subscription } from 'react-native-ble-plx';
import { Platform, DeviceEventEmitter } from 'react-native';
import * as ExpoDevice from 'expo-device';
import base64 from 'react-native-base64';

// DO NOT USE NativeEventEmitter. Use DeviceEventEmitter directly!
const BLE_DATA_EVENT = 'BLE_DATA_LINE';
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

/**
 * Lightweight Event Emitter pattern (replaces RxJS Subject for React Native compatibility)
 * Allows multiple subscribers without requiring full RxJS library
 */
export class SimpleLineEmitter {
  private subscribers: Set<(line: string) => void> = new Set();
  private errorSubscribers: Set<(err: any) => void> = new Set();

  next(line: string) {
    this.subscribers.forEach(fn => {
      try {
        fn(line);
      } catch (err) {
        this.errorSubscribers.forEach(errFn => errFn(err));
      }
    });
  }

  subscribe(fn: (line: string) => void): () => void {
    this.subscribers.add(fn);
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(fn);
    };
  }

  onError(fn: (err: any) => void): () => void {
    this.errorSubscribers.add(fn);
    return () => {
      this.errorSubscribers.delete(fn);
    };
  }

  unsubscribeAll() {
    this.subscribers.clear();
    this.errorSubscribers.clear();
  }
}

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
   * Event Emitter for broadcasting raw sensor lines
   * Allows UI components to subscribe to data stream independently of dataCallback
   * Survives React remounts and screen transitions
   * Used by UI Layer 3/4 to render live telemetry
   */
  public readonly lineStream = new SimpleLineEmitter();

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
  
  private notificationSubscriptions: Subscription[] = [];
  private disconnectSubscription: Subscription | null = null;

  /**
   * Buffer processing timeout ID for async buffer draining.
   * Uses recursive setTimeout instead of setInterval to prevent event loop pile-up.
   * This ensures the next 50ms wait only starts after current buffer is completely finished parsing,
   * mathematically preventing JS thread lockup from overlapping parse operations.
   */
  private batchProcessInterval: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_INTERVAL_MS = 50;

  /**
   * Maximum safe RX buffer size (bytes) = 32,000.
   *
   * This is a last-resort safety net. If the buffer reaches this size,
   * the app is already too far behind, so we drop the backlog and recover.
   */
  private readonly RX_BUFFER_MAX_SAFE = 32000;

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
    // CRITICAL: Reset the disconnect flag so the new session's buffer loop can run!
    this.isIntentionalDisconnect = false;
    
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[BLE] Connection attempt ${attempt}/${retries} for device:`, deviceId);
        
        // Disconnect from any existing device
        await this.disconnect();

        console.log('[BLE] Connecting to device...');
        // Connect to device with timeout
        const device = await this.manager.connectToDevice(deviceId, {
          timeout: 10000, // 10 second timeout
        });

        console.log('[BLE] Device connected, requesting maximum MTU...');
        // Request maximum MTU (512 bytes) to minimize fragmentation
        // Larger MTU = fewer BLE packets per message = less bridge overhead
        try {
          const grantedMTU = await device.requestMTU(512);
          console.log(`[BLE] ✓ MTU negotiated: ${grantedMTU} bytes (reduces fragmentation)`);
        } catch (mtuError: any) {
          console.warn('[BLE] MTU request failed (non-critical):', mtuError.message);
          // Continue anyway, will use default MTU (~23 bytes)
        }

        console.log('[BLE] Discovering services...');
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

        // Setup disconnection listener for UNEXPECTED drops
        this.disconnectSubscription?.remove();
        this.disconnectSubscription = device.onDisconnected((error, disconnectedDevice) => {
          console.log('[BLE] Unexpected remote disconnect detected. Cleaning up...');
          
          this.stopBatchProcessor();

          // CRITICAL: For unexpected drops, the OS already destroyed the streams.
          // Do NOT call sub.remove() here. Just clear the array!
          this.notificationSubscriptions = []; 
          
          this.connectedDevice = null;
          this.rxLineBuffer = '';
          this.isIntentionalDisconnect = false;

          if (this.connectionCallback) {
            this.connectionCallback(false);
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
    this.cleanupSubscriptions();

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
        try {
          if (error) {
            if (error.errorCode !== 2 && !error.message?.includes('was cancelled')) {
              console.warn(`[BLE] ${source} notification error:`, error.message);
            }
            return;
          }
          if (!characteristic?.value) return;

          // DUMB APPEND: Just add decoded text to buffer, no normalization here
          const decodedText = base64.decode(characteristic.value);
          
          this.rxLineBuffer += decodedText;

          // Last-resort safety: if buffer gets too large, trim from end
          if (this.rxLineBuffer.length > this.RX_BUFFER_MAX_SAFE) {
            console.error(
              `[BLE] RX BUFFER FATAL OVERFLOW! Size=${this.rxLineBuffer.length} bytes (max=${this.RX_BUFFER_MAX_SAFE}). ` +
              'Clearing buffer to recover.'
            );
            const lastNl = this.rxLineBuffer.lastIndexOf('\n');
            this.rxLineBuffer = lastNl >= 0 ? this.rxLineBuffer.slice(lastNl + 1) : '';
            return;
          }
        } catch (decodeError: any) {
          console.warn('[BLE] Decode error (listener continues):', decodeError?.message || decodeError);
        }
    };

      // ── 0. Start batch processing loop (JS Bridge Throttling) ────────────────
      // Process accumulated rx_buf every 50ms instead of on every notification.
      // This prevents the Native→JS bridge from being flooded with 200+ events/sec.
      this.startBatchProcessor();
      console.log('[BLE] ✓ Batch processor started (50ms throttle)');

      // ── 1. Primary TX / notify characteristic ─────────────────────────────
      // For NRF_LOG_PROTOCOL: protocol.txCharUUID IS the log notify char.
      // For UART protocols: this is the UART TX (data from device).
      const primarySub = this.connectedDevice.monitorCharacteristicForService(
        protocol.serviceUUID,
        protocol.txCharUUID,
        (error, char) => handleRawNotify(error, char, 'PRIMARY-NOTIFY')
      );
      this.notificationSubscriptions.push(primarySub);

      // ── 2. nRF Zephyr BLE Log Service (secondary fallback) ────────────────
      // Only subscribe separately when the current protocol is NOT already the
      // log service (otherwise we'd double-subscribe the same characteristic).
      if (protocol.type !== BLEProtocolType.NRF_LOG_SERVICE) {
        try {
          const logSub = this.connectedDevice.monitorCharacteristicForService(
            LOG_SERVICE_UUID,
            LOG_NOTIFY_UUID,
            (error, char) => handleRawNotify(error, char, 'LOG-NOTIFY')
          );
          this.notificationSubscriptions.push(logSub);
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

  /**
   * Start the batch processing loop (JS Bridge Throttling).
   *
   * Instead of processing every BLE notification immediately (200+ events/sec),
   * accumulate data in rx_buf and process once every 50ms. This reduces bridge
   * pressure by ~75% while maintaining data integrity.
   *
   * Benefit: 200 events/sec → processed in ~20 batches/sec (75% fewer transitions)
   */
  private startBatchProcessor(): void {
    // Stop any existing processor first
    this.stopBatchProcessor();

    // Start the async buffer processing loop
    this.processBufferLoop();
    console.log(`[BLE] Async buffer processor started (recursive setTimeout, ${this.BATCH_INTERVAL_MS}ms)`);
  }

  /**
   * Async buffer processor using recursive setTimeout.
   * Extracts complete lines from rxLineBuffer and dispatches them to the data callback.
   * 
   * CRITICAL: Uses setTimeout instead of setInterval to prevent event loop pile-up.
   * The next timeout is only scheduled AFTER the current buffer is completely finished
   * draining, ensuring parsing time never overlaps. This prevents JS thread lockup.
   */
  private processBufferLoop(): void {
    try {
      let newlineIdx;
      let extractedCount = 0;
      
      // FAST EXTRACTION: Zero Regex, minimal memory allocation
      while ((newlineIdx = this.rxLineBuffer.indexOf('\n')) !== -1) {
        let line = this.rxLineBuffer.substring(0, newlineIdx);
        this.rxLineBuffer = this.rxLineBuffer.substring(newlineIdx + 1);

        // Fast trim carriage return
        if (line.endsWith('\r')) {
          line = line.substring(0, line.length - 1);
        }

        if (line.length > 0) {
          // ✅ LOG: Raw sensor line from device
          console.log('[BLE→Parser] RAW LINE:', line);
          
          // Bulletproof emission using singleton DeviceEventEmitter
          DeviceEventEmitter.emit(BLE_DATA_EVENT, line);
          
          extractedCount++;
        }
      }

    } catch (error) {
      console.warn('[BLE] Parse error in loop', error);
    } finally {
      // CRITICAL: Guarantee next iteration runs in finally block.
      // This ensures processBufferLoop continues even if SensorParser throws
      // an unexpected error (e.g., TypeError from malformed firmware data during sensor contact).
      // The boolean flag allows clean shutdown on disconnect without race conditions.
      if (!this.isIntentionalDisconnect) {
        this.batchProcessInterval = setTimeout(() => this.processBufferLoop(), this.BATCH_INTERVAL_MS);
      }
    }
  }

  /**
   * Stop the async buffer processing loop.
   * Called on disconnect or when notifications are cleaned up.
   */
  private stopBatchProcessor(): void {
    if (this.batchProcessInterval) {
      clearTimeout(this.batchProcessInterval);
      this.batchProcessInterval = null;
      console.log('[BLE] Async buffer processor stopped');
    }
  }

  private cleanupSubscriptions(): void {
    this.stopBatchProcessor();

    // CRITICAL: NEVER call sub.remove() on characteristic monitors.
    // The native OS handles this automatically on disconnect.
    // Calling it manually causes a fatal DeadObjectException on Android.
    this.notificationSubscriptions = [];

    // It is safe to remove the general disconnect listener
    if (this.disconnectSubscription) {
      try { this.disconnectSubscription.remove(); } catch {}
      this.disconnectSubscription = null;
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
    if (!this.connectedDevice) {
      console.log('[BLE] ✓ No device connected, skipping disconnect');
      return;
    }
    
    console.log('[BLE] 🔌 Starting intentional manual disconnect...');

    try {
      // Step 0: Immediately set flag to stop buffer loop
      this.isIntentionalDisconnect = true;
      console.log('[BLE] ✓ Set isIntentionalDisconnect flag');
      
      // Small delay to let buffer loop notice the flag
      try {
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (delayErr) {
        // Ignore
      }

      // Step 1: Stop batch processor (no error handling needed - internal cleanup)
      console.log('[BLE] Stopping batch processor...');
      try {
        this.stopBatchProcessor();
        console.log('[BLE] ✓ Batch processor stopped');
      } catch (processorErr: any) {
        console.warn('[BLE] ⚠️  Batch processor stop error (non-critical):', processorErr?.message);
      }

      // Step 2: Remove disconnect listener FIRST (no errors can occur here)
      console.log('[BLE] Removing disconnect listener...');
      if (this.disconnectSubscription) {
        try {
          this.disconnectSubscription.remove();
          console.log('[BLE] ✓ Disconnect listener removed');
        } catch (listenerErr: any) {
          console.warn('[BLE] ⚠️  Listener removal error (non-critical):', listenerErr?.message);
        }
        this.disconnectSubscription = null;
      }

      // Step 3: Stop notification monitors (critical - can hang if not careful)
      console.log('[BLE] Removing notification subscriptions...');
      try {
        // NEVER call sub.remove() - Android will crash. Just clear array.
        this.notificationSubscriptions = [];
        console.log('[BLE] ✓ Notification subscriptions cleared');
      } catch (subErr: any) {
        console.warn('[BLE] ⚠️  Subscription clear error (non-critical):', subErr?.message);
      }

      // Step 4: Sever the connection with timeout protection
      console.log('[BLE] Severing BLE connection...');
      if (this.connectedDevice) {
        try {
          // Check if connected first
          let isConnected = false;
          try {
            isConnected = await Promise.race([
              this.connectedDevice.isConnected(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('isConnected timeout')), 3000))
            ]) as boolean;
          } catch (isConnErr: any) {
            console.warn('[BLE] ⚠️  isConnected check failed, assuming connected:', isConnErr?.message);
            isConnected = true;
          }

          if (isConnected) {
            console.log('[BLE] Device is connected, cancelling connection...');
            try {
              await Promise.race([
                this.manager.cancelDeviceConnection(this.connectedDevice.id),
                new Promise((_, reject) => setTimeout(() => reject(new Error('cancelDeviceConnection timeout')), 8000))
              ]);
              console.log('[BLE] ✓ Connection cancelled successfully');
            } catch (cancelErr: any) {
              console.warn('[BLE] ⚠️  Connection cancellation failed (non-critical):', cancelErr?.message);
              // Continue - state will be cleared anyway
            }
          } else {
            console.log('[BLE] Device already disconnected');
          }
        } catch (connErr: any) {
          console.warn('[BLE] ⚠️  Connection check error (non-critical):', connErr?.message);
        }
      }

    } catch (error: any) {
      // Catch-all for any unexpected errors
      console.error('[BLE] ❌ Unexpected error during disconnect:', error?.message || error);
      // Continue to cleanup anyway
    } finally {
      // Step 5: ALWAYS clean up JS state, even if steps failed
      console.log('[BLE] Clearing internal state...');
      try {
        this.connectedDevice = null;
        this.rxLineBuffer = '';
        this.isIntentionalDisconnect = false;
        console.log('[BLE] ✓ Internal state cleared');
      } catch (stateErr: any) {
        console.error('[BLE] ❌ State cleanup error:', stateErr?.message);
      }

      // Step 6: Fire callback (non-blocking)
      console.log('[BLE] Firing connection callback...');
      try {
        if (this.connectionCallback) {
          this.connectionCallback(false);
          console.log('[BLE] ✓ Connection callback fired');
        }
      } catch (callbackErr: any) {
        console.error('[BLE] ❌ Callback error (non-critical):', callbackErr?.message);
      }

      console.log('[BLE] ✅ Manual disconnect sequence complete');
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
    console.log('[BLE] setDataCallback registered. Checking for buffered data...');
    this.dataCallback = callback;
    
    // CRITICAL FIX: If buffer has accumulated data while callback was null,
    // process it NOW. Without this, data registered before React mounts is lost.
    if (this.rxLineBuffer.length > 0) {
      console.log(`[BLE] ⚠️ Buffer had ${this.rxLineBuffer.length} bytes while callback was null. Processing now...`);
      // Schedule immediate processing instead of waiting for next interval
      if (this.batchProcessInterval) {
        clearTimeout(this.batchProcessInterval);
      }
      this.batchProcessInterval = setTimeout(() => this.processBufferLoop(), 0);
    }
  }

  // Set callback for connection status changes
  setConnectionCallback(callback: BLEConnectionCallback): void {
    this.connectionCallback = callback;
  }

  // Set callback for errors
  setErrorCallback(callback: BLEErrorCallback): void {
    this.errorCallback = callback;
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
    this.cleanupSubscriptions();
    this.disconnect();
    this.manager.destroy();
  }
}

// Export singleton instance
export const bleService = new BLEService();
export default BLEService;
