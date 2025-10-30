import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useBLE } from '../functionality/BLEContext';
import { bleService } from '../functionality/BLEService';

export const ControlConsole: React.FC = () => {
  const {
    isConnected,
    connectedDeviceName,
    receivedMessages,
    statusMessage,
    clearMessages,
  } = useBLE();

  const [inputText, setInputText] = useState('');
  const [lineEnding, setLineEnding] = useState<'none' | 'lf' | 'cr' | 'crlf'>('none');
  const [writeWithoutResponse, setWriteWithoutResponse] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [receivedMessages]);

  const sendCommand = async (command: string) => {
    if (!isConnected) {
      return;
    }

    // Build payload with line ending (like Python GUI)
    let dataToSend = command;
    switch (lineEnding) {
      case 'lf':
        dataToSend = command + '\n';
        break;
      case 'cr':
        dataToSend = command + '\r';
        break;
      case 'crlf':
        dataToSend = command + '\r\n';
        break;
      case 'none':
      default:
        dataToSend = command;
        break;
    }

    console.log('[Console] Sending:', JSON.stringify(dataToSend), 'withResponse:', !writeWithoutResponse);
    const success = await bleService.sendData(dataToSend, !writeWithoutResponse);
    
    if (success) {
      const timestamp = new Date().toLocaleTimeString();
      const mode = writeWithoutResponse ? 'no-resp' : 'with-resp';
      const ending = lineEnding !== 'none' ? ` + ${lineEnding.toUpperCase()}` : '';
      const message = `[${timestamp}] TX [${mode}]: ${command}${ending}`;
      // You might want to add this to a local state instead
      console.log(message);
    }
  };

  const handleSend = () => {
    if (inputText.trim() && isConnected) {
      sendCommand(inputText.trim());
      setInputText('');
    }
  };

  const quickSend = (command: string) => {
    if (isConnected) {
      sendCommand(command);
    }
  };

  const cycleLineEnding = () => {
    const endings: Array<'none' | 'lf' | 'cr' | 'crlf'> = ['none', 'lf', 'cr', 'crlf'];
    const currentIndex = endings.indexOf(lineEnding);
    const nextIndex = (currentIndex + 1) % endings.length;
    setLineEnding(endings[nextIndex]);
  };

  const getLineEndingLabel = () => {
    switch (lineEnding) {
      case 'lf': return '\\n';
      case 'cr': return '\\r';
      case 'crlf': return '\\r\\n';
      case 'none':
      default: return 'None';
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header with connection status */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🎮 Control Console</Text>
          {isConnected && (
            <Text style={styles.connectedDevice}>
              Connected: {connectedDeviceName}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearMessages}
        >
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, isConnected ? styles.statusConnected : styles.statusDisconnected]} />
        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>

      {/* Message Console */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.console}
        contentContainerStyle={styles.consoleContent}
      >
        {receivedMessages.length === 0 ? (
          <Text style={styles.emptyText}>
            {isConnected
              ? 'Console ready. Send commands or wait for device responses.'
              : 'Connect to a device to start communication.'}
          </Text>
        ) : (
          receivedMessages.map((msg, index) => {
            const isTX = msg.includes('TX:');
            const isError = msg.includes('ERROR:');
            return (
              <View
                key={index}
                style={[
                  styles.message,
                  isTX && styles.messageTX,
                  isError && styles.messageError,
                ]}
              >
                <Text style={[
                  styles.messageText,
                  isTX && styles.messageTXText,
                  isError && styles.messageErrorText,
                ]}>
                  {msg}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Quick Action Buttons */}
      {isConnected && (
        <View style={styles.quickActions}>
          <Text style={styles.quickActionsLabel}>Quick Commands:</Text>
          <View style={styles.quickButtonRow}>
            <TouchableOpacity
              style={[styles.quickButton, styles.quickButton1]}
              onPress={() => quickSend('1')}
            >
              <Text style={styles.quickButtonText}>LED ON (1)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickButton, styles.quickButton0]}
              onPress={() => quickSend('0')}
            >
              <Text style={styles.quickButtonText}>LED OFF (0)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickButton, styles.quickButtonSleep]}
              onPress={() => quickSend('sleep')}
            >
              <Text style={styles.quickButtonText}>Sleep</Text>
            </TouchableOpacity>
          </View>
          
          {/* Transmission Options (like Python GUI) */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={cycleLineEnding}
            >
              <Text style={styles.optionLabel}>Line End:</Text>
              <Text style={styles.optionValue}>{getLineEndingLabel()}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => setWriteWithoutResponse(!writeWithoutResponse)}
            >
              <Text style={styles.optionLabel}>Write Mode:</Text>
              <Text style={styles.optionValue}>
                {writeWithoutResponse ? 'No Response' : 'With Response'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input Section */}
      <View style={styles.inputSection}>
        <TextInput
          style={[styles.input, !isConnected && styles.inputDisabled]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={isConnected ? "Type command (e.g., '1', '0', 'sleep')" : "Connect to device first"}
          placeholderTextColor="#9ca3af"
          editable={isConnected}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, !isConnected && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!isConnected || !inputText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#1e3a8a',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  connectedDevice: {
    fontSize: 12,
    color: '#93c5fd',
    marginTop: 4,
  },
  clearButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    padding: 12,
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusConnected: {
    backgroundColor: '#10b981',
  },
  statusDisconnected: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  console: {
    flex: 1,
    backgroundColor: '#1f2937',
  },
  consoleContent: {
    padding: 12,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  message: {
    backgroundColor: '#374151',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  messageTX: {
    backgroundColor: '#1e40af',
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  messageError: {
    backgroundColor: '#991b1b',
  },
  messageText: {
    color: '#e5e7eb',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  messageTXText: {
    color: '#dbeafe',
  },
  messageErrorText: {
    color: '#fecaca',
  },
  quickActions: {
    backgroundColor: '#fff',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  quickActionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  quickButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickButton1: {
    backgroundColor: '#10b981',
  },
  quickButton0: {
    backgroundColor: '#ef4444',
  },
  quickButtonSleep: {
    backgroundColor: '#8b5cf6',
  },
  quickButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  optionLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 2,
  },
  optionValue: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
  },
  inputSection: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  inputDisabled: {
    backgroundColor: '#e5e7eb',
    color: '#9ca3af',
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
