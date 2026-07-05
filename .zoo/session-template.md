# AuditOS — Session Template

> **Purpose**
>
> This document defines the standard workflow for every AI coding session.
>
> Before implementing any feature, AI coding assistants should follow this sequence to maintain architectural consistency, minimize context drift, and produce high-quality code.

---

# 1. Session Goal

Every session should have **one primary objective**.

Examples:

* Build the Application Shell
* Implement the Dashboard
* Build the Controls Workspace
* Create reusable tables
* Refactor navigation
* Improve responsive behavior

Avoid mixing unrelated objectives in a single session.

---

# 2. Pre-Session Checklist

Before writing code:

* Read `.zoo/project-rules.md`
* Read `.zoo/architecture-summary.md`
* Read `.zoo/coding-rules.md`
* Read `.zoo/ui-rules.md`
* Read `.zoo/workspace-priority.md`
* Read the relevant Architecture and Implementation Guide documents
* Review the last session handoff (if available)

Do not begin coding until this review is complete.

---

# 3. Session Context

Record the session context:

**Current Phase**

* Static Prototype

**Current Workspace**

* *(Specify the workspace being implemented.)*

**Primary Objective**

* *(Describe the single implementation goal.)*

**Dependencies**

* *(List components, Business Objects, JSON files, or routes required before starting.)*

---

# 4. Planning Phase

Before implementing:

1. Identify affected Business Objects.
2. Identify reusable components.
3. Identify required routes.
4. Identify required JSON datasets.
5. Identify Design System requirements.
6. Estimate the scope of the change.

If new reusable components are required, implement them before pages.

---

# 5. Implementation Order

Always follow this sequence:

```text
Plan

↓

Create or Update Components

↓

Update Static JSON

↓

Implement Layout

↓

Implement Interactions

↓

Verify Responsiveness

↓

Verify Accessibility

↓

Document Changes
```

Do not skip intermediate steps.

---

# 6. During the Session

Maintain these principles:

* Work on one feature at a time.
* Reuse existing components whenever possible.
* Keep commits or logical changes cohesive.
* Avoid unrelated refactoring unless it removes blocking technical debt.
* Preserve the Application Shell and Design System.

---

# 7. Validation Checklist

Before considering the session complete, verify:

* Architecture remains consistent.
* Business Objects remain unchanged unless intentionally modified.
* Shared Audit State is preserved.
* Existing reusable components were reused.
* New components are generic and reusable.
* Static JSON provides business data.
* Responsive behavior functions correctly.
* Accessibility requirements are satisfied.
* Loading, empty, and error states exist where appropriate.

---

# 8. Documentation Updates

If the session introduces architectural or reusable changes:

* Update relevant implementation documents.
* Update component documentation if necessary.
* Update implementation status tracking.
* Record important design decisions.

Avoid undocumented architectural changes.

---

# 9. Session Summary

At the end of every session, prepare a concise summary containing:

* Objective completed
* Files created
* Files modified
* Components added
* Components reused
* Routes added or changed
* JSON datasets added or updated
* Outstanding work
* Known issues
* Recommended next task

This summary becomes the input for the handoff document.

---

# 10. When to End the Session

End the session when:

* the planned objective is complete;
* a logical milestone has been reached;
* additional work would introduce unrelated changes; or
* architectural uncertainty requires clarification.

Avoid ending the session midway through a reusable component unless absolutely necessary.

---

# 11. Context Management

To maintain high-quality AI output:

* Keep the active objective narrow.
* Avoid loading unrelated parts of the repository.
* Reference summary documents before large architecture documents when possible.
* Prefer incremental implementation over massive multi-feature changes.

If context becomes crowded, summarize progress before continuing.

---

# 12. Switching to a New Chat

Consider starting a new chat when one or more of the following applies:

* The current milestone is complete.
* The implementation is moving to a different workspace or major feature.
* The conversation has accumulated extensive implementation history that is no longer relevant to the next task.
* Responses begin to rely on outdated assumptions or require repeated corrections.
* A concise handoff summary can fully describe the current project state.

Before switching:

1. Finish the current logical unit of work.
2. Update the handoff document.
3. Record any architectural decisions.
4. Record outstanding tasks.
5. State the recommended next objective.

A new chat should begin by reading the `.zoo` guidance files and the latest handoff document rather than reconstructing the entire project history.

---

# 13. Session Anti-Patterns

Avoid:

* implementing multiple unrelated workspaces simultaneously;
* creating page-specific components that duplicate shared ones;
* changing architecture without updating documentation;
* hardcoding business data;
* introducing unapproved dependencies;
* leaving partially implemented reusable components without documenting them.

---

# 14. Definition of a Successful Session

A successful session:

* completes one coherent objective;
* preserves the architecture;
* increases component reuse;
* maintains accessibility and responsiveness;
* improves documentation;
* leaves the repository in a clean, understandable state for the next session.

---

# 15. Standard Session Workflow

```text
Read .zoo Guidance

↓

Review Handoff

↓

Understand Architecture

↓

Plan

↓

Implement

↓

Validate

↓

Document

↓

Create Handoff

↓

End Session
```

Every implementation session should follow this workflow.

---

# 16. Ultimate Goal

Each session should leave AuditOS in a better state than it was at the beginning.

Progress should be incremental, well-documented, architecturally consistent, and easy for another AI coding assistant—or a future session—to continue without unnecessary rediscovery.
