# AuditOS — Architecture Summary

> **Purpose**
>
> This document provides AI coding assistants with a compressed overview of the AuditOS architecture.
>
> Read this before implementing any feature.

---

# 1. Product

Project:

**AuditOS**

Type:

Enterprise AI-powered Audit Operating System

Current Stage:

Static Prototype

Target:

Production-ready enterprise application

---

# 2. Architecture Philosophy

AuditOS is built using:

Business Objects

↓

Shared Audit State

↓

Reusable Components

↓

Workspaces

↓

Artificial Intelligence

↓

Future Backend

Architecture always flows in this direction.

Never reverse the dependency.

---

# 3. Business Objects

Business Objects are the foundation of the system.

Core objects include:

* Engagement
* Walkthrough
* Process
* Risk
* Control
* Evidence
* Test
* Finding
* Report
* User
* Team
* Notification
* AI Recommendation
* Workflow
* Task
* Policy

Business Objects never contain presentation logic.

---

# 4. Shared Audit State

All workspaces share one application state.

Shared state manages:

* active engagement
* selected Business Objects
* filters
* search
* navigation
* workspace
* AI context
* user preferences

Never duplicate state.

---

# 5. Architecture Layers

```text
Presentation

↓

Application Shell

↓

Reusable Components

↓

Business Objects

↓

Shared Audit State

↓

Static JSON

↓

Future Backend
```

Each layer depends only on the layer below it.

---

# 6. Application Shell

Every screen inherits:

* Header
* Sidebar
* Breadcrumbs
* Workspace Header
* Toolbar
* Content Area
* AI Panel
* Footer

No workspace defines its own shell.

---

# 7. Workspaces

Major workspaces:

* Dashboard
* Engagement
* Walkthrough
* Controls
* Evidence
* Testing
* Findings
* Reporting
* Governance
* AI
* Executive Dashboard

All workspaces consume shared components.

---

# 8. Component Architecture

Component hierarchy:

```text
Layout

↓

Navigation

↓

Forms

↓

Data Display

↓

AI

↓

Governance

↓

Utilities
```

Components are reusable.

Pages are compositions.

---

# 9. Design System

Every interface consumes:

* typography tokens
* spacing tokens
* color tokens
* radius tokens
* elevation tokens
* animation tokens
* breakpoint tokens

Never hardcode visual values.

---

# 10. Routing

Routing hierarchy:

```text
Dashboard

↓

Engagement

↓

Workspace

↓

Business Object

↓

Dialog
```

Routes should remain stable and bookmarkable.

---

# 11. Data Strategy

Prototype:

Static JSON

Future:

API

↓

Database

↓

Enterprise Integrations

The UI should not depend on implementation details.

---

# 12. Prototype Constraints

Current implementation must:

* require no backend
* require no Node.js
* require no npm
* require no build tools
* run from index.html
* use static JSON

---

# 13. AI Architecture

Artificial Intelligence is supervised.

AI may:

* recommend
* summarize
* classify
* organize
* explain

Human approval is always required before business data changes.

---

# 14. Governance

Governance applies everywhere.

Every important action supports:

* approval
* audit trail
* reviewer
* version history
* explainability

---

# 15. Business Object Relationships

```text
Engagement

├── Walkthroughs
├── Controls
├── Evidence
├── Testing
├── Findings
├── Reports
├── Governance
└── AI
```

Relationships should always be preserved.

---

# 16. Development Order

Always build in this sequence:

```text
Design Tokens

↓

Reusable Components

↓

Application Shell

↓

Navigation

↓

Layouts

↓

Pages

↓

Workspace Logic

↓

AI Features
```

Never build pages before reusable components.

---

# 17. Static Prototype Flow

```text
index.html

↓

Load Design System

↓

Load Navigation

↓

Load JSON

↓

Initialize Shared Audit State

↓

Render Components

↓

Render Workspace
```

---

# 18. Component Rules

Components should:

* be reusable
* be modular
* be responsive
* be accessible
* consume Business Objects
* avoid business logic
* avoid duplicated state

---

# 19. UI Principles

The interface should feel:

* modern
* enterprise
* responsive
* calm
* trustworthy
* information rich
* AI-native

Avoid unnecessary visual complexity.

---

# 20. Accessibility

Support:

* keyboard navigation
* semantic HTML
* screen readers
* reduced motion
* scalable typography
* WCAG 2.2 AA principles

Accessibility is mandatory.

---

# 21. Performance

Prefer:

* lazy rendering
* virtualization
* reusable components
* lightweight animations
* efficient DOM updates

Avoid unnecessary dependencies.

---

# 22. Open Source Stack

Preferred technologies:

* Bootstrap 5
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

Keep the stack modular.

---

# 23. Definition of Success

AuditOS should become:

* component-first
* Business Object-driven
* AI-assisted
* governance-first
* responsive
* accessible
* scalable
* framework-independent

Every implementation should move the project toward that architecture.

---

# 24. AI Checklist

Before writing code:

* Read project-rules.md.
* Read this architecture summary.
* Identify affected Business Objects.
* Identify reusable components.
* Reuse before creating new components.
* Use static JSON.
* Preserve Shared Audit State.
* Preserve the Design System.
* Preserve accessibility.
* Preserve responsive behavior.

If architectural uncertainty exists, stop and resolve it before implementing code.
