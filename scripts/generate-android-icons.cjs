/**
 * Resize public/logo.png into Android mipmaps + a 512px Play Console helper asset.
 *
 * Requires: npm i -D sharp
 * Run: node scripts/generate-android-icons.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.error("[icons] Install sharp: npm install sharp --save-dev");
    process.exit(1);
  }

  const root = path.join(__dirname, "..");
  const logoPath = path.join(root, "public", "logo.png");
  if (!fs.existsSync(logoPath)) {
    console.error("[icons] Missing:", logoPath);
    process.exit(1);
  }

  const bg = { r: 12, g: 15, b: 22, alpha: 1 };
  const densities = [
    ["mipmap-mdpi", 48],
    ["mipmap-hdpi", 72],
    ["mipmap-xhdpi", 96],
    ["mipmap-xxhdpi", 144],
    ["mipmap-xxxhdpi", 192],
  ];

  for (const [folder, px] of densities) {
    const dir = path.join(root, "android", "app", "src", "main", "res", folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const buf = await sharp(logoPath).resize(px, px, { fit: "contain", background: bg }).png().toBuffer();
    fs.writeFileSync(path.join(dir, "ic_launcher.png"), buf);
    fs.writeFileSync(path.join(dir, "ic_launcher_round.png"), buf);
    fs.writeFileSync(path.join(dir, "ic_launcher_foreground.png"), buf);
    console.info("[icons] wrote", folder, px + "×" + px);
  }

  const listingDir = path.join(root, "android", "store-listing");
  fs.mkdirSync(listingDir, { recursive: true });
  const sq512 = await sharp(logoPath).resize(512, 512, { fit: "contain", background: bg }).png().toBuffer();
  fs.writeFileSync(path.join(listingDir, "ic_launcher_512.png"), sq512);
  console.info("[icons] wrote android/store-listing/ic_launcher_512.png (upload to Play Console as needed)");

  console.info("[icons] Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
