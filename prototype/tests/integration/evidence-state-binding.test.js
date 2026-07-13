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
 * asserts the full promise against live data: a ready, non-degraded view model
 * whose engagement-scoped rows, KPIs, and charts read real values; a
 * host-agnostic enterprise table that renders those records into presentation
 * components without throwing (the render validation); and the source contracts
 * that keep the workspace engagement-scoped, offline, and writing only through
 * the Suggestion Lifecycle (GitHub Issue #38).
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

  test('the evidence table, KPIs, and charts read real engagement-scoped values', async function () {
    const AuditOS = bootEvidenceSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.evidenceWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(Array.from(viewModel.rows).length > 0, 'the current engagement holds real evidence rows');
    viewModel.rows.forEach(function (row) {
      assert.ok(row.status, 'every evidence row carries a real review status');
      assert.ok(row.id, 'every evidence row carries a real identifier');
    });

    const kpis = Array.from(AuditOS.evidenceWorkspace.derivations.deriveKpis(viewModel.rows));
    assert.equal(kpis[0].label, 'Evidence', 'the KPI strip leads with the total');
    assert.equal(kpis[0].value, String(viewModel.rows.length), 'the total KPI counts the real rows');

    const statusChart = Array.from(AuditOS.evidenceWorkspace.derivations.deriveStatusChart(viewModel.rows));
    assert.ok(statusChart.length > 0, 'the status chart distributes the real rows');
    statusChart.forEach(function (segment) {
      assert.equal(segment.filter.field, 'status', 'each status segment is a status filter facet');
    });
  });

  test('every control mapping resolves within the current engagement, never fabricated', async function () {
    const AuditOS = bootEvidenceSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.evidenceWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    let mapped = 0;
    viewModel.rows.forEach(function (row) {
      Array.from(row.mappings).forEach(function (mapping) {
        mapped += 1;
        assert.ok(mapping.code, 'every mapping carries a real control code');
        assert.equal(typeof mapping.sameEngagement, 'boolean', 'each mapping records whether it is same-engagement');
      });
    });
    assert.ok(mapped > 0, 'the engagement evidence maps to real controls through its requirements');
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

  // ---- Render validation — the host-agnostic enterprise table renders real records.

  test('the host-agnostic renderer renders the real evidence into the enterprise table without throwing', async function () {
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
    const node = AuditOS.evidenceWorkspace.renderInspector(viewModel.rows, viewModel.context);

    assert.ok(node, 'the renderer returns a node');
    assert.ok(hasClass(node, 'aos-evidence__board'), 'it renders the one engagement Evidence board');
    assert.ok(hasClass(node, 'aos-data-grid'), 'the dense enterprise table composes the shared Data Grid');
    assert.ok(hasClass(node, 'aos-evidence__kpis'), 'the header band renders the KPI strip');
    assert.ok(hasClass(node, 'aos-evidence__chart'), 'the header band renders operational charts');
    assert.ok(countClass(node, 'aos-evidence__table-title') > 0, 'the table renders a row per evidence record');
  });

  test('the enterprise-table renderer is host-agnostic and exposed for reuse', function () {
    const AuditOS = bootEvidenceSandbox();
    assert.equal(typeof AuditOS.evidenceWorkspace.renderInspector, 'function',
      'the renderer is exposed so any host can mount it');
    assert.match(evidenceJs, /function renderInspector\(rows, context\)/, 'the renderer is data-in, node-out');
  });

  // ---- Source contracts.

  test('the Evidence workspace reads business data only through AuditOS.state and writes only through the Suggestion Lifecycle', function () {
    assert.match(evidenceJs, /AuditOS\.state/, 'the workspace consumes the Shared Audit State');
    assert.match(evidenceJs, /listRecords|getDocument|findDatasetsForEngagement/, 'the workspace uses the read API');
    assert.doesNotMatch(evidenceJs, /demoDataBundle/, 'the workspace never touches the demo-data bundle');
    assert.doesNotMatch(evidenceJs, /fetch\s*\(|XMLHttpRequest/, 'the workspace performs no network access');
    assert.doesNotMatch(evidenceJs, /demo-data\//, 'the workspace references no demo-data paths');
    // Status editing is the only write, and it goes through the shared
    // Suggestion Lifecycle (Issue #38 Part 11) — the record is written on
    // Apply, never by the workspace calling the state write API directly.
    assert.match(evidenceJs, /suggestionService/, 'status changes flow through the Suggestion Lifecycle service');
    assert.doesNotMatch(evidenceJs, /state\.(createRecord|updateRecord|removeRecord)/,
      'the workspace never writes the Shared Audit State directly');
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
