'use strict';

/**
 * Integration Tests — Global Home Binding to the Shared Audit State
 *
 * Verifies that the client-centric Global Home (Issue #33 §1) consumes
 * business data exclusively through the Shared Audit State and composes only
 * the Shared Workspace Framework's reserved slots. The first group runs the
 * real foundations together — generated demo-data bundle → demo-data
 * registry → state store → workspace registry → Home — inside one sandbox
 * and asserts the declarative view model against independent state reads.
 * The second group asserts the source contracts: state-only access, slot
 * fidelity, script and stylesheet ordering, and no hardcoded business values.
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

  test('Home collects a ready, client-centric view model from the loaded Shared Audit State', async function () {
    const AuditOS = bootHomeSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.homeWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, []);

    assert.ok(viewModel, 'a view model is collected once the state is ready');
    assert.equal(viewModel.degraded, false, 'demo data loads without degradation');
    assert.equal(viewModel.companies.length, AuditOS.state.listRecords('companies').length,
      'the portfolio is exactly the companies the state holds');
    assert.equal(viewModel.header.eyebrow, 'Assurance portfolio', 'Home orients on the portfolio, not an engagement');
  });

  test('the view model is the declarative client-selection section list of Issue #33 §1', async function () {
    const AuditOS = bootHomeSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.homeWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, []);

    const sectionIds = Array.from(viewModel.sections).map(function (section) { return section.id; });
    assert.deepEqual(sectionIds,
      ['continue-working', 'recent-clients', 'pinned-clients', 'all-clients', 'client-groups'],
      'the client-selection sections appear in order');

    const companies = AuditOS.state.listRecords('companies');
    assert.equal(sectionById(viewModel, 'all-clients').items.length, companies.length,
      'one client card per company record in the state');
    assert.ok(sectionById(viewModel, 'continue-working').items.length > 0,
      'clients with in-progress engagements are resumable');
    assert.equal(sectionById(viewModel, 'recent-clients').items.length, 0,
      'a fresh session has no recent clients — nothing is fabricated');
    assert.equal(sectionById(viewModel, 'pinned-clients').items.length, 0,
      'no pin exists in Release 1 data, so none is invented');
    assert.ok(sectionById(viewModel, 'client-groups').items.length > 0,
      'client groups derive from the recorded industries');
  });

  test('Home no longer presents engagement summaries, evidence, reports, or activity feeds', async function () {
    const AuditOS = bootHomeSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.homeWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, []);

    const sectionIds = Array.from(viewModel.sections).map(function (section) { return section.id; });
    ['engagement-overview', 'urgent-work', 'assigned-to-me', 'signals'].forEach(function (removed) {
      assert.ok(sectionIds.indexOf(removed) === -1, removed + ' is no longer a Home section');
    });
    assert.ok(viewModel.panels.activity.title, 'the activity panel carries guidance, not a feed');
    assert.match(viewModel.panels.activity.description, /client/i,
      'the guidance points to the client level, where activity now lives');
  });

  test('every client selection routes to the Client Dashboard through the registry', async function () {
    const AuditOS = bootHomeSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.homeWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, []);

    const registry = AuditOS.workspaceRegistry;
    const clientWorkspace = registry.findById(registry.IDS.CLIENT);
    assert.ok(clientWorkspace, 'the Client Dashboard is a registered workspace');

    const selectable = Array.from(sectionById(viewModel, 'all-clients').items)
      .concat(Array.from(sectionById(viewModel, 'continue-working').items));
    assert.ok(selectable.length > 0, 'there is at least one selectable client');
    selectable.forEach(function (item) {
      assert.equal(item.workspaceId, registry.IDS.CLIENT, 'every selection opens the Client Dashboard');
      assert.ok(item.recordId, 'every selection carries the stable client record id (Issue #31)');
    });
  });

  test('the session-only Recent Clients list projects real navigation, never persistence', async function () {
    const AuditOS = bootHomeSandbox();
    await AuditOS.state.init();
    const companies = AuditOS.state.listRecords('companies');
    const derive = AuditOS.homeWorkspace.derivations;

    let recents = derive.recordRecentClient([], companies[0].id);
    const viewModel = AuditOS.homeWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, recents);
    const recentSection = sectionById(viewModel, 'recent-clients');
    assert.equal(recentSection.items.length, 1, 'an opened client appears in Recent Clients');
    assert.equal(recentSection.items[0].id, companies[0].id);

    const stale = AuditOS.homeWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, ['CMP-NOT-REAL']);
    assert.equal(sectionById(stale, 'recent-clients').items.length, 0,
      'an id that joins no company renders nothing — never a fabricated client');
  });

  test('universal panels, ribbon, and footer derive from state and registry', async function () {
    const AuditOS = bootHomeSandbox();
    await AuditOS.state.init();
    const viewModel = AuditOS.homeWorkspace.collectViewModel(AuditOS.state, AuditOS.workspaceRegistry, []);

    assert.ok(viewModel.panels.related.length >= 3, 'related information carries the portfolio facts');
    assert.match(viewModel.panels.ai.description, /advisory/, 'the AI surface stays a reserved placeholder');
    assert.equal(viewModel.ribbon.length, 4, 'the context ribbon carries the four portfolio instruments');
    assert.match(viewModel.toolbar.search.placeholder, /client/i, 'search targets clients');

    const footer = {};
    Array.from(viewModel.footer).forEach(function (entry) { footer[entry.label] = entry.value; });
    const companiesDocument = AuditOS.state.getDocument('companies');
    assert.equal(footer.Version, companiesDocument.metadata.version,
      'the footer version comes from the client dataset metadata');
    assert.equal(footer['Demo status'], 'Demo data loaded', 'the footer reports the load status');
    assert.equal(footer.Clients, String(AuditOS.state.listRecords('companies').length),
      'the footer client count equals an independent state read');

    const collectionCount = AuditOS.state.listCollections().length;
    assert.match(footer.Loaded, new RegExp('^' + collectionCount + ' collections'),
      'the footprint counts every registered collection');
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
    const businessLiterals = /Meridian|CMP-MER|ENG-MER|PRG-MER|meridian-|NimbusCloud|Helix|ENG-00\d|CMP-00\d/;
    assert.doesNotMatch(homeJs, businessLiterals, 'home.js embeds no demo business content');
    assert.doesNotMatch(homeHtml, businessLiterals, 'home.html embeds no demo business content');
  });

  test('Home never reopens the previous client automatically', function () {
    assert.doesNotMatch(homeJs, /router\.navigate|location\.hash\s*=/,
      'Home performs no programmatic navigation — selecting a client is always explicit');
    assert.doesNotMatch(homeJs, /localStorage|sessionStorage/,
      'the Recent Clients list is memory-only, never persisted');
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

  test('the search affordance reuses the framework toolbar, never a bespoke field', function () {
    assert.match(homeJs, /workspaceFramework\.configure/, 'Home configures the framework toolbar');
    assert.match(homeJs, /toolbar:\s*viewModel\.toolbar|toolbar:\s*\{\s*search/, 'the toolbar carries the search config');
    assert.doesNotMatch(homeJs, /aos-search-field/, 'Home builds no duplicate search primitive');
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
