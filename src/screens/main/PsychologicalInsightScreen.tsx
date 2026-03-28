import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PsychologicalStackParamList } from '../../navigation/PsychologicalStack';
import { useAuth } from '../../auth/AuthContext';
import { getQuestionnaireStatuses, QuestionnaireStatusSummary } from '../../firebase/dataLogger';

type NavigationProp = NativeStackNavigationProp<PsychologicalStackParamList>;

type QuestionnaireStatus = 'not-started' | 'completed';

interface Questionnaire {
  id: string;
  name: string;
  fullName: string;
  status: QuestionnaireStatus;
  lastScore?: number;
  lastLevel?: string;
  lastCompletedAt?: Date;
  nextDueAt?: Date;
  dueForFollowUp?: boolean;
  submissionsCount?: number;
  screen?: keyof PsychologicalStackParamList;
}

// Map local questionnaire ids to Firebase type keys
const FIREBASE_KEY: Record<string, string> = {
  gad7: 'GAD7',
  pss10: 'PSS10',
  phq9: 'PHQ9',
  bai: 'BAI',
  pcl5: 'PCL5',
  psqi: 'PSQI',
  bdi2: 'BDI',
  cfq: 'CFQ',
};

export default function PsychologicalInsightScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const buildCompletionCaption = (q: Questionnaire): string | undefined => {
    if (!q.lastCompletedAt) {
      return undefined;
    }

    const completedOn = q.lastCompletedAt.toLocaleDateString();
    if (q.dueForFollowUp) {
      return `Follow-up due now • Last: ${completedOn}`;
    }
    if (q.nextDueAt) {
      return `Last: ${completedOn} • Next: ${q.nextDueAt.toLocaleDateString()}`;
    }
    return `Last: ${completedOn}`;
  };

  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([
    { id: 'gad7', name: 'GAD-7', fullName: 'Generalized anxiety', status: 'not-started', screen: 'GAD7Questionnaire' },
    { id: 'pss10', name: 'PSS-10', fullName: 'Subjective stress', status: 'not-started', screen: 'PSS10Questionnaire' },
    { id: 'phq9', name: 'PHQ-9', fullName: 'Depressive symptoms', status: 'not-started', screen: 'PHQ9Questionnaire' },
    { id: 'bai', name: 'BAI', fullName: 'Somatic & cognitive Anxiety', status: 'not-started', screen: 'BAIQuestionnaire' },
    { id: 'pcl5', name: 'PCL-5', fullName: 'PTSD', status: 'not-started', screen: 'PCL5Questionnaire' },
    { id: 'psqi', name: 'PSQI', fullName: 'Sleep quality', status: 'not-started', screen: 'PSQIQuestionnaire' },
    { id: 'bdi2', name: 'BDI-II', fullName: 'Depressive Severity', status: 'not-started', screen: 'BDIQuestionnaire' },
    { id: 'cfq', name: 'CFQ', fullName: 'Cognitive Failures', status: 'not-started', screen: 'CFQQuestionnaire' },
  ]);

  // Refresh questionnaire completion statuses every time this screen is focused
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getQuestionnaireStatuses(user.uid).then((statuses) => {
        const now = new Date();
        setQuestionnaires((prev) =>
          prev.map((q) => {
            const fbKey = FIREBASE_KEY[q.id];
            const fbStatus: QuestionnaireStatusSummary | undefined = fbKey ? statuses[fbKey] : undefined;
            const dueForFollowUp =
              fbStatus?.nextDueAt instanceof Date ? fbStatus.nextDueAt.getTime() <= now.getTime() : false;

            return {
              ...q,
              status: fbStatus ? 'completed' : q.status,
              lastScore: fbStatus?.score,
              lastLevel: fbStatus?.level,
              lastCompletedAt: fbStatus?.lastCompletedAt,
              nextDueAt: fbStatus?.nextDueAt,
              dueForFollowUp,
              submissionsCount: fbStatus?.submissionsCount,
            };
          })
        );
      });
    }, [user])
  );

  const completedCount = questionnaires.filter((q) => q.status === 'completed').length;
  const dueNowCount = questionnaires.filter((q) => q.dueForFollowUp).length;

  const handleQuestionnairePress = (id: string) => {
    const questionnaire = questionnaires.find((q) => q.id === id);
    if (questionnaire?.screen) {
      navigation.navigate(questionnaire.screen as any);
    } else {
      setQuestionnaires((prev) =>
        prev.map((q) =>
          q.id === id ? { ...q, status: q.status === 'completed' ? 'not-started' : 'completed' } : q
        )
      );
    }
  };

  const handleHistoryPress = (q: Questionnaire) => {
    const questionnaireType = FIREBASE_KEY[q.id];
    if (!questionnaireType) {
      return;
    }
    navigation.navigate('QuestionnaireHistory', {
      questionnaireType,
      questionnaireName: q.name,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="happy" size={24} color="#5DADE2" />
        </View>
        <Text style={styles.headerTitle}>Main Menu - Psychology</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Note 1 */}
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>1. User needs to fill sets of Psychological Questionnaires.</Text>
          <Text style={styles.noteText}>Tap each button to begin a questionnaire</Text>
        </View>

        {/* Questionnaire Form Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Questionnaire Forms</Text>
          <View style={styles.questionnaireGrid}>
            {questionnaires.map((questionnaire) => (
              <TouchableOpacity
                key={questionnaire.id}
                style={[
                  styles.questionnaireButton,
                  questionnaire.status === 'completed' && styles.questionnaireButtonCompleted,
                ]}
                onPress={() => handleQuestionnairePress(questionnaire.id)}>
                <Text
                  style={[
                    styles.questionnaireName,
                    questionnaire.status === 'completed' && styles.questionnaireNameCompleted,
                  ]}>
                  {questionnaire.name}
                </Text>
                <Text
                  style={[
                    styles.questionnaireFullName,
                    questionnaire.status === 'completed' && styles.questionnaireFullNameCompleted,
                  ]}>
                  {questionnaire.fullName}
                </Text>
                {questionnaire.status === 'completed' && (
                  <View style={styles.checkmarkBadge}>
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                  </View>
                )}
                {questionnaire.status === 'completed' && questionnaire.lastLevel && (
                  <Text style={styles.lastLevelText} numberOfLines={1}>
                    {questionnaire.lastLevel}
                  </Text>
                )}
                {questionnaire.status === 'completed' && (
                  <Text
                    style={[
                      styles.lastCompletedText,
                      questionnaire.dueForFollowUp && styles.followUpDueText,
                    ]}
                    numberOfLines={1}
                  >
                    {buildCompletionCaption(questionnaire)}
                  </Text>
                )}
                {questionnaire.status === 'completed' && typeof questionnaire.submissionsCount === 'number' && (
                  <Text style={styles.submissionCountText} numberOfLines={1}>
                    Entries: {questionnaire.submissionsCount}
                  </Text>
                )}
                {questionnaire.status === 'completed' && questionnaire.submissionsCount && questionnaire.submissionsCount > 0 && FIREBASE_KEY[questionnaire.id] && (
                  <TouchableOpacity
                    style={styles.historyButton}
                    onPress={() => handleHistoryPress(questionnaire)}
                  >
                    <Ionicons name="time-outline" size={12} color="#ffffff" />
                    <Text style={styles.historyButtonText}>View timeline</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completion Summary</Text>
          <View style={styles.statusSummaryCard}>
            <View style={styles.statusSummaryRow}>
              <Text style={styles.statusSummaryLabel}>Completed</Text>
              <Text style={styles.statusSummaryValue}>{completedCount}/{questionnaires.length}</Text>
            </View>
            <View style={styles.statusSummaryRow}>
              <Text style={styles.statusSummaryLabel}>Follow-up Due</Text>
              <Text style={styles.statusSummaryValue}>{dueNowCount}</Text>
            </View>
          </View>
          <Text style={styles.noteText}>
            Only functional features are shown here right now: questionnaire entry, completion tracking, and history timeline.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#A3D9F0',
    padding: 16,
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  container: { flex: 1, backgroundColor: '#ffffff' },
  noteCard: { backgroundColor: '#A3D9F0', padding: 16, marginVertical: 8 },
  noteTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  noteText: { fontSize: 13, color: '#1e293b' },
  section: { padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#5DADE2', marginBottom: 16 },
  questionnaireGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  questionnaireButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff9c4',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffd700',
    position: 'relative',
  },
  questionnaireButtonCompleted: { backgroundColor: '#d1fae5', borderColor: '#10b981' },
  questionnaireName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  questionnaireNameCompleted: { color: '#065f46' },
  questionnaireFullName: { fontSize: 12, color: '#64748b' },
  questionnaireFullNameCompleted: { color: '#047857' },
  checkmarkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusSummaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginBottom: 10,
  },
  statusSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statusSummaryLabel: { fontSize: 14, color: '#334155', fontWeight: '600' },
  statusSummaryValue: { fontSize: 15, color: '#0f172a', fontWeight: '700' },
  lastLevelText: { fontSize: 10, color: '#047857', marginTop: 2, textAlign: 'center', fontStyle: 'italic' },
  lastCompletedText: { fontSize: 10, color: '#065f46', marginTop: 2, textAlign: 'center' },
  followUpDueText: { color: '#b45309', fontWeight: '700' },
  submissionCountText: { fontSize: 10, color: '#065f46', marginTop: 2, textAlign: 'center' },
  historyButton: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  historyButtonText: { fontSize: 11, color: '#ffffff', fontWeight: '600' },
});
