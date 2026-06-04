// src/ai/annualReview.js
//
// Annual review analysis module.
// Reads 12 months of AsyncStorage data, runs deterministic pattern detectors,
// ranks findings by significance, voices them via a single Sonnet call,
// and returns structured findings + recommendations for the re-profile flow.
//
// Entry point:  generateAnnualReview(profile) → { findings, recommendations, yearData }
// Trigger:      RootNavigator.js — on app open, check steward_last_reprofile vs createdAt

import AsyncStorage from '@react-native-async-storage/async-storage';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET = 'claude-sonnet-4-20250514';
const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;

// ─── Public entry point ───────────────────────────────────────────────────────

export async function generateAnnualReview(profile) {
  try {
    const yearData = await loadYearData(profile);

    const allFindings = [
      ...detectLayerAdherence(yearData),
      ...detectAdHocPattern(yearData),
      ...detectSeasonalSpikes(yearData),
      ...detectDebtProgress(yearData),
      ...detectStabilityProgress(yearData),
      ...detectEngagement(yearData),
    ];

    const ranked = rankFindings(allFindings);
    const voiced = await voiceFindings(ranked, profile, yearData.anomalies);
    const recommendations = deriveRecommendations(ranked);

    await saveAnnualSnapshot({ profile, findings: voiced, recommendations });

    return { findings: voiced, recommendations, yearData };
  } catch (err) {
    console.error('[annualReview] generateAnnualReview failed:', err);
    return { findings: [], recommendations: [], yearData: null };
  }
}

// ─── Trigger check (call from RootNavigator) ──────────────────────────────────

// Returns true if 365+ days have passed since createdAt or last re-profile.
export async function isAnnualReviewDue(profile) {
  try {
    const raw = await AsyncStorage.getItem('steward_last_reprofile');
    const anchor = raw ? new Date(raw) : new Date(profile.createdAt);
    const daysSince = (Date.now() - anchor.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= 365;
  } catch {
    return false;
  }
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadYearData(profile) {
  const months = trailingMonthKeys(12);

  const [plans, spends, transfers, fixedOverrides, debtActuals, anomaliesRaw] = await Promise.all([
    loadMonthly('steward_plan', months),
    loadMonthly('steward_spends', months),
    loadMonthly('steward_transfers', months),
    loadMonthly('steward_fixed_overrides', months),
    loadMonthly('steward_debt_actuals', months),
    AsyncStorage.getItem('steward_anomalies'),
  ]);

  const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const anomalies = (anomaliesRaw ? JSON.parse(anomaliesRaw) : [])
    .filter(a => a.detectedAt >= twelveMonthsAgo);

  return { months, plans, spends, transfers, fixedOverrides, debtActuals, profile, anomalies };
}

async function loadMonthly(prefix, months) {
  const results = {};
  await Promise.all(
    months.map(async (m) => {
      try {
        const raw = await AsyncStorage.getItem(`${prefix}_${m}`);
        results[m] = raw ? JSON.parse(raw) : null;
      } catch {
        results[m] = null;
      }
    })
  );
  return results;
}

// ─── Detectors ────────────────────────────────────────────────────────────────
//
// Each detector returns an array of finding objects.
// Every finding has: { id, type, significance, ...type-specific fields }
// significance is a unitless score used for ranking — higher = surface first.

// Layer adherence: finds layers that are persistently over- or under-budget.
function detectLayerAdherence(data) {
  const { months, plans, spends } = data;
  const findings = [];
  const layerStats = {};

  months.forEach((m) => {
    const plan = plans[m];
    const monthSpends = spends[m] || [];
    if (!plan || !plan.allocations) return;

    plan.allocations.forEach((alloc) => {
      if (!layerStats[alloc.layer]) {
        layerStats[alloc.layer] = {
          name: alloc.name,
          layer: alloc.layer,
          planned: [],
          actual: [],
          overMonths: 0,
          underMonths: 0,
        };
      }
      const s = layerStats[alloc.layer];
      const actualSpent = monthSpends
        .filter((sp) => sp.layer === alloc.layer)
        .reduce((sum, sp) => sum + sp.amount, 0);

      s.planned.push(alloc.amount);
      s.actual.push(actualSpent);
      if (actualSpent > alloc.amount * 1.05) s.overMonths++;
      // Under: spent < 70% of allocation (and allocation is meaningful)
      if (actualSpent < alloc.amount * 0.7 && alloc.amount > 100) s.underMonths++;
    });
  });

  Object.values(layerStats).forEach((s) => {
    if (s.planned.length < 3) return;

    const avgPlanned = mathAvg(s.planned);
    const avgActual = mathAvg(s.actual);
    const avgDelta = avgActual - avgPlanned;

    // Persistently over: 6+ months, average overage > $20
    if (s.overMonths >= 6 && avgDelta > 20) {
      findings.push({
        id: `over_budget_${s.layer}`,
        type: 'over_budget',
        layer: s.layer,
        name: s.name,
        overMonths: s.overMonths,
        totalMonths: s.planned.length,
        avgPlanned: Math.round(avgPlanned),
        avgActual: Math.round(avgActual),
        avgDelta: Math.round(avgDelta),
        // Suggested budget: average actual + 5% buffer, rounded to nearest $5
        suggestedBudget: Math.round((avgActual * 1.05) / 5) * 5,
        significance: s.overMonths * Math.abs(avgDelta),
      });
    }

    // Persistently under: 8+ months under 70% of budget, average unused > $50/mo
    if (s.underMonths >= 8 && Math.abs(avgDelta) > 50) {
      findings.push({
        id: `under_utilized_${s.layer}`,
        type: 'under_utilized',
        layer: s.layer,
        name: s.name,
        underMonths: s.underMonths,
        totalMonths: s.planned.length,
        avgPlanned: Math.round(avgPlanned),
        avgActual: Math.round(avgActual),
        avgMonthlyUnused: Math.round(Math.abs(avgDelta)),
        annualUnused: Math.round(Math.abs(avgDelta) * 12),
        // Suggest redirecting 70% of unused, keep 30% as breathing room
        redirectable: Math.round(Math.abs(avgDelta) * 0.7 / 5) * 5,
        significance: s.underMonths * Math.abs(avgDelta),
      });
    }
  });

  return findings;
}

// Ad hoc pattern: recurring surprise spending → should be a category.
function detectAdHocPattern(data) {
  const { months, spends } = data;

  const adHocAmounts = months
    .map((m) =>
      (spends[m] || [])
        .filter((sp) => sp.layer === 'adhoc')
        .reduce((sum, sp) => sum + sp.amount, 0)
    )
    .filter((amt) => amt > 0);

  if (adHocAmounts.length < 6) return [];

  const avgMonthly = mathAvg(adHocAmounts);

  // Threshold: averaging $150+/month in ad hoc for 8+ months is a pattern
  if (avgMonthly > 150 && adHocAmounts.length >= 8) {
    return [
      {
        id: 'adhoc_as_category',
        type: 'adhoc_as_category',
        avgMonthly: Math.round(avgMonthly),
        activeMonths: adHocAmounts.length,
        totalMonths: months.length,
        // Suggest budget slightly above average to absorb real surprises
        suggestedBudget: Math.round((avgMonthly * 1.1) / 10) * 10,
        significance: avgMonthly * adHocAmounts.length,
      },
    ];
  }
  return [];
}

// Seasonal spikes: months that consistently land > 1.3 SD above mean total spend.
function detectSeasonalSpikes(data) {
  const { months, spends } = data;

  const monthlyTotals = months
    .map((m) => ({
      month: m,
      label: toMonthLabel(m),
      total: (spends[m] || []).reduce((s, sp) => s + sp.amount, 0),
    }))
    .filter((x) => x.total > 0);

  if (monthlyTotals.length < 6) return [];

  const mean = mathAvg(monthlyTotals.map((x) => x.total));
  const sd = mathStdDev(monthlyTotals.map((x) => x.total));
  const threshold = mean + 1.3 * sd;

  const spikes = monthlyTotals
    .filter((x) => x.total > threshold)
    .map((x) => ({
      month: x.label,
      total: Math.round(x.total),
      overage: Math.round(x.total - mean),
    }));

  if (spikes.length === 0) return [];

  const totalOverage = spikes.reduce((s, x) => s + x.overage, 0);

  return [
    {
      id: 'seasonal_spikes',
      type: 'seasonal_spikes',
      spikes,
      spikeMonths: spikes.map((s) => s.month),
      avgMonthlySpend: Math.round(mean),
      // Monthly set-aside spreads the overage across all 12 months
      suggestedMonthlySetAside: Math.round(totalOverage / 12 / 5) * 5,
      annualOverage: Math.round(totalOverage),
      significance: totalOverage,
    },
  ];
}

// Debt progress: how much was paid down, velocity, projected payoff.
function detectDebtProgress(data) {
  const { months, debtActuals, profile } = data;
  if (!profile.debts || profile.debts.length === 0) return [];

  return profile.debts.map((debt) => {
    // Sum extra payments above minimum across all months
    let extraPaid = 0;
    months.forEach((m) => {
      const actuals = debtActuals[m];
      if (actuals && actuals[debt.name]) {
        const paid = actuals[debt.name].amount || debt.minimum;
        extraPaid += Math.max(0, paid - debt.minimum);
      }
    });

    const estimatedCurrentBalance = Math.max(
      0,
      debt.balance - debt.minimum * months.length - extraPaid
    );
    const avgMonthlyPayment =
      debt.minimum + extraPaid / months.length;
    const monthsToPayoff =
      estimatedCurrentBalance > 0
        ? Math.ceil(estimatedCurrentBalance / avgMonthlyPayment)
        : 0;
    const annualInterestCost = Math.round(
      (estimatedCurrentBalance * debt.rate) / 100
    );

    return {
      id: `debt_progress_${debt.name.replace(/\s+/g, '_').toLowerCase()}`,
      type: 'debt_progress',
      debtName: debt.name,
      startBalance: debt.balance,
      estimatedCurrentBalance: Math.round(estimatedCurrentBalance),
      totalPaid: Math.round(debt.balance - estimatedCurrentBalance),
      avgMonthlyPayment: Math.round(avgMonthlyPayment),
      monthsToPayoff,
      rate: debt.rate,
      annualInterestCost,
      // Higher APR + higher remaining balance = more significant
      significance: (debt.rate / 100) * estimatedCurrentBalance,
    };
  });
}

// Stability buffer: how much was built, how far from goal.
function detectStabilityProgress(data) {
  const { months, transfers, profile } = data;

  let deposited = 0;
  let withdrawn = 0;

  months.forEach((m) => {
    (transfers[m] || [])
      .filter((t) => t.layer === 'stability')
      .forEach((t) => {
        if (t.type === 'deposit') deposited += t.amount;
        else withdrawn += t.amount;
      });
  });

  const netBuilt = deposited - withdrawn;
  const fixedCosts = (profile.fixedCommitments || []).reduce(
    (s, c) => s + (c.monthlyAmount || c.amount),
    0
  );
  const target = fixedCosts * 3; // 3-month fixed cost target
  const pctOfGoal = target > 0 ? Math.round((netBuilt / target) * 100) : 100;
  const monthlyDepositRate =
    months.length > 0 ? deposited / months.length : 0;
  const monthsToGoal =
    netBuilt < target && monthlyDepositRate > 0
      ? Math.ceil((target - netBuilt) / monthlyDepositRate)
      : 0;

  return [
    {
      id: 'stability_progress',
      type: 'stability_progress',
      netBuilt: Math.round(netBuilt),
      target: Math.round(target),
      pctOfGoal,
      monthsToGoal,
      hitGoal: netBuilt >= target,
      significance: Math.min(netBuilt, 500), // cap so it doesn't dominate
    },
  ];
}

// Engagement: how consistently the user logged spend data.
function detectEngagement(data) {
  const { months, spends } = data;

  const monthsWithData = months.filter(
    (m) => spends[m] && spends[m].length > 0
  );
  const gaps = months.filter(
    (m) => !spends[m] || spends[m].length === 0
  );

  return [
    {
      id: 'engagement',
      type: 'engagement',
      monthsTracked: monthsWithData.length,
      totalMonths: months.length,
      gaps: gaps.map(toMonthLabel),
      trackingRate: Math.round((monthsWithData.length / months.length) * 100),
      // Low significance — informational, not actionable
      significance: monthsWithData.length * 5,
    },
  ];
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

function rankFindings(findings) {
  return [...findings]
    .sort((a, b) => b.significance - a.significance)
    .slice(0, 6); // surface at most 6 findings — enough to be substantive, not overwhelming
}

// ─── Voicing (single Sonnet call) ─────────────────────────────────────────────
//
// One call produces observation + implication text for every finding.
// Fallbacks ensure the flow never breaks on API failure.

async function voiceFindings(findings, profile, anomalies = []) {
  if (findings.length === 0) return [];

  const systemPrompt = `You are Steward — a financial life companion with the voice of a wise, warm grandparent or parent. Direct. Plain-spoken. Never clinical. Never jargon. Always on their side.

You have spent twelve months watching this person's finances. You are now presenting what you observed — not judging, not lecturing. Just naming what happened and what it means.

Rules:
- One observation per finding: what actually happened, in plain English, ≤18 words
- One implication per finding: what it means for them, ≤18 words
- Use "you" and "your" — speak directly to the person
- Numbers are context, not conclusion — name the number, then say what it means
- No shame, no alarm, no hedging
- Sound like someone who noticed this themselves, not like a dashboard printing a report`;

  const userPrompt = `Person's name: ${profile.name}

Findings from the past 12 months:
${JSON.stringify(findings, null, 2)}

Mid-year pattern flags (from anomaly detection):
${JSON.stringify(anomalies.map(a => ({ type: a.type, message: a.message, date: a.detectedAt })))}

Return ONLY a JSON array. No markdown, no preamble. Each element:
{ "id": "<finding id>", "observation": "<sentence>", "implication": "<sentence>" }`;

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SONNET,
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);

    const data = await res.json();
    const text = (data.content || []).map((b) => b.text || '').join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    // Merge voice text into findings — safe: missing IDs fall back gracefully
    return findings.map((f) => {
      const voiced = parsed.find((p) => p.id === f.id);
      return voiced ? { ...f, ...voiced } : { ...f, ...fallbackVoice(f) };
    });
  } catch (err) {
    console.error('[annualReview] voiceFindings API call failed:', err);
    return findings.map((f) => ({ ...f, ...fallbackVoice(f) }));
  }
}

function fallbackVoice(f) {
  const fallbacks = {
    over_budget: {
      observation: `Your ${f.name} budget was over ${f.overMonths} of ${f.totalMonths} months.`,
      implication: `The budget is wrong, not you. It needs to go up.`,
    },
    under_utilized: {
      observation: `$${f.annualUnused} in ${f.name} went unspent across the year.`,
      implication: `That money wasn't doing anything where it was.`,
    },
    adhoc_as_category: {
      observation: `Ad hoc spending averaged $${f.avgMonthly}/month for ${f.activeMonths} months.`,
      implication: `That's not surprise spending anymore — it's a pattern.`,
    },
    seasonal_spikes: {
      observation: `${f.spikeMonths.join(' and ')} spending ran $${f.annualOverage > 0 ? Math.round(f.annualOverage / f.spikes.length) : '—'} above your average.`,
      implication: `A plan that can't see the holidays coming isn't looking far enough ahead.`,
    },
    debt_progress: {
      observation: `You paid $${f.totalPaid} toward ${f.debtName} this year.`,
      implication: `At this pace, ${f.monthsToPayoff > 0 ? `${f.monthsToPayoff} months left` : `it's gone`}.`,
    },
    stability_progress: {
      observation: f.hitGoal
        ? `You hit your stability buffer target this year.`
        : `Your stability buffer grew to $${f.netBuilt} — ${f.pctOfGoal}% of your goal.`,
      implication: f.hitGoal
        ? `That's real security. We can redirect that monthly deposit now.`
        : `${f.monthsToGoal > 0 ? `${f.monthsToGoal} months to your target at this pace.` : `Keep going.`}`,
    },
    engagement: {
      observation: `You logged ${f.monthsTracked} of ${f.totalMonths} months this year.`,
      implication: `The months you skipped tend to be the months surprises show up.`,
    },
  };
  return fallbacks[f.type] || { observation: '', implication: '' };
}

// ─── Recommendations ──────────────────────────────────────────────────────────
//
// Deterministic rules — findings in, recommendation objects out.
// Each recommendation includes the proposed plan change and its downstream impact.
// accept: true means pre-selected; user can toggle in the UI.

function deriveRecommendations(findings) {
  const recs = [];

  findings.forEach((f) => {
    switch (f.type) {
      case 'over_budget': {
        recs.push({
          id: `rec_${f.id}`,
          findingId: f.id,
          type: 'adjust_budget',
          label: `Raise your ${f.name} budget`,
          detail: `You went over ${f.overMonths} of ${f.totalMonths} months by an average of $${f.avgDelta}. The number needs to match how you actually live.`,
          layer: f.layer,
          currentAmount: f.avgPlanned,
          proposedAmount: f.suggestedBudget,
          change: `$${f.avgPlanned} → $${f.suggestedBudget}/mo`,
          monthlyDelta: f.suggestedBudget - f.avgPlanned,
          impact: `Plan stops fighting reality every month.`,
          accept: true,
        });
        break;
      }

      case 'under_utilized': {
        // Only recommend redirecting QoL — other layers have structural reasons to be low
        if (f.layer === 'qol') {
          recs.push({
            id: `rec_${f.id}`,
            findingId: f.id,
            type: 'redirect',
            label: `Redirect $${f.redirectable} from ${f.name}`,
            detail: `You left $${f.annualUnused} unspent this year. That's not a reserve — it's money the plan forgot about.`,
            layer: f.layer,
            redirectTo: 'debt_accelerator',
            currentAmount: f.avgPlanned,
            proposedAmount: f.avgPlanned - f.redirectable,
            change: `$${f.avgPlanned} → $${f.avgPlanned - f.redirectable}/mo ${f.name} · $${f.redirectable} to debt accelerator`,
            monthlyDelta: -f.redirectable,
            impact: `Faster debt payoff at no real cost to your quality of life.`,
            accept: true,
          });
        }
        break;
      }

      case 'adhoc_as_category': {
        recs.push({
          id: `rec_${f.id}`,
          findingId: f.id,
          type: 'new_category',
          label: 'Make Ad Hoc a real budget line',
          detail: `$${f.avgMonthly}/month for ${f.activeMonths} months in a row isn't ad hoc — it's just a category without a name.`,
          layer: 'adhoc',
          proposedAmount: f.suggestedBudget,
          change: `Add $${f.suggestedBudget}/mo planned Ad Hoc`,
          monthlyDelta: f.suggestedBudget,
          impact: `Stops the plan from breaking every month on contact with real life.`,
          accept: true,
        });
        break;
      }

      case 'seasonal_spikes': {
        recs.push({
          id: `rec_${f.id}`,
          findingId: f.id,
          type: 'new_category',
          label: `Set aside $${f.suggestedMonthlySetAside}/mo for ${f.spikeMonths.join('/')}`,
          detail: `${f.spikeMonths.join(' and ')} ran $${f.annualOverage} over your normal pace. You can fund that now, a little at a time.`,
          layer: 'seasonal',
          spikeMonths: f.spikeMonths,
          proposedAmount: f.suggestedMonthlySetAside,
          change: `+$${f.suggestedMonthlySetAside}/mo → $${f.suggestedMonthlySetAside * 12} saved by December`,
          monthlyDelta: f.suggestedMonthlySetAside,
          impact: `No scramble when the holidays arrive.`,
          accept: false, // opt-in — this adds to the plan total
        });
        break;
      }

      case 'stability_progress': {
        // If buffer is fully funded, recommend redirecting that monthly deposit
        if (f.hitGoal) {
          recs.push({
            id: `rec_${f.id}`,
            findingId: f.id,
            type: 'redirect',
            label: 'Redirect your stability deposit',
            detail: `You hit your buffer target. That monthly deposit doesn't need to go there anymore.`,
            layer: 'stability',
            redirectTo: 'debt_accelerator',
            change: `Buffer deposit → debt accelerator`,
            monthlyDelta: 0, // neutral — redirecting, not adding
            impact: `Your security is locked in. Put that money to work.`,
            accept: true,
          });
        }
        break;
      }

      default:
        break;
    }
  });

  return recs;
}

// ─── Snapshot persistence ─────────────────────────────────────────────────────

async function saveAnnualSnapshot({ profile, findings, recommendations }) {
  try {
    const snapshot = {
      date: new Date().toISOString(),
      year: new Date().getFullYear(),
      profileSnapshot: { ...profile },
      findings: findings.map(({ id, type, observation, implication }) => ({
        id, type, observation, implication,
      })),
      recommendations: recommendations.map(({ id, type, label, change, accept }) => ({
        id, type, label, change, accept,
      })),
    };

    const raw = await AsyncStorage.getItem('steward_reprofile_snapshots');
    const snapshots = raw ? JSON.parse(raw) : [];
    snapshots.push(snapshot);

    await Promise.all([
      AsyncStorage.setItem(
        'steward_reprofile_snapshots',
        JSON.stringify(snapshots)
      ),
      AsyncStorage.setItem('steward_last_reprofile', new Date().toISOString()),
    ]);
  } catch (err) {
    console.error('[annualReview] saveAnnualSnapshot failed:', err);
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function trailingMonthKeys(n) {
  const now = new Date();
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    );
  }
  return keys;
}

function toMonthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long' });
}

function mathAvg(arr) {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function mathStdDev(arr) {
  const m = mathAvg(arr);
  return Math.sqrt(mathAvg(arr.map((v) => Math.pow(v - m, 2))));
}
