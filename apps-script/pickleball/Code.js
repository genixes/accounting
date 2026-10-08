/**
 * Nice Game! Pickleball Club — Court Booking & Reconciliation
 * LAYAW SYSTEM · Google Apps Script + Google Sheets backend
 *
 * SPEED NOTE (bai): the old version read the sheet one cell at a time,
 * which meant hundreds of separate calls to Google's servers — that's
 * why loading took minutes. This version reads the whole block ONCE
 * with getValues(), and writes each record in ONE setValues() call.
 *
 * TIME NOTE: every date is handled in Philippine time (Asia/Manila),
 * no matter what timezone the script project or the phone is set to.
 *
 * The web app writes straight into your existing schedule sheet.
 * Columns (kept identical to your current sheet):
 *   A Game Date | B Court Name | C # of Courts & Hours | D Time Range
 *   E Total Price Booked (Capital) | F Transfer Fee | G Used Account
 *   H # of Confirmed Players | I Rate per player | J Total Sales
 *   K Revenue | L Amount to Return | M Capital Returned? | N Date Paid
 *   O ID  (added automatically — stable row identity)
 *   P Pasalo?  (added automatically — YES means the court was transferred, no +5%)
 *   Q Booking Receipt  (added automatically — Drive link(s), required on create)
 *   R Return Receipt   (added automatically — Drive link(s), required when returned)
 *
 * RECEIPTS: a booking can have several receipts (e.g. one transaction for
 * 10PM-12AM and another for 12AM-1AM). They all live in the same cell,
 * one Drive link per line.
 */

// ---------- CONFIG ----------
var SHEET_NAME = 'Sheet1'; // the tab that holds your bookings
var HEADER_ROW = 7;        // row where the column titles sit
var DATA_START = 8;        // first booking row
var MARKUP     = 1.05;     // capital is returned with +5%
var TZ         = 'Asia/Manila';
var TZ_OFFSET  = 8;        // Manila is UTC+8 all year (no daylight saving)

// Google Drive folders where receipts are saved
var BOOKING_FOLDER_ID = '1K20X0xEMy9a85aTsQHrqrsql3M4oBF_B'; // receipt when a booking is created
var RETURN_FOLDER_ID  = '1N1vW6cBTK93tiKZDrBFdZFS9pkrwSLuW'; // receipt when capital is returned
var EXPENSE_FOLDER_ID = '1N1vW6cBTK93tiKZDrBFdZFS9pkrwSLuW'; // receipt for an expense (reuse RETURN folder; change if you want a separate one)

// ---------- EXPENSES (general operating costs: grocery, transpo, snacks, etc.) ----------
// Stored in their own tab so they never mix with bookings.
var EXP_SHEET   = 'Expenses';   // tab name (auto-created on first use)
var EXP_HEADER  = 1;            // header row
var EXP_START   = 2;            // first data row
// Expenses columns: A Date | B Category | C Description | D Amount | E Receipt | F ID
var EC = { date:1, category:2, desc:3, amount:4, receipt:5, id:6 };
var EC_LAST = EC.id; // 6

// column numbers (1-based)
var C = { date:1, court:2, ch:3, time:4, capital:5, fee:6, acct:7,
          players:8, rate:9, sales:10, revenue:11, toReturn:12,
          returned:13, paid:14, id:15, pasalo:16,
          receiptBooking:17, receiptReturn:18, pasaloAmt:19, note:20 };
var LAST_COL = C.note; // 20

// Which account earns the +5% markup on the returned (non-pasalo) portion.
// Everyone else just gets capital back with no markup.
var MARKUP_ACCT = 'BDO';
function _marks(acct) {
  return String(acct || '').trim().toUpperCase() === MARKUP_ACCT.toUpperCase();
}

// Nice Game! logo used as the browser-tab / Android home-screen icon.
// Served from the public GitHub repo, pinned to a commit so the link never changes.
var ICON_URL = 'https://raw.githubusercontent.com/genixes/accounting/f071cb62f3badb0b7258664e701bd79324ab8910/apps-script/pickleball/icons/icon-192.png';

// ---------- WEB APP ENTRY ----------
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Nice Game! Pickleball Club')
    .setFaviconUrl(ICON_URL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function _sheet() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Sheet "' + SHEET_NAME + '" not found. Check SHEET_NAME.');
  // make sure the ID + Pasalo + receipt headers exist (one batched read + only-write-if-missing)
  var head = sh.getRange(HEADER_ROW, 1, 1, LAST_COL).getValues()[0];
  if (head[C.id - 1]             !== 'ID')              sh.getRange(HEADER_ROW, C.id).setValue('ID');
  if (head[C.pasalo - 1]         !== 'Pasalo?')         sh.getRange(HEADER_ROW, C.pasalo).setValue('Pasalo?');
  if (head[C.receiptBooking - 1] !== 'Booking Receipt') sh.getRange(HEADER_ROW, C.receiptBooking).setValue('Booking Receipt');
  if (head[C.receiptReturn - 1]  !== 'Return Receipt')  sh.getRange(HEADER_ROW, C.receiptReturn).setValue('Return Receipt');
  if (head[C.pasaloAmt - 1]      !== 'Pasalo Amount')   sh.getRange(HEADER_ROW, C.pasaloAmt).setValue('Pasalo Amount');
  if (head[C.note - 1]           !== 'Return Note')     sh.getRange(HEADER_ROW, C.note).setValue('Return Note');
  return sh;
}

// ---------- READ / WRITE HELPERS ----------
function _fmtDate(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]')
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v);
}
function _num(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}
function _parseCH(s) { // "2C 3H" -> {courts:2, hours:3}
  var m = String(s || '').match(/(\d+)\s*C\s*(\d+)\s*H/i);
  return m ? { courts: +m[1], hours: +m[2] } : { courts: 1, hours: 1 };
}
// "yyyy-MM-dd" -> Date at 12:00 noon Philippine time.
// Built from UTC so it lands on the right day even if the script project's
// own timezone is not Manila.
function _toDate(str) {
  if (!str) return '';
  var p = String(str).split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12 - TZ_OFFSET, 0, 0));
}

// ---------- RECEIPT LINKS (one cell can hold several, one per line) ----------
function _splitLinks(cell) {
  return String(cell || '').split(/\s*\n\s*/).filter(function (u) { return u; });
}
function _joinLinks(a, b) {
  return _splitLinks(a).concat(_splitLinks(b)).join('\n');
}
function _hasFiles(r) {
  return Array.isArray(r) ? r.length > 0 : !!(r && r.dataUrl);
}
// Which of the receipts already in a cell to keep.
// keep = list of links the user left in the form; only links that really are
// in the cell are accepted. No list sent (older page) = keep them all.
function _keepLinks(cell, keep) {
  var existing = _splitLinks(cell);
  if (!Array.isArray(keep)) return existing;
  return keep.filter(function (u) { return existing.indexOf(u) > -1; });
}

// Turn one raw row array (already read from the sheet) into a booking object.
// NOTE: takes an array, not a range — so no extra server call.
function _rowToObj(r) {
  var ch = _parseCH(r[C.ch - 1]);
  return {
    id: r[C.id - 1],
    date: _fmtDate(r[C.date - 1]),
    court: r[C.court - 1] || '',
    courts: ch.courts, hours: ch.hours,
    time: r[C.time - 1] || '',
    capital: _num(r[C.capital - 1]) || 0,
    fee: _num(r[C.fee - 1]) || 0,
    acct: r[C.acct - 1] || '',
    players: _num(r[C.players - 1]),
    rate: _num(r[C.rate - 1]),
    returned: String(r[C.returned - 1]).toUpperCase() === 'YES',
    paid: _fmtDate(r[C.paid - 1]),
    pasalo: String(r[C.pasalo - 1]).toUpperCase() === 'YES',
    receiptBooking: r[C.receiptBooking - 1] || null,
    receiptReturn: r[C.receiptReturn - 1] || null,
    // partial-pasalo amount: how much of the capital was passed on (no +5%).
    // null/blank = not a partial pasalo.
    pasaloAmt: _num(r[C.pasaloAmt - 1]),
    // free-text reference the organizer types when returning capital
    note: r[C.note - 1] || ''
  };
}

// Read a single row from the sheet (one call). Used after a write to return fresh data.
function _readRow(sh, row) {
  var r = sh.getRange(row, 1, 1, LAST_COL).getValues()[0];
  return _rowToObj(r);
}

// Upload a {name, dataUrl} receipt to a Drive folder, return the file URL.
function _uploadReceipt(folderId, receipt, prefix, meta) {
  if (!receipt || !receipt.dataUrl) return '';
  var m = String(receipt.dataUrl).match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return '';
  var mime = m[1];
  var bytes = Utilities.base64Decode(m[2]);
  var ext = (receipt.name && receipt.name.indexOf('.') > -1)
      ? receipt.name.split('.').pop()
      : (mime.split('/')[1] || 'bin');
  var safe = (prefix + '_' + meta).replace(/[^A-Za-z0-9._-]+/g, '-');
  var blob = Utilities.newBlob(bytes, mime, safe + '.' + ext);
  var file = DriveApp.getFolderById(folderId).createFile(blob);
  return file.getUrl();
}

// Upload one receipt or a list of receipts. Returns the Drive links, one per line.
function _uploadReceipts(folderId, receipts, prefix, meta) {
  if (!receipts) return '';
  var list = Array.isArray(receipts) ? receipts : [receipts];
  var urls = [];
  for (var i = 0; i < list.length; i++) {
    var u = _uploadReceipt(folderId, list[i], prefix, meta + (list.length > 1 ? '_' + (i + 1) : ''));
    if (u) urls.push(u);
  }
  return urls.join('\n');
}

// Compute the amount to return for one record.
// Rules (bai):
//  - Full pasalo (whole booking passed on): return exact capital + fee, NO +5% even for BDO.
//  - Partial pasalo (only part passed on): the passed-on part is returned exact (no +5%);
//    the REMAINING capital gets +5% only if the account is BDO. Fee always added once.
//  - Normal played/booked: capital gets +5% only if BDO, plus fee.
function _computeReturn(o) {
  var capital = Number(o.capital || 0);
  var fee     = Number(o.fee || 0);
  var bdo     = _marks(o.acct);
  var fullPasalo = (o.pasalo === true || String(o.pasalo).toUpperCase() === 'YES');
  var partAmt = _num(o.pasaloAmt); // amount passed on, if partial

  if (fullPasalo) return capital + fee;               // whole thing transferred, no markup

  if (partAmt !== null && partAmt > 0) {              // PARTIAL pasalo
    var passed    = Math.min(partAmt, capital);       // guard against over-entry
    var remaining = capital - passed;
    var remReturn = bdo ? remaining * MARKUP : remaining;
    return passed + remReturn + fee;
  }

  // normal booking/played
  return (bdo ? capital * MARKUP : capital) + fee;
}

// Build the full row array for a record (recomputes J,K,L).
function _buildRowArray(o) {
  var pasalo = o.pasalo === true || String(o.pasalo).toUpperCase() === 'YES';
  var played = !pasalo && o.players !== null && o.players !== undefined && o.players !== '';
  var sales    = played ? Number(o.players) * Number(o.rate || 0) : '';
  var revenue  = played ? sales - (Number(o.capital || 0) + Number(o.fee || 0)) : '';
  var toReturn = _computeReturn(o);

  var arr = new Array(LAST_COL);
  arr[C.date - 1]           = _toDate(o.date);
  arr[C.court - 1]          = o.court;
  arr[C.ch - 1]             = (o.courts || 1) + 'C ' + (o.hours || 1) + 'H';
  arr[C.time - 1]           = o.time || '';
  arr[C.capital - 1]        = Number(o.capital || 0);
  arr[C.fee - 1]            = Number(o.fee || 0);
  arr[C.acct - 1]           = o.acct;
  arr[C.players - 1]        = played ? Number(o.players) : '';
  arr[C.rate - 1]           = played ? Number(o.rate || 0) : '';
  arr[C.sales - 1]          = sales;
  arr[C.revenue - 1]        = revenue;
  arr[C.toReturn - 1]       = toReturn;
  arr[C.returned - 1]       = o.returned ? 'YES' : 'NO';
  arr[C.paid - 1]           = o.paid ? _toDate(o.paid) : '';
  arr[C.id - 1]             = o.id;
  arr[C.pasalo - 1]         = pasalo ? 'YES' : 'NO';
  arr[C.receiptBooking - 1] = o.receiptBooking || '';
  arr[C.receiptReturn - 1]  = o.receiptReturn || '';
  arr[C.pasaloAmt - 1]      = (o.pasaloAmt !== null && o.pasaloAmt !== undefined && o.pasaloAmt !== '') ? Number(o.pasaloAmt) : '';
  arr[C.note - 1]           = o.note || '';
  return arr;
}

// Write a full record in ONE call (was ~18 separate setValue calls before).
function _writeRow(sh, row, o) {
  sh.getRange(row, 1, 1, LAST_COL).setValues([_buildRowArray(o)]);
}

function _findRow(sh, id) {
  var last = sh.getLastRow();
  if (last < DATA_START) return -1;
  var ids = sh.getRange(DATA_START, C.id, last - DATA_START + 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) return DATA_START + i;
  return -1;
}

// ---------- API (called from the web app) ----------
// FAST: reads the entire data block in ONE getValues() call, then works in memory.
function getBookings() {
  var sh = _sheet();
  var last = sh.getLastRow();
  var out = [];
  if (last < DATA_START) return out;

  var numRows = last - DATA_START + 1;
  var grid = sh.getRange(DATA_START, 1, numRows, LAST_COL).getValues(); // <-- single read

  var backfillRows = []; // [{rowIndexInGrid, id}] for any missing IDs
  for (var i = 0; i < grid.length; i++) {
    var r = grid[i];
    var court = r[C.court - 1];
    var date  = r[C.date - 1];
    if (!court && !date) continue;                 // skip blank rows

    if (!r[C.id - 1]) {                             // assign an ID if missing
      var newId = Utilities.getUuid();
      r[C.id - 1] = newId;
      backfillRows.push({ row: DATA_START + i, id: newId });
    }
    out.push(_rowToObj(r));
  }

  // Write back any newly-generated IDs (usually none after first load).
  // Individual writes are fine here because it only happens once.
  if (backfillRows.length) {
    for (var b = 0; b < backfillRows.length; b++) {
      sh.getRange(backfillRows[b].row, C.id).setValue(backfillRows[b].id);
    }
    SpreadsheetApp.flush();
  }
  return out;
}

// b.receipt      = list of new receipts [{name, dataUrl}, ...] (a single object also works)
// b.keepReceipts = (edit only) links of the current receipts the user kept
function saveBooking(b) {
  var sh = _sheet();
  if (b.id) {                                  // edit existing
    var row = _findRow(sh, b.id);
    if (row < 0) throw new Error('Booking not found.');
    var cur = _readRow(sh, row);
    ['date','court','courts','hours','time','capital','fee','acct'].forEach(function(k){ cur[k] = b[k]; });
    var kept = _keepLinks(cur.receiptBooking, b.keepReceipts);
    if (!kept.length && !_hasFiles(b.receipt)) throw new Error('Booking receipt is required.');
    var added = _uploadReceipts(BOOKING_FOLDER_ID, b.receipt, 'Booking',
                  cur.date + '_' + cur.court + '_' + cur.acct);
    cur.receiptBooking = _joinLinks(kept.join('\n'), added);
    _writeRow(sh, row, cur);
    return _readRow(sh, row);
  }
  // new booking — at least one receipt required
  if (!_hasFiles(b.receipt)) throw new Error('Booking receipt is required.');
  var urls = _uploadReceipts(BOOKING_FOLDER_ID, b.receipt, 'Booking',
               b.date + '_' + b.court + '_' + b.acct);
  var newRow = Math.max(sh.getLastRow() + 1, DATA_START);
  var o = { id: Utilities.getUuid(), date:b.date, court:b.court, courts:b.courts, hours:b.hours,
            time:b.time, capital:b.capital, fee:b.fee, acct:b.acct,
            players:null, rate:null, returned:false, paid:'', pasalo:false,
            receiptBooking:urls, receiptReturn:null };
  _writeRow(sh, newRow, o);
  return _readRow(sh, newRow);
}

function logResult(id, players, rate) {
  var sh = _sheet();
  var row = _findRow(sh, id);
  if (row < 0) throw new Error('Booking not found.');
  var cur = _readRow(sh, row);
  cur.players = players; cur.rate = rate;
  _writeRow(sh, row, cur);
  return _readRow(sh, row);
}

// receipt = list of new return receipts; keep = links of current ones the user kept
function reconcile(id, ret, paid, receipt, note, keep) {
  var sh = _sheet();
  var row = _findRow(sh, id);
  if (row < 0) throw new Error('Booking not found.');
  var cur = _readRow(sh, row);
  if (ret) {
    var kept = _keepLinks(cur.receiptReturn, keep);
    if (!kept.length && !_hasFiles(receipt)) throw new Error('Return receipt is required.');
    var added = _uploadReceipts(RETURN_FOLDER_ID, receipt, 'Return',
                  cur.date + '_' + cur.court + '_' + cur.acct);
    cur.receiptReturn = _joinLinks(kept.join('\n'), added);
    cur.returned = true; cur.paid = paid;
    if (note !== null && note !== undefined) cur.note = String(note);
  } else {
    cur.returned = false; cur.paid = '';
    cur.note = ''; // clearing the return also clears its note
  }
  _writeRow(sh, row, cur);
  return _readRow(sh, row);
}

// mark / unmark a court transfer (Pasalo).
//   val = true  -> FULL pasalo: whole booking passed on, exact capital back, no +5%.
//   val = false -> clear any pasalo (full or partial).
//   partAmt (number) -> PARTIAL pasalo: only this much of the capital was passed on.
//                       The remaining capital keeps the normal +5% rule (BDO only).
function setPasalo(id, val, partAmt) {
  var sh = _sheet();
  var row = _findRow(sh, id);
  if (row < 0) throw new Error('Booking not found.');
  var cur = _readRow(sh, row);

  var isPartial = (partAmt !== null && partAmt !== undefined && partAmt !== '' && Number(partAmt) > 0);

  if (isPartial) {
    // partial: NOT a full pasalo; the group still played the rest, so keep players/rate.
    cur.pasalo = false;
    cur.pasaloAmt = Number(partAmt);
  } else if (val) {
    // full pasalo: nobody from the group played
    cur.pasalo = true;
    cur.pasaloAmt = null;
    cur.players = null; cur.rate = null;
  } else {
    // clear everything pasalo-related
    cur.pasalo = false;
    cur.pasaloAmt = null;
  }
  _writeRow(sh, row, cur);
  return _readRow(sh, row);
}

// batch: mark several bookings returned on the same date (used by "Update capital return")
// FAST: reads the whole block once, updates matching rows in memory, writes back once.
function reconcileMany(ids, paid, receipt, note) {
  var sh = _sheet();
  if (!_hasFiles(receipt)) throw new Error('Return receipt is required.');
  var url = _uploadReceipts(RETURN_FOLDER_ID, receipt, 'Return', paid + '_batch');

  var last = sh.getLastRow();
  if (last < DATA_START) return true;
  var numRows = last - DATA_START + 1;
  var grid = sh.getRange(DATA_START, 1, numRows, LAST_COL).getValues(); // single read

  var wanted = {};
  for (var k = 0; k < ids.length; k++) wanted[ids[k]] = true;

  var changed = false;
  for (var i = 0; i < grid.length; i++) {
    var id = grid[i][C.id - 1];
    if (id && wanted[id]) {
      var cur = _rowToObj(grid[i]);
      cur.returned = true; cur.paid = paid; cur.receiptReturn = url;
      if (note !== null && note !== undefined && String(note) !== '') cur.note = String(note);
      grid[i] = _buildRowArray(cur);
      changed = true;
    }
  }
  if (changed) sh.getRange(DATA_START, 1, numRows, LAST_COL).setValues(grid); // single write
  return true;
}

function deleteBooking(id) {
  var sh = _sheet();
  var row = _findRow(sh, id);
  if (row < 0) throw new Error('Booking not found.');
  sh.deleteRow(row);
  return true;
}

// ---------- EXPENSES API ----------
// Get (or create) the Expenses tab, making sure the header row is set.
function _expSheet() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(EXP_SHEET);
  if (!sh) {
    sh = ss.insertSheet(EXP_SHEET);
  }
  var head = sh.getRange(EXP_HEADER, 1, 1, EC_LAST).getValues()[0];
  if (head[EC.date - 1]     !== 'Date')        sh.getRange(EXP_HEADER, EC.date).setValue('Date');
  if (head[EC.category - 1] !== 'Category')    sh.getRange(EXP_HEADER, EC.category).setValue('Category');
  if (head[EC.desc - 1]     !== 'Description') sh.getRange(EXP_HEADER, EC.desc).setValue('Description');
  if (head[EC.amount - 1]   !== 'Amount')      sh.getRange(EXP_HEADER, EC.amount).setValue('Amount');
  if (head[EC.receipt - 1]  !== 'Receipt')     sh.getRange(EXP_HEADER, EC.receipt).setValue('Receipt');
  if (head[EC.id - 1]       !== 'ID')          sh.getRange(EXP_HEADER, EC.id).setValue('ID');
  return sh;
}

function _expRowToObj(r) {
  return {
    id: r[EC.id - 1],
    date: _fmtDate(r[EC.date - 1]),
    category: r[EC.category - 1] || '',
    desc: r[EC.desc - 1] || '',
    amount: _num(r[EC.amount - 1]) || 0,
    receipt: r[EC.receipt - 1] || null
  };
}

function _expFindRow(sh, id) {
  var last = sh.getLastRow();
  if (last < EXP_START) return -1;
  var ids = sh.getRange(EXP_START, EC.id, last - EXP_START + 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) return EXP_START + i;
  return -1;
}

// Read every expense in ONE getValues() call (fast).
function getExpenses() {
  var sh = _expSheet();
  var last = sh.getLastRow();
  var out = [];
  if (last < EXP_START) return out;
  var grid = sh.getRange(EXP_START, 1, last - EXP_START + 1, EC_LAST).getValues();
  var backfill = [];
  for (var i = 0; i < grid.length; i++) {
    var r = grid[i];
    if (!r[EC.date - 1] && !r[EC.amount - 1] && !r[EC.desc - 1]) continue; // skip blank
    if (!r[EC.id - 1]) { var nid = Utilities.getUuid(); r[EC.id - 1] = nid; backfill.push({ row: EXP_START + i, id: nid }); }
    out.push(_expRowToObj(r));
  }
  if (backfill.length) {
    for (var b = 0; b < backfill.length; b++) sh.getRange(backfill[b].row, EC.id).setValue(backfill[b].id);
    SpreadsheetApp.flush();
  }
  return out;
}

// Add or edit an expense. e = {id?, date, category, desc, amount, receipt?, keepReceipts?}
function saveExpense(e) {
  var sh = _expSheet();
  var row, cell = '';
  if (e.id) {
    row = _expFindRow(sh, e.id);
    if (row < 0) throw new Error('Expense not found.');
    cell = sh.getRange(row, EC.receipt).getValue();
  } else {
    row = Math.max(sh.getLastRow() + 1, EXP_START);
    e.id = Utilities.getUuid();
  }
  var kept  = _keepLinks(cell, e.keepReceipts);
  var added = _uploadReceipts(EXPENSE_FOLDER_ID, e.receipt, 'Expense',
                (e.date || '') + '_' + (e.category || 'expense'));
  var arr = new Array(EC_LAST);
  arr[EC.date - 1]     = e.date ? _toDate(e.date) : '';
  arr[EC.category - 1] = e.category || '';
  arr[EC.desc - 1]     = e.desc || '';
  arr[EC.amount - 1]   = Number(e.amount || 0);
  arr[EC.receipt - 1]  = _joinLinks(kept.join('\n'), added);
  arr[EC.id - 1]       = e.id;
  sh.getRange(row, 1, 1, EC_LAST).setValues([arr]);
  return _expRowToObj(sh.getRange(row, 1, 1, EC_LAST).getValues()[0]);
}

function deleteExpense(id) {
  var sh = _expSheet();
  var row = _expFindRow(sh, id);
  if (row < 0) throw new Error('Expense not found.');
  sh.deleteRow(row);
  return true;
}
