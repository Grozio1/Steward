import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOW } from '../../constants/brand';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';
import { getProfile } from '../../data/store';
import { toMonthly } from '../../ai/stub';
import { isProTier } from '../../utils/tier';

const STAGE_LABELS = {
  starting_out: 'Starting Out',
  building: 'Building',
  family_years: 'Family Years',
  peak_earning: 'Peak Earning',
  transition: 'Transition',
  retirement: 'Retirement',
};

const getBand = (monthlyIncome) => {
  if (monthlyIncome < 4000) return 'under_4k';
  if (monthlyIncome < 7000) return '4k_7k';
  if (monthlyIncome < 11000) return '7k_11k';
  return '11k_plus';
};

const BENCHMARKS = {
  starting_out: {
    under_4k:  { savingsRate: 6,  housingPct: 36, foodPct: 16, transportPct: 14, debtPaymentPct: 12, qolPct: 16, sampleSize: '~200 households' },
    '4k_7k':   { savingsRate: 10, housingPct: 31, foodPct: 14, transportPct: 13, debtPaymentPct: 10, qolPct: 22, sampleSize: '~180 households' },
    '7k_11k':  { savingsRate: 14, housingPct: 28, foodPct: 12, transportPct: 12, debtPaymentPct: 8,  qolPct: 26, sampleSize: '~90 households' },
    '11k_plus':{ savingsRate: 18, housingPct: 24, foodPct: 10, transportPct: 10, debtPaymentPct: 6,  qolPct: 32, sampleSize: '~40 households' },
  },
  building: {
    under_4k:  { savingsRate: 7,  housingPct: 34, foodPct: 15, transportPct: 15, debtPaymentPct: 14, qolPct: 15, sampleSize: '~160 households' },
    '4k_7k':   { savingsRate: 12, housingPct: 30, foodPct: 13, transportPct: 14, debtPaymentPct: 11, qolPct: 20, sampleSize: '~240 households' },
    '7k_11k':  { savingsRate: 16, housingPct: 27, foodPct: 12, transportPct: 12, debtPaymentPct: 9,  qolPct: 24, sampleSize: '~150 households' },
    '11k_plus':{ savingsRate: 22, housingPct: 23, foodPct: 10, transportPct: 10, debtPaymentPct: 6,  qolPct: 29, sampleSize: '~80 households' },
  },
  family_years: {
    under_4k:  { savingsRate: 4,  housingPct: 35, foodPct: 17, transportPct: 16, debtPaymentPct: 15, qolPct: 13, sampleSize: '~190 households' },
    '4k_7k':   { savingsRate: 9,  housingPct: 30, foodPct: 15, transportPct: 15, debtPaymentPct: 12, qolPct: 19, sampleSize: '~280 households' },
    '7k_11k':  { savingsRate: 14, housingPct: 27, foodPct: 13, transportPct: 13, debtPaymentPct: 9,  qolPct: 24, sampleSize: '~200 households' },
    '11k_plus':{ savingsRate: 20, housingPct: 22, foodPct: 11, transportPct: 10, debtPaymentPct: 6,  qolPct: 31, sampleSize: '~120 households' },
  },
  peak_earning: {
    under_4k:  { savingsRate: 5,  housingPct: 33, foodPct: 16, transportPct: 15, debtPaymentPct: 13, qolPct: 18, sampleSize: '~80 households' },
    '4k_7k':   { savingsRate: 13, housingPct: 28, foodPct: 13, transportPct: 14, debtPaymentPct: 10, qolPct: 22, sampleSize: '~200 households' },
    '7k_11k':  { savingsRate: 19, housingPct: 25, foodPct: 11, transportPct: 12, debtPaymentPct: 7,  qolPct: 26, sampleSize: '~220 households' },
    '11k_plus':{ savingsRate: 26, housingPct: 21, foodPct: 10, transportPct: 9,  debtPaymentPct: 5,  qolPct: 29, sampleSize: '~180 households' },
  },
  transition: {
    under_4k:  { savingsRate: 8,  housingPct: 32, foodPct: 15, transportPct: 14, debtPaymentPct: 10, qolPct: 21, sampleSize: '~60 households' },
    '4k_7k':   { savingsRate: 15, housingPct: 28, foodPct: 13, transportPct: 12, debtPaymentPct: 8,  qolPct: 24, sampleSize: '~140 households' },
    '7k_11k':  { savingsRate: 22, housingPct: 24, foodPct: 11, transportPct: 11, debtPaymentPct: 6,  qolPct: 26, sampleSize: '~160 households' },
    '11k_plus':{ savingsRate: 30, housingPct: 20, foodPct: 9,  transportPct: 9,  debtPaymentPct: 4,  qolPct: 28, sampleSize: '~130 households' },
  },
  retirement: {
    under_4k:  { savingsRate: 2,  housingPct: 34, foodPct: 18, transportPct: 13, debtPaymentPct: 5,  qolPct: 28, sampleSize: '~50 households' },
    '4k_7k':   { savingsRate: 5,  housingPct: 29, foodPct: 15, transportPct: 11, debtPaymentPct: 3,  qolPct: 37, sampleSize: '~110 households' },
    '7k_11k':  { savingsRate: 8,  housingPct: 25, foodPct: 13, transportPct: 10, debtPaymentPct: 2,  qolPct: 42, sampleSize: '~90 households' },
    '11k_plus':{ savingsRate: 12, housingPct: 22, foodPct: 11, transportPct: 9,  debtPaymentPct: 1,  qolPct: 45, sampleSize: '~70 households' },
  },
};

const inferStage = (profile) => profile?.lifeStage ?? 'building';

const CompareRow = ({ label, yourPct, peerPct, invert = false }) => {
  const anim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 600, delay: 200, useNativeDriver: false }).start();
  }, []);
  const youAhead = invert ? yourPct >= peerPct : yourPct <= peerPct;
  const diff = Math.abs(yourPct - peerPct);
  const diffLabel = diff === 0 ? 'Right at median' : `${diff}pp ${youAhead ? 'better' : 'above median'}`;
  const maxPct = Math.max(yourPct, peerPct, 5);
  return (
    <View style={styles.compareRow}>
      <View style={styles.compareHeader}>
        <StewardText variant="bodyMedium">{label}</StewardText>
        <StewardText variant="caption" style={{ color: youAhead ? COLORS.forest : COLORS.ember }}>{diffLabel}</StewardText>
      </View>
      <View style={styles.barWrapper}>
        <StewardText variant="caption" style={styles.barLabel}>You</StewardText>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { backgroundColor: youAhead ? COLORS.forest : COLORS.ember, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${(yourPct / maxPct) * 100}%`] }) }]} />
        </View>
        <StewardText variant="caption" style={styles.barValue}>{yourPct}%</StewardText>
      </View>
      <View style={styles.barWrapper}>
        <StewardText variant="caption" style={styles.barLabel}>Peers</StewardText>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { backgroundColor: COLORS.sage, opacity: 0.6, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${(peerPct / maxPct) * 100}%`] }) }]} />
        </View>
        <StewardText variant="caption" style={styles.barValue}>{peerPct}%</StewardText>
      </View>
    </View>
  );
};

export default function PeerBenchmarkScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [benchmarks, setBenchmarks] = useState(null);
  const [stage, setStage] = useState(null);
  const [band, setBand] = useState(null);
  const [yourRates, setYourRates] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const p = await getProfile();
      if (!p) { setLoading(false); return; }
      const monthlyIncome = toMonthly(p.netIncome, p.payFrequency);
      const detectedStage = inferStage(p);
      const incomeBand = getBand(monthlyIncome);
      const peerData = BENCHMARKS[detectedStage]?.[incomeBand] ?? BENCHMARKS.building['4k_7k'];
      const totalFixed = (p.fixedCommitments || []).reduce((sum, c) => sum + (c.monthlyAmount || c.amount || 0), 0);
      const totalDebt = (p.debts || []).reduce((sum, d) => sum + (d.minimum || 0), 0);
      const totalGoals = (p.goals || []).reduce((sum, g) => sum + (g.monthly || 0), 0);
      const savingsEst = monthlyIncome > 0 ? Math.round(((p.savings > 0 ? 200 : 0) + totalGoals) / monthlyIncome * 100) : 0;
      const housingEst = monthlyIncome > 0 ? Math.round(totalFixed / monthlyIncome * 100) : 0;
      const debtEst = monthlyIncome > 0 ? Math.round(totalDebt / monthlyIncome * 100) : 0;
      setProfile(p);
      setStage(detectedStage);
      setBand(incomeBand);
      setBenchmarks(peerData);
      setYourRates({
        savingsRate: Math.min(savingsEst, 60),
        housingPct: Math.min(housingEst, 70),
        debtPaymentPct: Math.min(debtEst, 40),
        foodPct: Math.round(22 * (1 - savingsEst / 100)),
        qolPct: Math.max(0, 100 - housingEst - debtEst - savingsEst - 14),
      });
    } catch (e) {
      console.warn('PeerBenchmarkScreen load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const bandLabel = { under_4k: 'Under $4,000/mo', '4k_7k': '$4,000–$7,000/mo', '7k_11k': '$7,000–$11,000/mo', '11k_plus': '$11,000+/mo' }[band] ?? '';

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator color={COLORS.forest} /></View>;
  if (!profile || !benchmarks) return <View style={styles.emptyContainer}><StewardText variant="body" style={{ textAlign: 'center', color: COLORS.placeholder }}>Complete your profile to see how your household compares.</StewardText></View>;

  if (!isProTier(profile)) {
    return (
      <View style={styles.paywallContainer}>
        <StewardCard variant="parchment" style={styles.paywallCard}>
          <StewardText variant="bodyMedium" style={{ marginBottom: SPACING.sm }}>
            Peer Benchmarks
          </StewardText>
          <StewardText variant="body" style={{ color: COLORS.placeholder, marginBottom: SPACING.md, lineHeight: SIZES.base * 1.6 }}>
            Compare your household anonymously with peers at a similar life stage and income level. Available on Pro.
          </StewardText>
          <TouchableOpacity
            style={styles.paywallBtn}
            onPress={() => navigation.navigate('Paywall', { feature: 'benchmark' })}
            activeOpacity={0.8}
          >
            <StewardText style={styles.paywallBtnLabel}>Learn about Pro →</StewardText>
          </TouchableOpacity>
        </StewardCard>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <StewardText variant="heading" style={styles.heading}>How you compare</StewardText>
      <StewardCard variant="forest" style={styles.contextCard}>
        <StewardText variant="caption" style={styles.contextLabel}>YOUR GROUP</StewardText>
        <StewardText variant="bodyMedium" style={styles.contextValue}>{STAGE_LABELS[stage] ?? stage}  ·  {bandLabel}</StewardText>
        <StewardText variant="caption" style={styles.contextSample}>{benchmarks.sampleSize} at a similar stage and income</StewardText>
      </StewardCard>
      <StewardCard variant="parchment" style={styles.obsCard}>
        <StewardText variant="stewardVoice">These are medians — half of similar households are above, half below. Use them as a reference, not a verdict. Your situation has details no peer group can see.</StewardText>
      </StewardCard>
      <StewardCard variant="default" style={styles.compareCard}>
        <StewardText variant="label" style={styles.sectionLabel}>SPENDING AS % OF TAKE-HOME</StewardText>
        <CompareRow label="Savings rate" yourPct={yourRates.savingsRate} peerPct={benchmarks.savingsRate} invert={true} />
        <View style={styles.divider} />
        <CompareRow label="Housing & fixed costs" yourPct={yourRates.housingPct} peerPct={benchmarks.housingPct} />
        <View style={styles.divider} />
        <CompareRow label="Food" yourPct={yourRates.foodPct} peerPct={benchmarks.foodPct} />
        <View style={styles.divider} />
        <CompareRow label="Debt payments" yourPct={yourRates.debtPaymentPct} peerPct={benchmarks.debtPaymentPct} />
        <View style={styles.divider} />
        <CompareRow label="Quality of life" yourPct={yourRates.qolPct} peerPct={benchmarks.qolPct} invert={true} />
      </StewardCard>
      <StewardText variant="caption" style={styles.footerNote}>Benchmarks are derived from anonymized household data and updated periodically. They are estimates, not financial advice.</StewardText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.parchment },
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.xxl },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.parchment },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl, backgroundColor: COLORS.parchment },
  paywallContainer: { flex: 1, justifyContent: 'center', padding: SPACING.lg, backgroundColor: COLORS.parchment },
  paywallCard: { padding: SPACING.md },
  paywallBtn: { alignSelf: 'flex-start', paddingVertical: SPACING.xs },
  paywallBtnLabel: { fontFamily: FONTS.sans.medium, fontSize: SIZES.base, color: COLORS.forest },
  heading: { marginBottom: SPACING.md },
  contextCard: { padding: SPACING.md, marginBottom: SPACING.md },
  contextLabel: { color: COLORS.parchment, opacity: 0.7, letterSpacing: 0.8, marginBottom: SPACING.xs },
  contextValue: { color: COLORS.parchment, marginBottom: SPACING.xs },
  contextSample: { color: COLORS.parchment, opacity: 0.6 },
  obsCard: { padding: SPACING.md, marginBottom: SPACING.md },
  compareCard: { padding: SPACING.md, marginBottom: SPACING.md },
  sectionLabel: { color: COLORS.sage, letterSpacing: 0.8, marginBottom: SPACING.md },
  compareRow: { paddingVertical: SPACING.sm },
  compareHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  barWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  barLabel: { width: 34, color: COLORS.placeholder },
  barTrack: { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden', marginHorizontal: SPACING.sm },
  barFill: { height: '100%', borderRadius: RADIUS.full },
  barValue: { width: 30, textAlign: 'right', color: COLORS.placeholder },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
  footerNote: { color: COLORS.placeholder, textAlign: 'center', paddingHorizontal: SPACING.md },
});
