# Shared Audit State Foundation

The runtime state layer of the AuditOS static prototype — the single source of
truth for runtime application data.

Implements the Shared Audit State (`docs/01-product/02-Shared-Audit-State.md`,
Chapter 9; `docs/06-data/03-shared-audit-state-model.md`, Chapter 45) for the
static prototype. It loads the simulated SharePoint structure in
`prototype/demo-data/` once, keeps that baseline immutable, and exposes a
framework-agnostic runtime state API. It renders no UI and contains no
business workflows, governance flows, or AI.

## Scope

This is a **foundation**: state only.

- **Load once** — the demo-data catalog is fetched exactly once; repeated
  `init()` calls return the same memoized promise.
- **Immutable baseline** — the loaded demo-data snapshot is deep-frozen and
  never mutated. Demo-data files are never written.
- **Runtime state** — all reads and writes operate on an in-memory working
  copy of the baseline.
- **Simulated writes** — record create/update/remove mutate only the runtime
  state and publish state events. Nothing persists across a page reload.
- **Reset** — restores the runtime state to the demo-data baseline.
- **Framework-agnostic** — plain JavaScript API on `window.AuditOS.state`;
  events use the store's own subscribe mechanism, not DOM events.

The production architecture routes every mutation through governance and the
Human Approval Engine (Model §45.12). In this prototype the simulated write
API is the mechanical substrate that later governance issues build in front
of; no approval semantics are implemented here.

## Files

| File | Responsibility |
|------|----------------|
| `demo-data-registry.js` | Authoritative structural catalog of the demo-data collections (identifier, scope, file location, records key, id key). No behavior, no business data. Shared by the store and the bundle generator. |
| `state-store.js` | State engine: one-time demo-data loading, immutable baseline, runtime state, read API, simulated write API, reset, and publish/subscribe state events. |

Two collaborators live outside this directory:

| File | Responsibility |
|------|----------------|
| `prototype/demo-data/demo-data.js` | **Generated** classic-script projection of the canonical demo-data JSON (`AuditOS.demoDataBundle`). The store's load source. Never edited by hand. |
| `prototype/tools/generate-demo-data-bundle.js` | Regenerates the bundle from the canonical JSON via the registry catalog. Run after any demo-data change. |

The application bootstrap (`prototype/js/main.js`) calls `AuditOS.state.init()`
once the DOM is ready, before initializing the router. Everything loads as
classic `<script>` tags from `prototype/index.html`, in dependency order
(bundle → registry → store → bootstrap).

## Demo-data model

The registry mirrors the simulated SharePoint structure:

- **Shared collections** (`scope: 'shared'`) — one root JSON document per
  cross-engagement collection: `companies`, `engagements`, `business-units`,
  `teams`, `pocs`, `control-library`, `framework-mappings`.
- **Engagement domains** (`scope: 'engagement'`) — a root manifest
  (`{ "datasets": [...] }`) pointing at one document per engagement dataset
  (e.g. `controls/nimbus-soc2-2026.json`): `controls`, `evidence`,
  `evidence-requests`, `evidence-requirements`, `samples`, `testing`,
  `findings`, `reports`.

Records live under a per-collection `recordsKey` (e.g. `sampleSets`, `tests`,
`sections`) and are identified by `id`, except `framework-mappings`
(`libraryControlId`). Document-level structural keys (`metadata`, `summary`,
`document`, `generation`, `controlFamilies`, `frameworks`) remain reachable
through `getDocument`.

## Loading

The canonical demo-data JSON cannot be fetched from `file://` pages, and the
canonical entry point is `file:///.../prototype/index.html`. The store
therefore never fetches: it loads from `AuditOS.demoDataBundle`, the generated
classic-script projection of the JSON (`demo-data/demo-data.js`), and clones
it into a private baseline at `init()`. Loading is **identical under
`file://` and `http(s)`** — fully offline, no network access, no localhost,
no runtime build step. Consumers only ever see the `AuditOS.state` API and
cannot tell how the data was loaded.

The JSON files remain the single source of truth. After any demo-data change,
regenerate the bundle:

```sh
node prototype/tools/generate-demo-data-bundle.js
```

If the bundle script is missing the state still initializes empty but fully
functional (`degradedReason: 'bundle-missing'`); a registered collection
absent from the bundle is recorded in `getStatus().failedSources`
(`degradedReason: 'bundle-incomplete'`) and skipped.

## Public API

`window.AuditOS.state`

| Member | Description |
|--------|-------------|
| `init()` | Loads demo-data once and establishes baseline + runtime state. Idempotent; never rejects. Called by the bootstrap. |
| `isReady()` | Whether the state has been initialized. |
| `getStatus()` | Snapshot of load diagnostics (`ready`, `demoDataLoaded`, `degraded`, `degradedReason`, `failedSources`, `loadedAt`). |
| `listCollections()` | Structural descriptors of every registered collection. |
| `getDatasetIds(collectionId)` | Dataset identifiers of an engagement-scoped collection. |
| `getDocument(collectionId[, datasetId])` | Full document copy, including `metadata` / `summary`. |
| `listRecords(collectionId[, datasetId])` | Copy of the collection's records. |
| `getRecord(collectionId, recordId[, datasetId])` | One record copy, or null. |
| `findDatasetsForEngagement(collectionId, engagementId)` | Dataset ids whose document metadata declares the engagement. |
| `createRecord(collectionId, record[, datasetId])` | Simulated create; assigns a `SIM-…` id when absent; rejects duplicate ids. |
| `updateRecord(collectionId, recordId, changes[, datasetId])` | Simulated shallow merge; the identifier field cannot be changed. |
| `removeRecord(collectionId, recordId[, datasetId])` | Simulated remove. |
| `reset()` | Restores the runtime state to the immutable demo-data baseline. |
| `subscribe(eventName, handler)` | Subscribes to a state event; returns an unsubscribe function. |
| `EVENTS` | `auditos:state-loaded`, `auditos:state-changed`, `auditos:state-reset`. |
| `CHANGE_TYPES` | `record-created`, `record-updated`, `record-removed` (in the `state-changed` detail). |

Shared collections take no `datasetId`; engagement collections require one.
Every read returns a defensive deep copy — mutating a result never changes the
state. Every mutation flows through the write API and publishes an event.

`window.AuditOS.demoDataRegistry` exposes `SCOPES`, the `COLLECTIONS` catalog,
and a `findById` lookup.

## Rules for consumers

- Read runtime data only through `AuditOS.state`. Never fetch or read
  `prototype/demo-data/` files (or `AuditOS.demoDataBundle`) directly and
  never cache business data in components, markup, CSS, or scripts.
- Mutate state only through the simulated write API so every change publishes
  a state event.
- Treat demo-data files as immutable at runtime; the store never writes them.
- When demo-data JSON changes, regenerate `demo-data/demo-data.js` with
  `node prototype/tools/generate-demo-data-bundle.js`; never edit the bundle
  by hand.
