# AI Implementation Context

## Purpose
This document is the primary implementation context for AI coding agents working on AuditOS Release 1.

Read this document first for every implementation issue. Read additional documentation only when explicitly referenced by the GitHub issue.

---

# Product Principles

- Documentation is the source of truth.
- One GitHub issue = one architectural concern.
- Reuse existing implementation.
- Never invent architecture.
- Stop when documentation and implementation conflict.

---

# Technology Constraints

Allowed:
- HTML
- CSS
- Vanilla JavaScript
- Local Bootstrap
- Static JSON
- Static Assets

Forbidden:
- React
- Angular
- Vue
- Backend
- Database
- APIs
- Authentication
- AI implementation
- Build pipelines

Entrypoint:

`prototype/index.html`

Always validate using:

`file:///.../prototype/index.html`

Never assume localhost.

---

# CSS Layers

1. variables.css (Design Tokens)
2. layout.css (Application Shell)
3. Component CSS
4. Workspace CSS

---

# Ownership Rules

Modify only:

- Primary Ownership
- Conditional Ownership

Treat all other files as read-only unless the GitHub issue explicitly expands ownership.

---

# Implementation Rules

- Read only the documentation referenced by the issue.
- Inspect only owned files and direct dependencies.
- Reuse existing components.
- No speculative implementation.
- Keep foundations structure-only until a later issue owns content.

---

# Rendering Foundation

The Shared Workspace Framework (`prototype/components/workspace-framework/`)
is the canonical rendering engine of AuditOS.

- `workspace-framework.js` renders the Universal Workspace Structure
  (Workspace Design System §15.3) into the active workspace host on every
  route change, driven by the router's public `auditos:route-changed` event.
- `workspace-framework.html` is the canonical template the renderer mirrors.
- `workspace-framework.css` owns the enterprise design language of the
  workspace surface: token-based spacing rhythm, typography-first hierarchy,
  bordered card surfaces, responsive collapse, and reduced-motion-safe
  animation.

Rules:

- Every future workspace inherits this framework. Workspaces populate its
  `data-slot` mount points; they never re-invent the page structure.
- The framework owns layout only. No workspace may hardcode business content.
- The Workspace Host canvas is the single scroll surface; the framework flows
  inside it.
- AI regions are reserved presentation surfaces only. AI remains advisory;
  human approval remains mandatory.

---

# Demo Data (Canonical)

`prototype/demo-data/` is the canonical Release 1 simulated SharePoint
structure — the static stand-in for the SharePoint libraries and lists of the
eventual implementation target.

- Business data belongs exclusively to demo-data. Workspaces bind to it;
  they never embed business content in markup, CSS, or scripts.
- Root JSON files hold cross-engagement collections (companies, engagements,
  business units, teams, POCs, control library, framework mappings).
- Per-engagement folders (`controls/`, `evidence/`, `findings/`, `reports/`,
  `requests/`, `requirements/`, `samples/`, `testing/`) hold one JSON document
  per engagement (e.g. `nimbus-soc2-2026.json`), simulating per-engagement
  SharePoint document libraries.
- Demo-data is read-only for implementation issues unless a GitHub issue
  explicitly grants ownership.
- Every per-engagement domain, including `reports/`, has a root manifest and
  uses the same dataset file naming (e.g. `reports/nimbus-soc2-2026.json`).
- `demo-data/demo-data.js` is the GENERATED classic-script projection of the
  canonical JSON (`AuditOS.demoDataBundle`), loaded via a script tag so the
  Shared Audit State behaves identically under file:// and http(s), fully
  offline. Never edit it by hand. After any demo-data change, regenerate it:
  `node prototype/tools/generate-demo-data-bundle.js`.
- Only the Shared Audit State store consumes the bundle. All other components
  consume `AuditOS.state`; none may read demo-data files or the bundle
  directly.

---

# Shared Audit State (Runtime Foundation)

`prototype/js/state/` is the runtime state layer — the single source of truth
for runtime application data (Shared Audit State, Chapter 9; Shared Audit
State Model, Chapter 45).

- `demo-data-registry.js` is the structural catalog of demo-data collections
  (identifier, scope, path, records key, id key). No behavior, no business
  data.
- `state-store.js` (`window.AuditOS.state`) loads demo-data exactly once,
  deep-freezes that baseline, and maintains a runtime in-memory working copy
  behind a framework-agnostic API: read (documents, records, datasets),
  simulated write (create/update/remove — runtime memory only, never
  persisted), reset (restore baseline), and publish/subscribe state events
  (`auditos:state-loaded`, `auditos:state-changed`, `auditos:state-reset`)
  via the store's own subscribe mechanism, not DOM events.
- The bootstrap (`js/main.js`) initializes the state before the router.

Rules:

- Workspaces and components read runtime business data only through
  `AuditOS.state` and mutate it only through the simulated write API. Reads
  return defensive copies; direct state mutation is impossible by design.
- The store loads from the generated demo-data bundle
  (`demo-data/demo-data.js`), never via fetch, so behavior is identical
  under file:// and http(s): fully offline, no network, no localhost.
  Consumers cannot tell how the data was loaded.
- Governance and approval flows are NOT implemented; the simulated write API
  is the mechanical substrate later governance issues build in front of.
  AI remains advisory; human approval remains mandatory.

---

# Shared Enterprise Component Library (Presentation Foundation)

`prototype/css/components.css` and `prototype/components/component-library/`
are the Shared Enterprise Component Library — the single approved source of
reusable, presentation-only UI primitives (Component Architecture, Chapter 74;
Layout Components, Chapter 75). Every workspace composes its interface from
these components; no workspace may invent duplicate UI primitives.

- `css/components.css` owns the visual definition of all sixteen components —
  Surface, Card, Section, Panel Section, Divider (foundation); KPI Tile, Status
  Badge, Chip, Property Row, Property Grid, Metadata List (data display);
  Toolbar Group, Action Group (layout); Empty State, Loading State, Skeleton
  (state, §15.12). It occupies the component layer of the CSS architecture
  (variables → layout → components → workspace), imported by `css/main.css`
  after `layout.css` and before the workspace stylesheets, and consumes only
  the Design Token Foundation (`variables.css`).
- `components/component-library/component-library.js`
  (`window.AuditOS.componentLibrary`) is the authoritative catalog of the
  components — identifier, name, category, base class, description — with
  `findById` / `findByCategory` lookups. It is a pure, side-effect-free
  registry loaded as a classic script; the components themselves are CSS.
- `components/component-library/component-library.html` is the canonical,
  accessible markup reference each workspace copies component structure from.
  `components/component-library/README.md` documents the library.

Rules:

- Components are presentation only. They never read or write `AuditOS.state`,
  never read demo-data, and hold no business or workflow logic. Business data
  belongs to demo-data; runtime data is read only through `AuditOS.state`.
- Every component consumes Design Tokens only and supports keyboard navigation,
  responsive layouts, and reduced motion; status is never encoded by color
  alone.
- The Shared Workspace Framework is the first consumer and reuses the library
  rather than duplicating surface chrome: its supporting panels are Panel
  Section components and its primary content and context ribbon are Surface
  components. Future workspaces extend the library through composition, never
  by recreating primitives.

Governing specification: `docs/09-components/01-component-architecture.md`
(Chapter 74 — Component Architecture) is the permanent architectural document
for the Component Library. GitHub Issue #14's Documentation Manifest referenced
this as `docs/09-components/01-component-principles.md`, which does not exist in
the repository; the correct permanent document is `01-component-architecture.md`.

---

# Implementation Status

Completed foundations, in order:

1. Design Token Foundation (`variables.css`).
2. Application Shell (`layout.css`, `index.html` landmarks).
3. Global Header, Left Navigation, Right Context Panel, Workspace Host
   (structural components).
4. Static Routing Foundation (registry, router, bootstrap).
5. Navigation Content (registry-driven destinations).
6. Shared Workspace Rendering Foundation and enterprise design language
   (framework renderer, template, stylesheet).
7. Shared Audit State Foundation (`js/state/` — demo-data registry, state
   store, bootstrap integration).
8. Shared Enterprise Component Library (`css/components.css`,
   `components/component-library/` — sixteen token-driven, presentation-only UI
   primitives and their registry; reused by the Shared Workspace Framework).

The prototype renders the universal workspace skeleton for every registered
workspace, maintains a runtime Shared Audit State loaded from demo-data, and
provides a Shared Enterprise Component Library that workspaces compose from.
Workspace content, business bindings, workspace states, and business
workflows remain owned by later issues. No business content is implemented.

---

# Validation

Two layers validate the prototype:

- Offline source contracts — `node prototype/tests/run-tests.js` runs the
  Smoke, Unit, and Integration suites (Node standard library only; no browser,
  no network). Suites are auto-discovered from
  `prototype/tests/{smoke,unit,integration}/` and share reusable helpers in
  `prototype/tests/lib/` (`prototype.js` script/file access, `css.js`
  stylesheet contracts, `harness.js`). Add a suite by dropping a `*.test.js`
  into a category directory — no runner edit.
- Browser validation — `node prototype/tools/validate.js` renders
  `prototype/index.html` in headless Playwright and checks the live DOM and
  console. Its reusable steps (Playwright resolution, `file://` targeting,
  console/asset collection, landmark checks, responsive capture, PASS/FAIL
  summary) live in `prototype/tools/lib/validation.js` for future validation
  scripts to compose.

Do NOT:

- install Playwright
- install Chrome
- search npm cache
- diagnose browser availability

Only report PASS/FAIL. Expand details only on failure.

---

# Integrated Maintenance

Fix a pre-existing issue only when:

- it belongs to the architecture owned by the current issue
- it is fully understood
- it does not expand scope

Otherwise report it.

---

# Completion Report

Return only:

- Documentation Synchronization
- Integrated Maintenance (if applicable)
- Repository Drift Check
- Validation
- Commit Summary
- Commit Description

Keep reports concise.

---

# Commit Workflow

Implementation
→ Validation
→ Documentation Synchronization
→ Integrated Maintenance
→ Repository Drift Check
→ Prepare Commit
→ User Approval
→ Commit

Do not suggest future issues.

The Technical Lead determines the next GitHub issue.