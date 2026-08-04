# AuditOS UI Rendering Guide

## Product Vision

AuditOS should feel like an operating system, not a dashboard.

## Inspiration

-   Linear
-   GitHub
-   Notion
-   Stripe
-   Vercel

Use only Bootstrap implementation.

## UX Principles

-   Large whitespace
-   Animated page transitions
-   Glass + subtle elevation
-   Keyboard-first navigation
-   Context preserved between workspaces
-   Split-pane layouts
-   Sticky action bars
-   Command palette
-   Universal search
-   Docked inspectors
-   Right-side properties panel
-   Rich data tables
-   Timeline views
-   Graph relationships
-   Zero modal overload

## Workspaces

Company → Engagement → Controls → Requirements → Requests → Evidence →
Samples → Testing → Findings → Reports

Each workspace contains: - Left navigation - Main content - Right
inspector

## Relationship Navigation

Every object is clickable.

Example:

Finding → Test → Sample → Evidence → Requirement → Control → Report

Never duplicate information.

## Report Studio

Report editor is a structured renderer.

Section 1/2: Rich text editors.

Section 3: Generated from structured company objects.

Section 4: Generated from Controls, Testing and Findings.

Edits update underlying objects, never only rendered text.

## Animation

Use tasteful 150--250ms animations. Never animate data changes
excessively. Prefer fade, slide, expand, skeleton loading.
