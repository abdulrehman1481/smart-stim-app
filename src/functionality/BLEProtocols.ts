// BLE Protocol definitions for different device types

export enum BLEProtocolType {
  NORDIC_UART = 'NORDIC_UART',
  ESP32_CUSTOM = 'ESP32_CUSTOM',
}

export interface BLEProtocol {
  name: string;
  type: BLEProtocolType;
  serviceUUID: string;
  rxCharUUID: string; // Write to device
  txCharUUID: string; // Receive from device (notify)
  preferredDeviceName?: string;
}

// Nordic UART Service (NUS) - Used by nRF52, etc.
export const NORDIC_UART_PROTOCOL: BLEProtocol = {
  name: 'Nordic UART Service',
  type: BLEProtocolType.NORDIC_UART,
  serviceUUID: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  rxCharUUID: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  txCharUUID: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  preferredDeviceName: 'DeepSleepDongle',
};

// ESP32 Custom Service - Common ESP32 UART-like service
export const ESP32_PROTOCOL: BLEProtocol = {
  name: 'ESP32 UART Service',
  type: BLEProtocolType.ESP32_CUSTOM,
  // Standard ESP32 BLE UART service UUIDs (compatible with common ESP32 examples)
  serviceUUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
  rxCharUUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a8', // Write characteristic
  txCharUUID: '6d68efe5-04b6-4a85-abc4-c2670b7bf7fd', // Notify characteristic
  preferredDeviceName: 'ESP32',
};

// All supported protocols
export const SUPPORTED_PROTOCOLS: BLEProtocol[] = [
  NORDIC_UART_PROTOCOL,
  ESP32_PROTOCOL,
];

// Get protocol by type
export function getProtocol(type: BLEProtocolType): BLEProtocol {
  const protocol = SUPPORTED_PROTOCOLS.find(p => p.type === type);
  if (!protocol) {
    throw new Error(`Protocol type ${type} not found`);
  }
  return protocol;
}

// Get protocol by service UUID
export function getProtocolByServiceUUID(uuid: string): BLEProtocol | null {
  return SUPPORTED_PROTOCOLS.find(
    p => p.serviceUUID.toLowerCase() === uuid.toLowerCase()
  ) || null;
}
