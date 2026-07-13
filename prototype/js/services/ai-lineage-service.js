/**
 * AuditOS AI Lineage Service
 * AI Lineage Architecture — GitHub Issue #39
 *
 * The reusable lineage architecture inherited by every AI-generated object:
 *
 *   Origin
 *     ↓ Walkthrough session
 *     ↓ Transcript timestamps
 *     ↓ Evidence file references
 *     ↓ AI reasoning
 *     ↓ Generated object
 *     ↓ Review history
 *     ↓ Approval history
 *     ↓ Current object
 *
 * Evidence is the first implementation; the same architecture serves
 * Controls, Findings, Reports, and future AI-generated entities: any record
 * type resolves through `buildLineage(record, descriptor)` into the same
 * ordered stage model.
 *
 * Honesty contract: every stage is derived from recorded facts only — the
 * record's own `aiLineage` / `origin` declarations, the immutable Platform
 * Audit Service trail, and the Suggestion Lifecycle records. A stage with no
 * recorded data is returned with `present: false` and never fabricated
 * content; a human-created object yields an 'Origin: manual' lineage with
 * the AI stages absent.
 *
 * Depends on nothing in components/, keeping the js → components boundary
 * one-way. Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** The canonical lineage stages, in order. */
  var STAGES = [
    { id: 'origin',             label: 'Origin' },
    { id: 'walkthrough-session', label: 'Walkthrough session' },
    { id: 'transcript',         label: 'Transcript timestamps' },
    { id: 'evidence-references', label: 'Evidence file references' },
    { id: 'ai-reasoning',       label: 'AI reasoning' },
    { id: 'generated-object',   label: 'Generated object' },
    { id: 'review-history',     label: 'Review history' },
    { id: 'approval-history',   label: 'Approval history' },
    { id: 'current-object',     label: 'Current object' }
  ];

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** The Platform Audit Service, resolved at call time. */
  function auditService() {
    return AuditOS.auditService || null;
  }

  /** One lineage stage instance. */
  function stage(descriptor, present, items) {
    return {
      id: descriptor.id,
      label: descriptor.label,
      present: Boolean(present),
      items: asArray(items)
    };
  }

  /** One lineage item — a recorded fact with an optional timestamp/actor. */
  function item(title, detail, timestamp) {
    return { title: title || '', detail: detail || '', timestamp: timestamp || '' };
  }

  /**
   * The record's declared AI lineage block, normalized. Datasets may record
   * it as `aiLineage` or `origin`; both are structural declarations of how
   * the object came to exist. Returns {} when the record declares none.
   */
  function declaredLineage(record) {
    var source = record || {};
    if (source.aiLineage && typeof source.aiLineage === 'object') {
      return source.aiLineage;
    }
    if (source.origin && typeof source.origin === 'object') {
      return source.origin;
    }
    return {};
  }

  /**
   * The recorded audit events touching the record, split into review events
   * (suggestion review / clarification actions) and approval events
   * (approve / reject / apply decisions), oldest first.
   */
  function recordedHistories(recordId, collectionId) {
    var service = auditService();
    if (!service || !recordId) {
      return { review: [], approval: [] };
    }
    var events = service.listForEntity(recordId, collectionId).slice().reverse();
    var review = [];
    var approval = [];
    events.forEach(function (event) {
      var action = String(event.action || '');
      var entry = item(
        action + (event.reason ? ' — ' + event.reason : ''),
        [event.user, event.comment || ''].filter(Boolean).join(' · '),
        event.timestamp
      );
      if (action.indexOf('approv') !== -1 || action.indexOf('reject') !== -1 ||
          action.indexOf('applied') !== -1 || action.indexOf('decision') !== -1) {
        approval.push(entry);
      } else {
        review.push(entry);
      }
    });
    return { review: review, approval: approval };
  }

  AuditOS.aiLineage = {
    STAGES: STAGES,

    /**
     * Builds the complete lineage of one object. `descriptor` names the
     * object's collection (`collectionId`, for the audit trail) and its
     * display label (`objectLabel`). Every stage is returned in canonical
     * order; stages without recorded data carry `present: false`.
     */
    buildLineage: function (record, descriptor) {
      var source = record || {};
      var config = descriptor || {};
      var declared = declaredLineage(source);
      var histories = recordedHistories(source.id, config.collectionId);

      var originKind = declared.kind || declared.source ||
        (declared.walkthroughSessionId ? 'AI generated' : '');
      var originItems = originKind
        ? [item(originKind, declared.generatedBy || declared.model || '', declared.generatedAt || '')]
        : [];

      var sessionItems = declared.walkthroughSessionId
        ? [item('Session ' + declared.walkthroughSessionId, declared.walkthroughTitle || '', declared.sessionDate || '')]
        : [];

      var transcriptItems = asArray(declared.transcriptReferences).map(function (reference) {
        var ref = reference || {};
        return item(ref.timestamp || ref.time || '', ref.excerpt || ref.text || '', '');
      });

      var evidenceItems = asArray(declared.evidenceReferences).map(function (reference) {
        var ref = reference || {};
        if (typeof ref === 'string') {
          return item(ref, '', '');
        }
        return item(ref.fileName || ref.id || '', ref.detail || '', '');
      });

      var reasoningItems = declared.reasoning
        ? [item(declared.reasoning, declared.confidence ? 'Confidence: ' + declared.confidence : '', '')]
        : [];

      var generatedItems = declared.generatedAt || originKind
        ? [item(config.objectLabel || source.title || source.id || 'Generated object', source.id || '', declared.generatedAt || '')]
        : [];

      var currentItems = [item(
        config.objectLabel || source.title || source.id || '',
        source.reviewStatus || source.status || '',
        source.updatedAt || source.uploadedOn || ''
      )];

      return {
        objectId: source.id || '',
        collectionId: config.collectionId || '',
        stages: [
          stage(STAGES[0], originItems.length > 0, originItems),
          stage(STAGES[1], sessionItems.length > 0, sessionItems),
          stage(STAGES[2], transcriptItems.length > 0, transcriptItems),
          stage(STAGES[3], evidenceItems.length > 0, evidenceItems),
          stage(STAGES[4], reasoningItems.length > 0, reasoningItems),
          stage(STAGES[5], generatedItems.length > 0, generatedItems),
          stage(STAGES[6], histories.review.length > 0, histories.review),
          stage(STAGES[7], histories.approval.length > 0, histories.approval),
          stage(STAGES[8], true, currentItems)
        ]
      };
    },

    /** Whether a record declares any AI origin at all. */
    isAiGenerated: function (record) {
      var declared = declaredLineage(record);
      return Boolean(declared.kind || declared.walkthroughSessionId || declared.reasoning || declared.generatedAt);
    }
  };
})(window);
