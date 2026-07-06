/**
 * AuditOS Global Header Content
 * Application Shell — Chapter 114 / Navigation Components — Chapter 76 /
 * Application Shell optimization (GitHub Issue #16)
 *
 * Renders the global header's trailing regions: the theme toggle, the
 * notification indicator, and the signed-in user control. Presentation only —
 * every business value derives from the Shared Audit State (never from
 * demo-data files, never hardcoded), the notification indicator is navigation
 * to AuditOS Home's signals, and the theme preference is memory-only
 * presentation state stamped on the root element (`data-aos-theme`), which
 * the Design Token Foundation resolves to the light or dark token set.
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
  var ENGAGEMENT_STATUS = { IN_PROGRESS: 'In Progress' };
  var REVIEW_STATUS = { PENDING_REVIEW: 'Pending Review', REJECTED: 'Rejected' };
  var REQUEST_STATUS = { SUBMITTED: 'Submitted' };

  // Established during init().
  var actionsRegion = null;
  var profileRegion = null;
  var themeButton = null;
  var themeIcon = null;

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
   * The current engagement: the first in-progress engagement in record order,
   * falling back to the first engagement, or null when none exist (the same
   * rule the Home workspace applies).
   */
  function currentEngagement(state) {
    var engagements = state.listRecords('engagements');
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

  // ------------------------------------------------------------------
  // State-bound controls
  // ------------------------------------------------------------------

  /**
   * Builds the notification indicator: navigation to AuditOS Home, where the
   * Signals section lists every operational event. The badge carries the
   * live attention count from the Shared Audit State.
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

  /** Builds the signed-in user control from the engagement's records. */
  function buildUserChip(engagement) {
    var chip = el('div', 'aos-global-header__user');
    chip.setAttribute('aria-label',
      'Signed in as ' + engagement.engagementLead + ' — Engagement Lead, ' + engagement.auditor);

    var avatar = el('span', 'aos-global-header__avatar');
    var icon = el('i', 'bi bi-person');
    icon.setAttribute('aria-hidden', 'true');
    avatar.appendChild(icon);
    chip.appendChild(avatar);

    var text = el('span', 'aos-global-header__user-text');
    text.appendChild(el('span', 'aos-global-header__user-name', engagement.engagementLead));
    text.appendChild(el('span', 'aos-global-header__user-role', 'Engagement Lead · ' + engagement.auditor));
    chip.appendChild(text);
    return chip;
  }

  /**
   * Renders the header regions. The theme toggle is always available; the
   * notification indicator and user control appear once the Shared Audit
   * State is ready, and simply stay absent when demo data is unavailable —
   * the header never fabricates values.
   */
  function render() {
    var state = AuditOS.state;
    var actionChildren = [buildThemeToggle()];
    var profileChildren = [];

    if (state && typeof state.isReady === 'function' && state.isReady()) {
      var engagement = currentEngagement(state);
      if (engagement) {
        actionChildren.push(buildNotifications(deriveAttentionCount(state, engagement)));
        profileChildren.push(buildUserChip(engagement));
      }
    }

    actionsRegion.replaceChildren.apply(actionsRegion, actionChildren);
    profileRegion.replaceChildren.apply(profileRegion, profileChildren);
  }

  AuditOS.globalHeader = {
    /**
     * Renders the header content and binds it to the Shared Audit State.
     * Safe to call once, after the DOM is ready. Does nothing when the
     * header regions are absent, so the shell degrades rather than throwing.
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
