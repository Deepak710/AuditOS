/**
 * AuditOS Identifier Service
 * Platform Foundation — deterministic identifier generation (GitHub Issue #41
 * §Suggestion ID Generation)
 *
 * The one place the platform mints identifiers for records created at
 * runtime. Before this service, each caller that needed a runtime id rolled
 * its own scheme from `Date.now()` — `'SUG-' + engagementId + '-' + Date.now()`
 * in the Suggestion Lifecycle Service, `'RPTV-' + engagementId + '-' + Date.now()`
 * in the Report Version Service — which collides whenever two records for the
 * same prefix are minted inside one millisecond. That is a real risk here, not
 * a theoretical one: the Reporting workspace's propagation path can mint a
 * Suggestion and, moments later in the same click handler, a Report Version,
 * and a synchronous UI action that creates two records of the same kind (a
 * batch approval, a double-invoked handler) happens well inside a millisecond
 * on modern hardware.
 *
 * `next(prefix)` replaces the timestamp with one monotonic counter per prefix
 * — the same shape as the Platform Audit Service's own `newCorrelationId()`
 * (Issue #34), reused here as the architectural basis for a second identifier
 * source rather than reimplemented. Deterministic, offline, and
 * dependency-free: no random GUID library, nothing that reaches outside the
 * page. Counters live only in memory for the page session, exactly like the
 * Shared Audit State's own simulated writes — nothing is persisted, and
 * nothing needs to be, since a reload restores the demo-data baseline.
 *
 * Backward compatible in shape: a caller that generated `'SUG-' + engagementId
 * + '-' + Date.now()` generates `idService.next('SUG-' + engagementId)` instead,
 * producing `SUG-<engagementId>-000001`, `SUG-<engagementId>-000002`, … — the
 * same `<prefix>-<suffix>` contract every consumer and test already reads, now
 * a monotonic sequence instead of a clock reading.
 *
 * Depends on nothing else, so it loads early alongside the Platform Audit
 * Service. Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** One monotonic counter per prefix, so unrelated id families never contend. */
  var counters = {};

  /** The zero-padded width of the numeric suffix (matches the Audit Service's own COR- ids). */
  var SUFFIX_WIDTH = 6;

  /**
   * Returns the next identifier for `prefix`: `<prefix>-<paddedSequence>`,
   * strictly increasing per prefix, never repeated within the page session. A
   * missing or empty prefix falls back to `'ID'` rather than producing a
   * leading-dash id.
   */
  function next(prefix) {
    var key = prefix || 'ID';
    counters[key] = (counters[key] || 0) + 1;
    var suffix = String(counters[key]);
    while (suffix.length < SUFFIX_WIDTH) {
      suffix = '0' + suffix;
    }
    return key + '-' + suffix;
  }

  AuditOS.idService = {
    next: next
  };
})(window);
