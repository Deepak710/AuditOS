'use strict';

/**
 * Unit Tests — Global Home Derivations (Issue #33 §1)
 *
 * Exercises the pure derivation helpers of the client-centric Global Home
 * with fixture records (GitHub Issue #15 — Testing / Unit Tests). The
 * helpers take plain records and return plain view data — no DOM, no
 * AuditOS.state — so these suites verify the client-selection bindings
 * deterministically and offline, including the plural / empty-state
 * correctness the single-client production dataset cannot exercise.
 * Fixtures mirror the demo-data record shapes without embedding demo
 * business content.
 */

const { loadHomeWorkspace } = require('../lib/prototype');

/** A two-client portfolio fixture in the demo-data shape. */
function companiesFixture() {
  return [
    {
      id: 'C-1', name: 'Fixture Client One', status: 'Active', industry: 'Fixtures',
      headquarters: { city: 'Fixture City', country: 'Fixture Country' }
    },
    {
      id: 'C-2', name: 'Fixture Client Two', status: 'Prospect', industry: 'Widgets',
      headquarters: {}
    }
  ];
}

/** Engagements across both fixture clients. */
function engagementsFixture() {
  return [
    { id: 'E-1', companyId: 'C-1', name: 'Fixture A', framework: 'Alpha', status: 'In Progress' },
    { id: 'E-2', companyId: 'C-1', name: 'Fixture B', framework: 'Alpha', status: 'Completed' },
    { id: 'E-3', companyId: 'C-1', name: 'Fixture C', framework: 'Beta', status: 'In Progress' },
    { id: 'E-4', companyId: 'C-2', name: 'Fixture D', framework: 'Gamma', status: 'Completed' }
  ];
}

/** Programs owned by the first fixture client. */
function programsFixture() {
  return [{ id: 'P-1', companyId: 'C-1', name: 'Fixture Program', engagementIds: ['E-1', 'E-3'] }];
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

  test('plural pluralizes count labels for N clients', function () {
    assert.equal(derive.plural(1, 'client'), 'client');
    assert.equal(derive.plural(2, 'client'), 'clients');
    assert.equal(derive.plural(0, 'engagement'), 'engagements');
  });

  // ---- Client cards.

  test('engagementCountsFor counts only the company\'s own engagements', function () {
    const counts = derive.engagementCountsFor('C-1', engagementsFixture());
    assert.equal(counts.total, 3);
    assert.equal(counts.active, 2);
    assert.equal(counts.completed, 1);
    const none = derive.engagementCountsFor('C-none', engagementsFixture());
    assert.equal(none.total, 0);
    assert.equal(none.active, 0);
    assert.equal(none.completed, 0);
  });

  test('frameworksFor lists the distinct frameworks of one company, in record order', function () {
    assert.deepEqual(Array.from(derive.frameworksFor('C-1', engagementsFixture())), ['Alpha', 'Beta']);
    assert.deepEqual(Array.from(derive.frameworksFor('C-none', engagementsFixture())), []);
  });

  test('deriveClientCards profiles every company from state records only', function () {
    const cards = derive.deriveClientCards(companiesFixture(), engagementsFixture(), programsFixture());
    assert.equal(cards.length, 2, 'one card per company — architected for N clients');

    assert.equal(cards[0].title, 'Fixture Client One');
    assert.match(cards[0].subtitle, /Fixture City, Fixture Country/, 'headquarters derive from the record');
    assert.equal(cards[0].badge.text, 'Active');
    assert.equal(cards[0].badge.tone, 'success');
    assert.equal(cards[0].workspaceId, 'client', 'the card opens the Client Dashboard');
    assert.equal(cards[0].recordId, 'C-1', 'the card carries the stable record id (Issue #31)');
    assert.equal(cards[0].facts[0].detail, '2 active of 3', 'engagement counts derive per company');
    assert.equal(cards[0].facts[1].detail, '1', 'program counts derive per company');
    assert.match(cards[0].facts[2].detail, /Alpha · Beta/, 'frameworks derive from the client\'s engagements');

    assert.equal(cards[1].badge.tone, 'info', 'a non-active status reads as neutral info');
    assert.equal(cards[1].subtitle, 'Widgets', 'no headquarters city yields no fabricated location');
    assert.equal(cards[1].facts[0].detail, '0 active of 1');

    const bare = derive.deriveClientCards([{ id: 'C-3', name: 'Bare' }], [], []);
    assert.equal(bare[0].facts.length, 2, 'a client with no frameworks gets no frameworks fact');
    assert.equal(bare[0].badge, null, 'no status yields no fabricated badge');
  });

  // ---- Continue Working.

  test('deriveContinueWorking lists only clients with active engagements', function () {
    const resume = derive.deriveContinueWorking(companiesFixture(), engagementsFixture());
    assert.equal(resume.length, 1, 'only the client with in-progress engagements resumes');
    assert.equal(resume[0].workspaceId, 'client');
    assert.equal(resume[0].recordId, 'C-1');
    assert.equal(resume[0].value, '2');
    assert.match(resume[0].title, /Fixture Client One/);
    assert.match(resume[0].description, /2 active engagements of 3 total/, 'counts read as pluralized text');
  });

  test('deriveContinueWorking yields nothing when no client has active work', function () {
    const resume = derive.deriveContinueWorking(companiesFixture(), [
      { id: 'E-1', companyId: 'C-1', status: 'Completed' }
    ]);
    assert.equal(resume.length, 0, 'no resume point is fabricated');
  });

  // ---- Recent clients (session-only presentation state).

  test('recordRecentClient keeps the newest first, deduplicated and capped', function () {
    let recents = derive.recordRecentClient([], 'C-1');
    assert.deepEqual(Array.from(recents), ['C-1']);
    recents = derive.recordRecentClient(recents, 'C-2');
    assert.deepEqual(Array.from(recents), ['C-2', 'C-1'], 'newest first');
    recents = derive.recordRecentClient(recents, 'C-1');
    assert.deepEqual(Array.from(recents), ['C-1', 'C-2'], 'reopening moves a client to the head, never duplicates');
    assert.deepEqual(Array.from(derive.recordRecentClient(['C-1', 'C-2'], 'C-3', 2)), ['C-3', 'C-1'],
      'the list stays capped');
    assert.deepEqual(Array.from(derive.recordRecentClient(['C-1'], '')), ['C-1'],
      'an absent id records nothing');
  });

  test('deriveRecentClients projects recency onto real client cards only', function () {
    const cards = derive.deriveClientCards(companiesFixture(), engagementsFixture(), programsFixture());
    const recent = derive.deriveRecentClients(['C-2', 'C-gone', 'C-1'], cards);
    assert.equal(recent.length, 2, 'an id that no longer joins a company is dropped, never fabricated');
    assert.equal(recent[0].id, 'C-2', 'recency order is preserved');
    assert.equal(recent[1].id, 'C-1');
    assert.equal(derive.deriveRecentClients([], cards).length, 0, 'a fresh session has no recents');
  });

  // ---- Client groups.

  test('deriveClientGroups groups the portfolio by the recorded industry', function () {
    const groups = derive.deriveClientGroups(companiesFixture());
    assert.equal(groups.length, 2, 'one group per distinct industry');
    assert.equal(groups[0].title, 'Fixtures');
    assert.equal(groups[0].meta, '1 client', 'counts read as pluralized text');
    assert.match(groups[0].description, /Fixture Client One/, 'members are named');
    const merged = derive.deriveClientGroups([
      { id: 'C-1', name: 'One', industry: 'Same' },
      { id: 'C-2', name: 'Two', industry: 'Same' }
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].meta, '2 clients');
    const uncategorized = derive.deriveClientGroups([{ id: 'C-3', name: 'Three' }]);
    assert.equal(uncategorized[0].title, 'Uncategorized', 'a client without an industry is grouped honestly');
  });

  // ---- Ribbon and related facts.

  test('derivePortfolioRibbon carries live portfolio counts', function () {
    const ribbon = derive.derivePortfolioRibbon(companiesFixture(), engagementsFixture(), programsFixture());
    const byLabel = {};
    ribbon.forEach(function (entry) { byLabel[entry.label] = entry.value; });
    assert.equal(byLabel.Clients, '2');
    assert.equal(byLabel.Programs, '1');
    assert.equal(byLabel['Active engagements'], '2');
    assert.equal(byLabel['Completed engagements'], '2');
  });

  test('deriveRelatedFacts describes the portfolio from records only', function () {
    const facts = derive.deriveRelatedFacts(companiesFixture(), engagementsFixture(), programsFixture());
    const byTerm = {};
    facts.forEach(function (fact) { byTerm[fact.term] = fact.detail; });
    assert.equal(byTerm.Clients, '2');
    assert.equal(byTerm.Engagements, '4');
    assert.match(byTerm.Frameworks, /Alpha · Beta · Gamma/, 'distinct frameworks in record order');
    const bare = derive.deriveRelatedFacts([], [], []);
    assert.equal(bare.length, 3, 'no frameworks fact is fabricated for an empty portfolio');
  });
};
