#!/usr/bin/env node
/**
 * Bump version.json: patch | minor | major
 * - Refuses dirty git working tree
 * - Increments versionCode by exactly 1
 * - Refuses versionCode <= highest live on any Play track (when credentials available)
 */

const { execSync } = require("node:child_process");
const {
  ROOT,
  readVersionFile,
  writeVersionFile,
  bumpSemver,
} = require("./lib/versionFile");

function assertCleanTree() {
  const status = execSync("git status --porcelain", { cwd: ROOT, encoding: "utf8" }).trim();
  if (status) {
    console.error("Working tree is dirty. Commit or stash before bumping version:");
    console.error(status);
    process.exit(1);
  }
}

async function highestLiveVersionCode() {
  if (!process.env.PLAY_SERVICE_ACCOUNT_JSON) {
    console.warn(
      "WARN: PLAY_SERVICE_ACCOUNT_JSON unset — skipping live versionCode floor check. Set it before --live releases."
    );
    return null;
  }
  const { getLiveVersions } = require("./play-client");
  const live = await getLiveVersions();
  return live.highestVersionCode;
}

async function main() {
  const kind = process.argv[2];
  if (!["patch", "minor", "major"].includes(kind)) {
    console.error("Usage: node scripts/bump-version.js <patch|minor|major>");
    process.exit(1);
  }

  assertCleanTree();

  const current = readVersionFile();
  if (current.seededFrom === "repo-bootstrap") {
    console.error(
      "version.json is still repo-bootstrap. Run Phase 3 first:\n  node scripts/play-client.js --seed-from-report"
    );
    process.exit(1);
  }

  const nextName = bumpSemver(current.versionName, kind);
  const nextCode = current.versionCode + 1;

  const liveHighest = await highestLiveVersionCode();
  if (liveHighest != null && nextCode <= liveHighest) {
    console.error(
      `Refusing bump: proposed versionCode ${nextCode} <= highest live ${liveHighest}. Re-seed from Play and try again.`
    );
    process.exit(1);
  }

  const written = writeVersionFile({
    versionName: nextName,
    versionCode: nextCode,
    seededFrom: "bump",
  });
  console.log(`bumped\t${current.versionName}+${current.versionCode}\t->\t${written.versionName}+${written.versionCode}`);
  console.log(JSON.stringify(written));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
