# Current UI/UX Audit

Audited on 11 November 2026 at commit `4f206e1`, before the redesign.
Screenshots: `docs/screenshots/before/` (dark theme, 375 × 812, demo data,
rendered through a local no-auth harness because the real screens need a
Supabase login).

## Stack (verified from the code)

| Area | Finding |
|---|---|
| Framework | Next.js 16.3 App Router, React 19.2, TypeScript |
| Styling | Tailwind CSS v4, semantic theme tokens in `src/app/globals.css` (light/dark via `html[data-theme]`) |
| Component library | None; hand-written components in `src/components/` (≈50 files), icons from `lucide-react` |
| Routing | Single route `/` (`src/app/page.tsx`). Tabs are React state (`activeTab`) and all tab views stay mounted, toggled with `display` |
| Data | `DataService` facade (`src/lib/data-service.ts`): Supabase when signed in, `localStorage` fallback; `NuviaCache` stale-while-revalidate |
| Auth | Supabase email + OTP through `/api/auth/*`; `AuthProvider` context |
| AI | Gemini via `/api/ai/*` routes (meal photo/text analysis, exercise and routine parsing, coach) |
| Training logic | `AdaptiveTrainingEngine`, `FitnessContextService` (weekly schedule, missed-session adaptation) |
| Exercise data | `EXERCISE_CATALOG`: 182 exercises with target muscle, equipment tags, instructions, YouTube IDs |
| Tests | No test runner. Two manual scripts in `scripts/` |

## Existing functionality to preserve

- Meal logging by photo, text and natural language, with AI breakdown, meal details and delete.
- Exercise logging by text/AI and from routines.
- Routines: AI paste, manual builder, edit, duplicate, delete, scheduled days.
- Active workout: elapsed timer, set logging (reps, weight), rest timer,
  exercise replace, video demo, completion modal, session persisted across
  reloads (`localStorage`).
- Weekly schedule, missed-session adaptation cards and weekly report.
- Daily summary, goals, macro targets, streak calendar and badges.
- Profile: about you, physique selector, AI personalisation, daily plan,
  appearance (light/dark/system), sign out.
- PWA install banner, service worker, keep-alive cron.

## Problems found

### Visual hierarchy
1. **Home opens with calories, not training.** The first screen is a
   nutrition budget (`home-dark.jpg`); today's workout is below three
   sections. For a training app the main question ("what do I do today?") is
   answered last.
2. **Every section has equal weight.** Calories, macros and activity use the
   same uppercase label + big number + thin bar, so nothing leads.
3. **No sense of the week.** Weekly progress exists in the Activity tab's day
   strip but not on Home.

### Consistency
4. **Two greens and many accents.** `#30D158` and `#28B84D` for actions plus
   blue, orange, red, pink and purple used decoratively (icon tiles, badges),
   so colour no longer signals importance.
5. **Radius drift.** 12, 16, 20, 24, 28 and 36 px radii appear on similar
   cards; cards nest inside cards (`profile-dark.jpg`: Goal Progress panel
   contains three more rounded boxes).
6. **Typography relies on the system stack** with ad-hoc sizes (10, 11, 12,
   13, 14 px) and many uppercase labels, which flattens hierarchy.

### Navigation
7. **Bottom bar: Today · Meals · + · Activity · Profile.** No home for
   progress/analytics and no direct route to the exercise catalog; the
   catalog is reachable only inside the add-exercise flow.
8. **Profile occupies a primary tab** although it is visited rarely.

### Missing screens
9. **No progress analytics.** History exists only as a list of logs.
   Workouts per week, training time, volume lifted and personal records are
   computable from `exercise_logs[].ai_analysis.actual_performance` but never
   shown.
10. **No browsable exercise library** despite a 182-exercise catalog with
    muscles, equipment and instructions.

### Interaction
11. **Active workout**: last-session values are fetched
    (`getExercisePerformanceHistory`) but shown only as a text summary, not
    beside each set.
12. **Activity tab state on first load** (`activity-dark.jpg`): the adaptation
    card fades in over a blank area, so the screen looks broken for ~1 s.

### States
13. Empty states are plain grey sentences ("No meals logged yet today.") with
    no action.
14. Loading is shown inconsistently: some sections use skeletons, others
    render zeros (`0 kcal`) that look like real data.

### Responsiveness
15. Desktop shows a 448 px phone frame centred on the page. Acceptable for a
    mobile-first PWA, but it is not a real desktop layout. Not changed in this
    pass (see REDESIGN_REPORT.md, unresolved items).

## Components

| Keep as is (restyle via tokens) | Improve | Add |
|---|---|---|
| `NuviaBottomSheet`, all modals | `Navigation` (new IA) | `ProgressView` |
| `ExerciseThumbnail`, `ExerciseVideoModal` | `DashboardView` (header, week card, stats, order) | `ExerciseLibraryView` |
| `BodyMuscleMap`, `MacroDonutChart` | `ExerciseListView` (Library tab) | `ui/` primitives: `SectionHeader`, `StatTile`, `ProgressRing`, `BarChart`, `SegmentedControl`, `Chip`, `EmptyState` |
| Profile sections, onboarding, landing | `RoutineDetailView` active workout (previous values per set, docked rest timer) | |

## Screens to redesign

Home, Workout (incl. Library), Active workout, Progress (new), bottom
navigation. Nutrition, Profile, Goals and Summary get the new tokens and
typography without structural change.
