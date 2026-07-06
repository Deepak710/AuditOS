# Shared Enterprise Component Library

The single approved source of reusable presentation components for AuditOS.

Every workspace — present and future — composes its interface from this
library instead of inventing duplicate UI primitives. It establishes the
permanent AuditOS enterprise component language: calm bordered surfaces instead
of decorative color, a token-based spacing rhythm, typography-first hierarchy,
information density, subtle purposeful motion, and accessibility built in.
Styled by [`css/components.css`](../../css/components.css) using only the
[Design Token Foundation](../../css/variables.css).

## Scope

The library is **presentation only**. Every component:

- consumes Design Tokens only (`--aos-*`); it declares no raw visual values,
- supports keyboard navigation, semantic structure, and color independence,
- supports responsive layouts,
- supports reduced motion (any animation collapses via the motion tokens).

Components **never**:

- read or write `AuditOS.state`,
- read `demo-data`,
- contain business logic,
- own workflow logic.

Business data belongs exclusively to `prototype/demo-data`; runtime data is
read only through `AuditOS.state`. Components render whatever markup a consumer
composes; they are the presentation layer beneath Business Components, not the
owners of business truth (Component Architecture §74.2, §74.6).

## Files

| File | Responsibility |
|------|----------------|
| `../../css/components.css` | The component layer stylesheet. Owns every component's visual definition, variants, responsive behavior, and motion. Consumes only `variables.css`. |
| `component-library.js` | The registry (`window.AuditOS.componentLibrary`) — the authoritative catalog of registered components (id, name, category, class, description) and lookups. |
| `component-library.html` | The canonical markup reference. The exact, accessible structure workspaces copy for each component. |

Keep the three in sync: a component exists when it has a CSS definition, a
registry entry, and a markup reference.

## Components

| Component | Class | Category | Responsibility |
|-----------|-------|----------|----------------|
| Surface | `.aos-surface` | Foundation | Base bordered container primitive. `--padded`, `--muted`, `--raised`. |
| Card | `.aos-card` | Foundation | Surface with `__header` / `__body` / `__footer`; `--interactive` (focusable, subtle brand-tinted hover). |
| Section | `.aos-section` | Foundation | Content grouping with `__header` (`__eyebrow`, `__title`, `__description`) and `__body`. |
| Panel Section | `.aos-panel-section` | Foundation | Titled bordered region (`__header` recessed on the workspace surface, `__title`, `__actions`, `__body`). |
| Divider | `.aos-divider` | Foundation | Hairline separator; `--vertical`, `--labeled`. |
| KPI Tile | `.aos-kpi-tile` | Data display | `__label`, `__value`, `__delta` (`--positive`/`--negative`/`--neutral`), `__caption`. |
| Status Badge | `.aos-status-badge` | Data display | Status pill; `--info`/`--success`/`--warning`/`--error` + `__dot`. |
| Chip | `.aos-chip` | Data display | Token/filter; `--selected`, `__remove`; interactive as `<button>`. |
| Property Row | `.aos-property-row` | Data display | Label/value pair (`__label`, `__value`); stacks when narrow. |
| Property Grid | `.aos-property-grid` | Data display | Divided Property Rows; `--two-column` collapses responsively. |
| Metadata List | `.aos-metadata-list` | Data display | `<dl>` of `__item` (`__term`/`__detail`); `--inline`. |
| Progress | `.aos-progress` | Data display | Labeled meter (`__label`, `__value`, `__track`, `__indicator`); `--success`/`--warning`/`--error`; value always reads as text. |
| Item List | `.aos-item-list` | Data display | Semantic list of `__item` rows (`__marker` tones, `__content`, `__title`, `__description`, `__meta`); `--compact`, `__item--critical` (dominant prioritized row). |
| Timeline | `.aos-timeline` | Data display | Ordered `__event` list with `__marker` tones on a connecting rail (`__meta`, `__title`, `__description`). |
| Button | `.aos-button` | Input | Standard action control for buttons and button-styled links; `--primary`/`--subtle`/`--small`. |
| Toolbar Group | `.aos-toolbar-group` | Layout | Horizontal control cluster; `--divided`; wraps responsively. |
| Action Group | `.aos-action-group` | Layout | Action cluster; `--end`/`--between`/`--stack`; collapses when empty. |
| Empty State | `.aos-empty-state` | State | `__icon`, `__title`, `__description`, `__actions` (§15.12 Empty). |
| Loading State | `.aos-loading-state` | State | Layout-stable region with `__label` live text (§15.12 Loading). |
| Skeleton | `.aos-skeleton` | State | Placeholder; `--text`/`--title`/`--block`/`--circle`; reduced-motion safe. |

## Design language

The library implements the enterprise design language of the product surface
(Visual Design System, Chapter 17): typography-first hierarchy, bordered card
surfaces instead of decorative color, a mathematically consistent token-based
spacing rhythm, hairline rules for structure, and subtle motion. Dark mode is
inherited automatically from the token foundation. No glassmorphism, no
consumer-UI styling, no dashboard-template chrome.

**Accessibility.** Interactive components (interactive Card, Chip, chip remove,
Button)
expose a visible focus ring via `--aos-focus-ring` and are keyboard operable.
Status is never encoded by color alone — badges and KPI deltas carry text and
glyphs as well. State components carry the accessible semantics their consumers
set (`role="status"`, `aria-busy`), and skeletons are decorative
(`aria-hidden`) so the Loading State owns the announcement.

**Responsive.** Property rows and grids collapse to a single column, action and
toolbar groups wrap, and the two-column property grid restores row dividers at
the tablet breakpoint.

**Reduced motion.** Motion uses the duration tokens, which the token foundation
zeroes under `prefers-reduced-motion`; the skeleton shimmer additionally
collapses to a static block.

## Usage

The registry is registered in [`prototype/index.html`](../../index.html) as a
classic script (`window.AuditOS.componentLibrary`), and the stylesheet is
registered through the stylesheet entry point
([`css/main.css`](../../css/main.css)) in the component layer — after
`layout.css`, before the workspace stylesheets — so the primitives are
available to every component and workspace above them.

The [Shared Workspace Framework](../workspace-framework/README.md) is the first
consumer: its supporting panels compose from **Panel Section** and its primary
content and context ribbon compose from **Surface**, so the framework reuses the
library rather than duplicating surface chrome. The [AuditOS Home workspace](../workspaces/home/README.md)
is the first business consumer, composing every one of its sections from these
primitives via a declarative view model rather than bespoke markup.
