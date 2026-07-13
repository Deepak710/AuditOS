# PART IX — WORKSPACE SPECIFICATIONS

## Chapter 69 — Evidence Status Workflow (Issue #37 ✓ COMPLETE)

---

### 69.1 Purpose

The Evidence Status Workflow is the governed process for changing evidence status within an engagement.

Rather than allowing direct status edits, status changes flow through the Suggestion Service as recommendations that must be suggested, reviewed, approved, and applied before taking effect.

This ensures that:

* All evidence status changes are auditable
* Changes can be reviewed before application
* Correlation IDs track the full workflow
* Repository writes happen only once (on Apply)
* All stakeholders have visibility into pending changes

---

### 69.2 Design Philosophy

The workflow embodies audit governance principles.

#### Governed Change

Status changes are recommendations, not immediate actions.

#### Traceability

Every change from Suggested → Applied is logged with who took each action.

#### Reversibility (Suggested/Reviewed)

Until approved, changes are purely advisory.

#### Auditability

The Repository never records tentative changes; only Applies write to the record.

#### Single Write

The Repository write happens exactly once, on Apply, never on Suggest or Approve.

#### Correlation

One correlation ID connects suggestion → approval → application.

---

### 69.3 Workflow Stages

Evidence status changes progress through four stages.

```text
1. SUGGESTED
   ↓
2. REVIEWED
   ↓
3. APPROVED
   ↓
4. APPLIED
```

**Stage Definitions:**

**1. SUGGESTED**

The user proposes a status change through the UI.

* Status change is captured in a Suggestion record
* Suggestion status = "Suggested"
* Displayed in the workflow section of the drawer
* User can specify a reason or justification
* Not yet written to Repository

**2. REVIEWED**

A reviewer examines the proposed change.

* Reviewer clicks "Review" on the suggestion
* Reviewer may add comments or context
* Reviewer clicks "Approve" (move to Approved stage) or "Reject" (terminal)
* Suggestion status = "Reviewed"
* Rejection is final; no further progression

**3. APPROVED**

The change is approved and awaiting application.

* Approver clicked "Approve" in the previous stage
* Suggestion status = "Approved"
* "Apply" button becomes available
* Change is still not written to Repository

**4. APPLIED**

The approved change is written to the Repository.

* User clicks "Apply" button
* Repository writes the new evidence status to the evidence record
* Evidence drawer refreshes to show the new status
* Suggestion status = "Applied"
* Change is final and immutable

---

### 69.4 Suggestion Service Integration (Issue #37, Phase 6)

The workflow reuses the Suggestion Service to manage lifecycle.

**Suggestion Record Shape:**

```javascript
{
  id: 'SUGG-MER-0001',
  engagementId: 'ENG-MER-ZPQP-2025',
  type: 'evidence-status-change',
  status: 'Suggested',  // or Reviewed, Approved, Applied, Rejected
  
  affectedRequirements: ['REQ-MER-0001'],
  
  applyTarget: {
    type: 'evidence',
    evidenceId: 'EVD-MER-0001',
    field: 'status',
    currentValue: 'Evidence Pending',
    proposedValue: 'All Evidence Received'
  },
  
  proposedBy: { id, name, timestamp },
  reviewedBy: { id, name, timestamp },
  approvedBy: { id, name, timestamp },
  appliedBy: { id, name, timestamp },
  
  comments: [
    { author, timestamp, text }
  ],
  
  correlationId: 'CORR-MER-EV-0001'
}
```

---

### 69.5 Workflow Presentation in Requirements Drawer

The Evidence Status Workflow section appears in the Requirement Detail drawer.

**Section Layout:**

```text
EVIDENCE STATUS WORKFLOW

[Evidence card 1]
  Title:              System generated list...
  Current status:     All Evidence Received (badge)
  
  [Propose status change button]
  
  [Pending suggestions - if any]
    • Suggested status change: Evidence Pending → Under Review
      Proposed by: Auditor Name, 2 days ago
      [Review button]
  
  [Recent activity - if any]
    • Status changed to All Evidence Received by Reviewer Name, 1 day ago
    • Evidence submitted by POC Name, 2 days ago

[Evidence card 2]
  ...
```

**Per-Evidence Interaction:**

For each linked evidence item:

1. **Current Status Display**
   - Status badge showing current value
   - Read-only field (not an inline edit)

2. **"Propose Status Change" Button**
   - Click opens a status-change proposal form
   - Form shows: current status, proposed status dropdown, reason text field
   - User selects new status and optionally adds a note
   - "Propose" button creates the suggestion

3. **Pending Suggestions Display**
   - If a suggestion exists (status = Suggested or Reviewed), show it
   - Display: current status → proposed status
   - Action buttons: "Review" (opens review), "Approve", "Reject", "Apply"
   - Comments from reviewers displayed inline

4. **Recent Activity**
   - List of recent status changes, submissions, comments
   - "View complete lineage" expands full history

---

### 69.6 Proposing a Status Change

User clicks "Propose Status Change" for an evidence item.

**Dialog/Form:**

```text
┌─────────────────────────────────────┐
│ Propose Status Change               │
├─────────────────────────────────────┤
│                                     │
│ Evidence: System generated list...  │
│ Requirement: REQ-MER-0001           │
│                                     │
│ Current Status: All Evidence Rec.   │
│                                     │
│ Proposed Status: [dropdown ▼]       │
│   • Evidence Pending                │
│   • Evidence Partially Received     │
│   • All Evidence Received           │
│   • Under Review                    │
│                                     │
│ Reason (optional):                  │
│ [text field]                        │
│ Need to re-verify...                │
│                                     │
│ [Cancel]  [Propose]                 │
└─────────────────────────────────────┘
```

**On "Propose":**

1. Suggestion record created with status="Suggested"
2. Correlation ID assigned
3. Suggestion displayed in workflow section (Suggested state)
4. Drawer refreshes to show the pending suggestion
5. Evidence record status **does not change** (still shows original status)

---

### 69.7 Reviewing a Suggestion

Reviewer clicks "Review" on a pending suggestion.

**Review Interface:**

```text
┌──────────────────────────────────────┐
│ Review Suggestion                    │
├──────────────────────────────────────┤
│                                      │
│ Proposed Status Change               │
│   From: All Evidence Received        │
│   To:   Evidence Pending             │
│                                      │
│ Proposed By: Auditor Name            │
│ Reason: Need to re-verify...         │
│                                      │
│ Comments (optional):                 │
│ [text field]                         │
│ Agreed, re-verification needed.      │
│                                      │
│ Decision:                            │
│ [Approve]  [Reject]                  │
└──────────────────────────────────────┘
```

**On "Approve":**

1. Suggestion status changes to "Reviewed"
2. Reviewer name and timestamp recorded
3. Reviewer comments stored
4. "Apply" button becomes available in drawer
5. Drawer refreshes to show Reviewed state

**On "Reject":**

1. Suggestion status changes to "Rejected"
2. Rejection is terminal (no further progression)
3. Suggestion still visible in workflow section (for audit trail)
4. Original evidence status remains unchanged

---

### 69.8 Approving a Suggestion

Some workflows may have a separate approval stage (Release 2).

Release 1 combines Review and Approve into a single action:
* Review + Approve happen together
* "Approve" button in review interface moves suggestion to "Approved" state

Release 2 may introduce:
* Separate approve role (quality reviewer, partner, etc.)
* Approval queue
* Approval deadline tracking

---

### 69.9 Applying the Change

User (or automated process) clicks "Apply" to write the suggestion to the Repository.

**On "Apply":**

1. Evidence record's `status` field updated to proposed value
2. Repository write happens (exactly once)
3. Suggestion status changes to "Applied"
4. Applier name and timestamp recorded
5. Activity event generated: "Status changed by [User] at [Time]"
6. Drawer refreshes
7. Evidence card now shows new status badge
8. Drawer remains open with updated information

**Correlation ID Tracking:**

All events in the workflow (Suggested, Reviewed, Approved, Applied) share one `correlationId`.

Example trace:
```
CORR-MER-EV-0001

1. Suggestion created: SUGG-MER-EVD-0001 (Suggested) [Auditor1, 10:00]
2. Reviewed: SUGG-MER-EVD-0001 (Reviewed) [Reviewer1, 10:15]
3. Approved: SUGG-MER-EVD-0001 (Approved) [Reviewer1, 10:15]
4. Applied: SUGG-MER-EVD-0001 (Applied) [Auditor1, 10:30]
   → Evidence.status updated to "Evidence Pending"
   → Activity event logged
```

---

### 69.10 Pending Suggestions Display

Suggestions are displayed in priority order:

1. **Suggested** (awaiting review) — appears first
2. **Reviewed** (awaiting approval) — appears second
3. **Approved** (awaiting application) — appears third
4. **Terminal** (Applied, Rejected) — appears in activity section

**Each Suggestion Card Shows:**

* Status badge
* Current → Proposed status with arrow
* Proposed by (name and timestamp)
* Reason/description
* Comments from reviewers
* Action buttons appropriate to current status

---

### 69.11 Activity Lineage

The Activity History section shows complete status change history.

**Activity Entry Example:**

```
Status changed to "Evidence Pending"
  by Auditor Name
  2026-07-10 at 10:30
  
  Suggestion (Applied)
    Proposed: 2026-07-10 at 10:00 by Auditor Name
    Reviewed: 2026-07-10 at 10:15 by Reviewer Name
    Applied: 2026-07-10 at 10:30 by Auditor Name
```

Click to expand full lineage showing all intermediate states and decision comments.

---

### 69.12 Multiple Suggestions on One Requirement

A requirement may have multiple evidence items with pending suggestions.

**Display:**

Each evidence card shows its own pending suggestions (if any).

Drawer scrolls to allow viewing all evidence cards and their workflows.

No conflict; suggestions are independent per evidence item.

**Scenario:**

Evidence Item 1: Proposed change pending review
Evidence Item 2: Proposed change already approved, awaiting apply
Evidence Item 3: No pending change (current status)

All visible in the same drawer section, scrolling vertically.

---

### 69.13 Bulk Workflow (Release 2 Future Work)

Release 1: Status changes are proposed one evidence item at a time.

Release 2 future capabilities:

* Select multiple evidence items
* Propose same status change for all
* Batch review and approval
* Single Apply for all selected

---

### 69.14 Rejection Handling

If a suggestion is rejected, the workflow stops.

**Display:**

Rejected suggestion remains visible in the workflow section.

**Restarting:**

User can propose a different status change (creates a new suggestion).

No "undo rejection" mechanism; users propose a new change instead.

---

### 69.15 Constraints and Limitations

* Only one unresolved suggestion per evidence item (Release 1)
* Suggestions created in Release 1 cannot be edited; must reject and recreate
* Approval workflow is binary (approve or reject); Release 2 adds conditional approvals
* Deadline tracking for pending suggestions is Release 2 future work
* Escalation of blocked suggestions (e.g., waiting for manager approval) is Release 2

---

### 69.16 Security and Authorization

Suggestion Service handles authorization checks.

**Permissions Required:**

* To propose: `evidence.suggest` capability (typically Evidence Manager or Auditor)
* To review/approve: `evidence.approve` capability (typically Senior Auditor or Partner)
* To apply: `evidence.apply` capability (typically Evidence Manager)

If user lacks a capability, the corresponding action button is hidden (never disabled).

---

### 69.17 Auditability

The workflow is designed for complete auditability.

**What's Logged:**

* Every suggestion creation (who, when, why)
* Every review/approval decision (who, when, comments)
* Every application (who, when)
* Correlation ID connects all events
* No tentative state is recorded in the Repository

**Audit Trail Queries:**

```sql
-- "Show me all evidence status changes for requirement X"
SELECT * FROM suggestions
WHERE affectedRequirements CONTAINS 'REQ-MER-0001'
  AND type = 'evidence-status-change'
  AND status = 'Applied'
ORDER BY appliedAt DESC;

-- "Show me the full lineage of suggestion SUGG-MER-0001"
SELECT * FROM suggestions
WHERE correlationId = 'CORR-MER-EV-0001'
ORDER BY timestamp ASC;
```

---

### 69.18 Accessibility

The workflow maintains accessibility standards.

**Dialog/Form Accessibility:**

* Modal dialog has focus management (focus trapped, returns to trigger on close)
* Form fields are labeled and associated
* Keyboard navigation through controls
* Dropdowns are accessible select elements

**Drawer Integration:**

* Workflow section is keyboard-navigable
* "Propose" button, "Review" link, "Apply" button all keyboard-accessible
* Status badges convey meaning through text, not color alone

---

### 69.19 Historical Context (Issue #37, Phase 6)

Prior to Issue #37:
* Evidence status changes could only be made by editing the evidence record directly
* No review or approval workflow existed
* No audit trail of who changed what and when
* Status changes were not correlated across a workflow

Issue #37 Phase 6 introduced:
* Evidence Status Workflow through Suggestion Service
* Suggested → Reviewed → Approved → Applied progression
* Repository write only on Apply (never on Suggest/Approve)
* Correlation IDs for full workflow tracking
* Embedded workflow in Requirement Detail drawer

---

### 69.20 Summary

The Evidence Status Workflow is a governed process for changing evidence status.

By requiring that status changes be suggested, reviewed, approved, and applied through the Suggestion Service before writing to the Repository, AuditOS ensures that:

* All changes are auditable
* Stakeholders have visibility into pending changes
* Authority is preserved (review and approval roles can reject)
* The Repository remains the single source of truth
* Full lineage is preserved for compliance and internal review

The workflow is a key example of how AuditOS elevates operational decisions from simple state changes into governance-aware, correlated, auditable workflows.

---
