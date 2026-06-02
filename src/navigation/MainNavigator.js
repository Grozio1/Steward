import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { COLORS, FONTS, SIZES, SPACING } from '../constants/brand';

import DashboardScreen from '../screens/dashboard/DashboardScreen';
import DeployScreen from '../screens/deploy/DeployScreen';
import DecideScreen from '../screens/decide/DecideScreen';
import NavigateScreen from '../screens/navigate/NavigateScreen';
import StewardText from '../components/StewardText';

const Tab = createBottomTabNavigator();

// Simple icon using text glyphs — replace with icon library in production
function TabIcon({ label, focused }) {
  const icons = {
    Dashboard: focused ? '▣' : '□',
    Deploy:    focused ? '◈' : '◇',
    Decide:    focused ? '⬡' : '⬡',
    Navigate:  focused ? '◉' : '○',
  };
  return (
    <StewardText
      style={{
        fontSize: SIZES.lg,
        color: focused ? COLORS.forest : COLORS.placeholder,
        lineHeight: SIZES.lg * 1.2,
      }}
    >
      {icons[label] || '·'}
    </StewardText>
  );
}

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.forest,
        tabBarInactiveTintColor: COLORS.placeholder,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Deploy"    component={DeployScreen} />
      <Tab.Screen name="Decide"    component={DecideScreen} />
      <Tab.Screen name="Navigate"  component={NavigateScreen} />
    </Tab.Navigator>
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
