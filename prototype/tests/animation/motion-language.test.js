'use strict';

/**
 * Animation Tests — Motion Language
 *
 * Asserts the motion contracts of the enterprise design language (GitHub
 * Issue #15 — Testing / Animation Tests): entrance motion is defined once in
 * the design language layer and consumed by Home, every new duration and
 * easing comes from the motion tokens (which collapse to zero under
 * prefers-reduced-motion), and the pre-existing framework and component
 * motion is preserved.
 */

const { readText } = require('../lib/prototype');
const css = require('../lib/css');

module.exports = function registerAnimationTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const designLanguageCss = css.readCss('design-language.css');
  const homeCss = css.readCss('home.css');
  const frameworkCss = css.readCss('workspace-framework.css');
  const componentsCss = css.readCss('components.css');
  const variablesCss = css.readCss('variables.css');
  const homeJs = readText('js', 'workspaces', 'home.js');

  test('the design language defines the shared entrance motion once', function () {
    assert.match(designLanguageCss, /@keyframes\s+aos-fade-in/);
    assert.match(designLanguageCss, /@keyframes\s+aos-rise-in/);
    assert.doesNotMatch(homeCss, /@keyframes/, 'Home declares no duplicate motion of its own');
  });

  test('Home consumes the shared motion utilities', function () {
    assert.match(homeJs, /aos-rise-in/, 'the Home column rises in on render');
    assert.match(homeJs, /aos-fade-in/, 'panel content fades in when it replaces loading states');
  });

  test('design-language durations and easings come from the motion tokens', function () {
    assert.match(designLanguageCss, /animation:[^;]*var\(--aos-duration-/, 'durations are tokens');
    assert.match(designLanguageCss, /animation:[^;]*var\(--aos-ease-/, 'easings are tokens');
    const rawDurations = css.stripComments(designLanguageCss).match(/\b\d+(\.\d+)?m?s\b/g) || [];
    assert.deepEqual(rawDurations, [], 'no raw millisecond or second literals');
  });

  test('home.css introduces no raw duration literals', function () {
    const rawDurations = css.stripComments(homeCss).match(/\b\d+(\.\d+)?m?s\b/g) || [];
    assert.deepEqual(rawDurations, [], 'Home layout declares no timing of its own');
  });

  test('the token layer collapses every duration under reduced motion', function () {
    assert.match(variablesCss,
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?--aos-duration-fast:\s*0ms[\s\S]*?--aos-duration-normal:\s*0ms[\s\S]*?--aos-duration-slow:\s*0ms/,
      'motion tokens zero out for reduced-motion users');
  });

  test('the design language removes its animations entirely under reduced motion', function () {
    assert.match(designLanguageCss,
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.aos-fade-in[\s\S]*?animation:\s*none/,
      'the entrance utilities collapse to plain appearance');
  });

  test('the framework entrance animation is preserved', function () {
    assert.match(frameworkCss, /@keyframes\s+aos-workspace-framework-enter/,
      'the workspace enter motion still exists');
    assert.match(frameworkCss, /animation:\s*aos-workspace-framework-enter\s+var\(--aos-duration-normal\)/,
      'the enter motion still consumes the duration token');
  });

  test('the skeleton shimmer is preserved and reduced-motion safe', function () {
    assert.match(componentsCss, /@keyframes\s+aos-skeleton-pulse/, 'the shimmer still exists');
    assert.match(componentsCss,
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.aos-skeleton\s*\{[\s\S]*?animation:\s*none/,
      'the shimmer still collapses under reduced motion');
  });

  test('interactive transitions consume the composed transition tokens', function () {
    assert.match(componentsCss, /\.aos-button\s*\{[\s\S]*?transition:[\s\S]*?var\(--aos-transition-fast\)/,
      'button hover/press transitions use the fast token');
    assert.match(componentsCss, /\.aos-progress__indicator\s*\{[\s\S]*?transition:\s*width\s+var\(--aos-transition-slow\)/,
      'progress updates ease with the slow token');
  });
};
