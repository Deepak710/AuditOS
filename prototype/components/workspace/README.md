# Workspace Host Component

Reusable structural workspace host for the AuditOS Application Shell.

Mounted inside the shell's workspace region — the semantic
`<main class="aos-workspace" aria-label="Workspace">` landmark in
`prototype/index.html`. Styled by `prototype/css/workspace.css` using the
Design Token Foundation (`prototype/css/variables.css`).

## Scope

This is a **foundation**: structure only. It defines the permanent regions and
state placeholders that host the active workspace. It contains no page content,
breadcrumbs, page title, toolbar, tabs, filters, business objects, routing,
business logic, or JavaScript. It is the final permanent region of the shell —
the surface that later workspace issues render into.

## Regions

| Region | Class | Reserved for |
|--------|-------|--------------|
| Workspace header | `.aos-workspace-host__header` | Breadcrumbs, page title, workspace toolbar, workspace actions |
| Workspace body | `.aos-workspace-host__body` | Primary operational canvas that hosts the active workspace |
| Workspace footer | `.aos-workspace-host__footer` | Persistent workspace footer / status bar |
| Empty placeholder | `.aos-workspace-host__empty` | Workspace empty state (explanation, primary action, guidance) |
| Loading placeholder | `.aos-workspace-host__loading` | Workspace loading skeleton |

The regions stack as a vertical column. `.aos-workspace-host__body` grows to
consume free vertical space and scrolls independently; the header and footer
keep their intrinsic height. The empty and loading placeholders are reserved
workspace-state scaffolds (see Design System §15.12) that live inside the body;
later work toggles between them and the ready state. This foundation defines no
state behavior — every region renders empty.

The body carries `id="workspace-canvas"`, so the shell's skip link
(`Skip to main content`) jumps straight to the primary content region.

## Usage

No component loader or build step exists in the prototype yet, so the markup in
`workspace-host.html` is embedded directly inside the shell's workspace region
in `index.html`. `workspace-host.html` is the canonical source for that markup;
keep the two in sync until a loader exists.
