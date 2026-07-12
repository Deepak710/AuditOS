/**
 * AuditOS Persistent Platform Footer
 * Platform Foundation II — GitHub Issue #34 (Responsive Layout System —
 * persistent footer) / Application Shell — Chapter 114
 *
 * Renders the shell's persistent footer into the workspace host's footer
 * region (index.html). The footer is part of the fixed viewport: the
 * workspace body scrolls independently above it, so it stays visible on
 * every workspace at every scroll position.
 *
 * Presentation only, and honestly data-driven: every value derives from the
 * platform foundations — environment and session mode from the Permission
 * Foundation, demo-data status from the Shared Audit State, the active
 * workspace from the router and registry, and the recorded audit event
 * count from the Platform Audit Service. Nothing is fabricated; values
 * simply stay absent while their foundation is unavailable.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** The workspace host footer region this content mounts into (index.html). */
  var FOOTER_REGION_SELECTOR = '.aos-workspace-host__footer';

  // Established during init().
  var footerRegion = null;

  /** Creates an element with a class and optional text content. */
  function el(tagName, className, textContent) {
    var node = global.document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (textContent) {
      node.textContent = textContent;
    }
    return node;
  }

  /** Builds one labeled footer item. */
  function buildItem(label, value) {
    var item = el('span', 'aos-platform-footer__item');
    item.appendChild(el('span', 'aos-platform-footer__label', label));
    item.appendChild(el('span', 'aos-platform-footer__value', value));
    return item;
  }

  /**
   * Collects the footer facts from the platform foundations. Pure reads;
   * absent foundations yield absent items rather than fabricated values.
   */
  function collectItems() {
    var items = [{ label: 'Environment', value: 'Static prototype' }];

    var permissions = AuditOS.permissions;
    if (permissions && typeof permissions.getSessionInfo === 'function') {
      var info = permissions.getSessionInfo();
      items.push({ label: 'Mode', value: info.mode === 'demo' ? 'Demo Mode' : 'Production' });
      items.push({ label: 'Session', value: info.label });
    }

    var state = AuditOS.state;
    if (state && typeof state.isReady === 'function' && state.isReady()) {
      var status = state.getStatus();
      items.push({
        label: 'Demo data',
        value: status.demoDataLoaded ? 'Loaded' : 'Degraded'
      });
    }

    var router = AuditOS.router;
    var registry = AuditOS.workspaceRegistry;
    if (router && registry) {
      var workspace = registry.findById(router.getCurrentWorkspaceId());
      if (workspace) {
        items.push({ label: 'Workspace', value: workspace.label });
      }
    }

    var auditService = AuditOS.auditService;
    if (auditService && state && state.isReady && state.isReady()) {
      items.push({ label: 'Audit events', value: String(auditService.list().length) });
    }

    return items;
  }

  /** Renders the footer content. */
  function render() {
    var footer = el('footer', 'aos-platform-footer');
    footer.setAttribute('aria-label', 'Platform status');
    collectItems().forEach(function (item) {
      footer.appendChild(buildItem(item.label, item.value));
    });
    footerRegion.replaceChildren(footer);
  }

  AuditOS.platformFooter = {
    /**
     * Renders the persistent footer and binds it to the router, the Shared
     * Audit State, and the Permission Foundation. Safe to call once, after
     * the DOM is ready. Does nothing when the footer region is absent, so
     * the shell degrades rather than throwing.
     */
    init: function () {
      footerRegion = global.document.querySelector(FOOTER_REGION_SELECTOR);
      if (!footerRegion) {
        return;
      }

      var state = AuditOS.state;
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, render);
        state.subscribe(state.EVENTS.STATE_CHANGED, render);
        state.subscribe(state.EVENTS.STATE_RESET, render);
      }

      var router = AuditOS.router;
      if (router) {
        global.document.addEventListener(router.ROUTE_CHANGED_EVENT, render);
      }

      var permissions = AuditOS.permissions;
      if (permissions && typeof permissions.subscribe === 'function') {
        permissions.subscribe(render);
      }

      render();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.platformFooter.init);
    } else {
      AuditOS.platformFooter.init();
    }
  }
})(window);
