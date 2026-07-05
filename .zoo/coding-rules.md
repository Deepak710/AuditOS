# AuditOS — Coding Rules

> **Purpose**
>
> This document defines the coding standards for all AI coding assistants working on AuditOS.
>
> Every implementation must follow these rules.

---

# 1. General Principles

Always prefer:

* clarity
* readability
* simplicity
* modularity
* reuse
* maintainability
* predictability

Avoid clever implementations that reduce readability.

---

# 2. Architecture Before Code

Never write code before understanding:

* project-rules.md
* architecture-summary.md
* relevant architecture documents
* relevant implementation documents

If architecture is unclear:

Stop.

Ask.

Do not guess.

---

# 3. Component First

Always implement in this order:

```text
Design Tokens

↓

Shared Components

↓

Layout Components

↓

Workspace Components

↓

Pages

↓

Feature Logic
```

Pages should assemble components.

Components should never depend on pages.

---

# 4. Business Objects

Business Objects are the single source of truth.

Components consume Business Objects.

Components never own business logic.

Never duplicate Business Object data.

---

# 5. Shared Audit State

Use Shared Audit State for:

* navigation
* active engagement
* filters
* search
* selections
* AI context
* user preferences

Never create isolated state unless it is temporary UI state.

---

# 6. File Organization

Keep files small.

Prefer one responsibility per file.

Illustrative structure:

```text
component/

component.html

component.css

component.js
```

Avoid excessively large files.

---

# 7. HTML Rules

HTML should:

* be semantic
* be accessible
* avoid unnecessary nesting
* use meaningful landmarks
* separate structure from styling

Never use tables for layout.

---

# 8. CSS Rules

Prefer:

* CSS Custom Properties
* Bootstrap utility classes
* reusable classes
* logical spacing
* component-scoped styles

Never hardcode repeated values.

Consume Design System tokens.

---

# 9. JavaScript Rules

Prefer:

* ES Modules
* const by default
* let only when required
* small functions
* pure functions where practical
* descriptive names

Avoid:

* global variables
* inline scripts
* duplicated logic
* deeply nested functions

---

# 10. Naming

Use descriptive names.

Illustrative examples:

Good

```text
engagement-table.js

finding-card.js

ai-panel.js
```

Avoid

```text
test.js

new.js

temp.js

component2.js
```

---

# 11. Components

Every reusable component should:

* receive data
* render itself
* expose configuration
* avoid hidden dependencies

Components should not know about page layout.

---

# 12. Reuse

Before creating anything:

Search for an existing implementation.

If one exists:

Reuse it.

Duplicate implementations are prohibited.

---

# 13. Static Data

Prototype data originates from JSON.

Never hardcode:

* users
* findings
* controls
* evidence
* reports

Business data belongs in:

```text
/data/
```

---

# 14. Error Handling

Handle:

* missing data
* empty states
* invalid IDs
* unavailable resources

Never fail silently.

Provide meaningful feedback.

---

# 15. Accessibility

Every implementation supports:

* keyboard navigation
* semantic HTML
* screen readers
* visible focus
* reduced motion
* ARIA only when appropriate

Accessibility is mandatory.

---

# 16. Responsive Design

Desktop first.

Adapt for:

* laptop
* tablet
* mobile

Do not remove features.

Adapt layouts instead.

---

# 17. Animation

Animation communicates:

* loading
* transitions
* hierarchy
* progress

Avoid decorative motion.

Respect reduced-motion preferences.

---

# 18. Tables

Enterprise tables should support:

* sorting
* filtering
* searching
* pagination
* virtualization
* column visibility
* responsive behavior

Tables are reusable components.

---

# 19. Charts

Charts should:

* use semantic colors
* resize automatically
* support drill-down where specified
* remain readable

Avoid decorative graphics.

---

# 20. AI Components

AI components should display:

* confidence
* citations
* supporting evidence
* approval status

Never present AI-generated content as confirmed fact without indicating its status.

---

# 21. Performance

Prefer:

* lazy rendering
* incremental loading
* reusable DOM elements
* efficient event handling

Avoid unnecessary libraries.

---

# 22. Dependencies

Only use approved technologies.

Preferred stack:

* Bootstrap 5
* Bootstrap Icons
* Motion One
* Grid.js or Tabulator
* Apache ECharts
* Chart.js
* TipTap
* Monaco Editor
* Mermaid
* Floating UI
* SortableJS
* PDF.js
* SheetJS Community Edition

Introduce new dependencies only when they provide a clear architectural benefit.

---

# 23. Documentation

Every significant implementation should include:

* concise comments where intent is not obvious
* meaningful file names
* consistent structure

Avoid redundant comments that merely repeat the code.

---

# 24. Refactoring

When improving existing code:

* preserve behavior
* reduce duplication
* improve readability
* improve reuse

Do not introduce unnecessary abstraction.

---

# 25. Definition of Done

Code is complete only when:

* architecture is preserved
* reusable components are used
* Design System tokens are used
* Business Objects remain unchanged
* Shared Audit State is preserved
* accessibility works
* responsive layouts work
* loading states exist
* empty states exist
* error states exist

---

# 26. Prohibited Practices

Never:

* duplicate components
* duplicate business logic
* hardcode business data
* bypass Shared Audit State
* bypass the Design System
* mix presentation and business logic
* introduce unnecessary frameworks
* expose internal AI reasoning
* leave dead code
* commit placeholder implementations without marking them clearly

---

# 27. Code Review Checklist

Before considering any task complete, verify:

* Architecture remains intact.
* Existing components were reused where possible.
* New components are generic and reusable.
* Design System tokens are used.
* Business Objects are unchanged.
* Static JSON provides all business data.
* Accessibility requirements are met.
* Responsive behavior functions correctly.
* Performance has not regressed.
* File structure remains consistent.

---

# 28. AI Workflow

For every implementation:

1. Understand the requested feature.
2. Identify affected Business Objects.
3. Locate reusable components.
4. Read the relevant workspace specification.
5. Plan the implementation.
6. Implement incrementally.
7. Test against the Design System.
8. Verify accessibility.
9. Verify responsive behavior.
10. Update documentation if needed.

Never skip the planning step for multi-file changes.

---

# 29. Coding Goal

Every commit should move AuditOS toward becoming an enterprise-grade Assurance Operating System that is:

* modular
* reusable
* maintainable
* accessible
* responsive
* explainable
* AI-ready
* backend-ready
* framework-independent

Code quality always takes precedence over implementation speed.
