// Real Anthropic API layer.
// getDailyObservation and generateSynthesis call the API; generatePlan is
// arithmetic-only and is re-exported from stub.js unchanged.
// Both API functions fall back to stub responses on any error so the app
// never crashes when offline or when the key is missing.

import {
  getDailyObservation as stubObservation,
  generateSynthesis as stubSynthesis,
} from './stub';
import { getLifeEvents } from '../data/store';

export { generatePlan } from './stub';

const API_URL = 'https://steward-proxy-production-d89e.up.railway.app/steward/claude';

async function call(model, system, userContent, maxTokens) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
// Returns days between two month+day pairs, accounting for year-end wraparound.
function annualDaysDiff(refMonth, refDay) {
  const today = new Date();
  const ref = new Date(today.getFullYear(), refMonth, refDay);
  const diffDays = Math.round((ref - today) / 86400000);
  // Normalize across year boundary: -183 to 182 → pick the closest direction
  if (diffDays > 182)  return diffDays - 365;
  if (diffDays < -182) return diffDays + 365;
  return diffDays;
}

export async function getDailyObservation(profile, context = {}) {
  try {
    const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const parts = [`Month: ${month}`];
    if (profile?.name) parts.push(`Name: ${profile.name}`);
    if (profile?.netIncome) parts.push(`Take-home: $${Number(profile.netIncome).toLocaleString()}/mo`);
    if (profile?.savings) parts.push(`Savings: $${Number(profile.savings).toLocaleString()}`);
    if (context.overAmount > 0) parts.push(`Over budget by $${Number(context.overAmount).toLocaleString()} this month`);

    // Birthday check
    if (profile?.dateOfBirth) {
      const dobParts = profile.dateOfBirth.split('/');
      if (dobParts.length === 3) {
        const [m, d, y] = dobParts.map(Number);
        const dob = new Date(y, m - 1, d);
        if (!isNaN(dob.getTime())) {
          const diff = annualDaysDiff(dob.getMonth(), dob.getDate());
          if (Math.abs(diff) <= 7) {
            const today = new Date();
            const age = today.getFullYear() - dob.getFullYear() + (diff <= 0 ? 0 : -1);
            parts.push(`Birthday: turning ${age + 1} ${diff > 0 ? `in ${diff} day${diff !== 1 ? 's' : ''}` : diff === 0 ? 'today' : 'just passed'}`);
          }
        }
      }
    }

    // Life milestone anniversary check (milestones only, not crisis events)
    try {
      const lifeEvents = await getLifeEvents();
      const today = new Date();
      for (const evt of lifeEvents) {
        if (evt.type === 'crisis') continue;
        const evtDate = new Date(evt.date);
        if (isNaN(evtDate.getTime())) continue;
        if (evtDate.getFullYear() >= today.getFullYear()) continue; // skip same-year events
        const diff = annualDaysDiff(evtDate.getMonth(), evtDate.getDate());
        if (Math.abs(diff) <= 7) {
          const yearsAgo = today.getFullYear() - evtDate.getFullYear();
          parts.push(`Life anniversary: ${yearsAgo} year${yearsAgo !== 1 ? 's' : ''} since "${evt.event}"`);
          break; // one anniversary hint per observation is enough
        }
      }
    } catch {
      // Non-critical — proceed without anniversary context
    }

    const text = await call(
      'claude-haiku-4-5',
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
    'claude-sonnet-5',
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
      'claude-sonnet-5',
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
