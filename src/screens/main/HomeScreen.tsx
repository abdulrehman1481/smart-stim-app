import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useBLE } from '../../functionality/BLEContext';
import { useAuth } from '../../auth/AuthContext';
import { useSensorPipeline } from '../../hooks/useSensorPipeline';
import { getRecentSessions, SessionSummary } from '../../firebase/dataLogger';
import { BluetoothScanModal } from '../../components/BluetoothScanModal';

export default function HomeScreen() {
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [scanModalVisible, setScanModalVisible] = useState(false);

  const { isConnected, connectedDeviceName, disconnectDevice, statusMessage } = useBLE();
  const { user, logout } = useAuth();
  const { live, session, startSession, stopSession } = useSensorPipeline();

  const safe = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);

  const hasFresh = (updatedAt: Date | null) => {
    if (!updatedAt) return false;
    const ts = updatedAt.getTime();
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < 15_000;
  };

  const loadSessions = useCallback(() => {
    if (!user) { setSessionsLoading(false); return; }
    setSessionsLoading(true);
    getRecentSessions(user.uid, 5)
      .then((s) => setRecentSessions(s))
      .catch((err) => console.error('[HomeScreen] sessions load error:', err))
      .finally(() => setSessionsLoading(false));
  }, [user]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    if (isConnected && !session.isRecording && user) {
      startSession(`Session ${new Date().toLocaleString()}`);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!session.isRecording && !isConnected) loadSessions();
  }, [session.isRecording, isConnected, loadSessions]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect', 'Stop recording and disconnect from device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          if (session.isRecording) await stopSession();
          await disconnectDevice();
        },
      },
    ]);
  };

  const handleStopSession = async () => { await stopSession(); loadSessions(); };

  const getSensorCards = () => [
    {
      icon: 'thermometer',
      value: hasFresh(live.temperature.lastUpdated) ? `${safe(live.temperature.tempC).toFixed(1)}°C` : '---',
      label: 'Temp',
      active: hasFresh(live.temperature.lastUpdated),
    },
    {
      icon: 'heart',
      value: hasFresh(live.ppg.lastUpdated) ? `${Math.round(safe(live.ppg.ir)).toLocaleString()}` : '---',
      label: 'PPG-IR',
      active: hasFresh(live.ppg.lastUpdated),
    },
    {
      icon: 'flash',
      value: hasFresh(live.eda.lastUpdated) ? `${safe(live.eda.conductance_uS).toFixed(2)}µS` : '---',
      label: 'EDA',
      active: hasFresh(live.eda.lastUpdated),
    },
    {
      icon: 'speedometer',
      value: hasFresh(live.accel.lastUpdated) ? `${safe(live.accel.magnitude).toFixed(0)}mg` : '---',
      label: 'Accel',
      active: hasFresh(live.accel.lastUpdated),
    },
    {
      icon: 'navigate',
      value: hasFresh(live.gyro.lastUpdated) ? `${safe(live.gyro.magnitude).toFixed(0)}mdps` : '---',
      label: 'Gyro',
      active: hasFresh(live.gyro.lastUpdated),
    },
    {
      icon: 'pulse',
      value: hasFresh(live.eda.lastUpdated) ? live.eda.stressLevel : '---',
      label: 'Stress',
      active: hasFresh(live.eda.lastUpdated),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BluetoothScanModal visible={scanModalVisible} onClose={() => setScanModalVisible(false)} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={['#5DADE2', '#3b82f6']} style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Hello, {user?.email?.split('@')[0] || 'User'} 👋</Text>
              <Text style={styles.subtitle}>Smart Stim Dashboard</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* BLE Connection Card */}
        <View style={styles.section}>
          {isConnected ? (
            <View style={styles.connectedCard}>
              <LinearGradient colors={['#f0fdf4', '#dcfce7']} style={styles.connectedGradient}>
                <View style={styles.connectedHeader}>
                  <View style={styles.connectedIconWrap}>
                    <Ionicons name="watch" size={28} color="#10b981" />
                  </View>
                  <View style={styles.connectedInfo}>
                    <Text style={styles.connectedName}>{connectedDeviceName || 'Wristband'}</Text>
                    <View style={styles.connectedStatusRow}>
                      <View style={styles.liveIndicator} />
                      <Text style={styles.connectedStatus}>
                        {session.isRecording ? `Recording · ${session.dataPointsSaved} pts` : 'Connected'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
                    <Ionicons name="bluetooth-outline" size={18} color="#ef4444" />
                    <Text style={styles.disconnectBtnText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.sessionControls}>
                  {session.isRecording ? (
                    <TouchableOpacity style={styles.stopSessionBtn} onPress={handleStopSession}>
                      <Ionicons name="stop-circle" size={20} color="#ef4444" />
                      <Text style={styles.stopSessionText}>Stop Recording</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.startSessionBtn} onPress={() => startSession()}>
                      <Ionicons name="radio-button-on" size={20} color="#ffffff" />
                      <Text style={styles.startSessionText}>Start Recording</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.sessionMeta}>
                    {session.startedAt && (
                      <Text style={styles.sessionMetaText}>Started {session.startedAt.toLocaleTimeString()}</Text>
                    )}
                  </View>
                </View>
              </LinearGradient>
            </View>
          ) : (
            <View style={styles.disconnectedCard}>
              <View style={styles.disconnectedBody}>
                <View style={styles.bleIconWrap}>
                  <Ionicons name="bluetooth-outline" size={36} color="#5DADE2" />
                </View>
                <View style={styles.disconnectedInfo}>
                  <Text style={styles.disconnectedTitle}>No Device Connected</Text>
                  <Text style={styles.disconnectedSub}>{statusMessage}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.connectBtn} onPress={() => setScanModalVisible(true)}>
                <LinearGradient colors={['#5DADE2', '#3b82f6']} style={styles.connectBtnGradient}>
                  <Ionicons name="search" size={20} color="#ffffff" />
                  <Text style={styles.connectBtnText}>Scan & Connect</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Live Sensor Data */}
        {isConnected && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Live Sensor Data</Text>
              <View style={styles.liveHeaderRight}>
                <Text style={styles.refreshHint}>Live firmware stream</Text>
                {session.isRecording && (
                  <View style={styles.recordingBadge}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingBadgeText}>REC</Text>
                </View>
                )}
              </View>
            </View>
            <View style={styles.sensorGrid}>
              {getSensorCards().map((card) => (
                <View key={card.label} style={[styles.sensorCard, card.active && styles.sensorCardActive]}>
                  <Ionicons name={card.icon as any} size={22} color={card.active ? '#5DADE2' : '#cbd5e1'} />
                  <Text style={[styles.sensorValue, !card.active && styles.sensorValueInactive]}>{card.value}</Text>
                  <Text style={styles.sensorLabel}>{card.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Offline placeholder */}
        {!isConnected && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Health Summary</Text>
            <View style={styles.sensorGrid}>
              {['Temp','PPG-IR','EDA','Accel','Gyro','Stress'].map((label) => (
                <View key={label} style={styles.sensorCard}>
                  <Ionicons name="ellipse-outline" size={22} color="#e2e8f0" />
                  <Text style={[styles.sensorValue, styles.sensorValueInactive]}>---</Text>
                  <Text style={styles.sensorLabel}>{label}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.connectPromptBanner} onPress={() => setScanModalVisible(true)}>
              <Ionicons name="bluetooth" size={18} color="#5DADE2" />
              <Text style={styles.connectPromptText}>Connect your wristband to see live data</Text>
              <Ionicons name="chevron-forward" size={16} color="#5DADE2" />
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Sessions */}
        <View style={[styles.section, { paddingBottom: 32 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            <TouchableOpacity onPress={loadSessions}>
              <Ionicons name="refresh-outline" size={20} color="#5DADE2" />
            </TouchableOpacity>
          </View>
          {sessionsLoading ? (
            <ActivityIndicator color="#5DADE2" style={{ marginTop: 16 }} />
          ) : recentSessions.length === 0 ? (
            <View style={styles.emptySessionState}>
              <Ionicons name="time-outline" size={40} color="#e2e8f0" />
              <Text style={styles.emptySessionText}>No sessions yet</Text>
              <Text style={styles.emptySessionSub}>Connect your wristband and start recording</Text>
            </View>
          ) : (
            recentSessions.map((s) => (
              <View key={s.sessionId} style={styles.sessionCard}>
                <View style={styles.sessionIconWrap}>
                  <Ionicons name={s.isComplete ? 'checkmark-circle' : 'ellipse-outline'} size={24}
                    color={s.isComplete ? '#10b981' : '#f59e0b'} />
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionName}>{s.sessionName}</Text>
                  <Text style={styles.sessionDate}>
                    {s.startTime ? s.startTime.toLocaleDateString() : 'Unknown'}
                    {s.deviceName ? ` · ${s.deviceName}` : ''}
                  </Text>
                </View>
                <View style={styles.sessionRight}>
                  <Text style={styles.sessionPts}>{s.dataPointCount} pts</Text>
                  <Text style={[styles.sessionStatus, { color: s.isComplete ? '#10b981' : '#f59e0b' }]}>
                    {s.isComplete ? 'Done' : 'Partial'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  liveHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  refreshHint: { fontSize: 10, color: '#64748b', fontWeight: '600' },
  connectedCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  connectedGradient: { padding: 16 },
  connectedHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  connectedIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#10b981' },
  connectedInfo: { flex: 1 },
  connectedName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  connectedStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  liveIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  connectedStatus: { fontSize: 13, color: '#10b981', fontWeight: '600' },
  disconnectBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fef2f2', borderRadius: 8, borderWidth: 1, borderColor: '#fecaca' },
  disconnectBtnText: { fontSize: 12, color: '#ef4444', fontWeight: '600' },
  sessionControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(16,185,129,0.2)' },
  startSessionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  startSessionText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  stopSessionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },
  stopSessionText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },
  sessionMeta: { flex: 1, paddingLeft: 12 },
  sessionMetaText: { fontSize: 12, color: '#64748b' },
  disconnectedCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  disconnectedBody: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  bleIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center' },
  disconnectedInfo: { flex: 1 },
  disconnectedTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  disconnectedSub: { fontSize: 13, color: '#64748b', marginTop: 3 },
  connectBtn: { borderRadius: 12, overflow: 'hidden' },
  connectBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  connectBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  recordingBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fef2f2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  recordingBadgeText: { fontSize: 12, fontWeight: '700', color: '#ef4444' },
  sensorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sensorCard: { width: '31%', backgroundColor: '#ffffff', padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  sensorCardActive: { borderColor: '#bae6fd', backgroundColor: '#f0f9ff' },
  sensorValue: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginTop: 8, marginBottom: 3 },
  sensorValueInactive: { color: '#cbd5e1' },
  sensorLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textAlign: 'center' },
  connectPromptBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e0f2fe', borderRadius: 12, padding: 14, marginTop: 12 },
  connectPromptText: { flex: 1, fontSize: 14, color: '#0369a1', fontWeight: '500' },
  emptySessionState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptySessionText: { fontSize: 16, fontWeight: '600', color: '#94a3b8' },
  emptySessionSub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center' },
  sessionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  sessionIconWrap: { marginRight: 12 },
  sessionInfo: { flex: 1 },
  sessionName: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 2 },
  sessionDate: { fontSize: 12, color: '#64748b' },
  sessionRight: { alignItems: 'flex-end', gap: 3 },
  sessionPts: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  sessionStatus: { fontSize: 12, fontWeight: '600' },
});