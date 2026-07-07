/**
 * AuditOS Walkthrough Workspace
 * Workspaces and Navigation — Chapter 12 / Workspace Architecture — Chapter 61 /
 * Audit Lifecycle — Chapter 11 / Component Architecture — Chapter 74
 *
 * The primary operational workspace where the audit team progressively learns
 * the client's environment (GitHub Issue #20). Release 1 is a faithful
 * visualization of the demo JSON: no AI, no transcript processing, no
 * workflow engine, no writes. The demo-data catalog carries no walkthrough
 * collection yet, so every operational section renders through the shared
 * Empty State component today — nothing here is fabricated. The workspace
 * reads its walkthrough data through the same engagement-scoped document
 * pattern as controls, evidence, testing, and findings (`findDatasetsForEngagement`
 * / `getDocument`), so the moment a `walkthroughs` collection and dataset
 * exist, every section fills in automatically with no further changes here —
 * the Release 1 → Release 2 seam this workspace exists to open.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to the
 * Engagement workspace. `collectViewModel` is the single place this workspace
 * reads `AuditOS.state`. The renderer configures the Shared Workspace
 * Framework's inherited skeleton (`AuditOS.workspaceFramework.configure`) and
 * fills its slots with compositions from the Enterprise Data Presentation
 * System (`AuditOS.presentation`) — no bespoke primitives, no duplicated
 * components (Component Design Patterns §81.4 — Composition Over Duplication).
 *
 * The expected walkthrough document shape (once it exists), read from the
 * `walkthroughs` engagement-scoped collection:
 *   { sessions: [ { id, title, owner, status, scheduledDate, completedDate,
 *       participants, summary, objective, agenda, notes, linkedProcesses,
 *       linkedRequirements, linkedEvidence, followUpItems, processId } ],
 *     processes: [ { id, name } ],
 *     questions: [ { id, title, kind, status } ] }
 * Nothing in this file hardcodes those values; every read defaults to an
 * empty array so an absent collection renders exactly like an empty one.
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

  var SLOTS = {
    CONTENT: 'primary-content',
    RELATED: 'related-information',
    AI: 'ai-recommendations',
    ACTIVITY: 'activity',
    FOOTER: 'workspace-footer'
  };

  var TONES = { INFO: 'info', SUCCESS: 'success', WARNING: 'warning', ERROR: 'error' };

  var ENGAGEMENT_STATUS = { IN_PROGRESS: 'In Progress' };

  /** Walkthrough session status vocabulary (read, never invented) and its tones. */
  var SESSION_STATUS = { COMPLETED: 'Completed', IN_PROGRESS: 'In Progress', SCHEDULED: 'Scheduled' };
  var SESSION_TONES = { 'Completed': TONES.SUCCESS, 'In Progress': TONES.INFO, 'Scheduled': null };

  /** Pending-question kind vocabulary → tone (unresolved question, evidence request, confirmation, walkthrough). */
  var QUESTION_TONES = {
    question: TONES.INFO, 'evidence-request': TONES.WARNING,
    confirmation: TONES.INFO, walkthrough: TONES.WARNING
  };

  var MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** Maximum entries per list so sections stay scannable. */
  var LIST_LIMIT = 8;

  /** Entrance stagger ceiling — sections beyond this share the last delay. */
  var STAGGER_LIMIT = 3;

  // ------------------------------------------------------------------
  // Pure derivation helpers — no DOM, no AuditOS.state access.
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

  /**
   * The frameworks attached to an engagement, always as an array (identical
   * seam to the Engagement workspace, Coding Standards §30.8 — Composition).
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

  /** The current engagement: identical rule to Home and Engagement, so every surface agrees. */
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

  /** Resolves a session status to a presentation tone. */
  function resolveSessionTone(status) {
    return Object.prototype.hasOwnProperty.call(SESSION_TONES, status) ? SESSION_TONES[status] : TONES.INFO;
  }

  /** The session's scheduled or completed date, whichever is present, formatted. */
  function formatSessionDate(session) {
    var source = session || {};
    return formatDate(source.completedDate || source.scheduledDate);
  }

  /** The session's most relevant date value for chronological sorting (unformatted). */
  function sessionSortDate(session) {
    var source = session || {};
    return source.completedDate || source.scheduledDate || '';
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
    var completed = list.filter(function (session) { return session.status === SESSION_STATUS.COMPLETED; }).length;
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
    var completed = sessionList.filter(function (session) { return session.status === SESSION_STATUS.COMPLETED; }).length;
    var pending = sessionList.length - completed;
    var openQuestions = asArray(questions).filter(function (question) { return question.status !== 'Resolved'; }).length;
    var evidenceLinks = sessionList.reduce(function (total, session) {
      return total + asArray(session.linkedEvidence).length;
    }, 0);
    var team = asArray(teamNames);
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
        status: team.length === 0 ? 'None' : (teamsPending > 0 ? teamsPending + ' Pending' : 'Complete'),
        tone: teamsPending > 0 ? TONES.WARNING : (team.length > 0 ? TONES.SUCCESS : null)
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
    return chain.filter(function (item) { return item.present; }).map(function (item) {
      var workspace = workspaceRegistry.findById(item.id);
      return { title: item.title, meta: item.meta, path: workspace ? workspace.path : null };
    });
  }

  /** Walkthrough history for the Timeline section: session dates, chronological. */
  function deriveTimeline(sessions) {
    return asArray(sessions)
      .filter(function (session) { return Boolean(sessionSortDate(session)); })
      .slice()
      .sort(function (a, b) { return String(sessionSortDate(a)).localeCompare(String(sessionSortDate(b))); })
      .slice(0, LIST_LIMIT)
      .map(function (session) {
        var completedLabel = session.status === SESSION_STATUS.COMPLETED ? 'Completed' : 'Scheduled';
        return { timestamp: formatSessionDate(session), title: completedLabel + ': ' + (session.title || '') };
      });
  }

  /** Recent walkthrough activity for the Activity panel: completed sessions, newest first. */
  function deriveActivity(sessions) {
    return asArray(sessions)
      .filter(function (session) { return session.status === SESSION_STATUS.COMPLETED && session.completedDate; })
      .slice()
      .sort(function (a, b) { return String(b.completedDate).localeCompare(String(a.completedDate)); })
      .slice(0, LIST_LIMIT)
      .map(function (session) {
        return {
          title: 'Session completed: ' + (session.title || ''),
          meta: session.owner ? 'Led by ' + session.owner : '',
          timestamp: formatDate(session.completedDate),
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
  function textSection(title, text, placeholder) {
    return { title: title, kind: 'list', items: [{ title: text || placeholder }] };
  }

  /** One list-valued Inspector section; an empty list renders one placeholder row. */
  function listSection(title, items, placeholder) {
    var list = asArray(items);
    return { title: title, kind: 'list', items: list.length > 0 ? list : [{ title: placeholder }] };
  }

  /**
   * The full Walkthrough Detail for a session (§ Walkthrough Detail): objective,
   * participants, agenda, summary, notes, linked processes / requirements /
   * evidence, and follow-up items. Pure — returns plain Inspector Panel
   * configuration data, no DOM.
   */
  function deriveSessionDetail(session) {
    var source = session || {};
    return {
      eyebrow: source.owner || '',
      title: source.title || '',
      subtitle: [formatSessionDate(source), source.status].filter(Boolean).join(' · '),
      badges: source.status ? [{ label: source.status, tone: resolveSessionTone(source.status) }] : [],
      sections: [
        textSection('Objective', source.objective, 'No objective recorded for this session.'),
        listSection('Participants', asArray(source.participants).map(toNameItem), 'No participants recorded yet.'),
        listSection('Agenda', asArray(source.agenda).map(toTextItem), 'No agenda captured for this session.'),
        textSection('Summary', source.summary, 'No summary recorded yet.'),
        textSection('Notes', source.notes, 'No notes captured for this session.'),
        listSection('Linked processes', asArray(source.linkedProcesses).map(toRefItem), 'No linked processes yet.'),
        listSection('Linked requirements', asArray(source.linkedRequirements).map(toRefItem), 'No linked requirements yet.'),
        listSection('Linked evidence', asArray(source.linkedEvidence).map(toRefItem), 'No linked evidence yet.'),
        listSection('Follow-up items', asArray(source.followUpItems).map(toTextItem), 'No follow-up items recorded.')
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

  /**
   * Collects everything the Walkthrough Workspace presents from the Shared
   * Audit State. Returns null while the state is not ready, and a degraded
   * model when no engagement exists (§15.12).
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
    var pocs = state.listRecords('pocs');

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

    return {
      degraded: false,
      status: status,
      engagement: engagement,
      company: company,
      frameworks: frameworks,
      sessions: sessions,
      processes: processCoverage,
      questions: questions,

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
    var section = el('section', 'aos-section aos-walkthrough__section aos-walkthrough__section--' + id);
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
   * Builds the Audit Health strip: a row of tone-dot indicators (editor
   * status-bar style, identical composition to the Engagement workspace's
   * strip). The status text carries the meaning; the dot only reinforces it.
   */
  function buildAuditHealth(items) {
    var strip = el('div', 'aos-walkthrough__health');
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', 'Walkthrough health');
    asArray(items).forEach(function (item) {
      var node = el('span', 'aos-walkthrough__health-item');
      node.setAttribute('aria-label', item.label + ': ' + item.status);
      var dot = el('span', 'aos-walkthrough__health-dot' + (item.tone ? ' aos-walkthrough__health-dot--' + item.tone : ''));
      dot.setAttribute('aria-hidden', 'true');
      node.appendChild(dot);
      node.appendChild(el('span', 'aos-walkthrough__health-label', item.label));
      node.appendChild(el('span', 'aos-walkthrough__health-status', item.status));
      strip.appendChild(node);
    });
    return strip;
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
    var P = presentation();
    if (asArray(relationships).length === 0) {
      return P.emptyState({
        icon: '◇', title: 'No related objects',
        description: 'The audit domains the walkthrough feeds appear here once they hold data.'
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
        description: 'Completed walkthrough sessions appear here as they are recorded.'
      });
    }
    return P.activityFeed({ events: activity });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    var fragment = global.document.createDocumentFragment();
    asArray(entries).forEach(function (entry) {
      var item = el('span', 'aos-walkthrough-footer__item');
      item.appendChild(el('span', 'aos-walkthrough-footer__label', entry.label));
      item.appendChild(el('span', 'aos-walkthrough-footer__value aos-numeric', entry.value));
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
   * The ordered walkthrough sections (§ Workspace Structure): Audit Health,
   * then the operational sections in the order a team works through them.
   * Each entry names the section id, its header, whether it has data, its
   * body builder, and an empty descriptor used when the data is absent.
   */
  function primarySections(viewModel) {
    return [
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
