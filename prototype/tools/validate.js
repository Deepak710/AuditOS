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
 *
 * The reusable steps — resolving Playwright, targeting the offline prototype,
 * collecting console/asset noise, checking shell landmarks, capturing
 * responsive screenshots, and summarizing PASS/FAIL — live in
 * lib/validation.js so future validation scripts compose them without
 * duplication. This script is the thin orchestration over them.
 */

const path = require('path');
const {
  resolvePlaywright,
  prototypeTargetUrl,
  attachConsoleCollector,
  checkShellLandmarks,
  captureResponsiveScreenshots,
  summarize
} = require('./lib/validation');

const VIEWPORTS = [
  [1920, 1080, '1920x1080'],
  [1366, 768, '1366x768'],
  [768, 1024, '768x1024']
];

(async () => {
  const chromium = resolvePlaywright();

  const browser = await chromium.launch({ headless: true, channel: undefined });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const collector = attachConsoleCollector(page);

  await page.goto(prototypeTargetUrl('prototype/index.html'), { waitUntil: 'load' });

  const checks = await checkShellLandmarks(page);

  await captureResponsiveScreenshots(page, path.resolve('validation'), VIEWPORTS);

  await browser.close();

  const result = summarize(collector, checks);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'PASS' ? 0 : 2);
})();
