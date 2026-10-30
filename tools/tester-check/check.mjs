#!/usr/bin/env node
// Read-only check of why testers see "App not available" on the Wise Dish closed test.
// Opens a separate Chrome window with its own profile (not your normal one). You sign in to Google
// there yourself; the script then reads the opt-in page, the tester Google Group and Play Console,
// and prints what it found. It never clicks Join, Become a tester, Save or anything else that changes settings.
//   npm run check               your developer account: opt-in page, group owner pages, Play Console
//   npm run check -- --tester   a tester account: opt-in page and group membership only

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { chromium } from "playwright-core";

const PACKAGE_NAME = "com.wisedish.app";
const GROUP = process.env.TESTER_GROUP || "wisedish-testers";
const GROUP_EMAIL = `${GROUP}@googlegroups.com`;
const AS_TESTER = process.argv.includes("--tester");
const ROLE = AS_TESTER ? "tester" : "owner";
const PORT = Number(process.env.CHECK_PORT) || (AS_TESTER ? 9334 : 9333);
const PROFILE = path.join(os.homedir(), ".wisedish-check", ROLE);
const OUT = path.join(os.homedir(), "Desktop", "wisedish-check", ROLE);
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  path.join(os.homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
].filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const say = (line = "") => console.log(line);
const findings = {};
let page;

function maskEmail(email) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}

function emailsIn(text) {
  return [...new Set((text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || []).map((e) => e.toLowerCase()))];
}

/** Lines matching re, each joined with the `after` lines that follow it (labels sit above their values). */
function linesAround(text, re, after = 2) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const out = [];
  lines.forEach((line, i) => {
    if (re.test(line)) out.push(lines.slice(i, i + 1 + after).join(" | ").slice(0, 200));
  });
  return [...new Set(out)];
}

async function devtoolsReady() {
  try {
    return (await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok;
  } catch {
    return false;
  }
}

async function startChrome() {
  if (await devtoolsReady()) return; // window from an earlier run is still open
  const chrome = CHROME_PATHS.find((p) => fs.existsSync(p));
  if (!chrome) throw new Error("Google Chrome not found. Install it, or set CHROME_PATH to its binary.");
  fs.mkdirSync(PROFILE, { recursive: true });
  const args = [`--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "--no-first-run", "--no-default-browser-check"];
  spawn(chrome, [...args, "https://accounts.google.com/"], { detached: true, stdio: "ignore" }).unref();
  for (let i = 0; i < 60; i++) {
    if (await devtoolsReady()) return;
    await sleep(500);
  }
  throw new Error("Chrome opened but its debugging port never came up. Quit that Chrome window and run again.");
}

/** Saves the page's text and a screenshot to OUT, and returns the text. */
async function snapshot(name) {
  const text = await page.evaluate(() => document.body?.innerText || "");
  fs.writeFileSync(path.join(OUT, `${name}.txt`), `${page.url()}\n\n${text}`);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true }).catch(() => {});
  return text;
}

async function open(name, url, settleMs = 4000) {
  await page.goto(url, { waitUntil: "load", timeout: 45000 });
  await sleep(settleMs);
  return snapshot(name);
}

/** Clicks the first visible element whose whole text matches re. Only used for navigation links and tabs. */
async function clickText(re, role) {
  const target = (role ? page.getByRole(role, { name: re }) : page.getByText(re)).first();
  if (!(await target.count()) || !(await target.isVisible().catch(() => false))) return false;
  await target.click({ timeout: 5000 });
  await sleep(4000);
  return true;
}

/** Every option button on the page with its label and whether it is selected. */
async function radios() {
  return page.evaluate(() => {
    const text = (el) => (el?.innerText || el?.textContent || "").trim().replace(/\s+/g, " ");
    return [...document.querySelectorAll('[role="radio"], input[type="radio"]')].map((r) => {
      const own = r.tagName === "INPUT" ? "" : text(r);
      const label = r.getAttribute("aria-label") || text(r.labels?.[0]) || own || text(r.closest("label")) || text(r.parentElement);
      return { label: label.slice(0, 90), checked: r.getAttribute("aria-checked") === "true" || r.checked === true };
    });
  });
}

async function printRadios() {
  const list = await radios();
  for (const r of list) say(`  ${r.checked ? "(●)" : "( )"} ${r.label}`);
  return list;
}

async function step(title, fn) {
  say(`\n▸ ${title}`);
  try {
    await fn();
  } catch (err) {
    say(`  ! Couldn't read this page: ${String(err?.message || err).split("\n")[0]}`);
  }
}

async function checkAccount() {
  await step("Signed-in Google account", async () => {
    const text = await open("0-account", "https://myaccount.google.com/", 3000);
    if (page.url().includes("accounts.google.com")) return say("  not signed in");
    const labels = await page.evaluate(() => [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")));
    const email = emailsIn(labels.filter((l) => /Google Account/i.test(l)).join(" "))[0] || emailsIn(text)[0];
    findings.signedIn = true;
    findings.account = email;
    say(`  ${email ? maskEmail(email) : "signed in (email not shown on the page)"}`);
  });
}

async function checkOptIn() {
  await step("Opt-in page", async () => {
    const text = await open("1-opt-in", `https://play.google.com/apps/testing/${PACKAGE_NAME}`);
    if (/App not available/i.test(text)) findings.optIn = "not-available";
    else if (/Become a tester/i.test(text)) findings.optIn = "can-join";
    else if (/You are a tester|You're a tester|Leave the program/i.test(text)) findings.optIn = "tester";
    else findings.optIn = "unknown";
    const label = { "not-available": "App not available", "can-join": "Shows 'Become a tester' (works)", tester: "Already a tester (works)", unknown: "Unrecognized page (see 1-opt-in.png)" };
    say(`  ${label[findings.optIn]}`);
  });
}

async function checkGroupMembership() {
  await step(`Google Group ${GROUP}: this account's membership`, async () => {
    const text = await open("2-group", `https://groups.google.com/g/${GROUP}/about`);
    const notMember = [];
    if (/don.t have permission|content unavailable|not authorized/i.test(text)) notMember.push("this account can't see the group");
    if (/Ask to join group/.test(text)) notMember.push("shows 'Ask to join group' (joining needs your approval)");
    if (/\bJoin group\b/.test(text)) notMember.push("shows 'Join group' (not a member yet)");
    if (/request (is )?pending|pending request|requested to join/i.test(text)) notMember.push("join request pending");
    const member = /Leave group|My membership settings|Membership settings/i.test(text);
    if (notMember.length) findings.member = false;
    else if (member) findings.member = true;
    say(`  ${notMember.length ? notMember.join("; ") : member ? "member" : "couldn't tell (see 2-group.png)"}`);
  });
}

async function checkGroupAdmin() {
  await step("Google Group members (as owner)", async () => {
    const text = await open("3-group-members", `https://groups.google.com/g/${GROUP}/members`);
    if (/don.t have permission|content unavailable/i.test(text)) throw new Error("this account doesn't manage the group. Run again signed in as the group's owner.");
    const members = emailsIn(text).filter((e) => e !== GROUP_EMAIL);
    findings.memberCount = members.length;
    if (findings.account && members.length) findings.member = members.includes(findings.account);
    say(`  ${members.length} member email(s) listed: ${members.map(maskEmail).join(", ") || "none"}`);
    for (const line of linesAround(text, /\b\d+\s+members?\b/i, 0).slice(0, 2)) say(`  "${line}"`);
    if (await clickText(/^Pending members$/i)) {
      const waiting = emailsIn(await snapshot("4-group-pending")).filter((e) => e !== GROUP_EMAIL);
      findings.pendingCount = waiting.length;
      say(`  Pending members/requests: ${waiting.length}${waiting.length ? ` → ${waiting.map(maskEmail).join(", ")}` : ""}`);
    } else {
      say("  (couldn't find the Pending members page)");
    }
  });

  await step("Google Group settings", async () => {
    await open("5-group-settings", `https://groups.google.com/g/${GROUP}/settings`);
    // Each "Who can …" setting is followed by its options, so pair every selected option with the label above it.
    const settings = await page.evaluate(() => {
      const out = {};
      let current = null;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      for (let el = walker.currentNode; el; el = walker.nextNode()) {
        if (el.getAttribute("role") === "radio" || (el.tagName === "INPUT" && el.type === "radio")) {
          const label = el.tagName === "INPUT" ? el.labels?.[0]?.innerText : el.getAttribute("aria-label") || el.innerText;
          if (current && (el.getAttribute("aria-checked") === "true" || el.checked)) out[current] = (label || "").trim().replace(/\s+/g, " ");
          continue;
        }
        const own = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("").trim();
        if (/^Who can /i.test(own)) current = own.replace(/\s+/g, " ");
      }
      return out;
    });
    const entries = Object.entries(settings);
    if (!entries.length) throw new Error("couldn't read the settings (see 5-group-settings.png)");
    for (const [label, value] of entries) say(`  ${label}: ${value}`);
    findings.joinSetting = settings["Who can join group"];
  });
}

async function checkPlayConsole() {
  let base;
  await step("Play Console: find Wise Dish", async () => {
    await open("6-console", "https://play.google.com/console/u/0/developers", 6000);
    const ids = async () => {
      const fromUrl = page.url().match(/developers\/(\d+)\/app\/(\d+)/);
      if (fromUrl) return fromUrl;
      const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.href, text: a.innerText || "" })));
      const hit = links.find((l) => /\/app\/\d+/.test(l.href) && /Wise ?Dish|com\.wisedish\.app/i.test(l.text)) || links.find((l) => /developers\/\d+\/app\/\d+/.test(l.href));
      return hit?.href.match(/developers\/(\d+)\/app\/(\d+)/) || null;
    };
    let m = await ids();
    if (!m && (await clickText(/^(Wise ?Dish|com\.wisedish\.app)$/i))) m = await ids();
    if (!m) throw new Error("couldn't find the Wise Dish app. Is this the developer account?");
    base = `https://play.google.com/console/u/0/developers/${m[1]}/app/${m[2]}`;
    say("  found");
  });
  if (!base) return;

  await step("Play Console: dashboard", async () => {
    const text = await open("7-dashboard", `${base}/app-dashboard`, 5000);
    for (const line of linesAround(text, /opted-in/i, 0).slice(0, 2)) say(`  "${line}"`);
  });

  await step("Play Console: closed testing → Testers tab", async () => {
    await open("8-closed-testing", `${base}/closed-testing`, 5000);
    const trackIds = await page.evaluate(() => [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.href.match(/\/tracks\/(\d+)/)?.[1]).filter(Boolean))]);
    if (trackIds[0]) await open("9-testers", `${base}/tracks/${trackIds[0]}?tab=testers`, 5000);
    else await clickText(/^Manage track$/i);
    await clickText(/^Testers$/i, "tab"); // in case the tab parameter didn't switch tabs
    const text = await snapshot("9-testers");
    findings.onTestersTab = /Google Groups/i.test(text) && /Email lists/i.test(text);
    if (!findings.onTestersTab) throw new Error("couldn't open the Testers tab (see 9-testers.png)");
    const modes = (await printRadios()).filter((r) => /^(Email lists|Google Groups)/i.test(r.label));
    findings.testersMode = modes.find((r) => r.checked)?.label.replace(/^(Email lists|Google Groups).*/i, "$1");
    const inputs = await page.evaluate(() => [...document.querySelectorAll("input, textarea")].map((i) => i.value).filter((v) => v.includes("@")));
    findings.consoleGroups = [...new Set([...emailsIn(text), ...inputs.flatMap(emailsIn)])].filter((e) => e.endsWith("@googlegroups.com"));
    say(`  Google Groups on this track: ${findings.consoleGroups.join(", ") || "none"}`);
    const joinLinks = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="/apps/testing/"]')].map((a) => a.href))]);
    if (joinLinks.length) say(`  Join link: ${joinLinks[0]}`);
    const alerts = await page.evaluate(() => [...document.querySelectorAll('[role="alert"]')].map((a) => a.innerText.trim()).filter(Boolean));
    for (const line of [...alerts, ...linesAround(text, /\b(required|invalid)\b/i, 0)].slice(0, 4)) say(`  ⚠ ${line.slice(0, 160)}`);
  });

  await step("Play Console: App availability", async () => {
    let text = await open("10-advanced-settings", `${base}/advanced-settings`, 5000);
    if (!/App availability/i.test(text) && ((await clickText(/^Advanced settings$/i)) || ((await clickText(/^Setup$/i)) && (await clickText(/^Advanced settings$/i))))) {
      text = await snapshot("10-advanced-settings");
    }
    const selected = (await radios()).find((r) => r.checked && /^(Published|Unpublished)/i.test(r.label));
    findings.availability = selected ? (/^Unpublished/i.test(selected.label) ? "Unpublished" : "Published") : undefined;
    say(`  Selected: ${findings.availability || "couldn't tell (see 10-advanced-settings.png)"}`);
  });

  await step("Play Console: Publishing overview", async () => {
    const text = await open("11-publishing", `${base}/publishing`, 5000);
    const lines = linesAround(text, /in review|ready to (send|publish)|managed publishing|not yet sent|rejected/i, 1);
    findings.pendingChanges = lines.some((l) => /in review|ready to (send|publish)|not yet sent/i.test(l) && !/\b(no changes|none|nothing)\b/i.test(l));
    for (const line of lines.slice(0, 6)) say(`  ${line}`);
    if (!lines.length) say("  nothing in review or waiting to publish");
  });
}

function diagnose() {
  const f = findings;
  say("\n════ Diagnosis ════");
  const groupNotes = () => {
    if (f.pendingCount) say(`   ${f.pendingCount} people are waiting in Pending members. Approve them so they can opt in.`);
    if (f.joinSetting && !/^Anyone can join/i.test(f.joinSetting)) say(`   "Who can join group" is "${f.joinSetting}", so joins wait for your approval. Set it to "Anyone can join".`);
  };
  if (f.optIn === "can-join" || f.optIn === "tester") {
    say("✅ The opt-in page works for this account, so Play is set up correctly.");
    say("   Testers who still get 'App not available' aren't in the group yet, or are signed into a different Google account on the Play page.");
    return groupNotes();
  }
  if (f.optIn !== "not-available") return say("❓ Couldn't read the opt-in page. Send Claude the screenshots in the folder below.");
  if (f.member === false) {
    say("❌ This account isn't a member of the group, which is why the opt-in page says 'App not available' for it.");
    say("   Join the group with this account (or approve its request), then try the opt-in link again.");
    return groupNotes();
  }
  if (!AS_TESTER) {
    if (f.availability === "Unpublished") return say("❌ App availability is Unpublished, which blocks new testers. Set it to Published and save (production stays inactive).");
    if (f.testersMode === "Email lists") return say("❌ The Testers tab is set to Email lists, so the Google Group isn't used. Select Google Groups, add the group, and save.");
    if (f.onTestersTab && !f.consoleGroups.includes(GROUP_EMAIL)) return say(`❌ ${GROUP_EMAIL} isn't on the closed test's Testers tab. Add it, press Enter so it becomes a chip, and save.`);
    if (f.pendingChanges) return say("⏳ Play Console has changes in review or waiting to publish. Testers can't opt in until they're live.");
  }
  if (f.member === undefined) say("❓ Couldn't tell whether this account is in the group. Send Claude the output above.");
  else say("❓ This account is in the group and Play looks right, but it still can't opt in. Send Claude the output above.");
  groupNotes();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await startChrome();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await rl.question(
    `\nA separate Chrome window is open. Sign in there with ${AS_TESTER ? "the tester account you want to check" : "your Play Console (developer) account"}.\n` +
      "Once you see your Google Account page, come back here and press Enter… "
  );
  rl.close();

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  page = await browser.contexts()[0].newPage();
  say(`\nChecking ${PACKAGE_NAME} as ${ROLE}…`);
  await checkAccount();
  if (!findings.signedIn) {
    say("\nSign in to Google in the Chrome window that opened, then run this again.");
    process.exit(1);
  }
  await checkOptIn();
  await checkGroupMembership();
  if (!AS_TESTER) {
    await checkGroupAdmin();
    await checkPlayConsole();
  }
  diagnose();
  say(`\nScreenshots and page text: ${OUT}`);
  say("They include your testers' emails, so keep them private. Paste everything above back to Claude.");
  process.exit(0); // leaves the Chrome window open; close it when you're done
}

main().catch((err) => {
  console.error(`\n${err?.message || err}`);
  process.exit(1);
});
