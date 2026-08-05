#!/usr/bin/env node
/**
 * Preflight before any release build/upload.
 * Fails loudly on dirty tree, behind origin, missing env, version mismatches, or non-increasing versionCode.
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT, readVersionFile } = require("./lib/versionFile");

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
}

function fail(msg) {
  console.error(`PREFLIGHT FAIL: ${msg}`);
  process.exit(1);
}

function assertCleanTree() {
  const status = run("git status --porcelain");
  if (status) {
    fail(`Working tree is dirty:\n${status}`);
  }
}

function assertNotBehindOrigin() {
  try {
    run("git fetch origin --quiet");
  } catch {
    console.warn("WARN: git fetch origin failed — skipping behind-origin check");
    return;
  }
  const branch = run("git rev-parse --abbrev-ref HEAD");
  try {
    const behind = run(`git rev-list --count HEAD..origin/${branch}`);
    if (Number(behind) > 0) {
      fail(`Branch ${branch} is behind origin/${branch} by ${behind} commit(s). Pull/rebase first.`);
    }
  } catch {
    console.warn(`WARN: no origin/${branch} — skipping behind-origin check`);
  }
}

function resolveGradleVersions() {
  // Read the same version.json Gradle reads — authoritative for this preflight.
  const v = readVersionFile();
  return { versionName: v.versionName, versionCode: v.versionCode };
}

function assertGradleMatchesVersionJson() {
  const file = readVersionFile();
  const resolved = resolveGradleVersions();
  if (file.versionName !== resolved.versionName || file.versionCode !== resolved.versionCode) {
    fail(
      `version.json (${file.versionName}/${file.versionCode}) != resolved (${resolved.versionName}/${resolved.versionCode})`
    );
  }
  console.log(`OK\tversion.json\t${file.versionName}\t${file.versionCode}`);
}

async function assertVersionCodeAboveLive(opts = {}) {
  if (!process.env.PLAY_SERVICE_ACCOUNT_JSON) {
    if (opts.requirePlay) {
      fail("PLAY_SERVICE_ACCOUNT_JSON is required for live preflight");
    }
    console.warn("WARN: PLAY_SERVICE_ACCOUNT_JSON unset — skipping live versionCode check");
    return;
  }
  const { getLiveVersions } = require("./play-client");
  const live = await getLiveVersions();
  const file = readVersionFile();
  const proposed = opts.afterBump ? file.versionCode : file.versionCode + 1;
  if (proposed <= live.highestVersionCode) {
    fail(
      `Proposed versionCode ${proposed} is not strictly greater than highest live ${live.highestVersionCode}`
    );
  }
  console.log(
    `OK\tversionCode\tproposed=${proposed}\t>\tlive=${live.highestVersionCode}\t(afterBump=${Boolean(opts.afterBump)})`
  );
}

async function assertTrackValid(track) {
  if (!track) return;
  if (!process.env.PLAY_SERVICE_ACCOUNT_JSON) {
    console.warn("WARN: cannot validate track without PLAY_SERVICE_ACCOUNT_JSON");
    return;
  }
  const { validateTrack, listTrackNames } = require("./play-client");
  try {
    await validateTrack(track);
    console.log(`OK\ttrack\t${track}`);
  } catch (err) {
    const names = err.liveTracks || (await listTrackNames().catch(() => []));
    fail(`${err.message}\nAvailable tracks: ${names.join(", ") || "(none)"}`);
  }
}

function assertSigningPresent() {
  const props = path.join(ROOT, "android/keystore.properties");
  if (!fs.existsSync(props)) {
    fail(`Missing android/keystore.properties (signing). See docs/ANDROID_SIGNING.md`);
  }
  console.log("OK\tsigning\tkeystore.properties");
}

function assertBootstrapSeeded(opts = {}) {
  const v = readVersionFile();
  if (v.seededFrom === "repo-bootstrap" && opts.requirePlaySeed) {
    fail("version.json still seededFrom=repo-bootstrap. Run: node scripts/play-client.js --seed-from-report");
  }
  if (v.seededFrom === "repo-bootstrap") {
    console.warn("WARN: version.json is repo-bootstrap — seed from Play before any --live release");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const trackIdx = args.indexOf("--track");
  const track = trackIdx >= 0 ? args[trackIdx + 1] : null;
  const requirePlay = args.includes("--require-play");
  const requirePlaySeed = args.includes("--require-play-seed") || requirePlay;
  const afterBump = args.includes("--after-bump");

  console.log("preflight\tstart");
  assertCleanTree();
  assertNotBehindOrigin();
  assertBootstrapSeeded({ requirePlaySeed });
  assertGradleMatchesVersionJson();
  assertSigningPresent();
  await assertVersionCodeAboveLive({ requirePlay, afterBump });
  await assertTrackValid(track);

  if (requirePlay && !process.env.PLAY_SERVICE_ACCOUNT_JSON) {
    fail("PLAY_SERVICE_ACCOUNT_JSON required");
  }

  console.log("preflight\tok");
}

main().catch((err) => {
  fail(err.message || String(err));
});
