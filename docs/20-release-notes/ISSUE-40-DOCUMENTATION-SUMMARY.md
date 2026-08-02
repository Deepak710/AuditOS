# Issue #40 Documentation Summary

## Overview

This document summarizes the documentation updates made to reflect the
implementation of **Issue #40: Controls & Testing Workspace Redesign + AI
Workpaper Foundation + Final Navigation UX**.

**Date Updated:** 2026-08-02

**Implementation Status:** Complete, with one scope note (see *Known gaps*).

**Documentation Status:** Complete — every chapter below was updated only after
the implementation matched it.

---

## What changed architecturally

Issue #40 added three things to the platform and rebuilt two workspaces on top
of them. Nothing was duplicated: each new capability lives in exactly one place
and every existing consumer was moved onto it.

### 1. A third application shell — `viewport`

`components/workspace-framework/workspace-framework.js` +
`css/workspace-framework.css`

The framework already had Single Pane and Split Pane shells. Issue #40 §12 adds
**Viewport**: a fixed frame in which the page never scrolls and the workspace's
own internal panes own every scrollbar. Where Split Pane reserves height with a
subtracted constant, Viewport propagates the *measured* remaining height down
the mount chain, so the space is correct at any zoom level, header height, or
viewport size. Controls, Testing, and Evidence all declare it.

### 2. A shared three-pane composition — `workbench`

`components/presentation/presentation.js` + `css/components.css`

Master–Detail with a third region — rail, canvas, operational inspector —
defined once, so no workspace assembles its own columns. Controls and Testing
both compose it.

### 3. The AI Workpaper Foundation

| Service | Responsibility |
| --- | --- |
| `js/services/workpaper-service.js` | The one model of a generated audit workpaper: twelve canonical sections, their editability, their per-section provenance, and the canonical lifecycle status. |
| `js/services/workbook-export.js` | The one `.xlsx` writer: SpreadsheetML parts inside a STORE-method ZIP with a real CRC-32. Zero dependencies. |
| `js/services/workpaper-export.js` | The two serializations of that one model — the self-contained HTML workpaper and the CSC-01 sheet mapping. |

The screen, the document, and the workbook all read the same model, so they
cannot disagree about what the workpaper says.

### Extended, not duplicated

* `js/services/evidence-lifecycle.js` gained a documented
  `WORKPAPER_STATUS_MAP`, so the testing vocabulary resolves through the **one**
  canonical lifecycle. Testing declares no status model of its own (§11).
* `js/services/ai-lineage-service.js` is now consumed by Controls and Testing as
  well as Evidence — its first use as genuinely reusable infrastructure (§10).
* `components/workspace-shared/workspace-shared.js` gained
  `buildSuggestionWorkflowCard`, **extracted** from the Evidence drawer so
  Testing's review workflow reuses one Suggested → Reviewed → Approved → Applied
  implementation. Evidence was moved onto it in the same change.
* `createRailSelection` / `mountRailGroups` gained an optional `onSelect` hook so
  a three-pane host can update two panes from one selection. Every existing
  two-pane consumer is unchanged.
* `dataGridRow` now stamps an optional `data-row-id`, so a consumer can
  re-select one row without rebuilding the table — and therefore without losing
  its scroll position.

---

## Documentation files updated

### 1. Navigation & Context Architecture (Chapter 65)

**File:** `docs/08-workspaces/14-hierarchical-routing-and-context.md`

§65.6 rewritten for Issue #40 §1. Breadcrumb dropdowns are now **peer
switchers** — a crumb's menu lists the other objects at its own level — which
makes "no breadcrumb may ever expose an unrelated object" structural rather than
a matter of care. AuditOS lost its dropdown and always returns Home. The
hierarchy levels (client, engagement, workspace) keep their switcher even as the
final crumb, while only record crumbs (Team, POC) are always plain — enforced
structurally once in `generate()` so it holds at every depth. The superseded
Issue #39 behaviour is called out explicitly, and §65.12 (Historical Context)
records the change. **Routing itself is unchanged.**

### 2. Controls Workspace (Chapter 65)

**File:** `docs/08-workspaces/05-controls-workspace.md`

The Release 1 status section now documents the three-pane viewport layout
(§2 / §12), the rail-scroll-preservation guarantee, the Controls ↔ Evidence
register (§7 — every evidence item as a row, never a count, with the real
control → requirement → evidence join), and generation provenance (§4 / §10).

### 3. Testing Workspace (Chapter 67)

**File:** `docs/08-workspaces/07-testing-workspace.md`

New chapter preamble: Testing is the generated audit workpaper, not a queue.
Documents the three panes, the twelve canonical sections, the
edit → suggestion → approval workflow (§5), and the canonical status model
(§11). New **§67.27 — The AI Workpaper Foundation** documents all three
services, the honesty contract, and the provenance rules in full.

### 4. Evidence Workspace (Chapter 66)

**File:** `docs/08-workspaces/06-evidence-workspace.md`

Documents the move to the viewport shell, the reduced chrome footprint with its
measured result (§8), and highlighted arrival from a Controls or Testing link.

### 5. Layout Components (Chapter 75)

**File:** `docs/09-components/02-layout-components.md`

§75.9 gained *Application Shells* and *Workbench* subsections.

### 6. Shared Workspace Framework README

**File:** `prototype/components/workspace-framework/README.md`

The three shells as a table, and the two scroll architectures — the flowing
canvas and the measured viewport chain — plus the note that the three-column
geometry belongs to the shared Workbench, not the framework.

---

## Validation

* **Offline suite:** `node prototype/tests/run-tests.js` — **879 passing, 0
  failing** (was 847 before this issue; +32 net).
  * New: `prototype/tests/unit/workpaper-foundation.test.js` — 22 cases across
    the workpaper model, provenance honesty, the ZIP/OOXML writer (including a
    CRC-32 check against the standard IEEE test vectors), and both
    serializations.
  * Extended: workspace-framework (shell resolution), presentation-components
    (workbench), navigation-breadcrumb (the §1 rules), controls-derivations and
    testing-derivations (the new pure derivations), controls-state-binding
    (three-pane render validation).
* **Repository validation:** `node prototype/tools/validate.js` — PASS, 0
  console errors, 0 failed assets.
* **Browser validation** against `file://prototype/index.html` at 1366×768:
  **49/49 checks, 0 console errors** — breadcrumb rules at every depth, all
  three viewport applications with zero page scroll, the twelve worksheet
  sections with twelve edit affordances and twelve provenance disclosures, a
  real ZIP/OOXML workbook, evidence deep-linking with a highlighted row, and a
  context-preservation sweep across every engagement workspace.

### Measured Evidence improvement (§8)

| Viewport | Visible rows before | Visible rows after |
| --- | --- | --- |
| 1366×768 | 1 | 6 |
| 1920×1080 | — | 14 |

Row height fell from 74px to 37px and the metrics band from 307px to 168px, with
no metric removed and the page still not scrolling.

---

## Known gaps

* **Reporting has no workspace module.** `#/…/reporting` is a registered route
  with no `js/workspaces/reporting.js` in the repository, so it renders the bare
  framework skeleton (header and an empty reserved content region). This is
  pre-existing and unchanged by Issue #40; the route keeps full four-level
  context. It is called out here because Issue #40 §9 names Reporting among the
  workspaces that must preserve context — which it does.
* **Release 2 remains Release 2.** §5's AI propagation (an applied change
  flowing back through walkthrough → evidence → controls → regenerated testing)
  is deliberately not implemented; Release 1 builds the UI and the workflow, as
  the issue specifies.
