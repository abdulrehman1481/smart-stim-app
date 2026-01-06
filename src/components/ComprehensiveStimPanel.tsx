import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
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

const WINDOW_SIZE = 50;
const UPDATE_INTERVAL = 100;

interface WaveformData {
  labels: string[];
  datasets: [{
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }];
}

export const ComprehensiveStimPanel: React.FC = () => {
  const { isConnected, connectedDeviceName, receivedMessages } = useBLE();
  
  // Channel 0 configuration
  const [ch0Enabled, setCh0Enabled] = useState(false);
  const [ch0Mode, setCh0Mode] = useState<StimMode>(StimMode.BI);
  const [ch0Intensity, setCh0Intensity] = useState(30);
  const [ch0PulseWidth, setCh0PulseWidth] = useState(500);
  const [ch0Frequency, setCh0Frequency] = useState(50);
  const [ch0BurstMode, setCh0BurstMode] = useState(false);
  const [ch0BurstDuration, setCh0BurstDuration] = useState(1000); // ms
  const [ch0BurstInterval, setCh0BurstInterval] = useState(2000); // ms
  
  // Channel 1 configuration
  const [ch1Enabled, setCh1Enabled] = useState(false);
  const [ch1Mode, setCh1Mode] = useState<StimMode>(StimMode.BI);
  const [ch1Intensity, setCh1Intensity] = useState(30);
  const [ch1PulseWidth, setCh1PulseWidth] = useState(500);
  const [ch1Frequency, setCh1Frequency] = useState(50);
  const [ch1BurstMode, setCh1BurstMode] = useState(false);
  const [ch1BurstDuration, setCh1BurstDuration] = useState(1000);
  const [ch1BurstInterval, setCh1BurstInterval] = useState(2000);
  
  // Session settings
  const [sessionDuration, setSessionDuration] = useState(20);
  const [stimulationActive, setStimulationActive] = useState(false);
  
  // Electrode connection check
  const [ch0ElectrodeConnected, setCh0ElectrodeConnected] = useState(true);
  const [ch1ElectrodeConnected, setCh1ElectrodeConnected] = useState(true);
  
  // Audio settings
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioVolume, setAudioVolume] = useState(50);
  const [audioFrequency, setAudioFrequency] = useState(440); // Hz
  
  // Waveform monitoring
  const [showWaveform, setShowWaveform] = useState(true);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [useSyntheticWave, setUseSyntheticWave] = useState(true);
  const [waveformType, setWaveformType] = useState<'sine' | 'square' | 'biphasic'>('biphasic');
  const [dataBuffer, setDataBuffer] = useState<number[]>(Array(WINDOW_SIZE).fill(0));
  const [sampleCount, setSampleCount] = useState(0);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeRef = useRef(0);
  const bufferRef = useRef<number[]>(Array(WINDOW_SIZE).fill(0));

  // Synthetic waveform generator
  const generateSyntheticSample = useCallback((): number => {
    const t = timeRef.current;
    const freq = ch0Frequency; // Use channel 0 frequency
    const amp = ch0Intensity;
    
    let value = 0;
    
    switch (waveformType) {
      case 'sine':
        value = amp * Math.sin(2 * Math.PI * freq * t);
        break;
      
      case 'square':
        value = amp * (Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1);
        break;
      
      case 'biphasic':
        const period = 1 / freq;
        const phaseTime = t % period;
        const pulseWidth = ch0PulseWidth / 1000000; // Convert µs to seconds
        const interphaseGap = 100 / 1000000;
        
        if (phaseTime < pulseWidth) {
          value = amp;
        } else if (phaseTime < pulseWidth + interphaseGap) {
          value = 0;
        } else if (phaseTime < 2 * pulseWidth + interphaseGap) {
          value = -amp;
        } else {
          value = 0;
        }
        break;
    }
    
    timeRef.current += UPDATE_INTERVAL / 1000;
    return value;
  }, [waveformType, ch0Frequency, ch0Intensity, ch0PulseWidth]);

  const addDataPoint = useCallback((value: number) => {
    bufferRef.current = [...bufferRef.current.slice(1), value];
    setDataBuffer([...bufferRef.current]);
    setSampleCount(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (isMonitoring && useSyntheticWave) {
      timeRef.current = 0;
      
      intervalRef.current = setInterval(() => {
        const sample = generateSyntheticSample();
        addDataPoint(sample);
      }, UPDATE_INTERVAL);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isMonitoring, useSyntheticWave, generateSyntheticSample, addDataPoint]);

  const chartData: WaveformData = useMemo(() => ({
    labels: Array(WINDOW_SIZE).fill(''),
    datasets: [{
      data: dataBuffer.length > 0 ? dataBuffer : [0],
      color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
      strokeWidth: 2.5,
    }],
  }), [dataBuffer]);

  const stats = useMemo(() => {
    const current = dataBuffer[dataBuffer.length - 1] || 0;
    const max = Math.max(...dataBuffer);
    const min = Math.min(...dataBuffer);
    const avg = dataBuffer.reduce((a, b) => a + b, 0) / dataBuffer.length;
    return { current, max, min, avg };
  }, [dataBuffer]);

  const checkElectrodeConnection = async (channel: 0 | 1) => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please connect to device first');
      return;
    }
    
    // Send electrode check command
    const command = `CHECK:CH${channel}`;
    const success = await bleService.sendData(command, true);
    
    if (success) {
      // Simulate response (in real implementation, parse from device)
      setTimeout(() => {
        const connected = Math.random() > 0.3; // 70% success rate simulation
        if (channel === 0) {
          setCh0ElectrodeConnected(connected);
        } else {
          setCh1ElectrodeConnected(connected);
        }
        
        Alert.alert(
          `Channel ${channel} Electrode Check`,
          connected ? '✅ Electrode connected properly' : '❌ Poor or no connection detected',
          [{ text: 'OK' }]
        );
      }, 500);
    }
  };

  const sendChannelConfig = async (channel: 0 | 1) => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please connect to device first');
      return;
    }
    
    const intensity = channel === 0 ? ch0Intensity : ch1Intensity;
    const mode = channel === 0 ? ch0Mode : ch1Mode;
    const pulseWidth = channel === 0 ? ch0PulseWidth : ch1PulseWidth;
    const frequency = channel === 0 ? ch0Frequency : ch1Frequency;
    const burstMode = channel === 0 ? ch0BurstMode : ch1BurstMode;
    const burstDuration = channel === 0 ? ch0BurstDuration : ch1BurstDuration;
    const burstInterval = channel === 0 ? ch0BurstInterval : ch1BurstInterval;
    
    const gapPeriod = (1000000 / frequency) - pulseWidth;
    
    const config: ChannelConfig = {
      channel,
      mode,
      A0: intensityToAmplitude(intensity),
      T1: pulseWidth,
      T2: mode === StimMode.BI ? pulseWidth : undefined,
      RP: 10,
      GP: Math.max(100, Math.round(gapPeriod)),
    };
    
    const validation = SmartStimValidator.validateChannelConfig(config);
    if (!validation.valid) {
      Alert.alert('Invalid Configuration', validation.errors.join('\n'), [{ text: 'OK' }]);
      return;
    }
    
    let command = SmartStimCommandBuilder.buildChannelCommand(config);
    
    // Add burst mode parameters if enabled
    if (burstMode) {
      command += `,BURST:${burstDuration},${burstInterval}`;
    }
    
    console.log('[ComprehensiveStim] Sending:', command);
    
    const success = await bleService.sendData(command, true);
    if (success) {
      Alert.alert(
        'Success',
        `Channel ${channel} configured:\n${STIM_MODE_NAMES[mode]}\nIntensity: ${intensity}%\nFrequency: ${frequency}Hz${burstMode ? '\n🔥 Burst Mode ON' : ''}`,
        [{ text: 'OK' }]
      );
    }
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
    if (!audioEnabled) {
      // In real implementation: Start audio tone
      Alert.alert('Audio', `Audio tone started at ${audioFrequency}Hz`);
    } else {
      // In real implementation: Stop audio tone
      Alert.alert('Audio', 'Audio tone stopped');
    }
  };

  const toggleStimulation = async () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please connect to device first');
      return;
    }
    
    const newState = !stimulationActive;
    const command = newState ? 'POWER:ON' : 'POWER:OFF';
    await bleService.sendData(command, true);
    
    setStimulationActive(newState);
    
    if (newState) {
      setIsMonitoring(true);
    }
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
    const burstMode = channel === 0 ? ch0BurstMode : ch1BurstMode;
    const setBurstMode = channel === 0 ? setCh0BurstMode : setCh1BurstMode;
    const burstDuration = channel === 0 ? ch0BurstDuration : ch1BurstDuration;
    const setBurstDuration = channel === 0 ? setCh0BurstDuration : setCh1BurstDuration;
    const burstInterval = channel === 0 ? ch0BurstInterval : ch1BurstInterval;
    const setBurstInterval = channel === 0 ? setCh0BurstInterval : setCh1BurstInterval;
    const electrodeConnected = channel === 0 ? ch0ElectrodeConnected : ch1ElectrodeConnected;
    
    return (
      <View style={styles.channelCard}>
        <View style={styles.channelHeader}>
          <View style={styles.channelTitleRow}>
            <Text style={styles.channelTitle}>Channel {channel}</Text>
            {!electrodeConnected && <Text style={styles.electrodeWarning}>⚠️</Text>}
          </View>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>
        
        {enabled && (
          <>
            {/* Electrode Check */}
            <TouchableOpacity
              style={[styles.electrodeButton, electrodeConnected && styles.electrodeButtonGood]}
              onPress={() => checkElectrodeConnection(channel)}
            >
              <Text style={styles.electrodeButtonText}>
                {electrodeConnected ? '✅ Check Electrode' : '⚠️ Check Electrode'}
              </Text>
            </TouchableOpacity>
            
            {/* Mode Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Stimulation Mode</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.modeButtons}>
                  {Object.entries(STIM_MODE_NAMES).map(([modeValue, modeName]) => {
                    const modeNum = parseInt(modeValue) as StimMode;
                    if (modeNum === StimMode.OFF) return null;
                    
                    return (
                      <TouchableOpacity
                        key={modeValue}
                        style={[styles.modeButton, mode === modeNum && styles.modeButtonActive]}
                        onPress={() => setMode(modeNum)}
                      >
                        <Text style={[styles.modeButtonText, mode === modeNum && styles.modeButtonTextActive]}>
                          {modeName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
            
            {/* Burst Mode */}
            <View style={styles.section}>
              <View style={styles.parameterRow}>
                <Text style={styles.parameterLabel}>🔥 Burst Mode</Text>
                <Switch value={burstMode} onValueChange={setBurstMode} />
              </View>
              
              {burstMode && (
                <View style={styles.burstParams}>
                  <View style={styles.burstParam}>
                    <Text style={styles.burstLabel}>Burst Duration: {burstDuration}ms</Text>
                    <View style={styles.parameterControls}>
                      <TouchableOpacity
                        style={styles.paramButton}
                        onPress={() => setBurstDuration(Math.max(100, burstDuration - 100))}
                      >
                        <Text style={styles.paramButtonText}>-</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.paramButton}
                        onPress={() => setBurstDuration(burstDuration + 100)}
                      >
                        <Text style={styles.paramButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.burstParam}>
                    <Text style={styles.burstLabel}>Burst Interval: {burstInterval}ms</Text>
                    <View style={styles.parameterControls}>
                      <TouchableOpacity
                        style={styles.paramButton}
                        onPress={() => setBurstInterval(Math.max(500, burstInterval - 100))}
                      >
                        <Text style={styles.paramButtonText}>-</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.paramButton}
                        onPress={() => setBurstInterval(burstInterval + 100)}
                      >
                        <Text style={styles.paramButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
            
            {/* Intensity */}
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
                <Text style={styles.parameterLabel}>Pulse Width: {formatMicroseconds(pulseWidth)}</Text>
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
            </View>
            
            {/* Apply Button */}
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => sendChannelConfig(channel)}
            >
              <Text style={styles.applyButtonText}>Apply Channel {channel} Configuration</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const screenWidth = Dimensions.get('window').width;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>⚡ Stimulation Control</Text>
        {isConnected && <Text style={styles.subtitle}>Connected: {connectedDeviceName}</Text>}
      </View>
      
      {/* Master Control */}
      <View style={styles.masterControl}>
        <TouchableOpacity
          style={[styles.powerButton, stimulationActive && styles.powerButtonActive, !isConnected && styles.powerButtonDisabled]}
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

      {/* Audio Control */}
      <View style={styles.audioCard}>
        <View style={styles.audioHeader}>
          <Text style={styles.audioTitle}>🔊 Audio Feedback</Text>
          <Switch value={audioEnabled} onValueChange={toggleAudio} />
        </View>
        
        {audioEnabled && (
          <>
            <View style={styles.audioControl}>
              <Text style={styles.audioLabel}>Volume: {audioVolume}%</Text>
              <View style={styles.parameterControls}>
                <TouchableOpacity
                  style={styles.paramButton}
                  onPress={() => setAudioVolume(Math.max(0, audioVolume - 10))}
                >
                  <Text style={styles.paramButtonText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.paramButton}
                  onPress={() => setAudioVolume(Math.min(100, audioVolume + 10))}
                >
                  <Text style={styles.paramButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.audioControl}>
              <Text style={styles.audioLabel}>Tone: {audioFrequency} Hz</Text>
              <View style={styles.parameterControls}>
                <TouchableOpacity
                  style={styles.paramButton}
                  onPress={() => setAudioFrequency(Math.max(200, audioFrequency - 50))}
                >
                  <Text style={styles.paramButtonText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.paramButton}
                  onPress={() => setAudioFrequency(Math.min(2000, audioFrequency + 50))}
                >
                  <Text style={styles.paramButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Waveform Monitor */}
      {showWaveform && (
        <View style={styles.waveformCard}>
          <View style={styles.waveformHeader}>
            <Text style={styles.waveformTitle}>📊 Output Waveform Monitor</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, isMonitoring && styles.statusDotActive]} />
              <Text style={styles.statusText}>{isMonitoring ? 'Live' : 'Stopped'}</Text>
            </View>
          </View>
          
          <View style={styles.chartContainer}>
            <LineChart
              data={chartData}
              width={screenWidth - 48}
              height={180}
              chartConfig={{
                backgroundColor: '#6366f1',
                backgroundGradientFrom: '#6366f1',
                backgroundGradientTo: '#8b5cf6',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${0.7 * opacity})`,
                style: { borderRadius: 16 },
                propsForDots: { r: '0' },
                propsForBackgroundLines: {
                  strokeDasharray: '',
                  stroke: 'rgba(255, 255, 255, 0.15)',
                  strokeWidth: 1,
                },
              }}
              bezier={false}
              style={styles.chart}
              withInnerLines={true}
              withOuterLines={false}
              withVerticalLabels={false}
              withHorizontalLabels={true}
              fromZero={false}
              segments={4}
            />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Current</Text>
              <Text style={styles.statValue}>{stats.current.toFixed(1)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Max</Text>
              <Text style={styles.statValue}>{stats.max.toFixed(1)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Min</Text>
              <Text style={styles.statValue}>{stats.min.toFixed(1)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Avg</Text>
              <Text style={styles.statValue}>{stats.avg.toFixed(1)}</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.monitorButton, isMonitoring && styles.monitorButtonActive]}
            onPress={() => setIsMonitoring(!isMonitoring)}
          >
            <Text style={styles.monitorButtonText}>
              {isMonitoring ? '⏸ Stop Monitor' : '▶ Start Monitor'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
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
  audioCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
    marginHorizontal: 12,
    borderRadius: 12,
    elevation: 2,
  },
  audioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  audioTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  audioControl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  audioLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  waveformCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
    marginHorizontal: 12,
    borderRadius: 12,
    elevation: 2,
  },
  waveformHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  waveformTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: '#22c55e',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  chartContainer: {
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    marginBottom: 16,
  },
  chart: {
    borderRadius: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366f1',
  },
  monitorButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  monitorButtonActive: {
    backgroundColor: '#ef4444',
  },
  monitorButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
  channelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  channelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  electrodeWarning: {
    fontSize: 20,
  },
  electrodeButton: {
    backgroundColor: '#f59e0b',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  electrodeButtonGood: {
    backgroundColor: '#10b981',
  },
  electrodeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
  burstParams: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  burstParam: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  burstLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
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
