/**
 * AuditOS Breadcrumb Navigation Content
 * Navigation & Context Architecture — GitHub Issue #39 / Navigation
 * Components — Chapter 76 (§76.10 Breadcrumbs)
 *
 * Renders the canonical hierarchical breadcrumb into the global header's
 * breadcrumb region:
 *
 *   AuditOS → Client → Engagement → Workspace [→ Team → POC]
 *
 * This component renders only. The trail data comes entirely from the
 * Breadcrumb Generator (js/services/breadcrumb-generator.js), which derives
 * it from the Context Resolver's route context and the Hierarchy Builder's
 * canonical hierarchy — no page-specific breadcrumb logic, no locally
 * derived client/engagement/workspace lists, no URL construction here.
 *
 * Crumb rules (Issue #39): the AuditOS crumb's dropdown lists clients, the
 * client crumb's dropdown lists ONLY that client's engagements, the
 * engagement crumb's dropdown lists ONLY that engagement's workspaces, and
 * the workspace crumb never has a dropdown. Opening a menu never navigates;
 * only selecting a destination does — destinations are real anchors so
 * keyboard, focus, and deep linking work natively.
 *
 * Hover behaviour (Issue #39): no floating menu may render outside the
 * viewport — every opened menu is measured and repositioned (right-aligned
 * and/or height-capped) to stay fully on screen.
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

  /** The header region this content mounts into (index.html). */
  var BREADCRUMB_REGION_SELECTOR = '.aos-global-header__breadcrumb';

  /** Marks the menu destination that is currently active. */
  var ACTIVE_CLASS = 'is-active';

  /** Viewport safety margin (px) for floating menu repositioning. */
  var VIEWPORT_MARGIN = 8;

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

  /** Builds the leading "/" separator of one trail item. */
  function buildSeparator() {
    var separator = el('span', 'aos-breadcrumb__separator', '/');
    separator.setAttribute('aria-hidden', 'true');
    return separator;
  }

  /** Builds one plain crumb: a real anchor to its canonical destination. */
  function buildLinkCrumb(descriptor) {
    var item = el('li', 'aos-breadcrumb__item');
    item.appendChild(buildSeparator());
    var link = el('a', 'aos-breadcrumb__crumb aos-breadcrumb__crumb--link');
    link.setAttribute('href', descriptor.href);
    if (descriptor.current) {
      link.setAttribute('aria-current', 'page');
    }
    link.appendChild(el('span', 'aos-breadcrumb__crumb-label', descriptor.label));
    item.appendChild(link);
    return { item: item };
  }

  /**
   * Builds one menu crumb: a menu button labeled with the current entity
   * plus a role="menu" of anchor destinations. Opening the menu never
   * navigates; selecting one of its real anchors does, through the router's
   * standard hashchange flow.
   */
  function buildMenuCrumb(descriptor) {
    var item = el('li', 'aos-breadcrumb__item');
    item.appendChild(buildSeparator());

    var button = el('button', 'aos-breadcrumb__crumb');
    button.setAttribute('type', 'button');
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', descriptor.label + ' — open ' + descriptor.menu.label.toLowerCase() + ' menu');
    button.appendChild(el('span', 'aos-breadcrumb__crumb-label', descriptor.label));

    var chevron = el('span', 'aos-breadcrumb__chevron');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.appendChild(el('i', 'bi bi-chevron-down'));
    button.appendChild(chevron);
    item.appendChild(button);

    var menu = el('ul', 'aos-breadcrumb__menu');
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', descriptor.menu.label);
    menu.hidden = true;

    descriptor.menu.options.forEach(function (option) {
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

  /**
   * Keeps an opened floating menu fully inside the viewport (Issue #39 —
   * hover behaviour): right-aligns a menu that would overflow the right
   * edge, and caps the height (internal scroll) of one that would overflow
   * the bottom.
   */
  function repositionMenu(menu) {
    menu.classList.remove('aos-breadcrumb__menu--align-end');
    menu.style.maxHeight = '';
    var bounds = menu.getBoundingClientRect();
    var viewportWidth = global.document.documentElement.clientWidth;
    var viewportHeight = global.document.documentElement.clientHeight;
    if (bounds.right > viewportWidth - VIEWPORT_MARGIN) {
      menu.classList.add('aos-breadcrumb__menu--align-end');
    }
    bounds = menu.getBoundingClientRect();
    if (bounds.bottom > viewportHeight - VIEWPORT_MARGIN) {
      menu.style.maxHeight = Math.max(120, viewportHeight - bounds.top - VIEWPORT_MARGIN) + 'px';
      menu.style.overflowY = 'auto';
    }
  }

  /** Opens a crumb's menu (closing any other) and focuses the active destination. */
  function openMenu(crumb) {
    if (openCrumb && openCrumb !== crumb) {
      closeMenu(openCrumb, false);
    }
    crumb.menu.hidden = false;
    crumb.button.setAttribute('aria-expanded', 'true');
    openCrumb = crumb;
    repositionMenu(crumb.menu);
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
   * Renders the complete breadcrumb trail for the current route: the crumb
   * descriptors come from the Breadcrumb Generator over the Context
   * Resolver's current context. Rebuilt whole on every route, state, or
   * session change so the trail always mirrors the URL and the data. The
   * first crumb's leading separator is hidden by the stylesheet.
   */
  function renderTrail() {
    var generator = AuditOS.breadcrumbGenerator;
    var resolver = AuditOS.contextResolver;
    if (!generator || !resolver) {
      return;
    }
    var trail = el('ol', 'aos-breadcrumb');
    // Preserve list semantics for screen readers even though the visual list
    // marker is removed (§76.18 — Accessibility).
    trail.setAttribute('role', 'list');
    openCrumb = null;

    generator.generate(resolver.current()).forEach(function (descriptor) {
      var crumb = descriptor.menu && descriptor.menu.options.length > 0
        ? buildMenuCrumb(descriptor)
        : buildLinkCrumb(descriptor);
      trail.appendChild(crumb.item);
    });

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
     * is ready and the router has initialized. Does nothing when the router
     * or breadcrumb region is absent, so the shell degrades rather than
     * throwing.
     */
    init: function () {
      var router = AuditOS.router;
      if (!router) {
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
      // switches (Demo Mode role switching).
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
