import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PsychologicalInsightScreen from '../screens/main/PsychologicalInsightScreen';
import GAD7Questionnaire from '../screens/questionnaires/GAD7Questionnaire';
import BAIQuestionnaire from '../screens/questionnaires/BAIQuestionnaire';
import BDIQuestionnaire from '../screens/questionnaires/BDIQuestionnaire';
import CFQQuestionnaire from '../screens/questionnaires/CFQQuestionnaire';
import PCL5Questionnaire from '../screens/questionnaires/PCL5Questionnaire';
import PHQ9Questionnaire from '../screens/questionnaires/PHQ9Questionnaire';
import PSQIQuestionnaire from '../screens/questionnaires/PSQIQuestionnaire';
import PSS10Questionnaire from '../screens/questionnaires/PSS10Questionnaire';
import QuestionnaireHistoryScreen from '../screens/main/QuestionnaireHistoryScreen';
import QuestionnaireHistoryDetailScreen from '../screens/main/QuestionnaireHistoryDetailScreen';

export type PsychologicalStackParamList = {
  PsychologicalHome: undefined;
  GAD7Questionnaire: undefined;
  BAIQuestionnaire: undefined;
  BDIQuestionnaire: undefined;
  CFQQuestionnaire: undefined;
  PCL5Questionnaire: undefined;
  PHQ9Questionnaire: undefined;
  PSQIQuestionnaire: undefined;
  PSS10Questionnaire: undefined;
  QuestionnaireHistory: {
    questionnaireType: string;
    questionnaireName: string;
  };
  QuestionnaireHistoryDetail: {
    questionnaireType: string;
    questionnaireName: string;
    resultId: string;
  };
};

const Stack = createNativeStackNavigator<PsychologicalStackParamList>();

export default function PsychologicalStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PsychologicalHome" component={PsychologicalInsightScreen} />
      <Stack.Screen name="GAD7Questionnaire" component={GAD7Questionnaire} />
      <Stack.Screen name="BAIQuestionnaire" component={BAIQuestionnaire} />
      <Stack.Screen name="BDIQuestionnaire" component={BDIQuestionnaire} />
      <Stack.Screen name="CFQQuestionnaire" component={CFQQuestionnaire} />
      <Stack.Screen name="PCL5Questionnaire" component={PCL5Questionnaire} />
      <Stack.Screen name="PHQ9Questionnaire" component={PHQ9Questionnaire} />
      <Stack.Screen name="PSQIQuestionnaire" component={PSQIQuestionnaire} />
      <Stack.Screen name="PSS10Questionnaire" component={PSS10Questionnaire} />
      <Stack.Screen name="QuestionnaireHistory" component={QuestionnaireHistoryScreen} />
      <Stack.Screen name="QuestionnaireHistoryDetail" component={QuestionnaireHistoryDetailScreen} />
    </Stack.Navigator>
  );
}
