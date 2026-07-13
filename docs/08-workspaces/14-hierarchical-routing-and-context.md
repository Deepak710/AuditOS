# PART IX — WORKSPACE SPECIFICATIONS

## Chapter 65 — Navigation & Context Architecture

> **Issue #39 (Navigation & Context Architecture Rewrite) — reflects the shipped implementation.**
> This chapter documents the canonical hierarchical routing model as it is
> actually built in `prototype/`. It supersedes the earlier slug-based routing
> description; legacy routes still resolve, but only as redirects to the
> canonical form.

---

### 65.1 Purpose

Navigation and context are a single architectural concern owned by four
canonical services. No page constructs a URL, derives its own context, calls
the router directly, or implements its own breadcrumb. Every route is built by
one service, every page's context comes from one resolver, the hierarchy is
derived in one place, and the breadcrumb is generated in one place.

The model guarantees:

* Users can deep-link directly to any operational context.
* Context is derived once, from the URL, and read identically everywhere.
* Breadcrumbs always mirror the URL — hierarchy, never categories.
* Legacy deep links keep working (as internal redirects).
* Navigation is predictable, queryable, and centrally testable.

---

### 65.2 The Canonical Hierarchy

AuditOS organizes all work around one permanent hierarchy, built by the
**Hierarchy Builder** (`js/services/hierarchy-builder.js`):

```text
AuditOS → Clients → Programs → Engagements → Workspaces
```

Every breadcrumb, dropdown, and navigation surface derives from this
hierarchy. Entities are read live through the Repository Foundation; nothing
re-derives client/engagement/workspace lists locally. Programs group
engagements but have no route of their own.

Below an engagement, the Walkthrough workspace carries a deeper operational
context: **Team → POC**.

---

### 65.3 The Canonical Route Contract

There is one route contract. Scope is explicit in the URL:

```text
#/home
#/{platformWorkspacePath}[/{recordId}]
#/client/{clientId}
#/client/{clientId}/engagement/{engagementId}
#/client/{clientId}/engagement/{engagementId}/{workspacePath}[/{recordId}[/{pocId}]]
```

* **Platform-scoped** workspaces (Home, Executive, Program, Global Approvals,
  AI Usage, Audit Log, wizards) are flat: `#/{path}`.
* **Client-scoped** routes name the client: `#/client/{clientId}`.
* **Engagement-scoped** workspaces are always hierarchical and carry the full
  `client → engagement → workspace` path.

Identifiers are the entities' own record ids (`CMP-MER`,
`ENG-MER-ZPQP-2025`), not derived slugs — resolution is a Repository lookup by
id, never string parsing of a display name.

#### Examples

```text
#/home
#/client/CMP-MER
#/client/CMP-MER/engagement/ENG-MER-ZPQP-2025
#/client/CMP-MER/engagement/ENG-MER-ZPQP-2025/evidence
#/client/CMP-MER/engagement/ENG-MER-ZPQP-2025/evidence/EVD-MER-0523
#/client/CMP-MER/engagement/ENG-MER-ZPQP-2025/walkthrough/TEAM-MER-005/POC-MER-024
#/approvals
```

---

### 65.4 The Navigation Service

`js/services/navigation-service.js` is the one place a URL is constructed and
the one place a route transition is initiated. It exposes:

* **Pure builders** — `hrefHome()`, `hrefClient(clientId)`,
  `hrefEngagement(clientId, engagementId)`,
  `hrefWorkspace(clientId, engagementId, workspaceId, recordId, pocId)`,
  `hrefPlatform(workspaceId, recordId)`, and `hrefFor(workspaceId, context,
  recordId)` which resolves a workspace's canonical href within a context by
  its declared scope.
* **Imperative navigation** — `navigate(href)` plus intent-named helpers
  (`goHome`, `goClient`, `goEngagement`, `goEvidence`, `goWalkthrough`, …).

Pages call the Navigation Service; they never write `location.hash`. Even the
router's compatibility `navigate(workspaceId, recordId)` shim delegates here.

---

### 65.5 The Context Resolver

`js/services/context-resolver.js` turns a hash into a resolved context. It is
the single entry point `resolve(hash)` and returns one of:

* a **resolved context** — `{ scope, workspaceId, workspace, client, program,
  engagement, frameworks, audit, permissions, hierarchy, recordId, teamId,
  pocId, depth, isKnownRoute }`;
* a **`{ redirect }`** to the canonical equivalent of a legacy route;
* **`{ pending: true }`** while the Shared Audit State is still loading;
* **`null`** for an unknown route.

The router calls `resolve()` and then `setCurrent()` so the resolver mirrors
the active route. Every page reads its context from `contextResolver.current()`
(or the router's `getCurrentContext()`), and no page re-derives it. There is
no "find the first in-progress engagement" fallback anywhere — an
engagement-scoped workspace reached without an engagement in context renders
its degraded state, never a guessed engagement.

**Legacy redirects handled internally (via `history.replaceState`, so history
stays clean):**

| Legacy route | Resolves to |
| --- | --- |
| `#/dashboard` | `#/home` |
| `#/walkthroughs` | `#/walkthrough` |
| `#/requirements` | `#/evidence` (Requirements is removed — see §65.9) |
| `#/{engagementWorkspace}` (flat) | the same workspace under the **last visited** engagement, else Home |
| `#/{workspace}?id={recordId}` | the canonical `…/{workspace}/{recordId}` segment |
| `#/{clientSlug}/{engagementSlug}/…` | the canonical `#/client/{id}/engagement/{id}/…` form |

---

### 65.6 The Breadcrumb Generator

`js/services/breadcrumb-generator.js` produces the ordered crumb descriptors;
the navigation component (`components/navigation/navigation.js`) renders them.
The trail always begins with the **AuditOS** root and adds only the levels the
route carries:

```text
AuditOS
AuditOS → Meridian
AuditOS → Meridian → Zephyr
AuditOS → Meridian → Zephyr → Evidence
```

Crumb rules:

* The **AuditOS** crumb's dropdown lists clients.
* The **client** crumb's dropdown lists ONLY that client's engagements.
* The **engagement** crumb's dropdown lists ONLY that engagement's workspaces.
* The **workspace** crumb is never a dropdown.
* On the Walkthrough route the trail extends with **Team** and **POC** crumbs.

Opening a menu never navigates; only selecting a destination does — menu items
are real anchors. Menus are viewport-aware (repositioned to stay on screen)
and fully keyboard-accessible.

---

### 65.7 The Router

`js/router/router.js` parses nothing. It resolves every hash through the
Context Resolver, follows internal redirects with `replaceState`, hosts the
default workspace while the state is `pending`, activates the resolved
workspace, mirrors the context onto the resolver, and publishes the
`auditos:route-changed` business event (carrying scope, client, engagement,
and record ids). It re-resolves on `hashchange` and on Shared-Audit-State
readiness, so a hierarchical deep link that arrives before the data loads
resolves the moment the data is ready.

---

### 65.8 Deep Linking, History, and Scroll

Every operational context has a stable, bookmarkable deep link built from
record ids, so links survive display-name changes. Browser back/forward work
through the single `hashchange` path. The router remembers scroll position per
workspace and restores it on return, and lands a freshly deep-linked record at
the top.

---

### 65.9 Requirements Is Not a Workspace

Requirements ceased to exist as a user-facing workspace. **Evidence is the
operational object of an engagement.** Requirement records remain an internal
mapping layer (evidence → requirement → control), but there is no Requirements
route, no Requirements navigation entry, and no requirement UI in the drawers.
All Requirements URLs redirect to Evidence.

---

### 65.10 Capability Gating

Workspace visibility is capability-gated in one place: the Hierarchy Builder
filters the engagement's workspace list by the session's capabilities (hidden,
never disabled). The breadcrumb's workspace menu therefore only ever offers
reachable destinations.

---

### 65.11 Accessibility

Route changes move focus into the freshly rendered workspace region and
announce the workspace to assistive technology through a polite live region.
Breadcrumb menus implement the menu-button pattern (roving arrow-key focus,
Home/End, Escape) and every destination is a real anchor, so keyboard and
new-tab navigation work natively.

---

### 65.12 Historical Context

* **Pre-Issue #34:** flat routes `#/workspace?id=recordId`; implicit
  engagement context; breadcrumbs could not reflect hierarchy.
* **Issue #34:** slug-based hierarchical routes
  `#/{clientSlug}/{engagementSlug}/{workspacePath}`.
* **Issue #39 (this chapter):** one canonical id-based route contract behind
  four services (Navigation Service, Context Resolver, Hierarchy Builder,
  Breadcrumb Generator); all earlier route shapes preserved as internal
  redirects; Requirements removed in favor of Evidence.

---

### 65.13 Summary

Navigation is a first-class architecture, not an implementation detail:

* **One URL builder** — the Navigation Service.
* **One context source** — the Context Resolver.
* **One hierarchy** — the Hierarchy Builder.
* **One breadcrumb** — the Breadcrumb Generator.
* **Addressable, navigable, consistent, resilient** — legacy links redirect,
  unknown routes fall back to Home, and pending routes resolve on data
  readiness.

---
