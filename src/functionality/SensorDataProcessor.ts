/**
 * SensorDataProcessor.ts
 * 
 * Production-level utilities for safe sensor data handling:
 * - Throttling (prevent render storms)
 * - Smoothing (exponential moving average)
 * - Buffering (aggregate meaningful metrics)
 * - Memory leak prevention
 * 
 * ARCHITECTURE:
 *   BLE Stream (fast, noisy) → Buffer (raw data) → Processing (smooth/aggregate)
 *   → Throttle (200ms batches) → React State (slow, stable) → UI (smooth)
 */

/**
 * Safety check: prevent NaN, Infinity from breaking calculations.
 */
export function isSafeNumber(value: number): boolean {
  return !isNaN(value) && isFinite(value);
}

/**
 * Safety: clamp NaN/Infinity to sensible default.
 */
export function safeNumber(value: number, fallback: number = 0): number {
  return isSafeNumber(value) ? value : fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THROTTLE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple throttle: calls function at most once every `intervalMs`.
 * 
 * Usage:
 *   const throttledUpdate = createThrottle((data) => setGyro(data), 200);
 *   sensor.on('data', throttledUpdate);
 */
export function createThrottle<T extends any[]>(
  fn: (...args: T) => void,
  intervalMs: number
): (...args: T) => void {
  let lastRun = 0;
  let pendingArgs: T | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: T) => {
    const now = Date.now();
    const elapsed = now - lastRun;

    if (elapsed >= intervalMs) {
      // Enough time has passed, run immediately
      fn(...args);
      lastRun = now;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    } else {
      // Too soon, queue for later
      pendingArgs = args;
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          if (pendingArgs) {
            fn(...pendingArgs);
            lastRun = Date.now();
          }
          timeoutId = null;
          pendingArgs = null;
        }, intervalMs - elapsed);
      }
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SMOOTHING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exponential moving average (EMA): smooths spiky data.
 * 
 * When α=0.2 (20% new, 80% old):
 * - Normal changes pass through immediately
 * - Spikes are smoothed over ~5 samples
 * - Damping factor: ~0.8^5 ≈ 0.33 (spike reduced by 67%)
 * 
 * Usage:
 *   const smoother = new ExponentialSmoother(0.2);
 *   const smoothed = smoother.update(rawValue);
 */
export class ExponentialSmoother {
  private value: number = 0;
  private hasValue: boolean = false;

  constructor(private alpha: number = 0.2) {}

  update(newValue: number): number {
    if (!this.hasValue) {
      this.value = newValue;
      this.hasValue = true;
    } else {
      this.value = this.alpha * newValue + (1 - this.alpha) * this.value;
    }
    return this.value;
  }

  reset(): void {
    this.hasValue = false;
    this.value = 0;
  }
}

/**
 * Clamp value to [min, max] range.
 * Prevents outliers from affecting calculations.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BUFFER UTILITIES (with overflow protection)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Circular buffer for storing sensor readings.
 * Automatically drops oldest data when capacity is reached.
 * 
 * Usage:
 *   const buffer = new CircularBuffer(100);
 *   buffer.push(value);
 *   const avg = buffer.average();
 */
export class CircularBuffer {
  private data: number[] = [];
  private index: number = 0;

  constructor(private capacity: number) {}

  push(value: number): void {
    if (this.data.length < this.capacity) {
      this.data.push(value);
    } else {
      this.data[this.index] = value;
      this.index = (this.index + 1) % this.capacity;
    }
  }

  average(): number {
    if (this.data.length === 0) return 0;
    const sum = this.data.reduce((a, b) => a + b, 0);
    return sum / this.data.length;
  }

  max(): number {
    return this.data.length === 0 ? 0 : Math.max(...this.data);
  }

  min(): number {
    return this.data.length === 0 ? 0 : Math.min(...this.data);
  }

  stdDev(): number {
    if (this.data.length === 0) return 0;
    const avg = this.average();
    const variance =
      this.data.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
      this.data.length;
    return Math.sqrt(variance);
  }

  get length(): number {
    return this.data.length;
  }

  getAll(): number[] {
    return [...this.data];
  }

  clear(): void {
    this.data = [];
    this.index = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. VECTOR UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Calculate magnitude (length) of a 3D vector.
 * sqrt(x² + y² + z²)
 */
export function magnitude(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Detect if motion is significant.
 * Returns true if magnitude exceeds threshold.
 */
export function isMotionDetected(
  v: Vector3,
  threshold: number = 500 // mdps for gyro, mg for accel
): boolean {
  return magnitude(v) > threshold;
}

/**
 * Get direction of motion (which axis has max component).
 */
export function getMotionDirection(v: Vector3): 'x' | 'y' | 'z' | 'none' {
  const abs = { x: Math.abs(v.x), y: Math.abs(v.y), z: Math.abs(v.z) };
  if (abs.x > abs.y && abs.x > abs.z) return 'x';
  if (abs.y > abs.z) return 'y';
  if (abs.z > 0) return 'z';
  return 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SAFETY GUARDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rate-of-change detector: prevent spikes in processed data.
 * 
 * If new value differs from previous by more than maxDelta,
 * returns clamped value instead.
 */
export function detectSpike(
  prevValue: number,
  newValue: number,
  maxDelta: number
): { isSpikeDetected: boolean; clampedValue: number } {
  const delta = Math.abs(newValue - prevValue);
  if (delta > maxDelta) {
    const clampedValue = prevValue + Math.sign(newValue - prevValue) * maxDelta;
    return { isSpikeDetected: true, clampedValue };
  }
  return { isSpikeDetected: false, clampedValue: newValue };
}

/**
 * Memory safety: prevent buffer from growing unbounded.
 * Call periodically to ensure buffers don't consume all app memory.
 */
export function enforceBufferLimit<T>(
  buffer: T[],
  maxSize: number
): T[] {
  if (buffer.length > maxSize) {
    return buffer.slice(-maxSize);
  }
  return buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. AGGREGATION UTILITIES (compute meaningful metrics)
// ─────────────────────────────────────────────────────────────────────────────

export interface AggregatedMotionMetrics {
  avgMagnitude: number;
  maxMagnitude: number;
  isMoving: boolean;
  direction: 'x' | 'y' | 'z' | 'none';
  sampleCount: number;
}

/**
 * Aggregate gyro/accel data into meaningful motion metrics.
 * 
 * Instead of showing raw X, Y, Z values:
 * - Show average motion magnitude (motion intensity)
 * - Show peak magnitude (spike detection)
 * - Show motion direction
 * - Show if motion is currently detected
 * 
 * SAFETY: All values are clamped to valid ranges (no NaN/Infinity)
 */
export function aggregateMotionData(
  readings: Vector3[],
  motionThreshold: number = 500
): AggregatedMotionMetrics {
  if (readings.length === 0) {
    return {
      avgMagnitude: 0,
      maxMagnitude: 0,
      isMoving: false,
      direction: 'none',
      sampleCount: 0,
    };
  }

  // Safety: calculate magnitudes with bounds checking
  const magnitudes: number[] = [];
  for (let i = 0; i < readings.length; i++) {
    const r = readings[i];
    if (!r || typeof r.x !== 'number' || typeof r.y !== 'number' || typeof r.z !== 'number') {
      continue;
    }
    const mag = magnitude(r);
    if (isSafeNumber(mag)) {
      magnitudes.push(mag);
    }
  }

  if (magnitudes.length === 0) {
    return {
      avgMagnitude: 0,
      maxMagnitude: 0,
      isMoving: false,
      direction: 'none',
      sampleCount: 0,
    };
  }

  const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
  const maxMagnitude = Math.max(...magnitudes);
  const lastReading = readings[readings.length - 1];
  
  // Safety: ensure values are safe numbers
  const safeAvg = safeNumber(avgMagnitude, 0);
  const safeMax = safeNumber(maxMagnitude, 0);
  const lastReadingValid = lastReading && isSafeNumber(lastReading.x) && isSafeNumber(lastReading.y) && isSafeNumber(lastReading.z);

  return {
    avgMagnitude: Math.round(safeAvg),
    maxMagnitude: Math.round(safeMax),
    isMoving: lastReadingValid ? magnitude(lastReading) > motionThreshold : false,
    direction: lastReadingValid ? getMotionDirection(lastReading) : 'none',
    sampleCount: magnitudes.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. HEART RATE CALCULATION (from PPG)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple peak detection for PPG signal to estimate heart rate.
 * Looks for plateaus in IR channel (most stable for HR).
 * 
 * Returns HR in BPM if enough samples, else null.
 */
export function estimateHeartRate(
  irReadings: number[],
  samplingRateHz: number = 100
): number | null {
  if (irReadings.length < 100) return null; // Need 1+ seconds of data

  // Detect peaks (local maxima with simple threshold)
  let peakCount = 0;
  for (let i = 1; i < irReadings.length - 1; i++) {
    if (
      irReadings[i] > irReadings[i - 1] &&
      irReadings[i] > irReadings[i + 1]
    ) {
      peakCount++;
    }
  }

  if (peakCount === 0) return null;

  // Estimate: peaks per second × 60 = BPM
  const durationSeconds = irReadings.length / samplingRateHz;
  const peaksPerSecond = peakCount / durationSeconds;
  const estimatedHR = Math.round(peaksPerSecond * 60);

  // Sanity check: HR should be 40-200 BPM
  if (estimatedHR < 40 || estimatedHR > 200) return null;

  return estimatedHR;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. STRESS LEVEL ESTIMATION (from EDA)
// ─────────────────────────────────────────────────────────────────────────────

export type StressLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

/**
 * Estimate stress from EDA readings using magnitude and variability.
 * 
 * Returns: LOW (baseline), MEDIUM (normal activity), HIGH (stress), VERY_HIGH (acute stress)
 * 
 * SAFETY: Handles edge cases (empty arrays, NaN values, invalid inputs)
 */
export function estimateStressLevel(edaReadings: number[]): StressLevel {
  if (!edaReadings || edaReadings.length < 1) return 'LOW';

  // Filter out invalid values (NaN, Infinity, negative)
  const validReadings = edaReadings.filter(val => isSafeNumber(val) && val >= 0);
  if (validReadings.length === 0) return 'LOW';

  // Use last 50 samples for recent stress assessment
  const recent = validReadings.slice(-50);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;

  // Calculate variability (changes indicate emotional activity)
  let totalDelta = 0;
  for (let i = 1; i < recent.length; i++) {
    const delta = Math.abs(recent[i] - recent[i - 1]);
    if (isSafeNumber(delta)) {
      totalDelta += delta;
    }
  }
  const avgDelta = totalDelta / recent.length;

  // Safety: ensure values are valid before classification
  if (!isSafeNumber(avg) || !isSafeNumber(avgDelta)) {
    return 'LOW';
  }

  // Classify based on both magnitude and variability
  if (avg < 100 && avgDelta < 5) return 'LOW';
  if (avg < 200 || avgDelta < 15) return 'MEDIUM';
  if (avg < 400 || avgDelta < 30) return 'HIGH';
  return 'VERY_HIGH';
}
