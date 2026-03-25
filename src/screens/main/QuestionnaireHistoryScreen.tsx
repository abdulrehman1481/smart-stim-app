import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PsychologicalStackParamList } from '../../navigation/PsychologicalStack';
import { useAuth } from '../../auth/AuthContext';
import { getQuestionnaireHistory, QuestionnaireHistoryEntry } from '../../firebase/dataLogger';

type Props = NativeStackScreenProps<PsychologicalStackParamList, 'QuestionnaireHistory'>;

const formatDateTime = (value?: Date): string => {
  if (!value) {
    return 'Unknown date';
  }
  return `${value.toLocaleDateString()} ${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const getScorePercent = (score?: number, maxScore?: number): number | undefined => {
  if (typeof score !== 'number' || typeof maxScore !== 'number' || maxScore <= 0) {
    return undefined;
  }
  return Math.round((score / maxScore) * 100);
};

const getDotColor = (percent?: number): string => {
  if (typeof percent !== 'number') {
    return '#94a3b8';
  }
  if (percent < 30) {
    return '#10b981';
  }
  if (percent < 60) {
    return '#f59e0b';
  }
  return '#ef4444';
};

export default function QuestionnaireHistoryScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { questionnaireType, questionnaireName } = route.params;

  const [entries, setEntries] = useState<QuestionnaireHistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const loadHistory = async () => {
        if (!user) {
          if (isMounted) {
            setEntries([]);
            setLoading(false);
          }
          return;
        }

        setLoading(true);
        const history = await getQuestionnaireHistory(user.uid, questionnaireType, 200);
        if (isMounted) {
          setEntries(history);
          setLoading(false);
        }
      };

      loadHistory();

      return () => {
        isMounted = false;
      };
    }, [user, questionnaireType])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{questionnaireName} History</Text>
          <Text style={styles.headerSubtitle}>{questionnaireType} biweekly timeline</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#5DADE2" />
          <Text style={styles.stateText}>Loading timeline...</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="time-outline" size={42} color="#94a3b8" />
          <Text style={styles.stateTitle}>No submissions yet</Text>
          <Text style={styles.stateText}>Complete this questionnaire to start its timeline.</Text>
        </View>
      ) : (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.timeline}>
            {entries.map((entry, index) => {
              const percent = getScorePercent(entry.score, entry.maxScore);
              const scoreLine = typeof entry.score === 'number' && typeof entry.maxScore === 'number'
                ? `${entry.score}/${entry.maxScore}`
                : 'Score not available';

              return (
                <View key={entry.resultId} style={styles.timelineRow}>
                  <View style={styles.timelineTrackWrap}>
                    <View style={[styles.dot, { backgroundColor: getDotColor(percent) }]} />
                    {index < entries.length - 1 && <View style={styles.track} />}
                  </View>

                  <TouchableOpacity
                    style={styles.card}
                    onPress={() =>
                      navigation.navigate('QuestionnaireHistoryDetail', {
                        questionnaireType,
                        questionnaireName,
                        resultId: entry.resultId,
                      })
                    }
                  >
                    <Text style={styles.dateText}>{formatDateTime(entry.completedAt)}</Text>
                    <Text style={styles.scoreText}>{scoreLine}</Text>
                    {typeof percent === 'number' && <Text style={styles.percentText}>{percent}% of max score</Text>}
                    {entry.level && <Text style={styles.levelText}>{entry.level}</Text>}
                    {typeof entry.repeatIntervalDays === 'number' && (
                      <Text style={styles.metaText}>Repeat interval: {entry.repeatIntervalDays} days</Text>
                    )}
                    {entry.notes && (
                      <Text style={styles.notesText} numberOfLines={3}>
                        Notes: {entry.notes}
                      </Text>
                    )}
                    <View style={styles.detailsLinkRow}>
                      <Text style={styles.detailsLinkText}>View marked answers</Text>
                      <Ionicons name="chevron-forward" size={16} color="#2563eb" />
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
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
  container: { flex: 1 },
  timeline: { padding: 16, gap: 2 },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch' },
  timelineTrackWrap: { width: 24, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 16 },
  track: { flex: 1, width: 2, backgroundColor: '#cbd5e1', marginTop: 4 },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dateText: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  scoreText: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  percentText: { fontSize: 12, color: '#475569', marginTop: 2 },
  levelText: { fontSize: 13, color: '#0f766e', marginTop: 6, fontWeight: '600' },
  metaText: { fontSize: 12, color: '#334155', marginTop: 4 },
  notesText: { fontSize: 12, color: '#475569', marginTop: 6, lineHeight: 18 },
  detailsLinkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8 },
  detailsLinkText: { fontSize: 12, color: '#2563eb', fontWeight: '600', marginRight: 2 },
  bottomPad: { height: 24 },
});
