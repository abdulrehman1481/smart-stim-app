import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { saveQuestionnaireResult } from '../../firebase/dataLogger';

const BDI_ITEMS = [
  { id: 1, options: ['I do not feel sad.', 'I feel sad', "I am sad all the time and I can't snap out of it.", "I am so sad and unhappy that I can't stand it."] },
  { id: 2, options: ['I am not particularly discouraged about the future.', 'I feel discouraged about the future.', 'I feel I have nothing to look forward to.', 'I feel the future is hopeless and that things cannot improve.'] },
  { id: 3, options: ['I do not feel like a failure.', 'I feel I have failed more than the average person.', 'As I look back on my life, all I can see is a lot of failures.', 'I feel I am a complete failure as a person.'] },
  { id: 4, options: ['I get as much satisfaction out of things as I used to.', "I don't enjoy things the way I used to.", "I don't get real satisfaction out of anything anymore.", 'I am dissatisfied or bored with everything.'] },
  { id: 5, options: ["I don't feel particularly guilty", 'I feel guilty a good part of the time.', 'I feel quite guilty most of the time.', 'I feel guilty all of the time.'] },
  { id: 6, options: ["I don't feel I am being punished.", 'I feel I may be punished.', 'I expect to be punished.', 'I feel I am being punished.'] },
  { id: 7, options: ["I don't feel disappointed in myself.", 'I am disappointed in myself.', 'I am disgusted with myself.', 'I hate myself.'] },
  { id: 8, options: ["I don't feel I am any worse than anybody else.", 'I am critical of myself for my weaknesses or mistakes.', 'I blame myself all the time for my faults.', 'I blame myself for everything bad that happens.'] },
  { id: 9, options: ["I don't have any thoughts of killing myself.", 'I have thoughts of killing myself, but I would not carry them out.', 'I would like to kill myself.', 'I would kill myself if I had the chance.'] },
  { id: 10, options: ["I don't cry any more than usual.", 'I cry more now than I used to.', 'I cry all the time now.', "I used to be able to cry, but now I can't cry even though I want to."] },
  { id: 11, options: ['I am no more irritated by things than I ever was.', 'I am slightly more irritated now than usual.', 'I am quite annoyed or irritated a good deal of the time.', 'I feel irritated all the time.'] },
  { id: 12, options: ['I have not lost interest in other people.', 'I am less interested in other people than I used to be.', 'I have lost most of my interest in other people.', 'I have lost all of my interest in other people.'] },
  { id: 13, options: ['I make decisions about as well as I ever could.', 'I put off making decisions more than I used to.', 'I have greater difficulty in making decisions more than I used to.', "I can't make decisions at all anymore."] },
  { id: 14, options: ["I don't feel that I look any worse than I used to.", 'I am worried that I am looking old or unattractive.', 'I feel there are permanent changes in my appearance that make me look unattractive', 'I believe that I look ugly.'] },
  { id: 15, options: ['I can work about as well as before.', 'It takes an extra effort to get started at doing something.', 'I have to push myself very hard to do anything.', "I can't do any work at all."] },
  { id: 16, options: ['I can sleep as well as usual.', "I don't sleep as well as I used to.", 'I wake up 1-2 hours earlier than usual and find it hard to get back to sleep.', 'I wake up several hours earlier than I used to and cannot get back to sleep.'] },
  { id: 17, options: ["I don't get more tired than usual.", 'I get tired more easily than I used to.', 'I get tired from doing almost anything.', 'I am too tired to do anything.'] },
  { id: 18, options: ['My appetite is no worse than usual.', 'My appetite is not as good as it used to be.', 'My appetite is much worse now.', 'I have no appetite at all anymore.'] },
  { id: 19, options: ["I haven't lost much weight, if any, lately.", 'I have lost more than five pounds.', 'I have lost more than ten pounds.', 'I have lost more than fifteen pounds.'] },
  { id: 20, options: ['I am no more worried about my health than usual.', 'I am worried about physical problems like aches, pains, upset stomach, or constipation.', "I am very worried about physical problems and it's hard to think of much else.", 'I am so worried about my physical problems that I cannot think of anything else.'] },
  { id: 21, options: ['I have not noticed any recent change in my interest in sex.', 'I am less interested in sex than I used to be.', 'I have almost no interest in sex.', 'I have lost interest in sex completely.'] },
];

export default function BDIQuestionnaire({ navigation }: any) {
  const { user } = useAuth();
  const [responses, setResponses] = useState<{ [key: number]: number }>({});

  const handleResponse = (itemId: number, value: number) => {
    setResponses(prev => ({ ...prev, [itemId]: value }));
  };

  const calculateScore = () => Object.values(responses).reduce((sum, value) => sum + value, 0);

  const getScoreInterpretation = (score: number) => {
    if (score <= 10) return { level: 'Normal', color: '#10b981', description: 'These ups and downs are considered normal.' };
    if (score <= 16) return { level: 'Mild Mood Disturbance', color: '#22c55e', description: 'You may be experiencing mild mood disturbances.' };
    if (score <= 20) return { level: 'Borderline Clinical Depression', color: '#f59e0b', description: 'You are showing signs of borderline clinical depression. Consider monitoring your symptoms.' };
    if (score <= 30) return { level: 'Moderate Depression', color: '#ef4444', description: 'You are experiencing moderate depression. It is recommended to consult with a healthcare professional.' };
    if (score <= 40) return { level: 'Severe Depression', color: '#dc2626', description: 'You are experiencing severe depression. Please seek professional help.' };
    return { level: 'Extreme Depression', color: '#991b1b', description: 'You are experiencing extreme depression. Please seek immediate professional help.' };
  };

  const isComplete = () => Object.keys(responses).length === BDI_ITEMS.length;

  const handleSubmit = async () => {
    if (!isComplete()) {
      Alert.alert('Incomplete', 'Please answer all questions before submitting.');
      return;
    }
    const score = calculateScore();
    const interpretation = getScoreInterpretation(score);
    if (user) {
      try {
        await saveQuestionnaireResult(user.uid, {
          type: 'BDI',
          score,
          maxScore: 63,
          level: interpretation.level,
          responses,
        });
      } catch (e) {
        console.error('[BDI] Firebase save error:', e);
      }
    }
    Alert.alert(
      "Beck's Depression Inventory Results",
      `Total Score: ${score}/63\n\n${interpretation.level}\n\n${interpretation.description}`,
      [{ text: 'OK', onPress: () => navigation?.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Beck's Depression Inventory</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About This Assessment</Text>
          <Text style={styles.aboutText}>
            Please read each group of statements carefully and pick out the one statement in each group that best describes the way you have been feeling during the past two weeks, including today.
          </Text>
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressText}>Progress: {Object.keys(responses).length} / {BDI_ITEMS.length}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(Object.keys(responses).length / BDI_ITEMS.length) * 100}%` }]} />
          </View>
        </View>

        {BDI_ITEMS.map((item, index) => (
          <View key={item.id} style={styles.questionCard}>
            <Text style={styles.questionNumber}>{index + 1}.</Text>
            <View style={styles.optionsContainer}>
              {item.options.map((option, optionIndex) => (
                <TouchableOpacity
                  key={optionIndex}
                  style={[styles.optionButton, responses[item.id] === optionIndex && styles.optionButtonSelected]}
                  onPress={() => handleResponse(item.id, optionIndex)}>
                  <View style={styles.optionContent}>
                    <View style={[styles.radio, responses[item.id] === optionIndex && styles.radioSelected]}>
                      {responses[item.id] === optionIndex && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text style={[styles.optionLabel, responses[item.id] === optionIndex && styles.optionLabelSelected]}>
                        {option}
                      </Text>
                      <Text style={styles.optionValue}>Score: {optionIndex}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.submitButton, !isComplete() && styles.submitButtonDisabled]}
          onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>
            {isComplete() ? 'Submit Assessment' : `Complete All Questions (${Object.keys(responses).length}/${BDI_ITEMS.length})`}
          </Text>
        </TouchableOpacity>

        <View style={styles.scoringCard}>
          <Text style={styles.scoringTitle}>Interpreting Your Score</Text>
          {[
            { color: '#10b981', text: '1-10: Normal ups and downs' },
            { color: '#22c55e', text: '11-16: Mild mood disturbance' },
            { color: '#f59e0b', text: '17-20: Borderline clinical depression' },
            { color: '#ef4444', text: '21-30: Moderate depression' },
            { color: '#dc2626', text: '31-40: Severe depression' },
            { color: '#991b1b', text: 'Over 40: Extreme depression' },
          ].map((item, i) => (
            <View key={i} style={styles.scoringItem}>
              <View style={[styles.scoringDot, { backgroundColor: item.color }]} />
              <Text style={styles.scoringText}>{item.text}</Text>
            </View>
          ))}
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
  progressCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  progressText: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#5DADE2', borderRadius: 4 },
  questionCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  questionNumber: { fontSize: 18, fontWeight: '700', color: '#5DADE2', marginBottom: 12 },
  optionsContainer: { gap: 8 },
  optionButton: { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, backgroundColor: '#ffffff' },
  optionButtonSelected: { borderColor: '#5DADE2', backgroundColor: '#eff6ff' },
  optionContent: { flexDirection: 'row', alignItems: 'flex-start' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#d1d5db', marginRight: 12, marginTop: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioSelected: { borderColor: '#5DADE2' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#5DADE2' },
  optionTextContainer: { flex: 1 },
  optionLabel: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 4 },
  optionLabelSelected: { color: '#1e40af', fontWeight: '600' },
  optionValue: { fontSize: 12, color: '#6b7280' },
  submitButton: { backgroundColor: '#5DADE2', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  submitButtonDisabled: { backgroundColor: '#d1d5db' },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  scoringCard: { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 12, marginBottom: 16 },
  scoringTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 12 },
  scoringItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  scoringDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  scoringText: { fontSize: 13, color: '#4b5563' },
  bottomPadding: { height: 32 },
});
