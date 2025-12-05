import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { useBLE } from '../functionality/BLEContext';
import { bleService } from '../functionality/BLEService';
import {
  StimMode,
  STIM_MODE_NAMES,
  ChannelConfig,
  SmartStimCommandBuilder,
  SmartStimValidator,
  PRESET_CONFIGS,
  intensityToAmplitude,
  amplitudeToIntensity,
  formatMicroseconds,
  calculateFrequency,
} from '../functionality/SmartStimCommands';

export const SmartStimPanel: React.FC = () => {
  const { isConnected, connectedDeviceName } = useBLE();
  
  // Channel 0 configuration
  const [ch0Enabled, setCh0Enabled] = useState(false);
  const [ch0Mode, setCh0Mode] = useState<StimMode>(StimMode.BI);
  const [ch0Intensity, setCh0Intensity] = useState(30); // 0-100%
  const [ch0PulseWidth, setCh0PulseWidth] = useState(500); // microseconds
  const [ch0Frequency, setCh0Frequency] = useState(50); // Hz
  
  // Channel 1 configuration
  const [ch1Enabled, setCh1Enabled] = useState(false);
  const [ch1Mode, setCh1Mode] = useState<StimMode>(StimMode.BI);
  const [ch1Intensity, setCh1Intensity] = useState(30);
  const [ch1PulseWidth, setCh1PulseWidth] = useState(500);
  const [ch1Frequency, setCh1Frequency] = useState(50);
  
  // Session settings
  const [sessionDuration, setSessionDuration] = useState(20); // minutes
  const [stimulationActive, setStimulationActive] = useState(false);
  
  const sendChannelConfig = async (channel: 0 | 1) => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please connect to device first');
      return;
    }
    
    const intensity = channel === 0 ? ch0Intensity : ch1Intensity;
    const mode = channel === 0 ? ch0Mode : ch1Mode;
    const pulseWidth = channel === 0 ? ch0PulseWidth : ch1PulseWidth;
    const frequency = channel === 0 ? ch0Frequency : ch1Frequency;
    
    // Calculate timing parameters
    const gapPeriod = (1000000 / frequency) - pulseWidth; // Convert Hz to microseconds
    
    const config: ChannelConfig = {
      channel,
      mode,
      A0: intensityToAmplitude(intensity),
      T1: pulseWidth,
      T2: mode === StimMode.BI ? pulseWidth : undefined,
      RP: 10,
      GP: Math.max(100, Math.round(gapPeriod)),
    };
    
    // Validate before sending
    const validation = SmartStimValidator.validateChannelConfig(config);
    if (!validation.valid) {
      Alert.alert(
        'Invalid Configuration',
        validation.errors.join('\n'),
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Build and send command
    const command = SmartStimCommandBuilder.buildChannelCommand(config);
    console.log('[SmartStim] Sending:', command);
    
    const success = await bleService.sendData(command, true);
    if (success) {
      Alert.alert(
        'Success',
        `Channel ${channel} configured:\n${STIM_MODE_NAMES[mode]}\nIntensity: ${intensity}%\nFrequency: ${frequency}Hz`,
        [{ text: 'OK' }]
      );
    }
  };
  
  const loadPreset = (presetName: keyof typeof PRESET_CONFIGS) => {
    const preset = PRESET_CONFIGS[presetName];
    
    if (Array.isArray(preset)) {
      // Dual channel preset
      Alert.alert('Preset Loaded', 'Dual channel configuration loaded. Apply each channel separately.');
    } else {
      // Single channel preset
      const config = preset as ChannelConfig;
      
      if (config.channel === 0) {
        setCh0Mode(config.mode);
        if (config.A0) setCh0Intensity(Math.round(amplitudeToIntensity(config.A0)));
        if (config.T1) setCh0PulseWidth(config.T1);
        if (config.GP && config.T1) {
          const freq = calculateFrequency(config.GP, config.T1);
          setCh0Frequency(Math.round(freq));
        }
      }
      
      Alert.alert(
        'Preset Loaded',
        `${presetName} configuration loaded for Channel ${config.channel}`,
        [{ text: 'OK' }]
      );
    }
  };
  
  const toggleStimulation = async () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please connect to device first');
      return;
    }
    
    const newState = !stimulationActive;
    
    // Send power command (device-specific, may vary)
    const command = newState ? 'POWER:ON' : 'POWER:OFF';
    await bleService.sendData(command, true);
    
    setStimulationActive(newState);
  };
  
  const renderChannelControls = (channel: 0 | 1) => {
    const enabled = channel === 0 ? ch0Enabled : ch1Enabled;
    const setEnabled = channel === 0 ? setCh0Enabled : setCh1Enabled;
    const mode = channel === 0 ? ch0Mode : ch1Mode;
    const setMode = channel === 0 ? setCh0Mode : setCh1Mode;
    const intensity = channel === 0 ? ch0Intensity : ch1Intensity;
    const setIntensity = channel === 0 ? setCh0Intensity : setCh1Intensity;
    const pulseWidth = channel === 0 ? ch0PulseWidth : ch1PulseWidth;
    const setPulseWidth = channel === 0 ? setCh0PulseWidth : setCh1PulseWidth;
    const frequency = channel === 0 ? ch0Frequency : ch1Frequency;
    const setFrequency = channel === 0 ? setCh0Frequency : setCh1Frequency;
    
    return (
      <View style={styles.channelCard}>
        <View style={styles.channelHeader}>
          <Text style={styles.channelTitle}>Channel {channel}</Text>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>
        
        {enabled && (
          <>
            {/* Mode Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Stimulation Mode</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.modeButtons}>
                  {Object.entries(STIM_MODE_NAMES).map(([modeValue, modeName]) => {
                    const modeNum = parseInt(modeValue) as StimMode;
                    if (modeNum === StimMode.OFF) return null; // Skip OFF mode
                    
                    return (
                      <TouchableOpacity
                        key={modeValue}
                        style={[
                          styles.modeButton,
                          mode === modeNum && styles.modeButtonActive,
                        ]}
                        onPress={() => setMode(modeNum)}
                      >
                        <Text
                          style={[
                            styles.modeButtonText,
                            mode === modeNum && styles.modeButtonTextActive,
                          ]}
                        >
                          {modeName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
            
            {/* Intensity Slider */}
            <View style={styles.section}>
              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Intensity: {intensity}%</Text>
                <View style={styles.parameterControls}>
                  <TouchableOpacity
                    style={styles.paramButton}
                    onPress={() => setIntensity(Math.max(0, intensity - 5))}
                  >
                    <Text style={styles.paramButtonText}>-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.paramButton}
                    onPress={() => setIntensity(Math.min(100, intensity + 5))}
                  >
                    <Text style={styles.paramButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.parameterHint}>
                DAC: {intensityToAmplitude(intensity)} (safe: {SmartStimValidator.DAC_SAFE_MIN}-{SmartStimValidator.DAC_SAFE_MAX})
              </Text>
            </View>
            
            {/* Pulse Width */}
            <View style={styles.section}>
              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>
                  Pulse Width: {formatMicroseconds(pulseWidth)}
                </Text>
                <View style={styles.parameterControls}>
                  <TouchableOpacity
                    style={styles.paramButton}
                    onPress={() => setPulseWidth(Math.max(50, pulseWidth - 50))}
                  >
                    <Text style={styles.paramButtonText}>-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.paramButton}
                    onPress={() => setPulseWidth(Math.min(5000, pulseWidth + 50))}
                  >
                    <Text style={styles.paramButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
            {/* Frequency */}
            <View style={styles.section}>
              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>Frequency: {frequency} Hz</Text>
                <View style={styles.parameterControls}>
                  <TouchableOpacity
                    style={styles.paramButton}
                    onPress={() => setFrequency(Math.max(1, frequency - 5))}
                  >
                    <Text style={styles.paramButtonText}>-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.paramButton}
                    onPress={() => setFrequency(Math.min(200, frequency + 5))}
                  >
                    <Text style={styles.paramButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.parameterHint}>
                Period: {formatMicroseconds((1000000 / frequency))}
              </Text>
            </View>
            
            {/* Apply Button */}
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => sendChannelConfig(channel)}
            >
              <Text style={styles.applyButtonText}>
                Apply Channel {channel} Configuration
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };
  
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>⚡ Smart Stim Control</Text>
        {isConnected && (
          <Text style={styles.subtitle}>Connected: {connectedDeviceName}</Text>
        )}
      </View>
      
      {/* Master Control */}
      <View style={styles.masterControl}>
        <TouchableOpacity
          style={[
            styles.powerButton,
            stimulationActive && styles.powerButtonActive,
            !isConnected && styles.powerButtonDisabled,
          ]}
          onPress={toggleStimulation}
          disabled={!isConnected}
        >
          <Text style={styles.powerButtonText}>
            {stimulationActive ? '⏸ STOP STIMULATION' : '▶ START STIMULATION'}
          </Text>
        </TouchableOpacity>
        
        <View style={styles.sessionRow}>
          <Text style={styles.sessionLabel}>Session Duration:</Text>
          <View style={styles.durationControls}>
            <TouchableOpacity
              style={styles.durationButton}
              onPress={() => setSessionDuration(Math.max(1, sessionDuration - 5))}
            >
              <Text style={styles.durationButtonText}>-5</Text>
            </TouchableOpacity>
            <Text style={styles.durationValue}>{sessionDuration} min</Text>
            <TouchableOpacity
              style={styles.durationButton}
              onPress={() => setSessionDuration(Math.min(60, sessionDuration + 5))}
            >
              <Text style={styles.durationButtonText}>+5</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Quick Presets */}
      <View style={styles.presetsSection}>
        <Text style={styles.sectionTitle}>Quick Presets</Text>
        <View style={styles.presetButtons}>
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => loadPreset('basicBiphasic')}
          >
            <Text style={styles.presetButtonText}>Biphasic</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => loadPreset('basicMono')}
          >
            <Text style={styles.presetButtonText}>Monophasic</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => loadPreset('sineWave')}
          >
            <Text style={styles.presetButtonText}>Sine Wave</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => loadPreset('testMode')}
          >
            <Text style={styles.presetButtonText}>Test</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Channel Controls */}
      {renderChannelControls(0)}
      {renderChannelControls(1)}
      
      {/* Safety Info */}
      <View style={styles.safetyInfo}>
        <Text style={styles.safetyTitle}>⚠️ Safety Information</Text>
        <Text style={styles.safetyText}>
          • Device operates at 4 kHz (250µs precision){'\n'}
          • DAC neutral point: 2505{'\n'}
          • Safe amplitude range: 2000-3000{'\n'}
          • Auto fault detection on open circuit{'\n'}
          • Always start with low intensity{'\n'}
          • Stop immediately if discomfort occurs
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#6366f1',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#e0e7ff',
    marginTop: 4,
  },
  masterControl: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
    marginHorizontal: 12,
    borderRadius: 12,
    elevation: 2,
  },
  powerButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  powerButtonActive: {
    backgroundColor: '#ef4444',
  },
  powerButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  powerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  sessionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  durationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  durationButton: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  durationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  durationValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    minWidth: 60,
    textAlign: 'center',
  },
  presetsSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
    marginHorizontal: 12,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  presetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  presetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  channelCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
    marginHorizontal: 12,
    borderRadius: 12,
    elevation: 2,
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  channelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  section: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  modeButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  parameterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  parameterLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  parameterControls: {
    flexDirection: 'row',
    gap: 8,
  },
  paramButton: {
    backgroundColor: '#3b82f6',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paramButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  parameterHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  applyButton: {
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  safetyInfo: {
    backgroundColor: '#fef3c7',
    padding: 16,
    margin: 12,
    marginBottom: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  safetyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8,
  },
  safetyText: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 20,
  },
});
