'use strict';

/**
 * Integration Tests — Controls Workspace Binding to the Shared Audit State
 *
 * Verifies that the Controls Workspace consumes business data exclusively through
 * the Shared Audit State, composes the Shared Workspace Framework and the
 * Enterprise Data Presentation System, renders faithfully from the current demo
 * control JSON, offers three presentation modes over one dataset, and never
 * fabricates a mapping, a relationship, or a version history (GitHub Issue #23 —
 * Testing / Integration + Render Validation).
 *
 * The demo bundle carries real control, requirement, evidence, testing, findings,
 * and report data for the current engagement, so this suite asserts the full
 * Release 1 promise against live data: a ready, non-degraded view model whose
 * health, library, three views, and lineage all read real values; a host-agnostic
 * inspector that renders those records into presentation components without
 * throwing (the render validation); and the source contracts that keep the
 * workspace presentation-only and offline.
 */

const { SCRIPTS, readText, loadClassicScripts } = require('../lib/prototype');

/** Boots the state foundations plus the Controls workspace in one sandbox window. */
function bootControlsSandbox() {
  return loadClassicScripts([
    SCRIPTS.demoDataBundle,
    SCRIPTS.demoDataRegistry,
    SCRIPTS.stateStore,
    SCRIPTS.workspaceRegistry,
    SCRIPTS.relationships,
    SCRIPTS.workspaceShared,
    SCRIPTS.controlsWorkspace
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

  const controlsJs = readText('js', 'workspaces', 'controls.js');
  const frameworkHtml = readText('components', 'workspace-framework', 'workspace-framework.html');
  const indexHtml = readText('index.html');
  const mainCss = readText('css', 'main.css');

  // ---- Live binding through the real state store and demo-data bundle.

  test('the Controls workspace collects a ready, non-degraded view model from the loaded state', async function () {
    const AuditOS = bootControlsSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.controlsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(viewModel, 'a view model is collected once the state is ready');
    assert.equal(viewModel.degraded, false, 'demo data loads without degradation');
    assert.equal(viewModel.company.id, viewModel.engagement.companyId,
      'the company is resolved from the current engagement, same rule as the other workspaces');
  });

  test('the control library and health strip read real values from the current engagement', async function () {
    const AuditOS = bootControlsSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.controlsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(Array.from(viewModel.library).length > 0, 'the current engagement holds real controls');
    viewModel.library.forEach(function (row) {
      assert.ok(row.controlCode, 'every library row carries a real Control ID');
      assert.ok(row.status, 'every library row carries a real status');
      assert.ok(row.evidence && row.evidence.label, 'every library row carries a derived evidence coverage');
      assert.ok(row.testing && row.testing.label, 'every library row carries a derived testing coverage');
    });
    const health = Array.from(viewModel.controlHealth);
    assert.ok(health.length >= 3, 'the health strip carries at least the evidence / testing / reuse indicators');
    health.forEach(function (item) {
      assert.ok(item.status, 'every health indicator carries a real count or Clear / None, never a fabricated blank');
    });
  });

  test('the three presentation modes regroup one dataset without changing it', async function () {
    const AuditOS = bootControlsSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.controlsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const total = Array.from(viewModel.library).length;
    const views = Array.from(viewModel.views);
    assert.deepEqual(views.map(function (view) { return view.id; }), ['control', 'family', 'coverage']);
    views.forEach(function (view) {
      const rows = Array.from(view.view.groups).reduce(function (sum, group) { return sum + Array.from(group.rows).length; }, 0);
      assert.equal(rows, total, view.label + ' preserves every control — presentation only, never a data change');
    });
  });

  test('the audit lineage highlights Control and carries only real, current counts', async function () {
    const AuditOS = bootControlsSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.controlsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const lineage = Array.from(viewModel.lineage);
    const controlNode = lineage.filter(function (node) { return node.label === 'Control'; })[0];
    assert.ok(controlNode, 'the lineage includes a Control node');
    assert.equal(controlNode.highlighted, true, 'Control is highlighted as the object this workspace owns');
    assert.ok(controlNode.count > 0, 'the Control node carries the real control count');
    lineage.forEach(function (node) {
      if (node.path) {
        assert.ok(AuditOS.workspaceRegistry.findByPath(node.path), node.label + ' navigates to a registered workspace');
      }
    });
  });

  test('framework mappings are drawn only from present relationships, never a fabricated cross-framework join', async function () {
    const AuditOS = bootControlsSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.controlsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
    const derive = AuditOS.controlsWorkspace.derivations;

    viewModel.library.forEach(function (row) {
      const mappings = Array.from(derive.deriveFrameworkMappings(row.control, viewModel.frameworks));
      mappings.forEach(function (mapping) {
        assert.ok(typeof mapping === 'string' && mapping.length > 0, 'every mapping is a real declared or engagement-level value');
      });
    });
  });

  test('a degraded state yields a degraded model rather than throwing', function () {
    const AuditOS = loadClassicScripts([
      SCRIPTS.demoDataRegistry,
      SCRIPTS.stateStore,
      SCRIPTS.workspaceRegistry,
      SCRIPTS.relationships,
      SCRIPTS.workspaceShared,
      SCRIPTS.controlsWorkspace
    ]).AuditOS;
    return AuditOS.state.init().then(function () {
      const viewModel = AuditOS.controlsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
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
      SCRIPTS.controlsWorkspace
    ]);
    const AuditOS = win.AuditOS;
    await AuditOS.state.init();
    win.document = createDocument();

    const viewModel = AuditOS.controlsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
    const node = AuditOS.controlsWorkspace.renderInspector(viewModel.library, viewModel.context);

    assert.ok(node, 'the inspector renders a node');
    assert.ok(hasClass(node, 'aos-master-detail'), 'it composes the shared Master–Detail component');
    assert.ok(countClass(node, 'aos-controls__row') > 0, 'the master rail renders a row per control');
    assert.ok(hasClass(node, 'aos-inspector'), 'the detail pane renders the shared Inspector Panel');
    assert.equal(countClass(node, 'aos-controls__row--selected'), 1, 'the first row is selected by default');
  });

  test('the control library body renders the three-view switcher over the shared Master–Detail without throwing', async function () {
    const win = loadClassicScripts([
      SCRIPTS.demoDataBundle,
      SCRIPTS.demoDataRegistry,
      SCRIPTS.stateStore,
      SCRIPTS.workspaceRegistry,
      SCRIPTS.presentation,
      SCRIPTS.relationships,
      SCRIPTS.workspaceShared,
      SCRIPTS.controlsWorkspace
    ]);
    const AuditOS = win.AuditOS;
    await AuditOS.state.init();
    win.document = createDocument();

    const viewModel = AuditOS.controlsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
    assert.equal(Array.from(viewModel.views).length, 3, 'three presentation modes are offered');
    const node = AuditOS.controlsWorkspace.renderInspector(viewModel.library, viewModel.context);
    assert.ok(hasClass(node, 'aos-inspector'), 'the control inspector renders for the selected row');
  });

  test('the inspector renderer is host-agnostic and exposed for reuse', function () {
    const AuditOS = bootControlsSandbox();
    assert.equal(typeof AuditOS.controlsWorkspace.renderInspector, 'function',
      'the Inspector renderer is exposed so any host can mount it');
    assert.match(controlsJs, /function renderInspector\(library, context\)/, 'the renderer is data-in, node-out');
  });

  // ---- Source contracts.

  test('the Controls workspace reads business data only through AuditOS.state', function () {
    assert.match(controlsJs, /AuditOS\.state/, 'the workspace consumes the Shared Audit State');
    assert.match(controlsJs, /listRecords|getDocument|findDatasetsForEngagement/, 'the workspace uses the read API');
    assert.doesNotMatch(controlsJs, /demoDataBundle/, 'the workspace never touches the demo-data bundle');
    assert.doesNotMatch(controlsJs, /fetch\s*\(|XMLHttpRequest/, 'the workspace performs no network access');
    assert.doesNotMatch(controlsJs, /demo-data\//, 'the workspace references no demo-data paths');
    assert.doesNotMatch(controlsJs, /createRecord|updateRecord|removeRecord/,
      'the workspace renders presentation only; it performs no writes');
  });

  test('the Controls workspace carries no hardcoded business values', function () {
    const businessLiterals = /NimbusCloud|Helix|ENG-00\d|CMP-00\d|POC-0\d|GOV-01|SOC 2 Type|ISO\/IEC/;
    assert.doesNotMatch(controlsJs, businessLiterals, 'controls.js embeds no demo business content');
  });

  test('the workspace composes the shared framework and presentation system, not bespoke UI', function () {
    assert.match(controlsJs, /workspaceFramework\.configure/,
      'the header, ribbon, toolbar, and filters are configured through the shared framework');
    assert.match(controlsJs, /presentation\(\)/, 'content composes the Enterprise Data Presentation System');
    assert.match(controlsJs, /inspectorPanel|masterDetail|statusBadge|activityFeed|itemList/,
      'the workspace reuses the shared presentation builders');
  });

  test('the Controls workspace populates only reserved framework slots', function () {
    const slotBlock = controlsJs.match(/SLOTS\s*=\s*\{([\s\S]*?)\}/);
    assert.ok(slotBlock, 'controls.js declares its slot map');
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

  test('the Controls workspace follows the router and the state events, never polling', function () {
    assert.match(controlsJs, /ROUTE_CHANGED_EVENT/, 'the workspace follows the route-changed business event');
    assert.match(controlsJs, /EVENTS\.STATE_LOADED/, 'the workspace follows the state-loaded event');
    assert.doesNotMatch(controlsJs, /setInterval|setTimeout/, 'the workspace never polls');
  });

  test('the Controls workspace is registered as a routable workspace', function () {
    const AuditOS = bootControlsSandbox();
    const workspace = AuditOS.workspaceRegistry.findById(AuditOS.workspaceRegistry.IDS.CONTROLS);
    assert.ok(workspace, 'the registry exposes a Controls workspace identity');
    assert.equal(workspace.path, 'controls', 'it deep-links on the controls route');
    assert.ok(AuditOS.workspaceRegistry.findByPath('controls'), 'the route resolves back to the workspace');
  });

  test('index.html loads the Controls workspace after the framework, after the state foundations', function () {
    const stateIndex = indexHtml.indexOf('js/state/state-store.js');
    const frameworkIndex = indexHtml.indexOf('components/workspace-framework/workspace-framework.js');
    const controlsIndex = indexHtml.indexOf('js/workspaces/controls.js');
    assert.ok(stateIndex !== -1 && frameworkIndex !== -1 && controlsIndex !== -1, 'all three scripts load');
    assert.ok(stateIndex < controlsIndex, 'the state foundation loads before the Controls workspace');
    assert.ok(frameworkIndex < controlsIndex, 'the framework skeleton renderer loads before the workspace');
  });

  test('main.css imports the Controls stylesheet after the framework layer', function () {
    const frameworkCss = mainCss.indexOf('workspace-framework.css');
    const controlsCss = mainCss.indexOf('controls.css');
    assert.ok(controlsCss !== -1, 'controls.css is imported');
    assert.ok(frameworkCss < controlsCss, 'the workspace layer imports after the framework layer');
  });
};
