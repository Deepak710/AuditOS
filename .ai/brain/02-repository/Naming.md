# AuditOS AI Brain

# Naming Standards

Version: 1.0

Status: Permanent

Classification: Repository Naming Standards

Owner: AuditOS Architecture

---

# 1. Purpose

This document defines the naming standards used throughout the AuditOS repository.

Consistent naming is one of the simplest ways to preserve architectural quality.

A contributor should understand the purpose of a file, folder, component, Business Object, Workspace, AI Agent, or document simply by reading its name.

Naming is architecture.

Not decoration.

---

# 2. Philosophy

Names should communicate business meaning.

Not implementation.

Not technology.

Not personal preference.

A good name should answer:

What is it?

What responsibility does it own?

How does it fit within the platform?

---

# 3. Primary Rule

Always prefer business language over technical language.

Correct:

Evidence

Walkthrough

Recommendation

Approval

Control

Finding

Timeline

Incorrect:

DataManager

ProcessHandler

AuditEngineV2

Helper

Stuff

Manager

Utils

Business language survives technology changes.

---

# 4. Consistency

One concept.

One name.

Always.

Never create multiple names for the same architectural concept.

Examples:

Always:

Shared Audit State

Never:

Shared State

Global State

Application State

Audit Context

Consistency improves both human understanding and AI reasoning.

---

# 5. Business Objects

Business Objects use singular nouns.

Examples:

Engagement

Requirement

Control

Risk

Evidence

Walkthrough

Test

Observation

Finding

Recommendation

Approval

Report

Timeline Event

Template

Avoid plural Business Object names.

---

# 6. Workspace Naming

Workspace names describe professional responsibilities.

Examples:

Dashboard

Engagement

Scope

Requirements

Controls

Walkthroughs

Evidence

Testing

Findings

Reports

Timeline

Knowledge

Approvals

Settings

Workspace names should be immediately understandable by auditors.

---

# 7. AI Agent Naming

Every AI Agent follows the same pattern.

```text
<Responsibility> Agent
```

Examples:

Documentation Agent

Evidence Agent

Walkthrough Agent

Testing Agent

Sampling Agent

IPE Agent

Reporting Agent

Knowledge Agent

Planning Agent

Review Agent

Avoid creative or marketing-oriented names.

Agents should be recognized by responsibility.

---

# 8. Engine Naming

Core architectural services use the suffix:

Engine

Examples:

Context Engine

Recommendation Engine

Approval Engine

Search Engine

Notification Engine

Rules Engine

Orchestration Engine

Each Engine owns one architectural responsibility.

---

# 9. Service Naming

Platform services use the suffix:

Service

Examples:

Export Service

Import Service

Authentication Service

Notification Service

Integration Service

Synchronization Service

Services perform platform operations.

Engines perform architectural reasoning.

---

# 10. Event Naming

Events describe completed facts.

Pattern:

```text
<Noun> <Past Tense Verb>
```

Examples:

Evidence Uploaded

Recommendation Approved

Finding Created

Control Updated

Walkthrough Completed

Report Generated

Timeline Updated

Avoid future tense.

Avoid commands.

Avoid intentions.

Events describe history.

---

# 11. Command Naming

Commands describe intended actions.

Pattern:

```text
<Verb> <Business Object>
```

Examples:

Create Finding

Approve Recommendation

Upload Evidence

Generate Report

Request Review

Commands initiate work.

Events describe completed work.

Never confuse them.

---

# 12. Component Naming

UI Components should describe business purpose.

Correct:

EvidenceCard

RecommendationPanel

ApprovalDialog

TimelineItem

FindingTable

ControlSidebar

Incorrect:

BlueCard

MainWidget

Card2

ComponentFinal

WidgetNew

Names should survive visual redesigns.

---

# 13. File Naming

Markdown documentation should use:

```text
Title-Case-With-Hyphens.md
```

Examples:

Shared-Audit-State.md

Human-Approval-Engine.md

Workspace-Design-System.md

AI-Agent-Architecture.md

Use descriptive names.

Avoid abbreviations unless universally understood.

---

# 14. Directory Naming

Directories describe architectural domains.

Examples:

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

Directories should remain stable throughout the lifetime of the project.

---

# 15. Variable Naming

Implementation code should use descriptive names.

Prefer:

currentEngagement

selectedEvidence

pendingApproval

recommendationList

Avoid:

data

temp

object

result

item

x

Naming should reduce the need for comments.

---

# 16. Function Naming

Functions should describe actions.

Examples:

createRecommendation()

loadEvidence()

approveFinding()

calculateRiskScore()

renderTimeline()

Avoid generic names.

Every function should communicate one responsibility.

---

# 17. CSS Naming

CSS should describe responsibility.

Not appearance.

Correct:

workspace-header

recommendation-card

timeline-item

approval-panel

Incorrect:

blue-box

large-text

card-final

left-column2

Styles should remain meaningful even after redesign.

---

# 18. JSON Naming

JSON properties should reflect Business Objects.

Examples:

engagement

control

recommendation

approval

timeline

relationship

metadata

Avoid implementation-specific terminology.

---

# 19. Configuration Naming

Configuration files should communicate purpose clearly.

Examples:

routing.json

permissions.json

navigation.json

workspace-layout.json

theme.json

Avoid vague names such as:

config2.json

settings-new.json

test.json

---

# 20. Documentation Naming

Every document should explain one responsibility.

Examples:

AI-Architecture.md

Repository-Architecture.md

Performance-and-Scalability.md

Target-Users-and-Personas.md

Avoid overly broad titles.

Avoid ambiguous titles.

---

# 21. Naming Things to Avoid

Never use:

Manager

Helper

Utils

Thing

Misc

Temp

Final

New

Old

V2

Latest

Experimental

Production names should communicate responsibility.

Not development history.

---

# 22. Version Naming

Version numbers belong in document metadata.

Not filenames.

Correct:

Repository-Architecture.md

Version: 2.0

Incorrect:

Repository-Architecture-v2.md

Repository-Architecture-Final.md

Repository-Architecture-New.md

The repository should contain one authoritative document.

---

# 23. Abbreviations

Avoid abbreviations unless universally recognized.

Acceptable examples:

AI

UX

SOC 2

API

JSON

HTML

CSS

JavaScript

Prefer full words whenever possible.

---

# 24. Naming Checklist

Before introducing any new name ask:

Does it describe business meaning?

Is it consistent with repository terminology?

Is it implementation-independent?

Will another contributor immediately understand it?

Will the name still make sense five years from now?

If not, rename it.

---

# 25. Naming Principles

The AuditOS repository follows these permanent naming principles.

Business before technology.

Meaning before brevity.

Consistency before creativity.

Architecture before implementation.

Responsibility before appearance.

Clarity before cleverness.

One concept.

One name.

Always.

---

# 26. Naming Vision

As AuditOS grows into hundreds of documents, components, Workspaces, Business Objects, AI Agents, and implementation artifacts, naming consistency will become one of the platform's greatest architectural strengths.

A contributor should be able to infer responsibility simply by reading a name.

An AI assistant should understand relationships without additional explanation.

The repository should become self-describing through disciplined naming.

Every name should reduce ambiguity.

Every name should reinforce architecture.

Every name should teach the platform.
