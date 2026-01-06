import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const WINDOW_SIZE = 100;
const UPDATE_INTERVAL = 100; // 100ms = 10Hz sampling

type SensorType = 'PPG_IR' | 'PPG_RED' | 'PPG_GREEN' | 'HR' | 'EDA' | 'GYRO_X' | 'GYRO_Y' | 'GYRO_Z' | 'ACC_X' | 'ACC_Y' | 'ACC_Z' | 'TEMP' | 'SCR';

interface SensorData {
  type: SensorType;
  label: string;
  value: number;
  unit: string;
  color: string;
  buffer: number[];
}

type FilterType = 'none' | 'lowpass' | 'bandpass';

interface FilterConfig {
  type: FilterType;
  cutoffLow: number; // Hz
  cutoffHigh: number; // Hz
}

export const WristbandSensorsPanel: React.FC = () => {
  const { isConnected, connectedDeviceName, receivedMessages } = useBLE();
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [useSyntheticData, setUseSyntheticData] = useState(true);
  const [selectedSensor, setSelectedSensor] = useState<SensorType>('PPG_IR');
  const [showRawValues, setShowRawValues] = useState(true);
  const [showWaveform, setShowWaveform] = useState(true);
  
  // Filter settings
  const [filterType, setFilterType] = useState<FilterType>('none');
  const [lowPassCutoff, setLowPassCutoff] = useState(5); // Hz
  const [bandPassLow, setBandPassLow] = useState(0.5); // Hz
  const [bandPassHigh, setBandPassHigh] = useState(10); // Hz
  
  // Sensor data
  const [sensors, setSensors] = useState<Record<SensorType, SensorData>>({
    PPG_IR: { type: 'PPG_IR', label: 'PPG-IR', value: 0, unit: '', color: '#ef4444', buffer: Array(WINDOW_SIZE).fill(0) },
    PPG_RED: { type: 'PPG_RED', label: 'PPG-Red', value: 0, unit: '', color: '#dc2626', buffer: Array(WINDOW_SIZE).fill(0) },
    PPG_GREEN: { type: 'PPG_GREEN', label: 'PPG-Green', value: 0, unit: '', color: '#10b981', buffer: Array(WINDOW_SIZE).fill(0) },
    HR: { type: 'HR', label: 'Heart Rate', value: 0, unit: 'BPM', color: '#f97316', buffer: Array(WINDOW_SIZE).fill(0) },
    EDA: { type: 'EDA', label: 'EDA', value: 0, unit: 'µS', color: '#3b82f6', buffer: Array(WINDOW_SIZE).fill(0) },
    GYRO_X: { type: 'GYRO_X', label: 'Gyro-X', value: 0, unit: '°/s', color: '#8b5cf6', buffer: Array(WINDOW_SIZE).fill(0) },
    GYRO_Y: { type: 'GYRO_Y', label: 'Gyro-Y', value: 0, unit: '°/s', color: '#a855f7', buffer: Array(WINDOW_SIZE).fill(0) },
    GYRO_Z: { type: 'GYRO_Z', label: 'Gyro-Z', value: 0, unit: '°/s', color: '#c084fc', buffer: Array(WINDOW_SIZE).fill(0) },
    ACC_X: { type: 'ACC_X', label: 'Accel-X', value: 0, unit: 'g', color: '#06b6d4', buffer: Array(WINDOW_SIZE).fill(0) },
    ACC_Y: { type: 'ACC_Y', label: 'Accel-Y', value: 0, unit: 'g', color: '#0891b2', buffer: Array(WINDOW_SIZE).fill(0) },
    ACC_Z: { type: 'ACC_Z', label: 'Accel-Z', value: 0, unit: 'g', color: '#0e7490', buffer: Array(WINDOW_SIZE).fill(0) },
    TEMP: { type: 'TEMP', label: 'Temperature', value: 0, unit: '°C', color: '#f59e0b', buffer: Array(WINDOW_SIZE).fill(0) },
    SCR: { type: 'SCR', label: 'SCR', value: 0, unit: '', color: '#14b8a6', buffer: Array(WINDOW_SIZE).fill(0) },
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeRef = useRef(0);

  // Simple low-pass filter implementation
  const applyLowPassFilter = (data: number[], cutoff: number): number[] => {
    const alpha = cutoff / (cutoff + (1 / (UPDATE_INTERVAL / 1000)));
    const filtered = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      filtered[i] = alpha * data[i] + (1 - alpha) * filtered[i - 1];
    }
    
    return filtered;
  };

  // Simple band-pass filter (high-pass + low-pass)
  const applyBandPassFilter = (data: number[], low: number, high: number): number[] => {
    // First apply high-pass (subtract low-pass)
    const lowPassResult = applyLowPassFilter(data, low);
    const highPassResult = data.map((val, idx) => val - lowPassResult[idx]);
    
    // Then apply low-pass to high-pass result
    return applyLowPassFilter(highPassResult, high);
  };

  // Get filtered data based on current filter settings
  const getFilteredData = (buffer: number[]): number[] => {
    switch (filterType) {
      case 'lowpass':
        return applyLowPassFilter(buffer, lowPassCutoff);
      case 'bandpass':
        return applyBandPassFilter(buffer, bandPassLow, bandPassHigh);
      default:
        return buffer;
    }
  };

  // Generate synthetic sensor data
  const generateSyntheticSensorData = useCallback(() => {
    const t = timeRef.current;
    const newSensors = { ...sensors };
    
    // PPG signals (simulate heartbeat ~60-80 BPM)
    const heartRate = 70;
    const ppgBase = 1000 + 200 * Math.sin(2 * Math.PI * (heartRate / 60) * t);
    newSensors.PPG_IR.value = ppgBase + Math.random() * 20;
    newSensors.PPG_RED.value = ppgBase * 0.8 + Math.random() * 15;
    newSensors.PPG_GREEN.value = ppgBase * 0.6 + Math.random() * 10;
    
    // Heart Rate
    newSensors.HR.value = heartRate + (Math.random() - 0.5) * 5;
    
    // EDA (slowly varying)
    newSensors.EDA.value = 5 + 2 * Math.sin(0.1 * t) + Math.random() * 0.5;
    
    // Gyroscope (simulate small movements)
    newSensors.GYRO_X.value = 10 * Math.sin(0.5 * t) + Math.random() * 5;
    newSensors.GYRO_Y.value = 8 * Math.cos(0.7 * t) + Math.random() * 4;
    newSensors.GYRO_Z.value = 5 * Math.sin(0.3 * t) + Math.random() * 3;
    
    // Accelerometer (simulate gravity + small movements)
    newSensors.ACC_X.value = 0.1 + 0.2 * Math.sin(0.4 * t) + Math.random() * 0.05;
    newSensors.ACC_Y.value = 0.05 + 0.15 * Math.cos(0.6 * t) + Math.random() * 0.03;
    newSensors.ACC_Z.value = 1.0 + 0.1 * Math.sin(0.2 * t) + Math.random() * 0.02; // Mostly gravity
    
    // Temperature (slowly varying body temp)
    newSensors.TEMP.value = 36.5 + 0.3 * Math.sin(0.05 * t) + Math.random() * 0.1;
    
    // SCR (skin conductance response - occasional spikes)
    const spikeProb = Math.random();
    newSensors.SCR.value = spikeProb > 0.95 ? 5 + Math.random() * 3 : 1 + Math.random() * 0.5;
    
    // Update buffers
    Object.keys(newSensors).forEach((key) => {
      const sensorKey = key as SensorType;
      const sensor = newSensors[sensorKey];
      sensor.buffer = [...sensor.buffer.slice(1), sensor.value];
    });
    
    setSensors(newSensors);
    timeRef.current += UPDATE_INTERVAL / 1000;
  }, [sensors]);

  // Start/stop streaming
  useEffect(() => {
    if (isStreaming && useSyntheticData) {
      timeRef.current = 0;
      
      intervalRef.current = setInterval(() => {
        generateSyntheticSensorData();
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
  }, [isStreaming, useSyntheticData, generateSyntheticSensorData]);

  const handleStartStop = () => {
    if (!useSyntheticData && !isConnected) {
      Alert.alert(
        'Not Connected',
        'Please connect to wristband device first or enable synthetic data mode.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setIsStreaming(!isStreaming);
  };

  const handleClear = () => {
    const clearedSensors = { ...sensors };
    Object.keys(clearedSensors).forEach((key) => {
      const sensorKey = key as SensorType;
      clearedSensors[sensorKey].buffer = Array(WINDOW_SIZE).fill(0);
      clearedSensors[sensorKey].value = 0;
    });
    setSensors(clearedSensors);
    timeRef.current = 0;
  };

  const selectedSensorData = sensors[selectedSensor];
  const filteredBuffer = getFilteredData(selectedSensorData.buffer);
  
  const chartData = {
    labels: Array(WINDOW_SIZE).fill(''),
    datasets: [{
      data: filteredBuffer.length > 0 ? filteredBuffer : [0],
      color: (opacity = 1) => selectedSensorData.color || `rgba(99, 102, 241, ${opacity})`,
      strokeWidth: 2.5,
    }],
  };

  const screenWidth = Dimensions.get('window').width;

  // Group sensors by category
  const ppgSensors: SensorType[] = ['PPG_IR', 'PPG_RED', 'PPG_GREEN'];
  const imuSensors: SensorType[] = ['GYRO_X', 'GYRO_Y', 'GYRO_Z', 'ACC_X', 'ACC_Y', 'ACC_Z'];
  const bioSensors: SensorType[] = ['HR', 'EDA', 'TEMP', 'SCR'];

  const renderSensorGrid = (sensorTypes: SensorType[], title: string) => (
    <View style={styles.sensorGroup}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.sensorGrid}>
        {sensorTypes.map((sensorType) => {
          const sensor = sensors[sensorType];
          const isSelected = selectedSensor === sensorType;
          
          return (
            <TouchableOpacity
              key={sensorType}
              style={[
                styles.sensorCard,
                isSelected && styles.sensorCardSelected,
                { borderLeftColor: sensor.color, borderLeftWidth: 4 }
              ]}
              onPress={() => setSelectedSensor(sensorType)}
            >
              <Text style={[styles.sensorLabel, isSelected && styles.sensorLabelSelected]}>
                {sensor.label}
              </Text>
              <Text style={[styles.sensorValue, isSelected && styles.sensorValueSelected]}>
                {sensor.value.toFixed(2)}
              </Text>
              {sensor.unit && (
                <Text style={[styles.sensorUnit, isSelected && styles.sensorUnitSelected]}>
                  {sensor.unit}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🌊 Wristband Sensors</Text>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, isStreaming && styles.statusDotActive]} />
          <Text style={styles.statusText}>{isStreaming ? 'Streaming' : 'Stopped'}</Text>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsCard}>
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.controlButton, styles.primaryButton, isStreaming && styles.stopButton]}
            onPress={handleStartStop}
          >
            <Text style={styles.controlButtonText}>
              {isStreaming ? '⏸ Stop' : '▶ Start'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlButton, styles.secondaryButton]}
            onPress={handleClear}
            disabled={isStreaming}
          >
            <Text style={styles.controlButtonText}>🗑 Clear</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Synthetic Data Mode</Text>
          <Switch
            value={useSyntheticData}
            onValueChange={setUseSyntheticData}
            disabled={isStreaming}
          />
        </View>
      </View>

      {/* Waveform Display */}
      {showWaveform && (
        <View style={styles.waveformCard}>
          <View style={styles.waveformHeader}>
            <Text style={styles.waveformTitle}>
              📊 {selectedSensorData.label} Waveform
            </Text>
            <Text style={styles.filterBadge}>
              {filterType === 'none' ? 'Raw' : 
               filterType === 'lowpass' ? `LP ${lowPassCutoff}Hz` :
               `BP ${bandPassLow}-${bandPassHigh}Hz`}
            </Text>
          </View>
          
          <View style={styles.chartContainer}>
            <LineChart
              data={chartData}
              width={screenWidth - 48}
              height={220}
              chartConfig={{
                backgroundColor: selectedSensorData.color,
                backgroundGradientFrom: selectedSensorData.color,
                backgroundGradientTo: selectedSensorData.color,
                decimalPlaces: 1,
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

          <View style={styles.waveformStats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Current</Text>
              <Text style={[styles.statValue, { color: selectedSensorData.color }]}>
                {selectedSensorData.value.toFixed(2)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Max</Text>
              <Text style={[styles.statValue, { color: selectedSensorData.color }]}>
                {Math.max(...filteredBuffer).toFixed(2)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Min</Text>
              <Text style={[styles.statValue, { color: selectedSensorData.color }]}>
                {Math.min(...filteredBuffer).toFixed(2)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Avg</Text>
              <Text style={[styles.statValue, { color: selectedSensorData.color }]}>
                {(filteredBuffer.reduce((a, b) => a + b, 0) / filteredBuffer.length).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Filter Controls */}
      <View style={styles.filterCard}>
        <Text style={styles.filterTitle}>🔧 Signal Filtering</Text>
        
        <View style={styles.filterTypeRow}>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'none' && styles.filterButtonActive]}
            onPress={() => setFilterType('none')}
          >
            <Text style={[styles.filterButtonText, filterType === 'none' && styles.filterButtonTextActive]}>
              No Filter
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'lowpass' && styles.filterButtonActive]}
            onPress={() => setFilterType('lowpass')}
          >
            <Text style={[styles.filterButtonText, filterType === 'lowpass' && styles.filterButtonTextActive]}>
              Low-Pass
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'bandpass' && styles.filterButtonActive]}
            onPress={() => setFilterType('bandpass')}
          >
            <Text style={[styles.filterButtonText, filterType === 'bandpass' && styles.filterButtonTextActive]}>
              Band-Pass
            </Text>
          </TouchableOpacity>
        </View>
        
        {filterType === 'lowpass' && (
          <View style={styles.filterParams}>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Cutoff: {lowPassCutoff} Hz</Text>
              <View style={styles.paramButtons}>
                <TouchableOpacity
                  style={styles.paramButton}
                  onPress={() => setLowPassCutoff(Math.max(1, lowPassCutoff - 1))}
                >
                  <Text style={styles.paramButtonText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.paramButton}
                  onPress={() => setLowPassCutoff(Math.min(20, lowPassCutoff + 1))}
                >
                  <Text style={styles.paramButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        
        {filterType === 'bandpass' && (
          <View style={styles.filterParams}>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Low: {bandPassLow} Hz</Text>
              <View style={styles.paramButtons}>
                <TouchableOpacity
                  style={styles.paramButton}
                  onPress={() => setBandPassLow(Math.max(0.1, bandPassLow - 0.5))}
                >
                  <Text style={styles.paramButtonText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.paramButton}
                  onPress={() => setBandPassLow(Math.min(bandPassHigh - 0.5, bandPassLow + 0.5))}
                >
                  <Text style={styles.paramButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>High: {bandPassHigh} Hz</Text>
              <View style={styles.paramButtons}>
                <TouchableOpacity
                  style={styles.paramButton}
                  onPress={() => setBandPassHigh(Math.max(bandPassLow + 0.5, bandPassHigh - 1))}
                >
                  <Text style={styles.paramButtonText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.paramButton}
                  onPress={() => setBandPassHigh(Math.min(30, bandPassHigh + 1))}
                >
                  <Text style={styles.paramButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Sensor Data Display */}
      {showRawValues && (
        <>
          {renderSensorGrid(ppgSensors, '❤️ PPG Sensors')}
          {renderSensorGrid(bioSensors, '🧬 Biometric Sensors')}
          {renderSensorGrid(imuSensors, '📐 9-Axis IMU')}
        </>
      )}

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>ℹ️ Sensor Information</Text>
        <Text style={styles.infoText}>
          • PPG: Photoplethysmography for heart rate{'\n'}
          • EDA: Electrodermal Activity (skin conductance){'\n'}
          • SCR: Skin Conductance Response{'\n'}
          • IMU: 9-axis motion tracking (gyro + accelerometer){'\n'}
          • Sampling Rate: {1000/UPDATE_INTERVAL} Hz{'\n'}
          • Window: {WINDOW_SIZE} samples (~{(WINDOW_SIZE * UPDATE_INTERVAL / 1000).toFixed(1)}s)
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#6366f1',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    color: '#fff',
  },
  controlsCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
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
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  waveformCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 16,
    marginHorizontal: 16,
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
    color: '#1e293b',
  },
  filterBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
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
  waveformStats: {
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
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  filterCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  filterTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  filterButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filterParams: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  paramLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  paramButtons: {
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
  sensorGroup: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  sensorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sensorCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  sensorCardSelected: {
    backgroundColor: '#eef2ff',
    elevation: 3,
  },
  sensorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  sensorLabelSelected: {
    color: '#4f46e5',
  },
  sensorValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  sensorValueSelected: {
    color: '#4f46e5',
  },
  sensorUnit: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  sensorUnitSelected: {
    color: '#6366f1',
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    padding: 16,
    margin: 16,
    marginBottom: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 20,
  },
});
