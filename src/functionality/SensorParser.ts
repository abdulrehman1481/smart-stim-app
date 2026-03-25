/**
 * SensorParser.ts
 *
 * Parses raw BLE log lines emitted by the nRF52840 firmware into structured
 * sensor readings that can be stored in Firestore.
 *
 * Firmware log modules and their formats:
 *
 *  Module          │ LOG_MODULE_REGISTER name │ Example line
 * ─────────────────┼──────────────────────────┼──────────────────────────────────────────
 *  AS6221  (temp)  │ as6221_demo              │ as6221_demo: [AS6221] t=24.50 C | raw=2450 | uptime=1234 ms
 *  LSM6DSO (IMU)   │ lsm6dso_app              │ lsm6dso_app: [LSM6DSO] G RAW [  100  -50  980] mdps [  875 -437  857]
 *                  │                          │ lsm6dso_app: [LSM6DSO] A RAW [  100  -50  980]  mg [   61  -30  598]
 *  MAX30101 (PPG)  │ max30101_demo            │ max30101_demo: PPG FIFO | RED=123456 | IR=234567 | GREEN=111222 | avail=4
 *  ADS1113  (EDA)  │ eda_raw                  │ eda_raw: t=1234ms raw=15000 mv=1875 dRaw=5 flat_cnt=0
 */

// ─────────────────────────────────────────────────────────────────────────────
// Parsed result types
// ─────────────────────────────────────────────────────────────────────────────

export type SensorReadingType =
  | 'temperature'
  | 'ppg'
  | 'imu_gyro'
  | 'imu_accel'
  | 'eda';

export interface TemperatureParsed {
  type: 'temperature';
  tempC: number;
  rawADC: number;
  uptimeMs: number;
}

export interface PPGParsed {
  type: 'ppg';
  red: number;
  ir: number;
  green: number;
  available: number;
}

export interface IMUGyroParsed {
  type: 'imu_gyro';
  /** Raw 16-bit register values */
  rawX: number;
  rawY: number;
  rawZ: number;
  /** Converted values in milli-degrees-per-second */
  gx_mdps: number;
  gy_mdps: number;
  gz_mdps: number;
}

export interface IMUAccelParsed {
  type: 'imu_accel';
  /** Raw 16-bit register values */
  rawX: number;
  rawY: number;
  rawZ: number;
  /** Converted values in mg (milli-g) */
  ax_mg: number;
  ay_mg: number;
  az_mg: number;
}

export interface EDAParsed {
  type: 'eda';
  uptimeMs: number;
  rawADC: number;
  /** ADS1113 converted voltage in milli-volts */
  mv: number;
  deltaRaw: number;
  flatCount: number;
}

export type ParsedSensorReading =
  | TemperatureParsed
  | PPGParsed
  | IMUGyroParsed
  | IMUAccelParsed
  | EDAParsed;

// ─────────────────────────────────────────────────────────────────────────────
// Module identification helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the module prefix from a raw log line.
 *
 * Handles two formats:
 *   1. Zephyr deferred-logging format (sent over BLE log backend):
 *      `[00:00:01.234,000] <inf> as6221_demo: [AS6221] t=24.50 C ...`
 *   2. Plain format (legacy / direct UART echo):
 *      `as6221_demo: [AS6221] t=24.50 C ...`
 */
export function extractModule(line: string): string {
  // Zephyr format: "[HH:MM:SS.mmm,mmm] <lvl> module_name: message"
  const zephyrMatch = line.match(/^\[[\d:.,]+\]\s*<\w+>\s+([\w_]+)\s*:/);
  if (zephyrMatch) return zephyrMatch[1];
  // Plain format: "module_name: message"
  if (line.includes(':')) return line.split(':', 1)[0].trim();
  return 'unknown';
}

/** Extract the message part after the module prefix. */
function extractMessage(line: string): string {
  // Zephyr format: strip everything up to and including "module_name: "
  const zephyrMatch = line.match(/^\[[\d:.,]+\]\s*<\w+>\s+[\w_]+\s*:\s*(.*)/);
  if (zephyrMatch) return zephyrMatch[1].trim();
  // Plain format
  const idx = line.indexOf(':');
  return idx >= 0 ? line.slice(idx + 1).trim() : line.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual parsers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse AS6221 temperature log line.
 *
 * Expected message: `[AS6221] t=24.50 C | raw=2450 | uptime=1234 ms`
 */
function parseTemperature(message: string): TemperatureParsed | null {
  // Match temperature
  const tempMatch = message.match(/t=([\-\d.]+)\s*C/);
  const rawMatch  = message.match(/raw=(\d+)/);
  const uptMatch  = message.match(/uptime=(\d+)/);

  if (!tempMatch) return null;

  return {
    type:     'temperature',
    tempC:    parseFloat(tempMatch[1]),
    rawADC:   rawMatch  ? parseInt(rawMatch[1],  10) : 0,
    uptimeMs: uptMatch  ? parseInt(uptMatch[1],  10) : 0,
  };
}

/**
 * Parse MAX30101 PPG FIFO log line.
 *
 * Expected message: `PPG FIFO | RED=123456 | IR=234567 | GREEN=111222 | avail=4`
 */
function parsePPG(message: string): PPGParsed | null {
  if (!message.includes('PPG FIFO')) return null;

  const redMatch   = message.match(/RED=(\d+)/);
  const irMatch    = message.match(/IR=(\d+)/);
  const greenMatch = message.match(/GREEN=(\d+)/);
  const availMatch = message.match(/avail=(\d+)/);

  if (!redMatch || !irMatch || !greenMatch) return null;

  return {
    type:      'ppg',
    red:       parseInt(redMatch[1],   10),
    ir:        parseInt(irMatch[1],    10),
    green:     parseInt(greenMatch[1], 10),
    available: availMatch ? parseInt(availMatch[1], 10) : 1,
  };
}

/**
 * Parse LSM6DSO Gyroscope log line.
 *
 * Expected message: `[LSM6DSO] G RAW [  gx   gy   gz] mdps [  gx_mdps  gy_mdps  gz_mdps]`
 */
function parseIMUGyro(message: string): IMUGyroParsed | null {
  if (!message.includes('[LSM6DSO]') || !message.includes('G RAW')) return null;

  // Match two bracketed groups of three integers
  const groups = [...message.matchAll(/\[\s*([\-\d]+)\s+([\-\d]+)\s+([\-\d]+)\s*\]/g)];
  if (groups.length < 2) return null;

  const raw  = groups[0];
  const mdps = groups[1];

  return {
    type:    'imu_gyro',
    rawX:    parseInt(raw[1],  10),
    rawY:    parseInt(raw[2],  10),
    rawZ:    parseInt(raw[3],  10),
    gx_mdps: parseInt(mdps[1], 10),
    gy_mdps: parseInt(mdps[2], 10),
    gz_mdps: parseInt(mdps[3], 10),
  };
}

/**
 * Parse LSM6DSO Accelerometer log line.
 *
 * Expected message: `[LSM6DSO] A RAW [  ax   ay   az]  mg [  ax_mg   ay_mg   az_mg]`
 */
function parseIMUAccel(message: string): IMUAccelParsed | null {
  if (!message.includes('[LSM6DSO]') || !message.includes('A RAW')) return null;

  const groups = [...message.matchAll(/\[\s*([\-\d]+)\s+([\-\d]+)\s+([\-\d]+)\s*\]/g)];
  if (groups.length < 2) return null;

  const raw = groups[0];
  const mg  = groups[1];

  return {
    type:  'imu_accel',
    rawX:  parseInt(raw[1], 10),
    rawY:  parseInt(raw[2], 10),
    rawZ:  parseInt(raw[3], 10),
    ax_mg: parseInt(mg[1],  10),
    ay_mg: parseInt(mg[2],  10),
    az_mg: parseInt(mg[3],  10),
  };
}

/**
 * Parse ADS1113 EDA log line.
 *
 * Expected message: `t=1234ms raw=15000 mv=1875 dRaw=5 flat_cnt=0`
 */
function parseEDA(message: string): EDAParsed | null {
  const timeMatch  = message.match(/t=(\d+)ms/);
  const rawMatch   = message.match(/raw=([\-\d]+)/);
  const mvMatch    = message.match(/mv=([\-\d]+)/);
  const deltaMatch = message.match(/dRaw=([\-\d]+)/);
  const flatMatch  = message.match(/flat_cnt=(\d+)/);

  if (!rawMatch || !mvMatch) return null;

  return {
    type:       'eda',
    uptimeMs:   timeMatch  ? parseInt(timeMatch[1],  10) : 0,
    rawADC:     parseInt(rawMatch[1],   10),
    mv:         parseInt(mvMatch[1],    10),
    deltaRaw:   deltaMatch ? parseInt(deltaMatch[1], 10) : 0,
    flatCount:  flatMatch  ? parseInt(flatMatch[1],  10) : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main dispatcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a single raw BLE log line.
 *
 * Returns a typed `ParsedSensorReading` if the line contains recognised
 * sensor data, or `null` for housekeeping / unknown lines.
 *
 * @param line  One complete log line (no newline character).
 */
export function parseSensorLine(line: string): ParsedSensorReading | null {
  const module  = extractModule(line);
  const message = extractMessage(line);

  switch (module) {
    case 'as6221_demo':
      return parseTemperature(message);

    case 'max30101_demo':
      return parsePPG(message);

    case 'lsm6dso_app':
      if (message.includes('G RAW')) return parseIMUGyro(message);
      if (message.includes('A RAW')) return parseIMUAccel(message);
      return null;

    case 'eda_raw':
      return parseEDA(message);

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived calculations (shared helpers used by the pipeline)
// ─────────────────────────────────────────────────────────────────────────────

/** Convert EDA raw ADC mV to skin conductance in µS (microsiemens). */
export function edaMvToMicrosiemens(mv: number): number {
  // Vref = 2048 mV for ADS1113 (FSR = ±2.048 V, gain = 1)
  // Skin resistance (kΩ) = V_excitation / I = model dependent.
  // A common wristband EDA proxy: conductance (µS) ≈ (mV / 1000) * 10
  // Replace with your circuit model if available.
  if (mv <= 0) return 0;
  const voltage = mv / 1000; // V
  const resistance_kOhm = voltage > 0 ? (3.3 / voltage) * 100 : Infinity;
  return resistance_kOhm > 0 ? 1000 / resistance_kOhm : 0;
}

/** Convert accel mg to metres-per-second-squared. */
export function mgToMps2(mg: number): number {
  return (mg / 1000) * 9.80665;
}

/** Compute vector magnitude from three components. */
export function magnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/** Celsius to Fahrenheit. */
export function celsiusToFahrenheit(c: number): number {
  return c * 9 / 5 + 32;
}

/** Estimate stress level from EDA conductance. */
export function estimateStressLevel(
  conductance_uS: number,
): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
  if (conductance_uS < 2)   return 'LOW';
  if (conductance_uS < 10)  return 'MEDIUM';
  if (conductance_uS < 20)  return 'HIGH';
  return 'VERY_HIGH';
}
