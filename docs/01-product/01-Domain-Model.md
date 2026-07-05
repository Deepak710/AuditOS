# PART II — PRODUCT

## Chapter 8 — Domain Model

---

### 8.1 Purpose

The Domain Model defines the conceptual language of AuditOS.

Every feature, workflow, user interface, artificial intelligence agent, repository artifact, workflow automation, and integration shall operate using the concepts defined within this chapter.

This document is intentionally independent of implementation technologies, databases, APIs, programming languages, or storage mechanisms.

It defines **what the platform understands**, not **how the platform stores it**.

Every future engineering decision should map directly to this domain model.

If new concepts cannot be expressed using this model, the model—not the implementation—should be reviewed.

---

## 8.2 Domain Philosophy

Traditional audit software is document-centric.

AuditOS is domain-centric.

The platform does not revolve around pages, workpapers, reports, or forms.

Instead, it revolves around a continuously evolving understanding of an assurance engagement.

Everything within AuditOS exists because it contributes to that understanding.

Every object within the platform has a clearly defined responsibility.

Objects collaborate.

They never duplicate responsibility.

This separation allows the platform to evolve without creating architectural inconsistency.

---

## 8.3 Domain Hierarchy

The AuditOS domain is intentionally hierarchical.

```
Organization

└── Client

    └── Engagement

        ├── Scope

        ├── Requirements

        ├── Controls

        ├── Risks

        ├── Walkthroughs

        ├── Evidence

        ├── Samples

        ├── Testing

        ├── Observations

        ├── Findings

        ├── Documentation

        ├── Reports

        ├── AI Recommendations

        ├── Approvals

        ├── Timeline

        └── Shared Audit State
```

Every object ultimately belongs to an Engagement.

Nothing exists independently.

---

## 8.4 Core Domain Objects

AuditOS is built around a relatively small number of core business objects.

These objects should remain stable throughout the lifetime of the platform.

They define the vocabulary used across every workflow.

---

### Organization

An Organization represents the assurance practice using AuditOS.

Responsibilities include:

* Organizational configuration
* Global templates
* Global knowledge
* Branding
* Policies
* AI provider configuration
* Security configuration
* User management

An Organization owns multiple Clients.

---

### Client

A Client represents the organization being audited.

A Client contains:

* Client profile
* Organizational knowledge
* Historical engagements
* Client-specific templates
* Client-specific terminology
* Contacts
* Business units

A Client owns multiple Engagements.

---

### Engagement

The Engagement is the primary operational entity within AuditOS.

Everything performed inside AuditOS ultimately belongs to an Engagement.

The Engagement represents the complete lifecycle of an assurance engagement.

It owns:

* Scope
* Requirements
* Controls
* Walkthroughs
* Evidence
* Testing
* Documentation
* Reporting
* Approvals
* AI Recommendations
* Timeline
* Shared Audit State

No other object has greater authority.

---

## 8.5 Shared Audit State

The Shared Audit State is the most important object within the platform.

It represents the current understanding of the engagement.

It is not a document.

It is not a report.

It is not a workpaper.

It is not a database table.

It is the authoritative operational state from which every other artifact is derived.

Every workflow modifies the Shared Audit State.

Every page visualizes the Shared Audit State.

Every AI agent reasons against the Shared Audit State.

Every report reflects the Shared Audit State.

Only one Shared Audit State exists per Engagement.

---

## 8.6 Requirements

Requirements define what the engagement must evaluate.

Initially these originate from the SOC 2 Trust Services Criteria.

Future versions may introduce additional assurance frameworks.

Requirements are independent of implementation.

Requirements relate to:

* Controls
* Risks
* Testing
* Evidence
* Findings
* Reports

Requirements never belong directly to documents.

They belong to the Engagement.

---

## 8.7 Controls

Controls represent organizational activities that satisfy one or more Requirements.

Controls evolve throughout the engagement.

They may be:

* Proposed
* Draft
* Reviewed
* Approved
* Tested
* Effective
* Ineffective
* Archived

Controls are living objects rather than static text.

Multiple artifacts may reference the same Control.

Only one authoritative version exists.

---

## 8.8 Risks

Risks describe conditions that could prevent Requirements from being satisfied.

Risks influence:

* Scope
* Testing
* Sampling
* Documentation
* Reporting

Risks evolve as understanding improves.

---

## 8.9 Walkthroughs

Walkthroughs capture operational understanding.

A Walkthrough is not simply meeting notes.

It represents structured knowledge about how a process currently operates.

Walkthroughs continuously refine:

* Controls
* Risks
* Documentation
* Testing
* Evidence requests

Artificial intelligence may summarize Walkthroughs.

Human reviewers determine official understanding.

---

## 8.10 Evidence

Evidence represents information supporting audit conclusions.

Evidence may originate from:

* Documents
* Screenshots
* System exports
* Interviews
* Demonstrations
* Recordings
* Configuration data
* Policies
* Procedures

Evidence belongs to the Engagement.

It may support multiple Controls simultaneously.

Evidence should never require duplicate storage.

---

## 8.11 Samples

Samples represent selected instances evaluated during testing.

Sample selection should remain explainable.

Every sample maintains relationships with:

* Controls
* Testing
* Evidence
* Findings

---

## 8.12 Testing

Testing evaluates whether Controls operate effectively.

Testing references:

* Requirements
* Controls
* Evidence
* Samples

Testing produces observations rather than conclusions.

Professional judgment determines conclusions.

---

## 8.13 Observations

Observations represent factual statements identified during testing.

Observations are objective.

They describe what was observed.

They do not necessarily indicate deficiencies.

---

## 8.14 Findings

Findings represent evaluated conclusions based upon one or more Observations.

Findings may include:

* Severity
* Impact
* Root cause
* Recommendation
* Management response
* Status

Findings contribute directly to reporting.

---

## 8.15 Documentation

Documentation represents structured outputs generated from the Shared Audit State.

Examples include:

* Walkthrough documentation
* Workpapers
* Narratives
* Testing documentation
* Evidence summaries
* Internal notes

Documentation is derived.

It is not authoritative.

---

## 8.16 Reports

Reports communicate engagement conclusions.

Reports are generated from the Shared Audit State.

Report sections should reference underlying knowledge rather than maintaining independent copies of information.

---

## 8.17 AI Recommendation

Artificial intelligence never directly modifies the engagement.

Instead, it produces Recommendations.

Each Recommendation contains:

* Proposed action
* Reasoning
* Supporting context
* Affected objects
* Confidence
* Expected impact
* Approval status

Recommendations become official only after human approval.

---

## 8.18 Approval

Approvals govern every authoritative modification.

An Approval records:

* Reviewer
* Timestamp
* Decision
* Comments
* Associated recommendation
* State transition

No official engagement change occurs without approval.

---

## 8.19 Timeline

The Timeline records every significant event.

It is immutable.

It includes:

* Human actions
* AI recommendations
* Approvals
* Rejections
* Workflow execution
* State transitions
* Generated artifacts

The Timeline enables complete engagement traceability.

---

## 8.20 Domain Relationships

The relationships between the primary objects are intentionally simple.

```
Organization
    ↓
Client
    ↓
Engagement
    ↓
Shared Audit State
    ↓
Requirements
    ↓
Controls
    ↓
Evidence
    ↓
Testing
    ↓
Observations
    ↓
Findings
    ↓
Documentation
    ↓
Reports
```

Artificial intelligence operates across the entire domain but owns none of these objects.

It observes.

Reasons.

Recommends.

Humans govern.

---

## 8.21 Domain Integrity Rules

The following rules shall never be violated.

* Every Engagement owns exactly one Shared Audit State.
* Every business object belongs to one Engagement.
* Documents are derived artifacts.
* Reports are derived artifacts.
* AI owns no business data.
* Pages own no business data.
* Recommendations never become authoritative without approval.
* Relationships are explicit rather than inferred.
* Historical state is preserved.
* Traceability is never optional.

These rules establish the conceptual foundation upon which the remainder of AuditOS is built.

Every subsequent architectural chapter assumes this domain model as the authoritative representation of the platform.
