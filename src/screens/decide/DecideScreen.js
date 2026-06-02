import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SIZES, SPACING } from '../../constants/brand';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';

// STUB — Phase 1 build target
// Decide mode is triggered at a spending moment.
// User brings a purchase to Steward. AI shows full impact (before/after),
// presents 2-3 paths with honest tradeoffs, asks one question.
// No chat interface — structured UI with a single AI-generated insight line.

export default function DecideScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <StewardText style={styles.heading}>Decide</StewardText>
        <StewardText style={styles.sub}>
          About to spend? Bring it here first. See what it actually means before you commit.
        </StewardText>

        <StewardCard variant="outlined" style={styles.stub}>
          <StewardText style={styles.stubLabel}>COMING IN PHASE 1</StewardText>
          <StewardText style={styles.stubText}>
            Enter a purchase amount. Steward shows you the before/after on your plan, presents two or three honest paths, and surfaces one insight. No chat. No lecture. Just clarity.
          </StewardText>
        </StewardCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.parchment },
  content: { flex: 1, padding: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },
  heading: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xxl,
    color: COLORS.hearth,
    lineHeight: SIZES.xxl * 1.4,
  },
  sub: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
    lineHeight: SIZES.base * 1.6,
  },
  stub: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  stubLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.ember,
    letterSpacing: 1,
  },
  stubText: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
    lineHeight: SIZES.sm * 1.6,
  },
});
