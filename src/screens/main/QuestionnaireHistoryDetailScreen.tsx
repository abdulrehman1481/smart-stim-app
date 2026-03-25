import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PsychologicalStackParamList } from '../../navigation/PsychologicalStack';
import { useAuth } from '../../auth/AuthContext';
import { getQuestionnaireHistoryEntry, QuestionnaireHistoryEntry } from '../../firebase/dataLogger';

type Props = NativeStackScreenProps<PsychologicalStackParamList, 'QuestionnaireHistoryDetail'>;

const PSS10_QUESTIONS: Record<number, string> = {
  1: 'Upset by something unexpected',
  2: 'Unable to control important things',
  3: 'Felt nervous and stressed',
  4: 'Felt confident handling personal problems',
  5: 'Felt things were going your way',
  6: 'Could not cope with all things to do',
  7: 'Able to control irritations in life',
  8: 'Felt on top of things',
  9: 'Angered by things outside your control',
  10: 'Difficulties piling up too high',
};

const PSS10_LABELS: Record<number, string> = {
  0: 'Never',
  1: 'Almost never',
  2: 'Sometimes',
  3: 'Fairly often',
  4: 'Very often',
};

const formatDateTime = (value?: Date): string => {
  if (!value) {
    return 'Unknown date';
  }
  return `${value.toLocaleDateString()} ${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const sortedResponseKeys = (responses?: Record<string, unknown>): string[] => {
  if (!responses) {
    return [];
  }
  return Object.keys(responses).sort((a, b) => Number(a) - Number(b));
};

export default function QuestionnaireHistoryDetailScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { questionnaireType, questionnaireName, resultId } = route.params;

  const [loading, setLoading] = useState<boolean>(true);
  const [entry, setEntry] = useState<QuestionnaireHistoryEntry | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const loadEntry = async () => {
        if (!user) {
          if (isMounted) {
            setEntry(null);
            setLoading(false);
          }
          return;
        }

        setLoading(true);
        const data = await getQuestionnaireHistoryEntry(user.uid, questionnaireType, resultId);
        if (isMounted) {
          setEntry(data);
          setLoading(false);
        }
      };

      loadEntry();

      return () => {
        isMounted = false;
      };
    }, [user, questionnaireType, resultId])
  );

  const responseRows = useMemo(() => {
    if (!entry?.responses) {
      return [];
    }

    return sortedResponseKeys(entry.responses).map((key) => {
      const rawValue = entry.responses?.[key];
      const numericKey = Number(key);
      const numericValue = typeof rawValue === 'number' ? rawValue : NaN;

      if (questionnaireType === 'PSS10') {
        return {
          id: key,
          question: PSS10_QUESTIONS[numericKey] || `Question ${key}`,
          answer: Number.isFinite(numericValue) ? (PSS10_LABELS[numericValue] || `${numericValue}`) : String(rawValue),
          raw: Number.isFinite(numericValue) ? `${numericValue}` : undefined,
        };
      }

      return {
        id: key,
        question: `Question ${key}`,
        answer: String(rawValue),
        raw: undefined,
      };
    });
  }, [entry?.responses, questionnaireType]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{questionnaireName} Entry Detail</Text>
          <Text style={styles.headerSubtitle}>Submission ID: {resultId.slice(0, 8)}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#5DADE2" />
          <Text style={styles.stateText}>Loading saved answers...</Text>
        </View>
      ) : !entry ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={42} color="#ef4444" />
          <Text style={styles.stateTitle}>Entry not found</Text>
          <Text style={styles.stateText}>This historical result may have been removed.</Text>
        </View>
      ) : (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Submission Summary</Text>
            <Text style={styles.summaryLine}>Date: {formatDateTime(entry.completedAt)}</Text>
            {typeof entry.score === 'number' && typeof entry.maxScore === 'number' && (
              <Text style={styles.summaryLine}>Score: {entry.score}/{entry.maxScore}</Text>
            )}
            {entry.level && <Text style={styles.summaryLine}>Level: {entry.level}</Text>}
            {typeof entry.repeatIntervalDays === 'number' && (
              <Text style={styles.summaryLine}>Repeat interval: {entry.repeatIntervalDays} days</Text>
            )}
          </View>

          <View style={styles.responsesCard}>
            <Text style={styles.responsesTitle}>Marked Answers</Text>
            {responseRows.length === 0 ? (
              <Text style={styles.stateText}>No per-question responses were stored for this entry.</Text>
            ) : (
              responseRows.map((row) => (
                <View key={row.id} style={styles.responseRow}>
                  <Text style={styles.questionText}>{row.question}</Text>
                  <Text style={styles.answerText}>{row.answer}</Text>
                  {row.raw && <Text style={styles.rawText}>Raw: {row.raw}</Text>}
                </View>
              ))
            )}
          </View>

          {entry.notes && (
            <View style={styles.notesCard}>
              <Text style={styles.notesTitle}>Notes</Text>
              <Text style={styles.notesText}>{entry.notes}</Text>
            </View>
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    marginRight: 10,
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  stateTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  stateText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  container: { flex: 1, padding: 16 },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  summaryLine: { fontSize: 13, color: '#334155', marginBottom: 4 },
  responsesCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  responsesTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  responseRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  questionText: { fontSize: 13, color: '#334155', marginBottom: 4 },
  answerText: { fontSize: 14, color: '#1e40af', fontWeight: '600' },
  rawText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  notesCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
  },
  notesTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  notesText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  bottomPad: { height: 24 },
});
