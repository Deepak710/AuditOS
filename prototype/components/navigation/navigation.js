/**
 * AuditOS Breadcrumb Navigation Content
 * Navigation Components — Chapter 76 (§76.10 Breadcrumbs) / Routing
 * Architecture — Chapter 130 / Platform Foundation II — GitHub Issue #34
 * (Breadcrumb Architecture)
 *
 * Renders the Repository-driven hierarchical breadcrumb into the global
 * header's breadcrumb region:
 *
 *   Home → Client → Engagement → Workspace
 *
 * Every crumb is interactive. The client crumb opens a menu of the clients
 * the session may access, the engagement crumb a menu of that client's
 * accessible engagements, and the workspace crumb the workspace switcher —
 * all resolved live from the Repository Foundation and the Workspace
 * Registry, never fabricated. Opening a menu never navigates; only selecting
 * a destination does. The trail always mirrors the URL: flat routes render
 * Home and the workspace crumb; hierarchical routes add the client and
 * engagement crumbs the route carries.
 *
 * The router remains the single source of truth: destinations are derived
 * from the Workspace Registry and the Repository's routing slugs (never
 * redefined here), route changes are driven by the router, and the active
 * crumb follows the route rather than the click. Destinations are real
 * anchors so keyboard, focus, and deep linking work natively.
 *
 * Accessibility: each crumb with a menu is a real button carrying
 * aria-haspopup / aria-expanded; each menu is a role="menu" of anchor
 * menuitems with roving arrow-key focus, Home/End support, and Escape
 * returning focus to its crumb.
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
   * so each destination is a real, deep-linkable anchor. The router resolves
   * the resulting hash; this content never resolves routes itself.
   */
  var ROUTE_HASH_PREFIX = '#/';

  /** Marks the menu destination that is currently active. */
  var ACTIVE_CLASS = 'is-active';

  // Established during init().
  var breadcrumbRegion = null;
  var openCrumb = null; // The crumb whose menu is currently open, if any.

  /** Creates an element with a class and optional text content. */
  function el(tagName, className, textContent) {
    var node = global.document.createElement(tagName);
    node.className = className;
    if (textContent) {
      node.textContent = textContent;
    }
    return node;
  }

  /** The Repository Foundation, resolved at render time. */
  function repository() {
    return AuditOS.repository || null;
  }

  /** Builds the leading "/" separator of one trail item. */
  function buildSeparator() {
    var separator = el('span', 'aos-breadcrumb__separator', '/');
    separator.setAttribute('aria-hidden', 'true');
    return separator;
  }

  /**
   * Builds one interactive crumb: a menu button labeled with the current
   * entity plus a role="menu" of anchor destinations. `descriptor` is
   * `{ label, ariaLabel, menuLabel, options: [{ label, href, active }] }`.
   * Opening the menu never navigates; selecting one of its real anchors
   * does, through the router's standard hashchange flow.
   */
  function buildMenuCrumb(descriptor) {
    var item = el('li', 'aos-breadcrumb__item');
    item.appendChild(buildSeparator());

    var button = el('button', 'aos-breadcrumb__crumb');
    button.setAttribute('type', 'button');
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', descriptor.ariaLabel);
    button.appendChild(el('span', 'aos-breadcrumb__crumb-label', descriptor.label));

    var chevron = el('span', 'aos-breadcrumb__chevron');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.appendChild(el('i', 'bi bi-chevron-down'));
    button.appendChild(chevron);
    item.appendChild(button);

    var menu = el('ul', 'aos-breadcrumb__menu');
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', descriptor.menuLabel);
    menu.hidden = true;

    descriptor.options.forEach(function (option) {
      var entry = el('li', '');
      entry.setAttribute('role', 'none');

      var link = el('a', 'aos-breadcrumb__option' + (option.active ? ' ' + ACTIVE_CLASS : ''));
      link.setAttribute('role', 'menuitem');
      link.setAttribute('href', option.href);
      link.appendChild(el('span', 'aos-breadcrumb__option-label', option.label));

      var check = el('span', 'aos-breadcrumb__option-check');
      check.setAttribute('aria-hidden', 'true');
      check.textContent = option.active ? '✓' : '';
      link.appendChild(check);
      if (option.active) {
        link.setAttribute('aria-current', 'page');
      }

      entry.appendChild(link);
      menu.appendChild(entry);
    });
    item.appendChild(menu);

    var crumb = { item: item, button: button, menu: menu };
    wireCrumbInteractions(crumb);
    return crumb;
  }

  /** The menu's destination anchors, in order. */
  function menuLinks(menu) {
    return Array.prototype.slice.call(menu.querySelectorAll('.aos-breadcrumb__option'));
  }

  /** Opens a crumb's menu (closing any other) and focuses the active destination. */
  function openMenu(crumb) {
    if (openCrumb && openCrumb !== crumb) {
      closeMenu(openCrumb, false);
    }
    crumb.menu.hidden = false;
    crumb.button.setAttribute('aria-expanded', 'true');
    openCrumb = crumb;
    var links = menuLinks(crumb.menu);
    var active = links.filter(function (link) {
      return link.classList.contains(ACTIVE_CLASS);
    })[0];
    if (links.length > 0) {
      (active || links[0]).focus();
    }
  }

  /** Closes a crumb's menu, optionally returning focus to its button. */
  function closeMenu(crumb, restoreFocus) {
    if (!crumb || crumb.menu.hidden) {
      return;
    }
    crumb.menu.hidden = true;
    crumb.button.setAttribute('aria-expanded', 'false');
    if (openCrumb === crumb) {
      openCrumb = null;
    }
    if (restoreFocus) {
      crumb.button.focus();
    }
  }

  /** Wires the menu-button interaction pattern onto one crumb. */
  function wireCrumbInteractions(crumb) {
    crumb.button.addEventListener('click', function () {
      if (crumb.menu.hidden) {
        openMenu(crumb);
      } else {
        closeMenu(crumb, true);
      }
    });

    crumb.button.addEventListener('keydown', function (event) {
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && crumb.menu.hidden) {
        event.preventDefault();
        openMenu(crumb);
      } else if (event.key === 'Escape') {
        closeMenu(crumb, true);
      }
    });

    crumb.menu.addEventListener('keydown', function (event) {
      var links = menuLinks(crumb.menu);
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
        closeMenu(crumb, true);
      } else if (event.key === 'Tab') {
        closeMenu(crumb, false);
      }
    });
  }

  /**
   * The workspaces the current session may navigate to (Issue #33 §5): an
   * entry that declares a `capability` the Permission Foundation does not
   * grant is hidden entirely — never rendered as a disabled destination.
   * When the Permission Foundation is absent the menu degrades open rather
   * than throwing.
   */
  function visibleWorkspaces() {
    var permissions = AuditOS.permissions;
    return registry.WORKSPACES.filter(function (workspace) {
      return !workspace.capability || !permissions || permissions.can(workspace.capability);
    });
  }

  /** The route hash of a workspace within the current hierarchy context. */
  function workspaceHref(workspace, context) {
    var repositoryService = repository();
    if (context && context.engagement && repositoryService) {
      var base = ROUTE_HASH_PREFIX +
        repositoryService.clientSlug(context.client) + '/' +
        repositoryService.engagementSlug(context.engagement);
      if (workspace.id === registry.IDS.ENGAGEMENT) {
        return base;
      }
      return base + '/' + workspace.path;
    }
    return ROUTE_HASH_PREFIX + workspace.path;
  }

  /** Builds the Home crumb — a plain link to the AuditOS Home workspace. */
  function buildHomeCrumb() {
    var item = el('li', 'aos-breadcrumb__item');
    var home = registry.findById(registry.DEFAULT_WORKSPACE_ID);
    var link = el('a', 'aos-breadcrumb__crumb aos-breadcrumb__crumb--home');
    link.setAttribute('href', ROUTE_HASH_PREFIX + home.path);
    link.setAttribute('aria-label', 'Home — ' + home.label);
    link.appendChild(el('span', 'aos-breadcrumb__crumb-label', 'Home'));
    item.appendChild(link);
    return item;
  }

  /**
   * Renders the complete breadcrumb trail for the current route: Home, then
   * the client crumb (accessible clients), then — within a client — the
   * engagement crumb (that client's accessible engagements), then the
   * workspace crumb (the visible workspace switcher). Rebuilt whole on every
   * route, state, or session change so the trail always mirrors the URL and
   * the data.
   */
  function renderTrail() {
    var trail = el('ol', 'aos-breadcrumb');
    // Preserve list semantics for screen readers even though the visual list
    // marker is removed (Navigation Components §76.18 — Accessibility).
    trail.setAttribute('role', 'list');
    openCrumb = null;

    trail.appendChild(buildHomeCrumb());

    var context = router.getCurrentContext ? router.getCurrentContext() : null;
    var repositoryService = repository();
    var workspaceId = router.getCurrentWorkspaceId();
    var workspace = registry.findById(workspaceId);

    // Client crumb — rendered from the Repository once it is ready; a trail
    // without data degrades to Home + workspace rather than fabricating.
    if (repositoryService && repositoryService.isReady()) {
      var clients = repositoryService.listAccessibleClients();
      if (clients.length > 0) {
        var activeClient = context && context.client ? context.client : null;
        trail.appendChild(buildMenuCrumb({
          label: activeClient ? activeClient.name : 'Clients',
          ariaLabel: activeClient
            ? 'Current client: ' + activeClient.name + ' — switch client'
            : 'Select a client',
          menuLabel: 'Clients',
          options: clients.map(function (client) {
            return {
              label: client.name,
              href: ROUTE_HASH_PREFIX + repositoryService.clientSlug(client),
              active: Boolean(activeClient && activeClient.id === client.id)
            };
          })
        }).item);
      }

      // Engagement crumb (Issue #35 §2) — only once an engagement has
      // actually been selected, never a placeholder "Select an engagement"
      // crumb for a client with no engagement in context yet: the trail
      // mirrors the URL, and a depth-1 client route carries no engagement.
      if (context && context.client && context.engagement) {
        var engagements = repositoryService.listAccessibleEngagements(context.client.id);
        var activeEngagement = context.engagement;
        var clientSlug = repositoryService.clientSlug(context.client);
        trail.appendChild(buildMenuCrumb({
          label: activeEngagement.name || activeEngagement.id,
          ariaLabel: 'Current engagement: ' + (activeEngagement.name || activeEngagement.id) + ' — switch engagement',
          menuLabel: 'Engagements',
          options: engagements.map(function (engagement) {
            return {
              label: engagement.name || engagement.id,
              href: ROUTE_HASH_PREFIX + clientSlug + '/' + repositoryService.engagementSlug(engagement),
              active: Boolean(activeEngagement.id === engagement.id)
            };
          })
        }).item);
      }
    }

    // Workspace crumb — the switcher over every visible registered
    // workspace. Suppressed while the active workspace is the Client
    // Workspace itself (Issue #35 §2): the client crumb above already names
    // that identity, so a trailing "Client Workspace" crumb would only
    // repeat it. Once an engagement is selected the active workspace is
    // never the Client Workspace, so this crumb reappears automatically.
    if (!workspace || workspace.id !== registry.IDS.CLIENT) {
      trail.appendChild(buildMenuCrumb({
        label: workspace ? workspace.label : '',
        ariaLabel: workspace
          ? 'Current workspace: ' + workspace.label + ' — switch workspace'
          : 'Switch workspace',
        menuLabel: 'Workspaces',
        options: visibleWorkspaces().map(function (entry) {
          return {
            label: entry.label,
            href: workspaceHref(entry, context),
            active: Boolean(workspace && workspace.id === entry.id)
          };
        })
      }).item);
    }

    breadcrumbRegion.replaceChildren(trail);
  }

  /** Closes any open menu when the interaction leaves the breadcrumb. */
  function handleDocumentPointerDown(event) {
    if (openCrumb && !breadcrumbRegion.contains(event.target)) {
      closeMenu(openCrumb, false);
    }
  }

  AuditOS.navigation = {
    /**
     * Renders the breadcrumb and binds it to the router, the Shared Audit
     * State, and the Permission Foundation. Safe to call once, after the DOM
     * is ready and the router has initialized. Does nothing when the
     * registry, router, or breadcrumb region is absent, so the shell
     * degrades rather than throwing.
     */
    init: function () {
      if (!registry || !router) {
        return;
      }

      breadcrumbRegion = global.document.querySelector(BREADCRUMB_REGION_SELECTOR);
      if (!breadcrumbRegion) {
        return;
      }

      global.document.addEventListener('pointerdown', handleDocumentPointerDown);

      // Follow every future route change, then sync to the route the router
      // has already resolved during its own initialization.
      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderTrail);

      // The client and engagement menus read the Repository, so the trail
      // re-renders when the state becomes ready or resets.
      var state = AuditOS.state;
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderTrail);
        state.subscribe(state.EVENTS.STATE_RESET, renderTrail);
      }

      // Workspace visibility is capability-gated; the trail follows session
      // switches (Issue #34 — Demo Mode role switching).
      var permissions = AuditOS.permissions;
      if (permissions && typeof permissions.subscribe === 'function') {
        permissions.subscribe(renderTrail);
      }

      renderTrail();
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
