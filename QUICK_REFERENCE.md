# Quick Reference Guide - Smart Stim 3-Tab App

## 🚀 Quick Start

### File Structure
```
App.tsx (MODIFIED)
src/
  components/
    DeviceScanner.tsx (EXISTING)
    ComprehensiveStimPanel.tsx (NEW - Merged Stim+Wave)
    WristbandSensorsPanel.tsx (NEW - Sensors)
    ControlConsole.tsx (LEGACY - Not used)
    SmartStimPanel.tsx (LEGACY - Replaced)
    WaveformPlot.tsx (LEGACY - Replaced)
```

### Component Mapping
| Old Tabs | New Tabs | Component |
|----------|----------|-----------|
| Devices | 📡 Devices | `DeviceScanner.tsx` |
| Stim + Wave | ⚡ Stim | `ComprehensiveStimPanel.tsx` |
| *(new)* | 🌊 Sensors | `WristbandSensorsPanel.tsx` |
| Console | *(removed)* | - |

---

## 📡 Tab 1: Devices

### What It Does
- Scan for BLE devices
- Connect/disconnect
- Protocol selection

### Key Controls
- **Start/Stop Scan buttons**
- **Protocol filters:** Nordic UART, ESP32 Custom
- **Device list:** Click to connect

### Status Indicators
- Green = Connected
- RSSI values
- Protocol badges

---

## ⚡ Tab 2: Stim (Comprehensive)

### Sections Overview

#### 1. Master Control
```
[▶ START STIMULATION] or [⏸ STOP STIMULATION]
Session Duration: [-5] [20 min] [+5]
```

#### 2. Audio Feedback
```
🔊 Audio Feedback [ON/OFF]
  Volume: 50% [-] [+]
  Tone: 440 Hz [-] [+]
```

#### 3. Waveform Monitor
```
📊 Output Waveform Monitor [● Live]
  [Chart showing real-time waveform]
  Stats: Current, Max, Min, Avg
  [▶ Start Monitor] or [⏸ Stop Monitor]
```

#### 4. Channel Controls (×2)
```
Channel 0 [ON/OFF]
  [✅ Check Electrode]  ← Click to test connection
  
  Mode: [Biphasic] [Mono] [DC] [Sine] [Test]
  
  🔥 Burst Mode [ON/OFF]
    Burst Duration: 1000ms [-] [+]
    Burst Interval: 2000ms [-] [+]
  
  Intensity: 30% [-] [+]
  Pulse Width: 500µs [-] [+]
  Frequency: 50 Hz [-] [+]
  
  [Apply Channel 0 Configuration]
```

### Key Features
- ✅ **Electrode Check:** Verify connection before stimulation
- 🔥 **Burst Mode:** Pulsed stimulation patterns
- 🔊 **Audio:** Sound feedback during stimulation
- 📊 **Live Monitor:** See output waveform in real-time
- 🎛️ **Dual Channel:** Independent control of 2 channels

### Safety Features
- Electrode connection warnings (⚠️)
- DAC safe range display
- Safety information panel
- Must check electrodes when enabled

---

## 🌊 Tab 3: Sensors (Wristband)

### Sections Overview

#### 1. Controls
```
[▶ Start] [🗑 Clear]
Synthetic Data Mode: [ON/OFF]
```

#### 2. Waveform Display
```
📊 [Selected Sensor] Waveform [Filter Badge]
  [Chart showing selected sensor]
  Stats: Current, Max, Min, Avg
```

#### 3. Filtering
```
🔧 Signal Filtering
  [No Filter] [Low-Pass] [Band-Pass]
  
  Low-Pass: Cutoff 5 Hz [-] [+]
  Band-Pass: Low 0.5 Hz, High 10 Hz [-] [+]
```

#### 4. Sensor Groups

##### ❤️ PPG Sensors (3)
```
┌─────────┬─────────┬──────────┐
│ PPG-IR  │ PPG-Red │ PPG-Green│
│ 1025.34 │  820.12 │  612.45  │  ← Click to view
└─────────┴─────────┴──────────┘
```

##### 🧬 Biometric Sensors (4)
```
┌─────────┬────────┬──────┬────────┐
│   HR    │  EDA   │ Temp │  SCR   │
│ 72 BPM  │ 5.2 µS │ 36.7°│  1.3   │
└─────────┴────────┴──────┴────────┘
```

##### 📐 9-Axis IMU (6)
```
┌──────────┬──────────┬──────────┐
│ Gyro-X   │ Gyro-Y   │ Gyro-Z   │
│ 12.3 °/s │ 8.5 °/s  │ 5.1 °/s  │
├──────────┼──────────┼──────────┤
│ Accel-X  │ Accel-Y  │ Accel-Z  │
│ 0.12 g   │ 0.05 g   │ 1.02 g   │
└──────────┴──────────┴──────────┘
```

### Key Features
- **13 Sensors:** All wristband sensors supported
- **Dual View:** Numeric + waveform
- **Click to Select:** Any sensor card to view waveform
- **Real-time Filtering:** Low-pass and band-pass
- **Live Stats:** Current, max, min, avg values
- **Color Coded:** Each sensor has unique color

### Sensor Types
1. **PPG (Photoplethysmography):** Heart rate detection
2. **Heart Rate:** Calculated BPM
3. **EDA:** Skin conductance (stress/arousal)
4. **Temperature:** Body temperature
5. **SCR:** Skin response to stimuli
6. **Gyroscope:** Rotation rate (3 axes)
7. **Accelerometer:** Motion/orientation (3 axes)

---

## 🎯 Common Tasks

### Task 1: Basic Stimulation
```
1. Devices Tab → Connect ESP32
2. Stim Tab → Enable Channel 0
3. Stim Tab → Click [Check Electrode]
4. Stim Tab → Set Intensity to 20%
5. Stim Tab → [Apply Channel 0 Configuration]
6. Stim Tab → [START STIMULATION]
7. Stim Tab → Monitor waveform
8. Stim Tab → [STOP STIMULATION]
```

### Task 2: Burst Stimulation
```
1. (Connect as above)
2. Stim Tab → Enable Burst Mode
3. Stim Tab → Set Burst Duration: 1000ms
4. Stim Tab → Set Burst Interval: 2000ms
5. Stim Tab → [Apply Configuration]
6. Stim Tab → [START STIMULATION]
```

### Task 3: Monitor Heart Rate
```
1. Devices Tab → Connect Wristband
2. Sensors Tab → [Start]
3. Sensors Tab → Click "HR" sensor card
4. Sensors Tab → View live heart rate waveform
5. Sensors Tab → Apply Low-Pass filter (5 Hz)
```

### Task 4: Filter Noisy PPG Signal
```
1. Sensors Tab → [Start streaming]
2. Sensors Tab → Click PPG-IR card
3. Sensors Tab → Select [Band-Pass] filter
4. Sensors Tab → Set Low: 0.5 Hz, High: 10 Hz
5. Sensors Tab → View filtered waveform
```

### Task 5: Compare Multiple Sensors
```
1. Sensors Tab → [Start]
2. View all sensor values in grid
3. Click different sensors to compare waveforms
4. Note: Selected sensor highlighted in blue
```

---

## ⚙️ Settings & Parameters

### Stimulation Parameters
| Parameter | Range | Default | Notes |
|-----------|-------|---------|-------|
| Intensity | 0-100% | 30% | Start low! |
| Pulse Width | 50-5000 µs | 500 µs | Typical: 200-500 |
| Frequency | 1-200 Hz | 50 Hz | Common: 20-100 |
| Burst Duration | 100+ ms | 1000 ms | Burst mode only |
| Burst Interval | 500+ ms | 2000 ms | Burst mode only |

### Filter Parameters
| Filter | Cutoff Range | Best For |
|--------|--------------|----------|
| Low-Pass | 1-20 Hz | Remove high-freq noise |
| Band-Pass | 0.1-30 Hz | Extract specific frequencies |

### Audio Parameters
| Parameter | Range | Default |
|-----------|-------|---------|
| Volume | 0-100% | 50% |
| Frequency | 200-2000 Hz | 440 Hz |

---

## 🔍 Troubleshooting

### Electrode Warning (⚠️)
- **Cause:** Poor electrode connection
- **Fix:** Click [Check Electrode], adjust placement

### No Waveform in Stim Tab
- **Cause:** Monitor not started
- **Fix:** Click [▶ Start Monitor]

### No Sensor Data
- **Cause:** Not streaming or not connected
- **Fix:** 
  1. Enable Synthetic Data Mode for testing
  2. Or connect real wristband device

### Noisy Waveform
- **Cause:** Environmental interference
- **Fix:** Apply Low-Pass filter (5 Hz)

### Can't Apply Configuration
- **Cause:** Not connected to device
- **Fix:** Go to Devices tab, connect first

---

## 💡 Tips & Best Practices

### Stimulation Safety
1. ✅ Always check electrodes first
2. ✅ Start with low intensity (10-20%)
3. ✅ Gradually increase if needed
4. ✅ Stop immediately if uncomfortable
5. ✅ Monitor waveform during session

### Sensor Monitoring
1. 💡 Use synthetic mode for app testing
2. 💡 Apply filters to reduce noise
3. 💡 Click sensors to compare waveforms
4. 💡 Watch PPG for heart rate validation
5. 💡 IMU sensors detect movement

### Performance
- 🚀 Clear buffers between sessions
- 🚀 Stop streaming when not needed
- 🚀 Disable waveform monitor to save resources

---

## 📱 UI Color Guide

### Status Colors
- 🟢 Green: Active/Good/Connected
- 🔴 Red: Stop/Warning/Error
- 🔵 Blue: Selected/Info
- 🟡 Yellow: Caution/Safety
- ⚪ Gray: Disabled/Inactive

### Sensor Colors
- ❤️ Red tones: PPG sensors
- 💙 Blue: EDA
- 🟠 Orange: HR, Temp
- 💜 Purple: Gyroscope
- 🩵 Cyan: Accelerometer
- 💚 Teal: SCR

---

## 🔗 Integration Points

### For Firmware Developers
```typescript
// Stimulation commands format:
"C0:BI,A0:2655,T1:500,T2:500,RP:10,GP:19500,BURST:1000,2000"

// Sensor data format (expected):
"SENSOR:PPG_IR:1025.34"
"SENSOR:HR:72"
"SENSOR:EDA:5.2"
```

### For Future Enhancements
- Data recording/export
- Session playback
- Cloud sync
- ML-based recommendations
- Multi-device support

---

## 📋 Checklist

### Before First Use
- [ ] Device paired via Bluetooth settings
- [ ] App has Bluetooth permissions
- [ ] Battery charged
- [ ] Electrodes properly attached

### Before Each Session
- [ ] Device connected in Devices tab
- [ ] Electrode check passed (if using Stim)
- [ ] Parameters configured
- [ ] Safety info reviewed

### After Session
- [ ] Stimulation stopped
- [ ] Streaming stopped
- [ ] Electrodes cleaned
- [ ] Data saved (if needed)

---

## 🆘 Support

### Common Questions

**Q: Why 3 tabs instead of 4?**
A: Merged Stim+Wave for better workflow, removed rarely-used Console.

**Q: What is burst mode?**
A: Stimulation in pulses (on/off cycles) instead of continuous.

**Q: Do I need real devices?**
A: No! Use Synthetic Data Mode for testing.

**Q: Can I see multiple waveforms at once?**
A: Not yet, but coming in future update.

**Q: What's the difference between filters?**
A: Low-pass removes high frequencies, band-pass keeps specific range.

---

## 📊 Specifications

### App Performance
- **Waveform Update Rate:** 10 Hz (100ms interval)
- **Sample Window:** 50-100 samples
- **Time Span:** ~5-10 seconds
- **Sensors Supported:** 13 simultaneous

### BLE Requirements
- **Protocols:** Nordic UART, ESP32 Custom
- **Services:** UUID-based discovery
- **Commands:** Text-based protocol
- **Data Rate:** ~10 samples/sec

---

## 📖 Related Documentation
- `TAB_RESTRUCTURE_SUMMARY.md` - Detailed implementation notes
- `ARCHITECTURE_DIAGRAM.md` - Visual architecture guide
- `SMART_STIM_INTEGRATION.md` - Device integration guide
- `README_BLE.md` - BLE protocol documentation
