# Smart Stim ESP32 Hardware Features

## 🔌 Hardware Overview

The Smart Stim device is a precision electrical stimulation system built on ESP32 with the following components:

### Core Components
- **ESP32 Microcontroller** - Main processor with BLE capability
- **2× DAC Channels** - 12-bit Digital-to-Analog Converters (0-4095 range)
- **OLED Display** - Real-time status monitoring
- **Physical Buttons** - Power, Enter, Up, Down controls
- **LEDs** - Visual feedback (status, fault indicators)
- **Buzzer** - Audio feedback for events
- **Battery Sensing** - Voltage monitoring
- **Current Sensing** - Per-channel output monitoring
- **4 kHz Timer** - 250 microsecond precision timing

---

## ⚡ DAC System

### DAC Specifications
```
Range: 0 - 4095 (12-bit)
Neutral Point: 2505 (zero current)
Safe Range: 2000 - 3000
Resolution: ~0.8 mV per step (assuming 3.3V reference)
```

### DAC Operation
- **DAC_ZERO (2505)** = No current output (neutral)
- **Above 2505** = Positive current
- **Below 2505** = Negative current
- **Symmetric range** = ±495 units from neutral

### Example DAC Values
```
2000 → Maximum negative current (safe limit)
2505 → Zero current (neutral point)
3000 → Maximum positive current (safe limit)
```

---

## 🎛️ Stimulation Modes

### Mode 0: OFF
- **Description:** No output
- **Use Case:** Disable channel
- **Parameters:** None

### Mode 1: DC (Direct Current)
- **Description:** Steady voltage level
- **Use Case:** Constant stimulation
- **Parameters:**
  - `A0` - DC level (typically close to 2505)

### Mode 2: MONO (Monophasic)
- **Description:** Single pulse per cycle
- **Use Case:** Basic pulsed stimulation
- **Parameters:**
  - `A0` - Pulse amplitude
  - `T1` - Pulse width (µs)
  - `GP` - Gap period between pulses (µs)

### Mode 3: BI (Biphasic)
- **Description:** Positive pulse followed by negative pulse
- **Use Case:** Balanced charge delivery, no net DC
- **Parameters:**
  - `A0` - Pulse amplitude
  - `T1` - Positive phase duration (µs)
  - `T2` - Negative phase duration (µs)
  - `RP` - Ramp period (µs)
  - `GP` - Gap period between pulses (µs)

**Waveform:**
```
    +A0
     │  ┌─┐
     │  │ │
  0──┼──┘ └─┐
     │      │
    -A0     └─┘
     └───────────> time
        T1  T2
```

### Mode 4: SINE (Sine Wave)
- **Description:** Smooth sinusoidal output
- **Use Case:** Continuous waveform stimulation
- **Parameters:**
  - `A0` - Amplitude
  - `T1` - Period (µs)

### Mode 5: TEST
- **Description:** Alternates between min/max values
- **Use Case:** Hardware verification
- **Parameters:**
  - `A0` - Maximum value
  - `A1` - Minimum value
  - `T1` - Alternation period (µs)

---

## 📊 Timing Parameters

All timing values are in **microseconds (µs)**.

### Primary Timing
- **T1** - Phase 1 duration
- **T2** - Phase 2 duration  
- **T3** - Phase 3 duration
- **T4** - Phase 4 duration
- **T5** - Phase 5 duration
- **T6** - Phase 6 duration

### Special Timing
- **RP** - Ramp Period (transition time)
- **GP** - Gap Period (time between pulses)

### Safe Ranges
```
Pulse Width (T1-T6): 50 µs - 5000 µs (0.05 - 5 ms)
Gap Period (GP):    100 µs - 10000 µs (0.1 - 10 ms)
Ramp Period (RP):   10 µs - 1000 µs
```

### Frequency Calculation
```
Frequency (Hz) = 1,000,000 / (Pulse Width + Gap Period)

Example:
T1 = 500 µs, GP = 1500 µs
Period = 500 + 1500 = 2000 µs
Frequency = 1,000,000 / 2000 = 500 Hz
```

---

## 📡 BLE Communication Protocol

### Command Format
```
CH:<channel>,MODE:<mode>,A0:<amplitude>,T1:<time>,...
```

### Example Commands

**Configure Channel 0 - Biphasic 50 Hz:**
```
CH:0,MODE:3,A0:2800,T1:500,T2:500,RP:10,GP:19500
```

**Configure Channel 1 - Monophasic 100 Hz:**
```
CH:1,MODE:2,A0:2700,T1:300,GP:9700
```

**Set Session Duration:**
```
DUR:1200
```
(20 minutes = 1200 seconds)

**Start/Stop Stimulation:**
```
POWER:ON
POWER:OFF
```

### Response Format
```
OK:CH0=ON,MODE=3,A0=2800,BATT=3.7V,CURR=12mA
```

### Parsing Response
```javascript
const response = "OK:CH0=ON,MODE=3,A0=2800";
const parts = response.replace('OK:', '').split(',');

// Result:
// CH0 = ON
// MODE = 3
// A0 = 2800
```

---

## 🖥️ OLED Display Information

### Display Layout
```
┌─────────────────────────┐
│ STIM: ON    12:34 / 20m │  ← Session status
│ INT: 45%    BATT: 3.7V  │  ← Intensity & Battery
├─────────────────────────┤
│ CH0: BI     [●●●○○]     │  ← Channel 0 status
│  50Hz  12mA             │  ← Frequency & Current
├─────────────────────────┤
│ CH1: MONO   [●●○○○]     │  ← Channel 1 status
│  100Hz  8mA             │
├─────────────────────────┤
│ BLE: Connected          │  ← Bluetooth status
└─────────────────────────┘
```

### Display Updates
- **Refresh Rate:** 250 ms (4 Hz)
- **Shows:** Session time, mode, intensity, battery, current, BLE status

---

## 🔘 Physical Controls

### Power Button
- **Short Press:** Start/Stop stimulation session
- **Long Press:** Device power on/off (if implemented)

### Enter Button
- **Function:** Switch between duration and intensity editing
- **States:** 
  - Editing Duration (minutes)
  - Editing Intensity (%)

### Up/Down Buttons
- **Function:** Adjust current parameter
- **Step Size:** 
  - Duration: ±1 minute
  - Intensity: ±5%

### Button Feedback
- **Buzzer Beep:** Confirms button press
- **OLED Update:** Shows new value immediately

---

## 🔔 LED & Buzzer Feedback

### LED Colors/Patterns
- **Green:** Normal operation
- **Blue:** BLE advertising
- **Cyan:** BLE connected
- **Red:** Fault detected (open circuit)
- **Yellow:** Battery low (if implemented)

### Buzzer Patterns
- **Short Beep:** Button press
- **Double Beep:** BLE connection established
- **Long Beep:** Fault alarm
- **Startup Chirp:** Device initialized

---

## 🔋 Battery & Current Monitoring

### Battery Sensing
- **Voltage Range:** 3.0V - 4.2V (LiPo typical)
- **Display:** Shows actual voltage (e.g., "3.7V")
- **Low Battery Warning:** < 3.3V (configurable)

### Current Sensing
- **Per Channel:** Independent monitoring
- **Range:** 0-50 mA typical
- **Display:** Shows mA per channel
- **Fault Detection:** 
  - If current < 1 mA when stimulation active
  - Indicates open circuit (electrodes not connected)

---

## ⚠️ Safety Features

### Fault Detection
```
IF (stimulation_active AND measured_current < 1mA)
THEN
  - Set LEDs to RED
  - Sound loud buzzer alarm
  - Stop all DAC output
  - Display "OPEN CIRCUIT FAULT"
```

### Automatic Shutoff
- **Open Circuit:** Immediate stop
- **Session Timer:** Stops at configured duration
- **Low Battery:** May disable output (if implemented)

### Safe Operating Limits
```
Maximum Amplitude:     ±500 from neutral (2000-3000)
Maximum Pulse Width:   5 ms
Maximum Frequency:     200 Hz (recommended)
Maximum Session Time:  60 minutes (configurable)
```

---

## 🕒 Timer System (4 kHz Scheduler)

### Precision Timing
```
Timer Interrupt: 250 microseconds (0.25 ms)
Frequency:       4000 Hz (4 kHz)
Jitter:          < 5 µs (hardware timer)
```

### Timer ISR (Interrupt Service Routine)
```cpp
Every 250 µs:
  1. Check session timer
  2. Update phase counters for each channel
  3. Calculate DAC value for current phase
  4. Write value to DAC
  5. Update current measurements
```

### Why 4 kHz?
- **Precision:** Generates accurate pulse widths
- **Flexibility:** Can create any frequency up to 2 kHz (Nyquist)
- **Stability:** Hardware timer, not affected by BLE or display updates

---

## 📱 Mobile App Integration

### App Features
1. **Device Scanner** - Find and connect to ESP32
2. **Smart Stim Panel** - Configure channels with sliders and presets
3. **Console** - Send custom commands manually
4. **Presets** - Quick load common configurations
5. **Real-time Feedback** - Parse device responses

### Configuration Flow
```
1. User adjusts intensity slider (0-100%)
2. App converts to DAC value (2505-3000)
3. User sets frequency (e.g., 50 Hz)
4. App calculates GP value
5. User taps "Apply"
6. App builds command: "CH:0,MODE:3,A0:2750,T1:500,T2:500,GP:19500"
7. App sends via BLE
8. Device responds: "OK:CH0=ON,MODE=3,A0=2750"
9. App displays confirmation
```

---

## 🔬 Example Configurations

### TENS-like Stimulation (Pain Relief)
```
Channel: 0
Mode: BI (Biphasic)
Intensity: 30%  (A0 = 2650)
Frequency: 80 Hz
Pulse Width: 200 µs

Command:
CH:0,MODE:3,A0:2650,T1:200,T2:200,RP:10,GP:12300
```

### EMS-like Stimulation (Muscle)
```
Channel: 0
Mode: BI (Biphasic)
Intensity: 50%  (A0 = 2750)
Frequency: 50 Hz
Pulse Width: 300 µs

Command:
CH:0,MODE:3,A0:2750,T1:300,T2:300,RP:10,GP:19400
```

### Dual Channel - Alternating
```
Channel 0:
CH:0,MODE:3,A0:2700,T1:400,T2:400,RP:10,GP:19200

Channel 1:
CH:1,MODE:3,A0:2700,T1:400,T2:400,RP:10,GP:19200

Note: Device can phase-shift channels for alternating stimulation
```

---

## 🛠️ Troubleshooting

### "OPEN CIRCUIT" Fault
- **Cause:** Electrodes not connected or poor contact
- **Fix:** Check electrode connections, apply gel

### BLE Won't Connect
- **Cause:** Device not advertising or out of range
- **Fix:** Reset device, ensure < 5 meters, check phone BLE is on

### No Output on Channel
- **Cause:** Channel disabled, Mode=OFF, or low intensity
- **Fix:** Enable channel, set Mode=BI or MONO, increase intensity

### Intensity Too High/Low
- **Cause:** Wrong DAC mapping or mode
- **Fix:** Verify A0 value is in safe range (2000-3000)

### Timing Not Accurate
- **Cause:** Incorrect GP calculation
- **Fix:** Verify GP = (1000000/freq) - pulse_width

---

## 📖 Quick Reference

### DAC Values
| Intensity | DAC Value | Delta from Neutral |
|-----------|-----------|-------------------|
| 0%        | 2505      | 0                 |
| 25%       | 2629      | +124              |
| 50%       | 2753      | +248              |
| 75%       | 2876      | +371              |
| 100%      | 3000      | +495              |

### Common Frequencies
| Frequency | Period (µs) | GP (for 500µs pulse) |
|-----------|-------------|---------------------|
| 10 Hz     | 100,000     | 99,500              |
| 50 Hz     | 20,000      | 19,500              |
| 100 Hz    | 10,000      | 9,500               |
| 200 Hz    | 5,000       | 4,500               |

### Parameter Limits
| Parameter | Min    | Max     | Unit |
|-----------|--------|---------|------|
| A0-A2     | 2000   | 3000    | DAC  |
| T1-T6     | 50     | 5000    | µs   |
| GP        | 100    | 10000   | µs   |
| RP        | 10     | 1000    | µs   |
| Session   | 1      | 60      | min  |

---

This hardware operates with precision and safety in mind. Always start with low intensities and increase gradually!
