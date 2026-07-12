/**
 * AuditOS Client Creation Wizard Workspace
 * Platform Foundation II — GitHub Issue #34 (Client Creation Wizard)
 *
 * The real multi-step client onboarding flow replacing the earlier
 * placeholder behaviour: Client Details, Business Information, Services,
 * Technology Stack, Contacts, User Access, Programs, and Review — capturing
 * sufficient client context for future AI context and memory (Release 2).
 *
 * Repository-backed: completing the wizard creates the client (and its
 * optional first program) through the Repository Foundation's simulated
 * write pipeline, which records immutable Platform Audit Service events —
 * nothing touches demo-data files, and reset discards the simulated client.
 * The captured-values → record mapping is a pure, offline-testable function.
 *
 * Capability-gated (Issue #33 §5): sessions without `clients.create` never
 * see the form — the shared Permission Notice explains the gate, and the
 * Approval Workflow (Issue #34) lets them request client creation instead
 * of performing it.
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

  /** The capability that gates client creation (Permission Foundation). */
  var CREATE_CAPABILITY = 'clients.create';

  /** The wizard's declarative steps (Issue #34 — example sections). */
  var STEPS = [
    {
      id: 'client-details', title: 'Client Details',
      description: 'The client identity the platform will carry.',
      fields: [
        { id: 'name', label: 'Client name', type: 'text', required: true, placeholder: 'e.g. the trading name' },
        { id: 'legalName', label: 'Legal name', type: 'text' },
        { id: 'code', label: 'Client code', type: 'text', required: true, help: 'Short, stable identifier — it becomes the client\'s routing slug.' },
        { id: 'industry', label: 'Industry', type: 'text', required: true }
      ]
    },
    {
      id: 'business-information', title: 'Business Information',
      description: 'What the client does — captured for future AI context and memory.',
      fields: [
        { id: 'businessDescription', label: 'Business description', type: 'textarea', required: true },
        { id: 'headquartersCity', label: 'Headquarters city', type: 'text' },
        { id: 'headquartersState', label: 'Headquarters state / region', type: 'text' },
        { id: 'headquartersCountry', label: 'Headquarters country', type: 'text' },
        { id: 'deliveryCenters', label: 'Delivery centers', type: 'list', help: 'One location per line.' }
      ]
    },
    {
      id: 'services', title: 'Services',
      fields: [
        { id: 'services', label: 'Services and platforms offered', type: 'list', help: 'One service per line.' }
      ]
    },
    {
      id: 'technology-stack', title: 'Technology Stack',
      fields: [
        { id: 'technologyStack', label: 'Technology stack', type: 'list', help: 'One technology per line — informs future AI-assisted scoping.' }
      ]
    },
    {
      id: 'contacts', title: 'Contacts',
      fields: [
        { id: 'primaryContactName', label: 'Primary contact name', type: 'text' },
        { id: 'primaryContactTitle', label: 'Primary contact title', type: 'text' },
        { id: 'primaryContactEmail', label: 'Primary contact email', type: 'text' }
      ]
    },
    {
      id: 'user-access', title: 'User Access',
      fields: [
        { id: 'userAccess', label: 'Users to grant access', type: 'list', help: 'One user per line, e.g. "name — role".' }
      ]
    },
    {
      id: 'programs', title: 'Programs',
      fields: [
        { id: 'initialProgramName', label: 'First audit program (optional)', type: 'text', help: 'Creates the client\'s first program alongside the client.' }
      ]
    },
    { id: 'review', title: 'Review', review: true, description: 'Everything captured, read back before anything is created.' }
  ];

  /**
   * Maps the wizard's captured values onto the client record the Repository
   * stores — the same shape the companies collection already carries, plus
   * the Issue #34 context sections. Pure and offline-testable; the record
   * identifier is assigned by the simulated write pipeline.
   */
  function buildClientRecord(values) {
    var source = values || {};
    var headquarters = {};
    if (source.headquartersCity) { headquarters.city = source.headquartersCity; }
    if (source.headquartersState) { headquarters.state = source.headquartersState; }
    if (source.headquartersCountry) { headquarters.country = source.headquartersCountry; }
    var contact = {};
    if (source.primaryContactName) { contact.name = source.primaryContactName; }
    if (source.primaryContactTitle) { contact.title = source.primaryContactTitle; }
    if (source.primaryContactEmail) { contact.email = source.primaryContactEmail; }

    var record = {
      code: (source.code || '').toUpperCase(),
      name: source.name || '',
      legalName: source.legalName || source.name || '',
      status: 'Active',
      industry: source.industry || '',
      businessDescription: source.businessDescription || ''
    };
    if (Object.keys(headquarters).length > 0) { record.headquarters = headquarters; }
    if (Array.isArray(source.deliveryCenters) && source.deliveryCenters.length > 0) {
      record.deliveryCenters = source.deliveryCenters.slice();
    }
    if (Array.isArray(source.services) && source.services.length > 0) {
      record.services = source.services.slice();
    }
    if (Array.isArray(source.technologyStack) && source.technologyStack.length > 0) {
      record.technologyStack = source.technologyStack.slice();
    }
    if (Object.keys(contact).length > 0) { record.contacts = [contact]; }
    if (Array.isArray(source.userAccess) && source.userAccess.length > 0) {
      record.userAccess = source.userAccess.slice();
    }
    return record;
  }

  /**
   * Completes the wizard: creates the client (and the optional first
   * program) through the Repository under one correlation id, and describes
   * the completion panel. Simulated persistence — discarded on reset.
   */
  function completeWizard(repository, values) {
    var record = buildClientRecord(values);
    var auditService = AuditOS.auditService;
    var correlationId = auditService ? auditService.newCorrelationId() : null;

    var created = repository.clients.create(record, {
      action: 'client-created',
      reason: 'Client Creation Wizard',
      workspaceId: 'client-wizard',
      correlationId: correlationId
    });
    if (!created) {
      return { ok: false, message: 'The client could not be created. A client code may already exist.' };
    }

    if (values.initialProgramName) {
      repository.programs.create({
        name: values.initialProgramName,
        companyId: created.id,
        engagementIds: []
      }, {
        action: 'program-created',
        reason: 'Client Creation Wizard — initial program',
        workspaceId: 'client-wizard',
        companyId: created.id,
        correlationId: correlationId
      });
    }

    var slug = repository.clientSlug(created);
    return {
      ok: true,
      title: created.name + ' created (simulated)',
      description: 'The client now exists in the runtime state with the complete captured context. Simulated persistence: nothing is written to disk, and Reset restores the demo baseline.',
      actions: [
        { label: 'Open client', href: '#/' + slug },
        { label: 'Create an engagement', href: '#/new-engagement' }
      ],
      recordId: created.id
    };
  }

  /** Creates an element with a class and optional text content. */
  var el = WS.el;

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /** Renders the gated experience for sessions without the capability. */
  function renderDenied(view, denial, repository) {
    var P = WS.presentation();
    var wrap = el('div', 'aos-client-wizard__denied');
    wrap.appendChild(WS.buildPermissionNotice(denial, ''));
    wrap.appendChild(P.emptyState({
      icon: '◇',
      title: 'Client creation is reserved for platform administrators',
      description: 'You can request client onboarding through the Approval Workflow instead — an administrator completes the request from Global Approvals.'
    }));
    var request = el('button', 'aos-button aos-button--primary', 'Request client creation');
    request.setAttribute('type', 'button');
    request.addEventListener('click', function () {
      repository.approvals.create({
        type: 'Client creation',
        title: 'Client creation requested',
        status: 'Pending',
        entity: null,
        workspaceId: 'client-wizard',
        requestedOn: new Date().toISOString().slice(0, 10),
        reason: 'Requested from the Client Creation Wizard without the clients.create capability.',
        comments: [],
        history: []
      }, {
        action: 'approval-request-created',
        workspaceId: 'client-wizard'
      });
      request.replaceWith(el('p', 'aos-client-wizard__requested',
        'Approval request created — it now routes through Global Approvals.'));
    });
    wrap.appendChild(request);
    fillSlot(view, SLOTS.CONTENT, [wrap]);
  }

  /** Renders the Client Creation Wizard when it is the active workspace. */
  function renderActiveWizard() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var repository = AuditOS.repository;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.wizard) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.CLIENT_WIZARD) {
      return;
    }
    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.CLIENT_WIZARD + '"]');
    if (!view) {
      return;
    }

    AuditOS.workspaceFramework.configure(view, {
      shell: 'single',
      header: {
        eyebrow: 'Platform',
        meta: 'Multi-step client onboarding — captured once, carried as platform and future AI context.'
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
      renderDenied(view, denial, repository);
      return;
    }

    var mount = el('div', 'aos-client-wizard');
    AuditOS.wizard.create(mount, {
      prefix: 'aos-wizard',
      steps: STEPS,
      completeLabel: 'Create client',
      onComplete: function (values) {
        return completeWizard(repository, values);
      }
    });
    fillSlot(view, SLOTS.CONTENT, [mount]);

    var ai = P.emptyState({
      icon: '✦', title: 'Reserved for AI-assisted onboarding',
      description: 'Release 2 pre-fills these sections from engagement letters and public context. AI remains advisory; human approval remains mandatory.'
    });
    ai.classList.add('aos-tint-brand');
    fillSlot(view, SLOTS.AI, [ai]);
  }

  AuditOS.clientWizardWorkspace = {
    SLOTS: SLOTS,
    STEPS: STEPS,
    buildClientRecord: buildClientRecord,
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
      global.document.addEventListener('DOMContentLoaded', AuditOS.clientWizardWorkspace.init);
    } else {
      AuditOS.clientWizardWorkspace.init();
    }
  }
})(window);
