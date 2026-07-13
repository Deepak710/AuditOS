'use strict';

/**
 * Smoke Tests — AuditOS Home Workspace
 *
 * Verifies that the Home foundation comes up: the workspace module loads and
 * registers its API, the landing workspace carries the AuditOS Home identity,
 * and the stylesheet and script wiring is present in the entry points
 * (GitHub Issue #15 — Testing / Smoke Tests).
 */

const fs = require('node:fs');
const {
  SCRIPTS,
  prototypePath,
  readText,
  loadClassicScript,
  loadHomeWorkspace
} = require('../lib/prototype');

module.exports = function registerSmokeTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  test('home.js registers the Home workspace module', function () {
    const home = loadHomeWorkspace();
    assert.ok(home, 'window.AuditOS.homeWorkspace is registered');
    assert.equal(typeof home.init, 'function', 'init is exposed');
    assert.equal(typeof home.collectViewModel, 'function', 'collectViewModel is exposed');
    assert.equal(typeof home.derivations, 'object', 'derivations are exposed for offline testing');
  });

  test('the landing workspace is renamed to AuditOS Home', function () {
    const registry = loadClassicScript(SCRIPTS.workspaceRegistry).AuditOS.workspaceRegistry;
    const home = registry.findById(registry.DEFAULT_WORKSPACE_ID);
    assert.equal(home.label, 'AuditOS Home', 'the default workspace label is AuditOS Home');
    assert.equal(home.title, 'AuditOS Home', 'the default workspace title is AuditOS Home');
    assert.equal(home.id, 'dashboard', 'the stable workspace identifier is unchanged');
    assert.equal(home.path, 'home', 'the canonical Home path (Issue #39 renamed dashboard→home)');
  });

  test('the Home workspace files exist under their owned locations', function () {
    assert.ok(fs.existsSync(prototypePath('js', 'workspaces', 'home.js')), 'js/workspaces/home.js exists');
    assert.ok(fs.existsSync(prototypePath('css', 'home.css')), 'css/home.css exists');
    assert.ok(fs.existsSync(prototypePath('css', 'design-language.css')), 'css/design-language.css exists');
    assert.ok(fs.existsSync(prototypePath('components', 'workspaces', 'home', 'home.html')),
      'components/workspaces/home/home.html exists');
  });

  test('index.html loads the Home workspace script', function () {
    const html = readText('index.html');
    assert.match(html, /js\/workspaces\/home\.js/, 'index.html loads js/workspaces/home.js');
  });

  test('main.css imports the design language and Home stylesheets', function () {
    const mainCss = readText('css', 'main.css');
    assert.match(mainCss, /design-language\.css/, 'main.css imports design-language.css');
    assert.match(mainCss, /home\.css/, 'main.css imports home.css');
  });
};
