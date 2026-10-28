#!/usr/bin/env node
// Local MCP server: lets Claude Desktop manage Wise Dish releases through the official
// Google Play Developer API, authenticated with a service account key (never your Google login).
// Setup: tools/play-mcp/README.md. stdout is the MCP channel, so all logging goes to stderr.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { androidpublisher, auth } from "@googleapis/androidpublisher";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const DEFAULT_AAB = path.join(REPO_ROOT, "android/app/build/outputs/bundle/release/app-release.aab");
const PACKAGE_NAME = process.env.PLAY_PACKAGE_NAME || "com.wisedish.app";
const KEY_FILE = expandHome(process.env.PLAY_KEY_FILE || "");

// Uploads only go to testing tracks; production is reached with promote_release.
const UPLOAD_TRACKS = ["internal", "alpha", "beta"];

function expandHome(p) {
  return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}

function log(...args) {
  console.error("[play-mcp]", ...args);
}

let client;
function play() {
  if (client) return client;
  if (!KEY_FILE) throw new Error("PLAY_KEY_FILE is not set. Point it at your service account JSON key (see tools/play-mcp/README.md).");
  if (!fs.existsSync(KEY_FILE)) throw new Error(`Service account key not found at ${KEY_FILE}.`);
  const googleAuth = new auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  client = androidpublisher({ version: "v3", auth: googleAuth });
  return client;
}

/** Turns Google API errors into a next step the user can act on. */
function explain(err) {
  const msg = err?.errors?.[0]?.message || err?.response?.data?.error?.message || err?.message || String(err);
  const code = err?.code || err?.response?.status;
  const hints = [];
  if (code === 401 || /invalid_grant|unauthorized_client/i.test(msg)) {
    hints.push("The service account key is invalid or was deleted. Create a new JSON key in Google Cloud Console.");
  }
  if (code === 403 || /permission/i.test(msg)) {
    hints.push("Invite the service account email in Play Console → Users and permissions and grant it access to Wise Dish. Also enable the Google Play Android Developer API in Google Cloud.");
  }
  if (code === 404) {
    hints.push(`Play has no app ${PACKAGE_NAME} visible to this account. Create it in Play Console and upload the first AAB by hand.`);
  }
  if (/version code .* already been used/i.test(msg)) {
    hints.push("Rebuild with a higher version code: ./gradlew bundleRelease -PversionCode=<next number>.");
  }
  if (/draft app/i.test(msg)) {
    hints.push('The app has not passed its first review yet. Retry with status "draft", then roll out from Play Console.');
  }
  if (/signed with .* (wrong|different) key|upload key/i.test(msg)) {
    hints.push("The AAB was signed with a different keystore than Play expects. Use the original wisedish-release.keystore.");
  }
  const head = typeof code === "number" ? `Google Play API error (${code}): ${msg}` : msg;
  return [head, ...hints].join("\n");
}

/** Runs fn inside a Play edit. Commits when commit=true, otherwise discards the edit. */
async function withEdit(fn, { commit = false, changesNotSentForReview } = {}) {
  const api = play();
  const { data } = await api.edits.insert({ packageName: PACKAGE_NAME });
  const editId = data.id;
  try {
    const result = await fn(api, editId);
    if (commit) {
      await api.edits.commit({
        packageName: PACKAGE_NAME,
        editId,
        ...(changesNotSentForReview ? { changesNotSentForReview: true } : {}),
      });
    } else {
      await api.edits.delete({ packageName: PACKAGE_NAME, editId }).catch(() => {});
    }
    return result;
  } catch (err) {
    await api.edits.delete({ packageName: PACKAGE_NAME, editId }).catch(() => {});
    throw err;
  }
}

function summarizeTracks(tracks) {
  return (tracks || []).map((t) => ({
    track: t.track,
    releases: (t.releases || []).map((r) => ({
      name: r.name,
      status: r.status,
      versionCodes: r.versionCodes,
      ...(r.userFraction ? { userFraction: r.userFraction } : {}),
    })),
  }));
}

async function listTracks() {
  return withEdit(async (api, editId) => {
    const { data } = await api.edits.tracks.list({ packageName: PACKAGE_NAME, editId });
    return summarizeTracks(data.tracks);
  });
}

/** Read-only view of who can opt in to a testing track: its groups, countries and live release. */
async function testingSetup(track = "alpha") {
  return withEdit(async (api, editId) => {
    const q = { packageName: PACKAGE_NAME, editId, track };
    const [testers, countries, trackInfo] = await Promise.all([
      api.edits.testers.get(q).then((r) => r.data),
      api.edits.countryavailability.get(q).then((r) => r.data),
      api.edits.tracks.get(q).then((r) => r.data),
    ]);
    const groups = testers.googleGroups || [];
    const codes = countries.countries?.map((c) => c.countryCode) || [];
    const problems = [];
    if (!groups.length) problems.push("No Google Group is attached to this track. Add it on the Testers tab and send the change for review.");
    if (!countries.restOfWorld && !codes.length) problems.push("No countries are selected for this track.");
    if (!summarizeTracks([trackInfo])[0].releases.some((r) => r.status === "completed")) {
      problems.push("No completed release on this track, so there is nothing to opt in to.");
    }
    return {
      track,
      googleGroups: groups,
      restOfWorld: Boolean(countries.restOfWorld),
      countryCount: codes.length,
      includesJapan: Boolean(countries.restOfWorld) || codes.includes("JP"),
      countries: codes,
      releases: summarizeTracks([trackInfo])[0].releases,
      problems,
      optInLink: `https://play.google.com/apps/testing/${PACKAGE_NAME}`,
    };
  });
}

function ok(data) {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function fail(err) {
  log(err?.stack || err);
  return { isError: true, content: [{ type: "text", text: explain(err) }] };
}

function releaseNotes(text) {
  return text ? [{ language: "en-US", text: text.slice(0, 500) }] : undefined;
}

async function uploadBundle({ aab_path, track, status, release_notes }) {
  const file = path.resolve(REPO_ROOT, expandHome(aab_path || DEFAULT_AAB));
  if (!file.endsWith(".aab")) throw new Error(`Expected an .aab file, got ${file}`);
  if (!fs.existsSync(file)) {
    throw new Error(`AAB not found at ${file}. Build it first: npm run build:android && cd android && ./gradlew bundleRelease -PversionCode=<n>`);
  }
  const sizeMb = (fs.statSync(file).size / 1024 / 1024).toFixed(1);
  log(`uploading ${file} (${sizeMb} MB) to ${track} as ${status}`);

  const result = await withEdit(
    async (api, editId) => {
      const { data: bundle } = await api.edits.bundles.upload({
        packageName: PACKAGE_NAME,
        editId,
        media: { mimeType: "application/octet-stream", body: fs.createReadStream(file) },
      });
      const versionCode = String(bundle.versionCode);
      await api.edits.tracks.update({
        packageName: PACKAGE_NAME,
        editId,
        track,
        requestBody: {
          track,
          releases: [{ versionCodes: [versionCode], status, releaseNotes: releaseNotes(release_notes) }],
        },
      });
      return { versionCode, sha256: bundle.sha256 };
    },
    { commit: true }
  );
  return { uploaded: path.basename(file), sizeMb: Number(sizeMb), track, status, ...result };
}

const server = new McpServer({ name: "wisedish-google-play", version: "0.1.0" });

server.registerTool(
  "list_releases",
  {
    title: "List Play releases",
    description: `Show every Google Play track for ${PACKAGE_NAME} with its releases, statuses and version codes. Read-only.`,
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async () => {
    try {
      const tracks = await listTracks();
      const allCodes = tracks.flatMap((t) => t.releases.flatMap((r) => (r.versionCodes || []).map(Number)));
      const highest = allCodes.length ? Math.max(...allCodes) : null;
      return ok({ packageName: PACKAGE_NAME, highestVersionCode: highest, nextVersionCode: highest ? highest + 1 : null, tracks });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "upload_bundle",
  {
    title: "Upload AAB to a testing track",
    description:
      "Upload a signed AAB and release it on a testing track (internal, alpha or beta). " +
      "Production is not allowed here; use promote_release after testing. " +
      'Use status "draft" while the app has not passed its first Play review.',
    inputSchema: {
      aab_path: z.string().optional().describe(`Path to the .aab file. Defaults to ${DEFAULT_AAB}`),
      track: z.enum(UPLOAD_TRACKS).default("internal"),
      status: z.enum(["completed", "draft"]).default("completed"),
      release_notes: z.string().max(500).optional().describe("\"What's new\" text, en-US, up to 500 characters"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  async (args) => {
    try {
      return ok(await uploadBundle(args));
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "promote_release",
  {
    title: "Promote a release to another track",
    description:
      "Copy a release that already exists on one track (e.g. internal) to another track (e.g. production). " +
      "Promoting to production requires confirm_production=true and should only happen after the user explicitly asks. " +
      "Use user_fraction (0-1) for a staged rollout.",
    inputSchema: {
      from_track: z.string().default("internal"),
      to_track: z.string(),
      version_code: z.string().optional().describe("Version code to promote. Defaults to the newest release on from_track."),
      user_fraction: z.number().gt(0).lt(1).optional().describe("Staged rollout fraction, e.g. 0.2 for 20%. Omit for 100%."),
      release_notes: z.string().max(500).optional(),
      confirm_production: z.boolean().default(false),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  async ({ from_track, to_track, version_code, user_fraction, release_notes, confirm_production }) => {
    try {
      if (from_track === to_track) throw new Error("from_track and to_track must differ.");
      if (to_track === "production" && !confirm_production) {
        throw new Error("Refusing to promote to production without confirm_production=true. Ask the user to confirm first.");
      }
      const result = await withEdit(
        async (api, editId) => {
          const { data: source } = await api.edits.tracks.get({ packageName: PACKAGE_NAME, editId, track: from_track });
          const releases = (source.releases || []).filter((r) => r.versionCodes?.length);
          const release = version_code
            ? releases.find((r) => r.versionCodes.includes(String(version_code)))
            : releases.sort((a, b) => Math.max(...b.versionCodes.map(Number)) - Math.max(...a.versionCodes.map(Number)))[0];
          if (!release) throw new Error(`No release${version_code ? ` with version code ${version_code}` : ""} found on ${from_track}.`);

          const promoted = {
            name: release.name,
            versionCodes: release.versionCodes,
            releaseNotes: releaseNotes(release_notes) || release.releaseNotes,
            status: user_fraction ? "inProgress" : "completed",
            ...(user_fraction ? { userFraction: user_fraction } : {}),
          };
          await api.edits.tracks.update({
            packageName: PACKAGE_NAME,
            editId,
            track: to_track,
            requestBody: { track: to_track, releases: [promoted] },
          });
          return { versionCodes: release.versionCodes, status: promoted.status, userFraction: user_fraction ?? 1 };
        },
        { commit: true }
      );
      return ok({ promoted: true, from_track, to_track, ...result });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "list_reviews",
  {
    title: "List recent Play reviews",
    description: "Show recent Google Play reviews that have text (Google only returns roughly the last week). Read-only.",
    inputSchema: { max_results: z.number().int().min(1).max(100).default(20) },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ max_results }) => {
    try {
      const { data } = await play().reviews.list({ packageName: PACKAGE_NAME, maxResults: max_results });
      const reviews = (data.reviews || []).map((r) => {
        const user = r.comments?.find((c) => c.userComment)?.userComment;
        const reply = r.comments?.find((c) => c.developerComment)?.developerComment;
        return {
          reviewId: r.reviewId,
          author: r.authorName,
          stars: user?.starRating,
          text: user?.text?.trim(),
          appVersion: user?.appVersionName,
          device: user?.deviceMetadata?.productName,
          date: user?.lastModified?.seconds ? new Date(Number(user.lastModified.seconds) * 1000).toISOString().slice(0, 10) : undefined,
          ...(reply ? { yourReply: reply.text } : {}),
        };
      });
      return ok(reviews.length ? reviews : "No reviews with text in roughly the last week.");
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "reply_to_review",
  {
    title: "Reply to a Play review",
    description: "Post a public developer reply to a Google Play review. The reply is visible to everyone on the store listing; show the user the text first.",
    inputSchema: {
      review_id: z.string(),
      reply_text: z.string().min(1).max(350),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  async ({ review_id, reply_text }) => {
    try {
      await play().reviews.reply({ packageName: PACKAGE_NAME, reviewId: review_id, requestBody: { replyText: reply_text } });
      return ok({ replied: true, review_id });
    } catch (err) {
      return fail(err);
    }
  }
);

// `node index.js --check` verifies the key and permissions from a terminal without Claude.
// `node index.js --testers [track]` shows the track's tester groups, countries and releases.
// `node index.js --upload <internal|alpha|beta> ["release notes"]` uploads from a terminal,
// for big AABs or slow connections where a Claude Desktop tool call may time out.
const uploadAt = process.argv.indexOf("--upload");
if (uploadAt !== -1) {
  const track = process.argv[uploadAt + 1] || "internal";
  const notes = process.argv[uploadAt + 2];
  try {
    if (!UPLOAD_TRACKS.includes(track)) throw new Error(`Track must be one of: ${UPLOAD_TRACKS.join(", ")}`);
    console.log(`Uploading to ${track}… (this can take a few minutes)`);
    console.log(JSON.stringify(await uploadBundle({ track, status: process.env.PLAY_STATUS || "completed", release_notes: notes }), null, 2));
    process.exit(0);
  } catch (err) {
    console.error(explain(err));
    process.exit(1);
  }
} else if (process.argv.includes("--testers")) {
  try {
    const track = process.argv[process.argv.indexOf("--testers") + 1] || "alpha";
    console.log(JSON.stringify(await testingSetup(track), null, 2));
    process.exit(0);
  } catch (err) {
    console.error(explain(err));
    process.exit(1);
  }
} else if (process.argv.includes("--check")) {
  try {
    const tracks = await listTracks();
    console.log(`Connected to Google Play for ${PACKAGE_NAME}.`);
    console.log(JSON.stringify(tracks, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(explain(err));
    process.exit(1);
  }
} else {
  await server.connect(new StdioServerTransport());
  log(`ready (package ${PACKAGE_NAME}, key ${KEY_FILE || "NOT SET"})`);
}
