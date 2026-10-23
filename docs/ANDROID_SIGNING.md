# Android release signing (Google Play AAB)

## One-time setup

```bash
npm run android:setup-signing
```

This creates:

- `android/wisedish-release.keystore` (gitignored)
- `android/keystore.properties` (gitignored)
- `android/SIGNING_CREDENTIALS.txt` — **copy passwords to 1Password, then do not share this file**

Gradle reads `keystore.properties` automatically. **Never commit** the keystore or passwords.

## Back up signing files (local + optional Drive)

```bash
npm run android:backup-signing
```

Creates a labeled folder (default):

`~/Documents/WiseDish-Android-Play-Signing-Backup/`

and a dated zip next to it. Drag that folder to [Google Drive](https://drive.google.com) if you use Drive in the browser; this Mac may not have Drive for desktop installed.

## Build a signed AAB

```bash
npm run android:bundle-release
```

Output:

`android/app/build/outputs/bundle/release/app-release.aab`

Upload that file to Google Play Console.

## Verify signing

```bash
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
```

You should see `jar verified` and certificate details — not `jar is unsigned`.

## If you already have a keystore

Place your `.keystore` in `android/` and create `android/keystore.properties` from `keystore.properties.example`.

## Play App Signing

Google may re-sign with an app signing key after upload. You still must upload an **upload key** signed AAB — this setup is that upload key.

## Automatic uploads (GitHub Actions)

`.github/workflows/android-play-release.yml` builds a signed AAB and uploads it to Google Play.

**Run it:** GitHub → Actions → "Android → Google Play" → Run workflow (pick a track), or push a tag like `v1.0.2` (uploads to `internal`, versionName `1.0.2`).

### One-time setup

1. **First upload by hand.** Play only accepts API uploads for an app that already exists with at least one AAB. Upload `app-release.aab` once in Play Console.
2. **Service account.** In Google Cloud Console, create a service account and a JSON key, and enable the *Google Play Android Developer API*. Then, in Play Console → Users and permissions, invite the service account email and grant it release permissions for Wise Dish.
3. **Repository secrets.** Fastest: on the Mac that has the keystore, run `npm run android:ci-secrets -- ~/Downloads/<service-account>.json` (needs `gh auth login`). Or add them by hand (GitHub → Settings → Secrets and variables → Actions → Secrets):

   | Secret | Value |
   | --- | --- |
   | `ANDROID_KEYSTORE_BASE64` | `base64 -i android/wisedish-release.keystore` (one line) |
   | `ANDROID_KEYSTORE_PASSWORD` | `storePassword` from `android/keystore.properties` |
   | `ANDROID_KEY_PASSWORD` | `keyPassword` from `android/keystore.properties` |
   | `PLAY_SERVICE_ACCOUNT_JSON` | Full contents of the service account JSON key |

4. **Repository variables** (same page → Variables, all optional): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_API_FALLBACK_URLS`, `NEXT_PUBLIC_CLARITY_PROJECT_ID`, `NEXT_PUBLIC_CLARITY_DISABLED`, `ANDROID_KEY_ALIAS` (default `wisedish`), `ANDROID_VERSION_CODE_OFFSET` (default `100`).

### Version codes

CI sets `versionCode = ANDROID_VERSION_CODE_OFFSET + run number`. If Play rejects an upload because the code is already used, raise `ANDROID_VERSION_CODE_OFFSET` above the highest code in Play Console. Local builds keep the defaults in `android/app/build.gradle`.

### "Only releases with status draft may be created on draft app"

Until the app has passed its first Play review, run the workflow with **status = draft**, then roll the release out in Play Console.
