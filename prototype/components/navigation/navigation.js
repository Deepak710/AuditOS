/**
 * AuditOS Navigation Content
 * Navigation Components — Chapter 76 / Routing Architecture — Chapter 130
 *
 * Connects the Left Navigation Foundation to the Static Routing Foundation.
 * It renders one primary destination per registered workspace into the
 * navigation's primary region and keeps the active destination in step with
 * the current route. It renders and invokes routes only — it owns no workspace
 * content, Shared Audit State, Business Objects, or business logic.
 *
 * The router remains the single source of truth: destinations are derived from
 * the Workspace Registry (never redefined here), route changes are driven by
 * the router, and the active destination follows the route rather than the
 * click. Selecting a destination sets the router's canonical route hash, so the
 * router's existing hashchange flow performs the actual navigation, focus, and
 * announcement (Routing Architecture §130.28 — URL Design Principles).
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step, module loader, or
 * dynamic imports.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};
  var registry = AuditOS.workspaceRegistry;
  var router = AuditOS.router;

  /**
   * CSS selector for the navigation region this content mounts into — the
   * primary-navigation region of the Left Navigation Foundation. Secondary,
   * utility, and collapse regions stay empty for later issues.
   */
  var PRIMARY_REGION_SELECTOR = '.aos-nav__primary';

  /**
   * Canonical route hash prefix. Mirrors the router's documented URL contract
   * ("#/{path}", Routing Architecture §130.28) so each destination is a real,
   * deep-linkable anchor. The router resolves the resulting hash; this content
   * never resolves routes itself.
   */
  var ROUTE_HASH_PREFIX = '#/';

  /** Marks the destination whose workspace is currently active. */
  var ACTIVE_CLASS = 'is-active';

  // Established during init().
  var primaryRegion = null;
  var linksByWorkspaceId = {};

  /** Builds the canonical route hash for a workspace destination. */
  function toRouteHash(workspace) {
    return ROUTE_HASH_PREFIX + workspace.path;
  }

  /**
   * Renders one destination per registered workspace, in registry order, into
   * the primary navigation region. Destinations are anchors so keyboard, focus,
   * and deep linking work natively; the router handles the resulting hash.
   */
  function renderDestinations() {
    var list = global.document.createElement('ul');
    list.className = 'aos-nav__list';
    // Preserve list semantics for screen readers even though the visual list
    // marker is removed (Navigation Components §76.18 — Accessibility).
    list.setAttribute('role', 'list');

    registry.WORKSPACES.forEach(function (workspace) {
      list.appendChild(createDestination(workspace));
    });

    primaryRegion.replaceChildren(list);
  }

  /** Creates a single navigation destination item for a workspace. */
  function createDestination(workspace) {
    var item = global.document.createElement('li');
    item.className = 'aos-nav__item';

    var link = global.document.createElement('a');
    link.className = 'aos-nav__link';
    link.setAttribute('href', toRouteHash(workspace));
    link.setAttribute('data-workspace-id', workspace.id);

    var label = global.document.createElement('span');
    label.className = 'aos-nav__label';
    label.textContent = workspace.label;
    link.appendChild(label);

    item.appendChild(link);
    linksByWorkspaceId[workspace.id] = link;
    return item;
  }

  /**
   * Reflects the active route on the destinations. The matching destination
   * carries `aria-current="page"` and the active class; all others are cleared.
   * A null or unknown id simply clears every destination.
   */
  function setActiveWorkspace(workspaceId) {
    Object.keys(linksByWorkspaceId).forEach(function (id) {
      var link = linksByWorkspaceId[id];
      var isActive = id === workspaceId;
      link.classList.toggle(ACTIVE_CLASS, isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  /** Updates the active destination whenever the router changes the route. */
  function handleRouteChanged(event) {
    setActiveWorkspace(event.detail.workspaceId);
  }

  AuditOS.navigation = {
    /**
     * Renders the navigation destinations and binds them to the router. Safe to
     * call once, after the DOM is ready and the router has initialized. Does
     * nothing when the registry, router, or navigation region is absent, so the
     * shell degrades rather than throwing.
     */
    init: function () {
      if (!registry || !router) {
        return;
      }

      primaryRegion = global.document.querySelector(PRIMARY_REGION_SELECTOR);
      if (!primaryRegion) {
        return;
      }

      renderDestinations();

      // Follow every future route change, then sync to the route the router has
      // already resolved during its own initialization.
      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, handleRouteChanged);
      setActiveWorkspace(router.getCurrentWorkspaceId());
    }
  };

  // Self-initialize after the DOM is ready. The bootstrap initializes the router
  // first (its listener is registered earlier), so the current route is resolved
  // by the time this runs.
  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', AuditOS.navigation.init);
  } else {
    AuditOS.navigation.init();
  }
})(window);
