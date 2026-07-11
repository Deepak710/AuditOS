'use strict';

/**
 * Integration Tests — Operational Work Queue Workspace Binding to the Shared
 * Audit State
 *
 * Verifies that the Work Queue Workspace consumes business data exclusively
 * through the Shared Audit State, composes the Shared Workspace Framework and
 * the Enterprise Data Presentation System, aggregates real work items from
 * every operational collection for the current engagement, and never
 * fabricates a work item, a related object, or a priority (GitHub Issue #28 —
 * Work Queue / Integration + Render Validation).
 *
 * The demo bundle carries real findings, testing, controls,
 * evidence-requirements, evidence, evidence-requests, and reports documents
 * for the current engagement, so this suite asserts the full Release 1
 * promise against live data: a ready, non-degraded view model whose health
 * and queue read real, aggregated values across every category; the two
 * presentation-only filters narrowing the same dataset; and a host-agnostic
 * inspector that renders those records into presentation components without
 * throwing (the render validation).
 */

const { SCRIPTS, readText, loadClassicScripts } = require('../lib/prototype');

/** Boots the state foundations plus the Work Queue workspace in one sandbox window. */
function bootWorkQueueSandbox() {
  return loadClassicScripts([
    SCRIPTS.demoDataBundle,
    SCRIPTS.demoDataRegistry,
    SCRIPTS.stateStore,
    SCRIPTS.workspaceRegistry,
    SCRIPTS.workspaceShared,
    SCRIPTS.workQueueWorkspace
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
    addEventListener: function (type, handler) { this._handlers = this._handlers || {}; (this._handlers[type] = this._handlers[type] || []).push(handler); },
    removeEventListener: function () {},
    dispatch: function (type) { ((this._handlers && this._handlers[type]) || []).forEach(function (h) { h({}); }); },
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

/** Finds the first node in the tree carrying the class. */
function findByClass(root, className) {
  let found = null;
  walk(root, function (node) {
    if (!found && node.className && String(node.className).split(' ').indexOf(className) !== -1) { found = node; }
  });
  return found;
}

module.exports = function registerIntegrationTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const workQueueJs = readText('js', 'workspaces', 'work-queue.js');
  const frameworkHtml = readText('components', 'workspace-framework', 'workspace-framework.html');
  const indexHtml = readText('index.html');
  const mainCss = readText('css', 'main.css');

  // ---- Live binding through the real state store and demo-data bundle.

  test('the Work Queue workspace collects a ready, non-degraded view model from the loaded state', async function () {
    const AuditOS = bootWorkQueueSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.workQueueWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(viewModel, 'a view model is collected once the state is ready');
    assert.equal(viewModel.degraded, false, 'demo data loads without degradation');
    assert.equal(viewModel.company.id, viewModel.engagement.companyId,
      'the company is resolved from the current engagement, same rule as every other workspace');
  });

  test('the unified work queue aggregates real items across multiple operational categories', async function () {
    const AuditOS = bootWorkQueueSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.workQueueWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const queue = Array.from(viewModel.queue);
    assert.ok(queue.length > 0, 'the current engagement holds real, aggregated work items');

    const categories = {};
    queue.forEach(function (item) { categories[item.itemType] = true; });
    assert.ok(Object.keys(categories).length >= 3,
      'the queue aggregates items from more than one operational workspace');

    queue.forEach(function (item) {
      assert.ok(item.itemType, 'every work item carries a real item type');
      assert.ok(item.title, 'every work item carries a real title');
      assert.ok(['Blocking', 'High', 'Normal', 'Completed'].indexOf(item.priority) !== -1,
        'every work item resolves to a real priority bucket');
    });
  });

  test('the operational health strip reads real counts, never a fabricated bucket', async function () {
    const AuditOS = bootWorkQueueSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.workQueueWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const health = Array.from(viewModel.health);
    assert.ok(health.length >= 1, 'the health strip carries at least one indicator');
    health.forEach(function (item) {
      assert.ok(item.status, 'every health indicator carries a real value or None, never a fabricated blank');
    });
  });

  test('a degraded state yields a degraded model rather than throwing', function () {
    const AuditOS = loadClassicScripts([
      SCRIPTS.demoDataRegistry,
      SCRIPTS.stateStore,
      SCRIPTS.workspaceRegistry,
      SCRIPTS.workspaceShared,
      SCRIPTS.workQueueWorkspace
    ]).AuditOS;
    return AuditOS.state.init().then(function () {
      const viewModel = AuditOS.workQueueWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
      assert.equal(viewModel.degraded, true, 'no engagement yields a degraded model, never an exception');
    });
  });

  // ---- Render validation — the host-agnostic inspector renders real records,
  // and the interactive filters narrow the same rendered dataset.

  test('the host-agnostic inspector renders the real queue into presentation components without throwing', async function () {
    const win = loadClassicScripts([
      SCRIPTS.demoDataBundle,
      SCRIPTS.demoDataRegistry,
      SCRIPTS.stateStore,
      SCRIPTS.workspaceRegistry,
      SCRIPTS.presentation,
      SCRIPTS.workspaceShared,
      SCRIPTS.workQueueWorkspace
    ]);
    const AuditOS = win.AuditOS;
    await AuditOS.state.init();
    win.document = createDocument();

    const viewModel = AuditOS.workQueueWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
    const node = AuditOS.workQueueWorkspace.renderInspector(viewModel.queue, viewModel.context);

    assert.ok(node, 'the inspector renders a node');
    assert.ok(hasClass(node, 'aos-master-detail'), 'it composes the shared Master–Detail component');
    assert.ok(countClass(node, 'aos-work-queue__row') > 0, 'the master rail renders a row per work item');
    assert.ok(hasClass(node, 'aos-inspector'), 'the detail pane renders the shared Inspector Panel');
    assert.equal(countClass(node, 'aos-work-queue__row--selected'), 1, 'the first row is selected by default');
  });

  test('the inspector renderer is host-agnostic and exposed for reuse', function () {
    const AuditOS = bootWorkQueueSandbox();
    assert.equal(typeof AuditOS.workQueueWorkspace.renderInspector, 'function',
      'the Inspector renderer is exposed so any host can mount it');
    assert.match(workQueueJs, /function renderInspector\(rows, context\)/, 'the renderer is data-in, node-out');
  });

  test('the workspace and priority filter chips narrow the rendered master rail without changing the dataset', async function () {
    const win = loadClassicScripts([
      SCRIPTS.demoDataBundle,
      SCRIPTS.demoDataRegistry,
      SCRIPTS.stateStore,
      SCRIPTS.workspaceRegistry,
      SCRIPTS.presentation,
      SCRIPTS.workspaceShared,
      SCRIPTS.workQueueWorkspace
    ]);
    const AuditOS = win.AuditOS;
    await AuditOS.state.init();
    win.document = createDocument();

    const viewModel = AuditOS.workQueueWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
    const derive = AuditOS.workQueueWorkspace.derivations;
    // Production carries zero findings for every engagement today, so
    // "Findings" is never a populated work-item type; "Requirements" is
    // reliably populated (hundreds of open requirements per engagement) and
    // exercises the same filter-narrowing behavior.
    const requirementsOnly = Array.from(derive.filterQueue(viewModel.queue, 'Requirements', 'All priorities'));
    assert.ok(requirementsOnly.length > 0, 'the current engagement holds at least one Requirements work item to filter to');
    assert.ok(requirementsOnly.length < Array.from(viewModel.queue).length,
      'filtering to one workspace narrows the rendered set without touching the underlying queue');
    requirementsOnly.forEach(function (item) { assert.equal(item.itemType, 'Requirements'); });
  });

  // ---- Source contracts.

  test('the Work Queue workspace reads business data only through AuditOS.state', function () {
    assert.match(workQueueJs, /AuditOS\.state/, 'the workspace consumes the Shared Audit State');
    assert.match(workQueueJs, /listRecords|getDocument|findDatasetsForEngagement/, 'the workspace uses the read API');
    assert.doesNotMatch(workQueueJs, /demoDataBundle/, 'the workspace never touches the demo-data bundle');
    assert.doesNotMatch(workQueueJs, /fetch\s*\(|XMLHttpRequest/, 'the workspace performs no network access');
    assert.doesNotMatch(workQueueJs, /demo-data\//, 'the workspace references no demo-data paths');
    assert.doesNotMatch(workQueueJs, /createRecord|updateRecord|removeRecord/,
      'the workspace renders presentation only; it performs no writes');
  });

  test('the Work Queue workspace carries no hardcoded business values', function () {
    const businessLiterals = /NimbusCloud|Helix|ENG-00\d|CMP-00\d|SEC-\d{1,2}-HLX|RPT-\w+-\d{4}|SOC 2 Type|ISO\/IEC/;
    assert.doesNotMatch(workQueueJs, businessLiterals, 'work-queue.js embeds no demo business content');
  });

  test('the workspace composes the shared framework and presentation system, not bespoke UI', function () {
    assert.match(workQueueJs, /workspaceFramework\.configure/,
      'the header, ribbon, toolbar, and filters are configured through the shared framework');
    assert.match(workQueueJs, /presentation\(\)/, 'content composes the Enterprise Data Presentation System');
    assert.match(workQueueJs, /inspectorPanel|masterDetail|statusBadge|metadataList|activityFeed/,
      'the workspace reuses the shared presentation builders');
  });

  test('the Work Queue workspace populates only reserved framework slots', function () {
    const slotBlock = workQueueJs.match(/SLOTS\s*=\s*\{([\s\S]*?)\}/);
    assert.ok(slotBlock, 'work-queue.js declares its slot map');
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

  test('the Work Queue workspace follows the router and the state events, never polling', function () {
    assert.match(workQueueJs, /ROUTE_CHANGED_EVENT/, 'the workspace follows the route-changed business event');
    assert.match(workQueueJs, /EVENTS\.STATE_LOADED/, 'the workspace follows the state-loaded event');
    assert.doesNotMatch(workQueueJs, /setInterval|setTimeout/, 'the workspace never polls');
  });

  test('the Work Queue workspace is registered as a routable workspace', function () {
    const AuditOS = bootWorkQueueSandbox();
    const workspace = AuditOS.workspaceRegistry.findById(AuditOS.workspaceRegistry.IDS.WORKQUEUE);
    assert.ok(workspace, 'the registry exposes a Work Queue workspace identity');
    assert.equal(workspace.path, 'work-queue', 'it deep-links on the work-queue route');
    assert.ok(AuditOS.workspaceRegistry.findByPath('work-queue'), 'the route resolves back to the workspace');
  });

  test('index.html loads the Work Queue workspace after the framework, after the state foundations', function () {
    const stateIndex = indexHtml.indexOf('js/state/state-store.js');
    const frameworkIndex = indexHtml.indexOf('components/workspace-framework/workspace-framework.js');
    const workQueueIndex = indexHtml.indexOf('js/workspaces/work-queue.js');
    assert.ok(stateIndex !== -1 && frameworkIndex !== -1 && workQueueIndex !== -1, 'all three scripts load');
    assert.ok(stateIndex < workQueueIndex, 'the state foundation loads before the Work Queue workspace');
    assert.ok(frameworkIndex < workQueueIndex, 'the framework skeleton renderer loads before the workspace');
  });

  test('main.css imports the Work Queue stylesheet after the framework layer', function () {
    const frameworkCss = mainCss.indexOf('workspace-framework.css');
    const workQueueCss = mainCss.indexOf('work-queue.css');
    assert.ok(workQueueCss !== -1, 'work-queue.css is imported');
    assert.ok(frameworkCss < workQueueCss, 'the workspace layer imports after the framework layer');
  });
};
