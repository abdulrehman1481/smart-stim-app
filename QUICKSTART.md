# Quick Start Guide - Smart Stim BLE Controller

## 🚀 Getting Started (5 Minutes)

### Prerequisites
✅ Node.js installed (v16+)  
✅ Android Studio OR Xcode (for device deployment)  
✅ Physical Android/iOS device with BLE support  
✅ USB cable for device connection  
✅ BLE device to connect to (e.g., DeepSleepDongle, ESP32)

### Step 1: Install Dependencies
```bash
cd d:\job\app\smart-stim-app
npm install
```

### Step 2: Enable Developer Mode on Phone
**Android:**
1. Settings → About Phone
2. Tap "Build Number" 7 times
3. Settings → Developer Options → Enable USB Debugging

**iOS:**
1. Settings → Privacy & Security → Developer Mode → ON
2. Restart device

### Step 3: Connect Phone to Computer
```bash
# Verify device connected (Android)
adb devices

# Should show:
# List of devices attached
# XXXXXXXXXX    device
```

### Step 4: Enable Wireless Debugging (Android - Optional)
```bash
# If you want wireless connection, run:
.\connect-phone.ps1
```
See `WIRELESS_DEBUGGING_GUIDE.md` for details.

### Step 5: Run the App
```bash
# Start Metro bundler
npm start

# In another terminal, deploy to Android
npm run android

# OR for iOS (Mac only)
npm run ios
```

### Step 6: Grant Permissions
When app launches:
1. Allow Bluetooth permissions
2. Allow Location permissions (required for BLE scanning on Android)
3. Allow File access (for exports)

## 📱 First Connection

### Connect to BLE Device
1. Launch app
2. Go to "📡 Devices" tab
3. Select protocols (e.g., "Nordic")
4. Tap **Scan** button
5. Wait for device to appear (5-10 seconds)
6. Tap your device name to connect
7. Wait for "Connected" status

### Send First Command
1. Go to "🎮 Console" tab
2. Type "1" in input field
3. Tap **Send**
4. Watch for device response in console

### Configure Custom Button
1. **Long-press** any purple button (e.g., "Button 1")
2. Configuration dialog appears
3. Set **Label:** "LED ON"
4. Set **Command:** "1"
5. Leave "Just Insert" unchecked
6. Tap **Save**
7. Now tap "LED ON" button to send command

## 🎛️ Quick Feature Tour

### Settings Panel (Console Tab)
```
Toggle ON:
☑ Local Echo     - See what you send
☑ Timestamp      - Add time to messages
☐ Clear on Send  - Auto-clear input

Tap to cycle:
[Line End: CR+LF]      - Change line endings
[With Response]        - Change write mode
```

### Export Your Work
- **💾 Save** button: Export console log
- **Export Config** button: Export custom buttons

### Auto-Connect
After first connection:
1. Close app
2. Relaunch app
3. App automatically scans and connects!

## 🐛 Troubleshooting

### Problem: No devices found
**Solution:**
- Ensure BLE device is ON and advertising
- Check device is in range (< 5 meters)
- Enable both protocol filters
- Try scanning again

### Problem: Connection fails
**Solution:**
- App auto-retries 3 times
- Check Bluetooth is ON
- Ensure device not connected elsewhere
- Try moving closer to device

### Problem: Permissions denied
**Solution:**
```bash
# Android - Reset permissions
adb shell pm reset-permissions com.yourapp

# Then restart app and re-grant
```

### Problem: App crashes on startup
**Solution:**
```bash
# Clear app data
npm run android -- --reset-cache

# Or clear manually
adb shell pm clear com.yourapp
```

### Problem: Metro bundler port conflict
**Solution:**
```bash
# Kill process on port 8081
npx react-native start --reset-cache
```

## 📊 Quick Command Reference

```bash
# Development
npm start              # Start Metro bundler
npm run android        # Deploy to Android device
npm run ios            # Deploy to iOS device (Mac only)

# Debugging
npx react-native log-android    # View Android logs
npx react-native log-ios        # View iOS logs
adb logcat *:E                  # Android errors only

# Cleanup
npm run clean          # Clear Metro cache
rm -rf node_modules    # Full reinstall
npm install
```

## 🎯 Testing Checklist (First Run)

- [ ] App launches successfully
- [ ] Bluetooth permission granted
- [ ] Can scan for devices
- [ ] Can connect to device
- [ ] Can send commands
- [ ] Can receive responses
- [ ] Local echo works
- [ ] Timestamp works
- [ ] Can configure custom button
- [ ] Custom button sends command
- [ ] Can export log
- [ ] Settings persist after restart
- [ ] Auto-connect works

## 📖 Next Steps

1. **Read Full Documentation**
   - `FEATURES.md` - All features explained
   - `TESTING_GUIDE.md` - Complete testing checklist
   - `IMPLEMENTATION_SUMMARY.md` - Technical details

2. **Customize Your Experience**
   - Configure all 10 custom buttons
   - Set your preferred line endings
   - Enable/disable settings you need

3. **Share Your Setup**
   - Export button configurations
   - Share with team members
   - Version control your configs

## 🆘 Need Help?

### Check These Files:
- `README_BLE.md` - BLE basics
- `WIRELESS_DEBUGGING_GUIDE.md` - Wireless setup
- `TESTING_ON_REAL_DEVICE.md` - Device connection help

### Debug Mode:
Enable React Native debug mode:
1. Shake device
2. Select "Debug JS Remotely"
3. Open Chrome DevTools
4. Check Console tab for logs

### View BLE Logs:
All BLE operations logged with `[BLE]` prefix:
```bash
# Android
adb logcat | grep BLE

# iOS
# Check Xcode console
```

## ⚡ Pro Tips

1. **Battery Saver:** Disable "Clear on Send" to type faster
2. **Quick Commands:** Use "Just Insert" mode for templates
3. **Export Often:** Save your logs and button configs regularly
4. **Signal Strength:** Keep device < 5m for best connection
5. **Auto-Connect:** Always connect to same device for auto-connect

## 🎉 You're Ready!

Your Smart Stim BLE Controller is fully configured and ready to use. Enjoy the wireless control!

---

**Quick Links:**
- [Full Features](FEATURES.md)
- [Testing Guide](TESTING_GUIDE.md)
- [Implementation Details](IMPLEMENTATION_SUMMARY.md)

**Support:** Check logs with `adb logcat` or shake device for debug menu
