# PART I — FOUNDATIONS

## Chapter 6 — Target Users and Personas

---

### 6.1 Purpose

AuditOS is designed to support assurance engagements rather than individual job titles.

An engagement is executed by multiple professionals with different responsibilities, perspectives, permissions, and objectives. Every user contributes to the same Shared Audit State, but each interacts with it differently.

The purpose of this chapter is to define the primary users of AuditOS, their responsibilities, their goals, and the design principles that guide their experience.

These personas describe functional responsibilities rather than organizational titles. Different organizations may combine or separate these responsibilities according to their own operating model.

---

### 6.2 User-Centric Design Philosophy

AuditOS is not designed around artificial intelligence.

It is not designed around pages.

It is not designed around features.

It is designed around the people responsible for delivering assurance engagements.

Every screen, workflow, recommendation, and interaction should answer one question:

> **How does this help the user perform assurance work with greater confidence, consistency, and efficiency?**

Artificial intelligence exists to support users.

Users do not exist to support artificial intelligence.

---

### 6.3 Primary Personas

The first release of AuditOS focuses on six primary personas.

Each persona interacts with the same engagement while viewing different aspects of the Shared Audit State.

---

### 6.4 Engagement Lead

The Engagement Lead is responsible for the overall success of the engagement.

#### Primary Responsibilities

* Define engagement scope.
* Plan the engagement.
* Allocate work.
* Monitor progress.
* Review major decisions.
* Manage client communication.
* Approve AI recommendations.
* Approve final deliverables.

#### Primary Questions

* Is the engagement on schedule?
* What requires my attention?
* What risks have emerged?
* What decisions remain pending?
* Which recommendations require approval?
* What is blocking progress?

#### Success Criteria

The Engagement Lead should be able to understand the health of an engagement within minutes without reading every underlying document.

AuditOS should continuously surface meaningful insights rather than requiring manual investigation.

---

### 6.5 Auditor

The Auditor performs the operational work of the engagement.

This persona spends the greatest amount of time inside AuditOS.

#### Primary Responsibilities

* Conduct walkthroughs.
* Request evidence.
* Evaluate controls.
* Perform testing.
* Document procedures.
* Update engagement information.
* Review AI-generated recommendations.
* Collaborate with reviewers.

#### Primary Questions

* What should I work on next?
* What information is missing?
* Which evidence is outstanding?
* What changed since yesterday?
* Which recommendations should I review?
* What dependencies affect my work?

#### Success Criteria

AuditOS should eliminate repetitive administrative work so auditors can focus on understanding the client's environment and exercising professional judgment.

---

### 6.6 Reviewer

The Reviewer validates engagement quality before information becomes authoritative.

#### Primary Responsibilities

* Review documentation.
* Evaluate evidence.
* Validate conclusions.
* Review AI recommendations.
* Approve or reject changes.
* Ensure consistency.
* Maintain engagement quality.

#### Primary Questions

* What changed?
* Why did it change?
* Who made the recommendation?
* What evidence supports it?
* What downstream impact will approval have?
* What still requires review?

#### Success Criteria

Reviewers should spend time evaluating quality rather than locating information.

AuditOS should automatically present complete context for every approval decision.

---

### 6.7 Subject Matter Expert

The Subject Matter Expert provides specialized knowledge during complex engagements.

Examples include specialists in cloud security, identity management, infrastructure, privacy, or compliance.

#### Primary Responsibilities

* Review specialized controls.
* Provide expert guidance.
* Validate technical conclusions.
* Answer engagement questions.
* Improve organizational knowledge.

#### Primary Questions

* What requires specialist review?
* Which controls involve my expertise?
* What supporting evidence exists?
* What assumptions have been made?
* What recommendations require validation?

#### Success Criteria

Experts should receive only the information necessary to perform their review without navigating unrelated engagement content.

---

### 6.8 Client Representative

The Client Representative participates in evidence submission and clarification.

This persona interacts with a deliberately simplified experience compared with internal engagement users.

#### Primary Responsibilities

* Respond to evidence requests.
* Provide documentation.
* Answer clarification questions.
* Review information requests.
* Track request status.

#### Primary Questions

* What information is required?
* Why is it required?
* When is it needed?
* What has already been submitted?
* What remains outstanding?

#### Success Criteria

Clients should clearly understand requests without needing extensive audit knowledge.

AuditOS should minimize unnecessary communication by providing clear context and request status.

---

### 6.9 Platform Administrator

The Platform Administrator manages the operational environment rather than individual engagements.

#### Primary Responsibilities

* Configure templates.
* Manage organizational settings.
* Configure AI providers.
* Manage permissions.
* Maintain integrations.
* Monitor platform health.
* Configure organizational knowledge.

#### Primary Questions

* Is the platform healthy?
* Are integrations functioning?
* Are AI providers available?
* Are templates current?
* Are users correctly configured?
* Are organizational policies being followed?

#### Success Criteria

Platform administration should be powerful, predictable, and isolated from day-to-day engagement activities.

---

### 6.10 Shared Expectations

Regardless of role, every user should experience the same fundamental characteristics.

Users should always know:

* The current state of the engagement.
* What requires attention.
* What changed.
* Why it changed.
* What happens next.

No user should need to manually assemble context from multiple locations.

AuditOS should present the appropriate information at the appropriate time.

---

### 6.11 Permissions Philosophy

Permissions within AuditOS exist to protect governance rather than restrict productivity.

Visibility should be as open as organizational policy permits.

Authority should be granted only where responsibility exists.

Artificial intelligence recommendations should always remain reviewable by appropriately authorized users.

Approval authority shall always reflect organizational governance rather than artificial intelligence confidence.

---

### 6.12 Future Personas

The initial proof of concept intentionally limits supported personas.

Future versions of AuditOS may introduce additional specialized roles including:

* Quality Assurance Reviewer
* Practice Leader
* Risk Manager
* External Assessor
* Internal Audit Manager
* Compliance Officer
* Security Operations Reviewer
* Executive Stakeholder
* Regulatory Observer
* Custom organizational roles

The architecture shall support future personas through configuration rather than redesign.

---

### 6.13 Persona Design Principles

Every user experience within AuditOS shall follow these principles.

Users see only the complexity necessary for their responsibilities.

Artificial intelligence should proactively reduce operational effort.

Every recommendation should arrive with sufficient context to make an informed decision.

Navigation should reflect professional workflows rather than system architecture.

The platform should adapt to different responsibilities without fragmenting the Shared Audit State.

Regardless of role, every participant contributes to the same engagement.

The experience changes.

The source of truth never does.
