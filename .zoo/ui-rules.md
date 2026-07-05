# AuditOS — UI Rules

> **Purpose**
>
> This document defines the mandatory user interface rules for all AI coding assistants implementing AuditOS.
>
> Every screen, component, and interaction must follow these standards.

---

# 1. UI Philosophy

AuditOS should feel:

* enterprise
* modern
* trustworthy
* calm
* intelligent
* information-rich
* responsive
* consistent
* AI-native

The interface should prioritize clarity over decoration.

---

# 2. Primary Goal

Every screen should answer:

* Where am I?
* What am I looking at?
* What can I do next?
* What requires my attention?

Users should never feel lost.

---

# 3. Application Shell

Every page must use:

* Application Header
* Left Navigation Sidebar
* Breadcrumbs
* Workspace Header
* Workspace Toolbar
* Main Content Area
* AI Panel (where applicable)
* Footer

Never create custom page layouts.

---

# 4. Layout Principles

Prefer:

* whitespace
* visual hierarchy
* consistent alignment
* progressive disclosure
* logical grouping

Avoid:

* clutter
* deeply nested layouts
* inconsistent spacing
* unnecessary scrolling

---

# 5. Grid System

Use:

* Bootstrap 12-column grid
* CSS Grid when appropriate
* Flexbox for alignment

Never invent custom layout systems.

---

# 6. Design Tokens

Always consume:

* color tokens
* typography tokens
* spacing tokens
* radius tokens
* elevation tokens
* animation tokens

Never hardcode visual values.

---

# 7. Typography

Primary font:

Inter

Hierarchy:

* Display
* H1
* H2
* H3
* H4
* Body
* Caption
* Label
* Code

Typography should communicate hierarchy.

---

# 8. Color Usage

Use color only to communicate:

* status
* priority
* interaction
* hierarchy
* semantic meaning

Avoid decorative color usage.

Never rely on color alone to convey information.

---

# 9. Cards

Cards should contain:

* title
* optional subtitle
* content
* optional actions
* optional footer

Cards should not become mini pages.

---

# 10. Tables

Enterprise tables should support:

* sorting
* filtering
* searching
* pagination
* column visibility
* responsive behavior

Tables are reusable components.

---

# 11. Forms

Forms should:

* minimize required input
* group related fields
* validate inline
* provide helper text
* display clear error messages

Never overwhelm users with long forms.

---

# 12. Navigation

Navigation should always expose:

* current location
* available actions
* navigation hierarchy

Support:

* breadcrumbs
* sidebar
* command palette
* search

---

# 13. Search

Search should be:

* visible
* fast
* forgiving
* keyboard accessible

Support:

* recent searches
* suggestions
* filtering

---

# 14. Artificial Intelligence

AI should appear as an assistant.

Never present AI output as confirmed business data.

AI components should display:

* confidence
* supporting evidence
* citations
* approval state

Users remain in control.

---

# 15. Dialogs

Dialogs should:

* focus on one task
* be dismissible
* preserve context
* avoid excessive content

Use full-screen dialogs only when necessary.

---

# 16. Drawers

Prefer drawers over dialogs when:

* reviewing details
* editing records
* viewing relationships
* inspecting metadata

Keep users within context.

---

# 17. Notifications

Notification priority:

1. Critical
2. Error
3. Warning
4. Success
5. Information

Avoid excessive notifications.

---

# 18. Empty States

Every empty state should include:

* explanation
* illustration or icon
* primary action
* optional documentation link

Never leave blank pages.

---

# 19. Loading States

Prefer:

* skeleton loaders
* shimmer placeholders
* progressive rendering

Avoid blocking the entire interface with spinners.

---

# 20. Error States

Every error should explain:

* what happened
* why it happened (if known)
* what the user can do next

Errors should always be actionable.

---

# 21. Charts

Charts should:

* prioritize readability
* support drill-down
* resize responsively
* use semantic colors

Avoid unnecessary visual effects.

---

# 22. Dashboards

Dashboards should emphasize:

* KPIs
* trends
* exceptions
* actions
* insights

Dashboards should never resemble reports.

---

# 23. Responsive Design

Desktop is primary.

Adapt for:

* laptop
* tablet
* mobile

Do not remove functionality.

Adapt layouts instead.

---

# 24. Accessibility

Support:

* keyboard navigation
* semantic HTML
* screen readers
* visible focus
* reduced motion
* scalable typography

Accessibility is mandatory.

---

# 25. Motion

Animation should communicate:

* navigation
* loading
* hierarchy
* workflow
* completion

Animation should never distract from work.

---

# 26. Visual Density

The interface should be:

* information dense
* visually calm
* easy to scan

Prefer progressive disclosure over overcrowded screens.

---

# 27. Icons

Primary icon library:

Bootstrap Icons

Icons should:

* reinforce meaning
* remain consistent
* accompany important actions where appropriate

Avoid decorative icon usage.

---

# 28. Open Source UI

Preferred technologies:

* Bootstrap 5
* Bootstrap Icons
* Motion One
* Apache ECharts
* Chart.js
* Grid.js or Tabulator
* TipTap
* Monaco Editor
* Mermaid
* Floating UI
* PDF.js
* SheetJS Community Edition

For inspiration (not direct copying):

* 21st.dev component patterns
* NextLevelBuilder UI concepts

Implementations should match the AuditOS Design System.

---

# 29. AI UI Workflow

Before implementing any screen:

1. Read the relevant workspace specification.
2. Reuse existing components.
3. Preserve the Application Shell.
4. Consume Design System tokens.
5. Verify responsive behavior.
6. Verify accessibility.
7. Validate consistency with existing pages.

Do not invent new interaction patterns without architectural justification.

---

# 30. UI Review Checklist

Before completing any screen, verify:

* Application Shell is preserved.
* Navigation is consistent.
* Components are reused.
* Design tokens are used.
* Layout is responsive.
* Keyboard navigation works.
* Empty states exist.
* Loading states exist.
* Error states exist.
* AI output is clearly identified.
* Visual hierarchy is consistent.
* No page-specific styling duplicates existing patterns.

---

# 31. Ultimate Goal

Every screen should look and behave as though it belongs to a single enterprise platform.

Users should immediately recognize:

* consistent layouts
* consistent interactions
* consistent visual language
* consistent AI behavior
* consistent governance patterns

The interface should feel cohesive, predictable, and production-ready from the first screen to the last.
