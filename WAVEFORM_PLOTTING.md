# Waveform Plotting Feature

## Overview
The Smart Stim app now includes a real-time waveform plotting feature that can display incoming data streams from the firmware or generate synthetic test waveforms for development and testing.

## Features

### 📊 Real-Time Visualization
- **Live plotting** of waveform data using react-native-chart-kit
- **Smooth updates** at 20Hz (50ms intervals)
- **100-sample window** for optimal visualization
- **Statistics display**: Current, Max, Min, and Average values

### 🔬 Synthetic Data Mode
Generate test waveforms locally for development:
- **Biphasic**: Simulates electrical stimulation pulses (positive-gap-negative-rest)
- **Sine**: Smooth sinusoidal waveform
- **Square**: Digital on/off wave
- **Sawtooth**: Linear ramp waveform

### 📡 BLE Data Mode
Display real-time data from connected firmware:
- Automatically processes incoming BLE messages
- Looks for waveform data in format: `WAVE:<value>`
- Falls back gracefully when device is not connected

### 🎛️ Controls
- **Start/Stop**: Toggle data streaming
- **Clear**: Reset the waveform buffer
- **Data Source Toggle**: Switch between synthetic and BLE modes
- **Waveform Type**: Select waveform shape (synthetic mode only)

## Usage

### Access the Feature
1. Launch the Smart Stim app
2. Navigate to the **📊 Wave** tab
3. The waveform monitor will be displayed

### Using Synthetic Data
1. Ensure **Synthetic Data** toggle is ON (default)
2. Select desired waveform type (Biphasic, Sine, Square, or Sawtooth)
3. Press **▶️ Start** to begin streaming
4. Watch the live waveform update in real-time
5. Press **⏸️ Stop** to pause streaming
6. Use **🗑️ Clear** to reset the display

### Using BLE Data
1. Connect to your device via the **📡 Devices** tab
2. Navigate back to **📊 Wave** tab
3. Toggle **Synthetic Data** to OFF
4. Press **▶️ Start** to begin receiving data
5. The firmware should send data in format: `WAVE:<value>`

## Firmware Integration

### Data Format
The firmware should send waveform data via BLE in the following format:
```
WAVE:<value>
```

Where `<value>` is a numeric value (integer or float).

### Example Messages
```
WAVE:100
WAVE:-50
WAVE:75.5
WAVE:0
```

### Sending Frequency
- The app updates at 50ms intervals (20Hz)
- Firmware can send data at any rate
- Each message updates one data point on the chart

### Implementation Example
```cpp
// In your ESP32/firmware code
void sendWaveformSample(float value) {
    char buffer[32];
    snprintf(buffer, sizeof(buffer), "WAVE:%.2f", value);
    // Send via BLE characteristic
    pCharacteristic->setValue(buffer);
    pCharacteristic->notify();
}
```

## Technical Details

### Component Structure
- **File**: `src/components/WaveformPlot.tsx`
- **Dependencies**: 
  - `react-native-chart-kit` (already installed)
  - `react-native-svg` (peer dependency, already installed)
- **Context**: Uses existing `BLEContext` for device connectivity

### Data Flow
1. **Synthetic Mode**:
   - Timer generates samples at 50ms intervals
   - Mathematical functions create waveform patterns
   - Data directly updates the buffer

2. **BLE Mode**:
   - Monitors `receivedMessages` from BLEContext
   - Parses messages for `WAVE:` prefix
   - Extracts numeric value and adds to buffer
   - Invalid messages are ignored

### Performance
- **Update Rate**: 20Hz (50ms intervals)
- **Display Window**: 100 samples (5 seconds at 20Hz)
- **Memory**: Circular buffer maintains fixed size
- **CPU**: Minimal impact, uses efficient React state updates

## Configuration

### Adjustable Parameters
Edit `src/components/WaveformPlot.tsx` to customize:

```typescript
const WINDOW_SIZE = 100;      // Number of points displayed
const UPDATE_INTERVAL = 50;   // Milliseconds between updates
```

### Synthetic Waveform Parameters
Currently hardcoded in the component:
- **Frequency**: 50 Hz
- **Amplitude**: 100 units
- **Pulse Width**: 500 microseconds (biphasic mode)

These can be made adjustable in future updates.

## Future Enhancements

### Planned Features
- [ ] Adjustable frequency and amplitude for synthetic data
- [ ] Multiple channel display (dual waveforms)
- [ ] Data export functionality (CSV format)
- [ ] Trigger and capture modes
- [ ] FFT spectrum analysis
- [ ] Configurable window size and update rate
- [ ] Zoom and pan controls
- [ ] Measurement cursors

### Firmware Integration
- [ ] Auto-detection of waveform streaming capability
- [ ] Bidirectional control (start/stop from app)
- [ ] Sample rate negotiation
- [ ] Buffered transmission for high-frequency data

## Troubleshooting

### No Waveform Displayed
- Ensure streaming is started (press **▶️ Start**)
- Check data source mode (synthetic vs BLE)
- In BLE mode, verify device is connected

### Choppy/Irregular Updates
- Check device Bluetooth connection strength
- Verify firmware is sending data at consistent rate
- Reduce update frequency if needed

### BLE Data Not Showing
- Confirm device is connected (check **📡 Devices** tab)
- Verify firmware is sending `WAVE:<value>` format
- Check Console tab for received messages
- Ensure BLE characteristic notifications are enabled

## Examples

### Test Biphasic Stimulation Waveform
1. Select **Biphasic** waveform type
2. Start streaming
3. Observe the characteristic pulse pattern:
   - Positive pulse
   - Inter-phase gap (zero)
   - Negative pulse
   - Rest period (zero)

### Monitor Real Device Output
1. Connect to Smart Stim device
2. Configure stimulation parameters in **⚡ Stim** tab
3. Switch to **📊 Wave** tab
4. Toggle to BLE data mode
5. Start streaming to see actual output waveform

## Support

For issues or questions:
- Check the main `README.md` for app setup
- Review `TESTING_GUIDE.md` for testing procedures
- Consult `SMART_STIM_INTEGRATION.md` for device integration

## Version History
- **v1.0** (December 2025): Initial release with synthetic and BLE data modes
