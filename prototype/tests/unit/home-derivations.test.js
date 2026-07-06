'use strict';

/**
 * Unit Tests — Home Workspace Derivations
 *
 * Exercises the pure derivation helpers of AuditOS Home with fixture records
 * (GitHub Issue #15 — Testing / Unit Tests). The helpers take plain records
 * and return plain view data — no DOM, no AuditOS.state — so these suites
 * verify the business-data bindings deterministically and offline. Fixtures
 * mirror the demo-data record shapes without embedding demo business
 * content.
 */

const { loadHomeWorkspace } = require('../lib/prototype');

/** Minimal engagement fixture in the demo-data shape. */
function engagementFixture() {
  return {
    id: 'E-1',
    status: 'In Progress',
    auditPeriod: { startDate: '2026-01-01', endDate: '2026-12-31' },
    fieldworkPeriod: { startDate: '2027-01-05', endDate: '2027-02-15' },
    reportReleaseDate: '2027-03-15'
  };
}

module.exports = function registerUnitTests(harness) {
  const test = harness.test;
  const assert = harness.assert;
  const derive = loadHomeWorkspace().derivations;

  // ---- Formatters.

  test('formatDate renders ISO dates deterministically and passes through malformed input', function () {
    assert.equal(derive.formatDate('2027-01-05'), 'Jan 5, 2027');
    assert.equal(derive.formatDate('2026-12-31'), 'Dec 31, 2026');
    assert.equal(derive.formatDate('not-a-date'), 'not-a-date');
    assert.equal(derive.formatDate(undefined), '');
  });

  test('formatPeriod renders a start – end range and tolerates missing periods', function () {
    assert.equal(derive.formatPeriod({ startDate: '2026-01-01', endDate: '2026-12-31' }),
      'Jan 1, 2026 – Dec 31, 2026');
    assert.equal(derive.formatPeriod(null), '');
    assert.equal(derive.formatPeriod({ startDate: '2026-01-01' }), '');
  });

  test('formatPercent rounds and never divides by zero', function () {
    assert.equal(derive.formatPercent(74, 100), 74);
    assert.equal(derive.formatPercent(1, 3), 33);
    assert.equal(derive.formatPercent(5, 0), 0);
    assert.equal(derive.formatPercent(0, undefined), 0);
  });

  // ---- Current engagement.

  test('deriveCurrentEngagement prefers the first in-progress engagement', function () {
    const engagements = [
      { id: 'E-0', status: 'Completed' },
      { id: 'E-1', status: 'In Progress' },
      { id: 'E-2', status: 'In Progress' }
    ];
    assert.equal(derive.deriveCurrentEngagement(engagements).id, 'E-1');
  });

  test('deriveCurrentEngagement falls back to the first engagement, or null', function () {
    assert.equal(derive.deriveCurrentEngagement([{ id: 'E-0', status: 'Planning' }]).id, 'E-0');
    assert.equal(derive.deriveCurrentEngagement([]), null);
    assert.equal(derive.deriveCurrentEngagement(undefined), null);
  });

  // ---- Continue Working.

  test('deriveContinueWorking lists only resume points that exist', function () {
    const resume = derive.deriveContinueWorking(
      { pendingReview: 6 },
      { pending: 21 },
      { open: 2 },
      { pending: 4 },
      { title: 'Fixture report', status: 'Draft', version: '0.1' }
    );
    assert.equal(resume.length, 5, 'all five resume points exist');
    assert.equal(resume[0].workspaceId, 'evidence');
    assert.equal(resume[0].value, '6');
    assert.equal(resume[1].workspaceId, 'testing');
    assert.equal(resume[2].workspaceId, 'findings');
    assert.equal(resume[3].workspaceId, 'evidence');
    assert.equal(resume[4].workspaceId, 'reporting');
    assert.equal(resume[4].value, 'v0.1');
    assert.match(resume[4].description, /Fixture report/, 'the report resume point carries the report title');
  });

  test('deriveContinueWorking yields nothing when the engagement is caught up', function () {
    assert.equal(derive.deriveContinueWorking({}, {}, {}, {}, null).length, 0,
      'no work fabricated when none exists');
  });

  // ---- Urgent Work.

  test('deriveUrgentWork surfaces high-severity findings, rejections, and failed tests in order', function () {
    const urgent = derive.deriveUrgentWork(
      [
        { id: 'F-1', title: 'High open', severity: 'High', status: 'Open', targetClosureDate: '2027-03-13' },
        { id: 'F-2', title: 'Medium open', severity: 'Medium', status: 'Open', targetClosureDate: '2027-03-11' },
        { id: 'F-3', title: 'High closed', severity: 'High', status: 'Closed', targetClosureDate: '2027-03-12' }
      ],
      [
        { title: 'Rejected item', reviewStatus: 'Rejected', uploadedOn: '2027-01-12' },
        { title: 'Approved item', reviewStatus: 'Approved', uploadedOn: '2027-01-11' }
      ],
      [
        { id: 'T-1', result: 'Fail', procedure: 'Inspect configuration', controlId: 'C-1', workingPaperId: 'WP-1' },
        { id: 'T-2', result: 'Pass', procedure: 'Inspect configuration', controlId: 'C-2', workingPaperId: 'WP-2' }
      ]
    );
    assert.equal(urgent.length, 3, 'only genuinely urgent records surface');
    assert.match(urgent[0].title, /High open/, 'high-severity open finding leads');
    assert.equal(urgent[0].tone, 'error');
    assert.equal(urgent[0].critical, true, 'high-severity findings are critical rows');
    assert.match(urgent[0].description, /High severity finding/, 'severity reads as text');
    assert.match(urgent[1].title, /Rejected item/, 'rejected evidence follows');
    assert.equal(urgent[1].critical, true, 'rejected evidence is a critical row');
    assert.match(urgent[2].title, /Failed test T-1/, 'failed test procedures follow');
    assert.equal(urgent[2].tone, 'warning');
    assert.ok(!urgent[2].critical, 'failed tests are urgent but not critical');
  });

  // ---- Assigned to Me.

  test('deriveAssignedWork collects the current user\'s engagements and tests, in-progress first', function () {
    const assigned = derive.deriveAssignedWork(
      [
        { name: 'Fixture A', status: 'In Progress', engagementLead: 'U-1', engagementManager: 'U-9', auditPeriod: { startDate: '2026-01-01', endDate: '2026-12-31' } },
        { name: 'Fixture B', status: 'Completed', engagementLead: 'U-1', engagementManager: 'U-9', auditPeriod: { startDate: '2025-01-01', endDate: '2025-12-31' } },
        { name: 'Fixture C', status: 'In Progress', engagementLead: 'U-9', engagementManager: 'U-1', auditPeriod: { startDate: '2026-04-01', endDate: '2027-03-31' } },
        { name: 'Fixture D', status: 'In Progress', engagementLead: 'U-9', engagementManager: 'U-9', auditPeriod: { startDate: '2026-01-01', endDate: '2026-12-31' } }
      ],
      [
        { id: 'T-1', testedBy: 'U-1', reviewedBy: 'U-9', procedure: 'P', controlId: 'C-1', workingPaperId: 'WP-1' },
        { id: 'T-2', testedBy: 'U-9', reviewedBy: 'U-1', procedure: 'P', controlId: 'C-2', workingPaperId: 'WP-2' },
        { id: 'T-3', testedBy: 'U-9', reviewedBy: 'U-9', procedure: 'P', controlId: 'C-3', workingPaperId: 'WP-3' }
      ],
      'U-1'
    );
    assert.equal(assigned.length, 5, 'two led/managed engagements plus two test duties, D and T-3 excluded');
    assert.ok(assigned.some(function (item) { return /Engagement Lead/.test(item.description); }),
      'led engagements carry the lead role');
    assert.ok(assigned.some(function (item) { return /Engagement Manager/.test(item.description); }),
      'managed engagements carry the manager role');
    assert.ok(assigned.some(function (item) { return /Execute test T-1/.test(item.title); }));
    assert.ok(assigned.some(function (item) { return /Review test T-2/.test(item.title); }));
    assert.match(assigned[assigned.length - 1].title, /Fixture B/, 'completed work sorts last');
  });

  test('deriveAssignedWork yields nothing for a user with no assignments', function () {
    assert.equal(derive.deriveAssignedWork([], [], 'U-1').length, 0);
  });

  // ---- Clients.

  test('deriveClients profiles each company from state records only', function () {
    const clients = derive.deriveClients(
      [{
        id: 'C-9',
        name: 'Fixture Client',
        industry: 'Fixtures',
        riskRating: 'High',
        auditReadinessScore: 84,
        frameworks: ['Alpha', 'Beta'],
        headquarters: { city: 'Fixture City', country: 'Fixture Country' }
      }],
      [
        { companyId: 'C-9', name: 'Fixture Engagement A', framework: 'Alpha', status: 'In Progress', auditPeriod: { startDate: '2026-01-01', endDate: '2026-12-31' } },
        { companyId: 'C-9', name: 'Fixture Engagement B', framework: 'Alpha', status: 'Completed', auditPeriod: { startDate: '2025-01-01', endDate: '2025-12-31' } },
        { companyId: 'C-other', name: 'Fixture Engagement C', framework: 'Beta', status: 'In Progress' }
      ]
    );
    assert.equal(clients.length, 1);
    assert.equal(clients[0].title, 'Fixture Client');
    assert.match(clients[0].subtitle, /Fixture City, Fixture Country/, 'headquarters derive from the record');
    assert.equal(clients[0].badge.text, 'High risk');
    assert.equal(clients[0].badge.tone, 'error');
    assert.equal(clients[0].meter.value, 84);
    assert.equal(clients[0].meter.total, 100);
    assert.equal(clients[0].meter.tone, 'warning', 'readiness below 85 reads warning');
    assert.equal(clients[0].facts[0].detail, '1 active of 2', 'engagement counts derive per company');
    assert.equal(clients[0].facts[1].detail, 'Alpha · Beta');
    assert.equal(clients[0].engagements.length, 2, 'the card lists only the client\'s own engagements');
    assert.match(clients[0].engagements[0].title, /Fixture Engagement A/);
    assert.equal(clients[0].engagements[0].tone, 'info', 'in-progress engagements read info');
    assert.equal(clients[0].engagements[1].tone, 'success', 'completed engagements read success');
  });

  // ---- KPIs.

  test('deriveKpis reads the operational domain summaries', function () {
    const kpis = derive.deriveKpis(
      { controls: 52, eligibleForEvidenceReuse: 38 },
      { approved: 12, evidenceItems: 20 },
      { passed: 74, tests: 100 },
      { open: 2, findings: 5 }
    );
    assert.equal(kpis.length, 4, 'four KPI tiles');
    assert.equal(kpis[0].value, 52);
    assert.equal(kpis[1].value, 12);
    assert.equal(kpis[1].total, 20);
    assert.equal(kpis[2].value, 74);
    assert.equal(kpis[3].value, 2);
  });

  test('deriveKpis reads zero, never NaN, from absent summaries', function () {
    const kpis = derive.deriveKpis(null, undefined, {}, {});
    kpis.forEach(function (kpi) {
      assert.equal(typeof kpi.value, 'number');
      assert.ok(!Number.isNaN(kpi.value), kpi.label + ' is a number');
    });
  });

  // ---- Notifications, calendar, activity.

  test('deriveNotifications maps reviews, rejections, submissions, and the report', function () {
    const notifications = derive.deriveNotifications(
      [
        { title: 'Pending item', reviewStatus: 'Pending Review', uploadedOn: '2027-01-10' },
        { title: 'Rejected item', reviewStatus: 'Rejected', uploadedOn: '2027-01-12' }
      ],
      [{ id: 'R-2', status: 'Submitted', submittedOn: '2027-01-11' }],
      { title: 'Report', status: 'Draft', version: '0.1' }
    );
    assert.equal(notifications.length, 4);
    assert.match(notifications[0].title, /Rejected item/, 'newest dated event first');
    assert.equal(notifications[0].tone, 'error');
    assert.ok(notifications.some(function (n) { return /Approval required/.test(n.title); }));
    assert.ok(notifications.some(function (n) { return /Evidence received/.test(n.title); }));
    assert.ok(notifications.some(function (n) { return /Report draft/.test(n.title); }));
  });

  test('deriveCalendarEntries lists engagement milestones and open closure targets, ascending', function () {
    const entries = derive.deriveCalendarEntries(engagementFixture(), [
      { id: 'F-1', status: 'Open', targetClosureDate: '2027-03-11' },
      { id: 'F-2', status: 'Closed', targetClosureDate: '2027-03-12' }
    ]);
    const dates = entries.map(function (entry) { return entry.date; });
    assert.deepEqual(dates.slice().sort(), dates, 'entries are sorted ascending');
    assert.ok(entries.some(function (entry) { return /F-1/.test(entry.title); }), 'open closure target listed');
    assert.ok(!entries.some(function (entry) { return /F-2/.test(entry.title); }), 'closed finding not listed');
  });

  test('deriveRecentActivity merges evidence and submissions, newest first', function () {
    const activity = derive.deriveRecentActivity(
      [{ title: 'Item A', reviewStatus: 'Approved', uploadedOn: '2027-01-02' }],
      [{ id: 'R-4', status: 'Submitted', reviewStatus: 'Pending Review', submittedOn: '2027-01-05' }]
    );
    assert.match(activity[0].title, /R-4/, 'newest event first');
    assert.match(activity[1].title, /Item A/);
  });

  // ---- Quick actions.

  test('deriveQuickActions resolves navigation-only destinations from the registry', function () {
    assert.equal(derive.deriveQuickActions(null).length, 0, 'no registry yields no actions');

    const fixtureRegistry = {
      IDS: { ENGAGEMENT: 'engagement', EVIDENCE: 'evidence', TESTING: 'testing', FINDINGS: 'findings', REPORTING: 'reporting' },
      findById: function (id) { return { id: id, label: 'Label ' + id, path: 'path-' + id }; }
    };
    const actions = derive.deriveQuickActions(fixtureRegistry);
    assert.equal(actions.length, 5);
    assert.equal(actions[0].primary, true, 'the leading action is primary');
    assert.equal(actions[0].path, 'path-engagement', 'paths come from the registry, never literals');
  });
};
