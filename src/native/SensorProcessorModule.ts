/**
 * SensorProcessorModule: JS wrapper for native SensorProcessor
 *
 * This file provides TypeScript types and helper functions for interacting
 * with the native SensorProcessor module.
 */

import { NativeModules, NativeEventEmitter } from 'react-native';

const NativeSensorProcessor = NativeModules.SensorProcessor;

if (!NativeSensorProcessor) {
  console.warn(
    '[SensorProcessor] Native module not found. ' +
    'Make sure the SensorProcessor module is properly registered in Android build.'
  );
}

/**
 * Event emitter for sensor events
 */
export const sensorEventEmitter = new NativeEventEmitter(NativeSensorProcessor);

/**
 * Enqueue sensor data for processing
 *
 * @param sensor - Sensor type: 'hr', 'temp', 'eda', or 'gyro'
 * @param value - Array of values: [scalar] for most, [x, y, z] for gyro
 */
export async function enqueueSensorData(
  sensor: 'hr' | 'temp' | 'eda' | 'gyro',
  value: number[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!NativeSensorProcessor) {
      reject(new Error('SensorProcessor native module not available'));
      return;
    }

    try {
      NativeSensorProcessor.enqueueSensorData(sensor, value);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Clear all sensor state
 */
export async function clearSensorState(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!NativeSensorProcessor) {
      reject(new Error('SensorProcessor native module not available'));
      return;
    }

    try {
      NativeSensorProcessor.clearSensorState();
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get current sensor modes (normal vs spike)
 */
export async function getSensorModes(): Promise<{
  [key: string]: boolean;
}> {
  return new Promise((resolve, reject) => {
    if (!NativeSensorProcessor) {
      reject(new Error('SensorProcessor native module not available'));
      return;
    }

    try {
      NativeSensorProcessor.getSensorModes((modes: any) => {
        resolve(modes || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Subscribe to batch sensor events
 *
 * @param callback - Called with { sensor, readings, timestamp }
 * @returns Unsubscribe function
 */
export function onSensorBatch(
  callback: (data: {
    sensor: string;
    readings: number[];
    timestamp: number;
  }) => void
): () => void {
  const subscription = sensorEventEmitter.addListener('SensorBatch', callback);
  return () => subscription.remove();
}

/**
 * Subscribe to spike events
 *
 * @param callback - Called with { sensor, value, delta, baseline, timestamp }
 * @returns Unsubscribe function
 */
export function onSensorSpike(
  callback: (data: {
    sensor: string;
    value: number;
    delta: number;
    baseline: number;
    timestamp: number;
  }) => void
): () => void {
  const subscription = sensorEventEmitter.addListener('SensorSpike', callback);
  return () => subscription.remove();
}

/**
 * Check if native module is available
 */
export function isNativeModuleAvailable(): boolean {
  return !!NativeSensorProcessor;
}

/**
 * Get native module info
 */
export function getNativeModuleInfo() {
  return {
    available: isNativeModuleAvailable(),
    module: NativeSensorProcessor ? 'SensorProcessor' : null,
  };
}
