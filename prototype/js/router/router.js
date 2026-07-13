/**
 * AuditOS Router
 * Navigation & Context Architecture — GitHub Issue #39 (canonical
 * hierarchical routing) / Routing Architecture — Chapter 130
 *
 * The navigation backbone of the static prototype. The router switches
 * between the Workspace Hosts declared in the Workspace Registry, keeps the
 * URL synchronized for deep linking and browser history, and announces the
 * change to assistive technology.
 *
 * One canonical route contract (Issue #39):
 *
 *   #/home
 *   #/{platformWorkspacePath}[/{recordId}]
 *   #/client/{clientId}
 *   #/client/{clientId}/engagement/{engagementId}
 *   #/client/{clientId}/engagement/{engagementId}/{workspacePath}[/{recordId}[/{pocId}]]
 *
 * The router parses nothing itself: every hash resolves through the Context
 * Resolver (js/services/context-resolver.js), which returns the resolved
 * context, a `{ redirect }` to the canonical equivalent of a legacy route,
 * `{ pending: true }` while the Shared Audit State loads, or null. Legacy
 * flat routes, slug hierarchies, and removed workspaces (Requirements →
 * Evidence) redirect internally with `history.replaceState`, so old deep
 * links keep working without polluting history.
 *
 * Route transitions are initiated exclusively through the Navigation Service
 * (js/services/navigation-service.js); this module renders what the hash
 * resolves to. Out of scope by design: workspace content, navigation UI,
 * business logic.
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
   * Element id of the workspace canvas the router renders into — the shell's
   * primary content region and the skip-link target (§130.26).
   */
  var MOUNT_ID = 'workspace-canvas';

  /**
   * Route hashes are namespaced with a leading "#/" so the router can tell a
   * real route from an ordinary in-page anchor (for example the shell's
   * "#workspace-canvas" skip link), which it must leave untouched.
   */
  var ROUTE_HASH_PREFIX = '#/';

  /**
   * Business event announced whenever the active workspace changes. Named as
   * a completed fact (§30.13). Dispatched on `document`; detail carries the
   * workspace identifiers and the resolved context.
   */
  var ROUTE_CHANGED_EVENT = 'auditos:route-changed';

  /** Redirect hops resolved internally before falling back Home (loop safety). */
  var MAX_REDIRECTS = 5;

  // Router state, established during init().
  var mountElement = null;
  var outletElement = null;
  var announcerElement = null;
  var currentWorkspaceId = null;
  var currentRecordId = '';
  var currentContext = null; // The Context Resolver's resolved context.
  var hasActivatedOnce = false;
  var scrollPositions = {}; // workspace id -> last scrollY recorded while leaving it.

  /** Whether a hash value is a router route rather than an in-page anchor. */
  function isRouteHash(hash) {
    return typeof hash === 'string' && hash.indexOf(ROUTE_HASH_PREFIX) === 0;
  }

  /** The Context Resolver, resolved at call time so load order stays flexible. */
  function contextResolver() {
    return AuditOS.contextResolver || null;
  }

  /** The Navigation Service, resolved at call time. */
  function navigationService() {
    return AuditOS.navigationService || null;
  }

  /** Rewrites the URL in place without adding a history entry. */
  function replaceHash(hash) {
    if (global.location.hash !== hash) {
      global.history.replaceState(null, '', hash);
    }
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

    var resolver = contextResolver();
    var navigation = navigationService();
    if (!resolver || !navigation) {
      activateFallback();
      return;
    }

    // An empty hash is the canonical Home route.
    if (!hash) {
      hash = navigation.hrefHome();
    }

    // Resolve, following internal redirects (legacy routes → canonical) with
    // replaceState so no history entries accumulate.
    var result = resolver.resolve(hash);
    var hops = 0;
    while (result && result.redirect && hops < MAX_REDIRECTS) {
      hash = result.redirect;
      replaceHash(hash);
      result = resolver.resolve(hash);
      hops += 1;
    }

    // The state is still loading: keep the URL untouched, show the default
    // workspace host, and re-resolve when the state announces readiness.
    if (result && result.pending) {
      activateWorkspace(registry.findById(registry.DEFAULT_WORKSPACE_ID), false, null);
      return;
    }

    if (result && !result.redirect && result.workspace) {
      replaceHash(hash);
      activateWorkspace(result.workspace, result.isKnownRoute !== false, result);
      return;
    }

    // Unknown or empty route falls back to Home (§130.6).
    activateFallback();
  }

  /** Activates the default workspace on the canonical Home route. */
  function activateFallback() {
    var navigation = navigationService();
    var fallback = registry.findById(registry.DEFAULT_WORKSPACE_ID);
    if (navigation) {
      replaceHash(navigation.hrefHome());
    }
    var resolver = contextResolver();
    var context = resolver ? resolver.resolve(navigation ? navigation.hrefHome() : '#/home') : null;
    activateWorkspace(fallback, false, context && context.workspace ? context : null);
  }

  /** A stable signature of a resolved context for change detection. */
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
   * id, the POC sub-id, and the hierarchy context are all unchanged, so
   * navigating between records, Teams, POCs, or hierarchy scopes within one
   * workspace still republishes the route change.
   */
  function activateWorkspace(workspace, isKnownRoute, context) {
    var normalizedRecordId = (context && context.recordId) || '';
    var normalizedPocId = (context && context.pocId) || '';
    var currentPocId = (currentContext && currentContext.pocId) || '';
    var sameWorkspace = hasActivatedOnce && workspace.id === currentWorkspaceId;
    if (sameWorkspace && normalizedRecordId === currentRecordId &&
        normalizedPocId === currentPocId &&
        contextKey(context) === contextKey(currentContext)) {
      return;
    }

    // Remember where the user was scrolled within the workspace they are
    // leaving, so returning to it (e.g. Back) can restore it. Only recorded
    // on a genuine workspace change, not a record-to-record move.
    if (hasActivatedOnce && !sameWorkspace) {
      scrollPositions[currentWorkspaceId] = global.scrollY;
    }

    var previousWorkspaceId = currentWorkspaceId;
    renderWorkspaceHost(workspace);
    currentWorkspaceId = workspace.id;
    currentRecordId = normalizedRecordId;
    currentContext = context || null;

    // The Context Resolver mirrors the active route — the one place pages
    // read context from.
    var resolver = contextResolver();
    if (resolver && typeof resolver.setCurrent === 'function') {
      resolver.setCurrent(currentContext);
    }

    global.document.title = workspace.title + ' — AuditOS';
    announce(workspace.label);

    // Move focus into the freshly rendered workspace on genuine route changes
    // so keyboard and screen reader users follow the navigation. The first
    // render leaves focus at the top of the document so the skip link remains
    // the entry point (§30.17).
    if (hasActivatedOnce) {
      currentView().focus();
    }
    hasActivatedOnce = true;

    dispatchRouteChanged(workspace, previousWorkspaceId, isKnownRoute, currentRecordId);

    // Land a fresh workspace at the top; restore a remembered scroll position
    // when returning to one, unless a specific record is being deep-linked to.
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
        scope: currentContext ? currentContext.scope : null,
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
     * Wires the router to the shell and renders the initial route. Safe to
     * call once, after the DOM is ready. Does nothing if the workspace canvas
     * is absent, so the shell degrades rather than throwing.
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
      // the real one.
      var state = AuditOS.state;
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, resolveRoute);
      }

      resolveRoute();
    },

    /**
     * Navigates to a registered workspace by identifier within the current
     * context, optionally to one record within it. Retained as a thin
     * compatibility shim — the Navigation Service is the canonical
     * navigation API (Issue #39); this delegates to it.
     */
    navigate: function (workspaceId, recordId) {
      var navigation = navigationService();
      if (!navigation) {
        return;
      }
      var href = navigation.hrefFor(workspaceId, null, recordId);
      if (href) {
        navigation.navigate(href);
      }
    },

    /** Returns the identifier of the currently active workspace. */
    getCurrentWorkspaceId: function () {
      return currentWorkspaceId;
    },

    /**
     * Returns the record id carried by the current route, or "" when the
     * route names no specific record.
     */
    getCurrentRecordId: function () {
      return currentRecordId;
    },

    /**
     * Returns the resolved context of the current route — the Context
     * Resolver's context object (client, program, engagement, workspace,
     * frameworks, audit, permissions, hierarchy, recordId, teamId, pocId),
     * or null before the first resolution.
     */
    getCurrentContext: function () {
      return currentContext;
    }
  };
})(window);
