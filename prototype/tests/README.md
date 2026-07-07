# Prototype Tests

Offline, dependency-free automated tests for the AuditOS prototype.

The prototype is vanilla HTML/CSS/JavaScript that runs directly from
`file://` with no build step. Its tests follow the same discipline: they use
the **Node standard library only** — no test framework, no npm dependency, no
browser, no network — so they run anywhere Node runs.

## Running

```bash
node prototype/tests/run-tests.js
```

The runner prints one line per case and a final `PASS`/`FAIL` summary, and
exits non-zero if any case fails.

This complements `node prototype/tools/validate.js`, which renders
`prototype/index.html` in a headless browser (Playwright) to check the live DOM
and console. The runner here needs no browser and validates the source
contracts directly.

## Suites

| Suite | File | Verifies |
|-------|------|----------|
| Smoke | `smoke/component-registration.test.js` | The Shared Enterprise Component Library registers: `window.AuditOS.componentLibrary` loads, exposes its catalog, registers every expected component exactly once, resolves lookups, and is wired into `index.html`. |
| Smoke | `smoke/walkthrough-workspace.test.js` | The Walkthrough Workspace foundation comes up: module loads and registers its API, the workspace is registered in the router, and stylesheet and script wiring is present in entry points (Issue #20). |
| Unit | `unit/component-library.test.js` | Every registered component has a complete descriptor, a base class defined in `css/components.css`, and a presence in the canonical gallery; plus library-wide contracts — Design-Token-only styling, reduced-motion guard, focus ring, accessible state affordances. |
| Unit | `unit/walkthrough-derivations.test.js` | Pure derivation functions (formatDate, deriveWalkthroughStatus, deriveProcessCoverage, deriveSessionDetail, etc.) bind business data to presentation state correctly and offline; Release 1 faithfulness contract verified (no fabrication, empty collections remain empty). |
| Integration | `integration/framework-compatibility.test.js` | The Shared Workspace Framework composes the library correctly: supporting panels reuse **Panel Section**, primary content and context ribbon reuse **Surface**, across the renderer, template, and stylesheet, with the component CSS layer ordered before the framework layer. |
| Integration | `integration/walkthrough-state-binding.test.js` | The Walkthrough Workspace consumes business data exclusively through the Shared Audit State, composes the Framework and Presentation System, renders faithfully from current demo JSON, and follows the state/router event contracts. |

## Adding a suite

Drop a `*.test.js` file into `smoke/`, `unit/`, or `integration/`. The runner
discovers it automatically — no runner edit, no migration. A suite module
exports a single `register(harness)` function that registers cases with
`harness.test(name, fn)` and asserts with `harness.assert` (Node's strict
`assert`):

```js
module.exports = function register(harness) {
  harness.test('does the thing', function () {
    harness.assert.ok(true);
  });
};
```

## Design

The suites are built on small, reusable helpers so future component, workspace,
and CSS issues extend the foundation instead of re-deriving it:

- `lib/harness.js` — a minimal `test(name, fn)` collector over `node:assert`.
- `lib/prototype.js` — prototype access: `readText` for source files;
  `loadClassicScript` / `loadComponentLibrary` to execute the prototype's
  classic (window-scoped) scripts in a `node:vm` sandbox and read what they
  registered; `toHostArray` to normalize sandbox arrays into this realm before
  deep comparison; `SCRIPTS` path constants.
- `lib/css.js` — stylesheet-contract helpers (`readCss`, `definesSelector`,
  `findHexColors`, `findColorFunctions`, `findImports`, `hasReducedMotionGuard`)
  so every CSS-owning issue asserts the Design-Token-only and reduced-motion
  contracts the same way.
- `run-tests.js` — discovers suites by category, runs each against a fresh
  harness, and reports the aggregate result.

The suites treat the registry (`component-library.js`), the stylesheet
(`css/components.css`), and the canonical gallery (`component-library.html`) as
three sources of truth that must stay in sync; a component is considered
"present" only when all three agree.

The browser-side validation foundation is the complement of this offline layer:
`prototype/tools/lib/validation.js` holds the reusable Playwright helpers
(browser resolution, `file://` targeting, console/asset collection, landmark
checks, responsive capture, PASS/FAIL summary) that `prototype/tools/validate.js`
composes, so future validation scripts reuse them rather than duplicating
launch and reporting logic.
