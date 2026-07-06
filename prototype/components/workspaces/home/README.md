# AuditOS Home Workspace

The operating-system landing experience of AuditOS — the renamed Dashboard
(GitHub Issue #15). Every authenticated session begins here. Home is not a
reporting dashboard; it is an operational surface built from the same
Shared Workspace Framework every workspace inherits, populated entirely from
the [Shared Audit State](../../../js/state/README.md).

## Scope

Home is **presentation only**. It reads business data exclusively through
`window.AuditOS.state`; it never reads `prototype/demo-data/` directly, never
fabricates records, and performs no writes. Runtime writes elsewhere in the
platform remain memory-only — Home simply re-renders when the state changes,
loads, or resets. Because every value flows through the state's read API, the
workspace cannot tell (and does not need to know) whether that data
originated from the generated demo-data bundle, a future SharePoint
integration, or an AI-authored recommendation — the read contract is
identical either way (Shared Audit State, Chapter 9 / Chapter 45).

## Files

| File | Responsibility |
|------|----------------|
| `../../../js/workspaces/home.js` | The renderer: collects a declarative view model from `AuditOS.state` and the Workspace Registry, then assembles it into the Shared Workspace Framework's reserved slots. |
| `../../../css/home.css` | Home-specific layout only (resume-card grid, KPI band, entity-card and signal-panel grids, ribbon/footer items). Composes Shared Enterprise Component Library primitives for all chrome; consumes only the Design Token Foundation. |
| `home.html` | The canonical structural reference. Mirrors the composition `home.js` builds; keep the two in sync. |

## Architecture: Business → ViewModel → Components → DOM

`home.js` is organized into four layers, in file order:

1. **Pure derivation helpers** — take plain records (engagements, evidence,
   findings, tests, requests, companies) and return plain view data. No DOM,
   no `AuditOS.state` access, so the offline unit suite exercises them
   directly.
2. **`collectViewModel(state, workspaceRegistry)`** — the single place Home
   reads the Shared Audit State. Returns a declarative description of the
   page: an ordered list of **section descriptors** (`{ id, kind, kicker,
   title, description, items, empty }`) plus ribbon, quick-action, panel, and
   footer data. Never touches the DOM.
3. **Generic component builders** — one function per Shared Enterprise
   Component Library primitive (Section, Card, Panel Section, Item List,
   Progress, Timeline, Metadata List, Empty State, Loading State, Button,
   Action Group). Reusable by any future workspace's descriptors, not
   Home-specific.
4. **`SECTION_BODIES`** — a descriptor-`kind` → body-builder dispatch table
   (`link-cards`, `items`, `kpis`, `entity-cards`, `panel-grid`). The renderer
   never assembles a section's markup by hand; it looks up the builder for
   the descriptor's kind.

No workspace-specific business UI is built directly — every visible surface
is a library component composed from view-model data.

## Sections

Home is organized into operating-system landing sections rather than
dashboard widgets. Each is a descriptor in `collectViewModel`'s `sections`
array; a section with no items and no `empty` descriptor is skipped entirely
(no blank region is ever rendered), and a section with items but none present
renders its `empty` Empty State instead of fabricating data.

| Section | Kind | Derives from |
|---------|------|--------------|
| Continue working | `link-cards` | Outstanding work across evidence, testing, findings, requests, and the report — one resume-task card per item that exists |
| Urgent work | `items` | High-severity open findings and rejected evidence (rendered as critical rows), then failed test procedures |
| Assigned to me | `items` | Engagements the current user leads or manages; tests they execute or review |
| Engagement overview | `kpis` | Controls, evidence, testing, and findings summaries for the current engagement |
| Clients | `entity-cards` | One card per company record: identity, risk, audit readiness, and that client's own engagements |
| Signals | `panel-grid` | Notifications and calendar milestones |

The universal framework panels (Related information, AI recommendations,
Activity) and the workspace header/ribbon/footer are populated from the same
view model but are not section descriptors — they map directly to the
[Shared Workspace Framework](../../workspace-framework/README.md)'s fixed
slots.

## Flush canvas

Home's content root carries `data-canvas="flush"`, opting the framework's
primary-content region out of its bordered Surface chrome (see the
[framework's flush-canvas contract](../../workspace-framework/README.md#flush-canvas-opt-in)).
Sections sit directly on the workspace surface — an operating-system canvas
of composed sections rather than one large card.

## Motion

Sections enter with the shared design-language rise animation
(`aos-rise-in`, staggered via `aos-rise-in--1/2/3` up to three steps) so the
page settles top-to-bottom; supporting panels fade in
(`aos-fade-in`). All durations come from the motion tokens, which collapse
under `prefers-reduced-motion`.

## AI surface

The AI recommendations panel is a reserved Empty State placeholder only. No
AI orchestration, recommendation engine, or advisory logic is implemented
here — AI remains advisory and human approval remains mandatory (Human
Approval Engine, Chapter 21).

## Explicitly out of scope

Per GitHub Issue #15, Home does not implement: dynamic breadcrumbs, a
navigation redesign, a Client or Engagement workspace, a context engine,
workspace schemas, a generic page renderer, or metadata-driven layouts. Those
begin in a later issue; Home's section descriptors are deliberately simple
and workspace-specific rather than a generalized rendering framework.

## Usage

`home.js` is registered in `prototype/index.html` as a classic script that
loads after the Shared Workspace Framework, so the framework's skeleton
exists before Home fills it. Its stylesheet is registered last in
`prototype/css/main.css`, after `workspace-framework.css`.
