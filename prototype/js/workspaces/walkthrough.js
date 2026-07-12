/**
 * AuditOS Walkthrough Workspace
 * Workspaces and Navigation — Chapter 12 / Workspace Architecture — Chapter 61 /
 * Audit Lifecycle — Chapter 11 / Component Architecture — Chapter 74
 *
 * The primary operational workspace where the audit team progressively learns
 * the client's environment (GitHub Issue #20), extended by the Engagement
 * Operating System Foundation (GitHub Issue #36) into the Team → POC
 * operating hierarchy: one continuously evolving Walkthrough Workspace per
 * Team, each Team owning multiple POCs, each POC owning multiple walkthrough
 * sessions. The top-level view is a roster of Teams and their operational
 * readiness; selecting a Team opens its command center (scheduling,
 * ingestion, dependencies, AI Suggestions, Industry Knowledge, dual
 * timezone); selecting a POC within it opens that POC's detail. Route depth
 * (Client → Engagement → Walkthrough → Team → POC) comes from
 * `AuditOS.repository.resolveHierarchy` (`js/platform/repository.js`); this
 * workspace only renders the view the resolved context names.
 *
 * Release 1 remains a faithful visualization of the demo JSON — no AI, no
 * transcript processing, no workflow engine — except that this issue adds
 * real, audited Repository writes for Scheduling, Ingestion, comments, and
 * the Suggestion Lifecycle (Architectural Principle: AI never writes
 * directly; AI only creates Suggestions; permissioned users Approve;
 * Repository Applies). Every write goes through `AuditOS.repository`
 * (never `AuditOS.state` directly) and records an immutable audit event,
 * identical semantics to every other Repository-backed workspace (Issue
 * #34). The legacy top-level `sessions` / `processes` / `questions` reads
 * stay exactly as they were; `teams` is the new, additive field this issue
 * introduces — the workspace reads its walkthrough data through the same
 * engagement-scoped document pattern as controls, evidence, testing, and
 * findings (`findDatasetsForEngagement` / `getDocument`).
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to the
 * Engagement workspace. `collectViewModel` is the single place this workspace
 * reads `AuditOS.state`. The renderer configures the Shared Workspace
 * Framework's inherited skeleton (`AuditOS.workspaceFramework.configure`) and
 * fills its slots with compositions from the Enterprise Data Presentation
 * System (`AuditOS.presentation`) — no bespoke primitives, no duplicated
 * components (Component Design Patterns §81.4 — Composition Over Duplication).
 *
 * The walkthrough document shape, read from the `walkthroughs`
 * engagement-scoped collection:
 *   { sessions: [ { id, title, owner, status, scheduledDate, completedDate,
 *       participants, summary, objective, agenda, notes, linkedProcesses,
 *       linkedRequirements, linkedEvidence, followUpItems, processId } ],
 *     processes: [ { id, name } ],
 *     questions: [ { id, title, kind, status } ],
 *     teams: [ { teamId, name, status, stage, mainPocId, escalationPocId,
 *       pocIds, role, department, timezone, reminderStatus, escalationStatus,
 *       nextSession: { date, time, timezone } | null, agenda,
 *       evidenceExpected, evidenceDemonstrated, dependencyIds, blockers,
 *       comments, ingestion: { notes, transcripts, evidenceUploads,
 *       recordingLinks, sharepointLinks, localFileRefs }, scheduling:
 *       { recurring, reminderCadence, escalationCadence, prepChecklist },
 *       sessions: [ { id, title, type, date, time, status, agenda,
 *       evidenceExpected, participants, notes, recordingLink,
 *       sharepointLink, localFileRef } ] } ] }
 * Nothing in this file hardcodes those values; every read defaults to an
 * empty array so an absent collection, or a team field the dataset omits,
 * renders exactly like an empty one.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Shared Workspace Platform (Issue #27) — harmonized helpers reused across every operational workspace. */
  var WS = AuditOS.workspaceShared || {};

  /** The Repository Foundation, resolved at call time so load order stays flexible (Issue #34). */
  function repositoryService() {
    return AuditOS.repository || null;
  }

  // ------------------------------------------------------------------
  // Constants
  // ------------------------------------------------------------------

  var SLOTS = {
    CONTENT: 'primary-content',
    RELATED: 'related-information',
    AI: 'ai-recommendations',
    ACTIVITY: 'activity',
    FOOTER: 'workspace-footer'
  };

  var TONES = WS.TONES;

  /** Team operational status vocabulary (Issue #36 §3/§4) and its tones. */
  var TEAM_STATUS_TONES = {
    'Complete': TONES.SUCCESS,
    'In Progress': TONES.INFO,
    'Scheduling': TONES.WARNING,
    'Blocked': TONES.ERROR,
    'Not Started': null
  };

  /** Suggestion lifecycle status → tone (Issue #36 §9), mirrors the Approval Workflow's vocabulary shape. */
  var SUGGESTION_TONES = {
    'Suggested': TONES.INFO,
    'Reviewed': TONES.INFO,
    'Approved': TONES.SUCCESS,
    'Applied': TONES.SUCCESS,
    'Rejected': TONES.ERROR,
    'Modified': TONES.WARNING
  };

  /**
   * Memory-only presentation state: the record ids named by the last
   * user-triggered write (scheduling, ingestion, a comment, a suggestion
   * decision), so the workspace stays on the same Team/POC after a
   * re-render instead of snapping back to the roster.
   */
  var presentationState = { lastTeamId: '', lastPocId: '' };

  /** Walkthrough session status vocabulary (read, never invented) and its tones. */
  var SESSION_STATUS = { COMPLETED: 'Completed', IN_PROGRESS: 'In Progress', SCHEDULED: 'Scheduled' };
  var SESSION_TONES = { 'Completed': TONES.SUCCESS, 'In Progress': TONES.INFO, 'Scheduled': null };

  /** Pending-question kind vocabulary → tone (unresolved question, evidence request, confirmation, walkthrough). */
  var QUESTION_TONES = {
    question: TONES.INFO, 'evidence-request': TONES.WARNING,
    confirmation: TONES.INFO, walkthrough: TONES.WARNING
  };

  /** Maximum entries per list so sections stay scannable. */
  var LIST_LIMIT = WS.LIST_LIMIT;

  /** Entrance stagger ceiling — sections beyond this share the last delay. */
  var STAGGER_LIMIT = WS.STAGGER_LIMIT;

  // ------------------------------------------------------------------
  // Pure derivation helpers — no DOM, no AuditOS.state access.
  // ------------------------------------------------------------------

  /** Returns the value when it is an array, otherwise an empty array. */
  var asArray = WS.asArray;

  /** Formats an ISO `YYYY-MM-DD` date as a compact, deterministic label. */
  var formatDate = WS.formatDate;

  /**
   * The frameworks attached to an engagement, always as an array (identical
   * seam to the Engagement workspace, Coding Standards §30.8 — Composition).
   */
  var normalizeFrameworks = WS.normalizeFrameworks;

  /** The current engagement: identical rule to Home and Engagement, so every surface agrees. */
  var deriveCurrentEngagement = WS.deriveCurrentEngagement;

  /** Resolves a session status to a presentation tone. */
  function resolveSessionTone(status) {
    return Object.prototype.hasOwnProperty.call(SESSION_TONES, status) ? SESSION_TONES[status] : TONES.INFO;
  }

  /**
   * Whether a session counts as complete: its own `status` when the record
   * declares one (richer future data), otherwise its mere presence in the
   * sessions array — production walkthrough sessions are logged Halcyon/client
   * remarks with no separate status field, so being recorded is completion.
   */
  function isSessionComplete(session) {
    var source = session || {};
    return source.status ? source.status === SESSION_STATUS.COMPLETED : true;
  }

  /** The session's completed, scheduled, or recorded date, whichever is present, formatted. */
  function formatSessionDate(session) {
    var source = session || {};
    return formatDate(source.date || source.completedDate || source.scheduledDate);
  }

  /** The session's most relevant date value for chronological sorting (unformatted). */
  function sessionSortDate(session) {
    var source = session || {};
    return source.date || source.completedDate || source.scheduledDate || '';
  }

  /**
   * The overall walkthrough status for the header and lifecycle: not started
   * with no sessions, in progress once some are recorded, complete once every
   * recorded session is complete. Never a fabricated count.
   */
  function deriveWalkthroughStatus(sessions) {
    var list = asArray(sessions);
    if (list.length === 0) {
      return { status: 'Not started', tone: null };
    }
    var completed = list.filter(isSessionComplete).length;
    if (completed === list.length) {
      return { status: 'Complete', tone: TONES.SUCCESS };
    }
    if (completed > 0) {
      return { status: 'In progress', tone: TONES.INFO };
    }
    return { status: 'Scheduled', tone: TONES.INFO };
  }

  /** The most recently dated session (completed, else scheduled), or null. */
  function deriveLastSession(sessions) {
    var list = asArray(sessions).filter(function (session) { return Boolean(sessionSortDate(session)); });
    if (list.length === 0) {
      return null;
    }
    var sorted = list.slice().sort(function (a, b) {
      return String(sessionSortDate(b)).localeCompare(String(sessionSortDate(a)));
    });
    return sorted[0];
  }

  /** The engagement's client-side participant names, read from the point-of-contact records. */
  function deriveTeamNames(pocs, companyId) {
    return asArray(pocs)
      .filter(function (poc) { return poc.companyId === companyId; })
      .map(function (poc) { return poc.name; })
      .filter(Boolean);
  }

  /** How many of the named team members appear as a participant in at least one session. */
  function countParticipatedTeamMembers(teamNames, sessions) {
    var participated = {};
    asArray(sessions).forEach(function (session) {
      asArray(session.participants).forEach(function (participant) {
        var name = typeof participant === 'string' ? participant : (participant && participant.name) || '';
        if (name) {
          participated[name] = true;
        }
      });
    });
    return asArray(teamNames).filter(function (name) { return participated[name]; }).length;
  }

  /**
   * The walkthrough-scoped Audit Health strip: sessions completed, sessions
   * pending, open questions, evidence dependencies (evidence linked from
   * sessions), and teams pending (client participants not yet walked through).
   * Every figure derives from real records; an empty collection reads "None"
   * or "Awaiting", never a fabricated number.
   */
  function deriveAuditHealth(sessions, questions, teamNames) {
    var sessionList = asArray(sessions);
    var completed = sessionList.filter(isSessionComplete).length;
    var pending = sessionList.length - completed;
    var openQuestions = asArray(questions).filter(function (question) { return question.status !== 'Resolved'; }).length;
    var evidenceLinks = sessionList.reduce(function (total, session) {
      return total + asArray(session.linkedEvidence).length;
    }, 0);
    var team = asArray(teamNames);
    // Only "not tracked" once sessions exist but none of them carry a
    // participants field — with no sessions at all, every team member is
    // genuinely still pending, which is a real (not fabricated) signal.
    var participantsTracked = sessionList.length === 0 ||
      sessionList.some(function (session) { return Boolean(session.participants); });
    var participated = countParticipatedTeamMembers(team, sessionList);
    var teamsPending = Math.max(0, team.length - participated);

    return [
      {
        key: 'sessions-completed', label: 'Sessions completed',
        status: sessionList.length > 0 ? completed + ' of ' + sessionList.length : 'None',
        tone: completed > 0 ? TONES.SUCCESS : null
      },
      {
        key: 'sessions-pending', label: 'Sessions pending',
        status: sessionList.length === 0 ? 'Awaiting' : (pending > 0 ? pending + ' Pending' : 'Complete'),
        tone: pending > 0 ? TONES.WARNING : (sessionList.length > 0 ? TONES.SUCCESS : null)
      },
      {
        key: 'questions', label: 'Open questions',
        status: openQuestions > 0 ? openQuestions + ' Open' : 'None',
        tone: openQuestions > 0 ? TONES.WARNING : null
      },
      {
        key: 'evidence', label: 'Evidence dependencies',
        status: evidenceLinks > 0 ? evidenceLinks + ' Linked' : 'None',
        tone: evidenceLinks > 0 ? TONES.INFO : null
      },
      {
        key: 'teams', label: 'Teams pending',
        status: team.length === 0 ? 'None' : (!participantsTracked ? 'Not tracked' : (teamsPending > 0 ? teamsPending + ' Pending' : 'Complete')),
        tone: !participantsTracked ? null : (teamsPending > 0 ? TONES.WARNING : (team.length > 0 ? TONES.SUCCESS : null))
      }
    ];
  }

  /**
   * Discovered business processes with the sessions that cover each one — the
   * Process Coverage section. A process with no covering session still
   * appears (discovered, not yet walked through); nothing is fabricated
   * beyond what the `processes` collection declares.
   */
  function deriveProcessCoverage(processes, sessions) {
    var sessionList = asArray(sessions);
    return asArray(processes).map(function (process) {
      var covering = sessionList.filter(function (session) {
        return session.processId === process.id ||
          asArray(session.linkedProcesses).indexOf(process.id) !== -1;
      });
      return {
        id: process.id,
        name: process.name || process.id,
        category: process.category || '',
        sessionCount: covering.length,
        status: covering.length > 0 ? 'Covered' : 'Not covered',
        tone: covering.length > 0 ? TONES.SUCCESS : null
      };
    });
  }

  /**
   * The audit chain the walkthrough ultimately feeds — Requirements → Controls
   * → Evidence → Testing → Findings → Report — each annotated with its real,
   * current count for the engagement. Release 1 visualizes only the domain
   * totals already present in the Shared Audit State; it does not fabricate a
   * specific session-to-requirement link, which does not exist yet.
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
    var findings = ops.findings || {};
    var report = ops.report || null;
    var ids = workspaceRegistry.IDS;

    var chain = [
      { id: ids.EVIDENCE, title: 'Requirements', meta: String(requirements.requirements || 0), present: (requirements.requirements || 0) > 0 },
      { id: ids.CONTROLS, title: 'Controls', meta: String(controls.controls || 0), present: (controls.controls || 0) > 0 },
      { id: ids.EVIDENCE, title: 'Evidence', meta: String(evidence.evidenceItems || 0), present: (evidence.evidenceItems || 0) > 0 },
      { id: ids.TESTING, title: 'Testing', meta: String(testing.tests || 0), present: (testing.tests || 0) > 0 },
      { id: ids.FINDINGS, title: 'Findings', meta: String(findings.findings || 0), present: (findings.findings || 0) > 0 },
      { id: ids.REPORTING, title: 'Report', meta: report ? String(report.status) : '—', present: Boolean(report) }
    ];
    return WS.resolveRelationships(workspaceRegistry, chain);
  }

  /** Walkthrough history for the Timeline section: session dates, chronological. */
  function deriveTimeline(sessions) {
    return asArray(sessions)
      .filter(function (session) { return Boolean(sessionSortDate(session)); })
      .slice()
      .sort(function (a, b) { return String(sessionSortDate(a)).localeCompare(String(sessionSortDate(b))); })
      .slice(0, LIST_LIMIT)
      .map(function (session) {
        var completedLabel = isSessionComplete(session) ? 'Completed' : 'Scheduled';
        return { timestamp: formatSessionDate(session), title: completedLabel + ': ' + (session.title || '') };
      });
  }

  /** Recent walkthrough activity for the Activity panel: completed sessions, newest first. */
  function deriveActivity(sessions) {
    return asArray(sessions)
      .filter(function (session) { return isSessionComplete(session) && sessionSortDate(session); })
      .slice()
      .sort(function (a, b) { return String(sessionSortDate(b)).localeCompare(String(sessionSortDate(a))); })
      .slice(0, LIST_LIMIT)
      .map(function (session) {
        return {
          title: 'Session completed: ' + (session.title || ''),
          meta: session.owner ? 'Led by ' + session.owner : (session.source || ''),
          timestamp: formatSessionDate(session),
          kind: 'review', value: 'Completed'
        };
      });
  }

  /** Normalizes a participant entry (string or `{ name }`) into a list item. */
  function toNameItem(participant) {
    var name = typeof participant === 'string' ? participant : (participant && participant.name) || '';
    return { title: name, tone: TONES.INFO };
  }

  /** Normalizes an agenda / follow-up entry (string or `{ title }`) into a list item. */
  function toTextItem(entry) {
    var title = typeof entry === 'string' ? entry : (entry && entry.title) || '';
    return { title: title, tone: TONES.INFO };
  }

  /** Normalizes a linked-object reference (string id or `{ title|id }`) into a list item. */
  function toRefItem(entry) {
    var title = typeof entry === 'string' ? entry : (entry && (entry.title || entry.id)) || '';
    return { title: title, tone: TONES.INFO };
  }

  /** One text-valued Inspector section rendered as a single placeholder-capable list row. */
  var textSection = WS.textSection;

  /** One list-valued Inspector section; an empty list renders one placeholder row. */
  var listSection = WS.listSection;

  /**
   * The full Walkthrough Detail for a session (§ Walkthrough Detail): objective,
   * participants, agenda, summary, notes, linked processes / requirements /
   * evidence, and follow-up items. Pure — returns plain Inspector Panel
   * configuration data, no DOM.
   */
  function deriveSessionDetail(session) {
    var source = session || {};
    // Only infer "Completed" from presence for a genuine session record (one
    // with an id); a session with no fields at all degrades to no badge.
    var statusLabel = source.status || (source.id && isSessionComplete(source) ? 'Completed' : '');
    return {
      eyebrow: source.owner || source.source || '',
      title: source.title || '',
      subtitle: [formatSessionDate(source), statusLabel].filter(Boolean).join(' · '),
      badges: statusLabel ? [{ label: statusLabel, tone: resolveSessionTone(source.status || statusLabel) }] : [],
      sections: [
        textSection('Objective', source.objective, 'No objective recorded for this session.'),
        listSection('Participants', asArray(source.participants).map(toNameItem), 'No participants recorded yet.'),
        listSection('Agenda', asArray(source.agenda).map(toTextItem), 'No agenda captured for this session.'),
        textSection('Summary', source.summary, 'No summary recorded yet.'),
        textSection('Notes', source.notes, 'No notes captured for this session.'),
        listSection('Linked processes', asArray(source.linkedProcesses).map(toRefItem), 'No linked processes yet.'),
        listSection('Linked requirements', asArray(source.linkedRequirements || source.requirementIds).map(toRefItem), 'No linked requirements yet.'),
        listSection('Linked evidence', asArray(source.linkedEvidence).map(toRefItem), 'No linked evidence yet.'),
        listSection('Follow-up items', asArray(source.followUpItems).map(toTextItem), 'No follow-up items recorded.')
      ]
    };
  }

  // ------------------------------------------------------------------
  // Team → POC derivations (Issue #36 §3/§4) — pure, no DOM, no state
  // access. Every field defaults to a real, empty value; nothing here
  // fabricates operational state the dataset does not declare.
  // ------------------------------------------------------------------

  /** Resolves a Team's operational status to a presentation tone. */
  function resolveTeamStatusTone(status) {
    return Object.prototype.hasOwnProperty.call(TEAM_STATUS_TONES, status) ? TEAM_STATUS_TONES[status] : null;
  }

  /** Resolves a Suggestion's lifecycle status to a presentation tone. */
  function resolveSuggestionTone(status) {
    return Object.prototype.hasOwnProperty.call(SUGGESTION_TONES, status) ? SUGGESTION_TONES[status] : TONES.INFO;
  }

  /** Finds a Team record by its `id`, or null. */
  function findTeamById(teams, teamId) {
    var list = asArray(teams);
    for (var index = 0; index < list.length; index += 1) {
      if (list[index].id === teamId) {
        return list[index];
      }
    }
    return null;
  }

  /** Resolves a Team's real POC roster against the shared `pocs` collection, in recorded order. */
  function resolveTeamPocs(team, pocsById) {
    var byId = pocsById || {};
    return asArray(team ? team.pocIds : []).map(function (id) { return byId[id]; }).filter(Boolean);
  }

  /** The next scheduled session label ("Jul 21, 2026 · 10:00"), or '' when none is scheduled. */
  function formatNextSessionLabel(nextSession) {
    if (!nextSession || !nextSession.date) {
      return '';
    }
    var parts = [formatDate(nextSession.date)];
    if (nextSession.time) {
      parts.push(nextSession.time);
    }
    return parts.join(' · ');
  }

  /**
   * The Team roster for the top-level Walkthrough view (§3 — "operational
   * readiness rather than historical meetings"): one entry per recorded
   * Team, its status, stage, main POC, and next scheduled session. `hrefOf`
   * builds the real hierarchical link into that Team (supplied by the
   * caller, which alone knows the client/engagement routing context).
   */
  function deriveTeamRoster(teams, pocsById, hrefOf) {
    return asArray(teams).map(function (team) {
      var mainPoc = team.mainPocId && pocsById ? pocsById[team.mainPocId] : null;
      return {
        teamId: team.id,
        name: team.name || team.id,
        status: team.status || 'Not Started',
        statusTone: resolveTeamStatusTone(team.status || 'Not Started'),
        stage: team.stage || 'Not Started',
        mainPocName: mainPoc ? mainPoc.name : '',
        pocCount: asArray(team.pocIds).length,
        nextSession: formatNextSessionLabel(team.nextSession),
        blockerCount: asArray(team.blockers).length,
        path: hrefOf ? hrefOf(team.id, null) : null
      };
    });
  }

  /**
   * The Audit Health-style roster summary (§1 — Team Status / Active &
   * Upcoming Walkthroughs seam every executive surface reuses): counts of
   * Teams by operational status, real and never fabricated.
   */
  function deriveTeamRosterSummary(teams) {
    var list = asArray(teams);
    var counts = { total: list.length, active: 0, upcoming: 0, complete: 0, blocked: 0 };
    list.forEach(function (team) {
      if (team.status === 'In Progress') { counts.active += 1; }
      if (team.status === 'Scheduling' && team.nextSession) { counts.upcoming += 1; }
      if (team.status === 'Complete') { counts.complete += 1; }
      if (team.status === 'Blocked' || asArray(team.blockers).length > 0) { counts.blocked += 1; }
    });
    return counts;
  }

  /** Formats a `{ timezone }`-bearing entity's current local time, or '' when the timezone is absent/invalid. */
  function currentTimeInZone(timezone, now) {
    if (!timezone) {
      return '';
    }
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      }).format(now || new Date());
    } catch (error) {
      return '';
    }
  }

  /** Normalizes a text or `{ title }` list entry into an Inspector list item. */
  function toPlainItem(entry) {
    var title = typeof entry === 'string' ? entry : (entry && entry.title) || '';
    return { title: title, tone: TONES.INFO };
  }

  /**
   * The full Team Workspace detail (§4 — Team command center): identity,
   * scheduling/reminder/escalation state, dual timezone, agenda, evidence,
   * dependencies, blockers, comments, ingestion log, scheduling
   * configuration, and the Team's own session history. Pure — plain data,
   * no DOM. `context` carries the cross-cutting reads the Team view needs
   * beyond the team record itself: `pocsById`, `suggestions`,
   * `dependencies`, `industryKnowledge`, `auditPeriod`, `auditorTimezone`.
   */
  function buildTeamDetail(team, context) {
    var ctx = context || {};
    var pocsById = ctx.pocsById || {};
    var mainPoc = team.mainPocId ? pocsById[team.mainPocId] : null;
    var escalationPoc = team.escalationPocId ? pocsById[team.escalationPocId] : null;
    var ingestion = team.ingestion || {};
    var scheduling = team.scheduling || {};
    var recurring = scheduling.recurring || {};

    return {
      teamId: team.id,
      name: team.name || team.id,
      status: team.status || 'Not Started',
      statusTone: resolveTeamStatusTone(team.status || 'Not Started'),
      stage: team.stage || 'Not Started',
      role: team.role || '',
      department: team.department || '',
      mainPoc: mainPoc,
      escalationPoc: escalationPoc,
      pocs: resolveTeamPocs(team, pocsById),
      reminderStatus: team.reminderStatus || 'Not Sent',
      escalationStatus: team.escalationStatus || 'None',
      nextSession: team.nextSession || null,
      nextSessionLabel: formatNextSessionLabel(team.nextSession),
      teamTimezone: team.timezone || '',
      auditorTimezone: ctx.auditorTimezone || '',
      teamLocalTime: currentTimeInZone(team.timezone),
      auditorLocalTime: currentTimeInZone(ctx.auditorTimezone),
      agenda: asArray(team.agenda).map(toPlainItem),
      evidenceExpected: asArray(team.evidenceExpected).map(toPlainItem),
      evidenceDemonstrated: asArray(team.evidenceDemonstrated).map(toPlainItem),
      blockers: asArray(team.blockers),
      // Comments, ingestion notes/uploads, and sessions stay in the record's
      // own recorded (write) order here; the DOM builders below reverse or
      // sort a display copy — never the view model itself — so a write that
      // appends to the same array the view model already carries stays
      // correct instead of round-tripping a display-reordered copy back into
      // storage.
      comments: asArray(team.comments),
      dependencies: asArray(ctx.dependencies),
      suggestions: asArray(ctx.suggestions),
      industryKnowledge: asArray(ctx.industryKnowledge),
      ingestion: {
        notes: asArray(ingestion.notes),
        transcripts: asArray(ingestion.transcripts),
        evidenceUploads: asArray(ingestion.evidenceUploads),
        recordingLinks: asArray(ingestion.recordingLinks),
        sharepointLinks: asArray(ingestion.sharepointLinks),
        localFileRefs: asArray(ingestion.localFileRefs)
      },
      scheduling: {
        recurringEnabled: Boolean(recurring.enabled),
        cadence: recurring.cadence || '',
        dayOfWeek: recurring.dayOfWeek || '',
        time: recurring.time || '',
        reminderCadence: scheduling.reminderCadence || '',
        escalationCadence: scheduling.escalationCadence || '',
        prepChecklist: asArray(scheduling.prepChecklist)
      },
      sessions: asArray(team.sessions)
    };
  }

  /**
   * The POC detail within a Team (§3 — POC-level drill-down): identity,
   * the Team it belongs to, and the real sessions it participated in
   * (filtered from the Team's own session history — never a fabricated
   * count).
   */
  function buildPocDetail(team, poc, pocsById) {
    if (!poc) {
      return null;
    }
    var sessions = asArray(team.sessions).filter(function (session) {
      return asArray(session.participants).indexOf(poc.id) !== -1;
    });
    return {
      id: poc.id,
      name: poc.name,
      status: poc.status || '',
      teamId: team.id,
      teamName: team.name || team.id,
      role: team.role || '',
      isMainPoc: team.mainPocId === poc.id,
      isEscalationPoc: team.escalationPocId === poc.id,
      contact: poc.preferredCommunication || '',
      sessions: sessions
    };
  }

  // ------------------------------------------------------------------
  // Team summary / POC operational derivations (Issue #37 Parts 5/6) —
  // pure, no DOM. The Team Workspace is an operational summary; every
  // number below is counted from the record's own arrays, never stored.
  // ------------------------------------------------------------------

  /** Sessions not yet completed, oldest first — the walkthroughs still ahead of this Team. */
  function derivePendingWalkthroughs(sessions) {
    return asArray(sessions).filter(function (session) {
      return session.status !== SESSION_STATUS.COMPLETED;
    }).sort(function (a, b) {
      return String(a.date || '').localeCompare(String(b.date || ''));
    });
  }

  /** The Team's at-a-glance progress meters: sessions, evidence, suggestions — real counts only. */
  function deriveTeamProgress(teamDetail) {
    var sessions = asArray(teamDetail.sessions);
    var completed = sessions.length - derivePendingWalkthroughs(sessions).length;
    var demonstrated = asArray(teamDetail.evidenceDemonstrated).length;
    var expected = asArray(teamDetail.evidenceExpected).length;
    var suggestions = asArray(teamDetail.suggestions);
    var applied = suggestions.filter(function (s) { return s.status === 'Applied'; }).length;
    return [
      { label: 'Walkthrough sessions', value: completed, total: sessions.length },
      { label: 'Evidence demonstrated', value: demonstrated, total: expected + demonstrated },
      { label: 'Suggestions applied', value: applied, total: suggestions.length }
    ];
  }

  /** Splits the Team's suggestions into awaiting-review (Suggested) and awaiting-approval/apply (Reviewed/Approved). */
  function splitSuggestionLifecycle(suggestions) {
    var pendingSuggestions = [];
    var pendingApprovals = [];
    asArray(suggestions).forEach(function (suggestion) {
      if (suggestion.status === 'Suggested') {
        pendingSuggestions.push(suggestion);
      } else if (suggestion.status === 'Reviewed' || suggestion.status === 'Approved') {
        pendingApprovals.push(suggestion);
      }
    });
    return { pendingSuggestions: pendingSuggestions, pendingApprovals: pendingApprovals };
  }

  /** POC card grouping order (Issue #37 Part 5) — Completed renders collapsed, last. */
  var POC_CARD_GROUPS = [
    'Blocked', 'Pending walkthrough', 'Pending evidence',
    'Pending approvals', 'Recently active', 'Completed'
  ];

  /**
   * One card per POC on the Team, classified into the Part 5 priority
   * groups from real record joins only: the POC's own status, the sessions
   * it genuinely participates in, and — for the main POC — the Team-level
   * evidence and approval workload it is accountable for. Groups the data
   * cannot substantiate simply stay empty; nothing is fabricated.
   */
  function derivePocCards(teamDetail) {
    var sessions = asArray(teamDetail.sessions);
    var lifecycle = splitSuggestionLifecycle(teamDetail.suggestions);
    return asArray(teamDetail.pocs).map(function (poc) {
      var participated = sessions.filter(function (session) {
        return asArray(session.participants).indexOf(poc.id) !== -1;
      });
      var scheduled = participated.filter(function (session) { return session.status !== SESSION_STATUS.COMPLETED; });
      var completed = participated.filter(function (session) { return session.status === SESSION_STATUS.COMPLETED; });
      var lastCompletedDate = completed.reduce(function (latest, session) {
        return String(session.date || '') > latest ? String(session.date || '') : latest;
      }, '');
      var isMain = Boolean(teamDetail.mainPoc && teamDetail.mainPoc.id === poc.id);
      var isEscalation = Boolean(teamDetail.escalationPoc && teamDetail.escalationPoc.id === poc.id);

      var group;
      if (poc.status === 'Blocked') {
        group = 'Blocked';
      } else if (poc.status === 'Completed' || poc.status === 'Complete') {
        group = 'Completed';
      } else if (scheduled.length > 0) {
        group = 'Pending walkthrough';
      } else if (isMain && asArray(teamDetail.evidenceExpected).length > 0) {
        group = 'Pending evidence';
      } else if (isMain && lifecycle.pendingApprovals.length > 0) {
        group = 'Pending approvals';
      } else {
        group = 'Recently active';
      }

      return {
        poc: poc, group: group, isMain: isMain, isEscalation: isEscalation,
        sessionCount: participated.length,
        lastActivity: lastCompletedDate,
        nextSession: scheduled.length > 0 ? scheduled[0] : null
      };
    }).sort(function (a, b) {
      var byGroup = POC_CARD_GROUPS.indexOf(a.group) - POC_CARD_GROUPS.indexOf(b.group);
      if (byGroup !== 0) {
        return byGroup;
      }
      return String(b.lastActivity).localeCompare(String(a.lastActivity));
    });
  }

  /**
   * The Team's recent operational trail, merged newest-first from the
   * record's own dated entries — comments, ingestion notes and uploads,
   * and sessions. Rendered on the POC Workspace (Issue #37 Part 6).
   */
  function deriveTeamRecentActivity(teamDetail) {
    var events = [];
    asArray(teamDetail.comments).forEach(function (comment) {
      events.push({
        title: comment.text,
        meta: 'Comment · ' + [comment.author, formatDate(comment.on)].filter(Boolean).join(' · '),
        date: comment.on || ''
      });
    });
    var ingestion = teamDetail.ingestion || {};
    asArray(ingestion.notes).forEach(function (note) {
      events.push({
        title: note.text,
        meta: 'Note · ' + [note.author, formatDate(note.on)].filter(Boolean).join(' · '),
        date: note.on || ''
      });
    });
    asArray(ingestion.evidenceUploads).forEach(function (upload) {
      events.push({
        title: upload.title,
        meta: 'Evidence upload · ' + [upload.reference, formatDate(upload.on)].filter(Boolean).join(' · '),
        date: upload.on || ''
      });
    });
    asArray(teamDetail.sessions).forEach(function (session) {
      events.push({
        title: session.title,
        meta: [(session.status || 'Session'), formatDate(session.date), session.time].filter(Boolean).join(' · '),
        date: session.date || ''
      });
    });
    return events.sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    }).slice(0, LIST_LIMIT);
  }

  // ------------------------------------------------------------------
  // View model — the single place this workspace reads AuditOS.state.
  // ------------------------------------------------------------------

  /** Reads the first dataset document an engagement owns in a collection, or null. */
  var readEngagementDocument = WS.readEngagementDocument;

  /** Finds a record by id within a list. */
  var findById = WS.findById;

  /**
   * Collects everything the Walkthrough Workspace presents from the Shared
   * Audit State. Returns null while the state is not ready, and a degraded
   * model when no engagement exists (§15.12). `routeContext`
   * (`{ teamId, pocId }`, both optional) selects the Team → POC depth the
   * current route names (Issue #36); omitting it (every existing caller)
   * preserves today's roster-level view exactly.
   */
  function collectViewModel(state, workspaceRegistry, routeContext) {
    if (!state || !state.isReady()) {
      return null;
    }

    var status = state.getStatus();
    var engagements = state.listRecords('engagements');
    // Issue #37 Phase 0: honor the engagement the hierarchical route names —
    // never silently substitute the first in-progress engagement when the
    // URL already says which engagement this walkthrough belongs to.
    var engagement = WS.resolveContextEngagement(engagements, routeContext);
    if (!engagement) {
      return { degraded: true, status: status };
    }

    var companies = state.listRecords('companies');
    var company = findById(companies, engagement.companyId);
    var pocs = state.listRecords('pocs');
    var pocsById = WS.indexById ? WS.indexById(pocs) : {};

    // The walkthrough collection is not yet registered in the demo-data
    // catalog (Release 1 has no walkthrough JSON). Reading it through the same
    // engagement-scoped document API as every other domain means the moment
    // the collection and a dataset exist, this workspace fills in with no
    // further changes — today it resolves to null and every section below
    // reads its real, empty defaults.
    var walkthroughsDocument = readEngagementDocument(state, 'walkthroughs', engagement.id) || {};
    var sessions = asArray(walkthroughsDocument.sessions);
    var processes = asArray(walkthroughsDocument.processes);
    var questions = asArray(walkthroughsDocument.questions);

    // Walkthrough Teams (Issue #36 §3/§4) live in their own engagement-scoped
    // collection — a separate Repository entity from `walkthroughs`, since
    // the generic Repository write API operates on exactly one `recordsKey`
    // per collection and `walkthroughs` already owns `sessions`.
    var walkthroughTeamsDocument = readEngagementDocument(state, 'walkthrough-teams', engagement.id) || {};
    var teams = asArray(walkthroughTeamsDocument.teams);

    // Team → POC context (Issue #36 §3/§8/§10/§11): AI Suggestions,
    // Dependencies, and Industry Knowledge, read through the same
    // engagement-scoped document pattern as every other domain above.
    // Industry Knowledge is shared/cross-engagement (Architectural Decision
    // #5), so it reads without a datasetId, then narrows to what is
    // genuinely applicable to this engagement's audit period.
    var suggestionsDocument = readEngagementDocument(state, 'suggestions', engagement.id) || {};
    var allSuggestions = asArray(suggestionsDocument.suggestions);
    var dependenciesDocument = readEngagementDocument(state, 'dependencies', engagement.id) || {};
    var allDependencies = asArray(dependenciesDocument.dependencies);
    var industryKnowledgeItems = state.listRecords('industry-knowledge');
    var applicableIndustryKnowledge = AuditOS.industryKnowledge
      ? AuditOS.industryKnowledge.resolveApplicable(industryKnowledgeItems, engagement.auditPeriod)
      : industryKnowledgeItems;

    var context = routeContext || {};
    var activeTeamRecord = context.teamId ? findTeamById(teams, context.teamId) : null;
    var activePocRecord = (activeTeamRecord && context.pocId) ? pocsById[context.pocId] : null;
    var registry = repositoryService();
    function hrefOf(teamId, pocId) {
      if (!registry || !company || !engagement || !workspaceRegistry) {
        return null;
      }
      var workspace = workspaceRegistry.findById(workspaceRegistry.IDS.WALKTHROUGH);
      if (!workspace) {
        return null;
      }
      var base = '#/' + registry.clientSlug(company) + '/' + registry.engagementSlug(engagement) + '/' + workspace.path;
      if (!teamId) {
        return base;
      }
      var withTeam = base + '/' + encodeURIComponent(teamId);
      return pocId ? withTeam + '/' + encodeURIComponent(pocId) : withTeam;
    }

    var requirementsDocument = readEngagementDocument(state, 'evidence-requirements', engagement.id) || {};
    var controlsDocument = readEngagementDocument(state, 'controls', engagement.id) || {};
    var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
    var testingDocument = readEngagementDocument(state, 'testing', engagement.id) || {};
    var findingsDocument = readEngagementDocument(state, 'findings', engagement.id) || {};
    var reportsDocument = readEngagementDocument(state, 'reports', engagement.id) || {};

    var operational = {
      requirements: requirementsDocument.summary || {},
      controls: controlsDocument.summary || {},
      evidence: evidenceDocument.summary || {},
      testing: testingDocument.summary || {},
      findings: findingsDocument.summary || {},
      report: reportsDocument.document || null
    };

    var frameworks = normalizeFrameworks(engagement);
    var walkthroughStatus = deriveWalkthroughStatus(sessions);
    var lastSession = deriveLastSession(sessions);
    var teamNames = deriveTeamNames(pocs, engagement.companyId);
    var relationships = deriveRelationships(workspaceRegistry, operational);
    var processCoverage = deriveProcessCoverage(processes, sessions);

    // Team detail context (Issue #36 §4/§8/§10/§11): the cross-cutting reads
    // the Team command center needs beyond the team record itself.
    var teamDetailContext = {
      pocsById: pocsById,
      auditorTimezone: engagement.auditorTimezone || '',
      dependencies: activeTeamRecord ? allDependencies.filter(function (dependency) {
        return asArray(activeTeamRecord.dependencyIds).indexOf(dependency.id) !== -1;
      }) : [],
      suggestions: activeTeamRecord ? allSuggestions.filter(function (suggestion) {
        return suggestion.teamId === activeTeamRecord.id;
      }) : [],
      industryKnowledge: applicableIndustryKnowledge
    };

    var view = activeTeamRecord ? (activePocRecord ? 'poc' : 'team') : 'roster';

    return {
      degraded: false,
      status: status,
      engagement: engagement,
      company: company,
      frameworks: frameworks,
      sessions: sessions,
      processes: processCoverage,
      questions: questions,
      teams: teams,

      // Team → POC hierarchy (Issue #36 §3): which view the current route
      // names, and that view's fully-derived detail. `activeTeam` /
      // `activePoc` stay null outside their view — never fabricated.
      view: view,
      teamRoster: deriveTeamRoster(teams, pocsById, hrefOf),
      teamRosterSummary: deriveTeamRosterSummary(teams),
      activeTeam: activeTeamRecord ? buildTeamDetail(activeTeamRecord, teamDetailContext) : null,
      activePoc: (activeTeamRecord && activePocRecord) ? buildPocDetail(activeTeamRecord, activePocRecord, pocsById) : null,
      hrefOf: hrefOf,
      pendingSuggestions: allSuggestions.filter(function (suggestion) {
        return suggestion.status === 'Suggested' || suggestion.status === 'Reviewed';
      }),

      header: {
        eyebrow: engagement.engagementCode + ' · Walkthrough',
        title: company ? company.name : engagement.companyId,
        meta: engagement.name,
        frameworks: frameworks,
        status: { label: walkthroughStatus.status, tone: walkthroughStatus.tone },
        lastUpdated: lastSession
          ? 'Last session: ' + lastSession.title + ' · ' + formatSessionDate(lastSession)
          : '',
        actions: [{ label: 'Engagement overview', href: '#/engagements', variant: 'subtle' }]
      },

      ribbon: [
        { label: 'Client', value: company ? company.name : engagement.companyId },
        { label: 'Engagement', value: engagement.name },
        { label: 'Last session', value: lastSession ? formatSessionDate(lastSession) : 'None yet' }
      ],

      toolbar: { search: { placeholder: 'Search walkthrough sessions' } },
      filterBar: {
        dropdowns: [{
          label: 'Process',
          options: ['All processes'].concat(processCoverage.map(function (process) { return process.name; }))
        }]
      },

      auditHealth: deriveAuditHealth(sessions, questions, teamNames),
      relationships: relationships,
      timeline: deriveTimeline(sessions),
      activity: deriveActivity(sessions),

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
    return WS.buildSection('aos-walkthrough', id, meta, bodyNode);
  }

  /**
   * Builds the Audit Health strip: a row of tone-dot indicators (editor
   * status-bar style, identical composition to the Engagement workspace's
   * strip). The status text carries the meaning; the dot only reinforces it.
   */
  function buildAuditHealth(items) {
    return WS.buildHealthStrip('aos-walkthrough', 'Walkthrough health', items);
  }

  /**
   * Builds one row of the session master list: title and status, then owner,
   * date, and participant count, then a short summary excerpt. Carries the
   * process ids it links to as a data attribute so the Process Coverage
   * section can filter it (presentation-only, memory-only interaction).
   */
  function buildSessionRow(session, index, onSelect) {
    var P = presentation();
    var row = el('button', 'aos-walkthrough__session-row');
    row.type = 'button';
    row.setAttribute('aria-pressed', 'false');
    var processIds = asArray(session.linkedProcesses).concat(session.processId ? [session.processId] : []);
    row.setAttribute('data-session-processes', processIds.join(','));

    var head = el('div', 'aos-walkthrough__session-row-head');
    head.appendChild(el('span', 'aos-walkthrough__session-row-title', session.title || ''));
    if (session.status) {
      head.appendChild(P.statusBadge({ label: session.status, tone: resolveSessionTone(session.status) }));
    }
    row.appendChild(head);

    var meta = el('div', 'aos-walkthrough__session-row-meta');
    meta.appendChild(el('span', null, session.owner || ''));
    meta.appendChild(el('span', 'aos-numeric', formatSessionDate(session)));
    meta.appendChild(el('span', null, asArray(session.participants).length + ' participants'));
    row.appendChild(meta);

    if (session.summary) {
      row.appendChild(el('p', 'aos-walkthrough__session-row-summary', session.summary));
    }

    row.addEventListener('click', function () { onSelect(index); });
    return row;
  }

  /**
   * Builds the Sessions Master–Detail (§ Primary Operational Area / § Walkthrough
   * Detail): a master rail of session rows beside the selected session's full
   * Inspector Panel detail. Selecting a row swaps the detail — memory-only
   * presentation state, identical pattern to the Engagement workspace's
   * Inspector.
   */
  function buildSessionsBody(sessions) {
    var P = presentation();
    var list = el('div', 'aos-walkthrough__session-list');
    list.setAttribute('role', 'list');
    var detailMount = el('div', 'aos-walkthrough__session-detail-mount');

    var rows = [];
    function select(index) {
      rows.forEach(function (row, rowIndex) {
        var selected = rowIndex === index;
        row.classList.toggle('aos-walkthrough__session-row--selected', selected);
        row.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      if (sessions[index]) {
        detailMount.replaceChildren(P.inspectorPanel(deriveSessionDetail(sessions[index])));
      }
    }

    asArray(sessions).forEach(function (session, index) {
      var row = buildSessionRow(session, index, select);
      rows.push(row);
      list.appendChild(row);
    });

    if (sessions.length > 0) {
      select(0);
    }

    return P.masterDetail({
      list: list, detail: detailMount, ratio: 36,
      listLabel: 'Walkthrough sessions', detailLabel: 'Session detail'
    });
  }

  /**
   * Builds the Process Coverage body: one Entity Card per discovered process.
   * Selecting a card filters the session master list to sessions linked to
   * that process (presentation-only, memory-only — no state is written, no
   * new route). Selecting the active card again clears the filter.
   */
  function buildProcessesBody(processes) {
    var P = presentation();
    var grid = el('div', 'aos-walkthrough__processes');
    asArray(processes).forEach(function (process) {
      var card = P.entityCard({
        title: process.name,
        subtitle: process.category,
        badge: { label: process.status, tone: process.tone },
        facts: [{ term: 'Sessions', detail: String(process.sessionCount) }]
      });
      card.classList.add('aos-walkthrough__process-card');
      card.setAttribute('data-process-filter', process.id);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      grid.appendChild(card);
    });
    return grid;
  }

  /**
   * Wires the Process Coverage filter to the Sessions master list: clicking a
   * process card dims session rows not linked to that process. Both sections
   * live in the same rendered canvas, so this runs once after the full canvas
   * is built. A no-op when either section is absent (their own empty states).
   */
  function wireProcessFilter(canvas) {
    var cards = canvas.querySelectorAll('[data-process-filter]');
    var rows = canvas.querySelectorAll('[data-session-processes]');
    if (cards.length === 0 || rows.length === 0) {
      return;
    }
    function activate(card) {
      var isActive = card.classList.contains('aos-walkthrough__process-card--active');
      cards.forEach(function (other) { other.classList.remove('aos-walkthrough__process-card--active'); });
      if (isActive) {
        rows.forEach(function (row) { row.classList.remove('aos-walkthrough__session-row--dimmed'); });
        return;
      }
      card.classList.add('aos-walkthrough__process-card--active');
      var processId = card.getAttribute('data-process-filter');
      rows.forEach(function (row) {
        var ids = (row.getAttribute('data-session-processes') || '').split(',').filter(Boolean);
        row.classList.toggle('aos-walkthrough__session-row--dimmed', ids.indexOf(processId) === -1);
      });
    }
    cards.forEach(function (card) {
      card.addEventListener('click', function () { activate(card); });
      card.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate(card);
        }
      });
    });
  }

  /** Builds the Pending Questions body: an Item List toned by question kind. */
  function buildQuestionsBody(questions) {
    var P = presentation();
    return P.itemList(asArray(questions).map(function (question) {
      return {
        title: question.title || question.question || '',
        description: question.description || '',
        meta: question.status || '',
        tone: QUESTION_TONES[question.kind] || TONES.INFO
      };
    }));
  }

  /** Builds the Relationship Panel body: the audit chain the walkthrough feeds, in order. */
  function buildRelationshipsBody(relationships) {
    var P = presentation();
    return P.itemList(asArray(relationships).map(function (item) {
      return {
        title: item.title, meta: item.meta, tone: TONES.INFO,
        actions: item.path ? [{ label: 'Open', href: '#/' + item.path }] : []
      };
    }));
  }

  /** Builds the Related information supporting panel body from the same relationships. */
  function buildRelatedBody(relationships) {
    return WS.buildRelatedBody(relationships, {
      icon: '◇', title: 'No related objects',
      description: 'The audit domains the walkthrough feeds appear here once they hold data.'
    });
  }

  /** Builds the Activity Feed for the activity supporting panel. */
  function buildActivityBody(activity) {
    return WS.buildActivityBody(activity, {
      icon: '◇', title: 'No recent activity',
      description: 'Completed walkthrough sessions appear here as they are recorded.'
    });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    return WS.buildFooterItems('aos-walkthrough', entries);
  }

  // ------------------------------------------------------------------
  // Write actions — simulated Repository writes (Issue #36). Every action
  // funnels through `updateTeam`, which performs one audited
  // `repository.walkthroughTeams.update` and publishes the
  // SynchronizationBus propagation chain (§12) so downstream workspaces can
  // react. AI never writes directly (Architectural Principle): the
  // Suggestion Lifecycle actions below delegate to
  // `AuditOS.suggestionService`, which owns that write path.
  // ------------------------------------------------------------------

  /** Today's date in the dataset's own ISO date convention. */
  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  /** The acting session's label, for comment/history entries (never an invented user). */
  function sessionLabel() {
    var permissions = AuditOS.permissions;
    return permissions && typeof permissions.getSessionInfo === 'function'
      ? permissions.getSessionInfo().label : '';
  }

  /** The dataset id an engagement's Walkthrough Teams document lives under, or null. */
  function teamDatasetId(repository, engagementId) {
    var datasets = repository.walkthroughTeams.datasetsForEngagement(engagementId);
    return datasets.length > 0 ? datasets[0] : null;
  }

  /**
   * Applies a patch to a Team record by id — the one write path every
   * Scheduling, Ingestion, and comment action below funnels through.
   * Publishes the SynchronizationBus propagation chain on every successful
   * write (Issue #36 §12 — a Team change is exactly the kind of
   * walkthrough-originated event downstream workspaces react to). Takes the
   * bare `teamId` (not a team object) so every caller passes exactly the
   * raw field it is changing — never a display-reordered copy of the rest
   * of the record.
   */
  function updateTeam(engagementId, teamId, changes, action, reason) {
    var repository = repositoryService();
    if (!repository || !teamId) {
      return null;
    }
    var datasetId = teamDatasetId(repository, engagementId);
    if (!datasetId) {
      return null;
    }
    var auditService = AuditOS.auditService;
    var updated = repository.walkthroughTeams.update(teamId, changes, {
      datasetId: datasetId,
      action: action,
      reason: reason || null,
      engagementId: engagementId,
      workspaceId: 'walkthroughs',
      correlationId: auditService ? auditService.newCorrelationId() : null
    });
    if (updated && AuditOS.synchronizationBus) {
      AuditOS.synchronizationBus.propagate(AuditOS.synchronizationBus.EVENT_TYPES.WALKTHROUGH_UPDATED, {
        engagementId: engagementId, teamId: teamId, workspaceId: 'walkthroughs', reason: reason || action
      });
    }
    presentationState.lastTeamId = teamId;
    return updated;
  }

  /** Adds a Team-level comment (Issue #36 §4 — Comments). `existingComments` is the record's own current array, in its own recorded order. */
  function addTeamComment(engagementId, teamId, existingComments, text) {
    if (!text) {
      return null;
    }
    var comments = asArray(existingComments).concat([{ author: sessionLabel(), on: todayIso(), text: text }]);
    return updateTeam(engagementId, teamId, { comments: comments }, 'team-commented', text);
  }

  /** Records one Ingestion entry — notes, evidence upload, recording link, SharePoint link, or local file reference (Issue #36 §7). `existingIngestion` is the record's own current `ingestion` object. */
  function addIngestionEntry(engagementId, teamId, existingIngestion, kind, entry) {
    var fieldByKind = {
      notes: 'notes', evidence: 'evidenceUploads', recording: 'recordingLinks',
      sharepoint: 'sharepointLinks', local: 'localFileRefs'
    };
    var field = fieldByKind[kind];
    if (!field) {
      return null;
    }
    var source = existingIngestion || {};
    var updatedIngestion = {
      notes: asArray(source.notes),
      transcripts: asArray(source.transcripts),
      evidenceUploads: asArray(source.evidenceUploads),
      recordingLinks: asArray(source.recordingLinks),
      sharepointLinks: asArray(source.sharepointLinks),
      localFileRefs: asArray(source.localFileRefs)
    };
    updatedIngestion[field] = updatedIngestion[field].concat([entry]);
    return updateTeam(engagementId, teamId, { ingestion: updatedIngestion }, 'team-ingestion-recorded',
      entry && (entry.text || entry.title || entry.url) || null);
  }

  /** Schedules a session — manual or recurring — and advances the Team's next-session pointer (Issue #36 §5). `existingSessions` is the record's own current array. */
  function scheduleTeamSession(engagementId, teamId, existingSessions, teamTimezone, sessionRecord) {
    var sessions = asArray(existingSessions).concat([sessionRecord]);
    var changes = { sessions: sessions };
    if (sessionRecord.date) {
      changes.nextSession = { date: sessionRecord.date, time: sessionRecord.time || '', timezone: teamTimezone || '' };
    }
    return updateTeam(engagementId, teamId, changes, 'team-session-scheduled', sessionRecord.title);
  }

  /** Records the reminder status a Team's next session carries (Issue #36 §5/§6). */
  function updateReminderStatus(engagementId, teamId, status) {
    return updateTeam(engagementId, teamId, { reminderStatus: status }, 'team-reminder-status-updated', status);
  }

  /** Records the escalation status a Team's next session carries (Issue #36 §5/§6). */
  function updateEscalationStatus(engagementId, teamId, status) {
    return updateTeam(engagementId, teamId, { escalationStatus: status }, 'team-escalation-status-updated', status);
  }

  // ------------------------------------------------------------------
  // Team → POC DOM builders (Issue #36 §1/§3/§4/§5/§6/§7/§9/§10/§11).
  // ------------------------------------------------------------------

  /** Builds the top-level Teams roster: one Entity Card per Team, linking into its command center. */
  function buildTeamsRosterBody(teamRoster) {
    var P = presentation();
    var grid = el('div', 'aos-walkthrough__teams');
    asArray(teamRoster).forEach(function (team) {
      var card = P.entityCard({
        title: team.name,
        subtitle: team.stage,
        badge: { label: team.status, tone: team.statusTone },
        facts: [
          { term: 'Main POC', detail: team.mainPocName || 'Not recorded' },
          { term: 'POCs', detail: String(team.pocCount) },
          { term: 'Next session', detail: team.nextSession || 'Not scheduled' },
          { term: 'Blockers', detail: String(team.blockerCount) }
        ]
      });
      if (team.path) {
        var link = el('a', 'aos-walkthrough__team-link');
        link.setAttribute('href', team.path);
        link.setAttribute('aria-label', 'Open ' + team.name);
        link.appendChild(card);
        grid.appendChild(link);
      } else {
        grid.appendChild(card);
      }
    });
    return grid;
  }

  /** Builds the Team command center overview: identity, scheduling state, and the dual timezone display (Issue #36 §6). */
  function buildTeamOverviewBody(team) {
    var P = presentation();
    var surface = el('div', 'aos-surface aos-surface--padded aos-walkthrough__team-overview');
    surface.appendChild(P.propertyGrid([
      { label: 'Status', node: P.statusBadge({ label: team.status, tone: team.statusTone }) },
      { label: 'Stage', value: team.stage },
      { label: 'Main POC', value: team.mainPoc ? team.mainPoc.name : 'Not recorded' },
      { label: 'Escalation POC', value: team.escalationPoc ? team.escalationPoc.name : 'Not recorded' },
      { label: 'Role', value: team.role || 'Not recorded' },
      { label: 'Department', value: team.department || 'Not recorded' },
      { label: 'Next session', value: team.nextSessionLabel || 'Not scheduled' },
      { label: 'Reminder status', value: team.reminderStatus },
      { label: 'Escalation status', value: team.escalationStatus }
    ], { columns: 3 }));

    var clocks = el('div', 'aos-walkthrough__timezones');
    clocks.setAttribute('role', 'group');
    clocks.setAttribute('aria-label', 'Auditor and POC local time');
    var auditorClock = el('div', 'aos-walkthrough__timezone');
    auditorClock.appendChild(el('span', 'aos-walkthrough__timezone-label', 'Auditor local time'));
    auditorClock.appendChild(el('span', 'aos-walkthrough__timezone-value', team.auditorLocalTime || 'Not recorded'));
    clocks.appendChild(auditorClock);
    var arrow = el('span', 'aos-walkthrough__timezone-arrow', '↓');
    arrow.setAttribute('aria-hidden', 'true');
    clocks.appendChild(arrow);
    var pocClock = el('div', 'aos-walkthrough__timezone');
    pocClock.appendChild(el('span', 'aos-walkthrough__timezone-label', 'POC local time'));
    pocClock.appendChild(el('span', 'aos-walkthrough__timezone-value', team.teamLocalTime || 'Not recorded'));
    clocks.appendChild(pocClock);
    surface.appendChild(clocks);

    return surface;
  }

  /** Builds the at-a-glance progress meters (Issue #37 Part 5) — every value reads as text beside the bar. */
  function buildTeamProgressBody(teamDetail) {
    var P = presentation();
    var wrap = el('div', 'aos-surface aos-surface--padded aos-walkthrough__progress');
    deriveTeamProgress(teamDetail).forEach(function (meter) {
      wrap.appendChild(P.progressMeter(meter));
    });
    return wrap;
  }

  /** Builds a compact, read-only suggestion summary — lifecycle actions live on the POC Workspace (Issue #37 Part 6). */
  function buildSuggestionSummaryBody(suggestions) {
    var P = presentation();
    return P.itemList(asArray(suggestions).map(function (suggestion) {
      return { title: suggestion.title, meta: suggestion.status, tone: resolveSuggestionTone(suggestion.status) };
    }), { compact: true });
  }

  /** Builds the pending walkthroughs list: the sessions still ahead, oldest first. */
  function buildPendingWalkthroughsBody(sessions) {
    var P = presentation();
    return P.itemList(asArray(sessions).map(function (session) {
      return {
        title: session.title,
        meta: [session.type, formatDate(session.date), session.time].filter(Boolean).join(' · '),
        tone: TONES.WARNING
      };
    }), { compact: true });
  }

  /** Builds the upcoming walkthroughs body: the next scheduled session plus the recorded recurring cadence. */
  function buildUpcomingWalkthroughsBody(teamDetail) {
    var P = presentation();
    var surface = el('div', 'aos-surface aos-surface--padded');
    surface.appendChild(P.propertyGrid([
      { label: 'Next session', value: teamDetail.nextSessionLabel || 'Not scheduled' },
      {
        label: 'Recurring', value: teamDetail.scheduling.recurringEnabled
          ? [teamDetail.scheduling.cadence, teamDetail.scheduling.dayOfWeek, teamDetail.scheduling.time].filter(Boolean).join(' · ')
          : 'Not recurring'
      }
    ], { columns: 2 }));
    return surface;
  }

  /**
   * Builds the grouped POC cards (Issue #37 Part 5): the priority groups in
   * order — Blocked, Pending walkthrough, Pending evidence, Pending
   * approvals, Recently active — with Completed collapsed last. Every card
   * links into the dedicated POC Workspace; nothing expands inline.
   */
  function buildPocCardsBody(teamDetail, hrefOf) {
    var P = presentation();
    var wrap = el('div', 'aos-walkthrough__poc-groups');
    var cards = derivePocCards(teamDetail);

    function cardNode(entry) {
      var badges = [];
      if (entry.isMain) { badges.push('Main'); }
      if (entry.isEscalation) { badges.push('Escalation'); }
      var tone = entry.group === 'Blocked' ? TONES.ERROR
        : entry.group === 'Completed' ? TONES.SUCCESS
          : entry.group === 'Recently active' ? TONES.INFO : TONES.WARNING;
      var card = P.entityCard({
        title: entry.poc.name,
        subtitle: badges.join(' · '),
        badge: { label: entry.group, tone: tone },
        facts: [
          { term: 'Sessions', detail: String(entry.sessionCount) },
          { term: 'Next session', detail: entry.nextSession ? formatDate(entry.nextSession.date) : 'None scheduled' },
          { term: 'Last active', detail: entry.lastActivity ? formatDate(entry.lastActivity) : 'No recorded activity' }
        ]
      });
      var href = hrefOf ? hrefOf(teamDetail.teamId, entry.poc.id) : null;
      if (!href) {
        return card;
      }
      var link = el('a', 'aos-walkthrough__poc-link');
      link.setAttribute('href', href);
      link.setAttribute('aria-label', 'Open ' + entry.poc.name);
      link.appendChild(card);
      return link;
    }

    POC_CARD_GROUPS.forEach(function (group) {
      var entries = cards.filter(function (entry) { return entry.group === group; });
      if (entries.length === 0) {
        return;
      }
      var grid = el('div', 'aos-walkthrough__pocs');
      entries.forEach(function (entry) { grid.appendChild(cardNode(entry)); });
      if (group === 'Completed') {
        var details = el('details', 'aos-walkthrough__poc-group aos-walkthrough__poc-group--completed');
        var summary = el('summary', 'aos-walkthrough__poc-group-title', group + ' (' + entries.length + ')');
        details.appendChild(summary);
        details.appendChild(grid);
        wrap.appendChild(details);
      } else {
        var block = el('div', 'aos-walkthrough__poc-group');
        block.appendChild(el('p', 'aos-walkthrough__subtitle', group));
        block.appendChild(grid);
        wrap.appendChild(block);
      }
    });
    return wrap;
  }

  /** Builds the Evidence expected / demonstrated body, side by side. */
  function buildEvidenceBody(team) {
    var P = presentation();
    var wrap = el('div', 'aos-walkthrough__split');
    var expected = el('div', 'aos-surface aos-surface--padded');
    expected.appendChild(el('p', 'aos-walkthrough__subtitle', 'Evidence expected'));
    expected.appendChild(team.evidenceExpected.length > 0
      ? P.itemList(team.evidenceExpected, { compact: true })
      : P.emptyState({ icon: '◇', title: 'None recorded' }));
    wrap.appendChild(expected);
    var demonstrated = el('div', 'aos-surface aos-surface--padded');
    demonstrated.appendChild(el('p', 'aos-walkthrough__subtitle', 'Evidence demonstrated'));
    demonstrated.appendChild(team.evidenceDemonstrated.length > 0
      ? P.itemList(team.evidenceDemonstrated, { compact: true })
      : P.emptyState({ icon: '◇', title: 'None recorded' }));
    wrap.appendChild(demonstrated);
    return wrap;
  }

  /** Builds the Pending Blockers body, high severity flagged critical. */
  function buildBlockersBody(blockers) {
    var P = presentation();
    return P.itemList(asArray(blockers).map(function (blocker) {
      var high = blocker.severity === 'High';
      return {
        title: blocker.title, description: blocker.description,
        meta: blocker.severity || '', tone: high ? TONES.ERROR : TONES.WARNING, critical: high
      };
    }));
  }

  /** Builds the Dependencies body (Issue #36 §10): reason, confidence, blocking state, and implications. */
  function buildDependenciesBody(dependencies) {
    var P = presentation();
    return P.itemList(asArray(dependencies).map(function (dependency) {
      return {
        title: dependency.reason || dependency.id,
        description: [dependency.auditPeriodImplications, dependency.futureImpact].filter(Boolean).join(' '),
        meta: dependency.blocking ? 'Blocking' : 'Confidence ' + Math.round((dependency.confidence || 0) * 100) + '%',
        tone: dependency.blocking ? TONES.ERROR : TONES.INFO,
        critical: Boolean(dependency.blocking)
      };
    }));
  }

  /** Builds the Industry Knowledge body (Issue #36 §11): only entries already resolved applicable to this engagement's audit period. */
  function buildIndustryKnowledgeBody(items) {
    var P = presentation();
    return P.itemList(asArray(items).map(function (item) {
      return {
        title: item.title, description: item.description,
        meta: 'Implemented ' + formatDate(item.implementationDate), tone: TONES.INFO
      };
    }));
  }

  /** Builds a labeled comment box: a textarea plus an action button (shared by Team comments and Suggestion cards). */
  function buildCommentForm(placeholder, buttonLabel, onSubmit) {
    var P = presentation();
    var wrap = el('div', 'aos-walkthrough__comment-form');
    var input = el('textarea', 'aos-walkthrough__field');
    input.rows = 2;
    input.placeholder = placeholder;
    input.setAttribute('aria-label', placeholder);
    wrap.appendChild(input);
    var button = P.button({ label: buttonLabel || 'Comment', variant: 'subtle' });
    button.addEventListener('click', function () {
      var text = input.value.trim();
      if (!text) {
        return;
      }
      onSubmit(text);
      input.value = '';
    });
    wrap.appendChild(button);
    return wrap;
  }

  /** Builds the Team Comments body: the comment form plus the recorded discussion, newest first. */
  function buildCommentsBody(team, engagementId) {
    var P = presentation();
    var wrap = el('div', 'aos-walkthrough__comments');
    wrap.appendChild(buildCommentForm('Add a comment', 'Comment', function (text) {
      addTeamComment(engagementId, team.teamId, team.comments, text);
      renderActiveWalkthrough();
    }));
    wrap.appendChild(team.comments.length > 0
      ? P.itemList(team.comments.slice().reverse().map(function (comment) {
        return { title: comment.text, meta: [comment.author, comment.on].filter(Boolean).join(' · ') };
      }), { compact: true })
      : P.emptyState({ icon: '◇', title: 'No comments yet' }));
    return wrap;
  }

  /** Builds one AI Suggestion card: status, description, recommendations, the lifecycle actions the session may take, and its comment trail (Issue #36 §9/§13). */
  function buildSuggestionCard(suggestion, engagementId) {
    var P = presentation();
    var repository = repositoryService();
    var suggestionService = AuditOS.suggestionService;
    var permissions = AuditOS.permissions;
    var denial = (permissions && suggestionService) ? permissions.explainDenial(suggestionService.DECIDE_CAPABILITY) : null;

    var card = el('div', 'aos-surface aos-surface--padded aos-walkthrough__suggestion');
    var head = el('div', 'aos-walkthrough__suggestion-head');
    head.appendChild(el('span', 'aos-walkthrough__suggestion-title', suggestion.title));
    head.appendChild(P.statusBadge({ label: suggestion.status, tone: resolveSuggestionTone(suggestion.status) }));
    card.appendChild(head);
    if (suggestion.description) {
      card.appendChild(el('p', 'aos-walkthrough__suggestion-description', suggestion.description));
    }
    if (asArray(suggestion.recommendations).length > 0) {
      card.appendChild(P.itemList(suggestion.recommendations.map(toPlainItem), { compact: true }));
    }

    if (suggestionService && repository) {
      var actions = el('div', 'aos-action-group');
      actions.setAttribute('role', 'group');
      actions.setAttribute('aria-label', 'Suggestion actions');

      // Review, comment, and recommend are available to every session
      // (Issue #36 §9 — "users without permissions may review, comment,
      // recommend").
      if (suggestion.status === suggestionService.STATUS.SUGGESTED) {
        var reviewButton = P.button({ label: 'Mark reviewed', variant: 'subtle' });
        reviewButton.addEventListener('click', function () {
          presentationState.lastTeamId = suggestion.teamId;
          suggestionService.review(repository, engagementId, suggestion, '');
          renderActiveWalkthrough();
        });
        actions.appendChild(reviewButton);
      }

      if (!denial) {
        [
          { id: 'approve', label: 'Approve', variant: 'primary' },
          { id: 'reject', label: 'Reject', variant: 'subtle' },
          { id: 'modify', label: 'Modify', variant: 'subtle' },
          { id: 'apply', label: 'Apply', variant: 'primary' }
        ].forEach(function (decision) {
          var button = P.button({ label: decision.label, variant: decision.variant });
          button.addEventListener('click', function () {
            presentationState.lastTeamId = suggestion.teamId;
            suggestionService.decide(repository, engagementId, suggestion, decision.id, '');
            renderActiveWalkthrough();
          });
          actions.appendChild(button);
        });
        card.appendChild(actions);
      } else {
        if (actions.firstChild) {
          card.appendChild(actions);
        }
        card.appendChild(WS.buildPermissionNotice(denial, ''));
      }

      card.appendChild(buildCommentForm('Comment or recommend', 'Comment', function (text) {
        presentationState.lastTeamId = suggestion.teamId;
        suggestionService.comment(repository, engagementId, suggestion, text);
        renderActiveWalkthrough();
      }));
    }

    var comments = asArray(suggestion.comments);
    if (comments.length > 0) {
      card.appendChild(P.itemList(comments.map(function (comment) {
        return { title: comment.text, meta: [comment.author, comment.on].filter(Boolean).join(' · ') };
      }), { compact: true }));
    }

    return card;
  }

  /** Builds the AI Suggestions body: one card per suggestion, most recently suggested first. */
  function buildSuggestionsBody(suggestions, engagementId) {
    var wrap = el('div', 'aos-walkthrough__suggestions');
    asArray(suggestions).slice().sort(function (a, b) {
      return String(b.suggestedOn || '').localeCompare(String(a.suggestedOn || ''));
    }).forEach(function (suggestion) {
      wrap.appendChild(buildSuggestionCard(suggestion, engagementId));
    });
    return wrap;
  }

  /** Builds the Scheduling form: manual/recurring, date, time, agenda, and evidence expected (Issue #36 §5). */
  function buildScheduleForm(team, engagementId) {
    var P = presentation();
    var form = el('div', 'aos-surface aos-surface--padded aos-walkthrough__schedule-form');
    form.appendChild(el('p', 'aos-walkthrough__subtitle', 'Schedule a session'));

    var typeSelect = el('select', 'aos-select__control');
    typeSelect.setAttribute('aria-label', 'Session type');
    ['Manual', 'Recurring'].forEach(function (option) {
      var opt = el('option', null, option);
      opt.value = option;
      typeSelect.appendChild(opt);
    });

    var dateInput = el('input', 'aos-walkthrough__field');
    dateInput.type = 'date';
    dateInput.setAttribute('aria-label', 'Session date');
    var timeInput = el('input', 'aos-walkthrough__field');
    timeInput.type = 'time';
    timeInput.setAttribute('aria-label', 'Session time');

    var fields = el('div', 'aos-walkthrough__schedule-fields');
    [['Type', typeSelect], ['Date', dateInput], ['Time', timeInput]].forEach(function (pair) {
      var field = el('label', 'aos-walkthrough__schedule-field');
      field.appendChild(el('span', 'aos-walkthrough__schedule-field-label', pair[0]));
      field.appendChild(pair[1]);
      fields.appendChild(field);
    });
    form.appendChild(fields);

    var agendaInput = el('textarea', 'aos-walkthrough__field');
    agendaInput.rows = 2;
    agendaInput.placeholder = 'Agenda (one item per line)';
    agendaInput.setAttribute('aria-label', 'Agenda');
    form.appendChild(agendaInput);

    var evidenceInput = el('textarea', 'aos-walkthrough__field');
    evidenceInput.rows = 2;
    evidenceInput.placeholder = 'Evidence expected (one item per line)';
    evidenceInput.setAttribute('aria-label', 'Evidence expected');
    form.appendChild(evidenceInput);

    var participants = el('div', 'aos-walkthrough__schedule-participants');
    participants.setAttribute('role', 'group');
    participants.setAttribute('aria-label', 'Participants');
    var checkboxes = [];
    asArray(team.pocs).forEach(function (poc) {
      var label = el('label', 'aos-walkthrough__schedule-participant');
      var checkbox = el('input', null);
      checkbox.type = 'checkbox';
      checkbox.value = poc.id;
      checkboxes.push(checkbox);
      label.appendChild(checkbox);
      label.appendChild(el('span', null, poc.name));
      participants.appendChild(label);
    });
    form.appendChild(participants);

    function splitLines(value) {
      return value.split('\n').map(function (line) { return line.trim(); }).filter(Boolean);
    }

    var submit = P.button({ label: 'Schedule session', variant: 'primary' });
    submit.addEventListener('click', function () {
      if (!dateInput.value) {
        return;
      }
      var sessionRecord = {
        id: 'SIM-TWS-' + Date.now(),
        title: typeSelect.value + ' walkthrough',
        type: typeSelect.value,
        date: dateInput.value,
        time: timeInput.value || '',
        status: 'Scheduled',
        agenda: splitLines(agendaInput.value),
        evidenceExpected: splitLines(evidenceInput.value),
        participants: checkboxes.filter(function (box) { return box.checked; }).map(function (box) { return box.value; }),
        notes: '', recordingLink: '', sharepointLink: '', localFileRef: ''
      };
      scheduleTeamSession(engagementId, team.teamId, team.sessions, team.teamTimezone, sessionRecord);
      dateInput.value = '';
      timeInput.value = '';
      agendaInput.value = '';
      evidenceInput.value = '';
      checkboxes.forEach(function (box) { box.checked = false; });
      renderActiveWalkthrough();
    });
    form.appendChild(submit);
    return form;
  }

  /** Builds the reminder / escalation status quick actions. */
  function buildStatusActions(team, engagementId) {
    var P = presentation();
    var wrap = el('div', 'aos-walkthrough__status-actions');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Reminder and escalation actions');

    var reminderButton = P.button({ label: 'Mark reminder sent', variant: 'subtle' });
    reminderButton.addEventListener('click', function () {
      updateReminderStatus(engagementId, team.teamId, 'Sent');
      renderActiveWalkthrough();
    });
    wrap.appendChild(reminderButton);

    var escalateButton = P.button({ label: 'Escalate now', variant: 'subtle' });
    escalateButton.addEventListener('click', function () {
      updateEscalationStatus(engagementId, team.teamId, 'Escalated');
      renderActiveWalkthrough();
    });
    wrap.appendChild(escalateButton);

    return wrap;
  }

  /** Builds the Scheduling section body: recorded configuration, the schedule form, and session history. */
  function buildSchedulingBody(team, engagementId) {
    var P = presentation();
    var wrap = el('div', 'aos-walkthrough__scheduling');

    var config = el('div', 'aos-surface aos-surface--padded');
    config.appendChild(P.propertyGrid([
      {
        label: 'Recurring', value: team.scheduling.recurringEnabled
          ? [team.scheduling.cadence, team.scheduling.dayOfWeek, team.scheduling.time].filter(Boolean).join(' · ')
          : 'Not recurring'
      },
      { label: 'Next session', value: team.nextSessionLabel || 'Not scheduled' }
    ], { columns: 2 }));
    if (team.scheduling.prepChecklist.length > 0) {
      config.appendChild(el('p', 'aos-walkthrough__subtitle', 'Preparation checklist'));
      config.appendChild(P.itemList(team.scheduling.prepChecklist.map(toPlainItem), { compact: true }));
    }
    wrap.appendChild(config);

    wrap.appendChild(buildScheduleForm(team, engagementId));

    if (team.sessions.length > 0) {
      var history = el('div', 'aos-surface aos-surface--padded');
      history.appendChild(el('p', 'aos-walkthrough__subtitle', 'Sessions'));
      history.appendChild(P.itemList(team.sessions.slice().sort(function (a, b) {
        return String(b.date || '').localeCompare(String(a.date || ''));
      }).map(function (session) {
        return {
          title: session.title,
          description: session.notes || '',
          meta: [session.type, formatDate(session.date), session.time].filter(Boolean).join(' · '),
          tone: session.status === 'Completed' ? TONES.SUCCESS : TONES.INFO
        };
      }), { compact: true }));
      wrap.appendChild(history);
    }

    return wrap;
  }

  /** Builds the Ingestion form: one entry kind at a time (Issue #36 §7). */
  function buildIngestionForm(team, engagementId) {
    var P = presentation();
    var wrap = el('div', 'aos-surface aos-surface--padded aos-walkthrough__ingestion-form');
    wrap.appendChild(el('p', 'aos-walkthrough__subtitle', 'Record ingestion'));

    var kindSelect = el('select', 'aos-select__control');
    kindSelect.setAttribute('aria-label', 'Ingestion kind');
    [
      { value: 'notes', label: 'Note' },
      { value: 'evidence', label: 'Evidence reference' },
      { value: 'recording', label: 'Recording link' },
      { value: 'sharepoint', label: 'SharePoint link' },
      { value: 'local', label: 'Local file reference' }
    ].forEach(function (option) {
      var opt = el('option', null, option.label);
      opt.value = option.value;
      kindSelect.appendChild(opt);
    });
    wrap.appendChild(kindSelect);

    var textInput = el('textarea', 'aos-walkthrough__field');
    textInput.rows = 2;
    textInput.placeholder = 'Details (note text, reference, or URL)';
    textInput.setAttribute('aria-label', 'Ingestion details');
    wrap.appendChild(textInput);

    var submit = P.button({ label: 'Add', variant: 'subtle' });
    submit.addEventListener('click', function () {
      var text = textInput.value.trim();
      if (!text) {
        return;
      }
      var kind = kindSelect.value;
      var entry;
      if (kind === 'notes') {
        entry = { on: todayIso(), author: sessionLabel(), text: text };
      } else if (kind === 'evidence') {
        entry = { on: todayIso(), title: text, reference: 'SIM-EVID-' + Date.now() };
      } else if (kind === 'recording') {
        entry = { sessionId: '', url: text };
      } else if (kind === 'sharepoint') {
        entry = { title: text, url: text };
      } else {
        entry = { title: text, path: text };
      }
      addIngestionEntry(engagementId, team.teamId, team.ingestion, kind, entry);
      textInput.value = '';
      renderActiveWalkthrough();
    });
    wrap.appendChild(submit);
    return wrap;
  }

  /** Builds the Ingestion section body: the form plus the recorded log, grouped by kind. */
  function buildIngestionBody(team, engagementId) {
    var P = presentation();
    var wrap = el('div', 'aos-walkthrough__ingestion');
    wrap.appendChild(buildIngestionForm(team, engagementId));

    [
      { title: 'Notes', items: team.ingestion.notes.slice().reverse().map(function (n) { return { title: n.text, meta: [n.author, n.on].filter(Boolean).join(' · ') }; }) },
      { title: 'Evidence uploads', items: team.ingestion.evidenceUploads.slice().reverse().map(function (e) { return { title: e.title, meta: [e.reference, e.on].filter(Boolean).join(' · ') }; }) },
      { title: 'Recording links', items: team.ingestion.recordingLinks.map(function (r) { return { title: r.sessionId || 'Recording', meta: r.url }; }) },
      { title: 'SharePoint links', items: team.ingestion.sharepointLinks.map(function (s) { return { title: s.title, meta: s.url }; }) },
      { title: 'Local file references', items: team.ingestion.localFileRefs.map(function (f) { return { title: f.title, meta: f.path }; }) }
    ].forEach(function (group) {
      if (group.items.length === 0) {
        return;
      }
      var block = el('div', 'aos-surface aos-surface--padded');
      block.appendChild(el('p', 'aos-walkthrough__subtitle', group.title));
      block.appendChild(P.itemList(group.items, { compact: true }));
      wrap.appendChild(block);
    });

    return wrap;
  }

  /** Builds the POC detail overview: identity, role, and Team membership. */
  function buildPocOverviewBody(poc) {
    var P = presentation();
    var surface = el('div', 'aos-surface aos-surface--padded');
    var badges = [];
    if (poc.isMainPoc) { badges.push('Main POC'); }
    if (poc.isEscalationPoc) { badges.push('Escalation POC'); }
    surface.appendChild(P.propertyGrid([
      { label: 'Status', value: poc.status || 'Not recorded' },
      { label: 'Team', value: poc.teamName },
      { label: 'Role', value: poc.role || 'Not recorded' },
      { label: 'Contact', value: poc.contact || 'Not recorded' },
      { label: 'Responsibilities', value: badges.join(' · ') || 'None recorded' }
    ], { columns: 2 }));
    return surface;
  }

  /**
   * Builds the Reminders & escalation body (Issue #37 Part 6): the recorded
   * reminder/escalation state and cadences plus the real Repository-backed
   * quick actions (moved here from the Team page — the Team Workspace is a
   * summary only).
   */
  function buildRemindersBody(team, engagementId) {
    var P = presentation();
    var wrap = el('div', 'aos-surface aos-surface--padded');
    wrap.appendChild(P.propertyGrid([
      { label: 'Reminder status', value: team.reminderStatus },
      { label: 'Reminder cadence', value: team.scheduling.reminderCadence || 'Not recorded' },
      { label: 'Escalation status', value: team.escalationStatus },
      { label: 'Escalation cadence', value: team.scheduling.escalationCadence || 'Not recorded' },
      { label: 'Escalation POC', value: team.escalationPoc ? team.escalationPoc.name : 'Not recorded' }
    ], { columns: 2 }));
    wrap.appendChild(buildStatusActions(team, engagementId));
    return wrap;
  }

  /**
   * Builds the Mail drafting seam (Issue #37 Part 6): compose a subject and
   * body for this POC and hand off to the local mail client via `mailto:`.
   * Release 1 sends nothing itself and stores nothing — this is the
   * integration seam where Release 2's AI-drafted follow-ups will surface.
   */
  function buildMailDraftBody(poc) {
    var P = presentation();
    var wrap = el('div', 'aos-surface aos-surface--padded aos-walkthrough__mail');
    wrap.appendChild(P.propertyGrid([
      { label: 'To', value: poc.name },
      { label: 'Preferred channel', value: poc.contact || 'Not recorded' }
    ], { columns: 2 }));

    var subject = el('input', 'aos-walkthrough__field');
    subject.type = 'text';
    subject.placeholder = 'Subject';
    subject.setAttribute('aria-label', 'Mail subject');
    wrap.appendChild(subject);

    var body = el('textarea', 'aos-walkthrough__field');
    body.rows = 3;
    body.placeholder = 'Draft the mail body';
    body.setAttribute('aria-label', 'Mail body');
    wrap.appendChild(body);

    var open = P.button({ label: 'Open in mail client', variant: 'subtle' });
    open.addEventListener('click', function () {
      global.location.href = 'mailto:?subject=' + encodeURIComponent(subject.value) +
        '&body=' + encodeURIComponent(body.value);
    });
    wrap.appendChild(open);
    wrap.appendChild(el('p', 'aos-walkthrough__seam-note',
      'Integration seam — Release 1 hands the draft to your local mail client; AI-drafted follow-ups arrive with the AI foundation.'));
    return wrap;
  }

  /** Builds the POC call history: the real sessions this POC participated in, newest first, plus recorded meeting recordings. */
  function buildCallHistoryBody(poc, teamDetail) {
    var P = presentation();
    var wrap = el('div', 'aos-walkthrough__call-history');
    wrap.appendChild(asArray(poc.sessions).length > 0
      ? P.itemList(asArray(poc.sessions).slice().sort(function (a, b) {
        return String(b.date || '').localeCompare(String(a.date || ''));
      }).map(function (session) {
        return {
          title: session.title,
          meta: [session.type, formatDate(session.date), session.time].filter(Boolean).join(' · '),
          tone: session.status === 'Completed' ? TONES.SUCCESS : TONES.INFO
        };
      }), { compact: true })
      : P.emptyState({
        icon: '◇', title: 'No calls recorded yet',
        description: 'Sessions this POC participated in appear here once they are logged.'
      }));
    var recordings = asArray(teamDetail.ingestion.recordingLinks);
    if (recordings.length > 0) {
      wrap.appendChild(el('p', 'aos-walkthrough__subtitle', 'Recordings'));
      wrap.appendChild(P.itemList(recordings.map(function (recording) {
        return { title: recording.sessionId || 'Recording', meta: recording.url };
      }), { compact: true }));
    }
    return wrap;
  }

  /** Builds the recent activity body: the Team's merged operational trail, newest first. */
  function buildRecentActivityBody(teamDetail) {
    var P = presentation();
    return P.itemList(deriveTeamRecentActivity(teamDetail).map(function (event) {
      return { title: event.title, meta: event.meta };
    }), { compact: true });
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Returns a framework slot inside the active workspace view. */
  var slotElement = WS.slotElement;

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /**
   * The roster-level walkthrough sections (§ Workspace Structure): the Team
   * roster leads — "operational readiness rather than historical
   * meetings" (Issue #36 §3) — then Audit Health and the operational
   * sections in the order a team works through them, unchanged from
   * Release 1. Each entry names the section id, its header, whether it has
   * data, its body builder, and an empty descriptor used when the data is
   * absent.
   */
  function rosterSections(viewModel) {
    return [
      {
        id: 'teams', kicker: 'Operational readiness', title: 'Teams',
        description: 'One continuously evolving walkthrough workspace per Team — select a Team to open its command center.',
        present: viewModel.teamRoster.length > 0,
        body: function () { return buildTeamsRosterBody(viewModel.teamRoster); },
        empty: {
          icon: '◇', title: 'No teams recorded yet',
          description: 'Teams appear here once the engagement’s walkthrough roster is authored.'
        }
      },
      {
        id: 'health', kicker: 'Operational status', title: 'Audit health',
        present: true, body: function () { return buildAuditHealth(viewModel.auditHealth); }
      },
      {
        id: 'sessions', kicker: 'Knowledge acquisition', title: 'Walkthrough sessions',
        description: 'Select a session to view its objective, participants, agenda, and linked audit objects.',
        present: viewModel.sessions.length > 0,
        body: function () { return buildSessionsBody(viewModel.sessions); },
        empty: {
          icon: '◇', title: 'No walkthrough sessions recorded',
          description: 'Sessions will appear here once walkthroughs are conducted and logged.'
        }
      },
      {
        id: 'questions', kicker: 'Open items', title: 'Pending questions',
        present: viewModel.questions.length > 0,
        body: function () { return buildQuestionsBody(viewModel.questions); },
        empty: {
          icon: '✓', title: 'Nothing pending',
          description: 'Unresolved questions, evidence requests, and pending confirmations appear here.'
        }
      },
      {
        id: 'processes', kicker: 'Discovery', title: 'Process coverage',
        description: 'Select a process to filter the sessions above to the ones that cover it.',
        present: viewModel.processes.length > 0,
        body: function () { return buildProcessesBody(viewModel.processes); },
        empty: {
          icon: '◇', title: 'No processes discovered yet',
          description: 'Business processes surfaced during walkthroughs will appear here.'
        }
      },
      {
        id: 'relationships', kicker: 'Audit chain', title: 'Relationship panel',
        description: 'The downstream audit chain the walkthrough feeds — requirements, controls, evidence, testing, findings, and the report.',
        present: viewModel.relationships.length > 0,
        body: function () { return buildRelationshipsBody(viewModel.relationships); },
        empty: {
          icon: '◇', title: 'No related audit objects yet',
          description: 'Requirements, controls, evidence, testing, findings, and the report appear here once they hold data.'
        }
      },
      {
        id: 'timeline', kicker: 'History', title: 'Timeline',
        present: viewModel.timeline.length > 0,
        body: function () { return AuditOS.presentation.timeline(viewModel.timeline); },
        empty: {
          icon: '◇', title: 'No walkthrough history yet',
          description: 'Session milestones will appear here as walkthroughs are conducted.'
        }
      }
    ];
  }

  /**
   * The Team Workspace sections (Issue #37 Part 5) — an operational summary
   * only: health, at-a-glance progress, the pending workload, upcoming
   * walkthroughs, and the prioritized POC cards. Every operational feature
   * (agenda, scheduling, reminders, ingestion, comments, suggestion
   * lifecycle, dependencies, industry knowledge) lives on the POC
   * Workspace (Part 6); nothing here expands inline.
   */
  function teamSections(viewModel) {
    var team = viewModel.activeTeam;
    var lifecycle = splitSuggestionLifecycle(team.suggestions);
    var pendingWalkthroughs = derivePendingWalkthroughs(team.sessions);
    return [
      {
        id: 'overview', kicker: 'Team health', title: team.name,
        present: true, body: function () { return buildTeamOverviewBody(team); }
      },
      {
        id: 'blockers', kicker: 'At risk', title: 'Blockers',
        present: team.blockers.length > 0,
        body: function () { return buildBlockersBody(team.blockers); },
        empty: { icon: '✓', title: 'Nothing blocking', description: 'Blockers preventing this Team’s walkthrough from progressing appear here.' }
      },
      {
        id: 'progress', kicker: 'At a glance', title: 'Progress',
        present: true, body: function () { return buildTeamProgressBody(team); }
      },
      {
        id: 'pending-walkthroughs', kicker: 'Pending', title: 'Pending walkthroughs',
        present: pendingWalkthroughs.length > 0,
        body: function () { return buildPendingWalkthroughsBody(pendingWalkthroughs); },
        empty: { icon: '✓', title: 'No pending walkthroughs', description: 'Sessions awaiting completion appear here.' }
      },
      {
        id: 'pending-evidence', kicker: 'Pending', title: 'Pending evidence',
        present: team.evidenceExpected.length > 0,
        body: function () { return presentation().itemList(team.evidenceExpected, { compact: true }); },
        empty: { icon: '✓', title: 'No evidence pending', description: 'Evidence this Team still owes appears here.' }
      },
      {
        id: 'pending-approvals', kicker: 'Pending', title: 'Pending approvals',
        present: lifecycle.pendingApprovals.length > 0,
        body: function () { return buildSuggestionSummaryBody(lifecycle.pendingApprovals); },
        empty: { icon: '✓', title: 'Nothing awaiting approval', description: 'Suggestions reviewed and awaiting an approval decision appear here.' }
      },
      {
        id: 'pending-suggestions', kicker: 'Pending', title: 'Pending AI suggestions',
        present: lifecycle.pendingSuggestions.length > 0,
        body: function () { return buildSuggestionSummaryBody(lifecycle.pendingSuggestions); },
        empty: { icon: '✦', title: 'No suggestions awaiting review', description: 'Newly raised AI Suggestions appear here until they are reviewed.' }
      },
      {
        id: 'upcoming', kicker: 'Schedule', title: 'Upcoming walkthroughs',
        present: true, body: function () { return buildUpcomingWalkthroughsBody(team); }
      },
      {
        id: 'pocs', kicker: 'People', title: 'POCs',
        description: 'Prioritized by operational need — select a POC to open its dedicated workspace.',
        present: team.pocs.length > 0,
        body: function () { return buildPocCardsBody(team, viewModel.hrefOf); },
        empty: { icon: '◇', title: 'No POCs recorded yet', description: 'The POC roster appears here once it is authored.' }
      }
    ];
  }

  /**
   * The POC Workspace sections (Issue #37 Part 6) — every operational
   * feature moved here from the Team page: agenda, evidence pending,
   * dependencies, scheduling, reminders & escalation, the AI Suggestion
   * lifecycle, Industry Knowledge, comments, transcript & evidence
   * ingestion, mail drafting, call history, and recent activity. All data
   * is Repository-backed; mail and AI surfaces are integration seams only.
   */
  function pocSections(viewModel) {
    var poc = viewModel.activePoc;
    var team = viewModel.activeTeam;
    var engagementId = viewModel.engagement.id;
    return [
      {
        id: 'overview', kicker: poc.teamName, title: poc.name,
        present: true, body: function () { return buildPocOverviewBody(poc); }
      },
      {
        id: 'agenda', kicker: 'Next session', title: 'Agenda',
        present: team.agenda.length > 0,
        body: function () { return presentation().itemList(team.agenda, { compact: true }); },
        empty: { icon: '◇', title: 'No agenda recorded', description: 'The agenda for the next session appears here once it is set.' }
      },
      {
        id: 'evidence', kicker: 'Evidence', title: 'Evidence pending',
        present: team.evidenceExpected.length > 0 || team.evidenceDemonstrated.length > 0,
        body: function () { return buildEvidenceBody(team); },
        empty: { icon: '◇', title: 'No evidence recorded yet', description: 'Evidence expected and demonstrated appear here as the walkthrough progresses.' }
      },
      {
        id: 'dependencies', kicker: 'Dependency Engine', title: 'Dependencies',
        description: 'Team → POC → Requirement → Control → Evidence → Report — reason, confidence, and audit-period implications.',
        present: team.dependencies.length > 0,
        body: function () { return buildDependenciesBody(team.dependencies); },
        empty: { icon: '✓', title: 'No dependencies recorded', description: 'Dependencies this walkthrough relies on appear here.' }
      },
      {
        id: 'scheduling', kicker: 'Recurring & manual meetings', title: 'Scheduling',
        present: true, body: function () { return buildSchedulingBody(team, engagementId); }
      },
      {
        id: 'reminders', kicker: 'Follow-through', title: 'Reminders & escalation',
        present: true, body: function () { return buildRemindersBody(team, engagementId); }
      },
      {
        id: 'suggestions', kicker: 'Suggested → Reviewed → Approved → Applied', title: 'AI Suggestions',
        present: team.suggestions.length > 0,
        body: function () { return buildSuggestionsBody(team.suggestions, engagementId); },
        empty: { icon: '✦', title: 'No suggestions yet', description: 'AI Suggestions appear here as soon as they are raised. AI never writes directly — Suggestions require Approval to Apply.' }
      },
      {
        id: 'industry-knowledge', kicker: 'Organizational learning', title: 'Industry Knowledge',
        description: 'Reusable knowledge applicable to this engagement’s audit period — never retroactive.',
        present: team.industryKnowledge.length > 0,
        body: function () { return buildIndustryKnowledgeBody(team.industryKnowledge); },
        empty: { icon: '◇', title: 'No applicable Industry Knowledge', description: 'Organizational learning applicable to this engagement’s audit period appears here.' }
      },
      {
        id: 'comments', kicker: 'Discussion', title: 'Comments',
        present: true, body: function () { return buildCommentsBody(team, engagementId); }
      },
      {
        id: 'ingestion', kicker: 'Notes, transcripts, evidence', title: 'Transcript & evidence ingestion',
        present: true, body: function () { return buildIngestionBody(team, engagementId); }
      },
      {
        id: 'mail', kicker: 'Communication', title: 'Mail drafting',
        present: true, body: function () { return buildMailDraftBody(poc); }
      },
      {
        id: 'call-history', kicker: 'Participation', title: 'Call history',
        present: true, body: function () { return buildCallHistoryBody(poc, team); }
      },
      {
        id: 'activity', kicker: 'History', title: 'Recent activity',
        present: deriveTeamRecentActivity(team).length > 0,
        body: function () { return buildRecentActivityBody(team); },
        empty: { icon: '◇', title: 'No recorded activity yet', description: 'Comments, notes, uploads, and sessions appear here as the walkthrough progresses.' }
      }
    ];
  }

  /**
   * The ordered sections for the current view: the Team roster (default),
   * a Team's command center, or a POC's detail — whichever the resolved
   * route context names (Issue #36 §3).
   */
  function primarySections(viewModel) {
    if (viewModel.view === 'poc' && viewModel.activePoc) {
      return pocSections(viewModel);
    }
    if (viewModel.view === 'team' && viewModel.activeTeam) {
      return teamSections(viewModel);
    }
    return rosterSections(viewModel);
  }

  /** Renders the ready walkthrough experience into the framework slots. */
  function renderReady(view, viewModel) {
    var P = presentation();

    AuditOS.workspaceFramework.configure(view, {
      header: viewModel.header,
      contextSummary: viewModel.ribbon,
      toolbar: viewModel.toolbar,
      filterBar: viewModel.filterBar
    });

    var canvas = el('div', 'aos-walkthrough');
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
    wireProcessFilter(canvas);

    var related = buildRelatedBody(viewModel.relationships);
    related.classList.add('aos-fade-in');
    fillSlot(view, SLOTS.RELATED, [related]);

    var ai = P.emptyState({
      icon: '✦', title: 'Reserved for AI advisory',
      description: 'Transcript ingestion and AI-drafted requirements, controls, and evidence gaps will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
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
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'detail', label: 'Loading walkthrough' })]);
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
        '. Regenerate the demo-data bundle and reload to restore the Walkthrough Workspace.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders the Walkthrough Workspace when it is the active workspace: the
   * ready experience once the state has loaded, the loading skeleton before
   * that, and the degraded explanation when no engagement is available.
   */
  function renderActiveWalkthrough() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.WALKTHROUGH) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.WALKTHROUGH + '"]'
    );
    if (!view) {
      return;
    }

    // Team → POC depth (Issue #36 §3) comes from the resolved hierarchy
    // context the router already carries; omitted entirely for flat routes,
    // which keeps every existing deep link and test call (`collectViewModel`
    // with just `state, registry`) resolving to the roster view exactly as
    // before.
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

  AuditOS.walkthroughWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      formatDate: formatDate,
      normalizeFrameworks: normalizeFrameworks,
      deriveCurrentEngagement: deriveCurrentEngagement,
      resolveSessionTone: resolveSessionTone,
      formatSessionDate: formatSessionDate,
      deriveWalkthroughStatus: deriveWalkthroughStatus,
      resolveTeamStatusTone: resolveTeamStatusTone,
      resolveSuggestionTone: resolveSuggestionTone,
      findTeamById: findTeamById,
      resolveTeamPocs: resolveTeamPocs,
      formatNextSessionLabel: formatNextSessionLabel,
      deriveTeamRoster: deriveTeamRoster,
      deriveTeamRosterSummary: deriveTeamRosterSummary,
      currentTimeInZone: currentTimeInZone,
      buildTeamDetail: buildTeamDetail,
      buildPocDetail: buildPocDetail,
      derivePendingWalkthroughs: derivePendingWalkthroughs,
      deriveTeamProgress: deriveTeamProgress,
      splitSuggestionLifecycle: splitSuggestionLifecycle,
      derivePocCards: derivePocCards,
      deriveTeamRecentActivity: deriveTeamRecentActivity,
      POC_CARD_GROUPS: POC_CARD_GROUPS,
      deriveLastSession: deriveLastSession,
      deriveTeamNames: deriveTeamNames,
      countParticipatedTeamMembers: countParticipatedTeamMembers,
      deriveAuditHealth: deriveAuditHealth,
      deriveProcessCoverage: deriveProcessCoverage,
      deriveRelationships: deriveRelationships,
      deriveTimeline: deriveTimeline,
      deriveActivity: deriveActivity,
      deriveSessionDetail: deriveSessionDetail
    },

    collectViewModel: collectViewModel,

    /**
     * Binds the Walkthrough Workspace to the router and the Shared Audit
     * State. Safe to call once, after the DOM is ready, the router has
     * resolved the initial route, and the framework has rendered its
     * skeleton (script order guarantees the framework's route listener runs
     * first). Does nothing when the routing or state foundations are absent,
     * so the shell degrades rather than throwing.
     */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveWalkthrough);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveWalkthrough);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveWalkthrough);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveWalkthrough);
      }
      renderActiveWalkthrough();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.walkthroughWorkspace.init);
    } else {
      AuditOS.walkthroughWorkspace.init();
    }
  }
})(window);
