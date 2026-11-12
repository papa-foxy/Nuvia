# Redesign Report

Work done on 11 and 12 November 2026, on top of commit `4f206e1`.
Status: complete in the working tree, **not committed**.

## What changed

- **Design system**: new palette (the brief's dark tokens plus a derived light
  theme), lime accent via `accent` / `on-accent` tokens, status tokens (`warn`,
  `danger`, `info`, `success`), Manrope via `next/font`, a reduced-motion rule.
  Files: `src/app/globals.css`, `src/app/layout.tsx`.
- **Navigation**: Home · Workout · + · Nutrition · Progress. Profile opens
  from the avatar in screen headers. `src/components/Navigation.tsx`.
- **Home**: greeting header with streak; **calories today first** (intake vs
  target, no net calories; changed 12 Nov at the owner's request), then a
  "This week" ring with a 7-day strip,
  today's workout moved above nutrition, a stats grid.
  `DashboardView.tsx`, `home/TrainingOverview.tsx`, `ScreenHeader.tsx`.
- **Progress (new)**: 4-week, 12-week and 6-month ranges; workouts, time and
  volume chart; personal records; sets per muscle group; body weight with an
  honest empty state. `ProgressView.tsx`, `lib/training-stats.ts`.
- **Library (new)**: search, muscle and equipment filters, detail sheet and
  video. A tab inside Workout. `ExerciseLibraryView.tsx`.
- **Active workout**: larger steppers, weight input and tick; last session's
  weight × reps shown under each set number; rest timer docked above the
  bottom bar with −15 / +15 / Skip. `RoutineDetailView.tsx`.
- **Shared primitives**: `src/components/ui/index.tsx` (Card, SectionHeader,
  StatTile, ProgressRing, ProgressBar, BarChart, SegmentedControl, Chip,
  EmptyState, Skeleton).
- Landing, onboarding and splash use the tokens and are pinned to dark.
- Desktop/tablet frame: border and radius aligned with the new tokens.
- Service worker cache bumped to v10.

## Preserved

Auth, the Supabase/localStorage data layer, API routes, meal and exercise
logging, routines, adaptive schedule, goals, summary, profile and PWA
behaviour. No dependencies added. No backend changes.

## Fixes made during QA (12 November)

- `globals.css` held two copies of the theme block (a script missed its
  anchor because of Windows line endings). Rebuilt as a single copy; the app
  had been rendering the correct, later copy.
- The `subtle` text colour failed WCAG AA for small text (3.7:1 on cards in
  dark). Raised to `#8A9397` (dark) and `#677074` (light); now ≥ 4.5:1.

## Test results

- `tsc --noEmit`: passes.
- `next build`: succeeds.
- ESLint: 131 errors before and after; no new errors introduced (all
  remaining errors pre-date the redesign).
- Browser checks, using local demo data through a no-auth harness that is not
  in the repo:
  - **Contrast scan** of every visible text element on Home, Nutrition,
    Workout, Progress, Profile, Goals, Summary and AI Coach in **dark and
    light**: no text below 4.5:1 (3:1 for large text) after the fix above.
    Gradient backgrounds are skipped by the scan.
  - **Modals scanned**: log (+) sheet, Add Meal, Add Exercise, routine builder,
    AI paste, routine editor, streak calendar. No contrast failures.
  - **Workout flow**: start routine, add set, remove set, enter weight, tick a
    set (rest timer starts), Skip, Finish, Save. The log was stored with the
    set data and the in-progress session was cleared. Starting the routine
    again showed "20×10" beside set 1. Progress then listed the new personal
    record and the workout count rose by one.
  - **Progress controls**: all three ranges and all three metrics switch
    correctly.
  - **Library**: search, muscle and equipment filters, empty state and
    detail sheet.
  - **Profile edit**: Save Changes stored the new weight.
  - **Layout**: no horizontal overflow at 320, 375, 768 and 1440 px; the
    bottom bar stays inside the frame at tablet and desktop widths.
- Screenshots: `docs/screenshots/before/`, `docs/screenshots/after/`.

## Not verified

- The real signed-in app with Supabase data, and a real phone (including the
  iOS home-screen mode).
- Visual review of the screens and modals after 11 November: the Browser
  pane was hidden, so checks on 12 November were automated (text, DOM and
  contrast), not screenshots.
- Meal photo analysis and other AI calls (they need the live API).

## Known limitations (by design)

- Desktop and tablet show a centred phone-width frame rather than a sidebar
  layout. The bottom sheets are positioned relative to the bottom bar, so a
  sidebar would need those reworked.
- Library filters use the catalog's own `target_muscle` and free-text
  `equipment`. The 91-exercise catalog has no per-exercise step lists and
  does not split legs into quads, hamstrings, glutes and calves.
- Body weight has no history chart because only the current weight is stored.

## Changes on 12 November (owner feedback)

- **Calories first, intake only.** Home opens with a Calories today card:
  remaining = target − eaten. Exercise calories are no longer subtracted on
  Home or in the AI coach's replies.
- **No duplicate sections.** Each piece of information has one screen (see
  UX_DESIGN_DIRECTION.md). Removed from Home: This week, Activity, Your stats,
  schedule-adaptation card, Up next, today's workouts and meals lists. Removed
  from Profile: Goal progress, Daily plan, Long-term progress, Next planned
  workout (replaced by links to Goals and Progress). Deleted the now-unused
  GoalProgressCard, DailyPlanSection, LongTermProgressSection and
  EditTargetsModal.
- **Move a meal to another day** from its details sheet (Yesterday / Today
  shortcuts or any past date). Keeps the time of day; re-syncs both days'
  summaries. Future dates are blocked.
- **One shared bottom sheet.** NuviaBottomSheet now uses the same slide-up and
  fade as the date picker on every open, slides down on every close, and
  renders into the app frame. The date picker and the + Log Entry sheet both
  use it.
- **Fixes:** date picker no longer overlaps the bottom bar; meal photo title
  readable in light mode.

### Sheets (12 November, later)

- Sheets no longer reach under the iOS status bar: one shared height limit,
  `--sheet-max-h` in globals.css, subtracts the bottom nav, home indicator,
  status bar and a 12px gap (using 100vh in the installed app). Applied to all
  15 bottom sheets and modals.
- The meal details sheet now runs on NuviaBottomSheet. The calendar and the +
  Log Entry sheet use the same full style (grab handle, header, close button,
  drag down to dismiss).
- Only one sheet can be open: opening a sheet closes the current one
  instantly, so they never stack.

- Fixed a gap between sheets and the bottom nav in the installed iOS app:
  `.app-shell` now has `transform: translateZ(0)`, which makes it the
  containing block for all fixed-position sheets, backdrops and toasts, so
  they line up with the nav (both use the 100vh app shell).
- Redesigned the "Move to another day" panel: two day cards (current day
  marked), a full-width date field, and one confirm button naming the target
  day ("Move to Thu, Nov 12"; disabled with a reason for invalid dates).
- Profile's "Manage Memory" (AI personalization) and "Privacy & Data
  Security" pop-ups now use the shared NuviaBottomSheet, with theme colours
  instead of fixed greys so they are readable in light mode.
- Still hand-built (not yet on the shared sheet): Add Meal, Add Activity,
  Meal Result, Day Details, Streak Calendar, Exercise Replace, Routine Edit,
  Manual Routine, Exercise Video and the Goals edit sheets. They already
  use the shared height limit and app-shell positioning.

## adidas Running via Apple Health (12 November)

adidas closed its partner API on 30 June 2025, so runs reach Nuvia through
Apple Health and an iPhone Shortcut automation.

- `POST /api/health-sync/workouts` — accepts workouts from the Shortcut,
  authenticated with a personal key (`Authorization: Bearer <key>`). Parses
  dates, durations and distances leniently (src/lib/health-workout-parse.ts),
  estimates calories from body weight when Health sends none, logs each
  workout on the day it started, and skips duplicates (start time + type).
  `?dryRun=1` reports what would be imported without saving.
- `GET /api/health-sync/token` — returns the signed-in user's key and URL.
  Keys are HMAC-signed user ids (src/lib/health-sync-token.ts): nothing is
  stored, and a key can only add workouts to its own account. Signing secret:
  `HEALTH_SYNC_SECRET`, or derived from `SUPABASE_SERVICE_ROLE_KEY`.
- Profile → "Connect adidas Running": key, import URL, test URL and
  step-by-step Shortcut setup.
- Tested: parser (17 cases), endpoint auth/validation and dry-run parsing.
  Not tested: a real insert and the key flow with a signed-in session (needs
  the deployed app and a real account).
