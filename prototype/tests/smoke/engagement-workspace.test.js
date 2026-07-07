'use strict';

/**
 * Smoke Tests — AuditOS Engagement Workspace
 *
 * Verifies that the Engagement Workspace foundation comes up: the module loads
 * and registers its API, the engagement workspace is registered in the router,
 * and the stylesheet and script wiring is present in the entry points
 * (GitHub Issue #19 — Testing / Smoke Tests).
 */

const fs = require('node:fs');
const {
  SCRIPTS,
  prototypePath,
  readText,
  loadClassicScript,
  loadEngagementWorkspace
} = require('../lib/prototype');

module.exports = function registerSmokeTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  test('engagement.js registers the Engagement workspace module', function () {
    const engagement = loadEngagementWorkspace();
    assert.ok(engagement, 'window.AuditOS.engagementWorkspace is registered');
    assert.equal(typeof engagement.init, 'function', 'init is exposed');
    assert.equal(typeof engagement.collectViewModel, 'function', 'collectViewModel is exposed');
    assert.equal(typeof engagement.derivations, 'object', 'derivations are exposed for offline testing');
    assert.equal(typeof engagement.derivations.normalizeFrameworks, 'function',
      'the array-capable framework seam is exposed');
  });

  test('the engagement workspace is registered in the router', function () {
    const registry = loadClassicScript(SCRIPTS.workspaceRegistry).AuditOS.workspaceRegistry;
    const engagement = registry.findById(registry.IDS.ENGAGEMENT);
    assert.ok(engagement, 'the engagement workspace is registered');
    assert.equal(engagement.id, 'engagement', 'the stable workspace identifier');
    assert.equal(engagement.path, 'engagements', 'the stable hash path');
    assert.equal(engagement.label, 'Engagement', 'the workspace label');
    assert.equal(registry.findByPath('engagements').id, 'engagement', 'the path resolves back to the workspace');
  });

  test('the Engagement workspace files exist under their owned locations', function () {
    assert.ok(fs.existsSync(prototypePath('js', 'workspaces', 'engagement.js')), 'js/workspaces/engagement.js exists');
    assert.ok(fs.existsSync(prototypePath('css', 'engagement.css')), 'css/engagement.css exists');
  });

  test('index.html loads the Engagement workspace script', function () {
    const html = readText('index.html');
    assert.match(html, /js\/workspaces\/engagement\.js/, 'index.html loads js/workspaces/engagement.js');
  });

  test('main.css imports the Engagement stylesheet', function () {
    const mainCss = readText('css', 'main.css');
    assert.match(mainCss, /engagement\.css/, 'main.css imports engagement.css');
  });
};
