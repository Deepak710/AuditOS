/**
 * AuditOS Dependency Service
 * Engagement Operating System Foundation — GitHub Issue #36 (§10 Dependency
 * Engine)
 *
 * Read-only traversal over the `dependencies` Repository collection: the
 * Team → POC → Requirement → Control → Evidence → Report chain, each
 * dependency carrying its reason, confidence, whether it blocks progress,
 * the objects it affects, and its audit-period / historical / future
 * implications. Release 1 dependencies are authored in the engagement-scoped
 * demo JSON (`demo-data/dependencies/*.json`); Release 2 AI agents derive
 * them live from walkthrough, requirement, and control activity through the
 * SynchronizationBus, behind this same read surface.
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

  /** Every recorded dependency for an engagement. */
  function list(engagementId) {
    var repo = repository();
    if (!repo || !engagementId) {
      return [];
    }
    var datasets = repo.dependencies.datasetsForEngagement(engagementId);
    if (datasets.length === 0) {
      return [];
    }
    return repo.dependencies.list({ datasetId: datasets[0] });
  }

  /**
   * Dependencies whose source, target, or affected-objects list names the
   * given record — the join a Team, POC, Requirement, Control, Evidence, or
   * Report Inspector uses to show what it depends on and what depends on it.
   */
  function listForRecord(engagementId, type, id) {
    if (!type || !id) {
      return [];
    }
    return list(engagementId).filter(function (dependency) {
      if (dependency.sourceType === type && dependency.sourceId === id) {
        return true;
      }
      if (dependency.targetType === type && dependency.targetId === id) {
        return true;
      }
      return asArray(dependency.affectedObjects).some(function (object) {
        return object && object.type === type && object.id === id;
      });
    });
  }

  /** The dependencies currently blocking progress (`blocking: true`). */
  function listBlocking(engagementId) {
    return list(engagementId).filter(function (dependency) {
      return Boolean(dependency.blocking);
    });
  }

  AuditOS.dependencyService = {
    list: list,
    listForRecord: listForRecord,
    listBlocking: listBlocking
  };
})(window);
