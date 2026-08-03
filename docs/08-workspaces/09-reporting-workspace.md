# PART IX — WORKSPACE SPECIFICATIONS

## Chapter 69 — Reporting Workspace

---

### 69.1 Purpose

The Reporting Workspace is the operational environment responsible for transforming governed assurance knowledge into professional assurance deliverables.

Unlike traditional audit platforms, AuditOS does not build reports by manually assembling disconnected paragraphs, screenshots, spreadsheets, and working papers.

Instead, reports are continuously generated representations of the Shared Audit State.

Every report reflects the current approved Business Objects, their relationships, governance history, and supporting evidence.

The purpose of the Reporting Workspace is to provide a centralized environment for authoring, reviewing, governing, generating, comparing, publishing, and maintaining assurance reports while preserving complete traceability and professional accountability.

#### Release 1 Status (GitHub Issue #41 — Living Reporting and Operational Findings)

This chapter was written before any implementation existed. GitHub Issue #41
is the **first real implementation** of the Reporting Workspace: it did not
redesign a prior version — `prototype/js/workspaces/reporting.js` did not
exist before this issue. The sections below ground the workspace's
architectural vision in what is actually shipped; the rest of this chapter's
"Illustrative" composition remains the longer-term conceptual model this
implementation is the first concrete step toward.

**Layout — a full-height, three-pane Workbench**
(`AuditOS.presentation.workbench`, the same composition Controls, Testing,
and Findings share), mapping Chapter 69's eight conceptual regions onto three
panes:

| Pane | Chapter 69 regions it realizes | Contents |
| --- | --- | --- |
| **Left — Report Navigator** | Report Explorer | The five canonical sections in document order (never re-sorted — the order is the report's own table of contents), each with its source, recorded status, and item count. |
| **Middle — Selected Report Section** | Document Canvas, Traceability Panel | The section in full: its continuous-generation notice, its not-audited notice where Section V applies, its content, and its AI Lineage ("Generated From") chips — plus the change-proposal editor (§69.15). |
| **Right — Report Operational Inspector** | AI Insights, Review Queue, Publication Center, Activity Timeline | AI suggestions in flight, version history with the one lifecycle action the current version allows, pending report approvals, the selected section's lineage repeated for visibility while scrolled, the continuous-regeneration plan, and the Release 1 Improvement Register generation entry. |

Selecting a section replaces only the middle and right panes; the navigator
rail is never rebuilt.

**The five report sections** (`js/services/report-generation-service.js`),
always in this order:

| # | Section | Generated | Audited | Basis |
| --- | --- | --- | --- | --- |
| I | Management Assertion | No — authored at issuance | Yes | The report document's own recorded section record (`SEC-1`); its recorded status renders exactly as authored. |
| II | Independent Auditor Report | No — authored at issuance | Yes | The report document's own recorded section record (`SEC-2`). |
| III | System Description | **Yes** — continuous | Yes | One factual block per operational domain that actually holds data — walkthrough sessions, evidence approved, controls in scope, testing completed, approved observations — each block honestly stating "no … recorded yet" when the domain is empty rather than a fabricated figure. |
| IV | Testing Results | **Yes** — continuous | Yes | Generated directly from the Testing workspace: control, procedure, evidence, result, conclusion, and linked findings — one row per workpaper, every workpaper (Issue #41 Fix — the row was previously capped at 60, then a service-level cap of 200; neither cap exists now, and the exported document renders the identical row set the screen does). |
| V | Entity Information (Not Audited) | **Yes** — continuous | **No** | The entity-supplied registers the report document already carries — Complementary User Entity Controls (`cuecs`), Complementary Subservice Organization Controls (`csocs`), and the entity's IPE procedures (`ipeProcedures`). Labelled "not audited" everywhere it appears; a document recording none of the three renders an honest empty state, never invented entity content. |

A canonical section the report document does not declare renders "this
section is not recorded in the report" rather than being drafted — Release 1
never fabricates a section's presence.

**Continuous generation, section-scoped (Issue #41 — "only affected sections
regenerate; no full regeneration").** Every generated section carries this
notice verbatim: *"Generated using currently approved walkthroughs, evidence,
testing, findings and entity information. This section will continue
evolving until report issuance."* `reportGenerationService.sectionsAffectedBy`
maps each of the five operational domains (walkthrough, evidence, controls,
testing, findings) to exactly the sections it feeds — a walkthrough change
regenerates Section III alone; a testing change regenerates Sections III and
IV; nothing else is touched. The Reporting workbench's right rail renders
this mapping directly (the "Continuous regeneration" panel), so the "no full
regeneration" guarantee is something a user can see, not just a claim.

**AI Lineage, on every generated section (Issue #41 — AI Lineage).** Each
generated section carries a "Generated From" lineage: one chip per source
domain, each showing its real, current count and linking into the workspace
that owns the source objects. A domain the section draws on but that
currently holds no data still appears, marked absent ("—") rather than
hidden — the basis of a paragraph includes what is not there yet. Section IV
additionally resolves each result row's control and linked finding through
real joins, never a fabricated control code or finding title.

**Report Editing → Propagation (Issue #41).** The report is never written
directly. Every edit follows one path:

```text
Edit → AI analyzes impact → Suggestion generated → User approves → Propagation → Report regenerated
```

`js/services/report-propagation-service.js` performs the first half:
`analyzeImpact` reads the edited section's own recorded lineage and names
only the upstream objects that section is genuinely generated from — a
section generated from nothing (Sections I, II, and V) proposes nothing
upstream. The proposal itself is recorded as a Suggestion through the
platform's one, canonical Suggestion Lifecycle Service (Issue #36) — there is
no second suggestion workflow — and enters the same Suggested → Reviewed →
Approved → Applied path every other suggestion in the platform uses.

Once approved, `propagate()` walks the Synchronization Bus's
`REPORT_PROPAGATION_CHAIN` **upstream** from the report:

```text
Reporting → Findings → Testing → Controls → Evidence → Walkthrough
```

publishing one event per hop the edit actually affects (hops the edit does
not touch are skipped, never published as no-ops) and recording each hop in
the Platform Audit Service under one shared correlation id, so an approved
report edit is inspectable end to end. This is the same
Synchronization Bus Issue #36 built for walkthrough-originated changes,
extended with a second, upstream-facing chain rather than reimplemented.

**Report Versioning (Issue #41 — Report Versions).**
`js/services/report-version-service.js` owns one lifecycle:

```text
Draft → AI Draft → Reviewer Approved → Partner Approved → Issued
```

An **Issued** version is immutable — it never advances further, and the
Reporting workbench refuses to open its change-proposal editor against one,
explaining why and offering "Open a revision" instead. A revision opened
against an issued version creates a **new Draft version** (advancing to the
next major version number, e.g. `1.3` → `2.0`) that carries the issued
version forward as its recorded predecessor; the issued document itself is
never rewritten. The version register's baseline entry is read from the
report document's own already-recorded version and status — a real, current
fact — rather than an invented history; where that recorded status is not
itself one of the five lifecycle states (a report document status like
`"Final (pending Sections I–II at issuance)"` is a description of the
document, not a position in the approval lifecycle), advancing it enters the
register honestly at **Draft**, never silently claiming an approval nobody
gave.

**Native export — DOCX and PDF (Issue #41 — Report Export, "no Microsoft
Office dependency").** `js/services/document-export.js` serializes one
neutral document model — built once from the same report the workbench
renders, so the screen and every exported document can never disagree — into
three formats, all written with zero runtime dependency:

* **DOCX** — a real OOXML WordprocessingML package, written through the same
  zero-dependency STORE-method ZIP writer the platform's `.xlsx` workpaper
  export already uses (Issue #40 §6) — one ZIP implementation in the
  platform, not two.
* **PDF** — a real PDF 1.4 document written directly: Helvetica and
  Helvetica-Bold (two of the base-14 fonts every conforming reader already
  embeds, so no font file ships with the export), word-wrapped using the
  fonts' own AFM advance-width metrics, tables ruled with path operators, and
  a byte-accurate cross-reference table built from real object offsets.
* **HTML** — one self-contained document (inline styles, no script, no
  external request), the same portability contract the platform's workpaper
  HTML export already keeps.

**Release 2 extension points** (opened, not implemented — each is exactly one
function, so replacing it changes nothing else in the path): `AI-drafted
section wording` (`reportGenerationService.draftNarrative`, which returns
`null` in Release 1 — no prose is invented for a section with no recorded
content), `AI impact reasoning` (`reportPropagationService.describeImpact`,
which states the structural relationship the recorded lineage supports in
Release 1), and the AI-generated **Improvement Register** — an Excel workbook
of issue / cause / impact / recommendation / owner / priority / suggested
control / evidence / walkthrough / monitoring improvements / target date /
status, for which Release 1 provides the generation entry in the workbench's
right rail and refuses honestly ("no improvement register is recorded... " )
rather than fabricating one.

---

### 69.2 Reporting Workspace Philosophy

Reports are outputs.

They are not business truth.

Business truth exists within:

* Business Objects
* Relationships
* Evidence
* Findings
* Recommendations
* Governance Decisions
* Human Approvals

Reports consume business knowledge.

They never become the authoritative source of business information.

Whenever business knowledge changes, reports are regenerated rather than manually synchronized.

---

### 69.3 Architectural Objectives

The Reporting Workspace exists to:

* Generate trustworthy assurance reports.
* Eliminate duplicate documentation.
* Improve reporting consistency.
* Support AI-assisted drafting.
* Preserve professional accountability.
* Maintain complete traceability.
* Support governance.
* Enable reusable report structures.
* Reduce manual effort.
* Support enterprise-scale reporting.

---

### 69.4 Architectural Principles

The following principles govern the Reporting Workspace.

#### Reports Are Derived

Reports are generated from approved Business Objects.

---

#### Single Source of Truth

The Shared Audit State remains authoritative.

---

#### Human Governed

Professional approval is required before publication.

---

#### AI Assisted

AI accelerates drafting and refinement.

Humans remain responsible for every published report.

---

#### Explainable

Every report statement is traceable to supporting Business Objects.

---

#### Event Driven

Report updates occur in response to approved Business Events.

---

### 69.5 Architectural Position

The Reporting Workspace occupies the publication phase of the assurance lifecycle.

```text id="8m3q7v"
Business Objects

↓

Shared Audit State

↓

Report Composition

↓

Professional Review

↓

Approval

↓

Published Report
```

Reports represent governed business knowledge rather than independent documentation.

---

### 69.6 Workspace Responsibilities

The Reporting Workspace is responsible for:

* composing reports
* presenting report structure
* supporting report review
* displaying AI recommendations
* managing report versions
* coordinating approvals
* generating deliverables
* visualizing report readiness
* supporting publication

The workspace is intentionally **not** responsible for:

* owning Business Objects
* modifying Findings directly
* approving recommendations independently
* bypassing governance
* becoming a source of business truth

---

### 69.7 Primary Business Objects

The workspace primarily operates upon:

* Report
* Report Section
* Finding
* Recommendation
* Business Control
* Evidence
* Testing Result
* Approval
* Report Version
* Publication

Future Business Objects extend reporting without altering the architecture.

---

### 69.8 Workspace Composition

The Reporting Workspace consists of several coordinated operational regions.

Illustrative composition:

```text id="5x2n8k"
Reporting Header

↓

Report Explorer

↓

Document Canvas

↓

Traceability Panel

↓

AI Insights

↓

Review Queue

↓

Publication Center

↓

Activity Timeline
```

Every region independently consumes the Shared Audit State.

---

### 69.9 Reporting Header

The Reporting Header provides continuous awareness of report context.

Illustrative information includes:

* Engagement
* Framework
* Report Type
* Current Version
* Publication Status
* Review Status
* Approval Status
* Readiness Score

The header remains visible throughout report preparation.

---

### 69.10 Report Explorer

The Report Explorer provides structured navigation through report content.

Illustrative navigation includes:

* Executive Summary
* Scope
* Methodology
* Findings
* Recommendations
* Management Responses
* Appendices
* Supporting Information

Report organization remains independent of underlying Business Objects.

---

### 69.11 Document Canvas

The Document Canvas presents the generated report.

The canvas may contain:

* generated narrative
* structured sections
* executive summaries
* tables
* charts
* references
* appendices
* management responses

Users interact with the generated representation rather than editing isolated copies of business information.

Business content should be corrected at the Business Object level wherever practical.

---

### 69.12 Traceability Panel

Every report element remains explainable.

The Traceability Panel visualizes supporting relationships.

Illustrative relationship:

```text id="3k7p5m"
Report Section

↓

Finding

↓

Testing Result

↓

Evidence

↓

Business Control

↓

Framework Requirement
```

Users should always understand why every report statement exists.

---

### 69.13 AI Insights

Artificial Intelligence continuously assists report preparation.

Illustrative capabilities include:

* drafting narrative
* identifying inconsistent language
* improving readability
* identifying missing sections
* recommending executive summaries
* detecting unsupported statements
* identifying duplicate content
* improving report consistency

Recommendations generated across multiple AI Agents are merged before presentation through the Human Approval Engine.

---

### 69.14 Report Composition

Report composition is Business Object driven.

Illustrative flow:

```text id="7r4m2x"
Business Objects

↓

Report Template

↓

Generated Sections

↓

Professional Review

↓

Approval

↓

Published Report
```

Generated sections remain linked to their originating Business Objects.

---

### 69.15 Review Workflow

Every report follows a governed review process.

Illustrative lifecycle:

```text id="6p8n3v"
Draft Generated

↓

AI Review

↓

Merged Recommendation

↓

Professional Review

↓

Approver Review

↓

Publication Approval

↓

Published
```

Role-based approvals ensure only authorized users can authorize publication, while lower-privileged reviewers may provide comments and requested changes.

---

### 69.16 Report Versioning

Reports maintain independent version history.

Illustrative lifecycle:

```text id="4v9k1q"
Draft

↓

Version 1

↓

Review

↓

Version 2

↓

Publication

↓

Archived Version
```

Historical report versions remain immutable and reconstructable.

Each version preserves complete lineage to the Business Objects from which it was generated.

**Release 1 Status.** The shipped lifecycle is `js/services/report-version-service.js`'s five real states — Draft → AI Draft → Reviewer Approved → Partner Approved → Issued — not the six illustrative steps above. See §69.1's Report Versioning section for the full model, including immutability and the revision-on-edit-after-issuance rule.

---

### 69.17 Publication Center

The Publication Center coordinates report publication.

Illustrative capabilities include:

* readiness assessment
* publication approvals
* publication history
* release management
* export preparation
* distribution status
* publication audit trail

Publication is the final governed step.

It does not create new business knowledge.

---

### 69.18 Collaboration

Reporting remains collaborative.

Illustrative collaboration includes:

* reviewer comments
* suggested revisions
* management responses
* discussion threads
* assignments
* approval requests
* publication reviews

Collaboration occurs around governed report sections rather than disconnected document copies.

---

### 69.19 AI Collaboration

Artificial Intelligence acts as a reporting assistant.

AI may:

* draft report sections
* summarize findings
* recommend wording
* improve consistency
* identify unsupported statements
* recommend executive summaries
* detect missing references
* explain framework terminology

AI never publishes reports or replaces professional review.

---

### 69.20 Synchronization

Approved Business Events continuously synchronize reporting.

Illustrative synchronization:

```text id="9m5r3w"
Finding Approved

↓

Shared Audit State Updated

↓

Business Event Published

↓

Affected Report Sections Regenerated

↓

Review Indicators Updated

↓

Publication Readiness Updated
```

Synchronization eliminates manual document reconciliation.

**Release 1 Status.** The shipped mechanism is `sectionsAffectedBy` (§69.1):
a change to a recorded operational domain — walkthrough, evidence, controls,
testing, or findings — regenerates exactly the sections that domain feeds,
computed fresh on every render rather than dispatched as a discrete
"Business Event." An observation reaching an "approved" state (Accepted,
Resolved, Closed, or explicitly flagged reportable) is counted in Section
III's and the Findings lineage's real figures the next time the report is
read; there is no separate publish step that pushes a synchronized update
into the report ahead of that. The **edit-originated** direction — a report
edit propagating upstream into Findings, Testing, Controls, Evidence, and
Walkthrough — is the one propagation path Release 1 actually implements as an
explicit event chain; see §69.1's Report Editing → Propagation section and
the Findings Workspace chapter's own Release 1 Status (§68.20) for the two
halves of the same mechanism.

---

### 69.21 Explainability

Every report statement must remain explainable.

Users should be able to navigate from any report element to:

* originating Finding
* supporting Testing Result
* supporting Evidence
* Business Control
* Framework Requirement
* Approval history
* Audit Events

Explainability is a mandatory architectural characteristic rather than an optional reporting feature.

---

### 69.22 Security

The Reporting Workspace inherits the platform security architecture.

Illustrative capabilities include:

* authorization
* role-aware visibility
* publication approvals
* immutable audit trail
* lineage
* provenance
* AI safety
* document classification

Published reports preserve the same governance characteristics as the Business Objects from which they were derived.

---

### 69.23 Future Evolution

The architecture supports future capabilities including:

* multi-format report generation
* continuous reporting
* real-time executive dashboards
* AI-assisted executive briefings
* industry-specific report templates
* multilingual reporting
* regulatory submission packages
* customer-specific report variants
* interactive digital reports

Future capabilities extend the Reporting Workspace without altering its architectural principles.

---

### 69.24 Architectural Constraints

The following architectural constraints are mandatory.

* Reports remain derived artifacts.
* The Shared Audit State remains authoritative.
* Reports never own business truth.
* Every report statement remains traceable.
* AI recommendations remain advisory.
* Human approval remains mandatory before publication.
* Report versions remain immutable.
* Report updates are event-driven.
* Multiple AI outputs are consolidated before user review.
* The Reporting Workspace remains implementation-independent.

---

### 69.25 Summary

The Reporting Workspace transforms assurance reporting from a manual documentation exercise into a continuously generated, governed, and explainable representation of organizational knowledge.

By generating reports directly from approved Business Objects, preserving complete traceability, embedding AI-assisted drafting within a human-governed workflow, and maintaining immutable publication history, AuditOS ensures that every report is consistent, defensible, reproducible, and continuously synchronized with the Shared Audit State.

Rather than becoming the destination of assurance work, reports become its transparent and authoritative expression.

---
