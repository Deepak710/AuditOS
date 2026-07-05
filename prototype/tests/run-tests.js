#!/usr/bin/env node
'use strict';

/**
 * AuditOS Prototype Test Runner
 *
 * Runs the repository's offline test suites and reports a single PASS/FAIL
 * summary. Node standard library only: no test framework, no build step, no
 * browser, no network (AI Implementation Context — offline / file:// constraint;
 * Coding Standards §30.21 — no unnecessary complexity).
 *
 * Suites are discovered automatically: every `*.test.js` under the category
 * directories below is run in category order, then file-name order. A new suite
 * is added by dropping a file into the right directory — the runner needs no
 * edit, so the suite never has to be migrated as milestones grow.
 *
 * Usage:
 *   node prototype/tests/run-tests.js
 *
 * Exit code 0 when every case passes, 1 otherwise, so CI and the validation
 * workflow can gate on it.
 */

const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('./lib/harness');

/** Suite categories, run in this order (GitHub Issue #14 — Testing). */
const CATEGORIES = ['smoke', 'unit', 'integration'];

/** Discovers `[label, register]` pairs for every `*.test.js` in the category directories. */
function discoverSuites() {
  const suites = [];
  CATEGORIES.forEach(function (category) {
    const directory = path.join(__dirname, category);
    if (!fs.existsSync(directory)) {
      return;
    }
    fs.readdirSync(directory)
      .filter(function (fileName) { return /\.test\.js$/.test(fileName); })
      .sort()
      .forEach(function (fileName) {
        const label = category.charAt(0).toUpperCase() + category.slice(1) +
          ' · ' + fileName.replace(/\.test\.js$/, '');
        suites.push([label, require(path.join(directory, fileName))]);
      });
  });
  return suites;
}

let passed = 0;
let failed = 0;
const failures = [];

discoverSuites().forEach(function (entry) {
  const label = entry[0];
  const register = entry[1];
  const harness = createHarness();

  try {
    register(harness);
  } catch (error) {
    failed += 1;
    failures.push({ label: label, name: '(suite registration)', error: error });
    console.log('  FAIL  [' + label + '] (suite registration)');
    return;
  }

  harness.cases.forEach(function (testCase) {
    try {
      testCase.fn();
      passed += 1;
      console.log('  PASS  [' + label + '] ' + testCase.name);
    } catch (error) {
      failed += 1;
      failures.push({ label: label, name: testCase.name, error: error });
      console.log('  FAIL  [' + label + '] ' + testCase.name);
    }
  });
});

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(function (failure) {
    console.log('  [' + failure.label + '] ' + failure.name);
    console.log('    ' + (failure.error && failure.error.message ? failure.error.message : failure.error));
  });
}

console.log('\n' + (failed === 0 ? 'PASS' : 'FAIL') + ': ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
