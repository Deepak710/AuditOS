/**
 * AuditOS Testing Workspace
 * Workspaces and Navigation — Chapter 12 / Workspace Architecture — Chapter 61 /
 * Audit Lifecycle — Chapter 11 / Component Architecture — Chapter 74
 *
 * The operational workspace where auditors perform and manage assurance testing
 * for an engagement (GitHub Issue #24). Testing is not a standalone activity: it
 * is the validation of controls using evidence — the point where audit knowledge
 * becomes audit assurance. Release 1 is a faithful visualization of the current
 * testing JSON — no AI, no backend, no writes, no workflow engine. In Release 2
 * AI agents will draft test procedures, recommend sample selections, identify
 * testing gaps, evaluate evidence, and propose conclusions; this workspace opens
 * those seams without implementing them, rendering only the current testing state
 * and never fabricating a testing outcome or inferring a business conclusion.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to the
 * Engagement, Walkthrough, Evidence, Requirements, and Controls workspaces.
 * `collectViewModel` is the single place this workspace reads `AuditOS.state`; it
 * returns a declarative model of pure, offline-testable derivations. The renderer
 * configures the Shared Workspace Framework's inherited skeleton
 * (`AuditOS.workspaceFramework.configure`) and fills its slots with compositions
 * from the Enterprise Data Presentation System (`AuditOS.presentation`) — no
 * bespoke primitives, no duplicated components (Component Design Patterns §81.4 —
 * Composition Over Duplication).
 *
 * Tests are read through the same engagement-scoped document pattern as controls,
 * evidence, and findings (`findDatasetsForEngagement` / `getDocument`). Each test
 * record is one procedure executed against one sample and carries its recorded
 * status ("Completed" / "Pending") and result ("Pass" / "Fail" / none). Every
 * read normalizes across the demo shapes — a SOC 2 shape and an ISO 27001 shape
 * that additionally carries `framework`, `annexASection`, and a `frameworkReuse`
 * block — and fabricates nothing where a field is absent. A test's related
 * control resolves to a real name only when its `libraryControlId` joins the
 * shared control library or its `controlId` joins the engagement control set;
 * otherwise it renders the raw identifier (never a fabricated label). The tester
 * and reviewer are recorded as user identifiers for which the demo carries no
 * directory, so they render as their raw identifiers rather than an invented
 * name. A recorded `findingId` resolves to the real finding it raised. This keeps
 * the workspace faithful across the mixed datasets while opening the Release 2
 * seams (AI-assisted testing, methodology reuse).
 *
 * The Test Procedure Queue is the primary operational surface. It renders every
 * test once and offers three presentation modes over that single dataset — Test
 * view, By control, and By result — each a pure regrouping of the same rows.
 * Changing the view changes presentation only; no test is added, removed, or
 * mutated. Selecting a row opens the Test Inspector beside it. The inspector
 * renderer is host-agnostic (data in, one self-contained node out) so a later
 * release can mount it in a dedicated region with no change here, and it exposes
 * the related control, sample selection, evidence used, methodology reuse, and an
 * approval reflection only when the JSON records them, never fabricating a
 * conclusion.
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
   * Test operational-status vocabulary → tone (read, never invented). The demo
   * data uses "Completed" and "Pending"; the vocabulary also covers the
   * operational states a test moves through — Not Started, In Progress, Pending
   * Review, Retesting Required — so future data (including AI-assisted states)
   * reads through the same token-backed tones. An unmapped status resolves to a
   * neutral info tone.
   */
  var STATUS_TONES = {
    'Not Started': null,
    'Pending': TONES.WARNING,
    'In Progress': TONES.INFO,
    'Pending Review': TONES.WARNING,
    'Retesting Required': TONES.WARNING,
    'Completed': TONES.SUCCESS
  };

  /** Test-result vocabulary → tone. Pass reads success, Fail reads exception; no result reads neutral. */
  var RESULT_TONES = { 'Pass': TONES.SUCCESS, 'Fail': TONES.ERROR };

  /**
   * Canonical order for the Testing Health strip so its indicators read in a
   * stable operational sequence regardless of which statuses the data contains.
   * Statuses outside this list sort after it, alphabetically.
   */
  var HEALTH_ORDER = ['Not Started', 'Pending', 'In Progress', 'Pending Review', 'Retesting Required', 'Completed'];

  /** Evidence-status keys derived per test, with their labels and tones. */
  var EVIDENCE_STATUS = {
    USED: { key: 'used', label: 'Evidence recorded', tone: TONES.SUCCESS },
    OUTSTANDING: { key: 'outstanding', label: 'Evidence outstanding', tone: TONES.WARNING }
  };

  /** The three presentation modes over the one test queue. */
  var VIEWS = { TEST: 'test', CONTROL: 'control', RESULT: 'result' };

  /** Result-group descriptors for the By-result view, exceptions first. */
  var RESULT_GROUPS = {
    FAIL: { key: 'Fail', label: 'Exceptions' },
    PASS: { key: 'Pass', label: 'Passed' },
    PENDING: { key: 'Pending', label: 'Awaiting result' }
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

  /** The current engagement: identical rule to Home, Engagement, Walkthrough, Evidence, Requirements, and Controls. */
  var deriveCurrentEngagement = WS.deriveCurrentEngagement;

  /** Resolves a test status to a presentation tone. */
  function resolveStatusTone(status) {
    return Object.prototype.hasOwnProperty.call(STATUS_TONES, status) ? STATUS_TONES[status] : TONES.INFO;
  }

  /** Resolves a test result to a presentation tone (neutral when there is no result). */
  function resolveResultTone(result) {
    return Object.prototype.hasOwnProperty.call(RESULT_TONES, result) ? RESULT_TONES[result] : null;
  }

  /**
   * The control a test validates, resolved only where an identifier genuinely
   * joins: the shared control library by `libraryControlId` first (the master
   * definition every engagement references), then the engagement control set by
   * `controlId`. A test whose identifiers join neither renders its raw
   * `controlId` with no title — never a fabricated control. Returns
   * `{ id, code, title }`.
   */
  function resolveRelatedControl(test, context) {
    var source = test || {};
    var ctx = context || {};
    var libraryControl = source.libraryControlId && ctx.libraryControlsById ? ctx.libraryControlsById[source.libraryControlId] : null;
    if (libraryControl) {
      return { id: source.controlId || source.libraryControlId || '', code: libraryControl.controlCode || '', title: libraryControl.title || '' };
    }
    var engagementControl = source.controlId && ctx.controlsById ? ctx.controlsById[source.controlId] : null;
    if (engagementControl) {
      return { id: source.controlId, code: engagementControl.controlId || '', title: engagementControl.title || '' };
    }
    return { id: source.controlId || '', code: '', title: '' };
  }

  /** A compact related-control label — code + title where they resolve, else the raw identifier. */
  function relatedControlLabel(related) {
    var source = related || {};
    var label = [source.code, source.title].filter(Boolean).join(' · ');
    return label || source.id || '';
  }

  /**
   * The evidence status of a test, derived only from the working paper the record
   * links: recorded when a working paper is present, outstanding otherwise. Never
   * fabricated — a test with no working paper reads Outstanding, the faithful
   * current state.
   */
  function deriveEvidenceStatus(test) {
    var source = test || {};
    if (source.workingPaperId) {
      return { key: EVIDENCE_STATUS.USED.key, label: EVIDENCE_STATUS.USED.label, tone: EVIDENCE_STATUS.USED.tone };
    }
    return { key: EVIDENCE_STATUS.OUTSTANDING.key, label: EVIDENCE_STATUS.OUTSTANDING.label, tone: EVIDENCE_STATUS.OUTSTANDING.tone };
  }

  /**
   * The methodology-reuse posture of a test, drawn only from the reuse block the
   * record carries: the SOC 2 `knowledgeReuse` shape (cross-engagement
   * methodology inheritance) or the ISO `frameworkReuse` shape (cross-framework
   * methodology reuse). A test declaring neither reads not-applicable with no
   * source — never a fabricated reuse claim.
   */
  function normalizeMethodologyReuse(test) {
    var source = test || {};
    if (source.knowledgeReuse && typeof source.knowledgeReuse === 'object') {
      return {
        kind: 'knowledge',
        methodologyInherited: Boolean(source.knowledgeReuse.methodologyInherited),
        source: source.knowledgeReuse.sourceEngagementId || '',
        evidenceReviewed: Boolean(source.knowledgeReuse.evidenceReuseReviewed)
      };
    }
    if (source.frameworkReuse && typeof source.frameworkReuse === 'object') {
      return {
        kind: 'framework',
        methodologyInherited: Boolean(source.frameworkReuse.soc2MethodologyReusable),
        source: source.frameworkReuse.sourceFramework || '',
        evidenceReviewed: Boolean(source.frameworkReuse.evidenceReusable)
      };
    }
    return { kind: null, methodologyInherited: false, source: '', evidenceReviewed: false };
  }

  /**
   * One Test Procedure Queue row, resolved to display fields. The related control
   * resolves to a name where its identifiers genuinely join and renders the raw
   * identifier otherwise; the tester renders as recorded (no directory joins the
   * demo user identifiers); evidence status is derived only from what the record
   * carries. The test record is carried through for the Inspector.
   */
  function deriveTestRow(test, context) {
    var source = test || {};
    var related = resolveRelatedControl(source, context);
    return {
      id: source.id || '',
      test: source,
      procedure: source.procedure || '',
      control: related,
      controlLabel: relatedControlLabel(related),
      testedBy: source.testedBy || '',
      reviewedBy: source.reviewedBy || '',
      status: source.status || '',
      statusTone: resolveStatusTone(source.status),
      result: source.result || '',
      resultTone: resolveResultTone(source.result),
      method: source.procedure || '',
      evidence: deriveEvidenceStatus(source),
      findingId: source.findingId || ''
    };
  }

  /**
   * The Test Procedure Queue — every test rendered once, ordered by identifier so
   * the surface is stable. Nothing is capped or filtered: the queue is the full
   * operational dataset the presentation views regroup.
   */
  function deriveQueue(tests, context) {
    return asArray(tests)
      .map(function (test) { return deriveTestRow(test, context); })
      .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
  }

  /**
   * The Testing Health strip — one indicator per operational status actually
   * present (labelled by the status, valued by its real count), in canonical
   * order, plus derived Passed, Exceptions, and Pending review indicators. Every
   * value is a real count of real records; an engagement with no tests yields only
   * the derived indicators, reading None / Clear. Never a fabricated count.
   */
  function deriveTestingHealth(tests) {
    var list = asArray(tests);
    var counts = {};
    list.forEach(function (test) {
      var status = test && test.status ? test.status : 'Unspecified';
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

    var passed = list.filter(function (test) { return test && test.result === 'Pass'; }).length;
    indicators.push({
      key: 'passed',
      label: 'Passed',
      status: passed > 0 ? String(passed) : 'None',
      tone: passed > 0 ? TONES.SUCCESS : null
    });

    var exceptions = list.filter(function (test) { return test && test.result === 'Fail'; }).length;
    indicators.push({
      key: 'exceptions',
      label: 'Exceptions',
      status: exceptions > 0 ? String(exceptions) : 'Clear',
      tone: exceptions > 0 ? TONES.ERROR : TONES.SUCCESS
    });

    var awaiting = list.filter(function (test) { return test && !test.result; }).length;
    indicators.push({
      key: 'awaiting-result',
      label: 'Awaiting result',
      status: awaiting > 0 ? String(awaiting) : 'Clear',
      tone: awaiting > 0 ? TONES.WARNING : TONES.SUCCESS
    });

    return indicators;
  }

  /**
   * Testing progress — real counts only: completed tests over total tests, with
   * the passed / exception / pending breakdown. No estimated percentage; the
   * ratio is a real measurement of the recorded tests, and an engagement with no
   * tests reads zero rather than a fabricated figure.
   */
  function deriveTestingProgress(tests) {
    var list = asArray(tests);
    var completed = list.filter(function (test) { return test && test.status === 'Completed'; }).length;
    var passed = list.filter(function (test) { return test && test.result === 'Pass'; }).length;
    var failed = list.filter(function (test) { return test && test.result === 'Fail'; }).length;
    var pending = list.length - completed;
    return { total: list.length, completed: completed, passed: passed, failed: failed, pending: pending };
  }

  /**
   * The overall testing status for the header badge: Not Started when there are
   * no tests, Completed once every test is Completed, In Progress otherwise.
   * Derived from real status counts; never a fabricated aggregate.
   */
  function deriveTestingStatus(tests) {
    var list = asArray(tests);
    if (list.length === 0) {
      return { label: 'Not Started', tone: null };
    }
    var completed = list.filter(function (test) { return test.status === 'Completed'; }).length;
    if (completed === list.length) {
      return { label: 'Completed', tone: TONES.SUCCESS };
    }
    return { label: 'In Progress', tone: TONES.INFO };
  }

  /**
   * Actual exceptions only — the tests whose recorded result is Fail, resolved to
   * their raised finding where the `findingId` joins the findings collection. No
   * placeholder findings: a test with no failure never appears, and an engagement
   * with no exceptions yields an empty list and the shared Empty State.
   */
  function deriveExceptions(tests, context) {
    var ctx = context || {};
    return asArray(tests)
      .filter(function (test) { return test && test.result === 'Fail'; })
      .map(function (test) {
        var related = resolveRelatedControl(test, ctx);
        var finding = test.findingId && ctx.findingsById ? ctx.findingsById[test.findingId] : null;
        return {
          id: test.id,
          title: finding && finding.title ? finding.title : (test.actualResult || 'Exception identified'),
          control: relatedControlLabel(related),
          findingId: test.findingId || '',
          severity: finding && finding.severity ? finding.severity : '',
          tone: TONES.ERROR
        };
      })
      .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
  }

  // ---- Presentation views — three regroupings of the one queue dataset. Each is
  // pure and returns `{ groups: [{ label, rows }] }` from the same rows, so
  // changing the view changes presentation only and never the data.

  /** Test view — the flat queue, a single unlabeled group. */
  function testView(rows) {
    return { id: VIEWS.TEST, groups: [{ label: '', rows: asArray(rows).slice() }] };
  }

  /** By control — the same rows grouped by related control, groups ordered by label. */
  function controlGroupView(rows) {
    var groups = {};
    var order = [];
    asArray(rows).forEach(function (row) {
      var key = row.controlLabel || 'Unassigned control';
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(row);
    });
    order.sort(function (a, b) { return a.localeCompare(b); });
    return { id: VIEWS.CONTROL, groups: order.map(function (key) { return { label: key, rows: groups[key] }; }) };
  }

  /** By result — the same rows grouped by test result, exceptions first, then passed, then awaiting. */
  function resultView(rows) {
    var ORDER = [RESULT_GROUPS.FAIL, RESULT_GROUPS.PASS, RESULT_GROUPS.PENDING];
    var groups = {};
    asArray(rows).forEach(function (row) {
      var key = row.result === 'Fail' ? RESULT_GROUPS.FAIL.key
        : row.result === 'Pass' ? RESULT_GROUPS.PASS.key
        : RESULT_GROUPS.PENDING.key;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(row);
    });
    var present = ORDER.filter(function (descriptor) { return groups[descriptor.key]; });
    return {
      id: VIEWS.RESULT,
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
      { id: VIEWS.TEST, label: 'Test view', view: testView(rows) },
      { id: VIEWS.CONTROL, label: 'By control', view: controlGroupView(rows) },
      { id: VIEWS.RESULT, label: 'By result', view: resultView(rows) }
    ];
  }

  /**
   * The Audit Lineage — Walkthrough → Requirement → Control → Evidence → Testing
   * → Finding → Report, with Testing highlighted as the object this workspace
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
      { id: ids.REQUIREMENTS, label: 'Requirement', count: requirements.requirements || 0, present: (requirements.requirements || 0) > 0, hint: 'What the control satisfies' },
      { id: ids.CONTROLS, label: 'Control', count: controls.controls || 0, present: (controls.controls || 0) > 0, hint: 'What testing validates' },
      { id: ids.EVIDENCE, label: 'Evidence', count: evidence.evidenceItems || 0, present: (evidence.evidenceItems || 0) > 0, hint: 'What testing inspects' },
      { id: ids.TESTING, label: 'Testing', count: testing.tests || 0, present: (testing.tests || 0) > 0, hint: 'How the control is validated', highlighted: true },
      { id: ids.FINDINGS, label: 'Finding', count: findings.findings || 0, present: (findings.findings || 0) > 0, hint: 'What the testing surfaces' },
      { id: ids.REPORTING, label: 'Report', count: report ? null : 0, present: Boolean(report), hint: report ? report.status : 'Not started' }
    ];

    return WS.resolveLineageNodes(workspaceRegistry, nodes);
  }

  /**
   * Related audit objects for the supporting panel: the domains testing connects
   * to, each with its real count, only when data exists. Reuses the same chain
   * the lineage draws from (Testing is the workspace's own object, so it is not
   * listed as a relation).
   */
  function deriveRelationships(workspaceRegistry, operational) {
    if (!workspaceRegistry) {
      return [];
    }
    var ops = operational || {};
    var requirements = ops.requirements || {};
    var controls = ops.controls || {};
    var evidence = ops.evidence || {};
    var findings = ops.findings || {};
    var report = ops.report || null;
    var ids = workspaceRegistry.IDS;

    var related = [
      { id: ids.CONTROLS, title: 'Controls', meta: String(controls.controls || 0), present: (controls.controls || 0) > 0 },
      { id: ids.EVIDENCE, title: 'Evidence', meta: String(evidence.evidenceItems || 0), present: (evidence.evidenceItems || 0) > 0 },
      { id: ids.REQUIREMENTS, title: 'Requirements', meta: String(requirements.requirements || 0), present: (requirements.requirements || 0) > 0 },
      { id: ids.FINDINGS, title: 'Findings', meta: String(findings.findings || 0), present: (findings.findings || 0) > 0 },
      { id: ids.REPORTING, title: 'Report', meta: report ? String(report.status) : '—', present: Boolean(report) }
    ];
    return WS.resolveRelationships(workspaceRegistry, related);
  }

  /**
   * Recent testing-related activity, newest first, drawn only from dated history
   * the tests carry (activity / history entries, or a recorded update timestamp).
   * The current demo tests record no dated events, so this yields an empty feed
   * and the shared Empty State — never a fabricated event. Release 2's AI-assisted
   * testing populates this seam.
   */
  function deriveActivity(tests) {
    var events = [];
    asArray(tests).forEach(function (test) {
      var source = test || {};
      asArray(source.activityHistory || source.activity || source.history).forEach(function (entry) {
        var date = entry && (entry.date || entry.timestamp || entry.on);
        if (!date) {
          return;
        }
        events.push({
          title: (entry.title || entry.action || entry.status || 'Test updated') + ': ' + (source.id || ''),
          meta: entry.status || '',
          timestamp: formatDate(date),
          date: date,
          tone: entry.tone || resolveStatusTone(entry.status)
        });
      });
      var updated = source.updatedAt || source.updatedOn;
      if (updated) {
        events.push({
          title: 'Test updated: ' + (source.id || ''),
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
   * Testing document metadata: created / modified / owner / version / tags /
   * source, derived from the testing document metadata, the engagement, and the
   * company. Only fields with real values are surfaced by the builder.
   */
  function deriveMetadata(testingMetadata, engagement, company, tests) {
    var meta = testingMetadata || {};
    var tagSet = {};
    var tagOrder = [];
    asArray(tests).forEach(function (test) {
      asArray(test.tags).forEach(function (tag) {
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
  // Inspector Panel configuration; no DOM. Related control, sample selection,
  // evidence, methodology reuse, and the approval reflection render only when the
  // JSON records them; conclusions are never fabricated.

  /** One text-valued Inspector section rendered as a single placeholder-capable list row. */
  function textSection(title, text, placeholder) {
    return WS.textSection(title, text, placeholder);
  }

  /** One list-valued Inspector section; an empty list renders one placeholder row. */
  function listSection(title, items, placeholder) {
    return WS.listSection(title, items, placeholder);
  }

  /**
   * The methodology-reuse facts of a test, drawn only from the reuse block it
   * records. A test with no reuse block yields an empty array and the reserved
   * placeholder — never a fabricated reuse claim. Release 2 extends this with
   * AI-evaluated reuse decisions.
   */
  function deriveMethodologyReuseItems(test) {
    var reuse = normalizeMethodologyReuse(test);
    if (!reuse.kind) {
      return [];
    }
    var items = [];
    if (reuse.methodologyInherited) {
      items.push({ title: 'Methodology inherited', tone: TONES.INFO });
    }
    if (reuse.source) {
      items.push({ title: (reuse.kind === 'framework' ? 'Source framework: ' : 'Source engagement: ') + reuse.source, tone: TONES.INFO });
    }
    if (reuse.evidenceReviewed) {
      items.push({ title: 'Evidence reuse reviewed', tone: TONES.INFO });
    }
    return items;
  }

  /**
   * The approval reflection for a test — the recorded reviewer and outcome as a
   * single current-state entry (a real, current fact, not a fabricated past).
   * Empty only when the test carries neither a reviewer nor a status, in which
   * case the reserved placeholder renders.
   */
  function deriveApprovalHistory(test) {
    var source = test || {};
    if (source.reviewedBy) {
      return [{
        title: source.result ? ('Result reviewed: ' + source.result) : 'Reviewed',
        description: 'Reviewer ' + source.reviewedBy,
        tone: resolveResultTone(source.result) || resolveStatusTone(source.status)
      }];
    }
    if (source.status) {
      return [{ title: source.status, description: '', tone: resolveStatusTone(source.status) }];
    }
    return [];
  }

  /**
   * The Test Inspector configuration for one test (Master → Detail detail pane).
   * Renders the test procedure, related control, objective, testing method,
   * sample selection, evidence used, testing notes, result, reviewer, metadata,
   * methodology reuse, activity, and the approval reflection — a placeholder row
   * wherever the JSON lacks data, and never a fabricated conclusion. Pure and
   * host-agnostic: data in, one plain configuration out.
   */
  function buildTestInspector(test, context) {
    var item = test || {};
    var ctx = context || {};
    var related = resolveRelatedControl(item, ctx);
    var evidence = deriveEvidenceStatus(item);
    var finding = item.findingId && ctx.findingsById ? ctx.findingsById[item.findingId] : null;
    var reuseItems = deriveMethodologyReuseItems(item);

    return {
      eyebrow: relatedControlLabel(related) || 'Test procedure',
      title: item.procedure || item.id || '',
      subtitle: [item.id, item.status].filter(Boolean).join(' · '),
      badges: [
        item.status ? { label: item.status, tone: resolveStatusTone(item.status) } : null,
        item.result ? { label: item.result, tone: resolveResultTone(item.result) } : null,
        { label: evidence.label, tone: evidence.tone }
      ].filter(Boolean),
      sections: [
        {
          title: 'Properties', kind: 'properties', columns: 2,
          rows: [
            { label: 'Test id', value: item.id || '' },
            { label: 'Related control', value: relatedControlLabel(related) },
            { label: 'Testing method', value: item.procedure || '' },
            { label: 'Status', value: item.status || '' },
            { label: 'Result', value: item.result || '' },
            { label: 'Tested by', value: item.testedBy || '' },
            { label: 'Reviewer', value: item.reviewedBy || '' },
            { label: 'Sample', value: item.sampleId || '' },
            { label: 'Sample set', value: item.sampleSetId || '' },
            { label: 'Working paper', value: item.workingPaperId || '' },
            { label: 'Framework', value: item.framework || '' },
            { label: 'Annex A section', value: item.annexASection || '' },
            { label: 'Finding', value: item.findingId || '' },
            { label: 'Expected result', value: item.expectedResult || '' },
            { label: 'Actual result', value: item.actualResult || '' }
          ].filter(function (row) { return row.value; })
        },
        textSection('Test procedure', item.procedure, 'No test procedure recorded. Release 2 adds AI-drafted test procedures.'),
        textSection('Objective', item.objective, 'No objective recorded for this test. Release 2 adds AI-refined test objectives.'),
        listSection('Sample selection',
          [
            item.sampleId ? { title: 'Sample: ' + item.sampleId, tone: TONES.INFO } : null,
            item.sampleSetId ? { title: 'Sample set: ' + item.sampleSetId, tone: TONES.INFO } : null
          ].filter(Boolean),
          'No sample recorded for this test. Release 2 adds AI-recommended sample selections.'),
        listSection('Evidence used',
          item.workingPaperId ? [{ title: 'Working paper: ' + item.workingPaperId, tone: TONES.INFO }] : [],
          'No evidence recorded yet — this test is still outstanding.'),
        textSection('Testing notes', item.notes, 'No testing notes recorded for this test.'),
        finding
          ? { title: 'Exception', kind: 'list', items: [{ title: finding.title || 'Exception identified', description: [finding.severity, finding.status].filter(Boolean).join(' · '), tone: TONES.ERROR }] }
          : listSection('Exception', [], 'No exception raised for this test.'),
        reuseItems.length > 0
          ? { title: 'Methodology reuse', kind: 'list', items: reuseItems }
          : {
            title: 'Methodology reuse', kind: 'placeholder',
            empty: {
              icon: '◇', title: 'No methodology reuse recorded',
              description: 'Release 1 renders reuse only when the JSON records it. Release 2 adds AI-evaluated methodology and evidence reuse decisions here.'
            }
          },
        {
          title: 'Activity', kind: 'placeholder',
          empty: {
            icon: '◇', title: 'No activity recorded',
            description: 'Release 1 renders a test activity trail only when the JSON records one. Release 2 adds AI-assisted testing activity here.'
          }
        },
        listSection('Approval history', deriveApprovalHistory(item), 'No review recorded yet for this test.')
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
   * Collects everything the Testing Workspace presents from the Shared Audit
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
    var libraryControlsById = indexById(state.listRecords('control-library'));

    var testingDocument = readEngagementDocument(state, 'testing', engagement.id) || {};
    var controlsDocument = readEngagementDocument(state, 'controls', engagement.id) || {};
    var requirementsDocument = readEngagementDocument(state, 'evidence-requirements', engagement.id) || {};
    var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
    var findingsDocument = readEngagementDocument(state, 'findings', engagement.id) || {};
    var reportsDocument = readEngagementDocument(state, 'reports', engagement.id) || {};

    var testRecords = asArray(testingDocument.tests);
    var controlsById = indexById(controlsDocument.controls);
    var findingsById = indexById(findingsDocument.findings);

    var frameworks = normalizeFrameworks(engagement);
    var auditPeriodLabel = formatPeriod(engagement.auditPeriod);

    var context = {
      controlsById: controlsById,
      libraryControlsById: libraryControlsById,
      findingsById: findingsById,
      frameworks: frameworks,
      auditPeriodLabel: auditPeriodLabel,
      engagement: engagement,
      company: company
    };

    var operational = {
      requirements: { requirements: asArray(requirementsDocument.requirements).length },
      controls: { controls: asArray(controlsDocument.controls).length },
      evidence: evidenceDocument.summary || {},
      testing: { tests: testRecords.length },
      findings: findingsDocument.summary || {},
      report: reportsDocument.document || null
    };

    var queue = deriveQueue(testRecords, context);
    var testingStatus = deriveTestingStatus(testRecords);
    var progress = deriveTestingProgress(testRecords);

    return {
      degraded: false,
      status: status,
      engagement: engagement,
      company: company,
      frameworks: frameworks,
      context: context,

      header: {
        eyebrow: engagement.engagementCode + ' · Testing',
        title: company ? company.name : engagement.companyId,
        meta: engagement.name + ' · assurance testing',
        frameworks: frameworks,
        status: testingStatus,
        lastUpdated: testingDocument.metadata && testingDocument.metadata.generatedAt
          ? 'Updated ' + formatDate(String(testingDocument.metadata.generatedAt).slice(0, 10))
          : '',
        actions: [{ label: 'Engagement overview', href: '#/engagements', variant: 'subtle' }]
      },

      ribbon: [
        { label: 'Client', value: company ? company.name : engagement.companyId },
        { label: 'Audit period', value: auditPeriodLabel },
        { label: 'Tests', value: String(testRecords.length) }
      ],

      toolbar: { search: { placeholder: 'Search tests' } },
      filterBar: {
        dropdowns: [{ label: 'Framework', options: ['All frameworks'].concat(frameworks) }]
      },

      testingHealth: deriveTestingHealth(testRecords),
      progress: progress,
      queue: queue,
      views: deriveViews(queue),
      exceptions: deriveExceptions(testRecords, context),
      lineage: deriveLineage(workspaceRegistry, operational),
      relationships: deriveRelationships(workspaceRegistry, operational),
      activity: deriveActivity(testRecords),
      metadata: deriveMetadata(testingDocument.metadata, engagement, company, testRecords),

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
    return WS.buildSection('aos-testing', id, meta, bodyNode);
  }

  /**
   * Builds the Testing Health strip: a row of tone-dot indicators (editor
   * status-bar style, identical composition to the other operational workspaces).
   * The status text carries the meaning; the dot only reinforces the tone, so
   * health reads without relying on color.
   */
  function buildHealthStrip(items) {
    return WS.buildHealthStrip('aos-testing', 'Testing health', items);
  }

  /**
   * Builds the Testing Progress body: the shared Progress meter over real counts
   * (completed of total), with a breakdown line of the passed / exception /
   * pending figures. No estimated percentage — the ratio is a real measurement.
   */
  function buildProgressBody(progress) {
    var P = presentation();
    var wrap = el('div', 'aos-testing__progress');
    wrap.appendChild(P.progressMeter({
      label: 'Tests completed', value: progress.completed, total: progress.total, tone: TONES.INFO
    }));
    var breakdown = el('div', 'aos-testing__progress-breakdown');
    [
      { label: 'Passed', value: progress.passed },
      { label: 'Exceptions', value: progress.failed },
      { label: 'Pending', value: progress.pending }
    ].forEach(function (entry) {
      var item = el('span', 'aos-testing__progress-item');
      item.appendChild(el('span', 'aos-testing__progress-item-label', entry.label));
      item.appendChild(el('span', 'aos-testing__progress-item-value aos-numeric', String(entry.value)));
      breakdown.appendChild(item);
    });
    wrap.appendChild(breakdown);
    return wrap;
  }

  /** Builds one Test Procedure Queue master row: procedure + test id, status, and operational meta. */
  function buildRow(row) {
    var P = presentation();
    var node = el('button', null);
    node.type = 'button';

    var head = el('div', 'aos-testing__row-head');
    var identity = el('div', 'aos-testing__row-identity');
    if (row.id) {
      identity.appendChild(el('span', 'aos-testing__row-code aos-numeric', row.id));
    }
    identity.appendChild(el('span', 'aos-testing__row-title', row.procedure || row.id));
    head.appendChild(identity);
    if (row.status) {
      head.appendChild(P.statusBadge({ label: row.status, tone: row.statusTone }));
    }
    node.appendChild(head);

    var meta = el('div', 'aos-testing__row-meta');
    if (row.controlLabel) {
      meta.appendChild(el('span', 'aos-testing__row-control', row.controlLabel));
    }
    if (row.testedBy) {
      meta.appendChild(el('span', null, row.testedBy));
    }
    if (row.result) {
      meta.appendChild(el('span', 'aos-testing__row-result aos-testing__row-result--' + (row.resultTone || 'neutral'), row.result));
    }
    if (row.evidence && row.evidence.label) {
      meta.appendChild(el('span', 'aos-testing__row-coverage', row.evidence.label));
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
  function mountRailGroups(listNode, detailMount, groups, context) {
    WS.mountRailGroups('aos-testing', listNode, detailMount, groups, context, buildRow, buildTestInspector, 'test');
  }

  /**
   * Builds the Test Procedure Queue: a view switcher above a Master–Detail whose
   * master rail lists the tests for the active view and whose detail shows the
   * selected test's Inspector Panel. The switcher swaps between the three
   * presentation modes — Test view, By control, By result — by re-rendering the
   * same rail from the same dataset (presentation-only, memory-only); it never
   * changes the data.
   */
  function buildQueueBody(views, context) {
    var wrap = el('div', 'aos-testing__queue');
    var detailMount = el('div', 'aos-testing__detail-mount');
    var listNode = el('div', 'aos-testing__row-list');
    listNode.setAttribute('role', 'list');

    var switcher = el('div', 'aos-testing__views');
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Test views');
    var chips = [];

    function activate(index) {
      chips.forEach(function (chip, chipIndex) {
        var selected = chipIndex === index;
        chip.classList.toggle('aos-testing__view-chip--active', selected);
        chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      mountRailGroups(listNode, detailMount, views[index].view.groups, context);
    }

    asArray(views).forEach(function (view, index) {
      var chip = el('button', 'aos-testing__view-chip', view.label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
      if (index === 0) {
        chip.classList.add('aos-testing__view-chip--active');
      }
      chip.addEventListener('click', function () { activate(index); });
      chips.push(chip);
      switcher.appendChild(chip);
    });

    var masterDetail = presentation().masterDetail({
      list: listNode, detail: detailMount, ratio: 42,
      listLabel: 'Test procedure queue', detailLabel: 'Test inspector'
    });

    wrap.appendChild(switcher);
    wrap.appendChild(masterDetail);
    activate(0);
    return wrap;
  }

  /**
   * Builds the Exceptions body: the shared Item List of the tests whose result is
   * Fail, each linking to its raised finding. Never renders a placeholder finding;
   * an engagement with no exceptions renders the shared Empty State.
   */
  function buildExceptionsBody(exceptions) {
    var P = presentation();
    if (asArray(exceptions).length === 0) {
      return P.emptyState({
        icon: '✓', title: 'No exceptions',
        description: 'No test has recorded an exception for this engagement. Actual exceptions appear here as testing surfaces them — never a placeholder finding.'
      });
    }
    return P.itemList(exceptions.map(function (item) {
      return {
        title: item.title,
        description: [item.control, item.severity].filter(Boolean).join(' · '),
        meta: item.findingId,
        tone: item.tone,
        critical: true
      };
    }));
  }

  /**
   * Builds the Audit Lineage body: the methodology chain rendered as connected
   * nodes with Testing highlighted. Each node shows its real count and links into
   * its workspace; absent nodes read "—". The chain reads left-to-right on wide
   * canvases and stacks on narrow ones (stylesheet).
   */
  function buildLineageBody(lineage) {
    return WS.buildLineageBody('aos-testing', lineage);
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
      description: 'The audit domains testing connects to appear here once they hold data.'
    });
  }

  /** Builds the Activity Feed for the activity supporting panel. */
  function buildActivityBody(activity) {
    return WS.buildActivityBody(activity, {
      icon: '◇', title: 'No recent activity',
      description: 'Test executions, reviews, and conclusions appear here as the engagement progresses.'
    });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    return WS.buildFooterItems('aos-testing', entries);
  }

  /**
   * Host-agnostic Inspector renderer (§9): given the test queue and the
   * resolution context, returns one self-contained Master–Detail node — the test
   * rail beside the Test Inspector — making no assumption about where it is
   * mounted. Release 1 mounts the fuller Queue (with its view switcher) in the
   * primary content; this renderer exposes the same master → detail interaction
   * for any other host with no change here.
   */
  function renderInspector(queue, context) {
    var detailMount = el('div', 'aos-testing__detail-mount');
    var listNode = el('div', 'aos-testing__row-list');
    listNode.setAttribute('role', 'list');
    mountRailGroups(listNode, detailMount, [{ label: '', rows: queue }], context);
    return presentation().masterDetail({
      list: listNode, detail: detailMount, ratio: 42,
      listLabel: 'Test procedure queue', detailLabel: 'Test inspector'
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
   * The ordered testing sections (§ Workspace Structure): operational health,
   * testing progress, the test procedure queue with its three views and the
   * inspector, the exceptions, the audit lineage, then the testing metadata. Each
   * entry names the section id, its header, whether it has data, its body builder,
   * and an empty descriptor used when the data is absent (§ Empty States).
   */
  function primarySections(viewModel) {
    var context = viewModel.context;
    return [
      {
        id: 'health', kicker: 'Operational status', title: 'Testing health',
        present: true, body: function () { return buildHealthStrip(viewModel.testingHealth); }
      },
      {
        id: 'progress', kicker: 'Completion', title: 'Testing progress',
        description: 'Completed tests over the total recorded for the engagement. Real counts only — no estimated percentages.',
        present: viewModel.progress.total > 0,
        body: function () { return buildProgressBody(viewModel.progress); },
        empty: {
          icon: '◇', title: 'No tests yet',
          description: 'Testing progress appears here once tests are recorded for the engagement.'
        }
      },
      {
        id: 'queue', kicker: 'Operational queue', title: 'Test procedure queue',
        description: 'Every test procedure for the engagement. Switch between Test view, By control, and By result — the same dataset, regrouped — and select a test to open its Inspector, with the related control, sample selection, evidence used, and methodology reuse.',
        present: viewModel.queue.length > 0,
        body: function () { return buildQueueBody(viewModel.views, context); },
        empty: {
          icon: '◇', title: 'No tests yet',
          description: 'Test procedures appear here as they are performed for the engagement. Release 2 adds AI-drafted procedures, recommended samples, and proposed conclusions; Release 1 renders only the current testing state.'
        }
      },
      {
        id: 'exceptions', kicker: 'Results', title: 'Exceptions',
        description: 'The tests whose recorded result is an exception, each linking to the finding it raised.',
        present: true, body: function () { return buildExceptionsBody(viewModel.exceptions); }
      },
      {
        id: 'lineage', kicker: 'Relationships', title: 'Audit lineage',
        description: 'Where testing sits in the audit chain, from walkthrough through to report.',
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

  /** Renders the ready testing experience into the framework slots. */
  function renderReady(view, viewModel) {
    var P = presentation();

    AuditOS.workspaceFramework.configure(view, {
      header: viewModel.header,
      contextSummary: viewModel.ribbon,
      toolbar: viewModel.toolbar,
      filterBar: viewModel.filterBar
    });

    var canvas = el('div', 'aos-testing');
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
      description: 'AI-assisted testing — drafted test procedures, recommended sample selections, identified testing gaps, evaluated evidence, and proposed conclusions — will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
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
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'detail', label: 'Loading testing' })]);
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
        '. Regenerate the demo-data bundle and reload to restore the Testing Workspace.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders the Testing Workspace when it is the active workspace: the ready
   * experience once the state has loaded, the loading skeleton before that, and
   * the degraded explanation when no engagement is available.
   */
  function renderActiveTesting() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.TESTING) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.TESTING + '"]'
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

  AuditOS.testingWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      formatDate: formatDate,
      formatPeriod: formatPeriod,
      normalizeFrameworks: normalizeFrameworks,
      deriveCurrentEngagement: deriveCurrentEngagement,
      resolveStatusTone: resolveStatusTone,
      resolveResultTone: resolveResultTone,
      resolveRelatedControl: resolveRelatedControl,
      relatedControlLabel: relatedControlLabel,
      deriveEvidenceStatus: deriveEvidenceStatus,
      normalizeMethodologyReuse: normalizeMethodologyReuse,
      deriveTestRow: deriveTestRow,
      deriveQueue: deriveQueue,
      deriveTestingHealth: deriveTestingHealth,
      deriveTestingProgress: deriveTestingProgress,
      deriveTestingStatus: deriveTestingStatus,
      deriveExceptions: deriveExceptions,
      testView: testView,
      controlGroupView: controlGroupView,
      resultView: resultView,
      deriveViews: deriveViews,
      deriveLineage: deriveLineage,
      deriveRelationships: deriveRelationships,
      deriveActivity: deriveActivity,
      deriveMetadata: deriveMetadata,
      deriveMethodologyReuseItems: deriveMethodologyReuseItems,
      deriveApprovalHistory: deriveApprovalHistory,
      buildTestInspector: buildTestInspector
    },

    collectViewModel: collectViewModel,

    // Host-agnostic Inspector renderer (§9): data → one self-contained node,
    // mountable in any host. Release 1 mounts the fuller Queue in primary content.
    renderInspector: renderInspector,

    /**
     * Binds the Testing Workspace to the router and the Shared Audit State. Safe
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

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveTesting);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveTesting);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveTesting);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveTesting);
      }
      renderActiveTesting();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.testingWorkspace.init);
    } else {
      AuditOS.testingWorkspace.init();
    }
  }
})(window);
