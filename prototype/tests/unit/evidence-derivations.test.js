'use strict';

/**
 * Unit Tests — Evidence Workspace Derivations (GitHub Issue #38 — engagement
 * Evidence workspace: one filterable enterprise table).
 *
 * Exercises the pure derivation helpers of the Evidence Workspace with fixture
 * records (GitHub Issue #21 — Testing / Unit Tests). The helpers take plain
 * records and return plain view data — no DOM, no AuditOS.state — so these
 * suites verify the business-data bindings deterministically and offline.
 * Fixtures mirror the demo shapes (evidence → requirements → controlLinks, and
 * the two reuse shapes) without embedding demo business content, so the
 * workspace's central Release 1 promise — render only what exists, resolve
 * names only when identifiers genuinely join, fabricate nothing — is asserted
 * directly.
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

  // ---- Frameworks + current engagement (identical seam to the other workspaces).

  test('normalizeFrameworks wraps the current single-framework shape into an array', function () {
    assert.deepEqual(Array.from(derive.normalizeFrameworks({ framework: 'Alpha' })), ['Alpha']);
    assert.deepEqual(Array.from(derive.normalizeFrameworks({ frameworks: ['A', 'B'] })), ['A', 'B']);
    assert.deepEqual(Array.from(derive.normalizeFrameworks({})), [], 'fabricates nothing when undeclared');
  });

  test('deriveCurrentEngagement prefers the first in-progress engagement, then falls back', function () {
    assert.equal(derive.deriveCurrentEngagement([
      { id: 'E-0', status: 'Completed' },
      { id: 'E-1', status: 'In Progress' }
    ]).id, 'E-1');
    assert.equal(derive.deriveCurrentEngagement([{ id: 'E-9', status: 'Planning' }]).id, 'E-9', 'falls back to the first');
    assert.equal(derive.deriveCurrentEngagement([]), null);
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

  test('deriveEvidenceRow resolves owner, team, type, status, and control mappings for one record', function () {
    const row = derive.deriveEvidenceRow({
      id: 'EVD-1', title: 'Access Export', evidenceType: 'Population', uploadedByPocId: 'POC-1',
      reviewStatus: 'All Evidence Received', requirementIds: ['REQ-1'], engagementIds: ['ENG-1']
    }, rowContext());
    assert.equal(row.id, 'EVD-1');
    assert.equal(row.owner, 'A. Client');
    assert.equal(row.team, 'Security');
    assert.equal(row.evidenceType, 'Population');
    assert.equal(row.status, 'All Evidence Received');
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

  test('collectStatusOptions lists the distinct review statuses present, sorted', function () {
    const options = Array.from(derive.collectStatusOptions([
      { reviewStatus: 'Evidence Partially Received' }, { reviewStatus: 'All Evidence Received' }, { reviewStatus: 'All Evidence Received' }
    ]));
    assert.deepEqual(options, ['All Evidence Received', 'Evidence Partially Received']);
  });

  // ---- KPIs + charts — real counts over the rows, each a filter facet.

  function sampleRows() {
    return [
      { id: 'E-1', status: 'All Evidence Received', evidenceType: 'Population', mappedCount: 1, reusable: false, reuse: { key: 'current' } },
      { id: 'E-2', status: 'All Evidence Received', evidenceType: 'Documentation', mappedCount: 0, reusable: true, reuse: { key: 'partially-reused' } },
      { id: 'E-3', status: 'Evidence Partially Received', evidenceType: 'Documentation', mappedCount: 2, reusable: false, reuse: { key: 'current' } }
    ];
  }

  test('deriveKpis counts total, mapped, reusable, and cross-engagement, each carrying a filter facet', function () {
    const kpis = Array.from(derive.deriveKpis(sampleRows()));
    assert.deepEqual(kpis.map(function (kpi) { return kpi.label; }), ['Evidence', 'Mapped to controls', 'Reusable', 'Cross-engagement']);
    assert.equal(kpis[0].value, '3', 'the total reflects the filtered row count');
    assert.equal(kpis[0].filter, null, 'the total clears every facet');
    assert.equal(kpis[1].value, '2', 'two rows carry at least one control mapping');
    assert.equal(kpis[2].value, '1', 'one row is reusable');
    assert.equal(kpis[3].value, '1', 'one row spans more than the current engagement');
    assert.equal(kpis[1].filter.field, 'mapped');
    assert.equal(kpis[1].filter.value, true);
  });

  test('deriveStatusChart distributes the rows across their review statuses, largest first, each a status facet', function () {
    const chart = Array.from(derive.deriveStatusChart(sampleRows()));
    assert.equal(chart[0].label, 'All Evidence Received', 'the largest segment leads');
    assert.equal(chart[0].value, 2);
    assert.equal(chart[0].total, 3);
    assert.equal(chart[0].filter.field, 'status');
    assert.equal(chart[0].filter.value, 'All Evidence Received');
    assert.equal(chart[0].tone, 'success', 'the segment tone reads from the status vocabulary');
  });

  test('deriveTypeChart distributes the rows across their evidence types, each an evidenceType facet', function () {
    const chart = Array.from(derive.deriveTypeChart(sampleRows()));
    assert.equal(chart[0].label, 'Documentation', 'the largest type leads');
    assert.equal(chart[0].value, 2);
    assert.equal(chart[0].filter.field, 'evidenceType');
    assert.equal(chart[0].filter.value, 'Documentation');
  });

  // ---- Relationships, activity, metadata, collection status.

  function fixtureRegistry() {
    return {
      IDS: { WALKTHROUGH: 'walkthrough', REQUIREMENTS: 'requirements', EVIDENCE: 'evidence', CONTROLS: 'controls', TESTING: 'testing', FINDINGS: 'findings', REPORTING: 'reporting' },
      findById: function (id) { return { id: id, path: 'path-' + id }; }
    };
  }

  test('deriveRelationships lists only the domains with real data', function () {
    const relationships = Array.from(derive.deriveRelationships(fixtureRegistry(), {
      requirements: { requirements: 104 }, controls: { controls: 52 }, testing: {}, findings: {}, report: null
    }));
    assert.deepEqual(relationships.map(function (item) { return item.title; }), ['Requirements', 'Controls']);
    assert.equal(relationships[0].path, 'path-requirements', 'requirements links into the Requirements workspace');
  });

  test('deriveActivity lists dated evidence receipts and request submissions, newest first', function () {
    const activity = Array.from(derive.deriveActivity(
      [
        { id: 'E-1', title: 'Older.pdf', uploadedOn: '2027-01-01', reviewStatus: 'Approved' },
        { id: 'E-2', title: 'Undated' }
      ],
      [{ id: 'R-1', submittedOn: '2027-02-01', reviewStatus: 'Pending Review' }]
    ));
    assert.equal(activity.length, 2, 'undated records never appear');
    assert.match(activity[0].title, /request R-1/, 'the newest event leads');
    assert.match(activity[1].title, /Older\.pdf/);
  });

  test('deriveMetadata reads document metadata, collecting the real tags present', function () {
    const metadata = derive.deriveMetadata(
      { version: '2.0.0', dataset: 'Demo Evidence', generatedAt: '2027-01-01T00:00:00Z' },
      { engagementLead: 'Lead Auditor' },
      { createdAt: '2026-01-01' },
      [{ tags: ['soc2', 'shared'] }, { tags: ['soc2'] }]
    );
    assert.equal(metadata.version, '2.0.0');
    assert.equal(metadata.source, 'Demo Evidence');
    assert.equal(metadata.owner, 'Lead Auditor');
    assert.deepEqual(Array.from(metadata.tags), ['soc2', 'shared'], 'tags are the distinct real tags on the records');
  });

  test('deriveCollectionStatus reads awaiting / collecting / complete faithfully', function () {
    assert.equal(derive.deriveCollectionStatus([]).label, 'Awaiting');
    assert.equal(derive.deriveCollectionStatus([{ reviewStatus: 'Evidence Partially Received' }]).label, 'Collecting');
    assert.equal(derive.deriveCollectionStatus([{ reviewStatus: 'All Evidence Received' }]).label, 'Complete');
  });

  // ---- Inspector configuration — the shared enterprise drawer body.

  test('buildEvidenceInspector renders every field with a real value and a placeholder where absent', function () {
    const inspector = derive.buildEvidenceInspector({
      id: 'EVD-1', title: 'Access Export', evidenceType: 'Population',
      uploadedByPocId: 'POC-1', uploadedOn: '2027-01-15', reviewStatus: 'All Evidence Received',
      requirementIds: ['REQ-1'], engagementIds: ['ENG-1']
    }, Object.assign(rowContext(), {
      workspaceRegistry: fixtureRegistry(), auditPeriodLabel: 'FY2027'
    }));

    assert.equal(inspector.title, 'Access Export');
    assert.equal(inspector.badges[0].label, 'All Evidence Received');

    const sections = {};
    inspector.sections.forEach(function (section) { sections[section.title] = section; });
    assert.equal(sections['Control mappings'].items[0].title, 'CSC-01', 'a linked control renders its code');
    assert.equal(sections['Related requirements'].items[0].title, 'REQ-1', 'a non-joining requirement renders its raw id');
    assert.equal(sections['Approval status'].items[0].title, 'All Evidence Received');
    assert.ok(sections['Folders & links'], 'the drawer surfaces a folders & links section');
    assert.ok(sections['Comments'], 'the drawer surfaces a comments section');
  });

  test('buildEvidenceInspector degrades gracefully for a record with almost no fields', function () {
    const inspector = derive.buildEvidenceInspector({ id: 'EVD-9' }, {});
    assert.equal(inspector.badges.length, 0, 'no status yields no badge, never a fabricated one');
    const reuse = inspector.sections.filter(function (section) { return section.title === 'Reuse'; })[0];
    assert.equal(reuse.kind, 'placeholder', 'a record with no reuse renders the reserved reuse placeholder');
  });
};
