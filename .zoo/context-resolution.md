# AuditOS Context Resolution

Before implementing any GitHub Issue, resolve context in the following order.

---

## Level 1 — Repository Rules (Highest Priority)

Read

- .zoo/project-constitution.md
- .zoo/development-workflow.md

These documents define how work must be performed.

Never violate these rules.

---

## Level 2 — Core Architecture

Read

docs/00-overview

docs/01-product

docs/04-engineering

These documents define the product architecture.

Implementation must follow them.

---

## Level 3 — UX

Read

docs/02-ux

Implementation must follow the AuditOS design philosophy.

---

## Level 4 — Components

Read

docs/09-components

Always reuse components before creating new ones.

---

## Level 5 — Workspace Documentation

Read only the documentation relevant to the GitHub Issue.

Do not load every workspace unnecessarily.

---

## Level 6 — Implementation Guide

Read

docs/15-implementation-guide

Use this to determine

- routing
- screen layout
- component placement

---

## Level 7 — Existing Code

Read existing implementation.

Reuse existing code whenever possible.

Never duplicate functionality.

---

## Conflict Resolution

If two documents disagree

Priority is

Project Constitution

↓

Development Workflow

↓

Architecture

↓

UX

↓

Components

↓

Implementation Guide

↓

Existing Code

If uncertainty remains

Stop and explain.

Never guess.

---

## Principle

Documentation is the source of truth.

Existing code should evolve to match documentation—not the other way around—unless the documentation has been intentionally updated as part of an approved GitHub issue.