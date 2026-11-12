# Strava setup (one time, about 10 minutes)

Nuvia's Strava connection is built in. Strava needs an API app that belongs to
you, so three things have to be done on your accounts. Do them in this order.

## 1. Create the Strava API app

Requires a paid Strava subscription (Strava's rule for creating API apps).

1. Sign in on the web at <https://www.strava.com/settings/api>.
2. Fill in the form:
   - **Application Name:** Nuvia
   - **Category:** Training (or Other)
   - **Website:** `https://nuvia-ai-fitness.vercel.app`
   - **Authorization Callback Domain:** `nuvia-ai-fitness.vercel.app`
     (domain only, no `https://`, no path)
3. Upload any icon and create the app.
4. On the app page, note the **Client ID** and **Client Secret**.

New Strava apps work for **your own Strava account only** ("single player
mode"). That is all Nuvia needs for personal use.

## 2. Add three settings in Vercel

Vercel → project **nuvia-ai-fitness** → **Settings → Environments → Production
→ Environment Variables** → add:

| Key | Value |
|---|---|
| `STRAVA_CLIENT_ID` | the Client ID from step 1 |
| `STRAVA_CLIENT_SECRET` | the Client Secret from step 1 (mark **Sensitive**) |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | any random word, e.g. a 32-character string |

Then **redeploy** (Deployments → ⋯ on the latest production deployment →
Redeploy). New variables only reach a fresh deployment.

## 3. Create the database table in Supabase

Supabase dashboard → your project → **SQL Editor** → **New query** → paste the
contents of `supabase/migrations/20261112_strava_connections.sql` → **Run**.

It creates `strava_connections` with row-level security on and no policies, so
only the server can read the stored Strava tokens.

## 4. Connect

1. Open Nuvia (signed in) → **Profile → Connected apps → Strava**.
2. Tap **Connect with Strava**, approve on Strava (keep "View data about your
   activities" ticked).
3. You return to Nuvia with "Strava connected". Your last 30 days are imported,
   and the webhook subscription is created automatically, so new activities
   arrive within seconds of being saved on Strava.

## How it behaves

- Each activity is logged on the day it started. Calories come from Strava
  when available, otherwise they are estimated from your body weight.
- A session that reaches Nuvia from both Strava and Apple Health (same type,
  starting within 3 minutes) is logged once.
- Renaming or changing the type on Strava updates Nuvia; deleting it on Strava
  removes it from Nuvia.
- **Disconnect** revokes Nuvia's access on Strava and deletes the stored
  tokens; you can also remove the imported activities.
- Revoking Nuvia on Strava (Settings → My Apps) also disconnects it.

## Troubleshooting

- **"Strava isn't set up on the server yet"**: a Vercel setting is missing or
  the app was not redeployed, or the SQL in step 3 was not run.
- **New activities don't arrive automatically**: use **Sync now**. If that
  works but automatic sync doesn't, check the Vercel logs for
  `[strava] webhook subscription failed`; the callback domain must match the
  deployed domain exactly.
- **Rate limit**: Strava allows 100 reads per 15 minutes. Sync now pulls at
  most 200 activities.
