/**
 * AuditOS Demo-Data Registry
 * Shared Audit State — Chapter 9 / Shared Audit State Model — Chapter 45
 *
 * Single, authoritative catalog of the simulated SharePoint structure in
 * `prototype/demo-data/`. Each entry describes one demo-data collection as
 * structure only — its identifier, scope, file location, and the key under
 * which its records live. No business data, business logic, or loading
 * behavior lives here; the Shared Audit State store consumes this catalog to
 * load demo-data.
 *
 * Two scopes mirror the demo-data layout:
 *
 * - `shared`     — one root JSON document holding a cross-engagement
 *                  collection (e.g. companies.json).
 * - `engagement` — a root manifest (`{ "datasets": [paths] }`) pointing at
 *                  one JSON document per engagement dataset (e.g.
 *                  controls.json → controls/nimbus-soc2-2026.json), simulating
 *                  per-engagement SharePoint document libraries.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Collection scopes (Coding Standards §30.11 — Constants). */
  var SCOPES = {
    SHARED: 'shared',
    ENGAGEMENT: 'engagement'
  };

  /**
   * Ordered demo-data catalog.
   *
   * `recordsKey` names the array inside each document that holds the
   * collection's records. `idKey` names the record identifier field and
   * defaults to `id`; only `framework-mappings` deviates. Documents may carry
   * additional structural keys (metadata, summary, controlFamilies,
   * frameworks, document, generation); those remain reachable through the
   * store's document-level read API.
   *
   * The paths are the canonical demo-data sources. The browser never fetches
   * them; the bundle generator (`prototype/tools/generate-demo-data-bundle.js`)
   * reads this same catalog to build the loadable demo-data bundle.
   */
  var COLLECTIONS = [
    // Shared, cross-engagement collections (root JSON documents).
    { id: 'companies',          scope: SCOPES.SHARED, path: 'demo-data/companies.json',          recordsKey: 'companies' },
    { id: 'engagements',        scope: SCOPES.SHARED, path: 'demo-data/engagements.json',        recordsKey: 'engagements' },
    { id: 'business-units',     scope: SCOPES.SHARED, path: 'demo-data/business-units.json',     recordsKey: 'businessUnits' },
    { id: 'teams',              scope: SCOPES.SHARED, path: 'demo-data/teams.json',              recordsKey: 'teams' },
    { id: 'pocs',               scope: SCOPES.SHARED, path: 'demo-data/pocs.json',               recordsKey: 'pocs' },
    { id: 'control-library',    scope: SCOPES.SHARED, path: 'demo-data/control-library.json',    recordsKey: 'controls' },
    { id: 'framework-mappings', scope: SCOPES.SHARED, path: 'demo-data/framework-mappings.json', recordsKey: 'mappings', idKey: 'libraryControlId' },
    { id: 'users',              scope: SCOPES.SHARED, path: 'demo-data/users.json',              recordsKey: 'users' },
    { id: 'programs',           scope: SCOPES.SHARED, path: 'demo-data/programs.json',            recordsKey: 'programs' },
    // enums.json is a lookup table of named vocabularies (evidenceStatus,
    // documentationStatus, ...), not a records array; read whole via
    // state.getDocument('enums'). recordsKey names its one non-array key so
    // listRecords/getRecord degrade to [] / null instead of throwing.
    { id: 'enums',              scope: SCOPES.SHARED, path: 'demo-data/enums.json',               recordsKey: 'tickmarks' },
    { id: 'master-controls',    scope: SCOPES.SHARED, path: 'demo-data/master-controls.json',     recordsKey: 'mappings' },
    // Platform Foundation II collections (GitHub Issue #34): approval
    // workflow requests, the Platform Audit Service event log (append-only;
    // its baseline is intentionally empty — events accumulate at runtime as
    // simulated writes), and the AI Telemetry Platform event records.
    { id: 'approvals',          scope: SCOPES.SHARED, path: 'demo-data/approvals.json',           recordsKey: 'approvals' },
    { id: 'audit-logs',         scope: SCOPES.SHARED, path: 'demo-data/audit-logs.json',          recordsKey: 'events' },
    { id: 'ai-telemetry',       scope: SCOPES.SHARED, path: 'demo-data/ai-telemetry.json',        recordsKey: 'events' },
    // Client Workspace AI Portfolio Insights (GitHub Issue #35 §7): precomputed
    // advisory signals scoped to a client's portfolio, rendered read-only by
    // the Client Workspace's AI module exactly as a future AI agent's output
    // would render.
    { id: 'ai-portfolio-insights', scope: SCOPES.SHARED, path: 'demo-data/ai-portfolio-insights.json', recordsKey: 'insights' },

    // Per-engagement domains (root manifest → one document per dataset).
    { id: 'controls',              scope: SCOPES.ENGAGEMENT, manifestPath: 'demo-data/controls.json',              recordsKey: 'controls' },
    { id: 'evidence',              scope: SCOPES.ENGAGEMENT, manifestPath: 'demo-data/evidence.json',              recordsKey: 'evidence' },
    { id: 'evidence-requests',     scope: SCOPES.ENGAGEMENT, manifestPath: 'demo-data/evidence-requests.json',     recordsKey: 'requests' },
    { id: 'evidence-requirements', scope: SCOPES.ENGAGEMENT, manifestPath: 'demo-data/evidence-requirements.json', recordsKey: 'requirements' },
    { id: 'samples',               scope: SCOPES.ENGAGEMENT, manifestPath: 'demo-data/samples.json',               recordsKey: 'sampleSets' },
    { id: 'testing',               scope: SCOPES.ENGAGEMENT, manifestPath: 'demo-data/testing.json',               recordsKey: 'tests' },
    { id: 'findings',              scope: SCOPES.ENGAGEMENT, manifestPath: 'demo-data/findings.json',              recordsKey: 'findings' },
    { id: 'reports',               scope: SCOPES.ENGAGEMENT, manifestPath: 'demo-data/reports.json',               recordsKey: 'sections' },
    { id: 'walkthroughs',          scope: SCOPES.ENGAGEMENT, manifestPath: 'demo-data/walkthroughs.json',          recordsKey: 'sessions' },
    { id: 'activity',              scope: SCOPES.ENGAGEMENT, manifestPath: 'demo-data/activity.json',              recordsKey: 'events' }
  ];

  AuditOS.demoDataRegistry = {
    SCOPES: SCOPES,
    COLLECTIONS: COLLECTIONS,

    /**
     * Returns the catalog entry registered for a collection identifier, or
     * null when the identifier matches no registered collection.
     */
    findById: function (id) {
      for (var index = 0; index < COLLECTIONS.length; index += 1) {
        if (COLLECTIONS[index].id === id) {
          return COLLECTIONS[index];
        }
      }
      return null;
    }
  };
})(window);
