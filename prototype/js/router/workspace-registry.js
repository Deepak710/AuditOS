/**
 * AuditOS Workspace Registry
 * Routing Architecture — Chapter 130 / Information Architecture — Chapter 10
 *
 * Single, authoritative list of the placeholder Workspace Hosts the Static
 * Routing Foundation can switch between. Each entry is a workspace identity
 * only — an identifier, a human-readable label, a document title, and the
 * stable hash path used for deep linking. No workspace content, Business
 * Objects, Shared Audit State, or logic live here; later workspace issues
 * render into these hosts.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /**
   * Canonical workspace identifiers.
   *
   * Centralized so routing, future navigation, and future workspaces reference
   * one constant instead of repeating string literals (Coding Standards
   * §30.11 — Constants).
   */
  var WORKSPACE_IDS = {
    DASHBOARD: 'dashboard',
    ENGAGEMENT: 'engagement',
    WORKQUEUE: 'work-queue',
    WALKTHROUGH: 'walkthrough',
    REQUIREMENTS: 'requirements',
    CONTROLS: 'controls',
    EVIDENCE: 'evidence',
    TESTING: 'testing',
    FINDINGS: 'findings',
    DOCUMENTATION: 'documentation',
    REPORTING: 'reporting',
    GOVERNANCE: 'governance',
    AI: 'ai',
    EXECUTIVE: 'executive'
  };

  /**
   * Ordered workspace registry.
   *
   * `path` is the stable, lowercase, hyphenated hash segment used for deep
   * linking (Routing Architecture §130.28 — URL Design Principles). `title`
   * feeds the document title and the accessible route-change announcement.
   * The order reflects the documented global navigation hierarchy
   * (Routing Architecture §130.5).
   */
  var WORKSPACES = [
    // Renamed by GitHub Issue #15: the Dashboard becomes AuditOS Home, the
    // permanent operational landing workspace. The identifier and hash path
    // stay stable so routing, deep links, and history remain unchanged.
    { id: WORKSPACE_IDS.DASHBOARD,   path: 'dashboard',    label: 'AuditOS Home',        title: 'AuditOS Home' },
    { id: WORKSPACE_IDS.ENGAGEMENT,  path: 'engagements',  label: 'Engagement',          title: 'Engagement' },
    // Cross-workspace operational queue (GitHub Issue #28): aggregates work
    // items from every operational workspace below, so it is registered right
    // after the Engagement overview, ahead of the lifecycle chain it surfaces.
    { id: WORKSPACE_IDS.WORKQUEUE,   path: 'work-queue',   label: 'Work Queue',          title: 'Work Queue' },
    { id: WORKSPACE_IDS.WALKTHROUGH, path: 'walkthroughs', label: 'Walkthrough',         title: 'Walkthrough' },
    { id: WORKSPACE_IDS.REQUIREMENTS, path: 'requirements', label: 'Requirements',       title: 'Requirements' },
    { id: WORKSPACE_IDS.CONTROLS,    path: 'controls',     label: 'Controls',            title: 'Controls' },
    { id: WORKSPACE_IDS.EVIDENCE,    path: 'evidence',     label: 'Evidence',            title: 'Evidence' },
    { id: WORKSPACE_IDS.TESTING,     path: 'testing',      label: 'Testing',             title: 'Testing' },
    { id: WORKSPACE_IDS.FINDINGS,    path: 'findings',     label: 'Findings',            title: 'Findings' },
    { id: WORKSPACE_IDS.DOCUMENTATION, path: 'documentation', label: 'Documentation',     title: 'Documentation' },
    { id: WORKSPACE_IDS.REPORTING,   path: 'reporting',    label: 'Reporting',           title: 'Reporting' },
    { id: WORKSPACE_IDS.GOVERNANCE,  path: 'governance',   label: 'Governance',          title: 'Governance' },
    { id: WORKSPACE_IDS.AI,          path: 'ai',           label: 'AI Workspace',        title: 'AI Workspace' },
    { id: WORKSPACE_IDS.EXECUTIVE,   path: 'executive',    label: 'Executive Dashboard', title: 'Executive Dashboard' }
  ];

  /**
   * Workspace shown for the default route and for any unknown route
   * (Routing Architecture §130.6 — Primary Routes; the application root
   * resolves to the Dashboard).
   */
  var DEFAULT_WORKSPACE_ID = WORKSPACE_IDS.DASHBOARD;

  AuditOS.workspaceRegistry = {
    IDS: WORKSPACE_IDS,
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
