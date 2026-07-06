'use strict';

/**
 * AuditOS Validation Helpers
 *
 * Reusable building blocks for the browser-side validation of the prototype,
 * extracted so future validation scripts (new screens, workspace states,
 * accessibility passes) compose the same launch, observation, and reporting
 * logic instead of duplicating it (Coding Standards §30.10 — shared behavior
 * exists once).
 *
 * These helpers preserve the standing validation policy (AI Implementation
 * Context — Validation): they NEVER install Playwright or a browser, never
 * search beyond already-installed locations, and never diagnose browser
 * availability. `resolvePlaywright` reports FAIL and exits if no installed
 * Playwright is found; nothing here changes that contract.
 */

const fs = require('fs');
const path = require('path');

/**
 * Resolves an already-installed Playwright and returns its chromium launcher.
 * Searches the project, a PLAYWRIGHT_PATH override, and the npx cache — the
 * same locations as before. NEVER installs; on failure it prints a FAIL line
 * and exits, so callers can assume a usable launcher on return.
 */
function resolvePlaywright() {
  const candidates = [
    'playwright',
    '@playwright/test',
    process.env.PLAYWRIGHT_PATH
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const pw = require(candidate);
      return pw.chromium || pw;
    } catch (error) { /* try the next candidate */ }
  }

  // Search common npx cache locations.
  const base = process.env.LOCALAPPDATA;
  if (base) {
    const cache = path.join(base, 'npm-cache', '_npx');
    if (fs.existsSync(cache)) {
      const dirs = fs.readdirSync(cache);
      for (const dir of dirs) {
        for (const pkg of ['playwright', '@playwright/test']) {
          try {
            const pw = require(path.join(cache, dir, 'node_modules', pkg));
            return pw.chromium || pw;
          } catch (error) { /* try the next location */ }
        }
      }
    }
  }

  console.error('FAIL: Playwright package not found.');
  console.error('Do NOT install browsers. Point PLAYWRIGHT_PATH to an existing package if needed.');
  process.exit(1);
}

/** Builds the offline `file://` URL for a prototype file (repo-root relative). */
function prototypeTargetUrl(relativePath) {
  const target = relativePath || 'prototype/index.html';
  return 'file://' + path.resolve(target).replace(/\\/g, '/');
}

/**
 * Attaches console and failed-request listeners to a page and returns the live
 * collections. A clean run leaves all three empty.
 */
function attachConsoleCollector(page) {
  const errors = [];
  const warnings = [];
  const failedAssets = [];

  page.on('console', function (message) {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  page.on('requestfailed', function (request) { failedAssets.push(request.url()); });

  return { errors: errors, warnings: warnings, failedAssets: failedAssets };
}

/** Checks that the Application Shell landmarks and the skip link are present.
 * The Issue #16 shell is header + workspace: navigation is the breadcrumb
 * <nav> inside the global header, and the empty context-panel <aside> was
 * removed with the left rail. */
async function checkShellLandmarks(page) {
  return {
    header: !!(await page.$('header')),
    nav: !!(await page.$('nav.aos-global-header__breadcrumb')),
    main: !!(await page.$('main')),
    breadcrumbSwitcher: !!(await page.$('.aos-breadcrumb__crumb')),
    skipLink: !!(await page.$('a[href="#workspace-canvas"]'))
  };
}

/**
 * Captures a full-page screenshot at each `[width, height, name]` viewport into
 * `outputDir`, which is created if needed.
 */
async function captureResponsiveScreenshots(page, outputDir, viewports) {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const viewport of viewports) {
    const width = viewport[0];
    const height = viewport[1];
    const name = viewport[2];
    await page.setViewportSize({ width: width, height: height });
    await page.screenshot({ path: path.join(outputDir, name + '.png'), fullPage: true });
  }
}

/**
 * Builds the PASS/FAIL result from a console collector and a landmark-checks
 * map. PASS requires zero console errors, zero warnings, zero failed assets,
 * and every landmark present.
 */
function summarize(collector, checks) {
  const pass =
    collector.errors.length === 0 &&
    collector.warnings.length === 0 &&
    collector.failedAssets.length === 0 &&
    Object.keys(checks).every(function (key) { return checks[key]; });

  return {
    status: pass ? 'PASS' : 'FAIL',
    consoleErrors: collector.errors.length,
    consoleWarnings: collector.warnings.length,
    failedAssets: collector.failedAssets.length,
    checks: checks
  };
}

module.exports = {
  resolvePlaywright: resolvePlaywright,
  prototypeTargetUrl: prototypeTargetUrl,
  attachConsoleCollector: attachConsoleCollector,
  checkShellLandmarks: checkShellLandmarks,
  captureResponsiveScreenshots: captureResponsiveScreenshots,
  summarize: summarize
};
