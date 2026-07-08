'use strict';

/**
 * Unit Tests — Documentation Workspace Derivations
 *
 * Exercises the pure derivation helpers of the Documentation Workspace with
 * fixture records (GitHub Issue #26 — Documentation / Unit Tests). The helpers
 * take plain records and return plain view data — no DOM, no AuditOS.state —
 * so these suites verify the business-data bindings deterministically and
 * offline. Fixtures mirror the shape the demo `reports` documents carry
 * (titled sections in authored order, each with a source, editable/included
 * flags, and a references block naming the operational domains a section is
 * built from) without embedding demo business content, so the workspace's
 * central Release 1 promise — render only what exists, resolve related counts
 * only when a section's own references genuinely name that domain, fabricate
 * nothing, infer no document text — is asserted directly.
 *
 * Array.from normalizes vm-sandbox arrays into this realm so strict deepEqual
 * compares structure, not the sandbox Array.prototype (see tests/lib/prototype).
 */

const { loadDocumentationWorkspace } = require('../lib/prototype');

module.exports = function registerUnitTests(harness) {
  const test = harness.test;
  const assert = harness.assert;
  const derive = loadDocumentationWorkspace().derivations;

  // ---- Formatters + frameworks + current engagement (identical seam to the other workspaces).

  test('formatDate behaves deterministically', function () {
    assert.equal(derive.formatDate('2027-03-11'), 'Mar 11, 2027');
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

  // ---- Tone resolvers over the recorded status / source vocabulary.

  test('resolveDocStatusTone reads the recorded vocabulary, neutral when unmapped', function () {
    assert.equal(derive.resolveDocStatusTone('Draft'), 'warning');
    assert.equal(derive.resolveDocStatusTone('Final'), 'success');
    assert.equal(derive.resolveDocStatusTone('Approved'), 'success');
    assert.equal(derive.resolveDocStatusTone('Unknown'), null, 'an unmapped status resolves to a neutral tone');
  });

  test('resolveSourceTone reads the recorded vocabulary, neutral info when unmapped', function () {
    assert.equal(derive.resolveSourceTone('manual'), 'info');
    assert.equal(derive.resolveSourceTone('generated'), 'success');
    assert.equal(derive.resolveSourceTone('mystery'), 'info', 'an unmapped source resolves to a neutral info tone');
  });

  test('sourceLabel reads the recorded vocabulary, falling back to the raw value', function () {
    assert.equal(derive.sourceLabel('structured'), 'Structured');
    assert.equal(derive.sourceLabel('bespoke'), 'bespoke', 'an unrecognized source renders its raw value, never a fabricated label');
    assert.equal(derive.sourceLabel(''), 'Unspecified');
  });

  // ---- Related counts — resolved only where a section's own references genuinely name the domain.

  test('resolveRelatedCount reads the real count only when the section references that domain', function () {
    const section = { references: { controls: 'controls/eng.json', evidence: 'evidence/eng.json' } };
    const counts = { controls: 52, evidence: 18, testing: 100, findings: 5 };
    assert.equal(derive.resolveRelatedCount(section, 'controls', counts), 52);
    assert.equal(derive.resolveRelatedCount(section, 'evidence', counts), 18);
    assert.equal(derive.resolveRelatedCount(section, 'testing', counts), null, 'testing is not referenced by this section, so no count is fabricated');
    assert.equal(derive.resolveRelatedCount({}, 'controls', counts), null, 'a section with no references block yields no related count');
  });

  // ---- Document Navigator rows — the table of contents, in authored order.

  test('deriveNavigatorRow maps a section to display fields, defaulting included to true', function () {
    const row = derive.deriveNavigatorRow({
      id: 'SEC-4', name: 'Controls, Tests and Results', source: 'generated', editable: true,
      references: { controls: 'controls/eng.json', findings: 'findings/eng.json' }
    });
    assert.equal(row.id, 'SEC-4');
    assert.equal(row.name, 'Controls, Tests and Results');
    assert.equal(row.sourceLabel, 'Generated');
    assert.equal(row.sourceTone, 'success');
    assert.equal(row.included, true, 'included defaults to true when the JSON omits the flag');
    assert.equal(row.editable, true);
    assert.deepEqual(Array.from(row.referenceKeys), ['controls', 'findings']);
    assert.equal(row.section.id, 'SEC-4', 'the raw section record is carried through for the Inspector');
  });

  test('deriveNavigatorRow reads an explicit included: false faithfully', function () {
    const row = derive.deriveNavigatorRow({ id: 'SEC-9', name: 'Appendices', included: false });
    assert.equal(row.included, false);
  });

  test('deriveNavigator renders every section once, in authored order — never re-sorted', function () {
    const navigator = Array.from(derive.deriveNavigator([
      { id: 'SEC-3', name: 'Second' },
      { id: 'SEC-1', name: 'First' }
    ]));
    assert.deepEqual(navigator.map(function (row) { return row.id; }), ['SEC-3', 'SEC-1'],
      'sections preserve the document authored order, not identifier order');
  });

  // ---- Documentation health — real counts only.

  test('deriveDocumentationHealth reads the document status, source counts, and included tally', function () {
    const health = Array.from(derive.deriveDocumentationHealth({
      document: { status: 'Draft' },
      sections: [
        { id: 'SEC-1', source: 'manual', included: true },
        { id: 'SEC-2', source: 'manual', included: true },
        { id: 'SEC-3', source: 'generated', included: false }
      ]
    }));
    const byLabel = {};
    health.forEach(function (item) { byLabel[item.label] = item; });
    assert.equal(byLabel['Document status'].status, 'Draft');
    assert.equal(byLabel['Manual sections'].status, '2');
    assert.equal(byLabel['Generated sections'].status, '1');
    assert.equal(byLabel['Sections included'].status, '2 of 3');
    assert.equal(byLabel['Sections included'].tone, 'warning', 'an excluded section reads a warning tone, never hidden');
  });

  test('deriveDocumentationHealth reads no documentation as a single Documentation / None indicator, never fabricated buckets', function () {
    const health = Array.from(derive.deriveDocumentationHealth({}));
    assert.equal(health.length, 1);
    assert.equal(health[0].label, 'Documentation');
    assert.equal(health[0].status, 'None');
    assert.equal(health[0].tone, 'success');
  });

  test('deriveDocumentationStatus reads the recorded document status, or No documentation when absent', function () {
    assert.equal(derive.deriveDocumentationStatus({ document: { status: 'Final' } }).label, 'Final');
    assert.equal(derive.deriveDocumentationStatus({ document: { status: 'Final' } }).tone, 'success');
    assert.equal(derive.deriveDocumentationStatus({}).label, 'No documentation');
    assert.equal(derive.deriveDocumentationStatus({}).tone, null);
  });

  // ---- Audit lineage — the methodology chain with Documentation highlighted.

  function fixtureRegistry() {
    return {
      IDS: { WALKTHROUGH: 'walkthrough', REQUIREMENTS: 'requirements', CONTROLS: 'controls', EVIDENCE: 'evidence', TESTING: 'testing', FINDINGS: 'findings', DOCUMENTATION: 'documentation' },
      findById: function (id) { return { id: id, path: 'path-' + id }; }
    };
  }

  test('deriveLineage renders the full chain with Documentation highlighted and real counts', function () {
    const lineage = Array.from(derive.deriveLineage(fixtureRegistry(), {
      requirements: { requirements: 104 }, controls: { controls: 52 }, evidence: { evidenceItems: 12 },
      testing: { tests: 100 }, findings: { findings: 5 }, documentation: { sections: 4 }
    }));
    assert.deepEqual(lineage.map(function (node) { return node.label; }), [
      'Walkthrough', 'Requirement', 'Control', 'Evidence', 'Testing', 'Finding', 'Documentation'
    ]);
    const docNode = lineage.filter(function (node) { return node.label === 'Documentation'; })[0];
    assert.equal(docNode.highlighted, true, 'the Documentation node is highlighted');
    assert.equal(docNode.count, 4);
    assert.equal(lineage[0].present, false, 'walkthrough carries no data and is never fabricated');
    assert.equal(derive.deriveLineage(null, {}).length, 0, 'no registry yields no lineage');
  });

  test('deriveRelationships lists only the domains with real data and never lists Documentation itself', function () {
    const relationships = Array.from(derive.deriveRelationships(fixtureRegistry(), {
      requirements: { requirements: 0 }, controls: { controls: 52 }, evidence: { evidenceItems: 0 },
      testing: { tests: 100 }, findings: { findings: 5 }
    }));
    assert.deepEqual(relationships.map(function (item) { return item.title; }), ['Findings', 'Testing', 'Controls']);
    assert.equal(relationships[0].path, 'path-findings');
  });

  // ---- Change summary + activity — only what the JSON records.

  test('deriveChangeSummary surfaces only dated section change history, and nothing when absent', function () {
    assert.deepEqual(Array.from(derive.deriveChangeSummary({ sections: [{ id: 'SEC-1', name: 'Scope' }] })), [],
      'the current demo documentation carries no dated section changes, so the summary stays empty — never fabricated');
    const summary = Array.from(derive.deriveChangeSummary({
      sections: [{ id: 'SEC-2', name: 'Controls', changeHistory: [{ date: '2026-02-01', title: 'Updated' }] }]
    }));
    assert.equal(summary.length, 1);
    assert.match(summary[0].title, /Controls/);
  });

  test('deriveActivity surfaces only dated document activity, and nothing when absent', function () {
    assert.deepEqual(Array.from(derive.deriveActivity({ document: { status: 'Draft' } })), [],
      'the current demo documentation carries no dated activity, so the feed stays empty — never fabricated');
    const activity = Array.from(derive.deriveActivity({ activity: [{ date: '2026-02-01', title: 'Section reviewed' }] }));
    assert.equal(activity.length, 1);
    assert.equal(activity[0].title, 'Section reviewed');
  });

  // ---- Metadata — only real document-level fields.

  test('deriveMetadata reads document metadata faithfully, empty tags when none recorded', function () {
    const metadata = derive.deriveMetadata(
      { metadata: { templateId: 'SOC2-T2-STD', reportId: 'RPT-1' }, document: { version: '0.1', status: 'Draft' }, generation: { renderEngine: 'Document Studio' } },
      { engagementLead: 'Lead Auditor' },
      { createdAt: '2025-01-01' }
    );
    assert.equal(metadata.version, '0.1');
    assert.equal(metadata.status, 'Draft');
    assert.equal(metadata.owner, 'Lead Auditor');
    assert.equal(metadata.templateId, 'SOC2-T2-STD');
    assert.equal(metadata.reportId, 'RPT-1');
    assert.equal(metadata.renderEngine, 'Document Studio');
    assert.deepEqual(Array.from(metadata.tags), [], 'no tags are recorded in the current demo documentation, and none are fabricated');
  });

  // ---- Automation contract — the real Release 2 seam the JSON records.

  test('deriveAutomationItems reads only the recorded future-automation flags', function () {
    const items = Array.from(derive.deriveAutomationItems({
      generation: { futureAutomation: { aiRegeneration: true, humanApprovalRequired: true, trackChanges: false } }
    }));
    const titles = items.map(function (item) { return item.title; });
    assert.ok(titles.some(function (t) { return /AI-assisted regeneration: Reserved for Release 2/.test(t); }));
    assert.ok(titles.some(function (t) { return /Human approval required: Reserved for Release 2/.test(t); }));
    assert.ok(titles.some(function (t) { return /Change tracking: Not configured/.test(t); }));
  });

  test('deriveAutomationItems reads no automation contract as empty, never fabricated', function () {
    assert.deepEqual(Array.from(derive.deriveAutomationItems({})), []);
  });

  // ---- Inspector — the host-agnostic detail configuration, placeholder where absent.

  function inspectorContext() {
    return {
      document: { title: 'SOC 2 Type II Report', version: '0.1', status: 'Draft' },
      reportsDocument: { generation: { futureAutomation: { aiRegeneration: true } } },
      metadata: { reportId: 'RPT-1' },
      counts: { evidence: 18, controls: 52, testing: 100, findings: 5 },
      frameworks: ['SOC 2 Type II']
    };
  }

  test('buildSectionInspector renders related counts only where the section references that domain', function () {
    const row = derive.deriveNavigatorRow({
      id: 'SEC-4', name: 'Controls, Tests and Results', source: 'generated', editable: true, included: true,
      references: { controls: 'controls/eng.json', evidence: 'evidence/eng.json' }
    });
    const inspector = derive.buildSectionInspector(row, inspectorContext());

    assert.equal(inspector.title, 'Controls, Tests and Results');
    assert.equal(inspector.badges[0].label, 'Generated');

    const sections = {};
    inspector.sections.forEach(function (section) { sections[section.title] = section; });
    const props = sections['Properties'].rows.reduce(function (acc, row2) { acc[row2.label] = row2.value; return acc; }, {});
    assert.equal(props['Document version'], '0.1');
    assert.equal(props['Document status'], 'Draft');
    assert.equal(props['Framework'], 'SOC 2 Type II');
    assert.match(sections['Related evidence'].items[0].title, /18 evidence item/);
    assert.match(sections['Related controls'].items[0].title, /52 control/);
    assert.equal(sections['Related testing'].items[0].title, 'No related testing recorded for this section.',
      'testing is not referenced by this section, so no related count is fabricated');
    assert.match(sections['Automation & governance'].items[0].title, /AI-assisted regeneration/);
  });

  test('buildSectionInspector renders reserved placeholders where the JSON records nothing', function () {
    const row = derive.deriveNavigatorRow({ id: 'SEC-1', name: 'Management Assertion', source: 'manual', editable: true, included: true });
    const inspector = derive.buildSectionInspector(row, { document: {}, reportsDocument: {}, metadata: {}, counts: {}, frameworks: [] });
    const sections = {};
    inspector.sections.forEach(function (section) { sections[section.title] = section; });
    assert.equal(sections['Current content'].items[0].title,
      'No content recorded. Release 1 renders documentation structure only; Release 2 adds AI-drafted section content for human approval.');
    assert.equal(sections['Related walkthroughs'].items[0].title,
      'No related walkthrough recorded. Release 2 traces walkthrough knowledge into documentation sections.');
    assert.equal(sections['Automation & governance'].kind, 'placeholder', 'no automation contract renders the reserved placeholder');
    assert.equal(sections['Activity'].kind, 'placeholder', 'the activity trail is a reserved placeholder in Release 1');
    assert.equal(sections['Approval history'].kind, 'placeholder', 'the approval history is a reserved placeholder in Release 1');
  });
};
