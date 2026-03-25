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

  const allCompleted = questionnaires.every((q) => q.status === 'completed');

  const psychologicalStatusData = [
    { label: 'Anxiety', value: 450, color: '#3b82f6' },
    { label: 'Stress', value: 400, color: '#ec4899' },
    { label: 'Depression', value: 580, color: '#3b82f6' },
    { label: 'Sleep', value: 500, color: '#ec4899' },
  ];

  const stressInsightData = [
    { hour: 0, value: 30 },
    { hour: 4, value: 20 },
    { hour: 8, value: 60 },
    { hour: 12, value: 80 },
    { hour: 16, value: 90 },
    { hour: 20, value: 70 },
  ];

  const stressMetrics = [
    { label: 'Responsiveness', value: 24, max: 30, color: '#ec4899' },
    { label: 'Exertion balance', value: 32, max: 40, color: '#f59e0b' },
    { label: 'Sleep patterns', value: 21, max: 30, color: '#3b82f6' },
  ];

  const insights = [
    {
      id: 1,
      title: 'Stress Level',
      value: 'Low',
      icon: 'fitness',
      color: '#10b981',
      description: 'Your stress levels have decreased by 15% this week.',
    },
    {
      id: 2,
      title: 'Sleep Quality',
      value: 'Good',
      icon: 'moon',
      color: '#5DADE2',
      description: 'Average sleep duration: 7.5 hours.',
    },
    {
      id: 3,
      title: 'Mood Stability',
      value: 'Stable',
      icon: 'happy',
      color: '#f59e0b',
      description: 'Mood has been consistent throughout the week.',
    },
  ];

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

        {/* Note 2 */}
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>
            2. Psychological Status will be prepared once the above questionnaires are answered.
          </Text>
        </View>

        {/* Psychological Status Section */}
        {allCompleted ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Psychological Status</Text>
            <View style={styles.statusCard}>
              <View style={styles.barChart}>
                {psychologicalStatusData.map((item, index) => (
                  <View key={index} style={styles.barGroup}>
                    <View style={styles.barPair}>
                      <View
                        style={[
                          styles.chartBar,
                          { height: (item.value / 600) * 150, backgroundColor: item.color },
                        ]}
                      />
                      <View style={styles.barValueLabel}>
                        <Text style={styles.barValue}>{item.value}</Text>
                      </View>
                    </View>
                    <Text style={styles.barLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.lockedSection}>
            <Ionicons name="lock-closed" size={32} color="#cbd5e1" />
            <Text style={styles.lockedText}>
              Complete all questionnaires to view Psychological Status
            </Text>
          </View>
        )}

        {/* Note 3 */}
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>
            3. The Stress Daily Insight is Calculated based on the Physiological and Psychological Measures
          </Text>
        </View>

        {/* Stress Daily Insight Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stress Daily Insight</Text>

          {/* Daily Timeline */}
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>Daily Timeline</Text>
            <View style={styles.timelineChart}>
              {stressInsightData.map((point, index) => (
                <View key={index} style={styles.timelineBarContainer}>
                  <View
                    style={[
                      styles.timelineBar,
                      {
                        height: `${point.value}%`,
                        backgroundColor: point.value > 70 ? '#f59e0b' : '#3b82f6',
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.timelineLabels}>
              {['00', '06', '12', '18', '24'].map((label) => (
                <Text key={label} style={styles.timelineLabel}>{label}</Text>
              ))}
            </View>
            <View style={styles.timelineLegend}>
              {[
                { color: '#3b82f6', label: 'Stress' },
                { color: '#f59e0b', label: 'Anger' },
                { color: '#ec4899', label: 'Active' },
                { color: '#cbd5e1', label: 'Unimeasurable' },
              ].map((item) => (
                <View key={item.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Stress Score */}
          <View style={styles.stressScoreCard}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>77</Text>
            </View>
            <View style={styles.metricsContainer}>
              {stressMetrics.map((metric, index) => (
                <View key={index} style={styles.metricRow}>
                  <View style={styles.metricLabelRow}>
                    <View style={[styles.metricDot, { backgroundColor: metric.color }]} />
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                  </View>
                  <Text style={styles.metricValue}>
                    {metric.value}/{metric.max}
                  </Text>
                  <View style={styles.metricBar}>
                    <View
                      style={[
                        styles.metricBarFill,
                        {
                          width: `${(metric.value / metric.max) * 100}%`,
                          backgroundColor: metric.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Key Insights Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Insights</Text>
          {insights.map((insight) => (
            <View key={insight.id} style={styles.insightCard}>
              <View style={[styles.insightIcon, { backgroundColor: `${insight.color}20` }]}>
                <Ionicons name={insight.icon as any} size={24} color={insight.color} />
              </View>
              <View style={styles.insightContent}>
                <View style={styles.insightHeader}>
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                  <Text style={[styles.insightValue, { color: insight.color }]}>{insight.value}</Text>
                </View>
                <Text style={styles.insightDescription}>{insight.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Daily Journal */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Journal</Text>
            <TouchableOpacity>
              <Ionicons name="add-circle" size={24} color="#5DADE2" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.journalCard}>
            <View style={styles.journalHeader}>
              <Text style={styles.journalDate}>Today</Text>
              <Ionicons name="create-outline" size={20} color="#64748b" />
            </View>
            <Text style={styles.journalPrompt}>How are you feeling today?</Text>
          </TouchableOpacity>
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
  lockedSection: { padding: 40, alignItems: 'center', gap: 12 },
  lockedText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
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
  statusCard: { backgroundColor: '#1e293b', padding: 24, borderRadius: 12 },
  barChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 200 },
  barGroup: { alignItems: 'center', gap: 8 },
  barPair: { alignItems: 'center', position: 'relative' },
  chartBar: { width: 40, borderRadius: 4, minHeight: 20 },
  barValueLabel: { position: 'absolute', top: -20 },
  barValue: { fontSize: 12, fontWeight: '600', color: '#ffffff' },
  barLabel: { fontSize: 12, color: '#ffffff', marginTop: 8 },
  timelineCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12, marginBottom: 16 },
  timelineTitle: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginBottom: 16 },
  timelineChart: {
    flexDirection: 'row',
    height: 120,
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  timelineBarContainer: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  timelineBar: { width: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 10 },
  timelineLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  timelineLabel: { fontSize: 11, color: '#94a3b8' },
  timelineLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 11, color: '#94a3b8' },
  stressScoreCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#5DADE2',
    gap: 20,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: '#a855f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: { fontSize: 36, fontWeight: 'bold', color: '#1e293b' },
  metricsContainer: { flex: 1, justifyContent: 'space-around' },
  metricRow: { gap: 4 },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metricDot: { width: 8, height: 8, borderRadius: 4 },
  metricLabel: { fontSize: 12, color: '#64748b', flex: 1 },
  metricValue: { fontSize: 12, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  metricBar: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  metricBarFill: { height: '100%', borderRadius: 4 },
  insightCard: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 12 },
  insightIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  insightContent: { flex: 1 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  insightTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  insightValue: { fontSize: 14, fontWeight: '600' },
  insightDescription: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  journalCard: {
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  journalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  journalDate: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  journalPrompt: { fontSize: 14, color: '#64748b' },
});
