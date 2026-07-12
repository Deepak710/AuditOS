# PART IX — WORKSPACE SPECIFICATIONS

## Chapter 65 — Hierarchical Routing and Context Resolution

---

### 65.1 Purpose

Hierarchical routing establishes how users navigate through nested operational contexts within AuditOS.

The routing model ensures that:

* Users can navigate directly to any operational context
* Context is preserved across workspace boundaries
* Breadcrumbs accurately reflect the hierarchy
* Deep linking remains stable and shareable
* Navigation is predictable and queryable

---

### 65.2 The Engagement Hierarchy

AuditOS organizes all work around a canonical hierarchy.

```text
Platform
│
├── Organization
│
├── Client
│   │
│   └── Engagement
│       │
│       └── Walkthrough (optional)
│           │
│           ├── Team
│           │   │
│           │   └── POC
│           │
│           └── [Engagement-scoped Walkthroughs]
│
├── Workspace (requires context)
│
└── Entity (requires workspace context)
```

Every operational context exists within exactly one parent context.

No context is ambiguous.

---

### 65.3 Routing Format (Issue #34)

Hierarchical routes follow this format:

```text
#/{clientSlug}/{engagementSlug}/{workspacePath}
```

**clientSlug**: Derived from the client organization name (lowercase, hyphenated).

**engagementSlug**: Derived from the engagement name (lowercase, hyphenated).

**workspacePath**: The workspace identifier plus optional record/sub-context identifiers.

#### Examples

**Client Workspace:**
```
#/meridian/mer-zpqp-soc2-2025
```

**Engagement Workspace:**
```
#/meridian/mer-zpqp-soc2-2025/engagement
```

**Requirements Workspace:**
```
#/meridian/mer-zpqp-soc2-2025/requirements
```

**Walkthrough Workspace:**
```
#/meridian/mer-zpqp-soc2-2025/walkthroughs
```

**Team (within Walkthrough):**
```
#/meridian/mer-zpqp-soc2-2025/walkthroughs/team-alpha
```

**POC (within Team):**
```
#/meridian/mer-zpqp-soc2-2025/walkthroughs/team-alpha/poc-1
```

Note: No literal "client/" or "engagement/" segments appear in the route. Context is resolved through Repository lookups, not URL parsing.

---

### 65.4 Context Resolution Helper (Issue #37, Phase 0)

The Shared Engagement Resolution Helper (`resolveContextEngagement`) consolidates the logic for extracting engagement context from hierarchical routes.

**Responsibility:** Given a route context, resolve the canonical engagement object.

**Usage Pattern:**
```javascript
var engagement = resolveContextEngagement(engagements, routeContext);
if (!engagement) {
  // Route refers to a non-existent or inaccessible engagement
  router.navigate('#/home');
}
```

**Internals:**
- Reads the route context (`routeContext.clientId`, `routeContext.engagementId`, or derived from slug)
- Joins against the `engagements` collection
- Returns the resolved engagement object or null

**Benefit:** All workspaces use the same resolution logic. Changes to routing are isolated to one location.

---

### 65.5 Breadcrumb Navigation

The Application Shell renders a breadcrumb that reflects the current context hierarchy.

**Typical Breadcrumb Structure:**

```text
Home / Meridian / Engagement: Zephyr Platform & Quanta Portfolio SOC 2 Type II / Requirements & Evidence
```

The breadcrumb:
* Remains visible in the shell header
* Shows the client name (readable, not slug)
* Shows the engagement name (readable, not slug)
* Shows the current workspace
* Each segment is clickable and navigates up the hierarchy
* Workspace-local state (filters, selections) does not survive breadcrumb navigation

---

### 65.6 Deep Linking and Bookmarking

Every operational context has a stable, bookmarkable deep link.

**Stability:** Route slugs are derived from the record's own immutable name fields. Renaming an engagement changes its slug, breaking historical bookmarks. This is acceptable — bookmarks remain valid only as long as organizational names remain stable.

**Shareability:** Routes can be copied from the address bar and shared. Recipients navigate directly to the same context.

**Browser Integration:** Standard browser back/forward buttons work correctly. Route changes do not clear workspace state; state is only cleared on explicit navigation away or on route change that changes the engagement context.

---

### 65.7 Client-to-Engagement Resolution

When a user selects a client from the landing page or other client-picker interface:

1. The router resolves the client to a company record
2. Retrieves all accessible engagements for that company
3. Selects the most recently active engagement (or the first operational one)
4. Routes to that engagement's Client Workspace: `#/{clientSlug}/{engagementSlug}`

The user arrives at the Client Workspace with the engagement context already established.

---

### 65.8 Engagement-to-Workspace Navigation

From the Client Workspace, users navigate to specialized workspaces (Requirements, Evidence, Testing, etc.).

Route format: `#/{clientSlug}/{engagementSlug}/{workspaceId}`

The router:
1. Resolves the client and engagement from slugs
2. Verifies the user has access to the engagement
3. Initializes the workspace with the engagement context pre-loaded
4. Renders the workspace with no additional loading step

---

### 65.9 Walkthrough Hierarchy (Issue #37, Phase 2–3)

Walkthroughs introduce a nested context below engagements.

From the Engagement Workspace, users may navigate into a Walkthrough to access specialized operational sub-contexts: Teams and POCs.

**Route Structure:**
```
#/{clientSlug}/{engagementSlug}/walkthroughs/{walkthroughId}
```

**Team Route:**
```
#/{clientSlug}/{engagementSlug}/walkthroughs/{teamId}
```

**POC Route:**
```
#/{clientSlug}/{engagementSlug}/walkthroughs/{teamId}/poc/{pocId}
```

The Walkthrough Workspace acts as a navigation hub, presenting:
* The list of Teams
* For each Team: the Team's operational status, POC roster, progress
* Navigation into Team or POC detail

---

### 65.10 Workspace-Local Context

Some workspaces maintain their own internal context (e.g., a selected requirement, an expanded evidence record).

This context:
* Does not appear in the route (routes are shareable and stable)
* Is preserved when the user navigates away and returns to the same engagement + workspace
* Is cleared when the user navigates to a different engagement or workspace

Workspace-local context is stored in presentation state, never serialized to the route.

---

### 65.11 Accessibility and Keyboard Navigation

* All route navigation is accessible via keyboard (Enter, spacebar, Tab)
* Breadcrumb navigation is keyboard-accessible
* Deep links can be opened in new tabs without losing context
* A `<skip-to-content>` link allows keyboard users to bypass the header and navigate

---

### 65.12 Constraints and Limitations

* Routes assume a single active engagement per session. Multi-engagement sessions are Release 2 future work.
* Slugs are immutable during an engagement's lifetime. Renaming an engagement generates a new slug; the old route becomes broken.
* Routes resolve engagement context synchronously after the Shared Audit State loads. During loading, route navigation is deferred.
* Nested Walkthrough routes require that the Walkthrough exists. Referencing a non-existent Walkthrough navigates to the Engagement instead.

---

### 65.13 Historical Context

Prior to Issue #34 ("Platform Foundation II with Repository Layer, Audit Service, Hierarchical Routing"):
* Routes were flat: `#/workspace?id=recordId`
* Engagement context was implicit or embedded in query parameters
* Breadcrumbs could not reflect the hierarchy

Issue #34 introduced:
* Hierarchical route format: `#/{clientSlug}/{engagementSlug}/{workspacePath}`
* Repository-backed slug derivation
* Canonical breadcrumb rendering reflecting the actual hierarchy

Issue #37 (Engagement UX Improvements) extended this with:
* Shared engagement resolution helper to consolidate the resolution logic across all workspaces
* Phase 2–3: Walkthrough hierarchy (Team/POC nested routes)

---

### 65.14 Summary

Hierarchical routing ensures that every operational context within AuditOS is:

* **Addressable:** Stable, deep-linkable, shareable
* **Navigable:** Breadcrumbs reflect the hierarchy; users always know where they are
* **Consistent:** All workspaces resolve context identically through a shared helper
* **Resilient:** Broken routes gracefully degrade (missing engagement → home)

Navigation becomes a first-class architectural concern rather than an implementation detail.

---
