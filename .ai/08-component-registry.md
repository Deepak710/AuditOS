# Component Registry

The single approved catalog of reusable UI components. No workspace may invent
duplicate UI primitives — reuse a component here, or extend the library.

- **Definition (CSS):** `prototype/css/components.css` (component layer of the
  CSS architecture; consumes only `prototype/css/variables.css`).
- **Catalog (JS):** `prototype/components/component-library/component-library.js`
  → `window.AuditOS.componentLibrary` (`findById`, `findByCategory`).
- **Markup reference:** `prototype/components/component-library/component-library.html`.
- **Docs:** `prototype/components/component-library/README.md`.
- **Governing spec:** `docs/09-components/01-component-architecture.md` (Chapter 74).

All components are presentation only: they never touch `AuditOS.state` or
demo-data and hold no business or workflow logic. Every component consumes
Design Tokens only and supports keyboard navigation, responsive layouts, and
reduced motion.

## Registered components (25)

| Component | Class | Category |
|-----------|-------|----------|
| Surface | `.aos-surface` | Foundation |
| Card | `.aos-card` | Foundation |
| Section | `.aos-section` | Foundation |
| Panel Section | `.aos-panel-section` | Foundation |
| Divider | `.aos-divider` | Foundation |
| KPI Tile | `.aos-kpi-tile` | Data display |
| Status Badge | `.aos-status-badge` | Data display |
| Chip | `.aos-chip` | Data display |
| Property Row | `.aos-property-row` | Data display |
| Property Grid | `.aos-property-grid` | Data display |
| Metadata List | `.aos-metadata-list` | Data display |
| Progress | `.aos-progress` | Data display |
| Item List | `.aos-item-list` | Data display |
| Timeline | `.aos-timeline` | Data display |
| Data Grid | `.aos-data-grid` | Data display |
| Entity Card | `.aos-entity-card` | Data display |
| Activity Feed | `.aos-activity-feed` | Data display |
| Inspector | `.aos-inspector` | Data display |
| Button | `.aos-button` | Input |
| Toolbar Group | `.aos-toolbar-group` | Layout |
| Action Group | `.aos-action-group` | Layout |
| Master–Detail | `.aos-master-detail` | Layout |
| Empty State | `.aos-empty-state` | State |
| Loading State | `.aos-loading-state` | State |
| Skeleton | `.aos-skeleton` | State |

The Enterprise Data Presentation System (Issue #18) adds 5 new composite
components — Data Grid, Master–Detail, Inspector, Activity Feed, Entity Card —
that compose the 20 primitives to render JSON configuration into reusable
layouts. Every workspace uses the same builders instead of reimplementing
presentation logic.

Notable sub-parts added alongside the Home workspace (Issue #15): Section's
`__eyebrow` kicker line; Item List's `--critical` row variant (dominant
prioritized row, tone still carried by glyph + text, never color alone);
Card's `--interactive` hover gained a subtle token-mixed brand tint; Panel
Section's `__header` gained a recessed workspace-surface background; Action
Group collapses when empty.

## Dependency graph

```text
variables.css  (Design Tokens)
    └── components.css  (Component Library — all 20 primitives)
            └── workspace-framework.css / .js
                    ├── Surface        → primary content, context ribbon
                    │                     (opt-out via data-canvas="flush")
                    └── Panel Section  → the three supporting panels
            └── home.css / .js (AuditOS Home workspace)
                    ├── Section, Card              → resume cards, KPI band
                    ├── Panel Section, Item List    → signals, urgent work
                    ├── Timeline, Metadata List      → calendar, related info
                    ├── Empty State, Loading State   → every §15.12 state
                    └── Button, Action Group         → quick actions

index.html
    └── component-library.js  (registry catalog; consumed by workspace-framework
                                and home renderers)
```

- The library depends only on the Design Token Foundation.
- The Shared Workspace Framework is the first consumer and reuses Surface and
  Panel Section rather than duplicating surface chrome.
- AuditOS Home (Issue #15) is the first business-workspace consumer: every
  section is a declarative view-model descriptor rendered through generic
  builders over these primitives — no bespoke business UI.
- The registry catalog is a pure, side-effect-free classic script.
