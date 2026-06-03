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
export async function getDailyObservation(profile) {
  try {
    const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const parts = [`Month: ${month}`];
    if (profile?.name) parts.push(`Name: ${profile.name}`);
    if (profile?.netIncome) parts.push(`Take-home: $${Number(profile.netIncome).toLocaleString()}/mo`);
    if (profile?.savings) parts.push(`Savings: $${Number(profile.savings).toLocaleString()}`);

    console.log('→ Haiku observation requested');
    const text = await call(
      'claude-3-haiku-20240307',
      'You are Steward, a financial life companion with a parent/grandparent voice — warm, direct, plain. Write one sentence only. No greeting, no punctuation beyond a period. Observe something genuine about where the user stands this month based on their profile. Never generic filler.',
      parts.join('. '),
      60,
    );
    console.log('← Haiku response: ' + text);
    return text || stubObservation(profile);
  } catch {
    return stubObservation(profile);
  }
}

// ─── Onboarding synthesis ──────────────────────────────────────────────────────
// Sonnet — full profile → JSON { summary, keyInsight, name }.
export async function generateSynthesis(profile) {
  try {
    console.log('→ Sonnet synthesis requested');
    const text = await call(
      'claude-sonnet-4-20250514',
      'You are Steward. You just finished a first conversation with someone about their finances. Write a synthesis: 2–3 bullet points of what you heard (plain language, specific numbers), then one key insight paragraph starting with the single most important thing to address. Voice: warm, direct, never clinical. Return JSON only: { "summary": string[], "keyInsight": string, "name": string }',
      JSON.stringify(profile),
      400,
    );
    console.log('← Sonnet response received');
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
