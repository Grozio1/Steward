import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOW } from '../../constants/brand';
import { getProfile, getPlan, formatCurrency, saveLifeEvent } from '../../data/store';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';

// ─── Life events ─────────────────────────────────────────────────────────────────
const EVENTS = [
  { id: 'job_loss',      label: 'Job loss' },
  { id: 'divorce',       label: 'Divorce or separation' },
  { id: 'new_baby',      label: 'New baby' },
  { id: 'career_change', label: 'Career change' },
  { id: 'loss_spouse',   label: 'Loss of a spouse' },
  { id: 'medical',       label: 'Medical emergency' },
  { id: 'other',         label: 'Something else' },
];

// ─── Stub response generator ─────────────────────────────────────────────────────
// Voice: grandparent — warm, plain, direct. Never starts with numbers.
function generateResponse({ eventId, context, profile, plan }) {
  const name = profile?.name || '';
  const savings = Number(profile?.savings) || 0;
  const income = Number(profile?.netIncome) || 0;
  const fixedTotal = (profile?.fixedCommitments || []).reduce((s, c) => s + Number(c.amount || 0), 0);
  const debtMin = (profile?.debts || []).reduce((s, d) => s + Number(d.minimum || 0), 0);
  const monthlyObligations = fixedTotal + debtMin;
  const runway = monthlyObligations > 0 ? Math.floor(savings / monthlyObligations) : null;

  // Flexible commitments = anything not debt
  const flexible = (profile?.fixedCommitments || []).filter((c) =>
    !['rent', 'mortgage'].some((k) => c.name?.toLowerCase().includes(k))
  );

  // Acknowledgment — event-specific, human, no numbers
  const acknowledgments = {
    job_loss: `${name ? name + ', losing' : 'Losing'} your job is one of the harder things to sit with. The uncertainty is real. But you have more to work with than it might feel like right now, and we're going to look at it together.`,
    divorce: `${name ? name + ', this' : 'This'} is a lot to carry. When a household splits, everything has to be rethought — and that's exhausting. Let's take it one piece at a time and figure out what stability looks like from here.`,
    new_baby: `A new baby changes everything about how money moves through your life. That's not a problem — it's just a new set of priorities to get right. Let's make sure you're set up for it.`,
    career_change: `Changing direction takes courage, and it usually means a transition period of uncertainty. That's manageable. Let's look at what your situation can actually absorb.`,
    loss_spouse: `${name ? name + ', I' : 'I'}'m sorry. There's no right way to navigate this kind of loss. When you're ready, I'm here to help you make sure the financial side of things doesn't add to what you're already carrying.`,
    medical: `A medical emergency puts everything else on hold. Let's make sure you know exactly where you stand and what can wait — so you can focus on what matters most right now.`,
    other: `${name ? name + ', something' : 'Something'} changed. That's what this is here for. Let's look at what you have and figure out what the right next step is.`,
  };

  const acknowledgment = acknowledgments[eventId] || acknowledgments.other;

  // First action — event-specific
  const firstActions = {
    job_loss: 'File for unemployment benefits today if you haven\'t. That clock starts when you file, not when you lost the job.',
    divorce: 'Separate any joint accounts and establish your own within the next two weeks. Clarity on what\'s yours is the first step.',
    new_baby: 'Add the baby to your health insurance within 30 days — most plans require it. After that, look at your monthly budget.',
    career_change: 'Give yourself a written transition timeline — start date, expected first paycheck, gap in weeks. That number drives everything else.',
    loss_spouse: 'Contact your bank and any joint account holders to protect access. Only when you\'re ready.',
    medical: 'Request an itemized bill from the hospital before paying anything. Errors are common and bills are often negotiable.',
    other: 'Write down the one thing that feels most urgent right now. That\'s where we start.',
  };

  const firstAction = firstActions[eventId] || firstActions.other;

  // Recovery arc steps
  const recoverySteps = [];

  if (eventId === 'job_loss' || eventId === 'career_change') {
    recoverySteps.push(
      { week: 'Now', label: 'Cover obligations', detail: `${formatCurrency(monthlyObligations)}/mo in fixed costs. Savings gives you ${runway !== null ? `${runway} months of runway` : 'a cushion'}.` },
      { week: 'Weeks 1–2', label: 'Cut discretionary', detail: 'Pause Quality of life and Ad hoc spending until income resumes.' },
      { week: 'Month 1', label: 'Stabilize', detail: 'Income replacement (job, freelance, benefits) covers obligations. Stop the bleed.' },
      { week: 'Month 2+', label: 'Rebuild', detail: 'Once income is steady, restore normal allocation and replenish savings.' },
    );
  } else if (eventId === 'new_baby') {
    recoverySteps.push(
      { week: 'Now', label: 'Insurance + essentials', detail: 'Add baby to health plan. Identify first 3 months of baby costs.' },
      { week: 'Month 1', label: 'Adjust the plan', detail: 'Rebuild your Deploy plan with new expenses accounted for.' },
      { week: 'Months 2–3', label: 'Find the flex', detail: 'Quality of life spending usually finds its own level. Watch it for 60 days.' },
      { week: 'Month 4+', label: 'New normal', detail: 'You\'ll know your new baseline by now. Lock it in.' },
    );
  } else {
    recoverySteps.push(
      { week: 'Now', label: 'Protect the floor', detail: `Fixed costs and debt minimums — ${formatCurrency(monthlyObligations)}/mo — come first, always.` },
      { week: 'Week 1–2', label: 'Assess', detail: 'Know exactly what you have. Then decide what can wait.' },
      { week: 'Month 1', label: 'Stabilize', detail: 'One month of covering obligations without adding debt is a win.' },
      { week: 'Month 2+', label: 'Recover', detail: 'Once stable, start rebuilding the buffer. One step at a time.' },
    );
  }

  return {
    acknowledgment,
    firstAction,
    savings,
    income,
    monthlyObligations,
    runway,
    flexible,
    recoverySteps,
  };
}

// ─── Recovery timeline ────────────────────────────────────────────────────────────
function TimelineStep({ step, index, total }) {
  const isLast = index === total - 1;
  return (
    <View style={tl.row}>
      <View style={tl.left}>
        <View style={tl.dot} />
        {!isLast && <View style={tl.line} />}
      </View>
      <View style={tl.content}>
        <StewardText style={tl.week}>{step.week}</StewardText>
        <StewardText style={tl.label}>{step.label}</StewardText>
        <StewardText style={tl.detail}>{step.detail}</StewardText>
        {!isLast && <View style={{ height: SPACING.md }} />}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────────
export default function NavigateScreen() {
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [context, setContext] = useState('');
  const [thinking, setThinking] = useState(false);
  const [response, setResponse] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getProfile(), getPlan()]).then(([p, pl]) => {
        if (!active) return;
        setProfile(p);
        setPlan(pl);
      });
      return () => { active = false; };
    }, [])
  );

  const handleNavigate = async () => {
    if (!selectedEvent) return;
    setThinking(true);
    setResponse(null);
    await new Promise((r) => setTimeout(r, 900));
    const result = generateResponse({ eventId: selectedEvent.id, context, profile, plan });
    setResponse(result);
    saveLifeEvent({ event: selectedEvent.label, notes: context });
    setThinking(false);
  };

  const reset = () => {
    setSelectedEvent(null);
    setContext('');
    setResponse(null);
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={s.header}>
          <StewardText style={s.title}>Navigate</StewardText>
          <View style={s.alwaysRow}>
            <View style={s.alwaysDot} />
            <StewardText style={s.alwaysText}>Always available. No paywall. Ever.</StewardText>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!response ? (
            <>
              <StewardText style={s.prompt}>
                Something changed. Tell me what happened.
              </StewardText>

              {/* Event grid */}
              <View style={s.eventGrid}>
                {EVENTS.map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    style={[s.eventBtn, selectedEvent?.id === e.id && s.eventBtnActive]}
                    onPress={() => setSelectedEvent(e)}
                    activeOpacity={0.7}
                  >
                    <StewardText style={[s.eventLabel, selectedEvent?.id === e.id && s.eventLabelActive]}>
                      {e.label}
                    </StewardText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Optional context */}
              {selectedEvent && (
                <View style={s.contextWrap}>
                  <StewardText style={s.contextLabel}>Anything else I should know? (optional)</StewardText>
                  <TextInput
                    style={s.contextInput}
                    value={context}
                    onChangeText={setContext}
                    placeholder="e.g. Two weeks of severance. Partner still employed."
                    placeholderTextColor={COLORS.placeholder}
                    multiline
                    blurOnSubmit
                    returnKeyType="done"
                    onSubmitEditing={() => {}}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[s.goBtn, (!selectedEvent || thinking) && s.goBtnDisabled]}
                onPress={handleNavigate}
                disabled={!selectedEvent || thinking}
              >
                {thinking ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <StewardText style={s.goBtnLabel}>Let's figure this out</StewardText>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Event tag */}
              <View style={s.eventTag}>
                <StewardText style={s.eventTagLabel}>{selectedEvent.label.toUpperCase()}</StewardText>
              </View>

              {/* Acknowledgment — always first, never numbers */}
              <StewardCard variant="parchment" style={s.ackCard}>
                <StewardText style={s.ackText}>{response.acknowledgment}</StewardText>
              </StewardCard>

              {/* What you have */}
              <StewardText style={s.sectionLabel}>WHAT YOU HAVE</StewardText>
              <StewardCard style={s.inventoryCard}>
                <View style={s.inventoryRow}>
                  <StewardText style={s.inventoryKey}>Monthly income</StewardText>
                  <StewardText style={s.inventoryVal}>{formatCurrency(response.income)}</StewardText>
                </View>
                <View style={s.inventoryRow}>
                  <StewardText style={s.inventoryKey}>Liquid savings</StewardText>
                  <StewardText style={s.inventoryVal}>{formatCurrency(response.savings)}</StewardText>
                </View>
                <View style={s.inventoryRow}>
                  <StewardText style={s.inventoryKey}>Monthly obligations</StewardText>
                  <StewardText style={s.inventoryVal}>{formatCurrency(response.monthlyObligations)}</StewardText>
                </View>
                {response.runway !== null && (
                  <View style={[s.inventoryRow, { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border }]}>
                    <StewardText style={s.inventoryKey}>Runway at current savings</StewardText>
                    <StewardText style={[s.inventoryVal, { color: response.runway >= 3 ? COLORS.forest : COLORS.ember }]}>
                      {response.runway} {response.runway === 1 ? 'month' : 'months'}
                    </StewardText>
                  </View>
                )}
              </StewardCard>

              {/* What's flexible */}
              {response.flexible.length > 0 && (
                <>
                  <StewardText style={s.sectionLabel}>WHAT'S FLEXIBLE</StewardText>
                  <StewardCard style={s.inventoryCard}>
                    <StewardText style={s.flexHint}>
                      These commitments could potentially be paused or reduced in a pinch.
                    </StewardText>
                    {response.flexible.map((c, i) => (
                      <View key={i} style={s.inventoryRow}>
                        <StewardText style={s.inventoryKey}>{c.name}</StewardText>
                        <StewardText style={s.inventoryVal}>{formatCurrency(c.amount)}/mo</StewardText>
                      </View>
                    ))}
                  </StewardCard>
                </>
              )}

              {/* First action */}
              <StewardText style={s.sectionLabel}>DO THIS FIRST</StewardText>
              <StewardCard variant="forest" style={s.actionCard}>
                <StewardText style={s.actionText}>{response.firstAction}</StewardText>
              </StewardCard>

              {/* Recovery timeline */}
              <StewardText style={s.sectionLabel}>RECOVERY ARC</StewardText>
              <StewardCard style={s.timelineCard}>
                {response.recoverySteps.map((step, i) => (
                  <TimelineStep key={i} step={step} index={i} total={response.recoverySteps.length} />
                ))}
              </StewardCard>

              {/* Start over */}
              <TouchableOpacity style={s.resetBtn} onPress={reset}>
                <StewardText style={s.resetLabel}>Start over</StewardText>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.parchment },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.xs,
  },
  title: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xxl,
    color: COLORS.hearth,
    lineHeight: SIZES.xxl * 1.2,
  },
  alwaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  alwaysDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.ember,
  },
  alwaysText: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.sage,
    letterSpacing: 0.3,
  },

  scroll: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
  },
  prompt: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.md,
    color: COLORS.hearth,
    lineHeight: SIZES.md * 1.5,
    marginBottom: SPACING.lg,
  },

  eventGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  eventBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  eventBtnActive: {
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

  contextWrap: { marginBottom: SPACING.lg },
  contextLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.hearth,
    marginBottom: SPACING.sm,
  },
  contextInput: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minHeight: 72,
    textAlignVertical: 'top',
  },

  goBtn: {
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOW.soft,
  },
  goBtnDisabled: { backgroundColor: COLORS.forestLight },
  goBtnLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.white,
    letterSpacing: 0.3,
  },

  eventTag: {
    marginBottom: SPACING.md,
  },
  eventTagLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.ember,
    letterSpacing: 1.2,
  },

  ackCard: { marginBottom: SPACING.lg },
  ackText: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    lineHeight: SIZES.base * 1.8,
  },

  sectionLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.sage,
    letterSpacing: 1.2,
    marginBottom: SPACING.sm,
  },

  inventoryCard: { marginBottom: SPACING.lg },
  inventoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  inventoryKey: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
  },
  inventoryVal: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.hearth,
  },
  flexHint: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    lineHeight: SIZES.xs * 1.6,
    marginBottom: SPACING.sm,
  },

  actionCard: { marginBottom: SPACING.lg },
  actionText: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.white,
    lineHeight: SIZES.base * 1.7,
  },

  timelineCard: { marginBottom: SPACING.lg },

  resetBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  resetLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
  },
});

// ─── Timeline styles ──────────────────────────────────────────────────────────────
const tl = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  left: {
    alignItems: 'center',
    width: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.ember,
    marginTop: 4,
  },
  line: {
    flex: 1,
    width: 1.5,
    backgroundColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  content: { flex: 1 },
  week: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.ember,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  label: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    marginBottom: 2,
  },
  detail: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
    lineHeight: SIZES.sm * 1.6,
  },
});
