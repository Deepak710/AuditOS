'use strict';

/**
 * Smoke Tests — Component Registration
 *
 * Verifies that the Shared Enterprise Component Library registers cleanly: the
 * registry loads, exposes its catalog, registers every expected component
 * exactly once, resolves lookups, and is wired into the application entry
 * point. These are the fast "did the library come up?" checks (GitHub Issue
 * #14 — Testing / Smoke Tests).
 */

const { loadComponentLibrary, toHostArray, readText } = require('../lib/prototype');

/** The complete set of components the library is contracted to register. */
const EXPECTED_COMPONENT_IDS = [
  'surface', 'card', 'section', 'panel-section', 'divider',
  'kpi-tile', 'status-badge', 'chip', 'property-row', 'property-grid', 'metadata-list',
  'progress', 'item-list', 'timeline',
  // Enterprise Data Presentation System composites (Issue #18).
  'data-grid', 'entity-card', 'activity-feed', 'inspector',
  'button', 'search-field', 'select',
  'toolbar-group', 'action-group', 'master-detail',
  'empty-state', 'loading-state', 'skeleton'
];

module.exports = function registerSmokeTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  test('registry script registers a component library', function () {
    const registry = loadComponentLibrary();
    assert.ok(registry, 'window.AuditOS.componentLibrary is registered');
  });

  test('registry exposes the CATEGORIES map and COMPONENTS catalog', function () {
    const registry = loadComponentLibrary();
    assert.equal(typeof registry.CATEGORIES, 'object', 'CATEGORIES is an object');
    assert.ok(Array.isArray(registry.COMPONENTS), 'COMPONENTS is an array');
    assert.ok(registry.COMPONENTS.length > 0, 'catalog is not empty');
  });

  test('every expected component is registered exactly once', function () {
    const registry = loadComponentLibrary();
    const ids = toHostArray(registry.COMPONENTS).map(function (component) { return component.id; });
    assert.deepEqual(ids.slice().sort(), EXPECTED_COMPONENT_IDS.slice().sort());
    assert.equal(new Set(ids).size, ids.length, 'component ids are unique');
  });

  test('no two components share a base class', function () {
    const registry = loadComponentLibrary();
    const classNames = toHostArray(registry.COMPONENTS).map(function (component) { return component.className; });
    assert.equal(new Set(classNames).size, classNames.length, 'component classNames are unique');
  });

  test('findById resolves a registered component and rejects unknown ids', function () {
    const registry = loadComponentLibrary();
    const surface = registry.findById('surface');
    assert.ok(surface, 'findById returns the surface component');
    assert.equal(surface.className, 'aos-surface');
    assert.equal(registry.findById('not-a-component'), null, 'unknown id resolves to null');
  });

  test('findByCategory returns the components of a known category', function () {
    const registry = loadComponentLibrary();
    const stateIds = toHostArray(registry.findByCategory(registry.CATEGORIES.STATE))
      .map(function (component) { return component.id; });
    assert.deepEqual(stateIds.slice().sort(), ['empty-state', 'loading-state', 'skeleton']);
    assert.equal(toHostArray(registry.findByCategory('unknown-category')).length, 0,
      'unknown category resolves to an empty result');
  });

  test('registry is wired into index.html', function () {
    const html = readText('index.html');
    assert.match(html, /components\/component-library\/component-library\.js/,
      'index.html loads the component-library registry script');
  });
};
