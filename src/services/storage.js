import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Keys ────────────────────────────────────────────────────────────────────

const KEYS = {
  PROFILE:             'steward_profile',
  ALLOCATIONS:         'steward_allocations',
  SPEND_LOG:           'steward_spend_log',
  LIFE_EVENTS:         'steward_life_events',
  ONBOARDING_COMPLETE: 'steward_onboarding_complete',
};

// ─── Profile ──────────────────────────────────────────────────────────────────
// Shape: { name, situation, lifeStage, monthlyIncome, fixedTotal, debtTotal,
//          foodBudget, currentSavings, createdAt, updatedAt }

export async function getProfile() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PROFILE);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function saveProfile(profile) {
  await AsyncStorage.setItem(
    KEYS.PROFILE,
    JSON.stringify({ ...profile, updatedAt: new Date().toISOString() })
  );
}

// ─── Allocations ──────────────────────────────────────────────────────────────
// Shape: [{ id, label, stewardLabel, budgeted, spent, type }]
// type: 'fixed' | 'debt' | 'savings' | 'goal' | 'variable'

export async function getAllocations() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ALLOCATIONS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveAllocations(allocations) {
  await AsyncStorage.setItem(KEYS.ALLOCATIONS, JSON.stringify(allocations));
}

export async function updateAllocationSpent(allocationId, amount) {
  const allocations = await getAllocations();
  const updated = allocations.map(a =>
    a.id === allocationId ? { ...a, spent: (a.spent || 0) + amount } : a
  );
  await saveAllocations(updated);
  return updated;
}

// ─── Spend Log ────────────────────────────────────────────────────────────────
// Entry shape: { id, amount, category, allocationId, note, date }

export async function getSpendLog() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SPEND_LOG);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addSpendEntry(entry) {
  const log = await getSpendLog();
  const newEntry = {
    ...entry,
    id:   `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    date: new Date().toISOString(),
  };
  await AsyncStorage.setItem(KEYS.SPEND_LOG, JSON.stringify([newEntry, ...log]));
  return newEntry;
}

// ─── Life Events ──────────────────────────────────────────────────────────────

export async function logLifeEvent(event) {
  try {
    const raw    = await AsyncStorage.getItem(KEYS.LIFE_EVENTS);
    const events = raw ? JSON.parse(raw) : [];
    const entry  = { ...event, id: Date.now().toString(), date: new Date().toISOString() };
    await AsyncStorage.setItem(KEYS.LIFE_EVENTS, JSON.stringify([entry, ...events]));
  } catch {}
}

// ─── Onboarding Gate ─────────────────────────────────────────────────────────

export async function isOnboardingComplete() {
  try {
    const val = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETE);
    return val === 'true';
  } catch { return false; }
}

export async function markOnboardingComplete() {
  await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETE, 'true');
}

// ─── Reset (dev utility) ─────────────────────────────────────────────────────

export async function clearAll() {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}

// ─── Build allocations from onboarding profile ───────────────────────────────
// Called once at the end of onboarding. Produces the initial deployment plan.

export function buildAllocationsFromProfile(profile) {
  const income   = parseFloat(profile.monthlyIncome) || 0;
  const fixed    = parseFloat(profile.fixedTotal)    || 0;
  const debts    = parseFloat(profile.debtTotal)     || 0;
  const food     = parseFloat(profile.foodBudget)    || 0;
  const leftover = income - fixed - debts - food;

  // 30% of leftover → stability buffer, rest → quality of life
  const stability = Math.max(0, Math.round(leftover * 0.3));
  const qol       = Math.max(0, leftover - stability);

  const rows = [
    {
      id:           'fixed',
      label:        'Fixed Commitments',
      stewardLabel: 'Auto-committed. Non-negotiable. Covered.',
      budgeted:     fixed,
      spent:        0,
      type:         'fixed',
    },
    {
      id:           'debts',
      label:        'Debt Payments',
      stewardLabel: 'Floor. Protect at all costs.',
      budgeted:     debts,
      spent:        0,
      type:         'debt',
    },
    {
      id:           'food',
      label:        'Food',
      stewardLabel: 'Active bucket. Deploy as you spend.',
      budgeted:     food,
      spent:        0,
      type:         'variable',
    },
    {
      id:           'stability',
      label:        'Stability Buffer',
      stewardLabel: `Building toward $${(stability * 6).toLocaleString()} over 6 months.`,
      budgeted:     stability,
      spent:        0,
      type:         'savings',
    },
    {
      id:           'qol',
      label:        'Quality of Life',
      stewardLabel: 'Yours to deploy. No questions asked.',
      budgeted:     qol,
      spent:        0,
      type:         'variable',
    },
  ];

  return rows.filter(r => r.budgeted > 0);
}
