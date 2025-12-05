# Testing Checklist for Smart Stim App

## Pre-Testing Setup
- [ ] Install app on physical Android device (BLE requires real hardware)
- [ ] Grant all Bluetooth permissions
- [ ] Ensure BLE device is powered on and advertising
- [ ] Have device within range (< 5 meters for testing)

## 🔍 Test 1: Basic BLE Functionality

### Device Scanning
- [ ] Launch app, navigate to "Devices" tab
- [ ] Verify Bluetooth status shows "✓ Bluetooth ready"
- [ ] Select protocol filters (try Nordic UART first)
- [ ] Tap "Scan" button
- [ ] Verify devices appear in list
- [ ] Check preferred devices show protocol badge
- [ ] Tap "Stop" to stop scanning

### Connection
- [ ] Tap a discovered device
- [ ] Verify "Connecting..." status appears
- [ ] Wait for connection (should retry up to 3 times if needed)
- [ ] Verify connected status shows device name and protocol
- [ ] Check "Disconnect" button appears
- [ ] Disconnect and verify disconnection

## 🎮 Test 2: Console Communication

### Basic Messaging
- [ ] Connect to device
- [ ] Navigate to "Console" tab
- [ ] Type "1" in input field and tap Send
- [ ] Verify message sent (check device response)
- [ ] Receive message from device
- [ ] Verify RX message appears in console

### Settings - Local Echo
- [ ] Enable "Local Echo" toggle
- [ ] Send a command
- [ ] Verify sent command appears in console with ">>" prefix
- [ ] Disable local echo
- [ ] Send command
- [ ] Verify sent command does NOT appear in console

### Settings - Timestamp
- [ ] Enable "Timestamp" toggle
- [ ] Send/receive messages
- [ ] Verify all messages have [HH:MM:SS] prefix
- [ ] Disable timestamp
- [ ] Verify messages have no timestamp

### Settings - Clear on Send
- [ ] Type text in input field
- [ ] Enable "Clear on Send"
- [ ] Send message
- [ ] Verify input field is cleared automatically
- [ ] Disable "Clear on Send"
- [ ] Send message
- [ ] Verify text remains in field

### Settings - Line Ending
- [ ] Tap "Line End" button to cycle through:
  - NONE
  - LF
  - CR
  - CR+LF
- [ ] Send test command with each setting
- [ ] Verify device receives correct line ending

### Settings - Write Mode
- [ ] Tap write mode button
- [ ] Toggle between "With Response" and "No Response"
- [ ] Send messages with each mode
- [ ] Verify both modes work

## 🎯 Test 3: Custom Buttons

### Button Configuration
- [ ] Long-press "Button 1"
- [ ] Configuration modal should appear
- [ ] Set Label: "LED ON"
- [ ] Set Command: "1"
- [ ] Keep "Just Insert" unchecked
- [ ] Tap "Save"
- [ ] Verify button label changed to "LED ON"

### Button Execution - Send Mode
- [ ] Tap "LED ON" button (short tap)
- [ ] Verify command "1" is sent immediately
- [ ] Check device response

### Button Configuration - Insert Mode
- [ ] Long-press "Button 2"
- [ ] Set Label: "LED OFF"
- [ ] Set Command: "0"
- [ ] Enable "Just Insert" toggle
- [ ] Tap "Save"
- [ ] Tap "LED OFF" button
- [ ] Verify "0" appears in input field (NOT sent)
- [ ] Tap Send to actually send

### Configure All 10 Buttons
- [ ] Configure each of the 10 buttons
- [ ] Verify all configurations save
- [ ] Test each button works correctly

### Export Button Configuration
- [ ] Tap "Export Config" in Custom Commands
- [ ] Verify share dialog appears
- [ ] Save or share JSON file
- [ ] Open file to verify JSON format correct

## 💾 Test 4: Data Management

### Save Console Log
- [ ] Send and receive multiple messages
- [ ] Tap 💾 Save button in header
- [ ] Verify share dialog appears
- [ ] Save log file
- [ ] Open file and verify all messages present
- [ ] Check timestamp in filename

### Clear Console
- [ ] Tap 🗑️ Clear button
- [ ] Verify all messages cleared
- [ ] Verify empty state message appears

## 🔄 Test 5: Settings Persistence

### Close and Reopen App
- [ ] Configure all settings:
  - Enable Local Echo
  - Enable Timestamp
  - Set Line Ending to CR+LF
  - Set Write Mode to No Response
- [ ] Configure 2-3 custom buttons
- [ ] Close app completely (swipe from recents)
- [ ] Reopen app
- [ ] Verify all settings restored correctly
- [ ] Verify custom buttons still configured

## 🚀 Test 6: Auto-Connect

### First Connection
- [ ] Fresh app install or clear data
- [ ] Connect to a device manually
- [ ] Note device name
- [ ] Disconnect
- [ ] Close app

### Auto-Connect Test
- [ ] Ensure BLE device is on and advertising
- [ ] Launch app
- [ ] Wait 5-10 seconds
- [ ] Verify app automatically scans
- [ ] Verify app auto-connects to last device
- [ ] Check console shows connection message

### Auto-Connect When Device Not Available
- [ ] Turn off BLE device
- [ ] Launch app
- [ ] Verify app attempts scan
- [ ] Verify shows message "Last device not found"
- [ ] Verify can manually scan

## 🔧 Test 7: Connection Retry

### Test Retry Logic
- [ ] Find device with weak signal (far away)
- [ ] Attempt to connect
- [ ] Observe retry attempts (should see 3 attempts)
- [ ] Verify 2-second delay between retries
- [ ] Verify error message after all attempts fail

### Test Successful Retry
- [ ] Position device at edge of range
- [ ] Attempt connection
- [ ] If first attempt fails, watch for successful retry
- [ ] Verify connection establishes eventually

## 📱 Test 8: Multi-Protocol Support

### Nordic UART
- [ ] Scan with only "Nordic" protocol selected
- [ ] Verify only Nordic UART devices appear
- [ ] Connect to Nordic device
- [ ] Verify communication works

### ESP32 Custom
- [ ] Scan with only "ESP32" protocol selected
- [ ] Verify only ESP32 devices appear
- [ ] Connect to ESP32 device
- [ ] Verify communication works

### Both Protocols
- [ ] Select both protocols
- [ ] Scan
- [ ] Verify devices from both protocols appear
- [ ] Verify protocol badges show correctly

## 🐛 Test 9: Error Handling

### Bluetooth Off
- [ ] Turn off Bluetooth on phone
- [ ] Launch app
- [ ] Verify warning message appears
- [ ] Turn Bluetooth back on
- [ ] Verify app recovers

### Permissions Denied
- [ ] Deny Bluetooth permissions
- [ ] Attempt to scan
- [ ] Verify permission error message
- [ ] Grant permissions
- [ ] Verify scan works

### Device Out of Range
- [ ] Connect to device
- [ ] Move device far away
- [ ] Verify disconnection detected
- [ ] Verify error message shown

### Rapid Connect/Disconnect
- [ ] Connect to device
- [ ] Immediately tap Disconnect
- [ ] Tap Connect again quickly
- [ ] Repeat several times
- [ ] Verify app handles gracefully

## ✅ Test 10: Complete User Flow

### End-to-End Scenario
- [ ] Fresh app launch
- [ ] Scan for devices
- [ ] Connect to preferred device
- [ ] Configure 3 custom buttons
- [ ] Enable all settings (echo, timestamp, etc.)
- [ ] Send various commands
- [ ] Use custom buttons
- [ ] Save console log
- [ ] Export button config
- [ ] Disconnect
- [ ] Close app
- [ ] Relaunch app
- [ ] Verify auto-connects
- [ ] Verify all settings persisted
- [ ] Continue communication

## 📊 Performance Checks

- [ ] App startup time < 3 seconds
- [ ] Scan finds devices within 5 seconds
- [ ] Connection completes within 10 seconds (or retries)
- [ ] Messages appear in console immediately
- [ ] UI remains responsive during scanning
- [ ] No crashes or freezes
- [ ] Battery usage reasonable

## 📝 Test Results Summary

Date: _______________
Tester: _______________

**Passed:** _____ / Total Tests
**Failed:** _____ / Total Tests
**Blocked:** _____ / Total Tests

### Critical Issues Found:
1. _______________________________
2. _______________________________
3. _______________________________

### Minor Issues Found:
1. _______________________________
2. _______________________________
3. _______________________________

### Notes:
_________________________________
_________________________________
_________________________________

---

## Testing Tips

1. **Use Real Device:** BLE requires physical hardware
2. **Test Range:** Try different distances (1m, 5m, 10m)
3. **Test Duration:** Run app for 30+ minutes to check stability
4. **Multiple Devices:** Test with different BLE devices
5. **Low Battery:** Test behavior when phone battery < 20%
6. **Background/Foreground:** Test app switching
7. **Interruptions:** Test incoming calls, notifications
8. **Airplane Mode:** Test Bluetooth-only mode

## Known Limitations

- Import button config not yet implemented
- Console messages clear on app restart (by design)
- Maximum 10 custom buttons
- No command history/autocomplete (yet)
