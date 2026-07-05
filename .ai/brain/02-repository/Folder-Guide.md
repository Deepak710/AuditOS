# AuditOS AI Brain

# Repository Folder Guide

Version: 1.0

Status: Permanent

Classification: Repository Structure

Owner: AuditOS Architecture

---

# 1. Purpose

This document explains the purpose and responsibility of every major directory within the AuditOS repository.

It exists to ensure that every contributor—human or Artificial Intelligence—understands where knowledge belongs before creating new files.

Repository organization is part of the architecture.

Folders represent responsibilities.

Not storage locations.

Every directory should have a clearly defined purpose.

---

# 2. Repository Philosophy

The repository is organized around architecture.

Not technology.

Not programming language.

Not implementation convenience.

Every top-level directory owns one architectural responsibility.

Knowledge should naturally flow through the repository without duplication.

---

# 3. High-Level Repository Structure

The repository is organized as follows.

```text
AuditOS
│
├── .ai/
├── docs/
├── prototype/
├── assets/
├── shared/
├── scripts/
├── tools/
├── templates/
├── samples/
├── tests/
├── .github/
└── configuration
```

Future directories should follow the same architectural philosophy.

---

# 4. .ai/

The `.ai` directory contains everything required for Artificial Intelligence contributors.

It is the permanent operating manual for AI-assisted development.

Examples include:

AI Brain.

Prompt libraries.

Architectural guidance.

Implementation guidance.

Development workflows.

AI-specific configuration.

Artificial Intelligence should begin here before reading any implementation.

---

# 5. .ai/brain/

The AI Brain is the highest-value directory within `.ai`.

It contains the permanent architectural knowledge required by:

ChatGPT.

Zoo Code.

Claude Code.

GitHub Copilot.

Future AI assistants.

The AI Brain should explain:

The product.

The architecture.

The repository.

Engineering standards.

Design language.

Development workflow.

Future contributors should require minimal additional prompting after reading the AI Brain.

---

# 6. docs/

The `docs` directory contains the permanent Architecture & Engineering Handbook.

It documents:

Product vision.

Architecture.

User Experience.

Artificial Intelligence.

Engineering.

Security.

Data.

Frameworks.

Components.

Workspaces.

Operations.

Roadmaps.

Documentation is implementation-independent.

It explains what the platform is.

Not how one technology implements it.

---

# 7. prototype/

The `prototype` directory contains the working Proof of Concept.

Current technology stack:

Vanilla HTML.

Vanilla CSS.

Vanilla JavaScript.

Bootstrap.

Bootstrap Icons.

Chart.js.

SortableJS.

Local JSON.

The prototype validates architecture, workflows, navigation, and User Experience.

It intentionally excludes production infrastructure.

---

# 8. assets/

The `assets` directory contains reusable visual and static resources.

Examples include:

Images.

Icons.

Fonts.

Illustrations.

Brand assets.

Static media.

Sample screenshots.

Static assets should never contain business logic.

---

# 9. shared/

The `shared` directory contains reusable implementation assets.

Examples include:

Shared JavaScript.

Shared CSS.

Design tokens.

Utility functions.

Constants.

Configuration.

Localization.

Shared resources should exist only once.

Duplication should be avoided.

---

# 10. scripts/

The `scripts` directory contains engineering automation.

Examples include:

Repository utilities.

Development helpers.

Validation tools.

Documentation generation.

Build automation (future).

Scripts support engineering.

They do not define architecture.

---

# 11. tools/

The `tools` directory contains supporting utilities used during development.

Examples include:

Repository tooling.

Developer utilities.

Migration helpers.

Conversion utilities.

Analysis tools.

Tooling should remain isolated from product implementation.

---

# 12. templates/

The `templates` directory contains reusable templates.

Examples include:

Audit templates.

Report templates.

Walkthrough templates.

Evidence request templates.

Issue templates.

Prompt templates.

Future framework templates.

Templates accelerate work.

They never define architecture.

---

# 13. samples/

The `samples` directory contains demonstration content.

Examples include:

Sample engagements.

Sample evidence.

Sample walkthroughs.

Sample reports.

Example datasets.

Sample AI recommendations.

Samples exist for demonstration and testing.

Not production use.

---

# 14. tests/

The `tests` directory contains validation assets.

Future examples include:

Unit tests.

Integration tests.

Accessibility tests.

Performance tests.

Visual regression.

Workflow validation.

Architecture validation.

Testing strengthens engineering quality.

---

# 15. .github/

The `.github` directory contains repository governance.

Examples include:

Issue templates.

Pull request templates.

GitHub Actions.

Labels.

Workflows.

Community standards.

Repository automation.

This directory supports collaboration rather than product functionality.

---

# 16. Documentation Organization

The documentation hierarchy should remain stable.

```text
00-overview

01-product

02-ux

03-ai

04-engineering

05-security

06-data

07-framework

08-workspaces

09-components

10-ai-agents

11-integrations

12-operations

13-roadmap

14-decisions

15-appendices
```

Every future document belongs within this structure unless architectural review determines otherwise.

---

# 17. AI Brain Organization

The AI Brain is organized into specialized knowledge areas.

```text
00-Core

01-Architecture

02-Repository

03-Development

04-AI

05-Implementation
```

Each directory has one responsibility.

The AI Brain should remain modular.

Not monolithic.

---

# 18. Folder Ownership

Every directory should answer one question.

Examples:

`.ai`

How should AI understand the project?

`docs`

What is the platform?

`prototype`

How is the current Proof of Concept implemented?

`assets`

Which reusable resources exist?

`shared`

Which reusable implementation assets exist?

Ownership should never overlap unnecessarily.

---

# 19. Creating New Directories

Before creating a directory ask:

Does an existing directory already own this responsibility?

Is this architectural or implementation knowledge?

Will future contributors naturally look here?

Does this improve repository organization?

If the answer is uncertain, architectural review should occur before creation.

---

# 20. File Placement

Every file should have one obvious location.

If multiple locations appear equally appropriate, repository organization should be reconsidered.

Ambiguous ownership usually indicates architectural duplication.

---

# 21. Repository Navigation

A contributor should understand the repository without external explanation.

Reading directory names should reveal:

What exists.

Why it exists.

Where future work belongs.

Repository navigation should feel intuitive.

---

# 22. Growth Strategy

As AuditOS grows, the repository should grow by extending existing architectural categories rather than introducing unrelated top-level directories.

Growth should increase clarity.

Not fragmentation.

---

# 23. Folder Principles

The repository follows these permanent organizational principles.

Architecture before technology.

Responsibilities before implementation.

Knowledge before storage.

One directory, one purpose.

Reuse before duplication.

Documentation before code.

Business terminology before technical terminology.

Institutional knowledge before temporary conversations.

---

# 24. Repository Vision

The long-term objective is to create a repository that explains itself.

A new contributor should understand where every new file belongs.

A new AI assistant should understand repository organization without additional prompting.

Every directory should communicate architectural intent.

Every file should reinforce repository structure.

Every future addition should strengthen rather than complicate navigation.

The repository should become a model of architectural organization where structure itself teaches contributors how AuditOS is designed, implemented, and evolved.
