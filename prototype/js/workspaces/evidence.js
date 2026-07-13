/**
 * AuditOS Evidence Workspace
 * Evidence Workspace Consolidation — GitHub Issue #39 / Workspaces and
 * Navigation — Chapter 12 / Workspace Architecture — Chapter 61
 *
 * Evidence is the operational object of an engagement (Issue #39):
 * Requirements ceased to exist as a user-facing workspace, and this
 * workspace is the one operational system of record. The surface is
 * deliberately consolidated — filters, metrics, table, drawer, and workflow;
 * nothing else. The search strip, framework strip, summary strip, related
 * requirement UI, AI recommendations panel, and activity panel are removed.
 *
 * Layout (Issue #39 — Table Layout): the board occupies the remaining
 * viewport height; the table owns all scrolling internally, so the page
 * itself never scrolls — an enterprise audit application layout.
 *
 * Search (Issue #39 — Evidence Search): the input is mounted once and never
 * recreated; typing debounces a filter pass that updates the table rows (and
 * the live metrics) only, so focus and the caret never move.
 *
 * Lifecycle: every status renders through the canonical Evidence Lifecycle
 * (js/services/evidence-lifecycle.js). Evidence types carry persistent
 * colors (the same type is the same color everywhere); the evidence title
 * renders in its type color.
 *
 * Predictive metrics (Issue #39): the status chart displays Current and
 * Projected — the projection assumes every pending approval is accepted
 * (in-flight status proposals land, evidence under review is accepted) —
 * with projected values rendered as ghosted overlays.
 *
 * Workflow drawer (Issue #39): the entire workflow lives inside the shared
 * enterprise drawer — the lifecycle timeline, propose/approve/reject/ignore,
 * the in-flight suggestions, the complete audit history (user, timestamp,
 * previous state, new state, reason, comment), and the AI lineage — no
 * floating popups. Status changes never edit production state directly: a
 * proposal walks Suggested → Reviewed → Approved → Applied through the
 * Suggestion Lifecycle Service, and the Repository is written only on Apply.
 *
 * Everything resolves exclusively from the engagement in the active route
 * context (Context Resolver contract — no fallback engagement); identifiers
 * resolve to names only when they genuinely join, and nothing is fabricated.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Shared Workspace Platform (Issue #27) — harmonized helpers. */
  var WS = AuditOS.workspaceShared || {};

  // ------------------------------------------------------------------
  // Constants
  // ------------------------------------------------------------------

  /** The Shared Workspace Framework slots this workspace fills directly. */
  var SLOTS = {
    CONTENT: 'primary-content'
  };

  /** Presentation tones shared by badges, markers, and rails. */
  var TONES = WS.TONES;

  // ------------------------------------------------------------------
  // Pure derivation helpers — no DOM, no AuditOS.state access.
  // ------------------------------------------------------------------

  /** Returns the value when it is an array, otherwise an empty array. */
  var asArray = WS.asArray;

  /** Formats an ISO `YYYY-MM-DD` date as a compact, deterministic label. */
  var formatDate = WS.formatDate;

  /** Formats a `{ startDate, endDate }` period as `start – end`. */
  var formatPeriod = WS.formatPeriod;

  /** The frameworks attached to an engagement, always as an array. */
  var normalizeFrameworks = WS.normalizeFrameworks;

  /** The canonical Evidence Lifecycle, resolved at call time. */
  function lifecycle() {
    return AuditOS.evidenceLifecycle || null;
  }

  /** Resolves an evidence status to its lifecycle tone; unknown reads neutral. */
  function resolveReviewTone(status) {
    var model = lifecycle();
    return model ? model.toneOf(status) : TONES.INFO;
  }

  /** The persistent color key of an evidence type (consistent across the app). */
  function typeColorKey(evidenceType) {
    var model = lifecycle();
    return model ? model.typeColorKey(evidenceType) : 'slate';
  }

  /**
   * Normalizes the two reuse shapes the evidence datasets carry into one plain
   * descriptor, or null when a record declares no reuse. Nothing is
   * fabricated: a record with neither key, or one whose reuse is not eligible
   * in any form, yields null.
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
   * the evidence's linked requirements' `controlLinks` resolved to a control
   * id within their engagement (requirement records remain an internal
   * mapping layer — Issue #39), plus any direct `linkedControlIds`. Each
   * mapping records whether it resolves inside the current engagement.
   * Nothing is fabricated: a code that does not resolve keeps its raw code
   * and a null control id.
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

  /** The reuse classification of an evidence row. */
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

  /** One Evidence table row, resolved to display fields. */
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
      typeColor: typeColorKey(source.evidenceType || source.fileType || ''),
      status: source.reviewStatus || '',
      statusTone: resolveReviewTone(source.reviewStatus),
      mappings: mappings,
      mappedCount: mappings.length,
      reuse: deriveReuseScope(source),
      reusable: normalizeReuse(source) !== null,
      evidence: source
    };
  }

  /** The Evidence table — every record rendered once, ordered by identifier. */
  function deriveEvidenceRows(records, context) {
    return asArray(records)
      .map(function (record) { return deriveEvidenceRow(record, context); })
      .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
  }

  /**
   * The distinct review statuses the records actually use, in canonical
   * lifecycle order (unknown statuses trail alphabetically) — the filter
   * vocabulary is real, never invented.
   */
  function collectStatusOptions(records) {
    var model = lifecycle();
    var seen = {};
    var present = [];
    asArray(records).forEach(function (record) {
      var status = record && record.reviewStatus;
      if (status && !seen[status]) {
        seen[status] = true;
        present.push(status);
      }
    });
    return present.sort(function (a, b) {
      var orderA = model ? model.orderOf(a) : -1;
      var orderB = model ? model.orderOf(b) : -1;
      if (orderA === -1 && orderB === -1) { return a.localeCompare(b); }
      if (orderA === -1) { return 1; }
      if (orderB === -1) { return -1; }
      return orderA - orderB;
    });
  }

  /** The distinct non-empty values of a row field, sorted — for a filter control. */
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
   * The in-flight status proposal targeting a row, or null: an evidence-status
   * suggestion not yet Applied or Rejected.
   */
  function pendingStatusSuggestion(row, context) {
    return asArray(context.suggestions).filter(function (suggestion) {
      return suggestion.category === 'evidence-status' &&
        asArray(suggestion.auditReferences).indexOf(row.id) !== -1 &&
        suggestion.status !== 'Applied' && suggestion.status !== 'Rejected';
    })[0] || null;
  }

  /** The proposed status carried by a status suggestion's apply target, or ''. */
  function proposedStatusOf(suggestion) {
    var target = suggestion && suggestion.applyTarget;
    return target && target.changes && target.changes.reviewStatus ? target.changes.reviewStatus : '';
  }

  /**
   * The projected status of a row assuming every pending approval is
   * accepted (Issue #39 — Predictive Metrics): an in-flight proposal lands
   * on its proposed status, and evidence under review is accepted. Rows with
   * nothing pending project unchanged.
   */
  function deriveProjectedStatus(row, context) {
    var pending = pendingStatusSuggestion(row, context);
    var proposed = proposedStatusOf(pending);
    if (proposed) {
      return proposed;
    }
    if (row.status === 'Under Review' || row.status === 'Pending Review') {
      return 'Accepted';
    }
    return row.status;
  }

  /**
   * The KPI strip: real counts over the currently filtered rows. Each KPI
   * carries a `filter` descriptor so a click toggles that facet, and the
   * "Evidence" total clears every facet. Never a fabricated figure.
   */
  function deriveKpis(rows, context) {
    var model = lifecycle();
    var list = asArray(rows);
    var mapped = 0;
    var reusable = 0;
    var multiEngagement = 0;
    var pending = 0;
    list.forEach(function (row) {
      if (row.mappedCount > 0) { mapped += 1; }
      if (row.reusable) { reusable += 1; }
      if (row.reuse.key !== 'current') { multiEngagement += 1; }
      if (model && model.isPending(row.status)) { pending += 1; }
      else if (context && pendingStatusSuggestion(row, context)) { pending += 1; }
    });
    return [
      { key: 'total', label: 'Evidence', value: String(list.length), tone: null, filter: null },
      { key: 'pending', label: 'In lifecycle', value: String(pending), tone: pending > 0 ? TONES.WARNING : null, filter: { field: 'pending', value: true } },
      { key: 'mapped', label: 'Mapped to controls', value: String(mapped), tone: mapped > 0 ? TONES.INFO : null, filter: { field: 'mapped', value: true } },
      { key: 'reusable', label: 'Reusable', value: String(reusable), tone: reusable > 0 ? TONES.INFO : null, filter: { field: 'reusable', value: true } },
      { key: 'multi-engagement', label: 'Cross-engagement', value: String(multiEngagement), tone: multiEngagement > 0 ? TONES.INFO : null, filter: { field: 'multiEngagement', value: true } }
    ];
  }

  /**
   * One distribution chart over a row field, ordered by count descending.
   * Each segment carries a `filter` descriptor so a click toggles that facet.
   * When `projectField` resolves projected values, every segment also carries
   * its projected count so the chart renders Current + Projected (ghosted).
   */
  function deriveDistribution(rows, field, toneFor, projectValue) {
    var list = asArray(rows);
    var counts = {};
    var projected = {};
    var order = [];
    list.forEach(function (row) {
      var value = row[field] || 'Unspecified';
      if (!Object.prototype.hasOwnProperty.call(counts, value)) {
        counts[value] = 0;
        projected[value] = 0;
        order.push(value);
      }
      counts[value] += 1;
      if (projectValue) {
        var future = projectValue(row) || 'Unspecified';
        if (!Object.prototype.hasOwnProperty.call(projected, future)) {
          counts[future] = counts[future] || 0;
          projected[future] = projected[future] || 0;
          if (order.indexOf(future) === -1) { order.push(future); }
        }
        projected[future] += 1;
      }
    });
    order.sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
    return order.map(function (value) {
      return {
        label: value,
        value: counts[value],
        projected: projectValue ? projected[value] || 0 : null,
        total: list.length,
        tone: toneFor ? toneFor(value) : null,
        filter: { field: field, value: value }
      };
    });
  }

  /** The review-status distribution chart, with projected (ghost) counts. */
  function deriveStatusChart(rows, context) {
    return deriveDistribution(rows, 'status', resolveReviewTone, function (row) {
      return deriveProjectedStatus(row, context || {});
    });
  }

  /** The evidence-type distribution chart (persistent type colors). */
  function deriveTypeChart(rows) {
    return deriveDistribution(rows, 'evidenceType', null, null);
  }

  /** One text-valued Inspector section rendered as a single placeholder-capable list row. */
  var textSection = WS.textSection;

  /** One list-valued Inspector section; an empty list renders one placeholder row. */
  var listSection = WS.listSection;

  /**
   * The Evidence Inspector configuration for one evidence record — the shared
   * enterprise drawer's descriptive body. High-density metadata, owner, team,
   * evidence type, folders and links, control mappings, reuse, and comments —
   * a placeholder row wherever the JSON lacks data, never a fabricated
   * relationship. Requirement references remain internal (Issue #39): no
   * requirement UI, no requirement URLs. Pure: no DOM.
   */
  function buildEvidenceInspector(evidence, context) {
    var item = evidence || {};
    var ctx = context || {};
    var reuse = normalizeReuse(item);
    var status = item.reviewStatus || '';
    var owner = resolveName(ctx.pocsById, item.uploadedByPocId, 'name');
    var team = resolveEvidenceTeam(item, ctx);
    var mappings = deriveControlMappings(item, ctx);
    var reuseScope = deriveReuseScope(item);
    var model = lifecycle();

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
        model && status ? { label: model.phaseOf(status) || 'Lifecycle', tone: null } : null,
        reuseScope.key !== 'current' ? { label: reuseScope.label, tone: reuseScope.tone } : null
      ].filter(Boolean),
      sections: [
        {
          title: 'Properties', kind: 'properties',
          rows: [
            { label: 'Evidence id', value: item.id || '' },
            { label: 'Evidence type', value: item.evidenceType || item.fileType || '' },
            { label: 'Status', value: status },
            { label: 'Lifecycle phase', value: model ? model.phaseOf(status) : '' },
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
        listSection('Folders & links', folderItems,
          'No storage locations recorded for this evidence yet. Release 2 connects evidence folders to SharePoint.'),
        reuse
          ? listSection('Reuse', [{ title: reuse.decision || 'Reusable', description: reuse.sourceEngagementId ? 'Source: ' + reuse.sourceEngagementId : '', tone: TONES.INFO }], '')
          : { title: 'Reuse', kind: 'placeholder', empty: { icon: '◇', title: 'No reuse recorded', description: 'Reuse opportunities appear here when the evidence declares them.' } },
        listSection('Comments', commentItems, 'No comments recorded on this evidence.')
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
   * State, scoped strictly to the engagement in the active route context.
   * Returns null while the state is not ready, and a degraded model when the
   * route carries no engagement (§15.12) — never a fallback engagement.
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
    var pocsById = indexById(pocs);
    var teamsById = indexById(state.listRecords('teams'));

    var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
    var requirementsDocument = readEngagementDocument(state, 'evidence-requirements', engagement.id) || {};
    var controlsDocument = readEngagementDocument(state, 'controls', engagement.id) || {};
    var suggestionsDocument = readEngagementDocument(state, 'suggestions', engagement.id) || {};

    var evidenceRecords = asArray(evidenceDocument.evidence);
    var frameworks = normalizeFrameworks(engagement);
    var auditPeriodLabel = formatPeriod(engagement.auditPeriod);

    var context = {
      requirementsById: indexById(requirementsDocument.requirements),
      controlsById: indexById(controlsDocument.controls),
      controlCodeToId: indexControlsByCode(controlsDocument.controls),
      pocsById: pocsById,
      teamsById: teamsById,
      suggestions: asArray(suggestionsDocument.suggestions),
      workspaceRegistry: workspaceRegistry,
      repository: AuditOS.repository || null,
      auditPeriodLabel: auditPeriodLabel,
      engagement: engagement,
      company: company,
      statusOptions: collectStatusOptions(evidenceRecords)
    };

    var rows = deriveEvidenceRows(evidenceRecords, context);

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
        meta: engagement.name + ' · operational system of record',
        frameworks: frameworks,
        lastUpdated: evidenceDocument.metadata && evidenceDocument.metadata.generatedAt
          ? 'Updated ' + formatDate(String(evidenceDocument.metadata.generatedAt).slice(0, 10))
          : ''
      },

      rows: rows,
      statusOptions: context.statusOptions,
      typeOptions: collectRowValues(rows, 'evidenceType'),
      teamOptions: collectRowValues(rows, 'team')
    };
  }

  // ------------------------------------------------------------------
  // Navigation — every destination is a canonical NavigationService route.
  // ------------------------------------------------------------------

  /**
   * The link to a mapped control: same engagement opens the control's own
   * hierarchical record route; a different engagement resolves that
   * engagement and its client so the pill navigates into it. Null where the
   * hierarchy cannot be built — never a fabricated route.
   */
  function controlHref(mapping, context) {
    var registry = context.workspaceRegistry;
    var navigation = AuditOS.navigationService;
    if (!registry || !navigation) {
      return null;
    }
    var controlsId = registry.IDS.CONTROLS;
    var repository = context.repository;

    if (mapping.sameEngagement && context.company && context.engagement) {
      return navigation.hrefWorkspace(context.company.id, context.engagement.id, controlsId, mapping.controlId || undefined);
    }
    if (repository && mapping.engagementId) {
      var targetEngagement = findById(repository.engagements.list(), mapping.engagementId);
      var targetCompany = targetEngagement ? findById(repository.clients.list(), targetEngagement.companyId) : null;
      if (targetCompany && targetEngagement) {
        return navigation.hrefWorkspace(targetCompany.id, targetEngagement.id, controlsId, mapping.controlId || undefined);
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // DOM builders — thin layout wrappers around the Enterprise Data
  // Presentation System. Text is always assigned through textContent.
  // ------------------------------------------------------------------

  /** Creates an element with a class and optional text content. */
  var el = WS.el;

  /** The shared presentation system, resolved at render time. */
  var presentation = WS.presentation;

  /**
   * Memory-only presentation state: the composed table filters, whether the
   * projected overlay is on, and the evidence the shared drawer currently
   * shows so a Repository write refreshes the same drawer instead of closing
   * it.
   */
  var tableState = {
    search: '', status: '', evidenceType: '', team: '',
    mapped: false, reusable: false, multiEngagement: false, pending: false,
    projected: true,
    drawerEvidenceId: '', lastTargetId: ''
  };

  /** Whether any facet or search filter is active. */
  function hasActiveFilters() {
    return Boolean(tableState.search || tableState.status || tableState.evidenceType ||
      tableState.team || tableState.mapped || tableState.reusable ||
      tableState.multiEngagement || tableState.pending);
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
    tableState.pending = false;
  }

  /** Applies every composed filter to the rows. Presentation only. */
  function applyFilters(rows, context) {
    var model = lifecycle();
    var term = tableState.search.trim().toLowerCase();
    return asArray(rows).filter(function (row) {
      if (tableState.status && row.status !== tableState.status) { return false; }
      if (tableState.evidenceType && row.evidenceType !== tableState.evidenceType) { return false; }
      if (tableState.team && row.team !== tableState.team) { return false; }
      if (tableState.mapped && row.mappedCount === 0) { return false; }
      if (tableState.reusable && !row.reusable) { return false; }
      if (tableState.multiEngagement && row.reuse.key === 'current') { return false; }
      if (tableState.pending) {
        var isPending = (model && model.isPending(row.status)) ||
          Boolean(context && pendingStatusSuggestion(row, context));
        if (!isPending) { return false; }
      }
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

  /** Builds the KPI strip: one stat-tile toggle button per KPI. */
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
   * toggle buttons. When segments carry projected counts and the projected
   * overlay is on, a second ghosted bar renders the projection beneath the
   * current bar and each legend row reads `current → projected`.
   */
  function buildChart(title, segments, onFilter, options) {
    var config = options || {};
    var wrap = el('div', 'aos-evidence__chart');
    var head = el('div', 'aos-evidence__chart-head');
    head.appendChild(el('h4', 'aos-evidence__chart-title', title));
    var showProjected = Boolean(config.projectable && tableState.projected);
    if (config.projectable) {
      var toggle = el('button', 'aos-evidence__chart-projected-toggle' +
        (tableState.projected ? ' aos-evidence__chart-projected-toggle--active' : ''));
      toggle.type = 'button';
      toggle.setAttribute('aria-pressed', tableState.projected ? 'true' : 'false');
      toggle.textContent = 'Projected';
      toggle.title = 'Projected assumes every pending approval is accepted';
      toggle.addEventListener('click', function () {
        tableState.projected = !tableState.projected;
        config.onProjectedToggle();
      });
      head.appendChild(toggle);
    }
    wrap.appendChild(head);

    var total = asArray(segments).reduce(function (sum, segment) { return sum + segment.value; }, 0);

    function buildBar(readValue, ghost) {
      var bar = el('div', 'aos-evidence__chart-bar' + (ghost ? ' aos-evidence__chart-bar--projected' : ''));
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', title + (ghost ? ' projected distribution' : ' distribution'));
      asArray(segments).forEach(function (segment) {
        var value = readValue(segment);
        var percent = total > 0 ? Math.round((value / total) * 100) : 0;
        if (ghost && value === 0) { percent = 0; }
        var fill = el('button', 'aos-evidence__chart-segment' +
          (segment.tone ? ' aos-evidence__chart-segment--' + segment.tone : '') +
          (isFacetActive(segment.filter) ? ' aos-evidence__chart-segment--active' : ''));
        fill.type = 'button';
        fill.style.width = percent + '%';
        fill.setAttribute('aria-label', segment.label + ': ' + value + (ghost ? ' projected' : '') + ' (' + percent + '%)');
        fill.addEventListener('click', function () { onFilter(segment.filter); });
        bar.appendChild(fill);
      });
      return bar;
    }

    wrap.appendChild(buildBar(function (segment) { return segment.value; }, false));
    if (showProjected) {
      wrap.appendChild(buildBar(function (segment) { return segment.projected || 0; }, true));
    }

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
      var reading = segment.value + ' · ' + percent + '%';
      if (showProjected && segment.projected !== null && segment.projected !== segment.value) {
        reading += ' → ' + segment.projected;
      }
      button.appendChild(el('span', 'aos-evidence__chart-legend-value aos-numeric', reading));
      button.addEventListener('click', function () { onFilter(segment.filter); });
      entry.appendChild(button);
      legend.appendChild(entry);
    });
    wrap.appendChild(legend);
    return wrap;
  }

  /**
   * Builds the inline Status cell: a dropdown of the canonical lifecycle.
   * Selecting a new status never edits the record directly — it proposes a
   * Suggestion through the Suggestion Lifecycle Service; the Repository write
   * happens only on Apply. A pending proposal shows a clock affordance that
   * opens the drawer's workflow — no floating popups.
   */
  function buildStatusCell(row, context) {
    var P = presentation();
    var repository = AuditOS.repository;
    var suggestionService = AuditOS.suggestionService;
    var model = lifecycle();
    var engagementId = context.engagement ? context.engagement.id : '';
    var statusOptions = model ? model.statusLabels() : (context.statusOptions || []);
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
        proposeStatusChange(row, proposed, context);
      });
      cell.appendChild(select);
    } else {
      cell.appendChild(P.statusBadge({ label: row.status || '—', tone: row.statusTone }));
    }

    if (pending) {
      var clock = el('button', 'aos-evidence__status-pending');
      clock.type = 'button';
      clock.setAttribute('aria-label', 'Pending status change (' + pending.status + ') — open workflow');
      clock.title = 'Pending: ' + pending.title + ' · ' + pending.status;
      clock.appendChild(el('i', 'bi bi-clock-history'));
      clock.addEventListener('click', function () { openEvidenceDrawer(row, context); });
      cell.appendChild(clock);
    }
    return cell;
  }

  /** Records a status-change proposal through the Suggestion Lifecycle. */
  function proposeStatusChange(row, proposed, context) {
    var repository = AuditOS.repository;
    var suggestionService = AuditOS.suggestionService;
    var engagementId = context.engagement ? context.engagement.id : '';
    if (!repository || !suggestionService || !engagementId) {
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
  }

  /**
   * Builds the Control Mapping cell: one pill per mapped control. Clicking a
   * pill navigates directly to the mapped control — within the current
   * engagement, or into the engagement that owns it.
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

  /** Builds the row Actions cell: an Eye that opens the workflow drawer. */
  function buildActionCell(row, context) {
    var wrap = el('div', 'aos-evidence__actions');
    var view = el('button', 'aos-evidence__icon-button');
    view.type = 'button';
    view.setAttribute('aria-label', 'Open evidence workflow for ' + (row.title || row.id));
    view.title = 'Open evidence workflow';
    view.appendChild(el('i', 'bi bi-eye'));
    view.addEventListener('click', function () { openEvidenceDrawer(row, context); });
    wrap.appendChild(view);
    return wrap;
  }

  /** Builds the evidence-type badge: a colored dot plus the type name (persistent color). */
  function buildTypeBadge(row) {
    var badge = el('span', 'aos-evidence__type aos-evidence-type--' + row.typeColor);
    var dot = el('span', 'aos-evidence__type-dot');
    dot.setAttribute('aria-hidden', 'true');
    badge.appendChild(dot);
    badge.appendChild(el('span', 'aos-evidence__type-label', row.evidenceType || '—'));
    return badge;
  }

  /** Builds one dense-table row descriptor: the title (in its type color) opens the drawer. */
  function buildTableRow(row, context) {
    var open = el('button', 'aos-evidence__table-title aos-evidence-type--' + row.typeColor);
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
        type: buildTypeBadge(row),
        status: buildStatusCell(row, context),
        controls: buildControlPills(row, context),
        actions: buildActionCell(row, context)
      }
    };
  }

  /**
   * Builds the Evidence board: the metrics band (KPIs + charts with the
   * projected overlay), the filter row, then the one dense enterprise table
   * that owns the scrolling. The filter row — including the search input —
   * is built exactly once and never rebuilt: `render()` recomputes the
   * filtered rows and replaces only the metrics and the grid, so the search
   * input keeps focus through every keystroke (Issue #39 — Evidence Search).
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

    var dropdowns = {};
    var resetMount = el('span', 'aos-evidence__toolbar-reset');

    function render() {
      var filtered = applyFilters(viewModel.rows, context);

      kpiMount.replaceChildren(buildKpiStrip(deriveKpis(filtered, context), function (filter) {
        toggleFacet(filter);
        render();
      }));

      chartMount.replaceChildren(
        buildChart('Lifecycle status', deriveStatusChart(filtered, context), function (filter) {
          toggleFacet(filter); render();
        }, { projectable: true, onProjectedToggle: render }),
        buildChart('Evidence type', deriveTypeChart(filtered), function (filter) {
          toggleFacet(filter); render();
        }, {})
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

      // Sync the mounted controls to the shared filter state without ever
      // recreating them (a KPI or chart click reflects in the dropdowns).
      dropdowns.status.value = tableState.status;
      dropdowns.evidenceType.value = tableState.evidenceType;
      dropdowns.team.value = tableState.team;
      resetMount.replaceChildren.apply(resetMount, hasActiveFilters() ? [buildResetButton()] : []);
    }

    function buildResetButton() {
      var reset = presentation().button({ label: 'Reset filters', variant: 'subtle', size: 'small' });
      reset.addEventListener('click', function () {
        resetFilters();
        searchInput.value = '';
        render();
      });
      return reset;
    }

    // --- The one-time filter row: search input + dropdowns + reset mount ---
    var searchLabel = el('label', 'aos-evidence__search');
    searchLabel.appendChild(el('span', 'aos-evidence__filter-label', 'Search'));
    var searchInput = el('input', 'aos-evidence__search-input');
    searchInput.type = 'search';
    searchInput.value = tableState.search;
    searchInput.setAttribute('placeholder', 'Search evidence, owner, or team');
    searchInput.setAttribute('aria-label', 'Search evidence');
    // Filter synchronously on every keystroke (Issue #39 — Evidence Search):
    // the search input is mounted once and never rebuilt, and only the
    // metrics and grid below it are replaced, so focus and the caret never
    // move. No timer, no polling — the table simply reflects the query.
    searchInput.addEventListener('input', function () {
      tableState.search = searchInput.value;
      render();
    });
    searchLabel.appendChild(searchInput);
    toolbar.appendChild(searchLabel);

    function buildFilterDropdown(key, labelText, allLabel, options) {
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
      control.value = tableState[key] || '';
      control.addEventListener('change', function () {
        tableState[key] = control.value;
        render();
      });
      dropdowns[key] = control;
      label.appendChild(control);
      return label;
    }

    toolbar.appendChild(buildFilterDropdown('status', 'Status', 'All statuses', viewModel.statusOptions));
    toolbar.appendChild(buildFilterDropdown('evidenceType', 'Evidence type', 'All types', viewModel.typeOptions));
    toolbar.appendChild(buildFilterDropdown('team', 'Team', 'All teams', viewModel.teamOptions));
    toolbar.appendChild(resetMount);

    board.appendChild(toolbar);
    board.appendChild(gridMount);
    render();
    return board;
  }

  // ------------------------------------------------------------------
  // Evidence Workflow Drawer (Issue #39) — the entire workflow in one place:
  // lifecycle timeline, propose / approve / reject / ignore, in-flight
  // suggestions, complete audit history, and AI lineage. No floating popups.
  // ------------------------------------------------------------------

  /**
   * Builds the lifecycle timeline: the canonical phases as a connected
   * chain with the record's current phase highlighted — the redesigned
   * lifecycle visualization (Issue #39 — Evidence Lifecycle).
   */
  function buildLifecycleTimeline(row) {
    var model = lifecycle();
    var chain = el('div', 'aos-evidence__lifecycle');
    chain.setAttribute('role', 'list');
    if (!model) {
      return chain;
    }
    var currentPhase = model.phaseOf(row.status);
    model.PHASES.forEach(function (phase, index) {
      if (index > 0) {
        var connector = el('span', 'aos-evidence__lifecycle-connector', '→');
        connector.setAttribute('aria-hidden', 'true');
        chain.appendChild(connector);
      }
      var reached = currentPhase &&
        model.PHASES.indexOf(phase) <= model.PHASES.indexOf(currentPhase);
      var node = el('div', 'aos-evidence__lifecycle-node' +
        (phase === currentPhase ? ' aos-evidence__lifecycle-node--current' : '') +
        (reached ? ' aos-evidence__lifecycle-node--reached' : ''));
      node.setAttribute('role', 'listitem');
      node.appendChild(el('span', 'aos-evidence__lifecycle-phase', phase));
      if (phase === currentPhase) {
        node.appendChild(el('span', 'aos-evidence__lifecycle-status', row.status));
      }
      chain.appendChild(node);
    });
    return chain;
  }

  /** Builds one in-flight suggestion card with Approve / Reject / Ignore inside the drawer. */
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
        var approveButton = P.button({ label: 'Approve', variant: 'primary' });
        approveButton.addEventListener('click', function () {
          suggestionService.decide(repository, engagementId, suggestion, 'approve', '');
        });
        actions.appendChild(approveButton);

        var rejectButton = P.button({ label: 'Reject', variant: 'subtle' });
        rejectButton.addEventListener('click', function () {
          suggestionService.decide(repository, engagementId, suggestion, 'reject', '');
        });
        actions.appendChild(rejectButton);
      }
      if (suggestion.status === suggestionService.STATUS.APPROVED) {
        var applyButton = P.button({ label: 'Apply', variant: 'primary' });
        applyButton.addEventListener('click', function () {
          suggestionService.decide(repository, engagementId, suggestion, 'apply', '');
        });
        actions.appendChild(applyButton);
      }
      // Ignore dismisses the proposal without adopting it — recorded as a
      // rejection with an explicit reason, so the audit trail never reads
      // a bare "status changed".
      var ignoreButton = P.button({ label: 'Ignore', variant: 'subtle' });
      ignoreButton.addEventListener('click', function () {
        suggestionService.decide(repository, engagementId, suggestion, 'reject', 'Ignored without adoption');
      });
      actions.appendChild(ignoreButton);
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
   * Builds the drawer's workflow section: the propose control over the
   * canonical lifecycle, the in-flight suggestions with their lifecycle
   * actions, and nothing floating.
   */
  function buildWorkflowBody(row, context) {
    var P = presentation();
    var repository = AuditOS.repository;
    var suggestionService = AuditOS.suggestionService;
    var model = lifecycle();
    var engagementId = context.engagement ? context.engagement.id : '';
    var wrap = el('div', 'aos-evidence__workflow');

    var statusOptions = model ? model.statusLabels() : (context.statusOptions || []);
    if (suggestionService && repository && statusOptions.length > 0) {
      var controls = el('div', 'aos-evidence__workflow-controls');
      var select = el('select', 'aos-select__control');
      select.setAttribute('aria-label', 'Proposed evidence status for ' + (row.title || row.id));
      statusOptions.forEach(function (status) {
        var option = el('option', null, status);
        option.value = status;
        select.appendChild(option);
      });
      select.value = statusOptions.indexOf(row.status) !== -1 ? row.status : statusOptions[0];
      controls.appendChild(select);
      var proposeButton = P.button({ label: 'Propose status change', variant: 'subtle' });
      proposeButton.addEventListener('click', function () {
        if (!select.value || select.value === row.status) {
          return;
        }
        proposeStatusChange(row, select.value, context);
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
    return wrap;
  }

  /**
   * Builds the complete audit history of the record: every recorded event
   * with user, timestamp, previous state, new state, reason, and comment
   * (Issue #39 — Audit History; never only "status changed"). Suggestion
   * lifecycle events targeting the record surface alongside its own writes.
   */
  function buildHistoryBody(row, context) {
    var P = presentation();
    var auditService = AuditOS.auditService;
    var events = auditService ? auditService.listForEntity(row.id, 'evidence') : [];

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

    if (events.length === 0) {
      return P.emptyState({
        icon: '◇', title: 'No recorded history yet',
        description: 'Every workflow action is recorded here with who, when, the previous and new state, the reason, and any comment.'
      });
    }
    return P.dataGrid({
      density: 'compact',
      caption: 'Audit history for ' + row.id,
      columns: [
        { key: 'when', label: 'When', width: '10rem' },
        { key: 'user', label: 'User' },
        { key: 'action', label: 'Action' },
        { key: 'previous', label: 'Previous state' },
        { key: 'next', label: 'New state' },
        { key: 'reason', label: 'Reason' },
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
            user: event.user || '',
            action: event.action || '',
            previous: oldStatus ? P.statusBadge({ label: oldStatus, tone: resolveReviewTone(oldStatus) }) : '—',
            next: newStatus ? P.statusBadge({ label: newStatus, tone: resolveReviewTone(newStatus) }) : '—',
            reason: event.reason || '',
            comment: event.comment || ''
          }
        };
      })
    });
  }

  /**
   * Builds the AI lineage section: the reusable lineage architecture
   * (js/services/ai-lineage-service.js) rendered for this record — Evidence
   * is the first implementation. Stages without recorded data read as
   * absent; nothing is fabricated.
   */
  function buildLineageSection(row) {
    var P = presentation();
    var lineageService = AuditOS.aiLineage;
    if (!lineageService) {
      return null;
    }
    var lineage = lineageService.buildLineage(row.evidence, {
      collectionId: 'evidence',
      objectLabel: row.title || row.id
    });
    var wrap = el('div', 'aos-evidence__lineage-body');
    if (!lineageService.isAiGenerated(row.evidence)) {
      wrap.appendChild(el('p', 'aos-evidence__workflow-card-meta',
        'This evidence declares no AI origin — it was collected directly. AI-generated objects carry their complete lineage here: origin, walkthrough session, transcript, evidence references, reasoning, generation, review, and approval.'));
    }
    var list = el('ol', 'aos-evidence__lineage-stages');
    lineage.stages.forEach(function (stage) {
      var item = el('li', 'aos-evidence__lineage-stage' +
        (stage.present ? '' : ' aos-evidence__lineage-stage--absent'));
      item.appendChild(el('span', 'aos-evidence__lineage-stage-label', stage.label));
      if (stage.present) {
        stage.items.forEach(function (fact) {
          var line = el('span', 'aos-evidence__lineage-stage-item',
            [fact.title, fact.detail].filter(Boolean).join(' · '));
          item.appendChild(line);
        });
      } else {
        item.appendChild(el('span', 'aos-evidence__lineage-stage-item', '—'));
      }
      list.appendChild(item);
    });
    wrap.appendChild(list);
    return wrap;
  }

  /** Wraps a drawer section: a fixed structural title plus its body. */
  function drawerSection(title, body) {
    var section = el('section', 'aos-inspector__section');
    section.appendChild(el('h3', 'aos-inspector__section-title', title));
    section.appendChild(body);
    return section;
  }

  /**
   * Opens the shared enterprise drawer for one evidence record: the
   * inspector, the lifecycle timeline, the entire workflow, the complete
   * audit history, and the AI lineage — everything in one place (Issue #39).
   */
  function openEvidenceDrawer(row, context) {
    var P = presentation();
    tableState.drawerEvidenceId = row.id;
    var config = buildEvidenceInspector(row.evidence, context);
    var content = [
      drawerSection('Lifecycle', buildLifecycleTimeline(row)),
      P.inspectorSections(config.sections),
      drawerSection('Workflow', buildWorkflowBody(row, context)),
      drawerSection('History', buildHistoryBody(row, context))
    ];
    var lineageSection = buildLineageSection(row);
    if (lineageSection) {
      content.push(drawerSection('AI lineage', lineageSection));
    }
    P.openDrawer({
      eyebrow: config.eyebrow,
      title: config.title,
      subtitle: config.subtitle,
      badges: config.badges,
      wide: true,
      content: content,
      onClose: function () { tableState.drawerEvidenceId = ''; }
    });
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /**
   * Hides the framework's supporting panels and footer for this workspace:
   * the consolidated Evidence surface is filters, metrics, table, drawer,
   * and workflow — nothing else (Issue #39).
   */
  function collapseSupportingRegions(view) {
    var panels = view.querySelector('[data-region="supporting-panels"]');
    if (panels) {
      panels.hidden = true;
    }
  }

  /** Renders the ready evidence experience into the framework slots. */
  function renderReady(view, viewModel) {
    var P = presentation();
    var router = AuditOS.router;
    var targetId = router && router.getCurrentRecordId ? router.getCurrentRecordId() : '';

    AuditOS.workspaceFramework.configure(view, {
      header: viewModel.header
    });
    collapseSupportingRegions(view);

    var canvas = el('div', 'aos-evidence');
    canvas.setAttribute('data-canvas', 'flush');
    var board = buildBoard(viewModel);
    board.classList.add('aos-rise-in');
    canvas.appendChild(board);
    fillSlot(view, SLOTS.CONTENT, [canvas]);

    // Drawer synchronization: a Repository write that re-renders the
    // workspace refreshes the already-open drawer with fresh data instead of
    // closing it; a route that names a record opens its drawer once per
    // navigation.
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
  }

  /** Renders the layout-stable loading state (§15.12 — Loading). */
  function renderLoading(view) {
    var P = presentation();
    collapseSupportingRegions(view);
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'table', label: 'Loading evidence' })]);
  }

  /** Renders the degraded state (§15.12 — Empty / Error). */
  function renderDegraded(view, viewModel) {
    var P = presentation();
    collapseSupportingRegions(view);
    fillSlot(view, SLOTS.CONTENT, [P.emptyState({
      icon: '◇', title: 'No engagement in context',
      description: 'Evidence is engagement-scoped: open it from a client’s engagement' +
        (viewModel.status && viewModel.status.degradedReason ? ' (' + viewModel.status.degradedReason + ')' : '') +
        '. Select a client from the AuditOS breadcrumb to begin.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders the Evidence Workspace when it is the active workspace: the ready
   * experience once the state has loaded, the loading skeleton before that,
   * and the degraded explanation when the route carries no engagement.
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
      resolveReviewTone: resolveReviewTone,
      typeColorKey: typeColorKey,
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
      pendingStatusSuggestion: pendingStatusSuggestion,
      proposedStatusOf: proposedStatusOf,
      deriveProjectedStatus: deriveProjectedStatus,
      deriveKpis: deriveKpis,
      deriveDistribution: deriveDistribution,
      deriveStatusChart: deriveStatusChart,
      deriveTypeChart: deriveTypeChart,
      buildEvidenceInspector: buildEvidenceInspector
    },

    collectViewModel: collectViewModel,

    /**
     * The host-agnostic renderer: the one consolidated Evidence board
     * (metrics band, filter row, and the dense enterprise table that owns
     * its scrolling) built from a ready view model — data in, node out, so
     * any host can mount it. The workspace's own `renderReady` mounts exactly
     * this node into the framework's content slot.
     */
    renderBoard: function (viewModel) {
      return buildBoard(viewModel);
    },

    /**
     * Binds the Evidence Workspace to the router and the Shared Audit State.
     * Safe to call once, after the DOM is ready, the router has resolved the
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

      // Navigating away closes the evidence drawer — an overlay never
      // outlives the page that opened it. Repository writes (STATE_CHANGED)
      // do not close it; renderReady refreshes it in place.
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
