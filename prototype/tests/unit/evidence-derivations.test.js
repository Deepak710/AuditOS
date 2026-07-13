'use strict';

/**
 * Unit Tests — Evidence Workspace Derivations (GitHub Issue #39 — Evidence
 * Workspace Consolidation: Evidence is the operational object).
 *
 * Exercises the pure derivation helpers of the rewritten Evidence Workspace
 * with fixture records. The helpers take plain records and return plain view
 * data — no DOM, no AuditOS.state — so these suites verify the business-data
 * bindings deterministically and offline. Every status renders through the
 * canonical Evidence Lifecycle; evidence types carry persistent colors;
 * metrics carry current and projected values. Requirement references remain
 * internal (Issue #39): the workspace exposes no requirement UI.
 *
 * Array.from normalizes vm-sandbox arrays into this realm so strict deepEqual
 * compares structure, not the sandbox Array.prototype (see tests/lib/prototype).
 */

const { loadEvidenceWorkspace } = require('../lib/prototype');

module.exports = function registerUnitTests(harness) {
  const test = harness.test;
  const assert = harness.assert;
  const derive = loadEvidenceWorkspace().derivations;

  // ---- Formatters.

  test('formatDate behaves deterministically', function () {
    assert.equal(derive.formatDate('2027-01-05'), 'Jan 5, 2027');
    assert.equal(derive.formatDate('not-a-date'), 'not-a-date');
    assert.equal(derive.formatDate(undefined), '');
  });

  test('formatPeriod joins a start and end, and degrades to empty when incomplete', function () {
    assert.equal(derive.formatPeriod({ startDate: '2027-01-01', endDate: '2027-12-31' }), 'Jan 1, 2027 – Dec 31, 2027');
    assert.equal(derive.formatPeriod({ startDate: '2027-01-01' }), '');
    assert.equal(derive.formatPeriod(null), '');
  });

  test('normalizeFrameworks wraps the current single-framework shape into an array', function () {
    assert.deepEqual(Array.from(derive.normalizeFrameworks({ framework: 'Alpha' })), ['Alpha']);
    assert.deepEqual(Array.from(derive.normalizeFrameworks({ frameworks: ['A', 'B'] })), ['A', 'B']);
    assert.deepEqual(Array.from(derive.normalizeFrameworks({})), [], 'fabricates nothing when undeclared');
  });

  // ---- Lifecycle tone + evidence-type color, through the canonical services.

  test('resolveReviewTone reads the canonical lifecycle tone, mapping legacy vocabulary', function () {
    assert.equal(derive.resolveReviewTone('Received'), 'success');
    assert.equal(derive.resolveReviewTone('Accepted'), 'success');
    assert.equal(derive.resolveReviewTone('Under Review'), 'info');
    assert.equal(derive.resolveReviewTone('Partially Received'), 'warning');
    assert.equal(derive.resolveReviewTone('Rejected'), 'error');
    assert.equal(derive.resolveReviewTone('All Evidence Received'), 'success', 'legacy vocabulary maps to its canonical tone');
  });

  test('typeColorKey assigns a persistent key per registered type, deterministic for the rest', function () {
    assert.equal(derive.typeColorKey('Configuration'), 'configuration');
    assert.equal(derive.typeColorKey('Documentation'), 'documentation');
    assert.equal(derive.typeColorKey('Population'), 'population');
    assert.equal(derive.typeColorKey(''), 'slate', 'an empty type reads the neutral key');
    assert.equal(derive.typeColorKey('Unregistered'), derive.typeColorKey('Unregistered'),
      'an unregistered type resolves to the same key every time');
  });

  // ---- Reuse normalization — the two dataset shapes into one descriptor.

  test('normalizeReuse reads the same-company reuse shape', function () {
    const reuse = derive.normalizeReuse({ reuse: { eligible: true, sourceEngagementId: 'ENG-2', sourceEvidenceId: 'EVD-1', reuseDecision: 'Reused After Review' } });
    assert.equal(reuse.eligible, true);
    assert.equal(reuse.kind, 'evidence');
    assert.equal(reuse.sourceEngagementId, 'ENG-2');
    assert.equal(reuse.decision, 'Reused After Review');
  });

  test('normalizeReuse reads the cross-company methodology shape', function () {
    const reuse = derive.normalizeReuse({ knowledgeReuse: { methodologyReusable: true, evidenceReusable: false, sourceCompanyId: 'CMP-1', sourceEngagementId: 'ENG-1' } });
    assert.equal(reuse.eligible, true);
    assert.equal(reuse.kind, 'methodology');
    assert.equal(reuse.decision, 'Methodology reusable');
  });

  test('normalizeReuse never fabricates reuse for records that declare none or opt out', function () {
    assert.equal(derive.normalizeReuse({}), null);
    assert.equal(derive.normalizeReuse({ reuse: { eligible: false } }), null);
    assert.equal(derive.normalizeReuse({ knowledgeReuse: { methodologyReusable: false, evidenceReusable: false } }), null);
  });

  test('deriveEvidenceSource names the reuse origin, or a direct upload otherwise', function () {
    assert.equal(derive.deriveEvidenceSource({ reuse: { eligible: true, sourceEngagementId: 'ENG-2' } }), 'Reused from ENG-2');
    assert.equal(derive.deriveEvidenceSource({}), 'Direct upload');
  });

  // ---- Row-level context: control mappings, team, reuse scope.

  function rowContext() {
    return {
      engagement: { id: 'ENG-1' },
      pocsById: { 'POC-1': { id: 'POC-1', name: 'A. Client', teamNames: ['DeliveryOps'] } },
      teamsById: { 'TEAM-1': { id: 'TEAM-1', name: 'Security' } },
      requirementsById: {
        'REQ-1': { id: 'REQ-1', teamId: 'TEAM-1', controlLinks: [{ engagementId: 'ENG-1', controlCode: 'CSC-01' }] }
      },
      controlsById: {},
      controlCodeToId: { 'ENG-1::CSC-01': 'CTL-1' }
    };
  }

  test('deriveControlMappings resolves control codes through the linked requirements, marking same-engagement mappings', function () {
    const mappings = Array.from(derive.deriveControlMappings(
      { id: 'EVD-1', requirementIds: ['REQ-1'] }, rowContext()
    ));
    assert.equal(mappings.length, 1, 'one mapping per distinct linked control');
    assert.equal(mappings[0].code, 'CSC-01');
    assert.equal(mappings[0].controlId, 'CTL-1', 'the code resolves to a control id within the engagement');
    assert.equal(mappings[0].sameEngagement, true, 'a current-engagement control link reads as same engagement');
  });

  test('deriveControlMappings flags a cross-engagement (reused) control mapping and keeps an unresolved code raw', function () {
    const context = rowContext();
    const mappings = Array.from(derive.deriveControlMappings({
      id: 'EVD-2', requirementIds: ['REQ-2']
    }, Object.assign(context, {
      requirementsById: { 'REQ-2': { id: 'REQ-2', controlLinks: [{ engagementId: 'ENG-OTHER', controlCode: 'CSC-99' }] } }
    })));
    assert.equal(mappings[0].sameEngagement, false, 'a control link into another engagement is a reused mapping');
    assert.equal(mappings[0].controlId, null, 'an unresolved code keeps a null control id, never fabricated');
    assert.equal(mappings[0].code, 'CSC-99');
  });

  test('resolveEvidenceTeam resolves the owning team through the linked requirement, falling back to the POC team names', function () {
    const context = rowContext();
    assert.equal(derive.resolveEvidenceTeam({ requirementIds: ['REQ-1'] }, context).team, 'Security',
      'the requirement teamId resolves to the team name');
    assert.equal(derive.resolveEvidenceTeam({ requirementIds: [], uploadedByPocId: 'POC-1' }, context).team, 'DeliveryOps',
      'a record with no requirement team falls back to the uploading POC team names');
  });

  test('deriveReuseScope distinguishes current, multi-engagement, and reused evidence', function () {
    assert.equal(derive.deriveReuseScope({ engagementIds: ['ENG-1'] }).key, 'current');
    assert.equal(derive.deriveReuseScope({ engagementIds: ['ENG-1', 'ENG-2'] }).key, 'partially-reused');
    assert.equal(derive.deriveReuseScope({ reuse: { eligible: true, sourceEngagementId: 'ENG-2' } }).key, 'fully-reused');
  });

  // ---- Evidence rows — the single table dataset.

  test('deriveEvidenceRow resolves owner, team, type, color, status, and control mappings for one record', function () {
    const row = derive.deriveEvidenceRow({
      id: 'EVD-1', title: 'Access Export', evidenceType: 'Population', uploadedByPocId: 'POC-1',
      reviewStatus: 'Received', requirementIds: ['REQ-1'], engagementIds: ['ENG-1']
    }, rowContext());
    assert.equal(row.id, 'EVD-1');
    assert.equal(row.owner, 'A. Client');
    assert.equal(row.team, 'Security');
    assert.equal(row.evidenceType, 'Population');
    assert.equal(row.typeColor, 'population', 'the row carries the persistent type color key');
    assert.equal(row.status, 'Received');
    assert.equal(row.statusTone, 'success');
    assert.equal(row.mappedCount, 1);
    assert.equal(row.reuse.key, 'current');
  });

  test('deriveEvidenceRows renders every record once, ordered by identifier', function () {
    const rows = Array.from(derive.deriveEvidenceRows([
      { id: 'EVD-2', requirementIds: [] }, { id: 'EVD-1', requirementIds: [] }
    ], rowContext()));
    assert.deepEqual(rows.map(function (row) { return row.id; }), ['EVD-1', 'EVD-2'], 'stable identifier order');
  });

  test('collectStatusOptions lists the distinct review statuses present, in lifecycle order', function () {
    const options = Array.from(derive.collectStatusOptions([
      { reviewStatus: 'Received' }, { reviewStatus: 'Partially Received' }, { reviewStatus: 'Received' }
    ]));
    assert.deepEqual(options, ['Partially Received', 'Received'],
      'the options follow the canonical lifecycle order, not the alphabet');
  });

  test('collectRowValues lists the distinct non-empty values of a row field, sorted', function () {
    const values = Array.from(derive.collectRowValues([
      { team: 'Security' }, { team: 'DeliveryOps' }, { team: 'Security' }, { team: '' }
    ], 'team'));
    assert.deepEqual(values, ['DeliveryOps', 'Security']);
  });

  // ---- Pending suggestions + predictive projection.

  function statusSuggestion(evidenceId, proposed, status) {
    return {
      id: 'SUG-' + evidenceId, category: 'evidence-status', status: status || 'Reviewed',
      auditReferences: [evidenceId], applyTarget: { entity: 'evidence', recordId: evidenceId, changes: { reviewStatus: proposed } }
    };
  }

  test('pendingStatusSuggestion finds an in-flight status proposal for a row, ignoring resolved ones', function () {
    const context = { suggestions: [statusSuggestion('E-1', 'Accepted'), statusSuggestion('E-2', 'Accepted', 'Applied')] };
    assert.ok(derive.pendingStatusSuggestion({ id: 'E-1' }, context), 'an un-applied proposal is pending');
    assert.equal(derive.pendingStatusSuggestion({ id: 'E-2' }, context), null, 'an applied proposal is not pending');
    assert.equal(derive.pendingStatusSuggestion({ id: 'E-9' }, context), null, 'a row with no proposal is not pending');
  });

  test('proposedStatusOf reads the proposed status off a status suggestion', function () {
    assert.equal(derive.proposedStatusOf(statusSuggestion('E-1', 'Accepted')), 'Accepted');
    assert.equal(derive.proposedStatusOf(null), '');
  });

  test('deriveProjectedStatus assumes pending approvals accept: proposals land and under-review becomes accepted', function () {
    const context = { suggestions: [statusSuggestion('E-1', 'Closed')] };
    assert.equal(derive.deriveProjectedStatus({ id: 'E-1', status: 'Under Review' }, context), 'Closed',
      'an in-flight proposal lands on its proposed status');
    assert.equal(derive.deriveProjectedStatus({ id: 'E-2', status: 'Under Review' }, { suggestions: [] }), 'Accepted',
      'evidence under review projects to accepted');
    assert.equal(derive.deriveProjectedStatus({ id: 'E-3', status: 'Received' }, { suggestions: [] }), 'Received',
      'a row with nothing pending projects unchanged');
  });

  // ---- KPIs + charts — real counts over the rows, each a filter facet.

  function sampleRows() {
    return [
      { id: 'E-1', status: 'Received', evidenceType: 'Population', mappedCount: 1, reusable: false, reuse: { key: 'current' } },
      { id: 'E-2', status: 'Received', evidenceType: 'Documentation', mappedCount: 0, reusable: true, reuse: { key: 'partially-reused' } },
      { id: 'E-3', status: 'Partially Received', evidenceType: 'Documentation', mappedCount: 2, reusable: false, reuse: { key: 'current' } }
    ];
  }

  test('deriveKpis counts total, in-lifecycle, mapped, reusable, and cross-engagement, each carrying a filter facet', function () {
    const kpis = Array.from(derive.deriveKpis(sampleRows(), { suggestions: [] }));
    assert.deepEqual(kpis.map(function (kpi) { return kpi.label; }),
      ['Evidence', 'In lifecycle', 'Mapped to controls', 'Reusable', 'Cross-engagement']);
    assert.equal(kpis[0].value, '3', 'the total reflects the filtered row count');
    assert.equal(kpis[0].filter, null, 'the total clears every facet');
    assert.equal(kpis[1].value, '1', 'only the Partially Received row is still in a movable lifecycle state');
    assert.equal(kpis[1].filter.field, 'pending');
    assert.equal(kpis[2].value, '2', 'two rows carry at least one control mapping');
    assert.equal(kpis[3].value, '1', 'one row is reusable');
    assert.equal(kpis[4].value, '1', 'one row spans more than the current engagement');
    assert.equal(kpis[2].filter.field, 'mapped');
    assert.equal(kpis[2].filter.value, true);
  });

  test('deriveStatusChart distributes the rows across their review statuses, largest first, each carrying a projected count', function () {
    const chart = Array.from(derive.deriveStatusChart(sampleRows(), { suggestions: [] }));
    assert.equal(chart[0].label, 'Received', 'the largest segment leads');
    assert.equal(chart[0].value, 2);
    assert.equal(chart[0].total, 3);
    assert.equal(chart[0].filter.field, 'status');
    assert.equal(chart[0].filter.value, 'Received');
    assert.equal(chart[0].tone, 'success', 'the segment tone reads from the canonical lifecycle');
    assert.equal(typeof chart[0].projected, 'number', 'a status segment carries a projected count for the ghost overlay');
  });

  test('deriveTypeChart distributes the rows across their evidence types, each an evidenceType facet with no projection', function () {
    const chart = Array.from(derive.deriveTypeChart(sampleRows()));
    assert.equal(chart[0].label, 'Documentation', 'the largest type leads');
    assert.equal(chart[0].value, 2);
    assert.equal(chart[0].filter.field, 'evidenceType');
    assert.equal(chart[0].filter.value, 'Documentation');
    assert.equal(chart[0].projected, null, 'the type chart carries no projection');
  });

  // ---- Inspector configuration — the shared enterprise drawer body.

  function fixtureRegistry() {
    return {
      IDS: { WALKTHROUGH: 'walkthrough', EVIDENCE: 'evidence', CONTROLS: 'controls', TESTING: 'testing', FINDINGS: 'findings', REPORTING: 'reporting' },
      findById: function (id) { return { id: id, path: 'path-' + id }; }
    };
  }

  test('buildEvidenceInspector renders every field with a real value and a placeholder where absent', function () {
    const inspector = derive.buildEvidenceInspector({
      id: 'EVD-1', title: 'Access Export', evidenceType: 'Population',
      uploadedByPocId: 'POC-1', uploadedOn: '2027-01-15', reviewStatus: 'Received',
      requirementIds: ['REQ-1'], engagementIds: ['ENG-1']
    }, Object.assign(rowContext(), {
      workspaceRegistry: fixtureRegistry(), auditPeriodLabel: 'FY2027'
    }));

    assert.equal(inspector.title, 'Access Export');
    assert.equal(inspector.badges[0].label, 'Received');

    const sections = {};
    inspector.sections.forEach(function (section) { sections[section.title] = section; });
    assert.equal(sections['Control mappings'].items[0].title, 'CSC-01', 'a linked control renders its code');
    assert.equal(sections['Properties'].kind, 'properties', 'the drawer leads with a properties grid');
    assert.ok(sections['Folders & links'], 'the drawer surfaces a folders & links section');
    assert.ok(sections['Comments'], 'the drawer surfaces a comments section');
    assert.equal(sections['Related requirements'], undefined,
      'Requirements are internal now — the drawer exposes no requirement section');
  });

  test('buildEvidenceInspector degrades gracefully for a record with almost no fields', function () {
    const inspector = derive.buildEvidenceInspector({ id: 'EVD-9' }, {});
    assert.equal(inspector.badges.length, 0, 'no status yields no badge, never a fabricated one');
    const reuse = inspector.sections.filter(function (section) { return section.title === 'Reuse'; })[0];
    assert.equal(reuse.kind, 'placeholder', 'a record with no reuse renders the reserved reuse placeholder');
  });
};
