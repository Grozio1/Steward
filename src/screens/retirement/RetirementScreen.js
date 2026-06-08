import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../../constants/brand';
import { getProfile, formatCurrency } from '../../data/store';
import { toMonthly, getAge } from '../../ai/stub';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';

const SS_KEY = 'steward_ss_estimate';

const TABS = ['Trajectory', 'Social Security', 'Withdrawal'];

// Which stages unlock Social Security and Withdrawal tabs.
const SS_STAGES       = new Set(['peak_earning', 'transition', 'retirement']);
const WITHDRAW_STAGES = new Set(['transition', 'retirement']);

// ─── Math helpers ──────────────────────────────────────────────────────────────

// FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r  (monthly compounding)
function fv(annualRatePct, months, monthlyContrib, currentBalance) {
  if (annualRatePct === 0 || months <= 0) {
    return currentBalance + monthlyContrib * Math.max(0, months);
  }
  const r      = annualRatePct / 100 / 12;
  const factor = Math.pow(1 + r, months);
  return currentBalance * factor + monthlyContrib * ((factor - 1) / r);
}

// Monthly contribution estimate:
//   payroll-deducted → use monthlyContribution if set, otherwise 6% of income as proxy
//   non-payroll     → use monthlyContribution directly
function calcMonthlyContrib(investments, monthlyIncome) {
  return investments.reduce((sum, inv) => {
    const explicit = Number(inv.monthlyContribution) || 0;
    if (inv.payrollDeducted) {
      return sum + (explicit > 0 ? explicit : Math.round(monthlyIncome * 0.06));
    }
    return sum + explicit;
  }, 0);
}

// IRS Uniform Lifetime Table — linear interpolation between known points.
const RMD_TABLE = [[73, 26.5], [75, 24.6], [80, 20.2], [85, 16.0]];

function getRmdFactor(age) {
  if (age <= 73) return 26.5;
  if (age >= 85) return Math.max(10, 16.0 - (age - 85) * 0.4);
  for (let i = 0; i < RMD_TABLE.length - 1; i++) {
    const [a0, f0] = RMD_TABLE[i];
    const [a1, f1] = RMD_TABLE[i + 1];
    if (age >= a0 && age <= a1) {
      return f0 + (f1 - f0) * (age - a0) / (a1 - a0);
    }
  }
  return 26.5;
}

// Map investment type to withdrawal-order bucket.
function getBucket(type) {
  if (type === 'brokerage')                          return 'taxable';
  if (type === '401k' || type === 'ira_traditional') return 'tax_deferred';
  if (type === 'ira_roth' || type === 'roth')        return 'tax_free';
  if (type === 'hsa')                                return 'hsa';
  return null;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Stepper({ label, display, onDecrement, onIncrement }) {
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
        <StewardText style={sp.value}>{display}</StewardText>
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

function LockedCard({ message }) {
  return (
    <StewardCard variant="outlined" style={s.lockedCard}>
      <Ionicons name="lock-closed-outline" size={22} color={COLORS.sage} style={{ marginBottom: SPACING.sm, alignSelf: 'center' }} />
      <StewardText variant="body" style={s.lockedText}>{message}</StewardText>
    </StewardCard>
  );
}

function VoiceCard({ children }) {
  return (
    <StewardCard variant="parchment" style={s.voiceCard}>
      <StewardText variant="stewardVoice">{children}</StewardText>
    </StewardCard>
  );
}

// ─── Trajectory tab ────────────────────────────────────────────────────────────

function TrajectoryTab({ profile, monthlyIncome }) {
  const investments  = profile?.investments ?? [];
  const totalBalance = investments.reduce((s, i) => s + (Number(i.balance) || 0), 0);
  const inferredAge  = getAge(profile);
  const baseContrib  = calcMonthlyContrib(investments, monthlyIncome);

  const [retirementAge,  setRetirementAge]  = useState(65);
  const [monthlyContrib, setMonthlyContrib] = useState(baseContrib);

  const yearsTo = Math.max(0, retirementAge - inferredAge);
  const months  = yearsTo * 12;

  const scenarios = [
    { label: 'Conservative', rate: 5 },
    { label: 'Base',         rate: 7 },
    { label: 'Optimistic',   rate: 9 },
  ];

  const baseProjected   = fv(7, months, monthlyContrib, totalBalance);
  const baseSafeMonthly = Math.round(baseProjected * 0.04 / 12);

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
      {/* Portfolio today */}
      <StewardCard variant="forest" style={s.portfolioCard}>
        <View style={s.triRow}>
          <View style={s.triStat}>
            <StewardText style={s.triValue}>{formatCurrency(totalBalance)}</StewardText>
            <StewardText style={s.triLabel}>Balance today</StewardText>
          </View>
          <View style={s.triDivider} />
          <View style={s.triStat}>
            <StewardText style={s.triValue}>{formatCurrency(monthlyContrib)}/mo</StewardText>
            <StewardText style={s.triLabel}>Monthly in</StewardText>
          </View>
          <View style={s.triDivider} />
          <View style={s.triStat}>
            <StewardText style={s.triValue}>{yearsTo}</StewardText>
            <StewardText style={s.triLabel}>
              {profile?.dateOfBirth
                ? `Age ${inferredAge} · ${Math.max(0, 65 - inferredAge)} to 65`
                : yearsTo === 1 ? 'year left' : 'years left'}
            </StewardText>
          </View>
        </View>
      </StewardCard>

      {/* Projections */}
      <StewardText variant="label" style={s.sectionLabel}>PROJECTIONS AT {retirementAge}</StewardText>

      {scenarios.map(sc => {
        const projected   = fv(sc.rate, months, monthlyContrib, totalBalance);
        const safeMonthly = Math.round(projected * 0.04 / 12);
        const isBase      = sc.label === 'Base';
        return (
          <StewardCard
            key={sc.label}
            variant={isBase ? 'parchment' : 'default'}
            style={s.scenarioCard}
          >
            <View style={s.scenarioHeader}>
              <StewardText variant="bodyMedium">{sc.label}</StewardText>
              {isBase && (
                <View style={s.badgePill}>
                  <StewardText style={s.badgePillText}>BASELINE</StewardText>
                </View>
              )}
              <StewardText variant="caption" style={s.scenarioNote}>{sc.rate}% avg return</StewardText>
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

      {/* Steward voice — one sentence on base scenario */}
      <VoiceCard>
        At your current pace, you're on track for roughly {formatCurrency(baseSafeMonthly)}/month at {retirementAge}. Here's what changes that.
      </VoiceCard>

      {/* Levers */}
      <StewardText variant="label" style={s.sectionLabel}>ADJUST THE MODEL</StewardText>
      <StewardCard variant="outlined" style={s.inputCard}>
        <View style={s.stepperRow}>
          <Stepper
            label="MONTHLY CONTRIBUTION"
            display={formatCurrency(monthlyContrib)}
            onDecrement={() => setMonthlyContrib(c => Math.max(0, c - 50))}
            onIncrement={() => setMonthlyContrib(c => c + 50)}
          />
          <View style={s.stepperDivider} />
          <Stepper
            label="RETIRE AT"
            display={String(retirementAge)}
            onDecrement={() => setRetirementAge(a => Math.max(50, a - 1))}
            onIncrement={() => setRetirementAge(a => Math.min(75, a + 1))}
          />
        </View>
      </StewardCard>

      <StewardText variant="caption" style={s.disclaimer}>
        Projections assume consistent contributions and steady returns. Inflation and sequence-of-returns risk are not modeled.
      </StewardText>
      <View style={{ height: SPACING.xl }} />
    </ScrollView>
  );
}

// ─── Social Security tab ───────────────────────────────────────────────────────

function SocialSecurityTab({ lifeStage }) {
  const [benefitText, setBenefitText] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(SS_KEY).then(val => { if (val) setBenefitText(val); });
  }, []);

  const handleBenefitChange = (text) => {
    setBenefitText(text);
    AsyncStorage.setItem(SS_KEY, text).catch(() => {});
  };

  if (!SS_STAGES.has(lifeStage)) {
    return (
      <ScrollView contentContainerStyle={s.tabScroll}>
        <LockedCard message="Social Security timing becomes relevant as you approach retirement. Check back in the transition stage." />
      </ScrollView>
    );
  }

  const fullBenefit = Math.max(0, Number(benefitText.replace(/,/g, '')) || 0);
  const at62 = Math.round(fullBenefit * 0.70);
  const at67 = fullBenefit;
  const at70 = Math.round(fullBenefit * 1.24);

  // Cumulative breakeven against age-67 baseline.
  // 62 vs 67: 5 extra years of reduced benefit; how many months at higher rate to recoup?
  const breakeven_62_67 = at67 > at62
    ? Math.round((67 + (at62 * 60) / (at67 - at62) / 12) * 10) / 10
    : null;
  // 70 vs 67: 3 fewer years; how many months at higher rate to recoup?
  const breakeven_67_70 = at70 > at67
    ? Math.round((70 + (at67 * 36) / (at70 - at67) / 12) * 10) / 10
    : null;

  const options = [
    { age: 62, amount: at62, tag: 'EARLY',   note: '30% reduction · Most years collecting',  color: COLORS.ember },
    { age: 67, amount: at67, tag: 'FULL',    note: 'Standard full retirement benefit',        color: COLORS.forest, highlight: true },
    { age: 70, amount: at70, tag: 'DELAYED', note: '+8% per year · 3 extra years of delay',  color: COLORS.sage },
  ];

  return (
    <ScrollView contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
      {/* Benefit input */}
      <StewardCard variant="outlined" style={s.inputCard}>
        <StewardText variant="label" style={{ marginBottom: SPACING.xs }}>
          YOUR ESTIMATED BENEFIT AT 67 (FULL RETIREMENT AGE)
        </StewardText>
        <View style={s.currencyRow}>
          <StewardText style={s.currencySign}>$</StewardText>
          <TextInput
            style={s.currencyInput}
            value={benefitText}
            onChangeText={handleBenefitChange}
            keyboardType="number-pad"
            placeholder="2,000"
            placeholderTextColor={COLORS.placeholder}
            maxLength={5}
          />
        </View>
        <StewardText variant="caption" style={{ marginTop: SPACING.xs }}>
          Find this at ssa.gov/myaccount
        </StewardText>
      </StewardCard>

      {fullBenefit === 0 ? (
        <VoiceCard>
          Enter your estimated benefit above to see how claiming age affects your lifetime income.
        </VoiceCard>
      ) : (
        <>
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
                  {o.age !== 67 && (
                    <StewardText variant="caption" style={{ marginTop: 2, color: COLORS.forest }}>
                      {o.age === 62 && breakeven_62_67
                        ? `Breaks even vs 67 at age ${breakeven_62_67}`
                        : o.age === 70 && breakeven_67_70
                          ? `Breaks even vs 67 at age ${breakeven_67_70}`
                          : null}
                    </StewardText>
                  )}
                </View>
                <StewardText style={s.ssAmount}>{formatCurrency(o.amount)}/mo</StewardText>
              </View>
            </StewardCard>
          ))}

          {breakeven_67_70 && (
            <VoiceCard>
              If you expect to live past {breakeven_67_70}, waiting until 70 pays more over your lifetime.
            </VoiceCard>
          )}
        </>
      )}

      <StewardText variant="caption" style={s.disclaimer}>
        Social Security estimates are illustrative. Actual benefits depend on your full earnings history.
      </StewardText>
      <View style={{ height: SPACING.xl }} />
    </ScrollView>
  );
}

// ─── Withdrawal tab ────────────────────────────────────────────────────────────

const BUCKET_META = {
  taxable:      { rank: 1, label: 'Taxable — Brokerage',      why: 'Spend these first. Favorable capital gains rates.' },
  tax_deferred: { rank: 2, label: 'Tax-Deferred — 401k / IRA', why: 'Draw these in retirement. Taxed as ordinary income.' },
  tax_free:     { rank: 3, label: 'Tax-Free — Roth',           why: 'Spend these last. Tax-free growth; no RMDs.' },
  hsa:          { rank: 4, label: 'HSA',                       why: 'Use for healthcare tax-free at any age. Treat as Roth after 65.' },
};

function WithdrawalTab({ profile, monthlyIncome }) {
  const lifeStage  = profile?.lifeStage;
  const investments = profile?.investments ?? [];
  const inferredAge = getAge(profile);

  if (!WITHDRAW_STAGES.has(lifeStage)) {
    return (
      <ScrollView contentContainerStyle={s.tabScroll}>
        <LockedCard message="Withdrawal planning becomes relevant as you near retirement. This tab unlocks in the transition stage." />
      </ScrollView>
    );
  }

  // Group into buckets
  const buckets = {};
  for (const inv of investments) {
    const key = getBucket(inv.type);
    if (!key) continue;
    if (!buckets[key]) buckets[key] = { balance: 0, accounts: [] };
    buckets[key].balance  += Number(inv.balance) || 0;
    buckets[key].accounts.push(inv);
  }

  const totalBalance       = investments.reduce((s, i) => s + (Number(i.balance) || 0), 0);
  const taxDeferredBalance = buckets.tax_deferred?.balance ?? 0;

  // RMD — visible for retirement stage or inferredAge >= 70
  const showRmd    = lifeStage === 'retirement' || inferredAge >= 70;
  const yearsToRmd = Math.max(0, 73 - inferredAge);
  const yearlyRmd  = inferredAge >= 73 && taxDeferredBalance > 0
    ? Math.round(taxDeferredBalance / getRmdFactor(inferredAge))
    : 0;
  const monthlyRmd = Math.round(yearlyRmd / 12);

  // Under-living flag: portfolio could support more than current income
  const sustainableMonthly = totalBalance > 0 ? Math.round(totalBalance * 0.04 / 12) : 0;
  const showUnderLiving    = lifeStage === 'retirement'
    && totalBalance > 0
    && monthlyIncome < sustainableMonthly * 0.7;

  const orderedBuckets = Object.entries(BUCKET_META)
    .filter(([key]) => buckets[key])
    .sort(([, a], [, b]) => a.rank - b.rank);

  return (
    <ScrollView contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
      {/* Under-living flag */}
      {showUnderLiving && (
        <StewardCard variant="parchment" style={[s.voiceCard, s.underLivingCard]}>
          <StewardText variant="stewardVoice">
            Your portfolio can support more than you're spending. Under-living is a real risk — your money should be working for your quality of life now.
          </StewardText>
        </StewardCard>
      )}

      {/* Drawdown sequence */}
      <StewardText variant="label" style={s.sectionLabel}>WITHDRAWAL SEQUENCE</StewardText>

      {investments.length === 0 ? (
        <StewardCard variant="outlined" style={s.inputCard}>
          <StewardText variant="body" style={{ color: COLORS.placeholder, textAlign: 'center' }}>
            Add investment accounts in your profile to see your drawdown sequence.
          </StewardText>
        </StewardCard>
      ) : (
        <>
          {orderedBuckets.map(([key, meta]) => (
            <StewardCard key={key} variant="default" style={s.bucketCard}>
              <View style={s.bucketRow}>
                <View style={s.bucketRankBadge}>
                  <StewardText style={s.bucketRankNum}>{meta.rank}</StewardText>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.bucketLabelRow}>
                    <StewardText variant="bodyMedium" style={{ flex: 1 }}>{meta.label}</StewardText>
                    <StewardText style={s.bucketBalance}>{formatCurrency(buckets[key].balance)}</StewardText>
                  </View>
                  <StewardText variant="caption" style={{ marginTop: 2 }}>{meta.why}</StewardText>
                  <View style={{ marginTop: SPACING.xs }}>
                    {buckets[key].accounts.map(acc => (
                      <StewardText key={acc.id ?? acc.name} variant="caption" style={s.bucketAccountLine}>
                        · {acc.name}
                      </StewardText>
                    ))}
                  </View>
                </View>
              </View>
            </StewardCard>
          ))}

          {/* Gap notes */}
          {!buckets.taxable && (
            <StewardCard variant="outlined" style={s.gapCard}>
              <StewardText variant="caption" style={{ color: COLORS.placeholder }}>
                No taxable brokerage account. Adding one creates flexibility before RMDs begin.
              </StewardText>
            </StewardCard>
          )}
          {!buckets.tax_free && (
            <StewardCard variant="outlined" style={s.gapCard}>
              <StewardText variant="caption" style={{ color: COLORS.placeholder }}>
                No Roth account. Roth accounts offer tax-free growth with no required distributions.
              </StewardText>
            </StewardCard>
          )}
        </>
      )}

      {/* RMD tracker */}
      {showRmd && (
        <>
          <StewardText variant="label" style={[s.sectionLabel, { marginTop: SPACING.md }]}>
            REQUIRED MINIMUM DISTRIBUTIONS
          </StewardText>
          <StewardCard variant={inferredAge >= 73 && taxDeferredBalance > 0 ? 'parchment' : 'default'} style={s.rmdCard}>
            {inferredAge >= 73 && taxDeferredBalance > 0 ? (
              <>
                <StewardText variant="bodyMedium" style={{ marginBottom: SPACING.xs }}>
                  Estimated RMD this year
                </StewardText>
                <StewardText style={s.rmdAmount}>{formatCurrency(yearlyRmd)}/yr</StewardText>
                <StewardText variant="caption" style={{ marginTop: SPACING.xs }}>
                  {formatCurrency(monthlyRmd)}/month · Based on {formatCurrency(taxDeferredBalance)} tax-deferred balance
                </StewardText>
              </>
            ) : inferredAge >= 73 ? (
              <StewardText variant="body" style={{ color: COLORS.placeholder }}>
                No tax-deferred balance to calculate RMD against.
              </StewardText>
            ) : (
              <>
                <StewardText variant="bodyMedium" style={{ marginBottom: SPACING.xs }}>
                  RMDs begin at 73
                </StewardText>
                <StewardText variant="caption">
                  You have approximately {yearsToRmd} year{yearsToRmd !== 1 ? 's' : ''} until RMDs are required on tax-deferred accounts.
                </StewardText>
              </>
            )}
          </StewardCard>
        </>
      )}

      <StewardText variant="caption" style={s.disclaimer}>
        RMD estimates use IRS Uniform Lifetime Table figures. Consult a tax advisor for your specific situation.
      </StewardText>
      <View style={{ height: SPACING.xl }} />
    </ScrollView>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function RetirementScreen({ route, navigation }) {
  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    getProfile().then(p => {
      setProfile(p ?? route.params?.profile ?? null);
      setLoading(false);
    });
  }, []);

  const investments   = profile?.investments ?? [];
  const totalBalance  = investments.reduce((s, i) => s + (Number(i.balance) || 0), 0);
  const monthlyIncome = toMonthly(profile?.netIncome, profile?.payFrequency);

  const headerContent = (
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
  );

  if (loading) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
        {headerContent}
        <View style={s.loadingWrap}>
          <ActivityIndicator color={COLORS.forest} />
        </View>
      </SafeAreaView>
    );
  }

  const tabContent = [
    <TrajectoryTab    key="traj" profile={profile} monthlyIncome={monthlyIncome} />,
    <SocialSecurityTab key="ss"  lifeStage={profile?.lifeStage} />,
    <WithdrawalTab    key="with" profile={profile} monthlyIncome={monthlyIncome} />,
  ];

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      {headerContent}

      {/* Pill tab selector */}
      <View style={s.tabPillRow}>
        {TABS.map((label, i) => (
          <TouchableOpacity
            key={label}
            style={[s.tabPill, activeTab === i && s.tabPillActive]}
            onPress={() => setActiveTab(i)}
            activeOpacity={0.8}
          >
            <StewardText style={[s.tabPillText, activeTab === i && s.tabPillTextActive]}>
              {label}
            </StewardText>
          </TouchableOpacity>
        ))}
      </View>

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
    width: 26,
    height: 26,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.forestMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    minWidth: 44,
    textAlign: 'center',
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

  // Pill tab selector
  tabPillRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
    backgroundColor: COLORS.parchment,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabPill: {
    flex: 1,
    paddingVertical: SPACING.xs + 2,
    alignItems: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  tabPillActive: {
    backgroundColor: COLORS.forest,
    borderColor: COLORS.forest,
  },
  tabPillText: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    letterSpacing: 0.3,
  },
  tabPillTextActive: {
    color: COLORS.white,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Locked stage card
  lockedCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  lockedText: {
    color: COLORS.sage,
    textAlign: 'center',
    lineHeight: SIZES.base * 1.6,
  },

  // Steward voice card
  voiceCard: {
    marginBottom: SPACING.md,
  },

  // Under-living flag (ember left border)
  underLivingCard: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.ember,
  },

  // Input card (outlined)
  inputCard: {
    marginBottom: SPACING.md,
  },

  // Stepper row
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperDivider: {
    width: 1,
    height: 44,
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

  // Scenario cards
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

  // Inline badge pill (scenario cards)
  badgePill: {
    backgroundColor: COLORS.forestMuted,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
  },
  badgePillText: {
    fontFamily: FONTS.sans.medium,
    fontSize: 9,
    color: COLORS.forest,
    letterSpacing: 0.5,
  },

  // Currency input
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

  // Drawdown sequence cards
  bucketCard: {
    marginBottom: SPACING.sm,
  },
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  bucketRankBadge: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.forestMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  bucketRankNum: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.forest,
  },
  bucketLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bucketBalance: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
  },
  bucketAccountLine: {
    color: COLORS.sage,
  },

  // Gap note cards
  gapCard: {
    marginBottom: SPACING.sm,
  },

  // RMD card
  rmdCard: {
    marginBottom: SPACING.sm,
  },
  rmdAmount: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xl,
    color: COLORS.hearth,
  },

  // Disclaimer
  disclaimer: {
    marginTop: SPACING.md,
    color: COLORS.placeholder,
    lineHeight: SIZES.sm * 1.5,
  },
});
