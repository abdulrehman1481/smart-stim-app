import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Dimensions,
  Alert,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useBLE } from '../functionality/BLEContext';

const WINDOW_SIZE = 50; // Reduced for better performance
const UPDATE_INTERVAL = 100; // Increased to 100ms for smoother performance

interface WaveformData {
  labels: string[];
  datasets: [{
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }];
}

export const WaveformPlot: React.FC = () => {
  const { isConnected, connectedDeviceName, receivedMessages } = useBLE();
  
  // State
  const [isStreaming, setIsStreaming] = useState(false);
  const [useSyntheticData, setUseSyntheticData] = useState(true);
  const [waveformType, setWaveformType] = useState<'sine' | 'square' | 'sawtooth' | 'biphasic'>('biphasic');
  const [dataBuffer, setDataBuffer] = useState<number[]>(Array(WINDOW_SIZE).fill(0));
  const [sampleCount, setSampleCount] = useState(0);
  const [frequency, setFrequency] = useState(50); // Hz for synthetic data
  const [amplitude, setAmplitude] = useState(100); // Max amplitude
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeRef = useRef(0);
  const bufferRef = useRef<number[]>(Array(WINDOW_SIZE).fill(0));

  // Memoized waveform generator for better performance
  const generateSyntheticSample = useCallback((): number => {
    const t = timeRef.current;
    const freq = frequency;
    const amp = amplitude;
    
    let value = 0;
    
    switch (waveformType) {
      case 'sine':
        value = amp * Math.sin(2 * Math.PI * freq * t);
        break;
      
      case 'square':
        value = amp * (Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1);
        break;
      
      case 'sawtooth':
        value = amp * (2 * ((freq * t) % 1) - 1);
        break;
      
      case 'biphasic':
        // Biphasic pulse simulation
        const period = 1 / freq;
        const phaseTime = t % period;
        const pulseWidth = 0.0005; // 500 microseconds converted to seconds
        const interphaseGap = 0.0001; // 100 microseconds
        
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
  }, [waveformType, frequency, amplitude]);

  // Parse waveform data from BLE messages (placeholder for future firmware integration)
  const parseWaveformFromBLE = (message: string): number | null => {
    // Future implementation: Parse firmware waveform data
    // Expected format: "WAVE:<value>" or similar
    if (message.startsWith('WAVE:')) {
      try {
        const value = parseFloat(message.substring(5));
        if (!isNaN(value)) {
          return value;
        }
      } catch (e) {
        console.error('[Waveform] Parse error:', e);
      }
    }
    return null;
  };

  // Update data buffer with new sample - optimized
  const addDataPoint = useCallback((value: number) => {
    bufferRef.current = [...bufferRef.current.slice(1), value];
    setDataBuffer([...bufferRef.current]);
    setSampleCount(prev => prev + 1);
  }, []);

  // Start/stop streaming - optimized
  useEffect(() => {
    if (isStreaming && useSyntheticData) {
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
  }, [isStreaming, useSyntheticData, generateSyntheticSample, addDataPoint]);

  // Monitor BLE messages for waveform data
  useEffect(() => {
    if (!useSyntheticData && isStreaming && receivedMessages.length > 0) {
      const lastMessage = receivedMessages[receivedMessages.length - 1];
      // Extract the actual message content (remove timestamp and RX: prefix)
      const messageContent = lastMessage.split('RX: ')[1] || lastMessage;
      const waveValue = parseWaveformFromBLE(messageContent);
      
      if (waveValue !== null) {
        addDataPoint(waveValue);
      }
    }
  }, [receivedMessages, useSyntheticData, isStreaming]);

  // Memoized chart data for performance
  const chartData: WaveformData = useMemo(() => ({
    labels: Array(WINDOW_SIZE).fill(''),
    datasets: [{
      data: dataBuffer.length > 0 ? dataBuffer : [0],
      color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
      strokeWidth: 2.5,
    }],
  }), [dataBuffer]);

  // Memoized statistics
  const stats = useMemo(() => {
    const current = dataBuffer[dataBuffer.length - 1] || 0;
    const max = Math.max(...dataBuffer);
    const min = Math.min(...dataBuffer);
    const avg = dataBuffer.reduce((a, b) => a + b, 0) / dataBuffer.length;
    return { current, max, min, avg };
  }, [dataBuffer]);

  const handleStartStop = () => {
    if (!useSyntheticData && !isConnected) {
      Alert.alert(
        'Not Connected',
        'Please connect to a BLE device first or enable synthetic data mode.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setIsStreaming(!isStreaming);
    if (!isStreaming) {
      setSampleCount(0);
      setDataBuffer(Array(WINDOW_SIZE).fill(0));
    }
  };

  const handleClear = useCallback(() => {
    const emptyBuffer = Array(WINDOW_SIZE).fill(0);
    bufferRef.current = emptyBuffer;
    setDataBuffer(emptyBuffer);
    setSampleCount(0);
    timeRef.current = 0;
  }, []);

  const screenWidth = Dimensions.get('window').width;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>📊 Waveform Monitor</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, isStreaming && styles.statusDotActive]} />
            <Text style={styles.statusText}>
              {isStreaming ? 'Streaming' : 'Stopped'}
            </Text>
          </View>
        </View>

        {/* Chart Display - Moved to top for better UX */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Live Waveform</Text>
            <Text style={styles.sampleCount}>{sampleCount} samples</Text>
          </View>
          
          <View style={styles.chartContainer}>
            <LineChart
              data={chartData}
              width={screenWidth - 48}
              height={220}
              chartConfig={{
                backgroundColor: '#6366f1',
                backgroundGradientFrom: '#6366f1',
                backgroundGradientTo: '#8b5cf6',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${0.7 * opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '0',
                },
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

          {/* Statistics */}
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
        </View>

        {/* Control Buttons */}
        <View style={styles.controlsCard}>
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.controlButton, styles.primaryButton, isStreaming && styles.stopButton]}
              onPress={handleStartStop}
              activeOpacity={0.7}
            >
              <Text style={styles.controlButtonIcon}>{isStreaming ? '⏸' : '▶'}</Text>
              <Text style={styles.controlButtonText}>
                {isStreaming ? 'Stop' : 'Start'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.controlButton, styles.secondaryButton]}
              onPress={handleClear}
              disabled={isStreaming}
              activeOpacity={0.7}
            >
              <Text style={styles.controlButtonIcon}>🗑</Text>
              <Text style={styles.controlButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Waveform Type Selection */}
        {useSyntheticData && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Waveform Type</Text>
            <View style={styles.waveformGrid}>
              {(['biphasic', 'sine', 'square', 'sawtooth'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.waveButton,
                    waveformType === type && styles.waveButtonActive
                  ]}
                  onPress={() => !isStreaming && setWaveformType(type)}
                  disabled={isStreaming}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.waveButtonText,
                    waveformType === type && styles.waveButtonTextActive
                  ]}>
                    {type === 'biphasic' ? '⚡ Biphasic' : 
                     type === 'sine' ? '〰 Sine' :
                     type === 'square' ? '⊓ Square' : '⟋ Sawtooth'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Data Source Control */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Synthetic Data Mode</Text>
              <Text style={styles.settingDescription}>
                {useSyntheticData ? 'Using test waveforms' : 'Receiving from device'}
              </Text>
            </View>
            <Switch
              value={useSyntheticData}
              onValueChange={setUseSyntheticData}
              trackColor={{ false: '#e5e7eb', true: '#a5b4fc' }}
              thumbColor={useSyntheticData ? '#6366f1' : '#9ca3af'}
              disabled={isStreaming}
            />
          </View>
          
          {!useSyntheticData && !isConnected && (
            <View style={styles.warningBox}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningText}>
                No device connected. Connect via Devices tab.
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ Quick Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Update Rate:</Text>
            <Text style={styles.infoValue}>{1000/UPDATE_INTERVAL} Hz</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Window Size:</Text>
            <Text style={styles.infoValue}>{WINDOW_SIZE} samples</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Time Span:</Text>
            <Text style={styles.infoValue}>~{(WINDOW_SIZE * UPDATE_INTERVAL / 1000).toFixed(1)}s</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1e293b',
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
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  sampleCount: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366f1',
  },
  controlsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#22c55e',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  secondaryButton: {
    backgroundColor: '#64748b',
  },
  controlButtonIcon: {
    fontSize: 18,
  },
  controlButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  waveformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  waveButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  waveButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  waveButtonText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },
  waveButtonTextActive: {
    color: '#ffffff',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#64748b',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    color: '#92400e',
    fontSize: 13,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '700',
  },
});
