#!/usr/bin/env node
/**
 * Post-release verifier. Polls Play track + web /version.json until match or timeout.
 *
 * Usage:
 *   node scripts/verify.js --version-code 3 --version-name 1.0.2 \
 *     --track internal --web-url https://xxx.vercel.app [--timeout-ms 600000]
 */

const { getLiveVersions } = require("./play-client");

function parseArgs(argv) {
  const out = {
    versionCode: null,
    versionName: null,
    track: null,
    webUrl: null,
    timeoutMs: 10 * 60 * 1000,
    intervalMs: 15_000,
    skipPlay: false,
    skipWeb: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--version-code") out.versionCode = Number(argv[++i]);
    else if (a === "--version-name") out.versionName = argv[++i];
    else if (a === "--track") out.track = argv[++i];
    else if (a === "--web-url") out.webUrl = argv[++i];
    else if (a === "--timeout-ms") out.timeoutMs = Number(argv[++i]);
    else if (a === "--interval-ms") out.intervalMs = Number(argv[++i]);
    else if (a === "--skip-play") out.skipPlay = true;
    else if (a === "--skip-web") out.skipWeb = true;
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWebVersion(webUrl) {
  const base = webUrl.replace(/\/$/, "");
  const url = `${base}/version.json`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status} for ${url}`, data: null };
  }
  const data = await res.json();
  return { ok: true, error: null, data };
}

async function checkPlay(track, versionCode) {
  if (!process.env.PLAY_SERVICE_ACCOUNT_JSON) {
    return { ok: false, error: "PLAY_SERVICE_ACCOUNT_JSON unset", actual: null };
  }
  const live = await getLiveVersions();
  const t = live.tracks.find((x) => x.track === track);
  if (!t) {
    return {
      ok: false,
      error: `track ${track} not found (live: ${live.tracks.map((x) => x.track).join(",") || "none"})`,
      actual: null,
    };
  }
  const has = t.versionCodes.includes(versionCode);
  return {
    ok: has,
    error: has ? null : `versionCode ${versionCode} not on track ${track}`,
    actual: t.versionCodes.join(",") || "-",
    status: t.status,
  };
}

function printTable(rows) {
  console.log("surface\texpected\tactual\tstatus");
  for (const r of rows) {
    console.log(`${r.surface}\t${r.expected}\t${r.actual}\t${r.status}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!Number.isInteger(opts.versionCode) || !opts.versionName) {
    console.error(
      "Usage: node scripts/verify.js --version-code N --version-name x.y.z --track <name> --web-url <url>"
    );
    process.exit(1);
  }
  if (!opts.skipPlay && !opts.track) {
    console.error("--track is required unless --skip-play");
    process.exit(1);
  }
  if (!opts.skipWeb && !opts.webUrl) {
    console.error("--web-url is required unless --skip-web");
    process.exit(1);
  }

  const deadline = Date.now() + opts.timeoutMs;
  let lastRows = [];

  while (Date.now() < deadline) {
    const rows = [];
    let allOk = true;

    if (!opts.skipPlay) {
      try {
        const play = await checkPlay(opts.track, opts.versionCode);
        rows.push({
          surface: `play:${opts.track}`,
          expected: String(opts.versionCode),
          actual: play.actual ?? play.error,
          status: play.ok ? "OK" : "MISS",
        });
        if (!play.ok) allOk = false;
      } catch (err) {
        rows.push({
          surface: `play:${opts.track}`,
          expected: String(opts.versionCode),
          actual: err.message || String(err),
          status: "ERROR",
        });
        allOk = false;
      }
    }

    if (!opts.skipWeb) {
      try {
        const web = await fetchWebVersion(opts.webUrl);
        if (!web.ok) {
          rows.push({
            surface: "web:/version.json",
            expected: `${opts.versionName}/${opts.versionCode}`,
            actual: web.error,
            status: "MISS",
          });
          allOk = false;
        } else {
          const nameOk = web.data.versionName === opts.versionName;
          const codeOk = Number(web.data.versionCode) === opts.versionCode;
          rows.push({
            surface: "web:versionName",
            expected: opts.versionName,
            actual: String(web.data.versionName),
            status: nameOk ? "OK" : "MISS",
          });
          rows.push({
            surface: "web:versionCode",
            expected: String(opts.versionCode),
            actual: String(web.data.versionCode),
            status: codeOk ? "OK" : "MISS",
          });
          if (!nameOk || !codeOk) allOk = false;
        }
      } catch (err) {
        rows.push({
          surface: "web:/version.json",
          expected: `${opts.versionName}/${opts.versionCode}`,
          actual: err.message || String(err),
          status: "ERROR",
        });
        allOk = false;
      }
    }

    lastRows = rows;
    printTable(rows);

    if (allOk) {
      console.log("verify\tPASS");
      process.exit(0);
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    console.log(`verify\tretry_in_ms\t${Math.min(opts.intervalMs, remaining)}`);
    await sleep(Math.min(opts.intervalMs, remaining));
  }

  console.log("verify\tFAIL\ttimeout");
  printTable(lastRows);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
