/**
 * AuditOS Evidence Lifecycle
 * Evidence Workspace Consolidation — GitHub Issue #39
 *
 * The canonical, expanded evidence status model — the one vocabulary every
 * surface (table, drawer, charts, filters, approvals, audit history) renders
 * evidence status from. Each status declares its lifecycle phase, its
 * presentation tone, and whether it is a pending state (a state an approval
 * decision can still move), which the predictive metrics use to project
 * "all pending approvals accepted".
 *
 * The legacy demo vocabulary (enums.json `evidenceStatusLegacy`) maps onto
 * this model via `LEGACY_STATUS_MAP`, so differently sourced datasets still
 * resolve; an unknown status renders as itself with a neutral tone — never
 * fabricated, never dropped.
 *
 * Evidence Types (Issue #39 — persistent colors): every evidence type is
 * assigned one persistent color key, consistent across the application. The
 * palette keys map to CSS custom properties (css/evidence.css); an
 * unregistered type resolves deterministically from its name so the same
 * type always renders the same color.
 *
 * Depends on nothing in components/, keeping the js → components boundary
 * one-way. Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Presentation tones (mirrors the shared tone vocabulary). */
  var TONES = { INFO: 'info', SUCCESS: 'success', WARNING: 'warning', ERROR: 'error' };

  /** Lifecycle phases, in canonical order. */
  var PHASES = ['Request', 'Collection', 'Review', 'Resolution', 'Closure'];

  /**
   * The canonical lifecycle, in order. `pending` marks the statuses an
   * approval decision can still move — the ones the projected (ghosted)
   * metrics assume accepted.
   */
  var STATUSES = [
    { id: 'requested',              label: 'Requested',               phase: 'Request',    tone: TONES.INFO,    pending: true },
    { id: 'requested-consulting',   label: 'Requested by Consulting', phase: 'Request',    tone: TONES.INFO,    pending: true },
    { id: 'population-pending',     label: 'Population Pending',      phase: 'Collection', tone: TONES.WARNING, pending: true },
    { id: 'population-received',    label: 'Population Received',     phase: 'Collection', tone: TONES.INFO,    pending: true },
    { id: 'partially-received',     label: 'Partially Received',      phase: 'Collection', tone: TONES.WARNING, pending: true },
    // "Received" is the settled, good terminal state of collection — the
    // demo vocabulary's "All Evidence Received" maps here — so it reads as
    // success and is not a pending decision the projection would move.
    { id: 'received',               label: 'Received',                phase: 'Collection', tone: TONES.SUCCESS, pending: false },
    { id: 'under-review',           label: 'Under Review',            phase: 'Review',     tone: TONES.INFO,    pending: true },
    { id: 'clarification-needed',   label: 'Clarification Needed',    phase: 'Review',     tone: TONES.WARNING, pending: true },
    { id: 'revision-requested',     label: 'Revision Requested',      phase: 'Review',     tone: TONES.WARNING, pending: true },
    { id: 'accepted',               label: 'Accepted',                phase: 'Resolution', tone: TONES.SUCCESS, pending: false },
    { id: 'rejected',               label: 'Rejected',                phase: 'Resolution', tone: TONES.ERROR,   pending: false },
    { id: 'not-applicable',         label: 'Not Applicable',          phase: 'Resolution', tone: null,          pending: false },
    { id: 'duplicate',              label: 'Duplicate',               phase: 'Resolution', tone: null,          pending: false },
    { id: 'reused',                 label: 'Reused',                  phase: 'Resolution', tone: TONES.INFO,    pending: false },
    { id: 'cross-engagement',       label: 'Cross Engagement',        phase: 'Resolution', tone: TONES.INFO,    pending: false },
    { id: 'archived',               label: 'Archived',                phase: 'Closure',    tone: null,          pending: false },
    { id: 'closed',                 label: 'Closed',                  phase: 'Closure',    tone: TONES.SUCCESS, pending: false }
  ];

  /** Legacy demo-data vocabulary → canonical status label. */
  var LEGACY_STATUS_MAP = {
    'No Action': 'Requested',
    'No Action - POC Details Requested by HA': 'Requested',
    'Requested by Consulting Team': 'Requested by Consulting',
    'Requested by SOC Team': 'Requested',
    'Evidence Received - Under HA Review': 'Under Review',
    'Evidence Reviewed - Clarification Needed': 'Clarification Needed',
    'Evidence Partially Received': 'Partially Received',
    'Population Pending - HA unable to share samples': 'Population Pending',
    'All Evidence Received': 'Received',
    'Not Applicable': 'Not Applicable',
    // Demo-lifecycle vocabulary of earlier issues.
    'Approved': 'Accepted',
    'Pending Review': 'Under Review',
    'Rejected': 'Rejected'
  };

  /** Status label → status descriptor index. */
  var BY_LABEL = {};
  STATUSES.forEach(function (status, index) {
    BY_LABEL[status.label] = { status: status, order: index };
  });

  /**
   * Evidence Type → persistent color key. Keys are stable, application-wide
   * identities styled by css/evidence.css (`--aos-evidence-type-…`); every
   * surface rendering an evidence type uses the same key, so the type reads
   * as the same color everywhere.
   */
  var TYPE_COLOR_KEYS = {
    'Configuration': 'configuration',
    'Documentation': 'documentation',
    'Population': 'population',
    'Photograph': 'photograph',
    'Walkthrough': 'walkthrough',
    'Sample based': 'sample',
    'Sample-based + Documentation': 'sample-documentation',
    'Sample-based + Configuration': 'sample-configuration'
  };

  /** Deterministic fallback color keys for types the map does not register. */
  var FALLBACK_COLOR_KEYS = ['slate', 'teal', 'indigo', 'amber', 'rose', 'cyan'];

  /** Canonicalizes a status value: legacy vocabulary maps, canonical passes through. */
  function canonicalStatus(value) {
    if (!value) {
      return '';
    }
    if (Object.prototype.hasOwnProperty.call(BY_LABEL, value)) {
      return value;
    }
    return LEGACY_STATUS_MAP[value] || value;
  }

  /** The descriptor of a status label (legacy values map first), or null. */
  function describe(value) {
    var label = canonicalStatus(value);
    var entry = BY_LABEL[label];
    return entry ? entry.status : null;
  }

  AuditOS.evidenceLifecycle = {
    PHASES: PHASES,
    STATUSES: STATUSES,
    LEGACY_STATUS_MAP: LEGACY_STATUS_MAP,

    /** The canonical status labels, in lifecycle order. */
    statusLabels: function () {
      return STATUSES.map(function (status) { return status.label; });
    },

    canonicalStatus: canonicalStatus,
    describe: describe,

    /** The presentation tone of a status; unknown statuses read neutral. */
    toneOf: function (value) {
      var status = describe(value);
      return status ? status.tone : TONES.INFO;
    },

    /** The lifecycle phase of a status, or '' when unknown. */
    phaseOf: function (value) {
      var status = describe(value);
      return status ? status.phase : '';
    },

    /** The lifecycle order index of a status, or -1 when unknown. */
    orderOf: function (value) {
      var entry = BY_LABEL[canonicalStatus(value)];
      return entry ? entry.order : -1;
    },

    /** Whether a status is a pending state an approval decision can still move. */
    isPending: function (value) {
      var status = describe(value);
      return Boolean(status && status.pending);
    },

    /**
     * The persistent color key of an evidence type — registered types map
     * directly; unregistered ones resolve deterministically from their name
     * so the same type always renders the same color.
     */
    typeColorKey: function (evidenceType) {
      if (!evidenceType) {
        return 'slate';
      }
      if (Object.prototype.hasOwnProperty.call(TYPE_COLOR_KEYS, evidenceType)) {
        return TYPE_COLOR_KEYS[evidenceType];
      }
      var hash = 0;
      for (var index = 0; index < evidenceType.length; index += 1) {
        hash = (hash * 31 + evidenceType.charCodeAt(index)) % 997;
      }
      return FALLBACK_COLOR_KEYS[hash % FALLBACK_COLOR_KEYS.length];
    }
  };
})(window);
