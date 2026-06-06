import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOW } from '../../constants/brand';
import {
  getProfile, getPlan, savePlan, currentMonth, formatCurrency,
  getLastDeployDate, saveLastDeployDate, saveEssentialActuals,
} from '../../data/store';
import { generatePlan } from '../../ai/stub';
import { Ionicons } from '@expo/vector-icons';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';

// ─── Section groupings ────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    key: 'foundation',
    label: 'FOUNDATION LAYERS',
    lockIcon: true,
    match: (a) => a.layer === 'fixed' || a.layer === 'debt_floor',
  },
  {
    key: 'strategic',
    label: 'STRATEGIC LAYERS',
    lockIcon: false,
    match: (a) => a.layer === 'debt_accelerator' || a.layer === 'stability' || (a.layer || '').startsWith('goal_'),
  },
  {
    key: 'life',
    label: 'LIFE BUCKETS',
    lockIcon: false,
    match: (a) => a.layer === 'life' || a.layer === 'adhoc',
  },
];

// ─── Layer config ────────────────────────────────────────────────────────────────
const LAYER_META = {
  fixed:            { locked: true,  color: COLORS.forest,      label: 'Fixed — auto-committed' },
  debt_floor:       { locked: true,  color: COLORS.forest,      label: 'Debt minimums — floor' },
  debt_accelerator: { locked: false, color: COLORS.ember,       label: 'Extra debt payoff' },
  stability:        { locked: false, color: COLORS.ember,       label: 'Stability buffer' },
  life:             { locked: false, color: COLORS.sage,        label: 'Active bucket' },
  adhoc:            { locked: false, color: COLORS.placeholder, label: 'Surprises happen' },
};

// ─── Helper: previous month key (YYYY-MM) ────────────────────────────────────────
function previousMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Allocation row ───────────────────────────────────────────────────────────────
function AllocationRow({ alloc, editing, onEdit, onAmountChange, onDone, confirmed }) {
  const meta = LAYER_META[alloc.layer] || {};
  const locked = meta.locked;

  return (
    <StewardCard style={row.card}>
      <View style={row.top}>
        <View style={{ flex: 1 }}>
          <StewardText style={row.name}>{alloc.name}</StewardText>
          <StewardText style={row.note}>{alloc.note}</StewardText>
        </View>

        {locked ? (
          <View style={row.lockedAmt}>
            <StewardText style={row.lockedAmtText}>{formatCurrency(alloc.amount)}</StewardText>
            <StewardText style={row.lockIcon}>🔒</StewardText>
          </View>
        ) : editing ? (
          <View style={row.editWrap}>
            <StewardText style={row.editDollar}>$</StewardText>
            <TextInput
              style={row.editInput}
              value={alloc._draft}
              onChangeText={onAmountChange}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              onBlur={onDone}
              onSubmitEditing={onDone}
            />
          </View>
        ) : (
          <TouchableOpacity style={row.amtBtn} onPress={onEdit} disabled={confirmed}>
            <StewardText style={row.amtText}>{formatCurrency(alloc.amount)}</StewardText>
            {!confirmed && <StewardText style={row.editHint}>tap to adjust</StewardText>}
          </TouchableOpacity>
        )}
      </View>

      {/* Color bar */}
      <View style={[row.bar, { backgroundColor: meta.color || COLORS.border }]} />
    </StewardCard>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────────
function EmptyState({ onGenerate, loading }) {
  return (
    <View style={empty.wrap}>
      <StewardText style={empty.heading}>No plan yet for this month.</StewardText>
      <StewardText style={empty.body}>
        When your paycheck lands, come here first. I'll build your allocation in seconds — you review, adjust, and confirm before a dollar is spent.
      </StewardText>
      <TouchableOpacity
        style={[empty.btn, loading && empty.btnDisabled]}
        onPress={onGenerate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.white} size="small" />
        ) : (
          <StewardText style={empty.btnLabel}>Build my plan</StewardText>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────────
export default function DeployScreen() {
  const navigation = useNavigation();

  // Existing state
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Phase state
  const [deployPhase, setDeployPhase] = useState('check');
  const [lastDeployDate, setLastDeployDate] = useState(null);
  const [lastMonthPlan, setLastMonthPlan] = useState(null);
  const [reconcileActuals, setReconcileActuals] = useState({});

  const month = currentMonth();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const prevMonth = previousMonth();
      Promise.all([
        getProfile(),
        getPlan(month),
        getLastDeployDate(),
        getPlan(prevMonth),
      ]).then(([p, pl, lastDate, prevPlan]) => {
        if (!active) return;
        setProfile(p);
        setLastDeployDate(lastDate);
        setLastMonthPlan(prevPlan);

        if (pl) {
          setPlan(pl);
          setAllocations(pl.allocations.map((a) => ({ ...a, _draft: String(a.amount) })));
          setConfirmed(true);
          setDeployPhase('allocate');
          return;
        }

        const today = new Date().toISOString().split('T')[0];
        const todayDay = new Date().getDate();
        const payDay = parseInt(p?.nextPayDate);
        const isPayDay = p?.nextPayDate && !isNaN(payDay) && todayDay === payDay;

        if (isPayDay && lastDate !== today) {
          setDeployPhase('check');
        } else {
          setDeployPhase('allocate');
        }
      });
      return () => { active = false; };
    }, [month])
  );

  const handleGenerate = async () => {
    if (!profile) return;
    setGenerating(true);
    try {
      const newPlan = await generatePlan(profile);
      setPlan(newPlan);
      setAllocations(newPlan.allocations.map((a) => ({ ...a, _draft: String(a.amount) })));
      setConfirmed(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleRebuild = () => {
    Alert.alert(
      'Rebuild plan?',
      'This will regenerate your allocations from your current profile. Any manual adjustments will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rebuild', onPress: handleGenerate },
      ]
    );
  };

  const handleAmountChange = (text, i) => {
    const updated = [...allocations];
    updated[i] = { ...updated[i], _draft: text.replace(/[^0-9]/g, '') };
    setAllocations(updated);
  };

  const handleDone = (i) => {
    const updated = [...allocations];
    const val = Number(updated[i]._draft) || 0;
    updated[i] = { ...updated[i], amount: val, _draft: String(val) };
    setAllocations(updated);
    setEditingIndex(null);
  };

  const handleConfirm = async () => {
    const finalPlan = {
      ...plan,
      allocations: allocations.map(({ _draft, ...rest }) => rest),
    };
    await savePlan(finalPlan, month);
    await saveLastDeployDate(new Date().toISOString().split('T')[0]);
    setConfirmed(true);
    setDeployPhase('confirmed');
    Alert.alert('Plan confirmed.', 'Your money knows where it\'s going.');
  };

  const reconcileItems = (lastMonthPlan?.allocations || []).filter(
    (a) => a.layer === 'fixed' || a.layer === 'regular_expenses'
  );

  const handleReconcileSave = async () => {
    const toSave = {};
    for (const item of reconcileItems) {
      const val = reconcileActuals[item.name];
      if (val && Number(val) > 0) {
        toSave[item.name] = Number(val);
      }
    }
    if (Object.keys(toSave).length > 0) {
      await saveEssentialActuals(month, toSave);
    }
    setDeployPhase('allocate');
  };

  // Totals
  const totalAllocated = allocations.reduce((s, a) => s + (a.amount || 0), 0);
  const income = plan?.income || profile?.netIncome || 0;
  const unallocated = income - totalAllocated;

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // ─── PHASE: check ─────────────────────────────────────────────────────────────
  if (deployPhase === 'check') {
    return (
      <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
        <View style={s.phaseWrap}>
          <StewardText style={s.phaseHeading}>Payday.</StewardText>
          <StewardText style={s.phaseBody}>Did your paycheck arrive?</StewardText>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => {
              if (reconcileItems.length > 0) {
                setDeployPhase('reconcile');
              } else {
                setDeployPhase('allocate');
              }
            }}
            activeOpacity={0.85}
          >
            <StewardText style={s.primaryBtnLabel}>Yes, let's put it to work</StewardText>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.outlineBtn}
            onPress={() => navigation.navigate('Dashboard')}
            activeOpacity={0.85}
          >
            <StewardText style={s.outlineBtnLabel}>Not yet — check back tomorrow</StewardText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── PHASE: reconcile ─────────────────────────────────────────────────────────
  if (deployPhase === 'reconcile') {
    return (
      <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.reconcileScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <StewardText style={s.phaseHeading}>Before we look forward</StewardText>
            <StewardText style={[s.phaseBody, { marginBottom: SPACING.lg }]}>
              How did last month's essentials come in?
            </StewardText>

            {reconcileItems.map((item, i) => (
              <StewardCard key={i} style={s.reconcileCard}>
                <View style={s.reconcileRow}>
                  <View style={{ flex: 1 }}>
                    <StewardText style={s.reconcileName}>{item.name}</StewardText>
                    <StewardText style={s.reconcileEstimate}>
                      Estimated: {formatCurrency(item.amount)}
                    </StewardText>
                  </View>
                  <View style={s.reconcileInputWrap}>
                    <StewardText style={s.reconcileDollar}>$</StewardText>
                    <TextInput
                      style={s.reconcileInput}
                      placeholder="Actual"
                      placeholderTextColor={COLORS.placeholder}
                      value={reconcileActuals[item.name] || ''}
                      onChangeText={(t) => setReconcileActuals(prev => ({
                        ...prev,
                        [item.name]: t.replace(/[^0-9]/g, ''),
                      }))}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </StewardCard>
            ))}

            <TouchableOpacity
              style={[s.primaryBtn, { marginTop: SPACING.lg }]}
              onPress={handleReconcileSave}
              activeOpacity={0.85}
            >
              <StewardText style={s.primaryBtnLabel}>Looks about right</StewardText>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.skipBtn}
              onPress={() => setDeployPhase('allocate')}
              activeOpacity={0.7}
            >
              <StewardText style={s.skipBtnLabel}>Skip for now</StewardText>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── PHASE: allocate | confirmed ─────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <StewardText style={s.title}>Deploy</StewardText>
            <StewardText style={s.month}>{monthLabel}</StewardText>
          </View>
          {plan && (
            <TouchableOpacity style={s.rebuildBtn} onPress={handleRebuild}>
              <StewardText style={s.rebuildLabel}>Rebuild</StewardText>
            </TouchableOpacity>
          )}
        </View>

        {!plan && !generating ? (
          <EmptyState onGenerate={handleGenerate} loading={generating} />
        ) : generating ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={COLORS.forest} size="large" />
            <StewardText style={s.loadingText}>Building your plan…</StewardText>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Income summary */}
            <StewardCard variant="forest" style={s.summaryCard}>
              <View style={s.summaryRow}>
                <View style={s.summaryItem}>
                  <StewardText style={s.summaryValue}>{formatCurrency(income)}</StewardText>
                  <StewardText style={s.summaryItemLabel}>Income</StewardText>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryItem}>
                  <StewardText style={s.summaryValue}>{formatCurrency(totalAllocated)}</StewardText>
                  <StewardText style={s.summaryItemLabel}>Allocated</StewardText>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryItem}>
                  <StewardText style={[s.summaryValue, unallocated < 0 && { color: COLORS.error }]}>
                    {formatCurrency(Math.abs(unallocated))}
                  </StewardText>
                  <StewardText style={s.summaryItemLabel}>
                    {unallocated < 0 ? 'Over' : 'Unallocated'}
                  </StewardText>
                </View>
              </View>
            </StewardCard>

            {/* Instruction */}
            {!confirmed && (
              <StewardText style={s.instruction}>
                Review each bucket. Tap an amount to adjust. Confirm when you're ready.
              </StewardText>
            )}

            {confirmed && (
              <StewardCard variant="parchment" style={s.confirmedBadge}>
                <StewardText style={s.confirmedText}>
                  ✓ Plan confirmed for {monthLabel}. Your money knows where it's going.
                </StewardText>
              </StewardCard>
            )}

            {/* Allocation rows — grouped by section */}
            {SECTIONS.map((section) => {
              const sectionAllocs = allocations.filter(section.match);
              if (sectionAllocs.length === 0) return null;
              return (
                <View key={section.key} style={s.sectionGroup}>
                  <View style={s.sectionHeader}>
                    <StewardText style={s.sectionLabel}>{section.label}</StewardText>
                    {section.lockIcon && (
                      <Ionicons name="lock-closed-outline" size={11} color={COLORS.sage} style={{ marginTop: 1 }} />
                    )}
                  </View>
                  {sectionAllocs.map((alloc) => {
                    const i = allocations.indexOf(alloc);
                    return (
                      <AllocationRow
                        key={i}
                        alloc={alloc}
                        editing={editingIndex === i}
                        confirmed={confirmed}
                        onEdit={() => setEditingIndex(i)}
                        onAmountChange={(text) => handleAmountChange(text, i)}
                        onDone={() => handleDone(i)}
                      />
                    );
                  })}
                </View>
              );
            })}

            {/* Locked explanation */}
            <View style={s.lockNoteRow}>
              <Ionicons name="lock-closed-outline" size={11} color={COLORS.placeholder} />
              <StewardText style={s.lockNote}>
                Locked rows are calculated from your profile and can only be changed there.
              </StewardText>
            </View>

            {/* Confirm button */}
            {!confirmed && (
              <TouchableOpacity
                style={[s.confirmBtn, unallocated < 0 && s.confirmBtnWarn]}
                onPress={handleConfirm}
              >
                <StewardText style={s.confirmLabel}>
                  {unallocated < 0 ? `Over by ${formatCurrency(Math.abs(unallocated))} — confirm anyway` : 'Confirm plan'}
                </StewardText>
              </TouchableOpacity>
            )}

            <View style={{ height: 48 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.parchment },

  // ─ Phase screens (check / reconcile) ─
  phaseWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  phaseHeading: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xxxl,
    color: COLORS.hearth,
    lineHeight: SIZES.xxxl * 1.2,
    marginBottom: SPACING.xs,
  },
  phaseBody: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.md,
    color: COLORS.placeholder,
    lineHeight: SIZES.md * 1.6,
    marginTop: SPACING.md,
  },
  primaryBtn: {
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOW.soft,
  },
  primaryBtnLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.parchment,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  outlineBtnLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
    letterSpacing: 0.3,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  skipBtnLabel: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
    textDecorationLine: 'underline',
  },

  // ─ Reconcile ─
  reconcileScroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  reconcileCard: {
    marginBottom: SPACING.sm,
  },
  reconcileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  reconcileName: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
  },
  reconcileEstimate: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    marginTop: 2,
  },
  reconcileInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minWidth: 80,
  },
  reconcileDollar: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
  },
  reconcileInput: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    minWidth: 64,
    textAlign: 'right',
  },

  // ─ Allocate / confirmed (existing) ─
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
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
  rebuildBtn: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
  },
  rebuildLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    letterSpacing: 0.3,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
  },
  scroll: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  summaryCard: { marginBottom: SPACING.md },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.lg,
    color: COLORS.white,
  },
  summaryItemLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xs,
    color: COLORS.white,
    opacity: 0.7,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.white,
    opacity: 0.2,
  },
  instruction: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
    lineHeight: SIZES.sm * 1.6,
    marginBottom: SPACING.md,
  },
  confirmedBadge: {
    marginBottom: SPACING.md,
  },
  confirmedText: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.forest,
    lineHeight: SIZES.sm * 1.6,
  },
  sectionGroup: {
    marginBottom: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.sage,
    letterSpacing: 1.2,
  },
  lockNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    justifyContent: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  lockNote: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    lineHeight: SIZES.xs * 1.6,
  },
  confirmBtn: {
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOW.soft,
  },
  confirmBtnWarn: {
    backgroundColor: COLORS.ember,
  },
  confirmLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.white,
    letterSpacing: 0.3,
  },
});

// ─── Row styles ───────────────────────────────────────────────────────────────────
const row = StyleSheet.create({
  card: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  name: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
  },
  note: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    marginTop: 2,
    lineHeight: SIZES.xs * 1.6,
  },
  lockedAmt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  lockedAmtText: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
  },
  lockIcon: {
    fontSize: SIZES.xs,
  },
  amtBtn: {
    alignItems: 'flex-end',
  },
  amtText: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
  },
  editHint: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xs,
    color: COLORS.ember,
    marginTop: 1,
  },
  editWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ember,
    minWidth: 80,
  },
  editDollar: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
  },
  editInput: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    minWidth: 64,
    textAlign: 'right',
  },
  bar: {
    height: 3,
    marginHorizontal: -SPACING.md,
    borderRadius: 0,
  },
});

// ─── Empty state styles ───────────────────────────────────────────────────────────
const empty = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },
  heading: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.xl,
    color: COLORS.hearth,
    textAlign: 'center',
    lineHeight: SIZES.xl * 1.4,
  },
  body: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
    textAlign: 'center',
    lineHeight: SIZES.base * 1.7,
  },
  btn: {
    backgroundColor: COLORS.forest,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    minWidth: 180,
    alignItems: 'center',
    ...SHADOW.soft,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.white,
    letterSpacing: 0.3,
  },
});
