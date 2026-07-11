/**
 * AuditOS Requirements Workspace
 * Workspaces and Navigation — Chapter 12 / Workspace Architecture — Chapter 61 /
 * Audit Lifecycle — Chapter 11 / Component Architecture — Chapter 74
 *
 * The operational workspace where auditors manage and review the evolving audit
 * requirements for an engagement (GitHub Issue #22). Requirements are living
 * audit knowledge: they continuously evolve as walkthroughs and evidence
 * collection deepen the team's understanding of the client. Release 1 is a
 * faithful visualization of the current requirement JSON — no AI, no writes, no
 * SharePoint, no workflow engine. In Release 2 AI agents will draft, refine,
 * mutate, and reconcile requirements; this workspace opens that seam without
 * implementing it, rendering only the current requirement state and never
 * fabricating a mutation, a relationship, or a version history.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to the
 * Engagement, Walkthrough, and Evidence workspaces. `collectViewModel` is the
 * single place this workspace reads `AuditOS.state`; it returns a declarative
 * model of pure, offline-testable derivations. The renderer configures the
 * Shared Workspace Framework's inherited skeleton
 * (`AuditOS.workspaceFramework.configure`) and fills its slots with compositions
 * from the Enterprise Data Presentation System (`AuditOS.presentation`) — no
 * bespoke primitives, no duplicated components (Component Design Patterns §81.4 —
 * Composition Over Duplication).
 *
 * Requirements are read through the same engagement-scoped document pattern as
 * controls, evidence, testing, and findings (`findDatasetsForEngagement` /
 * `getDocument`). The demo datasets carry two requirement shapes: a
 * single-control shape (`controlId`, `evidenceOwnerTeamId`, `linkedEvidenceIds`)
 * and a multi-control shape (`linkedControlIds`, `requestedFromTeamId`,
 * `evidenceIds`, `evidenceRequestIds`). Every read normalizes across both and
 * fabricates nothing where a field is absent; control, POC, team, business unit,
 * and evidence identifiers resolve to names only when they genuinely join, and
 * render as their raw identifier otherwise (never a fabricated label). This keeps
 * the workspace faithful across the mixed datasets while opening the Release 2
 * seams (AI requirement refinement, immutable version history).
 *
 * The Requirements Queue is the primary operational surface. It renders every
 * requirement once and offers three presentation modes over that single dataset —
 * Requirement view, Pending by POC, and Evidence view — each a pure regrouping
 * of the same rows. Changing the view changes presentation only; no requirement
 * is added, removed, or mutated. Selecting a row opens the Requirement Inspector
 * beside it. The inspector renderer is host-agnostic (data in, one self-contained
 * node out) so a later release can mount it in a dedicated region with no change
 * here, and it exposes immutable history — version, approval, and activity — only
 * when the JSON records it, never fabricating a past state.
 *
 * Presentation only. Every business value is read through `AuditOS.state`;
 * nothing is written. Sections with no data render shared Empty State
 * components; nothing is fabricated. The AI surface is a reserved presentation
 * region — AI stays advisory and human approval remains mandatory.
 *
 * Structure of this file (Coding Standards §30.8): constants, pure derivation
 * helpers (no DOM, no state access), the view-model collector (the single state
 * read), generic DOM builders (compose the presentation system), slot
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
   * Requirement operational-status vocabulary → tone (read, never invented). The
   * demo data uses "Pending"; the vocabulary also covers the operational states
   * requirements move through — Draft, Pending Review, Updated, Approved,
   * Rejected — so future data (including AI-proposed states) reads through the
   * same token-backed tones. An unmapped status resolves to a neutral info tone.
   */
  var STATUS_TONES = {
    'Draft': null,
    'Pending': TONES.WARNING,
    'Pending Review': TONES.WARNING,
    'In Review': TONES.WARNING,
    'Updated': TONES.INFO,
    'Approved': TONES.SUCCESS,
    'Rejected': TONES.ERROR,
    'No Action': null,
    'No Action - POC Details Requested by HA': TONES.WARNING,
    'Requested by Consulting Team': TONES.INFO,
    'Requested by SOC Team': TONES.INFO,
    'Evidence Received - Under HA Review': TONES.INFO,
    'Evidence Reviewed - Clarification Needed': TONES.WARNING,
    'Evidence Partially Received': TONES.WARNING,
    'Population Pending - HA unable to share samples': TONES.WARNING,
    'All Evidence Received': TONES.SUCCESS,
    'Not Applicable': null
  };

  /**
   * Canonical order for the Requirement Health strip so its indicators read in a
   * stable operational sequence regardless of which statuses the data contains.
   * Statuses outside this list sort after it, alphabetically.
   */
  var HEALTH_ORDER = [
    'Draft', 'Pending', 'Pending Review', 'In Review', 'Updated', 'Approved', 'Rejected',
    'No Action', 'Requested by Consulting Team', 'Requested by SOC Team',
    'Evidence Received - Under HA Review', 'Evidence Reviewed - Clarification Needed',
    'Evidence Partially Received', 'Population Pending - HA unable to share samples',
    'All Evidence Received', 'Not Applicable'
  ];

  /** Evidence-status keys derived per requirement, with their labels and tones. */
  var EVIDENCE_STATUS = {
    OUTSTANDING: { key: 'outstanding', label: 'Evidence outstanding', tone: TONES.WARNING },
    REQUESTED: { key: 'requested', label: 'Evidence requested', tone: TONES.INFO },
    COLLECTED: { key: 'collected', label: 'Evidence collected', tone: TONES.SUCCESS }
  };

  /** The three presentation modes over the one requirements dataset. */
  var VIEWS = { REQUIREMENT: 'requirement', PENDING_POC: 'pending-poc', EVIDENCE: 'evidence' };

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

  /**
   * The frameworks attached to an engagement, always as an array. Identical
   * Release 1 → Release 2 seam as the other workspaces: a future engagement with
   * a `frameworks` array renders every entry; today's single `framework` string
   * becomes a one-element array; neither yields an empty array.
   */
  var normalizeFrameworks = WS.normalizeFrameworks;

  /** The current engagement: identical rule to Home, Engagement, Walkthrough, and Evidence. */
  var deriveCurrentEngagement = WS.deriveCurrentEngagement;

  /** Resolves a requirement status to a presentation tone. */
  function resolveStatusTone(status) {
    return Object.prototype.hasOwnProperty.call(STATUS_TONES, status) ? STATUS_TONES[status] : TONES.INFO;
  }

  /** Resolves a record's name field from an id map, falling back to the raw id. */
  var resolveName = WS.resolveName;

  /**
   * The controls a requirement links to, always as an array. Reads the
   * multi-control shape (`linkedControlIds`) where present and the single-control
   * shape (`controlId`) otherwise; a requirement declaring neither yields an
   * empty array (never a fabricated link).
   */
  function normalizeControlIds(requirement) {
    var source = requirement || {};
    if (Array.isArray(source.linkedControlIds) && source.linkedControlIds.length > 0) {
      return source.linkedControlIds.slice();
    }
    if (typeof source.controlId === 'string' && source.controlId) {
      return [source.controlId];
    }
    return [];
  }

  /**
   * The evidence a requirement links to, always as an array. Reads whichever of
   * the two dataset shapes is present (`evidenceIds` or `linkedEvidenceIds`);
   * neither present yields an empty array.
   */
  function normalizeEvidenceIds(requirement) {
    var source = requirement || {};
    if (Array.isArray(source.evidenceIds) && source.evidenceIds.length > 0) {
      return source.evidenceIds.slice();
    }
    if (Array.isArray(source.linkedEvidenceIds) && source.linkedEvidenceIds.length > 0) {
      return source.linkedEvidenceIds.slice();
    }
    return [];
  }

  /** The evidence requests a requirement has raised, always as an array. */
  function normalizeEvidenceRequestIds(requirement) {
    var source = requirement || {};
    return Array.isArray(source.evidenceRequestIds) ? source.evidenceRequestIds.slice() : [];
  }

  /** The owning team identifier across both dataset shapes. */
  function resolveTeamId(requirement) {
    var source = requirement || {};
    return source.evidenceOwnerTeamId || source.requestedFromTeamId || source.teamId || '';
  }

  /** The business unit identifier across both dataset shapes. */
  function resolveBusinessUnitId(requirement) {
    var source = requirement || {};
    return source.requestedFromBusinessUnitId || source.businessUnitId || '';
  }

  /** The expected evidence type across both dataset shapes. */
  function resolveEvidenceType(requirement) {
    var source = requirement || {};
    return source.evidenceType || source.expectedEvidenceType || '';
  }

  /** The collection frequency across both dataset shapes. */
  function resolveFrequency(requirement) {
    var source = requirement || {};
    return source.frequency || source.collectionFrequency || '';
  }

  /**
   * The evidence status of a requirement, derived only from the identifiers the
   * record carries: collected when evidence is linked, requested when only an
   * evidence request has been raised, outstanding otherwise. Never fabricated —
   * a requirement with empty evidence and request arrays reads Outstanding, which
   * is the faithful current state of the demo data.
   */
  function deriveEvidenceStatus(requirement) {
    var evidence = normalizeEvidenceIds(requirement);
    if (evidence.length > 0) {
      return { key: EVIDENCE_STATUS.COLLECTED.key, label: evidence.length + ' collected', tone: EVIDENCE_STATUS.COLLECTED.tone, count: evidence.length };
    }
    if (normalizeEvidenceRequestIds(requirement).length > 0) {
      return { key: EVIDENCE_STATUS.REQUESTED.key, label: EVIDENCE_STATUS.REQUESTED.label, tone: EVIDENCE_STATUS.REQUESTED.tone, count: 0 };
    }
    return { key: EVIDENCE_STATUS.OUTSTANDING.key, label: EVIDENCE_STATUS.OUTSTANDING.label, tone: EVIDENCE_STATUS.OUTSTANDING.tone, count: 0 };
  }

  /**
   * The framework mapping of a requirement, drawn only from present relationships
   * in priority order: the requirement's own trust-services criteria when it
   * declares them, then the criteria of the control(s) it explicitly links to,
   * then the engagement framework(s) the requirement belongs to. Every source is
   * a real join (requirement → control, requirement → engagement); nothing is
   * inferred. Returns an empty string when the engagement declares no framework.
   */
  function deriveFrameworkMapping(requirement, controlsById, frameworks) {
    var source = requirement || {};
    if (Array.isArray(source.trustServicesCriteria) && source.trustServicesCriteria.length > 0) {
      return source.trustServicesCriteria.join(', ');
    }
    if (Array.isArray(source.frameworkMapping) && source.frameworkMapping.length > 0) {
      return source.frameworkMapping.join(', ');
    }
    var criteria = {};
    var order = [];
    normalizeControlIds(source).forEach(function (id) {
      var control = controlsById ? controlsById[id] : null;
      asArray(control && control.trustServicesCriteria).forEach(function (value) {
        if (!criteria[value]) {
          criteria[value] = true;
          order.push(value);
        }
      });
    });
    if (order.length > 0) {
      return order.join(', ');
    }
    return asArray(frameworks).join(', ');
  }

  /**
   * One Requirements Queue row, resolved to display fields. Owner, team, and
   * business unit resolve to names where the identifiers genuinely join and
   * render the raw identifier otherwise; priority is surfaced only when the
   * record carries it (the demo data does not, so it reads empty rather than a
   * fabricated value). The requirement record is carried through for the
   * Inspector.
   */
  function deriveRequirementRow(requirement, context) {
    var source = requirement || {};
    var ctx = context || {};
    return {
      id: source.id || '',
      title: source.title || source.id || '',
      requirement: source,
      owner: resolveName(ctx.pocsById, source.primaryPocId, 'name'),
      ownerId: source.primaryPocId || '',
      status: source.status || '',
      statusTone: resolveStatusTone(source.status),
      priority: source.priority || '',
      evidence: deriveEvidenceStatus(source),
      framework: deriveFrameworkMapping(source, ctx.controlsById, ctx.frameworks)
    };
  }

  /**
   * The Requirements Queue — every requirement rendered once, ordered by
   * identifier so the surface is stable. Nothing is capped or filtered: the queue
   * is the full operational dataset the presentation views regroup.
   */
  function deriveQueue(requirements, context) {
    return asArray(requirements)
      .map(function (requirement) { return deriveRequirementRow(requirement, context); })
      .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
  }

  /**
   * The Requirement Health strip — one indicator per operational status actually
   * present (labelled by the status, valued by its real count), in canonical
   * order, plus a derived Evidence outstanding indicator. Every value is a real
   * count of real records; an engagement with no requirements yields only the
   * Evidence outstanding indicator reading Clear. Never a fabricated count.
   */
  function deriveRequirementHealth(requirements) {
    var list = asArray(requirements);
    var counts = {};
    list.forEach(function (requirement) {
      var status = requirement && requirement.status ? requirement.status : 'Unspecified';
      counts[status] = (counts[status] || 0) + 1;
    });

    var statuses = Object.keys(counts).sort(function (a, b) {
      var ia = HEALTH_ORDER.indexOf(a);
      var ib = HEALTH_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) { return a.localeCompare(b); }
      if (ia === -1) { return 1; }
      if (ib === -1) { return -1; }
      return ia - ib;
    });

    var indicators = statuses.map(function (status) {
      return {
        key: 'status-' + status.toLowerCase().replace(/\s+/g, '-'),
        label: status,
        status: String(counts[status]),
        tone: resolveStatusTone(status)
      };
    });

    var outstanding = list.filter(function (requirement) {
      return deriveEvidenceStatus(requirement).key === EVIDENCE_STATUS.OUTSTANDING.key;
    }).length;
    indicators.push({
      key: 'evidence-outstanding',
      label: 'Evidence outstanding',
      status: outstanding > 0 ? String(outstanding) : 'Clear',
      tone: outstanding > 0 ? TONES.WARNING : TONES.SUCCESS
    });
    return indicators;
  }

  /**
   * The requirement collection status for the header badge: awaiting when there
   * are no requirements, approved once every requirement is approved, in review
   * otherwise. Derived from real status counts; never a fabricated aggregate.
   */
  function deriveCollectionStatus(requirements) {
    var list = asArray(requirements);
    if (list.length === 0) {
      return { label: 'Awaiting', tone: null };
    }
    var approved = list.filter(function (requirement) { return requirement.status === 'Approved'; }).length;
    if (approved === list.length) {
      return { label: 'Approved', tone: TONES.SUCCESS };
    }
    return { label: 'In review', tone: TONES.INFO };
  }

  // ---- Presentation views — three regroupings of the one queue dataset. Each is
  // pure and returns `{ groups: [{ label, rows }] }` from the same rows, so
  // changing the view changes presentation only and never the data.

  /** Requirement view — the flat queue, a single unlabeled group. */
  function requirementView(rows) {
    return { id: VIEWS.REQUIREMENT, groups: [{ label: '', rows: asArray(rows).slice() }] };
  }

  /** Pending by POC — the same rows grouped by owning POC, groups ordered by name. */
  function pendingByPocView(rows) {
    var groups = {};
    var order = [];
    asArray(rows).forEach(function (row) {
      var key = row.owner || 'Unassigned';
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(row);
    });
    order.sort(function (a, b) { return a.localeCompare(b); });
    return { id: VIEWS.PENDING_POC, groups: order.map(function (key) { return { label: key, rows: groups[key] }; }) };
  }

  /** Evidence view — the same rows grouped by evidence status, outstanding first. */
  function evidenceView(rows) {
    var ORDER = [EVIDENCE_STATUS.OUTSTANDING, EVIDENCE_STATUS.REQUESTED, EVIDENCE_STATUS.COLLECTED];
    var groups = {};
    asArray(rows).forEach(function (row) {
      var key = row.evidence.key;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(row);
    });
    var present = ORDER.filter(function (descriptor) { return groups[descriptor.key]; });
    return {
      id: VIEWS.EVIDENCE,
      groups: present.map(function (descriptor) { return { label: descriptor.label, rows: groups[descriptor.key] }; })
    };
  }

  /**
   * The three presentation views over one dataset, each with a switcher label and
   * its regrouped structure. The row set is identical across all three; only the
   * grouping and ordering differ.
   */
  function deriveViews(rows) {
    return [
      { id: VIEWS.REQUIREMENT, label: 'Requirement view', view: requirementView(rows) },
      { id: VIEWS.PENDING_POC, label: 'Pending by POC', view: pendingByPocView(rows) },
      { id: VIEWS.EVIDENCE, label: 'Evidence view', view: evidenceView(rows) }
    ];
  }

  /**
   * The Audit Lineage — Walkthrough → Requirement → Control → Evidence → Testing
   * → Finding → Report, with Requirement highlighted as the object this workspace
   * owns. Each node carries its real, current count for the engagement and a link
   * into its workspace; nodes with no data read "—" and never a fabricated
   * figure. Only the counts vary with the data; the chain is the audit
   * methodology's real shape.
   */
  function deriveLineage(workspaceRegistry, operational) {
    if (!workspaceRegistry) {
      return [];
    }
    var ops = operational || {};
    var requirements = ops.requirements || {};
    var controls = ops.controls || {};
    var evidence = ops.evidence || {};
    var testing = ops.testing || {};
    var findings = ops.findings || {};
    var report = ops.report || null;
    var ids = workspaceRegistry.IDS;

    var nodes = [
      { id: ids.WALKTHROUGH, label: 'Walkthrough', count: null, present: false, hint: 'Knowledge acquisition' },
      { id: ids.REQUIREMENTS, label: 'Requirement', count: requirements.requirements || 0, present: (requirements.requirements || 0) > 0, hint: 'Living audit knowledge', highlighted: true },
      { id: ids.CONTROLS, label: 'Control', count: controls.controls || 0, present: (controls.controls || 0) > 0, hint: 'What the requirement satisfies' },
      { id: ids.EVIDENCE, label: 'Evidence', count: evidence.evidenceItems || 0, present: (evidence.evidenceItems || 0) > 0, hint: 'What proves the requirement' },
      { id: ids.TESTING, label: 'Testing', count: testing.tests || 0, present: (testing.tests || 0) > 0, hint: 'What the evidence is tested against' },
      { id: ids.FINDINGS, label: 'Finding', count: findings.findings || 0, present: (findings.findings || 0) > 0, hint: 'What the testing surfaces' },
      { id: ids.REPORTING, label: 'Report', count: report ? null : 0, present: Boolean(report), hint: report ? report.status : 'Not started' }
    ];

    return WS.resolveLineageNodes(workspaceRegistry, nodes);
  }

  /**
   * Related audit objects for the supporting panel: the domains the requirements
   * connect to, each with its real count, only when data exists. Reuses the same
   * chain the lineage draws from (Requirement is the workspace's own object, so
   * it is not listed as a relation).
   */
  function deriveRelationships(workspaceRegistry, operational) {
    if (!workspaceRegistry) {
      return [];
    }
    var ops = operational || {};
    var controls = ops.controls || {};
    var evidence = ops.evidence || {};
    var testing = ops.testing || {};
    var findings = ops.findings || {};
    var report = ops.report || null;
    var ids = workspaceRegistry.IDS;

    var related = [
      { id: ids.CONTROLS, title: 'Controls', meta: String(controls.controls || 0), present: (controls.controls || 0) > 0 },
      { id: ids.EVIDENCE, title: 'Evidence', meta: String(evidence.evidenceItems || 0), present: (evidence.evidenceItems || 0) > 0 },
      { id: ids.TESTING, title: 'Testing', meta: String(testing.tests || 0), present: (testing.tests || 0) > 0 },
      { id: ids.FINDINGS, title: 'Findings', meta: String(findings.findings || 0), present: (findings.findings || 0) > 0 },
      { id: ids.REPORTING, title: 'Report', meta: report ? String(report.status) : '—', present: Boolean(report) }
    ];
    return WS.resolveRelationships(workspaceRegistry, related);
  }

  /**
   * Recent requirement-related activity, newest first, drawn only from dated
   * history the requirements carry (activity / history entries, or a recorded
   * update timestamp). Undated requirements never appear, so an engagement whose
   * requirements record no dated events yields an empty feed and the shared Empty
   * State. Never fabricated.
   */
  function deriveActivity(requirements) {
    return RE.deriveActivityFromHistory(requirements, {
      entityNoun: 'Requirement',
      getMeta: function (entry) { return entry.status || entry.description || ''; },
      resolveTone: resolveStatusTone,
      formatDate: formatDate,
      limit: LIST_LIMIT
    });
  }

  /**
   * Requirement collection metadata: created / modified / owner / version / tags /
   * source, derived from the requirements document metadata, the engagement, and
   * the company. Only fields with real values are surfaced by the builder.
   */
  function deriveMetadata(requirementsMetadata, engagement, company, requirements) {
    return RE.deriveCollectionMetadata(requirementsMetadata, engagement, company, requirements, formatDate);
  }

  // ---- Inspector configuration — pure, host-agnostic (§9). Returns plain
  // Inspector Panel configuration; no DOM. Immutable history renders only when the
  // JSON records it.

  /** One text-valued Inspector section rendered as a single placeholder-capable list row. */
  var textSection = WS.textSection;

  /** One list-valued Inspector section; an empty list renders one placeholder row. */
  var listSection = WS.listSection;

  /** Normalizes a linked-id reference, resolving its name where it joins. */
  var toRefItem = WS.resolveRefItem;

  /**
   * Immutable version history — rendered only from a `versionHistory` / `versions`
   * array the requirement records. Release 1 never fabricates a prior version, so
   * a requirement carrying none yields an empty list and the reserved placeholder.
   */
  function deriveVersionHistory(requirement) {
    return WS.deriveVersionHistory(requirement, resolveStatusTone);
  }

  /**
   * Approval history — the recorded `approvalHistory` when present, else a single
   * entry reflecting the current status (a real, current fact, not a fabricated
   * past). Empty only when the requirement carries no status at all.
   */
  function deriveApprovalHistory(requirement) {
    return WS.deriveApprovalHistory(requirement, resolveStatusTone);
  }

  /** Activity history — rendered only from recorded dated history; never fabricated. */
  function deriveActivityHistory(requirement) {
    return WS.deriveActivityHistory(requirement, resolveStatusTone);
  }

  /**
   * The Requirement Inspector configuration for one requirement (Master → Detail
   * detail pane). Renders the current requirement, its version and status,
   * related evidence, related controls, related walkthroughs, related testing,
   * version history, approval history, activity history, and metadata — a
   * placeholder row wherever the JSON lacks data, and never a fabricated
   * relationship. Pure and host-agnostic: data in, one plain configuration out.
   */
  function buildRequirementInspector(requirement, context) {
    var item = requirement || {};
    var ctx = context || {};
    var ids = ctx.workspaceRegistry ? ctx.workspaceRegistry.IDS : {};
    var status = item.status || '';
    var evidence = deriveEvidenceStatus(item);
    var owner = resolveName(ctx.pocsById, item.primaryPocId, 'name');
    var team = resolveName(ctx.teamsById, resolveTeamId(item), 'name');
    var businessUnit = resolveName(ctx.businessUnitsById, resolveBusinessUnitId(item), 'name');
    var frameworkMapping = deriveFrameworkMapping(item, ctx.controlsById, ctx.frameworks);
    var controlIds = normalizeControlIds(item);
    var evidenceIds = normalizeEvidenceIds(item);
    var evidenceRequestIds = normalizeEvidenceRequestIds(item);
    var versionHistory = deriveVersionHistory(item);

    return {
      eyebrow: resolveEvidenceType(item) || 'Requirement',
      title: item.title || item.id || '',
      subtitle: [item.id, status].filter(Boolean).join(' · '),
      badges: [
        status ? { label: status, tone: resolveStatusTone(status) } : null,
        { label: evidence.label, tone: evidence.tone }
      ].filter(Boolean),
      sections: [
        {
          title: 'Properties', kind: 'properties', columns: 2,
          rows: [
            { label: 'Requirement id', value: item.id || '' },
            { label: 'Version', value: item.version || '' },
            { label: 'Status', value: status },
            { label: 'Priority', value: item.priority || '' },
            { label: 'Owner', value: owner },
            { label: 'Owning team', value: team },
            { label: 'Business unit', value: businessUnit },
            { label: 'Evidence type', value: resolveEvidenceType(item) },
            { label: 'Collection frequency', value: resolveFrequency(item) },
            { label: 'Evidence status', value: evidence.label },
            { label: 'Framework mapping', value: frameworkMapping },
            { label: 'Reuse status', value: item.reuseStatus || '' },
            { label: 'Source engagement', value: item.sourceEngagementId || '' },
            { label: 'Created', value: formatDate(item.createdAt || item.createdOn) },
            { label: 'Updated', value: formatDate(item.updatedAt || item.updatedOn) }
          ].filter(function (row) { return row.value; })
        },
        textSection('Description', item.description, 'No description recorded for this requirement.'),
        listSection('Related evidence',
          evidenceIds.map(function (id) { return toRefItem(id, ctx.evidenceById, 'title', ctx.workspaceRegistry, ids.EVIDENCE); }),
          'No evidence linked yet — this requirement is still outstanding.'),
        listSection('Related controls',
          controlIds.map(function (id) { return toRefItem(id, ctx.controlsById, 'title', ctx.workspaceRegistry, ids.CONTROLS); }),
          'No linked controls recorded.'),
        listSection('Related evidence requests',
          evidenceRequestIds.map(function (id) { return toRefItem(id, ctx.evidenceRequestsById, 'id', ctx.workspaceRegistry, ids.EVIDENCE); }),
          'No evidence requests raised for this requirement yet.'),
        listSection('Related walkthroughs', [],
          'No linked walkthroughs yet — walkthrough linkage arrives with the walkthrough collection.'),
        listSection('Related testing', [],
          'No linked testing recorded for this requirement.'),
        versionHistory.length > 0
          ? { title: 'Version history', kind: 'timeline', events: versionHistory }
          : {
            title: 'Version history', kind: 'placeholder',
            empty: {
              icon: '◇', title: 'Only the current version',
              description: 'Release 1 renders the current requirement. Immutable version history appears here when the JSON records it; Release 2 adds AI-proposed revisions and mutation lineage.'
            }
          },
        listSection('Approval history', deriveApprovalHistory(item), 'No approval decision recorded yet.'),
        listSection('Activity history', deriveActivityHistory(item), 'No activity recorded for this requirement.')
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
   * Collects everything the Requirements Workspace presents from the Shared Audit
   * State. Returns null while the state is not ready, and a degraded model when
   * no engagement exists (§15.12).
   */
  function collectViewModel(state, workspaceRegistry) {
    if (!state || !state.isReady()) {
      return null;
    }

    var status = state.getStatus();
    var engagements = state.listRecords('engagements');
    var engagement = deriveCurrentEngagement(engagements);
    if (!engagement) {
      return { degraded: true, status: status };
    }

    var companies = state.listRecords('companies');
    var company = findById(companies, engagement.companyId);
    var pocs = state.listRecords('pocs');
    var users = state.listRecords('users');
    var pocsById = indexById(pocs);
    var teamsById = indexById(state.listRecords('teams'));
    var businessUnitsById = indexById(state.listRecords('business-units'));

    var requirementsDocument = readEngagementDocument(state, 'evidence-requirements', engagement.id) || {};
    var controlsDocument = readEngagementDocument(state, 'controls', engagement.id) || {};
    var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
    var requestsDocument = readEngagementDocument(state, 'evidence-requests', engagement.id) || {};
    var testingDocument = readEngagementDocument(state, 'testing', engagement.id) || {};
    var findingsDocument = readEngagementDocument(state, 'findings', engagement.id) || {};
    var reportsDocument = readEngagementDocument(state, 'reports', engagement.id) || {};
    var activityDocument = readEngagementDocument(state, 'activity', engagement.id) || {};

    var requirementRecords = asArray(requirementsDocument.requirements);
    var controlsById = indexById(controlsDocument.controls);
    var evidenceById = indexById(evidenceDocument.evidence);
    var evidenceRequestsById = indexById(requestsDocument.requests);

    // Actor id → display name, spanning both client POCs and the Halcyon
    // engagement team, so requirement activity resolves to a real name.
    var actorNames = {};
    asArray(pocs).forEach(function (poc) { if (poc.id && poc.name) { actorNames[poc.id] = poc.name; } });
    asArray(users).forEach(function (user) { if (user.id && user.name) { actorNames[user.id] = user.name; } });

    // The immutable activity log tags its remarks by requirement id
    // (entityType 'requirement'); attach each requirement's own remarks as
    // its activityHistory so both the per-requirement Inspector history and
    // the workspace-level Activity Feed read real, dated events.
    var activityByRequirement = {};
    asArray(activityDocument.events).forEach(function (event) {
      if (!event || event.entityType !== 'requirement' || !event.entityId || !event.at) {
        return;
      }
      if (!activityByRequirement[event.entityId]) {
        activityByRequirement[event.entityId] = [];
      }
      activityByRequirement[event.entityId].push({
        date: event.at,
        title: event.authorSide === 'ha' ? 'Halcyon remark' : 'Client remark',
        actor: actorNames[event.byId] || '',
        description: event.note || ''
      });
    });
    requirementRecords.forEach(function (requirement) {
      requirement.activityHistory = activityByRequirement[requirement.id] || [];
    });

    var frameworks = normalizeFrameworks(engagement);
    var auditPeriodLabel = formatPeriod(engagement.auditPeriod);

    var context = {
      pocsById: pocsById,
      teamsById: teamsById,
      businessUnitsById: businessUnitsById,
      controlsById: controlsById,
      evidenceById: evidenceById,
      evidenceRequestsById: evidenceRequestsById,
      workspaceRegistry: workspaceRegistry,
      frameworks: frameworks,
      auditPeriodLabel: auditPeriodLabel,
      engagement: engagement,
      company: company
    };

    var operational = {
      requirements: { requirements: requirementRecords.length },
      controls: controlsDocument.summary || {},
      evidence: evidenceDocument.summary || {},
      testing: testingDocument.summary || {},
      findings: findingsDocument.summary || {},
      report: reportsDocument.document || null
    };

    var queue = deriveQueue(requirementRecords, context);
    var collectionStatus = deriveCollectionStatus(requirementRecords);

    return {
      degraded: false,
      status: status,
      engagement: engagement,
      company: company,
      frameworks: frameworks,
      context: context,

      header: {
        eyebrow: engagement.engagementCode + ' · Requirements',
        title: company ? company.name : engagement.companyId,
        meta: engagement.name + ' · living audit knowledge',
        frameworks: frameworks,
        status: collectionStatus,
        lastUpdated: requirementsDocument.metadata && requirementsDocument.metadata.generatedAt
          ? 'Updated ' + formatDate(String(requirementsDocument.metadata.generatedAt).slice(0, 10))
          : '',
        actions: [{ label: 'Engagement overview', href: '#/engagements', variant: 'subtle' }]
      },

      ribbon: [
        { label: 'Client', value: company ? company.name : engagement.companyId },
        { label: 'Audit period', value: auditPeriodLabel },
        { label: 'Requirements', value: String(requirementRecords.length) }
      ],

      toolbar: { search: { placeholder: 'Search requirements' } },
      filterBar: {
        dropdowns: [{ label: 'Framework', options: ['All frameworks'].concat(frameworks) }]
      },

      requirementHealth: deriveRequirementHealth(requirementRecords),
      queue: queue,
      views: deriveViews(queue),
      lineage: deriveLineage(workspaceRegistry, operational),
      relationships: deriveRelationships(workspaceRegistry, operational),
      activity: deriveActivity(requirementRecords),
      metadata: deriveMetadata(requirementsDocument.metadata, engagement, company, requirementRecords),

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
    return WS.buildSection('aos-requirements', id, meta, bodyNode);
  }

  /**
   * Builds the Requirement Health strip: a row of tone-dot indicators (editor
   * status-bar style, identical composition to the other operational workspaces).
   * The status text carries the meaning; the dot only reinforces the tone, so
   * health reads without relying on color.
   */
  function buildHealthStrip(items) {
    return WS.buildHealthStrip('aos-requirements', 'Requirement health', items);
  }

  /** Builds one Requirements Queue master row: title, status, and operational meta. */
  function buildRow(row) {
    var P = presentation();
    var node = el('button', null);
    node.type = 'button';

    var head = el('div', 'aos-requirements__row-head');
    head.appendChild(el('span', 'aos-requirements__row-title', row.title || row.id));
    if (row.status) {
      head.appendChild(P.statusBadge({ label: row.status, tone: row.statusTone }));
    }
    node.appendChild(head);

    var meta = el('div', 'aos-requirements__row-meta');
    if (row.owner) {
      meta.appendChild(el('span', null, row.owner));
    }
    if (row.evidence && row.evidence.label) {
      meta.appendChild(el('span', 'aos-requirements__row-evidence', row.evidence.label));
    }
    if (row.framework) {
      meta.appendChild(el('span', null, row.framework));
    }
    if (row.priority) {
      meta.appendChild(el('span', null, row.priority + ' priority'));
    }
    node.appendChild(meta);
    return node;
  }

  /**
   * Renders a set of grouped rows into a master list node and wires selection to
   * the detail mount. Clears the list first, so the same node re-renders when the
   * presentation view changes — the mechanism behind the three views over one
   * dataset. Group labels render as a labeled divider carrying the group's count.
   */
  function mountRailGroups(listNode, detailMount, groups, context, targetId) {
    WS.mountRailGroups('aos-requirements', listNode, detailMount, groups, context, buildRow, buildRequirementInspector, 'requirement', targetId);
  }

  /**
   * Builds the Requirements Queue: a view switcher above a Master–Detail whose
   * master rail lists the requirements for the active view and whose detail shows
   * the selected requirement's Inspector Panel. The switcher swaps between the
   * three presentation modes — Requirement view, Pending by POC, Evidence view —
   * by re-rendering the same rail from the same dataset (presentation-only,
   * memory-only); it never changes the data. `targetId` (Issue #31 — the record
   * id carried by the current route) selects that requirement on first render
   * and again on every view switch, so following a cross-workspace link into a
   * requirement keeps it selected regardless of which view is active.
   */
  function buildQueueBody(views, context, targetId) {
    var wrap = el('div', 'aos-requirements__queue');
    var detailMount = el('div', 'aos-requirements__detail-mount');
    var listNode = el('div', 'aos-requirements__row-list');
    listNode.setAttribute('role', 'list');

    var switcher = el('div', 'aos-requirements__views');
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Requirement views');
    var chips = [];

    function activate(index) {
      chips.forEach(function (chip, chipIndex) {
        var selected = chipIndex === index;
        chip.classList.toggle('aos-requirements__view-chip--active', selected);
        chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      mountRailGroups(listNode, detailMount, views[index].view.groups, context, targetId);
    }

    asArray(views).forEach(function (view, index) {
      var chip = el('button', 'aos-requirements__view-chip', view.label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
      if (index === 0) {
        chip.classList.add('aos-requirements__view-chip--active');
      }
      chip.addEventListener('click', function () { activate(index); });
      chips.push(chip);
      switcher.appendChild(chip);
    });

    var masterDetail = presentation().masterDetail({
      list: listNode, detail: detailMount, ratio: 42,
      listLabel: 'Requirements queue', detailLabel: 'Requirement inspector'
    });

    wrap.appendChild(switcher);
    wrap.appendChild(masterDetail);
    activate(0);
    return wrap;
  }

  /**
   * Builds the Audit Lineage body: the methodology chain rendered as connected
   * nodes with Requirement highlighted. Each node shows its real count and links
   * into its workspace; absent nodes read "—". The chain reads left-to-right on
   * wide canvases and stacks on narrow ones (stylesheet).
   */
  function buildLineageBody(lineage) {
    return WS.buildLineageBody('aos-requirements', lineage);
  }

  /** Builds the Metadata body: the shared Metadata List of presentation fields. */
  function buildMetadataBody(metadata) {
    var pairs = [
      { term: 'Created', detail: metadata.created },
      { term: 'Modified', detail: metadata.modified },
      { term: 'Owner', detail: metadata.owner },
      { term: 'Version', detail: metadata.version },
      { term: 'Tags', detail: asArray(metadata.tags).join(' · ') },
      { term: 'Source', detail: metadata.source }
    ];
    return WS.metadataBody(pairs);
  }

  /** Builds the Related information supporting panel body: related audit objects with navigation. */
  function buildRelatedBody(relationships) {
    return WS.buildRelatedBody(relationships, {
      icon: '◇', title: 'No related objects',
      description: 'The audit domains the requirements connect to appear here once they hold data.'
    });
  }

  /** Builds the Activity Feed for the activity supporting panel. */
  function buildActivityBody(activity) {
    return WS.buildActivityBody(activity, {
      icon: '◇', title: 'No recent activity',
      description: 'Requirement drafts, refinements, and approval decisions appear here as the engagement progresses.'
    });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    return WS.buildFooterItems('aos-requirements', entries);
  }

  /**
   * Host-agnostic Inspector renderer (§9): given the requirements queue and the
   * resolution context, returns one self-contained Master–Detail node — the
   * requirements rail beside the Requirement Inspector — making no assumption
   * about where it is mounted. Release 1 mounts the fuller Queue (with its view
   * switcher) in the primary content; this renderer exposes the same master →
   * detail interaction for any other host with no change here.
   */
  function renderInspector(queue, context) {
    var detailMount = el('div', 'aos-requirements__detail-mount');
    var listNode = el('div', 'aos-requirements__row-list');
    listNode.setAttribute('role', 'list');
    mountRailGroups(listNode, detailMount, [{ label: '', rows: queue }], context);
    return presentation().masterDetail({
      list: listNode, detail: detailMount, ratio: 42,
      listLabel: 'Requirements queue', detailLabel: 'Requirement inspector'
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
   * The ordered requirements sections (§ Workspace Structure): operational
   * health, the requirements queue with its three views and the inspector, the
   * audit lineage, then the collection metadata. Each entry names the section id,
   * its header, whether it has data, its body builder, and an empty descriptor
   * used when the data is absent (§ Empty States).
   */
  function primarySections(viewModel, targetId) {
    var context = viewModel.context;
    return [
      {
        id: 'health', kicker: 'Operational status', title: 'Requirement health',
        present: true, body: function () { return buildHealthStrip(viewModel.requirementHealth); }
      },
      {
        id: 'queue', kicker: 'Operational queue', title: 'Requirements queue',
        description: 'Every requirement for the engagement. Switch between Requirement view, Pending by POC, and Evidence view — the same dataset, regrouped — and select a requirement to open its Inspector.',
        present: viewModel.queue.length > 0,
        body: function () { return buildQueueBody(viewModel.views, context, targetId); },
        empty: {
          icon: '◇', title: 'No requirements yet',
          description: 'Requirements appear here as they are drafted for the engagement. Release 2 adds AI-drafted and AI-refined requirements; Release 1 renders only the current requirement state.'
        }
      },
      {
        id: 'lineage', kicker: 'Relationships', title: 'Audit lineage',
        description: 'Where requirements sit in the audit chain, from walkthrough through to report.',
        present: viewModel.lineage.length > 0,
        body: function () { return buildLineageBody(viewModel.lineage); },
        empty: {
          icon: '◇', title: 'No lineage available',
          description: 'The audit lineage appears here once the workspaces are registered.'
        }
      },
      {
        id: 'metadata', kicker: 'Record', title: 'Metadata',
        present: true, body: function () { return buildMetadataBody(viewModel.metadata); }
      }
    ];
  }

  /** Renders the ready requirements experience into the framework slots. */
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

    var canvas = el('div', 'aos-requirements');
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
      description: 'AI-drafted requirement refinement — draft requirements, proposed mutations, and duplicate or obsolete detection — will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
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
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'detail', label: 'Loading requirements' })]);
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
        '. Regenerate the demo-data bundle and reload to restore the Requirements Workspace.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders the Requirements Workspace when it is the active workspace: the ready
   * experience once the state has loaded, the loading skeleton before that, and
   * the degraded explanation when no engagement is available.
   */
  function renderActiveRequirements() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.REQUIREMENTS) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.REQUIREMENTS + '"]'
    );
    if (!view) {
      return;
    }

    var viewModel = state ? collectViewModel(state, registry) : null;
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

  AuditOS.requirementsWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      formatDate: formatDate,
      formatPeriod: formatPeriod,
      normalizeFrameworks: normalizeFrameworks,
      deriveCurrentEngagement: deriveCurrentEngagement,
      resolveStatusTone: resolveStatusTone,
      normalizeControlIds: normalizeControlIds,
      normalizeEvidenceIds: normalizeEvidenceIds,
      normalizeEvidenceRequestIds: normalizeEvidenceRequestIds,
      resolveTeamId: resolveTeamId,
      resolveEvidenceType: resolveEvidenceType,
      resolveFrequency: resolveFrequency,
      deriveEvidenceStatus: deriveEvidenceStatus,
      deriveFrameworkMapping: deriveFrameworkMapping,
      deriveRequirementRow: deriveRequirementRow,
      deriveQueue: deriveQueue,
      deriveRequirementHealth: deriveRequirementHealth,
      deriveCollectionStatus: deriveCollectionStatus,
      requirementView: requirementView,
      pendingByPocView: pendingByPocView,
      evidenceView: evidenceView,
      deriveViews: deriveViews,
      deriveLineage: deriveLineage,
      deriveRelationships: deriveRelationships,
      deriveActivity: deriveActivity,
      deriveMetadata: deriveMetadata,
      deriveVersionHistory: deriveVersionHistory,
      deriveApprovalHistory: deriveApprovalHistory,
      deriveActivityHistory: deriveActivityHistory,
      buildRequirementInspector: buildRequirementInspector
    },

    collectViewModel: collectViewModel,

    // Host-agnostic Inspector renderer (§9): data → one self-contained node,
    // mountable in any host. Release 1 mounts the fuller Queue in primary content.
    renderInspector: renderInspector,

    /**
     * Binds the Requirements Workspace to the router and the Shared Audit State.
     * Safe to call once, after the DOM is ready, the router has resolved the
     * initial route, and the framework has rendered its skeleton (script order
     * guarantees the framework's route listener runs first). Does nothing when
     * the routing or state foundations are absent, so the shell degrades rather
     * than throwing.
     */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveRequirements);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveRequirements);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveRequirements);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveRequirements);
      }
      renderActiveRequirements();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.requirementsWorkspace.init);
    } else {
      AuditOS.requirementsWorkspace.init();
    }
  }
})(window);
