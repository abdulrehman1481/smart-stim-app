# Smart Stim App - Comprehensive Features Guide

This document describes all features implemented in the Smart Stim BLE Controller app, ported from the C# Windows application.

## 🎯 Implemented Features

### 1. **BLE Device Scanning & Connection**
- ✅ Automatic device discovery with RSSI filtering
- ✅ Support for multiple BLE protocols (Nordic UART, ESP32 Custom)
- ✅ Protocol auto-detection during connection
- ✅ Visual device list with protocol badges
- ✅ Connection status indicators
- ✅ **Auto-connect on startup** (connects to last device automatically)
- ✅ **Connection retry logic** (3 attempts with 2-second delays)

### 2. **Console Communication**
#### Message Display
- ✅ Scrollable console with color-coded messages
- ✅ TX messages (sent) in blue
- ✅ RX messages (received) in gray
- ✅ Error messages in red
- ✅ Auto-scroll to latest messages

#### Settings & Options
- ✅ **Local Echo** - Shows sent commands in console
- ✅ **Timestamp** - Adds timestamps to all messages
- ✅ **Clear on Send** - Auto-clears input after sending
- ✅ **Line Ending** - Configurable (NONE, LF, CR, CR+LF)
- ✅ **Write Mode** - With Response or No Response
- ✅ Settings persistence across app restarts

### 3. **Custom Command Buttons**
- ✅ **10 Customizable Buttons** (2 rows of 5 buttons each)
- ✅ Each button configurable with:
  - Custom label/name
  - Command to send
  - Mode: "Send Immediately" or "Just Insert" into input field
- ✅ **Long-press to configure** any button
- ✅ **Tap to execute** configured command
- ✅ Button configurations saved automatically
- ✅ **Export/Import** button configurations to JSON file

### 4. **Data Management**
- ✅ **Save Console Log** - Export entire message history to text file
- ✅ **Clear Console** - Clear all messages
- ✅ **Export Button Config** - Save custom button settings to JSON
- ✅ Automatic timestamp in exported filenames
- ✅ Native share functionality for easy file transfer

### 5. **Settings Persistence**
All settings automatically saved and restored:
- Line ending preference
- Write mode (with/without response)
- Local echo enabled/disabled
- Timestamp enabled/disabled
- Clear on send enabled/disabled
- All 10 custom button configurations
- Last connected device info

### 6. **Smart Connection Management**
- ✅ Auto-scan on startup (5 seconds)
- ✅ Auto-connect to previously connected device
- ✅ Connection retry with exponential backoff
- ✅ Graceful disconnection handling
- ✅ Automatic reconnection on connection loss

## 📱 User Interface

### Device Scanner Tab
```
┌─────────────────────────────────┐
│ 📡 BLE Devices                  │
│ Connected: DeviceName (Nordic)  │
│                                 │
│ Scan for: [Nordic] [ESP32]      │
│ [Scan] [Stop]  or [Disconnect]  │
│                                 │
│ Device List:                    │
│ ├─ DeepSleepDongle (Nordic) ✓   │
│ ├─ ESP32-Device (ESP32)         │
│ └─ Unknown Device               │
└─────────────────────────────────┘
```

### Control Console Tab
```
┌─────────────────────────────────┐
│ 🎮 Control Console  [💾] [🗑️]   │
│ Connected: DeviceName           │
│                                 │
│ Settings:                       │
│ Local Echo: ☑  Timestamp: ☑     │
│ Clear on Send: ☐                │
│ [Line End: CR+LF] [With Resp]   │
│                                 │
│ ┌───────────────────────────┐   │
│ │ Console Messages          │   │
│ │ [12:34:56] >> 1           │   │
│ │ [12:34:57] RX: OK         │   │
│ └───────────────────────────┘   │
│                                 │
│ Custom Commands: [Export Config]│
│ [Btn 1] [Btn 2] [Btn 3] [Btn 4] [Btn 5]│
│ [Btn 6] [Btn 7] [Btn 8] [Btn 9] [Btn10]│
│                                 │
│ [Input Field____________] [Send]│
└─────────────────────────────────┘
```

## 🔧 Usage Guide

### First Time Setup
1. Launch app → Bluetooth auto-initializes
2. Go to "Devices" tab
3. Select protocols to scan (Nordic UART, ESP32, or both)
4. Tap "Scan" to discover devices
5. Tap a device to connect

### Configuring Custom Buttons
1. Go to "Console" tab (must be connected)
2. **Long-press** any custom button
3. Configure:
   - Label: Display name (e.g., "LED ON")
   - Command: Text to send (e.g., "1")
   - Just Insert: ☐ Send immediately OR ☑ Insert into input
4. Tap "Save"

### Using Custom Buttons
- **Short tap**: Execute configured command
- **Long press**: Edit configuration

### Exporting Data
**Console Log:**
- Tap 💾 Save button in header
- Share or save `BLE_Log_YYYYMMDD_HHMMSS.txt`

**Button Configuration:**
- Tap "Export Config" in Custom Commands section
- Share or save `BLE_Buttons_YYYYMMDD_HHMMSS.json`

### Auto-Connect Feature
- App remembers last connected device
- On next launch, automatically scans and connects
- If device not found, shows manual scan option

## 🔌 Supported BLE Protocols

### 1. Nordic UART Service (NUS)
- **Service UUID:** `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- **RX Characteristic:** `6e400002-b5a3-f393-e0a9-e50e24dcca9e`
- **TX Characteristic:** `6e400003-b5a3-f393-e0a9-e50e24dcca9e`
- Used by: nRF52 chips, Nordic development boards

### 2. ESP32 Custom UART
- **Service UUID:** `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- **RX Characteristic:** `beb5483e-36e1-4688-b7f5-ea07361b26a8`
- **TX Characteristic:** `6d68efe5-04b6-4a85-abc4-c2670b7bf7fd`
- Used by: ESP32 development boards with BLE UART examples

## ⚙️ Technical Details

### Dependencies
```json
"@react-native-async-storage/async-storage": "^2.1.0"  // Settings persistence
"expo-file-system": "^18.0.10"                         // File operations
"expo-sharing": "^13.0.0"                              // Share functionality
"react-native-ble-plx": "^3.5.0"                       // BLE communication
"react-native-base64": "^0.2.2"                        // Data encoding
```

### Data Storage
- **AsyncStorage** for all settings and configurations
- **FileSystem** for log and config exports
- All data persists across app restarts

### Connection Reliability
- **Retry Logic:** 3 attempts per connection
- **Retry Delay:** 2 seconds between attempts
- **Connection Timeout:** 10 seconds per attempt
- **MTU Request:** 512 bytes for better throughput
- **Auto-reconnect:** On app launch to last device

## 🐛 Troubleshooting

### Device Not Found
1. Ensure device is powered on and advertising
2. Check device is in range (< 10 meters recommended)
3. Try enabling both protocols in scan filter
4. Restart Bluetooth on phone

### Connection Fails
- App automatically retries 3 times
- Check Bluetooth permissions are granted
- Ensure device isn't connected to another app/phone
- Try manual disconnect and reconnect

### Messages Not Appearing
- Check "Local Echo" is enabled for sent messages
- Verify device is sending data in correct format (UTF-8 text)
- Check console for error messages

### Settings Not Saving
- Ensure app has storage permissions
- Check available device storage
- Try clearing app cache (settings will reset)

## 📊 Comparison with C# Application

| Feature | C# App | React Native App | Status |
|---------|--------|------------------|--------|
| Device Scanning | ✅ | ✅ | ✅ Implemented |
| Connection Management | ✅ | ✅ | ✅ Implemented |
| Auto-connect on Startup | ✅ | ✅ | ✅ Implemented |
| Connection Retry | ❌ | ✅ | ⭐ Enhanced |
| Local Echo | ✅ | ✅ | ✅ Implemented |
| Timestamp | ✅ | ✅ | ✅ Implemented |
| Line Ending Options | ✅ | ✅ | ✅ Implemented |
| 10 Custom Buttons | ✅ | ✅ | ✅ Implemented |
| Button Configuration | ✅ | ✅ | ✅ Implemented |
| Just Insert Mode | ✅ | ✅ | ✅ Implemented |
| Export Buttons | ✅ | ✅ | ✅ Implemented |
| Import Buttons | ✅ | ⚠️ | 🔄 Planned |
| Save Console Log | ✅ | ✅ | ✅ Implemented |
| Settings Persistence | ✅ | ✅ | ✅ Implemented |
| Multi-Protocol Support | ❌ | ✅ | ⭐ Enhanced |
| Write Mode Selection | ❌ | ✅ | ⭐ Enhanced |

## 🚀 Future Enhancements

Potential additions:
- [ ] Import button configurations from JSON file
- [ ] Batch command execution
- [ ] Command history/favorites
- [ ] Data logging to CSV
- [ ] Custom protocol definitions
- [ ] Macros with delays
- [ ] Background scanning

## 📝 Notes

- All settings and button configurations persist across app restarts
- Maximum 10 custom buttons (matches C# app limitation)
- Console messages limited by device memory (auto-clears on restart)
- Export files saved to device's document directory
- Share functionality uses native OS sharing dialog

---

**Version:** 1.0.0  
**Last Updated:** November 2025  
**Platform:** React Native (iOS & Android)
