import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { saveQuestionnaireResult } from '../../firebase/dataLogger';

const BAI_ITEMS = [
  { id: 1, text: 'Numbness or tingling' },
  { id: 2, text: 'Feeling hot' },
  { id: 3, text: 'Wobbliness in legs' },
  { id: 4, text: 'Unable to relax' },
  { id: 5, text: 'Fear of worst happening' },
  { id: 6, text: 'Dizzy or lightheaded' },
  { id: 7, text: 'Heart pounding / racing' },
  { id: 8, text: 'Unsteady' },
  { id: 9, text: 'Terrified or afraid' },
  { id: 10, text: 'Nervous' },
  { id: 11, text: 'Feeling of choking' },
  { id: 12, text: 'Hands trembling' },
  { id: 13, text: 'Shaky / unsteady' },
  { id: 14, text: 'Fear of losing control' },
  { id: 15, text: 'Difficulty in breathing' },
  { id: 16, text: 'Fear of dying' },
  { id: 17, text: 'Scared' },
  { id: 18, text: 'Indigestion' },
  { id: 19, text: 'Faint / lightheaded' },
  { id: 20, text: 'Face flushed' },
  { id: 21, text: 'Hot / cold sweats' },
];

const RESPONSE_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: "Mildly, but it didn't bother me much" },
  { value: 2, label: "Moderately – it wasn't pleasant at times" },
  { value: 3, label: 'Severely – it bothered me a lot' },
];

export default function BAIQuestionnaire({ navigation }: any) {
  const { user } = useAuth();
  const [responses, setResponses] = useState<{ [key: number]: number }>({});

  const handleResponse = (itemId: number, value: number) => {
    setResponses(prev => ({ ...prev, [itemId]: value }));
  };

  const calculateScore = () => Object.values(responses).reduce((sum, value) => sum + value, 0);

  const getScoreInterpretation = (score: number) => {
    if (score <= 21) return { level: 'Low Anxiety', color: '#10b981', description: 'Your anxiety levels are within the normal range.' };
    if (score <= 35) return { level: 'Moderate Anxiety', color: '#f59e0b', description: 'You are experiencing moderate levels of anxiety. Consider stress management techniques.' };
    return { level: 'Potentially Concerning Anxiety', color: '#ef4444', description: 'Your anxiety levels may be concerning. Consider consulting with a healthcare professional.' };
  };

  const isComplete = () => Object.keys(responses).length === BAI_ITEMS.length;

  const handleSubmit = async () => {
    if (!isComplete()) {
      Alert.alert('Incomplete', 'Please answer all questions before submitting.');
      return;
    }
    const score = calculateScore();
    const interpretation = getScoreInterpretation(score);
    if (user) {
      try {
        await saveQuestionnaireResult(user.uid, {
          type: 'BAI',
          score,
          maxScore: 63,
          level: interpretation.level,
          responses,
        });
      } catch (e) {
        console.error('[BAI] Firebase save error:', e);
      }
    }
    Alert.alert(
      'Beck Anxiety Inventory Results',
      `Total Score: ${score}/63\n\n${interpretation.level}\n\n${interpretation.description}`,
      [{ text: 'OK', onPress: () => navigation?.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Beck Anxiety Inventory (BAI)</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About This Assessment</Text>
          <Text style={styles.aboutText}>
            Please carefully read each item and indicate how much you have been bothered by that symptom during the{' '}
            <Text style={styles.boldText}>past month</Text>, including today.
          </Text>
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressText}>Progress: {Object.keys(responses).length} / {BAI_ITEMS.length}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(Object.keys(responses).length / BAI_ITEMS.length) * 100}%` }]} />
          </View>
        </View>

        {BAI_ITEMS.map((item, index) => (
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

        <TouchableOpacity
          style={[styles.submitButton, !isComplete() && styles.submitButtonDisabled]}
          onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>
            {isComplete() ? 'Submit Assessment' : `Complete All Questions (${Object.keys(responses).length}/${BAI_ITEMS.length})`}
          </Text>
        </TouchableOpacity>

        <View style={styles.scoringCard}>
          <Text style={styles.scoringTitle}>Scoring Guide</Text>
          {[
            { color: '#10b981', text: '0-21: Low anxiety' },
            { color: '#f59e0b', text: '22-35: Moderate anxiety' },
            { color: '#ef4444', text: '36+: Potentially concerning levels of anxiety' },
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
  questionText: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 16 },
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
