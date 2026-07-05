# AuditOS — Project Rules

> **Purpose**
>
> This document is the primary operating guide for AI coding assistants working on AuditOS.
>
> Every implementation decision must comply with these rules before code is generated.

---

# 1. Project Identity

Project Name:

**AuditOS**

Description:

Enterprise AI-powered Audit Operating System.

Primary Domain:

SOC Audits first.

Architecture must remain framework-agnostic so additional assurance frameworks can be added later.

Examples:

* SOC 1
* SOC 2
* ISO 27001
* PCI DSS
* HIPAA
* NIST
* Internal Audit
* Custom Frameworks

---

# 2. Current Phase

Current phase:

**Static Prototype**

The objective is **NOT** backend implementation.

The objective is to build a complete production-quality interface using static data.

---

# 3. Prototype Constraints

The prototype must:

* run by opening `index.html`
* require no installation
* require no backend
* require no database
* require no Node.js
* require no npm
* require no build system

Only static assets may be used.

---

# 4. Approved Technologies

Core

* HTML5
* CSS3
* Bootstrap 5
* Vanilla JavaScript (ES Modules)

Preferred Libraries

* Bootstrap Icons
* Apache ECharts
* Chart.js
* Grid.js or Tabulator
* TipTap
* Monaco Editor
* Marked.js
* Mermaid
* Motion One
* Floating UI
* SortableJS
* PDF.js
* SheetJS Community Edition

Only introduce additional libraries when there is a clear architectural benefit.

---

# 5. Architecture First

Never begin implementation before understanding:

* Architecture Handbook
* Business Object Model
* Shared Audit State
* Component Library
* Design System
* Screen Specifications

If uncertainty exists, stop and ask.

Do not invent architecture.

---

# 6. Component First

Always build:

Design Tokens

↓

Reusable Components

↓

Layouts

↓

Pages

↓

Workspace Logic

Never build page-specific components when reusable components already exist.

---

# 7. Business Objects

Business Objects are the single source of truth.

UI components never own business logic.

Business Objects include:

* Engagement
* Walkthrough
* Control
* Evidence
* Test
* Finding
* Report
* User
* Notification
* AI Recommendation

Relationships must always be preserved.

---

# 8. Shared Audit State

All workspaces share one application state.

Never duplicate application state inside individual components.

---

# 9. Reuse Before Creation

Before creating any component:

1. Search existing components.
2. Extend if appropriate.
3. Reuse whenever possible.

Duplicate components are prohibited.

---

# 10. Static JSON

During the prototype:

Every dataset originates from JSON.

Never hardcode business data inside JavaScript.

Illustrative datasets:

* engagements.json
* controls.json
* findings.json
* reports.json
* users.json

---

# 11. No Mock HTML

Do not create fake screenshots.

Create working pages.

Dialogs should open.

Navigation should work.

Tables should filter.

Charts should render.

Every screen should feel functional.

---

# 12. User Experience

AuditOS should feel:

* modern
* professional
* enterprise
* calm
* responsive
* trustworthy
* AI-native

Avoid unnecessary visual complexity.

---

# 13. Accessibility

Every implementation must support:

* keyboard navigation
* semantic HTML
* screen readers
* reduced motion
* visible focus
* scalable typography
* WCAG 2.2 AA principles

Accessibility is not optional.

---

# 14. Responsive Design

Desktop is the primary target.

Every feature must also function on:

* laptop
* tablet
* mobile

Never remove functionality on smaller screens.

Adapt the layout instead.

---

# 15. AI Integration

AI should augment professional judgment.

AI may:

* recommend
* summarize
* explain
* classify
* organize

AI must never silently modify business data.

Every recommendation requires human review before acceptance.

---

# 16. Explainability

AI-generated content should display:

* confidence
* supporting evidence
* citations (where applicable)
* approval status

Internal reasoning must never be exposed.

---

# 17. Visual Consistency

Every page must inherit:

* Application Shell
* Design System
* Component Library
* Navigation
* Design Tokens

Never create one-off visual styles.

---

# 18. Performance

Prefer:

* lazy rendering
* virtualization
* efficient DOM updates
* lightweight animations
* reusable components

Avoid unnecessary dependencies.

---

# 19. Security

Even though the prototype is static:

Never encourage insecure implementation patterns.

Future backend integration should remain straightforward.

---

# 20. Folder Organization

Never create arbitrary folders.

Follow the documented repository structure.

Keep related files together.

Use descriptive names.

---

# 21. Documentation

When implementing features:

Update documentation where appropriate.

Avoid undocumented architectural decisions.

---

# 22. Decision Making

If multiple implementation options exist:

Choose the solution that:

1. maximizes reuse
2. minimizes complexity
3. preserves architecture
4. scales to enterprise workloads
5. simplifies future backend integration

---

# 23. Coding Philosophy

Prefer:

* readable code
* modular code
* reusable code
* documented code
* accessible code

Avoid:

* premature optimization
* unnecessary abstractions
* duplicated logic
* tightly coupled components

---

# 24. Definition of Done

A task is complete only when:

* architecture is preserved
* reusable components are used
* responsive layouts work
* accessibility requirements are satisfied
* static JSON drives business data
* navigation works
* loading states exist
* empty states exist
* error states exist
* code is organized consistently

Visual completion alone is insufficient.

---

# 25. AI Session Rules

Before implementing anything:

1. Read the relevant architecture documents.
2. Read this file.
3. Identify reusable components.
4. Determine affected Business Objects.
5. Plan implementation.
6. Implement incrementally.
7. Validate architecture compliance.
8. Document significant decisions.

Never skip planning for large features.

---

# 26. Non-Negotiable Rules

AI coding assistants must never:

* invent architecture
* duplicate components
* duplicate business logic
* hardcode business data
* bypass the Design System
* bypass Shared Audit State
* expose internal AI reasoning
* introduce unnecessary frameworks
* break accessibility
* ignore responsive behavior

If a requested implementation conflicts with these rules, preserve the architecture and explain the conflict before proceeding.

---

# 27. Success Criteria

AuditOS should evolve into an enterprise-grade Assurance Operating System whose interface is:

* modular
* maintainable
* explainable
* accessible
* responsive
* reusable
* AI-ready
* framework-independent

Every implementation should move the project toward that goal.
