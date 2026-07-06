/**
 * AuditOS Enterprise Data Presentation System
 * Data Display Components — Chapter 77 / Component Design Patterns — Chapter 81 /
 * Component Architecture — Chapter 74
 *
 * The shared, configuration-driven renderer every AuditOS workspace uses to
 * present audit data. Where the Component Library (css/components.css) owns the
 * visual definition of each presentation primitive and the registry
 * (component-library.js) catalogs them, this module is the one reusable engine
 * that turns a declarative JSON configuration into the corresponding DOM by
 * composing those primitives — so no workspace re-implements a data grid, a
 * master–detail layout, an inspector, a timeline, an activity feed, an entity
 * card, or a status badge (Component Design Patterns §81.4 — Composition Over
 * Duplication).
 *
 * Presentation only. Every builder takes a plain configuration object (the
 * shape a workspace maps from the Shared Audit State) and returns a DOM node.
 * This module NEVER reads or writes AuditOS.state, NEVER reads demo-data, and
 * holds no business or workflow logic — business truth stays authoritative in
 * Business Objects (Component Architecture §74.2, §74.6). Text is always
 * assigned through textContent / text nodes, never markup injection. Every
 * value is drawn from Design Tokens through the component classes, so the system
 * inherits dark mode, reduced motion, keyboard focus, and color-independent
 * status automatically.
 *
 * Integration with the Shared Workspace Framework: the builders return nodes a
 * workspace drops into the framework's reserved slots — a Data Grid or
 * Master–Detail into primary content, an Inspector or Activity Feed into the
 * supporting panels — so the presentation system composes the framework rather
 * than competing with it.
 *
 * Structure (Coding Standards §30.8): the status vocabulary and pure resolvers
 * (offline-testable — no DOM, no state), small DOM helpers, then the
 * configuration-driven builders, and finally the public API. The pure resolvers
 * are exposed so the offline unit suites exercise the presentation decisions
 * directly.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader. The
 * module only touches the DOM inside a builder call, so it registers cleanly in
 * the offline test sandbox where no document exists.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  // ------------------------------------------------------------------
  // Status vocabulary + pure resolvers (offline-testable; no DOM, no state).
  // ------------------------------------------------------------------

  /** The semantic presentation tones shared by every component. */
  var TONES = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
  };

  /**
   * The reusable status presentation vocabulary (Issue #18 §4). It maps a
   * business status kind and value to a semantic tone, so severity, risk,
   * review status, lifecycle, test outcome, and priority all read through the
   * same token-backed tones in every workspace instead of each redefining the
   * mapping. Keys are lowercased for tolerant matching; an unmapped value
   * resolves to a neutral tone (null). A consumer may always pass an explicit
   * `tone` to override the vocabulary.
   */
  var STATUS_TONES = {
    severity: { high: 'error', medium: 'warning', low: 'info', informational: 'info' },
    risk: { high: 'error', medium: 'warning', low: 'success' },
    review: {
      approved: 'success', 'pending review': 'warning', pending: 'warning',
      rejected: 'error', submitted: 'info', 'not started': null
    },
    lifecycle: {
      draft: null, planned: 'info', 'in progress': 'info', open: 'warning',
      'in review': 'warning', remediation: 'warning', completed: 'success',
      closed: 'success', archived: null
    },
    test: { pass: 'success', passed: 'success', fail: 'error', failed: 'error', 'in progress': 'warning', 'not tested': null },
    priority: { critical: 'error', high: 'error', medium: 'warning', low: 'info' }
  };

  /** Marker glyphs that reinforce a tone without ever carrying it alone. */
  var TONE_GLYPHS = { info: '•', success: '✓', warning: '!', error: '!', neutral: '•' };

  /** Sort-direction indicator glyphs — direction reads beyond aria-sort alone. */
  var SORT_INDICATORS = { ascending: '▲', descending: '▼', none: '↕' };

  /**
   * Loading-skeleton compositions (§15.12) for the common content shapes, so a
   * consumer requests a shape rather than assembling skeleton chrome. `detail`
   * is the fallback.
   */
  var LOADING_TEMPLATES = {
    table: ['title', 'text', 'text', 'text', 'text', 'text'],
    cards: ['block', 'block', 'block'],
    list: ['text', 'text', 'text', 'text'],
    form: ['title', 'text', 'text', 'text', 'block'],
    detail: ['title', 'text', 'text', 'block', 'block']
  };

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /**
   * Resolves a business status to a semantic tone through the vocabulary, or
   * null when the kind/value is unmapped. Pure — the single place the platform
   * decides what tone a severity / risk / review / lifecycle value carries.
   */
  function resolveTone(kind, value) {
    if (!kind || value === undefined || value === null) {
      return null;
    }
    var table = STATUS_TONES[String(kind).toLowerCase()];
    if (!table) {
      return null;
    }
    var key = String(value).toLowerCase();
    return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
  }

  /** Returns the reinforcing glyph for a tone (neutral when the tone is null). */
  function resolveGlyph(tone) {
    return TONE_GLYPHS[tone] || TONE_GLYPHS.neutral;
  }

  /** Normalizes a density value to the grid's two supported densities. */
  function normalizeDensity(value) {
    return value === 'compact' ? 'compact' : 'comfortable';
  }

  /** Normalizes a sort value to one of none / ascending / descending. */
  function normalizeSort(value) {
    return value === 'ascending' || value === 'descending' ? value : 'none';
  }

  /**
   * The next sort direction in the header cycle: none → ascending → descending
   * → none. Sorting here is presentation state only; no rows are reordered.
   */
  function nextSortDirection(current) {
    if (current === 'ascending') {
      return 'descending';
    }
    if (current === 'descending') {
      return 'none';
    }
    return 'ascending';
  }

  /** The indicator glyph for a sort direction. */
  function sortIndicator(direction) {
    return SORT_INDICATORS[direction] || SORT_INDICATORS.none;
  }

  /**
   * Normalizes a raw column descriptor (a string or `{ key, label, sortable,
   * align, width, sort }`) into a complete descriptor with defaults applied.
   * `align` is one of start / numeric / actions. Pure.
   */
  function normalizeColumn(column) {
    if (typeof column === 'string') {
      return { key: column, label: column, sortable: false, align: 'start', width: null, sort: 'none' };
    }
    var source = column || {};
    var align = source.align === 'numeric' || source.align === 'actions' ? source.align : 'start';
    return {
      key: source.key,
      label: source.label !== undefined && source.label !== null ? source.label : source.key,
      sortable: Boolean(source.sortable),
      align: align,
      width: source.width || null,
      sort: normalizeSort(source.sort)
    };
  }

  /** Normalizes a list of column descriptors. Pure. */
  function normalizeColumns(columns) {
    return asArray(columns).map(normalizeColumn);
  }

  /**
   * Clamps a master–detail proportion (a percentage) into the resizable range
   * [min, max] (default 20–80). A non-numeric value clamps to the minimum.
   * Pure — the single decision behind both the initial ratio and every resize.
   */
  function clampRatio(value, min, max) {
    var lo = typeof min === 'number' ? min : 20;
    var hi = typeof max === 'number' ? max : 80;
    var numeric = Number(value);
    if (!isFinite(numeric)) {
      return lo;
    }
    return Math.min(hi, Math.max(lo, numeric));
  }

  /** Normalizes one activity event descriptor into a complete presentation event. */
  function normalizeActivityEvent(event) {
    var source = event || {};
    var tone = source.tone || resolveTone(source.kind, source.value) || null;
    return {
      tone: tone,
      icon: source.icon || resolveGlyph(tone),
      title: source.title || '',
      actor: source.actor || '',
      meta: source.meta || source.description || '',
      timestamp: source.timestamp || source.time || ''
    };
  }

  /**
   * Normalizes an activity feed configuration into an ordered list of
   * `{ label, events }` groups. Accepts either explicit `groups` or a flat
   * `events` list (a single, unlabeled group). Pure — grouping is a
   * presentation decision, so it is offline-testable.
   */
  function normalizeActivityGroups(config) {
    var source = config || {};
    if (Array.isArray(source.groups)) {
      return source.groups.map(function (group) {
        return { label: (group && group.label) || '', events: asArray(group && group.events).map(normalizeActivityEvent) };
      });
    }
    return [{ label: source.label || '', events: asArray(source.events).map(normalizeActivityEvent) }];
  }

  // ------------------------------------------------------------------
  // DOM helpers — used only inside builder calls, so the module loads without a
  // document (offline test sandbox).
  // ------------------------------------------------------------------

  /** Creates an element with a class and optional text content. */
  function element(tagName, className, textContent) {
    var node = global.document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (textContent !== undefined && textContent !== null && textContent !== '') {
      node.textContent = textContent;
    }
    return node;
  }

  /** Appends a text node (used when an element already has child elements). */
  function appendText(node, text) {
    if (text === undefined || text === null || text === '') {
      return;
    }
    node.appendChild(global.document.createTextNode(String(text)));
  }

  /** True when a value is a DOM node a builder can adopt directly. */
  function isNode(value) {
    return Boolean(value) && typeof value === 'object' && typeof value.nodeType === 'number';
  }

  /** Normalizes a compact row/inline action descriptor (subtle + small by default). */
  function smallActionDefaults(action) {
    var source = action || {};
    return {
      label: source.label,
      href: source.href,
      id: source.id,
      variant: source.variant || 'subtle',
      size: source.size || 'small'
    };
  }

  // ------------------------------------------------------------------
  // Builders — configuration-driven compositions of the component primitives.
  // ------------------------------------------------------------------

  /**
   * Builds a Button component from `{ label, variant, size, href, id }`. A
   * descriptor with an href renders as a button-styled link (navigation);
   * otherwise a real <button>. Presentation only.
   */
  function button(config) {
    var source = config || {};
    var variant = source.variant ? ' aos-button--' + source.variant : '';
    var size = source.size === 'small' ? ' aos-button--small' : '';
    var node;
    if (source.href) {
      node = element('a', 'aos-button' + variant + size, source.label);
      node.setAttribute('href', source.href);
    } else {
      node = element('button', 'aos-button' + variant + size, source.label);
      node.setAttribute('type', 'button');
    }
    if (source.id) {
      node.setAttribute('data-action', source.id);
    }
    return node;
  }

  /**
   * Builds a Status Badge (Issue #18 §4) from `{ label, tone, kind, value,
   * dot }`. The tone is the explicit `tone`, or is resolved from the status
   * vocabulary via `kind`/`value`; the label defaults to the value. Tone always
   * reads through the badge text as well as the surface, never color alone.
   */
  function statusBadge(config) {
    var source = config || {};
    var tone = source.tone || resolveTone(source.kind, source.value);
    var label = source.label !== undefined && source.label !== null
      ? source.label
      : (source.value !== undefined && source.value !== null ? String(source.value) : '');
    var badge = element('span', 'aos-status-badge' + (tone ? ' aos-status-badge--' + tone : ''));
    if (source.dot) {
      var dot = element('span', 'aos-status-badge__dot');
      dot.setAttribute('aria-hidden', 'true');
      badge.appendChild(dot);
      appendText(badge, label);
    } else {
      badge.textContent = label;
    }
    return badge;
  }

  /**
   * Builds a Progress meter (Issue #18 §4) with accessible progressbar
   * semantics. The value always reads as text beside the track, so completion
   * is never encoded by the bar alone.
   */
  function progressMeter(config) {
    var source = config || {};
    var total = Number(source.total) || 0;
    var value = Number(source.value) || 0;
    var percent = total > 0 ? Math.round((value / total) * 100) : (Number(source.percent) || 0);
    var progress = element('div', 'aos-progress' + (source.tone ? ' aos-progress--' + source.tone : ''));
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-label', source.label || 'Progress');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', String(total || 100));
    progress.setAttribute('aria-valuenow', String(value));

    var header = element('div', 'aos-progress__header');
    header.appendChild(element('span', 'aos-progress__label', source.label || ''));
    var valueText = source.valueText !== undefined && source.valueText !== null
      ? source.valueText
      : (total > 0 ? value + ' of ' + total + ' · ' + percent + '%' : percent + '%');
    header.appendChild(element('span', 'aos-progress__value aos-numeric', valueText));
    progress.appendChild(header);

    var track = element('div', 'aos-progress__track');
    var indicator = element('div', 'aos-progress__indicator');
    indicator.style.width = percent + '%';
    track.appendChild(indicator);
    progress.appendChild(track);
    return progress;
  }

  /** Builds a Metadata List (§15.16) from `{ term, detail }` pairs; `--inline` optional. */
  function metadataList(items, options) {
    var opts = options || {};
    var list = element('dl', 'aos-metadata-list' + (opts.inline ? ' aos-metadata-list--inline' : ''));
    asArray(items).forEach(function (pair) {
      var item = element('div', 'aos-metadata-list__item');
      item.appendChild(element('dt', 'aos-metadata-list__term', pair.term));
      item.appendChild(element('dd', 'aos-metadata-list__detail', pair.detail));
      list.appendChild(item);
    });
    return list;
  }

  /** Builds a single Property Row from `{ label, value }` or `{ label, node }`. */
  function propertyRow(row) {
    var source = row || {};
    var node = element('div', 'aos-property-row');
    node.appendChild(element('span', 'aos-property-row__label', source.label));
    var value = element('span', 'aos-property-row__value');
    if (isNode(source.node)) {
      value.appendChild(source.node);
    } else if (source.value !== undefined && source.value !== null) {
      value.textContent = String(source.value);
    }
    node.appendChild(value);
    return node;
  }

  /** Builds a Property Grid of Property Rows; `{ columns: 2 }` opts into two columns. */
  function propertyGrid(rows, options) {
    var opts = options || {};
    var twoColumn = opts.columns === 2 || opts.twoColumn === true;
    var grid = element('div', 'aos-property-grid' + (twoColumn ? ' aos-property-grid--two-column' : ''));
    asArray(rows).forEach(function (row) {
      grid.appendChild(propertyRow(row));
    });
    return grid;
  }

  /**
   * Builds a Timeline (Issue #18 §6) from `{ timestamp, title, actor,
   * description, tone/kind/value }` events. The marker tone reinforces, never
   * replaces, the event text; the actor is named in the title.
   */
  function timeline(events) {
    var list = element('ol', 'aos-timeline');
    asArray(events).forEach(function (event) {
      var source = event || {};
      var tone = source.tone || resolveTone(source.kind, source.value) || null;
      var item = element('li', 'aos-timeline__event');
      var marker = element('span', 'aos-timeline__marker' + (tone ? ' aos-timeline__marker--' + tone : ''));
      marker.setAttribute('aria-hidden', 'true');
      item.appendChild(marker);

      var content = element('div', 'aos-timeline__content');
      var metaText = source.timestamp || source.meta || '';
      if (metaText) {
        content.appendChild(element('span', 'aos-timeline__meta aos-numeric', metaText));
      }
      var titleText = source.actor ? source.actor + ' · ' + (source.title || '') : (source.title || '');
      content.appendChild(element('span', 'aos-timeline__title', titleText));
      if (source.description) {
        content.appendChild(element('span', 'aos-timeline__description', source.description));
      }
      item.appendChild(content);
      list.appendChild(item);
    });
    return list;
  }

  /** Builds one Item List row (tone marker, content, and either row actions or trailing meta). */
  function itemRow(item) {
    var source = item || {};
    var tone = source.tone || resolveTone(source.kind, source.value) || null;
    var row = element('li', 'aos-item-list__item' + (source.critical ? ' aos-item-list__item--critical' : ''));
    var marker = element('span', 'aos-item-list__marker' + (tone ? ' aos-item-list__marker--' + tone : ''),
      source.glyph || resolveGlyph(tone));
    marker.setAttribute('aria-hidden', 'true');
    row.appendChild(marker);

    var content = element('div', 'aos-item-list__content');
    content.appendChild(element('span', 'aos-item-list__title', source.title || ''));
    if (source.description) {
      content.appendChild(element('span', 'aos-item-list__description', source.description));
    }
    row.appendChild(content);

    if (asArray(source.actions).length > 0) {
      var actions = element('span', 'aos-item-list__actions');
      source.actions.forEach(function (action) {
        actions.appendChild(button(smallActionDefaults(action)));
      });
      row.appendChild(actions);
    } else if (source.meta) {
      row.appendChild(element('span', 'aos-item-list__meta aos-numeric', source.meta));
    }
    return row;
  }

  /** Builds an Item List from `{ title, description, meta, tone, critical, actions }` rows. */
  function itemList(items, options) {
    var opts = options || {};
    var list = element('ul', 'aos-item-list' + (opts.compact ? ' aos-item-list--compact' : ''));
    asArray(items).forEach(function (item) {
      list.appendChild(itemRow(item));
    });
    return list;
  }

  /**
   * Builds a List View (Issue #18 §9): a flat Item List, or a grouped list
   * where each `{ label, items }` group is headed by a labeled Divider.
   * Supports compact mode, status indicators, and per-row actions by reusing
   * the Item List and Divider primitives — no new grouping primitive.
   */
  function listView(config) {
    var source = config || {};
    if (Array.isArray(source.groups)) {
      var container = element('div', 'aos-list-group');
      source.groups.forEach(function (group) {
        if (group && group.label) {
          var divider = element('div', 'aos-divider--labeled');
          divider.setAttribute('role', 'separator');
          divider.setAttribute('aria-label', group.label);
          divider.appendChild(element('span', null, group.label));
          container.appendChild(divider);
        }
        container.appendChild(itemList(group && group.items, { compact: source.compact }));
      });
      return container;
    }
    return itemList(source.items, { compact: source.compact });
  }

  /** Builds one Activity Feed event from a normalized event descriptor. */
  function activityEvent(event) {
    var item = element('li', 'aos-activity-feed__event');
    var icon = element('span', 'aos-activity-feed__icon' + (event.tone ? ' aos-activity-feed__icon--' + event.tone : ''), event.icon);
    icon.setAttribute('aria-hidden', 'true');
    item.appendChild(icon);

    var content = element('div', 'aos-activity-feed__content');
    var title = element('span', 'aos-activity-feed__title');
    if (event.actor) {
      title.appendChild(element('span', 'aos-activity-feed__actor', event.actor));
      appendText(title, ' ' + event.title);
    } else {
      title.textContent = event.title;
    }
    content.appendChild(title);
    if (event.meta) {
      content.appendChild(element('span', 'aos-activity-feed__meta', event.meta));
    }
    item.appendChild(content);

    if (event.timestamp) {
      item.appendChild(element('span', 'aos-activity-feed__timestamp aos-numeric', event.timestamp));
    }
    return item;
  }

  /**
   * Builds an Activity Feed (Issue #18 §7) from `{ groups }` or a flat
   * `{ events }` list. Each event carries a tone icon, a title with an optional
   * actor, supporting metadata, and a trailing timestamp.
   */
  function activityFeed(config) {
    var feed = element('div', 'aos-activity-feed');
    normalizeActivityGroups(config).forEach(function (group) {
      var section = element('section', 'aos-activity-feed__group');
      if (group.label) {
        section.appendChild(element('h4', 'aos-activity-feed__group-label', group.label));
      }
      var events = element('ol', 'aos-activity-feed__events');
      group.events.forEach(function (event) {
        events.appendChild(activityEvent(event));
      });
      section.appendChild(events);
      feed.appendChild(section);
    });
    return feed;
  }

  /**
   * Builds an Entity Card (Issue #18 §8) — the shared object-card language for
   * clients, engagements, controls, evidence, and findings. A card with an
   * href renders as an accessible interactive link. `{ kind, avatar, title,
   * subtitle, badge, meter, facts, tags, href }`.
   */
  function entityCard(config) {
    var source = config || {};
    var interactive = Boolean(source.href);
    var card = element(interactive ? 'a' : 'article', 'aos-entity-card' + (interactive ? ' aos-entity-card--interactive' : ''));
    if (interactive) {
      card.setAttribute('href', source.href);
      if (source.title) {
        card.setAttribute('aria-label', source.title);
      }
    }

    var header = element('header', 'aos-entity-card__header');
    var avatarGlyph = source.avatar || (source.title ? String(source.title).trim().charAt(0).toUpperCase() : '•');
    var avatar = element('span', 'aos-entity-card__avatar', avatarGlyph);
    avatar.setAttribute('aria-hidden', 'true');
    header.appendChild(avatar);

    var identity = element('div', 'aos-entity-card__identity');
    identity.appendChild(element('h3', 'aos-entity-card__title', source.title || ''));
    if (source.subtitle) {
      identity.appendChild(element('p', 'aos-entity-card__subtitle', source.subtitle));
    }
    header.appendChild(identity);

    if (source.badge) {
      var badge = statusBadge(source.badge);
      badge.className += ' aos-entity-card__badge';
      header.appendChild(badge);
    }
    card.appendChild(header);

    var body = element('div', 'aos-entity-card__body');
    if (source.meter) {
      body.appendChild(progressMeter(source.meter));
    }
    if (asArray(source.facts).length > 0) {
      body.appendChild(metadataList(source.facts, { inline: true }));
    }
    if (asArray(source.tags).length > 0) {
      var tags = element('div', 'aos-entity-card__tags');
      source.tags.forEach(function (tag) {
        tags.appendChild(element('span', 'aos-chip', typeof tag === 'string' ? tag : tag.label));
      });
      body.appendChild(tags);
    }
    card.appendChild(body);
    return card;
  }

  /** Builds a Loading State (§15.12) of structural skeletons for a content shape. */
  function loadingState(config) {
    var source = typeof config === 'string' ? { variant: config } : (config || {});
    var blocks = LOADING_TEMPLATES[source.variant] || LOADING_TEMPLATES.detail;
    var loading = element('div', 'aos-loading-state');
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-busy', 'true');
    loading.appendChild(element('span', 'aos-loading-state__label', source.label || 'Loading'));
    blocks.forEach(function (variant) {
      var skeleton = element('span', 'aos-skeleton aos-skeleton--' + variant);
      skeleton.setAttribute('aria-hidden', 'true');
      loading.appendChild(skeleton);
    });
    return loading;
  }

  /**
   * Builds an Empty State (§15.12) from `{ icon, title, description,
   * primaryAction, actions, secondaryAction }`. The primary action leads and
   * renders filled.
   */
  function emptyState(descriptor) {
    var source = descriptor || {};
    var empty = element('div', 'aos-empty-state');
    if (source.icon) {
      var glyph = element('span', 'aos-empty-state__icon', source.icon);
      glyph.setAttribute('aria-hidden', 'true');
      empty.appendChild(glyph);
    }
    if (source.title) {
      empty.appendChild(element('p', 'aos-empty-state__title', source.title));
    }
    if (source.description) {
      empty.appendChild(element('p', 'aos-empty-state__description', source.description));
    }
    var actions = [];
    if (source.primaryAction) {
      actions.push({ label: source.primaryAction.label, href: source.primaryAction.href, id: source.primaryAction.id, variant: 'primary' });
    }
    asArray(source.actions).forEach(function (action) {
      actions.push(action);
    });
    if (source.secondaryAction) {
      actions.push(source.secondaryAction);
    }
    if (actions.length > 0) {
      var group = element('div', 'aos-empty-state__actions');
      actions.forEach(function (action) {
        group.appendChild(button(action));
      });
      empty.appendChild(group);
    }
    return empty;
  }

  /** Builds one Data Grid header cell (a sortable button or plain label). */
  function dataGridHeaderCell(column) {
    var alignClass = column.align === 'numeric' ? ' aos-data-grid__header-cell--numeric'
      : column.align === 'actions' ? ' aos-data-grid__header-cell--actions' : '';
    var cell = element('th', 'aos-data-grid__header-cell' + alignClass);
    cell.setAttribute('scope', 'col');
    if (column.hidden) {
      // A visually-hidden but announced label for the status / actions columns.
      cell.appendChild(element('span', 'aos-loading-state__label', column.label));
      return cell;
    }
    if (column.width) {
      cell.style.width = column.width;
    }
    if (column.sortable) {
      cell.setAttribute('aria-sort', normalizeSort(column.sort));
      var sortButton = element('button', 'aos-data-grid__sort');
      sortButton.setAttribute('type', 'button');
      appendText(sortButton, column.label);
      var indicator = element('span', 'aos-data-grid__sort-indicator', sortIndicator(normalizeSort(column.sort)));
      indicator.setAttribute('aria-hidden', 'true');
      sortButton.appendChild(indicator);
      cell.appendChild(sortButton);
    } else {
      cell.textContent = column.label;
    }
    return cell;
  }

  /** Builds one Data Grid body row from a row descriptor and the normalized columns. */
  function dataGridRow(row, columns, hasStatus, hasActions) {
    var source = row || {};
    var selected = Boolean(source.selected);
    var tr = element('tr', 'aos-data-grid__row' + (selected ? ' aos-data-grid__row--selected' : ''));
    if (selected) {
      tr.setAttribute('aria-selected', 'true');
    }

    if (hasStatus) {
      var status = source.status || {};
      var tone = status.tone || resolveTone(status.kind, status.value) || null;
      var statusCell = element('td', 'aos-data-grid__cell aos-data-grid__cell--status');
      var rail = element('span', 'aos-data-grid__status-rail' + (tone ? ' aos-data-grid__status-rail--' + tone : ''));
      rail.setAttribute('aria-hidden', 'true');
      var railLabel = status.label || (status.value !== undefined && status.value !== null ? String(status.value) : '');
      if (railLabel) {
        rail.setAttribute('title', railLabel);
      }
      statusCell.appendChild(rail);
      tr.appendChild(statusCell);
    }

    columns.forEach(function (column) {
      var alignClass = column.align === 'numeric' ? ' aos-data-grid__cell--numeric' : '';
      var cell = element('td', 'aos-data-grid__cell' + alignClass);
      var value = source.cells ? source.cells[column.key] : source[column.key];
      if (isNode(value)) {
        cell.appendChild(value);
      } else if (value !== undefined && value !== null) {
        cell.textContent = String(value);
      }
      tr.appendChild(cell);
    });

    if (hasActions) {
      var actionsCell = element('td', 'aos-data-grid__cell aos-data-grid__cell--actions');
      var wrap = element('span', 'aos-data-grid__row-actions');
      asArray(source.actions).forEach(function (action) {
        wrap.appendChild(button(smallActionDefaults(action)));
      });
      actionsCell.appendChild(wrap);
      tr.appendChild(actionsCell);
    }
    return tr;
  }

  /**
   * Builds the Enterprise Data Grid (Issue #18 §1) from a configuration:
   * `{ columns, rows, density, selectable, emptyState, loading, caption }`.
   * Rows render from JSON; a leading status column and a trailing actions column
   * appear automatically when any row supplies `status` / `actions`. A cell
   * value may be a string or a prebuilt node (e.g. a Status Badge). Loading and
   * empty configurations preempt the table so the grid chrome never renders as
   * a blank ruled box. Sorting is presentation only — headers carry aria-sort
   * and a direction indicator but no rows are reordered here.
   */
  function dataGrid(config) {
    var source = config || {};
    var density = normalizeDensity(source.density);
    var selectable = Boolean(source.selectable);
    var grid = element('div', 'aos-data-grid aos-data-grid--' + density + (selectable ? ' aos-data-grid--selectable' : ''));

    if (source.loading) {
      var loadingWrap = element('div', 'aos-data-grid__state');
      loadingWrap.appendChild(loadingState(source.loading === true ? { variant: 'table' } : source.loading));
      grid.appendChild(loadingWrap);
      return grid;
    }

    var rows = asArray(source.rows);
    if (rows.length === 0 && source.emptyState) {
      var emptyWrap = element('div', 'aos-data-grid__state');
      emptyWrap.appendChild(emptyState(source.emptyState));
      grid.appendChild(emptyWrap);
      return grid;
    }

    var columns = normalizeColumns(source.columns);
    var hasStatus = Boolean(source.rowStatus) || rows.some(function (row) { return row && row.status; });
    var hasActions = rows.some(function (row) { return row && asArray(row.actions).length > 0; });

    var table = element('table', 'aos-data-grid__table');
    if (source.caption) {
      table.appendChild(element('caption', 'aos-loading-state__label', source.caption));
    }

    var thead = element('thead');
    var headRow = element('tr');
    if (hasStatus) {
      headRow.appendChild(dataGridHeaderCell({ label: 'Status', align: 'start', hidden: true }));
    }
    columns.forEach(function (column) {
      headRow.appendChild(dataGridHeaderCell(column));
    });
    if (hasActions) {
      headRow.appendChild(dataGridHeaderCell({ label: 'Actions', align: 'actions', hidden: true }));
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = element('tbody', 'aos-data-grid__body');
    rows.forEach(function (row) {
      tbody.appendChild(dataGridRow(row, columns, hasStatus, hasActions));
    });
    table.appendChild(tbody);

    grid.appendChild(table);
    return grid;
  }

  /**
   * Wires the master–detail resizer: pointer drag and ArrowLeft/ArrowRight
   * adjust the list proportion, clamped to the resizable range. Memory-only
   * presentation state — no business data is touched. A no-op where the
   * environment provides no event API (e.g. the offline test sandbox).
   */
  function bindResizer(container, divider) {
    if (typeof divider.addEventListener !== 'function') {
      return;
    }
    function setRatio(ratio) {
      var clamped = clampRatio(ratio, 20, 80);
      container.style.setProperty('--aos-master-detail-list', clamped + '%');
      divider.setAttribute('aria-valuenow', String(Math.round(clamped)));
    }
    divider.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        var current = Number(divider.getAttribute('aria-valuenow')) || 38;
        setRatio(current + (event.key === 'ArrowLeft' ? -2 : 2));
      }
    });
    divider.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      function onMove(moveEvent) {
        var rect = typeof container.getBoundingClientRect === 'function' ? container.getBoundingClientRect() : null;
        if (!rect || !rect.width) {
          return;
        }
        setRatio(((moveEvent.clientX - rect.left) / rect.width) * 100);
      }
      function onUp() {
        global.document.removeEventListener('pointermove', onMove);
        global.document.removeEventListener('pointerup', onUp);
      }
      global.document.addEventListener('pointermove', onMove);
      global.document.addEventListener('pointerup', onUp);
    });
  }

  /**
   * Builds the Master–Detail layout (Issue #18 §2): a list/table region beside
   * an inspector region. `{ list, detail, ratio, resizable, listLabel,
   * detailLabel }`. The proportion is a CSS variable; a resizable layout adds a
   * keyboard-operable separator. Both regions adopt whatever nodes the consumer
   * supplies. Collapses to a single column at the tablet breakpoint (stylesheet).
   */
  function masterDetail(config) {
    var source = config || {};
    var container = element('div', 'aos-master-detail' + (source.resizable ? ' aos-master-detail--resizable' : ''));
    var ratio = clampRatio(source.ratio !== undefined ? source.ratio : 38, 20, 80);
    container.style.setProperty('--aos-master-detail-list', ratio + '%');

    var list = element('div', 'aos-master-detail__list');
    list.setAttribute('aria-label', source.listLabel || 'Collection');
    if (isNode(source.list)) {
      list.appendChild(source.list);
    }
    container.appendChild(list);

    if (source.resizable) {
      var divider = element('div', 'aos-master-detail__divider');
      divider.setAttribute('role', 'separator');
      divider.setAttribute('aria-orientation', 'vertical');
      divider.setAttribute('aria-label', source.dividerLabel || 'Resize panels');
      divider.setAttribute('tabindex', '0');
      divider.setAttribute('aria-valuemin', '20');
      divider.setAttribute('aria-valuemax', '80');
      divider.setAttribute('aria-valuenow', String(Math.round(ratio)));
      bindResizer(container, divider);
      container.appendChild(divider);
    }

    var detail = element('div', 'aos-master-detail__detail');
    detail.setAttribute('aria-label', source.detailLabel || 'Detail');
    if (isNode(source.detail)) {
      detail.appendChild(source.detail);
    }
    container.appendChild(detail);
    return container;
  }

  /** Builds one Inspector section body from its kind (composing a primitive). */
  function inspectorSectionBody(section) {
    switch (section.kind) {
      case 'properties':
        return propertyGrid(section.rows, { columns: section.columns });
      case 'metadata':
        return metadataList(section.items, { inline: section.inline });
      case 'relationships':
      case 'list':
        return itemList(section.items, { compact: true });
      case 'timeline':
        return timeline(section.events);
      case 'activity':
        return activityFeed(section);
      case 'content':
        return isNode(section.node) ? section.node : element('div');
      case 'placeholder':
      default:
        return emptyState(section.empty || { icon: '◇', title: section.title || 'Nothing yet', description: section.description || '' });
    }
  }

  /** Builds one titled Inspector section. */
  function inspectorSection(section) {
    var source = section || {};
    var wrap = element('section', 'aos-inspector__section');
    if (source.title) {
      wrap.appendChild(element('h3', 'aos-inspector__section-title', source.title));
    }
    wrap.appendChild(inspectorSectionBody(source));
    return wrap;
  }

  /**
   * Builds the Inspector Panel (Issue #18 §3): an identity header (eyebrow,
   * title, subtitle, status badges), a body of titled sections — properties,
   * metadata, relationships, timeline, activity, or reserved placeholders
   * (comments / attachments / activity) — and a footer action cluster.
   * `{ eyebrow, title, subtitle, badges, sections, actions }`.
   */
  function inspectorPanel(config) {
    var source = config || {};
    var panel = element('aside', 'aos-inspector');
    panel.setAttribute('aria-label', source.ariaLabel || source.title || 'Details');

    var header = element('header', 'aos-inspector__header');
    var identity = element('div', 'aos-inspector__identity');
    if (source.eyebrow) {
      identity.appendChild(element('p', 'aos-inspector__eyebrow', source.eyebrow));
    }
    identity.appendChild(element('h2', 'aos-inspector__title', source.title || ''));
    if (source.subtitle) {
      identity.appendChild(element('p', 'aos-inspector__subtitle', source.subtitle));
    }
    header.appendChild(identity);

    if (asArray(source.badges).length > 0) {
      var badges = element('div', 'aos-inspector__badges');
      source.badges.forEach(function (badge) {
        badges.appendChild(statusBadge(badge));
      });
      header.appendChild(badges);
    }
    panel.appendChild(header);

    var body = element('div', 'aos-inspector__body');
    asArray(source.sections).forEach(function (section) {
      body.appendChild(inspectorSection(section));
    });
    panel.appendChild(body);

    if (asArray(source.actions).length > 0) {
      var footer = element('footer', 'aos-inspector__actions');
      source.actions.forEach(function (action) {
        footer.appendChild(button(action));
      });
      panel.appendChild(footer);
    }
    return panel;
  }

  // ------------------------------------------------------------------
  // Public API — the presentation system. Pure resolvers are exposed so the
  // offline suites exercise the presentation decisions directly; the builders
  // compose the registered component primitives from configuration.
  // ------------------------------------------------------------------

  AuditOS.presentation = {
    TONES: TONES,
    STATUS_TONES: STATUS_TONES,
    TONE_GLYPHS: TONE_GLYPHS,
    LOADING_TEMPLATES: LOADING_TEMPLATES,

    // Pure resolvers (no DOM, no state).
    resolveTone: resolveTone,
    resolveGlyph: resolveGlyph,
    normalizeDensity: normalizeDensity,
    normalizeSort: normalizeSort,
    nextSortDirection: nextSortDirection,
    sortIndicator: sortIndicator,
    normalizeColumn: normalizeColumn,
    normalizeColumns: normalizeColumns,
    clampRatio: clampRatio,
    normalizeActivityGroups: normalizeActivityGroups,

    // Configuration-driven builders.
    button: button,
    statusBadge: statusBadge,
    progressMeter: progressMeter,
    metadataList: metadataList,
    propertyRow: propertyRow,
    propertyGrid: propertyGrid,
    timeline: timeline,
    itemList: itemList,
    listView: listView,
    activityFeed: activityFeed,
    entityCard: entityCard,
    dataGrid: dataGrid,
    masterDetail: masterDetail,
    inspectorPanel: inspectorPanel,
    emptyState: emptyState,
    loadingState: loadingState
  };
})(window);
