import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { saveQuestionnaireResult } from '../../firebase/dataLogger';

const FREQUENCY_OPTIONS = [
  { value: 0, label: 'Not during the past month' },
  { value: 1, label: 'Less than once a week' },
  { value: 2, label: 'Once or twice a week' },
  { value: 3, label: 'Three or more times a week' },
];

const QUALITY_OPTIONS = [
  { value: 0, label: 'Very good' },
  { value: 1, label: 'Fairly good' },
  { value: 2, label: 'Fairly bad' },
  { value: 3, label: 'Very bad' },
];

const ENTHUSIASM_OPTIONS = [
  { value: 0, label: 'No problem at all' },
  { value: 1, label: 'Only a very slight problem' },
  { value: 2, label: 'Somewhat of a problem' },
  { value: 3, label: 'A very big problem' },
];

const BED_PARTNER_OPTIONS = [
  { value: 0, label: 'No bed partner or room mate' },
  { value: 1, label: 'Partner/room mate in other room' },
  { value: 2, label: 'Partner in same room, but not same bed' },
  { value: 3, label: 'Partner in same bed' },
];

function FrequencyQuestion({ label, value, onChange }: { label: string; value: number | null; onChange: (val: number) => void }) {
  return (
    <View style={styles.frequencyQuestion}>
      <Text style={styles.subLabel}>{label}</Text>
      <View style={styles.optionsGrid}>
        {FREQUENCY_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.optionButton, value === option.value && styles.optionButtonSelected]}
            onPress={() => onChange(option.value)}>
            <View style={[styles.radio, value === option.value && styles.radioSelected]}>
              {value === option.value && <View style={styles.radioDot} />}
            </View>
            <Text style={[styles.optionLabel, value === option.value && styles.optionLabelSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function PSQIQuestionnaire({ navigation }: any) {
  const { user } = useAuth();
  const [bedTime, setBedTime] = useState('');
  const [minutesToSleep, setMinutesToSleep] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [hoursOfSleep, setHoursOfSleep] = useState('');

  const [q5a, setQ5a] = useState<number | null>(null);
  const [q5b, setQ5b] = useState<number | null>(null);
  const [q5c, setQ5c] = useState<number | null>(null);
  const [q5d, setQ5d] = useState<number | null>(null);
  const [q5e, setQ5e] = useState<number | null>(null);
  const [q5f, setQ5f] = useState<number | null>(null);
  const [q5g, setQ5g] = useState<number | null>(null);
  const [q5h, setQ5h] = useState<number | null>(null);
  const [q5i, setQ5i] = useState<number | null>(null);
  const [q5jText, setQ5jText] = useState('');
  const [q5j, setQ5j] = useState<number | null>(null);

  const [q6, setQ6] = useState<number | null>(null);
  const [q7, setQ7] = useState<number | null>(null);
  const [q8, setQ8] = useState<number | null>(null);
  const [q9, setQ9] = useState<number | null>(null);
  const [q10, setQ10] = useState<number | null>(null);
  const [q10a, setQ10a] = useState<number | null>(null);
  const [q10b, setQ10b] = useState<number | null>(null);
  const [q10c, setQ10c] = useState<number | null>(null);
  const [q10d, setQ10d] = useState<number | null>(null);
  const [q10eText, setQ10eText] = useState('');
  const [q10e, setQ10e] = useState<number | null>(null);

  const isComplete = () => {
    return (
      bedTime !== '' && minutesToSleep !== '' && wakeTime !== '' && hoursOfSleep !== '' &&
      q5a !== null && q5b !== null && q5c !== null && q5d !== null && q5e !== null &&
      q5f !== null && q5g !== null && q5h !== null && q5i !== null &&
      q6 !== null && q7 !== null && q8 !== null && q9 !== null && q10 !== null
    );
  };

  const handleSubmit = async () => {
    if (!isComplete()) {
      Alert.alert('Incomplete', 'Please answer all required questions before submitting.');
      return;
    }
    if (user) {
      try {
        await saveQuestionnaireResult(user.uid, {
          type: 'PSQI',
          score: 0,      // PSQI scoring is complex component-based; raw responses stored
          maxScore: 21,
          level: 'Recorded',
          responses: {
            q5a: q5a!, q5b: q5b!, q5c: q5c!, q5d: q5d!, q5e: q5e!,
            q5f: q5f!, q5g: q5g!, q5h: q5h!, q5i: q5i!,
            q6: q6!, q7: q7!, q8: q8!, q9: q9!, q10: q10!,
          },
          notes: `BedTime:${bedTime},MinToSleep:${minutesToSleep},WakeTime:${wakeTime},HoursSlept:${hoursOfSleep}`,
        });
      } catch (e) {
        console.error('[PSQI] Firebase save error:', e);
      }
    }
    Alert.alert(
      'PSQI Assessment Complete',
      'Your Pittsburgh Sleep Quality Index assessment has been recorded. A healthcare professional can help interpret your results for a comprehensive sleep quality evaluation.',
      [{ text: 'OK', onPress: () => navigation?.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PSQI Sleep Quality</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>Pittsburgh Sleep Quality Index</Text>
          <Text style={styles.aboutText}>
            The following questions relate to your usual sleep habits during the{' '}
            <Text style={styles.boldText}>past month only</Text>. Your answers should indicate the most accurate reply for the majority of days and nights in the past month.
          </Text>
        </View>

        {/* Basic Sleep Information */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Sleep Habits</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>1. What time have you usually gone to bed at night?</Text>
            <TextInput style={styles.textInput} value={bedTime} onChangeText={setBedTime} placeholder="e.g., 10:30 PM" placeholderTextColor="#9ca3af" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>2. How long (in minutes) has it usually taken you to fall asleep each night?</Text>
            <TextInput style={styles.textInput} value={minutesToSleep} onChangeText={setMinutesToSleep} placeholder="e.g., 15" keyboardType="numeric" placeholderTextColor="#9ca3af" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>3. What time have you usually gotten up in the morning?</Text>
            <TextInput style={styles.textInput} value={wakeTime} onChangeText={setWakeTime} placeholder="e.g., 6:30 AM" placeholderTextColor="#9ca3af" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>4. How many hours of actual sleep did you get at night?</Text>
            <Text style={styles.inputHint}>(This may be different than the number of hours you spent in bed)</Text>
            <TextInput style={styles.textInput} value={hoursOfSleep} onChangeText={setHoursOfSleep} placeholder="e.g., 7" keyboardType="numeric" placeholderTextColor="#9ca3af" />
          </View>
        </View>

        {/* Question 5 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>5. How often have you had trouble sleeping because you...</Text>
          <FrequencyQuestion label="a) Cannot get to sleep within 30 minutes" value={q5a} onChange={setQ5a} />
          <FrequencyQuestion label="b) Wake up in the middle of the night or early morning" value={q5b} onChange={setQ5b} />
          <FrequencyQuestion label="c) Have to get up to use the bathroom" value={q5c} onChange={setQ5c} />
          <FrequencyQuestion label="d) Cannot breathe comfortably" value={q5d} onChange={setQ5d} />
          <FrequencyQuestion label="e) Cough or snore loudly" value={q5e} onChange={setQ5e} />
          <FrequencyQuestion label="f) Feel too cold" value={q5f} onChange={setQ5f} />
          <FrequencyQuestion label="g) Feel too hot" value={q5g} onChange={setQ5g} />
          <FrequencyQuestion label="h) Had bad dreams" value={q5h} onChange={setQ5h} />
          <FrequencyQuestion label="i) Have pain" value={q5i} onChange={setQ5i} />
          <View style={styles.otherReasonGroup}>
            <Text style={styles.subLabel}>j) Other reason(s), please describe:</Text>
            <TextInput style={styles.textAreaInput} value={q5jText} onChangeText={setQ5jText} placeholder="Describe any other reasons..." multiline numberOfLines={2} placeholderTextColor="#9ca3af" />
            {q5jText !== '' && (
              <>
                <Text style={styles.subLabel}>How often during the past month?</Text>
                <View style={styles.optionsGrid}>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <TouchableOpacity key={option.value} style={[styles.optionButton, q5j === option.value && styles.optionButtonSelected]} onPress={() => setQ5j(option.value)}>
                      <View style={[styles.radio, q5j === option.value && styles.radioSelected]}>{q5j === option.value && <View style={styles.radioDot} />}</View>
                      <Text style={[styles.optionLabel, q5j === option.value && styles.optionLabelSelected]}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Question 6 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>6. How would you rate your sleep quality overall?</Text>
          <View style={styles.optionsGrid}>
            {QUALITY_OPTIONS.map((option) => (
              <TouchableOpacity key={option.value} style={[styles.optionButton, q6 === option.value && styles.optionButtonSelected]} onPress={() => setQ6(option.value)}>
                <View style={[styles.radio, q6 === option.value && styles.radioSelected]}>{q6 === option.value && <View style={styles.radioDot} />}</View>
                <Text style={[styles.optionLabel, q6 === option.value && styles.optionLabelSelected]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Question 7 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>7. How often have you taken medicine to help you sleep?</Text>
          <View style={styles.optionsGrid}>
            {FREQUENCY_OPTIONS.map((option) => (
              <TouchableOpacity key={option.value} style={[styles.optionButton, q7 === option.value && styles.optionButtonSelected]} onPress={() => setQ7(option.value)}>
                <View style={[styles.radio, q7 === option.value && styles.radioSelected]}>{q7 === option.value && <View style={styles.radioDot} />}</View>
                <Text style={[styles.optionLabel, q7 === option.value && styles.optionLabelSelected]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Question 8 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>8. How often have you had trouble staying awake while driving, eating meals, or engaging in social activity?</Text>
          <View style={styles.optionsGrid}>
            {FREQUENCY_OPTIONS.map((option) => (
              <TouchableOpacity key={option.value} style={[styles.optionButton, q8 === option.value && styles.optionButtonSelected]} onPress={() => setQ8(option.value)}>
                <View style={[styles.radio, q8 === option.value && styles.radioSelected]}>{q8 === option.value && <View style={styles.radioDot} />}</View>
                <Text style={[styles.optionLabel, q8 === option.value && styles.optionLabelSelected]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Question 9 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>9. How much of a problem has it been for you to keep up enough enthusiasm to get things done?</Text>
          <View style={styles.optionsGrid}>
            {ENTHUSIASM_OPTIONS.map((option) => (
              <TouchableOpacity key={option.value} style={[styles.optionButton, q9 === option.value && styles.optionButtonSelected]} onPress={() => setQ9(option.value)}>
                <View style={[styles.radio, q9 === option.value && styles.radioSelected]}>{q9 === option.value && <View style={styles.radioDot} />}</View>
                <Text style={[styles.optionLabel, q9 === option.value && styles.optionLabelSelected]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Question 10 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>10. Do you have a bed partner or room mate?</Text>
          <View style={styles.optionsGrid}>
            {BED_PARTNER_OPTIONS.map((option) => (
              <TouchableOpacity key={option.value} style={[styles.optionButton, q10 === option.value && styles.optionButtonSelected]} onPress={() => setQ10(option.value)}>
                <View style={[styles.radio, q10 === option.value && styles.radioSelected]}>{q10 === option.value && <View style={styles.radioDot} />}</View>
                <Text style={[styles.optionLabel, q10 === option.value && styles.optionLabelSelected]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {q10 !== null && q10 > 0 && (
            <View style={styles.partnerQuestionsCard}>
              <Text style={styles.partnerTitle}>If you have a room mate or bed partner, ask him/her how often you have had...</Text>
              <FrequencyQuestion label="a) Loud snoring" value={q10a} onChange={setQ10a} />
              <FrequencyQuestion label="b) Long pauses between breaths while asleep" value={q10b} onChange={setQ10b} />
              <FrequencyQuestion label="c) Legs twitching or jerking while you sleep" value={q10c} onChange={setQ10c} />
              <FrequencyQuestion label="d) Episodes of disorientation or confusion during sleep" value={q10d} onChange={setQ10d} />
              <View style={styles.otherReasonGroup}>
                <Text style={styles.subLabel}>e) Other restlessness while you sleep, please describe:</Text>
                <TextInput style={styles.textAreaInput} value={q10eText} onChangeText={setQ10eText} placeholder="Describe any other restlessness..." multiline numberOfLines={2} placeholderTextColor="#9ca3af" />
                {q10eText !== '' && (
                  <>
                    <Text style={styles.subLabel}>How often during the past month?</Text>
                    <View style={styles.optionsGrid}>
                      {FREQUENCY_OPTIONS.map((option) => (
                        <TouchableOpacity key={option.value} style={[styles.optionButton, q10e === option.value && styles.optionButtonSelected]} onPress={() => setQ10e(option.value)}>
                          <View style={[styles.radio, q10e === option.value && styles.radioSelected]}>{q10e === option.value && <View style={styles.radioDot} />}</View>
                          <Text style={[styles.optionLabel, q10e === option.value && styles.optionLabelSelected]}>{option.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, !isComplete() && styles.submitButtonDisabled]}
          onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>
            {isComplete() ? 'Submit Assessment' : 'Complete All Required Questions'}
          </Text>
        </TouchableOpacity>

        <View style={styles.referenceCard}>
          <Text style={styles.referenceText}>
            © 1989, University of Pittsburgh. Developed by Buysse, D.J., Reynolds, C.F., Monk, T.H., Berman, S.R., and Kupfer, D.J.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937', flex: 1 },
  container: { flex: 1, padding: 16 },
  aboutCard: { backgroundColor: '#dbeafe', padding: 16, borderRadius: 12, marginBottom: 16 },
  aboutTitle: { fontSize: 16, fontWeight: '600', color: '#1e40af', marginBottom: 8 },
  aboutText: { fontSize: 14, color: '#1e3a8a', lineHeight: 20 },
  boldText: { fontWeight: '700' },
  sectionCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 12, lineHeight: 22 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4, lineHeight: 20 },
  inputHint: { fontSize: 12, color: '#6b7280', marginBottom: 8, fontStyle: 'italic' },
  textInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 14, color: '#1f2937' },
  textAreaInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 14, color: '#1f2937', minHeight: 60, textAlignVertical: 'top', marginBottom: 12 },
  frequencyQuestion: { marginBottom: 20 },
  subLabel: { fontSize: 13, fontWeight: '500', color: '#4b5563', marginBottom: 8, lineHeight: 18 },
  optionsGrid: { gap: 8 },
  optionButton: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 8, backgroundColor: '#ffffff' },
  optionButtonSelected: { borderColor: '#5DADE2', backgroundColor: '#eff6ff' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#d1d5db', marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#5DADE2' },
  radioDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#5DADE2' },
  optionLabel: { fontSize: 13, color: '#374151', flex: 1 },
  optionLabelSelected: { color: '#1e40af', fontWeight: '600' },
  otherReasonGroup: { marginTop: 8 },
  partnerQuestionsCard: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  partnerTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 16, fontStyle: 'italic' },
  submitButton: { backgroundColor: '#5DADE2', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  submitButtonDisabled: { backgroundColor: '#d1d5db' },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  referenceCard: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 16 },
  referenceText: { fontSize: 10, color: '#6b7280', lineHeight: 14 },
  bottomPadding: { height: 32 },
});
