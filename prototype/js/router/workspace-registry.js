/**
 * AuditOS Workspace Registry
 * Routing Architecture — Chapter 130 / Navigation & Context Architecture —
 * GitHub Issue #39
 *
 * Single, authoritative list of the Workspace Hosts the router can switch
 * between. Each entry is a workspace identity only — an identifier, a
 * human-readable label, a document title, the stable hash path used for deep
 * linking, and (Issue #39) the hierarchy scope the workspace resolves at:
 *
 *   platform   — reachable flat (`#/{path}`), no client/engagement context.
 *   client     — reachable only inside a client (`#/client/{clientId}`).
 *   engagement — reachable only inside an engagement
 *                (`#/client/{clientId}/engagement/{engagementId}/{path}`).
 *
 * No workspace content, Business Objects, Shared Audit State, or logic live
 * here; workspace modules render into these hosts.
 *
 * Issue #39 removals/renames: the Requirements workspace is removed entirely
 * (Evidence is the operational object; `#/requirements` redirects there), the
 * Home path is the canonical `home` (legacy `dashboard` redirects), and the
 * Walkthrough path is the canonical singular `walkthrough` (legacy
 * `walkthroughs` redirects).
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Workspace hierarchy scopes (Issue #39). */
  var SCOPES = {
    PLATFORM: 'platform',
    CLIENT: 'client',
    ENGAGEMENT: 'engagement'
  };

  /**
   * Canonical workspace identifiers.
   *
   * Centralized so routing, navigation, and workspaces reference one constant
   * instead of repeating string literals (Coding Standards §30.11).
   */
  var WORKSPACE_IDS = {
    DASHBOARD: 'dashboard',
    ENGAGEMENT: 'engagement',
    WORKQUEUE: 'work-queue',
    WALKTHROUGH: 'walkthrough',
    CONTROLS: 'controls',
    EVIDENCE: 'evidence',
    TESTING: 'testing',
    FINDINGS: 'findings',
    DOCUMENTATION: 'documentation',
    REPORTING: 'reporting',
    GOVERNANCE: 'governance',
    AI: 'ai',
    EXECUTIVE: 'executive',
    PROGRAM: 'program',
    CLIENT: 'client',
    APPROVALS: 'approvals',
    AI_USAGE: 'ai-usage',
    AUDIT_LOG: 'audit-log',
    CLIENT_WIZARD: 'client-wizard',
    ENGAGEMENT_WIZARD: 'engagement-wizard'
  };

  /**
   * Ordered workspace registry.
   *
   * `path` is the stable, lowercase, hyphenated hash segment used for deep
   * linking (Routing Architecture §130.28). `title` feeds the document title
   * and the accessible route-change announcement. `scope` declares where in
   * the AuditOS → Client → Engagement hierarchy the workspace resolves
   * (Issue #39); the router enforces it.
   */
  var WORKSPACES = [
    // AuditOS Home — the platform operational landing workspace. The
    // identifier stays `dashboard` for module stability; the canonical path
    // is `home` (Issue #39 routing contract), with `dashboard` redirected.
    { id: WORKSPACE_IDS.DASHBOARD,   path: 'home',         label: 'AuditOS Home',        title: 'AuditOS Home',        scope: SCOPES.PLATFORM },
    { id: WORKSPACE_IDS.ENGAGEMENT,  path: 'engagements',  label: 'Engagement',          title: 'Engagement',          scope: SCOPES.ENGAGEMENT },
    { id: WORKSPACE_IDS.WORKQUEUE,   path: 'work-queue',   label: 'Work Queue',          title: 'Work Queue',          scope: SCOPES.ENGAGEMENT },
    { id: WORKSPACE_IDS.WALKTHROUGH, path: 'walkthrough',  label: 'Walkthrough',         title: 'Walkthrough',         scope: SCOPES.ENGAGEMENT },
    { id: WORKSPACE_IDS.CONTROLS,    path: 'controls',     label: 'Controls',            title: 'Controls',            scope: SCOPES.ENGAGEMENT },
    { id: WORKSPACE_IDS.EVIDENCE,    path: 'evidence',     label: 'Evidence',            title: 'Evidence',            scope: SCOPES.ENGAGEMENT },
    { id: WORKSPACE_IDS.TESTING,     path: 'testing',      label: 'Testing',             title: 'Testing',             scope: SCOPES.ENGAGEMENT },
    { id: WORKSPACE_IDS.FINDINGS,    path: 'findings',     label: 'Findings',            title: 'Findings',            scope: SCOPES.ENGAGEMENT },
    { id: WORKSPACE_IDS.DOCUMENTATION, path: 'documentation', label: 'Documentation',    title: 'Documentation',       scope: SCOPES.ENGAGEMENT },
    { id: WORKSPACE_IDS.REPORTING,   path: 'reporting',    label: 'Reporting',           title: 'Reporting',           scope: SCOPES.ENGAGEMENT },
    { id: WORKSPACE_IDS.GOVERNANCE,  path: 'governance',   label: 'Governance',          title: 'Governance',          scope: SCOPES.ENGAGEMENT },
    { id: WORKSPACE_IDS.AI,          path: 'ai',           label: 'AI Workspace',        title: 'AI Workspace',        scope: SCOPES.ENGAGEMENT },
    { id: WORKSPACE_IDS.EXECUTIVE,   path: 'executive',    label: 'Executive Dashboard', title: 'Executive Dashboard', scope: SCOPES.PLATFORM },
    { id: WORKSPACE_IDS.PROGRAM,     path: 'program',      label: 'Audit Program',       title: 'Audit Program',       scope: SCOPES.PLATFORM },
    { id: WORKSPACE_IDS.CLIENT,      path: 'clients',      label: 'Client Workspace',    title: 'Client Workspace',    scope: SCOPES.CLIENT },
    { id: WORKSPACE_IDS.APPROVALS,   path: 'approvals',    label: 'Global Approvals',    title: 'Global Approvals',    scope: SCOPES.PLATFORM },
    // `capability` is access identity, not business content: navigation
    // surfaces hide capability-gated workspaces from sessions the Permission
    // Foundation does not grant the capability to.
    { id: WORKSPACE_IDS.AI_USAGE,    path: 'ai-usage',     label: 'AI Usage',            title: 'AI Usage',            scope: SCOPES.PLATFORM, capability: 'ai-usage.view' },
    { id: WORKSPACE_IDS.AUDIT_LOG,         path: 'audit-log',      label: 'Audit Log',      title: 'Audit Log',      scope: SCOPES.PLATFORM, capability: 'audit-log.view' },
    { id: WORKSPACE_IDS.CLIENT_WIZARD,     path: 'new-client',     label: 'New Client',     title: 'New Client',     scope: SCOPES.PLATFORM, capability: 'clients.create' },
    { id: WORKSPACE_IDS.ENGAGEMENT_WIZARD, path: 'new-engagement', label: 'New Engagement', title: 'New Engagement', scope: SCOPES.PLATFORM, capability: 'engagements.create' }
  ];

  /**
   * Workspace shown for the default route and for any unknown route
   * (Routing Architecture §130.6 — the application root resolves to Home).
   */
  var DEFAULT_WORKSPACE_ID = WORKSPACE_IDS.DASHBOARD;

  AuditOS.workspaceRegistry = {
    IDS: WORKSPACE_IDS,
    SCOPES: SCOPES,
    WORKSPACES: WORKSPACES,
    DEFAULT_WORKSPACE_ID: DEFAULT_WORKSPACE_ID,

    /**
     * Returns the workspace registered for a hash path, or null when the path
     * matches no registered workspace.
     */
    findByPath: function (path) {
      for (var index = 0; index < WORKSPACES.length; index += 1) {
        if (WORKSPACES[index].path === path) {
          return WORKSPACES[index];
        }
      }
      return null;
    },

    /**
     * Returns the workspace registered for an identifier, or null when the
     * identifier matches no registered workspace.
     */
    findById: function (id) {
      for (var index = 0; index < WORKSPACES.length; index += 1) {
        if (WORKSPACES[index].id === id) {
          return WORKSPACES[index];
        }
      }
      return null;
    }
  };
})(window);
