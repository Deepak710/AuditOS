/**
 * AuditOS Client Workspace
 * Client Workspace Modularization — GitHub Issue #35 / Platform Information
 * Architecture — GitHub Issue #33 (§2 Client Dashboard) / Workspaces and
 * Navigation — Chapter 12 / Component Architecture — Chapter 74
 *
 * The client level of the permanent platform hierarchy (AuditOS → Client →
 * Engagement → Operational Workspaces). This is no longer a landing page: it
 * is the primary, module-driven operational portfolio workspace for a
 * client — the single place engagement health, portfolio progress, team and
 * POC workload, AI advisory signals, and cross-entity search are viewed
 * before drilling into an individual engagement's own operational
 * workspaces. It communicates and navigates portfolio health; it never
 * replaces the engagement workspaces it links into.
 *
 * Completed engagements remain visible but read-only: they render collapsed
 * by default in their own clearly-marked module and contribute to no
 * operational metric — every aggregate below derives exclusively from the
 * engagements that are not completed.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to every
 * other operational workspace. `collectViewModel` is the single place this
 * workspace reads `AuditOS.state`; every count is derived live from the
 * underlying records (never a stored aggregate). The workspace is
 * module-driven (Issue #35 §11): `buildModuleRegistry` returns an ordered,
 * data-carrying configuration list, each entry naming its framework region
 * (content canvas / AI / activity / related) and an `enabled` flag — the
 * renderer only iterates and dispatches this list, so a future release can
 * hide, reorder, or add a module by editing the registry, never the
 * rendering code. The renderer configures the Shared Workspace Framework's
 * inherited skeleton and fills its slots with compositions from the
 * Enterprise Data Presentation System. It reuses the Workspace Shared
 * Platform (Issue #27), the Cross-Workspace Relationship Engine (Issue #30),
 * and Cross-Workspace Record Navigation (Issue #31) — no logic those issues
 * already extracted is reimplemented here.
 *
 * Portfolio Overview (§4), Team Analytics (§5), and POC Analytics (§6) share
 * one ownership model: a requirement record is the accountable unit (it
 * carries the owning `teamId` and `primaryPocId` directly); evidence and
 * testing records join to that same ownership transitively — evidence
 * through the requirement it satisfies (`requirementIds[0]`), testing
 * through the control it exercises (`controlId` → the control's own
 * `requirementIds[0]`). Every visualization, hover summary, and drill-down
 * is derived live from these real joins — nothing is fabricated in the view
 * layer (Issue #35 §12 — Repository-Driven UI). The AI Insights module (§7)
 * renders exclusively from the `ai-portfolio-insights` demo collection,
 * exactly as a future AI agent's output would render; Release 2 replaces the
 * generator behind that schema, not this UI. Universal Client Search (§8)
 * scans the same real per-engagement collections through
 * `WS.readEngagementDocument`; a result with no dedicated workspace surface
 * (POCs, users) renders informational with no fabricated link.
 *
 * Presentation only. Every business value is read through `AuditOS.state`;
 * nothing is written. Sections with no data render shared Empty State
 * components; nothing is fabricated.
 *
 * Structure of this file (Coding Standards §30.8): constants, pure derivation
 * helpers (no DOM, no state access), the view-model collector (the single
 * state read), generic DOM builders (compose the presentation system), slot
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

  /** Presentation tones shared by badges, markers, and progress. */
  var TONES = WS.TONES;

  /** Engagement lifecycle status vocabulary of the demo data (read, never invented). */
  var ENGAGEMENT_STATUS = { IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' };

  /** Company lifecycle status vocabulary of the demo data (read, never invented). */
  var COMPANY_STATUS = { ACTIVE: 'Active' };

  /** Engagement lifecycle status → tone. */
  var STATUS_TONES = {
    'In Progress': TONES.INFO, 'Completed': TONES.SUCCESS, 'Planning': TONES.INFO,
    'Planned': TONES.INFO, 'On Hold': TONES.WARNING
  };

  /**
   * Evidence / request lifecycle vocabulary of this dataset (read, never
   * invented; mirrored from the Evidence and Program workspaces so the same
   * real statuses classify identically wherever they appear).
   */
  var COMPLETE_STATUS = 'All Evidence Received';
  var NOT_APPLICABLE_STATUS = 'Not Applicable';

  /**
   * The statuses that mean a record is awaiting an audit-team approval
   * decision — the same vocabulary the Global Approvals workspace and the
   * header badge count, so every surface reports one number.
   */
  var PENDING_APPROVAL_STATUSES = ['Pending Review', 'Evidence Received - Under HA Review', 'Submitted'];

  /**
   * Statuses that mean a record is genuinely blocked — stuck on something
   * outside the audit team's control — distinct from ordinary pending review
   * (read from the dataset's own recorded vocabulary, never invented).
   */
  var BLOCKED_STATUSES = [
    'Rejected',
    'Population Pending - HA unable to share samples',
    'Evidence Reviewed - Clarification Needed'
  ];

  /** Testing / walkthrough lifecycle vocabulary of this dataset (read, never invented). */
  var TESTING_STATUS = { COMPLETED: 'Completed', NOT_APPLICABLE: 'Not Applicable' };

  /** Finding lifecycle vocabulary (read, never invented). */
  var FINDING_STATUS = { OPEN: 'Open' };

  /** Maximum entries per supporting list so sections stay scannable. */
  var LIST_LIMIT = WS.LIST_LIMIT;

  /** Maximum universal search results shown at once (Issue #35 §8). */
  var SEARCH_LIMIT = 8;

  /** Entrance stagger ceiling — sections beyond this share the last delay. */
  var STAGGER_LIMIT = WS.STAGGER_LIMIT;

  /**
   * Fixed-order categorical color slots distinguishing engagements by
   * identity, never by rank (dataviz categorical-theme convention — Issue
   * #35 §4): a filter that changes which engagements are visible never
   * repaints the survivors, since each engagement keeps the slot its index
   * assigned it.
   */
  var ENGAGEMENT_COLOR_SLOTS = [
    '--aos-chart-categorical-1', '--aos-chart-categorical-2', '--aos-chart-categorical-3', '--aos-chart-categorical-4',
    '--aos-chart-categorical-5', '--aos-chart-categorical-6', '--aos-chart-categorical-7', '--aos-chart-categorical-8'
  ];

  /** Resolves an engagement's fixed-order categorical color CSS variable name. */
  function engagementColorVar(index) {
    return ENGAGEMENT_COLOR_SLOTS[index % ENGAGEMENT_COLOR_SLOTS.length];
  }

  /**
   * The six metrics each operational engagement independently contributes to
   * the portfolio visualization (Issue #35 §4), and the per-engagement
   * workspace each metric's segment drills into. Approvals has no
   * per-engagement workspace in this platform — its segment opens the
   * Global Approvals inbox instead, never a fabricated route.
   */
  var PORTFOLIO_METRIC_KEYS = ['requirements', 'evidence', 'testing', 'findings', 'walkthrough', 'approvals'];
  var PORTFOLIO_METRIC_DEFS = {
    requirements: { label: 'Requirements', workspaceKey: 'REQUIREMENTS' },
    evidence: { label: 'Evidence', workspaceKey: 'EVIDENCE' },
    testing: { label: 'Testing', workspaceKey: 'TESTING' },
    findings: { label: 'Findings', workspaceKey: 'FINDINGS' },
    walkthrough: { label: 'Walkthrough', workspaceKey: 'WALKTHROUGH' },
    approvals: { label: 'Approvals', globalPath: 'approvals' }
  };

  // ------------------------------------------------------------------
  // Pure derivation helpers — no DOM, no AuditOS.state access.
  // ------------------------------------------------------------------

  /** Returns the value when it is an array, otherwise an empty array. */
  var asArray = WS.asArray;

  /** Formats an ISO `YYYY-MM-DD` date as a compact, deterministic label. */
  var formatDate = WS.formatDate;

  /** Formats a `{ startDate, endDate }` period as `start – end`. */
  var formatPeriod = WS.formatPeriod;

  /** Naive English pluralization for whole-count labels. */
  var plural = WS.plural;

  /** Resolves an engagement lifecycle status to a presentation tone. */
  function statusTone(status) {
    return STATUS_TONES[status] || null;
  }

  /** Resolves a company lifecycle status to a presentation tone. */
  function companyStatusTone(status) {
    return status === COMPANY_STATUS.ACTIVE ? TONES.SUCCESS : TONES.INFO;
  }

  /**
   * The client this workspace presents: the company the route's record id
   * names, else the first company in record order (the selection Home always
   * provides), or null when none exist. Nothing is ever fabricated.
   */
  function resolveTargetCompany(companies, targetId) {
    if (!Array.isArray(companies) || companies.length === 0) {
      return null;
    }
    if (targetId) {
      for (var index = 0; index < companies.length; index += 1) {
        if (companies[index].id === targetId) {
          return companies[index];
        }
      }
    }
    return companies[0];
  }

  /**
   * Splits a client's engagements into the operational set and the completed
   * read-only set: completed engagements stay visible but contribute to no
   * operational metric, so every aggregate downstream takes only the
   * operational list.
   */
  function splitEngagements(engagements) {
    var operational = [];
    var completed = [];
    asArray(engagements).forEach(function (engagement) {
      if (engagement.status === ENGAGEMENT_STATUS.COMPLETED) {
        completed.push(engagement);
      } else {
        operational.push(engagement);
      }
    });
    return { operational: operational, completed: completed, total: asArray(engagements).length };
  }

  /**
   * Tags each record of a collection with the id of the engagement it was
   * read from. A light, in-memory join key attached to the already
   * deep-cloned records the Shared Audit State returns — never persisted,
   * never sent back to the store — so cross-engagement aggregates (Team /
   * POC Analytics, Universal Search) can trace a record back to the one
   * engagement workspace it belongs to.
   */
  function tagEngagementId(records, engagementId) {
    return asArray(records).map(function (record) {
      record._engagementId = engagementId;
      return record;
    });
  }

  // ---- Ownership resolution (Issue #35 §5/§6): the one join chain Team and
  // POC Analytics share. A requirement is the accountable unit; evidence and
  // testing resolve to the same team/POC transitively.

  /** A requirement's own recorded owning team and primary POC. */
  function requirementOwnership(requirement) {
    var source = requirement || {};
    return { teamId: source.teamId || '', pocId: source.primaryPocId || '' };
  }

  /** An evidence request's own recorded owning team and assigned POC. */
  function requestOwnership(request) {
    var source = request || {};
    return { teamId: source.teamId || '', pocId: source.assignedPocId || '' };
  }

  /** An evidence item's ownership, resolved through the requirement it satisfies. */
  function evidenceOwnership(evidence, requirementsById) {
    var requirementId = asArray((evidence || {}).requirementIds)[0];
    var requirement = requirementId ? requirementsById[requirementId] : null;
    return requirement ? requirementOwnership(requirement) : { teamId: '', pocId: '' };
  }

  /** A test workpaper's ownership, resolved through its control's own linked requirement. */
  function testOwnership(test, controlsById, requirementsById) {
    var control = test && test.controlId ? controlsById[test.controlId] : null;
    var requirementId = control ? asArray(control.requirementIds)[0] : null;
    var requirement = requirementId ? requirementsById[requirementId] : null;
    return requirement ? requirementOwnership(requirement) : { teamId: '', pocId: '' };
  }

  /**
   * Evidence progress, derived live from the evidence records' own review
   * statuses — never a stored summary.
   */
  function deriveEvidenceProgress(evidenceRecords) {
    var total = asArray(evidenceRecords).length;
    var complete = 0;
    asArray(evidenceRecords).forEach(function (item) {
      if (item.reviewStatus === COMPLETE_STATUS) {
        complete += 1;
      }
    });
    return {
      total: total, complete: complete,
      completionPct: total > 0 ? Math.round((complete / total) * 100) : 0
    };
  }

  /**
   * Requirement / request completion, classified live: complete,
   * out-of-scope (not applicable — excluded from the pending count, never
   * counted as outstanding), and pending. Reused identically over the
   * `evidence-requirements` collection (requirement records) and the
   * `evidence-requests` collection (request records) — both share this
   * exact `.status` vocabulary.
   */
  function deriveRequirementCompletion(records) {
    var total = asArray(records).length;
    var complete = 0, notApplicable = 0;
    asArray(records).forEach(function (record) {
      if (record.status === COMPLETE_STATUS) {
        complete += 1;
      } else if (record.status === NOT_APPLICABLE_STATUS) {
        notApplicable += 1;
      }
    });
    var applicable = total - notApplicable;
    return {
      total: total, complete: complete, notApplicable: notApplicable,
      pending: applicable - complete,
      completionPct: applicable > 0 ? Math.round((complete / applicable) * 100) : 0
    };
  }

  /**
   * Testing completion, derived live from each workpaper's own testing
   * status. Not-applicable workpapers are out of scope, not outstanding.
   */
  function deriveTestingCompletion(testRecords) {
    var total = asArray(testRecords).length;
    var completed = 0, notApplicable = 0;
    asArray(testRecords).forEach(function (test) {
      if (test.testingStatus === TESTING_STATUS.COMPLETED) {
        completed += 1;
      } else if (test.testingStatus === TESTING_STATUS.NOT_APPLICABLE) {
        notApplicable += 1;
      }
    });
    var applicable = total - notApplicable;
    return {
      total: total, completed: completed, notApplicable: notApplicable,
      pending: applicable - completed,
      completionPct: applicable > 0 ? Math.round((completed / applicable) * 100) : 0
    };
  }

  /**
   * Walkthrough completion (Issue #35 §4 — the Walkthrough portfolio
   * metric), derived live from each workpaper's own recorded
   * `walkthroughStatus` — the same field this dataset's workpapers already
   * carry the walkthrough lifecycle on, mirroring `deriveTestingCompletion`.
   */
  function deriveWalkthroughCompletion(testRecords) {
    var total = asArray(testRecords).length;
    var completed = 0, notApplicable = 0;
    asArray(testRecords).forEach(function (test) {
      if (test.walkthroughStatus === TESTING_STATUS.COMPLETED) {
        completed += 1;
      } else if (test.walkthroughStatus === TESTING_STATUS.NOT_APPLICABLE) {
        notApplicable += 1;
      }
    });
    var applicable = total - notApplicable;
    return {
      total: total, completed: completed, notApplicable: notApplicable,
      pending: applicable - completed,
      completionPct: applicable > 0 ? Math.round((completed / applicable) * 100) : 0
    };
  }

  /** Findings, recorded and open, live. */
  function deriveFindingsSummary(findingRecords) {
    var total = asArray(findingRecords).length;
    var open = asArray(findingRecords).filter(function (finding) {
      return finding.status === FINDING_STATUS.OPEN;
    }).length;
    return { total: total, open: open };
  }

  /**
   * Approval summary: evidence and requests awaiting an audit-team decision
   * — the same statuses the Global Approvals workspace aggregates
   * platform-wide, reused unscoped here so a client/engagement/team/POC
   * subset reads the identical vocabulary.
   */
  function deriveApprovalSummary(evidenceRecords, requestRecords) {
    var evidencePending = asArray(evidenceRecords).filter(function (item) {
      return PENDING_APPROVAL_STATUSES.indexOf(item.reviewStatus) !== -1;
    }).length;
    var requestsPending = asArray(requestRecords).filter(function (request) {
      return PENDING_APPROVAL_STATUSES.indexOf(request.status) !== -1;
    }).length;
    return {
      evidencePending: evidencePending,
      requestsPending: requestsPending,
      total: evidencePending + requestsPending
    };
  }

  /** Records genuinely blocked (Issue #35 §4 hover fact), never merely pending review. */
  function deriveBlockedCount(evidenceRecords, requestRecords) {
    var evidenceBlocked = asArray(evidenceRecords).filter(function (item) {
      return BLOCKED_STATUSES.indexOf(item.reviewStatus) !== -1;
    }).length;
    var requestBlocked = asArray(requestRecords).filter(function (request) {
      return BLOCKED_STATUSES.indexOf(request.status) !== -1;
    }).length;
    return evidenceBlocked + requestBlocked;
  }

  /** The most recent recorded activity timestamp, or '' when none is recorded. */
  function deriveLastUpdate(activityEvents, actorNames) {
    var events = RE.deriveRemarkActivity(activityEvents, actorNames, formatDate).slice()
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    return events.length > 0 ? events[0].timestamp : '';
  }

  /**
   * Normalizes one metric's raw derivation result into the uniform shape the
   * portfolio visualization renders: `{ total, complete, pending,
   * completionPct }`, with `completionPct` null when the metric has no
   * meaningful completion rate (no records, or Approvals — a workload count,
   * not a completion metric) so the view never fabricates a percentage.
   */
  function normalizePortfolioMetric(kind, raw) {
    if (kind === 'evidence') {
      return {
        total: raw.total, complete: raw.complete, pending: raw.total - raw.complete,
        completionPct: raw.total > 0 ? raw.completionPct : null
      };
    }
    if (kind === 'findings') {
      var complete = raw.total - raw.open;
      return {
        total: raw.total, complete: complete, pending: raw.open,
        completionPct: raw.total > 0 ? Math.round((complete / raw.total) * 100) : null
      };
    }
    if (kind === 'approvals') {
      return { total: raw.total, complete: null, pending: raw.total, completionPct: null };
    }
    // requirements, testing, walkthrough share the applicable-total shape.
    var applicable = raw.total - raw.notApplicable;
    return {
      total: applicable,
      complete: raw.complete !== undefined ? raw.complete : raw.completed,
      pending: raw.pending,
      completionPct: applicable > 0 ? raw.completionPct : null
    };
  }

  /**
   * One operational engagement's independent contribution to the portfolio
   * visualization (Issue #35 §4): the six normalized metrics, its fixed
   * categorical color, blocked-item count, and last recorded activity.
   */
  function deriveEngagementPortfolio(entry, index, actorNames) {
    var raw = {
      requirements: deriveRequirementCompletion(entry.requirements),
      evidence: deriveEvidenceProgress(entry.evidence),
      testing: deriveTestingCompletion(entry.tests),
      findings: deriveFindingsSummary(entry.findings),
      walkthrough: deriveWalkthroughCompletion(entry.tests),
      approvals: deriveApprovalSummary(entry.evidence, entry.requests)
    };
    var metrics = {};
    PORTFOLIO_METRIC_KEYS.forEach(function (kind) {
      metrics[kind] = normalizePortfolioMetric(kind, raw[kind]);
    });
    return {
      engagement: entry.engagement,
      colorVar: engagementColorVar(index),
      metrics: metrics,
      blocked: deriveBlockedCount(entry.evidence, entry.requests),
      lastUpdate: deriveLastUpdate(entry.activity, actorNames)
    };
  }

  /** The portfolio visualization's data: every engagement's contribution, plus the cross-portfolio total per metric. */
  function derivePortfolioOverview(portfolioEntries) {
    var entries = asArray(portfolioEntries);
    var totals = {};
    PORTFOLIO_METRIC_KEYS.forEach(function (kind) {
      totals[kind] = entries.reduce(function (sum, entry) { return sum + entry.metrics[kind].total; }, 0);
    });
    return { entries: entries, totals: totals };
  }

  /**
   * Portfolio Health (§2): navigable operational indicators aggregated live
   * from the operational engagements only — completed engagements contribute
   * to none of them.
   */
  function derivePortfolioHealth(counts, evidence, requirements, testing, findings, approvals, workspaceRegistry) {
    if (!workspaceRegistry) {
      return [];
    }
    var ids = workspaceRegistry.IDS;
    function pathFor(id) {
      var workspace = workspaceRegistry.findById(id);
      return workspace ? workspace.path : null;
    }
    return [
      {
        key: 'engagements', label: 'Active engagements',
        status: counts.operational.length + ' active · ' + counts.completed.length + ' completed',
        tone: counts.operational.length > 0 ? TONES.INFO : null, path: pathFor(ids.ENGAGEMENT)
      },
      {
        key: 'evidence', label: 'Evidence',
        status: evidence.complete + ' of ' + evidence.total + ' complete',
        tone: evidence.total > 0 && evidence.complete === evidence.total ? TONES.SUCCESS
          : evidence.total > 0 ? TONES.WARNING : null,
        path: pathFor(ids.EVIDENCE)
      },
      {
        key: 'requirements', label: 'Requirements',
        status: requirements.pending + ' pending',
        tone: requirements.pending > 0 ? TONES.WARNING : TONES.SUCCESS,
        path: pathFor(ids.REQUIREMENTS)
      },
      {
        key: 'testing', label: 'Testing',
        status: testing.completed + ' of ' + (testing.total - testing.notApplicable) + ' complete',
        tone: testing.pending > 0 ? TONES.WARNING : TONES.SUCCESS,
        path: pathFor(ids.TESTING)
      },
      {
        key: 'findings', label: 'Open findings',
        status: String(findings.open),
        tone: findings.open > 0 ? TONES.ERROR : TONES.SUCCESS,
        path: pathFor(ids.FINDINGS)
      },
      {
        key: 'approvals', label: 'Pending approvals',
        status: String(approvals.total),
        tone: approvals.total > 0 ? TONES.WARNING : TONES.SUCCESS,
        path: pathFor(ids.APPROVALS)
      }
    ];
  }

  /**
   * Client activity: each operational engagement's own remark activity
   * (Issue #30's `deriveRemarkActivity`, never reimplemented), tagged with
   * its engagement, merged newest first across the client.
   */
  function deriveActivity(operational, actorNames) {
    var events = [];
    asArray(operational).forEach(function (entry) {
      var engagementLabel = (entry.engagement && (entry.engagement.engagementCode || entry.engagement.id)) || '';
      RE.deriveRemarkActivity(entry.activity, actorNames, formatDate).forEach(function (event) {
        events.push({
          title: event.title + (engagementLabel ? ' (' + engagementLabel + ')' : ''),
          meta: event.meta, timestamp: event.timestamp, date: event.date, actor: event.actor
        });
      });
    });
    return events.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, LIST_LIMIT);
  }

  /** Client metadata: created / updated / version / owner / tags, from real record fields only. */
  function deriveMetadata(company, companiesMetadata, engagementCount) {
    var meta = companiesMetadata || {};
    var tags = [];
    if (company.industry) {
      tags.push(company.industry);
    }
    tags.push(engagementCount + ' ' + plural(engagementCount, 'engagement'));
    return {
      created: company.createdAt ? formatDate(company.createdAt) : '',
      updated: meta.generatedAt ? formatDate(String(meta.generatedAt).slice(0, 10)) : '',
      version: meta.version || '',
      owner: company.name || '',
      tags: tags
    };
  }

  /**
   * AI Portfolio Insights (Issue #35 §7): the client's own insight records
   * from the `ai-portfolio-insights` demo collection, exactly as recorded —
   * nothing computed or invented here.
   */
  function deriveAiInsights(insights, companyId) {
    return asArray(insights).filter(function (insight) { return insight.companyId === companyId; });
  }

  // ------------------------------------------------------------------
  // View model — the single place this workspace reads AuditOS.state.
  // ------------------------------------------------------------------

  /** Finds a record by id within a list. */
  var findById = WS.findById;

  /** Indexes a list of records by their id field. */
  var indexById = WS.indexById;

  /** Reads the first dataset document an engagement owns in a collection, or null. */
  var readEngagementDocument = WS.readEngagementDocument;

  /**
   * Universal Client Search index (Issue #35 §8): every searchable
   * Repository entity under the client — engagements, frameworks,
   * requirements, controls, evidence, findings, reports, walkthrough
   * sessions, POCs, and the client's HA team users — each with a real
   * hierarchical or record href where a dedicated workspace surface exists,
   * or no href when it does not (POCs and users have none in Release 1 —
   * shown informational rather than a fabricated link). Built once per
   * render from the same real per-engagement documents every other module
   * reads.
   */
  function buildClientSearchIndex(state, company, engagements, workspaceRegistry, repository) {
    var results = [];
    if (!repository) {
      return results;
    }

    function hierarchicalHref(engagement, workspaceId) {
      return WS.buildHierarchicalHref(repository, workspaceRegistry, company, engagement, workspaceId);
    }

    var seenFrameworks = {};
    asArray(engagements).forEach(function (engagement) {
      results.push({
        kind: 'Engagement', title: engagement.name || engagement.id, meta: engagement.engagementCode || '',
        href: hierarchicalHref(engagement, workspaceRegistry.IDS.ENGAGEMENT)
      });

      var frameworks = WS.normalizeFrameworks ? WS.normalizeFrameworks(engagement)
        : (engagement.framework ? [engagement.framework] : []);
      frameworks.forEach(function (framework) {
        if (seenFrameworks[framework]) {
          return;
        }
        seenFrameworks[framework] = true;
        results.push({
          kind: 'Framework', title: framework, meta: engagement.name || '',
          href: hierarchicalHref(engagement, workspaceRegistry.IDS.ENGAGEMENT)
        });
      });

      var requirements = (readEngagementDocument(state, 'evidence-requirements', engagement.id) || {}).requirements || [];
      requirements.forEach(function (requirement) {
        results.push({
          kind: 'Requirement', title: requirement.title || requirement.id, meta: engagement.name || '',
          href: hierarchicalHref(engagement, workspaceRegistry.IDS.REQUIREMENTS)
        });
      });

      var controls = (readEngagementDocument(state, 'controls', engagement.id) || {}).controls || [];
      controls.forEach(function (control) {
        results.push({
          kind: 'Control', title: (control.controlCode ? control.controlCode + ' · ' : '') + (control.title || control.id),
          meta: engagement.name || '', href: hierarchicalHref(engagement, workspaceRegistry.IDS.CONTROLS)
        });
      });

      var evidenceRecords = (readEngagementDocument(state, 'evidence', engagement.id) || {}).evidence || [];
      evidenceRecords.forEach(function (item) {
        results.push({
          kind: 'Evidence', title: item.title || item.id, meta: engagement.name || '',
          href: hierarchicalHref(engagement, workspaceRegistry.IDS.EVIDENCE)
        });
      });

      var findingRecords = (readEngagementDocument(state, 'findings', engagement.id) || {}).findings || [];
      findingRecords.forEach(function (finding) {
        results.push({
          kind: 'Finding', title: finding.title || finding.id, meta: engagement.name || '',
          href: hierarchicalHref(engagement, workspaceRegistry.IDS.FINDINGS)
        });
      });

      var reportDocument = readEngagementDocument(state, 'reports', engagement.id) || {};
      if (reportDocument.document && reportDocument.document.title) {
        results.push({
          kind: 'Report', title: reportDocument.document.title, meta: engagement.name || '',
          href: hierarchicalHref(engagement, workspaceRegistry.IDS.DOCUMENTATION)
        });
      }

      var walkthroughDocument = readEngagementDocument(state, 'walkthroughs', engagement.id) || {};
      asArray(walkthroughDocument.sessions).forEach(function (session) {
        results.push({
          kind: 'Walkthrough', title: session.title || session.id, meta: engagement.name || '',
          href: hierarchicalHref(engagement, workspaceRegistry.IDS.WALKTHROUGH)
        });
      });
    });

    asArray(state.listRecords('pocs')).filter(function (poc) { return poc.companyId === company.id; })
      .forEach(function (poc) {
        results.push({ kind: 'POC', title: poc.name, meta: asArray(poc.teamNames).join(' · '), href: null });
      });

    var engagementIdSet = {};
    asArray(engagements).forEach(function (engagement) { engagementIdSet[engagement.id] = true; });
    asArray(state.listRecords('users')).filter(function (user) {
      return asArray(user.engagementIds).some(function (id) { return engagementIdSet[id]; });
    }).forEach(function (user) {
      results.push({ kind: 'User', title: user.name || user.id, meta: asArray(user.roles).join(' · '), href: null });
    });

    return results;
  }

  /**
   * Collects everything the Client Workspace presents from the Shared Audit
   * State. `targetId` is the client named by the route (`#/clients?id=`, or
   * a hierarchical client slug — Issue #34). Returns null while the state is
   * not ready, and a degraded model when no client exists (§15.12).
   */
  function collectViewModel(state, workspaceRegistry, targetId) {
    if (!state || !state.isReady()) {
      return null;
    }

    var status = state.getStatus();
    var companies = state.listRecords('companies');
    var company = resolveTargetCompany(companies, targetId);
    if (!company) {
      return { degraded: true, status: status };
    }

    var companiesDocument = state.getDocument('companies') || {};
    var engagements = state.listRecords('engagements').filter(function (engagement) {
      return engagement.companyId === company.id;
    });
    var engagementsById = indexById(engagements);
    var counts = splitEngagements(engagements);

    var programs = state.listRecords('programs').filter(function (program) {
      return program.companyId === company.id;
    });
    var pocs = state.listRecords('pocs').filter(function (poc) { return poc.companyId === company.id; });
    var users = state.listRecords('users');

    // Per-engagement operational documents — read only for the operational
    // (non-completed) engagements, so completed engagements contribute to no
    // operational metric by construction. Every record is tagged with its
    // source engagement id so cross-engagement aggregates (Team / POC
    // Analytics, Universal Search) can trace back to it.
    var operational = counts.operational.map(function (engagement) {
      var reportsDocument = readEngagementDocument(state, 'reports', engagement.id) || {};
      return {
        engagement: engagement,
        requirements: tagEngagementId((readEngagementDocument(state, 'evidence-requirements', engagement.id) || {}).requirements, engagement.id),
        evidence: tagEngagementId((readEngagementDocument(state, 'evidence', engagement.id) || {}).evidence, engagement.id),
        requests: tagEngagementId((readEngagementDocument(state, 'evidence-requests', engagement.id) || {}).requests, engagement.id),
        tests: tagEngagementId((readEngagementDocument(state, 'testing', engagement.id) || {}).tests, engagement.id),
        findings: tagEngagementId((readEngagementDocument(state, 'findings', engagement.id) || {}).findings, engagement.id),
        controls: tagEngagementId((readEngagementDocument(state, 'controls', engagement.id) || {}).controls, engagement.id),
        document: reportsDocument.document || null,
        sections: reportsDocument.sections || [],
        activity: (readEngagementDocument(state, 'activity', engagement.id) || {}).events || []
      };
    });

    function concatField(field) {
      var merged = [];
      operational.forEach(function (entry) {
        merged = merged.concat(asArray(entry[field]));
      });
      return merged;
    }

    var allEvidence = concatField('evidence');
    var allRequests = concatField('requests');
    var allTests = concatField('tests');
    var allFindings = concatField('findings');
    var allRequirements = concatField('requirements');
    var allControls = concatField('controls');
    var requirementsById = indexById(allRequirements);
    var controlsById = indexById(allControls);

    var evidenceProgress = deriveEvidenceProgress(allEvidence);
    var requirementCompletion = deriveRequirementCompletion(allRequirements);
    var testingCompletion = deriveTestingCompletion(allTests);
    var findingsSummary = deriveFindingsSummary(allFindings);
    var approvalSummary = deriveApprovalSummary(allEvidence, allRequests);

    var actorNames = {};
    asArray(pocs).forEach(function (poc) { if (poc.id && poc.name) { actorNames[poc.id] = poc.name; } });
    asArray(users).forEach(function (user) { if (user.id && user.name) { actorNames[user.id] = user.name; } });

    var health = derivePortfolioHealth(counts, evidenceProgress, requirementCompletion,
      testingCompletion, findingsSummary, approvalSummary, workspaceRegistry);
    var activity = deriveActivity(operational, actorNames);
    var metadata = deriveMetadata(company, companiesDocument.metadata, engagements.length);

    var portfolioEntries = operational.map(function (entry, index) {
      return deriveEngagementPortfolio(entry, index, actorNames);
    });
    var portfolioOverview = derivePortfolioOverview(portfolioEntries);
    var insights = deriveAiInsights(state.listRecords('ai-portfolio-insights'), company.id);
    var searchIndex = buildClientSearchIndex(state, company, engagements, workspaceRegistry, AuditOS.repository);

    var headquarters = company.headquarters || {};

    return {
      degraded: false,
      status: status,
      company: company,
      engagements: engagements,
      engagementsById: engagementsById,
      counts: counts,
      programs: programs,

      header: {
        eyebrow: 'Client',
        title: company.name,
        meta: (company.industry || '') +
          (headquarters.city ? ' · ' + headquarters.city + ', ' + headquarters.country : ''),
        status: company.status ? { label: company.status, tone: companyStatusTone(company.status) } : null,
        lastUpdated: metadata.updated ? 'Updated ' + metadata.updated : '',
        actions: [
          // New engagement (Issue #34): the Engagement Creation Wizard entry
          // point, present only when the session holds the capability —
          // hidden, never disabled (Issue #33 §5). The former "Audit
          // program" shortcut is removed (Issue #35 §3/§1) — the Client
          // Workspace itself is now the portfolio view.
          AuditOS.permissions && AuditOS.permissions.can('engagements.create')
            ? { label: 'New engagement', href: '#/new-engagement', variant: 'primary' } : null,
          { label: 'Global approvals', href: '#/approvals', variant: 'subtle' }
        ].filter(Boolean)
      },

      ribbon: [
        { label: 'Client', value: company.name },
        { label: 'Active engagements', value: String(counts.operational.length) },
        { label: 'Completed (read-only)', value: String(counts.completed.length) },
        { label: 'Programs', value: String(programs.length) },
        { label: 'Pending approvals', value: String(approvalSummary.total) },
        // Metadata consolidation (Issue #35 §9): folded into the header
        // ribbon rather than a dedicated Metadata section — no information
        // lost, one less section to scroll past. Owner is already the
        // header title, so it is not repeated here.
        { label: 'Created', value: metadata.created },
        { label: 'Version', value: metadata.version || '—' },
        { label: 'Tags', value: asArray(metadata.tags).join(' · ') }
      ],

      toolbar: { search: { placeholder: 'Search this client' } },
      filterBar: {
        dropdowns: [{
          label: 'Engagement',
          options: ['All engagements'].concat(counts.operational.map(function (engagement) { return engagement.name; }))
        }]
      },

      health: health,
      evidenceProgress: evidenceProgress,
      requirementCompletion: requirementCompletion,
      testingCompletion: testingCompletion,
      findingsSummary: findingsSummary,
      approvalSummary: approvalSummary,
      activity: activity,
      metadata: metadata,

      portfolioOverview: portfolioOverview,
      insights: insights,
      searchIndex: searchIndex,

      footer: [
        { label: 'Environment', value: 'Static prototype' },
        { label: 'Demo status', value: status.demoDataLoaded ? 'Demo data loaded' : 'Demo data degraded' },
        { label: 'Client', value: company.name }
      ]
    };
  }

  // ------------------------------------------------------------------
  // Generic DOM builders — thin layout wrappers around the Enterprise Data
  // Presentation System (AuditOS.presentation). Text is always assigned
  // through textContent, never markup injection.
  // ------------------------------------------------------------------

  /** Creates an element with a class and optional text content. */
  var el = WS.el;

  /** The shared presentation system, resolved at render time. */
  var presentation = WS.presentation;

  /** Builds one Section component: an eyebrow, a title, an optional description, then a body node. */
  function buildSection(id, meta, bodyNode) {
    return WS.buildSection('aos-client', id, meta, bodyNode);
  }

  /**
   * Builds one collapsible Section as a native disclosure (`<details>` /
   * `<summary>`), collapsed by default — the Completed Engagements module
   * (Issue #35 §10), expanded on demand with zero JavaScript.
   */
  function buildCollapsibleSection(id, meta, bodyNode) {
    var details = el('details', 'aos-section aos-client__section aos-client__section--' + id);
    details.setAttribute('aria-label', meta.title);

    var summary = el('summary', 'aos-section__header aos-client__collapsible-summary');
    if (meta.kicker) {
      summary.appendChild(el('p', 'aos-section__eyebrow', meta.kicker));
    }
    summary.appendChild(el('span', 'aos-section__title', meta.title));
    if (meta.description) {
      summary.appendChild(el('p', 'aos-section__description', meta.description));
    }
    details.appendChild(summary);

    var body = el('div', 'aos-section__body');
    body.appendChild(bodyNode);
    details.appendChild(body);
    return details;
  }

  // ---- Shared hover-info tooltip (Issue #35 §4/§5/§6): one reusable,
  // shared tooltip element per module instance — hover or focus a segment or
  // row to populate and position it, never fabricating a per-row DOM node.

  /** Builds the shared tooltip mount for one interactive module. */
  function buildInfoTooltip() {
    var tooltip = el('div', 'aos-client__tooltip');
    tooltip.setAttribute('role', 'status');
    tooltip.hidden = true;
    return tooltip;
  }

  /** Positions the tooltip beneath its anchor, relative to the module's own positioned container. */
  function positionTooltip(tooltip, container, anchor) {
    var anchorRect = anchor.getBoundingClientRect();
    var hostRect = container.getBoundingClientRect();
    tooltip.style.top = (anchorRect.bottom - hostRect.top + 6) + 'px';
    tooltip.style.left = Math.max(0, anchorRect.left - hostRect.left) + 'px';
  }

  /** Populates and shows the shared tooltip with a title and `[term, detail]` rows. */
  function showInfoTooltip(tooltip, container, anchor, title, rows) {
    tooltip.replaceChildren();
    tooltip.appendChild(el('p', 'aos-client__tooltip-title', title));
    rows.forEach(function (row) {
      var line = el('div', 'aos-client__tooltip-row');
      line.appendChild(el('span', 'aos-client__tooltip-term', row[0]));
      line.appendChild(el('span', 'aos-client__tooltip-detail', row[1]));
      tooltip.appendChild(line);
    });
    tooltip.hidden = false;
    positionTooltip(tooltip, container, anchor);
  }

  /** Hides the shared tooltip. */
  function hideInfoTooltip(tooltip) {
    tooltip.hidden = true;
  }

  /** Wires hover and keyboard-focus handlers so `node` shows the shared tooltip with the given facts. */
  function wireTooltip(node, tooltip, container, title, rows) {
    function show() { showInfoTooltip(tooltip, container, node, title, rows); }
    function hide() { hideInfoTooltip(tooltip); }
    node.addEventListener('mouseenter', show);
    node.addEventListener('focus', show);
    node.addEventListener('mouseleave', hide);
    node.addEventListener('blur', hide);
  }

  // ---- Portfolio Overview (Issue #35 §4).

  /** Builds the engagement color legend — identity is never color-alone; every swatch carries its engagement's name. */
  function buildPortfolioLegend(entries, repository, workspaceRegistry, company) {
    var legend = el('div', 'aos-client__viz-legend');
    legend.setAttribute('role', 'list');
    entries.forEach(function (entry) {
      var href = WS.buildHierarchicalHref(repository, workspaceRegistry, company, entry.engagement, workspaceRegistry.IDS.ENGAGEMENT);
      var item = el(href ? 'a' : 'span', 'aos-client__viz-legend-item');
      item.setAttribute('role', 'listitem');
      if (href) {
        item.setAttribute('href', href);
      }
      var swatch = el('span', 'aos-client__viz-swatch');
      swatch.style.backgroundColor = 'var(' + entry.colorVar + ')';
      swatch.setAttribute('aria-hidden', 'true');
      item.appendChild(swatch);
      item.appendChild(el('span', 'aos-client__viz-legend-label', entry.engagement.name || entry.engagement.id));
      legend.appendChild(item);
    });
    return legend;
  }

  /**
   * Builds one metric's stacked bar: each engagement contributes an
   * independently sized, independently colored, independently clickable
   * segment (Issue #35 §4). A segment's width is its share of the metric's
   * cross-portfolio total; within the segment, a translucent overlay covers
   * the pending share so completion reads at a glance without a second
   * chart. Clicking a segment navigates directly into that engagement's
   * workspace for this metric.
   */
  function buildPortfolioMetricRow(kind, entries, tooltip, container, repository, workspaceRegistry, company) {
    var def = PORTFOLIO_METRIC_DEFS[kind];
    var row = el('div', 'aos-client__viz-row');
    row.appendChild(el('span', 'aos-client__viz-row-label', def.label));

    var bar = el('div', 'aos-client__viz-bar');
    bar.setAttribute('role', 'img');
    var totalAcross = entries.reduce(function (sum, entry) { return sum + entry.metrics[kind].total; }, 0);
    bar.setAttribute('aria-label', def.label + ' by engagement — ' + totalAcross + ' total');

    entries.forEach(function (entry) {
      var metric = entry.metrics[kind];
      if (metric.total <= 0) {
        return;
      }
      var href = def.workspaceKey
        ? WS.buildHierarchicalHref(repository, workspaceRegistry, company, entry.engagement, workspaceRegistry.IDS[def.workspaceKey])
        : (def.globalPath ? '#/' + def.globalPath : null);
      var segment = el(href ? 'a' : 'span', 'aos-client__viz-segment');
      if (href) {
        segment.setAttribute('href', href);
      }
      segment.style.setProperty('--aos-client-viz-color', 'var(' + entry.colorVar + ')');
      segment.style.flexGrow = String(metric.total);
      var engagementName = entry.engagement.name || entry.engagement.id;
      segment.setAttribute('aria-label', engagementName + ': ' +
        (metric.completionPct !== null ? metric.completionPct + '% complete' : metric.total + ' recorded'));

      if (metric.pending > 0 && metric.total > 0) {
        var overlay = el('span', 'aos-client__viz-segment-pending');
        overlay.style.width = Math.round((metric.pending / metric.total) * 100) + '%';
        overlay.setAttribute('aria-hidden', 'true');
        segment.appendChild(overlay);
      }

      wireTooltip(segment, tooltip, container, engagementName, [
        ['Completed', metric.complete !== null ? String(metric.complete) : '—'],
        ['Pending', String(metric.pending)],
        ['Completion', metric.completionPct !== null ? metric.completionPct + '%' : '—'],
        ['Blocked', String(entry.blocked)],
        ['Last update', entry.lastUpdate || 'Not recorded']
      ]);
      bar.appendChild(segment);
    });

    row.appendChild(bar);
    row.appendChild(el('span', 'aos-client__viz-row-total aos-numeric', String(totalAcross)));
    return row;
  }

  /** Builds the Portfolio Overview body: the health strip, identity properties, and the interactive segmented visualization. */
  function buildPortfolioOverviewBody(viewModel, portfolio, repository, workspaceRegistry) {
    var P = presentation();
    var surface = el('div', 'aos-surface aos-surface--padded aos-client__overview');
    surface.appendChild(WS.buildHealthStrip('aos-client', 'Portfolio health', viewModel.health));
    surface.appendChild(P.propertyGrid([
      { label: 'Client', value: viewModel.company.name },
      { label: 'Legal name', value: viewModel.company.legalName || '' },
      { label: 'Industry', value: viewModel.company.industry || '' },
      {
        label: 'Headquarters',
        value: viewModel.company.headquarters && viewModel.company.headquarters.city
          ? viewModel.company.headquarters.city + ', ' + viewModel.company.headquarters.country : ''
      },
      { label: 'Status', value: viewModel.company.status || '' }
    ], { columns: 2 }));

    if (portfolio.entries.length === 0) {
      surface.appendChild(P.emptyState({
        icon: '◇', title: 'No active engagements to visualize',
        description: 'Portfolio completion by engagement appears here once an engagement is active.'
      }));
      return surface;
    }

    var viz = el('div', 'aos-client__viz');
    viz.appendChild(buildPortfolioLegend(portfolio.entries, repository, workspaceRegistry, viewModel.company));
    var tooltip = buildInfoTooltip();
    PORTFOLIO_METRIC_KEYS.forEach(function (kind) {
      viz.appendChild(buildPortfolioMetricRow(kind, portfolio.entries, tooltip, viz, repository, workspaceRegistry, viewModel.company));
    });
    viz.appendChild(tooltip);
    surface.appendChild(viz);
    return surface;
  }

  /**
   * Builds an engagement card grid. Active engagements link into the
   * Engagement workspace via stable record routes (Issue #31); completed
   * engagements render the same card marked read-only — visible for
   * reference, contributing to no operational metric.
   */
  function buildEngagementCards(engagements, workspaceRegistry, readOnly) {
    var P = presentation();
    var grid = el('div', 'aos-client__engagement-grid');
    asArray(engagements).forEach(function (engagement) {
      grid.appendChild(P.entityCard({
        title: engagement.name,
        subtitle: engagement.engagementCode,
        href: WS.buildRecordHref(workspaceRegistry, workspaceRegistry.IDS.ENGAGEMENT, engagement.id),
        badge: readOnly
          ? { label: engagement.status + ' · Read-only', tone: statusTone(engagement.status) }
          : { label: engagement.status, tone: statusTone(engagement.status) },
        facts: [
          { term: 'Framework', detail: engagement.framework || '' },
          { term: 'Audit period', detail: formatPeriod(engagement.auditPeriod) },
          { term: 'Auditor', detail: engagement.auditor || '' }
        ]
      }));
    });
    return grid;
  }

  /** Builds the AI Portfolio Insights body (Issue #35 §7): every insight rendered exactly as recorded, JSON-backed. */
  function buildAiInsightsBody(insights, repository, workspaceRegistry, engagementsById, company) {
    var P = presentation();
    if (asArray(insights).length === 0) {
      return P.emptyState({
        icon: '✦', title: 'No AI insights yet',
        description: 'Portfolio risk, bottleneck, and readiness signals will appear here once recorded.'
      });
    }
    var items = insights.map(function (insight) {
      var engagement = insight.scope && insight.scope.kind === 'engagement' ? engagementsById[insight.scope.id] : null;
      var href = engagement ? WS.buildHierarchicalHref(repository, workspaceRegistry, company, engagement, workspaceRegistry.IDS.ENGAGEMENT) : null;
      var confidencePct = typeof insight.confidence === 'number' ? Math.round(insight.confidence * 100) : null;
      var description = insight.description +
        (insight.recommendation ? ' Recommended: ' + insight.recommendation : '') +
        (confidencePct !== null ? ' (confidence ' + confidencePct + '%)' : '');
      return {
        title: insight.title,
        description: description,
        tone: insight.severity,
        actions: href ? [{ label: 'Open engagement', href: href }] : []
      };
    });
    return P.itemList(items, { compact: true });
  }

  /** Builds the Activity Feed for the activity supporting panel. */
  function buildActivityBody(activity) {
    return WS.buildActivityBody(activity, {
      icon: '◇', title: 'No recent activity',
      description: 'Remarks recorded across this client’s active engagements appear here as work progresses.'
    });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    return WS.buildFooterItems('aos-client', entries);
  }

  // ------------------------------------------------------------------
  // Module registry (Issue #35 §11) — the module-driven shell. Each entry
  // names its framework region and carries its own render function; the
  // renderer below only iterates this list in order and dispatches by
  // region, so hiding, reordering, or adding a module means editing this
  // list, never the rendering code.
  // ------------------------------------------------------------------

  /** Filters the portfolio visualization's entries to one engagement, or returns every entry when no filter is active. */
  function filterPortfolioEntries(entries, engagementId) {
    if (!engagementId) {
      return entries;
    }
    return entries.filter(function (entry) { return entry.engagement.id === engagementId; });
  }

  /** Builds the ordered module configuration for one render pass, given the current engagement filter. */
  function buildModuleRegistry(viewModel, filterState, repository, workspaceRegistry) {
    var filteredOperational = filterState.engagementId
      ? viewModel.counts.operational.filter(function (engagement) { return engagement.id === filterState.engagementId; })
      : viewModel.counts.operational;
    var filteredPortfolio = {
      entries: filterPortfolioEntries(viewModel.portfolioOverview.entries, filterState.engagementId),
      totals: viewModel.portfolioOverview.totals
    };
    var completed = viewModel.counts.completed;

    return [
      {
        id: 'portfolio-overview', region: 'content', enabled: true,
        kicker: 'Portfolio status', title: 'Portfolio overview',
        render: function () { return buildPortfolioOverviewBody(viewModel, filteredPortfolio, repository, workspaceRegistry); }
      },
      {
        id: 'engagement-portfolio', region: 'content', enabled: true,
        kicker: 'Operational', title: 'Engagement portfolio',
        description: 'Each engagement opens its own operational workspace.',
        present: filteredOperational.length > 0,
        render: function () { return buildEngagementCards(filteredOperational, workspaceRegistry, false); },
        empty: {
          icon: '◇', title: 'No active engagements',
          description: 'Engagements in progress for this client appear here.'
        }
      },
      {
        id: 'completed-engagements', region: 'content', enabled: completed.length > 0, collapsedByDefault: true,
        kicker: 'Reference', title: 'Completed engagements (' + completed.length + ')',
        description: 'Completed engagements stay visible read-only and contribute to no operational metric.',
        render: function () { return buildEngagementCards(completed, workspaceRegistry, true); }
      },
      {
        id: 'ai-insights', region: 'ai', enabled: true,
        render: function () {
          return buildAiInsightsBody(viewModel.insights, repository, workspaceRegistry, viewModel.engagementsById, viewModel.company);
        }
      },
      {
        id: 'activity', region: 'activity', enabled: true,
        render: function () { return buildActivityBody(viewModel.activity); }
      }
    ];
  }

  // ------------------------------------------------------------------
  // Interaction wiring — engagement filtering and universal search. Both
  // attach behavior to nodes the Shared Workspace Framework already
  // rendered, rather than changing the framework's generic contract.
  // ------------------------------------------------------------------

  /**
   * Wires the toolbar's Engagement filter to genuinely filter the workspace
   * (Issue #35 §3/§4) — never an inert control. Selecting an engagement
   * calls back with the resolved id (or '' for "All engagements"); the
   * caller re-renders the canvas with that filter applied.
   */
  function wireEngagementFilter(view, viewModel, filterState, onChange) {
    var select = view.querySelector('[data-slot="workspace-filters"] .aos-select__control');
    if (!select) {
      return;
    }
    var allLabel = 'All engagements';
    var current = filterState.engagementId ? viewModel.engagementsById[filterState.engagementId] : null;
    select.value = current ? (current.name || allLabel) : allLabel;
    select.addEventListener('change', function () {
      if (select.value === allLabel) {
        onChange({ engagementId: '' });
        return;
      }
      var match = viewModel.counts.operational.filter(function (engagement) {
        return engagement.name === select.value;
      })[0];
      onChange({ engagementId: match ? match.id : '' });
    });
  }

  /**
   * Wires Universal Client Search (Issue #35 §8) onto the toolbar's Search
   * Field: filtering the precomputed client-wide index by substring match
   * and rendering results into a panel this workspace owns (the framework's
   * search field stays the generic, presentation-only component every other
   * workspace shares). Closes on Escape or on focus leaving the search
   * region — tracked through `focusout`'s `relatedTarget`, never a timer.
   */
  function wireClientSearch(view, index) {
    var searchField = view.querySelector('[data-slot="workspace-toolbar"] .aos-search-field');
    var input = searchField ? searchField.querySelector('.aos-search-field__input') : null;
    if (!searchField || !input || !searchField.parentNode) {
      return;
    }

    var wrapper = el('div', 'aos-client__search');
    searchField.parentNode.insertBefore(wrapper, searchField);
    wrapper.appendChild(searchField);
    var results = el('div', 'aos-client__search-results');
    results.hidden = true;
    results.setAttribute('role', 'listbox');
    wrapper.appendChild(results);

    function render(query) {
      results.replaceChildren();
      var trimmed = query.trim().toLowerCase();
      if (!trimmed) {
        results.hidden = true;
        return;
      }
      var matches = index.filter(function (item) {
        return item.title.toLowerCase().indexOf(trimmed) !== -1 ||
          (item.meta || '').toLowerCase().indexOf(trimmed) !== -1;
      }).slice(0, SEARCH_LIMIT);

      if (matches.length === 0) {
        results.appendChild(el('p', 'aos-client__search-empty', 'No matches in this client.'));
        results.hidden = false;
        return;
      }
      matches.forEach(function (item) {
        var row = el(item.href ? 'a' : 'div', 'aos-client__search-result');
        row.setAttribute('role', 'option');
        if (item.href) {
          row.setAttribute('href', item.href);
        }
        row.appendChild(el('span', 'aos-client__search-result-kind', item.kind));
        row.appendChild(el('span', 'aos-client__search-result-title', item.title));
        if (item.meta) {
          row.appendChild(el('span', 'aos-client__search-result-meta', item.meta));
        }
        results.appendChild(row);
      });
      results.hidden = false;
    }

    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('focus', function () { if (input.value.trim()) { render(input.value); } });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        results.hidden = true;
        input.blur();
      }
    });
    wrapper.addEventListener('focusout', function (event) {
      if (!wrapper.contains(event.relatedTarget)) {
        results.hidden = true;
      }
    });
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /** Renders the ready Client Workspace experience into the framework slots, honoring the current engagement filter. */
  function renderReady(view, viewModel, workspaceRegistry, repository, filterState) {
    var P = presentation();

    AuditOS.workspaceFramework.configure(view, {
      header: viewModel.header,
      contextSummary: viewModel.ribbon,
      toolbar: viewModel.toolbar,
      filterBar: viewModel.filterBar
    });

    var modules = buildModuleRegistry(viewModel, filterState, repository, workspaceRegistry);

    var canvas = el('div', 'aos-client');
    canvas.setAttribute('data-canvas', 'flush');
    var rendered = 0;
    modules.filter(function (module) { return module.region === 'content' && module.enabled !== false; }).forEach(function (module) {
      var present = module.present === undefined ? true : module.present;
      var body = present ? module.render() : P.emptyState(module.empty);
      var built = module.collapsedByDefault ? buildCollapsibleSection(module.id, module, body) : buildSection(module.id, module, body);
      built.classList.add('aos-rise-in');
      if (rendered > 0) {
        built.classList.add('aos-rise-in--' + Math.min(rendered, STAGGER_LIMIT));
      }
      rendered += 1;
      canvas.appendChild(built);
    });
    fillSlot(view, SLOTS.CONTENT, [canvas]);

    // Issue #37 Part 1: the Client Workspace registers no related-region
    // module; filling the slot with the (empty) mapped list clears any
    // loading placeholder instead of leaving it behind.
    fillSlot(view, SLOTS.RELATED, modules.filter(function (module) {
      return module.region === 'related' && module.enabled !== false;
    }).map(function (module) {
      var node = module.render();
      node.classList.add('aos-fade-in');
      return node;
    }));
    modules.filter(function (module) { return module.region === 'ai' && module.enabled !== false; }).forEach(function (module) {
      var node = module.render();
      node.classList.add('aos-tint-brand', 'aos-fade-in');
      fillSlot(view, SLOTS.AI, [node]);
    });
    modules.filter(function (module) { return module.region === 'activity' && module.enabled !== false; }).forEach(function (module) {
      var node = module.render();
      node.classList.add('aos-fade-in');
      fillSlot(view, SLOTS.ACTIVITY, [node]);
    });

    fillSlot(view, SLOTS.FOOTER, [buildFooterItems(viewModel.footer)]);

    wireEngagementFilter(view, viewModel, filterState, function (nextFilterState) {
      renderReady(view, viewModel, workspaceRegistry, repository, nextFilterState);
    });
    wireClientSearch(view, viewModel.searchIndex);
  }

  /** Renders the layout-stable loading state (§15.12 — Loading). */
  function renderLoading(view) {
    var P = presentation();
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'detail', label: 'Loading client' })]);
    fillSlot(view, SLOTS.AI, [P.loadingState({ variant: 'list', label: 'Loading AI advisory' })]);
    fillSlot(view, SLOTS.ACTIVITY, [P.loadingState({ variant: 'list', label: 'Loading activity' })]);
  }

  /** Renders the degraded state (§15.12 — Empty / Error). */
  function renderDegraded(view, viewModel) {
    var P = presentation();
    fillSlot(view, SLOTS.CONTENT, [P.emptyState({
      icon: '◇', title: 'No client available',
      description: 'The Shared Audit State holds no client to present' +
        (viewModel.status && viewModel.status.degradedReason ? ' (' + viewModel.status.degradedReason + ')' : '') +
        '. Regenerate the demo-data bundle and reload to restore the Client Workspace.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders the Client Workspace when it is the active workspace: the ready
   * experience once the state has loaded, the loading skeleton before that,
   * and the degraded explanation when no client is available.
   */
  function renderActiveClientDashboard() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.CLIENT) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.CLIENT + '"]'
    );
    if (!view) {
      return;
    }

    var targetId = router.getCurrentRecordId ? router.getCurrentRecordId() : '';
    var viewModel = state ? collectViewModel(state, registry, targetId) : null;
    if (!viewModel) {
      renderLoading(view);
      return;
    }
    if (viewModel.degraded) {
      renderDegraded(view, viewModel);
      return;
    }
    renderReady(view, viewModel, registry, AuditOS.repository, { engagementId: '' });
  }

  AuditOS.clientDashboardWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      statusTone: statusTone,
      companyStatusTone: companyStatusTone,
      resolveTargetCompany: resolveTargetCompany,
      splitEngagements: splitEngagements,
      requirementOwnership: requirementOwnership,
      requestOwnership: requestOwnership,
      evidenceOwnership: evidenceOwnership,
      testOwnership: testOwnership,
      deriveEvidenceProgress: deriveEvidenceProgress,
      deriveRequirementCompletion: deriveRequirementCompletion,
      deriveTestingCompletion: deriveTestingCompletion,
      deriveWalkthroughCompletion: deriveWalkthroughCompletion,
      deriveFindingsSummary: deriveFindingsSummary,
      deriveApprovalSummary: deriveApprovalSummary,
      deriveBlockedCount: deriveBlockedCount,
      deriveEngagementPortfolio: deriveEngagementPortfolio,
      derivePortfolioOverview: derivePortfolioOverview,
      derivePortfolioHealth: derivePortfolioHealth,
      deriveActivity: deriveActivity,
      deriveMetadata: deriveMetadata,
      deriveAiInsights: deriveAiInsights
    },

    collectViewModel: collectViewModel,

    /**
     * Renders the ready experience into an already-framework-rendered view.
     * Exposed (mirroring every other workspace's host-agnostic renderer) so
     * a host can render and test the full module dispatch — engagement
     * filtering, universal search wiring, and the module registry — without
     * going through the router.
     */
    renderReady: renderReady,

    /**
     * Binds the Client Workspace to the router and the Shared Audit State.
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

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveClientDashboard);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveClientDashboard);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveClientDashboard);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveClientDashboard);
      }
      // The New engagement entry point is capability-gated; the workspace
      // follows Demo Mode role switches (Issue #34).
      if (AuditOS.permissions && typeof AuditOS.permissions.subscribe === 'function') {
        AuditOS.permissions.subscribe(renderActiveClientDashboard);
      }
      renderActiveClientDashboard();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.clientDashboardWorkspace.init);
    } else {
      AuditOS.clientDashboardWorkspace.init();
    }
  }
})(window);
