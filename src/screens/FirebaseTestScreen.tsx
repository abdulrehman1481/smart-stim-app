import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { runFirebaseTests, quickFirebaseTest } from '../firebase/testFirebase';
import { theme } from '../styles/theme';

/**
 * Firebase Test Screen
 * 
 * Simple UI to test if Firebase is working properly
 * Use this to debug database connection issues
 */
export const FirebaseTestScreen: React.FC = () => {
  const { user } = useAuth();
  const [testLog, setTestLog] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLog = (message: string) => {
    setTestLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleQuickTest = async () => {
    if (!user) {
      addLog('❌ ERROR: Not logged in!');
      return;
    }

    setIsRunning(true);
    addLog('🧪 Starting quick Firebase test...');
    
    try {
      await quickFirebaseTest(user.uid);
      addLog('✅ Quick test completed - Check console');
    } catch (error) {
      addLog(`❌ Quick test failed: ${error}`);
    }
    
    setIsRunning(false);
  };

  const handleFullTest = async () => {
    if (!user) {
      addLog('❌ ERROR: Not logged in!');
      return;
    }

    setIsRunning(true);
    setTestLog([]);
    addLog('🧪 Starting comprehensive Firebase test suite...');
    
    try {
      await runFirebaseTests(user.uid);
      addLog('✅ All tests completed - Check console for results');
    } catch (error) {
      addLog(`❌ Test suite failed: ${error}`);
    }
    
    setIsRunning(false);
  };

  const clearLog = () => {
    setTestLog([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧪 Firebase Connection Test</Text>
      
      {!user ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>⚠️ Not Logged In</Text>
          <Text style={styles.warningSubtext}>
            Please sign in to test Firebase
          </Text>
        </View>
      ) : (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>✅ Logged In</Text>
          <Text style={styles.infoSubtext}>User ID: {user.uid.substring(0, 8)}...</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.quickButton, isRunning && styles.buttonDisabled]}
          onPress={handleQuickTest}
          disabled={isRunning || !user}
        >
          <Text style={styles.buttonText}>⚡ Quick Test</Text>
          <Text style={styles.buttonSubtext}>Single write operation</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.fullButton, isRunning && styles.buttonDisabled]}
          onPress={handleFullTest}
          disabled={isRunning || !user}
        >
          <Text style={styles.buttonText}>🔬 Full Test Suite</Text>
          <Text style={styles.buttonSubtext}>Comprehensive tests</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.instructionsBox}>
        <Text style={styles.instructionsTitle}>📋 Instructions:</Text>
        <Text style={styles.instructionsText}>1. Make sure you're logged in</Text>
        <Text style={styles.instructionsText}>2. Run "Quick Test" first</Text>
        <Text style={styles.instructionsText}>3. Check console output in terminal</Text>
        <Text style={styles.instructionsText}>
          4. Verify data in{' '}
          <Text style={styles.link}>Firebase Console</Text>
        </Text>
        <Text style={styles.instructionsText}>
          5. Look for: users/{'{userId}'}/test_data
        </Text>
      </View>

      <View style={styles.logHeader}>
        <Text style={styles.logTitle}>Test Log:</Text>
        <TouchableOpacity onPress={clearLog} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.logContainer}>
        {testLog.length === 0 ? (
          <Text style={styles.logEmpty}>No tests run yet</Text>
        ) : (
          testLog.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log}
            </Text>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Project: smartstim-28b2a
        </Text>
        <Text style={styles.footerText}>
          Console logs contain detailed information
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#ff4444',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  warningText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  warningSubtext: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
  infoBox: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  infoText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  infoSubtext: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  quickButton: {
    backgroundColor: '#2196F3',
  },
  fullButton: {
    backgroundColor: '#9C27B0',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonSubtext: {
    color: 'white',
    fontSize: 12,
    marginTop: 5,
    opacity: 0.9,
  },
  instructionsBox: {
    backgroundColor: theme.colors.surface,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 5,
  },
  link: {
    color: '#2196F3',
    textDecorationLine: 'underline',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  clearButton: {
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: 5,
  },
  clearButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    padding: 10,
  },
  logEmpty: {
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  logText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 5,
  },
  footer: {
    marginTop: 15,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 5,
  },
});
