import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/main/HomeScreen';
import PhysiologicalInsightScreen from '../screens/main/PhysiologicalInsightScreen';
import StimulationScreen from '../screens/main/StimulationScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import PsychologicalStack from './PsychologicalStack';

export type MainTabsParamList = {
  Home: undefined;
  Physiological: undefined;
  Stimulation: undefined;
  Psychological: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

export default function MainTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#5DADE2',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e5e7eb',
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Physiological') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'Stimulation') {
            iconName = focused ? 'musical-notes' : 'musical-notes-outline';
          } else if (route.name === 'Psychological') {
            iconName = focused ? 'brain' : 'brain-outline' as any;
            // Ionicons doesn't have brain; fallback to headset
            iconName = focused ? 'headset' : 'headset-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Physiological" component={PhysiologicalInsightScreen} options={{ title: 'Physical' }} />
      <Tab.Screen name="Stimulation" component={StimulationScreen} options={{ title: 'Stimulation' }} />
      <Tab.Screen name="Psychological" component={PsychologicalStack} options={{ title: 'Mental' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}
