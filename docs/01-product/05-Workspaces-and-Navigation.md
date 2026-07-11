# PART II — PRODUCT

## Chapter 12 — Workspaces and Navigation

---

### 12.1 Purpose

AuditOS is not organized around pages.

It is organized around **workspaces**.

This distinction is fundamental to the architecture of the platform.

Pages are isolated screens.

Workspaces are operational environments.

A page typically owns a single responsibility.

A workspace provides everything required to perform a professional activity while remaining continuously connected to the Shared Audit State.

This chapter defines how users navigate AuditOS and how work is organized throughout an assurance engagement.

---

## 12.2 Navigation Philosophy

Navigation should never expose the internal architecture of the application.

Users should navigate according to the way they think about an engagement.

An auditor does not think:

> "I need to open page 17."

An auditor thinks:

> "I need to review evidence."

> "I need to approve recommendations."

> "I need to understand testing."

Navigation should therefore mirror professional mental models rather than software implementation.

The application should disappear behind the workflow.

---

## 12.3 Workspace Philosophy

Every workspace represents a professional activity.

Every workspace references the same Shared Audit State.

Changing workspaces never changes the engagement.

Only approved actions modify engagement knowledge.

Each workspace answers three questions.

* What do I need to understand?
* What can I do?
* What has changed?

The workspace should never require users to assemble context manually.

Everything necessary to perform meaningful work should already be available.

---

## 12.4 Navigation Principles

Navigation throughout AuditOS is governed by the following principles.

* Navigation follows the audit lifecycle.
* Every workspace references the Shared Audit State.
* Users always know where they are.
* Context is never lost during navigation.
* Switching workspaces never duplicates information.
* Navigation minimizes cognitive effort.
* Every destination provides meaningful value.
* Deep navigation hierarchies are avoided.
* Search complements navigation rather than replacing it.
* Keyboard navigation is considered a first-class interaction model.

---

## 12.5 Primary Navigation Model

The primary navigation is organized into operational workspaces.

```text
Home
│
├── Dashboard
├── Engagement Overview
├── Scope
├── Requirements
├── Controls
├── Walkthroughs
├── Evidence
├── Testing
├── Observations
├── Findings
├── Documentation
├── Reports
├── Approvals
├── Timeline
├── AI Activity
├── Search
├── Knowledge
└── Settings
```

This structure reflects professional workflows rather than technical architecture.

---

## 12.6 Home Workspace

The Home Workspace provides orientation.

It should answer:

* Where am I?
* What engagement am I working on?
* What requires immediate attention?
* What changed recently?
* What should I do next?

The Home Workspace is never a marketing dashboard.

It is an operational dashboard.

Users should begin every session with immediate situational awareness.

---

## 12.6.5 Deep Linking and Record Navigation (Issue #31)

Users can navigate directly to specific records within a workspace using stable deep links.

**URL Format:** `#/workspace?id=recordId`

Example: `#/evidence?id=EVD-MER-0001` navigates to the Evidence workspace and selects record EVD-MER-0001.

**Browser Integration:**
- Deep links are bookmarkable and shareable
- Browser Back/Forward buttons preserve navigation history
- Scroll position is restored when returning to a workspace without selecting a specific record

**Inspector Navigation:**
All "Related X" sections in workspace inspectors now include navigable links.

When an auditor opens a Requirement's related evidence, clicking "Open" (or using the link in the Inspector) navigates to the Evidence workspace with that evidence record pre-selected — no manual searching required.

This pattern extends across all workspaces: Requirements → Evidence, Controls → Requirements, Testing → Control, Findings → Control/Test/Requirements, etc.

**Constraints (Release 1):**
- Links render only where the schema joins support them
- No fabricated links for unresolved records
- Filter/search state does not survive navigation (Release 2)

See [[08-Issue-31-Cross-Workspace-Navigation.md]] for technical implementation details.

---

## 12.7 Dashboard Workspace

The Dashboard summarizes engagement health.

Rather than presenting isolated metrics, it communicates operational status.

Typical information includes:

* Engagement progress.
* Pending approvals.
* AI recommendations.
* Outstanding evidence.
* Upcoming milestones.
* Review bottlenecks.
* Testing progress.
* Recent activity.
* Engagement health indicators.

The Dashboard answers:

> "How healthy is this engagement?"

---

## 12.8 Operational Workspaces

Operational workspaces represent the core activities of an engagement.

These include:

* Scope
* Requirements
* Controls
* Walkthroughs
* Evidence
* Testing
* Observations
* Findings
* Documentation
* Reports

Each workspace owns presentation logic only.

Business knowledge remains within the Shared Audit State.

Users should be able to move between workspaces without losing context.

---

## 12.9 Governance Workspaces

Governance workspaces support oversight rather than operational execution.

These include:

* Approval Center.
* Activity Timeline.
* AI Activity.
* Notifications.
* Review Queue.

Their purpose is to answer:

* What requires approval?
* What recently changed?
* Why did it change?
* What remains outstanding?
* Which recommendations require attention?

These workspaces strengthen transparency throughout the engagement.

---

## 12.10 Knowledge Workspaces

Knowledge Workspaces expose accumulated organizational intelligence.

Future examples include:

* Organizational templates.
* Previous engagements.
* Standard report language.
* Common evidence requests.
* Organizational guidance.
* Framework references.
* Prompt libraries.
* Reusable documentation.

Knowledge should become progressively richer as additional engagements are completed.

---

## 12.11 Workspace Structure

Every workspace should follow a consistent structural pattern.

```text
Workspace
│
├── Context Header
│
├── Primary Content
│
├── Related Information
│
├── AI Recommendations
│
├── Timeline
│
└── Actions
```

Consistency reduces cognitive effort.

Users should never need to relearn navigation when entering a different workspace.

---

## 12.12 Persistent Context

Users should never lose awareness of the engagement they are working within.

Every workspace should continuously display essential engagement context.

Examples include:

* Client.
* Engagement.
* Audit period.
* Current phase.
* Assigned user.
* Outstanding approvals.
* Overall health.

Context should remain visible without overwhelming the interface.

---

## 12.13 Contextual Navigation

AuditOS should encourage exploration through relationships.

For example:

A Control should provide immediate navigation to:

* Related Requirements.
* Supporting Evidence.
* Walkthroughs.
* Tests.
* Findings.
* Documentation.
* Timeline.
* AI Recommendations.

Navigation should expose relationships rather than force users to search.

Every business object becomes a gateway into connected knowledge.

---

## 12.14 Search-Driven Navigation

Search is considered part of navigation rather than a separate utility.

Search should understand business relationships.

Searching for a control should surface:

* The Control.
* Supporting Evidence.
* Testing.
* Walkthroughs.
* Findings.
* Reports.
* Timeline events.
* AI Recommendations.

Users should locate information regardless of where it is presented.

Search operates against knowledge.

Not documents.

---

## 12.15 Progressive Disclosure

Professional users require access to significant amounts of information.

Displaying everything simultaneously increases cognitive load.

AuditOS therefore applies progressive disclosure.

Essential information appears immediately.

Supporting information expands naturally.

Historical information remains accessible.

Advanced operational detail appears only when required.

Nothing important is hidden.

Everything remains discoverable.

---

## 12.16 Cross-Workspace Continuity

Switching workspaces should feel like changing perspectives rather than opening different applications.

The following should remain consistent across every workspace.

* Navigation.
* Terminology.
* Visual hierarchy.
* Keyboard shortcuts.
* Search.
* AI recommendations.
* Timeline behavior.
* Approval interactions.
* Notifications.
* Design language.

Users should experience one cohesive product.

Not multiple independent modules.

---

## 12.17 Future Navigation

The navigation model has been intentionally designed to accommodate future platform growth.

Future workspaces may include:

* Risk Assessment.
* Sampling.
* Issues Management.
* Client Portal.
* SharePoint Integration.
* AI Memory.
* Analytics.
* Framework Management.
* Agent Management.
* Marketplace.

New workspaces should extend the existing navigation philosophy rather than introducing alternative interaction models.

---

## 12.18 Navigation Principles Summary

The navigation architecture of AuditOS is governed by the following principles.

* Navigation follows professional workflows.
* Workspaces replace traditional pages.
* Every workspace visualizes the Shared Audit State.
* Context is always preserved.
* Relationships drive navigation.
* Search operates on knowledge.
* Governance remains continuously visible.
* AI assistance is contextual.
* Interfaces remain consistent.
* Navigation scales without increasing complexity.

AuditOS is designed to feel less like navigating software and more like working inside a continuously evolving assurance engagement.

Every workspace represents another perspective of the same engagement.

The user changes perspective.

The engagement never changes.
