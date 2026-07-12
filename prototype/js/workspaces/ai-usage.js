/**
 * AuditOS AI Telemetry Workspace
 * Platform Foundation II — GitHub Issue #34 (AI Telemetry Platform / AI
 * Usage) / Platform Information Architecture — GitHub Issue #33 (§4)
 *
 * The administrator-only platform surface for AI operational telemetry and
 * spend accounting, rebuilt by Issue #34 on the complete Release 2
 * telemetry schema: tokens, costs, models, providers, cache, latency,
 * retries, failures, acceptance / rejections / human edits, confidence,
 * quality, ROI and estimated hours saved, internal vs client-billable AI,
 * agent execution, workspace usage, trend charts, a workspace × day
 * heatmap, and daily / weekly / monthly aggregation.
 *
 * Everything renders from the JSON-backed telemetry collection through the
 * Repository Foundation — nothing is hardcoded, and aggregation rolls up
 * the platform hierarchy (Platform → Client → Program → Engagement →
 * Requirement → Control → Evidence) from the attribution each event
 * carries. Schema fields Release 1 does not yet exercise stay part of the
 * dataset for Release 2 compatibility.
 *
 * Charts follow the platform's data-visualization rules: single-series
 * marks in the primary hue (one measure per chart, one axis), a sequential
 * single-hue heatmap ramp from the design tokens, values and labels in
 * text tokens, per-mark accessible names, and an adjacent table view of
 * the same numbers.
 *
 * Access control (Issue #33 §5): visibility is gated by the
 * `ai-usage.view` capability. Navigation surfaces hide the workspace from
 * sessions without it; a session that deep-links here gets the standard
 * access explanation, not an error page.
 *
 * Architecture: Business → ViewModel → Components → DOM. `collectViewModel`
 * is the single place this workspace reads business data, and it reads
 * only through the Repository Foundation (Issue #34).
 *
 * Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** Shared Workspace Platform (Issue #27). */
  var WS = AuditOS.workspaceShared || {};

  /** The Shared Workspace Framework slots this workspace fills directly. */
  var SLOTS = {
    CONTENT: 'primary-content',
    RELATED: 'related-information',
    AI: 'ai-recommendations',
    ACTIVITY: 'activity',
    FOOTER: 'workspace-footer'
  };

  /** Presentation tones shared by badges, markers, and rails. */
  var TONES = WS.TONES;

  /** The capability that gates this workspace (Permission Foundation). */
  var VIEW_CAPABILITY = 'ai-usage.view';

  /** Aggregation granularities (Issue #34 — Daily/Weekly/Monthly). */
  var GRANULARITIES = ['daily', 'weekly', 'monthly'];

  /** Heatmap intensity levels (sequential single-hue ramp, tokens in CSS). */
  var HEAT_LEVELS = 5;

  /** Memory-only presentation state: the trend aggregation granularity. */
  var presentationState = { granularity: 'daily' };

  /** Returns the value when it is an array, otherwise an empty array. */
  var asArray = WS.asArray;

  // ------------------------------------------------------------------
  // Pure aggregation — no DOM, no repository access. Every figure derives
  // from the telemetry events; nothing is hardcoded.
  // ------------------------------------------------------------------

  /** Rounds to two decimals for currency display. */
  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  /** An empty rollup accumulator. */
  function emptyTotals() {
    return {
      calls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
      latencyMsTotal: 0, retries: 0, failures: 0,
      accepted: 0, rejected: 0, edited: 0,
      confidenceTotal: 0, confidenceCount: 0,
      qualityTotal: 0, qualityCount: 0,
      hoursSaved: 0, billableCostUsd: 0, internalCostUsd: 0
    };
  }

  /** Accumulates one telemetry event into a rollup. */
  function accumulate(totals, event) {
    var tokens = event.tokens || {};
    totals.calls += 1;
    totals.costUsd += event.costUsd || 0;
    totals.inputTokens += tokens.input || 0;
    totals.outputTokens += tokens.output || 0;
    totals.cacheReadTokens += tokens.cacheRead || 0;
    totals.latencyMsTotal += event.latencyMs || 0;
    totals.retries += event.retries || 0;
    if (event.failed) { totals.failures += 1; }
    if (event.outcome === 'accepted') { totals.accepted += 1; }
    if (event.outcome === 'rejected') { totals.rejected += 1; }
    if (event.outcome === 'edited' || event.humanEdited) { totals.edited += 1; }
    if (typeof event.confidence === 'number') {
      totals.confidenceTotal += event.confidence;
      totals.confidenceCount += 1;
    }
    if (typeof event.qualityScore === 'number') {
      totals.qualityTotal += event.qualityScore;
      totals.qualityCount += 1;
    }
    totals.hoursSaved += event.estimatedHoursSaved || 0;
    if (event.billable) {
      totals.billableCostUsd += event.costUsd || 0;
    } else {
      totals.internalCostUsd += event.costUsd || 0;
    }
    return totals;
  }

  /** Aggregates a set of events into one rollup with derived rates. */
  function aggregateTotals(events, blendedHourlyRateUsd) {
    var totals = asArray(events).reduce(accumulate, emptyTotals());
    var tokensProcessed = totals.inputTokens + totals.outputTokens;
    var rate = typeof blendedHourlyRateUsd === 'number' ? blendedHourlyRateUsd : null;
    var savedValue = rate !== null ? totals.hoursSaved * rate : null;
    return {
      calls: totals.calls,
      costUsd: round2(totals.costUsd),
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      totalTokens: tokensProcessed,
      cacheReadTokens: totals.cacheReadTokens,
      cacheHitRate: totals.inputTokens > 0
        ? Math.round((totals.cacheReadTokens / totals.inputTokens) * 100) : 0,
      averageLatencyMs: totals.calls > 0
        ? Math.round(totals.latencyMsTotal / totals.calls) : 0,
      retries: totals.retries,
      failures: totals.failures,
      accepted: totals.accepted,
      rejected: totals.rejected,
      edited: totals.edited,
      acceptanceRate: totals.calls > 0
        ? Math.round((totals.accepted / totals.calls) * 100) : 0,
      averageConfidence: totals.confidenceCount > 0
        ? Math.round((totals.confidenceTotal / totals.confidenceCount) * 100) / 100 : null,
      averageQuality: totals.qualityCount > 0
        ? Math.round((totals.qualityTotal / totals.qualityCount) * 10) / 10 : null,
      hoursSaved: Math.round(totals.hoursSaved * 10) / 10,
      billableCostUsd: round2(totals.billableCostUsd),
      internalCostUsd: round2(totals.internalCostUsd),
      // ROI derives from the dataset's own recorded assumption, never a
      // hardcoded rate: (value of hours saved − cost) / cost.
      estimatedValueUsd: savedValue !== null ? round2(savedValue) : null,
      roi: savedValue !== null && totals.costUsd > 0
        ? Math.round(((savedValue - totals.costUsd) / totals.costUsd) * 100) : null
    };
  }

  /** Groups events by a key function into ordered `{ key, events }` buckets. */
  function groupBy(events, keyOf) {
    var buckets = {};
    var order = [];
    asArray(events).forEach(function (event) {
      var key = keyOf(event);
      if (key === null || key === undefined || key === '') {
        return;
      }
      if (!buckets[key]) {
        buckets[key] = [];
        order.push(key);
      }
      buckets[key].push(event);
    });
    return order.map(function (key) {
      return { key: key, events: buckets[key] };
    });
  }

  /** The ISO week key (YYYY-Www) of an ISO date. */
  function isoWeekKey(isoDate) {
    var parts = String(isoDate || '').split('-').map(Number);
    if (parts.length < 3 || parts.some(isNaN)) {
      return '';
    }
    var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    var day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    var week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    return date.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
  }

  /** The period key of an event for a granularity: day, ISO week, or month. */
  function periodKey(event, granularity) {
    var date = event.date || String(event.timestamp || '').slice(0, 10);
    if (granularity === 'weekly') {
      return isoWeekKey(date);
    }
    if (granularity === 'monthly') {
      return date.slice(0, 7);
    }
    return date;
  }

  /**
   * The trend series for a granularity: one point per period in ascending
   * order, each carrying calls and cost (Issue #34 — trend charts with
   * daily / weekly / monthly aggregation).
   */
  function aggregateTrend(events, granularity) {
    return groupBy(events, function (event) {
      return periodKey(event, granularity);
    }).sort(function (a, b) {
      return a.key.localeCompare(b.key);
    }).map(function (bucket) {
      var totals = aggregateTotals(bucket.events);
      return { period: bucket.key, calls: totals.calls, costUsd: totals.costUsd };
    });
  }

  /** Per-dimension rollups (model, provider, workspace, agent, …), largest cost first. */
  function aggregateByDimension(events, keyOf) {
    return groupBy(events, keyOf).map(function (bucket) {
      return { key: bucket.key, totals: aggregateTotals(bucket.events) };
    }).sort(function (a, b) {
      return b.totals.costUsd - a.totals.costUsd;
    });
  }

  /**
   * The hierarchy rollup (Issue #34): usage aggregated automatically across
   * Platform → Client → Program → Engagement → Requirement → Control →
   * Evidence, from the attribution each event carries.
   */
  function aggregateHierarchy(events) {
    return {
      platform: aggregateTotals(events),
      clients: aggregateByDimension(events, function (e) { return e.companyId; }),
      programs: aggregateByDimension(events, function (e) { return e.programId; }),
      engagements: aggregateByDimension(events, function (e) { return e.engagementId; }),
      requirements: aggregateByDimension(events, function (e) { return e.requirementId; }),
      controls: aggregateByDimension(events, function (e) { return e.controlId; }),
      evidence: aggregateByDimension(events, function (e) { return e.evidenceId; })
    };
  }

  /**
   * The workspace × day heatmap (Issue #34): one row per workspace, one
   * cell per day, each carrying its cost, its calls, and a sequential
   * intensity level 0–5 scaled to the busiest cell.
   */
  function aggregateHeatmap(events) {
    var days = groupBy(events, function (event) {
      return periodKey(event, 'daily');
    }).map(function (bucket) { return bucket.key; }).sort();
    var workspaces = groupBy(events, function (event) {
      return event.workspaceId;
    }).map(function (bucket) { return bucket.key; }).sort();

    var cells = {};
    var maxCost = 0;
    asArray(events).forEach(function (event) {
      var key = event.workspaceId + '|' + periodKey(event, 'daily');
      if (!cells[key]) {
        cells[key] = { costUsd: 0, calls: 0 };
      }
      cells[key].costUsd += event.costUsd || 0;
      cells[key].calls += 1;
      if (cells[key].costUsd > maxCost) {
        maxCost = cells[key].costUsd;
      }
    });

    return {
      days: days,
      workspaces: workspaces,
      rows: workspaces.map(function (workspaceId) {
        return {
          workspaceId: workspaceId,
          cells: days.map(function (day) {
            var cell = cells[workspaceId + '|' + day] || { costUsd: 0, calls: 0 };
            return {
              day: day,
              costUsd: round2(cell.costUsd),
              calls: cell.calls,
              level: maxCost > 0 && cell.costUsd > 0
                ? Math.max(1, Math.ceil((cell.costUsd / maxCost) * HEAT_LEVELS)) : 0
            };
          })
        };
      })
    };
  }

  // ------------------------------------------------------------------
  // View model — reads only through the Repository Foundation.
  // ------------------------------------------------------------------

  /**
   * Collects everything the telemetry workspace presents. `filters` is the
   * memory-only presentation state (trend granularity). Returns null while
   * the repository is not ready.
   */
  function collectViewModel(repository, workspaceRegistry, permissions, filters) {
    if (!repository || !repository.isReady()) {
      return null;
    }
    var filterState = filters || { granularity: 'daily' };
    var telemetryDocument = repository.telemetry.getDocument() || {};
    var metadata = telemetryDocument.metadata || {};
    var assumptions = metadata.assumptions || {};
    var events = repository.telemetry.list();
    var companiesById = WS.indexById(repository.clients.list());
    var engagementsById = WS.indexById(repository.engagements.list());
    var programsById = WS.indexById(repository.programs.list());

    var totals = aggregateTotals(events, assumptions.blendedHourlyRateUsd);
    var hierarchy = aggregateHierarchy(events);

    return {
      events: events,
      metadata: metadata,
      assumptions: assumptions,
      totals: totals,
      byModel: aggregateByDimension(events, function (e) { return e.model; }),
      byProvider: aggregateByDimension(events, function (e) { return e.provider; }),
      byWorkspace: aggregateByDimension(events, function (e) { return e.workspaceId; }),
      byAgent: aggregateByDimension(events, function (e) { return e.agent; }),
      trend: aggregateTrend(events, filterState.granularity),
      granularity: filterState.granularity,
      heatmap: aggregateHeatmap(events),
      hierarchy: hierarchy,
      companiesById: companiesById,
      engagementsById: engagementsById,
      programsById: programsById,

      header: {
        eyebrow: 'Platform administration',
        meta: 'AI operational telemetry and spend accounting — every figure aggregated live from the JSON-backed telemetry events, nothing hardcoded.'
      },
      ribbon: [
        { label: 'AI calls', value: String(totals.calls) },
        { label: 'Cost', value: '$' + totals.costUsd.toFixed(2) },
        { label: 'Tokens', value: totals.totalTokens.toLocaleString('en-US') },
        { label: 'Acceptance', value: totals.acceptanceRate + '%' },
        { label: 'Hours saved', value: String(totals.hoursSaved) }
      ],
      footer: [
        { label: 'Environment', value: 'Static prototype' },
        { label: 'Telemetry events', value: String(events.length) },
        {
          label: 'Period',
          value: metadata.period
            ? metadata.period.startDate + ' – ' + metadata.period.endDate : ''
        }
      ]
    };
  }

  // ------------------------------------------------------------------
  // DOM builders
  // ------------------------------------------------------------------

  /** Creates an element with a class and optional text content. */
  var el = WS.el;

  /** Replaces a slot's content with the given nodes (or clears it). */
  var fillSlot = WS.fillSlot;

  /** Builds one Section component with this workspace's class prefix. */
  function buildSection(id, meta, bodyNode) {
    return WS.buildSection('aos-ai-usage', id, meta, bodyNode);
  }

  /** Builds the Overview body: the complete rollup as labeled figures. */
  function buildOverviewBody(model) {
    var P = WS.presentation();
    var totals = model.totals;
    var surface = el('div', 'aos-surface aos-surface--padded aos-ai-usage__overview');
    surface.appendChild(P.propertyGrid([
      { label: 'AI calls', value: String(totals.calls) },
      { label: 'Total cost', value: '$' + totals.costUsd.toFixed(2) },
      { label: 'Input tokens', value: totals.inputTokens.toLocaleString('en-US') },
      { label: 'Output tokens', value: totals.outputTokens.toLocaleString('en-US') },
      { label: 'Cache hit rate', value: totals.cacheHitRate + '%' },
      { label: 'Average latency', value: totals.averageLatencyMs + ' ms' },
      { label: 'Retries', value: String(totals.retries) },
      { label: 'Failures', value: String(totals.failures) },
      { label: 'Accepted', value: totals.accepted + ' (' + totals.acceptanceRate + '%)' },
      { label: 'Rejected', value: String(totals.rejected) },
      { label: 'Human edits', value: String(totals.edited) },
      { label: 'Average confidence', value: totals.averageConfidence !== null ? String(totals.averageConfidence) : 'Not recorded' },
      { label: 'Average quality', value: totals.averageQuality !== null ? totals.averageQuality + ' / 5' : 'Not recorded' },
      { label: 'Estimated hours saved', value: String(totals.hoursSaved) },
      { label: 'Internal AI cost', value: '$' + totals.internalCostUsd.toFixed(2) },
      { label: 'Client-billable AI cost', value: '$' + totals.billableCostUsd.toFixed(2) },
      {
        label: 'Estimated ROI',
        value: totals.roi !== null
          ? totals.roi + '% (at the $' + model.assumptions.blendedHourlyRateUsd + '/h rate the dataset records)'
          : 'No rate assumption recorded'
      }
    ], { columns: 3 }));
    return surface;
  }

  /**
   * Builds one single-series bar chart: thin marks in the primary hue, one
   * measure, one axis, per-mark accessible names, selective direct labels
   * (first, busiest, last). The adjacent rollup lists carry the same
   * numbers as text.
   */
  function buildBarChart(title, unit, points, valueOf, format) {
    var chart = el('div', 'aos-ai-usage__chart');
    chart.setAttribute('role', 'group');
    chart.setAttribute('aria-label', title);

    var max = 0;
    var maxIndex = -1;
    points.forEach(function (point, index) {
      var value = valueOf(point);
      if (value > max) {
        max = value;
        maxIndex = index;
      }
    });

    var plot = el('div', 'aos-ai-usage__plot');
    points.forEach(function (point, index) {
      var value = valueOf(point);
      var column = el('div', 'aos-ai-usage__column');
      var bar = el('span', 'aos-ai-usage__bar');
      bar.style.height = max > 0 ? Math.max(2, Math.round((value / max) * 100)) + '%' : '2%';
      bar.setAttribute('role', 'img');
      bar.setAttribute('aria-label', point.period + ': ' + format(value) + ' ' + unit);
      bar.setAttribute('title', point.period + ' · ' + format(value) + ' ' + unit);
      column.appendChild(bar);
      // Selective direct labels: first, busiest, and last periods only.
      if (index === 0 || index === maxIndex || index === points.length - 1) {
        column.appendChild(el('span', 'aos-ai-usage__bar-value aos-numeric', format(value)));
        column.appendChild(el('span', 'aos-ai-usage__bar-label', point.period.slice(5)));
      }
      plot.appendChild(column);
    });
    chart.appendChild(el('p', 'aos-ai-usage__chart-title', title));
    chart.appendChild(plot);
    return chart;
  }

  /** Builds the Trend body: cost and call charts plus the granularity switch. */
  function buildTrendBody(model) {
    var wrap = el('div', 'aos-ai-usage__trend');

    var controls = el('div', 'aos-ai-usage__trend-controls');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Aggregation');
    GRANULARITIES.forEach(function (granularity) {
      var selected = granularity === model.granularity;
      var chip = el('button', 'aos-chip' + (selected ? ' aos-chip--selected' : ''),
        granularity.charAt(0).toUpperCase() + granularity.slice(1));
      chip.setAttribute('type', 'button');
      chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
      chip.addEventListener('click', function () {
        presentationState.granularity = granularity;
        renderActiveAiUsage();
      });
      controls.appendChild(chip);
    });
    wrap.appendChild(controls);

    var charts = el('div', 'aos-ai-usage__charts');
    charts.appendChild(buildBarChart('Cost per period', 'USD', model.trend,
      function (point) { return point.costUsd; },
      function (value) { return '$' + value.toFixed(2); }));
    charts.appendChild(buildBarChart('Calls per period', 'calls', model.trend,
      function (point) { return point.calls; },
      function (value) { return String(value); }));
    wrap.appendChild(charts);
    return wrap;
  }

  /** Builds a rollup list body from `{ key, totals }` entries. */
  function buildRollupList(entries, resolveTitle) {
    var P = WS.presentation();
    return P.itemList(entries.map(function (entry) {
      return {
        title: resolveTitle ? resolveTitle(entry.key) : entry.key,
        description: entry.totals.calls + ' calls · ' +
          entry.totals.totalTokens.toLocaleString('en-US') + ' tokens · ' +
          entry.totals.acceptanceRate + '% accepted',
        meta: '$' + entry.totals.costUsd.toFixed(2),
        tone: TONES.INFO
      };
    }), { compact: true });
  }

  /** Builds the Models & Providers body. */
  function buildModelsBody(model) {
    var wrap = el('div', 'aos-ai-usage__split');
    var models = el('div', 'aos-surface aos-surface--padded');
    models.appendChild(el('p', 'aos-ai-usage__subtitle', 'Models'));
    models.appendChild(buildRollupList(model.byModel));
    wrap.appendChild(models);
    var providers = el('div', 'aos-surface aos-surface--padded');
    providers.appendChild(el('p', 'aos-ai-usage__subtitle', 'Providers'));
    providers.appendChild(buildRollupList(model.byProvider));
    wrap.appendChild(providers);
    return wrap;
  }

  /**
   * Builds the workspace × day heatmap: a sequential single-hue ramp from
   * the design tokens, each cell carrying its full accessible name. The
   * per-workspace rollup beside it is the table view of the same numbers.
   */
  function buildHeatmapBody(model) {
    var wrap = el('div', 'aos-ai-usage__heat-wrap');
    var heatmap = model.heatmap;

    var grid = el('div', 'aos-ai-usage__heatmap');
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'AI cost by workspace and day');
    heatmap.rows.forEach(function (row) {
      var line = el('div', 'aos-ai-usage__heat-row');
      line.appendChild(el('span', 'aos-ai-usage__heat-label', row.workspaceId));
      var cellsWrap = el('div', 'aos-ai-usage__heat-cells');
      row.cells.forEach(function (cell) {
        var node = el('span', 'aos-ai-usage__heat-cell');
        node.setAttribute('data-level', String(cell.level));
        var description = row.workspaceId + ' · ' + cell.day + ' · $' +
          cell.costUsd.toFixed(2) + ' · ' + cell.calls + ' calls';
        node.setAttribute('role', 'img');
        node.setAttribute('aria-label', description);
        node.setAttribute('title', description);
        cellsWrap.appendChild(node);
      });
      line.appendChild(cellsWrap);
      grid.appendChild(line);
    });
    wrap.appendChild(grid);

    var table = el('div', 'aos-surface aos-surface--padded');
    table.appendChild(el('p', 'aos-ai-usage__subtitle', 'Workspace usage'));
    table.appendChild(buildRollupList(model.byWorkspace));
    wrap.appendChild(table);
    return wrap;
  }

  /** Builds the hierarchy rollup body: Platform → … → Evidence. */
  function buildHierarchyBody(model) {
    var wrap = el('div', 'aos-ai-usage__hierarchy');
    [
      { title: 'Clients', entries: model.hierarchy.clients, resolve: function (id) {
        return model.companiesById[id] ? model.companiesById[id].name : id;
      } },
      { title: 'Programs', entries: model.hierarchy.programs, resolve: function (id) {
        return model.programsById[id] ? model.programsById[id].name : id;
      } },
      { title: 'Engagements', entries: model.hierarchy.engagements, resolve: function (id) {
        return model.engagementsById[id] ? (model.engagementsById[id].name || id) : id;
      } },
      { title: 'Requirements', entries: model.hierarchy.requirements, resolve: null },
      { title: 'Controls', entries: model.hierarchy.controls, resolve: null },
      { title: 'Evidence', entries: model.hierarchy.evidence, resolve: null }
    ].forEach(function (level) {
      var block = el('div', 'aos-surface aos-surface--padded');
      block.appendChild(el('p', 'aos-ai-usage__subtitle', level.title));
      if (level.entries.length === 0) {
        block.appendChild(WS.presentation().emptyState({
          icon: '◇', title: 'No attributed usage',
          description: 'Telemetry events attributed at this level appear here.'
        }));
      } else {
        block.appendChild(buildRollupList(level.entries.slice(0, WS.LIST_LIMIT), level.resolve));
      }
      wrap.appendChild(block);
    });
    return wrap;
  }

  /** Builds the Agent execution body. */
  function buildAgentsBody(model) {
    var surface = el('div', 'aos-surface aos-surface--padded');
    surface.appendChild(buildRollupList(model.byAgent));
    return surface;
  }

  /** The ordered telemetry sections. */
  function primarySections(model) {
    return [
      { id: 'overview', kicker: 'Spend accounting', title: 'Usage overview',
        description: 'The complete telemetry rollup — aggregated from every recorded event, nothing hardcoded.',
        body: function () { return buildOverviewBody(model); } },
      { id: 'trend', kicker: 'Over time', title: 'Usage trends',
        description: 'Cost and call volume per period, aggregated daily, weekly, or monthly.',
        body: function () { return buildTrendBody(model); } },
      { id: 'models', kicker: 'Execution', title: 'Models and providers',
        body: function () { return buildModelsBody(model); } },
      { id: 'heatmap', kicker: 'Where AI works', title: 'Workspace usage heatmap',
        description: 'AI cost by workspace and day on a sequential single-hue scale; the rollup beside it carries the same numbers as text.',
        body: function () { return buildHeatmapBody(model); } },
      { id: 'hierarchy', kicker: 'Attribution', title: 'Hierarchy rollup',
        description: 'Usage aggregated automatically across Platform → Client → Program → Engagement → Requirement → Control → Evidence.',
        body: function () { return buildHierarchyBody(model); } },
      { id: 'agents', kicker: 'Agent execution', title: 'Agents',
        body: function () { return buildAgentsBody(model); } }
    ];
  }

  /** Renders the ready telemetry experience into the framework slots. */
  function renderReady(view, model, workspaceRegistry) {
    var P = WS.presentation();

    AuditOS.workspaceFramework.configure(view, {
      shell: 'single',
      header: model.header,
      contextSummary: model.ribbon
    });

    var canvas = el('div', 'aos-ai-usage');
    canvas.setAttribute('data-canvas', 'flush');
    var rendered = 0;
    primarySections(model).forEach(function (section) {
      var built = buildSection(section.id, section, section.body());
      built.classList.add('aos-rise-in');
      if (rendered > 0) {
        built.classList.add('aos-rise-in--' + Math.min(rendered, WS.STAGGER_LIMIT));
      }
      rendered += 1;
      canvas.appendChild(built);
    });
    fillSlot(view, SLOTS.CONTENT, [canvas]);

    var related = WS.buildRelatedBody(WS.resolveRelationships(workspaceRegistry, [
      { id: workspaceRegistry.IDS.AUDIT_LOG, title: 'Audit log', meta: '', present: true },
      { id: workspaceRegistry.IDS.CLIENT, title: 'Client dashboard', meta: '', present: true }
    ]), { icon: '◇', title: 'No related objects', description: 'Related destinations appear here.' });
    related.classList.add('aos-fade-in');
    fillSlot(view, SLOTS.RELATED, [related]);

    var ai = P.emptyState({
      icon: '✦', title: 'Reserved for AI advisory',
      description: 'Cost anomaly and budget recommendations arrive with the AI foundation. AI remains advisory; human approval remains mandatory.'
    });
    ai.classList.add('aos-tint-brand', 'aos-fade-in');
    fillSlot(view, SLOTS.AI, [ai]);

    fillSlot(view, SLOTS.FOOTER, [WS.buildFooterItems('aos-ai-usage', model.footer)]);
  }

  /** Renders the gated experience for sessions without the capability. */
  function renderDenied(view, denial) {
    var P = WS.presentation();
    AuditOS.workspaceFramework.configure(view, {
      shell: 'single',
      header: { eyebrow: 'Platform administration', meta: 'AI operational telemetry and spend accounting.' }
    });
    var gate = el('div', 'aos-ai-usage__denied');
    gate.appendChild(WS.buildPermissionNotice(denial, ''));
    gate.appendChild(P.emptyState({
      icon: '◇', title: 'AI Usage is platform administration data',
      description: denial.reason
    }));
    fillSlot(view, SLOTS.CONTENT, [gate]);
  }

  // ------------------------------------------------------------------
  // Wiring
  // ------------------------------------------------------------------

  /** Renders the telemetry workspace when it is the active workspace. */
  function renderActiveAiUsage() {
    var registry = AuditOS.workspaceRegistry;
    var router = AuditOS.router;
    var repository = AuditOS.repository;
    if (!registry || !router || !AuditOS.workspaceFramework || !AuditOS.presentation) {
      return;
    }
    if (router.getCurrentWorkspaceId() !== registry.IDS.AI_USAGE) {
      return;
    }
    var view = global.document.querySelector(
      '.aos-workspace-view[data-workspace="' + registry.IDS.AI_USAGE + '"]');
    if (!view) {
      return;
    }

    var permissions = AuditOS.permissions;
    var denial = permissions ? permissions.explainDenial(VIEW_CAPABILITY) : null;
    if (denial) {
      renderDenied(view, denial);
      return;
    }

    var model = collectViewModel(repository, registry, permissions, presentationState);
    if (!model) {
      fillSlot(view, SLOTS.CONTENT, [WS.presentation().loadingState({ variant: 'cards', label: 'Loading telemetry' })]);
      return;
    }
    renderReady(view, model, registry);
  }

  AuditOS.aiUsageWorkspace = {
    SLOTS: SLOTS,
    VIEW_CAPABILITY: VIEW_CAPABILITY,
    GRANULARITIES: GRANULARITIES,

    // Pure, offline-testable aggregations.
    derivations: {
      aggregateTotals: aggregateTotals,
      aggregateTrend: aggregateTrend,
      aggregateByDimension: aggregateByDimension,
      aggregateHierarchy: aggregateHierarchy,
      aggregateHeatmap: aggregateHeatmap,
      isoWeekKey: isoWeekKey,
      periodKey: periodKey
    },

    collectViewModel: collectViewModel,

    /**
     * Binds the telemetry workspace to the router and the platform
     * foundations. Safe to call once, after the DOM is ready, the router
     * has resolved the initial route, and the framework has rendered its
     * skeleton. Does nothing when the routing foundation is absent, so the
     * shell degrades rather than throwing.
     */
    init: function () {
      var router = AuditOS.router;
      var state = AuditOS.state;
      if (!AuditOS.workspaceRegistry || !router) {
        return;
      }
      global.document.addEventListener(router.ROUTE_CHANGED_EVENT, renderActiveAiUsage);
      if (state && typeof state.subscribe === 'function') {
        state.subscribe(state.EVENTS.STATE_LOADED, renderActiveAiUsage);
        state.subscribe(state.EVENTS.STATE_CHANGED, renderActiveAiUsage);
        state.subscribe(state.EVENTS.STATE_RESET, renderActiveAiUsage);
      }
      if (AuditOS.permissions && typeof AuditOS.permissions.subscribe === 'function') {
        AuditOS.permissions.subscribe(renderActiveAiUsage);
      }
      renderActiveAiUsage();
    }
  };

  // Self-initialize after the DOM is ready. Guarded so the module can load in
  // the offline test sandbox, where no document exists.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', AuditOS.aiUsageWorkspace.init);
    } else {
      AuditOS.aiUsageWorkspace.init();
    }
  }
})(window);
