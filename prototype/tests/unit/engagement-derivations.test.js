'use strict';

/**
 * Unit Tests — Engagement Workspace Derivations
 *
 * Exercises the pure derivation helpers of the Engagement Workspace with
 * fixture records (GitHub Issue #19 — Testing / Unit Tests). The helpers take
 * plain records and return plain view data — no DOM, no AuditOS.state — so
 * these suites verify the business-data bindings deterministically and offline.
 * Fixtures mirror the demo-data record shapes without embedding demo business
 * content.
 *
 * The load-bearing cases: the operational focus (what the audit is working on),
 * the next actions and blocking items (what to work on next), the lifecycle
 * navigation (the audit workflow), and the frameworks array seam (Release 1 →
 * Release 2 forward compatibility). Array.from normalizes vm-sandbox arrays into
 * this realm so strict deepEqual compares structure, not the sandbox
 * Array.prototype (see tests/lib/prototype).
 */

const { loadEngagementWorkspace } = require('../lib/prototype');

/** A registry fixture exposing the ids and lookups the derivations consume. */
function fixtureRegistry() {
  return {
    IDS: {
      WALKTHROUGH: 'walkthrough', CONTROLS: 'controls', EVIDENCE: 'evidence',
      TESTING: 'testing', FINDINGS: 'findings', REPORTING: 'reporting'
    },
    findById: function (id) { return { id: id, label: 'Label ' + id, path: 'path-' + id }; }
  };
}

/** Operational figures in the per-engagement summary shapes. */
function fixtureOperational() {
  return {
    controls: { controls: 52 },
    evidence: { evidenceItems: 20, approved: 12, pendingReview: 6 },
    requests: { pending: 4 },
    testing: { tests: 100, passed: 74, failed: 5, pending: 21 },
    findings: { findings: 5, open: 2 },
    report: { title: 'Fixture report', status: 'Draft', version: '0.1' }
  };
}

module.exports = function registerUnitTests(harness) {
  const test = harness.test;
  const assert = harness.assert;
  const derive = loadEngagementWorkspace().derivations;

  // ---- Formatters.

  test('formatDate / formatPeriod / formatPercent behave deterministically', function () {
    assert.equal(derive.formatDate('2027-01-05'), 'Jan 5, 2027');
    assert.equal(derive.formatDate('not-a-date'), 'not-a-date');
    assert.equal(derive.formatDate(undefined), '');
    assert.equal(derive.formatPeriod({ startDate: '2026-01-01', endDate: '2026-12-31' }),
      'Jan 1, 2026 – Dec 31, 2026');
    assert.equal(derive.formatPeriod(null), '');
    assert.equal(derive.formatPercent(74, 100), 74);
    assert.equal(derive.formatPercent(5, 0), 0);
  });

  // ---- Current engagement (identical rule to Home for persistent context).

  test('deriveCurrentEngagement prefers the first in-progress engagement, then falls back', function () {
    assert.equal(derive.deriveCurrentEngagement([
      { id: 'E-0', status: 'Completed' },
      { id: 'E-1', status: 'In Progress' }
    ]).id, 'E-1');
    assert.equal(derive.deriveCurrentEngagement([{ id: 'E-0', status: 'Planning' }]).id, 'E-0');
    assert.equal(derive.deriveCurrentEngagement([]), null);
    assert.equal(derive.deriveCurrentEngagement(undefined), null);
  });

  // ---- Deep-link record id (Issue #31 contract, restored by the Issue #32 follow-up fix).

  test('deriveCurrentEngagement renders the routed record id when it resolves to a real engagement', function () {
    const engagements = [
      { id: 'E-0', status: 'In Progress' },
      { id: 'E-1', status: 'In Progress' },
      { id: 'E-2', status: 'Completed' }
    ];
    assert.equal(derive.deriveCurrentEngagement(engagements, 'E-2').id, 'E-2',
      'a valid target id opens that exact engagement, even when another is the default in-progress pick');
    assert.equal(derive.deriveCurrentEngagement(engagements, 'E-1').id, 'E-1');
  });

  test('deriveCurrentEngagement falls back to the default rule when the target id is absent or unknown', function () {
    const engagements = [
      { id: 'E-0', status: 'Completed' },
      { id: 'E-1', status: 'In Progress' }
    ];
    assert.equal(derive.deriveCurrentEngagement(engagements, 'E-404').id, 'E-1',
      'a stale or unknown route id falls back to today\'s default, never throws, never renders nothing');
    assert.equal(derive.deriveCurrentEngagement(engagements, '').id, 'E-1', 'an empty target id preserves the default rule');
    assert.equal(derive.deriveCurrentEngagement(engagements).id, 'E-1', 'an omitted target id preserves the default rule');
  });

  // ---- Frameworks — the Release 1 → Release 2 extensibility seam.

  test('normalizeFrameworks wraps the current single-framework shape into an array', function () {
    assert.deepEqual(Array.from(derive.normalizeFrameworks({ framework: 'Alpha' })), ['Alpha']);
  });

  test('normalizeFrameworks renders a future frameworks array as-is, and prefers it', function () {
    assert.deepEqual(Array.from(derive.normalizeFrameworks({ frameworks: ['Alpha', 'Beta', 'Gamma'] })),
      ['Alpha', 'Beta', 'Gamma']);
    assert.deepEqual(Array.from(derive.normalizeFrameworks({ frameworks: ['Alpha', 'Beta'], framework: 'Alpha' })),
      ['Alpha', 'Beta'], 'the array takes precedence over the single field');
  });

  test('normalizeFrameworks fabricates nothing when no framework is declared', function () {
    assert.deepEqual(Array.from(derive.normalizeFrameworks({})), []);
    assert.deepEqual(Array.from(derive.normalizeFrameworks(null)), []);
  });

  // ---- Operational focus — what the audit is actually working on.

  test('deriveOperationalFocus names the earliest incomplete stage, status stays separate', function () {
    const focus = derive.deriveOperationalFocus({ status: 'In Progress' }, fixtureOperational());
    assert.equal(focus.focus, 'Evidence collection', 'evidence is the earliest incomplete stage');
    assert.equal(focus.status, 'In Progress', 'the status reads straight from the engagement, distinct from focus');
  });

  test('deriveOperationalFocus advances the focus as stages complete', function () {
    const evidenceDone = { evidence: { evidenceItems: 20, approved: 20 }, testing: { tests: 100, passed: 74, pending: 21 } };
    assert.equal(derive.deriveOperationalFocus({ status: 'In Progress' }, evidenceDone).focus, 'Control testing');

    const testingDone = { evidence: { evidenceItems: 20, approved: 20 }, testing: { tests: 100, passed: 100, pending: 0 }, findings: { findings: 5, open: 2 } };
    assert.equal(derive.deriveOperationalFocus({ status: 'In Progress' }, testingDone).focus, 'Findings & remediation');

    assert.equal(derive.deriveOperationalFocus({ status: 'Planning' }, {}).focus, 'Planning & scoping');
    assert.equal(derive.deriveOperationalFocus({ status: 'Completed' }, fixtureOperational()).focus, 'Engagement complete');
  });

  // ---- Next actions — what to work on next.

  test('deriveNextActions leads with walkthroughs, then the real pending work in lifecycle order', function () {
    const actions = Array.from(derive.deriveNextActions(fixtureOperational(), fixtureRegistry()));
    assert.equal(actions.length, 6, 'walkthrough plus five real pending items');
    assert.match(actions[0].title, /walkthrough/i, 'walkthroughs always lead the next actions');
    assert.equal(actions[0].path, 'path-walkthrough');
    assert.match(actions[1].title, /Review 6 evidence items/, 'pending approvals surface with the real count');
    assert.match(actions[2].title, /Fulfil 4 evidence requests/);
    assert.match(actions[3].title, /Complete 21 test procedures/);
    assert.match(actions[4].title, /Resolve 2 open findings/);
    assert.match(actions[5].title, /Continue the report/);
  });

  test('deriveNextActions omits work that does not exist, but never the walkthrough entry', function () {
    const actions = Array.from(derive.deriveNextActions({}, fixtureRegistry()));
    assert.equal(actions.length, 1, 'only the walkthrough entry remains when nothing is pending');
    assert.match(actions[0].detail, /No walkthrough sessions recorded yet/, 'walkthrough is exposed without a fabricated count');
    assert.equal(derive.deriveNextActions(fixtureOperational(), null).length, 0, 'no registry yields no actions');
  });

  // ---- Blocking items — work at risk.

  test('deriveBlockingItems surfaces rejected evidence, failed tests, and high-severity findings', function () {
    const blocking = Array.from(derive.deriveBlockingItems(
      [
        { id: 'F-1', title: 'High open', severity: 'High', status: 'Open', targetClosureDate: '2027-03-13' },
        { id: 'F-2', title: 'Medium open', severity: 'Medium', status: 'Open', targetClosureDate: '2027-03-11' }
      ],
      [{ title: 'Rejected item', reviewStatus: 'Rejected', uploadedOn: '2027-01-12' }],
      [{ id: 'T-1', result: 'Fail', procedure: 'Inspect', controlId: 'C-1', workingPaperId: 'WP-1' }],
      fixtureRegistry()
    ));
    assert.equal(blocking.length, 3, 'only genuinely blocking records surface');
    assert.match(blocking[0].title, /Evidence rejected/);
    assert.equal(blocking[0].tone, 'error');
    assert.equal(blocking[0].path, 'path-evidence');
    assert.match(blocking[1].title, /Failed test T-1/);
    assert.match(blocking[2].title, /High open/, 'only the high-severity finding blocks');
    assert.equal(derive.deriveBlockingItems([], [], [], fixtureRegistry()).length, 0, 'nothing at risk yields no blockers');
  });

  // ---- Audit health — the operational status-bar strip.

  test('deriveAuditHealth renders six navigable operational indicators from real figures', function () {
    const health = Array.from(derive.deriveAuditHealth(
      fixtureOperational(),
      [{ status: 'Open', severity: 'High' }, { status: 'Open', severity: 'Medium' }],
      fixtureRegistry()
    ));
    assert.deepEqual(health.map(function (h) { return h.label; }),
      ['Walkthrough', 'Evidence', 'Testing', 'Approvals', 'Findings', 'Report'],
      'the six health indicators appear in order');
    assert.equal(health[0].status, 'Waiting', 'walkthrough is awaiting, never a fabricated number');
    assert.equal(health[0].tone, null);
    assert.equal(health[1].status, '8 Pending', 'evidence health is the outstanding (unapproved) count');
    assert.equal(health[1].tone, 'warning');
    assert.equal(health[2].status, '21 Remaining', 'testing health is the procedures remaining');
    assert.equal(health[3].status, '6 Waiting', 'approvals health is the review queue');
    assert.equal(health[4].status, '1 Critical', 'findings health leads with high-severity open findings');
    assert.equal(health[4].tone, 'error');
    assert.equal(health[5].status, 'Updating', 'a draft report reads as continuously updating');
    health.forEach(function (indicator) {
      assert.match(indicator.path, /^path-/, 'every indicator navigates to a registered workspace path');
    });
  });

  test('deriveAuditHealth reads clear/complete health when work is done', function () {
    const health = Array.from(derive.deriveAuditHealth(
      { evidence: { evidenceItems: 20, approved: 20, pendingReview: 0 }, testing: { tests: 100, passed: 100, pending: 0 }, findings: { findings: 5, open: 0 }, report: { status: 'Final' } },
      [],
      fixtureRegistry()
    ));
    assert.equal(health[1].status, 'Complete', 'evidence complete when all approved');
    assert.equal(health[2].status, 'Complete', 'testing complete when nothing remains');
    assert.equal(health[3].status, 'Clear', 'approvals clear when the queue is empty');
    assert.equal(health[4].status, 'Clear', 'findings clear when none are open');
    assert.equal(health[5].status, 'Final', 'a final report reads final');
    assert.equal(derive.deriveAuditHealth(fixtureOperational(), [], null).length, 0, 'no registry yields no indicators');
  });

  // ---- Lifecycle navigation — the audit workflow.

  test('deriveLifecycle renders the six stages in operational order, each with real state', function () {
    const lifecycle = Array.from(derive.deriveLifecycle(fixtureRegistry(), fixtureOperational()));
    assert.deepEqual(lifecycle.map(function (s) { return s.label; }),
      ['Walkthrough', 'Evidence', 'Controls', 'Testing', 'Findings', 'Reporting'],
      'the lifecycle spine appears in order');
    assert.deepEqual(lifecycle.map(function (s) { return s.path; }),
      ['path-walkthrough', 'path-evidence', 'path-controls', 'path-testing', 'path-findings', 'path-reporting'],
      'each stage links to its registered workspace');
    assert.equal(lifecycle[1].status, 'In progress', 'evidence is in progress at 12 of 20');
    assert.equal(lifecycle[1].progress.value, 12, 'the stage carries a real progress ratio');
    assert.equal(lifecycle[1].progress.total, 20);
    assert.match(lifecycle[1].pending, /6 pending review/);
    assert.match(lifecycle[5].detail, /Continuously evolving/, 'reporting is presented as continuous, not end-of-project');
  });

  test('deriveLifecycle shows Walkthrough as not started, never fabricating progress', function () {
    const lifecycle = Array.from(derive.deriveLifecycle(fixtureRegistry(), fixtureOperational()));
    const walkthrough = lifecycle[0];
    assert.equal(walkthrough.status, 'Not started');
    assert.equal(walkthrough.progress, null, 'no fabricated walkthrough progress');
    assert.match(walkthrough.pending, /No walkthrough sessions/);
    assert.match(walkthrough.detail, /refine requirements, controls/, 'it explains the future workflow');
  });

  // ---- Team.

  test('deriveTeam profiles the client participants and resolves their responsibilities', function () {
    const team = Array.from(derive.deriveTeam(
      [
        { name: 'Member A', role: 'Control Owner', designation: 'Engineer', teamId: 'T-1', status: 'Active', preferredCommunication: 'Email', companyId: 'C-1' },
        { name: 'Member B', role: 'Evidence Owner', designation: 'Manager', teamId: 'T-2', status: 'Active', companyId: 'C-2' }
      ],
      [{ id: 'T-1', name: 'Fixture Team', responsibleControlFamilies: ['CC6', 'CC7'] }],
      'C-1'
    ));
    assert.equal(team.length, 1, 'only the engagement company\'s participants appear');
    assert.equal(team[0].name, 'Member A');
    assert.match(team[0].responsibilities, /Fixture Team · CC6, CC7/, 'responsibilities resolve through the team');
    assert.equal(team[0].status, 'Active');
  });

  // ---- Relationships, activity, metadata, timeline.

  test('deriveRelationships lists only the domains with data, each linking to its workspace', function () {
    const related = Array.from(derive.deriveRelationships(fixtureRegistry(), fixtureOperational()));
    assert.equal(related.length, 5);
    assert.equal(related[0].title, 'Controls');
    assert.equal(related[0].path, 'path-controls');
    assert.equal(derive.deriveRelationships(fixtureRegistry(), {}).length, 0);
  });

  test('deriveActivity merges activity-log remarks newest first, with the report leading', function () {
    const activity = Array.from(derive.deriveActivity(
      [
        { at: '2027-01-02', byId: 'POC-1', authorSide: 'client', entityId: 'REQ-1', note: 'Item A note' },
        { at: null, byId: 'POC-2', authorSide: 'client', entityId: 'REQ-2', note: 'Undated note' },
        { at: '2027-01-05', byId: 'USR-1', authorSide: 'ey', entityId: 'REQ-3', note: 'Newest note' }
      ],
      { title: 'Fixture report', status: 'Draft', version: '0.1' },
      { 'POC-1': 'Alice', 'USR-1': 'Bob' }
    ));
    assert.match(activity[0].title, /Report draft/, 'the report state leads the feed');
    assert.match(activity[1].meta, /Newest note/, 'the newest dated event follows');
    assert.equal(activity[1].actor, 'Bob', 'a known actor id resolves to its real name');
    assert.match(activity[2].meta, /Item A note/);
    assert.ok(!activity.some(function (event) { return /Undated/.test(event.meta || ''); }),
      'a remark without a recorded date is never fabricated into the feed');
  });

  test('deriveMetadata derives created, updated, version, owner, and tags', function () {
    const metadata = derive.deriveMetadata(
      { framework: 'Alpha', auditType: 'External', engagementLead: 'U-1', auditor: 'Fixture Firm' },
      { createdAt: '2025-02-10', customerTier: 'Enterprise' },
      { version: '1.0.0', generatedAt: '2026-01-01T00:00:00Z' }
    );
    assert.equal(metadata.created, 'Feb 10, 2025');
    assert.equal(metadata.updated, 'Jan 1, 2026');
    assert.equal(metadata.version, '1.0.0');
    assert.match(metadata.owner, /U-1 · Fixture Firm/);
    assert.deepEqual(Array.from(metadata.tags), ['Alpha', 'External', 'Enterprise']);
  });

  test('deriveTimeline lists dated engagement events and open closure targets, chronological', function () {
    const timeline = Array.from(derive.deriveTimeline(
      {
        auditPeriod: { startDate: '2026-01-01', endDate: '2026-12-31' },
        fieldworkPeriod: { startDate: '2027-01-05', endDate: '2027-02-15' },
        reportReleaseDate: '2027-03-15'
      },
      [
        { id: 'F-1', status: 'Open', targetClosureDate: '2027-03-11' },
        { id: 'F-2', status: 'Closed', targetClosureDate: '2027-03-12' }
      ]
    ));
    assert.deepEqual(timeline.map(function (event) { return event.title; }), [
      'Audit period begins', 'Audit period ends', 'Fieldwork begins', 'Fieldwork ends',
      'Finding closure target: F-1', 'Report release'
    ], 'dated events read in chronological order, with the open closure target included');
    assert.ok(!timeline.some(function (event) { return /F-2/.test(event.title); }), 'closed finding excluded');
  });

  // ---- Inspector entities.

  test('buildInspectorEntities yields the engagement plus one entity per framework', function () {
    const entities = Array.from(derive.buildInspectorEntities(
      { name: 'Fixture Engagement', engagementCode: 'FX-1', status: 'In Progress', framework: 'Alpha' },
      { name: 'Fixture Client' },
      ['Alpha', 'Beta'],
      [{ name: 'Member A', role: 'Control Owner' }],
      [{ timestamp: 'Jan 1, 2026', title: 'Audit period begins' }],
      [{ title: 'Controls', meta: '52' }],
      fixtureOperational()
    ));
    assert.equal(entities.length, 3, 'the engagement, then one entity per framework');
    assert.equal(entities[0].key, 'engagement');
    assert.equal(entities[1].key, 'framework:Alpha');
    const sectionTitles = Array.from(entities[0].inspector.sections).map(function (section) { return section.title; });
    assert.deepEqual(sectionTitles, ['Properties', 'Frameworks', 'Team', 'Timeline', 'Relationships'],
      'the engagement inspector renders the sections required by §9');
  });
};
