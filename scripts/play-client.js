#!/usr/bin/env node
/**
 * Read-only Google Play Developer API v3 client.
 * Auth: PLAY_SERVICE_ACCOUNT_JSON=/absolute/path/to/key.json
 *
 * Usage:
 *   node scripts/play-client.js --report
 *   node scripts/play-client.js --list-tracks
 *   node scripts/play-client.js --validate-track <name>
 *   node scripts/play-client.js --seed-from-report
 *   node scripts/play-client.js --highest-version-code
 */

const fs = require("node:fs");
const path = require("node:path");
const { google } = require("googleapis");
const { writeVersionFile } = require("./lib/versionFile");

const PACKAGE_NAME = process.env.PLAY_PACKAGE_NAME || "com.wisedish.app";

function requireServiceAccountPath() {
  const p = process.env.PLAY_SERVICE_ACCOUNT_JSON?.trim();
  if (!p) {
    throw new Error(
      "PLAY_SERVICE_ACCOUNT_JSON is not set. Export the absolute path to the service account JSON key."
    );
  }
  if (!path.isAbsolute(p)) {
    throw new Error(`PLAY_SERVICE_ACCOUNT_JSON must be an absolute path, got: ${p}`);
  }
  if (!fs.existsSync(p)) {
    throw new Error(`Service account file not found: ${p}`);
  }
  return p;
}

async function getAndroidPublisher() {
  const keyFile = requireServiceAccountPath();
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const authClient = await auth.getClient();
  return google.androidpublisher({ version: "v3", auth: authClient });
}

/**
 * Returns { tracks: [{ track, versionCodes, status, userFraction }], highestVersionCode }
 * Track names are the literal API names from edits.tracks.list — never remapped.
 */
async function getLiveVersions() {
  const androidpublisher = await getAndroidPublisher();
  const edit = await androidpublisher.edits.insert({ packageName: PACKAGE_NAME });
  const editId = edit.data.id;
  if (!editId) throw new Error("Failed to create Play Developer API edit");

  try {
    const tracksRes = await androidpublisher.edits.tracks.list({
      packageName: PACKAGE_NAME,
      editId,
    });
    const tracks = (tracksRes.data.tracks || []).map((t) => {
      const releases = t.releases || [];
      const versionCodes = [];
      let status = "empty";
      let userFraction = null;
      for (const r of releases) {
        status = r.status || status;
        if (r.userFraction != null) userFraction = r.userFraction;
        for (const vc of r.versionCodes || []) {
          versionCodes.push(Number(vc));
        }
      }
      return {
        track: t.track,
        versionCodes: [...new Set(versionCodes)].sort((a, b) => a - b),
        status,
        userFraction,
      };
    });

    const highestVersionCode = tracks.reduce((max, t) => {
      const localMax = t.versionCodes.length ? Math.max(...t.versionCodes) : 0;
      return Math.max(max, localMax);
    }, 0);

    return { packageName: PACKAGE_NAME, tracks, highestVersionCode };
  } finally {
    try {
      await androidpublisher.edits.delete({ packageName: PACKAGE_NAME, editId });
    } catch {
      // edit cleanup is best-effort
    }
  }
}

async function getTrackStatus(trackName) {
  const live = await getLiveVersions();
  const names = live.tracks.map((t) => t.track);
  if (!names.includes(trackName)) {
    const err = new Error(
      `Unknown track "${trackName}". Live tracks: ${names.length ? names.join(", ") : "(none)"}`
    );
    err.code = "UNKNOWN_TRACK";
    err.liveTracks = names;
    throw err;
  }
  return live.tracks.find((t) => t.track === trackName);
}

async function listTrackNames() {
  const live = await getLiveVersions();
  return live.tracks.map((t) => t.track);
}

async function validateTrack(trackName) {
  await getTrackStatus(trackName);
  return true;
}

function printReport(live) {
  console.log(`packageName\t${live.packageName}`);
  console.log(`highestVersionCode\t${live.highestVersionCode}`);
  console.log("track\tversionCodes\tstatus\tuserFraction");
  for (const t of live.tracks) {
    console.log(
      `${t.track}\t${t.versionCodes.join(",") || "-"}\t${t.status}\t${t.userFraction ?? "-"}`
    );
  }
}

async function seedFromReport() {
  const live = await getLiveVersions();
  const highest = live.highestVersionCode;
  if (highest < 1) {
    console.error(
      "No versionCodes found on any Play track. Upload an initial AAB via Play Console first, then re-run --seed-from-report."
    );
    process.exit(1);
  }
  // Keep versionName from existing file if present and code matches; otherwise use 0.0.0 + code as placeholder name
  let versionName = "0.0.0";
  try {
    const existing = JSON.parse(fs.readFileSync(path.join(__dirname, "../version.json"), "utf8"));
    if (existing.versionCode === highest && typeof existing.versionName === "string") {
      versionName = existing.versionName;
    } else if (typeof existing.versionName === "string" && /^\d+\.\d+\.\d+$/.test(existing.versionName)) {
      // Live code ahead of or different from repo — keep name for human editing, set code from live
      versionName = existing.versionName;
    }
  } catch {
    // ignore
  }
  const written = writeVersionFile({
    versionName,
    versionCode: highest,
    seededFrom: "play-report",
    seedNote: `Seeded ${new Date().toISOString()} from edits.tracks.list; highestVersionCode=${highest}`,
  });
  console.log("Seeded version.json from live Play report:");
  console.log(JSON.stringify(written, null, 2));
  if (versionName === "0.0.0") {
    console.log(
      "NOTE: versionName is 0.0.0 placeholder — set a real semver in version.json before bumping."
    );
  }
  printReport(live);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || "--report";

  if (cmd === "--report") {
    const live = await getLiveVersions();
    printReport(live);
    return;
  }
  if (cmd === "--list-tracks") {
    const names = await listTrackNames();
    console.log(names.join("\n") || "(no tracks)");
    return;
  }
  if (cmd === "--validate-track") {
    const name = args[1];
    if (!name) {
      console.error("Usage: node scripts/play-client.js --validate-track <literal-track-name>");
      process.exit(1);
    }
    await validateTrack(name);
    console.log(`OK\t${name}`);
    return;
  }
  if (cmd === "--seed-from-report") {
    await seedFromReport();
    return;
  }
  if (cmd === "--highest-version-code") {
    const live = await getLiveVersions();
    console.log(String(live.highestVersionCode));
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}

module.exports = {
  getLiveVersions,
  getTrackStatus,
  listTrackNames,
  validateTrack,
  PACKAGE_NAME,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
