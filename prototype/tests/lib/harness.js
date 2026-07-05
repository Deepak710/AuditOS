'use strict';

/**
 * AuditOS Test Harness
 *
 * A zero-dependency assertion and case-collection helper for the prototype
 * test suites. It intentionally introduces no test framework, build step, or
 * npm dependency: the prototype is vanilla and offline, so its tests run on the
 * Node standard library alone (Coding Standards §30.21 — no unnecessary
 * complexity). Each suite module is a function that receives a harness and
 * registers named test cases; the runner (run-tests.js) executes them.
 */

const assert = require('node:assert/strict');

/** Creates a fresh harness: `test(name, fn)` collects cases; `assert` is Node's strict assert. */
function createHarness() {
  const cases = [];
  return {
    assert,
    test: function registerCase(name, fn) {
      cases.push({ name: name, fn: fn });
    },
    cases: cases
  };
}

module.exports = { createHarness: createHarness };
