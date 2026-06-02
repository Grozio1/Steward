// ─── Steward AI Service ───────────────────────────────────────────────────────
// Stub layer. All function signatures are final.
// Replace each function body with an Anthropic API call when ready.
// No other files need to change when you wire the real model.
//
// Token tier notes (from brief §7):
//   Profile building / crisis: claude-sonnet-4-20250514
//   Daily observations / decision insight: claude-haiku (small, 50-token output)

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Synthesis ────────────────────────────────────────────────────────────────
// Called once after onboarding. High-value, Sonnet-class.

export async function getSynthesisInsight(profile) {
  await delay(700);
  const name = profile?.name || 'there';
  return `${name}, here's what I heard. Your fixed life is covered. ` +
    `The most important move right now is protecting your stability buffer before anything else — ` +
    `that's your foundation. Once that's solid, everything on top of it is yours to direct.`;
}

// ─── Daily Observation ────────────────────────────────────────────────────────
// Generated once per day. Haiku-class, 50-token max.

export async function getDailyObservation(profile, allocations) {
  await delay(350);
  const name = profile?.name ? `, ${profile.name}` : '';
  return `You're tracking well this month${name}. Food is your most active bucket — that's normal for where you are in the month.`;
}

// ─── Decision Insight ─────────────────────────────────────────────────────────
// Called when user brings a purchase to Decide mode. Haiku-class.

export async function getDecisionInsight(allocationId, amount, allocations) {
  await delay(450);
  const allocation = allocations?.find((a) => a.id === allocationId);
  if (!allocation) return 'This spend would come from your Quality of Life bucket.';
  const afterSpent   = (allocation.spent || 0) + amount;
  const afterPct     = allocation.budgeted > 0
    ? Math.round((afterSpent / allocation.budgeted) * 100)
    : 100;
  return `This moves your ${allocation.label} bucket to ${afterPct}% deployed. Here's what that looks like.`;
}

// ─── Crisis Navigation ────────────────────────────────────────────────────────
// Called when user declares a life event. Sonnet-class.

const CRISIS_RESPONSES = {
  job_loss:
    `First: your runway. Let's calculate how many months you have before the numbers get uncomfortable. ` +
    `That number is your anchor — everything else is a tradeoff around it.`,
  divorce:
    `This is a full re-conversation. Two financial lives that were one are separating. ` +
    `We'll take it one piece at a time, starting with what's fixed and what's flexible.`,
  career_change:
    `The key number here is your bridge: how long until income must resume? ` +
    `Let's build that picture first, then figure out what moves and what waits.`,
  loss_of_spouse:
    `We're not making any big decisions right now. ` +
    `Just making sure the most immediate things are covered. The rest waits until you're ready.`,
  new_baby:
    `Childcare is about to become your largest new fixed commitment. ` +
    `Let's model that in and see what else moves — then talk about life insurance and 529 timing.`,
  other:
    `Tell me what changed. I'll help you figure out what matters most right now ` +
    `and what can wait.`,
};

export async function getCrisisGuidance(eventType) {
  await delay(600);
  return CRISIS_RESPONSES[eventType] || CRISIS_RESPONSES.other;
}

// ─── Opening line (static — no API call) ─────────────────────────────────────

export const CRISIS_OPENING =
  `Take a breath. You're in a harder spot than you expected to be, ` +
  `but you have more options than it feels like right now. ` +
  `Let's figure out what you actually have to work with.`;
