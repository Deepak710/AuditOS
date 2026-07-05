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