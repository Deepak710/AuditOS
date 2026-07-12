/**
 * AuditOS Static Router
 * Routing Architecture — Chapter 130 / Platform Foundation II — GitHub Issue
 * #34 (Repository-aware hierarchical routing)
 *
 * The navigation backbone of the static prototype. The router switches
 * between the Workspace Hosts declared in the Workspace Registry, keeps the
 * URL synchronized for deep linking and browser history, and announces the
 * change to assistive technology.
 *
 * Two route shapes resolve through one flow (Issue #34):
 *
 *   Flat (preserved verbatim from earlier issues):
 *     #/{workspacePath}[?id={recordId}]
 *
 *   Hierarchical (Repository-aware):
 *     #/{clientSlug}[/{engagementSlug}[/{workspacePath}[/{recordId}]]]
 *
 * The router parses URL segments only. The Repository Foundation resolves
 * hierarchical segments into Client → Engagement → Workspace → Entity
 * (`AuditOS.repository.resolveHierarchy`); when a later segment cannot be
 * resolved the deepest valid parent opens, and when nothing resolves the
 * default workspace opens — malformed URLs always recover. While the Shared
 * Audit State is still loading, a hierarchical deep link stays untouched and
 * re-resolves the moment the state is ready.
 *
 * Out of scope by design: workspace content, navigation UI, Business
 * Objects, AI, and any business logic. Navigation is implemented before page
 * logic and remains separate from it (Routing Architecture §130.29).
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step, module loader, or
 * dynamic imports.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};
  var registry = AuditOS.workspaceRegistry;

  /**
   * Element id of the workspace canvas the router renders into. This is the
   * shell's primary content region and the skip-link target, so rendering the
   * active workspace inside it preserves skip-link continuity
   * (Routing Architecture §130.26 — Accessibility).
   */
  var MOUNT_ID = 'workspace-canvas';

  /**
   * Route hashes are namespaced with a leading "#/" so the router can tell a
   * real route from an ordinary in-page anchor (for example the shell's
   * "#workspace-canvas" skip link), which it must leave untouched.
   */
  var ROUTE_HASH_PREFIX = '#/';

  /**
   * Business event announced whenever the active workspace changes. Named as a
   * completed fact (Coding Standards §30.13 — Event Standards). Dispatched on
   * `document`; detail carries the current and previous workspace identifiers
   * and (Issue #34) the resolved hierarchy context.
   */
  var ROUTE_CHANGED_EVENT = 'auditos:route-changed';

  // Router state, established during init().
  var mountElement = null;   // The workspace canvas (skip-link target).
  var outletElement = null;  // Router-owned container the active host renders into.
  var announcerElement = null; // Visually hidden aria-live region.
  var currentWorkspaceId = null;
  var currentRecordId = '';
  var currentContext = null; // Resolved hierarchy context, or null on flat routes.
  var hasActivatedOnce = false;
  var scrollPositions = {}; // workspace id -> last scrollY recorded while leaving it.

  /**
   * Splits a route hash into its raw path segments. Returns [] when the hash
   * is absent or is a namespaced route with no segment. The first segment may
   * carry a legacy `?id=` query string, which stays attached here and is
   * handled by the flat-route readers below.
   */
  function parseRouteSegments(hash) {
    if (!isRouteHash(hash)) {
      return [];
    }
    return hash.slice(ROUTE_HASH_PREFIX.length).split('/').filter(function (segment) {
      return segment !== '';
    });
  }

  /**
   * Extracts the flat route path from a hash value: the first segment with
   * any `?id=` query string stripped (the query is read separately by
   * `parseRouteRecordId`). Returns '' when the hash carries no segment.
   */
  function parseRoutePath(hash) {
    var segments = parseRouteSegments(hash);
    return segments.length > 0 ? segments[0].split('?')[0] : '';
  }

  /**
   * Extracts the record id carried by a flat route's query string (Issue
   * #31 — Cross-Workspace Record Navigation), e.g. "#/requirements?id=REQ-004"
   * resolves to "REQ-004". Returns "" when the hash carries no query string
   * or no `id` parameter.
   */
  function parseRouteRecordId(hash) {
    var segments = parseRouteSegments(hash);
    if (segments.length === 0) {
      return '';
    }
    var queryIndex = segments[0].indexOf('?');
    if (queryIndex === -1) {
      return '';
    }
    var params = new global.URLSearchParams(segments[0].slice(queryIndex + 1));
    return params.get('id') || '';
  }

  /**
   * Reports whether a hash value is a router route (namespaced with "#/")
   * rather than an ordinary in-page anchor.
   */
  function isRouteHash(hash) {
    return typeof hash === 'string' && hash.indexOf(ROUTE_HASH_PREFIX) === 0;
  }

  /**
   * Builds the canonical flat route hash for a workspace, optionally carrying
   * a record id (`#/{path}?id={recordId}`) for a stable deep link to one
   * record within that workspace (Issue #31).
   */
  function toRouteHash(workspace, recordId) {
    var hash = ROUTE_HASH_PREFIX + workspace.path;
    return recordId ? hash + '?id=' + global.encodeURIComponent(recordId) : hash;
  }

  /** The Repository Foundation, resolved at call time so load order stays flexible. */
  function repositoryService() {
    return AuditOS.repository || null;
  }

  /**
   * Resolves the current browser hash to a workspace and renders it.
   *
   * Serves as the initial resolver, the `hashchange` handler, and the
   * state-loaded re-resolver, so every entry point — first load, deep link,
   * programmatic navigation, browser Back/Forward, and late state readiness —
   * flows through one predictable path.
   */
  function resolveRoute() {
    var hash = global.location.hash;

    // Leave ordinary in-page anchors (e.g. the skip link) to the browser.
    if (hash && !isRouteHash(hash)) {
      return;
    }

    var segments = parseRouteSegments(hash);
    var path = segments.length > 0 ? segments[0].split('?')[0] : '';
    var workspace = path ? registry.findByPath(path) : null;

    // Flat route — the first segment names a registered workspace. Preserved
    // verbatim: registered paths always win over client slugs, so every
    // pre-#34 deep link keeps resolving exactly as before.
    if (workspace) {
      var recordId = parseRouteRecordId(hash);
      var canonicalHash = toRouteHash(workspace, recordId);
      if (global.location.hash !== canonicalHash) {
        global.history.replaceState(null, '', canonicalHash);
      }
      activateWorkspace(workspace, true, recordId, null);
      return;
    }

    // Hierarchical route — the Repository resolves the segments into
    // Client → Engagement → Workspace → Entity (Issue #34).
    if (path) {
      var repository = repositoryService();
      var resolved = repository ? repository.resolveHierarchy(segments, registry) : null;

      // The state is still loading: keep the URL untouched, show the default
      // workspace host, and re-resolve when the state announces readiness.
      if (resolved && resolved.pending) {
        activateWorkspace(registry.findById(registry.DEFAULT_WORKSPACE_ID), false, '', null);
        return;
      }

      if (resolved) {
        var target = registry.findById(resolved.workspaceId);
        // Unresolvable tail segments were ignored by the resolver; normalize
        // the URL to the deepest valid route without adding a history entry.
        var canonical = repository.buildHierarchicalHash(resolved, registry);
        if (canonical && global.location.hash !== canonical) {
          global.history.replaceState(null, '', canonical);
        }
        activateWorkspace(target, true, resolved.recordId, resolved);
        return;
      }
    }

    // Unknown or empty route falls back to the default workspace
    // (Routing Architecture §130.6).
    var fallback = registry.findById(registry.DEFAULT_WORKSPACE_ID);
    var fallbackHash = toRouteHash(fallback, '');
    if (global.location.hash !== fallbackHash) {
      global.history.replaceState(null, '', fallbackHash);
    }
    activateWorkspace(fallback, false, '', null);
  }

  /** A stable signature of a hierarchy context for change detection. */
  function contextKey(context) {
    if (!context) {
      return '';
    }
    return (context.client ? context.client.id : '') + ':' +
      (context.engagement ? context.engagement.id : '');
  }

  /**
   * Renders a workspace's placeholder host into the outlet and publishes the
   * route change. Skips redundant work only when the workspace, the record
   * id, and the hierarchy context are all unchanged, so navigating between
   * records or between hierarchy scopes within one workspace still
   * republishes the route change (Issues #31 / #34).
   */
  function activateWorkspace(workspace, isKnownRoute, recordId, context) {
    var normalizedRecordId = recordId || '';
    var sameWorkspace = hasActivatedOnce && workspace.id === currentWorkspaceId;
    if (sameWorkspace && normalizedRecordId === currentRecordId &&
        contextKey(context) === contextKey(currentContext)) {
      return;
    }

    // Remember where the user was scrolled within the workspace they are
    // leaving, so returning to it (e.g. Back) can restore it (Issue #31 —
    // Context Preservation). Only recorded on a genuine workspace change, not
    // a record-to-record move within the same workspace.
    if (hasActivatedOnce && !sameWorkspace) {
      scrollPositions[currentWorkspaceId] = global.scrollY;
    }

    var previousWorkspaceId = currentWorkspaceId;
    renderWorkspaceHost(workspace);
    currentWorkspaceId = workspace.id;
    currentRecordId = normalizedRecordId;
    currentContext = context || null;

    global.document.title = workspace.title + ' — AuditOS';
    announce(workspace.label);

    // Move focus into the freshly rendered workspace on genuine route changes
    // so keyboard and screen reader users follow the navigation. The first
    // render (initial page load) leaves focus at the top of the document so
    // the skip link remains the entry point (Coding Standards §30.17).
    if (hasActivatedOnce) {
      currentView().focus();
    }
    hasActivatedOnce = true;

    dispatchRouteChanged(workspace, previousWorkspaceId, isKnownRoute, currentRecordId);

    // Land a fresh workspace at the top; restore a remembered scroll position
    // when returning to one, unless a specific record is being deep-linked to
    // (that record's own selection is the more relevant destination).
    if (!sameWorkspace) {
      var restoreY = !normalizedRecordId && Object.prototype.hasOwnProperty.call(scrollPositions, workspace.id)
        ? scrollPositions[workspace.id] : 0;
      global.scrollTo(0, restoreY);
    }
  }

  /**
   * Replaces the outlet's contents with an empty placeholder host for the
   * workspace. The host is an accessible landmark carrying the workspace
   * identity; its content is owned by the workspace modules.
   */
  function renderWorkspaceHost(workspace) {
    var view = global.document.createElement('section');
    view.className = 'aos-workspace-view';
    view.setAttribute('data-region', 'workspace-view');
    view.setAttribute('data-workspace', workspace.id);
    view.setAttribute('role', 'region');
    view.setAttribute('aria-label', workspace.label);
    // Focusable only programmatically, so route changes can move focus here
    // without adding the region to the tab order.
    view.setAttribute('tabindex', '-1');

    outletElement.replaceChildren(view);
  }

  /** Returns the currently rendered workspace host element. */
  function currentView() {
    return outletElement.firstElementChild;
  }

  /** Announces the active workspace to assistive technology. */
  function announce(label) {
    announcerElement.textContent = label + ' workspace';
  }

  /** Publishes the route-changed business event on the document. */
  function dispatchRouteChanged(workspace, previousWorkspaceId, isKnownRoute, recordId) {
    global.document.dispatchEvent(new global.CustomEvent(ROUTE_CHANGED_EVENT, {
      detail: {
        workspaceId: workspace.id,
        path: workspace.path,
        previousWorkspaceId: previousWorkspaceId,
        isKnownRoute: isKnownRoute,
        recordId: recordId || '',
        // Issue #34 — the resolved hierarchy context of the route, when the
        // route carries one. Flat routes carry nulls; consumers treat the
        // fields as optional.
        clientId: currentContext && currentContext.client ? currentContext.client.id : null,
        engagementId: currentContext && currentContext.engagement ? currentContext.engagement.id : null
      }
    }));
  }

  /**
   * Creates the router-owned outlet inside the workspace canvas. The outlet
   * lives inside the skip-link target so the active workspace is always the
   * first thing reached after skipping to main content.
   */
  function createOutlet() {
    outletElement = global.document.createElement('div');
    outletElement.className = 'aos-router-outlet';
    outletElement.setAttribute('data-region', 'router-outlet');
    mountElement.insertBefore(outletElement, mountElement.firstChild);
  }

  /** Creates the visually hidden live region used for route announcements. */
  function createAnnouncer() {
    announcerElement = global.document.createElement('div');
    announcerElement.className = 'visually-hidden';
    announcerElement.setAttribute('role', 'status');
    announcerElement.setAttribute('aria-live', 'polite');
    global.document.body.appendChild(announcerElement);
  }

  AuditOS.router = {
    ROUTE_CHANGED_EVENT: ROUTE_CHANGED_EVENT,

    /**
     * Wires the router to the shell and renders the initial route. Safe to call
     * once, after the DOM is ready. Does nothing if the workspace canvas is
     * absent, so the shell degrades rather than throwing.
     */
    init: function () {
      mountElement = global.document.getElementById(MOUNT_ID);
      if (!mountElement) {
        return;
      }

      createOutlet();
      createAnnouncer();

      // A single listener covers deep links, programmatic navigation, and
      // browser Back/Forward, since all of them change the hash.
      global.addEventListener('hashchange', resolveRoute);

      // A hierarchical deep link cannot resolve before the Shared Audit
      // State loads; re-resolving on readiness turns the pending route into
      // the real one (Issue #34). Flat routes re-resolve idempotently.
      var state = AuditOS.state;
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, resolveRoute);
      }

      resolveRoute();
    },

    /**
     * Navigates to a registered workspace by identifier, optionally to one
     * stable record within it (Issue #31 — `recordId`). Updating the hash
     * routes through the standard `hashchange` flow, so history, the URL,
     * and the rendered host all stay consistent. Unknown identifiers are
     * ignored.
     */
    navigate: function (workspaceId, recordId) {
      var workspace = registry.findById(workspaceId);
      if (!workspace) {
        return;
      }
      global.location.hash = toRouteHash(workspace, recordId);
    },

    /** Returns the identifier of the currently active workspace. */
    getCurrentWorkspaceId: function () {
      return currentWorkspaceId;
    },

    /**
     * Returns the record id carried by the current route (Issue #31), or ""
     * when the route names no specific record.
     */
    getCurrentRecordId: function () {
      return currentRecordId;
    },

    /**
     * Returns the resolved hierarchy context of the current route (Issue
     * #34): `{ client, engagement, workspaceId, recordId, depth }`, or null
     * when the current route is flat. The entities are Repository read
     * copies — mutating them changes nothing.
     */
    getCurrentContext: function () {
      return currentContext;
    }
  };
})(window);
