'use strict';

/**
 * Smoke Tests — AuditOS Walkthrough Workspace
 *
 * Verifies that the Walkthrough Workspace foundation comes up: the module
 * loads and registers its API, the walkthrough workspace is registered in the
 * router, and the stylesheet and script wiring is present in the entry points
 * (GitHub Issue #20 — Testing / Smoke Tests).
 */

const fs = require('node:fs');
const {
  SCRIPTS,
  prototypePath,
  readText,
  loadClassicScript,
  loadWalkthroughWorkspace
} = require('../lib/prototype');

module.exports = function registerSmokeTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  test('walkthrough.js registers the Walkthrough workspace module', function () {
    const walkthrough = loadWalkthroughWorkspace();
    assert.ok(walkthrough, 'window.AuditOS.walkthroughWorkspace is registered');
    assert.equal(typeof walkthrough.init, 'function', 'init is exposed');
    assert.equal(typeof walkthrough.collectViewModel, 'function', 'collectViewModel is exposed');
    assert.equal(typeof walkthrough.derivations, 'object', 'derivations are exposed for offline testing');
    assert.equal(typeof walkthrough.derivations.deriveWalkthroughStatus, 'function',
      'the walkthrough status derivation is exposed');
  });

  test('the walkthrough workspace is registered in the router', function () {
    const registry = loadClassicScript(SCRIPTS.workspaceRegistry).AuditOS.workspaceRegistry;
    const walkthrough = registry.findById(registry.IDS.WALKTHROUGH);
    assert.ok(walkthrough, 'the walkthrough workspace is registered');
    assert.equal(walkthrough.id, 'walkthrough', 'the stable workspace identifier');
    assert.equal(walkthrough.path, 'walkthroughs', 'the stable hash path');
    assert.equal(walkthrough.label, 'Walkthrough', 'the workspace label');
    assert.equal(registry.findByPath('walkthroughs').id, 'walkthrough', 'the path resolves back to the workspace');
  });

  test('the Walkthrough workspace files exist under their owned locations', function () {
    assert.ok(fs.existsSync(prototypePath('js', 'workspaces', 'walkthrough.js')), 'js/workspaces/walkthrough.js exists');
    assert.ok(fs.existsSync(prototypePath('css', 'walkthrough.css')), 'css/walkthrough.css exists');
  });

  test('index.html loads the Walkthrough workspace script', function () {
    const html = readText('index.html');
    assert.match(html, /js\/workspaces\/walkthrough\.js/, 'index.html loads js/workspaces/walkthrough.js');
  });

  test('main.css imports the Walkthrough stylesheet', function () {
    const mainCss = readText('css', 'main.css');
    assert.match(mainCss, /walkthrough\.css/, 'main.css imports walkthrough.css');
  });
};
