// Life stage classification engine.
// Pure computation — no async, no side effects.
// Returns { lifeStage, inTransition, classifiedAt }.

const STAGE_ORDER = [
  'starting_out',
  'building',
  'family_years',
  'peak_earning',
  'transition',
  'retirement',
];

function rank(stage) {
  const i = STAGE_ORDER.indexOf(stage);
  return i === -1 ? 1 : i;
}

function toMonthly(netIncome, payFrequency) {
  const n = Number(netIncome) || 0;
  switch (payFrequency) {
    case 'weekly':       return Math.round(n * 52 / 12);
    case 'biweekly':     return Math.round(n * 26 / 12);
    case 'semi-monthly':
    case 'semimonthly':  return Math.round(n * 2);
    default:             return n;
  }
}

const PRIMARY_MAP = {
  starting_out:      'starting_out',
  building_career:   'building',
  growing_household: 'family_years',
  peak_earning:      'peak_earning',
  pre_retirement:    'transition',
  retired:           'retirement',
};

export function classifyLifeStage(profile) {
  const {
    lifeStageSignal,
    household,
    confidenceSignal,
    fixedCommitments = [],
    debts = [],
    investments = [],
    netIncome,
    payFrequency,
  } = profile;

  // ── Primary signal ──────────────────────────────────────────────────────────
  let stage = PRIMARY_MAP[lifeStageSignal] || 'building';

  // ── Derived facts ───────────────────────────────────────────────────────────
  const monthlyIncome  = toMonthly(netIncome, payFrequency);
  const totalDebt      = debts.reduce((s, d) => s + Number(d.balance || 0), 0);
  const hasMortgage    = fixedCommitments.some((c) => /mortgage|home loan/i.test(c.name || ''));
  const totalInvested  = investments.reduce((s, inv) => s + Number(inv.balance || 0), 0);

  // Student-loan-like: meaningful debt, no owned home, early-career income
  const isStudentLoanLike = !hasMortgage && monthlyIncome < 4000;

  // ── Modifier: mortgage → floor at building ──────────────────────────────────
  if (hasMortgage && rank(stage) < rank('building')) {
    stage = 'building';
  }

  // ── Modifier: family household → floor at building ──────────────────────────
  if (household === 'family' && rank(stage) < rank('building')) {
    stage = 'building';
  }

  // ── Modifier: student-loan-like debt → ceiling at building ──────────────────
  // High debt + no mortgage + low income confirms early stage even if self-report says otherwise.
  if (totalDebt > 5000 && isStudentLoanLike && rank(stage) > rank('building')) {
    stage = 'building';
  }

  // ── Modifier: substantial investments → floor at peak_earning ───────────────
  if (totalInvested > 100000 && rank(stage) < rank('peak_earning')) {
    stage = 'peak_earning';
  }

  // ── inTransition flag ────────────────────────────────────────────────────────
  const inTransition = confidenceSignal === 'major_change';

  return {
    lifeStage: stage,
    inTransition,
    classifiedAt: new Date().toISOString(),
  };
}
