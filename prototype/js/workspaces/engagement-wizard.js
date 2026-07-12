/**
 * AuditOS Engagement Creation Wizard Workspace
 * Platform Foundation II — GitHub Issue #34 (Engagement Creation Wizard)
 *
 * The multi-step engagement scoping flow — the future entry point for
 * AI-assisted scoping (Release 2). Client, Engagement Details, Audit
 * Period, Scope, Program, Team, and Review: every selectable option derives
 * from real records (clients, programs, and the engagement-type vocabulary
 * the dataset itself carries) — never a fabricated list.
 *
 * Repository-backed: completing the wizard creates the engagement through
 * the Repository Foundation's simulated write pipeline (and appends it to
 * its program when one is chosen), recording immutable Platform Audit
 * Service events. The captured-values → record mapping is a pure,
 * offline-testable function.
 *
 * Capability-gated (Issue #33 §5): sessions without `engagements.create`
 * see the shared Permission Notice, never a disabled form.
 *
 * Single Pane shell (Issue #34); the wizard chrome comes from the shared
 * wizard engine (components/wizard/wizard.js), never re-invented here.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Shared Workspace Platform (Issue #27). */
  var WS = AuditOS.workspaceShared || {};

  /** The Shared Workspace Framework slots this workspace fills directly. */
  var SLOTS = {
    CONTENT: 'primary-content',
    RELATED: 'related-information',
    AI: 'ai-recommendations',
    ACTIVITY: 'activity',
    FOOTER: 'workspace-footer'
  };

  /** The capability that gates engagement creation (Permission Foundation). */
  var CREATE_CAPABILITY = 'engagements.create';

  /** Returns the value when it is an array, otherwise an empty array. */
  var asArray = WS.asArray;

  /** The distinct engagement types the dataset's own records carry (read, never invented). */
  function deriveEngagementTypes(engagements) {
    var seen = {};
    var types = [];
    asArray(engagements).forEach(function (engagement) {
      if (engagement.engagementType && !seen[engagement.engagementType]) {
        seen[engagement.engagementType] = true;
        types.push(engagement.engagementType);
      }
    });
    return types;
  }

  /**
   * The wizard's declarative steps, built against the current data so every
   * select lists real clients, real programs, and the dataset's own
   * engagement-type vocabulary. Pure and offline-testable.
   */
  function buildSteps(clients, programs, engagements) {
    return [
      {
        id: 'client', title: 'Client',
        description: 'The client this engagement belongs to.',
        fields: [{
          id: 'companyId', label: 'Client', type: 'select', required: true,
          options: asArray(clients).map(function (client) {
            return { value: client.id, label: client.name };
          })
        }]
      },
      {
        id: 'engagement-details', title: 'Engagement Details',
        fields: [
          { id: 'name', label: 'Engagement name', type: 'text', required: true },
          { id: 'engagementCode', label: 'Engagement code', type: 'text', required: true, help: 'Short, stable identifier — it becomes the engagement\'s routing slug.' },
          {
            id: 'engagementType', label: 'Engagement type', type: 'select', required: true,
            options: deriveEngagementTypes(engagements)
          },
          { id: 'framework', label: 'Framework', type: 'text', required: true, placeholder: 'e.g. the assurance framework in scope' }
        ]
      },
      {
        id: 'audit-period', title: 'Audit Period',
        fields: [
          { id: 'periodStart', label: 'Period start', type: 'date', required: true },
          { id: 'periodEnd', label: 'Period end', type: 'date', required: true }
        ]
      },
      {
        id: 'scope', title: 'Scope',
        fields: [
          { id: 'inScopeLocations', label: 'In-scope locations', type: 'list', help: 'One location per line.' },
          { id: 'inScopeSystems', label: 'In-scope systems', type: 'list', help: 'One system per line.' },
          { id: 'criteriaCategories', label: 'Criteria categories', type: 'list', help: 'One category per line.' }
        ]
      },
      {
        id: 'program', title: 'Program',
        description: 'Joining a program shares its requirement list and evidence reuse.',
        fields: [{
          id: 'programId', label: 'Audit program (optional)', type: 'select',
          options: asArray(programs).map(function (program) {
            return { value: program.id, label: program.name };
          })
        }]
      },
      {
        id: 'team', title: 'Team',
        fields: [
          { id: 'auditor', label: 'Audit firm', type: 'text', required: true },
          { id: 'engagementLead', label: 'Engagement lead', type: 'text' }
        ]
      },
      { id: 'review', title: 'Review', review: true, description: 'Everything captured, read back before anything is created.' }
    ];
  }

  /**
   * Maps the wizard's captured values onto the engagement record the
   * Repository stores — the same shape the engagements collection already
   * carries. Pure and offline-testable.
   */
  function buildEngagementRecord(values) {
    var source = values || {};
    var record = {
      companyId: source.companyId || null,
      programId: source.programId || null,
      engagementCode: (source.engagementCode || '').toUpperCase(),
      name: source.name || '',
      framework: source.framework || '',
      engagementType: source.engagementType || '',
      status: 'In Progress',
      auditPeriod: {
        startDate: source.periodStart || null,
        endDate: source.periodEnd || null
      },
      auditor: source.auditor || ''
    };
    if (source.engagementLead) { record.engagementLead = source.engagementLead; }
    if (asArray(source.inScopeLocations).length > 0) {
      record.inScopeLocations = source.inScopeLocations.slice();
    }
    if (asArray(source.inScopeSystems).length > 0) {
      record.inScopeSystems = source.inScopeSystems.slice();
    }
    if (asArray(source.criteriaCategories).length > 0) {
      record.criteriaCategories = source.criteriaCategories.slice();
    }
    return record;
  }

  /**
   * Completes the wizard: creates the engagement through the Repository
   * (appending it to its program when one is chosen) under one correlation
   * id, and describes the completion panel. Simulated persistence.
   */
  function completeWizard(repository, values) {
    var record = buildEngagementRecord(values);
    var auditService = AuditOS.auditService;
    var correlationId = auditService ? auditService.newCorrelationId() : null;

    var created = repository.engagements.create(record, {
      action: 'engagement-created',
      reason: 'Engagement Creation Wizard',
      workspaceId: 'engagement-wizard',
      companyId: record.companyId,
      programId: record.programId,
      correlationId: correlationId
    });
    if (!created) {
      return { ok: false, message: 'The engagement could not be created. An engagement code may already exist.' };
    }

    if (record.programId) {
      var program = repository.programs.get(record.programId);
      if (program) {
        repository.programs.update(record.programId, {
          engagementIds: asArray(program.engagementIds).concat([created.id])
        }, {
          action: 'program-engagement-added',
          reason: 'Engagement Creation Wizard',
          workspaceId: 'engagement-wizard',
          companyId: record.companyId,
          engagementId: created.id,
          correlationId: correlationId
        });
      }
    }

    var client = repository.clients.get(record.companyId);
    var href = client
      ? '#/' + repository.clientSlug(client) + '/' + repository.engagementSlug(created)
      : '#/engagements';
    return {
      ok: true,
      title: created.name + ' created (simulated)',
      description: 'The engagement now exists in the runtime state. Simulated persistence: nothing is written to disk, and Reset restores the demo baseline.',
      actions: [{ label: 'Open engagement', href: href }],
      recordId: created.id
    };
  }

  /** Creates an element with a class and optional text content. */
  var el = WS.el;

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /** Renders the Engagement Creation Wizard when it is the active workspace. */
  function renderActiveWizard() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var repository = AuditOS.repository;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.wizard) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.ENGAGEMENT_WIZARD) {
      return;
    }
    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.ENGAGEMENT_WIZARD + '"]');
    if (!view) {
      return;
    }

    AuditOS.workspaceFramework.configure(view, {
      shell: 'single',
      header: {
        eyebrow: 'Platform',
        meta: 'Multi-step engagement scoping — the future entry point for AI-assisted scoping.'
      }
    });

    var P = WS.presentation();
    if (!repository || !repository.isReady()) {
      fillSlot(view, SLOTS.CONTENT, [P.loadingState({ variant: 'form', label: 'Loading wizard' })]);
      return;
    }

    var permissions = AuditOS.permissions;
    var denial = permissions ? permissions.explainDenial(CREATE_CAPABILITY) : null;
    if (denial) {
      var wrap = el('div', 'aos-engagement-wizard__denied');
      wrap.appendChild(WS.buildPermissionNotice(denial, ''));
      wrap.appendChild(P.emptyState({
        icon: '◇',
        title: 'Engagement creation is reserved for engagement leadership',
        description: 'Ask an engagement lead or administrator to scope the engagement, or route the request through Global Approvals.'
      }));
      fillSlot(view, SLOTS.CONTENT, [wrap]);
      return;
    }

    // Route context (Issue #34): arriving from a client's hierarchy pre-
    // selects that client — resolved context, never a guess.
    var routeContext = router.getCurrentContext ? router.getCurrentContext() : null;
    var initialValues = {};
    if (routeContext && routeContext.client) {
      initialValues.companyId = routeContext.client.id;
    }

    var mount = el('div', 'aos-engagement-wizard');
    AuditOS.wizard.create(mount, {
      prefix: 'aos-wizard',
      steps: buildSteps(
        repository.listAccessibleClients(),
        repository.programs.list(),
        repository.engagements.list()
      ),
      initialValues: initialValues,
      completeLabel: 'Create engagement',
      onComplete: function (values) {
        return completeWizard(repository, values);
      }
    });
    fillSlot(view, SLOTS.CONTENT, [mount]);

    var ai = P.emptyState({
      icon: '✦', title: 'Reserved for AI-assisted scoping',
      description: 'Release 2 drafts the scope from the client\'s context and prior engagements. AI remains advisory; human approval remains mandatory.'
    });
    ai.classList.add('aos-tint-brand');
    fillSlot(view, SLOTS.AI, [ai]);
  }

  AuditOS.engagementWizardWorkspace = {
    SLOTS: SLOTS,
    buildSteps: buildSteps,
    deriveEngagementTypes: deriveEngagementTypes,
    buildEngagementRecord: buildEngagementRecord,
    completeWizard: completeWizard,

    /** Binds the wizard to the router and the platform foundations. */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }
      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveWizard);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveWizard);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveWizard);
      }
      if (AuditOS.permissions && typeof AuditOS.permissions.subscribe === 'function') {
        AuditOS.permissions.subscribe(renderActiveWizard);
      }
      renderActiveWizard();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.engagementWizardWorkspace.init);
    } else {
      AuditOS.engagementWizardWorkspace.init();
    }
  }
})(window);
