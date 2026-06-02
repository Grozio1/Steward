// AI stub layer
// All functions return Promises to match the real API interface.
// Replace with actual Anthropic API calls when ready.
// Voice throughout: parent/grandparent — warm, direct, plain.

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function fmt(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString()}`;
}

// ─── Synthesis ─────────────────────────────────────────────────────────────────
// Called on SynthesisScreen. Returns what Steward "heard" + one key insight.
export async function generateSynthesis(profile) {
  await delay(1400);

  const {
    name,
    netIncome,
    fixedCommitments = [],
    debts = [],
    savings,
  } = profile;

  const fixedTotal = fixedCommitments.reduce((s, c) => s + Number(c.monthlyAmount || c.amount), 0);
  const debtMinimums = debts.reduce((s, d) => s + Number(d.minimum || 0), 0);
  const debtTotal = debts.reduce((s, d) => s + Number(d.balance || 0), 0);
  const monthlyFixed = fixedTotal + debtMinimums;
  const remaining = Number(netIncome) - monthlyFixed;

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
    `Take-home: ${fmt(netIncome)}/month`,
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
    fixedCommitments = [],
    debts = [],
    savings,
  } = profile;

  const netInc = Number(netIncome) || 0;
  const fixedTotal = fixedCommitments.reduce((s, c) => s + Number(c.monthlyAmount || c.amount), 0);
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

  // Layer 4 — Stability buffer (if savings < 3 months of fixed costs)
  const safetyTarget = (fixedTotal + debtMinimums) * 3;
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

  // Layer 5 — Food
  const food = Math.min(500, Math.max(200, Math.round(remaining * 0.22)));
  allocations.push({
    layer: 'food',
    name: 'Food',
    amount: food,
    spent: 0,
    note: 'Active bucket. Deploy as you spend.',
  });
  remaining -= food;

  // Layer 6 — Quality of life (remainder)
  if (remaining > 0) {
    allocations.push({
      layer: 'qol',
      name: 'Quality of life',
      amount: Math.round(remaining),
      spent: 0,
      note: 'Yours to deploy. No questions asked.',
    });
  }

  // Layer 7 — Ad hoc (always present, no preset amount)
  allocations.push({
    layer: 'adhoc',
    name: 'Ad hoc',
    amount: 0,
    spent: 0,
    note: 'Some months have surprises. This is where they go.',
  });

  return {
    income: netInc,
    allocations,
    generatedAt: new Date().toISOString(),
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
