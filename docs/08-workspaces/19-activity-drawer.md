# PART IX — WORKSPACE SPECIFICATIONS

## Chapter 70 — Activity Drawer (Header Audit Trail)

---

### 70.1 Purpose

The Activity Drawer is the audit trail interface accessible from the Application Shell header.

It provides users with quick access to recent changes across four contextual scopes without leaving their current workspace.

The drawer enables transparency and traceability by displaying who changed what, when, and (where available) why.

---

### 70.2 Objectives

The Activity Drawer exists to:

* Provide immediate visibility into recent activity
* Scope activity to the current operational context
* Display a complete audit trail without navigation
* Support drill-down into related items
* Enable quick troubleshooting ("Who changed this?")
* Preserve engagement context while browsing activity
* Support compliance and internal audit requirements

---

### 70.3 Intended Users

The Activity Drawer is designed for:

* Auditors — checking what changed and validating current state
* Engagement Leads — understanding recent team activities
* Quality Reviewers — verifying audit trail completeness
* Partners — spot-checking recent activity during reviews
* Compliance — generating activity reports for regulatory requirements

---

### 70.4 Access Control (Issue #37, Phase 7)

The Activity Drawer is capability-gated on `audit-log.view`.

**Visible When:**

User has `audit-log.view` capability.

**Hidden When:**

User lacks `audit-log.view` capability (button is hidden, never disabled).

**Session Preset:**

Default session preset "Engagement Lead · Platform Administrator" includes the capability.

Preparer session does not include it (activity button remains hidden).

---

### 70.5 Header Trigger

A button in the Application Shell header opens the Activity Drawer.

**Button Placement:**

* Located in shell header, typically after other action buttons
* Aria-label: "Open audit activity"
* Icon: Hourglass or history icon
* Visible only to users with `audit-log.view` capability

**Keyboard Shortcut (Release 2):**

Future release may support keyboard shortcut (e.g., Shift+A) to toggle drawer.

---

### 70.6 Four Contextual Scopes

The Activity Drawer displays activity across four nested scopes.

```text
┌──────────────────────────────────────────┐
│ Activity Drawer                    ╳     │
├──────────────────────────────────────────┤
│                                          │
│ § PAGE                                   │
│   Recent activity on this workspace      │
│   • Status changed to...                 │
│   • Evidence submitted by POC Name       │
│   • Suggestion approved                  │
│                                          │
│ § ENGAGEMENT                             │
│   Recent engagement-level changes        │
│   • Framework approved                   │
│   • Walkthrough scheduled                │
│   • Evidence request sent                │
│                                          │
│ § CLIENT                                 │
│   Cross-engagement activities            │
│   • Engagement started                   │
│   • Report generated                     │
│   • Portfolio milestone reached          │
│                                          │
│ § PLATFORM                               │
│   Organization-wide activity (if perm.)  │
│   • Policy updated                       │
│   • Framework added to registry          │
│   • New user invited                     │
│                                          │
│ [View complete lineage]                  │
└──────────────────────────────────────────┘
```

Each scope shows the 3–5 most recent events.

---

### 70.7 Page Scope

The innermost scope shows activity related to the current workspace/page.

**For Requirements & Evidence Workspace:**

Activity on requirements and evidence:

* "Status changed to All Evidence Received for REQ-MER-0001"
* "Evidence submitted: [Evidence Title]"
* "Suggestion proposed: [Suggestion Detail]"
* "Comment added to REQ-MER-0001"
* "Control mapping updated"

**Format:**

Each event shows:

* Action description
* Related items (requirement ID, evidence title, etc.)
* Timestamp (human-readable: "2 hours ago")
* Actor (auditor name, or "System" for automation)
* "View" link (navigates to related item in current workspace)

**Newest First:**

Most recent events appear at top.

---

### 70.8 Engagement Scope

The next level shows engagement-level activity.

**Typical Events:**

* Walkthrough scheduled (team name, date)
* Framework approved by partner
* Evidence request created (count)
* Requirement added or modified (count)
* Control mapping updated
* Milestone reached (e.g., "75% evidence collected")
* Engagement status changed
* Scope modification approved
* Testing round initiated
* Report generated or updated

**Format:**

Similar to page scope:

* Action description
* Related items
* Timestamp
* Actor
* "View" link (navigates to related workspace, then to item)

---

### 70.9 Client Scope

The next level shows cross-engagement client activity.

**Typical Events (Engagement-Independent):**

* New engagement created
* Engagement status changed (started, completed)
* Portfolio metric reached (e.g., "All evidence collected for 3 of 5 engagements")
* Client POC changed
* Client contract updated
* Organization structure changed
* Portfolio report generated
* Cross-engagement recommendation approved

**Format:**

* Action description
* Related engagement (name)
* Timestamp
* Actor
* "View" link (navigates to engagement, then workspace if applicable)

---

### 70.10 Platform Scope

The outermost scope shows organization-wide activity.

**Access Control:**

Only visible to users with broader platform-view permissions (typically partners, admins).

Regular auditors may not see platform scope.

**Typical Events:**

* Framework added to registry
* Framework version released
* Policy updated
* User invited to organization
* User role changed
* Team created or modified
* Organizational settings updated
* AI model updated
* Compliance requirement changed

**Format:**

* Action description
* Related item (framework name, user name, etc.)
* Timestamp
* Actor
* "View" link (where applicable)

---

### 70.11 Drawer Implementation

The Activity Drawer reuses the Shared Enterprise Drawer component (Issue #37, Phase 5).

**Configuration:**

```javascript
AuditOS.presentation.openDrawer({
  eyebrow: 'AUDIT TRAIL',
  title: 'Recent Activity',
  subtitle: 'Page, Engagement, Client, Platform',
  badges: [],
  content: activityScopeNodes,
  onClose: function() { ... }
});
```

**Each Scope as Section:**

The drawer body contains four sections (one per scope).

Each section is a collapsible disclosure widget:

* Default: all sections expanded
* Click section title to toggle
* Each shows 3–5 recent events plus a "Complete Lineage" link

---

### 70.12 Complete Lineage Expansion

Each scope has a "View complete lineage" link.

Clicking expands to show all activity (or paginated activity if very large).

**Lineage Display:**

* Full list of events for the scope (newest first)
* More complete than the drawer summary
* Useful for compliance review or troubleshooting
* Can be exported or printed (Release 2 future work)

---

### 70.13 Activity Event Attributes

Every activity event captured includes:

* **Timestamp**: When the event occurred (ISO 8601)
* **Actor**: Who performed the action (user ID, name, email)
* **Action**: What was done (e.g., "status-changed", "evidence-submitted", "suggestion-approved")
* **EntityType**: What kind of thing was affected (requirement, evidence, control, etc.)
* **EntityId**: ID of the affected thing
* **EntityName**: Readable name or text
* **OldValue**: Previous state (for state-change events)
* **NewValue**: New state (for state-change events)
* **Reason**: Why (optional comment or justification)
* **RelatedEntities**: IDs of related items (e.g., evidence linked to requirement)
* **CorrelationId**: If part of a workflow (e.g., suggestion approval), the correlation ID connecting all events

---

### 70.14 Activity Filtering (Release 2 Future Work)

Release 1: Activity is not filterable.

Release 2 may add:

* Filter by entity type (show only evidence changes)
* Filter by actor (show only my changes)
* Filter by time range (last week, last month)
* Filter by action type (approvals only, submissions only)

---

### 70.15 Route-Based Close

When user navigates to a different workspace or engagement, the Activity Drawer closes.

**Behavior:**

* Page-scope changes only (same engagement, different workspace) → drawer stays open
* Engagement changes (different engagement) → drawer closes
* Client changes (different client) → drawer closes

This prevents confusing activity context when users switch engagements.

---

### 70.16 Performance Considerations

Activity queries may be large (thousands of events).

**Optimization Strategies:**

* Load only recent events (3–5 per scope) for initial display
* "Complete lineage" link fetches full history on demand
* Pagination for very large result sets (Release 2)
* Activity index optimized for time-range queries

---

### 70.17 Responsive Behavior

The Activity Drawer inherits responsive behavior from the Shared Enterprise Drawer.

* **Desktop (>1024px):** Full 30rem width
* **Tablet (640–1024px):** Narrower, 28rem
* **Mobile (<640px):** Full-width or slide-up variant

Content adapts:

* Timestamps abbreviated on mobile
* "View" links remain keyboard-accessible
* Scrolling within drawer body

---

### 70.18 Accessibility

The Activity Drawer is fully accessible.

**Keyboard Navigation:**

* Tab through sections, links, and buttons
* Escape closes drawer
* Enter/Spacebar expands sections

**ARIA Labels:**

* Drawer has `role="dialog"` and `aria-modal="true"`
* Section titles use `<h3>`
* Links and buttons properly labeled
* Timestamps are semantic time elements

**Screen Reader Support:**

* Event descriptions are readable as prose
* Actor information is conveyed textually
* Links announce their destination

---

### 70.19 Dark Mode Support

The Activity Drawer adapts to light/dark theme.

* Event badges respect tone-based coloring (success/warning/error/info)
* Text contrast remains WCAG AA
* Timestamps readable in both modes

---

### 70.20 Constraints and Limitations

* Drawer is read-only; activity cannot be edited or deleted (by design)
* Activity is filtered by user permissions (users do not see activity they have no access to)
* Platform-scope activity is not visible to regular auditors (authorization-based filtering)
* Real-time updates are not supported (Release 1 shows point-in-time snapshot)
* Activity retention policy is configurable per organization (Release 2)

---

### 70.21 Historical Context (Issue #37, Phase 7)

Prior to Issue #37:
* Audit trail was not easily accessible
* Activity viewing required navigating to each workspace individually
* No cross-scope activity visibility
* Activity history was often hidden in inspector detail sections

Issue #37 Phase 7 introduced:
* Header Activity Drawer for immediate access to recent activity
* Four-level scope visualization (Page → Engagement → Client → Platform)
* Reuse of Shared Enterprise Drawer component
* Capability-gating on `audit-log.view`
* Complete lineage expansion for compliance review

---

### 70.22 Summary

The Activity Drawer is the unified audit trail interface for AuditOS.

By providing capability-gated access to recent activity across four contextual scopes without requiring navigation away from the current workspace, the drawer enables users to answer "What changed?" and "Who changed it?" at a glance.

The drawer is a key transparency feature that helps auditors, reviewers, and compliance teams maintain visibility into all changes across an engagement while preserving complete auditability through immutable event records and correlation IDs.

---
