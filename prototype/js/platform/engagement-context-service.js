/**
 * AuditOS Engagement Context Service
 * Engagement Operating System Foundation — GitHub Issue #36 (§8 AI Context
 * Service)
 *
 * The single source of AI-derived engagement state (Architectural Decision
 * #4): working memory, observed evidence, assumptions, dependencies,
 * suggestions, timeline, industry knowledge, confidence, and the affected
 * requirements / controls / report sections / audit references. Pages never
 * write this state directly — the SynchronizationBus is the only writer
 * (`js/platform/synchronization-bus.js`); pages read it read-only through
 * this service.
 *
 * Repository-backed: reads and writes go through
 * `AuditOS.repository.engagementContext`, so every write is automatically
 * audited and simulated exactly like every other Repository-backed entity
 * (Issue #34's proven contract, reused rather than duplicated).
 *
 * Depends on nothing in components/, keeping the js → components boundary
 * one-way. Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** The Repository Foundation, resolved at call time so load order stays flexible. */
  function repository() {
    return AuditOS.repository || null;
  }

  /** The dataset id an engagement's context document lives under, or null. */
  function datasetIdFor(engagementId) {
    var repo = repository();
    if (!repo || !engagementId) {
      return null;
    }
    var datasets = repo.engagementContext.datasetsForEngagement(engagementId);
    return datasets.length > 0 ? datasets[0] : null;
  }

  /** The engagement's one context record, or null when none is seeded yet. */
  function get(engagementId) {
    var repo = repository();
    var datasetId = datasetIdFor(engagementId);
    if (!repo || !datasetId) {
      return null;
    }
    var records = repo.engagementContext.list({ datasetId: datasetId });
    return records.length > 0 ? records[0] : null;
  }

  /**
   * Applies a patch to the engagement's context record. Every field the
   * context carries (`workingMemory`, `observedEvidence`, `assumptions`,
   * `dependencyIds`, `suggestionIds`, `timeline`, `industryKnowledgeIds`,
   * `confidence`, `affectedRequirements`, `affectedControls`,
   * `affectedReportSections`, `auditReferences`) may be patched this way.
   * Records one audited Repository write. Returns the updated record, or
   * null when no context document is seeded for the engagement.
   */
  function update(engagementId, patch, options) {
    var repo = repository();
    var current = get(engagementId);
    var datasetId = datasetIdFor(engagementId);
    if (!repo || !current || !datasetId) {
      return null;
    }
    var opts = options || {};
    return repo.engagementContext.update(current.id, patch, {
      datasetId: datasetId,
      action: opts.action || 'engagement-context-updated',
      reason: opts.reason || null,
      workspaceId: opts.workspaceId || null,
      engagementId: engagementId,
      correlationId: opts.correlationId || null
    });
  }

  /**
   * Appends one dated entry to the engagement's context timeline (the
   * SynchronizationBus's own write, Issue #36 §12). Returns the updated
   * record, or null when no context document is seeded for the engagement.
   */
  function appendTimeline(engagementId, entry, options) {
    var current = get(engagementId);
    if (!current || !entry) {
      return null;
    }
    var timeline = asArray(current.timeline).concat([entry]);
    return update(engagementId, { timeline: timeline }, options);
  }

  AuditOS.engagementContextService = {
    get: get,
    update: update,
    appendTimeline: appendTimeline
  };
})(window);
