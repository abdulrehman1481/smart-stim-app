import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { useBLE } from '../../functionality/BLEContext';
import { BluetoothScanModal } from '../../components/BluetoothScanModal';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { isConnected, connectedDeviceName } = useBLE();
  const [notifications, setNotifications] = useState(true);
  const [autoConnect, setAutoConnect] = useState(false);
  const [dataSync, setDataSync] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [bleModalVisible, setBleModalVisible] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            Alert.alert('Error', 'Failed to logout');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BluetoothScanModal visible={bleModalVisible} onClose={() => setBleModalVisible(false)} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="settings" size={28} color="#5DADE2" />
          </View>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your preferences</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Profile Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}>
                <Ionicons name="person" size={32} color="#5DADE2" />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.email?.split('@')[0] || 'User'}</Text>
                <Text style={styles.profileEmail}>{user?.email || ''}</Text>
              </View>
              <TouchableOpacity style={styles.editButton}>
                <Ionicons name="pencil" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Device Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Device Settings</Text>
            <View style={styles.settingsContainer}>
              {/* Bluetooth Device Row */}
              <TouchableOpacity style={styles.settingItem} onPress={() => setBleModalVisible(true)}>
                <View style={styles.settingLeft}>
                  <Ionicons
                    name={isConnected ? 'bluetooth' : 'bluetooth-outline'}
                    size={24}
                    color={isConnected ? '#10b981' : '#5DADE2'}
                  />
                  <View style={styles.settingText}>
                    <Text style={styles.settingTitle}>
                      {isConnected ? connectedDeviceName || 'Connected Device' : 'Pair / Connect Device'}
                    </Text>
                    <Text style={[styles.settingSubtitle, isConnected && { color: '#10b981' }]}>
                      {isConnected ? 'Tap to manage connection' : 'Scan for BLE wristband'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
              </TouchableOpacity>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Ionicons name="bluetooth" size={24} color="#5DADE2" />
                  <View style={styles.settingText}>
                    <Text style={styles.settingTitle}>Auto-connect</Text>
                    <Text style={styles.settingSubtitle}>Automatically connect to last device</Text>
                  </View>
                </View>
                <Switch
                  value={autoConnect}
                  onValueChange={setAutoConnect}
                  trackColor={{ false: '#cbd5e1', true: '#5DADE2' }}
                  thumbColor={autoConnect ? '#ffffff' : '#f1f5f9'}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Ionicons name="volume-high" size={24} color="#5DADE2" />
                  <View style={styles.settingText}>
                    <Text style={styles.settingTitle}>Sound Effects</Text>
                    <Text style={styles.settingSubtitle}>Play sounds during sessions</Text>
                  </View>
                </View>
                <Switch
                  value={soundEnabled}
                  onValueChange={setSoundEnabled}
                  trackColor={{ false: '#cbd5e1', true: '#5DADE2' }}
                  thumbColor={soundEnabled ? '#ffffff' : '#f1f5f9'}
                />
              </View>
            </View>
          </View>

          {/* App Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App Settings</Text>
            <View style={styles.settingsContainer}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Ionicons name="notifications" size={24} color="#5DADE2" />
                  <View style={styles.settingText}>
                    <Text style={styles.settingTitle}>Notifications</Text>
                    <Text style={styles.settingSubtitle}>Session reminders and updates</Text>
                  </View>
                </View>
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: '#cbd5e1', true: '#5DADE2' }}
                  thumbColor={notifications ? '#ffffff' : '#f1f5f9'}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Ionicons name="cloud" size={24} color="#5DADE2" />
                  <View style={styles.settingText}>
                    <Text style={styles.settingTitle}>Data Sync</Text>
                    <Text style={styles.settingSubtitle}>Sync data across devices</Text>
                  </View>
                </View>
                <Switch
                  value={dataSync}
                  onValueChange={setDataSync}
                  trackColor={{ false: '#cbd5e1', true: '#5DADE2' }}
                  thumbColor={dataSync ? '#ffffff' : '#f1f5f9'}
                />
              </View>
            </View>
          </View>

          {/* Logout */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.8}>
              <Ionicons name="log-out" size={20} color="#dc2626" />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  scrollView: { flex: 1 },
  header: {
    marginBottom: 24,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
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
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  headerSubtitle: { fontSize: 16, color: '#64748b' },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 2 },
  profileEmail: { fontSize: 14, color: '#64748b' },
  editButton: { padding: 8 },
  settingsContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingText: { marginLeft: 12, flex: 1 },
  settingTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  settingSubtitle: { fontSize: 14, color: '#64748b' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutButtonText: { fontSize: 16, fontWeight: '600', color: '#dc2626' },
});
