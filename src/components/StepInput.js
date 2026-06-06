import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOW } from '../constants/brand';
import StewardText from './StewardText';

// ─── Shared styles ─────────────────────────────────────────────────────────────
const inputBase = {
  fontFamily: FONTS.sans.regular,
  fontSize: SIZES.base,
  color: COLORS.hearth,
  backgroundColor: COLORS.white,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: RADIUS.sm,
  paddingHorizontal: SPACING.md,
  paddingVertical: SPACING.sm + 4,
  lineHeight: SIZES.base * 1.4,
};

// ─── Submit button ─────────────────────────────────────────────────────────────
function SubmitButton({ label, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.submitBtn, disabled && styles.submitDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <StewardText style={styles.submitLabel}>{label}</StewardText>
    </TouchableOpacity>
  );
}

// ─── Text input ────────────────────────────────────────────────────────────────
function TextStep({ step, onSubmit }) {
  const [value, setValue] = useState('');
  return (
    <View style={styles.wrapper}>
      <TextInput
        style={[inputBase, step.multiline && { minHeight: 80, textAlignVertical: 'top', paddingTop: SPACING.sm }]}
        placeholder={step.placeholder}
        placeholderTextColor={COLORS.placeholder}
        value={value}
        onChangeText={setValue}
        multiline={!!step.multiline}
        autoFocus
        returnKeyType={step.multiline ? 'default' : 'done'}
        onSubmitEditing={step.multiline ? undefined : () => value.trim() && onSubmit(value.trim())}
      />
      <SubmitButton
        label={step.submitLabel || 'Continue'}
        onPress={() => onSubmit(value.trim())}
        disabled={!value.trim()}
      />
    </View>
  );
}

// ─── Currency input ────────────────────────────────────────────────────────────
function CurrencyStep({ step, onSubmit }) {
  const [value, setValue] = useState('');
  const handleChange = (t) => setValue(t.replace(/[^0-9]/g, ''));
  return (
    <View style={styles.wrapper}>
      <View style={styles.currencyRow}>
        <StewardText style={styles.dollarSign}>$</StewardText>
        <TextInput
          style={[inputBase, styles.currencyInput]}
          placeholder={step.placeholder || '0'}
          placeholderTextColor={COLORS.placeholder}
          value={value}
          onChangeText={handleChange}
          keyboardType="number-pad"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => value && onSubmit(Number(value))}
        />
      </View>
      <SubmitButton
        label={step.submitLabel || "That's right"}
        onPress={() => onSubmit(Number(value))}
        disabled={!value || Number(value) === 0}
      />
    </View>
  );
}

// ─── Choice input (auto-advances on tap) ──────────────────────────────────────
function ChoiceStep({ step, onSubmit }) {
  const [selected, setSelected] = useState(null);
  return (
    <View style={styles.wrapper}>
      <View style={styles.choiceRow}>
        {step.choices.map((c) => (
          <TouchableOpacity
            key={c.value}
            style={[styles.choicePill, selected === c.value && styles.choicePillActive]}
            onPress={() => {
              setSelected(c.value);
              setTimeout(() => onSubmit(c.value, c.label), 120);
            }}
            activeOpacity={0.7}
          >
            <StewardText
              style={[styles.choiceLabel, selected === c.value && styles.choiceLabelActive]}
            >
              {c.label}
            </StewardText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── List input (name + amount + optional frequency) ──────────────────────────
const FREQUENCIES = [
  { label: 'Monthly', value: 'monthly', divisor: 1 },
  { label: 'Quarterly', value: 'quarterly', divisor: 3 },
  { label: 'Semi-annual', value: 'semiannual', divisor: 6 },
  { label: 'Annual', value: 'annual', divisor: 12 },
];

function freqLabel(value) {
  return FREQUENCIES.find(f => f.value === value)?.label || 'Monthly';
}

function ListStep({ step, onSubmit }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [showFreqPicker, setShowFreqPicker] = useState(false);
  const amountRef = useRef(null);

  const [variable, setVariable] = useState(false);

  const add = () => {
    if (!name.trim() || !amount) return;
    const freq = step.showFrequency ? frequency : 'monthly';
    const divisor = FREQUENCIES.find(f => f.value === freq)?.divisor || 1;
    setItems((prev) => [...prev, {
      name: name.trim(),
      amount: Number(amount),
      frequency: freq,
      monthlyAmount: Math.round(Number(amount) / divisor),
      variable: step.showFrequency ? variable : false,
    }]);
    setName('');
    setAmount('');
    setFrequency('monthly');
    setVariable(false);
    setShowFreqPicker(false);
  };

  const remove = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const done = () => onSubmit(items);
  const skip = () => onSubmit([]);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
    >
      {/* Existing items */}
      {items.map((item, i) => (
        <View key={i} style={styles.listItem}>
          <View style={{ flex: 1 }}>
            <StewardText style={styles.listItemName}>{item.name}</StewardText>
            {item.frequency !== 'monthly' && (
              <StewardText style={styles.listItemFreq}>
                {freqLabel(item.frequency)} · ${item.monthlyAmount}/mo
              </StewardText>
            )}
          </View>
          <StewardText style={styles.listItemAmount}>${item.amount.toLocaleString()}</StewardText>
          <TouchableOpacity onPress={() => remove(i)} style={styles.removeBtn}>
            <StewardText style={styles.removeLabel}>×</StewardText>
          </TouchableOpacity>
        </View>
      ))}

      {/* Add row */}
      <View style={styles.addRow}>
        <TextInput
          style={[inputBase, styles.nameInput]}
          placeholder={step.namePlaceholder || 'Name'}
          placeholderTextColor={COLORS.placeholder}
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          onSubmitEditing={() => amountRef.current?.focus()}
        />
        <View style={styles.amountWrap}>
          <StewardText style={styles.dollarSignSmall}>$</StewardText>
          <TextInput
            ref={amountRef}
            style={[inputBase, styles.amountInput]}
            placeholder={step.amountPlaceholder || '0'}
            placeholderTextColor={COLORS.placeholder}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={add}
          />
        </View>
        <TouchableOpacity
          style={[styles.addBtn, (!name.trim() || !amount) && styles.addBtnDisabled]}
          onPress={add}
          disabled={!name.trim() || !amount}
        >
          <StewardText style={styles.addBtnLabel}>Add</StewardText>
        </TouchableOpacity>
      </View>

      {/* Frequency picker — only for fixed commitments */}
      {step.showFrequency && (
        <View style={styles.freqRow}>
          <StewardText style={styles.freqLabel}>How often:</StewardText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', gap: SPACING.xs }}>
              {FREQUENCIES.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.freqPill, frequency === f.value && styles.freqPillActive]}
                  onPress={() => setFrequency(f.value)}
                >
                  <StewardText style={[styles.freqPillLabel, frequency === f.value && styles.freqPillLabelActive]}>
                    {f.label}
                  </StewardText>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Variable toggle — only for fixed commitments */}
      {step.showFrequency && (
        <TouchableOpacity
          style={styles.variableToggle}
          onPress={() => setVariable(!variable)}
          activeOpacity={0.7}
        >
          <View style={[styles.variableCheck, variable && styles.variableCheckActive]}>
            {variable && <StewardText style={styles.variableCheckMark}>✓</StewardText>}
          </View>
          <View style={{ flex: 1 }}>
            <StewardText style={styles.variableLabel}>Amount varies month to month</StewardText>
            <StewardText style={styles.variableHint}>e.g. utilities, phone — budget is an estimate</StewardText>
          </View>
        </TouchableOpacity>
      )}

      {/* Footer actions */}
      <View style={styles.footerRow}>
        {items.length === 0 && (
          <TouchableOpacity style={styles.skipBtn} onPress={skip}>
            <StewardText style={styles.skipLabel}>{step.skipLabel || 'None'}</StewardText>
          </TouchableOpacity>
        )}
        {items.length > 0 && (
          <SubmitButton label={step.submitLabel || 'Done'} onPress={done} />
        )}
      </View>
    </ScrollView>
  );
}

// ─── Bare minimum template ────────────────────────────────────────────────────
const LIFE_STAGE_CATEGORIES = {
  starting_out:      ['Rent', 'Utilities', 'Groceries', 'Transportation', 'Phone', 'Health insurance'],
  building_career:   ['Rent/Mortgage', 'Utilities', 'Groceries', 'Transportation', 'Phone', 'Health insurance', 'Car insurance'],
  growing_household: ['Mortgage', 'Utilities', 'Groceries', 'Transportation', 'Phone', 'Health insurance', 'Car insurance', 'Life insurance', 'Childcare'],
  peak_earning:      ['Mortgage', 'Utilities', 'Groceries', 'Transportation', 'Phone', 'Insurance'],
  pre_retirement:    ['Housing', 'Utilities', 'Groceries', 'Transportation', 'Phone', 'Insurance', 'Healthcare'],
  retired:           ['Housing', 'Utilities', 'Groceries', 'Transportation', 'Phone', 'Insurance', 'Healthcare'],
};
const DEFAULT_CATEGORIES = ['Rent', 'Utilities', 'Groceries', 'Transportation', 'Phone'];

function ExpenseCard({ item, onChange, onRemove }) {
  const divisor = FREQUENCIES.find((f) => f.value === item.frequency)?.divisor || 1;
  const monthly = item.amount ? Math.round(Number(item.amount) / divisor) : null;

  return (
    <View style={bm.card}>
      <View style={bm.cardRow}>
        <TextInput
          style={[inputBase, bm.nameInput]}
          value={item.name}
          onChangeText={(v) => onChange({ ...item, name: v })}
          placeholder="Expense name"
          placeholderTextColor={COLORS.placeholder}
          returnKeyType="next"
        />
        <View style={styles.amountWrap}>
          <StewardText style={styles.dollarSignSmall}>$</StewardText>
          <TextInput
            style={[inputBase, styles.amountInput]}
            value={item.amount}
            onChangeText={(v) => onChange({ ...item, amount: v.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={COLORS.placeholder}
            returnKeyType="done"
          />
        </View>
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
          <StewardText style={styles.removeLabel}>×</StewardText>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={bm.freqRow}>
          {FREQUENCIES.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.freqPill, item.frequency === f.value && styles.freqPillActive]}
              onPress={() => onChange({ ...item, frequency: f.value })}
            >
              <StewardText style={[styles.freqPillLabel, item.frequency === f.value && styles.freqPillLabelActive]}>
                {f.label}
              </StewardText>
            </TouchableOpacity>
          ))}
          {item.frequency !== 'monthly' && monthly !== null && (
            <StewardText style={bm.moEquiv}>= ${monthly}/mo</StewardText>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function BareMinimumStep({ step, answers, onSubmit }) {
  const categories = LIFE_STAGE_CATEGORIES[answers?.lifeStageSignal] || DEFAULT_CATEGORIES;
  const [items, setItems] = useState(() =>
    categories.map((name, i) => ({ id: `${name}_${i}`, name, amount: '', frequency: 'monthly' }))
  );

  const update = (id, updated) =>
    setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
  const remove = (id) => setItems((prev) => prev.filter((item) => item.id !== id));
  const add = () =>
    setItems((prev) => [...prev, { id: `custom_${Date.now()}`, name: '', amount: '', frequency: 'monthly' }]);

  const done = () => {
    const result = items
      .filter((item) => item.name.trim() && item.amount)
      .map((item) => {
        const divisor = FREQUENCIES.find((f) => f.value === item.frequency)?.divisor || 1;
        return {
          name: item.name.trim(),
          amount: Number(item.amount),
          frequency: item.frequency,
          monthlyAmount: Math.round(Number(item.amount) / divisor),
          variable: false,
        };
      });
    onSubmit(result);
  };

  const hasAnyFilled = items.some((item) => item.name.trim() && item.amount);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
    >
      {items.map((item) => (
        <ExpenseCard
          key={item.id}
          item={item}
          onChange={(updated) => update(item.id, updated)}
          onRemove={() => remove(item.id)}
        />
      ))}

      <TouchableOpacity style={bm.addRow} onPress={add} activeOpacity={0.7}>
        <StewardText style={bm.addLabel}>+ Add expense</StewardText>
      </TouchableOpacity>

      <View style={styles.footerRow}>
        {!hasAnyFilled && (
          <TouchableOpacity style={styles.skipBtn} onPress={() => onSubmit([])}>
            <StewardText style={styles.skipLabel}>None</StewardText>
          </TouchableOpacity>
        )}
        <SubmitButton label={step.submitLabel || 'Done'} onPress={done} disabled={!hasAnyFilled} />
      </View>
    </ScrollView>
  );
}

// ─── Debt list input ───────────────────────────────────────────────────────────
function DebtListStep({ step, onSubmit }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [minimum, setMinimum] = useState('');
  const [rate, setRate] = useState('');
  const balRef = useRef(null);
  const minRef = useRef(null);
  const rateRef = useRef(null);

  const add = () => {
    if (!name.trim() || !balance) return;
    setItems((prev) => [
      ...prev,
      {
        name: name.trim(),
        balance: Number(balance),
        minimum: Number(minimum) || 0,
        rate: Number(rate) || 0,
      },
    ]);
    setName(''); setBalance(''); setMinimum(''); setRate('');
  };

  const remove = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
    >
      {/* Existing debts */}
      {items.map((item, i) => (
        <View key={i} style={styles.listItem}>
          <StewardText style={styles.listItemName}>{item.name}</StewardText>
          <StewardText style={styles.listItemAmount}>${item.balance.toLocaleString()}</StewardText>
          <TouchableOpacity onPress={() => remove(i)} style={styles.removeBtn}>
            <StewardText style={styles.removeLabel}>×</StewardText>
          </TouchableOpacity>
        </View>
      ))}

      {/* Add row — Name */}
      <TextInput
        style={[inputBase, { marginBottom: SPACING.sm }]}
        placeholder={step.namePlaceholder || 'e.g. Visa card'}
        placeholderTextColor={COLORS.placeholder}
        value={name}
        onChangeText={setName}
        returnKeyType="next"
        onSubmitEditing={() => balRef.current?.focus()}
      />

      {/* Balance + Minimum + Rate row */}
      <View style={styles.debtNumRow}>
        <View style={styles.debtField}>
          <StewardText style={styles.debtFieldLabel}>Balance</StewardText>
          <TextInput
            ref={balRef}
            style={styles.debtStandaloneInput}
            placeholder="$0"
            placeholderTextColor={COLORS.placeholder}
            value={balance}
            onChangeText={(t) => setBalance(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            returnKeyType="next"
            onSubmitEditing={() => minRef.current?.focus()}
          />
        </View>
        <View style={styles.debtField}>
          <StewardText style={styles.debtFieldLabel}>Min/mo</StewardText>
          <TextInput
            ref={minRef}
            style={styles.debtStandaloneInput}
            placeholder="$0"
            placeholderTextColor={COLORS.placeholder}
            value={minimum}
            onChangeText={(t) => setMinimum(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            returnKeyType="next"
            onSubmitEditing={() => rateRef.current?.focus()}
          />
        </View>
        <View style={styles.debtField}>
          <StewardText style={styles.debtFieldLabel}>Rate %</StewardText>
          <TextInput
            ref={rateRef}
            style={styles.debtStandaloneInput}
            placeholder="0%"
            placeholderTextColor={COLORS.placeholder}
            value={rate}
            onChangeText={(t) => setRate(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={add}
          />
        </View>
      </View>

      {/* Add button */}
      <TouchableOpacity
        style={[styles.addBtn, (!name.trim() || !balance) && styles.addBtnDisabled, { marginBottom: SPACING.sm }]}
        onPress={add}
        disabled={!name.trim() || !balance}
      >
        <StewardText style={styles.addBtnLabel}>Add debt</StewardText>
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.skipBtn} onPress={() => onSubmit([])}>
          <StewardText style={styles.skipLabel}>{step.skipLabel || 'None right now'}</StewardText>
        </TouchableOpacity>
        {items.length > 0 && (
          <SubmitButton label={step.submitLabel || 'Done'} onPress={() => onSubmit(items)} />
        )}
      </View>
    </ScrollView>
  );
}

// ─── Dispatcher ────────────────────────────────────────────────────────────────
export default function StepInput({ step, onSubmit, answers }) {
  switch (step.inputType) {
    case 'text':        return <TextStep step={step} onSubmit={onSubmit} />;
    case 'currency':    return <CurrencyStep step={step} onSubmit={onSubmit} />;
    case 'choice':      return <ChoiceStep step={step} onSubmit={onSubmit} />;
    case 'list':        return <ListStep step={step} onSubmit={onSubmit} />;
    case 'debtList':    return <DebtListStep step={step} onSubmit={onSubmit} />;
    case 'bareMinimum': return <BareMinimumStep step={step} answers={answers} onSubmit={onSubmit} />;
    default:            return null;
  }
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    gap: SPACING.sm,
  },
  submitBtn: {
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  submitDisabled: {
    backgroundColor: COLORS.border,
  },
  submitLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.white,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dollarSign: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xl,
    color: COLORS.hearth,
    lineHeight: SIZES.xl * 1.4,
  },
  dollarSignSmall: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    paddingLeft: SPACING.sm,
  },
  currencyInput: {
    flex: 1,
    fontSize: SIZES.xl,
    fontFamily: FONTS.sans.light,
    lineHeight: SIZES.xl * 1.4,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  choicePill: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  choicePillActive: {
    borderColor: COLORS.forest,
    backgroundColor: COLORS.forest,
  },
  choiceLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.hearth,
  },
  choiceLabelActive: {
    color: COLORS.white,
  },
  listContent: {
    gap: SPACING.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.parchmentDark,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  listItemName: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.hearth,
  },
  listItemFreq: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: COLORS.sage,
    marginTop: 1,
  },
  listItemAmount: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.forest,
    marginRight: SPACING.sm,
  },
  removeBtn: {
    padding: SPACING.xs,
  },
  removeLabel: {
    fontSize: SIZES.lg,
    color: COLORS.placeholder,
    lineHeight: SIZES.lg,
  },
  addRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  nameInput: {
    flex: 2,
  },
  amountWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  amountInput: {
    flex: 1,
    borderWidth: 0,
    paddingLeft: 0,
  },
  addBtn: {
    backgroundColor: COLORS.sage,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  addBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  addBtnLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.white,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  skipBtn: {
    paddingVertical: SPACING.sm,
  },
  skipLabel: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
    textDecorationLine: 'underline',
  },
  debtStandaloneInput: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.hearth,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    lineHeight: SIZES.sm * 1.4,
  },
  debtNumRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  debtField: {
    flex: 1,
  },
  debtFieldLabel: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    marginBottom: SPACING.xs,
  },
  debtInput: {
    flex: 1,
    borderWidth: 0,
    paddingLeft: 0,
    fontSize: SIZES.sm,
  },
  freqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  freqLabel: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    flexShrink: 0,
  },
  freqPill: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.white,
  },
  freqPillActive: {
    borderColor: COLORS.sage,
    backgroundColor: COLORS.sage,
  },
  freqPillLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.xs,
    color: COLORS.hearth,
  },
  freqPillLabelActive: {
    color: COLORS.white,
  },
  variableToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  variableCheck: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  variableCheckActive: {
    borderColor: COLORS.sage,
    backgroundColor: COLORS.sage,
  },
  variableCheckMark: {
    fontSize: 12,
    color: COLORS.white,
    lineHeight: 14,
  },
  variableLabel: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.sm,
    color: COLORS.hearth,
  },
  variableHint: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    marginTop: 1,
  },
});

const bm = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  nameInput: {
    flex: 2,
  },
  freqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  moEquiv: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: COLORS.sage,
    alignSelf: 'center',
    paddingLeft: SPACING.xs,
  },
  addRow: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  addLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.sage,
  },
});
