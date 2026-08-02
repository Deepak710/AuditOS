/**
 * AuditOS Workpaper Export
 * AI Workpaper Foundation — GitHub Issue #40 §6
 *
 * The two serializations of one workpaper model: the HTML workpaper (§6 —
 * "Generate equivalent HTML workpaper") and the Excel workbook (§6 —
 * "Provide Download Excel button. If export implementation is simple, build
 * it"). Both read the model the Workpaper Service builds; neither re-derives a
 * single audit fact, so the screen, the document, and the workbook can never
 * disagree about what the workpaper says.
 *
 * The workbook mirrors the CSC-01 structure the issue names as the template —
 * Title Sheet, Population IPE, WT Test Sheet, OE Test Sheet — plus the two
 * sheets AuditOS adds because it has data the spreadsheet never did: the full
 * evidence register behind the control, and the AI provenance of every
 * generated block. The HTML document renders the same sections in order.
 *
 * The HTML document is self-contained (inline styles, no script, no external
 * request), so it opens by double-click on a machine with only a browser —
 * the same portability contract as the prototype itself.
 *
 * Pure serialization: no DOM reads, no `AuditOS.state`, no writes. The only
 * browser touch is delegated to the Workbook Export service's download helper.
 *
 * Depends on nothing in components/, keeping the js → components boundary
 * one-way. Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** The Workbook Export service, resolved at call time so load order stays flexible. */
  function workbook() {
    return AuditOS.workbookExport || null;
  }

  /** Cell style indices, mirroring the workbook writer's registered formats. */
  function styles() {
    var service = workbook();
    return service ? service.STYLES : { DEFAULT: 0, HEADER: 1, WRAP: 2, TITLE: 3 };
  }

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** Escapes HTML text. Every value written into the document goes through this. */
  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Escapes text and turns newlines into line breaks, preserving recorded formatting. */
  function escapeMultiline(value) {
    return escapeHtml(value).replace(/\r?\n/g, '<br>');
  }

  /** A file-name-safe slug of an identifier. */
  function slug(value) {
    return String(value || 'workpaper').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'workpaper';
  }

  /** The section of a workpaper model with the given id, or null. */
  function sectionById(model, id) {
    return asArray(model && model.sections).filter(function (section) {
      return section.id === id;
    })[0] || null;
  }

  // ------------------------------------------------------------------
  // HTML workpaper
  // ------------------------------------------------------------------

  /**
   * The document stylesheet. Inlined rather than linked so the exported file
   * stays a single portable artifact; deliberately plain and print-friendly,
   * because a workpaper is an audit document, not an application screen.
   */
  var DOCUMENT_STYLE = [
    'body{font-family:"Segoe UI",Arial,sans-serif;font-size:13px;line-height:1.5;color:#1b1f24;margin:0;padding:32px;background:#fff}',
    'h1{font-size:20px;margin:0 0 4px}',
    'h2{font-size:14px;margin:28px 0 8px;padding-bottom:4px;border-bottom:1px solid #d5dbe3;text-transform:uppercase;letter-spacing:.04em}',
    '.aos-doc__eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#5b6672;margin:0 0 4px}',
    '.aos-doc__meta{color:#5b6672;margin:0 0 24px}',
    'table{border-collapse:collapse;width:100%;margin:0 0 8px}',
    'th,td{border:1px solid #d5dbe3;padding:6px 8px;text-align:left;vertical-align:top}',
    'th{background:#eff3f8;font-weight:600;width:26%}',
    'table.aos-doc__grid th{width:auto;background:#eff3f8}',
    'p{margin:0 0 8px;white-space:normal}',
    '.aos-doc__empty{color:#6b7684;font-style:italic}',
    '.aos-doc__provenance{margin:4px 0 0;padding:8px 10px;background:#f7f9fc;border-left:3px solid #b9c4d2;font-size:12px}',
    '.aos-doc__provenance-title{font-weight:600;margin:0 0 4px}',
    '.aos-doc__provenance ul{margin:0;padding-left:18px}',
    '.aos-doc__provenance li.aos-doc__absent{color:#6b7684}',
    '.aos-doc__footer{margin-top:32px;padding-top:12px;border-top:1px solid #d5dbe3;color:#6b7684;font-size:11px}',
    '@media print{body{padding:0}h2{page-break-after:avoid}table{page-break-inside:avoid}}'
  ].join('');

  /** Renders one section's provenance block (§4). */
  function provenanceHtml(section) {
    var sources = asArray(section.provenance);
    if (sources.length === 0) {
      return '';
    }
    var items = sources.map(function (entry) {
      var detail = entry.present && entry.items.length > 0
        ? entry.items.map(function (fact) {
          return escapeHtml([fact.title, fact.detail].filter(Boolean).join(' — '));
        }).join('; ')
        : 'Not recorded';
      return '<li' + (entry.present ? '' : ' class="aos-doc__absent"') + '><strong>' +
        escapeHtml(entry.label) + ':</strong> ' + detail + '</li>';
    }).join('');
    return '<div class="aos-doc__provenance"><p class="aos-doc__provenance-title">Generated from</p><ul>' +
      items + '</ul></div>';
  }

  /** Renders one section body by kind. */
  function sectionBodyHtml(section) {
    if (!section.present) {
      return '<p class="aos-doc__empty">' + escapeHtml(section.empty ? section.empty.description : 'Not recorded.') + '</p>';
    }
    switch (section.kind) {
      case 'properties':
        return '<table><tbody>' + asArray(section.rows).map(function (row) {
          return '<tr><th>' + escapeHtml(row.label) + '</th><td>' + escapeMultiline(row.value) + '</td></tr>';
        }).join('') + '</tbody></table>';

      case 'text':
        return '<p>' + escapeMultiline(section.text) + '</p>';

      case 'narrative':
        return (section.text ? '<p>' + escapeMultiline(section.text) + '</p>' : '') +
          (asArray(section.items).length > 0
            ? '<table class="aos-doc__grid"><thead><tr><th>Session</th><th>Recorded</th></tr></thead><tbody>' +
              section.items.map(function (item) {
                return '<tr><td>' + escapeHtml(item.title) + '</td><td>' + escapeHtml(item.description) + '</td></tr>';
              }).join('') + '</tbody></table>'
            : '');

      case 'evidence':
        return '<table class="aos-doc__grid"><thead><tr><th>Reference</th><th>Evidence</th><th>Type</th>' +
          '<th>Status</th><th>Lifecycle</th><th>Owner</th></tr></thead><tbody>' +
          asArray(section.rows).map(function (row) {
            return '<tr><td>' + escapeHtml(row.id) + '</td><td>' + escapeHtml(row.title) +
              '</td><td>' + escapeHtml(row.evidenceType) + '</td><td>' + escapeHtml(row.status) +
              '</td><td>' + escapeHtml(row.phase) + '</td><td>' + escapeHtml(row.owner) + '</td></tr>';
          }).join('') + '</tbody></table>';

      case 'attributes':
        return '<table class="aos-doc__grid"><thead><tr><th>Attribute</th><th>Attribute details</th>' +
          '<th>Result</th></tr></thead><tbody>' +
          asArray(section.rows).map(function (row) {
            return '<tr><td>' + escapeHtml(row.key) + '</td><td>' + escapeMultiline(row.text) +
              '</td><td>' + escapeHtml(row.result) + '</td></tr>';
          }).join('') + '</tbody></table>';

      case 'list':
        return '<ul>' + asArray(section.items).map(function (item) {
          return '<li>' + escapeHtml(item.title) +
            (item.description ? ' — ' + escapeHtml(item.description) : '') + '</li>';
        }).join('') + '</ul>';

      case 'conclusion':
        return (asArray(section.rows).length > 0
          ? '<table><tbody>' + section.rows.map(function (row) {
            return '<tr><th>' + escapeHtml(row.label) + '</th><td>' + escapeHtml(row.value) + '</td></tr>';
          }).join('') + '</tbody></table>'
          : '') +
          (section.text ? '<p>' + escapeMultiline(section.text) + '</p>' : '');

      default:
        return '<p class="aos-doc__empty">Not recorded.</p>';
    }
  }

  /**
   * Builds the complete, self-contained HTML workpaper document for one
   * workpaper model. `context` supplies only the document's own framing —
   * the client and engagement names it was generated for.
   */
  function toHtml(model, context) {
    var ctx = context || {};
    var source = model || {};
    var heading = [source.controlCode, source.title].filter(Boolean).join(' — ');
    var meta = [
      ctx.clientName,
      ctx.engagementName,
      source.workpaperId ? 'Workpaper ' + source.workpaperId : '',
      source.status && source.status.label ? 'Status: ' + source.status.label : ''
    ].filter(Boolean).join(' · ');

    var body = asArray(source.sections).map(function (section) {
      return '<section><h2>' + escapeHtml(section.title) + '</h2>' +
        sectionBodyHtml(section) + provenanceHtml(section) + '</section>';
    }).join('');

    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + escapeHtml(heading || 'Audit workpaper') + '</title>\n' +
      '<style>' + DOCUMENT_STYLE + '</style>\n</head>\n<body>\n' +
      '<p class="aos-doc__eyebrow">Audit workpaper</p>\n' +
      '<h1>' + escapeHtml(heading || 'Audit workpaper') + '</h1>\n' +
      '<p class="aos-doc__meta">' + escapeHtml(meta) + '</p>\n' +
      body +
      '\n<p class="aos-doc__footer">Generated by AuditOS from the recorded engagement data. ' +
      'Sections with no recorded data are marked as such; nothing in this document is inferred. ' +
      'AI provenance accompanies each generated block and is not editable.</p>\n' +
      '</body>\n</html>\n';
  }

  // ------------------------------------------------------------------
  // Excel workbook — the CSC-01 sheet structure
  // ------------------------------------------------------------------

  /** A `[label, value]` row pair styled as a workbook property row. */
  function propertyRows(section) {
    var S = styles();
    return asArray(section && section.rows).map(function (row) {
      return [{ value: row.label, style: S.HEADER }, { value: row.value, style: S.WRAP }];
    });
  }

  /** A blank spacer row. */
  function spacer() {
    return [];
  }

  /** A section heading row. */
  function headingRow(title) {
    return [{ value: title, style: styles().TITLE }];
  }

  /** A narrative block: a heading, then the recorded text (or its absence). */
  function narrativeRows(section) {
    var S = styles();
    var rows = [headingRow(section.title)];
    if (section.present && section.text) {
      rows.push([{ value: section.text, style: S.WRAP }]);
    } else if (section.present && asArray(section.items).length > 0) {
      asArray(section.items).forEach(function (item) {
        rows.push([{ value: item.title, style: S.WRAP }, { value: item.description, style: S.WRAP }]);
      });
    } else {
      rows.push([{ value: 'Not recorded', style: S.WRAP }]);
    }
    return rows;
  }

  /**
   * Builds the workbook sheet model for one workpaper. The sheet set mirrors
   * the CSC-01 workbook and adds the two registers AuditOS holds that the
   * spreadsheet never did.
   */
  function toSheets(model) {
    var S = styles();
    var source = model || {};
    var title = sectionById(source, 'overview');
    var description = sectionById(source, 'control-description');
    var walkthrough = sectionById(source, 'walkthrough-summary');
    var objective = sectionById(source, 'testing-objective');
    var procedure = sectionById(source, 'testing-procedure');
    var population = sectionById(source, 'population');
    var evidence = sectionById(source, 'evidence-references');
    var attributes = sectionById(source, 'attributes');
    var exceptions = sectionById(source, 'exceptions');
    var conclusion = sectionById(source, 'conclusion');
    var notes = sectionById(source, 'reviewer-notes');
    var approval = sectionById(source, 'approval');

    // --- Title Sheet: engagement identity, control identity, sign-off ---
    var titleRows = [headingRow('Title Sheet'), spacer()]
      .concat(propertyRows(title))
      .concat([spacer(), headingRow('Approval')])
      .concat(propertyRows(approval));

    // --- Population IPE: the sampling basis, or its recorded inapplicability ---
    var populationRows = [headingRow('Population / IPE'), spacer()]
      .concat(population && population.present ? propertyRows(population)
        : [[{ value: 'No population recorded for this workpaper.', style: S.WRAP }]]);

    // --- WT Test Sheet: description, procedure, attributes, steps, conclusion ---
    var walkthroughRows = [headingRow('Walkthrough Test Sheet'), spacer()]
      .concat([[{ value: 'Control description', style: S.HEADER },
        { value: description && description.present ? description.text : 'Not recorded', style: S.WRAP }]])
      .concat([[{ value: 'Testing objective', style: S.HEADER },
        { value: objective && objective.present ? objective.text : 'Not recorded', style: S.WRAP }]])
      .concat([[{ value: 'Test procedure', style: S.HEADER },
        { value: procedure && procedure.present ? procedure.text : 'Not recorded', style: S.WRAP }]])
      .concat([spacer(), headingRow('Attributes'),
        [{ value: 'Attribute', style: S.HEADER }, { value: 'Attribute details', style: S.HEADER },
          { value: 'Result', style: S.HEADER }]])
      .concat(attributes && attributes.present
        ? attributes.rows.map(function (row) {
          return [{ value: row.key }, { value: row.text, style: S.WRAP }, { value: row.result }];
        })
        : [[{ value: 'No attributes recorded', style: S.WRAP }]])
      .concat([spacer()])
      .concat(narrativeRows(walkthrough || { title: 'Walkthrough summary', present: false }));

    // --- OE Test Sheet: effectiveness conclusions and exceptions ---
    var oeRows = [headingRow('Operating Effectiveness Test Sheet'), spacer()]
      .concat(population && population.present ? propertyRows(population) : [])
      .concat([spacer(), headingRow('Conclusion')])
      .concat(conclusion && conclusion.present
        ? propertyRows(conclusion).concat(conclusion.text
          ? [[{ value: 'Conclusion', style: S.HEADER }, { value: conclusion.text, style: S.WRAP }]] : [])
        : [[{ value: 'No conclusion recorded', style: S.WRAP }]])
      .concat([spacer(), headingRow('Exceptions')])
      .concat(exceptions && exceptions.present
        ? exceptions.items.map(function (item) {
          return [{ value: item.title, style: S.WRAP }, { value: item.description, style: S.WRAP }];
        })
        : [[{ value: 'No deviations recorded', style: S.WRAP }]])
      .concat([spacer(), headingRow('Reviewer notes')])
      .concat([[{ value: notes && notes.present ? notes.text : 'Not recorded', style: S.WRAP }]]);

    // --- Evidence references: every evidence item, never a count (§7) ---
    var evidenceRows = [[
      { value: 'Reference', style: S.HEADER }, { value: 'Evidence', style: S.HEADER },
      { value: 'Type', style: S.HEADER }, { value: 'Status', style: S.HEADER },
      { value: 'Lifecycle phase', style: S.HEADER }, { value: 'Owner', style: S.HEADER }
    ]].concat(evidence && evidence.present
      ? evidence.rows.map(function (row) {
        return [{ value: row.id }, { value: row.title, style: S.WRAP }, { value: row.evidenceType },
          { value: row.status }, { value: row.phase }, { value: row.owner }];
      })
      : [[{ value: 'No evidence linked to this control', style: S.WRAP }]]);

    // --- AI provenance: what each generated block was generated from (§4) ---
    var provenanceRows = [[
      { value: 'Section', style: S.HEADER }, { value: 'Generated from', style: S.HEADER },
      { value: 'Recorded basis', style: S.HEADER }
    ]];
    asArray(source.sections).forEach(function (section) {
      asArray(section.provenance).forEach(function (entry) {
        provenanceRows.push([
          { value: section.title },
          { value: entry.label },
          {
            value: entry.present
              ? entry.items.map(function (fact) {
                return [fact.title, fact.detail].filter(Boolean).join(' — ');
              }).join('; ')
              : 'Not recorded',
            style: S.WRAP
          }
        ]);
      });
    });

    return [
      { name: 'Title Sheet', rows: titleRows, columnWidths: [34, 78] },
      { name: 'Population IPE', rows: populationRows, columnWidths: [34, 78] },
      { name: 'WT Test Sheet', rows: walkthroughRows, columnWidths: [24, 78, 14] },
      { name: 'OE Test Sheet', rows: oeRows, columnWidths: [30, 78] },
      { name: 'Evidence References', rows: evidenceRows, columnWidths: [18, 60, 20, 22, 16, 24] },
      { name: 'AI Provenance', rows: provenanceRows, columnWidths: [24, 22, 78] }
    ];
  }

  /** The base file name for a workpaper export, without an extension. */
  function fileBaseName(model) {
    var source = model || {};
    return slug([source.controlCode || source.controlId, source.workpaperId].filter(Boolean).join('-') || 'workpaper');
  }

  AuditOS.workpaperExport = {
    // Pure serializers — offline-testable without a browser.
    toHtml: toHtml,
    toSheets: toSheets,
    fileBaseName: fileBaseName,
    escapeHtml: escapeHtml,

    /** Downloads the HTML workpaper. Returns false outside a browser. */
    downloadHtml: function (model, context) {
      var service = workbook();
      if (!service) {
        return false;
      }
      return service.downloadHtml(fileBaseName(model) + '.html', toHtml(model, context));
    },

    /** Downloads the Excel workbook. Returns false outside a browser. */
    downloadExcel: function (model) {
      var service = workbook();
      if (!service) {
        return false;
      }
      return service.downloadWorkbook(fileBaseName(model) + '.xlsx', toSheets(model));
    }
  };
})(window);
