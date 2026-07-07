'use strict';

/**
 * Unit Tests — Requirements Workspace Derivations
 *
 * Exercises the pure derivation helpers of the Requirements Workspace with
 * fixture records (GitHub Issue #22 — Testing / Unit Tests). The helpers take
 * plain records and return plain view data — no DOM, no AuditOS.state — so these
 * suites verify the business-data bindings deterministically and offline.
 * Fixtures mirror the two requirement shapes the demo datasets carry (a
 * single-control shape and a multi-control shape) without embedding demo
 * business content, so the workspace's central Release 1 promise — render only
 * what exists, resolve names only when identifiers genuinely join, fabricate
 * nothing, infer no relationships — is asserted directly. The three presentation
 * views are asserted to regroup one dataset without changing it.
 *
 * Array.from normalizes vm-sandbox arrays into this realm so strict deepEqual
 * compares structure, not the sandbox Array.prototype (see tests/lib/prototype).
 */

const { loadRequirementsWorkspace } = require('../lib/prototype');

module.exports = function registerUnitTests(harness) {
  const test = harness.test;
  const assert = harness.assert;
  const derive = loadRequirementsWorkspace().derivations;

  // ---- Formatters + frameworks + current engagement (identical seam to the other workspaces).

  test('formatDate behaves deterministically', function () {
    assert.equal(derive.formatDate('2026-03-09'), 'Mar 9, 2026');
    assert.equal(derive.formatDate('not-a-date'), 'not-a-date');
    assert.equal(derive.formatDate(undefined), '');
  });

  test('formatPeriod joins a start and end, and degrades to empty when incomplete', function () {
    assert.equal(derive.formatPeriod({ startDate: '2026-01-01', endDate: '2026-12-31' }), 'Jan 1, 2026 – Dec 31, 2026');
    assert.equal(derive.formatPeriod({ startDate: '2026-01-01' }), '');
    assert.equal(derive.formatPeriod(null), '');
  });

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

  // ---- Normalizers across the two requirement shapes.

  test('normalizeControlIds reads the multi-control array and the single-control shapes', function () {
    assert.deepEqual(Array.from(derive.normalizeControlIds({ linkedControlIds: ['C-1', 'C-2'] })), ['C-1', 'C-2']);
    assert.deepEqual(Array.from(derive.normalizeControlIds({ controlId: 'C-9' })), ['C-9']);
    assert.deepEqual(Array.from(derive.normalizeControlIds({})), [], 'neither shape yields no fabricated link');
  });

  test('normalizeEvidenceIds reads whichever evidence-link shape is present', function () {
    assert.deepEqual(Array.from(derive.normalizeEvidenceIds({ evidenceIds: ['EV-1'] })), ['EV-1']);
    assert.deepEqual(Array.from(derive.normalizeEvidenceIds({ linkedEvidenceIds: ['EV-2'] })), ['EV-2']);
    assert.deepEqual(Array.from(derive.normalizeEvidenceIds({})), []);
  });

  // ---- Evidence status — derived only from the identifiers the record carries.

  test('deriveEvidenceStatus reads collected / requested / outstanding faithfully', function () {
    assert.equal(derive.deriveEvidenceStatus({ evidenceIds: ['EV-1', 'EV-2'] }).key, 'collected');
    assert.equal(derive.deriveEvidenceStatus({ evidenceIds: ['EV-1', 'EV-2'] }).label, '2 collected');
    assert.equal(derive.deriveEvidenceStatus({ evidenceRequestIds: ['R-1'] }).key, 'requested');
    const outstanding = derive.deriveEvidenceStatus({ evidenceIds: [], evidenceRequestIds: [] });
    assert.equal(outstanding.key, 'outstanding', 'empty arrays read Outstanding, the faithful current state');
    assert.equal(outstanding.tone, 'warning');
  });

  // ---- Framework mapping — only present relationships, no inference.

  test('deriveFrameworkMapping reads criteria off the linked control, then falls back to the engagement framework', function () {
    const controlsById = { 'C-1': { id: 'C-1', trustServicesCriteria: ['CC1.1', 'CC6.1'] } };
    assert.equal(derive.deriveFrameworkMapping({ controlId: 'C-1' }, controlsById, ['Framework X']), 'CC1.1, CC6.1',
      'a linked control that declares criteria is a present relationship, not an inference');
    assert.equal(derive.deriveFrameworkMapping({ controlId: 'C-UNKNOWN' }, {}, ['Framework X']), 'Framework X',
      'with no criteria to read, the requirement maps to its engagement framework');
    assert.equal(derive.deriveFrameworkMapping({}, {}, []), '', 'no framework declared yields empty, never fabricated');
  });

  test('deriveFrameworkMapping prefers explicit criteria on the requirement itself', function () {
    assert.equal(derive.deriveFrameworkMapping({ trustServicesCriteria: ['CC2.1'] }, {}, ['Framework X']), 'CC2.1');
  });

  // ---- Queue rows — resolve names where they join, render raw ids otherwise, never fabricate priority.

  function rowContext() {
    return {
      pocsById: { 'POC-1': { id: 'POC-1', name: 'A. Owner' } },
      teamsById: { 'TEAM-1': { id: 'TEAM-1', name: 'Security' } },
      businessUnitsById: {},
      controlsById: { 'C-1': { id: 'C-1', title: 'Access Control', trustServicesCriteria: ['CC6.1'] } },
      evidenceById: {},
      frameworks: ['Framework X']
    };
  }

  test('deriveRequirementRow maps a requirement to display fields, resolving names where they join', function () {
    const row = derive.deriveRequirementRow({
      id: 'REQ-1', title: 'System Configuration Export', primaryPocId: 'POC-1',
      controlId: 'C-1', status: 'Pending', evidenceOwnerTeamId: 'TEAM-1'
    }, rowContext());
    assert.equal(row.title, 'System Configuration Export');
    assert.equal(row.owner, 'A. Owner');
    assert.equal(row.status, 'Pending');
    assert.equal(row.statusTone, 'warning');
    assert.equal(row.evidence.key, 'outstanding');
    assert.equal(row.framework, 'CC6.1', 'framework maps through the linked control');
    assert.equal(row.priority, '', 'priority is never fabricated when the record omits it');
  });

  test('deriveRequirementRow renders a raw identifier when a POC does not join', function () {
    const row = derive.deriveRequirementRow({ id: 'REQ-9', primaryPocId: 'POC-UNKNOWN' }, rowContext());
    assert.equal(row.owner, 'POC-UNKNOWN', 'an unresolved POC renders its raw id, never a fabricated name');
  });

  test('deriveQueue renders every requirement once, ordered by identifier', function () {
    const queue = Array.from(derive.deriveQueue([
      { id: 'REQ-2', title: 'Second' },
      { id: 'REQ-1', title: 'First' }
    ], rowContext()));
    assert.deepEqual(queue.map(function (row) { return row.id; }), ['REQ-1', 'REQ-2'], 'nothing is capped or dropped');
  });

  // ---- Requirement health — real counts only.

  test('deriveRequirementHealth counts statuses actually present plus the derived evidence-outstanding indicator', function () {
    const health = Array.from(derive.deriveRequirementHealth([
      { status: 'Pending', evidenceIds: [] },
      { status: 'Pending', evidenceIds: [] },
      { status: 'Approved', evidenceIds: ['EV-1'] }
    ]));
    const byLabel = {};
    health.forEach(function (item) { byLabel[item.label] = item; });
    assert.equal(byLabel['Pending'].status, '2', 'the Pending count is a real count of records');
    assert.equal(byLabel['Approved'].status, '1');
    assert.equal(byLabel['Evidence outstanding'].status, '2', 'two requirements carry no linked evidence');
    // Canonical order places Pending before Approved, with evidence-outstanding last.
    assert.equal(health[health.length - 1].label, 'Evidence outstanding');
  });

  test('deriveRequirementHealth reads an empty engagement as Clear, never a fabricated number', function () {
    const health = Array.from(derive.deriveRequirementHealth([]));
    assert.equal(health.length, 1, 'no requirements yields only the evidence indicator');
    assert.equal(health[0].label, 'Evidence outstanding');
    assert.equal(health[0].status, 'Clear');
    assert.equal(health[0].tone, 'success');
  });

  test('deriveCollectionStatus reads awaiting / in review / approved faithfully', function () {
    assert.equal(derive.deriveCollectionStatus([]).label, 'Awaiting');
    assert.equal(derive.deriveCollectionStatus([{ status: 'Pending' }]).label, 'In review');
    assert.equal(derive.deriveCollectionStatus([{ status: 'Approved' }, { status: 'Approved' }]).label, 'Approved');
  });

  // ---- Three presentation modes over one dataset — regroup, never change the data.

  function sampleRows() {
    return Array.from(derive.deriveQueue([
      { id: 'REQ-1', title: 'One', primaryPocId: 'POC-1', evidenceIds: [] },
      { id: 'REQ-2', title: 'Two', primaryPocId: 'POC-1', evidenceIds: ['EV-1'] },
      { id: 'REQ-3', title: 'Three', primaryPocId: 'POC-2', evidenceIds: [] }
    ], {
      pocsById: { 'POC-1': { id: 'POC-1', name: 'A. Owner' }, 'POC-2': { id: 'POC-2', name: 'B. Owner' } },
      teamsById: {}, businessUnitsById: {}, controlsById: {}, evidenceById: {}, frameworks: []
    }));
  }

  function countRows(view) {
    return Array.from(view.groups).reduce(function (total, group) { return total + Array.from(group.rows).length; }, 0);
  }

  test('the three views regroup exactly the same rows — presentation only, never a data change', function () {
    const rows = sampleRows();
    const views = Array.from(derive.deriveViews(rows));
    assert.deepEqual(views.map(function (view) { return view.id; }), ['requirement', 'pending-poc', 'evidence']);
    views.forEach(function (view) {
      assert.equal(countRows(view.view), rows.length, view.label + ' preserves every requirement');
    });
  });

  test('requirementView is the flat queue in a single group', function () {
    const view = derive.requirementView(sampleRows());
    assert.equal(Array.from(view.groups).length, 1);
    assert.equal(Array.from(view.groups)[0].label, '');
  });

  test('pendingByPocView groups the same rows by owner, ordered by name', function () {
    const view = derive.pendingByPocView(sampleRows());
    const labels = Array.from(view.groups).map(function (group) { return group.label; });
    assert.deepEqual(labels, ['A. Owner', 'B. Owner'], 'groups are the real POC names, alphabetically');
    assert.equal(Array.from(view.groups)[0].rows.length, 2, 'A. Owner holds two requirements');
  });

  test('evidenceView groups the same rows by evidence status, outstanding before collected', function () {
    const view = derive.evidenceView(sampleRows());
    const labels = Array.from(view.groups).map(function (group) { return group.label; });
    assert.deepEqual(labels, ['Evidence outstanding', 'Evidence collected']);
  });

  // ---- Audit lineage — the methodology chain with Requirement highlighted.

  function fixtureRegistry() {
    return {
      IDS: { WALKTHROUGH: 'walkthrough', REQUIREMENTS: 'requirements', CONTROLS: 'controls', EVIDENCE: 'evidence', TESTING: 'testing', FINDINGS: 'findings', REPORTING: 'reporting' },
      findById: function (id) { return { id: id, path: 'path-' + id }; }
    };
  }

  test('deriveLineage renders the full chain with Requirement highlighted and real counts', function () {
    const lineage = Array.from(derive.deriveLineage(fixtureRegistry(), {
      requirements: { requirements: 104 }, controls: { controls: 52 }, evidence: { evidenceItems: 0 },
      testing: { tests: 0 }, findings: { findings: 0 }, report: null
    }));
    assert.deepEqual(lineage.map(function (node) { return node.label; }), [
      'Walkthrough', 'Requirement', 'Control', 'Evidence', 'Testing', 'Finding', 'Report'
    ]);
    const requirementNode = lineage.filter(function (node) { return node.label === 'Requirement'; })[0];
    assert.equal(requirementNode.highlighted, true, 'the Requirement node is highlighted');
    assert.equal(requirementNode.count, 104);
    assert.equal(lineage[0].present, false, 'walkthrough carries no data and is never fabricated');
    assert.equal(derive.deriveLineage(null, {}).length, 0, 'no registry yields no lineage');
  });

  test('deriveRelationships lists only the domains with real data and never lists Requirement itself', function () {
    const relationships = Array.from(derive.deriveRelationships(fixtureRegistry(), {
      controls: { controls: 52 }, evidence: { evidenceItems: 0 }, testing: {}, findings: {}, report: null
    }));
    assert.deepEqual(relationships.map(function (item) { return item.title; }), ['Controls']);
    assert.equal(relationships[0].path, 'path-controls');
  });

  // ---- Activity + metadata — only what the JSON records.

  test('deriveActivity surfaces only dated requirement history, newest first', function () {
    const activity = Array.from(derive.deriveActivity([
      { id: 'REQ-1', title: 'One', updatedAt: '2026-02-01', status: 'Updated' },
      { id: 'REQ-2', title: 'Two' }
    ]));
    assert.equal(activity.length, 1, 'a requirement with no dated field never appears');
    assert.match(activity[0].title, /One/);
  });

  test('deriveMetadata reads document metadata, collecting the real tags present', function () {
    const metadata = derive.deriveMetadata(
      { version: '1.0.0', dataset: 'Demo Requirements', generatedAt: '2026-01-01T00:00:00Z' },
      { engagementLead: 'Lead Auditor' },
      { createdAt: '2025-01-01' },
      [{ tags: ['soc2', 'shared'] }, { tags: ['soc2'] }]
    );
    assert.equal(metadata.version, '1.0.0');
    assert.equal(metadata.source, 'Demo Requirements');
    assert.equal(metadata.owner, 'Lead Auditor');
    assert.deepEqual(Array.from(metadata.tags), ['soc2', 'shared'], 'tags are the distinct real tags on the records');
  });

  // ---- Inspector — the host-agnostic detail configuration, immutable-history ready.

  test('buildRequirementInspector renders every field with a real value and a placeholder where absent', function () {
    const inspector = derive.buildRequirementInspector({
      id: 'REQ-1', title: 'System Configuration Export', status: 'Pending',
      primaryPocId: 'POC-1', evidenceOwnerTeamId: 'TEAM-1', controlId: 'C-1',
      evidenceType: 'System Export', frequency: 'Annual', reuseStatus: 'Reuse Candidate'
    }, {
      pocsById: { 'POC-1': { id: 'POC-1', name: 'A. Owner' } },
      teamsById: { 'TEAM-1': { id: 'TEAM-1', name: 'Security' } },
      businessUnitsById: {},
      controlsById: { 'C-1': { id: 'C-1', title: 'Access Control' } },
      evidenceById: {}, frameworks: ['Framework X']
    });

    assert.equal(inspector.title, 'System Configuration Export');
    assert.equal(inspector.badges[0].label, 'Pending');
    assert.equal(inspector.badges[1].label, 'Evidence outstanding', 'evidence status reads as a second badge');

    const sections = {};
    inspector.sections.forEach(function (section) { sections[section.title] = section; });
    assert.equal(sections['Related controls'].items[0].title, 'Access Control', 'a joining control resolves to its title');
    assert.equal(sections['Related evidence'].items[0].title, 'No evidence linked yet — this requirement is still outstanding.');
    assert.equal(sections['Related walkthroughs'].items[0].title, 'No linked walkthroughs yet — walkthrough linkage arrives with the walkthrough collection.');

    const props = sections['Properties'].rows.reduce(function (acc, row) { acc[row.label] = row.value; return acc; }, {});
    assert.equal(props['Owner'], 'A. Owner');
    assert.equal(props['Owning team'], 'Security');
    assert.equal(props['Framework mapping'], 'Framework X', 'framework falls back to the engagement framework');
    assert.equal(props['Priority'], undefined, 'a missing priority is dropped, never rendered as a fabricated value');
  });

  test('buildRequirementInspector exposes immutable history only when the JSON records it', function () {
    const withoutHistory = derive.buildRequirementInspector({ id: 'REQ-9', status: 'Pending' }, {});
    const versionSection = withoutHistory.sections.filter(function (section) { return section.title === 'Version history'; })[0];
    assert.equal(versionSection.kind, 'placeholder', 'no recorded versions renders the reserved placeholder, never a fabricated history');

    const withHistory = derive.buildRequirementInspector({
      id: 'REQ-1', status: 'Approved',
      versionHistory: [{ date: '2026-02-01', title: 'v2 approved', actor: 'Reviewer' }]
    }, {});
    const rendered = withHistory.sections.filter(function (section) { return section.title === 'Version history'; })[0];
    assert.equal(rendered.kind, 'timeline', 'a recorded version history renders as an immutable timeline');
    assert.equal(Array.from(rendered.events).length, 1);
  });

  test('deriveVersionHistory fabricates nothing for a requirement carrying no recorded versions', function () {
    assert.deepEqual(Array.from(derive.deriveVersionHistory({ id: 'REQ-1', status: 'Pending' })), []);
  });
};
