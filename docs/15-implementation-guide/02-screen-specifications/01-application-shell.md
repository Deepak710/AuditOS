# PART XVI — IMPLEMENTATION GUIDE

## Chapter 114 — Application Shell

---

### 114.1 Purpose

The Application Shell defines the permanent user interface framework of AuditOS.

Every workspace, dashboard, dialog, and page is rendered inside this shell.

Rather than acting as a visual template, the Application Shell provides the structural foundation that delivers consistency, discoverability, responsiveness, accessibility, and enterprise-grade usability throughout the platform.

The shell is never duplicated.

It is implemented once and reused everywhere.

---

### 114.2 Objectives

The Application Shell exists to:

* establish a consistent application layout
* minimize user orientation time
* reduce navigation complexity
* provide persistent contextual awareness
* host shared platform services
* provide global navigation
* expose Artificial Intelligence throughout the platform
* support responsive layouts
* enable keyboard-first workflows
* preserve accessibility

---

### 114.3 Architectural Relationship

The Application Shell extends:

* UX Architecture
* Workspace Architecture
* Component Library
* Design System
* Shared Audit State
* AI Operating System

Every workspace inherits the shell.

No workspace may redefine it.

---

### 114.4 Shell Architecture

The shell consists of the following permanent regions.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header                                                                      │
├──────────────┬──────────────────────────────────────────────┬───────────────┤
│              │                                              │               │
│ Sidebar      │ Workspace                                    │ AI Copilot    │
│ Navigation   │ Content Area                                 │ Panel         │
│              │                                              │               │
├──────────────┴──────────────────────────────────────────────┴───────────────┤
│ Footer / Status Bar                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

The layout remains consistent across the entire application.

---

### 114.5 Global Header

The Global Header remains visible on every page.

It contains:

* AuditOS logo
* current engagement selector
* global search
* command palette launcher
* notifications
* quick actions
* AI status indicator
* synchronization status
* user profile
* organization switcher
* theme selector
* settings shortcut

The header should remain compact and fixed.

---

### 114.6 Navigation Sidebar

The sidebar provides primary navigation.

Sections include:

* Dashboard
* Engagements
* Walkthroughs
* Controls
* Evidence
* Testing
* Findings
* Reporting
* Governance
* AI Workspace
* Executive Dashboard
* Administration
* Settings

The sidebar should support:

* collapse
* expand
* icon mode
* favorites
* recently visited pages
* keyboard navigation
* contextual highlighting
* badges
* nested menus

GitHub Issue #16 removed the persistent Navigation Sidebar region entirely; primary navigation is realized instead as breadcrumb navigation integrated into the Global Header (Section 114.13, Section 114.26, Section 114.28).

---

### 114.7 Workspace Container

The Workspace Container hosts the active page.

Responsibilities include:

* page rendering
* breadcrumbs
* page title
* toolbar
* workspace actions
* filters
* page tabs
* contextual help

The Workspace Container never owns business logic.

---

### 114.8 AI Copilot Panel

The AI Copilot Panel is permanently available.

Capabilities include:

* contextual recommendations
* workflow guidance
* summaries
* explanations
* confidence indicators
* approval requests
* recommendation history
* reasoning
* citations
* conversation history

The panel should support:

* collapse
* resize
* docking
* floating mode
* full-screen mode

AI never blocks user workflows.

---

### 114.9 Footer and Status Bar

The footer provides operational awareness.

Illustrative information includes:

* synchronization status
* environment
* version
* organization
* connected providers
* current user
* accessibility status
* keyboard shortcut hint
* page performance
* support links

The footer should remain visually lightweight.

---

### 114.10 Global Search

Global Search is available from every page.

Capabilities include:

* Business Object search
* document search
* evidence search
* control search
* framework search
* AI recommendation search
* user search
* command search

Search should support fuzzy matching, recent searches, keyboard navigation, and quick previews.

---

### 114.11 Command Palette

The Command Palette provides keyboard-first navigation.

Illustrative actions include:

* open workspace
* create engagement
* upload evidence
* create finding
* run AI recommendation
* approve recommendation
* navigate to object
* switch organization
* change theme
* open settings

Default shortcut:

```text
Ctrl + K
```

Every command should be searchable.

---

### 114.12 Global Notifications

Notifications should support:

* unread indicators
* categorization
* filtering
* bulk actions
* marking as read
* pinning
* deep linking
* severity indicators

Notification categories include:

* workflow
* AI
* governance
* security
* integrations
* system
* reminders

---

### 114.13 Breadcrumb Navigation

Breadcrumbs provide contextual awareness.

Example:

```text
Dashboard

↓

Engagement

↓

Controls

↓

Control C-105
```

Breadcrumbs should always reflect the current navigation hierarchy.

Release 1 implements breadcrumb navigation as the primary navigation of the shell, replacing the permanent left Navigation Sidebar described in Section 114.6 and integrated into the Global Header described in Section 114.5. The implemented trail realizes the top-level workspace crumb only (for example "AuditOS Home"); the deeper hierarchy illustrated above remains future scope.

---

### 114.14 Workspace Toolbar

Each workspace contains a standardized toolbar.

Illustrative actions include:

* create
* edit
* duplicate
* export
* import
* refresh
* filter
* sort
* group
* bulk actions
* share
* AI actions

The toolbar adapts to the current workspace.

---

### 114.15 Quick Actions

Quick Actions provide one-click access to frequent tasks.

Illustrative actions include:

* New Engagement
* Upload Evidence
* Create Finding
* Start Walkthrough
* Generate Report
* Open AI Copilot

Quick Actions should be configurable by the user.

---

### 114.16 User Preferences

The shell should remember:

* sidebar state
* theme
* layout density
* favorite workspaces
* preferred dashboard
* language
* notification preferences
* keyboard preferences
* AI panel state
* recently opened pages

Preferences persist across sessions.

---

### 114.17 Responsive Behavior

The Application Shell supports three layouts.

#### Desktop

Three-column layout with persistent sidebar and AI panel.

---

#### Tablet

Collapsible sidebar and collapsible AI panel.

---

#### Mobile

Single-column layout with slide-out navigation and bottom actions where appropriate.

Business workflows remain fully available.

---

### 114.18 Accessibility

The shell should support:

* keyboard navigation
* skip links
* screen readers
* semantic HTML
* ARIA attributes
* visible focus indicators
* high-contrast themes
* scalable typography
* reduced-motion mode

Accessibility is mandatory.

---

### 114.19 Modern Enterprise UX

The shell should provide the following enterprise capabilities.

* collapsible sidebar
* omnibox search
* command palette
* pinned pages
* favorites
* recently viewed
* workspace history
* keyboard shortcuts
* drag-and-drop panels
* resizable panels
* split views
* persistent filters
* saved layouts
* theme switching
* contextual onboarding
* AI assistance
* workspace personalization

These capabilities should feel integrated rather than optional.

---

### 114.20 Animation Guidelines

Animations should be subtle and purposeful.

Illustrative animations include:

* page transitions
* sidebar collapse
* drawer transitions
* modal transitions
* hover feedback
* loading skeletons
* notification appearance
* AI thinking indicators
* success confirmations
* smooth scrolling

Animations should never delay user interaction.

---

### 114.21 Error Handling

The shell should gracefully handle:

* page errors
* network failures
* missing data
* unauthorized access
* expired sessions
* AI service failures
* integration failures

Users should always receive actionable feedback.

---

### 114.22 Empty States

Every workspace should define meaningful empty states.

Each empty state should include:

* explanation
* illustration or icon
* primary action
* secondary guidance
* documentation link where appropriate

Empty states should encourage user progress.

---

### 114.23 Performance Requirements

The Application Shell should prioritize perceived performance.

Illustrative techniques include:

* lazy loading
* skeleton screens
* optimistic UI
* virtual scrolling for large datasets
* deferred rendering
* asset caching
* efficient animations
* responsive interactions

Performance should feel instantaneous.

---

### 114.24 Recommended Open Source UI Capabilities

The static prototype should leverage modern, plug-and-play, open-source capabilities where appropriate.

Illustrative technologies include:

* Bootstrap 5 for responsive layout
* Bootstrap Icons for iconography
* Inter as the primary typeface
* CSS Custom Properties for design tokens
* Chart.js or Apache ECharts for analytics
* Grid.js or Tabulator for advanced tables
* Motion One or CSS animations for lightweight motion
* SortableJS for drag-and-drop interactions
* Floating UI for menus and popovers
* 21st.dev MCP for modern component generation and inspiration

Libraries should be modular, replaceable, and implementation-independent.

---

### 114.25 AI Coding Assistant Guidance

AI coding assistants implementing the Application Shell should:

* build the shell before any workspace
* reuse components exclusively
* preserve responsive behavior
* follow the Design System
* implement accessibility from the beginning
* avoid page-specific customizations
* support future backend integration without structural changes

The shell is the permanent foundation of every AuditOS screen.

---

### 114.26 Shell Layout Implementation

GitHub Issue #16 removed the permanent Navigation Sidebar and the Context Panel region. The Application Shell is now realized as a single CSS Grid layout spanning two persistent structural regions.

```text
┌───────────────────────────────────────────────────────────────┐
│ Header                                                         │
├───────────────────────────────────────────────────────────────┤
│ Workspace Content Area                                          │
└───────────────────────────────────────────────────────────────┘
```

The grid defines two named areas — header and workspace. The Header spans the full width across the top row; the Workspace Content Area fills the remaining height and width beneath it. The Footer and Status Bar described in Section 114.9 do not participate in the grid; per-workspace footers render inside the Workspace Content Area itself (see the Workspace Design System, §15.10).

Primary navigation no longer occupies a persistent region of its own. It is realized as breadcrumb navigation integrated into the Global Header (Section 114.5, Section 114.13, Section 114.28) rather than a separate structural area, so the Workspace Content Area gains the full width the Navigation Sidebar and Context Panel previously reserved.

The Workspace Content Area is fluid at every width. On very wide displays its inner canvas is capped at a shell-scoped max-width and centered, so line lengths stay readable without reintroducing a fixed side gutter; below that width the canvas fills the available space edge to edge. Horizontal padding scales gently with viewport width instead of using a fixed gutter.

The Navigation Sidebar and Context Panel's collapsed/expanded structural states described in earlier drafts of this section no longer apply — both regions were removed rather than made collapsible.

---

### 114.27 Shell Layout Tokens

Following the removal of the Navigation Sidebar and Context Panel (Section 114.26), the shell's grid regions are sized using a small set of shell-scoped layout tokens:

* Header height
* Workspace canvas max-width (the ultrawide centering bound described in Section 114.26)

The Navigation width, Collapsed navigation width, Context panel width, and Collapsed context panel width tokens described in earlier drafts of this section were removed along with the regions they sized.

These tokens are distinct from the Design Token Foundation. The Design Token Foundation (`variables.css`) declares the platform's reusable visual values — color, typography, spacing, radius, shadow, motion, breakpoints, and accessibility tokens — consumed by every workspace and component across AuditOS. Shell layout tokens instead size the shell's own grid regions. They describe shell-specific structural measurements rather than platform-wide visual values, so they are declared alongside the shell's own layout stylesheet rather than within the Design Token Foundation.

`main.css` remains the single stylesheet entry point for the prototype. It imports the Design Token Foundation first, followed by the shell's layout and navigation stylesheets, so that every page loads the same token foundation and shell architecture through one file.

---

### 114.28 Global Header Foundation

The Global Header is realized as a single reusable component, `.aos-global-header`, rendered inside the shell's header region (`.aos-header`) described in Section 114.26.

The component defines four structural regions, arranged as a leading group and a trailing group:

* Brand
* Breadcrumb (replaces the earlier Workspace Title region — see below)
* Global Actions
* User Profile

The Brand and Breadcrumb regions form the leading group. The Global Actions and User Profile regions form the trailing group.

GitHub Issue #16 replaced the Workspace Title region with the Breadcrumb region and populated every region with live content:

* **Brand** renders the AuditOS mark and wordmark as a link back to AuditOS Home.
* **Breadcrumb** hosts the breadcrumb navigation of Section 114.13 and Navigation Components §76.10 — rendered at runtime by `components/navigation/navigation.js`, which also implements the workspace-switcher menu of §76.11.
* **Global Actions** renders the theme toggle and the notification indicator, rendered at runtime by `components/header/header.js`. The notification indicator's badge count is a live read from the Shared Audit State (pending-review and rejected evidence, plus submitted evidence requests) and links to AuditOS Home, where the underlying Signals section lists the same events; it never fabricates a count.
* **User Profile** renders the signed-in user chip (avatar, engagement-lead identifier, and auditor) derived from the current engagement in the Shared Audit State, also rendered by `header.js`.

The theme toggle stamps `data-aos-theme` on the root element to choose light or dark explicitly; the Design Token Foundation's dark-mode block (`variables.css`) resolves system preference by default and this explicit override when present. The preference is memory-only presentation state — it does not persist across a reload, consistent with Release 1 having no persistence layer.

The header's structure is styled by a dedicated stylesheet, `header.css`, imported by `main.css` alongside the shell's layout and navigation stylesheets. Breadcrumb-specific chrome (the trail, the crumb button, and the workspace-switcher menu) is styled by `navigation.css`. Like the rest of the shell, both stylesheets consume only the Design Token Foundation and introduce no new visual values.

In this release, the header and breadcrumb markup are rendered directly within the page rather than through a component loader or template engine. No such loader or build process exists yet in the prototype, so the canonical markup for each is written once (in `components/header/header.html` and `components/navigation/navigation.html` respectively) and kept in sync with what their scripts render into the shell's header region.

On narrow viewports, the Brand wordmark and the User Profile identity text yield horizontal space first, preserving the Breadcrumb, Global Actions, and the User Profile avatar.

---

### 114.29 Relationship to Other Documents

This document should be implemented before:

* Dashboard
* Engagement Workspace
* Walkthrough Workspace
* Controls Workspace
* Evidence Workspace
* Testing Workspace
* Findings Workspace
* Reporting Workspace
* Governance Workspace
* AI Workspace
* Executive Dashboard

All screen specifications inherit this document.

---

### 114.30 Summary

The Application Shell establishes the permanent visual and interaction framework of AuditOS.

By defining a consistent layout, global navigation, AI Copilot panel, command palette, responsive behavior, accessibility requirements, modern enterprise user experience, and reusable shell components, it ensures that every workspace provides a cohesive, intuitive, performant, and professional experience.

This shell serves as the structural backbone of the AuditOS user interface, enabling developers and AI coding assistants to build every subsequent workspace on a shared, reusable, and enterprise-ready foundation while preserving architectural consistency and long-term maintainability.

---
