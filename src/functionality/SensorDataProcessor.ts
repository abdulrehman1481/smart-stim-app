/**
 * SensorDataProcessor.ts
 * 
 * Production-level utilities for safe sensor data handling:
 * - Sampling Gate (drop excess BLE packets early)
 * - Scheduled Processing (batch processing on intervals, not per-event)
 * - Throttling (prevent render storms)
 * - Smoothing (exponential moving average)
 * - Buffering (aggregate meaningful metrics)
 * - Memory leak prevention
 * 
 * ARCHITECTURE:
 *   BLE Stream (fast, noisy)
 *     ↓ [Sampling Gate: drop 60-80% of packets]
 *   Parsing Layer (safe, validated)
 *     ↓ [Queue parsed data]
 *   Scheduled Processing (process every 100-200ms, NOT per event)
 *     ↓ [Aggregation: smooth/compute metrics]
 *   Throttle + Rate Limiter (200ms batches)
 *     ↓
 *   React State (slow, stable) → UI (smooth)
 * 
 * KEY RULES:
 *   1. ❌ Do NOT process every BLE packet
 *   2. 💪 High-frequency sensors MUST be downsampled BEFORE parsing
 *   3. 📅 Processing runs on SCHEDULE, not per-event
 *   4. 📺 UI updates at FIXED INTERVALS, not data arrival based
 *   5. 🗑️ Drop data when overloaded instead of trying to keep up
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
// 1. SAMPLING GATE (drop excess data before processing) 🔥 KEY OPTIMIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sampling Gate: Drop incoming BLE packets to prevent processing overload.
 * 
 * The problem:
 *   LSM6DSO streams 104 Hz → 100+ packets/second
 *   High-frequency data causes React to re-render 100+ times/second
 *   App becomes unresponsive, battery drains fast
 * 
 * The solution:
 *   Drop 60-80% of packets IMMEDIATELY (before parsing/processing)
 *   Keep only 1 in N packets, e.g., keep every 3rd packet from 104 Hz → 35 Hz effective
 *   App processes only ~35 Hz instead of 104 Hz
 *   User still perceives smooth motion (35 Hz > 30 Hz human perception threshold)
 * 
 * IMPORTANT: Drop happens at BLE reception, not after expensive processing
 * 
 * Usage:
 *   const gate = new SamplingGate(3); // Keep 1 in 3 packets (drop 66%)
 *   if (gate.shouldProcess()) {
 *     parseAndProcess(data);
 *   } // else: silently drop this packet, save CPU
 */
export class SamplingGate {
  private packetCount: number = 0;

  /**
   * @param keepRatio - Keep 1 in N packets. E.g., keepRatio=3 → keep every 3rd packet
   *   - keepRatio=1 → keep all (100%)
   *   - keepRatio=2 → keep every 2nd (50%)
   *   - keepRatio=3 → keep every 3rd (33%)
   *   - keepRatio=5 → keep every 5th (20%)
   */
  constructor(private keepRatio: number = 3) {
    if (keepRatio < 1) {
      throw new Error('keepRatio must be >= 1');
    }
  }

  /**
   * Check if current packet should be processed.
   * Returns true for approximately 1-in-keepRatio packets.
   */
  shouldProcess(): boolean {
    const result = this.packetCount % this.keepRatio === 0;
    this.packetCount++;
    return result;
  }

  /**
   * Reset counter (useful for debugging or when sensor reconnects).
   */
  reset(): void {
    this.packetCount = 0;
  }

  /**
   * Get statistics about sampling.
   */
  getStats(): { packetsReceived: number; packetsKept: number; dropPercentage: number } {
    return {
      packetsReceived: this.packetCount,
      packetsKept: Math.ceil(this.packetCount / this.keepRatio),
      dropPercentage: Math.round(((this.keepRatio - 1) / this.keepRatio) * 100),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SCHEDULED PROCESSING (batch processing on intervals) 🔥 KEY OPTIMIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scheduled Processor: Queue incoming data and process on fixed intervals.
 * 
 * The problem:
 *   Processing on every BLE notification → 100+ processing calls/sec
 *   Each processing call does work: smoothing, aggregation, Firebase writes
 *   App can't keep up, drops data or crashes
 * 
 * The solution:
 *   1. Queue parsed sensor data (cheap operation)
 *   2. On a schedule (every 100-200ms), process ALL queued data at once
 *   3. Drain queue in batch, aggregate across batch
 *   4. Single state update per batch → single re-render
 * 
 * IMPORTANT: Processing is decoupled from data arrival
 * 
 * Benefits:
 *   - App never falls behind (data is queued, not dropped)
 *   - Processing is predictable (always on schedule)
 *   - Aggregation is more meaningful (averages across time window)
 *   - Battery life improves (fewer operations, fewer re-renders)
 * 
 * Usage:
 *   const processor = new ScheduledProcessor(() => {
 *     // This runs every 100ms regardless of BLE packet frequency
 *     const batchData = queue.drain();
 *     processAndUpdateState(batchData);
 *   }, 100); // milliseconds
 *   
 *   processor.start();
 *   // ... app runs ...
 *   processor.stop();
 */
export class ScheduledProcessor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;

  constructor(private processFn: () => void, private intervalMs: number = 100) {}

  /**
   * Start the scheduled processing loop.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.intervalId = setInterval(() => {
      try {
        this.processFn();
      } catch (error) {
        console.warn('[ScheduledProcessor] Error during processing:', error);
      }
    }, this.intervalMs);
  }

  /**
   * Stop the scheduled processing loop.
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * Trigger processing immediately (useful for testing or emergency flush).
   */
  forceProcess(): void {
    try {
      this.processFn();
    } catch (error) {
      console.warn('[ScheduledProcessor] Error during forced processing:', error);
    }
  }

  /**
   * Check if processor is currently running.
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Data Queue: Thread-safe queue for holding parsed sensor readings.
 * 
 * Usage:
 *   const queue = new SensorDataQueue();
 *   
 *   // On BLE notification (fast)
 *   const parsed = parseSensorLine(line);
 *   queue.enqueue(parsed);
 *   
 *   // On scheduled processor interval (slow, controlled)
 *   const batch = queue.drain();
 *   processAndUpdateState(batch);
 */
export class SensorDataQueue<T> {
  private queue: T[] = [];

  /**
   * Add item to queue.
   */
  enqueue(item: T): void {
    if (this.queue.length > 1000) {
      // Safety: prevent unbounded queue growth
      console.warn('[SensorDataQueue] Queue exceeded 1000 items, dropping oldest');
      this.queue.shift();
    }
    this.queue.push(item);
  }

  /**
   * Remove and return all items in queue.
   */
  drain(): T[] {
    const items = this.queue;
    this.queue = [];
    return items;
  }

  /**
   * Peek at queue without removing items.
   */
  peek(): T | undefined {
    return this.queue[0];
  }

  /**
   * Get current queue size.
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Clear queue.
   */
  clear(): void {
    this.queue = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. THROTTLE UTILITIES
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
// 4. SMOOTHING UTILITIES
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
// 5. BUFFER UTILITIES (with overflow protection)
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
// 6. VECTOR UTILITIES
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
// 7. SAFETY GUARDS
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
// 8. ROLLING AVERAGE WITH SPIKE DETECTION (Heart Rate Smoothing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Heart Rate Rolling Average: smooths PPG data and rejects spikes.
 * 
 * Strategy:
 *   - Keep buffer of last 5 HR samples
 *   - Compare incoming value to rolling average
 *   - If value is >30% away from average, discard it as a spike
 *   - Return smoothed HR value or previous if rejected
 * 
 * Why this works:
 *   - Normal HR changes: ±1-5 bpm per sample (tiny, <1%)
 *   - Electromagnetic noise: sudden jump 70→200 bpm (>100%)
 *   - 30% threshold catches noise while allowing normal exercise response
 * 
 * Usage:
 *   const hrFilter = new RollingAverageFilter(5, 0.30);
 *   const cleanHR = hrFilter.update(rawHRfromPPG);
 */
export class RollingAverageFilter {
  private buffer: number[] = [];
  private lastValidValue: number = 0;
  private hasValue: boolean = false;

  /**
   * @param bufferSize - Number of samples to average (default 5 for smooth motion detection)
   * @param spikeThreshold - Reject values >threshold % away from average (default 0.30 = 30%)
   */
  constructor(
    private bufferSize: number = 5,
    private spikeThreshold: number = 0.30
  ) {}

  /**
   * Process new value: update buffer, detect spikes, return smoothed value.
   * 
   * @returns Smoothed value (either new value averaged, or previous if rejected)
   */
  update(newValue: number): number {
    // Safety: reject non-finite values
    if (!Number.isFinite(newValue)) {
      return this.lastValidValue;
    }

    // Initialize first valid value
    if (!this.hasValue) {
      this.lastValidValue = newValue;
      this.buffer = [newValue];
      this.hasValue = true;
      return newValue;
    }

    // Calculate current average before adding new value
    const currentAvg =
      this.buffer.length > 0
        ? this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length
        : this.lastValidValue;

    // Detect spike: is new value too far from current average?
    const percentDelta = Math.abs(newValue - currentAvg) / (currentAvg || 1);
    if (percentDelta > this.spikeThreshold) {
      // Spike detected, reject and return last valid value
      return this.lastValidValue;
    }

    // Valid value: add to buffer
    this.buffer.push(newValue);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift(); // Remove oldest to maintain fixed size
    }

    // Calculate new smoothed average
    const smoothedValue = this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length;
    this.lastValidValue = smoothedValue;

    return smoothedValue;
  }

  /**
   * Get statistics about filtering.
   */
  getStats(): {
    bufferSize: number;
    currentAverage: number;
    bufferValues: number[];
  } {
    const avg =
      this.buffer.length > 0
        ? this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length
        : 0;
    return {
      bufferSize: this.buffer.length,
      currentAverage: avg,
      bufferValues: [...this.buffer],
    };
  }

  /**
   * Reset filter (useful for new session or sensor reconnect).
   */
  reset(): void {
    this.buffer = [];
    this.lastValidValue = 0;
    this.hasValue = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. IMU VALIDATION (Crash Prevention)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IMU Data: All 6 fields from LSM6DSO (accel + gyro).
 */
export interface IMUData {
  ax_mg: number;
  ay_mg: number;
  az_mg: number;
  gx_mdps: number;
  gy_mdps: number;
  gz_mdps: number;
}

/**
 * Validate and parse IMU data: Ensure all 6 fields are finite numbers.
 * 
 * This is the "Garbage Disposal" for IMU data:
 *   - Validates each field independently
 *   - Returns null if ANY field is NaN, Infinity, or missing
 *   - Prevents partial objects from corrupting state
 * 
 * The Problem:
 *   If even one field is NaN, it can propagate through calculations:
 *   - magnitude = sqrt(NaN² + 50² + 50²) = NaN
 *   - isMotionDetected(NaN) returns false (breaks motion detection)
 *   - State updates with NaN → UI renders "NaN" or crashes
 * 
 * The Solution:
 *   Validate all 6 before accepting ANY value.
 *   Return null instead of partial object.
 *   Caller decides what to do (reject packet, use previous, etc.)
 * 
 * Usage:
 *   const parsed = { ax_mg: 123, ay_mg: 45, az_mg: 92, gx_mdps: 10, gy_mdps: -5, gz_mdps: 8 };
 *   const valid = parseAndValidateIMU(parsed);
 *   if (valid) {
 *     updateState(valid);  ← safe, all fields verified
 *   }
 */
export function parseAndValidateIMU(data: any): IMUData | null {
  try {
    // Extract fields
    const ax_mg = parseFloat(data.ax_mg);
    const ay_mg = parseFloat(data.ay_mg);
    const az_mg = parseFloat(data.az_mg);
    const gx_mdps = parseFloat(data.gx_mdps);
    const gy_mdps = parseFloat(data.gy_mdps);
    const gz_mdps = parseFloat(data.gz_mdps);

    // CRASH PREVENTION: Validate all 6 fields
    // If ANY field is NaN or Infinity, reject entire packet
    const allFields = [ax_mg, ay_mg, az_mg, gx_mdps, gy_mdps, gz_mdps];
    for (const field of allFields) {
      if (!Number.isFinite(field)) {
        console.warn(
          '[parseAndValidateIMU] Invalid IMU field detected. Raw:',
          JSON.stringify(data)
        );
        return null; // ← CRITICAL: reject instead of returning partial
      }
    }

    // All fields valid: return complete object
    return {
      ax_mg,
      ay_mg,
      az_mg,
      gx_mdps,
      gy_mdps,
      gz_mdps,
    };
  } catch (error) {
    console.warn('[parseAndValidateIMU] Exception during validation:', error);
    return null;
  }
}

/**
 * Helper: Check if IMU data looks like a sensor malfunction.
 * 
 * Returns warning string if data exceeds reasonable firmware bounds.
 * (Note: This is for logging/monitoring, not rejection - bounds checking
 * should happen in the pipeline layer with firmware spec tolerances.)
 */
export function checkIMUSanity(imu: IMUData): string | null {
  const axceedsFirmware = Math.abs(imu.ax_mg) > 16_000;
  const ayExceedsFirmware = Math.abs(imu.ay_mg) > 16_000;
  const azExceedsFirmware = Math.abs(imu.az_mg) > 16_000;
  const gxExceedsFirmware = Math.abs(imu.gx_mdps) > 250_000;
  const gyExceedsFirmware = Math.abs(imu.gy_mdps) > 250_000;
  const gzExceedsFirmware = Math.abs(imu.gz_mdps) > 250_000;

  if (axceedsFirmware || ayExceedsFirmware || azExceedsFirmware ||
      gxExceedsFirmware || gyExceedsFirmware || gzExceedsFirmware) {
    return `IMU values exceed firmware spec: ax=${imu.ax_mg}, ay=${imu.ay_mg}, az=${imu.az_mg}, gx=${imu.gx_mdps}, gy=${imu.gy_mdps}, gz=${imu.gz_mdps}`;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. AGGREGATION UTILITIES (compute meaningful metrics)
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
// 9. HEART RATE CALCULATION (from PPG)
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
// 10. STRESS LEVEL ESTIMATION (from EDA)
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
