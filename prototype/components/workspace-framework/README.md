# Shared Workspace Framework

The permanent rendering foundation inherited by every AuditOS workspace.

Where the [Workspace Host](../workspace/README.md) is the shell-level mount —
the `<main class="aos-workspace">` region of the Application Shell — the Shared
Workspace Framework is the **page skeleton rendered inside that host's canvas**
(`<div id="workspace-canvas" class="aos-workspace-host__body">`) on every route
change. It implements the Universal Workspace Structure of the Workspace Design
System (§15.3) so that every workspace — present and future — inherits the same
internal structure rather than inventing its own. Styled by
`prototype/css/workspace-framework.css` using only the Design Token Foundation
(`prototype/css/variables.css`).

## Scope

The framework **owns layout only**. It renders the permanent internal regions
of a workspace page, their enterprise design language, and their responsive
behavior. Every slot it renders is an empty, reserved mount point for later
workspace issues.

It composes the [Shared Enterprise Component Library](../component-library/README.md)
rather than duplicating surface chrome: the primary content and context ribbon
are **Surface** components (`.aos-surface`) and the three supporting panels are
**Panel Section** components (`.aos-panel-section`). The framework stylesheet
keeps only the framework-specific layout (vertical rhythm, growth, the
supporting-panels grid, reserved minimums, `:empty` collapse, the enter
animation, and responsive collapse). It contains no business content, business objects, ribbon
items, panel content, actions, or routing — business data belongs exclusively
to `prototype/demo-data`, and no workspace may hardcode business content. AI
surfaces rendered by the framework are reserved presentation regions only: AI
remains advisory, and human approval remains mandatory.

The only text the framework populates is the workspace title (from the
Workspace Registry — navigation identity, not business content) and the fixed
structural titles of the universal supporting panels (§15.7–§15.10), which are
identical in every workspace.

## Files

| File | Responsibility |
|------|----------------|
| `workspace-framework.html` | Canonical template for the framework markup. Mirrored exactly by the renderer; keep the two in sync. |
| `workspace-framework.js` | The rendering engine. Builds the framework skeleton and renders it into the active workspace host on every route change. |
| `../../css/workspace-framework.css` | Enterprise design language, layout, responsive behavior, and motion for the framework regions. |

## Regions and slots

| Region | Class | Slot(s) | Reserved for |
|--------|-------|---------|--------------|
| Workspace header | `.aos-workspace-framework__header` | `workspace-eyebrow`, `workspace-title`, `workspace-meta`, `workspace-actions` | Client / engagement / audit period (eyebrow), workspace name (title, populated), phase / status (meta), global actions / search / AI availability (§15.4) |
| Context ribbon | `.aos-workspace-framework__ribbon` | `context-ribbon` | Operational context that travels with the user — current control, reviewer, outstanding evidence, pending approvals, risk level (§15.5) |
| Primary content | `.aos-workspace-framework__content` | `primary-content` | The operational focus of the workspace (§15.6) |
| Supporting panels | `.aos-workspace-framework__panels` | — | Band of three universal titled panel cards (§15.7) |
| — Related information | `.aos-workspace-framework__related` | `related-information` | Related business objects and the relationship graph (§15.9) |
| — AI recommendations | `.aos-workspace-framework__ai` | `ai-recommendations` | Contextual AI recommendations, explanations, insights — advisory only (§15.8) |
| — Activity | `.aos-workspace-framework__activity` | `activity` | Contextual timeline / activity feed (§15.10) |
| Footer / status | `.aos-workspace-framework__footer` | `workspace-footer` | Persistent workspace footer / status region |

The regions stack as a single vertical column with one consistent spacing
rhythm. `.aos-workspace-framework__content` dominates the layout — it grows to
consume free vertical space so supporting information never competes with the
primary task. Reserved regions that are still empty (ribbon, footer, header
eyebrow / meta / actions) collapse via `:empty`, so the page stays clean until
later issues populate them.

## Rendering strategy

`workspace-framework.js` is the canonical rendering engine:

- **The router remains the source of truth.** The renderer listens for the
  router's public `auditos:route-changed` event and syncs to the resolved
  route on init. It performs no routing, focus management, or announcements —
  the Static Routing Foundation is untouched and continues to own all of that.
- **The framework fills the host; it never creates it.** On each route change
  the router renders an empty `.aos-workspace-view` host; the framework
  renders the universal skeleton into that host.
- **Reusable API.** `window.AuditOS.workspaceFramework.render(hostElement,
  workspace)` mounts the skeleton into any workspace surface, so later
  workspace issues reuse one renderer instead of duplicating markup.
- **Slots, not pages.** Future workspaces populate the framework's `data-slot`
  mount points; they never re-invent the page structure.

## Design language

The framework establishes the enterprise design language of the product
surface (Visual Design System, Chapter 17): typography-first hierarchy
(eyebrow / title / meta), calm bordered card surfaces on the workspace canvas
instead of decorative color, a mathematically consistent token-based spacing
rhythm, hairline rules for structure, and a subtle enter animation
(`--aos-duration-normal`) that collapses to 0ms under
`prefers-reduced-motion`. Dark mode is inherited automatically from the token
foundation.

**Scroll architecture:** the Workspace Host canvas remains the single scroll
surface. The framework flows inside it and stretches the router's outlet /
view chain to full canvas height (a layout-only mount chain in
`workspace-framework.css`), so the footer anchors to the canvas base and no
nested scrollbars compete with the primary task.

**Accessibility:** the workspace title is the page `<h1>`; each supporting
panel is a labelled `<section>` with an `<h2>` title; the ribbon is a labelled
`role="group"`. Focus and route announcements remain owned by the router.

**Responsive behavior:** the supporting panels collapse from three equal
columns to a single stacked column at the shell's tablet breakpoint (1024px);
spacing tightens, and at the mobile breakpoint (640px) the header stacks and
the title steps down one size.

Operational states (Empty, Loading, Ready, Updating, Error — §15.12) are
hosted by the Workspace Host's reserved state placeholders; this framework
defines no state behavior.

## Usage

The framework is registered in `prototype/index.html` as a classic script that
loads after the application bootstrap, so the initial route is resolved before
the first render. Its stylesheet is registered through the stylesheet entry
point (`prototype/css/main.css`). `workspace-framework.html` remains the
canonical template for the structure the renderer produces.
