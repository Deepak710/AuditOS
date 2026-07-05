# Locked Architecture Decisions

- Documentation is the source of truth.
- Single application shell.
- Persistent navigation/header/right panel.
- Static HTML/CSS/JS + local Bootstrap only.
- No backend, AI, database or build tools.
- Reusable UI is centralized in one Shared Enterprise Component Library
  (`prototype/css/components.css` + `components/component-library/`); workspaces
  compose from it and never invent duplicate presentation primitives.
