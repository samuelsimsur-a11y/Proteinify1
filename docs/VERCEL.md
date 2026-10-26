# Wise Dish on Vercel

## Project name

The linked Vercel project is **`wisedish`** (see `.vercel/project.json`).

## Production URL

**Production:** `https://wisedish.vercel.app` (Vercel project **`wisedish`**, renamed from `foodzap`).

Legacy aliases (`foodzap-khaki.vercel.app`, etc.) still work; Android/API clients try them as fallbacks.

Set these in **Project → Settings → Environment Variables** (Production + Preview):

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_SITE_URL` | `https://wisedish.vercel.app` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://wisedish.vercel.app` |
| `CAPACITOR_SERVER_URL` | `https://wisedish.vercel.app` |
| `NEXT_PUBLIC_API_FALLBACK_URLS` | `https://foodzap-khaki.vercel.app,https://foodzap-protify.vercel.app` |

## Rename from an old deployment

1. In Vercel: **Project Settings → General → Project Name** → `wisedish`.
2. **Domains**: add `wisedish.vercel.app` (or your custom domain) and remove old hosts when traffic has moved.
3. Redeploy: `vercel deploy --prod`.
4. Optional: set `NEXT_PUBLIC_API_FALLBACK_URLS` to a comma-separated list of any **previous** API origins so Capacitor installs can still reach `/api/*` during migration.

## Android

**Release builds** bundle static UI from `out/` (no remote `server.url`). Generation calls `https://wisedish.vercel.app/api/*` when online.

```bash
npm run build:android    # static export → out/ → cap sync
npm run android:sync     # loads CAPACITOR_SERVER_URL from .env.local when set
```

**Dev live-reload** (optional):

```bash
CAPACITOR_SERVER_URL=http://localhost:3000 npm run android:sync
```

## Feedback, analytics and API protection (1.0.3)

| Variable | Where | What it does |
|----------|-------|--------------|
| `FEEDBACK_WEBHOOK_URL` | Production + Preview, **not** `NEXT_PUBLIC_` | Discord or Slack incoming-webhook URL. In-app feedback and “I cooked this” ratings are posted there. Without it, feedback only reaches Vercel’s short-lived logs. |
| `CORS_ALLOWED_ORIGINS` | optional | Extra comma-separated origins allowed to call `/api/*` from a browser. The web app, its Vercel previews/aliases and the Android app (`https://localhost`) are allowed already. |
| `CORS_ALLOW_ALL` | optional | `true` turns the origin check off (emergency switch). |

**Discord webhook in 1 minute:** Discord → your server → channel ⚙ → Integrations → Webhooks → New Webhook → Copy Webhook URL → paste as `FEEDBACK_WEBHOOK_URL` in Vercel → redeploy.

**Funnel analytics** go to Microsoft Clarity (already installed) as custom events: `generate_started`, `generate_quick_ready`, `generate_succeeded`, `generate_failed`, `example_opened`, `swap_requested` / `swap_succeeded` / `swap_failed`, `recipe_copied`, `recipe_shared`, `cooked`, `milestone_unlocked`, `feedback_sent`. In Clarity: Dashboard → Filters → Custom events.

**Cost safety:** set a monthly budget on the OpenAI project that owns `OPENAI_API_KEY` (platform.openai.com → Settings → Limits). Rate limits in `/api/generate` are per server instance, so the budget is the real backstop.

## Instant example results

`src/data/exampleResults.json` holds pre-generated results for the example dishes so a new user sees one instantly. After deploying a new API version, refresh them and rebuild:

```bash
npm run bake:examples        # calls https://wisedish.vercel.app/api/generate for the 7 example dishes
npm run build:android        # or redeploy the web app
```
