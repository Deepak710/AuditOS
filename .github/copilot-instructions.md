# GitHub Copilot Instructions for AuditOS

> **These instructions define how GitHub Copilot must contribute to the AuditOS repository.**

---

# Identity

You are contributing to **AuditOS**, an AI Operating System for Modern Assurance.

This repository is engineered using an **Architecture-First** methodology.

Implementation is never allowed to redefine architecture.

The repository—not the conversation—is the source of truth.

---

# Before Writing Any Code

Always read, understand, and follow the AI Brain before generating implementation.

Read the following documents in this exact order:

```text
.ai/brain/README.md

.ai/brain/00-Core/
    CONTEXT.md
    CONSTITUTION.md
    RULES.md
    DESIGN.md
    WORKFLOW.md

.ai/brain/01-Architecture/
    Product.md
    UX.md
    AI.md
    Engineering.md

.ai/brain/02-Repository/
    Repository.md
    Folder-Guide.md
    Naming.md

.ai/brain/03-Development/
    Coding.md
    Reviews.md
    GitHub.md

.ai/brain/04-AI/
    Prompting.md
    Zoo.md
    Claude.md

.ai/brain/05-Implementation/
    Static-Prototype.md
    Issue-Template.md
```

If documentation and implementation conflict,

**documentation wins.**

---

# Project Vision

AuditOS is **NOT**:

* an AI chatbot
* an audit documentation generator
* an automation tool
* an AI assistant

AuditOS is an **AI Operating System for Modern Assurance**.

Artificial Intelligence exists to support professionals.

Humans always make decisions.

---

# Current Development Phase

Current phase:

**Static Proof of Concept**

Do **NOT** introduce:

* Backend
* Authentication
* Authorization
* Database
* APIs
* Microsoft services
* Copilot Studio
* Power Platform
* SharePoint
* Production infrastructure

Everything must work by opening:

```text
prototype/index.html
```

---

# Technology Stack

Current stack:

* Vanilla HTML
* Vanilla CSS
* Vanilla JavaScript
* Bootstrap (Local)
* Bootstrap Icons (Local)
* Chart.js
* SortableJS
* Local JSON

Do not introduce:

* React
* Angular
* Vue
* Next.js
* Build systems
* TypeScript
* npm dependencies
* Additional frameworks

unless explicitly instructed.

---

# Product Architecture

Everything revolves around the:

**Shared Audit State**

Pages do not own data.

Components do not own business state.

Artificial Intelligence does not own business state.

Reports do not own business state.

The Shared Audit State is the single source of truth.

---

# Artificial Intelligence

Artificial Intelligence always follows this lifecycle.

```text
Context

↓

Reasoning

↓

Recommendation

↓

Human Approval

↓

Shared Audit State

↓

Timeline
```

Artificial Intelligence never:

* approves work
* modifies business objects directly
* bypasses governance
* bypasses human approval

---

# Event-Driven Architecture

Whenever architecture requires communication,

use Events.

Never tightly couple modules.

Examples:

* Evidence Uploaded
* Recommendation Approved
* Finding Created
* Timeline Updated

Events describe completed business facts.

---

# Business Language

Always use repository terminology.

Correct:

* Workspace
* Shared Audit State
* Recommendation
* Business Object
* Human Approval
* Context Engine
* Timeline
* Evidence
* Walkthrough
* Control

Do not invent synonyms.

---

# User Experience

AuditOS should feel:

* Professional
* Calm
* Modern
* Information-rich
* Beautiful
* Predictable
* Enterprise-grade

Do not create flashy interfaces.

Do not remove important information to achieve minimalism.

The objective is **high information density with low cognitive load**.

---

# Component Standards

Create reusable components.

Each component owns one responsibility.

Examples:

Workspace Header

Recommendation Card

Approval Panel

Timeline

Evidence Table

Filter Bar

Do not create one-off implementations.

---

# Coding Standards

Implementation must be:

* Readable
* Modular
* Accessible
* Reusable
* Maintainable
* Repository-consistent

Avoid:

* duplication
* unnecessary abstractions
* clever implementations
* temporary code
* architectural shortcuts

---

# Accessibility

Always support:

* keyboard navigation
* semantic HTML
* logical focus order
* accessible contrast
* reduced motion

Accessibility is mandatory.

---

# Repository Rules

Never:

* invent architecture
* invent workflows
* invent Business Objects
* invent AI behavior
* contradict repository documentation
* introduce undocumented terminology
* duplicate repository knowledge

When uncertain,

stop and request clarification.

---

# Expected Workflow

Every implementation follows:

```text
Understand

↓

Read Repository

↓

Review Architecture

↓

Review Documentation

↓

Implement

↓

Review

↓

Refine

↓

Update Documentation
```

Never skip architectural understanding.

---

# GitHub Workflow

Assume every implementation begins with a GitHub Issue.

Every implementation should satisfy:

* Issue objective
* Acceptance criteria
* Repository standards
* Coding standards
* Accessibility standards
* Review standards

---

# Self-Review

Before completing any task verify:

* Architecture preserved?
* Shared Audit State respected?
* Repository terminology reused?
* Components reusable?
* Accessibility maintained?
* No duplicated logic?
* Documentation still accurate?
* Future AI integration preserved?

If any answer is "No",

continue refining before returning the result.

---

# Long-Term Goal

The purpose of every contribution is not simply to complete a task.

The purpose is to strengthen AuditOS.

Every implementation should improve:

* architecture
* maintainability
* readability
* repository quality
* engineering quality
* professional user experience

Every contribution should make the platform easier to understand, easier to extend, and easier for future AI systems and human engineers to evolve.

When in doubt,

choose the solution that best preserves the long-term architecture of AuditOS.
