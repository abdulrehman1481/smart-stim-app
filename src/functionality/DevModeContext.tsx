import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ──────────────────────────────────────────────────────────────────────
export type SensorKey = 'ppgGreen' | 'ppgIR' | 'ppgRed' | 'accel' | 'gyro' | 'temp' | 'eda';

export const ALL_SENSOR_KEYS: SensorKey[] = [
  'ppgGreen', 'ppgIR', 'ppgRed', 'accel', 'gyro', 'temp', 'eda',
];

export const SENSOR_LABELS: Record<SensorKey, string> = {
  ppgGreen: 'PPG Green',
  ppgIR: 'PPG IR',
  ppgRed: 'PPG Red',
  accel: 'Accelerometer',
  gyro: 'Gyroscope',
  temp: 'Temperature',
  eda: 'Electrodermal Activity',
};

type SensorToggles = Record<SensorKey, boolean>;

interface DevModeContextType {
  isDevMode: boolean;
  enableDevMode: (password: string) => boolean;
  disableDevMode: () => void;
  sensorToggles: SensorToggles;
  toggleSensor: (key: SensorKey) => void;
  enabledSensorCount: number;
}

const DEV_PASSWORD = 'dev1234';
const STORAGE_KEY = 'dev_mode_settings';

const defaultToggles: SensorToggles = {
  ppgGreen: true,
  ppgIR: true,
  ppgRed: true,
  accel: true,
  gyro: true,
  temp: true,
  eda: true,
};

// ─── Context ────────────────────────────────────────────────────────────────────
const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

export function useDevMode(): DevModeContextType {
  const ctx = useContext(DevModeContext);
  if (!ctx) throw new Error('useDevMode must be used within DevModeProvider');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────────
interface DevModeProviderProps { children: ReactNode }

export function DevModeProvider({ children }: DevModeProviderProps) {
  const [isDevMode, setIsDevMode] = useState(false);
  const [sensorToggles, setSensorToggles] = useState<SensorToggles>(defaultToggles);

  // Load persisted state
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed.isDevMode === 'boolean') setIsDevMode(parsed.isDevMode);
          if (parsed.sensorToggles) setSensorToggles({ ...defaultToggles, ...parsed.sensorToggles });
        } catch { /* ignore corrupt data */ }
      })
      .catch(() => { /* ignore */ });
  }, []);

  // Persist on change
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ isDevMode, sensorToggles })).catch(() => {});
  }, [isDevMode, sensorToggles]);

  const enableDevMode = useCallback((password: string): boolean => {
    if (password === DEV_PASSWORD) {
      setIsDevMode(true);
      return true;
    }
    return false;
  }, []);

  const disableDevMode = useCallback(() => {
    setIsDevMode(false);
  }, []);

  const toggleSensor = useCallback((key: SensorKey) => {
    setSensorToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const enabledSensorCount = Object.values(sensorToggles).filter(Boolean).length;

  return (
    <DevModeContext.Provider
      value={{ isDevMode, enableDevMode, disableDevMode, sensorToggles, toggleSensor, enabledSensorCount }}
    >
      {children}
    </DevModeContext.Provider>
  );
}
