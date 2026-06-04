import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOW } from '../../constants/brand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveProfile, formatCurrency } from '../../data/store';
import { generateAnnualReview } from '../../ai/annualReview';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';
import FlameIcon from '../../components/FlameIcon';

// ─── Constants ─────────────────────────────────────────────────────────────────

const STEP_META = [
  { title: 'The Ledger',      sub: 'What happened this year' },
  { title: 'Patterns',        sub: 'What I noticed' },
  { title: "Steward's Take",  sub: "What I'd change" },
  { title: 'Life Events',     sub: 'Anything change?' },
  { title: 'Income',          sub: 'Is this still right?' },
  { title: 'Debts',           sub: 'Where are you now?' },
  { title: 'Proposed Plan',   sub: 'Changes applied' },
];

const LIFE_EVENTS = [
  { id: 'income_raise',  label: 'Income raise' },
  { id: 'job_loss',      label: 'Job loss' },
  { id: 'career_change', label: 'Career change' },
  { id: 'married',       label: 'Got married' },
  { id: 'new_baby',      label: 'New baby' },
  { id: 'moved',         label: 'Moved homes' },
  { id: 'divorce',       label: 'Divorce or separation' },
  { id: 'medical',       label: 'Medical emergency' },
  { id: 'loss',          label: 'Loss of a loved one' },
  { id: 'other',         label: 'Something else' },
];

function findingBgColor(type) {
  if (type === 'over_budget' || type === 'seasonal_spikes') return COLORS.ember;
  if (type === 'debt_progress' || type === 'stability_progress') return COLORS.forest;
  return COLORS.sage;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard({ pulse }) {
  return (
    <Animated.View style={[sk.card, { opacity: pulse }]}>
      <View style={sk.icon} />
      <View style={{ flex: 1, gap: SPACING.sm }}>
        <View style={[sk.line, { width: '65%' }]} />
        <View style={[sk.line, { width: '90%' }]} />
        <View style={[sk.line, { width: '75%' }]} />
      </View>
    </Animated.View>
  );
}

// ─── Step 0 — The Ledger ───────────────────────────────────────────────────────

function LedgerStep({ loading, reviewData, profile, pulse }) {
  if (loading) {
    return (
      <View style={{ gap: SPACING.md }}>
        <StewardText style={st.prompt}>Looking at your year…</StewardText>
        <SkeletonCard pulse={pulse} />
        <SkeletonCard pulse={pulse} />
        <SkeletonCard pulse={pulse} />
      </View>
    );
  }

  const engagement = (reviewData?.findings || []).find(f => f.type === 'engagement');
  const topFindings = (reviewData?.findings || []).slice(0, 3);

  return (
    <View style={{ gap: SPACING.md }}>
      <View style={st.ledgerHero}>
        <FlameIcon size={36} />
        <StewardText variant="heading" style={{ textAlign: 'center' }}>
          {engagement
            ? `${engagement.monthsTracked} months of careful watching.`
            : 'A year of careful watching.'}
        </StewardText>
        <StewardText variant="body" color={COLORS.placeholder} style={{ textAlign: 'center' }}>
          {engagement
            ? `You tracked ${engagement.monthsTracked} of ${engagement.totalMonths} months. Here's what I found.`
            : "Here's what I found."}
        </StewardText>
      </View>

      {topFindings.map(f => (
        <StewardCard key={f.id} variant="parchment">
          <View style={st.findingRow}>
            <FlameIcon size={18} bgColor={findingBgColor(f.type)} />
            <View style={{ flex: 1 }}>
              <StewardText variant="bodyMedium">{f.observation}</StewardText>
              <StewardText variant="caption" style={{ marginTop: SPACING.xs }}>
                {f.implication}
              </StewardText>
            </View>
          </View>
        </StewardCard>
      ))}

      {(reviewData?.yearData?.anomalies?.length || 0) > 0 && (
        <StewardCard variant="parchment">
          <StewardText variant="caption" color={COLORS.sage}>
            {`We flagged ${reviewData.yearData.anomalies.length} pattern${reviewData.yearData.anomalies.length === 1 ? '' : 's'} during the year. They're reflected in the findings below.`}
          </StewardText>
        </StewardCard>
      )}
    </View>
  );
}

// ─── Step 1 — Patterns ────────────────────────────────────────────────────────

function PatternsStep({ findings }) {
  if (findings.length === 0) {
    return (
      <StewardCard variant="parchment">
        <StewardText variant="body" color={COLORS.placeholder}>
          Not enough data from this year to identify patterns.
        </StewardText>
      </StewardCard>
    );
  }

  return (
    <View style={{ gap: SPACING.md }}>
      {findings.map(f => (
        <StewardCard key={f.id}>
          <View style={st.findingRow}>
            <FlameIcon size={18} bgColor={findingBgColor(f.type)} />
            <View style={{ flex: 1 }}>
              <StewardText variant="label" style={{ marginBottom: SPACING.xs }}>
                {f.type.replace(/_/g, ' ')}
              </StewardText>
              <StewardText variant="bodyMedium">{f.observation}</StewardText>
              <View style={st.implicationRow}>
                <View style={st.implicationBar} />
                <StewardText variant="body" color={COLORS.placeholder} style={{ flex: 1 }}>
                  {f.implication}
                </StewardText>
              </View>
            </View>
          </View>
        </StewardCard>
      ))}
    </View>
  );
}

// ─── Step 2 — Steward's Take ──────────────────────────────────────────────────

function TakeStep({ recommendations, accepted, onToggle }) {
  if (recommendations.length === 0) {
    return (
      <StewardCard variant="parchment">
        <StewardText variant="body" color={COLORS.placeholder}>
          No changes recommended. Your plan looks right for your life.
        </StewardText>
      </StewardCard>
    );
  }

  return (
    <View style={{ gap: SPACING.md }}>
      {recommendations.map(rec => {
        const isAccepted = accepted[rec.id] !== false;
        return (
          <StewardCard
            key={rec.id}
            style={[st.recCard, !isAccepted && st.recCardRejected]}
          >
            <View style={st.recTop}>
              <View style={{ flex: 1 }}>
                <StewardText variant="bodyMedium">{rec.label}</StewardText>
                <StewardText variant="caption" style={{ marginTop: SPACING.xs }}>
                  {rec.detail}
                </StewardText>
              </View>
              <TouchableOpacity
                style={[st.toggleBtn, isAccepted ? st.toggleAccept : st.toggleReject]}
                onPress={() => onToggle(rec.id)}
              >
                <Ionicons
                  name={isAccepted ? 'checkmark' : 'close'}
                  size={16}
                  color={COLORS.white}
                />
              </TouchableOpacity>
            </View>
            <View style={st.recChange}>
              <StewardText variant="label">Change</StewardText>
              <StewardText variant="body" style={{ marginTop: 2 }}>{rec.change}</StewardText>
            </View>
            <StewardText variant="caption" color={COLORS.sage} style={{ marginTop: SPACING.sm }}>
              {rec.impact}
            </StewardText>
          </StewardCard>
        );
      })}
    </View>
  );
}

// ─── Step 3 — Life Events ─────────────────────────────────────────────────────

function EventsStep({ selected, onToggle }) {
  return (
    <View>
      <StewardText variant="body" color={COLORS.placeholder} style={{ marginBottom: SPACING.lg }}>
        Select anything that happened this past year. This helps me understand context for your updated plan.
      </StewardText>
      <View style={st.eventGrid}>
        {LIFE_EVENTS.map(e => {
          const active = selected.has(e.id);
          return (
            <TouchableOpacity
              key={e.id}
              style={[st.eventPill, active && st.eventPillActive]}
              onPress={() => onToggle(e.id)}
              activeOpacity={0.7}
            >
              <StewardText style={[st.eventLabel, active && st.eventLabelActive]}>
                {e.label}
              </StewardText>
            </TouchableOpacity>
          );
        })}
      </View>
      {selected.size === 0 && (
        <StewardText variant="caption" style={{ textAlign: 'center', marginTop: SPACING.lg }}>
          Nothing to select? That's fine — tap Continue.
        </StewardText>
      )}
    </View>
  );
}

// ─── Step 4 — Income ──────────────────────────────────────────────────────────

function IncomeStep({ income, onChange }) {
  return (
    <View style={{ gap: SPACING.lg }}>
      <StewardText variant="body" color={COLORS.placeholder}>
        Is your monthly take-home still accurate? This is what we build your plan from.
      </StewardText>
      <View style={st.currencyRow}>
        <StewardText style={st.dollarSign}>$</StewardText>
        <TextInput
          style={st.currencyInput}
          value={income}
          onChangeText={t => onChange(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          autoFocus
          returnKeyType="done"
          selectTextOnFocus
          placeholderTextColor={COLORS.placeholder}
          placeholder="0"
        />
      </View>
      <StewardText variant="caption" style={{ textAlign: 'center' }}>
        Monthly net take-home after taxes
      </StewardText>
    </View>
  );
}

// ─── Step 5 — Debts ───────────────────────────────────────────────────────────

function DebtsStep({ debts, balances, onChange, findings }) {
  if (debts.length === 0) {
    return (
      <StewardCard variant="parchment">
        <StewardText variant="body" color={COLORS.placeholder}>
          No debts on file. Nothing to update here.
        </StewardText>
      </StewardCard>
    );
  }

  return (
    <View style={{ gap: SPACING.md }}>
      <StewardText variant="body" color={COLORS.placeholder}>
        Update each balance to where it actually stands today.
      </StewardText>
      {debts.map(debt => {
        const finding = findings.find(
          f => f.type === 'debt_progress' && f.debtName === debt.name
        );
        const estBal = finding?.estimatedCurrentBalance ?? debt.balance;
        const paidPct = debt.balance > 0
          ? Math.min(1, (debt.balance - estBal) / debt.balance)
          : 0;
        const currentValue = balances[debt.name] ?? String(estBal);

        return (
          <StewardCard key={debt.name}>
            <View style={st.debtHeader}>
              <View style={{ flex: 1 }}>
                <StewardText variant="bodyMedium">{debt.name}</StewardText>
                <StewardText variant="caption">
                  Started at {formatCurrency(debt.balance)}
                  {finding ? ` · paid down ${formatCurrency(finding.totalPaid)}` : ''}
                </StewardText>
              </View>
              <StewardText variant="label" color={COLORS.ember}>
                {debt.rate}% APR
              </StewardText>
            </View>

            <View style={st.debtTrack}>
              <View style={[st.debtFill, { width: `${Math.round(paidPct * 100)}%` }]} />
            </View>
            <StewardText variant="caption" style={{ marginBottom: SPACING.md }}>
              {Math.round(paidPct * 100)}% paid off
            </StewardText>

            <StewardText variant="label" style={{ marginBottom: SPACING.xs }}>
              Current balance
            </StewardText>
            <View style={st.balanceRow}>
              <StewardText style={st.balanceDollar}>$</StewardText>
              <TextInput
                style={st.balanceInput}
                value={currentValue}
                onChangeText={t =>
                  onChange(prev => ({ ...prev, [debt.name]: t.replace(/[^0-9]/g, '') }))
                }
                keyboardType="number-pad"
                returnKeyType="done"
                selectTextOnFocus
              />
            </View>
          </StewardCard>
        );
      })}
    </View>
  );
}

// ─── Step 6 — Proposed Plan ───────────────────────────────────────────────────

function ProposedRow({ rec }) {
  const isIncrease = (rec.monthlyDelta || 0) > 0;
  const barColor = isIncrease ? COLORS.ember : COLORS.forest;

  return (
    <StewardCard style={{ paddingBottom: 0, overflow: 'hidden', marginBottom: 0 }}>
      <View style={st.proposedTop}>
        <View style={{ flex: 1 }}>
          <StewardText variant="bodyMedium">{rec.label}</StewardText>
          <StewardText variant="caption" style={{ marginTop: 2 }}>{rec.change}</StewardText>
        </View>
        {rec.monthlyDelta !== 0 && (
          <StewardText style={[st.proposedDelta, { color: barColor }]}>
            {isIncrease ? '+' : ''}{formatCurrency(rec.monthlyDelta)}/mo
          </StewardText>
        )}
      </View>
      <View style={[st.proposedBar, { backgroundColor: barColor }]} />
    </StewardCard>
  );
}

function PlanStep({ recommendations, accepted, income, profile }) {
  const acceptedRecs = recommendations.filter(r => accepted[r.id] !== false);
  const totalDelta = acceptedRecs.reduce((s, r) => s + (r.monthlyDelta || 0), 0);
  const newIncome = Number(income) || profile?.netIncome || 0;

  return (
    <View style={{ gap: SPACING.md }}>
      <StewardCard variant="forest">
        <StewardText variant="label" color={COLORS.white} style={{ opacity: 0.7, marginBottom: SPACING.xs }}>
          Monthly income
        </StewardText>
        <StewardText style={st.incomeFigure}>{formatCurrency(newIncome)}</StewardText>
      </StewardCard>

      {acceptedRecs.length === 0 ? (
        <StewardCard variant="parchment">
          <StewardText variant="body" color={COLORS.placeholder}>
            No changes accepted — your plan carries forward as-is.
          </StewardText>
        </StewardCard>
      ) : (
        <>
          <StewardText variant="label">ACCEPTED CHANGES</StewardText>
          {acceptedRecs.map(rec => (
            <ProposedRow key={rec.id} rec={rec} />
          ))}
          <StewardCard variant="parchment">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <StewardText variant="body">Monthly plan adjustment</StewardText>
              <StewardText
                variant="bodyMedium"
                color={totalDelta > 0 ? COLORS.ember : COLORS.forest}
              >
                {totalDelta > 0 ? '+' : ''}{formatCurrency(totalDelta)}/mo
              </StewardText>
            </View>
          </StewardCard>
        </>
      )}

      <StewardText variant="caption" style={{ textAlign: 'center' }}>
        These changes will shape your next Deploy plan. You can always adjust from there.
      </StewardText>
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function AnnualReviewScreen({ route, navigation }) {
  const profile = route.params?.profile;

  const [step, setStep] = useState(0);
  const [reviewData, setReviewData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [acceptedRecs, setAcceptedRecs] = useState({});
  const [selectedEvents, setSelectedEvents] = useState(new Set());
  const [income, setIncome] = useState(String(profile?.netIncome || ''));
  const [debtBalances, setDebtBalances] = useState(() => {
    const init = {};
    (profile?.debts || []).forEach(d => { init[d.name] = String(d.balance); });
    return init;
  });

  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!profile) {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();

    generateAnnualReview(profile).then(data => {
      setReviewData(data);
      const initial = {};
      (data.recommendations || []).forEach(r => { initial[r.id] = r.accept; });
      setAcceptedRecs(initial);
      setLoading(false);
      loop.stop();
    });

    return () => loop.stop();
  }, []);

  const toggleRec = id => setAcceptedRecs(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleEvent = id => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const goNext = () => setStep(s => Math.min(s + 1, STEP_META.length - 1));
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  const handleComplete = async () => {
    const updatedDebts = (profile?.debts || []).map(d => ({
      ...d,
      balance: Number(debtBalances[d.name]) || d.balance,
    }));

    await saveProfile({
      ...profile,
      netIncome: Number(income) || profile?.netIncome,
      debts: updatedDebts,
      lastReprofileDate: new Date().toISOString(),
    });

    try {
      await AsyncStorage.setItem('steward_anomalies', JSON.stringify([]));
    } catch (err) {
      console.error('[AnnualReview] clear anomalies failed:', err);
    }

    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const { title, sub } = STEP_META[step];
  const isFirst = step === 0;
  const isLast = step === STEP_META.length - 1;
  const continueDisabled = step === 0 && loading;

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity
            style={[s.backBtn, isFirst && s.backBtnHidden]}
            onPress={goBack}
            disabled={isFirst}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.hearth} />
          </TouchableOpacity>
          <View style={s.titleWrap}>
            <StewardText style={s.title}>{title}</StewardText>
            <StewardText style={s.sub}>{sub}</StewardText>
          </View>
          <StewardText style={s.stepCount}>{step + 1} of {STEP_META.length}</StewardText>
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${((step + 1) / STEP_META.length) * 100}%` }]} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && (
            <LedgerStep loading={loading} reviewData={reviewData} profile={profile} pulse={pulse} />
          )}
          {step === 1 && (
            <PatternsStep findings={reviewData?.findings || []} />
          )}
          {step === 2 && (
            <TakeStep
              recommendations={reviewData?.recommendations || []}
              accepted={acceptedRecs}
              onToggle={toggleRec}
            />
          )}
          {step === 3 && (
            <EventsStep selected={selectedEvents} onToggle={toggleEvent} />
          )}
          {step === 4 && (
            <IncomeStep income={income} onChange={setIncome} />
          )}
          {step === 5 && (
            <DebtsStep
              debts={profile?.debts || []}
              balances={debtBalances}
              onChange={setDebtBalances}
              findings={reviewData?.findings || []}
            />
          )}
          {step === 6 && (
            <PlanStep
              recommendations={reviewData?.recommendations || []}
              accepted={acceptedRecs}
              income={income}
              profile={profile}
            />
          )}
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.continueBtn, continueDisabled && s.continueBtnDisabled]}
            onPress={isLast ? handleComplete : goNext}
            disabled={continueDisabled}
          >
            {continueDisabled ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <StewardText style={s.continueLabel}>
                {isLast ? 'Apply these changes' : 'Continue'}
              </StewardText>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.parchment },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnHidden: {
    opacity: 0,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xl,
    color: COLORS.hearth,
    lineHeight: SIZES.xl * 1.2,
  },
  sub: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    marginTop: 1,
  },
  stepCount: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    textAlign: 'right',
  },
  progressTrack: {
    height: 2,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.ember,
    borderRadius: RADIUS.full,
  },
  scroll: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
  },
  footer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.parchment,
  },
  continueBtn: {
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOW.soft,
  },
  continueBtnDisabled: {
    backgroundColor: COLORS.forestLight,
  },
  continueLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.white,
    letterSpacing: 0.3,
  },
});

// ─── Step styles ───────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  prompt: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.md,
    color: COLORS.placeholder,
    lineHeight: SIZES.md * 1.5,
  },
  ledgerHero: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  findingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  implicationRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  implicationBar: {
    width: 2,
    backgroundColor: COLORS.sage,
    borderRadius: RADIUS.full,
    alignSelf: 'stretch',
  },
  recCard: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.forest,
  },
  recCardRejected: {
    borderLeftColor: COLORS.border,
    opacity: 0.55,
  },
  recTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  toggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  toggleAccept: { backgroundColor: COLORS.forest },
  toggleReject: { backgroundColor: COLORS.placeholder },
  recChange: {
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  eventGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  eventPill: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  eventPillActive: {
    backgroundColor: COLORS.forest,
    borderColor: COLORS.forest,
  },
  eventLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.hearth,
  },
  eventLabelActive: {
    color: COLORS.white,
    fontFamily: FONTS.sans.medium,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dollarSign: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xxxl,
    color: COLORS.hearth,
    lineHeight: SIZES.xxxl * 1.2,
  },
  currencyInput: {
    flex: 1,
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xxxl,
    color: COLORS.hearth,
    lineHeight: SIZES.xxxl * 1.2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.xs,
  },
  debtHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  debtTrack: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  debtFill: {
    height: '100%',
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.full,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.white,
    gap: SPACING.xs,
  },
  balanceDollar: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
  },
  balanceInput: {
    flex: 1,
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    paddingVertical: SPACING.sm + 2,
  },
  incomeFigure: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xxxl,
    color: COLORS.white,
    lineHeight: SIZES.xxxl * 1.2,
  },
  proposedTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  proposedDelta: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    flexShrink: 0,
  },
  proposedBar: {
    height: 3,
    marginHorizontal: -SPACING.md,
  },
});

// ─── Skeleton styles ───────────────────────────────────────────────────────────

const sk = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    backgroundColor: COLORS.parchmentDark,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.border,
  },
  line: {
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
  },
});
