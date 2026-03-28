/**
 * useSensorPipeline.ts
 *
 * Unified hook that wires together the complete data pipeline:
 *
 *   BLE device  ──►  BLEContext (receivedMessages)
 *                         │
 *                         ▼
 *                   SensorParser       ← parse raw log lines
 *                         │
 *              ┌──────────┴──────────┐
 *              ▼                     ▼
 *       React state              Firebase
 *    (live sensor UI)         (Firestore storage)
 *
 * Usage:
 *   const { live, session, startSession, stopSession } = useSensorPipeline();
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBLE } from '../functionality/BLEContext';
import { useAuth } from '../auth/AuthContext';
import {
  parseSensorLine,
  edaMvToMicrosiemens,
  magnitude,
  celsiusToFahrenheit,
  estimateStressLevel,
} from '../functionality/SensorParser';
import {
  saveTemperatureReading,
  saveEDAReading,
  savePPGReading,
  saveAccelerometerReading,
  saveGyroscopeReading,
  saveIMUReading,
  startSession as fbStartSession,
  endSession   as fbEndSession,
  saveDeviceInfo,
} from '../firebase/dataLogger';
import { SensorType } from '../firebase/sensorTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Live (in-memory) sensor state
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveSensorState {
  /** AS6221 temperature sensor */
  temperature: {
    tempC: number;
    tempF: number;
    lastUpdated: Date | null;
  };
  /** MAX30101 PPG */
  ppg: {
    red: number;
    ir: number;
    green: number;
    lastUpdated: Date | null;
  };
  /** LSM6DSO Accelerometer (mg) */
  accel: {
    x: number;
    y: number;
    z: number;
    magnitude: number;
    lastUpdated: Date | null;
  };
  /** LSM6DSO Gyroscope (mdps) */
  gyro: {
    x: number;
    y: number;
    z: number;
    magnitude: number;
    lastUpdated: Date | null;
  };
  /** ADS1113 EDA/GSR */
  eda: {
    rawADC: number;
    mv: number;
    conductance_uS: number;
    stressLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
    lastUpdated: Date | null;
  };
}

const initialLiveState: LiveSensorState = {
  temperature: { tempC: 0, tempF: 0, lastUpdated: null },
  ppg:         { red: 0, ir: 0, green: 0, lastUpdated: null },
  accel:       { x: 0, y: 0, z: 0, magnitude: 0, lastUpdated: null },
  gyro:        { x: 0, y: 0, z: 0, magnitude: 0, lastUpdated: null },
  eda:         { rawADC: 0, mv: 0, conductance_uS: 0, stressLevel: 'LOW', lastUpdated: null },
};

// ─────────────────────────────────────────────────────────────────────────────
// Session state
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineSession {
  sessionId: string | null;
  isRecording: boolean;
  startedAt: Date | null;
  dataPointsSaved: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase throttle config
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum ms between Firebase writes per sensor type to avoid overwhelming Firestore */
const FB_MIN_INTERVAL_MS: Record<string, number> = {
  temperature: 5_000,  // every 5 s
  ppg:         2_000,  // every 2 s (PPG is high-frequency)
  eda:         3_000,  // every 3 s
  imu:         2_000,  // every 2 s
};

const MAX_MESSAGES_PER_TICK = 400;
const MAX_PARSE_ERRORS_PER_TICK = 20;
const ENABLE_VERBOSE_PIPELINE_LOGS = false;

// ─────────────────────────────────────────────────────────────────────────────
// Sensor bounds & rate-of-change validation (Per Firmware Specs)
// IMPORTANT: These are SPIKE thresholds (detecting errors/noise), not change thresholds.
// Legitimate small changes (HR increase, stress response, etc.) are 100x smaller than
// these thresholds and will always pass through to the app.
// ─────────────────────────────────────────────────────────────────────────────

// ── TEMPERATURE (AS6221) ──────────────────────────────────────────────────
/** Temperature sensor range: -40°C to +125°C; realistic wristband: 20-45°C */
const TEMP_MIN_C = -40;
const TEMP_MAX_C = 125;
const TEMP_WARN_MIN_C = 15;
const TEMP_WARN_MAX_C = 50;
/** Max temperature change per sample (4 Hz = 250ms) before treating as spike.
 *  Normal changes (e.g., exercise): ~0.003°C per sample.
 *  Threshold of 0.5°C = 150x above normal, catches only firmware errors.
 */
const TEMP_MAX_DELTA_C = 0.5;

// ── PPG (MAX30101) ────────────────────────────────────────────────────────
/** PPG 18-bit unsigned: 0–262,143. Wear detection: IR > 50,000 = worn */
const PPG_MAX_VALUE = 262_143;
const PPG_MIN_VALID = 0;
const PPG_WEAR_THRESHOLD = 50_000;
// NOTE: PPG has NO rate-of-change checking — heart rate changes
// (even small 70→75 bpm increases) will pass through immediately.

// ── GYROSCOPE (LSM6DSO ±250 dps config) ──────────────────────────────────
/** Gyroscope firmware range: ±250 dps (±250,000 mdps) */
const GYRO_MAX_MDPS = 250_000;
/** Max gyro delta per sample: 50,000 mdps/sample (~32 Hz firmware = ~30ms).
 *  Normal arm motion: ~5k mdps per sample. Threshold 50k = 10x above normal.
 *  Only rejects extreme spikes (aggressive shakes, sensor glitches).
 */
const GYRO_MAX_DELTA_MDPS = 50_000;

// ── ACCELEROMETER (LSM6DSO ±16g range) ────────────────────────────────────
/** Accelerometer firmware range: ±16 g (±16,000 mg) */
const ACCEL_MAX_MG = 16_000;
/** Max accel delta per sample: 2,000 mg/sample (~32 Hz firmware = ~30ms).
 *  Normal arm motion: ~200 mg per sample. Threshold 2k = 10x above normal.
 *  Only rejects extreme spikes (impact, sensor error).
 */
const ACCEL_MAX_DELTA_MG = 2_000;

// ── EDA (ADS1113 16-bit signed) ───────────────────────────────────────────
/** EDA raw ADC range: -32,768 to +32,767 (16-bit signed) */
const EDA_MAX_RAW = 32_767;
const EDA_MIN_RAW = -32_768;
/** EDA mV range: ~-4,095 to +4,095 mV (raw * 125 / 1000) */
const EDA_MAX_MV = 4_095;
const EDA_MIN_MV = -4_095;
/** Max EDA delta per sample (4 Hz = 250ms) before treating as spike.
 *  Normal stress response: ~1-2 µS per second = ~0.25-0.5 µS per sample.
 *  Threshold 50 µS = 100x above normal, catches only firmware errors.
 */
const EDA_MAX_DELTA_US = 50.0; // microSiemens per sample

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useSensorPipeline() {
  const { receivedMessages, isConnected, connectedDevice, connectedDeviceName } = useBLE();
  const { user } = useAuth();

  const [live, setLive] = useState<LiveSensorState>(initialLiveState);
  const [session, setSession] = useState<PipelineSession>({
    sessionId: null,
    isRecording: false,
    startedAt: null,
    dataPointsSaved: 0,
  });

  // Track last-processed message index so we don't re-process old messages
  const lastProcessedIdx = useRef<number>(0);
  const liveRef = useRef<LiveSensorState>(initialLiveState);

  // Firebase write throttle: track last write time per sensor type
  const lastFbWrite = useRef<Record<string, number>>({});

  // Track previous sensor values for rate-of-change validation
  const prevIMURef = useRef<{
    gyro: { x: number; y: number; z: number };
    accel: { x: number; y: number; z: number };
    tempC: number;
    ppgIr: number;
    edaUs: number;
  }>({
    gyro: { x: 0, y: 0, z: 0 },
    accel: { x: 0, y: 0, z: 0 },
    tempC: 25, // human body baseline
    ppgIr: 100_000, // reasonable PPG baseline
    edaUs: 5, // baseline conductance ~5 µS
  });

  // ── helpers ───────────────────────────────────────────────────────────────

  const canWriteToFirebase = useCallback((sensorKey: string): boolean => {
    const now     = Date.now();
    const last    = lastFbWrite.current[sensorKey] ?? 0;
    const minGap  = FB_MIN_INTERVAL_MS[sensorKey] ?? 2_000;
    return now - last > minGap;
  }, []);

  const markFbWrite = useCallback((sensorKey: string) => {
    lastFbWrite.current[sensorKey] = Date.now();
  }, []);

  const toFinite = useCallback((value: number, fallback = 0) => {
    return Number.isFinite(value) ? value : fallback;
  }, []);

  /**
   * Validate and clamp gyroscope value.
   * Checks bounds and rate-of-change to reject spikes.
   */
  const validateGyro = useCallback((axis: 'x' | 'y' | 'z', value: number): boolean => {
    const clamped = Math.max(-GYRO_MAX_MDPS, Math.min(GYRO_MAX_MDPS, value));
    const prev = prevIMURef.current.gyro[axis];
    const delta = Math.abs(clamped - prev);
    if (delta > GYRO_MAX_DELTA_MDPS) {
      if (ENABLE_VERBOSE_PIPELINE_LOGS) {
        console.warn(`[Pipeline] GYRO-${axis} spike rejected: ${value} mdps (delta=${delta})`);
      }
      return false;
    }
    prevIMURef.current.gyro[axis] = clamped;
    return true;
  }, []);

  /**
   * Validate and clamp accelerometer value.
   * Checks bounds and rate-of-change to reject spikes.
   */
  const validateAccel = useCallback((axis: 'x' | 'y' | 'z', value: number): boolean => {
    const clamped = Math.max(-ACCEL_MAX_MG, Math.min(ACCEL_MAX_MG, value));
    const prev = prevIMURef.current.accel[axis];
    const delta = Math.abs(clamped - prev);
    if (delta > ACCEL_MAX_DELTA_MG) {
      if (ENABLE_VERBOSE_PIPELINE_LOGS) {
        console.warn(`[Pipeline] ACCEL-${axis} spike rejected: ${value} mg (delta=${delta})`);
      }
      return false;
    }
    prevIMURef.current.accel[axis] = clamped;
    return true;
  }, []);

  /**
   * Validate temperature: clamp to firmware bounds and check sanity.
   */
  const validateTemp = useCallback((value: number): number => {
    const clamped = Math.max(TEMP_MIN_C, Math.min(TEMP_MAX_C, value));
    const prev = prevIMURef.current.tempC;
    const delta = Math.abs(clamped - prev);
    
    // If delta too large, use previous value to smooth spike
    if (delta > TEMP_MAX_DELTA_C) {
      if (ENABLE_VERBOSE_PIPELINE_LOGS) {
        console.warn(`[Pipeline] TEMP spike rejected: ${value}°C → ${prev}°C (delta=${delta})`);
      }
      return prev;
    }
    prevIMURef.current.tempC = clamped;
    return clamped;
  }, []);

  /**
   * Validate PPG value (per-channel): clamp to 18-bit range and require wear.
   */
  const validatePPG = useCallback((channel: 'red' | 'ir' | 'green', value: number): number => {
    const clamped = Math.max(PPG_MIN_VALID, Math.min(PPG_MAX_VALUE, toFinite(value, 0)));
    
    // PPG is less susceptible to spikes, but reject zeroes if IR (wear indicator)
    if (channel === 'ir' && clamped < PPG_WEAR_THRESHOLD) {
      // IR < wear threshold = sensor not in contact; zero it out
      if (ENABLE_VERBOSE_PIPELINE_LOGS) {
        console.warn(`[Pipeline] PPG ${channel} not-worn: ${clamped} (< ${PPG_WEAR_THRESHOLD})`);
      }
      return 0;
    }
    
    return clamped;
  }, []);

  /**
   * Validate EDA value: clamp to ADC range and check rate-of-change.
   */
  const validateEDA = useCallback((value_uS: number): number => {
    if (!Number.isFinite(value_uS)) {
      return prevIMURef.current.edaUs;
    }
    
    const prev = prevIMURef.current.edaUs;
    const delta = Math.abs(value_uS - prev);
    
    // If delta too large, use previous value to smooth spike
    if (delta > EDA_MAX_DELTA_US) {
      if (ENABLE_VERBOSE_PIPELINE_LOGS) {
        console.warn(`[Pipeline] EDA spike rejected: ${value_uS.toFixed(2)}µS → ${prev.toFixed(2)}µS (delta=${delta.toFixed(2)})`);
      }
      return prev;
    }
    
    prevIMURef.current.edaUs = value_uS;
    return value_uS;
  }, []);

  /** Increment saved data point counter */
  const incDataPoints = useCallback((by = 1) => {
    setSession(prev => ({ ...prev, dataPointsSaved: prev.dataPointsSaved + by }));
  }, []);

  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  // ── register device once connected ────────────────────────────────────────

  useEffect(() => {
    if (!user || !isConnected || !connectedDevice) return;

    saveDeviceInfo(user.uid, {
      deviceId:   connectedDevice.id,
      deviceName: connectedDeviceName || 'Unknown',
      deviceType: 'NRF52840',
      isActive:   true,
    }).catch(err => console.warn('[Pipeline] Device registration failed:', err));
  }, [user, isConnected, connectedDevice, connectedDeviceName]);

  // ── main message processor ────────────────────────────────────────────────

  useEffect(() => {
    // Guard: if receivedMessages was trimmed (length shrank), our absolute
    // pointer overshoots.  Reset to the current length so we start fresh
    // from the next incoming message rather than re-processing stale ones.
    if (lastProcessedIdx.current > receivedMessages.length) {
      lastProcessedIdx.current = receivedMessages.length;
    }
    // Only process NEW messages since the last render
    let newMessages = receivedMessages.slice(lastProcessedIdx.current);
    lastProcessedIdx.current = receivedMessages.length;

    if (newMessages.length === 0) return;

    if (newMessages.length > MAX_MESSAGES_PER_TICK) {
      console.warn(
        `[Pipeline] Backpressure: ${newMessages.length} new lines; processing latest ${MAX_MESSAGES_PER_TICK}`
      );
      newMessages = newMessages.slice(-MAX_MESSAGES_PER_TICK);
    }

    const nextLive: LiveSensorState = {
      temperature: { ...liveRef.current.temperature },
      ppg: { ...liveRef.current.ppg },
      accel: { ...liveRef.current.accel },
      gyro: { ...liveRef.current.gyro },
      eda: { ...liveRef.current.eda },
    };
    let liveChanged = false;
    let parseErrors = 0;

    for (const rawMsg of newMessages) {
      // Strip the BLEContext timestamp prefix "[HH:MM:SS PM] RX: <line>"
      // Permissive pattern handles AM/PM and any locale time format.
      const line = rawMsg.replace(/^\[[^\]]+\]\s*RX:\s*/, '').trim();
      if (!line) continue;

      if (ENABLE_VERBOSE_PIPELINE_LOGS) {
        console.log('[Pipeline] RAW ←', line);
      }

      let parsed;
      try {
        parsed = parseSensorLine(line);
      } catch (error) {
        parseErrors += 1;
        console.warn('[Pipeline] Parse error:', error);
        if (parseErrors >= MAX_PARSE_ERRORS_PER_TICK) {
          console.warn('[Pipeline] Too many parse errors this tick; remaining lines dropped');
          break;
        }
        continue;
      }

      if (!parsed) {
        if (ENABLE_VERBOSE_PIPELINE_LOGS) {
          console.debug('[Pipeline] (not a sensor line):', line.slice(0, 80));
        }
        continue;
      }

      const now = new Date();
      const deviceId   = connectedDevice?.id;
      const deviceName = connectedDeviceName || undefined;
      const sessionId  = session.sessionId || undefined;

      switch (parsed.type) {
        // ── Temperature ────────────────────────────────────────────────────
        case 'temperature': {
          const rawTempC = toFinite(parsed.tempC, nextLive.temperature.tempC);
          const tempC = validateTemp(rawTempC); // Apply validation & spike rejection
          const tempF = celsiusToFahrenheit(tempC);
          if (ENABLE_VERBOSE_PIPELINE_LOGS) {
            console.log(
              `[Pipeline] 🌡️  TEMP  ${tempC.toFixed(2)}°C  (${tempF.toFixed(2)}°F)  rawADC=${parsed.rawADC}  uptime=${parsed.uptimeMs}ms`
            );
          }
          nextLive.temperature = { tempC, tempF, lastUpdated: now };
          liveChanged = true;

          if (user && session.isRecording && canWriteToFirebase('temperature')) {
            markFbWrite('temperature');
            saveTemperatureReading(user.uid, {
              temperature:            tempC, // Use validated value
              temperatureFahrenheit:  tempF,
              bodyLocation:           'WRIST',
              skinContact:            true,
              deviceId,
              deviceName,
              sessionId,
            })
              .then(() => incDataPoints())
              .catch(err => console.error('[Pipeline] Temp save failed:', err));
          }
          break;
        }

        // ── PPG ────────────────────────────────────────────────────────────
        case 'ppg': {
          const red = validatePPG('red', toFinite(parsed.red, nextLive.ppg.red));
          const ir = validatePPG('ir', toFinite(parsed.ir, nextLive.ppg.ir));
          const green = validatePPG('green', toFinite(parsed.green, nextLive.ppg.green));
          if (ENABLE_VERBOSE_PIPELINE_LOGS) {
            console.log(
              `[Pipeline] ❤️  PPG   RED=${red}  IR=${ir}  GREEN=${green}  avail=${parsed.available}`
            );
          }
          nextLive.ppg = { red, ir, green, lastUpdated: now };
          liveChanged = true;

          if (user && session.isRecording && canWriteToFirebase('ppg')) {
            markFbWrite('ppg');
            // Save all three channels in parallel
            Promise.all([
              savePPGReading(user.uid, { channel: 'RED',   rawValue: red,   deviceId, deviceName, sessionId }),
              savePPGReading(user.uid, { channel: 'IR',    rawValue: ir,    deviceId, deviceName, sessionId }),
              savePPGReading(user.uid, { channel: 'GREEN', rawValue: green, deviceId, deviceName, sessionId }),
            ])
              .then(() => incDataPoints(3))
              .catch(err => console.error('[Pipeline] PPG save failed:', err));
          }
          break;
        }

        // ── IMU Gyro ───────────────────────────────────────────────────────
        case 'imu_gyro': {
          const gx = toFinite(parsed.gx_mdps, nextLive.gyro.x);
          const gy = toFinite(parsed.gy_mdps, nextLive.gyro.y);
          const gz = toFinite(parsed.gz_mdps, nextLive.gyro.z);
          
          // Validate rate-of-change: reject if any axis exceeds max delta
          if (!validateGyro('x', gx) || !validateGyro('y', gy) || !validateGyro('z', gz)) {
            if (ENABLE_VERBOSE_PIPELINE_LOGS) {
              console.warn('[Pipeline] Gyro sample rejected (spike detected)');
            }
            break;
          }
          
          const mag = magnitude(gx, gy, gz);
          if (ENABLE_VERBOSE_PIPELINE_LOGS) {
            console.log(
              `[Pipeline] 🎯 GYRO  X=${gx}mdps  Y=${gy}mdps  Z=${gz}mdps  |mag|=${mag.toFixed(0)}`
            );
          }
          nextLive.gyro = {
            x: gx,
            y: gy,
            z: gz,
            magnitude: mag,
            lastUpdated: now,
          };
          liveChanged = true;
          break; // IMU saved together in 'imu_accel' branch
        }

        // ── IMU Accel ───────────────────────────────────────────────────────────────────
        case 'imu_accel': {
          const ax = toFinite(parsed.ax_mg, nextLive.accel.x);
          const ay = toFinite(parsed.ay_mg, nextLive.accel.y);
          const az = toFinite(parsed.az_mg, nextLive.accel.z);
          
          // Validate rate-of-change: reject if any axis exceeds max delta
          if (!validateAccel('x', ax) || !validateAccel('y', ay) || !validateAccel('z', az)) {
            if (ENABLE_VERBOSE_PIPELINE_LOGS) {
              console.warn('[Pipeline] Accel sample rejected (spike detected)');
            }
            break;
          }
          
          const mag = magnitude(ax, ay, az);
          if (ENABLE_VERBOSE_PIPELINE_LOGS) {
            console.log(
              `[Pipeline] 📏 ACCEL X=${ax}mg  Y=${ay}mg  Z=${az}mg  |mag|=${mag.toFixed(0)}mg`
            );
          }
          nextLive.accel = {
            x: ax,
            y: ay,
            z: az,
            magnitude: mag,
            lastUpdated: now,
          };
          liveChanged = true;

          if (user && session.isRecording && canWriteToFirebase('imu')) {
            markFbWrite('imu');
            const gyroSnapshot = nextLive.gyro;
            // Save accel & gyro separately, then a combined IMU snapshot
            Promise.all([
              saveAccelerometerReading(user.uid, {
                x: ax, y: ay, z: az,
                rawX: parsed.rawX, rawY: parsed.rawY, rawZ: parsed.rawZ,
                magnitude: mag,
                deviceId, deviceName, sessionId,
              }),
              saveGyroscopeReading(user.uid, {
                x: gyroSnapshot.x,
                y: gyroSnapshot.y,
                z: gyroSnapshot.z,
                rawX: gyroSnapshot.x,
                rawY: gyroSnapshot.y,
                rawZ: gyroSnapshot.z,
                magnitude: gyroSnapshot.magnitude,
                deviceId,
                deviceName,
                sessionId,
              }),
              saveIMUReading(user.uid, {
                accelerometer: { x: ax, y: ay, z: az, magnitude: mag },
                gyroscope:     { x: gyroSnapshot.x, y: gyroSnapshot.y, z: gyroSnapshot.z },
                deviceId, deviceName, sessionId,
              }),
            ])
              .then(() => incDataPoints(3))
              .catch(err => console.error('[Pipeline] IMU save failed:', err));
          }
          break;
        }

        // ── IMU Combined (new calibrated firmware format) ─────────────────
        case 'imu_combined': {
          const ax = toFinite(parsed.ax_mg, nextLive.accel.x);
          const ay = toFinite(parsed.ay_mg, nextLive.accel.y);
          const az = toFinite(parsed.az_mg, nextLive.accel.z);
          const gx = toFinite(parsed.gx_mdps, nextLive.gyro.x);
          const gy = toFinite(parsed.gy_mdps, nextLive.gyro.y);
          const gz = toFinite(parsed.gz_mdps, nextLive.gyro.z);
          
          // Validate rate-of-change: reject if any axis exceeds max delta
          if (!validateAccel('x', ax) || !validateAccel('y', ay) || !validateAccel('z', az) ||
              !validateGyro('x', gx) || !validateGyro('y', gy) || !validateGyro('z', gz)) {
            if (ENABLE_VERBOSE_PIPELINE_LOGS) {
              console.warn('[Pipeline] IMU combined sample rejected (spike detected)');
            }
            break;
          }
          
          const accelMag = magnitude(ax, ay, az);
          const gyroMag = magnitude(gx, gy, gz);

          if (ENABLE_VERBOSE_PIPELINE_LOGS) {
            console.log(
              `[Pipeline] 📐 IMU  A=[${ax},${ay},${az}]mg G=[${gx},${gy},${gz}]mdps t=${parsed.uptimeMs}`
            );
          }

          nextLive.accel = {
            x: ax,
            y: ay,
            z: az,
            magnitude: accelMag,
            lastUpdated: now,
          };
          nextLive.gyro = {
            x: gx,
            y: gy,
            z: gz,
            magnitude: gyroMag,
            lastUpdated: now,
          };
          liveChanged = true;

          if (user && session.isRecording && canWriteToFirebase('imu')) {
            markFbWrite('imu');
            Promise.all([
              saveAccelerometerReading(user.uid, {
                x: ax,
                y: ay,
                z: az,
                rawX: ax,
                rawY: ay,
                rawZ: az,
                magnitude: accelMag,
                deviceId,
                deviceName,
                sessionId,
              }),
              saveGyroscopeReading(user.uid, {
                x: gx,
                y: gy,
                z: gz,
                rawX: gx,
                rawY: gy,
                rawZ: gz,
                magnitude: gyroMag,
                deviceId,
                deviceName,
                sessionId,
              }),
              saveIMUReading(user.uid, {
                accelerometer: {
                  x: ax,
                  y: ay,
                  z: az,
                  magnitude: accelMag,
                },
                gyroscope: {
                  x: gx,
                  y: gy,
                  z: gz,
                },
                deviceId,
                deviceName,
                sessionId,
              }),
            ])
              .then(() => incDataPoints(3))
              .catch(err => console.error('[Pipeline] IMU save failed:', err));
          }
          break;
        }

        // ── EDA ────────────────────────────────────────────────────────────
        case 'eda': {
          const rawADC = toFinite(parsed.rawADC, nextLive.eda.rawADC);
          const mv = toFinite(parsed.mv, nextLive.eda.mv);
          const rawConductance_uS = toFinite(parsed.uS ?? edaMvToMicrosiemens(mv), nextLive.eda.conductance_uS);
          const conductance_uS = validateEDA(rawConductance_uS); // Apply validation & spike rejection
          const stressLevel    = estimateStressLevel(conductance_uS);
          if (ENABLE_VERBOSE_PIPELINE_LOGS) {
            console.log(
              `[Pipeline] ⚡ EDA   raw=${rawADC}  mv=${mv}mV  conductance=${conductance_uS.toFixed(3)}µS  stress=${stressLevel}  delta=${parsed.deltaRaw}  flat=${parsed.flatCount}`
            );
          }
          nextLive.eda = { rawADC, mv, conductance_uS, stressLevel, lastUpdated: now };
          liveChanged = true;

          if (user && session.isRecording && canWriteToFirebase('eda')) {
            markFbWrite('eda');
            saveEDAReading(user.uid, {
              rawValue:    rawADC,
              voltage:     mv / 1000,
              resistance:  conductance_uS > 0 ? 1000 / conductance_uS : 0,
              conductance: conductance_uS, // Use validated value
              stressLevel,
              deviceId, deviceName, sessionId,
            })
              .then(() => incDataPoints())
              .catch(err => console.error('[Pipeline] EDA save failed:', err));
          }
          break;
        }
      }

      if (parseErrors >= MAX_PARSE_ERRORS_PER_TICK) {
        break;
      }
    }

    if (liveChanged) {
      setLive(nextLive);
      liveRef.current = nextLive;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receivedMessages]);

  // ─────────────────────────────────────────────────────────────────────────
  // Session management
  // ─────────────────────────────────────────────────────────────────────────

  const startSession = useCallback(async (sessionName?: string) => {
    if (!user) {
      console.warn('[Pipeline] Cannot start session – not logged in');
      return;
    }

    const name = sessionName || `Session ${new Date().toLocaleString()}`;

    try {
      const sessionId = await fbStartSession(user.uid, {
        sessionName:    name,
        deviceId:       connectedDevice?.id,
        deviceName:     connectedDeviceName || undefined,
        activeSensors:  [
          SensorType.TEMPERATURE,
          SensorType.PPG_IR,
          SensorType.PPG_RED,
          SensorType.PPG_GREEN,
          SensorType.ACCELEROMETER,
          SensorType.GYROSCOPE,
          SensorType.EDA,
        ],
      });

      setSession({
        sessionId,
        isRecording:    true,
        startedAt:      new Date(),
        dataPointsSaved: 0,
      });

      console.log('[Pipeline] ✅ Session started:', sessionId);
    } catch (err) {
      console.error('[Pipeline] Failed to start session:', err);
    }
  }, [user, connectedDevice, connectedDeviceName]);

  const stopSession = useCallback(async () => {
    if (!user || !session.sessionId) return;

    try {
      await fbEndSession(user.uid, session.sessionId, {
        qualityScore: 80, // Placeholder
      });

      console.log('[Pipeline] ✅ Session ended:', session.sessionId,
        '| Saved data points:', session.dataPointsSaved);

      setSession(prev => ({ ...prev, sessionId: null, isRecording: false }));
    } catch (err) {
      console.error('[Pipeline] Failed to end session:', err);
    }
  }, [user, session.sessionId, session.dataPointsSaved]);

  // Auto-stop session when device disconnects
  useEffect(() => {
    if (!isConnected && session.isRecording) {
      console.log('[Pipeline] Device disconnected \u2013 stopping active session');
      stopSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // Clear live values after disconnect so UI does not keep stale readings.
  useEffect(() => {
    if (isConnected) return;
    setLive(initialLiveState);
    liveRef.current = initialLiveState;
  }, [isConnected]);

  // Auto-stop session when user logs out.
  // This prevents in-flight Firestore writes after the auth token is revoked,
  // which would cause 'Missing or insufficient permissions' errors.
  useEffect(() => {
    if (!user && session.isRecording) {
      console.log('[Pipeline] User logged out \u2013 stopping active session');
      stopSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    /** Latest parsed sensor values (live, in-memory) */
    live,
    /** Current recording session state */
    session,
    /** Start a Firestore recording session */
    startSession,
    /** End the active recording session */
    stopSession,
  };
}
