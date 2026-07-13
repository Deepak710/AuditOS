/**
 * AuditOS Breadcrumb Generator
 * Navigation & Context Architecture — GitHub Issue #39
 *
 * The one breadcrumb implementation of the platform. Breadcrumbs always
 * represent hierarchy — never categories — and always derive from the
 * canonical hierarchy (HierarchyBuilder) and the resolved route context
 * (ContextResolver). No page-specific breadcrumb implementations exist.
 *
 *   AuditOS
 *   AuditOS → Meridian
 *   AuditOS → Meridian → Zephyr
 *   AuditOS → Meridian → Zephyr → Evidence
 *
 * Crumb rules (Issue #39):
 *   • AuditOS crumb — dropdown of clients.
 *   • Client crumb — dropdown of engagements belonging ONLY to that client.
 *   • Engagement crumb — dropdown of workspaces for ONLY that engagement.
 *   • Workspace crumb — never a dropdown.
 *
 * This module produces data only — an ordered list of crumb descriptors —
 * and renders nothing; the navigation component renders the descriptors.
 *
 * Depends on nothing in components/, keeping the js → components boundary
 * one-way. Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Foundations, resolved at call time so load order stays flexible. */
  function registry() { return AuditOS.workspaceRegistry || null; }
  function navigation() { return AuditOS.navigationService || null; }
  function hierarchy() { return AuditOS.hierarchyBuilder || null; }
  function repository() { return AuditOS.repository || null; }
  function stateStore() { return AuditOS.state || null; }

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** One crumb descriptor. `menu` is null (plain crumb) or `{ label, options }`. */
  function crumb(id, label, href, menu, current) {
    return {
      id: id,
      label: label,
      href: href,
      menu: menu || null,
      current: Boolean(current)
    };
  }

  /** One menu option descriptor. */
  function option(label, href, active) {
    return { label: label, href: href, active: Boolean(active) };
  }

  /** The AuditOS root crumb — its dropdown lists the accessible clients. */
  function rootCrumb(context) {
    var nav = navigation();
    var builder = hierarchy();
    var activeClientId = context && context.client ? context.client.id : null;
    var clients = builder ? builder.listClients() : [];
    var menu = clients.length > 0 ? {
      label: 'Clients',
      options: clients.map(function (client) {
        return option(client.label, client.href, client.id === activeClientId);
      })
    } : null;
    return crumb('auditos', 'AuditOS', nav ? nav.hrefHome() : '#/home', menu,
      Boolean(context && context.scope === 'platform' && context.workspaceId === registry().IDS.DASHBOARD));
  }

  /** The client crumb — its dropdown lists ONLY that client's engagements. */
  function clientCrumb(context) {
    var nav = navigation();
    var builder = hierarchy();
    var client = context.client;
    var activeEngagementId = context.engagement ? context.engagement.id : null;
    var engagements = builder ? builder.listClientEngagements(client.id) : [];
    var menu = engagements.length > 0 ? {
      label: 'Engagements',
      options: engagements.map(function (engagement) {
        return option(engagement.label, engagement.href, engagement.id === activeEngagementId);
      })
    } : null;
    return crumb('client', client.name || client.id, nav.hrefClient(client.id), menu,
      context.scope === 'client');
  }

  /** The engagement crumb — its dropdown lists ONLY that engagement's workspaces. */
  function engagementCrumb(context) {
    var nav = navigation();
    var builder = hierarchy();
    var reg = registry();
    var engagement = context.engagement;
    var workspaces = builder ? builder.listEngagementWorkspaces(context.client.id, engagement.id) : [];
    var menu = workspaces.length > 0 ? {
      label: 'Workspaces',
      options: workspaces.map(function (workspace) {
        return option(workspace.label, workspace.href, workspace.id === context.workspaceId);
      })
    } : null;
    return crumb('engagement', engagement.name || engagement.id,
      nav.hrefEngagement(context.client.id, engagement.id), menu,
      context.workspaceId === reg.IDS.ENGAGEMENT);
  }

  /** The workspace crumb — never a dropdown. */
  function workspaceCrumb(context) {
    var nav = navigation();
    var workspace = context.workspace;
    var href = context.engagement
      ? nav.hrefWorkspace(context.client.id, context.engagement.id, workspace.id)
      : nav.hrefPlatform(workspace.id);
    return crumb('workspace', workspace.label, href, null, !context.teamId);
  }

  /**
   * The Walkthrough Team and POC crumbs — deeper hierarchy the Walkthrough
   * route carries (Team → POC). Plain crumbs, resolved to recorded names
   * where they join; a raw identifier renders as itself, never fabricated.
   */
  function walkthroughCrumbs(context) {
    var crumbs = [];
    var nav = navigation();
    var repo = repository();
    var state = stateStore();
    if (!context.teamId) {
      return crumbs;
    }
    var team = null;
    if (repo && repo.isReady()) {
      var datasets = repo.walkthroughTeams.datasetsForEngagement(context.engagement.id);
      if (datasets.length > 0) {
        team = repo.walkthroughTeams.list({ datasetId: datasets[0] }).filter(function (candidate) {
          return candidate.id === context.teamId;
        })[0] || null;
      }
    }
    crumbs.push(crumb('team', team ? (team.name || team.id) : context.teamId,
      nav.hrefWorkspace(context.client.id, context.engagement.id, registry().IDS.WALKTHROUGH, context.teamId),
      null, !context.pocId));

    if (context.pocId) {
      var poc = null;
      if (state && state.isReady()) {
        poc = state.listRecords('pocs').filter(function (candidate) {
          return candidate.id === context.pocId;
        })[0] || null;
      }
      crumbs.push(crumb('poc', poc ? (poc.name || poc.id) : context.pocId,
        nav.hrefWorkspace(context.client.id, context.engagement.id, registry().IDS.WALKTHROUGH,
          context.teamId, context.pocId),
        null, true));
    }
    return crumbs;
  }

  AuditOS.breadcrumbGenerator = {
    /**
     * Generates the ordered crumb descriptors for a resolved context. The
     * trail always begins with the AuditOS root and adds only the levels the
     * route actually carries — the trail mirrors the URL.
     */
    generate: function (context) {
      var reg = registry();
      var crumbs = [rootCrumb(context)];
      if (!context || !reg) {
        return crumbs;
      }
      if (context.client) {
        crumbs.push(clientCrumb(context));
        if (context.engagement) {
          crumbs.push(engagementCrumb(context));
          if (context.workspace && context.workspaceId !== reg.IDS.ENGAGEMENT) {
            crumbs.push(workspaceCrumb(context));
            if (context.workspaceId === reg.IDS.WALKTHROUGH) {
              walkthroughCrumbs(context).forEach(function (entry) { crumbs.push(entry); });
            }
          }
        }
      } else if (context.workspace && context.workspaceId !== reg.IDS.DASHBOARD) {
        crumbs.push(workspaceCrumb(context));
      }
      return crumbs;
    }
  };
})(window);
