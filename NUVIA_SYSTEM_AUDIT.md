# NUVIA COMPLETE SYSTEM AUDIT

---

## 1. Executive Summary

Nuvia is a mobile-first, Apple Health/Fitness-inspired progressive web application (PWA) built with **Next.js (App Router)**, **React 19**, and **Tailwind CSS**. Its core purpose is daily nutrition logging, workout execution, macro and calorie budgeting, and AI-assisted coaching.

Despite utilizing the Next.js App Router structure, Nuvia operates internally as a **Client-Side Single Page Application (SPA)** mounted entirely at `/` (`src/app/page.tsx`). Navigation between views (Today, Meals, Activity, AI Coach, Daily Summary, Goals, Profile) is orchestrated via React state (`activeTab`) with all tab components rendered concurrently using CSS visibility toggling (`display: contents` vs `display: none`). 

Data persistence follows a **hybrid, dual-layer architecture**: if Supabase credentials are provided and the user is authenticated, operations query Postgres directly via `@supabase/supabase-js`; if unauthenticated, offline, or operating as a demo user (`demo-user-001`), all CRUD operations fall back to browser `localStorage` under the single key `'nuvia_storage'`. An in-memory, module-level cache (`NuviaCache`) acts as a stale-while-revalidate layer across tab transitions.

AI capabilities are powered by Google Gemini (via direct REST API calls using `fetch` across four fallback models: `gemini-3.5-flash`, `gemini-3-flash-preview`, `gemini-3.7-flash`, and `gemini-3.5-flash-lite`). AI handles photo/text meal breakdown, natural language exercise parsing, workout routine extraction, and daily coaching recommendations.

---

## 2. Architecture

```text
                                  ┌────────────────────────┐
                                  │      User (PWA/Web)    │
                                  └───────────┬────────────┘
                                              │
                                  ┌───────────▼────────────┐
                                  │ Next.js App Router SPA │
                                  │    (src/app/page.tsx)  │
                                  └───────────┬────────────┘
                                              │
           ┌──────────────────────────────────┴──────────────────────────────────┐
           │                                                                     │
┌──────────▼──────────┐                                               ┌──────────▼──────────┐
│   Auth & State      │                                               │    Active Views     │
│ - AuthContext       │                                               │ - DashboardView     │
│ - NuviaCache (RAM)  │                                               │ - MealsListView     │
│ - activeTab (SPA)   │                                               │ - ExerciseListView  │
└──────────┬──────────┘                                               │ - GoalsView         │
           │                                                          │ - ProfileView       │
           │                                                          │ - AiCoachView       │
           │                                                          │ - DailySummaryView  │
           │                                                          └──────────┬──────────┘
           │                                                                     │
           └──────────────────────────────────┬──────────────────────────────────┘
                                              │
                                  ┌───────────▼────────────┐
                                  │  DataService (Facade)  │
                                  │ (src/lib/data-service) │
                                  └─────┬────────────┬─────┘
                                        │            │
            ┌───────────────────────────┘            └───────────────────────────┐
   [If Supabase Session]                                                 [If Demo / Offline]
            │                                                                    │
┌───────────▼───────────┐                                             ┌──────────▼──────────┐
│    Supabase Client    │                                             │    localStorage     │
│  PostgreSQL + RLS     │                                             │  ('nuvia_storage')  │
└───────────┬───────────┘                                             └─────────────────────┘
            │
            ├──────────────► profiles
            ├──────────────► goals
            ├──────────────► meals & meal_items
            ├──────────────► exercise_logs
            ├──────────────► daily_summaries
            ├──────────────► workout_routines
            ├──────────────► custom_exercises
            └──────────────► ai_recommendations

                                  ┌────────────────────────┐
                                  │ Next.js API Routes     │
                                  │ (/api/ai/*, /api/auth) │
                                  └───────────┬────────────┘
                                              │
                                  ┌───────────▼────────────┐
                                  │   Google Gemini API    │
                                  │ (REST generateContent) │
                                  └────────────────────────┘
```

### Architectural Breakdown

* **Frontend Framework:** Next.js 16.1.6 (Canary) with React 19 and TypeScript.
* **Routing:** URL routing is minimal. The main interface lives at `app/page.tsx`. Sub-routes exist for onboarding (`/onboarding`), privacy (`/privacy`), terms (`/terms`), and backend API endpoints (`/api/auth/*`, `/api/ai/*`). Within `/`, sub-views are switched via internal state `activeTab`.
* **Rendering Architecture:** Exclusively Client-Side Rendering (CSR) via `'use client'`. Server-side data fetching is not utilized for dashboard views.
* **Backend / API Architecture:** Next.js Route Handlers (`src/app/api/...`) act as stateless proxies for Gemini AI calls and Supabase OTP authentication. Data operations bypass Next.js API routes and communicate directly from the browser to Supabase using the browser client (`createBrowserClient`).
* **Supabase Usage:** Authentication (email OTP and Google OAuth) and PostgreSQL persistence with Row-Level Security (RLS).
* **Gemini Usage:** Invoked via server-side Route Handlers (`/api/ai/ai-coach`, `/api/ai/analyze-meal`, `/api/ai/parse-exercise`, `/api/ai/parse-routine`).
* **Storage:** Primary: Supabase Postgres. Secondary / Local: Browser `localStorage` key `'nuvia_storage'`. File / Image storage: Images are processed client-side into Base64 JPEG strings and submitted directly to Gemini; food images are not stored permanently in Supabase Storage.
* **Caching:** In-memory, module-level cache (`NuviaCache`) with stale-while-revalidate semantics, 60-second stale time, and 5-minute garbage collection.
* **State Management:** React Context (`AuthContext`) holds `user`, `profile`, `goals`, `todaySummary`, and auth state. Screen-level state is maintained in local component state (`useState`) with callback-based synchronization.
* **PWA Architecture:** Service worker (`public/sw.js`), Web App Manifest (`public/manifest.json`), meta tags for iOS standalone mode, and an installation banner (`PwaInstallBanner.tsx`).
* **Hosting / Deployment Assumptions:** Vercel or standard Node.js server with environment variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY`.
* **External APIs:** Google Gemini REST API (`https://generativelanguage.googleapis.com/v1beta/models/...`), YouTube embedded player (for exercise form video playback).
* **Background / Cron Processing:** None. All daily summaries and streak updates are computed just-in-time on the client when the user opens the application or logs an event.

---

## 3. Routes / Pages

### Discovered Real Routes in App Directory

| Route | File Path | Component | Purpose |
| :--- | :--- | :--- | :--- |
| `/` | `src/app/page.tsx` | `Home` | Master SPA shell hosting all main views (Today, Meals, Activity, Coach, Summary, Goals, Profile). |
| `/onboarding` | `src/app/onboarding/page.tsx` | `OnboardingPage` | New user setup wizard (Age, Sex, Height, Weight, Activity, Goal, Pace, Account). |
| `/privacy` | `src/app/privacy/page.tsx` | `PrivacyPage` | Static privacy policy document. |
| `/terms` | `src/app/terms/page.tsx` | `TermsPage` | Static terms of service document. |
| `/api/ai/ai-coach` | `src/app/api/ai/ai-coach/route.ts` | Route Handler | Gemini-powered coach advice endpoint. |
| `/api/ai/analyze-meal` | `src/app/api/ai/analyze-meal/route.ts` | Route Handler | Gemini multimodal meal image/text nutrition analyzer. |
| `/api/ai/parse-exercise` | `src/app/api/ai/parse-exercise/route.ts` | Route Handler | Gemini natural language exercise logger & MET calculator. |
| `/api/ai/parse-routine` | `src/app/api/ai/parse-routine/route.ts` | Route Handler | Gemini routine parser with catalog fuzzy-matching. |
| `/api/auth/send-otp` | `src/app/api/auth/send-otp/route.ts` | Route Handler | Sends 6-digit email OTP via Supabase Auth Admin. |
| `/api/auth/verify-otp` | `src/app/api/auth/verify-otp/route.ts` | Route Handler | Verifies email OTP and exchanges for a Supabase session. |

---

### In-App SPA Surfaces (Sub-Views of `/`)

#### 1. Today / Dashboard
* **Component:** `src/components/DashboardView.tsx`
* **Purpose:** Core home screen showing calorie budget, net calories, macro rings, daily streak, today's scheduled workout card, and quick logging buttons.
* **Main Data:** `DailySummary`, `Meal[]` (today), `ExerciseLog[]` (today), `WorkoutRoutine[]`, `UserProfile`, `UserGoals`.
* **Main Actions:** Quick meal log (photo/text), quick exercise log, start scheduled workout, open streak modal, navigate to full Summary.
* **Navigation To:** Meals tab (`meals`), Activity tab (`exercise`), Goals view (`goals`), AI Coach (`coach`), Summary (`summary`).
* **Dependencies:** `AuthContext`, `DataService`, `NuviaCache`, `calculator.ts`, `calorie-calculator.ts`.

#### 2. Meals
* **Component:** `src/components/MealsListView.tsx`
* **Purpose:** Daily meal log browser with macro totals, meal cards grouped by meal type (Breakfast, Lunch, Dinner, Snack), and photo analysis modal.
* **Main Data:** `Meal[]` for selected date, `DailySummary`.
* **Main Actions:** Add meal via photo, text, or manual inputs; edit meal; delete meal; view food items breakdown.
* **Navigation To:** Meal details modal, Add meal modal.
* **Dependencies:** `DataService`, `NuviaCache`, `AddMealModal`, `MealDetailsModal`.

#### 3. Activity
* **Component:** `src/components/ExerciseListView.tsx`
* **Purpose:** Hub for fitness tracking: today's activity, workout routine plans, workout execution, exercise catalog library, and history.
* **Main Data:** `ExerciseLog[]` (today & history), `WorkoutRoutine[]`, `custom_exercises`, in-memory `EXERCISE_CATALOG`.
* **Main Actions:** Start workout, manual exercise log, build routine, import routine via AI, filter library by muscle group, watch YouTube form demo.
* **Navigation To:** `RoutineDetailView`, `RoutineEditView`, `PasteAiRoutineModal`, `AddExerciseModal`, `ExerciseVideoModal`.
* **Dependencies:** `DataService`, `NuviaCache`, `exercise-catalog.ts`, `activity-utils.ts`, `BodyMuscleMap.tsx`.

#### 4. Workout Execution
* **Component:** `src/components/RoutineDetailView.tsx` (nested under Activity)
* **Purpose:** Live workout session tracker with rest countdown timer, set-by-set weight and rep logging, set completion checkboxes, and live calories burned calculation.
* **Main Data:** `WorkoutRoutine`, `sessionSets: Record<string, LoggedSet[]>`, exercise catalog metadata.
* **Main Actions:** Check off sets, adjust weight/reps, adjust rest timer, finish workout.
* **Navigation To:** Completion modal, return to Activity or Today.
* **Dependencies:** `DataService.addExerciseLog`, `calculateWorkoutCalories`.

#### 5. Goals
* **Component:** `src/components/GoalsView.tsx`
* **Purpose:** Configure primary fitness goal (lose weight, maintain, build muscle), target weight, weekly pace, recalculate calorie/macro targets, and adjust manual macro splits.
* **Main Data:** `UserGoals`, `UserProfile`.
* **Main Actions:** Change goal type, adjust weekly pace slider, trigger Recalculate, manually edit protein/carb/fat targets, save goals.
* **Navigation To:** Return to Previous View.
* **Dependencies:** `DataService`, `calculator.ts`, `AuthContext`.

#### 6. Profile
* **Component:** `src/components/ProfileView.tsx` & `src/components/profile/AboutYouSection.tsx`
* **Purpose:** Manage personal parameters (age, sex, height, weight, activity level), view account info, switch to demo mode, export/import data, sign out.
* **Main Data:** `UserProfile`, `UserGoals`, authentication state.
* **Main Actions:** Inline edit biometric parameters, trigger auto-recalculation of targets, toggle demo mode, backup data, sign out.
* **Navigation To:** Goals view (`goals`), Onboarding (`/onboarding`).
* **Dependencies:** `AuthContext`, `DataService`, `calculator.ts`, `NuviaBottomSheet`.

#### 7. AI Coach
* **Component:** `src/components/AiCoachView.tsx`
* **Purpose:** Conversational chat interface for personalized fitness and nutrition guidance.
* **Main Data:** Message history, daily nutrition and activity context payload.
* **Main Actions:** Send message, tap suggested prompt chips, view formatted markdown advice.
* **Navigation To:** None (embedded tab).
* **Dependencies:** `/api/ai/ai-coach`, `AuthContext`.

#### 8. Daily Summary
* **Component:** `src/components/DailySummaryView.tsx`
* **Purpose:** Historical calendar day browser showing calorie breakdown, macro targets vs actuals, meal list, and exercise list for any past date.
* **Main Data:** `DailySummary`, `Meal[]`, `ExerciseLog[]` for selected date.
* **Main Actions:** Navigate calendar dates, inspect individual logged items.
* **Navigation To:** DayDetailsModal, StreakCalendarModal.
* **Dependencies:** `DataService`, `NuviaCache`, `DateFilterBar`.

---

## 4. Database Audit

The authoritative schema is defined in `fitness_app_schema.sql` and mirrored in `DataService` (`src/lib/data-service.ts`).

### Tables Schema & Usage

#### 1. `profiles`
* **Purpose:** Stores user demographic and biometric parameters.
* **Key Columns:**
  * `id` (`UUID`, Primary Key, references `auth.users.id` on delete cascade)
  * `email` (`TEXT`)
  * `full_name` (`TEXT`)
  * `avatar_url` (`TEXT`)
  * `age` (`INTEGER`)
  * `sex` (`TEXT`: `'male'` | `'female'` | `'other'`)
  * `height_cm` (`NUMERIC(5,2)`)
  * `weight_kg` (`NUMERIC(5,2)`)
  * `activity_level` (`activity_level_enum`: `'sedentary'`, `'light'`, `'moderate'`, `'very_active'`, `'extra_active'`)
  * `goal` (`fitness_goal_enum`: `'lose_weight'`, `'maintain'`, `'build_muscle'`, `'improve_fitness'`, `'increase_energy'`)
  * `dietary_preference` (`TEXT`: Stores dietary notes, but **also co-opted to store goal pace** as `"pace:0.5"`)
  * `created_at`, `updated_at` (`TIMESTAMPTZ`)
* **Relationships:** Parent to `goals`, `meals`, `exercise_logs`, `daily_summaries`, `workout_routines`, `custom_exercises`.
* **Written by:** `OnboardingWizard`, `AboutYouSection.tsx`, `ProfileView.tsx`, `DataService.saveProfile`.
* **Read by:** `AuthContext`, `DashboardView`, `GoalsView`, `AiCoachView`, `ProfileView`.
* **RLS:** `auth.uid() = id` (Users can select, insert, and update their own profile).

#### 2. `goals`
* **Purpose:** Stores calculated nutritional and fitness targets.
* **Key Columns:**
  * `id` (`UUID`, Primary Key)
  * `user_id` (`UUID`, references `profiles.id`)
  * `calorie_target` (`INTEGER`)
  * `protein_target` (`INTEGER` in grams)
  * `carbohydrate_target` (`INTEGER` in grams)
  * `fat_target` (`INTEGER` in grams)
  * `water_ml_target` (`INTEGER`)
  * `exercise_minutes_target` (`INTEGER`)
  * `target_weight_kg` (`NUMERIC(5,2)`)
  * `created_at`, `updated_at` (`TIMESTAMPTZ`)
* **Written by:** `OnboardingWizard`, `GoalsView.tsx`, `ProfileView.tsx`, `DataService.saveGoals`.
* **Read by:** `AuthContext`, `DashboardView`, `GoalsView`, `ProfileView`, `AiCoachView`.
* **RLS:** `auth.uid() = user_id`.

#### 3. `meals` & `meal_items`
* **Purpose:** Master-detail records of consumed meals and their itemized ingredients.
* **Key Columns (`meals`):**
  * `id` (`UUID`, Primary Key)
  * `user_id` (`UUID`, references `profiles.id`)
  * `meal_type` (`TEXT`: `'breakfast'`, `'lunch'`, `'dinner'`, `'snack'`)
  * `name` (`TEXT`)
  * `description` (`TEXT`)
  * `total_calories` (`INTEGER`)
  * `total_protein` (`NUMERIC(6,2)`)
  * `total_carbs` (`NUMERIC(6,2)`)
  * `total_fat` (`NUMERIC(6,2)`)
  * `image_url` (`TEXT`, optional)
  * `confidence_score` (`NUMERIC(3,2)`)
  * `ai_analysis` (`JSONB`: stores Gemini assumptions, raw breakdown, and notes)
  * `logged_at` (`TIMESTAMPTZ`, default `now()`)
* **Key Columns (`meal_items`):**
  * `id` (`UUID`, Primary Key)
  * `meal_id` (`UUID`, references `meals.id` on delete cascade)
  * `name` (`TEXT`)
  * `estimated_quantity` (`NUMERIC(8,2)`)
  * `unit` (`TEXT`)
  * `calories` (`INTEGER`)
  * `protein_g`, `carbs_g`, `fat_g` (`NUMERIC(6,2)`)
  * `confidence` (`TEXT`)
* **Written by:** `AddMealModal.tsx`, `DataService.addMeal`.
* **Read by:** `MealsListView`, `DashboardView`, `DailySummaryView`, `DayDetailsModal`.
* **RLS:** `auth.uid() = user_id` for `meals`; join check on `meals.user_id` for `meal_items`.

#### 4. `exercise_logs`
* **Purpose:** Single table for **all physical activity**, including quick cardio logs, manual entries, and **completed workout sessions**.
* **Key Columns:**
  * `id` (`UUID`, Primary Key)
  * `user_id` (`UUID`, references `profiles.id`)
  * `exercise_type` (`TEXT`: exercise or routine title)
  * `duration_minutes` (`INTEGER`)
  * `calories_burned` (`INTEGER`)
  * `intensity` (`TEXT`: `'low'`, `'moderate'`, `'high'`)
  * `distance_km` (`NUMERIC(6,2)`)
  * `description` (`TEXT`)
  * `source` (`TEXT`: `'routine'` | `'manual'` | `'ai'`)
  * `confidence` (`TEXT`)
  * `ai_analysis` (`JSONB`: When `source = 'routine'`, stores `routine_id`, `actual_performance` array of completed sets/reps/weights, executed exercise count, etc.)
  * `logged_at` (`TIMESTAMPTZ`)
* **Written by:** `RoutineDetailView.tsx` (upon finishing workout), `AddExerciseModal.tsx`, `DataService.addExerciseLog`.
* **Read by:** `ExerciseListView`, `DashboardView`, `DailySummaryView`, `ActivityDetailsModal`.
* **RLS:** `auth.uid() = user_id`.

#### 5. `workout_routines`
* **Purpose:** Multi-day workout templates and user routine plans.
* **Key Columns:**
  * `id` (`TEXT` or `UUID`, Primary Key)
  * `user_id` (`UUID`, references `profiles.id`)
  * `title` (`TEXT`)
  * `days` (`TEXT[]`: e.g. `['Monday', 'Wednesday']`)
  * `focus` (`TEXT`: e.g. `'Upper Body'`)
  * `exercises` (`JSONB`: array of exercise objects containing `id`, `name`, `target_muscle`, `sets`, `reps`, `rest_seconds`, `thumbnail_url`, `youtube_id`)
  * `created_at` (`TIMESTAMPTZ`)
* **Written by:** `ManualRoutineModal.tsx`, `PasteAiRoutineModal.tsx`, `RoutineEditView.tsx`, `DataService.saveWorkoutRoutine`.
* **Read by:** `ExerciseListView`, `RoutineDetailView`, `DashboardView`.
* **RLS:** `auth.uid() = user_id`.

#### 6. `custom_exercises`
* **Purpose:** User-defined exercises added outside the static catalog.
* **Key Columns:** `id`, `user_id`, `name`, `target_muscle`, `default_sets`, `default_reps`, `thumbnail_url`, `created_at`.
* **Written by:** `AddExerciseModal.tsx`, `DataService.addCustomExercise`.
* **Read by:** `ExerciseListView`.
* **RLS:** `auth.uid() = user_id`.

#### 7. `daily_summaries`
* **Purpose:** Aggregated snapshot of daily totals, calorie balance, and streak tracking.
* **Key Columns:**
  * `id` (`UUID`, Primary Key)
  * `user_id` (`UUID`, references `profiles.id`)
  * `date` (`DATE`: `YYYY-MM-DD`)
  * `total_calories_consumed` (`INTEGER`)
  * `total_protein_consumed`, `total_carbs_consumed`, `total_fat_consumed` (`NUMERIC(6,2)`)
  * `total_calories_burned` (`INTEGER`)
  * `total_exercise_minutes` (`INTEGER`)
  * `net_calories` (`INTEGER`)
  * `is_goal_met` (`BOOLEAN`)
  * `streak_count` (`INTEGER`)
* **Written by:** `DataService.updateDailySummary` (called whenever a meal or exercise log is saved/deleted).
* **Read by:** `DashboardView`, `DailySummaryView`, `DayDetailsModal`.
* **RLS:** `auth.uid() = user_id`.

#### 8. `ai_recommendations`
* **Purpose:** Schema table designed for storing generated coach recommendations and insights.
* **Key Columns:** `id`, `user_id`, `type`, `title`, `content`, `actionable_steps`, `priority`, `is_read`, `expires_at`, `created_at`.
* **Current Implementation Discrepancy:** This table is **rarely used in the current client**. `AiCoachView` maintains conversation history in local component state. The table exists in Postgres but is not read or written to during routine coach interactions.

---

## 5. Source-of-Truth Map

| Information | Authoritative Source | Recalculated / Duplicated In | Conflict Potential |
| :--- | :--- | :--- | :--- |
| **Current Weight** | `profiles.weight_kg` | `goals.target_weight_kg` (separate field), `localStorage['nuvia_storage'].profile.weight_kg` | Low. Updated via Profile/AboutYou. |
| **Target Weight** | `goals.target_weight_kg` | `profiles` (does not have this column; solely in `goals`) | None. |
| **Daily Calorie Target** | `goals.calorie_target` | Recalculated dynamically in `GoalsView.tsx`, `ProfileView.tsx`, and `calculator.ts` | **Medium**. If `goals.calorie_target` is saved manually, auto-recalculation in Profile can overwrite it without warning. |
| **Maintenance Calories** | Dynamic calculation via `calculateBMR()` & `calculateTDEE()` in `calculator.ts` | Not stored as a dedicated DB column; displayed as UI computation | Low. Pure formula output. |
| **Weekly Goal Pace** | Embedded string in `profiles.dietary_preference` (e.g. `"pace:0.5"`) | Parsed via regex in `GoalsView.tsx` and `calculator.ts` | **High**. Fragile storage hack; if user updates dietary preferences, pace string can be wiped out. |
| **Protein / Macro Targets** | `goals.protein_target`, `carbohydrate_target`, `fat_target` | Derived in `calculator.ts` based on goal type & weight | Low. |
| **Meal Calories & Macros** | `meals` table (`total_calories`, `total_protein`, etc.) with itemized rows in `meal_items` | Denormalized into `daily_summaries.total_calories_consumed` | Low. `updateDailySummary` recalculates from `meals` table directly. |
| **Exercise Calories** | `exercise_logs.calories_burned` | Denormalized into `daily_summaries.total_calories_burned` | Low. `updateDailySummary` recalculates from `exercise_logs`. |
| **Net Calories** | Dynamic in `DashboardView.tsx`: `foodCalories - exerciseCalories` | Also stored in `daily_summaries.net_calories` as `consumed - burned` | Low. Formulas match. |
| **Workout Completion** | Existence of row in `exercise_logs` where `source = 'routine'` matching date | Inferred in `DashboardView.tsx` by checking if any today log matches `cleanActivityTitle(routine.title).title` | **Medium**. Matching is done via regex/string matching; renaming a routine breaks completion inference. |
| **Routine Schedule** | `workout_routines.days` (e.g. `['Monday', 'Wednesday']`) | In-memory filtering in `DashboardView` and `ExerciseListView` | Low. |
| **Daily Streak Count** | `profiles` (does not store streak) / Computed from `daily_summaries` | Calculated dynamically in `DataService.calculateStreak` and stored in `daily_summaries.streak_count` | Low. |
| **AI Personalization** | None permanently stored. Reconstructed on each request from today's data | Sent to `/api/ai/ai-coach` on every user prompt | **High**. Long-term user memories, past preferences, and injury histories are discarded. |

---

## 6. Profile Flow

### Lifecycle & Event Trace

```text
User edits profile field (e.g. Weight, Height, Activity Level) in AboutYouSection / ProfileView
  ↓
User taps "Save" (or auto-save debounce triggers)
  ↓
`handleSaveField` or `saveProfile` runs
  ↓
`DataService.saveProfile(updatedProfile)` writes to Supabase `profiles` (and localStorage)
  ↓
Does biometric change affect calorie target? (e.g. weight, height, age, activity level changed)
  ├─ YES: `calculateOptimalNutrition(updatedProfile, userGoals.target_weight_kg, pace)` runs
  │        ↓
  │       `DataService.saveGoals(updatedGoals)` writes updated targets to Supabase `goals`
  │        ↓
  │       `NuviaCache.invalidatePrefix('today:')` (attempted invalidation)
  │        ↓
  │       `refreshProfileAndGoals()` updates React Context (`AuthContext`)
  └─ NO:  Only profile row updated
  ↓
AuthContext distributes new profile and goals to all active components
  ↓
DashboardView and GoalsView re-render with new targets
```

### The "Recalculate" Flow in Detail

Nuvia provides an explicit **Recalculate** function located in `GoalsView.tsx` and `ProfileView.tsx`:

1. **Trigger:** User taps the "Recalculate Targets" button or modifies the Goal Pace slider.
2. **Inputs Collected:**
   * Current weight from `profile.weight_kg`
   * Target weight from `goals.target_weight_kg`
   * Height from `profile.height_cm`
   * Age from `profile.age`
   * Sex from `profile.sex`
   * Activity level from `profile.activity_level`
   * Fitness goal from `profile.goal`
   * Weekly pace parsed from `profile.dietary_preference` (fallback `0.5` kg/week)
3. **Computation:** `calculateNutritionTargets(profile, targetWeight, pace)` runs Mifflin-St Jeor formula to determine BMR, multiplies by Activity Factor to get TDEE, and applies deficit/surplus based on goal and pace.
4. **Database Write:** Calls `DataService.saveGoals({ ...goals, calorie_target, protein_target, carbohydrate_target, fat_target })`.
5. **Cache Action:** Calls `NuviaCache.invalidatePrefix('today:')` and `refreshProfileAndGoals()`.
6. **User Feedback:** Displays a notification banner highlighting the difference (e.g. *"Target updated: 2,150 kcal → 1,950 kcal"*).

---

## 7. Goal & Calorie System

### Mathematical Formulas Used in Code

Located in `src/lib/calculator.ts` and `src/lib/calorie-calculator.ts`.

#### 1. Basal Metabolic Rate (BMR)
Calculated using the **Mifflin-St Jeor Equation**:
* **For Males:**
  $$\text{BMR} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age (years)} + 5$$
* **For Females / Other:**
  $$\text{BMR} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age (years)} - 161$$

#### 2. Total Daily Energy Expenditure (TDEE / Maintenance)
$$\text{TDEE} = \text{BMR} \times \text{Activity Multiplier}$$

Where `Activity Multiplier` is:
* `sedentary`: **1.2** (Little to no exercise, desk job)
* `light`: **1.375** (Light exercise 1–3 days/week)
* `moderate`: **1.55** (Moderate exercise 3–5 days/week)
* `very_active`: **1.725** (Hard exercise 6–7 days/week)
* `extra_active`: **1.9** (Very hard physical training / manual labor)

#### 3. Goal Adjustment (Daily Calorie Target)
Based on `profile.goal` and `weekly_pace_kg`:
* **Weight Loss (`lose_weight`):**
  * Target deficit is calculated as:
    $$\text{Daily Deficit} = \text{weekly\_pace\_kg} \times 1100$$
    *(1 kg fat ≈ 7,700 kcal ÷ 7 days ≈ 1,100 kcal/day).*
  * Subject to safety clamps: deficit cannot exceed 1,000 kcal/day, and target cannot drop below gender minimums (**1,500 kcal** for men, **1,200 kcal** for women).
  $$\text{Calorie Target} = \max(\text{Gender Minimum}, \text{TDEE} - \text{Daily Deficit})$$
* **Weight Gain / Muscle Building (`build_muscle`):**
  $$\text{Calorie Target} = \text{TDEE} + 250 \text{ to } 350 \text{ kcal}$$
* **Maintenance (`maintain` / `improve_fitness`):**
  $$\text{Calorie Target} = \text{TDEE}$$

#### 4. Macro Targets Calculation
* **Protein:**
  * `lose_weight`: $2.2\text{ g/kg}$ of bodyweight (high protein to preserve lean muscle).
  * `build_muscle`: $2.0\text{ g/kg}$ of bodyweight.
  * `maintain`: $1.6\text{ g/kg}$ of bodyweight.
  * Minimum: $50\text{ g/day}$.
* **Fat:**
  * Fixed at $25\%$ of total daily calorie target:
    $$\text{Fat (g)} = \frac{\text{Calorie Target} \times 0.25}{9}$$
* **Carbohydrates:**
  * Fills remaining calorie balance:
    $$\text{Carbs (g)} = \max\left(50, \frac{\text{Calorie Target} - (\text{Protein g} \times 4) - (\text{Fat g} \times 9)}{4}\right)$$

#### 5. Dashboard Calorie Accounting Model
Located in `src/components/DashboardView.tsx`:
$$\text{Food Calories} = \sum \text{meal.total\_calories (today)}$$
$$\text{Exercise Calories} = \sum \text{exercise\_log.calories\_burned (today)}$$
$$\text{Net Calories} = \text{Food Calories} - \text{Exercise Calories}$$
$$\text{Remaining Budget} = \text{Daily Calorie Target} - \text{Net Calories}$$
$$\text{Over Target by} = \max(0, \text{Net Calories} - \text{Daily Calorie Target})$$

### Critical Finding: Activity Double-Counting
In the current implementation, **the daily calorie target already includes expected activity** because TDEE is computed by multiplying BMR by an Activity Multiplier (e.g. 1.375 or 1.55). 
However, on the Today dashboard, logged exercise calories are **subtracted directly from food calories** (`netCalories = food - exercise`). This effectively credits exercise back to the user's food allowance, creating an architectural double-count unless the user selected `sedentary` (1.2) as their baseline activity level.

---

## 8. Calorie Examples

### Scenario
* **Daily Target:** $2,000\text{ kcal}$
* **Food Consumed:** $1,400\text{ kcal}$
* **Exercise Logged:** $200\text{ kcal}$

### Under Current Code Implementation (`DashboardView.tsx`)

```text
Gross Food Consumed:  1,400 kcal
Exercise Credit:        200 kcal
------------------------------------------------
Net Calories:         1,200 kcal  (= 1,400 - 200)
Remaining Budget:       800 kcal  (= 2,000 - 1,200)
Status:               Under target by 800 kcal (40% remaining)
```

### Conceptual & Mathematical Analysis
1. **Mathematical Consistency:** The arithmetic is internally consistent: $1,400 - 200 = 1,200$, and $2,000 - 1,200 = 800$.
2. **Conceptual Correctness:**
   * If the user's initial 2,000 kcal target was derived using a **Sedentary** baseline ($BMR \times 1.2$), this calculation is conceptually sound: any deliberate exercise burned represents additional energy expenditure beyond baseline sedentary living, which increases the user's allowable intake for the day.
   * If the user's 2,000 kcal target was derived using **Moderate Activity** ($BMR \times 1.55$), the 2,000 kcal budget *already assumed* the user burns $\sim 300\text{--}400\text{ kcal}$ in workouts each day. Crediting another 200 kcal creates a double-count where the user is awarded extra food calories for an activity that was already pre-budgeted into their maintenance target.

---

## 9. Goals System

### Goal Types
* `lose_weight`: Applies a deficit of 275–1,000 kcal/day depending on pace.
* `maintain`: Matches calculated TDEE.
* `build_muscle`: Applies a 250–350 kcal surplus.
* `improve_fitness`: Matches TDEE with moderate protein ($1.8\text{ g/kg}$).
* `increase_energy`: Matches TDEE with balanced 50% carbs, 25% protein, 25% fat.

### Data Flow & Propagation

```text
User modifies goal / pace in GoalsView.tsx
  ↓
`recalculateTargets()` runs Mifflin-St Jeor + macro distribution
  ↓
`DataService.saveGoals()` updates `goals` table
  ↓
`DataService.saveProfile()` updates `profiles.dietary_preference` with `"pace:X"`
  ↓
`NuviaCache.invalidatePrefix('today:')` is called (see bug in Section 20)
  ↓
`refreshProfileAndGoals()` updates React `AuthContext`
  ↓
Today Dashboard re-renders with new `calorie_target` and macro targets
  ↓
AI Coach receives updated target in next message payload
```

---

## 10. Meals System

### Meal Lifecycle: Step-by-Step

```text
1. Input: User takes/uploads photo or types text description in AddMealModal
  ↓
2. Image Preprocessing: Client converts image file to Base64 JPEG data URL (canvas scaled)
  ↓
3. API Call: POST /api/ai/analyze-meal with { imageBase64, textPrompt, mealType }
  ↓
4. Gemini Processing:
   - Evaluates against specialized Malaysian/Southeast Asian & International cuisine prompt
   - Iterates through GEMINI_MODELS fallback chain (3.5-flash, 3-flash, 3.7-flash, 3.5-lite)
   - Requests responseMimeType: 'application/json'
   - If API fails or offline: Heuristic Regex Fallback classifies local dishes (Nasi Lemak, Ayam Gepuk, Roti Canai, etc.)
  ↓
5. Review Modal (MealResultModal.tsx):
   - User reviews detected foods, portion sizes (g/ml), calories, protein, carbs, and fat
   - User can add items, remove items, or manually adjust calorie numbers
  ↓
6. Meal Save: User taps "Save Meal"
   - `DataService.addMeal()` executes:
     * Inserts parent record into `meals` table
     * Inserts child records into `meal_items` table
     * Calls `DataService.updateDailySummary()` which recalculates today's total calories and macros
  ↓
7. Cache & Context Updates:
   - Invalidates `todaySummaryKey`, `todayMealsKey`, `allMealsKey` in `NuviaCache`
   - Calls `refreshProfileAndGoals()`
  ↓
8. UI Update: MealsListView and DashboardView re-render immediately with fresh data
```

### AI vs Deterministic Boundary
* **AI Domain:** Image item recognition, ingredient portion estimation, initial calorie and macro guesses, culinary assumptions, and nutritional notes.
* **Deterministic Domain:** User overrides in `MealResultModal`, summation of item totals into `meals.total_calories`, insertion into PostgreSQL, and updating `daily_summaries`. Once the user taps "Save", all stored numbers are strictly deterministic.

---

## 11. AI Architecture

### Complete Inventory of Gemini Integrations

| Feature | API Route | Gemini Models (Fallback Chain) | System Prompt Role | Response Type | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Meal Analysis** | `/api/ai/analyze-meal` | `gemini-3.5-flash`<br>`gemini-3-flash-preview`<br>`gemini-3.7-flash`<br>`gemini-3.5-flash-lite` | Southeast Asian & global culinary nutrition expert | Structured JSON: `{ meal_type, meal_name, foods[], total, confidence, assumptions[], notes }` | `cleanJsonString()`, `JSON.parse()`, regex heuristic fallback |
| **Exercise Logger** | `/api/ai/parse-exercise` | Same 4 models | Exercise analysis assistant estimating MET-based burn | Structured JSON: `{ exercise_type, duration_minutes, intensity, distance_km, calories_burned, confidence, ai_tip }` | `JSON.parse()`, fallback MET pattern matcher |
| **Routine Parser** | `/api/ai/parse-routine` | Same 4 models | Fitness routine extractor matching an 80-exercise catalog prompt hint | Structured JSON: `{ routines: [{ title, days[], focus, exercises: [{ name, sets, reps, rest_seconds, notes }] }] }` | `JSON.parse()`, fallback regex parser, `matchExerciseSafe()` |
| **AI Coach** | `/api/ai/ai-coach` | Same 4 models | Dedicated 1-on-1 fitness & nutrition coach for Nuvia | Free-form Markdown with strict guidelines (empathy, actionable tips, under 180 words) | Fallback template generator if API fails or quota exceeded |

### Model Invocation Architecture
All endpoints use direct HTTP POST requests to `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}` with `temperature: 0.1` or `0.2`. None of the official Google GenAI SDKs (`@google/genai` or `@google/generative-ai`) are installed; raw `fetch` is used for minimal bundle footprint.

---

## 12. AI User Context

### Context Audit: What Information is Sent to AI Coach?

| User Information | Sent to AI? | Exact Code Source |
| :--- | :--- | :--- |
| **Name** | **YES** | `profile?.full_name` via `AuthContext` |
| **Age** | **NO** | Available in `profile.age`, but **omitted** from coach context payload |
| **Sex** | **NO** | Available in `profile.sex`, but **omitted** from coach context payload |
| **Height** | **NO** | Available in `profile.height_cm`, but **omitted** from coach context payload |
| **Current Weight** | **PARTIAL** | Sent to `/api/ai/parse-exercise`, but **omitted** from `/api/ai/ai-coach` |
| **Target Weight** | **NO** | Available in `goals.target_weight_kg`, but **omitted** from coach payload |
| **Fitness Goal** | **YES** | `profile?.goal` (e.g. `'lose_weight'`) |
| **Activity Level** | **NO** | Available in `profile.activity_level`, but **omitted** from coach payload |
| **Calorie Target** | **YES** | `goals?.calorie_target` |
| **Maintenance / TDEE** | **YES** | `tdee` calculated in `AiCoachView.tsx` |
| **Macro Targets** | **PARTIAL** | Only `protein_target` is sent; Carbs and Fat targets are **omitted** |
| **Today's Meals** | **YES** | Formatted string: `"${m.name} (${m.meal_type}, ${m.total_calories} kcal, ${m.total_protein}g P)"` |
| **Today's Calories** | **YES** | Consumed, Burned, Net, Remaining, and Over/Under status |
| **Today's Exercise** | **YES** | Formatted string: `"${e.exercise_type} (${e.duration_minutes}m, ${e.calories_burned} kcal)"` |
| **Workout History** | **NO** | Previous days' workouts are **never sent** |
| **Active Routine** | **NO** | The user's scheduled routine split is **not sent** |
| **Food Preferences** | **NO** | `dietary_preference` is **not sent** to Coach |
| **Dietary Restrictions**| **NO** | Not collected in the database |
| **Past Behavior** | **NO** | Historical calorie adherence over the past 7/30 days is **omitted** |
| **AI Corrections** | **NO** | Prior user corrections are not stored or sent |
| **Recent Trends** | **NO** | Weight progress over time is **not sent** |

---

## 13. User Memory / Personalization

### Audit Findings

1. **Explicit User Information:** Stored permanently in `profiles` and `goals` (Name, Age, Height, Weight, Activity Level, Goal, Target Weight).
2. **Learned Preferences:** **Zero implementation**. Nuvia does not analyze logged meals to extract dietary habits, preferred workout times, or macro patterns.
3. **Corrections:** **Zero implementation**. If a user corrects Gemini's portion estimate in `MealResultModal`, the corrected numbers are saved to that specific meal record, but the underlying correction is not fed back into a memory store.
4. **Historical Behavior:** Logged indefinitely in `meals`, `exercise_logs`, and `daily_summaries`, but **completely invisible to the AI Coach**. The AI Coach only receives today's immediate log snapshot.
5. **Session Continuity:** The AI Coach chat history is maintained in component React state (`useState<Message[]>`). Switching tabs within the SPA preserves the chat in memory, but **refreshing the browser wipes the chat completely**. Chat messages are not saved to Supabase or `localStorage`.

---

## 14. Natural Language Logging

### Flow 1: "I ate 2 eggs and toast"
1. **Input:** User types string into `AddMealModal` text prompt.
2. **Endpoint:** POST `/api/ai/analyze-meal` with `{ textPrompt: "I ate 2 eggs and toast", mealType: "breakfast" }`.
3. **Processing:**
   * Gemini evaluates prompt. If offline, regex matches `egg` and `toast`.
   * Returns items: `Poached/Fried Eggs` (2 eggs, 140 kcal, 12g P) + `Wholemeal Toast` (2 slices, 160 kcal, 6g P). Total: 300 kcal, 18g P, 29g C, 12g F.
4. **Review Modal:** `MealResultModal` displays editable items.
5. **Persistence:** `DataService.addMeal` writes to `meals` and `meal_items`, triggers `updateDailySummary`.
6. **Dashboard:** Calories consumed increases by 300, remaining budget drops by 300.

### Flow 2: "I ran 5km in 28 minutes"
1. **Input:** User types string into `AddExerciseModal` natural language tab.
2. **Endpoint:** POST `/api/ai/parse-exercise` with `{ textPrompt: "I ran 5km in 28 minutes", userWeightKg: 75 }`.
3. **Processing:**
   * Gemini estimates MET score for outdoor running ($MET \approx 8.5$ to $9.0$).
   * Calculates burn: $MET \times \text{weight} \times \frac{28}{60} \approx 315\text{ kcal}$.
   * Extracts distance: $5.0\text{ km}$, duration: $28\text{ min}$.
4. **Review & Save:** Modal presents results for confirmation.
5. **Persistence:** `DataService.addExerciseLog` writes row to `exercise_logs` with `source = 'ai'`.
6. **Dashboard:** Exercise calories increase by 315, net calories decrease by 315.

---

## 15. Activity System

The Activity system is structured into four interconnected layers:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. TODAY'S SNAPSHOT (ExerciseListView / DashboardView)                 │
│    - Active workout scheduled for today                                │
│    - Quick logs recorded today (duration, calories, distance)          │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ 2. PLANS / ROUTINE MANAGEMENT (RoutineDetailView / ManualRoutineModal) │
│    - Multi-day routine splits (e.g. Push / Pull / Legs)                │
│    - In-app live player with rest timers and set tracking              │
│    - AI Routine Import from text consultations                         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ 3. EXERCISE LIBRARY (In-Memory EXERCISE_CATALOG: 80+ Exercises)        │
│    - Filter by muscle target (Chest, Back, Shoulders, Legs, Core)      │
│    - Verified YouTube demo links & thumbnail integration               │
│    - Custom user exercise creation (custom_exercises table)            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ 4. HISTORY & RECOVERY (ActivityDetailsModal / BodyMuscleMap)           │
│    - Logged sessions queried from exercise_logs                        │
│    - 48-hour muscle recovery tracking to prevent overtraining          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 16. Routine System

### Critical Architectural Distinction

There is **no dedicated table for workout sessions or exercise completions**. Nuvia implements a lean data model where sessions are denormalized into `exercise_logs`:

```text
┌─────────────────────────┐
│ In-Memory Catalog       │  Static definitions (80+ exercises, thumbnails, YouTube IDs)
└───────────┬─────────────┘
            │ Referenced by name / id
┌───────────▼─────────────┐
│ workout_routines (DB)   │  Template Plan: JSONB array of exercises & target days
└───────────┬─────────────┘
            │ Executed in RoutineDetailView
┌───────────▼─────────────┐
│ exercise_logs (DB)      │  Completed Workout Session:
│                         │  - source: 'routine'
│                         │  - exercise_type: cleaned routine title
│                         │  - ai_analysis: JSONB storing exact sets, reps, & weights
└─────────────────────────┘
```

* **Routine Template:** Stored in `workout_routines`. Contains `title`, `days: ['Monday', 'Wednesday']`, and `exercises: JSONB`.
* **Scheduled Routine:** Inferred dynamically at runtime by checking if today's weekday name matches any string in `workout_routines.days`.
* **Workout Session & Completed Workout:** Not a separate table. When finished, a record is added to `exercise_logs` with `source = 'routine'`. The set-by-set logged weights and reps are stored in the JSONB column `ai_analysis.actual_performance`.
* **Exercise Log & Activity Log:** Refers to the same `exercise_logs` table. Simple cardio logs have `source = 'manual'` or `'ai'`; structured resistance workouts have `source = 'routine'`.

---

## 17. Workout Scheduling

### Logic: "What workout is scheduled today?"

Located in `src/components/DashboardView.tsx` and `src/components/ExerciseListView.tsx`:

```text
1. Get current local day of week:
   const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
   // e.g. "Monday"

2. Query all routines for user:
   const routines = await DataService.getWorkoutRoutines(userId);

3. Filter matching routines:
   const scheduledRoutine = routines.find(r => 
     r.days && r.days.some(d => d.toLowerCase() === todayDayName.toLowerCase())
   );

4. Check completion status:
   const isCompleted = todayActivity.some(log => 
     log.source === 'routine' && 
     log.exercise_type.toLowerCase().includes(cleanActivityTitle(scheduledRoutine.title).title.toLowerCase())
   );

5. Render Card:
   - If scheduledRoutine found & !isCompleted: Shows "Start Workout" with routine title.
   - If scheduledRoutine found & isCompleted: Shows "Completed" with green checkmark.
   - If no routine matches today: Displays "Rest Day" card with prompt to browse routines.
```

### Fallback Risk
In earlier versions, if no routine matched today, the code fell back to displaying `routines[0]`, misleading users into starting a Monday workout on a Thursday. Current code has removed that fallback, properly displaying a rest state if no routine matches the current day name.

---

## 18. Workout History

### Trace: How a Workout Becomes History
* **Execution:** User checks off sets in `RoutineDetailView.tsx` and taps "Finish Workout".
* **Data Stored:**
  * Date: `logged_at` timestamp in `exercise_logs`.
  * Name: Cleaned routine title (via `cleanActivityTitle()`) stored in `exercise_type`.
  * Scheduled Day: **Not stored in history**. History stores the exact timestamp when executed.
  * Completion & Sets: Stored in `ai_analysis.actual_performance`.
  * Calories: Stored in `calories_burned` (calculated via MET formulas).
  * Duration: Stored in `duration_minutes`.
* **Title Cleaning (`src/lib/activity-utils.ts`):** Strips out recurring day strings (e.g. *"Monday & Wednesday - Upper Body"* is sanitized to display as *"Upper Body"* in history cards so users aren't confused when reviewing a workout performed on a different day).

---

## 19. Daily Summary System

* **Stored:** `daily_summaries` table stores denormalized daily totals (`total_calories_consumed`, `total_calories_burned`, `net_calories`, `total_protein_consumed`, `streak_count`).
* **Generation & Update:** Summaries are updated **eagerly and just-in-time**. Whenever `DataService.addMeal`, `deleteMeal`, `addExerciseLog`, or `deleteExerciseLog` is executed, it immediately queries all meals and logs for that date and overwrites the `daily_summaries` row.
* **Dashboard Read Strategy:** `DashboardView.tsx` does **not** rely solely on `daily_summaries`. It reads `todayMealsKey` and `todayActivityKey` directly, summing food calories and exercise calories in React memory. This guarantees that any delay in summary generation never produces a stale dashboard state.

---

## 20. Cache / State Management

### `NuviaCache` Architecture (`src/lib/nuvia-cache.ts`)
* **Implementation:** JavaScript `Map<string, CacheEntry>` at module scope with automatic garbage collection running every 2 minutes.
* **TTL:** `staleTime = 60,000ms` (1 min), `gcTime = 300,000ms` (5 min).

### Mutation & Invalidation Map

```text
Meal Logged / Deleted:
  ├─ Invalidates: todaySummaryKey(userId, date)
  ├─ Invalidates: todayMealsKey(userId, date)
  └─ Invalidates: allMealsKey(userId)

Exercise / Workout Logged:
  ├─ Invalidates: todaySummaryKey(userId, date)
  ├─ Invalidates: todayActivityKey(userId, date)
  └─ Invalidates: exerciseLogsKey(userId)

Goal Changed (GoalsView.tsx):
  ├─ Intended: Invalidate all today keys
  └─ ACTUAL CODE: NuviaCache.invalidatePrefix('today:');
     CRITICAL BUG: Cache keys use hyphen ('today-summary:', 'today-meals:'),
     meaning invalidatePrefix('today:') matches 0 keys!
```

---

## 21. Navigation / Modal System

* **Navigation:** `Navigation.tsx` renders a fixed bottom navigation bar on mobile with icons for Today, Meals, Activity, Coach, and Profile.
* **Modals & Bottom Sheets:**
  * `NuviaBottomSheet.tsx` provides Apple-style drag-to-dismiss bottom sheets with backdrop blur, scroll locking, and Escape key dismissal.
  * **Fragmentation:** Only 3 components (`AboutYouSection`, `PasteAiRoutineModal`, `ActivityDetailsModal`) use `NuviaBottomSheet`. All other modals (`AddMealModal`, `MealResultModal`, `AddExerciseModal`, `DayDetailsModal`, `StreakCalendarModal`, `ManualRoutineModal`) implement their own custom fixed overlays.
* **Portals:** `createPortal` is **not used anywhere** in Nuvia. All modals are rendered inline within their parent DOM tree, relying on `fixed inset-0 z-50` for positioning.

---

## 22. Component Dependency Map

```text
src/app/page.tsx (Master Shell)
 ├── Navigation (Bottom Bar)
 ├── DashboardView (Today)
 │    ├── MacroDonutChart
 │    ├── StreakCalendarModal
 │    ├── AddMealModal ──► MealResultModal
 │    └── AddExerciseModal
 ├── MealsListView (Meals)
 │    ├── DateFilterBar
 │    ├── MealDetailsModal
 │    └── AddMealModal ──► MealResultModal
 ├── ExerciseListView (Activity)
 │    ├── RoutineDetailView (Workout Player)
 │    │    ├── ExerciseVideoModal
 │    │    └── ExerciseReplaceModal
 │    ├── RoutineEditView
 │    ├── ManualRoutineModal
 │    ├── PasteAiRoutineModal (uses NuviaBottomSheet)
 │    ├── ActivityDetailsModal (uses NuviaBottomSheet)
 │    ├── AddExerciseModal
 │    └── BodyMuscleMap
 ├── AiCoachView (Coach)
 ├── DailySummaryView (Summary)
 │    ├── DateFilterBar
 │    └── DayDetailsModal
 ├── GoalsView (Goals)
 └── ProfileView (Profile)
      └── AboutYouSection (uses NuviaBottomSheet)
```

---

## 23. Bugs / Architectural Problems

### Documented Issues in Current Codebase

#### 1. Broken Cache Invalidation on Goal Edit
* **Location:** `src/components/GoalsView.tsx` (Line 163)
* **Cause:** Code calls `NuviaCache.invalidatePrefix('today:')`. Key builder functions in `nuvia-cache.ts` create keys starting with `'today-'` (`today-summary:...`, `today-meals:...`).
* **Impact:** Modifying calorie or macro goals does not invalidate the Today dashboard cache. Users returning to Today may see stale calorie targets until the 60s TTL expires.
* **Direction:** Change invalidation to use exact key constants or `invalidatePrefix('today')`.

#### 2. Goal Pace Storage Workaround
* **Location:** `src/components/GoalsView.tsx` & `src/lib/calculator.ts`
* **Cause:** The `profiles` Postgres table lacks a `weekly_pace_kg` column. Code serializes pace into `profiles.dietary_preference` as `"pace:0.5"`.
* **Impact:** Fragile; updating dietary preferences or saving profile from other views risks wiping out the user's pace setting.
* **Direction:** Add `weekly_pace_kg NUMERIC(3,2) DEFAULT 0.5` to the `goals` or `profiles` table.

#### 3. Calorie Double-Counting with High Activity Multipliers
* **Location:** `src/components/DashboardView.tsx` vs `src/lib/calculator.ts`
* **Cause:** TDEE already incorporates expected workout expenditure via activity multiplier (1.375–1.9), yet `DashboardView` subtracts logged workout calories directly from food intake.
* **Impact:** Users who select "Moderate Activity" and log workouts are awarded extra food calories twice.
* **Direction:** Decouple baseline lifestyle multiplier from workout logging or implement a deliberate net calorie credit model.

#### 4. Fragmented Modal Implementations
* **Location:** Across 8 modal components (`AddMealModal`, `MealResultModal`, `AddExerciseModal`, etc.)
* **Cause:** Components implement bespoke fixed overlays rather than standardizing on `NuviaBottomSheet`.
* **Impact:** Inconsistent swipe-to-dismiss behavior, duplicate scroll-locking logic, and potential z-index conflicts.
* **Direction:** Refactor existing modals to wrap `NuviaBottomSheet`.

#### 5. Ephemeral AI Coach Chat History
* **Location:** `src/components/AiCoachView.tsx`
* **Cause:** Conversation messages are kept strictly in React `useState<Message[]>`.
* **Impact:** Refreshing the browser or PWA clears all coaching conversation history.
* **Direction:** Persist messages to Supabase or `localStorage`.

---

## 24. Duplicate Logic

| Concept | Implementation A | Implementation B | Conflict? |
| :--- | :--- | :--- | :--- |
| **BMR & TDEE** | `src/lib/calculator.ts` (`calculateBMR`, `calculateTDEE`) | `src/lib/calorie-calculator.ts` (re-implements Mifflin-St Jeor) | Minor. Formulas match, but maintenance of two calculator files invites divergence. |
| **Workout Calorie Burn** | `src/lib/calorie-calculator.ts` (`calculateWorkoutCalories` using METs) | `/api/ai/parse-exercise/route.ts` (Gemini prompt + regex MET fallback) | Medium. Standalone exercise log uses different MET constants than routine player. |
| **Pace Parsing** | `GoalsView.tsx` (regex on `dietary_preference`) | `calculator.ts` (helper function) | Fragile string manipulation in two places. |
| **Activity Title Sanitization**| `src/lib/activity-utils.ts` (`cleanActivityTitle`) | Inlined regex in `DashboardView.tsx` | Minor. Should strictly import from `activity-utils.ts`. |

---

## 25. Security

* **API Keys:** `GEMINI_API_KEY` is kept server-side in Next.js environment variables. Client components never access Gemini directly; all requests pass through `/api/ai/*` Route Handlers.
* **Supabase Anon Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` is exposed to the browser as intended for client-side queries.
* **Supabase Service Role Key:** `SUPABASE_SERVICE_ROLE_KEY` is restricted to server-side Route Handlers (`/api/auth/send-otp`) for administrative OTP delivery.
* **Row-Level Security (RLS):** Enabled on all Postgres tables (`profiles`, `goals`, `meals`, `meal_items`, `exercise_logs`, `daily_summaries`, `workout_routines`, `custom_exercises`). All policies enforce `auth.uid() = user_id`.
* **User Data Isolation:** Authenticated users cannot read or write another user's rows. Demo mode users operate strictly on local `localStorage` without interacting with Supabase tables.

---

## 26. Performance

* **SPA In-Memory Mounting:** Mounting all tabs (`DashboardView`, `MealsListView`, `ExerciseListView`, `AiCoachView`, `ProfileView`) simultaneously eliminates route transition lag, but increases initial client memory footprint.
* **Image Compression:** Meal photos are downscaled via HTML Canvas to max 1024px before Base64 encoding, keeping payload sizes under 500KB.
* **Query Scoping:** Meals and activity queries are scoped by date (`eq('logged_at', selectedDate)`), preventing full-history table scans on daily views.
* **Stale-While-Revalidate:** `NuviaCache` prevents loading spinners when switching back and forth between Today and Meals.

---

## 27. Data Flow Diagrams

### Profile Flow

```text
User updates weight / height
  ↓
DataService.saveProfile()
  ↓
calculateNutritionTargets()
  ↓
DataService.saveGoals()
  ↓
refreshProfileAndGoals()
  ↓
DashboardView & GoalsView
```

### Meal Flow

```text
Photo or Text Input
  ↓
POST /api/ai/analyze-meal (Gemini)
  ↓
MealResultModal (User edits/confirms)
  ↓
DataService.addMeal()
  ↓
DataService.updateDailySummary()
  ↓
NuviaCache Invalidation
  ↓
Today & Meals UI
```

### Workout Flow

```text
WorkoutRoutine (Template)
  ↓
Matched against today's day name
  ↓
RoutineDetailView (Live Session)
  ↓
User finishes sets & confirms
  ↓
DataService.addExerciseLog(source: 'routine')
  ↓
DataService.updateDailySummary()
  ↓
History & Today UI
```

### AI Coach Flow

```text
User Message
  +
Profile (Name, Goal)
  +
Goals (Calories, Protein)
  +
Today Summary (Consumed, Burned, Net)
  +
Today Meals & Exercise List
  ↓
POST /api/ai/ai-coach (Gemini)
  ↓
Streamed Markdown Response
  ↓
AiCoachView
```

---

## 28. How Nuvia Actually Knows the User

1. **What Nuvia permanently knows:** Demographics (name, email, age, sex), biometric baseline (height, weight), target weight, fitness goal, activity level, calculated calorie and macro targets, meal log history, exercise log history, and saved workout routines.
2. **What Nuvia only knows temporarily:** Today's food log, today's workout performance, current remaining calorie budget, active rest timer, and the current AI Coach chat session (lost upon page refresh).
3. **What Nuvia learns from behavior:** **Nothing**. Nuvia does not analyze user habits over time, detect recurring favorite meals, track average workout duration, or adjust targets based on weight loss stalls.
4. **What Nuvia does NOT currently know:** Injury history, equipment access, dietary intolerances/allergies, sleep quality, hydration, menstrual cycle phase, or specific food aversions.
5. **What AI receives when giving advice:** Name, primary goal, calorie target, maintenance estimate, protein target, today's calories consumed/burned, today's net calorie status, and a list of today's meal and workout names.
6. **What is missing that prevents truly personalized recommendations:**
   * AI has **no memory of yesterday**. It cannot see if the user has been in a deficit for 5 consecutive days or overeating all week.
   * AI cannot see the user's weight trend (whether they are actually losing weight at their target pace).
   * AI does not know the user's age, sex, or current weight during coaching consultations (it only receives derived calorie targets).
   * AI does not know what equipment the user has access to or what specific exercises they struggled with during their workout.

---

## 29. Personalization Gap Analysis & Recommended Architecture

### Current Personalization
* Personalizes daily calorie target to user's BMR and activity multiplier.
* Personalizes macro splits to user's specific fitness goal.
* AI Coach tailors advice to today's remaining calorie budget.

### Missing Personalization (Data in DB but not sent to AI)
* Age, Sex, Height, and Current Weight.
* 7-day adherence history from `daily_summaries`.
* Weight progression over time.
* Workout performance details (weights lifted, sets completed from `exercise_logs.ai_analysis`).

### Missing Data (Not collected at all)
* Dietary allergies and intolerances.
* Home vs commercial gym equipment access.
* Injuries or physical limitations.
* Sleep and stress markers.

### Recommended Future Architecture: `NuviaUserContext`

To transform Nuvia into an intelligent, memory-aware fitness companion, implement a centralized **User Context Aggregator** service:

```text
┌─────────────────────────────────────────────────────────────┐
│                    Nuvia User Context                       │
├─────────────────────────────────────────────────────────────┤
│ 1. Identity & Biometrics:                                   │
│    - Age, Sex, Height, Current Weight, Target Weight        │
│                                                             │
│ 2. Targets & Budget:                                        │
│    - TDEE, Calorie Target, Macro Targets, Deficit Strategy  │
│                                                             │
│ 3. Today's State:                                           │
│    - Meals logged, Calories/Macros consumed                 │
│    - Workouts completed, Volume, Intensity                  │
│    - Net calorie balance, Remaining allowance               │
│                                                             │
│ 4. 7-Day & 30-Day Trajectory:                               │
│    - Calorie adherence rate (% of days on target)           │
│    - Weight delta over last 14 days                         │
│    - Most trained muscle groups vs neglected muscles        │
│                                                             │
│ 5. Memory & Preferences:                                    │
│    - Dietary restrictions (e.g. Halal, Vegetarian, Dairy)   │
│    - Available equipment (e.g. Dumbbells only, Full Gym)    │
│    - Injuries / Contraindications                           │
│    - Learned favorite foods & regular mamak orders          │
└─────────────────────────────────────────────────────────────┘
```

---

## 30. Files Inspected

* `fitness_app_schema.sql` — Authoritative Supabase PostgreSQL schema, enums, tables, and RLS policies.
* `src/app/page.tsx` — Master SPA orchestrator, tab switching, and modal mounting.
* `src/app/layout.tsx` — Root layout, metadata, viewport, font configuration.
* `src/app/onboarding/page.tsx` — Initial user registration wizard.
* `src/lib/auth-context.tsx` — Supabase session handling, demo mode toggle, and global profile/goals state.
* `src/lib/data-service.ts` — Data access layer, Supabase client operations, and localStorage fallback.
* `src/lib/nuvia-cache.ts` — Module-level stale-while-revalidate memory cache.
* `src/lib/calculator.ts` — Mifflin-St Jeor BMR, TDEE, and macro target calculation formulas.
* `src/lib/calorie-calculator.ts` — MET workout calorie calculation logic.
* `src/lib/exercise-catalog.ts` — 80+ exercise catalog, YouTube playlist metadata, fuzzy matching.
* `src/lib/activity-utils.ts` — Exercise and routine title cleaning utilities.
* `src/components/DashboardView.tsx` — Today dashboard, calorie accounting equations, workout card scheduling.
* `src/components/GoalsView.tsx` — Goal selection, pace slider, target recalculation logic.
* `src/components/ProfileView.tsx` — Profile settings, biometric updates, demo data export/import.
* `src/components/profile/AboutYouSection.tsx` — Inline parameter editing.
* `src/components/MealsListView.tsx` — Daily meal browser and date navigation.
* `src/components/AddMealModal.tsx` & `MealResultModal.tsx` — Meal photo upload, review, and editing.
* `src/components/ExerciseListView.tsx` — Activity hub, routine lists, catalog browser.
* `src/components/RoutineDetailView.tsx` — Workout execution player, set tracking, and session saving.
* `src/components/AiCoachView.tsx` — AI Coach chat UI and context construction.
* `src/components/DailySummaryView.tsx` — Calendar summary browser.
* `src/components/NuviaBottomSheet.tsx` — Apple-inspired mobile bottom sheet implementation.
* `src/app/api/ai/ai-coach/route.ts` — Gemini coaching prompt and response handler.
* `src/app/api/ai/analyze-meal/route.ts` — Gemini meal image/text nutrition analyzer.
* `src/app/api/ai/parse-exercise/route.ts` — Gemini natural language exercise logger.
* `src/app/api/ai/parse-routine/route.ts` — Gemini workout routine parser.

---

## 31. Uncertainties / Unknowns

* `ai_recommendations` table usage: The table is defined in `fitness_app_schema.sql` with columns for priority, actionable steps, and expiration, but no active application code writes recommendations to it. Whether it was intended for proactive push recommendations or an abandoned feature is **UNKNOWN — could not verify from current code**.
* Offline synchronization: When operating in demo/offline mode, changes are written to `localStorage['nuvia_storage']`. There is currently no automatic sync engine to merge local demo mutations into a Supabase account upon subsequent sign-in. Whether account linking was planned is **UNKNOWN — could not verify from current code**.

---

## 10 Most Important Architectural Facts About Nuvia

1. **SPA Architecture in App Router:** Nuvia does not use page-based routing for its core features; it is an in-memory Single Page Application mounted at `/` (`src/app/page.tsx`) that toggles view visibility via CSS `display: contents` / `display: none`.
2. **Dual-Layer Persistence:** All CRUD operations flow through `DataService`, which dynamically routes to Supabase PostgreSQL (if authenticated) or browser `localStorage['nuvia_storage']` (if demo/offline).
3. **No Dedicated Workout Session Table:** Completed workouts are not stored in a separate table; they are inserted as rows into `exercise_logs` with `source = 'routine'`, storing set-by-set performance inside a JSONB column (`ai_analysis`).
4. **Denormalized Exercises in Routines:** The `workout_routines` table does not link to an exercise join table; it stores its list of exercises directly as a `JSONB` array within the routine row.
5. **Activity Double-Counting in Calorie Model:** Daily calorie targets already include baseline activity via Mifflin-St Jeor TDEE multipliers (1.375–1.9), yet the Today dashboard deducts logged workout calories directly from food intake (`net = food - exercise`), crediting exercise twice unless the user is set to Sedentary.
6. **Pace Storage Workaround:** Because `profiles` lacks a `weekly_pace_kg` column, the weekly pace is serialized as a text prefix inside `profiles.dietary_preference` (e.g. `"pace:0.5"`).
7. **Cache Invalidation Bug:** `GoalsView.tsx` attempts to invalidate dashboard caches with `NuviaCache.invalidatePrefix('today:')`, but all cache keys are constructed with hyphens (`today-summary:`, `today-meals:`), meaning the invalidation call silently fails.
8. **Stateless AI with Zero Memory:** Gemini AI calls are stateless and ephemeral. The AI Coach receives only today's log numbers; it has no access to previous days' history, weight trends, or past chat messages.
9. **Modal Fragmentation:** While an Apple-grade bottom sheet (`NuviaBottomSheet`) exists with drag-to-dismiss and scroll-locking, only 3 components use it; the remaining 8 modals use bespoke fixed overlays.
10. **Zero External AI SDKs:** All Gemini integrations use direct HTTP `fetch` to Google's REST API endpoints across four fallback models (`gemini-3.5-flash`, `gemini-3-flash-preview`, `gemini-3.7-flash`, `gemini-3.5-flash-lite`), accompanied by deterministic regex fallback engines for offline resilience.
