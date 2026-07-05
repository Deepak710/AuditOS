# Left Navigation Component

Reusable structural navigation for the AuditOS Application Shell.

Mounted inside the shell's navigation region — the semantic
`<nav class="aos-navigation" aria-label="Primary navigation">` landmark in
`prototype/index.html`. Styled by `prototype/css/navigation.css` using the
Design Token Foundation (`prototype/css/variables.css`).

## Scope

Five structural regions. The **primary-navigation** region is populated at
runtime by `navigation.js` with the workspace destinations; the brand,
secondary, utility, and collapse regions remain empty for later issues. It owns
no workspace content, Shared Audit State, Business Objects, or business logic.

## Regions

| Region | Class | Reserved for |
|--------|-------|--------------|
| Brand | `.aos-nav__brand` | AuditOS brand mark / product wordmark |
| Primary navigation | `.aos-nav__primary` | Primary workspace destinations |
| Secondary navigation | `.aos-nav__secondary` | Secondary destinations (e.g. administration, settings) |
| Bottom utility | `.aos-nav__utility` | Persistent utility / account area |
| Collapse placeholder | `.aos-nav__collapse` | Future collapse / expand control |

The regions stack as a vertical column. `.aos-nav__primary` grows to consume
free space and scrolls independently; the other regions keep their intrinsic
height. A collapsed structural state pairs with the shell-level
`.aos-shell--nav-collapsed` class defined in `prototype/css/layout.css`.

## Content and routing

`navigation.js` connects the navigation to the Static Routing Foundation. On
load it renders one destination per registered workspace — in registry order —
into the primary-navigation region, then keeps the active destination in step
with the current route.

- **Destinations come from the registry.** Labels and paths are read from
  `window.AuditOS.workspaceRegistry`; they are never redefined here, so there is
  a single source of workspace identity.
- **The router performs navigation.** Each destination is an anchor whose
  `href` is the canonical route hash (`#/{path}`). Selecting one changes the
  hash, and the router's existing `hashchange` flow resolves the route, renders
  the host, manages focus, and announces the change.
- **Active state follows the route, not the click.** The active destination is
  marked with `aria-current="page"` and the `is-active` class in response to the
  router's `auditos:route-changed` event, and synced to the resolved route on
  init — so deep links and Back/Forward stay reflected.

The script loads after the application bootstrap so the router has resolved the
initial route first. It exposes `window.AuditOS.navigation.init()`.

## Usage

No component loader or build step exists in the prototype yet, so the markup in
`navigation.html` is embedded directly inside the shell's navigation region in
`index.html`. `navigation.html` is the canonical source for that markup; keep
the two in sync until a loader exists.
