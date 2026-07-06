/**
 * AuditOS Home Workspace
 * Workspaces and Navigation — Chapter 12 (§12.6 Home) / Workspace Design
 * System — Chapter 15 / Dashboard Workspace — Chapter 115 / Component
 * Architecture — Chapter 74
 *
 * The operating-system landing experience of AuditOS. Home answers the five
 * command-center questions of §115.4 the moment a session begins: what
 * requires my attention (Urgent work), what should I do next (Continue
 * working), what is mine (Assigned to me), what changed (Activity,
 * Notifications), and what does AI recommend (the reserved AI advisory
 * surface). It is an operational surface, never a reporting dashboard
 * (§12.6): every section is either personally actionable or situational
 * awareness, and everything rendered derives from the existing demo-data
 * through the Shared Audit State.
 *
 * Architecture: Business → ViewModel → Components → DOM. The view model is a
 * declarative description of the page — an ordered list of section
 * descriptors plus panel, ribbon, action, and footer data — produced entirely
 * by pure derivation helpers. The renderer owns no page-specific assembly:
 * it dispatches each descriptor to a generic, reusable body builder and
 * composes everything from Shared Enterprise Component Library primitives.
 * The same builders can render any future workspace's descriptors.
 *
 * Presentation only. Every business value is read through `AuditOS.state` —
 * never from demo-data files, never hardcoded — so the frontend cannot tell
 * whether the data came from JSON, SharePoint, or AI. Sections whose data
 * does not exist render Empty State components; nothing is ever fabricated.
 * Runtime writes remain memory-only elsewhere; Home performs no writes. AI
 * regions are reserved presentation surfaces: AI remains advisory and human
 * approval remains mandatory. Quick actions are navigation only, routed
 * through the Static Router's canonical hash paths.
 *
 * Structure of this file (Coding Standards §30.8): constants, pure
 * derivation helpers (offline-testable, no DOM, no state access), the view
 * model collector (the single place Home reads AuditOS.state), generic DOM
 * builders (compose library components), the section dispatch table, slot
 * renderers, and the route/state wiring.
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
   * The Shared Workspace Framework slots Home populates (framework template:
   * components/workspace-framework/workspace-framework.html).
   */
  var SLOTS = {
    EYEBROW: 'workspace-eyebrow',
    META: 'workspace-meta',
    ACTIONS: 'workspace-actions',
    RIBBON: 'context-ribbon',
    CONTENT: 'primary-content',
    RELATED: 'related-information',
    AI: 'ai-recommendations',
    ACTIVITY: 'activity',
    FOOTER: 'workspace-footer'
  };

  /** Presentation tones shared by badges, markers, and progress meters. */
  var TONES = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
  };

  /** Business status vocabulary of the demo-data (read, never invented). */
  var ENGAGEMENT_STATUS = { IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' };
  var REVIEW_STATUS = { APPROVED: 'Approved', PENDING_REVIEW: 'Pending Review', REJECTED: 'Rejected' };
  var REQUEST_STATUS = { SUBMITTED: 'Submitted' };
  var FINDING_STATUS = { OPEN: 'Open' };
  var TEST_RESULT = { FAIL: 'Fail' };

  /** Severity ranking (highest first) and tone mappings for business status. */
  var SEVERITY_RANK = { High: 0, Medium: 1, Low: 2 };
  var SEVERITY_TONES = { High: TONES.ERROR, Medium: TONES.WARNING, Low: TONES.INFO };
  var RISK_TONES = { High: TONES.ERROR, Medium: TONES.WARNING, Low: TONES.SUCCESS };

  /** Marker glyphs that reinforce tone without ever carrying it alone. */
  var TONE_GLYPHS = { info: '•', success: '✓', warning: '!', error: '!' };

  /** Deterministic month labels so dates never depend on runtime locale. */
  var MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** Maximum entries per list so sections stay scannable. */
  var LIST_LIMIT = 6;

  /** Entrance stagger ceiling — sections beyond this share the last delay. */
  var STAGGER_LIMIT = 3;

  // ------------------------------------------------------------------
  // Pure derivation helpers — no DOM, no AuditOS.state access. Each takes
  // plain records and returns plain view data, so the offline unit suites
  // exercise them directly (derived values remain derived, §30.12).
  // ------------------------------------------------------------------

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

  /** Formats a date period as `start – end`. */
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

  /**
   * The current engagement: the first in-progress engagement in record order,
   * falling back to the first engagement, or null when none exist.
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
   * Continue Working — the resume points of the engagement, derived from the
   * operational domain summaries. Only work that actually exists appears;
   * a fully caught-up engagement yields an empty list (and an Empty State).
   * Each item names the workspace it resumes into; the renderer resolves the
   * route from the Workspace Registry.
   */
  function deriveContinueWorking(evidenceSummary, testingSummary, findingsSummary, requestsSummary, reportDocument) {
    var evidence = evidenceSummary || {};
    var testing = testingSummary || {};
    var findings = findingsSummary || {};
    var requests = requestsSummary || {};
    var resume = [];

    if (evidence.pendingReview > 0) {
      resume.push({
        workspaceId: 'evidence',
        value: String(evidence.pendingReview),
        title: 'Review evidence',
        description: 'Evidence items awaiting a reviewer decision'
      });
    }
    if (testing.pending > 0) {
      resume.push({
        workspaceId: 'testing',
        value: String(testing.pending),
        title: 'Continue testing',
        description: 'Test procedures awaiting execution'
      });
    }
    if (findings.open > 0) {
      resume.push({
        workspaceId: 'findings',
        value: String(findings.open),
        title: 'Resolve findings',
        description: 'Open findings awaiting remediation'
      });
    }
    if (requests.pending > 0) {
      resume.push({
        workspaceId: 'evidence',
        value: String(requests.pending),
        title: 'Fulfill evidence requests',
        description: 'Requests not yet submitted by the client'
      });
    }
    if (reportDocument && reportDocument.status) {
      resume.push({
        workspaceId: 'reporting',
        value: 'v' + reportDocument.version,
        title: 'Continue the report',
        description: reportDocument.title + ' · ' + reportDocument.status
      });
    }
    return resume;
  }

  /**
   * Urgent Work — what is at risk right now: high-severity open findings,
   * rejected evidence, and failed test procedures, in that order.
   */
  function deriveUrgentWork(findings, evidence, tests) {
    var urgent = [];
    (findings || [])
      .filter(function (finding) {
        return finding.status === FINDING_STATUS.OPEN && SEVERITY_RANK[finding.severity] === 0;
      })
      .forEach(function (finding) {
        urgent.push({
          title: finding.title,
          description: finding.severity + ' severity finding · Due ' + formatDate(finding.targetClosureDate),
          meta: finding.id,
          tone: TONES.ERROR,
          critical: true
        });
      });
    (evidence || [])
      .filter(function (item) { return item.reviewStatus === REVIEW_STATUS.REJECTED; })
      .forEach(function (item) {
        urgent.push({
          title: item.title,
          description: 'Evidence rejected — resubmission required',
          meta: formatDate(item.uploadedOn),
          tone: TONES.ERROR,
          critical: true
        });
      });
    (tests || [])
      .filter(function (test) { return test.result === TEST_RESULT.FAIL; })
      .forEach(function (test) {
        urgent.push({
          title: 'Failed test ' + test.id,
          description: test.procedure + ' · Control ' + test.controlId,
          meta: test.workingPaperId,
          tone: TONES.WARNING
        });
      });
    return urgent.slice(0, LIST_LIMIT);
  }

  /**
   * Assigned to Me — everything the current user is responsible for in the
   * existing records: engagements they lead or manage, and test procedures
   * they execute or review. Nothing is fabricated; a user with no
   * assignments yields an empty list.
   */
  function deriveAssignedWork(engagements, tests, userId) {
    var assigned = [];
    (engagements || []).forEach(function (engagement) {
      var role = engagement.engagementLead === userId ? 'Engagement Lead'
        : engagement.engagementManager === userId ? 'Engagement Manager'
          : null;
      if (!role) {
        return;
      }
      assigned.push({
        title: engagement.name,
        description: role + ' · ' + engagement.status,
        meta: formatPeriod(engagement.auditPeriod),
        tone: engagement.status === ENGAGEMENT_STATUS.IN_PROGRESS ? TONES.INFO
          : engagement.status === ENGAGEMENT_STATUS.COMPLETED ? TONES.SUCCESS
            : null,
        inProgress: engagement.status === ENGAGEMENT_STATUS.IN_PROGRESS
      });
    });
    (tests || []).forEach(function (test) {
      var duty = test.testedBy === userId ? 'Execute test '
        : test.reviewedBy === userId ? 'Review test '
          : null;
      if (!duty) {
        return;
      }
      assigned.push({
        title: duty + test.id,
        description: test.procedure + ' · Control ' + test.controlId,
        meta: test.workingPaperId,
        tone: TONES.WARNING,
        inProgress: true
      });
    });
    return assigned
      .sort(function (a, b) { return (a.inProgress ? 0 : 1) - (b.inProgress ? 0 : 1); })
      .slice(0, LIST_LIMIT);
  }

  /**
   * Clients — the engagement portfolio, one entity card per company. Each
   * card is the entry point into that client: identity, risk posture, audit
   * readiness, and the client's engagements — all read from existing records.
   */
  function deriveClients(companies, engagements) {
    return (companies || []).map(function (company) {
      var owned = (engagements || []).filter(function (engagement) {
        return engagement.companyId === company.id;
      });
      var active = owned.filter(function (engagement) {
        return engagement.status === ENGAGEMENT_STATUS.IN_PROGRESS;
      });
      var headquarters = company.headquarters || {};
      return {
        title: company.name,
        subtitle: company.industry +
          (headquarters.city ? ' · ' + headquarters.city + ', ' + headquarters.country : ''),
        badge: { text: company.riskRating + ' risk', tone: RISK_TONES[company.riskRating] || TONES.INFO },
        meter: {
          label: 'Audit readiness',
          value: company.auditReadinessScore || 0,
          total: 100,
          tone: (company.auditReadinessScore || 0) >= 85 ? TONES.SUCCESS : TONES.WARNING
        },
        facts: [
          { term: 'Engagements', detail: active.length + ' active of ' + owned.length },
          { term: 'Frameworks', detail: (company.frameworks || []).join(' · ') }
        ],
        engagements: owned.slice(0, LIST_LIMIT).map(function (engagement) {
          return {
            title: engagement.name,
            description: engagement.framework + ' · ' + engagement.status,
            meta: formatDate(engagement.auditPeriod && engagement.auditPeriod.endDate),
            tone: engagement.status === ENGAGEMENT_STATUS.IN_PROGRESS ? TONES.INFO
              : engagement.status === ENGAGEMENT_STATUS.COMPLETED ? TONES.SUCCESS
                : null
          };
        })
      };
    });
  }

  /**
   * Engagement overview KPIs, derived from the operational domain documents
   * so the tiles reflect the same records the rest of Home presents.
   */
  function deriveKpis(controlsSummary, evidenceSummary, testingSummary, findingsSummary) {
    var controls = controlsSummary || {};
    var evidence = evidenceSummary || {};
    var testing = testingSummary || {};
    var findings = findingsSummary || {};
    return [
      { label: 'Controls in scope', value: controls.controls || 0, total: null, caption: (controls.eligibleForEvidenceReuse || 0) + ' eligible for evidence reuse' },
      { label: 'Evidence approved', value: evidence.approved || 0, total: evidence.evidenceItems || 0, caption: 'of ' + (evidence.evidenceItems || 0) + ' evidence items' },
      { label: 'Tests passed', value: testing.passed || 0, total: testing.tests || 0, caption: 'of ' + (testing.tests || 0) + ' test procedures' },
      { label: 'Open findings', value: findings.open || 0, total: null, caption: 'of ' + (findings.findings || 0) + ' findings recorded' }
    ];
  }

  /**
   * Notifications (§16.18): each entry informs, guides, or requests action —
   * approvals required, rejected evidence, and received submissions.
   */
  function deriveNotifications(evidence, requests, reportDocument) {
    var notifications = [];
    (evidence || []).forEach(function (item) {
      if (item.reviewStatus === REVIEW_STATUS.PENDING_REVIEW) {
        notifications.push({
          title: 'Approval required: ' + item.title,
          description: 'Evidence awaiting review',
          meta: formatDate(item.uploadedOn),
          date: item.uploadedOn,
          tone: TONES.WARNING
        });
      }
      if (item.reviewStatus === REVIEW_STATUS.REJECTED) {
        notifications.push({
          title: 'Evidence rejected: ' + item.title,
          description: 'Resubmission needed',
          meta: formatDate(item.uploadedOn),
          date: item.uploadedOn,
          tone: TONES.ERROR
        });
      }
    });
    (requests || []).forEach(function (request) {
      if (request.status === REQUEST_STATUS.SUBMITTED) {
        notifications.push({
          title: 'Evidence received for request ' + request.id,
          description: 'Submission ready for review',
          meta: formatDate(request.submittedOn),
          date: request.submittedOn,
          tone: TONES.INFO
        });
      }
    });
    if (reportDocument && reportDocument.status) {
      notifications.push({
        title: 'Report ' + String(reportDocument.status).toLowerCase() + ': ' + reportDocument.title,
        description: 'Version ' + reportDocument.version,
        meta: '',
        date: '',
        tone: TONES.INFO
      });
    }
    return notifications
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
      .slice(0, LIST_LIMIT);
  }

  /** Engagement calendar: every dated milestone, sorted ascending. */
  function deriveCalendarEntries(engagement, findings) {
    var entries = [];
    if (engagement) {
      if (engagement.auditPeriod) {
        entries.push({ date: engagement.auditPeriod.startDate, title: 'Audit period begins' });
        entries.push({ date: engagement.auditPeriod.endDate, title: 'Audit period ends' });
      }
      if (engagement.fieldworkPeriod) {
        entries.push({ date: engagement.fieldworkPeriod.startDate, title: 'Fieldwork begins' });
        entries.push({ date: engagement.fieldworkPeriod.endDate, title: 'Fieldwork ends' });
      }
      if (engagement.reportReleaseDate) {
        entries.push({ date: engagement.reportReleaseDate, title: 'Report release' });
      }
    }
    (findings || [])
      .filter(function (finding) { return finding.status === FINDING_STATUS.OPEN && finding.targetClosureDate; })
      .forEach(function (finding) {
        entries.push({ date: finding.targetClosureDate, title: 'Finding closure target: ' + finding.id });
      });
    return entries
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })
      .map(function (entry) {
        return { title: entry.title, meta: formatDate(entry.date), date: entry.date };
      })
      .slice(0, LIST_LIMIT);
  }

  /** Recent activity: evidence receipts and request submissions, newest first. */
  function deriveRecentActivity(evidence, requests) {
    var events = [];
    (evidence || []).forEach(function (item) {
      events.push({
        title: 'Evidence received: ' + item.title,
        description: item.reviewStatus,
        meta: formatDate(item.uploadedOn),
        date: item.uploadedOn,
        tone: item.reviewStatus === REVIEW_STATUS.APPROVED ? TONES.SUCCESS
          : item.reviewStatus === REVIEW_STATUS.REJECTED ? TONES.ERROR
            : TONES.WARNING
      });
    });
    (requests || []).forEach(function (request) {
      if (request.submittedOn) {
        events.push({
          title: 'Request ' + request.id + ' submitted',
          description: 'Review status: ' + request.reviewStatus,
          meta: formatDate(request.submittedOn),
          date: request.submittedOn,
          tone: TONES.INFO
        });
      }
    });
    return events
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
      .slice(0, LIST_LIMIT);
  }

  /** Counts the collections, datasets, and records the state currently holds. */
  function deriveDemoDataFootprint(state) {
    var collections = state.listCollections();
    var records = 0;
    collections.forEach(function (collection) {
      var datasetIds = state.getDatasetIds(collection.id);
      if (datasetIds.length === 0) {
        records += state.listRecords(collection.id).length;
        return;
      }
      datasetIds.forEach(function (datasetId) {
        records += state.listRecords(collection.id, datasetId).length;
      });
    });
    return { collections: collections.length, records: records };
  }

  // ------------------------------------------------------------------
  // View model — the single place Home reads AuditOS.state. Returns a
  // declarative description of the page; rendering below never touches the
  // state directly, so the data source can change without frontend changes.
  // ------------------------------------------------------------------

  /** Reads the first dataset document an engagement owns in a collection. */
  function readEngagementDocument(state, collectionId, engagementId) {
    var datasetIds = state.findDatasetsForEngagement(collectionId, engagementId);
    return datasetIds.length > 0 ? state.getDocument(collectionId, datasetIds[0]) : null;
  }

  /** Finds a record by id within a list. */
  function findById(records, id) {
    for (var index = 0; index < (records || []).length; index += 1) {
      if (records[index].id === id) {
        return records[index];
      }
    }
    return null;
  }

  /**
   * Quick actions — navigation-only destinations resolved from the Workspace
   * Registry (navigation identity, never business content).
   */
  function deriveQuickActions(workspaceRegistry) {
    if (!workspaceRegistry) {
      return [];
    }
    var destinationIds = [
      { id: workspaceRegistry.IDS.ENGAGEMENT, primary: true },
      { id: workspaceRegistry.IDS.EVIDENCE, primary: false },
      { id: workspaceRegistry.IDS.TESTING, primary: false },
      { id: workspaceRegistry.IDS.FINDINGS, primary: false },
      { id: workspaceRegistry.IDS.REPORTING, primary: false }
    ];
    var actions = [];
    destinationIds.forEach(function (destination) {
      var workspace = workspaceRegistry.findById(destination.id);
      if (workspace) {
        actions.push({ label: workspace.label, path: workspace.path, primary: destination.primary });
      }
    });
    return actions;
  }

  /**
   * Collects everything Home presents from the Shared Audit State as an
   * ordered list of declarative section descriptors plus panel, ribbon,
   * action, and footer data. Returns null while the state is not ready, and
   * a degraded model when no engagement data is available (§15.12).
   */
  function collectViewModel(state, workspaceRegistry) {
    if (!state || !state.isReady()) {
      return null;
    }

    var status = state.getStatus();
    var engagementsDocument = state.getDocument('engagements');
    var engagements = state.listRecords('engagements');
    var engagement = deriveCurrentEngagement(engagements);
    if (!engagement) {
      return { degraded: true, status: status };
    }

    var companies = state.listRecords('companies');
    var company = findById(companies, engagement.companyId);

    var controlsDocument = readEngagementDocument(state, 'controls', engagement.id) || {};
    var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
    var requestsDocument = readEngagementDocument(state, 'evidence-requests', engagement.id) || {};
    var testingDocument = readEngagementDocument(state, 'testing', engagement.id) || {};
    var findingsDocument = readEngagementDocument(state, 'findings', engagement.id) || {};
    var reportsDocument = readEngagementDocument(state, 'reports', engagement.id) || {};

    var evidence = evidenceDocument.evidence || [];
    var requests = requestsDocument.requests || [];
    var findings = findingsDocument.findings || [];
    var tests = testingDocument.tests || [];
    var evidenceSummary = evidenceDocument.summary || {};
    var testingSummary = testingDocument.summary || {};
    var findingsSummary = findingsDocument.summary || {};
    var requestsSummary = requestsDocument.summary || {};
    var reportDocument = reportsDocument.document || null;

    var userId = engagement.engagementLead;
    var openFindings = findings.filter(function (finding) { return finding.status === FINDING_STATUS.OPEN; }).length;
    var pendingReviews = evidence.filter(function (item) { return item.reviewStatus === REVIEW_STATUS.PENDING_REVIEW; }).length;
    var footprint = deriveDemoDataFootprint(state);

    var briefingSummary = (company ? company.name + ' · ' : '') + engagement.name + ' — ' +
      (evidenceSummary.approved || 0) + ' of ' + (evidenceSummary.evidenceItems || 0) + ' evidence items approved, ' +
      (testingSummary.passed || 0) + ' of ' + (testingSummary.tests || 0) + ' tests passed, ' +
      openFindings + ' open findings.';

    return {
      degraded: false,
      status: status,
      engagement: engagement,
      company: company,

      header: {
        eyebrow: (company ? company.name + ' · ' : '') + engagement.engagementCode +
          ' · ' + formatPeriod(engagement.auditPeriod),
        meta: engagement.framework + ' — ' + engagement.status +
          ' · Fieldwork ' + formatPeriod(engagement.fieldworkPeriod)
      },

      quickActions: deriveQuickActions(workspaceRegistry),

      ribbon: [
        { label: 'Client', value: company ? company.name : engagement.companyId },
        { label: 'Engagement', value: engagement.engagementCode },
        { label: 'Phase', value: engagement.status },
        { label: 'Open findings', value: String(openFindings) },
        { label: 'Pending reviews', value: String(pendingReviews) },
        { label: 'Client risk', value: company ? company.riskRating : '' }
      ],

      sections: [
        {
          id: 'continue-working',
          kind: 'link-cards',
          kicker: 'Resume',
          title: 'Continue working',
          description: briefingSummary,
          items: deriveContinueWorking(evidenceSummary, testingSummary, findingsSummary, requestsSummary, reportDocument),
          empty: {
            icon: '✓',
            title: 'All caught up',
            description: 'Nothing is waiting on you right now. Resume points appear here as reviews, testing, findings, requests, and reporting progress.'
          }
        },
        {
          id: 'urgent-work',
          kind: 'items',
          kicker: 'Needs attention',
          title: 'Urgent work',
          items: deriveUrgentWork(findings, evidence, tests),
          empty: {
            icon: '✓',
            title: 'Nothing urgent',
            description: 'High-severity findings, rejected evidence, and failed tests appear here the moment they need action.'
          }
        },
        {
          id: 'assigned-to-me',
          kind: 'items',
          kicker: 'Your work',
          title: 'Assigned to me',
          description: 'Signed in as ' + userId + ' · Engagement Lead · ' + engagement.auditor,
          items: deriveAssignedWork(engagements, tests, userId),
          empty: {
            icon: '◇',
            title: 'Nothing assigned',
            description: 'Engagements you lead or manage and tests you execute or review appear here.'
          }
        },
        {
          id: 'engagement-overview',
          kind: 'kpis',
          kicker: 'Pulse',
          title: 'Engagement overview',
          items: deriveKpis(controlsDocument.summary, evidenceSummary, testingSummary, findingsSummary)
        },
        {
          id: 'clients',
          kind: 'entity-cards',
          kicker: 'Portfolio',
          title: 'Clients',
          items: deriveClients(companies, engagements),
          empty: {
            icon: '◇',
            title: 'No clients yet',
            description: 'Client profiles appear here once companies exist in the Shared Audit State.'
          }
        },
        {
          id: 'signals',
          kind: 'panel-grid',
          kicker: 'Today',
          title: 'Signals',
          panels: [
            {
              title: 'Notifications',
              kind: 'items',
              items: deriveNotifications(evidence, requests, reportDocument),
              empty: {
                icon: '◇',
                title: 'No notifications',
                description: 'Operational events that inform, guide, or request action appear here.'
              }
            },
            {
              title: 'Calendar',
              kind: 'timeline',
              items: deriveCalendarEntries(engagement, findings),
              empty: {
                icon: '◇',
                title: 'No dated milestones',
                description: 'Engagement milestones and closure targets appear here.'
              }
            }
          ]
        }
      ],

      panels: {
        related: [
          { term: 'Client', detail: company ? company.name : engagement.companyId },
          { term: 'Engagement', detail: engagement.name },
          { term: 'Framework', detail: engagement.framework },
          { term: 'Audit period', detail: formatPeriod(engagement.auditPeriod) },
          { term: 'Fieldwork', detail: formatPeriod(engagement.fieldworkPeriod) },
          { term: 'Control set', detail: engagement.controlSet },
          { term: 'Report', detail: engagement.reportId }
        ],
        ai: {
          icon: '✦',
          title: 'Reserved for AI advisory',
          description: 'Advisory recommendations will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
        },
        activity: deriveRecentActivity(evidence, requests)
      },

      footer: [
        { label: 'Environment', value: 'Static prototype' },
        { label: 'Demo status', value: status.demoDataLoaded ? 'Demo data loaded' : 'Demo data degraded' },
        { label: 'Version', value: engagementsDocument && engagementsDocument.metadata ? engagementsDocument.metadata.version : '' },
        { label: 'Client', value: company ? company.name : engagement.companyId },
        { label: 'Loaded', value: footprint.collections + ' collections · ' + footprint.records + ' records' }
      ]
    };
  }

  // ------------------------------------------------------------------
  // Generic DOM builders — compositions of the Shared Enterprise Component
  // Library, reusable for any workspace's descriptors. Text is always
  // assigned through textContent, never markup injection.
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

  /** Builds a Status Badge component. */
  function buildBadge(text, tone) {
    return el('span', 'aos-status-badge' + (tone ? ' aos-status-badge--' + tone : ''), text);
  }

  /**
   * Builds an Item List component from `{title, description, meta, tone,
   * critical}` rows. Critical rows compose the library's prioritized variant
   * so they visually dominate the list.
   */
  function buildItemList(items, compact) {
    var list = el('ul', 'aos-item-list' + (compact ? ' aos-item-list--compact' : ''));
    items.forEach(function (item) {
      var row = el('li', 'aos-item-list__item' + (item.critical ? ' aos-item-list__item--critical' : ''));
      var marker = el('span', 'aos-item-list__marker' + (item.tone ? ' aos-item-list__marker--' + item.tone : ''),
        TONE_GLYPHS[item.tone] || TONE_GLYPHS.info);
      marker.setAttribute('aria-hidden', 'true');
      row.appendChild(marker);

      var content = el('div', 'aos-item-list__content');
      content.appendChild(el('span', 'aos-item-list__title', item.title));
      if (item.description) {
        content.appendChild(el('span', 'aos-item-list__description', item.description));
      }
      row.appendChild(content);

      if (item.meta) {
        row.appendChild(el('span', 'aos-item-list__meta aos-numeric', item.meta));
      }
      list.appendChild(row);
    });
    return list;
  }

  /** Builds a Progress component with accessible progressbar semantics. */
  function buildProgress(label, value, total, tone) {
    var percent = formatPercent(value, total);
    var progress = el('div', 'aos-progress' + (tone ? ' aos-progress--' + tone : ''));
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-label', label);
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', String(total));
    progress.setAttribute('aria-valuenow', String(value));

    var header = el('div', 'aos-progress__header');
    header.appendChild(el('span', 'aos-progress__label', label));
    header.appendChild(el('span', 'aos-progress__value aos-numeric', value + ' of ' + total + ' · ' + percent + '%'));
    progress.appendChild(header);

    progress.appendChild(buildMeterTrack(percent));
    return progress;
  }

  /** Builds a bare progress track (used decoratively and inside meters). */
  function buildMeterTrack(percent) {
    var track = el('div', 'aos-progress__track');
    var indicator = el('div', 'aos-progress__indicator');
    indicator.style.width = percent + '%';
    track.appendChild(indicator);
    return track;
  }

  /** Builds a Metadata List component from `{term, detail}` pairs. */
  function buildMetadataList(pairs, inline) {
    var list = el('dl', 'aos-metadata-list' + (inline ? ' aos-metadata-list--inline' : ''));
    pairs.forEach(function (pair) {
      var item = el('div', 'aos-metadata-list__item');
      item.appendChild(el('dt', 'aos-metadata-list__term', pair.term));
      item.appendChild(el('dd', 'aos-metadata-list__detail', pair.detail));
      list.appendChild(item);
    });
    return list;
  }

  /** Builds a Timeline component from `{meta, title, description, tone}` events. */
  function buildTimeline(events) {
    var timeline = el('ol', 'aos-timeline');
    events.forEach(function (event) {
      var item = el('li', 'aos-timeline__event');
      var marker = el('span', 'aos-timeline__marker' + (event.tone ? ' aos-timeline__marker--' + event.tone : ''));
      marker.setAttribute('aria-hidden', 'true');
      item.appendChild(marker);

      var content = el('div', 'aos-timeline__content');
      content.appendChild(el('span', 'aos-timeline__meta aos-numeric', event.meta));
      content.appendChild(el('span', 'aos-timeline__title', event.title));
      if (event.description) {
        content.appendChild(el('span', 'aos-timeline__description', event.description));
      }
      item.appendChild(content);
      timeline.appendChild(item);
    });
    return timeline;
  }

  /** Builds a Panel Section component with a heading and body children. */
  function buildPanelSection(title, bodyChildren) {
    var section = el('section', 'aos-panel-section');
    section.setAttribute('aria-label', title);

    var header = el('header', 'aos-panel-section__header');
    header.appendChild(el('h3', 'aos-panel-section__title', title));
    section.appendChild(header);

    var body = el('div', 'aos-panel-section__body');
    bodyChildren.forEach(function (child) {
      body.appendChild(child);
    });
    section.appendChild(body);
    return section;
  }

  /** Builds an Empty State component from a descriptor. */
  function buildEmptyState(descriptor) {
    var empty = el('div', 'aos-empty-state');
    var glyph = el('span', 'aos-empty-state__icon', descriptor.icon);
    glyph.setAttribute('aria-hidden', 'true');
    empty.appendChild(glyph);
    empty.appendChild(el('p', 'aos-empty-state__title', descriptor.title));
    empty.appendChild(el('p', 'aos-empty-state__description', descriptor.description));
    return empty;
  }

  /** Builds a Loading State component of structural skeletons. */
  function buildLoadingState(label, blocks) {
    var loading = el('div', 'aos-loading-state');
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-busy', 'true');
    loading.appendChild(el('span', 'aos-loading-state__label', label));
    (blocks || ['title', 'text', 'text', 'block']).forEach(function (variant) {
      var skeleton = el('span', 'aos-skeleton aos-skeleton--' + variant);
      skeleton.setAttribute('aria-hidden', 'true');
      loading.appendChild(skeleton);
    });
    return loading;
  }

  // ------------------------------------------------------------------
  // Section body builders — one generic builder per descriptor kind. The
  // renderer dispatches through SECTION_BODIES; no page-specific assembly.
  // ------------------------------------------------------------------

  /**
   * Resume cards: interactive Card components that link back into their
   * workspaces — resume tasks, not dashboard widgets. The destination line
   * carries the workspace's registry label (navigation identity).
   */
  function buildLinkCardsBody(section, workspaceRegistry) {
    var grid = el('div', 'aos-home__resume');
    section.items.forEach(function (item) {
      var workspace = workspaceRegistry ? workspaceRegistry.findById(item.workspaceId) : null;
      var card = el(workspace ? 'a' : 'div', 'aos-card aos-card--interactive aos-home__resume-card');
      if (workspace) {
        card.setAttribute('href', '#/' + workspace.path);
        card.setAttribute('aria-label', item.title + ' — ' + item.description);
      }
      var body = el('div', 'aos-card__body aos-home__resume-body');
      body.appendChild(el('span', 'aos-home__resume-value aos-numeric', item.value));
      body.appendChild(el('span', 'aos-home__resume-title', item.title));
      body.appendChild(el('span', 'aos-home__resume-description', item.description));
      if (workspace) {
        body.appendChild(el('span', 'aos-home__resume-destination', workspace.label));
      }
      card.appendChild(body);

      var arrow = el('span', 'aos-home__resume-arrow', '→');
      arrow.setAttribute('aria-hidden', 'true');
      card.appendChild(arrow);
      grid.appendChild(card);
    });
    return grid;
  }

  /** Item sections: a padded Surface hosting one Item List. */
  function buildItemsBody(section) {
    var surface = el('div', 'aos-surface aos-surface--padded aos-home__list-surface');
    surface.appendChild(buildItemList(section.items));
    return surface;
  }

  /** KPI band: KPI Tiles with a decorative meter when a total exists. */
  function buildKpisBody(section) {
    var grid = el('div', 'aos-home__kpis');
    section.items.forEach(function (kpi) {
      var tile = el('div', 'aos-kpi-tile');
      tile.appendChild(el('span', 'aos-kpi-tile__label', kpi.label));
      tile.appendChild(el('span', 'aos-kpi-tile__value aos-numeric', String(kpi.value)));
      tile.appendChild(el('span', 'aos-kpi-tile__caption', kpi.caption));
      if (kpi.total) {
        // Decorative meter: the tile's value and caption already carry the
        // numbers as text, so the bar is hidden from assistive technology.
        var meter = el('div', 'aos-progress');
        meter.setAttribute('aria-hidden', 'true');
        meter.appendChild(buildMeterTrack(formatPercent(kpi.value, kpi.total)));
        tile.appendChild(meter);
      }
      grid.appendChild(tile);
    });
    return grid;
  }

  /** Entity cards: business-object Cards with badge, meter, and facts. */
  function buildEntityCardsBody(section) {
    var grid = el('div', 'aos-home__entities');
    section.items.forEach(function (entity) {
      var card = el('article', 'aos-card aos-home__entity-card');
      var header = el('header', 'aos-card__header');
      var identity = el('div', 'aos-home__entity-identity');
      identity.appendChild(el('h3', 'aos-card__title', entity.title));
      identity.appendChild(el('span', 'aos-home__entity-subtitle', entity.subtitle));
      header.appendChild(identity);
      if (entity.badge) {
        header.appendChild(buildBadge(entity.badge.text, entity.badge.tone));
      }
      card.appendChild(header);

      var body = el('div', 'aos-card__body aos-home__entity-body');
      if (entity.meter) {
        body.appendChild(buildProgress(entity.meter.label, entity.meter.value, entity.meter.total, entity.meter.tone));
      }
      if (entity.facts) {
        body.appendChild(buildMetadataList(entity.facts, true));
      }
      if (entity.engagements && entity.engagements.length > 0) {
        var engagements = el('div', 'aos-home__entity-engagements');
        engagements.appendChild(buildItemList(entity.engagements, true));
        body.appendChild(engagements);
      }
      card.appendChild(body);
      grid.appendChild(card);
    });
    return grid;
  }

  /** Panel grid: a row of Panel Sections, each with its own list body. */
  function buildPanelGridBody(section) {
    var grid = el('div', 'aos-home__panel-grid');
    section.panels.forEach(function (panel) {
      var content = panel.items.length === 0 ? buildEmptyState(panel.empty)
        : panel.kind === 'timeline' ? buildTimeline(panel.items)
          : buildItemList(panel.items, true);
      grid.appendChild(buildPanelSection(panel.title, [content]));
    });
    return grid;
  }

  /** Descriptor kind → generic body builder. */
  var SECTION_BODIES = {
    'link-cards': buildLinkCardsBody,
    'items': buildItemsBody,
    'kpis': buildKpisBody,
    'entity-cards': buildEntityCardsBody,
    'panel-grid': buildPanelGridBody
  };

  /**
   * Builds one Section component from a descriptor: kicker, title, optional
   * description, then the body produced by the descriptor's kind. Sections
   * with no items render their Empty State instead of fabricating data; a
   * section with neither items nor an empty state disappears gracefully
   * (returns null) so no blank region is ever left behind.
   */
  function buildSection(section, workspaceRegistry) {
    if (section.items && section.items.length === 0 && !section.empty) {
      return null;
    }
    // The per-section modifier is layout identity only: home.css places each
    // section on the Home master grid by its descriptor id.
    var element = el('section', 'aos-section aos-home__section aos-home__section--' + section.id);
    element.setAttribute('aria-label', section.title);

    var header = el('header', 'aos-section__header');
    if (section.kicker) {
      header.appendChild(el('p', 'aos-section__eyebrow', section.kicker));
    }
    header.appendChild(el('h2', 'aos-section__title', section.title));
    if (section.description) {
      header.appendChild(el('p', 'aos-section__description', section.description));
    }
    element.appendChild(header);

    var body = el('div', 'aos-section__body');
    if (section.items && section.items.length === 0 && section.empty) {
      var surface = el('div', 'aos-surface aos-home__list-surface');
      surface.appendChild(buildEmptyState(section.empty));
      body.appendChild(surface);
    } else {
      body.appendChild(SECTION_BODIES[section.kind](section, workspaceRegistry));
    }
    element.appendChild(body);
    return element;
  }

  /** Quick actions: navigation-only Button links in an Action Group. */
  function buildQuickActions(actions) {
    var group = el('div', 'aos-action-group aos-action-group--end');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Quick actions');
    actions.forEach(function (action) {
      var link = el('a', 'aos-button aos-button--small' + (action.primary ? ' aos-button--primary' : ''),
        action.label);
      link.setAttribute('href', '#/' + action.path);
      group.appendChild(link);
    });
    return group;
  }

  /**
   * Builds a run of labeled value items — one shared builder for the context
   * ribbon (§15.5) and the workspace footer, which share the same structure
   * and differ only in their class prefix.
   */
  function buildLabeledItems(entries, classPrefix) {
    var fragment = global.document.createDocumentFragment();
    entries.forEach(function (entry) {
      var item = el('span', classPrefix + '__item');
      item.appendChild(el('span', classPrefix + '__label', entry.label));
      item.appendChild(el('span', classPrefix + '__value aos-numeric', entry.value));
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

  /** Renders the ready Home experience into the framework slots. */
  function renderReady(view, viewModel, workspaceRegistry) {
    var eyebrow = slotElement(view, SLOTS.EYEBROW);
    if (eyebrow) {
      eyebrow.textContent = viewModel.header.eyebrow;
    }
    var meta = slotElement(view, SLOTS.META);
    if (meta) {
      meta.textContent = viewModel.header.meta;
    }
    fillSlot(view, SLOTS.ACTIONS, [buildQuickActions(viewModel.quickActions)]);
    fillSlot(view, SLOTS.RIBBON, [buildLabeledItems(viewModel.ribbon, 'aos-home-ribbon')]);

    var home = el('div', 'aos-home');
    // Opts the framework's content region into the flush canvas, so the Home
    // sections sit directly on the workspace surface (layout contract in
    // workspace-framework.css; degrades to the bordered surface gracefully).
    home.setAttribute('data-canvas', 'flush');
    var rendered = 0;
    viewModel.sections.forEach(function (section) {
      var built = buildSection(section, workspaceRegistry);
      if (!built) {
        return;
      }
      built.classList.add('aos-rise-in');
      if (rendered > 0) {
        built.classList.add('aos-rise-in--' + Math.min(rendered, STAGGER_LIMIT));
      }
      rendered += 1;
      home.appendChild(built);
    });
    fillSlot(view, SLOTS.CONTENT, [home]);

    var related = buildMetadataList(viewModel.panels.related);
    related.classList.add('aos-fade-in');
    fillSlot(view, SLOTS.RELATED, [related]);

    var aiPlaceholder = buildEmptyState(viewModel.panels.ai);
    aiPlaceholder.classList.add('aos-tint-brand', 'aos-fade-in');
    fillSlot(view, SLOTS.AI, [aiPlaceholder]);

    var activity = buildItemList(viewModel.panels.activity, true);
    activity.classList.add('aos-fade-in');
    fillSlot(view, SLOTS.ACTIVITY, [activity]);

    fillSlot(view, SLOTS.FOOTER, [buildLabeledItems(viewModel.footer, 'aos-home-footer')]);
  }

  /** Renders the layout-stable loading state (§15.12 — Loading). */
  function renderLoading(view) {
    fillSlot(view, SLOTS.CONTENT, [buildLoadingState('Loading AuditOS Home', ['title', 'text', 'text', 'block', 'block'])]);
    fillSlot(view, SLOTS.RELATED, [buildLoadingState('Loading related information', ['text', 'text'])]);
    fillSlot(view, SLOTS.AI, [buildLoadingState('Loading AI advisory', ['text', 'text'])]);
    fillSlot(view, SLOTS.ACTIVITY, [buildLoadingState('Loading activity', ['text', 'text'])]);
  }

  /** Renders the degraded state (§15.12 — Empty / Error). */
  function renderDegraded(view, viewModel) {
    fillSlot(view, SLOTS.CONTENT, [buildEmptyState({
      icon: '◇',
      title: 'Demo data unavailable',
      description: 'The Shared Audit State could not load its demo data' +
        (viewModel.status.degradedReason ? ' (' + viewModel.status.degradedReason + ')' : '') +
        '. Regenerate the demo-data bundle and reload to restore AuditOS Home.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders Home when it is the active workspace: the ready experience once
   * the state has loaded, the loading skeleton before that, and the degraded
   * explanation when demo data is unavailable.
   */
  function renderActiveHome() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || router.getCurrentWorkspaceId() !== registry.DEFAULT_WORKSPACE_ID) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.DEFAULT_WORKSPACE_ID + '"]'
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
    renderReady(view, viewModel, registry);
  }

  AuditOS.homeWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      formatDate: formatDate,
      formatPeriod: formatPeriod,
      formatPercent: formatPercent,
      deriveCurrentEngagement: deriveCurrentEngagement,
      deriveContinueWorking: deriveContinueWorking,
      deriveUrgentWork: deriveUrgentWork,
      deriveAssignedWork: deriveAssignedWork,
      deriveClients: deriveClients,
      deriveKpis: deriveKpis,
      deriveNotifications: deriveNotifications,
      deriveCalendarEntries: deriveCalendarEntries,
      deriveRecentActivity: deriveRecentActivity,
      deriveQuickActions: deriveQuickActions,
      deriveDemoDataFootprint: deriveDemoDataFootprint
    },

    collectViewModel: collectViewModel,

    /**
     * Binds Home to the router and the Shared Audit State. Safe to call once,
     * after the DOM is ready, the router has resolved the initial route, and
     * the framework has rendered its skeleton (script order guarantees the
     * framework's route listener runs first). Does nothing when the routing
     * or state foundations are absent, so the shell degrades rather than
     * throwing.
     */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }

      // Re-render whenever the route returns to Home (the framework has just
      // rebuilt the slots) and when the state loads, changes, or resets.
      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveHome);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveHome);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveHome);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveHome);
      }
      renderActiveHome();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.homeWorkspace.init);
    } else {
      AuditOS.homeWorkspace.init();
    }
  }
})(window);
