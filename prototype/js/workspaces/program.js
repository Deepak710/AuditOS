/**
 * AuditOS Audit Program Workspace
 * Workspaces and Navigation — Chapter 12 / Workspace Architecture — Chapter 61 /
 * Component Architecture — Chapter 74
 *
 * Exposes the audit program the production dataset already models (GitHub
 * Issue #32): one program spanning several concurrent engagements that share
 * requirements, controls, and evidence. It answers "what does this program
 * look like end to end, and where is evidence being reused instead of
 * recollected?" Release 1 remains read-only: no AI, no workflow engine, no
 * writes, no schema changes, and no redesign of the workspace shell.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to every
 * other operational workspace. `collectViewModel` is the single place this
 * workspace reads `AuditOS.state`; it returns a declarative model of pure,
 * offline-testable derivations. The renderer configures the Shared Workspace
 * Framework's inherited skeleton (`AuditOS.workspaceFramework.configure`) and
 * fills its slots with compositions from the Enterprise Data Presentation
 * System (`AuditOS.presentation`) — no bespoke primitives, no duplicated
 * components (Component Design Patterns §81.4 — Composition Over
 * Duplication). It reuses the Workspace Shared Platform (Issue #27), the
 * Cross-Workspace Relationship Engine (Issue #30), and Cross-Workspace Record
 * Navigation (Issue #31) rather than reimplementing any of their logic.
 *
 * Data model (read, never invented): `programs.json` declares one program's
 * member engagements (`engagementIds`) and any engagements whose methodology
 * it reuses without joining as a member (`reuseSourceEngagementIds`). Each
 * `evidence` / `evidence-requirements` / `evidence-requests` manifest carries
 * one additional program-scoped dataset alongside its per-engagement ones —
 * the canonical cross-engagement pool — identified by carrying
 * `metadata.programId` and no `metadata.engagementId` (`readProgramDocument`
 * below; `WS.readEngagementDocument` cannot resolve it, since it filters on
 * the opposite key). Every evidence record in that pool already carries the
 * engagements that reference it (`engagementIds`) and an optional reuse
 * pointer (`reuse.sourceEngagementId`); "reused" is derived live from
 * `engagementIds.length > 1` and never trusted from a stored summary count —
 * the same field also carries records that are merely reuse-*eligible*
 * (`reuse.eligible`), which is a different fact this workspace never
 * conflates with genuine reuse. Where the dataset records no originating
 * engagement (every sampled record today), the workspace renders an honest
 * "Not recorded" placeholder rather than inferring one from `engagementIds`.
 *
 * "Shared controls" reads the shared `control-library` collection instead —
 * controls have no program-scoped manifest entry, and library control ids
 * (`LIB-...`) do not join any single engagement's own control ids
 * (`CTL-{engagement}-...`), so shared control rows render without a
 * per-record "Open" link (never a fabricated link); a plain workspace-level
 * link is offered instead. Evidence and requirement ids, by contrast, are the
 * same identifiers in the pool and in each engagement's own dataset, so their
 * rows keep real per-record links via `WS.buildRecordHref`.
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

  /** Engagement lifecycle status → tone. */
  var STATUS_TONES = {
    'In Progress': TONES.INFO, 'Completed': TONES.SUCCESS, 'Planning': TONES.INFO,
    'Planned': TONES.INFO, 'On Hold': TONES.WARNING
  };

  /**
   * Evidence/requirement lifecycle vocabulary — the canonical Evidence
   * Lifecycle (Issue #39), so the same statuses read with the same tone
   * wherever they appear. Tones resolve through the shared lifecycle
   * service; the local map only covers request statuses outside it.
   */
  var REVIEW_TONES = {
    'Received': TONES.SUCCESS, 'Accepted': TONES.SUCCESS, 'Closed': TONES.SUCCESS,
    'Partially Received': TONES.WARNING, 'Population Pending': TONES.WARNING,
    'Clarification Needed': TONES.WARNING, 'Revision Requested': TONES.WARNING,
    'Rejected': TONES.ERROR,
    'Requested': TONES.INFO, 'Requested by Consulting': TONES.INFO,
    'Under Review': TONES.INFO, 'Reused': TONES.INFO, 'Cross Engagement': TONES.INFO,
    'Not Applicable': null, 'Duplicate': null, 'Archived': null
  };

  /** The single status this dataset's requests/requirements treat as fully satisfied. */
  var COMPLETE_STATUS = 'Received';

  /** The status that means the requirement/request is out of scope, not outstanding. */
  var NOT_APPLICABLE_STATUS = 'Not Applicable';

  /** Maximum entries per supporting list so sections stay scannable. */
  var LIST_LIMIT = WS.LIST_LIMIT;

  /** Larger cap for the evidence-reuse rail, which is the working surface of this workspace. */
  var QUEUE_LIMIT = 50;

  /** Maximum audit-timeline events shown across every participating engagement. */
  var TIMELINE_LIMIT = 20;

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

  /** Resolves an engagement lifecycle status to a presentation tone. */
  function statusTone(status) {
    return STATUS_TONES[status] || null;
  }

  /** Resolves an evidence/requirement review status to a presentation tone. */
  function resolveReviewTone(status) {
    return Object.prototype.hasOwnProperty.call(REVIEW_TONES, status) ? REVIEW_TONES[status] : TONES.INFO;
  }

  /**
   * The current program: the first registered program, or null when none
   * exist. Kept generic (not hardcoded to one program id) so a second program
   * in a future dataset is picked up automatically rather than silently
   * ignored.
   */
  function deriveCurrentProgram(programs) {
    return Array.isArray(programs) && programs.length > 0 ? programs[0] : null;
  }

  /**
   * Resolves a list of engagement ids against the full engagement index,
   * dropping any id that does not join a real record — never a fabricated
   * engagement.
   */
  function resolveEngagementRefs(ids, engagementsById) {
    var map = engagementsById || {};
    return asArray(ids).map(function (id) { return map[id]; }).filter(Boolean);
  }

  /** Active / completed / other counts across a program's member engagements. */
  function deriveEngagementStatusCounts(memberEngagements) {
    var active = 0, completed = 0, other = 0;
    asArray(memberEngagements).forEach(function (engagement) {
      if (engagement.status === ENGAGEMENT_STATUS.COMPLETED) {
        completed += 1;
      } else if (engagement.status === ENGAGEMENT_STATUS.IN_PROGRESS) {
        active += 1;
      } else {
        other += 1;
      }
    });
    return { active: active, completed: completed, other: other, total: asArray(memberEngagements).length };
  }

  /**
   * Shared controls: the library controls at least one program engagement
   * references, annotated with whether more than one program engagement
   * shares them (derived live from `engagementIds`, never a stored count).
   */
  function deriveSharedControls(controlLibrary, programEngagementIds) {
    var idSet = {};
    asArray(programEngagementIds).forEach(function (id) { idSet[id] = true; });
    var inProgram = asArray(controlLibrary).filter(function (control) {
      return asArray(control.engagementIds).some(function (id) { return idSet[id]; });
    });
    var shared = inProgram.filter(function (control) { return asArray(control.engagementIds).length > 1; });
    return { total: inProgram.length, shared: shared.length, items: inProgram };
  }

  /** The distinct engagement ids a program requirement's control links declare. */
  function requirementEngagementIds(requirement) {
    var seen = {};
    var ids = [];
    asArray(requirement.controlLinks).forEach(function (link) {
      if (link && link.engagementId && !seen[link.engagementId]) {
        seen[link.engagementId] = true;
        ids.push(link.engagementId);
      }
    });
    return ids;
  }

  /**
   * Shared requirements: every program requirement annotated with the
   * engagements its control links declare, and whether more than one
   * engagement shares it — derived live, never a stored `multiControl` count.
   */
  function deriveSharedRequirements(requirementRecords) {
    var entries = asArray(requirementRecords).map(function (requirement) {
      var engagementIds = requirementEngagementIds(requirement);
      return { requirement: requirement, engagementIds: engagementIds, shared: engagementIds.length > 1 };
    });
    var shared = entries.filter(function (entry) { return entry.shared; });
    return { total: entries.length, shared: shared.length, entries: entries };
  }

  /**
   * The team that owns a program evidence item, resolved through the
   * requirement it satisfies (`requirementIds[0]` → `teamId` → team name).
   * Evidence records carry no team of their own in this dataset; an id that
   * does not join yields an empty string, never a fabricated team.
   */
  function resolveOwningTeam(evidence, requirementsById, teamsById) {
    var requirementId = asArray(evidence.requirementIds)[0];
    var requirement = requirementId ? requirementsById[requirementId] : null;
    var team = requirement && requirement.teamId ? teamsById[requirement.teamId] : null;
    return team ? team.name : '';
  }

  /**
   * Evidence reuse (§ Evidence Reuse): every program evidence item annotated
   * with its live reuse count (`engagementIds.length`, not the stored
   * `multiEngagement` summary), the engagements that reference it, its
   * recorded originating engagement where the dataset actually declares one,
   * and its owning team. `reused` — genuinely shared, not merely
   * reuse-eligible — is `engagementIds.length > 1`; `reuse.eligible` is a
   * distinct field this derivation never conflates with it.
   */
  function deriveEvidenceReuse(evidenceRecords, engagementsById, requirementsById, teamsById) {
    var entries = asArray(evidenceRecords).map(function (evidence) {
      var engagementIds = asArray(evidence.engagementIds);
      var reuse = evidence.reuse || {};
      return {
        evidence: evidence,
        reuseCount: engagementIds.length,
        reused: engagementIds.length > 1,
        reusedByEngagements: resolveEngagementRefs(engagementIds, engagementsById),
        originatingEngagement: reuse.sourceEngagementId ? (engagementsById[reuse.sourceEngagementId] || null) : null,
        owningTeam: resolveOwningTeam(evidence, requirementsById, teamsById)
      };
    });
    var reusedEntries = entries.filter(function (entry) { return entry.reused; })
      .sort(function (a, b) { return b.reuseCount - a.reuseCount; });
    return { total: entries.length, reusedCount: reusedEntries.length, entries: entries, reusedEntries: reusedEntries };
  }

  /**
   * Coverage summary: program evidence requests classified by their real,
   * recorded status — complete, not applicable (out of scope, not
   * outstanding), or pending — with a completion percentage computed live
   * from those counts, never the dataset's stored `completionPct`.
   */
  function deriveCoverageSummary(requestRecords) {
    var total = asArray(requestRecords).length;
    var complete = 0, notApplicable = 0;
    asArray(requestRecords).forEach(function (request) {
      if (request.status === COMPLETE_STATUS) {
        complete += 1;
      } else if (request.status === NOT_APPLICABLE_STATUS) {
        notApplicable += 1;
      }
    });
    var pending = total - complete - notApplicable;
    return {
      total: total, complete: complete, notApplicable: notApplicable, pending: pending,
      completionPct: total > 0 ? Math.round((complete / total) * 100) : 0
    };
  }

  /** Sums a numeric field of a per-engagement operational summary group across every member engagement. */
  function sumOperationalField(memberOperational, group, field) {
    return asArray(memberOperational).reduce(function (total, entry) {
      var value = entry[group] && entry[group][field];
      return total + (typeof value === 'number' ? value : 0);
    }, 0);
  }

  /**
   * Program Health (§ Program Health): six navigable operational indicators
   * aggregated live from real figures — engagement lifecycle counts, the
   * shared/reused evidence split, outstanding requests, and pending testing
   * / open findings summed across every member engagement's own operational
   * summary (the same summaries `WS.readEngagementDocument` already exposes
   * to the Engagement workspace; this derivation only sums them across
   * engagements, never re-deriving how a single engagement's own summary is
   * computed). No value is a stored program-level aggregate.
   */
  function deriveProgramHealth(engagementCounts, evidenceReuse, coverage, memberOperational, workspaceRegistry) {
    if (!workspaceRegistry) {
      return [];
    }
    var ids = workspaceRegistry.IDS;
    function pathFor(id) {
      var workspace = workspaceRegistry.findById(id);
      return workspace ? workspace.path : null;
    }
    var pendingTesting = sumOperationalField(memberOperational, 'testing', 'pending');
    var openFindings = sumOperationalField(memberOperational, 'findings', 'open');

    return [
      {
        key: 'engagements', label: 'Engagements',
        status: engagementCounts.active + ' active · ' + engagementCounts.completed + ' completed',
        tone: engagementCounts.active > 0 ? TONES.INFO : null, path: pathFor(ids.ENGAGEMENT)
      },
      {
        key: 'shared-evidence', label: 'Shared evidence',
        status: String(evidenceReuse.total), tone: null, path: pathFor(ids.EVIDENCE)
      },
      {
        key: 'reused-evidence', label: 'Reused evidence',
        status: String(evidenceReuse.reusedCount),
        tone: evidenceReuse.reusedCount > 0 ? TONES.SUCCESS : null, path: pathFor(ids.EVIDENCE)
      },
      {
        key: 'requests', label: 'Pending requests',
        status: String(coverage.pending), tone: coverage.pending > 0 ? TONES.WARNING : TONES.SUCCESS,
        path: pathFor(ids.EVIDENCE)
      },
      {
        key: 'testing', label: 'Pending testing',
        status: String(pendingTesting), tone: pendingTesting > 0 ? TONES.WARNING : TONES.SUCCESS,
        path: pathFor(ids.TESTING)
      },
      {
        key: 'findings', label: 'Open findings',
        status: String(openFindings), tone: openFindings > 0 ? TONES.ERROR : TONES.SUCCESS,
        path: pathFor(ids.FINDINGS)
      }
    ];
  }

  /**
   * The audit timeline across every participating engagement, plus any
   * reuse-source engagement (labeled so it reads distinctly, since it is not
   * a program member): each engagement's audit-period bounds and report
   * release date, chronological, capped so the timeline stays scannable.
   */
  function deriveAuditTimeline(memberEngagements, reuseSourceEngagements) {
    var events = [];
    function pushPeriodEvents(engagement, labelPrefix) {
      if (!engagement) {
        return;
      }
      var name = labelPrefix + (engagement.name || engagement.id);
      if (engagement.auditPeriod) {
        events.push({ date: engagement.auditPeriod.startDate, title: name + ' — audit period begins' });
        events.push({ date: engagement.auditPeriod.endDate, title: name + ' — audit period ends' });
      }
      if (engagement.reportReleaseDate) {
        events.push({ date: engagement.reportReleaseDate, title: name + ' — report release' });
      }
    }
    asArray(memberEngagements).forEach(function (engagement) { pushPeriodEvents(engagement, ''); });
    asArray(reuseSourceEngagements).forEach(function (engagement) { pushPeriodEvents(engagement, 'Reuse source · '); });

    return events
      .filter(function (event) { return Boolean(event.date); })
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })
      .slice(0, TIMELINE_LIMIT)
      .map(function (event) { return { timestamp: formatDate(event.date), title: event.title }; });
  }

  /** Related objects (§12.13): the program-scoped domains as count-annotated links, each into its workspace. */
  function deriveRelationships(workspaceRegistry, counts) {
    if (!workspaceRegistry) {
      return [];
    }
    var ids = workspaceRegistry.IDS;
    var related = [
      { id: ids.CONTROLS, title: 'Controls', meta: String(counts.controls), present: counts.controls > 0 },
      { id: ids.EVIDENCE, title: 'Evidence', meta: String(counts.evidence), present: counts.evidence > 0 },
      { id: ids.TESTING, title: 'Testing', meta: String(counts.testing), present: counts.testing > 0 },
      { id: ids.FINDINGS, title: 'Findings', meta: String(counts.findings), present: counts.findings > 0 }
    ];
    return WS.resolveRelationships(workspaceRegistry, related);
  }

  /**
   * Program activity: each member engagement's own remark activity (Issue
   * #30's `deriveRemarkActivity`, not reimplemented), tagged with the
   * engagement it belongs to, merged newest first across the whole program.
   */
  function deriveActivity(memberOperational, actorNames) {
    var events = [];
    asArray(memberOperational).forEach(function (entry) {
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

  /** Program metadata (§8): created / updated / version / owner / tags, derived from the program, its company, and the programs document metadata. */
  function deriveMetadata(program, company, programsMetadata, engagementCount) {
    var meta = programsMetadata || {};
    var tags = [];
    if (program.sharedRequirementList) {
      tags.push('Shared requirement list');
    }
    tags.push(engagementCount + ' engagements');
    return {
      created: company && company.createdAt ? formatDate(company.createdAt) : '',
      updated: meta.generatedAt ? formatDate(String(meta.generatedAt).slice(0, 10)) : '',
      version: meta.version || '',
      owner: company ? company.name : (program.companyId || ''),
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
   * Reads the program-scoped dataset of an engagement-scoped collection: the
   * one dataset whose document metadata declares `programId` and carries no
   * `engagementId` (`WS.readEngagementDocument` filters on the opposite key,
   * so it cannot resolve this document). Generic across every registered
   * dataset of the collection — no dataset key is hardcoded — so a second
   * program's own pool dataset resolves the same way. Returns null when the
   * collection carries no program-scoped dataset.
   */
  function readProgramDocument(state, collectionId, programId) {
    var datasetIds = state.getDatasetIds(collectionId);
    for (var index = 0; index < datasetIds.length; index += 1) {
      var document = state.getDocument(collectionId, datasetIds[index]);
      if (document && document.metadata && document.metadata.programId === programId && !document.metadata.engagementId) {
        return document;
      }
    }
    return null;
  }

  /**
   * Collects everything the Audit Program Workspace presents from the Shared
   * Audit State. Returns null while the state is not ready, and a degraded
   * model when no program exists (§15.12).
   */
  function collectViewModel(state, workspaceRegistry) {
    if (!state || !state.isReady()) {
      return null;
    }

    var status = state.getStatus();
    var programsDocument = state.getDocument('programs') || {};
    var programs = state.listRecords('programs');
    var program = deriveCurrentProgram(programs);
    if (!program) {
      return { degraded: true, status: status };
    }

    var companies = state.listRecords('companies');
    var company = findById(companies, program.companyId);

    var engagements = state.listRecords('engagements');
    var engagementsById = indexById(engagements);
    var memberEngagements = resolveEngagementRefs(program.engagementIds, engagementsById);
    var reuseSourceEngagements = resolveEngagementRefs(program.reuseSourceEngagementIds, engagementsById);
    var engagementCounts = deriveEngagementStatusCounts(memberEngagements);

    var evidencePoolDocument = readProgramDocument(state, 'evidence', program.id) || {};
    var requirementsPoolDocument = readProgramDocument(state, 'evidence-requirements', program.id) || {};
    var requestsPoolDocument = readProgramDocument(state, 'evidence-requests', program.id) || {};
    var evidenceRecords = evidencePoolDocument.evidence || [];
    var requirementRecords = requirementsPoolDocument.requirements || [];
    var requestRecords = requestsPoolDocument.requests || [];
    var requirementsById = indexById(requirementRecords);

    var controlLibrary = state.listRecords('control-library');
    var teamsById = indexById(state.listRecords('teams'));
    var programEngagementIds = memberEngagements.map(function (engagement) { return engagement.id; });

    var sharedControls = deriveSharedControls(controlLibrary, programEngagementIds);
    var sharedRequirements = deriveSharedRequirements(requirementRecords);
    var evidenceReuse = deriveEvidenceReuse(evidenceRecords, engagementsById, requirementsById, teamsById);
    var coverage = deriveCoverageSummary(requestRecords);

    // Per-member-engagement operational documents — the same
    // `WS.readEngagementDocument` reads the Engagement workspace already
    // performs for one engagement, looped across every program member so
    // Program Health sums real per-engagement summaries instead of
    // re-deriving them.
    var memberOperational = memberEngagements.map(function (engagement) {
      return {
        engagement: engagement,
        controls: (readEngagementDocument(state, 'controls', engagement.id) || {}).summary || {},
        evidence: (readEngagementDocument(state, 'evidence', engagement.id) || {}).summary || {},
        testing: (readEngagementDocument(state, 'testing', engagement.id) || {}).summary || {},
        findings: (readEngagementDocument(state, 'findings', engagement.id) || {}).summary || {},
        requests: (readEngagementDocument(state, 'evidence-requests', engagement.id) || {}).summary || {},
        activity: (readEngagementDocument(state, 'activity', engagement.id) || {}).events || []
      };
    });

    var pocs = state.listRecords('pocs');
    var users = state.listRecords('users');
    var actorNames = {};
    asArray(pocs).forEach(function (poc) { if (poc.id && poc.name) { actorNames[poc.id] = poc.name; } });
    asArray(users).forEach(function (user) { if (user.id && user.name) { actorNames[user.id] = user.name; } });

    var health = deriveProgramHealth(engagementCounts, evidenceReuse, coverage, memberOperational, workspaceRegistry);
    var timeline = deriveAuditTimeline(memberEngagements, reuseSourceEngagements);
    var relationships = deriveRelationships(workspaceRegistry, {
      requirements: sharedRequirements.total,
      controls: sharedControls.total,
      evidence: evidenceReuse.total,
      testing: sumOperationalField(memberOperational, 'testing', 'tests'),
      findings: sumOperationalField(memberOperational, 'findings', 'findings')
    });
    var activity = deriveActivity(memberOperational, actorNames);
    var metadata = deriveMetadata(program, company, programsDocument.metadata, memberEngagements.length);

    return {
      degraded: false,
      status: status,
      program: program,
      company: company,
      memberEngagements: memberEngagements,
      reuseSourceEngagements: reuseSourceEngagements,
      engagementCounts: engagementCounts,

      header: {
        eyebrow: 'Audit Program',
        title: program.name,
        meta: memberEngagements.length + ' participating engagements · ' + (company ? company.name : program.companyId),
        lastUpdated: metadata.updated ? 'Updated ' + metadata.updated : '',
        actions: [
          { label: 'Program evidence', href: '#/evidence', variant: 'subtle' }
        ]
      },

      ribbon: [
        { label: 'Client', value: company ? company.name : program.companyId },
        { label: 'Engagements', value: String(memberEngagements.length) },
        { label: 'Shared requirement list', value: program.sharedRequirementList ? 'Yes' : 'No' }
      ],

      toolbar: { search: { placeholder: 'Search this program' } },
      filterBar: {
        dropdowns: [{
          label: 'Engagement',
          options: ['All engagements'].concat(memberEngagements.map(function (engagement) { return engagement.name; }))
        }]
      },

      health: health,
      sharedControls: sharedControls,
      sharedRequirements: sharedRequirements,
      evidenceReuse: evidenceReuse,
      coverage: coverage,
      timeline: timeline,
      relationships: relationships,
      activity: activity,
      metadata: metadata,

      footer: [
        { label: 'Environment', value: 'Static prototype' },
        { label: 'Demo status', value: status.demoDataLoaded ? 'Demo data loaded' : 'Demo data degraded' }
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
    return WS.buildSection('aos-program', id, meta, bodyNode);
  }

  /** Builds the Program overview body: the Program Health strip over the program's identity properties. */
  function buildOverviewBody(model) {
    var P = presentation();
    var surface = el('div', 'aos-surface aos-surface--padded aos-program__overview');
    surface.appendChild(WS.buildHealthStrip('aos-program', 'Program health', model.health));
    surface.appendChild(P.propertyGrid([
      { label: 'Program', value: model.program.name },
      { label: 'Client', value: model.company ? model.company.name : model.program.companyId },
      { label: 'Participating engagements', value: String(model.memberEngagements.length) },
      { label: 'Reuse-source engagements', value: String(model.reuseSourceEngagements.length) },
      { label: 'Shared requirement list', value: model.program.sharedRequirementList ? 'Yes' : 'No' }
    ], { columns: 2 }));
    return surface;
  }

  /**
   * Builds the Participating engagements body: one Entity Card per program
   * member, linking into the Engagement workspace, plus a separately labeled
   * list of any reuse-source engagement — real engagements this program
   * reuses evidence from without counting as a member (never merged into the
   * member count).
   */
  function buildEngagementsBody(model, workspaceRegistry) {
    var P = presentation();
    var wrap = el('div', 'aos-program__engagements');

    var grid = el('div', 'aos-program__engagement-grid');
    model.memberEngagements.forEach(function (engagement) {
      grid.appendChild(P.entityCard({
        title: engagement.name,
        subtitle: engagement.engagementCode,
        href: WS.buildRecordHref(workspaceRegistry, workspaceRegistry.IDS.ENGAGEMENT, engagement.id),
        badge: { label: engagement.status, tone: statusTone(engagement.status) },
        facts: [
          { term: 'Framework', detail: engagement.framework || '' },
          { term: 'Audit period', detail: formatPeriod(engagement.auditPeriod) },
          { term: 'Auditor', detail: engagement.auditor || '' }
        ]
      }));
    });
    wrap.appendChild(grid);

    if (model.reuseSourceEngagements.length > 0) {
      var sourceWrap = el('div', 'aos-program__reuse-source');
      sourceWrap.appendChild(el('h3', 'aos-program__reuse-source-title', 'Reuse source (not a program member)'));
      var items = model.reuseSourceEngagements.map(function (engagement) {
        var href = WS.buildRecordHref(workspaceRegistry, workspaceRegistry.IDS.ENGAGEMENT, engagement.id);
        return {
          title: engagement.name, meta: engagement.status, tone: TONES.INFO,
          actions: href ? [{ label: 'Open', href: href }] : []
        };
      });
      sourceWrap.appendChild(P.itemList(items, { compact: true }));
      wrap.appendChild(sourceWrap);
    }
    return wrap;
  }

  /**
   * Builds the Shared controls body: live counts over a sample of the
   * library controls more than one program engagement references. Rows carry
   * no per-record link — a library control id does not join any single
   * engagement's own control ids in this dataset, and a link that cannot
   * resolve is never fabricated — so a plain workspace-level action is
   * offered instead.
   */
  function buildSharedControlsBody(sharedControls) {
    var P = presentation();
    var wrap = el('div', 'aos-surface aos-surface--padded aos-program__controls');
    wrap.appendChild(P.propertyGrid([
      { label: 'Program controls', value: String(sharedControls.total) },
      { label: 'Shared across engagements', value: String(sharedControls.shared) }
    ], { columns: 2 }));

    var sample = sharedControls.items
      .filter(function (control) { return asArray(control.engagementIds).length > 1; })
      .slice(0, LIST_LIMIT);
    var items = sample.map(function (control) {
      return {
        title: (control.controlCode ? control.controlCode + ' · ' : '') + (control.title || control.id),
        meta: asArray(control.engagementIds).length + ' engagements',
        tone: TONES.INFO
      };
    });
    wrap.appendChild(items.length > 0 ? P.itemList(items, { compact: true }) : P.emptyState({
      icon: '◇', title: 'No shared controls',
      description: 'Controls referenced by more than one program engagement will appear here.'
    }));
    wrap.appendChild(P.button({ label: 'Open Controls workspace', href: '#/controls', variant: 'subtle' }));
    return wrap;
  }

  /**
   * Builds the Shared requirements body: live counts over a sample of
   * requirements more than one engagement shares. Requirement knowledge
   * renders read-only here — Requirements ceased to exist as a user-facing
   * workspace (Issue #39), so shared entries carry no requirement URL.
   */
  function buildSharedRequirementsBody(sharedRequirements, workspaceRegistry) {
    var P = presentation();
    var wrap = el('div', 'aos-surface aos-surface--padded aos-program__requirements');
    wrap.appendChild(P.propertyGrid([
      { label: 'Program requirements', value: String(sharedRequirements.total) },
      { label: 'Shared across engagements', value: String(sharedRequirements.shared) }
    ], { columns: 2 }));

    var sample = sharedRequirements.entries.filter(function (entry) { return entry.shared; }).slice(0, LIST_LIMIT);
    var items = sample.map(function (entry) {
      return {
        title: entry.requirement.title || entry.requirement.id,
        meta: entry.engagementIds.length + ' engagements',
        tone: TONES.INFO
      };
    });
    wrap.appendChild(items.length > 0 ? P.itemList(items, { compact: true }) : P.emptyState({
      icon: '◇', title: 'No shared requirements',
      description: 'Requirements linked to more than one engagement will appear here.'
    }));
    return wrap;
  }

  /** Builds one row of the Evidence reuse rail: title, review status, and the live reuse count. */
  function buildReuseRow(entry) {
    var P = presentation();
    var node = el('button', null);
    node.type = 'button';

    var head = el('div', 'aos-program__row-head');
    head.appendChild(el('span', 'aos-program__row-title', entry.evidence.title || entry.evidence.id));
    head.appendChild(P.statusBadge({ label: entry.reuseCount + ' engagements', tone: TONES.INFO }));
    node.appendChild(head);

    var meta = el('div', 'aos-program__row-meta');
    if (entry.evidence.reviewStatus) {
      meta.appendChild(el('span', null, entry.evidence.reviewStatus));
    }
    node.appendChild(meta);
    return node;
  }

  /**
   * Builds the Evidence Reuse Inspector for one evidence item (§ Evidence
   * Reuse): originating engagement, reused-by engagements, reuse count,
   * current lifecycle, last update, and owning team. The dataset records no
   * dated field on evidence items and no sampled record declares an
   * originating engagement, so both render an honest "Not recorded"
   * placeholder rather than an inferred value.
   */
  function buildReuseInspector(entry) {
    var evidence = entry.evidence || {};
    return {
      eyebrow: 'Reused evidence',
      title: evidence.title || evidence.id || '',
      subtitle: [evidence.reviewStatus, entry.reuseCount + ' engagements'].filter(Boolean).join(' · '),
      badges: [
        evidence.reviewStatus ? { label: evidence.reviewStatus, tone: resolveReviewTone(evidence.reviewStatus) } : null,
        { label: entry.reuseCount + ' engagements', tone: TONES.INFO }
      ].filter(Boolean),
      sections: [
        {
          title: 'Properties', kind: 'properties', columns: 2,
          rows: [
            { label: 'Originating engagement', value: entry.originatingEngagement ? entry.originatingEngagement.name : 'Not recorded' },
            { label: 'Reuse count', value: String(entry.reuseCount) },
            { label: 'Current lifecycle', value: evidence.reviewStatus || '' },
            { label: 'Last update', value: 'Not recorded' },
            { label: 'Owning team', value: entry.owningTeam || 'Not recorded' }
          ]
        },
        WS.listSection('Reused by', entry.reusedByEngagements.map(function (engagement) {
          return { title: engagement.name, tone: TONES.INFO };
        }), 'Not shared with another engagement')
      ]
    };
  }

  /**
   * Builds the Shared / reused evidence body: a live summary strip over a
   * Master–Detail rail of the evidence genuinely reused across more than one
   * engagement (capped so the rail stays workable), reusing the same rail
   * selection controller (`WS.mountRailGroups`) every rail-based workspace
   * already shares — no duplicated selection logic.
   */
  function buildEvidenceReuseBody(evidenceReuse, targetId) {
    var P = presentation();
    var wrap = el('div', 'aos-program__reuse');

    var summary = el('div', 'aos-surface aos-surface--padded aos-program__reuse-summary');
    summary.appendChild(P.propertyGrid([
      { label: 'Shared evidence pool', value: String(evidenceReuse.total) },
      { label: 'Reused across engagements', value: String(evidenceReuse.reusedCount) }
    ], { columns: 2 }));
    wrap.appendChild(summary);

    if (evidenceReuse.reusedEntries.length === 0) {
      wrap.appendChild(P.emptyState({
        icon: '◇', title: 'No cross-engagement reuse recorded',
        description: 'Evidence attached to more than one engagement will appear here.'
      }));
      return wrap;
    }

    var detailMount = el('div', 'aos-program__detail-mount');
    var listNode = el('div', 'aos-program__row-list');
    listNode.setAttribute('role', 'list');
    var rows = evidenceReuse.reusedEntries.slice(0, QUEUE_LIMIT);
    WS.mountRailGroups('aos-program', listNode, detailMount, [{ label: '', rows: rows }], {},
      buildReuseRow, buildReuseInspector, null, targetId);

    wrap.appendChild(P.masterDetail({
      list: listNode, detail: detailMount, ratio: 38,
      listLabel: 'Reused evidence', detailLabel: 'Evidence reuse inspector'
    }));
    return wrap;
  }

  /** Builds the Audit timeline body: the shared Timeline over dated engagement events, or the Empty State. */
  function buildTimelineBody(timeline) {
    var P = presentation();
    return asArray(timeline).length > 0 ? P.timeline(timeline) : P.emptyState({
      icon: '◇', title: 'No dated milestones',
      description: 'Audit period, fieldwork, and report-release dates appear here once engagements declare them.'
    });
  }

  /** Builds the Coverage summary body: live counts of program evidence requests by their real status. */
  function buildCoverageBody(coverage) {
    var P = presentation();
    var wrap = el('div', 'aos-surface aos-surface--padded aos-program__coverage');
    wrap.appendChild(P.propertyGrid([
      { label: 'Program requests', value: String(coverage.total) },
      { label: 'Complete', value: String(coverage.complete) },
      { label: 'Not applicable', value: String(coverage.notApplicable) },
      { label: 'Pending', value: String(coverage.pending) },
      { label: 'Completion', value: coverage.completionPct + '%' }
    ], { columns: 2 }));
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
      description: 'Remarks recorded across the program’s engagements appear here as work progresses.'
    });
  }

  /** Builds the Related information panel body: related program-scoped objects with navigation. */
  function buildRelatedBody(relationships) {
    return WS.buildRelatedBody(relationships, {
      icon: '◇', title: 'No related objects', description: 'Related program objects appear here once the program has data.'
    });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    return WS.buildFooterItems('aos-program', entries);
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /** The ordered Program sections, matching the issue's scope list end to end. */
  function primarySections(viewModel, workspaceRegistry, targetId) {
    return [
      {
        id: 'overview', kicker: 'Program status', title: 'Program overview',
        present: true, body: function () { return buildOverviewBody(viewModel); }
      },
      {
        id: 'engagements', kicker: 'Participating engagements', title: 'Engagements',
        description: 'Each engagement opens its own operational workspace.',
        present: viewModel.memberEngagements.length > 0,
        body: function () { return buildEngagementsBody(viewModel, workspaceRegistry); },
        empty: { icon: '◇', title: 'No participating engagements', description: 'Member engagements appear here once the program declares them.' }
      },
      {
        id: 'shared-controls', kicker: 'Shared across engagements', title: 'Shared controls',
        present: viewModel.sharedControls.total > 0,
        body: function () { return buildSharedControlsBody(viewModel.sharedControls); },
        empty: { icon: '◇', title: 'No program controls', description: 'Controls referenced by a program engagement appear here.' }
      },
      {
        id: 'shared-requirements', kicker: 'Shared across engagements', title: 'Shared requirements',
        present: viewModel.sharedRequirements.total > 0,
        body: function () { return buildSharedRequirementsBody(viewModel.sharedRequirements, workspaceRegistry); },
        empty: { icon: '◇', title: 'No program requirements', description: 'The program requirement list appears here once it has data.' }
      },
      {
        id: 'evidence-reuse', kicker: 'Cross-engagement reuse', title: 'Shared evidence',
        description: 'Evidence attached to more than one engagement is genuinely reused; select an item for its reuse detail.',
        present: viewModel.evidenceReuse.total > 0,
        body: function () { return buildEvidenceReuseBody(viewModel.evidenceReuse, targetId); },
        empty: { icon: '◇', title: 'No shared evidence pool', description: 'The program evidence pool appears here once it has data.' }
      },
      {
        id: 'timeline', kicker: 'Program schedule', title: 'Audit timeline',
        present: viewModel.timeline.length > 0,
        body: function () { return buildTimelineBody(viewModel.timeline); },
        empty: { icon: '◇', title: 'No dated milestones', description: 'Audit period and report-release dates appear here once engagements declare them.' }
      },
      {
        id: 'coverage', kicker: 'Requirement fulfilment', title: 'Coverage summary',
        present: viewModel.coverage.total > 0,
        body: function () { return buildCoverageBody(viewModel.coverage); },
        empty: { icon: '◇', title: 'No program requests', description: 'Evidence-request coverage appears here once the program has data.' }
      },
      {
        id: 'metadata', kicker: 'Record', title: 'Metadata',
        present: true, body: function () { return buildMetadataBody(viewModel.metadata); }
      }
    ];
  }

  /** Renders the ready Program experience into the framework slots. */
  function renderReady(view, viewModel, workspaceRegistry, targetId) {
    var P = presentation();

    AuditOS.workspaceFramework.configure(view, {
      header: viewModel.header,
      contextSummary: viewModel.ribbon,
      toolbar: viewModel.toolbar,
      filterBar: viewModel.filterBar
    });

    var canvas = el('div', 'aos-program');
    canvas.setAttribute('data-canvas', 'flush');
    var rendered = 0;
    primarySections(viewModel, workspaceRegistry, targetId).forEach(function (section) {
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
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'detail', label: 'Loading program' })]);
    fillSlot(view, SLOTS.RELATED, [P.loadingState({ variant: 'list', label: 'Loading related information' })]);
    fillSlot(view, SLOTS.AI, [P.loadingState({ variant: 'list', label: 'Loading AI advisory' })]);
    fillSlot(view, SLOTS.ACTIVITY, [P.loadingState({ variant: 'list', label: 'Loading activity' })]);
  }

  /** Renders the degraded state (§15.12 — Empty / Error). */
  function renderDegraded(view, viewModel) {
    var P = presentation();
    fillSlot(view, SLOTS.CONTENT, [P.emptyState({
      icon: '◇', title: 'No audit program available',
      description: 'The Shared Audit State holds no program to present' +
        (viewModel.status && viewModel.status.degradedReason ? ' (' + viewModel.status.degradedReason + ')' : '') +
        '. Regenerate the demo-data bundle and reload to restore the Audit Program Workspace.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders the Audit Program Workspace when it is the active workspace: the
   * ready experience once the state has loaded, the loading skeleton before
   * that, and the degraded explanation when no program is available.
   */
  function renderActiveProgram() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.PROGRAM) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.PROGRAM + '"]'
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
    var targetId = router.getCurrentRecordId ? router.getCurrentRecordId() : '';
    renderReady(view, viewModel, registry, targetId);
  }

  AuditOS.programWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      formatDate: formatDate,
      formatPeriod: formatPeriod,
      statusTone: statusTone,
      resolveReviewTone: resolveReviewTone,
      deriveCurrentProgram: deriveCurrentProgram,
      resolveEngagementRefs: resolveEngagementRefs,
      deriveEngagementStatusCounts: deriveEngagementStatusCounts,
      deriveSharedControls: deriveSharedControls,
      requirementEngagementIds: requirementEngagementIds,
      deriveSharedRequirements: deriveSharedRequirements,
      resolveOwningTeam: resolveOwningTeam,
      deriveEvidenceReuse: deriveEvidenceReuse,
      deriveCoverageSummary: deriveCoverageSummary,
      deriveProgramHealth: deriveProgramHealth,
      deriveAuditTimeline: deriveAuditTimeline,
      deriveRelationships: deriveRelationships,
      deriveActivity: deriveActivity,
      deriveMetadata: deriveMetadata
    },

    collectViewModel: collectViewModel,

    /**
     * Binds the Audit Program Workspace to the router and the Shared Audit
     * State. Safe to call once, after the DOM is ready, the router has
     * resolved the initial route, and the framework has rendered its
     * skeleton. Does nothing when the routing or state foundations are
     * absent, so the shell degrades rather than throwing.
     */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveProgram);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveProgram);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveProgram);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveProgram);
      }
      renderActiveProgram();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.programWorkspace.init);
    } else {
      AuditOS.programWorkspace.init();
    }
  }
})(window);
