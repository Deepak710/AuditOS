/**
 * AuditOS Findings Workspace
 * Workspaces and Navigation — Chapter 12 / Workspace Architecture — Chapter 61 /
 * Audit Lifecycle — Chapter 11 / Component Architecture — Chapter 74
 *
 * The operational workspace where testing results become audit observations
 * (GitHub Issue #25). A finding is not a manually authored document: it is the
 * outcome of audit knowledge — walkthrough understanding, evidence evaluation,
 * control testing, and auditor judgement converging on an exception worth
 * reporting. Release 1 is a faithful visualization of the current findings JSON —
 * no AI, no backend, no writes, no workflow engine. In Release 2 AI agents will
 * draft findings, identify duplicates, recommend severity and root causes,
 * suggest remediation, and propose report wording; this workspace opens those
 * seams without implementing them, rendering only the current findings state and
 * never fabricating a finding or inferring a conclusion.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to the
 * Engagement, Walkthrough, Evidence, Requirements, Controls, and Testing
 * workspaces. `collectViewModel` is the single place this workspace reads
 * `AuditOS.state`; it returns a declarative model of pure, offline-testable
 * derivations. The renderer configures the Shared Workspace Framework's inherited
 * skeleton (`AuditOS.workspaceFramework.configure`) and fills its slots with
 * compositions from the Enterprise Data Presentation System
 * (`AuditOS.presentation`) — no bespoke primitives, no duplicated components
 * (Component Design Patterns §81.4 — Composition Over Duplication).
 *
 * Findings are read through the same engagement-scoped document pattern as
 * controls, evidence, and testing (`findDatasetsForEngagement` / `getDocument`).
 * Each finding carries its recorded severity ("High" / "Medium" / "Low") and
 * status ("Open" / "Closed" / "Accepted Risk"). Every read normalizes across the
 * two demo shapes — a SOC 2 shape with a prior-year `knowledgeReuse` block and a
 * `linkedPriorYearFindingId`, and an ISO 27001 shape with a `framework`, an
 * `annexASection`, and a cross-framework `frameworkReuse` block — and fabricates
 * nothing where a field is absent. A finding's related control resolves to a real
 * name only when its `libraryControlId` joins the shared control library (or its
 * `controlId` joins the engagement control set); its domain resolves to the
 * library control's family; its owner resolves to a real person only when
 * `ownerPocId` joins the points-of-contact directory; and its related test
 * resolves to the procedure the `testId` joins. Any identifier that joins nothing
 * renders as its raw value — never a fabricated label. The demo findings record no
 * root cause, no dated activity trail, and no approval history, so those Inspector
 * sections render reserved placeholders rather than an invented conclusion.
 *
 * The Findings Queue is the primary operational surface. It renders every finding
 * once and offers four presentation modes over that single dataset — Findings, By
 * severity, By domain, and By owner — each a pure regrouping of the same rows.
 * Changing the view changes presentation only; no finding is added, removed, or
 * mutated. Selecting a row opens the Finding Inspector beside it. The inspector
 * renderer is host-agnostic (data in, one self-contained node out) so a later
 * release can mount it in a dedicated region with no change here, and it exposes
 * the description, impact, recommendation, related control, related evidence,
 * related testing, related requirements, remediation, and prior-year knowledge
 * only when the JSON records them, never fabricating a conclusion.
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
  var TONES = { INFO: 'info', SUCCESS: 'success', WARNING: 'warning', ERROR: 'error' };

  var ENGAGEMENT_STATUS = { IN_PROGRESS: 'In Progress' };

  /**
   * Finding severity vocabulary → tone (read, never invented). The demo data uses
   * "High", "Medium", and "Low"; the vocabulary also covers "Critical" so future
   * data (including AI-recommended severities) reads through the same token-backed
   * tones. An unmapped severity resolves to a neutral info tone.
   */
  var SEVERITY_TONES = {
    'Critical': TONES.ERROR,
    'High': TONES.ERROR,
    'Medium': TONES.WARNING,
    'Low': TONES.INFO,
    'Informational': TONES.INFO
  };

  /**
   * Finding operational-status vocabulary → tone (read, never invented). The demo
   * data uses "Open", "Closed", and "Accepted Risk"; the vocabulary also covers
   * the operational states a finding moves through — Under Review, In Remediation —
   * so future data (including AI-drafted states) reads through the same
   * token-backed tones. An unmapped status resolves to a neutral info tone.
   */
  var STATUS_TONES = {
    'Open': TONES.WARNING,
    'Under Review': TONES.INFO,
    'In Remediation': TONES.WARNING,
    'Accepted Risk': TONES.INFO,
    'Closed': TONES.SUCCESS
  };

  /**
   * Canonical order for the Findings Health strip so its status indicators read in
   * a stable operational sequence regardless of which statuses the data contains.
   * Statuses outside this list sort after it, alphabetically.
   */
  var STATUS_ORDER = ['Open', 'Under Review', 'In Remediation', 'Accepted Risk', 'Closed'];

  /**
   * Canonical severity order (most severe first) so the health strip and the
   * By-severity view read consistently. Severities outside this list sort after
   * it, alphabetically.
   */
  var SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Informational'];

  /** The four presentation modes over the one findings queue. */
  var VIEWS = { FINDING: 'finding', SEVERITY: 'severity', DOMAIN: 'domain', OWNER: 'owner' };

  /** Deterministic month labels so dates never depend on runtime locale. */
  var MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** Maximum entries per supporting list so panels stay scannable. */
  var LIST_LIMIT = 8;

  /** Entrance stagger ceiling — sections beyond this share the last delay. */
  var STAGGER_LIMIT = 3;

  // ------------------------------------------------------------------
  // Pure derivation helpers — no DOM, no AuditOS.state access. Each takes plain
  // records and returns plain view data, so the offline unit suites exercise
  // them directly (derived values remain derived, §30.12).
  // ------------------------------------------------------------------

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** Formats an ISO `YYYY-MM-DD` date as a compact, deterministic label. */
  function formatDate(isoDate) {
    if (typeof isoDate !== 'string' || !isoDate) {
      return '';
    }
    var parts = isoDate.split('-');
    var month = MONTH_LABELS[Number(parts[1]) - 1];
    if (parts.length < 3 || !month) {
      return isoDate;
    }
    return month + ' ' + Number(parts[2]) + ', ' + parts[0];
  }

  /** Formats a `{ startDate, endDate }` period as `start – end`. */
  function formatPeriod(period) {
    if (!period || !period.startDate || !period.endDate) {
      return '';
    }
    return formatDate(period.startDate) + ' – ' + formatDate(period.endDate);
  }

  /**
   * The frameworks attached to an engagement, always as an array. Identical
   * Release 1 → Release 2 seam as the other workspaces: a future engagement with
   * a `frameworks` array renders every entry; today's single `framework` string
   * becomes a one-element array; neither yields an empty array.
   */
  function normalizeFrameworks(engagement) {
    if (!engagement) {
      return [];
    }
    if (Array.isArray(engagement.frameworks) && engagement.frameworks.length > 0) {
      return engagement.frameworks.slice();
    }
    if (typeof engagement.framework === 'string' && engagement.framework) {
      return [engagement.framework];
    }
    return [];
  }

  /** The current engagement: identical rule to Home, Engagement, Walkthrough, Evidence, Requirements, Controls, and Testing. */
  function deriveCurrentEngagement(engagements) {
    if (!Array.isArray(engagements) || engagements.length === 0) {
      return null;
    }
    for (var index = 0; index < engagements.length; index += 1) {
      if (engagements[index].status === ENGAGEMENT_STATUS.IN_PROGRESS) {
        return engagements[index];
      }
    }
    return engagements[0];
  }

  /** Resolves a finding severity to a presentation tone (neutral when unmapped). */
  function resolveSeverityTone(severity) {
    return Object.prototype.hasOwnProperty.call(SEVERITY_TONES, severity) ? SEVERITY_TONES[severity] : TONES.INFO;
  }

  /** Resolves a finding status to a presentation tone (neutral when unmapped). */
  function resolveStatusTone(status) {
    return Object.prototype.hasOwnProperty.call(STATUS_TONES, status) ? STATUS_TONES[status] : TONES.INFO;
  }

  /**
   * The control a finding relates to, resolved only where an identifier genuinely
   * joins: the shared control library by `libraryControlId` first (the master
   * definition every engagement references), then the engagement control set by
   * `controlId`. A finding whose identifiers join neither renders its raw
   * `controlId` with no title — never a fabricated control. Returns
   * `{ id, code, title, familyId, category }`.
   */
  function resolveRelatedControl(finding, context) {
    var source = finding || {};
    var ctx = context || {};
    var libraryControl = source.libraryControlId && ctx.libraryControlsById ? ctx.libraryControlsById[source.libraryControlId] : null;
    if (libraryControl) {
      return {
        id: source.controlId || source.libraryControlId || '',
        code: libraryControl.controlCode || '',
        title: libraryControl.title || '',
        familyId: libraryControl.controlFamilyId || '',
        category: ''
      };
    }
    var engagementControl = source.controlId && ctx.controlsById ? ctx.controlsById[source.controlId] : null;
    if (engagementControl) {
      return {
        id: source.controlId,
        code: engagementControl.controlId || '',
        title: engagementControl.title || '',
        familyId: '',
        category: engagementControl.category || ''
      };
    }
    return { id: source.controlId || '', code: '', title: '', familyId: '', category: '' };
  }

  /** A compact related-control label — code + title where they resolve, else the raw identifier. */
  function relatedControlLabel(related) {
    var source = related || {};
    var label = [source.code, source.title].filter(Boolean).join(' · ');
    return label || source.id || '';
  }

  /**
   * The audit domain a finding sits in, resolved only where the relationship
   * genuinely joins: the related library control's family (Governance, Identity &
   * Access Management, …), or the engagement control's category. A finding whose
   * control joins neither, or whose family is unregistered, reads no domain —
   * never a fabricated grouping.
   */
  function resolveDomain(finding, context) {
    var ctx = context || {};
    var related = resolveRelatedControl(finding, ctx);
    var family = related.familyId && ctx.controlFamiliesById ? ctx.controlFamiliesById[related.familyId] : null;
    if (family && family.name) {
      return family.name;
    }
    if (related.category) {
      return related.category;
    }
    return '';
  }

  /**
   * The owner of a finding, resolved to a real person only where `ownerPocId`
   * joins the points-of-contact directory. A finding whose owner does not join
   * renders the raw identifier — never a fabricated name. Returns
   * `{ id, name, designation }`.
   */
  function resolveOwner(finding, context) {
    var ctx = context || {};
    var id = finding && finding.ownerPocId ? finding.ownerPocId : '';
    var poc = id && ctx.pocsById ? ctx.pocsById[id] : null;
    return {
      id: id,
      name: poc && poc.name ? poc.name : '',
      designation: poc && poc.designation ? poc.designation : ''
    };
  }

  /** A compact owner label — the resolved name where it joins, else the raw identifier. */
  function ownerLabel(owner) {
    var source = owner || {};
    return source.name || source.id || '';
  }

  /**
   * The test a finding was raised from, resolved to its procedure only where
   * `testId` joins the engagement testing set. A finding whose test does not join
   * renders the raw identifier — never a fabricated procedure. Returns
   * `{ id, title }`.
   */
  function resolveRelatedTest(finding, context) {
    var ctx = context || {};
    var id = finding && finding.testId ? finding.testId : '';
    var test = id && ctx.testsById ? ctx.testsById[id] : null;
    return { id: id, title: test && test.procedure ? test.procedure : '' };
  }

  /**
   * The requirements a finding connects to, drawn only through the engagement
   * control it joins (a control declares the requirements it satisfies). A finding
   * whose control does not join the engagement control set yields an empty list
   * and the reserved placeholder — never a fabricated requirement link.
   */
  function resolveRelatedRequirements(finding, context) {
    var ctx = context || {};
    var eng = finding && finding.controlId && ctx.controlsById ? ctx.controlsById[finding.controlId] : null;
    return eng && Array.isArray(eng.requirementIds) ? eng.requirementIds.slice() : [];
  }

  /**
   * One Findings Queue row, resolved to display fields. The related control,
   * domain, owner, and related test resolve to names where their identifiers
   * genuinely join and render the raw identifier otherwise. The finding record is
   * carried through for the Inspector.
   */
  function deriveFindingRow(finding, context) {
    var source = finding || {};
    var related = resolveRelatedControl(source, context);
    var owner = resolveOwner(source, context);
    var test = resolveRelatedTest(source, context);
    return {
      id: source.id || '',
      finding: source,
      title: source.title || '',
      severity: source.severity || '',
      severityTone: resolveSeverityTone(source.severity),
      status: source.status || '',
      statusTone: resolveStatusTone(source.status),
      owner: owner,
      ownerLabel: ownerLabel(owner),
      control: related,
      controlLabel: relatedControlLabel(related),
      domain: resolveDomain(source, context),
      test: test,
      evidence: source.workingPaperId || '',
      reportable: Boolean(source.reportable)
    };
  }

  /**
   * The Findings Queue — every finding rendered once, ordered by identifier so the
   * surface is stable. Nothing is capped or filtered: the queue is the full
   * operational dataset the presentation views regroup.
   */
  function deriveQueue(findings, context) {
    return asArray(findings)
      .map(function (finding) { return deriveFindingRow(finding, context); })
      .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
  }

  /**
   * The Findings Health strip — one indicator per operational status actually
   * present (labelled by the status, valued by its real count) in canonical order,
   * then one indicator per severity actually present (most severe first), then a
   * derived Reportable indicator. Every value is a real count of real records; an
   * engagement with no findings yields a single Findings / None indicator. Never a
   * fabricated count.
   */
  function deriveFindingsHealth(findings) {
    var list = asArray(findings);
    if (list.length === 0) {
      return [{ key: 'findings', label: 'Findings', status: 'None', tone: TONES.SUCCESS }];
    }

    var statusCounts = {};
    var severityCounts = {};
    list.forEach(function (finding) {
      var status = finding && finding.status ? finding.status : 'Unspecified';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      var severity = finding && finding.severity ? finding.severity : 'Unspecified';
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;
    });

    var indicators = orderedKeys(statusCounts, STATUS_ORDER).map(function (status) {
      return {
        key: 'status-' + slug(status),
        label: status,
        status: String(statusCounts[status]),
        tone: resolveStatusTone(status)
      };
    });

    orderedKeys(severityCounts, SEVERITY_ORDER).forEach(function (severity) {
      indicators.push({
        key: 'severity-' + slug(severity),
        label: severity,
        status: String(severityCounts[severity]),
        tone: resolveSeverityTone(severity)
      });
    });

    var reportable = list.filter(function (finding) { return finding && finding.reportable; }).length;
    indicators.push({
      key: 'reportable',
      label: 'Reportable',
      status: reportable > 0 ? String(reportable) : 'None',
      tone: reportable > 0 ? TONES.WARNING : TONES.SUCCESS
    });

    return indicators;
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
   * Remediation progress — real counts only: closed findings over total findings,
   * with the open / accepted-risk / closed breakdown. No estimated percentage; the
   * ratio is a real measurement of the recorded findings, and an engagement with no
   * findings reads zero rather than a fabricated figure.
   */
  function deriveRemediation(findings) {
    var list = asArray(findings);
    var closed = list.filter(function (finding) { return finding && finding.status === 'Closed'; }).length;
    var acceptedRisk = list.filter(function (finding) { return finding && finding.status === 'Accepted Risk'; }).length;
    var open = list.length - closed - acceptedRisk;
    return { total: list.length, closed: closed, acceptedRisk: acceptedRisk, open: open };
  }

  /**
   * The overall findings status for the header badge: No findings when there are
   * none, Open findings when any finding is neither closed nor accepted, Resolved
   * once every finding is closed or accepted. Derived from real status counts;
   * never a fabricated aggregate.
   */
  function deriveFindingsStatus(findings) {
    var remediation = deriveRemediation(findings);
    if (remediation.total === 0) {
      return { label: 'No findings', tone: null };
    }
    if (remediation.open > 0) {
      return { label: 'Open findings', tone: TONES.WARNING };
    }
    return { label: 'Resolved', tone: TONES.SUCCESS };
  }

  // ---- Presentation views — four regroupings of the one queue dataset. Each is
  // pure and returns `{ groups: [{ label, rows }] }` from the same rows, so
  // changing the view changes presentation only and never the data.

  /** Findings view — the flat queue, a single unlabeled group. */
  function findingView(rows) {
    return { id: VIEWS.FINDING, groups: [{ label: '', rows: asArray(rows).slice() }] };
  }

  /** By severity — the same rows grouped by severity, most severe first. */
  function severityView(rows) {
    return groupBy(VIEWS.SEVERITY, rows, function (row) { return row.severity || 'Unspecified'; }, SEVERITY_ORDER);
  }

  /** By domain — the same rows grouped by audit domain, groups ordered by label. */
  function domainView(rows) {
    return groupBy(VIEWS.DOMAIN, rows, function (row) { return row.domain || 'Unassigned domain'; }, null);
  }

  /** By owner — the same rows grouped by finding owner, groups ordered by label. */
  function ownerView(rows) {
    return groupBy(VIEWS.OWNER, rows, function (row) { return row.ownerLabel || 'Unassigned owner'; }, null);
  }

  /**
   * Groups rows by a key function. When `order` is supplied the groups follow that
   * canonical order (unknown keys alphabetically after); otherwise groups are
   * ordered alphabetically by label. Presentation only — every row is preserved.
   */
  function groupBy(id, rows, keyOf, order) {
    var groups = {};
    asArray(rows).forEach(function (row) {
      var key = keyOf(row);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(row);
    });
    var keys = order ? orderedKeys(groups, order) : Object.keys(groups).sort(function (a, b) { return a.localeCompare(b); });
    return { id: id, groups: keys.map(function (key) { return { label: key, rows: groups[key] }; }) };
  }

  /**
   * The four presentation views over one dataset, each with a switcher label and
   * its regrouped structure. The row set is identical across all four; only the
   * grouping and ordering differ.
   */
  function deriveViews(rows) {
    return [
      { id: VIEWS.FINDING, label: 'Findings', view: findingView(rows) },
      { id: VIEWS.SEVERITY, label: 'By severity', view: severityView(rows) },
      { id: VIEWS.DOMAIN, label: 'By domain', view: domainView(rows) },
      { id: VIEWS.OWNER, label: 'By owner', view: ownerView(rows) }
    ];
  }

  /**
   * The Audit Lineage — Walkthrough → Requirement → Control → Evidence → Testing
   * → Finding → Report, with Finding highlighted as the object this workspace
   * owns. Each node carries its real, current count for the engagement and a link
   * into its workspace; nodes with no data read "—" and never a fabricated figure.
   * Only the counts vary with the data; the chain is the audit methodology's real
   * shape.
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
      { id: ids.REQUIREMENTS, label: 'Requirement', count: requirements.requirements || 0, present: (requirements.requirements || 0) > 0, hint: 'What the control satisfies' },
      { id: ids.CONTROLS, label: 'Control', count: controls.controls || 0, present: (controls.controls || 0) > 0, hint: 'What testing validates' },
      { id: ids.EVIDENCE, label: 'Evidence', count: evidence.evidenceItems || 0, present: (evidence.evidenceItems || 0) > 0, hint: 'What testing inspects' },
      { id: ids.TESTING, label: 'Testing', count: testing.tests || 0, present: (testing.tests || 0) > 0, hint: 'Where the finding is surfaced' },
      { id: ids.FINDINGS, label: 'Finding', count: findings.findings || 0, present: (findings.findings || 0) > 0, hint: 'The audit observation', highlighted: true },
      { id: ids.REPORTING, label: 'Report', count: report ? null : 0, present: Boolean(report), hint: report ? report.status : 'Not started' }
    ];

    return nodes.map(function (node) {
      var workspace = workspaceRegistry.findById(node.id);
      return {
        label: node.label,
        path: workspace ? workspace.path : null,
        count: node.count,
        present: node.present,
        highlighted: Boolean(node.highlighted),
        hint: node.hint
      };
    });
  }

  /**
   * Related audit objects for the supporting panel: the domains findings connect
   * to, each with its real count, only when data exists. Reuses the same chain the
   * lineage draws from (Findings is the workspace's own object, so it is not listed
   * as a relation).
   */
  function deriveRelationships(workspaceRegistry, operational) {
    if (!workspaceRegistry) {
      return [];
    }
    var ops = operational || {};
    var requirements = ops.requirements || {};
    var controls = ops.controls || {};
    var evidence = ops.evidence || {};
    var testing = ops.testing || {};
    var report = ops.report || null;
    var ids = workspaceRegistry.IDS;

    var related = [
      { id: ids.TESTING, title: 'Testing', meta: String(testing.tests || 0), present: (testing.tests || 0) > 0 },
      { id: ids.CONTROLS, title: 'Controls', meta: String(controls.controls || 0), present: (controls.controls || 0) > 0 },
      { id: ids.EVIDENCE, title: 'Evidence', meta: String(evidence.evidenceItems || 0), present: (evidence.evidenceItems || 0) > 0 },
      { id: ids.REQUIREMENTS, title: 'Requirements', meta: String(requirements.requirements || 0), present: (requirements.requirements || 0) > 0 },
      { id: ids.REPORTING, title: 'Report', meta: report ? String(report.status) : '—', present: Boolean(report) }
    ];
    return related.filter(function (item) { return item.present; }).map(function (item) {
      var workspace = workspaceRegistry.findById(item.id);
      return { title: item.title, meta: item.meta, path: workspace ? workspace.path : null };
    });
  }

  /**
   * Recent finding-related activity, newest first, drawn only from dated history
   * the findings carry (activity / history entries, or a recorded update
   * timestamp). The current demo findings record no dated events, so this yields an
   * empty feed and the shared Empty State — never a fabricated event. Release 2's
   * AI-assisted finding generation populates this seam.
   */
  function deriveActivity(findings) {
    var events = [];
    asArray(findings).forEach(function (finding) {
      var source = finding || {};
      asArray(source.activityHistory || source.activity || source.history).forEach(function (entry) {
        var date = entry && (entry.date || entry.timestamp || entry.on);
        if (!date) {
          return;
        }
        events.push({
          title: (entry.title || entry.action || entry.status || 'Finding updated') + ': ' + (source.id || ''),
          meta: entry.status || '',
          timestamp: formatDate(date),
          date: date,
          tone: entry.tone || resolveStatusTone(entry.status)
        });
      });
      var updated = source.updatedAt || source.updatedOn;
      if (updated) {
        events.push({
          title: 'Finding updated: ' + (source.id || ''),
          meta: source.status || '',
          timestamp: formatDate(updated),
          date: updated,
          tone: resolveStatusTone(source.status)
        });
      }
    });
    return events
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
      .slice(0, LIST_LIMIT);
  }

  /**
   * Findings document metadata: created / modified / owner / version / tags /
   * source, derived from the findings document metadata, the engagement, and the
   * company. Only fields with real values are surfaced by the builder.
   */
  function deriveMetadata(findingsMetadata, engagement, company, findings) {
    var meta = findingsMetadata || {};
    var tagSet = {};
    var tagOrder = [];
    asArray(findings).forEach(function (finding) {
      asArray(finding.tags).forEach(function (tag) {
        if (!tagSet[tag]) {
          tagSet[tag] = true;
          tagOrder.push(tag);
        }
      });
    });
    return {
      created: company && company.createdAt ? formatDate(company.createdAt) : '',
      modified: meta.generatedAt ? formatDate(String(meta.generatedAt).slice(0, 10)) : '',
      owner: engagement ? (engagement.engagementLead || engagement.auditor || '') : '',
      version: meta.version || '',
      tags: tagOrder,
      source: meta.dataset || ''
    };
  }

  // ---- Inspector configuration — pure, host-agnostic (§9). Returns plain
  // Inspector Panel configuration; no DOM. Description, impact, recommendation,
  // related objects, remediation, and prior-year knowledge render only when the
  // JSON records them; conclusions are never fabricated.

  /** One text-valued Inspector section rendered as a single placeholder-capable list row. */
  function textSection(title, text, placeholder) {
    return { title: title, kind: 'list', items: [{ title: text || placeholder }] };
  }

  /** One list-valued Inspector section; an empty list renders one placeholder row. */
  function listSection(title, items, placeholder) {
    var list = asArray(items);
    return { title: title, kind: 'list', items: list.length > 0 ? list : [{ title: placeholder }] };
  }

  /**
   * The prior-year and cross-framework knowledge a finding records, drawn only
   * from the reuse block it carries: the SOC 2 `knowledgeReuse` shape (prior-year
   * finding review) with its `linkedPriorYearFindingId`, or the ISO `frameworkReuse`
   * shape (cross-framework methodology reference). A finding declaring neither
   * yields an empty array and the reserved placeholder — never a fabricated reuse
   * claim. Release 2 extends this with AI-identified duplicate findings.
   */
  function derivePriorYearItems(finding) {
    var source = finding || {};
    var items = [];
    if (source.linkedPriorYearFindingId) {
      items.push({ title: 'Prior-year finding: ' + source.linkedPriorYearFindingId, tone: TONES.INFO });
    }
    if (source.knowledgeReuse && typeof source.knowledgeReuse === 'object') {
      if (source.knowledgeReuse.priorFindingReviewed) {
        items.push({ title: 'Prior-year finding reviewed', tone: TONES.INFO });
      }
      if (source.knowledgeReuse.sourceEngagementId) {
        items.push({ title: 'Source engagement: ' + source.knowledgeReuse.sourceEngagementId, tone: TONES.INFO });
      }
    }
    if (source.frameworkReuse && typeof source.frameworkReuse === 'object') {
      if (source.frameworkReuse.sourceFramework) {
        items.push({ title: 'Source framework: ' + source.frameworkReuse.sourceFramework, tone: TONES.INFO });
      }
      if (source.frameworkReuse.methodologyReusable) {
        items.push({ title: 'Methodology reusable across frameworks', tone: TONES.INFO });
      }
      if (source.frameworkReuse.evidenceReusable) {
        items.push({ title: 'Evidence reusable across frameworks', tone: TONES.INFO });
      }
    }
    return items;
  }

  /**
   * The remediation facts a finding records, as read from the JSON: its status,
   * target closure date, and management response. Empty only when the finding
   * records none of these, in which case the reserved placeholder renders — never
   * an invented remediation plan.
   */
  function deriveRemediationItems(finding) {
    var source = finding || {};
    var items = [];
    if (source.status) {
      items.push({ title: 'Status: ' + source.status, tone: resolveStatusTone(source.status) });
    }
    if (source.targetClosureDate) {
      items.push({ title: 'Target closure: ' + formatDate(source.targetClosureDate), tone: TONES.INFO });
    }
    if (source.managementResponse) {
      items.push({ title: source.managementResponse, tone: TONES.INFO });
    }
    return items;
  }

  /**
   * The Finding Inspector configuration for one finding (Master → Detail detail
   * pane). Renders the finding identity, description, severity, status, root cause,
   * impact, recommendation, related control, related evidence, related testing,
   * related requirements, remediation, prior-year knowledge, activity, and the
   * approval history — a placeholder row wherever the JSON lacks data, and never a
   * fabricated conclusion. Pure and host-agnostic: data in, one plain
   * configuration out.
   */
  function buildFindingInspector(finding, context) {
    var item = finding || {};
    var ctx = context || {};
    var related = resolveRelatedControl(item, ctx);
    var owner = resolveOwner(item, ctx);
    var domain = resolveDomain(item, ctx);
    var test = resolveRelatedTest(item, ctx);
    var requirements = resolveRelatedRequirements(item, ctx);
    var priorYear = derivePriorYearItems(item);

    return {
      eyebrow: relatedControlLabel(related) || 'Audit finding',
      title: item.title || item.id || '',
      subtitle: [item.id, item.status].filter(Boolean).join(' · '),
      badges: [
        item.severity ? { label: item.severity, tone: resolveSeverityTone(item.severity) } : null,
        item.status ? { label: item.status, tone: resolveStatusTone(item.status) } : null,
        item.reportable ? { label: 'Reportable', tone: TONES.WARNING } : null
      ].filter(Boolean),
      sections: [
        {
          title: 'Properties', kind: 'properties', columns: 2,
          rows: [
            { label: 'Finding id', value: item.id || '' },
            { label: 'Severity', value: item.severity || '' },
            { label: 'Status', value: item.status || '' },
            { label: 'Owner', value: ownerLabel(owner) },
            { label: 'Domain', value: domain },
            { label: 'Related control', value: relatedControlLabel(related) },
            { label: 'Related test', value: test.id || '' },
            { label: 'Related evidence', value: item.workingPaperId || '' },
            { label: 'Target closure', value: formatDate(item.targetClosureDate) },
            { label: 'Reportable', value: item.reportable ? 'Yes' : 'No' },
            { label: 'Framework', value: item.framework || '' },
            { label: 'Annex A section', value: item.annexASection || '' },
            { label: 'Report section', value: item.reportSection || '' },
            { label: 'Prior-year finding', value: item.linkedPriorYearFindingId || '' }
          ].filter(function (row) { return row.value; })
        },
        textSection('Description', item.observation, 'No description recorded. Release 2 adds AI-drafted findings for human approval.'),
        textSection('Root cause', item.rootCause, 'No root cause recorded. Release 2 adds AI-recommended root causes for human approval.'),
        textSection('Impact', item.risk, 'No impact recorded for this finding. Release 2 adds AI-assessed impact for human approval.'),
        textSection('Recommendation', item.recommendation, 'No recommendation recorded. Release 2 adds AI-suggested remediation for human approval.'),
        listSection('Related controls',
          related.id ? [{ title: relatedControlLabel(related), tone: TONES.INFO }] : [],
          'No related control recorded for this finding.'),
        listSection('Related evidence',
          item.workingPaperId ? [{ title: 'Working paper: ' + item.workingPaperId, tone: TONES.INFO }] : [],
          'No related evidence recorded for this finding.'),
        listSection('Related testing',
          test.id ? [{ title: (test.title ? test.title + ' · ' : '') + test.id, tone: TONES.INFO }] : [],
          'No related test recorded for this finding.'),
        listSection('Related requirements',
          requirements.map(function (id) { return { title: id, tone: TONES.INFO }; }),
          'No related requirement recorded for this finding. Release 2 traces requirements through the related control.'),
        listSection('Remediation', deriveRemediationItems(item),
          'No remediation recorded for this finding. Release 2 adds AI-suggested remediation for human approval.'),
        priorYear.length > 0
          ? { title: 'Prior-year knowledge', kind: 'list', items: priorYear }
          : {
            title: 'Prior-year knowledge', kind: 'placeholder',
            empty: {
              icon: '◇', title: 'No prior-year knowledge recorded',
              description: 'Release 1 renders reuse only when the JSON records it. Release 2 adds AI-identified duplicate findings and prior-year links here.'
            }
          },
        {
          title: 'Activity', kind: 'placeholder',
          empty: {
            icon: '◇', title: 'No activity recorded',
            description: 'Release 1 renders a finding activity trail only when the JSON records one. Release 2 adds AI-assisted finding activity here.'
          }
        },
        {
          title: 'Approval history', kind: 'placeholder',
          empty: {
            icon: '◇', title: 'No approval history recorded',
            description: 'Release 1 records no approval history. Release 2 routes every AI-drafted finding, severity, root cause, and remediation through human approval and records it here.'
          }
        }
      ]
    };
  }

  // ------------------------------------------------------------------
  // View model — the single place this workspace reads AuditOS.state.
  // ------------------------------------------------------------------

  /** Reads the first dataset document an engagement owns in a collection, or null. */
  function readEngagementDocument(state, collectionId, engagementId) {
    var datasetIds = state.findDatasetsForEngagement(collectionId, engagementId);
    return datasetIds.length > 0 ? state.getDocument(collectionId, datasetIds[0]) : null;
  }

  /** Finds a record by id within a list. */
  function findById(records, id) {
    for (var index = 0; index < asArray(records).length; index += 1) {
      if (records[index].id === id) {
        return records[index];
      }
    }
    return null;
  }

  /** Indexes a list of records by their id field. */
  function indexById(records) {
    var map = {};
    asArray(records).forEach(function (record) {
      if (record && record.id) {
        map[record.id] = record;
      }
    });
    return map;
  }

  /**
   * Collects everything the Findings Workspace presents from the Shared Audit
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
    var libraryDocument = state.getDocument('control-library') || {};
    var libraryControlsById = indexById(state.listRecords('control-library'));
    var controlFamiliesById = indexById(libraryDocument.controlFamilies);

    var findingsDocument = readEngagementDocument(state, 'findings', engagement.id) || {};
    var controlsDocument = readEngagementDocument(state, 'controls', engagement.id) || {};
    var requirementsDocument = readEngagementDocument(state, 'evidence-requirements', engagement.id) || {};
    var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
    var testingDocument = readEngagementDocument(state, 'testing', engagement.id) || {};
    var reportsDocument = readEngagementDocument(state, 'reports', engagement.id) || {};

    var findingRecords = asArray(findingsDocument.findings);
    var controlsById = indexById(controlsDocument.controls);
    var testsById = indexById(testingDocument.tests);
    var pocsById = indexById(state.listRecords('pocs'));

    var frameworks = normalizeFrameworks(engagement);
    var auditPeriodLabel = formatPeriod(engagement.auditPeriod);

    var context = {
      controlsById: controlsById,
      libraryControlsById: libraryControlsById,
      controlFamiliesById: controlFamiliesById,
      testsById: testsById,
      pocsById: pocsById,
      frameworks: frameworks,
      auditPeriodLabel: auditPeriodLabel,
      engagement: engagement,
      company: company
    };

    var operational = {
      requirements: { requirements: asArray(requirementsDocument.requirements).length },
      controls: { controls: asArray(controlsDocument.controls).length },
      evidence: evidenceDocument.summary || {},
      testing: { tests: asArray(testingDocument.tests).length },
      findings: { findings: findingRecords.length },
      report: reportsDocument.document || null
    };

    var queue = deriveQueue(findingRecords, context);
    var findingsStatus = deriveFindingsStatus(findingRecords);
    var remediation = deriveRemediation(findingRecords);

    return {
      degraded: false,
      status: status,
      engagement: engagement,
      company: company,
      frameworks: frameworks,
      context: context,

      header: {
        eyebrow: engagement.engagementCode + ' · Findings',
        title: company ? company.name : engagement.companyId,
        meta: engagement.name + ' · audit findings',
        frameworks: frameworks,
        status: findingsStatus,
        lastUpdated: findingsDocument.metadata && findingsDocument.metadata.generatedAt
          ? 'Updated ' + formatDate(String(findingsDocument.metadata.generatedAt).slice(0, 10))
          : '',
        actions: [{ label: 'Engagement overview', href: '#/engagements', variant: 'subtle' }]
      },

      ribbon: [
        { label: 'Client', value: company ? company.name : engagement.companyId },
        { label: 'Audit period', value: auditPeriodLabel },
        { label: 'Findings', value: String(findingRecords.length) }
      ],

      toolbar: { search: { placeholder: 'Search findings' } },
      filterBar: {
        dropdowns: [{ label: 'Framework', options: ['All frameworks'].concat(frameworks) }]
      },

      findingsHealth: deriveFindingsHealth(findingRecords),
      remediation: remediation,
      queue: queue,
      views: deriveViews(queue),
      lineage: deriveLineage(workspaceRegistry, operational),
      relationships: deriveRelationships(workspaceRegistry, operational),
      activity: deriveActivity(findingRecords),
      metadata: deriveMetadata(findingsDocument.metadata, engagement, company, findingRecords),

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
  function el(tagName, className, textContent) {
    var node = global.document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (textContent !== undefined && textContent !== null && textContent !== '') {
      node.textContent = textContent;
    }
    return node;
  }

  /** The shared presentation system, resolved at render time. */
  function presentation() {
    return AuditOS.presentation;
  }

  /** Builds one Section component: an eyebrow, a title, an optional description, then a body node. */
  function buildSection(id, meta, bodyNode) {
    var section = el('section', 'aos-section aos-findings__section aos-findings__section--' + id);
    section.setAttribute('aria-label', meta.title);

    var header = el('header', 'aos-section__header');
    if (meta.kicker) {
      header.appendChild(el('p', 'aos-section__eyebrow', meta.kicker));
    }
    header.appendChild(el('h2', 'aos-section__title', meta.title));
    if (meta.description) {
      header.appendChild(el('p', 'aos-section__description', meta.description));
    }
    section.appendChild(header);

    var body = el('div', 'aos-section__body');
    body.appendChild(bodyNode);
    section.appendChild(body);
    return section;
  }

  /**
   * Builds the Findings Health strip: a row of tone-dot indicators (editor
   * status-bar style, identical composition to the other operational workspaces).
   * The status text carries the meaning; the dot only reinforces the tone, so
   * health reads without relying on color.
   */
  function buildHealthStrip(items) {
    var strip = el('div', 'aos-findings__health');
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', 'Findings health');
    asArray(items).forEach(function (item) {
      var node = el('span', 'aos-findings__health-item');
      node.setAttribute('aria-label', item.label + ': ' + item.status);
      var dot = el('span', 'aos-findings__health-dot' + (item.tone ? ' aos-findings__health-dot--' + item.tone : ''));
      dot.setAttribute('aria-hidden', 'true');
      node.appendChild(dot);
      node.appendChild(el('span', 'aos-findings__health-label', item.label));
      node.appendChild(el('span', 'aos-findings__health-status', item.status));
      strip.appendChild(node);
    });
    return strip;
  }

  /**
   * Builds the Remediation Status body: the shared Progress meter over real counts
   * (closed of total), with a breakdown line of the open / accepted-risk / closed
   * figures. No estimated percentage — the ratio is a real measurement.
   */
  function buildRemediationBody(remediation) {
    var P = presentation();
    var wrap = el('div', 'aos-findings__remediation');
    wrap.appendChild(P.progressMeter({
      label: 'Findings closed', value: remediation.closed, total: remediation.total, tone: TONES.INFO
    }));
    var breakdown = el('div', 'aos-findings__remediation-breakdown');
    [
      { label: 'Open', value: remediation.open },
      { label: 'Accepted risk', value: remediation.acceptedRisk },
      { label: 'Closed', value: remediation.closed }
    ].forEach(function (entry) {
      var item = el('span', 'aos-findings__remediation-item');
      item.appendChild(el('span', 'aos-findings__remediation-item-label', entry.label));
      item.appendChild(el('span', 'aos-findings__remediation-item-value aos-numeric', String(entry.value)));
      breakdown.appendChild(item);
    });
    wrap.appendChild(breakdown);
    return wrap;
  }

  /** Builds one Findings Queue master row: title + finding id, status, and operational meta. */
  function buildRow(row) {
    var P = presentation();
    var node = el('button', null);
    node.type = 'button';

    var head = el('div', 'aos-findings__row-head');
    var identity = el('div', 'aos-findings__row-identity');
    if (row.id) {
      identity.appendChild(el('span', 'aos-findings__row-code aos-numeric', row.id));
    }
    identity.appendChild(el('span', 'aos-findings__row-title', row.title || row.id));
    head.appendChild(identity);
    if (row.status) {
      head.appendChild(P.statusBadge({ label: row.status, tone: row.statusTone }));
    }
    node.appendChild(head);

    var meta = el('div', 'aos-findings__row-meta');
    if (row.severity) {
      meta.appendChild(el('span', 'aos-findings__row-severity aos-findings__row-severity--' + (row.severityTone || 'neutral'), row.severity));
    }
    if (row.controlLabel) {
      meta.appendChild(el('span', 'aos-findings__row-control', row.controlLabel));
    }
    if (row.ownerLabel) {
      meta.appendChild(el('span', null, row.ownerLabel));
    }
    if (row.test && row.test.id) {
      meta.appendChild(el('span', 'aos-findings__row-test', row.test.id));
    }
    node.appendChild(meta);
    return node;
  }

  /**
   * A selection controller shared by every rail rendering: registering a row wires
   * its click to swap the Finding Inspector into the detail mount; selecting the
   * first row establishes the default detail. Memory-only presentation state — no
   * business data is touched, no route changed.
   */
  function createSelection(detailMount, context) {
    var entries = [];
    function select(index) {
      entries.forEach(function (entry, entryIndex) {
        var selected = entryIndex === index;
        entry.node.classList.toggle('aos-findings__row--selected', selected);
        entry.node.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      if (entries[index]) {
        detailMount.replaceChildren(presentation().inspectorPanel(buildFindingInspector(entries[index].row.finding, context)));
      }
    }
    return {
      register: function (row, node) {
        var index = entries.length;
        entries.push({ row: row, node: node });
        node.addEventListener('click', function () { select(index); });
      },
      selectFirst: function () { if (entries.length > 0) { select(0); } }
    };
  }

  /**
   * Renders a set of grouped rows into a master list node and wires selection to
   * the detail mount. Clears the list first, so the same node re-renders when the
   * presentation view changes — the mechanism behind the four views over one
   * dataset. Group labels render as a labeled divider carrying the group's count.
   */
  function mountRailGroups(listNode, detailMount, groups, context) {
    listNode.replaceChildren();
    var selection = createSelection(detailMount, context);
    asArray(groups).forEach(function (group) {
      if (group.label) {
        var divider = el('div', 'aos-findings__group');
        divider.setAttribute('role', 'separator');
        divider.setAttribute('aria-label', group.label);
        divider.appendChild(el('span', 'aos-findings__group-label', group.label));
        divider.appendChild(el('span', 'aos-findings__group-count aos-numeric', String(asArray(group.rows).length)));
        listNode.appendChild(divider);
      }
      asArray(group.rows).forEach(function (row) {
        var node = buildRow(row);
        node.classList.add('aos-findings__row');
        node.setAttribute('aria-pressed', 'false');
        selection.register(row, node);
        listNode.appendChild(node);
      });
    });
    selection.selectFirst();
  }

  /**
   * Builds the Findings Queue: a view switcher above a Master–Detail whose master
   * rail lists the findings for the active view and whose detail shows the selected
   * finding's Inspector Panel. The switcher swaps between the four presentation
   * modes — Findings, By severity, By domain, By owner — by re-rendering the same
   * rail from the same dataset (presentation-only, memory-only); it never changes
   * the data.
   */
  function buildQueueBody(views, context) {
    var wrap = el('div', 'aos-findings__queue');
    var detailMount = el('div', 'aos-findings__detail-mount');
    var listNode = el('div', 'aos-findings__row-list');
    listNode.setAttribute('role', 'list');

    var switcher = el('div', 'aos-findings__views');
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Finding views');
    var chips = [];

    function activate(index) {
      chips.forEach(function (chip, chipIndex) {
        var selected = chipIndex === index;
        chip.classList.toggle('aos-findings__view-chip--active', selected);
        chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      mountRailGroups(listNode, detailMount, views[index].view.groups, context);
    }

    asArray(views).forEach(function (view, index) {
      var chip = el('button', 'aos-findings__view-chip', view.label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
      if (index === 0) {
        chip.classList.add('aos-findings__view-chip--active');
      }
      chip.addEventListener('click', function () { activate(index); });
      chips.push(chip);
      switcher.appendChild(chip);
    });

    var masterDetail = presentation().masterDetail({
      list: listNode, detail: detailMount, ratio: 42,
      listLabel: 'Findings queue', detailLabel: 'Finding inspector'
    });

    wrap.appendChild(switcher);
    wrap.appendChild(masterDetail);
    activate(0);
    return wrap;
  }

  /**
   * Builds the Audit Lineage body: the methodology chain rendered as connected
   * nodes with Finding highlighted. Each node shows its real count and links into
   * its workspace; absent nodes read "—". The chain reads left-to-right on wide
   * canvases and stacks on narrow ones (stylesheet).
   */
  function buildLineageBody(lineage) {
    var chain = el('div', 'aos-findings__lineage');
    chain.setAttribute('role', 'list');
    asArray(lineage).forEach(function (node, index) {
      if (index > 0) {
        var connector = el('span', 'aos-findings__lineage-connector', '→');
        connector.setAttribute('aria-hidden', 'true');
        chain.appendChild(connector);
      }
      var tag = node.path ? 'a' : 'div';
      var card = el(tag, 'aos-findings__lineage-node' + (node.highlighted ? ' aos-findings__lineage-node--highlighted' : '') + (node.present ? '' : ' aos-findings__lineage-node--empty'));
      card.setAttribute('role', 'listitem');
      if (node.path) {
        card.setAttribute('href', '#/' + node.path);
      }
      card.appendChild(el('span', 'aos-findings__lineage-label', node.label));
      var value = node.count === null ? (node.present ? '' : '—') : String(node.count);
      if (value) {
        card.appendChild(el('span', 'aos-findings__lineage-count aos-numeric', value));
      }
      if (node.hint) {
        card.appendChild(el('span', 'aos-findings__lineage-hint', node.hint));
      }
      chain.appendChild(card);
    });
    return chain;
  }

  /** Builds the Metadata body: the shared Metadata List of presentation fields. */
  function buildMetadataBody(metadata) {
    var P = presentation();
    var pairs = [
      { term: 'Created', detail: metadata.created },
      { term: 'Modified', detail: metadata.modified },
      { term: 'Owner', detail: metadata.owner },
      { term: 'Version', detail: metadata.version },
      { term: 'Tags', detail: asArray(metadata.tags).join(' · ') },
      { term: 'Source', detail: metadata.source }
    ].filter(function (pair) { return pair.detail; });
    return P.metadataList(pairs);
  }

  /** Builds the Related information supporting panel body: related audit objects with navigation. */
  function buildRelatedBody(relationships) {
    var P = presentation();
    if (asArray(relationships).length === 0) {
      return P.emptyState({
        icon: '◇', title: 'No related objects',
        description: 'The audit domains findings connect to appear here once they hold data.'
      });
    }
    return P.itemList(relationships.map(function (item) {
      return {
        title: item.title, meta: item.meta, tone: TONES.INFO,
        actions: item.path ? [{ label: 'Open', href: '#/' + item.path }] : []
      };
    }), { compact: true });
  }

  /** Builds the Activity Feed for the activity supporting panel. */
  function buildActivityBody(activity) {
    var P = presentation();
    if (asArray(activity).length === 0) {
      return P.emptyState({
        icon: '◇', title: 'No recent activity',
        description: 'Finding updates, reviews, and remediation events appear here as the engagement progresses.'
      });
    }
    return P.activityFeed({ events: activity });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    var fragment = global.document.createDocumentFragment();
    asArray(entries).forEach(function (entry) {
      var item = el('span', 'aos-findings-footer__item');
      item.appendChild(el('span', 'aos-findings-footer__label', entry.label));
      item.appendChild(el('span', 'aos-findings-footer__value aos-numeric', entry.value));
      fragment.appendChild(item);
    });
    return fragment;
  }

  /**
   * Host-agnostic Inspector renderer (§9): given the findings queue and the
   * resolution context, returns one self-contained Master–Detail node — the
   * findings rail beside the Finding Inspector — making no assumption about where
   * it is mounted. Release 1 mounts the fuller Queue (with its view switcher) in
   * the primary content; this renderer exposes the same master → detail interaction
   * for any other host with no change here.
   */
  function renderInspector(queue, context) {
    var detailMount = el('div', 'aos-findings__detail-mount');
    var listNode = el('div', 'aos-findings__row-list');
    listNode.setAttribute('role', 'list');
    mountRailGroups(listNode, detailMount, [{ label: '', rows: queue }], context);
    return presentation().masterDetail({
      list: listNode, detail: detailMount, ratio: 42,
      listLabel: 'Findings queue', detailLabel: 'Finding inspector'
    });
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Returns a framework slot inside the active workspace view. */
  function slotElement(view, slotName) {
    return view.querySelector('[data-slot="' + slotName + '"]');
  }

  /** Replaces a slot's content with the given nodes (or clears it). */
  function fillSlot(view, slotName, nodes) {
    var slot = slotElement(view, slotName);
    if (!slot) {
      return;
    }
    slot.replaceChildren.apply(slot, nodes || []);
  }

  /**
   * The ordered findings sections (§ Workspace Structure): operational health, the
   * findings queue with its four views and the inspector, the remediation status,
   * the audit lineage, then the findings metadata. Each entry names the section id,
   * its header, whether it has data, its body builder, and an empty descriptor used
   * when the data is absent (§ Empty States).
   */
  function primarySections(viewModel) {
    var context = viewModel.context;
    return [
      {
        id: 'health', kicker: 'Operational status', title: 'Findings health',
        present: true, body: function () { return buildHealthStrip(viewModel.findingsHealth); }
      },
      {
        id: 'queue', kicker: 'Operational queue', title: 'Findings queue',
        description: 'Every finding for the engagement. Switch between Findings, By severity, By domain, and By owner — the same dataset, regrouped — and select a finding to open its Inspector, with the description, impact, recommendation, related objects, and remediation.',
        present: viewModel.queue.length > 0,
        body: function () { return buildQueueBody(viewModel.views, context); },
        empty: {
          icon: '◇', title: 'No findings yet',
          description: 'Findings appear here as testing surfaces them for the engagement. Release 2 adds AI-drafted findings, recommended severities, root causes, and proposed remediation; Release 1 renders only the current findings state.'
        }
      },
      {
        id: 'remediation', kicker: 'Remediation', title: 'Remediation status',
        description: 'Closed findings over the total recorded for the engagement. Real counts only — no estimated percentages, no invented remediation.',
        present: viewModel.remediation.total > 0,
        body: function () { return buildRemediationBody(viewModel.remediation); },
        empty: {
          icon: '◇', title: 'No findings yet',
          description: 'Remediation status appears here once findings are recorded for the engagement.'
        }
      },
      {
        id: 'lineage', kicker: 'Relationships', title: 'Audit lineage',
        description: 'Where findings sit in the audit chain, from walkthrough through to report.',
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

  /** Renders the ready findings experience into the framework slots. */
  function renderReady(view, viewModel) {
    var P = presentation();

    AuditOS.workspaceFramework.configure(view, {
      header: viewModel.header,
      contextSummary: viewModel.ribbon,
      toolbar: viewModel.toolbar,
      filterBar: viewModel.filterBar
    });

    var canvas = el('div', 'aos-findings');
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
      description: 'AI-assisted findings — drafted findings, identified duplicates, recommended severity and root causes, suggested remediation, and proposed report wording — will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
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
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'detail', label: 'Loading findings' })]);
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
        '. Regenerate the demo-data bundle and reload to restore the Findings Workspace.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders the Findings Workspace when it is the active workspace: the ready
   * experience once the state has loaded, the loading skeleton before that, and
   * the degraded explanation when no engagement is available.
   */
  function renderActiveFindings() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.FINDINGS) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.FINDINGS + '"]'
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

  AuditOS.findingsWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      formatDate: formatDate,
      formatPeriod: formatPeriod,
      normalizeFrameworks: normalizeFrameworks,
      deriveCurrentEngagement: deriveCurrentEngagement,
      resolveSeverityTone: resolveSeverityTone,
      resolveStatusTone: resolveStatusTone,
      resolveRelatedControl: resolveRelatedControl,
      relatedControlLabel: relatedControlLabel,
      resolveDomain: resolveDomain,
      resolveOwner: resolveOwner,
      ownerLabel: ownerLabel,
      resolveRelatedTest: resolveRelatedTest,
      resolveRelatedRequirements: resolveRelatedRequirements,
      deriveFindingRow: deriveFindingRow,
      deriveQueue: deriveQueue,
      deriveFindingsHealth: deriveFindingsHealth,
      deriveRemediation: deriveRemediation,
      deriveFindingsStatus: deriveFindingsStatus,
      findingView: findingView,
      severityView: severityView,
      domainView: domainView,
      ownerView: ownerView,
      deriveViews: deriveViews,
      deriveLineage: deriveLineage,
      deriveRelationships: deriveRelationships,
      deriveActivity: deriveActivity,
      deriveMetadata: deriveMetadata,
      derivePriorYearItems: derivePriorYearItems,
      deriveRemediationItems: deriveRemediationItems,
      buildFindingInspector: buildFindingInspector
    },

    collectViewModel: collectViewModel,

    // Host-agnostic Inspector renderer (§9): data → one self-contained node,
    // mountable in any host. Release 1 mounts the fuller Queue in primary content.
    renderInspector: renderInspector,

    /**
     * Binds the Findings Workspace to the router and the Shared Audit State. Safe
     * to call once, after the DOM is ready, the router has resolved the initial
     * route, and the framework has rendered its skeleton (script order guarantees
     * the framework's route listener runs first). Does nothing when the routing or
     * state foundations are absent, so the shell degrades rather than throwing.
     */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveFindings);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveFindings);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveFindings);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveFindings);
      }
      renderActiveFindings();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.findingsWorkspace.init);
    } else {
      AuditOS.findingsWorkspace.init();
    }
  }
})(window);
