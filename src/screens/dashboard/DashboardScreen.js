import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOW } from '../../constants/brand';
import { getProfile, getPlan, getSpends, addSpend, currentMonth, formatCurrency, getTransfers, addTransfer, deleteTransfer, netTransferred, savePlan, updateGoalBalance, updateInvestmentBalance, getActiveCrises, getDebtActuals, saveDebtActuals, getFixedOverrides, saveFixedOverrides } from '../../data/store';
import { getDailyObservation, generatePlan } from '../../ai/claude';
import { detectAnomalies, getUnacknowledgedAnomalies, acknowledgeAnomaly } from '../../ai/anomalyDetection';
import StewardText from '../../components/StewardText';
import StewardCard from '../../components/StewardCard';
import { Ionicons } from '@expo/vector-icons';
import FlameIcon from '../../components/FlameIcon';
import AllocationBar from '../../components/AllocationBar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Category → layer mapping ───────────────────────────────────────────────────
const CATEGORIES = [
  { label: 'Food & Groceries', layer: 'Life' },
  { label: 'Transport', layer: 'Life' },
  { label: 'Health', layer: 'Life' },
  { label: 'Entertainment', layer: 'Life' },
  { label: 'Ad hoc', layer: 'Ad hoc' },
  { label: 'Other', layer: 'Life' },
];

// ─── Quick Log Modal ─────────────────────────────────────────────────────────────
function QuickLogModal({ visible, onClose, onLog }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [note, setNote] = useState('');

  const reset = () => { setAmount(''); setCategory(CATEGORIES[0]); setNote(''); };

  const handleLog = () => {
    if (!amount || Number(amount) === 0) return;
    onLog({ amount: Number(amount), category: category.label, layer: category.layer, note });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <StewardText style={modal.title}>Log a spend</StewardText>

            <View style={modal.amountRow}>
              <StewardText style={modal.dollar}>$</StewardText>
              <TextInput
                style={modal.amountInput}
                placeholder="0"
                placeholderTextColor={COLORS.placeholder}
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: SPACING.md }}>
              <View style={{ flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: 2 }}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.label}
                    style={[modal.pill, category.label === c.label && modal.pillActive]}
                    onPress={() => setCategory(c)}
                  >
                    <StewardText style={[modal.pillLabel, category.label === c.label && modal.pillLabelActive]}>
                      {c.label}
                    </StewardText>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TextInput
              style={modal.noteInput}
              placeholder="Note (optional)"
              placeholderTextColor={COLORS.placeholder}
              value={note}
              onChangeText={setNote}
            />

            <TouchableOpacity style={[modal.logBtn, !amount && modal.logBtnDisabled]} onPress={handleLog} disabled={!amount}>
              <StewardText style={modal.logBtnLabel}>Log it</StewardText>
            </TouchableOpacity>

            <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
              <StewardText style={modal.cancelLabel}>Cancel</StewardText>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Spend Detail Modal ──────────────────────────────────────────────────────────
function SpendDetailModal({ visible, allocation, spends, onClose, onDelete, onEdit }) {
  const [editingSpend, setEditingSpend] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editCategory, setEditCategory] = useState(CATEGORIES[0]);

  if (!allocation) return null;

  const allocSpends = spends.filter((s) => {
    const spendKey = (s.layer || s.category || '').toLowerCase().replace(/\s/g, '');
    const allocNameKey = allocation.name.toLowerCase().replace(/\s/g, '');
    const allocLayerKey = (allocation.layer || '').toLowerCase().replace(/\s/g, '');
    return spendKey === allocNameKey || spendKey === allocLayerKey;
  });

  const startEdit = (spend) => {
    setEditingSpend(spend);
    setEditAmount(String(spend.amount));
    setEditNote(spend.note || '');
    const matched = CATEGORIES.find((c) => c.label === spend.category) || CATEGORIES[0];
    setEditCategory(matched);
  };

  const saveEdit = () => {
    if (!editAmount || Number(editAmount) === 0) return;
    onEdit(editingSpend.id, {
      amount: Number(editAmount),
      category: editCategory.label,
      layer: editCategory.layer,
      note: editNote,
    });
    setEditingSpend(null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={detail.overlay}>
          <View style={detail.sheet}>
            <View style={detail.header}>
              <StewardText style={detail.title}>{allocation.name}</StewardText>
              <TouchableOpacity onPress={() => { setEditingSpend(null); onClose(); }} style={detail.closeBtn}>
                <StewardText style={detail.closeLabel}>Done</StewardText>
              </TouchableOpacity>
            </View>

            <View style={detail.summary}>
              <StewardText style={detail.summaryText}>
                {formatCurrency(allocation.spent || 0)} of {formatCurrency(allocation.amount)} used
              </StewardText>
            </View>

            {/* Edit form */}
            {editingSpend && (
              <View style={detail.editForm}>
                <StewardText style={detail.editLabel}>Edit spend</StewardText>
                <View style={detail.editAmountRow}>
                  <StewardText style={detail.editDollar}>$</StewardText>
                  <TextInput
                    style={detail.editAmountInput}
                    value={editAmount}
                    onChangeText={(t) => setEditAmount(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    autoFocus
                  />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginVertical: SPACING.sm }}>
                  <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                    {CATEGORIES.map((c) => (
                      <TouchableOpacity
                        key={c.label}
                        style={[detail.pill, editCategory.label === c.label && detail.pillActive]}
                        onPress={() => setEditCategory(c)}
                      >
                        <StewardText style={[detail.pillLabel, editCategory.label === c.label && detail.pillLabelActive]}>
                          {c.label}
                        </StewardText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <TextInput
                  style={detail.editNoteInput}
                  placeholder="Note (optional)"
                  placeholderTextColor={COLORS.placeholder}
                  value={editNote}
                  onChangeText={setEditNote}
                />
                <View style={detail.editActions}>
                  <TouchableOpacity style={detail.cancelEdit} onPress={() => setEditingSpend(null)}>
                    <StewardText style={detail.cancelEditLabel}>Cancel</StewardText>
                  </TouchableOpacity>
                  <TouchableOpacity style={detail.saveEdit} onPress={saveEdit}>
                    <StewardText style={detail.saveEditLabel}>Save</StewardText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {allocSpends.length === 0 ? (
              <StewardText style={detail.emptyText}>No spends logged here yet.</StewardText>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {allocSpends.map((spend) => (
                  <View key={spend.id} style={detail.row}>
                    <View style={detail.rowLeft}>
                      <StewardText style={detail.rowCategory}>{spend.category}</StewardText>
                      {spend.note ? <StewardText style={detail.rowNote}>{spend.note}</StewardText> : null}
                      <StewardText style={detail.rowDate}>
                        {new Date(spend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </StewardText>
                    </View>
                    <View style={detail.rowRight}>
                      <StewardText style={detail.rowAmount}>{formatCurrency(spend.amount)}</StewardText>
                      <View style={detail.rowActions}>
                        <TouchableOpacity style={detail.editBtn} onPress={() => startEdit(spend)}>
                          <StewardText style={detail.editBtnLabel}>Edit</StewardText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={detail.deleteBtn}
                          onPress={() => {
                            Alert.alert(
                              'Delete this spend?',
                              `${formatCurrency(spend.amount)} — ${spend.category}`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => onDelete(spend.id) },
                              ]
                            );
                          }}
                        >
                          <StewardText style={detail.deleteBtnLabel}>Delete</StewardText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Transfer Ledger Modal ───────────────────────────────────────────────────────
// Used for stability buffer and debt accelerator rows.
// Supports full/partial deposit and withdrawal with running ledger.
function TransferLedgerModal({ visible, allocation, transfers, onClose, onAdd, onDelete }) {
  const [mode, setMode] = useState(null); // null | 'deposit' | 'withdrawal'
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  if (!allocation) return null;

  const layerTransfers = transfers.filter((t) => t.layer === allocation.layer);  const net = netTransferred(transfers, allocation.layer);
  const isDebt = allocation.layer === 'debt_accelerator';

  const label = isDebt
    ? { deposit: 'Extra payment', withdrawal: 'Reversed / refund', full: 'Paid in full', partial: 'Partial payment' }
    : { deposit: 'Transfer to savings', withdrawal: 'Withdrawal', full: 'Transferred in full', partial: 'Partial transfer' };

  const submit = (type, amt) => {
    if (!amt || Number(amt) === 0) return;
    onAdd({ layer: allocation.layer, type, amount: Number(amt), note });
    setMode(null);
    setAmount('');
    setNote('');
  };

  const reset = () => { setMode(null); setAmount(''); setNote(''); };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={detail.overlay}>
          <View style={detail.sheet}>
            {/* Header */}
            <View style={detail.header}>
              <StewardText style={[detail.title, { lineHeight: SIZES.xl * 1.4 }]}>{allocation.name}</StewardText>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} style={detail.closeBtn}>
                <StewardText style={detail.closeLabel}>Done</StewardText>
              </TouchableOpacity>
            </View>

            {/* Summary bar */}
            <View style={detail.summary}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <StewardText style={detail.summaryText}>Target this month</StewardText>
                <StewardText style={detail.summaryText}>{formatCurrency(allocation.amount)}</StewardText>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <StewardText style={[detail.summaryText, { color: COLORS.forest }]}>
                  Net {isDebt ? 'paid' : 'moved'}
                </StewardText>
                <StewardText style={[detail.summaryText, {
                  color: net >= allocation.amount ? COLORS.forest : net > 0 ? COLORS.ember : COLORS.placeholder
                }]}>
                  {formatCurrency(net)}
                </StewardText>
              </View>
            </View>

            {/* Action buttons — only show when no mode active */}
            {!mode && (
              <View style={transfer.actionRow}>
                <TouchableOpacity
                  style={[transfer.actionBtn, transfer.depositBtn]}
                  onPress={() => setMode('deposit')}
                >
                  <StewardText style={transfer.depositLabel}>↑ {label.deposit}</StewardText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[transfer.actionBtn, transfer.withdrawBtn]}
                  onPress={() => setMode('withdrawal')}
                >
                  <StewardText style={transfer.withdrawLabel}>↓ {label.withdrawal}</StewardText>
                </TouchableOpacity>
              </View>
            )}

            {/* Entry form */}
            {mode && (
              <View style={detail.editForm}>
                <StewardText style={detail.editLabel}>
                  {mode === 'deposit' ? label.deposit : label.withdrawal}
                </StewardText>

                {/* Full amount shortcut */}
                {mode === 'deposit' && (
                  <TouchableOpacity
                    style={transfer.fullBtn}
                    onPress={() => submit('deposit', allocation.amount)}
                  >
                    <StewardText style={transfer.fullBtnLabel}>
                      {label.full} — {formatCurrency(allocation.amount)}
                    </StewardText>
                  </TouchableOpacity>
                )}

                <View style={detail.editAmountRow}>
                  <StewardText style={[detail.editDollar, { lineHeight: SIZES.xl * 1.4 }]}>$</StewardText>
                  <TextInput
                    style={[detail.editAmountInput, { lineHeight: SIZES.xl * 1.4 }]}
                    value={amount}
                    onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    placeholder={mode === 'deposit' ? 'Partial amount' : 'Amount'}
                    placeholderTextColor={COLORS.placeholder}
                  />
                </View>

                <TextInput
                  style={detail.editNoteInput}
                  placeholder="Note (optional)"
                  placeholderTextColor={COLORS.placeholder}
                  value={note}
                  onChangeText={setNote}
                />

                <View style={detail.editActions}>
                  <TouchableOpacity style={detail.cancelEdit} onPress={reset}>
                    <StewardText style={detail.cancelEditLabel}>Cancel</StewardText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[detail.saveEdit, !amount && { backgroundColor: COLORS.border }]}
                    onPress={() => submit(mode, amount)}
                    disabled={!amount}
                  >
                    <StewardText style={detail.saveEditLabel}>Save</StewardText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Ledger */}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {layerTransfers.length === 0 ? (
                <StewardText style={detail.emptyText}>No activity recorded yet.</StewardText>
              ) : (
                layerTransfers.slice().reverse().map((t) => (
                  <View key={t.id} style={detail.row}>
                    <View style={detail.rowLeft}>
                      <StewardText style={[detail.rowCategory, {
                        color: t.type === 'deposit' ? COLORS.forest : COLORS.ember
                      }]}>
                        {t.type === 'deposit' ? '↑' : '↓'} {t.type === 'deposit' ? label.deposit : label.withdrawal}
                      </StewardText>
                      {t.note ? <StewardText style={detail.rowNote}>{t.note}</StewardText> : null}
                      <StewardText style={detail.rowDate}>
                        {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </StewardText>
                    </View>
                    <View style={detail.rowRight}>
                      <StewardText style={[detail.rowAmount, {
                        color: t.type === 'deposit' ? COLORS.forest : COLORS.ember
                      }]}>
                        {t.type === 'withdrawal' ? '−' : '+'}{formatCurrency(t.amount)}
                      </StewardText>
                      <TouchableOpacity
                        style={detail.deleteBtn}
                        onPress={() => Alert.alert(
                          'Remove this entry?',
                          `${t.type === 'deposit' ? '+' : '−'}${formatCurrency(t.amount)}`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => onDelete(t.id) },
                          ]
                        )}
                      >
                        <StewardText style={detail.deleteBtnLabel}>Remove</StewardText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Debt Minimums Modal ─────────────────────────────────────────────────────────
function DebtMinimumsModal({ visible, allocation, onClose, onAdjust, onDeleteAdjust }) {
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  if (!allocation) return null;
  const items = allocation.items || [];

  const saveAdjust = () => {
    if (!adjustAmount) return;
    onAdjust(adjustingItem.name, Number(adjustAmount), adjustNote);
    setAdjustingItem(null);
    setAdjustAmount('');
    setAdjustNote('');
  };

  const reset = () => { setAdjustingItem(null); setAdjustAmount(''); setAdjustNote(''); };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={detail.overlay}>
          <View style={detail.sheet}>
            <View style={detail.header}>
              <StewardText style={[detail.title, { lineHeight: SIZES.xl * 1.4 }]}>Debt minimums</StewardText>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} style={detail.closeBtn}>
                <StewardText style={detail.closeLabel}>Done</StewardText>
              </TouchableOpacity>
            </View>

            <View style={detail.summary}>
              <StewardText style={detail.summaryText}>
                These are the floor payments — the minimum required each month. Tap Adjust to record what you actually paid.
              </StewardText>
            </View>

            {/* Adjust form */}
            {adjustingItem && (
              <View style={detail.editForm}>
                <StewardText style={detail.editLabel}>Actual payment — {adjustingItem.name}</StewardText>
                <View style={detail.editAmountRow}>
                  <StewardText style={[detail.editDollar, { lineHeight: SIZES.xl * 1.4 }]}>$</StewardText>
                  <TextInput
                    style={[detail.editAmountInput, { lineHeight: SIZES.xl * 1.4 }]}
                    value={adjustAmount}
                    onChangeText={(t) => setAdjustAmount(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={COLORS.placeholder}
                  />
                </View>
                <TextInput
                  style={detail.editNoteInput}
                  placeholder="Note (optional)"
                  placeholderTextColor={COLORS.placeholder}
                  value={adjustNote}
                  onChangeText={setAdjustNote}
                />
                <View style={detail.editActions}>
                  <TouchableOpacity style={detail.cancelEdit} onPress={reset}>
                    <StewardText style={detail.cancelEditLabel}>Cancel</StewardText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[detail.saveEdit, !adjustAmount && { backgroundColor: COLORS.border }]}
                    onPress={saveAdjust}
                    disabled={!adjustAmount}
                  >
                    <StewardText style={detail.saveEditLabel}>Save</StewardText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!adjustingItem && (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {items.length === 0 ? (
                <StewardText style={detail.emptyText}>No debts on record.</StewardText>
              ) : (
                items.map((item, i) => (
                  <View key={i} style={detail.row}>
                    <View style={detail.rowLeft}>
                      <StewardText style={detail.rowCategory}>{item.name}</StewardText>
                      {item.balance > 0 && (
                        <StewardText style={detail.rowNote}>
                          Balance: {formatCurrency(item.balance)}{item.rate > 0 ? ` · ${item.rate}% APR` : ''}
                        </StewardText>
                      )}
                      {item.actualAmount !== undefined && (
                        <StewardText style={[detail.rowNote, { color: COLORS.ember }]}>
                          Adjusted from {formatCurrency(item.amount)}{item.actualNote ? ` — ${item.actualNote}` : ''}
                        </StewardText>
                      )}
                    </View>
                    <View style={detail.rowRight}>
                      <StewardText style={[detail.rowAmount, item.actualAmount !== undefined && { color: COLORS.ember }]}>
                        {formatCurrency(item.actualAmount !== undefined ? item.actualAmount : item.amount)}
                      </StewardText>
                      <View style={detail.rowActions}>
                        <TouchableOpacity
                          style={detail.editBtn}
                          onPress={() => {
                            setAdjustingItem(item);
                            setAdjustAmount(String(item.actualAmount !== undefined ? item.actualAmount : item.amount));
                            setAdjustNote(item.actualNote || '');
                          }}
                        >
                          <StewardText style={detail.editBtnLabel}>
                            {item.actualAmount !== undefined ? 'Edit' : 'Adjust'}
                          </StewardText>
                        </TouchableOpacity>
                        {item.actualAmount !== undefined && (
                          <TouchableOpacity
                            style={detail.deleteBtn}
                            onPress={() => Alert.alert(
                              'Remove adjustment?',
                              `Resets ${item.name} to the minimum of ${formatCurrency(item.amount)}.`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Remove', style: 'destructive', onPress: () => onDeleteAdjust(item.name) },
                              ]
                            )}
                          >
                            <StewardText style={detail.deleteBtnLabel}>Clear</StewardText>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Fixed Commitments Modal ─────────────────────────────────────────────────────
function FixedCommitmentsModal({ visible, allocation, overrides, onClose, onAdjust }) {
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');

  if (!allocation) return null;
  const items = allocation.items || [];

  const getAmount = (item) => overrides[item.name] ?? item.amount;

  const saveAdjust = () => {
    if (!adjustAmount) return;
    onAdjust(adjustingItem.name, Number(adjustAmount));
    setAdjustingItem(null);
    setAdjustAmount('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={detail.overlay}>
          <View style={detail.sheet}>
            <View style={detail.header}>
              <StewardText style={detail.title}>Fixed commitments</StewardText>
              <TouchableOpacity onPress={() => { setAdjustingItem(null); onClose(); }} style={detail.closeBtn}>
                <StewardText style={detail.closeLabel}>Done</StewardText>
              </TouchableOpacity>
            </View>

            <View style={detail.summary}>
              <StewardText style={detail.summaryText}>
                Auto-committed each month. Tap to adjust if a bill came in differently.
              </StewardText>
            </View>

            {/* Adjust form */}
            {adjustingItem && (
              <View style={detail.editForm}>
                <StewardText style={detail.editLabel}>Actual amount this month</StewardText>
                <View style={detail.editAmountRow}>
                  <StewardText style={detail.editDollar}>$</StewardText>
                  <TextInput
                    style={detail.editAmountInput}
                    value={adjustAmount}
                    onChangeText={(t) => setAdjustAmount(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    autoFocus
                  />
                </View>
                <View style={detail.editActions}>
                  <TouchableOpacity style={detail.cancelEdit} onPress={() => setAdjustingItem(null)}>
                    <StewardText style={detail.cancelEditLabel}>Cancel</StewardText>
                  </TouchableOpacity>
                  <TouchableOpacity style={detail.saveEdit} onPress={saveAdjust}>
                    <StewardText style={detail.saveEditLabel}>Save</StewardText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {items.length === 0 ? (
                <StewardText style={detail.emptyText}>No fixed commitments on record.</StewardText>
              ) : (
                items.map((item, i) => {
                  const actual = getAmount(item);
                  const adjusted = overrides[item.name] !== undefined;
                  const isVariable = item.variable;
                  return (
                    <View key={i} style={detail.row}>
                      <View style={detail.rowLeft}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
                          <StewardText style={detail.rowCategory}>{item.name}</StewardText>
                          {isVariable && (
                            <View style={detail.variableBadge}>
                              <StewardText style={detail.variableBadgeLabel}>variable</StewardText>
                            </View>
                          )}
                        </View>
                        {item.frequency && item.frequency !== 'monthly' && (
                          <StewardText style={detail.rowNote}>
                            {item.frequency} · {formatCurrency(item.originalAmount || item.amount)} total
                          </StewardText>
                        )}
                        {adjusted && (
                          <StewardText style={detail.rowNote}>
                            Adjusted from {formatCurrency(item.amount)}
                          </StewardText>
                        )}
                        {isVariable && !adjusted && (
                          <StewardText style={detail.rowNote}>Estimate — adjust when bill arrives</StewardText>
                        )}
                      </View>
                      <View style={detail.rowRight}>
                        <StewardText style={[detail.rowAmount, adjusted && { color: COLORS.ember }]}>
                          {formatCurrency(actual)}
                        </StewardText>
                        {isVariable ? (
                          <TouchableOpacity
                            style={detail.editBtn}
                            onPress={() => {
                              setAdjustingItem(item);
                              setAdjustAmount(String(actual));
                            }}
                          >
                            <StewardText style={detail.editBtnLabel}>
                              {adjusted ? 'Edit' : 'Adjust'}
                            </StewardText>
                          </TouchableOpacity>
                        ) : (
                          <View style={detail.lockBadge}>
                            <StewardText style={detail.lockBadgeLabel}>fixed</StewardText>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [spends, setSpends] = useState([]);
  const [observation, setObservation] = useState('');
  const [fixedOverrides, setFixedOverrides] = useState({});
  const [fixedModalVisible, setFixedModalVisible] = useState(false);
  const [debtModalVisible, setDebtModalVisible] = useState(false);
  const [debtActuals, setDebtActuals] = useState({});
  const [transfers, setTransfers] = useState([]);
  const [transferAllocation, setTransferAllocation] = useState(null);
  const [logVisible, setLogVisible] = useState(false);
  const [detailAllocation, setDetailAllocation] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [anomalies, setAnomalies] = useState([]);
  const [activeCrises, setActiveCrises] = useState([]);
  const [showEssentialsDetail, setShowEssentialsDetail] = useState(false);
  const [showDebtDetail, setShowDebtDetail] = useState(false);
  const [showGoalsDetail, setShowGoalsDetail] = useState(false);
  const [showLifeDetail, setShowLifeDetail] = useState(false);
  const [showDebtShortfall, setShowDebtShortfall] = useState(false);
  const [showSavingsWithdrawal, setShowSavingsWithdrawal] = useState(false);
  const [showEssentialOverage, setShowEssentialOverage] = useState(false);
  const [shortfallAmount, setShortfallAmount] = useState('');
  const [shortfallDebt, setShortfallDebt] = useState(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalGoal, setWithdrawalGoal] = useState(null);
  const [ovageAmount, setOvageAmount] = useState('');
  const [ovageItem, setOvageItem] = useState(null);
  const month = currentMonth();

  const load = useCallback(async () => {
    const [debtActualsData, fixedOverridesData] = await Promise.all([
      getDebtActuals(month),
      getFixedOverrides(month),
    ]);
    setDebtActuals(debtActualsData);
    setFixedOverrides(fixedOverridesData);

    const [p, sp, tr, crises] = await Promise.all([
      getProfile(),
      getSpends(month),
      getTransfers(month),
      getActiveCrises(),
    ]);
    setProfile(p);
    setSpends(sp);
    setTransfers(tr);
    setActiveCrises(crises);

    // Auto-regenerate plan if profile is newer than plan or plan is missing
    let pl = await getPlan(month);
    if (p && (!pl || (p.updatedAt && pl.generatedAt && p.updatedAt > pl.generatedAt))) {
      pl = await generatePlan(p);
      await savePlan(pl, month);
    }

    if (pl) {
      // Ensure adhoc layer exists — inject if plan was generated before it was added
      const hasAdhoc = pl.allocations.some(a => a.layer === 'adhoc');
      if (!hasAdhoc) {
        pl.allocations.push({
          layer: 'adhoc',
          name: 'Ad hoc',
          amount: 0,
          spent: 0,
          note: 'Some months have surprises. This is where they go.',
        });
      }

      const updatedAllocations = pl.allocations.map((alloc) => {
        if (alloc.layer === 'fixed') return { ...alloc, spent: alloc.amount };
        if (alloc.layer?.startsWith('investment_')) return { ...alloc, spent: alloc.amount };
        if (alloc.layer === 'debt_floor') {
          // Merge actual payments into items
          const itemsWithActuals = (alloc.items || []).map((item) => {
            const actual = debtActualsData[item.name];
            return actual ? { ...item, actualAmount: actual.amount, actualNote: actual.note } : item;
          });
          // Spent = sum of actual payments; fall back to minimum if no actual recorded
          const totalPaid = itemsWithActuals.reduce((sum, item) =>
            sum + (item.actualAmount !== undefined ? item.actualAmount : item.amount), 0
          );
          return { ...alloc, spent: totalPaid, items: itemsWithActuals };
        }
        if (alloc.layer === 'stability' || alloc.layer === 'debt_accelerator' || alloc.layer?.startsWith('goal_')) {
          return { ...alloc, spent: Math.max(0, netTransferred(tr, alloc.layer)) };
        }
        if (alloc.layer === 'adhoc') {
          const adhocSpends = sp
            .filter((s) => (s.layer || '').toLowerCase().replace(/\s/g, '') === 'adhoc')
            .reduce((sum, s) => sum + s.amount, 0);
          return { ...alloc, spent: adhocSpends };
        }
        if (alloc.layer === 'life') {
          const LIFE_KEYS = new Set(['life', 'food', 'quality of life', 'qol']);
          const lifeSpends = sp
            .filter((s) => LIFE_KEYS.has((s.layer || s.category || '').toLowerCase()))
            .reduce((sum, s) => sum + s.amount, 0);
          return { ...alloc, spent: lifeSpends };
        }
        const allocName = alloc.name.toLowerCase();
        const categorySpends = sp
          .filter((s) => (s.layer || s.category || '').toLowerCase() === allocName)
          .reduce((sum, s) => sum + s.amount, 0);
        return { ...alloc, spent: categorySpends };
      });
      setPlan({ ...pl, allocations: updatedAllocations });

      const planTotalSpent = updatedAllocations.reduce((s, a) => s + (a.spent || 0), 0);
      const overAmount = Math.max(0, planTotalSpent - (pl.income || 0));
      getDailyObservation(p, { overAmount }).then(setObservation);
    } else {
      getDailyObservation(p, {}).then(setObservation);
    }

    if (p) {
      detectAnomalies(p).then(() => getUnacknowledgedAnomalies()).then(setAnomalies);
    }
  }, [month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleLog = async (spend) => {
    await addSpend(spend, month);
    await load();
  };

  const handleDelete = async (spendId) => {
    const key = `steward_spends_${month}`;
    const raw = await AsyncStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) : [];
    const updated = existing.filter((s) => s.id !== spendId);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    await load();
  };

  const handleEdit = async (spendId, updates) => {
    const key = `steward_spends_${month}`;
    const raw = await AsyncStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) : [];
    const updated = existing.map((s) => s.id === spendId ? { ...s, ...updates } : s);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    await load();
  };

  const handleAdjustCommitment = async (name, actualAmount) => {
    const existing = await getFixedOverrides(month);
    const updated = { ...existing, [name]: actualAmount };
    await saveFixedOverrides(month, updated);
    setFixedOverrides(updated);
    await load();
  };
  const handleAdjustDebt = async (debtName, actualAmount, note) => {
    const existing = await getDebtActuals(month);
    const updated = { ...existing, [debtName]: { amount: actualAmount, note } };
    await saveDebtActuals(month, updated);
    await load();
  };

  const handleDeleteDebtAdjust = async (debtName) => {
    const existing = await getDebtActuals(month);
    const { [debtName]: _removed, ...updated } = existing;
    await saveDebtActuals(month, updated);
    await load();
  };

  const handleAddTransfer = async (transfer) => {
    const updated = await addTransfer(transfer, month);
    setTransfers(updated);
    if (transfer.layer?.startsWith('goal_')) {
      const goalId = transfer.layer.replace('goal_', '');
      const delta = transfer.type === 'deposit' ? transfer.amount : -transfer.amount;
      await updateGoalBalance(goalId, delta);
    }
    if (transfer.layer?.startsWith('investment_')) {
      const investmentId = transfer.layer.replace('investment_', '');
      const delta = transfer.type === 'deposit' ? transfer.amount : -transfer.amount;
      await updateInvestmentBalance(investmentId, delta);
    }
    await load();
  };

  const handleDeleteTransfer = async (transferId) => {
    // Find the transfer before deleting so we can reverse the goal balance
    const existing = transfers.find((t) => t.id === transferId);
    const updated = await deleteTransfer(transferId, month);
    setTransfers(updated);
    if (existing?.layer?.startsWith('goal_')) {
      const goalId = existing.layer.replace('goal_', '');
      const delta = existing.type === 'deposit' ? -existing.amount : existing.amount;
      await updateGoalBalance(goalId, delta);
    }
    if (existing?.layer?.startsWith('investment_')) {
      const investmentId = existing.layer.replace('investment_', '');
      const delta = existing.type === 'deposit' ? -existing.amount : existing.amount;
      await updateInvestmentBalance(investmentId, delta);
    }
    await load();
  };

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const totalAllocated = plan?.allocations.reduce((s, a) => s + a.amount, 0) || 0;
  const totalSpent = plan?.allocations.reduce((s, a) => s + (a.spent || 0), 0) || 0;
  const left = plan ? plan.income - totalSpent : 0;
  const isOver = left < 0;

  // Consolidated bar groups
  const essentialsLayers = plan?.allocations?.filter(a =>
    a.layer?.startsWith('fixed') || a.layer === 'regular_expenses'
  ) || [];
  const debtLayers = plan?.allocations?.filter(a =>
    a.layer === 'debt_floor' || a.layer === 'debt_accelerator'
  ) || [];
  const goalsLayers = plan?.allocations?.filter(a =>
    a.layer === 'stability' || a.layer?.startsWith('goal_') || a.layer?.startsWith('investment_')
  ) || [];
  const lifeLayers = plan?.allocations?.filter(a =>
    a.layer === 'life' || a.layer === 'adhoc' || a.layer?.startsWith('qol')
  ) || [];

  const hasDebtAccel = debtLayers.some(a => a.layer === 'debt_accelerator');
  const debtAccelName = plan?.allocations?.find(a => a.layer === 'debt_accelerator')?.name || 'debt payoff';
  const activeGoalsCount = goalsLayers.filter(a => a.layer?.startsWith('goal_')).length;

  const essentialsBar = {
    layer: 'essentials',
    name: 'Essentials',
    amount: essentialsLayers.reduce((s, a) => s + a.amount, 0),
    spent: essentialsLayers.reduce((s, a) => s + (a.spent || 0), 0),
    note: 'Housing, utilities, groceries & more',
  };
  const debtBar = {
    layer: 'debt',
    name: 'Debt',
    amount: debtLayers.reduce((s, a) => s + a.amount, 0),
    spent: debtLayers.reduce((s, a) => s + (a.spent || 0), 0),
    note: hasDebtAccel ? `Extra toward ${debtAccelName}` : 'Minimums covered',
  };
  const goalsBar = {
    layer: 'goals',
    name: 'Goals & savings',
    amount: goalsLayers.reduce((s, a) => s + a.amount, 0),
    spent: goalsLayers.reduce((s, a) => s + (a.spent || 0), 0),
    note: activeGoalsCount > 0 ? `${activeGoalsCount} goal${activeGoalsCount !== 1 ? 's' : ''} active` : 'Building your future',
  };
  const lifeBar = {
    layer: 'life_group',
    name: 'Life',
    amount: lifeLayers.reduce((s, a) => s + a.amount, 0),
    spent: lifeLayers.reduce((s, a) => s + (a.spent || 0), 0),
    note: 'Dining, entertainment & personal',
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Forest header bar */}
      <View style={styles.forestHeader}>
        <View style={styles.forestHeaderLeft}>
          <FlameIcon size={20} bgColor="transparent" />
          <StewardText style={styles.wordmark}>Steward</StewardText>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={{ padding: 4 }}>
          <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.forest} />}
      >
        {/* Month label */}
        <StewardText style={styles.monthLabel}>{monthLabel}</StewardText>

        {/* Anomaly cards — quiet pattern observations, no alarm tone */}
        {anomalies.map(anomaly => (
          <StewardCard key={anomaly.id} variant="parchment" style={styles.anomalyCard}>
            <View style={styles.anomalyRow}>
              <FlameIcon size={16} bgColor={COLORS.ember} />
              <StewardText variant="stewardVoice" style={{ flex: 1 }}>{anomaly.message}</StewardText>
              <TouchableOpacity
                onPress={() => {
                  acknowledgeAnomaly(anomaly.id);
                  setAnomalies(prev => prev.filter(a => a.id !== anomaly.id));
                }}
                style={{ paddingLeft: SPACING.sm }}
              >
                <StewardText variant="caption" color={COLORS.sage}>Noted</StewardText>
              </TouchableOpacity>
            </View>
            <View style={styles.anomalyFooter}>
              <StewardText variant="caption" color={COLORS.sage}>Something change?</StewardText>
              <TouchableOpacity onPress={() => navigation.navigate('Navigate')}>
                <StewardText variant="caption" color={COLORS.ember}>Navigate</StewardText>
              </TouchableOpacity>
            </View>
          </StewardCard>
        ))}

        {/* Daily observation */}
        {observation ? (
          <StewardCard variant="parchment" style={styles.observationCard}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm }}>
              <StewardText style={styles.spark}>✦</StewardText>
              <StewardText style={[styles.observationText, { flex: 1 }]}>{observation}</StewardText>
            </View>
          </StewardCard>
        ) : null}

        {/* Active crisis awareness */}
        {activeCrises.map((crisis) => {
          const daysIn = Math.floor((Date.now() - new Date(crisis.startDate)) / 86400000);
          const isActive = crisis.status === 'active';
          return (
            <TouchableOpacity
              key={crisis.id}
              onPress={() => navigation.navigate('Navigate')}
              activeOpacity={0.8}
            >
              <StewardCard variant="parchment" style={[styles.crisisCard, { borderLeftColor: isActive ? COLORS.ember : COLORS.sage }]}>
                <View style={styles.crisisRow}>
                  <View style={{ flex: 1 }}>
                    <StewardText style={styles.crisisLabel}>{crisis.eventLabel}</StewardText>
                    <StewardText style={styles.crisisSubline}>
                      {daysIn === 0 ? 'Started today' : `${daysIn} day${daysIn !== 1 ? 's' : ''} in`}
                    </StewardText>
                  </View>
                  <View style={[styles.crisisBadge, { backgroundColor: isActive ? COLORS.emberMuted : COLORS.forestMuted }]}>
                    <StewardText style={[styles.crisisBadgeLabel, { color: isActive ? COLORS.ember : COLORS.forest }]}>
                      {isActive ? 'ACTIVE' : 'MONITORING'}
                    </StewardText>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.placeholder} style={{ marginLeft: SPACING.xs }} />
                </View>
              </StewardCard>
            </TouchableOpacity>
          );
        })}

        {/* Your story — Pro tier entry point */}
        {profile?.tier === 'pro' && (
          <TouchableOpacity
            style={styles.storyRow}
            onPress={() => navigation.navigate('Biography', { profile })}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <StewardText style={styles.storyLabel}>Your financial story</StewardText>
              <StewardText style={styles.storyHint}>A complete look at your progress over time</StewardText>
            </View>
            <View style={styles.proBadge}>
              <StewardText style={styles.proLabel}>PRO</StewardText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.placeholder} />
          </TouchableOpacity>
        )}

        {/* Month summary */}
        {plan && (
          <StewardCard variant="forest" style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <StewardText style={styles.summaryValue}>{formatCurrency(plan.income)}</StewardText>
                <StewardText style={styles.summaryItemLabel}>Income</StewardText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <StewardText style={styles.summaryValue}>{formatCurrency(totalSpent)}</StewardText>
                <StewardText style={styles.summaryItemLabel}>Spent</StewardText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <StewardText style={[styles.summaryValue, isOver && { color: COLORS.ember }]}>
                  {formatCurrency(Math.abs(left))}
                </StewardText>
                <StewardText style={[styles.summaryItemLabel, isOver && { color: COLORS.ember }]}>
                  {isOver ? 'Over' : 'Left'}
                </StewardText>
              </View>
            </View>
          </StewardCard>
        )}

        {/* Structural insolvency alert */}
        {plan?.planState === 'insolvent' && (
          <StewardCard variant="parchment" style={styles.insolventCard}>
            <StewardText style={styles.insolventText}>
              Your committed expenses exceed your income by {formatCurrency(plan.shortfall)}. This isn't a spending problem — it's a structure problem. Navigate can help you build a recovery plan.
            </StewardText>
            <TouchableOpacity
              onPress={() => navigation.navigate('Navigate', { prefillEvent: 'financial_stress' })}
              style={styles.insolventLink}
            >
              <StewardText style={styles.insolventLinkLabel}>Go to Navigate →</StewardText>
            </TouchableOpacity>
          </StewardCard>
        )}

        {/* Allocation bars — four consolidated bars */}
        {plan?.allocations?.length ? (
          <View style={styles.section}>
            <StewardText style={styles.sectionLabel}>YOUR PLAN</StewardText>
            <StewardText style={styles.sectionHint}>Tap any bar to see the breakdown</StewardText>

            <TouchableOpacity activeOpacity={0.85} onPress={() => setShowEssentialsDetail(true)}>
              <AllocationBar allocation={essentialsBar} />
            </TouchableOpacity>

            {debtBar.amount > 0 && (
              <TouchableOpacity activeOpacity={0.85} onPress={() => setShowDebtDetail(true)}>
                <AllocationBar allocation={debtBar} />
              </TouchableOpacity>
            )}

            {goalsBar.amount > 0 && (
              <TouchableOpacity activeOpacity={0.85} onPress={() => setShowGoalsDetail(true)}>
                <AllocationBar allocation={goalsBar} />
              </TouchableOpacity>
            )}

            {lifeBar.amount > 0 && (
              <TouchableOpacity activeOpacity={0.85} onPress={() => setShowLifeDetail(true)}>
                <AllocationBar allocation={lifeBar} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <StewardCard style={styles.emptyCard}>
            <StewardText style={styles.emptyText}>Your plan is being built. Pull to refresh.</StewardText>
          </StewardCard>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setLogVisible(true)} activeOpacity={0.85}>
        <StewardText style={styles.fabLabel}>+ Log</StewardText>
      </TouchableOpacity>

      <QuickLogModal visible={logVisible} onClose={() => setLogVisible(false)} onLog={handleLog} />

      <DebtMinimumsModal
        visible={debtModalVisible}
        allocation={plan?.allocations.find(a => a.layer === 'debt_floor')}
        onClose={() => setDebtModalVisible(false)}
        onAdjust={handleAdjustDebt}
        onDeleteAdjust={handleDeleteDebtAdjust}
      />

      <FixedCommitmentsModal
        visible={fixedModalVisible}
        allocation={plan?.allocations.find(a => a.layer === 'fixed')}
        overrides={fixedOverrides}
        onClose={() => setFixedModalVisible(false)}
        onAdjust={handleAdjustCommitment}
      />

      <TransferLedgerModal
        visible={!!transferAllocation}
        allocation={transferAllocation}
        transfers={transfers}
        onClose={() => setTransferAllocation(null)}
        onAdd={handleAddTransfer}
        onDelete={handleDeleteTransfer}
      />

      <SpendDetailModal
        visible={!!detailAllocation}
        allocation={detailAllocation}
        spends={spends}
        onClose={() => setDetailAllocation(null)}
        onDelete={async (id) => {
          await handleDelete(id);
          setSpends(spends.filter((s) => s.id !== id));
        }}
        onEdit={async (id, updates) => {
          await handleEdit(id, updates);
          setSpends(spends.map((s) => s.id === id ? { ...s, ...updates } : s));
        }}
      />

      {/* ─── Essentials detail sheet ─── */}
      <Modal visible={showEssentialsDetail} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={detail.overlay}>
          <View style={[detail.sheet, { maxHeight: '90%' }]}>
            <View style={detail.header}>
              <StewardText style={detail.title}>Essentials</StewardText>
              <TouchableOpacity onPress={() => setShowEssentialsDetail(false)} style={detail.closeBtn}>
                <StewardText style={detail.closeLabel}>Done</StewardText>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {essentialsLayers.map((alloc, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (alloc.layer === 'fixed') {
                      setFixedModalVisible(true);
                    } else {
                      setDetailAllocation(alloc);
                    }
                  }}
                >
                  <AllocationBar allocation={alloc} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={exStyle.exLink}
              onPress={() => { setShowEssentialsDetail(false); setShowEssentialOverage(true); }}
            >
              <StewardText style={exStyle.exLinkLabel}>An essential came in higher than expected →</StewardText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modal.logBtn, { marginTop: SPACING.sm }]}
              onPress={() => setShowEssentialsDetail(false)}
            >
              <StewardText style={modal.logBtnLabel}>Done</StewardText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Debt detail sheet ─── */}
      <Modal visible={showDebtDetail} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={detail.overlay}>
          <View style={[detail.sheet, { maxHeight: '90%' }]}>
            <View style={detail.header}>
              <StewardText style={detail.title}>Debt</StewardText>
              <TouchableOpacity onPress={() => setShowDebtDetail(false)} style={detail.closeBtn}>
                <StewardText style={detail.closeLabel}>Done</StewardText>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {debtLayers.map((alloc, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (alloc.layer === 'debt_floor') {
                      setDebtModalVisible(true);
                    } else {
                      setTransferAllocation(alloc);
                    }
                  }}
                >
                  <AllocationBar allocation={alloc} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={exStyle.exLink}
              onPress={() => { setShowDebtDetail(false); setShowDebtShortfall(true); }}
            >
              <StewardText style={exStyle.exLinkLabel}>I paid less than planned →</StewardText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modal.logBtn, { marginTop: SPACING.sm }]}
              onPress={() => setShowDebtDetail(false)}
            >
              <StewardText style={modal.logBtnLabel}>Done</StewardText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Goals & savings detail sheet ─── */}
      <Modal visible={showGoalsDetail} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={detail.overlay}>
          <View style={[detail.sheet, { maxHeight: '90%' }]}>
            <View style={detail.header}>
              <StewardText style={detail.title}>Goals & savings</StewardText>
              <TouchableOpacity onPress={() => setShowGoalsDetail(false)} style={detail.closeBtn}>
                <StewardText style={detail.closeLabel}>Done</StewardText>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {goalsLayers.map((alloc, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.7}
                  onPress={() => setTransferAllocation(alloc)}
                >
                  <AllocationBar allocation={alloc} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={exStyle.exLink}
              onPress={() => { setShowGoalsDetail(false); setShowSavingsWithdrawal(true); }}
            >
              <StewardText style={exStyle.exLinkLabel}>I used some savings →</StewardText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modal.logBtn, { marginTop: SPACING.sm }]}
              onPress={() => setShowGoalsDetail(false)}
            >
              <StewardText style={modal.logBtnLabel}>Done</StewardText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Life detail sheet ─── */}
      <Modal visible={showLifeDetail} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={detail.overlay}>
          <View style={[detail.sheet, { maxHeight: '90%' }]}>
            <View style={detail.header}>
              <StewardText style={detail.title}>Life</StewardText>
              <TouchableOpacity onPress={() => setShowLifeDetail(false)} style={detail.closeBtn}>
                <StewardText style={detail.closeLabel}>Done</StewardText>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {lifeLayers.map((alloc, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.7}
                  onPress={() => setDetailAllocation(alloc)}
                >
                  <AllocationBar allocation={alloc} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[modal.logBtn, { marginTop: SPACING.md }]}
              onPress={() => setShowLifeDetail(false)}
            >
              <StewardText style={modal.logBtnLabel}>Done</StewardText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Debt shortfall exception ─── */}
      <Modal visible={showDebtShortfall} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={exStyle.overlay}>
            <View style={exStyle.sheet}>
              <StewardText style={detail.title}>I paid less than planned</StewardText>
              <StewardText style={[detail.summaryText, { marginTop: SPACING.sm, marginBottom: SPACING.md }]}>
                How much did you actually pay toward debt this month?
              </StewardText>
              <View style={exStyle.inputRow}>
                <StewardText style={modal.dollar}>$</StewardText>
                <TextInput
                  style={exStyle.input}
                  value={shortfallAmount}
                  onChangeText={t => setShortfallAmount(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.placeholder}
                  autoFocus
                />
              </View>
              <StewardText style={exStyle.impactNote}>
                Paying less than the minimum can affect your credit and extend your payoff timeline.
              </StewardText>
              <TouchableOpacity
                style={[exStyle.primaryBtn, !shortfallAmount && { backgroundColor: COLORS.border }]}
                disabled={!shortfallAmount}
                onPress={async () => {
                  const val = Number(shortfallAmount);
                  const existing = await getDebtActuals(month);
                  await saveDebtActuals(month, { ...existing, shortfall: val, date: new Date().toISOString() });
                  setShowDebtShortfall(false);
                  setShortfallAmount('');
                  await load();
                }}
              >
                <StewardText style={modal.logBtnLabel}>Log it</StewardText>
              </TouchableOpacity>
              <TouchableOpacity
                style={exStyle.cancelLink}
                onPress={() => { setShowDebtShortfall(false); setShortfallAmount(''); }}
              >
                <StewardText style={[detail.summaryText, { textDecorationLine: 'underline' }]}>Cancel</StewardText>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Savings withdrawal exception ─── */}
      <Modal visible={showSavingsWithdrawal} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={exStyle.overlay}>
            <View style={exStyle.sheet}>
              <StewardText style={detail.title}>I used some savings</StewardText>
              <StewardText style={[detail.summaryText, { marginTop: SPACING.sm, marginBottom: SPACING.md }]}>
                How much did you withdraw?
              </StewardText>
              <View style={exStyle.inputRow}>
                <StewardText style={modal.dollar}>$</StewardText>
                <TextInput
                  style={exStyle.input}
                  value={withdrawalAmount}
                  onChangeText={t => setWithdrawalAmount(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.placeholder}
                  autoFocus
                />
              </View>
              <StewardText style={exStyle.impactNote}>
                Your buffer balance will be updated and your goal health rechecked on next load.
              </StewardText>
              <TouchableOpacity
                style={[exStyle.primaryBtn, !withdrawalAmount && { backgroundColor: COLORS.border }]}
                disabled={!withdrawalAmount}
                onPress={async () => {
                  const val = Number(withdrawalAmount);
                  const existing = await getFixedOverrides(month);
                  await saveFixedOverrides(month, { ...existing, savingsWithdrawal: val, date: new Date().toISOString() });
                  setShowSavingsWithdrawal(false);
                  setWithdrawalAmount('');
                  await load();
                }}
              >
                <StewardText style={modal.logBtnLabel}>Log it</StewardText>
              </TouchableOpacity>
              <TouchableOpacity
                style={exStyle.cancelLink}
                onPress={() => { setShowSavingsWithdrawal(false); setWithdrawalAmount(''); }}
              >
                <StewardText style={[detail.summaryText, { textDecorationLine: 'underline' }]}>Cancel</StewardText>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Essential overage exception ─── */}
      <Modal visible={showEssentialOverage} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={exStyle.overlay}>
            <View style={exStyle.sheet}>
              <StewardText style={detail.title}>An essential came in higher</StewardText>
              <StewardText style={[detail.summaryText, { marginTop: SPACING.sm }]}>
                Which one, and what did it actually cost?
              </StewardText>
              <View style={exStyle.pillRow}>
                {essentialsLayers.flatMap(alloc => alloc.items || []).map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[exStyle.pill, ovageItem?.name === item.name && exStyle.pillActive]}
                    onPress={() => { setOvageItem(item); setOvageAmount(String(item.amount)); }}
                  >
                    <StewardText style={[exStyle.pillLabel, ovageItem?.name === item.name && exStyle.pillLabelActive]}>
                      {item.name}
                    </StewardText>
                  </TouchableOpacity>
                ))}
              </View>
              {ovageItem && (
                <View style={exStyle.inputRow}>
                  <StewardText style={modal.dollar}>$</StewardText>
                  <TextInput
                    style={exStyle.input}
                    value={ovageAmount}
                    onChangeText={t => setOvageAmount(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={COLORS.placeholder}
                    autoFocus
                  />
                </View>
              )}
              <StewardText style={exStyle.impactNote}>
                We'll note the variance. If this keeps happening, Steward will suggest updating your estimate.
              </StewardText>
              <TouchableOpacity
                style={[exStyle.primaryBtn, (!ovageItem || !ovageAmount) && { backgroundColor: COLORS.border }]}
                disabled={!ovageItem || !ovageAmount}
                onPress={async () => {
                  const existing = await getFixedOverrides(month);
                  await saveFixedOverrides(month, {
                    ...existing,
                    [ovageItem.name]: { actual: Number(ovageAmount), estimated: ovageItem.amount, date: new Date().toISOString() },
                  });
                  setShowEssentialOverage(false);
                  setOvageAmount('');
                  setOvageItem(null);
                  await load();
                }}
              >
                <StewardText style={modal.logBtnLabel}>Log it</StewardText>
              </TouchableOpacity>
              <TouchableOpacity
                style={exStyle.cancelLink}
                onPress={() => { setShowEssentialOverage(false); setOvageAmount(''); setOvageItem(null); }}
              >
                <StewardText style={[detail.summaryText, { textDecorationLine: 'underline' }]}>Cancel</StewardText>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.parchment },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  forestHeader: {
    backgroundColor: COLORS.forest,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  forestHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  wordmark: {
    fontFamily: FONTS.serif.bold,
    fontSize: SIZES.lg,
    color: COLORS.white,
    lineHeight: SIZES.lg * 1.3,
  },
  monthLabel: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.sm,
    color: COLORS.placeholder,
  },
  anomalyCard: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.ember,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  anomalyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  anomalyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  observationCard: { paddingVertical: SPACING.sm + 2 },
  observationText: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    lineHeight: SIZES.base * 1.6,
  },
  spark: {
    fontSize: SIZES.base,
    color: COLORS.ember,
    lineHeight: SIZES.base * 1.6,
  },
  summaryCard: { paddingVertical: SPACING.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontFamily: FONTS.sans.medium, fontSize: SIZES.lg, color: COLORS.white },
  summaryItemLabel: { fontFamily: FONTS.sans.light, fontSize: SIZES.xs, color: '#9DC4AE', marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: '#2A5C43' },
  section: { gap: SPACING.xs },
  sectionLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.xs,
    color: COLORS.sage,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  sectionHint: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    marginBottom: SPACING.sm,
  },
  emptyCard: { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyText: { fontFamily: FONTS.sans.light, fontSize: SIZES.base, color: COLORS.placeholder, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.lg,
    backgroundColor: COLORS.ember,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...SHADOW.medium,
  },
  fabLabel: { fontFamily: FONTS.sans.medium, fontSize: SIZES.base, color: COLORS.white },
  storyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    ...SHADOW.soft,
  },
  storyLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
  },
  storyHint: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    marginTop: 2,
  },
  proBadge: {
    backgroundColor: COLORS.emberMuted,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
  },
  proLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: 9,
    color: COLORS.ember,
    letterSpacing: 0.5,
  },
  crisisCard: {
    borderLeftWidth: 3,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  crisisRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  crisisLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.base,
    color: COLORS.hearth,
  },
  crisisSubline: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.xs,
    color: COLORS.placeholder,
    marginTop: 2,
  },
  crisisBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
    marginRight: SPACING.xs,
  },
  crisisBadgeLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  insolventCard: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.ember,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  insolventText: {
    fontFamily: FONTS.sans.regular,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    lineHeight: SIZES.base * 1.6,
    marginBottom: SPACING.sm,
  },
  insolventLink: {
    alignSelf: 'flex-start',
    paddingTop: SPACING.xs,
  },
  insolventLinkLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.ember,
  },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28,25,22,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  title: { fontFamily: FONTS.serif.bold, fontSize: SIZES.xl, color: COLORS.hearth, lineHeight: SIZES.xl * 1.4 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.forest,
    paddingBottom: SPACING.sm,
  },
  dollar: { fontFamily: FONTS.sans.light, fontSize: SIZES.xxxl, color: COLORS.hearth, lineHeight: SIZES.xxxl * 1.3 },
  amountInput: { fontFamily: FONTS.sans.light, fontSize: SIZES.xxxl, color: COLORS.hearth, flex: 1, lineHeight: SIZES.xxxl * 1.3 },
  pill: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  pillActive: { borderColor: COLORS.forest, backgroundColor: COLORS.forest },
  pillLabel: { fontFamily: FONTS.sans.regular, fontSize: SIZES.sm, color: COLORS.hearth },
  pillLabelActive: { color: COLORS.white },
  noteInput: {
    fontFamily: FONTS.sans.light,
    fontSize: SIZES.base,
    color: COLORS.hearth,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.sm + 4,
    lineHeight: SIZES.base * 1.4,
  },
  logBtn: { backgroundColor: COLORS.forest, borderRadius: RADIUS.sm, paddingVertical: SPACING.md, alignItems: 'center' },
  logBtnDisabled: { backgroundColor: COLORS.border },
  logBtnLabel: { fontFamily: FONTS.sans.medium, fontSize: SIZES.md, color: COLORS.white },
  cancelBtn: { alignItems: 'center' },
  cancelLabel: { fontFamily: FONTS.sans.light, fontSize: SIZES.sm, color: COLORS.placeholder },
});

const detail = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28,25,22,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    maxHeight: '80%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  title: { fontFamily: FONTS.serif.bold, fontSize: SIZES.xl, color: COLORS.hearth, lineHeight: SIZES.xl * 1.4 },
  closeBtn: { padding: SPACING.sm },
  closeLabel: { fontFamily: FONTS.sans.medium, fontSize: SIZES.base, color: COLORS.forest },
  summary: { marginBottom: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  summaryText: { fontFamily: FONTS.sans.regular, fontSize: SIZES.sm, color: COLORS.placeholder },
  emptyText: { fontFamily: FONTS.sans.light, fontSize: SIZES.base, color: COLORS.placeholder, textAlign: 'center', paddingVertical: SPACING.xl },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLeft: { flex: 1, gap: 2 },
  rowCategory: { fontFamily: FONTS.sans.medium, fontSize: SIZES.base, color: COLORS.hearth },
  rowNote: { fontFamily: FONTS.sans.light, fontSize: SIZES.sm, color: COLORS.placeholder },
  rowDate: { fontFamily: FONTS.sans.light, fontSize: SIZES.xs, color: COLORS.placeholder },
  rowRight: { alignItems: 'flex-end', gap: SPACING.xs },
  rowAmount: { fontFamily: FONTS.sans.medium, fontSize: SIZES.base, color: COLORS.forest },
  rowActions: { flexDirection: 'row', gap: SPACING.xs },
  editBtn: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, backgroundColor: COLORS.parchmentDark, borderRadius: RADIUS.sm },
  editBtnLabel: { fontFamily: FONTS.sans.medium, fontSize: SIZES.xs, color: COLORS.sage },
  deleteBtn: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, backgroundColor: '#FFF0EE', borderRadius: RADIUS.sm },
  deleteBtnLabel: { fontFamily: FONTS.sans.medium, fontSize: SIZES.xs, color: COLORS.error },
  // Edit form
  editForm: { backgroundColor: COLORS.parchmentDark, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, gap: SPACING.sm },
  editLabel: { fontFamily: FONTS.sans.medium, fontSize: SIZES.xs, color: COLORS.sage, letterSpacing: 0.8, textTransform: 'uppercase' },
  editAmountRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderBottomWidth: 2, borderBottomColor: COLORS.forest, paddingBottom: SPACING.xs },
  editDollar: { fontFamily: FONTS.sans.light, fontSize: SIZES.xl, color: COLORS.hearth },
  editAmountInput: { fontFamily: FONTS.sans.light, fontSize: SIZES.xl, color: COLORS.hearth, flex: 1 },
  editNoteInput: { fontFamily: FONTS.sans.light, fontSize: SIZES.base, color: COLORS.hearth, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm, lineHeight: SIZES.base * 1.4, backgroundColor: COLORS.white },
  editActions: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'flex-end' },
  cancelEdit: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border },
  cancelEditLabel: { fontFamily: FONTS.sans.medium, fontSize: SIZES.sm, color: COLORS.placeholder },
  saveEdit: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm, backgroundColor: COLORS.forest },
  saveEditLabel: { fontFamily: FONTS.sans.medium, fontSize: SIZES.sm, color: COLORS.white },
  pill: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  pillActive: { borderColor: COLORS.forest, backgroundColor: COLORS.forest },
  pillLabel: { fontFamily: FONTS.sans.regular, fontSize: SIZES.xs, color: COLORS.hearth },
  pillLabelActive: { color: COLORS.white },
  variableBadge: {
    backgroundColor: COLORS.emberMuted,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 1,
  },
  variableBadgeLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: 9,
    color: COLORS.ember,
    letterSpacing: 0.3,
  },
  lockBadge: {
    backgroundColor: COLORS.parchmentDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 1,
  },
  lockBadgeLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: 9,
    color: COLORS.placeholder,
    letterSpacing: 0.3,
  },
});

const transfer = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  depositBtn: {
    borderColor: COLORS.forest,
    backgroundColor: COLORS.forestMuted,
  },
  withdrawBtn: {
    borderColor: COLORS.ember,
    backgroundColor: COLORS.emberMuted,
  },
  depositLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.forest,
  },
  withdrawLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.ember,
  },
  fullBtn: {
    backgroundColor: COLORS.forest,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  fullBtnLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: SIZES.sm,
    color: COLORS.white,
  },
});

const exStyle = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xxl },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: SPACING.sm },
  input: { fontFamily: FONTS.sans.medium, fontSize: SIZES.xxxl, color: COLORS.hearth, flex: 1, paddingVertical: SPACING.sm, paddingLeft: SPACING.xs },
  impactNote: { color: COLORS.placeholder, fontSize: SIZES.sm, lineHeight: SIZES.sm * 1.6, marginTop: SPACING.md },
  primaryBtn: { backgroundColor: COLORS.forest, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.lg },
  cancelLink: { alignItems: 'center', paddingVertical: SPACING.md },
  exLink: { alignItems: 'center', paddingVertical: SPACING.md, marginTop: SPACING.xs },
  exLinkLabel: { fontFamily: FONTS.sans.light, fontSize: SIZES.sm, color: COLORS.placeholder, textDecorationLine: 'underline' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginVertical: SPACING.md },
  pill: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  pillActive: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  pillLabel: { fontFamily: FONTS.sans.medium, fontSize: SIZES.sm, color: COLORS.hearth },
  pillLabelActive: { color: COLORS.parchment },
});
