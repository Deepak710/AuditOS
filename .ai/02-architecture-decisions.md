# Locked Architecture Decisions

- Documentation is the source of truth.
- Single application shell.
- Persistent navigation/header/right panel.
- Static HTML/CSS/JS + local Bootstrap only.
- No backend, AI, database or build tools.
- Reusable UI is centralized in one Shared Enterprise Component Library
  (`prototype/css/components.css` + `components/component-library/`); workspaces
  compose from it and never invent duplicate presentation primitives.
- The Dashboard is permanently renamed AuditOS Home (`prototype/js/workspaces/home.js`)
  — the operating-system landing experience, not a reporting dashboard. Stable
  identifier/route (`dashboard`) unchanged.
- Every workspace renders via Business Objects → View Model → Component
  Library → Renderer → DOM. The view model is a declarative list of section
  descriptors (`{ id, kind, items, empty, ... }`); the renderer dispatches
  each descriptor's `kind` to a generic, reusable body builder over Component
  Library primitives. No workspace builds business UI directly.
- Workspaces may opt their framework content region out of the bordered
  Surface chrome via `data-canvas="flush"` (`prototype/css/workspace-framework.css`)
  when their content is itself a composition of many sections.
- All business values render only through `AuditOS.state`; demo-data is
  never expanded, fabricated, or read directly by a workspace. A section or
  panel with no data renders an Empty State — never fabricated content.
