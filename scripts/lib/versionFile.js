const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const VERSION_PATH = path.join(ROOT, "version.json");

function readVersionFile() {
  if (!fs.existsSync(VERSION_PATH)) {
    throw new Error(`Missing ${VERSION_PATH}. Seed it with: node scripts/play-client.js --seed-from-report`);
  }
  const raw = JSON.parse(fs.readFileSync(VERSION_PATH, "utf8"));
  if (typeof raw.versionName !== "string" || !/^\d+\.\d+\.\d+$/.test(raw.versionName)) {
    throw new Error(`version.json versionName must be semver x.y.z, got: ${raw.versionName}`);
  }
  if (!Number.isInteger(raw.versionCode) || raw.versionCode < 1) {
    throw new Error(`version.json versionCode must be a positive integer, got: ${raw.versionCode}`);
  }
  return {
    versionName: raw.versionName,
    versionCode: raw.versionCode,
    seededFrom: raw.seededFrom ?? null,
    commitSha: raw.commitSha ?? null,
  };
}

function writeVersionFile(data) {
  const out = {
    versionName: data.versionName,
    versionCode: data.versionCode,
    ...(data.seededFrom ? { seededFrom: data.seededFrom } : {}),
    ...(data.seedNote ? { seedNote: data.seedNote } : {}),
    ...(data.commitSha ? { commitSha: data.commitSha } : {}),
  };
  fs.writeFileSync(VERSION_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  return out;
}

function gitCommitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function buildPublicVersionPayload(extra = {}) {
  const v = readVersionFile();
  return {
    versionName: v.versionName,
    versionCode: v.versionCode,
    commitSha: extra.commitSha || process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || gitCommitSha(),
    ...extra,
  };
}

function bumpSemver(versionName, kind) {
  const parts = versionName.split(".").map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n))) {
    throw new Error(`Invalid versionName: ${versionName}`);
  }
  let [major, minor, patch] = parts;
  if (kind === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (kind === "minor") {
    minor += 1;
    patch = 0;
  } else if (kind === "patch") {
    patch += 1;
  } else {
    throw new Error(`Unknown bump kind: ${kind}`);
  }
  return `${major}.${minor}.${patch}`;
}

module.exports = {
  ROOT,
  VERSION_PATH,
  readVersionFile,
  writeVersionFile,
  gitCommitSha,
  buildPublicVersionPayload,
  bumpSemver,
};
