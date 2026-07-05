/**
 * AuditOS Shared Workspace Framework Renderer
 * Workspace Design System — Chapter 15 / Layout Components — Chapter 75
 *
 * The permanent rendering engine of AuditOS. On every route change it renders
 * the Universal Workspace Structure (§15.3) — workspace header, context
 * ribbon, primary content, supporting panels, and footer / status — into the
 * workspace host the Static Router has just mounted, so every workspace,
 * present and future, inherits the same internal skeleton instead of
 * inventing its own.
 *
 * The framework owns layout only. Every slot it renders is an empty, reserved
 * mount point for later workspace issues; the single piece of text it
 * populates is the workspace title, read from the Workspace Registry — the
 * same navigation identity the router already uses for the document title and
 * the accessible route announcement. Business content belongs exclusively to
 * demo-data and never lives in this framework.
 *
 * The router remains the single source of truth: this renderer consumes the
 * router's public route-changed event and the registry's public lookups. It
 * performs no routing, focus management, or announcements of its own.
 *
 * The markup produced here mirrors workspace-framework.html — the canonical
 * template for the framework structure. Keep the two in sync.
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
   * CSS selector for the workspace host the Static Router renders on each
   * route change. The framework fills this host; it never creates, replaces,
   * or removes the host itself.
   */
  var VIEW_SELECTOR = '.aos-workspace-view';

  /**
   * The universal supporting panels of §15.7 in canonical order: Related
   * Information (§15.9), AI Recommendations (§15.8), and Activity (§15.10).
   * Their titles are the fixed structural names of the Workspace Design
   * System — identical in every workspace — not workspace content.
   */
  var SUPPORTING_PANELS = [
    { region: 'related-information', modifier: 'related', title: 'Related information' },
    { region: 'ai-recommendations', modifier: 'ai', title: 'AI recommendations' },
    { region: 'activity', modifier: 'activity', title: 'Activity' }
  ];

  /** Creates an element with a class and optional data-region / data-slot. */
  function createRegion(tagName, className, regionName, slotName) {
    var element = global.document.createElement(tagName);
    element.className = className;
    if (regionName) {
      element.setAttribute('data-region', regionName);
    }
    if (slotName) {
      element.setAttribute('data-slot', slotName);
    }
    return element;
  }

  /**
   * Builds the workspace header (§15.4). The title carries the workspace's
   * registry label; the eyebrow, meta, and actions slots stay empty — they are
   * reserved for client / engagement / period, phase / status, and global
   * actions / search / AI availability owned by later workspace issues. Empty
   * slots collapse visually via the framework stylesheet.
   */
  function buildHeader(workspace) {
    var header = createRegion('header', 'aos-workspace-framework__header', 'workspace-header');

    var orientation = createRegion('div', 'aos-workspace-framework__orientation');
    orientation.appendChild(createRegion('p', 'aos-workspace-framework__eyebrow', null, 'workspace-eyebrow'));

    var title = createRegion('h1', 'aos-workspace-framework__title', null, 'workspace-title');
    title.textContent = workspace.label;
    orientation.appendChild(title);

    orientation.appendChild(createRegion('p', 'aos-workspace-framework__meta', null, 'workspace-meta'));
    header.appendChild(orientation);

    header.appendChild(createRegion('div', 'aos-workspace-framework__actions', null, 'workspace-actions'));
    return header;
  }

  /**
   * Builds the context ribbon (§15.5) — the reserved strip for operational
   * context that travels with the user. Empty until later issues populate it;
   * the stylesheet hides the empty strip.
   */
  function buildRibbon() {
    var ribbon = createRegion('div', 'aos-workspace-framework__ribbon', 'context-ribbon', 'context-ribbon');
    ribbon.setAttribute('role', 'group');
    ribbon.setAttribute('aria-label', 'Workspace context');
    return ribbon;
  }

  /**
   * Builds the primary content region (§15.6) — the operational focus of the
   * workspace. It dominates the layout; its slot is the canvas later
   * workspace issues render into.
   */
  function buildContent() {
    var content = createRegion('section', 'aos-workspace-framework__content', 'primary-content', 'primary-content');
    content.setAttribute('aria-label', 'Primary content');
    return content;
  }

  /** Builds one universal supporting panel: titled header plus empty body slot. */
  function buildPanel(panel) {
    var section = createRegion(
      'section',
      'aos-workspace-framework__panel aos-workspace-framework__' + panel.modifier,
      panel.region
    );
    section.setAttribute('aria-label', panel.title);

    var header = createRegion('header', 'aos-workspace-framework__panel-header');
    var heading = createRegion('h2', 'aos-workspace-framework__panel-title');
    heading.textContent = panel.title;
    header.appendChild(heading);
    section.appendChild(header);

    section.appendChild(createRegion('div', 'aos-workspace-framework__panel-body', null, panel.region));
    return section;
  }

  /** Builds the supporting panels band (§15.7): three equal panel columns. */
  function buildPanels() {
    var panels = createRegion('div', 'aos-workspace-framework__panels', 'supporting-panels');
    SUPPORTING_PANELS.forEach(function (panel) {
      panels.appendChild(buildPanel(panel));
    });
    return panels;
  }

  /** Builds the footer / status region. Empty and hidden until populated. */
  function buildFooter() {
    return createRegion('footer', 'aos-workspace-framework__footer', 'workspace-footer', 'workspace-footer');
  }

  /** Builds the complete Universal Workspace Structure for a workspace. */
  function buildFramework(workspace) {
    var framework = createRegion('article', 'aos-workspace-framework', 'workspace-framework');
    framework.appendChild(buildHeader(workspace));
    framework.appendChild(buildRibbon());
    framework.appendChild(buildContent());
    framework.appendChild(buildPanels());
    framework.appendChild(buildFooter());
    return framework;
  }

  /**
   * Renders the framework skeleton for a workspace into a host element,
   * replacing whatever the host currently contains. Exposed so later
   * workspace issues can mount the framework wherever a workspace surface
   * exists.
   */
  function render(hostElement, workspace) {
    hostElement.replaceChildren(buildFramework(workspace));
  }

  /**
   * Renders the framework into the workspace host the router has mounted for
   * a workspace. Does nothing when the workspace or its host is absent, so
   * the shell degrades rather than throwing.
   */
  function renderActiveWorkspace(workspaceId) {
    var workspace = registry.findById(workspaceId);
    if (!workspace) {
      return;
    }

    var view = global.document.querySelector(
      VIEW_SELECTOR + '[data-workspace="' + workspace.id + '"]'
    );
    if (!view) {
      return;
    }

    render(view, workspace);
  }

  /** Renders the framework whenever the router changes the route. */
  function handleRouteChanged(event) {
    renderActiveWorkspace(event.detail.workspaceId);
  }

  AuditOS.workspaceFramework = {
    render: render,

    /**
     * Binds the framework renderer to the router. Safe to call once, after
     * the DOM is ready and the router has initialized. Does nothing when the
     * registry or router is absent, so the shell degrades rather than
     * throwing.
     */
    init: function () {
      if (!registry || !router) {
        return;
      }

      // Follow every future route change, then render into the route the
      // router has already resolved during its own initialization.
      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, handleRouteChanged);
      renderActiveWorkspace(router.getCurrentWorkspaceId());
    }
  };

  // Self-initialize after the DOM is ready. The bootstrap initializes the
  // router first (its listener is registered earlier), so the current route
  // is resolved by the time this runs.
  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', AuditOS.workspaceFramework.init);
  } else {
    AuditOS.workspaceFramework.init();
  }
})(window);
