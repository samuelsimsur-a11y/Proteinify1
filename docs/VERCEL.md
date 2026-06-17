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
