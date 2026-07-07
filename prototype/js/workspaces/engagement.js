/**
 * AuditOS Engagement Workspace
 * Workspaces and Navigation — Chapter 12 (§12.8 Operational Workspaces) /
 * Workspace Architecture — Chapter 61 / Engagement Workspace — Chapter 63 /
 * Audit Lifecycle — Chapter 11 / Component Architecture — Chapter 74
 *
 * The operational entry point into one audit (GitHub Issue #19), built on the
 * Release 1 foundation completed in Issues #16–#18. It is NOT a KPI dashboard:
 * it answers "what is the current operational state of this audit, and what
 * should I work on next?" and guides the user down the audit lifecycle —
 * Walkthrough → Evidence → Controls → Testing → Findings → Reporting — where the
 * lifecycle is presented as navigation, not a process diagram.
 *
 * Layout (hybrid operational):
 *   Top    — current operational focus + engagement status, the prioritized
 *            Next actions, and Blocking items.
 *   Middle — the lifecycle as navigation cards; each stage shows its current
 *            operational status, pending work, progress, and a way in.
 *   Bottom — operational context: engagement summary, framework badges, team,
 *            an inspector, recent activity, and metadata.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to the Home
 * workspace. `collectViewModel` is the single place this workspace reads
 * `AuditOS.state`; it returns a declarative model of pure, offline-testable
 * derivations. The renderer configures the Shared Workspace Framework's
 * inherited skeleton (`AuditOS.workspaceFramework.configure`) and fills its
 * slots with compositions from the Enterprise Data Presentation System
 * (`AuditOS.presentation`) — no bespoke primitives, no duplicated components
 * (Component Design Patterns §81.4 — Composition Over Duplication).
 *
 * Release 1 renders only the existing JSON. It invents no AI behaviour, no
 * workflow engine, and no business logic. Two forward-compatibility seams keep
 * Release 2 pluggable without a UI redesign:
 *   - Frameworks are array-driven (`normalizeFrameworks`): a single framework
 *     renders today; a future engagement `frameworks` array renders every entry.
 *   - Walkthrough always exists as the first lifecycle stage even though no
 *     walkthrough data exists yet: it renders as "not started" with navigation
 *     and never fabricates progress, so a future walkthroughs collection simply
 *     fills it in.
 *
 * Presentation only. Every business value is read through `AuditOS.state`;
 * nothing is written. Sections with no data render shared Empty State
 * components; nothing is fabricated. AI surfaces are reserved presentation
 * regions — AI stays advisory and human approval remains mandatory. The
 * inspector's selection is memory-only presentation state.
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

  /**
   * The Shared Workspace Framework slots this workspace fills directly. The
   * header, context ribbon, toolbar, and filter bar are populated through
   * `AuditOS.workspaceFramework.configure`; these are the regions the workspace
   * owns beyond that declarative configuration.
   */
  var SLOTS = {
    CONTENT: 'primary-content',
    RELATED: 'related-information',
    AI: 'ai-recommendations',
    ACTIVITY: 'activity',
    FOOTER: 'workspace-footer'
  };

  /** Presentation tones shared by badges, markers, and progress. */
  var TONES = { INFO: 'info', SUCCESS: 'success', WARNING: 'warning', ERROR: 'error' };

  /** Engagement lifecycle status vocabulary of the demo-data (read, never invented). */
  var ENGAGEMENT_STATUS = { IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', PLANNING: 'Planning' };

  /** Lifecycle status → tone. */
  var STATUS_TONES = {
    'In Progress': TONES.INFO, 'Completed': TONES.SUCCESS, 'Planning': TONES.INFO,
    'Planned': TONES.INFO, 'On Hold': TONES.WARNING
  };

  /** Operational stage status vocabulary and its tones. */
  var STAGE_STATUS = { COMPLETE: 'Complete', ACTIVE: 'In progress', NOT_STARTED: 'Not started', RESOLVED: 'Resolved' };
  var STAGE_TONES = { 'Complete': TONES.SUCCESS, 'Resolved': TONES.SUCCESS, 'In progress': TONES.INFO, 'Not started': null, 'Draft': TONES.INFO };

  /** Business status vocabulary used to tone activity and blocking work. */
  var REVIEW_STATUS = { APPROVED: 'Approved', PENDING_REVIEW: 'Pending Review', REJECTED: 'Rejected' };
  var SEVERITY = { HIGH: 'High' };
  var FINDING_STATUS = { OPEN: 'Open' };
  var TEST_RESULT = { FAIL: 'Fail' };

  /** Deterministic month labels so dates never depend on runtime locale. */
  var MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** Maximum entries per list so sections stay scannable. */
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
    if (typeof isoDate !== 'string') {
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

  /** Whole-number percentage; an empty total reads as zero, never NaN. */
  function formatPercent(part, total) {
    if (!total || total <= 0) {
      return 0;
    }
    return Math.round((part / total) * 100);
  }

  /** Resolves an engagement lifecycle status to a presentation tone. */
  function statusTone(status) {
    return STATUS_TONES[status] || null;
  }

  /**
   * The current engagement: the first in-progress engagement in record order,
   * falling back to the first engagement, or null when none exist. Identical to
   * the Home workspace's rule so both surfaces stay on the same engagement
   * (persistent context, §12.12).
   */
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

  /**
   * The frameworks attached to an engagement, always as an array. This is the
   * Release 1 → Release 2 extensibility seam: a future engagement that declares
   * a `frameworks` array renders every entry automatically; today's data
   * declares a single `framework` string, which becomes a one-element array.
   * Nothing is fabricated — an engagement with neither yields an empty array.
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

  /**
   * The current operational focus and engagement status — two distinct concepts
   * (§63.9 / audit lifecycle Chapter 11). The status reads straight from the
   * JSON. The focus is the earliest incomplete operational stage derived from
   * the real figures, so it names what the audit is actually working on rather
   * than a lifecycle label. Walkthrough is excluded from the focus derivation
   * because the demo data carries no walkthrough progress to assess.
   */
  function deriveOperationalFocus(engagement, operational) {
    var status = engagement ? engagement.status : '';
    var ops = operational || {};
    var evidence = ops.evidence || {};
    var testing = ops.testing || {};
    var findings = ops.findings || {};
    var report = ops.report || null;

    var evidenceItems = evidence.evidenceItems || 0;
    var approved = evidence.approved || 0;
    var tests = testing.tests || 0;
    var testsExecuted = (testing.passed || 0) + (testing.failed || 0);
    var testsPending = testing.pending || 0;
    var openFindings = findings.open || 0;
    var reportFinal = report ? /final|issued|published|complete/i.test(report.status || '') : false;

    var focus;
    if (status === ENGAGEMENT_STATUS.COMPLETED) {
      focus = 'Engagement complete';
    } else if (evidenceItems === 0 && tests === 0) {
      focus = status === ENGAGEMENT_STATUS.PLANNING ? 'Planning & scoping' : 'Getting started';
    } else if (evidenceItems > 0 && approved < evidenceItems) {
      focus = 'Evidence collection';
    } else if (tests > 0 && (testsPending > 0 || testsExecuted < tests)) {
      focus = 'Control testing';
    } else if (openFindings > 0) {
      focus = 'Findings & remediation';
    } else if (report && !reportFinal) {
      focus = 'Reporting';
    } else {
      focus = 'Reporting';
    }
    return { focus: focus, status: status };
  }

  /**
   * The prioritized next actions — what to work on next, in lifecycle order.
   * Each is a real, actionable item that navigates into its workspace. Only
   * work that exists appears, except the Walkthrough action, which always leads:
   * walkthroughs are the first knowledge step and the demo data holds none yet,
   * so Release 1 surfaces the entry point without fabricating a count.
   */
  function deriveNextActions(operational, workspaceRegistry) {
    if (!workspaceRegistry) {
      return [];
    }
    var ops = operational || {};
    var evidence = ops.evidence || {};
    var requests = ops.requests || {};
    var testing = ops.testing || {};
    var findings = ops.findings || {};
    var report = ops.report || null;
    var ids = workspaceRegistry.IDS;

    function pathFor(id) {
      var workspace = workspaceRegistry.findById(id);
      return workspace ? workspace.path : null;
    }

    var actions = [];
    actions.push({
      title: 'Conduct walkthroughs',
      detail: 'No walkthrough sessions recorded yet — walkthroughs will refine requirements, controls, and evidence',
      path: pathFor(ids.WALKTHROUGH),
      tone: TONES.INFO
    });
    if ((evidence.pendingReview || 0) > 0) {
      actions.push({
        title: 'Review ' + evidence.pendingReview + ' evidence ' + plural(evidence.pendingReview, 'item'),
        detail: 'Awaiting an approval decision',
        path: pathFor(ids.EVIDENCE),
        tone: TONES.WARNING
      });
    }
    if ((requests.pending || 0) > 0) {
      actions.push({
        title: 'Fulfil ' + requests.pending + ' evidence ' + plural(requests.pending, 'request'),
        detail: 'Requests not yet submitted by the client',
        path: pathFor(ids.EVIDENCE),
        tone: TONES.INFO
      });
    }
    if ((testing.pending || 0) > 0) {
      actions.push({
        title: 'Complete ' + testing.pending + ' test ' + plural(testing.pending, 'procedure'),
        detail: 'Control testing in progress',
        path: pathFor(ids.TESTING),
        tone: TONES.WARNING
      });
    }
    if ((findings.open || 0) > 0) {
      actions.push({
        title: 'Resolve ' + findings.open + ' open ' + plural(findings.open, 'finding'),
        detail: 'Remediation and follow-up outstanding',
        path: pathFor(ids.FINDINGS),
        tone: TONES.WARNING
      });
    }
    if (report && report.status) {
      actions.push({
        title: 'Continue the report',
        detail: report.title + ' · ' + report.status + (report.version ? ' v' + report.version : ''),
        path: pathFor(ids.REPORTING),
        tone: TONES.INFO
      });
    }
    return actions;
  }

  /**
   * Blocking items — work at risk right now: rejected evidence needing
   * resubmission, failed test procedures, and high-severity open findings. Each
   * derives from a real record and navigates into its workspace. An engagement
   * with nothing at risk yields an empty list (and a reassuring empty state).
   */
  function deriveBlockingItems(findings, evidence, tests, workspaceRegistry) {
    var ids = workspaceRegistry ? workspaceRegistry.IDS : {};
    function pathFor(id) {
      var workspace = workspaceRegistry && id ? workspaceRegistry.findById(id) : null;
      return workspace ? workspace.path : null;
    }

    var blocking = [];
    asArray(evidence)
      .filter(function (item) { return item.reviewStatus === REVIEW_STATUS.REJECTED; })
      .forEach(function (item) {
        blocking.push({
          title: 'Evidence rejected: ' + item.title,
          description: 'Resubmission required before testing can rely on it',
          meta: formatDate(item.uploadedOn),
          tone: TONES.ERROR,
          critical: true,
          path: pathFor(ids.EVIDENCE)
        });
      });
    asArray(tests)
      .filter(function (test) { return test.result === TEST_RESULT.FAIL; })
      .forEach(function (test) {
        blocking.push({
          title: 'Failed test ' + test.id,
          description: (test.procedure || 'Test procedure') + ' · Control ' + (test.controlId || ''),
          meta: test.workingPaperId || '',
          tone: TONES.WARNING,
          path: pathFor(ids.TESTING)
        });
      });
    asArray(findings)
      .filter(function (finding) { return finding.status === FINDING_STATUS.OPEN && finding.severity === SEVERITY.HIGH; })
      .forEach(function (finding) {
        blocking.push({
          title: finding.title,
          description: 'High-severity finding · Due ' + formatDate(finding.targetClosureDate),
          meta: finding.id,
          tone: TONES.ERROR,
          critical: true,
          path: pathFor(ids.FINDINGS)
        });
      });
    return blocking.slice(0, LIST_LIMIT);
  }

  /**
   * The Audit Health strip — six operational indicators, status-bar style (like
   * an editor status bar, not KPI cards). Each names a lifecycle concern —
   * Walkthrough, Evidence, Testing, Approvals, Findings, Report — with a short
   * operational status and a health tone, so the moment an engagement opens the
   * user knows "evidence is behind" or "testing is complete" without scanning.
   * Each indicator navigates into the relevant workspace. Every value is real;
   * Walkthrough reads "Waiting" (no sessions) rather than a fabricated number.
   */
  function deriveAuditHealth(operational, findings, workspaceRegistry) {
    if (!workspaceRegistry) {
      return [];
    }
    var ops = operational || {};
    var evidence = ops.evidence || {};
    var testing = ops.testing || {};
    var findingsSummary = ops.findings || {};
    var report = ops.report || null;
    var ids = workspaceRegistry.IDS;
    function pathFor(id) {
      var workspace = workspaceRegistry.findById(id);
      return workspace ? workspace.path : null;
    }

    var evidenceItems = evidence.evidenceItems || 0;
    var evidenceOutstanding = Math.max(0, evidenceItems - (evidence.approved || 0));
    var pendingReview = evidence.pendingReview || 0;
    var testsTotal = testing.tests || 0;
    var testsPending = testing.pending || 0;
    var findingsOpen = findingsSummary.open || 0;
    var findingsTotal = findingsSummary.findings || 0;
    var criticalOpen = asArray(findings).filter(function (finding) {
      return finding.status === FINDING_STATUS.OPEN && finding.severity === SEVERITY.HIGH;
    }).length;

    var evidenceHealth = evidenceItems === 0 ? { status: 'Awaiting', tone: null }
      : evidenceOutstanding > 0 ? { status: evidenceOutstanding + ' Pending', tone: TONES.WARNING }
        : { status: 'Complete', tone: TONES.SUCCESS };
    var testingHealth = testsTotal === 0 ? { status: 'Awaiting', tone: null }
      : testsPending > 0 ? { status: testsPending + ' Remaining', tone: TONES.WARNING }
        : { status: 'Complete', tone: TONES.SUCCESS };
    var approvalsHealth = pendingReview > 0
      ? { status: pendingReview + ' Waiting', tone: TONES.WARNING }
      : { status: 'Clear', tone: TONES.SUCCESS };
    var findingsHealth = criticalOpen > 0 ? { status: criticalOpen + ' Critical', tone: TONES.ERROR }
      : findingsOpen > 0 ? { status: findingsOpen + ' Open', tone: TONES.WARNING }
        : findingsTotal > 0 ? { status: 'Clear', tone: TONES.SUCCESS }
          : { status: 'None', tone: null };
    var reportHealth = !report ? { status: 'Not started', tone: null }
      : /final|issued|published|complete/i.test(report.status || '') ? { status: 'Final', tone: TONES.SUCCESS }
        : { status: 'Updating', tone: TONES.INFO };

    return [
      { key: 'walkthrough', label: 'Walkthrough', status: 'Waiting', tone: null, path: pathFor(ids.WALKTHROUGH) },
      { key: 'evidence', label: 'Evidence', status: evidenceHealth.status, tone: evidenceHealth.tone, path: pathFor(ids.EVIDENCE) },
      { key: 'testing', label: 'Testing', status: testingHealth.status, tone: testingHealth.tone, path: pathFor(ids.TESTING) },
      { key: 'approvals', label: 'Approvals', status: approvalsHealth.status, tone: approvalsHealth.tone, path: pathFor(ids.EVIDENCE) },
      { key: 'findings', label: 'Findings', status: findingsHealth.status, tone: findingsHealth.tone, path: pathFor(ids.FINDINGS) },
      { key: 'report', label: 'Report', status: reportHealth.status, tone: reportHealth.tone, path: pathFor(ids.REPORTING) }
    ];
  }

  /**
   * The audit lifecycle as navigation (§63.15 / §12.13): one card per stage in
   * operational order — Walkthrough → Evidence → Controls → Testing → Findings →
   * Reporting. Each stage carries its current operational status, its pending
   * work, an optional progress ratio, a caption, and the workspace it opens.
   * The lifecycle is navigation, not a process diagram; every figure is real.
   */
  function deriveLifecycle(workspaceRegistry, operational) {
    if (!workspaceRegistry) {
      return [];
    }
    var ops = operational || {};
    var controls = ops.controls || {};
    var evidence = ops.evidence || {};
    var requests = ops.requests || {};
    var testing = ops.testing || {};
    var findings = ops.findings || {};
    var report = ops.report || null;
    var ids = workspaceRegistry.IDS;

    var evidenceItems = evidence.evidenceItems || 0;
    var evidenceApproved = evidence.approved || 0;
    var testsTotal = testing.tests || 0;
    var testsExecuted = (testing.passed || 0) + (testing.failed || 0);
    var findingsTotal = findings.findings || 0;
    var findingsOpen = findings.open || 0;

    var stages = [
      {
        id: ids.WALKTHROUGH, label: 'Walkthrough',
        status: STAGE_STATUS.NOT_STARTED,
        pending: 'No walkthrough sessions',
        detail: 'Knowledge acquisition — will refine requirements, controls, and evidence',
        progress: null
      },
      {
        id: ids.EVIDENCE, label: 'Evidence',
        status: ratioStatus(evidenceApproved, evidenceItems),
        pending: (evidence.pendingReview || 0) > 0 ? evidence.pendingReview + ' pending review' : '',
        detail: evidenceItems > 0 ? evidenceApproved + ' of ' + evidenceItems + ' approved' : 'Not yet collected',
        progress: evidenceItems > 0 ? { value: evidenceApproved, total: evidenceItems } : null
      },
      {
        id: ids.CONTROLS, label: 'Controls',
        status: (controls.controls || 0) > 0 ? STAGE_STATUS.ACTIVE : STAGE_STATUS.NOT_STARTED,
        pending: '',
        detail: (controls.controls || 0) + ' controls in scope',
        progress: null
      },
      {
        id: ids.TESTING, label: 'Testing',
        status: ratioStatus(testsExecuted, testsTotal),
        pending: (testing.pending || 0) > 0 ? testing.pending + ' pending' : '',
        detail: testsTotal > 0 ? (testing.passed || 0) + ' of ' + testsTotal + ' passed' : 'Not yet started',
        progress: testsTotal > 0 ? { value: testsExecuted, total: testsTotal } : null
      },
      {
        id: ids.FINDINGS, label: 'Findings',
        status: findingsTotal === 0 ? STAGE_STATUS.NOT_STARTED : (findingsOpen > 0 ? STAGE_STATUS.ACTIVE : STAGE_STATUS.RESOLVED),
        pending: findingsOpen > 0 ? findingsOpen + ' open' : '',
        detail: findingsTotal > 0 ? findingsOpen + ' open of ' + findingsTotal : 'None recorded',
        progress: findingsTotal > 0 ? { value: findingsTotal - findingsOpen, total: findingsTotal } : null
      },
      {
        id: ids.REPORTING, label: 'Reporting',
        status: report ? (report.status || STAGE_STATUS.ACTIVE) : STAGE_STATUS.NOT_STARTED,
        pending: '',
        detail: report ? 'Continuously evolving' + (report.version ? ' · v' + report.version : '') : 'Not yet started',
        progress: null
      }
    ];

    return stages.map(function (stage) {
      var workspace = workspaceRegistry.findById(stage.id);
      return {
        label: stage.label,
        path: workspace ? workspace.path : null,
        status: stage.status,
        statusTone: resolveStageTone(stage.status),
        pending: stage.pending,
        detail: stage.detail,
        progress: stage.progress
      };
    });
  }

  /** Status from a completed/total pair with a not-started fallback. */
  function ratioStatus(done, total) {
    if (!total) {
      return STAGE_STATUS.NOT_STARTED;
    }
    if (done >= total) {
      return STAGE_STATUS.COMPLETE;
    }
    return done > 0 ? STAGE_STATUS.ACTIVE : STAGE_STATUS.NOT_STARTED;
  }

  /** Resolves an operational stage status to a tone (Draft-style report status included). */
  function resolveStageTone(status) {
    if (Object.prototype.hasOwnProperty.call(STAGE_TONES, status)) {
      return STAGE_TONES[status];
    }
    return TONES.INFO;
  }

  /** Naive English pluralization for whole-count action labels. */
  function plural(count, noun) {
    return count === 1 ? noun : noun + 's';
  }

  /**
   * Engagement members (§63.16): the client-side participants of the engagement,
   * read from the point-of-contact records for the engagement's company. Their
   * responsibilities resolve through the team catalog. Name, role,
   * responsibilities, and status all read from JSON.
   */
  function deriveTeam(pocs, teams, companyId) {
    var teamsById = {};
    asArray(teams).forEach(function (team) {
      teamsById[team.id] = team;
    });
    return asArray(pocs)
      .filter(function (poc) { return poc.companyId === companyId; })
      .slice(0, LIST_LIMIT)
      .map(function (poc) {
        var team = teamsById[poc.teamId];
        var responsibilities = team ? team.name : (poc.teamId || '');
        if (team && asArray(team.responsibleControlFamilies).length > 0) {
          responsibilities += ' · ' + team.responsibleControlFamilies.join(', ');
        }
        return {
          name: poc.name,
          role: poc.role,
          designation: poc.designation,
          responsibilities: responsibilities,
          status: poc.status,
          contact: poc.preferredCommunication
        };
      });
  }

  /**
   * Related objects (§12.13 relationship navigation): the engagement's
   * operational domains as a count-annotated list, each linking to its
   * workspace. Only domains with data appear.
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
    return related.filter(function (item) {
      return item.present;
    }).map(function (item) {
      var workspace = workspaceRegistry.findById(item.id);
      return { title: item.title, meta: item.meta, path: workspace ? workspace.path : null };
    });
  }

  /**
   * Recent engagement activity (§63.11): evidence receipts, evidence request
   * submissions, and the report's current state, newest first. Every event
   * derives from a real record.
   */
  function deriveActivity(evidence, requests, reportDocument) {
    var events = [];
    asArray(evidence).forEach(function (item) {
      if (!item.uploadedOn) {
        return;
      }
      events.push({
        title: 'Evidence received: ' + item.title,
        meta: 'Review status: ' + item.reviewStatus,
        timestamp: formatDate(item.uploadedOn),
        date: item.uploadedOn,
        kind: 'review', value: item.reviewStatus
      });
    });
    asArray(requests).forEach(function (request) {
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
    events.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    if (reportDocument && reportDocument.status) {
      events.unshift({
        title: 'Report ' + String(reportDocument.status).toLowerCase() + ': ' + reportDocument.title,
        meta: reportDocument.version ? 'Version ' + reportDocument.version : '',
        timestamp: '', date: '', kind: 'review', value: reportDocument.status
      });
    }
    return events.slice(0, LIST_LIMIT);
  }

  /**
   * Engagement metadata (§8): the presentation metadata fields — created, last
   * updated, version, owner, and tags — derived from the engagement, its
   * company, and the engagements document metadata.
   */
  function deriveMetadata(engagement, company, engagementsMetadata) {
    var meta = engagementsMetadata || {};
    var frameworks = normalizeFrameworks(engagement);
    var tags = frameworks.slice();
    if (engagement && engagement.auditType) {
      tags.push(engagement.auditType);
    }
    if (company && company.customerTier) {
      tags.push(company.customerTier);
    }
    return {
      created: company && company.createdAt ? formatDate(company.createdAt) : '',
      updated: meta.generatedAt ? formatDate(String(meta.generatedAt).slice(0, 10)) : '',
      version: meta.version || '',
      owner: engagement ? (engagement.engagementLead || '') + (engagement.auditor ? ' · ' + engagement.auditor : '') : '',
      tags: tags
    };
  }

  /**
   * Engagement timeline events for the Inspector (§63.11): the dated engagement
   * milestones and open-finding closure targets, chronological.
   */
  function deriveTimeline(engagement, findings) {
    if (!engagement) {
      return [];
    }
    var events = [];
    if (engagement.auditPeriod) {
      events.push({ date: engagement.auditPeriod.startDate, title: 'Audit period begins' });
      events.push({ date: engagement.auditPeriod.endDate, title: 'Audit period ends' });
    }
    if (engagement.fieldworkPeriod) {
      events.push({ date: engagement.fieldworkPeriod.startDate, title: 'Fieldwork begins' });
      events.push({ date: engagement.fieldworkPeriod.endDate, title: 'Fieldwork ends' });
    }
    if (engagement.reportReleaseDate) {
      events.push({ date: engagement.reportReleaseDate, title: 'Report release' });
    }
    asArray(findings)
      .filter(function (finding) { return finding.status === FINDING_STATUS.OPEN && finding.targetClosureDate; })
      .forEach(function (finding) {
        events.push({ date: finding.targetClosureDate, title: 'Finding closure target: ' + finding.id });
      });
    return events
      .filter(function (event) { return Boolean(event.date); })
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })
      .slice(0, LIST_LIMIT)
      .map(function (event) { return { timestamp: formatDate(event.date), title: event.title }; });
  }

  // ------------------------------------------------------------------
  // View model — the single place this workspace reads AuditOS.state.
  // ------------------------------------------------------------------

  /** Reads the first dataset document an engagement owns in a collection. */
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

  /**
   * Collects everything the Engagement Workspace presents from the Shared Audit
   * State. Returns null while the state is not ready, and a degraded model when
   * no engagement exists (§15.12).
   */
  function collectViewModel(state, workspaceRegistry) {
    if (!state || !state.isReady()) {
      return null;
    }

    var status = state.getStatus();
    var engagementsDocument = state.getDocument('engagements') || {};
    var engagements = state.listRecords('engagements');
    var engagement = deriveCurrentEngagement(engagements);
    if (!engagement) {
      return { degraded: true, status: status };
    }

    var companies = state.listRecords('companies');
    var company = findById(companies, engagement.companyId);
    var pocs = state.listRecords('pocs');
    var teams = state.listRecords('teams');

    var controlsDocument = readEngagementDocument(state, 'controls', engagement.id) || {};
    var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
    var requestsDocument = readEngagementDocument(state, 'evidence-requests', engagement.id) || {};
    var testingDocument = readEngagementDocument(state, 'testing', engagement.id) || {};
    var findingsDocument = readEngagementDocument(state, 'findings', engagement.id) || {};
    var reportsDocument = readEngagementDocument(state, 'reports', engagement.id) || {};

    var evidenceRecords = evidenceDocument.evidence || [];
    var requestRecords = requestsDocument.requests || [];
    var findingRecords = findingsDocument.findings || [];
    var testRecords = testingDocument.tests || [];
    var reportDocument = reportsDocument.document || null;

    // The operational figures every stage, action, and relationship reads.
    var operational = {
      controls: controlsDocument.summary || {},
      evidence: evidenceDocument.summary || {},
      testing: testingDocument.summary || {},
      findings: findingsDocument.summary || {},
      requests: requestsDocument.summary || {},
      report: reportDocument
    };

    var frameworks = normalizeFrameworks(engagement);
    var focus = deriveOperationalFocus(engagement, operational);
    var team = deriveTeam(pocs, teams, engagement.companyId);
    var timeline = deriveTimeline(engagement, findingRecords);
    var relationships = deriveRelationships(workspaceRegistry, operational);
    var teamSize = [engagement.engagementManager, engagement.engagementLead]
      .concat(asArray(engagement.engagementTeam))
      .filter(function (id, index, all) { return id && all.indexOf(id) === index; }).length;

    return {
      degraded: false,
      status: status,
      engagement: engagement,
      company: company,
      frameworks: frameworks,
      focus: focus,
      operational: operational,

      // Header is workspace identity only. Operational state (focus, status,
      // health) lives in the operational band, never restated here.
      header: {
        eyebrow: engagement.engagementCode + ' · ' + (engagement.auditType || '') + ' audit',
        title: company ? company.name : engagement.companyId,
        meta: engagement.name + ' · ' + (engagement.auditType || '') + ' audit',
        frameworks: frameworks,
        lastUpdated: engagementsDocument.metadata && engagementsDocument.metadata.generatedAt
          ? 'Updated ' + formatDate(String(engagementsDocument.metadata.generatedAt).slice(0, 10))
          : '',
        actions: [
          { label: 'Engagement report', href: '#/reporting', variant: 'subtle' },
          { label: 'View controls', href: '#/controls', variant: 'subtle' }
        ]
      },

      // Context ribbon carries persistent engagement identity — not operational
      // state, which the Current Focus and Audit Health band own.
      ribbon: [
        { label: 'Client', value: company ? company.name : engagement.companyId },
        { label: 'Audit period', value: formatPeriod(engagement.auditPeriod) },
        { label: 'Engagement lead', value: engagement.engagementLead }
      ],

      toolbar: { search: { placeholder: 'Search this engagement' } },
      filterBar: { dropdowns: [{ label: 'Framework', options: ['All frameworks'].concat(frameworks) }] },

      focusPanel: {
        focus: focus.focus,
        status: engagement.status,
        statusTone: statusTone(engagement.status)
      },
      auditHealth: deriveAuditHealth(operational, findingRecords, workspaceRegistry),
      nextActions: deriveNextActions(operational, workspaceRegistry),
      blocking: deriveBlockingItems(findingRecords, evidenceRecords, testRecords, workspaceRegistry),
      lifecycle: deriveLifecycle(workspaceRegistry, operational),

      summary: {
        frameworks: frameworks,
        status: engagement.status,
        statusTone: statusTone(engagement.status),
        rows: [
          { label: 'Client', value: company ? company.name : engagement.companyId },
          { label: 'Engagement', value: engagement.name + ' · ' + engagement.engagementCode },
          { label: 'Audit period', value: formatPeriod(engagement.auditPeriod) },
          { label: 'Engagement period', value: formatPeriod(engagement.fieldworkPeriod) },
          { label: 'Engagement lead', value: engagement.engagementLead },
          { label: 'Assigned team', value: (engagement.auditor || '') + ' · ' + teamSize + ' members' }
        ]
      },

      team: team,
      inspector: buildInspectorEntities(engagement, company, frameworks, team, timeline, relationships, operational),
      metadata: deriveMetadata(engagement, company, engagementsDocument.metadata),
      relationships: relationships,
      activity: deriveActivity(evidenceRecords, requestRecords, reportDocument),

      footer: [
        { label: 'Environment', value: 'Static prototype' },
        { label: 'Demo status', value: status.demoDataLoaded ? 'Demo data loaded' : 'Demo data degraded' }
      ]
    };
  }

  /**
   * The selectable Inspector entities (§9): the engagement itself, then one per
   * attached framework. Selecting an entity opens its Inspector Panel
   * configuration. Pure.
   */
  function buildInspectorEntities(engagement, company, frameworks, team, timeline, relationships, operational) {
    var ops = operational || {};
    var entities = [];

    entities.push({
      key: 'engagement',
      label: engagement.name,
      caption: engagement.engagementCode,
      inspector: {
        eyebrow: company ? company.name : engagement.companyId,
        title: engagement.name,
        subtitle: engagement.engagementCode + ' · ' + engagement.status,
        badges: frameworks.map(function (framework) {
          return { label: framework, tone: TONES.INFO };
        }).concat([{ label: engagement.status, tone: statusTone(engagement.status) }]),
        sections: [
          {
            title: 'Properties', kind: 'properties', columns: 2,
            rows: [
              { label: 'Client', value: company ? company.name : engagement.companyId },
              { label: 'Engagement code', value: engagement.engagementCode },
              { label: 'Status', value: engagement.status },
              { label: 'Audit type', value: engagement.auditType || '' },
              { label: 'Audit period', value: formatPeriod(engagement.auditPeriod) },
              { label: 'Engagement period', value: formatPeriod(engagement.fieldworkPeriod) },
              { label: 'Report release', value: formatDate(engagement.reportReleaseDate) },
              { label: 'Auditor', value: engagement.auditor || '' },
              { label: 'Engagement lead', value: engagement.engagementLead || '' },
              { label: 'Engagement manager', value: engagement.engagementManager || '' },
              { label: 'Control set', value: engagement.controlSet || '' },
              { label: 'Report', value: engagement.reportId || '' }
            ]
          },
          {
            title: 'Frameworks', kind: 'list',
            items: frameworks.map(function (framework) { return { title: framework, tone: TONES.INFO }; })
          },
          {
            title: 'Team', kind: 'list',
            items: asArray(team).slice(0, 5).map(function (member) {
              return { title: member.name, description: member.role, tone: TONES.INFO };
            })
          },
          { title: 'Timeline', kind: 'timeline', events: asArray(timeline) },
          {
            title: 'Relationships', kind: 'relationships',
            items: asArray(relationships).map(function (item) {
              return { title: item.title, meta: item.meta, tone: TONES.INFO };
            })
          }
        ],
        actions: [
          { label: 'Open report', href: '#/reporting', variant: 'primary' },
          { label: 'View controls', href: '#/controls', variant: 'subtle' }
        ]
      }
    });

    frameworks.forEach(function (framework) {
      entities.push({
        key: 'framework:' + framework,
        label: framework,
        caption: 'Framework',
        inspector: {
          eyebrow: 'Framework',
          title: framework,
          subtitle: engagement.name + ' · ' + engagement.status,
          badges: [{ label: engagement.status, tone: statusTone(engagement.status) }],
          sections: [
            {
              title: 'Properties', kind: 'properties',
              rows: [
                { label: 'Framework', value: framework },
                { label: 'Status', value: engagement.status },
                { label: 'Controls in scope', value: String((ops.controls && ops.controls.controls) || 0) },
                { label: 'Evidence approved', value: ((ops.evidence && ops.evidence.approved) || 0) + ' of ' + ((ops.evidence && ops.evidence.evidenceItems) || 0) },
                { label: 'Tests passed', value: ((ops.testing && ops.testing.passed) || 0) + ' of ' + ((ops.testing && ops.testing.tests) || 0) },
                { label: 'Open findings', value: String((ops.findings && ops.findings.open) || 0) }
              ]
            },
            {
              title: 'Relationships', kind: 'relationships',
              items: asArray(relationships).map(function (item) {
                return { title: item.title, meta: item.meta, tone: TONES.INFO };
              })
            }
          ]
        }
      });
    });

    return entities;
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

  /**
   * Builds one Section component: an eyebrow, a title, an optional description,
   * then a body node. The per-section modifier is layout identity only.
   */
  function buildSection(id, meta, bodyNode) {
    var section = el('section', 'aos-section aos-engagement__section aos-engagement__section--' + id);
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

  /** Builds inline framework Status Badges from the frameworks array. */
  function buildFrameworkBadges(frameworks) {
    var P = presentation();
    var wrap = el('span', 'aos-engagement__framework-badges');
    asArray(frameworks).forEach(function (framework) {
      wrap.appendChild(P.statusBadge({ label: framework, tone: TONES.INFO }));
    });
    return wrap;
  }

  /**
   * Builds the operational status body (top band): the current focus and status,
   * then the prioritized Next actions beside the Blocking items. Answers "what
   * should I work on next?".
   */
  function buildOperationalStatusBody(model) {
    var P = presentation();
    var surface = el('div', 'aos-surface aos-surface--padded aos-engagement__status');

    // Focus header: operational focus (primary) and engagement status (secondary).
    var focusHeader = el('div', 'aos-engagement__focus');
    var focusMain = el('div', 'aos-engagement__focus-main');
    focusMain.appendChild(el('span', 'aos-engagement__focus-label', 'Current focus'));
    focusMain.appendChild(el('span', 'aos-engagement__focus-value', model.focusPanel.focus));
    focusHeader.appendChild(focusMain);

    var statusWrap = el('div', 'aos-engagement__focus-status');
    statusWrap.appendChild(el('span', 'aos-engagement__focus-label', 'Status'));
    statusWrap.appendChild(P.statusBadge({ label: model.focusPanel.status, tone: model.focusPanel.statusTone }));
    focusHeader.appendChild(statusWrap);
    surface.appendChild(focusHeader);

    // Audit Health — a slim, clickable operational status strip (editor
    // status-bar style, not cards) immediately below the current focus, so the
    // engagement's health reads at a glance. It is the single home for "what is
    // the state?"; no other region restates the same figures.
    surface.appendChild(buildAuditHealth(model.auditHealth));

    // Next actions and blocking items, side by side.
    var lists = el('div', 'aos-engagement__status-lists');

    var nextActions = asArray(model.nextActions).map(function (action) {
      return {
        title: action.title,
        description: action.detail,
        tone: action.tone,
        actions: action.path ? [{ label: 'Open', href: '#/' + action.path }] : []
      };
    });
    lists.appendChild(buildStatusColumn('Next actions', nextActions.length > 0
      ? P.itemList(nextActions)
      : P.emptyState({ icon: '✓', title: 'Nothing waiting', description: 'Actions appear here as work becomes available.' })));

    var blocking = asArray(model.blocking).map(function (item) {
      return {
        title: item.title,
        description: item.description,
        meta: item.meta,
        tone: item.tone,
        critical: item.critical
      };
    });
    lists.appendChild(buildStatusColumn('Blocking items', blocking.length > 0
      ? P.itemList(blocking)
      : P.emptyState({ icon: '✓', title: 'Nothing blocking', description: 'Rejected evidence, failed tests, and high-severity findings surface here.' })));

    surface.appendChild(lists);
    return surface;
  }

  /**
   * Builds the Audit Health strip: a row of clickable operational indicators,
   * each a tone dot, a label, and a short status. The status text carries the
   * meaning (the dot only reinforces the tone), so health reads without relying
   * on color. Indicators with a path are links into their workspace.
   */
  function buildAuditHealth(items) {
    var strip = el('div', 'aos-engagement__health');
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', 'Audit health');
    asArray(items).forEach(function (item) {
      var node = el(item.path ? 'a' : 'span', 'aos-engagement__health-item');
      if (item.path) {
        node.setAttribute('href', '#/' + item.path);
      }
      node.setAttribute('aria-label', item.label + ': ' + item.status);
      var dot = el('span', 'aos-engagement__health-dot' + (item.tone ? ' aos-engagement__health-dot--' + item.tone : ''));
      dot.setAttribute('aria-hidden', 'true');
      node.appendChild(dot);
      node.appendChild(el('span', 'aos-engagement__health-label', item.label));
      node.appendChild(el('span', 'aos-engagement__health-status', item.status));
      strip.appendChild(node);
    });
    return strip;
  }

  /** Builds one titled column of the operational status band. */
  function buildStatusColumn(title, bodyNode) {
    var column = el('div', 'aos-engagement__status-column');
    column.appendChild(el('h3', 'aos-engagement__status-title', title));
    column.appendChild(bodyNode);
    return column;
  }

  /**
   * Builds the lifecycle body: one navigation card per stage. Each card is a
   * link into its workspace and shows the stage's operational status, pending
   * work, caption, and (where a ratio exists) a slim progress track.
   */
  function buildLifecycleBody(lifecycle) {
    var P = presentation();
    var grid = el('div', 'aos-engagement__lifecycle');
    asArray(lifecycle).forEach(function (stage) {
      var card = el(stage.path ? 'a' : 'div', 'aos-card aos-card--interactive aos-engagement__stage');
      if (stage.path) {
        card.setAttribute('href', '#/' + stage.path);
        card.setAttribute('aria-label', stage.label + ' — ' + stage.status + (stage.pending ? ' · ' + stage.pending : ''));
      }

      var head = el('div', 'aos-engagement__stage-head');
      head.appendChild(el('span', 'aos-engagement__stage-name', stage.label));
      head.appendChild(P.statusBadge({ label: stage.status, tone: stage.statusTone }));
      card.appendChild(head);

      var body = el('div', 'aos-card__body aos-engagement__stage-body');
      body.appendChild(el('span', 'aos-engagement__stage-detail', stage.detail));
      if (stage.pending) {
        body.appendChild(el('span', 'aos-engagement__stage-pending', stage.pending));
      }
      if (stage.progress && stage.progress.total > 0) {
        body.appendChild(buildSlimProgress(stage.progress.value, stage.progress.total));
      }
      card.appendChild(body);

      var arrow = el('span', 'aos-engagement__stage-arrow', '→');
      arrow.setAttribute('aria-hidden', 'true');
      card.appendChild(arrow);
      grid.appendChild(card);
    });
    return grid;
  }

  /**
   * Builds a slim, decorative progress track (the numbers already read as text
   * in the stage detail, so the bar is hidden from assistive technology). Reuses
   * the shared Progress component classes — no new primitive.
   */
  function buildSlimProgress(value, total) {
    var wrap = el('div', 'aos-progress aos-engagement__stage-progress');
    wrap.setAttribute('aria-hidden', 'true');
    var track = el('div', 'aos-progress__track');
    var indicator = el('div', 'aos-progress__indicator');
    indicator.style.width = formatPercent(value, total) + '%';
    track.appendChild(indicator);
    wrap.appendChild(track);
    return wrap;
  }

  /** Builds the compact engagement summary: framework badges over a property grid. */
  function buildSummaryBody(summary) {
    var P = presentation();
    var surface = el('div', 'aos-surface aos-surface--padded aos-engagement__summary');
    var rows = [
      { label: 'Current status', node: P.statusBadge({ label: summary.status, tone: summary.statusTone }) },
      { label: 'Frameworks', node: buildFrameworkBadges(summary.frameworks) }
    ].concat(asArray(summary.rows));
    surface.appendChild(P.propertyGrid(rows, { columns: 2 }));
    return surface;
  }

  /** Builds the Team body: one Entity Card per participating member. */
  function buildTeamBody(team) {
    var P = presentation();
    var grid = el('div', 'aos-engagement__team');
    asArray(team).forEach(function (member) {
      grid.appendChild(P.entityCard({
        title: member.name,
        subtitle: member.designation,
        badge: { label: member.role, tone: TONES.INFO },
        facts: [
          { term: 'Responsibilities', detail: member.responsibilities },
          { term: 'Status', detail: member.status },
          { term: 'Contact', detail: member.contact }
        ]
      }));
    });
    return grid;
  }

  /** Builds the Metadata body: the shared Metadata List of presentation fields. */
  function buildMetadataBody(metadata) {
    var P = presentation();
    var pairs = [
      { term: 'Created', detail: metadata.created },
      { term: 'Last updated', detail: metadata.updated },
      { term: 'Version', detail: metadata.version },
      { term: 'Owner', detail: metadata.owner },
      { term: 'Tags', detail: asArray(metadata.tags).join(' · ') }
    ].filter(function (pair) { return pair.detail; });
    return P.metadataList(pairs);
  }

  /**
   * Renders the Inspector (§9): a Master–Detail whose master lists the selectable
   * entities (the engagement, then each framework) and whose detail shows the
   * selected entity's Inspector Panel. Selecting a master row swaps the detail —
   * memory-only presentation state.
   *
   * Host-agnostic: it takes only the entity descriptors and returns one
   * self-contained node, making no assumption about where it is mounted. Release
   * 1 places it in a bottom primary-content section; a later release can mount
   * the same node in a supporting panel or a dedicated inspector region with no
   * change here. Exposed on the public API so any host can reuse it.
   */
  function renderInspector(entities) {
    var P = presentation();
    var list = asArray(entities);
    var detailMount = el('div', 'aos-engagement__inspector-mount');

    var options = el('div', 'aos-engagement__inspect-options');
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', 'Inspect engagement or framework');

    var buttons = [];
    function select(index) {
      buttons.forEach(function (button, buttonIndex) {
        var selected = buttonIndex === index;
        button.classList.toggle('aos-engagement__inspect-option--selected', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      if (list[index]) {
        detailMount.replaceChildren(P.inspectorPanel(list[index].inspector));
      }
    }

    list.forEach(function (entity, index) {
      var button = el('button', 'aos-engagement__inspect-option');
      button.setAttribute('type', 'button');
      button.appendChild(el('span', 'aos-engagement__inspect-label', entity.label));
      if (entity.caption) {
        button.appendChild(el('span', 'aos-engagement__inspect-caption', entity.caption));
      }
      button.addEventListener('click', function () { select(index); });
      buttons.push(button);
      options.appendChild(button);
    });

    if (list.length > 0) {
      select(0);
    }

    return P.masterDetail({
      list: options, detail: detailMount, ratio: 32,
      listLabel: 'Engagement and frameworks', detailLabel: 'Inspector'
    });
  }

  /** Builds the Activity Feed for the activity supporting panel (§7). */
  function buildActivityBody(activity) {
    var P = presentation();
    if (asArray(activity).length === 0) {
      return P.emptyState({
        icon: '◇', title: 'No recent activity',
        description: 'Evidence receipts, submissions, and report updates appear here as the engagement progresses.'
      });
    }
    return P.activityFeed({ events: activity });
  }

  /** Builds the Related information panel body: related objects with navigation. */
  function buildRelatedBody(relationships) {
    var P = presentation();
    if (asArray(relationships).length === 0) {
      return P.emptyState({ icon: '◇', title: 'No related objects', description: 'Related audit objects appear here once the engagement has data.' });
    }
    return P.itemList(relationships.map(function (item) {
      return {
        title: item.title, meta: item.meta, tone: TONES.INFO,
        actions: item.path ? [{ label: 'Open', href: '#/' + item.path }] : []
      };
    }), { compact: true });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    var fragment = global.document.createDocumentFragment();
    asArray(entries).forEach(function (entry) {
      var item = el('span', 'aos-engagement-footer__item');
      item.appendChild(el('span', 'aos-engagement-footer__label', entry.label));
      item.appendChild(el('span', 'aos-engagement-footer__value aos-numeric', entry.value));
      fragment.appendChild(item);
    });
    return fragment;
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
   * The ordered engagement sections: the operational status band and the
   * lifecycle navigation up top, then the operational context below. Each entry
   * names the section id, its header, whether it has data, its body builder, and
   * an empty descriptor used when the data is absent (§10).
   */
  function primarySections(viewModel) {
    return [
      {
        id: 'status', kicker: 'What to work on next', title: 'Operational status',
        present: true, body: function () { return buildOperationalStatusBody(viewModel); }
      },
      {
        id: 'lifecycle', kicker: 'Audit workflow', title: 'Lifecycle',
        description: 'The audit lifecycle as navigation — open a stage to work in it.',
        present: viewModel.lifecycle.length > 0,
        body: function () { return buildLifecycleBody(viewModel.lifecycle); },
        empty: { icon: '◇', title: 'No lifecycle stages', description: 'Operational stages appear here once the workspaces are registered.' }
      },
      {
        id: 'summary', kicker: 'Context', title: 'Engagement summary',
        present: true, body: function () { return buildSummaryBody(viewModel.summary); }
      },
      {
        id: 'team', kicker: 'People', title: 'Team',
        present: viewModel.team.length > 0,
        body: function () { return buildTeamBody(viewModel.team); },
        empty: { icon: '◇', title: 'No members yet', description: 'Participating engagement members appear here once contacts exist.' }
      },
      {
        id: 'inspector', kicker: 'Detail', title: 'Engagement inspector',
        description: 'Select the engagement or a framework to inspect its properties, team, frameworks, timeline, and relationships.',
        present: viewModel.inspector.length > 0,
        body: function () { return renderInspector(viewModel.inspector); },
        empty: { icon: '◇', title: 'Nothing to inspect', description: 'Engagement details appear here once the engagement has data.' }
      },
      {
        id: 'metadata', kicker: 'Record', title: 'Metadata',
        present: true, body: function () { return buildMetadataBody(viewModel.metadata); }
      }
    ];
  }

  /** Renders the ready engagement experience into the framework slots. */
  function renderReady(view, viewModel) {
    var P = presentation();

    AuditOS.workspaceFramework.configure(view, {
      header: viewModel.header,
      contextSummary: viewModel.ribbon,
      toolbar: viewModel.toolbar,
      filterBar: viewModel.filterBar
    });

    var canvas = el('div', 'aos-engagement');
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
      description: 'Advisory recommendations will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
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
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'detail', label: 'Loading engagement' })]);
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
        '. Regenerate the demo-data bundle and reload to restore the Engagement Workspace.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders the Engagement Workspace when it is the active workspace: the ready
   * experience once the state has loaded, the loading skeleton before that, and
   * the degraded explanation when no engagement is available.
   */
  function renderActiveEngagement() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.ENGAGEMENT) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.ENGAGEMENT + '"]'
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

  AuditOS.engagementWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      formatDate: formatDate,
      formatPeriod: formatPeriod,
      formatPercent: formatPercent,
      normalizeFrameworks: normalizeFrameworks,
      deriveCurrentEngagement: deriveCurrentEngagement,
      deriveOperationalFocus: deriveOperationalFocus,
      deriveAuditHealth: deriveAuditHealth,
      deriveNextActions: deriveNextActions,
      deriveBlockingItems: deriveBlockingItems,
      deriveLifecycle: deriveLifecycle,
      deriveTeam: deriveTeam,
      deriveRelationships: deriveRelationships,
      deriveActivity: deriveActivity,
      deriveMetadata: deriveMetadata,
      deriveTimeline: deriveTimeline,
      buildInspectorEntities: buildInspectorEntities
    },

    collectViewModel: collectViewModel,

    // Host-agnostic Inspector renderer (§9): data → one self-contained node,
    // mountable in any host. Release 1 mounts it in a bottom section.
    renderInspector: renderInspector,

    /**
     * Binds the Engagement Workspace to the router and the Shared Audit State.
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

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveEngagement);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveEngagement);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveEngagement);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveEngagement);
      }
      renderActiveEngagement();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.engagementWorkspace.init);
    } else {
      AuditOS.engagementWorkspace.init();
    }
  }
})(window);
