'use strict';

/**
 * Unit Tests — Findings Workspace Derivations
 *
 * Exercises the pure derivation helpers of the Findings Workspace with fixture
 * records (GitHub Issue #25 — Findings / Unit Tests). The helpers take plain
 * records and return plain view data — no DOM, no AuditOS.state — so these suites
 * verify the business-data bindings deterministically and offline. Fixtures mirror
 * the two finding shapes the demo datasets carry (a SOC 2 shape with a prior-year
 * knowledge-reuse block and a linked prior-year finding, and an ISO 27001 shape
 * with a framework, an Annex A section, and a cross-framework reuse block) without
 * embedding demo business content, so the workspace's central Release 1 promise —
 * render only what exists, resolve names only when identifiers genuinely join,
 * fabricate nothing, infer no conclusions — is asserted directly. The four
 * presentation views are asserted to regroup one dataset without changing it.
 *
 * Array.from normalizes vm-sandbox arrays into this realm so strict deepEqual
 * compares structure, not the sandbox Array.prototype (see tests/lib/prototype).
 */

const { loadFindingsWorkspace } = require('../lib/prototype');

module.exports = function registerUnitTests(harness) {
  const test = harness.test;
  const assert = harness.assert;
  const derive = loadFindingsWorkspace().derivations;

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

  // ---- Tone resolvers over the recorded severity / status vocabulary.

  test('resolveSeverityTone reads the recorded vocabulary, neutral when unmapped', function () {
    assert.equal(derive.resolveSeverityTone('High'), 'error');
    assert.equal(derive.resolveSeverityTone('Medium'), 'warning');
    assert.equal(derive.resolveSeverityTone('Low'), 'info');
    assert.equal(derive.resolveSeverityTone('Unknown'), 'info', 'an unmapped severity resolves to a neutral info tone');
  });

  test('resolveStatusTone reads the recorded vocabulary, neutral when unmapped', function () {
    assert.equal(derive.resolveStatusTone('Open'), 'warning');
    assert.equal(derive.resolveStatusTone('Closed'), 'success');
    assert.equal(derive.resolveStatusTone('Accepted Risk'), 'info');
    assert.equal(derive.resolveStatusTone('Unknown'), 'info', 'an unmapped status resolves to a neutral info tone');
  });

  // ---- Resolution context — the joins available to a finding.

  function rowContext() {
    return {
      controlsById: { 'ENGCTRL-9': { id: 'ENGCTRL-9', controlId: 'GOV-01', title: 'Information Security Policy', category: 'Governance', requirementIds: ['REQ-1', 'REQ-2'] } },
      libraryControlsById: { 'LIB-CTRL-0001': { id: 'LIB-CTRL-0001', controlCode: 'CSC-01', title: 'User Access Provisioning', controlFamilyId: 'CF-003' } },
      controlFamiliesById: { 'CF-003': { id: 'CF-003', name: 'Identity & Access Management' } },
      pocsById: { 'POC-001': { id: 'POC-001', name: 'Arjun Menon', designation: 'Director, Information Security' } },
      testsById: { 'TEST-1': { id: 'TEST-1', procedure: 'Inspect and verify' } },
      frameworks: ['SOC 2 Type II']
    };
  }

  // ---- Related control — resolved only where an identifier genuinely joins.

  test('resolveRelatedControl joins the shared control library by libraryControlId', function () {
    const related = derive.resolveRelatedControl({ controlId: 'ENGCTRL-1001', libraryControlId: 'LIB-CTRL-0001' }, rowContext());
    assert.equal(related.title, 'User Access Provisioning', 'the library control resolves to its master title');
    assert.equal(related.code, 'CSC-01');
    assert.equal(related.familyId, 'CF-003', 'the family id is carried through for domain resolution');
  });

  test('resolveRelatedControl renders the raw identifier when neither identifier joins', function () {
    const related = derive.resolveRelatedControl({ controlId: 'ENGCTRL-UNKNOWN' }, rowContext());
    assert.equal(related.title, '', 'no title is fabricated');
    assert.equal(related.id, 'ENGCTRL-UNKNOWN', 'the raw control identifier is preserved');
    assert.equal(derive.relatedControlLabel(related), 'ENGCTRL-UNKNOWN', 'the label falls back to the raw identifier');
  });

  // ---- Domain / owner / related test — read the join, render raw otherwise.

  test('resolveDomain resolves the audit domain through the library control family', function () {
    assert.equal(derive.resolveDomain({ libraryControlId: 'LIB-CTRL-0001' }, rowContext()), 'Identity & Access Management');
    assert.equal(derive.resolveDomain({ controlId: 'ENGCTRL-9' }, rowContext()), 'Governance', 'falls back to the engagement control category');
    assert.equal(derive.resolveDomain({ controlId: 'ENGCTRL-UNKNOWN' }, rowContext()), '', 'no domain is fabricated when nothing joins');
  });

  test('resolveOwner resolves a real person only when ownerPocId joins the directory', function () {
    assert.equal(derive.resolveOwner({ ownerPocId: 'POC-001' }, rowContext()).name, 'Arjun Menon');
    const unresolved = derive.resolveOwner({ ownerPocId: 'POC-999' }, rowContext());
    assert.equal(unresolved.name, '', 'no name is fabricated');
    assert.equal(derive.ownerLabel(unresolved), 'POC-999', 'the label falls back to the raw identifier');
  });

  test('resolveRelatedTest resolves the procedure only when testId joins', function () {
    assert.equal(derive.resolveRelatedTest({ testId: 'TEST-1' }, rowContext()).title, 'Inspect and verify');
    const unresolved = derive.resolveRelatedTest({ testId: 'TEST-9' }, rowContext());
    assert.equal(unresolved.title, '', 'no procedure is fabricated');
    assert.equal(unresolved.id, 'TEST-9', 'the raw test identifier is preserved');
  });

  test('resolveRelatedRequirements traces requirements only through a joined engagement control', function () {
    assert.deepEqual(Array.from(derive.resolveRelatedRequirements({ controlId: 'ENGCTRL-9' }, rowContext())), ['REQ-1', 'REQ-2']);
    assert.deepEqual(Array.from(derive.resolveRelatedRequirements({ controlId: 'ENGCTRL-UNKNOWN' }, rowContext())), [],
      'no requirement is fabricated when the control does not join');
  });

  // ---- Queue rows — resolve names where they join, render raw ids otherwise.

  test('deriveFindingRow maps a finding to display fields, resolving related objects where they join', function () {
    const row = derive.deriveFindingRow({
      id: 'OBS-1', controlId: 'ENGCTRL-1001', libraryControlId: 'LIB-CTRL-0001', testId: 'TEST-1',
      title: 'Firewall rule review evidence lacked documented approval', severity: 'Medium', status: 'Open',
      ownerPocId: 'POC-001', workingPaperId: 'WP-1004', reportable: true
    }, rowContext());
    assert.equal(row.id, 'OBS-1');
    assert.equal(row.severity, 'Medium');
    assert.equal(row.severityTone, 'warning');
    assert.equal(row.status, 'Open');
    assert.equal(row.statusTone, 'warning');
    assert.equal(row.controlLabel, 'CSC-01 · User Access Provisioning');
    assert.equal(row.domain, 'Identity & Access Management');
    assert.equal(row.ownerLabel, 'Arjun Menon');
    assert.equal(row.test.id, 'TEST-1');
    assert.equal(row.reportable, true);
  });

  test('deriveQueue renders every finding once, ordered by identifier', function () {
    const queue = Array.from(derive.deriveQueue([
      { id: 'OBS-2', title: 'Second' },
      { id: 'OBS-1', title: 'First' }
    ], rowContext()));
    assert.deepEqual(queue.map(function (row) { return row.id; }), ['OBS-1', 'OBS-2'], 'nothing is capped or dropped');
  });

  // ---- Findings health + remediation + status — real counts only.

  function sampleFindings() {
    return [
      { id: 'OBS-1', severity: 'High', status: 'Open', reportable: true },
      { id: 'OBS-2', severity: 'Medium', status: 'Closed', reportable: true },
      { id: 'OBS-3', severity: 'Low', status: 'Closed', reportable: false },
      { id: 'OBS-4', severity: 'Low', status: 'Accepted Risk', reportable: false }
    ];
  }

  test('deriveFindingsHealth counts statuses and severities present, plus a derived reportable indicator', function () {
    const health = Array.from(derive.deriveFindingsHealth(sampleFindings()));
    const byLabel = {};
    health.forEach(function (item) { byLabel[item.label] = item; });
    assert.equal(byLabel['Open'].status, '1', 'the Open count is a real count of records');
    assert.equal(byLabel['Closed'].status, '2');
    assert.equal(byLabel['Accepted Risk'].status, '1');
    assert.equal(byLabel['High'].status, '1', 'the High severity count is real');
    assert.equal(byLabel['Low'].status, '2');
    assert.equal(byLabel['Reportable'].status, '2', 'two findings are reportable');
  });

  test('deriveFindingsHealth reads an empty engagement as a single Findings / None indicator, never fabricated buckets', function () {
    const health = Array.from(derive.deriveFindingsHealth([]));
    assert.equal(health.length, 1);
    assert.equal(health[0].label, 'Findings');
    assert.equal(health[0].status, 'None');
    assert.equal(health[0].tone, 'success');
  });

  test('deriveRemediation reads real closed / open / accepted-risk counts, no estimate', function () {
    const remediation = derive.deriveRemediation(sampleFindings());
    assert.equal(remediation.total, 4);
    assert.equal(remediation.closed, 2);
    assert.equal(remediation.acceptedRisk, 1);
    assert.equal(remediation.open, 1, 'open is the total minus closed and accepted-risk');
  });

  test('deriveFindingsStatus reads No findings / Open findings / Resolved faithfully', function () {
    assert.equal(derive.deriveFindingsStatus([]).label, 'No findings');
    assert.equal(derive.deriveFindingsStatus(sampleFindings()).label, 'Open findings');
    assert.equal(derive.deriveFindingsStatus([{ status: 'Closed' }, { status: 'Accepted Risk' }]).label, 'Resolved',
      'closed and accepted-risk are both resolved states');
  });

  // ---- Four presentation modes over one dataset — regroup, never change the data.

  function sampleRows() {
    return Array.from(derive.deriveQueue([
      { id: 'OBS-1', libraryControlId: 'LIB-CTRL-0001', testId: 'TEST-1', severity: 'High', status: 'Open', ownerPocId: 'POC-001' },
      { id: 'OBS-2', controlId: 'ENGCTRL-9', severity: 'Low', status: 'Closed', ownerPocId: 'POC-001' },
      { id: 'OBS-3', controlId: 'ENGCTRL-UNKNOWN', severity: 'Medium', status: 'Closed', ownerPocId: 'POC-999' }
    ], rowContext()));
  }

  function countRows(view) {
    return Array.from(view.groups).reduce(function (total, group) { return total + Array.from(group.rows).length; }, 0);
  }

  test('the four views regroup exactly the same rows — presentation only, never a data change', function () {
    const rows = sampleRows();
    const views = Array.from(derive.deriveViews(rows));
    assert.deepEqual(views.map(function (view) { return view.id; }), ['finding', 'severity', 'domain', 'owner']);
    views.forEach(function (view) {
      assert.equal(countRows(view.view), rows.length, view.label + ' preserves every finding');
    });
  });

  test('findingView is the flat queue in a single group', function () {
    const view = derive.findingView(sampleRows());
    assert.equal(Array.from(view.groups).length, 1);
    assert.equal(Array.from(view.groups)[0].label, '');
  });

  test('severityView groups the same rows by severity, most severe first', function () {
    const view = derive.severityView(sampleRows());
    const labels = Array.from(view.groups).map(function (group) { return group.label; });
    assert.deepEqual(labels, ['High', 'Medium', 'Low'], 'the severity order is High before Medium before Low');
  });

  test('domainView groups the same rows by audit domain, unresolved domains labeled, never fabricated', function () {
    const view = derive.domainView(sampleRows());
    const labels = Array.from(view.groups).map(function (group) { return group.label; });
    assert.ok(labels.indexOf('Identity & Access Management') !== -1, 'the resolved domain is a real family name');
    assert.ok(labels.indexOf('Unassigned domain') !== -1, 'a finding whose control does not join reads Unassigned domain');
  });

  test('ownerView groups the same rows by owner, unresolved owners rendered as their raw identifier', function () {
    const view = derive.ownerView(sampleRows());
    const labels = Array.from(view.groups).map(function (group) { return group.label; });
    assert.ok(labels.indexOf('Arjun Menon') !== -1, 'the resolved owner is a real name');
    assert.ok(labels.indexOf('POC-999') !== -1, 'an owner that does not join renders its raw identifier, never a fabricated name');
  });

  // ---- Audit lineage — the methodology chain with Finding highlighted.

  function fixtureRegistry() {
    return {
      IDS: { WALKTHROUGH: 'walkthrough', REQUIREMENTS: 'requirements', CONTROLS: 'controls', EVIDENCE: 'evidence', TESTING: 'testing', FINDINGS: 'findings', REPORTING: 'reporting' },
      findById: function (id) { return { id: id, path: 'path-' + id }; }
    };
  }

  test('deriveLineage renders the full chain with Finding highlighted and real counts', function () {
    const lineage = Array.from(derive.deriveLineage(fixtureRegistry(), {
      requirements: { requirements: 104 }, controls: { controls: 52 }, evidence: { evidenceItems: 12 },
      testing: { tests: 100 }, findings: { findings: 5 }, report: null
    }));
    assert.deepEqual(lineage.map(function (node) { return node.label; }), [
      'Walkthrough', 'Requirement', 'Control', 'Evidence', 'Testing', 'Finding', 'Report'
    ]);
    const findingNode = lineage.filter(function (node) { return node.label === 'Finding'; })[0];
    assert.equal(findingNode.highlighted, true, 'the Finding node is highlighted');
    assert.equal(findingNode.count, 5);
    assert.equal(lineage[0].present, false, 'walkthrough carries no data and is never fabricated');
    assert.equal(derive.deriveLineage(null, {}).length, 0, 'no registry yields no lineage');
  });

  test('deriveRelationships lists only the domains with real data and never lists Findings itself', function () {
    const relationships = Array.from(derive.deriveRelationships(fixtureRegistry(), {
      requirements: { requirements: 0 }, controls: { controls: 52 }, evidence: { evidenceItems: 0 }, testing: { tests: 100 }, report: null
    }));
    assert.deepEqual(relationships.map(function (item) { return item.title; }), ['Testing', 'Controls']);
    assert.equal(relationships[0].path, 'path-testing');
  });

  // ---- Activity + metadata — only what the JSON records.

  test('deriveActivity surfaces only dated finding history, and nothing for undated findings', function () {
    assert.deepEqual(Array.from(derive.deriveActivity([{ id: 'OBS-1', status: 'Open' }])), [],
      'the current demo findings carry no dated events, so the feed stays empty — never fabricated');
    const activity = Array.from(derive.deriveActivity([{ id: 'OBS-2', updatedAt: '2026-02-01', status: 'Closed' }]));
    assert.equal(activity.length, 1);
    assert.match(activity[0].title, /OBS-2/);
  });

  test('deriveMetadata reads document metadata, collecting the real tags present', function () {
    const metadata = derive.deriveMetadata(
      { version: '2.0.0', dataset: 'Demo Findings', generatedAt: '2026-01-01T00:00:00Z' },
      { engagementLead: 'Lead Auditor' },
      { createdAt: '2025-01-01' },
      [{ tags: ['soc2', 'fy2026'] }, { tags: ['soc2'] }]
    );
    assert.equal(metadata.version, '2.0.0');
    assert.equal(metadata.source, 'Demo Findings');
    assert.equal(metadata.owner, 'Lead Auditor');
    assert.deepEqual(Array.from(metadata.tags), ['soc2', 'fy2026'], 'tags are the distinct real tags on the records');
  });

  // ---- Prior-year knowledge + remediation items — only the reuse block the record carries.

  test('derivePriorYearItems reads the SOC 2 prior-year block and linked prior-year finding', function () {
    const items = Array.from(derive.derivePriorYearItems({
      linkedPriorYearFindingId: 'OBS-005-05',
      knowledgeReuse: { priorFindingReviewed: true, sourceEngagementId: 'ENG-002' }
    }));
    const titles = items.map(function (item) { return item.title; });
    assert.ok(titles.some(function (t) { return /OBS-005-05/.test(t); }), 'the linked prior-year finding is surfaced');
    assert.ok(titles.some(function (t) { return /reviewed/i.test(t); }));
    assert.ok(titles.some(function (t) { return /ENG-002/.test(t); }));
  });

  test('derivePriorYearItems reads the ISO cross-framework reuse block', function () {
    const items = Array.from(derive.derivePriorYearItems({
      frameworkReuse: { sourceFramework: 'SOC 2 Type II', methodologyReusable: true, evidenceReusable: false }
    }));
    const titles = items.map(function (item) { return item.title; });
    assert.ok(titles.some(function (t) { return /SOC 2 Type II/.test(t); }));
    assert.ok(titles.some(function (t) { return /Methodology reusable/.test(t); }));
    assert.ok(!titles.some(function (t) { return /Evidence reusable/.test(t); }), 'ISO evidence is not reusable, and that is read faithfully');
  });

  test('derivePriorYearItems reads a finding with no reuse block as empty, never fabricated', function () {
    assert.deepEqual(Array.from(derive.derivePriorYearItems({})), []);
  });

  test('deriveRemediationItems reads only the recorded status, target date, and management response', function () {
    const items = Array.from(derive.deriveRemediationItems({ status: 'Open', targetClosureDate: '2027-03-11', managementResponse: 'Updated change workflow implemented.' }));
    const titles = items.map(function (item) { return item.title; });
    assert.ok(titles.some(function (t) { return /Status: Open/.test(t); }));
    assert.ok(titles.some(function (t) { return /Target closure: Mar 11, 2027/.test(t); }));
    assert.ok(titles.some(function (t) { return /Updated change workflow/.test(t); }));
    assert.deepEqual(Array.from(derive.deriveRemediationItems({})), [], 'a finding recording no remediation yields nothing');
  });

  // ---- Inspector — the host-agnostic detail configuration, placeholder where absent.

  test('buildFindingInspector renders every field with a real value and a placeholder where absent', function () {
    const inspector = derive.buildFindingInspector({
      id: 'OBS-1', controlId: 'ENGCTRL-1001', libraryControlId: 'LIB-CTRL-0001', testId: 'TEST-1',
      title: 'Firewall rule review evidence lacked documented approval', severity: 'Medium', status: 'Open',
      observation: 'Firewall rule review evidence lacked documented approval.',
      risk: 'Control effectiveness may be reduced until remediation is completed.',
      recommendation: 'Implement corrective action and validate through retesting.',
      managementResponse: 'Updated change workflow implemented.',
      ownerPocId: 'POC-001', workingPaperId: 'WP-1004', targetClosureDate: '2027-03-11', reportable: true,
      linkedPriorYearFindingId: 'OBS-005-05', knowledgeReuse: { priorFindingReviewed: true, sourceEngagementId: 'ENG-002' }
    }, rowContext());

    assert.equal(inspector.title, 'Firewall rule review evidence lacked documented approval');
    assert.equal(inspector.badges[0].label, 'Medium');
    assert.equal(inspector.badges[1].label, 'Open');
    assert.equal(inspector.badges[2].label, 'Reportable');

    const sections = {};
    inspector.sections.forEach(function (section) { sections[section.title] = section; });
    const props = sections['Properties'].rows.reduce(function (acc, row) { acc[row.label] = row.value; return acc; }, {});
    assert.equal(props['Related control'], 'CSC-01 · User Access Provisioning', 'the related control resolves, a real join');
    assert.equal(props['Owner'], 'Arjun Menon', 'the owner resolves through the directory');
    assert.equal(props['Domain'], 'Identity & Access Management');
    assert.equal(props['Related test'], 'TEST-1');
    assert.equal(props['Target closure'], 'Mar 11, 2027');
    assert.equal(props['Root cause'], undefined, 'a missing root cause is dropped from properties, never a fabricated value');
    assert.equal(sections['Description'].items[0].title, 'Firewall rule review evidence lacked documented approval.');
    assert.equal(sections['Impact'].items[0].title, 'Control effectiveness may be reduced until remediation is completed.');
    assert.equal(sections['Recommendation'].items[0].title, 'Implement corrective action and validate through retesting.');
    assert.match(sections['Prior-year knowledge'].items[0].title, /OBS-005-05/, 'a recorded prior-year link renders, never fabricated');
  });

  test('buildFindingInspector renders reserved placeholders where the JSON records nothing', function () {
    const inspector = derive.buildFindingInspector({ id: 'OBS-9', severity: 'Low', status: 'Open' }, {});
    const sections = {};
    inspector.sections.forEach(function (section) { sections[section.title] = section; });
    assert.equal(sections['Root cause'].items[0].title, 'No root cause recorded. Release 2 adds AI-recommended root causes for human approval.');
    assert.equal(sections['Prior-year knowledge'].kind, 'placeholder', 'no reuse block renders the reserved placeholder');
    assert.equal(sections['Activity'].kind, 'placeholder', 'the activity trail is a reserved placeholder in Release 1');
    assert.equal(sections['Approval history'].kind, 'placeholder', 'the approval history is a reserved placeholder in Release 1');
    assert.equal(sections['Related requirements'].items[0].title, 'No related requirement recorded for this finding. Release 2 traces requirements through the related control.');
  });
};
