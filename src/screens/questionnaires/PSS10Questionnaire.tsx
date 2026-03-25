import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { saveQuestionnaireResult } from '../../firebase/dataLogger';

interface PSS10Item {
  id: number;
  text: string;
  reverseScored?: boolean;
}

const PSS10_ITEMS: PSS10Item[] = [
  { id: 1, text: 'In the last month, how often have you been upset because of something that happened unexpectedly?' },
  { id: 2, text: 'In the last month, how often have you felt that you were unable to control the important things in your life?' },
  { id: 3, text: 'In the last month, how often have you felt nervous and stressed?' },
  { id: 4, text: 'In the last month, how often have you felt confident about your ability to handle your personal problems?', reverseScored: true },
  { id: 5, text: 'In the last month, how often have you felt that things were going your way?', reverseScored: true },
  { id: 6, text: 'In the last month, how often have you found that you could not cope with all the things that you had to do?' },
  { id: 7, text: 'In the last month, how often have you been able to control irritations in your life?', reverseScored: true },
  { id: 8, text: 'In the last month, how often have you felt that you were on top of things?', reverseScored: true },
  { id: 9, text: 'In the last month, how often have you been angered because of things that were outside of your control?' },
  { id: 10, text: 'In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?' },
];

const RESPONSE_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'Almost never' },
  { value: 2, label: 'Sometimes' },
  { value: 3, label: 'Fairly often' },
  { value: 4, label: 'Very often' },
];

const REVERSE_IDS = new Set([4, 5, 7, 8]);

const computePSS10Score = (responses: Record<number, number>): number => {
  return PSS10_ITEMS.reduce((sum, item) => {
    const raw = responses[item.id] ?? 0;
    const scored = REVERSE_IDS.has(item.id) ? 4 - raw : raw;
    return sum + scored;
  }, 0);
};

const interpretScore = (score: number): { level: string; description: string } => {
  if (score <= 13) {
    return {
      level: 'Low Perceived Stress',
      description: 'Your score suggests relatively low perceived stress over the past month.',
    };
  }
  if (score <= 26) {
    return {
      level: 'Moderate Perceived Stress',
      description: 'Your score suggests a moderate level of perceived stress. Monitor changes over time.',
    };
  }
  return {
    level: 'High Perceived Stress',
    description: 'Your score suggests high perceived stress. Consider discussing stress management with a clinician.',
  };
};

export default function PSS10Questionnaire({ navigation }: any) {
  const { user } = useAuth();
  const [responses, setResponses] = useState<Record<number, number>>({});

  const isComplete = Object.keys(responses).length === PSS10_ITEMS.length;

  const handleResponse = (itemId: number, value: number) => {
    setResponses((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleSubmit = async () => {
    if (!isComplete) {
      Alert.alert('Incomplete', 'Please answer all 10 questions before submitting.');
      return;
    }

    const score = computePSS10Score(responses);
    const interpretation = interpretScore(score);

    if (user) {
      try {
        await saveQuestionnaireResult(user.uid, {
          type: 'PSS10',
          score,
          maxScore: 40,
          level: interpretation.level,
          responses,
          metadata: {
            reverseScoredItems: [4, 5, 7, 8],
            scale: RESPONSE_OPTIONS,
          },
        });
      } catch (e) {
        console.error('[PSS10] Firebase save error:', e);
      }
    }

    Alert.alert(
      'PSS-10 Results',
      `Total Score: ${score}/40\n\n${interpretation.level}\n\n${interpretation.description}`,
      [{ text: 'OK', onPress: () => navigation?.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PSS-10 Stress</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>Perceived Stress Scale (PSS-10)</Text>
          <Text style={styles.aboutText}>
            Think about your feelings and thoughts during the <Text style={styles.boldText}>last month</Text>. Select the option that best describes how often you felt this way.
          </Text>
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressText}>Progress: {Object.keys(responses).length} / {PSS10_ITEMS.length}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(Object.keys(responses).length / PSS10_ITEMS.length) * 100}%` }]} />
          </View>
        </View>

        {PSS10_ITEMS.map((item, index) => (
          <View key={item.id} style={styles.questionCard}>
            <Text style={styles.questionNumber}>{index + 1}.</Text>
            <Text style={styles.questionText}>{item.text}</Text>
            <View style={styles.optionsContainer}>
              {RESPONSE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionButton, responses[item.id] === option.value && styles.optionButtonSelected]}
                  onPress={() => handleResponse(item.id, option.value)}
                >
                  <View style={styles.optionContent}>
                    <View style={[styles.radio, responses[item.id] === option.value && styles.radioSelected]}>
                      {responses[item.id] === option.value && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.optionLabel, responses[item.id] === option.value && styles.optionLabelSelected]}>
                      {option.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.submitButton, !isComplete && styles.submitButtonDisabled]}
          onPress={handleSubmit}
        >
          <Text style={styles.submitButtonText}>
            {isComplete ? 'Submit Assessment' : `Complete All Questions (${Object.keys(responses).length}/${PSS10_ITEMS.length})`}
          </Text>
        </TouchableOpacity>

        <View style={styles.scoreGuideCard}>
          <Text style={styles.scoreGuideTitle}>PSS-10 Guide</Text>
          <Text style={styles.scoreGuideText}>0-13: Low stress</Text>
          <Text style={styles.scoreGuideText}>14-26: Moderate stress</Text>
          <Text style={styles.scoreGuideText}>27-40: High stress</Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937', flex: 1 },
  container: { flex: 1, padding: 16 },
  aboutCard: { backgroundColor: '#dbeafe', padding: 16, borderRadius: 12, marginBottom: 16 },
  aboutTitle: { fontSize: 16, fontWeight: '600', color: '#1e40af', marginBottom: 8 },
  aboutText: { fontSize: 14, color: '#1e3a8a', lineHeight: 20 },
  boldText: { fontWeight: '700' },
  progressCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  progressText: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#5DADE2', borderRadius: 4 },
  questionCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  questionNumber: { fontSize: 16, fontWeight: '700', color: '#5DADE2', marginBottom: 4 },
  questionText: { fontSize: 15, fontWeight: '500', color: '#1f2937', marginBottom: 12 },
  optionsContainer: { gap: 8 },
  optionButton: { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, backgroundColor: '#ffffff' },
  optionButtonSelected: { borderColor: '#5DADE2', backgroundColor: '#eff6ff' },
  optionContent: { flexDirection: 'row', alignItems: 'center' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#d1d5db', marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#5DADE2' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5DADE2' },
  optionLabel: { fontSize: 14, color: '#374151', flex: 1 },
  optionLabelSelected: { color: '#1e40af', fontWeight: '600' },
  submitButton: { backgroundColor: '#5DADE2', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  submitButtonDisabled: { backgroundColor: '#d1d5db' },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  scoreGuideCard: { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 12, marginBottom: 16 },
  scoreGuideTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  scoreGuideText: { fontSize: 13, color: '#4b5563', marginBottom: 4 },
  bottomPadding: { height: 32 },
});
