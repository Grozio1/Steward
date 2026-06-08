import React, { useState, useEffect } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES, SPACING } from '../constants/brand';
import { getActiveCrises, getProfile } from '../data/store';

const isPayDayToday = (profile) => {
  if (!profile?.nextPayDate) return false;
  const today = new Date().getDate();
  const payDay = parseInt(profile.nextPayDate);
  return !isNaN(payDay) && today === payDay;
};

import DashboardScreen from '../screens/dashboard/DashboardScreen';
import DeployScreen from '../screens/deploy/DeployScreen';
import DecideScreen from '../screens/decide/DecideScreen';
import NavigateScreen from '../screens/navigate/NavigateScreen';
import BiographyScreen from '../screens/biography/BiographyScreen';
import PeerBenchmarkScreen from '../screens/benchmark/PeerBenchmarkScreen';
import RetirementScreen from '../screens/retirement/RetirementScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  Dashboard: { default: 'grid-outline',        focused: 'grid' },
  Deploy:    { default: 'paper-plane-outline',  focused: 'paper-plane' },
  Decide:    { default: 'help-circle-outline',  focused: 'help-circle' },
  Navigate:  { default: 'compass-outline',      focused: 'compass' },
};

function Tabs() {
  const [dueCount, setDueCount] = useState(0);
  const [profile, setProfile] = useState(null);

  const checkDue = async () => {
    const crises = await getActiveCrises();
    const count = crises.filter((c) => {
      const ref = c.lastCheckedIn || c.startDate;
      return Math.floor((Date.now() - new Date(ref)) / 86400000) >= c.checkInDays;
    }).length;
    setDueCount(count);
  };

  useEffect(() => {
    checkDue();
    getProfile().then(setProfile);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkDue();
        getProfile().then(setProfile);
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.forest,
        tabBarInactiveTintColor: COLORS.placeholder,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.focused : icons.default;
          const icon = <Ionicons name={iconName} size={22} color={color} />;
          if (route.name === 'Deploy' && isPayDayToday(profile)) {
            return (
              <View style={{ position: 'relative' }}>
                {icon}
                <View style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: COLORS.ember,
                  position: 'absolute', top: -2, right: -6,
                }} />
              </View>
            );
          }
          return icon;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Deploy"    component={DeployScreen} />
      <Tab.Screen name="Decide"    component={DecideScreen} />
      <Tab.Screen
        name="Navigate"
        component={NavigateScreen}
        options={{
          tabBarBadge: dueCount > 0 ? dueCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.ember, fontSize: 10 },
        }}
        listeners={{ tabPress: checkDue }}
      />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen
        name="Biography"
        component={BiographyScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Retirement"
        component={RetirementScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.white,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingTop: SPACING.xs,
    height: 64,
  },
  tabLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    letterSpacing: 0.3,
    marginBottom: SPACING.xs,
  },
});
