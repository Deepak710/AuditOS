/**
 * AuditOS Shared Workspace Framework Renderer
 * Workspace Design System — Chapter 15 / Layout Components — Chapter 75 /
 * Component Design Patterns — Chapter 81
 *
 * The permanent rendering engine of AuditOS. On every route change it renders
 * the Universal Workspace Structure (§15.3) — workspace header, context
 * summary, toolbar, filter bar, workspace actions, primary content, supporting
 * panels, and footer / status — into the workspace host the Static Router has
 * just mounted, so every workspace, present and future, inherits the same
 * internal skeleton instead of inventing its own.
 *
 * The framework owns layout only. On a plain route change it renders an empty
 * skeleton whose only populated text is the workspace title, read from the
 * Workspace Registry (navigation identity, not business content). Every other
 * region is an empty, reserved mount point; regions that stay empty collapse
 * via the stylesheet so the page stays clean.
 *
 * Configurable sections (Issue #17). A workspace configures its inherited
 * skeleton with a single declarative descriptor rather than re-inventing the
 * page structure:
 *
 *   workspaceFramework.render(host, workspace, config)   // render + configure
 *   workspaceFramework.configure(host, config)           // configure in place
 *
 * The configuration describes the header (title, description, engagement,
 * framework badges, status badge, last updated, actions), the context summary
 * strip, the toolbar (search, filter, sort, view, refresh, export — each
 * individually visible or not), the filter bar (chips and dropdowns), and the
 * workspace action area (add, import, export, generate, create). Every region
 * is composed from the Shared Enterprise Component Library — Search Field,
 * Select, Chip, Status Badge, Button, Toolbar Group, Action Group, Empty State,
 * Loading State — never bespoke UI. The framework contributes only the
 * region layout. It holds no business logic and no business content: the
 * configuration values are supplied by the workspace, which reads them from the
 * Shared Audit State. AI surfaces remain reserved presentation regions only —
 * AI stays advisory and human approval remains mandatory.
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

  /** Framework slot names (mirrors the data-slot mount points in the template). */
  var SLOTS = {
    EYEBROW: 'workspace-eyebrow',
    TITLE: 'workspace-title',
    META: 'workspace-meta',
    HEADER_ACTIONS: 'workspace-actions',
    CONTEXT: 'context-ribbon',
    TOOLBAR: 'workspace-toolbar',
    FILTERS: 'workspace-filters',
    ACTION_BAR: 'workspace-action-bar',
    CONTENT: 'primary-content'
  };

  /**
   * Loading-skeleton compositions (§15.12 Loading / Issue #17 §8) for the
   * common content shapes: tables, cards, lists, forms, and detail panels.
   * Each is an ordered list of Skeleton component variants; the framework owns
   * the composition, never new skeleton chrome. `detail` is the fallback.
   */
  var LOADING_TEMPLATES = {
    table: ['title', 'text', 'text', 'text', 'text', 'text'],
    cards: ['block', 'block', 'block'],
    list: ['text', 'text', 'text', 'text'],
    form: ['title', 'text', 'text', 'text', 'block'],
    detail: ['title', 'text', 'text', 'block', 'block']
  };

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** Creates an element with a class and optional text content. */
  function element(tagName, className, textContent) {
    var node = global.document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (textContent !== undefined && textContent !== null && textContent !== '') {
      node.textContent = textContent;
    }
    return node;
  }

  /** Creates an element with a class and optional data-region / data-slot. */
  function createRegion(tagName, className, regionName, slotName) {
    var node = element(tagName, className);
    if (regionName) {
      node.setAttribute('data-region', regionName);
    }
    if (slotName) {
      node.setAttribute('data-slot', slotName);
    }
    return node;
  }

  // ------------------------------------------------------------------
  // Skeleton builders — the empty Universal Workspace Structure. Each region
  // is a reserved mount point; the stylesheet collapses the ones that stay
  // empty.
  // ------------------------------------------------------------------

  /**
   * Builds the workspace header (§15.4). The title carries the workspace's
   * registry label; the eyebrow, meta, and actions slots stay empty until
   * configured — they are reserved for client / engagement / period (eyebrow),
   * description / phase / status (meta), and framework badges / status / last
   * updated / actions (actions). Empty slots collapse via the stylesheet.
   */
  function buildHeader(workspace) {
    var header = createRegion('header', 'aos-workspace-framework__header', 'workspace-header');

    var orientation = createRegion('div', 'aos-workspace-framework__orientation');
    orientation.appendChild(createRegion('p', 'aos-workspace-framework__eyebrow', null, SLOTS.EYEBROW));

    var title = createRegion('h1', 'aos-workspace-framework__title', null, SLOTS.TITLE);
    title.textContent = workspace.label;
    orientation.appendChild(title);

    orientation.appendChild(createRegion('p', 'aos-workspace-framework__meta', null, SLOTS.META));
    header.appendChild(orientation);

    header.appendChild(createRegion('div', 'aos-workspace-framework__actions', null, SLOTS.HEADER_ACTIONS));
    return header;
  }

  /**
   * Builds the context summary strip (§15.5) — the reserved Surface for
   * operational context that travels with the user. Empty until configured;
   * the stylesheet hides the empty strip.
   */
  function buildRibbon() {
    var ribbon = createRegion('div', 'aos-surface aos-workspace-framework__ribbon', 'context-ribbon', SLOTS.CONTEXT);
    ribbon.setAttribute('role', 'group');
    ribbon.setAttribute('aria-label', 'Workspace context');
    return ribbon;
  }

  /**
   * Builds the workspace toolbar region (Issue #17 §4) — search, filter, sort,
   * view, refresh, export, and additional actions. Empty until configured;
   * hidden while empty.
   */
  function buildToolbarRegion() {
    var toolbar = createRegion('div', 'aos-workspace-framework__toolbar', 'workspace-toolbar', SLOTS.TOOLBAR);
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Workspace toolbar');
    return toolbar;
  }

  /**
   * Builds the filter bar region (Issue #17 §5) — chips and dropdowns. Empty
   * until configured; hidden while empty.
   */
  function buildFilterRegion() {
    var filters = createRegion('div', 'aos-workspace-framework__filters', 'workspace-filters', SLOTS.FILTERS);
    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', 'Filters');
    return filters;
  }

  /**
   * Builds the workspace action area (§15.11 / Issue #17 §6) — the primary
   * add / import / export / generate / create actions. Empty until configured;
   * hidden while empty.
   */
  function buildActionBarRegion() {
    return createRegion('div', 'aos-workspace-framework__action-bar', 'workspace-action-bar', SLOTS.ACTION_BAR);
  }

  /**
   * Builds the primary content region (§15.6) — the operational focus of the
   * workspace. It dominates the layout; its slot is the canvas workspaces
   * render into.
   */
  function buildContent() {
    var content = createRegion('section', 'aos-surface aos-workspace-framework__content', 'primary-content', SLOTS.CONTENT);
    content.setAttribute('aria-label', 'Primary content');
    return content;
  }

  /**
   * Builds one universal supporting panel as a Panel Section component
   * (Component Library — §74.7): a titled header plus an empty body slot. The
   * framework contributes only the panel modifier used for grid placement.
   */
  function buildPanel(panel) {
    var section = createRegion(
      'section',
      'aos-panel-section aos-workspace-framework__panel aos-workspace-framework__' + panel.modifier,
      panel.region
    );
    section.setAttribute('aria-label', panel.title);

    var header = createRegion('header', 'aos-panel-section__header');
    var heading = createRegion('h2', 'aos-panel-section__title');
    heading.textContent = panel.title;
    header.appendChild(heading);
    section.appendChild(header);

    section.appendChild(createRegion('div', 'aos-panel-section__body', null, panel.region));
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

  /**
   * Builds the complete Universal Workspace Structure for a workspace, in the
   * canonical region order: header, context summary, toolbar, filter bar,
   * workspace actions, primary content, supporting panels, footer.
   */
  function buildFramework(workspace) {
    var framework = createRegion('article', 'aos-workspace-framework', 'workspace-framework');
    framework.appendChild(buildHeader(workspace));
    framework.appendChild(buildRibbon());
    framework.appendChild(buildToolbarRegion());
    framework.appendChild(buildFilterRegion());
    framework.appendChild(buildActionBarRegion());
    framework.appendChild(buildContent());
    framework.appendChild(buildPanels());
    framework.appendChild(buildFooter());
    return framework;
  }

  // ------------------------------------------------------------------
  // Shared component builders — reusable compositions of the Shared Enterprise
  // Component Library. Exposed on the public API so every future workspace
  // reuses one implementation instead of duplicating it.
  // ------------------------------------------------------------------

  /**
   * Builds a Button component from an action descriptor
   * `{ label, variant, href, id }`. A descriptor with an href renders as a
   * button-styled link (navigation); otherwise a real <button>. Presentation
   * only — behavior and consequences belong to the action's owning issue.
   */
  function buildButton(action) {
    var variant = action.variant ? ' aos-button--' + action.variant : '';
    var node;
    if (action.href) {
      node = element('a', 'aos-button' + variant, action.label);
      node.setAttribute('href', action.href);
    } else {
      node = element('button', 'aos-button' + variant, action.label);
      node.setAttribute('type', 'button');
    }
    if (action.id) {
      node.setAttribute('data-action', action.id);
    }
    return node;
  }

  /** Builds a Status Badge component. */
  function buildBadge(text, tone) {
    return element('span', 'aos-status-badge' + (tone ? ' aos-status-badge--' + tone : ''), text);
  }

  /**
   * Builds a Select component (native <select> with a custom caret) from a
   * label and an options list. Options may be strings or `{ label }` objects;
   * when none are supplied the label becomes the single default option, so the
   * control still reads meaningfully in Release 1.
   */
  function buildSelect(label, options) {
    var wrap = element('div', 'aos-select');
    var control = element('select', 'aos-select__control');
    control.setAttribute('aria-label', label);
    asArray(options).forEach(function (option) {
      control.appendChild(element('option', null, typeof option === 'string' ? option : option.label));
    });
    if (!control.firstChild) {
      control.appendChild(element('option', null, label));
    }
    wrap.appendChild(control);
    var caret = element('span', 'aos-select__caret', '▾');
    caret.setAttribute('aria-hidden', 'true');
    wrap.appendChild(caret);
    return wrap;
  }

  /**
   * Builds a Search Field component. Release 1 search is a presentation-only
   * placeholder; the field captures no query and performs no lookup.
   */
  function buildSearchField(search) {
    var placeholder = (search && search.placeholder) || 'Search';
    var field = element('div', 'aos-search-field');
    var icon = element('span', 'aos-search-field__icon', '⌕');
    icon.setAttribute('aria-hidden', 'true');
    field.appendChild(icon);
    var input = element('input', 'aos-search-field__input');
    input.setAttribute('type', 'search');
    input.setAttribute('placeholder', placeholder);
    input.setAttribute('aria-label', placeholder);
    field.appendChild(input);
    return field;
  }

  /** Builds a filter Chip component from `{ label, selected, removable }`. */
  function buildChip(chip) {
    var node = element('button', 'aos-chip' + (chip.selected ? ' aos-chip--selected' : ''), chip.label);
    node.setAttribute('type', 'button');
    if (chip.selected) {
      node.setAttribute('aria-pressed', 'true');
    }
    if (chip.removable) {
      var remove = element('span', 'aos-chip__remove', '×');
      remove.setAttribute('aria-hidden', 'true');
      node.appendChild(remove);
    }
    return node;
  }

  /**
   * Builds an Empty State component (§15.12) from a descriptor:
   * `{ icon, title, description, primaryAction, secondaryAction, actions }`.
   * Actions are Button components; the primary action leads and renders filled.
   */
  function buildEmptyState(descriptor) {
    var config = descriptor || {};
    var empty = element('div', 'aos-empty-state');
    if (config.icon) {
      var glyph = element('span', 'aos-empty-state__icon', config.icon);
      glyph.setAttribute('aria-hidden', 'true');
      empty.appendChild(glyph);
    }
    if (config.title) {
      empty.appendChild(element('p', 'aos-empty-state__title', config.title));
    }
    if (config.description) {
      empty.appendChild(element('p', 'aos-empty-state__description', config.description));
    }
    var actions = [];
    if (config.primaryAction) {
      actions.push({
        label: config.primaryAction.label,
        href: config.primaryAction.href,
        id: config.primaryAction.id,
        variant: 'primary'
      });
    }
    asArray(config.actions).forEach(function (action) {
      actions.push(action);
    });
    if (config.secondaryAction) {
      actions.push(config.secondaryAction);
    }
    if (actions.length > 0) {
      var group = element('div', 'aos-empty-state__actions');
      actions.forEach(function (action) {
        group.appendChild(buildButton(action));
      });
      empty.appendChild(group);
    }
    return empty;
  }

  /**
   * Builds a Loading State component (§15.12) of structural Skeletons for a
   * content shape — `'table' | 'cards' | 'list' | 'form' | 'detail'`. The
   * Loading State owns the accessible live label; the skeletons are decorative.
   */
  function buildLoadingSkeleton(variant, label) {
    var blocks = LOADING_TEMPLATES[variant] || LOADING_TEMPLATES.detail;
    var loading = element('div', 'aos-loading-state');
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-busy', 'true');
    loading.appendChild(element('span', 'aos-loading-state__label', label || 'Loading'));
    blocks.forEach(function (blockVariant) {
      var skeleton = element('span', 'aos-skeleton aos-skeleton--' + blockVariant);
      skeleton.setAttribute('aria-hidden', 'true');
      loading.appendChild(skeleton);
    });
    return loading;
  }

  // ------------------------------------------------------------------
  // Configuration — a declarative descriptor a workspace applies to its
  // inherited skeleton. normalizeConfiguration is pure (no DOM) so the resolved
  // visibility of every section is offline-testable; the region builders below
  // consume the normalized result.
  // ------------------------------------------------------------------

  /**
   * Resolves a raw configuration into a normalized descriptor with defaults
   * applied and explicit, inspectable section data. Absent sections normalize
   * to empty / false so the corresponding regions stay collapsed. Pure — no
   * DOM access, no state access.
   */
  function normalizeConfiguration(config) {
    var source = config || {};
    var toolbar = source.toolbar || {};
    var filterBar = source.filterBar || {};
    return {
      header: source.header || null,
      contextSummary: asArray(source.contextSummary),
      toolbar: {
        search: toolbar.search ? (toolbar.search === true ? {} : toolbar.search) : null,
        filter: Boolean(toolbar.filter),
        sort: toolbar.sort ? (toolbar.sort === true ? [] : asArray(toolbar.sort)) : null,
        view: toolbar.view ? (toolbar.view === true ? [] : asArray(toolbar.view)) : null,
        refresh: Boolean(toolbar.refresh),
        export: Boolean(toolbar.export),
        actions: asArray(toolbar.actions)
      },
      filterBar: {
        chips: asArray(filterBar.chips),
        dropdowns: asArray(filterBar.dropdowns)
      },
      actions: asArray(source.actions),
      emptyState: source.emptyState || null,
      loading: source.loading || null
    };
  }

  /** Builds the header action cluster: framework badges, status, last updated, actions. */
  function buildHeaderActions(header) {
    var fragment = global.document.createDocumentFragment();

    var badges = element('div', 'aos-workspace-framework__badges');
    asArray(header.frameworks).forEach(function (framework) {
      badges.appendChild(buildBadge(framework, 'info'));
    });
    if (header.status) {
      badges.appendChild(buildBadge(header.status.label, header.status.tone));
    }
    if (badges.firstChild) {
      fragment.appendChild(badges);
    }

    if (header.lastUpdated) {
      fragment.appendChild(element('span', 'aos-workspace-framework__last-updated', header.lastUpdated));
    }

    if (asArray(header.actions).length > 0) {
      var group = element('div', 'aos-action-group');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Header actions');
      header.actions.forEach(function (action) {
        group.appendChild(buildButton(action));
      });
      fragment.appendChild(group);
    }

    return fragment.firstChild ? fragment : null;
  }

  /** Builds the context summary strip content from `{ label, value }` items. */
  function buildContextSummary(items) {
    if (items.length === 0) {
      return null;
    }
    var fragment = global.document.createDocumentFragment();
    items.forEach(function (item) {
      var wrap = element('span', 'aos-workspace-framework__context-item');
      wrap.appendChild(element('span', 'aos-workspace-framework__context-label', item.label));
      wrap.appendChild(element('span', 'aos-workspace-framework__context-value', item.value));
      fragment.appendChild(wrap);
    });
    return fragment;
  }

  /** Builds the toolbar content: a utilities group and an optional actions group. */
  function buildToolbar(toolbar) {
    var fragment = global.document.createDocumentFragment();

    var utilities = element('div', 'aos-toolbar-group');
    utilities.setAttribute('role', 'group');
    utilities.setAttribute('aria-label', 'Toolbar');
    if (toolbar.search) {
      utilities.appendChild(buildSearchField(toolbar.search));
    }
    if (toolbar.filter) {
      utilities.appendChild(buildButton({ label: 'Filter', variant: 'subtle' }));
    }
    if (toolbar.sort) {
      utilities.appendChild(buildSelect('Sort', toolbar.sort));
    }
    if (toolbar.view) {
      utilities.appendChild(buildSelect('View', toolbar.view));
    }
    if (toolbar.refresh) {
      utilities.appendChild(buildButton({ label: 'Refresh', variant: 'subtle' }));
    }
    if (toolbar.export) {
      utilities.appendChild(buildButton({ label: 'Export', variant: 'subtle' }));
    }
    if (utilities.firstChild) {
      fragment.appendChild(utilities);
    }

    if (toolbar.actions.length > 0) {
      var actionsGroup = element('div', 'aos-toolbar-group');
      actionsGroup.setAttribute('role', 'group');
      actionsGroup.setAttribute('aria-label', 'Toolbar actions');
      toolbar.actions.forEach(function (action) {
        actionsGroup.appendChild(buildButton(action));
      });
      fragment.appendChild(actionsGroup);
    }

    return fragment.firstChild ? fragment : null;
  }

  /** Builds the filter bar content: filter chips and labeled dropdowns. */
  function buildFilterBar(filterBar) {
    var fragment = global.document.createDocumentFragment();
    filterBar.chips.forEach(function (chip) {
      fragment.appendChild(buildChip(chip));
    });
    filterBar.dropdowns.forEach(function (dropdown) {
      var wrap = element('span', 'aos-workspace-framework__filter');
      if (dropdown.label) {
        wrap.appendChild(element('span', 'aos-workspace-framework__filter-label', dropdown.label));
      }
      wrap.appendChild(buildSelect(dropdown.label || 'Filter', dropdown.options));
      fragment.appendChild(wrap);
    });
    return fragment.firstChild ? fragment : null;
  }

  /** Builds the workspace action area: an end-aligned Action Group of buttons. */
  function buildActionArea(actions) {
    if (actions.length === 0) {
      return null;
    }
    var group = element('div', 'aos-action-group aos-action-group--end');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Workspace actions');
    actions.forEach(function (action) {
      group.appendChild(buildButton(action));
    });
    return group;
  }

  // ------------------------------------------------------------------
  // Slot access + configuration application
  // ------------------------------------------------------------------

  /** Sets a slot's text content within a framework view. */
  function setSlotText(view, slotName, text) {
    var slot = view.querySelector('[data-slot="' + slotName + '"]');
    if (slot) {
      slot.textContent = text || '';
    }
  }

  /**
   * Replaces a slot's content with a node (element or fragment), or clears the
   * slot when the node is absent so the empty region collapses.
   */
  function fillSlot(view, slotName, node) {
    var slot = view.querySelector('[data-slot="' + slotName + '"]');
    if (!slot) {
      return;
    }
    if (node) {
      slot.replaceChildren(node);
    } else {
      slot.replaceChildren();
    }
  }

  /** Applies a normalized header descriptor to the header region. */
  function applyHeader(view, header) {
    setSlotText(view, SLOTS.EYEBROW, header.eyebrow || header.engagement || '');
    if (header.title) {
      setSlotText(view, SLOTS.TITLE, header.title);
    }
    setSlotText(view, SLOTS.META, header.description || header.meta || '');
    fillSlot(view, SLOTS.HEADER_ACTIONS, buildHeaderActions(header));
  }

  /**
   * Applies a configuration to an already-rendered framework, populating each
   * region from the Shared Enterprise Component Library. Unconfigured regions
   * are left empty so the stylesheet collapses them. Does nothing when the view
   * is absent, so callers degrade rather than throw.
   */
  function configure(view, config) {
    if (!view) {
      return;
    }
    var normalized = normalizeConfiguration(config);

    if (normalized.header) {
      applyHeader(view, normalized.header);
    }
    fillSlot(view, SLOTS.CONTEXT, buildContextSummary(normalized.contextSummary));
    fillSlot(view, SLOTS.TOOLBAR, buildToolbar(normalized.toolbar));
    fillSlot(view, SLOTS.FILTERS, buildFilterBar(normalized.filterBar));
    fillSlot(view, SLOTS.ACTION_BAR, buildActionArea(normalized.actions));

    // Content state (§15.12): a loading skeleton or an empty state may be
    // rendered directly into the primary content by configuration; a workspace
    // with real content fills the slot itself instead.
    if (normalized.loading) {
      var loading = normalized.loading === true ? {} : normalized.loading;
      fillSlot(view, SLOTS.CONTENT, buildLoadingSkeleton(loading.variant, loading.label));
    } else if (normalized.emptyState) {
      fillSlot(view, SLOTS.CONTENT, buildEmptyState(normalized.emptyState));
    }
  }

  /**
   * Renders the framework skeleton for a workspace into a host element,
   * replacing whatever the host currently contains, then applies an optional
   * configuration. Exposed so any workspace surface reuses one renderer instead
   * of duplicating markup.
   */
  function render(hostElement, workspace, config) {
    hostElement.replaceChildren(buildFramework(workspace));
    if (config) {
      configure(hostElement, config);
    }
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
    SLOTS: SLOTS,
    render: render,
    configure: configure,
    normalizeConfiguration: normalizeConfiguration,

    // Shared component builders — one implementation every workspace reuses.
    buildEmptyState: buildEmptyState,
    buildLoadingSkeleton: buildLoadingSkeleton,

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

  // Self-initialize after the DOM is ready. Guarded on `document` so the module
  // can also load in the offline test sandbox, where no document exists. The
  // bootstrap initializes the router first (its listener is registered
  // earlier), so the current route is resolved by the time this runs.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.workspaceFramework.init);
    } else {
      AuditOS.workspaceFramework.init();
    }
  }
})(window);
