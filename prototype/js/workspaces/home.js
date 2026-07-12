/**
 * AuditOS Global Home Workspace
 * Platform Information Architecture — GitHub Issue #33 (§1 Global Home) /
 * Workspaces and Navigation — Chapter 12 (§12.6 Home) / Workspace Design
 * System — Chapter 15 / Component Architecture — Chapter 74
 *
 * The client-centric landing experience of AuditOS and the top of the
 * permanent platform hierarchy: AuditOS → Client → Program → Engagement.
 * Home no longer presents engagement summaries, evidence cards, reports, or
 * activity feeds — it answers exactly one question: which client do I work
 * with now? Its sections are Continue Working, Recent Clients, Pinned
 * Clients, All Clients, Client Groups, and Search; the only action available
 * anywhere on this page is selecting a client, which opens that client's
 * Client Dashboard. Users always start here, and Home never automatically
 * reopens the previous client — resuming is always an explicit choice.
 *
 * Architecture: Business → ViewModel → Components → DOM, unchanged from the
 * original Home. The view model is a declarative, ordered list of section
 * descriptors produced entirely by pure derivation helpers; the renderer
 * dispatches each descriptor to a generic body builder and composes
 * everything from Shared Enterprise Component Library primitives. The search
 * affordance reuses the Shared Workspace Framework's own toolbar
 * configuration (Issue #17) rather than duplicating a search field.
 *
 * Presentation only. Every business value is read through `AuditOS.state` —
 * never from demo-data files, never hardcoded — and the page is architected
 * for N clients while rendering exactly the clients the state holds today;
 * nothing is ever fabricated. Recent Clients is memory-only presentation
 * state derived from real navigation within this session (route changes into
 * the Client Dashboard); it is never persisted and resets on reload. Pinned
 * Clients renders its Empty State until a future issue records pins — no pin
 * is ever invented. AI regions stay reserved advisory surfaces.
 *
 * Structure of this file (Coding Standards §30.8): constants, pure
 * derivation helpers (offline-testable, no DOM, no state access), the view
 * model collector (the single place Home reads AuditOS.state), generic DOM
 * builders (compose library components), the section dispatch table, slot
 * renderers, and the route/state wiring.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  // ------------------------------------------------------------------
  // Constants
  // ------------------------------------------------------------------

  /**
   * The Shared Workspace Framework slots Home populates (framework template:
   * components/workspace-framework/workspace-framework.html).
   */
  var SLOTS = {
    EYEBROW: 'workspace-eyebrow',
    META: 'workspace-meta',
    ACTIONS: 'workspace-actions',
    RIBBON: 'context-ribbon',
    CONTENT: 'primary-content',
    RELATED: 'related-information',
    AI: 'ai-recommendations',
    ACTIVITY: 'activity',
    FOOTER: 'workspace-footer'
  };

  /** Presentation tones shared by badges and markers. */
  var TONES = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
  };

  /** Business status vocabulary of the demo-data (read, never invented). */
  var ENGAGEMENT_STATUS = { IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' };
  var COMPANY_STATUS = { ACTIVE: 'Active' };

  /** Marker glyphs that reinforce tone without ever carrying it alone. */
  var TONE_GLYPHS = { info: '•', success: '✓', warning: '!', error: '!' };

  /** Deterministic month labels so dates never depend on runtime locale. */
  var MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** Maximum entries per list so sections stay scannable with N clients. */
  var LIST_LIMIT = 6;

  /** Maximum clients remembered by the session-only Recent Clients list. */
  var RECENT_LIMIT = 6;

  /** Entrance stagger ceiling — sections beyond this share the last delay. */
  var STAGGER_LIMIT = 3;

  // ------------------------------------------------------------------
  // Pure derivation helpers — no DOM, no AuditOS.state access. Each takes
  // plain records and returns plain view data, so the offline unit suites
  // exercise them directly (derived values remain derived, §30.12).
  // ------------------------------------------------------------------

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** Naive English pluralization for whole-count labels. */
  function plural(count, noun) {
    return count === 1 ? noun : noun + 's';
  }

  /** Formats an ISO `YYYY-MM-DD` date as a compact, deterministic label. */
  function formatDate(isoDate) {
    if (typeof isoDate !== 'string') {
      return '';
    }
    var parts = isoDate.split('-');
    var month = MONTH_LABELS[Number(parts[1]) - 1];
    if (parts.length < 3 || !month) {
      return isoDate;
    }
    return month + ' ' + Number(parts[2]) + ', ' + parts[0];
  }

  /** Resolves a company lifecycle status to a presentation tone. */
  function companyStatusTone(status) {
    return status === COMPANY_STATUS.ACTIVE ? TONES.SUCCESS : TONES.INFO;
  }

  /** The engagements a company owns, split into active / completed / total. */
  function engagementCountsFor(companyId, engagements) {
    var owned = asArray(engagements).filter(function (engagement) {
      return engagement.companyId === companyId;
    });
    var active = owned.filter(function (engagement) {
      return engagement.status === ENGAGEMENT_STATUS.IN_PROGRESS;
    }).length;
    var completed = owned.filter(function (engagement) {
      return engagement.status === ENGAGEMENT_STATUS.COMPLETED;
    }).length;
    return { total: owned.length, active: active, completed: completed };
  }

  /** The distinct frameworks a company's engagements declare, in record order. */
  function frameworksFor(companyId, engagements) {
    var seen = {};
    var frameworks = [];
    asArray(engagements).forEach(function (engagement) {
      if (engagement.companyId !== companyId || !engagement.framework || seen[engagement.framework]) {
        return;
      }
      seen[engagement.framework] = true;
      frameworks.push(engagement.framework);
    });
    return frameworks;
  }

  /**
   * Client entity cards — one card per company record, the entry points of
   * the platform. Every fact derives from the company's own record and its
   * engagements/programs; the card's only affordance is opening that
   * client's Client Dashboard (`workspaceId` + `recordId` resolve to the
   * stable `#/clients?id=` route in the renderer).
   */
  function deriveClientCards(companies, engagements, programs) {
    return asArray(companies).map(function (company) {
      var counts = engagementCountsFor(company.id, engagements);
      var frameworks = frameworksFor(company.id, engagements);
      var ownedPrograms = asArray(programs).filter(function (program) {
        return program.companyId === company.id;
      });
      var headquarters = company.headquarters || {};
      var facts = [
        { term: 'Engagements', detail: counts.active + ' active of ' + counts.total },
        { term: 'Programs', detail: String(ownedPrograms.length) }
      ];
      if (frameworks.length > 0) {
        facts.push({ term: 'Frameworks', detail: frameworks.join(' · ') });
      }
      return {
        id: company.id,
        workspaceId: 'client',
        recordId: company.id,
        title: company.name,
        subtitle: (company.industry || '') +
          (headquarters.city ? ' · ' + headquarters.city + ', ' + headquarters.country : ''),
        badge: company.status ? { text: company.status, tone: companyStatusTone(company.status) } : null,
        facts: facts,
        openLabel: 'Open client dashboard'
      };
    });
  }

  /**
   * Continue Working — the clients with in-progress engagements, resumable
   * with one selection. Resuming is always explicit: Home never reopens the
   * previous client automatically (§1). A portfolio with no active work
   * yields an empty list (and the section's Empty State).
   */
  function deriveContinueWorking(companies, engagements) {
    var resume = [];
    asArray(companies).forEach(function (company) {
      var counts = engagementCountsFor(company.id, engagements);
      if (counts.active === 0) {
        return;
      }
      resume.push({
        workspaceId: 'client',
        recordId: company.id,
        value: String(counts.active),
        title: 'Continue with ' + company.name,
        description: counts.active + ' active ' + plural(counts.active, 'engagement') +
          ' of ' + counts.total + ' total'
      });
    });
    return resume.slice(0, LIST_LIMIT);
  }

  /**
   * Records a client at the head of the session-only Recent Clients list:
   * newest first, deduplicated, capped. Pure — returns a new array — so the
   * memory-only presentation state stays trivially testable.
   */
  function recordRecentClient(recentIds, companyId, limit) {
    var cap = typeof limit === 'number' ? limit : RECENT_LIMIT;
    if (!companyId) {
      return asArray(recentIds).slice(0, cap);
    }
    var next = [companyId];
    asArray(recentIds).forEach(function (id) {
      if (id !== companyId) {
        next.push(id);
      }
    });
    return next.slice(0, cap);
  }

  /**
   * Recent Clients — the session's real navigation history projected onto
   * the client cards, in recency order. An id that no longer joins a company
   * record is dropped, never rendered as a fabricated client.
   */
  function deriveRecentClients(recentIds, clientCards) {
    var byId = {};
    asArray(clientCards).forEach(function (card) {
      byId[card.id] = card;
    });
    return asArray(recentIds)
      .map(function (id) { return byId[id]; })
      .filter(Boolean)
      .slice(0, RECENT_LIMIT);
  }

  /**
   * Client Groups — the portfolio grouped by the one grouping fact the
   * company records actually carry, industry. Groups are derived live and
   * scale to N clients; no group structure is invented.
   */
  function deriveClientGroups(companies) {
    var order = [];
    var groups = {};
    asArray(companies).forEach(function (company) {
      var industry = company.industry || 'Uncategorized';
      if (!groups[industry]) {
        groups[industry] = [];
        order.push(industry);
      }
      groups[industry].push(company.name);
    });
    return order.map(function (industry) {
      var members = groups[industry];
      return {
        title: industry,
        description: members.join(' · '),
        meta: members.length + ' ' + plural(members.length, 'client'),
        tone: TONES.INFO
      };
    });
  }

  /** Portfolio ribbon instruments — live portfolio counts, never stored aggregates. */
  function derivePortfolioRibbon(companies, engagements, programs) {
    var active = asArray(engagements).filter(function (engagement) {
      return engagement.status === ENGAGEMENT_STATUS.IN_PROGRESS;
    }).length;
    var completed = asArray(engagements).filter(function (engagement) {
      return engagement.status === ENGAGEMENT_STATUS.COMPLETED;
    }).length;
    return [
      { label: 'Clients', value: String(asArray(companies).length) },
      { label: 'Programs', value: String(asArray(programs).length) },
      { label: 'Active engagements', value: String(active) },
      { label: 'Completed engagements', value: String(completed) }
    ];
  }

  /** Related-information facts: the portfolio described in one description list. */
  function deriveRelatedFacts(companies, engagements, programs) {
    var frameworks = [];
    var seen = {};
    asArray(engagements).forEach(function (engagement) {
      if (engagement.framework && !seen[engagement.framework]) {
        seen[engagement.framework] = true;
        frameworks.push(engagement.framework);
      }
    });
    var facts = [
      { term: 'Clients', detail: String(asArray(companies).length) },
      { term: 'Programs', detail: String(asArray(programs).length) },
      { term: 'Engagements', detail: String(asArray(engagements).length) }
    ];
    if (frameworks.length > 0) {
      facts.push({ term: 'Frameworks', detail: frameworks.join(' · ') });
    }
    return facts;
  }

  /** Counts the collections, datasets, and records the state currently holds. */
  function deriveDemoDataFootprint(state) {
    var collections = state.listCollections();
    var records = 0;
    collections.forEach(function (collection) {
      var datasetIds = state.getDatasetIds(collection.id);
      if (datasetIds.length === 0) {
        records += state.listRecords(collection.id).length;
        return;
      }
      datasetIds.forEach(function (datasetId) {
        records += state.listRecords(collection.id, datasetId).length;
      });
    });
    return { collections: collections.length, records: records };
  }

  // ------------------------------------------------------------------
  // View model — the single place Home reads AuditOS.state. Returns a
  // declarative description of the page; rendering below never touches the
  // state directly, so the data source can change without frontend changes.
  // ------------------------------------------------------------------

  /**
   * Collects everything Global Home presents from the Shared Audit State as
   * an ordered list of declarative section descriptors plus header, ribbon,
   * panel, and footer data. `recentClientIds` is the session-only recency
   * list maintained by the route wiring (memory-only, never persisted).
   * Returns null while the state is not ready, and a degraded model when no
   * client data is available (§15.12).
   */
  function collectViewModel(state, workspaceRegistry, recentClientIds) {
    if (!state || !state.isReady()) {
      return null;
    }

    var status = state.getStatus();
    var companies = state.listRecords('companies');
    if (companies.length === 0) {
      return { degraded: true, status: status };
    }

    var engagements = state.listRecords('engagements');
    var programs = state.listRecords('programs');
    var companiesDocument = state.getDocument('companies');

    var clientCards = deriveClientCards(companies, engagements, programs);
    var ribbon = derivePortfolioRibbon(companies, engagements, programs);
    var footprint = deriveDemoDataFootprint(state);
    var activeCount = engagements.filter(function (engagement) {
      return engagement.status === ENGAGEMENT_STATUS.IN_PROGRESS;
    }).length;

    return {
      degraded: false,
      status: status,
      companies: companies,

      header: {
        eyebrow: 'Assurance portfolio',
        meta: companies.length + ' ' + plural(companies.length, 'client') + ' · ' +
          programs.length + ' ' + plural(programs.length, 'program') + ' · ' +
          activeCount + ' active ' + plural(activeCount, 'engagement')
      },

      // Release 1 search is the framework's own presentation-only toolbar
      // search (Issue #17) — reused, never re-implemented here.
      toolbar: { search: { placeholder: 'Search clients' } },

      ribbon: ribbon,

      sections: [
        {
          id: 'continue-working',
          kind: 'link-cards',
          kicker: 'Resume',
          title: 'Continue working',
          description: 'Pick up a client with active engagements. Home never reopens a client automatically.',
          items: deriveContinueWorking(companies, engagements),
          empty: {
            icon: '✓',
            title: 'No active client work',
            description: 'Clients with in-progress engagements appear here so one selection resumes the work.'
          }
        },
        {
          id: 'recent-clients',
          kind: 'entity-cards',
          kicker: 'This session',
          title: 'Recent clients',
          items: deriveRecentClients(recentClientIds, clientCards),
          empty: {
            icon: '◇',
            title: 'No recent clients yet',
            description: 'Clients you open this session appear here, newest first. Nothing is stored between sessions.'
          }
        },
        {
          id: 'pinned-clients',
          kind: 'entity-cards',
          kicker: 'Favorites',
          title: 'Pinned clients',
          // No pin is recorded anywhere in Release 1's data, so this section
          // renders its Empty State rather than fabricating a favorite.
          items: [],
          empty: {
            icon: '◇',
            title: 'No pinned clients',
            description: 'Pinning keeps frequent clients at hand. Pins arrive with a future issue; none are recorded today.'
          }
        },
        {
          id: 'all-clients',
          kind: 'entity-cards',
          kicker: 'Portfolio',
          title: 'All clients',
          description: 'Every client in the portfolio. Selecting a client opens its Client Dashboard.',
          items: clientCards,
          empty: {
            icon: '◇',
            title: 'No clients yet',
            description: 'Client profiles appear here once companies exist in the Shared Audit State.'
          }
        },
        {
          id: 'client-groups',
          kind: 'items',
          kicker: 'Segments',
          title: 'Client groups',
          description: 'The portfolio grouped by industry — the grouping the client records themselves carry.',
          items: deriveClientGroups(companies),
          empty: {
            icon: '◇',
            title: 'No client groups',
            description: 'Groups derive from the industries of the clients in the portfolio.'
          }
        }
      ],

      panels: {
        related: deriveRelatedFacts(companies, engagements, programs),
        ai: {
          icon: '✦',
          title: 'Reserved for AI advisory',
          description: 'Advisory recommendations will appear here once the AI foundation is implemented. AI remains advisory; human approval remains mandatory.'
        },
        // Home carries no activity feed by design (Issue #33 §1); the panel
        // explains where operational activity now lives instead.
        activity: {
          icon: '◇',
          title: 'Activity lives with each client',
          description: 'Open a client to see the operational activity of its programs and engagements.'
        }
      },

      footer: [
        { label: 'Environment', value: 'Static prototype' },
        { label: 'Demo status', value: status.demoDataLoaded ? 'Demo data loaded' : 'Demo data degraded' },
        { label: 'Version', value: companiesDocument && companiesDocument.metadata ? companiesDocument.metadata.version : '' },
        { label: 'Clients', value: String(companies.length) },
        { label: 'Loaded', value: footprint.collections + ' collections · ' + footprint.records + ' records' }
      ]
    };
  }

  // ------------------------------------------------------------------
  // Generic DOM builders — compositions of the Shared Enterprise Component
  // Library, reusable for any workspace's descriptors. Text is always
  // assigned through textContent, never markup injection.
  // ------------------------------------------------------------------

  /** Creates an element with a class and optional text content. */
  function el(tagName, className, textContent) {
    var node = global.document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (textContent !== undefined && textContent !== null && textContent !== '') {
      node.textContent = textContent;
    }
    return node;
  }

  /** Builds a Status Badge component. */
  function buildBadge(text, tone) {
    return el('span', 'aos-status-badge' + (tone ? ' aos-status-badge--' + tone : ''), text);
  }

  /**
   * Resolves the stable route hash for a section item that names a workspace
   * and optionally a record (`#/{path}?id={recordId}`, Issue #31's canonical
   * record-navigation format). Returns null when the workspace is unknown,
   * so a card never links to a route the registry cannot resolve.
   */
  function itemHref(item, workspaceRegistry) {
    var workspace = workspaceRegistry && item.workspaceId
      ? workspaceRegistry.findById(item.workspaceId) : null;
    if (!workspace) {
      return null;
    }
    var hash = '#/' + workspace.path;
    return item.recordId ? hash + '?id=' + global.encodeURIComponent(item.recordId) : hash;
  }

  /**
   * Builds an Item List component from `{title, description, meta, tone}`
   * rows.
   */
  function buildItemList(items, compact) {
    var list = el('ul', 'aos-item-list' + (compact ? ' aos-item-list--compact' : ''));
    items.forEach(function (item) {
      var row = el('li', 'aos-item-list__item');
      var marker = el('span', 'aos-item-list__marker' + (item.tone ? ' aos-item-list__marker--' + item.tone : ''),
        TONE_GLYPHS[item.tone] || TONE_GLYPHS.info);
      marker.setAttribute('aria-hidden', 'true');
      row.appendChild(marker);

      var content = el('div', 'aos-item-list__content');
      content.appendChild(el('span', 'aos-item-list__title', item.title));
      if (item.description) {
        content.appendChild(el('span', 'aos-item-list__description', item.description));
      }
      row.appendChild(content);

      if (item.meta) {
        row.appendChild(el('span', 'aos-item-list__meta aos-numeric', item.meta));
      }
      list.appendChild(row);
    });
    return list;
  }

  /** Builds a Metadata List component from `{term, detail}` pairs. */
  function buildMetadataList(pairs, inline) {
    var list = el('dl', 'aos-metadata-list' + (inline ? ' aos-metadata-list--inline' : ''));
    pairs.forEach(function (pair) {
      var item = el('div', 'aos-metadata-list__item');
      item.appendChild(el('dt', 'aos-metadata-list__term', pair.term));
      item.appendChild(el('dd', 'aos-metadata-list__detail', pair.detail));
      list.appendChild(item);
    });
    return list;
  }

  /** Builds an Empty State component from a descriptor. */
  function buildEmptyState(descriptor) {
    var empty = el('div', 'aos-empty-state');
    var glyph = el('span', 'aos-empty-state__icon', descriptor.icon);
    glyph.setAttribute('aria-hidden', 'true');
    empty.appendChild(glyph);
    empty.appendChild(el('p', 'aos-empty-state__title', descriptor.title));
    empty.appendChild(el('p', 'aos-empty-state__description', descriptor.description));
    return empty;
  }

  /** Builds a Loading State component of structural skeletons. */
  function buildLoadingState(label, blocks) {
    var loading = el('div', 'aos-loading-state');
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-busy', 'true');
    loading.appendChild(el('span', 'aos-loading-state__label', label));
    (blocks || ['title', 'text', 'text', 'block']).forEach(function (variant) {
      var skeleton = el('span', 'aos-skeleton aos-skeleton--' + variant);
      skeleton.setAttribute('aria-hidden', 'true');
      loading.appendChild(skeleton);
    });
    return loading;
  }

  // ------------------------------------------------------------------
  // Section body builders — one generic builder per descriptor kind. The
  // renderer dispatches through SECTION_BODIES; no page-specific assembly.
  // ------------------------------------------------------------------

  /**
   * Resume cards: interactive Card components that open a client's Client
   * Dashboard — resume points, not dashboard widgets. The destination line
   * carries the target workspace's registry label (navigation identity).
   */
  function buildLinkCardsBody(section, workspaceRegistry) {
    var grid = el('div', 'aos-home__resume');
    section.items.forEach(function (item) {
      var href = itemHref(item, workspaceRegistry);
      var workspace = workspaceRegistry ? workspaceRegistry.findById(item.workspaceId) : null;
      var card = el(href ? 'a' : 'div', 'aos-card aos-card--interactive aos-home__resume-card');
      if (href) {
        card.setAttribute('href', href);
        card.setAttribute('aria-label', item.title + ' — ' + item.description);
      }
      var body = el('div', 'aos-card__body aos-home__resume-body');
      body.appendChild(el('span', 'aos-home__resume-value aos-numeric', item.value));
      body.appendChild(el('span', 'aos-home__resume-title', item.title));
      body.appendChild(el('span', 'aos-home__resume-description', item.description));
      if (workspace) {
        body.appendChild(el('span', 'aos-home__resume-destination', workspace.label));
      }
      card.appendChild(body);

      var arrow = el('span', 'aos-home__resume-arrow', '→');
      arrow.setAttribute('aria-hidden', 'true');
      card.appendChild(arrow);
      grid.appendChild(card);
    });
    return grid;
  }

  /** Item sections: a padded Surface hosting one Item List. */
  function buildItemsBody(section) {
    var surface = el('div', 'aos-surface aos-surface--padded aos-home__list-surface');
    surface.appendChild(buildItemList(section.items));
    return surface;
  }

  /**
   * Client entity cards: each card is one client and one action — opening
   * that client's Client Dashboard. The whole card is the link (§1: the only
   * action available is selecting a client).
   */
  function buildEntityCardsBody(section, workspaceRegistry) {
    var grid = el('div', 'aos-home__entities');
    section.items.forEach(function (entity) {
      var href = itemHref(entity, workspaceRegistry);
      var card = el(href ? 'a' : 'article', 'aos-card aos-home__entity-card' + (href ? ' aos-card--interactive' : ''));
      if (href) {
        card.setAttribute('href', href);
        card.setAttribute('aria-label', entity.title + ' — ' + entity.openLabel);
      }
      var header = el('header', 'aos-card__header');
      var identity = el('div', 'aos-home__entity-identity');
      identity.appendChild(el('h3', 'aos-card__title', entity.title));
      identity.appendChild(el('span', 'aos-home__entity-subtitle', entity.subtitle));
      header.appendChild(identity);
      if (entity.badge) {
        header.appendChild(buildBadge(entity.badge.text, entity.badge.tone));
      }
      card.appendChild(header);

      var body = el('div', 'aos-card__body aos-home__entity-body');
      if (entity.facts) {
        body.appendChild(buildMetadataList(entity.facts, true));
      }
      if (href && entity.openLabel) {
        var open = el('span', 'aos-home__entity-open');
        open.appendChild(el('span', 'aos-home__entity-open-label', entity.openLabel));
        var arrow = el('span', 'aos-home__entity-open-arrow', '→');
        arrow.setAttribute('aria-hidden', 'true');
        open.appendChild(arrow);
        body.appendChild(open);
      }
      card.appendChild(body);
      grid.appendChild(card);
    });
    return grid;
  }

  /** Descriptor kind → generic body builder. */
  var SECTION_BODIES = {
    'link-cards': buildLinkCardsBody,
    'items': buildItemsBody,
    'entity-cards': buildEntityCardsBody
  };

  /**
   * Builds one Section component from a descriptor: kicker, title, optional
   * description, then the body produced by the descriptor's kind. Sections
   * with no items render their Empty State instead of fabricating data; a
   * section with neither items nor an empty state disappears gracefully
   * (returns null) so no blank region is ever left behind.
   */
  function buildSection(section, workspaceRegistry) {
    if (section.items && section.items.length === 0 && !section.empty) {
      return null;
    }
    // The per-section modifier is layout identity only: home.css places each
    // section on the Home master grid by its descriptor id.
    var element = el('section', 'aos-section aos-home__section aos-home__section--' + section.id);
    element.setAttribute('aria-label', section.title);

    var header = el('header', 'aos-section__header');
    if (section.kicker) {
      header.appendChild(el('p', 'aos-section__eyebrow', section.kicker));
    }
    header.appendChild(el('h2', 'aos-section__title', section.title));
    if (section.description) {
      header.appendChild(el('p', 'aos-section__description', section.description));
    }
    element.appendChild(header);

    var body = el('div', 'aos-section__body');
    if (section.items && section.items.length === 0 && section.empty) {
      var surface = el('div', 'aos-surface aos-home__list-surface');
      surface.appendChild(buildEmptyState(section.empty));
      body.appendChild(surface);
    } else {
      body.appendChild(SECTION_BODIES[section.kind](section, workspaceRegistry));
    }
    element.appendChild(body);
    return element;
  }

  /**
   * Builds a run of labeled value items — one shared builder for the context
   * ribbon (§15.5) and the workspace footer, which share the same structure
   * and differ only in their class prefix.
   */
  function buildLabeledItems(entries, classPrefix) {
    var fragment = global.document.createDocumentFragment();
    entries.forEach(function (entry) {
      var item = el('span', classPrefix + '__item');
      item.appendChild(el('span', classPrefix + '__label', entry.label));
      item.appendChild(el('span', classPrefix + '__value aos-numeric', entry.value));
      fragment.appendChild(item);
    });
    return fragment;
  }

  // ------------------------------------------------------------------
  // Slot rendering
  // ------------------------------------------------------------------

  /** Returns a framework slot inside the active workspace view. */
  function slotElement(view, slotName) {
    return view.querySelector('[data-slot="' + slotName + '"]');
  }

  /** Replaces a slot's content with the given nodes (or clears it). */
  function fillSlot(view, slotName, nodes) {
    var slot = slotElement(view, slotName);
    if (!slot) {
      return;
    }
    slot.replaceChildren.apply(slot, nodes || []);
  }

  /** Renders the ready Global Home experience into the framework slots. */
  function renderReady(view, viewModel, workspaceRegistry) {
    // The search affordance is the framework's own toolbar search (Issue
    // #17) — configured, not re-implemented. Configured first because the
    // framework clears unconfigured regions; Home fills its own slots after.
    if (AuditOS.workspaceFramework && typeof AuditOS.workspaceFramework.configure === 'function') {
      AuditOS.workspaceFramework.configure(view, { toolbar: viewModel.toolbar });
    }

    var eyebrow = slotElement(view, SLOTS.EYEBROW);
    if (eyebrow) {
      eyebrow.textContent = viewModel.header.eyebrow;
    }
    var meta = slotElement(view, SLOTS.META);
    if (meta) {
      meta.textContent = viewModel.header.meta;
    }
    // The only action on Home is selecting a client (§1) — the header action
    // slot stays intentionally empty.
    fillSlot(view, SLOTS.ACTIONS, []);
    fillSlot(view, SLOTS.RIBBON, [buildLabeledItems(viewModel.ribbon, 'aos-home-ribbon')]);

    var home = el('div', 'aos-home');
    // Opts the framework's content region into the flush canvas, so the Home
    // sections sit directly on the workspace surface (layout contract in
    // workspace-framework.css; degrades to the bordered surface gracefully).
    home.setAttribute('data-canvas', 'flush');
    var rendered = 0;
    viewModel.sections.forEach(function (section) {
      var built = buildSection(section, workspaceRegistry);
      if (!built) {
        return;
      }
      built.classList.add('aos-rise-in');
      if (rendered > 0) {
        built.classList.add('aos-rise-in--' + Math.min(rendered, STAGGER_LIMIT));
      }
      rendered += 1;
      home.appendChild(built);
    });
    fillSlot(view, SLOTS.CONTENT, [home]);

    var related = buildMetadataList(viewModel.panels.related);
    related.classList.add('aos-fade-in');
    fillSlot(view, SLOTS.RELATED, [related]);

    var aiPlaceholder = buildEmptyState(viewModel.panels.ai);
    aiPlaceholder.classList.add('aos-tint-brand', 'aos-fade-in');
    fillSlot(view, SLOTS.AI, [aiPlaceholder]);

    // No activity feed on Home by design (Issue #33 §1) — the panel carries
    // guidance to the client level instead.
    var activityGuidance = buildEmptyState(viewModel.panels.activity);
    activityGuidance.classList.add('aos-fade-in');
    fillSlot(view, SLOTS.ACTIVITY, [activityGuidance]);

    fillSlot(view, SLOTS.FOOTER, [buildLabeledItems(viewModel.footer, 'aos-home-footer')]);
  }

  /** Renders the layout-stable loading state (§15.12 — Loading). */
  function renderLoading(view) {
    fillSlot(view, SLOTS.CONTENT, [buildLoadingState('Loading AuditOS Home', ['title', 'text', 'text', 'block', 'block'])]);
    fillSlot(view, SLOTS.RELATED, [buildLoadingState('Loading related information', ['text', 'text'])]);
    fillSlot(view, SLOTS.AI, [buildLoadingState('Loading AI advisory', ['text', 'text'])]);
    fillSlot(view, SLOTS.ACTIVITY, [buildLoadingState('Loading activity', ['text', 'text'])]);
  }

  /** Renders the degraded state (§15.12 — Empty / Error). */
  function renderDegraded(view, viewModel) {
    fillSlot(view, SLOTS.CONTENT, [buildEmptyState({
      icon: '◇',
      title: 'Demo data unavailable',
      description: 'The Shared Audit State could not load its client data' +
        (viewModel.status.degradedReason ? ' (' + viewModel.status.degradedReason + ')' : '') +
        '. Regenerate the demo-data bundle and reload to restore AuditOS Home.'
    })]);
  }

  // ------------------------------------------------------------------
  // Wiring — follows the router and the Shared Audit State.
  // ------------------------------------------------------------------

  /**
   * The session-only Recent Clients list: memory-only presentation state
   * derived from real navigation (route changes into the Client Dashboard).
   * Never persisted, never used to reopen a client automatically (§1).
   */
  var sessionRecentClientIds = [];

  /**
   * Renders Home when it is the active workspace: the ready experience once
   * the state has loaded, the loading skeleton before that, and the degraded
   * explanation when demo data is unavailable.
   */
  function renderActiveHome() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var state = AuditOS.state;
    if (!registry || !router || router.getCurrentWorkspaceId() !== registry.DEFAULT_WORKSPACE_ID) {
      return;
    }

    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.DEFAULT_WORKSPACE_ID + '"]'
    );
    if (!view) {
      return;
    }

    var viewModel = state ? collectViewModel(state, registry, sessionRecentClientIds) : null;
    if (!viewModel) {
      renderLoading(view);
      return;
    }
    if (viewModel.degraded) {
      renderDegraded(view, viewModel);
      return;
    }
    renderReady(view, viewModel, registry);
  }

  /**
   * Follows every route change: records visits to the Client Dashboard in
   * the session-only recency list, then re-renders Home when it is active.
   */
  function handleRouteChanged(event) {
    var registry = AuditOS.workspaceRegistry;
    var detail = event && event.detail ? event.detail : {};
    if (registry && detail.workspaceId === registry.IDS.CLIENT && detail.recordId) {
      sessionRecentClientIds = recordRecentClient(sessionRecentClientIds, detail.recordId, RECENT_LIMIT);
    }
    renderActiveHome();
  }

  AuditOS.homeWorkspace = {
    SLOTS: SLOTS,

    // Pure, offline-testable derivations.
    derivations: {
      formatDate: formatDate,
      plural: plural,
      companyStatusTone: companyStatusTone,
      engagementCountsFor: engagementCountsFor,
      frameworksFor: frameworksFor,
      deriveClientCards: deriveClientCards,
      deriveContinueWorking: deriveContinueWorking,
      recordRecentClient: recordRecentClient,
      deriveRecentClients: deriveRecentClients,
      deriveClientGroups: deriveClientGroups,
      derivePortfolioRibbon: derivePortfolioRibbon,
      deriveRelatedFacts: deriveRelatedFacts,
      deriveDemoDataFootprint: deriveDemoDataFootprint
    },

    collectViewModel: collectViewModel,

    /**
     * Binds Home to the router and the Shared Audit State. Safe to call once,
     * after the DOM is ready, the router has resolved the initial route, and
     * the framework has rendered its skeleton (script order guarantees the
     * framework's route listener runs first). Does nothing when the routing
     * or state foundations are absent, so the shell degrades rather than
     * throwing.
     */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }

      // Re-render whenever the route returns to Home (the framework has just
      // rebuilt the slots) and when the state loads, changes, or resets. The
      // same route listener maintains the session-only Recent Clients list.
      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, handleRouteChanged);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveHome);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveHome);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveHome);
      }
      renderActiveHome();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.homeWorkspace.init);
    } else {
      AuditOS.homeWorkspace.init();
    }
  }
})(window);
