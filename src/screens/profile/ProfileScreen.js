import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOW } from '../../constants/brand';
import { getProfile, saveProfile } from '../../data/store';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';

// ─── Section header ─────────────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <View style={s.section}>
      <StewardText style={s.sectionLabel}>{label}</StewardText>
      {children}
    </View>
  );
}

// ─── Editable field ──────────────────────────────────────────────────────────────
function EditField({ label, value, onChangeText, placeholder, multiline, keyboardType, hint }) {
  return (
    <View style={s.fieldWrap}>
      <StewardText style={s.fieldLabel}>{label}</StewardText>
      {hint ? <StewardText style={s.fieldHint}>{hint}</StewardText> : null}
      <TextInput
        style={[s.input, multiline && s.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.placeholder}
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
        returnKeyType={multiline ? 'default' : 'done'}
        autoCorrect={false}
      />
    </View>
  );
}

// ─── Pill selector ───────────────────────────────────────────────────────────────
function PillRow({ options, selected, onSelect }) {
  return (
    <View style={s.pillRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[s.pill, selected === opt.value && s.pillActive]}
          onPress={() => onSelect(opt.value)}
        >
          <StewardText style={[s.pillLabel, selected === opt.value && s.pillLabelActive]}>
            {opt.label}
          </StewardText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Regular expense row ─────────────────────────────────────────────────────────
const REGULAR_EXPENSE_CATEGORIES = [
  { label: 'Transport', value: 'transport' },
  { label: 'Food', value: 'food' },
  { label: 'Household', value: 'household' },
  { label: 'Personal care', value: 'personal_care' },
  { label: 'Children', value: 'children' },
  { label: 'Pets', value: 'pets' },
  { label: 'Other', value: 'other' },
];

function RegularExpenseRow({ item, onChange, onRemove }) {
  return (
    <StewardCard style={s.listCard}>
      {/* Name + Done */}
      <View style={[s.listRow, { marginBottom: SPACING.sm }]}>
        <TextInput
          style={[s.listInput, { flex: 1 }]}
          value={item.name}
          onChangeText={(v) => onChange({ ...item, name: v })}
          placeholder="e.g. Gas"
          placeholderTextColor={COLORS.placeholder}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        <TouchableOpacity onPress={() => Keyboard.dismiss()} style={{ paddingLeft: SPACING.sm }}>
          <StewardText style={s.doneLabel}>Done</StewardText>
        </TouchableOpacity>
      </View>

      {/* Category pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.sm }}>
        <View style={{ flexDirection: 'row', gap: SPACING.xs }}>
          {REGULAR_EXPENSE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[s.typePill, item.category === cat.value && s.typePillActive]}
              onPress={() => onChange({ ...item, category: cat.value })}
            >
              <StewardText style={[s.typePillLabel, item.category === cat.value && s.typePillLabelActive]}>
                {cat.label}
              </StewardText>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Monthly estimate + remove */}
      <View style={s.listRow}>
        <StewardText style={s.listFieldLabel}>Monthly estimate $</StewardText>
        <TextInput
          style={[s.listInput, { flex: 1 }]}
          value={item.monthlyEstimate ? String(item.monthlyEstimate) : ''}
          onChangeText={(v) => onChange({ ...item, monthlyEstimate: Number(v.replace(/[^0-9]/g, '')) })}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={COLORS.placeholder}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        <TouchableOpacity style={s.removeBtn} onPress={onRemove}>
          <StewardText style={s.removeBtnLabel}>✕</StewardText>
        </TouchableOpacity>
      </View>
    </StewardCard>
  );
}

// ─── Commitment row ──────────────────────────────────────────────────────────────
const FREQ_OPTIONS = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Semi-annual', value: 'semi-annual' },
  { label: 'Annual', value: 'annual' },
];
const FREQ_DIVISOR = { monthly: 1, quarterly: 3, 'semi-annual': 6, annual: 12 };

function CommitmentRow({ item, onChange, onRemove }) {
  const freq = item.frequency || 'monthly';
  const divisor = FREQ_DIVISOR[freq] || 1;

  const handleAmountChange = (v) => {
    const raw = Number(v.replace(/[^0-9]/g, ''));
    onChange({ ...item, amount: raw, monthlyAmount: divisor === 1 ? raw : Math.round(raw / divisor) });
  };

  const handleFreqChange = (f) => {
    const div = FREQ_DIVISOR[f] || 1;
    onChange({ ...item, frequency: f, monthlyAmount: div === 1 ? (item.amount || 0) : Math.round((item.amount || 0) / div) });
  };

  const amtLabel = freq === 'monthly' ? 'Monthly $'
    : freq === 'quarterly' ? 'Quarterly total $'
    : freq === 'semi-annual' ? 'Semi-annual total $'
    : 'Annual total $';

  return (
    <StewardCard style={s.listCard}>
      {/* 1 — Name + Done */}
      <View style={[s.listRow, { marginBottom: SPACING.sm }]}>
        <TextInput
          style={[s.listInput, { flex: 1 }]}
          value={item.name}
          onChangeText={(v) => onChange({ ...item, name: v })}
          placeholder="e.g. Rent"
          placeholderTextColor={COLORS.placeholder}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        <TouchableOpacity onPress={() => Keyboard.dismiss()} style={{ paddingLeft: SPACING.sm }}>
          <StewardText style={s.doneLabel}>Done</StewardText>
        </TouchableOpacity>
      </View>

      {/* 2 — Frequency pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.sm }}>
        <View style={{ flexDirection: 'row', gap: SPACING.xs }}>
          {FREQ_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[s.typePill, freq === opt.value && s.typePillActive]}
              onPress={() => handleFreqChange(opt.value)}
            >
              <StewardText style={[s.typePillLabel, freq === opt.value && s.typePillLabelActive]}>
                {opt.label}
              </StewardText>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* 3 — Variable toggle */}
      <TouchableOpacity
        style={[s.payrollToggleRow, { marginBottom: SPACING.sm }]}
        onPress={() => onChange({ ...item, variable: !item.variable })}
        activeOpacity={0.7}
      >
        <StewardText style={s.payrollToggleLabel}>Amount varies month to month</StewardText>
        <View style={[s.payrollTogglePill, item.variable && s.payrollTogglePillActive]}>
          <StewardText style={[s.payrollTogglePillLabel, item.variable && s.payrollTogglePillLabelActive]}>
            {item.variable ? 'Yes' : 'No'}
          </StewardText>
        </View>
      </TouchableOpacity>

      {/* 4 — Amount + remove */}
      <View style={s.listRow}>
        <StewardText style={s.listFieldLabel}>{amtLabel}</StewardText>
        <TextInput
          style={[s.listInput, { flex: 1 }]}
          value={item.amount ? String(item.amount) : ''}
          onChangeText={handleAmountChange}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={COLORS.placeholder}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        <TouchableOpacity style={s.removeBtn} onPress={onRemove}>
          <StewardText style={s.removeBtnLabel}>✕</StewardText>
        </TouchableOpacity>
      </View>
      {freq !== 'monthly' && item.amount > 0 && (
        <StewardText style={[s.listFieldLabel, { marginTop: 4 }]}>
          ≈ ${Math.round((item.amount || 0) / divisor).toLocaleString()}/mo
        </StewardText>
      )}
    </StewardCard>
  );
}

// ─── Debt row ────────────────────────────────────────────────────────────────────
function DebtRow({ item, onChange, onRemove }) {
  return (
    <StewardCard style={s.listCard}>
      <View style={{ gap: SPACING.sm }}>
        <View style={s.listRow}>
          <TextInput
            style={[s.listInput, { flex: 1 }]}
            value={item.name}
            onChangeText={(v) => onChange({ ...item, name: v })}
            placeholder="e.g. Car loan"
            placeholderTextColor={COLORS.placeholder}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          <TouchableOpacity onPress={() => Keyboard.dismiss()} style={{ paddingHorizontal: SPACING.sm }}>
            <StewardText style={s.doneLabel}>Done</StewardText>
          </TouchableOpacity>
          <TouchableOpacity style={s.removeBtn} onPress={onRemove}>
            <StewardText style={s.removeBtnLabel}>✕</StewardText>
          </TouchableOpacity>
        </View>
        <View style={s.listRow}>
          <View style={[s.listAmountWrap, { flex: 1 }]}>
            <StewardText style={s.listFieldLabel}>Balance</StewardText>
            <StewardText style={s.listDollar}>$</StewardText>
            <TextInput
              style={[s.listInput, { flex: 1 }]}
              value={item.balance ? String(item.balance) : ''}
              onChangeText={(v) => onChange({ ...item, balance: Number(v.replace(/[^0-9]/g, '')) })}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={COLORS.placeholder}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>
          <View style={[s.listAmountWrap, { flex: 1 }]}>
            <StewardText style={s.listFieldLabel}>Min. payment</StewardText>
            <StewardText style={s.listDollar}>$</StewardText>
            <TextInput
              style={[s.listInput, { flex: 1 }]}
              value={item.minimum ? String(item.minimum) : ''}
              onChangeText={(v) => onChange({ ...item, minimum: Number(v.replace(/[^0-9]/g, '')) })}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={COLORS.placeholder}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>
          <View style={[s.listAmountWrap, { flex: 1 }]}>
            <StewardText style={s.listFieldLabel}>Rate %</StewardText>
            <TextInput
              style={[s.listInput, { flex: 1 }]}
              value={item.rate ? String(item.rate) : ''}
              onChangeText={(v) => onChange({ ...item, rate: Number(v.replace(/[^0-9.]/g, '')) })}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={COLORS.placeholder}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>
        </View>
      </View>
    </StewardCard>
  );
}

// ─── Add button ──────────────────────────────────────────────────────────────────
function AddBtn({ label, onPress }) {
  return (
    <TouchableOpacity style={s.addBtn} onPress={onPress}>
      <StewardText style={s.addBtnLabel}>+ {label}</StewardText>
    </TouchableOpacity>
  );
}

// ─── Investment row ──────────────────────────────────────────────────────────────
const INVESTMENT_TYPES = [
  { label: '401(k)', value: '401k' },
  { label: 'Trad IRA', value: 'ira_traditional' },
  { label: 'Roth IRA', value: 'ira_roth' },
  { label: 'Brokerage', value: 'brokerage' },
  { label: 'HSA', value: 'hsa' },
];

function InvestmentRow({ item, onChange, onRemove }) {
  return (
    <StewardCard style={s.listCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
        <TextInput
          style={[s.listInput, { flex: 1, marginRight: SPACING.sm }]}
          value={item.name}
          onChangeText={(v) => onChange({ ...item, name: v })}
          placeholder="Account name"
          placeholderTextColor={COLORS.placeholder}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        <TouchableOpacity onPress={onRemove}>
          <StewardText style={s.removeLabel}>Remove</StewardText>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.sm }}>
        <View style={{ flexDirection: 'row', gap: SPACING.xs }}>
          {INVESTMENT_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[s.typePill, item.type === t.value && s.typePillActive]}
              onPress={() => onChange({ ...item, type: t.value })}
            >
              <StewardText style={[s.typePillLabel, item.type === t.value && s.typePillLabelActive]}>
                {t.label}
              </StewardText>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <TouchableOpacity
        style={s.payrollToggleRow}
        onPress={() => onChange({ ...item, payrollDeducted: !item.payrollDeducted })}
        activeOpacity={0.7}
      >
        <StewardText style={s.payrollToggleLabel}>Deducted from paycheck automatically</StewardText>
        <View style={[s.payrollTogglePill, item.payrollDeducted && s.payrollTogglePillActive]}>
          <StewardText style={[s.payrollTogglePillLabel, item.payrollDeducted && s.payrollTogglePillLabelActive]}>
            {item.payrollDeducted ? 'Yes' : 'No'}
          </StewardText>
        </View>
      </TouchableOpacity>
      <View style={s.listRow}>
        <View style={[s.listAmountWrap, { flex: 1 }]}>
          <StewardText style={s.listFieldLabel}>Monthly $</StewardText>
          <TextInput
            style={[s.listInput, { flex: 1 }]}
            value={item.monthlyContribution ? String(item.monthlyContribution) : ''}
            onChangeText={(v) => onChange({ ...item, monthlyContribution: Number(v.replace(/[^0-9]/g, '')) })}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={COLORS.placeholder}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>
        <View style={[s.listAmountWrap, { flex: 1 }]}>
          <StewardText style={s.listFieldLabel}>Balance $</StewardText>
          <TextInput
            style={[s.listInput, { flex: 1 }]}
            value={item.balance ? String(item.balance) : ''}
            onChangeText={(v) => onChange({ ...item, balance: Number(v.replace(/[^0-9]/g, '')) })}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={COLORS.placeholder}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>
        {item.type === '401k' && (
          <View style={[s.listAmountWrap, { flex: 1 }]}>
            <StewardText style={s.listFieldLabel}>Match %</StewardText>
            <TextInput
              style={[s.listInput, { flex: 1 }]}
              value={item.employerMatch ? String(item.employerMatch) : ''}
              onChangeText={(v) => onChange({ ...item, employerMatch: Number(v.replace(/[^0-9.]/g, '')) })}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={COLORS.placeholder}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>
        )}
      </View>
    </StewardCard>
  );
}

// ─── Goal row ────────────────────────────────────────────────────────────────────
function GoalRow({ item, onChange, onRemove }) {
  return (
    <StewardCard style={s.listCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
        <TextInput
          style={[s.listInput, { flex: 1, marginRight: SPACING.sm }]}
          value={item.name}
          onChangeText={(v) => onChange({ ...item, name: v })}
          placeholder="Goal name"
          placeholderTextColor={COLORS.placeholder}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        <TouchableOpacity onPress={onRemove}>
          <StewardText style={s.removeLabel}>Remove</StewardText>
        </TouchableOpacity>
      </View>
      <View style={s.listRow}>
        <View style={[s.listAmountWrap, { flex: 1 }]}>
          <StewardText style={s.listFieldLabel}>Target $</StewardText>
          <TextInput
            style={[s.listInput, { flex: 1 }]}
            value={item.target ? String(item.target) : ''}
            onChangeText={(v) => onChange({ ...item, target: Number(v.replace(/[^0-9]/g, '')) })}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={COLORS.placeholder}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>
        <View style={[s.listAmountWrap, { flex: 1 }]}>
          <StewardText style={s.listFieldLabel}>Monthly $</StewardText>
          <TextInput
            style={[s.listInput, { flex: 1 }]}
            value={item.monthly ? String(item.monthly) : ''}
            onChangeText={(v) => onChange({ ...item, monthly: Number(v.replace(/[^0-9]/g, '')) })}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={COLORS.placeholder}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>
        <View style={[s.listAmountWrap, { flex: 1 }]}>
          <StewardText style={s.listFieldLabel}>Saved $</StewardText>
          <TextInput
            style={[s.listInput, { flex: 1 }]}
            value={item.saved ? String(item.saved) : ''}
            onChangeText={(v) => onChange({ ...item, saved: Number(v.replace(/[^0-9]/g, '')) })}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={COLORS.placeholder}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>
      </View>
    </StewardCard>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────────
const PAY_FREQ = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Bi-weekly', value: 'biweekly' },
  { label: 'Semi-monthly', value: 'semi-monthly' },
  { label: 'Monthly', value: 'monthly' },
];

export default function ProfileScreen({ navigation }) {

  const handleManualReprofile = () => {
    Alert.alert(
      'Review & re-profile',
      'This will walk you through your annual review now. Your current profile and plan will be updated when you finish.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start review', onPress: () => navigation.navigate('AnnualReview', { forceOpen: true }) },
      ]
    );
  };
  const [original, setOriginal] = useState(null);
  const [name, setName] = useState('');
  const [priorities, setPriorities] = useState('');
  const [netIncome, setNetIncome] = useState('');
  const [payFrequency, setPayFrequency] = useState('biweekly');
  const [fixedCommitments, setFixedCommitments] = useState([]);
  const [regularExpenses, setRegularExpenses] = useState([]);
  const [debts, setDebts] = useState([]);
  const [savings, setSavings] = useState('');
  const [investments, setInvestments] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getProfile().then((p) => {
      if (!p) return;
      setOriginal(p);
      setName(p.name || '');
      setPriorities(p.priorities || '');
      setNetIncome(p.netIncome ? String(p.netIncome) : '');
      setPayFrequency(p.payFrequency || 'biweekly');
      setFixedCommitments(p.fixedCommitments || []);
      setRegularExpenses(p.regularExpenses || []);
      setDebts(p.debts || []);
      setSavings(p.savings ? String(p.savings) : '');
      setInvestments(p.investments || []);
      setSavingsGoals(p.savingsGoals || []);
    });
  }, []);

  // Track changes
  useEffect(() => { setDirty(true); }, [name, priorities, netIncome, payFrequency, fixedCommitments, regularExpenses, debts, savings, investments, savingsGoals]);
  useEffect(() => { setDirty(false); }, [original]); // reset after load

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name before saving.');
      return;
    }

    const updatedProfile = {
      ...original,
      name: name.trim(),
      priorities: priorities.trim(),
      netIncome: Number(netIncome) || 0,
      payFrequency,
      fixedCommitments: fixedCommitments.filter((c) => c.name.trim()),
      regularExpenses: regularExpenses.filter((r) => r.name.trim()),
      debts: debts.filter((d) => d.name.trim()),
      savings: Number(savings) || 0,
      investments: investments.filter((inv) => inv.name.trim()),
      savingsGoals: savingsGoals.filter((g) => g.name.trim()),
    };

    await saveProfile(updatedProfile);

    // If income or commitments changed, clear current plan so Deploy regenerates
    const incomeChanged = original?.netIncome !== updatedProfile.netIncome;
    const commitmentsChanged =
      JSON.stringify(original?.fixedCommitments) !== JSON.stringify(updatedProfile.fixedCommitments) ||
      JSON.stringify(original?.regularExpenses) !== JSON.stringify(updatedProfile.regularExpenses) ||
      JSON.stringify(original?.debts) !== JSON.stringify(updatedProfile.debts) ||
      JSON.stringify(original?.investments) !== JSON.stringify(updatedProfile.investments) ||
      JSON.stringify(original?.savingsGoals) !== JSON.stringify(updatedProfile.savingsGoals);

    if (incomeChanged || commitmentsChanged) {
      const month = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })();
      await AsyncStorage.removeItem(`steward_plan_${month}`);
    }

    setOriginal(updatedProfile);
    setDirty(false);
    navigation.goBack();
  };

  const handleClose = () => {
    if (dirty) {
      Alert.alert('Unsaved changes', 'Leave without saving?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const updateCommitment = (i, val) => {
    const updated = [...fixedCommitments];
    updated[i] = val;
    setFixedCommitments(updated);
  };

  const removeCommitment = (i) => {
    setFixedCommitments(fixedCommitments.filter((_, idx) => idx !== i));
  };

  const updateRegularExpense = (i, val) => {
    const updated = [...regularExpenses];
    updated[i] = val;
    setRegularExpenses(updated);
  };

  const removeRegularExpense = (i) => {
    setRegularExpenses(regularExpenses.filter((_, idx) => idx !== i));
  };

  const updateDebt = (i, val) => {
    const updated = [...debts];
    updated[i] = val;
    setDebts(updated);
  };

  const removeDebt = (i) => {
    setDebts(debts.filter((_, idx) => idx !== i));
  };

  const updateGoal = (i, val) => {
    const updated = [...savingsGoals];
    updated[i] = val;
    setSavingsGoals(updated);
  };

  const removeGoal = (i) => setSavingsGoals(savingsGoals.filter((_, idx) => idx !== i));

  const updateInvestment = (i, val) => {
    const updated = [...investments];
    updated[i] = val;
    setInvestments(updated);
  };

  const removeInvestment = (i) => setInvestments(investments.filter((_, idx) => idx !== i));

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.cancelBtn} onPress={handleClose}>
            <StewardText style={s.cancelLabel}>Cancel</StewardText>
          </TouchableOpacity>
          <StewardText style={s.headerTitle}>Your Profile</StewardText>
          <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
            <StewardText style={s.saveLabel}>Save</StewardText>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={() => Keyboard.dismiss()}
        >
          {/* About you */}
          <Section label="ABOUT YOU">
            <EditField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Your first name"
            />
            <EditField
              label="What matters most to you right now?"
              value={priorities}
              onChangeText={setPriorities}
              placeholder="e.g. Getting out of debt. Saving for a home. Building breathing room."
              multiline
              hint="This helps shape how your plan is framed."
            />
          </Section>

          {/* Income */}
          <Section label="INCOME">
            <EditField
              label="Take-home pay"
              value={netIncome}
              onChangeText={(v) => setNetIncome(v.replace(/[^0-9]/g, ''))}
              placeholder="0"
              keyboardType="number-pad"
              hint="After taxes. Per paycheck, not monthly."
            />
            <View style={s.fieldWrap}>
              <StewardText style={s.fieldLabel}>Pay frequency</StewardText>
              <PillRow options={PAY_FREQ} selected={payFrequency} onSelect={setPayFrequency} />
            </View>
          </Section>

          {/* Fixed commitments */}
          <Section label="FIXED COMMITMENTS">
            <StewardText style={s.sectionHint}>
              Bills and recurring expenses that don't change month to month — rent, insurance, subscriptions.
            </StewardText>
            {fixedCommitments.map((c, i) => (
              <CommitmentRow
                key={i}
                item={c}
                onChange={(val) => updateCommitment(i, val)}
                onRemove={() => removeCommitment(i)}
              />
            ))}
            <AddBtn
              label="Add commitment"
              onPress={() => setFixedCommitments([...fixedCommitments, { name: '', amount: 0, frequency: 'monthly', variable: false, monthlyAmount: 0 }])}
            />
          </Section>

          {/* Regular expenses */}
          <Section label="REGULAR EXPENSES">
            <StewardText style={s.sectionHint}>
              Expenses you know are coming but can't predict exactly — gas, groceries, household supplies.
            </StewardText>
            {regularExpenses.map((r, i) => (
              <RegularExpenseRow
                key={i}
                item={r}
                onChange={(val) => updateRegularExpense(i, val)}
                onRemove={() => removeRegularExpense(i)}
              />
            ))}
            <AddBtn
              label="Add regular expense"
              onPress={() => setRegularExpenses([...regularExpenses, { name: '', category: 'other', monthlyEstimate: 0 }])}
            />
          </Section>

          {/* Debts */}
          <Section label="DEBTS">
            <StewardText style={s.sectionHint}>
              Credit cards, loans, and anything with a balance and a minimum payment.
            </StewardText>
            {debts.map((d, i) => (
              <DebtRow
                key={i}
                item={d}
                onChange={(val) => updateDebt(i, val)}
                onRemove={() => removeDebt(i)}
              />
            ))}
            <AddBtn
              label="Add debt"
              onPress={() => setDebts([...debts, { name: '', balance: 0, minimum: 0, rate: 0 }])}
            />
          </Section>

          {/* Investments */}
          <Section label="INVESTMENTS">
            <StewardText style={s.sectionHint}>
              Retirement accounts, brokerage, and HSA. Monthly contributions appear as auto-committed plan layers.
            </StewardText>
            {investments.map((inv, i) => (
              <InvestmentRow
                key={inv.id || i}
                item={inv}
                onChange={(val) => updateInvestment(i, val)}
                onRemove={() => removeInvestment(i)}
              />
            ))}
            <AddBtn
              label="Add investment"
              onPress={() => setInvestments([...investments, { id: Date.now().toString(), name: '', type: '401k', monthlyContribution: 0, balance: 0, employerMatch: 0, payrollDeducted: true }])}
            />
          </Section>

          {/* Savings & goals */}
          <Section label="SAVINGS & GOALS">
            <EditField
              label="Current savings"
              value={savings}
              onChangeText={(v) => setSavings(v.replace(/[^0-9]/g, ''))}
              placeholder="0"
              keyboardType="number-pad"
              hint="Your current liquid savings balance."
            />
            <StewardText style={[s.sectionHint, { marginTop: SPACING.md }]}>
              Named goals — each gets its own line in your plan with a monthly contribution.
            </StewardText>
            {savingsGoals.map((g, i) => (
              <GoalRow
                key={g.id || i}
                item={g}
                onChange={(val) => updateGoal(i, val)}
                onRemove={() => removeGoal(i)}
              />
            ))}
            <AddBtn
              label="Add goal"
              onPress={() => setSavingsGoals([...savingsGoals, { id: Date.now().toString(), name: '', target: 0, monthly: 0, saved: 0 }])}
            />
          </Section>


          {/* Manual re-profile */}
          <StewardCard variant="outlined" style={s.reprofileCard}>
            <View style={s.reprofileRow}>
              <View style={s.reprofileTextBlock}>
                <StewardText variant="bodyMedium">Review & re-profile</StewardText>
                <StewardText variant="caption" style={{ marginTop: 2 }}>
                  Update your financial picture and rebuild your plan.
                </StewardText>
              </View>
              <TouchableOpacity
                style={s.reprofileButton}
                onPress={handleManualReprofile}
                activeOpacity={0.8}
              >
                <StewardText variant="label" style={s.reprofileButtonText}>
                  START
                </StewardText>
              </TouchableOpacity>
            </View>
          </StewardCard>

          {/* Danger zone */}
          <View style={s.danger}>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Reset everything?',
                  'This clears all your data and returns to onboarding. This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset',
                      style: 'destructive',
                      onPress: async () => {
                        await AsyncStorage.clear();
                        navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
                      },
                    },
                  ]
                );
              }}
            >
              <StewardText style={s.dangerLabel}>Reset app data</StewardText>
            </TouchableOpacity>
          </View>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.parchment,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.parchment,
  },
  headerTitle: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.md,
    color: COLORS.hearth,
  },
  cancelBtn: {
    paddingVertical: SPACING.xs,
    paddingRight: SPACING.sm,
    minWidth: 60,
  },
  cancelLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
  },
  saveBtn: {
    paddingVertical: SPACING.xs,
    paddingLeft: SPACING.sm,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  saveLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.forest,
  },

  scroll: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.sage,
    letterSpacing: 1.2,
    marginBottom: SPACING.md,
  },
  sectionHint: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
    lineHeight: SIZES.sm * 1.6,
    marginBottom: SPACING.md,
  },

  fieldWrap: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.hearth,
    marginBottom: SPACING.xs,
  },
  fieldHint: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    marginBottom: SPACING.xs,
    lineHeight: SIZES.xs * 1.6,
  },
  input: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: SPACING.sm,
  },

  pillRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  pill: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
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

  listCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  listAmountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  listDollar: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.placeholder,
  },
  listInput: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minWidth: 48,
  },
  listFieldLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    marginRight: 2,
  },
  removeBtn: {
    padding: SPACING.xs,
  },
  removeBtnLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
  },
  removeLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
  },
  doneLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.sage,
  },

  payrollToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  payrollToggleLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xs,
    color: COLORS.sage,
    flex: 1,
    marginRight: SPACING.sm,
  },
  payrollTogglePill: {
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  payrollTogglePillActive: {
    backgroundColor: COLORS.forest,
    borderColor: COLORS.forest,
  },
  payrollTogglePillLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
  },
  payrollTogglePillLabelActive: {
    color: COLORS.white,
  },

  typePill: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  typePillActive: {
    backgroundColor: COLORS.forest,
    borderColor: COLORS.forest,
  },
  typePillLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
  },
  typePillLabelActive: {
    color: COLORS.white,
    fontFamily: FONTS.sans.medium,
  },

  addBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  addBtnLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.sage,
  },

  danger: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  dangerLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.error,
  },

  reprofileCard: { marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  reprofileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md },
  reprofileTextBlock: { flex: 1, marginRight: SPACING.md },
  reprofileButton: { backgroundColor: COLORS.forest, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm },
  reprofileButtonText: { color: COLORS.parchment, letterSpacing: 0.8 },
});
