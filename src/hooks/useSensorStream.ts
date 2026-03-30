/**
 * useSensorStream: Production-grade sensor data pipeline management
 *
 * This hook manages:
 * - Raw sensor data in useRef (zero re-renders per packet)
 * - UI display values in useState (fixed 200ms polling)
 * - Native module event listeners for SensorBatch and SensorSpike
 * - Auto-cleanup of listeners and timers
 *
 * LAYER 4 & 5 of the pipeline
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';

interface SensorAlert {
  sensor: string;
  value: number;
  delta: number;
  baseline: number;
  timestamp: number;
}

interface UseSensorStreamReturn {
  // Raw current values (from refs, safe to read anytime)
  heartRate: number;
  temperature: number;
  eda: number;
  gyroscope: { x: number; y: number; z: number };

  // UI display values (updated every 200ms)
  displayHR: number;
  displayEDA: number;
  displayTemp: number;
  displayGyro: { x: number; y: number; z: number };

  // Alerts from spike detection
  spikeAlert: SensorAlert | null;

  // Control methods
  clearAlert: () => void;
  isConnected: boolean;
  sensorModes: { [key: string]: boolean }; // true = spike mode
}

const sensorProcessorModule = NativeModules.SensorProcessor;
const deviceEmitter = sensorProcessorModule ? new NativeEventEmitter(sensorProcessorModule) : null;

export function useSensorStream(): UseSensorStreamReturn {
  // ===== RAW DATA IN REFS (no re-renders) =====
  const heartRateRef = useRef<number>(0);
  const temperatureRef = useRef<number>(0);
  const edaRef = useRef<number>(0);
  const gyroRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  // ===== UI STATE (200ms polling) =====
  const [displayHR, setDisplayHR] = useState<number>(0);
  const [displayEDA, setDisplayEDA] = useState<number>(0);
  const [displayTemp, setDisplayTemp] = useState<number>(0);
  const [displayGyro, setDisplayGyro] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  // ===== SPIKE ALERTS (immediate state update) =====
  const [spikeAlert, setSpikeAlert] = useState<SensorAlert | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [sensorModes, setSensorModes] = useState<{ [key: string]: boolean }>({});

  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ===== CLEANUP HELPER =====
  const clearAlert = useCallback(() => {
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = null;
    }
    setSpikeAlert(null);
  }, []);

  // ===== MAIN EFFECT =====
  useEffect(() => {
    let isMounted = true;
    let pollerInterval: ReturnType<typeof setInterval> | null = null;
    let batchSubscription: any = null;
    let spikeSubscription: any = null;
    let modeCheckerInterval: ReturnType<typeof setInterval> | null = null;

    const setupListeners = async () => {
      try {
        if (!deviceEmitter) {
          if (isMounted) {
            setIsConnected(false);
          }
          return;
        }

        // ===== BATCH LISTENER: writes to refs only =====
        batchSubscription = deviceEmitter.addListener(
          'SensorBatch',
          ({ sensor, readings }) => {
            if (!isMounted) return;
            if (!Array.isArray(readings) || readings.length === 0) return;

            const latest = readings[readings.length - 1];

            switch (sensor) {
              case 'hr':
                heartRateRef.current = latest;
                break;
              case 'eda':
                edaRef.current = latest;
                break;
              case 'temp':
                temperatureRef.current = latest;
                break;
              case 'gyro':
                // If gyro is sent as array [x, y, z]
                if (Array.isArray(latest)) {
                  gyroRef.current = { x: latest[0], y: latest[1], z: latest[2] };
                } else if (typeof latest === 'number') {
                  // Magnitude only
                  gyroRef.current = { x: latest, y: 0, z: 0 };
                }
                break;
            }
          }
        );

        // ===== SPIKE LISTENER: immediate state update (causes re-render) =====
        spikeSubscription = deviceEmitter.addListener(
          'SensorSpike',
          (alert: SensorAlert) => {
            if (!isMounted) return;

            setSpikeAlert(alert);
            setIsConnected(true);

            // Auto-dismiss after 5 seconds
            if (alertTimeoutRef.current) {
              clearTimeout(alertTimeoutRef.current);
            }
            alertTimeoutRef.current = setTimeout(() => {
              if (isMounted) {
                setSpikeAlert(null);
              }
            }, 5000);
          }
        );

        // ===== UI POLLER: update display from refs every 200ms =====
        pollerInterval = setInterval(() => {
          if (!isMounted) return;

          setDisplayHR(heartRateRef.current);
          setDisplayEDA(edaRef.current);
          setDisplayTemp(temperatureRef.current);
          setDisplayGyro({ ...gyroRef.current });
        }, 200);

        // ===== SENSOR MODE CHECKER: poll native module every 1s =====
        modeCheckerInterval = setInterval(() => {
          if (!isMounted) return;

          NativeModules.SensorProcessor?.getSensorModes?.((modes: any) => {
            if (isMounted) {
              setSensorModes(modes || {});
            }
          });
        }, 1000);
      } catch (error) {
        console.error('[useSensorStream] Setup failed:', error);
        if (isMounted) {
          setIsConnected(false);
        }
      }
    };

    setupListeners();

    // ===== CLEANUP =====
    return () => {
      isMounted = false;

      if (pollerInterval) {
        clearInterval(pollerInterval);
      }

      if (modeCheckerInterval) {
        clearInterval(modeCheckerInterval);
      }

      if (batchSubscription) {
        try {
          batchSubscription.remove();
        } catch {
          // Ignore stale listener cleanup races on disconnect.
        }
      }

      if (spikeSubscription) {
        try {
          spikeSubscription.remove();
        } catch {
          // Ignore stale listener cleanup races on disconnect.
        }
      }

      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
    };
  }, [clearAlert]);

  return {
    // Current raw values
    heartRate: heartRateRef.current,
    temperature: temperatureRef.current,
    eda: edaRef.current,
    gyroscope: gyroRef.current,

    // Display values (polled at 5Hz)
    displayHR,
    displayEDA,
    displayTemp,
    displayGyro,

    // Alerts
    spikeAlert,
    clearAlert,

    // Connection state
    isConnected,
    sensorModes,
  };
}
