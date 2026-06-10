import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { COLORS } from '../constants/brand';
import { getProfile, getOnboardingDraft } from '../data/store';
import { isAnnualReviewDue } from '../ai/annualReview';
import { STEPS } from '../constants/steps';

import LandingScreen from '../screens/onboarding/LandingScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import SynthesisScreen from '../screens/onboarding/SynthesisScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import AnnualReviewScreen from '../screens/reprofile/AnnualReviewScreen';
import MainNavigator from './MainNavigator';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const [loading, setLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Landing');
  const [reviewProfile, setReviewProfile] = useState(null);
  const [onboardingDraft, setOnboardingDraft] = useState(null);
  const [synthesisDraft, setSynthesisDraft] = useState(null);

  useEffect(() => {
    getProfile().then(async (profile) => {
      if (!profile) {
        const draft = await getOnboardingDraft();
        const hasAnswers = draft && Object.values(draft).some(v => v !== undefined);
        if (hasAnswers) {
          const allAnswered = STEPS.every(s => draft[s.key] !== undefined);
          if (allAnswered) {
            setSynthesisDraft(draft);
            setInitialRoute('Synthesis');
          } else {
            setOnboardingDraft(draft);
            setInitialRoute('Onboarding');
          }
        } else {
          setInitialRoute('Landing');
        }
      } else {
        const due = await isAnnualReviewDue(profile);
        if (due) {
          setReviewProfile(profile);
          setInitialRoute('AnnualReview');
        } else {
          setInitialRoute('Main');
        }
      }
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
      {/* Landing — first screen for new users */}
      <Stack.Screen name="Landing" component={LandingScreen} />

      {/* Onboarding flow — always registered so we can navigate here after reset */}
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        initialParams={onboardingDraft ? { draft: onboardingDraft } : undefined}
      />
      <Stack.Screen
        name="Synthesis"
        component={SynthesisScreen}
        initialParams={synthesisDraft ? { profile: synthesisDraft } : undefined}
      />

      {/* Annual re-profile — shown when 365+ days since last review */}
      <Stack.Screen
        name="AnnualReview"
        component={AnnualReviewScreen}
        initialParams={reviewProfile ? { profile: reviewProfile } : undefined}
      />

      {/* Main app */}
      <Stack.Screen name="Main" component={MainNavigator} />

      {/* Profile — accessible from dashboard header */}
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}
