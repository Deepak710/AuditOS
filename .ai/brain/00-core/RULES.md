# AuditOS AI Brain

# RULES

Version: 1.0

Status: Permanent

Classification: Engineering Rules

Owner: AuditOS Architecture

---

# 1. Purpose

This document defines the mandatory operational rules that every contributor to AuditOS shall follow.

Unlike the Constitution, which defines permanent architectural principles, these Rules define expected engineering behavior.

Every human contributor.

Every AI assistant.

Every implementation engine.

Every automated workflow.

Shall follow these rules unless explicitly superseded by future repository documentation.

---

# 2. Repository First

The repository is the source of truth.

Never invent architecture that does not already exist.

If architecture is missing:

Stop.

Document.

Then implement.

Never reverse the order.

---

# 3. Read Before Writing

Before producing any implementation:

Read relevant repository documentation.

Understand existing terminology.

Reuse architectural concepts.

Identify dependencies.

Understand business workflows.

Implementation without understanding is prohibited.

---

# 4. Never Invent Architecture

Artificial Intelligence shall never invent:

Business Objects.

Workspaces.

Navigation.

Business workflows.

Approval workflows.

AI capabilities.

Repository structure.

If the architecture does not exist:

Request architectural guidance.

Do not create it independently.

---

# 5. Never Duplicate Knowledge

Knowledge should exist once.

Never duplicate:

Business logic.

Documentation.

Terminology.

Architecture.

Design decisions.

Shared utilities.

Duplication is architectural debt.

---

# 6. Never Bypass Documentation

Implementation shall never become the first definition of a capability.

Documentation precedes implementation.

Repository knowledge always remains authoritative.

---

# 7. Follow Existing Terminology

Always reuse repository vocabulary.

Examples:

Shared Audit State.

Recommendation.

Workspace.

Business Object.

Context Engine.

Event Bus.

Human Approval Engine.

Do not introduce synonyms.

Consistency is mandatory.

---

# 8. Respect Architectural Boundaries

Do not mix responsibilities.

Presentation.

Business logic.

State.

Artificial Intelligence.

Events.

Infrastructure.

Each responsibility belongs within its architectural boundary.

---

# 9. Pages Never Own Data

User interfaces display information.

They never own authoritative business knowledge.

Business knowledge belongs exclusively to the Shared Audit State.

---

# 10. AI Never Owns Knowledge

Artificial Intelligence owns reasoning.

The platform owns knowledge.

Recommendations are temporary.

Approved knowledge becomes permanent.

---

# 11. AI Never Approves

Artificial Intelligence may recommend.

Artificial Intelligence may explain.

Artificial Intelligence may summarize.

Artificial Intelligence shall never:

Approve.

Reject.

Override.

Govern.

Human approval is mandatory.

---

# 12. Every Significant Action Becomes an Event

Examples:

Evidence Uploaded.

Finding Created.

Recommendation Approved.

Timeline Updated.

Events describe completed facts.

Not intended actions.

---

# 13. Every Recommendation Requires Context

Artificial Intelligence should never reason without sufficient context.

The Context Engine prepares understanding.

Artificial Intelligence consumes understanding.

Context quality determines recommendation quality.

---

# 14. Every Recommendation Requires Explanation

Every recommendation should answer:

Why?

Based on what?

Expected impact?

Affected objects?

Confidence?

Supporting information?

Recommendations without explanation should not exist.

---

# 15. Every Change Requires Traceability

Every meaningful modification should preserve:

Previous state.

New state.

Who initiated it.

When.

Why.

Supporting context.

Nothing significant should become impossible to reconstruct.

---

# 16. Never Break Vendor Neutrality

Current implementation technologies do not define future architecture.

Never introduce unnecessary dependence upon:

Microsoft.

OpenAI.

Anthropic.

Google.

Azure.

Any future provider.

Implementation should remain replaceable.

---

# 17. Framework Neutrality

Never hardcode SOC 2 assumptions into architecture.

SOC 2 is the first implementation.

Framework neutrality is permanent.

---

# 18. One Responsibility

Every:

Workspace.

Business Object.

AI Agent.

Module.

Document.

Function.

Should have one primary responsibility.

If responsibilities overlap significantly, reconsider the design.

---

# 19. Extend Before Replacing

When introducing new capability:

Reuse.

Extend.

Compose.

Only replace architecture when absolutely necessary.

Architecture should become stronger over time.

Not larger.

---

# 20. Reuse Existing Patterns

Before creating new implementation:

Search existing repository patterns.

Prefer consistency over originality.

Users value predictability.

---

# 21. Business Language First

Prefer business terminology over technical terminology.

Repository documentation is written for professionals.

Not only software engineers.

---

# 22. Repository Organization

New files should exist because they own knowledge.

Not because they own technology.

Repository organization should communicate architecture naturally.

---

# 23. Design Consistency

User experience should remain:

Professional.

Information-rich.

Calm.

Predictable.

Accessible.

Avoid unnecessary visual experimentation.

---

# 24. Accessibility

Every user interface contribution should support:

Keyboard navigation.

Screen readers.

Logical focus.

Semantic markup.

Accessibility is mandatory.

---

# 25. Performance

Performance improvements should never reduce:

Maintainability.

Explainability.

Readability.

Architecture.

Optimize architecture before optimizing implementation.

---

# 26. Security

Security begins with architecture.

Every implementation should preserve:

Permissions.

Ownership.

Governance.

Traceability.

Approval.

Even within the Proof of Concept.

---

# 27. Artificial Intelligence Contributions

Artificial Intelligence contributing to AuditOS shall:

Read repository context.

Follow repository terminology.

Respect engineering standards.

Respect architectural boundaries.

Avoid assumptions.

Avoid hallucinated capabilities.

Repository documentation always prevails.

---

# 28. Zoo Code Rules

Zoo Code shall:

Read architecture first.

Implement only approved architecture.

Avoid architectural invention.

Reuse repository terminology.

Avoid workflow invention.

Generate maintainable implementation.

Zoo is an implementation engine.

Not an architect.

---

# 29. ChatGPT Rules

ChatGPT is responsible for:

Architecture.

Product design.

Engineering standards.

Design systems.

Repository structure.

AI architecture.

Reviews.

Long-term consistency.

ChatGPT should not generate implementation that contradicts repository architecture.

---

# 30. Review Before Completion

Before considering any task complete, verify:

Architecture compliance.

Repository consistency.

Terminology consistency.

Engineering quality.

Accessibility.

User experience.

Documentation.

Maintainability.

Quality precedes completion.

---

# 31. Repository Growth

Every contribution should improve:

Architecture.

Documentation.

Engineering.

Design.

Knowledge.

Future maintainability.

Repository growth should increase clarity.

Never confusion.

---

# 32. Questions Every Contributor Must Ask

Before producing output:

Do I understand the architecture?

Am I reusing existing terminology?

Am I introducing duplication?

Am I preserving vendor neutrality?

Am I strengthening the Shared Audit State?

Am I respecting human governance?

Am I following repository standards?

If uncertain:

Read more.

Implement less.

---

# 33. Rules Summary

These Rules may be summarized as follows.

Read first.

Understand first.

Document first.

Architect first.

Implement second.

Reuse existing knowledge.

Avoid assumptions.

Avoid duplication.

Respect architecture.

Respect governance.

Respect the repository.

Preserve long-term maintainability.

---

# 34. Enforcement

These Rules apply to:

Architecture.

Documentation.

Implementation.

Artificial Intelligence.

Repository organization.

Future engineering.

Future integrations.

Future contributors.

Violation of these Rules introduces architectural debt and should be corrected before implementation continues.

The purpose of these Rules is not to restrict contributors.

Their purpose is to ensure that AuditOS evolves as one coherent platform rather than a collection of independently developed features.
