'use strict';

/**
 * Accessibility Tests — Global Home & Component Library Additions
 *
 * Asserts the accessibility contracts of the client-centric Global Home
 * (Issue #33 §1) and the shared Permission Notice (Issue #33 §5): semantic
 * structure, accessible names, decorative markers hidden from assistive
 * technology, live loading announcements, status never encoded by color
 * alone, client selection as real links, and the permission explanation
 * reachable by keyboard, not hover alone.
 */

const { readText } = require('../lib/prototype');
const css = require('../lib/css');

module.exports = function registerAccessibilityTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const homeJs = readText('js', 'workspaces', 'home.js');
  const homeHtml = readText('components', 'workspaces', 'home', 'home.html');
  const sharedJs = readText('components', 'workspace-shared', 'workspace-shared.js');
  const componentsCss = css.readCss('components.css');
  const galleryHtml = readText('components', 'component-library', 'component-library.html');

  test('Home names every rendered region for assistive technology', function () {
    assert.match(homeJs, /setAttribute\('aria-label'/, 'regions carry accessible names');
    assert.match(homeJs, /'section'/, 'regions render as semantic sections');
  });

  test('Home builds a semantic heading hierarchy beneath the framework h1', function () {
    assert.match(homeJs, /'h2'/, 'section titles render as h2 under the framework h1');
    assert.match(homeJs, /'h3'/, 'client card titles render as h3 under their sections');
    assert.doesNotMatch(homeJs, /'h1'/, 'the framework keeps sole ownership of the h1');
  });

  test('Home uses semantic list and description-list structures', function () {
    assert.match(homeJs, /'ul'/, 'item collections render as unordered lists');
    assert.match(homeJs, /'dl'/, 'client facts render as description lists');
    assert.match(homeJs, /'dt'/, 'fact terms are real <dt> elements');
    assert.match(homeJs, /'dd'/, 'fact details are real <dd> elements');
  });

  test('decorative markers and arrows are hidden from assistive technology', function () {
    assert.match(homeJs, /setAttribute\('aria-hidden',\s*'true'\)/,
      'tone glyphs and hover arrows are aria-hidden');
  });

  test('the loading state announces progress accessibly', function () {
    assert.match(homeJs, /setAttribute\('role',\s*'status'\)/, 'loading regions carry role="status"');
    assert.match(homeJs, /setAttribute\('aria-busy',\s*'true'\)/, 'loading regions carry aria-busy');
    assert.match(componentsCss, /\.aos-loading-state__label\s*\{[\s\S]*?clip:/,
      'the loading label stays visually hidden but announced');
  });

  test('status and tone always read through text, never color alone', function () {
    assert.match(homeJs, /TONE_GLYPHS/, 'markers pair a glyph with their tone');
    assert.match(homeJs, /aos-status-badge/, 'badges carry their status as text');
  });

  test('client selection renders as real links with discernible names', function () {
    assert.match(homeJs, /setAttribute\('href'/, 'client cards carry real hrefs for keyboard and AT');
    assert.match(homeJs, /setAttribute\('aria-label',\s*item\.title|setAttribute\('aria-label',\s*entity\.title/,
      'selection links carry accessible names naming the client');
    assert.doesNotMatch(homeJs, /tabindex="[1-9]/, 'no positive tabindex anywhere');
  });

  test('the Button component exposes a visible focus ring', function () {
    assert.match(componentsCss, /\.aos-button:focus-visible\s*\{[\s\S]*?--aos-focus-ring[\s\S]*?\}/,
      'buttons consume the shared focus-ring token');
  });

  test('the Permission Notice explains itself to keyboard and AT, not hover alone', function () {
    assert.match(sharedJs, /setAttribute\('tabindex',\s*'0'\)/, 'the notice is keyboard reachable');
    assert.match(sharedJs, /aria-describedby/, 'the explanation is programmatically associated');
    assert.match(sharedJs, /setAttribute\('role',\s*'tooltip'\)/, 'the explanation carries tooltip semantics');
    assert.match(componentsCss, /\.aos-permission-notice:focus-visible[\s\S]*?\.aos-permission-notice__tooltip[\s\S]*?\{[\s\S]*?display:\s*flex/,
      'focus reveals the explanation exactly like hover');
  });

  test('the canonical markup references model the accessible structures', function () {
    assert.match(galleryHtml, /role="progressbar"/, 'the gallery models progressbar semantics');
    assert.match(galleryHtml, /aos-permission-notice[\s\S]*?role="tooltip"/, 'the gallery models the permission notice');
    assert.match(homeHtml, /aria-label="Client name — Open client dashboard"/,
      'the Home reference names its client selection links');
    assert.match(homeHtml, /<dl class="aos-metadata-list/, 'the Home reference keeps description lists');
    assert.match(homeHtml, /aria-hidden="true">→<\/span>/, 'the Home reference hides decorative arrows');
  });
};
