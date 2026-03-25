import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { saveQuestionnaireResult } from '../../firebase/dataLogger';

const CFQ_ITEMS = [
  { id: 1, text: "Do you read something and find you haven't been thinking about it and must read it again?" },
  { id: 2, text: 'Do you find you forget why you went from one part of the house to the other?' },
  { id: 3, text: 'Do you fail to notice signposts on the road?' },
  { id: 4, text: 'Do you find you confuse right and left when giving directions?' },
  { id: 5, text: 'Do you bump into people?' },
  { id: 6, text: "Do you find you forget whether you've turned off a light or a fire or locked the door?" },
  { id: 7, text: "Do you fail to listen to people's names when you are meeting them?" },
  { id: 8, text: 'Do you say something and realize afterwards that it might be taken as insulting?' },
  { id: 9, text: 'Do you fail to hear people speaking to you when you are doing something else?' },
  { id: 10, text: 'Do you lose your temper and regret it?' },
  { id: 11, text: 'Do you leave important letters unanswered for days?' },
  { id: 12, text: 'Do you find you forget which way to turn on a road you know well but rarely use?' },
  { id: 13, text: "Do you fail to see what you want in a supermarket (although it's there)?" },
  { id: 14, text: "Do you find yourself suddenly wondering whether you've used a word correctly?" },
  { id: 15, text: 'Do you have trouble making up your mind?' },
  { id: 16, text: 'Do you find you forget appointments?' },
  { id: 17, text: 'Do you forget where you put something like a newspaper or a book?' },
  { id: 18, text: 'Do you find you accidentally throw away the thing you want and keep what you meant to throw away?' },
  { id: 19, text: 'Do you daydream when you ought to be listening to something?' },
  { id: 20, text: "Do you find you forget people's names?" },
  { id: 21, text: 'Do you start doing one thing at home and get distracted into doing something else (unintentionally)?' },
  { id: 22, text: "Do you find you can't quite remember something although it's \"on the tip of your tongue\"?" },
  { id: 23, text: 'Do you find you forget what you came to the shops to buy?' },
  { id: 24, text: 'Do you drop things?' },
  { id: 25, text: "Do you find you can't think of anything to say?" },
];

const RESPONSE_OPTIONS = [
  { value: 4, label: 'Very often' },
  { value: 3, label: 'Quite often' },
  { value: 2, label: 'Occasionally' },
  { value: 1, label: 'Very rarely' },
  { value: 0, label: 'Never' },
];

export default function CFQQuestionnaire({ navigation }: any) {
  const { user } = useAuth();
  const [responses, setResponses] = useState<{ [key: number]: number }>({});

  const handleResponse = (itemId: number, value: number) => {
    setResponses(prev => ({ ...prev, [itemId]: value }));
  };

  const calculateScore = () => Object.values(responses).reduce((sum, value) => sum + value, 0);

  const getScoreInterpretation = (score: number) => {
    if (score <= 25) return { level: 'Low Cognitive Failures', color: '#10b981', description: 'You experience relatively few cognitive failures in daily life.' };
    if (score <= 50) return { level: 'Moderate Cognitive Failures', color: '#f59e0b', description: 'You experience a moderate level of cognitive failures. This is common for many people.' };
    if (score <= 75) return { level: 'High Cognitive Failures', color: '#ef4444', description: 'You experience frequent cognitive failures. Consider stress management or organizational strategies.' };
    return { level: 'Very High Cognitive Failures', color: '#dc2626', description: 'You experience very frequent cognitive failures. Consider discussing this with a healthcare professional.' };
  };

  const isComplete = () => Object.keys(responses).length === CFQ_ITEMS.length;

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
          type: 'CFQ',
          score,
          maxScore: 100,
          level: interpretation.level,
          responses,
        });
      } catch (e) {
        console.error('[CFQ] Firebase save error:', e);
      }
    }
    Alert.alert(
      'Cognitive Failures Questionnaire Results',
      `Total Score: ${score}/100\n\n${interpretation.level}\n\n${interpretation.description}`,
      [{ text: 'OK', onPress: () => navigation?.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cognitive Failures Questionnaire</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About This Assessment</Text>
          <Text style={styles.aboutText}>
            Please indicate how often these things have happened to you in the{' '}
            <Text style={styles.boldText}>past 6 months</Text>.
          </Text>
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressText}>Progress: {Object.keys(responses).length} / {CFQ_ITEMS.length}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(Object.keys(responses).length / CFQ_ITEMS.length) * 100}%` }]} />
          </View>
        </View>

        {CFQ_ITEMS.map((item, index) => (
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
            {isComplete() ? 'Submit Assessment' : `Complete All Questions (${Object.keys(responses).length}/${CFQ_ITEMS.length})`}
          </Text>
        </TouchableOpacity>

        <View style={styles.referenceCard}>
          <Text style={styles.referenceText}>
            Reference: Broadbent, D.E., Cooper, P.F., FitzGerald, P., & Parkes, K.R. (1982). The Cognitive Failures Questionnaire (CFQ) and its correlates. British Journal of Clinical Psychology, 21, 1-16.
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
  progressCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  progressText: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#5DADE2', borderRadius: 4 },
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
  referenceCard: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 16 },
  referenceText: { fontSize: 11, color: '#6b7280', lineHeight: 16 },
  bottomPadding: { height: 32 },
});
