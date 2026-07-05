'use strict';

/**
 * AuditOS CSS Contract Helpers
 *
 * Reusable, framework-free helpers for asserting the stylesheet contracts every
 * AuditOS CSS-owning issue shares: Design-Token-only styling, selector
 * presence, single-import discipline, and reduced-motion guarding. Extracted so
 * future component and workspace issues assert the same contracts without
 * re-deriving the scans (Coding Standards §30.10 — shared behavior exists once).
 */

const { readText } = require('./prototype');

/** Reads a stylesheet from the prototype css/ directory by file name. */
function readCss(fileName) {
  return readText('css', fileName);
}

/** Returns the stylesheet with CSS comments removed, so literal scans ignore prose. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** True when the stylesheet defines a rule for the given class (a `.class` selector). */
function definesSelector(css, className) {
  return css.indexOf('.' + className) !== -1;
}

/** Raw hex color literals in the stylesheet (a Design-Token violation). */
function findHexColors(css) {
  return stripComments(css).match(/#[0-9a-fA-F]{3,8}\b/g) || [];
}

/** Raw rgb()/hsl() color-function literals in the stylesheet (a Design-Token violation). */
function findColorFunctions(css) {
  return stripComments(css).match(/\b(?:rgb|hsl)a?\(/g) || [];
}

/** The stylesheet's @import statements, in source order. */
function findImports(css) {
  return css.match(/@import[^;]+;/g) || [];
}

/** True when the stylesheet declares a prefers-reduced-motion guard. */
function hasReducedMotionGuard(css) {
  return /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css);
}

module.exports = {
  readCss: readCss,
  stripComments: stripComments,
  definesSelector: definesSelector,
  findHexColors: findHexColors,
  findColorFunctions: findColorFunctions,
  findImports: findImports,
  hasReducedMotionGuard: hasReducedMotionGuard
};
