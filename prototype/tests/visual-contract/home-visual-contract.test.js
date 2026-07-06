'use strict';

/**
 * Visual Contract Tests — AuditOS Home & Enterprise Design Language
 *
 * Asserts the visual contracts of the Home workspace (GitHub Issue #15 —
 * Testing / Visual Contract Tests): token-only styling, strict workspace
 * scoping (Home never redefines shell or component chrome), and genuine
 * reuse — every component class Home composes is registered in the Shared
 * Enterprise Component Library and defined in its stylesheet.
 */

const { readText, loadComponentLibrary, toHostArray } = require('../lib/prototype');
const css = require('../lib/css');

/** Component base classes Home composes (registry ids they must map to). */
const REUSED_COMPONENTS = {
  'aos-surface': 'surface',
  'aos-section': 'section',
  'aos-card': 'card',
  'aos-panel-section': 'panel-section',
  'aos-kpi-tile': 'kpi-tile',
  'aos-status-badge': 'status-badge',
  'aos-progress': 'progress',
  'aos-item-list': 'item-list',
  'aos-timeline': 'timeline',
  'aos-metadata-list': 'metadata-list',
  'aos-action-group': 'action-group',
  'aos-button': 'button',
  'aos-empty-state': 'empty-state',
  'aos-loading-state': 'loading-state',
  'aos-skeleton': 'skeleton'
};

module.exports = function registerVisualContractTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const homeCss = css.readCss('home.css');
  const componentsCss = css.readCss('components.css');
  const homeJs = readText('js', 'workspaces', 'home.js');
  const registry = loadComponentLibrary();

  test('home.css consumes Design Tokens only (no raw color literals)', function () {
    assert.deepEqual(css.findHexColors(homeCss), [], 'no raw hex colors');
    assert.deepEqual(css.findColorFunctions(homeCss), [], 'no raw rgb()/hsl() literals');
  });

  test('home.css imports only the Design Token Foundation', function () {
    assert.deepEqual(css.findImports(homeCss), ["@import 'variables.css';"]);
  });

  test('home.css draws spacing and typography from tokens', function () {
    assert.ok(homeCss.indexOf('var(--aos-space-') !== -1, 'uses spacing tokens');
    assert.ok(homeCss.indexOf('var(--aos-text-') !== -1, 'uses typography tokens');
  });

  test('every home.css selector is scoped under the .aos-home prefix', function () {
    const selectors = css.stripComments(homeCss).match(/(^|\})\s*([^@{}]+)\{/g) || [];
    selectors.forEach(function (block) {
      const selectorText = block.replace(/^\}?\s*/, '').replace(/\{$/, '').trim();
      selectorText.split(',').forEach(function (selector) {
        const trimmed = selector.trim();
        if (trimmed.length === 0) {
          return;
        }
        assert.ok(trimmed.indexOf('.aos-home') === 0,
          'selector "' + trimmed + '" is scoped under .aos-home');
      });
    });
  });

  test('home.css never redefines component or shell chrome', function () {
    Object.keys(REUSED_COMPONENTS).forEach(function (className) {
      assert.ok(!new RegExp('(^|\\})\\s*\\.' + className + '\\s*[{,]').test(css.stripComments(homeCss)),
        'home.css does not restyle .' + className + ' at the top level');
    });
  });

  test('every component class Home composes is registered in the library', function () {
    Object.keys(REUSED_COMPONENTS).forEach(function (className) {
      assert.ok(homeJs.indexOf(className) !== -1, 'home.js composes ' + className);
      const component = registry.findById(REUSED_COMPONENTS[className]);
      assert.ok(component, REUSED_COMPONENTS[className] + ' is a registered component');
      assert.equal(component.className, className, 'registry class matches the composed class');
      assert.ok(css.definesSelector(componentsCss, className),
        '.' + className + ' is defined in components.css');
    });
  });

  test('the new library components keep the library-wide visual contracts', function () {
    ['aos-progress', 'aos-item-list', 'aos-timeline', 'aos-button'].forEach(function (className) {
      assert.ok(css.definesSelector(componentsCss, className), '.' + className + ' is defined');
    });
    assert.deepEqual(css.findHexColors(componentsCss), [], 'components.css stays token-only');
  });

  test('Home assigns text through textContent, never markup injection', function () {
    assert.doesNotMatch(homeJs, /innerHTML|insertAdjacentHTML|outerHTML/,
      'home.js never injects markup strings');
  });

  test('the library registry catalog matches the stylesheet and gallery for all components', function () {
    const galleryHtml = readText('components', 'component-library', 'component-library.html');
    toHostArray(registry.COMPONENTS).forEach(function (component) {
      assert.ok(css.definesSelector(componentsCss, component.className),
        component.id + ' is defined in components.css');
      assert.ok(galleryHtml.indexOf(component.className) !== -1,
        component.id + ' appears in the canonical gallery');
    });
  });
};
