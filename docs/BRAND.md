# Steward — Brand Reference

## Name & Meaning

**Steward** — one who manages what belongs to another, with care and accountability. The name carries no aspiration toward wealth or optimization. It implies duty, patience, and trust. A steward doesn't own the resources; they tend them on behalf of someone else's future self.

The name works in one syllable. It needs no explanation. It does not promise to make you rich.

---

## The Mark

A **flame** — amber on forest green, contained within a circle.

The flame is the oldest symbol of tending: you keep it going, you don't let it die, you don't let it consume everything around it. It is warm, not flashy. It suggests presence, not performance.

- **Outer shape:** Forest green circle — steady, grounded, alive
- **Flame:** Ember amber — warmth, not alarm; energy that sustains rather than burns out
- **Inner highlight:** Lighter amber (#E8A85A) at reduced opacity — depth without complexity

The mark is never used ironically. It is never animated to celebrate. It is simply present.

---

## Color Palette

| Name | Hex | Role |
|---|---|---|
| Forest | `#1A3C2B` | Primary — authority, calm, life |
| Ember | `#C8883A` | Accent — warmth, urgency, action |
| Parchment | `#F7F3EC` | Background — aged paper, not clinical white |
| Sage | `#4A7060` | Secondary — subdued forest, labels, icons |
| Hearth | `#1C1916` | Text — near-black, warm not cold |

### Derived tokens

| Name | Value | Use |
|---|---|---|
| Forest Light | `#2A5C43` | Hover states, dividers on forest bg |
| Forest Muted | `#1A3C2B22` | Subtle forest-tinted backgrounds |
| Ember Light | `#E8A85A` | Flame highlight, softened ember |
| Ember Muted | `#C8883A22` | Warning backgrounds, badge fills |
| Parchment Dark | `#EDE9E0` | Cards on parchment bg, input backgrounds |
| Sage Muted | `#4A706033` | Sage-tinted surfaces |
| Border | `#D8D3CA` | Dividers, input outlines |
| Placeholder | `#9C9888` | Secondary text, hints, empty states |
| Error | `#B04030` | Destructive actions, validation errors |

### Color rules

- Forest is authority. Use it for primary actions, the summary card, progress fills that are on-track.
- Ember is the flag. Use it for over-budget states, warnings, the FAB, action emphasis. Do not use it decoratively.
- Parchment is the ground. All screens sit on it. It is never pure white.
- Hearth is all body text. Never true black (`#000`).
- Sage is the quiet voice — labels, secondary icons, hint text that isn't quite a placeholder.

---

## Typography

### Typefaces

**Playfair Display** (serif, bold only) — headings, screen titles, greeting lines, the moments that matter. Carries the weight of something considered. Never used for interface chrome or small labels.

**Jost** (sans-serif, three weights) — everything else. Clean, slightly geometric, warm at small sizes.

| Weight | Token | Use |
|---|---|---|
| Light (300) | `Jost_300Light` | Body copy, amounts, captions, secondary text |
| Regular (400) | `Jost_400Regular` | Body text, pill labels, observation text |
| Medium (500) | `Jost_500Medium` | UI labels, row names, button text, emphasis |

### Type hierarchy

| Level | Face | Size | Use |
|---|---|---|---|
| Heading | Playfair Bold | 30px | Screen titles, greeting |
| Subheading | Playfair Bold | 24px | Modal titles, section headers |
| Body | Jost Regular | 15px | Main content, card text |
| Body Medium | Jost Medium | 15px | Emphasized body, row names |
| Amount | Jost Medium | 17px | Currency values, key numbers |
| Caption | Jost Light | 13px | Secondary notes, dates, hints |
| Label | Jost Medium | 11px | Uppercase section labels, badges |
| Steward Voice | Jost Regular | 17px | AI-generated observations and insights |

### Typography rules

- Playfair is reserved for moments that deserve it. A modal title earns it; a row label does not.
- Currency amounts use Jost Medium, not serif — numbers should feel precise, not ornate.
- Line heights: 1.6× for body, 1.4–1.5× for headings, 1.7× for Steward Voice (breathing room for considered language).
- Letter-spacing on uppercase labels: `0.8–1.0`. Never tracked on sentence-case text.

---

## Tagline

**"Tend to what matters."**

Not "take control." Not "build wealth." Not "achieve your goals." *Tend* — present tense, ongoing, humble. The tagline is the product philosophy in four words.

It is used sparingly. Onboarding. Marketing. It does not appear in the running app as a repeated element.

---

## Brand Personality

**Wise** — has seen this before. Doesn't panic. Doesn't over-explain. Offers the one thing worth saying, not everything it knows.

**Warm** — genuinely cares about the outcome. Never clinical. Never cold. Not cheerful in a forced way — warm like someone who's sat across from you and listened.

**Steady** — consistent tone regardless of the user's situation. A $30,000 budget and a $3,000 budget are treated with equal seriousness.

**Honest** — says the hard thing plainly, without softening it into uselessness. Doesn't catastrophize. Doesn't minimize.

**Patient** — never rushes to a recommendation. Acknowledges before advising. Understands that financial stress is emotional before it is mathematical.

---

## The Seven Voice Principles

1. **Say the one thing.** Find the single most important insight and lead with it. Do not list everything that could be said.

2. **Plain language, not plain thinking.** Short words for complex ideas. "You've got two months of runway" not "your liquidity ratio represents approximately 0.17 years of operating expenses."

3. **Acknowledge before advising.** When someone is in crisis — job loss, divorce, medical emergency — the first sentence is human, not financial.

4. **Don't perform confidence you don't have.** If something is uncertain, say so. "Depends on what you decide about the car" is honest. False precision erodes trust.

5. **Numbers are context, not conclusion.** "$847 left" is data. What it means depends on when the month ends, what's coming, and what matters to this person. Supply the context.

6. **Never preach.** The user didn't ask for a lecture about their spending habits. They asked for help with a decision. Stay in that lane.

7. **Earn the next word.** Every sentence should make the user want to read the next one, because it's useful — not because it's clever.

---

## What Steward Is Not

- **Not a budgeting app with gamification.** No streaks. No badges. No confetti on payday.
- **Not an optimizer.** Steward does not try to squeeze every dollar into peak efficiency. It helps people make decisions they can live with.
- **Not a bank.** Steward holds no money and makes no transactions. It is a thinking partner.
- **Not a therapist.** It acknowledges the emotional weight of money decisions but does not position itself as emotional support. It has a lane and stays in it.
- **Not aspirational.** It doesn't sell a life upgrade. It helps you steward the life you have.

---

## Usage Notes

### The flame in context
The FlameIcon appears in the dashboard header as a persistent but quiet presence — not a notification badge, not a reward indicator. It is simply the mark of the product, present as a reminder of what Steward is.

### Forest green as primary
When in doubt, reach for forest. It is the brand's backbone — capable of being a background, a progress fill, a button, a card. Ember should feel like punctuation: meaningful because it's used sparingly.

### Parchment as the ground
Every screen background is parchment (`#F7F3EC`), not white. This is non-negotiable. Pure white reads as clinical; parchment reads as considered. It is the product's most distinctive visual choice after the color palette itself.

### Tone calibration by screen
- **Dashboard / Deploy:** Calm, informational. Forest dominates.
- **Decide:** Slightly more active — Ember appears as the decision moment has stakes.
- **Navigate:** Warm and unhurried. The crisis tone is acknowledgment-first; the palette holds steady.
- **Onboarding / Profile:** Neutral and patient. No urgency.
