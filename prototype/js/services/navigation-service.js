/**
 * AuditOS Navigation Service
 * Navigation & Context Architecture — GitHub Issue #39
 *
 * The single navigation service responsible for every route transition. No
 * page constructs URLs manually, concatenates route strings, or calls the
 * router directly: every destination is built and navigated to through this
 * service, so the canonical hierarchical URL contract lives in exactly one
 * place.
 *
 * Canonical route contract (Issue #39 — Routing):
 *
 *   #/home
 *   #/{platformWorkspacePath}                            (platform scope)
 *   #/client/{clientId}
 *   #/client/{clientId}/engagement/{engagementId}
 *   #/client/{clientId}/engagement/{engagementId}/{workspacePath}
 *   #/client/{clientId}/engagement/{engagementId}/{workspacePath}/{recordId}
 *   #/client/{clientId}/engagement/{engagementId}/walkthrough/{teamId}/{pocId}
 *
 * Identifiers are the recorded entity ids (CMP-…, ENG-…), never derived
 * slugs, so a route always names exactly one record. Legacy flat and
 * slug-based routes are redirected by the router; this service never emits
 * them.
 *
 * Two API families:
 *   href…() — pure canonical URL builders (real anchors, deep links).
 *   go…()   — imperative navigation (sets the hash; the router resolves it).
 *
 * Depends on nothing in components/, keeping the js → components boundary
 * one-way. Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Route hashes are namespaced with "#/" (Routing Architecture §130). */
  var ROUTE_HASH_PREFIX = '#/';

  /** Structural route segment markers of the canonical hierarchical contract. */
  var SEGMENTS = { CLIENT: 'client', ENGAGEMENT: 'engagement' };

  /** The Workspace Registry, resolved at call time so load order stays flexible. */
  function registry() {
    return AuditOS.workspaceRegistry || null;
  }

  /** The Context Resolver, resolved at call time. */
  function contextResolver() {
    return AuditOS.contextResolver || null;
  }

  /**
   * Encodes one identifier as a URL path segment. Uses the built-in
   * `encodeURIComponent` (a context intrinsic) rather than a property of the
   * captured `global`, so encoding works in the browser and in the offline
   * test sandbox alike.
   */
  function encodeSegment(value) {
    return encodeURIComponent(String(value));
  }

  /** The registered workspace for an id, or null. */
  function workspaceById(workspaceId) {
    var reg = registry();
    return reg ? reg.findById(workspaceId) : null;
  }

  // ------------------------------------------------------------------
  // Pure canonical href builders
  // ------------------------------------------------------------------

  /** The canonical Home route. */
  function hrefHome() {
    return ROUTE_HASH_PREFIX + 'home';
  }

  /** The canonical route of a platform-scoped workspace (`#/{path}[/{recordId}]`). */
  function hrefPlatform(workspaceId, recordId) {
    var workspace = workspaceById(workspaceId);
    if (!workspace) {
      return null;
    }
    var hash = ROUTE_HASH_PREFIX + workspace.path;
    return recordId ? hash + '/' + encodeSegment(recordId) : hash;
  }

  /** The canonical route of one client's workspace. */
  function hrefClient(clientId) {
    if (!clientId) {
      return null;
    }
    return ROUTE_HASH_PREFIX + SEGMENTS.CLIENT + '/' + encodeSegment(clientId);
  }

  /** The canonical route of one engagement's overview. */
  function hrefEngagement(clientId, engagementId) {
    var base = hrefClient(clientId);
    if (!base || !engagementId) {
      return null;
    }
    return base + '/' + SEGMENTS.ENGAGEMENT + '/' + encodeSegment(engagementId);
  }

  /**
   * The canonical route of an engagement-scoped workspace, optionally down to
   * one record (and, for the Walkthrough's Team → POC depth, one POC).
   * Naming the Engagement overview workspace (or no workspace) yields the
   * engagement route itself.
   */
  function hrefWorkspace(clientId, engagementId, workspaceId, recordId, pocId) {
    var reg = registry();
    var base = hrefEngagement(clientId, engagementId);
    if (!base || !reg) {
      return null;
    }
    if (!workspaceId || workspaceId === reg.IDS.ENGAGEMENT) {
      return base;
    }
    var workspace = workspaceById(workspaceId);
    if (!workspace) {
      return null;
    }
    var hash = base + '/' + workspace.path;
    if (recordId) {
      hash += '/' + encodeSegment(recordId);
      if (pocId && workspace.id === reg.IDS.WALKTHROUGH) {
        hash += '/' + encodeSegment(pocId);
      }
    }
    return hash;
  }

  /**
   * The canonical route of a workspace within the scope it is registered for:
   * engagement-scoped workspaces resolve inside the supplied (or current)
   * client + engagement context, client-scoped inside the client, and
   * platform-scoped flat. Returns null when the workspace cannot be reached
   * from the scope — a caller never fabricates a route no resolver serves.
   */
  function hrefFor(workspaceId, context, recordId) {
    var reg = registry();
    var workspace = workspaceById(workspaceId);
    if (!reg || !workspace) {
      return null;
    }
    var resolver = contextResolver();
    var scope = context || (resolver ? resolver.current() : null) || {};
    var clientId = scope.client ? scope.client.id : (scope.clientId || null);
    var engagementId = scope.engagement ? scope.engagement.id : (scope.engagementId || null);

    if (workspace.id === reg.IDS.DASHBOARD) {
      return hrefHome();
    }
    if (workspace.scope === 'platform') {
      return hrefPlatform(workspaceId, recordId);
    }
    if (workspace.scope === 'client') {
      return hrefClient(clientId);
    }
    if (clientId && engagementId) {
      return hrefWorkspace(clientId, engagementId, workspaceId, recordId);
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Imperative navigation — the one place the location hash is written.
  // ------------------------------------------------------------------

  /** Navigates to a canonical route hash. Null/unknown destinations are ignored. */
  function navigate(href) {
    if (typeof href !== 'string' || href.indexOf(ROUTE_HASH_PREFIX) !== 0) {
      return;
    }
    global.location.hash = href;
  }

  AuditOS.navigationService = {
    ROUTE_HASH_PREFIX: ROUTE_HASH_PREFIX,
    SEGMENTS: SEGMENTS,

    hrefHome: hrefHome,
    hrefPlatform: hrefPlatform,
    hrefClient: hrefClient,
    hrefEngagement: hrefEngagement,
    hrefWorkspace: hrefWorkspace,
    hrefFor: hrefFor,

    navigate: navigate,

    goHome: function () { navigate(hrefHome()); },
    goClient: function (clientId) { navigate(hrefClient(clientId)); },
    goEngagement: function (clientId, engagementId) { navigate(hrefEngagement(clientId, engagementId)); },
    goWorkspace: function (clientId, engagementId, workspaceId, recordId) {
      navigate(hrefWorkspace(clientId, engagementId, workspaceId, recordId));
    },

    goEvidence: function (clientId, engagementId, evidenceId) {
      var reg = registry();
      if (reg) { navigate(hrefWorkspace(clientId, engagementId, reg.IDS.EVIDENCE, evidenceId)); }
    },
    goWalkthrough: function (clientId, engagementId, teamId, pocId) {
      var reg = registry();
      if (reg) { navigate(hrefWorkspace(clientId, engagementId, reg.IDS.WALKTHROUGH, teamId, pocId)); }
    },
    goControls: function (clientId, engagementId, controlId) {
      var reg = registry();
      if (reg) { navigate(hrefWorkspace(clientId, engagementId, reg.IDS.CONTROLS, controlId)); }
    },
    goTesting: function (clientId, engagementId, testId) {
      var reg = registry();
      if (reg) { navigate(hrefWorkspace(clientId, engagementId, reg.IDS.TESTING, testId)); }
    },
    goFindings: function (clientId, engagementId, findingId) {
      var reg = registry();
      if (reg) { navigate(hrefWorkspace(clientId, engagementId, reg.IDS.FINDINGS, findingId)); }
    },
    goDocumentation: function (clientId, engagementId, sectionId) {
      var reg = registry();
      if (reg) { navigate(hrefWorkspace(clientId, engagementId, reg.IDS.DOCUMENTATION, sectionId)); }
    },
    goReporting: function (clientId, engagementId) {
      var reg = registry();
      if (reg) { navigate(hrefWorkspace(clientId, engagementId, reg.IDS.REPORTING)); }
    },
    goWorkQueue: function (clientId, engagementId) {
      var reg = registry();
      if (reg) { navigate(hrefWorkspace(clientId, engagementId, reg.IDS.WORKQUEUE)); }
    },

    /**
     * Requirements ceased to exist as a user-facing workspace (Issue #39 —
     * Evidence becomes the operational object); its navigation resolves to
     * the Evidence workspace.
     */
    goRequirements: function (clientId, engagementId) {
      this.goEvidence(clientId, engagementId);
    },

    goApprovals: function () {
      var reg = registry();
      if (reg) { navigate(hrefPlatform(reg.IDS.APPROVALS)); }
    },
    goAiUsage: function () {
      var reg = registry();
      if (reg) { navigate(hrefPlatform(reg.IDS.AI_USAGE)); }
    },
    goAuditLog: function () {
      var reg = registry();
      if (reg) { navigate(hrefPlatform(reg.IDS.AUDIT_LOG)); }
    },
    goNewClient: function () {
      var reg = registry();
      if (reg) { navigate(hrefPlatform(reg.IDS.CLIENT_WIZARD)); }
    },
    goNewEngagement: function () {
      var reg = registry();
      if (reg) { navigate(hrefPlatform(reg.IDS.ENGAGEMENT_WIZARD)); }
    }
  };
})(window);
