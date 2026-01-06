import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { BLEProvider } from './src/functionality/BLEContext';
import { DeviceScanner } from './src/components/DeviceScanner';
import { ComprehensiveStimPanel } from './src/components/ComprehensiveStimPanel';
import { WristbandSensorsPanel } from './src/components/WristbandSensorsPanel';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'devices' | 'stim' | 'sensors'>('devices');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />
      
      {/* App Header */}
      <View style={styles.appHeader}>
        <Text style={styles.appTitle}>⚡ Smart Stim Controller</Text>
        <Text style={styles.appSubtitle}>BLE Device Control</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'devices' && styles.tabActive]}
          onPress={() => setActiveTab('devices')}
        >
          <Text style={[styles.tabText, activeTab === 'devices' && styles.tabTextActive]}>
            📡 Devices
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stim' && styles.tabActive]}
          onPress={() => setActiveTab('stim')}
        >
          <Text style={[styles.tabText, activeTab === 'stim' && styles.tabTextActive]}>
            ⚡ Stim
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sensors' && styles.tabActive]}
          onPress={() => setActiveTab('sensors')}
        >
          <Text style={[styles.tabText, activeTab === 'sensors' && styles.tabTextActive]}>
            🌊 Sensors
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'devices' ? (
          <DeviceScanner />
        ) : activeTab === 'stim' ? (
          <ComprehensiveStimPanel />
        ) : (
          <WristbandSensorsPanel />
        )}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <BLEProvider>
      <AppContent />
    </BLEProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6366f1',
  },
  appHeader: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  appTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    color: '#e0e7ff',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginHorizontal: 4,
  },
  tabActive: {
    borderBottomColor: '#ffffff',
  },
  tabText: {
    color: '#c7d2fe',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
});
