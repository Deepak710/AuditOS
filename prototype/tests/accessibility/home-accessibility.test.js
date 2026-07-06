'use strict';

/**
 * Accessibility Tests — AuditOS Home & Component Library Additions
 *
 * Asserts the accessibility contracts of the Home workspace and the new
 * library primitives (GitHub Issue #15 — Testing / Accessibility Tests):
 * semantic structure, accessible names, progressbar semantics, decorative
 * markers hidden from assistive technology, live loading announcements, and
 * status never encoded by color alone.
 */

const { readText } = require('../lib/prototype');
const css = require('../lib/css');

module.exports = function registerAccessibilityTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const homeJs = readText('js', 'workspaces', 'home.js');
  const homeHtml = readText('components', 'workspaces', 'home', 'home.html');
  const componentsCss = css.readCss('components.css');
  const galleryHtml = readText('components', 'component-library', 'component-library.html');

  test('Home names every rendered region for assistive technology', function () {
    assert.match(homeJs, /setAttribute\('aria-label'/, 'regions carry accessible names');
    assert.match(homeJs, /'section'/, 'regions render as semantic sections');
  });

  test('Home builds a semantic heading hierarchy beneath the framework h1', function () {
    assert.match(homeJs, /'h2'/, 'section titles render as h2 under the framework h1');
    assert.match(homeJs, /'h3'/, 'card and panel titles render as h3 under their sections');
    assert.doesNotMatch(homeJs, /'h1'/, 'the framework keeps sole ownership of the h1');
  });

  test('Home uses semantic list and description-list structures', function () {
    assert.match(homeJs, /'ul'/, 'item collections render as unordered lists');
    assert.match(homeJs, /'ol'/, 'the timeline renders as an ordered list');
    assert.match(homeJs, /'dl'/, 'metadata renders as description lists');
    assert.match(homeJs, /'dt'/, 'metadata terms are real <dt> elements');
    assert.match(homeJs, /'dd'/, 'metadata details are real <dd> elements');
  });

  test('Home progress meters carry progressbar semantics with values', function () {
    assert.match(homeJs, /setAttribute\('role',\s*'progressbar'\)/, 'meters carry the progressbar role');
    assert.match(homeJs, /aria-valuenow/, 'meters expose their current value');
    assert.match(homeJs, /aria-valuemax/, 'meters expose their maximum');
  });

  test('decorative markers and meters are hidden from assistive technology', function () {
    assert.match(homeJs, /setAttribute\('aria-hidden',\s*'true'\)/,
      'tone glyphs, timeline dots, and decorative meters are aria-hidden');
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
    assert.match(homeJs, /severity \+ ' severity/, 'finding severities are written out as text');
  });

  test('quick actions are real links with discernible text', function () {
    assert.match(homeJs, /'a',\s*'aos-button/, 'quick actions render as anchors styled as buttons');
    assert.match(homeJs, /setAttribute\('href'/, 'quick actions carry real hrefs for keyboard and AT');
    assert.doesNotMatch(homeJs, /tabindex="[1-9]/, 'no positive tabindex anywhere');
  });

  test('the Button component exposes a visible focus ring', function () {
    assert.match(componentsCss, /\.aos-button:focus-visible\s*\{[\s\S]*?--aos-focus-ring[\s\S]*?\}/,
      'buttons consume the shared focus-ring token');
  });

  test('the canonical markup references model the accessible structures', function () {
    assert.match(galleryHtml, /role="progressbar"/, 'the gallery models progressbar semantics');
    assert.match(homeHtml, /aria-label="Quick actions"/, 'the Home reference names its action group');
    assert.match(homeHtml, /<ol class="aos-timeline">/, 'the Home reference keeps the ordered timeline');
    assert.match(homeHtml, /<dl class="aos-metadata-list/, 'the Home reference keeps description lists');
  });
};
