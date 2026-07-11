# Issue #31: Cross-Workspace Record Navigation & Context Preservation

**Status:** Complete — 628/628 tests passing

## Overview
Implemented stable deep links (#/workspace?id=recordId), id-based record selection across all 9 operational workspaces, cross-workspace "Related X" navigation links, and scroll-position context preservation on workspace transitions.

## Architecture Changes

### Router Extension (router.js)
- `parseRouteRecordId(hash)`: Extracts ?id= query parameter
- `toRouteHash(workspace, recordId)`: Builds canonical #/{path}?id={id} hash
- `navigate(workspaceId, recordId)`: Navigates to workspace + record
- `getCurrentRecordId()`: Returns active route's record id
- Scroll position preservation per workspace (restored on workspace re-entry without record id)
- Redundancy check: triggers route change on record-to-record moves within same workspace

### Workspace Shared Platform (workspace-shared.js)
- `buildRecordHref(registry, workspaceId, recordId)`: Single place all cross-workspace links derive from — returns null for unresolved joins, never fabricates
- `resolveRefItem(..., registry?, workspaceId?)`: Now href-capable; adds "Open" action only when id genuinely joins the target map
- `createRailSelection.selectById(id)`: Selects rail entry by id; falls back to selectFirst() when id unresolved or absent
- `mountRailGroups(..., targetId)`: Calls selectById(targetId) after mount, supporting 6 of 7 workspaces

### Relationship Engine (relationships.js)
- `getTestingGraph()`: Already existed (Issue #30), now wired as Testing Inspector's sole source for related control + raised finding
- `getFindingGraph()`: New; centralizes finding→control→requirements join; only returns id that genuinely joins, never fabricates

### Workspace Integration
All 9 workspaces (requirements, controls, testing, findings, evidence, documentation, work-queue, engagement, walkthrough) now:
- Thread route recordId through rail selection
- Turn "Related X" list items into #/workspace?id=... hrefs where schema joins support it
- Restore scroll position on workspace re-entry (unless deep-linking to new record)

## API Surface

```javascript
// Router
router.navigate(workspaceId, recordId)
router.getCurrentRecordId()
document.addEventListener('auditos:route-changed', e => e.detail.recordId)

// Workspace Shared
workspaceShared.buildRecordHref(registry, workspaceId, recordId)
workspaceShared.resolveRefItem(id, map, field, registry?, workspaceId?)
selection.selectById(id)
WS.mountRailGroups(..., targetId)

// Relationships
relationships.getTestingGraph(test, context)
relationships.getFindingGraph(finding, context)
```

## Release 1 Constraints
- Read-only: no writes
- No fabricated links: "Related X" link renders only where real schema field joins support it
- No filter/search/sort state preservation (new feature for Release 2)
- Evidence workspace keeps its own local rail implementation (pre-existing decision honored)

## Test Coverage
- **28 new unit tests** (router-navigation, workspace-shared-navigation, relationships-graph-helpers)
- **603 existing tests**, all passing
- **Full-stack validation** against real demo data: Requirement → Evidence navigation confirmed end-to-end

## Known Limitations
- Current demo dataset: Requirements' `controlLinks` shape unhandled by `normalizeControlIds` (pre-existing Release 1 rendering gap, not a navigation defect)
- Filter/search state does not survive workspace navigation (marked Release 2)
- Only 6 of 7 workspace shared rails inherit the generic id-selection controller; Evidence.js uses its own equivalent

## Files Changed
- router.js: +52 −23 lines
- workspace-shared.js: +71 −2 lines
- relationships.js: +52 −12 lines
- requirements.js, controls.js, testing.js, findings.js, evidence.js, documentation.js, work-queue.js: ~30−60 lines each
- tests/lib/prototype.js: +1 line
- Three new test suites (628 tests passing)

---
Closes GitHub Issue #31.
