'use strict';

/**
 * AuditOS Prototype Test Access
 *
 * Shared helpers that let the offline test suites read prototype source files
 * and execute the prototype's classic (window-scoped IIFE) scripts without a
 * browser. The catalog scripts only touch `window`, so a minimal sandbox
 * reproduces exactly how index.html loads them — no DOM, no Playwright, no
 * network — keeping the suites fully offline (AI Implementation Context —
 * file:// / offline constraint).
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/** Absolute path to the prototype root (this file lives in prototype/tests/lib). */
const PROTOTYPE_DIR = path.resolve(__dirname, '..', '..');

/**
 * Path segments of the prototype's classic (window-scoped) scripts, so suites
 * reference a named constant instead of repeating path literals (Coding
 * Standards §30.11). Future issues register their scripts here.
 */
const SCRIPTS = {
  componentLibrary: ['components', 'component-library', 'component-library.js'],
  workspaceRegistry: ['js', 'router', 'workspace-registry.js'],
  demoDataBundle: ['demo-data', 'demo-data.js'],
  demoDataRegistry: ['js', 'state', 'demo-data-registry.js'],
  stateStore: ['js', 'state', 'state-store.js'],
  homeWorkspace: ['js', 'workspaces', 'home.js']
};

/** Resolves a path inside the prototype from path segments. */
function prototypePath() {
  const segments = Array.prototype.slice.call(arguments);
  return path.join.apply(path, [PROTOTYPE_DIR].concat(segments));
}

/** Reads a UTF-8 prototype file from path segments. */
function readText() {
  return fs.readFileSync(prototypePath.apply(null, arguments), 'utf8');
}

/**
 * Executes a classic prototype script in an isolated sandbox whose global
 * exposes a fresh `window`, mirroring how the browser evaluates the script tag.
 * Returns the populated `window` so a suite can read what the script registered
 * (e.g. `window.AuditOS.componentLibrary`).
 */
function loadClassicScript(segments) {
  const code = fs.readFileSync(prototypePath.apply(null, segments), 'utf8');
  const windowObject = {};
  const sandbox = { window: windowObject };
  vm.runInNewContext(code, sandbox, { filename: segments.join('/') });
  return windowObject;
}

/**
 * Executes several classic prototype scripts, in order, against one shared
 * `window`, mirroring how index.html stacks its script tags. Returns the
 * populated window so a suite can exercise foundations that build on each
 * other (e.g. bundle → registry → state store → home workspace).
 */
function loadClassicScripts(scriptList) {
  const windowObject = {};
  const sandbox = { window: windowObject };
  scriptList.forEach(function (segments) {
    const code = fs.readFileSync(prototypePath.apply(null, segments), 'utf8');
    vm.runInNewContext(code, sandbox, { filename: segments.join('/') });
  });
  return windowObject;
}

/** Loads the component library registry (window.AuditOS.componentLibrary). */
function loadComponentLibrary() {
  return loadClassicScript(SCRIPTS.componentLibrary).AuditOS.componentLibrary;
}

/** Loads the Home workspace module (window.AuditOS.homeWorkspace). */
function loadHomeWorkspace() {
  return loadClassicScript(SCRIPTS.homeWorkspace).AuditOS.homeWorkspace;
}

/**
 * Normalizes a value produced inside the vm sandbox into this realm. Arrays
 * created in the sandbox have a different Array.prototype, which trips strict
 * deep-equality; suites pass registry-derived collections through this before
 * comparing them against host-realm expectations.
 */
function toHostArray(value) {
  return Array.from(value);
}

module.exports = {
  PROTOTYPE_DIR: PROTOTYPE_DIR,
  SCRIPTS: SCRIPTS,
  prototypePath: prototypePath,
  readText: readText,
  loadClassicScript: loadClassicScript,
  loadClassicScripts: loadClassicScripts,
  loadComponentLibrary: loadComponentLibrary,
  loadHomeWorkspace: loadHomeWorkspace,
  toHostArray: toHostArray
};
