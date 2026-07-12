/**
 * AuditOS Global Approvals Workspace
 * Platform Information Architecture — GitHub Issue #33 (§3 Global Approvals) /
 * Workspaces and Navigation — Chapter 12 / Component Architecture — Chapter 74
 *
 * The one approval inbox of the entire platform. Users never navigate into
 * individual clients or engagements just to find what awaits a decision:
 * every evidence item and evidence request whose recorded status means
 * "awaiting an audit-team decision" is aggregated here across every client
 * and every operational engagement, and each row deep-links to its record
 * (Issue #31) where the work actually lives. Completed engagements are
 * read-only and contribute nothing. The workspace is always visible; the
 * global header carries its live pending count as a navigation badge.
 *
 * The inbox is grouped by approval type. Evidence approvals exist in the
 * data today; the remaining approval types the platform is architected for —
 * Requirements, Walkthroughs, Documentation, Reports, AI recommendations —
 * are declared as reserved types and render honestly as "reserved", never as
 * fabricated queues.
 *
 * Permission-aware actions (Issue #33 §5): recording an approval decision is
 * a reviewer capability. Release 1 performs no writes, and the demo session
 * does not hold the reviewer capability, so the decision action area renders
 * the shared Permission Notice — the actions are hidden (never disabled),
 * and hovering the area explains the required role, the appropriate contact
 * (resolved live from the user records that actually hold the role), and the
 * reason. The gate comes from the Permission Foundation
 * (js/platform/permissions.js); the notice from the Workspace Shared
 * Platform — one implementation, consumed everywhere.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to every
 * other operational workspace. `collectViewModel` is the single place this
 * workspace reads `AuditOS.state`; every count derives live from records.
 * The renderer configures the Shared Workspace Framework skeleton and fills
 * its slots with Enterprise Data Presentation System compositions, reusing
 * the shared rail selection controller for the inbox Master–Detail.
 *
 * Presentation only. Nothing is written; no approval is ever decided here in
 * Release 1. Sections with no data render shared Empty State components.
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
    ACTION_BAR: 'workspace-action-bar',
    CONTENT: 'primary-content',
    RELATED: 'related-information',
    AI: 'ai-recommendations',
    ACTIVITY: 'activity',
    FOOTER: 'workspace-footer'
  };

  /** Presentation tones shared by badges, markers, and rails. */
  var TONES = WS.TONES;

  /** Engagement lifecycle status vocabulary of the demo data (read, never invented). */
  var ENGAGEMENT_STATUS = { COMPLETED: 'Completed' };

  /**
   * The recorded statuses that mean a record is awaiting an audit-team
   * approval decision (read from the dataset's own vocabulary, never
   * invented) — identical to the list the global header badge and the Client
   * Dashboard approval summary count, so every surface reports one number.
   */
  var PENDING_APPROVAL_STATUSES = ['Pending Review', 'Evidence Received - Under HA Review', 'Submitted'];

  /** The capability that gates recording an approval decision (Permission Foundation). */
  var DECIDE_CAPABILITY = 'approvals.decide';

  /**
   * The approval types the platform is architected for (Issue #33 §3).
   * `collection` names where the type's records live today; types without a
   * collection are reserved for future issues and render honestly as such.
   */
  var APPROVAL_TYPES = [
    { key: 'evidence', label: 'Evidence', live: true },
    { key: 'requirements', label: 'Requirements', live: false },
    { key: 'walkthroughs', label: 'Walkthroughs', live: false },
    { key: 'documentation', label: 'Documentation', live: false },
    { key: 'reports', label: 'Reports', live: false },
    { key: 'ai-recommendations', label: 'AI recommendations', live: false }
  ];

  /** Larger cap for the inbox rail, which is the working surface of this workspace. */
  var QUEUE_LIMIT = 50;

  /** Entrance stagger ceiling — sections beyond this share the last delay. */
  var STAGGER_LIMIT = WS.STAGGER_LIMIT;

  // ------------------------------------------------------------------
  // Pure derivation helpers — no DOM, no AuditOS.state access.
  // ------------------------------------------------------------------

  /** Returns the value when it is an array, otherwise an empty array. */
  var asArray = WS.asArray;

  /** Naive English pluralization for whole-count labels. */
  var plural = WS.plural;

  /** Whether a recorded status means the record awaits an approval decision. */
  function isPendingApproval(status) {
    return PENDING_APPROVAL_STATUSES.indexOf(status) !== -1;
  }

  /**
   * The pending approval rows of the whole platform, derived from each
   * operational engagement's own evidence and request records. Each row
   * carries its record, its engagement, and its client, so the inbox can
   * present and deep-link without further lookups. Completed engagements are
   * excluded upstream and contribute nothing.
   */
  function deriveApprovalRows(operationalEntries) {
    var evidenceRows = [];
    var requestRows = [];
    asArray(operationalEntries).forEach(function (entry) {
      var engagement = entry.engagement;
      var company = entry.company || null;
      asArray(entry.evidence).forEach(function (item) {
        if (!isPendingApproval(item.reviewStatus)) {
          return;
        }
        evidenceRows.push({
          id: item.id,
          kind: 'Evidence',
          title: item.title || item.id,
          status: item.reviewStatus,
          engagement: engagement,
          company: company,
          record: item
        });
      });
      asArray(entry.requests).forEach(function (request) {
        if (!isPendingApproval(request.status)) {
          return;
        }
        var requirement = entry.requirementsById ? entry.requirementsById[request.requirementId] : null;
        requestRows.push({
          id: request.id,
          kind: 'Evidence request',
          title: (requirement && requirement.title) || request.id,
          status: request.status,
          engagement: engagement,
          company: company,
          record: request
        });
      });
    });
    return { evidence: evidenceRows, requests: requestRows, total: evidenceRows.length + requestRows.length };
  }

  /** The inbox groups: one labeled rail group per approval type that has rows. */
  function deriveInboxGroups(rows) {
    var groups = [];
    if (rows.evidence.length > 0) {
      groups.push({ label: 'Evidence', rows: rows.evidence.slice(0, QUEUE_LIMIT) });
    }
    if (rows.requests.length > 0) {
      groups.push({ label: 'Evidence requests', rows: rows.requests.slice(0, QUEUE_LIMIT) });
    }
    return groups;
  }

  /**
   * Approval-type coverage: the live pending count for the types that exist
   * in the data today, and an honest "Reserved" hint for the future types
   * the platform is architected to route through this inbox.
   */
  function deriveTypeCoverage(rows) {
    return APPROVAL_TYPES.map(function (type) {
      if (!type.live) {
        return {
          title: type.label,
          description: 'Reserved — routes through this inbox once a future issue records its approvals.',
          meta: 'Reserved',
          tone: null
        };
      }
      var pending = rows.evidence.length + rows.requests.length;
      return {
        title: type.label,
        description: rows.evidence.length + ' evidence · ' + rows.requests.length + ' ' + plural(rows.requests.length, 'request'),
        meta: pending + ' pending',
        tone: pending > 0 ? TONES.WARNING : TONES.SUCCESS
      };
    });
  }

  /**
   * The appropriate contacts for a denied capability: the real users whose
   * recorded roles include one of the required roles — resolved from user
   * records, never fabricated. Returns '' when no user holds the role.
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

  /** The distinct engagements and clients the pending rows span. */
  function deriveCoverageCounts(rows) {
    var engagementIds = {};
    var companyIds = {};
    asArray(rows.evidence).concat(asArray(rows.requests)).forEach(function (row) {
      if (row.engagement && row.engagement.id) {
        engagementIds[row.engagement.id] = true;
      }
      if (row.company && row.company.id) {
        companyIds[row.company.id] = true;
      }
    });
    return {
      engagements: Object.keys(engagementIds).length,
      clients: Object.keys(companyIds).length
    };
  }

  // ------------------------------------------------------------------
  // View model — the single place this workspace reads AuditOS.state.
  // ------------------------------------------------------------------

  /** Indexes a list of records by their id field. */
  var indexById = WS.indexById;

  /** Reads the first dataset document an engagement owns in a collection, or null. */
  var readEngagementDocument = WS.readEngagementDocument;

  /**
   * Collects everything Global Approvals presents from the Shared Audit
   * State. `permissions` is the Permission Foundation (passed in so the
   * collector stays offline-testable with synthetic sessions). Returns null
   * while the state is not ready; this workspace has no degraded variant of
   * its own — an empty platform yields an honest empty inbox.
   */
  function collectViewModel(state, workspaceRegistry, targetId, permissions) {
    if (!state || !state.isReady()) {
      return null;
    }

    var status = state.getStatus();
    var companiesById = indexById(state.listRecords('companies'));
    var engagements = state.listRecords('engagements');

    // Per-engagement operational documents for every non-completed
    // engagement. `findDatasetsForEngagement` resolves only the datasets an
    // engagement itself owns, so program-scoped pool datasets are never
    // double-counted.
    var operationalEntries = engagements
      .filter(function (engagement) { return engagement.status !== ENGAGEMENT_STATUS.COMPLETED; })
      .map(function (engagement) {
        return {
          engagement: engagement,
          company: companiesById[engagement.companyId] || null,
          evidence: (readEngagementDocument(state, 'evidence', engagement.id) || {}).evidence || [],
          requests: (readEngagementDocument(state, 'evidence-requests', engagement.id) || {}).requests || [],
          requirementsById: indexById(
            (readEngagementDocument(state, 'evidence-requirements', engagement.id) || {}).requirements || []
          )
        };
      });

    var rows = deriveApprovalRows(operationalEntries);
    var groups = deriveInboxGroups(rows);
    var typeCoverage = deriveTypeCoverage(rows);
    var coverage = deriveCoverageCounts(rows);

    // The decision gate (Issue #33 §5): a denial explanation when the session
    // may not record decisions, plus the real users who hold the role.
    var denial = permissions && typeof permissions.explainDenial === 'function'
      ? permissions.explainDenial(DECIDE_CAPABILITY) : null;
    var contact = denial
      ? deriveRoleContacts(state.listRecords('users'), denial.requiredRoles) : '';

    return {
      degraded: false,
      status: status,
      rows: rows,
      groups: groups,
      typeCoverage: typeCoverage,
      coverage: coverage,
      pendingCount: rows.total,
      decisionGate: { denial: denial, contact: contact },

      header: {
        eyebrow: 'Platform',
        meta: 'One approval inbox across every client and engagement — approve from here, never by navigating into each workspace.'
      },

      ribbon: [
        { label: 'Pending approvals', value: String(rows.total) },
        { label: 'Evidence', value: String(rows.evidence.length) },
        { label: 'Requests', value: String(rows.requests.length) },
        { label: 'Engagements', value: String(coverage.engagements) },
        { label: 'Clients', value: String(coverage.clients) }
      ],

      toolbar: { search: { placeholder: 'Search pending approvals' } },
      filterBar: {
        dropdowns: [{
          label: 'Type',
          options: ['All types'].concat(APPROVAL_TYPES.map(function (type) { return type.label; }))
        }]
      },

      footer: [
        { label: 'Environment', value: 'Static prototype' },
        { label: 'Demo status', value: status.demoDataLoaded ? 'Demo data loaded' : 'Demo data degraded' },
        { label: 'Pending', value: String(rows.total) }
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
    return WS.buildSection('aos-approvals', id, meta, bodyNode);
  }

  /** Builds the Overview body: the live pending counts across the platform. */
  function buildOverviewBody(model) {
    var P = presentation();
    var surface = el('div', 'aos-surface aos-surface--padded aos-approvals__overview');
    surface.appendChild(P.propertyGrid([
      { label: 'Pending approvals', value: String(model.pendingCount) },
      { label: 'Evidence awaiting decision', value: String(model.rows.evidence.length) },
      { label: 'Requests awaiting decision', value: String(model.rows.requests.length) },
      { label: 'Engagements covered', value: String(model.coverage.engagements) },
      { label: 'Clients covered', value: String(model.coverage.clients) }
    ], { columns: 2 }));
    return surface;
  }

  /** Builds one row of the inbox rail: title, status, and where the record lives. */
  function buildInboxRow(row) {
    var P = presentation();
    var node = el('button', null);
    node.type = 'button';

    var head = el('div', 'aos-approvals__row-head');
    head.appendChild(el('span', 'aos-approvals__row-title', row.title));
    head.appendChild(P.statusBadge({ label: row.kind, tone: TONES.INFO }));
    node.appendChild(head);

    var meta = el('div', 'aos-approvals__row-meta');
    meta.appendChild(el('span', null, row.status));
    if (row.engagement) {
      meta.appendChild(el('span', null, row.engagement.engagementCode || row.engagement.id));
    }
    if (row.company) {
      meta.appendChild(el('span', null, row.company.name));
    }
    node.appendChild(meta);
    return node;
  }

  /**
   * Builds the Approval Inspector for one pending row: what it is, where it
   * lives (client → engagement), its recorded status, and the stable record
   * link into the Evidence workspace (Issue #31) — navigation, never a
   * decision. `context.workspaceRegistry` resolves the link.
   */
  function buildInboxInspector(row, context) {
    var registry = context.workspaceRegistry;
    var href = WS.buildRecordHref(registry, registry.IDS.EVIDENCE, row.id);
    return {
      eyebrow: row.kind,
      title: row.title,
      subtitle: [row.status, row.engagement ? (row.engagement.engagementCode || row.engagement.id) : '']
        .filter(Boolean).join(' · '),
      badges: [
        { label: row.status, tone: TONES.WARNING },
        { label: row.kind, tone: TONES.INFO }
      ],
      sections: [
        {
          title: 'Where it lives', kind: 'properties', columns: 2,
          rows: [
            { label: 'Client', value: row.company ? row.company.name : 'Not recorded' },
            { label: 'Engagement', value: row.engagement ? (row.engagement.name || row.engagement.id) : 'Not recorded' },
            { label: 'Status', value: row.status },
            { label: 'Record', value: row.id }
          ]
        },
        WS.listSection('Open the record', href
          ? [{ title: 'Evidence workspace', tone: TONES.INFO, actions: [{ label: 'Open', href: href }] }]
          : [], 'No stable record route available')
      ]
    };
  }

  /**
   * Builds the Inbox body: a Master–Detail rail of every pending approval,
   * grouped by type, reusing the shared rail selection controller — and the
   * record named by the current route is selected on arrival (Issue #31).
   */
  function buildInboxBody(model, workspaceRegistry, targetId) {
    var P = presentation();
    if (model.groups.length === 0) {
      return P.emptyState({
        icon: '✓', title: 'Nothing awaiting a decision',
        description: 'Evidence and requests awaiting an audit-team decision across every client appear here the moment they need one.'
      });
    }

    var wrap = el('div', 'aos-approvals__inbox');
    var detailMount = el('div', 'aos-approvals__detail-mount');
    var listNode = el('div', 'aos-approvals__row-list');
    listNode.setAttribute('role', 'list');
    WS.mountRailGroups('aos-approvals', listNode, detailMount, model.groups,
      { workspaceRegistry: workspaceRegistry }, buildInboxRow, buildInboxInspector, null, targetId);

    wrap.appendChild(P.masterDetail({
      list: listNode, detail: detailMount, ratio: 38,
      listLabel: 'Pending approvals', detailLabel: 'Approval inspector'
    }));
    return wrap;
  }

  /** Builds the Approval types body: live types with counts, future types honestly reserved. */
  function buildTypesBody(typeCoverage) {
    var P = presentation();
    var surface = el('div', 'aos-surface aos-surface--padded aos-approvals__types');
    surface.appendChild(P.itemList(typeCoverage, { compact: true }));
    return surface;
  }

  /**
   * Builds the decision action area (Issue #33 §5). When the session holds
   * the reviewer capability the real decision actions render; otherwise they
   * stay hidden and the shared Permission Notice explains the required role,
   * the appropriate contact (real reviewer users), and the reason — the
   * standard permission-aware interaction model.
   */
  function buildDecisionArea(decisionGate) {
    return WS.buildPermissionAwareActions(decisionGate.denial, function () {
      var P = presentation();
      var group = el('div', 'aos-action-group aos-action-group--end');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Approval decisions');
      group.appendChild(P.button({ label: 'Approve', variant: 'primary' }));
      group.appendChild(P.button({ label: 'Reject', variant: 'subtle' }));
      return group;
    }, decisionGate.contact);
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /** The ordered Global Approvals sections. */
  function primarySections(viewModel, workspaceRegistry, targetId) {
    return [
      {
        id: 'overview', kicker: 'Platform inbox', title: 'Approvals overview',
        present: true, body: function () { return buildOverviewBody(viewModel); }
      },
      {
        id: 'inbox', kicker: 'Awaiting decision', title: 'Approval inbox',
        description: 'Every pending approval across every client and engagement; select a row for its detail.',
        present: true,
        body: function () { return buildInboxBody(viewModel, workspaceRegistry, targetId); }
      },
      {
        id: 'types', kicker: 'Coverage', title: 'Approval types',
        description: 'The approval types this inbox is architected to route; future types are reserved, never fabricated.',
        present: true, body: function () { return buildTypesBody(viewModel.typeCoverage); }
      }
    ];
  }

  /** Renders the ready Global Approvals experience into the framework slots. */
  function renderReady(view, viewModel, workspaceRegistry, targetId) {
    var P = presentation();

    AuditOS.workspaceFramework.configure(view, {
      header: viewModel.header,
      contextSummary: viewModel.ribbon,
      toolbar: viewModel.toolbar,
      filterBar: viewModel.filterBar
    });

    // The decision action area — permission-aware (Issue #33 §5): rendered
    // after configure() so the framework's own pass never clears it.
    fillSlot(view, SLOTS.ACTION_BAR, [buildDecisionArea(viewModel.decisionGate)]);

    var canvas = el('div', 'aos-approvals');
    canvas.setAttribute('data-canvas', 'flush');
    var rendered = 0;
    primarySections(viewModel, workspaceRegistry, targetId).forEach(function (section) {
      var body = section.present ? section.body() : P.emptyState(section.empty);
      var built = buildSection(section.id, section, body);
      built.classList.add('aos-rise-in');
      if (rendered > 0) {
        built.classList.add('aos-rise-in--' + Math.min(rendered, STAGGER_LIMIT));
      }
      rendered += 1;
      canvas.appendChild(built);
    });
    fillSlot(view, SLOTS.CONTENT, [canvas]);

    var related = WS.buildRelatedBody(WS.resolveRelationships(workspaceRegistry, [
      { id: workspaceRegistry.IDS.EVIDENCE, title: 'Evidence', meta: String(viewModel.rows.evidence.length), present: true },
      { id: workspaceRegistry.IDS.WORKQUEUE, title: 'Work queue', meta: '', present: true },
      { id: workspaceRegistry.IDS.CLIENT, title: 'Client dashboard', meta: '', present: true }
    ]), {
      icon: '◇', title: 'No related objects', description: 'Related destinations appear here.'
    });
    related.classList.add('aos-fade-in');
    fillSlot(view, SLOTS.RELATED, [related]);

    var ai = P.emptyState({
      icon: '✦', title: 'Reserved for AI advisory',
      description: 'AI-recommended approval routing will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
    });
    ai.classList.add('aos-tint-brand', 'aos-fade-in');
    fillSlot(view, SLOTS.AI, [ai]);

    // No approval decision has been recorded in this dataset; the panel says
    // so rather than fabricating a history.
    var activity = P.emptyState({
      icon: '◇', title: 'No decisions recorded',
      description: 'Approval decisions appear here once they are recorded. Release 1 records none.'
    });
    activity.classList.add('aos-fade-in');
    fillSlot(view, SLOTS.ACTIVITY, [activity]);

    fillSlot(view, SLOTS.FOOTER, [WS.buildFooterItems('aos-approvals', viewModel.footer)]);
  }

  /** Renders the layout-stable loading state (§15.12 — Loading). */
  function renderLoading(view) {
    var P = presentation();
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'list', label: 'Loading approvals' })]);
    fillSlot(view, SLOTS.RELATED, [P.loadingState({ variant: 'list', label: 'Loading related information' })]);
    fillSlot(view, SLOTS.AI, [P.loadingState({ variant: 'list', label: 'Loading AI advisory' })]);
    fillSlot(view, SLOTS.ACTIVITY, [P.loadingState({ variant: 'list', label: 'Loading activity' })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders Global Approvals when it is the active workspace: the ready
   * experience once the state has loaded, the loading skeleton before that.
   */
  function renderActiveApprovals() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.APPROVALS) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.APPROVALS + '"]'
    );
    if (!view) {
      return;
    }

    var targetId = router.getCurrentRecordId ? router.getCurrentRecordId() : '';
    var viewModel = state
      ? collectViewModel(state, registry, targetId, AuditOS.permissions) : null;
    if (!viewModel) {
      renderLoading(view);
      return;
    }
    renderReady(view, viewModel, registry, targetId);
  }

  AuditOS.globalApprovalsWorkspace = {
    SLOTS: SLOTS,
    PENDING_APPROVAL_STATUSES: PENDING_APPROVAL_STATUSES,
    APPROVAL_TYPES: APPROVAL_TYPES,

    // Pure, offline-testable derivations.
    derivations: {
      isPendingApproval: isPendingApproval,
      deriveApprovalRows: deriveApprovalRows,
      deriveInboxGroups: deriveInboxGroups,
      deriveTypeCoverage: deriveTypeCoverage,
      deriveRoleContacts: deriveRoleContacts,
      deriveCoverageCounts: deriveCoverageCounts
    },

    collectViewModel: collectViewModel,

    /**
     * Binds Global Approvals to the router and the Shared Audit State. Safe
     * to call once, after the DOM is ready, the router has resolved the
     * initial route, and the framework has rendered its skeleton. Does
     * nothing when the routing or state foundations are absent, so the shell
     * degrades rather than throwing.
     */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveApprovals);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveApprovals);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveApprovals);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveApprovals);
      }
      renderActiveApprovals();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.globalApprovalsWorkspace.init);
    } else {
      AuditOS.globalApprovalsWorkspace.init();
    }
  }
})(window);
