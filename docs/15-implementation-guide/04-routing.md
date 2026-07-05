# PART XVI — IMPLEMENTATION GUIDE

## Chapter 130 — Routing Architecture

---

### 130.1 Purpose

The Routing Architecture defines the navigation structure for the AuditOS application.

It specifies how users move between screens, how workspaces relate to one another, how URLs are organized, and how navigation remains consistent throughout the platform.

Although the initial prototype is implemented as a static application, the routing strategy is designed to transition seamlessly into a future SPA or enterprise web application without structural changes.

---

### 130.2 Objectives

The routing architecture exists to:

* standardize navigation
* preserve workspace context
* simplify implementation
* support deep linking
* enable bookmarking
* improve usability
* simplify future backend migration
* support role-aware navigation
* improve accessibility
* provide predictable URLs

---

### 130.3 Routing Philosophy

Routing should be:

* predictable
* hierarchical
* human-readable
* REST-inspired
* bookmarkable
* shareable
* implementation-independent
* future-proof

Navigation should always preserve user context.

---

### 130.4 Prototype Routing Strategy

For the static prototype:

* every screen exists as an HTML page
* routing is simulated through page navigation
* state is loaded from static JSON
* no server-side routing is required

Future implementations may replace HTML pages with SPA routes while preserving the same URL structure.

---

### 130.5 Global Navigation Hierarchy

```text id="7qmk4s"
Application

├── Dashboard
├── Engagements
│     ├── Overview
│     ├── Walkthroughs
│     ├── Controls
│     ├── Evidence
│     ├── Testing
│     ├── Findings
│     ├── Reporting
│     ├── Governance
│     └── AI
│
├── Executive Dashboard
├── Administration
├── Settings
└── Help
```

The hierarchy should remain stable across releases.

---

### 130.6 Primary Routes

Illustrative top-level routes:

```text
/

↓

/dashboard

↓

/engagements

↓

/executive

↓

/settings

↓

/help
```

Top-level routes remain minimal.

---

### 130.7 Engagement Routes

Every engagement receives its own route.

Illustrative structure:

```text
/engagements/{engagementId}
```

Sub-routes include:

```text
/overview

/walkthroughs

/controls

/evidence

/testing

/findings

/reporting

/governance

/ai

/activity

/documents

/settings
```

Each sub-route preserves engagement context.

---

### 130.8 Dashboard Routes

Illustrative dashboard routes:

```text
/dashboard

/dashboard/activity

/dashboard/tasks

/dashboard/calendar

/dashboard/analytics
```

Dashboard navigation should remain lightweight.

---

### 130.9 Walkthrough Routes

Illustrative routes:

```text
/engagements/{id}/walkthroughs

/engagements/{id}/walkthroughs/{walkthroughId}

/activities

/interviews

/process

/evidence
```

Nested resources inherit walkthrough context.

---

### 130.10 Controls Routes

Illustrative routes:

```text
/engagements/{id}/controls

/controls/{controlId}

/testing

/evidence

/frameworks

/history
```

Controls remain individually addressable.

---

### 130.11 Evidence Routes

Illustrative routes:

```text
/engagements/{id}/evidence

/evidence/{evidenceId}

/preview

/history

/relationships

/metadata
```

Evidence routes support direct linking.

---

### 130.12 Testing Routes

Illustrative routes:

```text
/engagements/{id}/testing

/testing/{testId}

/workpapers

/samples

/exceptions

/review
```

Testing remains independently navigable.

---

### 130.13 Findings Routes

Illustrative routes:

```text
/engagements/{id}/findings

/findings/{findingId}

/remediation

/review

/history

/evidence
```

Every finding has a canonical URL.

---

### 130.14 Reporting Routes

Illustrative routes:

```text
/engagements/{id}/reporting

/report/{reportId}

/draft

/review

/publish

/history
```

Reports remain independently addressable.

---

### 130.15 Governance Routes

Illustrative routes:

```text
/engagements/{id}/governance

/approvals

/reviews

/policies

/audit-trail
```

Governance remains organization-wide while supporting engagement context.

---

### 130.16 AI Workspace Routes

Illustrative routes:

```text
/ai

/chat

/workflows

/prompts

/models

/memory

/agents

/knowledge

/settings
```

AI navigation remains independent while supporting engagement context.

---

### 130.17 Executive Dashboard Routes

Illustrative routes:

```text
/executive

/portfolio

/risk

/compliance

/forecasting

/briefings

/analytics
```

Executive navigation focuses on strategic insights.

---

### 130.18 Breadcrumb Strategy

Every page displays breadcrumbs.

Illustrative example:

```text
Dashboard

↓

Engagements

↓

Client Name

↓

Controls

↓

Control AC-17
```

Breadcrumbs should always reflect navigation hierarchy.

---

### 130.19 Navigation Context

Users should never lose context.

Navigation preserves:

* engagement
* framework
* selected workspace
* applied filters
* search terms
* selected Business Object
* scroll position where practical

Context preservation improves productivity.

---

### 130.20 Deep Linking

Every Business Object should have a stable URL.

Illustrative examples include:

* engagement
* walkthrough
* control
* evidence
* test
* finding
* report
* AI conversation

Deep links should remain shareable.

---

### 130.21 Route Parameters

Illustrative parameter names include:

```text
engagementId

walkthroughId

controlId

evidenceId

testId

findingId

reportId

conversationId
```

Parameter naming should remain consistent.

---

### 130.22 Future Route Guards

Future implementations may enforce:

* authentication
* authorization
* role validation
* feature flags
* organization context
* licensing
* maintenance mode

The static prototype does not implement guards but should preserve compatible routing.

---

### 130.23 Error Routes

Illustrative error routes include:

```text
/404

/403

/500

/offline
```

Error pages remain consistent with the Application Shell where appropriate.

---

### 130.24 Search Navigation

Global search should navigate directly to:

* Business Objects
* workspaces
* reports
* evidence
* findings
* AI conversations
* settings

Search results should preserve context.

---

### 130.25 Command Palette Navigation

The command palette supports instant navigation to:

* pages
* Business Objects
* actions
* AI workflows
* reports
* settings

Navigation should remain keyboard-first.

---

### 130.26 Accessibility

Routing should support:

* keyboard navigation
* focus restoration
* meaningful page titles
* semantic landmarks
* screen reader announcements
* skip links

Navigation changes should be communicated to assistive technologies.

---

### 130.27 Performance Guidelines

Routing should prioritize:

* minimal page reloads (future SPA)
* lazy loading
* incremental rendering
* route-level code splitting (future)
* efficient state restoration
* cached static assets

Prototype implementation should remain lightweight.

---

### 130.28 URL Design Principles

URLs should be:

* lowercase
* descriptive
* hyphenated where appropriate
* free of implementation details
* stable over time

Identifiers should use canonical IDs rather than display names.

---

### 130.29 AI Coding Assistant Guidance

When implementing routing, AI coding assistants should:

* preserve the route hierarchy defined in this document
* implement navigation before page logic
* maintain breadcrumb consistency
* preserve workspace context during navigation
* avoid hard-coded links
* prepare routes for future SPA migration
* separate navigation from business logic

Routing should remain implementation-independent.

---

### 130.30 Relationship to Other Documents

This specification extends:

* Application Shell
* Navigation Architecture
* Global Components
* Component Map
* Screen Specifications
* Shared Audit State

It defines how every workspace is connected throughout the AuditOS application.

---

### 130.31 Summary

The Routing Architecture establishes the navigation backbone of AuditOS.

By defining hierarchical URLs, workspace relationships, breadcrumb behavior, deep-linking, route parameters, context preservation, accessibility requirements, and future migration strategies, it ensures every screen participates in a consistent, scalable, and intuitive navigation system.

Built upon the Application Shell, Navigation Architecture, and Component Library, this routing strategy enables the static prototype to behave like a modern enterprise application while remaining ready for future SPA frameworks and backend services without structural redesign.

---
