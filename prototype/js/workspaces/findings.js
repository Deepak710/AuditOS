/**
 * AuditOS Findings Workspace — the Observation Register
 * Living Reporting & Operational Findings — GitHub Issue #41 / Workspaces and
 * Navigation — Chapter 12 / Workspace Architecture — Chapter 61 / Audit
 * Lifecycle — Chapter 11 / Component Architecture — Chapter 74
 *
 * The operational workspace where testing results become audit observations. A
 * finding is not a manually authored document: it is the outcome of audit
 * knowledge — walkthrough understanding, evidence evaluation, control testing,
 * and auditor judgement converging on an exception worth reporting.
 *
 * Issue #41 rebuilds this workspace as a true **Observation Register**. Every
 * observation owns its observation text, root cause, risk, recommendation,
 * management response, owner, due date, status, its linked controls, evidence,
 * tests, and report sections, its AI lineage, its comments, and its approval
 * history — and moves through one governed lifecycle:
 *
 *   Detected → AI Drafted → Under Review → Management Response →
 *   Accepted → Resolved → Closed
 *
 * Layout (Issue #41 — Findings Layout): one full-height three-column Workbench,
 * composed from the shared `AuditOS.presentation.workbench` the Controls,
 * Testing, and Reporting workspaces already use — never a second layout.
 *
 *   Left    Observation Register  — every observation, four regroupings
 *   Middle  Observation Details   — the full record, field by field
 *   Right   AI Suggestions · History · Propagation · Approvals
 *
 * Pending work lives here now that the standalone Work Queue is gone (Issue
 * #41): the observations awaiting a management response are surfaced in this
 * workspace, by the workspace that owns them.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to every
 * other operational workspace. `collectViewModel` is the single place this
 * workspace reads `AuditOS.state`; it returns a declarative model of pure,
 * offline-testable derivations. The renderer configures the Shared Workspace
 * Framework's inherited skeleton and fills its slots with compositions from the
 * Enterprise Data Presentation System — no bespoke primitives, no duplicated
 * components (Component Design Patterns §81.4 — Composition Over Duplication).
 *
 * Findings are read through the same engagement-scoped document pattern as
 * controls, evidence, and testing (`findDatasetsForEngagement` / `getDocument`).
 * Every read normalizes across the demo shapes and fabricates nothing where a
 * field is absent. An observation's related control resolves to a real name only
 * when its `libraryControlId` joins the shared control library (or its
 * `controlId` joins the engagement control set); its domain resolves to the
 * library control's family; its owner resolves to a real person only when
 * `ownerPocId` joins the points-of-contact directory; its related test resolves
 * to the procedure the `testId` joins; and its linked report sections resolve
 * only where `reportSection` names a section the engagement's report declares.
 * Any identifier that joins nothing renders as its raw value — never a
 * fabricated label. Where the JSON records no root cause, no comments, and no
 * approval history, those fields render reserved placeholders rather than an
 * invented conclusion.
 *
 * Release 1 renders only the current observation state. The Release 2 seams are
 * opened, not implemented: AI-drafted observations, identified duplicates,
 * recommended severity and root causes, and suggested remediation all enter
 * through the canonical Suggestion Lifecycle Service, so AI stays advisory and
 * human approval stays mandatory.
 *
 * Presentation only. Every business value is read through `AuditOS.state`;
 * nothing about an observation is written here. The right rail's suggestion
 * actions go through the canonical Suggestion Lifecycle Service, which performs
 * the audited Repository write.
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
   * Observation severity vocabulary → tone (read, never invented). The demo data
   * uses "High", "Medium", and "Low"; the vocabulary also covers "Critical" so
   * future data (including AI-recommended severities) reads through the same
   * token-backed tones. An unmapped severity resolves to a neutral info tone.
   */
  var SEVERITY_TONES = {
    'Critical': TONES.ERROR,
    'High': TONES.ERROR,
    'Medium': TONES.WARNING,
    'Low': TONES.INFO,
    'Informational': TONES.INFO
  };

  /**
   * The Observation lifecycle (Issue #41 — Observation Lifecycle), in order.
   * An observation advances through these states; the register renders the
   * state each record actually records and never advances one on its behalf.
   */
  var OBSERVATION_LIFECYCLE = [
    'Detected',
    'AI Drafted',
    'Under Review',
    'Management Response',
    'Accepted',
    'Resolved',
    'Closed'
  ];

  /**
   * Observation status vocabulary → tone (read, never invented). Covers the
   * seven lifecycle states plus the operational statuses the current demo
   * datasets record ("Open", "In Remediation", "Accepted Risk"), so both a
   * lifecycle-aware record and today's data read through one tone map. An
   * unmapped status resolves to a neutral info tone.
   */
  var STATUS_TONES = {
    'Detected': TONES.WARNING,
    'AI Drafted': TONES.INFO,
    'Under Review': TONES.INFO,
    'Management Response': TONES.WARNING,
    'Accepted': TONES.INFO,
    'Resolved': TONES.SUCCESS,
    'Closed': TONES.SUCCESS,
    'Open': TONES.WARNING,
    'In Remediation': TONES.WARNING,
    'Accepted Risk': TONES.INFO
  };

  /**
   * Canonical order for the Observation Health strip so its status indicators
   * read in a stable operational sequence regardless of which statuses the data
   * contains: the lifecycle first, then the legacy operational statuses.
   * Statuses outside this list sort after it, alphabetically.
   */
  var STATUS_ORDER = OBSERVATION_LIFECYCLE.concat(['Open', 'In Remediation', 'Accepted Risk']);

  /**
   * Canonical severity order (most severe first) so the health strip and the
   * By-severity view read consistently. Severities outside this list sort after
   * it, alphabetically.
   */
  var SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Informational'];

  /**
   * The statuses that mean the observation is waiting on the client's
   * management response — the pending work this workspace owns now that the
   * standalone Work Queue is gone (Issue #41).
   */
  var AWAITING_RESPONSE_STATUSES = ['Detected', 'AI Drafted', 'Under Review', 'Management Response', 'Open'];

  /** The four presentation modes over the one observation register. */
  var VIEWS = { FINDING: 'finding', SEVERITY: 'severity', DOMAIN: 'domain', OWNER: 'owner' };

  /** Maximum entries per supporting list so panels stay scannable. */
  var LIST_LIMIT = WS.LIST_LIMIT;

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

  /** The current engagement: identical rule to every other workspace. */
  var deriveCurrentEngagement = WS.deriveCurrentEngagement;

  /** Resolves an observation severity to a presentation tone (neutral when unmapped). */
  function resolveSeverityTone(severity) {
    return Object.prototype.hasOwnProperty.call(SEVERITY_TONES, severity) ? SEVERITY_TONES[severity] : TONES.INFO;
  }

  /** Resolves an observation status to a presentation tone (neutral when unmapped). */
  function resolveStatusTone(status) {
    return Object.prototype.hasOwnProperty.call(STATUS_TONES, status) ? STATUS_TONES[status] : TONES.INFO;
  }

  /**
   * The observation lifecycle rendered as an ordered rail: every state, marked
   * reached / current / ahead against the state the record actually records. A
   * status outside the lifecycle (today's "Open", "In Remediation", "Accepted
   * Risk") leaves every stage unreached rather than being mapped onto a stage
   * the record never claimed — the register shows what is recorded, and says
   * plainly when the recorded status predates the lifecycle.
   */
  function deriveObservationLifecycle(finding) {
    var status = (finding && finding.status) || '';
    var index = OBSERVATION_LIFECYCLE.indexOf(status);
    return OBSERVATION_LIFECYCLE.map(function (stage, position) {
      return {
        label: stage,
        reached: index !== -1 && position < index,
        current: index !== -1 && position === index,
        tone: index !== -1 && position <= index ? resolveStatusTone(stage) : null
      };
    });
  }

  /** Whether an observation is still awaiting the client's management response. */
  function isAwaitingResponse(finding) {
    var source = finding || {};
    if (source.managementResponse) {
      return false;
    }
    return AWAITING_RESPONSE_STATUSES.indexOf(String(source.status || '')) !== -1;
  }

  /**
   * Whether an observation is approved for the report — the lifecycle states
   * past management response, plus the `reportable` flag the current datasets
   * carry. Read, never inferred.
   */
  function isApprovedObservation(finding) {
    var source = finding || {};
    var status = String(source.status || '');
    return Boolean(source.reportable) ||
      status === 'Accepted' || status === 'Resolved' || status === 'Closed';
  }

  /**
   * The control an observation relates to, resolved only where an identifier
   * genuinely joins: the shared control library by `libraryControlId` first (the
   * master definition every engagement references), then the engagement control
   * set by `controlId`. An observation whose identifiers join neither renders its
   * raw `controlId` with no title — never a fabricated control. Returns
   * `{ id, code, title, familyId, category }`.
   */
  function resolveRelatedControl(finding, context) {
    return RE.resolveControlRef(finding, context);
  }

  /** A compact related-control label — code + title where they resolve, else the raw identifier. */
  function relatedControlLabel(related) {
    return RE.controlRefLabel(related);
  }

  /**
   * The audit domain an observation sits in, resolved only where the
   * relationship genuinely joins: the related library control's family
   * (Governance, Identity & Access Management, …), or the engagement control's
   * category. An observation whose control joins neither, or whose family is
   * unregistered, reads no domain — never a fabricated grouping.
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
   * The owner of an observation, resolved to a real person only where
   * `ownerPocId` joins the points-of-contact directory. An observation whose
   * owner does not join renders the raw identifier — never a fabricated name.
   * Returns `{ id, name, designation }`.
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
   * The test an observation was raised from, resolved to its procedure only
   * where `testId` joins the engagement testing set. An observation whose test
   * does not join renders the raw identifier — never a fabricated procedure.
   * Returns `{ id, title }`.
   */
  function resolveRelatedTest(finding, context) {
    var ctx = context || {};
    var id = finding && finding.testId ? finding.testId : '';
    var test = id && ctx.testsById ? ctx.testsById[id] : null;
    return { id: id, title: test && test.procedure ? test.procedure : '' };
  }

  /**
   * The requirements an observation connects to, drawn only through the
   * engagement control it joins (a control declares the requirements it
   * satisfies). An observation whose control does not join the engagement
   * control set yields an empty list and the reserved placeholder — never a
   * fabricated requirement link.
   */
  function resolveRelatedRequirements(finding, context) {
    var ctx = context || {};
    var eng = finding && finding.controlId && ctx.controlsById ? ctx.controlsById[finding.controlId] : null;
    return eng && Array.isArray(eng.requirementIds) ? eng.requirementIds.slice() : [];
  }

  /**
   * The report sections an observation is linked to (Issue #41 — Linked Report
   * Sections). An observation names its section through `reportSection` (or a
   * `reportSectionIds` array in a future shape); each identifier resolves to the
   * section's real name only where the engagement's report declares it, and
   * renders raw otherwise. An observation naming none yields an empty list.
   */
  function resolveLinkedReportSections(finding, context) {
    var source = finding || {};
    var ctx = context || {};
    var ids = asArray(source.reportSectionIds);
    if (ids.length === 0 && source.reportSection) {
      ids = [source.reportSection];
    }
    var sections = ctx.reportSectionsById || {};
    return ids.map(function (id) {
      var section = sections[id];
      return {
        id: id,
        title: section && section.name ? section.name : '',
        label: section && section.name ? id + ' · ' + section.name : id
      };
    });
  }

  /**
   * One Observation Register row, resolved to display fields. The related
   * control, domain, owner, and related test resolve to names where their
   * identifiers genuinely join and render the raw identifier otherwise. The
   * observation record is carried through for the details pane.
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
      reportable: Boolean(source.reportable),
      dueDate: source.targetClosureDate || '',
      awaitingResponse: isAwaitingResponse(source),
      approved: isApprovedObservation(source),
      reportSections: resolveLinkedReportSections(source, context)
    };
  }

  /**
   * The Observation Register — every observation rendered once, ordered by
   * identifier so the surface is stable. Nothing is capped or filtered: the
   * register is the full operational dataset the presentation views regroup.
   */
  function deriveQueue(findings, context) {
    return asArray(findings)
      .map(function (finding) { return deriveFindingRow(finding, context); })
      .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
  }

  /**
   * The Observation Health strip — one indicator per lifecycle status actually
   * present (labelled by the status, valued by its real count) in canonical
   * order, then one indicator per severity actually present (most severe first),
   * then the derived Awaiting response and Reportable indicators. Every value is
   * a real count of real records; an engagement with no observations yields a
   * single Observations / None indicator. Never a fabricated count.
   */
  function deriveFindingsHealth(findings) {
    var list = asArray(findings);
    if (list.length === 0) {
      return [{ key: 'findings', label: 'Observations', status: 'None', tone: TONES.SUCCESS }];
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

    var awaiting = list.filter(isAwaitingResponse).length;
    indicators.push({
      key: 'awaiting-response',
      label: 'Awaiting response',
      status: awaiting > 0 ? String(awaiting) : 'Clear',
      tone: awaiting > 0 ? TONES.WARNING : TONES.SUCCESS
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
   * Remediation progress — real counts only: closed observations over total, with
   * the open / accepted-risk / closed breakdown. No estimated percentage; the
   * ratio is a real measurement of the recorded observations, and an engagement
   * with none reads zero rather than a fabricated figure.
   */
  function deriveRemediation(findings) {
    var list = asArray(findings);
    var closed = list.filter(function (finding) { return finding && finding.status === 'Closed'; }).length;
    var acceptedRisk = list.filter(function (finding) { return finding && finding.status === 'Accepted Risk'; }).length;
    var open = list.length - closed - acceptedRisk;
    return { total: list.length, closed: closed, acceptedRisk: acceptedRisk, open: open };
  }

  /**
   * The overall observation status for the header badge: No observations when
   * there are none, Open observations when any is neither closed nor accepted,
   * Resolved once every one is closed or accepted. Derived from real status
   * counts; never a fabricated aggregate.
   */
  function deriveFindingsStatus(findings) {
    var remediation = deriveRemediation(findings);
    if (remediation.total === 0) {
      return { label: 'No observations', tone: null };
    }
    if (remediation.open > 0) {
      return { label: 'Open observations', tone: TONES.WARNING };
    }
    return { label: 'Resolved', tone: TONES.SUCCESS };
  }

  // ---- Presentation views — four regroupings of the one register dataset. Each
  // is pure and returns `{ groups: [{ label, rows }] }` from the same rows, so
  // changing the view changes presentation only and never the data.

  /** Register view — the flat register, a single unlabeled group. */
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

  /** By owner — the same rows grouped by observation owner, groups ordered by label. */
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
      { id: VIEWS.FINDING, label: 'Register', view: findingView(rows) },
      { id: VIEWS.SEVERITY, label: 'By severity', view: severityView(rows) },
      { id: VIEWS.DOMAIN, label: 'By domain', view: domainView(rows) },
      { id: VIEWS.OWNER, label: 'By owner', view: ownerView(rows) }
    ];
  }

  /** Whether a register row matches a free-text query (presentation-only filtering). */
  function matchesSearch(row, query) {
    var text = String(query || '').trim().toLowerCase();
    if (!text) {
      return true;
    }
    return [row.id, row.title, row.severity, row.status, row.ownerLabel, row.controlLabel, row.domain]
      .filter(Boolean).join(' ').toLowerCase().indexOf(text) !== -1;
  }

  /**
   * The Audit Lineage — Walkthrough → Control → Evidence → Testing → Observation
   * → Report, with Observation highlighted as the object this workspace owns.
   * Each node carries its real, current count for the engagement and a link into
   * its workspace; nodes with no data read "—" and never a fabricated figure.
   * Only the counts vary with the data; the chain is the audit methodology's
   * real shape.
   */
  function deriveLineage(workspaceRegistry, operational) {
    if (!workspaceRegistry) {
      return [];
    }
    var ops = operational || {};
    var controls = ops.controls || {};
    var evidence = ops.evidence || {};
    var testing = ops.testing || {};
    var findings = ops.findings || {};
    var walkthrough = ops.walkthrough || {};
    var report = ops.report || null;
    var ids = workspaceRegistry.IDS;

    var nodes = [
      { id: ids.WALKTHROUGH, label: 'Walkthrough', count: walkthrough.sessions || 0, present: (walkthrough.sessions || 0) > 0, hint: 'Knowledge acquisition' },
      { id: ids.CONTROLS, label: 'Control', count: controls.controls || 0, present: (controls.controls || 0) > 0, hint: 'What testing validates' },
      { id: ids.EVIDENCE, label: 'Evidence', count: evidence.evidenceItems || 0, present: (evidence.evidenceItems || 0) > 0, hint: 'What testing inspects' },
      { id: ids.TESTING, label: 'Testing', count: testing.tests || 0, present: (testing.tests || 0) > 0, hint: 'Where the observation is surfaced' },
      { id: ids.FINDINGS, label: 'Finding', count: findings.findings || 0, present: (findings.findings || 0) > 0, hint: 'The audit observation', highlighted: true },
      { id: ids.REPORTING, label: 'Report', count: report ? null : 0, present: Boolean(report), hint: report ? report.status : 'Not started' }
    ];

    return WS.resolveLineageNodes(workspaceRegistry, nodes);
  }

  /**
   * Related audit objects for the supporting panel: the domains observations
   * connect to, each with its real count, only when data exists. Reuses the same
   * chain the lineage draws from (the observation is the workspace's own object,
   * so it is not listed as a relation).
   */
  function deriveRelationships(workspaceRegistry, operational) {
    if (!workspaceRegistry) {
      return [];
    }
    var ops = operational || {};
    var controls = ops.controls || {};
    var evidence = ops.evidence || {};
    var testing = ops.testing || {};
    var report = ops.report || null;
    var ids = workspaceRegistry.IDS;

    var related = [
      { id: ids.TESTING, title: 'Testing', meta: String(testing.tests || 0), present: (testing.tests || 0) > 0 },
      { id: ids.CONTROLS, title: 'Controls', meta: String(controls.controls || 0), present: (controls.controls || 0) > 0 },
      { id: ids.EVIDENCE, title: 'Evidence', meta: String(evidence.evidenceItems || 0), present: (evidence.evidenceItems || 0) > 0 },
      { id: ids.REPORTING, title: 'Report', meta: report ? String(report.status) : '—', present: Boolean(report) }
    ];
    return WS.resolveRelationships(workspaceRegistry, related);
  }

  /**
   * Recent observation activity, newest first, drawn only from dated history the
   * observations carry (activity / history entries, or a recorded update
   * timestamp). Observations that record no dated events yield an empty feed and
   * the shared Empty State — never a fabricated event.
   */
  function deriveActivity(findings) {
    return RE.deriveActivityFromHistory(findings, {
      entityNoun: 'Observation',
      getSubject: function (record) { return record.id || ''; },
      resolveTone: resolveStatusTone,
      formatDate: formatDate,
      limit: LIST_LIMIT
    });
  }

  /**
   * Observation register metadata: created / modified / owner / version / tags /
   * source, derived from the findings document metadata, the engagement, and the
   * company. Only fields with real values are surfaced by the builder.
   */
  function deriveMetadata(findingsMetadata, engagement, company, findings) {
    return RE.deriveCollectionMetadata(findingsMetadata, engagement, company, findings, formatDate);
  }

  // ---- Inspector configuration — pure, host-agnostic (§9). Returns plain
  // Inspector Panel configuration; no DOM. Every field renders only when the
  // JSON records it; conclusions are never fabricated.

  /** One text-valued Inspector section rendered as a single placeholder-capable list row. */
  function textSection(title, text, placeholder) {
    return WS.textSection(title, text, placeholder);
  }

  /** One list-valued Inspector section; an empty list renders one placeholder row. */
  function listSection(title, items, placeholder) {
    return WS.listSection(title, items, placeholder);
  }

  /**
   * The prior-year and cross-framework knowledge an observation records, drawn
   * only from the reuse block it carries. An observation declaring neither yields
   * an empty array and the reserved placeholder — never a fabricated reuse claim.
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
   * The remediation facts an observation records, as read from the JSON: its
   * status, target closure date, and management response. Empty only when the
   * observation records none of these, in which case the reserved placeholder
   * renders — never an invented remediation plan.
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
   * The comments recorded against an observation (Issue #41 — Comments), read
   * only from a `comments` array the record carries. Nothing is fabricated: an
   * observation with no recorded comments yields an empty list.
   */
  function deriveComments(finding) {
    return asArray(finding && finding.comments).map(function (comment) {
      var source = comment || {};
      return {
        title: source.text || source.note || '',
        description: [source.author || source.by || '', formatDate(source.on || source.date || '')]
          .filter(Boolean).join(' · '),
        tone: TONES.INFO
      };
    }).filter(function (item) { return item.title; });
  }

  /**
   * The approval history recorded against an observation (Issue #41 — Approval
   * History), read through the shared normalizer so this workspace carries no
   * second history shape. An observation with no recorded history falls back to
   * its current status — a real, current fact, never a fabricated past.
   */
  function deriveApprovalHistory(finding) {
    return WS.deriveApprovalHistory(finding, resolveStatusTone);
  }

  /**
   * The Observation Inspector configuration for one observation (Master →
   * Detail detail pane). Renders identity, observation, root cause, risk,
   * recommendation, management response, linked controls, evidence, tests, and
   * report sections, remediation, prior-year knowledge, comments, and approval
   * history — a placeholder row wherever the JSON lacks data, and never a
   * fabricated conclusion. Pure and host-agnostic: data in, one plain
   * configuration out.
   */
  function buildFindingInspector(finding, context) {
    var item = finding || {};
    var ctx = context || {};
    var ids = ctx.workspaceRegistry ? ctx.workspaceRegistry.IDS : {};
    // Issue #31 — Cross-Workspace Record Navigation: the related requirements
    // are read through the shared relationship engine (Issue #30's
    // `getFindingGraph`), resolving each to its real title through the
    // observation's control rather than rendering the raw requirement id.
    var graph = RE.getFindingGraph(item, ctx);
    var related = resolveRelatedControl(item, ctx);
    var owner = resolveOwner(item, ctx);
    var domain = resolveDomain(item, ctx);
    var test = resolveRelatedTest(item, ctx);
    var reportSections = resolveLinkedReportSections(item, ctx);
    var priorYear = derivePriorYearItems(item);
    var comments = deriveComments(item);
    var approvals = deriveApprovalHistory(item);
    var controlHref = related.id ? WS.buildRecordHref(ctx.workspaceRegistry, ids.CONTROLS, related.id) : null;
    var testHref = test.id ? WS.buildRecordHref(ctx.workspaceRegistry, ids.TESTING, test.id) : null;

    return {
      eyebrow: relatedControlLabel(related) || 'Audit observation',
      title: item.title || item.id || '',
      subtitle: [item.id, item.status].filter(Boolean).join(' · '),
      badges: [
        item.severity ? { label: item.severity, tone: resolveSeverityTone(item.severity) } : null,
        item.status ? { label: item.status, tone: resolveStatusTone(item.status) } : null,
        item.reportable ? { label: 'Reportable', tone: TONES.WARNING } : null,
        isAwaitingResponse(item) ? { label: 'Awaiting management response', tone: TONES.WARNING } : null
      ].filter(Boolean),
      sections: [
        {
          title: 'Properties', kind: 'properties', columns: 2,
          rows: [
            { label: 'Observation id', value: item.id || '' },
            { label: 'Severity', value: item.severity || '' },
            { label: 'Status', value: item.status || '' },
            { label: 'Owner', value: ownerLabel(owner) },
            { label: 'Owner role', value: owner.designation || '' },
            { label: 'Domain', value: domain },
            { label: 'Linked control', value: relatedControlLabel(related) },
            { label: 'Linked test', value: test.id || '' },
            { label: 'Linked evidence', value: item.workingPaperId || '' },
            { label: 'Due date', value: formatDate(item.targetClosureDate) },
            { label: 'Reportable', value: item.reportable ? 'Yes' : 'No' },
            { label: 'Framework', value: item.framework || '' },
            { label: 'Annex A section', value: item.annexASection || '' },
            { label: 'Prior-year finding', value: item.linkedPriorYearFindingId || '' }
          ].filter(function (row) { return row.value; })
        },
        textSection('Observation', item.observation, 'No observation recorded. Release 2 adds AI-drafted observations for human approval.'),
        textSection('Root cause', item.rootCause, 'No root cause recorded. Release 2 adds AI-recommended root causes for human approval.'),
        textSection('Risk', item.risk, 'No risk recorded for this observation. Release 2 adds AI-assessed risk for human approval.'),
        textSection('Recommendation', item.recommendation, 'No recommendation recorded. Release 2 adds AI-suggested remediation for human approval.'),
        textSection('Management response', item.managementResponse,
          'No management response recorded. This observation is still awaiting the client’s response.'),
        listSection('Linked controls',
          related.id ? [{ title: relatedControlLabel(related), tone: TONES.INFO, actions: controlHref ? [{ label: 'Open', href: controlHref }] : [] }] : [],
          'No linked control recorded for this observation.'),
        listSection('Linked evidence',
          item.workingPaperId ? [{ title: 'Working paper: ' + item.workingPaperId, tone: TONES.INFO }] : [],
          'No linked evidence recorded for this observation.'),
        listSection('Linked tests',
          test.id ? [{ title: (test.title ? test.title + ' · ' : '') + test.id, tone: TONES.INFO, actions: testHref ? [{ label: 'Open', href: testHref }] : [] }] : [],
          'No linked test recorded for this observation.'),
        listSection('Linked report sections',
          reportSections.map(function (section) {
            var href = WS.buildRecordHref(ctx.workspaceRegistry, ids.REPORTING, section.id);
            return { title: section.label, tone: TONES.INFO, actions: href ? [{ label: 'Open', href: href }] : [] };
          }),
          'No report section linked to this observation.'),
        listSection('Linked requirements',
          asArray(graph.requirements).map(function (requirement) {
            return { title: requirement.title || requirement.id, tone: TONES.INFO };
          }),
          'No requirement reaches this observation through its control.'),
        listSection('Remediation', deriveRemediationItems(item),
          'No remediation recorded for this observation. Release 2 adds AI-suggested remediation for human approval.'),
        priorYear.length > 0
          ? { title: 'Prior-year knowledge', kind: 'list', items: priorYear }
          : {
            title: 'Prior-year knowledge', kind: 'placeholder',
            empty: {
              icon: '◇', title: 'No prior-year knowledge recorded',
              description: 'Release 1 renders reuse only when the JSON records it. Release 2 adds AI-identified duplicate observations and prior-year links here.'
            }
          },
        comments.length > 0
          ? { title: 'Comments', kind: 'list', items: comments }
          : {
            title: 'Comments', kind: 'placeholder',
            empty: {
              icon: '◇', title: 'No comments recorded',
              description: 'Comments recorded against this observation appear here. Release 1 renders only what the register records.'
            }
          },
        approvals.length > 0
          ? { title: 'Approval history', kind: 'list', items: approvals }
          : {
            title: 'Approval history', kind: 'placeholder',
            empty: {
              icon: '◇', title: 'No approval history recorded',
              description: 'Release 2 routes every AI-drafted observation, severity, root cause, and remediation through human approval and records it here.'
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
   * Collects everything the Observation Register presents from the Shared Audit
   * State. Returns null while the state is not ready, and a degraded model when
   * no engagement exists (§15.12).
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
    var libraryDocument = state.getDocument('control-library') || {};
    var libraryControlsById = indexById(state.listRecords('control-library'));
    var controlFamiliesById = indexById(libraryDocument.controlFamilies);

    var findingsDocument = readEngagementDocument(state, 'findings', engagement.id) || {};
    var controlsDocument = readEngagementDocument(state, 'controls', engagement.id) || {};
    var requirementsDocument = readEngagementDocument(state, 'evidence-requirements', engagement.id) || {};
    var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
    var testingDocument = readEngagementDocument(state, 'testing', engagement.id) || {};
    var walkthroughDocument = readEngagementDocument(state, 'walkthroughs', engagement.id) || {};
    var reportsDocument = readEngagementDocument(state, 'reports', engagement.id) || {};

    var findingRecords = asArray(findingsDocument.findings);
    var controlsById = indexById(controlsDocument.controls);
    var requirementsById = indexById(requirementsDocument.requirements);
    var testsById = indexById(testingDocument.tests);
    var pocsById = indexById(state.listRecords('pocs'));
    var reportSectionsById = indexById(reportsDocument.sections);

    var frameworks = normalizeFrameworks(engagement);
    var auditPeriodLabel = formatPeriod(engagement.auditPeriod);

    var context = {
      controlsById: controlsById,
      libraryControlsById: libraryControlsById,
      controlFamiliesById: controlFamiliesById,
      requirementsById: requirementsById,
      testsById: testsById,
      pocsById: pocsById,
      reportSectionsById: reportSectionsById,
      workspaceRegistry: workspaceRegistry,
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
      walkthrough: { sessions: asArray(walkthroughDocument.sessions).length },
      findings: { findings: findingRecords.length },
      report: reportsDocument.document || null
    };

    var queue = deriveQueue(findingRecords, context);
    var findingsStatus = deriveFindingsStatus(findingRecords);
    var remediation = deriveRemediation(findingRecords);

    // Pending work lives inside the workspace that owns it (Issue #41): the
    // observations still awaiting a management response, surfaced here rather
    // than in a standalone queue.
    var awaitingResponse = queue.filter(function (row) { return row.awaitingResponse; });

    var repository = AuditOS.repository;
    var suggestionService = AuditOS.suggestionService;
    var suggestions = repository && suggestionService
      ? suggestionService.list(repository, engagement.id) : [];

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
        meta: engagement.name + ' · observation register',
        frameworks: frameworks,
        status: findingsStatus,
        lastUpdated: findingsDocument.metadata && findingsDocument.metadata.generatedAt
          ? 'Updated ' + formatDate(String(findingsDocument.metadata.generatedAt).slice(0, 10))
          : '',
        actions: []
      },

      ribbon: [
        { label: 'Client', value: company ? company.name : engagement.companyId },
        { label: 'Audit period', value: auditPeriodLabel },
        { label: 'Observations', value: String(findingRecords.length) },
        { label: 'Awaiting response', value: String(awaitingResponse.length) }
      ],

      toolbar: { search: { placeholder: 'Search observations' } },
      filterBar: {
        dropdowns: [{ label: 'Framework', options: ['All frameworks'].concat(frameworks) }]
      },

      findingsHealth: deriveFindingsHealth(findingRecords),
      remediation: remediation,
      queue: queue,
      awaitingResponse: awaitingResponse,
      suggestions: suggestions,
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
  var el = WS.el;

  /** The shared presentation system, resolved at render time. */
  var presentation = WS.presentation;

  /** Builds the Observation Health strip (identical composition to every operational workspace). */
  function buildHealthStrip(items) {
    return WS.buildHealthStrip('aos-findings', 'Observation health', items);
  }

  /** Builds one titled pane block: a fixed structural heading above its body. */
  function paneBlock(title, body) {
    var block = el('section', 'aos-findings__block');
    block.appendChild(el('h3', 'aos-findings__block-title', title));
    block.appendChild(body);
    return block;
  }

  /**
   * Builds the Remediation Status body: the shared Progress meter over real
   * counts (closed of total), with a breakdown line of the open / accepted-risk /
   * closed figures. No estimated percentage — the ratio is a real measurement.
   */
  function buildRemediationBody(remediation) {
    var P = presentation();
    var wrap = el('div', 'aos-findings__remediation');
    wrap.appendChild(P.progressMeter({
      label: 'Observations closed', value: remediation.closed, total: remediation.total, tone: TONES.INFO
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

  /** Builds one Observation Register row: title + observation id, status, and operational meta. */
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
    if (row.dueDate) {
      meta.appendChild(el('span', 'aos-findings__row-due', 'Due ' + formatDate(row.dueDate)));
    }
    if (row.awaitingResponse) {
      meta.appendChild(el('span', 'aos-findings__row-flag', 'Awaiting response'));
    }
    node.appendChild(meta);
    return node;
  }

  /**
   * Renders a set of grouped rows into a master list node and wires selection.
   * Clears the list first, so the same node re-renders when the presentation view
   * changes — the mechanism behind the four views over one dataset.
   */
  function mountRailGroups(listNode, detailMount, groups, context, targetId, onSelect) {
    return WS.mountRailGroups('aos-findings', listNode, detailMount, groups, context,
      buildRow, buildFindingInspector, 'finding', targetId, onSelect);
  }

  /** Builds the Audit Lineage body: the methodology chain with the observation highlighted. */
  function buildLineageBody(lineage) {
    return WS.buildLineageBody('aos-findings', lineage);
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

  /** Builds the Related information body: related audit objects with navigation. */
  function buildRelatedBody(relationships) {
    return WS.buildRelatedBody(relationships, {
      icon: '◇', title: 'No related objects',
      description: 'The audit domains observations connect to appear here once they hold data.'
    });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    return WS.buildFooterItems('aos-findings', entries);
  }

  /**
   * Host-agnostic Inspector renderer (§9): given the observation register and the
   * resolution context, returns one self-contained Master–Detail node — the
   * register rail beside the Observation Inspector — making no assumption about
   * where it is mounted. The workspace mounts the fuller three-pane Workbench;
   * this renderer exposes the same master → detail interaction for any other host
   * with no change here.
   */
  function renderInspector(queue, context) {
    var detailMount = el('div', 'aos-findings__detail-mount');
    var listNode = el('div', 'aos-findings__row-list');
    listNode.setAttribute('role', 'list');
    mountRailGroups(listNode, detailMount, [{ label: '', rows: queue }], context);
    return presentation().masterDetail({
      list: listNode, detail: detailMount, ratio: 42,
      listLabel: 'Observation register', detailLabel: 'Observation inspector'
    });
  }

  // ------------------------------------------------------------------
  // Three-pane Workbench (Issue #41 — Findings Layout). The state is
  // memory-only: which observation is selected, which presentation view is
  // active, and the rail's search query. Nothing here is business data and
  // nothing is written back to the Repository.
  // ------------------------------------------------------------------

  var boardState = { findingId: '', view: 0, search: '', lastTargetId: '' };

  /**
   * Builds the left pane: the Observation Register. Search and the four view
   * chips are built once and never rebuilt, so typing never loses focus; only the
   * list node is re-rendered, and only the two right-hand panes change on
   * selection, so the rail's scroll position is preserved.
   */
  function buildRegisterRail(viewModel, targetId, onSelect) {
    var P = presentation();
    var context = viewModel.context;
    var rail = el('div', 'aos-findings__rail');

    var searchLabel = el('label', 'aos-findings__search');
    searchLabel.appendChild(el('span', 'aos-findings__search-label', 'Search'));
    var searchInput = el('input', 'aos-findings__search-input');
    searchInput.type = 'search';
    searchInput.value = boardState.search;
    searchInput.setAttribute('placeholder', 'Id, title, severity, status, or owner');
    searchInput.setAttribute('aria-label', 'Search observations');
    searchLabel.appendChild(searchInput);
    rail.appendChild(searchLabel);

    var switcher = el('div', 'aos-findings__views');
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Observation views');
    var chips = [];

    var listNode = el('div', 'aos-findings__row-list');
    listNode.setAttribute('role', 'list');
    var countLabel = el('p', 'aos-findings__rail-count');

    /**
     * Re-renders the list for the active view and query. The rows are the same
     * dataset regrouped and filtered for display — no observation is added,
     * removed, or mutated.
     */
    function render(preferredId) {
      var view = viewModel.views[boardState.view] || viewModel.views[0];
      var groups = asArray(view && view.view.groups).map(function (group) {
        return {
          label: group.label,
          rows: group.rows.filter(function (row) { return matchesSearch(row, boardState.search); })
        };
      }).filter(function (group) { return group.rows.length > 0; });

      var total = groups.reduce(function (sum, group) { return sum + group.rows.length; }, 0);
      countLabel.textContent = total === viewModel.queue.length
        ? total + ' observations'
        : total + ' of ' + viewModel.queue.length + ' observations';

      if (total === 0) {
        listNode.replaceChildren(P.emptyState({
          icon: '◇', title: 'No observation matches the search',
          description: 'Clear or change the query to see more of the register.'
        }));
        onSelect(null);
        return;
      }
      mountRailGroups(listNode, null, groups, context, preferredId, onSelect);
    }

    asArray(viewModel.views).forEach(function (view, index) {
      var chip = el('button', 'aos-findings__view-chip', view.label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', index === boardState.view ? 'true' : 'false');
      if (index === boardState.view) {
        chip.classList.add('aos-findings__view-chip--active');
      }
      chip.addEventListener('click', function () {
        boardState.view = index;
        chips.forEach(function (candidate, candidateIndex) {
          var selected = candidateIndex === index;
          candidate.classList.toggle('aos-findings__view-chip--active', selected);
          candidate.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        render(boardState.findingId);
      });
      chips.push(chip);
      switcher.appendChild(chip);
    });
    rail.appendChild(switcher);
    rail.appendChild(countLabel);
    rail.appendChild(listNode);

    // Filter on every keystroke: only the list is replaced, so the caret and
    // focus never move (the same contract every other rail keeps).
    searchInput.addEventListener('input', function () {
      boardState.search = searchInput.value;
      render(boardState.findingId);
    });

    render(targetId || boardState.findingId);
    return rail;
  }

  /**
   * Builds the observation lifecycle rail (Issue #41 — Observation Lifecycle):
   * Detected → AI Drafted → Under Review → Management Response → Accepted →
   * Resolved → Closed, with the recorded state marked. A record whose status
   * predates the lifecycle leaves every stage unreached and says so.
   */
  function buildLifecycleBody(finding) {
    var stages = deriveObservationLifecycle(finding);
    var wrap = el('div', 'aos-findings__lifecycle');
    var rail = el('ol', 'aos-findings__lifecycle-rail');
    rail.setAttribute('role', 'list');
    stages.forEach(function (stage) {
      var step = el('li', 'aos-findings__lifecycle-step' +
        (stage.current ? ' aos-findings__lifecycle-step--current' : '') +
        (stage.reached ? ' aos-findings__lifecycle-step--reached' : ''));
      step.setAttribute('role', 'listitem');
      step.appendChild(el('span', 'aos-findings__lifecycle-label', stage.label));
      rail.appendChild(step);
    });
    wrap.appendChild(rail);
    if (!stages.some(function (stage) { return stage.current; })) {
      wrap.appendChild(el('p', 'aos-findings__note',
        'This observation records the status "' + ((finding && finding.status) || 'none') +
        '", which predates the observation lifecycle. Release 1 renders the recorded status rather than mapping it onto a stage the record never claimed.'));
    }
    return wrap;
  }

  /**
   * Builds the middle pane: the selected observation in full (§ Observation
   * Details). The observation's own Inspector configuration supplies every
   * field — one definition, rendered here — with the lifecycle rail above it.
   */
  function buildObservationCanvas(finding, context) {
    var P = presentation();
    var canvas = el('div', 'aos-findings__canvas');
    if (!finding) {
      canvas.appendChild(P.emptyState({
        icon: '◇', title: 'No observation selected',
        description: 'Select an observation from the register to open it here.'
      }));
      return canvas;
    }
    canvas.appendChild(paneBlock('Observation lifecycle', buildLifecycleBody(finding)));
    canvas.appendChild(P.inspectorPanel(buildFindingInspector(finding, context)));
    return canvas;
  }

  /**
   * Builds the right pane: AI suggestions in flight, the observation's recorded
   * history, the propagation chain it participates in, and the approvals it
   * awaits (Issue #41 — Findings Layout, right column).
   */
  function buildOperationalInspector(finding, viewModel) {
    var P = presentation();
    var pane = el('div', 'aos-findings__operational');

    // --- AI suggestions: rendered through the one Suggestion card of the
    // platform, never a second workflow.
    var suggestions = asArray(viewModel.suggestions).filter(function (suggestion) {
      return finding
        ? asArray(suggestion.affectedControls).indexOf(finding.controlId) !== -1
        : false;
    });
    var suggestionBody;
    if (suggestions.length === 0) {
      suggestionBody = P.emptyState({
        icon: '✦', title: 'No suggestions in flight',
        description: 'Proposed changes to this observation enter the Suggested → Reviewed → Approved → Applied workflow and appear here. Release 2 adds AI-drafted observations, identified duplicates, recommended severity and root causes, and suggested remediation through the same path; AI stays advisory and human approval stays mandatory.'
      });
      suggestionBody.classList.add('aos-tint-brand');
    } else {
      suggestionBody = el('div', 'aos-findings__suggestions');
      suggestions.slice(0, LIST_LIMIT).forEach(function (suggestion) {
        suggestionBody.appendChild(WS.buildSuggestionWorkflowCard(suggestion, viewModel.engagement.id, resolveStatusTone));
      });
    }
    pane.appendChild(paneBlock('AI suggestions', suggestionBody));

    // --- History: the observation's own recorded activity, plus the immutable
    // audit events this session recorded against it.
    pane.appendChild(paneBlock('History', buildHistoryBody(finding)));

    // --- Propagation: the upstream and downstream objects an approved change to
    // this observation reaches. Read from the canonical report propagation
    // order so this workspace declares no second chain.
    pane.appendChild(paneBlock('Propagation', buildPropagationBody(finding, viewModel)));

    // --- Approvals: the observations awaiting a management response. Pending
    // work lives in the workspace that owns it now that the Work Queue is gone.
    pane.appendChild(paneBlock('Pending management response', viewModel.awaitingResponse.length > 0
      ? P.itemList(viewModel.awaitingResponse.slice(0, LIST_LIMIT).map(function (row) {
        return {
          title: row.title || row.id,
          description: [row.ownerLabel, row.dueDate ? 'Due ' + formatDate(row.dueDate) : '']
            .filter(Boolean).join(' · '),
          meta: row.status,
          tone: TONES.WARNING
        };
      }), { compact: true })
      : P.emptyState({
        icon: '◇', title: 'No management response outstanding',
        description: 'Observations waiting on the client’s response appear here, in the workspace that owns them.'
      })));

    // --- Related information: the audit domains the register connects to.
    pane.appendChild(paneBlock('Related information', buildRelatedBody(viewModel.relationships)));

    // --- Register metadata: the recorded provenance of the register itself.
    pane.appendChild(paneBlock('Register metadata', buildMetadataBody(viewModel.metadata)));

    return pane;
  }

  /** Builds the observation history body from recorded history and the audit log. */
  function buildHistoryBody(finding) {
    var P = presentation();
    if (!finding) {
      return P.emptyState({
        icon: '◇', title: 'Nothing selected',
        description: 'The recorded history of the selected observation appears here.'
      });
    }
    var recorded = deriveActivity([finding]);
    var auditService = AuditOS.auditService;
    var events = auditService ? auditService.listForEntity(finding.id, 'findings') : [];
    if (recorded.length === 0 && events.length === 0) {
      return P.emptyState({
        icon: '◇', title: 'No history recorded',
        description: 'Every recorded change to this observation appears here with who, when, and why. Release 1 renders only what the register records.'
      });
    }
    return P.activityFeed({
      groups: [
        { label: 'Recorded', events: recorded },
        {
          label: 'Audited this session',
          events: events.slice(0, LIST_LIMIT).map(function (event) {
            return {
              title: event.action || '',
              description: [event.user, event.reason, event.comment].filter(Boolean).join(' · '),
              timestamp: String(event.timestamp || '').replace('T', ' ').slice(0, 16)
            };
          })
        }
      ].filter(function (group) { return group.events.length > 0; })
    });
  }

  /**
   * Builds the propagation body: the objects an approved change to this
   * observation reaches, read from the canonical Report Propagation Service's
   * own order so no second chain is declared here. Each target links into the
   * workspace that owns it.
   */
  function buildPropagationBody(finding, viewModel) {
    var P = presentation();
    var service = AuditOS.reportPropagationService;
    var registry = viewModel.context.workspaceRegistry;
    if (!service || !finding) {
      return P.emptyState({
        icon: '◇', title: 'Nothing selected',
        description: 'The objects an approved change to the selected observation reaches appear here.'
      });
    }
    var targets = asArray(service.PROPAGATION_TARGETS).filter(function (target) {
      return target.domain !== 'findings';
    });
    return P.itemList(targets.map(function (target) {
      var workspace = registry ? registry.findById(target.workspaceId) : null;
      var href = workspace ? WS.workspacePathHref(workspace.path) : null;
      return {
        title: target.label,
        description: 'An approved change to this observation raises a suggestion against ' +
          target.label.toLowerCase() + '.',
        tone: TONES.INFO,
        actions: href ? [{ label: 'Open', href: href }] : []
      };
    }), { compact: true });
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /**
   * Hides the framework's supporting-panel band for this workspace: the
   * Workbench's own right pane IS the supporting information, so the band below
   * would duplicate it and push the application below the fold.
   */
  function collapseSupportingRegions(view) {
    var panels = view.querySelector('[data-region="supporting-panels"]');
    if (panels) {
      panels.hidden = true;
    }
  }

  /**
   * Renders the ready observation-register experience: the fixed-frame viewport
   * shell hosting one Workbench — observation register, observation details,
   * operational inspector — with the observation health strip, the remediation
   * meter, and the audit lineage in the compact context band above it.
   */
  function renderReady(view, viewModel) {
    var P = presentation();
    var router = AuditOS.router;
    var targetId = router && router.getCurrentRecordId ? router.getCurrentRecordId() : '';

    AuditOS.workspaceFramework.configure(view, {
      shell: 'viewport',
      header: viewModel.header,
      contextSummary: viewModel.ribbon
    });
    collapseSupportingRegions(view);

    var canvas = el('div', 'aos-findings');
    canvas.setAttribute('data-canvas', 'flush');

    // The compact context band: observation health beside the audit chain. Both
    // are single rows, so the operational panes below keep the viewport.
    var band = el('div', 'aos-findings__band');
    var health = buildHealthStrip(viewModel.findingsHealth);
    health.classList.add('aos-findings__health');
    band.appendChild(health);
    if (viewModel.remediation.total > 0) {
      band.appendChild(buildRemediationBody(viewModel.remediation));
    }
    if (viewModel.lineage.length > 0) {
      band.appendChild(buildLineageBody(viewModel.lineage));
    }
    canvas.appendChild(band);

    var canvasMount = el('div', 'aos-findings__canvas-mount');
    var inspectorMount = el('div', 'aos-findings__inspector-mount');

    function selectFinding(finding) {
      boardState.findingId = finding && finding.id ? finding.id : '';
      canvasMount.replaceChildren(buildObservationCanvas(finding, viewModel.context));
      inspectorMount.replaceChildren(buildOperationalInspector(finding, viewModel));
    }

    // A record-level deep link selects that observation once per navigation;
    // after that the user's own selection stands, so a state refresh never yanks
    // the pane back to the routed record.
    var preferredId = targetId && targetId !== boardState.lastTargetId ? targetId : boardState.findingId;
    boardState.lastTargetId = targetId;

    var workbench = P.workbench({
      rail: viewModel.queue.length > 0
        ? buildRegisterRail(viewModel, preferredId, selectFinding)
        : P.emptyState({
          icon: '◇', title: 'No observations yet',
          description: 'Observations appear here as testing surfaces them for the engagement. Release 2 adds AI-drafted observations, recommended severities, root causes, and proposed remediation; Release 1 renders only the current register.'
        }),
      canvas: canvasMount,
      inspector: inspectorMount,
      railRatio: 24,
      inspectorRatio: 26,
      railLabel: 'Observation register',
      canvasLabel: 'Observation details',
      inspectorLabel: 'Operational inspector'
    });
    workbench.classList.add('aos-rise-in');
    canvas.appendChild(workbench);

    if (viewModel.queue.length === 0) {
      selectFinding(null);
    }

    fillSlot(view, SLOTS.CONTENT, [canvas]);
    fillSlot(view, SLOTS.FOOTER, [buildFooterItems(viewModel.footer)]);
  }

  /** Renders the layout-stable loading state (§15.12 — Loading). */
  function renderLoading(view) {
    var P = presentation();
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'detail', label: 'Loading the observation register' })]);
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

  AuditOS.findingsWorkspace = {
    SLOTS: SLOTS,
    OBSERVATION_LIFECYCLE: OBSERVATION_LIFECYCLE,

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
      resolveLinkedReportSections: resolveLinkedReportSections,
      deriveObservationLifecycle: deriveObservationLifecycle,
      isAwaitingResponse: isAwaitingResponse,
      isApprovedObservation: isApprovedObservation,
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
      matchesSearch: matchesSearch,
      deriveLineage: deriveLineage,
      deriveRelationships: deriveRelationships,
      deriveActivity: deriveActivity,
      deriveMetadata: deriveMetadata,
      derivePriorYearItems: derivePriorYearItems,
      deriveRemediationItems: deriveRemediationItems,
      deriveComments: deriveComments,
      deriveApprovalHistory: deriveApprovalHistory,
      buildFindingInspector: buildFindingInspector
    },

    collectViewModel: collectViewModel,

    // Host-agnostic Inspector renderer (§9): data → one self-contained node,
    // mountable in any host. The workspace mounts the fuller three-pane
    // Workbench in primary content.
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
