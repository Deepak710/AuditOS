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

## Registered components (16)

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
| Toolbar Group | `.aos-toolbar-group` | Layout |
| Action Group | `.aos-action-group` | Layout |
| Empty State | `.aos-empty-state` | State |
| Loading State | `.aos-loading-state` | State |
| Skeleton | `.aos-skeleton` | State |

## Dependency graph

```text
variables.css  (Design Tokens)
    └── components.css  (Component Library — all 16 primitives)
            └── workspace-framework.css / .js
                    ├── Surface        → primary content, context ribbon
                    └── Panel Section  → the three supporting panels

index.html
    └── component-library.js  (registry catalog; no runtime dependents yet)
```

- The library depends only on the Design Token Foundation.
- The Shared Workspace Framework is the first consumer and reuses Surface and
  Panel Section rather than duplicating surface chrome.
- The registry catalog is a pure, side-effect-free classic script.
