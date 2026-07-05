# AuditOS — Workspace Priority

> **Purpose**
>
> This document defines the recommended implementation order for AuditOS.
>
> AI coding assistants should use this file to determine what should be implemented next and to avoid working on lower-priority areas before foundational work is complete.

---

# 1. Implementation Philosophy

Always complete the architectural foundation before implementing business features.

Implementation should follow this progression:

```text
Architecture

↓

Design System

↓

Reusable Components

↓

Application Shell

↓

Navigation

↓

Shared Audit State

↓

Workspaces

↓

AI

↓

Polish

↓

Backend Integration
```

Never skip foundational layers.

---

# 2. Priority Levels

Priority levels are:

| Level | Meaning                 |
| ----- | ----------------------- |
| P0    | Mandatory foundation    |
| P1    | Core application        |
| P2    | Core workflows          |
| P3    | Advanced functionality  |
| P4    | Polish and optimization |
| P5    | Future implementation   |

---

# 3. P0 — Foundation

Complete these before implementing any workspace.

* Design System
* Design Tokens
* Component Library
* Global Components
* Application Shell
* Navigation
* Routing
* Shared Audit State
* Static JSON Loader
* Mock Authentication
* Theme System
* Utility Functions

Nothing else should begin until these are complete.

---

# 4. P1 — Core Platform

Implement the platform skeleton.

1. Dashboard
2. Engagement Workspace
3. Navigation
4. Search
5. Breadcrumbs
6. Notifications
7. Command Palette
8. Global Dialogs
9. Shared Layout Components

After this phase, users should be able to navigate the entire application.

---

# 5. P2 — Audit Workspaces

Implement operational workspaces in business order.

1. Walkthrough Workspace
2. Controls Workspace
3. Evidence Workspace
4. Testing Workspace
5. Findings Workspace
6. Reporting Workspace
7. Governance Workspace

Each workspace should be fully navigable before moving to the next.

---

# 6. P3 — Artificial Intelligence

Implement AI capabilities after the operational workflows exist.

Priority:

1. AI Panel
2. Conversation Interface
3. Prompt Library
4. Agent Dashboard
5. Workflow Orchestrator
6. Knowledge Explorer
7. Memory Explorer
8. Model Router
9. AI Approvals

Use static JSON for all AI responses during the prototype.

---

# 7. P4 — Executive Experience

After operational workspaces are complete:

1. Executive Dashboard
2. Portfolio Analytics
3. Enterprise KPIs
4. Forecasting
5. Board Reports
6. Executive AI Briefings

Focus on strategic visualization rather than operational detail.

---

# 8. P5 — Future Enterprise Features

Do not implement during the static prototype unless explicitly requested.

Illustrative examples:

* Backend APIs
* Authentication providers
* Database integration
* Live AI providers
* Vector databases
* Background jobs
* Real-time collaboration
* Notifications infrastructure
* Enterprise integrations

These are deferred until after the prototype.

---

# 9. Component Priority

Always build reusable components before pages.

Recommended order:

1. Layout
2. Navigation
3. Buttons
4. Forms
5. Cards
6. Tables
7. Charts
8. Dialogs
9. Drawers
10. AI Components
11. Governance Components
12. Workspace Components

Pages should assemble existing components.

---

# 10. Screen Priority

Recommended implementation order:

```text
Application Shell

↓

Dashboard

↓

Engagement

↓

Walkthrough

↓

Controls

↓

Evidence

↓

Testing

↓

Findings

↓

Reporting

↓

Governance

↓

AI

↓

Executive Dashboard
```

Do not build isolated screens.

---

# 11. Component Completion Criteria

A reusable component is complete when it:

* supports responsive layouts
* supports accessibility
* uses Design System tokens
* exposes configuration
* contains no page-specific logic
* is documented
* is reused by at least one workspace

---

# 12. Workspace Completion Criteria

A workspace is complete when it includes:

* navigation
* toolbar
* filters
* search
* responsive layout
* loading state
* empty state
* error state
* realistic static JSON
* AI placeholders (if applicable)

Visual completeness alone is insufficient.

---

# 13. Switching Rules

Before switching to another workspace, verify:

* current workspace is functionally complete
* reusable components have been extracted
* no duplicated code remains
* documentation is updated
* architecture remains consistent

Avoid abandoning partially implemented workspaces.

---

# 14. Refactoring Priority

If duplicate implementations are discovered:

1. Refactor immediately.
2. Replace duplicates with shared components.
3. Update all affected workspaces.
4. Preserve functionality.

Reuse takes precedence over speed.

---

# 15. AI Session Workflow

At the start of each implementation session:

1. Read `project-rules.md`.
2. Read `architecture-summary.md`.
3. Read `coding-rules.md`.
4. Read `ui-rules.md`.
5. Read this document.
6. Identify the highest incomplete priority.
7. Implement only that priority unless instructed otherwise.

Stay focused on a single implementation objective.

---

# 16. Context Management

To maintain high-quality AI output:

* Work on one major feature or workspace at a time.
* Keep changes cohesive rather than scattered across unrelated areas.
* Summarize completed work before moving to the next priority.
* Re-read the relevant architecture and implementation documents before starting a new workspace.

For long-running projects, maintain a concise handoff document so a new chat or session can resume without reconstructing the entire project history.

---

# 17. Definition of Ready

A task is ready to begin only when:

* required architecture exists
* dependent components exist or are scheduled
* required JSON structures are defined
* routing has been established
* Design System requirements are understood

Do not begin implementation with unresolved dependencies.

---

# 18. Definition of Done

A priority level is complete only when:

* all planned screens are implemented
* reusable components are extracted
* accessibility requirements are satisfied
* responsive behavior works
* static JSON drives all business data
* documentation reflects the implementation
* no architectural violations remain

---

# 19. Progress Tracking

Track implementation using the following status values:

* Not Started
* Planned
* In Progress
* Blocked
* Ready for Review
* Complete

Update status at the end of each major implementation session.

---

# 20. Ultimate Goal

The implementation should progress in predictable, incremental stages until AuditOS becomes a cohesive enterprise Assurance Operating System.

Every implementation decision should:

* strengthen the architecture
* increase component reuse
* reduce technical debt
* preserve consistency
* prepare for future backend and AI integration

Never sacrifice long-term maintainability for short-term implementation speed.
