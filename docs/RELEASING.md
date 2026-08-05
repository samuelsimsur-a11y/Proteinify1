# Releasing Wise Dish (web + Android)

## What `npm run android:bundle-release` does

Do **not** reimplement this. `./release.sh` calls it as-is:

1. `npm run build:android`
   - Android-build guard
   - Generate Android icons
   - **Stamp** `public/version.json` from root `version.json` + git SHA
   - `WISEDISH_STATIC_EXPORT=true next build` → writes static UI to `out/`
   - Stamp again into `out/version.json`
   - **`npx cap sync android`** → copies `out/` into the Android project assets
2. `cd android && ./gradlew bundleRelease` → signed AAB

Skipping `cap sync` ships a **stale web UI** inside a clean-looking AAB.

## One-time Play API setup (Phase 3)

1. Google Cloud: create a service account + JSON key; enable **Android Publisher API**.
2. Play Console → Users and permissions → invite the service account email.
3. App-specific: allow **Release apps to testing tracks** only. Leave production release **unchecked**.
4. Save the JSON **outside** the repo and export:

```bash
export PLAY_SERVICE_ACCOUNT_JSON=/absolute/path/to/key.json
```

5. Seed `version.json` from live tracks (never from memory):

```bash
npm run play:report
npm run play:seed
```

Resolve any mismatch between repo and Play before bumping.

## Dry-run (default)

```bash
./release.sh patch --track internal
```

Prints every command; **no** network writes. Track name must be a **literal** Play API track id from `--report` / `--list-tracks` (do not assume `closed` == `alpha`).

## Live internal/closed testing release

```bash
./release.sh patch --track internal --live
```

Sequence: preflight → bump → stamp → `npm run android:bundle-release` → GPP `publishBundle` → `npm run build` → `vercel deploy` (preview) → `verify.js`.

Then promote web only after you inspect the preview:

```bash
./release.sh promote-web https://your-deployment.vercel.app
```

`release.sh` never runs `vercel --prod` and never targets the Play production track.

## Verify failures

`scripts/verify.js` prints a TSV table: `surface`, `expected`, `actual`, `status`.

| Failure | What to do |
|---------|------------|
| Play MISS | Wait for processing, or check you used the correct literal `--track` |
| Web MISS | Confirm preview URL; ensure `public/version.json` was stamped before deploy |
| UNKNOWN_TRACK | `node scripts/play-client.js --list-tracks` and use an exact name |

## Rollback

- **Web:** Vercel dashboard → Promote previous deployment, or `vercel promote <older-url>`.
- **Play testing track:** Halt rollout / create a new higher `versionCode` release. You cannot decrease `versionCode`.

## Flags

| Flag | Meaning |
|------|---------|
| `--track <name>` | Literal Play track API name (default `internal`) |
| `--live` | Perform uploads/deploys (still preview web only) |
| `--skip-web` | Android / Play only |
| `--skip-android` | Web preview only |
| `promote-web <url>` | Promote a verified preview to production alias |

## Env

| Var | Purpose |
|-----|---------|
| `PLAY_SERVICE_ACCOUNT_JSON` | Absolute path to Play service account JSON |
| `PLAY_PACKAGE_NAME` | Optional override (default `com.wisedish.app`) |
