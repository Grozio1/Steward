import { generateRequiredGoals, evaluateGoalHealth } from './goals';

// AI stub layer — fallback implementations and plan arithmetic.
// getDailyObservation and generateSynthesis have moved to claude.js (real API).
// This file is still the source of truth for generatePlan (pure arithmetic, no AI needed)
// and provides stub fallbacks that claude.js imports on API error.

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function fmt(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString()}`;
}

// Returns the user's current age in years.
// Uses dateOfBirth when available; falls back to life-stage midpoints.
const STAGE_MIDPOINTS = {
  starting_out:      25,
  building_career:   31,
  growing_household: 38,
  peak_earning:      50,
  pre_retirement:    61,
  retired:           68,
};

export function getAge(profile) {
  if (profile?.dateOfBirth) {
    const dob = new Date(profile.dateOfBirth);
    if (!isNaN(dob.getTime())) {
      return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
  }
  return STAGE_MIDPOINTS[profile?.lifeStageSignal] ?? 35;
}

// Converts per-paycheck netIncome to a true monthly figure.
export function toMonthly(netIncome, payFrequency) {
  const n = Number(netIncome) || 0;
  switch (payFrequency) {
    case 'weekly':       return Math.round(n * 52 / 12);
    case 'biweekly':     return Math.round(n * 26 / 12);
    case 'semi-monthly':
    case 'semimonthly':  return Math.round(n * 2);
    case 'monthly':
    default:             return n;
  }
}

// ─── Synthesis ─────────────────────────────────────────────────────────────────
// Called on SynthesisScreen. Returns what Steward "heard" + one key insight.
export async function generateSynthesis(profile) {
  await delay(1400);

  const {
    name,
    netIncome,
    payFrequency,
    fixedCommitments = [],
    debts = [],
    savings,
  } = profile;

  const monthly = toMonthly(netIncome, payFrequency);
  const fixedTotal = fixedCommitments.reduce((s, c) => s + Number(c.monthlyAmount || c.amount), 0);
  const debtMinimums = debts.reduce((s, d) => s + Number(d.minimum || 0), 0);
  const debtTotal = debts.reduce((s, d) => s + Number(d.balance || 0), 0);
  const monthlyFixed = fixedTotal + debtMinimums;
  const remaining = monthly - monthlyFixed;

  // One key insight — the single most important thing to say
  let keyInsight;
  const highRateDebt = debts.find((d) => Number(d.rate) > 15);
  if (highRateDebt) {
    keyInsight = `The ${highRateDebt.name} at ${highRateDebt.rate}% is costing you money every month it sits. That's the first thing I want to help you fix.`;
  } else if (debtTotal > 0) {
    keyInsight = `You're carrying ${fmt(debtTotal)} in debt. Getting ahead of that changes what's possible.`;
  } else if (savings < monthlyFixed * 2) {
    const savingsNum = Number(savings) || 0;
    const months = monthlyFixed > 0 ? (savingsNum / monthlyFixed).toFixed(1) : '0';
    keyInsight = `You have about ${months} months of runway. I'd like to build that to three before anything else.`;
  } else {
    keyInsight = `You're in a solid position, ${name}. The goal now is making sure your money is working as hard as you are.`;
  }

  const summary = [
    `Take-home: ${fmt(monthly)}/month`,
    fixedTotal > 0 ? `Fixed costs: ${fmt(fixedTotal)}/month` : null,
    debtMinimums > 0 ? `Debt minimums: ${fmt(debtMinimums)}/month` : null,
    `Working with: ${fmt(remaining)}/month after fixed costs`,
  ].filter(Boolean);

  return { summary, keyInsight, name };
}

// ─── Deployment plan ───────────────────────────────────────────────────────────
// Generates the monthly allocation plan from profile data.
export async function generatePlan(profile) {
  await delay(600);

  const {
    netIncome,
    payFrequency,
    fixedCommitments = [],
    regularExpenses = [],
    debts = [],
    savings,
    savingsGoals = [],
    investments = [],
  } = profile;

  const INVESTMENT_TYPE_LABELS = {
    '401k': '401(k)',
    ira_traditional: 'Traditional IRA',
    ira_roth: 'Roth IRA',
    brokerage: 'Brokerage',
    hsa: 'HSA',
  };

  const netInc = toMonthly(netIncome, payFrequency);
  const fixedTotal = fixedCommitments.reduce((s, c) => s + Number(c.monthlyAmount || c.amount), 0);
  const totalRegular = regularExpenses.reduce((s, r) => s + Number(r.monthlyEstimate || 0), 0);
  const debtMinimums = debts.reduce((s, d) => s + Number(d.minimum || 0), 0);
  let remaining = netInc - fixedTotal - debtMinimums;

  const allocations = [];

  // Layer 1 — Fixed commitments
  if (fixedTotal > 0) {
    allocations.push({
      layer: 'fixed',
      name: 'Fixed commitments',
      amount: fixedTotal,
      spent: 0,
      note: 'Auto-committed. Non-negotiable.',
      items: fixedCommitments.map((c) => ({
        name: c.name,
        amount: Number(c.monthlyAmount || c.amount),
        frequency: c.frequency || 'monthly',
        originalAmount: Number(c.amount),
        variable: c.variable || false,
      })),
    });
  }

  // Layer 2 — Debt minimums
  if (debtMinimums > 0) {
    allocations.push({
      layer: 'debt_floor',
      name: 'Debt minimums',
      amount: debtMinimums,
      spent: 0,
      note: 'Floor. Protect at all costs.',
      items: debts.map((d) => ({ name: d.name, amount: Number(d.minimum || 0), balance: Number(d.balance || 0), rate: Number(d.rate || 0) })),
    });
  }

  // Layers 2.x — Investment contributions (auto-committed, one layer per active investment)
  for (const inv of investments) {
    const monthly = Number(inv.monthlyContribution) || 0;
    if (!inv.name || monthly <= 0) continue;
    const typeLabel = INVESTMENT_TYPE_LABELS[inv.type] || inv.type || 'Investment';
    const balance = Number(inv.balance) || 0;
    let note = `${typeLabel} · Balance: ${fmt(balance)}`;
    if (inv.type === '401k' && Number(inv.employerMatch) > 0) {
      note += ` · Employer matches ${inv.employerMatch}%`;
    }
    if (inv.payrollDeducted) {
      note += ' · Pre-tax / payroll deducted';
    }
    allocations.push({
      layer: `investment_${inv.id}`,
      name: inv.name,
      amount: monthly,
      spent: 0,
      note,
      investmentId: inv.id,
      investmentType: inv.type,
    });
    if (!inv.payrollDeducted) {
      remaining -= monthly;
    }
  }

  // Layer 3 — Debt accelerator (if high-rate debt exists and there's room)
  const accelDebt = debts.find((d) => Number(d.rate) > 10 && Number(d.balance) > 500);
  if (accelDebt && remaining > 300) {
    const accel = Math.min(200, Math.round(remaining * 0.15));
    allocations.push({
      layer: 'debt_accelerator',
      name: `${accelDebt.name} payoff`,
      amount: accel,
      spent: 0,
      note: `Extra toward the balance. Gone sooner.`,
    });
    remaining -= accel;
  }

  // Layer 4 — Stability buffer (if savings < 3 months of fixed + regular costs)
  const safetyTarget = (fixedTotal + totalRegular + debtMinimums) * 3;
  if (Number(savings) < safetyTarget && remaining > 150) {
    const buffer = Math.min(250, Math.round(remaining * 0.18));
    const monthsToGoal = Math.ceil((safetyTarget - Number(savings)) / buffer);
    allocations.push({
      layer: 'stability',
      name: 'Stability buffer',
      amount: buffer,
      spent: 0,
      note: `Reach ${fmt(safetyTarget)} in ~${monthsToGoal} months. Protects everything else.`,
    });
    remaining -= buffer;
  }

  // Layers 5+ — Savings goals (one layer per goal, in order defined)
  for (const goal of savingsGoals) {
    if (!goal.name || !goal.monthly || remaining <= 0) continue;
    const monthly = Math.min(Number(goal.monthly) || 0, remaining);
    if (monthly <= 0) continue;
    const saved = Number(goal.saved) || 0;
    const target = Number(goal.target) || 0;
    if (target > 0 && saved >= target) continue; // goal complete
    const monthsLeft = (target > 0 && monthly > 0) ? Math.ceil((target - saved) / monthly) : null;
    allocations.push({
      layer: `goal_${goal.id}`,
      name: goal.name,
      amount: monthly,
      spent: 0,
      note: monthsLeft
        ? `${fmt(saved)} of ${fmt(target)} saved. ~${monthsLeft} month${monthsLeft === 1 ? '' : 's'} to go.`
        : `${fmt(saved)} saved so far.`,
      goalId: goal.id,
      goalTarget: target,
      goalSaved: saved,
    });
    remaining -= monthly;
  }

  // Layer 4.5 — Regular expenses
  if (totalRegular > 0) {
    const regularAlloc = Math.min(totalRegular, Math.max(0, remaining));
    allocations.push({
      layer: 'regular_expenses',
      name: 'Regular expenses',
      amount: regularAlloc,
      spent: 0,
      note: 'Variable by nature. Deploy as you spend.',
      items: regularExpenses.map((r) => ({
        name: r.name,
        amount: Number(r.monthlyEstimate || 0),
        category: r.category,
      })),
    });
    remaining -= regularAlloc;
  }

  // Layer 5 — Life (food + quality of life merged)
  const lifeBase = Math.min(500, Math.max(200, Math.round(remaining * 0.22)));
  const lifeExtra = Math.max(0, Math.round(remaining - lifeBase));
  allocations.push({
    layer: 'life',
    name: 'Life',
    amount: lifeBase + lifeExtra,
    spent: 0,
    note: 'Active bucket. Deploy as you spend.',
  });
  remaining -= (lifeBase + lifeExtra);

  // Layer 7 — Ad hoc (always present, no preset amount)
  allocations.push({
    layer: 'adhoc',
    name: 'Ad hoc',
    amount: 0,
    spent: 0,
    note: 'Catch-all for surprises.',
  });

  // Surface required goal observations on plan layers.
  // Goals already covered by a plan layer (stability, debt_accelerator) are skipped.
  // Healthy goals are not surfaced — only active, degraded, or retriggered.
  const coveredByLayer = new Set();
  if (allocations.some((a) => a.layer === 'stability')) {
    coveredByLayer.add('emergency_buffer');
    coveredByLayer.add('stability_buffer');
  }
  if (allocations.some((a) => a.layer === 'debt_accelerator')) {
    coveredByLayer.add('high_rate_debt');
  }

  const goalObservations = generateRequiredGoals(profile)
    .filter((g) => !coveredByLayer.has(g.id))
    .map((g) => evaluateGoalHealth(g, profile))
    .filter((g) => g.goalState !== 'healthy');

  if (goalObservations.length > 0) {
    const stabilityLayer = allocations.find((a) => a.layer === 'stability');

    for (const goal of goalObservations) {
      const target = (goal.layer === 'stability' && stabilityLayer) ? stabilityLayer : null;
      if (target) {
        target.note = target.note ? `${target.note}\n${goal.note}` : goal.note;
      }
    }
  }

  // Priority signal injected from profile.prioritySignal — set at synthesis by parsePrioritySignal()
  const prioritySignal = profile.prioritySignal;
  if (prioritySignal) {
    allocations.forEach(alloc => {
      const layer = alloc.layer;
      if (prioritySignal === 'debt_priority' && (layer === 'debt_floor' || layer === 'debt_accelerator')) {
        alloc.note = (alloc.note ? alloc.note + ' ' : '') + 'You said getting out of debt matters most. This is where that starts.';
      }
      if (prioritySignal === 'savings_priority' && layer === 'stability') {
        alloc.note = (alloc.note ? alloc.note + ' ' : '') + 'You said building a cushion matters most. This is that cushion.';
      }
      if (prioritySignal === 'retirement_priority' && layer?.startsWith('investment_')) {
        alloc.note = (alloc.note ? alloc.note + ' ' : '') + 'You said retirement matters most. Every dollar here compounds.';
      }
      if (prioritySignal === 'housing_priority' && layer?.startsWith('fixed')) {
        const housingPct = profile.netIncome > 0
          ? Math.round((alloc.amount / toMonthly(profile.netIncome, profile.payFrequency)) * 100)
          : 0;
        if (housingPct > 30) {
          alloc.note = (alloc.note ? alloc.note + ' ' : '') + `Housing is ${housingPct}% of income. Above 30% leaves less room to build.`;
        }
      }
      if (prioritySignal === 'stress_priority' && layer === 'stability') {
        alloc.note = (alloc.note ? alloc.note + ' ' : '') + 'Building this buffer is the single fastest way to reduce financial stress.';
      }
      if (prioritySignal === 'protection_priority' && layer?.startsWith('fixed')) {
        alloc.note = (alloc.note ? alloc.note + ' ' : '') + 'Protecting your household starts here.';
      }
    });
  }

  const structuralShortfall = fixedTotal + debtMinimums + totalRegular - netInc;

  return {
    income: netInc,
    allocations,
    generatedAt: new Date().toISOString(),
    ...(structuralShortfall > 0 && { planState: 'insolvent', shortfall: structuralShortfall }),
  };
}

// ─── Daily observation ─────────────────────────────────────────────────────────
// One-line observation shown on dashboard. Haiku-class in production.
export async function getDailyObservation(profile) {
  await delay(300);
  const name = profile?.name || '';
  const pool = [
    `${name ? name + ', you' : 'You'}'re tracking well this week.`,
    'Still have room this month. No pressure, no panic.',
    'Your fixed costs are covered. What you have left is yours.',
    'Consistent logging this week. That\'s the whole game.',
    'Seven days in. You\'re on track.',
    `${name ? name + ', the' : 'The'} plan is working. Keep going.`,
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}
