/**
 * AuditOS Operational Work Queue Workspace
 * Workspaces and Navigation — Chapter 12 / Workspace Architecture — Chapter 61 /
 * Audit Lifecycle — Chapter 11 / Component Architecture — Chapter 74
 *
 * The single operational queue of work across the entire engagement (GitHub
 * Issue #28). It answers one question: "What requires my attention right
 * now?" Every operational workspace — Walkthrough, Evidence, Requirements,
 * Controls, Testing, Findings, and Documentation — contributes work items;
 * this workspace aggregates them into one queue. Release 1 aggregates only
 * work already represented in the existing engagement-scoped JSON: no AI, no
 * workflow engine, no writes, no task generation. In Release 2, work items
 * may be generated, assigned, and progressed by AI agents under human
 * approval; this workspace opens that seam without implementing it.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to every
 * other operational workspace. `collectViewModel` is the single place this
 * workspace reads `AuditOS.state`; it returns a declarative model of pure,
 * offline-testable derivations. The renderer configures the Shared Workspace
 * Framework's inherited skeleton (`AuditOS.workspaceFramework.configure`) and
 * fills its slots with compositions from the Enterprise Data Presentation
 * System (`AuditOS.presentation`) — no bespoke primitives, no duplicated
 * components (Component Design Patterns §81.4 — Composition Over
 * Duplication).
 *
 * One work item is derived per real record already recorded for the current
 * engagement: every finding, every test, every control, every requirement,
 * every evidence request, every evidence item, and (at most) one item for the
 * engagement's documentation record. Walkthroughs have no registered
 * demo-data collection in this prototype (the Walkthrough Workspace already
 * renders this gap honestly), so the walkthrough category always yields zero
 * items — never a fabricated session. Every item carries the real status (or
 * severity/result/reviewStatus) its own record already declares; nothing is
 * invented. A work item's Priority (Blocking / High / Normal / Completed) is a
 * derived classification, not a fabricated business judgement: terminal
 * statuses (Approved, Active, Completed, Closed, …) always resolve to
 * Completed; a domain's own escalation signal — a finding's severity, a
 * test's Fail result, a request's recorded priority — can raise a
 * non-terminal status to Blocking or High; every other real status resolves
 * to Normal. The same classification function is used for every domain, so
 * the vocabulary stays one, consistent scale across the whole queue.
 *
 * Release 1 resolves each item's related object only through the engagement's
 * own control and requirement sets it already reads (`controlId` /
 * `requirementId`), not through the shared control library the domain
 * workspaces additionally join — a deliberately smaller scope than the
 * Findings or Testing workspace, because this workspace's purpose is
 * cross-workspace triage, not full relationship depth. An identifier that
 * does not join renders as its raw value — never a fabricated label.
 *
 * The Unified Work Queue is the primary operational surface. It renders every
 * work item once and offers two independent, presentation-only filters — by
 * workspace and by priority — that regroup the same dataset; changing either
 * filter never adds, removes, or mutates a work item. Selecting a row opens
 * the Work Item Inspector beside it. The inspector renderer is host-agnostic
 * (data in, one self-contained node out), and it exposes the related object
 * and the required action only when the source record actually carries them,
 * never fabricating a conclusion.
 *
 * Presentation only. Every business value is read through `AuditOS.state`;
 * nothing is written. Sections with no data render shared Empty State
 * components; nothing is fabricated.
 *
 * Structure of this file (Coding Standards §30.8): constants, pure derivation
 * helpers (no DOM, no state access), the view-model collector (the single
 * state read), generic DOM builders (compose the presentation system), slot
 * renderers, and the route / state wiring.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Shared Workspace Platform (Issue #27) — harmonized helpers reused across every operational workspace. */
  var WS = AuditOS.workspaceShared || {};

  /** Cross-Workspace Relationship Engine (Issue #30) — shared relationship/derivation layer. */
  var RE = AuditOS.relationships || {};

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

  /** Presentation tones shared by badges, markers, and rails. */
  var TONES = WS.TONES;

  /**
   * The Work Queue's own priority vocabulary (GitHub Issue #28 — Priority
   * Filter). This is a classification the Work Queue derives, not a status any
   * single domain records: every domain's real status/severity/result maps
   * into one of these four buckets through `classifyPriority`.
   */
  var PRIORITIES = { BLOCKING: 'Blocking', HIGH: 'High', NORMAL: 'Normal', COMPLETED: 'Completed' };

  /** Canonical priority order, most urgent first, so the queue and filters read consistently. */
  var PRIORITY_ORDER = [PRIORITIES.BLOCKING, PRIORITIES.HIGH, PRIORITIES.NORMAL, PRIORITIES.COMPLETED];

  /** Priority → tone (Blocking reads as an exception, Completed as resolved). */
  var PRIORITY_TONES = {
    'Blocking': TONES.ERROR,
    'High': TONES.WARNING,
    'Normal': TONES.INFO,
    'Completed': TONES.SUCCESS
  };

  /**
   * Statuses that recur across the operational domains' own real vocabulary
   * (Controls / Requirements / Testing / Findings / Evidence) and mean the
   * record has reached a terminal, resolved state. Read, never invented —
   * every value here already appears in at least one domain's own JSON.
   */
  var TERMINAL_STATUSES = [
    'Completed', 'Approved', 'Active', 'Closed', 'Final', 'Retired', 'Obsolete', 'Accepted', 'Accepted Risk'
  ];

  /** Statuses that mean a record needs urgent, blocking attention. */
  var BLOCKING_STATUSES = ['Rejected', 'Fail', 'Retesting Required'];

  /** Statuses that mean a record is awaiting review or approval. */
  var REVIEW_STATUSES = ['Pending Review', 'In Review', 'Under Review', 'Submitted', 'Needs Review'];

  /**
   * Status → tone across the combined vocabulary the Work Queue displays raw
   * (each domain's own workspace owns its own richer resolver; this is the
   * neutral, cross-domain reading for one unified queue). An unmapped status
   * resolves to a neutral info tone.
   */
  var STATUS_TONES = {
    'Draft': null, 'Planning': null, 'Not Started': null, 'Scheduled': null,
    'Pending': TONES.WARNING, 'In Progress': TONES.INFO, 'Updated': TONES.INFO,
    'In Review': TONES.WARNING, 'Pending Review': TONES.WARNING, 'Under Review': TONES.INFO,
    'Submitted': TONES.INFO, 'Needs Review': TONES.WARNING, 'Retesting Required': TONES.WARNING,
    'Open': TONES.WARNING, 'In Remediation': TONES.WARNING,
    'Active': TONES.SUCCESS, 'Approved': TONES.SUCCESS, 'Accepted': TONES.SUCCESS,
    'Accepted Risk': TONES.INFO, 'Completed': TONES.SUCCESS, 'Closed': TONES.SUCCESS,
    'Final': TONES.SUCCESS, 'Retired': null, 'Obsolete': null,
    'Rejected': TONES.ERROR, 'Fail': TONES.ERROR
  };

  /**
   * The six operational item types the Work Queue aggregates (§ Workspace
   * Filter), in audit-lifecycle order. Requirements ceased to exist as a
   * user-facing workspace (Issue #39 — Evidence is the operational object);
   * requirement-driven work reaches the queue through evidence requests.
   */
  var ITEM_TYPES = {
    WALKTHROUGH: 'Walkthrough',
    EVIDENCE: 'Evidence',
    CONTROLS: 'Controls',
    TESTING: 'Testing',
    FINDINGS: 'Findings',
    DOCUMENTATION: 'Documentation'
  };

  /** Canonical item-type order for the health strip and the workspace filter. */
  var ITEM_TYPE_ORDER = [
    ITEM_TYPES.WALKTHROUGH, ITEM_TYPES.EVIDENCE, ITEM_TYPES.CONTROLS,
    ITEM_TYPES.TESTING, ITEM_TYPES.FINDINGS, ITEM_TYPES.DOCUMENTATION
  ];

  /** The Workspace Filter options (§ Workspace Structure): "All workspaces" plus one per item type. */
  var WORKSPACE_FILTER_OPTIONS = ['All workspaces'].concat(ITEM_TYPE_ORDER);

  /** The Priority Filter options (§ Workspace Structure): "All priorities" plus the four priority buckets. */
  var PRIORITY_FILTER_OPTIONS = ['All priorities'].concat(PRIORITY_ORDER);

  /** Maximum entries per supporting list so panels stay scannable. */
  var LIST_LIMIT = WS.LIST_LIMIT;

  /** Entrance stagger ceiling — sections beyond this share the last delay. */
  var STAGGER_LIMIT = WS.STAGGER_LIMIT;

  // ------------------------------------------------------------------
  // Pure derivation helpers — no DOM, no AuditOS.state access. Each takes plain
  // records and returns plain view data, so the offline unit suites exercise
  // them directly (derived values remain derived, §30.12).
  // ------------------------------------------------------------------

  /** Returns the value when it is an array, otherwise an empty array. */
  var asArray = WS.asArray;

  /** Formats an ISO `YYYY-MM-DD` date as a compact, deterministic label. */
  var formatDate = WS.formatDate;

  /** Formats a `{ startDate, endDate }` period as `start – end`. */
  var formatPeriod = WS.formatPeriod;

  /** The frameworks attached to an engagement, always as an array (identical seam to every other workspace). */
  var normalizeFrameworks = WS.normalizeFrameworks;

  /** The current engagement: identical rule to every other operational workspace. */
  var deriveCurrentEngagement = WS.deriveCurrentEngagement;

  /** Resolves a record's name field from an id map, falling back to the raw id (join-or-raw, never fabricated). */
  var resolveName = WS.resolveName;

  /** Resolves a raw status to a cross-domain presentation tone (neutral when unmapped). */
  function resolveStatusTone(status) {
    return Object.prototype.hasOwnProperty.call(STATUS_TONES, status) ? STATUS_TONES[status] : TONES.INFO;
  }

  /** Resolves a Work Queue priority bucket to its tone. */
  function resolvePriorityTone(priority) {
    return Object.prototype.hasOwnProperty.call(PRIORITY_TONES, priority) ? PRIORITY_TONES[priority] : null;
  }

  /**
   * Classifies a real, recorded status (optionally escalated by a domain's own
   * signal — a severity, a result, a recorded priority) into the Work Queue's
   * priority vocabulary. A terminal status always reads Completed, regardless
   * of escalation (an Approved record needs no further action even if its
   * severity was once High; a Completed test with a Fail result reads
   * Completed too — its status is the procedure's execution state, and the
   * exception it raised already surfaces as its own Blocking work item
   * through the linked finding's severity, so the same exception is never
   * double-counted across two categories). Escalation only raises a non-terminal status: a
   * `'blocking'` escalation reads Blocking, a `'high'` escalation reads at
   * least High; otherwise the status's own review/blocking vocabulary
   * applies, and anything else reads Normal. Never a fabricated bucket — every
   * input is a value the source record already carries.
   */
  function classifyPriority(status, escalate) {
    if (TERMINAL_STATUSES.indexOf(status) !== -1) {
      return PRIORITIES.COMPLETED;
    }
    if (escalate === 'blocking' || BLOCKING_STATUSES.indexOf(status) !== -1) {
      return PRIORITIES.BLOCKING;
    }
    if (escalate === 'high' || REVIEW_STATUSES.indexOf(status) !== -1) {
      return PRIORITIES.HIGH;
    }
    return PRIORITIES.NORMAL;
  }

  /** A finding's severity read as a Work Queue escalation signal (Critical/High blocks, Medium reviews). */
  function escalateFromSeverity(severity) {
    if (severity === 'Critical' || severity === 'High') { return 'blocking'; }
    if (severity === 'Medium') { return 'high'; }
    return null;
  }

  /** A test's recorded result read as a Work Queue escalation signal (a Fail result blocks). */
  function escalateFromResult(result) {
    return result === 'Fail' ? 'blocking' : null;
  }

  /** A recorded request/requirement priority read as a Work Queue escalation signal. */
  function escalateFromRecordedPriority(priority) {
    if (priority === 'High') { return 'blocking'; }
    if (priority === 'Medium') { return 'high'; }
    return null;
  }

  /** The engagement control a finding/test relates to, resolved only through the engagement's own control set. */
  function relatedControlLabel(controlId, controlsById) {
    var control = controlId && controlsById ? controlsById[controlId] : null;
    if (!control) {
      return controlId || '';
    }
    return [control.controlId, control.title].filter(Boolean).join(' · ') || controlId;
  }

  /**
   * The Findings work items — one per recorded finding. Priority reads the
   * finding's own severity as an escalation over its status: a Critical/High
   * severity finding that is not yet closed reads Blocking, a Medium severity
   * finding reads at least High. The related control resolves only through the
   * engagement's own control set; an unresolved identifier renders raw.
   */
  function deriveFindingItems(findings, context) {
    var ctx = context || {};
    return asArray(findings).map(function (finding) {
      var source = finding || {};
      var control = relatedControlLabel(source.controlId, ctx.controlsById);
      var priority = classifyPriority(source.status, escalateFromSeverity(source.severity));
      return {
        key: 'findings-' + (source.id || ''),
        itemType: ITEM_TYPES.FINDINGS,
        title: source.title || source.id || '',
        owner: resolveName(ctx.pocsById, source.ownerPocId, 'name') || source.ownerPocId || '',
        status: source.status || '',
        statusTone: resolveStatusTone(source.status),
        priority: priority,
        priorityTone: resolvePriorityTone(priority),
        meta: control,
        dueDate: source.targetClosureDate || '',
        related: control ? { label: 'Related control', value: control } : null,
        actionText: source.recommendation || '',
        record: source
      };
    });
  }

  /**
   * The Testing work items — one per recorded test. Priority reads the test's
   * own recorded result as an escalation over its status: a Fail result always
   * reads Blocking. The related control resolves only through the
   * engagement's own control set.
   */
  function deriveTestingItems(tests, context) {
    var ctx = context || {};
    return asArray(tests).map(function (test) {
      var source = test || {};
      var control = relatedControlLabel(source.controlId, ctx.controlsById);
      var priority = classifyPriority(source.status, escalateFromResult(source.result));
      return {
        key: 'testing-' + (source.id || ''),
        itemType: ITEM_TYPES.TESTING,
        title: source.procedure || source.id || '',
        owner: source.testedBy || '',
        status: source.status || '',
        statusTone: resolveStatusTone(source.status),
        priority: priority,
        priorityTone: resolvePriorityTone(priority),
        meta: control,
        dueDate: '',
        related: control ? { label: 'Related control', value: control } : null,
        actionText: source.notes || '',
        record: source
      };
    });
  }

  /**
   * The Controls work items — one per recorded control. No escalation signal:
   * a control's own status is the only recorded classification input.
   */
  function deriveControlItems(controls) {
    return asArray(controls).map(function (control) {
      var source = control || {};
      var priority = classifyPriority(source.status, null);
      return {
        key: 'controls-' + (source.id || ''),
        itemType: ITEM_TYPES.CONTROLS,
        title: source.title || source.controlId || source.id || '',
        owner: source.controlOwner || source.ownerId || source.ownerPocId || '',
        status: source.status || '',
        statusTone: resolveStatusTone(source.status),
        priority: priority,
        priorityTone: resolvePriorityTone(priority),
        meta: source.category || '',
        dueDate: '',
        related: null,
        actionText: '',
        record: source
      };
    });
  }

  /**
   * The Evidence work items drawn from evidence requests — one per recorded
   * request ("Requested evidence" — § Product Philosophy). Priority reads the
   * request's own recorded priority as an escalation over its status. The
   * related requirement resolves only through the engagement's own
   * requirement set.
   */
  function deriveEvidenceRequestItems(requests, context) {
    var ctx = context || {};
    return asArray(requests).map(function (request) {
      var source = request || {};
      var requirementLabel = resolveName(ctx.requirementsById, source.requirementId, 'title') || source.requirementId || '';
      var priority = classifyPriority(source.status, escalateFromRecordedPriority(source.priority));
      return {
        key: 'evidence-request-' + (source.id || ''),
        itemType: ITEM_TYPES.EVIDENCE,
        subtype: 'Request',
        title: 'Evidence request · ' + (requirementLabel || source.id || ''),
        owner: resolveName(ctx.pocsById, source.assignedToPocId, 'name') || source.assignedToPocId || '',
        status: source.status || '',
        statusTone: resolveStatusTone(source.status),
        priority: priority,
        priorityTone: resolvePriorityTone(priority),
        meta: requirementLabel,
        dueDate: source.dueDate || '',
        related: requirementLabel ? { label: 'Related requirement', value: requirementLabel } : null,
        actionText: source.comments || '',
        record: source
      };
    });
  }

  /**
   * The Evidence work items drawn from evidence already submitted — one per
   * recorded evidence item ("Evidence awaiting approval" — § Product
   * Philosophy). Priority reads the item's own recorded review status.
   */
  function deriveEvidenceLibraryItems(evidenceRecords, context) {
    var ctx = context || {};
    return asArray(evidenceRecords).map(function (item) {
      var source = item || {};
      var priority = classifyPriority(source.reviewStatus, null);
      return {
        key: 'evidence-item-' + (source.id || ''),
        itemType: ITEM_TYPES.EVIDENCE,
        subtype: 'Item',
        title: source.title || source.fileName || source.id || '',
        owner: resolveName(ctx.pocsById, source.uploadedByPocId, 'name') || source.uploadedByPocId || '',
        status: source.reviewStatus || '',
        statusTone: resolveStatusTone(source.reviewStatus),
        priority: priority,
        priorityTone: resolvePriorityTone(priority),
        meta: source.fileType || source.evidenceType || '',
        dueDate: '',
        related: null,
        actionText: '',
        record: source
      };
    });
  }

  /**
   * The Documentation work item — at most one, resolved from the engagement's
   * own report document ("Documentation requiring review" — § Product
   * Philosophy). The demo documentation records no per-section review status
   * (the Documentation Workspace's own sections carry only a source and a
   * references block, never a status), so Release 1 surfaces the document's
   * own recorded status as the single work item for the whole record — never
   * a fabricated per-section status. An engagement with no report document
   * yields no item.
   */
  function deriveDocumentationItems(reportsDocument, engagement) {
    var doc = reportsDocument && reportsDocument.document;
    if (!doc) {
      return [];
    }
    var meta = (reportsDocument && reportsDocument.metadata) || {};
    var priority = classifyPriority(doc.status, null);
    return [{
      key: 'documentation-' + (meta.reportId || 'document'),
      itemType: ITEM_TYPES.DOCUMENTATION,
      title: doc.title || 'Engagement documentation',
      owner: engagement ? (engagement.engagementLead || engagement.auditor || '') : '',
      status: doc.status || '',
      statusTone: resolveStatusTone(doc.status),
      priority: priority,
      priorityTone: resolvePriorityTone(priority),
      meta: doc.version ? 'Version ' + doc.version : '',
      dueDate: '',
      related: null,
      actionText: '',
      record: reportsDocument
    }];
  }

  /**
   * The Walkthrough work items — always empty in Release 1. The demo-data
   * catalog carries no walkthrough collection yet (the Walkthrough Workspace
   * already renders this gap through the shared Empty State), so this
   * function never fabricates a pending session; the moment a `walkthroughs`
   * collection exists, this is the one place a future release adds the read.
   */
  function deriveWalkthroughItems() {
    return [];
  }

  /**
   * Resolves a work item's owning workspace against the Workspace Registry, so
   * the master rail and the Related Information panel can link into it. Pure
   * given a registry; returns null when the registry (or a mapped workspace)
   * is absent, so callers degrade rather than throw.
   */
  function resolveItemWorkspace(itemType, workspaceRegistry) {
    if (!workspaceRegistry) {
      return null;
    }
    var ids = workspaceRegistry.IDS;
    var idByType = {
      Walkthrough: ids.WALKTHROUGH,
      Evidence: ids.EVIDENCE,
      Controls: ids.CONTROLS,
      Testing: ids.TESTING,
      Findings: ids.FINDINGS,
      Documentation: ids.DOCUMENTATION
    };
    var workspace = workspaceRegistry.findById(idByType[itemType]);
    return workspace ? { label: workspace.label, path: workspace.path } : null;
  }

  /** Attaches each item's resolved workspace reference in place, then returns the same array. */
  function attachWorkspaceRefs(items, workspaceRegistry) {
    asArray(items).forEach(function (item) {
      item.workspace = resolveItemWorkspace(item.itemType, workspaceRegistry);
    });
    return items;
  }

  /**
   * The Unified Work Queue — every work item rendered once, ordered by
   * priority (most urgent first), then by item type, then by title, so the
   * surface reads as a stable, real triage order. Nothing is capped or
   * filtered here: the queue is the full aggregated dataset the presentation
   * filters regroup.
   */
  function deriveQueue(items) {
    return asArray(items).slice().sort(function (a, b) {
      var pa = PRIORITY_ORDER.indexOf(a.priority);
      var pb = PRIORITY_ORDER.indexOf(b.priority);
      if (pa !== pb) {
        return pa - pb;
      }
      if (a.itemType !== b.itemType) {
        return a.itemType.localeCompare(b.itemType);
      }
      return String(a.title).localeCompare(String(b.title));
    });
  }

  /** Orders the keys of a count map by a canonical list, unknown keys alphabetically after. */
  function orderedKeys(counts, order) {
    return Object.keys(counts).sort(function (a, b) {
      var ia = order.indexOf(a);
      var ib = order.indexOf(b);
      if (ia === -1 && ib === -1) { return a.localeCompare(b); }
      if (ia === -1) { return 1; }
      if (ib === -1) { return -1; }
      return ia - ib;
    });
  }

  /** Lowercases and hyphenates a label for a stable indicator key. */
  function slug(value) {
    return String(value).toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * The Operational Health strip — one indicator per item type actually
   * present in the queue (labelled by the type, valued by its real count,
   * canonical lifecycle order), reading an error tone when that type carries
   * a Blocking item, then a derived Blocking indicator across the whole queue.
   * Every value is a real count of real, aggregated records; an engagement
   * with no work items yields a single Work items / None indicator. Never a
   * fabricated count.
   */
  function deriveWorkQueueHealth(queue) {
    var list = asArray(queue);
    if (list.length === 0) {
      return [{ key: 'work-items', label: 'Work items', status: 'None', tone: TONES.SUCCESS }];
    }

    var counts = {};
    var blockingCounts = {};
    list.forEach(function (item) {
      counts[item.itemType] = (counts[item.itemType] || 0) + 1;
      if (item.priority === PRIORITIES.BLOCKING) {
        blockingCounts[item.itemType] = (blockingCounts[item.itemType] || 0) + 1;
      }
    });

    var indicators = orderedKeys(counts, ITEM_TYPE_ORDER).map(function (type) {
      var blocking = blockingCounts[type] || 0;
      return {
        key: 'category-' + slug(type),
        label: type,
        status: String(counts[type]),
        tone: blocking > 0 ? TONES.ERROR : TONES.INFO
      };
    });

    var totalBlocking = list.filter(function (item) { return item.priority === PRIORITIES.BLOCKING; }).length;
    indicators.push({
      key: 'blocking',
      label: 'Blocking',
      status: totalBlocking > 0 ? String(totalBlocking) : 'None',
      tone: totalBlocking > 0 ? TONES.ERROR : TONES.SUCCESS
    });

    return indicators;
  }

  /**
   * The overall Work Queue status for the header badge: No work items when
   * the queue is empty, a Blocking count when any item is Blocking, an Open
   * count when items remain outstanding but none block, All clear once every
   * item has reached Completed. Derived from real priority counts; never a
   * fabricated aggregate.
   */
  function deriveWorkQueueStatus(queue) {
    var list = asArray(queue);
    if (list.length === 0) {
      return { label: 'No work items', tone: null };
    }
    var blocking = list.filter(function (item) { return item.priority === PRIORITIES.BLOCKING; }).length;
    if (blocking > 0) {
      return { label: blocking + ' blocking', tone: TONES.ERROR };
    }
    var open = list.filter(function (item) { return item.priority !== PRIORITIES.COMPLETED; }).length;
    if (open > 0) {
      return { label: open + ' open', tone: TONES.WARNING };
    }
    return { label: 'All clear', tone: TONES.SUCCESS };
  }

  /**
   * Filters the queue by workspace item type and by priority — both
   * presentation-only (§ Workspace Filter / § Priority Filter): the "All"
   * sentinel (or an absent value) matches everything, so combining both
   * filters never removes a work item from the underlying dataset, only from
   * the current view.
   */
  function filterQueue(queue, itemType, priority) {
    return asArray(queue).filter(function (item) {
      var matchesType = !itemType || itemType === WORKSPACE_FILTER_OPTIONS[0] || item.itemType === itemType;
      var matchesPriority = !priority || priority === PRIORITY_FILTER_OPTIONS[0] || item.priority === priority;
      return matchesType && matchesPriority;
    });
  }

  /**
   * Related audit objects for the supporting panel: the seven operational
   * workspaces the Work Queue aggregates, each with its real item count, only
   * when it carries at least one item.
   */
  function deriveRelationships(workspaceRegistry, queue) {
    if (!workspaceRegistry) {
      return [];
    }
    var counts = {};
    asArray(queue).forEach(function (item) {
      counts[item.itemType] = (counts[item.itemType] || 0) + 1;
    });
    var ids = workspaceRegistry.IDS;
    var related = ITEM_TYPE_ORDER.map(function (type) {
      return {
        id: resolveItemWorkspace(type, workspaceRegistry) ? idFor(type, ids) : null,
        title: type,
        meta: String(counts[type] || 0),
        present: (counts[type] || 0) > 0
      };
    });
    return WS.resolveRelationships(workspaceRegistry, related);
  }

  /** The Workspace Registry id for an item type (used only by `deriveRelationships`). */
  function idFor(type, ids) {
    var idByType = {
      Walkthrough: ids.WALKTHROUGH,
      Evidence: ids.EVIDENCE,
      Controls: ids.CONTROLS,
      Testing: ids.TESTING,
      Findings: ids.FINDINGS,
      Documentation: ids.DOCUMENTATION
    };
    return idByType[type];
  }

  /**
   * Recent work-queue activity, newest first, drawn only from dated history a
   * source record carries (activity / history entries, or a recorded update
   * timestamp) — the same idiom every operational workspace uses. The current
   * demo records no dated events for any domain, so this yields an empty feed
   * and the shared Empty State — never a fabricated event.
   */
  function deriveActivity(queue) {
    return RE.deriveActivityFromHistory(queue, {
      getRecord: function (item) { return item.record || {}; },
      entityNoun: function (item) { return item.itemType; },
      getSubject: function (record, item) { return item.title || ''; },
      resolveTone: resolveStatusTone,
      getUpdatedMeta: function (record, item) { return item.status || ''; },
      getUpdatedTone: function (record, item) { return item.statusTone; },
      formatDate: formatDate,
      limit: LIST_LIMIT
    });
  }

  /** Work Queue metadata (§ Metadata): Created / Owner, derived from the company and the engagement lead. */
  function deriveMetadata(engagement, company) {
    return {
      created: company && company.createdAt ? formatDate(company.createdAt) : '',
      updated: '',
      owner: engagement ? (engagement.engagementLead || engagement.auditor || '') : ''
    };
  }

  // ---- Inspector configuration — pure, host-agnostic (§9). Returns plain
  // Inspector Panel configuration; no DOM. The related object and the required
  // action render only when the source record carries them; nothing is
  // fabricated.

  /** One text-valued Inspector section rendered as a single placeholder-capable list row. */
  function textSection(title, text, placeholder) {
    return WS.textSection(title, text, placeholder);
  }

  /** One list-valued Inspector section; an empty list renders one placeholder row. */
  function listSection(title, items, placeholder) {
    return WS.listSection(title, items, placeholder);
  }

  /**
   * The Work Item Inspector configuration for one queue row (Master → Detail
   * detail pane). Renders the item's current object (properties), current
   * status, related object, and required action — a placeholder row wherever
   * the source record lacks data, and never a fabricated conclusion. Pure and
   * host-agnostic: data in, one plain configuration out.
   */
  function buildItemInspector(row) {
    var item = row || {};
    return {
      eyebrow: item.itemType + (item.subtype ? ' · ' + item.subtype : ''),
      title: item.title || '',
      subtitle: [item.status, item.owner].filter(Boolean).join(' · '),
      badges: [
        item.priority ? { label: item.priority, tone: item.priorityTone } : null,
        item.status ? { label: item.status, tone: item.statusTone } : null
      ].filter(Boolean),
      sections: [
        {
          title: 'Properties', kind: 'properties', columns: 2,
          rows: [
            { label: 'Item type', value: item.itemType || '' },
            { label: 'Workspace', value: item.workspace ? item.workspace.label : '' },
            { label: 'Owner', value: item.owner || '' },
            { label: 'Status', value: item.status || '' },
            { label: 'Priority', value: item.priority || '' },
            { label: 'Due date', value: formatDate(item.dueDate) }
          ].filter(function (fieldRow) { return fieldRow.value; })
        },
        listSection('Related object',
          item.related ? [{ title: item.related.label + ': ' + item.related.value, tone: TONES.INFO }] : [],
          'No related object recorded for this item.'),
        textSection('Required action', item.actionText,
          'No required action recorded. Release 2 adds AI-recommended next actions for human approval.'),
        {
          title: 'Activity', kind: 'placeholder',
          empty: {
            icon: '◇', title: 'No activity recorded',
            description: 'Release 1 renders activity only when the source workspace records it. Release 2 adds AI-assisted work-queue activity here.'
          }
        }
      ]
    };
  }

  // ------------------------------------------------------------------
  // View model — the single place this workspace reads AuditOS.state.
  // ------------------------------------------------------------------

  /** Reads the first dataset document an engagement owns in a collection, or null. */
  var readEngagementDocument = WS.readEngagementDocument;

  /** Finds a record by id within a list. */
  var findById = WS.findById;

  /** Indexes a list of records by their id field. */
  var indexById = WS.indexById;

  /**
   * Collects everything the Work Queue Workspace presents from the Shared
   * Audit State. Returns null while the state is not ready, and a degraded
   * model when no engagement exists (§15.12).
   */
  function collectViewModel(state, workspaceRegistry, routeContext) {
    if (!state || !state.isReady()) {
      return null;
    }

    var status = state.getStatus();
    var engagements = state.listRecords('engagements');
    var engagement = WS.resolveContextEngagement(engagements, routeContext);
    if (!engagement) {
      return { degraded: true, status: status };
    }

    var companies = state.listRecords('companies');
    var company = findById(companies, engagement.companyId);
    var pocsById = indexById(state.listRecords('pocs'));

    var controlsDocument = readEngagementDocument(state, 'controls', engagement.id) || {};
    var requirementsDocument = readEngagementDocument(state, 'evidence-requirements', engagement.id) || {};
    var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
    var requestsDocument = readEngagementDocument(state, 'evidence-requests', engagement.id) || {};
    var testingDocument = readEngagementDocument(state, 'testing', engagement.id) || {};
    var findingsDocument = readEngagementDocument(state, 'findings', engagement.id) || {};
    var reportsDocument = readEngagementDocument(state, 'reports', engagement.id) || {};

    var itemContext = {
      pocsById: pocsById,
      controlsById: indexById(controlsDocument.controls),
      requirementsById: indexById(requirementsDocument.requirements)
    };

    var items = []
      .concat(deriveWalkthroughItems())
      .concat(deriveEvidenceRequestItems(requestsDocument.requests, itemContext))
      .concat(deriveEvidenceLibraryItems(evidenceDocument.evidence, itemContext))
      .concat(deriveControlItems(controlsDocument.controls))
      .concat(deriveTestingItems(testingDocument.tests, itemContext))
      .concat(deriveFindingItems(findingsDocument.findings, itemContext))
      .concat(deriveDocumentationItems(reportsDocument, engagement));
    attachWorkspaceRefs(items, workspaceRegistry);

    var frameworks = normalizeFrameworks(engagement);
    var auditPeriodLabel = formatPeriod(engagement.auditPeriod);

    var queue = deriveQueue(items);
    var openCount = queue.filter(function (item) { return item.priority !== PRIORITIES.COMPLETED; }).length;
    var workQueueStatus = deriveWorkQueueStatus(queue);

    return {
      degraded: false,
      status: status,
      engagement: engagement,
      company: company,
      frameworks: frameworks,
      context: itemContext,

      header: {
        eyebrow: engagement.engagementCode + ' · Work Queue',
        title: company ? company.name : engagement.companyId,
        meta: engagement.name + ' · operational work queue',
        frameworks: frameworks,
        status: workQueueStatus,
        lastUpdated: '',
        actions: [{ label: 'Engagement overview', href: '#/engagements', variant: 'subtle' }]
      },

      ribbon: [
        { label: 'Client', value: company ? company.name : engagement.companyId },
        { label: 'Audit period', value: auditPeriodLabel },
        { label: 'Open items', value: String(openCount) }
      ],

      toolbar: { search: { placeholder: 'Search work items' } },
      filterBar: {
        dropdowns: [{ label: 'Framework', options: ['All frameworks'].concat(frameworks) }]
      },

      health: deriveWorkQueueHealth(queue),
      queue: queue,
      relationships: deriveRelationships(workspaceRegistry, queue),
      activity: deriveActivity(queue),
      metadata: deriveMetadata(engagement, company),

      footer: [
        { label: 'Environment', value: 'Static prototype' },
        { label: 'Demo status', value: status.demoDataLoaded ? 'Demo data loaded' : 'Demo data degraded' }
      ]
    };
  }

  // ------------------------------------------------------------------
  // Generic DOM builders — thin layout wrappers around the Enterprise Data
  // Presentation System (AuditOS.presentation). Text is always assigned through
  // textContent, never markup injection.
  // ------------------------------------------------------------------

  /** Creates an element with a class and optional text content. */
  var el = WS.el;

  /** The shared presentation system, resolved at render time. */
  var presentation = WS.presentation;

  /** Builds one Section component: an eyebrow, a title, an optional description, then a body node. */
  function buildSection(id, meta, bodyNode) {
    return WS.buildSection('aos-work-queue', id, meta, bodyNode);
  }

  /**
   * Builds the Operational Health strip: a row of tone-dot indicators (editor
   * status-bar style, identical composition to every other operational
   * workspace). The status text carries the meaning; the dot only reinforces
   * the tone, so health reads without relying on color.
   */
  function buildHealthStrip(items) {
    return WS.buildHealthStrip('aos-work-queue', 'Operational health', items);
  }

  /** Builds one Unified Work Queue master row: item type + title, priority badge, and operational meta. */
  function buildRow(row) {
    var P = presentation();
    var node = el('button', null);
    node.type = 'button';

    var head = el('div', 'aos-work-queue__row-head');
    var identity = el('div', 'aos-work-queue__row-identity');
    identity.appendChild(el('span', 'aos-work-queue__row-type', row.itemType));
    identity.appendChild(el('span', 'aos-work-queue__row-title', row.title || row.itemType));
    head.appendChild(identity);
    if (row.priority) {
      head.appendChild(P.statusBadge({ label: row.priority, tone: row.priorityTone }));
    }
    node.appendChild(head);

    var meta = el('div', 'aos-work-queue__row-meta');
    if (row.status) {
      meta.appendChild(P.statusBadge({ label: row.status, tone: row.statusTone }));
    }
    if (row.owner) {
      meta.appendChild(el('span', null, row.owner));
    }
    if (row.workspace && row.workspace.label) {
      meta.appendChild(el('span', 'aos-work-queue__row-workspace', row.workspace.label));
    }
    if (row.dueDate) {
      meta.appendChild(el('span', 'aos-work-queue__row-due', 'Due ' + formatDate(row.dueDate)));
    }
    node.appendChild(meta);
    return node;
  }

  /** Renders a set of grouped rows into a master list node and wires selection to the detail mount. */
  function mountRailGroups(listNode, detailMount, groups, context, targetId) {
    WS.mountRailGroups('aos-work-queue', listNode, detailMount, groups, context, buildRow, buildItemInspector, null, targetId);
  }

  /**
   * Builds one filter chip group: a labeled, single-select run of chips over a
   * fixed option list. The first option is the "All" sentinel and starts
   * active. Selecting a chip calls `onChange` with the chosen option and never
   * touches the underlying dataset — presentation only (§ Workspace Filter /
   * § Priority Filter).
   */
  function buildFilterChipGroup(ariaLabel, options, onChange) {
    var group = el('div', 'aos-work-queue__filters');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', ariaLabel);
    var chips = [];

    function activate(index) {
      chips.forEach(function (chip, chipIndex) {
        var selected = chipIndex === index;
        chip.classList.toggle('aos-work-queue__filter-chip--active', selected);
        chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    }

    asArray(options).forEach(function (option, index) {
      var chip = el('button', 'aos-work-queue__filter-chip', option);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
      if (index === 0) {
        chip.classList.add('aos-work-queue__filter-chip--active');
      }
      chip.addEventListener('click', function () {
        activate(index);
        onChange(option);
      });
      chips.push(chip);
      group.appendChild(chip);
    });

    return group;
  }

  /**
   * Builds the Unified Work Queue: two independent filter chip groups (by
   * workspace, by priority) above a Master–Detail whose master rail lists the
   * items matching both filters and whose detail shows the selected item's
   * Inspector. Filtering is presentation-only and memory-only (§ Workspace
   * Filter / § Priority Filter); it never adds, removes, or mutates a work
   * item — the same dataset is only regrouped.
   */
  function buildQueueBody(queue, context, targetId) {
    var wrap = el('div', 'aos-work-queue__queue');
    var detailMount = el('div', 'aos-work-queue__detail-mount');
    var listNode = el('div', 'aos-work-queue__row-list');
    listNode.setAttribute('role', 'list');

    var filterState = { itemType: WORKSPACE_FILTER_OPTIONS[0], priority: PRIORITY_FILTER_OPTIONS[0] };

    function renderFiltered() {
      var filtered = filterQueue(queue, filterState.itemType, filterState.priority);
      if (filtered.length === 0) {
        listNode.replaceChildren();
        detailMount.replaceChildren(presentation().emptyState({
          icon: '◇', title: 'No work items match these filters',
          description: 'Choose a different workspace or priority filter to see more of the queue.'
        }));
        return;
      }
      // `targetId` (Issue #31 — the record id carried by the current route)
      // selects that work item on first render, provided the default "All
      // workspaces / All priorities" filters still include it.
      mountRailGroups(listNode, detailMount, [{ label: '', rows: filtered }], context, targetId);
    }

    var workspaceFilter = buildFilterChipGroup('Workspace filter', WORKSPACE_FILTER_OPTIONS, function (value) {
      filterState.itemType = value;
      renderFiltered();
    });
    var priorityFilter = buildFilterChipGroup('Priority filter', PRIORITY_FILTER_OPTIONS, function (value) {
      filterState.priority = value;
      renderFiltered();
    });

    var masterDetail = presentation().masterDetail({
      list: listNode, detail: detailMount, ratio: 42,
      listLabel: 'Work queue', detailLabel: 'Work item inspector'
    });

    wrap.appendChild(workspaceFilter);
    wrap.appendChild(priorityFilter);
    wrap.appendChild(masterDetail);
    renderFiltered();
    return wrap;
  }

  /** Builds the Metadata body: the shared Metadata List of Created / Updated / Owner. */
  function buildMetadataBody(metadata) {
    var pairs = [
      { term: 'Created', detail: metadata.created },
      { term: 'Updated', detail: metadata.updated },
      { term: 'Owner', detail: metadata.owner }
    ];
    return WS.metadataBody(pairs);
  }

  /** Builds the Related information supporting panel body: the seven aggregated workspaces with navigation. */
  function buildRelatedBody(relationships) {
    return WS.buildRelatedBody(relationships, {
      icon: '◇', title: 'No related workspaces',
      description: 'The operational workspaces the Work Queue aggregates appear here once they hold data.'
    });
  }

  /** Builds the Activity Feed for the activity supporting panel. */
  function buildActivityBody(activity) {
    return WS.buildActivityBody(activity, {
      icon: '◇', title: 'No recent activity',
      description: 'Work-item updates appear here as the operational workspaces record dated activity.'
    });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    return WS.buildFooterItems('aos-work-queue', entries);
  }

  /**
   * Host-agnostic Inspector renderer (§9): given the full work queue and the
   * resolution context, returns one self-contained Master–Detail node — the
   * work-item rail beside the Work Item Inspector — making no assumption
   * about where it is mounted. Release 1 mounts the fuller queue (with its
   * filters) in the primary content; this renderer exposes the same master →
   * detail interaction for any other host with no change here.
   */
  function renderInspector(rows, context) {
    var detailMount = el('div', 'aos-work-queue__detail-mount');
    var listNode = el('div', 'aos-work-queue__row-list');
    listNode.setAttribute('role', 'list');
    mountRailGroups(listNode, detailMount, [{ label: '', rows: rows }], context);
    return presentation().masterDetail({
      list: listNode, detail: detailMount, ratio: 42,
      listLabel: 'Work queue', detailLabel: 'Work item inspector'
    });
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Returns a framework slot inside the active workspace view. */
  var slotElement = WS.slotElement;

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /**
   * The ordered Work Queue sections (§ Workspace Structure): operational
   * health, the unified work queue with its filters and the inspector, then
   * the workspace metadata. Each entry names the section id, its header,
   * whether it has data, its body builder, and an empty descriptor used when
   * the data is absent (§ Empty States).
   */
  function primarySections(viewModel, targetId) {
    var context = viewModel.context;
    return [
      {
        id: 'health', kicker: 'Operational status', title: 'Operational health',
        present: true, body: function () { return buildHealthStrip(viewModel.health); }
      },
      {
        id: 'queue', kicker: 'Operational queue', title: 'Unified work queue',
        description: 'Every work item aggregated from Walkthrough, Evidence, Requirements, Controls, Testing, Findings, and Documentation. Filter by workspace and by priority — the same dataset, regrouped — and select an item to open its Inspector.',
        present: viewModel.queue.length > 0,
        body: function () { return buildQueueBody(viewModel.queue, context, targetId); },
        empty: {
          icon: '◇', title: 'No work items yet',
          description: 'Work items appear here as the operational workspaces record walkthroughs, evidence, requirements, controls, testing, findings, and documentation. Release 1 aggregates only what already exists; nothing is fabricated.'
        }
      },
      {
        id: 'metadata', kicker: 'Record', title: 'Metadata',
        present: true, body: function () { return buildMetadataBody(viewModel.metadata); }
      }
    ];
  }

  /** Renders the ready Work Queue experience into the framework slots. */
  function renderReady(view, viewModel) {
    var P = presentation();
    var router = AuditOS.router;
    var targetId = router && router.getCurrentRecordId ? router.getCurrentRecordId() : '';

    AuditOS.workspaceFramework.configure(view, {
      header: viewModel.header,
      contextSummary: viewModel.ribbon,
      toolbar: viewModel.toolbar,
      filterBar: viewModel.filterBar
    });

    var canvas = el('div', 'aos-work-queue');
    canvas.setAttribute('data-canvas', 'flush');
    var rendered = 0;
    primarySections(viewModel, targetId).forEach(function (section) {
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

    var related = buildRelatedBody(viewModel.relationships);
    related.classList.add('aos-fade-in');
    fillSlot(view, SLOTS.RELATED, [related]);

    var ai = P.emptyState({
      icon: '✦', title: 'Reserved for AI advisory',
      description: 'AI-assisted triage — recommended priority, suggested owners, and drafted next actions — will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
    });
    ai.classList.add('aos-tint-brand', 'aos-fade-in');
    fillSlot(view, SLOTS.AI, [ai]);

    var activity = buildActivityBody(viewModel.activity);
    activity.classList.add('aos-fade-in');
    fillSlot(view, SLOTS.ACTIVITY, [activity]);

    fillSlot(view, SLOTS.FOOTER, [buildFooterItems(viewModel.footer)]);
  }

  /** Renders the layout-stable loading state (§15.12 — Loading). */
  function renderLoading(view) {
    var P = presentation();
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'detail', label: 'Loading work queue' })]);
    fillSlot(view, SLOTS.RELATED, [P.loadingState({ variant: 'list', label: 'Loading related information' })]);
    fillSlot(view, SLOTS.AI, [P.loadingState({ variant: 'list', label: 'Loading AI advisory' })]);
    fillSlot(view, SLOTS.ACTIVITY, [P.loadingState({ variant: 'list', label: 'Loading activity' })]);
  }

  /** Renders the degraded state (§15.12 — Empty / Error). */
  function renderDegraded(view, viewModel) {
    var P = presentation();
    fillSlot(view, SLOTS.CONTENT, [P.emptyState({
      icon: '◇', title: 'No engagement available',
      description: 'The Shared Audit State holds no engagement to present' +
        (viewModel.status && viewModel.status.degradedReason ? ' (' + viewModel.status.degradedReason + ')' : '') +
        '. Regenerate the demo-data bundle and reload to restore the Work Queue Workspace.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders the Work Queue Workspace when it is the active workspace: the
   * ready experience once the state has loaded, the loading skeleton before
   * that, and the degraded explanation when no engagement is available.
   */
  function renderActiveWorkQueue() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.WORKQUEUE) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.WORKQUEUE + '"]'
    );
    if (!view) {
      return;
    }

    var routeContext = router.getCurrentContext ? router.getCurrentContext() : null;
    var viewModel = state ? collectViewModel(state, registry, routeContext) : null;
    if (!viewModel) {
      renderLoading(view);
      return;
    }
    if (viewModel.degraded) {
      renderDegraded(view, viewModel);
      return;
    }
    renderReady(view, viewModel);
  }

  AuditOS.workQueueWorkspace = {
    SLOTS: SLOTS,
    PRIORITIES: PRIORITIES,
    ITEM_TYPES: ITEM_TYPES,
    WORKSPACE_FILTER_OPTIONS: WORKSPACE_FILTER_OPTIONS,
    PRIORITY_FILTER_OPTIONS: PRIORITY_FILTER_OPTIONS,

    // Pure, offline-testable derivations.
    derivations: {
      formatDate: formatDate,
      formatPeriod: formatPeriod,
      normalizeFrameworks: normalizeFrameworks,
      deriveCurrentEngagement: deriveCurrentEngagement,
      resolveStatusTone: resolveStatusTone,
      resolvePriorityTone: resolvePriorityTone,
      classifyPriority: classifyPriority,
      escalateFromSeverity: escalateFromSeverity,
      escalateFromResult: escalateFromResult,
      escalateFromRecordedPriority: escalateFromRecordedPriority,
      relatedControlLabel: relatedControlLabel,
      deriveFindingItems: deriveFindingItems,
      deriveTestingItems: deriveTestingItems,
      deriveControlItems: deriveControlItems,
      deriveEvidenceRequestItems: deriveEvidenceRequestItems,
      deriveEvidenceLibraryItems: deriveEvidenceLibraryItems,
      deriveDocumentationItems: deriveDocumentationItems,
      deriveWalkthroughItems: deriveWalkthroughItems,
      resolveItemWorkspace: resolveItemWorkspace,
      attachWorkspaceRefs: attachWorkspaceRefs,
      deriveQueue: deriveQueue,
      deriveWorkQueueHealth: deriveWorkQueueHealth,
      deriveWorkQueueStatus: deriveWorkQueueStatus,
      filterQueue: filterQueue,
      deriveRelationships: deriveRelationships,
      deriveActivity: deriveActivity,
      deriveMetadata: deriveMetadata,
      buildItemInspector: buildItemInspector
    },

    collectViewModel: collectViewModel,

    // Host-agnostic Inspector renderer (§9): data → one self-contained node,
    // mountable in any host. Release 1 mounts the fuller queue (with filters) in
    // primary content.
    renderInspector: renderInspector,

    /**
     * Binds the Work Queue Workspace to the router and the Shared Audit
     * State. Safe to call once, after the DOM is ready, the router has
     * resolved the initial route, and the framework has rendered its skeleton
     * (script order guarantees the framework's route listener runs first).
     * Does nothing when the routing or state foundations are absent, so the
     * shell degrades rather than throwing.
     */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveWorkQueue);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveWorkQueue);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveWorkQueue);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveWorkQueue);
      }
      renderActiveWorkQueue();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.workQueueWorkspace.init);
    } else {
      AuditOS.workQueueWorkspace.init();
    }
  }
})(window);
