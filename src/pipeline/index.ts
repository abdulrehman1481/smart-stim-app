/**
 * pipeline/index.ts
 *
 * Single-import barrel for the complete sensor pipeline.
 *
 * Architecture:
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │                     NRF52840 Wristband                              │
 *  │  AS6221 (Temp) · MAX30101 (PPG) · LSM6DSO (IMU) · ADS1113 (EDA)   │
 *  └────────────────────────────┬────────────────────────────────────────┘
 *                               │  Zephyr LOG_MODULE_REGISTER lines
 *                               │  streamed over BLE GATT notifications
 *                               ▼
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  BLEProtocols.ts  ──  UUIDs for Nordic UART + Log Notify service   │
 *  │  BLEService.ts    ──  Singleton BleManager wrapper                  │
 *  │  BLEContext.tsx   ──  React context (scan · connect · receivedMsgs) │
 *  └────────────────────────────┬────────────────────────────────────────┘
 *                               │  receivedMessages[]
 *                               ▼
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  SensorParser.ts  ──  parseSensorLine() → typed ParsedSensorReading │
 *  │    · as6221_demo  → TemperatureParsed                               │
 *  │    · max30101_demo → PPGParsed                                      │
 *  │    · lsm6dso_app  → IMUGyroParsed | IMUAccelParsed                 │
 *  │    · eda_raw      → EDAParsed                                       │
 *  └────────────────────────────┬────────────────────────────────────────┘
 *                               │
 *              ┌────────────────┴────────────────┐
 *              ▼                                  ▼
 *  ┌──────────────────────┐          ┌───────────────────────────────────┐
 *  │  LiveSensorState     │          │  Firebase / Firestore             │
 *  │  (in-memory, React)  │          │                                   │
 *  │  · temperature       │          │  users/{uid}/                     │
 *  │  · ppg               │          │    sensor_data/temperature/       │
 *  │  · accel             │          │    sensor_data/ppg/               │
 *  │  · gyro              │          │    sensor_data/accelerometer/     │
 *  │  · eda               │          │    sensor_data/gyroscope/         │
 *  └──────────────────────┘          │    sensor_data/eda/               │
 *        ▲                           │    sensor_data/imu/               │
 *        │  useSensorPipeline()      │    sessions/                      │
 *        └─────────── hook ──────────┘    stimulation_events/            │
 *                                    └───────────────────────────────────┘
 *
 * Usage:
 *   import { useSensorPipeline, parseSensorLine } from '../pipeline';
 */

// ── BLE layer ──────────────────────────────────────────────────────────────
export {
  BLEProtocolType,  NRF_LOG_PROTOCOL,  NORDIC_UART_PROTOCOL,
  ESP32_PROTOCOL,
  SUPPORTED_PROTOCOLS,
  LOG_SERVICE_UUID,
  LOG_NOTIFY_UUID,
  getProtocol,
  getProtocolByServiceUUID,
} from '../functionality/BLEProtocols';

export type { BLEProtocol } from '../functionality/BLEProtocols';

export { bleService } from '../functionality/BLEService';
export type { BLEDevice } from '../functionality/BLEService';

export { BLEProvider, useBLE } from '../functionality/BLEContext';

// ── Sensor Parsing layer ───────────────────────────────────────────────────
export {
  parseSensorLine,
  extractModule,
  edaMvToMicrosiemens,
  mgToMps2,
  magnitude,
  celsiusToFahrenheit,
  estimateStressLevel,
} from '../functionality/SensorParser';

export type {
  SensorReadingType,
  ParsedSensorReading,
  TemperatureParsed,
  PPGParsed,
  IMUGyroParsed,
  IMUAccelParsed,
  EDAParsed,
} from '../functionality/SensorParser';

// ── Stimulation Commands layer ─────────────────────────────────────────────
export {
  StimMode,
  STIM_MODE_NAMES,
  SmartStimCommandBuilder,
} from '../functionality/SmartStimCommands';

export type {
  ChannelConfig,
  SessionConfig,
  DeviceStatus,
  ChannelStatus,
} from '../functionality/SmartStimCommands';

// ── Firebase / Storage layer ───────────────────────────────────────────────
export { auth, db } from '../firebase/firebaseConfig';

export { SensorType, DataQuality } from '../firebase/sensorTypes';
export type {
  BaseSensorReading,
  EDAReading,
  TemperatureReading,
  PPGReading,
  HeartRateReading,
  SpO2Reading,
  AccelerometerReading,
  GyroscopeReading,
  IMUReading,
  DeviceInfo,
  RecordingSession,
  StimulationEvent,
} from '../firebase/sensorTypes';

export {
  saveEDAReading,
  saveTemperatureReading,
  savePPGReading,
  saveHeartRateReading,
  saveSpO2Reading,
  saveAccelerometerReading,
  saveGyroscopeReading,
  saveIMUReading,
  saveDeviceInfo,
  startSession,
  endSession,
  saveStimulationEvent,
  saveRawSensorLog,
  saveSensorBatch,
  getRecentReadings,
  getSession,
  // legacy compat
  saveSensorReading,
  saveSensorLog,
} from '../firebase/dataLogger';

// ── Pipeline hook (ties everything together) ───────────────────────────────
export { useSensorPipeline } from '../hooks/useSensorPipeline';
export type { LiveSensorState, PipelineSession } from '../hooks/useSensorPipeline';

// ── Auth layer ─────────────────────────────────────────────────────────────
export { AuthProvider, useAuth } from '../auth/AuthContext';
