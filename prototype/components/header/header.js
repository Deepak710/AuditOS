/**
 * AuditOS Global Header Content
 * Application Shell — Chapter 114 / Navigation Components — Chapter 76 /
 * Application Shell optimization (GitHub Issue #16) / Platform Foundation II
 * — GitHub Issue #34 (Session Panel / AI Usage in the header)
 *
 * Renders the global header's trailing regions: the theme toggle, the AI
 * Usage indicator, the notification indicator, the Global Approvals
 * indicator, and the signed-in user control with its Session Panel.
 * Presentation only — every business value derives from the Repository
 * Foundation and the Shared Audit State (never from demo-data files, never
 * hardcoded), and the theme preference is memory-only presentation state
 * stamped on the root element (`data-aos-theme`).
 *
 * AI Usage (Issue #34): always visible in the header. Hovering or focusing
 * it shows contextual statistics scoped to the current route (platform,
 * client, or engagement), aggregated live from the telemetry repository.
 * Clicking it opens the AI Telemetry workspace.
 *
 * Session Panel (Issue #34): clicking the signed-in user opens a panel with
 * the user, the active roles, the held permissions, session information,
 * and — in Demo Mode only — role switching between the declared session
 * presets. Every switch records one Platform Audit Service event.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Header regions this content mounts into (index.html). */
  var ACTIONS_REGION_SELECTOR = '.aos-global-header__actions';
  var PROFILE_REGION_SELECTOR = '.aos-global-header__profile';

  /** Root attribute the Design Token Foundation resolves themes from. */
  var THEME_ATTRIBUTE = 'data-aos-theme';
  var THEMES = { LIGHT: 'light', DARK: 'dark' };

  /** Business status vocabulary of the demo-data (read, never invented). */
  var ENGAGEMENT_STATUS = { IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' };
  var REVIEW_STATUS = { PENDING_REVIEW: 'Pending Review', REJECTED: 'Rejected' };
  var REQUEST_STATUS = { SUBMITTED: 'Submitted' };

  /**
   * The review statuses that mean a record is awaiting an audit-team approval
   * decision (Issue #33 §3) — the same vocabulary the Global Approvals
   * workspace groups its inbox by, so the navigation badge and the inbox
   * always count the same records.
   */
  var PENDING_APPROVAL_STATUSES = ['Pending Review', 'Evidence Received - Under HA Review', 'Submitted'];

  // Established during init().
  var actionsRegion = null;
  var profileRegion = null;
  var themeButton = null;
  var themeIcon = null;
  var sessionPanelElement = null;
  var userButtonElement = null;

  /** Creates an element with a class and optional text content. */
  function el(tagName, className, textContent) {
    var node = global.document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (textContent) {
      node.textContent = textContent;
    }
    return node;
  }

  // ------------------------------------------------------------------
  // Theme toggle — presentation state only, no business data involved.
  // ------------------------------------------------------------------

  /** The theme currently in effect: explicit choice, else the system scheme. */
  function effectiveTheme() {
    var explicit = global.document.documentElement.getAttribute(THEME_ATTRIBUTE);
    if (explicit === THEMES.LIGHT || explicit === THEMES.DARK) {
      return explicit;
    }
    var media = typeof global.matchMedia === 'function' &&
      global.matchMedia('(prefers-color-scheme: dark)');
    return media && media.matches ? THEMES.DARK : THEMES.LIGHT;
  }

  /** Reflects the current theme on the toggle: icon and accessible name. */
  function updateThemeButton() {
    var dark = effectiveTheme() === THEMES.DARK;
    themeIcon.className = dark ? 'bi bi-sun' : 'bi bi-moon-stars';
    themeButton.setAttribute('aria-label',
      dark ? 'Switch to light theme' : 'Switch to dark theme');
    themeButton.setAttribute('title',
      dark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  /** Switches to the opposite theme. Memory-only; a reload returns to system. */
  function handleThemeToggle() {
    var next = effectiveTheme() === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    global.document.documentElement.setAttribute(THEME_ATTRIBUTE, next);
    updateThemeButton();
  }

  /** Builds the theme toggle control. */
  function buildThemeToggle() {
    themeButton = el('button', 'aos-global-header__icon-button');
    themeButton.setAttribute('type', 'button');
    themeIcon = el('i', 'bi bi-moon-stars');
    themeIcon.setAttribute('aria-hidden', 'true');
    themeButton.appendChild(themeIcon);
    themeButton.addEventListener('click', handleThemeToggle);
    updateThemeButton();
    return themeButton;
  }

  // ------------------------------------------------------------------
  // Shared Audit State reads — mirrors the Home view-model rules so the
  // header and the workspace always describe the same engagement.
  // ------------------------------------------------------------------

  /**
   * The current engagement: the engagement named by the active route context
   * (Issue #38 Part 2 — the header always describes the engagement in scope,
   * never a global default when a hierarchical route names one). When the
   * route carries no engagement (flat routes, the platform dashboard), it
   * falls back to the first in-progress engagement in record order, then the
   * first engagement, or null when none exist — the same rule the Home
   * workspace applies.
   */
  function currentEngagement(state, routeContext) {
    var engagements = state.listRecords('engagements');
    if (routeContext && routeContext.engagement) {
      for (var routed = 0; routed < engagements.length; routed += 1) {
        if (engagements[routed].id === routeContext.engagement.id) {
          return engagements[routed];
        }
      }
    }
    for (var index = 0; index < engagements.length; index += 1) {
      if (engagements[index].status === ENGAGEMENT_STATUS.IN_PROGRESS) {
        return engagements[index];
      }
    }
    return engagements.length > 0 ? engagements[0] : null;
  }

  /** Reads the first dataset document an engagement owns in a collection. */
  function readEngagementDocument(state, collectionId, engagementId) {
    var datasetIds = state.findDatasetsForEngagement(collectionId, engagementId);
    return datasetIds.length > 0 ? state.getDocument(collectionId, datasetIds[0]) : null;
  }

  /**
   * The signed-in identity: the current engagement's recorded lead, else the
   * recorded audit firm — the same join-or-fallback the Engagement workspace
   * applies. Never an invented name.
   */
  function resolveUserName(engagement) {
    return engagement ? (engagement.engagementLead || engagement.auditor || '') : '';
  }

  /**
   * Operational events currently requesting attention (§16.18): evidence
   * awaiting review, rejected evidence, and submitted evidence requests —
   * the same events AuditOS Home presents as notifications.
   */
  function deriveAttentionCount(state, engagement) {
    var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
    var requestsDocument = readEngagementDocument(state, 'evidence-requests', engagement.id) || {};
    var count = 0;

    (evidenceDocument.evidence || []).forEach(function (item) {
      if (item.reviewStatus === REVIEW_STATUS.PENDING_REVIEW ||
        item.reviewStatus === REVIEW_STATUS.REJECTED) {
        count += 1;
      }
    });
    (requestsDocument.requests || []).forEach(function (request) {
      if (request.status === REQUEST_STATUS.SUBMITTED) {
        count += 1;
      }
    });
    return count;
  }

  /**
   * Pending approvals across the entire platform (Issue #33 §3): evidence and
   * evidence requests awaiting an audit-team decision, summed over every
   * engagement that is not completed. Program-scoped pool datasets are
   * excluded by construction: `findDatasetsForEngagement` resolves only the
   * datasets an engagement itself owns, so pooled records are never counted
   * twice.
   */
  function deriveGlobalPendingApprovals(state) {
    var count = 0;
    state.listRecords('engagements').forEach(function (engagement) {
      if (engagement.status === ENGAGEMENT_STATUS.COMPLETED) {
        return;
      }
      var evidenceDocument = readEngagementDocument(state, 'evidence', engagement.id) || {};
      var requestsDocument = readEngagementDocument(state, 'evidence-requests', engagement.id) || {};
      (evidenceDocument.evidence || []).forEach(function (item) {
        if (PENDING_APPROVAL_STATUSES.indexOf(item.reviewStatus) !== -1) {
          count += 1;
        }
      });
      (requestsDocument.requests || []).forEach(function (request) {
        if (PENDING_APPROVAL_STATUSES.indexOf(request.status) !== -1) {
          count += 1;
        }
      });
    });
    return count;
  }

  // ------------------------------------------------------------------
  // AI Usage indicator (Issue #34) — always visible; statistics scoped to
  // the current route context, aggregated live from the telemetry repository.
  // ------------------------------------------------------------------

  /**
   * Aggregates the telemetry events within the current route scope: the
   * engagement when the route carries one, else the client, else the whole
   * platform. Pure aggregation over repository reads — nothing hardcoded.
   */
  function deriveAiUsageSummary(repository, routeContext) {
    var events = repository.telemetry.list();
    var scopeLabel = 'Platform';
    if (routeContext && routeContext.engagement) {
      var engagementId = routeContext.engagement.id;
      events = events.filter(function (event) { return event.engagementId === engagementId; });
      scopeLabel = routeContext.engagement.name || routeContext.engagement.id;
    } else if (routeContext && routeContext.client) {
      var companyId = routeContext.client.id;
      events = events.filter(function (event) { return event.companyId === companyId; });
      scopeLabel = routeContext.client.name;
    }

    var totals = { calls: events.length, costUsd: 0, tokens: 0, failures: 0 };
    var costByDay = {};
    var dayOrder = [];
    events.forEach(function (event) {
      totals.costUsd += event.costUsd || 0;
      var tokens = event.tokens || {};
      totals.tokens += (tokens.input || 0) + (tokens.output || 0);
      if (event.failed) {
        totals.failures += 1;
      }
      var day = event.date || String(event.timestamp || '').slice(0, 10);
      if (day) {
        if (!Object.prototype.hasOwnProperty.call(costByDay, day)) {
          costByDay[day] = 0;
          dayOrder.push(day);
        }
        costByDay[day] += event.costUsd || 0;
      }
    });

    // The last seven recorded days' cost, chronological — the graphical
    // trend the hover tooltip renders as a sparkline (Issue #36 §14).
    var dailyTrend = dayOrder.sort().slice(-7).map(function (day) {
      return { day: day, costUsd: Math.round(costByDay[day] * 100) / 100 };
    });

    return {
      scopeLabel: scopeLabel,
      calls: totals.calls,
      costUsd: Math.round(totals.costUsd * 100) / 100,
      tokens: totals.tokens,
      failures: totals.failures,
      dailyTrend: dailyTrend
    };
  }

  /**
   * Builds the AI Usage indicator: an always-visible header control whose
   * hover/focus tooltip carries the scoped statistics and whose click opens
   * the AI Telemetry workspace.
   */
  function buildAiUsageIndicator(summary) {
    var link = el('a', 'aos-global-header__icon-button aos-global-header__ai-usage');
    link.setAttribute('href', '#/ai-usage');
    link.setAttribute('aria-label', 'AI usage — open AI telemetry');
    link.setAttribute('aria-describedby', 'aos-ai-usage-tooltip');

    var icon = el('i', 'bi bi-stars');
    icon.setAttribute('aria-hidden', 'true');
    link.appendChild(icon);

    var tooltip = el('span', 'aos-global-header__tooltip');
    tooltip.id = 'aos-ai-usage-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    if (summary) {
      [
        { term: 'Scope', detail: summary.scopeLabel },
        { term: 'AI calls', detail: String(summary.calls) },
        { term: 'Tokens', detail: summary.tokens.toLocaleString('en-US') },
        { term: 'Cost', detail: '$' + summary.costUsd.toFixed(2) },
        { term: 'Failures', detail: String(summary.failures) }
      ].forEach(function (row) {
        var line = el('span', 'aos-global-header__tooltip-row');
        line.appendChild(el('span', 'aos-global-header__tooltip-term', row.term));
        line.appendChild(el('span', 'aos-global-header__tooltip-detail', row.detail));
        tooltip.appendChild(line);
      });
      // Graphical cost trend (Issue #36 §14 — "header hover becomes
      // graphical"): a small sparkline of the last recorded days' cost,
      // alongside the existing text rows (never in place of them).
      if (summary.dailyTrend && summary.dailyTrend.length > 0) {
        var maxCost = Math.max.apply(null, summary.dailyTrend.map(function (point) { return point.costUsd; }).concat([0.01]));
        var sparkline = el('span', 'aos-global-header__sparkline');
        sparkline.setAttribute('role', 'img');
        sparkline.setAttribute('aria-label', 'Cost trend over the last ' + summary.dailyTrend.length +
          ' recorded ' + (summary.dailyTrend.length === 1 ? 'day' : 'days'));
        summary.dailyTrend.forEach(function (point) {
          var bar = el('span', 'aos-global-header__sparkline-bar');
          bar.style.height = Math.max(10, Math.round((point.costUsd / maxCost) * 100)) + '%';
          bar.setAttribute('title', point.day + ': $' + point.costUsd.toFixed(2));
          sparkline.appendChild(bar);
        });
        tooltip.appendChild(sparkline);
      }
    } else {
      tooltip.appendChild(el('span', 'aos-global-header__tooltip-row',
        'AI telemetry loads with the demo data.'));
    }
    link.appendChild(tooltip);
    return link;
  }

  // ------------------------------------------------------------------
  // State-bound indicators
  // ------------------------------------------------------------------

  /**
   * Builds the Global Approvals indicator (Issue #33 §3): always-visible
   * navigation to the platform-wide approval inbox, carrying the live pending
   * approval count as its badge.
   */
  function buildApprovalsIndicator(count) {
    var link = el('a', 'aos-global-header__icon-button');
    link.setAttribute('href', '#/approvals');
    link.setAttribute('aria-label', count > 0
      ? count + ' pending approvals — open Global Approvals'
      : 'Global Approvals — nothing awaiting a decision');
    link.setAttribute('title', 'Global Approvals');

    var icon = el('i', 'bi bi-check2-circle');
    icon.setAttribute('aria-hidden', 'true');
    link.appendChild(icon);

    if (count > 0) {
      var badge = el('span', 'aos-global-header__badge aos-numeric', String(count));
      badge.setAttribute('aria-hidden', 'true');
      link.appendChild(badge);
    }
    return link;
  }

  /**
   * Builds the notification indicator: navigation to AuditOS Home, where the
   * Signals section lists every operational event.
   */
  function buildNotifications(count) {
    var link = el('a', 'aos-global-header__icon-button');
    link.setAttribute('href', '#/dashboard');
    link.setAttribute('aria-label', count > 0
      ? count + ' notifications — review in AuditOS Home'
      : 'Notifications — none require attention');
    link.setAttribute('title', 'Notifications');

    var icon = el('i', 'bi bi-bell');
    icon.setAttribute('aria-hidden', 'true');
    link.appendChild(icon);

    if (count > 0) {
      var badge = el('span', 'aos-global-header__badge aos-numeric', String(count));
      badge.setAttribute('aria-hidden', 'true');
      link.appendChild(badge);
    }
    return link;
  }

  // ------------------------------------------------------------------
  // Header Activity Drawer (Issue #37 Part 10) — context-sensitive audit
  // activity for sessions holding `audit-log.view` (Platform
  // Administrator): current page → current engagement → current client →
  // platform. Recent entries render inline; the complete lineage —
  // Genesis → ripple effects → current state — opens on demand. Hosted in
  // the shared enterprise drawer, never a modal dialog.
  // ------------------------------------------------------------------

  var AUDIT_VIEW_CAPABILITY = 'audit-log.view';
  var activityDrawerOpen = false;

  /** One audit event as a compact list item — action, reason, actor, and time. */
  function activityEventItem(event) {
    return {
      title: event.action + (event.reason ? ' — ' + event.reason : ''),
      meta: [event.user, formatTimestamp(event.timestamp)].filter(Boolean).join(' · ')
    };
  }

  /** Builds one context scope block: its latest events inline, the complete lineage on demand. */
  function buildActivityScope(P, auditService, label, filter) {
    var events = auditService.list(filter);
    var block = el('section', 'aos-inspector__section');
    block.appendChild(el('h3', 'aos-inspector__section-title', label));
    if (events.length === 0) {
      block.appendChild(P.emptyState({
        icon: '◇', title: 'No recorded activity',
        description: 'Audit events in this scope appear here as work happens.'
      }));
      return block;
    }
    block.appendChild(P.itemList(events.slice(0, 5).map(activityEventItem), { compact: true }));
    if (events.length > 5) {
      var mount = el('div', 'aos-global-header__activity-lineage');
      var button = P.button({ label: 'View complete lineage (' + events.length + ')', variant: 'subtle' });
      button.addEventListener('click', function () {
        // Genesis first — the whole chain from origin through every ripple
        // to the current state, oldest to newest.
        var chain = events.slice().reverse();
        mount.replaceChildren(P.timeline(chain.map(function (event, index) {
          return {
            title: (index === 0 ? 'Genesis — ' : '') + event.action,
            meta: [event.user, formatTimestamp(event.timestamp), event.reason || ''].filter(Boolean).join(' · ')
          };
        })));
        button.hidden = true;
      });
      block.appendChild(button);
      block.appendChild(mount);
    }
    return block;
  }

  /** Opens the global Activity drawer scoped to the current route's context. */
  function openActivityDrawer() {
    var P = AuditOS.presentation;
    var auditService = AuditOS.auditService;
    var router = AuditOS.router;
    if (!P || !P.openDrawer || !auditService) {
      return;
    }
    var routeContext = router && typeof router.getCurrentContext === 'function' ? router.getCurrentContext() : null;
    var workspaceId = router && typeof router.getCurrentWorkspaceId === 'function' ? router.getCurrentWorkspaceId() : '';
    var engagement = routeContext && routeContext.engagement ? routeContext.engagement : null;
    var client = routeContext && routeContext.client ? routeContext.client : null;

    var body = el('div', 'aos-global-header__activity');
    if (workspaceId) {
      body.appendChild(buildActivityScope(P, auditService, 'Current page', { workspaceId: workspaceId }));
    }
    if (engagement) {
      body.appendChild(buildActivityScope(P, auditService,
        'Current engagement — ' + (engagement.name || engagement.id), { engagementId: engagement.id }));
    }
    if (client) {
      body.appendChild(buildActivityScope(P, auditService,
        'Current client — ' + (client.name || client.id), { companyId: client.id }));
    }
    body.appendChild(buildActivityScope(P, auditService, 'Platform', {}));

    activityDrawerOpen = true;
    P.openDrawer({
      eyebrow: 'Audit trail',
      title: 'Activity',
      subtitle: 'Context-sensitive audit activity — current page, engagement, client, then platform.',
      content: body,
      onClose: function () { activityDrawerOpen = false; }
    });
  }

  /** Builds the Activity drawer trigger — present only for sessions holding `audit-log.view` (hidden, never disabled). */
  function buildActivityIndicator() {
    var button = el('button', 'aos-global-header__icon-button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Open audit activity');
    button.setAttribute('title', 'Audit activity');
    var icon = el('i', 'bi bi-clock-history');
    icon.setAttribute('aria-hidden', 'true');
    button.appendChild(icon);
    button.addEventListener('click', openActivityDrawer);
    return button;
  }

  // ------------------------------------------------------------------
  // Session Panel (Issue #34) — user, roles, permissions, session
  // information, and Demo-Mode role switching.
  // ------------------------------------------------------------------

  /** Formats an ISO timestamp as a compact deterministic label. */
  function formatTimestamp(iso) {
    if (typeof iso !== 'string' || iso.indexOf('T') === -1) {
      return iso || '';
    }
    return iso.slice(0, 10) + ' ' + iso.slice(11, 16) + ' UTC';
  }

  /** Builds one labeled row of the session panel. */
  function buildSessionRow(term, detail) {
    var row = el('div', 'aos-session-panel__row');
    row.appendChild(el('dt', 'aos-session-panel__term', term));
    row.appendChild(el('dd', 'aos-session-panel__detail', detail));
    return row;
  }

  /** Closes the session panel, optionally restoring focus to the user control. */
  function closeSessionPanel(restoreFocus) {
    if (!sessionPanelElement || sessionPanelElement.hidden) {
      return;
    }
    sessionPanelElement.hidden = true;
    if (userButtonElement) {
      userButtonElement.setAttribute('aria-expanded', 'false');
      if (restoreFocus) {
        userButtonElement.focus();
      }
    }
  }

  /** Toggles the session panel from the user control. */
  function toggleSessionPanel() {
    if (!sessionPanelElement) {
      return;
    }
    var opening = sessionPanelElement.hidden;
    sessionPanelElement.hidden = !opening;
    userButtonElement.setAttribute('aria-expanded', opening ? 'true' : 'false');
  }

  /**
   * Switches the demo session to a preset and records the switch as an
   * immutable audit event (Issue #34 — every significant action is audited).
   * The subsequent session-change notification re-renders every gated
   * surface.
   */
  function handleRoleSwitch(presetId, previousInfo) {
    var permissions = AuditOS.permissions;
    if (!permissions || !permissions.switchSession(presetId)) {
      return;
    }
    var auditService = AuditOS.auditService;
    if (auditService) {
      auditService.record({
        action: 'session-role-switched',
        previousValue: { presetId: previousInfo.presetId, roles: previousInfo.roles },
        newValue: { presetId: presetId },
        reason: 'Demo Mode role switching from the Session Panel',
        metadata: { surface: 'session-panel' }
      });
    }
  }

  /**
   * Builds the Session Panel (Issue #34): user, role, held permissions,
   * session information, and — Demo Mode only — role switching between the
   * declared presets. All facts come from the Permission Foundation and the
   * Shared Audit State; nothing is invented.
   */
  function buildSessionPanel(userName, sessionInfo) {
    var panel = el('div', 'aos-session-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Session');
    panel.hidden = true;

    var identity = el('div', 'aos-session-panel__identity');
    identity.appendChild(el('span', 'aos-session-panel__name', userName || 'Demo session'));
    identity.appendChild(el('span', 'aos-session-panel__label', sessionInfo.label));
    panel.appendChild(identity);

    var facts = el('dl', 'aos-session-panel__facts');
    facts.appendChild(buildSessionRow('Roles', sessionInfo.roles.join(' · ')));
    facts.appendChild(buildSessionRow('Permissions', sessionInfo.capabilities.length > 0
      ? sessionInfo.capabilities.join(' · ')
      : 'None — actions route through approval requests'));
    facts.appendChild(buildSessionRow('Mode', sessionInfo.mode === 'demo' ? 'Demo Mode' : 'Production'));
    facts.appendChild(buildSessionRow('Session started', formatTimestamp(sessionInfo.startedAt)));
    panel.appendChild(facts);

    // Role switching — Demo Mode only (Issue #34). The production
    // architecture disables it in the Permission Foundation, and this
    // section simply never renders.
    if (sessionInfo.roleSwitching) {
      var switcher = el('div', 'aos-session-panel__switcher');
      switcher.setAttribute('role', 'group');
      switcher.setAttribute('aria-label', 'Switch role (Demo Mode)');
      switcher.appendChild(el('p', 'aos-session-panel__switcher-title', 'Switch role · Demo Mode only'));
      AuditOS.permissions.SESSION_PRESETS.forEach(function (preset) {
        var active = preset.id === sessionInfo.presetId;
        var option = el('button',
          'aos-session-panel__preset' + (active ? ' aos-session-panel__preset--active' : ''),
          preset.label);
        option.setAttribute('type', 'button');
        option.setAttribute('aria-pressed', active ? 'true' : 'false');
        option.addEventListener('click', function () {
          handleRoleSwitch(preset.id, sessionInfo);
        });
        switcher.appendChild(option);
      });
      panel.appendChild(switcher);
    }

    return panel;
  }

  /** Builds the signed-in user control: the chip button plus its Session Panel. */
  function buildUserControl(engagement) {
    var permissions = AuditOS.permissions;
    var sessionInfo = permissions && typeof permissions.getSessionInfo === 'function'
      ? permissions.getSessionInfo()
      : { label: '', roles: [], capabilities: [], mode: 'demo', startedAt: '', roleSwitching: false, presetId: '' };
    var userName = resolveUserName(engagement);

    var wrap = el('div', 'aos-global-header__user-wrap');

    userButtonElement = el('button', 'aos-global-header__user');
    userButtonElement.setAttribute('type', 'button');
    userButtonElement.setAttribute('aria-haspopup', 'dialog');
    userButtonElement.setAttribute('aria-expanded', 'false');
    userButtonElement.setAttribute('aria-label',
      'Signed in as ' + (userName || 'demo session') + ' — ' + sessionInfo.label + '. Open session panel.');

    var avatar = el('span', 'aos-global-header__avatar');
    var icon = el('i', 'bi bi-person');
    icon.setAttribute('aria-hidden', 'true');
    avatar.appendChild(icon);
    userButtonElement.appendChild(avatar);

    var text = el('span', 'aos-global-header__user-text');
    text.appendChild(el('span', 'aos-global-header__user-name', userName));
    text.appendChild(el('span', 'aos-global-header__user-role', sessionInfo.label));
    userButtonElement.appendChild(text);
    userButtonElement.addEventListener('click', toggleSessionPanel);
    userButtonElement.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeSessionPanel(true);
      }
    });
    wrap.appendChild(userButtonElement);

    sessionPanelElement = buildSessionPanel(userName, sessionInfo);
    sessionPanelElement.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSessionPanel(true);
      }
    });
    wrap.appendChild(sessionPanelElement);
    return wrap;
  }

  /** Closes the session panel when the interaction leaves the profile region. */
  function handleDocumentPointerDown(event) {
    if (profileRegion && !profileRegion.contains(event.target)) {
      closeSessionPanel(false);
    }
  }

  /**
   * Renders the header regions. The theme toggle and AI Usage indicator are
   * always present; the state-bound indicators and user control appear once
   * the Shared Audit State is ready, and simply stay absent when demo data
   * is unavailable — the header never fabricates values.
   */
  function render() {
    var state = AuditOS.state;
    var repository = AuditOS.repository;
    var router = AuditOS.router;
    var ready = Boolean(state && typeof state.isReady === 'function' && state.isReady());
    var routeContext = router && typeof router.getCurrentContext === 'function'
      ? router.getCurrentContext() : null;

    var actionChildren = [buildThemeToggle()];

    // AI Usage is always visible in the header (Issue #34); its statistics
    // aggregate live once the telemetry repository is readable.
    actionChildren.push(buildAiUsageIndicator(
      ready && repository ? deriveAiUsageSummary(repository, routeContext) : null));

    var profileChildren = [];
    if (ready) {
      actionChildren.push(buildApprovalsIndicator(deriveGlobalPendingApprovals(state)));
      // The Activity drawer trigger is capability-gated — hidden, never
      // disabled (Issue #37 Part 10 / permission pattern of Issue #33 §5).
      var permissionService = AuditOS.permissions;
      if (permissionService && typeof permissionService.can === 'function' &&
          permissionService.can(AUDIT_VIEW_CAPABILITY)) {
        actionChildren.push(buildActivityIndicator());
      }
      var engagement = currentEngagement(state, routeContext);
      if (engagement) {
        actionChildren.push(buildNotifications(deriveAttentionCount(state, engagement)));
        profileChildren.push(buildUserControl(engagement));
      }
    }

    actionsRegion.replaceChildren.apply(actionsRegion, actionChildren);
    profileRegion.replaceChildren.apply(profileRegion, profileChildren);
  }

  AuditOS.globalHeader = {
    /**
     * Renders the header content and binds it to the Shared Audit State, the
     * router (AI usage scope), and the Permission Foundation (session
     * changes). Safe to call once, after the DOM is ready. Does nothing when
     * the header regions are absent, so the shell degrades rather than
     * throwing.
     */
    init: function () {
      actionsRegion = global.document.querySelector(ACTIONS_REGION_SELECTOR);
      profileRegion = global.document.querySelector(PROFILE_REGION_SELECTOR);
      if (!actionsRegion || !profileRegion) {
        return;
      }

      var state = AuditOS.state;
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, render);
        state.subscribe(state.EVENTS.STATE_CHANGED, render);
        state.subscribe(state.EVENTS.STATE_RESET, render);
      }

      // The AI Usage statistics follow the route scope (Issue #34).
      var router = AuditOS.router;
      if (router) {
        global.document.addEventListener(router.ROUTE_CHANGED_EVENT, render);
        // Navigating closes the Activity drawer (Issue #37 Part 10) — its
        // context scopes belong to the page that opened it.
        global.document.addEventListener(router.ROUTE_CHANGED_EVENT, function () {
          if (activityDrawerOpen && AuditOS.presentation && AuditOS.presentation.closeDrawer) {
            AuditOS.presentation.closeDrawer();
          }
        });
      }

      // The user control and gated indicators follow session switches.
      var permissions = AuditOS.permissions;
      if (permissions && typeof permissions.subscribe === 'function') {
        permissions.subscribe(render);
      }

      global.document.addEventListener('pointerdown', handleDocumentPointerDown);
      render();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.globalHeader.init);
    } else {
      AuditOS.globalHeader.init();
    }
  }
})(window);
