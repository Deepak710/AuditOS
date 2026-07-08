'use strict';

/**
 * Unit Tests — Operational Work Queue Workspace Derivations
 *
 * Exercises the pure derivation helpers of the Work Queue Workspace with
 * fixture records (GitHub Issue #28 — Work Queue / Unit Tests). The helpers
 * take plain records and return plain view data — no DOM, no AuditOS.state —
 * so these suites verify the cross-workspace aggregation, the priority
 * classification, and the two presentation-only filters deterministically and
 * offline. Fixtures mirror the shapes the demo `findings`, `testing`,
 * `controls`, `evidence-requirements`, `evidence`, `evidence-requests`, and
 * `reports` documents carry, without embedding demo business content, so the
 * workspace's central Release 1 promise — aggregate only what already exists,
 * classify priority only from a record's own real status/severity/result,
 * fabricate nothing — is asserted directly.
 *
 * Array.from normalizes vm-sandbox arrays into this realm so strict deepEqual
 * compares structure, not the sandbox Array.prototype (see tests/lib/prototype).
 */

const { loadWorkQueueWorkspace } = require('../lib/prototype');

module.exports = function registerUnitTests(harness) {
  const test = harness.test;
  const assert = harness.assert;
  const derive = loadWorkQueueWorkspace().derivations;

  // ---- Formatters + frameworks + current engagement (identical seam to every other workspace).

  test('formatDate behaves deterministically', function () {
    assert.equal(derive.formatDate('2027-03-11'), 'Mar 11, 2027');
    assert.equal(derive.formatDate(undefined), '');
  });

  test('deriveCurrentEngagement prefers the first in-progress engagement, then falls back', function () {
    assert.equal(derive.deriveCurrentEngagement([
      { id: 'E-0', status: 'Completed' },
      { id: 'E-1', status: 'In Progress' }
    ]).id, 'E-1');
    assert.equal(derive.deriveCurrentEngagement([]), null);
  });

  // ---- Priority classification — the Work Queue's own vocabulary, derived only
  // from a record's real status and, where a domain records one, an escalation
  // signal (severity, result, or a recorded priority).

  test('classifyPriority reads a terminal status as Completed regardless of escalation', function () {
    assert.equal(derive.classifyPriority('Approved', 'blocking'), 'Completed');
    assert.equal(derive.classifyPriority('Completed', 'high'), 'Completed');
    assert.equal(derive.classifyPriority('Closed', null), 'Completed');
  });

  test('classifyPriority reads a blocking escalation or a blocking status as Blocking', function () {
    assert.equal(derive.classifyPriority('Open', 'blocking'), 'Blocking');
    assert.equal(derive.classifyPriority('Rejected', null), 'Blocking');
    assert.equal(derive.classifyPriority('Pending', 'blocking'), 'Blocking');
  });

  test('classifyPriority reads a high escalation or a review status as High', function () {
    assert.equal(derive.classifyPriority('Pending', 'high'), 'High');
    assert.equal(derive.classifyPriority('Pending Review', null), 'High');
    assert.equal(derive.classifyPriority('Submitted', null), 'High');
  });

  test('classifyPriority falls back to Normal for every other real status', function () {
    assert.equal(derive.classifyPriority('Draft', null), 'Normal');
    assert.equal(derive.classifyPriority('In Progress', null), 'Normal');
    assert.equal(derive.classifyPriority('', null), 'Normal');
  });

  test('escalateFromSeverity elevates Critical/High to blocking, Medium to high, else none', function () {
    assert.equal(derive.escalateFromSeverity('Critical'), 'blocking');
    assert.equal(derive.escalateFromSeverity('High'), 'blocking');
    assert.equal(derive.escalateFromSeverity('Medium'), 'high');
    assert.equal(derive.escalateFromSeverity('Low'), null);
    assert.equal(derive.escalateFromSeverity(undefined), null);
  });

  test('escalateFromResult elevates a Fail result to blocking, never a Pass or absent result', function () {
    assert.equal(derive.escalateFromResult('Fail'), 'blocking');
    assert.equal(derive.escalateFromResult('Pass'), null);
    assert.equal(derive.escalateFromResult(''), null);
  });

  test('escalateFromRecordedPriority reads a recorded High/Medium priority, never a fabricated one', function () {
    assert.equal(derive.escalateFromRecordedPriority('High'), 'blocking');
    assert.equal(derive.escalateFromRecordedPriority('Medium'), 'high');
    assert.equal(derive.escalateFromRecordedPriority('Low'), null);
  });

  // ---- Related control — resolved only through the engagement's own control set.

  test('relatedControlLabel joins the engagement control set, or renders the raw identifier', function () {
    const controlsById = { 'CTRL-1': { controlId: 'GOV-01', title: 'Information Security Policy' } };
    assert.equal(derive.relatedControlLabel('CTRL-1', controlsById), 'GOV-01 · Information Security Policy');
    assert.equal(derive.relatedControlLabel('CTRL-9', controlsById), 'CTRL-9', 'an unresolved identifier renders raw, never fabricated');
    assert.equal(derive.relatedControlLabel('', controlsById), '');
  });

  // ---- Per-domain work item derivation — one item per real record, priority
  // classified from that record's own real fields.

  test('deriveFindingItems maps a finding to a work item, escalating severity over status', function () {
    const items = Array.from(derive.deriveFindingItems([
      { id: 'FIND-1', title: 'Access review gap', status: 'Open', severity: 'Critical', controlId: 'CTRL-1', ownerPocId: 'POC-1', targetClosureDate: '2026-02-01' }
    ], { controlsById: { 'CTRL-1': { controlId: 'GOV-01', title: 'Policy' } }, pocsById: { 'POC-1': { name: 'Jordan Lee' } } }));
    assert.equal(items.length, 1);
    assert.equal(items[0].itemType, 'Findings');
    assert.equal(items[0].title, 'Access review gap');
    assert.equal(items[0].owner, 'Jordan Lee');
    assert.equal(items[0].priority, 'Blocking', 'a Critical, still-open finding is Blocking');
    assert.equal(items[0].meta, 'GOV-01 · Policy');
    assert.equal(items[0].record.id, 'FIND-1', 'the raw finding record is carried through for the Inspector');
  });

  test('deriveFindingItems reads a Closed finding as Completed regardless of severity', function () {
    const items = Array.from(derive.deriveFindingItems([
      { id: 'FIND-2', status: 'Closed', severity: 'Critical' }
    ], {}));
    assert.equal(items[0].priority, 'Completed');
  });

  test('deriveTestingItems escalates a Fail result to Blocking while the test is still outstanding', function () {
    const items = Array.from(derive.deriveTestingItems([
      { id: 'TEST-1', procedure: 'Inspect access logs', status: 'Pending Review', result: 'Fail', testedBy: 'USR-1' }
    ], {}));
    assert.equal(items[0].itemType, 'Testing');
    assert.equal(items[0].owner, 'USR-1');
    assert.equal(items[0].priority, 'Blocking', 'a Fail result on a non-terminal test needs attention');
  });

  test('deriveTestingItems reads a Completed test with a Fail result as Completed — the exception is tracked via its linked finding', function () {
    // The demo testing datasets always pair a Fail result with status
    // "Completed" (status is the procedure's execution state, not its
    // assurance outcome) and a real findingId; the finding itself already
    // surfaces as its own Blocking work item from its severity, so the test
    // record does not also read Blocking — otherwise the same exception would
    // double-count across two categories.
    const items = Array.from(derive.deriveTestingItems([
      { id: 'TEST-2', status: 'Completed', result: 'Fail', findingId: 'OBS-1' }
    ], {}));
    assert.equal(items[0].priority, 'Completed');
  });

  test('deriveTestingItems reads a Pending test with a Pass-less result as Normal', function () {
    const items = Array.from(derive.deriveTestingItems([{ id: 'TEST-2', status: 'Pending' }], {}));
    assert.equal(items[0].priority, 'Normal');
  });

  test('deriveControlItems resolves the owner across the recorded field shapes', function () {
    const items = Array.from(derive.deriveControlItems([
      { id: 'CTRL-1', title: 'Policy', controlOwner: 'POC-1', status: 'Rejected' }
    ]));
    assert.equal(items[0].itemType, 'Controls');
    assert.equal(items[0].owner, 'POC-1');
    assert.equal(items[0].priority, 'Blocking');
  });

  test('deriveRequirementItems escalates a recorded High priority to Blocking', function () {
    const items = Array.from(derive.deriveRequirementItems([
      { id: 'REQ-1', title: 'Change management evidence', status: 'Pending', priority: 'High', primaryPocId: 'POC-1' }
    ], { pocsById: { 'POC-1': { name: 'Alex Rivera' } } }));
    assert.equal(items[0].itemType, 'Requirements');
    assert.equal(items[0].owner, 'Alex Rivera');
    assert.equal(items[0].priority, 'Blocking');
  });

  test('deriveEvidenceRequestItems titles the item from the related requirement and reads the recorded due date', function () {
    const items = Array.from(derive.deriveEvidenceRequestItems([
      { id: 'REQST-1', requirementId: 'REQ-1', status: 'Pending', priority: 'Medium', dueDate: '2026-01-09', assignedToPocId: 'POC-1' }
    ], { requirementsById: { 'REQ-1': { title: 'Change management evidence' } }, pocsById: { 'POC-1': { name: 'Alex Rivera' } } }));
    assert.equal(items[0].itemType, 'Evidence');
    assert.equal(items[0].subtype, 'Request');
    assert.equal(items[0].title, 'Evidence request · Change management evidence');
    assert.equal(items[0].owner, 'Alex Rivera');
    assert.equal(items[0].dueDate, '2026-01-09');
    assert.equal(items[0].priority, 'High', 'a Medium recorded priority escalates a Pending request to High');
    assert.equal(items[0].related.value, 'Change management evidence');
  });

  test('deriveEvidenceRequestItems reads an Accepted request as Completed regardless of recorded priority', function () {
    const items = Array.from(derive.deriveEvidenceRequestItems([
      { id: 'REQST-2', status: 'Accepted', priority: 'High' }
    ], {}));
    assert.equal(items[0].priority, 'Completed');
  });

  test('deriveEvidenceLibraryItems reads the review status as the item status and priority source', function () {
    const items = Array.from(derive.deriveEvidenceLibraryItems([
      { id: 'EV-1', title: 'Access log export', reviewStatus: 'Pending Review', uploadedByPocId: 'POC-2' }
    ], { pocsById: { 'POC-2': { name: 'Sam Patel' } } }));
    assert.equal(items[0].itemType, 'Evidence');
    assert.equal(items[0].subtype, 'Item');
    assert.equal(items[0].owner, 'Sam Patel');
    assert.equal(items[0].status, 'Pending Review');
    assert.equal(items[0].priority, 'High');
  });

  test('deriveDocumentationItems yields exactly one item when a report document exists, none otherwise', function () {
    const withDoc = Array.from(derive.deriveDocumentationItems(
      { document: { title: 'SOC 2 Report', status: 'Draft', version: '1.0' }, metadata: { reportId: 'RPT-1' } },
      { engagementLead: 'Morgan Diaz' }
    ));
    assert.equal(withDoc.length, 1);
    assert.equal(withDoc[0].itemType, 'Documentation');
    assert.equal(withDoc[0].owner, 'Morgan Diaz');
    assert.equal(withDoc[0].priority, 'Normal', 'a Draft document has not reached a terminal status');

    const withoutDoc = Array.from(derive.deriveDocumentationItems({}, {}));
    assert.equal(withoutDoc.length, 0, 'no report document yields no fabricated work item');
  });

  test('deriveWalkthroughItems always yields zero items — no demo-data collection exists for walkthroughs', function () {
    assert.deepEqual(Array.from(derive.deriveWalkthroughItems()), []);
  });

  // ---- Queue ordering, health, status, and filtering — all pure over the
  // aggregated item set.

  function fixtureItem(itemType, title, priority) {
    return { itemType: itemType, title: title, priority: priority, record: {} };
  }

  test('deriveQueue orders by priority first, then item type, then title', function () {
    const queue = Array.from(derive.deriveQueue([
      fixtureItem('Testing', 'B test', 'Normal'),
      fixtureItem('Findings', 'A finding', 'Blocking'),
      fixtureItem('Controls', 'A control', 'Normal'),
      fixtureItem('Findings', 'Z finding', 'Completed')
    ]));
    assert.deepEqual(queue.map(function (item) { return item.title; }),
      ['A finding', 'A control', 'B test', 'Z finding']);
  });

  test('deriveWorkQueueHealth reads a single None indicator for an empty queue, never a fabricated bucket', function () {
    const health = Array.from(derive.deriveWorkQueueHealth([]));
    assert.equal(health.length, 1);
    assert.equal(health[0].label, 'Work items');
    assert.equal(health[0].status, 'None');
  });

  test('deriveWorkQueueHealth counts real items per category and flags a Blocking category with an error tone', function () {
    const health = Array.from(derive.deriveWorkQueueHealth([
      fixtureItem('Findings', 'A', 'Blocking'),
      fixtureItem('Findings', 'B', 'Normal'),
      fixtureItem('Testing', 'C', 'Normal')
    ]));
    const byLabel = {};
    health.forEach(function (item) { byLabel[item.label] = item; });
    assert.equal(byLabel.Findings.status, '2');
    assert.equal(byLabel.Findings.tone, 'error', 'a category holding a Blocking item reads an error tone');
    assert.equal(byLabel.Testing.status, '1');
    assert.equal(byLabel.Testing.tone, 'info');
    assert.equal(byLabel.Blocking.status, '1');
  });

  test('deriveWorkQueueStatus reads No work items, a Blocking count, an Open count, or All clear', function () {
    assert.equal(derive.deriveWorkQueueStatus([]).label, 'No work items');
    assert.equal(derive.deriveWorkQueueStatus([fixtureItem('Findings', 'A', 'Blocking')]).label, '1 blocking');
    assert.equal(derive.deriveWorkQueueStatus([fixtureItem('Findings', 'A', 'Normal')]).label, '1 open');
    assert.equal(derive.deriveWorkQueueStatus([fixtureItem('Findings', 'A', 'Completed')]).label, 'All clear');
  });

  test('filterQueue combines the workspace filter and the priority filter, "All" matching everything', function () {
    const queue = [
      fixtureItem('Findings', 'A', 'Blocking'),
      fixtureItem('Testing', 'B', 'Blocking'),
      fixtureItem('Findings', 'C', 'Normal')
    ];
    assert.equal(Array.from(derive.filterQueue(queue, 'All workspaces', 'All priorities')).length, 3);
    assert.equal(Array.from(derive.filterQueue(queue, 'Findings', 'All priorities')).length, 2);
    assert.equal(Array.from(derive.filterQueue(queue, 'All workspaces', 'Blocking')).length, 2);
    assert.equal(Array.from(derive.filterQueue(queue, 'Findings', 'Blocking')).length, 1);
    assert.equal(Array.from(derive.filterQueue(queue, 'Findings', 'Blocking'))[0].title, 'A');
  });

  // ---- Related information, activity, and metadata.

  test('deriveRelationships resolves only categories the queue actually holds, against the Workspace Registry', function () {
    const fakeRegistry = {
      IDS: { WALKTHROUGH: 'walkthrough', EVIDENCE: 'evidence', REQUIREMENTS: 'requirements', CONTROLS: 'controls', TESTING: 'testing', FINDINGS: 'findings', DOCUMENTATION: 'documentation' },
      findById: function (id) { return id ? { id: id, label: id, path: id } : null; }
    };
    const related = Array.from(derive.deriveRelationships(fakeRegistry, [
      fixtureItem('Findings', 'A', 'Blocking')
    ]));
    assert.equal(related.length, 1, 'only categories present in the queue are related');
    assert.equal(related[0].title, 'Findings');
    assert.equal(related[0].meta, '1');
  });

  test('deriveRelationships returns nothing without a registry', function () {
    assert.deepEqual(Array.from(derive.deriveRelationships(null, [])), []);
  });

  test('deriveActivity reads only dated history a source record carries, newest first', function () {
    const queue = [
      { itemType: 'Findings', title: 'A', status: 'Open', statusTone: 'warning', record: { activityHistory: [{ date: '2026-01-01', title: 'Opened' }] } },
      { itemType: 'Testing', title: 'B', status: 'Completed', statusTone: 'success', record: { activityHistory: [{ date: '2026-02-01', title: 'Completed' }] } }
    ];
    const activity = Array.from(derive.deriveActivity(queue));
    assert.equal(activity.length, 2);
    assert.equal(activity[0].title.indexOf('Completed: B'), 0, 'the newest event sorts first');
  });

  test('deriveActivity yields an empty feed when no record carries dated history — never a fabricated event', function () {
    assert.deepEqual(Array.from(derive.deriveActivity([{ itemType: 'Findings', title: 'A', record: {} }])), []);
  });

  test('deriveMetadata reads Created and Owner from the company and the engagement lead', function () {
    const metadata = derive.deriveMetadata({ engagementLead: 'Morgan Diaz' }, { createdAt: '2025-01-01' });
    assert.equal(metadata.owner, 'Morgan Diaz');
    assert.equal(metadata.created, 'Jan 1, 2025');
    assert.equal(metadata.updated, '', 'no cross-domain updated timestamp is recorded, so it is never fabricated');
  });

  // ---- Work Item Inspector — pure, host-agnostic configuration.

  test('buildItemInspector renders the related object and the required action only when the item carries them', function () {
    const withData = derive.buildItemInspector({
      itemType: 'Findings', title: 'Access review gap', status: 'Open', statusTone: 'warning',
      owner: 'Jordan Lee', priority: 'Blocking', priorityTone: 'error',
      related: { label: 'Related control', value: 'GOV-01 · Policy' }, actionText: 'Restrict access immediately'
    });
    const related = withData.sections.filter(function (s) { return s.title === 'Related object'; })[0];
    assert.equal(related.items[0].title, 'Related control: GOV-01 · Policy');
    const action = withData.sections.filter(function (s) { return s.title === 'Required action'; })[0];
    assert.equal(action.items[0].title, 'Restrict access immediately');

    const withoutData = derive.buildItemInspector({ itemType: 'Controls', title: 'Policy', status: 'Draft', priority: 'Normal' });
    const relatedEmpty = withoutData.sections.filter(function (s) { return s.title === 'Related object'; })[0];
    assert.equal(relatedEmpty.items[0].title, 'No related object recorded for this item.');
    const actionEmpty = withoutData.sections.filter(function (s) { return s.title === 'Required action'; })[0];
    assert.match(actionEmpty.items[0].title, /No required action recorded/);
  });

  test('buildItemInspector carries the item type, priority, and status as badges', function () {
    const config = derive.buildItemInspector({
      itemType: 'Testing', title: 'Inspect access logs', status: 'Completed', statusTone: 'success',
      priority: 'Blocking', priorityTone: 'error'
    });
    assert.deepEqual(Array.from(config.badges).map(function (b) { return b.label; }), ['Blocking', 'Completed']);
  });
};
