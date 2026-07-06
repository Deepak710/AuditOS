'use strict';

/**
 * Unit Tests — Enterprise Design Language Layer
 *
 * Verifies the contracts of css/design-language.css (GitHub Issue #15): the
 * layer consumes Design Tokens only, owns the cross-cutting refinements it is
 * responsible for (selection, numeric typography, motion language, brand
 * tint), never duplicates what the shell or component layers own, and stays
 * reduced-motion safe.
 */

const css = require('../lib/css');

module.exports = function registerUnitTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const designLanguageCss = css.readCss('design-language.css');

  test('design-language.css consumes Design Tokens only (no raw color literals)', function () {
    assert.deepEqual(css.findHexColors(designLanguageCss), [], 'no raw hex colors');
    assert.deepEqual(css.findColorFunctions(designLanguageCss), [], 'no raw rgb()/hsl() literals');
  });

  test('design-language.css imports only the Design Token Foundation', function () {
    assert.deepEqual(css.findImports(designLanguageCss), ["@import 'variables.css';"]);
  });

  test('the layer owns text selection with an accessible token pair', function () {
    assert.match(designLanguageCss, /::selection\s*\{[\s\S]*?--aos-color-primary-200[\s\S]*?\}/,
      'selection background comes from the primary scale');
    assert.match(designLanguageCss, /::selection\s*\{[\s\S]*?--aos-color-neutral-900[\s\S]*?\}/,
      'selection text keeps a fixed dark tone for contrast in both schemes');
  });

  test('the layer provides the tabular numeric utility', function () {
    assert.match(designLanguageCss, /\.aos-numeric\s*\{[\s\S]*?tabular-nums[\s\S]*?\}/);
  });

  test('the motion language defines the shared fade and rise entrances', function () {
    assert.match(designLanguageCss, /@keyframes\s+aos-fade-in/, 'fade keyframes exist');
    assert.match(designLanguageCss, /@keyframes\s+aos-rise-in/, 'rise keyframes exist');
    assert.ok(css.definesSelector(designLanguageCss, 'aos-fade-in'), '.aos-fade-in utility exists');
    assert.ok(css.definesSelector(designLanguageCss, 'aos-rise-in'), '.aos-rise-in utility exists');
  });

  test('the brand tint composes tokens, reserved for AI surfaces', function () {
    assert.match(designLanguageCss, /\.aos-tint-brand\s*\{[\s\S]*?--aos-color-primary-500[\s\S]*?\}/,
      'tint mixes from the primary token');
  });

  test('the layer does not duplicate shell or component ownership', function () {
    assert.doesNotMatch(designLanguageCss, /::-webkit-scrollbar/, 'scrollbars stay owned by layout.css');
    assert.doesNotMatch(designLanguageCss, /outline:\s*none/, 'focus ownership stays with layout.css');
    assert.doesNotMatch(designLanguageCss, /\.aos-card\s*\{/, 'component chrome stays in components.css');
  });

  test('the motion language is reduced-motion safe', function () {
    assert.ok(css.hasReducedMotionGuard(designLanguageCss), 'has a prefers-reduced-motion guard');
    assert.match(designLanguageCss,
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?animation:\s*none/,
      'the guard removes the entrance animations');
  });
};
