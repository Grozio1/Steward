// Real Anthropic API layer.
// getDailyObservation and generateSynthesis call the API; generatePlan is
// arithmetic-only and is re-exported from stub.js unchanged.
// Both API functions fall back to stub responses on any error so the app
// never crashes when offline or when the key is missing.

import {
  getDailyObservation as stubObservation,
  generateSynthesis as stubSynthesis,
} from './stub';

export { generatePlan } from './stub';

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';

async function call(model, system, userContent, maxTokens) {
  if (!API_KEY) throw new Error('EXPO_PUBLIC_ANTHROPIC_KEY not set');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text?.trim() ?? '';
}

// ─── Daily observation ─────────────────────────────────────────────────────────
// Haiku — one sentence, max 60 tokens. Profile may be null (called before load).
export async function getDailyObservation(profile, context = {}) {
  try {
    const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const parts = [`Month: ${month}`];
    if (profile?.name) parts.push(`Name: ${profile.name}`);
    if (profile?.netIncome) parts.push(`Take-home: $${Number(profile.netIncome).toLocaleString()}/mo`);
    if (profile?.savings) parts.push(`Savings: $${Number(profile.savings).toLocaleString()}`);
    if (context.overAmount > 0) parts.push(`Over budget by $${Number(context.overAmount).toLocaleString()} this month`);

    const text = await call(
      'claude-3-haiku-20240307',
      'You are Steward, a financial life companion with a parent/grandparent voice — warm, direct, plain. Write one sentence only. No greeting, no punctuation beyond a period. Observe something genuine about where the user stands this month based on their profile. If they spent more than their income, acknowledge the overage calmly and directly — no alarm, no shame. Never generic filler.',
      parts.join('. '),
      60,
    );
    return text || stubObservation(profile);
  } catch {
    return stubObservation(profile);
  }
}

// ─── Crisis response (Something else) ────────────────────────────────────────
// Sonnet — personalized crisis response for free-text life events.
// Returns raw text; caller is responsible for parsing and fallback.
export async function generateCrisisResponse(context, profile) {
  const fixedTotal = (profile?.fixedCommitments || []).reduce(
    (s, c) => s + Number(c.monthlyAmount || c.amount || 0), 0
  );
  const debtTotal = (profile?.debts || []).reduce((s, d) => s + Number(d.balance || 0), 0);

  const parts = [context.trim()];
  if (profile?.name)    parts.push(`Name: ${profile.name}`);
  if (profile?.netIncome) parts.push(`Monthly take-home: $${Number(profile.netIncome).toLocaleString()}`);
  if (profile?.savings)   parts.push(`Liquid savings: $${Number(profile.savings).toLocaleString()}`);
  if (fixedTotal > 0)   parts.push(`Fixed commitments: $${fixedTotal.toLocaleString()}/mo`);
  if (debtTotal > 0)    parts.push(`Total debt: $${debtTotal.toLocaleString()}`);

  return call(
    'claude-sonnet-4-20250514',
    'You are Steward, a financial life companion with a parent/grandparent voice — warm, direct, plain-spoken. The user is describing a personal or financial crisis in their own words. Respond with: one acknowledgment sentence (human first, never numbers first), then a section called WHAT YOU HAVE that summarizes their financial position in 2-3 bullet points using the profile data provided, then DO THIS FIRST with one concrete action they can take today, then a RECOVERY ARC with 3-4 steps with timeframes. Use plain language. No jargon. Never generic. Always specific to what they described.',
    parts.join('\n'),
    600,
  );
}

// ─── Onboarding synthesis ──────────────────────────────────────────────────────
// Sonnet — full profile → JSON { summary, keyInsight, name }.
export async function generateSynthesis(profile) {
  try {
    const text = await call(
      'claude-sonnet-4-20250514',
      'You are Steward. You just finished a first conversation with someone about their finances. Write a synthesis: 2–3 bullet points of what you heard (plain language, specific numbers), then one key insight paragraph starting with the single most important thing to address. Voice: warm, direct, never clinical. Return JSON only: { "summary": string[], "keyInsight": string, "name": string }',
      JSON.stringify(profile),
      400,
    );
    // Strip markdown code fences if the model wraps the JSON
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      summary: Array.isArray(parsed.summary) ? parsed.summary : [],
      keyInsight: typeof parsed.keyInsight === 'string' ? parsed.keyInsight : '',
      name: parsed.name ?? profile?.name ?? '',
    };
  } catch {
    return stubSynthesis(profile);
  }
}
