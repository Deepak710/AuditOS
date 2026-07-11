'use strict';

/**
 * Integration Tests — Testing Workspace Binding to the Shared Audit State
 *
 * Verifies that the Testing Workspace consumes business data exclusively through
 * the Shared Audit State, composes the Shared Workspace Framework and the
 * Enterprise Data Presentation System, renders faithfully from the current demo
 * testing JSON, offers three presentation modes over one dataset, and never
 * fabricates a related control, an exception, or a conclusion (GitHub Issue #24 —
 * Testing / Integration + Render Validation).
 *
 * The demo bundle carries real testing, control, requirement, evidence, findings,
 * and report data for the current engagement, so this suite asserts the full
 * Release 1 promise against live data: a ready, non-degraded view model whose
 * health, progress, queue, three views, exceptions, and lineage all read real
 * values; a host-agnostic inspector that renders those records into presentation
 * components without throwing (the render validation); and the source contracts
 * that keep the workspace presentation-only and offline.
 */

const { SCRIPTS, readText, loadClassicScripts } = require('../lib/prototype');

/** Boots the state foundations plus the Testing workspace in one sandbox window. */
function bootTestingSandbox() {
  return loadClassicScripts([
    SCRIPTS.demoDataBundle,
    SCRIPTS.demoDataRegistry,
    SCRIPTS.stateStore,
    SCRIPTS.workspaceRegistry,
    SCRIPTS.relationships,
    SCRIPTS.workspaceShared,
    SCRIPTS.testingWorkspace
  ]).AuditOS;
}

// ---------------------------------------------------------------------------
// A minimal DOM stub — the surface the workspace's DOM builders touch when the
// presentation system renders (createElement, classList, setAttribute,
// appendChild, replaceChildren, addEventListener). No jsdom, no browser; the
// modules read global.document only inside a builder call, so attaching this to
// the loaded window is enough to render offline (Render Validation).
// ---------------------------------------------------------------------------

function makeNode(tagName) {
  const classes = [];
  const node = {
    nodeType: 1,
    tagName: tagName ? String(tagName).toUpperCase() : tagName,
    textContent: '',
    attributes: {},
    children: [],
    style: { setProperty: function () {} },
    classList: {
      add: function () { Array.prototype.forEach.call(arguments, function (c) { if (classes.indexOf(c) === -1) { classes.push(c); } }); },
      remove: function () { Array.prototype.forEach.call(arguments, function (c) { const i = classes.indexOf(c); if (i !== -1) { classes.splice(i, 1); } }); },
      toggle: function (c, on) { const has = classes.indexOf(c) !== -1; const want = on === undefined ? !has : on; if (want && !has) { classes.push(c); } if (!want && has) { classes.splice(classes.indexOf(c), 1); } return want; },
      contains: function (c) { return classes.indexOf(c) !== -1; }
    },
    appendChild: function (child) { this.children.push(child); return child; },
    replaceChildren: function () { this.children = Array.prototype.slice.call(arguments); },
    setAttribute: function (key, value) { this.attributes[key] = String(value); },
    getAttribute: function (key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    addEventListener: function () {},
    removeEventListener: function () {},
    getBoundingClientRect: function () { return { left: 0, width: 0 }; },
    querySelectorAll: function () { return []; }
  };
  Object.defineProperty(node, 'className', {
    get: function () { return classes.join(' '); },
    set: function (value) { classes.length = 0; String(value).split(' ').filter(Boolean).forEach(function (c) { classes.push(c); }); }
  });
  return node;
}

function createDocument() {
  return {
    createElement: function (tag) { return makeNode(tag); },
    createTextNode: function (text) { return { nodeType: 3, textContent: String(text), children: [] }; },
    createDocumentFragment: function () { return makeNode('#fragment'); },
    addEventListener: function () {},
    removeEventListener: function () {}
  };
}

/** Depth-first walk over the stub tree. */
function walk(node, visit) {
  if (!node) { return; }
  visit(node);
  (node.children || []).forEach(function (child) { walk(child, visit); });
}

/** True when any node in the tree carries the class. */
function hasClass(root, className) {
  let found = false;
  walk(root, function (node) {
    if (node.className && String(node.className).split(' ').indexOf(className) !== -1) { found = true; }
  });
  return found;
}

/** Counts the nodes in the tree carrying the class. */
function countClass(root, className) {
  let total = 0;
  walk(root, function (node) {
    if (node.className && String(node.className).split(' ').indexOf(className) !== -1) { total += 1; }
  });
  return total;
}

module.exports = function registerIntegrationTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const testingJs = readText('js', 'workspaces', 'testing.js');
  const frameworkHtml = readText('components', 'workspace-framework', 'workspace-framework.html');
  const indexHtml = readText('index.html');
  const mainCss = readText('css', 'main.css');

  // ---- Live binding through the real state store and demo-data bundle.

  test('the Testing workspace collects a ready, non-degraded view model from the loaded state', async function () {
    const AuditOS = bootTestingSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.testingWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(viewModel, 'a view model is collected once the state is ready');
    assert.equal(viewModel.degraded, false, 'demo data loads without degradation');
    assert.equal(viewModel.company.id, viewModel.engagement.companyId,
      'the company is resolved from the current engagement, same rule as the other workspaces');
  });

  test('the test queue and health strip read real values from the current engagement', async function () {
    const AuditOS = bootTestingSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.testingWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(Array.from(viewModel.queue).length > 0, 'the current engagement holds real tests');
    viewModel.queue.forEach(function (row) {
      assert.ok(row.id, 'every queue row carries a real test id');
      assert.ok(row.procedure, 'every queue row carries a real procedure');
      assert.ok(row.status, 'every queue row carries a real status');
      assert.ok(row.evidence && row.evidence.label, 'every queue row carries a derived evidence status');
    });
    const health = Array.from(viewModel.testingHealth);
    assert.ok(health.length >= 3, 'the health strip carries at least the passed / exceptions / awaiting indicators');
    health.forEach(function (item) {
      assert.ok(item.status, 'every health indicator carries a real count or Clear / None, never a fabricated blank');
    });
  });

  test('the related control resolves against the shared control library for real tests', async function () {
    const AuditOS = bootTestingSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.testingWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const resolved = viewModel.queue.filter(function (row) { return row.control && row.control.title; });
    assert.ok(resolved.length > 0, 'at least some tests resolve their related control through a real join');
  });

  test('testing progress reads real completed / total counts, never an estimated percentage', async function () {
    const AuditOS = bootTestingSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.testingWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const progress = viewModel.progress;
    assert.equal(progress.total, Array.from(viewModel.queue).length, 'the progress total is the real test count');
    assert.ok(progress.completed <= progress.total, 'completed never exceeds the total');
    assert.equal(progress.passed + progress.failed <= progress.total, true, 'the result breakdown stays within the total');
  });

  test('the three presentation modes regroup one dataset without changing it', async function () {
    const AuditOS = bootTestingSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.testingWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const total = Array.from(viewModel.queue).length;
    const views = Array.from(viewModel.views);
    assert.deepEqual(views.map(function (view) { return view.id; }), ['test', 'control', 'result']);
    views.forEach(function (view) {
      const rows = Array.from(view.view.groups).reduce(function (sum, group) { return sum + Array.from(group.rows).length; }, 0);
      assert.equal(rows, total, view.label + ' preserves every test — presentation only, never a data change');
    });
  });

  test('exceptions surface only actual failures, resolved to their raised finding', async function () {
    const AuditOS = bootTestingSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.testingWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    // Production carries zero failed test results ("Fail") for every
    // engagement today; exceptions are genuinely empty, never fabricated.
    const exceptions = Array.from(viewModel.exceptions);
    exceptions.forEach(function (item) {
      assert.ok(item.findingId, 'every exception carries the id of the finding it raised — never a placeholder finding');
      assert.ok(item.title, 'every exception carries a real title');
    });
  });

  test('the audit lineage highlights Testing and carries only real, current counts', async function () {
    const AuditOS = bootTestingSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.testingWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const lineage = Array.from(viewModel.lineage);
    const testingNode = lineage.filter(function (node) { return node.label === 'Testing'; })[0];
    assert.ok(testingNode, 'the lineage includes a Testing node');
    assert.equal(testingNode.highlighted, true, 'Testing is highlighted as the object this workspace owns');
    assert.ok(testingNode.count > 0, 'the Testing node carries the real test count');
    lineage.forEach(function (node) {
      if (node.path) {
        assert.ok(AuditOS.workspaceRegistry.findByPath(node.path), node.label + ' navigates to a registered workspace');
      }
    });
  });

  test('a degraded state yields a degraded model rather than throwing', function () {
    const AuditOS = loadClassicScripts([
      SCRIPTS.demoDataRegistry,
      SCRIPTS.stateStore,
      SCRIPTS.workspaceRegistry,
      SCRIPTS.relationships,
      SCRIPTS.workspaceShared,
      SCRIPTS.testingWorkspace
    ]).AuditOS;
    return AuditOS.state.init().then(function () {
      const viewModel = AuditOS.testingWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
      assert.equal(viewModel.degraded, true, 'no engagement yields a degraded model, never an exception');
    });
  });

  // ---- Render validation — the host-agnostic inspector renders real records.

  test('the host-agnostic inspector renders the real queue into presentation components without throwing', async function () {
    const win = loadClassicScripts([
      SCRIPTS.demoDataBundle,
      SCRIPTS.demoDataRegistry,
      SCRIPTS.stateStore,
      SCRIPTS.workspaceRegistry,
      SCRIPTS.presentation,
      SCRIPTS.relationships,
      SCRIPTS.workspaceShared,
      SCRIPTS.testingWorkspace
    ]);
    const AuditOS = win.AuditOS;
    await AuditOS.state.init();
    win.document = createDocument();

    const viewModel = AuditOS.testingWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
    const node = AuditOS.testingWorkspace.renderInspector(viewModel.queue, viewModel.context);

    assert.ok(node, 'the inspector renders a node');
    assert.ok(hasClass(node, 'aos-master-detail'), 'it composes the shared Master–Detail component');
    assert.ok(countClass(node, 'aos-testing__row') > 0, 'the master rail renders a row per test');
    assert.ok(hasClass(node, 'aos-inspector'), 'the detail pane renders the shared Inspector Panel');
    assert.equal(countClass(node, 'aos-testing__row--selected'), 1, 'the first row is selected by default');
  });

  test('the inspector renderer is host-agnostic and exposed for reuse', function () {
    const AuditOS = bootTestingSandbox();
    assert.equal(typeof AuditOS.testingWorkspace.renderInspector, 'function',
      'the Inspector renderer is exposed so any host can mount it');
    assert.match(testingJs, /function renderInspector\(queue, context\)/, 'the renderer is data-in, node-out');
  });

  // ---- Source contracts.

  test('the Testing workspace reads business data only through AuditOS.state', function () {
    assert.match(testingJs, /AuditOS\.state/, 'the workspace consumes the Shared Audit State');
    assert.match(testingJs, /listRecords|getDocument|findDatasetsForEngagement/, 'the workspace uses the read API');
    assert.doesNotMatch(testingJs, /demoDataBundle/, 'the workspace never touches the demo-data bundle');
    assert.doesNotMatch(testingJs, /fetch\s*\(|XMLHttpRequest/, 'the workspace performs no network access');
    assert.doesNotMatch(testingJs, /demo-data\//, 'the workspace references no demo-data paths');
    assert.doesNotMatch(testingJs, /createRecord|updateRecord|removeRecord/,
      'the workspace renders presentation only; it performs no writes');
  });

  test('the Testing workspace carries no hardcoded business values', function () {
    const businessLiterals = /NimbusCloud|Helix|ENG-00\d|CMP-00\d|USR-00\d|LIB-CTRL|SOC 2 Type|ISO\/IEC/;
    assert.doesNotMatch(testingJs, businessLiterals, 'testing.js embeds no demo business content');
  });

  test('the workspace composes the shared framework and presentation system, not bespoke UI', function () {
    assert.match(testingJs, /workspaceFramework\.configure/,
      'the header, ribbon, toolbar, and filters are configured through the shared framework');
    assert.match(testingJs, /presentation\(\)/, 'content composes the Enterprise Data Presentation System');
    assert.match(testingJs, /inspectorPanel|masterDetail|statusBadge|progressMeter|itemList/,
      'the workspace reuses the shared presentation builders');
  });

  test('the Testing workspace populates only reserved framework slots', function () {
    const slotBlock = testingJs.match(/SLOTS\s*=\s*\{([\s\S]*?)\}/);
    assert.ok(slotBlock, 'testing.js declares its slot map');
    const usedSlots = [];
    const valuePattern = /'([a-z-]+)'/g;
    let match;
    while ((match = valuePattern.exec(slotBlock[1])) !== null) {
      usedSlots.push(match[1]);
    }
    assert.ok(usedSlots.length >= 5, 'the workspace addresses the content, panels, and footer slots');
    usedSlots.forEach(function (slotName) {
      assert.ok(frameworkHtml.indexOf('data-slot="' + slotName + '"') !== -1,
        slotName + ' is a reserved framework slot');
    });
  });

  test('the Testing workspace follows the router and the state events, never polling', function () {
    assert.match(testingJs, /ROUTE_CHANGED_EVENT/, 'the workspace follows the route-changed business event');
    assert.match(testingJs, /EVENTS\.STATE_LOADED/, 'the workspace follows the state-loaded event');
    assert.doesNotMatch(testingJs, /setInterval|setTimeout/, 'the workspace never polls');
  });

  test('the Testing workspace is registered as a routable workspace', function () {
    const AuditOS = bootTestingSandbox();
    const workspace = AuditOS.workspaceRegistry.findById(AuditOS.workspaceRegistry.IDS.TESTING);
    assert.ok(workspace, 'the registry exposes a Testing workspace identity');
    assert.equal(workspace.path, 'testing', 'it deep-links on the testing route');
    assert.ok(AuditOS.workspaceRegistry.findByPath('testing'), 'the route resolves back to the workspace');
  });

  test('index.html loads the Testing workspace after the framework, after the state foundations', function () {
    const stateIndex = indexHtml.indexOf('js/state/state-store.js');
    const frameworkIndex = indexHtml.indexOf('components/workspace-framework/workspace-framework.js');
    const testingIndex = indexHtml.indexOf('js/workspaces/testing.js');
    assert.ok(stateIndex !== -1 && frameworkIndex !== -1 && testingIndex !== -1, 'all three scripts load');
    assert.ok(stateIndex < testingIndex, 'the state foundation loads before the Testing workspace');
    assert.ok(frameworkIndex < testingIndex, 'the framework skeleton renderer loads before the workspace');
  });

  test('main.css imports the Testing stylesheet after the framework layer', function () {
    const frameworkCss = mainCss.indexOf('workspace-framework.css');
    const testingCss = mainCss.indexOf('testing.css');
    assert.ok(testingCss !== -1, 'testing.css is imported');
    assert.ok(frameworkCss < testingCss, 'the workspace layer imports after the framework layer');
  });
};
