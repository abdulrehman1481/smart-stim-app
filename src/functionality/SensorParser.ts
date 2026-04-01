export type SensorModule = 'PPG' | 'IMU' | 'EDA' | 'TEMP';

// ─────────────────────────────────────────────────────────────────────────────
// Parsed result types
// ─────────────────────────────────────────────────────────────────────────────

export type SensorReadingType =
  | 'temperature'
  | 'ppg'
  | 'imu_gyro'
  | 'imu_accel'
  | 'imu_combined'
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

export interface IMUCombinedParsed {
  type: 'imu_combined';
  ax_mg: number;
  ay_mg: number;
  az_mg: number;
  gx_mdps: number;
  gy_mdps: number;
  gz_mdps: number;
  uptimeMs: number;
}

export interface EDAParsed {
  type: 'eda';
  uptimeMs: number;
  rawADC: number;
  /** ADS1113 converted voltage in milli-volts */
  mv: number;
  /** Calibrated conductance in microsiemens, if emitted by firmware */
  uS?: number;
  deltaRaw: number;
  flatCount: number;
}

export type ParsedSensorReading =
  | TemperatureParsed
  | PPGParsed
  | IMUGyroParsed
  | IMUAccelParsed
  | IMUCombinedParsed
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
  // NEW: STORED_RAW_ format detection (priority - check first)
  if (line.startsWith('STORED_RAW_')) {
    const prefix = line.split(':')[0].trim(); // e.g., "STORED_RAW_IMU"
    return prefix;
  }
  // Zephyr format: "[HH:MM:SS.mmm,mmm] <lvl> module_name: message"
  const zephyrMatch = line.match(/^\[[\d:.,]+\]\s*<\w+>\s+([\w_]+)\s*:/);
  if (zephyrMatch) return zephyrMatch[1];
  // Plain format: "module_name: message"
  if (line.includes(':')) return line.split(':', 1)[0].trim();
  return 'unknown';
}

/** Extract the message part after the module prefix. */
function extractMessage(line: string): string {
  // NEW: STORED_RAW_ format doesn't use colons as separators, return entire line
  if (line.startsWith('STORED_RAW_')) {
    // Format: "STORED_RAW_XXX: t=... key=value ..."
    // Extract everything after the first colon
    const idx = line.indexOf(':');
    return idx >= 0 ? line.slice(idx + 1).trim() : line.trim();
  }
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
 *
 * SAFETY: Protected with try-catch, returns null on parse failure
 */
function parseTemperature(message: string): TemperatureParsed | null {
  try {
    // LENIENT: Match temperature anywhere with flexible spacing
    const tempMatch = message.match(/t=([\-\d.]+)\s*C/i);
    if (!tempMatch) return null;

    const tempC = clamp(parseFloat(tempMatch[1]), -100, 100);
    if (tempC === null) return null;

    // Extract uptime if available
    const uptMatch = message.match(/uptime[\s=]*(\d+)/);
    const uptimeMs = clamp(uptMatch ? parseInt(uptMatch[1], 10) : 0, 0, 999999999);

    return {
      type: 'temperature',
      tempC,
      rawADC: Math.round(tempC * 100),
      uptimeMs: uptimeMs !== null ? uptimeMs : 0,
    };
  } catch (error) {
    console.warn('[SensorParser] Error parsing temperature:', error);
    return null;
  }
}

/**
 * Parse MAX30101 PPG FIFO log line.
 *
 * Expected message: `PPG FIFO | RED=123456 | IR=234567 | GREEN=111222 | avail=4`
 *
 * SAFETY: Protected with try-catch, returns null on parse failure
 */
function parsePPG(message: string): PPGParsed | null {
  try {
    // LENIENT: Match RED/IR anywhere with flexible spacing/separators
    const redMatch = message.match(/RED[\s=]*(\d+)/i);
    const irMatch = message.match(/IR[\s=]*(\d+)/i);
    const greenMatch = message.match(/GREEN[\s=]*(\d+)/i);

    if (!redMatch || !irMatch) return null;

    const red = clamp(parseInt(redMatch[1], 10), 0, 262143);
    const ir = clamp(parseInt(irMatch[1], 10), 0, 262143);
    const green = clamp(greenMatch ? parseInt(greenMatch[1], 10) : 0, 0, 262143);

    if (red === null || ir === null) return null;

    const availMatch = message.match(/avail[=\s]*(\d+)/i) || message.match(/available[=\s]*(\d+)/i);
    return {
      type: 'ppg',
      red,
      ir,
      green: green !== null ? green : 0,
      available: availMatch ? clamp(parseInt(availMatch[1], 10), 0, 100) || 1 : 1,
    };
  } catch (error) {
    console.warn('[SensorParser] Error parsing PPG:', error);
    return null;
  }
}

/**
 * Parse newer calibrated LSM6DSO combined log line.
 *
 * Expected message: `[LSM6DSO] A[g]=[0.012 -0.045 1.003] G[dps]=[0.21 -0.10 0.05] t=1234`
 *
 * SAFETY: Protected with try-catch, returns null on parse failure
 */
function parseIMUCombined(message: string): IMUCombinedParsed | null {
  try {
    // LENIENT: Extract A[g] values from brackets - flexibly match various formats
    const aMatch = message.match(/A\[g\]\s*=\s*\[([^\]]+)\]/);
    const gMatch = message.match(/G\[dps\]\s*=\s*\[([^\]]+)\]/);
    
    if (!aMatch || !gMatch) return null;

    // Parse space-separated values in brackets
    const aVals = aMatch[1].trim().split(/\s+/).map(v => clamp(Number(v), -32768, 32767));
    const gVals = gMatch[1].trim().split(/\s+/).map(v => clamp(Number(v), -32768, 32767));

    if (aVals.length !== 3 || gVals.length !== 3) return null;
    if (!aVals.every(v => v !== null) || !gVals.every(v => v !== null)) return null;

    // NEW FORMAT: A[g] and G[dps] are ALREADY in standard units (no conversion needed)
    // Values are already in g and dps respectively
    const ax_mg = aVals[0] as number;
    const ay_mg = aVals[1] as number;
    const az_mg = aVals[2] as number;
    const gx_mdps = gVals[0] as number;
    const gy_mdps = gVals[1] as number;
    const gz_mdps = gVals[2] as number;

    // Extract uptime if present
    const tMatch = message.match(/t=(\d+)/);
    const uptimeMs = clamp(tMatch ? parseInt(tMatch[1], 10) : 0, 0, 999999999);

    return {
      type: 'imu_combined',
      ax_mg,
      ay_mg,
      az_mg,
      gx_mdps,
      gy_mdps,
      gz_mdps,
      uptimeMs: uptimeMs !== null ? uptimeMs : 0,
    };
  } catch (error) {
    console.warn('[SensorParser] Error parsing IMU combined:', error);
    return null;
  }
}

/**
 * Parse LSM6DSO Gyroscope log line.
 *
 * Expected message: `[LSM6DSO] G RAW [  gx   gy   gz] mdps [  gx_mdps  gy_mdps  gz_mdps]`
 *
 * SAFETY: Protected with try-catch, returns null on parse failure
 */
function parseIMUGyro(message: string): IMUGyroParsed | null {
  try {
    if (!message.includes('[LSM6DSO]') || !message.includes('G RAW')) return null;

    const groups = [...message.matchAll(/\[\s*([\-\d]+)\s+([\-\d]+)\s+([\-\d]+)\s*\]/g)];
    if (groups.length < 2) return null; // Regex didn't match expected groups

    const raw  = groups[0];
    const mdps = groups[1];

    const rawX = clamp(parseInt(raw[1], 10), -32768, 32767);
    const rawY = clamp(parseInt(raw[2], 10), -32768, 32767);
    const rawZ = clamp(parseInt(raw[3], 10), -32768, 32767);
    const gx_mdps = clamp(parseInt(mdps[1], 10), -250000, 250000);
    const gy_mdps = clamp(parseInt(mdps[2], 10), -250000, 250000);
    const gz_mdps = clamp(parseInt(mdps[3], 10), -250000, 250000);

    // DEFENSIVE: Reject if any clamped value is null
    if (rawX === null || rawY === null || rawZ === null ||
        gx_mdps === null || gy_mdps === null || gz_mdps === null) {
      console.warn('[SensorParser] Invalid gyro values (NaN/Infinity/undefined detected)');
      return null;
    }

    return {
      type:    'imu_gyro',
      rawX,
      rawY,
      rawZ,
      gx_mdps,
      gy_mdps,
      gz_mdps,
    };
  } catch (error) {
    console.warn('[SensorParser] Error parsing gyro:', error);
    return null;
  }
}

/**
 * Parse LSM6DSO Accelerometer log line.
 *
 * Expected message: `[LSM6DSO] A RAW [  ax   ay   az]  mg [  ax_mg   ay_mg   az_mg]`
 *
 * SAFETY: Protected with try-catch, returns null on parse failure
 */
function parseIMUAccel(message: string): IMUAccelParsed | null {
  try {
    if (!message.includes('[LSM6DSO]') || !message.includes('A RAW')) return null;

    const groups = [...message.matchAll(/\[\s*([\-\d]+)\s+([\-\d]+)\s+([\-\d]+)\s*\]/g)];
    if (groups.length < 2) return null; // Regex didn't match expected groups

    const raw = groups[0];
    const mg  = groups[1];

    const rawX = clamp(parseInt(raw[1], 10), -32768, 32767);
    const rawY = clamp(parseInt(raw[2], 10), -32768, 32767);
    const rawZ = clamp(parseInt(raw[3], 10), -32768, 32767);
    const ax_mg = clamp(parseInt(mg[1], 10), -50000, 50000);
    const ay_mg = clamp(parseInt(mg[2], 10), -50000, 50000);
    const az_mg = clamp(parseInt(mg[3], 10), -50000, 50000);

    // DEFENSIVE: Reject if any clamped value is null
    if (rawX === null || rawY === null || rawZ === null ||
        ax_mg === null || ay_mg === null || az_mg === null) {
      console.warn('[SensorParser] Invalid accel values (NaN/Infinity/undefined detected)');
      return null;
    }

    return {
      type:  'imu_accel',
      rawX,
      rawY,
      rawZ,
      ax_mg,
      ay_mg,
      az_mg,
    };
  } catch (error) {
    console.warn('[SensorParser] Error parsing accel:', error);
    return null;
  }
}

/**
 * Parse ADS1113 EDA log line.
 *
 * Expected message: `t=1234ms raw=15000 mv=1875 dRaw=5 flat_cnt=0`
 *
 * SAFETY: Protected with try-catch, returns null on parse failure
 */
function parseEDA(message: string): EDAParsed | null {
  try {
    // LENIENT: Match raw and mv anywhere, case-insensitive
    const rawMatch = message.match(/raw[\s=]*([\-\d]+)/i);
    const mvMatch = message.match(/mv[\s=]*([\-\d.]+)/i);

    if (!rawMatch || !mvMatch) return null;

    const rawADC = clamp(parseInt(rawMatch[1], 10), 0, 65535);
    const mv = clamp(parseFloat(mvMatch[1]), 0, 5000);

    if (rawADC === null || mv === null) return null;

    // Extract optional fields
    const timeMatch = message.match(/t[\s=]*(\d+)\s*ms/i);
    const uSMatch = message.match(/uS[\s=]*([\-\d.]+)/i);
    const deltaMatch = message.match(/dRaw[\s=]*([\-\d]+)/i);
    const flatMatch = message.match(/flat[_]?[Cc]nt[\s=]*(\d+)/i) || message.match(/flatline/i);

    const uptimeMs = clamp(timeMatch ? parseInt(timeMatch[1], 10) : 0, 0, 999999999);
    const uS = uSMatch ? clamp(parseFloat(uSMatch[1]), 0, 1000) : null;
    const deltaRaw = clamp(deltaMatch ? parseInt(deltaMatch[1], 10) : 0, -32768, 32767);
    const flatCount = clamp(flatMatch ? (flatMatch[1] ? parseInt(flatMatch[1], 10) : 1) : 0, 0, 255);

    return {
      type: 'eda',
      uptimeMs: uptimeMs !== null ? uptimeMs : 0,
      rawADC,
      mv,
      uS: uS !== null ? uS : undefined,
      deltaRaw: deltaRaw !== null ? deltaRaw : 0,
      flatCount: flatCount !== null ? flatCount : 0,
    };
  } catch (error) {
    console.warn('[SensorParser] Error parsing EDA:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STORED_RAW_ FORMAT PARSERS (Firmware direct-storage format)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse space-separated or tab-separated key=value pairs (BULLETPROOF).
 * Handles tabs, double-spaces, and mixed whitespace in firmware output.
 * Input: "t=100505\tax_mg=-69\tay_mg=7" OR "t=100505  ax_mg=-69  ay_mg=7"
 * Output: { t: 100505, ax_mg: -69, ay_mg: 7 }
 * 
 * ROBUST: Uses /\s+/ to split by ANY whitespace. Lowercases keys for reliable matching.
 */
function parseKV(str: string): Record<string, number> {
  const out: Record<string, number> = {};
  // Split by any whitespace (spaces, tabs, multiple spaces)
  const pairs = str.trim().split(/\s+/); 
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    
    // Extract, trim, and lowercase key for robust matching
    const k = pair.substring(0, eq).trim().toLowerCase();
    const vStr = pair.substring(eq + 1).trim();
    const v = parseFloat(vStr);
    if (Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/**
 * Absolute firewall against firmware electrical spikes that produce NaN/Infinity.
 * Clamps numeric values to safe ranges and returns null for any invalid data.
 * 
 * This function catches electrical glitches from the hardware before they can
 * crash the app or cause Firebase writes to fail.
 * 
 * @param v       Raw value from firmware (may be NaN, Infinity, undefined, etc)
 * @param lo      Lower bound for clamping (default: -999999)
 * @param hi      Upper bound for clamping (default: 999999)
 * @returns       Safe number within [lo, hi], or null if value is invalid
 */
function clamp(v: number | undefined | null | any, lo: number = -999999, hi: number = 999999): number | null {
  // Absolute firewall against firmware electrical spikes
  if (v === undefined || v === null || Number.isNaN(v) || !Number.isFinite(v)) {
    return null;
  }
  return Math.min(Math.max(v, lo), hi);
}

/**
 * Parse STORED_RAW_IMU format.
 * Format: "t=100505 ax_mg=-69 ay_mg=7 az_mg=1005 gx_mdps=358 gy_mdps=-603 gz_mdps=-332"
 */
function parseStoredRawIMU(message: string): IMUCombinedParsed | null {
  try {
    const kv = parseKV(message);
    const uptimeMs = clamp(kv['t'], 0, 999999999);
    // CRITICAL: DO NOT divide by 1000. Pass the raw integers straight through!
    // We still clamp them to prevent extreme hardware garbage, but use integer ranges.
    const ax_mg = clamp(kv['ax_mg'], -32768, 32767);
    const ay_mg = clamp(kv['ay_mg'], -32768, 32767);
    const az_mg = clamp(kv['az_mg'], -32768, 32767);
    const gx_mdps = clamp(kv['gx_mdps'], -32768, 32767);
    const gy_mdps = clamp(kv['gy_mdps'], -32768, 32767);
    const gz_mdps = clamp(kv['gz_mdps'], -32768, 32767);

    // DEFENSIVE: Reject if any required field is missing or invalid
    if (uptimeMs === null || ax_mg === null || ay_mg === null ||
        az_mg === null || gx_mdps === null || gy_mdps === null ||
        gz_mdps === null) {
      return null;
    }

    return {
      type: 'imu_combined',
      ax_mg,
      ay_mg,
      az_mg,
      gx_mdps,
      gy_mdps,
      gz_mdps,
      uptimeMs,
    };
  } catch (error) {
    console.warn('[SensorParser] Error parsing STORED_RAW_IMU:', error);
    return null;
  }
}

/**
 * Parse STORED_RAW_PPG format.
 * Format: "t=100500 red=47182 ir=58103 green=6431"
 * 
 * SAFETY: If green field is missing due to sensor interrupt, default to 0.
 * This prevents Firebase crashes from undefined properties.
 */
function parseStoredRawPPG(message: string): PPGParsed | null {
  try {
    const kv = parseKV(message);
    const red = clamp(kv['red'], 0, 262143);
    const ir = clamp(kv['ir'], 0, 262143);
    const green = clamp(kv['green'], 0, 262143);

    // DEFENSIVE: Reject if core channels (red, ir) are missing
    if (red === null || ir === null) {
      return null;
    }

    // If green is missing, use 0 (not undefined) so Firebase doesn't crash
    // This handles firmware interrupts that drop optional channels
    const greenValue = green !== null ? green : 0;

    return {
      type: 'ppg',
      red,
      ir,
      green: greenValue,
      available: 1,
    };
  } catch (error) {
    console.warn('[SensorParser] Error parsing STORED_RAW_PPG:', error);
    return null;
  }
}

/**
 * Parse STORED_RAW_EDA format.
 * Format: "t=100639 raw=161 mv=20"
 * 
 * SAFETY: If mv field is missing due to sensor interrupt, use 0 as fallback.
 * This prevents firmware gaps from crashing the app.
 */
function parseStoredRawEDA(message: string): EDAParsed | null {
  try {
    const kv = parseKV(message);
    const uptimeMs = clamp(kv['t'], 0, 999999999);
    const rawADC = clamp(kv['raw'], 0, 65535);
    const mv = clamp(kv['mv'], 0, 5000);

    // DEFENSIVE: Reject if core time/raw fields are missing
    if (uptimeMs === null || rawADC === null) {
      return null;
    }

    // If mv is missing, use 0 as fallback (not null) so we don't crash
    // This handles firmware interrupts that drop optional fields
    const mvValue = mv !== null ? mv : 0;

    return {
      type: 'eda',
      uptimeMs,
      rawADC,
      mv: mvValue,
      deltaRaw: 0,
      flatCount: 0,
    };
  } catch (error) {
    console.warn('[SensorParser] Error parsing STORED_RAW_EDA:', error);
    return null;
  }
}

/**
 * Parse STORED_RAW_TEMP format.
 * Format: "t=100639 temp_c_x100=3634" (temperature in 0.01°C units, e.g., 3634 = 36.34°C)
 */
function parseStoredRawTemp(message: string): TemperatureParsed | null {
  try {
    const kv = parseKV(message);
    const uptimeMs = clamp(kv['t'], 0, 999999999);
    const tempCx100 = clamp(kv['temp_c_x100'], -10000, 10000);

    // DEFENSIVE: Reject if any required field is missing
    if (uptimeMs === null || tempCx100 === null) {
      return null;
    }

    const tempC = clamp(tempCx100 / 100, -100, 100); // Convert from 0.01°C units to °C

    return {
      type: 'temperature',
      tempC: tempC !== null ? tempC : 0,
      rawADC: tempCx100,
      uptimeMs,
    };
  } catch (error) {
    console.warn('[SensorParser] Error parsing STORED_RAW_TEMP:', error);
    return null;
  }
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
 * SAFETY FEATURES:
 * ✅ Wrapped in try-catch to handle parsing errors gracefully
 * ✅ Returns null on invalid data instead of throwing
 * ✅ Logs warnings for malformed lines (helps firmware debugging)
 * ✅ App continues running even if firmware emits corrupted line
 *
 * @param line  One complete log line (no newline character).
 */
export function parseSensorLine(line: string): ParsedSensorReading | null {
  try {
    // SAFETY: Validate input
    if (typeof line !== 'string' || line.trim().length === 0) {
      return null;
    }

    // --- FORMAT 2: LEGACY & RAW KEY-VALUE FORMAT ---
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) return null;
    const prefix = line.substring(0, colonIdx).trim();
    const message = line.substring(colonIdx + 1).trim();
    
    // Map prefix to module (Support STORED_RAW_, RAW_, and legacy formats)
    let module: SensorModule | null = null;
    if (prefix === 'STORED_RAW_PPG' || prefix === 'RAW_PPG') module = 'PPG';
    else if (prefix === 'STORED_RAW_IMU' || prefix === 'RAW_IMU') module = 'IMU';
    else if (prefix === 'STORED_RAW_EDA' || prefix === 'RAW_EDA' || prefix === 'eda_raw') module = 'EDA';
    else if (prefix === 'STORED_RAW_TEMP' || prefix === 'RAW_TEMP') module = 'TEMP';
    else if (prefix === 'as6221_demo') module = 'TEMP';
    else if (prefix === 'max30101_demo') module = 'PPG';
    else if (prefix === 'lsm6dso_app') module = 'IMU';
    
    if (!module) return null;

    // Dispatch based on mapped module
    switch (module) {
      case 'PPG': {
        const result = parseStoredRawPPG(message);
        if (result) console.log('[Parser→Pipeline] PPG:', result);
        return result;
      }

      case 'IMU': {
        let result = null;
        // Check if this is combined or separate format
        if (message.includes('ax_mg') || message.includes('A[g]=')) {
          result = parseStoredRawIMU(message);
        } else if (message.includes('G RAW')) {
          result = parseIMUGyro(message);
        } else if (message.includes('A RAW')) {
          result = parseIMUAccel(message);
        }
        if (result) console.log('[Parser→Pipeline] IMU:', result);
        return result;
      }

      case 'EDA': {
        const result = parseStoredRawEDA(message);
        if (result) console.log('[Parser→Pipeline] EDA:', result);
        return result;
      }

      case 'TEMP': {
        const result = parseStoredRawTemp(message);
        if (result) console.log('[Parser→Pipeline] TEMP:', result);
        return result;
      }

      default:
        return null;
    }
  } catch (error) {
    // SAFETY: Prevent parsing errors from crashing the app
    console.warn('[SensorParser] Error parsing line:', line, error);
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
