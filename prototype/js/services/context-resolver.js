/**
 * AuditOS Context Resolver
 * Navigation & Context Architecture — GitHub Issue #39
 *
 * The single place route context is derived. Every page renders exclusively
 * from what this resolver returns — no page derives context independently,
 * no "find first engagement", no global fallback, no duplicated context
 * logic anywhere else.
 *
 * `resolve(hash)` turns a route hash into exactly one of:
 *
 *   { pending: true }        — the Shared Audit State is still loading; the
 *                              router re-resolves on readiness.
 *   { redirect: '#/…' }      — a legacy route (flat engagement routes, slug
 *                              hierarchies, removed workspaces) mapped to its
 *                              canonical hierarchical equivalent.
 *   context                  — the resolved context (shape below).
 *   null                     — nothing resolves; the router falls back Home.
 *
 * The resolved context carries everything a page may render from:
 *
 *   {
 *     scope,                  // 'platform' | 'client' | 'engagement'
 *     workspaceId, workspace, // the active registered workspace
 *     client, program, engagement,  // resolved entities or null — never a fallback
 *     frameworks,             // the engagement's frameworks, always an array
 *     audit,                  // { period, auditor, status, engagementCode } or null
 *     permissions,            // the session's permission snapshot
 *     hierarchy,              // canonical trail nodes (HierarchyBuilder)
 *     recordId, teamId, pocId, depth
 *   }
 *
 * Legacy flat engagement routes (e.g. `#/evidence`) redirect into the last
 * engagement the user actually navigated (memory of real routes only —
 * never a guessed engagement); with no such context they redirect Home.
 *
 * Depends on nothing in components/, keeping the js → components boundary
 * one-way. Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  var ROUTE_HASH_PREFIX = '#/';

  /** Legacy paths with fixed canonical targets (Issue #39 — internal redirects). */
  var LEGACY_PATH_ALIASES = {
    'dashboard': 'home',
    'walkthroughs': 'walkthrough',
    // Requirements ceased to exist as a user-facing workspace; Evidence is
    // the operational object.
    'requirements': 'evidence'
  };

  /**
   * The engagement context of the most recent engagement-scoped route the
   * user actually visited — memory of real navigation only, used solely to
   * re-home legacy flat routes. Never derived from data.
   */
  var lastEngagementContext = null;

  /** The context of the current route, stored on every successful resolve. */
  var currentContext = null;

  /** Foundations, resolved at call time so load order stays flexible. */
  function stateStore() { return AuditOS.state || null; }
  function repository() { return AuditOS.repository || null; }
  function registry() { return AuditOS.workspaceRegistry || null; }
  function navigation() { return AuditOS.navigationService || null; }
  function hierarchyBuilder() { return AuditOS.hierarchyBuilder || null; }

  /** Whether the Shared Audit State has loaded. */
  function stateReady() {
    var state = stateStore();
    return Boolean(state && state.isReady());
  }

  /** Splits a route hash into decoded path segments; [] when not a route hash. */
  function parseSegments(hash) {
    if (typeof hash !== 'string' || hash.indexOf(ROUTE_HASH_PREFIX) !== 0) {
      return [];
    }
    return hash.slice(ROUTE_HASH_PREFIX.length).split('/').filter(function (segment) {
      return segment !== '';
    });
  }

  /** Decodes one URL path segment, keeping the raw value on a malformed escape. */
  function decodeSegment(segment) {
    try {
      return decodeURIComponent(segment);
    } catch (error) {
      return segment;
    }
  }

  /**
   * Strips a legacy `?id=` query from a segment, returning `{ value, recordId
   * }`. Parses the query directly rather than through a captured global, so
   * it works in the browser and in the offline test sandbox alike.
   */
  function splitLegacyQuery(segment) {
    var queryIndex = segment.indexOf('?');
    if (queryIndex === -1) {
      return { value: segment, recordId: '' };
    }
    var recordId = '';
    segment.slice(queryIndex + 1).split('&').forEach(function (pair) {
      var eq = pair.indexOf('=');
      var key = eq === -1 ? pair : pair.slice(0, eq);
      if (key === 'id') {
        recordId = decodeURIComponent(eq === -1 ? '' : pair.slice(eq + 1));
      }
    });
    return { value: segment.slice(0, queryIndex), recordId: recordId };
  }

  /** The frameworks attached to an engagement, always as an array. */
  function normalizeFrameworks(engagement) {
    if (!engagement) {
      return [];
    }
    if (Array.isArray(engagement.frameworks) && engagement.frameworks.length > 0) {
      return engagement.frameworks.slice();
    }
    if (typeof engagement.framework === 'string' && engagement.framework) {
      return [engagement.framework];
    }
    return [];
  }

  /** The session's permission snapshot, or a neutral empty snapshot. */
  function resolvePermissions() {
    var permissions = AuditOS.permissions;
    if (permissions && typeof permissions.getSessionInfo === 'function') {
      return permissions.getSessionInfo();
    }
    return { label: '', roles: [], capabilities: [], mode: 'demo', presetId: '' };
  }

  /**
   * The program an engagement belongs to: its declared `programId`, else the
   * program whose `engagementIds` names it. Null when neither records it.
   */
  function resolveProgram(engagement) {
    var repo = repository();
    if (!repo || !engagement || !stateReady()) {
      return null;
    }
    if (engagement.programId) {
      return repo.programs.get(engagement.programId);
    }
    var owning = repo.programs.list().filter(function (program) {
      return Array.isArray(program.engagementIds) &&
        program.engagementIds.indexOf(engagement.id) !== -1;
    });
    return owning.length > 0 ? owning[0] : null;
  }

  /** The audit facts of an engagement — recorded values only, never invented. */
  function resolveAudit(engagement) {
    if (!engagement) {
      return null;
    }
    return {
      engagementCode: engagement.engagementCode || '',
      period: engagement.auditPeriod || null,
      auditor: engagement.auditor || '',
      status: engagement.status || ''
    };
  }

  /** The canonical hierarchy trail nodes for a resolved scope. */
  function buildTrail(client, engagement, workspace) {
    var nav = navigation();
    var trail = [{ level: 'platform', id: 'auditos', label: 'AuditOS', href: nav ? nav.hrefHome() : '#/home' }];
    if (client && nav) {
      trail.push({ level: 'client', id: client.id, label: client.name || client.id, href: nav.hrefClient(client.id) });
      if (engagement) {
        trail.push({
          level: 'engagement', id: engagement.id, label: engagement.name || engagement.id,
          href: nav.hrefEngagement(client.id, engagement.id)
        });
        if (workspace && workspace.id !== registry().IDS.ENGAGEMENT) {
          trail.push({
            level: 'workspace', id: workspace.id, label: workspace.label,
            href: nav.hrefWorkspace(client.id, engagement.id, workspace.id)
          });
        }
      }
    } else if (workspace && workspace.id !== registry().IDS.DASHBOARD) {
      trail.push({ level: 'workspace', id: workspace.id, label: workspace.label, href: nav ? nav.hrefPlatform(workspace.id) : null });
    }
    return trail;
  }

  /** Assembles one resolved context and remembers it as the current one. */
  function buildContext(scope, workspace, client, engagement, extras) {
    var detail = extras || {};
    var context = {
      scope: scope,
      workspaceId: workspace ? workspace.id : null,
      workspace: workspace || null,
      client: client || null,
      program: resolveProgram(engagement),
      engagement: engagement || null,
      frameworks: normalizeFrameworks(engagement),
      audit: resolveAudit(engagement),
      permissions: resolvePermissions(),
      hierarchy: buildTrail(client, engagement, workspace),
      recordId: detail.recordId || '',
      teamId: detail.teamId || '',
      pocId: detail.pocId || '',
      depth: detail.depth || (engagement ? 3 : (client ? 1 : 0)),
      isKnownRoute: detail.isKnownRoute !== false
    };
    return context;
  }

  /** Resolves the canonical `#/client/{id}[/engagement/{id}[/{path}[/{recordId}[/{pocId}]]]]` shape. */
  function resolveClientRoute(segments) {
    var reg = registry();
    var repo = repository();
    var nav = navigation();
    if (segments.length < 2) {
      return { redirect: nav.hrefHome() };
    }
    if (!stateReady()) {
      return { pending: true };
    }

    var clientId = decodeSegment(segments[1]);
    var accessible = repo.listAccessibleClients().filter(function (client) {
      return client.id === clientId;
    });
    var client = accessible.length > 0 ? accessible[0] : null;
    if (!client) {
      return null;
    }
    if (segments.length < 4 || segments[2] !== 'engagement') {
      return buildContext('client', reg.findById(reg.IDS.CLIENT), client, null, { depth: 1 });
    }

    var engagementId = decodeSegment(segments[3]);
    var engagements = repo.listAccessibleEngagements(client.id).filter(function (engagement) {
      return engagement.id === engagementId;
    });
    var engagement = engagements.length > 0 ? engagements[0] : null;
    if (!engagement) {
      // The deepest valid parent wins — malformed URLs always recover.
      return { redirect: nav.hrefClient(client.id) };
    }
    if (segments.length < 5) {
      return buildContext('engagement', reg.findById(reg.IDS.ENGAGEMENT), client, engagement, { depth: 2 });
    }

    var rawPath = decodeSegment(segments[4]);
    var path = LEGACY_PATH_ALIASES[rawPath] || rawPath;
    var workspace = reg.findByPath(path);
    if (!workspace || workspace.scope !== reg.SCOPES.ENGAGEMENT) {
      return { redirect: nav.hrefEngagement(client.id, engagement.id) };
    }
    if (path !== rawPath) {
      return { redirect: nav.hrefWorkspace(client.id, engagement.id, workspace.id) };
    }

    var recordId = segments.length > 5 ? decodeSegment(splitLegacyQuery(segments[5]).value) : '';
    var legacyRecord = segments.length > 5 ? splitLegacyQuery(segments[5]).recordId : '';
    if (!recordId && legacyRecord) {
      recordId = legacyRecord;
    }
    var detail = { recordId: recordId, depth: recordId ? 4 : 3 };
    if (workspace.id === reg.IDS.WALKTHROUGH && recordId) {
      detail.teamId = recordId;
      if (segments.length > 6) {
        detail.pocId = decodeSegment(segments[6]);
        detail.depth = 5;
      }
    }
    return buildContext('engagement', workspace, client, engagement, detail);
  }

  /** Resolves a flat `#/{path}` route: canonical for platform scope, redirected otherwise. */
  function resolveFlatRoute(segments) {
    var reg = registry();
    var nav = navigation();
    var head = splitLegacyQuery(segments[0]);
    var rawPath = decodeSegment(head.value);
    var path = LEGACY_PATH_ALIASES[rawPath] || rawPath;
    var workspace = reg.findByPath(path);
    if (!workspace) {
      return undefined; // Not a flat route — the caller tries legacy slugs.
    }

    var recordId = head.recordId ||
      (segments.length > 1 ? decodeSegment(splitLegacyQuery(segments[1]).value) : '');

    if (workspace.scope === reg.SCOPES.PLATFORM) {
      if (workspace.id === reg.IDS.DASHBOARD) {
        if (rawPath !== 'home') {
          return { redirect: nav.hrefHome() };
        }
        return buildContext('platform', workspace, null, null, { depth: 0 });
      }
      if (path !== rawPath || head.recordId) {
        return { redirect: nav.hrefPlatform(workspace.id, recordId) };
      }
      return buildContext('platform', workspace, null, null, { recordId: recordId, depth: 0 });
    }

    // Client- and engagement-scoped workspaces are never reachable flat: the
    // legacy route redirects into the scope the user last actually visited,
    // else Home. Never a guessed engagement (Issue #39 — no global fallback).
    if (workspace.scope === reg.SCOPES.CLIENT) {
      if (lastEngagementContext && lastEngagementContext.clientId) {
        return { redirect: nav.hrefClient(lastEngagementContext.clientId) };
      }
      var clients = stateReady() ? repository().listAccessibleClients() : [];
      if (clients.length === 1) {
        return { redirect: nav.hrefClient(clients[0].id) };
      }
      if (!stateReady()) {
        return { pending: true };
      }
      return { redirect: nav.hrefHome() };
    }

    if (lastEngagementContext) {
      return {
        redirect: nav.hrefWorkspace(
          lastEngagementContext.clientId, lastEngagementContext.engagementId,
          workspace.id, recordId)
      };
    }
    if (!stateReady()) {
      return { pending: true };
    }
    return { redirect: nav.hrefHome() };
  }

  /**
   * Resolves a legacy slug hierarchy (`#/{clientSlug}[/{engagementSlug}[/…]]`,
   * the pre-#39 contract) to its canonical redirect, or null.
   */
  function resolveLegacySlugRoute(segments) {
    var repo = repository();
    var reg = registry();
    var nav = navigation();
    if (!stateReady()) {
      return { pending: true };
    }
    var client = repo.findClientBySlug(repo.slugify(decodeSegment(segments[0])));
    if (!client) {
      return null;
    }
    if (segments.length < 2) {
      return { redirect: nav.hrefClient(client.id) };
    }
    var engagement = repo.findEngagementBySlug(repo.slugify(decodeSegment(segments[1])), client.id);
    if (!engagement) {
      return { redirect: nav.hrefClient(client.id) };
    }
    if (segments.length < 3) {
      return { redirect: nav.hrefEngagement(client.id, engagement.id) };
    }
    var rawPath = decodeSegment(splitLegacyQuery(segments[2]).value);
    var path = LEGACY_PATH_ALIASES[rawPath] || rawPath;
    var workspace = reg.findByPath(path);
    if (!workspace || workspace.scope !== reg.SCOPES.ENGAGEMENT) {
      return { redirect: nav.hrefEngagement(client.id, engagement.id) };
    }
    var recordId = splitLegacyQuery(segments[2]).recordId ||
      (segments.length > 3 ? decodeSegment(segments[3]) : '');
    var pocId = segments.length > 4 ? decodeSegment(segments[4]) : '';
    return { redirect: nav.hrefWorkspace(client.id, engagement.id, workspace.id, recordId, pocId) };
  }

  AuditOS.contextResolver = {
    /**
     * Resolves a route hash into a context, a `{ redirect }`, a
     * `{ pending: true }`, or null (unknown). See the module contract above.
     */
    resolve: function (hash) {
      var reg = registry();
      var nav = navigation();
      if (!reg || !nav) {
        return null;
      }
      var segments = parseSegments(hash);
      if (segments.length === 0) {
        return { redirect: nav.hrefHome() };
      }
      var head = splitLegacyQuery(segments[0]).value;
      var result;
      if (head === 'client') {
        result = resolveClientRoute(segments);
      } else {
        result = resolveFlatRoute(segments);
        if (result === undefined) {
          result = resolveLegacySlugRoute(segments);
        }
      }
      return result || null;
    },

    /**
     * Records a resolved context as the current one. Called by the router —
     * the single place routes are activated — so `current()` always mirrors
     * the active route.
     */
    setCurrent: function (context) {
      currentContext = context || null;
      if (context && context.client && context.engagement) {
        lastEngagementContext = {
          clientId: context.client.id,
          engagementId: context.engagement.id
        };
      }
    },

    /** The resolved context of the active route, or null before the first route. */
    current: function () {
      return currentContext;
    },

    /** Test seam: clears the memory of previously visited engagement scopes. */
    resetMemory: function () {
      lastEngagementContext = null;
      currentContext = null;
    }
  };
})(window);
