/**
 * AuditOS Workbook Export
 * AI Workpaper Foundation — GitHub Issue #40 §6
 *
 * The one workbook writer of the platform: a declarative sheet model in, a
 * real `.xlsx` file out. Any workspace that needs to export a workbook composes
 * this service rather than inventing its own serializer.
 *
 * Zero dependency by construction (AI Implementation Context / CLAUDE.md — no
 * npm, no CDN, no build step, must run from file://). An `.xlsx` is an OOXML
 * package inside a ZIP container, so this module writes both: a minimal but
 * standards-correct SpreadsheetML part set, and a ZIP built with the STORE
 * method — a fully valid ZIP that needs no compressor, only a CRC-32. That is
 * why this is a real writer rather than the Release 2 placeholder the issue
 * allows: the whole implementation is a few hundred lines of standard-library
 * JavaScript with nothing to install.
 *
 * What is deliberately NOT implemented: shared strings (every cell is written
 * as an inline string, which is valid and simpler), formulas, charts, images,
 * merged-cell styling beyond the three cell formats below, and any calculation
 * chain. A workpaper export needs none of them.
 *
 * Depends on nothing in components/, keeping the js → components boundary
 * one-way. Loaded as a classic script so the prototype runs directly from
 * file:///.../prototype/index.html with no build step or module loader.
 */
(function (global) {
  'use strict';

  var AuditOS = global.AuditOS = global.AuditOS || {};

  /** The cell formats the writer registers, by index into `styles.xml`. */
  var STYLES = { DEFAULT: 0, HEADER: 1, WRAP: 2, TITLE: 3 };

  /** Excel's hard limit on a sheet name, and the characters it forbids. */
  var SHEET_NAME_LIMIT = 31;
  var FORBIDDEN_SHEET_CHARS = /[\\\/\?\*\[\]:]/g;

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

  /**
   * Strips the control characters XML 1.0 forbids. Recorded audit text can
   * carry stray control bytes; a document that would not parse is worse than
   * one that drops them, and tab / newline / carriage return are preserved.
   */
  function stripControlChars(value) {
    return String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }

  // ------------------------------------------------------------------
  // ZIP container — STORE method (no compression), which every ZIP reader and
  // every version of Excel accepts. Pure byte assembly; no dependency.
  // ------------------------------------------------------------------

  /** The CRC-32 lookup table, built once on first use. */
  var crcTable = null;

  /** Builds the standard CRC-32 (IEEE 802.3 polynomial) lookup table. */
  function buildCrcTable() {
    var table = new Int32Array(256);
    for (var index = 0; index < 256; index += 1) {
      var value = index;
      for (var bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? ((value >>> 1) ^ 0xEDB88320) : (value >>> 1);
      }
      table[index] = value;
    }
    return table;
  }

  /** The CRC-32 of a byte array, as an unsigned 32-bit integer. */
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = buildCrcTable();
    }
    var crc = -1;
    for (var index = 0; index < bytes.length; index += 1) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[index]) & 0xFF];
    }
    return (crc ^ -1) >>> 0;
  }

  /** Encodes a string as UTF-8 bytes. */
  function encodeUtf8(value) {
    if (typeof global.TextEncoder === 'function') {
      return new global.TextEncoder().encode(value);
    }
    // Offline sandbox fallback: encode manually rather than depend on a global
    // that may not exist outside the browser.
    var utf8 = unescape(encodeURIComponent(value));
    var bytes = new Uint8Array(utf8.length);
    for (var index = 0; index < utf8.length; index += 1) {
      bytes[index] = utf8.charCodeAt(index) & 0xFF;
    }
    return bytes;
  }

  /** Appends a little-endian unsigned integer of `size` bytes to a byte list. */
  function pushInt(bytes, value, size) {
    for (var index = 0; index < size; index += 1) {
      bytes.push((value >>> (index * 8)) & 0xFF);
    }
  }

  /** Appends every byte of an array-like to a byte list. */
  function pushBytes(target, source) {
    for (var index = 0; index < source.length; index += 1) {
      target.push(source[index]);
    }
  }

  /**
   * Builds a ZIP archive from `[{ name, text }]` entries using the STORE
   * method. Returns a Uint8Array — the caller decides whether it becomes a
   * Blob, a data URI, or a file on disk.
   */
  function buildZip(entries) {
    var local = [];
    var central = [];
    var offset = 0;

    asArray(entries).forEach(function (entry) {
      var nameBytes = encodeUtf8(entry.name);
      var dataBytes = encodeUtf8(entry.text);
      var checksum = crc32(dataBytes);
      var headerOffset = offset;

      // Local file header. Flag bit 11 declares UTF-8 names; the DOS
      // timestamp is fixed so exports are byte-reproducible.
      var header = [];
      pushInt(header, 0x04034B50, 4);
      pushInt(header, 20, 2);          // version needed
      pushInt(header, 0x0800, 2);      // flags: UTF-8 names
      pushInt(header, 0, 2);           // method: STORE
      pushInt(header, 0, 2);           // mod time
      pushInt(header, 0x0021, 2);      // mod date (1980-01-01)
      pushInt(header, checksum, 4);
      pushInt(header, dataBytes.length, 4);
      pushInt(header, dataBytes.length, 4);
      pushInt(header, nameBytes.length, 2);
      pushInt(header, 0, 2);           // extra field length
      pushBytes(header, nameBytes);
      pushBytes(local, header);
      pushBytes(local, dataBytes);
      offset += header.length + dataBytes.length;

      var directory = [];
      pushInt(directory, 0x02014B50, 4);
      pushInt(directory, 20, 2);       // version made by
      pushInt(directory, 20, 2);       // version needed
      pushInt(directory, 0x0800, 2);
      pushInt(directory, 0, 2);
      pushInt(directory, 0, 2);
      pushInt(directory, 0x0021, 2);
      pushInt(directory, checksum, 4);
      pushInt(directory, dataBytes.length, 4);
      pushInt(directory, dataBytes.length, 4);
      pushInt(directory, nameBytes.length, 2);
      pushInt(directory, 0, 2);        // extra
      pushInt(directory, 0, 2);        // comment
      pushInt(directory, 0, 2);        // disk number
      pushInt(directory, 0, 2);        // internal attributes
      pushInt(directory, 0, 4);        // external attributes
      pushInt(directory, headerOffset, 4);
      pushBytes(directory, nameBytes);
      pushBytes(central, directory);
    });

    var end = [];
    pushInt(end, 0x06054B50, 4);
    pushInt(end, 0, 2);                // this disk
    pushInt(end, 0, 2);                // disk with central directory
    pushInt(end, asArray(entries).length, 2);
    pushInt(end, asArray(entries).length, 2);
    pushInt(end, central.length, 4);
    pushInt(end, local.length, 4);
    pushInt(end, 0, 2);                // comment length

    var archive = new Uint8Array(local.length + central.length + end.length);
    archive.set(local, 0);
    archive.set(central, local.length);
    archive.set(end, local.length + central.length);
    return archive;
  }

  // ------------------------------------------------------------------
  // SpreadsheetML parts
  // ------------------------------------------------------------------

  /** The A1-style column name for a zero-based column index. */
  function columnName(index) {
    var name = '';
    var remaining = index;
    do {
      name = String.fromCharCode(65 + (remaining % 26)) + name;
      remaining = Math.floor(remaining / 26) - 1;
    } while (remaining >= 0);
    return name;
  }

  /**
   * Normalizes a sheet name to Excel's rules: forbidden characters removed,
   * trimmed to the length limit, never empty, and never a duplicate of a name
   * already taken (Excel rejects the workbook outright for either).
   */
  function normalizeSheetName(name, taken) {
    var cleaned = String(name || 'Sheet').replace(FORBIDDEN_SHEET_CHARS, ' ').trim();
    cleaned = cleaned.slice(0, SHEET_NAME_LIMIT) || 'Sheet';
    if (!taken || !taken[cleaned]) {
      return cleaned;
    }
    var suffix = 2;
    var candidate = cleaned;
    while (taken[candidate]) {
      var tail = ' (' + suffix + ')';
      candidate = cleaned.slice(0, SHEET_NAME_LIMIT - tail.length) + tail;
      suffix += 1;
    }
    return candidate;
  }

  /**
   * Normalizes one cell. A cell is either a primitive or
   * `{ value, style, number }`; numbers are written as numeric cells so Excel
   * treats them as numbers, and everything else as an inline string.
   */
  function normalizeCell(cell) {
    if (cell === null || cell === undefined) {
      return { value: '', style: STYLES.DEFAULT, numeric: false };
    }
    if (typeof cell === 'object') {
      var numeric = cell.number === true && typeof cell.value === 'number' && isFinite(cell.value);
      return {
        value: numeric ? cell.value : stripControlChars(cell.value === undefined ? '' : cell.value),
        style: typeof cell.style === 'number' ? cell.style : STYLES.DEFAULT,
        numeric: numeric
      };
    }
    if (typeof cell === 'number' && isFinite(cell)) {
      return { value: cell, style: STYLES.DEFAULT, numeric: true };
    }
    return { value: stripControlChars(cell), style: STYLES.DEFAULT, numeric: false };
  }

  /** Builds one `xl/worksheets/sheetN.xml` part from a row matrix. */
  function sheetXml(sheet) {
    var rows = asArray(sheet.rows);
    var widths = asArray(sheet.columnWidths);
    var columns = widths.length > 0
      ? '<cols>' + widths.map(function (width, index) {
        return '<col min="' + (index + 1) + '" max="' + (index + 1) +
          '" width="' + width + '" customWidth="1"/>';
      }).join('') + '</cols>'
      : '';

    var body = rows.map(function (row, rowIndex) {
      var cells = asArray(row).map(function (cell, columnIndex) {
        var normalized = normalizeCell(cell);
        if (normalized.value === '' && normalized.style === STYLES.DEFAULT) {
          return '';
        }
        var reference = columnName(columnIndex) + (rowIndex + 1);
        var style = normalized.style ? ' s="' + normalized.style + '"' : '';
        if (normalized.numeric) {
          return '<c r="' + reference + '"' + style + '><v>' + normalized.value + '</v></c>';
        }
        return '<c r="' + reference + '"' + style + ' t="inlineStr"><is><t xml:space="preserve">' +
          escapeXml(normalized.value) + '</t></is></c>';
      }).join('');
      return cells ? '<row r="' + (rowIndex + 1) + '">' + cells + '</row>' : '';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      columns + '<sheetData>' + body + '</sheetData></worksheet>';
  }

  /**
   * The minimal `xl/styles.xml`: a default format, a bold header, a wrapping
   * body cell for the long recorded audit text, and a bold title. The indices
   * match `STYLES`.
   */
  function stylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="3">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="14"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="3">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFEFF3F8"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="4">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }

  /**
   * Builds the complete `.xlsx` package for `[{ name, rows, columnWidths }]`
   * sheets. Returns `{ bytes, entries }` — the byte array ready to become a
   * Blob, plus the named parts, so the offline suites can assert the package
   * structure without a ZIP reader.
   */
  function buildWorkbook(sheets) {
    var taken = {};
    var normalized = asArray(sheets).map(function (sheet, index) {
      var name = normalizeSheetName(sheet && sheet.name, taken);
      taken[name] = true;
      return {
        name: name,
        rows: asArray(sheet && sheet.rows),
        columnWidths: asArray(sheet && sheet.columnWidths),
        index: index + 1
      };
    });
    if (normalized.length === 0) {
      normalized = [{ name: 'Sheet', rows: [], columnWidths: [], index: 1 }];
    }

    var entries = [];

    entries.push({
      name: '[Content_Types].xml',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        normalized.map(function (sheet) {
          return '<Override PartName="/xl/worksheets/sheet' + sheet.index +
            '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }).join('') +
        '</Types>'
    });

    entries.push({
      name: '_rels/.rels',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>'
    });

    entries.push({
      name: 'xl/workbook.xml',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        normalized.map(function (sheet) {
          return '<sheet name="' + escapeXml(sheet.name) + '" sheetId="' + sheet.index +
            '" r:id="rId' + sheet.index + '"/>';
        }).join('') +
        '</sheets></workbook>'
    });

    entries.push({
      name: 'xl/_rels/workbook.xml.rels',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        normalized.map(function (sheet) {
          return '<Relationship Id="rId' + sheet.index +
            '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' +
            sheet.index + '.xml"/>';
        }).join('') +
        '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>'
    });

    entries.push({ name: 'xl/styles.xml', text: stylesXml() });

    normalized.forEach(function (sheet) {
      entries.push({ name: 'xl/worksheets/sheet' + sheet.index + '.xml', text: sheetXml(sheet) });
    });

    return { bytes: buildZip(entries), entries: entries, sheets: normalized };
  }

  /**
   * Hands a byte array or string to the browser as a download. Uses an object
   * URL and a synthetic anchor, which works from `file://` with no server.
   * Does nothing outside a browser, so the offline suites can load this module.
   */
  function download(fileName, data, mimeType) {
    if (!global.document || typeof global.Blob !== 'function' || !global.URL) {
      return false;
    }
    var blob = new global.Blob([data], { type: mimeType || 'application/octet-stream' });
    var url = global.URL.createObjectURL(blob);
    var anchor = global.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    global.document.body.appendChild(anchor);
    anchor.click();
    global.document.body.removeChild(anchor);
    // Revoking immediately can cancel the download in some browsers; a task
    // boundary is enough and keeps no timer alive.
    global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 0);
    return true;
  }

  AuditOS.workbookExport = {
    STYLES: STYLES,

    // Pure builders — offline-testable without a browser.
    escapeXml: escapeXml,
    columnName: columnName,
    normalizeSheetName: normalizeSheetName,
    normalizeCell: normalizeCell,
    sheetXml: sheetXml,
    crc32: crc32,
    buildZip: buildZip,
    buildWorkbook: buildWorkbook,

    download: download,

    /** Builds the workbook for `sheets` and downloads it as `fileName`.xlsx. */
    downloadWorkbook: function (fileName, sheets) {
      var workbook = buildWorkbook(sheets);
      return download(fileName, workbook.bytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    },

    /** Downloads a self-contained HTML document. */
    downloadHtml: function (fileName, html) {
      return download(fileName, html, 'text/html;charset=utf-8');
    }
  };
})(window);
