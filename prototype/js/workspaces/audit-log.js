/**
 * AuditOS Global Audit Log Workspace
 * Platform Foundation II — GitHub Issue #34 (Platform Audit Service —
 * Global Audit Log)
 *
 * The platform-wide surface of the immutable audit trail: every event the
 * Platform Audit Service has recorded this session, newest first, with the
 * complete Issue #34 schema inspectable per event — timestamp, user, role,
 * session, action, entity, previous / new value, reason, approval chain,
 * hierarchy context, correlation id, and metadata.
 *
 * Honestly empty at baseline: the demo dataset fabricates no history, so
 * the log begins empty and fills as simulated actions are performed
 * (approval decisions, wizard completions, role switches). Reset discards
 * the trail with every other simulated write.
 *
 * Split Pane shell (Issue #34): the event rail and the event inspector
 * scroll independently. Visibility is gated by the Permission Foundation
 * (`audit-log.view`) — hidden from navigation for sessions without it, and
 * the workspace itself explains the gate on a direct deep link.
 *
 * Architecture: Business → ViewModel → Components → DOM. `collectViewModel`
 * reads only through the Platform Audit Service and the Repository
 * Foundation.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Shared Workspace Platform (Issue #27). */
  var WS = AuditOS.workspaceShared || {};

  /** The Shared Workspace Framework slots this workspace fills directly. */
  var SLOTS = {
    CONTENT: 'primary-content',
    RELATED: 'related-information',
    AI: 'ai-recommendations',
    ACTIVITY: 'activity',
    FOOTER: 'workspace-footer'
  };

  /** Presentation tones shared by badges, markers, and rails. */
  var TONES = WS.TONES;

  /** The capability that gates the audit trail (Permission Foundation). */
  var VIEW_CAPABILITY = 'audit-log.view';

  /** Returns the value when it is an array, otherwise an empty array. */
  var asArray = WS.asArray;

  /** Formats an ISO timestamp compactly and deterministically. */
  function formatTimestamp(iso) {
    return typeof iso === 'string' && iso.indexOf('T') !== -1
      ? iso.slice(0, 16).replace('T', ' ') : (iso || '');
  }

  /** Groups events by the calendar day they were recorded on, newest first. */
  function deriveEventGroups(events) {
    var byDay = {};
    var order = [];
    asArray(events).forEach(function (event) {
      var day = typeof event.timestamp === 'string' ? event.timestamp.slice(0, 10) : 'Undated';
      if (!byDay[day]) {
        byDay[day] = [];
        order.push(day);
      }
      byDay[day].push(event);
    });
    return order.map(function (day) {
      return { label: day, rows: byDay[day] };
    });
  }

  /**
   * Collects everything the Global Audit Log presents: the recorded events
   * (newest first) from the Platform Audit Service, plus resolution maps
   * for hierarchy context. Returns null while the repository is not ready.
   */
  function collectViewModel(repository, auditService, workspaceRegistry) {
    if (!repository || !repository.isReady() || !auditService) {
      return null;
    }
    var events = auditService.list();
    var companiesById = WS.indexById(repository.clients.list());
    var engagementsById = WS.indexById(repository.engagements.list());

    return {
      events: events,
      groups: deriveEventGroups(events),
      companiesById: companiesById,
      engagementsById: engagementsById,
      header: {
        eyebrow: 'Platform',
        meta: 'The immutable platform audit trail — every significant action recorded this session, newest first.'
      },
      ribbon: [
        { label: 'Recorded events', value: String(events.length) },
        { label: 'Baseline', value: 'Empty — no fabricated history' }
      ],
      footer: [
        { label: 'Environment', value: 'Static prototype' },
        { label: 'Events', value: String(events.length) }
      ]
    };
  }

  /** Creates an element with a class and optional text content. */
  var el = WS.el;

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /** Builds one row of the event rail: action, actor, and when. */
  function buildEventRow(event) {
    var P = WS.presentation();
    var node = el('button', null);
    node.type = 'button';

    var head = el('div', 'aos-audit-log__row-head');
    head.appendChild(el('span', 'aos-audit-log__row-title', event.action));
    if (event.workspaceId) {
      head.appendChild(P.statusBadge({ label: event.workspaceId, tone: TONES.INFO }));
    }
    node.appendChild(head);

    var meta = el('div', 'aos-audit-log__row-meta');
    meta.appendChild(el('span', null, formatTimestamp(event.timestamp)));
    if (event.user) {
      meta.appendChild(el('span', null, event.user));
    }
    node.appendChild(meta);
    return node;
  }

  /** Serializes a previous/new value for honest, compact display. */
  function formatValue(value) {
    if (value === null || value === undefined) {
      return 'None';
    }
    var text = JSON.stringify(value);
    return text.length > 300 ? text.slice(0, 300) + '…' : text;
  }

  /** Builds the Event Inspector: the complete Issue #34 audit schema. */
  function buildEventInspector(event, context) {
    var model = context.model;
    var company = event.companyId ? model.companiesById[event.companyId] : null;
    var engagement = event.engagementId ? model.engagementsById[event.engagementId] : null;
    return {
      eyebrow: 'Audit event',
      title: event.action,
      subtitle: formatTimestamp(event.timestamp),
      badges: [{ label: event.session || 'Session', tone: TONES.INFO }],
      sections: [
        {
          title: 'Actor', kind: 'properties', columns: 2,
          rows: [
            { label: 'User', value: event.user || 'Not recorded' },
            { label: 'Role', value: event.role || 'Not recorded' },
            { label: 'Session', value: event.session || 'Not recorded' },
            { label: 'Correlation', value: event.correlationId || 'None' }
          ]
        },
        {
          title: 'Entity', kind: 'properties', columns: 2,
          rows: event.entity ? [
            { label: 'Collection', value: event.entity.collection || '' },
            { label: 'Record', value: event.entity.recordId || '' },
            { label: 'Dataset', value: event.entity.datasetId || 'Shared' },
            { label: 'Workspace', value: event.workspaceId || '' }
          ] : [{ label: 'Entity', value: 'None — a platform-level action' }]
        },
        {
          title: 'Hierarchy', kind: 'properties', columns: 2,
          rows: [
            { label: 'Client', value: company ? company.name : (event.companyId || 'None') },
            { label: 'Program', value: event.programId || 'None' },
            { label: 'Engagement', value: engagement ? (engagement.name || engagement.id) : (event.engagementId || 'None') },
            { label: 'Approval chain', value: asArray(event.approvalChain).join(' · ') || 'None' }
          ]
        },
        WS.listSection('Change', [
          { title: 'Previous value', meta: formatValue(event.previousValue) },
          { title: 'New value', meta: formatValue(event.newValue) },
          { title: 'Reason', meta: event.reason || 'Not recorded' }
        ], ''),
        WS.listSection('Metadata',
          event.metadata ? [{ title: formatValue(event.metadata) }] : [],
          'No metadata recorded')
      ]
    };
  }

  /** Builds the event rail + inspector, or the honest empty state. */
  function buildLogBody(model) {
    var P = WS.presentation();
    if (model.events.length === 0) {
      return P.emptyState({
        icon: '◇',
        title: 'No platform events recorded this session',
        description: 'The audit trail begins empty — the platform fabricates no history. Decide an approval, switch a role, or complete a wizard, and every action appears here immutably.'
      });
    }

    var wrap = el('div', 'aos-audit-log__log');
    var detailMount = el('div', 'aos-audit-log__detail-mount');
    var listNode = el('div', 'aos-audit-log__row-list');
    listNode.setAttribute('role', 'list');
    WS.mountRailGroups('aos-audit-log', listNode, detailMount, model.groups,
      { model: model }, buildEventRow, buildEventInspector, null, '');

    wrap.appendChild(P.masterDetail({
      list: listNode, detail: detailMount, ratio: 38,
      listLabel: 'Audit events', detailLabel: 'Event inspector'
    }));
    return wrap;
  }

  /** Renders the Global Audit Log when it is the active workspace. */
  function renderActiveAuditLog() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var repository = AuditOS.repository;
    var auditService = AuditOS.auditService;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.AUDIT_LOG) {
      return;
    }
    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.AUDIT_LOG + '"]');
    if (!view) {
      return;
    }

    var P = WS.presentation();

    // Deep-linked without the capability: hidden from navigation already,
    // and the workspace itself explains the gate (Issue #33 §5).
    var permissions = AuditOS.permissions;
    var denial = permissions ? permissions.explainDenial(VIEW_CAPABILITY) : null;
    if (denial) {
      AuditOS.workspaceFramework.configure(view, {
        shell: 'single',
        header: { eyebrow: 'Platform', meta: 'The platform audit trail.' }
      });
      var gate = el('div', 'aos-audit-log__denied');
      gate.appendChild(WS.buildPermissionNotice(denial, ''));
      gate.appendChild(P.emptyState({
        icon: '◇', title: 'The audit trail is platform administration data',
        description: denial.reason
      }));
      fillSlot(view, SLOTS.CONTENT, [gate]);
      return;
    }

    var viewModel = collectViewModel(repository, auditService, registry);
    if (!viewModel) {
      fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'list', label: 'Loading audit trail' })]);
      return;
    }

    AuditOS.workspaceFramework.configure(view, {
      shell: 'split',
      header: viewModel.header,
      contextSummary: viewModel.ribbon
    });

    var canvas = el('div', 'aos-audit-log');
    canvas.setAttribute('data-canvas', 'flush');
    var section = WS.buildSection('aos-audit-log', 'events', {
      kicker: 'Immutable trail',
      title: 'Recorded events',
      description: 'Every significant action of this session, grouped by day, newest first. Events are append-only and discarded by reset.'
    }, buildLogBody(viewModel));
    section.classList.add('aos-rise-in');
    canvas.appendChild(section);
    fillSlot(view, SLOTS.CONTENT, [canvas]);

    var related = WS.buildRelatedBody(WS.resolveRelationships(registry, [
      { id: registry.IDS.APPROVALS, title: 'Global Approvals', meta: '', present: true },
      { id: registry.IDS.AI_USAGE, title: 'AI Usage', meta: '', present: true }
    ]), { icon: '◇', title: 'No related objects', description: 'Related destinations appear here.' });
    fillSlot(view, SLOTS.RELATED, [related]);

    var ai = P.emptyState({
      icon: '✦', title: 'Reserved for AI advisory',
      description: 'Anomaly surfacing over the audit trail arrives with the AI foundation. AI remains advisory; human approval remains mandatory.'
    });
    ai.classList.add('aos-tint-brand');
    fillSlot(view, SLOTS.AI, [ai]);

    fillSlot(view, SLOTS.FOOTER, [WS.buildFooterItems('aos-audit-log', viewModel.footer)]);
  }

  AuditOS.auditLogWorkspace = {
    SLOTS: SLOTS,
    derivations: {
      deriveEventGroups: deriveEventGroups,
      formatTimestamp: formatTimestamp
    },
    collectViewModel: collectViewModel,

    /** Binds the Global Audit Log to the router and the platform foundations. */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }
      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveAuditLog);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveAuditLog);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveAuditLog);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveAuditLog);
      }
      if (AuditOS.permissions && typeof AuditOS.permissions.subscribe === 'function') {
        AuditOS.permissions.subscribe(renderActiveAuditLog);
      }
      renderActiveAuditLog();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.auditLogWorkspace.init);
    } else {
      AuditOS.auditLogWorkspace.init();
    }
  }
})(window);
