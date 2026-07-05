# Static Routing Foundation

The navigation backbone of the AuditOS static prototype.

Implements the Routing Architecture (`docs/15-implementation-guide/04-routing.md`,
Chapter 130) for the static prototype. Its single responsibility is to switch
between empty placeholder **Workspace Hosts** — it renders no workspace content,
navigation UI, Shared Audit State, or business logic.

## Scope

This is a **foundation**: routing only. It resolves the browser hash to a
registered workspace, renders that workspace's empty host into the workspace
canvas, keeps the URL synchronized for deep linking and browser history, and
announces the change to assistive technology. Navigation is implemented before
page logic and stays separate from it (§130.29).

## Files

| File | Responsibility |
|------|----------------|
| `workspace-registry.js` | Authoritative list of registered workspace identities (id, path, label, title) and lookups. No behavior. |
| `router.js` | Router engine: hash resolution, host rendering, URL synchronization, fallback, focus management, and the route-changed event. |

The application bootstrap (`prototype/js/main.js`) initializes the router after
the DOM is ready. All three load as classic `<script>` tags from
`prototype/index.html`, in dependency order (registry → engine → bootstrap), so
the prototype runs directly from `file://` with no build step, module loader, or
dynamic imports.

## Registered workspaces

Placeholder hosts only, in navigation-hierarchy order (§130.5): Dashboard,
Engagement, Walkthrough, Controls, Evidence, Testing, Findings, Reporting,
Governance, AI Workspace, Executive Dashboard. Dashboard is the default route.

## Routing model

- **Hash routes** are namespaced `#/{path}` (e.g. `#/controls`). The namespace
  lets the router distinguish a route from an ordinary in-page anchor such as
  the shell's `#workspace-canvas` skip link, which it leaves untouched.
- **Default route** — an empty root resolves to the Dashboard.
- **Unknown routes** fall back to the Dashboard, and the URL is normalized to
  the canonical route via `history.replaceState`, so Back never returns to the
  bad URL.
- **Browser Back/Forward** work because every navigation flows through a single
  `hashchange` handler.

## Rendering & accessibility

The router renders the active workspace into a router-owned outlet placed inside
`#workspace-canvas`, the shell's primary content region and skip-link target, so
skip-link continuity is preserved. Each host is an accessible `role="region"`
landmark labelled with the workspace name. On genuine route changes the router
moves focus into the new host and announces it through a visually hidden
`aria-live` region; the initial page load leaves focus at the top of the
document so the skip link remains the entry point.

## Public API

`window.AuditOS.router`

| Member | Description |
|--------|-------------|
| `init()` | Wires the router to the shell and renders the initial route. Called by the bootstrap. |
| `navigate(workspaceId)` | Navigates to a registered workspace by identifier. Unknown identifiers are ignored. |
| `getCurrentWorkspaceId()` | Returns the active workspace identifier. |
| `ROUTE_CHANGED_EVENT` | Name of the `document` event (`auditos:route-changed`) dispatched on every route change. |

`window.AuditOS.workspaceRegistry` exposes the workspace identifiers, the
registry, the default identifier, and `findById` / `findByPath` lookups.
