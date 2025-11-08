/*
 * ESP32 BLE UART Example
 * 
 * This sketch creates a BLE UART service compatible with the Smart Stim App.
 * Upload this to your ESP32 to test BLE communication.
 * 
 * Hardware:
 * - ESP32 DevKit or similar
 * - LED connected to GPIO 2 (built-in LED on most ESP32 boards)
 * 
 * Commands:
 * - Send "1" to turn LED ON
 * - Send "0" to turn LED OFF
 * - Send "sleep" to put ESP32 in deep sleep
 * 
 * Install required library:
 * 1. In Arduino IDE, go to Sketch > Include Library > Manage Libraries
 * 2. Search for "ESP32 BLE Arduino" and install it
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// BLE Service and Characteristic UUIDs (matches ESP32_PROTOCOL in app)
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID_RX "beb5483e-36e1-4688-b7f5-ea07361b26a8"  // Receive from app
#define CHARACTERISTIC_UUID_TX "6d68efe5-04b6-4a85-abc4-c2670b7bf7fd"  // Send to app

// Hardware
#define LED_PIN 2  // Built-in LED on most ESP32 boards

// BLE variables
BLEServer* pServer = NULL;
BLECharacteristic* pTxCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;
String rxValue = "";

// LED state
bool ledState = false;

// Server callbacks
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("Client connected!");
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("Client disconnected!");
    }
};

// Characteristic callbacks (receive data from app)
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      std::string value = pCharacteristic->getValue();

      if (value.length() > 0) {
        rxValue = "";
        for (int i = 0; i < value.length(); i++) {
          rxValue += value[i];
        }

        Serial.print("Received: ");
        Serial.println(rxValue);

        // Process commands
        processCommand(rxValue);
      }
    }
};

void processCommand(String cmd) {
  // Remove whitespace and newlines
  cmd.trim();
  cmd.toLowerCase();

  if (cmd == "1") {
    // Turn LED ON
    ledState = true;
    digitalWrite(LED_PIN, HIGH);
    Serial.println("LED ON");
    sendBLE("LED ON");
  }
  else if (cmd == "0") {
    // Turn LED OFF
    ledState = false;
    digitalWrite(LED_PIN, LOW);
    Serial.println("LED OFF");
    sendBLE("LED OFF");
  }
  else if (cmd == "sleep") {
    // Deep sleep mode
    Serial.println("Going to sleep...");
    sendBLE("Going to sleep... Goodbye!");
    delay(500);
    esp_deep_sleep_start();
  }
  else if (cmd == "status") {
    // Report status
    String status = "LED is " + String(ledState ? "ON" : "OFF");
    Serial.println(status);
    sendBLE(status);
  }
  else {
    // Unknown command
    Serial.print("Unknown command: ");
    Serial.println(cmd);
    sendBLE("Unknown command: " + cmd);
  }
}

void sendBLE(String message) {
  if (deviceConnected && pTxCharacteristic != NULL) {
    pTxCharacteristic->setValue(message.c_str());
    pTxCharacteristic->notify();
    Serial.print("Sent: ");
    Serial.println(message);
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== ESP32 BLE UART Starting ===");

  // Setup LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Create the BLE Device
  BLEDevice::init("ESP32");  // Device name (will appear in scan)

  // Create the BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Create the BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Create a BLE Characteristic for TX (send to app)
  pTxCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID_TX,
                        BLECharacteristic::PROPERTY_NOTIFY
                      );
  pTxCharacteristic->addDescriptor(new BLE2902());

  // Create a BLE Characteristic for RX (receive from app)
  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
                                           CHARACTERISTIC_UUID_RX,
                                           BLECharacteristic::PROPERTY_WRITE
                                         );
  pRxCharacteristic->setCallbacks(new MyCallbacks());

  // Start the service
  pService->start();

  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);  // set value to 0x00 to not advertise this parameter
  BLEDevice::startAdvertising();

  Serial.println("BLE UART Service started!");
  Serial.println("Waiting for client connection...");
  Serial.println("\nCommands:");
  Serial.println("  1     - Turn LED ON");
  Serial.println("  0     - Turn LED OFF");
  Serial.println("  sleep - Deep sleep");
  Serial.println("  status - Get LED status");
}

void loop() {
  // Handle disconnection - restart advertising
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("Restarted advertising");
    oldDeviceConnected = deviceConnected;
  }

  // Handle connection
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
    sendBLE("ESP32 Connected! Send 1/0 to control LED.");
  }

  delay(20);
}
