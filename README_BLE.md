# Smart Stim App - Bluetooth BLE Controller

A React Native Expo app for controlling your PCB/board via Bluetooth Low Energy (BLE) using the Nordic UART Service (NUS) protocol.

## 🚀 Features

- **Device Scanning**: Discover nearby BLE devices with RSSI signal strength
- **Nordic UART Service (NUS)**: Full implementation of NUS protocol for serial communication
- **Real-time Console**: Send commands and receive responses from your device
- **Quick Commands**: Pre-configured buttons for common commands (1, 0, sleep)
- **Connection Management**: Easy connect/disconnect with status indicators
- **Cross-Platform**: Works on both iOS and Android

## 📱 Screenshots

The app has two main tabs:
1. **Devices Tab**: Scan for and connect to BLE devices
2. **Console Tab**: Send commands and view device responses

## 🔧 Technical Implementation

### Architecture

```
src/
├── components/
│   ├── DeviceScanner.tsx    # BLE device scanning and connection UI
│   └── ControlConsole.tsx   # Command console and messaging UI
└── functionality/
    ├── BLEService.ts        # Core BLE communication service
    └── BLEContext.tsx       # React Context for state management
```

### Nordic UART Service (NUS)

The app implements the standard Nordic UART Service UUIDs:
- **Service UUID**: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- **RX Characteristic** (Write): `6e400002-b5a3-f393-e0a9-e50e24dcca9e`
- **TX Characteristic** (Notify): `6e400003-b5a3-f393-e0a9-e50e24dcca9e`

### Key Libraries

- `react-native-ble-plx`: BLE communication
- `expo-device`: Device information
- `react-native-base64`: Data encoding/decoding

## 🛠️ Setup Instructions

### 1. Install Dependencies

Already done! The following packages are installed:
- react-native-ble-plx
- expo-device
- react-native-base64

### 2. Configure Expo Development Build

Since BLE requires native modules, you need to create a development build:

```bash
# Install expo-dev-client (if not already installed)
npm install expo-dev-client

# For Android
npx expo run:android

# For iOS (requires Mac)
npx expo run:ios
```

**Note**: The standard `expo go` app does NOT support react-native-ble-plx. You MUST use a development build.

### 3. Permissions

Permissions are already configured in `app.json`:

**Android**:
- BLUETOOTH
- BLUETOOTH_ADMIN
- BLUETOOTH_CONNECT (Android 12+)
- BLUETOOTH_SCAN (Android 12+)
- ACCESS_FINE_LOCATION

**iOS**:
- NSBluetoothAlwaysUsageDescription
- NSBluetoothPeripheralUsageDescription

## 🎮 How to Use

### Step 1: Scan for Devices
1. Open the app
2. Navigate to the "📡 Devices" tab
3. Tap the "Scan" button
4. Wait for devices to appear (10 seconds)
5. Your "DeepSleepDongle" device will be highlighted with a ⭐

### Step 2: Connect
1. Tap on your device from the list
2. Wait for connection to complete
3. Status will show "Connected to [device name]"

### Step 3: Send Commands
1. Switch to the "🎮 Console" tab
2. Use quick command buttons:
   - **Send '1'**: Green button
   - **Send '0'**: Red button
   - **Sleep**: Purple button
3. Or type custom commands in the text input and press "Send"

### Step 4: View Responses
- All sent commands appear in blue on the right
- Received data appears in gray on the left
- Errors appear in red
- Timestamps are included with each message

### Step 5: Disconnect
1. Go back to the "📡 Devices" tab
2. Tap the "Disconnect" button

## 🔍 Troubleshooting

### App Won't Start
- Make sure you're using a development build, NOT Expo Go
- Run `npx expo prebuild` to generate native code
- Rebuild the app with `npx expo run:android` or `npx expo run:ios`

### Can't Find Devices
- Ensure Bluetooth is enabled on your phone
- Grant location permissions (required for BLE scanning on Android)
- Make sure your device is advertising with the NUS service
- Try moving closer to the device

### Connection Fails
- Verify your device is not connected to another app (like nRF Connect)
- Restart Bluetooth on your phone
- Power cycle your BLE device
- Check that your device implements the Nordic UART Service correctly

### No Data Received
- Verify your device is sending notifications on the TX characteristic
- Check that data is properly encoded as UTF-8
- Use a BLE debugging app (like nRF Connect) to verify your device is working

## 📝 Customization

### Change Preferred Device Name
Edit `src/functionality/BLEService.ts`:
```typescript
export const PREFERRED_DEVICE_NAME = 'YourDeviceName';
```

### Add More Quick Commands
Edit `src/components/ControlConsole.tsx` and add more buttons in the `quickActions` section.

### Modify Command Format
By default, commands are sent with a newline `\n` suffix. To change this, edit the `sendCommand` function in `src/functionality/BLEContext.tsx`.

## 🔐 Security Notes

- The app requests location permissions (required for BLE scanning on Android)
- Bluetooth permissions are requested at runtime
- No data is sent to external servers
- All communication is local between your phone and the BLE device

## 🚦 Testing Without Hardware

To test the app without a physical BLE device:
1. Use a BLE simulator app on another phone
2. Use a Nordic nRF52 development board with Nordic UART Service firmware
3. Use a software BLE peripheral simulator on your computer

## 📚 Additional Resources

- [react-native-ble-plx Documentation](https://github.com/dotintent/react-native-ble-plx)
- [Nordic UART Service Specification](https://developer.nordicsemi.com/nRF_Connect_SDK/doc/latest/nrf/libraries/bluetooth_services/services/nus.html)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)

## 🆘 Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify your device firmware implements NUS correctly
3. Test with nRF Connect app to ensure your device is discoverable
4. Review the BLE service implementation in `src/functionality/BLEService.ts`

## 📄 License

This project is part of the Smart Stim application.

---

**Happy Controlling! ⚡**
