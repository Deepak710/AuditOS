# PART IX — WORKSPACE SPECIFICATIONS

## Chapter 67 — POC Workspace

---

### 67.1 Purpose

The POC Workspace is the operational focus view for a single Point of Contact within a team.

It provides auditors with a detailed understanding of an individual's participation, responsibilities, evidence ownership, session contributions, and status within the broader team and engagement context.

The POC Workspace is accessed by selecting a POC from the Team Workspace roster or through deep linking.

---

### 67.2 Objectives

The POC Workspace exists to:

* Focus on an individual's engagement participation
* Display POC identity, role, and organizational context
* Show all sessions this POC participated in (real sessions only)
* Surface evidence items this POC owns or contributed to
* Present POC-specific blockers or dependencies
* Enable communication with the POC
* Support scheduling coordination (timezone, availability)
* Display POC-scoped recommendations
* Maintain team and engagement context awareness

---

### 67.3 Intended Users

The POC Workspace is designed for:

* Auditors — understanding a specific POC's role and contributions
* Engagement Managers — tracking individual POC progress
* Team Leads — coordinating with specific team members
* POCs themselves — viewing their own participation and responsibilities

---

### 67.4 Architectural Principles

The following principles govern the POC Workspace.

#### Individual Focus

The workspace focuses on a single person's participation, not the team as a whole.

---

#### Real Session History Only

Sessions displayed are those the POC actually participated in. No fabricated attendance records.

---

#### Hierarchical Context

POC workspace operates within Team context, which operates within Engagement context.

---

#### Shared State

The workspace consumes the Shared Audit State.

---

#### Progressive Disclosure

Additional detail (session notes, evidence details) is revealed on demand.

---

### 67.5 Hierarchical Context

The POC Workspace operates within a three-level hierarchy.

```text
Engagement
│
└── Walkthrough (or Team)
    │
    └── POC (current context)
```

The workspace maintains awareness of:
* Active Engagement
* Active Walkthrough or Team (parent context)
* Active POC (primary context)

Breadcrumb: `Home / Client / Engagement / Team / POC Name`

---

### 67.6 Workspace Responsibilities

The POC Workspace is responsible for:

* presenting POC identity and profile
* displaying POC participation history (real sessions only)
* showing POC-owned evidence and tasks
* surfacing POC-specific blockers
* displaying POC-scoped recommendations
* maintaining hierarchical context awareness
* enabling POC navigation without losing team context

The workspace is intentionally **not** responsible for:

* modifying POC records directly
* managing POC assignment (Release 2)
* scheduling sessions (Release 2)
* approving recommendations

---

### 67.7 Primary Business Objects

The workspace primarily operates upon:

* POC (the focal entity)
* Team (parent context)
* Engagement (grandparent context)
* Session (POC-filtered participation records)
* Evidence (POC-owned items)
* Suggestion (POC-scoped recommendations)
* Activity (POC-scoped events)

---

### 67.8 Workspace Layout

The POC Workspace inherits the Workspace Shell and follows this composition:

```text
Header
├── Hierarchical context (Client, Engagement, Team, POC name)
├── POC identity (name, title, status)
└── Navigation breadcrumb

Content
├── POC Identity Card
│   ├── Photo/avatar (if available)
│   ├── Name and title
│   ├── Department/role
│   ├── Timezone
│   ├── Contact information (email, phone)
│   ├── Preferred communication method
│   ├── Status (Active, Blocked, Completed, Absent)
│   └── Relationship to engagement (main POC, escalation POC, team member)
│
├── POC Participation
│   ├── Sessions this POC participated in (real sessions only)
│   │   ├── Most recent session first
│   │   ├── Each session: date, title, status, duration
│   │   ├── "View session notes" link
│   │   └── "View attendees" link
│   │
│   ├── Participation summary
│   │   ├── Total sessions participated
│   │   ├── Most recent session date
│   │   ├── Average attendance rate
│   │   └── Scheduled upcoming sessions (if any)
│   │
│   └── Session Timeline
│       └── Chronological visualization of participation
│
├── POC Responsibilities
│   ├── Evidence items this POC owns
│   │   ├── Status and due date
│   │   ├── Related requirement/control
│   │   ├── "View" link navigates to Evidence workspace
│   │   └── Count of outstanding items
│   │
│   ├── Testing assignments (if applicable)
│   │   ├── Test procedure title
│   │   ├── Status (Scheduled, In Progress, Completed)
│   │   ├── Related control
│   │   └── "View" link navigates to Testing workspace
│   │
│   └── Other assigned tasks
│       └── Any POC-specific action items
│
├── POC Blockers and Dependencies
│   ├── Unresolved blockers preventing this POC's participation
│   ├── Dependencies (other items this POC is waiting on)
│   └── Resolution status
│
├── POC Availability and Scheduling
│   ├── Timezone (primary working timezone)
│   ├── Availability pattern (if recorded)
│   ├── Preferred meeting times
│   ├── Language preferences
│   └── Last active date
│
├── POC Communication History
│   ├── Comments on POC-specific items
│   ├── Reminder sent status
│   ├── Escalation history (if applicable)
│   └── Recent activity
│
├── POC Recommendations
│   ├── AI suggestions scoped to this POC
│   ├── Status (Suggested, Reviewed, Approved, Applied)
│   └── Action buttons (Review, Approve, Apply as appropriate)
│
└── Supporting Panels
    ├── Related Information (POC history, previous engagements)
    ├── Activity Feed (POC-scoped events)
    └── AI Context (POC-level insights)
```

---

### 67.9 POC Identity Card

Displays the POC's core profile information.

**Information Includes:**

* **Name:** Full readable name
* **Title:** Job title or role within organization
* **Department:** Organizational department
* **Status:** Active, Blocked, Completed, or Absent
* **Timezone:** IANA timezone (e.g., America/New_York) for scheduling coordination
* **Contact:** Email address and phone number (if available)
* **Preferred Communication:** How this POC prefers to be contacted (email, phone, meeting, etc.)
* **Relationship to Engagement:** Is this the main POC, escalation POC, or team member
* **Is Main POC:** Boolean indicating if this POC is the primary contact for the team

---

### 67.10 POC Participation History

Displays all sessions the POC participated in (real participation records only).

**Participation Listing:**

* **Recent Sessions First:** Newest sessions appear at top
* **Per-Session Information:**
  * Session date and time
  * Session title or topic
  * Attendee count
  * Status (Completed, Scheduled, Cancelled)
  * POC's role in session (participant, observer, presenter, etc.)
  * Notes or recording link (if available)

**Participation Summary:**

* Total sessions participated in
* Most recent session date
* Attendance rate (completed sessions / invited sessions)
* Upcoming scheduled sessions this POC is invited to

**Constraints (Release 1):**
* Only displays sessions where the POC's `id` appears in the session's `participants` array
* Does not fabricate attendance records
* Does not infer participation from related evidence or other indirect signals

---

### 67.11 POC Responsibilities

Displays items this POC is directly responsible for.

**Evidence Ownership:**

Lists evidence items this POC is expected to provide:

* Requirement or control the evidence supports
* Evidence status (Not Started, In Progress, Submitted, Under Review, Approved)
* Due date (if defined)
* "View" link navigates to Evidence workspace with the item pre-selected
* Count of outstanding evidence items

**Testing Assignments:**

Lists testing procedures assigned to or owned by this POC:

* Test procedure name or title
* Related control
* Status (Scheduled, In Progress, Completed)
* Expected completion date (if defined)
* "View" link navigates to Testing workspace

**Other Assigned Tasks:**

Any other POC-specific action items or commitments:

* Task description
* Due date
* Priority
* Status

---

### 67.12 POC Blockers and Dependencies

Displays unresolved issues affecting this POC's progress.

**Blockers:**

* Title and description
* Severity (High, Medium, Low)
* Date raised
* Owning team or responsible party
* Expected resolution date
* Impact on POC's deliverables

**Dependencies:**

* Description of what this POC is waiting on
* Owning team or person
* Expected delivery date
* Impact if unresolved

**Resolution Status:**

Whether each blocker or dependency has been resolved or remains outstanding.

---

### 67.13 POC Availability and Scheduling

Displays information relevant to scheduling coordination.

**Timezone:**

IANA timezone (e.g., Asia/Kolkata) for auditors scheduling sessions with this POC.

**Availability:**

* Preferred working hours (if recorded)
* Days available (e.g., Mon–Fri, not weekends)
* Known unavailability periods (vacation, leave, etc.)

**Scheduling History:**

* Last three scheduled sessions
* Response time to scheduling requests
* Scheduling preferences (email vs. calendar invite, advance notice required, etc.)

---

### 67.14 POC Communication History

Displays communication and collaboration history.

**Comments:**

Team members' comments about or directed to this POC:

* Author and date
* Comment text
* Related item (session, evidence, test, etc.)

**Reminder Status:**

* Reminders sent (date and type)
* Response status (responded, not responded, out-of-office)

**Escalation History (if applicable):**

* Date escalation was triggered
* Reason for escalation
* Resolution status
* Escalated to (manager, team lead, etc.)

**Recent Activity:**

Feed of POC-related events (newest first):

* Evidence submitted
* Session completed
* Blocker resolved
* Suggestion raised
* Comment added
* Reminder sent

---

### 67.15 POC Recommendations

Displays AI-generated or human-raised suggestions scoped to this POC.

**Suggestion Card Includes:**

* Type and description
* Severity or priority
* Current status (Suggested, Reviewed, Approved, Applied, Rejected)
* For "Suggested": "Review" button
* For "Reviewed": "Propose Status Change" button
* Apply target (what will change)
* POC impact (what this means for the POC's responsibilities)

**Lifecycle:**

Same progression as other suggestions in AuditOS:

```text
Suggested → Reviewed → Approved → Applied
```

---

### 67.16 Navigation and Deep Linking

**Return to Team:**

A "Back to Team" button or breadcrumb link returns to the Team Workspace.

**Drill-Down Navigation:**

Clicking "View" on evidence, testing, or session items navigates to the respective workspace with the item pre-selected.

**Deep Links:**

POC Workspace can be deep-linked directly: `#/{clientSlug}/{engagementSlug}/walkthroughs/{teamId}/poc/{pocId}`

---

### 67.17 Responsive Behavior

The POC Workspace responds to viewport width changes:

* **Desktop** (> 1024px): Full layout with session timeline and supporting panels
* **Tablet** (640–1024px): Session timeline switches to list view; panels collapse to icons
* **Mobile** (< 640px): Single-column layout; timeline becomes scrollable

---

### 67.18 Accessibility

The POC Workspace maintains:

* Semantic heading hierarchy beneath the framework h1
* ARIA labels on all buttons and interactive elements
* Keyboard navigation through session list, evidence list, and action buttons
* Text-based status conveyed through badges and labels
* Reduced-motion support for animations

---

### 67.19 Constraints and Limitations

* Sessions displayed are those the POC actually participated in (Release 1 does not infer participation)
* POC detail is read-only in Release 1 (editing POC profiles is Release 2)
* Scheduling functionality is Release 2 (Release 1 displays availability only)
* POC skill/expertise mapping is future work (Release 3)

---

### 67.20 Historical Context (Issue #37, Phases 2–3)

Prior to Issue #37:
* POC detail required opening an inspector drawer from the Team list
* No dedicated POC workspace existed
* POC participation required inferring from evidence or session lists

Issue #37 introduced:
* POC Workspace as a specialized operational context
* Hierarchical routing to POC: `#/{clientSlug}/{engagementSlug}/walkthroughs/{teamId}/poc/{pocId}`
* Real session participation only (no fabrication)
* Breadcrumb preservation of hierarchy

---

### 67.21 Summary

The POC Workspace serves as the focused individual-level operational center within a team.

By providing comprehensive information about a single POC's participation, responsibilities, availability, and progress while maintaining hierarchical context, the workspace enables auditors to understand individual contributions to the engagement without losing awareness of team and engagement scope.

The workspace remains intentionally focused (real participation records, no fabrication) and enables deeper engagement with individual POCs while remaining part of the broader hierarchy.

---
