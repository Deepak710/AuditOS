/**
 * AuditOS Controls Workspace
 * Workspaces and Navigation — Chapter 12 / Workspace Architecture — Chapter 61 /
 * Audit Lifecycle — Chapter 11 / Component Architecture — Chapter 74
 *
 * The operational workspace where auditors visualize the evolving control
 * library for an engagement (GitHub Issue #23). Controls are living audit
 * knowledge: initially drafted from engagement scope, framework requirements,
 * service commitments, system requirements, and prior organizational knowledge,
 * they continuously evolve as walkthroughs and evidence deepen the team's
 * understanding of how the organization satisfies its audit objectives. Release
 * 1 is a faithful visualization of the current control JSON — no AI, no writes,
 * no workflow engine. In Release 2 AI agents will draft, refine, deduplicate,
 * retire, and propose controls, update mappings, and draft test procedures; this
 * workspace opens that seam without implementing it, rendering only the current
 * control state and never fabricating a mapping, a relationship, or a history.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to the
 * Engagement, Walkthrough, Evidence, and Requirements workspaces.
 * `collectViewModel` is the single place this workspace reads `AuditOS.state`; it
 * returns a declarative model of pure, offline-testable derivations. The renderer
 * configures the Shared Workspace Framework's inherited skeleton
 * (`AuditOS.workspaceFramework.configure`) and fills its slots with compositions
 * from the Enterprise Data Presentation System (`AuditOS.presentation`) — no
 * bespoke primitives, no duplicated components (Component Design Patterns §81.4 —
 * Composition Over Duplication).
 *
 * Controls are read through the same engagement-scoped document pattern as
 * requirements, evidence, testing, and findings (`findDatasetsForEngagement` /
 * `getDocument`). The demo datasets carry two control shapes: a SOC 2 shape
 * (`evidenceReuse`, `testingStrategy`, `sampleSize`, `reportSection`) and an ISO
 * 27001 shape (`annexAControl`, `implementationStatus`, `riskRating`,
 * `knowledgeReuse`). Every read normalizes across both and fabricates nothing
 * where a field is absent; owner, team, business unit, requirement, and evidence
 * identifiers resolve to names only when they genuinely join, and render as their
 * raw identifier otherwise (never a fabricated label). Per-control framework
 * mappings are drawn only from what a control actually declares (SOC 2 criteria,
 * an ISO Annex A reference) and fall back to the engagement framework — never a
 * fabricated cross-framework join. This keeps the workspace faithful across the
 * mixed datasets while opening the Release 2 seams (AI control refinement,
 * immutable version history).
 *
 * The Control Library is the primary operational surface. It renders every
 * control once and offers three presentation modes over that single dataset —
 * Control view, By family, and By coverage — each a pure regrouping of the same
 * rows. Changing the view changes presentation only; no control is added,
 * removed, or mutated. Selecting a row opens the Control Inspector beside it. The
 * inspector renderer is host-agnostic (data in, one self-contained node out) so a
 * later release can mount it in a dedicated region with no change here, and it
 * exposes framework mappings, a test-procedure preview, related audit objects,
 * and immutable history only when the JSON records them, never fabricating a
 * relationship or a past state.
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
   * Control operational-status vocabulary → tone (read, never invented). The
   * production dataset's `status` mirrors the shared testingStatus vocabulary
   * (enums.json) — "Not Started", "In Progress", "Completed", "Not
   * Applicable", "Data not received"; the vocabulary also covers the
   * document-lifecycle states a control moves through — Draft, Pending
   * Review, Active, Approved, Rejected, Retired — so a future or differently
   * sourced dataset (including AI-proposed states) reads through the same
   * token-backed tones. An unmapped status resolves to a neutral info tone.
   */
  var STATUS_TONES = {
    'Not Started': null,
    'Data not received': TONES.WARNING,
    'Pending': TONES.WARNING,
    'In Progress': TONES.INFO,
    'Completed': TONES.SUCCESS,
    'Not Applicable': null,
    'Draft': null,
    'Planning': null,
    'In Review': TONES.WARNING,
    'Pending Review': TONES.WARNING,
    'Active': TONES.SUCCESS,
    'Approved': TONES.SUCCESS,
    'Rejected': TONES.ERROR,
    'Retired': null,
    'Obsolete': null
  };

  /**
   * Canonical order for the Control Health strip so its indicators read in a
   * stable operational sequence regardless of which statuses the data contains.
   * Statuses outside this list sort after it, alphabetically.
   */
  var HEALTH_ORDER = [
    'Not Started', 'Data not received', 'Pending', 'In Progress', 'Completed', 'Not Applicable',
    'Draft', 'Planning', 'In Review', 'Pending Review', 'Active', 'Approved', 'Rejected', 'Retired', 'Obsolete'
  ];

  /** Evidence-coverage keys derived per control, with their labels and tones. */
  var EVIDENCE_COVERAGE = {
    OUTSTANDING: { key: 'outstanding', label: 'Evidence outstanding', tone: TONES.WARNING },
    COLLECTED: { key: 'collected', label: 'Evidence collected', tone: TONES.SUCCESS }
  };

  /** Testing-coverage keys derived per control, with their labels and tones. */
  var TESTING_COVERAGE = {
    TESTED: { key: 'tested', tone: TONES.SUCCESS },
    INHERITED: { key: 'inherited', label: 'Methodology inherited', tone: TONES.INFO },
    OUTSTANDING: { key: 'outstanding', label: 'Testing outstanding', tone: TONES.WARNING }
  };

  /** The three presentation modes over the one control library. */
  var VIEWS = { CONTROL: 'control', FAMILY: 'family', COVERAGE: 'coverage' };

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

  /** The current engagement: identical rule to Home, Engagement, Walkthrough, Evidence, and Requirements. */
  var deriveCurrentEngagement = WS.deriveCurrentEngagement;

  /** Resolves a control status to a presentation tone. */
  function resolveStatusTone(status) {
    return Object.prototype.hasOwnProperty.call(STATUS_TONES, status) ? STATUS_TONES[status] : TONES.INFO;
  }

  /** Resolves a record's name field from an id map, falling back to the raw id. */
  var resolveName = WS.resolveName;

  /** The business Control ID a control is known by (its framework control code), else its record id. */
  function resolveControlCode(control) {
    var source = control || {};
    return source.controlId || source.controlCode || source.id || '';
  }

  /** The control type / family across both dataset shapes. */
  function resolveControlType(control) {
    var source = control || {};
    return source.category || source.controlType || source.controlFamily || '';
  }

  /** The testing / collection frequency across both dataset shapes. */
  function resolveFrequency(control) {
    var source = control || {};
    return source.testingFrequency || source.frequency || '';
  }

  /** The control owner identifier across both dataset shapes. */
  function resolveOwnerId(control) {
    var source = control || {};
    return source.controlOwner || source.ownerId || source.ownerPocId || '';
  }

  /** The owning team identifier. */
  function resolveTeamId(control) {
    var source = control || {};
    return source.teamId || '';
  }

  /** The business unit identifier. */
  function resolveBusinessUnitId(control) {
    var source = control || {};
    return source.businessUnitId || '';
  }

  /**
   * The requirements a control links to, always as an array. Reads whichever of
   * the dataset shapes is present; a control declaring none yields an empty array
   * (never a fabricated link).
   */
  function normalizeRequirementIds(control) {
    var source = control || {};
    if (Array.isArray(source.requirementIds) && source.requirementIds.length > 0) {
      return source.requirementIds.slice();
    }
    if (Array.isArray(source.linkedRequirementIds) && source.linkedRequirementIds.length > 0) {
      return source.linkedRequirementIds.slice();
    }
    return [];
  }

  /**
   * The evidence a control links to, always as an array. Reads whichever of the
   * dataset shapes is present (`linkedEvidence` or `evidenceIds`); neither present
   * yields an empty array.
   */
  function normalizeEvidenceIds(control) {
    var source = control || {};
    if (Array.isArray(source.linkedEvidence) && source.linkedEvidence.length > 0) {
      return source.linkedEvidence.slice();
    }
    if (Array.isArray(source.evidenceIds) && source.evidenceIds.length > 0) {
      return source.evidenceIds.slice();
    }
    return [];
  }

  /**
   * The reuse posture of a control, drawn only from the reuse block the record
   * carries: the SOC 2 `evidenceReuse` shape (same-company prior-year reuse) or
   * the ISO `knowledgeReuse` shape (cross-framework methodology reuse). A control
   * declaring neither reads not-eligible with no source — never a fabricated
   * reuse claim.
   */
  function normalizeReuse(control) {
    var source = control || {};
    if (source.evidenceReuse && typeof source.evidenceReuse === 'object') {
      return {
        kind: 'evidence',
        eligible: Boolean(source.evidenceReuse.eligible),
        status: source.evidenceReuse.reuseStatus || '',
        source: source.evidenceReuse.sourceEngagement || ''
      };
    }
    if (source.knowledgeReuse && typeof source.knowledgeReuse === 'object') {
      return {
        kind: 'knowledge',
        eligible: Boolean(source.knowledgeReuse.evidenceReusable),
        status: source.knowledgeReuse.methodologyReusable ? 'Methodology reusable' : '',
        source: source.knowledgeReuse.sourceFramework || ''
      };
    }
    return { kind: null, eligible: false, status: '', source: '' };
  }

  /**
   * The evidence coverage of a control, derived only from the evidence the record
   * links: collected when evidence is linked, outstanding otherwise. Never
   * fabricated — a control with an empty evidence array reads Outstanding, which
   * is the faithful current state of the demo data.
   */
  function deriveEvidenceCoverage(control) {
    var evidence = normalizeEvidenceIds(control);
    if (evidence.length > 0) {
      return { key: EVIDENCE_COVERAGE.COLLECTED.key, label: evidence.length + ' collected', tone: EVIDENCE_COVERAGE.COLLECTED.tone, count: evidence.length };
    }
    return { key: EVIDENCE_COVERAGE.OUTSTANDING.key, label: EVIDENCE_COVERAGE.OUTSTANDING.label, tone: EVIDENCE_COVERAGE.OUTSTANDING.tone, count: 0 };
  }

  /** True only when a control records a completed test outcome. Never inferred. */
  function isTestingComplete(control) {
    var source = control || {};
    if (source.testingComplete === true) {
      return true;
    }
    var result = source.testResult || source.testStatus || source.testingStatus;
    return typeof result === 'string' && /^(pass|passed|complete|completed|tested)$/i.test(result);
  }

  /**
   * The testing coverage of a control, derived only from what the record carries:
   * the recorded test result when a test is complete; otherwise Methodology
   * inherited when the control carries an inherited testing strategy (a real,
   * current fact); otherwise Testing outstanding. Never fabricates a test outcome.
   */
  function deriveTestingCoverage(control) {
    var source = control || {};
    if (isTestingComplete(source)) {
      var label = source.testResult || source.testStatus || source.testingStatus || 'Tested';
      return { key: TESTING_COVERAGE.TESTED.key, label: label, tone: TESTING_COVERAGE.TESTED.tone };
    }
    var strategy = source.testingStrategy;
    if (strategy && typeof strategy === 'object' && strategy.methodologyInherited) {
      return { key: TESTING_COVERAGE.INHERITED.key, label: TESTING_COVERAGE.INHERITED.label, tone: TESTING_COVERAGE.INHERITED.tone };
    }
    return { key: TESTING_COVERAGE.OUTSTANDING.key, label: TESTING_COVERAGE.OUTSTANDING.label, tone: TESTING_COVERAGE.OUTSTANDING.tone };
  }

  /**
   * The framework mappings of a control, always as an array, drawn only from
   * present relationships in priority order: the control's own per-framework
   * `frameworkMappings` object when present, then its trust-services criteria,
   * then its ISO Annex A reference, then the engagement framework(s) it belongs
   * to. Every source is a real declaration on the record or a real control →
   * engagement join; nothing is inferred across frameworks. Returns an empty
   * array only when the control declares nothing and the engagement names no
   * framework.
   */
  function deriveFrameworkMappings(control, frameworks) {
    var source = control || {};
    var mappings = [];
    if (source.frameworkMappings && typeof source.frameworkMappings === 'object' && !Array.isArray(source.frameworkMappings)) {
      Object.keys(source.frameworkMappings).forEach(function (key) {
        var criteria = source.frameworkMappings[key];
        var list = Array.isArray(criteria) ? criteria : (criteria && Array.isArray(criteria.trustServicesCriteria) ? criteria.trustServicesCriteria : []);
        if (list.length > 0) {
          mappings.push(key + ': ' + list.join(', '));
        }
      });
      if (mappings.length > 0) {
        return mappings;
      }
    }
    if (Array.isArray(source.trustServicesCriteria) && source.trustServicesCriteria.length > 0) {
      return source.trustServicesCriteria.slice();
    }
    if (source.annexAControl) {
      return [String(source.annexAControl)];
    }
    return asArray(frameworks).slice();
  }

  /** The framework mappings of a control as a single compact label for the library row. */
  function deriveFrameworkMappingText(control, frameworks) {
    return deriveFrameworkMappings(control, frameworks).join(', ');
  }

  /**
   * One Control Library row, resolved to display fields. Owner resolves to a name
   * where the identifier genuinely joins and renders the raw identifier otherwise;
   * evidence and testing coverage are derived only from what the record carries.
   * The control record is carried through for the Inspector.
   */
  function deriveControlRow(control, context) {
    var source = control || {};
    var ctx = context || {};
    return {
      id: source.id || '',
      controlCode: resolveControlCode(source),
      title: source.title || source.id || '',
      control: source,
      owner: resolveName(ctx.pocsById, resolveOwnerId(source), 'name'),
      ownerId: resolveOwnerId(source),
      status: source.status || '',
      statusTone: resolveStatusTone(source.status),
      type: resolveControlType(source),
      frequency: resolveFrequency(source),
      evidence: deriveEvidenceCoverage(source),
      testing: deriveTestingCoverage(source),
      reuse: normalizeReuse(source),
      framework: deriveFrameworkMappingText(source, ctx.frameworks)
    };
  }

  /**
   * The Control Library — every control rendered once, ordered by identifier so
   * the surface is stable. Nothing is capped or filtered: the library is the full
   * operational dataset the presentation views regroup.
   */
  function deriveLibrary(controls, context) {
    return asArray(controls)
      .map(function (control) { return deriveControlRow(control, context); })
      .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
  }

  /**
   * The Control Health strip — one indicator per operational status actually
   * present (labelled by the status, valued by its real count), in canonical
   * order, plus derived Evidence outstanding, Testing outstanding, and Reuse
   * eligible indicators. Every value is a real count of real records; an
   * engagement with no controls yields only the derived indicators, reading Clear
   * / None. Never a fabricated count.
   */
  function deriveControlHealth(controls) {
    var list = asArray(controls);
    var counts = {};
    list.forEach(function (control) {
      var status = control && control.status ? control.status : 'Unspecified';
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

    var evidenceOutstanding = list.filter(function (control) {
      return deriveEvidenceCoverage(control).key === EVIDENCE_COVERAGE.OUTSTANDING.key;
    }).length;
    indicators.push({
      key: 'evidence-outstanding',
      label: 'Evidence outstanding',
      status: evidenceOutstanding > 0 ? String(evidenceOutstanding) : 'Clear',
      tone: evidenceOutstanding > 0 ? TONES.WARNING : TONES.SUCCESS
    });

    var testingOutstanding = list.filter(function (control) {
      return !isTestingComplete(control);
    }).length;
    indicators.push({
      key: 'testing-outstanding',
      label: 'Testing outstanding',
      status: testingOutstanding > 0 ? String(testingOutstanding) : 'Clear',
      tone: testingOutstanding > 0 ? TONES.WARNING : TONES.SUCCESS
    });

    var reuseEligible = list.filter(function (control) {
      return normalizeReuse(control).eligible;
    }).length;
    indicators.push({
      key: 'reuse-eligible',
      label: 'Reuse eligible',
      status: reuseEligible > 0 ? String(reuseEligible) : 'None',
      tone: reuseEligible > 0 ? TONES.SUCCESS : null
    });

    return indicators;
  }

  /**
   * The control collection status for the header badge: awaiting when there are
   * no controls, approved once every control is approved or active, drafting
   * otherwise. Derived from real status counts; never a fabricated aggregate.
   */
  function deriveCollectionStatus(controls) {
    var list = asArray(controls);
    if (list.length === 0) {
      return { label: 'Awaiting', tone: null };
    }
    var settled = list.filter(function (control) {
      return control.status === 'Approved' || control.status === 'Active';
    }).length;
    if (settled === list.length) {
      return { label: 'Approved', tone: TONES.SUCCESS };
    }
    return { label: 'Drafting', tone: TONES.INFO };
  }

  // ---- Presentation views — three regroupings of the one library dataset. Each
  // is pure and returns `{ groups: [{ label, rows }] }` from the same rows, so
  // changing the view changes presentation only and never the data.

  /** Control view — the flat library, a single unlabeled group. */
  function controlView(rows) {
    return { id: VIEWS.CONTROL, groups: [{ label: '', rows: asArray(rows).slice() }] };
  }

  /** By family — the same rows grouped by control type, groups ordered by name. */
  function familyView(rows) {
    var groups = {};
    var order = [];
    asArray(rows).forEach(function (row) {
      var key = row.type || 'Uncategorized';
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(row);
    });
    order.sort(function (a, b) { return a.localeCompare(b); });
    return { id: VIEWS.FAMILY, groups: order.map(function (key) { return { label: key, rows: groups[key] }; }) };
  }

  /** By coverage — the same rows grouped by evidence coverage, outstanding first. */
  function coverageView(rows) {
    var ORDER = [EVIDENCE_COVERAGE.OUTSTANDING, EVIDENCE_COVERAGE.COLLECTED];
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
      id: VIEWS.COVERAGE,
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
      { id: VIEWS.CONTROL, label: 'Control view', view: controlView(rows) },
      { id: VIEWS.FAMILY, label: 'By family', view: familyView(rows) },
      { id: VIEWS.COVERAGE, label: 'By coverage', view: coverageView(rows) }
    ];
  }

  /**
   * The Audit Lineage — Walkthrough → Requirement → Control → Evidence → Testing
   * → Finding → Report, with Control highlighted as the object this workspace
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
      { id: ids.CONTROLS, label: 'Control', count: controls.controls || 0, present: (controls.controls || 0) > 0, hint: 'How the objective is met', highlighted: true },
      { id: ids.EVIDENCE, label: 'Evidence', count: evidence.evidenceItems || 0, present: (evidence.evidenceItems || 0) > 0, hint: 'What proves the control' },
      { id: ids.TESTING, label: 'Testing', count: testing.tests || 0, present: (testing.tests || 0) > 0, hint: 'What the control is tested against' },
      { id: ids.FINDINGS, label: 'Finding', count: findings.findings || 0, present: (findings.findings || 0) > 0, hint: 'What the testing surfaces' },
      { id: ids.REPORTING, label: 'Report', count: report ? null : 0, present: Boolean(report), hint: report ? report.status : 'Not started' }
    ];

    return WS.resolveLineageNodes(workspaceRegistry, nodes);
  }

  /**
   * Related audit objects for the supporting panel: the domains the controls
   * connect to, each with its real count, only when data exists. Reuses the same
   * chain the lineage draws from (Control is the workspace's own object, so it is
   * not listed as a relation).
   */
  function deriveRelationships(workspaceRegistry, operational) {
    if (!workspaceRegistry) {
      return [];
    }
    var ops = operational || {};
    var requirements = ops.requirements || {};
    var evidence = ops.evidence || {};
    var testing = ops.testing || {};
    var findings = ops.findings || {};
    var report = ops.report || null;
    var ids = workspaceRegistry.IDS;

    var related = [
      { id: ids.EVIDENCE, title: 'Evidence', meta: String(evidence.evidenceItems || 0), present: (evidence.evidenceItems || 0) > 0 },
      { id: ids.TESTING, title: 'Testing', meta: String(testing.tests || 0), present: (testing.tests || 0) > 0 },
      { id: ids.FINDINGS, title: 'Findings', meta: String(findings.findings || 0), present: (findings.findings || 0) > 0 },
      { id: ids.REPORTING, title: 'Report', meta: report ? String(report.status) : '—', present: Boolean(report) }
    ];
    return WS.resolveRelationships(workspaceRegistry, related);
  }

  /**
   * Recent control-related activity, newest first, drawn only from dated history
   * the controls carry (activity / history entries, or a recorded update
   * timestamp). Undated controls never appear, so an engagement whose controls
   * record no dated events yields an empty feed and the shared Empty State. Never
   * fabricated.
   */
  function deriveActivity(controls) {
    return RE.deriveActivityFromHistory(controls, {
      entityNoun: 'Control',
      resolveTone: resolveStatusTone,
      formatDate: formatDate,
      limit: LIST_LIMIT
    });
  }

  /**
   * Control collection metadata: created / modified / owner / version / tags /
   * source, derived from the controls document metadata, the engagement, and the
   * company. Only fields with real values are surfaced by the builder.
   */
  function deriveMetadata(controlsMetadata, engagement, company, controls) {
    return RE.deriveCollectionMetadata(controlsMetadata, engagement, company, controls, formatDate);
  }

  // ---- Inspector configuration — pure, host-agnostic (§9). Returns plain
  // Inspector Panel configuration; no DOM. Framework mappings, the test procedure,
  // and immutable history render only when the JSON records them.

  /** One text-valued Inspector section rendered as a single placeholder-capable list row. */
  function textSection(title, text, placeholder) {
    return WS.textSection(title, text, placeholder);
  }

  /** One list-valued Inspector section; an empty list renders one placeholder row. */
  function listSection(title, items, placeholder) {
    return WS.listSection(title, items, placeholder);
  }

  /** Normalizes a linked-id reference, resolving its name where it joins. */
  function toRefItem(id, map, field, workspaceRegistry, workspaceId) {
    return WS.resolveRefItem(id, map, field, workspaceRegistry, workspaceId);
  }

  /**
   * The test procedure of a control — rendered only from steps the control
   * records (`testProcedure` / `testSteps` / `testProcedureSteps`). Release 1
   * never drafts a procedure, so a control carrying none yields an empty array and
   * the reserved placeholder; Release 2 adds AI-drafted, continuously refined test
   * procedures here.
   */
  function deriveTestProcedure(control) {
    var source = control || {};
    return asArray(source.testProcedure || source.testSteps || source.testProcedureSteps).map(function (step, index) {
      if (typeof step === 'string') {
        return { title: step };
      }
      var entry = step || {};
      return {
        title: entry.description || entry.title || entry.step || ('Step ' + (index + 1)),
        description: entry.expectedResult || entry.note || ''
      };
    }).filter(function (step) { return step.title; });
  }

  /**
   * Related testing facts for a control, drawn only from the testing strategy the
   * record carries (inherited methodology, prior-year control). A control with no
   * testing strategy yields an empty array and the reserved placeholder — never a
   * fabricated test.
   */
  function deriveRelatedTesting(control) {
    var source = control || {};
    var strategy = source.testingStrategy;
    if (!strategy || typeof strategy !== 'object') {
      return [];
    }
    var items = [];
    if (strategy.methodologyInherited) {
      items.push({ title: 'Methodology inherited from prior year', tone: TONES.INFO });
    }
    if (strategy.priorYearControl) {
      items.push({ title: 'Prior-year control: ' + strategy.priorYearControl, tone: TONES.INFO });
    }
    return items;
  }

  /**
   * Immutable version history — rendered only from a `versionHistory` / `versions`
   * array the control records. Release 1 never fabricates a prior version, so a
   * control carrying none yields an empty list and the reserved placeholder.
   */
  function deriveVersionHistory(control) {
    return WS.deriveVersionHistory(control, resolveStatusTone);
  }

  /**
   * Approval history — the recorded `approvalHistory` when present, else a single
   * entry reflecting the current status (a real, current fact, not a fabricated
   * past). Empty only when the control carries no status at all.
   */
  function deriveApprovalHistory(control) {
    return WS.deriveApprovalHistory(control, resolveStatusTone);
  }

  /** Activity history — rendered only from recorded dated history; never fabricated. */
  function deriveActivityHistory(control) {
    return WS.deriveActivityHistory(control, resolveStatusTone);
  }

  /**
   * The Control Inspector configuration for one control (Master → Detail detail
   * pane). Renders the current control, its status and coverage, description,
   * objective, framework mappings, related requirements, related evidence,
   * related walkthroughs, related testing, the test-procedure preview, metadata,
   * version history, approval history, and activity history — a placeholder row
   * wherever the JSON lacks data, and never a fabricated relationship. Pure and
   * host-agnostic: data in, one plain configuration out.
   */
  function buildControlInspector(control, context) {
    var item = control || {};
    var ctx = context || {};
    var ids = ctx.workspaceRegistry ? ctx.workspaceRegistry.IDS : {};
    var status = item.status || '';
    var evidence = deriveEvidenceCoverage(item);
    var testing = deriveTestingCoverage(item);
    var reuse = normalizeReuse(item);
    var owner = resolveName(ctx.pocsById, resolveOwnerId(item), 'name');
    var team = resolveName(ctx.teamsById, resolveTeamId(item), 'name');
    var businessUnit = resolveName(ctx.businessUnitsById, resolveBusinessUnitId(item), 'name');
    var frameworkMappings = deriveFrameworkMappings(item, ctx.frameworks);
    var requirementIds = normalizeRequirementIds(item);
    var evidenceIds = normalizeEvidenceIds(item);
    var testProcedure = deriveTestProcedure(item);
    var relatedTesting = deriveRelatedTesting(item);
    var versionHistory = deriveVersionHistory(item);

    return {
      eyebrow: resolveControlType(item) || 'Control',
      title: item.title || item.id || '',
      subtitle: [resolveControlCode(item), status].filter(Boolean).join(' · '),
      badges: [
        status ? { label: status, tone: resolveStatusTone(status) } : null,
        { label: evidence.label, tone: evidence.tone },
        { label: testing.label, tone: testing.tone }
      ].filter(Boolean),
      sections: [
        {
          title: 'Properties', kind: 'properties', columns: 2,
          rows: [
            { label: 'Control id', value: item.id || '' },
            { label: 'Control code', value: resolveControlCode(item) },
            { label: 'Status', value: status },
            { label: 'Type', value: resolveControlType(item) },
            { label: 'Owner', value: owner },
            { label: 'Owning team', value: team },
            { label: 'Business unit', value: businessUnit },
            { label: 'Frequency', value: resolveFrequency(item) },
            { label: 'Sample size', value: item.sampleSize !== undefined && item.sampleSize !== null ? String(item.sampleSize) : '' },
            { label: 'Audit year', value: item.auditYear !== undefined && item.auditYear !== null ? String(item.auditYear) : '' },
            { label: 'Annex A control', value: item.annexAControl || '' },
            { label: 'Implementation status', value: item.implementationStatus || '' },
            { label: 'Risk rating', value: item.riskRating || '' },
            { label: 'Working paper', value: item.workingPaperId || '' },
            { label: 'Report section', value: item.reportSection || '' },
            { label: 'Evidence coverage', value: evidence.label },
            { label: 'Testing coverage', value: testing.label },
            { label: 'Reuse status', value: reuse.status },
            { label: 'Reuse source', value: reuse.source },
            { label: 'Created', value: formatDate(item.createdAt || item.createdOn) },
            { label: 'Updated', value: formatDate(item.updatedAt || item.updatedOn) }
          ].filter(function (row) { return row.value; })
        },
        textSection('Description', item.description, 'No description recorded for this control. Release 2 adds AI-drafted control descriptions.'),
        textSection('Objective', item.objective, 'No control objective recorded. Release 2 adds AI-refined control objectives.'),
        listSection('Framework mappings',
          frameworkMappings.map(function (mapping) { return { title: mapping, tone: TONES.INFO }; }),
          'No framework mapping declared for this control.'),
        listSection('Related evidence',
          evidenceIds.map(function (id) { return toRefItem(id, ctx.evidenceById, 'title', ctx.workspaceRegistry, ids.EVIDENCE); }),
          'No evidence linked yet — this control is still outstanding.'),
        listSection('Related walkthroughs', [],
          'No linked walkthroughs yet — walkthrough linkage arrives with the walkthrough collection.'),
        listSection('Related testing', relatedTesting,
          'No linked testing recorded for this control.'),
        testProcedure.length > 0
          ? { title: 'Test procedure', kind: 'list', items: testProcedure }
          : {
            title: 'Test procedure', kind: 'placeholder',
            empty: {
              icon: '◇', title: 'No test procedure yet',
              description: 'Release 1 renders a test procedure only when the JSON records one. Release 2 adds AI-drafted, continuously refined test procedures here.'
            }
          },
        versionHistory.length > 0
          ? { title: 'Version history', kind: 'timeline', events: versionHistory }
          : {
            title: 'Version history', kind: 'placeholder',
            empty: {
              icon: '◇', title: 'Only the current version',
              description: 'Release 1 renders the current control. Immutable version history appears here when the JSON records it; Release 2 adds AI-proposed revisions and mutation lineage.'
            }
          },
        listSection('Approval history', deriveApprovalHistory(item), 'No approval decision recorded yet.'),
        listSection('Activity history', deriveActivityHistory(item), 'No activity recorded for this control.')
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
   * Collects everything the Controls Workspace presents from the Shared Audit
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
    var pocsById = indexById(state.listRecords('pocs'));
    var teamsById = indexById(state.listRecords('teams'));
    var businessUnitsById = indexById(state.listRecords('business-units'));

    var controlsDocument = readEngagementDocument(state, 'controls', engagement.id) || {};
    var requirementsDocument = readEngagementDocument(state, 'evidence-requirements', engagement.id) || {};
    var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
    var testingDocument = readEngagementDocument(state, 'testing', engagement.id) || {};
    var findingsDocument = readEngagementDocument(state, 'findings', engagement.id) || {};
    var reportsDocument = readEngagementDocument(state, 'reports', engagement.id) || {};

    var controlRecords = asArray(controlsDocument.controls);
    var requirementsById = indexById(requirementsDocument.requirements);
    var evidenceById = indexById(evidenceDocument.evidence);

    var frameworks = normalizeFrameworks(engagement);
    var auditPeriodLabel = formatPeriod(engagement.auditPeriod);

    var context = {
      pocsById: pocsById,
      teamsById: teamsById,
      businessUnitsById: businessUnitsById,
      requirementsById: requirementsById,
      evidenceById: evidenceById,
      workspaceRegistry: workspaceRegistry,
      frameworks: frameworks,
      auditPeriodLabel: auditPeriodLabel,
      engagement: engagement,
      company: company
    };

    var operational = {
      requirements: { requirements: asArray(requirementsDocument.requirements).length },
      controls: { controls: controlRecords.length },
      evidence: evidenceDocument.summary || {},
      testing: testingDocument.summary || {},
      findings: findingsDocument.summary || {},
      report: reportsDocument.document || null
    };

    var library = deriveLibrary(controlRecords, context);
    var collectionStatus = deriveCollectionStatus(controlRecords);

    return {
      degraded: false,
      status: status,
      engagement: engagement,
      company: company,
      frameworks: frameworks,
      context: context,

      header: {
        eyebrow: engagement.engagementCode + ' · Controls',
        title: company ? company.name : engagement.companyId,
        meta: engagement.name + ' · living control library',
        frameworks: frameworks,
        status: collectionStatus,
        lastUpdated: controlsDocument.metadata && controlsDocument.metadata.generatedAt
          ? 'Updated ' + formatDate(String(controlsDocument.metadata.generatedAt).slice(0, 10))
          : '',
        actions: [{ label: 'Engagement overview', href: '#/engagements', variant: 'subtle' }]
      },

      ribbon: [
        { label: 'Client', value: company ? company.name : engagement.companyId },
        { label: 'Audit period', value: auditPeriodLabel },
        { label: 'Controls', value: String(controlRecords.length) }
      ],

      toolbar: { search: { placeholder: 'Search controls' } },
      filterBar: {
        dropdowns: [{ label: 'Framework', options: ['All frameworks'].concat(frameworks) }]
      },

      controlHealth: deriveControlHealth(controlRecords),
      library: library,
      views: deriveViews(library),
      lineage: deriveLineage(workspaceRegistry, operational),
      relationships: deriveRelationships(workspaceRegistry, operational),
      activity: deriveActivity(controlRecords),
      metadata: deriveMetadata(controlsDocument.metadata, engagement, company, controlRecords),

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
    return WS.buildSection('aos-controls', id, meta, bodyNode);
  }

  /**
   * Builds the Control Health strip: a row of tone-dot indicators (editor
   * status-bar style, identical composition to the other operational workspaces).
   * The status text carries the meaning; the dot only reinforces the tone, so
   * health reads without relying on color.
   */
  function buildHealthStrip(items) {
    return WS.buildHealthStrip('aos-controls', 'Control health', items);
  }

  /** Builds one Control Library master row: control code + title, status, and operational meta. */
  function buildRow(row) {
    var P = presentation();
    var node = el('button', null);
    node.type = 'button';

    var head = el('div', 'aos-controls__row-head');
    var identity = el('div', 'aos-controls__row-identity');
    if (row.controlCode) {
      identity.appendChild(el('span', 'aos-controls__row-code aos-numeric', row.controlCode));
    }
    identity.appendChild(el('span', 'aos-controls__row-title', row.title || row.id));
    head.appendChild(identity);
    if (row.status) {
      head.appendChild(P.statusBadge({ label: row.status, tone: row.statusTone }));
    }
    node.appendChild(head);

    var meta = el('div', 'aos-controls__row-meta');
    if (row.owner) {
      meta.appendChild(el('span', null, row.owner));
    }
    if (row.type) {
      meta.appendChild(el('span', null, row.type));
    }
    if (row.frequency) {
      meta.appendChild(el('span', null, row.frequency));
    }
    if (row.evidence && row.evidence.label) {
      meta.appendChild(el('span', 'aos-controls__row-coverage', row.evidence.label));
    }
    if (row.testing && row.testing.label) {
      meta.appendChild(el('span', 'aos-controls__row-coverage', row.testing.label));
    }
    if (row.reuse && row.reuse.eligible) {
      meta.appendChild(el('span', 'aos-controls__row-reuse', 'Reuse eligible'));
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
    WS.mountRailGroups('aos-controls', listNode, detailMount, groups, context, buildRow, buildControlInspector, 'control', targetId);
  }

  /**
   * Builds the Control Library: a view switcher above a Master–Detail whose master
   * rail lists the controls for the active view and whose detail shows the
   * selected control's Inspector Panel. The switcher swaps between the three
   * presentation modes — Control view, By family, By coverage — by re-rendering
   * the same rail from the same dataset (presentation-only, memory-only); it never
   * changes the data. `targetId` (Issue #31) selects that control on first render
   * and again on every view switch.
   */
  function buildLibraryBody(views, context, targetId) {
    var wrap = el('div', 'aos-controls__library');
    var detailMount = el('div', 'aos-controls__detail-mount');
    var listNode = el('div', 'aos-controls__row-list');
    listNode.setAttribute('role', 'list');

    var switcher = el('div', 'aos-controls__views');
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Control views');
    var chips = [];

    function activate(index) {
      chips.forEach(function (chip, chipIndex) {
        var selected = chipIndex === index;
        chip.classList.toggle('aos-controls__view-chip--active', selected);
        chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      mountRailGroups(listNode, detailMount, views[index].view.groups, context, targetId);
    }

    asArray(views).forEach(function (view, index) {
      var chip = el('button', 'aos-controls__view-chip', view.label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
      if (index === 0) {
        chip.classList.add('aos-controls__view-chip--active');
      }
      chip.addEventListener('click', function () { activate(index); });
      chips.push(chip);
      switcher.appendChild(chip);
    });

    var masterDetail = presentation().masterDetail({
      list: listNode, detail: detailMount, ratio: 42,
      listLabel: 'Control library', detailLabel: 'Control inspector'
    });

    wrap.appendChild(switcher);
    wrap.appendChild(masterDetail);
    activate(0);
    return wrap;
  }

  /**
   * Builds the Audit Lineage body: the methodology chain rendered as connected
   * nodes with Control highlighted. Each node shows its real count and links into
   * its workspace; absent nodes read "—". The chain reads left-to-right on wide
   * canvases and stacks on narrow ones (stylesheet).
   */
  function buildLineageBody(lineage) {
    return WS.buildLineageBody('aos-controls', lineage);
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
      description: 'The audit domains the controls connect to appear here once they hold data.'
    });
  }

  /** Builds the Activity Feed for the activity supporting panel. */
  function buildActivityBody(activity) {
    return WS.buildActivityBody(activity, {
      icon: '◇', title: 'No recent activity',
      description: 'Control drafts, refinements, and approval decisions appear here as the engagement progresses.'
    });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    return WS.buildFooterItems('aos-controls', entries);
  }

  /**
   * Host-agnostic Inspector renderer (§9): given the control library and the
   * resolution context, returns one self-contained Master–Detail node — the
   * control rail beside the Control Inspector — making no assumption about where
   * it is mounted. Release 1 mounts the fuller Library (with its view switcher) in
   * the primary content; this renderer exposes the same master → detail
   * interaction for any other host with no change here.
   */
  function renderInspector(library, context) {
    var detailMount = el('div', 'aos-controls__detail-mount');
    var listNode = el('div', 'aos-controls__row-list');
    listNode.setAttribute('role', 'list');
    mountRailGroups(listNode, detailMount, [{ label: '', rows: library }], context);
    return presentation().masterDetail({
      list: listNode, detail: detailMount, ratio: 42,
      listLabel: 'Control library', detailLabel: 'Control inspector'
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
   * The ordered controls sections (§ Workspace Structure): operational health, the
   * control library with its three views and the inspector, the audit lineage,
   * then the collection metadata. Each entry names the section id, its header,
   * whether it has data, its body builder, and an empty descriptor used when the
   * data is absent (§ Empty States).
   */
  function primarySections(viewModel, targetId) {
    var context = viewModel.context;
    return [
      {
        id: 'health', kicker: 'Operational status', title: 'Control health',
        present: true, body: function () { return buildHealthStrip(viewModel.controlHealth); }
      },
      {
        id: 'library', kicker: 'Operational queue', title: 'Control library',
        description: 'Every control for the engagement. Switch between Control view, By family, and By coverage — the same dataset, regrouped — and select a control to open its Inspector, with framework mappings, the test-procedure preview, related audit objects, and history.',
        present: viewModel.library.length > 0,
        body: function () { return buildLibraryBody(viewModel.views, context, targetId); },
        empty: {
          icon: '◇', title: 'No controls yet',
          description: 'Controls appear here as they are drafted for the engagement. Release 2 adds AI-drafted, AI-refined, and AI-reconciled controls; Release 1 renders only the current control state.'
        }
      },
      {
        id: 'lineage', kicker: 'Relationships', title: 'Audit lineage',
        description: 'Where controls sit in the audit chain, from walkthrough through to report.',
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

  /** Renders the ready controls experience into the framework slots. */
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

    var canvas = el('div', 'aos-controls');
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
      description: 'AI-drafted control refinement — draft controls, proposed mappings, drafted test procedures, and duplicate or obsolete detection — will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
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
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'detail', label: 'Loading controls' })]);
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
        '. Regenerate the demo-data bundle and reload to restore the Controls Workspace.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders the Controls Workspace when it is the active workspace: the ready
   * experience once the state has loaded, the loading skeleton before that, and
   * the degraded explanation when no engagement is available.
   */
  function renderActiveControls() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.CONTROLS) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.CONTROLS + '"]'
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

  AuditOS.controlsWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      formatDate: formatDate,
      formatPeriod: formatPeriod,
      normalizeFrameworks: normalizeFrameworks,
      deriveCurrentEngagement: deriveCurrentEngagement,
      resolveStatusTone: resolveStatusTone,
      resolveControlCode: resolveControlCode,
      resolveControlType: resolveControlType,
      resolveFrequency: resolveFrequency,
      resolveOwnerId: resolveOwnerId,
      resolveTeamId: resolveTeamId,
      normalizeRequirementIds: normalizeRequirementIds,
      normalizeEvidenceIds: normalizeEvidenceIds,
      normalizeReuse: normalizeReuse,
      deriveEvidenceCoverage: deriveEvidenceCoverage,
      isTestingComplete: isTestingComplete,
      deriveTestingCoverage: deriveTestingCoverage,
      deriveFrameworkMappings: deriveFrameworkMappings,
      deriveFrameworkMappingText: deriveFrameworkMappingText,
      deriveControlRow: deriveControlRow,
      deriveLibrary: deriveLibrary,
      deriveControlHealth: deriveControlHealth,
      deriveCollectionStatus: deriveCollectionStatus,
      controlView: controlView,
      familyView: familyView,
      coverageView: coverageView,
      deriveViews: deriveViews,
      deriveLineage: deriveLineage,
      deriveRelationships: deriveRelationships,
      deriveActivity: deriveActivity,
      deriveMetadata: deriveMetadata,
      deriveTestProcedure: deriveTestProcedure,
      deriveRelatedTesting: deriveRelatedTesting,
      deriveVersionHistory: deriveVersionHistory,
      deriveApprovalHistory: deriveApprovalHistory,
      deriveActivityHistory: deriveActivityHistory,
      buildControlInspector: buildControlInspector
    },

    collectViewModel: collectViewModel,

    // Host-agnostic Inspector renderer (§9): data → one self-contained node,
    // mountable in any host. Release 1 mounts the fuller Library in primary content.
    renderInspector: renderInspector,

    /**
     * Binds the Controls Workspace to the router and the Shared Audit State. Safe
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

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveControls);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveControls);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveControls);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveControls);
      }
      renderActiveControls();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.controlsWorkspace.init);
    } else {
      AuditOS.controlsWorkspace.init();
    }
  }
})(window);
