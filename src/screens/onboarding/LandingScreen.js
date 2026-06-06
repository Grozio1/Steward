import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOW } from '../../constants/brand';
import StewardText from '../../components/StewardText';

export default function LandingScreen({ navigation }) {
  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom', 'left', 'right']}>

      {/* Top spacer — positions mark at ~40% down */}
      <View style={{ flex: 5 }} />

      {/* Flame mark + wordmark */}
      <View style={s.markGroup}>
        <Image
          source={require('../../../assets/icon.png')}
          style={s.mark}
          resizeMode="contain"
        />
        <StewardText style={s.wordmark}>Steward</StewardText>
      </View>

      {/* Gap between wordmark and reframe line */}
      <View style={{ flex: 2 }} />

      {/* Reframe line */}
      <StewardText style={s.tagline}>
        Most budgeting apps track what you spent. Steward helps you decide what you're going to do with what you have.
      </StewardText>

      {/* Spacer to push button to bottom */}
      <View style={{ flex: 7 }} />

      {/* CTA */}
      <View style={s.footer}>
        <TouchableOpacity
          style={s.btn}
          onPress={() => navigation.navigate('Onboarding')}
          activeOpacity={0.85}
        >
          <StewardText style={s.btnLabel}>Let's begin</StewardText>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.parchment,
    paddingHorizontal: SPACING.xl,
  },

  markGroup: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  mark: {
    width: 72,
    height: 72,
  },
  wordmark: {
    fontFamily: FONTS.serif.bold,
    fontSize: 42,
    color: COLORS.hearth,
    letterSpacing: 0.5,
  },

  tagline: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    textAlign: 'center',
    lineHeight: SIZES.base * 1.9,
    opacity: 0.72,
  },

  footer: {
    paddingBottom: SPACING.lg,
  },
  btn: {
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    ...SHADOW.soft,
  },
  btnLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.white,
    letterSpacing: 0.4,
  },
});
