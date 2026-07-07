'use strict';

/**
 * Unit Tests — Walkthrough Workspace Derivations
 *
 * Exercises the pure derivation helpers of the Walkthrough Workspace with
 * fixture records (GitHub Issue #20 — Testing / Unit Tests). The helpers take
 * plain records and return plain view data — no DOM, no AuditOS.state — so
 * these suites verify the business-data bindings deterministically and
 * offline. Fixtures mirror the future `walkthroughs` collection shape without
 * embedding demo business content; today that collection does not exist, so
 * every helper is exercised against fixtures rather than the live bundle
 * (covered instead by the integration suite's "no fabrication" contract).
 *
 * Array.from normalizes vm-sandbox arrays into this realm so strict deepEqual
 * compares structure, not the sandbox Array.prototype (see tests/lib/prototype).
 */

const { loadWalkthroughWorkspace } = require('../lib/prototype');

module.exports = function registerUnitTests(harness) {
  const test = harness.test;
  const assert = harness.assert;
  const derive = loadWalkthroughWorkspace().derivations;

  // ---- Formatters.

  test('formatDate behaves deterministically', function () {
    assert.equal(derive.formatDate('2027-01-05'), 'Jan 5, 2027');
    assert.equal(derive.formatDate('not-a-date'), 'not-a-date');
    assert.equal(derive.formatDate(undefined), '');
  });

  test('formatSessionDate prefers the completed date, then the scheduled date', function () {
    assert.equal(derive.formatSessionDate({ completedDate: '2027-02-01', scheduledDate: '2027-01-20' }), 'Feb 1, 2027');
    assert.equal(derive.formatSessionDate({ scheduledDate: '2027-01-20' }), 'Jan 20, 2027');
    assert.equal(derive.formatSessionDate({}), '');
  });

  // ---- Frameworks + current engagement (identical seam to the Engagement workspace).

  test('normalizeFrameworks wraps the current single-framework shape into an array', function () {
    assert.deepEqual(Array.from(derive.normalizeFrameworks({ framework: 'Alpha' })), ['Alpha']);
    assert.deepEqual(Array.from(derive.normalizeFrameworks({})), [], 'fabricates nothing when undeclared');
  });

  test('deriveCurrentEngagement prefers the first in-progress engagement, then falls back', function () {
    assert.equal(derive.deriveCurrentEngagement([
      { id: 'E-0', status: 'Completed' },
      { id: 'E-1', status: 'In Progress' }
    ]).id, 'E-1');
    assert.equal(derive.deriveCurrentEngagement([]), null);
  });

  // ---- Walkthrough status — the header / lifecycle vocabulary.

  test('deriveWalkthroughStatus reads not started with no sessions, never a fabricated count', function () {
    assert.equal(derive.deriveWalkthroughStatus([]).status, 'Not started');
    assert.equal(derive.deriveWalkthroughStatus([]).tone, null);
    assert.equal(derive.deriveWalkthroughStatus(undefined).status, 'Not started');
  });

  test('deriveWalkthroughStatus advances from scheduled to in progress to complete', function () {
    assert.equal(derive.deriveWalkthroughStatus([{ status: 'Scheduled' }]).status, 'Scheduled');
    assert.equal(derive.deriveWalkthroughStatus([{ status: 'Completed' }, { status: 'Scheduled' }]).status, 'In progress');
    assert.equal(derive.deriveWalkthroughStatus([{ status: 'Completed' }, { status: 'Completed' }]).status, 'Complete');
  });

  // ---- Last session.

  test('deriveLastSession picks the most recently dated session', function () {
    const last = derive.deriveLastSession([
      { title: 'Kickoff', completedDate: '2027-01-05' },
      { title: 'Follow-up', completedDate: '2027-02-10' },
      { title: 'Undated' }
    ]);
    assert.equal(last.title, 'Follow-up');
    assert.equal(derive.deriveLastSession([]), null);
    assert.equal(derive.deriveLastSession([{ title: 'Undated' }]), null, 'a session with no date is never picked');
  });

  // ---- Team participation.

  test('deriveTeamNames and countParticipatedTeamMembers derive real participation, never fabricated', function () {
    const names = Array.from(derive.deriveTeamNames(
      [{ name: 'Member A', companyId: 'C-1' }, { name: 'Member B', companyId: 'C-2' }],
      'C-1'
    ));
    assert.deepEqual(names, ['Member A']);
    const participated = derive.countParticipatedTeamMembers(['Member A', 'Member B'], [
      { participants: ['Member A'] }
    ]);
    assert.equal(participated, 1);
    assert.equal(derive.countParticipatedTeamMembers(['Member A'], []), 0);
  });

  // ---- Audit health — the walkthrough-scoped operational strip.

  test('deriveAuditHealth reads every indicator as absent when no sessions exist yet', function () {
    const health = Array.from(derive.deriveAuditHealth([], [], ['Member A', 'Member B']));
    assert.deepEqual(health.map(function (item) { return item.label; }), [
      'Sessions completed', 'Sessions pending', 'Open questions', 'Evidence dependencies', 'Teams pending'
    ]);
    assert.equal(health[0].status, 'None');
    assert.equal(health[1].status, 'Awaiting');
    assert.equal(health[2].status, 'None');
    assert.equal(health[3].status, 'None');
    assert.equal(health[4].status, '2 Pending', 'both real team members are pending with no sessions recorded');
  });

  test('deriveAuditHealth reflects real session, question, and participation records', function () {
    const health = Array.from(derive.deriveAuditHealth(
      [
        { status: 'Completed', participants: ['Member A'], linkedEvidence: ['EV-1', 'EV-2'] },
        { status: 'Scheduled', participants: [] }
      ],
      [{ status: 'Open' }, { status: 'Resolved' }],
      ['Member A', 'Member B']
    ));
    assert.equal(health[0].status, '1 of 2');
    assert.equal(health[1].status, '1 Pending');
    assert.equal(health[2].status, '1 Open');
    assert.equal(health[3].status, '2 Linked');
    assert.equal(health[4].status, '1 Pending', 'Member B has not yet participated in a session');
  });

  // ---- Process coverage.

  test('deriveProcessCoverage counts sessions linked by processId or the linkedProcesses list', function () {
    const coverage = Array.from(derive.deriveProcessCoverage(
      [{ id: 'PROC-1', name: 'Identity', category: 'IT' }, { id: 'PROC-2', name: 'HR' }],
      [
        { processId: 'PROC-1' },
        { linkedProcesses: ['PROC-1', 'PROC-2'] }
      ]
    ));
    assert.equal(coverage[0].sessionCount, 2);
    assert.equal(coverage[0].status, 'Covered');
    assert.equal(coverage[1].sessionCount, 1);
    assert.equal(derive.deriveProcessCoverage([{ id: 'PROC-3', name: 'Vendor' }], []).length, 1);
    assert.equal(derive.deriveProcessCoverage([{ id: 'PROC-3', name: 'Vendor' }], [])[0].status, 'Not covered');
  });

  // ---- Relationships — the audit chain the walkthrough feeds.

  function fixtureRegistry() {
    return {
      IDS: { EVIDENCE: 'evidence', CONTROLS: 'controls', TESTING: 'testing', FINDINGS: 'findings', REPORTING: 'reporting' },
      findById: function (id) { return { id: id, path: 'path-' + id }; }
    };
  }

  test('deriveRelationships lists only the domains with real data, in chain order', function () {
    const relationships = Array.from(derive.deriveRelationships(fixtureRegistry(), {
      requirements: { requirements: 104 },
      controls: { controls: 52 },
      evidence: { evidenceItems: 20 },
      testing: {},
      findings: {},
      report: null
    }));
    assert.deepEqual(relationships.map(function (item) { return item.title; }), ['Requirements', 'Controls', 'Evidence']);
    assert.equal(relationships[0].meta, '104');
    assert.equal(relationships[0].path, 'path-evidence');
    assert.equal(derive.deriveRelationships(fixtureRegistry(), {}).length, 0, 'nothing recorded yields no relationships');
    assert.equal(derive.deriveRelationships(null, {}).length, 0, 'no registry yields no relationships');
  });

  // ---- Timeline + activity.

  test('deriveTimeline lists dated sessions chronologically, excluding undated ones', function () {
    const timeline = Array.from(derive.deriveTimeline([
      { title: 'Second', status: 'Completed', completedDate: '2027-02-01' },
      { title: 'First', status: 'Scheduled', scheduledDate: '2027-01-10' },
      { title: 'Undated' }
    ]));
    assert.deepEqual(timeline.map(function (event) { return event.title; }),
      ['Scheduled: First', 'Completed: Second']);
  });

  test('deriveActivity lists completed sessions newest first', function () {
    const activity = Array.from(derive.deriveActivity([
      { title: 'Older', status: 'Completed', completedDate: '2027-01-01', owner: 'Auditor A' },
      { title: 'Newer', status: 'Completed', completedDate: '2027-02-01' },
      { title: 'Not yet', status: 'Scheduled', scheduledDate: '2027-03-01' }
    ]));
    assert.equal(activity.length, 2, 'only completed, dated sessions are activity');
    assert.match(activity[0].title, /Newer/);
    assert.match(activity[1].meta, /Auditor A/);
  });

  // ---- Session detail — the Walkthrough Detail composition.

  test('deriveSessionDetail renders every field with a real value, and a placeholder where absent', function () {
    const detail = derive.deriveSessionDetail({
      title: 'Identity Access Review', owner: 'J. Smith', status: 'Completed', completedDate: '2027-01-15',
      objective: 'Understand the access provisioning process.',
      participants: ['A. Auditor', { name: 'B. Client' }],
      linkedEvidence: ['EV-100']
    });
    assert.equal(detail.title, 'Identity Access Review');
    assert.equal(detail.eyebrow, 'J. Smith');
    assert.match(detail.subtitle, /Jan 15, 2027/);
    assert.equal(detail.badges[0].label, 'Completed');

    const sections = {};
    detail.sections.forEach(function (section) { sections[section.title] = section; });
    assert.deepEqual(sections.Objective.items[0].title, 'Understand the access provisioning process.');
    assert.deepEqual(sections.Participants.items.map(function (item) { return item.title; }),
      ['A. Auditor', 'B. Client']);
    assert.equal(sections.Notes.items[0].title, 'No notes captured for this session.',
      'an absent field renders a placeholder row, never fabricated content');
    assert.equal(sections['Linked evidence'].items[0].title, 'EV-100');
    assert.equal(sections['Linked processes'].items[0].title, 'No linked processes yet.');
  });

  test('deriveSessionDetail degrades gracefully for a session with no fields at all', function () {
    const detail = derive.deriveSessionDetail({});
    assert.equal(detail.title, '');
    assert.equal(detail.badges.length, 0);
    assert.equal(detail.sections.length, 9, 'all nine detail sections still render, each with a placeholder');
  });
};
