// src/ai/biography.js
//
// Financial biography data module.
// Assembles a complete longitudinal record from AsyncStorage:
// annual snapshots, current-year activity, milestones, and net worth arc.
//
// Entry point:  loadBiography(profile) → BiographyData
// Used by:      src/screens/biography/BiographyScreen.js (Pro tier)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLifeEvents } from '../data/store';
import { toMonthly } from './stub';

// ─── Public entry point ───────────────────────────────────────────────────────

export async function loadBiography(profile) {
  try {
    const [snapshots, currentYearData, navigateEvents] = await Promise.all([
      loadSnapshots(),
      loadCurrentYear(profile),
      getLifeEvents(),
    ]);

    const chapters = buildChapters(profile, snapshots, currentYearData, navigateEvents);
    const milestones = extractMilestones(snapshots, currentYearData, navigateEvents);
    const totals = computeTotals(chapters);
    const netWorthArc = buildNetWorthArc(profile, snapshots, currentYearData);

    return {
      name: profile.name,
      startDate: formatMonthYear(profile.createdAt),
      yearsActive: computeYearsActive(profile.createdAt),
      chapters,
      milestones,
      totals,
      netWorthArc,
    };
  } catch (err) {
    console.error('[biography] loadBiography failed:', err);
    return null;
  }
}

// ─── Snapshot loading ─────────────────────────────────────────────────────────

async function loadSnapshots() {
  try {
    const raw = await AsyncStorage.getItem('steward_reprofile_snapshots');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Current year loading ─────────────────────────────────────────────────────
// Reads the current calendar year's plan and spend data.
// This populates the "in progress" chapter at the top of the biography.

async function loadCurrentYear(profile) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const monthsThisYear = [];

  for (let m = 0; m < now.getMonth() + 1; m++) {
    const key = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
    monthsThisYear.push(key);
  }

  const [plans, spends, transfers] = await Promise.all([
    loadMonthly('steward_plan', monthsThisYear),
    loadMonthly('steward_spends', monthsThisYear),
    loadMonthly('steward_transfers', monthsThisYear),
  ]);

  // Aggregate spend by layer across the year so far
  const spendByLayer = {};
  monthsThisYear.forEach(m => {
    (spends[m] || []).forEach(sp => {
      spendByLayer[sp.layer] = (spendByLayer[sp.layer] || 0) + sp.amount;
    });
  });

  // Total deposits to stability and debt accelerator
  let stabilityDeposited = 0;
  let debtAcceleratorPaid = 0;
  monthsThisYear.forEach(m => {
    (transfers[m] || []).forEach(t => {
      if (t.layer === 'stability' && t.type === 'deposit') stabilityDeposited += t.amount;
      if (t.layer === 'debt_accelerator' && t.type === 'deposit') debtAcceleratorPaid += t.amount;
    });
  });

  // Average monthly income from plans
  const planIncomes = monthsThisYear
    .map(m => plans[m]?.income)
    .filter(Boolean);
  const avgIncome = planIncomes.length > 0
    ? planIncomes.reduce((s, v) => s + v, 0) / planIncomes.length
    : toMonthly(profile.netIncome, profile.payFrequency);

  // Debt totals from profile (current state)
  const currentDebt = (profile.debts || []).reduce((s, d) => s + d.balance, 0);

  return {
    year: currentYear,
    monthsIn: now.getMonth() + 1,
    avgIncome: Math.round(avgIncome),
    spendByLayer,
    stabilityDeposited: Math.round(stabilityDeposited),
    debtAcceleratorPaid: Math.round(debtAcceleratorPaid),
    currentDebt: Math.round(currentDebt),
    // Rough debt paid this year: extra from accelerator + minimums * months
    debtPaidEstimate: Math.round(
      debtAcceleratorPaid +
      (profile.debts || []).reduce((s, d) => s + d.minimum, 0) * monthsThisYear.length
    ),
  };
}

// ─── Chapter builder ──────────────────────────────────────────────────────────
// One chapter per calendar year. Oldest first, current year last (reversed for display).

function buildChapters(profile, snapshots, currentYearData, navigateEvents) {
  const chapters = [];
  const startYear = new Date(profile.createdAt).getFullYear();
  const currentYear = new Date().getFullYear();

  // Build a map of snapshots by year for quick lookup
  const snapshotByYear = {};
  snapshots.forEach(s => {
    snapshotByYear[s.year] = s;
  });

  // Current year — always shown, always "in progress"
  const currentChapter = buildCurrentChapter(currentYearData, profile);
  chapters.push(currentChapter);

  // Past years — from most recent backward to start year
  for (let year = currentYear - 1; year >= startYear; year--) {
    const snapshot = snapshotByYear[year];
    chapters.push(buildHistoricalChapter(year, snapshot, startYear, profile, navigateEvents));
  }

  return chapters;
}

function buildCurrentChapter(data, profile) {
  const monthsRemaining = 12 - data.monthsIn;
  const annualizedDebt = Math.round((data.debtPaidEstimate / data.monthsIn) * 12);

  return {
    year: data.year,
    label: yearLabel(data.year, new Date(profile.createdAt).getFullYear()),
    current: true,
    monthsIn: data.monthsIn,
    income: data.avgIncome,
    debtPaid: data.debtPaidEstimate,
    savingsBuilt: data.stabilityDeposited,
    currentDebt: data.currentDebt,
    lifeEvents: [], // populated from Navigate session data if available
    headline: `Year ${yearOrdinal(data.year, new Date(profile.createdAt).getFullYear())} is underway.`,
    subline: data.monthsIn > 0
      ? `${data.monthsIn} months in. On pace to pay down ${fmt(annualizedDebt)} in debt this year.`
      : 'Just getting started.',
    priorities: profile.priorities || [],
  };
}

function buildHistoricalChapter(year, snapshot, startYear, profile, navigateEvents) {
  const navigateForYear = (navigateEvents || [])
    .filter(e => e.year === year)
    .map(e => e.event);

  if (!snapshot) {
    // No snapshot — limited data, build stub chapter
    return {
      year,
      label: yearLabel(year, startYear),
      current: false,
      headline: year === startYear ? 'The year you started.' : `${year}.`,
      subline: 'Annual review not yet completed for this year.',
      income: null,
      debtPaid: 0,
      savingsBuilt: 0,
      lifeEvents: navigateForYear,
      priorities: [],
    };
  }

  // Extract key metrics from the snapshot's findings
  const findings = snapshot.findings || [];
  const debtFindings = findings.filter(f => f.type === 'debt_progress');
  const stabilityFinding = findings.find(f => f.type === 'stability_progress');
  const engagementFinding = findings.find(f => f.type === 'engagement');

  const totalDebtPaid = debtFindings.reduce((s, f) => s + (f.totalPaid || 0), 0);
  const savingsBuilt = stabilityFinding?.netBuilt || 0;

  // Extract life events from the snapshot, merged with any Navigate events for this year
  const lifeEvents = [...(snapshot.lifeEvents || []), ...navigateForYear];

  // Find accepted recommendations for display
  const acceptedRecs = (snapshot.recommendations || []).filter(r => r.accept);

  // The headline comes from the most significant finding's observation
  const topFinding = findings[0];
  const headline = topFinding?.observation || `A year of steady progress.`;
  const subline = topFinding?.implication || acceptedRecs.length > 0
    ? `${acceptedRecs.length} plan correction${acceptedRecs.length !== 1 ? 's' : ''} applied at your annual review.`
    : '';

  return {
    year,
    label: yearLabel(year, startYear),
    current: false,
    income: snapshot.profileSnapshot?.netIncome
      ? toMonthly(snapshot.profileSnapshot.netIncome, snapshot.profileSnapshot.payFrequency)
      : null,
    debtPaid: totalDebtPaid,
    savingsBuilt,
    endDebt: (snapshot.profileSnapshot?.debts || []).reduce((s, d) => s + d.balance, 0),
    lifeEvents,
    headline,
    subline,
    reviewDate: formatMonthYear(snapshot.date),
    reviewCorrections: acceptedRecs.length,
    priorities: snapshot.profileSnapshot?.priorities || [],
    findings,
  };
}

// ─── Milestones ───────────────────────────────────────────────────────────────
// Significant moments extracted from snapshot findings and profile data.

function extractMilestones(snapshots, currentYearData, navigateEvents) {
  const milestones = [];

  snapshots.forEach(snapshot => {
    const findings = snapshot.findings || [];

    findings.forEach(f => {
      // Debt fully paid off
      if (f.type === 'debt_progress' && f.estimatedCurrentBalance === 0 && f.totalPaid > 0) {
        milestones.push({
          date: formatMonthYear(snapshot.date),
          year: snapshot.year,
          label: `${f.debtName} paid off`,
          type: 'debt',
          amount: f.startBalance,
        });
      }

      // Stability buffer goal hit
      if (f.type === 'stability_progress' && f.hitGoal) {
        milestones.push({
          date: formatMonthYear(snapshot.date),
          year: snapshot.year,
          label: 'Stability buffer fully funded',
          type: 'goal',
          amount: f.target,
        });
      }
    });

    // Life events from the review that are milestones
    const milestoneEvents = ['Paid off a debt', 'New job or income change', 'Got married or partnered', 'Had a baby'];
    (snapshot.lifeEvents || []).forEach(e => {
      if (milestoneEvents.includes(e)) {
        milestones.push({
          date: formatMonthYear(snapshot.date),
          year: snapshot.year,
          label: e,
          type: 'life',
        });
      }
    });
  });

  // Navigate events as life milestones
  (navigateEvents || []).forEach(e => {
    milestones.push({
      date: formatMonthYear(e.date),
      year: e.year,
      label: e.event,
      type: 'life',
    });
  });

  // Sort newest first
  return milestones.sort((a, b) => b.year - a.year);
}

// ─── Totals ───────────────────────────────────────────────────────────────────

function computeTotals(chapters) {
  const totalDebtPaid = chapters.reduce((s, c) => s + (c.debtPaid || 0), 0);
  const totalSavingsBuilt = chapters.reduce((s, c) => s + (c.savingsBuilt || 0), 0);

  return {
    debtPaid: Math.round(totalDebtPaid),
    savingsBuilt: Math.round(totalSavingsBuilt),
    // Net worth change = debt paid + savings built
    netWorthChange: Math.round(totalDebtPaid + totalSavingsBuilt),
  };
}

// ─── Net worth arc ────────────────────────────────────────────────────────────
// Monthly (assets - debts) snapshots for an optional sparkline.
// Assets = savings balance. Debts = sum of debt balances.
// This is deliberately simple — Steward doesn't track investments here.

function buildNetWorthArc(profile, snapshots, currentYearData) {
  const points = [];
  const startYear = new Date(profile.createdAt).getFullYear();
  const now = new Date();

  // Starting point
  const startingDebt = (profile.debts || []).reduce((s, d) => s + d.balance, 0);
  points.push({
    label: formatMonthYear(profile.createdAt),
    assets: profile.savings || 0,
    debts: startingDebt,
    net: (profile.savings || 0) - startingDebt,
  });

  // One data point per annual snapshot
  snapshots.forEach(s => {
    const snap = s.profileSnapshot || {};
    const assets = snap.savings || 0;
    const debts = (snap.debts || []).reduce((sum, d) => sum + d.balance, 0);
    points.push({
      label: formatMonthYear(s.date),
      year: s.year,
      assets: Math.round(assets),
      debts: Math.round(debts),
      net: Math.round(assets - debts),
    });
  });

  // Current point
  points.push({
    label: 'Now',
    assets: currentYearData.stabilityDeposited + (profile.savings || 0),
    debts: currentYearData.currentDebt,
    net: Math.round(
      (currentYearData.stabilityDeposited + (profile.savings || 0)) -
      currentYearData.currentDebt
    ),
  });

  return points;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function loadMonthly(prefix, months) {
  const results = {};
  await Promise.all(
    months.map(async m => {
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

function formatMonthYear(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function computeYearsActive(createdAt) {
  const start = new Date(createdAt);
  const now = new Date();
  const years = (now - start) / (1000 * 60 * 60 * 24 * 365);
  return Math.max(1, Math.round(years * 10) / 10);
}

function yearLabel(year, startYear) {
  const diff = year - startYear + 1;
  const ordinals = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  return `Year ${ordinals[diff - 1] || diff}`;
}

function yearOrdinal(year, startYear) {
  return yearLabel(year, startYear).replace('Year ', '');
}

function fmt(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}
