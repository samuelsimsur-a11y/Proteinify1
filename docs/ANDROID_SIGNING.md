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
