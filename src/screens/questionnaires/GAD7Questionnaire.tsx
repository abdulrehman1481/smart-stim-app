import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { saveQuestionnaireResult } from '../../firebase/dataLogger';

interface GAD7Item {
  id: number;
  text: string;
}

const GAD7_ITEMS: GAD7Item[] = [
  { id: 1, text: 'Feeling nervous, anxious, or on edge' },
  { id: 2, text: 'Not being able to stop or control worrying' },
  { id: 3, text: 'Worrying too much about different things' },
  { id: 4, text: 'Trouble relaxing' },
  { id: 5, text: 'Being so restless that it is hard to sit still' },
  { id: 6, text: 'Becoming easily annoyed or irritable' },
  { id: 7, text: 'Feeling afraid, as if something awful might happen' },
];

const RESPONSE_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];

const DIFFICULTY_OPTIONS = [
  'Not difficult at all',
  'Somewhat difficult',
  'Very difficult',
  'Extremely difficult',
];

export default function GAD7Questionnaire({ navigation }: any) {
  const { user } = useAuth();
  const [responses, setResponses] = useState<{ [key: number]: number }>({});
  const [difficulty, setDifficulty] = useState<number | null>(null);

  const handleResponse = (itemId: number, value: number) => {
    setResponses(prev => ({ ...prev, [itemId]: value }));
  };

  const calculateScore = () => {
    return Object.values(responses).reduce((sum, value) => sum + value, 0);
  };

  const getScoreInterpretation = (score: number) => {
    if (score <= 4) {
      return { level: 'Minimal Anxiety', color: '#10b981', description: 'You are experiencing minimal anxiety symptoms.' };
    } else if (score <= 9) {
      return { level: 'Mild Anxiety', color: '#22c55e', description: 'You are experiencing mild anxiety symptoms. Consider monitoring your symptoms.' };
    } else if (score <= 14) {
      return { level: 'Moderate Anxiety', color: '#f59e0b', description: 'You are experiencing moderate anxiety. Consider speaking with a healthcare professional.' };
    } else {
      return { level: 'Severe Anxiety', color: '#ef4444', description: 'You are experiencing severe anxiety. It is recommended to seek professional help.' };
    }
  };

  const isComplete = () => Object.keys(responses).length === GAD7_ITEMS.length;

  const handleSubmit = async () => {
    if (!isComplete()) {
      Alert.alert('Incomplete', 'Please answer all questions before submitting.');
      return;
    }
    const score = calculateScore();
    const interpretation = getScoreInterpretation(score);
    // Save to Firebase
    if (user) {
      try {
        await saveQuestionnaireResult(user.uid, {
          type: 'GAD7',
          score,
          maxScore: 21,
          level: interpretation.level,
          responses,
          difficulty,
        });
      } catch (e) {
        console.error('[GAD7] Firebase save error:', e);
      }
    }
    let difficultyText = '';
    if (difficulty !== null) {
      difficultyText = `\n\nFunctional Impact: ${DIFFICULTY_OPTIONS[difficulty]}`;
    }
    Alert.alert(
      'GAD-7 Anxiety Results',
      `Total Score: ${score}/21\n\n${interpretation.level}\n\n${interpretation.description}${difficultyText}`,
      [{ text: 'OK', onPress: () => navigation?.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GAD-7 Anxiety</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About This Assessment</Text>
          <Text style={styles.aboutText}>
            Over the <Text style={styles.boldText}>last two weeks</Text>, how often have you been bothered by the following problems?
          </Text>
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressText}>
            Progress: {Object.keys(responses).length} / {GAD7_ITEMS.length}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(Object.keys(responses).length / GAD7_ITEMS.length) * 100}%` }]} />
          </View>
        </View>

        {GAD7_ITEMS.map((item, index) => (
          <View key={item.id} style={styles.questionCard}>
            <Text style={styles.questionNumber}>{index + 1}.</Text>
            <Text style={styles.questionText}>{item.text}</Text>
            <View style={styles.optionsContainer}>
              {RESPONSE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionButton, responses[item.id] === option.value && styles.optionButtonSelected]}
                  onPress={() => handleResponse(item.id, option.value)}>
                  <View style={styles.optionContent}>
                    <View style={[styles.radio, responses[item.id] === option.value && styles.radioSelected]}>
                      {responses[item.id] === option.value && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text style={[styles.optionLabel, responses[item.id] === option.value && styles.optionLabelSelected]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionValue}>Score: {option.value}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {isComplete() && (
          <View style={styles.difficultyCard}>
            <Text style={styles.difficultyTitle}>
              If you checked any problems, how difficult have they made it for you to do your work, take care of things at home, or get along with other people?
            </Text>
            <View style={styles.difficultyOptions}>
              {DIFFICULTY_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.difficultyButton, difficulty === index && styles.difficultyButtonSelected]}
                  onPress={() => setDifficulty(index)}>
                  <View style={[styles.checkbox, difficulty === index && styles.checkboxSelected]}>
                    {difficulty === index && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                  </View>
                  <Text style={[styles.difficultyLabel, difficulty === index && styles.difficultyLabelSelected]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, !isComplete() && styles.submitButtonDisabled]}
          onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>
            {isComplete() ? 'Submit Assessment' : `Complete All Questions (${Object.keys(responses).length}/${GAD7_ITEMS.length})`}
          </Text>
        </TouchableOpacity>

        <View style={styles.scoringCard}>
          <Text style={styles.scoringTitle}>GAD-7 Anxiety Severity</Text>
          {[
            { color: '#10b981', text: '0–4: Minimal anxiety' },
            { color: '#22c55e', text: '5–9: Mild anxiety' },
            { color: '#f59e0b', text: '10–14: Moderate anxiety' },
            { color: '#ef4444', text: '15–21: Severe anxiety' },
          ].map((item, i) => (
            <View key={i} style={styles.scoringItem}>
              <View style={[styles.scoringDot, { backgroundColor: item.color }]} />
              <Text style={styles.scoringText}>{item.text}</Text>
            </View>
          ))}
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
  questionText: { fontSize: 15, fontWeight: '500', color: '#1f2937', marginBottom: 16 },
  optionsContainer: { gap: 8 },
  optionButton: { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, backgroundColor: '#ffffff' },
  optionButtonSelected: { borderColor: '#5DADE2', backgroundColor: '#eff6ff' },
  optionContent: { flexDirection: 'row', alignItems: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#d1d5db', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#5DADE2' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#5DADE2' },
  optionTextContainer: { flex: 1 },
  optionLabel: { fontSize: 14, color: '#374151', marginBottom: 2 },
  optionLabelSelected: { color: '#1e40af', fontWeight: '600' },
  optionValue: { fontSize: 12, color: '#6b7280' },
  difficultyCard: { backgroundColor: '#fef3c7', padding: 16, borderRadius: 12, marginBottom: 16 },
  difficultyTitle: { fontSize: 14, fontWeight: '600', color: '#92400e', marginBottom: 12, lineHeight: 20 },
  difficultyOptions: { gap: 8 },
  difficultyButton: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 2, borderColor: '#fde68a' },
  difficultyButtonSelected: { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#d1d5db', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  difficultyLabel: { fontSize: 14, color: '#78350f' },
  difficultyLabelSelected: { fontWeight: '600', color: '#92400e' },
  submitButton: { backgroundColor: '#5DADE2', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  submitButtonDisabled: { backgroundColor: '#d1d5db' },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  scoringCard: { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 12, marginBottom: 16 },
  scoringTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 12 },
  scoringItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  scoringDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  scoringText: { fontSize: 13, color: '#4b5563' },
  bottomPadding: { height: 32 },
});
