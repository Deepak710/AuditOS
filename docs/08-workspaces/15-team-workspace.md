# PART IX — WORKSPACE SPECIFICATIONS

## Chapter 66 — Team Workspace

---

### 66.1 Purpose

The Team Workspace is the operational command center for managing a single walkthrough team's engagement activities.

It provides team leads and auditors with a unified view of team status, POC roster, operational progress, scheduling, collaboration, and next actions without leaving the specialized operational context.

The Team Workspace is accessed from the Walkthrough Workspace by selecting a team or through deep linking.

---

### 66.2 Objectives

The Team Workspace exists to:

* Provide team-level operational oversight
* Display the team's current operational stage and status
* Surface the POC roster with individual progress and availability
* Present scheduled sessions and upcoming actions
* Expose blockers and dependencies
* Enable team scheduling and communication
* Display team-scoped suggestions and recommendations
* Preserve engagement context while focusing on team activities
* Support team POC drill-down without navigation disruption

---

### 66.3 Intended Users

The Team Workspace is designed for:

* Team Leads — managing team-level activities and coordination
* Senior Auditors — overseeing team progress and engagement
* Engagement Managers — coordinating across multiple teams
* POCs (Points of Contact) — understanding their individual responsibilities and status

---

### 66.4 Architectural Principles

The following principles govern the Team Workspace.

#### Team-Centric

Every capability revolves around the active team within the current engagement.

---

#### Shared State

The workspace consumes the Shared Audit State and engagement context.

---

#### Operational Focus

The workspace answers "What is the current state of this team, and what should we do next?"

---

#### POC Aware

Individual POC status is visible alongside team-level status.

---

#### Progressive Disclosure

Team detail is presented as nested inspector sections; POC detail opens in a shared drawer.

---

#### Role Aware

Information is presented according to the user's responsibilities.

---

### 66.5 Hierarchical Context

The Team Workspace operates within the Walkthrough hierarchy.

```text
Engagement
│
└── Walkthrough
    │
    └── Team (current context)
        │
        ├── POC A (navigable)
        ├── POC B (navigable)
        └── POC C (navigable)
```

The workspace maintains awareness of:
* Active Engagement
* Active Walkthrough (parent context)
* Active Team (primary context)

Breadcrumb: `Home / Client / Engagement / Walkthrough / Team Name`

---

### 66.6 Workspace Responsibilities

The Team Workspace is responsible for:

* presenting team operational status
* displaying team context (role, stage, progress)
* rendering the POC roster
* showing individual POC progress and availability
* displaying scheduled sessions
* surfacing team-level blockers and dependencies
* presenting team-scoped AI recommendations
* enabling navigation into POC detail
* maintaining engagement context awareness

The workspace is intentionally **not** responsible for:

* modifying Business Objects directly
* approving recommendations
* managing individual POC assignments (Release 2)
* generating reports

---

### 66.7 Primary Business Objects

The workspace primarily operates upon:

* Engagement
* Walkthrough
* Team (the focal entity)
* POC (Points of Contact)
* Session
* Suggestion (team-scoped recommendations)
* Activity (team-scoped events)

---

### 66.8 Workspace Layout

The Team Workspace inherits the Workspace Shell and follows this composition:

```text
Header
├── Team context (Client, Engagement, Walkthrough, Team name)
├── Team status and current stage
└── Navigation breadcrumb

Content
├── Team Status Overview
│   ├── Current stage (Preparation, Evidence Collection, Testing, etc.)
│   ├── Completion percentage
│   ├── Main POC and escalation POC
│   └── Next scheduled session
│
├── POC Roster
│   ├── POC card grid
│   │   ├── POC name
│   │   ├── Status indicator
│   │   ├── Assigned tasks/evidence pending
│   │   ├── Participation in upcoming sessions
│   │   └── "View detail" link → opens POC drawer
│   │
│   └── Roster summary (total POCs, active, completed)
│
├── Team Operational Status
│   ├── Status indicators (Preparation, Scheduling, Evidence Collection, Testing)
│   ├── Progress meters for sessions, evidence, testing
│   ├── Last update timestamp
│   └── Team health tone (success, warning, error, info)
│
├── Scheduled Sessions
│   ├── Next session details (date, time, timezone, participants)
│   ├── Session agenda
│   ├── Recording/note links
│   └── Session history (recent sessions with outcomes)
│
├── Team Collaboration
│   ├── Team-scoped comments
│   ├── Blockers (access delays, scheduling conflicts, resource constraints)
│   ├── Dependencies (other teams this team depends on)
│   └── Recent activity
│
├── Team Suggestions
│   ├── AI recommendations scoped to this team
│   ├── Suggestion lifecycle (Suggested → Reviewed → Approved → Applied)
│   ├── "Review" and "Propose Status Change" buttons
│   └── Pending approval count
│
└── Supporting Panels
    ├── Related Information (team history, previous engagements)
    ├── Activity Feed (team-scoped events)
    └── AI Context (team-level insights from AI services)
```

---

### 66.9 Team Status Overview

Displays the team's current operational state.

**Information Includes:**

* **Current Stage:** Where the team is in the engagement lifecycle (Preparation, Evidence Collection, Testing, Reporting, Completed, Blocked)
* **Stage Tone:** Color-coded indicator (success, warning, error, info) reflecting stage health
* **Completion Percentage:** What portion of team's work is complete
* **Main POC:** The primary point of contact (name, status, contact info)
* **Escalation POC:** The secondary contact if the main POC is unavailable
* **Next Scheduled Session:** Date, time, timezone, participant count, "View" link
* **Last Update:** When team information was last modified
* **Reminder Status:** Whether reminders have been sent to participants
* **Escalation Status:** Whether escalation has been triggered (none, escalated, resolved)

---

### 66.10 POC Roster

Displays all individuals on the team with their individual progress and status.

**POC Card Information:**

Each POC is presented as a card showing:

* **Name and Title:** Readable identification
* **Status:** Active, Blocked, Completed, or Absent
* **Participation:** Scheduled for next session (date/time), recently participated (date of last session), or idle
* **Evidence Pending:** Count of evidence items this POC is expected to provide
* **Session History:** Count of completed sessions participated in
* **Timezone:** Local timezone (for scheduling coordination)
* **Preferred Communication:** Email, phone, etc.
* **"View Detail" Button:** Opens POC detail in a shared drawer

**Roster Summary:**

* Total POCs on the team
* Active count
* Completed count
* Blocked count
* Average participation rate

---

### 66.11 Team Operational Status

Displays key progress indicators.

**Progress Meters:**

1. **Sessions:** Completed / Total scheduled
2. **Evidence:** Collected / Expected
3. **Testing:** Completed / Assigned

**Blockers Section:**

Lists unresolved issues preventing progress:

* Title and severity
* Owner and date raised
* Resolution status
* Related items (evidence, sessions, tests)

**Dependencies Section:**

Lists items this team is waiting on:

* Description and priority
* Owning team or person
* Expected resolution date
* Impact if unresolved

---

### 66.12 Scheduled Sessions

Displays past and upcoming team sessions.

**Next Session Card:**

* Date and time (in team's timezone)
* Location or meeting link
* Participants (count and list)
* Agenda items
* Preparation checklist
* Confirmation status

**Session History:**

* Recent sessions (newest first)
* Each session shows: date, status (completed, scheduled), attendees, notes/recording link
* Click expands to show full session detail

---

### 66.13 Team Suggestions Workflow (Issue #37, Phase 6)

Displays AI-generated or human-raised suggestions scoped to this team.

**Suggestion Card Includes:**

* Type (AI recommendation, process improvement, scheduling conflict, etc.)
* Severity/priority
* Description and impact
* Current status badge (Suggested, Reviewed, Approved, Applied, Rejected)
* For "Suggested" status: "Review" button → opens suggestion review drawer
* For "Reviewed" status: "Propose Status Change" button → lifecycle workflow
* Apply target (if approved): what will change when applied
* Recent activity on the suggestion

**Lifecycle Visualization:**

```text
Suggested
   ↓
Reviewed
   ↓
Approved
   ↓
Applied
```

Only one-directional progression shown (no backward steps in UI; rejection is terminal).

---

### 66.14 POC Detail Drawer

When user clicks "View Detail" on a POC card, a shared enterprise drawer opens.

**Drawer Content (Issue #37, Phase 5):**

The drawer displays the POC's full profile within the team context:

* **Identity:** Name, title, department, timezone
* **Contact:** Email, phone, preferred communication
* **Participation:** Sessions participated in (real session records only; no fabricated count)
* **Availability:** Schedule, next scheduled session, past session history
* **Assigned Tasks:** Evidence items this POC owns, testing procedures, actions
* **Status History:** Lifecycle through Preparation → Active → Completed
* **Comments and Notes:** Team-scoped remarks about this POC
* **Related Information:** Previous engagements with this person, industry knowledge

**Drawer Interaction:**

* Opens with slide-in animation from right side
* Closes with Escape key or close button
* Drawer remains open if user navigates within same engagement (survives route changes within Team context)
* Drawer closes when user navigates away from the Team workspace

---

### 66.15 Collaboration Features

The Team Workspace enables asynchronous and synchronous collaboration.

**Comments:**

Team members can comment on team-level items (sessions, blockers, suggestions).

**Mentions:**

Users can mention other team members or auditors using @-notation.

**Activity Feed:**

Displays all team-related changes: session scheduled, evidence received, suggestion raised, blocker resolved, etc.

---

### 66.16 Module Registry

The Team Workspace is module-driven (similar to Client Workspace and Engagement Workspace).

Modules declare:

```javascript
{
  id: 'team-status',
  region: 'content',
  enabled: true,
  collapsedByDefault: false,
  kicker: 'Team operational state',
  title: 'Status overview',
  render: function() { ... }
}
```

This allows future releases to reorder, hide, or customize team-level displays without code changes.

---

### 66.17 Responsive Behavior

The Team Workspace responds to viewport width changes:

* **Desktop** (> 1024px): Full layout with POC roster grid, session detail, and supporting panels
* **Tablet** (640–1024px): POC roster switches to vertical list; supporting panels collapse
* **Mobile** (< 640px): Single-column layout; drawers appear full-width or as slides

---

### 66.18 Accessibility

The Team Workspace maintains:

* Semantic heading hierarchy beneath the framework h1
* ARIA labels on all regions, cards, and buttons
* Keyboard navigation through POC roster, session history, and action buttons
* Text-based status conveyed through badges and labels, never color alone
* Reduced-motion support for drawer animations

---

### 66.19 Constraints and Limitations

* POC detail shows only real session participation (no fabricated attendance records)
* Session history is read-only in Release 1 (scheduling changes are Release 2)
* Team Roster and POC assignments are company-level; per-team customization is Release 2
* Suggestion approval workflow reflects Suggestion Service; changes to workflow require Suggestion Service updates

---

### 66.20 Historical Context (Issue #37, Phases 2–3)

Prior to Issue #37:
* Walkthroughs were a flat list in the Engagement Workspace
* No Team-level operational center existed
* POC detail required navigation away from walkthrough context

Issue #37 introduced:
* Hierarchical Walkthrough → Team → POC routing
* Team Workspace as a specialized operational hub
* POC detail accessible without losing team context (via shared drawer)
* Team-scoped suggestions and activity feeds
* POC Workspace for deep individual operational focus

---

### 66.21 Summary

The Team Workspace serves as the operational command center for individual teams within a walkthrough.

By providing team-level operational overview, POC roster with individual progress, collaborative features, and AI recommendations while maintaining engagement and walkthrough context, the workspace enables team leads to manage day-to-day team activities without disrupting the hierarchical navigation model.

The workspace remains modular and extensible, supporting future enhancements such as real-time scheduling, advanced team analytics, and cross-team dependency visualization.

---
