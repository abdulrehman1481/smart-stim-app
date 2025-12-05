# ESP32 LED Control Setup

## App Changes Made

### 1. ✅ Reduced Console Logging Spam
**Problem:** ESP32 was sending continuous data, flooding the terminal with logs.

**Solution:** 
- Limited console logging to only important messages (errors, short messages)
- Long streaming data is truncated in logs
- Only first 50 characters shown for long messages

### 2. ✅ Added LED Control Buttons
**New Feature:** Quick LED control buttons in the Console tab

**Controls:**
- **Pin 2 LED** - Toggle GPIO pin 2 on/off
- **Onboard LED** - Toggle built-in LED on/off

**Commands Sent:**
- Turn ON: `LED_ON:2` or `LED_ON:LED_BUILTIN`
- Turn OFF: `LED_OFF:2` or `LED_OFF:LED_BUILTIN`

---

## ESP32 Code Needed

Your ESP32 needs to handle these commands. Here's the code to add:

### Option 1: Basic LED Control (Simple)

```cpp
// At the top of your sketch
#define PIN_LED_ONBOARD 2  // Most ESP32 boards use pin 2 for onboard LED
#define PIN_LED_2 2        // Or use a different pin if you want separate LED

void setup() {
  Serial.begin(115200);
  
  // Initialize LED pins
  pinMode(PIN_LED_ONBOARD, OUTPUT);
  pinMode(PIN_LED_2, OUTPUT);
  
  // Start with LEDs off
  digitalWrite(PIN_LED_ONBOARD, LOW);
  digitalWrite(PIN_LED_2, LOW);
  
  // ... your existing BLE setup ...
}

void handleBLECommand(String command) {
  command.trim();  // Remove whitespace
  
  Serial.println("Received: " + command);
  
  // LED Control
  if (command.startsWith("LED_ON:")) {
    String pin = command.substring(7);  // Get everything after "LED_ON:"
    
    if (pin == "2") {
      digitalWrite(PIN_LED_2, HIGH);
      Serial.println("Pin 2 LED ON");
    } 
    else if (pin == "LED_BUILTIN") {
      digitalWrite(PIN_LED_ONBOARD, HIGH);
      Serial.println("Onboard LED ON");
    }
  }
  else if (command.startsWith("LED_OFF:")) {
    String pin = command.substring(8);  // Get everything after "LED_OFF:"
    
    if (pin == "2") {
      digitalWrite(PIN_LED_2, LOW);
      Serial.println("Pin 2 LED OFF");
    } 
    else if (pin == "LED_BUILTIN") {
      digitalWrite(PIN_LED_ONBOARD, LOW);
      Serial.println("Onboard LED OFF");
    }
  }
  else {
    // Handle other commands
    Serial.println("Unknown command: " + command);
  }
}

// In your BLE characteristic callback
void onBLECharacteristicWrite(BLECharacteristic *pCharacteristic) {
  std::string value = pCharacteristic->getValue();
  
  if (value.length() > 0) {
    String command = String(value.c_str());
    handleBLECommand(command);
  }
}
```

### Option 2: Advanced with Multiple Pins

```cpp
void handleBLECommand(String command) {
  command.trim();
  
  // Parse LED_ON:X or LED_OFF:X
  if (command.startsWith("LED_ON:") || command.startsWith("LED_OFF:")) {
    bool turnOn = command.startsWith("LED_ON:");
    int colonPos = command.indexOf(':');
    String pinStr = command.substring(colonPos + 1);
    
    int pin = -1;
    
    // Check if it's a number or special name
    if (pinStr == "LED_BUILTIN" || pinStr == "BUILTIN") {
      pin = LED_BUILTIN;  // Usually pin 2
    } 
    else {
      pin = pinStr.toInt();  // Convert to integer
    }
    
    // Validate pin number
    if (pin >= 0 && pin <= 39) {  // ESP32 has pins 0-39
      pinMode(pin, OUTPUT);
      digitalWrite(pin, turnOn ? HIGH : LOW);
      
      Serial.printf("Pin %d set to %s\n", pin, turnOn ? "HIGH" : "LOW");
      
      // Send confirmation back to app
      String response = "OK:PIN_" + String(pin) + "_" + (turnOn ? "ON" : "OFF");
      pTxCharacteristic->setValue(response.c_str());
      pTxCharacteristic->notify();
    } 
    else {
      Serial.println("Invalid pin: " + pinStr);
    }
  }
}
```

### Option 3: Stop Continuous Data Stream

If your ESP32 is sending data non-stop, you might have code like this:

```cpp
void loop() {
  // BAD - Sends data continuously
  pTxCharacteristic->setValue("Data");
  pTxCharacteristic->notify();
  delay(100);
}
```

**Fix:** Only send data when needed:

```cpp
void loop() {
  // GOOD - Only send data on events or requests
  if (dataChanged) {
    pTxCharacteristic->setValue(newData.c_str());
    pTxCharacteristic->notify();
    dataChanged = false;  // Reset flag
  }
  
  // Or only send periodically
  static unsigned long lastSend = 0;
  if (millis() - lastSend > 5000) {  // Every 5 seconds
    pTxCharacteristic->setValue("Status: OK");
    pTxCharacteristic->notify();
    lastSend = millis();
  }
}
```

---

## Complete ESP32 BLE Example

Here's a minimal working example:

```cpp
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// BLE UUIDs - Match these with your app's BLEProtocols.ts
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define RX_CHAR_UUID        "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define TX_CHAR_UUID        "6d68efe5-04b6-4a85-abc4-c2670b7bf7fd"

BLEServer *pServer = NULL;
BLECharacteristic *pTxCharacteristic = NULL;
bool deviceConnected = false;

#define LED_PIN 2

class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("BLE Connected");
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("BLE Disconnected");
    pServer->startAdvertising();  // Restart advertising
  }
};

class MyCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    std::string value = pCharacteristic->getValue();
    
    if (value.length() > 0) {
      String command = String(value.c_str());
      command.trim();
      
      Serial.println("RX: " + command);
      
      // Handle LED commands
      if (command.startsWith("LED_ON:")) {
        digitalWrite(LED_PIN, HIGH);
        Serial.println("LED ON");
        
        // Send response
        pTxCharacteristic->setValue("OK:LED_ON");
        pTxCharacteristic->notify();
      }
      else if (command.startsWith("LED_OFF:")) {
        digitalWrite(LED_PIN, LOW);
        Serial.println("LED OFF");
        
        // Send response
        pTxCharacteristic->setValue("OK:LED_OFF");
        pTxCharacteristic->notify();
      }
      else {
        // Echo back unknown commands
        String response = "Unknown: " + command;
        pTxCharacteristic->setValue(response.c_str());
        pTxCharacteristic->notify();
      }
    }
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  
  Serial.println("Starting BLE...");
  
  // Create BLE Device
  BLEDevice::init("ESP32");  // Device name
  
  // Create BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  
  // Create BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  // Create TX Characteristic (ESP32 -> App)
  pTxCharacteristic = pService->createCharacteristic(
    TX_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());
  
  // Create RX Characteristic (App -> ESP32)
  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
    RX_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pRxCharacteristic->setCallbacks(new MyCallbacks());
  
  // Start service
  pService->start();
  
  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->start();
  
  Serial.println("BLE Ready. Waiting for connection...");
}

void loop() {
  // Only send data when connected and needed
  if (deviceConnected) {
    // Don't send continuously - only on events
    // Example: Send status every 10 seconds
    static unsigned long lastStatus = 0;
    if (millis() - lastStatus > 10000) {
      pTxCharacteristic->setValue("Status: Running");
      pTxCharacteristic->notify();
      lastStatus = millis();
    }
  }
  
  delay(10);
}
```

---

## Testing the LED Control

### 1. Upload Code to ESP32
- Copy one of the examples above
- Update UUIDs if needed (check `BLEProtocols.ts`)
- Upload to ESP32
- Open Serial Monitor (115200 baud)

### 2. Connect from App
1. Run app: `npm run android`
2. Go to **Devices** tab
3. Tap **Start Scan**
4. Find **"ESP32"** device
5. Tap to connect

### 3. Test LED Control
1. Go to **Console** tab
2. You should see LED control buttons
3. Tap **"📍 Pin 2: OFF"** to turn on
4. Tap **"📍 Pin 2: ON"** to turn off
5. Same for Onboard LED

### 4. Check Serial Monitor
You should see:
```
RX: LED_ON:2
LED ON
RX: LED_OFF:2
LED OFF
```

---

## Troubleshooting

### Terminal Still Spamming
**Cause:** ESP32 sending data continuously

**Fix:** Remove any code in `loop()` that sends data repeatedly without delays or conditions

### LED Not Toggling
**Cause:** Pin mismatch or wrong command parsing

**Check:**
1. Verify pin number in ESP32 code matches physical LED
2. Check Serial Monitor for received commands
3. Ensure command format is exact: `LED_ON:2` (no spaces)

### Commands Not Received
**Cause:** BLE callback not set up

**Fix:** Make sure you're calling `setCallbacks()` on RX characteristic

---

## What Changed in the App

### BLEService.ts
```typescript
// BEFORE: Logged every received byte
console.log('[BLE] Received data from device:', decodedData);

// AFTER: Only log short/important messages
if (decodedData.length < 100 || decodedData.includes('ERROR') || decodedData.includes('OK')) {
  console.log('[BLE] RX:', decodedData.substring(0, 50) + '...');
}
```

### ControlConsole.tsx
```typescript
// NEW: LED control state
const [ledState, setLedState] = useState({ pin2: false, onboard: false });

// NEW: LED toggle function
const toggleLED = async (pin: 'pin2' | 'onboard') => {
  const pinNumber = pin === 'pin2' ? '2' : 'LED_BUILTIN';
  const newState = !ledState[pin];
  const command = newState ? `LED_ON:${pinNumber}` : `LED_OFF:${pinNumber}`;
  await bleService.sendData(command, !writeWithoutResponse);
  setLedState({ ...ledState, [pin]: newState });
};

// NEW: LED control UI
<View style={styles.ledControlContainer}>
  <TouchableOpacity onPress={() => toggleLED('pin2')}>
    Pin 2: {ledState.pin2 ? 'ON' : 'OFF'}
  </TouchableOpacity>
  <TouchableOpacity onPress={() => toggleLED('onboard')}>
    Onboard: {ledState.onboard ? 'ON' : 'OFF'}
  </TouchableOpacity>
</View>
```

---

**Status:** Ready for testing
**Next:** Upload ESP32 code and test LED control from app
