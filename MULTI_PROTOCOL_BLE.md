# Multi-Protocol BLE Support

The Smart Stim App now supports multiple BLE protocols, allowing you to connect to different types of devices.

## Supported Protocols

### 1. Nordic UART Service (NUS)
- **Device Type**: nRF52-based devices, Nordic dongles
- **Service UUID**: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- **RX Characteristic**: `6e400002-b5a3-f393-e0a9-e50e24dcca9e` (Write)
- **TX Characteristic**: `6e400003-b5a3-f393-e0a9-e50e24dcca9e` (Notify)
- **Example Device**: DeepSleepDongle

### 2. ESP32 Custom UART Service
- **Device Type**: ESP32 microcontrollers
- **Service UUID**: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- **RX Characteristic**: `beb5483e-36e1-4688-b7f5-ea07361b26a8` (Write)
- **TX Characteristic**: `6d68efe5-04b6-4a85-abc4-c2670b7bf7fd` (Notify)
- **Example Device**: ESP32

## How to Use

### Scanning for Devices

1. Open the **Devices** tab
2. **Select Protocols**: Tap on the protocol chips (Nordic/ESP32) to enable/disable scanning for specific devices
   - Blue chip = Nordic UART Service
   - Green chip = ESP32 Custom Service
   - You can select both to scan for all devices
3. Tap **Scan** to start searching
4. Devices will appear with a protocol badge showing which protocol they support

### Connecting

1. After scanning, tap on any discovered device to connect
2. The app will automatically detect and use the correct protocol
3. Once connected, the status bar shows which protocol is being used

### Sending Commands

The app supports the same commands for both protocols:
- **`1`** - Turn LED ON
- **`0`** - Turn LED OFF
- **`sleep`** - Put device to sleep
- Custom commands supported by your device

## ESP32 Setup

To test with an ESP32 device:

1. **Hardware Required**:
   - ESP32 development board
   - Built-in LED (GPIO 2) or external LED

2. **Software Setup**:
   - Install Arduino IDE
   - Install ESP32 board support (via Board Manager)
   - Install "ESP32 BLE Arduino" library (via Library Manager)

3. **Upload Sketch**:
   - Open `ESP32_BLE_UART_Example.ino` in Arduino IDE
   - Select your ESP32 board from Tools > Board
   - Select the correct COM port
   - Click Upload

4. **Test Connection**:
   - In the Smart Stim App, enable "ESP32" protocol
   - Scan for devices
   - Connect to "ESP32"
   - Send "1" to turn LED on, "0" to turn LED off

## Adding Custom Protocols

To add support for your own BLE protocol:

1. **Define Protocol** in `src/functionality/BLEProtocols.ts`:
```typescript
export const MY_CUSTOM_PROTOCOL: BLEProtocol = {
  name: 'My Custom Protocol',
  type: BLEProtocolType.MY_CUSTOM,  // Add to enum
  serviceUUID: 'your-service-uuid',
  rxCharUUID: 'your-rx-characteristic-uuid',
  txCharUUID: 'your-tx-characteristic-uuid',
  preferredDeviceName: 'MyDevice',
};
```

2. **Add to Supported Protocols**:
```typescript
export const SUPPORTED_PROTOCOLS: BLEProtocol[] = [
  NORDIC_UART_PROTOCOL,
  ESP32_PROTOCOL,
  MY_CUSTOM_PROTOCOL,  // Add here
];
```

3. The app will automatically include it in the protocol selector!

## Protocol Auto-Detection

The app automatically detects which protocol a device uses:

1. **During Scan**: Devices are matched to protocols by service UUID
2. **During Connection**: The app verifies available services and selects the appropriate protocol
3. **Smart Fallback**: If a device supports multiple protocols, the first match is used

## Troubleshooting

### Device Not Appearing

- Make sure the correct protocol is enabled in the protocol selector
- Check that your device is advertising the correct service UUID
- Ensure device is powered on and within range
- Try restarting Bluetooth on your phone

### Connection Fails

- Verify the device supports the detected protocol
- Check that RX and TX characteristic UUIDs match
- Ensure device firmware is configured correctly
- Try forgetting the device in phone's Bluetooth settings

### Commands Not Working

- Verify line ending settings (None, \n, \r, \r\n)
- Try toggling "Write Mode" (With/Without Response)
- Check device firmware expects the command format
- Monitor device serial output for debugging

## Technical Details

### Data Encoding
- All data is sent as UTF-8 strings
- Data is Base64 encoded for BLE transmission
- Line endings can be configured (None, LF, CR, CRLF)

### Write Modes
- **With Response**: Waits for device acknowledgment (more reliable, slower)
- **Without Response**: Fire-and-forget (faster, less reliable)

### MTU (Maximum Transmission Unit)
- App requests MTU of 512 bytes for better throughput
- Actual MTU negotiated with device may be lower
- Long messages are automatically chunked by the BLE stack

## Examples

### Python GUI Compatibility
The app is fully compatible with the Python BLE GUI (`ble_gui.py`). Both use:
- Same Nordic UART Service UUIDs
- Same ESP32 UUIDs (when using ESP32 mode)
- Same command format
- Same encoding/decoding

### Device Firmware
See `ESP32_BLE_UART_Example.ino` for a complete ESP32 example that:
- Creates BLE UART service
- Responds to commands (1/0/sleep)
- Sends notifications back to app
- Handles connection/disconnection

---

**Enjoy using your BLE devices with the Smart Stim App!** 🚀
