import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SIZES, SPACING } from '../../constants/brand';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';

// STUB — Phase 1 build target
// Deploy mode is triggered when income arrives.
// User declares what they have, then works through allocating it intentionally.
// AI asks the right questions. Plan confirmed before a dollar is spent.

export default function DeployScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <StewardText style={styles.heading}>Deploy</StewardText>
        <StewardText style={styles.sub}>
          Income arrived? This is where you decide where it goes — before you spend a dollar.
        </StewardText>

        <StewardCard variant="outlined" style={styles.stub}>
          <StewardText style={styles.stubLabel}>COMING IN PHASE 1</StewardText>
          <StewardText style={styles.stubText}>
            The Deploy conversation guides you through allocating your income intentionally the moment it lands. Every bucket confirmed before you leave this screen.
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
