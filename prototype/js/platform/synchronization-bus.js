/**
 * AuditOS Synchronization Bus
 * Engagement Operating System Foundation — GitHub Issue #36 (§12
 * Synchronization Bus) / Chapter 50 — Sync
 *
 * Pages never communicate directly. A page publishes an event; the bus
 * updates the EngagementContext; other pages react by reading that context
 * (never by reaching into another workspace's state). Built on the same
 * subscribe/publish shape as the Permission Foundation's session-change
 * channel (`js/platform/permissions.js`) — an isolated-failure listener
 * array, no DOM dependency — reused here as the architectural basis for a
 * second, independent event channel (Architectural Decision #4).
 *
 * `propagate()` simulates the full downstream chain a walkthrough-originated
 * change triggers: Walkthrough → Requirements → Controls & Documentation →
 * Report → Approvals → Audit → AI Usage → Timeline → Context. This issue
 * intentionally stops at the integration boundary — Requirements, Controls &
 * Documentation, and Report are out of scope and are not mutated here.
 * Release 1 simulates the chain as one immutable audit event per hop (so the
 * propagation is inspectable in the Audit Log) plus one EngagementContext
 * timeline entry summarizing it. Release 2 replaces the simulated publishers
 * with real event producers inside each downstream workspace; this bus's
 * public `publish`/`subscribe` contract does not change when that happens.
 *
 * Depends on nothing in components/, keeping the js → components boundary
 * one-way. Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /**
   * The event vocabulary every workspace publishes and subscribes to.
   * Named as completed facts (Coding Standards §30.13 — Event Standards),
   * mirroring the router's own DOM event naming convention.
   */
  var EVENT_TYPES = {
    WALKTHROUGH_UPDATED: 'walkthrough-updated',
    REQUIREMENTS_UPDATED: 'requirements-updated',
    CONTROLS_UPDATED: 'controls-updated',
    REPORT_UPDATED: 'report-updated',
    APPROVAL_DECIDED: 'approval-decided',
    AUDIT_RECORDED: 'audit-recorded',
    AI_USAGE_RECORDED: 'ai-usage-recorded',
    TIMELINE_UPDATED: 'timeline-updated',
    CONTEXT_UPDATED: 'context-updated'
  };

  /**
   * The simulated propagation chain (Issue #36 §12), in hop order. A
   * walkthrough-originated change fans out through every downstream domain
   * on its way to updating the EngagementContext.
   */
  var PROPAGATION_CHAIN = [
    EVENT_TYPES.WALKTHROUGH_UPDATED,
    EVENT_TYPES.REQUIREMENTS_UPDATED,
    EVENT_TYPES.CONTROLS_UPDATED,
    EVENT_TYPES.REPORT_UPDATED,
    EVENT_TYPES.APPROVAL_DECIDED,
    EVENT_TYPES.AUDIT_RECORDED,
    EVENT_TYPES.AI_USAGE_RECORDED,
    EVENT_TYPES.TIMELINE_UPDATED,
    EVENT_TYPES.CONTEXT_UPDATED
  ];

  /** Per-event-type subscriber lists, plus one list of "every event" subscribers. */
  var listeners = {};
  var wildcardListeners = [];

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /**
   * Publishes one event. Every subscriber to that event type, plus every
   * wildcard subscriber, is notified with `{ eventType, payload,
   * publishedAt }`. A subscriber failure is isolated so one broken listener
   * cannot break the others (identical isolation contract to the Permission
   * Foundation and the Shared Audit State's own publish loop).
   */
  function publish(eventType, payload) {
    var detail = { eventType: eventType, payload: payload || {}, publishedAt: new Date().toISOString() };
    asArray(listeners[eventType]).slice().forEach(function (handler) {
      try {
        handler(detail);
      } catch (error) {
        global.console.error('SynchronizationBus subscriber failed for ' + eventType, error);
      }
    });
    wildcardListeners.slice().forEach(function (handler) {
      try {
        handler(detail);
      } catch (error) {
        global.console.error('SynchronizationBus wildcard subscriber failed', error);
      }
    });
    return detail;
  }

  /** Subscribes a handler to one event type. Returns an unsubscribe function. */
  function subscribe(eventType, handler) {
    if (typeof handler !== 'function') {
      return function () {};
    }
    if (!listeners[eventType]) {
      listeners[eventType] = [];
    }
    listeners[eventType].push(handler);
    return function () {
      var index = listeners[eventType].indexOf(handler);
      if (index !== -1) {
        listeners[eventType].splice(index, 1);
      }
    };
  }

  /** Subscribes a handler to every event, regardless of type. Returns an unsubscribe function. */
  function subscribeAll(handler) {
    if (typeof handler !== 'function') {
      return function () {};
    }
    wildcardListeners.push(handler);
    return function () {
      var index = wildcardListeners.indexOf(handler);
      if (index !== -1) {
        wildcardListeners.splice(index, 1);
      }
    };
  }

  /**
   * Simulates the full downstream propagation chain a walkthrough-originated
   * event triggers (Issue #36 §12). Publishes every hop of
   * `PROPAGATION_CHAIN` in order, records one immutable Platform Audit
   * Service event per hop under a shared correlation id (so the simulated
   * chain is inspectable in the Audit Log), and — when the
   * EngagementContextService is loaded and `context.engagementId` is
   * supplied — appends one EngagementContext timeline entry summarizing the
   * run. Never mutates Requirements, Controls & Documentation, or Report
   * state directly; those remain out of scope for this issue.
   */
  function propagate(originEventType, context) {
    var ctx = context || {};
    var auditService = AuditOS.auditService;
    var correlationId = auditService ? auditService.newCorrelationId() : null;
    var hops = [];

    PROPAGATION_CHAIN.forEach(function (eventType) {
      publish(eventType, {
        origin: originEventType,
        engagementId: ctx.engagementId || null,
        teamId: ctx.teamId || null,
        reason: ctx.reason || null
      });
      hops.push(eventType);
      if (auditService) {
        auditService.record({
          action: 'sync-bus-propagated',
          reason: ctx.reason || null,
          engagementId: ctx.engagementId || null,
          workspaceId: ctx.workspaceId || 'walkthroughs',
          correlationId: correlationId,
          metadata: { hop: eventType, origin: originEventType, teamId: ctx.teamId || null }
        });
      }
    });

    var contextService = AuditOS.engagementContextService;
    if (contextService && ctx.engagementId) {
      contextService.appendTimeline(ctx.engagementId, {
        date: new Date().toISOString().slice(0, 10),
        event: 'Synchronized: ' + hops.join(' → ')
      }, {
        action: 'engagement-context-synchronized',
        reason: ctx.reason || null,
        workspaceId: ctx.workspaceId || 'walkthroughs',
        correlationId: correlationId
      });
    }

    return { hops: hops, correlationId: correlationId };
  }

  AuditOS.synchronizationBus = {
    EVENT_TYPES: EVENT_TYPES,
    PROPAGATION_CHAIN: PROPAGATION_CHAIN,
    publish: publish,
    subscribe: subscribe,
    subscribeAll: subscribeAll,
    propagate: propagate
  };
})(window);
