# Wise Dish on Vercel

## Project name

The linked Vercel project is **`wisedish`** (see `.vercel/project.json`).

## Production URL

Set these in **Project → Settings → Environment Variables** (Production + Preview):

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | `https://wisedish.vercel.app` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://wisedish.vercel.app` |
| `CAPACITOR_SERVER_URL` | `https://wisedish.vercel.app` |

## Rename from an old deployment

1. In Vercel: **Project Settings → General → Project Name** → `wisedish`.
2. **Domains**: add `wisedish.vercel.app` (or your custom domain) and remove old hosts when traffic has moved.
3. Redeploy: `vercel deploy --prod`.
4. Optional: set `NEXT_PUBLIC_API_FALLBACK_URLS` to a comma-separated list of any **previous** API origins so Capacitor installs can still reach `/api/*` during migration.

## Android

After env is set on Vercel, align local Capacitor:

```bash
CAPACITOR_SERVER_URL=https://wisedish.vercel.app npx cap sync android
```
