# Steward — Design System Reference

## Color Tokens & Roles

All tokens live in `src/constants/brand.js` as `COLORS`. Import from there; never hardcode hex values in screens or components.

### Primary palette

| Token | Hex | Primary role |
|---|---|---|
| `COLORS.forest` | `#1A3C2B` | Primary actions, progress fills, summary card bg, Forest header |
| `COLORS.ember` | `#C8883A` | FAB, over-budget fills, warning states, debt accelerator accent |
| `COLORS.parchment` | `#F7F3EC` | Screen background (all screens) |
| `COLORS.sage` | `#4A7060` | Section labels, secondary icons, gear icon, non-critical UI chrome |
| `COLORS.hearth` | `#1C1916` | All body text, headings, input text |

### Derived palette

| Token | Use |
|---|---|
| `COLORS.forestLight` | Dividers on forest background |
| `COLORS.forestMuted` | Subtle forest-tinted surface (badge bg, muted pill) |
| `COLORS.emberLight` | Flame inner highlight |
| `COLORS.emberMuted` | Warning/over-budget card backgrounds, badge fills |
| `COLORS.parchmentDark` | Cards on parchment bg, edit form backgrounds, list items |
| `COLORS.border` | All input borders, row dividers, card outlines |
| `COLORS.placeholder` | Secondary labels, hint text, empty states, captions |
| `COLORS.error` | Delete actions, validation errors, destructive confirmations |
| `COLORS.white` | Modal sheets, card interiors that need contrast against parchment |

---

## Typography Scale

All tokens live in `src/constants/brand.js` as `FONTS` and `SIZES`.

### Size scale

| Token | px | Typical use |
|---|---|---|
| `SIZES.xs` | 11 | Uppercase section labels, badges, tiny captions |
| `SIZES.sm` | 13 | Captions, secondary row text, pill labels |
| `SIZES.base` | 15 | Body text, card content, modal body |
| `SIZES.md` | 17 | Steward Voice text, key amounts |
| `SIZES.lg` | 20 | Summary card values, large icons |
| `SIZES.xl` | 24 | Modal titles (Playfair), subheadings |
| `SIZES.xxl` | 30 | Screen greeting (Playfair) |
| `SIZES.xxxl` | 38 | Quick Log amount input |

### Font tokens

| Token | Face | Weight |
|---|---|---|
| `FONTS.serif.bold` | Playfair Display | 700 |
| `FONTS.sans.light` | Jost | 300 |
| `FONTS.sans.regular` | Jost | 400 |
| `FONTS.sans.medium` | Jost | 500 |

### StewardText variants

`StewardText` is the canonical text component. Pass `variant` instead of writing inline font styles.

| Variant | Font | Size | Color | Use |
|---|---|---|---|---|
| `heading` | Playfair Bold | xxl (30) | hearth | Screen titles, greetings |
| `subheading` | Playfair Bold | xl (24) | hearth | Modal titles |
| `body` | Jost Regular | base (15) | hearth | General content |
| `bodyMedium` | Jost Medium | base (15) | hearth | Emphasized body |
| `caption` | Jost Light | sm (13) | placeholder | Dates, hints, secondary notes |
| `label` | Jost Medium | xs (11) | sage | Uppercase section headers |
| `amount` | Jost Medium | md (17) | hearth | Currency values |
| `stewardVoice` | Jost Regular | md (17) | hearth | AI observations, insights |

The default variant is `body`. Override `color` via the `color` prop — do not wrap in a `View` to change color.

---

## Spacing System

All tokens live in `src/constants/brand.js` as `SPACING`. The scale is 4-based.

| Token | px | Use |
|---|---|---|
| `SPACING.xs` | 4 | Icon padding, badge internal padding, tight gaps |
| `SPACING.sm` | 8 | Between items in a row, pill padding, small gaps |
| `SPACING.md` | 16 | Card padding, section gaps, standard rhythm |
| `SPACING.lg` | 24 | Screen-level padding, large button padding |
| `SPACING.xl` | 32 | Section separation, modal top padding |
| `SPACING.xxl` | 48 | Bottom padding to clear FAB, modal bottom padding |

### Radius scale

| Token | px | Use |
|---|---|---|
| `RADIUS.sm` | 6 | Buttons, input fields, small badges |
| `RADIUS.md` | 12 | Cards (default) |
| `RADIUS.lg` | 20 | Large modals, bottom sheets |
| `RADIUS.xl` | 28 | Modal sheet top corners |
| `RADIUS.full` | 999 | Pills, circular elements, progress bars |

### Shadow scale

| Token | Use |
|---|---|
| `SHADOW.soft` | Cards in list contexts (elevation 2) |
| `SHADOW.medium` | FAB, floating elements (elevation 4) |

---

## Component Patterns

### StewardCard

`StewardCard` wraps content in a rounded, padded surface. Pass `variant` for background; pass `style` for overrides.

| Variant | Background | Use |
|---|---|---|
| `default` | `COLORS.white` | General cards, list items |
| `forest` | `COLORS.forest` | Summary / income-spent-left card |
| `ember` | `COLORS.ember` | (Available; not yet used in main flows) |
| `parchment` | `COLORS.parchmentDark` | Observation card, edit form containers |
| `outlined` | `COLORS.white` + 1px border | Secondary surfaces that need separation without shadow |

All variants share `RADIUS.md` (12px) padding and `SHADOW.soft` — except `outlined`, which zeroes the shadow.

### AllocationBar

Renders a single budget allocation row with a name, spent/budget amounts, a progress track, and a note line.

**States:**

| State | Track color | Amount color | Note |
|---|---|---|---|
| On track | `COLORS.forest` | `COLORS.forest` | "X left" |
| Over budget | `COLORS.ember` | `COLORS.ember` | "X over" |
| Ad hoc layer | No track | — | "X logged" or allocation note |
| Fully committed (fixed, goals, stability) | `COLORS.forest` | — | Goal progress or custom note |

The bar fill is capped at 100% of track width. Over-budget state is signaled by color change, not overflow.

Tapping an AllocationBar opens the appropriate detail modal:
- `layer === 'fixed'` → FixedCommitmentsModal
- `layer === 'debt_floor'` → DebtMinimumsModal
- `layer === 'stability'` or `'debt_accelerator'` or `goal_*` → TransferLedgerModal
- All others → SpendDetailModal

### FlameIcon

The brand mark. Forest green circle, ember flame SVG. Size prop sets the flame area; the container is automatically `size × 1.6`.

Used in: dashboard header (size 20). Not used as a reward or notification indicator.

---

## Screen Modes & Visual Language

Steward has three functional modes accessible from the bottom tab bar, plus Dashboard as the home.

### Dashboard

**Purpose:** At-a-glance monthly status. What's been spent, what's left, where things stand.

**Visual language:**
- Parchment background
- Forest summary card at top (income / spent / left)
- Allocation bars below — quiet, linear, progress-based
- Steward's daily observation appears as a parchment card above the summary
- FAB (ember) at bottom right — quick spend logging
- Gear icon (sage, `settings-outline`) top right → Profile

**Tone:** Calm. Informational. The user should be able to read the screen in under 10 seconds and know where they stand.

### Deploy

**Purpose:** Review and adjust the monthly allocation plan before committing it.

**Visual language:**
- AllocationRows with lock indicators for fixed layers
- Editable amounts for flexible layers (inline TextInput, autoFocus)
- Forest = locked/confirmed; Ember = adjustable/accelerated; Sage = active spending buckets; Placeholder = ad hoc
- "Confirm plan" action — moves the user from planning to tracking

**Tone:** Deliberate. This is where decisions are made, not reported. The interface gives permission to adjust without pressure.

**Layer color coding in Deploy:**

| Layer | Color | Meaning |
|---|---|---|
| `fixed` | Forest | Auto-committed, can't be changed |
| `debt_floor` | Forest | Minimum required, floor payment |
| `debt_accelerator` | Ember | Chosen extra payoff — active, intentional |
| `stability` | Ember | Building runway — active, intentional |
| `food` / `qol` | Sage | Discretionary, yours to spend |
| `adhoc` | Placeholder | Catch-all for surprises |

### Decide

**Purpose:** In-the-moment spend decisions. Enter an amount and category; Steward gives one sentence of context.

**Visual language:**
- Minimal — amount input, category selector, one insight line
- Insight uses `stewardVoice` variant — the one piece of judgment that matters
- PathCards for next action (log it, skip it, adjust the plan)
- No progress bars, no charts — just the decision and its context

**Tone:** Direct. The user is about to spend money. Steward says what they need to hear in one sentence and presents clear options. It does not moralize.

**Insight logic:**
- Can't afford it → says what's actually left and what the trade-off is
- Can afford it but it's a large % of remaining → names the percentage, names the trade
- Comfortable spend → says so plainly and gets out of the way

### Navigate

**Purpose:** Life event response. When circumstances change — job loss, medical emergency, new baby — Steward reorients the plan around the new reality.

**Visual language:**
- Event selector (discrete cards, not a dropdown)
- Optional context field for free text
- Response: acknowledgment paragraph first, then 2–3 concrete actions, then plan implications
- Forest/parchment palette holds steady — the visual language does not change in a crisis

**Tone:** Warm and unhurried. The acknowledgment sentence is the most important thing on screen. The financial content comes second.

---

## UI Rules

### No confetti, no streaks
Steward does not celebrate or gamify. Paying off a debt, hitting a savings goal, finishing a month under budget — these are acknowledged simply, in plain language, if at all. No animations, no achievement banners.

The reasoning: the people who most need this product have often been failed by their own past attempts to "do better with money." Performative celebration of small wins can feel patronizing, and the absence of a streak can feel like failure. Neither belongs here.

### 8-second log principle
The Quick Log modal must be completable in under 8 seconds for a known amount and category. Amount input is autoFocused. Category defaults to the first item. The keyboard clears on confirmation. No required fields beyond amount.

This is non-negotiable. The log moment happens in the real world — standing at a register, walking out of a store. If it takes longer than 8 seconds, it won't happen.

### AI visibility principle
Whenever Steward presents AI-generated content, it is visually distinct (`stewardVoice` variant, `StewardCard variant="parchment"`) but never labeled "AI says" or marked with a robot icon. The voice is Steward's voice, not a feature's voice.

The `stub.js` layer matches the interface the real API will use, so the switch from stub to live is a drop-in. All AI content is reviewed for voice before shipping.

### Modal behavior
- All modals are bottom sheets (`animationType="slide"`, `presentationStyle="overFullScreen"`)
- `KeyboardAvoidingView` wraps all sheets that contain inputs
- "Done" closes without saving where appropriate; destructive actions always confirm via `Alert.alert`
- Modal max height: `80%` — content scrolls, the sheet does not grow to full screen

### Navigation
- Dashboard → Profile: gear icon (`settings-outline`, sage, size 22) in header
- Profile saves and navigates back on "Save changes"
- Reset/destructive data actions live in Profile, behind a confirmation alert
- The three mode screens (Deploy, Decide, Navigate) are bottom tabs — persistent, always accessible

### Keyboard behavior
All profile list row inputs (`CommitmentRow`, `DebtRow`, `InvestmentRow`, `GoalRow`) include `returnKeyType="done"` and `onSubmitEditing={() => Keyboard.dismiss()}` so the keyboard's Done button works in every field. The profile `ScrollView` wraps its content in `TouchableWithoutFeedback` so tapping any blank area dismisses the keyboard without triggering any action. `keyboardShouldPersistTaps="handled"` ensures pill selectors, type toggles, and the payroll deducted toggle remain tappable while the keyboard is up.

### Inline editing
Edit forms appear inline within their parent modal, not as separate screens. They use the `parchmentDark` background (`detail.editForm` style) to visually separate the edit state from the list. Cancel always restores previous state without saving.
