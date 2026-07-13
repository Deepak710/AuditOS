/**
 * AuditOS Evidence Workspace
 * Workspaces and Navigation — Chapter 12 / Workspace Architecture — Chapter 61 /
 * Audit Lifecycle — Chapter 11 / Component Architecture — Chapter 74 /
 * Engagement Evidence Workspace — GitHub Issue #38 (Parts 7–17)
 *
 * The operational system of record for an engagement's evidence (GitHub Issue
 * #21, completed by Issue #38). The workspace is one engagement-scoped
 * enterprise table: a header band of KPIs and operational charts that both
 * update with the filters and act as filters when clicked, above a dense,
 * filterable evidence table that owns its own scrolling while the page stays
 * fixed-height. Selecting a row opens the shared enterprise drawer (Issue #37);
 * status is edited inline through the existing Suggestion Lifecycle
 * (Suggested → Reviewed → Approved → Applied), so the Repository is written
 * only on Apply; control-mapping pills navigate directly to the mapped control.
 *
 * Everything resolves exclusively from the engagement in the active route
 * context (Issue #38 architectural rule): evidence, requirements, controls,
 * POCs, teams, and suggestions are read for that one engagement, and nothing
 * falls back to a global collection. Requirement, control, POC, and team
 * identifiers resolve to names only when they genuinely join; an unresolved id
 * renders as its raw value, never a fabricated label.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to the
 * Requirements workspace it mirrors (requirements.js — the shipped
 * table + drawer + suggestion-workflow pattern this workspace reuses rather
 * than re-implements). `collectViewModel` is the single place this workspace
 * reads `AuditOS.state`; it returns a declarative model of pure,
 * offline-testable derivations. The renderer configures the Shared Workspace
 * Framework's inherited skeleton (`AuditOS.workspaceFramework.configure`) and
 * fills its slots with compositions from the Enterprise Data Presentation
 * System (`AuditOS.presentation`) — no bespoke primitives, no duplicated
 * components (Component Design Patterns §81.4 — Composition Over Duplication).
 *
 * Presentation-plus-workflow: business values are read through `AuditOS.state`;
 * the only writes are Suggestion-lifecycle transitions performed through the
 * shared `AuditOS.suggestionService`, and the underlying evidence record is
 * written only when a status-change suggestion is Applied. Sections with no
 * data render shared Empty State components; nothing is fabricated.
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
   * Evidence review-status vocabulary → tone (read, never invented). The
   * production dataset's `reviewStatus` mirrors the shared evidenceStatus
   * vocabulary (enums.json); the demo-lifecycle vocabulary (Approved/Pending
   * Review/Rejected) is kept as a fallback for a differently sourced dataset.
   * An unmapped status resolves to a neutral info tone.
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

  /** Resolves a record's name field from an id map, falling back to the raw id. */
  var resolveName = WS.resolveName;

  /**
   * A `controlCode → control id` index scoped by `engagementId::controlCode`
   * (a control's code is only unique within its own engagement), built from
   * the engagement's own controls collection — never a cross-engagement guess.
   * Mirrors the Requirements workspace's `indexControlsByCode`.
   */
  function indexControlsByCode(controls) {
    var index = {};
    asArray(controls).forEach(function (control) {
      if (control && control.engagementId && control.controlCode) {
        index[control.engagementId + '::' + control.controlCode] = control.id;
      }
    });
    return index;
  }

  /**
   * The control mappings of an evidence record, drawn only from real joins:
   * the evidence's linked requirements' `controlLinks` (`{ engagementId,
   * controlCode }` — the dominant demo shape) resolved to a control id within
   * their engagement, plus any direct `linkedControlIds` the record carries.
   * Each mapping records whether it resolves inside the current engagement
   * (Issue #38 Part 15 — same engagement opens directly; a different one is a
   * reused mapping the pill navigates to). Nothing is fabricated: a code that
   * does not resolve keeps its raw code and a null control id.
   */
  function deriveControlMappings(record, context) {
    var ctx = context || {};
    var reqs = ctx.requirementsById || {};
    var codeToId = ctx.controlCodeToId || {};
    var controlsById = ctx.controlsById || {};
    var currentEngagementId = ctx.engagement ? ctx.engagement.id : '';
    var seen = {};
    var mappings = [];

    asArray(record.requirementIds).forEach(function (requirementId) {
      var requirement = reqs[requirementId];
      asArray(requirement && requirement.controlLinks).forEach(function (link) {
        if (!link || !link.controlCode) {
          return;
        }
        var engagementId = link.engagementId || currentEngagementId;
        var key = engagementId + '::' + link.controlCode;
        if (seen[key]) {
          return;
        }
        seen[key] = true;
        mappings.push({
          code: link.controlCode,
          controlId: codeToId[key] || null,
          engagementId: engagementId,
          sameEngagement: engagementId === currentEngagementId
        });
      });
    });

    asArray(record.linkedControlIds).forEach(function (id) {
      var key = 'id::' + id;
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      var control = controlsById[id];
      var engagementId = control ? control.engagementId : currentEngagementId;
      mappings.push({
        code: control ? (control.controlCode || id) : id,
        controlId: id,
        engagementId: engagementId,
        sameEngagement: engagementId === currentEngagementId
      });
    });

    return mappings;
  }

  /** The reuse classification of an evidence row (Issue #38 Part 15). */
  function deriveReuseScope(record) {
    var engagements = asArray(record.engagementIds);
    var reuse = normalizeReuse(record);
    if (reuse && reuse.sourceEngagementId) {
      return { key: 'fully-reused', label: 'Reused', tone: TONES.INFO };
    }
    if (engagements.length > 1) {
      return { key: 'partially-reused', label: 'Multi-engagement', tone: TONES.INFO };
    }
    return { key: 'current', label: 'This engagement', tone: null };
  }

  /**
   * The owning team of an evidence record, resolved through its linked
   * requirement's `teamId` (evidence records carry no team of their own).
   * Falls back to the uploading POC's declared team names when no requirement
   * team joins. Never fabricated.
   */
  function resolveEvidenceTeam(record, context) {
    var ctx = context || {};
    var reqs = ctx.requirementsById || {};
    var teamsById = ctx.teamsById || {};
    var teamId = '';
    asArray(record.requirementIds).some(function (requirementId) {
      var requirement = reqs[requirementId];
      if (requirement && requirement.teamId) {
        teamId = requirement.teamId;
        return true;
      }
      return false;
    });
    if (teamId) {
      return { teamId: teamId, team: resolveName(teamsById, teamId, 'name') };
    }
    var poc = ctx.pocsById ? ctx.pocsById[record.uploadedByPocId] : null;
    return { teamId: '', team: poc ? asArray(poc.teamNames).join(', ') : '' };
  }

  /**
   * One Evidence table row, resolved to display fields. Owner and team resolve
   * to names where the identifiers genuinely join and render the raw identifier
   * otherwise; the control mappings and reuse scope are real joins. The
   * evidence record is carried through for the drawer and the status workflow.
   */
  function deriveEvidenceRow(record, context) {
    var source = record || {};
    var ctx = context || {};
    var team = resolveEvidenceTeam(source, ctx);
    var mappings = deriveControlMappings(source, ctx);
    return {
      id: source.id || '',
      title: source.title || source.fileName || source.id || '',
      owner: resolveName(ctx.pocsById, source.uploadedByPocId, 'name'),
      ownerId: source.uploadedByPocId || '',
      team: team.team,
      teamId: team.teamId,
      evidenceType: source.evidenceType || source.fileType || '',
      status: source.reviewStatus || '',
      statusTone: resolveReviewTone(source.reviewStatus),
      mappings: mappings,
      mappedCount: mappings.length,
      reuse: deriveReuseScope(source),
      reusable: normalizeReuse(source) !== null,
      evidence: source
    };
  }

  /**
   * The Evidence table — every evidence record for the engagement rendered
   * once, ordered by identifier so the surface is stable. Nothing is capped:
   * the table is the full engagement dataset the header band and filters work
   * over.
   */
  function deriveEvidenceRows(records, context) {
    return asArray(records)
      .map(function (record) { return deriveEvidenceRow(record, context); })
      .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
  }

  /** The distinct review statuses the engagement's records actually use — the real vocabulary, never invented. */
  function collectStatusOptions(records) {
    var seen = {};
    var order = [];
    asArray(records).forEach(function (record) {
      var status = record && record.reviewStatus;
      if (status && !seen[status]) {
        seen[status] = true;
        order.push(status);
      }
    });
    return order.sort();
  }

  /** The distinct non-empty values of a row field, in first-seen order — for a filter control. */
  function collectRowValues(rows, field) {
    var seen = {};
    var order = [];
    asArray(rows).forEach(function (row) {
      var value = row[field];
      if (value && !seen[value]) {
        seen[value] = true;
        order.push(value);
      }
    });
    return order.sort();
  }

  /**
   * The KPI strip (Issue #38 Part 8): real counts over the currently filtered
   * rows. Each KPI carries a `filter` descriptor so a click toggles that facet
   * on the table, and the "Evidence" total clears every facet. Never a
   * fabricated figure.
   */
  function deriveKpis(rows) {
    var list = asArray(rows);
    var mapped = 0;
    var reusable = 0;
    var multiEngagement = 0;
    list.forEach(function (row) {
      if (row.mappedCount > 0) { mapped += 1; }
      if (row.reusable) { reusable += 1; }
      if (row.reuse.key !== 'current') { multiEngagement += 1; }
    });
    return [
      { key: 'total', label: 'Evidence', value: String(list.length), tone: null, filter: null },
      { key: 'mapped', label: 'Mapped to controls', value: String(mapped), tone: mapped > 0 ? TONES.INFO : null, filter: { field: 'mapped', value: true } },
      { key: 'reusable', label: 'Reusable', value: String(reusable), tone: reusable > 0 ? TONES.INFO : null, filter: { field: 'reusable', value: true } },
      { key: 'multi-engagement', label: 'Cross-engagement', value: String(multiEngagement), tone: multiEngagement > 0 ? TONES.INFO : null, filter: { field: 'multiEngagement', value: true } }
    ];
  }

  /**
   * One operational chart: the distribution of the filtered rows across the
   * distinct values of a field, ordered by count descending. Each segment
   * carries a `filter` descriptor so a click toggles that facet (Issue #38
   * Parts 8 / 10). `toneFor` resolves a segment's tone from its value.
   */
  function deriveDistribution(rows, field, toneFor) {
    var list = asArray(rows);
    var counts = {};
    var order = [];
    list.forEach(function (row) {
      var value = row[field] || 'Unspecified';
      if (!Object.prototype.hasOwnProperty.call(counts, value)) {
        counts[value] = 0;
        order.push(value);
      }
      counts[value] += 1;
    });
    order.sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
    return order.map(function (value) {
      return {
        label: value,
        value: counts[value],
        total: list.length,
        tone: toneFor ? toneFor(value) : null,
        filter: { field: field, value: value }
      };
    });
  }

  /** The review-status distribution chart. */
  function deriveStatusChart(rows) {
    return deriveDistribution(rows, 'status', resolveReviewTone);
  }

  /** The evidence-type distribution chart. */
  function deriveTypeChart(rows) {
    return deriveDistribution(rows, 'evidenceType', null);
  }

  /**
   * Related audit objects for the supporting panel: the domains the evidence
   * connects to, each with its real count, only when data exists. Requirement
   * is the evidence's most direct relation; controls, testing, findings, and
   * report follow.
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
      { id: ids.REQUIREMENTS, title: 'Requirements', meta: String(requirements.requirements || 0), present: (requirements.requirements || 0) > 0 },
      { id: ids.CONTROLS, title: 'Controls', meta: String(controls.controls || 0), present: (controls.controls || 0) > 0 },
      { id: ids.TESTING, title: 'Testing', meta: String(testing.tests || 0), present: (testing.tests || 0) > 0 },
      { id: ids.FINDINGS, title: 'Findings', meta: String(findings.findings || 0), present: (findings.findings || 0) > 0 },
      { id: ids.REPORTING, title: 'Report', meta: report ? String(report.status) : '—', present: Boolean(report) }
    ];
    return WS.resolveRelationships(workspaceRegistry, related);
  }

  /**
   * Recent evidence activity, newest first: remarks recorded in the immutable
   * activity log, falling back to evidence receipts / request submissions when
   * a dataset carries those dated fields instead. Every event derives from a
   * real dated record; undated records never appear.
   */
  function deriveActivity(evidenceRecords, requestRecords, activityEvents, actorNames) {
    var events = RE.deriveRemarkActivity(activityEvents, actorNames, formatDate);
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
    return RE.deriveCollectionMetadata(evidenceMetadata, engagement, company, evidenceRecords, formatDate);
  }

  /**
   * The evidence collection status for the header badge: awaiting when nothing
   * is collected, complete once every record is received/approved, collecting
   * otherwise. Never a fabricated count.
   */
  function deriveCollectionStatus(evidenceRecords) {
    var records = asArray(evidenceRecords);
    if (records.length === 0) {
      return { label: 'Awaiting', tone: null };
    }
    var settled = records.filter(function (record) {
      var status = record.reviewStatus;
      return status === REVIEW_STATUS.APPROVED || status === 'All Evidence Received';
    }).length;
    if (settled === records.length) {
      return { label: 'Complete', tone: TONES.SUCCESS };
    }
    return { label: 'Collecting', tone: TONES.INFO };
  }

  /** One text-valued Inspector section rendered as a single placeholder-capable list row. */
  var textSection = WS.textSection;

  /** One list-valued Inspector section; an empty list renders one placeholder row. */
  var listSection = WS.listSection;

  /** Normalizes a linked-id reference, resolving its name where it joins. */
  var toRefItem = WS.resolveRefItem;

  /**
   * The Evidence Inspector configuration for one evidence record (Issue #38
   * Part 13 — the shared enterprise drawer's body). Renders high-density
   * metadata, owner, team, evidence type, folders and links, control mappings,
   * related requirements, reuse metadata, comments, approval status, and
   * activity history — a placeholder row wherever the JSON lacks data, and
   * never a fabricated relationship. Pure: returns plain Inspector Panel
   * configuration, no DOM. Host-agnostic.
   */
  function buildEvidenceInspector(evidence, context) {
    var item = evidence || {};
    var ctx = context || {};
    var ids = ctx.workspaceRegistry ? ctx.workspaceRegistry.IDS : {};
    var reuse = normalizeReuse(item);
    var status = item.reviewStatus || '';
    var owner = resolveName(ctx.pocsById, item.uploadedByPocId, 'name');
    var team = resolveEvidenceTeam(item, ctx);
    var mappings = deriveControlMappings(item, ctx);
    var reuseScope = deriveReuseScope(item);

    var approvalHistory = status
      ? [{ title: status, description: item.uploadedOn ? 'As of ' + formatDate(item.uploadedOn) : '', tone: resolveReviewTone(status) }]
      : [];

    var activityHistory = item.uploadedOn
      ? [{ title: 'Uploaded' + (owner ? ' by ' + owner : ''), description: formatDate(item.uploadedOn), tone: TONES.INFO }]
      : [];

    // Folders and links: rendered only from fields the record carries
    // (SharePoint / master / audit folder urls, or a storage path). Nothing is
    // fabricated for a dataset that records no location.
    var folderItems = [];
    [
      { field: 'masterFolderUrl', label: 'Master folder' },
      { field: 'sharePointUrl', label: 'SharePoint folder' },
      { field: 'auditFolderUrl', label: 'Audit folder' },
      { field: 'storagePath', label: 'Storage path' }
    ].forEach(function (entry) {
      if (item[entry.field]) {
        folderItems.push({ title: entry.label, description: item[entry.field], tone: TONES.INFO });
      }
    });
    asArray(item.folders).forEach(function (folder) {
      if (!folder) { return; }
      folderItems.push({ title: folder.label || folder.name || 'Folder', description: folder.url || folder.path || '', tone: TONES.INFO });
    });

    var mappingItems = mappings.map(function (mapping) {
      return {
        title: mapping.code,
        description: mapping.sameEngagement ? 'This engagement' : ('Engagement ' + mapping.engagementId),
        tone: mapping.sameEngagement ? TONES.INFO : null
      };
    });

    var commentItems = asArray(item.comments).map(function (comment) {
      return {
        title: comment.text || comment.note || String(comment),
        description: [comment.author, comment.on ? formatDate(comment.on) : ''].filter(Boolean).join(' · '),
        tone: TONES.INFO
      };
    });

    return {
      eyebrow: item.evidenceType || item.fileType || 'Evidence',
      title: item.title || item.fileName || item.id || '',
      subtitle: [item.id, status].filter(Boolean).join(' · '),
      badges: [
        status ? { label: status, tone: resolveReviewTone(status) } : null,
        reuseScope.key !== 'current' ? { label: reuseScope.label, tone: reuseScope.tone } : null
      ].filter(Boolean),
      sections: [
        {
          title: 'Properties', kind: 'properties',
          rows: [
            { label: 'Evidence id', value: item.id || '' },
            { label: 'Evidence type', value: item.evidenceType || item.fileType || '' },
            { label: 'Status', value: status },
            { label: 'Owner', value: owner },
            { label: 'Owning team', value: team.team },
            { label: 'File name', value: item.fileName || '' },
            { label: 'Version', value: item.version || '' },
            { label: 'Audit period', value: ctx.auditPeriodLabel || '' },
            { label: 'Source', value: deriveEvidenceSource(item) },
            { label: 'Reuse scope', value: reuseScope.label },
            { label: 'Engagements', value: asArray(item.engagementIds).length ? String(asArray(item.engagementIds).length) : '' },
            { label: 'Uploaded', value: formatDate(item.uploadedOn) }
          ].filter(function (row) { return row.value; })
        },
        textSection('Description',
          item.description || (item.fileName ? item.fileName + (item.fileType ? ' · ' + item.fileType : '') : ''),
          'No description recorded for this evidence.'),
        listSection('Control mappings', mappingItems,
          'No linked controls recorded — this evidence satisfies no control yet.'),
        listSection('Related requirements',
          asArray(item.requirementIds).map(function (id) { return toRefItem(id, ctx.requirementsById, 'title', ctx.workspaceRegistry, ids.REQUIREMENTS); }),
          'No linked requirements recorded.'),
        listSection('Folders & links', folderItems,
          'No storage locations recorded for this evidence yet. Release 2 connects evidence folders to SharePoint.'),
        reuse
          ? listSection('Reuse', [{ title: reuse.decision || 'Reusable', description: reuse.sourceEngagementId ? 'Source: ' + reuse.sourceEngagementId : '', tone: TONES.INFO }], '')
          : { title: 'Reuse', kind: 'placeholder', empty: { icon: '◇', title: 'No reuse recorded', description: 'Reuse opportunities appear here when the evidence declares them. Release 2 connects reuse to SharePoint and overlapping audit periods.' } },
        listSection('Comments', commentItems, 'No comments recorded on this evidence.'),
        listSection('Approval status', approvalHistory, 'No approval decision recorded yet.'),
        listSection('Activity history', activityHistory, 'No activity recorded for this evidence.')
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
   * State, scoped strictly to the engagement in the active route context
   * (Issue #38 Part 2). Returns null while the state is not ready, and a
   * degraded model when no engagement exists (§15.12).
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
    var pocs = state.listRecords('pocs');
    var users = state.listRecords('users');
    var pocsById = indexById(pocs);
    var teamsById = indexById(state.listRecords('teams'));
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
    var suggestionsDocument = readEngagementDocument(state, 'suggestions', engagement.id) || {};

    var evidenceRecords = asArray(evidenceDocument.evidence);
    var requestRecords = asArray(requestsDocument.requests);
    var requirementsById = indexById(requirementsDocument.requirements);
    var controlsById = indexById(controlsDocument.controls);
    var controlCodeToId = indexControlsByCode(controlsDocument.controls);
    var suggestions = asArray(suggestionsDocument.suggestions);

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
      controlCodeToId: controlCodeToId,
      pocsById: pocsById,
      teamsById: teamsById,
      suggestions: suggestions,
      workspaceRegistry: workspaceRegistry,
      repository: AuditOS.repository || null,
      auditPeriodLabel: auditPeriodLabel,
      engagement: engagement,
      company: company,
      statusOptions: collectStatusOptions(evidenceRecords)
    };

    var rows = deriveEvidenceRows(evidenceRecords, context);
    var collectionStatus = deriveCollectionStatus(evidenceRecords);

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
        actions: [{ label: 'Engagement overview', href: engagementOverviewHref(context), variant: 'subtle' }]
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

      rows: rows,
      statusOptions: context.statusOptions,
      typeOptions: collectRowValues(rows, 'evidenceType'),
      teamOptions: collectRowValues(rows, 'team'),
      relationships: deriveRelationships(workspaceRegistry, operational),
      activity: deriveActivity(evidenceRecords, requestRecords, asArray(activityDocument.events), actorNames),
      metadata: deriveMetadata(evidenceDocument.metadata, engagement, company, evidenceRecords),

      footer: [
        { label: 'Environment', value: 'Static prototype' },
        { label: 'Demo status', value: status.demoDataLoaded ? 'Demo data loaded' : 'Demo data degraded' }
      ]
    };
  }

  // ------------------------------------------------------------------
  // Navigation helpers — every in-engagement link preserves the client /
  // engagement hierarchy (Issue #38 Part 4), degrading to the flat route only
  // where the Repository is not loaded (offline unit sandboxes).
  // ------------------------------------------------------------------

  /** The hierarchical link to the engagement overview. */
  function engagementOverviewHref(context) {
    var href = WS.buildHierarchicalHref(context.repository, context.workspaceRegistry, context.company, context.engagement, null);
    return href || '#/engagements';
  }

  /**
   * The link to a mapped control (Issue #38 Part 15). Same engagement: the
   * control's own hierarchical record route, opened directly. A different
   * engagement: the mapped control within that engagement (resolved through
   * the Repository), so the pill navigates to that engagement. Falls back to
   * the flat record route where the hierarchy cannot be built.
   */
  function controlHref(mapping, context) {
    var registry = context.workspaceRegistry;
    if (!registry) {
      return null;
    }
    var controlsId = registry.IDS.CONTROLS;
    var repository = context.repository;

    if (mapping.sameEngagement) {
      var base = WS.buildHierarchicalHref(repository, registry, context.company, context.engagement, controlsId);
      if (base && mapping.controlId) {
        return base + '/' + encodeURIComponent(mapping.controlId);
      }
      return WS.buildRecordHref(registry, controlsId, mapping.controlId) || base;
    }

    // A different engagement's control — resolve that engagement and its
    // company so the pill navigates into that engagement's Controls workspace.
    if (repository && mapping.engagementId) {
      var targetEngagement = findById(repository.engagements.list(), mapping.engagementId);
      var targetCompany = targetEngagement ? findById(repository.clients.list(), targetEngagement.companyId) : null;
      var crossBase = WS.buildHierarchicalHref(repository, registry, targetCompany, targetEngagement, controlsId);
      if (crossBase && mapping.controlId) {
        return crossBase + '/' + encodeURIComponent(mapping.controlId);
      }
      if (crossBase) {
        return crossBase;
      }
    }
    return WS.buildRecordHref(registry, controlsId, mapping.controlId);
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
   * Memory-only presentation state: the composed table filters (search, the
   * status/type/team facets, and the KPI facets), plus the evidence the shared
   * drawer currently shows, so a Repository write re-render refreshes the same
   * drawer instead of closing it (mirrors requirements.js `tableState`).
   */
  var tableState = {
    search: '', status: '', evidenceType: '', team: '',
    mapped: false, reusable: false, multiEngagement: false,
    drawerEvidenceId: '', lastTargetId: ''
  };

  /** Whether any facet or search filter is active. */
  function hasActiveFilters() {
    return Boolean(tableState.search || tableState.status || tableState.evidenceType ||
      tableState.team || tableState.mapped || tableState.reusable || tableState.multiEngagement);
  }

  /** Clears every composed filter. */
  function resetFilters() {
    tableState.search = '';
    tableState.status = '';
    tableState.evidenceType = '';
    tableState.team = '';
    tableState.mapped = false;
    tableState.reusable = false;
    tableState.multiEngagement = false;
  }

  /**
   * Applies every composed filter to the rows (Issue #38 Part 10 — search,
   * column filters, KPI filters, and chart filters all compose). Presentation
   * only: the underlying dataset never changes.
   */
  function applyFilters(rows) {
    var term = tableState.search.trim().toLowerCase();
    return asArray(rows).filter(function (row) {
      if (tableState.status && row.status !== tableState.status) { return false; }
      if (tableState.evidenceType && row.evidenceType !== tableState.evidenceType) { return false; }
      if (tableState.team && row.team !== tableState.team) { return false; }
      if (tableState.mapped && row.mappedCount === 0) { return false; }
      if (tableState.reusable && !row.reusable) { return false; }
      if (tableState.multiEngagement && row.reuse.key === 'current') { return false; }
      if (term) {
        var haystack = [row.id, row.title, row.owner, row.team, row.evidenceType, row.status]
          .join(' ').toLowerCase();
        if (haystack.indexOf(term) === -1) { return false; }
      }
      return true;
    });
  }

  /** Whether a KPI/chart facet descriptor is the one currently active. */
  function isFacetActive(filter) {
    if (!filter) {
      return !hasActiveFilters();
    }
    if (filter.field === 'status') { return tableState.status === filter.value; }
    if (filter.field === 'evidenceType') { return tableState.evidenceType === filter.value; }
    if (filter.field === 'team') { return tableState.team === filter.value; }
    return Boolean(tableState[filter.field]);
  }

  /** Toggles a KPI/chart facet on the shared filter state; a null filter clears everything. */
  function toggleFacet(filter) {
    if (!filter) {
      resetFilters();
      return;
    }
    if (filter.field === 'status') {
      tableState.status = tableState.status === filter.value ? '' : filter.value;
    } else if (filter.field === 'evidenceType') {
      tableState.evidenceType = tableState.evidenceType === filter.value ? '' : filter.value;
    } else if (filter.field === 'team') {
      tableState.team = tableState.team === filter.value ? '' : filter.value;
    } else {
      tableState[filter.field] = !tableState[filter.field];
    }
  }

  /**
   * Builds the KPI strip: one stat tile per KPI. Each tile is a real button
   * that toggles its facet (Issue #38 Part 8) and reads active when its facet
   * is on; the value always reads as text, tone only reinforces.
   */
  function buildKpiStrip(kpis, onFilter) {
    var strip = el('div', 'aos-evidence__kpis');
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', 'Evidence key figures — select to filter');
    asArray(kpis).forEach(function (kpi) {
      var active = isFacetActive(kpi.filter);
      var tile = el('button', 'aos-evidence__kpi' +
        (kpi.tone ? ' aos-evidence__kpi--' + kpi.tone : '') +
        (active ? ' aos-evidence__kpi--active' : ''));
      tile.type = 'button';
      tile.setAttribute('aria-pressed', active ? 'true' : 'false');
      tile.appendChild(el('span', 'aos-evidence__kpi-value aos-numeric', kpi.value));
      tile.appendChild(el('span', 'aos-evidence__kpi-label', kpi.label));
      tile.addEventListener('click', function () { onFilter(kpi.filter); });
      strip.appendChild(tile);
    });
    return strip;
  }

  /**
   * Builds one operational chart: a segmented proportion bar plus a legend of
   * toggle buttons (Issue #38 Part 8 — every chart updates with the filters and
   * becomes a filter when clicked). Each legend row and bar segment toggles its
   * facet.
   */
  function buildChart(title, segments, onFilter) {
    var wrap = el('div', 'aos-evidence__chart');
    wrap.appendChild(el('h4', 'aos-evidence__chart-title', title));

    var total = asArray(segments).reduce(function (sum, segment) { return sum + segment.value; }, 0);
    var bar = el('div', 'aos-evidence__chart-bar');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', title + ' distribution');
    asArray(segments).forEach(function (segment) {
      var percent = total > 0 ? Math.round((segment.value / total) * 100) : 0;
      var fill = el('button', 'aos-evidence__chart-segment' +
        (segment.tone ? ' aos-evidence__chart-segment--' + segment.tone : '') +
        (isFacetActive(segment.filter) ? ' aos-evidence__chart-segment--active' : ''));
      fill.type = 'button';
      fill.style.width = percent + '%';
      fill.setAttribute('aria-label', segment.label + ': ' + segment.value + ' (' + percent + '%)');
      fill.addEventListener('click', function () { onFilter(segment.filter); });
      bar.appendChild(fill);
    });
    wrap.appendChild(bar);

    var legend = el('ul', 'aos-evidence__chart-legend');
    asArray(segments).forEach(function (segment) {
      var percent = total > 0 ? Math.round((segment.value / total) * 100) : 0;
      var entry = el('li', 'aos-evidence__chart-legend-item');
      var button = el('button', 'aos-evidence__chart-legend-button' +
        (isFacetActive(segment.filter) ? ' aos-evidence__chart-legend-button--active' : ''));
      button.type = 'button';
      button.setAttribute('aria-pressed', isFacetActive(segment.filter) ? 'true' : 'false');
      var dot = el('span', 'aos-evidence__chart-dot' + (segment.tone ? ' aos-evidence__chart-dot--' + segment.tone : ''));
      dot.setAttribute('aria-hidden', 'true');
      button.appendChild(dot);
      button.appendChild(el('span', 'aos-evidence__chart-legend-label', segment.label));
      button.appendChild(el('span', 'aos-evidence__chart-legend-value aos-numeric', segment.value + ' · ' + percent + '%'));
      button.addEventListener('click', function () { onFilter(segment.filter); });
      entry.appendChild(button);
      legend.appendChild(entry);
    });
    wrap.appendChild(legend);
    return wrap;
  }

  /** Whether an evidence row has an unapplied status-change suggestion in flight. */
  function pendingStatusSuggestion(row, context) {
    return asArray(context.suggestions).filter(function (suggestion) {
      return suggestion.category === 'evidence-status' &&
        asArray(suggestion.auditReferences).indexOf(row.id) !== -1 &&
        suggestion.status !== 'Applied' && suggestion.status !== 'Rejected';
    })[0] || null;
  }

  /**
   * Builds the inline Status cell (Issue #38 Part 11): a dropdown of the real
   * status vocabulary. Selecting a new status never edits the record directly —
   * it proposes a Suggestion that walks Suggested → Reviewed → Approved →
   * Applied through the existing Suggestion Lifecycle Service; the Repository
   * write happens only on Apply. A pending proposal shows a clock affordance
   * that opens the drawer's status workflow.
   */
  function buildStatusCell(row, context) {
    var P = presentation();
    var repository = AuditOS.repository;
    var suggestionService = AuditOS.suggestionService;
    var engagementId = context.engagement ? context.engagement.id : '';
    var statusOptions = context.statusOptions || [];
    var pending = pendingStatusSuggestion(row, context);

    var cell = el('div', 'aos-evidence__status-cell');

    if (suggestionService && repository && statusOptions.length > 0) {
      var select = el('select', 'aos-select__control aos-evidence__status-select' +
        (row.statusTone ? ' aos-evidence__status-select--' + row.statusTone : ''));
      select.setAttribute('aria-label', 'Status for ' + (row.title || row.id) + ' — select to propose a change');
      statusOptions.forEach(function (status) {
        var option = el('option', null, status);
        option.value = status;
        select.appendChild(option);
      });
      if (statusOptions.indexOf(row.status) === -1 && row.status) {
        var current = el('option', null, row.status);
        current.value = row.status;
        select.appendChild(current);
      }
      select.value = row.status;
      select.addEventListener('change', function () {
        var proposed = select.value;
        // The change lands only on Apply — revert the control to the current
        // status and record the proposal through the Suggestion Lifecycle.
        select.value = row.status;
        if (!proposed || proposed === row.status) {
          return;
        }
        suggestionService.propose(repository, engagementId, {
          title: 'Change evidence status: ' + (row.title || row.id),
          description: (row.status || 'Unset') + ' → ' + proposed,
          category: 'evidence-status',
          affectedRequirements: asArray(row.evidence.requirementIds),
          auditReferences: [row.id],
          workspaceId: 'evidence',
          applyTarget: { entity: 'evidence', recordId: row.id, changes: { reviewStatus: proposed } }
        });
      });
      cell.appendChild(select);
    } else {
      cell.appendChild(P.statusBadge({ label: row.status || '—', tone: row.statusTone }));
    }

    if (pending) {
      var clock = el('button', 'aos-evidence__status-pending');
      clock.type = 'button';
      clock.setAttribute('aria-label', 'Pending status change (' + pending.status + ') — open status workflow');
      clock.title = 'Pending: ' + pending.title + ' · ' + pending.status;
      clock.appendChild(el('i', 'bi bi-clock-history'));
      clock.addEventListener('click', function () { openEvidenceDrawer(row, context); });
      cell.appendChild(clock);
    }
    return cell;
  }

  /**
   * Builds the Control Mapping cell (Issue #38 Part 15): one pill per mapped
   * control. Clicking a pill navigates directly to the mapped control — within
   * the current engagement, or into the engagement that owns it. Same-engagement
   * pills read as the current engagement; cross-engagement (reused) pills are
   * visually distinguished.
   */
  function buildControlPills(row, context) {
    var wrap = el('div', 'aos-evidence__pills');
    if (row.mappings.length === 0) {
      wrap.appendChild(el('span', 'aos-evidence__pills-empty', '—'));
      return wrap;
    }
    row.mappings.forEach(function (mapping) {
      var href = controlHref(mapping, context);
      var pill = el(href ? 'a' : 'span', 'aos-evidence__pill' +
        (mapping.sameEngagement ? '' : ' aos-evidence__pill--reused'), mapping.code);
      if (href) {
        pill.setAttribute('href', href);
      }
      pill.setAttribute('title', mapping.sameEngagement
        ? 'Control ' + mapping.code + ' — open in this engagement'
        : 'Control ' + mapping.code + ' — reused from engagement ' + mapping.engagementId);
      wrap.appendChild(pill);
    });
    return wrap;
  }

  /**
   * Builds the row Actions cell (Issue #38 Part 12): an Eye that opens the
   * Evidence drawer and a History icon that opens the Status History — minimal,
   * professional iconography (bootstrap-icons, already vendored locally).
   */
  function buildActionCell(row, context) {
    var wrap = el('div', 'aos-evidence__actions');

    var view = el('button', 'aos-evidence__icon-button');
    view.type = 'button';
    view.setAttribute('aria-label', 'Open evidence detail for ' + (row.title || row.id));
    view.title = 'View evidence';
    view.appendChild(el('i', 'bi bi-eye'));
    view.addEventListener('click', function () { openEvidenceDrawer(row, context); });
    wrap.appendChild(view);

    var history = el('button', 'aos-evidence__icon-button');
    history.type = 'button';
    history.setAttribute('aria-label', 'Open status history for ' + (row.title || row.id));
    history.title = 'Status history';
    history.appendChild(el('i', 'bi bi-clock-history'));
    history.addEventListener('click', function () { openStatusHistory(row, context); });
    wrap.appendChild(history);

    return wrap;
  }

  /** Builds one dense-table row descriptor: the title cell opens the evidence drawer. */
  function buildTableRow(row, context) {
    var open = el('button', 'aos-evidence__table-title');
    open.type = 'button';
    open.textContent = row.title || row.id;
    open.addEventListener('click', function () { openEvidenceDrawer(row, context); });
    return {
      status: { tone: row.statusTone, label: row.status },
      cells: {
        id: row.id,
        title: open,
        owner: row.owner || '—',
        team: row.team || '—',
        type: row.evidenceType || '—',
        status: buildStatusCell(row, context),
        controls: buildControlPills(row, context),
        actions: buildActionCell(row, context)
      }
    };
  }

  /**
   * Builds the engagement Evidence board (Issue #38 Parts 7–10): the KPI strip
   * and the operational charts on top, a composing filter toolbar, then the one
   * dense enterprise table that owns the scrolling. A single `render()` closure
   * recomputes the filtered rows and rebuilds the KPIs, charts, and grid so the
   * header figures update with the filters and every KPI / chart segment acts
   * as a filter when clicked.
   */
  function buildBoard(viewModel) {
    var P = presentation();
    var context = viewModel.context;
    var board = el('div', 'aos-evidence__board');

    var headerBand = el('div', 'aos-evidence__header-band');
    var kpiMount = el('div', 'aos-evidence__kpi-mount');
    var chartMount = el('div', 'aos-evidence__charts');
    headerBand.appendChild(kpiMount);
    headerBand.appendChild(chartMount);
    board.appendChild(headerBand);

    var toolbar = el('div', 'aos-evidence__toolbar');
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Evidence filters');
    var gridMount = el('div', 'aos-evidence__grid-mount');

    function render() {
      var filtered = applyFilters(viewModel.rows);

      kpiMount.replaceChildren(buildKpiStrip(deriveKpis(filtered), function (filter) {
        toggleFacet(filter);
        render();
      }));

      chartMount.replaceChildren(
        buildChart('Review status', deriveStatusChart(filtered), function (filter) { toggleFacet(filter); render(); }),
        buildChart('Evidence type', deriveTypeChart(filtered), function (filter) { toggleFacet(filter); render(); })
      );

      gridMount.replaceChildren(P.dataGrid({
        density: 'compact',
        selectable: true,
        caption: 'Engagement evidence — owner, team, type, status, and control mapping',
        columns: [
          { key: 'id', label: 'Evidence ID', width: '9rem' },
          { key: 'title', label: 'Evidence' },
          { key: 'owner', label: 'Owner' },
          { key: 'team', label: 'Team' },
          { key: 'type', label: 'Evidence Type' },
          { key: 'status', label: 'Status' },
          { key: 'controls', label: 'Control Mapping' },
          { key: 'actions', label: 'Actions', align: 'actions' }
        ],
        rows: filtered.map(function (row) { return buildTableRow(row, context); }),
        emptyState: {
          icon: '◇', title: 'No evidence matches the filters',
          description: 'Adjust the search or clear a filter to see more of the engagement evidence.'
        }
      }));

      // The filter toolbar is rebuilt with the current option sets so a facet
      // chosen from a KPI or chart reflects in the dropdowns too.
      toolbar.replaceChildren.apply(toolbar, buildToolbarControls(viewModel, render));
    }

    board.appendChild(toolbar);
    board.appendChild(gridMount);
    render();
    return board;
  }

  /** Builds the composing filter toolbar controls: search, status / type / team dropdowns, and a reset. */
  function buildToolbarControls(viewModel, render) {
    var controls = [];

    var searchLabel = el('label', 'aos-evidence__search');
    searchLabel.appendChild(el('span', 'aos-evidence__filter-label', 'Search'));
    var searchInput = el('input', 'aos-evidence__search-input');
    searchInput.type = 'search';
    searchInput.value = tableState.search;
    searchInput.setAttribute('placeholder', 'Search evidence, owner, or team');
    searchInput.setAttribute('aria-label', 'Search evidence');
    searchInput.addEventListener('input', function () {
      tableState.search = searchInput.value;
      render();
    });
    searchLabel.appendChild(searchInput);
    controls.push(searchLabel);

    controls.push(buildFilterDropdown('Status', 'All statuses', viewModel.statusOptions, tableState.status, function (value) {
      tableState.status = value; render();
    }));
    controls.push(buildFilterDropdown('Evidence type', 'All types', viewModel.typeOptions, tableState.evidenceType, function (value) {
      tableState.evidenceType = value; render();
    }));
    controls.push(buildFilterDropdown('Team', 'All teams', viewModel.teamOptions, tableState.team, function (value) {
      tableState.team = value; render();
    }));

    if (hasActiveFilters()) {
      var reset = presentation().button({ label: 'Reset filters', variant: 'subtle', size: 'small' });
      reset.addEventListener('click', function () { resetFilters(); render(); });
      controls.push(reset);
    }
    return controls;
  }

  /** Builds one labeled filter dropdown over a set of option values. */
  function buildFilterDropdown(labelText, allLabel, options, current, onChange) {
    var label = el('label', 'aos-evidence__filter');
    label.appendChild(el('span', 'aos-evidence__filter-label', labelText));
    var control = el('select', 'aos-select__control');
    var all = el('option', null, allLabel);
    all.value = '';
    control.appendChild(all);
    asArray(options).forEach(function (option) {
      var node = el('option', null, option);
      node.value = option;
      control.appendChild(node);
    });
    control.value = current || '';
    control.addEventListener('change', function () { onChange(control.value); });
    label.appendChild(control);
    return label;
  }

  // ------------------------------------------------------------------
  // Evidence Status Workflow (Issue #38 Part 11) — a status change never edits
  // production state directly: it creates a Suggestion that walks Suggested →
  // Reviewed → Approved → Applied through the existing Suggestion Lifecycle
  // Service; the Repository write happens only on Apply, and every transition
  // records an audit entry. Mirrors requirements.js so no lifecycle logic is
  // duplicated.
  // ------------------------------------------------------------------

  /** Builds one pending status-change suggestion card with its lifecycle actions. */
  function buildWorkflowSuggestionCard(suggestion, engagementId) {
    var P = presentation();
    var repository = AuditOS.repository;
    var suggestionService = AuditOS.suggestionService;
    var permissions = AuditOS.permissions;
    var denial = (permissions && suggestionService) ? permissions.explainDenial(suggestionService.DECIDE_CAPABILITY) : null;

    var card = el('div', 'aos-surface aos-surface--padded aos-evidence__workflow-card');
    var head = el('div', 'aos-evidence__workflow-card-head');
    head.appendChild(el('span', 'aos-evidence__workflow-card-title', suggestion.title));
    head.appendChild(P.statusBadge({ label: suggestion.status, tone: resolveReviewTone(suggestion.status) }));
    card.appendChild(head);
    if (suggestion.description) {
      card.appendChild(el('p', 'aos-evidence__workflow-card-meta', suggestion.description));
    }

    if (!suggestionService || !repository) {
      return card;
    }
    var actions = el('div', 'aos-action-group');
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', 'Suggestion actions');
    if (suggestion.status === suggestionService.STATUS.SUGGESTED) {
      var reviewButton = P.button({ label: 'Mark reviewed', variant: 'subtle' });
      reviewButton.addEventListener('click', function () {
        suggestionService.review(repository, engagementId, suggestion, '');
      });
      actions.appendChild(reviewButton);
    }
    if (!denial) {
      if (suggestion.status === suggestionService.STATUS.REVIEWED) {
        ['approve', 'reject'].forEach(function (decisionId) {
          var button = P.button({
            label: decisionId === 'approve' ? 'Approve' : 'Reject',
            variant: decisionId === 'approve' ? 'primary' : 'subtle'
          });
          button.addEventListener('click', function () {
            suggestionService.decide(repository, engagementId, suggestion, decisionId, '');
          });
          actions.appendChild(button);
        });
      }
      if (suggestion.status === suggestionService.STATUS.APPROVED) {
        var applyButton = P.button({ label: 'Apply', variant: 'primary' });
        applyButton.addEventListener('click', function () {
          suggestionService.decide(repository, engagementId, suggestion, 'apply', '');
        });
        actions.appendChild(applyButton);
      }
    }
    if (actions.firstChild) {
      card.appendChild(actions);
    }
    if (denial && WS.buildPermissionNotice) {
      card.appendChild(WS.buildPermissionNotice(denial, ''));
    }
    return card;
  }

  /**
   * Builds the drawer's Evidence Status Workflow section: an inline propose
   * control for the current status, the pending status-change suggestions with
   * their lifecycle actions, and the recent audit history. The Repository is
   * written only when a suggestion is Applied.
   */
  function buildWorkflowBody(row, context) {
    var P = presentation();
    var repository = AuditOS.repository;
    var suggestionService = AuditOS.suggestionService;
    var engagementId = context.engagement ? context.engagement.id : '';
    var wrap = el('div', 'aos-evidence__workflow');

    var statusOptions = context.statusOptions || [];
    if (suggestionService && repository && statusOptions.length > 0) {
      var controls = el('div', 'aos-evidence__workflow-controls');
      var select = el('select', 'aos-select__control');
      select.setAttribute('aria-label', 'Proposed evidence status for ' + (row.title || row.id));
      statusOptions.forEach(function (status) {
        var option = el('option', null, status);
        option.value = status;
        select.appendChild(option);
      });
      select.value = row.status || statusOptions[0];
      controls.appendChild(select);
      var proposeButton = P.button({ label: 'Propose status change', variant: 'subtle' });
      proposeButton.addEventListener('click', function () {
        if (!select.value || select.value === row.status) {
          return;
        }
        suggestionService.propose(repository, engagementId, {
          title: 'Change evidence status: ' + (row.title || row.id),
          description: (row.status || 'Unset') + ' → ' + select.value,
          category: 'evidence-status',
          affectedRequirements: asArray(row.evidence.requirementIds),
          auditReferences: [row.id],
          workspaceId: 'evidence',
          applyTarget: { entity: 'evidence', recordId: row.id, changes: { reviewStatus: select.value } }
        });
      });
      controls.appendChild(proposeButton);
      wrap.appendChild(controls);
    }

    var proposals = asArray(context.suggestions).filter(function (suggestion) {
      return suggestion.category === 'evidence-status' &&
        asArray(suggestion.auditReferences).indexOf(row.id) !== -1 &&
        suggestion.status !== 'Applied' && suggestion.status !== 'Rejected';
    });
    if (proposals.length === 0) {
      wrap.appendChild(el('p', 'aos-evidence__workflow-card-meta',
        'No status change in flight. A proposed change enters the Suggested → Reviewed → Approved → Applied workflow; the record is written only on Apply.'));
    }
    proposals.forEach(function (suggestion) {
      wrap.appendChild(buildWorkflowSuggestionCard(suggestion, engagementId));
    });

    var auditService = AuditOS.auditService;
    if (auditService) {
      var events = auditService.listForEntity(row.id, 'evidence').slice(0, 5);
      if (events.length > 0) {
        wrap.appendChild(el('h4', 'aos-evidence__workflow-subtitle', 'Recent history'));
        wrap.appendChild(P.itemList(events.map(function (event) {
          return {
            title: event.action + (event.reason ? ' — ' + event.reason : ''),
            meta: [event.user, String(event.timestamp).slice(0, 10)].filter(Boolean).join(' · '),
            tone: TONES.INFO
          };
        }), { compact: true }));
      }
    }
    return wrap;
  }

  /**
   * Opens the shared enterprise drawer (Issue #37 Part 9 / Issue #38 Part 13)
   * for one evidence record: the same inspector configuration, hosted in the
   * one application-wide slide-over — never a modal dialog. The Evidence Status
   * Workflow (Part 11) renders beneath the inspector sections.
   */
  function openEvidenceDrawer(row, context) {
    var P = presentation();
    tableState.drawerEvidenceId = row.id;
    var config = buildEvidenceInspector(row.evidence, context);
    var workflow = el('section', 'aos-inspector__section');
    workflow.appendChild(el('h3', 'aos-inspector__section-title', 'Evidence status workflow'));
    workflow.appendChild(buildWorkflowBody(row, context));
    P.openDrawer({
      eyebrow: config.eyebrow,
      title: config.title,
      subtitle: config.subtitle,
      badges: config.badges,
      wide: true,
      content: [P.inspectorSections(config.sections), workflow],
      onClose: function () { tableState.drawerEvidenceId = ''; }
    });
  }

  /**
   * Opens the Status History (Issue #38 Part 14) in the shared drawer: the
   * recorded audit events touching this evidence record, each showing when,
   * the action, the old and new status, the actor, and any comment — reusing
   * the existing audit-history conventions. Both the applied status changes
   * (evidence writes) and the suggestion lifecycle (proposal → decision) are
   * drawn from the audit trail.
   */
  function openStatusHistory(row, context) {
    var P = presentation();
    var auditService = AuditOS.auditService;
    var events = auditService ? auditService.listForEntity(row.id, 'evidence') : [];

    // Suggestion lifecycle events reference this evidence through the
    // suggestions that target it; surface them alongside the record's own
    // writes so the history reads proposal → decision → applied.
    var suggestionIds = asArray(context.suggestions).filter(function (suggestion) {
      return suggestion.category === 'evidence-status' &&
        asArray(suggestion.auditReferences).indexOf(row.id) !== -1;
    }).map(function (suggestion) { return suggestion.id; });
    if (auditService) {
      suggestionIds.forEach(function (id) {
        auditService.listForEntity(id, 'suggestions').forEach(function (event) { events.push(event); });
      });
    }
    events.sort(function (a, b) { return String(b.timestamp).localeCompare(String(a.timestamp)); });

    var content;
    if (events.length === 0) {
      content = P.emptyState({
        icon: '◇', title: 'No status history yet',
        description: 'Status changes are recorded here once a proposal is reviewed, approved, and applied.'
      });
    } else {
      content = P.dataGrid({
        density: 'compact',
        caption: 'Status history for ' + row.id,
        columns: [
          { key: 'when', label: 'When', width: '11rem' },
          { key: 'action', label: 'Action' },
          { key: 'old', label: 'Old' },
          { key: 'new', label: 'New' },
          { key: 'by', label: 'By' },
          { key: 'comment', label: 'Comment' }
        ],
        rows: events.map(function (event) {
          var previous = event.previousValue || {};
          var next = event.newValue || {};
          var oldStatus = previous.reviewStatus || previous.status || '';
          var newStatus = next.reviewStatus || next.status || '';
          return {
            cells: {
              when: String(event.timestamp || '').replace('T', ' ').slice(0, 19),
              action: event.action || '',
              old: oldStatus ? P.statusBadge({ label: oldStatus, tone: resolveReviewTone(oldStatus) }) : '—',
              new: newStatus ? P.statusBadge({ label: newStatus, tone: resolveReviewTone(newStatus) }) : '—',
              by: event.user || '',
              comment: event.reason || ''
            }
          };
        })
      });
    }

    P.openDrawer({
      eyebrow: 'Audit log',
      title: 'Status history · ' + row.id,
      subtitle: row.title || '',
      badges: row.status ? [{ label: row.status, tone: row.statusTone }] : [],
      wide: true,
      content: [content]
    });
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
   * Host-agnostic renderer (§9): given the evidence rows and the resolution
   * context, returns the one self-contained enterprise Evidence board — the KPI
   * band, charts, filters, and dense table — making no assumption about where it
   * is mounted. Exposed on the public API so any host can reuse it.
   */
  function renderInspector(rows, context) {
    return buildBoard({ rows: asArray(rows), context: context, statusOptions: context.statusOptions || [],
      typeOptions: collectRowValues(rows, 'evidenceType'), teamOptions: collectRowValues(rows, 'team') });
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Returns a framework slot inside the active workspace view. */
  var slotElement = WS.slotElement;

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /** Renders the ready evidence experience into the framework slots. */
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

    // One engagement-scoped enterprise table (Issue #38 Part 7): the table owns
    // its own scrolling and the page stays fixed-height.
    var canvas = el('div', 'aos-evidence');
    canvas.setAttribute('data-canvas', 'flush');
    var board = buildBoard(viewModel);
    board.classList.add('aos-rise-in');
    canvas.appendChild(board);
    fillSlot(view, SLOTS.CONTENT, [canvas]);

    // Drawer synchronization (Issue #37 Parts 8/9): a Repository write that
    // re-renders the workspace refreshes the already-open drawer with the same
    // record's fresh data instead of closing it; a route that names a record
    // opens its drawer once per navigation.
    function findRow(id) {
      return viewModel.rows.filter(function (row) { return row.id === id; })[0] || null;
    }
    if (tableState.drawerEvidenceId && P.isDrawerOpen && P.isDrawerOpen()) {
      var openRow = findRow(tableState.drawerEvidenceId);
      if (openRow) {
        openEvidenceDrawer(openRow, viewModel.context);
      }
    } else if (targetId && targetId !== tableState.lastTargetId) {
      var targetRow = findRow(targetId);
      if (targetRow) {
        openEvidenceDrawer(targetRow, viewModel.context);
      }
    }
    tableState.lastTargetId = targetId;

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
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'table', label: 'Loading evidence' })]);
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

  AuditOS.evidenceWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      formatDate: formatDate,
      formatPeriod: formatPeriod,
      normalizeFrameworks: normalizeFrameworks,
      deriveCurrentEngagement: deriveCurrentEngagement,
      resolveReviewTone: resolveReviewTone,
      normalizeReuse: normalizeReuse,
      deriveEvidenceSource: deriveEvidenceSource,
      indexControlsByCode: indexControlsByCode,
      deriveControlMappings: deriveControlMappings,
      deriveReuseScope: deriveReuseScope,
      resolveEvidenceTeam: resolveEvidenceTeam,
      deriveEvidenceRow: deriveEvidenceRow,
      deriveEvidenceRows: deriveEvidenceRows,
      collectStatusOptions: collectStatusOptions,
      collectRowValues: collectRowValues,
      deriveKpis: deriveKpis,
      deriveDistribution: deriveDistribution,
      deriveStatusChart: deriveStatusChart,
      deriveTypeChart: deriveTypeChart,
      deriveRelationships: deriveRelationships,
      deriveActivity: deriveActivity,
      deriveMetadata: deriveMetadata,
      deriveCollectionStatus: deriveCollectionStatus,
      buildEvidenceInspector: buildEvidenceInspector
    },

    collectViewModel: collectViewModel,

    // Host-agnostic renderer (§9): data → one self-contained node, mountable in
    // any host. Release 1 mounts the enterprise Evidence board in the content slot.
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

      // Navigating away closes the evidence drawer (Issue #37 Part 9) — an
      // overlay never outlives the page that opened it. Repository writes
      // (STATE_CHANGED) do not close it; renderReady refreshes it in place.
      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, function () {
        if (tableState.drawerEvidenceId && AuditOS.presentation && AuditOS.presentation.closeDrawer) {
          AuditOS.presentation.closeDrawer();
        }
      });

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
