#!/usr/bin/env node
/**
 * Write public/version.json (and out/version.json after export) from version.json + git SHA.
 * Called before Next static export and serverful builds so both surfaces stamp the same identity.
 */

const fs = require("node:fs");
const path = require("node:path");
const { ROOT, buildPublicVersionPayload } = require("./lib/versionFile");

function main() {
  const payload = buildPublicVersionPayload({
    builtAt: new Date().toISOString(),
  });
  const publicDir = path.join(ROOT, "public");
  fs.mkdirSync(publicDir, { recursive: true });
  const dest = path.join(publicDir, "version.json");
  fs.writeFileSync(dest, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`stamped\t${dest}\t${payload.versionName}\t${payload.versionCode}\t${payload.commitSha}`);

  // If out/ already exists (post-export), stamp there too for Capacitor sync safety.
  const outDir = path.join(ROOT, "out");
  if (fs.existsSync(outDir)) {
    const outDest = path.join(outDir, "version.json");
    fs.writeFileSync(outDest, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`stamped\t${outDest}`);
  }
}

main();
