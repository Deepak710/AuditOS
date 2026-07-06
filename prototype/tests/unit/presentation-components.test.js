'use strict';

/**
 * Unit Tests — Enterprise Data Presentation System (GitHub Issue #18)
 *
 * Verifies the shared, configuration-driven presentation renderer
 * (window.AuditOS.presentation). Three layers are covered:
 *
 *   1. The pure resolvers (status vocabulary, column / density / sort / ratio /
 *      activity normalization) — the presentation decisions, exercised offline
 *      with no DOM, exactly as the framework's normalizeConfiguration is.
 *   2. The configuration-driven builders — exercised against a minimal DOM stub
 *      (Node standard library only, no jsdom) so the "components render JSON
 *      data" acceptance criterion is directly checked: a config in, the expected
 *      component structure out.
 *   3. The library contracts — the new composites are registered, defined in
 *      components.css, and shown in the gallery, and the renderer composes only
 *      registered component classes while reading no business state.
 */

const { loadPresentation, loadClassicScript, loadComponentLibrary, readText, SCRIPTS } = require('../lib/prototype');
const css = require('../lib/css');

// ---------------------------------------------------------------------------
// A minimal DOM stub — just the surface the builders touch (createElement,
// createTextNode, className, textContent, setAttribute, appendChild, style).
// No querying, no jsdom; the module reads global.document only inside a builder
// call, so attaching this to the loaded window is enough to render.
// ---------------------------------------------------------------------------

function createDocument() {
  function makeNode(tagName) {
    return {
      nodeType: 1,
      tagName: tagName ? String(tagName).toUpperCase() : tagName,
      className: '',
      textContent: '',
      attributes: {},
      children: [],
      style: { setProperty: function (key, value) { this[key] = value; } },
      appendChild: function (child) { this.children.push(child); return child; },
      setAttribute: function (key, value) { this.attributes[key] = String(value); },
      getAttribute: function (key) {
        return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null;
      },
      addEventListener: function () {},
      removeEventListener: function () {},
      getBoundingClientRect: function () { return { left: 0, width: 0 }; }
    };
  }
  return {
    createElement: function (tag) { return makeNode(tag); },
    createTextNode: function (text) { return { nodeType: 3, textContent: String(text), children: [] }; },
    createDocumentFragment: function () { return makeNode('#fragment'); },
    addEventListener: function () {},
    removeEventListener: function () {}
  };
}

/** Loads the presentation module bound to a fresh DOM stub. */
function withDom() {
  const win = loadClassicScript(SCRIPTS.presentation);
  win.document = createDocument();
  return win.AuditOS.presentation;
}

// ---- Tree helpers over the stub -------------------------------------------

function walk(node, visit) {
  if (!node) {
    return;
  }
  visit(node);
  (node.children || []).forEach(function (child) { walk(child, visit); });
}

function classSet(node) {
  return typeof node.className === 'string' ? node.className.split(' ') : [];
}

function hasClass(node, className) {
  let found = false;
  walk(node, function (n) { if (classSet(n).indexOf(className) !== -1) { found = true; } });
  return found;
}

function countClass(node, className) {
  let count = 0;
  walk(node, function (n) { if (classSet(n).indexOf(className) !== -1) { count += 1; } });
  return count;
}

function findByClass(node, className) {
  let result = null;
  walk(node, function (n) { if (!result && classSet(n).indexOf(className) !== -1) { result = n; } });
  return result;
}

function findByAttr(node, key, value) {
  let result = null;
  walk(node, function (n) { if (!result && n.attributes && n.attributes[key] === value) { result = n; } });
  return result;
}

function textOf(node) {
  const parts = [];
  walk(node, function (n) { if (n.textContent) { parts.push(n.textContent); } });
  return parts.join('');
}

module.exports = function registerPresentationTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const p = loadPresentation();
  const presentationSource = readText('components', 'presentation', 'presentation.js');
  const componentsCss = css.readCss('components.css');
  const galleryHtml = readText('components', 'component-library', 'component-library.html');
  const registry = loadComponentLibrary();

  // ---- Public API surface --------------------------------------------------

  test('the presentation module registers and exposes its full API', function () {
    assert.ok(p, 'window.AuditOS.presentation is registered');
    ['resolveTone', 'resolveGlyph', 'normalizeDensity', 'normalizeSort', 'nextSortDirection',
      'sortIndicator', 'normalizeColumns', 'clampRatio', 'normalizeActivityGroups',
      'statusBadge', 'progressMeter', 'metadataList', 'propertyGrid', 'timeline', 'itemList',
      'listView', 'activityFeed', 'entityCard', 'dataGrid', 'masterDetail', 'inspectorPanel',
      'emptyState', 'loadingState', 'button'].forEach(function (name) {
      assert.equal(typeof p[name], 'function', name + ' is exposed as a function');
    });
  });

  // ---- Pure resolvers: the status vocabulary (Issue #18 §4) ----------------

  test('resolveTone maps every business status kind to a semantic tone', function () {
    assert.equal(p.resolveTone('severity', 'High'), 'error');
    assert.equal(p.resolveTone('severity', 'Medium'), 'warning');
    assert.equal(p.resolveTone('risk', 'Low'), 'success');
    assert.equal(p.resolveTone('review', 'Pending Review'), 'warning');
    assert.equal(p.resolveTone('review', 'Approved'), 'success');
    assert.equal(p.resolveTone('lifecycle', 'In Progress'), 'info');
    assert.equal(p.resolveTone('test', 'Fail'), 'error');
    assert.equal(p.resolveTone('priority', 'Critical'), 'error');
  });

  test('resolveTone is case-insensitive and returns null for unmapped input', function () {
    assert.equal(p.resolveTone('SEVERITY', 'high'), 'error', 'kind and value fold case');
    assert.equal(p.resolveTone('severity', 'Nonexistent'), null, 'unmapped value is neutral');
    assert.equal(p.resolveTone('unknown-kind', 'High'), null, 'unknown kind is neutral');
    assert.equal(p.resolveTone(null, null), null, 'absent input is neutral');
  });

  test('resolveGlyph reinforces tone and falls back to a neutral marker', function () {
    assert.equal(p.resolveGlyph('success'), '✓');
    assert.equal(p.resolveGlyph('error'), '!');
    assert.equal(p.resolveGlyph(null), '•', 'a null tone still yields a marker');
  });

  // ---- Pure resolvers: grid + layout decisions -----------------------------

  test('normalizeColumns applies defaults and preserves alignment', function () {
    const columns = p.normalizeColumns([
      'plain',
      { key: 'name', label: 'Name', sortable: true, sort: 'descending' },
      { key: 'score', label: 'Score', align: 'numeric' },
      { key: 'bad', align: 'nonsense' }
    ]);
    // A bare string column normalizes to a complete, non-sortable descriptor.
    assert.equal(columns[0].key, 'plain');
    assert.equal(columns[0].label, 'plain', 'the label defaults to the key');
    assert.equal(columns[0].sortable, false);
    assert.equal(columns[0].align, 'start');
    assert.equal(columns[0].width, null);
    assert.equal(columns[0].sort, 'none');
    assert.equal(columns[1].sortable, true);
    assert.equal(columns[1].sort, 'descending');
    assert.equal(columns[2].align, 'numeric');
    assert.equal(columns[3].align, 'start', 'an unknown alignment falls back to start');
    assert.equal(columns[3].label, 'bad', 'a missing label defaults to the key');
  });

  test('the sort cycle and its indicators are deterministic', function () {
    assert.equal(p.nextSortDirection('none'), 'ascending');
    assert.equal(p.nextSortDirection('ascending'), 'descending');
    assert.equal(p.nextSortDirection('descending'), 'none');
    assert.equal(p.sortIndicator('ascending'), '▲');
    assert.equal(p.sortIndicator('descending'), '▼');
    assert.equal(p.sortIndicator('none'), '↕');
  });

  test('normalizeDensity resolves to the two supported densities', function () {
    assert.equal(p.normalizeDensity('compact'), 'compact');
    assert.equal(p.normalizeDensity('comfortable'), 'comfortable');
    assert.equal(p.normalizeDensity(undefined), 'comfortable', 'default is comfortable');
  });

  test('clampRatio bounds the master-detail proportion', function () {
    assert.equal(p.clampRatio(38), 38, 'a value in range passes through');
    assert.equal(p.clampRatio(5), 20, 'below the range clamps to the minimum');
    assert.equal(p.clampRatio(95), 80, 'above the range clamps to the maximum');
    assert.equal(p.clampRatio('not-a-number'), 20, 'a non-number clamps to the minimum');
    assert.equal(p.clampRatio(50, 40, 60), 50, 'a custom range is honored');
  });

  test('normalizeActivityGroups structures groups and resolves event tone', function () {
    const grouped = p.normalizeActivityGroups({
      groups: [{ label: 'Today', events: [{ kind: 'review', value: 'Approved', title: 'approved', time: '10:24', description: 'note' }] }]
    });
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].label, 'Today');
    assert.equal(grouped[0].events[0].tone, 'success', 'tone resolves from the vocabulary');
    assert.equal(grouped[0].events[0].icon, '✓', 'icon defaults to the tone glyph');
    assert.equal(grouped[0].events[0].timestamp, '10:24', 'time normalizes to timestamp');
    assert.equal(grouped[0].events[0].meta, 'note', 'description normalizes to meta');

    const flat = p.normalizeActivityGroups({ events: [{ title: 'x' }] });
    assert.equal(flat.length, 1, 'a flat event list becomes a single group');
    assert.equal(flat[0].label, '', 'the implicit group is unlabeled');
  });

  // ---- Builders render JSON: Status Badge ----------------------------------

  test('statusBadge renders tone from the vocabulary, a label, and an optional dot', function () {
    const dom = withDom();
    const badge = dom.statusBadge({ kind: 'severity', value: 'High' });
    assert.ok(hasClass(badge, 'aos-status-badge'), 'is a status badge');
    assert.ok(hasClass(badge, 'aos-status-badge--error'), 'severity High resolves to the error tone');
    assert.equal(textOf(badge), 'High', 'the value is the label');

    const custom = dom.statusBadge({ label: 'Custom', tone: 'success', dot: true });
    assert.ok(hasClass(custom, 'aos-status-badge--success'), 'an explicit tone wins');
    assert.ok(hasClass(custom, 'aos-status-badge__dot'), 'the reinforcing dot is present');
    assert.equal(textOf(custom), 'Custom', 'an explicit label wins');

    const neutral = dom.statusBadge({ value: 'Draft', kind: 'lifecycle' });
    assert.equal(countClass(neutral, 'aos-status-badge--info'), 0, 'a neutral lifecycle value carries no tone class');
    assert.equal(textOf(neutral), 'Draft');
  });

  // ---- Builders render JSON: Progress --------------------------------------

  test('progressMeter carries progressbar semantics and a text value', function () {
    const dom = withDom();
    const meter = dom.progressMeter({ label: 'Readiness', value: 64, total: 100 });
    assert.equal(meter.attributes.role, 'progressbar');
    assert.equal(meter.attributes['aria-valuenow'], '64');
    assert.equal(meter.attributes['aria-valuemax'], '100');
    const value = findByClass(meter, 'aos-progress__value');
    assert.equal(textOf(value), '64 of 100 · 64%', 'completion reads as text, not the bar alone');
    const indicator = findByClass(meter, 'aos-progress__indicator');
    assert.equal(indicator.style.width, '64%', 'the indicator width is set from the data');
  });

  // ---- Builders render JSON: Data Grid (Issue #18 §1) ----------------------

  test('dataGrid renders columns, rows, sortable headers, selection, status, and actions', function () {
    const dom = withDom();
    const grid = dom.dataGrid({
      density: 'compact',
      selectable: true,
      columns: [
        { key: 'control', label: 'Control', sortable: true, sort: 'ascending' },
        { key: 'owner', label: 'Owner' },
        { key: 'score', label: 'Score', align: 'numeric' }
      ],
      rows: [
        { selected: true, status: { kind: 'test', value: 'Pass' }, cells: { control: 'Access', owner: 'Dana', score: '98' }, actions: [{ label: 'Open' }] },
        { status: { tone: 'warning', label: 'In review' }, cells: { control: 'Change', owner: 'Lee', score: '72' } }
      ]
    });

    assert.ok(hasClass(grid, 'aos-data-grid--compact'), 'density is applied');
    assert.ok(hasClass(grid, 'aos-data-grid--selectable'), 'selectable modifier is applied');
    assert.ok(findByClass(grid, 'aos-data-grid__table'), 'a table is rendered');

    // Header: status (hidden) + 3 columns + actions (hidden) = 5 header cells.
    assert.equal(countClass(grid, 'aos-data-grid__header-cell'), 5, 'status and action columns are added automatically');
    const sorted = findByAttr(grid, 'aria-sort', 'ascending');
    assert.ok(sorted, 'the sortable column carries aria-sort');
    assert.ok(findByClass(grid, 'aos-data-grid__sort'), 'the sortable header is a real button');
    assert.equal(countClass(grid, 'aos-data-grid__header-cell--numeric'), 1, 'the numeric column aligns right');

    // Body: two rows, one selected, both with a status rail.
    assert.equal(countClass(grid, 'aos-data-grid__row'), 2, 'both data rows render');
    assert.equal(countClass(grid, 'aos-data-grid__row--selected'), 1, 'the selected row is marked');
    assert.ok(findByAttr(grid, 'aria-selected', 'true'), 'selection is announced');
    assert.ok(hasClass(grid, 'aos-data-grid__status-rail--success'), 'test Pass resolves to a success rail');
    assert.ok(hasClass(grid, 'aos-data-grid__status-rail--warning'), 'an explicit warning tone is honored');
    assert.equal(countClass(grid, 'aos-button'), 1, 'only the row with actions renders an action button');
  });

  test('dataGrid preempts the table with empty and loading states', function () {
    const dom = withDom();
    const empty = dom.dataGrid({ columns: [{ key: 'a', label: 'A' }], rows: [], emptyState: { icon: '◇', title: 'Nothing', description: 'None' } });
    assert.ok(findByClass(empty, 'aos-empty-state'), 'an empty grid shows the empty state');
    assert.equal(findByClass(empty, 'aos-data-grid__table'), null, 'no table is rendered when empty');

    const loading = dom.dataGrid({ columns: [{ key: 'a', label: 'A' }], rows: [], loading: { variant: 'table' } });
    assert.ok(findByClass(loading, 'aos-loading-state'), 'a loading grid shows the loading state');
    assert.ok(countClass(loading, 'aos-skeleton') > 0, 'loading composes skeletons');
    assert.equal(findByClass(loading, 'aos-data-grid__table'), null, 'no table is rendered while loading');
  });

  // ---- Builders render JSON: Entity Card (Issue #18 §8) --------------------

  test('entityCard renders the shared object-card language with an interactive variant', function () {
    const dom = withDom();
    const card = dom.entityCard({
      href: '#/clients/contoso',
      title: 'Contoso Ltd',
      subtitle: 'Financial services · London',
      badge: { kind: 'risk', value: 'Medium' },
      facts: [{ term: 'Engagements', detail: '2 active' }],
      meter: { label: 'Readiness', value: 80, total: 100, tone: 'warning' },
      tags: ['SOC 2', { label: 'ISO 27001' }]
    });
    assert.equal(card.tagName, 'A', 'an href renders an interactive link');
    assert.ok(hasClass(card, 'aos-entity-card--interactive'), 'the interactive modifier is applied');
    assert.equal(card.attributes['aria-label'], 'Contoso Ltd', 'the link has a discernible label');
    assert.equal(textOf(findByClass(card, 'aos-entity-card__avatar')), 'C', 'the avatar defaults to the initial');
    assert.ok(hasClass(card, 'aos-status-badge--warning'), 'risk Medium resolves to a warning badge');
    assert.ok(hasClass(card, 'aos-entity-card__badge'), 'the badge takes the entity-card badge slot');
    assert.ok(findByClass(card, 'aos-progress'), 'the readiness meter renders');
    assert.ok(findByClass(card, 'aos-metadata-list'), 'facts render as a metadata list');
    assert.equal(countClass(card, 'aos-chip'), 2, 'tags render as chips');

    const plain = dom.entityCard({ title: 'Ada Lovelace' });
    assert.equal(plain.tagName, 'ARTICLE', 'without an href the card is a static article');
  });

  // ---- Builders render JSON: Activity Feed (Issue #18 §7) ------------------

  test('activityFeed groups events with tone icons, actors, and timestamps', function () {
    const dom = withDom();
    const feed = dom.activityFeed({
      groups: [
        { label: 'Today', events: [{ kind: 'review', value: 'Approved', title: 'approved EV-14', actor: 'Dana', timestamp: '10:24' }] },
        { label: 'Earlier', events: [{ tone: 'info', title: 'left a note' }] }
      ]
    });
    assert.equal(countClass(feed, 'aos-activity-feed__group'), 2, 'events are grouped');
    assert.ok(textOf(feed).indexOf('Today') !== -1 && textOf(feed).indexOf('Earlier') !== -1, 'group labels render');
    assert.ok(hasClass(feed, 'aos-activity-feed__icon--success'), 'review Approved resolves to a success icon');
    assert.equal(textOf(findByClass(feed, 'aos-activity-feed__actor')), 'Dana', 'the actor is named');
    assert.ok(findByClass(feed, 'aos-activity-feed__timestamp'), 'the timestamp renders');

    const flat = dom.activityFeed({ events: [{ title: 'x' }] });
    assert.equal(countClass(flat, 'aos-activity-feed__group'), 1, 'a flat feed renders a single group');
  });

  // ---- Builders render JSON: Inspector Panel (Issue #18 §3) ----------------

  test('inspectorPanel composes identity, badges, typed sections, and actions', function () {
    const dom = withDom();
    const inspector = dom.inspectorPanel({
      eyebrow: 'Control',
      title: 'Access provisioning',
      subtitle: 'AC-2',
      badges: [{ kind: 'test', value: 'Pass' }],
      sections: [
        { title: 'Properties', kind: 'properties', rows: [{ label: 'Owner', value: 'Dana' }] },
        { title: 'Metadata', kind: 'metadata', items: [{ term: 'Framework', detail: 'SOC 2' }], inline: true },
        { title: 'Relationships', kind: 'relationships', items: [{ title: 'EV-1' }] },
        { title: 'Comments', kind: 'placeholder', empty: { icon: '◇', title: 'No comments', description: 'Reserved' } }
      ],
      actions: [{ label: 'Approve', variant: 'primary' }]
    });
    assert.ok(hasClass(inspector, 'aos-inspector'), 'is an inspector panel');
    assert.ok(textOf(inspector).indexOf('Access provisioning') !== -1, 'the title renders');
    assert.ok(hasClass(inspector, 'aos-status-badge--success'), 'the status badge resolves from the vocabulary');
    assert.ok(findByClass(inspector, 'aos-property-grid'), 'the properties section composes a Property Grid');
    assert.ok(hasClass(inspector, 'aos-metadata-list--inline'), 'the metadata section composes an inline Metadata List');
    assert.ok(findByClass(inspector, 'aos-item-list'), 'the relationships section composes an Item List');
    assert.ok(findByClass(inspector, 'aos-empty-state'), 'the placeholder section composes an Empty State');
    const footer = findByClass(inspector, 'aos-inspector__actions');
    assert.ok(footer && hasClass(footer, 'aos-inspector__actions'), 'the action footer renders');
    assert.ok(hasClass(inspector, 'aos-button--primary'), 'the primary action renders filled');
  });

  // ---- Builders render JSON: Master–Detail (Issue #18 §2) ------------------

  test('masterDetail composes two regions with a clamped proportion and a resizer', function () {
    const dom = withDom();
    const list = dom.dataGrid({ columns: [{ key: 'a', label: 'A' }], rows: [{ cells: { a: '1' } }] });
    const detail = dom.inspectorPanel({ title: 'Detail' });
    const layout = dom.masterDetail({ list: list, detail: detail, ratio: 150, resizable: true });

    assert.ok(hasClass(layout, 'aos-master-detail'), 'is a master-detail layout');
    assert.ok(hasClass(layout, 'aos-master-detail--resizable'), 'the resizable modifier is applied');
    assert.equal(layout.style['--aos-master-detail-list'], '80%', 'an out-of-range ratio clamps to the maximum');
    const listRegion = findByClass(layout, 'aos-master-detail__list');
    assert.ok(findByClass(listRegion, 'aos-data-grid'), 'the list region adopts the supplied grid');
    const detailRegion = findByClass(layout, 'aos-master-detail__detail');
    assert.ok(findByClass(detailRegion, 'aos-inspector'), 'the detail region adopts the supplied inspector');
    const divider = findByClass(layout, 'aos-master-detail__divider');
    assert.equal(divider.attributes.role, 'separator', 'the divider is a separator');
    assert.equal(divider.attributes['aria-valuenow'], '80', 'the divider reports the current proportion');
  });

  // ---- Builders render JSON: List Views (Issue #18 §9) ---------------------

  test('listView renders grouped lists with row actions and a flat fallback', function () {
    const dom = withDom();
    const grouped = dom.listView({
      compact: true,
      groups: [
        { label: 'Open', items: [{ title: 'A', tone: 'warning', actions: [{ label: 'Open' }] }] },
        { label: 'Closed', items: [{ title: 'B' }] }
      ]
    });
    assert.ok(hasClass(grouped, 'aos-list-group'), 'a grouped list is a list group');
    assert.equal(countClass(grouped, 'aos-divider--labeled'), 2, 'each group is headed by a labeled divider');
    assert.equal(countClass(grouped, 'aos-item-list'), 2, 'each group renders its own item list');
    assert.ok(hasClass(grouped, 'aos-item-list--compact'), 'compact mode is applied');
    assert.ok(findByClass(grouped, 'aos-item-list__actions'), 'row actions render');

    const flat = dom.listView({ items: [{ title: 'x' }] });
    assert.ok(findByClass(flat, 'aos-item-list'), 'a flat list renders an item list');
    assert.equal(findByClass(flat, 'aos-list-group'), null, 'a flat list is not wrapped in a group');
  });

  // ---- Builders render JSON: Timeline (Issue #18 §6) -----------------------

  test('timeline renders dated events with tone markers and an actor', function () {
    const dom = withDom();
    const line = dom.timeline([
      { timestamp: 'Jan 1', title: 'Opened', actor: 'Dana', kind: 'lifecycle', value: 'Open', description: 'Kickoff' }
    ]);
    assert.ok(hasClass(line, 'aos-timeline'), 'is a timeline');
    assert.ok(hasClass(line, 'aos-timeline__marker--warning'), 'lifecycle Open resolves to a warning marker');
    assert.ok(textOf(line).indexOf('Dana · Opened') !== -1, 'the actor is named alongside the title');
    assert.ok(textOf(line).indexOf('Jan 1') !== -1, 'the timestamp renders');
    assert.ok(findByClass(line, 'aos-timeline__description'), 'the description renders');
  });

  // ---- Library contracts ---------------------------------------------------

  test('the new composite components are registered, defined, and shown', function () {
    ['data-grid', 'entity-card', 'activity-feed', 'inspector', 'master-detail'].forEach(function (id) {
      const component = registry.findById(id);
      assert.ok(component, id + ' is registered');
      assert.ok(css.definesSelector(componentsCss, component.className), '.' + component.className + ' is defined in components.css');
      assert.ok(galleryHtml.indexOf(component.className) !== -1, component.className + ' appears in the gallery');
    });
  });

  test('the renderer composes only registered component classes', function () {
    // Every base class the presentation system builds resolves to a registered
    // component — it invents no duplicate primitives.
    ['aos-data-grid', 'aos-master-detail', 'aos-inspector', 'aos-activity-feed', 'aos-entity-card',
      'aos-status-badge', 'aos-progress', 'aos-metadata-list', 'aos-property-grid', 'aos-item-list',
      'aos-timeline', 'aos-chip', 'aos-button', 'aos-empty-state', 'aos-loading-state']
      .forEach(function (className) {
        assert.ok(presentationSource.indexOf(className) !== -1, 'the renderer composes ' + className);
        assert.ok(registry.findById(className.replace(/^aos-/, '')), className + ' resolves to a registered component');
      });
  });

  test('the renderer is presentation only — it reads no business state', function () {
    // Scan code with comments removed: the architectural doc comment names the
    // Shared Audit State to state the constraint; the code must not touch it.
    const code = css.stripComments(presentationSource);
    assert.equal(code.indexOf('AuditOS.state'), -1, 'the renderer never touches the Shared Audit State');
    assert.equal(code.indexOf('demo-data'), -1, 'the renderer never reads demo-data');
    assert.equal(code.indexOf('innerHTML'), -1, 'text is assigned safely, never via innerHTML');
  });

  test('the presentation module is wired into index.html', function () {
    const html = readText('index.html');
    assert.match(html, /components\/presentation\/presentation\.js/, 'index.html loads the presentation renderer');
  });
};
