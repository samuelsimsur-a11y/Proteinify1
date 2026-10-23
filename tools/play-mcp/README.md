# Wise Dish Google Play MCP

A local MCP server that lets Claude Desktop manage Wise Dish on Google Play through the official
Google Play Developer API. It signs in with a **service account key**, never your Google password,
and runs only on your Mac.

| Tool | What it does |
| --- | --- |
| `list_releases` | Lists every track, its releases and version codes, and the next free version code (read-only) |
| `upload_bundle` | Uploads a signed AAB to **internal, alpha or beta**. Production uploads are blocked. |
| `promote_release` | Copies a tested release to another track. Production also needs `confirm_production: true`. Supports staged rollouts. |
| `list_reviews` | Recent Play reviews with text (read-only) |
| `reply_to_review` | Posts a public reply to a review |

## Setup (one time)

### 1. Create the service account (Google Cloud, about 5 minutes)

1. Open [Google Cloud Console](https://console.cloud.google.com/). Pick or create a project.
2. **APIs & Services → Library** → search for **Google Play Android Developer API** → **Enable**.
3. **IAM & Admin → Service accounts → Create service account**. Name it something like `wisedish-play`. Skip the optional role steps.
4. Open the new account → **Keys → Add key → Create new key → JSON**. A file downloads.
5. Move the key out of Downloads, somewhere outside the project:
   ```bash
   mkdir -p ~/.secrets && chmod 700 ~/.secrets
   mv ~/Downloads/<the-key-file>.json ~/.secrets/play-service-account.json
   chmod 600 ~/.secrets/play-service-account.json
   ```

### 2. Give it access in Play Console

1. Play Console → **Users and permissions → Invite new users**.
2. Paste the service account's email (`...@....iam.gserviceaccount.com`, shown in the JSON as `client_email`).
3. Under **App permissions**, add Wise Dish. Grant **Release to testing tracks**, plus **View app information** and **Reply to reviews** if you want the review tools.
   Add **Release to production** only once you trust the setup. Without it, production stays a click only you can make.
4. **Invite user**. Access can take a few minutes to start working.

Google only accepts API uploads once the app exists and has at least one AAB uploaded by hand in Play Console.

### 3. Install and test the connection

```bash
cd /Users/samuelsuresh/proteinify/tools/play-mcp
npm install
PLAY_KEY_FILE=~/.secrets/play-service-account.json npm run check
```

`Connected to Google Play for com.wisedish.app.` plus a list of tracks means it works. Any error comes with a hint on what to fix.

### 4. Add it to Claude Desktop

Claude Desktop → **Settings → Developer → Edit Config**. Add this to `claude_desktop_config.json`, merging with anything already under `mcpServers`:

```json
{
  "mcpServers": {
    "wisedish-google-play": {
      "command": "node",
      "args": ["/Users/samuelsuresh/proteinify/tools/play-mcp/index.js"],
      "env": {
        "PLAY_KEY_FILE": "/Users/samuelsuresh/.secrets/play-service-account.json"
      }
    }
  }
}
```

Quit Claude Desktop completely (Cmd+Q) and reopen it. The tools show up under the tools (🔨) menu.
If `node` isn't found, replace `"node"` with the output of `which node`.

## Using it

Ask Claude Desktop things like:

- "What's on each Play track and what's the next version code?"
- "Upload the AAB to internal testing with notes: Fixed the dish slider."
- "Promote version 3 from internal to production at 20%."
- "Show this week's reviews and draft replies for me to approve."

Keep Claude Desktop set to ask before each tool call, so you approve every upload, promotion and reply.

The AAB still has to be built first:
```bash
npm run build:android && cd android && ./gradlew bundleRelease -PversionCode=<next> -PversionName=<x.y.z>
```

## Uploading from the terminal

Large AABs or slow connections can make a Claude Desktop tool call time out mid-upload. The same upload works from a terminal, with no time limit:

```bash
cd /Users/samuelsuresh/proteinify/tools/play-mcp
PLAY_KEY_FILE=~/.secrets/play-service-account.json npm run upload -- alpha "Bug fixes and improvements."
```

If a Claude upload timed out, run `npm run check` first. If the version code already shows on the track, the upload went through.

## Safety

- The key file is a password for your Play account. Keep it in `~/.secrets/`, never in the project folder, and never paste it into a chat.
- If it leaks, delete the key in Google Cloud → Service accounts → Keys. That cuts off access immediately.
- Uploads can't target production. Promoting to production needs an explicit confirmation flag, and also the Play permission if you didn't grant it.
