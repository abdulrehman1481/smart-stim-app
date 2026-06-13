import { Device, Subscription } from 'react-native-ble-plx';
import base64 from 'react-native-base64';
import { DeviceEventEmitter } from 'react-native';
import { sharedBleManager } from './BLEService'; // CRITICAL: Share the radio!
import { ESP_EARBUD_PROTOCOL } from './BLEProtocols';
import { teardownGuard } from './BLETeardown';

class EarbudService {
  private device: Device | null = null;
  private notifySub: any = null;
  private disconnectSub: any = null;
  private rxBuffer = '';
  private dataCallback?: (data: string) => void;
  private onDisconnectCallback?: () => void;
  private _disconnectInProgress = false;

  setDataCallback(cb: (data: string) => void) {
    this.dataCallback = cb;
  }

  setOnDisconnect(cb: () => void) {
    this.onDisconnectCallback = cb;
  }

  async resetState(): Promise<void> {
    if (!this.device) return;
    try {
      const alive = await sharedBleManager
        .isDeviceConnected(this.device.id)
        .catch(() => false);
      if (!alive) {
        this.device = null;
        this.notifySub = null;
        this.disconnectSub = null;
      }
    } catch {
      this.device = null;
    }
  }

  async connect(deviceId: string): Promise<boolean> {
    // Reset teardown flag for fresh connection
    this._disconnectInProgress = false;

    // Validate existing connection
    if (this.device?.id === deviceId) {
      try {
        const alive = await sharedBleManager
          .isDeviceConnected(deviceId)
          .catch(() => false);
        if (alive) return true;
        this.device = null;
        this.notifySub = null;
        this.disconnectSub = null;
      } catch {
        this.device = null;
      }
    }

    if (this.device) {
      await this.disconnect();
      await new Promise(r => setTimeout(r, 400));
    }

    try {
      const device = await sharedBleManager.connectToDevice(deviceId, {
        requestMTU: 512,
        timeout: 10000,
      });

      const discovered = await device.discoverAllServicesAndCharacteristics();
      this.device = discovered;

      // Natural disconnect listener
      this.disconnectSub = sharedBleManager.onDeviceDisconnected(
        deviceId,
        (error) => {
          if (this._disconnectInProgress) return; // We caused this, ignore
          console.log('[EarbudService] Natural disconnect detected');
          this.device = null;
          this.notifySub = null;
          this.disconnectSub = null;
          if (this.onDisconnectCallback) this.onDisconnectCallback();
        }
      );

      // Set up notifications
      const services = await discovered.services();
      for (const service of services) {
        const chars = await service.characteristics();
        for (const char of chars) {
          if (char.isNotifiable) {
            this.notifySub = char.monitor((error, c) => {
              // CRASH PREVENTION 1: Stop if teardown is active
              if (this._disconnectInProgress) return;
              if (teardownGuard.isTearingDown) return;
              if (error) return;
              if (c?.value) {
                const raw = base64.decode(c.value);
                if (this.dataCallback) this.dataCallback(raw);
              }
            });
          }
        }
      }

      console.log('[EarbudService] ✅ Connected to', deviceId);
      return true;

    } catch (e: any) {
      console.error('[EarbudService] Connection failed:', e?.message);
      this.device = null;
      return false;
    }
  }

  async sendCommand(command: string): Promise<boolean> {
    if (!this.device) {
      console.error('[EarbudService] sendCommand: No device connected');
      return false;
    }

    try {
      // Ensure command ends with newline (protocol requirement)
      const commandWithNewline = command.endsWith('\n') ? command : `${command}\n`;
      
      console.log('[EarbudService] 📤 Sending command:', JSON.stringify(commandWithNewline));
      
      // Encode to base64 for BLE transmission
      const encodedData = base64.encode(commandWithNewline);
      
      // Write to RX characteristic (app sends to device)
      await this.device.writeCharacteristicWithResponseForService(
        ESP_EARBUD_PROTOCOL.serviceUUID,
        ESP_EARBUD_PROTOCOL.rxCharUUID,
        encodedData
      );
      
      console.log('[EarbudService] ✅ Command sent successfully');
      return true;
    } catch (error: any) {
      console.error('[EarbudService] Failed to send command:', error?.message);
      return false;
    }
  }

  async setParameters(
    offset: number,
    phase1: number,
    phase2: number,
    tonpos: number,
    toff: number,
    tonneg: number
  ): Promise<boolean> {
    const commands = [
      `SET OFFSET ${offset}`,
      `SET PHASE1 ${phase1}`,
      `SET PHASE2 ${phase2}`,
      `SET TONPOS ${tonpos}`,
      `SET TOFF ${toff}`,
      `SET TONNEG ${tonneg}`,
    ];

    for (const cmd of commands) {
      const success = await this.sendCommand(cmd);
      if (!success) return false;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return true;
  }

  async start(): Promise<boolean> {
    return await this.sendCommand('START');
  }

  async stop(): Promise<boolean> {
    return await this.sendCommand('STOP');
  }

  async disconnect(): Promise<void> {
    if (!this.device) {
      console.log('[EarbudService] disconnect() called but no device, skipping');
      return;
    }
    if (this._disconnectInProgress) {
      console.log('[EarbudService] disconnect() already in progress, skipping');
      return;
    }

    this._disconnectInProgress = true;
    this.dataCallback = undefined;

    // Capture device ID before nulling anything
    const deviceId = this.device.id;
    console.log('[EarbudService] 🔌 Disconnecting', deviceId);

    // NULL everything immediately — stops all callbacks before any async work
    this.notifySub = null;
    this.disconnectSub = null;
    this.device = null;  // NULL DEVICE FIRST before any await

    try {
      // Wait for in-flight packets — device is already nulled so no callbacks can fire
      await new Promise(r => setTimeout(r, 400));

      // Wrap cancelDeviceConnection in its own try-catch
      // This call can throw NullPointerException on Android — must be isolated
      try {
        const alive = await sharedBleManager
          .isDeviceConnected(deviceId)
          .catch(() => false);

        if (alive) {
          await sharedBleManager.cancelDeviceConnection(deviceId);
          console.log('[EarbudService] ✅ cancelDeviceConnection succeeded');
        } else {
          console.log('[EarbudService] Device already disconnected at native level');
        }
      } catch (nativeError: any) {
        // Swallow ALL native BLE errors here — the device is already nulled
        // so the app state is already clean regardless of what Android throws
        console.log('[EarbudService] Native disconnect error (safe, ignored):', nativeError?.message ?? nativeError);
      }

      console.log('[EarbudService] ✅ Disconnected');
    } finally {
      // Redundant safety — ensure these are always null even if something threw
      this.device = null;
      this.rxBuffer = '';
      this.notifySub = null;
      this.disconnectSub = null;
      this._disconnectInProgress = false;
      console.log('[EarbudService] ✅ Teardown finally block complete');
    }
  }
}

export const earbudService = new EarbudService();
