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
import { toMonthly } from '../../ai/stub';
import { classifyLifeStage } from '../../ai/classification';
import { saveProfile, savePlan, currentMonth, formatCurrency } from '../../data/store';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';
import FlameIcon from '../../components/FlameIcon';

// ─── Solvency calculator ───────────────────────────────────────────────────────
// solvent_with_room: floor ≤ income AND remainder ≥ 10% of income
// solvent_tight:     floor ≤ income AND remainder < 10% of income
// insolvent:         floor > income
function computeSolvency(profile) {
  const income = toMonthly(profile.netIncome, profile.payFrequency);
  const fixedTotal = (profile.fixedCommitments || []).reduce(
    (s, c) => s + Number(c.monthlyAmount || c.amount || 0), 0
  );
  const debtMinimums = (profile.debts || []).reduce((s, d) => s + Number(d.minimum || 0), 0);
  const totalRegular = (profile.regularExpenses || []).reduce(
    (s, r) => s + Number(r.monthlyEstimate || 0), 0
  );
  const floor = fixedTotal + debtMinimums + totalRegular;
  const remainder = income - floor;

  let state;
  if (floor > income) {
    state = 'insolvent';
  } else if (remainder < income * 0.10) {
    state = 'solvent_tight';
  } else {
    state = 'solvent_with_room';
  }

  return {
    state,
    remainder: Math.max(0, remainder),
    shortfall: Math.max(0, floor - income),
  };
}

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function SynthesisScreen({ route, navigation }) {
  const { profile } = route.params;
  const [synthesis, setSynthesis] = useState(null);
  const [loading, setLoading] = useState(true);

  const solvency = computeSolvency(profile);

  useEffect(() => {
    generateSynthesis(profile).then((s) => {
      setSynthesis(s);
      setLoading(false);
    });
  }, []);

  const handleConfirm = async () => {
    const { lifeStage, inTransition, classifiedAt } = classifyLifeStage(profile);
    const enrichedProfile = { ...profile, lifeStage, inTransition, lifeStageSetAt: classifiedAt };

    await saveProfile(enrichedProfile);
    const plan = await generatePlan(enrichedProfile);
    await savePlan(plan, currentMonth());

    if (solvency.state === 'insolvent') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main', params: { insolvencyDetected: true } }],
      });
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  };

  const handleCorrect = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  };

  const btnLabel = {
    solvent_with_room: 'Build my plan',
    solvent_tight: 'See my plan',
    insolvent: "Let's work on this",
  }[solvency.state];

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

        {/* ── State-specific hero ── */}

        {solvency.state === 'solvent_with_room' && (
          <>
            <StewardText style={[styles.heading, styles.headingGreen]}>
              Your foundation is solid.
            </StewardText>
            <StewardText style={styles.subline}>
              Here's what you have left to work with.
            </StewardText>
            <View style={styles.remainderRow}>
              <StewardText style={[styles.remainderAmount, styles.remainderGreen]}>
                {formatCurrency(solvency.remainder)}
              </StewardText>
              <StewardText style={styles.remainderPer}>/month</StewardText>
            </View>
          </>
        )}

        {solvency.state === 'solvent_tight' && (
          <>
            <StewardText style={styles.heading}>You're covered.</StewardText>
            <StewardText style={styles.subline}>
              There isn't much margin, but the essentials are met. Here's what that means.
            </StewardText>
            <View style={styles.remainderRow}>
              <StewardText style={styles.remainderAmount}>
                {formatCurrency(solvency.remainder)}
              </StewardText>
              <StewardText style={styles.remainderPer}>/month</StewardText>
            </View>
          </>
        )}

        {solvency.state === 'insolvent' && (
          <View style={styles.insolventCard}>
            <StewardText style={styles.insolventText}>
              Before we look at the plan, there's something worth naming. Your essential expenses are running ahead of your income by {formatCurrency(solvency.shortfall)}.
            </StewardText>
          </View>
        )}

        {/* ── AI synthesis bullets — shown for all states ── */}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.forest} size="large" />
            <StewardText style={styles.loadingText}>Putting it together…</StewardText>
          </View>
        ) : synthesis ? (
          <>
            <StewardCard style={styles.summaryCard}>
              {synthesis.summary.map((line, i) => (
                <View key={i} style={styles.summaryRow}>
                  <View style={styles.summaryDot} />
                  <StewardText style={styles.summaryLine}>{line}</StewardText>
                </View>
              ))}
            </StewardCard>

            <StewardCard variant="forest" style={styles.insightCard}>
              <StewardText style={styles.insightLabel}>THE THING I NOTICED</StewardText>
              <StewardText style={styles.insightText}>{synthesis.keyInsight}</StewardText>
            </StewardCard>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                solvency.state === 'insolvent' && styles.confirmBtnEmber,
              ]}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <StewardText style={styles.confirmBtnLabel}>{btnLabel}</StewardText>
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

  // ─── State-specific hero ─────────────────────────────────────────────────────
  heading: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xxl,
    color: COLORS.hearth,
    lineHeight: SIZES.xxl * 1.2,
  },
  headingGreen: {
    color: COLORS.forest,
  },
  subline: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
    lineHeight: SIZES.base * 1.6,
  },
  remainderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  remainderAmount: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xxxl,
    color: COLORS.hearth,
    lineHeight: SIZES.xxxl * 1.1,
  },
  remainderGreen: {
    color: COLORS.forest,
  },
  remainderPer: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
    paddingBottom: SPACING.xs,
  },
  insolventCard: {
    backgroundColor: COLORS.parchmentDark,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.ember,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  insolventText: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    lineHeight: SIZES.base * 1.7,
  },

  // ─── Synthesis bullets ───────────────────────────────────────────────────────
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

  // ─── Actions ─────────────────────────────────────────────────────────────────
  confirmBtn: {
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOW.soft,
  },
  confirmBtnEmber: {
    backgroundColor: COLORS.ember,
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
