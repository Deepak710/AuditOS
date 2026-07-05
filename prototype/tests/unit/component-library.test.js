'use strict';

/**
 * Unit Tests — Component Library
 *
 * Covers every registered component and the library-wide contracts every
 * component must satisfy (GitHub Issue #14 — Testing / Unit Tests). For each
 * component it asserts a complete, valid registry descriptor, a base class
 * defined in the stylesheet, and a presence in the canonical markup gallery —
 * so the three sources of truth (registry, CSS, gallery) stay in sync. It then
 * asserts the cross-cutting requirements: Design-Token-only styling, a
 * reduced-motion guard, and the state/accessibility affordances.
 */

const { loadComponentLibrary, readText, toHostArray } = require('../lib/prototype');
const css = require('../lib/css');

module.exports = function registerUnitTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const registry = loadComponentLibrary();
  const componentsCss = css.readCss('components.css');
  const galleryHtml = readText('components', 'component-library', 'component-library.html');
  const knownCategories = toHostArray(
    Object.keys(registry.CATEGORIES).map(function (key) { return registry.CATEGORIES[key]; })
  );

  // ---- Per-component coverage: descriptor + CSS definition + gallery reference.
  toHostArray(registry.COMPONENTS).forEach(function (component) {
    test('component "' + component.id + '" has a complete, valid descriptor', function () {
      assert.match(component.id, /^[a-z][a-z-]*[a-z]$/, 'id is kebab-case');
      assert.ok(typeof component.name === 'string' && component.name.trim().length > 0, 'name is present');
      assert.ok(knownCategories.indexOf(component.category) !== -1, 'category is a known category');
      assert.match(component.className, /^aos-[a-z-]+$/, 'className is an aos- class');
      assert.ok(typeof component.description === 'string' && component.description.trim().length >= 10,
        'description is a meaningful sentence');
    });

    test('component "' + component.id + '" defines its base class in components.css', function () {
      assert.ok(css.definesSelector(componentsCss, component.className),
        '.' + component.className + ' is defined in components.css');
    });

    test('component "' + component.id + '" appears in the canonical gallery', function () {
      assert.ok(galleryHtml.indexOf(component.className) !== -1,
        component.className + ' appears in component-library.html');
    });
  });

  // ---- Library-wide contracts.
  test('components.css consumes Design Tokens for color (no raw hex values)', function () {
    const hexColors = css.findHexColors(componentsCss);
    assert.deepEqual(hexColors, [], 'no raw hex colors; found: ' + hexColors.join(', '));
  });

  test('components.css uses no raw rgb()/hsl() color literals', function () {
    const colorFunctions = css.findColorFunctions(componentsCss);
    assert.deepEqual(colorFunctions, [], 'no raw rgb()/hsl() color literals');
  });

  test('components.css draws spacing, radius, color, and type from tokens', function () {
    assert.ok(componentsCss.indexOf('var(--aos-space-') !== -1, 'uses spacing tokens');
    assert.ok(componentsCss.indexOf('var(--aos-radius-') !== -1, 'uses radius tokens');
    assert.ok(componentsCss.indexOf('var(--aos-surface-') !== -1 || componentsCss.indexOf('var(--aos-color-') !== -1,
      'uses color tokens');
    assert.ok(componentsCss.indexOf('var(--aos-text-') !== -1, 'uses typography tokens');
  });

  test('components.css guards motion for reduced-motion users', function () {
    assert.ok(css.hasReducedMotionGuard(componentsCss), 'has a prefers-reduced-motion guard');
    assert.match(componentsCss, /\.aos-skeleton\s*\{[\s\S]*?animation:[\s\S]*?\}/,
      'the skeleton declares an animation that the guard can disable');
  });

  test('interactive components expose a visible focus ring', function () {
    assert.match(componentsCss, /:focus-visible\s*\{[\s\S]*?--aos-focus-ring[\s\S]*?\}/,
      'focus-visible styles consume the focus-ring token');
  });

  test('status is not encoded by color alone (badge carries an optional dot)', function () {
    assert.ok(css.definesSelector(componentsCss, 'aos-status-badge__dot'), 'status badge provides a dot affordance');
  });

  test('the loading state provides an accessible, visually-hidden label', function () {
    assert.match(componentsCss, /\.aos-loading-state__label\s*\{[\s\S]*?clip:\s*rect\([\s\S]*?\}/,
      'loading-state label is visually hidden but available to assistive tech');
  });

  test('components.css imports only the Design Token Foundation', function () {
    assert.deepEqual(css.findImports(componentsCss), ["@import 'variables.css';"],
      'imports variables.css and nothing else');
  });
};
