# AuditOS — Session Handoff Template

> **Purpose**
>
> This document provides a standardized handoff format between AI coding sessions.
>
> Every major implementation session should end by producing a completed version of this template.
>
> A new session should begin by reading the latest handoff before implementing additional functionality.

---

# Session Handoff

## 1. Project Information

**Project**

AuditOS

**Current Phase**

Static Prototype

**Repository Branch**

*(Specify branch if applicable.)*

**Date**

*(Update when creating the handoff.)*

---

## 2. Session Objective

Describe the primary objective of the completed session.

Examples:

* Built Application Shell
* Implemented Dashboard
* Added reusable table components
* Refactored navigation
* Improved responsive behavior

Only one primary objective should appear here.

---

## 3. Summary

Provide a concise summary (5–10 bullet points) describing what was completed.

Illustrative items:

* Created reusable layout components.
* Added workspace navigation.
* Implemented dashboard cards.
* Connected dashboard to static JSON.
* Added loading states.
* Updated routing.
* Improved accessibility.

Avoid lengthy narratives.

---

## 4. Files Created

List newly created files.

Illustrative format:

```text
components/layout/app-shell.html
components/navigation/sidebar.js
pages/dashboard/index.html
data/dashboard.json
```

---

## 5. Files Modified

List modified files.

Example:

```text
assets/css/theme.css
assets/js/router.js
components/cards/stat-card.js
```

---

## 6. Components Added

List reusable components introduced during the session.

Example:

* App Shell
* Sidebar
* Workspace Header
* KPI Card
* Enterprise Table
* Breadcrumb
* Toolbar

Only list reusable components.

---

## 7. Components Reused

List existing reusable components that were used without modification.

Example:

* Modal
* Toast
* Alert Banner
* Button
* Card

This helps identify reuse across the project.

---

## 8. Business Objects

List Business Objects affected.

Example:

* Engagement
* Finding
* Report

Avoid listing objects that were not modified or consumed.

---

## 9. JSON Datasets

List new or updated datasets.

Example:

* dashboard.json
* engagements.json
* findings.json

Document structural changes where applicable.

---

## 10. Routes Added

List any routes introduced or modified.

Example:

```text
/dashboard
/engagements/{id}
/engagements/{id}/controls
```

If no routing changed, state:

None.

---

## 11. Architectural Decisions

Record important architectural decisions made during the session.

Example:

* Enterprise tables standardized on Grid.js.
* All dashboard cards consume KPI data from Shared Audit State.
* Breadcrumbs generated from the routing hierarchy.

Only record long-term decisions.

---

## 12. Known Issues

List unresolved issues.

Illustrative examples:

* Placeholder charts remain.
* Mobile layout requires refinement.
* AI panel uses static responses.
* Missing mock data for reporting.

Keep this list actionable.

---

## 13. Technical Debt

Record intentional shortcuts taken during implementation.

Example:

* Mock authentication used until backend phase.
* Static JSON used instead of API.
* Temporary placeholder icons pending design review.

Technical debt should be explicit.

---

## 14. Validation

Confirm completion of the following:

* Architecture preserved
* Design System followed
* Components reused
* Responsive behavior verified
* Accessibility reviewed
* Static JSON used
* No unnecessary dependencies introduced

Any unchecked item should be explained.

---

## 15. Progress Status

Update the current implementation status.

Suggested values:

* Not Started
* Planned
* In Progress
* Ready for Review
* Complete
* Blocked

Also identify the current priority level (P0–P5).

---

## 16. Recommended Next Task

Specify exactly one recommended next objective.

Examples:

* Implement Controls Workspace
* Build reusable dialogs
* Add Evidence Workspace
* Improve routing
* Create AI components

Avoid listing multiple unrelated tasks.

---

## 17. Context for the Next Session

Provide a concise orientation for the next AI coding session.

Include:

* Current implementation state
* Relevant architecture documents to review
* Reusable components that already exist
* Dependencies to consider
* Constraints that must be respected

Limit this section to approximately one page.

---

## 18. Session Completion Checklist

Confirm:

* Objective completed
* Documentation updated
* Components extracted
* Architecture preserved
* Outstanding issues recorded
* Next task identified
* Handoff ready for the next session

A handoff is not complete until every applicable item has been reviewed.

---

# New Session Startup

Every new implementation session should begin with the following sequence:

1. Read `.zoo/project-rules.md`.
2. Read `.zoo/architecture-summary.md`.
3. Read `.zoo/coding-rules.md`.
4. Read `.zoo/ui-rules.md`.
5. Read `.zoo/workspace-priority.md`.
6. Read the latest completed handoff.
7. Review the relevant Architecture and Implementation Guide documents.
8. Confirm the current priority level.
9. Verify dependencies.
10. Begin implementation.

Never rely on conversation history alone to reconstruct project context.

---

# Chat Transition Guidance

A new chat is recommended when:

* a major milestone has been completed;
* the implementation is moving to a different workspace;
* accumulated conversation history is no longer relevant to the next task;
* architectural summaries and the handoff fully describe the current state.

Before starting a new chat:

* finish the current logical unit of work;
* complete this handoff template;
* ensure documentation reflects any architectural decisions;
* identify one clear next objective.

This approach minimizes context drift and allows another AI coding assistant—or a future session—to continue the project with minimal rediscovery.

---

# Ultimate Goal

Every handoff should allow a new AI coding assistant to continue implementing AuditOS confidently, consistently, and efficiently without relying on prior conversation history.

A successful handoff is concise, technically accurate, architecture-aware, and sufficient to resume development immediately.
