# Repository Map

Repository map maintained as implementation evolves.

## Workspaces Implemented

- **Home** (GitHub Issue #15) — dashboard/landing workspace
- **Engagement** (GitHub Issue #19) — engagement operational hub
- **Walkthrough** (GitHub Issue #20) — knowledge acquisition workspace
- **Requirements** (GitHub Issue #22) — living audit requirements management
- **Evidence** (GitHub Issue #21) — evidence system of record
- **Controls** (GitHub Issue #23) — control library lifecycle & relationships (Release 1: faithful rendering)
- **Testing** (GitHub Issue #24) — test procedure queue with three presentation modes
- **Findings** (GitHub Issue #25) — findings queue with four presentation modes (Release 1: faithful rendering)
- **Documentation** (GitHub Issue #26) — continuously evolving engagement documentation; renders report sections in authored order (Release 1: structure only; Release 2: AI-drafted sections)
- **Reporting** (planned)

## Workspace Structure

All workspaces follow: Business → ViewModel → Components → DOM

- **Framework**: Shared Workspace Framework (`components/workspace-framework/`)
- **Presentation**: Enterprise Data Presentation System (`components/presentation/`)
- **State**: Shared Audit State (`js/state/state-store.js`)
- **Router**: Static Router + Registry (`js/router/`)

## File Organization

### Workspaces

- `prototype/js/workspaces/[name].js` — workspace implementation
- `prototype/css/[name].css` — workspace-scoped styling

### Tests (Requirements-only pattern)

- `prototype/tests/unit/[name]-derivations.test.js` — pure-derivation unit tests
- `prototype/tests/integration/[name]-state-binding.test.js` — state binding + render validation

### Registry & Setup

- `prototype/js/router/workspace-registry.js` — workspace routing identity
- `prototype/index.html` — script loading order
- `prototype/css/main.css` — stylesheet import order
- `prototype/tests/lib/prototype.js` — test harness loaders
