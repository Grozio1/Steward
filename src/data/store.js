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
  }));
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

// ─── Dev utility ───────────────────────────────────────────────────────────────
export async function clearAll() {
  await AsyncStorage.clear();
}
