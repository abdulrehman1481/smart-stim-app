import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { BLEProvider } from './src/functionality/BLEContext';
import { DeviceScanner } from './src/components/DeviceScanner';
import { ControlConsole } from './src/components/ControlConsole';
import { SmartStimPanel } from './src/components/SmartStimPanel';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'console' | 'smartstim'>('scanner');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      
      {/* App Header */}
      <View style={styles.appHeader}>
        <Text style={styles.appTitle}>⚡ Smart Stim Controller</Text>
        <Text style={styles.appSubtitle}>BLE Device Control</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'scanner' && styles.tabActive]}
          onPress={() => setActiveTab('scanner')}
        >
          <Text style={[styles.tabText, activeTab === 'scanner' && styles.tabTextActive]}>
            📡 Devices
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'smartstim' && styles.tabActive]}
          onPress={() => setActiveTab('smartstim')}
        >
          <Text style={[styles.tabText, activeTab === 'smartstim' && styles.tabTextActive]}>
            ⚡ Stim
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'console' && styles.tabActive]}
          onPress={() => setActiveTab('console')}
        >
          <Text style={[styles.tabText, activeTab === 'console' && styles.tabTextActive]}>
            🎮 Console
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'scanner' ? (
          <DeviceScanner />
        ) : activeTab === 'smartstim' ? (
          <SmartStimPanel />
        ) : (
          <ControlConsole />
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
    backgroundColor: '#1e3a8a',
  },
  appHeader: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  appTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  appSubtitle: {
    color: '#93c5fd',
    fontSize: 14,
    marginTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    color: '#93c5fd',
    fontSize: 16,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
