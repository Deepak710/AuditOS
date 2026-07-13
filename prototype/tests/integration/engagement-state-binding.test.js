'use strict';

/**
 * Integration Tests — Engagement Workspace Binding to the Shared Audit State
 *
 * Verifies that the Engagement Workspace consumes business data exclusively
 * through the Shared Audit State, composes the Shared Workspace Framework and
 * the Enterprise Data Presentation System, and renders faithfully from the
 * current demo JSON (GitHub Issue #19 — Testing / Integration Tests). The first
 * group runs the real foundations together — generated demo-data bundle →
 * demo-data registry → state store → workspace registry → Engagement — inside
 * one sandbox and asserts the declarative view model against independent state
 * reads. The second group asserts the source contracts: state-only access,
 * framework composition, slot fidelity, wiring order, and no hardcoded business
 * values.
 */

const { SCRIPTS, readText, loadClassicScripts, loadEngagementWorkspace } = require('../lib/prototype');

/** Boots the state foundations plus the Engagement workspace in one sandbox window. */
function bootEngagementSandbox() {
  return loadClassicScripts([
    SCRIPTS.demoDataBundle,
    SCRIPTS.demoDataRegistry,
    SCRIPTS.stateStore,
    SCRIPTS.workspaceRegistry,
    SCRIPTS.relationships,
    SCRIPTS.workspaceShared,
    SCRIPTS.engagementWorkspace
  ]).AuditOS;
}

module.exports = function registerIntegrationTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const engagementJs = readText('js', 'workspaces', 'engagement.js');
  const frameworkHtml = readText('components', 'workspace-framework', 'workspace-framework.html');
  const indexHtml = readText('index.html');
  const mainCss = readText('css', 'main.css');

  // ---- Live binding through the real state store and demo-data bundle.

  test('the Engagement workspace collects a ready view model from the loaded state', async function () {
    const AuditOS = bootEngagementSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.engagementWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(viewModel, 'a view model is collected once the state is ready');
    assert.equal(viewModel.degraded, false, 'demo data loads without degradation');
    assert.equal(viewModel.engagement.status, 'In Progress', 'the current engagement is in progress');
    assert.equal(viewModel.company.id, viewModel.engagement.companyId,
      'the company is resolved from the engagement');
  });

  // ---- Deep-link record id (Issue #31 contract, restored by the Issue #32 follow-up fix).

  test('a targetId that resolves to a real engagement opens that exact engagement, not the default fallback', async function () {
    const AuditOS = bootEngagementSandbox();
    await AuditOS.state.init();
    const engagements = AuditOS.state.listRecords('engagements');
    const defaultViewModel = AuditOS.engagementWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
    const other = engagements.find(function (e) { return e.id !== defaultViewModel.engagement.id; });
    assert.ok(other, 'the demo dataset carries more than one engagement to deep-link into');

    const viewModel = AuditOS.engagementWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, other.id);
    assert.equal(viewModel.degraded, false);
    assert.equal(viewModel.engagement.id, other.id,
      'the routed record id selects that engagement, even though it is not the default in-progress pick');
  });

  test('an unresolved or omitted targetId preserves today\'s fallback behavior', async function () {
    const AuditOS = bootEngagementSandbox();
    await AuditOS.state.init();
    const defaultViewModel = AuditOS.engagementWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
    const staleIdViewModel = AuditOS.engagementWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, 'ENG-DOES-NOT-EXIST');
    assert.equal(staleIdViewModel.engagement.id, defaultViewModel.engagement.id,
      'a stale route id degrades to the default engagement rather than a degraded/empty model');
  });

  test('the frameworks are array-driven straight from the engagement record', async function () {
    const AuditOS = bootEngagementSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.engagementWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const frameworks = Array.from(viewModel.frameworks);
    const normalized = Array.from(
      AuditOS.engagementWorkspace.derivations.normalizeFrameworks(viewModel.engagement)
    );
    assert.deepEqual(frameworks, normalized, 'the frameworks come straight from the engagement record');
    assert.ok(frameworks.length >= 1, 'the current engagement declares at least one framework');
    assert.equal(frameworks[0], viewModel.engagement.framework, 'the single demo framework renders faithfully');
    assert.equal(Array.from(viewModel.header.frameworks).length, frameworks.length,
      'the header badges iterate the same framework array — one today, all of them when the data attaches more');
    assert.equal(Array.from(viewModel.inspector).length, 1 + frameworks.length,
      'the inspector lists the engagement plus one entity per framework');
  });

  test('the operational surfaces derive from the summaries of the Shared Audit State', async function () {
    const AuditOS = bootEngagementSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.engagementWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(viewModel.focus.focus, 'a current operational focus is derived');
    assert.equal(viewModel.focus.status, viewModel.engagement.status, 'status stays a separate concept from focus');

    const nextActions = Array.from(viewModel.nextActions);
    assert.ok(nextActions.length > 0, 'next actions derive from real pending work');
    assert.match(nextActions[0].title, /walkthrough/i, 'walkthroughs lead the next actions');

    const lifecycle = Array.from(viewModel.lifecycle);
    assert.equal(lifecycle.length, 6, 'the lifecycle spine is six operational stages');
    assert.equal(lifecycle[0].label, 'Walkthrough', 'the workflow starts at the walkthrough');
    lifecycle.forEach(function (stage) {
      assert.ok(AuditOS.workspaceRegistry.findByPath(stage.path),
        stage.label + ' opens a registered workspace path');
    });

    assert.ok(Array.isArray(viewModel.blocking), 'blocking items are derived (possibly empty)');
    assert.equal(viewModel.team, undefined, 'no client Team roster is derived — Walkthrough owns Teams and POCs (Issue #38 Part 3)');
    assert.ok(Array.from(viewModel.relationships).length > 0, 'related objects derive from the operational domains');
    assert.ok(Array.from(viewModel.activity).length > 0, 'recent activity derives from state records');
  });

  test('the Audit Health strip binds six navigable indicators to the state', async function () {
    const AuditOS = bootEngagementSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.engagementWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const health = Array.from(viewModel.auditHealth);
    assert.deepEqual(health.map(function (indicator) { return indicator.label; }),
      ['Walkthrough', 'Evidence', 'Testing', 'Approvals', 'Findings', 'Report'],
      'six operational indicators in status-bar order');
    assert.equal(health[0].status, 'Waiting', 'walkthrough stays faithful with no fabricated count');
    health.forEach(function (indicator) {
      assert.ok(AuditOS.workspaceRegistry.findByPath(indicator.path),
        indicator.label + ' navigates to a registered workspace');
    });
  });

  test('the inspector renderer is host-agnostic and exposed for reuse', function () {
    const AuditOS = bootEngagementSandbox();
    assert.equal(typeof AuditOS.engagementWorkspace.renderInspector, 'function',
      'the Inspector renderer is exposed so any host can mount it');
    // The renderer takes only entity data and returns a node — the workspace
    // never assumes where it is mounted (a bottom section today, elsewhere later).
    assert.match(engagementJs, /function renderInspector\(entities\)/, 'the renderer is data-in, node-out');
  });

  test('the inspector entities are the engagement, then one per framework', async function () {
    const AuditOS = bootEngagementSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.engagementWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const inspector = Array.from(viewModel.inspector);
    const frameworks = Array.from(viewModel.frameworks);
    assert.equal(inspector.length, 1 + frameworks.length, 'the engagement plus one entity per framework');
    assert.equal(inspector[0].key, 'engagement', 'selecting the engagement opens its inspector by default');
  });

  test('context ribbon, metadata, and footer values equal independent state reads', async function () {
    const AuditOS = bootEngagementSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.engagementWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    // The ribbon carries engagement identity only — no operational state, which
    // the Current Focus and Audit Health band own (no duplication).
    const ribbonLabels = Array.from(viewModel.ribbon).map(function (item) { return item.label; });
    assert.deepEqual(ribbonLabels, ['Client', 'Audit period', 'Engagement lead'],
      'the ribbon is identity context, free of focus / status / health duplication');

    const engagementsDocument = AuditOS.state.getDocument('engagements');
    assert.equal(viewModel.metadata.version, engagementsDocument.metadata.version,
      'the metadata version comes from the engagements dataset metadata');

    const footer = {};
    Array.from(viewModel.footer).forEach(function (entry) { footer[entry.label] = entry.value; });
    assert.equal(footer['Demo status'], 'Demo data loaded', 'the footer reports the load status');
    assert.ok(!Object.prototype.hasOwnProperty.call(footer, 'Focus'),
      'the footer does not restate the operational focus');
  });

  test('a degraded state yields a degraded model rather than throwing', function () {
    // Boot the workspace without the demo-data bundle so the state loads empty.
    const AuditOS = loadClassicScripts([
      SCRIPTS.demoDataRegistry,
      SCRIPTS.stateStore,
      SCRIPTS.workspaceRegistry,
      SCRIPTS.relationships,
      SCRIPTS.workspaceShared,
      SCRIPTS.engagementWorkspace
    ]).AuditOS;
    return AuditOS.state.init().then(function () {
      const viewModel = AuditOS.engagementWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);
      assert.equal(viewModel.degraded, true, 'no engagement yields a degraded model, never an exception');
    });
  });

  // ---- Source contracts.

  test('the Engagement workspace reads business data only through AuditOS.state', function () {
    assert.match(engagementJs, /AuditOS\.state/, 'the workspace consumes the Shared Audit State');
    assert.match(engagementJs, /listRecords|getDocument/, 'the workspace uses the read API');
    assert.doesNotMatch(engagementJs, /demoDataBundle/, 'the workspace never touches the demo-data bundle');
    assert.doesNotMatch(engagementJs, /fetch\s*\(|XMLHttpRequest/, 'the workspace performs no network access');
    assert.doesNotMatch(engagementJs, /demo-data\//, 'the workspace references no demo-data paths');
    assert.doesNotMatch(engagementJs, /createRecord|updateRecord|removeRecord/,
      'the workspace renders presentation only; it performs no writes');
  });

  test('the Engagement workspace carries no hardcoded business values', function () {
    const businessLiterals = /NimbusCloud|Helix|ENG-00\d|CMP-00\d|POC-0|SOC 2|ISO\/IEC/;
    assert.doesNotMatch(engagementJs, businessLiterals, 'engagement.js embeds no demo business content');
  });

  test('the workspace composes the shared framework and presentation system, not bespoke UI', function () {
    assert.match(engagementJs, /workspaceFramework\.configure/,
      'the header, ribbon, toolbar, and filters are configured through the shared framework');
    assert.match(engagementJs, /presentation\(\)/, 'content composes the Enterprise Data Presentation System');
    assert.match(engagementJs, /inspectorPanel|masterDetail|entityCard|activityFeed|metadataList/,
      'the workspace reuses the shared presentation builders');
  });

  test('the Engagement workspace populates only reserved framework slots', function () {
    const slotBlock = engagementJs.match(/SLOTS\s*=\s*\{([\s\S]*?)\}/);
    assert.ok(slotBlock, 'engagement.js declares its slot map');
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

  test('the Engagement workspace follows the router and the state events, never polling', function () {
    assert.match(engagementJs, /ROUTE_CHANGED_EVENT/, 'the workspace follows the route-changed business event');
    assert.match(engagementJs, /EVENTS\.STATE_LOADED/, 'the workspace follows the state-loaded event');
    assert.doesNotMatch(engagementJs, /setInterval|setTimeout/, 'the workspace never polls');
  });

  test('index.html loads the Engagement workspace after the framework, after the state foundations', function () {
    const stateIndex = indexHtml.indexOf('js/state/state-store.js');
    const frameworkIndex = indexHtml.indexOf('components/workspace-framework/workspace-framework.js');
    const engagementIndex = indexHtml.indexOf('js/workspaces/engagement.js');
    assert.ok(stateIndex !== -1 && frameworkIndex !== -1 && engagementIndex !== -1, 'all three scripts load');
    assert.ok(stateIndex < engagementIndex, 'the state foundation loads before the Engagement workspace');
    assert.ok(frameworkIndex < engagementIndex, 'the framework skeleton renderer loads before the workspace');
  });

  test('main.css imports the Engagement stylesheet after the framework layer', function () {
    const frameworkCss = mainCss.indexOf('workspace-framework.css');
    const engagementCss = mainCss.indexOf('engagement.css');
    assert.ok(engagementCss !== -1, 'engagement.css is imported');
    assert.ok(frameworkCss < engagementCss, 'the workspace layer imports after the framework layer');
  });
};
