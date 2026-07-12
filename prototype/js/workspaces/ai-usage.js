/**
 * AuditOS AI Usage Workspace
 * Platform Information Architecture — GitHub Issue #33 (§4 AI Usage) /
 * Workspaces and Navigation — Chapter 12 / Component Architecture — Chapter 74
 *
 * The platform-level operational-telemetry and financial-accounting surface
 * for AI, visible to administrators only. Issue #33 scopes this workspace as
 * architectural: no AI is integrated, no telemetry exists, and nothing here
 * fabricates a number. The workspace establishes the permanent structure —
 * Overview (total spend, total requests, cache savings, model mix) and the
 * Client / Engagement / Operation breakdowns — as honest reserved Empty
 * States, and declares the attribution contract every future AI operation
 * must satisfy: attributable by client, engagement, operation, agent, model,
 * latency, tokens, cache usage, and cost.
 *
 * Access control (Issue #33 §5): visibility is gated by the
 * `ai-usage.view` capability of the Permission Foundation
 * (js/platform/permissions.js). Navigation surfaces hide the workspace from
 * sessions without the capability (never a disabled menu item); a session
 * that deep-links here without it gets the standard access explanation —
 * required role, appropriate contact (resolved from real user records),
 * and reason — not an error page.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to every
 * other workspace. `collectViewModel` is the single place this workspace
 * reads `AuditOS.state`; the renderer configures the Shared Workspace
 * Framework skeleton and composes the Enterprise Data Presentation System.
 *
 * Presentation only. Nothing is written; AI remains advisory and human
 * approval remains mandatory.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Shared Workspace Platform (Issue #27) — harmonized helpers reused across every operational workspace. */
  var WS = AuditOS.workspaceShared || {};

  // ------------------------------------------------------------------
  // Constants
  // ------------------------------------------------------------------

  /** The Shared Workspace Framework slots this workspace fills directly. */
  var SLOTS = {
    CONTENT: 'primary-content',
    RELATED: 'related-information',
    AI: 'ai-recommendations',
    ACTIVITY: 'activity',
    FOOTER: 'workspace-footer'
  };

  /** Presentation tones. */
  var TONES = WS.TONES;

  /** The capability that gates this workspace (Permission Foundation). */
  var VIEW_CAPABILITY = 'ai-usage.view';

  /**
   * The overview instruments the workspace is architected for (Issue #33
   * §4). No AI telemetry exists in Release 1, so each renders its reserved
   * placeholder — never a fabricated figure.
   */
  var OVERVIEW_INSTRUMENTS = [
    { key: 'spend', label: 'Total spend', description: 'Cumulative cost of every AI operation, attributable to client and engagement.' },
    { key: 'requests', label: 'Total requests', description: 'Every AI request the platform has issued.' },
    { key: 'cache-savings', label: 'Cache savings', description: 'Spend avoided through cache usage.' },
    { key: 'model-mix', label: 'Model mix', description: 'The distribution of operations across models.' }
  ];

  /**
   * The attribution contract (Issue #33 §4): the dimensions every future AI
   * operation record must carry so usage is attributable end to end.
   */
  var ATTRIBUTION_DIMENSIONS = [
    { key: 'client', label: 'Client', description: 'The client the operation was performed for.' },
    { key: 'engagement', label: 'Engagement', description: 'The engagement the operation belongs to.' },
    { key: 'operation', label: 'Operation', description: 'The named AI operation that ran.' },
    { key: 'agent', label: 'Agent', description: 'The agent that issued the operation.' },
    { key: 'model', label: 'Model', description: 'The model that served the operation.' },
    { key: 'latency', label: 'Latency', description: 'End-to-end duration of the operation.' },
    { key: 'tokens', label: 'Tokens', description: 'Input and output token counts.' },
    { key: 'cache', label: 'Cache usage', description: 'Cache reads and writes the operation used.' },
    { key: 'cost', label: 'Cost', description: 'The billed cost of the operation.' }
  ];

  /** The breakdown views the workspace is architected for. */
  var BREAKDOWNS = [
    { id: 'clients', kicker: 'Attribution', title: 'Client breakdown', noun: 'client' },
    { id: 'engagements', kicker: 'Attribution', title: 'Engagement breakdown', noun: 'engagement' },
    { id: 'operations', kicker: 'Attribution', title: 'Operation breakdown', noun: 'operation' }
  ];

  /** Entrance stagger ceiling — sections beyond this share the last delay. */
  var STAGGER_LIMIT = WS.STAGGER_LIMIT;

  // ------------------------------------------------------------------
  // Pure derivation helpers — no DOM, no AuditOS.state access.
  // ------------------------------------------------------------------

  /** Returns the value when it is an array, otherwise an empty array. */
  var asArray = WS.asArray;

  /**
   * The appropriate contacts for the denied capability: the real users whose
   * recorded roles include one of the required roles — never fabricated.
   * (No demo user record carries the Administrator role today, so this
   * honestly yields '' for the view capability; the notice then simply
   * omits its contact line.)
   */
  function deriveRoleContacts(users, requiredRoles) {
    var required = asArray(requiredRoles);
    var names = [];
    asArray(users).forEach(function (user) {
      var holds = asArray(user.roles).some(function (role) {
        return required.indexOf(role) !== -1;
      });
      if (holds && user.name) {
        names.push(user.name);
      }
    });
    return names.join(' · ');
  }

  /** The overview instruments with their honest, reserved values. */
  function deriveOverviewInstruments() {
    return OVERVIEW_INSTRUMENTS.map(function (instrument) {
      return {
        title: instrument.label,
        description: instrument.description,
        meta: 'Not recorded',
        tone: null
      };
    });
  }

  /** The attribution contract as list rows. */
  function deriveAttributionContract() {
    return ATTRIBUTION_DIMENSIONS.map(function (dimension) {
      return {
        title: dimension.label,
        description: dimension.description,
        tone: TONES.INFO
      };
    });
  }

  // ------------------------------------------------------------------
  // View model — the single place this workspace reads AuditOS.state.
  // ------------------------------------------------------------------

  /**
   * Collects everything AI Usage presents. `permissions` is the Permission
   * Foundation (passed in so the collector stays offline-testable with
   * synthetic sessions). A session without the view capability yields a
   * restricted model carrying the standard denial explanation; a permitted
   * session yields the architectural model — reserved instruments, reserved
   * breakdowns, and the attribution contract. Returns null while the state
   * is not ready.
   */
  function collectViewModel(state, workspaceRegistry, permissions) {
    if (!state || !state.isReady()) {
      return null;
    }

    var status = state.getStatus();
    var denial = permissions && typeof permissions.explainDenial === 'function'
      ? permissions.explainDenial(VIEW_CAPABILITY) : null;
    if (denial) {
      return {
        restricted: true,
        status: status,
        denial: denial,
        contact: deriveRoleContacts(state.listRecords('users'), denial.requiredRoles)
      };
    }

    return {
      restricted: false,
      status: status,
      overview: deriveOverviewInstruments(),
      breakdowns: BREAKDOWNS,
      attribution: deriveAttributionContract(),

      header: {
        eyebrow: 'Platform · Administrators',
        meta: 'Operational telemetry and financial accounting for every AI operation. Architectural in Release 1 — no AI runs, no telemetry is recorded.'
      },

      ribbon: [
        { label: 'AI operations', value: 'None recorded' },
        { label: 'Telemetry', value: 'Not yet collected' },
        { label: 'Visibility', value: 'Administrators' }
      ],

      footer: [
        { label: 'Environment', value: 'Static prototype' },
        { label: 'Demo status', value: status.demoDataLoaded ? 'Demo data loaded' : 'Demo data degraded' },
        { label: 'AI telemetry', value: 'Not recorded' }
      ]
    };
  }

  // ------------------------------------------------------------------
  // Generic DOM builders — thin layout wrappers around the Enterprise Data
  // Presentation System. Text is always assigned through textContent.
  // ------------------------------------------------------------------

  /** Creates an element with a class and optional text content. */
  var el = WS.el;

  /** The shared presentation system, resolved at render time. */
  var presentation = WS.presentation;

  /** Builds one Section component: an eyebrow, a title, an optional description, then a body node. */
  function buildSection(id, meta, bodyNode) {
    return WS.buildSection('aos-ai-usage', id, meta, bodyNode);
  }

  /** Builds the Overview body: the four reserved instruments, honestly unrecorded. */
  function buildOverviewBody(overview) {
    var P = presentation();
    var surface = el('div', 'aos-surface aos-surface--padded aos-ai-usage__overview');
    surface.appendChild(P.itemList(overview, { compact: true }));
    return surface;
  }

  /** Builds one reserved breakdown body: the honest Empty State for a future attribution view. */
  function buildBreakdownBody(breakdown) {
    var P = presentation();
    return P.emptyState({
      icon: '◇',
      title: 'No AI operations recorded',
      description: 'Spend, requests, and latency per ' + breakdown.noun +
        ' appear here once the AI foundation records telemetry. Nothing is estimated.'
    });
  }

  /** Builds the Attribution contract body: the declared dimensions of every future AI operation. */
  function buildAttributionBody(attribution) {
    var P = presentation();
    var surface = el('div', 'aos-surface aos-surface--padded aos-ai-usage__attribution');
    surface.appendChild(P.itemList(attribution, { compact: true }));
    return surface;
  }

  /**
   * Builds the restricted view (Issue #33 §5): the standard access
   * explanation for a session without the administrator capability —
   * required role, appropriate contact, reason — plus the shared Permission
   * Notice for hover/focus detail. Never an error page, never a disabled UI.
   */
  function buildRestrictedBody(viewModel) {
    var P = presentation();
    var wrap = el('div', 'aos-ai-usage__restricted');
    wrap.appendChild(P.emptyState({
      icon: '◇',
      title: 'Administrator access required',
      description: viewModel.denial.reason +
        (viewModel.contact ? ' Contact: ' + viewModel.contact + '.' : '')
    }));
    wrap.appendChild(WS.buildPermissionNotice(viewModel.denial, viewModel.contact));
    return wrap;
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /** The ordered AI Usage sections: overview, the three breakdowns, and the attribution contract. */
  function primarySections(viewModel) {
    var sections = [
      {
        id: 'overview', kicker: 'Telemetry', title: 'Overview',
        description: 'Total spend, total requests, cache savings, and model mix — recorded, never estimated.',
        body: function () { return buildOverviewBody(viewModel.overview); }
      }
    ];
    viewModel.breakdowns.forEach(function (breakdown) {
      sections.push({
        id: breakdown.id, kicker: breakdown.kicker, title: breakdown.title,
        body: function () { return buildBreakdownBody(breakdown); }
      });
    });
    sections.push({
      id: 'attribution', kicker: 'Contract', title: 'Attribution',
      description: 'Every future AI operation is attributable by these dimensions.',
      body: function () { return buildAttributionBody(viewModel.attribution); }
    });
    return sections;
  }

  /** Renders the ready AI Usage experience into the framework slots. */
  function renderReady(view, viewModel) {
    AuditOS.workspaceFramework.configure(view, {
      header: viewModel.header,
      contextSummary: viewModel.ribbon
    });

    var canvas = el('div', 'aos-ai-usage');
    canvas.setAttribute('data-canvas', 'flush');
    var rendered = 0;
    primarySections(viewModel).forEach(function (section) {
      var built = buildSection(section.id, section, section.body());
      built.classList.add('aos-rise-in');
      if (rendered > 0) {
        built.classList.add('aos-rise-in--' + Math.min(rendered, STAGGER_LIMIT));
      }
      rendered += 1;
      canvas.appendChild(built);
    });
    fillSlot(view, SLOTS.CONTENT, [canvas]);

    var P = presentation();
    var related = P.emptyState({
      icon: '◇', title: 'No related objects yet',
      description: 'Clients and engagements attributed AI usage appear here once telemetry exists.'
    });
    related.classList.add('aos-fade-in');
    fillSlot(view, SLOTS.RELATED, [related]);

    var ai = P.emptyState({
      icon: '✦', title: 'Reserved for AI advisory',
      description: 'Advisory recommendations will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
    });
    ai.classList.add('aos-tint-brand', 'aos-fade-in');
    fillSlot(view, SLOTS.AI, [ai]);

    var activity = P.emptyState({
      icon: '◇', title: 'No AI activity',
      description: 'AI operations appear here as they run. Release 1 runs none.'
    });
    activity.classList.add('aos-fade-in');
    fillSlot(view, SLOTS.ACTIVITY, [activity]);

    fillSlot(view, SLOTS.FOOTER, [WS.buildFooterItems('aos-ai-usage', viewModel.footer)]);
  }

  /** Renders the restricted (non-administrator) experience. */
  function renderRestricted(view, viewModel) {
    AuditOS.workspaceFramework.configure(view, {
      header: {
        eyebrow: 'Platform · Administrators',
        meta: 'AI operational telemetry and spend accounting.'
      }
    });
    fillSlot(view, SLOTS.CONTENT, [buildRestrictedBody(viewModel)]);
    fillSlot(view, SLOTS.RELATED, []);
    fillSlot(view, SLOTS.AI, []);
    fillSlot(view, SLOTS.ACTIVITY, []);
    fillSlot(view, SLOTS.FOOTER, []);
  }

  /** Renders the layout-stable loading state (§15.12 — Loading). */
  function renderLoading(view) {
    var P = presentation();
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'list', label: 'Loading AI usage' })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders AI Usage when it is the active workspace: the architectural
   * experience for administrators, the standard access explanation for
   * everyone else, and the loading skeleton while the state resolves.
   */
  function renderActiveAiUsage() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.AI_USAGE) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.AI_USAGE + '"]'
    );
    if (!view) {
      return;
    }

    var viewModel = state ? collectViewModel(state, registry, AuditOS.permissions) : null;
    if (!viewModel) {
      renderLoading(view);
      return;
    }
    if (viewModel.restricted) {
      renderRestricted(view, viewModel);
      return;
    }
    renderReady(view, viewModel);
  }

  AuditOS.aiUsageWorkspace = {
    SLOTS: SLOTS,
    VIEW_CAPABILITY: VIEW_CAPABILITY,
    OVERVIEW_INSTRUMENTS: OVERVIEW_INSTRUMENTS,
    ATTRIBUTION_DIMENSIONS: ATTRIBUTION_DIMENSIONS,

    // Pure, offline-testable derivations.
    derivations: {
      deriveRoleContacts: deriveRoleContacts,
      deriveOverviewInstruments: deriveOverviewInstruments,
      deriveAttributionContract: deriveAttributionContract
    },

    collectViewModel: collectViewModel,

    /**
     * Binds AI Usage to the router and the Shared Audit State. Safe to call
     * once, after the DOM is ready, the router has resolved the initial
     * route, and the framework has rendered its skeleton. Does nothing when
     * the routing or state foundations are absent, so the shell degrades
     * rather than throwing.
     */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveAiUsage);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveAiUsage);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveAiUsage);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveAiUsage);
      }
      renderActiveAiUsage();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.aiUsageWorkspace.init);
    } else {
      AuditOS.aiUsageWorkspace.init();
    }
  }
})(window);
