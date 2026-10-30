# Tester check

Finds out why testers see **"App not available"** on the Wise Dish closed test. It opens a separate Chrome window with its own profile (your normal Chrome is untouched). You sign in to Google there yourself, and the script reads:

- the opt-in page (`play.google.com/apps/testing/com.wisedish.app`) for that account
- the `wisedish-testers` Google Group: membership, members, pending requests and settings
- Play Console: opted-in testers, the closed test's Testers tab, App availability and Publishing overview

It only reads pages. It never clicks Join, Become a tester, Save or anything that changes a setting.

```bash
cd tools/tester-check
npm install
npm run check               # sign in with your Play Console (developer) account
npm run check -- --tester   # optional: sign in with a tester account
```

Emails in the terminal output are masked. Screenshots and page text are saved to `~/Desktop/wisedish-check/` and include your testers' emails, so keep them private. The sign-in stays in `~/.wisedish-check/` for the next run; delete that folder to sign out.
