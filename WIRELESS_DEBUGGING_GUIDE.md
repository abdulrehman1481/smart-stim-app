# Quick ADB Commands for Your Project

## 🔧 Important: Use Full Path to ADB

Since `adb` is not in your PATH, always use:
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" <command>
```

Or use the helper script: `.\adb-helper.ps1`

---

## 📱 Wireless Debugging Setup (Step by Step)

### Prerequisites
- Real Android phone (Android 11+)
- USB cable (for initial setup only)
- Phone and computer on the **same Wi-Fi network**

### Step 1: Connect Phone via USB
1. Plug your phone into computer with USB cable
2. On phone: Settings → Developer options → Enable **USB debugging**
3. On phone: Allow USB debugging when prompted
4. Select "Always allow from this computer"

### Step 2: Verify USB Connection
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
```

You should see:
```
List of devices attached
ABCD1234567890  device
```

### Step 3: Enable Wireless Mode
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" tcpip 5555
```

You should see:
```
restarting in TCP mode port: 5555
```

### Step 4: Find Your Phone's IP Address

**Option A** - Settings App:
1. Settings → About phone → Status → **IP address**

**Option B** - Wi-Fi Settings:
1. Settings → Wi-Fi
2. Tap your connected network
3. Look for **IP address**

Should look like: `192.168.1.xxx` or `10.0.0.xxx`

### Step 5: Connect Wirelessly
```powershell
# Replace XXX.XXX.XXX.XXX with your phone's IP address
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" connect 192.168.1.100:5555
```

You should see:
```
connected to 192.168.1.100:5555
```

### Step 6: Verify Wireless Connection
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
```

You should see:
```
List of devices attached
192.168.1.100:5555  device
```

### Step 7: Disconnect USB Cable ✅
**You can now unplug the USB cable!** Your phone is connected wirelessly.

---

## 🚀 Running Your App on Real Phone

### Once Connected (USB or Wireless)

**Option 1: Using Expo (Recommended)**
```powershell
npx expo run:android
```

**Option 2: Using React Native CLI**
```powershell
npx react-native run-android
```

**Option 3: Install APK Manually**
```powershell
# Build the APK first
cd android
.\gradlew.bat assembleDebug
cd ..

# Install on phone
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 📋 Common ADB Commands

### Check Devices
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
```

### Install APK
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r path\to\app.apk
```

### Uninstall App
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" uninstall com.abrehman.smartstimapp
```

### View Logs
```powershell
# All logs
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" logcat

# React Native logs only
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" logcat | Select-String "ReactNative"
```

### Disconnect Wireless
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" disconnect
```

### Restart ADB
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" kill-server
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" start-server
```

### Copy File to Phone
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" push local-file.txt /sdcard/Download/
```

### Pull File from Phone
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" pull /sdcard/Download/file.txt .
```

---

## 🔍 Troubleshooting

### "Device Not Found" When Running App
```powershell
# Check devices
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices

# If empty, reconnect
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" connect YOUR_IP:5555
```

### Wireless Connection Keeps Dropping
```powershell
# Reconnect
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" disconnect
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" connect YOUR_IP:5555
```

### Can't Connect Wirelessly
1. Ensure phone and PC are on **same Wi-Fi**
2. Check your phone's IP hasn't changed
3. Try disabling and re-enabling wireless debugging on phone
4. Restart ADB server:
   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" kill-server
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" start-server
   ```

### "Unauthorized" Device
- Check your phone for USB debugging authorization dialog
- Select "Always allow from this computer"
- Try again

---

## 🎯 Your Current Situation

You have **wireless debugging enabled** on your phone, now you need to:

1. ✅ **Connect phone via USB** (if not already connected)
2. ✅ **Run**: `& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" tcpip 5555`
3. ✅ **Find phone's IP address** (Settings → Wi-Fi)
4. ✅ **Run**: `& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" connect YOUR_IP:5555`
5. ✅ **Unplug USB cable**
6. ✅ **Run your app**: `npx expo run:android`

---

## 💡 Pro Tips

### Create a PowerShell Alias
Add to your PowerShell profile (`notepad $PROFILE`):
```powershell
function adb { & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" $args }
```

Then you can just use:
```powershell
adb devices
adb connect 192.168.1.100:5555
adb install app.apk
```

### Use the Helper Script
```powershell
.\adb-helper.ps1
```
Interactive menu for common tasks!

### Save Your Phone's IP
Create a quick connect script:
```powershell
# connect-phone.ps1
$PHONE_IP = "192.168.1.100"  # Update with your phone's IP
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" connect "${PHONE_IP}:5555"
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
```

Then just run: `.\connect-phone.ps1`

---

## 🎉 Benefits of Wireless Debugging

✅ No USB cable needed  
✅ Test app while moving around  
✅ Better for testing BLE features  
✅ More convenient for development  
✅ No cable wear and tear  

---

## 📱 Testing Real BLE

Once your app is on your real phone:

1. ✅ **Enable Bluetooth** on phone
2. ✅ **Grant permissions** when app asks
3. ✅ **Scan for devices** - should see real BLE devices!
4. ✅ **Connect to DeepSleepDongle** - real hardware!

The app will automatically use **REAL BLE** (not mock) when running on a real device.

Check logs for:
```
LOG  [BLE] Using REAL BLE Service (isDevice: true)
```

---

## 🆘 Quick Help

**I don't have a USB cable**  
→ Use Method 3 from `TESTING_ON_REAL_DEVICE.md` to manually install APK

**My phone isn't connecting**  
→ Run `.\adb-helper.ps1` and choose option 7 (Restart ADB)

**App crashes on real device**  
→ Check logs: `& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" logcat`

**Need more help?**  
→ See `TESTING_ON_REAL_DEVICE.md` for detailed troubleshooting
