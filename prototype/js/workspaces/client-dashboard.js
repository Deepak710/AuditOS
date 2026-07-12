/**
 * AuditOS Client Dashboard Workspace
 * Platform Information Architecture — GitHub Issue #33 (§2 Client Dashboard) /
 * Workspaces and Navigation — Chapter 12 / Component Architecture — Chapter 74
 *
 * The client level of the permanent platform hierarchy (AuditOS → Client →
 * Program → Engagement). Selecting a client on Global Home opens this
 * at-a-glance operational overview of that client's whole portfolio: active
 * engagements, upcoming milestones, portfolio health, evidence / requirement
 * / testing progress, findings, documentation and report readiness, team
 * workload, and the approval summary. It communicates portfolio health; it
 * never replaces the individual engagement workspaces it links into.
 *
 * Completed engagements remain visible but read-only: they render in their
 * own clearly-marked section and contribute to no operational metric — every
 * aggregate below derives exclusively from the engagements that are not
 * completed (the same completed-status handling the Audit Program workspace
 * established in Issue #32, applied one level up).
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to every
 * other operational workspace and modeled directly on the Audit Program
 * workspace — the established cross-engagement aggregation precedent.
 * `collectViewModel` is the single place this workspace reads
 * `AuditOS.state`; every count is derived live from the underlying records
 * (never a stored aggregate). The renderer configures the Shared Workspace
 * Framework's inherited skeleton and fills its slots with compositions from
 * the Enterprise Data Presentation System. It reuses the Workspace Shared
 * Platform (Issue #27), the Cross-Workspace Relationship Engine (Issue #30),
 * and Cross-Workspace Record Navigation (Issue #31) — no logic those issues
 * already extracted is reimplemented here.
 *
 * "Upcoming" milestones are measured against the dataset's own generation
 * date (document metadata `generatedAt`), a data-derived reference that keeps
 * every derivation deterministic and offline-testable — never the runtime
 * clock.
 *
 * Presentation only. Every business value is read through `AuditOS.state`;
 * nothing is written. Sections with no data render shared Empty State
 * components; nothing is fabricated. The AI surface is a reserved
 * presentation region — AI stays advisory and human approval remains
 * mandatory.
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

  /** Testing lifecycle vocabulary of this dataset (read, never invented). */
  var TESTING_STATUS = { COMPLETED: 'Completed', NOT_APPLICABLE: 'Not Applicable' };

  /** Finding lifecycle vocabulary (read, never invented). */
  var FINDING_STATUS = { OPEN: 'Open' };

  /** Maximum entries per supporting list so sections stay scannable. */
  var LIST_LIMIT = WS.LIST_LIMIT;

  /** Maximum upcoming milestones shown across the whole portfolio. */
  var MILESTONE_LIMIT = 12;

  /** Entrance stagger ceiling — sections beyond this share the last delay. */
  var STAGGER_LIMIT = WS.STAGGER_LIMIT;

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
   * The client this dashboard presents: the company the route's record id
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
   * read-only set (Issue #33 §2): completed engagements stay visible but
   * contribute to no operational metric, so every aggregate downstream takes
   * only the operational list.
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
   * Upcoming milestones across the portfolio: every dated engagement event
   * (audit-period bounds and as-on dates) on or after the reference date —
   * the dataset's own generation date, never the runtime clock — sorted
   * ascending and capped so the timeline stays scannable.
   */
  function deriveUpcomingMilestones(engagements, referenceDate) {
    var events = [];
    asArray(engagements).forEach(function (engagement) {
      var name = engagement.name || engagement.id;
      if (engagement.auditPeriod) {
        events.push({ date: engagement.auditPeriod.startDate, title: name + ' — audit period begins' });
        events.push({ date: engagement.auditPeriod.endDate, title: name + ' — audit period ends' });
      }
      if (engagement.asOnDate) {
        events.push({ date: engagement.asOnDate, title: name + ' — as-on date' });
      }
      if (engagement.reportReleaseDate) {
        events.push({ date: engagement.reportReleaseDate, title: name + ' — report release' });
      }
    });
    return events
      .filter(function (event) {
        return Boolean(event.date) && (!referenceDate || String(event.date) >= String(referenceDate));
      })
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })
      .slice(0, MILESTONE_LIMIT)
      .map(function (event) { return { timestamp: formatDate(event.date), title: event.title }; });
  }

  /**
   * Evidence progress across the operational engagements, derived live from
   * the evidence records' own review statuses — never a stored summary.
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
   * Requirement completion, read through the evidence requests that fulfil
   * them: complete, out-of-scope (not applicable — excluded from the pending
   * count, never counted as outstanding), and pending, classified live.
   */
  function deriveRequirementCompletion(requestRecords) {
    var total = asArray(requestRecords).length;
    var complete = 0, notApplicable = 0;
    asArray(requestRecords).forEach(function (request) {
      if (request.status === COMPLETE_STATUS) {
        complete += 1;
      } else if (request.status === NOT_APPLICABLE_STATUS) {
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
   * Testing completion across the operational engagements, derived live from
   * each workpaper's own testing status. Not-applicable workpapers are out
   * of scope, not outstanding.
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

  /** Findings across the operational engagements: recorded and open counts, live. */
  function deriveFindingsSummary(findingRecords) {
    var total = asArray(findingRecords).length;
    var open = asArray(findingRecords).filter(function (finding) {
      return finding.status === FINDING_STATUS.OPEN;
    }).length;
    return { total: total, open: open };
  }

  /**
   * Documentation and report readiness per operational engagement, read from
   * each engagement's continuously assembled report document: its real
   * status, version, and how many sections are currently included.
   */
  function deriveReadiness(reportEntries) {
    return asArray(reportEntries)
      .filter(function (entry) { return entry.document && entry.document.status; })
      .map(function (entry) {
        var sections = asArray(entry.sections);
        var included = sections.filter(function (section) { return section.included; }).length;
        return {
          engagementName: entry.engagement.name || entry.engagement.id,
          title: entry.document.title || '',
          status: entry.document.status,
          version: entry.document.version || '',
          includedSections: included,
          totalSections: sections.length
        };
      });
  }

  /**
   * Team workload: the client teams ranked by the evidence requests still
   * open with them (neither complete nor out of scope) across the
   * operational engagements — real assignment records, never an estimate.
   */
  function deriveTeamWorkload(requestRecords, teamsById) {
    var counts = {};
    asArray(requestRecords).forEach(function (request) {
      if (!request.teamId || request.status === COMPLETE_STATUS || request.status === NOT_APPLICABLE_STATUS) {
        return;
      }
      counts[request.teamId] = (counts[request.teamId] || 0) + 1;
    });
    return Object.keys(counts)
      .map(function (teamId) {
        var team = teamsById ? teamsById[teamId] : null;
        return { teamId: teamId, name: team ? team.name : teamId, openRequests: counts[teamId] };
      })
      .sort(function (a, b) { return b.openRequests - a.openRequests; });
  }

  /**
   * Approval summary across the operational engagements: evidence and
   * requests awaiting an audit-team decision — the same statuses the Global
   * Approvals workspace aggregates platform-wide, scoped to this client.
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

  /**
   * Portfolio Health (Issue #33 §2): navigable operational indicators
   * aggregated live from the operational engagements only — completed
   * engagements contribute to none of them.
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

  /** Related objects (§12.13): the client-scoped destinations as count-annotated links. */
  function deriveRelationships(workspaceRegistry, counts) {
    if (!workspaceRegistry) {
      return [];
    }
    var ids = workspaceRegistry.IDS;
    var related = [
      { id: ids.PROGRAM, title: 'Audit programs', meta: String(counts.programs), present: counts.programs > 0 },
      { id: ids.ENGAGEMENT, title: 'Engagements', meta: String(counts.engagements), present: counts.engagements > 0 },
      { id: ids.WORKQUEUE, title: 'Work queue', meta: '', present: counts.engagements > 0 },
      { id: ids.APPROVALS, title: 'Global approvals', meta: String(counts.approvals), present: true }
    ];
    return WS.resolveRelationships(workspaceRegistry, related);
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

  /** Client metadata (§8): created / updated / version / owner / tags, from real record fields only. */
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
   * Collects everything the Client Dashboard presents from the Shared Audit
   * State. `targetId` is the client named by the route (`#/clients?id=`, the
   * selection Global Home makes). Returns null while the state is not ready,
   * and a degraded model when no client exists (§15.12).
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
    var engagementsDocument = state.getDocument('engagements') || {};
    var engagements = state.listRecords('engagements').filter(function (engagement) {
      return engagement.companyId === company.id;
    });
    var counts = splitEngagements(engagements);

    var programs = state.listRecords('programs').filter(function (program) {
      return program.companyId === company.id;
    });
    var teamsById = indexById(state.listRecords('teams').filter(function (team) {
      return team.companyId === company.id;
    }));

    // Per-engagement operational documents — read only for the operational
    // (non-completed) engagements, so completed engagements contribute to no
    // operational metric by construction (Issue #33 §2).
    var operational = counts.operational.map(function (engagement) {
      var reportsDocument = readEngagementDocument(state, 'reports', engagement.id) || {};
      return {
        engagement: engagement,
        evidence: (readEngagementDocument(state, 'evidence', engagement.id) || {}).evidence || [],
        requests: (readEngagementDocument(state, 'evidence-requests', engagement.id) || {}).requests || [],
        tests: (readEngagementDocument(state, 'testing', engagement.id) || {}).tests || [],
        findings: (readEngagementDocument(state, 'findings', engagement.id) || {}).findings || [],
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

    var evidenceProgress = deriveEvidenceProgress(allEvidence);
    var requirementCompletion = deriveRequirementCompletion(allRequests);
    var testingCompletion = deriveTestingCompletion(allTests);
    var findingsSummary = deriveFindingsSummary(allFindings);
    var approvalSummary = deriveApprovalSummary(allEvidence, allRequests);
    var teamWorkload = deriveTeamWorkload(allRequests, teamsById);
    var readiness = deriveReadiness(operational.map(function (entry) {
      return { engagement: entry.engagement, document: entry.document, sections: entry.sections };
    }));

    // "Upcoming" is measured against the dataset's own generation date — a
    // deterministic, data-derived reference, never the runtime clock.
    var referenceDate = engagementsDocument.metadata && engagementsDocument.metadata.generatedAt
      ? String(engagementsDocument.metadata.generatedAt).slice(0, 10) : '';
    var milestones = deriveUpcomingMilestones(engagements, referenceDate);

    var pocs = state.listRecords('pocs');
    var users = state.listRecords('users');
    var actorNames = {};
    asArray(pocs).forEach(function (poc) { if (poc.id && poc.name) { actorNames[poc.id] = poc.name; } });
    asArray(users).forEach(function (user) { if (user.id && user.name) { actorNames[user.id] = user.name; } });

    var health = derivePortfolioHealth(counts, evidenceProgress, requirementCompletion,
      testingCompletion, findingsSummary, approvalSummary, workspaceRegistry);
    var relationships = deriveRelationships(workspaceRegistry, {
      programs: programs.length,
      engagements: engagements.length,
      approvals: approvalSummary.total
    });
    var activity = deriveActivity(operational, actorNames);
    var metadata = deriveMetadata(company, companiesDocument.metadata, engagements.length);

    var headquarters = company.headquarters || {};

    return {
      degraded: false,
      status: status,
      company: company,
      engagements: engagements,
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
          // hidden, never disabled (Issue #33 §5).
          AuditOS.permissions && AuditOS.permissions.can('engagements.create')
            ? { label: 'New engagement', href: '#/new-engagement', variant: 'primary' } : null,
          programs.length > 0 ? { label: 'Audit program', href: '#/program', variant: 'subtle' } : null,
          { label: 'Global approvals', href: '#/approvals', variant: 'subtle' }
        ].filter(Boolean)
      },

      ribbon: [
        { label: 'Client', value: company.name },
        { label: 'Active engagements', value: String(counts.operational.length) },
        { label: 'Completed (read-only)', value: String(counts.completed.length) },
        { label: 'Programs', value: String(programs.length) },
        { label: 'Pending approvals', value: String(approvalSummary.total) }
      ],

      toolbar: { search: { placeholder: 'Search this client' } },
      filterBar: {
        dropdowns: [{
          label: 'Engagement',
          options: ['All engagements'].concat(engagements.map(function (engagement) { return engagement.name; }))
        }]
      },

      health: health,
      milestones: milestones,
      evidenceProgress: evidenceProgress,
      requirementCompletion: requirementCompletion,
      testingCompletion: testingCompletion,
      findingsSummary: findingsSummary,
      approvalSummary: approvalSummary,
      teamWorkload: teamWorkload,
      readiness: readiness,
      relationships: relationships,
      activity: activity,
      metadata: metadata,

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

  /** Builds the Portfolio overview body: the health strip over the client's identity properties. */
  function buildOverviewBody(model) {
    var P = presentation();
    var surface = el('div', 'aos-surface aos-surface--padded aos-client__overview');
    surface.appendChild(WS.buildHealthStrip('aos-client', 'Portfolio health', model.health));
    surface.appendChild(P.propertyGrid([
      { label: 'Client', value: model.company.name },
      { label: 'Legal name', value: model.company.legalName || '' },
      { label: 'Industry', value: model.company.industry || '' },
      {
        label: 'Headquarters',
        value: model.company.headquarters && model.company.headquarters.city
          ? model.company.headquarters.city + ', ' + model.company.headquarters.country : ''
      },
      { label: 'Delivery centers', value: asArray(model.company.deliveryCenters).join(' · ') },
      { label: 'Status', value: model.company.status || '' }
    ], { columns: 2 }));
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

  /** Builds the Upcoming milestones body: the shared Timeline over dated events, or the Empty State. */
  function buildMilestonesBody(milestones) {
    var P = presentation();
    return asArray(milestones).length > 0 ? P.timeline(milestones) : P.emptyState({
      icon: '◇', title: 'No upcoming milestones',
      description: 'Dated engagement milestones on or after the dataset date appear here.'
    });
  }

  /**
   * Builds the Delivery progress body: evidence, requirement, and testing
   * completion as accessible progress meters over live record-level counts.
   */
  function buildProgressBody(model) {
    var P = presentation();
    var wrap = el('div', 'aos-surface aos-surface--padded aos-client__progress');
    wrap.appendChild(P.progressMeter({
      label: 'Evidence complete',
      value: model.evidenceProgress.complete,
      total: model.evidenceProgress.total,
      tone: model.evidenceProgress.completionPct === 100 ? TONES.SUCCESS : null
    }));
    wrap.appendChild(P.progressMeter({
      label: 'Requirements complete',
      value: model.requirementCompletion.complete,
      total: model.requirementCompletion.complete + model.requirementCompletion.pending,
      tone: model.requirementCompletion.pending === 0 ? TONES.SUCCESS : null
    }));
    wrap.appendChild(P.progressMeter({
      label: 'Testing complete',
      value: model.testingCompletion.completed,
      total: model.testingCompletion.completed + model.testingCompletion.pending,
      tone: model.testingCompletion.pending === 0 ? TONES.SUCCESS : null
    }));
    wrap.appendChild(P.propertyGrid([
      { label: 'Evidence items', value: String(model.evidenceProgress.total) },
      { label: 'Requirements out of scope', value: String(model.requirementCompletion.notApplicable) },
      { label: 'Workpapers', value: String(model.testingCompletion.total) },
      { label: 'Testing out of scope', value: String(model.testingCompletion.notApplicable) }
    ], { columns: 2 }));
    return wrap;
  }

  /** Builds the Findings summary body: live counts, or the Empty State when none are recorded. */
  function buildFindingsBody(findingsSummary) {
    var P = presentation();
    if (findingsSummary.total === 0) {
      return P.emptyState({
        icon: '◇', title: 'No findings recorded',
        description: 'Findings raised on this client’s active engagements appear here.'
      });
    }
    var wrap = el('div', 'aos-surface aos-surface--padded aos-client__findings');
    wrap.appendChild(P.propertyGrid([
      { label: 'Findings recorded', value: String(findingsSummary.total) },
      { label: 'Open', value: String(findingsSummary.open) }
    ], { columns: 2 }));
    return wrap;
  }

  /** Builds the Documentation & report readiness body: one row per engagement report document. */
  function buildReadinessBody(readiness) {
    var P = presentation();
    if (asArray(readiness).length === 0) {
      return P.emptyState({
        icon: '◇', title: 'No report documents yet',
        description: 'Each active engagement’s continuously assembled report appears here with its live status.'
      });
    }
    var items = readiness.map(function (entry) {
      return {
        title: entry.engagementName,
        description: entry.title,
        meta: entry.status + (entry.version ? ' · v' + entry.version : '') +
          ' · ' + entry.includedSections + ' of ' + entry.totalSections + ' sections',
        tone: TONES.INFO
      };
    });
    return P.itemList(items, { compact: true });
  }

  /** Builds the Team workload body: client teams ranked by open evidence requests. */
  function buildWorkloadBody(teamWorkload) {
    var P = presentation();
    if (asArray(teamWorkload).length === 0) {
      return P.emptyState({
        icon: '◇', title: 'No open team assignments',
        description: 'Client teams appear here ranked by the evidence requests still open with them.'
      });
    }
    var items = teamWorkload.slice(0, LIST_LIMIT).map(function (team) {
      return {
        title: team.name,
        meta: team.openRequests + ' open ' + plural(team.openRequests, 'request'),
        tone: TONES.WARNING
      };
    });
    return P.itemList(items, { compact: true });
  }

  /** Builds the Approval summary body: pending decision counts plus navigation to the Global Approvals inbox. */
  function buildApprovalsBody(approvalSummary) {
    var P = presentation();
    var wrap = el('div', 'aos-surface aos-surface--padded aos-client__approvals');
    wrap.appendChild(P.propertyGrid([
      { label: 'Pending approvals', value: String(approvalSummary.total) },
      { label: 'Evidence awaiting decision', value: String(approvalSummary.evidencePending) },
      { label: 'Requests awaiting decision', value: String(approvalSummary.requestsPending) }
    ], { columns: 2 }));
    wrap.appendChild(P.button({ label: 'Open Global Approvals', href: '#/approvals', variant: 'subtle' }));
    return wrap;
  }

  /** Builds the Metadata body: the shared Metadata List of presentation fields. */
  function buildMetadataBody(metadata) {
    var pairs = [
      { term: 'Created', detail: metadata.created },
      { term: 'Last updated', detail: metadata.updated },
      { term: 'Version', detail: metadata.version },
      { term: 'Owner', detail: metadata.owner },
      { term: 'Tags', detail: asArray(metadata.tags).join(' · ') }
    ];
    return WS.metadataBody(pairs);
  }

  /** Builds the Activity Feed for the activity supporting panel (§7). */
  function buildActivityBody(activity) {
    return WS.buildActivityBody(activity, {
      icon: '◇', title: 'No recent activity',
      description: 'Remarks recorded across this client’s active engagements appear here as work progresses.'
    });
  }

  /** Builds the Related information panel body: related client-scoped objects with navigation. */
  function buildRelatedBody(relationships) {
    return WS.buildRelatedBody(relationships, {
      icon: '◇', title: 'No related objects', description: 'Related client objects appear here once the client has data.'
    });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    return WS.buildFooterItems('aos-client', entries);
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /** The ordered Client Dashboard sections, matching the issue's §2 display list end to end. */
  function primarySections(viewModel, workspaceRegistry) {
    return [
      {
        id: 'overview', kicker: 'Portfolio status', title: 'Portfolio overview',
        present: true, body: function () { return buildOverviewBody(viewModel); }
      },
      {
        id: 'engagements', kicker: 'Operational', title: 'Active engagements',
        description: 'Each engagement opens its own operational workspace.',
        present: viewModel.counts.operational.length > 0,
        body: function () { return buildEngagementCards(viewModel.counts.operational, workspaceRegistry, false); },
        empty: { icon: '◇', title: 'No active engagements', description: 'Engagements in progress for this client appear here.' }
      },
      {
        id: 'completed', kicker: 'Reference', title: 'Completed engagements',
        description: 'Completed engagements stay visible read-only and contribute to no operational metric.',
        present: viewModel.counts.completed.length > 0,
        body: function () { return buildEngagementCards(viewModel.counts.completed, workspaceRegistry, true); },
        empty: { icon: '◇', title: 'No completed engagements', description: 'Released engagements remain here for reference, read-only.' }
      },
      {
        id: 'milestones', kicker: 'Schedule', title: 'Upcoming milestones',
        present: viewModel.milestones.length > 0,
        body: function () { return buildMilestonesBody(viewModel.milestones); },
        empty: { icon: '◇', title: 'No upcoming milestones', description: 'Dated engagement milestones on or after the dataset date appear here.' }
      },
      {
        id: 'progress', kicker: 'Delivery', title: 'Evidence, requirements & testing',
        description: 'Completion derived live from the underlying records of the active engagements.',
        present: viewModel.evidenceProgress.total > 0 || viewModel.testingCompletion.total > 0,
        body: function () { return buildProgressBody(viewModel); },
        empty: { icon: '◇', title: 'No delivery records yet', description: 'Evidence, requirement, and testing progress appears here once the active engagements hold records.' }
      },
      {
        id: 'findings', kicker: 'Observations', title: 'Findings summary',
        present: true, body: function () { return buildFindingsBody(viewModel.findingsSummary); }
      },
      {
        id: 'readiness', kicker: 'Reporting', title: 'Documentation & report readiness',
        present: true, body: function () { return buildReadinessBody(viewModel.readiness); }
      },
      {
        id: 'workload', kicker: 'People', title: 'Team workload',
        present: true, body: function () { return buildWorkloadBody(viewModel.teamWorkload); }
      },
      {
        id: 'approvals', kicker: 'Decisions', title: 'Approval summary',
        present: true, body: function () { return buildApprovalsBody(viewModel.approvalSummary); }
      },
      {
        id: 'metadata', kicker: 'Record', title: 'Metadata',
        present: true, body: function () { return buildMetadataBody(viewModel.metadata); }
      }
    ];
  }

  /** Renders the ready Client Dashboard experience into the framework slots. */
  function renderReady(view, viewModel, workspaceRegistry) {
    var P = presentation();

    AuditOS.workspaceFramework.configure(view, {
      header: viewModel.header,
      contextSummary: viewModel.ribbon,
      toolbar: viewModel.toolbar,
      filterBar: viewModel.filterBar
    });

    var canvas = el('div', 'aos-client');
    canvas.setAttribute('data-canvas', 'flush');
    var rendered = 0;
    primarySections(viewModel, workspaceRegistry).forEach(function (section) {
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
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'detail', label: 'Loading client' })]);
    fillSlot(view, SLOTS.RELATED, [P.loadingState({ variant: 'list', label: 'Loading related information' })]);
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
        '. Regenerate the demo-data bundle and reload to restore the Client Dashboard.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders the Client Dashboard when it is the active workspace: the ready
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
    renderReady(view, viewModel, registry);
  }

  AuditOS.clientDashboardWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      statusTone: statusTone,
      companyStatusTone: companyStatusTone,
      resolveTargetCompany: resolveTargetCompany,
      splitEngagements: splitEngagements,
      deriveUpcomingMilestones: deriveUpcomingMilestones,
      deriveEvidenceProgress: deriveEvidenceProgress,
      deriveRequirementCompletion: deriveRequirementCompletion,
      deriveTestingCompletion: deriveTestingCompletion,
      deriveFindingsSummary: deriveFindingsSummary,
      deriveReadiness: deriveReadiness,
      deriveTeamWorkload: deriveTeamWorkload,
      deriveApprovalSummary: deriveApprovalSummary,
      derivePortfolioHealth: derivePortfolioHealth,
      deriveRelationships: deriveRelationships,
      deriveActivity: deriveActivity,
      deriveMetadata: deriveMetadata
    },

    collectViewModel: collectViewModel,

    /**
     * Binds the Client Dashboard to the router and the Shared Audit State.
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
      // The New engagement entry point is capability-gated; the dashboard
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
