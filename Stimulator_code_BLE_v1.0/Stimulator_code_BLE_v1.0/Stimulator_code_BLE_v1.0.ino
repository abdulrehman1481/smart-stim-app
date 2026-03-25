#include <Wire.h>
#include <Adafruit_MCP4725.h>
#include <Adafruit_INA219.h>

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// I2C Pins
#define I2C_SDA 4
#define I2C_SCL 5

// Waveform Parameters
#define TIMESTEP 250         // 250us timer tick

// Default Values
#define OFFSET_DEFAULT 2505
#define PHASE1_DEFAULT 3000
#define PHASE2_DEFAULT 2010

// Default Timing for 1kHz (1000us total period = 4 ticks)
#define T_ON_POS_DEFAULT 2   // 500us ON (Positive)
#define T_OFF_DEFAULT    1   // 250us OFF (Dead time)
#define T_ON_NEG_DEFAULT 1   // 250us ON (Negative)

// BLE
#define DEVICE_NAME      "ESP_SIGNAL_CTRL"
#define SERVICE_UUID     "12345678-1234-1234-1234-1234567890AB"
#define RX_CHAR_UUID     "12345678-1234-1234-1234-1234567890AC"
#define TX_CHAR_UUID     "12345678-1234-1234-1234-1234567890AD"

Adafruit_MCP4725 dac1, dac2, dac3;
Adafruit_INA219 ina1(0x44), ina2(0x41), ina3(0x40);

volatile uint16_t offsetVal   = OFFSET_DEFAULT;
volatile uint16_t phase1Amp   = PHASE1_DEFAULT;
volatile uint16_t phase2Amp   = PHASE2_DEFAULT;

volatile uint32_t tOnPos = T_ON_POS_DEFAULT;
volatile uint32_t tOff   = T_OFF_DEFAULT;
volatile uint32_t tOnNeg = T_ON_NEG_DEFAULT;

volatile uint16_t currentDacVal = OFFSET_DEFAULT;
volatile uint32_t tickCount = 0;
volatile bool outputEnabled = true;

hw_timer_t *timer = NULL;
portMUX_TYPE timerMux = portMUX_INITIALIZER_UNLOCKED;

// BLE globals
BLECharacteristic *txCharacteristic = nullptr;
bool deviceConnected = false;
String rxBuffer = "";

// ----------------------------- Helpers -----------------------------
void notifyLine(String line) {
  Serial.println(line);

  if (deviceConnected && txCharacteristic != nullptr) {
    String out = line + "\n";
    txCharacteristic->setValue(out.c_str());
    txCharacteristic->notify();
  }
}

void sendConfigStatus() {
  String msg = "CFG ";
  msg += "OFFSET=" + String((uint16_t)offsetVal);
  msg += " PHASE1=" + String((uint16_t)phase1Amp);
  msg += " PHASE2=" + String((uint16_t)phase2Amp);
  msg += " TONPOS=" + String((uint32_t)tOnPos);
  msg += " TOFF=" + String((uint32_t)tOff);
  msg += " TONNEG=" + String((uint32_t)tOnNeg);
  msg += " RUN=" + String(outputEnabled ? 1 : 0);
  notifyLine(msg);
}

void processCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  String upper = cmd;
  upper.toUpperCase();

  if (upper == "PING") {
    notifyLine("PONG");
    return;
  }

  if (upper == "GET") {
    sendConfigStatus();
    return;
  }

  if (upper == "START") {
    portENTER_CRITICAL(&timerMux);
    outputEnabled = true;
    portEXIT_CRITICAL(&timerMux);

    notifyLine("ACK START");
    sendConfigStatus();
    return;
  }

  if (upper == "STOP") {
    portENTER_CRITICAL(&timerMux);
    outputEnabled = false;
    currentDacVal = offsetVal;
    portEXIT_CRITICAL(&timerMux);

    notifyLine("ACK STOP");
    sendConfigStatus();
    return;
  }

  if (upper.startsWith("SET ")) {
    int sp1 = cmd.indexOf(' ');
    int sp2 = cmd.indexOf(' ', sp1 + 1);

    if (sp2 < 0) {
      notifyLine("ERR BAD_FORMAT");
      return;
    }

    String key = cmd.substring(sp1 + 1, sp2);
    String valueStr = cmd.substring(sp2 + 1);
    key.trim();
    valueStr.trim();
    key.toUpperCase();

    long value = valueStr.toInt();

    portENTER_CRITICAL(&timerMux);

    if (key == "OFFSET") {
      offsetVal = constrain(value, 0, 4095);
      if (!outputEnabled) currentDacVal = offsetVal;
    } else if (key == "PHASE1") {
      phase1Amp = constrain(value, 0, 4095);
    } else if (key == "PHASE2") {
      phase2Amp = constrain(value, 0, 4095);
    } else if (key == "TONPOS") {
      if (value < 0) value = 0;
      tOnPos = (uint32_t)value;
    } else if (key == "TOFF") {
      if (value < 0) value = 0;
      tOff = (uint32_t)value;
    } else if (key == "TONNEG") {
      if (value < 0) value = 0;
      tOnNeg = (uint32_t)value;
    } else {
      portEXIT_CRITICAL(&timerMux);
      notifyLine("ERR UNKNOWN_PARAM");
      return;
    }

    portEXIT_CRITICAL(&timerMux);

    notifyLine("ACK " + key + " " + String(value));
    sendConfigStatus();
    return;
  }

  notifyLine("ERR UNKNOWN_CMD");
}

// ----------------------------- BLE Callbacks -----------------------------
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) override {
    deviceConnected = true;
    Serial.println("[BLE] Client connected");
  }

  void onDisconnect(BLEServer *pServer) override {
    deviceConnected = false;
    Serial.println("[BLE] Client disconnected");
    BLEDevice::startAdvertising();
  }
};

class MyRXCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    std::string value = pCharacteristic->getValue();
    if (value.empty()) return;

    for (size_t i = 0; i < value.size(); i++) {
      char c = value[i];

      if (c == '\n') {
        processCommand(rxBuffer);
        rxBuffer = "";
      } else if (c != '\r') {
        rxBuffer += c;
      }
    }
  }
};

// ----------------------------- Timer ISR -----------------------------
void IRAM_ATTR onTimer() {
  portENTER_CRITICAL_ISR(&timerMux);

  tickCount++;
  uint32_t period = tOnPos + tOff + tOnNeg;
  if (period == 0) period = 1;

  uint32_t step = tickCount % period;

  // Biphasic state machine: same core logic
  if (!outputEnabled) {
    currentDacVal = offsetVal;
  } else if (step < tOnPos) {
    currentDacVal = phase1Amp;
  } else if (step < (tOnPos + tOff)) {
    currentDacVal = offsetVal;
  } else {
    currentDacVal = phase2Amp;
  }

  portEXIT_CRITICAL_ISR(&timerMux);
}

// ----------------------------- Setup -----------------------------
void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA, I2C_SCL, 400000);

  // Same as your original
  dac1.begin(0x61);
  dac2.begin(0x61);
  dac3.begin(0x60);

  ina1.begin();
  ina2.begin();
  ina3.begin();

  // Timer
  timer = timerBegin(1000000);
  timerAttachInterrupt(timer, &onTimer);

  // Use TIMESTEP as intended 250us timer tick
  timerAlarm(timer, TIMESTEP, true, 0);

  // BLE setup
  BLEDevice::init(DEVICE_NAME);
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new MyServerCallbacks());

  BLEService *service = server->createService(SERVICE_UUID);

  BLECharacteristic *rxCharacteristic = service->createCharacteristic(
    RX_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  rxCharacteristic->setCallbacks(new MyRXCallbacks());

  txCharacteristic = service->createCharacteristic(
    TX_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  txCharacteristic->addDescriptor(new BLE2902());

  service->start();

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->start();

  Serial.println("--- 3-Channel VNS Hardware Validation ---");
  Serial.println("Waveform: Biphasic | Freq: 1kHz");
  Serial.println("BLE Device Ready: ESP_SIGNAL_CTRL");
  Serial.println("Commands: PING, GET, START, STOP, SET OFFSET <v>, SET PHASE1 <v>, SET PHASE2 <v>, SET TONPOS <v>, SET TOFF <v>, SET TONNEG <v>");

  sendConfigStatus();
}

// ----------------------------- Loop -----------------------------
void loop() {
  static unsigned long lastLog = 0;

  // 10ms Logging Interval for Deliverable
  if (millis() - lastLog >= 10) {
    lastLog = millis();

    uint16_t dacValLocal;
    portENTER_CRITICAL(&timerMux);
    dacValLocal = currentDacVal;
    portEXIT_CRITICAL(&timerMux);

    // Same core logic as your original
    dac1.setVoltage(dacValLocal, false);
    dac2.setVoltage(dacValLocal, false);
    dac3.setVoltage(dacValLocal, false);

    // Read Sensors
    float mv1 = ina1.getShuntVoltage_mV();
    float mv2 = ina2.getShuntVoltage_mV();
    float mv3 = ina3.getShuntVoltage_mV();

    // Same style terminal output
    String line = "DAC_CMD: " + String(dacValLocal)
                + "\t| CH1(mV): " + String(mv1, 3)
                + "\t| CH2(mV): " + String(mv2, 3)
                + "\t| CH3(mV): " + String(mv3, 3);

    notifyLine(line);
  }
}