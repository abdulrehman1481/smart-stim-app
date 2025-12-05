/**
 * Smart Stim ESP32 Device Command Builder
 * 
 * This module provides type-safe command building for the ESP32-based
 * electrical stimulation device with dual-channel DAC control.
 * 
 * Hardware Features:
 * - 2 independent DAC channels (digital-to-analog converters)
 * - OLED display showing session info
 * - Physical buttons (Power, Enter, Up, Down)
 * - LEDs and buzzer for feedback
 * - Battery and current sensing
 * - 4 kHz timer (250 microsecond precision)
 */

// ============================================================================
// STIMULATION MODES
// ============================================================================

export enum StimMode {
  OFF = 0,      // No output
  DC = 1,       // Steady DC level
  MONO = 2,     // Monophasic pulse (single pulse per cycle)
  BI = 3,       // Biphasic pulse (positive + negative)
  SINE = 4,     // Sine wave output
  TEST = 5,     // Alternates min/max for testing
}

export const STIM_MODE_NAMES: Record<StimMode, string> = {
  [StimMode.OFF]: 'OFF',
  [StimMode.DC]: 'DC Steady',
  [StimMode.MONO]: 'Monophasic',
  [StimMode.BI]: 'Biphasic',
  [StimMode.SINE]: 'Sine Wave',
  [StimMode.TEST]: 'Test Mode',
};

// ============================================================================
// CHANNEL CONFIGURATION
// ============================================================================

export interface ChannelConfig {
  channel: 0 | 1;           // Channel number (0 or 1)
  mode: StimMode;           // Stimulation mode
  
  // Amplitude values (DAC units: 0-4095, neutral = 2505)
  A0?: number;              // Primary amplitude (0-4095)
  A1?: number;              // Secondary amplitude
  A2?: number;              // Tertiary amplitude
  
  // Timing values (microseconds)
  T1?: number;              // Phase 1 duration
  T2?: number;              // Phase 2 duration
  T3?: number;              // Phase 3 duration
  T4?: number;              // Phase 4 duration
  T5?: number;              // Phase 5 duration
  T6?: number;              // Phase 6 duration
  
  // Pulse timing
  RP?: number;              // Ramp period
  GP?: number;              // Gap period (pulse interval)
}

// ============================================================================
// SESSION CONFIGURATION
// ============================================================================

export interface SessionConfig {
  duration?: number;        // Session duration in seconds
  intensity?: number;       // Overall intensity level (0-100)
}

// ============================================================================
// DEVICE STATUS (from OLED display data)
// ============================================================================

export interface DeviceStatus {
  sessionTime: number;      // Current session time in seconds
  sessionDuration: number;  // Total session duration
  intensity: number;        // Current intensity (0-100)
  batteryVoltage: number;   // Battery voltage (V)
  current: number;          // Measured current (mA)
  bleConnected: boolean;    // BLE connection status
  stimulationActive: boolean; // Is stimulation running
  
  channels: {
    channel0: ChannelStatus;
    channel1: ChannelStatus;
  };
}

export interface ChannelStatus {
  mode: StimMode;
  enabled: boolean;
  amplitude: number;
  fault: boolean;           // Open circuit detected
}

// ============================================================================
// COMMAND BUILDER
// ============================================================================

export class SmartStimCommandBuilder {
  
  /**
   * Build a channel configuration command
   * Example: "CH:0,MODE:3,A0:2800,T1:500,T2:500,RP:10,GP:1000"
   */
  static buildChannelCommand(config: ChannelConfig): string {
    const parts: string[] = [];
    
    // Channel number (required)
    parts.push(`CH:${config.channel}`);
    
    // Mode (required)
    parts.push(`MODE:${config.mode}`);
    
    // Amplitudes (optional)
    if (config.A0 !== undefined) parts.push(`A0:${config.A0}`);
    if (config.A1 !== undefined) parts.push(`A1:${config.A1}`);
    if (config.A2 !== undefined) parts.push(`A2:${config.A2}`);
    
    // Timing parameters (optional)
    if (config.T1 !== undefined) parts.push(`T1:${config.T1}`);
    if (config.T2 !== undefined) parts.push(`T2:${config.T2}`);
    if (config.T3 !== undefined) parts.push(`T3:${config.T3}`);
    if (config.T4 !== undefined) parts.push(`T4:${config.T4}`);
    if (config.T5 !== undefined) parts.push(`T5:${config.T5}`);
    if (config.T6 !== undefined) parts.push(`T6:${config.T6}`);
    
    // Pulse timing (optional)
    if (config.RP !== undefined) parts.push(`RP:${config.RP}`);
    if (config.GP !== undefined) parts.push(`GP:${config.GP}`);
    
    return parts.join(',');
  }
  
  /**
   * Build a session configuration command
   */
  static buildSessionCommand(config: SessionConfig): string {
    const parts: string[] = [];
    
    if (config.duration !== undefined) {
      parts.push(`DUR:${config.duration}`);
    }
    if (config.intensity !== undefined) {
      parts.push(`INT:${config.intensity}`);
    }
    
    return parts.join(',');
  }
  
  /**
   * Parse device response
   * Example: "OK:CH0=ON,MODE=3,A0=2800,BATT=3.7V,CURR=12mA"
   */
  static parseResponse(response: string): Record<string, string> {
    const result: Record<string, string> = {};
    
    // Remove "OK:" prefix if present
    const data = response.replace(/^OK:/, '');
    
    // Split by comma and parse key=value pairs
    const pairs = data.split(',');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value) {
        result[key.trim()] = value.trim();
      }
    }
    
    return result;
  }
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

export const PRESET_CONFIGS = {
  // Basic biphasic pulse - safe starting point
  basicBiphasic: {
    channel: 0,
    mode: StimMode.BI,
    A0: 2800,     // Moderate amplitude
    T1: 500,      // 500 µs positive phase
    T2: 500,      // 500 µs negative phase
    RP: 10,       // 10 µs ramp
    GP: 1000,     // 1 ms gap between pulses
  } as ChannelConfig,
  
  // Monophasic pulse
  basicMono: {
    channel: 0,
    mode: StimMode.MONO,
    A0: 2600,
    T1: 300,
    GP: 2000,
  } as ChannelConfig,
  
  // Sine wave - smooth stimulation
  sineWave: {
    channel: 0,
    mode: StimMode.SINE,
    A0: 2700,
    T1: 1000,     // Period in µs
  } as ChannelConfig,
  
  // Test mode - for checking hardware
  testMode: {
    channel: 0,
    mode: StimMode.TEST,
    A0: 3000,     // Max amplitude
    A1: 2000,     // Min amplitude
    T1: 1000,     // Alternation period
  } as ChannelConfig,
  
  // Dual channel - both active
  dualChannel: [
    {
      channel: 0,
      mode: StimMode.BI,
      A0: 2800,
      T1: 500,
      T2: 500,
      GP: 1000,
    } as ChannelConfig,
    {
      channel: 1,
      mode: StimMode.BI,
      A0: 2750,
      T1: 600,
      T2: 600,
      GP: 1200,
    } as ChannelConfig,
  ],
};

// ============================================================================
// VALIDATION & SAFETY
// ============================================================================

export class SmartStimValidator {
  
  // DAC safe ranges
  static readonly DAC_MIN = 0;
  static readonly DAC_MAX = 4095;
  static readonly DAC_ZERO = 2505;  // Neutral point (no current)
  static readonly DAC_SAFE_MIN = 2000;  // Safe lower bound
  static readonly DAC_SAFE_MAX = 3000;  // Safe upper bound
  
  // Timing safe ranges (microseconds)
  static readonly MIN_PULSE_WIDTH = 50;      // 50 µs minimum
  static readonly MAX_PULSE_WIDTH = 5000;    // 5 ms maximum
  static readonly MIN_GAP = 100;             // 100 µs minimum gap
  static readonly MAX_GAP = 10000;           // 10 ms maximum gap
  
  /**
   * Validate amplitude is within safe range
   */
  static validateAmplitude(value: number): boolean {
    return value >= this.DAC_SAFE_MIN && value <= this.DAC_SAFE_MAX;
  }
  
  /**
   * Validate timing parameter
   */
  static validateTiming(value: number, isGap: boolean = false): boolean {
    if (isGap) {
      return value >= this.MIN_GAP && value <= this.MAX_GAP;
    }
    return value >= this.MIN_PULSE_WIDTH && value <= this.MAX_PULSE_WIDTH;
  }
  
  /**
   * Validate complete channel configuration
   */
  static validateChannelConfig(config: ChannelConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Check channel number
    if (config.channel !== 0 && config.channel !== 1) {
      errors.push('Channel must be 0 or 1');
    }
    
    // Check mode
    if (!Object.values(StimMode).includes(config.mode)) {
      errors.push('Invalid mode');
    }
    
    // Check amplitudes
    if (config.A0 !== undefined && !this.validateAmplitude(config.A0)) {
      errors.push(`A0 (${config.A0}) outside safe range (${this.DAC_SAFE_MIN}-${this.DAC_SAFE_MAX})`);
    }
    if (config.A1 !== undefined && !this.validateAmplitude(config.A1)) {
      errors.push(`A1 (${config.A1}) outside safe range`);
    }
    if (config.A2 !== undefined && !this.validateAmplitude(config.A2)) {
      errors.push(`A2 (${config.A2}) outside safe range`);
    }
    
    // Check timing
    const timings: Array<[number | undefined, string, boolean]> = [
      [config.T1, 'T1', false],
      [config.T2, 'T2', false],
      [config.T3, 'T3', false],
      [config.T4, 'T4', false],
      [config.T5, 'T5', false],
      [config.T6, 'T6', false],
      [config.GP, 'GP', true],  // Gap has different limits
    ];
    
    for (const [value, name, isGap] of timings) {
      if (value !== undefined && !this.validateTiming(value, isGap)) {
        const min = isGap ? this.MIN_GAP : this.MIN_PULSE_WIDTH;
        const max = isGap ? this.MAX_GAP : this.MAX_PULSE_WIDTH;
        errors.push(`${name} (${value}µs) outside safe range (${min}-${max}µs)`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Get safe default configuration for a mode
   */
  static getSafeDefaults(mode: StimMode, channel: 0 | 1): ChannelConfig {
    switch (mode) {
      case StimMode.BI:
        return {
          channel,
          mode: StimMode.BI,
          A0: 2700,  // Safe moderate amplitude
          T1: 500,
          T2: 500,
          RP: 10,
          GP: 1000,
        };
      
      case StimMode.MONO:
        return {
          channel,
          mode: StimMode.MONO,
          A0: 2650,
          T1: 400,
          GP: 1500,
        };
      
      case StimMode.SINE:
        return {
          channel,
          mode: StimMode.SINE,
          A0: 2700,
          T1: 1000,
        };
      
      case StimMode.DC:
        return {
          channel,
          mode: StimMode.DC,
          A0: 2550,  // Very close to neutral for DC
        };
      
      default:
        return {
          channel,
          mode: StimMode.OFF,
        };
    }
  }
}

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Convert intensity percentage (0-100) to DAC amplitude
 */
export function intensityToAmplitude(intensity: number): number {
  // Clamp intensity
  const clamped = Math.max(0, Math.min(100, intensity));
  
  // Map 0-100% to safe DAC range (2505-3000)
  const range = SmartStimValidator.DAC_SAFE_MAX - SmartStimValidator.DAC_ZERO;
  return Math.round(SmartStimValidator.DAC_ZERO + (clamped / 100) * range);
}

/**
 * Convert DAC amplitude to intensity percentage
 */
export function amplitudeToIntensity(amplitude: number): number {
  const range = SmartStimValidator.DAC_SAFE_MAX - SmartStimValidator.DAC_ZERO;
  const intensity = ((amplitude - SmartStimValidator.DAC_ZERO) / range) * 100;
  return Math.max(0, Math.min(100, intensity));
}

/**
 * Format microseconds to human-readable string
 */
export function formatMicroseconds(us: number): string {
  if (us < 1000) {
    return `${us}µs`;
  }
  return `${(us / 1000).toFixed(1)}ms`;
}

/**
 * Calculate estimated pulse frequency from gap period
 */
export function calculateFrequency(gapMicroseconds: number, pulseDuration: number = 500): number {
  const periodUs = gapMicroseconds + pulseDuration;
  const periodSeconds = periodUs / 1_000_000;
  return 1 / periodSeconds; // Hz
}
