# PART IX — WORKSPACE SPECIFICATIONS

## Chapter 63 — Engagement Workspace

---

### 63.1 Purpose

The Engagement Workspace is the operational center of every assurance engagement within AuditOS.

It provides a unified view of engagement planning, execution, governance, AI recommendations, collaboration, reporting, and progress while maintaining the Shared Audit State as the single authoritative source of business truth.

Unlike traditional audit tools that distribute engagement information across disconnected modules, spreadsheets, and working papers, the Engagement Workspace presents a single operational environment from which the entire engagement can be managed.

It is the primary workspace used throughout the engagement lifecycle.

---

### 63.2 Engagement Workspace Philosophy

An engagement is not a folder.

It is not a collection of documents.

It is not a project plan.

An engagement is a continuously evolving Business Object composed of interconnected Business Objects representing scope, controls, walkthroughs, evidence, testing, findings, documentation, approvals, and reporting.

The Engagement Workspace visualizes this operational state rather than owning it.

Business truth remains within the Shared Audit State.

---

### 63.3 Architectural Objectives

The Engagement Workspace exists to:

* Provide a unified operational view.
* Coordinate assurance activities.
* Reduce navigation complexity.
* Surface AI assistance contextually.
* Support collaboration.
* Present engagement health.
* Enable governance.
* Improve operational awareness.
* Support executive visibility.
* Serve as the operational home of every engagement.

---

### 63.4 Architectural Principles

The following principles govern the Engagement Workspace.

#### Engagement-Centric

Every capability revolves around the active engagement.

---

#### Shared State

The workspace consumes the Shared Audit State.

---

#### Business Object First

The workspace visualizes Business Objects rather than documents.

---

#### AI Assisted

Artificial Intelligence continuously assists users without replacing professional judgment.

---

#### Role Aware

Information is presented according to the user's responsibilities.

---

#### Event Driven

The workspace reacts to Business Events rather than maintaining independent state.

---

### 63.5 Architectural Position

The Engagement Workspace acts as the orchestration layer for operational assurance activities.

```text id="8v3m6p"
Workspace Shell

↓

Engagement Workspace

↓

Shared Audit State

↓

Business Objects

↓

Platform Services

↓

AI Services
```

The workspace coordinates operational visibility while remaining independent of business ownership.

---

### 63.6 Workspace Responsibilities

The Engagement Workspace is responsible for:

* presenting engagement status
* displaying engagement context
* coordinating operational workflows
* surfacing AI recommendations
* displaying governance activities
* visualizing progress
* enabling navigation
* supporting collaboration
* exposing engagement metrics

The workspace is intentionally **not** responsible for:

* storing Business Objects
* approving recommendations
* executing AI orchestration
* generating reports directly
* bypassing governance

---

### 63.7 Primary Business Objects

The Engagement Workspace primarily operates upon:

* Engagement
* Client
* Framework
* Team
* Scope
* Milestone
* Requirement
* Control
* Walkthrough
* Evidence
* Sample
* Testing Result
* Finding
* Recommendation
* Approval
* Report

Additional Business Objects appear as engagement maturity increases.

---

### 63.8 Workspace Composition

The Engagement Workspace is composed of several coordinated regions.

Illustrative composition:

```text id="2x8k5w"
Engagement Header

↓

Operational Dashboard

↓

Operational Pipeline (Walkthrough → Evidence → Controls → Testing → Findings → Reporting)

↓

Activity Timeline

↓

AI Insights

↓

Governance Summary

↓

Workspace Navigation
```

Each region consumes the Shared Audit State independently.

> **Superseded (Issue #41 — Living Reporting and Operational Findings):** the
> composition previously included a standalone **Work Queue** region. The Work
> Queue workspace has been removed entirely: pending work — evidence awaiting
> review, worksheets awaiting approval, observations awaiting a management
> response, report edits awaiting a decision — now lives inside the workspace
> that owns it. The lifecycle pipeline's per-stage pending-approval counts
> (§63.8 below) are the one place it aggregates across the whole engagement;
> there is no second, standalone queue. Legacy `#/…/work-queue` deep links
> redirect to this workspace.

#### Release 1 Implementation (GitHub Issue #19, redesigned by Issue #39, extended by Issue #41)

The Engagement Workspace is realized in `prototype/js/workspaces/engagement.js` (with `prototype/css/engagement.css`) as the first production workspace on the Shared Workspace Framework (Issue #17) and the Enterprise Data Presentation System (Issue #18). It reads exclusively through the Shared Audit State and composes those two systems — it introduces no new UI primitives.

Release 1 realizes this composition as an **operational, workflow-first** experience rather than a KPI dashboard. It answers "what is the current operational state of this audit, and what should I work on next?" through four operational regions, each owning one question and never restating another region's information:

* **Current Focus** — "where am I?" — the derived operational focus (the earliest incomplete lifecycle stage) beside the engagement status read straight from JSON. Status and focus are distinct concepts.
* **Audit Health** — "what is the state?" — a slim, clickable status strip (editor status-bar style, not cards) of six operational indicators — Walkthrough, Evidence, Testing, Approvals, Findings, Report — each with a health tone and a short operational status, so the state reads at a glance.
* **Next Actions** — "what should I do?" — the prioritized pending work, each navigating into its workspace.
* **Blocking Items** — "what is preventing progress?" — rejected evidence, failed tests, and high-severity findings.

Beneath the operational band, the **operational pipeline** (Walkthrough →
Evidence → Controls → Testing → Findings → Reporting) is presented as
**navigation, not a process diagram** — an ordered rail of connected stages
(`deriveLifecycle`). Issue #41 extended this pipeline beyond stage order
into real operational health, so each stage now carries:

* its **completion** (a real progress ratio where one exists);
* its **blockers** — real, recorded facts (evidence not received, high-severity observations open) that are actually stopping the stage, never a generic warning;
* its **pending approvals** (the count of items in that stage awaiting a decision — the aggregation point the removed Work Queue used to be);
* its **AI suggestions in flight** (report-edit and other proposals attributed to that stage through the Suggestion Lifecycle Service); and
* its **pipeline health** — **flowing**, **waiting**, or **blocked** — stated in text next to a tone dot, never color alone.

The **connector** joining one stage to the next carries the health of the
stage it leaves, so a blocked stage visibly blocks everything drawn
downstream of it — the pipeline reads as one connected flow, not disconnected
cards. Testing's summary is read across both recorded shapes a dataset may
carry (`tests`/`passed`/`failed`/`pending`, or `workpapers` with a
`byTestingStatus` distribution), so the pipeline never under-reports a
completed engagement as "not started."

Beneath the pipeline sits the operational context: a compact engagement
summary, the participating team, a host-agnostic Inspector renderer (mounted
in a bottom section for Release 1, mountable in any host later), and
metadata. The universal supporting panels carry related information, a
reserved AI advisory surface, and the activity feed.

Release 1 renders only real, recorded state: no fabricated blocker, no
invented AI-suggestion count, no writes. Two forward-compatibility seams keep
Release 2 pluggable without a UI redesign — frameworks are array-driven
(`normalizeFrameworks`: a single framework today, every entry of a future
engagement `frameworks` array with no code change), and the Walkthrough stage
always appears first even when no walkthrough data exists yet, shown "not
started" and never fabricated. Reporting is presented as continuous,
beginning on day one rather than as an end-of-project activity — see the
Reporting Workspace chapter (Chapter 69) for the report's own five-section
model, versioning, and propagation.

---

### 63.9 Engagement Header

The Engagement Header provides continuous awareness of engagement context.

Illustrative information includes:

* Client
* Engagement Name
* Framework
* Engagement Status
* Reporting Period
* Assigned Team
* Current Phase
* Overall Health

The header remains visible throughout the workspace.

---

### 63.10 Operational Dashboard

The dashboard summarizes engagement execution.

Illustrative indicators include:

* overall progress
* control coverage
* walkthrough completion
* evidence collection
* testing completion
* report narrative readiness
* report readiness
* governance status

These indicators are derived from Business Objects rather than manually maintained.

---

### 63.11 Engagement Timeline

The Engagement Timeline visualizes significant business events.

Illustrative events include:

* engagement created
* scope approved
* walkthrough completed
* evidence received
* testing completed
* finding raised
* recommendation approved
* report updated

The timeline is generated from immutable Audit Events.

---

### 63.12 Pending Work — Owned by Each Workspace, Not a Standalone Queue

**Release 1 Status (GitHub Issue #41):** AuditOS no longer presents a
standalone Work Queue workspace. Actionable work for the current user is
presented inside the workspace that owns it:

* **Evidence** — pending approvals, pending suggestions.
* **Testing** — pending worksheet approval.
* **Findings** — observations pending a management response (the Observation
  Register's own "Pending management response" panel).
* **Reporting** — report edits pending an approval decision, surfaced in the
  Reporting workbench's right rail and counted in that stage's pipeline
  health.

This is a deliberate architectural choice, not an omission: a standalone
queue duplicated state that each owning workspace already had to track
correctly, and routinely drifted out of sync with it. The Engagement
Workspace's operational pipeline (§63.8) is the one place pending work
aggregates *across* workspaces — each stage's pending-approval count is a
real, current figure read from the workspace that owns that stage, not a
separately maintained total.

Illustrative examples of what "pending" means per workspace:

* assigned walkthroughs awaiting a session
* evidence awaiting review
* testing worksheets awaiting approval
* observations awaiting a management response
* report edits awaiting a decision
* AI recommendations awaiting review

Legacy `#/…/work-queue` deep links redirect to the engagement overview.

---

### 63.13 AI Insights

The AI Insights region provides contextual operational intelligence.

Illustrative insights include:

* engagement risks
* missing evidence
* inconsistent documentation
* incomplete walkthroughs
* testing anomalies
* relationship gaps
* recommended next actions
* quality concerns

Recommendations from multiple AI Agents are consolidated into a single coherent experience before being presented to the user.

---

### 63.14 Governance Summary

The Governance Summary provides visibility into engagement governance.

Illustrative information includes:

* pending approvals
* rejected recommendations
* delegated reviews
* escalation requests
* governance exceptions
* policy violations

Governance activities remain separate from operational execution while remaining easily accessible.

---

### 63.15 Engagement Navigation

The Engagement Workspace serves as the entry point into specialized operational workspaces.

**Release 1 Status:** the real, registered engagement navigation
(`hierarchyBuilder.engagementWorkspaceIds()`) is the six-stage operational
pipeline in flow order — Walkthrough, Evidence, Controls, Testing, Findings,
Reporting — plus the Overview itself. Documentation and Work Queue are not
registered destinations (Issue #41); Scope and Governance remain part of the
broader conceptual navigation this section describes but are not yet
distinct Release 1 workspaces.

Illustrative destinations include:

* Scope
* Walkthroughs
* Controls
* Evidence
* Testing
* Findings
* Reporting
* Governance
* Analytics

Navigation reflects Business Object relationships rather than application modules.

---

### 63.16 Collaboration

Collaboration occurs around Business Objects rather than files.

Illustrative collaborative capabilities include:

* comments
* review discussions
* assignments
* mentions
* recommendations
* approvals
* decision history

All collaboration remains attributable and auditable.

---

### 63.17 AI Collaboration

Artificial Intelligence operates as an advisory participant within the engagement.

AI may:

* summarize progress
* recommend priorities
* identify risks
* explain relationships
* draft documentation
* identify missing evidence
* recommend testing

AI never approves Business Objects or alters engagement state.

---

### 63.18 Synchronization

The Engagement Workspace continuously observes approved Business Events.

Illustrative synchronization flow:

```text id="9h4r2v"
Business Event

↓

Shared Audit State Updated

↓

Workspace Refreshed

↓

Dashboard Updated

↓

AI Context Updated

↓

Notifications Generated
```

Synchronization occurs without manual refresh or duplicate business information.

---

### 63.19 Engagement Health Model

Engagement health is calculated from Business Objects.

Illustrative health dimensions include:

* planning maturity
* walkthrough coverage
* evidence readiness
* testing progress
* report narrative completeness
* governance health
* report readiness
* quality indicators

Health metrics remain derived rather than manually maintained.

---

### 63.20 Security

The Engagement Workspace inherits the platform security architecture.

Illustrative security capabilities include:

* authorization
* role awareness
* approval enforcement
* data classification
* auditability
* AI safety
* session integrity

Security policies remain consistent across every workspace.

---

### 63.21 Future Evolution

The architecture supports future capabilities including:

* real-time collaboration
* cross-engagement analytics
* predictive engagement health
* continuous assurance
* enterprise portfolio integration
* intelligent scheduling
* workload optimization
* autonomous operational recommendations

These capabilities extend the workspace without changing its architectural principles.

---

### 63.22 Architectural Constraints

The following architectural constraints are mandatory.

* The Engagement Workspace never owns business data.
* The Shared Audit State remains authoritative.
* Business Objects remain canonical.
* AI remains advisory.
* Human governance remains mandatory.
* Recommendations remain explainable.
* Navigation reflects Business Object relationships.
* Metrics are derived.
* Workspaces remain event-driven.
* The Engagement Workspace remains implementation-independent.

---

### 63.23 Summary

The Engagement Workspace serves as the operational command center of every assurance engagement within AuditOS.

By unifying planning, execution, governance, AI assistance, collaboration, analytics, and reporting around the Shared Audit State, the workspace provides users with a complete and continuously synchronized operational view of the engagement.

Rather than acting as another application screen, the Engagement Workspace becomes the primary environment through which assurance professionals understand, manage, and complete engagements while preserving explainability, governance, human accountability, and architectural consistency.

---
