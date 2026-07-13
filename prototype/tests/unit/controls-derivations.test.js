'use strict';

/**
 * Unit Tests — Controls Workspace Derivations
 *
 * Exercises the pure derivation helpers of the Controls Workspace with fixture
 * records (GitHub Issue #23 — Testing / Unit Tests). The helpers take plain
 * records and return plain view data — no DOM, no AuditOS.state — so these suites
 * verify the business-data bindings deterministically and offline. Fixtures
 * mirror the two control shapes the demo datasets carry (a SOC 2 shape with
 * evidence reuse and an inherited testing strategy, and an ISO 27001 shape with
 * an Annex A reference and knowledge reuse) without embedding demo business
 * content, so the workspace's central Release 1 promise — render only what
 * exists, resolve names only when identifiers genuinely join, fabricate nothing,
 * infer no relationships — is asserted directly. The three presentation views are
 * asserted to regroup one dataset without changing it.
 *
 * Array.from normalizes vm-sandbox arrays into this realm so strict deepEqual
 * compares structure, not the sandbox Array.prototype (see tests/lib/prototype).
 */

const { loadControlsWorkspace } = require('../lib/prototype');

module.exports = function registerUnitTests(harness) {
  const test = harness.test;
  const assert = harness.assert;
  const derive = loadControlsWorkspace().derivations;

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

  // ---- Field resolvers across the two control shapes.

  test('resolveControlCode reads the business Control ID, falling back to the record id', function () {
    assert.equal(derive.resolveControlCode({ controlId: 'GOV-01', id: 'CTRL-1' }), 'GOV-01');
    assert.equal(derive.resolveControlCode({ id: 'CTRL-9' }), 'CTRL-9', 'falls back to the record id, never fabricated');
    assert.equal(derive.resolveControlCode({}), '');
  });

  test('resolveControlType and resolveFrequency read whichever shape is present', function () {
    assert.equal(derive.resolveControlType({ category: 'Governance' }), 'Governance');
    assert.equal(derive.resolveControlType({}), '', 'never fabricated');
    assert.equal(derive.resolveFrequency({ testingFrequency: 'Annual' }), 'Annual');
    assert.equal(derive.resolveFrequency({}), '');
  });

  test('normalizeRequirementIds and normalizeEvidenceIds read links, fabricating none', function () {
    assert.deepEqual(Array.from(derive.normalizeRequirementIds({ requirementIds: ['REQ-1', 'REQ-2'] })), ['REQ-1', 'REQ-2']);
    assert.deepEqual(Array.from(derive.normalizeRequirementIds({})), [], 'no link is fabricated');
    assert.deepEqual(Array.from(derive.normalizeEvidenceIds({ linkedEvidence: ['EV-1'] })), ['EV-1']);
    assert.deepEqual(Array.from(derive.normalizeEvidenceIds({ evidenceIds: ['EV-2'] })), ['EV-2']);
    assert.deepEqual(Array.from(derive.normalizeEvidenceIds({})), []);
  });

  // ---- Reuse — read the reuse block the record carries, never a fabricated claim.

  test('normalizeReuse reads the SOC 2 evidence-reuse shape', function () {
    const reuse = derive.normalizeReuse({ evidenceReuse: { eligible: true, reuseStatus: 'Ready for Review', sourceEngagement: 'ENG-2' } });
    assert.equal(reuse.eligible, true);
    assert.equal(reuse.status, 'Ready for Review');
    assert.equal(reuse.source, 'ENG-2');
  });

  test('normalizeReuse reads the ISO knowledge-reuse shape', function () {
    const reuse = derive.normalizeReuse({ knowledgeReuse: { sourceFramework: 'SOC 2 Type II', methodologyReusable: true, evidenceReusable: false } });
    assert.equal(reuse.eligible, false, 'ISO evidence is not reusable, so the control is not evidence-reuse eligible');
    assert.equal(reuse.status, 'Methodology reusable');
    assert.equal(reuse.source, 'SOC 2 Type II');
  });

  test('normalizeReuse reads a control with no reuse block as not eligible, never fabricated', function () {
    const reuse = derive.normalizeReuse({});
    assert.equal(reuse.eligible, false);
    assert.equal(reuse.status, '');
    assert.equal(reuse.source, '');
  });

  // ---- Evidence + testing coverage — derived only from the fields the record carries.

  test('deriveEvidenceCoverage reads collected / outstanding faithfully', function () {
    assert.equal(derive.deriveEvidenceCoverage({ linkedEvidence: ['EV-1', 'EV-2'] }).key, 'collected');
    assert.equal(derive.deriveEvidenceCoverage({ linkedEvidence: ['EV-1', 'EV-2'] }).label, '2 collected');
    const outstanding = derive.deriveEvidenceCoverage({ linkedEvidence: [] });
    assert.equal(outstanding.key, 'outstanding', 'an empty evidence array reads Outstanding, the faithful current state');
    assert.equal(outstanding.tone, 'warning');
  });

  test('deriveTestingCoverage reads tested / inherited / outstanding from real fields only', function () {
    assert.equal(derive.deriveTestingCoverage({ testResult: 'Pass' }).key, 'tested', 'a recorded test result reads Tested');
    assert.equal(derive.deriveTestingCoverage({ testingStrategy: { methodologyInherited: true } }).key, 'inherited',
      'an inherited testing strategy is a real, current fact, not a fabricated test');
    const outstanding = derive.deriveTestingCoverage({});
    assert.equal(outstanding.key, 'outstanding', 'no test and no strategy reads Testing outstanding');
    assert.equal(outstanding.tone, 'warning');
  });

  test('isTestingComplete is true only for a recorded completed outcome', function () {
    assert.equal(derive.isTestingComplete({ testResult: 'Passed' }), true);
    assert.equal(derive.isTestingComplete({ testingComplete: true }), true);
    assert.equal(derive.isTestingComplete({ testingStrategy: { methodologyInherited: true } }), false,
      'a testing strategy is not a completed test');
    assert.equal(derive.isTestingComplete({}), false);
  });

  // ---- Framework mappings — only present declarations, no cross-framework inference.

  test('deriveFrameworkMappings reads a per-framework mappings object', function () {
    const mappings = Array.from(derive.deriveFrameworkMappings({ frameworkMappings: { SOC2: ['CC6.1', 'CC6.2'] } }, ['Ignored']));
    assert.deepEqual(mappings, ['SOC2: CC6.1, CC6.2'], 'a declared per-framework mapping is a present relationship');
  });

  test('deriveFrameworkMappings reads an ISO Annex A reference the control declares', function () {
    assert.deepEqual(Array.from(derive.deriveFrameworkMappings({ annexAControl: 'A.5' }, ['ISO/IEC 27001:2022'])), ['A.5'],
      'the Annex A reference is a real declaration on the record, not an inference');
  });

  test('deriveFrameworkMappings falls back to the engagement framework, and fabricates nothing without one', function () {
    assert.deepEqual(Array.from(derive.deriveFrameworkMappings({}, ['SOC 2 Type II'])), ['SOC 2 Type II'],
      'with nothing declared, a control maps to its engagement framework (a real control → engagement join)');
    assert.deepEqual(Array.from(derive.deriveFrameworkMappings({}, [])), [], 'no framework declared yields empty, never fabricated');
  });

  // ---- Library rows — resolve names where they join, render raw ids otherwise.

  function rowContext() {
    return {
      pocsById: { 'POC-1': { id: 'POC-1', name: 'A. Owner' } },
      teamsById: { 'TEAM-1': { id: 'TEAM-1', name: 'Security' } },
      businessUnitsById: {},
      requirementsById: { 'REQ-1': { id: 'REQ-1', title: 'Access Requirement' } },
      evidenceById: {},
      frameworks: ['SOC 2 Type II']
    };
  }

  test('deriveControlRow maps a control to display fields, resolving names where they join', function () {
    const row = derive.deriveControlRow({
      id: 'CTRL-1', controlId: 'GOV-01', title: 'Information Security Policy',
      category: 'Governance', status: 'In Progress', controlOwner: 'POC-1',
      testingFrequency: 'Annual', linkedEvidence: [],
      testingStrategy: { methodologyInherited: true },
      evidenceReuse: { eligible: true, reuseStatus: 'Ready for Review', sourceEngagement: 'ENG-2' }
    }, rowContext());
    assert.equal(row.controlCode, 'GOV-01');
    assert.equal(row.title, 'Information Security Policy');
    assert.equal(row.owner, 'A. Owner');
    assert.equal(row.type, 'Governance');
    assert.equal(row.status, 'In Progress');
    assert.equal(row.statusTone, 'info');
    assert.equal(row.evidence.key, 'outstanding');
    assert.equal(row.testing.key, 'inherited');
    assert.equal(row.reuse.eligible, true);
    assert.equal(row.framework, 'SOC 2 Type II', 'framework falls back to the engagement framework');
  });

  test('deriveControlRow renders a raw identifier when an owner does not join', function () {
    const row = derive.deriveControlRow({ id: 'CTRL-9', controlOwner: 'POC-UNKNOWN' }, rowContext());
    assert.equal(row.owner, 'POC-UNKNOWN', 'an unresolved owner renders its raw id, never a fabricated name');
  });

  test('deriveLibrary renders every control once, ordered by identifier', function () {
    const library = Array.from(derive.deriveLibrary([
      { id: 'CTRL-2', title: 'Second' },
      { id: 'CTRL-1', title: 'First' }
    ], rowContext()));
    assert.deepEqual(library.map(function (row) { return row.id; }), ['CTRL-1', 'CTRL-2'], 'nothing is capped or dropped');
  });

  // ---- Control health — real counts only.

  test('deriveControlHealth counts statuses present plus derived evidence / testing / reuse indicators', function () {
    const health = Array.from(derive.deriveControlHealth([
      { status: 'In Progress', linkedEvidence: [], evidenceReuse: { eligible: true } },
      { status: 'In Progress', linkedEvidence: [], evidenceReuse: { eligible: false } },
      { status: 'Approved', linkedEvidence: ['EV-1'], testResult: 'Pass' }
    ]));
    const byLabel = {};
    health.forEach(function (item) { byLabel[item.label] = item; });
    assert.equal(byLabel['In Progress'].status, '2', 'the In Progress count is a real count of records');
    assert.equal(byLabel['Approved'].status, '1');
    assert.equal(byLabel['Evidence outstanding'].status, '2', 'two controls carry no linked evidence');
    assert.equal(byLabel['Testing outstanding'].status, '2', 'two controls carry no completed test');
    assert.equal(byLabel['Reuse eligible'].status, '1', 'one control is evidence-reuse eligible');
  });

  test('deriveControlHealth reads an empty engagement as Clear / None, never a fabricated number', function () {
    const health = Array.from(derive.deriveControlHealth([]));
    const byLabel = {};
    health.forEach(function (item) { byLabel[item.label] = item; });
    assert.equal(byLabel['Evidence outstanding'].status, 'Clear');
    assert.equal(byLabel['Evidence outstanding'].tone, 'success');
    assert.equal(byLabel['Testing outstanding'].status, 'Clear');
    assert.equal(byLabel['Reuse eligible'].status, 'None');
  });

  test('deriveCollectionStatus reads awaiting / drafting / approved faithfully', function () {
    assert.equal(derive.deriveCollectionStatus([]).label, 'Awaiting');
    assert.equal(derive.deriveCollectionStatus([{ status: 'In Progress' }]).label, 'Drafting');
    assert.equal(derive.deriveCollectionStatus([{ status: 'Approved' }, { status: 'Active' }]).label, 'Approved');
  });

  // ---- Three presentation modes over one dataset — regroup, never change the data.

  function sampleRows() {
    return Array.from(derive.deriveLibrary([
      { id: 'CTRL-1', title: 'One', category: 'Governance', linkedEvidence: [] },
      { id: 'CTRL-2', title: 'Two', category: 'Governance', linkedEvidence: ['EV-1'] },
      { id: 'CTRL-3', title: 'Three', category: 'Operations', linkedEvidence: [] }
    ], rowContext()));
  }

  function countRows(view) {
    return Array.from(view.groups).reduce(function (total, group) { return total + Array.from(group.rows).length; }, 0);
  }

  test('the three views regroup exactly the same rows — presentation only, never a data change', function () {
    const rows = sampleRows();
    const views = Array.from(derive.deriveViews(rows));
    assert.deepEqual(views.map(function (view) { return view.id; }), ['control', 'family', 'coverage']);
    views.forEach(function (view) {
      assert.equal(countRows(view.view), rows.length, view.label + ' preserves every control');
    });
  });

  test('controlView is the flat library in a single group', function () {
    const view = derive.controlView(sampleRows());
    assert.equal(Array.from(view.groups).length, 1);
    assert.equal(Array.from(view.groups)[0].label, '');
  });

  test('familyView groups the same rows by control type, ordered by name', function () {
    const view = derive.familyView(sampleRows());
    const labels = Array.from(view.groups).map(function (group) { return group.label; });
    assert.deepEqual(labels, ['Governance', 'Operations'], 'groups are the real control families, alphabetically');
    assert.equal(Array.from(view.groups)[0].rows.length, 2, 'Governance holds two controls');
  });

  test('coverageView groups the same rows by evidence coverage, outstanding before collected', function () {
    const view = derive.coverageView(sampleRows());
    const labels = Array.from(view.groups).map(function (group) { return group.label; });
    assert.deepEqual(labels, ['Evidence outstanding', 'Evidence collected']);
  });

  // ---- Audit lineage — the methodology chain with Control highlighted.

  function fixtureRegistry() {
    return {
      IDS: { WALKTHROUGH: 'walkthrough', REQUIREMENTS: 'requirements', CONTROLS: 'controls', EVIDENCE: 'evidence', TESTING: 'testing', FINDINGS: 'findings', REPORTING: 'reporting' },
      findById: function (id) { return { id: id, path: 'path-' + id }; }
    };
  }

  test('deriveLineage renders the full chain with Control highlighted and real counts', function () {
    // Requirements ceased to be a user-facing workspace (Issue #39): the
    // audit lineage no longer carries a Requirement node.
    const lineage = Array.from(derive.deriveLineage(fixtureRegistry(), {
      requirements: { requirements: 104 }, controls: { controls: 52 }, evidence: { evidenceItems: 0 },
      testing: { tests: 0 }, findings: { findings: 0 }, report: null
    }));
    assert.deepEqual(lineage.map(function (node) { return node.label; }), [
      'Walkthrough', 'Control', 'Evidence', 'Testing', 'Finding', 'Report'
    ]);
    const controlNode = lineage.filter(function (node) { return node.label === 'Control'; })[0];
    assert.equal(controlNode.highlighted, true, 'the Control node is highlighted');
    assert.equal(controlNode.count, 52);
    assert.equal(lineage[0].present, false, 'walkthrough carries no data and is never fabricated');
    assert.equal(derive.deriveLineage(null, {}).length, 0, 'no registry yields no lineage');
  });

  test('deriveRelationships lists only the domains with real data and never lists Control itself', function () {
    // Requirements are internal now (Issue #39): the relationship panel
    // links Evidence, not Requirements.
    const relationships = Array.from(derive.deriveRelationships(fixtureRegistry(), {
      requirements: { requirements: 104 }, evidence: { evidenceItems: 8 }, testing: {}, findings: {}, report: null
    }));
    assert.deepEqual(relationships.map(function (item) { return item.title; }), ['Evidence']);
    assert.equal(relationships[0].path, 'path-evidence');
  });

  // ---- Activity + metadata — only what the JSON records.

  test('deriveActivity surfaces only dated control history, newest first', function () {
    const activity = Array.from(derive.deriveActivity([
      { id: 'CTRL-1', title: 'One', updatedAt: '2026-02-01', status: 'Active' },
      { id: 'CTRL-2', title: 'Two' }
    ]));
    assert.equal(activity.length, 1, 'a control with no dated field never appears');
    assert.match(activity[0].title, /One/);
  });

  test('deriveMetadata reads document metadata, collecting the real tags present', function () {
    const metadata = derive.deriveMetadata(
      { version: '1.0.0', dataset: 'Demo Controls', generatedAt: '2026-01-01T00:00:00Z' },
      { engagementLead: 'Lead Auditor' },
      { createdAt: '2025-01-01' },
      [{ tags: ['soc2', 'shared'] }, { tags: ['soc2'] }]
    );
    assert.equal(metadata.version, '1.0.0');
    assert.equal(metadata.source, 'Demo Controls');
    assert.equal(metadata.owner, 'Lead Auditor');
    assert.deepEqual(Array.from(metadata.tags), ['soc2', 'shared'], 'tags are the distinct real tags on the records');
  });

  // ---- Test procedure — rendered only from recorded steps, never drafted.

  test('deriveTestProcedure fabricates nothing for a control carrying no steps', function () {
    assert.deepEqual(Array.from(derive.deriveTestProcedure({ id: 'CTRL-1' })), []);
  });

  test('deriveTestProcedure reads recorded steps when the control declares them', function () {
    const steps = Array.from(derive.deriveTestProcedure({
      testProcedure: ['Inspect the policy', { description: 'Confirm approval', expectedResult: 'Signed record' }]
    }));
    assert.equal(steps.length, 2);
    assert.equal(steps[0].title, 'Inspect the policy');
    assert.equal(steps[1].title, 'Confirm approval');
    assert.equal(steps[1].description, 'Signed record');
  });

  test('deriveRelatedTesting reads the inherited testing strategy, and nothing without one', function () {
    const items = Array.from(derive.deriveRelatedTesting({ testingStrategy: { methodologyInherited: true, priorYearControl: 'ENG-2/GOV-01' } }));
    assert.equal(items.length, 2, 'inherited methodology and prior-year control are both real facts');
    assert.deepEqual(Array.from(derive.deriveRelatedTesting({})), [], 'no strategy yields nothing, never a fabricated test');
  });

  // ---- Inspector — the host-agnostic detail configuration, mapping / test-procedure ready.

  test('buildControlInspector renders every field with a real value and a placeholder where absent', function () {
    const inspector = derive.buildControlInspector({
      id: 'CTRL-1', controlId: 'GOV-01', title: 'Information Security Policy', status: 'In Progress',
      category: 'Governance', controlOwner: 'POC-1', teamId: 'TEAM-1', testingFrequency: 'Annual',
      requirementIds: ['REQ-1'], linkedEvidence: [], testingStrategy: { methodologyInherited: true, priorYearControl: 'ENG-2/GOV-01' },
      evidenceReuse: { eligible: true, reuseStatus: 'Ready for Review', sourceEngagement: 'ENG-2' }
    }, rowContext());

    assert.equal(inspector.title, 'Information Security Policy');
    assert.equal(inspector.badges[0].label, 'In Progress');
    assert.equal(inspector.badges[1].label, 'Evidence outstanding', 'evidence coverage reads as a badge');
    assert.equal(inspector.badges[2].label, 'Methodology inherited', 'testing coverage reads as a badge');

    const sections = {};
    inspector.sections.forEach(function (section) { sections[section.title] = section; });
    assert.equal(sections['Framework mappings'].items[0].title, 'SOC 2 Type II', 'framework maps to the engagement framework, a real join');
    assert.equal(sections['Related requirements'], undefined, 'Requirements are internal now — the control drawer exposes no requirement section');
    assert.equal(sections['Related evidence'].items[0].title, 'No evidence linked yet — this control is still outstanding.');
    assert.equal(sections['Related walkthroughs'].items[0].title, 'No linked walkthroughs yet — walkthrough linkage arrives with the walkthrough collection.');
    assert.equal(sections['Related testing'].items[0].title, 'Methodology inherited from prior year');

    const props = sections['Properties'].rows.reduce(function (acc, row) { acc[row.label] = row.value; return acc; }, {});
    assert.equal(props['Control code'], 'GOV-01');
    assert.equal(props['Owner'], 'A. Owner');
    assert.equal(props['Owning team'], 'Security');
    assert.equal(props['Reuse status'], 'Ready for Review');
    assert.equal(props['Description'], undefined, 'a missing description is dropped from properties, never a fabricated value');
  });

  test('buildControlInspector renders the test-procedure preview only when the JSON records it', function () {
    const withoutProcedure = derive.buildControlInspector({ id: 'CTRL-9', status: 'In Progress' }, {});
    const emptyProcedure = withoutProcedure.sections.filter(function (section) { return section.title === 'Test procedure'; })[0];
    assert.equal(emptyProcedure.kind, 'placeholder', 'no recorded procedure renders the reserved placeholder, never a fabricated procedure');

    const withProcedure = derive.buildControlInspector({
      id: 'CTRL-1', status: 'In Progress', testProcedure: ['Inspect the policy', 'Confirm approval']
    }, {});
    const rendered = withProcedure.sections.filter(function (section) { return section.title === 'Test procedure'; })[0];
    assert.equal(rendered.kind, 'list', 'a recorded procedure renders as the test-procedure preview');
    assert.equal(Array.from(rendered.items).length, 2);
  });

  test('buildControlInspector exposes immutable version history only when the JSON records it', function () {
    const withoutHistory = derive.buildControlInspector({ id: 'CTRL-9', status: 'In Progress' }, {});
    const versionSection = withoutHistory.sections.filter(function (section) { return section.title === 'Version history'; })[0];
    assert.equal(versionSection.kind, 'placeholder', 'no recorded versions renders the reserved placeholder, never a fabricated history');

    const withHistory = derive.buildControlInspector({
      id: 'CTRL-1', status: 'Approved',
      versionHistory: [{ date: '2026-02-01', title: 'v2 approved', actor: 'Reviewer' }]
    }, {});
    const rendered = withHistory.sections.filter(function (section) { return section.title === 'Version history'; })[0];
    assert.equal(rendered.kind, 'timeline', 'a recorded version history renders as an immutable timeline');
    assert.equal(Array.from(rendered.events).length, 1);
  });
};
