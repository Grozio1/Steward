import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOW } from '../../constants/brand';
import { generateSynthesis, generatePlan } from '../../ai/claude';
import { saveProfile, savePlan, currentMonth } from '../../data/store';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';
import FlameIcon from '../../components/FlameIcon';

export default function SynthesisScreen({ route, navigation }) {
  const { profile } = route.params;
  const [synthesis, setSynthesis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateSynthesis(profile).then((s) => {
      setSynthesis(s);
      setLoading(false);
    });
  }, []);

  const handleConfirm = async () => {
    // Save profile + generate + save plan
    await saveProfile(profile);
    const plan = await generatePlan(profile);
    await savePlan(plan, currentMonth());

    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const handleCorrect = () => {
    // Go back to beginning of onboarding
    navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <FlameIcon size={28} />
          <StewardText style={styles.wordmark}>Steward</StewardText>
        </View>

        <StewardText style={styles.intro}>
          Here's what I heard.
        </StewardText>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.forest} size="large" />
            <StewardText style={styles.loadingText}>Putting it together…</StewardText>
          </View>
        ) : synthesis ? (
          <>
            {/* Summary facts */}
            <StewardCard style={styles.summaryCard}>
              {synthesis.summary.map((line, i) => (
                <View key={i} style={styles.summaryRow}>
                  <View style={styles.summaryDot} />
                  <StewardText style={styles.summaryLine}>{line}</StewardText>
                </View>
              ))}
            </StewardCard>

            {/* Key insight — the one thing Steward flags */}
            <StewardCard variant="forest" style={styles.insightCard}>
              <StewardText style={styles.insightLabel}>THE THING I NOTICED</StewardText>
              <StewardText style={styles.insightText}>
                {synthesis.keyInsight}
              </StewardText>
            </StewardCard>

            <StewardText style={styles.confirmQuestion}>
              Does this look right?
            </StewardText>

            {/* Actions */}
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
              <StewardText style={styles.confirmBtnLabel}>Yes — build my plan</StewardText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.correctBtn} onPress={handleCorrect} activeOpacity={0.7}>
              <StewardText style={styles.correctBtnLabel}>Something's off — start over</StewardText>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.parchment,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  wordmark: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.lg,
    color: COLORS.forest,
  },
  intro: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xxl,
    color: COLORS.hearth,
    lineHeight: SIZES.xxl * 1.2,
    marginBottom: SPACING.sm,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
  },
  summaryCard: {
    gap: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  summaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.ember,
    marginTop: SPACING.sm - 1,
  },
  summaryLine: {
    flex: 1,
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    lineHeight: SIZES.base * 1.6,
  },
  insightCard: {
    gap: SPACING.sm,
  },
  insightLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.ember,
    letterSpacing: 1,
  },
  insightText: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.md,
    color: COLORS.white,
    lineHeight: SIZES.md * 1.65,
  },
  confirmQuestion: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xl,
    color: COLORS.hearth,
    marginTop: SPACING.sm,
  },
  confirmBtn: {
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOW.soft,
  },
  confirmBtnLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.md,
    color: COLORS.white,
  },
  correctBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  correctBtnLabel: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
    textDecorationLine: 'underline',
  },
});
