# AuditOS Data Architecture Guide

## Purpose

This document explains the canonical Release 1 data model. Zoo must
treat these JSON files as the single source of truth for the prototype.

## Principles

-   Release 1 is **100% static**.
-   Never hardcode business data in HTML.
-   All UI reads JSON.
-   Every page is driven by reusable components.
-   Every object links to other objects using IDs.

## Dataset Order

    companies
     └─ engagements
         ├─ business-units
         ├─ teams
         ├─ pocs
         ├─ controls
         │   └─ control-library
         │       └─ framework-mappings
         ├─ requirements
         ├─ evidence-requests
         ├─ evidence
         ├─ samples
         ├─ testing
         ├─ findings
         └─ reports

## Responsibilities

### companies

Client profile, branding, locations.

### engagements

Audit period, framework, status.

### business-units

Business ownership.

### teams

Operational teams.

### pocs

Evidence providers and reviewers.

### control-library

Reusable master controls.

### framework-mappings

Maps master controls to SOC2 and ISO27001.

### controls

Engagement-specific controls.

### requirements

Evidence requirements shared across controls.

### evidence-requests

Operational request tracker.

### evidence

Uploaded artifacts. One evidence item may satisfy many requirements and
controls.

### samples

Sample selections generated from evidence.

### testing

Individual audit tests performed on samples.

### findings

Exceptions produced by failed tests.

### reports

Structured report definitions. Reports reference objects instead of
duplicating data.

### soa

ISO Statement of Applicability (future workspace).

## UI Rule

Everything shown on screen comes from these JSON files. No duplicated
state.
