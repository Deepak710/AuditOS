/**
 * AuditOS Hierarchy Builder
 * Navigation & Context Architecture — GitHub Issue #39
 *
 * The one canonical builder of the permanent platform hierarchy:
 *
 *   AuditOS → Clients → Programs → Engagements → Workspaces
 *
 * Every breadcrumb, dropdown, and navigation surface derives from this
 * hierarchy — nothing re-derives client/engagement/workspace lists locally.
 * All entities are read live through the Repository Foundation, and every
 * destination is a canonical NavigationService route; nothing is fabricated
 * and no URL is concatenated here.
 *
 * Depends on nothing in components/, keeping the js → components boundary
 * one-way. Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Foundations, resolved at call time so load order stays flexible. */
  function repository() { return AuditOS.repository || null; }
  function registry() { return AuditOS.workspaceRegistry || null; }
  function navigation() { return AuditOS.navigationService || null; }
  function permissions() { return AuditOS.permissions || null; }

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /**
   * The engagement-scoped workspaces exposed as an engagement's navigation
   * (Issue #39 — the engagement crumb's dropdown): the operational lifecycle
   * chain. Requirements is intentionally absent — Evidence is the
   * operational object.
   */
  function engagementWorkspaceIds() {
    var reg = registry();
    if (!reg) {
      return [];
    }
    return [
      reg.IDS.WALKTHROUGH,
      reg.IDS.EVIDENCE,
      reg.IDS.CONTROLS,
      reg.IDS.TESTING,
      reg.IDS.FINDINGS,
      reg.IDS.DOCUMENTATION,
      reg.IDS.REPORTING,
      reg.IDS.WORKQUEUE
    ];
  }

  /** Whether the current session may see a workspace (hidden, never disabled). */
  function canSee(workspace) {
    var perms = permissions();
    return !workspace.capability || !perms || perms.can(workspace.capability);
  }

  /**
   * The clients the session may access, each as a hierarchy node
   * `{ id, label, entity, href }`, in record order.
   */
  function listClients() {
    var repo = repository();
    var nav = navigation();
    if (!repo || !nav || !repo.isReady()) {
      return [];
    }
    return repo.listAccessibleClients().map(function (client) {
      return {
        id: client.id,
        label: client.name || client.id,
        entity: client,
        href: nav.hrefClient(client.id)
      };
    });
  }

  /**
   * The programs recorded for one client, each `{ id, label, entity,
   * engagementIds }`, in record order. Programs group engagements; they have
   * no route of their own in the canonical contract.
   */
  function listClientPrograms(clientId) {
    var repo = repository();
    if (!repo || !clientId || !repo.isReady()) {
      return [];
    }
    return repo.programs.list().filter(function (program) {
      return program.companyId === clientId;
    }).map(function (program) {
      return {
        id: program.id,
        label: program.name || program.id,
        entity: program,
        engagementIds: asArray(program.engagementIds)
      };
    });
  }

  /**
   * The engagements belonging to ONLY the named client that the session may
   * access, each `{ id, label, entity, href }`, in record order.
   */
  function listClientEngagements(clientId) {
    var repo = repository();
    var nav = navigation();
    if (!repo || !nav || !clientId || !repo.isReady()) {
      return [];
    }
    return repo.listAccessibleEngagements(clientId).map(function (engagement) {
      return {
        id: engagement.id,
        label: engagement.name || engagement.id,
        entity: engagement,
        href: nav.hrefEngagement(clientId, engagement.id)
      };
    });
  }

  /**
   * The workspaces of ONLY the named engagement, each `{ id, label, href }`:
   * the engagement overview first, then the operational lifecycle chain,
   * capability-filtered (hidden, never disabled).
   */
  function listEngagementWorkspaces(clientId, engagementId) {
    var reg = registry();
    var nav = navigation();
    if (!reg || !nav || !clientId || !engagementId) {
      return [];
    }
    var entries = [{
      id: reg.IDS.ENGAGEMENT,
      label: 'Overview',
      href: nav.hrefEngagement(clientId, engagementId)
    }];
    engagementWorkspaceIds().forEach(function (workspaceId) {
      var workspace = reg.findById(workspaceId);
      if (!workspace || !canSee(workspace)) {
        return;
      }
      entries.push({
        id: workspace.id,
        label: workspace.label,
        href: nav.hrefWorkspace(clientId, engagementId, workspace.id)
      });
    });
    return entries;
  }

  /**
   * The complete canonical hierarchy: the AuditOS root, its clients, each
   * client's programs and engagements. Workspace lists are resolved lazily
   * per engagement via `listEngagementWorkspaces` (they depend on the
   * session, not the data).
   */
  function build() {
    var nav = navigation();
    return {
      id: 'auditos',
      label: 'AuditOS',
      href: nav ? nav.hrefHome() : '#/home',
      clients: listClients().map(function (client) {
        return {
          id: client.id,
          label: client.label,
          entity: client.entity,
          href: client.href,
          programs: listClientPrograms(client.id),
          engagements: listClientEngagements(client.id)
        };
      })
    };
  }

  AuditOS.hierarchyBuilder = {
    build: build,
    listClients: listClients,
    listClientPrograms: listClientPrograms,
    listClientEngagements: listClientEngagements,
    listEngagementWorkspaces: listEngagementWorkspaces,
    engagementWorkspaceIds: engagementWorkspaceIds
  };
})(window);
