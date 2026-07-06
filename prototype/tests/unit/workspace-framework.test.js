'use strict';

/**
 * Unit Tests — Shared Workspace Framework Configuration
 *
 * Verifies the configuration contract of the Shared Workspace Framework
 * (GitHub Issue #17). The framework renders one Universal Workspace Structure
 * that every workspace inherits; a workspace configures its inherited skeleton
 * with a single declarative descriptor rather than re-inventing the page. These
 * tests exercise the pure `normalizeConfiguration` resolver — the single place
 * that decides which sections are visible — offline, with no DOM, so the
 * "every section is configurable" acceptance criterion is directly checkable.
 */

const { loadWorkspaceFramework } = require('../lib/prototype');

module.exports = function registerWorkspaceFrameworkTests(harness) {
  const test = harness.test;
  const assert = harness.assert;

  test('the framework module registers and exposes its public API', function () {
    const framework = loadWorkspaceFramework();
    assert.ok(framework, 'window.AuditOS.workspaceFramework is registered');
    assert.equal(typeof framework.render, 'function', 'render is exposed');
    assert.equal(typeof framework.configure, 'function', 'configure is exposed');
    assert.equal(typeof framework.normalizeConfiguration, 'function', 'normalizeConfiguration is exposed');
    assert.equal(typeof framework.buildEmptyState, 'function', 'the shared empty-state builder is exposed');
    assert.equal(typeof framework.buildLoadingSkeleton, 'function', 'the shared loading-skeleton builder is exposed');
    assert.equal(typeof framework.SLOTS, 'object', 'the slot map is exposed');
  });

  test('an absent configuration normalizes every section to collapsed defaults', function () {
    const framework = loadWorkspaceFramework();
    const normalized = framework.normalizeConfiguration();
    assert.equal(normalized.header, null, 'no header');
    assert.equal(normalized.contextSummary.length, 0, 'no context summary items');
    assert.equal(normalized.toolbar.search, null, 'search off');
    assert.equal(normalized.toolbar.filter, false, 'filter off');
    assert.equal(normalized.toolbar.sort, null, 'sort off');
    assert.equal(normalized.toolbar.view, null, 'view off');
    assert.equal(normalized.toolbar.refresh, false, 'refresh off');
    assert.equal(normalized.toolbar.export, false, 'export off');
    assert.equal(normalized.toolbar.actions.length, 0, 'no additional toolbar actions');
    assert.equal(normalized.filterBar.chips.length, 0, 'no filter chips');
    assert.equal(normalized.filterBar.dropdowns.length, 0, 'no filter dropdowns');
    assert.equal(normalized.actions.length, 0, 'no workspace actions');
    assert.equal(normalized.emptyState, null, 'no empty state');
    assert.equal(normalized.loading, null, 'no loading state');
  });

  test('each toolbar control is independently configurable', function () {
    const framework = loadWorkspaceFramework();
    const normalized = framework.normalizeConfiguration({
      toolbar: {
        search: true,
        filter: true,
        sort: ['Newest', 'Oldest'],
        view: true,
        refresh: true,
        export: false,
        actions: [{ label: 'Columns' }]
      }
    });
    assert.equal(typeof normalized.toolbar.search, 'object', 'search:true normalizes to an options object');
    assert.ok(normalized.toolbar.search && !Array.isArray(normalized.toolbar.search), 'search is an object, not a flag or list');
    assert.equal(normalized.toolbar.filter, true, 'filter is on');
    assert.equal(normalized.toolbar.sort.length, 2, 'sort keeps its option list');
    assert.equal(normalized.toolbar.view.length, 0, 'view:true normalizes to an empty option list');
    assert.equal(normalized.toolbar.refresh, true, 'refresh is on');
    assert.equal(normalized.toolbar.export, false, 'export stays off');
    assert.equal(normalized.toolbar.actions.length, 1, 'additional toolbar actions are preserved');
  });

  test('the header, context summary, filter bar, and actions pass through', function () {
    const framework = loadWorkspaceFramework();
    const header = { title: 'Evidence', description: 'Manage evidence', frameworks: ['SOC 2'], status: { label: 'In progress', tone: 'info' } };
    const normalized = framework.normalizeConfiguration({
      header: header,
      contextSummary: [{ label: 'Client', value: 'Acme' }, { label: 'Period', value: 'FY26' }],
      filterBar: {
        chips: [{ label: 'Open', selected: true }],
        dropdowns: [{ label: 'Status', options: ['Open', 'Closed'] }]
      },
      actions: [{ label: 'Add', variant: 'primary' }, { label: 'Import' }]
    });
    assert.equal(normalized.header, header, 'the header descriptor passes through');
    assert.equal(normalized.contextSummary.length, 2, 'context summary items are preserved');
    assert.equal(normalized.filterBar.chips.length, 1, 'filter chips are preserved');
    assert.equal(normalized.filterBar.dropdowns.length, 1, 'filter dropdowns are preserved');
    assert.equal(normalized.actions.length, 2, 'workspace actions are preserved');
  });

  test('loading and empty state descriptors pass through for the content region', function () {
    const framework = loadWorkspaceFramework();
    const loading = framework.normalizeConfiguration({ loading: { variant: 'table' } });
    assert.deepEqual(loading.loading, { variant: 'table' }, 'loading descriptor passes through');
    const empty = framework.normalizeConfiguration({ emptyState: { title: 'Nothing yet' } });
    assert.deepEqual(empty.emptyState, { title: 'Nothing yet' }, 'empty-state descriptor passes through');
  });
};
