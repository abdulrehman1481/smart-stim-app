import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { saveUserProfile } from '../../firebase/dataLogger';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Questionnaire'>;

interface Question {
  id: number;
  question: string;
  options: string[];
}

const questions: Question[] = [
  {
    id: 1,
    question: 'How would you rate your overall mood today?',
    options: ['Very Poor', 'Poor', 'Fair', 'Good', 'Excellent'],
  },
  {
    id: 2,
    question: 'How stressed do you feel currently?',
    options: ['Not at all', 'Slightly', 'Moderately', 'Very', 'Extremely'],
  },
  {
    id: 3,
    question: 'How would you rate your sleep quality last night?',
    options: ['Very Poor', 'Poor', 'Fair', 'Good', 'Excellent'],
  },
  {
    id: 4,
    question: 'How often do you experience anxiety?',
    options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'],
  },
  {
    id: 5,
    question: 'How would you describe your energy level?',
    options: ['Very Low', 'Low', 'Moderate', 'High', 'Very High'],
  },
  {
    id: 6,
    question: 'How well can you focus and concentrate?',
    options: ['Very Poorly', 'Poorly', 'Fair', 'Well', 'Very Well'],
  },
];

export default function QuestionnaireScreen({ navigation }: Props) {
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [saving, setSaving] = useState(false);
  const { user, refreshProfile } = useAuth();

  const handleSelectAnswer = (questionId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Persist onboarding completion and questionnaire answers to Firebase
      await saveUserProfile(user.uid, {
        onboardingComplete: true,
        baselineAnswers: answers,
      });
      // Refresh profile in AuthContext so AppContent can react
      await refreshProfile();
      // Navigate to main app
      navigation.navigate('MainTabs');
    } catch (err: any) {
      Alert.alert('Error', 'Could not save your answers. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isComplete = Object.keys(answers).length === questions.length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="clipboard" size={28} color="#5DADE2" />
            </View>
            <Text style={styles.title}>Baseline Psychological Assessment</Text>
            <Text style={styles.subtitle}>
              Please answer the following questions honestly. This helps us understand your baseline
              psychological state.
            </Text>
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(Object.keys(answers).length / questions.length) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {Object.keys(answers).length} of {questions.length} completed
            </Text>
          </View>

          {/* Questions */}
          {questions.map((question, index) => (
            <View key={question.id} style={styles.questionCard}>
              <Text style={styles.questionNumber}>Question {index + 1}</Text>
              <Text style={styles.questionText}>{question.question}</Text>

              <View style={styles.optionsContainer}>
                {question.options.map((option) => {
                  const isSelected = answers[question.id] === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                      onPress={() => handleSelectAnswer(question.id, option)}>
                      <View style={styles.radioOuter}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Complete Button */}
          <TouchableOpacity
            style={[styles.completeButton, (!isComplete || saving) && styles.completeButtonDisabled]}
            onPress={handleComplete}
            disabled={!isComplete || saving}>
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={styles.completeButtonText}>
                  {isComplete ? 'Complete Assessment' : 'Answer all questions to continue'}
                </Text>
                {isComplete && <Ionicons name="checkmark-circle" size={24} color="white" />}
              </>
            )}
          </TouchableOpacity>

          {/* Privacy Note */}
          <View style={styles.privacyNote}>
            <Ionicons name="lock-closed" size={16} color="#64748b" />
            <Text style={styles.privacyText}>
              Your responses are confidential and used only for personalized recommendations.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  progressContainer: {
    padding: 20,
    paddingBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5DADE2',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '600',
  },
  questionCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5DADE2',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    lineHeight: 26,
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  optionButtonSelected: {
    backgroundColor: '#e0f2fe',
    borderColor: '#5DADE2',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5DADE2',
  },
  optionText: {
    fontSize: 16,
    color: '#475569',
    flex: 1,
  },
  optionTextSelected: {
    color: '#1e293b',
    fontWeight: '600',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5DADE2',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  completeButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
});
