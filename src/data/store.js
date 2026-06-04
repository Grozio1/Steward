import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage keys ──────────────────────────────────────────────────────────────
const K = {
  PROFILE: 'steward_profile',
  PLAN: 'steward_plan',
  SPENDS: 'steward_spends',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatCurrency(n) {
  const num = Number(n) || 0;
  return `$${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

// ─── Profile ───────────────────────────────────────────────────────────────────
// Shape:
// {
//   name: string,
//   priorities: string,
//   netIncome: number,
//   payFrequency: 'weekly' | 'biweekly' | 'monthly',
//   fixedCommitments: [{ name, amount }],
//   debts: [{ name, balance, minimum, rate }],
//   savings: number,
//   goals: string,
//   createdAt: string,  // ISO
// }
export async function getProfile() {
  try {
    const raw = await AsyncStorage.getItem(K.PROFILE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveProfile(profile) {
  await AsyncStorage.setItem(K.PROFILE, JSON.stringify({
    ...profile,
    createdAt: profile.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

// Update a single goal's saved balance by delta (positive = deposit, negative = withdrawal)
export async function updateGoalBalance(goalId, delta) {
  const profile = await getProfile();
  if (!profile) return;
  const goals = profile.savingsGoals || [];
  const updated = goals.map((g) =>
    g.id === goalId
      ? { ...g, saved: Math.max(0, (Number(g.saved) || 0) + delta) }
      : g
  );
  await saveProfile({ ...profile, savingsGoals: updated });
}

// Update a single investment's balance by delta (positive = contribution, negative = reversal)
export async function updateInvestmentBalance(investmentId, delta) {
  const profile = await getProfile();
  if (!profile) return;
  const investments = profile.investments || [];
  const updated = investments.map((inv) =>
    inv.id === investmentId
      ? { ...inv, balance: Math.max(0, (Number(inv.balance) || 0) + delta) }
      : inv
  );
  await saveProfile({ ...profile, investments: updated });
}

// ─── Plan ──────────────────────────────────────────────────────────────────────
// Shape:
// {
//   month: string,  // YYYY-MM
//   income: number,
//   allocations: [{ layer, name, amount, spent, note, items? }],
//   generatedAt: string,
// }
export async function getPlan(month = currentMonth()) {
  try {
    const raw = await AsyncStorage.getItem(`${K.PLAN}_${month}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function savePlan(plan, month = currentMonth()) {
  await AsyncStorage.setItem(`${K.PLAN}_${month}`, JSON.stringify({ ...plan, month }));
}

// ─── Spends ────────────────────────────────────────────────────────────────────
// Shape: [{ id, date, amount, category, note, month }]
export async function getSpends(month = currentMonth()) {
  try {
    const raw = await AsyncStorage.getItem(`${K.SPENDS}_${month}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addSpend(spend, month = currentMonth()) {
  const existing = await getSpends(month);
  const entry = {
    ...spend,
    id: Date.now().toString(),
    date: new Date().toISOString(),
    month,
  };
  const updated = [...existing, entry];
  await AsyncStorage.setItem(`${K.SPENDS}_${month}`, JSON.stringify(updated));
  return updated;
}

// ─── Transfer ledger ───────────────────────────────────────────────────────────
// Tracks deposits and withdrawals for stability buffer and debt accelerator.
// Shape: [{ id, date, layer, type: 'deposit'|'withdrawal', amount, note }]
export async function getTransfers(month = currentMonth()) {
  try {
    const raw = await AsyncStorage.getItem(`steward_transfers_${month}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addTransfer(transfer, month = currentMonth()) {
  const existing = await getTransfers(month);
  const entry = {
    ...transfer,
    id: Date.now().toString(),
    date: new Date().toISOString(),
    month,
  };
  const updated = [...existing, entry];
  await AsyncStorage.setItem(`steward_transfers_${month}`, JSON.stringify(updated));
  return updated;
}

export async function deleteTransfer(transferId, month = currentMonth()) {
  const existing = await getTransfers(month);
  const updated = existing.filter((t) => t.id !== transferId);
  await AsyncStorage.setItem(`steward_transfers_${month}`, JSON.stringify(updated));
  return updated;
}

// Net amount moved for a given layer this month (deposits minus withdrawals)
export function netTransferred(transfers, layer) {
  return transfers
    .filter((t) => t.layer === layer)
    .reduce((sum, t) => t.type === 'deposit' ? sum + t.amount : sum - t.amount, 0);
}

// ─── Life events (Navigate) ────────────────────────────────────────────────────
export async function saveLifeEvent({ event, notes }) {
  try {
    const raw = await AsyncStorage.getItem('steward_life_events');
    const existing = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const record = {
      id: 'evt_' + Date.now(),
      date: now.toISOString(),
      year: now.getFullYear(),
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      event,
      notes: notes || null,
    };
    await AsyncStorage.setItem('steward_life_events', JSON.stringify([...existing, record]));
  } catch (err) {
    console.error('[store] saveLifeEvent failed:', err);
  }
}

export async function getLifeEvents() {
  try {
    const raw = await AsyncStorage.getItem('steward_life_events');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Dev utility ───────────────────────────────────────────────────────────────
export async function clearAll() {
  await AsyncStorage.clear();
}
