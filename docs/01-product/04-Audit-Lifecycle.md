# PART II — PRODUCT

## Chapter 11 — Audit Lifecycle

---

### 11.1 Purpose

An assurance engagement is not a collection of independent activities.

It is a continuously evolving lifecycle where every stage builds upon the knowledge produced by previous stages.

AuditOS models this lifecycle explicitly.

Rather than treating planning, walkthroughs, evidence collection, testing, documentation, reporting, and review as disconnected modules, AuditOS treats them as successive refinements of the same Shared Audit State.

Every stage enriches understanding.

Every stage produces new relationships.

Every stage contributes to the final assurance opinion.

This chapter defines the operational lifecycle that governs every engagement executed within AuditOS.

**Release 1 Status (GitHub Issue #41 — Living Reporting and Operational
Findings).** The conceptual, product-level lifecycle below spans the full
engagement — from creation through organizational learning. Within one active
engagement, the concrete work an audit team executes day to day is the
**six-stage operational pipeline** the Engagement Workspace surfaces as
navigation (`prototype/js/workspaces/engagement.js`):

```text
Walkthrough → Evidence → Controls → Testing → Findings → Reporting
```

Each stage in that pipeline shows its completion, its blockers, its pending
approvals, and any AI suggestions in flight, and the connector joining two
stages carries the health of the one it leaves — **flowing** (green),
**waiting** (amber), or **blocked** (red) — so the pipeline reads as one
connected operational flow rather than disconnected cards. §11.13 below maps
this pipeline onto the broader fourteen-stage lifecycle.

Documentation is **not** a stage a user works in. Issue #41 removed the
Documentation workspace entirely: documentation is an internal AI artifact
that lives inside the report (concretely, the Reporting workspace's
continuously generated Section III — System Description), never a surface a
user opens to write or edit prose by hand. Wherever this chapter previously
described a standalone "Documentation" stage, that content now describes the
report's own continuous generation instead — see §11.13.

Pending work — evidence awaiting review, worksheets awaiting approval,
observations awaiting a management response, report edits awaiting a
decision — is not a separate stage or a standalone queue either. It lives
inside the workspace that owns it, and the six-stage pipeline's health
indicators are the one place it aggregates across the whole engagement.

---

## 11.2 Lifecycle Philosophy

Traditional audit software focuses on deliverables.

AuditOS focuses on understanding.

Deliverables are outcomes.

Understanding is the process.

The objective of every lifecycle stage is to improve the quality, completeness, confidence, and explainability of the Shared Audit State.

The lifecycle is therefore cumulative rather than sequential.

Knowledge produced during one stage remains available throughout every subsequent stage.

Nothing is discarded.

Nothing is recreated.

Understanding continuously matures.

---

## 11.3 The Audit Lifecycle

Every engagement progresses through the following high-level lifecycle.

```text
Engagement Creation
        │
        ▼
Planning & Scoping
        │
        ▼
Environment Understanding
        │
        ▼
Control Identification
        │
        ▼
Walkthroughs
        │
        ▼
Evidence Requests
        │
        ▼
Evidence Collection
        │
        ▼
Control Testing
        │
        ▼
Observations
        │
        ▼
Findings
        │
        ▼
Reporting
        │
        ▼
Review & Approval
        │
        ▼
Engagement Completion
        │
        ▼
Organizational Knowledge
```

Although represented sequentially, these stages frequently iterate throughout the engagement.

AuditOS therefore models progression rather than rigid phases.

---

## 11.4 Stage 1 — Engagement Creation

Every audit begins with the creation of an Engagement.

This establishes the operational container for all future work.

At this stage, the platform initializes:

* Client context.
* Engagement metadata.
* Audit framework.
* Audit period.
* Team members.
* Initial templates.
* Shared Audit State.
* Timeline.

No audit work exists yet.

Only the operational foundation has been established.

---

## 11.5 Stage 2 — Planning and Scoping

Planning defines what the engagement intends to evaluate.

Activities typically include:

* Defining objectives.
* Determining scope.
* Identifying systems.
* Identifying in-scope processes.
* Establishing timelines.
* Assigning responsibilities.
* Importing framework requirements.

The output of this stage is not documentation.

The output is an initial understanding of the engagement.

---

## 11.6 Stage 3 — Environment Understanding

Before controls can be evaluated, auditors must understand the client's environment.

This understanding is developed through:

* Background information.
* Organizational structure.
* Process understanding.
* Technology landscape.
* Business context.
* Existing documentation.

Artificial intelligence may assist by organizing information and identifying relationships.

Professional understanding remains a human responsibility.

---

## 11.7 Stage 4 — Control Identification

Requirements are translated into controls.

Controls become the operational representation of how the client satisfies assurance objectives.

Controls may be:

* Imported.
* Proposed.
* Refined.
* Merged.
* Split.
* Retired.

Throughout the engagement, controls remain living business objects rather than static documentation.

---

## 11.8 Stage 5 — Walkthroughs

Walkthroughs transform assumptions into verified understanding.

They validate:

* Process execution.
* Control operation.
* Roles and responsibilities.
* System interactions.
* Supporting evidence.
* Operational exceptions.

Walkthroughs are not meeting notes.

They are structured knowledge acquisition activities.

Artificial intelligence may summarize conversations, identify inconsistencies, suggest missing questions, and prepare documentation.

Human reviewers determine official understanding.

---

## 11.9 Stage 6 — Evidence Requests

Once understanding exists, evidence can be requested.

Evidence requests should always remain contextual.

Every request should explain:

* What is required.
* Why it is required.
* Which controls it supports.
* Expected format.
* Due date.
* Current status.

AuditOS should eliminate unnecessary back-and-forth communication by maintaining complete request context.

---

## 11.10 Stage 7 — Evidence Collection

Evidence is collected, validated, classified, and related to the Shared Audit State.

Evidence may support:

* Multiple requirements.
* Multiple controls.
* Multiple tests.
* Multiple findings.

Evidence should never require duplicate storage simply because it supports multiple business objects.

Artificial intelligence may assist with:

* Classification.
* Summarization.
* Metadata extraction.
* Relationship identification.

Evidence acceptance remains a human responsibility.

---

## 11.11 Stage 8 — Control Testing

Testing evaluates whether controls operate effectively.

Testing references:

* Requirements.
* Controls.
* Evidence.
* Samples.

Testing should remain fully traceable.

Every conclusion must reference supporting evidence.

Artificial intelligence may assist by identifying inconsistencies, missing evidence, or incomplete procedures.

Professional conclusions remain under human governance.

---

## 11.12 Stage 9 — Observations and Findings

Testing produces observations.

Professional evaluation transforms observations into findings.

This distinction is intentional.

Observations describe facts.

Findings describe conclusions.

Every finding should maintain explicit relationships with:

* Supporting observations.
* Evidence.
* Controls.
* Requirements.
* Risk.
* Testing.

Nothing should become disconnected from its supporting rationale.

---

## 11.13 Documentation as a Continuous, Internal Artifact — Not a Stage

Earlier drafts of this lifecycle modeled Documentation as its own stage
between Findings and Reporting. GitHub Issue #41 removed that stage: AuditOS
does not treat documentation as a place a user works.

Instead, documentation is a projection of the Shared Audit State that lives
**inside the report itself** — concretely, the Reporting workspace's Section
III (System Description), generated continuously from approved walkthroughs,
evidence, controls, testing, and findings by the Report Generation Service
(`prototype/js/services/report-generation-service.js`). Examples of the
knowledge this generation draws on include:

* Walkthrough understanding.
* Testing workpapers.
* Evidence summaries.
* Approved observations.
* Engagement narrative facts (Release 1: recorded counts per domain; Release
  2: AI-drafted prose over the same inputs, through the reserved
  `draftNarrative` extension point).

Documentation continuously evolves as engagement understanding matures — the
mechanism is unchanged from the original intent of this chapter. What changed
is where it surfaces: never a standalone workspace, always the report's own
generated content, with human approval required for every change before it
propagates (§11.13a).

### 11.13a The Six-Stage Operational Pipeline

Within an active engagement, the concrete work spanning Stages 5 through 11 of
this chapter — Walkthroughs through Reporting — is what the Engagement
Workspace's lifecycle rail presents as one connected operational pipeline:

| Pipeline stage | Corresponds to |
| --- | --- |
| Walkthrough | Stage 5 — Walkthroughs |
| Evidence | Stages 6–7 — Evidence Requests, Evidence Collection |
| Controls | Stage 4 — Control Identification (ongoing refinement) |
| Testing | Stage 8 — Control Testing |
| Findings | Stage 9 — Observations and Findings |
| Reporting | Stage 10 (renumbered below — Documentation no longer occupies a stage of its own), continuous from engagement start |

Every stage's health — flowing, waiting, or blocked — and its pending
approvals and AI suggestions are real, derived figures, never estimated. A
report edit that is approved propagates **upstream** through this same chain
— Reporting → Findings → Testing → Controls → Evidence → Walkthrough — as a
Suggestion each affected workspace's owner must approve before anything
regenerates (see the Reporting Workspace chapter, §69.16).

---

## 11.14 Stage 10 — Reporting

Reporting communicates the final understanding of the engagement.

Because reports derive directly from the Shared Audit State:

* Report consistency improves.
* Manual reconciliation decreases.
* Changes propagate automatically.
* Reviewer confidence increases.

Reports remain synchronized with the engagement throughout preparation.

---

## 11.15 Stage 11 — Review and Approval

Every authoritative change passes through formal review.

Approval applies to:

* Report edits (which carry the engagement's documentation with them).
* AI recommendations.
* Findings.
* Reports.
* Significant state transitions.

Reviewers should never approve isolated text.

They approve understanding.

AuditOS therefore presents complete context before approval decisions are made.

Every approval records:

* Reviewer.
* Timestamp.
* Decision.
* Reasoning.
* State transition.

---

## 11.16 Stage 12 — Engagement Completion

Completion represents the transition from active engagement to organizational knowledge.

Final deliverables are produced.

Outstanding activities are resolved.

The Shared Audit State becomes read-only.

Historical traceability is preserved indefinitely.

The engagement remains available for future reference.

Completion never destroys knowledge.

---

## 11.17 Stage 13 — Organizational Learning

Every completed engagement contributes to future engagements.

Examples include:

* Improved templates.
* Better documentation.
* Stronger report structures.
* Better prompts.
* Better workflows.
* Better evidence requests.
* Better organizational guidance.

AuditOS therefore transforms completed engagements into organizational knowledge assets.

Institutional knowledge grows continuously.

---

## 11.18 AI Throughout the Lifecycle

Artificial intelligence participates throughout every lifecycle stage.

Its responsibilities evolve with the engagement.

During planning it organizes information.

During walkthroughs it assists understanding.

During evidence collection it identifies relationships.

During testing it identifies inconsistencies.

During report generation it prepares drafts of narrative sections (Release 2
— Release 1 renders only recorded facts, drafting nothing).

During reporting it proposes refinements.

During review it explains recommendations.

Artificial intelligence remains continuously available but never becomes the authority for engagement decisions.

Every recommendation remains subject to explicit human approval.

---

## 11.19 Lifecycle Events

Every lifecycle stage produces operational events.

Examples include:

* Engagement Created
* Scope Updated
* Walkthrough Completed
* Evidence Requested
* Evidence Received
* Testing Started
* Testing Completed
* Observation Recorded
* Finding Created
* Recommendation Generated
* Recommendation Approved
* Report Section Regenerated
* Report Generated
* Engagement Closed

These events enrich the Timeline and enable every workspace and AI agent to remain synchronized without direct coupling.

---

## 11.20 Lifecycle Principles

The AuditOS lifecycle is governed by the following principles.

* Every stage enriches the Shared Audit State.
* Knowledge accumulates rather than resets.
* Artificial intelligence assists every stage without replacing professional judgment.
* Human approval governs every authoritative change.
* Documentation is derived from understanding, and lives inside the report — never a stage of its own.
* Reports are generated from knowledge, continuously, from engagement start.
* Every action is traceable.
* Every recommendation is explainable.
* Organizational knowledge compounds across engagements.
* The engagement evolves continuously until completion.

The Audit Lifecycle defines the operational heartbeat of AuditOS.

It is the mechanism through which knowledge matures, decisions are governed, artificial intelligence collaborates with professionals, and assurance engagements progress from initial planning to trusted delivery while preserving complete transparency and traceability.
