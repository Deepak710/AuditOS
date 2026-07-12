# PART IX — WORKSPACE SPECIFICATIONS

## Chapter 62 — Client Workspace

---

### 62.1 Purpose

The Client Workspace is the portfolio command center for managing all engagements, evidence, and assurance activities across a single client organization.

It provides engagement managers and senior auditors with a unified view of client-wide status, team workload distribution, Portfolio-of-Engagements analytics, and AI-generated insights that span the entire client relationship.

The Client Workspace is the primary operational home after a user selects a client from the Landing Page.

---

### 62.2 Objectives

The Client Workspace exists to:

* provide client-wide operational oversight
* visualize portfolio health across all operational engagements
* surface cross-engagement risks and bottlenecks
* enable team and POC workload management
* expose AI Portfolio Insights at the client level
* support rapid drill-down into individual engagements
* surface completed engagements as read-only reference
* reduce navigation effort across engagements
* improve resource allocation and capacity planning
* enable data-driven decision-making

---

### 62.3 Intended Users

The Client Workspace is designed for:

* Engagement Managers — managing multiple concurrent engagements
* Senior Auditors — responsible for client-wide coordination
* Practice Managers — overseeing portfolio health
* Quality Assurance Partners — conducting portfolio reviews
* Risk Managers — monitoring cross-engagement compliance

---

### 62.4 Workspace Philosophy

The Client Workspace answers five questions immediately:

1. How healthy is our portfolio with this client?
2. Which engagements require attention?
3. How is workload distributed across our team?
4. What are the cross-engagement risks?
5. What does AI recommend at the portfolio level?

Users should understand client-wide status without leaving the workspace.

---

### 62.5 Layout Architecture

The Client Workspace inherits the Application Shell and Shared Workspace Framework.

The workspace is divided into logical regions:

**Primary Content Canvas**

* **Portfolio Overview** — Segmented visualization showing 6 live metrics (Requirements, Evidence, Testing, Walkthroughs, Approvals, Findings) across operational engagements; click drills into engagement workspaces.
* **Team Analytics** — Rankings of client-side teams by workload; click reveals POC roster and drill-down analytics by team.
* **Engagement Portfolio** — Entity cards for all active engagements; click navigates to the Engagement Workspace.
* **Completed Engagements** — Collapsed by default; read-only reference for closed engagements.

**Supporting Panels (Workspace Shell Regions)**

* **AI Recommendations** — Client-level Portfolio Insights from the `ai-portfolio-insights` collection; includes risk alerts, bottleneck analysis, and workload predictions.
* **Activity Feed** — Recent changes across all client engagements.
* **Related Information** — Engagement relationships and cross-references.

**Toolbar**

* **Search** — Universal Client Search spans requirements, controls, evidence, findings, POCs, users, reports, walkthroughs, engagements, and frameworks.
* **Filter** — Engagement filter narrows Portfolio Overview and Engagement Portfolio to a single operational engagement.

---

### 62.6 Data Model

The Client Workspace operates on the Shared Audit State.

**Primary Entities**

* **Companies** (focal entity) — the client organization
* **Engagements** — all engagements for the company; split into operational and completed
* **Teams** — company-wide team roster
* **POCs** — Points of Contact within teams
* **Requirements** — per-engagement requirements; scoped to client via engagement
* **Evidence** — per-engagement evidence; scoped to client via engagement
* **Requests** — per-engagement evidence requests
* **Controls** — per-engagement control library
* **Testing** (workpapers) — per-engagement testing execution
* **Findings** — per-engagement findings
* **AI Portfolio Insights** — client-scoped advisory signals
* **Users** — audit firm team members
* **Reports** — per-engagement reports

**Ownership Join Pattern**

* Evidence and Testing ownership is resolved through Requirements:
  * `evidence.requirementIds[0]` → `requirement.teamId` / `requirement.primaryPocId`
  * `testing.controlId` → `control.requirementIds[0]` → `requirement.teamId` / `requirement.primaryPocId`
* This requirement-centric model is used identically across Portfolio Overview, Team Analytics, and POC Analytics.

**Metrics Vocabulary**

All metrics share a live, read-only vocabulary derived from the Shared Audit State:

* **Requirements**: total, complete (status = "All Evidence Received"), pending (all others)
* **Evidence**: total, complete (reviewStatus = "All Evidence Received"), pending (all others)
* **Testing**: total, complete (testingStatus = "Completed"), pending (all others)
* **Walkthroughs**: total, complete (walkthroughStatus = "Completed"), pending (all others)
* **Approvals**: total, pending (approval status in pending-decision vocabulary), cleared
* **Findings**: open (status != "Resolved" and type != "Risk"), resolved

---

### 62.7 Interaction Patterns

#### Portfolio Overview Visualization

A segmented, stacked bar visualization where:

* Each segment width is proportional to the metric's total across all operational engagements
* A translucent overlay indicates the pending share
* Category color follows AuditOS's fixed categorical palette (8 fixed hues for 8 operational engagements)
* Hover shows: Completed count, Pending count, Completion %, Blocked count, Last update timestamp
* Click drills into the engagement-scoped Engagement Workspace

#### Engagement Filter

A `<select>` dropdown in the filter bar that:

* Lists "All engagements" (default) plus every operational engagement name
* Filters the Portfolio Overview visualization and Engagement Portfolio cards to a single engagement
* Re-derives and re-renders the canvas without page reload

#### Team Analytics Drill-Down

1. Team row displays: team name, total workload (requirement count), count of owned evidence, owned requests, owned test records
2. Click reveals POC roster for the selected team
3. POC row displays: POC name, primary engagement assignment (if any), owned items

#### Universal Client Search

A search field that:

* Accepts a query and filters a precomputed index covering Requirements, Controls, Evidence, Findings, POCs, Users, Reports, Walkthroughs, Engagements, and Frameworks
* Results render as a list; items with a dedicated workspace surface include a navigable link; items without (e.g., POCs) render informational
* Results close on blur

#### AI Portfolio Insights

The AI module renders client-scoped advisory signals exactly as recorded in the `ai-portfolio-insights` collection:

* No computation or derivation in the view layer
* Each insight includes: type, severity, title, description, scope (engagement id + label), metric, confidence, recommendation
* Click on an insight navigates to the relevant engagement

---

### 62.8 Module Registry

The Client Workspace is module-driven.

Modules declare:

```javascript
{
  id: 'portfolio-overview',           // unique identifier
  region: 'content',                  // 'content', 'ai', 'activity', 'related'
  enabled: true,                      // feature gate
  collapsedByDefault: false,          // for disclosure widgets
  kicker: 'Portfolio status',          // eyebrow
  title: 'Portfolio overview',         // main title
  description: 'Hover to see...',      // optional description
  render: function() { ... }           // view builder; called on each re-render
}
```

This configuration seam allows future releases to hide, reorder, resize, or pin modules without changing workspace code.

---

### 62.9 Completed Engagements

Completed engagements:

* Render only when at least one engagement has status = "Completed"
* Are collapsed by default as a `<details>` disclosure; expand on-demand with zero JavaScript
* Appear in the last module position in the canvas (nothing renders after)
* Do not contribute to any Portfolio Overview metric
* Include read-only entity cards linking to the engagement for reference

---

### 62.10 Loading and Degraded States

**Loading State**

* Shows a detail skeleton for primary content
* Shows list skeletons for supporting panels
* Persists until the Shared Audit State emits a `STATE_LOADED` event

**Degraded State**

* Renders an empty state explaining "No client available"
* Includes instructions to regenerate the demo-data bundle
* Occurs when no accessible clients exist in the Shared Audit State

---

### 62.11 Responsive Behavior

The Client Workspace responds to viewport width changes:

* **Desktop** (> 1024px): Primary content + 3 supporting panels visible
* **Tablet** (640–1024px): Primary content only; supporting panels collapse to icons
* **Mobile** (< 640px): Stacked single-column layout; filter/search remains in toolbar

---

### 62.12 Accessibility

The Client Workspace maintains:

* Semantic heading hierarchy beneath the framework h1
* ARIA labels on all regions, tabs, and buttons
* Keyboard navigation through tabs and filter controls
* Text-based status conveyed through badges and labels, never color alone
* Reduced-motion support for entrance animations

---

### 62.13 Constraints and Limitations

* Findings carry no team/POC join field in the current dataset; "Open findings" metric may legitimately be 0
* AI Portfolio Insights is a static precomputed-signal collection; Release 2 will replace the generation strategy, not this UI
* Team Analytics is scoped to company-level teams (cross-engagement only); per-engagement teams are out of scope

---

### 62.14 Historical Context

The Client Workspace replaces the prior "Client Dashboard" concept with:

* Modular, configuration-driven module architecture
* Live Portfolio Overview visualization across 6 metrics
* Functional Engagement Filter and Universal Client Search
* Repository-backed AI Insights (not fabricated)
* Breadcrumb simplification (no placeholder engagements, no redundant workspace crumb)
* Removal of the "Audit Program" shortcut and obsolete Metadata section

Issue #35 established this workspace as the primary Client Workspace for all releases.
