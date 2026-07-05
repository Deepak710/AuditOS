#!/usr/bin/env node
/**
 * AuditOS Validation Script
 *
 * Purpose:
 * - Avoid repeated environment discovery and browser installation attempts.
 * - Run a lightweight validation using an already-installed Playwright package.
 *
 * Usage:
 *   node prototype/tools/validate.js
 *
 * Prerequisites:
 * - A Playwright package must already exist (project, global, or npx cache).
 * - This script NEVER installs browsers or Playwright.
 */

const fs = require("fs");
const path = require("path");

function tryRequire() {
  const candidates = [
    "playwright",
    "@playwright/test",
    process.env.PLAYWRIGHT_PATH
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      return require(c);
    } catch {}
  }

  // Search common npx cache locations
  const base = process.env.LOCALAPPDATA;
  if (base) {
    const cache = path.join(base, "npm-cache", "_npx");
    if (fs.existsSync(cache)) {
      const dirs = fs.readdirSync(cache);
      for (const d of dirs) {
        for (const pkg of ["playwright", "@playwright/test"]) {
          try {
            return require(path.join(cache, d, "node_modules", pkg));
          } catch {}
        }
      }
    }
  }

  console.error("FAIL: Playwright package not found.");
  console.error("Do NOT install browsers. Point PLAYWRIGHT_PATH to an existing package if needed.");
  process.exit(1);
}

(async () => {
  const pw = tryRequire();
  const chromium = pw.chromium || pw;

  const browser = await chromium.launch({
    headless: true,
    channel: undefined
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const errors = [];
  const warnings = [];
  const failed = [];

  page.on("console", m => {
    if (m.type() === "error") errors.push(m.text());
    if (m.type() === "warning") warnings.push(m.text());
  });

  page.on("requestfailed", r => failed.push(r.url()));

  const target = "file://" + path.resolve("prototype/index.html").replace(/\\/g, "/");

  await page.goto(target, { waitUntil: "load" });

  const checks = {};

  checks.header = !!(await page.$("header"));
  checks.nav = !!(await page.$("nav"));
  checks.main = !!(await page.$("main"));
  checks.aside = !!(await page.$("aside"));
  checks.skipLink = !!(await page.$('a[href="#workspace-canvas"]'));

  const outDir = path.resolve("validation");
  fs.mkdirSync(outDir, { recursive: true });

  for (const [w,h,name] of [
    [1920,1080,"1920x1080"],
    [1366,768,"1366x768"],
    [768,1024,"768x1024"]
  ]) {
    await page.setViewportSize({width:w,height:h});
    await page.screenshot({path:path.join(outDir,`${name}.png`), fullPage:true});
  }

  await browser.close();

  const pass =
    errors.length===0 &&
    warnings.length===0 &&
    failed.length===0 &&
    Object.values(checks).every(Boolean);

  console.log(JSON.stringify({
    status: pass ? "PASS":"FAIL",
    consoleErrors: errors.length,
    consoleWarnings: warnings.length,
    failedAssets: failed.length,
    checks
  }, null, 2));

  process.exit(pass ? 0 : 2);
})();