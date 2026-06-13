import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useEarbud } from '../hooks/useEarbud';
import { earbudService } from '../functionality/EarbudService';

export const EarbudControlCard: React.FC = () => {
  const { config, liveStatus } = useEarbud();

  const [offset, setOffset] = useState(String(config.offset));
  const [phase1, setPhase1] = useState(String(config.phase1));
  const [phase2, setPhase2] = useState(String(config.phase2));
  const [tonpos, setTonpos] = useState(String(config.tonpos));
  const [toff, setToff] = useState(String(config.toff));
  const [tonneg, setTonneg] = useState(String(config.tonneg));

  useEffect(() => {
    setOffset(String(config.offset));
    setPhase1(String(config.phase1));
    setPhase2(String(config.phase2));
    setTonpos(String(config.tonpos));
    setToff(String(config.toff));
    setTonneg(String(config.tonneg));
  }, [config]);

  const parseNumber = (value: string, field: string): number | null => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      Alert.alert('Invalid Input', `${field} must be a number.`);
      return null;
    }
    return Math.round(parsed);
  };

  const onApply = async () => {
    const parsedOffset = parseNumber(offset, 'OFFSET');
    const parsedPhase1 = parseNumber(phase1, 'PHASE1');
    const parsedPhase2 = parseNumber(phase2, 'PHASE2');
    const parsedTonpos = parseNumber(tonpos, 'TONPOS');
    const parsedToff = parseNumber(toff, 'TOFF');
    const parsedTonneg = parseNumber(tonneg, 'TONNEG');

    if (
      parsedOffset === null ||
      parsedPhase1 === null ||
      parsedPhase2 === null ||
      parsedTonpos === null ||
      parsedToff === null ||
      parsedTonneg === null
    ) {
      return;
    }

    console.log('[EarbudControlCard] Applying parameters via earbudService (NOT bleService)');
    console.log('[EarbudControlCard] Values:', {
      parsedOffset,
      parsedPhase1,
      parsedPhase2,
      parsedTonpos,
      parsedToff,
      parsedTonneg,
    });

    await earbudService.setParameters(
      parsedOffset,
      parsedPhase1,
      parsedPhase2,
      parsedTonpos,
      parsedToff,
      parsedTonneg,
    );

    Alert.alert('Sent', 'Earbud parameters applied.');
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Earbud Control (ESP_SIGNAL_CTRL)</Text>

      <View style={styles.row}>
        <Text style={styles.label}>OFFSET</Text>
        <TextInput value={offset} onChangeText={setOffset} keyboardType="numeric" style={styles.input} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>PHASE1</Text>
        <TextInput value={phase1} onChangeText={setPhase1} keyboardType="numeric" style={styles.input} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>PHASE2</Text>
        <TextInput value={phase2} onChangeText={setPhase2} keyboardType="numeric" style={styles.input} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>TONPOS</Text>
        <TextInput value={tonpos} onChangeText={setTonpos} keyboardType="numeric" style={styles.input} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>TOFF</Text>
        <TextInput value={toff} onChangeText={setToff} keyboardType="numeric" style={styles.input} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>TONNEG</Text>
        <TextInput value={tonneg} onChangeText={setTonneg} keyboardType="numeric" style={styles.input} />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.button, styles.applyButton]} 
          onPress={onApply}
        >
          <Text style={styles.buttonText}>Apply Parameters</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.button, styles.startButton]} 
          onPress={() => {
            console.log('[EarbudControlCard] START button pressed - calling earbudService.start()');
            earbudService.start();
          }}
        >
          <Text style={styles.buttonText}>Start</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.stopButton]} 
          onPress={() => {
            console.log('[EarbudControlCard] STOP button pressed - calling earbudService.stop()');
            earbudService.stop();
          }}
        >
          <Text style={styles.buttonText}>Stop</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Live Status</Text>
        <Text style={styles.statusText}>RUN: {liveStatus.run}</Text>
        <Text style={styles.statusText}>DAC_CMD: {liveStatus.dac_cmd}</Text>
        <Text style={styles.statusText}>CH1: {liveStatus.ch1} mV</Text>
        <Text style={styles.statusText}>CH2: {liveStatus.ch2} mV</Text>
        <Text style={styles.statusText}>CH3: {liveStatus.ch3} mV</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 12,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 12,
  },
  label: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyButton: {
    backgroundColor: '#2563eb',
  },
  startButton: {
    backgroundColor: '#10b981',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  statusCard: {
    marginTop: 14,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  statusText: {
    fontSize: 13,
    color: '#374151',
    marginTop: 2,
  },
});
