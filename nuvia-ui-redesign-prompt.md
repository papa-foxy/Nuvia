# Nuvia — UI Redesign Prompt (styling only, not a rebuild)

## Scope
The app is already built and functional (Next.js frontend, Supabase backend, Gemini 3.8 Flash via Edge Functions). This is a **visual redesign of the existing UI only**.

Do NOT:
- Change any data fetching, API calls, Supabase queries, or Edge Function logic
- Change the database schema
- Rename routes, component props, or state variables unless purely cosmetic
- Rebuild any screen from scratch — restyle the existing components in place

DO:
- Restyle layout, typography, spacing, color, and information hierarchy across every existing screen
- Rename "AI Coach" references in the UI (labels, screen titles) to **Nuvia**

## Design direction
Apple Human Interface Guidelines as the primary UX philosophy — apply the principles, not Apple's literal visual skin. Do not clone Apple's UI or branding.

1. **Minimal visual clutter.** Every screen: clear title → primary metric → supporting detail → action. Avoid colorful-card-plus-chart combos.
2. **Typography carries hierarchy, not color or boxes.** Large semibold numbers for primary stats (e.g. ~48px for calorie total), smaller regular-weight labels. Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif`.
3. **Subtle grouping over heavy cards.** Thin dividers or whitespace between sections (Calories / Protein / Activity / Nuvia) instead of bordered, shadowed, rounded boxes everywhere.
4. **Contextual actions, not a button wall.** Replace stacked "Add Meal" / "Add Exercise" / "Ask AI" buttons with one prominent "+" / "Log" action that reveals meal/exercise options.
5. **Large page titles, scrolling content underneath.** No oversized permanent navbar.
6. **One accent color, used semantically.** Neutral base (background `#F5F5F7`, primary text `#1D1D1F`, secondary text `#86868B`), one accent (e.g. `#34C759`) reserved for primary actions/selected states. Elsewhere, color still signals status — green = on target, orange = attention, red = significant issue — but don't tint every number green.
7. **Nuvia is integrated, not a chatbot.** No chat-bubble/bot-avatar UI. Surface Nuvia's advice as a short, direct block wherever relevant (dashboard, meal result, exercise result) — e.g. "You're 38g short of your protein target. For your next meal: chicken + rice + vegetables, ≈520 kcal, ≈42g protein." Keep a simple "Ask Nuvia" input for follow-up questions, but it's secondary, not the primary interface.
8. **Simple bottom navigation, 4 destinations + one central action.** e.g. Today | Meals | (+) | Activity | Profile — the "+" visually dominant.
9. **Health-app style drill-downs.** Dashboard shows compact summaries; tapping a metric (e.g. Protein) opens a focused detail screen with its own trend view, rather than all charts on the home screen.
10. **Restrained materials.** Translucent/glass surfaces are fine for floating controls, sheets, and overlays (e.g. the "+" action sheet); main content areas stay flat and opaque.

Avoid: generic fitness-dashboard look, excessive cards, gradients, neon colors, gamification (badges, streaks, confetti), chatbot-style AI screen.

Target feeling: **Apple Health redesigned around AI** — not a generic colorful fitness dashboard, not a literal Apple clone.

## Suggested execution order
1. Dashboard / Today screen (highest-impact, sets the tone for everything else)
2. Bottom navigation
3. Meal result / Exercise result screens (where Nuvia's inline advice pattern first appears)
4. Onboarding wizard
5. Goals, History, Profile
6. Any remaining chatbot-style AI Coach screen → convert to contextual Nuvia pattern
