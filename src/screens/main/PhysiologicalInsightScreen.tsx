import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';

// ─── Constants ────────────────────────────────────────────────────────────────
const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 64;

const COLORS = {
  primary: '#1B4965',
  accent: '#18A999',
  error: '#DC2626',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  textLight: '#94a3b8',
  border: '#e2e8f0',
  success: '#10b981',
  warning: '#f59e0b',
};

type TimeRange = 'Day' | 'Week' | 'Month' | 'Year';

// ─── Dummy Data Per Time Range ────────────────────────────────────────────────
const DUMMY_DATA: Record<TimeRange, {
  hr: number[];
  hrv: number[];
  temp: number[];
  eda: number[];
  hrLabels: string[];
  hrvLabels: string[];
  tempLabels: string[];
  edaLabels: string[];
}> = {
  Day: {
    hr: [68, 72, 75, 71, 69, 74, 78, 72],
    hrv: [40, 45, 42, 50, 47, 43],
    temp: [36.2, 36.5, 36.4, 36.6],
    eda: [2.1, 2.4, 2.3, 2.7],
    hrLabels: ['6a', '9a', '12p', '3p', '6p', '9p', '12a', '3a'],
    hrvLabels: ['6a', '10a', '2p', '6p', '10p', '2a'],
    tempLabels: ['Morning', 'Noon', 'Eve', 'Night'],
    edaLabels: ['Morning', 'Noon', 'Eve', 'Night'],
  },
  Week: {
    hr: [70, 73, 68, 75, 71, 74, 72],
    hrv: [42, 48, 39, 46, 51, 44, 47],
    temp: [36.3, 36.4, 36.5, 36.3, 36.6, 36.4, 36.5],
    eda: [2.2, 2.5, 2.1, 2.6, 2.3, 2.4, 2.2],
    hrLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    hrvLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    tempLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    edaLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  Month: {
    hr: [71, 73, 70, 74],
    hrv: [44, 46, 43, 48],
    temp: [36.3, 36.5, 36.4, 36.4],
    eda: [2.2, 2.4, 2.3, 2.3],
    hrLabels: ['Wk1', 'Wk2', 'Wk3', 'Wk4'],
    hrvLabels: ['Wk1', 'Wk2', 'Wk3', 'Wk4'],
    tempLabels: ['Wk1', 'Wk2', 'Wk3', 'Wk4'],
    edaLabels: ['Wk1', 'Wk2', 'Wk3', 'Wk4'],
  },
  Year: {
    hr: [72, 71, 73, 70, 74, 72, 71, 73, 75, 72, 70, 71],
    hrv: [43, 45, 44, 46, 42, 48, 45, 44, 47, 43, 46, 45],
    temp: [36.3, 36.4, 36.5, 36.4, 36.3, 36.5, 36.6, 36.4, 36.3, 36.5, 36.4, 36.4],
    eda: [2.2, 2.3, 2.4, 2.3, 2.1, 2.5, 2.3, 2.2, 2.4, 2.3, 2.2, 2.3],
    hrLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    hrvLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    tempLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    edaLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
};

const ACTIVITY_DATA = [
  { label: 'Sedentary', duration: '5h 30min', fraction: 0.69, color: COLORS.textLight },
  { label: 'Light Active', duration: '1h 45min', fraction: 0.22, color: COLORS.accent },
  { label: 'Fair Active', duration: '0h 40min', fraction: 0.08, color: '#2B6E8F' },
  { label: 'Very Active', duration: '0h 15min', fraction: 0.02, color: COLORS.primary },
];

// ─── Shared Chart Config ──────────────────────────────────────────────────────
function makeChartConfig(color: string) {
  return {
    backgroundGradientFrom: COLORS.surface,
    backgroundGradientTo: COLORS.surface,
    decimalPlaces: 1,
    color: (_opacity = 1) => color,
    labelColor: () => COLORS.textSecondary,
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: color,
      fill: COLORS.surface,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: COLORS.border,
      strokeWidth: 1,
    },
    style: {
      borderRadius: 12,
    },
  };
}

// ─── MetricCard ───────────────────────────────────────────────────────────────
interface MetricCardProps {
  accent: string;
  icon: string;
  title: string;
  subtitle: string;
  description?: string;
  children: React.ReactNode;
}

function MetricCard({ accent, icon, title, subtitle, description, children }: MetricCardProps) {
  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconCircle, { backgroundColor: accent + '18' }]}>
          <Ionicons name={icon as any} size={18} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {children}
      {description ? (
        <Text style={styles.cardDescription}>{description}</Text>
      ) : null}
    </View>
  );
}

// ─── ComingSoonCard ───────────────────────────────────────────────────────────
function ComingSoonCard({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.comingSoonCard}>
      <View style={styles.comingSoonContent}>
        <View style={styles.comingSoonIconWrap}>
          <Ionicons name={icon as any} size={22} color={COLORS.textLight} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.comingSoonTitle}>{title}</Text>
          <View style={styles.comingSoonBadge}>
            <Ionicons name="lock-closed" size={11} color={COLORS.textLight} />
            <Text style={styles.comingSoonText}>Coming Soon</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── ActivityBar ──────────────────────────────────────────────────────────────
function ActivityBar({ label, duration, fraction, color }: {
  label: string;
  duration: string;
  fraction: number;
  color: string;
}) {
  return (
    <View style={styles.activityRow}>
      <Text style={styles.activityLabel}>{label}</Text>
      <View style={styles.activityTrack}>
        <View
          style={[
            styles.activityFill,
            { width: `${Math.max(fraction * 100, 3)}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.activityDuration}>{duration}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PhysiologicalInsightScreen() {
  const [timeRange, setTimeRange] = useState<TimeRange>('Day');
  const isConnected = true; // Dummy — always show connected for trend view

  const data = DUMMY_DATA[timeRange];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="stats-chart" size={22} color={COLORS.primary} />
        </View>
        <Text style={styles.headerTitle}>Physiological Insight</Text>
        <View
          style={[
            styles.connDot,
            { backgroundColor: isConnected ? COLORS.success : COLORS.error },
          ]}
        />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Time Range Tabs */}
        <View style={styles.timeTabsWrap}>
          {(['Day', 'Week', 'Month', 'Year'] as TimeRange[]).map((range) => {
            const active = timeRange === range;
            return (
              <TouchableOpacity
                key={range}
                style={[styles.timeTab, active && styles.timeTabActive]}
                onPress={() => setTimeRange(range)}
              >
                <Text
                  style={[styles.timeTabText, active && styles.timeTabTextActive]}
                >
                  {range}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Heart Rate ─────────────────────────────────────────────────── */}
        <MetricCard
          accent={COLORS.error}
          icon="heart"
          title="Heart Rate"
          subtitle="72 bpm avg"
          description="Average resting heart rate over the selected period."
        >
          <LineChart
            data={{
              labels: data.hrLabels,
              datasets: [{ data: data.hr }],
            }}
            width={CHART_WIDTH}
            height={180}
            chartConfig={makeChartConfig(COLORS.error)}
            bezier
            style={styles.chart}
            withInnerLines={false}
            withOuterLines={false}
          />
        </MetricCard>

        {/* ── Heart Rate Variability ──────────────────────────────────────── */}
        <MetricCard
          accent="#f97316"
          icon="pulse"
          title="Heart Rate Variability"
          subtitle="45 ms avg"
          description="Higher HRV generally indicates better cardiovascular fitness and stress resilience."
        >
          <LineChart
            data={{
              labels: data.hrvLabels,
              datasets: [{ data: data.hrv }],
            }}
            width={CHART_WIDTH}
            height={180}
            chartConfig={makeChartConfig('#f97316')}
            bezier
            style={styles.chart}
            withInnerLines={false}
            withOuterLines={false}
          />
        </MetricCard>

        {/* ── Activity Insight ────────────────────────────────────────────── */}
        <MetricCard
          accent={COLORS.accent}
          icon="fitness"
          title="Activity Insight"
          subtitle="74/100 Activity Score"
          description="Movement breakdown based on wristband accelerometer and gyroscope data."
        >
          <View style={styles.activityContainer}>
            {ACTIVITY_DATA.map((item) => (
              <ActivityBar
                key={item.label}
                label={item.label}
                duration={item.duration}
                fraction={item.fraction}
                color={item.color}
              />
            ))}
          </View>
        </MetricCard>

        {/* ── Skin Temperature ────────────────────────────────────────────── */}
        <MetricCard
          accent="#f97316"
          icon="thermometer"
          title="Skin Temperature"
          subtitle="36.4°C avg"
          description="Skin temperature trends can reveal circadian rhythm patterns and early signs of illness."
        >
          <LineChart
            data={{
              labels: data.tempLabels,
              datasets: [{ data: data.temp }],
            }}
            width={CHART_WIDTH}
            height={180}
            chartConfig={makeChartConfig('#f97316')}
            bezier
            style={styles.chart}
            withInnerLines={false}
            withOuterLines={false}
          />
        </MetricCard>

        {/* ── Electrodermal Activity ──────────────────────────────────────── */}
        <MetricCard
          accent={COLORS.accent}
          icon="flash"
          title="Electrodermal Activity"
          subtitle="2.3 µS avg"
          description="EDA reflects sympathetic nervous system arousal — useful for stress and emotional monitoring."
        >
          <LineChart
            data={{
              labels: data.edaLabels,
              datasets: [{ data: data.eda }],
            }}
            width={CHART_WIDTH}
            height={180}
            chartConfig={makeChartConfig(COLORS.accent)}
            bezier
            style={styles.chart}
            withInnerLines={false}
            withOuterLines={false}
          />
        </MetricCard>

        {/* ── Coming Soon Cards ───────────────────────────────────────────── */}
        <ComingSoonCard title="Blood Pressure & SpO2" icon="water" />
        <ComingSoonCard title="Sleep Insight" icon="moon" />

        {/* ── Overall Wellness Score ──────────────────────────────────────── */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreValue}>74</Text>
            <Text style={styles.scoreDenom}>/100</Text>
          </View>
          <Text style={styles.scoreLabel}>Overall Wellness Score</Text>
          <Text style={styles.scoreDescription}>
            Based on heart rate, HRV, activity, temperature, and EDA trends.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  connDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  scroll: {
    flex: 1,
  },

  // Time Range Tabs
  timeTabsWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    backgroundColor: COLORS.border,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  timeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeTabActive: {
    backgroundColor: COLORS.surface,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  timeTabText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  timeTabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },

  // Metric Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 18,
    borderLeftWidth: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  cardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  cardDescription: {
    fontSize: 11,
    color: COLORS.textLight,
    lineHeight: 16,
    marginTop: 10,
  },

  // Chart
  chart: {
    borderRadius: 12,
    marginLeft: -8,
  },

  // Activity Insight
  activityContainer: {
    gap: 10,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityLabel: {
    width: 90,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  activityTrack: {
    flex: 1,
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  activityFill: {
    height: '100%',
    borderRadius: 5,
  },
  activityDuration: {
    width: 72,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'right',
  },

  // Coming Soon Card
  comingSoonCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface + 'AA',
    padding: 18,
    opacity: 0.65,
  },
  comingSoonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  comingSoonIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
  },

  // Score Card
  scoreCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.accent,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  scoreCircle: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: '900',
    color: COLORS.accent,
    lineHeight: 64,
  },
  scoreDenom: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 8,
    lineHeight: 64,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  scoreDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
