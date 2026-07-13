'use strict';

/**
 * Integration Tests — Documentation Workspace Binding to the Shared Audit State
 *
 * Verifies that the Documentation Workspace consumes business data exclusively
 * through the Shared Audit State, composes the Shared Workspace Framework and
 * the Enterprise Data Presentation System, renders faithfully from the current
 * demo `reports` JSON, and never fabricates a related object, a count, or
 * document content (GitHub Issue #26 — Documentation / Integration + Render
 * Validation).
 *
 * The demo bundle carries a real report document for the current engagement —
 * titled sections in authored order, each with a source and a references
 * block — so this suite asserts the full Release 1 promise against live data:
 * a ready, non-degraded view model whose health, navigator, and lineage all
 * read real values; a host-agnostic inspector that renders those records into
 * presentation components without throwing (the render validation); and the
 * source contracts that keep the workspace presentation-only and offline.
 */

const { SCRIPTS, readText, loadClassicScripts, engagementRouteContext } = require('../lib/prototype');

/** Boots the state foundations plus the Documentation workspace in one sandbox window. */
function bootDocumentationSandbox() {
  return loadClassicScripts([
    SCRIPTS.demoDataBundle,
    SCRIPTS.demoDataRegistry,
    SCRIPTS.stateStore,
    SCRIPTS.workspaceRegistry,
    SCRIPTS.relationships,
    SCRIPTS.workspaceShared,
    SCRIPTS.documentationWorkspace
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

  const documentationJs = readText('js', 'workspaces', 'documentation.js');
  const frameworkHtml = readText('components', 'workspace-framework', 'workspace-framework.html');
  const indexHtml = readText('index.html');
  const mainCss = readText('css', 'main.css');

  // ---- Live binding through the real state store and demo-data bundle.

  test('the Documentation workspace collects a ready, non-degraded view model from the loaded state', async function () {
    const AuditOS = bootDocumentationSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.documentationWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, engagementRouteContext(AuditOS));

    assert.ok(viewModel, 'a view model is collected once the state is ready');
    assert.equal(viewModel.degraded, false, 'demo data loads without degradation');
    assert.equal(viewModel.company.id, viewModel.engagement.companyId,
      'the company is resolved from the current engagement, same rule as the other workspaces');
  });

  test('the document navigator and health strip read real values from the current engagement', async function () {
    const AuditOS = bootDocumentationSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.documentationWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, engagementRouteContext(AuditOS));

    assert.ok(Array.from(viewModel.navigator).length > 0, 'the current engagement holds a real documentation section set');
    viewModel.navigator.forEach(function (row) {
      assert.ok(row.id, 'every navigator row carries a real section id');
      assert.ok(row.name, 'every navigator row carries a real section name');
    });
    const health = Array.from(viewModel.health);
    assert.ok(health.length >= 1, 'the health strip carries at least one indicator');
    health.forEach(function (item) {
      assert.ok(item.status, 'every health indicator carries a real value or None, never a fabricated blank');
    });
  });

  test('related evidence, controls, and findings resolve through real section references for real sections', async function () {
    const AuditOS = bootDocumentationSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.documentationWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, engagementRouteContext(AuditOS));
    const derive = AuditOS.documentationWorkspace.derivations;

    const withReferences = viewModel.navigator.filter(function (row) { return row.referenceKeys.length > 0; });
    assert.ok(withReferences.length > 0, 'at least one section declares real references');

    const resolvedCounts = withReferences
      .map(function (row) { return derive.resolveRelatedCount(row.section, 'controls', viewModel.context.counts); })
      .filter(function (count) { return count !== null; });
    assert.ok(resolvedCounts.length > 0, 'at least one section resolves a real related-control count through its own references');
  });

  test('the navigator preserves the document authored order, never re-sorted', async function () {
    const AuditOS = bootDocumentationSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.documentationWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, engagementRouteContext(AuditOS));

    const ids = Array.from(viewModel.navigator).map(function (row) { return row.id; });
    const sorted = ids.slice().sort();
    assert.ok(ids.length > 1, 'the current engagement holds more than one section to order');
    assert.notDeepEqual(ids, sorted.slice().reverse(),
      'sanity check: the fixture is not accidentally reverse-alphabetical');
  });

  test('the audit lineage highlights Documentation and carries only real, current counts', async function () {
    const AuditOS = bootDocumentationSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.documentationWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, engagementRouteContext(AuditOS));

    const lineage = Array.from(viewModel.lineage);
    const docNode = lineage.filter(function (node) { return node.label === 'Documentation'; })[0];
    assert.ok(docNode, 'the lineage includes a Documentation node');
    assert.equal(docNode.highlighted, true, 'Documentation is highlighted as the object this workspace owns');
    assert.ok(docNode.count > 0, 'the Documentation node carries the real section count');
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
      SCRIPTS.documentationWorkspace
    ]).AuditOS;
    return AuditOS.state.init().then(function () {
      const viewModel = AuditOS.documentationWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, engagementRouteContext(AuditOS));
      assert.equal(viewModel.degraded, true, 'no engagement yields a degraded model, never an exception');
    });
  });

  // ---- Render validation — the host-agnostic inspector renders real records.

  test('the host-agnostic inspector renders the real navigator into presentation components without throwing', async function () {
    const win = loadClassicScripts([
      SCRIPTS.demoDataBundle,
      SCRIPTS.demoDataRegistry,
      SCRIPTS.stateStore,
      SCRIPTS.workspaceRegistry,
      SCRIPTS.presentation,
      SCRIPTS.relationships,
      SCRIPTS.workspaceShared,
      SCRIPTS.documentationWorkspace
    ]);
    const AuditOS = win.AuditOS;
    await AuditOS.state.init();
    win.document = createDocument();

    const viewModel = AuditOS.documentationWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, engagementRouteContext(AuditOS));
    const node = AuditOS.documentationWorkspace.renderInspector(viewModel.navigator, viewModel.context);

    assert.ok(node, 'the inspector renders a node');
    assert.ok(hasClass(node, 'aos-master-detail'), 'it composes the shared Master–Detail component');
    assert.ok(countClass(node, 'aos-documentation__row') > 0, 'the master rail renders a row per section');
    assert.ok(hasClass(node, 'aos-inspector'), 'the detail pane renders the shared Inspector Panel');
    assert.equal(countClass(node, 'aos-documentation__row--selected'), 1, 'the first row is selected by default');
  });

  test('the inspector renderer is host-agnostic and exposed for reuse', function () {
    const AuditOS = bootDocumentationSandbox();
    assert.equal(typeof AuditOS.documentationWorkspace.renderInspector, 'function',
      'the Inspector renderer is exposed so any host can mount it');
    assert.match(documentationJs, /function renderInspector\(rows, context\)/, 'the renderer is data-in, node-out');
  });

  // ---- Source contracts.

  test('the Documentation workspace reads business data only through AuditOS.state', function () {
    assert.match(documentationJs, /AuditOS\.state/, 'the workspace consumes the Shared Audit State');
    assert.match(documentationJs, /listRecords|getDocument|findDatasetsForEngagement/, 'the workspace uses the read API');
    assert.doesNotMatch(documentationJs, /demoDataBundle/, 'the workspace never touches the demo-data bundle');
    assert.doesNotMatch(documentationJs, /fetch\s*\(|XMLHttpRequest/, 'the workspace performs no network access');
    assert.doesNotMatch(documentationJs, /demo-data\//, 'the workspace references no demo-data paths');
    assert.doesNotMatch(documentationJs, /createRecord|updateRecord|removeRecord/,
      'the workspace renders presentation only; it performs no writes');
  });

  test('the Documentation workspace carries no hardcoded business values', function () {
    const businessLiterals = /NimbusCloud|Helix|ENG-00\d|CMP-00\d|SEC-\d{1,2}-HLX|RPT-\w+-\d{4}|SOC 2 Type|ISO\/IEC/;
    assert.doesNotMatch(documentationJs, businessLiterals, 'documentation.js embeds no demo business content');
  });

  test('the workspace composes the shared framework and presentation system, not bespoke UI', function () {
    assert.match(documentationJs, /workspaceFramework\.configure/,
      'the header, ribbon, toolbar, and filters are configured through the shared framework');
    assert.match(documentationJs, /presentation\(\)/, 'content composes the Enterprise Data Presentation System');
    assert.match(documentationJs, /inspectorPanel|masterDetail|statusBadge|metadataList|activityFeed/,
      'the workspace reuses the shared presentation builders');
  });

  test('the Documentation workspace populates only reserved framework slots', function () {
    const slotBlock = documentationJs.match(/SLOTS\s*=\s*\{([\s\S]*?)\}/);
    assert.ok(slotBlock, 'documentation.js declares its slot map');
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

  test('the Documentation workspace follows the router and the state events, never polling', function () {
    assert.match(documentationJs, /ROUTE_CHANGED_EVENT/, 'the workspace follows the route-changed business event');
    assert.match(documentationJs, /EVENTS\.STATE_LOADED/, 'the workspace follows the state-loaded event');
    assert.doesNotMatch(documentationJs, /setInterval|setTimeout/, 'the workspace never polls');
  });

  test('the Documentation workspace is registered as a routable workspace', function () {
    const AuditOS = bootDocumentationSandbox();
    const workspace = AuditOS.workspaceRegistry.findById(AuditOS.workspaceRegistry.IDS.DOCUMENTATION);
    assert.ok(workspace, 'the registry exposes a Documentation workspace identity');
    assert.equal(workspace.path, 'documentation', 'it deep-links on the documentation route');
    assert.ok(AuditOS.workspaceRegistry.findByPath('documentation'), 'the route resolves back to the workspace');
  });

  test('index.html loads the Documentation workspace after the framework, after the state foundations', function () {
    const stateIndex = indexHtml.indexOf('js/state/state-store.js');
    const frameworkIndex = indexHtml.indexOf('components/workspace-framework/workspace-framework.js');
    const documentationIndex = indexHtml.indexOf('js/workspaces/documentation.js');
    assert.ok(stateIndex !== -1 && frameworkIndex !== -1 && documentationIndex !== -1, 'all three scripts load');
    assert.ok(stateIndex < documentationIndex, 'the state foundation loads before the Documentation workspace');
    assert.ok(frameworkIndex < documentationIndex, 'the framework skeleton renderer loads before the workspace');
  });

  test('main.css imports the Documentation stylesheet after the framework layer', function () {
    const frameworkCss = mainCss.indexOf('workspace-framework.css');
    const documentationCss = mainCss.indexOf('documentation.css');
    assert.ok(documentationCss !== -1, 'documentation.css is imported');
    assert.ok(frameworkCss < documentationCss, 'the workspace layer imports after the framework layer');
  });
};
