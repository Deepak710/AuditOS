'use strict';

/**
 * Integration Tests — Component Compatibility with the Shared Workspace Framework
 *
 * Verifies that the component library composes correctly with the canonical
 * rendering engine (GitHub Issue #14 — Testing / Integration Tests). The
 * framework is the library's first consumer: its supporting panels must reuse
 * the Panel Section component and its primary content and context ribbon must
 * reuse the Surface component. These tests assert that reuse across all four
 * framework sources (renderer, template, stylesheet, and the CSS layer order),
 * and that the reused classes are genuinely registered and defined.
 */

const { loadComponentLibrary, readText } = require('../lib/prototype');
const css = require('../lib/css');

module.exports = function registerIntegrationTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const frameworkJs = readText('components', 'workspace-framework', 'workspace-framework.js');
  const frameworkHtml = readText('components', 'workspace-framework', 'workspace-framework.html');
  const frameworkCss = css.readCss('workspace-framework.css');
  const componentsCss = css.readCss('components.css');
  const mainCss = css.readCss('main.css');
  const registry = loadComponentLibrary();

  test('the framework renderer builds supporting panels as Panel Section components', function () {
    assert.match(frameworkJs, /aos-panel-section/, 'panels use the panel-section base class');
    assert.match(frameworkJs, /aos-panel-section__header/, 'panel header reuses the component part');
    assert.match(frameworkJs, /aos-panel-section__title/, 'panel title reuses the component part');
    assert.match(frameworkJs, /aos-panel-section__body/, 'panel body reuses the component part');
  });

  test('the framework renderer builds content and ribbon as Surface components', function () {
    assert.match(frameworkJs, /aos-surface aos-workspace-framework__content/, 'content composes Surface');
    assert.match(frameworkJs, /aos-surface aos-workspace-framework__ribbon/, 'ribbon composes Surface');
  });

  test('the canonical template mirrors the renderer’s component reuse', function () {
    assert.match(frameworkHtml, /aos-surface aos-workspace-framework__ribbon/);
    assert.match(frameworkHtml, /aos-surface aos-workspace-framework__content/);
    assert.match(frameworkHtml, /aos-panel-section aos-workspace-framework__panel/);
    assert.match(frameworkHtml, /aos-panel-section__body/);
  });

  test('the framework no longer carries its own duplicated panel chrome', function () {
    assert.doesNotMatch(frameworkHtml, /aos-workspace-framework__panel-header/, 'old panel-header class removed from template');
    assert.doesNotMatch(frameworkHtml, /aos-workspace-framework__panel-title/, 'old panel-title class removed from template');
    assert.doesNotMatch(frameworkCss, /\.aos-workspace-framework__panel-header\s*\{/, 'old panel-header rule removed from stylesheet');
    assert.doesNotMatch(frameworkCss, /\.aos-workspace-framework__panel-body\s*\{/, 'old panel-body rule removed from stylesheet');
  });

  test('every component class the framework reuses is a registered component', function () {
    assert.ok(registry.findById('surface'), 'Surface is registered');
    assert.ok(registry.findById('panel-section'), 'Panel Section is registered');
  });

  test('every component class the framework reuses is defined in components.css', function () {
    assert.ok(css.definesSelector(componentsCss, 'aos-surface'), '.aos-surface is defined');
    assert.ok(css.definesSelector(componentsCss, 'aos-panel-section'), '.aos-panel-section is defined');
    assert.ok(css.definesSelector(componentsCss, 'aos-panel-section__body'), '.aos-panel-section__body is defined');
  });

  test('the component layer loads after layout and before the workspace framework', function () {
    const layoutIndex = mainCss.indexOf('layout.css');
    const componentsIndex = mainCss.indexOf('components.css');
    const frameworkIndex = mainCss.indexOf('workspace-framework.css');
    assert.ok(layoutIndex !== -1 && componentsIndex !== -1 && frameworkIndex !== -1, 'all three layers are imported');
    assert.ok(layoutIndex < componentsIndex, 'components.css is imported after layout.css');
    assert.ok(componentsIndex < frameworkIndex, 'components.css is imported before workspace-framework.css');
  });

  test('the framework stylesheet still owns its framework-specific panel layout', function () {
    assert.match(frameworkCss, /\.aos-workspace-framework__panels\s*\{[\s\S]*?grid-template-columns/,
      'framework keeps the supporting-panels grid');
    assert.match(frameworkCss, /\.aos-workspace-framework__panel .aos-panel-section__body\s*\{[\s\S]*?min-height/,
      'framework keeps the reserved panel-body minimum height');
  });

  // ---- Issue #17: configurable toolbar, filter bar, and workspace actions ----

  test('the template reserves the toolbar, filter bar, and workspace action regions', function () {
    assert.match(frameworkHtml, /data-slot="workspace-toolbar"/, 'toolbar region is reserved');
    assert.match(frameworkHtml, /data-slot="workspace-filters"/, 'filter bar region is reserved');
    assert.match(frameworkHtml, /data-slot="workspace-action-bar"/, 'workspace action region is reserved');
  });

  test('the renderer builds the toolbar, filter bar, and workspace action regions', function () {
    assert.match(frameworkJs, /aos-workspace-framework__toolbar/, 'renderer builds the toolbar region');
    assert.match(frameworkJs, /aos-workspace-framework__filters/, 'renderer builds the filter bar region');
    assert.match(frameworkJs, /aos-workspace-framework__action-bar/, 'renderer builds the workspace action region');
  });

  test('the configurable sections compose only registered library components', function () {
    // Search Field, Select, Chip, Status Badge, Button, Toolbar Group, and
    // Action Group — every configurable control reuses the library.
    ['aos-search-field', 'aos-select', 'aos-chip', 'aos-status-badge', 'aos-button', 'aos-toolbar-group', 'aos-action-group']
      .forEach(function (className) {
        assert.match(frameworkJs, new RegExp(className), 'renderer reuses ' + className);
        assert.ok(registry.findById(className.replace(/^aos-/, '')),
          className + ' resolves to a registered component');
      });
  });

  test('the new input primitives are registered and defined in components.css', function () {
    assert.ok(registry.findById('search-field'), 'Search Field is registered');
    assert.ok(registry.findById('select'), 'Select is registered');
    assert.ok(css.definesSelector(componentsCss, 'aos-search-field'), '.aos-search-field is defined');
    assert.ok(css.definesSelector(componentsCss, 'aos-select'), '.aos-select is defined');
  });

  test('the framework stylesheet collapses every reserved region while empty', function () {
    ['toolbar', 'filters', 'action-bar'].forEach(function (region) {
      assert.match(frameworkCss, new RegExp('\\.aos-workspace-framework__' + region + ':empty\\s*\\{\\s*display:\\s*none'),
        region + ' region collapses while empty');
    });
  });
};
