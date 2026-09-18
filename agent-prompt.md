# Fitness & Nutrition PWA — Build Prompt

## Tech stack (already decided — do not deviate)
- **Frontend:** Next.js (React), mobile-first, installable as a PWA (manifest.json, service worker, offline fallback)
- **Backend/DB:** Supabase (Postgres). A fresh Supabase project has already been created for this app, separate from any other project.
- **Database schema:** Already written and applied — see `fitness_app_schema.sql` (attached separately). Do NOT invent your own schema or modify table/column names. All 7 tables (`profiles`, `goals`, `meals`, `meal_items`, `exercise_logs`, `daily_summaries`, `ai_recommendations`) exist, with Row Level Security already enabled and tested with two accounts to confirm user data isolation.
- **AI:** Google Gemini API, model `gemini-3.8-flash`. The API key must NEVER be exposed in frontend code.
- **Where Gemini calls run:** Supabase Edge Functions only. Each Edge Function must verify the caller's Supabase JWT and confirm the authenticated user matches the `user_id` being written, since Edge Functions using the service_role key bypass RLS entirely — the function itself is the only thing enforcing ownership at that point.
- **Auth:** Supabase Auth (email + Google OAuth where available).

## UI reference
A mockup image (FullSizeRender.jpeg) is attached showing the 10-step screen flow (Landing → Onboarding → Dashboard → Add Meal → Meal Result → Add Exercise → Daily Summary → AI Coach → Goals & Progress). Use it ONLY as a visual reference for layout, spacing, and screen flow. Ignore the "Node.js/Express" and "Gemini 3.6 Flash" labels shown in that image's tech-stack panel — those are outdated and superseded by the tech stack section above (Next.js, Supabase Edge Functions, gemini-3.8-flash). Ignore name FitTrack because my application's name is Nuvia.

## Product spec

You are a senior product designer, UX architect, AI application architect, and full-stack web developer.

I want you to design and build a **mobile-first Progressive Web Application (PWA)** for tracking a user's food intake, nutrition, exercise, calorie expenditure, fitness goals, and AI-generated recommendations.

The application is intended primarily for **mobile/tablet browser use**, because I do not have a MacBook and therefore cannot deploy a native iOS application. The PWA must feel like a polished mobile application and support installation to the user's home screen.

The application should prioritize:

1. Extremely simple logging
2. AI-assisted data entry
3. Accurate-enough estimation rather than unnecessary complexity
4. Daily goal tracking
5. Personalized recommendations
6. Minimal manual data entry
7. Clear explanations when AI is uncertain

The AI engine will use my **Gemini 3.8 Flash API** to analyze meal photographs, meal descriptions, exercise descriptions, and natural-language prompts.

---

## PRODUCT CONCEPT

The application allows a user to answer:

"What did I eat?"
"What exercise did I do?"
"How much nutrition did I consume?"
"How many calories did I approximately burn?"
"Am I on track toward my daily goal?"
"What should I do for the rest of today?"

The system should transform natural human input into structured records.

Example:

User:
"I had nasi putih, ayam goreng, telur and some vegetables for lunch."

Instead of forcing the user to manually enter every field, AI should interpret the message and generate:

Meal:

* Meal type: Lunch
* Main foods: White rice, fried chicken, egg, vegetables
* Estimated calories
* Protein
* Carbohydrates
* Fat
* Portion assumptions
* Confidence level

The user must be able to review the AI result before permanently saving it.

---

## IMPORTANT PRODUCT PRINCIPLE

Do NOT make this application a complicated calorie database.

The main purpose is tracking the user's overall daily intake and activity.

Only record the most useful nutrition metrics:

* Calories
* Protein
* Carbohydrates
* Fat

Additional information may be generated internally if necessary, but do not overwhelm the user with micronutrients, vitamins, minerals, etc. unless specifically requested.

For exercise, primarily record:

* Exercise type
* Duration
* Intensity
* Estimated calories burned

Additional metrics can exist when appropriate, such as distance, repetitions, sets, or steps, but they should not be mandatory.

---

## APPLICATION STRUCTURE

Create these primary sections:

1. Dashboard / Home
2. Meals
3. Exercise
4. AI Coach
5. Goals
6. Profile / Settings

The bottom navigation on mobile should prioritize:

Home
Meals
Exercise
AI Coach
Profile

---

## FLOW 1 — LANDING / AUTHENTICATION

When a user first opens the application, show a clean landing page.

Purpose:
Explain the value of the application quickly.

Example messaging:

"Track what you eat.
Track how you move.
Let AI help you reach your goal."

Primary action:
Get Started

Secondary action:
Log In

Authentication can support:

* Email
* Google authentication where available

After authentication, determine whether the user has completed onboarding.

If onboarding is incomplete:
→ send user to onboarding.

If onboarding is complete:
→ send user directly to Dashboard.

---

## FLOW 2 — ONBOARDING / PERSONAL INFORMATION

This step is extremely important.

The application must collect enough information to calculate reasonable calorie and nutrition targets.

Ask for:

Basic information:

* Name
* Date of birth / age
* Biological sex
* Height
* Current weight

Activity information:

* Typical activity level
* Sedentary
* Lightly active
* Moderately active
* Very active
* Extremely active

Goal:

* Lose weight
* Maintain weight
* Gain weight
* Build muscle / body recomposition

Target information:

* Target weight
* Preferred weekly weight change where applicable

Exercise information:

* Typical number of workout days per week
* Typical workout duration
* Preferred exercise types

Optional:

* Dietary preference
* Halal
* Vegetarian
* Vegan
* Other
* Food allergies
* Foods user avoids

Do not ask unnecessary questions.

The onboarding process should feel like a short wizard, not a long medical questionnaire.

Use approximately 4–6 steps.

Example:

Step 1:
About You

Step 2:
Body Information

Step 3:
Activity

Step 4:
Goal

Step 5:
Preferences

Step 6:
Review

---

## CALORIE TARGET CALCULATION

The application should calculate a baseline calorie target from the user's information.

Use a scientifically reasonable BMR/TDEE calculation.

Do not hard-code a universal calorie target.

The calculation should consider:

* Age
* Sex
* Height
* Weight
* Activity level
* Goal
* Desired rate of change

The system should distinguish between:

BMR
Estimated daily energy expenditure
Goal calorie intake

Example:

BMR:
1,720 kcal

Estimated maintenance:
2,350 kcal

Weight-loss target:
2,050 kcal/day

These are estimates, not medical measurements.

Clearly communicate that AI-generated nutrition and calorie estimates are approximate.

---

## FLOW 3 — DASHBOARD

The Dashboard is the main screen.

It should answer three questions immediately:

1. How much have I eaten?
2. How much activity have I completed?
3. Am I currently on track?

Display:

Calories consumed:
1,450 / 2,200 kcal

Protein:
82 / 150 g

Carbohydrates:
165 / 250 g

Fat:
45 / 70 g

Calories burned through exercise:
420 kcal

Exercise:
35 / 60 minutes

Also show:

Remaining calories
Remaining protein
Remaining exercise target

Example:

1,450 kcal consumed
750 kcal remaining

82 g protein
68 g remaining

35 min exercise
25 min recommended

Use visually simple progress indicators.

Avoid excessive charts.

---

## FLOW 4 — ADD MEAL

The Add Meal experience should be one of the most important features.

There should be several ways to log food.

Option A:
Take a photo

Option B:
Upload a food image

Option C:
Describe the meal using text

Option D:
Use natural-language AI input

Example:

"I ate two pieces of roti canai and dhal for breakfast."

The user should NOT have to manually enter calories.

---

## MEAL PHOTO AI FLOW

When the user uploads a meal photo:

1. Show the image
2. Send it to Gemini 3.8 Flash
3. Ask AI to identify the main foods
4. Estimate portions
5. Estimate calories
6. Estimate protein
7. Estimate carbohydrates
8. Estimate fat
9. Identify obvious uncertainty
10. Return structured JSON
11. Display the result
12. Allow user correction
13. Save only after user confirmation

AI should never silently save the result.

---

## MEAL AI PROMPT BEHAVIOR

When analyzing an image, the AI should:

Identify only foods that are reasonably visible.

Do not invent ingredients.

If the exact portion cannot be determined:
provide an estimate and mark the result as approximate.

For example:

Detected:

* White rice
* Fried chicken
* Fried egg
* Sambal

Estimated portion:

* Rice: approximately 200 g
* Chicken: approximately 120 g
* Egg: 1
* Sambal: approximately 1 tablespoon

Then estimate:

Calories:
~720 kcal

Protein:
~32 g

Carbohydrates:
~76 g

Fat:
~29 g

Confidence:
Medium

Assumptions:
Rice portion estimated from visual size.

The UI should clearly communicate that image-based nutrition is an estimate.

---

## MEAL RESULT SCREEN

After AI analysis, show:

Meal name
Meal time
Food items

Nutrition summary:

Calories
Protein
Carbs
Fat

Example:

Lunch

Chicken Rice Bowl

720 kcal

Protein 32 g
Carbs 76 g
Fat 29 g

Detected foods:

✓ Chicken
✓ Rice
✓ Egg
✓ Vegetables

Allow the user to:

Edit
Remove item
Change portion
Add missing food
Change meal type
Save

Buttons:

Save Meal
Analyze Again
Cancel

---

## MEAL TEXT AI FLOW

The user should also be able to simply type:

"Breakfast: 3 eggs, 2 slices wholemeal bread and a cup of latte."

AI should transform this into structured information.

Expected result:

Breakfast

3 eggs
~210 kcal

Wholemeal bread
~160 kcal

Latte
~150 kcal

Total:
~520 kcal

Protein:
~29 g

Carbs:
~43 g

Fat:
~22 g

The system should allow the user to correct assumptions.

---

## FLOW 5 — ADD EXERCISE

Exercise should also support multiple input methods.

Manual mode:

Exercise:
Running

Duration:
30 minutes

Intensity:
Moderate

Optional:
Distance
5 km

AI then estimates:

Calories burned:
~300 kcal

Natural language mode:

The user can simply type:

"Ran 5km this morning for about 32 minutes."

AI extracts:

Exercise:
Running

Distance:
5 km

Duration:
32 minutes

Intensity:
Moderate

Estimated calories:
approximately 320 kcal

The user reviews the result before saving.

---

## EXERCISE PROMPT MODE

Allow the user to describe workouts naturally.

Examples:

"Did chest workout for 50 minutes. Bench press, incline dumbbell press and push ups."

"Walked around campus for 1 hour."

"Played badminton for 90 minutes."

"Did HIIT for 25 minutes."

AI should determine:

Exercise category
Duration
Intensity
Relevant metrics
Estimated calorie expenditure

For strength training, do NOT pretend calorie expenditure is perfectly accurate.

Use an estimate based on:

* User body weight
* Duration
* Exercise type
* Intensity

Show:

Estimated calories burned:
~250 kcal

Confidence:
Medium

---

## FLOW 6 — DAILY AI COACH

This is one of the core features.

The AI Coach analyzes the user's current day.

It should consider:

* Calories consumed
* Calories remaining
* Protein consumed
* Protein remaining
* Carbohydrates
* Fat
* Exercise
* Calories burned
* User's goal
* Time of day
* Recent meal history
* Recent exercise
* Weight trend where available

Then generate useful advice.

Example:

"You're doing well today.

You have consumed 1,450 of your 2,200 kcal target and 82 g of your 150 g protein goal.

You have approximately 750 kcal remaining.

Your protein intake is currently low relative to your target.

For your next meal, prioritize a high-protein option such as grilled chicken, eggs, fish, tofu, or Greek yogurt.

You have completed 35 minutes of exercise today. Another 20–25 minutes of moderate activity would bring you closer to your activity goal."

The AI should be practical.

Do not simply say:

"Eat healthier."

Instead say exactly what the user could do next.

---

## AI COACH RULES

The AI should:

1. Analyze the current situation.
2. Identify the biggest gap.
3. Recommend the simplest action.
4. Avoid unnecessary recommendations.
5. Consider the remaining time in the day.
6. Avoid encouraging extreme dieting.
7. Avoid unsafe calorie restriction.
8. Avoid pretending to provide medical advice.
9. Explain uncertainty when estimates are unreliable.
10. Encourage sustainable behavior.

Prioritize recommendations.

Example:

Priority #1:
Increase protein.

Priority #2:
Stay within remaining calories.

Priority #3:
Complete planned exercise.

Do not produce a huge essay every time.

---

## FLOW 7 — DAILY SUMMARY

At the end of each day, generate a Daily Summary.

Example:

TODAY

Calories
1,980 / 2,200 kcal

Protein
134 / 150 g

Exercise
52 / 60 min

Status:
On track

AI Summary:

"You stayed within your calorie target and reached 89% of your protein goal.

Your main improvement opportunity is protein consistency.

Tomorrow, try adding a high-protein breakfast."

The system should show whether the user:

Exceeded calorie goal
Stayed within target
Reached protein target
Completed exercise target

---

## FLOW 8 — GOALS

Create a Goals page.

Goals can include:

Daily calorie target
Daily protein target
Daily exercise target
Target weight
Workout frequency

Display progress over time.

Example:

Weight:

73 kg → 70 kg goal

Calories:

Average:
2,080 kcal/day

Protein:

Average:
142 g/day

Exercise:

Average:
47 min/day

Workout consistency:

4 / 5 days

The user can edit goals.

---

## FLOW 9 — HISTORY

The user must be able to see previous records.

Meals:

Today
Yesterday
This week
Older dates

Exercise:

Today
Yesterday
This week
Older dates

Each record should be editable.

Example meal card:

Lunch
Chicken rice

720 kcal
32 g protein

2:15 PM

Clicking opens detail.

---

## FLOW 10 — PROFILE

Profile should contain:

Personal information
Height
Weight
Age
Sex
Activity level
Goal
Target weight

Preferences
Dietary preference
Allergies
Food preferences

AI settings
Enable/disable AI suggestions
AI analysis confidence display

Account
Email
Logout

Privacy
Delete data
Delete account

---

## DATABASE CONCEPT

Design the database around these primary entities:

users
profiles
goals
meals
meal_items
exercise_logs
daily_summaries
ai_recommendations

Possible structure:

profiles:

* id
* user_id
* name
* date_of_birth
* sex
* height_cm
* weight_kg
* activity_level
* goal
* target_weight_kg
* created_at
* updated_at

goals:

* id
* user_id
* calorie_target
* protein_target
* carbohydrate_target
* fat_target
* exercise_minutes_target
* target_weight
* created_at
* updated_at

meals:

* id
* user_id
* meal_type
* meal_time
* source
* image_url
* description
* calories
* protein
* carbohydrates
* fat
* confidence
* ai_analysis
* created_at

meal_items:

* id
* meal_id
* name
* estimated_quantity
* estimated_unit
* calories
* protein
* carbohydrates
* fat
* confidence

exercise_logs:

* id
* user_id
* exercise_type
* duration_minutes
* intensity
* distance
* calories_burned
* source
* description
* confidence
* ai_analysis
* created_at

daily_summaries:

* id
* user_id
* date
* calories_consumed
* protein_consumed
* carbohydrate_consumed
* fat_consumed
* calories_burned
* exercise_minutes
* ai_summary

ai_recommendations:

* id
* user_id
* date
* recommendation
* priority
* created_at

---

## AI ARCHITECTURE

Gemini should NOT directly control the UI.

Use this architecture:

USER INPUT
↓
Frontend
↓
Backend/API
↓
Gemini 3.8 Flash
↓
Structured JSON response
↓
Validation
↓
Frontend review screen
↓
User confirmation
↓
Database
↓
Dashboard / AI Coach

Never trust raw AI output blindly.

Validate AI responses before saving them.

Use strict structured JSON schemas.

Example meal response:

{
"meal_type": "lunch",
"foods": [
{
"name": "white rice",
"estimated_quantity": 200,
"unit": "g",
"calories": 260,
"protein_g": 5,
"carbs_g": 57,
"fat_g": 1
}
],
"total": {
"calories": 720,
"protein_g": 32,
"carbs_g": 76,
"fat_g": 29
},
"confidence": "medium",
"assumptions": [
"Rice portion estimated from visual size"
]
}

Do not store arbitrary natural-language AI responses as the primary source of truth.

Store structured values.

---

## IMPORTANT AI SAFETY / ACCURACY PRINCIPLES

Nutrition from images is inherently approximate.

The AI must NOT claim:

"This meal contains exactly 734 calories."

Instead say:

"Estimated: approximately 730 kcal."

Use confidence:

High
Medium
Low

When food identification is uncertain, ask the user to confirm.

Example:

"I believe this is grilled chicken. Is that correct?"

Do not hallucinate invisible ingredients.

Do not diagnose diseases.

Do not prescribe medical treatments.

Do not encourage dangerous weight loss.

If the user gives information suggesting potentially dangerous behavior, provide a safe recommendation and encourage professional guidance.

---

## USER EXPERIENCE RULE

The application should minimize typing.

A user should be able to perform most actions in under 10 seconds.

Examples:

Meal:
Take photo → AI analyzes → Review → Save

Exercise:
Type:
"Ran 5 km for 30 minutes"
→ AI parses → Review → Save

Daily coaching:
Open Dashboard → instantly see what to do next.

---

## QUICK ACTIONS

The Dashboard should have large quick actions:

* Add Meal

* Add Exercise

Ask AI

View Today's Summary

These should be accessible without navigating through several menus.

---

## AI INPUT BOX

Add a persistent natural-language input component.

Placeholder:

"Tell me what you ate or what exercise you did..."

Examples:

"I ate nasi ayam for lunch."

"Ran 5 km this morning."

"Had two eggs and toast."

"Did a 45-minute gym session."

AI determines whether the input represents:

Meal
Exercise
Both
Question

If ambiguous, ask a clarification question.

---

## AI COACH CHAT

The AI Coach should also function as a conversational assistant.

Examples:

User:
"Can I still eat dinner?"

AI:
"Yes. You have around 650 kcal remaining today and you're still 48 g short of your protein target. A high-protein dinner around 500–600 kcal would fit your current target."

User:
"What should I eat?"

AI:
"Prioritize protein because that is currently your largest gap. Grilled chicken with rice and vegetables would fit your remaining calories."

The AI should use the user's actual logged data rather than generic advice.

---

## DESIGN SYSTEM

Design should feel modern, premium, clean, and trustworthy.

Style:

* Mobile-first
* Dark/light mode optional
* Rounded cards
* Clear typography
* Large touch targets
* Minimal clutter
* Strong visual hierarchy
* Smooth animations
* Simple charts
* Clear progress indicators

Avoid making it look like a medical hospital dashboard.

The feeling should be:

modern fitness app + AI assistant + simple personal tracker.

---

## RESPONSIVE DESIGN

The application must work well on:

Mobile phone
Tablet
Desktop

Mobile is the primary target.

Desktop can use a wider dashboard layout.

Tablet should have enough spacing for touch interaction.

The PWA should support:

Install to home screen
Responsive viewport
Offline-friendly UI where practical
Fast loading
Persistent login session

---

## PWA REQUIREMENTS

Since this will replace a native iOS application for now:

Implement it as a Progressive Web App.

Include:

manifest.json
service worker
app icons
mobile viewport configuration
installable behavior
responsive layout
offline fallback

The application should be usable through Safari on iPhone/iPad and Chrome/Edge on Android/Windows.

Do not require an App Store deployment.

---

## ERROR HANDLING

AI can fail.

The application must handle:

AI timeout
API error
Invalid AI response
Image upload failure
Network failure
Database failure
Unknown food
Unknown exercise

Do not show technical error messages to normal users.

Example:

Bad:
"Gemini API returned status 500."

Good:
"We couldn't analyze this right now. Please try again."

Provide a manual fallback.

---

## AI COST CONTROL

Do not call Gemini unnecessarily.

Only invoke AI when:

* User requests image analysis
* User uses natural-language logging
* User requests AI coaching
* AI-generated daily summary is needed

Do not continuously call AI on every dashboard refresh.

Cache generated recommendations where appropriate.

---

## SECURITY

Never expose Gemini API keys in the frontend.

Architecture must be:

Frontend
↓
Secure backend/server function
↓
Gemini API

The Gemini API key must remain server-side.

Users must only access their own health and activity records.

Implement appropriate database authorization / row-level security.

---

## MAIN USER JOURNEY

The complete ideal journey is:

Landing page
↓
Sign Up
↓
Personal onboarding
↓
Calculate initial targets
↓
Dashboard
↓
Add Meal
↓
Take photo
↓
Gemini analyzes meal
↓
User reviews result
↓
Save
↓
Dashboard updates
↓
Add Exercise
↓
User types natural language
↓
Gemini parses exercise
↓
User reviews result
↓
Save
↓
Dashboard updates
↓
AI Coach evaluates remaining goals
↓
User receives actionable recommendation
↓
User follows recommendation
↓
Daily Summary
↓
Progress tracking

---

## EXAMPLE FULL DAY

User profile:

Male
Age: 22
Height: 176 cm
Weight: 73 kg
Goal: Lose fat while maintaining/building muscle
Activity: Moderately active

Daily targets:

Calories:
2,200 kcal

Protein:
150 g

Exercise:
60 min

Breakfast:

User uploads photo.

AI detects:

Eggs
Toast
Latte

Estimated:

520 kcal
29 g protein
43 g carbs
22 g fat

User confirms.

Lunch:

User types:

"I ate chicken rice with extra chicken."

AI analyzes.

Estimated:

720 kcal
45 g protein
75 g carbs
20 g fat

User confirms.

Exercise:

User types:

"Jogged 30 minutes at moderate pace."

AI calculates:

~250 kcal burned

Dashboard now shows:

Calories:
1,240 / 2,200

Protein:
74 / 150 g

Exercise:
30 / 60 min

AI Coach:

"You are on track with calories but protein is currently low.

For your next meal, prioritize approximately 40–50 g of protein.

You also have about 30 minutes remaining on your exercise target."

Dinner:

User uploads meal.

AI calculates.

Dashboard updates.

End of day:

AI generates summary.

---

## IMPORTANT DEVELOPMENT RULE

Do NOT build every feature simultaneously.

Build the application incrementally.

Recommended development order:

PHASE 1
Authentication
Onboarding
Profile
Goal calculation
Dashboard

PHASE 2
Meal logging
Manual meal records
Photo upload
Gemini meal analysis
Meal confirmation

PHASE 3
Exercise logging
Natural-language exercise parsing
Exercise calorie estimation

PHASE 4
AI Coach
Daily recommendations
Natural-language AI chat

PHASE 5
History
Goals
Progress
Charts

PHASE 6
PWA
Offline support
Performance
Polish
Animations
Accessibility

At every phase, maintain a working application.

---

## WHEN GENERATING UI

Do not generate random pages independently.

Every page must connect to the overall user journey.

The user should always know:

Where am I?
What have I achieved?
What can I do next?

Every AI-generated value should have an understandable explanation when necessary.

The application should feel like:

"An intelligent personal nutrition and exercise assistant"

rather than:

"Another calorie calculator."

---

## FINAL DESIGN GOAL

The core experience should be:

CAPTURE
↓
AI UNDERSTANDS
↓
USER CONFIRMS
↓
RECORD SAVED
↓
GOALS UPDATED
↓
AI COACH RESPONDS
↓
USER KNOWS WHAT TO DO NEXT

Optimize the entire application around this loop.


Build incrementally, in this order, keeping the app working at the end of every phase:

1. **Phase 1** — Auth, onboarding wizard, profile, BMR/TDEE goal calculation, dashboard shell
2. **Phase 2** — Meal logging: manual entry, photo upload, Gemini meal analysis via Edge Function, review/confirm screen before saving
3. **Phase 3** — Exercise logging: manual entry, natural-language parsing via Gemini, calorie estimate, review/confirm before saving
4. **Phase 4** — AI Coach: daily recommendations, conversational chat using the user's actual logged data
5. **Phase 5** — History, Goals page, progress views
6. **Phase 6** — PWA polish: offline support, install prompts, performance, accessibility

## Non-negotiable rules
- Never let the AI silently save a result — the user must always review and confirm before anything is written to the database.
- Nutrition/calorie values from AI must always be labeled as estimates, with a confidence level (high/medium/low), never stated as exact.
- Never call Gemini from the frontend directly — always through an Edge Function.
- Every database write must go through the existing RLS-protected tables — do not create new tables or bypass the schema.
- Handle AI/network/database failures with plain, non-technical error messages to the user (e.g. "We couldn't analyze this right now. Please try again." — never raw error codes).
