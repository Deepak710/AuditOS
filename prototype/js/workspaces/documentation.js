/**
 * AuditOS Documentation Workspace
 * Workspaces and Navigation — Chapter 12 / Workspace Architecture — Chapter 61 /
 * Audit Lifecycle — Chapter 11 / Component Architecture — Chapter 74
 *
 * The operational workspace for the engagement's continuously evolving
 * documentation (GitHub Issue #26). Documentation is not "generated at the
 * end" — every operational workspace contributes to it: Walkthroughs, Evidence,
 * Requirements, Controls, Testing, and Findings all feed the same document.
 * Release 1 is a faithful visualization of the current documentation JSON — no
 * AI, no document generation, no backend, no writes. In Release 2 AI agents
 * will draft documentation, update sections, maintain consistency, identify
 * stale sections, recommend wording, and generate formal reports, every change
 * requiring human approval; this workspace opens those seams without
 * implementing them, rendering only the current documentation state and never
 * fabricating document content or inferring a conclusion.
 *
 * Architecture: Business → ViewModel → Components → DOM, identical to the
 * Engagement, Walkthrough, Evidence, Requirements, Controls, Testing, and
 * Findings workspaces. `collectViewModel` is the single place this workspace
 * reads `AuditOS.state`; it returns a declarative model of pure,
 * offline-testable derivations. The renderer configures the Shared Workspace
 * Framework's inherited skeleton (`AuditOS.workspaceFramework.configure`) and
 * fills its slots with compositions from the Enterprise Data Presentation
 * System (`AuditOS.presentation`) — no bespoke primitives, no duplicated
 * components (Component Design Patterns §81.4 — Composition Over Duplication).
 *
 * Data source: the demo bundle carries no dedicated "documentation" collection.
 * The `reports` collection (engagement-scoped, one document per engagement) is
 * the only JSON that already models a continuously assembled document — titled
 * sections in authored order, each with a `source` (manual / structured /
 * generated / template), `editable` and `included` flags, and a `references`
 * block naming the operational domains the section is built from, plus a
 * document-level title/status/version and a `generation.futureAutomation`
 * contract (AI regeneration, human approval, change tracking, version history).
 * This workspace visualizes that data as the engagement's living documentation
 * record — the same record Release 2's AI-drafted documentation and Release 2's
 * formal report generation will build on — rather than inventing a parallel
 * schema (Architecture rule: Release 1 visualizes the existing JSON).
 *
 * A section's related evidence, controls, testing, and findings resolve to a
 * real, current count only when the section's own `references` block names
 * that domain — never a fabricated relationship — and the count itself is the
 * engagement's real, current figure. Walkthroughs have no registered demo-data
 * collection in this prototype (the Walkthrough Workspace already renders this
 * gap honestly), so "Related walkthroughs" always renders the reserved
 * placeholder — never a fabricated link. A section's current content is never
 * recorded in the JSON, so it always renders the reserved placeholder.
 *
 * The Document Navigator is the primary operational surface: every section for
 * the engagement, rendered once, in the document's authored order (never
 * re-sorted — the order is the table of contents). Selecting a section opens
 * the Documentation Inspector beside it. The inspector renderer is
 * host-agnostic (data in, one self-contained node out) so a later release can
 * mount it in a dedicated region with no change here.
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
   * Document status vocabulary → tone (read, never invented). The demo data
   * uses "Draft" and "Final"; the vocabulary also covers "In Review" and
   * "Approved" so future data reads through the same token-backed tones. An
   * unmapped status resolves to a neutral tone (null).
   */
  var DOC_STATUS_TONES = {
    'Draft': TONES.WARNING,
    'In Review': TONES.WARNING,
    'Needs Review': TONES.WARNING,
    'Approved': TONES.SUCCESS,
    'Final': TONES.SUCCESS,
    'Placeholder — filled as part of report issuance process': null
  };

  /** Section source vocabulary → tone (read, never invented). */
  var SOURCE_TONES = {
    manual: TONES.INFO,
    structured: TONES.INFO,
    generated: TONES.SUCCESS,
    template: TONES.INFO
  };

  /** Human-readable labels for the section source vocabulary. */
  var SOURCE_LABELS = {
    manual: 'Manual',
    structured: 'Structured',
    generated: 'Generated',
    template: 'Template'
  };

  /** Canonical order for the Documentation Health strip's source indicators. */
  var SOURCE_ORDER = ['manual', 'structured', 'generated', 'template'];

  /** Recognized future-automation flags → their display label (read, never invented). */
  var AUTOMATION_LABELS = {
    aiRegeneration: 'AI-assisted regeneration',
    humanApprovalRequired: 'Human approval required',
    trackChanges: 'Change tracking',
    versionHistory: 'Version history',
    crossFrameworkConsistency: 'Cross-framework consistency',
    clientIsolationEnforced: 'Client isolation enforced'
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

  /** The current engagement: identical rule to Home, Engagement, and every operational workspace. */
  var deriveCurrentEngagement = WS.deriveCurrentEngagement;

  /** Resolves a document status to a presentation tone (neutral when unmapped). */
  function resolveDocStatusTone(status) {
    return Object.prototype.hasOwnProperty.call(DOC_STATUS_TONES, status) ? DOC_STATUS_TONES[status] : null;
  }

  /** Resolves a section source to a presentation tone (neutral info when unmapped). */
  function resolveSourceTone(source) {
    var key = source ? String(source).toLowerCase() : '';
    return Object.prototype.hasOwnProperty.call(SOURCE_TONES, key) ? SOURCE_TONES[key] : TONES.INFO;
  }

  /** A human-readable label for a section source, the raw value when unrecognized. */
  function sourceLabel(source) {
    var key = source ? String(source).toLowerCase() : '';
    return SOURCE_LABELS[key] || (source || 'Unspecified');
  }

  /** Orders the keys of a count map by a canonical list, unknown keys alphabetically after. */
  function orderedKeys(counts, order) {
    return Object.keys(counts).sort(function (a, b) {
      var ia = order.indexOf(a);
      var ib = order.indexOf(b);
      if (ia === -1 && ib === -1) { return a.localeCompare(b); }
      if (ia === -1) { return 1; }
      if (ib === -1) { return -1; }
      return ia - ib;
    });
  }

  /**
   * The real, current count for a related domain (`evidence` / `controls` /
   * `testing` / `findings`), resolved only when the section's own `references`
   * block genuinely names that domain — never a fabricated relationship. Returns
   * `null` when the section declares no such reference.
   */
  function resolveRelatedCount(section, key, counts) {
    var refs = section && section.references;
    if (!refs || !refs[key]) {
      return null;
    }
    var value = counts ? counts[key] : null;
    return typeof value === 'number' ? value : null;
  }

  /**
   * One Document Navigator row, resolved to display fields. `included` defaults
   * to true (its absence in the JSON means the section is part of the document);
   * `editable` and the reference keys are read faithfully. The raw section
   * record is carried through for the Inspector.
   */
  function deriveNavigatorRow(section) {
    var source = section || {};
    return {
      id: source.id || '',
      name: source.name || source.id || '',
      section: source,
      source: source.source || '',
      sourceLabel: sourceLabel(source.source),
      sourceTone: resolveSourceTone(source.source),
      included: source.included !== false,
      editable: Boolean(source.editable),
      referenceKeys: source.references ? Object.keys(source.references) : []
    };
  }

  /**
   * The Document Navigator — every section rendered once, in the document's
   * authored order (never re-sorted; the order is the table of contents).
   * Nothing is capped or filtered.
   */
  function deriveNavigator(sections) {
    return asArray(sections).map(deriveNavigatorRow);
  }

  /**
   * The Documentation Health strip — the document's own status when recorded,
   * one indicator per section source actually present (in canonical order),
   * then a derived "Sections included" indicator. Every value is real; an
   * engagement with no documentation yields a single Documentation / None
   * indicator. Never a fabricated count.
   */
  function deriveDocumentationHealth(reportsDocument) {
    var doc = reportsDocument && reportsDocument.document;
    var sections = reportsDocument ? asArray(reportsDocument.sections) : [];
    if (!doc && sections.length === 0) {
      return [{ key: 'documentation', label: 'Documentation', status: 'None', tone: TONES.SUCCESS }];
    }

    var indicators = [];
    if (doc && doc.status) {
      indicators.push({ key: 'status', label: 'Document status', status: doc.status, tone: resolveDocStatusTone(doc.status) });
    }

    var sourceCounts = {};
    sections.forEach(function (section) {
      var key = section && section.source ? String(section.source).toLowerCase() : 'unspecified';
      sourceCounts[key] = (sourceCounts[key] || 0) + 1;
    });
    orderedKeys(sourceCounts, SOURCE_ORDER).forEach(function (key) {
      indicators.push({
        key: 'source-' + key,
        label: sourceLabel(key) + ' sections',
        status: String(sourceCounts[key]),
        tone: resolveSourceTone(key)
      });
    });

    if (sections.length > 0) {
      var included = sections.filter(function (section) { return section && section.included !== false; }).length;
      indicators.push({
        key: 'included',
        label: 'Sections included',
        status: included + ' of ' + sections.length,
        tone: included === sections.length ? TONES.SUCCESS : TONES.WARNING
      });
    }

    return indicators;
  }

  /**
   * The overall documentation status for the header badge: read directly from
   * the document's recorded status. "No documentation" when the engagement
   * holds no report document. Never a fabricated aggregate.
   */
  function deriveDocumentationStatus(reportsDocument) {
    var doc = reportsDocument && reportsDocument.document;
    if (!doc || !doc.status) {
      return { label: 'No documentation', tone: null };
    }
    return { label: doc.status, tone: resolveDocStatusTone(doc.status) };
  }

  /**
   * The Audit Lineage — Walkthrough → Requirement → Control → Evidence →
   * Testing → Finding → Documentation, with Documentation highlighted as the
   * object this workspace owns. Each node carries its real, current count for
   * the engagement and a link into its workspace; nodes with no data read "—"
   * and never a fabricated figure. Only the counts vary with the data; the
   * chain is the audit methodology's real shape.
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
    var documentation = ops.documentation || {};
    var ids = workspaceRegistry.IDS;

    var nodes = [
      { id: ids.WALKTHROUGH, label: 'Walkthrough', count: null, present: false, hint: 'Knowledge acquisition' },
      { id: ids.REQUIREMENTS, label: 'Requirement', count: requirements.requirements || 0, present: (requirements.requirements || 0) > 0, hint: 'What the control satisfies' },
      { id: ids.CONTROLS, label: 'Control', count: controls.controls || 0, present: (controls.controls || 0) > 0, hint: 'What testing validates' },
      { id: ids.EVIDENCE, label: 'Evidence', count: evidence.evidenceItems || 0, present: (evidence.evidenceItems || 0) > 0, hint: 'What testing inspects' },
      { id: ids.TESTING, label: 'Testing', count: testing.tests || 0, present: (testing.tests || 0) > 0, hint: 'Where the finding is surfaced' },
      { id: ids.FINDINGS, label: 'Finding', count: findings.findings || 0, present: (findings.findings || 0) > 0, hint: 'The audit observation' },
      { id: ids.DOCUMENTATION, label: 'Documentation', count: documentation.sections || 0, present: (documentation.sections || 0) > 0, hint: 'The continuously evolving record', highlighted: true }
    ];

    return WS.resolveLineageNodes(workspaceRegistry, nodes);
  }

  /**
   * Related audit objects for the supporting panel: the operational domains
   * documentation draws from, each with its real count, only when data exists.
   * Reuses the same chain the lineage draws from (Documentation is the
   * workspace's own object, so it is not listed as a relation).
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
    var ids = workspaceRegistry.IDS;

    var related = [
      { id: ids.FINDINGS, title: 'Findings', meta: String(findings.findings || 0), present: (findings.findings || 0) > 0 },
      { id: ids.TESTING, title: 'Testing', meta: String(testing.tests || 0), present: (testing.tests || 0) > 0 },
      { id: ids.CONTROLS, title: 'Controls', meta: String(controls.controls || 0), present: (controls.controls || 0) > 0 },
      { id: ids.EVIDENCE, title: 'Evidence', meta: String(evidence.evidenceItems || 0), present: (evidence.evidenceItems || 0) > 0 },
      { id: ids.REQUIREMENTS, title: 'Requirements', meta: String(requirements.requirements || 0), present: (requirements.requirements || 0) > 0 }
    ];
    return WS.resolveRelationships(workspaceRegistry, related);
  }

  /**
   * Section-level change summary, newest first, drawn only from dated change
   * history a section carries (`changeHistory` / `changes`). The current demo
   * documentation records no dated section changes, so this yields an empty
   * list and the shared Empty State — never a generated summary. Release 2's
   * AI-assisted section updates populate this seam.
   */
  function deriveChangeSummary(reportsDocument) {
    var events = [];
    asArray(reportsDocument && reportsDocument.sections).forEach(function (section) {
      var source = section || {};
      asArray(source.changeHistory || source.changes).forEach(function (entry) {
        var date = entry && (entry.date || entry.timestamp || entry.on);
        if (!date) {
          return;
        }
        events.push({
          title: (entry.title || entry.summary || 'Section updated') + ': ' + (source.name || source.id || ''),
          meta: entry.status || '',
          timestamp: formatDate(date),
          date: date,
          tone: entry.tone || TONES.INFO
        });
      });
    });
    return events
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
      .slice(0, LIST_LIMIT);
  }

  /**
   * Recent documentation-related activity, newest first, drawn only from dated
   * history the document carries (a document-level or top-level `activity`
   * list). The current demo documentation records no dated events, so this
   * yields an empty feed and the shared Empty State — never a fabricated event.
   */
  function deriveActivity(reportsDocument) {
    var source = reportsDocument || {};
    var events = [];
    asArray(source.activity || (source.document && source.document.activity)).forEach(function (entry) {
      var date = entry && (entry.date || entry.timestamp || entry.on);
      if (!date) {
        return;
      }
      events.push({
        title: entry.title || entry.action || 'Documentation updated',
        meta: entry.status || '',
        timestamp: formatDate(date),
        date: date,
        tone: entry.tone || TONES.INFO
      });
    });
    return events
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
      .slice(0, LIST_LIMIT);
  }

  /**
   * Documentation metadata: version / status / owner / created / template /
   * report id / render engine, derived from the report document's own metadata,
   * the engagement, and the company. Only fields with real values are surfaced
   * by the builder. No tags are recorded in the current demo documentation.
   */
  function deriveMetadata(reportsDocument, engagement, company) {
    var meta = (reportsDocument && reportsDocument.metadata) || {};
    var doc = (reportsDocument && reportsDocument.document) || {};
    var generation = (reportsDocument && reportsDocument.generation) || {};
    return {
      created: company && company.createdAt ? formatDate(company.createdAt) : '',
      owner: engagement ? (engagement.engagementLead || engagement.auditor || '') : '',
      version: doc.version || '',
      status: doc.status || '',
      tags: [],
      templateId: meta.templateId || '',
      reportId: meta.reportId || '',
      renderEngine: generation.renderEngine || ''
    };
  }

  /**
   * The document's real, recorded future-automation contract — the Release 2
   * seam every AI-assisted documentation change will operate under (AI
   * regeneration, human approval, change tracking, version history,
   * cross-framework consistency, client isolation). Reads only the flags the
   * JSON records; an absent contract yields an empty list and the reserved
   * placeholder — never a fabricated capability.
   */
  function deriveAutomationItems(reportsDocument) {
    var flags = reportsDocument && reportsDocument.generation && reportsDocument.generation.futureAutomation;
    if (!flags || typeof flags !== 'object') {
      return [];
    }
    return Object.keys(flags).map(function (key) {
      var enabled = Boolean(flags[key]);
      var label = AUTOMATION_LABELS[key] || key;
      return { title: label + ': ' + (enabled ? 'Reserved for Release 2' : 'Not configured'), tone: enabled ? TONES.INFO : null };
    });
  }

  // ---- Inspector configuration — pure, host-agnostic (§9). Returns plain
  // Inspector Panel configuration; no DOM. Current content, related objects,
  // and approval history render only when the JSON records them; document
  // text and conclusions are never fabricated.

  /** One text-valued Inspector section rendered as a single placeholder-capable list row. */
  function textSection(title, text, placeholder) {
    return WS.textSection(title, text, placeholder);
  }

  /** One list-valued Inspector section; an empty list renders one placeholder row. */
  function listSection(title, items, placeholder) {
    return WS.listSection(title, items, placeholder);
  }

  /**
   * The Documentation Inspector configuration for one section (Master → Detail
   * detail pane). Renders the section identity, current content, related
   * walkthroughs, evidence, controls, testing, and findings, the automation
   * contract, activity, and approval history — a placeholder row wherever the
   * JSON lacks data, and never a fabricated conclusion. Pure and
   * host-agnostic: data in, one plain configuration out.
   */
  function buildSectionInspector(row, context) {
    var navRow = row || {};
    var section = navRow.section || {};
    var ctx = context || {};
    var doc = ctx.document || {};
    var counts = ctx.counts || {};

    var evidenceCount = resolveRelatedCount(section, 'evidence', counts);
    var controlsCount = resolveRelatedCount(section, 'controls', counts);
    var testingCount = resolveRelatedCount(section, 'testing', counts);
    var findingsCount = resolveRelatedCount(section, 'findings', counts);
    var automationItems = deriveAutomationItems(ctx.reportsDocument);

    return {
      eyebrow: doc.title || 'Documentation section',
      title: section.name || section.id || '',
      subtitle: [section.id, navRow.sourceLabel].filter(Boolean).join(' · '),
      badges: [
        navRow.sourceLabel ? { label: navRow.sourceLabel, tone: navRow.sourceTone } : null,
        navRow.included === false ? { label: 'Excluded', tone: TONES.WARNING } : null,
        navRow.editable ? { label: 'Editable', tone: TONES.INFO } : null
      ].filter(Boolean),
      sections: [
        {
          title: 'Properties', kind: 'properties', columns: 2,
          rows: [
            { label: 'Section id', value: section.id || '' },
            { label: 'Source', value: navRow.sourceLabel || '' },
            { label: 'Included', value: navRow.included ? 'Yes' : 'No' },
            { label: 'Editable', value: navRow.editable ? 'Yes' : 'No' },
            { label: 'Document version', value: doc.version || '' },
            { label: 'Document status', value: doc.status || '' },
            { label: 'Framework', value: (ctx.frameworks && ctx.frameworks[0]) || '' },
            { label: 'Report id', value: (ctx.metadata && ctx.metadata.reportId) || '' }
          ].filter(function (r) { return r.value; })
        },
        textSection('Current content', '', 'No content recorded. Release 1 renders documentation structure only; Release 2 adds AI-drafted section content for human approval.'),
        listSection('Related walkthroughs', [], 'No related walkthrough recorded. Release 2 traces walkthrough knowledge into documentation sections.'),
        listSection('Related evidence',
          evidenceCount !== null ? [{ title: evidenceCount + ' evidence item(s) for the engagement', tone: TONES.INFO }] : [],
          'No related evidence recorded for this section.'),
        listSection('Related controls',
          controlsCount !== null ? [{ title: controlsCount + ' control(s) for the engagement', tone: TONES.INFO }] : [],
          'No related control recorded for this section.'),
        listSection('Related testing',
          testingCount !== null ? [{ title: testingCount + ' test(s) for the engagement', tone: TONES.INFO }] : [],
          'No related testing recorded for this section.'),
        listSection('Related findings',
          findingsCount !== null ? [{ title: findingsCount + ' finding(s) for the engagement', tone: TONES.INFO }] : [],
          'No related finding recorded for this section.'),
        automationItems.length > 0
          ? { title: 'Automation & governance', kind: 'list', items: automationItems }
          : {
            title: 'Automation & governance', kind: 'placeholder',
            empty: {
              icon: '◇', title: 'No automation configuration recorded',
              description: 'Release 2 records the AI regeneration, approval, and version-history contract here.'
            }
          },
        {
          title: 'Activity', kind: 'placeholder',
          empty: {
            icon: '◇', title: 'No activity recorded',
            description: 'Release 1 renders a section activity trail only when the JSON records one. Release 2 adds AI-assisted documentation activity here.'
          }
        },
        {
          title: 'Approval history', kind: 'placeholder',
          empty: {
            icon: '◇', title: 'No approval history recorded',
            description: 'Release 1 records no approval history. Release 2 routes every AI-drafted section change through human approval and records it here.'
          }
        }
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

  /**
   * Collects everything the Documentation Workspace presents from the Shared
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

    var reportsDocument = readEngagementDocument(state, 'reports', engagement.id) || {};
    var controlsDocument = readEngagementDocument(state, 'controls', engagement.id) || {};
    var requirementsDocument = readEngagementDocument(state, 'evidence-requirements', engagement.id) || {};
    var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
    var testingDocument = readEngagementDocument(state, 'testing', engagement.id) || {};
    var findingsDocument = readEngagementDocument(state, 'findings', engagement.id) || {};

    var sections = asArray(reportsDocument.sections);
    var findingRecords = asArray(findingsDocument.findings);

    var frameworks = normalizeFrameworks(engagement);
    var auditPeriodLabel = formatPeriod(engagement.auditPeriod);

    var counts = {
      evidence: (evidenceDocument.summary && evidenceDocument.summary.evidenceItems) || 0,
      controls: asArray(controlsDocument.controls).length,
      testing: asArray(testingDocument.tests).length,
      findings: findingRecords.length,
      requirements: asArray(requirementsDocument.requirements).length
    };

    var context = {
      document: reportsDocument.document || {},
      reportsDocument: reportsDocument,
      metadata: reportsDocument.metadata || {},
      counts: counts,
      frameworks: frameworks,
      auditPeriodLabel: auditPeriodLabel,
      engagement: engagement,
      company: company
    };

    var operational = {
      requirements: { requirements: counts.requirements },
      controls: { controls: counts.controls },
      evidence: { evidenceItems: counts.evidence },
      testing: { tests: counts.testing },
      findings: { findings: counts.findings },
      documentation: { sections: sections.length }
    };

    var navigator = deriveNavigator(sections);
    var documentationStatus = deriveDocumentationStatus(reportsDocument);

    return {
      degraded: false,
      status: status,
      engagement: engagement,
      company: company,
      frameworks: frameworks,
      context: context,

      header: {
        eyebrow: engagement.engagementCode + ' · Documentation',
        title: company ? company.name : engagement.companyId,
        meta: engagement.name + ' · continuous documentation',
        frameworks: frameworks,
        status: documentationStatus,
        lastUpdated: '',
        actions: [{ label: 'Engagement overview', href: '#/engagements', variant: 'subtle' }]
      },

      ribbon: [
        { label: 'Client', value: company ? company.name : engagement.companyId },
        { label: 'Audit period', value: auditPeriodLabel },
        { label: 'Sections', value: String(sections.length) }
      ],

      toolbar: { search: { placeholder: 'Search documentation sections' } },
      filterBar: {
        dropdowns: [{ label: 'Framework', options: ['All frameworks'].concat(frameworks) }]
      },

      health: deriveDocumentationHealth(reportsDocument),
      navigator: navigator,
      changeSummary: deriveChangeSummary(reportsDocument),
      lineage: deriveLineage(workspaceRegistry, operational),
      relationships: deriveRelationships(workspaceRegistry, operational),
      activity: deriveActivity(reportsDocument),
      metadata: deriveMetadata(reportsDocument, engagement, company),

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
    return WS.buildSection('aos-documentation', id, meta, bodyNode);
  }

  /**
   * Builds the Documentation Health strip: a row of tone-dot indicators (editor
   * status-bar style, identical composition to the other operational
   * workspaces). The status text carries the meaning; the dot only reinforces
   * the tone, so health reads without relying on color.
   */
  function buildHealthStrip(items) {
    return WS.buildHealthStrip('aos-documentation', 'Documentation health', items);
  }

  /** Builds one Document Navigator row: the section title + id, its source badge, and reference summary. */
  function buildRow(row) {
    var P = presentation();
    var node = el('button', null);
    node.type = 'button';

    var head = el('div', 'aos-documentation__row-head');
    var identity = el('div', 'aos-documentation__row-identity');
    if (row.id) {
      identity.appendChild(el('span', 'aos-documentation__row-code aos-numeric', row.id));
    }
    identity.appendChild(el('span', 'aos-documentation__row-title', row.name || row.id));
    head.appendChild(identity);
    if (row.sourceLabel) {
      head.appendChild(P.statusBadge({ label: row.sourceLabel, tone: row.sourceTone }));
    }
    node.appendChild(head);

    var meta = el('div', 'aos-documentation__row-meta');
    if (row.included === false) {
      meta.appendChild(el('span', 'aos-documentation__row-flag', 'Excluded'));
    }
    if (row.referenceKeys.length > 0) {
      meta.appendChild(el('span', 'aos-documentation__row-refs', row.referenceKeys.join(' · ')));
    }
    node.appendChild(meta);
    return node;
  }

  /** Renders the navigator rows into a master list node and wires selection to the detail mount. */
  function mountRail(listNode, detailMount, rows, context) {
    WS.mountRailGroups('aos-documentation', listNode, detailMount, [{ label: '', rows: rows }], context, buildRow, buildSectionInspector, null);
  }

  /**
   * Host-agnostic Inspector renderer (§9): given the Document Navigator rows and
   * the resolution context, returns one self-contained Master–Detail node — the
   * navigator rail beside the Documentation Inspector — making no assumption
   * about where it is mounted. Release 1 mounts this directly in the primary
   * content; a later release can mount the same renderer in any other host with
   * no change here.
   */
  function renderInspector(rows, context) {
    var detailMount = el('div', 'aos-documentation__detail-mount');
    var listNode = el('div', 'aos-documentation__row-list');
    listNode.setAttribute('role', 'list');
    mountRail(listNode, detailMount, rows, context);
    return presentation().masterDetail({
      list: listNode, detail: detailMount, ratio: 38,
      listLabel: 'Document navigator', detailLabel: 'Documentation inspector'
    });
  }

  /**
   * Builds the Audit Lineage body: the methodology chain rendered as connected
   * nodes with Documentation highlighted. Each node shows its real count and
   * links into its workspace; absent nodes read "—". The chain reads
   * left-to-right on wide canvases and stacks on narrow ones (stylesheet).
   */
  function buildLineageBody(lineage) {
    return WS.buildLineageBody('aos-documentation', lineage);
  }

  /** Builds the Change Summary body: the shared Activity Feed over dated section changes. */
  function buildChangeSummaryBody(changeSummary) {
    return WS.buildActivityBody(changeSummary, {
      icon: '◇', title: 'No changes recorded',
      description: 'Section-level revisions appear here as the documentation evolves. Release 2 adds AI-drafted section changes, each requiring human approval, and records them here.'
    });
  }

  /** Builds the Metadata body: the shared Metadata List of presentation fields. */
  function buildMetadataBody(metadata) {
    var pairs = [
      { term: 'Version', detail: metadata.version },
      { term: 'Status', detail: metadata.status },
      { term: 'Owner', detail: metadata.owner },
      { term: 'Created', detail: metadata.created },
      { term: 'Template', detail: metadata.templateId },
      { term: 'Report id', detail: metadata.reportId },
      { term: 'Render engine', detail: metadata.renderEngine },
      { term: 'Tags', detail: asArray(metadata.tags).join(' · ') }
    ];
    return WS.metadataBody(pairs);
  }

  /** Builds the Related information supporting panel body: related audit objects with navigation. */
  function buildRelatedBody(relationships) {
    return WS.buildRelatedBody(relationships, {
      icon: '◇', title: 'No related objects',
      description: 'The audit domains documentation draws from appear here once they hold data.'
    });
  }

  /** Builds the Activity Feed for the activity supporting panel. */
  function buildActivityBody(activity) {
    return WS.buildActivityBody(activity, {
      icon: '◇', title: 'No recent activity',
      description: 'Documentation updates, reviews, and section changes appear here as the engagement progresses.'
    });
  }

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(entries) {
    return WS.buildFooterItems('aos-documentation', entries);
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Returns a framework slot inside the active workspace view. */
  var slotElement = WS.slotElement;

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /**
   * The ordered documentation sections (§ Workspace Structure): operational
   * health, the Document Navigator with the Documentation Inspector, the change
   * summary, the audit lineage, then the documentation metadata. Each entry
   * names the section id, its header, whether it has data, its body builder,
   * and an empty descriptor used when the data is absent (§ Empty States).
   */
  function primarySections(viewModel) {
    var context = viewModel.context;
    return [
      {
        id: 'health', kicker: 'Operational status', title: 'Documentation health',
        present: true, body: function () { return buildHealthStrip(viewModel.health); }
      },
      {
        id: 'navigator', kicker: 'Primary navigation', title: 'Document navigator',
        description: 'Every documentation section for the engagement, in document order. Select a section to open its Inspector, with the related walkthroughs, evidence, controls, testing, and findings.',
        present: viewModel.navigator.length > 0,
        body: function () { return renderInspector(viewModel.navigator, context); },
        empty: {
          icon: '◇', title: 'No documentation sections yet',
          description: 'Documentation sections appear here as the engagement produces operational knowledge. Release 2 adds AI-drafted sections and continuous updates; Release 1 renders only the current documentation state.'
        }
      },
      {
        id: 'change-summary', kicker: 'Change tracking', title: 'Change summary',
        description: 'Section-level revisions recorded for the engagement. Only from JSON — no generated summaries.',
        present: viewModel.changeSummary.length > 0,
        body: function () { return buildChangeSummaryBody(viewModel.changeSummary); },
        empty: {
          icon: '◇', title: 'No changes recorded',
          description: 'Section-level revisions appear here as the documentation evolves.'
        }
      },
      {
        id: 'lineage', kicker: 'Relationships', title: 'Audit lineage',
        description: 'Where documentation sits in the audit chain, from walkthrough through to the continuously evolving record.',
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

  /** Renders the ready documentation experience into the framework slots. */
  function renderReady(view, viewModel) {
    var P = presentation();

    AuditOS.workspaceFramework.configure(view, {
      header: viewModel.header,
      contextSummary: viewModel.ribbon,
      toolbar: viewModel.toolbar,
      filterBar: viewModel.filterBar
    });

    var canvas = el('div', 'aos-documentation');
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
      description: 'AI-assisted documentation — drafted sections, section updates, consistency checks, stale-section detection, and recommended wording — will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
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
    fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'detail', label: 'Loading documentation' })]);
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
        '. Regenerate the demo-data bundle and reload to restore the Documentation Workspace.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * Renders the Documentation Workspace when it is the active workspace: the
   * ready experience once the state has loaded, the loading skeleton before
   * that, and the degraded explanation when no engagement is available.
   */
  function renderActiveDocumentation() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.DOCUMENTATION) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.DOCUMENTATION + '"]'
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

  AuditOS.documentationWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      formatDate: formatDate,
      formatPeriod: formatPeriod,
      normalizeFrameworks: normalizeFrameworks,
      deriveCurrentEngagement: deriveCurrentEngagement,
      resolveDocStatusTone: resolveDocStatusTone,
      resolveSourceTone: resolveSourceTone,
      sourceLabel: sourceLabel,
      resolveRelatedCount: resolveRelatedCount,
      deriveNavigatorRow: deriveNavigatorRow,
      deriveNavigator: deriveNavigator,
      deriveDocumentationHealth: deriveDocumentationHealth,
      deriveDocumentationStatus: deriveDocumentationStatus,
      deriveLineage: deriveLineage,
      deriveRelationships: deriveRelationships,
      deriveChangeSummary: deriveChangeSummary,
      deriveActivity: deriveActivity,
      deriveMetadata: deriveMetadata,
      deriveAutomationItems: deriveAutomationItems,
      buildSectionInspector: buildSectionInspector
    },

    collectViewModel: collectViewModel,

    // Host-agnostic Inspector renderer (§9): data → one self-contained node,
    // mountable in any host. Release 1 mounts it directly in primary content.
    renderInspector: renderInspector,

    /**
     * Binds the Documentation Workspace to the router and the Shared Audit
     * State. Safe to call once, after the DOM is ready, the router has
     * resolved the initial route, and the framework has rendered its skeleton
     * (script order guarantees the framework's route listener runs first).
     * Does nothing when the routing or state foundations are absent, so the
     * shell degrades rather than throwing.
     */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }

      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveDocumentation);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveDocumentation);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveDocumentation);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveDocumentation);
      }
      renderActiveDocumentation();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.documentationWorkspace.init);
    } else {
      AuditOS.documentationWorkspace.init();
    }
  }
})(window);
