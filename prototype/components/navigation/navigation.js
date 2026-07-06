/**
 * AuditOS Breadcrumb Navigation Content
 * Navigation Components — Chapter 76 (§76.10 Breadcrumbs) / Routing
 * Architecture — Chapter 130 / Application Shell optimization (Issue #16)
 *
 * Connects the header's breadcrumb navigation to the Static Routing
 * Foundation. It renders the breadcrumb trail into the global header's
 * breadcrumb region: the workspace crumb names the active workspace and
 * doubles as the workspace switcher — a menu of every registered workspace
 * (Visual Studio style). It renders and invokes routes only — it owns no
 * workspace content, Shared Audit State, Business Objects, or business logic.
 *
 * The router remains the single source of truth: destinations are derived
 * from the Workspace Registry (never redefined here), route changes are
 * driven by the router, and the active crumb follows the route rather than
 * the click. Selecting a destination sets the router's canonical route hash,
 * so the router's existing hashchange flow performs the actual navigation,
 * focus, and announcement (Routing Architecture §130.28 — URL Design
 * Principles).
 *
 * Accessibility: the switcher is a real button carrying aria-haspopup /
 * aria-expanded; the menu is a role="menu" of anchor menuitems with roving
 * arrow-key focus, Home/End support, and Escape returning focus to the
 * crumb. Destinations are real anchors so keyboard, focus, and deep linking
 * work natively.
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
   * CSS selector for the header region this content mounts into — the
   * breadcrumb region of the Global Header (index.html).
   */
  var BREADCRUMB_REGION_SELECTOR = '.aos-global-header__breadcrumb';

  /**
   * Canonical route hash prefix. Mirrors the router's documented URL contract
   * ("#/{path}", Routing Architecture §130.28) so each destination is a real,
   * deep-linkable anchor. The router resolves the resulting hash; this content
   * never resolves routes itself.
   */
  var ROUTE_HASH_PREFIX = '#/';

  /** Marks the menu destination whose workspace is currently active. */
  var ACTIVE_CLASS = 'is-active';

  // Established during init().
  var breadcrumbRegion = null;
  var crumbButton = null;
  var crumbLabel = null;
  var menuElement = null;
  var linksByWorkspaceId = {};

  /** Builds the canonical route hash for a workspace destination. */
  function toRouteHash(workspace) {
    return ROUTE_HASH_PREFIX + workspace.path;
  }

  /** Creates an element with a class and optional text content. */
  function el(tagName, className, textContent) {
    var node = global.document.createElement(tagName);
    node.className = className;
    if (textContent) {
      node.textContent = textContent;
    }
    return node;
  }

  /**
   * Renders the breadcrumb trail: a leading separator after the brand, then
   * the workspace crumb (switcher button) and its workspace menu. Future
   * issues append deeper crumbs as additional trail items.
   */
  function renderBreadcrumb() {
    var trail = el('ol', 'aos-breadcrumb');
    // Preserve list semantics for screen readers even though the visual list
    // marker is removed (Navigation Components §76.18 — Accessibility).
    trail.setAttribute('role', 'list');

    var item = el('li', 'aos-breadcrumb__item');

    var separator = el('span', 'aos-breadcrumb__separator', '/');
    separator.setAttribute('aria-hidden', 'true');
    item.appendChild(separator);

    crumbButton = el('button', 'aos-breadcrumb__crumb');
    crumbButton.setAttribute('type', 'button');
    crumbButton.setAttribute('aria-haspopup', 'menu');
    crumbButton.setAttribute('aria-expanded', 'false');
    crumbButton.setAttribute('aria-label', 'Switch workspace');

    crumbLabel = el('span', 'aos-breadcrumb__crumb-label');
    crumbButton.appendChild(crumbLabel);

    var chevron = el('span', 'aos-breadcrumb__chevron');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.appendChild(el('i', 'bi bi-chevron-down'));
    crumbButton.appendChild(chevron);
    item.appendChild(crumbButton);

    item.appendChild(renderMenu());
    trail.appendChild(item);
    breadcrumbRegion.replaceChildren(trail);
  }

  /** Renders the workspace menu — one destination per registered workspace. */
  function renderMenu() {
    menuElement = el('ul', 'aos-breadcrumb__menu');
    menuElement.setAttribute('role', 'menu');
    menuElement.setAttribute('aria-label', 'Workspaces');
    menuElement.hidden = true;

    registry.WORKSPACES.forEach(function (workspace) {
      var item = el('li', '');
      item.setAttribute('role', 'none');

      var link = el('a', 'aos-breadcrumb__option');
      link.setAttribute('role', 'menuitem');
      link.setAttribute('href', toRouteHash(workspace));
      link.setAttribute('data-workspace-id', workspace.id);
      link.appendChild(el('span', 'aos-breadcrumb__option-label', workspace.label));

      var check = el('span', 'aos-breadcrumb__option-check');
      check.setAttribute('aria-hidden', 'true');
      link.appendChild(check);

      item.appendChild(link);
      menuElement.appendChild(item);
      linksByWorkspaceId[workspace.id] = link;
    });

    return menuElement;
  }

  /** Returns the menu's destination anchors in registry order. */
  function menuLinks() {
    return Array.prototype.slice.call(
      menuElement.querySelectorAll('.aos-breadcrumb__option')
    );
  }

  /** Opens the workspace menu and moves focus to the active destination. */
  function openMenu() {
    menuElement.hidden = false;
    crumbButton.setAttribute('aria-expanded', 'true');
    var links = menuLinks();
    var active = links.filter(function (link) {
      return link.classList.contains(ACTIVE_CLASS);
    })[0];
    (active || links[0]).focus();
  }

  /** Closes the workspace menu, optionally returning focus to the crumb. */
  function closeMenu(restoreFocus) {
    if (menuElement.hidden) {
      return;
    }
    menuElement.hidden = true;
    crumbButton.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      crumbButton.focus();
    }
  }

  /** Toggles the workspace menu from the crumb button. */
  function handleCrumbClick() {
    if (menuElement.hidden) {
      openMenu();
    } else {
      closeMenu(true);
    }
  }

  /** Arrow-key roving focus, Home/End, and Escape within the menu. */
  function handleMenuKeydown(event) {
    var links = menuLinks();
    var index = links.indexOf(global.document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      links[(index + 1) % links.length].focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      links[(index - 1 + links.length) % links.length].focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      links[0].focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      links[links.length - 1].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === 'Tab') {
      closeMenu(false);
    }
  }

  /** ArrowDown on the closed crumb opens the menu (menu-button pattern). */
  function handleCrumbKeydown(event) {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && menuElement.hidden) {
      event.preventDefault();
      openMenu();
    } else if (event.key === 'Escape') {
      closeMenu(true);
    }
  }

  /** Closes the menu when the interaction leaves the breadcrumb. */
  function handleDocumentPointerDown(event) {
    if (!breadcrumbRegion.contains(event.target)) {
      closeMenu(false);
    }
  }

  /**
   * Reflects the active route on the breadcrumb: the crumb label carries the
   * active workspace's registry label, and the matching menu destination
   * carries `aria-current="page"`, the active class, and the check glyph.
   * A null or unknown id simply clears every destination.
   */
  function setActiveWorkspace(workspaceId) {
    var workspace = registry.findById(workspaceId);
    crumbLabel.textContent = workspace ? workspace.label : '';
    if (workspace) {
      crumbButton.setAttribute('aria-label',
        'Current workspace: ' + workspace.label + ' — switch workspace');
    }

    Object.keys(linksByWorkspaceId).forEach(function (id) {
      var link = linksByWorkspaceId[id];
      var isActive = id === workspaceId;
      link.classList.toggle(ACTIVE_CLASS, isActive);
      link.querySelector('.aos-breadcrumb__option-check').textContent = isActive ? '✓' : '';
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  /** Follows the router: update the crumb and close the menu on navigation. */
  function handleRouteChanged(event) {
    setActiveWorkspace(event.detail.workspaceId);
    closeMenu(false);
  }

  AuditOS.navigation = {
    /**
     * Renders the breadcrumb and binds it to the router. Safe to call once,
     * after the DOM is ready and the router has initialized. Does nothing
     * when the registry, router, or breadcrumb region is absent, so the
     * shell degrades rather than throwing.
     */
    init: function () {
      if (!registry || !router) {
        return;
      }

      breadcrumbRegion = global.document.querySelector(BREADCRUMB_REGION_SELECTOR);
      if (!breadcrumbRegion) {
        return;
      }

      renderBreadcrumb();

      crumbButton.addEventListener('click', handleCrumbClick);
      crumbButton.addEventListener('keydown', handleCrumbKeydown);
      menuElement.addEventListener('keydown', handleMenuKeydown);
      global.document.addEventListener('pointerdown', handleDocumentPointerDown);

      // Follow every future route change, then sync to the route the router
      // has already resolved during its own initialization.
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
