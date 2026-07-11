'use strict';

/**
 * Integration Tests — Evidence Workspace Binding to the Shared Audit State
 *
 * Verifies that the Evidence Workspace consumes business data exclusively
 * through the Shared Audit State, composes the Shared Workspace Framework and
 * the Enterprise Data Presentation System, renders faithfully from the current
 * demo evidence JSON, and never fabricates a relationship (GitHub Issue #21 —
 * Testing / Integration + Render Validation).
 *
 * The demo bundle carries real evidence, requests, requirements, controls,
 * testing, findings, and report data for the current engagement, so this suite
 * asserts the full Release 1 promise against live data: a ready, non-degraded
 * view model whose health, outstanding queue, library, reuse, and lineage all
 * read real values; a host-agnostic inspector that renders those records into
 * presentation components without throwing (the render validation); and the
 * source contracts that keep the workspace presentation-only and offline.
 */

const { SCRIPTS, readText, loadClassicScripts, loadEvidenceWorkspace } = require('../lib/prototype');

/** Boots the state foundations plus the Evidence workspace in one sandbox window. */
function bootEvidenceSandbox() {
  return loadClassicScripts([
    SCRIPTS.demoDataBundle,
    SCRIPTS.demoDataRegistry,
    SCRIPTS.stateStore,
    SCRIPTS.workspaceRegistry,
    SCRIPTS.relationships,
    SCRIPTS.workspaceShared,
    SCRIPTS.evidenceWorkspace
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

  const evidenceJs = readText('js', 'workspaces', 'evidence.js');
  const frameworkHtml = readText('components', 'workspace-framework', 'workspace-framework.html');
  const indexHtml = readText('index.html');
  const mainCss = readText('css', 'main.css');

  // ---- Live binding through the real state store and demo-data bundle.

  test('the Evidence workspace collects a ready, non-degraded view model from the loaded state', async function () {
    const AuditOS = bootEvidenceSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.evidenceWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(viewModel, 'a view model is collected once the state is ready');
    assert.equal(viewModel.degraded, false, 'demo data loads without degradation');
    assert.equal(viewModel.company.id, viewModel.engagement.companyId,
      'the company is resolved from the current engagement, same rule as the other workspaces');
  });

  test('the evidence library and health strip read real values from the current engagement', async function () {
    const AuditOS = bootEvidenceSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.evidenceWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(Array.from(viewModel.library).length > 0, 'the current engagement holds real evidence');
    const health = Array.from(viewModel.evidenceHealth);
    assert.deepEqual(health.map(function (item) { return item.label; }), [
      'Pending requests', 'Submitted', 'Approved', 'Rejected', 'Reusable evidence', 'Outstanding approvals'
    ]);
    viewModel.library.forEach(function (row) {
      assert.ok(row.status, 'every library row carries a real review status');
    });
  });

  test('the audit lineage highlights Evidence and carries only real, current counts', async function () {
    const AuditOS = bootEvidenceSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.evidenceWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const lineage = Array.from(viewModel.lineage);
    const evidenceNode = lineage.filter(function (node) { return node.label === 'Evidence'; })[0];
    assert.ok(evidenceNode, 'the lineage includes an Evidence node');
    assert.equal(evidenceNode.highlighted, true, 'Evidence is highlighted as the object this workspace owns');
    lineage.forEach(function (node) {
      if (node.path) {
        assert.ok(AuditOS.workspaceRegistry.findByPath(node.path), node.label + ' navigates to a registered workspace');
      }
    });
  });

  test('reuse renders only what the JSON declares, deriving no relationships itself', async function () {
    const AuditOS = bootEvidenceSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.evidenceWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
    Array.from(viewModel.reuse).forEach(function (item) {
      assert.ok(item.decision, 'every reuse row carries a real decision read from the record');
    });
  });

  test('a degraded state yields a degraded model rather than throwing', function () {
    const AuditOS = loadClassicScripts([
      SCRIPTS.demoDataRegistry,
      SCRIPTS.stateStore,
      SCRIPTS.workspaceRegistry,
      SCRIPTS.relationships,
      SCRIPTS.workspaceShared,
      SCRIPTS.evidenceWorkspace
    ]).AuditOS;
    return AuditOS.state.init().then(function () {
      const viewModel = AuditOS.evidenceWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
      assert.equal(viewModel.degraded, true, 'no engagement yields a degraded model, never an exception');
    });
  });

  // ---- Render validation — the host-agnostic inspector renders real records.

  test('the host-agnostic inspector renders the real library into presentation components without throwing', async function () {
    const win = loadClassicScripts([
      SCRIPTS.demoDataBundle,
      SCRIPTS.demoDataRegistry,
      SCRIPTS.stateStore,
      SCRIPTS.workspaceRegistry,
      SCRIPTS.presentation,
      SCRIPTS.relationships,
      SCRIPTS.workspaceShared,
      SCRIPTS.evidenceWorkspace
    ]);
    const AuditOS = win.AuditOS;
    await AuditOS.state.init();
    win.document = createDocument();

    const viewModel = AuditOS.evidenceWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
    const node = AuditOS.evidenceWorkspace.renderInspector(viewModel.library, viewModel.context);

    assert.ok(node, 'the inspector renders a node');
    assert.ok(hasClass(node, 'aos-master-detail'), 'it composes the shared Master–Detail component');
    assert.ok(countClass(node, 'aos-evidence__row') > 0, 'the master rail renders a row per evidence record');
    assert.ok(hasClass(node, 'aos-inspector'), 'the detail pane renders the shared Inspector Panel');
    assert.equal(countClass(node, 'aos-evidence__row--selected'), 1, 'the first row is selected by default');
  });

  test('the inspector renderer is host-agnostic and exposed for reuse', function () {
    const AuditOS = bootEvidenceSandbox();
    assert.equal(typeof AuditOS.evidenceWorkspace.renderInspector, 'function',
      'the Inspector renderer is exposed so any host can mount it');
    assert.match(evidenceJs, /function renderInspector\(library, context\)/, 'the renderer is data-in, node-out');
  });

  // ---- Source contracts.

  test('the Evidence workspace reads business data only through AuditOS.state', function () {
    assert.match(evidenceJs, /AuditOS\.state/, 'the workspace consumes the Shared Audit State');
    assert.match(evidenceJs, /listRecords|getDocument|findDatasetsForEngagement/, 'the workspace uses the read API');
    assert.doesNotMatch(evidenceJs, /demoDataBundle/, 'the workspace never touches the demo-data bundle');
    assert.doesNotMatch(evidenceJs, /fetch\s*\(|XMLHttpRequest/, 'the workspace performs no network access');
    assert.doesNotMatch(evidenceJs, /demo-data\//, 'the workspace references no demo-data paths');
    assert.doesNotMatch(evidenceJs, /createRecord|updateRecord|removeRecord/,
      'the workspace renders presentation only; it performs no writes');
  });

  test('the Evidence workspace carries no hardcoded business values', function () {
    const businessLiterals = /NimbusCloud|Helix|ENG-00\d|CMP-00\d|POC-0\d|SOC 2|ISO\/IEC/;
    assert.doesNotMatch(evidenceJs, businessLiterals, 'evidence.js embeds no demo business content');
  });

  test('the workspace composes the shared framework and presentation system, not bespoke UI', function () {
    assert.match(evidenceJs, /workspaceFramework\.configure/,
      'the header, ribbon, toolbar, and filters are configured through the shared framework');
    assert.match(evidenceJs, /presentation\(\)/, 'content composes the Enterprise Data Presentation System');
    assert.match(evidenceJs, /inspectorPanel|masterDetail|entityCard|activityFeed|itemList/,
      'the workspace reuses the shared presentation builders');
  });

  test('the Evidence workspace populates only reserved framework slots', function () {
    const slotBlock = evidenceJs.match(/SLOTS\s*=\s*\{([\s\S]*?)\}/);
    assert.ok(slotBlock, 'evidence.js declares its slot map');
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

  test('the Evidence workspace follows the router and the state events, never polling', function () {
    assert.match(evidenceJs, /ROUTE_CHANGED_EVENT/, 'the workspace follows the route-changed business event');
    assert.match(evidenceJs, /EVENTS\.STATE_LOADED/, 'the workspace follows the state-loaded event');
    assert.doesNotMatch(evidenceJs, /setInterval|setTimeout/, 'the workspace never polls');
  });

  test('index.html loads the Evidence workspace after the framework, after the state foundations', function () {
    const stateIndex = indexHtml.indexOf('js/state/state-store.js');
    const frameworkIndex = indexHtml.indexOf('components/workspace-framework/workspace-framework.js');
    const evidenceIndex = indexHtml.indexOf('js/workspaces/evidence.js');
    assert.ok(stateIndex !== -1 && frameworkIndex !== -1 && evidenceIndex !== -1, 'all three scripts load');
    assert.ok(stateIndex < evidenceIndex, 'the state foundation loads before the Evidence workspace');
    assert.ok(frameworkIndex < evidenceIndex, 'the framework skeleton renderer loads before the workspace');
  });

  test('main.css imports the Evidence stylesheet after the framework layer', function () {
    const frameworkCss = mainCss.indexOf('workspace-framework.css');
    const evidenceCss = mainCss.indexOf('evidence.css');
    assert.ok(evidenceCss !== -1, 'evidence.css is imported');
    assert.ok(frameworkCss < evidenceCss, 'the workspace layer imports after the framework layer');
  });
};
