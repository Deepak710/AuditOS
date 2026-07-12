/**
 * AuditOS Platform Audit Service
 * Platform Foundation II — GitHub Issue #34 (Platform Audit Service /
 * Approval Workflow)
 *
 * The platform-wide immutable audit trail. Every significant action —
 * repository writes, approval decisions, approval requests, session role
 * switches, wizard completions — records one event carrying the complete
 * Issue #34 schema: timestamp, user, role, session, action, entity,
 * previous value, new value, reason, approval chain, client, program,
 * engagement, workspace, correlation id, and metadata.
 *
 * Immutability is the service contract: this module exposes `record` and
 * reads only — no update, no removal. Events are stored in the `audit-logs`
 * collection through the Shared Audit State's simulated write API, so like
 * every simulated write they live in memory only, never touch demo-data
 * files, and are discarded by reset. The dataset baseline is intentionally
 * empty: the platform fabricates no history.
 *
 * The acting user is resolved honestly: the caller may name the actor, else
 * the current session's user resolves through the same rule the global
 * header applies (the current engagement's recorded lead) — never an
 * invented name. Role and session identity come from the Permission
 * Foundation's session info.
 *
 * Depends on nothing in components/, keeping the js → components boundary
 * one-way. Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** The Shared Audit State collection audit events are stored in. */
  var COLLECTION_ID = 'audit-logs';

  /** Engagement lifecycle vocabulary used only to resolve the acting user. */
  var ENGAGEMENT_STATUS = { IN_PROGRESS: 'In Progress' };

  /** Monotonic source for correlation identifiers within one page session. */
  var correlationCounter = 0;

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** The Shared Audit State store, resolved at call time. */
  function stateStore() {
    return AuditOS.state || null;
  }

  /**
   * Resolves the acting user for an event: the caller's explicit actor, else
   * the current engagement's recorded lead (the same rule the global header
   * derives the signed-in user from), else '' — never a fabricated name.
   */
  function resolveActor(explicitUser) {
    if (explicitUser) {
      return explicitUser;
    }
    var state = stateStore();
    if (!state || !state.isReady()) {
      return '';
    }
    var engagements = state.listRecords('engagements');
    var current = null;
    for (var index = 0; index < engagements.length; index += 1) {
      if (!current && engagements[index].status === ENGAGEMENT_STATUS.IN_PROGRESS) {
        current = engagements[index];
      }
    }
    current = current || engagements[0] || null;
    // The recorded lead when the dataset declares one, else the recorded
    // audit firm — the same join-or-fallback the Engagement workspace and
    // Relationship Engine apply. Never an invented name.
    return current ? (current.engagementLead || current.auditor || '') : '';
  }

  /** The current session's identity from the Permission Foundation, or nulls. */
  function resolveSessionInfo() {
    var permissions = AuditOS.permissions;
    if (permissions && typeof permissions.getSessionInfo === 'function') {
      var info = permissions.getSessionInfo();
      return {
        role: asArray(info.roles).join(' · '),
        session: info.label || info.presetId || null
      };
    }
    return { role: null, session: null };
  }

  AuditOS.auditService = {
    COLLECTION_ID: COLLECTION_ID,

    /** A fresh correlation identifier grouping the events of one user action. */
    newCorrelationId: function () {
      correlationCounter += 1;
      return 'COR-' + String(1000 + correlationCounter).slice(1);
    },

    /**
     * Records one immutable audit event. `event` supplies the action (required)
     * and any of: entity `{ collection, recordId, datasetId }`, previousValue,
     * newValue, reason, approvalChain, companyId, programId, engagementId,
     * workspaceId, correlationId, metadata, user. Timestamp, user, role, and
     * session identity are stamped here. Returns the stored event copy, or
     * null when the store is unavailable or the action is missing.
     */
    record: function (event) {
      var state = stateStore();
      var source = event || {};
      if (!state || !source.action || typeof source.action !== 'string') {
        return null;
      }
      var sessionInfo = resolveSessionInfo();
      return state.createRecord(COLLECTION_ID, {
        timestamp: new Date().toISOString(),
        user: resolveActor(source.user),
        role: sessionInfo.role,
        session: sessionInfo.session,
        action: source.action,
        entity: source.entity || null,
        previousValue: source.previousValue === undefined ? null : source.previousValue,
        newValue: source.newValue === undefined ? null : source.newValue,
        reason: source.reason || null,
        approvalChain: source.approvalChain || null,
        companyId: source.companyId || null,
        programId: source.programId || null,
        engagementId: source.engagementId || null,
        workspaceId: source.workspaceId || null,
        correlationId: source.correlationId || null,
        metadata: source.metadata || null
      });
    },

    /**
     * The recorded audit events, newest first, optionally filtered by
     * `{ action, engagementId, companyId, workspaceId, correlationId }` —
     * every filter field must match when present.
     */
    list: function (filter) {
      var state = stateStore();
      if (!state) {
        return [];
      }
      var criteria = filter || {};
      return state.listRecords(COLLECTION_ID).filter(function (entry) {
        return ['action', 'engagementId', 'companyId', 'workspaceId', 'correlationId']
          .every(function (field) {
            return !criteria[field] || entry[field] === criteria[field];
          });
      }).sort(function (a, b) {
        return String(b.timestamp).localeCompare(String(a.timestamp));
      });
    },

    /**
     * The recorded audit events touching one entity record, newest first —
     * the contextual history surfaced within entity workspaces (Issue #34).
     * `collectionId` narrows to one collection when the same identifier
     * could exist in several.
     */
    listForEntity: function (recordId, collectionId) {
      if (!recordId) {
        return [];
      }
      return this.list().filter(function (entry) {
        if (!entry.entity || entry.entity.recordId !== recordId) {
          return false;
        }
        return !collectionId || entry.entity.collection === collectionId;
      });
    }
  };
})(window);
