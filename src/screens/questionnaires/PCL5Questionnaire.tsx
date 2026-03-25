import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { saveQuestionnaireResult } from '../../firebase/dataLogger';

const PCL5_ITEMS = [
  { id: 1, text: 'Repeated, disturbing, and unwanted memories of the stressful experience?' },
  { id: 2, text: 'Repeated, disturbing dreams of the stressful experience?' },
  { id: 3, text: 'Suddenly feeling or acting as if the stressful experience were actually happening again (as if you were actually back there reliving it)?' },
  { id: 4, text: 'Feeling very upset when something reminded you of the stressful experience?' },
  { id: 5, text: 'Having strong physical reactions when something reminded you of the stressful experience (for example, heart pounding, trouble breathing, sweating)?' },
  { id: 6, text: 'Avoiding memories, thoughts, or feelings related to the stressful experience?' },
  { id: 7, text: 'Avoiding external reminders of the stressful experience (for example, people, places, conversations, activities, objects, or situations)?' },
  { id: 8, text: 'Trouble remembering important parts of the stressful experience?' },
  { id: 9, text: 'Having strong negative beliefs about yourself, other people, or the world?' },
  { id: 10, text: 'Blaming yourself or someone else for the stressful experience or what happened after it?' },
  { id: 11, text: 'Having strong negative feelings such as fear, horror, anger, guilt, or shame?' },
  { id: 12, text: 'Loss of interest in activities that you used to enjoy?' },
  { id: 13, text: 'Feeling distant or cut off from other people?' },
  { id: 14, text: 'Trouble experiencing positive feelings (for example, being unable to feel happiness or have loving feelings for people close to you)?' },
  { id: 15, text: 'Irritable behavior, angry outbursts, or acting aggressively?' },
  { id: 16, text: 'Taking too many risks or doing things that could cause you harm?' },
  { id: 17, text: 'Being "superalert" or watchful or on guard?' },
  { id: 18, text: 'Feeling jumpy or easily startled?' },
  { id: 19, text: 'Having difficulty concentrating?' },
  { id: 20, text: 'Trouble falling or staying asleep?' },
];

const RESPONSE_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'A little bit' },
  { value: 2, label: 'Moderately' },
  { value: 3, label: 'Quite a bit' },
  { value: 4, label: 'Extremely' },
];

export default function PCL5Questionnaire({ navigation }: any) {
  const { user } = useAuth();
  const [responses, setResponses] = useState<{ [key: number]: number }>({});
  const [worstEvent, setWorstEvent] = useState('');

  const handleResponse = (itemId: number, value: number) => {
    setResponses(prev => ({ ...prev, [itemId]: value }));
  };

  const calculateScore = () => Object.values(responses).reduce((sum, value) => sum + value, 0);

  const getScoreInterpretation = (score: number) => {
    if (score < 31) return { level: 'Low PTSD Symptoms', color: '#10b981', description: 'Your symptoms suggest minimal PTSD symptoms.' };
    if (score < 33) return { level: 'Moderate PTSD Symptoms', color: '#f59e0b', description: 'You are experiencing some PTSD symptoms. Consider monitoring your symptoms.' };
    return { level: 'Probable PTSD', color: '#ef4444', description: 'Your score suggests probable PTSD. It is strongly recommended to consult with a mental health professional for a comprehensive evaluation.' };
  };

  const isComplete = () => Object.keys(responses).length === PCL5_ITEMS.length;

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
          type: 'PCL5',
          score,
          maxScore: 80,
          level: interpretation.level,
          responses,
          notes: worstEvent || undefined,
        });
      } catch (e) {
        console.error('[PCL5] Firebase save error:', e);
      }
    }
    Alert.alert(
      'PCL-5 PTSD Checklist Results',
      `Total Score: ${score}/80\n\n${interpretation.level}\n\n${interpretation.description}`,
      [{ text: 'OK', onPress: () => navigation?.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PCL-5 PTSD Checklist</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About This Assessment</Text>
          <Text style={styles.aboutText}>
            Keeping your worst event in mind, please read each problem carefully and indicate how much you have been bothered by that problem in the{' '}
            <Text style={styles.boldText}>past month</Text>.
          </Text>
        </View>

        <View style={styles.eventCard}>
          <Text style={styles.eventLabel}>Your worst event (optional):</Text>
          <TextInput
            style={styles.eventInput}
            value={worstEvent}
            onChangeText={setWorstEvent}
            placeholder="Briefly describe the event..."
            multiline
            numberOfLines={3}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressText}>Progress: {Object.keys(responses).length} / {PCL5_ITEMS.length}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(Object.keys(responses).length / PCL5_ITEMS.length) * 100}%` }]} />
          </View>
        </View>

        <View style={styles.instructionCard}>
          <Text style={styles.instructionText}>In the past month, how much were you bothered by:</Text>
        </View>

        {PCL5_ITEMS.map((item, index) => (
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
            {isComplete() ? 'Submit Assessment' : `Complete All Questions (${Object.keys(responses).length}/${PCL5_ITEMS.length})`}
          </Text>
        </TouchableOpacity>

        <View style={styles.scoringCard}>
          <Text style={styles.scoringTitle}>Understanding Your Score</Text>
          {[
            { color: '#10b981', text: '0-30: Minimal symptoms' },
            { color: '#f59e0b', text: '31-32: Moderate symptoms' },
            { color: '#ef4444', text: '33+: Probable PTSD (cutoff score)' },
          ].map((item, i) => (
            <View key={i} style={styles.scoringItem}>
              <View style={[styles.scoringDot, { backgroundColor: item.color }]} />
              <Text style={styles.scoringText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.referenceCard}>
          <Text style={styles.referenceText}>
            Reference: Weathers, F. W., Litz, B. T., Keane, T. M., Palmieri, P. A., Marx, B. P., & Schnurr, P. P. (2013). The PTSD Checklist for DSM-5 (PCL-5).
          </Text>
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
  eventCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  eventLabel: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  eventInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 14, color: '#1f2937', minHeight: 80, textAlignVertical: 'top' },
  progressCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  progressText: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#5DADE2', borderRadius: 4 },
  instructionCard: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 8, marginBottom: 16 },
  instructionText: { fontSize: 14, fontWeight: '600', color: '#92400e' },
  questionCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  questionNumber: { fontSize: 16, fontWeight: '700', color: '#5DADE2', marginBottom: 4 },
  questionText: { fontSize: 15, fontWeight: '500', color: '#1f2937', marginBottom: 16, lineHeight: 22 },
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
  referenceCard: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 16 },
  referenceText: { fontSize: 11, color: '#6b7280', lineHeight: 16 },
  bottomPadding: { height: 32 },
});
