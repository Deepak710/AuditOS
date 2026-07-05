# AI Implementation Context

## Purpose
This document is the primary implementation context for AI coding agents working on AuditOS Release 1.

Read this document first for every implementation issue. Read additional documentation only when explicitly referenced by the GitHub issue.

---

# Product Principles

- Documentation is the source of truth.
- One GitHub issue = one architectural concern.
- Reuse existing implementation.
- Never invent architecture.
- Stop when documentation and implementation conflict.

---

# Technology Constraints

Allowed:
- HTML
- CSS
- Vanilla JavaScript
- Local Bootstrap
- Static JSON
- Static Assets

Forbidden:
- React
- Angular
- Vue
- Backend
- Database
- APIs
- Authentication
- AI implementation
- Build pipelines

Entrypoint:

`prototype/index.html`

Always validate using:

`file:///.../prototype/index.html`

Never assume localhost.

---

# CSS Layers

1. variables.css (Design Tokens)
2. layout.css (Application Shell)
3. Component CSS
4. Workspace CSS

---

# Ownership Rules

Modify only:

- Primary Ownership
- Conditional Ownership

Treat all other files as read-only unless the GitHub issue explicitly expands ownership.

---

# Implementation Rules

- Read only the documentation referenced by the issue.
- Inspect only owned files and direct dependencies.
- Reuse existing components.
- No speculative implementation.
- Keep foundations structure-only until a later issue owns content.

---

# Rendering Foundation

The Shared Workspace Framework (`prototype/components/workspace-framework/`)
is the canonical rendering engine of AuditOS.

- `workspace-framework.js` renders the Universal Workspace Structure
  (Workspace Design System §15.3) into the active workspace host on every
  route change, driven by the router's public `auditos:route-changed` event.
- `workspace-framework.html` is the canonical template the renderer mirrors.
- `workspace-framework.css` owns the enterprise design language of the
  workspace surface: token-based spacing rhythm, typography-first hierarchy,
  bordered card surfaces, responsive collapse, and reduced-motion-safe
  animation.

Rules:

- Every future workspace inherits this framework. Workspaces populate its
  `data-slot` mount points; they never re-invent the page structure.
- The framework owns layout only. No workspace may hardcode business content.
- The Workspace Host canvas is the single scroll surface; the framework flows
  inside it.
- AI regions are reserved presentation surfaces only. AI remains advisory;
  human approval remains mandatory.

---

# Demo Data (Canonical)

`prototype/demo-data/` is the canonical Release 1 simulated SharePoint
structure — the static stand-in for the SharePoint libraries and lists of the
eventual implementation target.

- Business data belongs exclusively to demo-data. Workspaces bind to it;
  they never embed business content in markup, CSS, or scripts.
- Root JSON files hold cross-engagement collections (companies, engagements,
  business units, teams, POCs, control library, framework mappings).
- Per-engagement folders (`controls/`, `evidence/`, `findings/`, `reports/`,
  `requests/`, `requirements/`, `samples/`, `testing/`) hold one JSON document
  per engagement (e.g. `nimbus-soc2-2026.json`), simulating per-engagement
  SharePoint document libraries.
- Demo-data is read-only for implementation issues unless a GitHub issue
  explicitly grants ownership.

---

# Implementation Status

Completed foundations, in order:

1. Design Token Foundation (`variables.css`).
2. Application Shell (`layout.css`, `index.html` landmarks).
3. Global Header, Left Navigation, Right Context Panel, Workspace Host
   (structural components).
4. Static Routing Foundation (registry, router, bootstrap).
5. Navigation Content (registry-driven destinations).
6. Shared Workspace Rendering Foundation and enterprise design language
   (framework renderer, template, stylesheet).

The prototype renders the universal workspace skeleton for every registered
workspace. Workspace content, business bindings, and workspace states remain
owned by later issues. No business content is implemented.

---

# Validation

Run:

`node prototype/tools/validate.js`

Do NOT:

- install Playwright
- install Chrome
- search npm cache
- diagnose browser availability

Only report PASS/FAIL. Expand details only on failure.

---

# Integrated Maintenance

Fix a pre-existing issue only when:

- it belongs to the architecture owned by the current issue
- it is fully understood
- it does not expand scope

Otherwise report it.

---

# Completion Report

Return only:

- Documentation Synchronization
- Integrated Maintenance (if applicable)
- Repository Drift Check
- Validation
- Commit Summary
- Commit Description

Keep reports concise.

---

# Commit Workflow

Implementation
→ Validation
→ Documentation Synchronization
→ Integrated Maintenance
→ Repository Drift Check
→ Prepare Commit
→ User Approval
→ Commit

Do not suggest future issues.

The Technical Lead determines the next GitHub issue.