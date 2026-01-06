# Smart Stim App - Professional BLE Controller

A comprehensive React Native Expo application for controlling BLE-enabled devices via Bluetooth Low Energy (BLE) with support for multiple protocols including Nordic UART Service (NUS) and ESP32 Custom protocols.

## 📋 Table of Contents
- [Features](#-features)
- [Tech Stack](#-tech-stack--dependencies)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Running the App](#-running-the-app)
- [Building APK](#-building-apk-for-production)
- [Architecture](#-architecture)
- [Usage Guide](#-usage-guide)
- [Troubleshooting](#-troubleshooting)
- [Project Structure](#-project-structure)

## 🚀 Features

### Core Functionality
- **Multi-Protocol BLE Support**: Nordic UART Service (NUS) and ESP32 Custom protocols
- **Smart Device Scanning**: Discover nearby BLE devices with RSSI signal strength indicators
- **Auto-Connect**: Automatically connects to last known device on startup
- **Connection Management**: Robust connection with retry logic (3 attempts)
- **Real-time Console**: Bi-directional communication with your BLE device

### Smart Stim Control Panel
- **Comprehensive Stimulation Control**: Full control over electrical stimulation parameters
- **Waveform Visualization**: Real-time plotting of stimulation waveforms
- **Parameter Adjustment**: 
  - Pulse Width (μs)
  - Frequency (Hz)
  - Amplitude (mA)
  - Duration (seconds)
- **Quick Actions**: Start/Stop stimulation with preset patterns

### Wristband Sensors Panel
- **Real-time Sensor Monitoring**: Display data from wristband sensors
- **Data Visualization**: Charts and graphs for sensor data
- **Historical Data**: Track sensor readings over time

### Customizable Console
- **10 Custom Command Buttons**: Configurable quick-action buttons
- **Button Configuration**: Long-press to set custom labels and commands
- **Send Modes**: Immediate send or insert into input field
- **Export/Import Config**: Save and share button configurations as JSON

### Advanced Settings
- ✅ **Local Echo**: Toggle command echo in console
- ✅ **Timestamps**: Add timestamps to all messages
- ✅ **Clear on Send**: Auto-clear input after sending
- ✅ **Line Endings**: Configurable (NONE, LF, CR, CR+LF)
- ✅ **Write Mode**: With Response or No Response
- ✅ **Settings Persistence**: All settings saved automatically

### Data Management
- **Save Console Log**: Export message history to text file
- **Clear Console**: Clear all messages with one tap
- **Export Configurations**: Save custom button settings
- **Share Functionality**: Native share for easy file transfer

## 📱 App Tabs

1. **📡 Devices Tab**: Scan, discover, and connect to BLE devices
2. **⚡ Stim Tab**: Comprehensive stimulation control panel
3. **🌊 Sensors Tab**: Real-time wristband sensor monitoring

## �️ Tech Stack & Dependencies

### Core Framework
- **React Native**: 0.81.5
- **React**: 19.1.0
- **Expo**: ~54.0.20
- **TypeScript**: ~5.9.2

### BLE Communication
- **react-native-ble-plx**: ^3.5.0 - Bluetooth Low Energy communication
- **react-native-base64**: ^0.2.2 - Base64 encoding/decoding for BLE data
- **expo-device**: ^8.0.9 - Device information and capabilities

### UI & Visualization
- **react-native-svg**: ^15.14.0 - SVG rendering for graphics
- **react-native-chart-kit**: ^6.12.0 - Charts and graphs for sensor data
- **tailwindcss**: ^3.4.18 - Utility-first CSS framework

### Storage & File System
- **@react-native-async-storage/async-storage**: ^2.1.0 - Persistent local storage
- **expo-file-system**: ^18.0.10 - File system access
- **expo-sharing**: ^13.0.0 - Native share functionality

### Development Tools
- **@types/react**: ~19.1.0 - TypeScript types for React
- **babel-preset-expo**: ^54.0.6 - Babel preset for Expo
- **postcss**: ^8.5.6 - CSS processing

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required
- **Node.js**: v18 or higher ([Download](https://nodejs.org/))
- **npm** or **yarn**: Comes with Node.js
- **Expo CLI**: Install globally with `npm install -g expo-cli`

### For Android Development
- **Android Studio**: ([Download](https://developer.android.com/studio))
- **Android SDK**: API Level 33 or higher
- **Java Development Kit (JDK)**: Version 17 or higher

### For iOS Development (Mac only)
- **Xcode**: Latest version from Mac App Store
- **CocoaPods**: Install with `sudo gem install cocoapods`
- **iOS Simulator**: Included with Xcode

### Physical Device Requirements
- **Android**: Android 6.0 (API 23) or higher with BLE support
- **iOS**: iOS 13.0 or higher with BLE support
- **Bluetooth**: Device must have Bluetooth 4.0 (BLE) capability

## 💻 Installation

### 1. Clone or Download the Repository

```bash
# If cloning from git
git clone <repository-url>
cd smart-stim-app

# Or simply navigate to the project folder
cd smart-stim-app
```

### 2. Install Dependencies

```bash
npm install
```

This will install all dependencies listed in `package.json`.

### 3. Configure Android Environment (First Time Setup)

Set up your Android environment variables:

**Windows (PowerShell)**:
```powershell
$env:ANDROID_HOME = "C:\Users\YourUsername\AppData\Local\Android\Sdk"
$env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools"
```

**Mac/Linux**:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools
```

### 4. Prebuild Native Code

Since the app uses native BLE modules, you need to generate native code:

```bash
npx expo prebuild
```

This creates the `android/` and `ios/` directories with native code.

## 🚀 Running the App

### Option 1: Development Build on Physical Device (Recommended)

**IMPORTANT**: This app CANNOT run on Expo Go due to native BLE module requirements.

#### Android:

```bash
# Connect your Android device via USB or ensure it's on the same network
# Enable USB Debugging in Developer Options

# Run the development build
npx expo run:android
```

Or use the npm script:
```bash
npm run android
```

#### iOS (Mac only):

```bash
npx expo run:ios
```

Or use the npm script:
```bash
npm run ios
```

### Option 2: Android Emulator

```bash
# Start Android Studio AVD (Android Virtual Device) first
# Then run:
npx expo run:android
```

**Note**: Emulator has limited BLE capabilities. Physical device recommended.

### Option 3: Start Expo Dev Server

```bash
npm start
# or
expo start
```

Then press:
- `a` for Android
- `i` for iOS

### Clean Start (If Issues Occur)

```bash
npm run clean
# or
expo start --clear
```

## 📦 Building APK for Production

### Step 1: Build Release APK Locally

#### Method 1: Using Expo (Easiest)

```bash
# Build optimized APK
npx expo build:android -t apk
```

This creates an optimized APK that can be distributed.

#### Method 2: Using Gradle Directly

```bash
# Navigate to android directory
cd android

# Build release APK
.\gradlew assembleRelease

# APK will be located at:
# android/app/build/outputs/apk/release/app-release.apk
```

**Windows PowerShell**:
```powershell
cd android
.\gradlew.bat assembleRelease
cd ..
```

**Mac/Linux**:
```bash
cd android
./gradlew assembleRelease
cd ..
```

### Step 2: Generate Signed APK (For Play Store)

#### Create a Keystore (First Time Only)

```bash
keytool -genkeypair -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted to enter:
- Keystore password
- Key password
- Your name, organization, etc.

#### Configure Gradle for Signing

Create `android/gradle.properties` or add to existing:

```properties
MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=my-key-alias
MYAPP_RELEASE_STORE_PASSWORD=your-keystore-password
MYAPP_RELEASE_KEY_PASSWORD=your-key-password
```

#### Build Signed APK

```bash
cd android
.\gradlew assembleRelease
```

Signed APK location: `android/app/build/outputs/apk/release/app-release.apk`

### Step 3: Find Your APK

**PowerShell command to locate APK**:
```powershell
Get-ChildItem -Path ".\android\app\build\outputs\apk\release" -Filter "*.apk" | Select-Object FullName, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}
```

Typical APK size: 40-60 MB

### Step 4: Install APK on Device

#### Via USB (ADB):

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

#### Via File Transfer:
1. Copy APK to your phone
2. Open file manager on phone
3. Tap the APK file
4. Allow installation from unknown sources if prompted
5. Install the app

### APK Distribution

You can share the APK file via:
- Email
- Cloud storage (Google Drive, Dropbox)
- Direct file transfer
- QR code with download link

**APK File Path**:
```
android/app/build/outputs/apk/release/app-release.apk
```

## 🏗️ Architecture

### Project Structure

```
smart-stim-app/
├── src/
│   ├── components/
│   │   ├── DeviceScanner.tsx           # BLE device scanning & connection UI
│   │   ├── ControlConsole.tsx          # Command console & messaging (legacy)
│   │   ├── SmartStimPanel.tsx          # Stimulation control interface
│   │   ├── ComprehensiveStimPanel.tsx  # Advanced stim control with waveforms
│   │   ├── WristbandSensorsPanel.tsx   # Sensor monitoring UI
│   │   └── WaveformPlot.tsx            # Real-time waveform visualization
│   │
│   ├── functionality/
│   │   ├── BLEService.ts               # Core BLE communication layer
│   │   ├── BLEContext.tsx              # React Context for BLE state
│   │   ├── BLEProtocols.ts             # Protocol definitions (NUS, ESP32)
│   │   └── SmartStimCommands.ts        # Stimulation command builders
│   │
│   └── types/
│       └── react-native-base64.d.ts    # TypeScript definitions
│
├── android/                             # Android native code
├── assets/                              # App icons and images
├── App.tsx                              # Main app component with tabs
├── app.json                             # Expo configuration
├── package.json                         # Dependencies and scripts
└── tsconfig.json                        # TypeScript configuration
```

### BLE Protocol Implementation

#### Nordic UART Service (NUS)
- **Service UUID**: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- **RX Characteristic** (Write): `6e400002-b5a3-f393-e0a9-e50e24dcca9e`
- **TX Characteristic** (Notify): `6e400003-b5a3-f393-e0a9-e50e24dcca9e`

#### ESP32 Custom Protocol
- **Service UUID**: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- **RX Characteristic**: `beb5483e-36e1-4688-b7f5-ea07361b26a8`
- **TX Characteristic**: `beb5483f-36e1-4688-b7f5-ea07361b26a8`

#### Protocol Auto-Detection
The app automatically detects which protocol your device uses during connection.

## � Usage Guide

### First Time Setup

1. **Enable Bluetooth** on your phone
2. **Grant Permissions** when prompted:
   - Bluetooth access
   - Location access (required for BLE scanning on Android)
3. **Power on your BLE device** (Smart Stim hardware)

### Connecting to Your Device

#### Step 1: Scan for Devices
1. Open the app
2. Navigate to the **📡 Devices** tab
3. Tap the **"🔍 Start Scan"** button
4. Wait 10 seconds for devices to appear
5. Your device will be listed with:
   - Device name
   - RSSI signal strength
   - Protocol badge (NUS or ESP32)
   - ⭐ star for preferred devices

#### Step 2: Connect
1. Tap on your device from the list
2. Wait for connection (automatic retry if needed)
3. Status will show **"Connected to [device name]"**
4. Green indicator shows active connection

#### Step 3: Automatic Reconnection
- App remembers last connected device
- Automatically attempts reconnection on next launch
- Manual reconnection available if automatic fails

### Using the Stim Control Panel

#### Basic Stimulation Control

1. Navigate to **⚡ Stim** tab
2. Adjust parameters:
   - **Pulse Width**: 100-500 μs
   - **Frequency**: 1-100 Hz
   - **Amplitude**: 0-20 mA
   - **Duration**: 1-60 seconds

3. Tap **"Start Stimulation"** to begin
4. Tap **"Stop Stimulation"** to end
5. View waveform in real-time

#### Advanced Features
- **Preset Patterns**: Quick selection of common stim patterns
- **Waveform Visualization**: See pulse shape and timing
- **Safety Limits**: Built-in parameter validation
- **Emergency Stop**: Always accessible

### Console Communication

#### Sending Commands

**Method 1: Quick Action Buttons**
- Use the 10 customizable buttons for frequent commands
- Tap any button to send its configured command
- Buttons arranged in 2 rows of 5

**Method 2: Manual Input**
1. Type command in text input field
2. Press **"Send"** button or enter
3. Command is sent to device
4. Response appears in console

**Method 3: Long-Press Configuration**
1. Long-press any custom button
2. Configure:
   - Button label (e.g., "LED ON")
   - Command to send (e.g., "LED:1")
   - Send mode (immediate or insert)
3. Tap **"Save"**

#### Reading Responses
- **Blue messages (right)**: Commands you sent
- **Gray messages (left)**: Device responses
- **Red messages**: Errors
- Auto-scroll keeps latest messages visible
- Timestamps show when each message was sent/received

#### Console Settings

Access settings via gear icon:
- **Local Echo**: Show sent commands in console
- **Timestamp**: Add time to all messages
- **Clear on Send**: Auto-clear input after sending
- **Line Ending**: 
  - NONE: No line ending
  - LF: Line Feed (\n)
  - CR: Carriage Return (\r)
  - CR+LF: Both (\r\n)
- **Write Mode**:
  - With Response: Wait for acknowledgment
  - No Response: Fire and forget

### Sensor Monitoring

1. Navigate to **🌊 Sensors** tab
2. View real-time sensor data:
   - Heart rate
   - Skin conductance
   - Temperature
   - Accelerometer data
3. Historical charts show trends
4. Export data for analysis

### Data Management

#### Saving Console Log
1. Tap **"💾 Save Log"** button
2. Choose save location or share
3. File saved as `console_log_YYYYMMDD_HHMMSS.txt`
4. Contains all messages with timestamps

#### Exporting Button Configuration
1. Tap **"📤 Export Config"** button
2. JSON file created with all button settings
3. Share via email, cloud, etc.
4. File: `button_config_YYYYMMDD_HHMMSS.json`

#### Importing Button Configuration
1. Have JSON config file ready
2. Tap **"📥 Import Config"** button
3. Select file
4. All buttons updated automatically

#### Clearing Console
1. Tap **"🗑️ Clear"** button
2. Confirm deletion
3. All messages removed (cannot be undone)

### Disconnecting

1. Go to **📡 Devices** tab
2. Tap **"Disconnect"** button
3. Connection terminated safely
4. Can reconnect anytime

## 🔍 Troubleshooting

### App Installation Issues

**Problem**: "Parse error" or "App not installed"
- **Solution**: Enable "Install from Unknown Sources" in Android settings
- **Solution**: Ensure APK is not corrupted, try re-downloading

**Problem**: App crashes on launch
- **Solution**: Clear app data and cache
- **Solution**: Reinstall the app
- **Solution**: Check Android version (minimum API 23 / Android 6.0)

### BLE Connection Issues

**Problem**: Can't find any devices
- ✅ Ensure Bluetooth is enabled on phone
- ✅ Grant location permissions (required for BLE on Android)
- ✅ Make sure device is powered on and advertising
- ✅ Move closer to the device (within 10 meters)
- ✅ Restart Bluetooth on phone
- ✅ Check if device is already connected to another phone/app

**Problem**: Device found but won't connect
- ✅ Verify device is not connected elsewhere (check nRF Connect)
- ✅ Power cycle your BLE device
- ✅ Restart Bluetooth on phone
- ✅ Restart the app
- ✅ Clear app data and try again
- ✅ Check device firmware is compatible

**Problem**: Connects but immediately disconnects
- ✅ Check device battery level
- ✅ Ensure device firmware is stable
- ✅ Move phone closer to device
- ✅ Disable Bluetooth on other nearby devices
- ✅ Check for interference from WiFi routers

**Problem**: Connected but no data received
- ✅ Verify device is sending notifications on TX characteristic
- ✅ Check that data is properly encoded (UTF-8)
- ✅ Test device with nRF Connect app to verify it's working
- ✅ Enable Local Echo to see if commands are being sent
- ✅ Check console settings (line endings, write mode)

### Development Build Issues

**Problem**: "Expo Go is not supported"
- **Solution**: This app requires a development build, not Expo Go
- **Solution**: Run `npx expo run:android` to create development build

**Problem**: "Metro bundler connection failed"
- **Solution**: Ensure phone and computer are on same network
- **Solution**: Run `npm start -- --clear` to clear cache
- **Solution**: Check firewall settings

**Problem**: "Native module cannot be null"
- **Solution**: Run `npx expo prebuild` to generate native code
- **Solution**: Delete `android/` and `ios/` folders, then run prebuild again
- **Solution**: Reinstall dependencies: `rm -rf node_modules && npm install`

### Build/Gradle Issues

**Problem**: "Could not find SDK"
- **Solution**: Set ANDROID_HOME environment variable correctly
- **Solution**: Install Android SDK through Android Studio

**Problem**: Gradle build fails
- **Solution**: Clean gradle cache: `cd android && .\gradlew clean`
- **Solution**: Update gradle wrapper: `cd android && .\gradlew wrapper --gradle-version=8.0.2`
- **Solution**: Check JDK version (needs JDK 17)

**Problem**: "Duplicate resources"
- **Solution**: Clean build: `cd android && .\gradlew clean`
- **Solution**: Delete `android/app/build` folder and rebuild

### Runtime Errors

**Problem**: App freezes or becomes unresponsive
- **Solution**: Force close and restart app
- **Solution**: Disconnect and reconnect BLE device
- **Solution**: Clear app cache

**Problem**: Commands not being sent
- **Solution**: Check BLE connection status
- **Solution**: Verify line ending settings match device expectations
- **Solution**: Try different write mode (with/without response)

**Problem**: Waveform not displaying
- **Solution**: Check stimulation parameters are valid
- **Solution**: Ensure device is sending proper data format
- **Solution**: Restart app

### Testing Without Hardware

If you don't have physical BLE hardware:

1. **Use nRF Connect Simulator** (Nordic Semiconductor)
   - Download nRF Connect for Desktop
   - Use "Bluetooth Low Energy" app
   - Advertise a device with NUS service

2. **Use Another Phone as Peripheral**
   - Install BLE peripheral simulator app
   - Configure NUS service
   - Test connection

3. **Arduino/ESP32 with NUS Firmware**
   - Flash Nordic UART Service example
   - Use as test device

## 🔐 Security & Permissions

### Android Permissions Required

#### Bluetooth Permissions (Android 12+)
- `BLUETOOTH_SCAN` - Discover BLE devices
- `BLUETOOTH_CONNECT` - Connect to devices
- `BLUETOOTH_ADMIN` - Manage connections

#### Location Permission
- `ACCESS_FINE_LOCATION` - Required for BLE scanning
- `ACCESS_COARSE_LOCATION` - Fallback location access

**Note**: Location is required by Android for BLE scanning, even though the app doesn't use GPS. This is an Android system requirement.

### iOS Permissions Required

- `NSBluetoothAlwaysUsageDescription` - Bluetooth access
- `NSBluetoothPeripheralUsageDescription` - BLE peripheral access

### Privacy Notes

- ✅ No data sent to external servers
- ✅ All communication is local (phone ↔ BLE device)
- ✅ No internet connection required
- ✅ Saved logs stored locally on device
- ✅ No user tracking or analytics
- ✅ No account or login required

## 🎓 Additional Documentation

For more detailed information, see:

- **[FEATURES.md](FEATURES.md)** - Comprehensive feature list
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Testing procedures
- **[SMART_STIM_HARDWARE.md](SMART_STIM_HARDWARE.md)** - Hardware specifications
- **[SMART_STIM_INTEGRATION.md](SMART_STIM_INTEGRATION.md)** - Integration guide
- **[WAVEFORM_PLOTTING.md](WAVEFORM_PLOTTING.md)** - Waveform visualization details

## 🧪 Testing the App

### With Physical Hardware

1. Flash your device with NUS-compatible firmware
2. Ensure device advertises with correct service UUID
3. Power on and keep within 10 meters
4. Follow connection steps in Usage Guide

### With nRF Connect (No Hardware Needed)

1. Install nRF Connect on another phone/tablet
2. Go to "Advertiser" tab
3. Create new advertising packet:
   - Add NUS service UUID: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
   - Add device name
4. Start advertising
5. Use your Smart Stim app to connect

## 📊 Performance Considerations

- **APK Size**: ~40-60 MB
- **RAM Usage**: ~80-150 MB during operation
- **Battery Impact**: Moderate (BLE is power-efficient)
- **Minimum Android**: API 23 (Android 6.0)
- **Minimum iOS**: iOS 13.0
- **BLE Version**: Bluetooth 4.0 (BLE) or higher

## 🔄 Update & Maintenance

### Updating Dependencies

```bash
npm update
npm audit fix
```

### Checking for Outdated Packages

```bash
npm outdated
```

### Upgrading Expo SDK

```bash
npx expo upgrade
```

## 🤝 Contributing

When contributing to this project:

1. Follow TypeScript best practices
2. Test on both Android and iOS if possible
3. Update documentation for new features
4. Ensure BLE communication remains stable
5. Test with physical hardware when possible

## 📝 Scripts Reference

```json
{
  "start": "expo start",                    // Start dev server
  "android": "expo run:android",            // Run on Android
  "ios": "expo run:ios",                    // Run on iOS
  "web": "expo start --web",                // Run in browser (limited BLE)
  "build:android": "expo run:android",      // Build Android
  "build:ios": "expo run:ios",              // Build iOS
  "prebuild": "expo prebuild",              // Generate native code
  "clean": "expo start --clear"             // Clear cache and start
}
```

## 🆘 Getting Help

### Resources

- **React Native BLE PLX**: [GitHub Docs](https://github.com/dotintent/react-native-ble-plx)
- **Nordic UART Service**: [Specification](https://developer.nordicsemi.com/nRF_Connect_SDK/doc/latest/nrf/libraries/bluetooth_services/services/nus.html)
- **Expo Documentation**: [Expo Docs](https://docs.expo.dev/)
- **React Native Docs**: [React Native](https://reactnative.dev/)

### Common Commands for Quick Reference

```bash
# Start development
npm start

# Run on Android device
npm run android

# Build APK
cd android && .\gradlew assembleRelease

# Find APK
Get-ChildItem -Path ".\android\app\build\outputs\apk\release" -Filter "*.apk"

# Install APK via ADB
adb install android/app/build/outputs/apk/release/app-release.apk

# Clear cache
npm run clean

# Reinstall dependencies
rm -rf node_modules && npm install

# Prebuild native code
npx expo prebuild
```

## 📄 License

This project is part of the Smart Stim application suite.

## 👨‍💻 Developer Notes

- App uses Expo SDK 54 with new architecture enabled
- TypeScript strict mode enabled
- BLE communication runs on native thread for performance
- All settings persisted using AsyncStorage
- File operations use Expo FileSystem API
- Share functionality uses native share dialog

---

## 📞 Support & Contact

For issues, questions, or contributions:
1. Check the troubleshooting section above
2. Review documentation files in the project
3. Test with nRF Connect to isolate hardware vs software issues
4. Check console logs for detailed error messages

---

**Built with ❤️ using React Native & Expo**

**Happy Stimulating! ⚡**
