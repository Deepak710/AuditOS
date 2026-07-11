/**
 * AuditOS Static Router
 * Routing Architecture — Chapter 130
 *
 * The navigation backbone of the static prototype. The router's only
 * responsibility is to switch between the empty placeholder Workspace Hosts
 * declared in the Workspace Registry. It resolves the browser hash to a
 * registered workspace, renders that workspace's empty host into the workspace
 * canvas, keeps the URL synchronized for deep linking and browser history, and
 * announces the change to assistive technology.
 *
 * Out of scope by design: workspace content, navigation UI, Shared Audit
 * State, Business Objects, AI, and any business logic. Navigation is
 * implemented before page logic and remains separate from it
 * (Routing Architecture §130.29).
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
   * `document`; detail carries the current and previous workspace identifiers.
   */
  var ROUTE_CHANGED_EVENT = 'auditos:route-changed';

  // Router state, established during init().
  var mountElement = null;   // The workspace canvas (skip-link target).
  var outletElement = null;  // Router-owned container the active host renders into.
  var announcerElement = null; // Visually hidden aria-live region.
  var currentWorkspaceId = null;
  var currentRecordId = '';
  var hasActivatedOnce = false;
  var scrollPositions = {}; // workspace id -> last scrollY recorded while leaving it.

  /**
   * Extracts the route path from a hash value. Returns an empty string when the
   * hash is absent or is a namespaced route with no segment. Only the first
   * segment is considered; deeper segments are reserved for future nested
   * routes and ignored by this foundation. Any query string on that segment
   * (record id) is stripped here and read separately by `parseRouteRecordId`.
   */
  function parseRoutePath(hash) {
    if (!isRouteHash(hash)) {
      return '';
    }
    var withoutPrefix = hash.slice(ROUTE_HASH_PREFIX.length);
    return withoutPrefix.split('/')[0].split('?')[0];
  }

  /**
   * Extracts the record id carried by a route hash's query string (Issue
   * #31 — Cross-Workspace Record Navigation), e.g. "#/requirements?id=REQ-004"
   * resolves to "REQ-004". Only the `id` parameter is recognized, mirroring
   * `parseRoutePath`'s handling of nested segments: a deeper navigation
   * contract is reserved for future issues. Returns "" when the hash carries
   * no query string or no `id` parameter.
   */
  function parseRouteRecordId(hash) {
    if (!isRouteHash(hash)) {
      return '';
    }
    var segment = hash.slice(ROUTE_HASH_PREFIX.length).split('/')[0];
    var queryIndex = segment.indexOf('?');
    if (queryIndex === -1) {
      return '';
    }
    var params = new global.URLSearchParams(segment.slice(queryIndex + 1));
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
   * Builds the canonical route hash for a workspace, optionally carrying a
   * record id (`#/{path}?id={recordId}`) for a stable deep link to one
   * record within that workspace (Issue #31).
   */
  function toRouteHash(workspace, recordId) {
    var hash = ROUTE_HASH_PREFIX + workspace.path;
    return recordId ? hash + '?id=' + global.encodeURIComponent(recordId) : hash;
  }

  /**
   * Resolves the current browser hash to a workspace and renders it.
   *
   * Serves as both the initial resolver and the `hashchange` handler, so every
   * entry point — first load, deep link, programmatic navigation, and browser
   * Back/Forward — flows through one predictable path.
   */
  function resolveRoute() {
    var hash = global.location.hash;

    // Leave ordinary in-page anchors (e.g. the skip link) to the browser.
    if (hash && !isRouteHash(hash)) {
      return;
    }

    var path = parseRoutePath(hash);
    var workspace = path ? registry.findByPath(path) : null;
    var isKnownRoute = Boolean(workspace);
    // A record id only carries meaning against a known workspace; an unknown
    // route never inherits one when it falls back to the default workspace.
    var recordId = isKnownRoute ? parseRouteRecordId(hash) : '';

    // Unknown or empty route falls back to the default workspace
    // (Routing Architecture §130.6).
    if (!isKnownRoute) {
      workspace = registry.findById(registry.DEFAULT_WORKSPACE_ID);
    }

    // Normalize the URL to the canonical route without adding a history entry,
    // so an empty root or an unknown deep link resolves to a clean, bookmark-
    // able URL and Back never returns to it.
    var canonicalHash = toRouteHash(workspace, recordId);
    if (global.location.hash !== canonicalHash) {
      global.history.replaceState(null, '', canonicalHash);
    }

    activateWorkspace(workspace, isKnownRoute, recordId);
  }

  /**
   * Renders a workspace's empty placeholder host into the outlet and publishes
   * the route change. Skips redundant work only when both the workspace and
   * the record id are unchanged, so navigating from one record to another
   * within the same workspace (e.g. following a "Related controls" link that
   * lands back on the workspace already open) still republishes the route
   * change and reaches the new record's selection (Issue #31).
   */
  function activateWorkspace(workspace, isKnownRoute, recordId) {
    var normalizedRecordId = recordId || '';
    var sameWorkspace = hasActivatedOnce && workspace.id === currentWorkspaceId;
    if (sameWorkspace && normalizedRecordId === currentRecordId) {
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
   * identity; its content is owned by later workspace issues.
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
        recordId: recordId || ''
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

      resolveRoute();
    },

    /**
     * Navigates to a registered workspace by identifier, optionally to one
     * stable record within it (Issue #31 — `recordId`, e.g. a control id
     * opened from another workspace's "Related controls" link). Updating the
     * hash routes through the standard `hashchange` flow, so history, the
     * URL, and the rendered host all stay consistent. Unknown identifiers are
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
    }
  };
})(window);
