# ESP32 Scanning Fix - Applied Changes

## Issues Fixed

### 1. ✅ Removed 5-Second Auto-Scan on Startup
**Problem:** App automatically scanned for 5 seconds on startup trying to auto-connect to last device.

**Solution:** Removed the `attemptAutoConnect()` call from BLE initialization. Users now manually control when to scan.

**Changed in:** `BLEContext.tsx`

---

### 2. ✅ Scan for ALL BLE Devices (Not Just Specific Service UUIDs)
**Problem:** App was filtering devices by service UUIDs during scan. If ESP32 device advertised different service UUIDs than expected, it wouldn't appear in scan results.

**Solution:** Changed scan to find **ALL BLE devices** without service UUID filtering. Protocol detection now happens during connection, not during scan.

**Changed in:** `BLEService.ts`
- Scan parameter changed from `serviceUUIDs` array to `null` (scan all devices)
- Removed weak signal filtering (-100 RSSI limit)
- Made device name matching case-insensitive

---

## How It Works Now

### Scanning Process
1. **Press "Start Scan"** - User initiates scan manually
2. **Find ALL Devices** - App discovers all nearby BLE devices (no filtering)
3. **Show All Devices** - Displays every device found, regardless of protocol
4. **User Selects Device** - User picks which device to connect to

### Connection Process
1. **User taps device** from scan list
2. **App connects** and discovers services
3. **Auto-detect protocol** by checking service UUIDs
4. **Use detected protocol** for communication

---

## Testing Your ESP32 Device

### Step 1: Build and Deploy
```powershell
npm run android
```

### Step 2: Scan for Devices
1. Open the app
2. Go to **"Devices"** tab
3. Tap **"Start Scan"**
4. Wait 10 seconds for scan to complete

### Step 3: Find Your ESP32
Look for your ESP32 device in the list. It might show as:
- **"ESP32"** - If it advertises with that name
- **"SmartStim"** - If you named it that
- **Your custom name** - Whatever you programmed
- **MAC address** - Something like `30:AE:A4:XX:XX:XX`

### Step 4: Connect
1. Tap your ESP32 device
2. App will connect and auto-detect protocol
3. Watch console for connection status

---

## If ESP32 Still Doesn't Appear

### Check Your ESP32 Code

Your ESP32 **must** be advertising via BLE. Check your ESP32 sketch:

```cpp
// Make sure BLE is initialized and advertising
BLEDevice::init("ESP32");  // Device name
BLEServer *pServer = BLEDevice::createServer();

// Start advertising
BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
pAdvertising->start();
```

### Update ESP32 Service UUIDs (If Needed)

If your ESP32 uses **different service UUIDs** than the defaults, update:

**File:** `src/functionality/BLEProtocols.ts`

```typescript
export const ESP32_PROTOCOL: BLEProtocol = {
  name: 'ESP32 UART Service',
  type: BLEProtocolType.ESP32_CUSTOM,
  // REPLACE THESE with your ESP32's actual UUIDs
  serviceUUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
  rxCharUUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
  txCharUUID: '6d68efe5-04b6-4a85-abc4-c2670b7bf7fd',
  preferredDeviceName: 'ESP32', // Your device name
};
```

### Find Your ESP32's UUIDs

**Option 1: Use nRF Connect App**
1. Install **nRF Connect** on your phone
2. Scan for your ESP32
3. Connect and view services
4. Copy the service and characteristic UUIDs

**Option 2: Check Your ESP32 Code**
Look for lines like:
```cpp
BLEService *pService = pServer->createService(SERVICE_UUID);
BLECharacteristic *pTxCharacteristic = pService->createCharacteristic(
  CHARACTERISTIC_UUID_TX,
  BLECharacteristic::PROPERTY_NOTIFY
);
```

---

## What Changed in the Code

### BLEContext.tsx
```typescript
// BEFORE: Auto-connected after 1 second delay
setTimeout(() => {
  attemptAutoConnect();
}, 1000);

// AFTER: No auto-connect, user must scan manually
// Auto-connect removed - user must manually scan
```

### BLEService.ts
```typescript
// BEFORE: Filtered by service UUIDs
const serviceUUIDs = this.selectedProtocols.map(p => p.serviceUUID);
this.manager.startDeviceScan(serviceUUIDs, { ... }, ...);

// AFTER: Scan ALL devices
this.manager.startDeviceScan(null, { ... }, ...);
```

---

## Benefits of This Approach

✅ **Finds ALL BLE devices** - No filtering during scan
✅ **No auto-scan on startup** - User controls when to scan
✅ **Protocol auto-detection** - Detects protocol during connection
✅ **Works with any ESP32** - Regardless of service UUIDs advertised
✅ **Shows weak signals** - No RSSI filtering
✅ **Case-insensitive matching** - Finds "ESP32", "esp32", "Esp32", etc.

---

## Troubleshooting

### "No devices found"
- Check Bluetooth is ON
- Grant location permissions (required on Android)
- Ensure ESP32 is powered and advertising
- Increase scan duration if needed

### "Device appears but won't connect"
- ESP32 service UUIDs might not match
- Use nRF Connect to verify UUIDs
- Update `BLEProtocols.ts` with correct UUIDs

### "Connected but can't send commands"
- Protocol detection failed
- Check characteristic UUIDs match
- Verify ESP32 has notify enabled on TX characteristic

---

## Next Steps

1. **Test the app** - Deploy and scan for ESP32
2. **Verify device appears** - Check scan results
3. **Try connecting** - Tap device to connect
4. **Test communication** - Send commands from Console tab
5. **Update UUIDs if needed** - If connection fails, check UUIDs

---

**Status:** Ready for testing with ESP32 hardware
**Date:** November 19, 2025
