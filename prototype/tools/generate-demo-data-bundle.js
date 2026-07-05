#!/usr/bin/env node
/**
 * AuditOS Demo-Data Bundle Generator
 *
 * Regenerates `prototype/demo-data/demo-data.js` — the classic-script
 * projection of the canonical demo-data JSON that the Shared Audit State
 * store loads at runtime. The bundle exists because browsers cannot fetch
 * local JSON from file:// pages; loading demo-data through a script tag
 * behaves identically under file:// and http(s), fully offline.
 *
 * The canonical source of truth remains the JSON files in
 * `prototype/demo-data/`. Run this generator after any demo-data change:
 *
 *   node prototype/tools/generate-demo-data-bundle.js
 *
 * The structural catalog is read from the demo-data registry
 * (`prototype/js/state/demo-data-registry.js`) so the generator and the
 * state store share one definition of the demo-data structure. Output is
 * deterministic (registry order, manifest order, no timestamps).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const PROTOTYPE_DIR = path.resolve(__dirname, "..");
const REGISTRY_FILE = path.join(PROTOTYPE_DIR, "js", "state", "demo-data-registry.js");
const OUTPUT_FILE = path.join(PROTOTYPE_DIR, "demo-data", "demo-data.js");

/** Dataset key under which the store expects shared-scope documents. */
const SHARED_DATASET_KEY = "shared";

function loadRegistry() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(REGISTRY_FILE, "utf8"), sandbox, {
    filename: REGISTRY_FILE
  });
  return sandbox.window.AuditOS.demoDataRegistry;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(PROTOTYPE_DIR, relativePath), "utf8"));
}

function datasetIdFromPath(datasetPath) {
  return datasetPath.split("/").pop().replace(/\.json$/, "");
}

const registry = loadRegistry();
const collections = {};
let sourceCount = 0;

for (const entry of registry.COLLECTIONS) {
  const documents = {};
  if (entry.scope === registry.SCOPES.SHARED) {
    documents[SHARED_DATASET_KEY] = readJson(entry.path);
    sourceCount += 1;
  } else {
    const manifest = readJson(entry.manifestPath);
    sourceCount += 1;
    for (const datasetPath of manifest.datasets || []) {
      documents[datasetIdFromPath(datasetPath)] = readJson("demo-data/" + datasetPath);
      sourceCount += 1;
    }
  }
  collections[entry.id] = documents;
}

const banner = [
  "/**",
  " * AuditOS Demo-Data Bundle (GENERATED FILE — DO NOT EDIT)",
  " *",
  " * Classic-script projection of the canonical demo-data JSON in",
  " * prototype/demo-data/, loaded by the Shared Audit State store so the",
  " * prototype behaves identically under file:// and http(s) with no network",
  " * access. The JSON files remain the source of truth; regenerate this file",
  " * after any demo-data change:",
  " *",
  " *   node prototype/tools/generate-demo-data-bundle.js",
  " */"
].join("\n");

const payload = JSON.stringify({ collections }, null, 2).replace(/\n/g, "\n  ");

const output =
  banner +
  "\n(function (global) {\n" +
  "  'use strict';\n\n" +
  "  var AuditOS = global.AuditOS = global.AuditOS || {};\n\n" +
  "  AuditOS.demoDataBundle = " + payload + ";\n" +
  "})(window);\n";

fs.writeFileSync(OUTPUT_FILE, output);

console.log(
  "Wrote " + path.relative(process.cwd(), OUTPUT_FILE) +
  " (" + registry.COLLECTIONS.length + " collections, " + sourceCount + " sources, " +
  Math.round(output.length / 1024) + " KB)"
);
