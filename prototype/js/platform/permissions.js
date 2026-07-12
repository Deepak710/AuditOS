/**
 * AuditOS Permission Foundation
 * Platform Information Architecture — GitHub Issue #33 (§5 Permission-aware
 * Actions / §4 AI Usage visibility)
 *
 * The single, platform-wide description of what the current session may do.
 * Release 1 has no authentication, no identity provider, and no backend, so
 * this module is an honestly-scoped static capability descriptor — not an
 * authorization engine. It declares the platform's capability vocabulary
 * (which roles may perform which gated actions, and why), carries one static
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
   * §4); the reviewer roles mirror the role names the demo dataset's user
   * records actually carry (read, never invented).
   */
  var ROLES = {
    ADMINISTRATOR: 'Administrator',
    ENGAGEMENT_LEAD: 'Engagement Lead',
    REVIEWER_1: 'Reviewer 1',
    REVIEWER_2: 'Reviewer 2'
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
      reason: 'Recording an approval decision is reserved for engagement reviewers; other roles review the queue read-only.'
    }
  };

  /**
   * The static demo session. Release 1 signs in one demo persona: the
   * engagement lead who also administers the platform, so the platform-level
   * surfaces (AI Usage) are reachable while reviewer-only decisions stay
   * genuinely gated — both sides of the §5 pattern render honestly.
   */
  var DEMO_SESSION = {
    roles: [ROLES.ADMINISTRATOR, ROLES.ENGAGEMENT_LEAD]
  };

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** The session in effect: the caller's own, else the static demo session. */
  function resolveSession(session) {
    return session && Array.isArray(session.roles) ? session : DEMO_SESSION;
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

    /** The session currently in effect (the static demo session). */
    getSession: function () {
      return DEMO_SESSION;
    },

    can: can,
    explainDenial: explainDenial
  };
})(window);
