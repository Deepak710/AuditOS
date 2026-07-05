# AuditOS AI Brain

# AI Prompting Standards

Version: 1.0

Status: Permanent

Classification: AI Engineering Standards

Owner: AuditOS Architecture

---

# 1. Purpose

This document defines how Artificial Intelligence should be prompted when contributing to AuditOS.

Prompting is considered an engineering discipline.

Not an experimentation exercise.

Every prompt should reinforce the repository architecture, preserve engineering quality, and produce deterministic, maintainable results.

The objective is to minimize prompt complexity by maximizing repository knowledge.

---

# 2. Prompting Philosophy

The repository should contain the knowledge.

Prompts should describe the task.

Artificial Intelligence should learn the project from the repository rather than from increasingly large prompts.

As the repository grows, prompts should become shorter.

Not longer.

---

# 3. Architecture Before Prompting

Every AI session begins by understanding the architecture.

Before asking for implementation, the AI should understand:

Product.

User Experience.

Engineering.

Repository standards.

Design language.

Artificial Intelligence architecture.

Implementation without architectural understanding is prohibited.

---

# 4. Repository Before Conversation

Always prefer repository context over historical conversation.

Order of precedence:

AI Brain

↓

Architecture Documentation

↓

Engineering Standards

↓

Current Task

↓

Conversation Context

↓

Prompt

The repository remains authoritative.

---

# 5. Prompt Structure

Every implementation prompt should follow the same structure.

Context

↓

Objective

↓

Constraints

↓

Expected Output

↓

Acceptance Criteria

↓

Review Expectations

Prompts should remain predictable.

---

# 6. Context

Context explains the environment.

Examples include:

Current phase.

Repository location.

Architecture already defined.

Current implementation.

Related documentation.

The AI should understand where the task belongs before solving it.

---

# 7. Objective

Objectives should describe business outcomes.

Prefer:

"Implement the Evidence Workspace."

Instead of:

"Create three HTML files."

Business objectives produce better engineering decisions.

---

# 8. Constraints

Constraints prevent architectural drift.

Examples:

Static prototype only.

No backend.

No authentication.

Vanilla JavaScript.

Bootstrap only.

Human approval required.

Vendor-neutral architecture.

Constraints should be explicit.

---

# 9. Expected Output

Every prompt should define expected output.

Examples:

Markdown.

HTML.

CSS.

JavaScript.

Architecture review.

Repository documentation.

Issue specification.

Acceptance criteria reduce ambiguity.

---

# 10. Acceptance Criteria

Implementation prompts should define measurable success.

Examples:

Architecture preserved.

Accessibility maintained.

No duplicated functionality.

Repository terminology reused.

Responsive layout.

Professional User Experience.

Acceptance criteria should remain objective.

---

# 11. Prompt Scope

One prompt should solve one responsibility.

Avoid asking Artificial Intelligence to simultaneously:

Redesign architecture.

Implement features.

Write documentation.

Review implementation.

Create tests.

Separate responsibilities improve quality.

---

# 12. Progressive Prompting

Large capabilities should be decomposed.

Architecture.

↓

Specification.

↓

User Experience.

↓

Implementation.

↓

Review.

↓

Refinement.

Large prompts increase inconsistency.

Small architectural prompts improve reliability.

---

# 13. Repository References

Whenever possible, prompts should reference existing documentation.

Examples:

Shared Audit State.

Recommendation Engine.

Workspace Design System.

Coding Standards.

Repository Architecture.

Prompts should build upon repository knowledge.

Never replace it.

---

# 14. Artificial Intelligence Responsibilities

Artificial Intelligence should:

Read.

Understand.

Reuse.

Implement.

Review.

Refine.

It should not:

Invent architecture.

Invent terminology.

Invent workflows.

Invent undocumented Business Objects.

The repository defines architecture.

---

# 15. Prompt Length

Prompt quality is more important than prompt length.

Long prompts often indicate missing documentation.

If prompts continually grow, improve the repository instead.

---

# 16. Prompt Style

Prompts should be:

Professional.

Direct.

Specific.

Architectural.

Deterministic.

Avoid emotional language.

Avoid unnecessary emphasis.

Avoid conversational filler.

---

# 17. Business Language

Prompt using repository terminology.

Examples:

Shared Audit State.

Recommendation.

Workspace.

Business Object.

Approval.

Context Engine.

Event Bus.

Avoid introducing new vocabulary.

---

# 18. AI Roles

Clearly define the expected role.

Examples:

Software Architect.

UX Architect.

Implementation Engineer.

Documentation Writer.

Reviewer.

Accessibility Reviewer.

Artificial Intelligence performs better when responsibilities are explicit.

---

# 19. Prompt Context Hierarchy

Artificial Intelligence should process context in this order.

Project Context.

↓

Architecture.

↓

Engineering Standards.

↓

Current Capability.

↓

Implementation Task.

↓

Specific Instructions.

General understanding should always precede implementation details.

---

# 20. Prompt Boundaries

Prompts should explicitly state what should not happen.

Examples:

Do not redesign architecture.

Do not introduce frameworks.

Do not invent workflows.

Do not modify unrelated files.

Boundaries improve implementation consistency.

---

# 21. AI Self-Validation

Before producing output, Artificial Intelligence should internally verify:

Architecture followed?

Repository terminology reused?

Business workflow preserved?

Accessibility maintained?

No duplication introduced?

Shared Audit State respected?

Responses should satisfy repository standards before presentation.

---

# 22. Review Prompts

Review prompts should request evaluation rather than implementation.

Examples:

Review architecture.

Review User Experience.

Review accessibility.

Review maintainability.

Review repository consistency.

Review prompts should avoid rewriting unless requested.

---

# 23. Refactoring Prompts

Refactoring prompts should preserve:

Architecture.

Business behavior.

Repository terminology.

User Experience.

Governance.

Refactoring exists to improve quality.

Not functionality.

---

# 24. AI Memory

Artificial Intelligence should rely upon repository documentation rather than conversational memory.

If important knowledge exists only inside conversation:

Move it into the repository.

The repository is permanent.

Conversation is temporary.

---

# 25. Multi-Agent Prompting

Future AI Agents should receive specialized prompts.

Each agent receives:

Role.

Context.

Relevant Business Objects.

Relevant Events.

Expected Recommendations.

No agent should receive unnecessary context.

Specialization improves quality.

---

# 26. Prompt Evolution

As AuditOS matures:

Prompts become shorter.

Repository becomes richer.

Artificial Intelligence becomes more consistent.

The AI Brain gradually replaces repeated explanation.

---

# 27. Prompt Checklist

Before sending a prompt verify:

Architecture referenced.

Objective defined.

Constraints defined.

Expected output defined.

Acceptance criteria defined.

Repository terminology used.

Scope limited.

Business language used.

If not, improve the prompt.

---

# 28. Prompting Principles

AuditOS follows these permanent prompting principles.

Repository before prompt.

Architecture before implementation.

Context before reasoning.

Business language before technical language.

One prompt, one responsibility.

Constraints before implementation.

Review before completion.

Documentation before repetition.

Knowledge before conversation.

Quality before speed.

---

# 29. Prompt Vision

The long-term objective is for AuditOS to require progressively less prompting over time.

The AI Brain should eventually provide sufficient architectural understanding that implementation prompts become concise, precise, and deterministic.

Future contributors should spend their time defining objectives rather than repeatedly explaining architecture.

Prompting should evolve from project education to task specification.

When that point is reached, the repository itself will function as the primary prompt, allowing any capable Artificial Intelligence system to contribute consistently while preserving the identity, architecture, engineering standards, and long-term vision of AuditOS.
