/**
 * AuditOS Evidence Workspace
 * Workspaces and Navigation — Chapter 12 / Workspace Architecture — Chapter 61 /
 * Audit Lifecycle — Chapter 11 / Component Architecture — Chapter 74
 *
 * The operational system of record for an engagement (GitHub Issue #21). It
 * answers what evidence exists, what is still outstanding, where it originated,
 * what requirements and controls depend on it, what approvals are pending, and
 * what may be reused. Release 1 is a faithful visualization of the existing
 * evidence JSON: no AI, no SharePoint, no backend, no workflow engine, no
 * writes.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to the
 * Engagement and Walkthrough workspaces. `collectViewModel` is the single place
 * this workspace reads `AuditOS.state`; it returns a declarative model of pure,
 * offline-testable derivations. The renderer configures the Shared Workspace
 * Framework's inherited skeleton (`AuditOS.workspaceFramework.configure`) and
 * fills its slots with compositions from the Enterprise Data Presentation System
 * (`AuditOS.presentation`) — no bespoke primitives, no duplicated components
 * (Component Design Patterns §81.4 — Composition Over Duplication).
 *
 * Evidence records are read through the same engagement-scoped document pattern
 * as controls, testing, and findings (`findDatasetsForEngagement` /
 * `getDocument`). The evidence collection carries two reuse shapes across
 * datasets — `reuse` (same-company) and `knowledgeReuse` (cross-company
 * methodology) — so `normalizeReuse` reads whichever is present and fabricates
 * nothing where neither exists. Requirement, control, POC, team, and business
 * unit identifiers are resolved to names only when they genuinely join; an
 * unresolved id renders as its raw value, never a fabricated label. This keeps
 * the workspace faithful across the mixed demo datasets while opening the
 * Release 2 seams (SharePoint reuse, AI evidence analysis) without a redesign.
 *
 * Presentation only. Every business value is read through `AuditOS.state`;
 * nothing is written. Sections with no data render shared Empty State
 * components; nothing is fabricated. The AI surface is a reserved presentation
 * region — AI stays advisory and human approval remains mandatory. The
 * inspector's selection is memory-only presentation state, and the inspector
 * renderer is host-agnostic (data in, one self-contained node out) so a later
 * release can mount it in a side panel with no change here.
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
   * Evidence review-status vocabulary (read, never invented) and its tones.
   * The production dataset's `reviewStatus` mirrors the shared evidenceStatus
   * vocabulary (enums.json); the demo-lifecycle vocabulary (Approved/Pending
   * Review/Rejected) is kept as a fallback for a differently sourced dataset.
   */
  var REVIEW_STATUS = { APPROVED: 'Approved', PENDING_REVIEW: 'Pending Review', REJECTED: 'Rejected' };
  var REVIEW_TONES = {
    'Approved': TONES.SUCCESS, 'Pending Review': TONES.WARNING, 'Rejected': TONES.ERROR,
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
   * Evidence-request status vocabulary (read, never invented) and its tones.
   * The production dataset's `status` mirrors the same evidenceStatus
   * vocabulary as review status; the demo-lifecycle vocabulary (Submitted/
   * Accepted) is kept as a fallback for a differently sourced dataset.
   */
  var REQUEST_STATUS = { PENDING: 'Pending', SUBMITTED: 'Submitted', ACCEPTED: 'Accepted', REJECTED: 'Rejected' };
  var REQUEST_TONES = {
    'Pending': TONES.WARNING, 'Submitted': TONES.INFO, 'Accepted': TONES.SUCCESS, 'Rejected': TONES.ERROR,
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

  /** Request-priority vocabulary → tone. High reads urgent, Medium informational, Low neutral. */
  var PRIORITY_TONES = { 'High': TONES.ERROR, 'Medium': TONES.INFO, 'Low': null };

  /** Maximum entries per list so sections stay scannable. */
  var LIST_LIMIT = WS.LIST_LIMIT;

  /** Larger cap for the operational queue and library, which are the working surfaces. */
  var QUEUE_LIMIT = 50;

  /** Entrance stagger ceiling — sections beyond this share the last delay. */
  var STAGGER_LIMIT = WS.STAGGER_LIMIT;

  // ------------------------------------------------------------------
  // Pure derivation helpers — no DOM, no AuditOS.state access. Each takes plain
  // records and returns plain view data, so the offline unit suites exercise
  // them directly (derived values remain derived, §30.12).
  // ------------------------------------------------------------------

  /** Returns the value when it is an array, otherwise an empty array. */
  var asArray = WS.asArray;

  /** Naive English pluralization for whole-count labels. */
  var plural = WS.plural;

  /** Formats an ISO `YYYY-MM-DD` date as a compact, deterministic label. */
  var formatDate = WS.formatDate;

  /** Formats a `{ startDate, endDate }` period as `start – end`. */
  var formatPeriod = WS.formatPeriod;

  /**
   * The frameworks attached to an engagement, always as an array. Identical
   * Release 1 → Release 2 seam as the other workspaces: a future engagement
   * with a `frameworks` array renders every entry; today's single `framework`
   * string becomes a one-element array; neither yields an empty array.
   */
  var normalizeFrameworks = WS.normalizeFrameworks;

  /** The current engagement: identical rule to Home, Engagement, and Walkthrough. */
  var deriveCurrentEngagement = WS.deriveCurrentEngagement;

  /** Resolves an evidence review status to a presentation tone. */
  function resolveReviewTone(status) {
    return Object.prototype.hasOwnProperty.call(REVIEW_TONES, status) ? REVIEW_TONES[status] : TONES.INFO;
  }

  /** Resolves an evidence-request status to a presentation tone. */
  function resolveRequestTone(status) {
    return Object.prototype.hasOwnProperty.call(REQUEST_TONES, status) ? REQUEST_TONES[status] : TONES.INFO;
  }

  /** Resolves a request priority to a presentation tone. */
  function resolvePriorityTone(priority) {
    return Object.prototype.hasOwnProperty.call(PRIORITY_TONES, priority) ? PRIORITY_TONES[priority] : null;
  }

  /**
   * Normalizes the two reuse shapes the evidence datasets carry into one plain
   * descriptor, or null when a record declares no reuse. `reuse` is the
   * same-company shape (`eligible`, `sourceEngagementId`, `sourceEvidenceId`,
   * `reuseDecision`); `knowledgeReuse` is the cross-company methodology shape
   * (`methodologyReusable`, `sourceCompanyId`, `sourceEngagementId`,
   * `evidenceReusable`). Nothing is fabricated: a record with neither key, or
   * one whose reuse is not eligible in any form, yields null.
   */
  function normalizeReuse(record) {
    var source = record || {};
    if (source.reuse && typeof source.reuse === 'object') {
      var r = source.reuse;
      if (!r.eligible) {
        return null;
      }
      return {
        eligible: true,
        kind: 'evidence',
        sourceEngagementId: r.sourceEngagementId || '',
        sourceEvidenceId: r.sourceEvidenceId || '',
        decision: r.reuseDecision || r.action || ''
      };
    }
    if (source.knowledgeReuse && typeof source.knowledgeReuse === 'object') {
      var k = source.knowledgeReuse;
      if (!k.methodologyReusable && !k.evidenceReusable) {
        return null;
      }
      return {
        eligible: true,
        kind: k.evidenceReusable ? 'evidence' : 'methodology',
        sourceEngagementId: k.sourceEngagementId || '',
        sourceCompanyId: k.sourceCompanyId || '',
        decision: k.evidenceReusable ? 'Evidence reusable' : 'Methodology reusable'
      };
    }
    return null;
  }

  /** The origin of an evidence record: its reuse source when present, else a direct upload. */
  function deriveEvidenceSource(record) {
    var reuse = normalizeReuse(record);
    if (reuse && reuse.sourceEngagementId) {
      return 'Reused from ' + reuse.sourceEngagementId;
    }
    if (reuse) {
      return reuse.decision || 'Reusable';
    }
    return 'Direct upload';
  }

  /** Counts records for which the predicate holds. */
  function count(records, predicate) {
    return asArray(records).filter(predicate).length;
  }

  /** Reads a numeric field from a summary, falling back to a counted value. */
  function summaryValue(summary, key, fallback) {
    var value = summary && typeof summary[key] === 'number' ? summary[key] : undefined;
    return value !== undefined ? value : fallback;
  }

  /**
   * The Evidence Health strip — six operational indicators, status-bar style
   * (editor status bar, not KPI cards): Pending Requests, Submitted, Approved,
   * Rejected, Reusable Evidence, and Outstanding Approvals. Each value reads
   * from the authoritative summary where present and falls back to a real count
   * of the records, so it is never fabricated. An empty engagement reads "None".
   */
  function deriveEvidenceHealth(evidenceSummary, requestSummary, evidenceRecords, requestRecords) {
    var evidence = asArray(evidenceRecords);
    var requests = asArray(requestRecords);

    var pendingRequests = summaryValue(requestSummary, 'pending',
      count(requests, function (request) { return request.status === REQUEST_STATUS.PENDING; }));
    var submitted = summaryValue(requestSummary, 'submitted',
      count(requests, function (request) { return request.status === REQUEST_STATUS.SUBMITTED; }));
    var approved = summaryValue(evidenceSummary, 'approved',
      count(evidence, function (item) { return item.reviewStatus === REVIEW_STATUS.APPROVED; }));
    var rejected = summaryValue(evidenceSummary, 'rejected',
      count(evidence, function (item) { return item.reviewStatus === REVIEW_STATUS.REJECTED; }));
    var reusable = count(evidence, function (item) { return normalizeReuse(item) !== null; });
    var outstandingApprovals = summaryValue(evidenceSummary, 'pendingReview',
      count(evidence, function (item) { return item.reviewStatus === REVIEW_STATUS.PENDING_REVIEW; }));

    return [
      {
        key: 'pending-requests', label: 'Pending requests',
        status: pendingRequests > 0 ? String(pendingRequests) : 'None',
        tone: pendingRequests > 0 ? TONES.WARNING : null
      },
      {
        key: 'submitted', label: 'Submitted',
        status: submitted > 0 ? String(submitted) : 'None',
        tone: submitted > 0 ? TONES.INFO : null
      },
      {
        key: 'approved', label: 'Approved',
        status: approved > 0 ? String(approved) : 'None',
        tone: approved > 0 ? TONES.SUCCESS : null
      },
      {
        key: 'rejected', label: 'Rejected',
        status: rejected > 0 ? String(rejected) : 'None',
        tone: rejected > 0 ? TONES.ERROR : null
      },
      {
        key: 'reusable', label: 'Reusable evidence',
        status: reusable > 0 ? String(reusable) : 'None',
        tone: reusable > 0 ? TONES.INFO : null
      },
      {
        key: 'outstanding-approvals', label: 'Outstanding approvals',
        status: outstandingApprovals > 0 ? String(outstandingApprovals) : 'Clear',
        tone: outstandingApprovals > 0 ? TONES.WARNING : TONES.SUCCESS
      }
    ];
  }

  /** Resolves a record's name field from an id map, falling back to the raw id. */
  var resolveName = WS.resolveName;

  /**
   * The Outstanding Evidence queue — every request still needing work (any
   * status other than Accepted), earliest due date first. Each row resolves its
   * requirement, requested-from POC, owning team, and business unit to names
   * where the identifiers genuinely join, and renders the raw identifier
   * otherwise (never a fabricated label). The originating request is carried
   * through so the Inspector can render its full detail.
   */
  function deriveOutstanding(requests, context) {
    var ctx = context || {};
    return asArray(requests)
      .filter(function (request) { return request.status !== REQUEST_STATUS.ACCEPTED; })
      .map(function (request) {
        return {
          id: request.id,
          requirement: resolveName(ctx.requirementsById, request.requirementId, 'title'),
          requirementId: request.requirementId || '',
          requestedFrom: resolveName(ctx.pocsById, request.assignedToPocId, 'name'),
          owner: resolveName(ctx.teamsById, request.teamId, 'name'),
          businessUnit: resolveName(ctx.businessUnitsById, request.businessUnitId, 'name'),
          dueDate: request.dueDate || '',
          status: request.status || '',
          statusTone: resolveRequestTone(request.status),
          priority: request.priority || '',
          priorityTone: resolvePriorityTone(request.priority),
          request: request
        };
      })
      .sort(function (a, b) { return String(a.dueDate).localeCompare(String(b.dueDate)); })
      .slice(0, QUEUE_LIMIT);
  }

  /**
   * The Evidence Library — every evidence record already available, resolved to
   * display fields (title, category, owner, source, audit period, status, last
   * updated). Category reads the file type; owner resolves the uploading POC;
   * source derives from the reuse origin; the audit period is the engagement's,
   * passed through context. The record is carried through for the Inspector.
   */
  function deriveLibrary(evidenceRecords, context) {
    var ctx = context || {};
    return asArray(evidenceRecords)
      .map(function (item) {
        return {
          id: item.id,
          title: item.title || item.fileName || item.id,
          category: item.fileType || item.evidenceType || '',
          owner: resolveName(ctx.pocsById, item.uploadedByPocId, 'name'),
          source: deriveEvidenceSource(item),
          auditPeriod: ctx.auditPeriodLabel || '',
          status: item.reviewStatus || '',
          statusTone: resolveReviewTone(item.reviewStatus),
          lastUpdated: item.uploadedOn || '',
          reusable: normalizeReuse(item) !== null,
          evidence: item
        };
      })
      .sort(function (a, b) { return String(b.lastUpdated).localeCompare(String(a.lastUpdated)); })
      .slice(0, QUEUE_LIMIT);
  }

  /** The distinct review statuses present in the library, for the filter control. */
  function deriveLibraryStatuses(library) {
    var seen = {};
    var order = [];
    asArray(library).forEach(function (row) {
      if (row.status && !seen[row.status]) {
        seen[row.status] = true;
        order.push(row.status);
      }
    });
    return order;
  }

  /**
   * Evidence Reuse opportunities — the records that carry reuse information in
   * the JSON. Release 1 renders only what exists and derives no reuse
   * relationships itself; an engagement whose evidence declares no reuse yields
   * an empty list and the shared Empty State. Release 2 connects this to
   * SharePoint and overlapping audit periods.
   */
  function deriveReuse(evidenceRecords) {
    return asArray(evidenceRecords)
      .map(function (item) {
        var reuse = normalizeReuse(item);
        if (!reuse) {
          return null;
        }
        return {
          id: item.id,
          title: item.title || item.fileName || item.id,
          decision: reuse.decision,
          source: reuse.sourceEngagementId
            ? reuse.sourceEngagementId + (reuse.sourceEvidenceId ? ' · ' + reuse.sourceEvidenceId : '')
            : (reuse.sourceCompanyId || ''),
          kind: reuse.kind,
          tone: reuse.kind === 'evidence' ? TONES.SUCCESS : TONES.INFO
        };
      })
      .filter(Boolean)
      .slice(0, QUEUE_LIMIT);
  }

  /**
   * The Audit Lineage — Walkthrough → Requirement → Control → Evidence →
   * Testing → Finding → Report, with Evidence highlighted as the object this
   * workspace owns. Each node carries its real, current count for the
   * engagement and a link into its workspace; nodes with no data read "—" and
   * never a fabricated figure. The lineage is the audit methodology's shape (a
   * real structure); only the counts vary with the data.
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
      { id: ids.EVIDENCE, label: 'Requirement', count: requirements.requirements || 0, present: (requirements.requirements || 0) > 0, hint: 'What evidence must satisfy' },
      { id: ids.CONTROLS, label: 'Control', count: controls.controls || 0, present: (controls.controls || 0) > 0, hint: 'What depends on the evidence' },
      { id: ids.EVIDENCE, label: 'Evidence', count: evidence.evidenceItems || 0, present: (evidence.evidenceItems || 0) > 0, hint: 'System of record', highlighted: true },
      { id: ids.TESTING, label: 'Testing', count: testing.tests || 0, present: (testing.tests || 0) > 0, hint: 'What the evidence is tested against' },
      { id: ids.FINDINGS, label: 'Finding', count: findings.findings || 0, present: (findings.findings || 0) > 0, hint: 'What the testing surfaces' },
      { id: ids.REPORTING, label: 'Report', count: report ? null : 0, present: Boolean(report), hint: report ? report.status : 'Not started' }
    ];

    return WS.resolveLineageNodes(workspaceRegistry, nodes);
  }

  /**
   * Related audit objects for the supporting panel: the domains the evidence
   * connects to, each with its real count, only when data exists. Reuses the
   * same chain the lineage draws from.
   */
  function deriveRelationships(workspaceRegistry, operational) {
    if (!workspaceRegistry) {
      return [];
    }
    var ops = operational || {};
    var requirements = ops.requirements || {};
    var controls = ops.controls || {};
    var testing = ops.testing || {};
    var findings = ops.findings || {};
    var report = ops.report || null;
    var ids = workspaceRegistry.IDS;

    var related = [
      { id: ids.EVIDENCE, title: 'Requirements', meta: String(requirements.requirements || 0), present: (requirements.requirements || 0) > 0 },
      { id: ids.CONTROLS, title: 'Controls', meta: String(controls.controls || 0), present: (controls.controls || 0) > 0 },
      { id: ids.TESTING, title: 'Testing', meta: String(testing.tests || 0), present: (testing.tests || 0) > 0 },
      { id: ids.FINDINGS, title: 'Findings', meta: String(findings.findings || 0), present: (findings.findings || 0) > 0 },
      { id: ids.REPORTING, title: 'Report', meta: report ? String(report.status) : '—', present: Boolean(report) }
    ];
    return WS.resolveRelationships(workspaceRegistry, related);
  }

  /**
   * Recent evidence activity, newest first: remarks recorded in the
   * immutable activity log, falling back to evidence receipts / request
   * submissions when a dataset carries those dated fields instead. Every
   * event derives from a real dated record; undated records never appear.
   */
  function deriveActivity(evidenceRecords, requestRecords, activityEvents, actorNames) {
    var names = actorNames || {};
    var events = asArray(activityEvents)
      .filter(function (event) { return event && event.at; })
      .map(function (event) {
        return {
          actor: names[event.byId] || (event.authorSide === 'ha' ? 'Halcyon' : 'Client'),
          title: 'recorded a remark on ' + (event.entityId || event.entityType || ''),
          meta: event.note || '',
          timestamp: formatDate(event.at),
          date: event.at
        };
      });
    asArray(evidenceRecords).forEach(function (item) {
      if (!item.uploadedOn) {
        return;
      }
      events.push({
        title: 'Evidence received: ' + (item.title || item.fileName || item.id),
        meta: 'Review status: ' + (item.reviewStatus || ''),
        timestamp: formatDate(item.uploadedOn),
        date: item.uploadedOn,
        kind: 'review', value: item.reviewStatus
      });
    });
    asArray(requestRecords).forEach(function (request) {
      if (!request.submittedOn) {
        return;
      }
      events.push({
        title: 'Evidence submitted for request ' + request.id,
        meta: 'Review status: ' + (request.reviewStatus || 'Submitted'),
        timestamp: formatDate(request.submittedOn),
        date: request.submittedOn,
        kind: 'review', value: 'Submitted'
      });
    });
    return events
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
      .slice(0, LIST_LIMIT);
  }

  /**
   * Evidence collection metadata: created / modified / owner / version / tags /
   * source, derived from the evidence document's metadata, the engagement, and
   * the company. Only fields with real values are surfaced by the builder.
   */
  function deriveMetadata(evidenceMetadata, engagement, company, evidenceRecords) {
    var meta = evidenceMetadata || {};
    var tagSet = {};
    asArray(evidenceRecords).forEach(function (item) {
      asArray(item.tags).forEach(function (tag) { tagSet[tag] = true; });
    });
    return {
      created: company && company.createdAt ? formatDate(company.createdAt) : '',
      modified: meta.generatedAt ? formatDate(String(meta.generatedAt).slice(0, 10)) : '',
      owner: engagement ? (engagement.engagementLead || engagement.auditor || '') : '',
      version: meta.version || '',
      tags: Object.keys(tagSet),
      source: meta.dataset || ''
    };
  }

  /** One text-valued Inspector section rendered as a single placeholder-capable list row. */
  var textSection = WS.textSection;

  /** One list-valued Inspector section; an empty list renders one placeholder row. */
  var listSection = WS.listSection;

  /** Normalizes a linked-id reference, resolving its name where it joins. */
  var toRefItem = WS.resolveRefItem;

  /**
   * The Evidence Inspector configuration for one evidence record (Master →
   * Detail detail pane). Renders metadata, current status, owner, audit period,
   * source, related requirements, related controls, related walkthroughs,
   * related testing, approval history, and activity history — a placeholder row
   * wherever the JSON lacks data, and never a fabricated relationship. Pure:
   * returns plain Inspector Panel configuration, no DOM. Host-agnostic.
   */
  function buildEvidenceInspector(evidence, context) {
    var item = evidence || {};
    var ctx = context || {};
    var reuse = normalizeReuse(item);
    var status = item.reviewStatus || '';
    var owner = resolveName(ctx.pocsById, item.uploadedByPocId, 'name');

    var approvalHistory = status
      ? [{ title: status, description: item.uploadedOn ? 'As of ' + formatDate(item.uploadedOn) : '', tone: resolveReviewTone(status) }]
      : [];

    var activityHistory = item.uploadedOn
      ? [{ title: 'Uploaded' + (owner ? ' by ' + owner : ''), description: formatDate(item.uploadedOn), tone: TONES.INFO }]
      : [];

    return {
      eyebrow: item.fileType || 'Evidence',
      title: item.title || item.fileName || item.id || '',
      subtitle: [item.id, status].filter(Boolean).join(' · '),
      badges: status ? [{ label: status, tone: resolveReviewTone(status) }] : [],
      sections: [
        {
          title: 'Properties', kind: 'properties', columns: 2,
          rows: [
            { label: 'Evidence id', value: item.id || '' },
            { label: 'File name', value: item.fileName || '' },
            { label: 'File type', value: item.fileType || '' },
            { label: 'Version', value: item.version || '' },
            { label: 'Status', value: status },
            { label: 'Owner', value: owner },
            { label: 'Audit period', value: ctx.auditPeriodLabel || '' },
            { label: 'Source', value: deriveEvidenceSource(item) },
            { label: 'Uploaded', value: formatDate(item.uploadedOn) },
            { label: 'Storage path', value: item.storagePath || '' }
          ].filter(function (row) { return row.value; })
        },
        textSection('Description',
          item.description || (item.fileName ? item.fileName + (item.fileType ? ' · ' + item.fileType : '') : ''),
          'No description recorded for this evidence.'),
        listSection('Related requirements',
          asArray(item.linkedRequirementIds).map(function (id) { return toRefItem(id, ctx.requirementsById, 'title'); }),
          'No linked requirements recorded.'),
        listSection('Related controls',
          asArray(item.linkedControlIds).map(function (id) { return toRefItem(id, ctx.controlsById, 'title'); }),
          'No linked controls recorded.'),
        listSection('Related walkthroughs', [],
          'No linked walkthroughs yet — walkthrough linkage arrives with the walkthrough collection.'),
        listSection('Related testing', [],
          'No linked testing recorded for this evidence.'),
        listSection('Approval history', approvalHistory, 'No approval decision recorded yet.'),
        listSection('Activity history', activityHistory, 'No activity recorded for this evidence.'),
        reuse
          ? listSection('Reuse', [{ title: reuse.decision || 'Reusable', description: reuse.sourceEngagementId ? 'Source: ' + reuse.sourceEngagementId : '', tone: TONES.INFO }], '')
          : { title: 'Reuse', kind: 'placeholder', empty: { icon: '◇', title: 'No reuse recorded', description: 'Reuse opportunities appear here when the evidence declares them. Release 2 connects reuse to SharePoint and overlapping audit periods.' } }
      ]
    };
  }

  /**
   * The Inspector configuration for one outstanding evidence request. Renders
   * the request's requirement, requested-from POC, owner, due date, status,
   * priority, and business unit, plus its linked controls and any reuse — all
   * resolved to names where the identifiers join. Pure. Host-agnostic.
   */
  function buildRequestInspector(request, context) {
    var req = request || {};
    var ctx = context || {};
    var reuse = normalizeReuse(req);
    var status = req.status || '';

    return {
      eyebrow: 'Evidence request',
      title: resolveName(ctx.requirementsById, req.requirementId, 'title') || req.id || '',
      subtitle: [req.id, status].filter(Boolean).join(' · '),
      badges: [
        status ? { label: status, tone: resolveRequestTone(status) } : null,
        req.priority ? { label: req.priority + ' priority', tone: resolvePriorityTone(req.priority) } : null
      ].filter(Boolean),
      sections: [
        {
          title: 'Properties', kind: 'properties', columns: 2,
          rows: [
            { label: 'Request id', value: req.id || '' },
            { label: 'Requirement', value: req.requirementId || '' },
            { label: 'Requested from', value: resolveName(ctx.pocsById, req.assignedToPocId, 'name') },
            { label: 'Backup contact', value: resolveName(ctx.pocsById, req.backupPocId, 'name') },
            { label: 'Owner', value: resolveName(ctx.teamsById, req.teamId, 'name') },
            { label: 'Business unit', value: resolveName(ctx.businessUnitsById, req.businessUnitId, 'name') },
            { label: 'Requested on', value: formatDate(req.requestedOn) },
            { label: 'Due date', value: formatDate(req.dueDate) },
            { label: 'Submitted on', value: formatDate(req.submittedOn) },
            { label: 'Status', value: status },
            { label: 'Priority', value: req.priority || '' },
            { label: 'Reminders sent', value: typeof req.remindersSent === 'number' ? String(req.remindersSent) : '' }
          ].filter(function (row) { return row.value; })
        },
        listSection('Related controls',
          asArray(req.linkedControlIds).map(function (id) { return toRefItem(id, ctx.controlsById, 'title'); }),
          'No linked controls recorded.'),
        textSection('Comments', req.comments, 'No comments recorded on this request.'),
        reuse
          ? listSection('Reuse', [{ title: reuse.decision || 'Reusable', description: reuse.sourceEngagementId ? 'Source: ' + reuse.sourceEngagementId : '', tone: TONES.INFO }], '')
          : { title: 'Reuse', kind: 'placeholder', empty: { icon: '◇', title: 'No reuse recorded', description: 'Reuse eligibility appears here when the request declares it.' } }
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
   * Collects everything the Evidence Workspace presents from the Shared Audit
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
    var actorNames = {};
    asArray(pocs).forEach(function (poc) { if (poc.id && poc.name) { actorNames[poc.id] = poc.name; } });
    asArray(users).forEach(function (user) { if (user.id && user.name) { actorNames[user.id] = user.name; } });

    var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
    var requestsDocument = readEngagementDocument(state, 'evidence-requests', engagement.id) || {};
    var requirementsDocument = readEngagementDocument(state, 'evidence-requirements', engagement.id) || {};
    var controlsDocument = readEngagementDocument(state, 'controls', engagement.id) || {};
    var testingDocument = readEngagementDocument(state, 'testing', engagement.id) || {};
    var findingsDocument = readEngagementDocument(state, 'findings', engagement.id) || {};
    var reportsDocument = readEngagementDocument(state, 'reports', engagement.id) || {};
    var activityDocument = readEngagementDocument(state, 'activity', engagement.id) || {};

    var evidenceRecords = asArray(evidenceDocument.evidence);
    var requestRecords = asArray(requestsDocument.requests);
    var requirementsById = indexById(requirementsDocument.requirements);
    var controlsById = indexById(controlsDocument.controls);

    var operational = {
      requirements: requirementsDocument.summary || {},
      controls: controlsDocument.summary || {},
      evidence: evidenceDocument.summary || {},
      testing: testingDocument.summary || {},
      findings: findingsDocument.summary || {},
      report: reportsDocument.document || null
    };

    var frameworks = normalizeFrameworks(engagement);
    var auditPeriodLabel = formatPeriod(engagement.auditPeriod);

    var context = {
      requirementsById: requirementsById,
      controlsById: controlsById,
      pocsById: pocsById,
      teamsById: teamsById,
      businessUnitsById: businessUnitsById,
      auditPeriodLabel: auditPeriodLabel,
      engagement: engagement,
      company: company
    };

    var outstanding = deriveOutstanding(requestRecords, context);
    var library = deriveLibrary(evidenceRecords, context);
    var reuse = deriveReuse(evidenceRecords);
    var relationships = deriveRelationships(workspaceRegistry, operational);
    var collectionStatus = deriveCollectionStatus(evidenceDocument.summary, requestRecords);

    return {
      degraded: false,
      status: status,
      engagement: engagement,
      company: company,
      frameworks: frameworks,
      context: context,

      header: {
        eyebrow: engagement.engagementCode + ' · Evidence',
        title: company ? company.name : engagement.companyId,
        meta: engagement.name + ' · system of record',
        frameworks: frameworks,
        status: collectionStatus,
        lastUpdated: evidenceDocument.metadata && evidenceDocument.metadata.generatedAt
          ? 'Updated ' + formatDate(String(evidenceDocument.metadata.generatedAt).slice(0, 10))
          : '',
        actions: [{ label: 'Engagement overview', href: '#/engagements', variant: 'subtle' }]
      },

      ribbon: [
        { label: 'Client', value: company ? company.name : engagement.companyId },
        { label: 'Audit period', value: auditPeriodLabel },
        { label: 'Evidence items', value: String(evidenceRecords.length) }
      ],

      toolbar: { search: { placeholder: 'Search evidence' } },
      filterBar: {
        dropdowns: [{ label: 'Framework', options: ['All frameworks'].concat(frameworks) }]
      },

      evidenceHealth: deriveEvidenceHealth(evidenceDocument.summary, requestsDocument.summary, evidenceRecords, requestRecords),
      outstanding: outstanding,
      library: library,
      libraryStatuses: deriveLibraryStatuses(library),
      reuse: reuse,
      lineage: deriveLineage(workspaceRegistry, operational),
      relationships: relationships,
      activity: deriveActivity(evidenceRecords, requestRecords, asArray(activityDocument.events), actorNames),
      metadata: deriveMetadata(evidenceDocument.metadata, engagement, company, evidenceRecords),

      footer: [
        { label: 'Environment', value: 'Static prototype' },
        { label: 'Demo status', value: status.demoDataLoaded ? 'Demo data loaded' : 'Demo data degraded' }
      ]
    };
  }

  /**
   * The evidence collection status for the header badge: awaiting when nothing
   * is collected, complete once every request is accepted, in progress
   * otherwise. Never a fabricated count.
   */
  function deriveCollectionStatus(evidenceSummary, requestRecords) {
    var requests = asArray(requestRecords);
    var items = evidenceSummary && typeof evidenceSummary.evidenceItems === 'number' ? evidenceSummary.evidenceItems : 0;
    if (items === 0 && requests.length === 0) {
      return { label: 'Awaiting', tone: null };
    }
    var outstanding = count(requests, function (request) { return request.status !== REQUEST_STATUS.ACCEPTED; });
    if (requests.length > 0 && outstanding === 0) {
      return { label: 'Complete', tone: TONES.SUCCESS };
    }
    return { label: 'Collecting', tone: TONES.INFO };
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
    return WS.buildSection('aos-evidence', id, meta, bodyNode);
  }

  /**
   * Builds the Evidence Health strip: a row of tone-dot indicators (editor
   * status-bar style, identical composition to the other operational
   * workspaces). The status text carries the meaning; the dot only reinforces
   * the tone, so health reads without relying on color.
   */
  function buildHealthStrip(items) {
    return WS.buildHealthStrip('aos-evidence', 'Evidence health', items);
  }

  /**
   * Builds a Master–Detail whose master is a rail of selectable rows and whose
   * detail shows the selected row's Inspector Panel. Selecting a row swaps the
   * detail — memory-only presentation state. The row builder and the detail
   * builder are supplied by the caller, so the Outstanding queue and the
   * Evidence Library share exactly one interaction implementation (no
   * duplication). `filterValue` on a row lets a caller dim rows via
   * `wireStatusFilter`. Returns the master-detail node and its list node.
   */
  function buildMasterDetail(rows, options) {
    var P = presentation();
    var opts = options || {};
    var list = el('div', opts.listClass || 'aos-evidence__row-list');
    list.setAttribute('role', 'list');
    var detailMount = el('div', 'aos-evidence__detail-mount');

    var rowNodes = [];
    function select(index) {
      rowNodes.forEach(function (node, nodeIndex) {
        var selected = nodeIndex === index;
        node.classList.toggle('aos-evidence__row--selected', selected);
        node.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      if (rows[index]) {
        detailMount.replaceChildren(P.inspectorPanel(opts.buildDetail(rows[index])));
      }
    }

    asArray(rows).forEach(function (row, index) {
      var node = opts.buildRow(row);
      node.classList.add('aos-evidence__row');
      node.setAttribute('aria-pressed', 'false');
      if (opts.filterValue) {
        node.setAttribute('data-filter-value', opts.filterValue(row));
      }
      node.addEventListener('click', function () { select(index); });
      rowNodes.push(node);
      list.appendChild(node);
    });

    if (rows.length > 0) {
      select(0);
    }

    var masterDetail = P.masterDetail({
      list: list, detail: detailMount, ratio: opts.ratio || 38,
      listLabel: opts.listLabel || 'Collection', detailLabel: opts.detailLabel || 'Detail'
    });
    return { node: masterDetail, list: list };
  }

  /** Builds one Outstanding Evidence master row: requirement, status, and operational meta. */
  function buildOutstandingRow(row) {
    var P = presentation();
    var node = el('button', null);
    node.type = 'button';

    var head = el('div', 'aos-evidence__row-head');
    head.appendChild(el('span', 'aos-evidence__row-title', row.requirement || row.requirementId));
    if (row.status) {
      head.appendChild(P.statusBadge({ label: row.status, tone: row.statusTone }));
    }
    node.appendChild(head);

    var meta = el('div', 'aos-evidence__row-meta');
    if (row.requestedFrom) {
      meta.appendChild(el('span', null, row.requestedFrom));
    }
    if (row.dueDate) {
      meta.appendChild(el('span', 'aos-numeric', 'Due ' + formatDate(row.dueDate)));
    }
    if (row.priority) {
      meta.appendChild(el('span', null, row.priority + ' priority'));
    }
    node.appendChild(meta);
    return node;
  }

  /** Builds one Evidence Library master row: title, status, and library meta. */
  function buildLibraryRow(row) {
    var P = presentation();
    var node = el('button', null);
    node.type = 'button';

    var head = el('div', 'aos-evidence__row-head');
    head.appendChild(el('span', 'aos-evidence__row-title', row.title));
    if (row.status) {
      head.appendChild(P.statusBadge({ label: row.status, tone: row.statusTone }));
    }
    node.appendChild(head);

    var meta = el('div', 'aos-evidence__row-meta');
    if (row.category) {
      meta.appendChild(el('span', null, row.category));
    }
    if (row.owner) {
      meta.appendChild(el('span', null, row.owner));
    }
    if (row.lastUpdated) {
      meta.appendChild(el('span', 'aos-numeric', formatDate(row.lastUpdated)));
    }
    if (row.reusable) {
      meta.appendChild(el('span', 'aos-evidence__row-flag', 'Reusable'));
    }
    return node;
  }

  /**
   * Builds the Evidence Library body: a status filter control above a
   * Master–Detail of evidence rows and the Evidence Inspector. The filter dims
   * rows not matching the chosen review status (presentation-only, memory-only
   * — no state written, no route changed), the same composition pattern the
   * Walkthrough workspace uses for process coverage.
   */
  function buildLibraryBody(library, statuses, context) {
    var wrap = el('div', 'aos-evidence__library');

    var masterDetail = buildMasterDetail(library, {
      listClass: 'aos-evidence__row-list',
      listLabel: 'Evidence library', detailLabel: 'Evidence inspector',
      ratio: 40,
      filterValue: function (row) { return row.status; },
      buildRow: buildLibraryRow,
      buildDetail: function (row) { return buildEvidenceInspector(row.evidence, context); }
    });

    if (asArray(statuses).length > 1) {
      wrap.appendChild(buildStatusFilter(statuses, masterDetail.list));
    }
    wrap.appendChild(masterDetail.node);
    return wrap;
  }

  /**
   * Builds a status filter chip group and wires it to a master list: choosing a
   * status dims the rows whose `data-filter-value` does not match; choosing the
   * active chip again clears the filter. Presentation-only, memory-only.
   */
  function buildStatusFilter(statuses, list) {
    var group = el('div', 'aos-evidence__filter');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Filter evidence by status');

    var chips = [];
    var options = ['All'].concat(asArray(statuses));

    function apply(activeIndex) {
      chips.forEach(function (chip, chipIndex) {
        var selected = chipIndex === activeIndex;
        chip.classList.toggle('aos-evidence__filter-chip--active', selected);
        chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      var value = activeIndex <= 0 ? null : options[activeIndex];
      var rows = list.querySelectorAll('[data-filter-value]');
      Array.prototype.forEach.call(rows, function (row) {
        var matches = value === null || row.getAttribute('data-filter-value') === value;
        row.classList.toggle('aos-evidence__row--dimmed', !matches);
      });
    }

    options.forEach(function (label, index) {
      var chip = el('button', 'aos-evidence__filter-chip', label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
      if (index === 0) {
        chip.classList.add('aos-evidence__filter-chip--active');
      }
      chip.addEventListener('click', function () { apply(index); });
      chips.push(chip);
      group.appendChild(chip);
    });
    return group;
  }

  /** Builds the Evidence Reuse body: an Item List of reuse opportunities, or the shared Empty State. */
  function buildReuseBody(reuse) {
    var P = presentation();
    if (asArray(reuse).length === 0) {
      return P.emptyState({
        icon: '◇', title: 'No reuse opportunities recorded',
        description: 'Evidence declaring reuse appears here. Release 1 renders only what the JSON contains; Release 2 connects reuse to SharePoint and overlapping audit periods.'
      });
    }
    return P.itemList(reuse.map(function (item) {
      return {
        title: item.title,
        description: item.decision + (item.source ? ' · ' + item.source : ''),
        tone: item.tone
      };
    }));
  }

  /**
   * Builds the Audit Lineage body: the methodology chain rendered as connected
   * nodes with Evidence highlighted. Each node shows its real count and links
   * into its workspace; absent nodes read "—". The chain reads left-to-right on
   * wide canvases and stacks on narrow ones (stylesheet).
   */
  function buildLineageBody(lineage) {
    return WS.buildLineageBody('aos-evidence', lineage);
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
      description: 'The audit domains the evidence connects to appear here once they hold data.'
    });
  }

  /** Builds the Activity Feed for the activity supporting panel. */
  function buildActivityBody(activity) {
    return WS.buildActivityBody(activity, {
      icon: '◇', title: 'No recent activity',
      description: 'Evidence receipts, submissions, and approval decisions appear here as the engagement progresses.'
    });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    return WS.buildFooterItems('aos-evidence', entries);
  }

  /**
   * Host-agnostic Inspector renderer (§9): given the evidence rows and the
   * resolution context, returns one self-contained Master–Detail node — the
   * Evidence Library rail beside the Evidence Inspector — making no assumption
   * about where it is mounted. Release 1 mounts it inside the Evidence Library
   * section; a later release can mount the same node in a dedicated inspector
   * region with no change here. Exposed on the public API so any host can reuse
   * it.
   */
  function renderInspector(library, context) {
    return buildMasterDetail(library, {
      listLabel: 'Evidence library', detailLabel: 'Evidence inspector', ratio: 40,
      buildRow: buildLibraryRow,
      buildDetail: function (row) { return buildEvidenceInspector(row.evidence, context); }
    }).node;
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Returns a framework slot inside the active workspace view. */
  var slotElement = WS.slotElement;

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /**
   * The ordered evidence sections (§ Workspace Structure): operational health,
   * the outstanding queue, the evidence library with its inspector, evidence
   * reuse, the audit lineage, then the collection metadata. Each entry names
   * the section id, its header, whether it has data, its body builder, and an
   * empty descriptor used when the data is absent (§10).
   */
  function primarySections(viewModel) {
    var context = viewModel.context;
    return [
      {
        id: 'health', kicker: 'Operational status', title: 'Evidence health',
        present: true, body: function () { return buildHealthStrip(viewModel.evidenceHealth); }
      },
      {
        id: 'outstanding', kicker: 'Operational queue', title: 'Outstanding evidence',
        description: 'Every evidence request still needing work. Select a request to inspect its requirement, contacts, and status.',
        present: viewModel.outstanding.length > 0,
        body: function () {
          return buildMasterDetail(viewModel.outstanding, {
            listLabel: 'Outstanding evidence requests', detailLabel: 'Request detail', ratio: 40,
            buildRow: buildOutstandingRow,
            buildDetail: function (row) { return buildRequestInspector(row.request, context); }
          }).node;
        },
        empty: {
          icon: '✓', title: 'No outstanding evidence',
          description: 'Every evidence request has been accepted. Outstanding requests appear here as they are raised.'
        }
      },
      {
        id: 'library', kicker: 'System of record', title: 'Evidence library',
        description: 'Evidence already available. Filter by status and select an item to open the Evidence Inspector.',
        present: viewModel.library.length > 0,
        body: function () { return buildLibraryBody(viewModel.library, viewModel.libraryStatuses, context); },
        empty: {
          icon: '◇', title: 'No evidence collected yet',
          description: 'Evidence records appear here once they are submitted for the engagement.'
        }
      },
      {
        id: 'reuse', kicker: 'Knowledge reuse', title: 'Evidence reuse',
        description: 'Reuse opportunities declared in the evidence JSON.',
        present: true,
        body: function () { return buildReuseBody(viewModel.reuse); }
      },
      {
        id: 'lineage', kicker: 'Relationships', title: 'Audit lineage',
        description: 'Where evidence sits in the audit chain, from walkthrough through to report.',
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

  /** Renders the ready evidence experience into the framework slots. */
  function renderReady(view, viewModel) {
    var P = presentation();

    AuditOS.workspaceFramework.configure(view, {
      header: viewModel.header,
      contextSummary: viewModel.ribbon,
      toolbar: viewModel.toolbar,
      filterBar: viewModel.filterBar
    });

    var canvas = el('div', 'aos-evidence');
    canvas.setAttribute('data-canvas', 'flush');
    var rendered = 0;
    primarySections(viewModel).forEach(function (section) {
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
      description: 'AI-drafted evidence analysis — gap detection, reuse suggestions, and requirement coverage — will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
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
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'detail', label: 'Loading evidence' })]);
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
        '. Regenerate the demo-data bundle and reload to restore the Evidence Workspace.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders the Evidence Workspace when it is the active workspace: the ready
   * experience once the state has loaded, the loading skeleton before that, and
   * the degraded explanation when no engagement is available.
   */
  function renderActiveEvidence() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.EVIDENCE) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.EVIDENCE + '"]'
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

  AuditOS.evidenceWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      formatDate: formatDate,
      formatPeriod: formatPeriod,
      normalizeFrameworks: normalizeFrameworks,
      deriveCurrentEngagement: deriveCurrentEngagement,
      resolveReviewTone: resolveReviewTone,
      resolveRequestTone: resolveRequestTone,
      resolvePriorityTone: resolvePriorityTone,
      normalizeReuse: normalizeReuse,
      deriveEvidenceSource: deriveEvidenceSource,
      deriveEvidenceHealth: deriveEvidenceHealth,
      deriveOutstanding: deriveOutstanding,
      deriveLibrary: deriveLibrary,
      deriveLibraryStatuses: deriveLibraryStatuses,
      deriveReuse: deriveReuse,
      deriveLineage: deriveLineage,
      deriveRelationships: deriveRelationships,
      deriveActivity: deriveActivity,
      deriveMetadata: deriveMetadata,
      deriveCollectionStatus: deriveCollectionStatus,
      buildEvidenceInspector: buildEvidenceInspector,
      buildRequestInspector: buildRequestInspector
    },

    collectViewModel: collectViewModel,

    // Host-agnostic Inspector renderer (§9): data → one self-contained node,
    // mountable in any host. Release 1 mounts it in the Evidence Library section.
    renderInspector: renderInspector,

    /**
     * Binds the Evidence Workspace to the router and the Shared Audit State.
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

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveEvidence);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveEvidence);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveEvidence);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveEvidence);
      }
      renderActiveEvidence();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.evidenceWorkspace.init);
    } else {
      AuditOS.evidenceWorkspace.init();
    }
  }
})(window);
