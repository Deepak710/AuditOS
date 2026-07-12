/**
 * AuditOS Permission Foundation
 * Platform Information Architecture — GitHub Issue #33 (§5 Permission-aware
 * Actions / §4 AI Usage visibility) / Platform Foundation II — GitHub Issue
 * #34 (Session Panel / Role Switching)
 *
 * The single, platform-wide description of what the current session may do.
 * Release 1 has no authentication, no identity provider, and no backend, so
 * this module is an honestly-scoped capability descriptor — not an
 * authorization engine. It declares the platform's capability vocabulary
 * (which roles may perform which gated actions, and why), manages the active
 * demo session, and answers two pure questions every surface shares:
 *
 *   can(capabilityId[, session])           → boolean
 *   explainDenial(capabilityId[, session]) → null when allowed, otherwise
 *     { capabilityId, label, requiredRoles, reason } for the standard
 *     hidden-action explanation (required role, appropriate contact, reason).
 *
 * The interaction pattern this feeds (Issue #33 §5): unavailable actions are
 * never rendered as disabled controls — they are hidden, and the action area
 * explains itself on hover/focus. The DOM half of that pattern lives in the
 * Workspace Shared Platform (`AuditOS.workspaceShared.buildPermissionNotice`),
 * which consumes this module's explanation as plain data, so the js →
 * components dependency direction stays one-way.
 *
 * Role switching (Issue #34 — Session Panel) exists only in Demo Mode: the
 * session may switch between the declared session presets so every
 * permission gate can be demonstrated from the UI. `DEMO_MODE` is the single
 * production off-switch — a production build sets it false and the switching
 * API refuses. Session changes publish through this module's own
 * subscribe/publish API (no DOM dependency), and surfaces that gate on
 * capabilities re-render on it.
 *
 * Contacts are never declared here: a surface that names an "appropriate
 * contact" resolves it from real records in the Shared Audit State (e.g. the
 * users who actually hold the required role) — never a fabricated name.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /**
   * Role vocabulary. `ADMINISTRATOR` is platform administration (Issue #33
   * §4); the remaining roles mirror the role names the demo dataset's user
   * records actually carry (read, never invented).
   */
  var ROLES = {
    ADMINISTRATOR: 'Administrator',
    ENGAGEMENT_LEAD: 'Engagement Lead',
    REVIEWER_1: 'Reviewer 1',
    REVIEWER_2: 'Reviewer 2',
    PREPARER: 'Preparer'
  };

  /**
   * The platform capability catalog. Each capability names the roles that
   * hold it and the reason access is scoped — the two facts (plus a
   * state-resolved contact) the standard hidden-action explanation renders.
   */
  var CAPABILITIES = {
    'ai-usage.view': {
      id: 'ai-usage.view',
      label: 'AI Usage',
      requiredRoles: [ROLES.ADMINISTRATOR],
      reason: 'AI operational telemetry and spend accounting are platform administration data, visible to administrators only.'
    },
    'approvals.decide': {
      id: 'approvals.decide',
      label: 'Approval decisions',
      requiredRoles: [ROLES.REVIEWER_1, ROLES.REVIEWER_2],
      reason: 'Recording an approval decision is reserved for engagement reviewers; other roles review the queue read-only and route work through approval requests.'
    },
    'clients.create': {
      id: 'clients.create',
      label: 'Add client',
      requiredRoles: [ROLES.ADMINISTRATOR],
      reason: 'Onboarding a client establishes platform-wide records and access, reserved for platform administrators.'
    },
    'engagements.create': {
      id: 'engagements.create',
      label: 'Create engagement',
      requiredRoles: [ROLES.ADMINISTRATOR, ROLES.ENGAGEMENT_LEAD],
      reason: 'Scoping a new engagement commits delivery capacity and is reserved for engagement leadership.'
    },
    'audit-log.view': {
      id: 'audit-log.view',
      label: 'Audit log',
      requiredRoles: [ROLES.ADMINISTRATOR],
      reason: 'The platform audit trail spans every client and session and is platform administration data, visible to administrators only.'
    },
    'suggestions.decide': {
      id: 'suggestions.decide',
      label: 'Suggestion decisions',
      requiredRoles: [ROLES.REVIEWER_1, ROLES.REVIEWER_2],
      reason: 'Approving, rejecting, modifying, or applying an AI suggestion changes engagement working state and is reserved for engagement reviewers; other roles review, comment, and recommend instead.'
    }
  };

  /**
   * Whether this build is the demo. Role switching (Issue #34) exists only
   * while this is true; the production architecture disables switching by
   * setting it false — the API below refuses without it.
   */
  var DEMO_MODE = true;

  /** Session-change event name (Coding Standards §30.13 — completed fact). */
  var SESSION_CHANGED_EVENT = 'auditos:session-changed';

  /**
   * The demo session presets a Demo Mode session may switch between. The
   * default preset is the Release 1 demo persona: the engagement lead who
   * also administers the platform, so platform-level surfaces are reachable
   * while reviewer-only decisions stay genuinely gated — both sides of the
   * §5 pattern render honestly. The remaining presets mirror the reviewer
   * and preparer roles the demo dataset's user records actually carry.
   */
  var SESSION_PRESETS = [
    {
      id: 'engagement-lead',
      label: 'Engagement Lead · Platform Administrator',
      roles: [ROLES.ADMINISTRATOR, ROLES.ENGAGEMENT_LEAD]
    },
    { id: 'reviewer-1', label: 'Reviewer 1', roles: [ROLES.REVIEWER_1] },
    { id: 'reviewer-2', label: 'Reviewer 2', roles: [ROLES.REVIEWER_2] },
    { id: 'preparer',   label: 'Preparer',   roles: [ROLES.PREPARER] }
  ];

  /** ISO timestamp the page session started; part of the session information. */
  var sessionStartedAt = new Date().toISOString();

  /** The active session: the default preset until Demo Mode switches it. */
  var activeSession = buildSession(SESSION_PRESETS[0]);

  /** Session-change subscribers. */
  var listeners = [];

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** Builds the session object for a preset. */
  function buildSession(preset) {
    return {
      presetId: preset.id,
      label: preset.label,
      roles: preset.roles.slice()
    };
  }

  /** The session in effect: the caller's own, else the active demo session. */
  function resolveSession(session) {
    return session && Array.isArray(session.roles) ? session : activeSession;
  }

  /** Notifies session-change subscribers; failures are isolated per subscriber. */
  function publishSessionChanged() {
    listeners.slice().forEach(function (handler) {
      try {
        handler(AuditOS.permissions.getSessionInfo());
      } catch (error) {
        global.console.error('AuditOS session subscriber failed', error);
      }
    });
  }

  /**
   * Whether the session holds a capability: true when any session role is one
   * of the capability's required roles. An unknown capability id is never
   * granted — a surface can only gate on capabilities the platform declares.
   */
  function can(capabilityId, session) {
    var capability = CAPABILITIES[capabilityId];
    if (!capability) {
      return false;
    }
    var roles = resolveSession(session).roles;
    return capability.requiredRoles.some(function (required) {
      return roles.indexOf(required) !== -1;
    });
  }

  /**
   * The standard explanation for a hidden action (Issue #33 §5): null when
   * the session holds the capability, otherwise the capability's label,
   * required roles, and reason as plain data for the shared notice builder.
   */
  function explainDenial(capabilityId, session) {
    if (can(capabilityId, session)) {
      return null;
    }
    var capability = CAPABILITIES[capabilityId];
    if (!capability) {
      return {
        capabilityId: capabilityId,
        label: 'Unknown capability',
        requiredRoles: [],
        reason: 'This capability is not declared by the platform.'
      };
    }
    return {
      capabilityId: capability.id,
      label: capability.label,
      requiredRoles: asArray(capability.requiredRoles).slice(),
      reason: capability.reason
    };
  }

  AuditOS.permissions = {
    ROLES: ROLES,
    CAPABILITIES: CAPABILITIES,
    SESSION_PRESETS: SESSION_PRESETS,
    SESSION_CHANGED_EVENT: SESSION_CHANGED_EVENT,
    DEMO_MODE: DEMO_MODE,

    /** The session currently in effect. */
    getSession: function () {
      return activeSession;
    },

    /**
     * The complete session information the Session Panel presents (Issue
     * #34): identity, roles, held capabilities, mode, and start time.
     */
    getSessionInfo: function () {
      return {
        mode: DEMO_MODE ? 'demo' : 'production',
        presetId: activeSession.presetId,
        label: activeSession.label,
        roles: activeSession.roles.slice(),
        startedAt: sessionStartedAt,
        roleSwitching: this.isRoleSwitchingAvailable(),
        capabilities: Object.keys(CAPABILITIES).filter(function (capabilityId) {
          return can(capabilityId);
        })
      };
    },

    /** Whether role switching is available — Demo Mode only (Issue #34). */
    isRoleSwitchingAvailable: function () {
      return DEMO_MODE;
    },

    /**
     * Switches the active session to a declared preset. Demo Mode only: the
     * production architecture disables switching by turning DEMO_MODE off,
     * and this refuses. Returns true when the session changed. Every switch
     * notifies subscribers; the caller records the audit event (the
     * Permission Foundation depends on nothing).
     */
    switchSession: function (presetId) {
      if (!DEMO_MODE) {
        return false;
      }
      var preset = null;
      for (var index = 0; index < SESSION_PRESETS.length; index += 1) {
        if (SESSION_PRESETS[index].id === presetId) {
          preset = SESSION_PRESETS[index];
        }
      }
      if (!preset || preset.id === activeSession.presetId) {
        return false;
      }
      activeSession = buildSession(preset);
      publishSessionChanged();
      return true;
    },

    /**
     * Subscribes a handler to session changes. Returns an unsubscribe
     * function. Non-function handlers yield a no-op unsubscriber.
     */
    subscribe: function (handler) {
      if (typeof handler !== 'function') {
        return function () {};
      }
      listeners.push(handler);
      return function () {
        var index = listeners.indexOf(handler);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      };
    },

    can: can,
    explainDenial: explainDenial
  };
})(window);
