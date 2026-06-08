import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOW } from '../../constants/brand';
import { formatCurrency } from '../../data/store';
import { toMonthly } from '../../ai/stub';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';

const TABS = ['Trajectory', 'Social Security', 'Withdrawal'];

// Approximate current age from life stage when profile.age is absent.
const AGE_BY_STAGE = {
  starting_out: 24,
  building:     32,
  family_years: 38,
  peak_earning: 47,
  transition:   57,
  retirement:   65,
};

// Future value: lump-sum PV + recurring PMT at monthly rate derived from annual %.
function fv(annualRatePct, months, monthlyContrib, currentBalance) {
  if (annualRatePct === 0 || months <= 0) {
    return currentBalance + monthlyContrib * Math.max(0, months);
  }
  const r = annualRatePct / 100 / 12;
  const factor = Math.pow(1 + r, months);
  return currentBalance * factor + monthlyContrib * ((factor - 1) / r);
}

// Years until portfolio is depleted at a given monthly withdrawal and growth rate.
function portfolioYears(balance, annualRatePct, monthlyWithdrawal) {
  if (monthlyWithdrawal <= 0) return Infinity;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return balance / monthlyWithdrawal / 12;
  const ratio = (r * balance) / monthlyWithdrawal;
  if (ratio >= 1) return Infinity; // interest exceeds withdrawals — never depletes
  return -Math.log(1 - ratio) / Math.log(1 + r) / 12;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ label, value, onDecrement, onIncrement }) {
  return (
    <View style={sp.group}>
      <StewardText variant="label" style={sp.label}>{label}</StewardText>
      <View style={sp.row}>
        <TouchableOpacity
          style={sp.btn}
          onPress={onDecrement}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="remove" size={15} color={COLORS.forest} />
        </TouchableOpacity>
        <StewardText style={sp.value}>{value}</StewardText>
        <TouchableOpacity
          style={sp.btn}
          onPress={onIncrement}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={15} color={COLORS.forest} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Trajectory tab ────────────────────────────────────────────────────────────

function TrajectoryTab({ profile }) {
  const investments   = profile?.investments ?? [];
  const totalBalance  = investments.reduce((s, i) => s + (Number(i.balance) || 0), 0);
  const monthlyContrib = investments.reduce((s, i) => s + (Number(i.monthlyContribution) || 0), 0);
  const inferredAge   = AGE_BY_STAGE[profile?.lifeStage] ?? 35;

  const [currentAge,    setCurrentAge]    = useState(inferredAge);
  const [retirementAge, setRetirementAge] = useState(65);

  const yearsTo = Math.max(0, retirementAge - currentAge);
  const months  = yearsTo * 12;

  const scenarios = [
    { label: 'Conservative', rate: 5, note: '5% avg return' },
    { label: 'Moderate',     rate: 7, note: '7% avg return', highlight: true },
    { label: 'Optimistic',   rate: 9, note: '9% avg return' },
  ];

  if (investments.length === 0) {
    return (
      <View style={s.emptyTab}>
        <Ionicons name="trending-up-outline" size={36} color={COLORS.border} />
        <StewardText variant="body" style={s.emptyText}>
          Add investment accounts in your profile to model your trajectory.
        </StewardText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
      {/* Age controls */}
      <StewardCard variant="outlined" style={s.inputCard}>
        <View style={s.stepperRow}>
          <Stepper
            label="CURRENT AGE"
            value={currentAge}
            onDecrement={() => setCurrentAge(a => Math.max(18, a - 1))}
            onIncrement={() => setCurrentAge(a => Math.min(retirementAge - 1, a + 1))}
          />
          <View style={s.stepperDivider} />
          <Stepper
            label="RETIRE AT"
            value={retirementAge}
            onDecrement={() => setRetirementAge(a => Math.max(currentAge + 1, a - 1))}
            onIncrement={() => setRetirementAge(a => Math.min(80, a + 1))}
          />
          <View style={s.stepperDivider} />
          <View style={sp.group}>
            <StewardText variant="label" style={sp.label}>HORIZON</StewardText>
            <StewardText style={sp.staticValue}>{yearsTo} yrs</StewardText>
          </View>
        </View>
      </StewardCard>

      {/* Portfolio today — forest summary */}
      <StewardCard variant="forest" style={s.portfolioCard}>
        <View style={s.triRow}>
          <View style={s.triStat}>
            <StewardText style={s.triValue}>{formatCurrency(totalBalance)}</StewardText>
            <StewardText style={s.triLabel}>Balance today</StewardText>
          </View>
          <View style={s.triDivider} />
          <View style={s.triStat}>
            <StewardText style={s.triValue}>{formatCurrency(monthlyContrib)}/mo</StewardText>
            <StewardText style={s.triLabel}>Going in</StewardText>
          </View>
          <View style={s.triDivider} />
          <View style={s.triStat}>
            <StewardText style={s.triValue}>{investments.length}</StewardText>
            <StewardText style={s.triLabel}>
              {investments.length === 1 ? 'Account' : 'Accounts'}
            </StewardText>
          </View>
        </View>
      </StewardCard>

      <StewardText variant="label" style={s.sectionLabel}>
        PROJECTIONS AT {retirementAge}
      </StewardText>

      {scenarios.map(sc => {
        const projected   = fv(sc.rate, months, monthlyContrib, totalBalance);
        const safeMonthly = Math.round(projected * 0.04 / 12);
        return (
          <StewardCard
            key={sc.label}
            variant={sc.highlight ? 'parchment' : 'default'}
            style={s.scenarioCard}
          >
            <View style={s.scenarioHeader}>
              <StewardText variant="bodyMedium">{sc.label}</StewardText>
              {sc.highlight && (
                <View style={s.pill}>
                  <StewardText style={s.pillLabel}>BASELINE</StewardText>
                </View>
              )}
              <StewardText variant="caption" style={s.scenarioNote}>{sc.note}</StewardText>
            </View>
            <View style={s.scenarioStats}>
              <View style={s.scenarioStat}>
                <StewardText style={s.scenarioBig}>{formatCurrency(Math.round(projected))}</StewardText>
                <StewardText variant="caption">Projected balance</StewardText>
              </View>
              <View style={[s.triDivider, { height: 36, alignSelf: 'center' }]} />
              <View style={[s.scenarioStat, { alignItems: 'flex-end' }]}>
                <StewardText style={s.scenarioBig}>{formatCurrency(safeMonthly)}/mo</StewardText>
                <StewardText variant="caption">4% safe withdrawal</StewardText>
              </View>
            </View>
          </StewardCard>
        );
      })}

      <StewardText variant="caption" style={s.disclaimer}>
        Projections assume consistent monthly contributions and steady returns. Inflation and sequence-of-returns risk are not modeled.
      </StewardText>
      <View style={{ height: SPACING.xl }} />
    </ScrollView>
  );
}

// ─── Social Security tab ───────────────────────────────────────────────────────

function SocialSecurityTab() {
  const [benefitText, setBenefitText] = useState('');

  const fullBenefit = Math.max(0, Number(benefitText.replace(/,/g, '')) || 0);
  const at62 = Math.round(fullBenefit * 0.70);
  const at67 = fullBenefit;
  const at70 = Math.round(fullBenefit * 1.24);

  // Breakeven: how long after the later claiming age until cumulative payments cross over.
  const breakeven_62_67 = at67 > at62
    ? Math.round((67 + (at62 * 60) / (at67 - at62) / 12) * 10) / 10
    : null;
  const breakeven_67_70 = at70 > at67
    ? Math.round((70 + (at67 * 36) / (at70 - at67) / 12) * 10) / 10
    : null;

  const options = [
    {
      age:       62,
      amount:    at62,
      tag:       'EARLY',
      note:      '30% reduction · Most years collecting',
      color:     COLORS.ember,
    },
    {
      age:       67,
      amount:    at67,
      tag:       'FULL',
      note:      'Standard full retirement benefit',
      color:     COLORS.forest,
      highlight: true,
    },
    {
      age:       70,
      amount:    at70,
      tag:       'DELAYED',
      note:      '+8% per year · 3 extra years of delay',
      color:     COLORS.sage,
    },
  ];

  return (
    <ScrollView contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
      {/* Benefit input */}
      <StewardCard variant="outlined" style={s.inputCard}>
        <StewardText variant="label" style={{ marginBottom: SPACING.xs }}>
          ESTIMATED MONTHLY BENEFIT AT 67
        </StewardText>
        <View style={s.currencyRow}>
          <StewardText style={s.currencySign}>$</StewardText>
          <TextInput
            style={s.currencyInput}
            value={benefitText}
            onChangeText={setBenefitText}
            keyboardType="number-pad"
            placeholder="2,000"
            placeholderTextColor={COLORS.placeholder}
            maxLength={5}
          />
        </View>
        <StewardText variant="caption" style={{ marginTop: SPACING.xs }}>
          Find your estimate at ssa.gov/myaccount
        </StewardText>
      </StewardCard>

      <StewardText variant="label" style={s.sectionLabel}>CLAIMING OPTIONS</StewardText>

      {options.map(o => (
        <StewardCard
          key={o.age}
          variant={o.highlight ? 'parchment' : 'default'}
          style={s.ssCard}
        >
          <View style={s.ssRow}>
            <View style={{ flex: 1 }}>
              <View style={s.ssLabelRow}>
                <StewardText variant="bodyMedium">Claim at {o.age}</StewardText>
                <View style={[s.agePill, { backgroundColor: o.color + '22' }]}>
                  <StewardText style={[s.agePillLabel, { color: o.color }]}>{o.tag}</StewardText>
                </View>
              </View>
              <StewardText variant="caption" style={{ marginTop: 2 }}>{o.note}</StewardText>
            </View>
            <StewardText style={s.ssAmount}>
              {fullBenefit > 0 ? `${formatCurrency(o.amount)}/mo` : '—'}
            </StewardText>
          </View>
        </StewardCard>
      ))}

      {fullBenefit > 0 && breakeven_62_67 && breakeven_67_70 && (
        <StewardCard variant="outlined" style={[s.inputCard, { marginTop: SPACING.md }]}>
          <StewardText variant="label" style={{ marginBottom: SPACING.sm }}>
            BREAKEVEN ANALYSIS
          </StewardText>
          <View style={s.breakevenRow}>
            <View style={{ flex: 1 }}>
              <StewardText variant="bodyMedium">67 vs 62</StewardText>
              <StewardText variant="caption" style={{ marginTop: 2 }}>
                Live past {breakeven_62_67} for late claiming to win
              </StewardText>
            </View>
            <StewardText style={s.breakevenAge}>Age {breakeven_62_67}</StewardText>
          </View>
          <View style={s.breakevenSeparator} />
          <View style={s.breakevenRow}>
            <View style={{ flex: 1 }}>
              <StewardText variant="bodyMedium">70 vs 67</StewardText>
              <StewardText variant="caption" style={{ marginTop: 2 }}>
                Live past {breakeven_67_70} for maximum delay to win
              </StewardText>
            </View>
            <StewardText style={s.breakevenAge}>Age {breakeven_67_70}</StewardText>
          </View>
        </StewardCard>
      )}

      <StewardText variant="caption" style={s.disclaimer}>
        Social Security estimates are illustrative. Actual benefits depend on your full earnings history.
      </StewardText>
      <View style={{ height: SPACING.xl }} />
    </ScrollView>
  );
}

// ─── Withdrawal tab ────────────────────────────────────────────────────────────

function WithdrawalTab({ profile }) {
  const investments    = profile?.investments ?? [];
  const totalBalance   = investments.reduce((s, i) => s + (Number(i.balance) || 0), 0);
  const monthlyContrib = investments.reduce((s, i) => s + (Number(i.monthlyContribution) || 0), 0);
  const inferredAge    = AGE_BY_STAGE[profile?.lifeStage] ?? 35;
  const yearsTo        = Math.max(1, 65 - inferredAge);
  const projectedAt7   = fv(7, yearsTo * 12, monthlyContrib, totalBalance);

  const netInc = toMonthly(profile?.netIncome, profile?.payFrequency);
  const [spendText, setSpendText] = useState(String(Math.round(netInc * 0.8) || ''));
  const monthlySpend = Math.max(0, Number(spendText.replace(/,/g, '')) || 0);

  const RATES = [3, 3.5, 4, 4.5, 5];

  if (investments.length === 0) {
    return (
      <View style={s.emptyTab}>
        <Ionicons name="wallet-outline" size={36} color={COLORS.border} />
        <StewardText variant="body" style={s.emptyText}>
          Add investment accounts in your profile to model withdrawal scenarios.
        </StewardText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
      {/* Projected portfolio context */}
      <StewardCard variant="forest" style={[s.portfolioCard, { alignItems: 'center' }]}>
        <StewardText style={s.triValue}>{formatCurrency(Math.round(projectedAt7))}</StewardText>
        <StewardText style={[s.triLabel, { textAlign: 'center', marginTop: 2 }]}>
          Projected at 65 · 7% baseline
        </StewardText>
      </StewardCard>

      <StewardText variant="label" style={s.sectionLabel}>SAFE WITHDRAWAL RATES</StewardText>

      {RATES.map(rate => {
        const monthly    = Math.round(projectedAt7 * (rate / 100) / 12);
        const isStandard = rate === 4;
        const rateNote   = rate <= 3.5
          ? 'Very conservative · Maximum longevity margin'
          : rate === 4
            ? 'Widely used benchmark'
            : rate <= 4.5
              ? 'Moderate · Typical life expectancy'
              : 'Aggressive · Shorter horizon or flexible spending';
        return (
          <StewardCard
            key={rate}
            variant={isStandard ? 'parchment' : 'default'}
            style={s.rateCard}
          >
            <View style={s.rateRow}>
              <View style={{ flex: 1 }}>
                <View style={s.rateLabelRow}>
                  <StewardText variant="bodyMedium">{rate}% rule</StewardText>
                  {isStandard && (
                    <View style={s.pill}>
                      <StewardText style={s.pillLabel}>STANDARD</StewardText>
                    </View>
                  )}
                </View>
                <StewardText variant="caption" style={{ marginTop: 2 }}>{rateNote}</StewardText>
              </View>
              <StewardText style={s.rateAmount}>{formatCurrency(monthly)}/mo</StewardText>
            </View>
          </StewardCard>
        );
      })}

      {/* Longevity calculator */}
      <StewardText variant="label" style={[s.sectionLabel, { marginTop: SPACING.md }]}>
        PORTFOLIO LONGEVITY
      </StewardText>
      <StewardCard variant="outlined" style={s.inputCard}>
        <StewardText variant="label" style={{ marginBottom: SPACING.xs }}>
          MONTHLY SPEND GOAL IN RETIREMENT
        </StewardText>
        <View style={s.currencyRow}>
          <StewardText style={s.currencySign}>$</StewardText>
          <TextInput
            style={s.currencyInput}
            value={spendText}
            onChangeText={setSpendText}
            keyboardType="number-pad"
            placeholder="4,000"
            placeholderTextColor={COLORS.placeholder}
            maxLength={6}
          />
        </View>
      </StewardCard>

      {monthlySpend > 0 && (
        <View style={s.longevityGrid}>
          {[5, 7, 9].map(rate => {
            const yrs        = portfolioYears(projectedAt7, rate, monthlySpend);
            const yrsDisplay = yrs === Infinity ? '∞' : `${Math.round(yrs)}`;
            const yrsColor   = yrs === Infinity || yrs >= 35
              ? COLORS.forest
              : yrs >= 25
                ? COLORS.sage
                : COLORS.ember;
            return (
              <StewardCard
                key={rate}
                variant={rate === 7 ? 'parchment' : 'default'}
                style={s.longevityCard}
              >
                <StewardText variant="label" style={s.longevityRateLabel}>{rate}%</StewardText>
                <StewardText style={[s.longevityYears, { color: yrsColor }]}>{yrsDisplay}</StewardText>
                <StewardText variant="caption" style={s.longevityUnit}>
                  {yrs === Infinity ? 'indefinite' : 'years'}
                </StewardText>
              </StewardCard>
            );
          })}
        </View>
      )}

      <StewardText variant="caption" style={s.disclaimer}>
        Projections assume consistent returns. Sequence-of-returns risk and inflation are not modeled.
      </StewardText>
      <View style={{ height: SPACING.xl }} />
    </ScrollView>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function RetirementScreen({ route, navigation }) {
  const profile    = route.params?.profile;
  const [activeTab, setActiveTab] = useState(0);

  const investments  = profile?.investments ?? [];
  const totalBalance = investments.reduce((s, i) => s + (Number(i.balance) || 0), 0);

  const tabContent = [
    <TrajectoryTab    key="traj" profile={profile} />,
    <SocialSecurityTab key="ss" profile={profile} />,
    <WithdrawalTab    key="with" profile={profile} />,
  ];

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      {/* Forest header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <StewardText style={s.headerTitle}>Retirement outlook.</StewardText>
          {totalBalance > 0 && (
            <StewardText style={s.headerSub}>
              {formatCurrency(totalBalance)} across{' '}
              {investments.length} {investments.length === 1 ? 'account' : 'accounts'}
            </StewardText>
          )}
        </View>
        <View style={s.proBadge}>
          <StewardText style={s.proLabel}>PRO</StewardText>
        </View>
      </View>

      {/* Top tab bar */}
      <View style={s.tabBar}>
        {TABS.map((label, i) => (
          <TouchableOpacity
            key={label}
            style={[s.tab, activeTab === i && s.tabActive]}
            onPress={() => setActiveTab(i)}
            activeOpacity={0.7}
          >
            <StewardText style={[s.tabLabel, activeTab === i && s.tabLabelActive]}>
              {label}
            </StewardText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>{tabContent[activeTab]}</View>
    </SafeAreaView>
  );
}

// ─── Stepper styles ────────────────────────────────────────────────────────────

const sp = StyleSheet.create({
  group: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  btn: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.forestMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.md,
    color: COLORS.hearth,
    minWidth: 28,
    textAlign: 'center',
  },
  staticValue: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.md,
    color: COLORS.hearth,
    textAlign: 'center',
    marginTop: 2,
  },
});

// ─── Screen styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.parchment,
  },

  // Header
  header: {
    backgroundColor: COLORS.forest,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  backBtn: {
    paddingTop: 3,
    width: 28,
  },
  headerTitle: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xl,
    color: COLORS.white,
    lineHeight: SIZES.xl * 1.2,
  },
  headerSub: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 3,
  },
  proBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  proLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: 9,
    color: COLORS.white,
    letterSpacing: 1,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.forest,
  },
  tabLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
  },
  tabLabelActive: {
    color: COLORS.forest,
  },

  // Shared scroll padding
  tabScroll: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },

  // Empty state
  emptyTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.placeholder,
  },

  // Input card (outlined)
  inputCard: {
    marginBottom: SPACING.md,
  },

  // Stepper row inside input card
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.sm,
  },

  // Forest portfolio summary card
  portfolioCard: {
    marginBottom: SPACING.md,
  },
  triRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  triStat: {
    flex: 1,
    alignItems: 'center',
  },
  triValue: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.md,
    color: COLORS.white,
    textAlign: 'center',
  },
  triLabel: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    textAlign: 'center',
  },
  triDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.forestLight,
  },

  // Section label
  sectionLabel: {
    marginBottom: SPACING.sm,
  },

  // Scenario cards (Trajectory)
  scenarioCard: {
    marginBottom: SPACING.sm,
  },
  scenarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  scenarioNote: {
    marginLeft: 'auto',
  },
  scenarioStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  scenarioStat: {
    flex: 1,
  },
  scenarioBig: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.md,
    color: COLORS.hearth,
    marginBottom: 2,
  },

  // Pill badge
  pill: {
    backgroundColor: COLORS.forestMuted,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
  },
  pillLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: 9,
    color: COLORS.forest,
    letterSpacing: 0.5,
  },

  // Currency input row
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  currencySign: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.lg,
    color: COLORS.hearth,
  },
  currencyInput: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.lg,
    color: COLORS.hearth,
    flex: 1,
    padding: 0,
  },

  // Social Security cards
  ssCard: {
    marginBottom: SPACING.sm,
  },
  ssRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  ssLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  ssAmount: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.md,
    color: COLORS.hearth,
  },
  agePill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
  },
  agePillLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: 9,
    letterSpacing: 0.5,
  },

  // Breakeven
  breakevenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  breakevenSeparator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  breakevenAge: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.forest,
  },

  // Withdrawal rate cards
  rateCard: {
    marginBottom: SPACING.sm,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  rateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  rateAmount: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.md,
    color: COLORS.hearth,
  },

  // Longevity grid
  longevityGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  longevityCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  longevityRateLabel: {
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  longevityYears: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xxl,
    textAlign: 'center',
  },
  longevityUnit: {
    textAlign: 'center',
    marginTop: 2,
  },

  // Disclaimer
  disclaimer: {
    marginTop: SPACING.md,
    color: COLORS.placeholder,
    lineHeight: SIZES.sm * 1.5,
  },
});
