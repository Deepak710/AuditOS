# Left Navigation Component

Reusable structural navigation for the AuditOS Application Shell.

Mounted inside the shell's navigation region — the semantic
`<nav class="aos-navigation" aria-label="Primary navigation">` landmark in
`prototype/index.html`. Styled by `prototype/css/navigation.css` using the
Design Token Foundation (`prototype/css/variables.css`).

## Scope

This is a **foundation**: structure only. Five empty regions that later issues
populate. It contains no menu items, icons, labels, routing, business logic, or
JavaScript.

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

## Usage

No component loader or build step exists in the prototype yet, so the markup in
`navigation.html` is embedded directly inside the shell's navigation region in
`index.html`. `navigation.html` is the canonical source for that markup; keep
the two in sync until a loader exists.
