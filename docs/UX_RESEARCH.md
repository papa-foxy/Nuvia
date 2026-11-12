# UX Research: Hevy, WHOOP, Fitbod, Oura

Research date: 11 November 2026. Method: each product's official site and help
centre was opened in a browser; page text was read and the official product
screenshots shown on those pages were inspected. Nothing here comes from using
the native apps themselves (they need accounts and, for WHOOP and Oura,
hardware), so interaction details are limited to what the official pages show
or describe.

Third-party screenshots are **not** copied into this repo (they are the
vendors' copyrighted material). Each finding links to the page where the
evidence can be seen.

---

## 1. Hevy: workout logging

Sources
- https://www.hevyapp.com/features/track-workouts/
- https://www.hevyapp.com/features/workout-rest-timer/
- https://www.hevyapp.com/features/
- https://www.hevyapp.com/

| # | Observed pattern | Evidence | Why it works | Adaptation for Nuvia |
|---|---|---|---|---|
| H1 | **Set table**: one row per set with columns SET, PREVIOUS, KG, REPS and a tick. | Hero phone on the track-workouts page shows "Floor Press (Dumbbell)" with exactly these columns. | Logging a set is two number entries and one tap; the table is scannable mid-workout. | Nuvia's active workout already records sets, reps and weight. Keep one row per set, show last session's values beside the inputs, and make the tick the largest target in the row. |
| H2 | **Completed sets change colour** (whole row tinted green, tick filled). | Same screenshot: completed rows are green, the pending row is grey. | State is readable from arm's length without reading numbers. | Tint completed rows with the accent at low opacity and fill the tick. Never rely on colour alone: the tick icon also changes. |
| H3 | **Previous values prefilled**. "When you add an activity you've done before, the number of sets, the weight, and the reps you've done previously are also added." | Track-workouts page, section 2 and 5. | Removes typing and gives a target to beat (progressive overload). | Nuvia has `getExercisePerformanceHistory`; surface it per set as "Last: 55 kg × 10". |
| H4 | **Automatic rest timer** starts when a set is ticked; docked at the bottom with a large countdown and −15 / +15 / Skip. Per-exercise duration, 5 s to 5 min. | Rest-timer page text; hero phone shows "01:03" with −15, +15, Skip. | The timer needs no navigation and no separate start action. | Nuvia has a rest timer in `RoutineDetailView`. Dock it above the bottom edge, large digits, ±15 s and Skip. |
| H5 | **Session header**: stopwatch, sets completed and volume at the top, Finish top-right. | Track-workouts text: "stopwatch on the top left… number of sets you've completed and your volume load… tap Finish on the top right". | Progress and exit are always in the same place. | Sticky header in the active workout: elapsed time, sets done, Finish. |
| H6 | **Routines as reusable templates**, started from the Workout tab; "Start Empty Workout" at the top. | Track-workouts sections 1 and 2. | Separates planning from doing. | Nuvia already has routines plus AI/manual creation; keep, and present routine cards with one primary "Start" action. |
| H7 | Feature set is grouped as logging, progress, social. Progress includes sets per muscle group per week, consistency and streak, exercise performance. | Features index page. | Tells us which analytics lifters expect. | Feeds the Progress screen: weekly workouts, volume, personal records, muscle distribution. |

Not to copy: Hevy's blue-on-white branding, its social feed (Nuvia has no social
data), set types / supersets / RPE (not in Nuvia's data model).

## 2. WHOOP: dashboard and performance analytics

Sources
- https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/
- https://whoop.my.site.com/whoopsupport/s/article/Navigating-the-WHOOP-Mobile-App

| # | Observed pattern | Evidence | Why it works | Adaptation for Nuvia |
|---|---|---|---|---|
| W1 | **Three dials at the top** (Sleep, Recovery, Strain): big number inside a thin ring, small uppercase label under it, on a near-black background. | Article header image shows 74% / 85% / 14.2 dials. | Three numbers answer "how am I today?" before any scrolling. | Nuvia's equivalents come from real data: workouts this week vs goal, calories vs target, active minutes vs target. Thin rings, large numerals, uppercase micro-labels. |
| W2 | **Single scrolling home** in fixed sections: dials → My Day → My Plan → My Dashboard. | Home-screen article, "What's on the WHOOP Home screen?". | Predictable order; today first, trends last. | Home order: this week → today's workout → today's nutrition → stats → recent activity. |
| W3 | **Tiles open trend views** with weekly / monthly / six-month ranges. | Same article: "Tap any tile… switch between weekly, monthly and six-month trends." | Keeps the home screen shallow; depth is one tap away. | Home stat tiles link to the Progress screen; Progress has 4-week / 12-week / 6-month ranges. |
| W4 | **Streak next to the profile icon**. | Both sources. | A tiny, always-visible motivator. | Show the existing streak beside the avatar in the Home header. |
| W5 | **Action (+) button in the bottom bar** for starting an activity or journalling. | Navigation article. | One global entry point for logging. | Nuvia already has a centre "+" for Log Meal / Log Activity. Keep it. |
| W6 | Colour carries meaning (green / yellow / red recovery bands); the rest of the UI is neutral. | Home-screen article. | Colour is reserved for status, so it is noticed. | Lime accent for primary/progress only; success, warning, error tokens for status. |

Not to copy: Strain, Recovery and Sleep scores. They need wearable heart-rate
data Nuvia does not have. No fabricated readiness scores.

## 3. Fitbod: planning and exercise discovery

Sources
- https://fitbod.me/
- https://help.fitbod.me/hc/en-us/articles/34336407191191-My-Plan
- https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery

| # | Observed pattern | Evidence | Why it works | Adaptation for Nuvia |
|---|---|---|---|---|
| F1 | **"Target muscles" strip** above the exercise list: small muscle illustrations with a percentage badge each. | Home-page hero phone: Chest 100%, Back 100%, Biceps 80%, Shoulders 60%. | Explains *why* this workout before listing exercises. | Workout cards and today's-workout card list target muscles as chips; the existing body map stays in routine detail. |
| F2 | **Exercise rows**: square photo thumbnail, name, then one grey line "3 sets • 5 reps • 125 lb", overflow menu at right. | Same hero phone ("Barbell Bench Press", "Dumbbell Bent Over Row"). | Dense but calm: one strong line, one quiet line. | Standard exercise row/card across Library, routine detail and active workout: thumbnail, name, one meta line. |
| F3 | **Plan built from goal, equipment/location, workouts per week, duration, experience.** | My Plan article. | Few inputs, strong personalisation. | Nuvia's onboarding already captures goal, equipment and schedule. Surface them in Profile as editable training preferences. |
| F4 | **Bodyweight-only mode** and equipment lists drive which exercises are offered. | My Plan article. | Discovery respects what the user actually has. | Library gets an equipment filter (catalog has `equipment_tags`), including "Bodyweight". |
| F5 | **Muscle recovery**: per-muscle percentage, heat-map avatar, tap a muscle for its history. | Muscle Recovery article. | Makes rest feel like part of the plan. | Nuvia tracks recently trained muscles (48 h). Show "trained recently" on muscle chips; do not invent recovery percentages. |

Not to copy: Fitbod's coral/pink accent, per-muscle recovery percentages
(needs a fatigue model), gym-location management.

## 4. Oura: minimalist analytics

Sources
- https://support.ouraring.com/hc/en-us/articles/360058599753-How-to-Use-the-Oura-App
- https://support.ouraring.com/hc/articles/360055983614-Using-Trends

| # | Observed pattern | Evidence | Why it works | Adaptation for Nuvia |
|---|---|---|---|---|
| O1 | **Three tabs with distinct time horizons**: Today (now), Vitals (all metrics for a day), My Health (long-term). | How-to article. | Daily and historical information never compete on one screen. | Home = today and this week. Progress = history. No long-term charts on Home. |
| O2 | **Metric cards in a two-column grid, grouped under plain section headings**; each card has a small label, a one-word status in colour, and a large light-weight number. | Vitals screenshot in the how-to article ("Readiness Score · Optimal · 88", "Sleep Score · Good · 84"). | Lots of data, very little ink: no borders, no icons competing with the number. | Stat tiles: label, big number, one quiet line of context. Two-column grid. |
| O3 | **Trend chart header**: latest value large at top-left, the period average smaller beside the chart; day / week / month / year views. | Using Trends article. | The chart always answers "now vs my normal". | Progress charts show the latest period value large and the range average as a secondary figure. |
| O4 | **One headline number with a short sentence of guidance.** | Today screenshot: "88 READINESS — Go get 'em!". | Interprets the data for the user. | Home's weekly card gets one plain-language line ("2 of 4 workouts done. Two more to hit your goal."). |
| O5 | Generous spacing, thin strokes, large radii, restrained colour. | Both screenshots. | Reads as premium. | Spacing scale 4/8/12/16/24, one card radius, hairline borders. |

Not to copy: Readiness/Sleep scores, photographic hero backgrounds, the serif
display face.

---

## Comparison table

| Category | Hevy | WHOOP | Fitbod | Oura |
|---|---|---|---|---|
| Dashboard design | Feed of past workouts; logging is the product | Three dials, then My Day / My Plan / My Dashboard in one scroll | Today's generated workout is the home screen | Headline score plus one sentence, then cards |
| Navigation | Bottom tabs incl. Workout and Profile | Bottom bar: Home, Health, Community, More, plus an Action (+) button | Workout and Body tabs (per help articles) | Three tabs: Today, Vitals, My Health; Trends in a side menu |
| Workout logging | Set table with previous values, tick to complete, auto rest timer | Start an activity from (+); not set-based | Exercise rows with sets • reps • weight | None |
| Analytics | Sets per muscle, consistency/streak, exercise performance, monthly report | Tiles open weekly / monthly / 6-month trends | Muscle recovery heat map, weekly set targets | Trend graphs: latest value large, average beside it, D/W/M/Y |
| Typography | Plain sans; numbers in table cells | Condensed bold numerals, uppercase micro-labels | Bold italic headings, grey meta lines | Light-weight large numerals, small labels |
| Colour palette | White with blue accent, green for completed sets | Near-black; colour only for score bands | Dark navy-grey with coral accent | Very dark blue-grey; teal/blue status words |
| Information hierarchy | Exercise → sets | Scores → today → plan → trends | Target muscles → exercise list | One number → explanation → cards |
| Interaction design | Tick a set, timer starts; ±15 s; swipe to delete | Tap dial or tile to drill in | Tap muscle for history; overflow menu per exercise | Swipe between days; tap card for trend |

Table cells marked "per help articles" are described in text by the vendor but
were not seen in a screenshot.

## What could not be verified

- Live interaction (animation timing, gestures, haptics) in any of the four apps.
- Hevy's bottom-navigation labels and its exercise-library filter UI (described
  in text, not visible in the screenshots that loaded).
- WHOOP's My Plan and My Dashboard layouts beyond the article's description.
- Fitbod's My Plan screen layout (the help article is text-only here).
