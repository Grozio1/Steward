import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOW } from '../../constants/brand';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';

const FEATURE_LABELS = {
  biography: 'Financial Story',
  retirement: 'Retirement Outlook',
  benchmark: 'Peer Benchmarks',
  decide: 'Unlimited Decision Checks',
};

export default function PaywallScreen({ route, navigation }) {
  const feature = route?.params?.feature ?? '';
  const label = FEATURE_LABELS[feature] ?? 'This Feature';

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <StewardText style={s.headerTitle}>Upgrade to Pro</StewardText>
      </View>

      <View style={s.content}>
        <StewardCard variant="forest" style={s.featureCard}>
          <StewardText style={s.featureTag}>PRO FEATURE</StewardText>
          <StewardText style={s.featureName}>{label}</StewardText>
          <StewardText style={s.featureDesc}>
            This is part of Steward Pro — a deeper look at your financial life.
          </StewardText>
        </StewardCard>

        <StewardCard variant="parchment" style={s.pricingCard}>
          <View style={s.priceRow}>
            <StewardText style={s.price}>$79</StewardText>
            <StewardText style={s.perYear}>/year</StewardText>
          </View>
          <StewardText style={s.pricingDesc}>
            Unlock your full financial story, retirement outlook, peer benchmarks, and unlimited decision checks.
          </StewardText>
        </StewardCard>

        <TouchableOpacity style={s.upgradeBtn} activeOpacity={0.85}>
          <StewardText style={s.upgradeBtnLabel}>Upgrade to Pro</StewardText>
        </TouchableOpacity>

        <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <StewardText style={s.cancelLabel}>Not right now</StewardText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.parchment },
  header: {
    backgroundColor: COLORS.forest,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  backBtn: { paddingTop: 2, width: 28 },
  headerTitle: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xl,
    color: COLORS.white,
    lineHeight: SIZES.xl * 1.2,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  featureCard: {
    gap: SPACING.xs,
  },
  featureTag: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.ember,
    letterSpacing: 1,
  },
  featureName: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xl,
    color: COLORS.white,
    lineHeight: SIZES.xl * 1.2,
    marginTop: SPACING.xs,
  },
  featureDesc: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: SIZES.base * 1.6,
  },
  pricingCard: { gap: SPACING.sm },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  price: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xxxl,
    color: COLORS.hearth,
    lineHeight: SIZES.xxxl * 1.1,
  },
  perYear: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
    paddingBottom: SPACING.xs,
  },
  pricingDesc: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
    lineHeight: SIZES.base * 1.6,
  },
  upgradeBtn: {
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOW.soft,
  },
  upgradeBtnLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.md,
    color: COLORS.white,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  cancelLabel: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
    textDecorationLine: 'underline',
  },
});
