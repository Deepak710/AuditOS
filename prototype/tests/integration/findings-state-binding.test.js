'use strict';

/**
 * Integration Tests — Findings Workspace Binding to the Shared Audit State
 *
 * Verifies that the Findings Workspace consumes business data exclusively through
 * the Shared Audit State, composes the Shared Workspace Framework and the
 * Enterprise Data Presentation System, renders faithfully from the current demo
 * findings JSON, offers four presentation modes over one dataset, and never
 * fabricates a related object, a count, or a conclusion (GitHub Issue #25 —
 * Findings / Integration + Render Validation).
 *
 * The demo bundle carries real findings, control, requirement, evidence, testing,
 * and report data for the current engagement, so this suite asserts the full
 * Release 1 promise against live data: a ready, non-degraded view model whose
 * health, remediation, queue, four views, and lineage all read real values; a
 * host-agnostic inspector that renders those records into presentation components
 * without throwing (the render validation); and the source contracts that keep the
 * workspace presentation-only and offline.
 */

const { SCRIPTS, readText, loadClassicScripts } = require('../lib/prototype');

/** Boots the state foundations plus the Findings workspace in one sandbox window. */
function bootFindingsSandbox() {
  return loadClassicScripts([
    SCRIPTS.demoDataBundle,
    SCRIPTS.demoDataRegistry,
    SCRIPTS.stateStore,
    SCRIPTS.workspaceRegistry,
    SCRIPTS.findingsWorkspace
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

  const findingsJs = readText('js', 'workspaces', 'findings.js');
  const frameworkHtml = readText('components', 'workspace-framework', 'workspace-framework.html');
  const indexHtml = readText('index.html');
  const mainCss = readText('css', 'main.css');

  // ---- Live binding through the real state store and demo-data bundle.

  test('the Findings workspace collects a ready, non-degraded view model from the loaded state', async function () {
    const AuditOS = bootFindingsSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.findingsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(viewModel, 'a view model is collected once the state is ready');
    assert.equal(viewModel.degraded, false, 'demo data loads without degradation');
    assert.equal(viewModel.company.id, viewModel.engagement.companyId,
      'the company is resolved from the current engagement, same rule as the other workspaces');
  });

  test('the findings queue and health strip read real values from the current engagement', async function () {
    const AuditOS = bootFindingsSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.findingsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(Array.from(viewModel.queue).length > 0, 'the current engagement holds real findings');
    viewModel.queue.forEach(function (row) {
      assert.ok(row.id, 'every queue row carries a real finding id');
      assert.ok(row.title, 'every queue row carries a real title');
      assert.ok(row.severity, 'every queue row carries a real severity');
      assert.ok(row.status, 'every queue row carries a real status');
    });
    const health = Array.from(viewModel.findingsHealth);
    assert.ok(health.length >= 1, 'the health strip carries at least one indicator');
    health.forEach(function (item) {
      assert.ok(item.status, 'every health indicator carries a real count or None, never a fabricated blank');
    });
  });

  test('the related control, domain, and owner resolve through real joins for real findings', async function () {
    const AuditOS = bootFindingsSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.findingsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const resolvedControl = viewModel.queue.filter(function (row) { return row.control && row.control.title; });
    assert.ok(resolvedControl.length > 0, 'at least some findings resolve their related control through a real join');
    const resolvedDomain = viewModel.queue.filter(function (row) { return row.domain; });
    assert.ok(resolvedDomain.length > 0, 'at least some findings resolve their audit domain through the control family');
    const resolvedOwner = viewModel.queue.filter(function (row) { return row.owner && row.owner.name; });
    assert.ok(resolvedOwner.length > 0, 'at least some findings resolve their owner through the directory');
  });

  test('the related test resolves against the engagement testing set for real findings', async function () {
    const AuditOS = bootFindingsSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.findingsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const resolved = viewModel.queue.filter(function (row) { return row.test && row.test.title; });
    assert.ok(resolved.length > 0, 'at least some findings resolve the test they were raised from through a real join');
  });

  test('remediation status reads real closed / total counts, never an estimated percentage', async function () {
    const AuditOS = bootFindingsSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.findingsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const remediation = viewModel.remediation;
    assert.equal(remediation.total, Array.from(viewModel.queue).length, 'the remediation total is the real finding count');
    assert.ok(remediation.closed <= remediation.total, 'closed never exceeds the total');
    assert.equal(remediation.open + remediation.acceptedRisk + remediation.closed, remediation.total,
      'the breakdown accounts for every finding without fabrication');
  });

  test('the four presentation modes regroup one dataset without changing it', async function () {
    const AuditOS = bootFindingsSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.findingsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const total = Array.from(viewModel.queue).length;
    const views = Array.from(viewModel.views);
    assert.deepEqual(views.map(function (view) { return view.id; }), ['finding', 'severity', 'domain', 'owner']);
    views.forEach(function (view) {
      const rows = Array.from(view.view.groups).reduce(function (sum, group) { return sum + Array.from(group.rows).length; }, 0);
      assert.equal(rows, total, view.label + ' preserves every finding — presentation only, never a data change');
    });
  });

  test('the audit lineage highlights Finding and carries only real, current counts', async function () {
    const AuditOS = bootFindingsSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.findingsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const lineage = Array.from(viewModel.lineage);
    const findingNode = lineage.filter(function (node) { return node.label === 'Finding'; })[0];
    assert.ok(findingNode, 'the lineage includes a Finding node');
    assert.equal(findingNode.highlighted, true, 'Finding is highlighted as the object this workspace owns');
    assert.ok(findingNode.count > 0, 'the Finding node carries the real finding count');
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
      SCRIPTS.findingsWorkspace
    ]).AuditOS;
    return AuditOS.state.init().then(function () {
      const viewModel = AuditOS.findingsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
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
      SCRIPTS.findingsWorkspace
    ]);
    const AuditOS = win.AuditOS;
    await AuditOS.state.init();
    win.document = createDocument();

    const viewModel = AuditOS.findingsWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
    const node = AuditOS.findingsWorkspace.renderInspector(viewModel.queue, viewModel.context);

    assert.ok(node, 'the inspector renders a node');
    assert.ok(hasClass(node, 'aos-master-detail'), 'it composes the shared Master–Detail component');
    assert.ok(countClass(node, 'aos-findings__row') > 0, 'the master rail renders a row per finding');
    assert.ok(hasClass(node, 'aos-inspector'), 'the detail pane renders the shared Inspector Panel');
    assert.equal(countClass(node, 'aos-findings__row--selected'), 1, 'the first row is selected by default');
  });

  test('the inspector renderer is host-agnostic and exposed for reuse', function () {
    const AuditOS = bootFindingsSandbox();
    assert.equal(typeof AuditOS.findingsWorkspace.renderInspector, 'function',
      'the Inspector renderer is exposed so any host can mount it');
    assert.match(findingsJs, /function renderInspector\(queue, context\)/, 'the renderer is data-in, node-out');
  });

  // ---- Source contracts.

  test('the Findings workspace reads business data only through AuditOS.state', function () {
    assert.match(findingsJs, /AuditOS\.state/, 'the workspace consumes the Shared Audit State');
    assert.match(findingsJs, /listRecords|getDocument|findDatasetsForEngagement/, 'the workspace uses the read API');
    assert.doesNotMatch(findingsJs, /demoDataBundle/, 'the workspace never touches the demo-data bundle');
    assert.doesNotMatch(findingsJs, /fetch\s*\(|XMLHttpRequest/, 'the workspace performs no network access');
    assert.doesNotMatch(findingsJs, /demo-data\//, 'the workspace references no demo-data paths');
    assert.doesNotMatch(findingsJs, /createRecord|updateRecord|removeRecord/,
      'the workspace renders presentation only; it performs no writes');
  });

  test('the Findings workspace carries no hardcoded business values', function () {
    const businessLiterals = /NimbusCloud|Helix|ENG-00\d|CMP-00\d|OBS-\d{4}|LIB-CTRL|SOC 2 Type|ISO\/IEC/;
    assert.doesNotMatch(findingsJs, businessLiterals, 'findings.js embeds no demo business content');
  });

  test('the workspace composes the shared framework and presentation system, not bespoke UI', function () {
    assert.match(findingsJs, /workspaceFramework\.configure/,
      'the header, ribbon, toolbar, and filters are configured through the shared framework');
    assert.match(findingsJs, /presentation\(\)/, 'content composes the Enterprise Data Presentation System');
    assert.match(findingsJs, /inspectorPanel|masterDetail|statusBadge|progressMeter|itemList/,
      'the workspace reuses the shared presentation builders');
  });

  test('the Findings workspace populates only reserved framework slots', function () {
    const slotBlock = findingsJs.match(/SLOTS\s*=\s*\{([\s\S]*?)\}/);
    assert.ok(slotBlock, 'findings.js declares its slot map');
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

  test('the Findings workspace follows the router and the state events, never polling', function () {
    assert.match(findingsJs, /ROUTE_CHANGED_EVENT/, 'the workspace follows the route-changed business event');
    assert.match(findingsJs, /EVENTS\.STATE_LOADED/, 'the workspace follows the state-loaded event');
    assert.doesNotMatch(findingsJs, /setInterval|setTimeout/, 'the workspace never polls');
  });

  test('the Findings workspace is registered as a routable workspace', function () {
    const AuditOS = bootFindingsSandbox();
    const workspace = AuditOS.workspaceRegistry.findById(AuditOS.workspaceRegistry.IDS.FINDINGS);
    assert.ok(workspace, 'the registry exposes a Findings workspace identity');
    assert.equal(workspace.path, 'findings', 'it deep-links on the findings route');
    assert.ok(AuditOS.workspaceRegistry.findByPath('findings'), 'the route resolves back to the workspace');
  });

  test('index.html loads the Findings workspace after the framework, after the state foundations', function () {
    const stateIndex = indexHtml.indexOf('js/state/state-store.js');
    const frameworkIndex = indexHtml.indexOf('components/workspace-framework/workspace-framework.js');
    const findingsIndex = indexHtml.indexOf('js/workspaces/findings.js');
    assert.ok(stateIndex !== -1 && frameworkIndex !== -1 && findingsIndex !== -1, 'all three scripts load');
    assert.ok(stateIndex < findingsIndex, 'the state foundation loads before the Findings workspace');
    assert.ok(frameworkIndex < findingsIndex, 'the framework skeleton renderer loads before the workspace');
  });

  test('main.css imports the Findings stylesheet after the framework layer', function () {
    const frameworkCss = mainCss.indexOf('workspace-framework.css');
    const findingsCss = mainCss.indexOf('findings.css');
    assert.ok(findingsCss !== -1, 'findings.css is imported');
    assert.ok(frameworkCss < findingsCss, 'the workspace layer imports after the framework layer');
  });
};
