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
  var hasActivatedOnce = false;

  /**
   * Extracts the route path from a hash value. Returns an empty string when the
   * hash is absent or is a namespaced route with no segment. Only the first
   * segment is considered; deeper segments are reserved for future nested
   * routes and ignored by this foundation.
   */
  function parseRoutePath(hash) {
    if (!isRouteHash(hash)) {
      return '';
    }
    var withoutPrefix = hash.slice(ROUTE_HASH_PREFIX.length);
    return withoutPrefix.split('/')[0];
  }

  /**
   * Reports whether a hash value is a router route (namespaced with "#/")
   * rather than an ordinary in-page anchor.
   */
  function isRouteHash(hash) {
    return typeof hash === 'string' && hash.indexOf(ROUTE_HASH_PREFIX) === 0;
  }

  /** Builds the canonical route hash for a workspace. */
  function toRouteHash(workspace) {
    return ROUTE_HASH_PREFIX + workspace.path;
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

    // Unknown or empty route falls back to the default workspace
    // (Routing Architecture §130.6).
    if (!isKnownRoute) {
      workspace = registry.findById(registry.DEFAULT_WORKSPACE_ID);
    }

    // Normalize the URL to the canonical route without adding a history entry,
    // so an empty root or an unknown deep link resolves to a clean, bookmark-
    // able URL and Back never returns to it.
    var canonicalHash = toRouteHash(workspace);
    if (global.location.hash !== canonicalHash) {
      global.history.replaceState(null, '', canonicalHash);
    }

    activateWorkspace(workspace, isKnownRoute);
  }

  /**
   * Renders a workspace's empty placeholder host into the outlet and publishes
   * the route change. Skips redundant work when the workspace is already
   * active so repeated resolutions do not re-render or steal focus.
   */
  function activateWorkspace(workspace, isKnownRoute) {
    if (hasActivatedOnce && workspace.id === currentWorkspaceId) {
      return;
    }

    var previousWorkspaceId = currentWorkspaceId;
    renderWorkspaceHost(workspace);
    currentWorkspaceId = workspace.id;

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

    dispatchRouteChanged(workspace, previousWorkspaceId, isKnownRoute);
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
  function dispatchRouteChanged(workspace, previousWorkspaceId, isKnownRoute) {
    global.document.dispatchEvent(new global.CustomEvent(ROUTE_CHANGED_EVENT, {
      detail: {
        workspaceId: workspace.id,
        path: workspace.path,
        previousWorkspaceId: previousWorkspaceId,
        isKnownRoute: isKnownRoute
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
     * Navigates to a registered workspace by identifier. Updating the hash
     * routes through the standard `hashchange` flow, so history, the URL, and
     * the rendered host all stay consistent. Unknown identifiers are ignored.
     */
    navigate: function (workspaceId) {
      var workspace = registry.findById(workspaceId);
      if (!workspace) {
        return;
      }
      global.location.hash = toRouteHash(workspace);
    },

    /** Returns the identifier of the currently active workspace. */
    getCurrentWorkspaceId: function () {
      return currentWorkspaceId;
    }
  };
})(window);
