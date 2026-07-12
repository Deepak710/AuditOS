/**
 * AuditOS Global Approvals Workspace
 * Platform Foundation II — GitHub Issue #34 (Global Approvals redesign /
 * Approval Workflow) / Platform Information Architecture — GitHub Issue #33
 * (§3 Global Approvals) / Workspaces and Navigation — Chapter 12
 *
 * The one actionable approval inbox of the entire platform, redesigned by
 * Issue #34 around inbox usability (Outlook / pull-request interaction
 * model): a searchable, filterable Split Pane rail of everything awaiting a
 * decision, and an inspector where the decision actually happens. Three live
 * approval types route through it today — evidence awaiting review, evidence
 * requests awaiting review, and Approval Workflow requests — and the
 * remaining platform types stay honestly reserved.
 *
 * Approval Workflow (Issue #34): sessions holding `approvals.decide` act
 * directly — Approve, Reject, Request Changes, Delegate, Assign Reviewer,
 * Escalate, Comment — as simulated Repository writes using the dataset's own
 * status vocabulary. Sessions without the capability never see disabled
 * controls: they create approval requests instead of changing business
 * state, and the shared Permission Notice explains the gate. Every action
 * records immutable Platform Audit Service events under one correlation id,
 * so the audit trail carries the complete decision story.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to every
 * other operational workspace. `collectViewModel` is the single place this
 * workspace reads business data, and it reads only through the Repository
 * Foundation (Issue #34 — the UI never touches JSON or the state store
 * directly). Search and type filtering are memory-only presentation state.
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
    TOOLBAR: 'workspace-toolbar',
    FILTERS: 'workspace-filters',
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
   * invented) — identical to the list the global header badge counts, so
   * every surface reports one number.
   */
  var PENDING_APPROVAL_STATUSES = ['Pending Review', 'Evidence Received - Under HA Review', 'Submitted'];

  /** The capability that gates recording an approval decision (Permission Foundation). */
  var DECIDE_CAPABILITY = 'approvals.decide';

  /** Approval Workflow status vocabulary (approvals collection, Issue #34). */
  var WORKFLOW_STATUS = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CHANGES_REQUESTED: 'Changes Requested',
    DELEGATED: 'Delegated',
    ESCALATED: 'Escalated'
  };

  /** Workflow statuses that keep a request in the inbox (still awaiting completion). */
  var OPEN_WORKFLOW_STATUSES = [
    WORKFLOW_STATUS.PENDING,
    WORKFLOW_STATUS.DELEGATED,
    WORKFLOW_STATUS.ESCALATED,
    WORKFLOW_STATUS.CHANGES_REQUESTED
  ];

  /**
   * Simulated decision transitions over the dataset's own evidence status
   * vocabulary (enums.json — read, never invented): approving review marks
   * the evidence received in full; rejecting or requesting changes returns
   * it for clarification.
   */
  var DECISION_STATUS = {
    approve: 'All Evidence Received',
    reject: 'Evidence Reviewed - Clarification Needed',
    'request-changes': 'Evidence Reviewed - Clarification Needed'
  };

  /** Decision → workflow record status. */
  var DECISION_WORKFLOW_STATUS = {
    approve: WORKFLOW_STATUS.APPROVED,
    reject: WORKFLOW_STATUS.REJECTED,
    'request-changes': WORKFLOW_STATUS.CHANGES_REQUESTED
  };

  /**
   * The approval types the platform is architected for. Three are live in
   * the data today; the rest are reserved and render honestly as such.
   * `filter` is the inbox type-filter key of the live types.
   */
  var APPROVAL_TYPES = [
    { key: 'evidence', label: 'Evidence', live: true },
    { key: 'requests', label: 'Evidence requests', live: true },
    { key: 'workflow', label: 'Workflow requests', live: true },
    { key: 'requirements', label: 'Requirements', live: false },
    { key: 'walkthroughs', label: 'Walkthroughs', live: false },
    { key: 'documentation', label: 'Documentation', live: false },
    { key: 'reports', label: 'Reports', live: false },
    { key: 'ai-recommendations', label: 'AI recommendations', live: false }
  ];

  /** Reviewer roles that may receive delegation / assignment. */
  var REVIEWER_ROLES = ['Reviewer 1', 'Reviewer 2'];

  /** Larger cap for the inbox rail, which is the working surface of this workspace. */
  var QUEUE_LIMIT = 50;

  /** Entrance stagger ceiling — sections beyond this share the last delay. */
  var STAGGER_LIMIT = WS.STAGGER_LIMIT;

  /**
   * Memory-only presentation state (search, type filter, selection). Never
   * business data; discarded on reload.
   */
  var presentationState = { query: '', type: 'all', selectedId: '' };

  // ------------------------------------------------------------------
  // Pure derivation helpers — no DOM, no repository access.
  // ------------------------------------------------------------------

  /** Returns the value when it is an array, otherwise an empty array. */
  var asArray = WS.asArray;

  /** Naive English pluralization for whole-count labels. */
  var plural = WS.plural;

  /** Whether a recorded status means the record awaits an approval decision. */
  function isPendingApproval(status) {
    return PENDING_APPROVAL_STATUSES.indexOf(status) !== -1;
  }

  /** Whether a workflow request status keeps it in the inbox. */
  function isOpenWorkflowStatus(status) {
    return OPEN_WORKFLOW_STATUSES.indexOf(status) !== -1;
  }

  /**
   * The pending approval rows of the whole platform, derived from each
   * operational engagement's own evidence and request records. Each row
   * carries its record, its engagement, its client, its dataset (so a
   * decision can write back), and its collection. Completed engagements are
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
          typeKey: 'evidence',
          collection: 'evidence',
          datasetId: entry.evidenceDatasetId || null,
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
          typeKey: 'requests',
          collection: 'evidence-requests',
          datasetId: entry.requestsDatasetId || null,
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

  /**
   * The open Approval Workflow requests (Issue #34) as inbox rows: requests
   * a user created because they could not change business state directly,
   * still awaiting an approver's completion.
   */
  function deriveWorkflowRows(approvals, companiesById, engagementsById) {
    return asArray(approvals).filter(function (request) {
      return isOpenWorkflowStatus(request.status);
    }).map(function (request) {
      return {
        id: request.id,
        kind: 'Workflow request',
        typeKey: 'workflow',
        collection: 'approvals',
        datasetId: null,
        title: request.title || request.id,
        status: request.status,
        engagement: engagementsById[request.engagementId] || null,
        company: companiesById[request.companyId] || null,
        record: request,
        approval: request
      };
    });
  }

  /**
   * Links each derived business row to the Approval Workflow request that
   * references its record, when one exists — the row's decision then
   * completes the request too, and the approval chain carries both.
   */
  function linkWorkflowRecords(rows, approvals) {
    var byEntityId = {};
    asArray(approvals).forEach(function (request) {
      if (request.entity && request.entity.recordId) {
        byEntityId[request.entity.recordId] = request;
      }
    });
    asArray(rows.evidence).concat(asArray(rows.requests)).forEach(function (row) {
      row.approval = byEntityId[row.id] || null;
    });
    return rows;
  }

  /** Whether one row matches the search query and type filter (memory-only presentation state). */
  function rowMatchesFilters(row, query, typeKey) {
    if (typeKey && typeKey !== 'all' && row.typeKey !== typeKey) {
      return false;
    }
    var text = (query || '').trim().toLowerCase();
    if (!text) {
      return true;
    }
    return [
      row.title, row.id, row.status,
      row.company ? row.company.name : '',
      row.engagement ? (row.engagement.engagementCode || row.engagement.id) : ''
    ].join(' ').toLowerCase().indexOf(text) !== -1;
  }

  /** The inbox groups after filtering: one labeled rail group per approval type with rows. */
  function deriveInboxGroups(rows, query, typeKey) {
    var groups = [];
    [
      { label: 'Evidence', rows: rows.evidence },
      { label: 'Evidence requests', rows: rows.requests },
      { label: 'Workflow requests', rows: rows.workflow || [] }
    ].forEach(function (group) {
      var matching = group.rows.filter(function (row) {
        return rowMatchesFilters(row, query, typeKey);
      });
      if (matching.length > 0) {
        groups.push({ label: group.label, rows: matching.slice(0, QUEUE_LIMIT) });
      }
    });
    return groups;
  }

  /** The type filter chips: All plus each live type with its live count. */
  function deriveTypeChips(rows, selectedType) {
    var counts = {
      evidence: rows.evidence.length,
      requests: rows.requests.length,
      workflow: (rows.workflow || []).length
    };
    var chips = [{
      key: 'all',
      label: 'All',
      count: counts.evidence + counts.requests + counts.workflow,
      selected: !selectedType || selectedType === 'all'
    }];
    APPROVAL_TYPES.filter(function (type) { return type.live; }).forEach(function (type) {
      chips.push({
        key: type.key,
        label: type.label,
        count: counts[type.key] || 0,
        selected: selectedType === type.key
      });
    });
    return chips;
  }

  /**
   * Approval-type coverage: the live pending count for the types that exist
   * in the data today, and an honest "Reserved" hint for the future types
   * the platform is architected to route through this inbox.
   */
  function deriveTypeCoverage(rows) {
    var counts = {
      evidence: rows.evidence.length,
      requests: rows.requests.length,
      workflow: (rows.workflow || []).length
    };
    return APPROVAL_TYPES.map(function (type) {
      if (!type.live) {
        return {
          title: type.label,
          description: 'Reserved — routes through this inbox once a future issue records its approvals.',
          meta: 'Reserved',
          tone: null
        };
      }
      var pending = counts[type.key] || 0;
      return {
        title: type.label,
        description: pending + ' ' + plural(pending, 'item') + ' awaiting a decision',
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

  /** The real users who may receive a delegation or assignment (reviewer roles). */
  function deriveReviewers(users) {
    return asArray(users).filter(function (user) {
      return asArray(user.roles).some(function (role) {
        return REVIEWER_ROLES.indexOf(role) !== -1;
      });
    });
  }

  /** The distinct engagements and clients the pending rows span. */
  function deriveCoverageCounts(rows) {
    var engagementIds = {};
    var companyIds = {};
    asArray(rows.evidence).concat(asArray(rows.requests)).concat(asArray(rows.workflow))
      .forEach(function (row) {
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
  // View model — the single place this workspace reads business data, and it
  // reads only through the Repository Foundation (Issue #34).
  // ------------------------------------------------------------------

  /** Indexes a list of records by their id field. */
  var indexById = WS.indexById;

  /**
   * Collects everything Global Approvals presents from the Repository.
   * `permissions` is the Permission Foundation and `filters` the memory-only
   * presentation state (both passed in so the collector stays
   * offline-testable). Returns null while the repository is not ready.
   */
  function collectViewModel(repository, workspaceRegistry, targetId, permissions, filters) {
    if (!repository || !repository.isReady()) {
      return null;
    }
    var filterState = filters || { query: '', type: 'all' };

    var status = repository.getStatus();
    var companiesById = indexById(repository.clients.list());
    var engagements = repository.engagements.list();
    var engagementsById = indexById(engagements);
    var users = repository.users.list();
    var approvals = repository.approvals.list();

    // Per-engagement operational documents for every non-completed
    // engagement, each carrying its dataset id so decisions can write back.
    // `datasetsForEngagement` resolves only the datasets an engagement
    // itself owns, so program-scoped pool datasets are never double-counted.
    var operationalEntries = engagements
      .filter(function (engagement) { return engagement.status !== ENGAGEMENT_STATUS.COMPLETED; })
      .map(function (engagement) {
        var evidenceDatasets = repository.evidence.datasetsForEngagement(engagement.id);
        var requestDatasets = repository.evidenceRequests.datasetsForEngagement(engagement.id);
        var requirementDatasets = repository.requirements.datasetsForEngagement(engagement.id);
        var evidenceDocument = evidenceDatasets.length > 0
          ? repository.evidence.getDocument({ datasetId: evidenceDatasets[0] }) : null;
        var requestsDocument = requestDatasets.length > 0
          ? repository.evidenceRequests.getDocument({ datasetId: requestDatasets[0] }) : null;
        var requirementsDocument = requirementDatasets.length > 0
          ? repository.requirements.getDocument({ datasetId: requirementDatasets[0] }) : null;
        return {
          engagement: engagement,
          company: companiesById[engagement.companyId] || null,
          evidenceDatasetId: evidenceDatasets[0] || null,
          requestsDatasetId: requestDatasets[0] || null,
          evidence: (evidenceDocument || {}).evidence || [],
          requests: (requestsDocument || {}).requests || [],
          requirementsById: indexById((requirementsDocument || {}).requirements || [])
        };
      });

    var rows = deriveApprovalRows(operationalEntries);
    rows.workflow = deriveWorkflowRows(approvals, companiesById, engagementsById);
    rows.total += rows.workflow.length;
    linkWorkflowRecords(rows, approvals);

    var groups = deriveInboxGroups(rows, filterState.query, filterState.type);
    var typeChips = deriveTypeChips(rows, filterState.type);
    var typeCoverage = deriveTypeCoverage(rows);
    var coverage = deriveCoverageCounts(rows);

    // The decision gate (Issue #33 §5): a denial explanation when the session
    // may not record decisions, plus the real users who hold the role.
    var denial = permissions && typeof permissions.explainDenial === 'function'
      ? permissions.explainDenial(DECIDE_CAPABILITY) : null;
    var contact = denial ? deriveRoleContacts(users, denial.requiredRoles) : '';

    return {
      degraded: false,
      status: status,
      rows: rows,
      groups: groups,
      typeChips: typeChips,
      typeCoverage: typeCoverage,
      coverage: coverage,
      pendingCount: rows.total,
      decisionGate: { denial: denial, contact: contact },
      reviewers: deriveReviewers(users),
      usersById: indexById(users),

      header: {
        eyebrow: 'Platform',
        meta: 'One actionable approval inbox across every client and engagement — search, filter, decide.'
      },

      ribbon: [
        { label: 'Pending', value: String(rows.total) },
        { label: 'Evidence', value: String(rows.evidence.length) },
        { label: 'Requests', value: String(rows.requests.length) },
        { label: 'Workflow', value: String(rows.workflow.length) },
        { label: 'Engagements', value: String(coverage.engagements) },
        { label: 'Clients', value: String(coverage.clients) }
      ],

      footer: [
        { label: 'Environment', value: 'Static prototype' },
        { label: 'Demo status', value: status.demoDataLoaded ? 'Demo data loaded' : 'Demo data degraded' },
        { label: 'Pending', value: String(rows.total) }
      ]
    };
  }

  // ------------------------------------------------------------------
  // Approval Workflow actions — simulated Repository writes (Issue #34).
  // Every user action runs under one correlation id and records immutable
  // audit events; nothing here touches demo-data files.
  // ------------------------------------------------------------------

  /** Today's date in the dataset's own ISO date convention. */
  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  /** The acting session's label, for workflow history entries (never an invented user). */
  function sessionLabel() {
    var permissions = AuditOS.permissions;
    return permissions && typeof permissions.getSessionInfo === 'function'
      ? permissions.getSessionInfo().label : '';
  }

  /**
   * Ensures a row has an Approval Workflow record to carry workflow-only
   * actions (delegate, assign, escalate, comment, request): returns the
   * existing linked record, or creates one referencing the row's entity.
   */
  function ensureWorkflowRecord(repository, row, reason, correlationId) {
    if (row.approval) {
      return row.approval;
    }
    return repository.approvals.create({
      type: row.kind + ' decision',
      title: row.kind + ' decision requested — ' + row.id,
      status: WORKFLOW_STATUS.PENDING,
      entity: { collection: row.collection, recordId: row.id, datasetId: row.datasetId },
      companyId: row.company ? row.company.id : null,
      programId: row.record && row.record.programId ? row.record.programId : null,
      engagementId: row.engagement ? row.engagement.id : null,
      workspaceId: 'approvals',
      requestedOn: todayIso(),
      requestedByLabel: sessionLabel(),
      reason: reason || null,
      comments: [],
      history: [{ action: 'Request created', actor: sessionLabel(), on: todayIso() }]
    }, {
      action: 'approval-request-created',
      reason: reason || null,
      workspaceId: 'approvals',
      correlationId: correlationId
    });
  }

  /** Appends one history entry to a workflow record (immutable trail on the record itself). */
  function appendWorkflowHistory(repository, approval, action, correlationId) {
    var history = asArray(approval.history).concat([{
      action: action,
      actor: sessionLabel(),
      on: todayIso()
    }]);
    return repository.approvals.update(approval.id, { history: history }, {
      action: 'approval-history-appended',
      workspaceId: 'approvals',
      correlationId: correlationId,
      silent: true
    });
  }

  /**
   * Records an approval decision (approve / reject / request-changes) on a
   * row: the business record's status transitions through the dataset's own
   * vocabulary, any linked workflow request completes, and the audit trail
   * carries the decision with its approval chain.
   */
  function decideRow(repository, row, decision, comment) {
    var auditService = AuditOS.auditService;
    var correlationId = auditService ? auditService.newCorrelationId() : null;
    var chain = [];

    // 1. Transition the business record (evidence / request rows).
    if (row.collection === 'evidence') {
      repository.evidence.update(row.id, { reviewStatus: DECISION_STATUS[decision] }, {
        datasetId: row.datasetId,
        action: 'approval-' + decision,
        reason: comment || null,
        workspaceId: 'approvals',
        engagementId: row.engagement ? row.engagement.id : null,
        companyId: row.company ? row.company.id : null,
        correlationId: correlationId
      });
    } else if (row.collection === 'evidence-requests') {
      repository.evidenceRequests.update(row.id, { status: DECISION_STATUS[decision] }, {
        datasetId: row.datasetId,
        action: 'approval-' + decision,
        reason: comment || null,
        workspaceId: 'approvals',
        engagementId: row.engagement ? row.engagement.id : null,
        companyId: row.company ? row.company.id : null,
        correlationId: correlationId
      });
    }

    // 2. Complete the workflow request (the row's own record for workflow
    //    rows, else the linked request when one exists).
    var approval = row.collection === 'approvals' ? row.record : row.approval;
    if (approval) {
      chain.push(approval.id);
      repository.approvals.update(approval.id, {
        status: DECISION_WORKFLOW_STATUS[decision],
        decidedOn: todayIso(),
        decidedByLabel: sessionLabel(),
        history: asArray(approval.history).concat([{
          action: DECISION_WORKFLOW_STATUS[decision], actor: sessionLabel(), on: todayIso()
        }]),
        comments: comment
          ? asArray(approval.comments).concat([{ author: sessionLabel(), on: todayIso(), text: comment }])
          : asArray(approval.comments)
      }, {
        action: 'approval-' + decision,
        reason: comment || null,
        workspaceId: 'approvals',
        correlationId: correlationId
      });
    }

    // 3. The decision itself, as one immutable audit event with the chain.
    if (auditService) {
      auditService.record({
        action: 'approval-decided',
        entity: { collection: row.collection, recordId: row.id, datasetId: row.datasetId },
        newValue: { decision: decision },
        reason: comment || null,
        approvalChain: chain,
        companyId: row.company ? row.company.id : null,
        engagementId: row.engagement ? row.engagement.id : null,
        workspaceId: 'approvals',
        correlationId: correlationId
      });
    }
  }

  /** Delegates, assigns, or escalates a row's workflow request (simulated). */
  function routeRow(repository, row, action, assignee) {
    var auditService = AuditOS.auditService;
    var correlationId = auditService ? auditService.newCorrelationId() : null;
    var approval = row.collection === 'approvals'
      ? row.record : ensureWorkflowRecord(repository, row, null, correlationId);
    if (!approval) {
      return;
    }
    var changes = {};
    var historyAction = '';
    if (action === 'delegate') {
      changes.status = WORKFLOW_STATUS.DELEGATED;
      changes.assignedToId = assignee ? assignee.id : null;
      changes.assignedRole = assignee ? asArray(assignee.roles).join(' · ') : null;
      historyAction = 'Delegated to ' + (assignee ? assignee.name : 'reviewer');
    } else if (action === 'assign') {
      changes.assignedToId = assignee ? assignee.id : null;
      changes.assignedRole = assignee ? asArray(assignee.roles).join(' · ') : null;
      historyAction = 'Reviewer assigned: ' + (assignee ? assignee.name : '');
    } else if (action === 'escalate') {
      changes.status = WORKFLOW_STATUS.ESCALATED;
      changes.escalatedOn = todayIso();
      historyAction = 'Escalated';
    }
    changes.history = asArray(approval.history).concat([{
      action: historyAction, actor: sessionLabel(), on: todayIso()
    }]);
    repository.approvals.update(approval.id, changes, {
      action: 'approval-' + action,
      workspaceId: 'approvals',
      engagementId: row.engagement ? row.engagement.id : null,
      companyId: row.company ? row.company.id : null,
      correlationId: correlationId
    });
  }

  /** Appends a comment to a row's workflow request (creating one when needed). */
  function commentOnRow(repository, row, text) {
    if (!text) {
      return;
    }
    var auditService = AuditOS.auditService;
    var correlationId = auditService ? auditService.newCorrelationId() : null;
    var approval = row.collection === 'approvals'
      ? row.record : ensureWorkflowRecord(repository, row, null, correlationId);
    if (!approval) {
      return;
    }
    repository.approvals.update(approval.id, {
      comments: asArray(approval.comments).concat([{
        author: sessionLabel(), on: todayIso(), text: text
      }])
    }, {
      action: 'approval-commented',
      workspaceId: 'approvals',
      engagementId: row.engagement ? row.engagement.id : null,
      correlationId: correlationId
    });
  }

  /**
   * The Approval Workflow fallback (Issue #34): a session without the decide
   * capability requests the decision instead of changing business state.
   */
  function requestApprovalForRow(repository, row, reason) {
    var auditService = AuditOS.auditService;
    var correlationId = auditService ? auditService.newCorrelationId() : null;
    if (row.approval || row.collection === 'approvals') {
      // A request already routes this record; add the reason as a comment.
      commentOnRow(repository, row, reason);
      return;
    }
    ensureWorkflowRecord(repository, row, reason, correlationId);
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

  /** Builds a labeled comment box: a textarea plus an action button. */
  function buildCommentBox(placeholder, buttonLabel, onSubmit) {
    var P = presentation();
    var wrap = el('div', 'aos-approvals__comment-box');
    var input = el('textarea', 'aos-approvals__comment-input');
    input.setAttribute('rows', '2');
    input.setAttribute('placeholder', placeholder);
    input.setAttribute('aria-label', placeholder);
    wrap.appendChild(input);
    var button = P.button({ label: buttonLabel, variant: 'subtle' });
    button.addEventListener('click', function () {
      onSubmit(input.value.trim());
      input.value = '';
    });
    wrap.appendChild(button);
    return wrap;
  }

  /**
   * Builds the decision action area for one row (Issue #34 — Approval
   * Workflow). Sessions holding the capability decide directly; sessions
   * without it create approval requests instead of changing business state —
   * actions are hidden, never disabled, and the shared Permission Notice
   * explains the gate.
   */
  function buildDecisionArea(row, model, repository) {
    var P = presentation();
    var area = el('div', 'aos-approvals__decision');

    if (!model.decisionGate.denial) {
      var actions = el('div', 'aos-action-group aos-approvals__decision-actions');
      actions.setAttribute('role', 'group');
      actions.setAttribute('aria-label', 'Approval decisions');
      [
        { id: 'approve', label: 'Approve', variant: 'primary' },
        { id: 'reject', label: 'Reject', variant: 'subtle' },
        { id: 'request-changes', label: 'Request changes', variant: 'subtle' }
      ].forEach(function (decision) {
        var button = P.button({ label: decision.label, variant: decision.variant });
        button.setAttribute('data-decision', decision.id);
        button.addEventListener('click', function () {
          presentationState.selectedId = '';
          decideRow(repository, row, decision.id, '');
        });
        actions.appendChild(button);
      });
      area.appendChild(actions);

      // Routing: delegate / assign a real reviewer, or escalate.
      if (model.reviewers.length > 0) {
        var routing = el('div', 'aos-approvals__routing');
        var select = el('select', 'aos-select__control');
        select.setAttribute('aria-label', 'Reviewer');
        model.reviewers.forEach(function (reviewer) {
          var option = el('option', null, reviewer.name + ' — ' + asArray(reviewer.roles).join(' · '));
          option.value = reviewer.id;
          select.appendChild(option);
        });
        routing.appendChild(select);
        [
          { id: 'delegate', label: 'Delegate' },
          { id: 'assign', label: 'Assign reviewer' }
        ].forEach(function (route) {
          var button = P.button({ label: route.label, variant: 'subtle' });
          button.addEventListener('click', function () {
            var reviewer = model.reviewers.filter(function (candidate) {
              return candidate.id === select.value;
            })[0] || model.reviewers[0];
            presentationState.selectedId = row.id;
            routeRow(repository, row, route.id, reviewer);
          });
          routing.appendChild(button);
        });
        var escalate = P.button({ label: 'Escalate', variant: 'subtle' });
        escalate.addEventListener('click', function () {
          presentationState.selectedId = row.id;
          routeRow(repository, row, 'escalate', null);
        });
        routing.appendChild(escalate);
        area.appendChild(routing);
      }

      area.appendChild(buildCommentBox('Add a comment', 'Comment', function (text) {
        presentationState.selectedId = row.id;
        commentOnRow(repository, row, text);
      }));
      return area;
    }

    // No decide capability: the Approval Workflow request path (Issue #34)
    // plus the shared explanation of the hidden decision actions.
    area.appendChild(WS.buildPermissionNotice(model.decisionGate.denial, model.decisionGate.contact));
    area.appendChild(buildCommentBox(
      row.approval || row.collection === 'approvals'
        ? 'Add a comment to the approval request'
        : 'Reason for the approval request',
      row.approval || row.collection === 'approvals' ? 'Comment' : 'Create approval request',
      function (text) {
        presentationState.selectedId = row.id;
        requestApprovalForRow(repository, row, text);
      }
    ));
    return area;
  }

  /**
   * Builds the Approval Inspector for one row: what it is, where it lives,
   * its workflow request, its comments, its contextual platform history
   * (recorded audit events — Issue #34), the stable record link (Issue
   * #31), and the decision area.
   */
  function buildInboxInspector(row, context) {
    var registry = context.workspaceRegistry;
    var model = context.model;
    var repository = context.repository;
    var targetWorkspace = row.collection === 'evidence-requests' || row.collection === 'evidence'
      ? registry.IDS.EVIDENCE : null;
    var href = targetWorkspace ? WS.buildRecordHref(registry, targetWorkspace, row.id) : null;

    var sections = [{
      title: 'Where it lives', kind: 'properties', columns: 2,
      rows: [
        { label: 'Client', value: row.company ? row.company.name : 'Not recorded' },
        { label: 'Engagement', value: row.engagement ? (row.engagement.name || row.engagement.id) : 'Not recorded' },
        { label: 'Status', value: row.status },
        { label: 'Record', value: row.id }
      ]
    }];

    var approval = row.collection === 'approvals' ? row.record : row.approval;
    if (approval) {
      sections.push({
        title: 'Approval request', kind: 'properties', columns: 2,
        rows: [
          { label: 'Request', value: approval.id },
          { label: 'Status', value: approval.status },
          { label: 'Assigned role', value: approval.assignedRole || 'Unassigned' },
          { label: 'Requested', value: approval.requestedOn || '' }
        ]
      });
      var comments = asArray(approval.comments).map(function (comment) {
        var author = comment.authorId && model.usersById[comment.authorId]
          ? model.usersById[comment.authorId].name : (comment.author || '');
        return { title: comment.text, meta: [author, comment.on].filter(Boolean).join(' · ') };
      });
      sections.push(WS.listSection('Comments', comments, 'No comments recorded'));
      var history = asArray(approval.history).map(function (entry) {
        var actor = entry.actorId && model.usersById[entry.actorId]
          ? model.usersById[entry.actorId].name : (entry.actor || '');
        return { title: entry.action, meta: [actor, entry.on].filter(Boolean).join(' · ') };
      });
      sections.push(WS.listSection('Workflow history', history, 'No workflow history recorded'));
    }

    // Contextual platform history (Issue #34): the immutable audit events
    // recorded against this record during this session.
    var auditService = AuditOS.auditService;
    var auditEvents = auditService ? auditService.listForEntity(row.id) : [];
    sections.push(WS.listSection('Platform history',
      auditEvents.slice(0, WS.LIST_LIMIT).map(function (event) {
        return {
          title: event.action,
          meta: [event.user, event.timestamp ? event.timestamp.slice(0, 16).replace('T', ' ') : '']
            .filter(Boolean).join(' · ')
        };
      }), 'No platform events recorded this session'));

    if (href) {
      sections.push(WS.listSection('Open the record',
        [{ title: 'Evidence workspace', tone: TONES.INFO, actions: [{ label: 'Open', href: href }] }], ''));
    }

    sections.push({
      title: 'Decision', kind: 'content',
      node: buildDecisionArea(row, model, repository)
    });

    return {
      eyebrow: row.kind,
      title: row.title,
      subtitle: [row.status, row.engagement ? (row.engagement.engagementCode || row.engagement.id) : '']
        .filter(Boolean).join(' · '),
      badges: [
        { label: row.status, tone: TONES.WARNING },
        { label: row.kind, tone: TONES.INFO }
      ],
      sections: sections
    };
  }

  /**
   * Builds the Inbox body: a Split Pane Master–Detail of every pending
   * approval, grouped by type, reusing the shared rail selection controller —
   * the record named by the route or the last action stays selected.
   */
  function buildInboxBody(model, workspaceRegistry, repository, targetId) {
    var P = presentation();
    if (model.groups.length === 0) {
      return P.emptyState({
        icon: '✓',
        title: presentationState.query || presentationState.type !== 'all'
          ? 'No approvals match the current filters'
          : 'Nothing awaiting a decision',
        description: 'Evidence, requests, and workflow requests awaiting an audit-team decision across every client appear here the moment they need one.'
      });
    }

    var wrap = el('div', 'aos-approvals__inbox');
    var detailMount = el('div', 'aos-approvals__detail-mount');
    var listNode = el('div', 'aos-approvals__row-list');
    listNode.setAttribute('role', 'list');
    WS.mountRailGroups('aos-approvals', listNode, detailMount, model.groups,
      { workspaceRegistry: workspaceRegistry, model: model, repository: repository },
      buildInboxRow, buildInboxInspector, null,
      presentationState.selectedId || targetId);

    wrap.appendChild(P.masterDetail({
      list: listNode, detail: detailMount, ratio: 38,
      listLabel: 'Pending approvals', detailLabel: 'Approval inspector'
    }));
    return wrap;
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /** Builds the wired search field (memory-only presentation state; Issue #34). */
  function buildSearchArea() {
    var field = el('div', 'aos-search-field');
    var icon = el('span', 'aos-search-field__icon', '⌕');
    icon.setAttribute('aria-hidden', 'true');
    field.appendChild(icon);
    var input = el('input', 'aos-search-field__input');
    input.setAttribute('type', 'search');
    input.setAttribute('placeholder', 'Search pending approvals');
    input.setAttribute('aria-label', 'Search pending approvals');
    input.value = presentationState.query;
    input.addEventListener('input', function () {
      presentationState.query = input.value;
      renderActiveApprovals({ preserveSearchFocus: true });
    });
    field.appendChild(input);
    var group = el('div', 'aos-toolbar-group');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Toolbar');
    group.appendChild(field);
    return group;
  }

  /** Builds the wired type filter chips — clicking a type filters immediately (Issue #34). */
  function buildTypeChipBar(typeChips) {
    var fragment = global.document.createDocumentFragment();
    typeChips.forEach(function (chip) {
      var node = el('button', 'aos-chip' + (chip.selected ? ' aos-chip--selected' : ''),
        chip.label + ' · ' + chip.count);
      node.setAttribute('type', 'button');
      node.setAttribute('aria-pressed', chip.selected ? 'true' : 'false');
      node.addEventListener('click', function () {
        presentationState.type = chip.key;
        renderActiveApprovals();
      });
      fragment.appendChild(node);
    });
    return fragment;
  }

  /** Renders the ready Global Approvals experience into the framework slots. */
  function renderReady(view, viewModel, workspaceRegistry, repository, targetId, options) {
    var P = presentation();

    AuditOS.workspaceFramework.configure(view, {
      shell: 'split',
      header: viewModel.header,
      contextSummary: viewModel.ribbon
    });

    // Wired toolbar and filter bar (search + immediate type filtering),
    // rendered after configure() so the framework's own pass never clears
    // them.
    fillSlot(view, SLOTS.TOOLBAR, [buildSearchArea()]);
    fillSlot(view, SLOTS.FILTERS, [buildTypeChipBar(viewModel.typeChips)]);

    var canvas = el('div', 'aos-approvals');
    canvas.setAttribute('data-canvas', 'flush');
    var inboxSection = buildSection('inbox', {
      kicker: 'Awaiting decision',
      title: 'Approval inbox',
      description: 'Every pending approval across every client and engagement; select a row to inspect and decide.'
    }, buildInboxBody(viewModel, workspaceRegistry, repository, targetId));
    inboxSection.classList.add('aos-rise-in');
    canvas.appendChild(inboxSection);
    fillSlot(view, SLOTS.CONTENT, [canvas]);

    // Restore focus into the search field when the re-render was triggered
    // by typing, so filtering never steals the keyboard.
    if (options && options.preserveSearchFocus) {
      var searchInput = view.querySelector('.aos-search-field__input');
      if (searchInput) {
        var length = searchInput.value.length;
        searchInput.focus();
        searchInput.setSelectionRange(length, length);
      }
    }

    var relatedItems = WS.resolveRelationships(workspaceRegistry, [
      { id: workspaceRegistry.IDS.EVIDENCE, title: 'Evidence', meta: String(viewModel.rows.evidence.length), present: true },
      { id: workspaceRegistry.IDS.WORKQUEUE, title: 'Work queue', meta: '', present: true },
      { id: workspaceRegistry.IDS.AUDIT_LOG, title: 'Audit log', meta: '', present: true }
    ]);
    var related = el('div', 'aos-approvals__related');
    related.appendChild(WS.buildRelatedBody(relatedItems, {
      icon: '◇', title: 'No related objects', description: 'Related destinations appear here.'
    }));
    // Approval-type coverage: live counts plus honestly reserved types.
    related.appendChild(P.itemList(viewModel.typeCoverage, { compact: true }));
    related.classList.add('aos-fade-in');
    fillSlot(view, SLOTS.RELATED, [related]);

    var ai = P.emptyState({
      icon: '✦', title: 'Reserved for AI advisory',
      description: 'AI-recommended approval routing will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
    });
    ai.classList.add('aos-tint-brand', 'aos-fade-in');
    fillSlot(view, SLOTS.AI, [ai]);

    // Activity: the immutable audit events this workspace recorded during
    // the session (Issue #34) — real events, never fabricated history.
    var auditService = AuditOS.auditService;
    var activityEvents = auditService
      ? auditService.list({ workspaceId: 'approvals' }).slice(0, WS.LIST_LIMIT).map(function (event) {
        return {
          title: event.action,
          description: [event.user, event.reason].filter(Boolean).join(' · '),
          timestamp: event.timestamp ? event.timestamp.slice(0, 16).replace('T', ' ') : ''
        };
      }) : [];
    var activity = WS.buildActivityBody(activityEvents, {
      icon: '◇', title: 'No decisions recorded',
      description: 'Approval decisions and workflow actions recorded this session appear here.'
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
  // Wiring — follows the router, the state events, and the session.
  // ------------------------------------------------------------------

  /**
   * Renders Global Approvals when it is the active workspace: the ready
   * experience once the repository is readable, the loading skeleton before
   * that.
   */
  function renderActiveApprovals(options) {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var repository = AuditOS.repository;
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
    var viewModel = repository
      ? collectViewModel(repository, registry, targetId, AuditOS.permissions, presentationState)
      : null;
    if (!viewModel) {
      renderLoading(view);
      return;
    }
    renderReady(view, viewModel, registry, repository, targetId, options);
  }

  /** Route changes reset the memory-only filters so each visit starts clean. */
  function handleRouteChanged(event) {
    if (event && event.detail && event.detail.workspaceId === AuditOS.workspaceRegistry.IDS.APPROVALS &&
        event.detail.previousWorkspaceId !== event.detail.workspaceId) {
      presentationState = { query: '', type: 'all', selectedId: '' };
    }
    renderActiveApprovals();
  }

  AuditOS.globalApprovalsWorkspace = {
    SLOTS: SLOTS,
    PENDING_APPROVAL_STATUSES: PENDING_APPROVAL_STATUSES,
    APPROVAL_TYPES: APPROVAL_TYPES,
    WORKFLOW_STATUS: WORKFLOW_STATUS,
    DECISION_STATUS: DECISION_STATUS,

    // Pure, offline-testable derivations.
    derivations: {
      isPendingApproval: isPendingApproval,
      isOpenWorkflowStatus: isOpenWorkflowStatus,
      deriveApprovalRows: deriveApprovalRows,
      deriveWorkflowRows: deriveWorkflowRows,
      linkWorkflowRecords: linkWorkflowRecords,
      rowMatchesFilters: rowMatchesFilters,
      deriveInboxGroups: deriveInboxGroups,
      deriveTypeChips: deriveTypeChips,
      deriveTypeCoverage: deriveTypeCoverage,
      deriveRoleContacts: deriveRoleContacts,
      deriveReviewers: deriveReviewers,
      deriveCoverageCounts: deriveCoverageCounts
    },

    collectViewModel: collectViewModel,

    // Approval Workflow actions (Issue #34) — simulated Repository writes,
    // exposed for the offline suites.
    workflow: {
      decideRow: decideRow,
      routeRow: routeRow,
      commentOnRow: commentOnRow,
      requestApprovalForRow: requestApprovalForRow,
      ensureWorkflowRecord: ensureWorkflowRecord
    },

    /**
     * Binds Global Approvals to the router, the Shared Audit State events,
     * and the session. Safe to call once, after the DOM is ready, the router
     * has resolved the initial route, and the framework has rendered its
     * skeleton. Does nothing when the routing foundation is absent, so the
     * shell degrades rather than throwing.
     */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, handleRouteChanged);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveApprovals);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveApprovals);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveApprovals);
      }
      // The decision gate follows Demo Mode role switches (Issue #34).
      var permissions = AuditOS.permissions;
      if (permissions && typeof permissions.subscribe === 'function') {
        permissions.subscribe(function () { renderActiveApprovals(); });
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
