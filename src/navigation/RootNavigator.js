import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { COLORS } from '../constants/brand';
import { getProfile } from '../data/store';

import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import SynthesisScreen from '../screens/onboarding/SynthesisScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import MainNavigator from './MainNavigator';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const [loading, setLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Onboarding');

  useEffect(() => {
    getProfile().then((profile) => {
      setInitialRoute(profile ? 'Main' : 'Onboarding');
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.parchment }}>
        <ActivityIndicator color={COLORS.forest} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      {/* Onboarding flow */}
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Synthesis" component={SynthesisScreen} />

      {/* Main app */}
      <Stack.Screen name="Main" component={MainNavigator} />

      {/* Profile — modal slide from bottom */}
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}
