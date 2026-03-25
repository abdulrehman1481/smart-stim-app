import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Alert, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceScanner } from "../components/DeviceScanner";
import { ComprehensiveStimPanel } from "../components/ComprehensiveStimPanel";
import { WristbandSensorsPanel } from "../components/WristbandSensorsPanel";
import { TemperatureMonitor } from "../components/TemperatureMonitor";
import { SensorLogsMonitor } from "../components/SensorLogsMonitor";
import { MAX30101Monitor } from "../components/MAX30101Monitor";
import { LSM6DSOMonitor } from "../components/LSM6DSOMonitor";
import { ADS1113Monitor } from "../components/ADS1113Monitor";
import { W25N01Monitor } from "../components/W25N01Monitor";
import { FirebaseTestScreen } from "./FirebaseTestScreen";
import { useAuth } from "../auth/AuthContext";
import { theme } from "../styles/theme";

const Tab = createBottomTabNavigator();

// App Header with Logout
function AppHeader() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert("Error", "Failed to logout");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.appHeader, { paddingTop: insets.top + theme.spacing.sm }]}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          <Text style={styles.appTitle}>⚡ Smart Stim</Text>
          <Text style={styles.appSubtitle}>
            {user?.email || "BLE Device Control"}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.7}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Wrapper for each screen to include header
function ScreenWrapper({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <AppHeader />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textLight,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 0,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 8,
          paddingTop: 8,
          height: (insets.bottom > 0 ? insets.bottom : 0) + 64,
          ...theme.shadows.lg,
        },
      }}
    >
      <Tab.Screen
        name="Devices"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
              <Text style={{ fontSize: 22 }}>📡</Text>
            </View>
          ),
        }}
      >
        {() => (
          <ScreenWrapper>
            <DeviceScanner />
          </ScreenWrapper>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Stim"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
              <Text style={{ fontSize: 22 }}>⚡</Text>
            </View>
          ),
        }}
      >
        {() => (
          <ScreenWrapper>
            <ComprehensiveStimPanel />
          </ScreenWrapper>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Sensors"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
              <Text style={{ fontSize: 22 }}>🌊</Text>
            </View>
          ),
        }}
      >
        {() => (
          <ScreenWrapper>
            <WristbandSensorsPanel />
          </ScreenWrapper>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Temp"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
              <Text style={{ fontSize: 22 }}>🌡️</Text>
            </View>
          ),
          tabBarLabel: "Temp",
        }}
      >
        {() => (
          <ScreenWrapper>
            <TemperatureMonitor />
          </ScreenWrapper>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Logs"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
              <Text style={{ fontSize: 22 }}>📋</Text>
            </View>
          ),
          tabBarLabel: "Logs",
        }}
      >
        {() => (
          <ScreenWrapper>
            <SensorLogsMonitor />
          </ScreenWrapper>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="PPG"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
              <Text style={{ fontSize: 22 }}>❤️</Text>
            </View>
          ),
          tabBarLabel: "PPG",
        }}
      >
        {() => (
          <ScreenWrapper>
            <MAX30101Monitor />
          </ScreenWrapper>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="IMU"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
              <Text style={{ fontSize: 22 }}>📐</Text>
            </View>
          ),
          tabBarLabel: "IMU",
        }}
      >
        {() => (
          <ScreenWrapper>
            <LSM6DSOMonitor />
          </ScreenWrapper>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="EDA"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
              <Text style={{ fontSize: 22 }}>🧘</Text>
            </View>
          ),
          tabBarLabel: "EDA",
        }}
      >
        {() => (
          <ScreenWrapper>
            <ADS1113Monitor />
          </ScreenWrapper>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Flash"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
              <Text style={{ fontSize: 22 }}>💾</Text>
            </View>
          ),
          tabBarLabel: "Flash",
        }}
      >
        {() => (
          <ScreenWrapper>
            <W25N01Monitor />
          </ScreenWrapper>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Test"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
              <Text style={{ fontSize: 22 }}>🧪</Text>
            </View>
          ),
          tabBarLabel: "Test",
        }}
      >
        {() => (
          <ScreenWrapper>
            <FirebaseTestScreen />
          </ScreenWrapper>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
  },
  appHeader: {
    backgroundColor: theme.colors.primary,
    paddingBottom: theme.spacing.base,
    ...theme.shadows.md,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  appTitle: {
    color: theme.colors.textInverse,
    ...theme.typography.h2,
    letterSpacing: 0.5,
  },
  appSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    ...theme.typography.caption,
    marginTop: theme.spacing.xs,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoutText: {
    color: theme.colors.textInverse,
    ...theme.typography.bodySmall,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
  },
  tabIconFocused: {
    backgroundColor: `${theme.colors.primary}15`,
  },
});
