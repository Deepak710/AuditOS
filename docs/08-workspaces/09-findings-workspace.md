# Findings Workspace

## Overview

The Findings Workspace (GitHub Issue #25) is where testing results become audit observations. A finding is not a manually authored document — it is the outcome of audit knowledge: walkthrough understanding, evidence evaluation, control testing, and auditor judgement converging on an exception worth reporting.

## Release 1 Scope

Release 1 is a faithful visualization of the current findings JSON. No AI. No backend. No writes. No workflow engine.

- Renders only what the JSON records
- Resolves names only where identifiers genuinely join
- Fabricates nothing
- Infers no conclusions

## Architecture

**Business → ViewModel → Components → DOM**, identical to Testing, Controls, Evidence, Requirements, Walkthrough, Engagement, and Home.

- Single state read: `collectViewModel()` collects pure, offline-testable derivations
- Reuses Shared Workspace Framework (skeleton, slots, header, toolbar, filter bar)
- Reuses Enterprise Data Presentation System (master–detail, inspector, empty states, activity feed)
- No bespoke primitives, no duplicated layout

## Primary Surfaces

### Findings Queue
The primary operational surface. Every finding is rendered once.

**Four presentation modes over one dataset:**
- **Findings view** — flat queue
- **By severity** — High → Medium → Low (canonical order)
- **By domain** — audit domains (Identity & Access Management, Governance, etc.) via control family
- **By owner** — finding owner

Switching views regroups the same rows; presentation only, never a data mutation.

**Row displays:**
- Finding ID + title
- Severity (color-coded)
- Status
- Related control
- Owner
- Related test

### Finding Inspector
Master → Detail detail pane. Renders:
- Finding identity (ID, severity, status, owner)
- Description (observation from JSON)
- Root cause (placeholder if absent)
- Impact (risk field from JSON)
- Recommendation
- Related control (resolved where it joins)
- Related evidence (working paper reference)
- Related testing (test procedure if it joins)
- Related requirements (via engagement control, not directly joined)
- Remediation (status, target closure date, management response — all from JSON)
- Prior-year knowledge (linked prior-year finding ID, knowledge-reuse block for SOC 2, framework-reuse block for ISO)
- Activity (placeholder — Release 1 has no activity trail)
- Approval history (placeholder — Release 2 routes AI-assisted findings through human approval)

The inspector is host-agnostic: data in, one self-contained Master–Detail node out.

### Findings Health
Operational status indicators (editor status-bar style):
- One indicator per **status** present (Open, Closed, Accepted Risk, etc.)
- One indicator per **severity** present (High, Medium, Low, etc.)
- A derived **Reportable** count

All counts are real. An engagement with no findings reads "Findings = None".

### Remediation Status
Progress meter over real closed / total counts, with a breakdown:
- Closed (remediated)
- Accepted Risk
- Open

### Audit Lineage
The methodology chain: Walkthrough → Requirement → Control → Evidence → Testing → **Finding** (highlighted) → Report

Each node shows its real count and links to its workspace.

### Related Information Panel
The audit domains findings connect to, each with its real count.

### Recent Activity
Activity feed of finding updates. Release 1 has no dated events — renders shared Empty State.

### Metadata
Created, modified, owner, version, tags, source.

## Data Joins

**All joins are faithful.** Raw identifiers render when joins fail.

- **Related control**: `libraryControlId` ← control-library (master definition), or `controlId` ← engagement controls
- **Domain**: Control family (via `libraryControlId` → control-library → `controlFamilyId` → control families), or engagement control category
- **Owner**: `ownerPocId` ← points of contact directory
- **Related test**: `testId` ← engagement testing set
- **Related requirements**: Through engagement control's `requirementIds` (traced, not directly joined)
- **Prior-year finding**: `linkedPriorYearFindingId` (rendered as raw ID)

## Release 1 Placeholders (Never Fabricated)

- **Root cause** — JSON carries no root cause; placeholder explains this is Release 2
- **Activity** — JSON carries no dated history; placeholder explains this is Release 2
- **Approval history** — JSON carries no approval trail; placeholder explains Release 2 routes AI-assisted findings through human approval
- **Related requirements** — While wired through the control, the current demo data does not fully join; placeholder surfaces the gap

## Release 2 Extension Points

- **AI advisory panel** — AI-drafted findings, duplicate detection, recommended severity/root causes, suggested remediation, proposed report wording (advisory, human approval mandatory)
- **Approval history** — Human approval record for each AI-assisted finding/severity/root cause/remediation
- **Prior-year knowledge** — AI-identified duplicate findings and cross-engagement knowledge links
- **Activity trail** — Finding updates, reviews, remediation events
- **Root cause** — AI-recommended root causes for human review

## Testing

**Unit tests** (31 cases): Pure derivation helpers with fixture records

**Integration tests** (19 cases): State binding + render validation against a live DOM stub
- View model collected from demo data
- Real joins verified
- Four presentation modes regroup without mutation
- Inspector renders without throwing
- No `[object Object]` / `undefined` / `null` tokens
- Source contracts verified (state-only reads, no writes, framework/presentation reuse)

**Result**: 50 passed, 0 failed (findings scope only; full suite not run per requirements)

## Files

**Workspace**
- `prototype/js/workspaces/findings.js` (674 lines)
- `prototype/css/findings.css`

**Tests**
- `prototype/tests/unit/findings-derivations.test.js` (31 cases)
- `prototype/tests/integration/findings-state-binding.test.js` (19 cases)

**Registration**
- `prototype/index.html` — loads after Testing workspace
- `prototype/css/main.css` — imports findings.css after framework
- `prototype/tests/lib/prototype.js` — registered workspace + loader

## Assumptions (Current Demo Data)

- No `rootCause`, dated `activity`, or `approvalHistory` fields → honest placeholders
- `controlId` uses `ENGCTRL-*` namespace (engagement-scoped); does not match control-library IDs
- `workingPaperId` is a reference (no working-papers collection to join)
- Statuses: Open, Closed, Accepted Risk (no intermediate states in demo)
- Severities: High, Medium, Low (no Critical in current data, but supported)
- No metadata `generatedAt` → "Last updated" stays empty
