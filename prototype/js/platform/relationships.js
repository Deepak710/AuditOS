/**
 * AuditOS Cross-Workspace Relationship Engine
 * GitHub Issue #30 (Cross-Workspace Relationship Engine & Live Derived State).
 *
 * The shared, read-only derivation layer for relationships that were
 * independently reimplemented — identically or near-identically — inside
 * multiple operational workspaces: control reference resolution, dated
 * activity-history normalization, and collection metadata. Every function
 * here is pure (state/records in, plain data out); nothing is stored,
 * nothing is fabricated, and no workspace's own status vocabulary, field
 * shape, or label text is assumed — callers pass those in. Where a
 * workspace's derivation reads fields specific to its own entity shape and
 * is not duplicated elsewhere, it stays owned by that workspace (Component
 * Design Patterns §81.4 — Composition Over Duplication; Workspace Shared
 * Platform, Issue #27 — "never over-centralize").
 *
 * Also exposes read-only graph traversal helpers over the identifier links
 * the current dataset schema actually declares (Requirement ↔ Controls ↔
 * Evidence Requests / Evidence, Testing ↔ Control / Finding). A hop is
 * included only where a real foreign-key field exists in the JSON; hops the
 * schema does not yet expose (e.g. Evidence ↔ Testing, Evidence ↔ Report)
 * are not fabricated.
 *
 * Loaded as a classic script, peer to `js/state/state-store.js`. Depends on
 * nothing in `components/` so the existing one-directional `js → components`
 * boundary is preserved when `components/workspace-shared/workspace-shared.js`
 * consumes this module. Loads after the state store and before
 * `workspace-shared.js` and every workspace module.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** Identity formatter used when a caller has no date formatter to share. */
  function identity(value) {
    return value;
  }

  // ------------------------------------------------------------------
  // Reference resolvers — extracted from findings.js and testing.js, which
  // each independently joined a finding/test's `libraryControlId` /
  // `controlId` against the shared control library, then the engagement
  // control set. Findings additionally surface `familyId` / `category` for
  // their own domain resolution; testing's callers simply ignore those
  // extra fields, so returning the superset changes no rendered output.
  // ------------------------------------------------------------------

  /**
   * The control a record (finding or test) relates to, resolved only where an
   * identifier genuinely joins: the shared control library by
   * `libraryControlId` first (the master definition every engagement
   * references), then the engagement control set by `controlId`. A record
   * whose identifiers join neither renders its raw `controlId` with no
   * title — never a fabricated control. Returns
   * `{ id, code, title, familyId, category }`.
   */
  function resolveControlRef(record, context) {
    var source = record || {};
    var ctx = context || {};
    var libraryControl = source.libraryControlId && ctx.libraryControlsById ? ctx.libraryControlsById[source.libraryControlId] : null;
    if (libraryControl) {
      return {
        id: source.controlId || source.libraryControlId || '',
        code: libraryControl.controlCode || '',
        title: libraryControl.title || '',
        familyId: libraryControl.controlFamilyId || '',
        category: ''
      };
    }
    var engagementControl = source.controlId && ctx.controlsById ? ctx.controlsById[source.controlId] : null;
    if (engagementControl) {
      return {
        id: source.controlId,
        code: engagementControl.controlId || '',
        title: engagementControl.title || '',
        familyId: '',
        category: engagementControl.category || ''
      };
    }
    return { id: source.controlId || '', code: '', title: '', familyId: '', category: '' };
  }

  /** A compact control-reference label — code + title where they resolve, else the raw identifier. */
  function controlRefLabel(related) {
    var source = related || {};
    var label = [source.code, source.title].filter(Boolean).join(' · ');
    return label || source.id || '';
  }

  // ------------------------------------------------------------------
  // Activity derivations — extracted from the near-identical "iterate
  // records, read dated history, append a synthetic updated-at event, sort
  // newest first, cap the list" algorithm independently reimplemented in
  // controls.js, requirements.js, findings.js, testing.js, and work-queue.js.
  // Each workspace keeps its own entity noun, subject text, meta fallback,
  // and status-tone vocabulary by passing them in; the shared function only
  // stops re-typing the read/normalize/sort/slice shape.
  // ------------------------------------------------------------------

  /**
   * Recent record activity, newest first: each record's dated history
   * entries, plus one synthetic "updated" event reflecting its own
   * `updatedAt` / `updatedOn`, when present. Every event derives from a real,
   * dated field; undated entries never appear. Options:
   *  - getRecord(item): unwraps the underlying record (default: identity;
   *    Work Queue passes `item.record`)
   *  - entityNoun: string or `function(item, record)` — the label used in the
   *    synthetic "<Noun> updated" title
   *  - getSubject(record, item): the text appended after the title's colon
   *    (default: `record.title || record.id`)
   *  - getMeta(entry): the history entry's meta text (default: `entry.status`)
   *  - resolveTone(status): the workspace's own status-tone vocabulary
   *  - getUpdatedMeta(record, item): meta text for the synthetic event
   *    (default: `record.status`)
   *  - getUpdatedTone(record, item): tone for the synthetic event (default:
   *    `resolveTone(record.status)`)
   *  - formatDate(value): the workspace's own date formatter
   *  - limit: max events returned (default 8, matching every caller's LIST_LIMIT)
   */
  function deriveActivityFromHistory(records, options) {
    var opts = options || {};
    var getRecord = opts.getRecord || identity;
    var entityNoun = opts.entityNoun || 'Record';
    var getSubject = opts.getSubject || function (record) { return record.title || record.id || ''; };
    var getMeta = opts.getMeta || function (entry) { return entry.status || ''; };
    var resolveTone = opts.resolveTone || function () { return null; };
    var getUpdatedMeta = opts.getUpdatedMeta || function (record) { return record.status || ''; };
    var getUpdatedTone = opts.getUpdatedTone || function (record) { return resolveTone(record.status); };
    var formatDate = opts.formatDate || identity;
    var limit = typeof opts.limit === 'number' ? opts.limit : 8;

    var events = [];
    asArray(records).forEach(function (item) {
      var record = getRecord(item) || {};
      var noun = typeof entityNoun === 'function' ? entityNoun(item, record) : entityNoun;
      var subject = getSubject(record, item);

      asArray(record.activityHistory || record.activity || record.history).forEach(function (entry) {
        var date = entry && (entry.date || entry.timestamp || entry.on);
        if (!date) {
          return;
        }
        events.push({
          title: (entry.title || entry.action || entry.status || (noun + ' updated')) + ': ' + subject,
          meta: getMeta(entry),
          timestamp: formatDate(date),
          date: date,
          tone: entry.tone || resolveTone(entry.status)
        });
      });

      var updated = record.updatedAt || record.updatedOn;
      if (updated) {
        events.push({
          title: noun + ' updated: ' + subject,
          meta: getUpdatedMeta(record, item),
          timestamp: formatDate(updated),
          date: updated,
          tone: getUpdatedTone(record, item)
        });
      }
    });

    return events
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
      .slice(0, limit);
  }

  /**
   * Remark events from the immutable activity log, newest first: extracted
   * from evidence.js and engagement.js, which each independently mapped the
   * same `activityEvents` shape (actor resolution by `byId` / `authorSide`,
   * "recorded a remark on <entity>") before appending their own
   * domain-specific event (evidence receipts, report status). Only the
   * shared remark-mapping step lives here; each caller still owns whatever
   * it appends or prepends. `formatDate` is the workspace's own date
   * formatter, shared or not.
   */
  function deriveRemarkActivity(activityEvents, actorNames, formatDate) {
    var names = actorNames || {};
    var format = formatDate || identity;
    return asArray(activityEvents)
      .filter(function (event) { return event && event.at; })
      .map(function (event) {
        return {
          actor: names[event.byId] || (event.authorSide === 'ha' ? 'Halcyon' : 'Client'),
          title: 'recorded a remark on ' + (event.entityId || event.entityType || ''),
          meta: event.note || '',
          timestamp: format(event.at),
          date: event.at
        };
      });
  }

  // ------------------------------------------------------------------
  // Collection metadata — extracted from the byte-identical "dedupe record
  // tags in first-seen order, then read created / modified / owner / version
  // / source" shape independently reimplemented in controls.js,
  // requirements.js, findings.js, testing.js, and (a minor variant of) evidence.js.
  // Entities with a genuinely different metadata shape (documentation's
  // report metadata, engagement's framework-derived tags, work queue's
  // minimal created/owner) are not forced into this shape and stay owned by
  // their own workspace.
  // ------------------------------------------------------------------

  /**
   * Collection metadata: created / modified / owner / version / tags /
   * source, derived from a dataset document's own metadata, the engagement,
   * and the company. Only fields with real values are surfaced by the
   * builder; tags are deduplicated in first-seen order across every record.
   * `formatDate` is the workspace's own date formatter.
   */
  function deriveCollectionMetadata(metadataDoc, engagement, company, records, formatDate) {
    var meta = metadataDoc || {};
    var format = formatDate || identity;
    var tagSet = {};
    var tagOrder = [];
    asArray(records).forEach(function (record) {
      asArray(record.tags).forEach(function (tag) {
        if (!tagSet[tag]) {
          tagSet[tag] = true;
          tagOrder.push(tag);
        }
      });
    });
    return {
      created: company && company.createdAt ? format(company.createdAt) : '',
      modified: meta.generatedAt ? format(String(meta.generatedAt).slice(0, 10)) : '',
      owner: engagement ? (engagement.engagementLead || engagement.auditor || '') : '',
      version: meta.version || '',
      tags: tagOrder,
      source: meta.dataset || ''
    };
  }

  // ------------------------------------------------------------------
  // Graph traversal helpers (Issue #30 — "expose graph traversal helpers").
  // Read-only joins over identifier links the current dataset schema actually
  // declares. Wired into the Testing Inspector (`getTestingGraph`, a direct,
  // behavior-preserving replacement of its own hand-rolled control/finding
  // joins) and the Findings Inspector (`getFindingGraph`, for the finding →
  // control → requirements hop) by Issue #31 — Cross-Workspace Record
  // Navigation. `getControlGraph` and `getRequirementGraph` join-and-drop an
  // id that does not resolve (`joinIds`), which is the right contract for a
  // multi-hop traversal but not for a single Inspector's "Related X" list,
  // where every other workspace's existing, tested contract is to render an
  // unresolved id raw rather than hide it (never fabricate, never hide real
  // data either) — so the Requirements, Controls, and Evidence Inspectors
  // keep their own local id-normalization + `resolveRefItem` (now
  // href-capable) instead of routing through these two. A hop is included
  // only where a real foreign-key field exists; Evidence ↔ Testing and
  // Evidence ↔ Report have no such field in the current dataset shapes and
  // are not fabricated here.
  // ------------------------------------------------------------------

  /** Reads the first non-empty array field present on a record, else []. */
  function firstLinkedIds(record, fieldNames) {
    var source = record || {};
    for (var index = 0; index < fieldNames.length; index += 1) {
      var value = source[fieldNames[index]];
      if (Array.isArray(value) && value.length > 0) {
        return value.slice();
      }
    }
    return [];
  }

  /** Joins a list of ids against an id-indexed map, dropping ids that do not resolve. */
  function joinIds(ids, byId) {
    var map = byId || {};
    return asArray(ids)
      .map(function (id) { return map[id]; })
      .filter(Boolean);
  }

  /**
   * The audit chain a control resolves to: the requirements it declares
   * (`requirementIds` / `linkedRequirementIds`), joined against
   * `context.requirementsById`.
   */
  function getControlGraph(control, context) {
    var ctx = context || {};
    var requirementIds = firstLinkedIds(control, ['requirementIds', 'linkedRequirementIds']);
    return {
      control: control || null,
      requirements: joinIds(requirementIds, ctx.requirementsById)
    };
  }

  /**
   * The audit chain a requirement resolves to: the controls it links
   * (`linkedControlIds`, or a single `controlId`), the evidence it links
   * (`evidenceIds` / `linkedEvidenceIds`), and the evidence requests it has
   * raised (`evidenceRequestIds`) — each joined against the matching
   * `context.*ById` map.
   */
  function getRequirementGraph(requirement, context) {
    var ctx = context || {};
    var source = requirement || {};
    var controlIds = firstLinkedIds(source, ['linkedControlIds']);
    if (controlIds.length === 0 && typeof source.controlId === 'string' && source.controlId) {
      controlIds = [source.controlId];
    }
    var evidenceIds = firstLinkedIds(source, ['evidenceIds', 'linkedEvidenceIds']);
    var evidenceRequestIds = firstLinkedIds(source, ['evidenceRequestIds']);
    return {
      requirement: requirement || null,
      controls: joinIds(controlIds, ctx.controlsById),
      evidence: joinIds(evidenceIds, ctx.evidenceById),
      evidenceRequests: joinIds(evidenceRequestIds, ctx.evidenceRequestsById)
    };
  }

  /**
   * The audit chain a test resolves to: its related control (via
   * `resolveControlRef`) and the finding it raised, where `findingId` joins
   * `context.findingsById`.
   */
  function getTestingGraph(test, context) {
    var ctx = context || {};
    var source = test || {};
    var finding = source.findingId && ctx.findingsById ? ctx.findingsById[source.findingId] : null;
    return {
      test: test || null,
      control: resolveControlRef(source, ctx),
      finding: finding || null
    };
  }

  /**
   * The audit chain a finding resolves to: its related control (via
   * `resolveControlRef`), the test it was raised from (`testId`, joined
   * against `context.testsById`), and the requirements that control declares
   * (`context.controlsById[controlId].requirementIds`) — a finding has no
   * requirement id of its own; the requirement relationship only exists
   * through the control it relates to, exactly as extracted from the
   * hand-rolled joins this replaces in the Findings workspace.
   */
  function getFindingGraph(finding, context) {
    var ctx = context || {};
    var source = finding || {};
    var testId = source.testId || '';
    var test = testId && ctx.testsById ? ctx.testsById[testId] : null;
    var engagementControl = source.controlId && ctx.controlsById ? ctx.controlsById[source.controlId] : null;
    var requirementIds = engagementControl && Array.isArray(engagementControl.requirementIds)
      ? engagementControl.requirementIds : [];
    return {
      finding: finding || null,
      control: resolveControlRef(source, ctx),
      test: test || null,
      requirements: joinIds(requirementIds, ctx.requirementsById)
    };
  }

  AuditOS.relationships = {
    resolveControlRef: resolveControlRef,
    controlRefLabel: controlRefLabel,
    deriveActivityFromHistory: deriveActivityFromHistory,
    deriveRemarkActivity: deriveRemarkActivity,
    deriveCollectionMetadata: deriveCollectionMetadata,
    getControlGraph: getControlGraph,
    getRequirementGraph: getRequirementGraph,
    getTestingGraph: getTestingGraph,
    getFindingGraph: getFindingGraph
  };
})(window);
