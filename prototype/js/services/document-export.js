/**
 * AuditOS Document Export
 * Living Reporting & Operational Findings — GitHub Issue #41 (Report Export)
 *
 * The report, serialized. Three formats, one model, no Microsoft Office
 * dependency and no runtime dependency of any kind (AI Implementation Context /
 * CLAUDE.md — no npm, no CDN, no build step, must run from file://):
 *
 *  - **DOCX** — a real OOXML WordprocessingML package. A `.docx` is an XML part
 *    set inside a ZIP container, and the platform already owns a standards-
 *    correct STORE-method ZIP writer (`js/services/workbook-export.js`, built
 *    for `.xlsx` under Issue #40). This module writes the WordprocessingML
 *    parts and hands them to that same writer, so there is one ZIP
 *    implementation in the platform, not two.
 *
 *  - **PDF** — a real PDF 1.4 document, written directly. PDF is a byte format
 *    with a cross-reference table, not a package, so this module lays out pages
 *    itself: Helvetica and Helvetica-Bold (two of the base-14 fonts every
 *    conforming reader embeds, so no font file is needed), word-wrapped with
 *    the fonts' own AFM advance widths, tables ruled with path operators, and
 *    an accurate xref built from real byte offsets. Text is normalized to the
 *    printable Latin-1 range so one character is one byte and the offsets stay
 *    exact.
 *
 *  - **HTML** — a self-contained document (inline styles, no script, no
 *    external request), the same portability contract the Workpaper Export
 *    already keeps.
 *
 * Both binary writers consume one neutral `documentModel` produced by
 * `toDocumentModel` from the Report Generation Service's report model, so the
 * screen, the Word document, and the PDF can never disagree about what the
 * report says. Nothing is re-derived here and no audit fact is invented: a
 * section with no recorded content exports the same honest placeholder it
 * displays.
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

  /** The Workbook Export service (ZIP writer + download helper), resolved at call time. */
  function workbook() {
    return AuditOS.workbookExport || null;
  }

  /** Returns the value when it is an array, otherwise an empty array. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** Escapes the five XML entities. Text is never interpolated unescaped. */
  function escapeXml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /** Escapes HTML text. */
  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Strips the control characters XML 1.0 forbids, preserving tab/newline/return. */
  function stripControlChars(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }

  /** A file-name-safe slug. */
  function slug(value) {
    return String(value || 'report').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
  }

  // ------------------------------------------------------------------
  // Neutral document model — what every serializer reads.
  // ------------------------------------------------------------------

  /**
   * Maps the Report Generation Service's report model into the neutral document
   * model the serializers consume:
   *
   *   { title, subtitle, meta: [{ label, value }],
   *     sections: [{ numeral, heading, notices: [], paragraphs: [],
   *                  lineage: [], tables: [{ caption, columns, rows }] }],
   *     footer }
   *
   * Every value is copied from the report model; nothing is re-derived, so an
   * export can never state something the workspace does not show.
   */
  function toDocumentModel(report, context) {
    var source = report || {};
    var ctx = context || {};
    var period = source.reportingPeriod || {};

    var meta = [
      { label: 'Client', value: ctx.clientName || '' },
      { label: 'Engagement', value: ctx.engagementName || '' },
      { label: 'Report', value: source.reportId || '' },
      { label: 'Version', value: source.version || '' },
      { label: 'Status', value: source.status || '' },
      { label: 'Reporting period', value: [period.from, period.to].filter(Boolean).join(' to ') }
    ].filter(function (row) { return row.value; });

    var sections = asArray(source.sections).filter(function (section) {
      return section.included !== false;
    }).map(function (section) {
      return {
        numeral: section.numeral || '',
        heading: section.title || section.canonicalTitle || '',
        notices: [section.notAuditedNotice, section.generationNotice].filter(Boolean),
        paragraphs: buildSectionParagraphs(section),
        lineage: asArray(section.lineage).map(function (node) {
          return node.label + ': ' + (node.present ? String(node.count) : 'none recorded');
        }),
        tables: buildSectionTables(section)
      };
    });

    return {
      title: source.title || 'Audit report',
      subtitle: ctx.clientName || '',
      meta: meta,
      sections: sections,
      footer: 'Generated by AuditOS from the recorded engagement data. Sections with no recorded ' +
        'content are marked as such; nothing in this document is inferred. Section V is supplied by ' +
        'the entity and was not audited.'
    };
  }

  /**
   * The prose a section contributes to the export, in reading order: its
   * summary, the drafted narrative where one exists, and each recorded fact
   * block. A section that contributes no content of its own states its recorded
   * status instead — a Section I authored at issuance says "Recorded status:
   * Placeholder" rather than silently exporting as an empty heading, and a
   * section recording nothing at all says exactly that. Nothing is drafted in
   * either case.
   */
  function buildSectionParagraphs(section) {
    var paragraphs = [];
    if (section.summary) {
      paragraphs.push(section.summary);
    }
    if (section.narrative) {
      paragraphs.push(section.narrative);
    }
    asArray(section.blocks).forEach(function (block) {
      if (block && block.text) {
        paragraphs.push(block.label ? block.label + '. ' + block.text : block.text);
      }
    });
    var hasContent = Boolean(section.narrative) ||
      asArray(section.blocks).length > 0 ||
      asArray(section.rows).length > 0 ||
      asArray(section.registers).length > 0;
    if (!hasContent) {
      paragraphs.push(section.status
        ? 'Recorded status: ' + section.status
        : 'No content is recorded for this section yet.');
    }
    return paragraphs;
  }

  /** The tabular registers a section contributes to the export. */
  function buildSectionTables(section) {
    var tables = [];
    if (asArray(section.rows).length > 0) {
      tables.push({
        caption: 'Testing results',
        columns: ['Control', 'Procedure', 'Evidence', 'Result', 'Conclusion', 'Linked findings'],
        widths: [12, 34, 12, 12, 20, 10],
        rows: section.rows.map(function (row) {
          return [
            [row.controlCode, row.controlTitle].filter(Boolean).join(' — '),
            row.procedure, row.evidence, row.result, row.conclusion,
            [row.findingId, row.findingTitle].filter(Boolean).join(' — ')
          ];
        })
      });
    }
    asArray(section.registers).forEach(function (register) {
      tables.push({
        caption: register.label + ' (not audited)',
        columns: ['Reference', 'Description', 'Criteria', 'Controls'],
        widths: [12, 56, 16, 16],
        rows: register.rows.map(function (row) {
          return [row.id, row.text, row.criteria, row.controls];
        })
      });
    });
    return tables;
  }

  // ------------------------------------------------------------------
  // DOCX — OOXML WordprocessingML inside the shared ZIP writer.
  // ------------------------------------------------------------------

  /** One `<w:p>` paragraph in a named style. */
  function docxParagraph(text, style) {
    var properties = style ? '<w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' : '';
    return '<w:p>' + properties +
      '<w:r><w:t xml:space="preserve">' + escapeXml(stripControlChars(text)) + '</w:t></w:r></w:p>';
  }

  /** One table cell, sized in fiftieths of a percent as WordprocessingML expects. */
  function docxCell(text, widthPercent, header) {
    return '<w:tc><w:tcPr><w:tcW w:w="' + Math.round(widthPercent * 50) + '" w:type="pct"/>' +
      (header ? '<w:shd w:val="clear" w:color="auto" w:fill="EFF3F8"/>' : '') +
      '</w:tcPr>' + docxParagraph(text, header ? 'TableHeader' : 'TableCell') + '</w:tc>';
  }

  /** One `<w:tbl>` from a document-model table. */
  function docxTable(table) {
    var columns = asArray(table.columns);
    var widths = asArray(table.widths);
    function width(index) {
      return widths[index] !== undefined ? widths[index] : (100 / Math.max(columns.length, 1));
    }
    var header = '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + columns.map(function (column, index) {
      return docxCell(column, width(index), true);
    }).join('') + '</w:tr>';
    var body = asArray(table.rows).map(function (row) {
      return '<w:tr>' + columns.map(function (column, index) {
        return docxCell(asArray(row)[index] || '', width(index), false);
      }).join('') + '</w:tr>';
    }).join('');
    return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>' +
      '<w:tblBorders>' +
      ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (edge) {
        return '<w:' + edge + ' w:val="single" w:sz="4" w:space="0" w:color="D5DBE3"/>';
      }).join('') +
      '</w:tblBorders></w:tblPr>' + header + body + '</w:tbl>';
  }

  /** The `word/document.xml` body for a document model. */
  function docxBody(model) {
    var parts = [];
    parts.push(docxParagraph(model.title, 'Title'));
    if (model.subtitle) {
      parts.push(docxParagraph(model.subtitle, 'Subtitle'));
    }
    asArray(model.meta).forEach(function (row) {
      parts.push(docxParagraph(row.label + ': ' + row.value, 'Meta'));
    });

    asArray(model.sections).forEach(function (section) {
      parts.push(docxParagraph(
        (section.numeral ? 'Section ' + section.numeral + ' — ' : '') + section.heading, 'Heading1'));
      asArray(section.notices).forEach(function (notice) {
        parts.push(docxParagraph(notice, 'Notice'));
      });
      asArray(section.paragraphs).forEach(function (paragraph) {
        parts.push(docxParagraph(paragraph, null));
      });
      if (asArray(section.lineage).length > 0) {
        parts.push(docxParagraph('Generated from — ' + section.lineage.join('; '), 'Notice'));
      }
      asArray(section.tables).forEach(function (table) {
        parts.push(docxParagraph(table.caption, 'Heading2'));
        parts.push(docxTable(table));
        // Word requires a paragraph between consecutive tables and after the
        // last one; an empty paragraph is the standard separator.
        parts.push('<w:p/>');
      });
    });

    parts.push(docxParagraph(model.footer, 'Notice'));
    return parts.join('');
  }

  /** The minimal `word/styles.xml` the body references. */
  function docxStyles() {
    function style(id, name, size, bold, color, spacing) {
      return '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/>' +
        '<w:pPr><w:spacing w:before="' + spacing + '" w:after="' + Math.round(spacing / 2) + '"/></w:pPr>' +
        '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="' + size + '"/>' +
        (bold ? '<w:b/>' : '') + (color ? '<w:color w:val="' + color + '"/>' : '') +
        '</w:rPr></w:style>';
    }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>' +
      '<w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>' +
      style('Title', 'Title', 40, true, '1B1F24', 0) +
      style('Subtitle', 'Subtitle', 24, false, '5B6672', 0) +
      style('Meta', 'Meta', 18, false, '5B6672', 0) +
      style('Heading1', 'heading 1', 30, true, '1B1F24', 320) +
      style('Heading2', 'heading 2', 24, true, '1B1F24', 240) +
      style('Notice', 'Notice', 18, false, '5B6672', 80) +
      style('TableHeader', 'Table Header', 18, true, '1B1F24', 0) +
      style('TableCell', 'Table Cell', 18, false, '1B1F24', 0) +
      '</w:styles>';
  }

  /**
   * Builds the complete `.docx` package for a document model. Returns
   * `{ bytes, entries }` — the byte array ready to become a Blob, plus the
   * named parts, so the offline suites can assert the package structure
   * without a ZIP reader.
   */
  function buildDocx(model) {
    var source = model || {};
    var entries = [
      {
        name: '[Content_Types].xml',
        text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
          '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
          '</Types>'
      },
      {
        name: '_rels/.rels',
        text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
          '</Relationships>'
      },
      {
        name: 'word/_rels/document.xml.rels',
        text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          '</Relationships>'
      },
      { name: 'word/styles.xml', text: docxStyles() },
      {
        name: 'word/document.xml',
        text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
          '<w:body>' + docxBody(source) +
          '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
          '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
          '</w:body></w:document>'
      }
    ];

    var writer = workbook();
    return { bytes: writer ? writer.buildZip(entries) : null, entries: entries };
  }

  // ------------------------------------------------------------------
  // PDF — a real PDF 1.4 document, written directly.
  // ------------------------------------------------------------------

  /**
   * Helvetica and Helvetica-Bold advance widths (units per 1000 em) for the
   * printable ASCII range, from the fonts' own AFM metrics. Wrapping measures
   * with these rather than guessing, so a wrapped line genuinely fits the
   * column it was measured against.
   */
  var HELVETICA_WIDTHS = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
  ];
  var HELVETICA_BOLD_WIDTHS = [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
    611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584
  ];

  /** Page geometry, in PDF points (A4 portrait with a generous margin). */
  var PAGE = { width: 595, height: 842, margin: 54 };

  /**
   * Normalizes text into the printable Latin-1 range. Typographic characters
   * the workspace uses (curly quotes, dashes, arrows, bullets) map to their
   * ASCII equivalents rather than being dropped, so the exported sentence still
   * reads correctly — and one character stays one byte, which is what keeps the
   * cross-reference offsets exact.
   */
  function toLatin1(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[‘’‚′]/g, "'")
      .replace(/[“”„″]/g, '"')
      .replace(/[–—−]/g, '-')
      .replace(/…/g, '...')
      .replace(/[→➔➡]/g, '->')
      .replace(/[•●◦◇◆]/g, '-')
      .replace(/ /g, ' ')
      .replace(/[^\x20-\x7E\n]/g, '');
  }

  /** Escapes the three characters a PDF literal string reserves. */
  function escapePdfText(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  /** The rendered width of a string at a font size, in points. */
  function textWidth(text, size, bold) {
    var widths = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
    var total = 0;
    var value = String(text);
    for (var index = 0; index < value.length; index += 1) {
      var code = value.charCodeAt(index);
      var advance = (code >= 32 && code <= 126) ? widths[code - 32] : 556;
      total += advance;
    }
    return total * size / 1000;
  }

  /** Wraps text to a maximum width, breaking on spaces and hard-breaking long words. */
  function wrapText(text, size, bold, maxWidth) {
    var words = toLatin1(text).replace(/\s+/g, ' ').trim().split(' ');
    var lines = [];
    var current = '';
    words.forEach(function (word) {
      if (!word) {
        return;
      }
      var candidate = current ? current + ' ' + word : word;
      if (textWidth(candidate, size, bold) <= maxWidth || !current) {
        // A single word wider than the column is hard-broken rather than
        // allowed to run past the margin.
        if (!current && textWidth(word, size, bold) > maxWidth) {
          var chunk = '';
          for (var index = 0; index < word.length; index += 1) {
            if (textWidth(chunk + word[index], size, bold) > maxWidth && chunk) {
              lines.push(chunk);
              chunk = '';
            }
            chunk += word[index];
          }
          current = chunk;
          return;
        }
        current = candidate;
        return;
      }
      lines.push(current);
      current = word;
    });
    if (current) {
      lines.push(current);
    }
    return lines.length > 0 ? lines : [''];
  }

  /**
   * The page layout engine: accumulates content streams, starting a new page
   * whenever the cursor would cross the bottom margin. Everything the PDF
   * renders goes through `line`, `paragraph`, and `table`, so pagination is
   * decided in one place.
   */
  function createLayout() {
    var pages = [];
    var stream = [];
    var cursor = PAGE.height - PAGE.margin;
    var contentWidth = PAGE.width - (PAGE.margin * 2);

    function flush() {
      pages.push(stream.join('\n'));
      stream = [];
      cursor = PAGE.height - PAGE.margin;
    }

    function ensure(height) {
      if (cursor - height < PAGE.margin) {
        flush();
      }
    }

    return {
      contentWidth: contentWidth,

      /** Draws one already-wrapped line at the cursor and advances it. */
      line: function (text, size, bold, x, color) {
        ensure(size * 1.35);
        cursor -= size * 1.15;
        stream.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' +
          (color || '0 0 0') + ' rg ' +
          (PAGE.margin + (x || 0)) + ' ' + cursor + ' Td (' +
          escapePdfText(toLatin1(text)) + ') Tj ET');
        cursor -= size * 0.2;
      },

      /** Wraps and draws a paragraph, then adds trailing space. */
      paragraph: function (text, size, bold, color, gap) {
        var self = this;
        wrapText(text, size, bold, contentWidth).forEach(function (row) {
          self.line(row, size, bold, 0, color);
        });
        cursor -= (gap === undefined ? size * 0.6 : gap);
      },

      /** Adds vertical space. */
      space: function (height) {
        cursor -= height;
      },

      /** Draws a horizontal rule across the content width. */
      rule: function () {
        ensure(6);
        cursor -= 4;
        stream.push('0.83 0.86 0.89 RG 0.5 w ' + PAGE.margin + ' ' + cursor + ' m ' +
          (PAGE.margin + contentWidth) + ' ' + cursor + ' l S');
        cursor -= 4;
      },

      /**
       * Draws a ruled table. Column widths are percentages of the content
       * width; every cell wraps inside its own column, and a row that would
       * cross the bottom margin starts a new page with the header repeated.
       */
      table: function (columns, widths, rows) {
        var self = this;
        var size = 8;
        var padding = 4;
        var columnWidths = columns.map(function (column, index) {
          var percent = widths && widths[index] !== undefined ? widths[index] : (100 / columns.length);
          return contentWidth * percent / 100;
        });

        function rowHeight(cells, bold) {
          var lines = 1;
          cells.forEach(function (cell, index) {
            lines = Math.max(lines, wrapText(cell || '', size, bold, columnWidths[index] - (padding * 2)).length);
          });
          return (lines * size * 1.25) + (padding * 2);
        }

        function drawRow(cells, bold, shaded) {
          var height = rowHeight(cells, bold);
          if (cursor - height < PAGE.margin) {
            flush();
            drawRow(columns, true, true);
          }
          var top = cursor;
          var bottom = cursor - height;
          if (shaded) {
            stream.push('0.94 0.95 0.97 rg ' + PAGE.margin + ' ' + bottom + ' ' +
              contentWidth + ' ' + height + ' re f');
          }
          var x = PAGE.margin;
          cells.forEach(function (cell, index) {
            var lines = wrapText(cell || '', size, bold, columnWidths[index] - (padding * 2));
            var y = top - padding - (size * 0.95);
            lines.forEach(function (row) {
              stream.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf 0 0 0 rg ' +
                (x + padding) + ' ' + y + ' Td (' + escapePdfText(row) + ') Tj ET');
              y -= size * 1.25;
            });
            x += columnWidths[index];
          });
          // Cell rules: the row box plus one vertical between each column.
          stream.push('0.83 0.86 0.89 RG 0.4 w ' + PAGE.margin + ' ' + bottom + ' ' +
            contentWidth + ' ' + height + ' re S');
          var divider = PAGE.margin;
          for (var index = 0; index < columnWidths.length - 1; index += 1) {
            divider += columnWidths[index];
            stream.push(divider + ' ' + bottom + ' m ' + divider + ' ' + top + ' l S');
          }
          cursor = bottom;
        }

        drawRow(columns, true, true);
        asArray(rows).forEach(function (row) {
          drawRow(columns.map(function (column, index) { return asArray(row)[index] || ''; }), false, false);
        });
        self.space(10);
      },

      /** Finalizes the last page and returns every page's content stream. */
      finish: function () {
        if (stream.length > 0 || pages.length === 0) {
          flush();
        }
        return pages;
      }
    };
  }

  /** Lays out one document model into page content streams. */
  function layoutDocument(model) {
    var source = model || {};
    var layout = createLayout();

    layout.paragraph(source.title, 18, true, '0.11 0.12 0.14', 4);
    if (source.subtitle) {
      layout.paragraph(source.subtitle, 11, false, '0.36 0.40 0.45', 6);
    }
    asArray(source.meta).forEach(function (row) {
      layout.line(row.label + ': ' + row.value, 9, false, 0, '0.36 0.40 0.45');
    });
    layout.rule();
    layout.space(6);

    asArray(source.sections).forEach(function (section) {
      layout.paragraph((section.numeral ? 'Section ' + section.numeral + ' — ' : '') + section.heading,
        13, true, '0.11 0.12 0.14', 4);
      asArray(section.notices).forEach(function (notice) {
        layout.paragraph(notice, 8, false, '0.36 0.40 0.45', 4);
      });
      asArray(section.paragraphs).forEach(function (paragraph) {
        layout.paragraph(paragraph, 10, false, '0 0 0');
      });
      if (asArray(section.lineage).length > 0) {
        layout.paragraph('Generated from — ' + section.lineage.join('; '), 8, false, '0.36 0.40 0.45', 6);
      }
      asArray(section.tables).forEach(function (table) {
        layout.paragraph(table.caption, 10, true, '0.11 0.12 0.14', 4);
        layout.table(table.columns, table.widths, table.rows);
      });
      layout.space(8);
    });

    layout.rule();
    layout.paragraph(source.footer, 8, false, '0.42 0.46 0.52', 0);
    return layout.finish();
  }

  /**
   * Builds a complete PDF 1.4 document for a document model. Returns
   * `{ text, bytes, pageCount }` — the text is the exact byte sequence (every
   * character is Latin-1, so one character is one byte), which the offline
   * suites assert against without a PDF parser.
   */
  function buildPdf(model) {
    var contents = layoutDocument(model);
    var objects = [];

    // Object numbering: 1 Catalog, 2 Pages, 3 Helvetica, 4 Helvetica-Bold,
    // then one Page + one Contents object per page.
    var firstPageObject = 5;
    var pageIds = contents.map(function (unused, index) {
      return firstPageObject + (index * 2);
    });

    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push('<< /Type /Pages /Count ' + contents.length + ' /Kids [' +
      pageIds.map(function (id) { return id + ' 0 R'; }).join(' ') + '] >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    contents.forEach(function (stream, index) {
      var contentId = pageIds[index] + 1;
      objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAGE.width + ' ' + PAGE.height + '] ' +
        '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + contentId + ' 0 R >>');
      objects.push('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
    });

    var header = '%PDF-1.4\n';
    var body = '';
    var offsets = [];
    objects.forEach(function (object, index) {
      offsets.push(header.length + body.length);
      body += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
    });

    var xrefOffset = header.length + body.length;
    var xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n' +
      offsets.map(function (offset) {
        return ('0000000000' + offset).slice(-10) + ' 00000 n \n';
      }).join('');
    var trailer = 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' +
      xrefOffset + '\n%%EOF\n';

    var text = header + body + xref + trailer;
    return { text: text, bytes: toLatin1Bytes(text), pageCount: contents.length };
  }

  /** Encodes a Latin-1 string as bytes (one character, one byte). */
  function toLatin1Bytes(value) {
    var bytes = new Uint8Array(value.length);
    for (var index = 0; index < value.length; index += 1) {
      bytes[index] = value.charCodeAt(index) & 0xFF;
    }
    return bytes;
  }

  // ------------------------------------------------------------------
  // HTML — one self-contained, print-friendly document.
  // ------------------------------------------------------------------

  var HTML_STYLE = [
    'body{font-family:"Segoe UI",Arial,sans-serif;font-size:13px;line-height:1.55;color:#1b1f24;margin:0;padding:32px;background:#fff}',
    'h1{font-size:22px;margin:0 0 4px}',
    'h2{font-size:15px;margin:28px 0 8px;padding-bottom:4px;border-bottom:1px solid #d5dbe3}',
    'h3{font-size:13px;margin:18px 0 6px}',
    '.aos-doc__meta{color:#5b6672;margin:0 0 20px}',
    '.aos-doc__notice{margin:0 0 10px;padding:8px 10px;background:#f7f9fc;border-left:3px solid #b9c4d2;font-size:12px;color:#5b6672}',
    '.aos-doc__lineage{font-size:12px;color:#5b6672;margin:8px 0 0}',
    'table{border-collapse:collapse;width:100%;margin:0 0 12px;font-size:12px}',
    'th,td{border:1px solid #d5dbe3;padding:6px 8px;text-align:left;vertical-align:top}',
    'th{background:#eff3f8;font-weight:600}',
    '.aos-doc__footer{margin-top:32px;padding-top:12px;border-top:1px solid #d5dbe3;color:#6b7684;font-size:11px}',
    '@media print{body{padding:0}h2{page-break-after:avoid}table{page-break-inside:avoid}}'
  ].join('');

  /** Builds the complete, self-contained HTML report document. */
  function toHtml(model) {
    var source = model || {};
    var body = asArray(source.sections).map(function (section) {
      var notices = asArray(section.notices).map(function (notice) {
        return '<p class="aos-doc__notice">' + escapeHtml(notice) + '</p>';
      }).join('');
      var paragraphs = asArray(section.paragraphs).map(function (paragraph) {
        return '<p>' + escapeHtml(paragraph) + '</p>';
      }).join('');
      var lineage = asArray(section.lineage).length > 0
        ? '<p class="aos-doc__lineage">Generated from — ' + escapeHtml(section.lineage.join('; ')) + '</p>'
        : '';
      var tables = asArray(section.tables).map(function (table) {
        return '<h3>' + escapeHtml(table.caption) + '</h3><table><thead><tr>' +
          asArray(table.columns).map(function (column) { return '<th>' + escapeHtml(column) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
          asArray(table.rows).map(function (row) {
            return '<tr>' + asArray(table.columns).map(function (column, index) {
              return '<td>' + escapeHtml(asArray(row)[index] || '') + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table>';
      }).join('');
      return '<section><h2>' +
        escapeHtml((section.numeral ? 'Section ' + section.numeral + ' — ' : '') + section.heading) +
        '</h2>' + notices + paragraphs + lineage + tables + '</section>';
    }).join('');

    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + escapeHtml(source.title || 'Audit report') + '</title>\n' +
      '<style>' + HTML_STYLE + '</style>\n</head>\n<body>\n' +
      '<h1>' + escapeHtml(source.title || 'Audit report') + '</h1>\n' +
      '<p class="aos-doc__meta">' + escapeHtml(asArray(source.meta).map(function (row) {
        return row.label + ': ' + row.value;
      }).join(' · ')) + '</p>\n' + body +
      '\n<p class="aos-doc__footer">' + escapeHtml(source.footer || '') + '</p>\n' +
      '</body>\n</html>\n';
  }

  /** The base file name for a report export, without an extension. */
  function fileBaseName(report, context) {
    var source = report || {};
    var ctx = context || {};
    return slug([ctx.engagementCode || ctx.engagementName, source.reportId, source.version]
      .filter(Boolean).join('-') || 'audit-report');
  }

  AuditOS.documentExport = {
    PAGE: PAGE,

    // Pure builders — offline-testable without a browser.
    toDocumentModel: toDocumentModel,
    buildSectionParagraphs: buildSectionParagraphs,
    buildSectionTables: buildSectionTables,
    buildDocx: buildDocx,
    buildPdf: buildPdf,
    toHtml: toHtml,
    toLatin1: toLatin1,
    textWidth: textWidth,
    wrapText: wrapText,
    escapeXml: escapeXml,
    escapeHtml: escapeHtml,
    fileBaseName: fileBaseName,

    /** Downloads the report as a Word document. Returns false outside a browser. */
    downloadDocx: function (report, context) {
      var writer = workbook();
      if (!writer) {
        return false;
      }
      var docx = buildDocx(toDocumentModel(report, context));
      return writer.download(fileBaseName(report, context) + '.docx', docx.bytes,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    },

    /** Downloads the report as a PDF. Returns false outside a browser. */
    downloadPdf: function (report, context) {
      var writer = workbook();
      if (!writer) {
        return false;
      }
      var pdf = buildPdf(toDocumentModel(report, context));
      return writer.download(fileBaseName(report, context) + '.pdf', pdf.bytes, 'application/pdf');
    },

    /** Downloads the report as a self-contained HTML document. */
    downloadHtml: function (report, context) {
      var writer = workbook();
      if (!writer) {
        return false;
      }
      return writer.downloadHtml(fileBaseName(report, context) + '.html',
        toHtml(toDocumentModel(report, context)));
    }
  };
})(window);
