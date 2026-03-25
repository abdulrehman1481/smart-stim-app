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

  // Firebase write throttle: track last write time per sensor type
  const lastFbWrite = useRef<Record<string, number>>({});

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

  /** Increment saved data point counter */
  const incDataPoints = useCallback((by = 1) => {
    setSession(prev => ({ ...prev, dataPointsSaved: prev.dataPointsSaved + by }));
  }, []);

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
    const newMessages = receivedMessages.slice(lastProcessedIdx.current);
    lastProcessedIdx.current = receivedMessages.length;

    if (newMessages.length === 0) return;

    newMessages.forEach(rawMsg => {
      // Strip the BLEContext timestamp prefix "[HH:MM:SS PM] RX: <line>"
      // Permissive pattern handles AM/PM and any locale time format.
      const line = rawMsg.replace(/^\[[^\]]+\]\s*RX:\s*/, '').trim();
      if (!line) return;

      // ── Diagnostic: log every raw line arriving from the device ──────────
      console.log('[Pipeline] RAW ←', line);

      const parsed = parseSensorLine(line);

      if (!parsed) {
        console.debug('[Pipeline] (not a sensor line):', line.slice(0, 80));
        return;
      }

      const now = new Date();
      const deviceId   = connectedDevice?.id;
      const deviceName = connectedDeviceName || undefined;
      const sessionId  = session.sessionId || undefined;

      switch (parsed.type) {
        // ── Temperature ────────────────────────────────────────────────────
        case 'temperature': {
          const tempF = celsiusToFahrenheit(parsed.tempC);
          console.log(
            `[Pipeline] 🌡️  TEMP  ${parsed.tempC.toFixed(2)}°C  (${tempF.toFixed(2)}°F)  rawADC=${parsed.rawADC}  uptime=${parsed.uptimeMs}ms`
          );
          setLive(prev => ({
            ...prev,
            temperature: { tempC: parsed.tempC, tempF, lastUpdated: now },
          }));

          if (user && session.isRecording && canWriteToFirebase('temperature')) {
            markFbWrite('temperature');
            saveTemperatureReading(user.uid, {
              temperature:            parsed.tempC,
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
          console.log(
            `[Pipeline] ❤️  PPG   RED=${parsed.red}  IR=${parsed.ir}  GREEN=${parsed.green}  avail=${parsed.available}`
          );
          setLive(prev => ({
            ...prev,
            ppg: { red: parsed.red, ir: parsed.ir, green: parsed.green, lastUpdated: now },
          }));

          if (user && session.isRecording && canWriteToFirebase('ppg')) {
            markFbWrite('ppg');
            // Save all three channels in parallel
            Promise.all([
              savePPGReading(user.uid, { channel: 'RED',   rawValue: parsed.red,   deviceId, deviceName, sessionId }),
              savePPGReading(user.uid, { channel: 'IR',    rawValue: parsed.ir,    deviceId, deviceName, sessionId }),
              savePPGReading(user.uid, { channel: 'GREEN', rawValue: parsed.green, deviceId, deviceName, sessionId }),
            ])
              .then(() => incDataPoints(3))
              .catch(err => console.error('[Pipeline] PPG save failed:', err));
          }
          break;
        }

        // ── IMU Gyro ───────────────────────────────────────────────────────
        case 'imu_gyro': {
          const mag = magnitude(parsed.gx_mdps, parsed.gy_mdps, parsed.gz_mdps);
          console.log(
            `[Pipeline] 🎯 GYRO  X=${parsed.gx_mdps}mdps  Y=${parsed.gy_mdps}mdps  Z=${parsed.gz_mdps}mdps  |mag|=${mag.toFixed(0)}`
          );
          setLive(prev => ({
            ...prev,
            gyro: {
              x: parsed.gx_mdps, y: parsed.gy_mdps, z: parsed.gz_mdps,
              magnitude: mag, lastUpdated: now,
            },
          }));
          break; // IMU saved together in 'imu_accel' branch
        }

        // ── IMU Accel ───────────────────────────────────────────────────────────────────
        case 'imu_accel': {
          const mag = magnitude(parsed.ax_mg, parsed.ay_mg, parsed.az_mg);
          console.log(
            `[Pipeline] 📏 ACCEL X=${parsed.ax_mg}mg  Y=${parsed.ay_mg}mg  Z=${parsed.az_mg}mg  |mag|=${mag.toFixed(0)}mg`
          );
          setLive(prev => ({
            ...prev,
            accel: {
              x: parsed.ax_mg, y: parsed.ay_mg, z: parsed.az_mg,
              magnitude: mag, lastUpdated: now,
            },
          }));

          if (user && session.isRecording && canWriteToFirebase('imu')) {
            markFbWrite('imu');
            // Save accel & gyro separately, then a combined IMU snapshot
            Promise.all([
              saveAccelerometerReading(user.uid, {
                x: parsed.ax_mg, y: parsed.ay_mg, z: parsed.az_mg,
                rawX: parsed.rawX, rawY: parsed.rawY, rawZ: parsed.rawZ,
                magnitude: mag,
                deviceId, deviceName, sessionId,
              }),
              saveIMUReading(user.uid, {
                accelerometer: { x: parsed.ax_mg, y: parsed.ay_mg, z: parsed.az_mg, magnitude: mag },
                gyroscope:     { x: 0, y: 0, z: 0 }, // updated on next gyro line
                deviceId, deviceName, sessionId,
              }),
            ])
              .then(() => incDataPoints(2))
              .catch(err => console.error('[Pipeline] IMU save failed:', err));
          }
          break;
        }

        // ── EDA ────────────────────────────────────────────────────────────
        case 'eda': {
          const conductance_uS = edaMvToMicrosiemens(parsed.mv);
          const stressLevel    = estimateStressLevel(conductance_uS);
          console.log(
            `[Pipeline] ⚡ EDA   raw=${parsed.rawADC}  mv=${parsed.mv}mV  conductance=${conductance_uS.toFixed(3)}µS  stress=${stressLevel}  delta=${parsed.deltaRaw}  flat=${parsed.flatCount}`
          );
          setLive(prev => ({
            ...prev,
            eda: { rawADC: parsed.rawADC, mv: parsed.mv, conductance_uS, stressLevel, lastUpdated: now },
          }));

          if (user && session.isRecording && canWriteToFirebase('eda')) {
            markFbWrite('eda');
            saveEDAReading(user.uid, {
              rawValue:    parsed.rawADC,
              voltage:     parsed.mv / 1000,
              resistance:  conductance_uS > 0 ? 1000 / conductance_uS : 0,
              conductance: conductance_uS,
              stressLevel,
              deviceId, deviceName, sessionId,
            })
              .then(() => incDataPoints())
              .catch(err => console.error('[Pipeline] EDA save failed:', err));
          }
          break;
        }
      }
    });
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
