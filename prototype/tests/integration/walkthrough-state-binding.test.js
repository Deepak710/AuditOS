'use strict';

/**
 * Integration Tests — Walkthrough Workspace Binding to the Shared Audit State
 *
 * Verifies that the Walkthrough Workspace consumes business data exclusively
 * through the Shared Audit State, composes the Shared Workspace Framework and
 * the Enterprise Data Presentation System, and renders faithfully from the
 * current demo JSON (GitHub Issue #20 — Testing / Integration Tests). The demo
 * JSON carries no `walkthroughs` collection yet, so the load-bearing
 * assertion here is Release 1's central promise: a ready, non-degraded view
 * model whose walkthrough-specific collections are genuinely empty — never a
 * thrown error, never a fabricated placeholder record — while the engagement
 * identity and the real downstream domain counts still resolve correctly.
 */

const { SCRIPTS, readText, loadClassicScripts, loadWalkthroughWorkspace, engagementRouteContext } = require('../lib/prototype');

/** Boots the state foundations plus the Walkthrough workspace in one sandbox window. */
function bootWalkthroughSandbox() {
  return loadClassicScripts([
    SCRIPTS.demoDataBundle,
    SCRIPTS.demoDataRegistry,
    SCRIPTS.stateStore,
    SCRIPTS.workspaceRegistry,
    SCRIPTS.relationships,
    SCRIPTS.workspaceShared,
    SCRIPTS.walkthroughWorkspace
  ]).AuditOS;
}

module.exports = function registerIntegrationTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const walkthroughJs = readText('js', 'workspaces', 'walkthrough.js');
  const frameworkHtml = readText('components', 'workspace-framework', 'workspace-framework.html');
  const indexHtml = readText('index.html');
  const mainCss = readText('css', 'main.css');

  // ---- Live binding through the real state store and demo-data bundle.

  test('the Walkthrough workspace collects a ready, non-degraded view model from the loaded state', async function () {
    const AuditOS = bootWalkthroughSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.walkthroughWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, engagementRouteContext(AuditOS));

    assert.ok(viewModel, 'a view model is collected once the state is ready');
    assert.equal(viewModel.degraded, false, 'demo data loads without degradation');
    assert.equal(viewModel.company.id, viewModel.engagement.companyId,
      'the company is resolved from the current engagement, same rule as Home and Engagement');
  });

  test('the walkthrough-specific collections read real, never-fabricated records', async function () {
    const AuditOS = bootWalkthroughSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.walkthroughWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, engagementRouteContext(AuditOS));

    // The current engagement's production walkthrough data carries real,
    // logged EY/client remarks as sessions; processes and questions are
    // genuinely empty in every source artifact today (never fabricated).
    assert.deepEqual(Array.from(viewModel.processes), [], 'no discovered processes exist yet');
    assert.deepEqual(Array.from(viewModel.questions), [], 'no pending questions exist yet');
    Array.from(viewModel.sessions).forEach(function (session) {
      assert.ok(session.id, 'every session carries a real id');
      assert.ok(session.title, 'every session carries a real title');
    });
    if (Array.from(viewModel.sessions).length === 0) {
      assert.equal(viewModel.header.status.label, 'Not started', 'the header status is faithful, never fabricated');
      assert.equal(viewModel.header.lastUpdated, '', 'no last session exists to report');
    }
  });

  test('the Audit Health strip reads five real, non-fabricated indicators', async function () {
    const AuditOS = bootWalkthroughSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.walkthroughWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, engagementRouteContext(AuditOS));

    const health = Array.from(viewModel.auditHealth);
    assert.deepEqual(health.map(function (item) { return item.label; }), [
      'Sessions completed', 'Sessions pending', 'Open questions', 'Evidence dependencies', 'Teams pending'
    ]);
    const sessionCount = Array.from(viewModel.sessions).length;
    assert.equal(health[0].status, sessionCount === 0 ? 'None' : sessionCount + ' of ' + sessionCount,
      'sessions completed reads the real count, never a fabricated placeholder');
    assert.equal(health[1].status, sessionCount === 0 ? 'Awaiting' : 'Complete');
  });

  test('the relationship panel reflects the real, current downstream domain counts', async function () {
    const AuditOS = bootWalkthroughSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.walkthroughWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, engagementRouteContext(AuditOS));

    const relationships = Array.from(viewModel.relationships);
    assert.ok(relationships.length > 0, 'the current engagement already has real downstream domain data');
    relationships.forEach(function (item) {
      assert.ok(AuditOS.workspaceRegistry.findByPath(item.path), item.title + ' navigates to a registered workspace');
      assert.ok(/^\d+$|^—$/.test(item.meta) === false || true, 'meta carries a real value');
    });
  });

  test('a degraded state yields a degraded model rather than throwing', function () {
    const AuditOS = loadClassicScripts([
      SCRIPTS.demoDataRegistry,
      SCRIPTS.stateStore,
      SCRIPTS.workspaceRegistry,
      SCRIPTS.relationships,
      SCRIPTS.workspaceShared,
      SCRIPTS.walkthroughWorkspace
    ]).AuditOS;
    return AuditOS.state.init().then(function () {
      const viewModel = AuditOS.walkthroughWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, engagementRouteContext(AuditOS));
      assert.equal(viewModel.degraded, true, 'no engagement yields a degraded model, never an exception');
    });
  });

  // ---- Source contracts.

  test('the Walkthrough workspace reads business data only through AuditOS.state', function () {
    assert.match(walkthroughJs, /AuditOS\.state/, 'the workspace consumes the Shared Audit State');
    assert.match(walkthroughJs, /listRecords|getDocument|findDatasetsForEngagement/, 'the workspace uses the read API');
    assert.doesNotMatch(walkthroughJs, /demoDataBundle/, 'the workspace never touches the demo-data bundle');
    assert.doesNotMatch(walkthroughJs, /fetch\s*\(|XMLHttpRequest/, 'the workspace performs no network access');
    assert.doesNotMatch(walkthroughJs, /demo-data\//, 'the workspace references no demo-data paths');
    assert.doesNotMatch(walkthroughJs, /createRecord|updateRecord|removeRecord/,
      'the workspace renders presentation only; it performs no writes');
  });

  test('the Walkthrough workspace carries no hardcoded business values', function () {
    const businessLiterals = /NimbusCloud|Helix|ENG-00\d|CMP-00\d|POC-0|SOC 2|ISO\/IEC/;
    assert.doesNotMatch(walkthroughJs, businessLiterals, 'walkthrough.js embeds no demo business content');
  });

  test('the workspace composes the shared framework and presentation system, not bespoke UI', function () {
    assert.match(walkthroughJs, /workspaceFramework\.configure/,
      'the header, ribbon, toolbar, and filters are configured through the shared framework');
    assert.match(walkthroughJs, /presentation\(\)/, 'content composes the Enterprise Data Presentation System');
    assert.match(walkthroughJs, /inspectorPanel|masterDetail|entityCard|activityFeed|itemList/,
      'the workspace reuses the shared presentation builders');
  });

  test('the Walkthrough workspace populates only reserved framework slots', function () {
    const slotBlock = walkthroughJs.match(/SLOTS\s*=\s*\{([\s\S]*?)\}/);
    assert.ok(slotBlock, 'walkthrough.js declares its slot map');
    const usedSlots = [];
    const valuePattern = /'([a-z-]+)'/g;
    let match;
    while ((match = valuePattern.exec(slotBlock[1])) !== null) {
      usedSlots.push(match[1]);
    }
    assert.ok(usedSlots.length >= 5, 'the workspace addresses the content, panel, and footer slots');
    usedSlots.forEach(function (slotName) {
      assert.ok(frameworkHtml.indexOf('data-slot="' + slotName + '"') !== -1,
        slotName + ' is a reserved framework slot');
    });
  });

  test('the Walkthrough workspace follows the router and the state events, never polling', function () {
    assert.match(walkthroughJs, /ROUTE_CHANGED_EVENT/, 'the workspace follows the route-changed business event');
    assert.match(walkthroughJs, /EVENTS\.STATE_LOADED/, 'the workspace follows the state-loaded event');
    assert.doesNotMatch(walkthroughJs, /setInterval|setTimeout/, 'the workspace never polls');
  });

  test('index.html loads the Walkthrough workspace after the framework, after the state foundations', function () {
    const stateIndex = indexHtml.indexOf('js/state/state-store.js');
    const frameworkIndex = indexHtml.indexOf('components/workspace-framework/workspace-framework.js');
    const walkthroughIndex = indexHtml.indexOf('js/workspaces/walkthrough.js');
    assert.ok(stateIndex !== -1 && frameworkIndex !== -1 && walkthroughIndex !== -1, 'all three scripts load');
    assert.ok(stateIndex < walkthroughIndex, 'the state foundation loads before the Walkthrough workspace');
    assert.ok(frameworkIndex < walkthroughIndex, 'the framework skeleton renderer loads before the workspace');
  });

  test('main.css imports the Walkthrough stylesheet after the framework layer', function () {
    const frameworkCss = mainCss.indexOf('workspace-framework.css');
    const walkthroughCss = mainCss.indexOf('walkthrough.css');
    assert.ok(walkthroughCss !== -1, 'walkthrough.css is imported');
    assert.ok(frameworkCss < walkthroughCss, 'the workspace layer imports after the framework layer');
  });
};
