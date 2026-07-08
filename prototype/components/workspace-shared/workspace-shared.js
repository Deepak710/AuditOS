/**
 * AuditOS Workspace Shared Platform
 * Component Architecture — Chapter 74 / Component Design Patterns §81.4
 * (Composition Over Duplication) — GitHub Issue #27 (Workspace Harmonization).
 *
 * Extracts the presentation and derivation patterns that stabilized identically
 * (or near-identically, modulo a CSS class prefix or a tone resolver) across the
 * Engagement, Walkthrough, Evidence, Requirements, Controls, Testing, Findings,
 * and Documentation workspaces. This module holds no business logic and no
 * status vocabulary of its own — every tone mapping, field shape, and node chain
 * stays owned by the workspace that declares it and is passed in as data or a
 * callback (Never over-centralize — some things should stay slightly duplicated
 * per workspace, §27). Extraction here changes no rendering behavior and no
 * business rule; each workspace's own module still decides what to render, this
 * module only stops it from re-typing how.
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader. Loads
 * after the Enterprise Data Presentation System and before every workspace
 * module, so `AuditOS.workspaceShared` is available when a workspace module
 * assigns local aliases at parse time.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  // ------------------------------------------------------------------
  // Constants shared verbatim across every operational workspace.
  // ------------------------------------------------------------------

  /** Presentation tones shared by badges, markers, dots, and rails. */
  var TONES = { INFO: 'info', SUCCESS: 'success', WARNING: 'warning', ERROR: 'error' };

  /** Deterministic month labels so dates never depend on runtime locale. */
  var MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** Default maximum entries per supporting list so panels stay scannable. */
  var LIST_LIMIT = 8;

  /** Entrance stagger ceiling — sections beyond this share the last delay. */
  var STAGGER_LIMIT = 3;

  /** Engagement lifecycle status vocabulary used only to pick the current engagement. */
  var ENGAGEMENT_STATUS = { IN_PROGRESS: 'In Progress' };

  // ------------------------------------------------------------------
  // Pure helpers — no DOM, no AuditOS.state access.
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
    if (typeof isoDate !== 'string' || !isoDate) {
      return '';
    }
    var parts = isoDate.split('-');
    var month = MONTH_LABELS[Number(parts[1]) - 1];
    if (parts.length < 3 || !month) {
      return isoDate;
    }
    return month + ' ' + Number(parts[2]) + ', ' + parts[0];
  }

  /** Formats a `{ startDate, endDate }` period as `start – end`. */
  function formatPeriod(period) {
    if (!period || !period.startDate || !period.endDate) {
      return '';
    }
    return formatDate(period.startDate) + ' – ' + formatDate(period.endDate);
  }

  /**
   * The frameworks attached to an engagement, always as an array. The Release 1
   * → Release 2 extensibility seam every workspace shares: a future engagement
   * that declares a `frameworks` array renders every entry; today's single
   * `framework` string becomes a one-element array. Nothing is fabricated — an
   * engagement with neither yields an empty array.
   */
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

  /**
   * The current engagement: the first in-progress engagement in record order,
   * falling back to the first engagement, or null when none exist. Identical
   * rule across every workspace so every surface stays on the same engagement.
   */
  function deriveCurrentEngagement(engagements) {
    if (!Array.isArray(engagements) || engagements.length === 0) {
      return null;
    }
    for (var index = 0; index < engagements.length; index += 1) {
      if (engagements[index].status === ENGAGEMENT_STATUS.IN_PROGRESS) {
        return engagements[index];
      }
    }
    return engagements[0];
  }

  /** Resolves a record's name field from an id map, falling back to the raw id (join-or-raw). */
  function resolveName(map, id, field) {
    var record = id && map ? map[id] : null;
    if (record && record[field]) {
      return record[field];
    }
    return id || '';
  }

  /** Normalizes a linked-id reference into an Inspector list item, resolving its name where it joins. */
  function resolveRefItem(id, map, field) {
    return { title: resolveName(map, id, field), tone: TONES.INFO };
  }

  /** One text-valued Inspector section rendered as a single placeholder-capable list row. */
  function textSection(title, text, placeholder) {
    return { title: title, kind: 'list', items: [{ title: text || placeholder }] };
  }

  /** One list-valued Inspector section; an empty list renders one placeholder row. */
  function listSection(title, items, placeholder) {
    var list = asArray(items);
    return { title: title, kind: 'list', items: list.length > 0 ? list : [{ title: placeholder }] };
  }

  /**
   * Normalizes recorded history entries into presentation events; fabricates
   * nothing. `toneResolver` is the caller's own status-tone vocabulary — this
   * module carries no status vocabulary of its own.
   */
  function buildHistory(entries, toneResolver) {
    return asArray(entries).map(function (entry) {
      var source = entry || {};
      return {
        timestamp: formatDate(source.date || source.timestamp || source.on || ''),
        title: source.title || source.action || source.status || '',
        actor: source.actor || source.by || '',
        description: source.description || source.note || '',
        tone: source.tone || (toneResolver ? toneResolver(source.status) : null)
      };
    }).filter(function (event) { return event.title; });
  }

  /** Immutable version history — rendered only from a `versionHistory` / `versions` array the record carries. */
  function deriveVersionHistory(record, toneResolver) {
    var source = record || {};
    return buildHistory(source.versionHistory || source.versions, toneResolver);
  }

  /**
   * Approval history — the recorded `approvalHistory` when present, else a
   * single entry reflecting the current status (a real, current fact, not a
   * fabricated past). Empty only when the record carries no status at all.
   */
  function deriveApprovalHistory(record, toneResolver) {
    var source = record || {};
    if (Array.isArray(source.approvalHistory) && source.approvalHistory.length > 0) {
      return buildHistory(source.approvalHistory, toneResolver).map(function (event) {
        return { title: event.title, description: [event.actor, event.timestamp].filter(Boolean).join(' · ') || event.description, tone: event.tone };
      });
    }
    if (source.status) {
      return [{ title: source.status, description: formatDate(source.updatedAt || source.updatedOn) || '', tone: toneResolver ? toneResolver(source.status) : null }];
    }
    return [];
  }

  /** Activity history — rendered only from recorded dated history; never fabricated. */
  function deriveActivityHistory(record, toneResolver) {
    var source = record || {};
    return buildHistory(source.activityHistory || source.activity || source.history, toneResolver).map(function (event) {
      return { title: event.title, description: [event.actor, event.timestamp].filter(Boolean).join(' · ') || event.description, tone: event.tone };
    });
  }

  // ------------------------------------------------------------------
  // Shared Audit State read helpers — identical across every workspace that
  // reads engagement-scoped documents.
  // ------------------------------------------------------------------

  /** Reads the first dataset document an engagement owns in a collection, or null. */
  function readEngagementDocument(state, collectionId, engagementId) {
    var datasetIds = state.findDatasetsForEngagement(collectionId, engagementId);
    return datasetIds.length > 0 ? state.getDocument(collectionId, datasetIds[0]) : null;
  }

  /** Finds a record by id within a list. */
  function findById(records, id) {
    for (var index = 0; index < asArray(records).length; index += 1) {
      if (records[index].id === id) {
        return records[index];
      }
    }
    return null;
  }

  /** Indexes a list of records by their id field. */
  function indexById(records) {
    var map = {};
    asArray(records).forEach(function (record) {
      if (record && record.id) {
        map[record.id] = record;
      }
    });
    return map;
  }

  // ------------------------------------------------------------------
  // Generic DOM builders — thin layout wrappers around the Enterprise Data
  // Presentation System (AuditOS.presentation). Text is always assigned through
  // textContent, never markup injection. Every builder that renders workspace
  // CSS classes takes the workspace's own class prefix (e.g. `aos-controls`) so
  // no workspace's stylesheet or DOM contract changes.
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

  /** The shared presentation system, resolved at render time. */
  function presentation() {
    return AuditOS.presentation;
  }

  /** Builds one Section component: an eyebrow, a title, an optional description, then a body node. */
  function buildSection(prefix, id, meta, bodyNode) {
    var section = el('section', 'aos-section ' + prefix + '__section ' + prefix + '__section--' + id);
    section.setAttribute('aria-label', meta.title);

    var header = el('header', 'aos-section__header');
    if (meta.kicker) {
      header.appendChild(el('p', 'aos-section__eyebrow', meta.kicker));
    }
    header.appendChild(el('h2', 'aos-section__title', meta.title));
    if (meta.description) {
      header.appendChild(el('p', 'aos-section__description', meta.description));
    }
    section.appendChild(header);

    var body = el('div', 'aos-section__body');
    body.appendChild(bodyNode);
    section.appendChild(body);
    return section;
  }

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

  /** Builds a run of labeled value items for the workspace footer. */
  function buildFooterItems(prefix, entries) {
    var fragment = global.document.createDocumentFragment();
    asArray(entries).forEach(function (entry) {
      var item = el('span', prefix + '-footer__item');
      item.appendChild(el('span', prefix + '-footer__label', entry.label));
      item.appendChild(el('span', prefix + '-footer__value aos-numeric', entry.value));
      fragment.appendChild(item);
    });
    return fragment;
  }

  /**
   * Builds a Workspace Health strip: a row of tone-dot indicators (editor
   * status-bar style, identical composition across every operational
   * workspace). The status text carries the meaning; the dot only reinforces
   * the tone, so health reads without relying on color. An indicator with a
   * `path` renders as a link into its workspace; one without renders as plain
   * text — a superset that already covers every workspace's current usage.
   */
  function buildHealthStrip(prefix, ariaLabel, items) {
    var strip = el('div', prefix + '__health');
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', ariaLabel);
    asArray(items).forEach(function (item) {
      var node = el(item.path ? 'a' : 'span', prefix + '__health-item');
      if (item.path) {
        node.setAttribute('href', '#/' + item.path);
      }
      node.setAttribute('aria-label', item.label + ': ' + item.status);
      var dot = el('span', prefix + '__health-dot' + (item.tone ? ' ' + prefix + '__health-dot--' + item.tone : ''));
      dot.setAttribute('aria-hidden', 'true');
      node.appendChild(dot);
      node.appendChild(el('span', prefix + '__health-label', item.label));
      node.appendChild(el('span', prefix + '__health-status', item.status));
      strip.appendChild(node);
    });
    return strip;
  }

  /**
   * Resolves lineage node descriptors (id / label / count / present / hint /
   * highlighted) against the Workspace Registry, producing the real path each
   * node links to. The chain itself — which nodes, in what order, which one is
   * highlighted — stays owned by the calling workspace; this only removes the
   * identical `workspaceRegistry.findById` boilerplate every workspace repeated.
   */
  function resolveLineageNodes(workspaceRegistry, nodeDefs) {
    if (!workspaceRegistry) {
      return [];
    }
    return asArray(nodeDefs).map(function (node) {
      var workspace = workspaceRegistry.findById(node.id);
      return {
        label: node.label,
        path: workspace ? workspace.path : null,
        count: node.count,
        present: node.present,
        highlighted: Boolean(node.highlighted),
        hint: node.hint
      };
    });
  }

  /**
   * Builds the Audit Lineage body: the methodology chain rendered as connected
   * nodes, with the highlighted node marked by the caller. Each node shows its
   * real count and links into its workspace; absent nodes read "—". The chain
   * reads left-to-right on wide canvases and stacks on narrow ones
   * (stylesheet).
   */
  function buildLineageBody(prefix, lineage) {
    var chain = el('div', prefix + '__lineage');
    chain.setAttribute('role', 'list');
    asArray(lineage).forEach(function (node, index) {
      if (index > 0) {
        var connector = el('span', prefix + '__lineage-connector', '→');
        connector.setAttribute('aria-hidden', 'true');
        chain.appendChild(connector);
      }
      var tag = node.path ? 'a' : 'div';
      var card = el(tag, prefix + '__lineage-node' + (node.highlighted ? ' ' + prefix + '__lineage-node--highlighted' : '') + (node.present ? '' : ' ' + prefix + '__lineage-node--empty'));
      card.setAttribute('role', 'listitem');
      if (node.path) {
        card.setAttribute('href', '#/' + node.path);
      }
      card.appendChild(el('span', prefix + '__lineage-label', node.label));
      var value = node.count === null ? (node.present ? '' : '—') : String(node.count);
      if (value) {
        card.appendChild(el('span', prefix + '__lineage-count aos-numeric', value));
      }
      if (node.hint) {
        card.appendChild(el('span', prefix + '__lineage-hint', node.hint));
      }
      chain.appendChild(card);
    });
    return chain;
  }

  /**
   * Resolves related-object descriptors (id / title / meta / present) against
   * the Workspace Registry, keeping only the present ones and producing the
   * real path each links to. Which domains are related, and their counts, stay
   * owned by the calling workspace.
   */
  function resolveRelationships(workspaceRegistry, relatedDefs) {
    if (!workspaceRegistry) {
      return [];
    }
    return asArray(relatedDefs).filter(function (item) {
      return item.present;
    }).map(function (item) {
      var workspace = workspaceRegistry.findById(item.id);
      return { title: item.title, meta: item.meta, path: workspace ? workspace.path : null };
    });
  }

  /** Builds the Related information supporting panel body: related audit objects with navigation, or the shared Empty State. */
  function buildRelatedBody(relationships, emptyDescriptor) {
    var P = presentation();
    if (asArray(relationships).length === 0) {
      return P.emptyState(emptyDescriptor);
    }
    return P.itemList(relationships.map(function (item) {
      return {
        title: item.title, meta: item.meta, tone: TONES.INFO,
        actions: item.path ? [{ label: 'Open', href: '#/' + item.path }] : []
      };
    }), { compact: true });
  }

  /** Builds the Activity Feed for the activity supporting panel, or the shared Empty State. */
  function buildActivityBody(activity, emptyDescriptor) {
    var P = presentation();
    if (asArray(activity).length === 0) {
      return P.emptyState(emptyDescriptor);
    }
    return P.activityFeed({ events: activity });
  }

  /** Builds the Metadata body: the shared Metadata List over already-resolved `{ term, detail }` pairs. */
  function metadataBody(pairs) {
    var P = presentation();
    return P.metadataList(asArray(pairs).filter(function (pair) { return pair.detail; }));
  }

  /**
   * A selection controller shared by every rail rendering: registering a row
   * wires its click to swap the caller's Inspector into the detail mount;
   * selecting the first row establishes the default detail. Memory-only
   * presentation state — no business data is touched, no route changed.
   * `buildInspector(record, context)` and `recordKey` (the row field holding
   * the raw business record; omit it when the inspector takes the row itself)
   * are supplied by the caller, so each workspace's own Inspector stays
   * exactly as it was.
   */
  function createRailSelection(prefix, detailMount, buildInspector, context, recordKey) {
    var entries = [];
    function select(index) {
      entries.forEach(function (entry, entryIndex) {
        var selected = entryIndex === index;
        entry.node.classList.toggle(prefix + '__row--selected', selected);
        entry.node.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      if (entries[index]) {
        var record = recordKey ? entries[index].row[recordKey] : entries[index].row;
        detailMount.replaceChildren(presentation().inspectorPanel(buildInspector(record, context)));
      }
    }
    return {
      register: function (row, node) {
        var index = entries.length;
        entries.push({ row: row, node: node });
        node.addEventListener('click', function () { select(index); });
      },
      selectFirst: function () { if (entries.length > 0) { select(0); } }
    };
  }

  /**
   * Renders a set of grouped rows into a master list node and wires selection
   * to the detail mount. Clears the list first, so the same node re-renders
   * when the presentation view changes. Group labels render as a labeled
   * divider carrying the group's count; a group with no label (or a single
   * ungrouped set) renders no divider. `buildRow(row)` stays owned by the
   * calling workspace.
   */
  function mountRailGroups(prefix, listNode, detailMount, groups, context, buildRow, buildInspector, recordKey) {
    listNode.replaceChildren();
    var selection = createRailSelection(prefix, detailMount, buildInspector, context, recordKey);
    asArray(groups).forEach(function (group) {
      if (group.label) {
        var divider = el('div', prefix + '__group');
        divider.setAttribute('role', 'separator');
        divider.setAttribute('aria-label', group.label);
        divider.appendChild(el('span', prefix + '__group-label', group.label));
        divider.appendChild(el('span', prefix + '__group-count aos-numeric', String(asArray(group.rows).length)));
        listNode.appendChild(divider);
      }
      asArray(group.rows).forEach(function (row) {
        var node = buildRow(row);
        node.classList.add(prefix + '__row');
        node.setAttribute('aria-pressed', 'false');
        selection.register(row, node);
        listNode.appendChild(node);
      });
    });
    selection.selectFirst();
  }

  AuditOS.workspaceShared = {
    TONES: TONES,
    MONTH_LABELS: MONTH_LABELS,
    LIST_LIMIT: LIST_LIMIT,
    STAGGER_LIMIT: STAGGER_LIMIT,

    asArray: asArray,
    plural: plural,
    formatDate: formatDate,
    formatPeriod: formatPeriod,
    normalizeFrameworks: normalizeFrameworks,
    deriveCurrentEngagement: deriveCurrentEngagement,
    resolveName: resolveName,
    resolveRefItem: resolveRefItem,
    textSection: textSection,
    listSection: listSection,
    buildHistory: buildHistory,
    deriveVersionHistory: deriveVersionHistory,
    deriveApprovalHistory: deriveApprovalHistory,
    deriveActivityHistory: deriveActivityHistory,

    readEngagementDocument: readEngagementDocument,
    findById: findById,
    indexById: indexById,

    el: el,
    presentation: presentation,
    buildSection: buildSection,
    slotElement: slotElement,
    fillSlot: fillSlot,
    buildFooterItems: buildFooterItems,
    buildHealthStrip: buildHealthStrip,
    resolveLineageNodes: resolveLineageNodes,
    buildLineageBody: buildLineageBody,
    resolveRelationships: resolveRelationships,
    buildRelatedBody: buildRelatedBody,
    buildActivityBody: buildActivityBody,
    metadataBody: metadataBody,
    createRailSelection: createRailSelection,
    mountRailGroups: mountRailGroups
  };
})(window);
