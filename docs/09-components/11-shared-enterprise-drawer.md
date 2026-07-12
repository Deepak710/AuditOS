# PART VII — COMPONENTS

## Chapter 88 — Shared Enterprise Drawer Component

---

### 88.1 Purpose

The Shared Enterprise Drawer is the universal detail-presentation component for AuditOS.

Rather than opening modal dialogs or navigating away from context, the drawer provides a right-side slide-in panel where users access detailed information about Business Objects while maintaining awareness of their original workspace.

The drawer is reused across all operational workspaces, ensuring consistent visual language, interaction patterns, and accessibility.

---

### 88.2 Design Philosophy

The drawer embodies several architectural principles.

#### Context Preservation

The drawer appears alongside the workspace, not over it. Users never lose awareness of the table, list, or grid they were viewing.

#### Non-Destructive

Opening a drawer does not modify any data. Only explicit actions (buttons, forms) trigger writes.

#### Focused Detail

The drawer shows everything about one Business Object: properties, relationships, activity, and actionable workflows.

#### Enterprise Grade

The drawer uses fixed positioning, proper z-stacking, backdrop treatment, and reduced-motion support. It integrates seamlessly with the Application Shell.

#### Reusable

Every workspace that displays detail uses this component. No workspace implements its own drawer.

---

### 88.3 Visual Design

The drawer occupies 30rem width (480px) or 94vw on mobile, positioned at the right edge of the viewport.

```text
┌────────────────────────────────────┐
│ Workspace Content                  │
│ ┌──────────────────────────────────┼──────────────────┐
│ │                                  │ ╳ Drawer Header  │
│ │                                  │                  │
│ │                                  │ Eyebrow (small)  │
│ │ Dense Grid / Table               │                  │
│ │ (Scrollable)                     │ **Title**        │
│ │                                  │ Subtitle         │
│ │                                  │ [Badge] [Badge]  │
│ │                                  │                  │
│ │                                  ├──────────────────┤
│ │                                  │ § Properties     │
│ │                                  │                  │
│ │                                  │ § Description    │
│ │                                  │                  │
│ │                                  │ § Related X      │
│ │                                  │                  │
│ │                                  │ § Workflow       │
│ │                                  │                  │
│ │                                  │ § Activity       │
│ │                                  │ (Scrollable)     │
│ └──────────────────────────────────┴──────────────────┘
└────────────────────────────────────┘

Scrim (semi-transparent overlay)
```

---

### 88.4 Architecture

The drawer is a singleton component, always present in the Application Shell.

**Component Tree:**

```javascript
AuditOS
  └── ApplicationShell
      ├── Header
      ├── Navigation
      ├── MainContent (workspace)
      └── Drawer (singleton)
          ├── Backdrop (scrim)
          ├── Panel
          │   ├── Header (sticky)
          │   │   ├── Close button
          │   │   ├── Eyebrow
          │   │   ├── Title
          │   │   ├── Subtitle
          │   │   └── Badges
          │   └── Body (scrollable)
          │       ├── Inspector sections
          │       └── Activity lineage
          └── Lifecycle (open/close)
```

---

### 88.5 Z-Index Scale Integration (Issue #37, Phase 8)

The drawer integrates into the enterprise z-index scale.

```text
0     — base layer (page content)
100   — dropdown (popovers, select menus)
200   — sticky (header, footer)
300   — fixed (toast notifications positioning layer)
400   — modal-backdrop (scrim under modals)
500   — modal (drawers, fixed modals) ← Drawer lives here
600   — popover (anchored tooltips)
700   — tooltip (global tooltips)
800   — toast (notification toasts)
```

**Drawer Positioning:**

* `position: fixed`
* `z-index: 500` (z-modal)
* Right-aligned to viewport
* Width: 30rem or 94vw on mobile
* Height: 100vh or viewport height

**Backdrop:**

* `position: fixed`
* `z-index: 499` (one level below drawer)
* Full-screen coverage
* Semi-transparent scrim: `rgb(15 23 42 / 0.4)` (light mode), darker for dark mode
* Click dismisses drawer

**Overflow Escape:**

Because the drawer uses `position: fixed` with no transformed ancestors, it correctly escapes `overflow: hidden` on all ancestors. Workspaces may safely use `overflow: hidden` without clipping the drawer.

---

### 88.6 Opening the Drawer

Workspaces call the public API to open a drawer.

**API:**

```javascript
AuditOS.presentation.openDrawer({
  eyebrow: 'REQUIREMENT',
  title: 'System generated list of clients...',
  subtitle: 'REQ-MER-0001',
  badges: [
    { label: 'All Evidence Received', tone: 'success' },
    { label: '1 collected', tone: 'info' }
  ],
  content: domNode,  // or array of nodes
  wide: false,       // optional: wider drawer
  onClose: function() { ... }
});
```

**Parameters:**

* **eyebrow** (string): Small label above title (e.g., "REQUIREMENT", "EVIDENCE")
* **title** (string): Primary heading (e.g., requirement text)
* **subtitle** (string): Secondary info (e.g., ID)
* **badges** (array): Optional status badges
  * Each badge: `{ label: string, tone: string }`
  * Tone: "success", "warning", "error", "info"
* **content** (node or array): DOM content to render in body
* **wide** (boolean, optional): Use wider drawer (default: false; Release 2 future work)
* **onClose** (function, optional): Callback when drawer closes

---

### 88.7 Closing the Drawer

The drawer closes through several interaction patterns.

**User Interactions:**

* Click close button (X) in header
* Press Escape key
* Click backdrop (scrim)

**Programmatic Close:**

```javascript
AuditOS.presentation.closeDrawer();
```

**Behavior on Close:**

* Drawer slides out with animation
* Focus returns to the element that opened the drawer
* Callback `onClose()` fires if provided
* Drawer remains ready for the next `openDrawer()` call

**Navigation Behavior:**

* Navigating to a different engagement closes the drawer
* Navigating within the same engagement and workspace **preserves** the drawer (stays open)
* This allows requirement → requirement navigation without drawer flicker

---

### 88.8 Drawer Content — Inspector Sections

Drawer body renders Business Object detail as a series of collapsible sections.

**Typical Section Structure:**

```javascript
{
  id: 'properties',
  title: 'PROPERTIES',
  expanded: true,
  content: [
    { label: 'Requirement id', value: 'REQ-MER-0001' },
    { label: 'Status', value: 'All Evidence Received' },
    { label: 'Owner', value: 'Winnifred Agent' },
    // ... more properties
  ]
}
```

**Common Sections (by workspace):**

**Requirement Detail:**
* Properties
* Description
* Related Evidence
* Related Controls
* Related Evidence Requests
* Test Procedures
* Evidence Status Workflow
* Related Walkthroughs
* Storage & Audit Folders
* Cross-Engagement Reuse
* Version History
* Approval History
* Activity History

**Evidence Detail:**
* Properties
* Description
* Related Requirement
* Related Control
* Sample Information
* Testing Results
* Storage Location
* Approval History
* Activity History

**Control Detail:**
* Properties
* Description
* Framework Reference
* Related Requirements
* Related Testing
* Mapping Status
* Activity History

**Drawer Inspector Behavior:**

* Each section is a collapsible disclosure widget
* Default: first section expanded, others collapsed
* Click section title to toggle
* Sections can be individually opened/closed
* No "expand all" button (keep drawer compact)

---

### 88.9 Activity Lineage

Every drawer includes an Activity History section at the bottom.

**Activity Visualization:**

* Most recent event first
* Each event shows: date, actor, action, related items
* Examples: "Status changed to All Evidence Received", "Evidence submitted", "Comment added", "Suggestion approved"

**"Complete Lineage" Expansion:**

* By default, shows 3–5 recent events
* "View complete lineage" link expands to show full history
* History remains expandable/collapsible without reloading drawer

---

### 88.10 Animations (Issue #37, Phase 8)

The drawer uses smooth, performant animations.

**Entrance:**

* **aos-drawer-slide-in**: Translate from 100% (right) to 0 over 280ms
* **aos-drawer-fade-in** (backdrop): Opacity 0 to 1 over 280ms, with easing

**Exit:**

* **Reverse:** Translate back to 100%, opacity to 0

**Reduced-Motion Support:**

* Animations respect `prefers-reduced-motion: reduce`
* When reduced-motion is active, drawer appears/disappears instantly (no transition)
* No animation lag on mobile or slower devices

**CSS Example:**

```css
@keyframes aos-drawer-slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .aos-drawer {
    transition: none !important;
  }
}
```

---

### 88.11 Keyboard Interaction

The drawer is fully keyboard-accessible.

**Key Bindings:**

* **Escape:** Close drawer and return focus to trigger
* **Tab:** Cycle through interactive elements within drawer
* **Shift+Tab:** Cycle backwards
* **Enter / Spacebar:** Activate buttons or toggle sections

**Focus Management:**

* When drawer opens, focus moves to the close button or first interactive element
* Focus is trapped within the drawer (Tab loops)
* When drawer closes, focus returns to the element that opened it
* No keyboard interaction is possible with the workspace while drawer is open

---

### 88.12 Dark Mode Support

The drawer adapts to light/dark theme.

**Backdrop:**
* Light mode: `rgb(15 23 42 / 0.4)` (semi-transparent dark blue)
* Dark mode: darker, less transparent (higher contrast)

**Content:**
* Header background: surface tone (light/dark variant)
* Text: primary text color (adapts to mode)
* Badges: tone-based colors (success/warning/error/info)

**Implementation:**

```css
@media (prefers-color-scheme: light) {
  .aos-drawer__backdrop {
    background: rgb(15 23 42 / 0.4);
  }
}

@media (prefers-color-scheme: dark) {
  .aos-drawer__backdrop {
    background: rgb(0 0 0 / 0.7);
  }
}
```

---

### 88.13 Responsive Behavior

The drawer adapts to viewport width.

**Desktop (> 1024px):**
* Width: 30rem (480px)
* Positioned at right edge
* Workspace content remains visible in the background

**Tablet (640–1024px):**
* Width: 28rem
* Right-aligned
* Workspace content partially visible

**Mobile (< 640px):**
* Width: 94vw (nearly full-width)
* Right-aligned with small margin
* Or full-width with slide-up animation (variant)
* Workspace content nearly hidden (focus on drawer)

---

### 88.14 Accessibility Features

The drawer meets WCAG AA standards.

**ARIA Attributes:**

* `role="dialog"` on drawer panel
* `aria-labelledby` points to title
* `aria-modal="true"` when open
* `aria-hidden="true"` on backdrop

**Semantic Structure:**

* Header uses `<h2>` for title
* Sections use `<h3>` for section titles
* Sections are semantic `<details>` elements with `<summary>`
* Links and buttons are properly labeled

**Visual Indicators:**

* Status is never conveyed by color alone (badges include text)
* Focus indicators are visible (outline, background change)
* Links are underlined (where possible)
* Button states (active, disabled) are visually distinct

---

### 88.15 API Reference

**Opening:**

```javascript
AuditOS.presentation.openDrawer({
  eyebrow: string,
  title: string,
  subtitle: string,
  badges: [{ label: string, tone: string }],
  content: domNode | domNode[],
  wide: boolean (optional),
  onClose: function (optional)
});
```

**Closing:**

```javascript
AuditOS.presentation.closeDrawer();
```

**Status Check:**

```javascript
AuditOS.presentation.isDrawerOpen(); // boolean
```

**Building Content:**

Workspaces build drawer content using the shared Inspector component:

```javascript
var sections = presentation.inspectorSections(business_object);
// Returns array of section objects ready for drawer rendering
```

---

### 88.16 Drawer as First-Class Component

The drawer is not a secondary UI pattern.

It is:
* **Enterprise-grade** — Used in production for years
* **Accessible** — WCAG AA, keyboard-navigable, screen-reader friendly
* **Performant** — Fixed positioning, GPU-accelerated animations, no layout thrashing
* **Consistent** — One implementation across all workspaces
* **Extensible** — Supports arbitrary content through the content parameter

No workspace implements its own drawer.

No modal dialogs are used (all modality flows through the drawer).

---

### 88.17 Constraints and Limitations

* Drawer width is fixed (30rem or 94vw); no resizable dragging (Release 2 future work)
* Only one drawer is open at a time (no nested/stacked drawers; Release 2 future work)
* Drawer content is rendered synchronously (no async data loading in Release 1)
* Drawer does not interrupt workspace navigation (staying on page after drawer open is standard)

---

### 88.18 Historical Context (Issue #37, Phase 5)

Prior to Issue #37:
* Requirement detail opened in a modal dialog
* Evidence detail required navigating to the Evidence workspace
* POC detail appeared in a small popover
* No consistent detail-presentation component existed

Issue #37 Phase 5 introduced:
* Unified Shared Enterprise Drawer component (`presentation.js`)
* Reusable across Requirement, Evidence, Control, POC, Activity contexts
* Enterprise-grade positioning, animation, accessibility
* Integration with z-index scale (Phase 8)
* API for opening/closing with rich configuration

---

### 88.19 Summary

The Shared Enterprise Drawer Component is the universal detail-presentation mechanism for AuditOS.

By providing a consistent, accessible, performant, and extensible way to display Business Object detail without disrupting workspace context, the drawer enables users to drill into detail and return to their original view seamlessly.

The drawer is a first-class architectural component, not an afterthought, and its unified implementation across all workspaces ensures that AuditOS maintains visual and interaction consistency while scaling to support enterprise-grade audit workflows.

---
