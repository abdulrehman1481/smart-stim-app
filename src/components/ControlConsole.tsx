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
  Alert,
  Modal,
  Switch,
} from 'react-native';
import { useBLE } from '../functionality/BLEContext';
import { bleService } from '../functionality/BLEService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Settings storage keys
const SETTINGS_KEY = 'ble_console_settings';
const CUSTOM_BUTTONS_KEY = 'ble_custom_buttons';

interface CustomButton {
  label: string;
  command: string;
  justInsert: boolean; // true = insert into input, false = send immediately
}

interface ConsoleSettings {
  lineEnding: 'none' | 'lf' | 'cr' | 'crlf';
  writeWithoutResponse: boolean;
  localEcho: boolean;
  timestamp: boolean;
  clearOnSend: boolean;
}

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
  const [localEcho, setLocalEcho] = useState(false);
  const [timestamp, setTimestamp] = useState(true);
  const [clearOnSend, setClearOnSend] = useState(false);
  const [localMessages, setLocalMessages] = useState<string[]>([]);
  
  // Custom buttons state (10 buttons like C# app)
  const [customButtons, setCustomButtons] = useState<CustomButton[]>(
    Array(10).fill(null).map((_, i) => ({
      label: `Button ${i + 1}`,
      command: '',
      justInsert: false,
    }))
  );
  const [editingButtonIndex, setEditingButtonIndex] = useState<number | null>(null);
  const [showButtonConfig, setShowButtonConfig] = useState(false);
  const [tempButtonLabel, setTempButtonLabel] = useState('');
  const [tempButtonCommand, setTempButtonCommand] = useState('');
  const [tempButtonJustInsert, setTempButtonJustInsert] = useState(false);
  const [redLedState, setRedLedState] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);

  // Combine local and received messages
  const allMessages = [...receivedMessages, ...localMessages];

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadCustomButtons();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [allMessages]);

  // Save settings when they change
  useEffect(() => {
    saveSettings();
  }, [lineEnding, writeWithoutResponse, localEcho, timestamp, clearOnSend]);

  // Save custom buttons when they change
  useEffect(() => {
    saveCustomButtons();
  }, [customButtons]);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        const settings: ConsoleSettings = JSON.parse(savedSettings);
        setLineEnding(settings.lineEnding);
        setWriteWithoutResponse(settings.writeWithoutResponse);
        setLocalEcho(settings.localEcho);
        setTimestamp(settings.timestamp);
        setClearOnSend(settings.clearOnSend);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const settings: ConsoleSettings = {
        lineEnding,
        writeWithoutResponse,
        localEcho,
        timestamp,
        clearOnSend,
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const loadCustomButtons = async () => {
    try {
      const saved = await AsyncStorage.getItem(CUSTOM_BUTTONS_KEY);
      if (saved) {
        setCustomButtons(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load custom buttons:', error);
    }
  };

  const saveCustomButtons = async () => {
    try {
      await AsyncStorage.setItem(CUSTOM_BUTTONS_KEY, JSON.stringify(customButtons));
    } catch (error) {
      console.error('Failed to save custom buttons:', error);
    }
  };

  const addLocalMessage = (message: string) => {
    setLocalMessages((prev) => [...prev, message]);
  };

  const toggleRedLED = async () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please connect to a device first');
      return;
    }

    const newState = !redLedState;
    const command = `RED:${newState ? '1' : '0'}`;
    
    const success = await bleService.sendData(command, !writeWithoutResponse);
    if (success) {
      setRedLedState(newState);
      if (localEcho) {
        const ts = timestamp ? `[${new Date().toLocaleTimeString()}] ` : '';
        addLocalMessage(`${ts}>> ${command}`);
      }
    }
  };

  const resetESP32 = async () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please connect to a device first');
      return;
    }

    Alert.alert(
      'Reset ESP32?',
      'This will restart the ESP32 device. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const command = 'RESET:1';
            await bleService.sendData(command, !writeWithoutResponse);
            if (localEcho) {
              const ts = timestamp ? `[${new Date().toLocaleTimeString()}] ` : '';
              addLocalMessage(`${ts}>> ${command}`);
            }
          },
        },
      ]
    );
  };

  const sendCommand = async (command: string, showLocalEcho: boolean = true) => {
    if (!isConnected) {
      return;
    }

    // Show local echo if enabled
    if (localEcho && showLocalEcho) {
      const ts = timestamp ? `[${new Date().toLocaleTimeString()}] ` : '';
      addLocalMessage(`${ts}>> ${command}`);
    }

    // Build payload with line ending (like C# app)
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
    
    if (!success) {
      const ts = timestamp ? `[${new Date().toLocaleTimeString()}] ` : '';
      addLocalMessage(`${ts}ERROR: Failed to send command`);
    }
  };

  const handleSend = () => {
    if (inputText.trim() && isConnected) {
      sendCommand(inputText.trim());
      if (clearOnSend) {
        setInputText('');
      }
    }
  };

  const quickSend = (command: string) => {
    if (isConnected) {
      sendCommand(command);
    }
  };

  const handleCustomButton = (index: number) => {
    const button = customButtons[index];
    if (!button.command) {
      // If no command set, open config
      openButtonConfig(index);
      return;
    }

    if (button.justInsert) {
      // Just insert into text field
      setInputText(button.command);
    } else {
      // Send immediately
      sendCommand(button.command);
    }
  };

  const openButtonConfig = (index: number) => {
    const button = customButtons[index];
    setEditingButtonIndex(index);
    setTempButtonLabel(button.label);
    setTempButtonCommand(button.command);
    setTempButtonJustInsert(button.justInsert);
    setShowButtonConfig(true);
  };

  const saveButtonConfig = () => {
    if (editingButtonIndex !== null) {
      const newButtons = [...customButtons];
      newButtons[editingButtonIndex] = {
        label: tempButtonLabel || `Button ${editingButtonIndex + 1}`,
        command: tempButtonCommand,
        justInsert: tempButtonJustInsert,
      };
      setCustomButtons(newButtons);
      setShowButtonConfig(false);
      setEditingButtonIndex(null);
    }
  };

  const exportButtons = async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `BLE_Buttons_${timestamp}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(
        fileUri,
        JSON.stringify(customButtons, null, 2)
      );

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Button Configuration',
        });
      } else {
        Alert.alert('Success', `Buttons exported to ${fileName}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export buttons');
      console.error('Export error:', error);
    }
  };

  const exportLog = async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `BLE_Log_${timestamp}.txt`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      const logContent = allMessages.join('\n');
      await FileSystem.writeAsStringAsync(fileUri, logContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Export Console Log',
        });
      } else {
        Alert.alert('Success', `Log exported to ${fileName}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export log');
      console.error('Export error:', error);
    }
  };

  const clearAllMessages = () => {
    clearMessages();
    setLocalMessages([]);
  };

  const cycleLineEnding = () => {
    const endings: Array<'none' | 'lf' | 'cr' | 'crlf'> = ['none', 'lf', 'cr', 'crlf'];
    const currentIndex = endings.indexOf(lineEnding);
    const nextIndex = (currentIndex + 1) % endings.length;
    setLineEnding(endings[nextIndex]);
  };

  const getLineEndingLabel = () => {
    switch (lineEnding) {
      case 'lf': return 'LF';
      case 'cr': return 'CR';
      case 'crlf': return 'CR+LF';
      case 'none':
      default: return 'NONE';
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
        <View style={styles.headerLeft}>
          <Text style={styles.title}>🎮 Control Console</Text>
          {isConnected && (
            <Text style={styles.connectedDevice}>
              Connected: {connectedDeviceName}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={exportLog}
          >
            <Text style={styles.headerButtonText}>💾 Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={clearAllMessages}
          >
            <Text style={styles.headerButtonText}>🗑️ Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, isConnected ? styles.statusConnected : styles.statusDisconnected]} />
        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>

      {/* Settings Panel */}
      <View style={styles.settingsPanel}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Local Echo</Text>
          <Switch value={localEcho} onValueChange={setLocalEcho} />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Timestamp</Text>
          <Switch value={timestamp} onValueChange={setTimestamp} />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Clear on Send</Text>
          <Switch value={clearOnSend} onValueChange={setClearOnSend} />
        </View>
        <View style={styles.settingRow}>
          <TouchableOpacity style={styles.settingButton} onPress={cycleLineEnding}>
            <Text style={styles.settingButtonLabel}>Line End: {getLineEndingLabel()}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.settingButton} 
            onPress={() => setWriteWithoutResponse(!writeWithoutResponse)}
          >
            <Text style={styles.settingButtonLabel}>
              {writeWithoutResponse ? 'No Response' : 'With Response'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* LED Control Quick Buttons */}
      {isConnected && (
        <View style={styles.ledControlContainer}>
          <Text style={styles.ledControlTitle}>ESP32 Control</Text>
          <View style={styles.ledButtonsRow}>
            <TouchableOpacity
              style={[styles.ledButton, styles.ledButtonRed, redLedState && styles.ledButtonRedOn]}
              onPress={toggleRedLED}
            >
              <Text style={styles.ledButtonText}>🔴 Red LED</Text>
              <Text style={styles.ledButtonState}>{redLedState ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetESP32}
            >
              <Text style={styles.resetButtonText}>🔄 Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Message Console */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.console}
        contentContainerStyle={styles.consoleContent}
      >
        {allMessages.length === 0 ? (
          <Text style={styles.emptyText}>
            {isConnected
              ? 'Console ready. Send commands or wait for device responses.'
              : 'Connect to a device to start communication.'}
          </Text>
        ) : (
          allMessages.map((msg, index) => {
            const isTX = msg.includes('TX:') || msg.includes('>>');
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

      {/* Custom Buttons (10 buttons like C# app) */}
      {isConnected && (
        <View style={styles.customButtonsSection}>
          <View style={styles.customButtonsHeader}>
            <Text style={styles.customButtonsTitle}>Custom Commands</Text>
            <TouchableOpacity onPress={exportButtons}>
              <Text style={styles.exportButtonText}>Export Config</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.customButtonsGrid}>
            {customButtons.slice(0, 5).map((button, index) => (
              <TouchableOpacity
                key={index}
                style={styles.customButton}
                onPress={() => handleCustomButton(index)}
                onLongPress={() => openButtonConfig(index)}
              >
                <Text style={styles.customButtonText} numberOfLines={2}>
                  {button.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.customButtonsGrid}>
            {customButtons.slice(5, 10).map((button, index) => (
              <TouchableOpacity
                key={index + 5}
                style={styles.customButton}
                onPress={() => handleCustomButton(index + 5)}
                onLongPress={() => openButtonConfig(index + 5)}
              >
                <Text style={styles.customButtonText} numberOfLines={2}>
                  {button.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Input Section */}
      <View style={styles.inputSection}>
        <TextInput
          style={[styles.input, !isConnected && styles.inputDisabled]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={isConnected ? "Type command..." : "Connect to device first"}
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

      {/* Button Configuration Modal */}
      <Modal
        visible={showButtonConfig}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowButtonConfig(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Configure Button {editingButtonIndex !== null ? editingButtonIndex + 1 : ''}
            </Text>
            
            <Text style={styles.modalLabel}>Button Label:</Text>
            <TextInput
              style={styles.modalInput}
              value={tempButtonLabel}
              onChangeText={setTempButtonLabel}
              placeholder="Button Label"
            />
            
            <Text style={styles.modalLabel}>Command to Send:</Text>
            <TextInput
              style={styles.modalInput}
              value={tempButtonCommand}
              onChangeText={setTempButtonCommand}
              placeholder="Command (e.g., '1', 'sleep', etc.)"
            />
            
            <View style={styles.modalSwitchRow}>
              <Text style={styles.modalLabel}>Just Insert (don't send):</Text>
              <Switch value={tempButtonJustInsert} onValueChange={setTempButtonJustInsert} />
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowButtonConfig(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={saveButtonConfig}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  settingsPanel: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  ledControlContainer: {
    backgroundColor: '#1e293b',
    padding: 12,
    gap: 10,
  },
  ledControlTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  ledButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ledButton: {
    flex: 1,
    backgroundColor: '#334155',
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
  },
  ledButtonRed: {
    backgroundColor: '#7f1d1d',
    borderColor: '#991b1b',
  },
  ledButtonRedOn: {
    backgroundColor: '#dc2626',
    borderColor: '#ef4444',
  },
  ledButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  ledButtonState: {
    color: '#d1d5db',
    fontSize: 11,
    marginTop: 4,
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#b91c1c',
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#dc2626',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  settingButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginHorizontal: 4,
  },
  settingButtonLabel: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '600',
    textAlign: 'center',
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
  customButtonsSection: {
    backgroundColor: '#fff',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  customButtonsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customButtonsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  exportButtonText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  customButtonsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  customButton: {
    flex: 1,
    backgroundColor: '#8b5cf6',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  customButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  modalSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#6b7280',
  },
  modalButtonSave: {
    backgroundColor: '#3b82f6',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

