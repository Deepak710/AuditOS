# Shared Workspace Framework

The reusable internal page layout inherited by every AuditOS workspace.

Where the [Workspace Host](../workspace/README.md) is the shell-level mount —
the `<main class="aos-workspace">` region of the Application Shell — the Shared
Workspace Framework is the **page skeleton a workspace fills inside that host's
canvas** (`<div id="workspace-canvas" class="aos-workspace-host__body">`). Styled
by `prototype/css/workspace-framework.css` using the Design Token Foundation
(`prototype/css/variables.css`).

It implements the Universal Workspace Structure of the Workspace Design System
(§15.3) so that every workspace — present and future — inherits the same
internal structure rather than inventing its own.

## Scope

This is a **foundation**: structure only. It defines the permanent internal
regions of a workspace page and their responsive behavior. It contains no
workspace content, business objects, headings, ribbon items, panel content,
actions, routing, business logic, or JavaScript.

It is a reusable **template**, not a mounted instance. No workspace exists yet
to inherit it, so — unlike the shell foundations — it is intentionally not
embedded in `index.html`; later workspace issues render it into the workspace
canvas.

## Regions

| Region | Class | Reserved for |
|--------|-------|--------------|
| Workspace header | `.aos-workspace-framework__header` | Workspace name, client, engagement, audit period, phase, status, actions, search, AI availability (§15.4) |
| Context ribbon | `.aos-workspace-framework__ribbon` | Operational context that travels with the user — current control, reviewer, outstanding evidence, pending approvals, risk level (§15.5) |
| Primary content | `.aos-workspace-framework__content` | The operational focus of the workspace (§15.6) |
| Supporting panels | `.aos-workspace-framework__panels` | Band of persistent secondary panels (§15.7) |
| — Related information | `.aos-workspace-framework__related` | Related business objects and the relationship graph (§15.9) |
| — AI recommendations | `.aos-workspace-framework__ai` | Contextual AI recommendations, explanations, insights (§15.8) |
| — Activity | `.aos-workspace-framework__activity` | Contextual timeline / activity feed (§15.10) |
| Footer / status | `.aos-workspace-framework__footer` | Persistent workspace footer / status region |

The regions stack as a vertical column. `.aos-workspace-framework__content`
dominates the layout — it grows to consume free vertical space and scrolls
independently so supporting information never competes with the primary task;
the header, ribbon, panels, and footer keep their intrinsic height. The
supporting panels arrange as three equal columns that collapse to a single
stacked column at the tablet breakpoint.

Operational states (Empty, Loading, Ready, Updating, Error — §15.12) are hosted
by the Workspace Host's reserved state placeholders; this framework defines no
state behavior.

## Usage

No component loader or build step exists in the prototype yet. `workspace-framework.html`
is the canonical source for the framework markup; later workspace issues render
it into the workspace canvas. Its stylesheet is registered through the
stylesheet entry point (`prototype/css/main.css`).
