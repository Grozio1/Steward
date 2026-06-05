// Dynamic goal system.
// generateRequiredGoals — produces stage-personalized required goals from the current profile.
// evaluateGoalHealth   — updates an existing goal's state against the current profile.
// Both are pure / synchronous. No storage I/O.

function toMonthly(netIncome, payFrequency) {
  const n = Number(netIncome) || 0;
  switch (payFrequency) {
    case 'weekly':       return Math.round(n * 52 / 12);
    case 'biweekly':     return Math.round(n * 26 / 12);
    case 'semi-monthly': return Math.round(n * 2);
    default:             return n;
  }
}

function fmt(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString()}`;
}

// ─── generateRequiredGoals ─────────────────────────────────────────────────────
// Returns an array of required goal objects tailored to the profile's life stage.
// All goals start with goalState: 'active' — callers should run evaluateGoalHealth
// to get the correct state against current balances.
export function generateRequiredGoals(profile) {
  const {
    lifeStage = 'building',
    household,
    fixedCommitments = [],
    regularExpenses = [],
    debts = [],
    investments = [],
    savingsGoals = [],
    netIncome,
    payFrequency,
  } = profile;

  const monthly     = toMonthly(netIncome, payFrequency);
  const fixedTotal  = fixedCommitments.reduce((s, c) => s + Number(c.monthlyAmount || c.amount), 0);
  const totalRegular = regularExpenses.reduce((s, r) => s + Number(r.monthlyEstimate || 0), 0);
  const debtMin     = debts.reduce((s, d) => s + Number(d.minimum || 0), 0);

  const goals = [];

  // ── starting_out ─────────────────────────────────────────────────────────────
  if (lifeStage === 'starting_out') {
    const emergencyTarget = (fixedTotal + totalRegular) * 3;
    goals.push({
      id: 'emergency_buffer',
      name: 'Emergency buffer',
      layer: 'stability',
      targetFormula: '(fixed + regular) × 3',
      targetValue: emergencyTarget,
      goalState: 'active',
      isRequired: true,
      retriggerCount: 0,
      retriggerReason: null,
      note: `Build to ${fmt(emergencyTarget)} — 3 months of core costs before anything else.`,
    });

    // Employer match — only if contribution is zero while a match exists
    const unmatchedInvestment = investments.find(
      (inv) => Number(inv.employerMatch) > 0 && Number(inv.monthlyContribution) === 0
    );
    if (unmatchedInvestment) {
      goals.push({
        id: 'employer_match',
        name: 'Capture employer match',
        layer: 'adhoc',
        targetFormula: 'Contribution ≥ match threshold',
        targetValue: 0,
        goalState: 'active',
        isRequired: true,
        retriggerCount: 0,
        retriggerReason: null,
        note: `${unmatchedInvestment.name} offers a ${unmatchedInvestment.employerMatch}% match. Contributing nothing means leaving that money behind.`,
      });
    }

    // High-interest debt
    const highRateDebt = debts.find((d) => Number(d.rate) > 10 && Number(d.balance) > 500);
    if (highRateDebt) {
      goals.push({
        id: 'high_rate_debt',
        name: 'High-interest debt',
        layer: 'adhoc',
        targetFormula: 'Balance = $0',
        targetValue: 0,
        goalState: 'active',
        isRequired: true,
        retriggerCount: 0,
        retriggerReason: null,
        note: `${highRateDebt.name} at ${highRateDebt.rate}% is expensive. Clear this before building beyond the emergency buffer.`,
      });
    }

    // Stability buffer — broader target including debt minimums
    const stabilityTarget = (fixedTotal + totalRegular + debtMin) * 3;
    if (stabilityTarget > emergencyTarget) {
      goals.push({
        id: 'stability_buffer',
        name: 'Stability buffer',
        layer: 'stability',
        targetFormula: '(fixed + regular + debt minimums) × 3',
        targetValue: stabilityTarget,
        goalState: 'active',
        isRequired: true,
        retriggerCount: 0,
        retriggerReason: null,
        note: `Once the emergency buffer is funded, grow to ${fmt(stabilityTarget)} — covers debt minimums too.`,
      });
    }
  }

  // ── building ─────────────────────────────────────────────────────────────────
  if (lifeStage === 'building') {
    const emergencyTarget = (fixedTotal + totalRegular + debtMin) * 3;
    goals.push({
      id: 'emergency_buffer',
      name: 'Emergency buffer',
      layer: 'stability',
      targetFormula: '(fixed + regular + debt minimums) × 3',
      targetValue: emergencyTarget,
      goalState: 'active',
      isRequired: true,
      retriggerCount: 0,
      retriggerReason: null,
      note: `Keep ${fmt(emergencyTarget)} accessible. Don't let it erode as income grows.`,
    });

    // Savings rate — flag if no goals are defined
    if (savingsGoals.length === 0) {
      goals.push({
        id: 'savings_rate_growth',
        name: 'Savings direction',
        layer: 'adhoc',
        targetFormula: 'At least one savings goal defined',
        targetValue: 0,
        goalState: 'active',
        isRequired: true,
        retriggerCount: 0,
        retriggerReason: null,
        note: `No savings goals set. Without a target, extra income disappears. Define what you're building toward.`,
      });
    }

    // Housing cost — flag if rent/mortgage > 30% of income
    const housingCommitment = fixedCommitments.find((c) => /rent|mortgage/i.test(c.name || ''));
    if (housingCommitment && monthly > 0) {
      const housingAmt = Number(housingCommitment.monthlyAmount || housingCommitment.amount);
      if (housingAmt / monthly > 0.3) {
        goals.push({
          id: 'housing_cost',
          name: 'Housing cost',
          layer: 'adhoc',
          targetFormula: 'Housing ≤ 30% of income',
          targetValue: Math.round(monthly * 0.3),
          goalState: 'active',
          isRequired: true,
          retriggerCount: 0,
          retriggerReason: null,
          note: `Housing is ${Math.round((housingAmt / monthly) * 100)}% of your income. Above 30%, it crowds out everything else.`,
        });
      }
    }
  }

  // ── family_years ─────────────────────────────────────────────────────────────
  if (lifeStage === 'family_years') {
    // Life insurance — only if managing a family and no policy found in commitments
    if (household === 'family') {
      const hasInsurance = fixedCommitments.some((c) => /life ins/i.test(c.name || ''));
      if (!hasInsurance) {
        goals.push({
          id: 'life_insurance',
          name: 'Life insurance',
          layer: 'adhoc',
          targetFormula: 'Coverage in place',
          targetValue: 0,
          goalState: 'active',
          isRequired: true,
          retriggerCount: 0,
          retriggerReason: null,
          note: `No life insurance on record. With a family depending on your income, this is a gap worth closing.`,
        });
      }
    }

    // Emergency buffer — higher multiplier with dependents
    const emergencyTarget = (fixedTotal + totalRegular + debtMin) * 4;
    goals.push({
      id: 'emergency_buffer',
      name: 'Family emergency buffer',
      layer: 'stability',
      targetFormula: '(fixed + regular + debt minimums) × 4',
      targetValue: emergencyTarget,
      goalState: 'active',
      isRequired: true,
      retriggerCount: 0,
      retriggerReason: null,
      note: `With dependents, aim for ${fmt(emergencyTarget)} — 4 months of core costs.`,
    });

    // 529 education savings
    goals.push({
      id: 'education_529',
      name: '529 education account',
      layer: 'adhoc',
      targetFormula: 'Account open',
      targetValue: 0,
      goalState: 'active',
      isRequired: true,
      retriggerCount: 0,
      retriggerReason: null,
      note: `A 529 account lets education savings grow tax-free. Time in the market matters more than amount here.`,
    });
  }

  // ── peak_earning ─────────────────────────────────────────────────────────────
  if (lifeStage === 'peak_earning') {
    const totalInvested = investments.reduce((s, inv) => s + Number(inv.balance || 0), 0);
    const annualIncome = monthly * 12;
    const retirementTarget = annualIncome * 3;

    if (annualIncome > 0 && totalInvested < retirementTarget) {
      goals.push({
        id: 'retirement_trajectory',
        name: 'Retirement trajectory',
        layer: 'adhoc',
        targetFormula: '≥ 3× annual income invested',
        targetValue: retirementTarget,
        goalState: 'active',
        isRequired: true,
        retriggerCount: 0,
        retriggerReason: null,
        note: `${fmt(totalInvested)} invested against ${fmt(annualIncome)} annual income. At peak earning years, the gap to close is now.`,
      });
    }

    // Consumer debt elimination
    const consumerDebts = debts.filter((d) => !/mortgage|home loan/i.test(d.name || ''));
    const consumerTotal = consumerDebts.reduce((s, d) => s + Number(d.balance || 0), 0);
    if (consumerTotal > 0) {
      goals.push({
        id: 'debt_elimination',
        name: 'Consumer debt elimination',
        layer: 'adhoc',
        targetFormula: 'Consumer debt = $0',
        targetValue: 0,
        goalState: 'active',
        isRequired: true,
        retriggerCount: 0,
        retriggerReason: null,
        note: `${fmt(consumerTotal)} in consumer debt at peak earning years. Clear this to redirect cash flow into wealth.`,
      });
    }
  }

  // ── transition ───────────────────────────────────────────────────────────────
  if (lifeStage === 'transition') {
    const totalDebt = debts.reduce((s, d) => s + Number(d.balance || 0), 0);
    if (totalDebt > 0) {
      goals.push({
        id: 'pre_retirement_debt',
        name: 'Debt-free before retirement',
        layer: 'adhoc',
        targetFormula: 'All debt = $0 at retirement',
        targetValue: 0,
        goalState: 'active',
        isRequired: true,
        retriggerCount: 0,
        retriggerReason: null,
        note: `${fmt(totalDebt)} remaining. Carrying debt into retirement compresses your options. Eliminate with urgency.`,
      });
    }

    goals.push({
      id: 'social_security_timing',
      name: 'Social Security timing',
      layer: 'adhoc',
      targetFormula: 'Claiming strategy decided',
      targetValue: 0,
      goalState: 'active',
      isRequired: true,
      retriggerCount: 0,
      retriggerReason: null,
      note: `Claiming at 62 vs 67 vs 70 can mean a 76% difference in monthly benefit. This decision is worth planning now.`,
    });
  }

  // ── retirement ───────────────────────────────────────────────────────────────
  if (lifeStage === 'retirement') {
    goals.push({
      id: 'withdrawal_sequence',
      name: 'Withdrawal sequence',
      layer: 'adhoc',
      targetFormula: 'Sequence planned',
      targetValue: 0,
      goalState: 'active',
      isRequired: true,
      retriggerCount: 0,
      retriggerReason: null,
      note: `Taxable accounts first, then tax-deferred, then Roth — sequence minimizes lifetime tax.`,
    });

    goals.push({
      id: 'rmd_tracking',
      name: 'Required minimum distributions',
      layer: 'adhoc',
      targetFormula: 'RMDs on schedule',
      targetValue: 0,
      goalState: 'active',
      isRequired: true,
      retriggerCount: 0,
      retriggerReason: null,
      note: `RMDs begin at 73. Missing them triggers a 25% penalty on the amount not taken.`,
    });

    // Under-living: substantial assets but very low income signal
    const totalInvested = investments.reduce((s, inv) => s + Number(inv.balance || 0), 0);
    if (totalInvested > 500000 && monthly < 3000) {
      goals.push({
        id: 'under_living',
        name: 'Under-living flag',
        layer: 'adhoc',
        targetFormula: 'Withdrawals reflect means',
        targetValue: 0,
        goalState: 'active',
        isRequired: true,
        retriggerCount: 0,
        retriggerReason: null,
        note: `${fmt(totalInvested)} accumulated but income is modest. Make sure withdrawals reflect what you've built.`,
      });
    }
  }

  return goals;
}

// ─── evaluateGoalHealth ────────────────────────────────────────────────────────
// Takes an existing goal (possibly with lastHealthyTarget / lastHealthyValue from
// a prior evaluation) and the current profile. Returns the goal with an updated
// goalState and, on transition to healthy, records the snapshot for future retrigger detection.
export function evaluateGoalHealth(goal, profile) {
  const {
    savings,
    debts = [],
    investments = [],
    fixedCommitments = [],
    savingsGoals = [],
    netIncome,
    payFrequency,
  } = profile;

  const currentSavings = Number(savings) || 0;
  const targetValue = Number(goal.targetValue) || 0;

  // ── Binary / prompt goals resolved without a numeric balance ────────────────
  switch (goal.id) {
    case 'high_rate_debt': {
      const gone = !debts.find((d) => Number(d.rate) > 10 && Number(d.balance) > 500);
      return { ...goal, goalState: gone ? 'healthy' : 'active' };
    }
    case 'debt_elimination':
    case 'pre_retirement_debt': {
      const consumer = debts.filter((d) => !/mortgage|home loan/i.test(d.name || ''));
      const total = consumer.reduce((s, d) => s + Number(d.balance || 0), 0);
      return { ...goal, goalState: total === 0 ? 'healthy' : 'active' };
    }
    case 'employer_match': {
      const stillUnmatched = investments.some(
        (inv) => Number(inv.employerMatch) > 0 && Number(inv.monthlyContribution) === 0
      );
      return { ...goal, goalState: stillUnmatched ? 'active' : 'healthy' };
    }
    case 'life_insurance': {
      const covered = fixedCommitments.some((c) => /life ins/i.test(c.name || ''));
      return { ...goal, goalState: covered ? 'healthy' : 'active' };
    }
    case 'housing_cost': {
      const monthly = toMonthly(netIncome, payFrequency);
      const housing = fixedCommitments.find((c) => /rent|mortgage/i.test(c.name || ''));
      if (!housing || monthly === 0) return { ...goal, goalState: 'healthy' };
      const pct = Number(housing.monthlyAmount || housing.amount) / monthly;
      return { ...goal, goalState: pct <= 0.3 ? 'healthy' : 'active' };
    }
    case 'savings_rate_growth': {
      return { ...goal, goalState: savingsGoals.length > 0 ? 'healthy' : 'active' };
    }
    // Prompt-only goals — no resolvable balance; stay active until profile changes
    case 'education_529':
    case 'social_security_timing':
    case 'withdrawal_sequence':
    case 'rmd_tracking':
    case 'under_living':
      return { ...goal, goalState: 'active' };
    default:
      break;
  }

  // ── Numeric goals: compare currentValue against targetValue ─────────────────
  let currentValue;

  switch (goal.id) {
    case 'emergency_buffer':
    case 'stability_buffer':
      currentValue = currentSavings;
      break;
    case 'retirement_trajectory': {
      currentValue = investments.reduce((s, inv) => s + Number(inv.balance || 0), 0);
      break;
    }
    default:
      // Unknown goal type — leave state unchanged
      return goal;
  }

  if (targetValue <= 0) return { ...goal, goalState: 'active' };

  const ratio = currentValue / targetValue;

  if (ratio >= 1) {
    return {
      ...goal,
      goalState: 'healthy',
      lastHealthyTarget: targetValue,
      lastHealthyValue: currentValue,
    };
  }

  if (ratio < 0.7) {
    const { lastHealthyTarget, lastHealthyValue } = goal;
    let retriggerReason = null;

    if (lastHealthyValue !== undefined && currentValue < lastHealthyValue * 0.7) {
      retriggerReason = 'Balance dropped significantly since this goal was last on track.';
    } else if (lastHealthyTarget !== undefined && targetValue > lastHealthyTarget * 1.15) {
      retriggerReason = 'Target increased by more than 15% since this goal was last on track.';
    }

    if (retriggerReason) {
      return {
        ...goal,
        goalState: 'retriggered',
        retriggerCount: (goal.retriggerCount || 0) + 1,
        retriggerReason,
      };
    }

    return { ...goal, goalState: 'degraded' };
  }

  // 0.7 ≤ ratio < 1.0 — progressing, not yet healthy
  return { ...goal, goalState: 'active' };
}
