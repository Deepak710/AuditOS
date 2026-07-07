'use strict';

/**
 * Unit Tests — Testing Workspace Derivations
 *
 * Exercises the pure derivation helpers of the Testing Workspace with fixture
 * records (GitHub Issue #24 — Testing / Unit Tests). The helpers take plain
 * records and return plain view data — no DOM, no AuditOS.state — so these suites
 * verify the business-data bindings deterministically and offline. Fixtures
 * mirror the two test shapes the demo datasets carry (a SOC 2 shape with a
 * knowledge-reuse block, and an ISO 27001 shape with a framework, an Annex A
 * section, and a framework-reuse block) without embedding demo business content,
 * so the workspace's central Release 1 promise — render only what exists, resolve
 * names only when identifiers genuinely join, fabricate nothing, infer no
 * conclusions — is asserted directly. The three presentation views are asserted
 * to regroup one dataset without changing it.
 *
 * Array.from normalizes vm-sandbox arrays into this realm so strict deepEqual
 * compares structure, not the sandbox Array.prototype (see tests/lib/prototype).
 */

const { loadTestingWorkspace } = require('../lib/prototype');

module.exports = function registerUnitTests(harness) {
  const test = harness.test;
  const assert = harness.assert;
  const derive = loadTestingWorkspace().derivations;

  // ---- Formatters + frameworks + current engagement (identical seam to the other workspaces).

  test('formatDate behaves deterministically', function () {
    assert.equal(derive.formatDate('2026-03-09'), 'Mar 9, 2026');
    assert.equal(derive.formatDate('not-a-date'), 'not-a-date');
    assert.equal(derive.formatDate(undefined), '');
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

  // ---- Tone resolvers over the recorded status / result vocabulary.

  test('resolveStatusTone and resolveResultTone read the recorded vocabulary, neutral when unmapped', function () {
    assert.equal(derive.resolveStatusTone('Completed'), 'success');
    assert.equal(derive.resolveStatusTone('Pending'), 'warning');
    assert.equal(derive.resolveStatusTone('Unknown'), 'info', 'an unmapped status resolves to a neutral info tone');
    assert.equal(derive.resolveResultTone('Pass'), 'success');
    assert.equal(derive.resolveResultTone('Fail'), 'error');
    assert.equal(derive.resolveResultTone(null), null, 'no result reads as no tone, never a fabricated outcome');
  });

  // ---- Related control — resolved only where an identifier genuinely joins.

  function rowContext() {
    return {
      controlsById: { 'ENGCTRL-9': { id: 'ENGCTRL-9', controlId: 'GOV-01', title: 'Information Security Policy' } },
      libraryControlsById: { 'LIB-CTRL-0001': { id: 'LIB-CTRL-0001', controlCode: 'CSC-01', title: 'User Access Provisioning' } },
      findingsById: { 'OBS-1': { id: 'OBS-1', title: 'Missing approval', severity: 'Medium', status: 'Open' } },
      frameworks: ['SOC 2 Type II']
    };
  }

  test('resolveRelatedControl joins the shared control library by libraryControlId', function () {
    const related = derive.resolveRelatedControl({ controlId: 'ENGCTRL-1001', libraryControlId: 'LIB-CTRL-0001' }, rowContext());
    assert.equal(related.title, 'User Access Provisioning', 'the library control resolves to its master title');
    assert.equal(related.code, 'CSC-01');
  });

  test('resolveRelatedControl falls back to the engagement control set by controlId', function () {
    const related = derive.resolveRelatedControl({ controlId: 'ENGCTRL-9' }, rowContext());
    assert.equal(related.title, 'Information Security Policy', 'the engagement control resolves to its title');
    assert.equal(related.code, 'GOV-01');
  });

  test('resolveRelatedControl renders the raw identifier when neither identifier joins', function () {
    const related = derive.resolveRelatedControl({ controlId: 'ENGCTRL-UNKNOWN' }, rowContext());
    assert.equal(related.title, '', 'no title is fabricated');
    assert.equal(related.id, 'ENGCTRL-UNKNOWN', 'the raw control identifier is preserved');
    assert.equal(derive.relatedControlLabel(related), 'ENGCTRL-UNKNOWN', 'the label falls back to the raw identifier');
  });

  // ---- Evidence status + methodology reuse — read the block the record carries.

  test('deriveEvidenceStatus reads recorded / outstanding faithfully', function () {
    assert.equal(derive.deriveEvidenceStatus({ workingPaperId: 'WP-1' }).key, 'used');
    const outstanding = derive.deriveEvidenceStatus({});
    assert.equal(outstanding.key, 'outstanding', 'no working paper reads Outstanding, the faithful current state');
    assert.equal(outstanding.tone, 'warning');
  });

  test('normalizeMethodologyReuse reads the SOC 2 knowledge-reuse shape', function () {
    const reuse = derive.normalizeMethodologyReuse({ knowledgeReuse: { methodologyInherited: true, sourceEngagementId: 'ENG-002', evidenceReuseReviewed: true } });
    assert.equal(reuse.kind, 'knowledge');
    assert.equal(reuse.methodologyInherited, true);
    assert.equal(reuse.source, 'ENG-002');
    assert.equal(reuse.evidenceReviewed, true);
  });

  test('normalizeMethodologyReuse reads the ISO framework-reuse shape', function () {
    const reuse = derive.normalizeMethodologyReuse({ frameworkReuse: { sourceFramework: 'SOC 2 Type II', soc2MethodologyReusable: true, evidenceReusable: false } });
    assert.equal(reuse.kind, 'framework');
    assert.equal(reuse.methodologyInherited, true);
    assert.equal(reuse.source, 'SOC 2 Type II');
    assert.equal(reuse.evidenceReviewed, false, 'ISO evidence is not reusable, and that is read faithfully');
  });

  test('normalizeMethodologyReuse reads a test with no reuse block as not applicable', function () {
    const reuse = derive.normalizeMethodologyReuse({});
    assert.equal(reuse.kind, null);
    assert.equal(reuse.source, '');
  });

  // ---- Queue rows — resolve names where they join, render raw ids otherwise.

  test('deriveTestRow maps a test to display fields, resolving the control where it joins', function () {
    const row = derive.deriveTestRow({
      id: 'TEST-001-01', controlId: 'ENGCTRL-1001', libraryControlId: 'LIB-CTRL-0001',
      procedure: 'Inspect and verify', status: 'Completed', result: 'Pass',
      testedBy: 'USR-003', reviewedBy: 'USR-001', workingPaperId: 'WP-1'
    }, rowContext());
    assert.equal(row.id, 'TEST-001-01');
    assert.equal(row.procedure, 'Inspect and verify');
    assert.equal(row.controlLabel, 'CSC-01 · User Access Provisioning');
    assert.equal(row.status, 'Completed');
    assert.equal(row.statusTone, 'success');
    assert.equal(row.result, 'Pass');
    assert.equal(row.resultTone, 'success');
    assert.equal(row.evidence.key, 'used');
  });

  test('deriveTestRow renders a raw identifier when the tester does not join a directory', function () {
    const row = derive.deriveTestRow({ id: 'TEST-9', testedBy: 'USR-999' }, rowContext());
    assert.equal(row.testedBy, 'USR-999', 'the recorded tester renders as its raw identifier, never a fabricated name');
  });

  test('deriveQueue renders every test once, ordered by identifier', function () {
    const queue = Array.from(derive.deriveQueue([
      { id: 'TEST-2', procedure: 'Reperform control' },
      { id: 'TEST-1', procedure: 'Inspect and verify' }
    ], rowContext()));
    assert.deepEqual(queue.map(function (row) { return row.id; }), ['TEST-1', 'TEST-2'], 'nothing is capped or dropped');
  });

  // ---- Testing health + progress + status — real counts only.

  function sampleTests() {
    return [
      { id: 'TEST-1', status: 'Completed', result: 'Pass' },
      { id: 'TEST-2', status: 'Completed', result: 'Pass' },
      { id: 'TEST-3', status: 'Completed', result: 'Fail', findingId: 'OBS-1' },
      { id: 'TEST-4', status: 'Pending', result: null }
    ];
  }

  test('deriveTestingHealth counts statuses present plus derived passed / exceptions / awaiting indicators', function () {
    const health = Array.from(derive.deriveTestingHealth(sampleTests()));
    const byLabel = {};
    health.forEach(function (item) { byLabel[item.label] = item; });
    assert.equal(byLabel['Completed'].status, '3', 'the Completed count is a real count of records');
    assert.equal(byLabel['Pending'].status, '1');
    assert.equal(byLabel['Passed'].status, '2', 'two tests recorded a Pass');
    assert.equal(byLabel['Exceptions'].status, '1', 'one test recorded a Fail');
    assert.equal(byLabel['Exceptions'].tone, 'error');
    assert.equal(byLabel['Awaiting result'].status, '1', 'one test carries no result');
  });

  test('deriveTestingHealth reads an empty engagement as Clear / None, never a fabricated number', function () {
    const health = Array.from(derive.deriveTestingHealth([]));
    const byLabel = {};
    health.forEach(function (item) { byLabel[item.label] = item; });
    assert.equal(byLabel['Passed'].status, 'None');
    assert.equal(byLabel['Exceptions'].status, 'Clear');
    assert.equal(byLabel['Exceptions'].tone, 'success');
    assert.equal(byLabel['Awaiting result'].status, 'Clear');
  });

  test('deriveTestingProgress reads real completed / passed / exception / pending counts, no estimate', function () {
    const progress = derive.deriveTestingProgress(sampleTests());
    assert.equal(progress.total, 4);
    assert.equal(progress.completed, 3);
    assert.equal(progress.passed, 2);
    assert.equal(progress.failed, 1);
    assert.equal(progress.pending, 1);
  });

  test('deriveTestingStatus reads Not Started / In Progress / Completed faithfully', function () {
    assert.equal(derive.deriveTestingStatus([]).label, 'Not Started');
    assert.equal(derive.deriveTestingStatus([{ status: 'Completed' }, { status: 'Pending' }]).label, 'In Progress');
    assert.equal(derive.deriveTestingStatus([{ status: 'Completed' }]).label, 'Completed');
  });

  // ---- Exceptions — actual failures only, resolved to their raised finding.

  test('deriveExceptions renders only tests whose result is Fail, resolving the finding where it joins', function () {
    const exceptions = Array.from(derive.deriveExceptions(sampleTests(), rowContext()));
    assert.equal(exceptions.length, 1, 'only the one failed test surfaces — never a placeholder finding');
    assert.equal(exceptions[0].id, 'TEST-3');
    assert.equal(exceptions[0].title, 'Missing approval', 'the raised finding resolves to its title');
    assert.equal(exceptions[0].severity, 'Medium');
  });

  test('deriveExceptions yields nothing for an engagement with no failures', function () {
    assert.deepEqual(Array.from(derive.deriveExceptions([{ id: 'TEST-1', result: 'Pass' }], rowContext())), []);
  });

  // ---- Three presentation modes over one dataset — regroup, never change the data.

  function sampleRows() {
    return Array.from(derive.deriveQueue([
      { id: 'TEST-1', controlId: 'ENGCTRL-9', result: 'Pass' },
      { id: 'TEST-2', controlId: 'ENGCTRL-9', result: 'Fail' },
      { id: 'TEST-3', controlId: 'ENGCTRL-1001', libraryControlId: 'LIB-CTRL-0001', result: null }
    ], rowContext()));
  }

  function countRows(view) {
    return Array.from(view.groups).reduce(function (total, group) { return total + Array.from(group.rows).length; }, 0);
  }

  test('the three views regroup exactly the same rows — presentation only, never a data change', function () {
    const rows = sampleRows();
    const views = Array.from(derive.deriveViews(rows));
    assert.deepEqual(views.map(function (view) { return view.id; }), ['test', 'control', 'result']);
    views.forEach(function (view) {
      assert.equal(countRows(view.view), rows.length, view.label + ' preserves every test');
    });
  });

  test('testView is the flat queue in a single group', function () {
    const view = derive.testView(sampleRows());
    assert.equal(Array.from(view.groups).length, 1);
    assert.equal(Array.from(view.groups)[0].label, '');
  });

  test('controlGroupView groups the same rows by related control, ordered by label', function () {
    const view = derive.controlGroupView(sampleRows());
    const labels = Array.from(view.groups).map(function (group) { return group.label; });
    assert.deepEqual(labels, ['CSC-01 · User Access Provisioning', 'GOV-01 · Information Security Policy'],
      'groups are the real related controls, alphabetically');
  });

  test('resultView groups the same rows by result, exceptions before passed before awaiting', function () {
    const view = derive.resultView(sampleRows());
    const labels = Array.from(view.groups).map(function (group) { return group.label; });
    assert.deepEqual(labels, ['Exceptions', 'Passed', 'Awaiting result']);
  });

  // ---- Audit lineage — the methodology chain with Testing highlighted.

  function fixtureRegistry() {
    return {
      IDS: { WALKTHROUGH: 'walkthrough', REQUIREMENTS: 'requirements', CONTROLS: 'controls', EVIDENCE: 'evidence', TESTING: 'testing', FINDINGS: 'findings', REPORTING: 'reporting' },
      findById: function (id) { return { id: id, path: 'path-' + id }; }
    };
  }

  test('deriveLineage renders the full chain with Testing highlighted and real counts', function () {
    const lineage = Array.from(derive.deriveLineage(fixtureRegistry(), {
      requirements: { requirements: 104 }, controls: { controls: 52 }, evidence: { evidenceItems: 12 },
      testing: { tests: 100 }, findings: { findings: 5 }, report: null
    }));
    assert.deepEqual(lineage.map(function (node) { return node.label; }), [
      'Walkthrough', 'Requirement', 'Control', 'Evidence', 'Testing', 'Finding', 'Report'
    ]);
    const testingNode = lineage.filter(function (node) { return node.label === 'Testing'; })[0];
    assert.equal(testingNode.highlighted, true, 'the Testing node is highlighted');
    assert.equal(testingNode.count, 100);
    assert.equal(lineage[0].present, false, 'walkthrough carries no data and is never fabricated');
    assert.equal(derive.deriveLineage(null, {}).length, 0, 'no registry yields no lineage');
  });

  test('deriveRelationships lists only the domains with real data and never lists Testing itself', function () {
    const relationships = Array.from(derive.deriveRelationships(fixtureRegistry(), {
      requirements: { requirements: 0 }, controls: { controls: 52 }, evidence: { evidenceItems: 0 }, findings: {}, report: null
    }));
    assert.deepEqual(relationships.map(function (item) { return item.title; }), ['Controls']);
    assert.equal(relationships[0].path, 'path-controls');
  });

  // ---- Activity + metadata — only what the JSON records.

  test('deriveActivity surfaces only dated test history, and nothing for undated tests', function () {
    assert.deepEqual(Array.from(derive.deriveActivity([{ id: 'TEST-1', status: 'Completed' }])), [],
      'the current demo tests carry no dated events, so the feed stays empty — never fabricated');
    const activity = Array.from(derive.deriveActivity([{ id: 'TEST-2', updatedAt: '2026-02-01', status: 'Completed' }]));
    assert.equal(activity.length, 1);
    assert.match(activity[0].title, /TEST-2/);
  });

  test('deriveMetadata reads document metadata, collecting the real tags present', function () {
    const metadata = derive.deriveMetadata(
      { version: '2.0.0', dataset: 'Demo Testing', generatedAt: '2026-01-01T00:00:00Z' },
      { engagementLead: 'Lead Auditor' },
      { createdAt: '2025-01-01' },
      [{ tags: ['soc2', 'fy2026'] }, { tags: ['soc2'] }]
    );
    assert.equal(metadata.version, '2.0.0');
    assert.equal(metadata.source, 'Demo Testing');
    assert.equal(metadata.owner, 'Lead Auditor');
    assert.deepEqual(Array.from(metadata.tags), ['soc2', 'fy2026'], 'tags are the distinct real tags on the records');
  });

  // ---- Inspector — the host-agnostic detail configuration, placeholder where absent.

  test('buildTestInspector renders every field with a real value and a placeholder where absent', function () {
    const inspector = derive.buildTestInspector({
      id: 'TEST-001-01', controlId: 'ENGCTRL-1001', libraryControlId: 'LIB-CTRL-0001',
      procedure: 'Inspect and verify', expectedResult: 'Control operated effectively.',
      actualResult: 'Control operated effectively.', status: 'Completed', result: 'Pass',
      testedBy: 'USR-003', reviewedBy: 'USR-001', sampleId: 'SMP-1', sampleSetId: 'SSET-1',
      workingPaperId: 'WP-1', notes: '', knowledgeReuse: { methodologyInherited: true, sourceEngagementId: 'ENG-002' }
    }, rowContext());

    assert.equal(inspector.title, 'Inspect and verify');
    assert.equal(inspector.badges[0].label, 'Completed');
    assert.equal(inspector.badges[1].label, 'Pass', 'the result reads as a badge');
    assert.equal(inspector.badges[2].label, 'Evidence recorded');

    const sections = {};
    inspector.sections.forEach(function (section) { sections[section.title] = section; });
    const props = sections['Properties'].rows.reduce(function (acc, row) { acc[row.label] = row.value; return acc; }, {});
    assert.equal(props['Related control'], 'CSC-01 · User Access Provisioning', 'the related control resolves, a real join');
    assert.equal(props['Tested by'], 'USR-003', 'the recorded tester renders as its raw identifier');
    assert.equal(props['Testing method'], 'Inspect and verify');
    assert.equal(props['Objective'], undefined, 'a missing objective is dropped from properties, never a fabricated value');
    assert.equal(sections['Evidence used'].items[0].title, 'Working paper: WP-1');
    assert.equal(sections['Testing notes'].items[0].title, 'No testing notes recorded for this test.', 'an empty note renders the placeholder');
    assert.equal(sections['Methodology reuse'].items[0].title, 'Methodology inherited', 'a recorded reuse block renders, never fabricated');
  });

  test('buildTestInspector renders reserved placeholders where the JSON records nothing', function () {
    const inspector = derive.buildTestInspector({ id: 'TEST-9', status: 'Pending' }, {});
    const sections = {};
    inspector.sections.forEach(function (section) { sections[section.title] = section; });
    assert.equal(sections['Methodology reuse'].kind, 'placeholder', 'no reuse block renders the reserved placeholder');
    assert.equal(sections['Activity'].kind, 'placeholder', 'the activity trail is a reserved placeholder in Release 1');
    assert.equal(sections['Objective'].items[0].title, 'No objective recorded for this test. Release 2 adds AI-refined test objectives.');
    assert.equal(sections['Exception'].items[0].title, 'No exception raised for this test.', 'no failure renders no fabricated exception');
  });

  test('deriveApprovalHistory reflects the recorded reviewer and outcome, never a fabricated past', function () {
    const reviewed = Array.from(derive.deriveApprovalHistory({ reviewedBy: 'USR-001', result: 'Pass', status: 'Completed' }));
    assert.equal(reviewed.length, 1);
    assert.match(reviewed[0].title, /Pass/);
    assert.match(reviewed[0].description, /USR-001/);
    assert.deepEqual(Array.from(derive.deriveApprovalHistory({})), [], 'no reviewer and no status yields nothing');
  });
};
