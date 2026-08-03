/**
 * AuditOS Report Version Service
 * Living Reporting & Operational Findings — GitHub Issue #41 (Report Versions)
 *
 * The report's version register and the one place its lifecycle advances:
 *
 *   Draft → AI Draft → Reviewer Approved → Partner Approved → Issued
 *
 * An Issued version is immutable. Editing an issued report never rewrites it:
 * the edit opens a new Draft version that carries the issued one forward as its
 * predecessor, so the issued document a client received stays byte-for-byte what
 * it was. That rule is enforced here, once, rather than trusted to each caller.
 *
 * Baseline honesty: the report document already records its own `version` and
 * `status`, so an engagement with no version records still has a real, current
 * version — this service surfaces that recorded fact as the baseline entry
 * rather than inventing a history. Version records created during a session are
 * audited Repository writes (`report-versions`), exactly like every other
 * simulated write in the prototype; nothing is persisted to disk.
 *
 * Depends on nothing in components/, keeping the js → components boundary
 * one-way. Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** The report version lifecycle vocabulary (Issue #41 — Report Versions). */
  var STATUS = {
    DRAFT: 'Draft',
    AI_DRAFT: 'AI Draft',
    REVIEWER_APPROVED: 'Reviewer Approved',
    PARTNER_APPROVED: 'Partner Approved',
    ISSUED: 'Issued'
  };

  /** The lifecycle in advance order; a version only ever moves forward. */
  var LIFECYCLE = [
    STATUS.AI_DRAFT,
    STATUS.DRAFT,
    STATUS.REVIEWER_APPROVED,
    STATUS.PARTNER_APPROVED,
    STATUS.ISSUED
  ];

  /**
   * The capability that gates advancing a report version. Reuses the existing
   * approvals capability rather than introducing a parallel permission model —
   * approving a report is an approval (Permission Foundation, Issue #33/#34).
   */
  var ADVANCE_CAPABILITY = 'approvals.decide';

  /** Statuses that make a version immutable (Issue #41 — "Issued reports are immutable"). */
  var IMMUTABLE_STATUSES = [STATUS.ISSUED];

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** Today's date in the dataset's own ISO date convention. */
  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  /** The acting session's label, for version history (never an invented user). */
  function sessionLabel() {
    var permissions = AuditOS.permissions;
    return permissions && typeof permissions.getSessionInfo === 'function'
      ? permissions.getSessionInfo().label : '';
  }

  /** Whether a version status is immutable. */
  function isImmutable(status) {
    return IMMUTABLE_STATUSES.indexOf(status) !== -1;
  }

  /**
   * The lifecycle status a recorded status corresponds to, or null when it does
   * not correspond to one.
   *
   * A report document records its own status in the document's own vocabulary —
   * the demo reports carry statuses like "Final (pending Sections I–II at
   * issuance)" — which is a description of the document, not a position in the
   * approval lifecycle. Those two vocabularies are deliberately not merged:
   * reading "Final" as "Issued" would claim a partner approval nobody gave.
   * A recorded status outside the lifecycle simply means the version register
   * has not been entered yet, and `ENTRY_STATUS` is where entering it begins.
   */
  function resolveLifecycleStatus(status) {
    return LIFECYCLE.indexOf(status) === -1 ? null : status;
  }

  /**
   * Where a report enters the version register when its recorded status is not
   * a lifecycle status: a Draft awaiting reviewer approval. Never Issued — a
   * report is only issued by someone issuing it.
   */
  var ENTRY_STATUS = STATUS.DRAFT;

  /** The status that follows one in the lifecycle, or null at the end (and for Issued). */
  function nextStatus(status) {
    var index = LIFECYCLE.indexOf(status);
    if (index === -1) {
      // A status outside the lifecycle has not entered the register yet;
      // advancing it enters at the entry status.
      return ENTRY_STATUS;
    }
    if (index === LIFECYCLE.length - 1) {
      return null;
    }
    return LIFECYCLE[index + 1];
  }

  /**
   * The next version label after `version`. A dotted numeric version advances
   * its minor component (1.0 → 1.1); an issued version starts the next major
   * (1.3 → 2.0), because an edit after issuance is a new edition of the report,
   * not a revision of the one already delivered. A non-numeric recorded version
   * is carried forward with a `.1` suffix rather than being reinterpreted.
   */
  function nextVersionLabel(version, afterIssued) {
    var raw = String(version || '').trim();
    var parts = /^(\d+)(?:\.(\d+))?$/.exec(raw);
    if (!parts) {
      return raw ? raw + '.1' : '1.0';
    }
    var major = Number(parts[1]);
    var minor = parts[2] === undefined ? 0 : Number(parts[2]);
    if (afterIssued) {
      return (major + 1) + '.0';
    }
    return major + '.' + (minor + 1);
  }

  /** The dataset id an engagement's report-version document lives under, or null. */
  function resolveDatasetId(repository, engagementId) {
    if (!repository || !repository.reportVersions || !engagementId) {
      return null;
    }
    var datasets = repository.reportVersions.datasetsForEngagement(engagementId);
    return datasets.length > 0 ? datasets[0] : null;
  }

  /**
   * The baseline version entry derived from the report document's own recorded
   * identity — a real, current fact, not a fabricated history. Returns null when
   * the document records no version at all.
   */
  function baselineVersion(reportDocument) {
    var identity = (reportDocument && reportDocument.document) || {};
    if (!identity.version && !identity.status) {
      return null;
    }
    var recorded = identity.status || STATUS.DRAFT;
    return {
      id: 'RPTV-BASELINE',
      version: identity.version || '',
      // The recorded status renders verbatim — the register never restates the
      // report document in a vocabulary the document did not use.
      status: recorded,
      lifecycleStatus: resolveLifecycleStatus(recorded),
      label: identity.title || '',
      createdBy: '',
      createdOn: '',
      note: 'Recorded in the report document.',
      baseline: true,
      immutable: isImmutable(recorded),
      previousVersion: ''
    };
  }

  /**
   * Every version of the engagement's report, oldest first: the recorded
   * baseline (when the document declares one) followed by the version records
   * created during the session, in creation order.
   */
  function listVersions(repository, engagementId, reportDocument) {
    var datasetId = resolveDatasetId(repository, engagementId);
    var records = datasetId
      ? repository.reportVersions.list({ datasetId: datasetId }).map(function (record) {
        var status = record.status || STATUS.DRAFT;
        return {
          id: record.id,
          version: record.version || '',
          status: status,
          // A version record is always created at a lifecycle status, so its
          // recorded and lifecycle statuses are the same value.
          lifecycleStatus: resolveLifecycleStatus(status),
          label: record.label || '',
          createdBy: record.createdBy || '',
          createdOn: record.createdOn || '',
          note: record.note || '',
          baseline: false,
          immutable: isImmutable(status),
          previousVersion: record.previousVersion || ''
        };
      })
      : [];
    var baseline = baselineVersion(reportDocument);
    return baseline ? [baseline].concat(records) : records;
  }

  /** The newest version of the report — the one the workspace acts on. */
  function currentVersion(repository, engagementId, reportDocument) {
    var versions = listVersions(repository, engagementId, reportDocument);
    return versions.length > 0 ? versions[versions.length - 1] : null;
  }

  /**
   * Creates a new report version. `options` is
   * `{ status, label, note, previousVersion, workspaceId }`. The version label
   * is derived from the current one unless the caller states it explicitly.
   * Returns the stored record, or null when the engagement has no version
   * dataset to hold it.
   */
  function createVersion(repository, engagementId, reportDocument, options) {
    var settings = options || {};
    var datasetId = resolveDatasetId(repository, engagementId);
    if (!datasetId) {
      return null;
    }
    var current = currentVersion(repository, engagementId, reportDocument);
    var auditService = AuditOS.auditService;
    var idService = AuditOS.idService;
    var record = {
      id: idService ? idService.next('RPTV-' + engagementId) : 'RPTV-' + engagementId + '-' + Date.now(),
      engagementId: engagementId,
      version: settings.version ||
        nextVersionLabel(current ? current.version : '', Boolean(current && isImmutable(current.status))),
      status: settings.status || STATUS.DRAFT,
      label: settings.label || '',
      note: settings.note || '',
      previousVersion: settings.previousVersion || (current ? current.version : ''),
      createdBy: sessionLabel(),
      createdOn: todayIso()
    };
    return repository.reportVersions.create(record, {
      datasetId: datasetId,
      action: 'report-version-created',
      reason: record.note || ('Report version ' + record.version),
      engagementId: engagementId,
      workspaceId: settings.workspaceId || 'reporting',
      correlationId: auditService ? auditService.newCorrelationId() : null
    });
  }

  /**
   * Advances the current version one step along the lifecycle. An issued
   * version never advances — it is the end of the line, and immutable — so this
   * returns null and the caller offers `openRevision` instead. A baseline
   * version (recorded in the report document, not in the version register)
   * advances by creating the first real version record at the next status,
   * which is exactly how the register begins; when the recorded status is not a
   * lifecycle status at all, that first record enters at the entry status.
   */
  function advance(repository, engagementId, reportDocument, note) {
    var current = currentVersion(repository, engagementId, reportDocument);
    if (!current || isImmutable(current.status)) {
      return null;
    }
    var target = nextStatus(current.status);
    if (!target) {
      return null;
    }
    if (current.baseline) {
      return createVersion(repository, engagementId, reportDocument, {
        version: current.version,
        status: target,
        label: current.label,
        note: note || ''
      });
    }
    var datasetId = resolveDatasetId(repository, engagementId);
    if (!datasetId) {
      return null;
    }
    var auditService = AuditOS.auditService;
    return repository.reportVersions.update(current.id, {
      status: target,
      note: note || current.note
    }, {
      datasetId: datasetId,
      action: 'report-version-advanced',
      reason: note || ('Advanced to ' + target),
      engagementId: engagementId,
      workspaceId: 'reporting',
      correlationId: auditService ? auditService.newCorrelationId() : null
    });
  }

  /**
   * Opens a new Draft revision on top of an issued report (Issue #41 — "Edits
   * create new versions"). Returns null when the current version is not issued,
   * because a version still in flight is edited in place rather than forked.
   */
  function openRevision(repository, engagementId, reportDocument, note) {
    var current = currentVersion(repository, engagementId, reportDocument);
    if (!current || !isImmutable(current.status)) {
      return null;
    }
    return createVersion(repository, engagementId, reportDocument, {
      status: STATUS.DRAFT,
      label: current.label,
      note: note || 'Revision opened on issued report ' + current.version,
      previousVersion: current.version
    });
  }

  /**
   * Whether the report may be edited right now, and why not when it may not.
   * The Reporting workspace reads this to decide whether the section editor
   * offers "propose a change" or the issued-report explanation.
   */
  function editability(repository, engagementId, reportDocument) {
    var current = currentVersion(repository, engagementId, reportDocument);
    if (!current) {
      return { editable: true, reason: '', version: null };
    }
    if (isImmutable(current.status)) {
      return {
        editable: false,
        reason: 'Version ' + current.version + ' has been issued and is immutable. Opening a revision creates version ' +
          nextVersionLabel(current.version, true) + ' as a new Draft; the issued report is never rewritten.',
        version: current
      };
    }
    return { editable: true, reason: '', version: current };
  }

  AuditOS.reportVersionService = {
    STATUS: STATUS,
    LIFECYCLE: LIFECYCLE,
    ENTRY_STATUS: ENTRY_STATUS,
    IMMUTABLE_STATUSES: IMMUTABLE_STATUSES,
    ADVANCE_CAPABILITY: ADVANCE_CAPABILITY,

    isImmutable: isImmutable,
    resolveLifecycleStatus: resolveLifecycleStatus,
    nextStatus: nextStatus,
    nextVersionLabel: nextVersionLabel,
    baselineVersion: baselineVersion,
    listVersions: listVersions,
    currentVersion: currentVersion,
    createVersion: createVersion,
    advance: advance,
    openRevision: openRevision,
    editability: editability
  };
})(window);
