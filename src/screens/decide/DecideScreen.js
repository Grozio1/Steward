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
import { getProfile, getPlan, getSpends, currentMonth, formatCurrency } from '../../data/store';
import { Text } from 'react-native';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';

// ─── Category → layer mapping ─────────────────────────────────────────────────────
const CATEGORIES = [
  { label: 'Food',           layer: 'food' },
  { label: 'Quality of life', layer: 'qol' },
  { label: 'Ad hoc',         layer: 'adhoc' },
  { label: 'Fixed',          layer: 'fixed' },
];

// ─── Stub insight generator ───────────────────────────────────────────────────────
// Replace with real API call when ready. Voice: grandparent — direct, warm, plain.
function generateInsight({ amount, category, remaining, canAfford, monthDaysLeft }) {
  const amt = formatCurrency(amount);
  const rem = formatCurrency(remaining);

  if (!canAfford) {
    if (remaining <= 0) {
      return `That bucket is already empty. Spending ${amt} here means pulling from somewhere else — decide which one.`;
    }
    return `You've got ${rem} left in ${category}. This is ${formatCurrency(amount - remaining)} more than that. It'll fit if you trim something else.`;
  }

  const pct = Math.round((amount / (remaining + amount)) * 100);
  const daysNote = monthDaysLeft > 10
    ? `You've got ${monthDaysLeft} days left this month.`
    : `Only ${monthDaysLeft} days left this month — worth keeping some buffer.`;

  if (pct > 60) {
    return `That's ${pct}% of what's left in ${category}. ${daysNote} You can afford it — just know what you're trading.`;
  }
  if (pct > 30) {
    return `Reasonable. Leaves ${rem} behind, which should cover the rest of the month in this bucket.`;
  }
  return `Comfortable. ${amt} barely dents ${category} this month. Go ahead.`;
}

// ─── Path cards ───────────────────────────────────────────────────────────────────
function PathCard({ label, description, action, onChoose, highlight }) {
  return (
    <TouchableOpacity
      style={[path.card, highlight && path.cardHighlight]}
      onPress={onChoose}
      activeOpacity={0.75}
    >
      <View style={path.top}>
        <StewardText style={[path.label, highlight && path.labelHighlight]}>{label}</StewardText>
      </View>
      <StewardText style={[path.desc, highlight && path.descHighlight]}>{description}</StewardText>
      <View style={[path.actionRow, highlight && path.actionRowHighlight]}>
        <StewardText style={[path.action, highlight && path.actionHighlight]}>{action}</StewardText>
      </View>
    </TouchableOpacity>
  );
}

// ─── Before/after bar ─────────────────────────────────────────────────────────────
function ImpactBar({ label, before, after, total }) {
  const safeTotal = total || 1;
  const beforePct = Math.min((before / safeTotal) * 100, 100);
  const afterPct = Math.min((after / safeTotal) * 100, 100);
  const over = after > total;

  return (
    <View style={impact.wrap}>
      <View style={impact.labelRow}>
        <StewardText style={impact.bucketLabel}>{label}</StewardText>
        <StewardText style={impact.amounts}>
          {formatCurrency(before)} → <StewardText style={{ color: over ? COLORS.error : COLORS.forest }}>{formatCurrency(after)}</StewardText>
        </StewardText>
      </View>
      <View style={impact.track}>
        <View style={[impact.barBefore, { width: `${beforePct}%` }]} />
        <View style={[impact.barAfter, { width: `${Math.max(afterPct - beforePct, 0)}%`, backgroundColor: over ? COLORS.error : COLORS.ember }]} />
      </View>
      <StewardText style={impact.remaining}>
        {over
          ? `${formatCurrency(after - total)} over budget`
          : `${formatCurrency(total - after)} remaining after`}
      </StewardText>
    </View>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────────
export default function DecideScreen() {
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [spends, setSpends] = useState([]);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [result, setResult] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [chosen, setChosen] = useState(null);

  const month = currentMonth();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getProfile(), getPlan(month), getSpends(month)]).then(([p, pl, sp]) => {
        if (!active) return;
        setProfile(p);
        setPlan(pl);
        setSpends(sp);
      });
      return () => { active = false; };
    }, [month])
  );

  const reset = () => {
    setAmount('');
    setResult(null);
    setChosen(null);
  };

  const handleDecide = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;

    setThinking(true);
    setResult(null);
    setChosen(null);

    // Find the matching allocation
    const alloc = plan?.allocations?.find((a) => a.layer === category.layer)
      || plan?.allocations?.find((a) => a.layer === 'qol'); // fallback

    const budgeted = alloc?.amount || 0;
    const spent = alloc?.spent || 0;
    const remaining = budgeted - spent;
    const canAfford = amt <= remaining;

    // Days left in month
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthDaysLeft = daysInMonth - now.getDate();

    // Stub "thinking" delay
    await new Promise((r) => setTimeout(r, 800));

    const insight = generateInsight({
      amount: amt,
      category: category.label,
      remaining,
      canAfford,
      monthDaysLeft,
    });

    // Build paths
    const paths = [];

    if (canAfford) {
      paths.push({
        id: 'go',
        label: 'Go ahead',
        description: `Spend ${formatCurrency(amt)} now. Leaves ${formatCurrency(remaining - amt)} in ${category.label}.`,
        action: 'Log it and move on →',
        highlight: true,
      });
    }

    if (!canAfford || remaining - amt < budgeted * 0.2) {
      paths.push({
        id: 'trim',
        label: 'Find the room',
        description: `Look at what's already been spent in ${category.label} this month. Something might be trimmable.`,
        action: 'Check my spending →',
      });
    }

    paths.push({
      id: 'wait',
      label: 'Wait on it',
      description: `Hold off for now. Revisit at the start of next month when the bucket resets.`,
      action: 'Skip for now →',
    });

    if (!canAfford && remaining > 0) {
      paths.push({
        id: 'partial',
        label: `Spend ${formatCurrency(remaining)} instead`,
        description: `Use what's left in the bucket. The rest waits.`,
        action: 'Log partial amount →',
      });
    }

    setResult({
      insight,
      canAfford,
      budgeted,
      spent,
      remaining,
      amt,
      alloc,
      paths,
    });

    setThinking(false);
  };

  const noPlan = !plan;
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={s.header}>
          <StewardText style={s.title}>Decide</StewardText>
          <StewardText style={s.month}>{monthLabel}</StewardText>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {noPlan ? (
            <StewardCard variant="parchment" style={s.noPlanCard}>
              <StewardText style={s.noPlanText}>
                Build your plan in Deploy first. Then bring your spending decisions here.
              </StewardText>
            </StewardCard>
          ) : (
            <>
              {/* Input area */}
              <StewardCard style={s.inputCard}>
                <StewardText style={s.inputLabel}>I'm thinking about spending…</StewardText>

                <View style={s.amountRow}>
                  <Text style={s.dollarSign}>$</Text>
                  <TextInput
                    style={s.amountInput}
                    value={amount}
                    onChangeText={(t) => { setAmount(t.replace(/[^0-9]/g, '')); setResult(null); setChosen(null); }}
                    placeholder="0"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                </View>

                <StewardText style={s.inputLabel}>Category</StewardText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
                  <View style={{ flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: 2 }}>
                    {CATEGORIES.map((c) => (
                      <TouchableOpacity
                        key={c.label}
                        style={[s.pill, category.label === c.label && s.pillActive]}
                        onPress={() => { setCategory(c); setResult(null); setChosen(null); }}
                      >
                        <StewardText style={[s.pillLabel, category.label === c.label && s.pillLabelActive]}>
                          {c.label}
                        </StewardText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={[s.decideBtn, (!amount || thinking) && s.decideBtnDisabled]}
                  onPress={handleDecide}
                  disabled={!amount || thinking}
                >
                  {thinking ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <StewardText style={s.decideBtnLabel}>Should I?</StewardText>
                  )}
                </TouchableOpacity>
              </StewardCard>

              {/* Result */}
              {result && !thinking && (
                <>
                  {/* Before/after */}
                  <StewardCard style={s.impactCard}>
                    <StewardText style={s.impactTitle}>IMPACT</StewardText>
                    <ImpactBar
                      label={result.alloc?.name || category.label}
                      before={result.spent}
                      after={result.spent + result.amt}
                      total={result.budgeted}
                    />
                  </StewardCard>

                  {/* Insight */}
                  <StewardCard variant="parchment" style={s.insightCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm }}>
                      <StewardText style={s.spark}>✦</StewardText>
                      <StewardText style={[s.insightText, { flex: 1 }]}>{result.insight}</StewardText>
                    </View>
                  </StewardCard>

                  {/* Paths */}
                  <StewardText style={s.pathsLabel}>YOUR OPTIONS</StewardText>
                  {result.paths.map((p) => (
                    <PathCard
                      key={p.id}
                      {...p}
                      onChoose={() => setChosen(p.id)}
                    />
                  ))}

                  {chosen && (
                    <TouchableOpacity style={s.resetBtn} onPress={reset}>
                      <StewardText style={s.resetLabel}>Start over</StewardText>
                    </TouchableOpacity>
                  )}
                </>
              )}
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
  },
  title: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xxl,
    color: COLORS.hearth,
    lineHeight: SIZES.xxl * 1.2,
  },
  month: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },

  noPlanCard: { padding: SPACING.lg },
  noPlanText: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
    lineHeight: SIZES.base * 1.6,
    textAlign: 'center',
  },

  inputCard: { marginBottom: SPACING.md },
  inputLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.hearth,
    marginBottom: SPACING.sm,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  dollarSign: {
    fontSize: SIZES.xxxl,
    color: COLORS.placeholder,
    marginRight: SPACING.xs,
  },
  amountInput: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xxxl,
    color: COLORS.hearth,
    flex: 1,
  },
  pill: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  pillActive: {
    backgroundColor: COLORS.forest,
    borderColor: COLORS.forest,
  },
  pillLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
  },
  pillLabelActive: {
    color: COLORS.white,
  },
  decideBtn: {
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOW.soft,
  },
  decideBtnDisabled: { backgroundColor: COLORS.forestLight },
  decideBtnLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.white,
    letterSpacing: 0.3,
  },

  impactCard: { marginBottom: SPACING.md },
  impactTitle: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.sage,
    letterSpacing: 1.2,
    marginBottom: SPACING.md,
  },

  insightCard: { marginBottom: SPACING.md },
  insightText: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    lineHeight: SIZES.base * 1.7,
  },
  spark: {
    fontSize: SIZES.base,
    color: COLORS.ember,
    lineHeight: SIZES.base * 1.7,
  },

  pathsLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.sage,
    letterSpacing: 1.2,
    marginBottom: SPACING.sm,
  },

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

// ─── Path styles ──────────────────────────────────────────────────────────────────
const path = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.soft,
  },
  cardHighlight: {
    backgroundColor: COLORS.forest,
    borderColor: COLORS.forest,
  },
  top: { marginBottom: SPACING.xs },
  label: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
  },
  labelHighlight: { color: COLORS.white },
  desc: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
    lineHeight: SIZES.sm * 1.6,
    marginBottom: SPACING.sm,
  },
  descHighlight: { color: COLORS.white, opacity: 0.85 },
  actionRow: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  actionRowHighlight: { borderTopColor: COLORS.white, opacity: 0.5 },
  action: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.sage,
  },
  actionHighlight: { color: COLORS.white, opacity: 1 },
});

// ─── Impact bar styles ────────────────────────────────────────────────────────────
const impact = StyleSheet.create({
  wrap: { gap: SPACING.xs },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bucketLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.hearth,
  },
  amounts: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
  },
  track: {
    height: 8,
    backgroundColor: COLORS.parchmentDark,
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    overflow: 'hidden',
    marginVertical: SPACING.xs,
  },
  barBefore: {
    height: '100%',
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.full,
  },
  barAfter: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  remaining: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
  },
});
