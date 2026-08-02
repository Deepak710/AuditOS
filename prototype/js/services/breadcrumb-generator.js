/**
 * AuditOS Breadcrumb Generator
 * Navigation & Context Architecture — GitHub Issue #39 /
 * Breadcrumb UX Finalization — GitHub Issue #40 §1
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
 * Crumb rules (Issue #40 §1). Every dropdown is a PEER switcher: a crumb's
 * menu lists the other objects at its own level of the hierarchy, so a menu
 * can never expose an unrelated object:
 *   • AuditOS crumb — never a dropdown; it always returns Home.
 *   • Client crumb — dropdown of clients ONLY.
 *   • Engagement crumb — dropdown of the engagements under ONLY the
 *     selected client.
 *   • Workspace crumb — dropdown of ONLY that engagement's workspaces.
 *   • Record crumbs — the optional record level, and the Walkthrough route's
 *     Team and POC crumbs — never have a dropdown.
 *
 * The hierarchy levels therefore keep their switcher wherever they appear,
 * including when they are the last crumb in the trail: standing on a workspace
 * is exactly when its sibling workspaces are most useful. Only the record
 * level, which has no peer list to offer, is always plain. `RECORD_CRUMB_IDS`
 * names those levels once and `generate` enforces it structurally, so a future
 * deeper record level inherits the rule by being added to that list.
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

  /**
   * The crumb levels that name a record rather than a hierarchy level. These
   * never carry a dropdown (Issue #40 §1 — "final record crumb, never a
   * dropdown"): a record has no peer list the breadcrumb could offer without
   * exposing objects from outside the trail.
   */
  var RECORD_CRUMB_IDS = ['team', 'poc', 'record'];

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

  /**
   * The AuditOS root crumb — never a dropdown (Issue #40 §1). Clicking it
   * always returns Home; the client switcher lives on the client crumb,
   * one level down, where its options are that level's peers.
   */
  function rootCrumb(context) {
    var nav = navigation();
    return crumb('auditos', 'AuditOS', nav ? nav.hrefHome() : '#/home', null,
      Boolean(context && context.scope === 'platform' && context.workspaceId === registry().IDS.DASHBOARD));
  }

  /** The client crumb — its dropdown lists ONLY clients (its own peers). */
  function clientCrumb(context) {
    var nav = navigation();
    var builder = hierarchy();
    var client = context.client;
    var clients = builder ? builder.listClients() : [];
    var menu = clients.length > 0 ? {
      label: 'Clients',
      options: clients.map(function (candidate) {
        return option(candidate.label, candidate.href, candidate.id === client.id);
      })
    } : null;
    return crumb('client', client.name || client.id, nav.hrefClient(client.id), menu,
      context.scope === 'client');
  }

  /**
   * The engagement crumb — its dropdown lists ONLY the engagements under the
   * selected client (its own peers), never an engagement of another client.
   */
  function engagementCrumb(context) {
    var nav = navigation();
    var builder = hierarchy();
    var reg = registry();
    var engagement = context.engagement;
    var engagements = builder ? builder.listClientEngagements(context.client.id) : [];
    var menu = engagements.length > 0 ? {
      label: 'Engagements',
      options: engagements.map(function (candidate) {
        return option(candidate.label, candidate.href, candidate.id === engagement.id);
      })
    } : null;
    return crumb('engagement', engagement.name || engagement.id,
      nav.hrefEngagement(context.client.id, engagement.id), menu,
      context.workspaceId === reg.IDS.ENGAGEMENT);
  }

  /**
   * The workspace crumb — its dropdown lists ONLY that engagement's
   * workspaces (its own peers). A platform-scoped workspace has no
   * engagement to draw peers from, so it renders as a plain crumb.
   */
  function workspaceCrumb(context) {
    var nav = navigation();
    var builder = hierarchy();
    var workspace = context.workspace;
    if (!context.engagement) {
      return crumb('workspace', workspace.label, nav.hrefPlatform(workspace.id), null, true);
    }
    var workspaces = builder ? builder.listEngagementWorkspaces(context.client.id, context.engagement.id) : [];
    var menu = workspaces.length > 0 ? {
      label: 'Workspaces',
      options: workspaces.map(function (candidate) {
        return option(candidate.label, candidate.href, candidate.id === context.workspaceId);
      })
    } : null;
    return crumb('workspace', workspace.label,
      nav.hrefWorkspace(context.client.id, context.engagement.id, workspace.id), menu,
      !context.teamId);
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
     *
     * Record crumbs never carry a dropdown (Issue #40 §1). Stripping them
     * here — once, structurally — keeps the rule true at every depth without
     * each crumb builder having to know its own position in the trail.
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
      crumbs.forEach(function (crumb) {
        if (RECORD_CRUMB_IDS.indexOf(crumb.id) !== -1) {
          crumb.menu = null;
        }
      });
      return crumbs;
    }
  };
})(window);
