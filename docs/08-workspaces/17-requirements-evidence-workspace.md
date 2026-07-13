# PART IX — WORKSPACE SPECIFICATIONS

## Chapter 68 — Requirements & Evidence Workspace

> **⚠️ SUPERSEDED BY Issue #39 (Evidence Workspace Consolidation).**
> Requirements ceased to exist as a user-facing workspace. **Evidence is the
> operational object of an engagement** (see Chapter 66 — Evidence Workspace).
> Requirement records remain an internal mapping layer (evidence → requirement
> → control), but there is no Requirements route, navigation entry, or
> requirement UI. All `#/requirements` URLs redirect to Evidence. This chapter
> is retained for historical context only; the sections below describe the
> pre-Issue-#39 design.

---

### 68.1 Purpose

The Requirements & Evidence Workspace is the evidence-collection operational center for managing requirements and their associated evidence, controls, tests, and approval status within an engagement.

It provides auditors with a dense, filterable view of all requirements, their collection status, and deep detail accessible through a shared enterprise drawer.

The Requirements & Evidence Workspace is accessed from the Engagement Workspace navigation or through deep linking.

---

### 68.2 Objectives

The workspace exists to:

* Provide requirement-first evidence visibility
* Show evidence collection progress across all requirements
* Display requirement-to-control mapping coverage
* Enable dense table filtering by status and evidence state
* Provide requirement detail accessible without navigation disruption
* Display evidence workflow with status change capability
* Support evidence requests and tracking
* Expose requirement-scoped tests and suggested improvements
* Maintain engagement context

---

### 68.3 Intended Users

The workspace is designed for:

* Evidence Managers — tracking evidence collection across the engagement
* Requirement Owners — ensuring evidence completeness for assigned requirements
* Quality Reviewers — verifying evidence against requirements
* Engagement Leads — understanding evidence collection health

---

### 68.4 Architectural Principles

The following principles govern the workspace.

#### Requirement-First

Requirements are the focal business object; evidence is organized around requirements.

---

#### Evidence Workflow Visibility

The evidence status workflow (Suggested → Reviewed → Approved → Applied) is visible and actionable.

---

#### Density and Filterability

Professional users see all requirements in a dense table; filters enable scope reduction.

---

#### Progressive Disclosure

Requirement detail opens in a shared drawer; users remain aware of the table context.

---

#### Real Data Only

Metrics derive from actual records; no fabricated evidence counts or control mappings.

---

#### Shared State

All data flows through the Shared Audit State.

---

### 68.5 Primary Business Objects

The workspace primarily operates upon:

* Requirement (focal entity)
* Evidence (linked to requirements through requirementIds)
* Control (linked to requirements through linkedControlIds or controlLinks)
* Sample
* Testing (workpapers)
* Suggestion (evidence-status workflow recommendations)
* Activity (requirement-scoped events)

---

### 68.6 Workspace Layout

The workspace inherits the Workspace Shell and follows this composition:

```text
Header
├── Engagement context and title
└── "Requirements & Evidence" navigation label

Content
├── At a Glance Strip
│   ├── Requirements KPI tile (total count)
│   ├── Evidence Collected KPI tile (count, %)
│   ├── Evidence Requested KPI tile (count)
│   ├── Outstanding Evidence KPI tile (count)
│   └── Mapped to Controls KPI tile (count, %)
│
├── Progress Visualization
│   ├── Evidence Collected meter (actual vs. total)
│   └── Mapped to Controls meter (actual vs. total)
│
├── Filter Controls
│   ├── Status filter (All Statuses, Not Started, In Progress, All Evidence Received, etc.)
│   └── Evidence Status filter (All Evidence States, Evidence Pending, Evidence Received, etc.)
│
├── Dense Requirement Table
│   ├── ID column (sortable)
│   ├── Requirement column (clickable, opens detail drawer)
│   ├── Status column (tone-coded badge)
│   ├── Controls Mapped column (count)
│   ├── Evidence Status column (tone-coded badge)
│   ├── Last Updated column (timestamp)
│   └── Row selection checkbox (for future bulk operations)
│
└── Supporting Panels
    ├── Related Information
    ├── Activity Feed (engagement-scoped recent changes)
    └── AI Context
```

---

### 68.7 At-a-Glance Metrics

Four operational indicators provide immediate status visibility.

**Metrics Calculation (Never Fabricated):**

All metrics are derived directly from record counts; no estimation or inference.

1. **Requirements:** Total count of requirement records in the engagement.

2. **Evidence Collected:** Count of evidence items whose status is "All Evidence Received"; calculated as a percentage against total requirements.

3. **Evidence Requested:** Count of evidence requests (outstanding evidence awaiting from the client).

4. **Outstanding Evidence:** Count of requirements with status other than "All Evidence Received" (requirements awaiting evidence).

5. **Mapped to Controls:** Count of requirements linked to at least one control (through `linkedControlIds`, `controlId`, or `controlLinks` with engagement-scoped code mapping); calculated as a percentage against total requirements.

**Display:**

Each KPI appears as a tile with:
* Large count or percentage
* Label describing the metric
* Tone indicator (success = green, warning = yellow, error = red, info = blue) based on completion percentage
* No trending or historical comparison (Release 2 future work)

---

### 68.8 Progress Visualization

Two progress meters provide at-a-glance health indicators.

**Evidence Collected Meter:**

* Fill percentage = (evidence-collected count / total requirements) × 100
* Shows: "479 of 597 · 80%"
* Tone: success (green) if ≥ 75%, warning (yellow) if ≥ 50%, error (red) if < 50%

**Mapped to Controls Meter:**

* Fill percentage = (requirements with control mapping / total requirements) × 100
* Shows: "445 of 597 · 75%"
* Tone: success if ≥ 75%, warning if ≥ 50%, error if < 50%

---

### 68.9 Filter Controls

Two dropdowns enable scope reduction.

**Status Filter:**

Filters requirements by their `status` field:

* "All Statuses" (default)
* "Not Started"
* "In Progress"
* "All Evidence Received"
* "Blocked" (custom status if present)

**Evidence Status Filter:**

Filters by derived evidence state:

* "All Evidence States" (default)
* "Evidence Pending" (status ≠ "All Evidence Received")
* "Evidence Received" (status = "All Evidence Received")

**Interaction:**

* Both filters are dropdown selects
* Applying a filter re-derives the table and metrics immediately (presentation-only state change)
* Filters do not affect the stored data or KPI strip (only the table view changes)
* Multiple filters combine with AND logic (both must match)

---

### 68.10 Requirement Table

A dense, sortable data grid showing all (filtered) requirements.

**Columns:**

1. **ID** — Requirement identifier (e.g., REQ-MER-0001)
   - Sortable A-Z
   - Fixed width, monospace font
   - Copied to clipboard on double-click (future)

2. **Requirement** — Full requirement text
   - Clickable link to detail drawer
   - Truncated with ellipsis if too long; full text appears on hover
   - Primary interaction point

3. **Status** — Current status (Not Started, In Progress, All Evidence Received, etc.)
   - Tone-coded badge
   - Sortable
   - Text color indicates tone; background is muted

4. **Controls Mapped** — Count of controls this requirement is linked to
   - Numeric count (e.g., "1", "2", "0")
   - Right-aligned
   - Sortable
   - Zero is displayed; not hidden

5. **Evidence Status** — Derived from requirement status
   - Badge: "All Evidence Received" (green), "Evidence Partially Received" (yellow), "Evidence Pending" (red)
   - Sortable
   - Reflects the requirement's status field

6. **Last Updated** — ISO date/time or relative time (e.g., "2 days ago")
   - Right-aligned
   - Sortable newest-first by default
   - Timestamp appears on hover

**Row Interaction:**

* Entire row is clickable
* Click opens the Requirement Detail drawer
* No multi-selection in Release 1 (future bulk operations)

**Sorting:**

* Click column header to sort A-Z or Z-A
* Visual indicator (arrow) shows current sort direction
* Default sort: ID ascending (first appearance order)

**Pagination:**

Dense table displays all filtered requirements on one page (Release 1 limit: ~1000 rows; Release 2 adds lazy-load pagination).

---

### 68.11 Requirement Detail Drawer (Issue #37, Phase 5 ✓ COMPLETE)

When user clicks a requirement row, a shared enterprise drawer opens.

**Drawer Header:**

* Eyebrow: "REQUIREMENT"
* Title: The requirement text (or first 60 characters + ellipsis)
* Subtitle: The requirement ID
* Badges: Status badge, Evidence Status badge
* Close button (X) at top right

**Drawer Body — Inspector Sections:**

The drawer renders a multi-section inspector showing:

1. **Properties** — Read-only metadata
   - Requirement ID
   - Status
   - Owner (team or person)
   - Owning team
   - Evidence type
   - Evidence status
   - Framework mapping

2. **Description** — Full requirement narrative (if recorded)
   - "No description recorded for this requirement" (if blank)

3. **Related Evidence** — Linked evidence items
   - Evidence ID and title
   - Status badge
   - "Open" link navigates to Evidence workspace
   - Non-linked evidence is not shown

4. **Related Controls** — Linked controls
   - Control ID and title
   - Framework reference
   - "Open" link navigates to Controls workspace
   - Supports three shapes: `linkedControlIds`, `controlId`, `controlLinks` (engagement-scoped by controlCode)
   - Only displays resolved links; no fabrication

5. **Related Evidence Requests** — Pending evidence requests for this requirement
   - Request ID and description
   - Status (Pending, Acknowledged, Provided)
   - "View" link opens request detail

6. **Test Procedures** — Related testing workpapers
   - Test procedure title
   - Related control (if applicable)
   - Status and completion %
   - "View" link navigates to Testing workspace

7. **Evidence Status Workflow** — Suggestion Service-driven workflow
   - Linked evidence items with status dropdowns
   - "Propose Status Change" button for each evidence item
   - Pending suggestions (Suggested, Reviewed, Approved states)
   - Lifecycle actions (Review, Approve, Apply)
   - Recent activity on the requirement

8. **Related Walkthroughs** — Walkthroughs that inform this requirement
   - "No linked walkthroughs yet" message (if none)
   - Walkthrough title and team
   - "Open" link navigates to Walkthrough workspace (Release 2)

9. **Storage & Audit Folders** — Supporting documentation locations
   - Related folders in SharePoint, Box, etc. (if integrated; Release 2)
   - File count and last modified date

10. **Cross-Engagement Reuse** — Evidence reuse across engagements
    - "No reuse recorded" if not shared
    - Links to evidence declared in other engagements

11. **Version History** — Immutable version records
    - "Only the current version" message (Release 1)
    - Immutable mutation lineage when Release 2 introduces history

12. **Approval History** — Governance decisions
    - Checkmark for "All Evidence Received" approval
    - No history until Release 2

13. **Activity History** — All changes to the requirement
    - Most recent first
    - "Complete lineage" expansion (shows full changelog)

**Drawer Behavior (Issue #37, Phase 5):**

* Drawer slides in from the right with animation
* Closes with Escape key or close button
* Survives route changes within the same engagement (drawer stays open if user navigates to different requirement)
* Closes when user navigates to a different engagement or workspace
* Focus returns to the last-focused requirement row on close
* Body scrolls independently; header remains sticky

---

### 68.12 Evidence Status Workflow (Issue #37, Phase 6 ✓ COMPLETE)

The drawer includes an Evidence Status Workflow section managing requirement evidence through the Suggestion Service.

**Workflow Stages:**

Evidence statuses progress through: Suggested → Reviewed → Approved → Applied

**Linked Evidence Card:**

For each evidence item linked to the requirement:

* Evidence title and ID
* Current status (dropdown select)
* "Propose Status Change" button
* Status change opens a proposal in the Suggestion Service

**Suggestion Lifecycle in Workflow:**

1. **Suggested** — User proposes evidence status change
   - Visible as a pending suggestion
   - Shows original status and proposed new status
   - "Review" button opens review interface

2. **Reviewed** — Suggestion has been reviewed
   - "Approve" button to move forward
   - "Reject" button to dismiss
   - Comments from reviewer displayed

3. **Approved** — Suggestion approved, awaiting application
   - "Apply" button applies the status change to the evidence record
   - Repository write happens only on Apply (never on Suggest or Approve)
   - Single correlation ID tracks the entire workflow

4. **Applied** — Status change has been written to the Repository
   - Evidence record shows the new status
   - Drawer refreshes automatically to reflect the change

**Recent Activity Section:**

Shows activity on this requirement:

* Status changes (date and actor)
* Comments added
* Evidence received
* Suggestions raised
* "View complete lineage" expansion shows full history

---

### 68.13 Shared Drawer Component (Issue #37, Phase 5 ✓ COMPLETE)

The Requirement Detail Drawer uses the Shared Enterprise Drawer component.

**Component Features:**

* **Position:** Fixed position at z-modal (500); escapes overflow-hidden ancestors
* **Size:** 30rem wide (94vw on mobile); height = viewport - shell header
* **Animation:** Slide-in from right (aos-drawer-slide-in); fade-in backdrop (aos-drawer-fade-in)
* **Backdrop:** Semi-transparent scrim (rgb(15 23 42 / 0.4)) for light mode, darker for dark mode
* **Accessibility:** Trap focus within drawer; return focus to trigger element on close
* **Reduced-motion:** Animations respect prefers-reduced-motion media query

**Reuse Across Workspaces:**

The same Drawer component is used for:
* Requirement detail (this workspace)
* Evidence detail (Evidence workspace)
* Control detail (Controls workspace)
* POC detail (Team and POC workspaces)
* Header Activity audit trail

All drawers share:
* Visual appearance
* Animation behavior
* Keyboard interaction (Escape to close)
* Focus management
* Responsive sizing

---

### 68.14 Filters and Presentation State

Filters are **presentation-only** state, not data state.

**State Management:**

* Filters are stored in memory, not persisted
* Filters survive page refresh (Release 2 future work)
* Filters are cleared when user navigates away from the workspace
* Filters do not modify the Shared Audit State
* Drawer opening/closing is independent of filter state

**Filter Sync:**

* Applying a filter immediately re-renders the table
* KPI strip remains unchanged (always shows engagement totals)
* Drawer remains open if user changes filters

---

### 68.15 Module Registry

The workspace is module-driven.

Modules declare:

```javascript
{
  id: 'requirements-kpi',
  region: 'content',
  enabled: true,
  collapsedByDefault: false,
  kicker: 'Operational status',
  title: 'At a glance',
  render: function() { ... }
}
```

This allows future releases to reorder or customize the workspace without code changes.

---

### 68.16 Control Mapping Architecture (Issue #37, Phase 4 ✓ COMPLETE)

Three shapes are supported for requirement-to-control mapping:

1. **linkedControlIds** (priority): Direct array of control IDs
   ```javascript
   { linkedControlIds: ['CSC-01', 'CSC-02'] }
   ```

2. **controlId** (fallback): Single control ID
   ```javascript
   { controlId: 'CSC-01' }
   ```

3. **controlLinks** (engagement-scoped): Array of objects with engagementId and controlCode
   ```javascript
   { controlLinks: [
       { engagementId: 'ENG-MER-ZPQP-2025', controlCode: 'CSC-01' }
     ]
   }
   ```
   - Resolved through an engagement-scoped `controlCode → id` index
   - Links to different engagements are dropped
   - Unmapped codes are dropped (no fabrication)

**Resolution Logic:**

1. If `linkedControlIds` exists, use it
2. Else if `controlId` exists, use it as array of one
3. Else if `controlLinks` exists, resolve through the engagement-scoped code index
4. Otherwise return empty array

No requirement ever shows a fabricated control count.

---

### 68.17 Data Model

The workspace operates on requirements from the Shared Audit State.

**Requirement Object Shape (Release 1):**

```javascript
{
  id: 'REQ-MER-0001',
  engagementId: 'ENG-MER-ZPQP-2025',
  title: '...',
  status: 'All Evidence Received',
  linkedControlIds: [...],      // or controlId or controlLinks
  linkedEvidenceIds: [...],     // evidence owned by requirement
  requirementIds: [...],        // evidence declaring the requirement
  description: '...',
  owner: { id, name },
  owningTeam: { id, name },
  created: '2026-01-15',
  modified: '2026-07-10'
}
```

---

### 68.18 Responsive Behavior

The workspace responds to viewport width changes:

* **Desktop** (> 1024px): KPI strip, graphs, table, and supporting panels visible
* **Tablet** (640–1024px): Single-column layout; table becomes scrollable; panels collapse
* **Mobile** (< 640px): Stacked layout; drawer appears full-width with slide-up animation

---

### 68.19 Accessibility

The workspace maintains:

* Semantic heading hierarchy
* ARIA labels on all interactive elements
* Keyboard navigation through table (arrow keys, Tab)
* Sortable column headers are keyboard-accessible
* Drawer focus management (trap focus, return to trigger on close)
* Text-based status (badges + labels, never color alone)
* Reduced-motion support for animations

---

### 68.20 Constraints and Limitations

* Requirement detail is read-only in Release 1 (editing requirements is Release 2)
* Evidence status changes flow through Suggestion Service (Release 2 adds direct approval workflows)
* Control mapping supports three shapes but cannot mix them in a single requirement (one shape per requirement)
* Bulk operations (select multiple requirements, apply status change) are Release 2
* Cross-engagement reuse display is Release 2

---

### 68.21 Historical Context (Issue #37 ✓ COMPLETE)

Prior to Issue #37:
* Requirements appeared only in the Engagement Workspace as part of a lifecycle visualization
* No dedicated requirement-first workspace existed
* Evidence collection progress was not prominently displayed
* No requirement-to-control mapping visibility

Issue #37 introduced:
* Requirements & Evidence as a primary operational workspace
* Requirement-first view with dense, filterable table
* KPI strip and progress visualization
* Shared enterprise drawer for requirement detail (Issue #37 Phase 5)
* Evidence status workflow through Suggestion Service (Issue #37 Phase 6)

---

### 68.22 Summary

The Requirements & Evidence Workspace serves as the operational center for evidence collection.

By providing a requirement-first view with KPI visibility, filterable table access, and shared drawer detail with embedded evidence workflow, the workspace enables auditors to manage evidence collection efficiently while maintaining full engagement awareness through the Shared Audit State and the hierarchical navigation model.

---
