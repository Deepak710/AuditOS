/**
 * AuditOS Workpaper Service
 * AI Workpaper Foundation — GitHub Issue #40 §3 / §4 / §5 / §6 / §10 / §11
 *
 * The single place the generated audit workpaper exists as a model. Testing is
 * no longer a queue of test rows: it is the generated workpaper for a selected
 * control, and this service is the one implementation that derives it. The
 * Testing workspace renders this model, the HTML workpaper writes this model,
 * and the workbook export serializes this model — one structure, three
 * consumers, no second definition of what a workpaper is.
 *
 * Structure (Issue #40 §3, mirroring the CSC-01 workbook the issue names as the
 * structural template — Title Sheet, Population IPE, Random File, WT Test
 * Sheet, OE Test Sheet):
 *
 *   Overview · Control description · Walkthrough summary · Testing objective ·
 *   Testing procedure · Population · Evidence references · Attributes ·
 *   Exceptions · Conclusion · Reviewer notes · Approval
 *
 * Every section except AI provenance is editable (§3). Editability is declared
 * here as a property of the section, so the renderer never decides it and the
 * export never has to re-derive it.
 *
 * Honesty contract. The demo datasets already carry the workpaper shape —
 * `walkthroughTest` (procedure, attributes, steps, conclusion), `oeTest`
 * (applicability, sampling method, population, sample size, samples, design and
 * operating effectiveness, issue description), preparer and reviewer ids, and
 * the date the test was performed. This service reads those recorded facts and
 * nothing else: a section with no recorded data returns `present: false` with
 * its reserved placeholder, never invented prose, never an invented sample,
 * never an invented conclusion.
 *
 * AI provenance (§4). Every generated block declares what it was generated
 * from — walkthrough sessions, evidence, control metadata, AI rationale — and
 * each source is present only where a real join or a real declaration exists.
 * The object-level lineage is NOT re-implemented here: it comes from the
 * canonical AI Lineage Service (`AuditOS.aiLineage`), the same one Evidence and
 * Controls use (§10 — Testing inherits the AI-generated object model).
 *
 * Status (§11). Testing declares no status model of its own. The recorded
 * status label always renders verbatim; its phase, tone, and lifecycle order
 * come from the canonical lifecycle (`AuditOS.evidenceLifecycle`).
 *
 * Pure: no DOM, no `AuditOS.state`, no writes. Everything is derived from the
 * records passed in, so the offline suites exercise it directly. Depends on
 * nothing in components/, keeping the js → components boundary one-way. Loaded
 * as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Presentation tones (mirrors the shared tone vocabulary). */
  var TONES = { INFO: 'info', SUCCESS: 'success', WARNING: 'warning', ERROR: 'error' };

  /**
   * The canonical provenance sources (§4). A generated block declares which of
   * these it was generated from; a source with no recorded backing is returned
   * with `present: false` and no items rather than an invented justification.
   */
  var SOURCES = {
    WALKTHROUGH: 'Walkthrough sessions',
    EVIDENCE: 'Evidence',
    CONTROL: 'Control metadata',
    RATIONALE: 'AI rationale'
  };

  /**
   * The canonical worksheet sections, in order (§3). `editable` is the §3 rule
   * — every section is editable except AI provenance, which is not a section
   * but an attachment to each section — declared once here so the renderer and
   * the export agree without either deciding it.
   */
  var SECTIONS = [
    { id: 'overview',            title: 'Overview',            editable: true },
    { id: 'control-description', title: 'Control description', editable: true },
    { id: 'walkthrough-summary', title: 'Walkthrough summary', editable: true },
    { id: 'testing-objective',   title: 'Testing objective',   editable: true },
    { id: 'testing-procedure',   title: 'Testing procedure',   editable: true },
    { id: 'population',          title: 'Population',          editable: true },
    { id: 'evidence-references', title: 'Evidence references', editable: true },
    { id: 'attributes',          title: 'Attributes',          editable: true },
    { id: 'exceptions',          title: 'Exceptions',          editable: true },
    { id: 'conclusion',          title: 'Conclusion',          editable: true },
    { id: 'reviewer-notes',      title: 'Reviewer notes',      editable: true },
    { id: 'approval',            title: 'Approval',            editable: true }
  ];

  /** The canonical lifecycle, resolved at call time so load order stays flexible. */
  function lifecycle() {
    return AuditOS.evidenceLifecycle || null;
  }

  /** The canonical AI Lineage Service, resolved at call time. */
  function lineageService() {
    return AuditOS.aiLineage || null;
  }

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** A trimmed string, or '' for any non-string / empty value. */
  function text(value) {
    return typeof value === 'string' ? value.trim() : (value === 0 ? '0' : '');
  }

  /** The first recorded value among the named fields of a record, else ''. */
  function firstText(record, fields) {
    var source = record || {};
    for (var index = 0; index < fields.length; index += 1) {
      var value = text(source[fields[index]]);
      if (value) {
        return value;
      }
    }
    return '';
  }

  /** Resolves a record's display name from an id map, falling back to the raw id. */
  function resolveName(map, id, field) {
    if (!id) {
      return '';
    }
    var record = map ? map[id] : null;
    if (!record) {
      return String(id);
    }
    return text(record[field || 'name']) || String(id);
  }

  /** One provenance source descriptor. */
  function source(label, present, items) {
    return { label: label, present: Boolean(present), items: asArray(items) };
  }

  // ------------------------------------------------------------------
  // Provenance (§4) — what each generated block was generated from. Derived
  // only from real declarations and real joins.
  // ------------------------------------------------------------------

  /**
   * The walkthrough sessions that genuinely relate to a control: the sessions
   * whose `requirementIds` intersect the control's own `requirementIds`. A
   * control declaring no requirements, or an engagement recording no sessions,
   * yields an empty list — the relationship is never inferred from titles,
   * dates, or proximity.
   */
  function relatedWalkthroughSessions(control, context) {
    var ctx = context || {};
    var requirementIds = asArray(control && control.requirementIds);
    if (requirementIds.length === 0) {
      return [];
    }
    return asArray(ctx.walkthroughSessions).filter(function (session) {
      return asArray(session && session.requirementIds).some(function (id) {
        return requirementIds.indexOf(id) !== -1;
      });
    });
  }

  /**
   * The evidence a control resolves to, as full rows (§7 — every evidence item,
   * not a count). The join is the one the dataset actually declares:
   * control → `requirementIds` → requirement → `linkedEvidenceIds` → evidence.
   * A requirement that resolves but links no evidence still contributes its own
   * row, because an outstanding requirement is a real, current fact about the
   * control's evidence coverage; an id that resolves to nothing renders as
   * itself rather than being hidden.
   */
  function deriveEvidenceRows(control, context) {
    var ctx = context || {};
    var model = lifecycle();
    var rows = [];
    var seen = {};

    asArray(control && control.requirementIds).forEach(function (requirementId) {
      var requirement = ctx.requirementsById ? ctx.requirementsById[requirementId] : null;
      var evidenceIds = asArray(requirement && requirement.linkedEvidenceIds);

      if (!requirement) {
        if (!seen[requirementId]) {
          seen[requirementId] = true;
          rows.push({
            id: requirementId, requirementId: requirementId, title: '',
            status: '', statusTone: null, phase: '', owner: '', ownerId: '',
            evidenceType: '', resolved: false
          });
        }
        return;
      }

      if (evidenceIds.length === 0) {
        if (seen[requirementId]) {
          return;
        }
        seen[requirementId] = true;
        rows.push({
          id: requirementId,
          requirementId: requirementId,
          title: text(requirement.title),
          status: text(requirement.status),
          statusTone: model ? model.toneOf(requirement.status) : null,
          phase: model ? model.phaseOf(requirement.status) : '',
          owner: resolveName(ctx.pocsById, requirement.primaryPocId, 'name'),
          ownerId: text(requirement.primaryPocId),
          evidenceType: text(requirement.evidenceType),
          resolved: false
        });
        return;
      }

      evidenceIds.forEach(function (evidenceId) {
        if (seen[evidenceId]) {
          return;
        }
        seen[evidenceId] = true;
        var evidence = ctx.evidenceById ? ctx.evidenceById[evidenceId] : null;
        var status = evidence ? text(evidence.reviewStatus) : text(requirement.status);
        var ownerId = (evidence && text(evidence.uploadedByPocId)) || text(requirement.primaryPocId);
        rows.push({
          id: evidenceId,
          requirementId: requirementId,
          title: (evidence && text(evidence.title)) || text(requirement.title),
          status: status,
          statusTone: model ? model.toneOf(status) : null,
          phase: model ? model.phaseOf(status) : '',
          owner: resolveName(ctx.pocsById, ownerId, 'name'),
          ownerId: ownerId,
          evidenceType: (evidence && text(evidence.evidenceType)) || text(requirement.evidenceType),
          resolved: Boolean(evidence)
        });
      });
    });

    return rows;
  }

  /**
   * The provenance of one section (§4): the sources it was generated from,
   * each present only where the data genuinely backs it. `declaredSources`
   * names which of the canonical sources this section can draw on at all; a
   * section that cannot draw on a source never lists it.
   */
  function buildProvenance(declaredSources, control, test, context) {
    var ctx = context || {};
    var sessions = relatedWalkthroughSessions(control, ctx);
    var evidenceRows = deriveEvidenceRows(control, ctx);
    var lineageDeclaration = (test && (test.aiLineage || test.origin)) ||
      (control && (control.aiLineage || control.origin)) || {};
    var rationale = text(lineageDeclaration.reasoning);

    var available = {};
    available[SOURCES.WALKTHROUGH] = source(SOURCES.WALKTHROUGH, sessions.length > 0,
      sessions.map(function (session) {
        return { title: text(session.title) || text(session.id), detail: text(session.date) };
      }));
    available[SOURCES.EVIDENCE] = source(SOURCES.EVIDENCE, evidenceRows.length > 0,
      evidenceRows.map(function (row) {
        return { title: row.title || row.id, detail: [row.evidenceType, row.status].filter(Boolean).join(' · ') };
      }));
    available[SOURCES.CONTROL] = source(SOURCES.CONTROL, Boolean(control && control.id),
      control && control.id
        ? [{ title: text(control.controlCode) || text(control.id), detail: text(control.title) }]
        : []);
    available[SOURCES.RATIONALE] = source(SOURCES.RATIONALE, Boolean(rationale),
      rationale
        ? [{ title: rationale, detail: text(lineageDeclaration.confidence) ? 'Confidence: ' + text(lineageDeclaration.confidence) : '' }]
        : []);

    return asArray(declaredSources).map(function (label) {
      return available[label] || source(label, false, []);
    });
  }

  // ------------------------------------------------------------------
  // Section builders — each returns one declarative section. A section with no
  // recorded data carries `present: false` and its reserved placeholder.
  // ------------------------------------------------------------------

  /** Formats a `{ startDate, endDate }` audit period as `start – end`. */
  function formatPeriod(period) {
    var source = period || {};
    var start = text(source.startDate);
    var end = text(source.endDate);
    if (!start && !end) {
      return '';
    }
    return [start, end].filter(Boolean).join(' – ');
  }

  /** The Overview section — the workbook's Title Sheet, read from the engagement and the control. */
  function overviewSection(control, test, context) {
    var ctx = context || {};
    var engagement = ctx.engagement || {};
    var company = ctx.company || null;
    var rows = [
      { label: 'Client name', value: company ? text(company.name) : text(engagement.companyId) },
      { label: 'Project name', value: text(engagement.name) },
      { label: 'Engagement code', value: text(engagement.engagementCode) },
      // Locations and systems are recorded as lists whose members contain
      // commas ("Bengaluru, India"); joining on a comma would read as one
      // longer list, so they join on a newline exactly as the workbook does.
      { label: 'In scope locations', value: asArray(engagement.inScopeLocations).join('\n') },
      { label: 'In scope systems', value: asArray(engagement.inScopeSystems).join('\n') },
      { label: 'Audit period', value: formatPeriod(engagement.auditPeriod) },
      { label: 'Criteria number', value: asArray(control && control.criteriaIds).join(', ') },
      { label: 'Control number', value: text(control && control.controlCode) || text(control && control.id) },
      { label: 'Control family', value: text(control && control.family) },
      { label: 'Control frequency', value: text(test && test.controlFrequency) || text(control && control.frequency) },
      {
        label: 'Point in time control (OE not applicable)',
        value: (test && test.pointInTime === true) || (control && control.pointInTime === true) ? 'Yes'
          : ((test && test.pointInTime === false) || (control && control.pointInTime === false) ? 'No' : '')
      },
      { label: 'Workpaper reference', value: text(test && test.id) }
    ].filter(function (row) { return row.value; });

    return {
      kind: 'properties', rows: rows, present: rows.length > 0,
      sources: [SOURCES.CONTROL],
      empty: {
        icon: '◇', title: 'No engagement context recorded',
        description: 'The workpaper title sheet reads the client, project, scope, period, and control identity from the engagement and the control record.'
      }
    };
  }

  /** The Control description section — the control's own recorded description. */
  function controlDescriptionSection(control) {
    var body = firstText(control, ['descriptionText', 'description']);
    return {
      kind: 'text', text: body, present: Boolean(body),
      sources: [SOURCES.CONTROL, SOURCES.RATIONALE],
      empty: {
        icon: '◇', title: 'No control description recorded',
        description: 'The workpaper renders the control description the control record carries. Release 2 drafts it from the walkthrough where the record has none.'
      }
    };
  }

  /**
   * The Walkthrough summary section — the recorded walkthrough steps and the
   * sessions that genuinely relate to the control. Never a narrative summary
   * the data does not contain.
   */
  function walkthroughSummarySection(control, test, context) {
    var walkthrough = (test && test.walkthroughTest) || {};
    var steps = text(walkthrough.steps);
    var sessions = relatedWalkthroughSessions(control, context);
    var items = sessions.map(function (session) {
      return {
        title: text(session.title) || text(session.id),
        description: [text(session.date), text(session.source)].filter(Boolean).join(' · ')
      };
    });
    return {
      kind: 'narrative', text: steps, items: items,
      present: Boolean(steps) || items.length > 0,
      sources: [SOURCES.WALKTHROUGH, SOURCES.CONTROL],
      empty: {
        icon: '◇', title: 'No walkthrough recorded',
        description: 'The walkthrough steps performed and the sessions the control was discussed in appear here once the walkthrough records them.'
      }
    };
  }

  /**
   * The Testing objective section. The objective is what the test sets out to
   * establish; where the record states one it renders verbatim, and where it
   * does not the section stays empty rather than restating the procedure as
   * though it were an objective.
   */
  function testingObjectiveSection(control, test) {
    var body = firstText(test, ['objective', 'testObjective']) ||
      firstText(control, ['objective', 'testingObjective']);
    return {
      kind: 'text', text: body, present: Boolean(body),
      sources: [SOURCES.CONTROL, SOURCES.RATIONALE],
      empty: {
        icon: '◇', title: 'No testing objective recorded',
        description: 'The objective the test establishes appears here when the record states one. Release 2 drafts it from the control objective and the walkthrough.'
      }
    };
  }

  /** The Testing procedure section — the procedure the workpaper records. */
  function testingProcedureSection(control, test) {
    var walkthrough = (test && test.walkthroughTest) || {};
    var body = text(walkthrough.procedure) ||
      firstText(test, ['testProcedure', 'procedure']) ||
      firstText(control, ['testProcedure']);
    return {
      kind: 'text', text: body, present: Boolean(body),
      sources: [SOURCES.CONTROL, SOURCES.WALKTHROUGH, SOURCES.RATIONALE],
      empty: {
        icon: '◇', title: 'No test procedure recorded',
        description: 'The procedure performed appears here when the workpaper records one. Release 2 drafts procedures from the control and the walkthrough.'
      }
    };
  }

  /**
   * The Population section — the workbook's Population IPE and Random File
   * sheets. A point-in-time control records that operating-effectiveness
   * testing does not apply, with the reason it does not; that is a real,
   * recorded fact and renders as such rather than as missing data.
   */
  function populationSection(test) {
    var oe = (test && test.oeTest) || {};
    var applicable = oe.applicable === true;
    var rows = [
      { label: 'Operating effectiveness testing', value: oe.applicable === undefined ? '' : (applicable ? 'Applicable' : 'Not applicable') },
      { label: 'Reason', value: text(oe.reason) },
      { label: 'Sampling method', value: text(oe.samplingMethod) },
      { label: 'Population', value: text(oe.populationRef) },
      { label: 'Sample size', value: oe.sampleSize === null || oe.sampleSize === undefined ? '' : String(oe.sampleSize) },
      { label: 'Samples recorded', value: asArray(oe.samples).length > 0 ? String(asArray(oe.samples).length) : '' }
    ].filter(function (row) { return row.value; });

    return {
      kind: 'properties', rows: rows, present: rows.length > 0,
      notApplicable: oe.applicable === false,
      sources: [SOURCES.EVIDENCE, SOURCES.CONTROL],
      empty: {
        icon: '◇', title: 'No population recorded',
        description: 'The population, sampling method, and sample size appear here when the workpaper records operating-effectiveness testing.'
      }
    };
  }

  /**
   * The Evidence references section (§7) — every evidence item the control
   * resolves to as its own row, with status, owner, type, and lifecycle phase.
   * Never a count.
   */
  function evidenceReferencesSection(control, context) {
    var rows = deriveEvidenceRows(control, context);
    return {
      kind: 'evidence', rows: rows, present: rows.length > 0,
      sources: [SOURCES.EVIDENCE, SOURCES.CONTROL],
      empty: {
        icon: '◇', title: 'No evidence linked to this control',
        description: 'Evidence reaches a control through the requirements it declares. This control declares none that resolve to evidence yet.'
      }
    };
  }

  /**
   * The Attributes section — the tested attributes and their recorded results.
   * The workbook records results as tickmarks (P = Pass, O = Fail); a sample
   * that records no tickmark for an attribute renders blank, never assumed.
   */
  function attributesSection(test) {
    var walkthrough = (test && test.walkthroughTest) || {};
    var oe = (test && test.oeTest) || {};
    var attributes = asArray(walkthrough.attributes);
    if (attributes.length === 0) {
      attributes = asArray(oe.attributes);
    }
    var rows = attributes.map(function (attribute, index) {
      var entry = attribute || {};
      return {
        key: text(entry.key) || String.fromCharCode(65 + index),
        text: text(entry.text) || text(entry.description),
        result: text(entry.result)
      };
    }).filter(function (row) { return row.text; });

    return {
      kind: 'attributes', rows: rows, present: rows.length > 0,
      samples: asArray(oe.samples),
      sources: [SOURCES.WALKTHROUGH, SOURCES.CONTROL],
      empty: {
        icon: '◇', title: 'No attributes recorded',
        description: 'The attributes the test evaluates appear here when the workpaper records them.'
      }
    };
  }

  /**
   * The Exceptions section — the deviations the workpaper records and the
   * finding they raised, where a `findingId` genuinely joins. "No deviations
   * noted" is itself a recorded conclusion and renders as one; an empty
   * section means the workpaper recorded nothing either way.
   */
  function exceptionsSection(test, context) {
    var ctx = context || {};
    var oe = (test && test.oeTest) || {};
    var issue = text(oe.issueDescription);
    var finding = test && test.findingId && ctx.findingsById ? ctx.findingsById[test.findingId] : null;
    var failed = text(test && test.result) === 'Fail';
    var items = [];
    if (issue) {
      items.push({ title: issue, description: '', tone: TONES.ERROR });
    }
    if (finding) {
      items.push({
        title: text(finding.title) || text(finding.id),
        description: [text(finding.severity), text(finding.status)].filter(Boolean).join(' · '),
        tone: TONES.ERROR,
        findingId: text(finding.id)
      });
    } else if (test && text(test.findingId)) {
      items.push({ title: text(test.findingId), description: '', tone: TONES.ERROR, findingId: text(test.findingId) });
    }
    if (items.length === 0 && failed) {
      items.push({ title: text(test.actualResult) || 'Exception identified', description: '', tone: TONES.ERROR });
    }

    return {
      kind: 'list', items: items, present: items.length > 0,
      clear: items.length === 0 && Boolean(test && text(test.result) === 'Pass'),
      sources: [SOURCES.EVIDENCE, SOURCES.WALKTHROUGH],
      empty: {
        icon: '✓', title: 'No deviations recorded',
        description: 'Exceptions appear here as testing surfaces them, each linked to the finding it raised. Nothing is recorded as an exception that the workpaper does not record.'
      }
    };
  }

  /**
   * The Conclusion section — the design and operating effectiveness the
   * workpaper records, and the conclusion text it states.
   */
  function conclusionSection(test) {
    var oe = (test && test.oeTest) || {};
    var walkthrough = (test && test.walkthroughTest) || {};
    var rows = [
      { label: 'Design effectiveness', value: text(oe.designEffectiveness) },
      { label: 'Operating effectiveness', value: text(oe.operatingEffectiveness) },
      { label: 'Result', value: text(test && test.result) }
    ].filter(function (row) { return row.value; });
    var body = firstText(test, ['conclusion']) || text(walkthrough.conclusion);

    return {
      kind: 'conclusion', rows: rows, text: body,
      present: rows.length > 0 || Boolean(body),
      sources: [SOURCES.EVIDENCE, SOURCES.WALKTHROUGH, SOURCES.RATIONALE],
      empty: {
        icon: '◇', title: 'No conclusion recorded',
        description: 'The design and operating effectiveness conclusions appear here once the workpaper records them. A conclusion is never inferred from a result.'
      }
    };
  }

  /** The Reviewer notes section — the notes the workpaper records, never a drafted note. */
  function reviewerNotesSection(test) {
    var body = firstText(test, ['reviewerNotes', 'notes', 'reviewNotes']);
    return {
      kind: 'text', text: body, present: Boolean(body),
      sources: [SOURCES.RATIONALE],
      empty: {
        icon: '◇', title: 'No reviewer notes recorded',
        description: 'Reviewer notes are captured against the workpaper during review. Release 1 renders only the notes the record carries.'
      }
    };
  }

  /**
   * The Approval section — the preparer, the date the test was performed, and
   * the reviewers, resolved to recorded names where their identifiers join.
   * The workpaper status renders verbatim; its phase and tone come from the
   * canonical lifecycle (§11).
   */
  function approvalSection(test, context) {
    var ctx = context || {};
    var model = lifecycle();
    var status = text(test && (test.testingStatus || test.status));
    var rows = [
      { label: 'Preparer', value: resolveName(ctx.usersById, test && test.preparerId, 'name') || text(test && test.testedBy) },
      { label: 'Test performed on', value: text(test && test.testPerformedOn) },
      { label: 'Reviewer 1', value: resolveName(ctx.usersById, test && test.reviewer1Id, 'name') },
      { label: 'Reviewer 2', value: resolveName(ctx.usersById, test && test.reviewer2Id, 'name') },
      { label: 'Recorded reviewers', value: text(test && test.reviewedBy) },
      { label: 'Workpaper status', value: status },
      { label: 'Lifecycle phase', value: model && status ? model.phaseOf(status) : '' }
    ].filter(function (row) { return row.value; });

    return {
      kind: 'properties', rows: rows, present: rows.length > 0,
      sources: [SOURCES.CONTROL],
      empty: {
        icon: '◇', title: 'No approval recorded',
        description: 'The preparer, the date performed, and the reviewers appear here once the workpaper records them.'
      }
    };
  }

  /** The section builders, keyed by canonical section id. */
  var BUILDERS = {
    'overview': function (control, test, context) { return overviewSection(control, test, context); },
    'control-description': function (control) { return controlDescriptionSection(control); },
    'walkthrough-summary': function (control, test, context) { return walkthroughSummarySection(control, test, context); },
    'testing-objective': function (control, test) { return testingObjectiveSection(control, test); },
    'testing-procedure': function (control, test) { return testingProcedureSection(control, test); },
    'population': function (control, test) { return populationSection(test); },
    'evidence-references': function (control, test, context) { return evidenceReferencesSection(control, context); },
    'attributes': function (control, test) { return attributesSection(test); },
    'exceptions': function (control, test, context) { return exceptionsSection(test, context); },
    'conclusion': function (control, test) { return conclusionSection(test); },
    'reviewer-notes': function (control, test) { return reviewerNotesSection(test); },
    'approval': function (control, test, context) { return approvalSection(test, context); }
  };

  AuditOS.workpaperService = {
    SECTIONS: SECTIONS,
    SOURCES: SOURCES,

    deriveEvidenceRows: deriveEvidenceRows,
    relatedWalkthroughSessions: relatedWalkthroughSessions,
    buildProvenance: buildProvenance,
    formatPeriod: formatPeriod,

    /**
     * The canonical status of a workpaper: the recorded label verbatim, with
     * the phase, tone, and lifecycle order read from the canonical lifecycle
     * (§11 — Testing declares no status model of its own). A workpaper with
     * no recorded status reads empty rather than a fabricated default.
     */
    deriveStatus: function (test) {
      var model = lifecycle();
      var label = text(test && (test.testingStatus || test.status));
      if (!label) {
        return { label: '', tone: null, phase: '', order: -1, pending: false };
      }
      return {
        label: label,
        tone: model ? model.toneOf(label) : null,
        phase: model ? model.phaseOf(label) : '',
        order: model ? model.orderOf(label) : -1,
        pending: model ? model.isPending(label) : false
      };
    },

    /**
     * Builds the complete workpaper for one control. `test` is the workpaper
     * record the engagement holds for that control, or null where none exists
     * yet — in which case every section that reads the workpaper is empty and
     * the control-sourced sections still render, which is the honest state of
     * an untested control.
     *
     * Every section is returned in canonical order with its declared
     * editability, its content, its provenance (§4), and its reserved
     * placeholder. The object-level AI lineage comes from the canonical AI
     * Lineage Service — this service never re-implements it (§10).
     */
    buildWorkpaper: function (control, test, context) {
      var ctx = context || {};
      var service = lineageService();
      var subject = test || control || {};

      var sections = SECTIONS.map(function (descriptor) {
        var built = BUILDERS[descriptor.id](control, test, ctx);
        return {
          id: descriptor.id,
          title: descriptor.title,
          editable: descriptor.editable,
          kind: built.kind,
          present: built.present,
          text: built.text || '',
          rows: asArray(built.rows),
          items: asArray(built.items),
          samples: asArray(built.samples),
          notApplicable: Boolean(built.notApplicable),
          clear: Boolean(built.clear),
          empty: built.empty,
          provenance: buildProvenance(built.sources, control, test, ctx)
        };
      });

      return {
        controlId: text(control && control.id),
        controlCode: text(control && control.controlCode) || text(control && control.id),
        title: text(control && control.title),
        workpaperId: text(test && test.id),
        engagementId: text(ctx.engagement && ctx.engagement.id),
        status: AuditOS.workpaperService.deriveStatus(test),
        generated: Boolean(test),
        sections: sections,
        // §10 — Testing inherits the AI-generated object model: the lineage is
        // the canonical service's, not a second implementation.
        lineage: service ? service.buildLineage(subject, {
          collectionId: 'testing',
          objectLabel: text(control && control.title) || text(subject.id)
        }) : null,
        isAiGenerated: service ? service.isAiGenerated(subject) : false
      };
    }
  };
})(window);
