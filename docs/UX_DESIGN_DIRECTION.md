# Nuvia Design Direction

Follows from `UX_RESEARCH.md` (findings H1–H7, W1–W6, F1–F5, O1–O5) and
`CURRENT_UI_UX_AUDIT.md`.

## Positioning

Nuvia is a training **and** nutrition tracker with an AI coach. The redesign
makes training the spine of the app (as the brief asks) while keeping every
nutrition and coaching feature that already works.

One sentence: *Hevy's speed when you are lifting, WHOOP's "today at a glance",
Fitbod's sense of what to train, Oura's restraint with data.*

## Information architecture

The brief proposes Home / Workout / Progress / Library / Profile. Nuvia also
has meal logging, which the brief's list has no place for, and a centre "+"
logging button. Adapted structure:

| Slot | Destination | Contains |
|---|---|---|
| 1 | **Home** | Greeting, week at a glance, today's workout, today's nutrition, stats, recent activity |
| 2 | **Workout** | Today · Routines · **Library** · History, and the active workout |
| centre | **+** | Log meal / Log activity (unchanged) |
| 3 | **Nutrition** | Meals list and day filter (existing Meals tab) |
| 4 | **Progress** | New analytics screen |
| header | **Profile** | Avatar at top-right of Home and Progress; settings, goals, appearance |

Why Library sits inside Workout and Profile behind the avatar: five tabs plus a
centre button does not fit a phone bar, and dropping Nutrition would remove a
working feature. Hevy reaches its exercise library from the workout flow (H6);
WHOOP and Oura both keep profile out of the tab bar (W4).

Secondary screens (Daily Summary, Goals, AI Coach) keep their existing entry
points.

## Colour

Dark is the reference theme and uses the brief's tokens exactly. Light mode
(added earlier) is kept and re-derived from the same hues.

| Token | Dark | Light | Use |
|---|---|---|---|
| `app` | `#111315` | `#F4F5F2` | Page background |
| `surface` | `#181C20` | `#FFFFFF` | Secondary background, sheets |
| `card` | `#202428` | `#FFFFFF` | Cards |
| `elevated` | `#292F34` | `#E9EBE7` | Inputs, chips, pressed states |
| `elevated-2` | `#33393D` | `#DADDD8` | Borders, tracks |
| `fg` | `#F4F5F2` | `#111315` | Primary text |
| `fg-soft` | `#D5D9D6` | `#33393D` | Emphasised secondary text |
| `muted` | `#A1A8AB` | `#5B6367` | Secondary text |
| `subtle` | `#8A9397` | `#677074` | Muted text, placeholders (raised from the brief's `#737C80` to reach 4.5:1 on cards) |
| `accent` | `#C5F36A` | `#B4E64A` | Primary buttons, active nav, progress |
| `accent-hover` | `#B4E64A` | `#A3D63A` | Hover/pressed accent |
| `on-accent` | `#111315` | `#111315` | Text on accent fills |
| `green-ink` (accent text) | `#C5F36A` | `#4A6B0A` | Accent-coloured text and icons |
| success | `#8DDC91` | `#2E7D32` | |
| warning (`warn`) | `#F2BE65` | `#9A6500` text / `#F2BE65` fill | |
| error (`danger`) | `#F07878` | `#C62828` text / `#F07878` fill | |
| info | `#8FB8F0` | `#1F5FBF` text / `#8FB8F0` fill | Activity credit, links |

Rules
- Lime is for the primary action on a screen, the active tab, progress fills
  and one headline number. Not for borders on every card (W6).
- Text on lime is always `#111315` (contrast ≈ 14:1). Lime text on `#111315`
  ≈ 14:1; `muted` on `card` ≈ 6.4:1; `subtle` on `card` ≈ 3.7:1, so `subtle`
  is used only for non-essential labels of 12 px and above.
- In light mode lime is too pale for text, so accent *text* switches to a dark
  olive (`#4A6B0A`, ≈ 6:1 on white) while accent *fills* stay lime.
- Status colours appear only where there is a status.

## Typography

Manrope (variable, self-hosted through `next/font`), falling back to the
system UI font.

| Role | Size / weight |
|---|---|
| Screen title | 28 / 800, tight tracking |
| Section label | 11 / 700, uppercase, +0.08em, `muted` |
| Card title | 15–16 / 700 |
| Body | 13–14 / 500 |
| Stat numeral | 28–40 / 800, tabular figures |
| Meta | 11–12 / 500, `muted` |

Numbers use `tabular-nums` so timers and tables do not jitter (H1, H4).

## Shape, spacing, motion

- Radii: 12 (inputs, chips, rows), 20 (cards), full (pills, avatar). Large
  36 px radii and nested rounded cards are removed.
- Spacing scale: 4 / 8 / 12 / 16 / 24. Page gutter 20.
- Borders: 1 px hairline at 6–8% foreground. Shadows only on floating elements
  (centre button, sheets).
- Motion: sheet slide and fade only. `prefers-reduced-motion` disables them.

## Components

New shared primitives in `src/components/ui/`:

- `SectionHeader` – uppercase label plus optional action link.
- `StatTile` – label, numeral, unit, one line of context (O2).
- `ProgressRing` – thin ring with centred numeral (W1).
- `BarChart` / `LineChart` – dependency-free SVG, labelled axes, empty state (O3).
- `SegmentedControl` – range and view switchers.
- `Chip` – filter chips for muscles and equipment (F4).
- `EmptyState` – icon, title, one line, optional action.

Existing components kept and restyled through tokens: `NuviaBottomSheet`,
`ExerciseThumbnail`, `BodyMuscleMap`, `MacroDonutChart`, all modals.

## Screen plans

**Home** (W1, W2, O4, F1)
1. Header: date, "Good morning, {name}", streak pill, avatar.
2. This week: workouts done vs weekly goal as a ring, one guidance sentence,
   7-day bar strip of active minutes.
3. Today's workout: routine name, target muscles, exercise count, estimated
   minutes, **Start workout**. Rest-day and "up next" variants preserved.
4. Schedule-adaptation card (existing) when action is needed.
5. Today's nutrition: calories eaten / remaining with one bar, three macro
   bars, "Snap food" shortcut.
6. Stats: body weight, workouts (all time), training time, streak.
7. Natural-language logger and suggestions (existing).
8. Recent activity: today's workouts and meals (existing lists).

**Workout** (H6, F1, F2): segmented Today · Routines · Library · History.
Routine cards show name, muscles, exercise count, estimated time, last
performed, and Start.

**Active workout** (H1–H5): sticky header (timer, sets done, Finish), set rows
with last-time values and a large tick, docked rest timer with ±15 s and Skip.

**Library** (F2, F4): search, muscle chips, equipment chips, uniform exercise
rows, detail sheet with muscles, instructions and video.

**Progress** (O1, O3, H7, W3): range switcher (4 weeks / 12 weeks / 6 months);
workouts per week; training time; volume lifted; personal records; muscle
distribution; body weight (current vs target, with an honest empty state for
history, which is not stored); nutrition adherence.

**Profile**: unchanged structure, restyled; Appearance switch retained.

## Explicitly not built

- Wearable scores (strain, recovery, sleep, readiness).
- Per-muscle recovery percentages.
- Social features.
- Body-weight and body-measurement history charts: Nuvia stores only the
  current weight. The Progress screen says so instead of drawing a fake line.
