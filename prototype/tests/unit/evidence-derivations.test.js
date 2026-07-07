'use strict';

/**
 * Unit Tests — Evidence Workspace Derivations
 *
 * Exercises the pure derivation helpers of the Evidence Workspace with fixture
 * records (GitHub Issue #21 — Testing / Unit Tests). The helpers take plain
 * records and return plain view data — no DOM, no AuditOS.state — so these
 * suites verify the business-data bindings deterministically and offline.
 * Fixtures mirror the two reuse shapes the evidence datasets carry (`reuse` and
 * `knowledgeReuse`) without embedding demo business content, so the workspace's
 * central Release 1 promise — render only what exists, resolve names only when
 * identifiers genuinely join, fabricate nothing — is asserted directly.
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

  // ---- Evidence health — the operational strip.

  test('deriveEvidenceHealth reads six indicators from the summary, counting records as a fallback', function () {
    const health = Array.from(derive.deriveEvidenceHealth(
      { approved: 12, pendingReview: 6, rejected: 2 },
      { pending: 7, submitted: 6 },
      [
        { reviewStatus: 'Approved', reuse: { eligible: true, sourceEngagementId: 'ENG-2' } },
        { reviewStatus: 'Pending Review' }
      ],
      []
    ));
    assert.deepEqual(health.map(function (item) { return item.label; }), [
      'Pending requests', 'Submitted', 'Approved', 'Rejected', 'Reusable evidence', 'Outstanding approvals'
    ]);
    assert.equal(health[0].status, '7', 'pending requests read from the request summary');
    assert.equal(health[2].status, '12', 'approved reads from the evidence summary');
    assert.equal(health[4].status, '1', 'reusable evidence is counted from the records, never fabricated');
    assert.equal(health[5].status, '6', 'outstanding approvals read pendingReview');
    assert.equal(health[5].tone, 'warning');
  });

  test('deriveEvidenceHealth reads an empty engagement as None / Clear, never a fabricated number', function () {
    const health = Array.from(derive.deriveEvidenceHealth({}, {}, [], []));
    assert.equal(health[0].status, 'None');
    assert.equal(health[3].status, 'None');
    assert.equal(health[5].status, 'Clear', 'no pending review reads Clear, toned success');
    assert.equal(health[5].tone, 'success');
  });

  // ---- Outstanding queue — the primary operational surface.

  function outstandingContext() {
    return {
      requirementsById: { 'REQ-1': { id: 'REQ-1', title: 'Access Review' } },
      pocsById: { 'POC-1': { id: 'POC-1', name: 'A. Client' } },
      teamsById: { 'TEAM-1': { id: 'TEAM-1', name: 'Security' } },
      businessUnitsById: { 'BU-1': { id: 'BU-1', name: 'InfoSec' } }
    };
  }

  test('deriveOutstanding lists every non-accepted request, earliest due first, resolving names where they join', function () {
    const outstanding = Array.from(derive.deriveOutstanding([
      { id: 'R-2', requirementId: 'REQ-1', assignedToPocId: 'POC-1', teamId: 'TEAM-1', businessUnitId: 'BU-1', dueDate: '2027-02-01', status: 'Submitted', priority: 'High' },
      { id: 'R-1', requirementId: 'REQ-1', assignedToPocId: 'POC-1', dueDate: '2027-01-01', status: 'Pending', priority: 'Medium' },
      { id: 'R-3', requirementId: 'REQ-1', dueDate: '2027-03-01', status: 'Accepted', priority: 'Low' }
    ], outstandingContext()));

    assert.deepEqual(outstanding.map(function (row) { return row.id; }), ['R-1', 'R-2'], 'accepted requests are excluded and rows sort by due date');
    assert.equal(outstanding[0].requirement, 'Access Review', 'a joining requirement id resolves to its title');
    assert.equal(outstanding[0].requestedFrom, 'A. Client');
    assert.equal(outstanding[1].owner, 'Security');
    assert.equal(outstanding[1].businessUnit, 'InfoSec');
    assert.equal(outstanding[1].statusTone, 'info');
  });

  test('deriveOutstanding renders raw identifiers when they do not join, never a fabricated label', function () {
    const outstanding = Array.from(derive.deriveOutstanding([
      { id: 'R-1', requirementId: 'REQ-UNKNOWN', assignedToPocId: 'POC-UNKNOWN', status: 'Pending' }
    ], outstandingContext()));
    assert.equal(outstanding[0].requirement, 'REQ-UNKNOWN', 'an unresolved requirement renders its raw id');
    assert.equal(outstanding[0].requestedFrom, 'POC-UNKNOWN');
  });

  // ---- Library.

  test('deriveLibrary maps every evidence record to display fields, newest first', function () {
    const library = Array.from(derive.deriveLibrary([
      { id: 'E-1', title: 'Older.pdf', fileType: 'PDF', uploadedByPocId: 'POC-1', uploadedOn: '2027-01-01', reviewStatus: 'Approved' },
      { id: 'E-2', title: 'Newer.csv', fileType: 'CSV', uploadedOn: '2027-02-01', reviewStatus: 'Pending Review', reuse: { eligible: true, sourceEngagementId: 'ENG-2' } }
    ], { pocsById: { 'POC-1': { id: 'POC-1', name: 'A. Client' } }, auditPeriodLabel: 'FY2027' }));

    assert.deepEqual(library.map(function (row) { return row.id; }), ['E-2', 'E-1'], 'sorted newest updated first');
    assert.equal(library[1].owner, 'A. Client');
    assert.equal(library[1].category, 'PDF');
    assert.equal(library[1].auditPeriod, 'FY2027');
    assert.equal(library[0].source, 'Reused from ENG-2');
    assert.equal(library[0].reusable, true);
    assert.equal(library[1].reusable, false);
  });

  test('deriveLibraryStatuses lists the distinct review statuses present, in first-seen order', function () {
    const statuses = Array.from(derive.deriveLibraryStatuses([
      { status: 'Approved' }, { status: 'Pending Review' }, { status: 'Approved' }
    ]));
    assert.deepEqual(statuses, ['Approved', 'Pending Review']);
  });

  // ---- Reuse — renders only what the JSON declares.

  test('deriveReuse surfaces only records that declare reuse, and nothing when none do', function () {
    const reuse = Array.from(derive.deriveReuse([
      { id: 'E-1', title: 'Reused.pdf', reuse: { eligible: true, sourceEngagementId: 'ENG-2', sourceEvidenceId: 'EVD-9', reuseDecision: 'Reused After Review' } },
      { id: 'E-2', title: 'Fresh.pdf' }
    ]));
    assert.equal(reuse.length, 1, 'only the record declaring reuse appears');
    assert.equal(reuse[0].title, 'Reused.pdf');
    assert.equal(reuse[0].source, 'ENG-2 · EVD-9');
    assert.deepEqual(Array.from(derive.deriveReuse([{ id: 'E-2' }])), [], 'no declared reuse yields an empty list, never a derived relationship');
  });

  // ---- Audit lineage — the methodology chain with Evidence highlighted.

  function fixtureRegistry() {
    return {
      IDS: { WALKTHROUGH: 'walkthrough', EVIDENCE: 'evidence', CONTROLS: 'controls', TESTING: 'testing', FINDINGS: 'findings', REPORTING: 'reporting' },
      findById: function (id) { return { id: id, path: 'path-' + id }; }
    };
  }

  test('deriveLineage renders the full chain with Evidence highlighted and real counts', function () {
    const lineage = Array.from(derive.deriveLineage(fixtureRegistry(), {
      requirements: { requirements: 104 }, controls: { controls: 52 }, evidence: { evidenceItems: 20 },
      testing: { tests: 30 }, findings: { findings: 3 }, report: { status: 'Draft' }
    }));
    assert.deepEqual(lineage.map(function (node) { return node.label; }), [
      'Walkthrough', 'Requirement', 'Control', 'Evidence', 'Testing', 'Finding', 'Report'
    ]);
    const evidenceNode = lineage.filter(function (node) { return node.label === 'Evidence'; })[0];
    assert.equal(evidenceNode.highlighted, true, 'the Evidence node is highlighted');
    assert.equal(evidenceNode.count, 20);
    assert.equal(lineage[0].present, false, 'walkthrough carries no data and is never fabricated');
    assert.equal(derive.deriveLineage(null, {}).length, 0, 'no registry yields no lineage');
  });

  // ---- Relationships, activity, metadata, collection status.

  test('deriveRelationships lists only the domains with real data', function () {
    const relationships = Array.from(derive.deriveRelationships(fixtureRegistry(), {
      requirements: { requirements: 104 }, controls: { controls: 52 }, testing: {}, findings: {}, report: null
    }));
    assert.deepEqual(relationships.map(function (item) { return item.title; }), ['Requirements', 'Controls']);
    assert.equal(relationships[0].path, 'path-evidence');
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
    assert.equal(derive.deriveCollectionStatus({}, []).label, 'Awaiting');
    assert.equal(derive.deriveCollectionStatus({ evidenceItems: 3 }, [{ status: 'Pending' }]).label, 'Collecting');
    assert.equal(derive.deriveCollectionStatus({ evidenceItems: 3 }, [{ status: 'Accepted' }]).label, 'Complete');
  });

  // ---- Inspector configurations — Master → Detail detail panes.

  test('buildEvidenceInspector renders every field with a real value and a placeholder where absent', function () {
    const inspector = derive.buildEvidenceInspector({
      id: 'EVD-1', title: 'Access Export.csv', fileName: 'Access Export.csv', fileType: 'CSV', version: '1.0',
      uploadedByPocId: 'POC-1', uploadedOn: '2027-01-15', reviewStatus: 'Approved',
      linkedRequirementIds: ['REQ-1'], linkedControlIds: ['ENGCTRL-9']
    }, {
      pocsById: { 'POC-1': { id: 'POC-1', name: 'A. Client' } },
      requirementsById: { 'REQ-1': { id: 'REQ-1', title: 'Access Review' } },
      controlsById: {}, auditPeriodLabel: 'FY2027'
    });

    assert.equal(inspector.title, 'Access Export.csv');
    assert.equal(inspector.badges[0].label, 'Approved');

    const sections = {};
    inspector.sections.forEach(function (section) { sections[section.title] = section; });
    assert.equal(sections['Related requirements'].items[0].title, 'Access Review', 'a joining requirement resolves to its title');
    assert.equal(sections['Related controls'].items[0].title, 'ENGCTRL-9', 'a non-joining control renders its raw id, never fabricated');
    assert.equal(sections['Related walkthroughs'].items[0].title, 'No linked walkthroughs yet — walkthrough linkage arrives with the walkthrough collection.');
    assert.equal(sections['Approval history'].items[0].title, 'Approved');
  });

  test('buildEvidenceInspector degrades gracefully for a record with almost no fields', function () {
    const inspector = derive.buildEvidenceInspector({ id: 'EVD-9' }, {});
    assert.equal(inspector.badges.length, 0, 'no status yields no badge, never a fabricated one');
    const reuse = inspector.sections.filter(function (section) { return section.title === 'Reuse'; })[0];
    assert.equal(reuse.kind, 'placeholder', 'a record with no reuse renders the reserved reuse placeholder');
  });

  test('buildRequestInspector renders the request detail, resolving names where they join', function () {
    const inspector = derive.buildRequestInspector({
      id: 'R-1', requirementId: 'REQ-1', assignedToPocId: 'POC-1', teamId: 'TEAM-1', businessUnitId: 'BU-1',
      requestedOn: '2027-01-02', dueDate: '2027-01-09', status: 'Pending', priority: 'High', linkedControlIds: ['ENGCTRL-1']
    }, {
      requirementsById: { 'REQ-1': { id: 'REQ-1', title: 'Access Review' } },
      pocsById: { 'POC-1': { id: 'POC-1', name: 'A. Client' } },
      teamsById: { 'TEAM-1': { id: 'TEAM-1', name: 'Security' } },
      businessUnitsById: { 'BU-1': { id: 'BU-1', name: 'InfoSec' } }, controlsById: {}
    });
    assert.equal(inspector.title, 'Access Review');
    assert.equal(inspector.badges[0].label, 'Pending');
    assert.equal(inspector.badges[1].label, 'High priority');
    const props = inspector.sections[0].rows.reduce(function (acc, row) { acc[row.label] = row.value; return acc; }, {});
    assert.equal(props['Requested from'], 'A. Client');
    assert.equal(props['Business unit'], 'InfoSec');
  });
};
