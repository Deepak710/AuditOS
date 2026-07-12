/**
 * AuditOS Industry Knowledge
 * Engagement Operating System Foundation — GitHub Issue #36 (§11 Industry
 * Knowledge)
 *
 * Read-only access to the shared, reusable `industry-knowledge` Repository
 * collection — organizational learning (e.g. "firewall vendor changed") kept
 * separate from engagement-specific AI Suggestions (Architectural Decision
 * #5): Industry Knowledge is reusable across every engagement; Suggestions
 * are scoped to one.
 *
 * `resolveApplicable` is the one piece of business logic this module owns:
 * an item is only applicable to an engagement from its recorded
 * `implementationDate` forward, and only up to the engagement's own audit
 * period — the rule that keeps the platform from ever recommending a
 * retroactive change (Issue #36 §11).
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

  /** Every recorded Industry Knowledge item, platform-wide. */
  function list() {
    var repo = repository();
    return repo ? repo.industryKnowledge.list() : [];
  }

  /** One Industry Knowledge item by identifier, or null. */
  function get(id) {
    var repo = repository();
    return repo ? repo.industryKnowledge.get(id) : null;
  }

  /**
   * The items genuinely applicable to an engagement's audit period: an item
   * implemented on or before the audit period's end date is applicable (from
   * its implementation date forward); one implemented after the period ends
   * is future knowledge with no bearing on this engagement yet. An
   * engagement or item with no dated period/implementation date is included
   * as-is — absence of a date is never treated as a reason to fabricate
   * exclusion or inclusion.
   */
  function resolveApplicable(items, auditPeriod) {
    var period = auditPeriod || null;
    return asArray(items).filter(function (item) {
      if (!period || !period.endDate || !item.implementationDate) {
        return true;
      }
      return item.implementationDate <= period.endDate;
    });
  }

  /** The Industry Knowledge applicable to one engagement, resolved from its recorded audit period. */
  function listApplicableToEngagement(engagement) {
    var period = engagement ? engagement.auditPeriod : null;
    return resolveApplicable(list(), period);
  }

  AuditOS.industryKnowledge = {
    list: list,
    get: get,
    resolveApplicable: resolveApplicable,
    listApplicableToEngagement: listApplicableToEngagement
  };
})(window);
