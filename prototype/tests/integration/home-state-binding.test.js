'use strict';

/**
 * Integration Tests — Home Workspace Binding to the Shared Audit State
 *
 * Verifies that AuditOS Home consumes business data exclusively through the
 * Shared Audit State and composes only the Shared Workspace Framework's
 * reserved slots (GitHub Issue #15 — Testing / Integration Tests). The first
 * group runs the real foundations together — generated demo-data bundle →
 * demo-data registry → state store → workspace registry → Home — inside one
 * sandbox and asserts the declarative view model against independent state
 * reads. The second group asserts the source contracts: state-only access,
 * slot fidelity, script and stylesheet ordering, and no hardcoded business
 * values.
 */

const { SCRIPTS, readText, loadClassicScripts } = require('../lib/prototype');

/** Boots the state foundations plus Home in one shared sandbox window. */
function bootHomeSandbox() {
  return loadClassicScripts([
    SCRIPTS.demoDataBundle,
    SCRIPTS.demoDataRegistry,
    SCRIPTS.stateStore,
    SCRIPTS.workspaceRegistry,
    SCRIPTS.homeWorkspace
  ]).AuditOS;
}

/** Finds a section descriptor by id within a view model. */
function sectionById(viewModel, sectionId) {
  return Array.from(viewModel.sections).filter(function (section) {
    return section.id === sectionId;
  })[0];
}

module.exports = function registerIntegrationTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const homeJs = readText('js', 'workspaces', 'home.js');
  const homeHtml = readText('components', 'workspaces', 'home', 'home.html');
  const frameworkHtml = readText('components', 'workspace-framework', 'workspace-framework.html');
  const indexHtml = readText('index.html');
  const mainCss = readText('css', 'main.css');

  // ---- Live binding through the real state store and demo-data bundle.

  test('Home collects a ready view model from the loaded Shared Audit State', async function () {
    const AuditOS = bootHomeSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.homeWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(viewModel, 'a view model is collected once the state is ready');
    assert.equal(viewModel.degraded, false, 'demo data loads without degradation');
    assert.equal(viewModel.engagement.status, 'In Progress', 'the current engagement is in progress');
    assert.equal(viewModel.company.id, viewModel.engagement.companyId,
      'the company is resolved from the engagement');
  });

  test('the view model is a declarative list of populated section descriptors', async function () {
    const AuditOS = bootHomeSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.homeWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const sectionIds = Array.from(viewModel.sections).map(function (section) { return section.id; });
    assert.deepEqual(sectionIds,
      ['continue-working', 'urgent-work', 'assigned-to-me', 'engagement-overview', 'clients', 'signals'],
      'the OS-landing sections appear in order');

    assert.ok(sectionById(viewModel, 'continue-working').items.length > 0,
      'resume points derive from outstanding work');
    assert.ok(sectionById(viewModel, 'urgent-work').items.length > 0,
      'urgent work derives from findings, rejections, and failed tests');
    assert.ok(sectionById(viewModel, 'assigned-to-me').items.length > 0,
      'assignments derive from engagement roles and test duties');
    assert.equal(sectionById(viewModel, 'engagement-overview').items.length, 4,
      'the pulse carries four KPIs');

    const companies = AuditOS.state.listRecords('companies');
    assert.equal(sectionById(viewModel, 'clients').items.length, companies.length,
      'one client card per company record in the state');

    const signals = sectionById(viewModel, 'signals');
    assert.equal(signals.panels.length, 2, 'signals hold the notifications and calendar panels');
    assert.ok(signals.panels[0].items.length > 0, 'notifications derive from operational events');
    assert.ok(signals.panels[1].items.length > 0, 'the calendar derives from dated milestones');
  });

  test('every section descriptor with empty items carries an educating empty state', async function () {
    const AuditOS = bootHomeSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.homeWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    Array.from(viewModel.sections).forEach(function (section) {
      if (section.items && section.id !== 'engagement-overview') {
        assert.ok(section.empty && section.empty.title && section.empty.description,
          section.id + ' declares an empty state instead of ever faking data');
      }
      if (section.panels) {
        Array.from(section.panels).forEach(function (panel) {
          assert.ok(panel.empty && panel.empty.title, panel.title + ' panel declares an empty state');
        });
      }
    });
  });

  test('universal panels, ribbon, and quick actions derive from state and registry', async function () {
    const AuditOS = bootHomeSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.homeWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    assert.ok(viewModel.panels.activity.length > 0, 'recent activity derives from state records');
    assert.equal(viewModel.panels.related.length, 7, 'related information carries the engagement facts');
    assert.match(viewModel.panels.ai.description, /advisory/, 'the AI surface stays a reserved placeholder');
    assert.equal(viewModel.ribbon.length, 6, 'the context ribbon carries six instruments');

    assert.equal(viewModel.quickActions.length, 5, 'quick actions resolve from the workspace registry');
    viewModel.quickActions.forEach(function (action) {
      assert.ok(AuditOS.workspaceRegistry.findByPath(action.path),
        action.label + ' routes to a registered workspace path');
    });
  });

  test('Home footer values equal independent Shared Audit State reads', async function () {
    const AuditOS = bootHomeSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.homeWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry);

    const footer = {};
    Array.from(viewModel.footer).forEach(function (entry) { footer[entry.label] = entry.value; });

    const engagementsDocument = AuditOS.state.getDocument('engagements');
    assert.equal(footer.Version, engagementsDocument.metadata.version,
      'the footer version comes from the engagement dataset metadata');
    assert.equal(footer['Demo status'], 'Demo data loaded', 'the footer reports the load status');

    const collectionCount = AuditOS.state.listCollections().length;
    assert.match(footer.Loaded, new RegExp('^' + collectionCount + ' collections'),
      'the footprint counts every registered collection');
    assert.match(footer.Loaded, /[1-9]\d* records$/, 'the footprint counts loaded records');

    const companies = AuditOS.state.listRecords('companies');
    const company = companies.filter(function (record) {
      return record.id === viewModel.engagement.companyId;
    })[0];
    assert.equal(footer.Client, company.name, 'the footer client is the state company record');
  });

  // ---- Source contracts.

  test('Home reads business data only through AuditOS.state', function () {
    assert.match(homeJs, /AuditOS\.state/, 'Home consumes the Shared Audit State');
    assert.match(homeJs, /listRecords|getDocument/, 'Home uses the read API');
    assert.doesNotMatch(homeJs, /demoDataBundle/, 'Home never touches the demo-data bundle');
    assert.doesNotMatch(homeJs, /fetch\s*\(|XMLHttpRequest/, 'Home performs no network access');
    assert.doesNotMatch(homeJs, /demo-data\//, 'Home references no demo-data paths');
    assert.doesNotMatch(homeJs, /createRecord|updateRecord|removeRecord/,
      'Home renders presentation only; it performs no writes');
  });

  test('Home carries no hardcoded business values', function () {
    const businessLiterals = /NimbusCloud|Helix|ENG-00\d|CMP-00\d|POC-0|SOC 2|ISO\/IEC/;
    assert.doesNotMatch(homeJs, businessLiterals, 'home.js embeds no demo business content');
    assert.doesNotMatch(homeHtml, businessLiterals, 'home.html embeds no demo business content');
  });

  test('the renderer assembles sections through a generic dispatch, not bespoke assembly', function () {
    assert.match(homeJs, /SECTION_BODIES\s*=\s*\{/, 'a descriptor-kind dispatch table exists');
    assert.match(homeJs, /viewModel\.sections\.forEach/, 'the renderer iterates the declarative sections');
    assert.match(homeJs, /SECTION_BODIES\[section\.kind\]/, 'bodies are dispatched by descriptor kind');
  });

  test('Home populates only reserved framework slots', function () {
    const usedSlots = [];
    const slotPattern = /SLOTS\s*=\s*\{([\s\S]*?)\}/;
    const slotBlock = homeJs.match(slotPattern);
    assert.ok(slotBlock, 'home.js declares its slot map');
    const valuePattern = /'([a-z-]+)'/g;
    let match;
    while ((match = valuePattern.exec(slotBlock[1])) !== null) {
      usedSlots.push(match[1]);
    }
    assert.ok(usedSlots.length >= 9, 'Home addresses the framework slots');
    usedSlots.forEach(function (slotName) {
      assert.ok(frameworkHtml.indexOf('data-slot="' + slotName + '"') !== -1,
        slotName + ' is a reserved framework slot');
    });
  });

  test('Home follows the router and the state events, never polling', function () {
    assert.match(homeJs, /ROUTE_CHANGED_EVENT/, 'Home follows the route-changed business event');
    assert.match(homeJs, /EVENTS\.STATE_LOADED/, 'Home follows the state-loaded event');
    assert.doesNotMatch(homeJs, /setInterval|setTimeout/, 'Home never polls');
  });

  test('index.html loads Home after the framework, after the state foundations', function () {
    const stateIndex = indexHtml.indexOf('js/state/state-store.js');
    const frameworkIndex = indexHtml.indexOf('components/workspace-framework/workspace-framework.js');
    const homeIndex = indexHtml.indexOf('js/workspaces/home.js');
    assert.ok(stateIndex !== -1 && frameworkIndex !== -1 && homeIndex !== -1, 'all three scripts load');
    assert.ok(stateIndex < homeIndex, 'the state foundation loads before Home');
    assert.ok(frameworkIndex < homeIndex, 'the framework skeleton renderer loads before Home');
  });

  test('the stylesheet layers order tokens → design language → shell → components → framework → Home', function () {
    const order = ['variables.css', 'design-language.css', 'layout.css', 'components.css',
      'workspace-framework.css', 'home.css'];
    const positions = order.map(function (layer) { return mainCss.indexOf(layer); });
    positions.forEach(function (position, index) {
      assert.ok(position !== -1, order[index] + ' is imported');
    });
    for (let index = 1; index < positions.length; index += 1) {
      assert.ok(positions[index - 1] < positions[index],
        order[index - 1] + ' imports before ' + order[index]);
    }
  });
};
