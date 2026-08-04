# AuditOS Workspace Specification

## Purpose

This document is the implementation contract for every workspace in
AuditOS Release 1. Zoo must implement workspaces exactly as specified.
Every workspace reads from the canonical JSON datasets only.

------------------------------------------------------------------------

# Universal Layout

    ┌────────────────────────────────────────────────────────────┐
    │ Top Navigation                                             │
    ├──────────────┬──────────────────────────────┬──────────────┤
    │ Left Sidebar │ Main Workspace              │ Inspector     │
    │ Navigation   │ Tables / Cards / Timeline   │ Properties    │
    └──────────────┴──────────────────────────────┴──────────────┘

Rules

-   Persistent left navigation.
-   Main workspace never opens modal-heavy workflows.
-   Right inspector updates based on selection.
-   All tables support search, sort and filters.
-   Breadcrumbs always visible.
-   Smooth 150--250 ms transitions.

------------------------------------------------------------------------

# Workspace Catalogue

## Dashboard

**Data:** companies, engagements **Purpose:** Landing page showing
active engagements, workload, pending requests and findings.

## Companies

**Data:** companies.json **Purpose:** Client profile, locations,
certifications and engagements.

## Engagements

**Data:** engagements.json **Purpose:** Audit overview, scope, timeline
and progress.

## Controls

**Data:** control-library.json, framework-mappings.json, controls/\*
**Purpose:** Master controls and engagement controls.

## Requirements

**Data:** requirements/\* **Purpose:** Shared evidence requirements
linked to multiple controls.

## Evidence Requests

**Data:** evidence-requests/\* **Purpose:** Operational tracker for
evidence collection.

## Evidence

**Data:** evidence/\* **Purpose:** Evidence inventory, reuse, versions,
reviewers and relationships.

## Samples

**Data:** samples/\* **Purpose:** Sample populations and selected items.

## Testing

**Data:** testing/\* **Purpose:** Execute audit procedures and capture
results.

## Findings

**Data:** findings/\* **Purpose:** Observations, remediation and
reporting.

## Reports (Document Studio)

**Data:** reports/\* **Purpose:** Structured report editor and document
generation.

SOC 2: - Section 1 -- Management Assertion - Section 2 -- Auditor
Report - Section 3 -- System Description - Section 4 -- Controls,
Testing & Results

ISO 27001: - Executive Summary - Audit Scope - ISMS Description - Audit
Methodology - Annex A Controls - Findings - Statement of Applicability -
Appendices

## Statement of Applicability

**Data:** soa/\* **Purpose:** ISO-only workspace for Annex A
applicability decisions.

------------------------------------------------------------------------

# Cross Navigation

Every object is clickable.

Company → Engagement → Control → Requirement → Evidence Request →
Evidence → Sample → Test → Finding → Report

No duplicated business data.

------------------------------------------------------------------------

# Design Language

Inspired by Linear, GitHub, Stripe, Notion and Vercel.

Implementation: - HTML - CSS - JavaScript - Bootstrap only

No React, Vue, Angular or Node.js.

------------------------------------------------------------------------

# Release 2 Readiness

Every edit must update the underlying object model.

Future AI regenerates dependent objects instead of editing documents
directly.

The UI should already expose relationships so AI can later automate
regeneration without changing the interface.
