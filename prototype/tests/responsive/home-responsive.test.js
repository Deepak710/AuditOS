'use strict';

/**
 * Responsive Tests — AuditOS Home
 *
 * Asserts the responsive contracts of the Home workspace and its supporting
 * layers (GitHub Issue #15 — Testing / Responsive Tests): the Home grids are
 * fluid, they collapse at the shell's laptop / tablet / mobile breakpoints,
 * and the framework and component layers keep their existing responsive
 * behavior. Live responsive rendering is additionally exercised by the
 * browser validation (tools/validate.js) at three viewports.
 */

const css = require('../lib/css');

/** Extracts the body of every media query matching the given feature. */
function mediaBlocks(stylesheet, feature) {
  const blocks = [];
  const pattern = new RegExp('@media[^{]*' + feature + '[^{]*\\{', 'g');
  let match;
  while ((match = pattern.exec(stylesheet)) !== null) {
    let depth = 1;
    let index = match.index + match[0].length;
    while (index < stylesheet.length && depth > 0) {
      if (stylesheet[index] === '{') depth += 1;
      if (stylesheet[index] === '}') depth -= 1;
      index += 1;
    }
    blocks.push(stylesheet.slice(match.index, index));
  }
  return blocks.join('\n');
}

module.exports = function registerResponsiveTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  const homeCss = css.readCss('home.css');
  const frameworkCss = css.readCss('workspace-framework.css');
  const componentsCss = css.readCss('components.css');

  test('every Home grid is fluid (auto-fit with a readable minimum)', function () {
    ['aos-home__resume', 'aos-home__kpis', 'aos-home__entities', 'aos-home__panel-grid']
      .forEach(function (gridClass) {
        assert.match(homeCss,
          new RegExp('\\.' + gridClass + '\\s*\\{[\\s\\S]*?repeat\\(auto-fit,\\s*minmax\\([\\s\\S]*?\\}'),
          '.' + gridClass + ' wraps fluidly instead of fixing a column count');
      });
  });

  test('the Home grids collapse at the tablet breakpoint (1024px)', function () {
    const tablet = mediaBlocks(homeCss, 'max-width:\\s*1024px');
    assert.ok(tablet.length > 0, 'a tablet breakpoint exists');
    assert.match(tablet, /grid-template-columns:\s*1fr/, 'entity and signal grids settle to one column');
  });

  test('the Home grids collapse at the mobile breakpoint (640px)', function () {
    const mobile = mediaBlocks(homeCss, 'max-width:\\s*640px');
    assert.ok(mobile.length > 0, 'a mobile breakpoint exists');
    assert.match(mobile, /grid-template-columns:\s*1fr/, 'resume cards and KPIs collapse to one column');
  });

  test('home.css declares no fixed pixel widths', function () {
    // `[^-\w]width` excludes the min-/max-width media query features.
    const fixedWidths = css.stripComments(homeCss).match(/[^-\w]width:\s*\d+px/g) || [];
    assert.deepEqual(fixedWidths, [], 'layout widths stay fluid or token-based');
  });

  test('the framework keeps its responsive collapse beneath Home', function () {
    assert.match(frameworkCss, /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.aos-workspace-framework__panels[\s\S]*?grid-template-columns:\s*1fr/,
      'the universal supporting panels still collapse on tablets');
    assert.match(frameworkCss, /@media\s*\(max-width:\s*640px\)/, 'the framework keeps its mobile step');
  });

  test('the new components stay responsive-safe', function () {
    assert.match(componentsCss, /\.aos-item-list__content\s*\{[\s\S]*?min-width:\s*0/,
      'item list content can shrink inside grids');
    assert.match(componentsCss, /\.aos-timeline__content\s*\{[\s\S]*?min-width:\s*0/,
      'timeline content can shrink inside grids');
    assert.match(componentsCss, /\.aos-progress\s*\{[\s\S]*?min-width:\s*0/,
      'progress meters can shrink inside grids');
  });
};
