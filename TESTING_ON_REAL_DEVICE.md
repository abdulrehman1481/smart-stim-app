# Testing BLE App on Real Android Device

## Why You Need a Real Device

**Android emulators do NOT support Bluetooth Low Energy (BLE)**. The emulator's Bluetooth can't be turned on because there's no real Bluetooth hardware. You MUST use a real Android device to test BLE functionality.

---

## Method 1: USB Connection (Easiest)

### Step 1: Enable Developer Mode
1. On your Android phone, go to **Settings** → **About phone**
2. Find **Build number** (may be under "Software information")
3. Tap **Build number** 7 times
4. You'll see "You are now a developer!"

### Step 2: Enable USB Debugging
1. Go to **Settings** → **Developer options**
2. Enable **USB debugging**
3. Enable **Install via USB** (if available)

### Step 3: Connect Your Device
1. Connect your phone to your computer via USB cable
2. On your phone, allow USB debugging when prompted
3. Select "Always allow from this computer" and tap **OK**

### Step 4: Verify Connection
```powershell
# Check if device is connected
adb devices
```

You should see output like:
```
List of devices attached
ABCD1234567890  device
```

### Step 5: Install and Run the App
```powershell
# Navigate to your project
cd D:\job\app\smart-stim-app

# Install the app on your phone
cd android
.\gradlew.bat installDebug
cd ..

# Or run directly with React Native
npx react-native run-android
```

The app will automatically install on your **real device** instead of the emulator!

---

## Method 2: Wireless Debugging (Android 11+)

No USB cable needed after initial setup!

### Initial Setup (USB Required Once)
1. Connect phone via USB and enable USB debugging (see Method 1)
2. On your phone: Settings → Developer options → Enable **Wireless debugging**
3. Run on your computer:
   ```powershell
   adb tcpip 5555
   ```

### Connect Wirelessly
1. Find your phone's IP address:
   - Settings → About phone → Status → IP address
   - OR: Settings → Wi-Fi → Tap your network → IP address

2. Connect via ADB:
   ```powershell
   # Replace XXX.XXX.XXX.XXX with your phone's IP address
   adb connect XXX.XXX.XXX.XXX:5555
   ```

3. Verify connection:
   ```powershell
   adb devices
   ```

4. You can now disconnect the USB cable!

### Install and Run Wirelessly
```powershell
cd D:\job\app\smart-stim-app
npx react-native run-android
```

---

## Method 3: Install APK Manually

If ADB isn't working, you can manually install the APK:

### Step 1: Build the APK
```powershell
cd D:\job\app\smart-stim-app\android
.\gradlew.bat assembleDebug
```

### Step 2: Find the APK
The APK will be at:
```
D:\job\app\smart-stim-app\android\app\build\outputs\apk\debug\app-debug.apk
```

### Step 3: Transfer to Phone
- **Option A**: Email the APK to yourself and open it on your phone
- **Option B**: Use USB to copy it to your phone's Downloads folder
- **Option C**: Upload to cloud storage (Google Drive, Dropbox) and download on phone

### Step 4: Install on Phone
1. On your phone, open the APK file
2. If prompted, enable "Install from unknown sources" for that app
3. Tap **Install**

---

## Troubleshooting

### "adb" not recognized
Add Android SDK platform-tools to your PATH:
1. Find your Android SDK location (usually `C:\Users\YourName\AppData\Local\Android\Sdk`)
2. Add `C:\Users\YourName\AppData\Local\Android\Sdk\platform-tools` to system PATH
3. Restart PowerShell

Or use the full path:
```powershell
& "C:\Users\hp\AppData\Local\Android\Sdk\platform-tools\adb.exe" devices
```

### Device not detected
1. Try a different USB cable (some cables are charge-only)
2. Try a different USB port
3. Install/update USB drivers for your phone manufacturer
4. Restart ADB:
   ```powershell
   adb kill-server
   adb start-server
   adb devices
   ```

### "Unauthorized" device
- Check your phone for the USB debugging authorization prompt
- Uncheck and re-check USB debugging in developer options
- Revoke USB debugging authorizations and try again

### App installs but won't run
```powershell
# Check logs
adb logcat | Select-String "ReactNative"

# Or view all logs
adb logcat
```

---

## Quick Command Reference

```powershell
# Check connected devices
adb devices

# Install APK
adb install path\to\app-debug.apk

# Uninstall app
adb uninstall com.yourappname

# View logs
adb logcat

# Restart ADB
adb kill-server
adb start-server

# Connect wirelessly
adb tcpip 5555
adb connect <phone-ip>:5555

# Copy file to phone
adb push local-file.apk /sdcard/Download/

# Copy file from phone
adb pull /sdcard/Download/file.txt .
```

---

## Testing BLE on Real Device

Once the app is running on your real device:

1. ✅ **Enable Bluetooth** on your phone
2. ✅ **Grant all permissions** when prompted:
   - Location (required for BLE scanning on Android)
   - Bluetooth/Nearby devices (Android 12+)
3. ✅ **Open the app** and try scanning
4. ✅ You should now see BLE devices!

---

## Why Emulators Don't Work for BLE

- ❌ No real Bluetooth hardware in emulator
- ❌ Bluetooth toggle in emulator does nothing
- ❌ Can't scan for or connect to BLE devices
- ❌ No way to simulate real BLE peripherals properly

**Bottom line**: BLE requires a **real device** with real Bluetooth hardware. This is a limitation of Android emulators, not your app!

---

## Alternative: Mock BLE for UI Testing

If you need to test UI without a real device, you can create a mock BLE service:

```typescript
// src/functionality/MockBLEService.ts
export class MockBLEService {
  async startScan(onDeviceFound: (device: any) => void) {
    // Simulate finding devices
    setTimeout(() => {
      onDeviceFound({ id: '1', name: 'Mock Device 1', rssi: -50 });
    }, 1000);
    setTimeout(() => {
      onDeviceFound({ id: '2', name: 'DeepSleepDongle', rssi: -60 });
    }, 2000);
  }
  // ... mock other methods
}
```

Then use a flag to switch between real and mock BLE service during development. **But this won't help with actual BLE functionality testing!**
