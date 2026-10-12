/**
 * MedTrack - Setup.gs
 * One-run setup (sheets, formatting, validation, settings, trigger), demo data,
 * the Excel importer and the spreadsheet menu.
 */

/* ------------------------------- Menu -------------------------------- */

/** Adds a MedTrack menu to the spreadsheet for non-technical admin tasks. */
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('MedTrack')
      .addItem('Set up / repair sheets', 'runSetup')
      .addItem('Load demo data', 'seedSampleData')
      .addSeparator()
      .addItem('Send test alert', 'menuTestAlert_')
      .addItem('Run expiry check now', 'menuRunAlerts_')
      .addItem('Check data integrity', 'menuReconcile_')
      .addItem('Reinstall daily trigger', 'menuTrigger_')
      .addSeparator()
      .addItem('Clear ALL data (start fresh)', 'resetAllData')
      .addToUi();
  } catch (e) { /* not opened from the spreadsheet UI */ }
}

/** Shows a message in the spreadsheet UI when possible, otherwise logs it. */
function notify_(msg) {
  console.log(msg);
  try { SpreadsheetApp.getUi().alert('MedTrack', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* editor run */ }
}

/** Menu wrapper: test alert. */
function menuTestAlert_() {
  try {
    var r = sendTestAlert_();
    notify_(r.results.map(function (x) { return x.channel + ': ' + x.detail; }).join('\n'));
  } catch (e) { notify_(e.isUser ? e.message : 'Could not send the test alert: ' + e); }
}

/** Menu wrapper: run the daily check on demand. */
function menuRunAlerts_() {
  var r = runAlertsNow_().result;
  notify_(r.note || r.channels.map(function (c) { return c.channel + ': ' + c.status; }).join('\n'));
}

/** Menu wrapper: ledger integrity check. */
function menuReconcile_() {
  var r = reconcile_(false);
  notify_(r.mismatches.length ? r.mismatches.length + ' batch(es) do not match the movement ledger. Open MedTrack > Settings > Check data integrity to repair.' : 'All ' + r.checked + ' batches reconcile with the ' + r.movements + ' recorded movements.');
}

/** Menu wrapper: reinstall trigger. */
function menuTrigger_() {
  installDailyTrigger_();
  notify_('Daily alert trigger installed for ' + getSettings_().DailyAlertTime + ' (Asia/Manila).');
}

/* ------------------------------ runSetup ----------------------------- */

/** Rows pre-formatted per sheet so text/date columns never get reinterpreted by Sheets. */
function formatRowsFor_(name) {
  return { Products: 2000, Batches: 5000, Deliveries: 2000, Accounts: 1000, Movements: 8000, AlertLog: 8000, Settings: 100 }[name] || 1000;
}

/** Creates (or repairs) one table sheet: headers, styling, frozen row, formats, validation. */
function ensureSheet_(ss, name) {
  var cols = schemaOf_(name);
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  var want = formatRowsFor_(name);
  if (sh.getMaxRows() < want + 1) sh.insertRowsAfter(sh.getMaxRows(), want + 1 - sh.getMaxRows());
  if (sh.getMaxColumns() < cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), cols.length - sh.getMaxColumns());
  var head = sh.getRange(1, 1, 1, cols.length);
  head.setValues([cols.map(function (c) { return c[0]; })]);
  head.setBackground('#0F2A44').setFontColor('#FFFFFF').setFontWeight('bold').setVerticalAlignment('middle');
  sh.setRowHeight(1, 30);
  sh.setFrozenRows(1);
  var fmt = [];
  var row = cols.map(function (c) { return c[1] === 'n' ? '#,##0.##' : (c[1] === 'b' ? 'General' : '@'); });
  for (var i = 0; i < want; i++) fmt.push(row);
  sh.getRange(2, 1, want, cols.length).setNumberFormats(fmt);
  var widths = { s: 150, n: 90, d: 105, t: 170, b: 70 };
  cols.forEach(function (c, i2) { sh.setColumnWidth(i2 + 1, /ID$/.test(c[0]) ? 130 : (widths[c[1]] || 120)); });
  return sh;
}

/** Applies list/checkbox/number validation to the key columns of each sheet. */
function applyValidation_(ss) {
  function col(name, header) { return schemaOf_(name).map(function (c) { return c[0]; }).indexOf(header) + 1; }
  function range(name, header) { var s = ss.getSheetByName(name); return s.getRange(2, col(name, header), formatRowsFor_(name), 1); }
  function list(name, header, values) { range(name, header).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build()); }
  function check(name, header) { range(name, header).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build()); }
  function num(name, header) { range(name, header).setDataValidation(SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build()); }
  list('Batches', 'Status', BATCH_STATUSES);
  list('Accounts', 'Type', ACCOUNT_TYPES);
  list('Movements', 'Type', MOVEMENT_TYPES);
  list('Movements', 'Source', ['Hand', 'Consignment']);
  check('Products', 'Active');
  check('Accounts', 'Active');
  ['UnitCost', 'SellingPrice', 'ReorderLevel'].forEach(function (h) { num('Products', h); });
  ['QtyReceived', 'QtyOnHand'].forEach(function (h) { num('Batches', h); });

  var bs = ss.getSheetByName('Batches');
  var statusRange = bs.getRange(2, col('Batches', 'Status'), formatRowsFor_('Batches'), 1);
  var rules = [['Expired', '#FDECEF', '#B4233C'], ['Near Expiry', '#FFF1CF', '#8A5A00'], ['Active', '#E3F5EC', '#12724A'], ['Pulled Out', '#EEF1F4', '#5B6F83'], ['Depleted', '#EEF1F4', '#5B6F83']].map(function (r) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(r[0]).setBackground(r[1]).setFontColor(r[2]).setRanges([statusRange]).build();
  });
  bs.setConditionalFormatRules(rules);
}

/** Creates the Import sheet where the old Excel data is pasted. */
function ensureImportSheet_(ss) {
  var sh = ss.getSheetByName(SH.IMPORT) || ss.insertSheet(SH.IMPORT);
  if (sh.getMaxColumns() < IMPORT_HEADERS.length) sh.insertColumnsAfter(sh.getMaxColumns(), IMPORT_HEADERS.length - sh.getMaxColumns());
  var head = sh.getRange(1, 1, 1, IMPORT_HEADERS.length);
  head.setValues([IMPORT_HEADERS]).setBackground('#0E9AA7').setFontColor('#FFFFFF').setFontWeight('bold');
  sh.getRange(1, IMPORT_HEADERS.length).setBackground('#5B6F83');
  sh.setFrozenRows(1);
  sh.getRange(2, 1, 2000, 7).setNumberFormat('@');
  sh.setColumnWidths(1, IMPORT_HEADERS.length, 120);
  sh.getRange('N1').setValue('Paste your Excel rows under the headers (columns A to K). Leave ImportStatus empty. Then open MedTrack > More > Import.').setFontStyle('italic').setFontColor('#5B6F83');
  return sh;
}

/** Creates or repairs every table sheet of one spreadsheet (master copy or a medrep's own). */
function setupSpreadsheet_(ss, opts) {
  opts = opts || {};
  ss.setSpreadsheetTimeZone(APP.TZ);
  Object.keys(SCHEMA).forEach(function (name) { ensureSheet_(ss, name); });
  ensureImportSheet_(ss);
  applyValidation_(ss);

  var existing = {};
  readTable_(SH.SETTINGS, ss).rows.forEach(function (r) { existing[r.Key] = true; });
  var email = opts.email || '';
  if (!email && !opts.tenant) { try { email = Session.getEffectiveUser().getEmail() || ''; } catch (e) { email = ''; } }
  var add = DEFAULT_SETTINGS.filter(function (d) { return !existing[d[0]]; }).map(function (d) {
    var v = d[1];
    if (d[0] === 'AlertEmail') v = email;
    if (d[0] === 'BusinessName' && opts.businessName) v = opts.businessName;
    return { Key: d[0], Value: v, Description: d[2] };
  });
  if (add.length) appendRows_(SH.SETTINGS, add, ss);

  var blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);
  var order = ['Products', 'Batches', 'Deliveries', 'Accounts', 'Movements', 'AlertLog', 'Settings', 'Import'];
  order.forEach(function (n, i) { var sh = ss.getSheetByName(n); if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); } });
}

/** One-run setup: sheets, formatting, validation, default settings and the daily trigger. Safe to run again. */
function runSetup() {
  var ss = getSS_();
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());
  setupSpreadsheet_(ss, {});
  installDailyTrigger_();
  invalidateCache_();
  notify_('MedTrack is set up.\n\nNext: add your Telegram details in the app (More > Settings), deploy the web app, and open it on your phone.\nTo try it with demo data run: MedTrack menu > Load demo data.\nTo sell to several medreps with their own logins, run runMultiUserSetup.');
}

/* ------------------------------ Demo data ---------------------------- */

/** Fills the system with realistic Philippine sample data. Only runs on an empty system. */
function seedSampleData() {
  try { seedDemoData_(); }
  catch (e) { if (e && e.isUser) { notify_(e.message); return; } throw e; }
  notify_('Demo data loaded: 15 products, 30 batches, 8 accounts and a movement history. Open the web app to explore.');
}

/** Loads the demo data into the current spreadsheet (used by the menu and by Settings in the app). */
function seedDemoData_() {
  runSetupIfNeeded_();
  if (readTable_(SH.PRODUCTS).rows.length || readTable_(SH.BATCHES).rows.length) {
    throw userError_('Sample data was not loaded because there is already data here. Clear it first if you want a fresh start.');
  }
  withLock_(function () {
    var today = todayYMD_(), now = nowISO_();
    var taken = {};
    function id(prefix) { var x = uniqueId_(prefix, taken, ''); taken[x] = true; return x; }

    var P = [
      ['Amoxiflex', 'Amoxicillin', '500 mg', 'Capsule', 'Box of 100', 'Zenith Pharma Phils.', 420, 560, 20],
      ['Cefurox', 'Cefuroxime', '500 mg', 'Tablet', 'Box of 10', 'Zenith Pharma Phils.', 310, 420, 15],
      ['Azithrocin', 'Azithromycin', '500 mg', 'Tablet', 'Box of 3', 'Luzon BioMed', 190, 260, 20],
      ['Losarvas', 'Losartan', '50 mg', 'Tablet', 'Box of 30', 'Luzon BioMed', 240, 330, 25],
      ['Amlodex', 'Amlodipine', '10 mg', 'Tablet', 'Box of 30', 'Mabuhay Labs', 150, 215, 25],
      ['Metformax', 'Metformin', '500 mg', 'Tablet', 'Box of 100', 'Mabuhay Labs', 180, 250, 20],
      ['Atorvaxin', 'Atorvastatin', '20 mg', 'Tablet', 'Box of 30', 'Luzon BioMed', 380, 520, 15],
      ['Omeprolex', 'Omeprazole', '20 mg', 'Capsule', 'Box of 28', 'Visayas Therapeutics', 210, 290, 20],
      ['Cetrizen', 'Cetirizine', '10 mg', 'Tablet', 'Box of 100', 'Visayas Therapeutics', 160, 230, 20],
      ['Salbuvent', 'Salbutamol', '2 mg/5 mL', 'Syrup', '60 mL bottle', 'Visayas Therapeutics', 55, 85, 30],
      ['Paracet Kids', 'Paracetamol', '120 mg/5 mL', 'Suspension', '60 mL bottle', 'Mabuhay Labs', 38, 60, 40],
      ['Ibuprox', 'Ibuprofen', '400 mg', 'Tablet', 'Box of 100', 'Zenith Pharma Phils.', 260, 360, 15],
      ['Cotrimox', 'Co-trimoxazole', '800/160 mg', 'Tablet', 'Box of 100', 'Zenith Pharma Phils.', 290, 390, 10],
      ['Gliclaze', 'Gliclazide', '60 mg MR', 'Tablet', 'Box of 30', 'Luzon BioMed', 420, 580, 10],
      ['Vitamax C+Zn', 'Ascorbic acid + Zinc', '500 mg/10 mg', 'Capsule', 'Box of 100', 'Mabuhay Labs', 340, 480, 20]
    ].map(function (r) {
      return { ProductID: id('PRD'), BrandName: r[0], GenericName: r[1], Dosage: r[2], Form: r[3], PackSize: r[4], Principal: r[5], UnitCost: r[6], SellingPrice: r[7], ReorderLevel: r[8], Active: true, CreatedAt: now, UpdatedAt: now };
    });

    var A = [
      ['Dr. Maria Santos', 'Doctor', 'Katipunan Ave, Quezon City', 'Maria Santos', '0917 555 0101'],
      ['Dr. Ramon dela Cruz', 'Doctor', 'Ayala Ave, Makati City', 'Clinic secretary', '0918 555 0102'],
      ['Dr. Lorna Villanueva', 'Doctor', 'Ortigas Ave, Pasig City', 'Lorna Villanueva', '0920 555 0103'],
      ['Botica Bayanihan', 'Pharmacy', 'Sumulong Hwy, Marikina City', 'Aling Susan', '(02) 8555 0104'],
      ['Rosario Drugstore', 'Pharmacy', 'Ortigas Ext, Cainta, Rizal', 'Mr. Jun Reyes', '0927 555 0105'],
      ['Healthfirst Pharmacy', 'Pharmacy', 'Sumulong Hwy, Antipolo City', 'Ms. Grace Tan', '0915 555 0106'],
      ['Calayan Medical Center', 'Hospital', 'C. Raymundo Ave, Pasig City', 'Purchasing Office', '(02) 8555 0107'],
      ['Sampaguita Family Clinic', 'Clinic', 'Bonifacio Global City, Taguig', 'Nurse Joy', '0919 555 0108']
    ].map(function (r) {
      return { AccountID: id('ACC'), Name: r[0], Type: r[1], Address: r[2], ContactPerson: r[3], ContactNo: r[4], Active: true };
    });

    var D = [[120, 'DR-2026-0412'], [60, 'DR-2026-0587'], [14, 'DR-2026-0733']].map(function (r) {
      return { DeliveryID: id('DEL'), DeliveryDate: addDaysYMD_(today, -r[0]), ReferenceNo: r[1], Notes: 'Company delivery', CreatedAt: now, RequestID: '', _ago: r[0] };
    });

    // [product#, lot, days to expiry, qty received, delivery#]
    var B = [
      [0, 'AX2407', -18, 60, 0], [0, 'AX2511', 74, 80, 0], [0, 'AX2603', 310, 120, 2],
      [1, 'CF2410', 12, 40, 0], [1, 'CF2606', 420, 60, 2],
      [2, 'AZ2408', 27, 30, 0], [2, 'AZ2602', 160, 45, 1],
      [3, 'LS2501', 130, 100, 0], [3, 'LS2703', 640, 120, 2],
      [4, 'AM2412', -6, 80, 0], [4, 'AM2604', 176, 90, 1],
      [5, 'MF2509', 58, 120, 0], [5, 'MF2701', 540, 100, 2],
      [6, 'AT2511', 86, 50, 1], [6, 'AT2705', 700, 60, 2],
      [7, 'OM2410', 20, 60, 0], [7, 'OM2606', 330, 70, 1],
      [8, 'CZ2512', 105, 150, 1], [8, 'CZ2708', 590, 120, 2],
      [9, 'SB2411', 35, 80, 0], [9, 'SB2607', 260, 90, 2],
      [10, 'PK2509', 64, 120, 1], [10, 'PK2702', 480, 150, 2],
      [11, 'IB2510', 95, 70, 1],
      [12, 'CT2408', 5, 24, 0], [12, 'CT2610', 230, 4, 2],
      [13, 'GL2512', 118, 30, 1], [13, 'GL2709', 560, 40, 2],
      [14, 'VC2506', 48, 90, 0], [14, 'VC2711', 610, 100, 2]
    ].map(function (r) {
      var d = D[r[4]];
      return { BatchID: id('BAT'), ProductID: P[r[0]].ProductID, LotNumber: r[1], ExpiryDate: addDaysYMD_(today, r[2]), QtyReceived: r[3], QtyOnHand: r[3], DeliveryID: d.DeliveryID, Status: '', CreatedAt: now, UpdatedAt: now, _ago: d._ago };
    });

    // [days ago, batch#(1-based), account#(1-based or 0), type, source, qty, price, notes]
    var M = [
      [100, 1, 4, 'Consignment', 'Hand', 20, 560, ''], [95, 1, 1, 'Sample', 'Hand', 10, 0, 'Clinic visit'],
      [90, 2, 5, 'Consignment', 'Hand', 25, 560, ''], [80, 2, 6, 'Sale', 'Hand', 10, 560, 'Direct purchase'],
      [85, 4, 2, 'Sample', 'Hand', 5, 0, ''], [70, 4, 7, 'Sale', 'Hand', 15, 420, ''],
      [75, 6, 3, 'Sample', 'Hand', 4, 0, ''], [70, 6, 4, 'Consignment', 'Hand', 12, 260, ''],
      [65, 8, 5, 'Consignment', 'Hand', 30, 330, ''], [60, 8, 1, 'Sample', 'Hand', 6, 0, ''],
      [55, 10, 6, 'Consignment', 'Hand', 20, 215, ''], [50, 10, 3, 'Sample', 'Hand', 8, 0, ''],
      [50, 12, 7, 'Sale', 'Hand', 20, 250, ''], [45, 16, 8, 'Sample', 'Hand', 5, 0, ''],
      [44, 16, 4, 'Consignment', 'Hand', 15, 290, ''], [40, 20, 5, 'Consignment', 'Hand', 20, 85, ''],
      [35, 25, 2, 'Sample', 'Hand', 8, 0, ''], [30, 25, 7, 'Sale', 'Hand', 6, 390, ''],
      [20, 25, 4, 'Consignment', 'Hand', 5, 390, ''], [30, 29, 1, 'Sample', 'Hand', 10, 0, ''],
      [28, 29, 8, 'Sale', 'Hand', 12, 480, ''],
      [45, 7, 6, 'Consignment', 'Hand', 20, 260, ''], [40, 7, 1, 'Sample', 'Hand', 5, 0, ''],
      [40, 11, 7, 'Sale', 'Hand', 30, 215, ''], [35, 14, 3, 'Sample', 'Hand', 6, 0, ''],
      [30, 14, 5, 'Consignment', 'Hand', 15, 520, ''], [30, 17, 8, 'Sale', 'Hand', 20, 290, ''],
      [25, 18, 1, 'Sample', 'Hand', 12, 0, ''], [25, 18, 4, 'Consignment', 'Hand', 40, 230, ''],
      [22, 22, 6, 'Consignment', 'Hand', 20, 60, ''], [20, 22, 2, 'Sample', 'Hand', 10, 0, ''],
      [18, 24, 7, 'Sale', 'Hand', 40, 360, ''], [15, 24, 8, 'Sample', 'Hand', 12, 0, ''],
      [10, 24, 4, 'Sale', 'Hand', 6, 360, ''], [12, 27, 3, 'Sample', 'Hand', 8, 0, ''],
      [12, 27, 6, 'Consignment', 'Hand', 25, 580, ''],
      [10, 3, 5, 'Sample', 'Hand', 10, 0, ''], [9, 3, 4, 'Consignment', 'Hand', 30, 560, ''],
      [8, 5, 2, 'Sample', 'Hand', 6, 0, ''], [7, 9, 7, 'Sale', 'Hand', 25, 330, ''],
      [6, 13, 1, 'Sample', 'Hand', 10, 0, ''], [5, 15, 3, 'Sample', 'Hand', 5, 0, ''],
      [4, 19, 4, 'Consignment', 'Hand', 20, 230, ''],
      [5, 8, 5, 'Return', 'Consignment', 5, 0, 'Unsold units returned'],
      [4, 2, 5, 'Sale', 'Consignment', 8, 560, 'Pharmacy sold, billed'],
      [1, 1, 0, 'Pullout', 'Hand', 15, 0, 'Expired stock set aside for return to company'],
      [3, 12, 0, 'Adjustment', 'Hand', -2, 0, 'Damaged packaging']
    ];
    M.sort(function (a, b) { return b[0] - a[0]; });

    var hand = {}, cons = {}, last = {};
    B.forEach(function (b) { hand[b.BatchID] = b.QtyReceived; cons[b.BatchID] = {}; });
    var MV = [];
    M.forEach(function (m) {
      var b = B[m[1] - 1], a = m[2] ? A[m[2] - 1] : null;
      if (m[0] >= b._ago) return;
      var e = movementEffect_(m[3], m[4], m[5]);
      if (hand[b.BatchID] + e.hand < 0) return;
      var have = a ? (cons[b.BatchID][a.AccountID] || 0) : 0;
      if (e.consign < 0 && have + e.consign < 0) return;
      hand[b.BatchID] += e.hand;
      if (a && e.consign) cons[b.BatchID][a.AccountID] = have + e.consign;
      last[b.BatchID] = m[3];
      var date = addDaysYMD_(today, -m[0]);
      MV.push({ MovementID: id('MOV'), Date: date, BatchID: b.BatchID, AccountID: a ? a.AccountID : '', Type: m[3], Qty: m[5], UnitPrice: m[6], Notes: m[7], CreatedAt: date + 'T09:00:00+08:00', RequestID: '', Source: normalizeSource_(m[3], m[4]) });
    });
    B.forEach(function (b) {
      b.QtyOnHand = hand[b.BatchID];
      var c = 0;
      for (var k in cons[b.BatchID]) c += Math.max(0, cons[b.BatchID][k]);
      b.Status = statusFor_(b, b.QtyOnHand + c, last[b.BatchID], today);
    });

    appendRows_(SH.PRODUCTS, P);
    appendRows_(SH.ACCOUNTS, A);
    appendRows_(SH.DELIVERIES, D);
    appendRows_(SH.BATCHES, B);
    appendRows_(SH.MOVEMENTS, MV);
  });
}

/** Runs setup silently if the sheets do not exist yet. */
function runSetupIfNeeded_() {
  if (!getSS_().getSheetByName(SH.PRODUCTS) || !getSS_().getSheetByName(SH.SETTINGS)) runSetup();
}

/** Deletes ALL products, batches, accounts, deliveries, movements and alert history (after confirmation). */
function resetAllData() {
  try {
    var ui = SpreadsheetApp.getUi();
    var ans = ui.alert('Clear ALL data?', 'This permanently removes every product, batch, account, delivery, movement and alert record. Settings are kept. This cannot be undone.', ui.ButtonSet.YES_NO);
    if (ans !== ui.Button.YES) return;
  } catch (e) { /* run from the editor: proceed */ }
  clearAllData_();
  notify_('All data cleared. You can start fresh.');
}

/** Removes every product, batch, account, delivery, movement and alert record of the current spreadsheet. */
function clearAllData_() {
  withLock_(function () {
    [SH.PRODUCTS, SH.BATCHES, SH.DELIVERIES, SH.ACCOUNTS, SH.MOVEMENTS, SH.ALERTLOG].forEach(function (n) {
      var sh = getSheet_(n);
      if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    });
  });
}

/* ------------------------------- Import ------------------------------ */

/** Parses flexible Excel-style dates (real dates, serials, 12/2027, Dec 2027, 31-Dec-2027...). Returns yyyy-MM-dd or ''. */
function parseDateLoose_(v) {
  if (v === '' || v == null) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return toYMD_(v);
  function build(y, mo, d) {
    var s = y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2);
    return isValidYMD_(s) ? s : '';
  }
  function lastDay(y, mo) { return mo >= 1 && mo <= 12 ? build(y, mo, new Date(Date.UTC(y, mo, 0)).getUTCDate()) : ''; }
  var months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  function mon(name) { return months[String(name).toLowerCase().substring(0, name.toLowerCase().indexOf('sept') === 0 ? 4 : 3)]; }
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) return Utilities.formatDate(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000), 'UTC', 'yyyy-MM-dd');
    return '';
  }
  var s = String(v).trim(), m;
  if (/^\d{5}$/.test(s)) return parseDateLoose_(Number(s));
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return build(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) {
    var yr = +m[3]; if (yr < 100) yr += 2000;
    var a = +m[1], b = +m[2];
    return (a > 12 && b <= 12) ? build(yr, b, a) : build(yr, a, b);
  }
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{4})$/))) return lastDay(+m[2], +m[1]);
  if ((m = s.match(/^([A-Za-z]{3,9})\.?[\s\-,]+(\d{4})$/)) && mon(m[1])) return lastDay(+m[2], mon(m[1]));
  if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/)) && mon(m[1])) return build(+m[3], mon(m[1]), +m[2]);
  if ((m = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,9})\.?[\s\-,]+(\d{4})$/)) && mon(m[2])) return build(+m[3], mon(m[2]), +m[1]);
  return '';
}

/** Reads and validates the Import sheet. Returns {rows (results), valid (clean items), counts}. */
function parseImport_(values, firstRow) {
  if (!values) { values = getSheet_(SH.IMPORT).getDataRange().getValues(); firstRow = 2; }
  var today = todayYMD_();
  var results = [], items = [], seen = {};
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var blank = true;
    for (var c = 0; c < 11; c++) if (r[c] !== '' && r[c] != null) { blank = false; break; }
    if (blank) continue;
    var res = { row: firstRow + i - 1, brand: str_(r[0], 120), lot: str_(r[6], 40), errors: [], warnings: [], status: 'ok' };
    results.push(res);
    if (String(r[11] || '').indexOf('Imported') === 0) { res.status = 'skip'; res.warnings.push('Already imported'); continue; }
    var it = {
      row: firstRow + i - 1, brand: res.brand, generic: str_(r[1], 120), dosage: str_(r[2], 60), form: str_(r[3], 40), pack: str_(r[4], 60), principal: str_(r[5], 80), lot: res.lot,
      expiry: parseDateLoose_(r[7]), qty: num_(r[8]), cost: r[9] === '' ? 0 : num_(r[9]), sell: r[10] === '' ? 0 : num_(r[10])
    };
    if (!it.brand) res.errors.push('Brand name is missing');
    if (!it.generic) res.errors.push('Generic name is missing');
    if (!it.lot) res.errors.push('Lot number is missing');
    if (!it.expiry) res.errors.push('Expiry date is missing or not a valid date');
    if (isNaN(it.qty) || it.qty < 1 || Math.floor(it.qty) !== it.qty || it.qty > APP.MAX_QTY) res.errors.push('Quantity must be a whole number, 1 or more');
    if (isNaN(it.cost) || it.cost < 0) res.errors.push('Unit cost is not a number');
    if (isNaN(it.sell) || it.sell < 0) res.errors.push('Selling price is not a number');
    if (r[9] === '' && !isNaN(it.cost)) res.warnings.push('No unit cost, set to P0');
    if (r[10] === '' && !isNaN(it.sell)) res.warnings.push('No selling price, set to P0');
    if (it.expiry && daysBetween_(today, it.expiry) < 0) res.warnings.push('Already expired, will be imported as Expired');
    if (!res.errors.length) {
      var key = [it.brand, it.dosage, it.form, it.pack].join('|').toLowerCase() + '#' + it.lot.toLowerCase();
      if (seen[key]) {
        if (seen[key].expiry !== it.expiry) res.errors.push('Lot ' + it.lot + ' already appears on row ' + seen[key].row + ' with a different expiry date');
        else { seen[key].qty += it.qty; res.warnings.push('Same product and lot as row ' + seen[key].row + ', quantities combined'); res.status = 'merged'; continue; }
      } else seen[key] = it;
    }
    if (res.errors.length) res.status = 'error';
    else items.push(it);
    res.expiry = it.expiry; res.qty = it.qty;
  }
  var counts = { total: results.length, ok: 0, errors: 0, skipped: 0, warnings: 0 };
  results.forEach(function (x) {
    if (x.status === 'error') counts.errors++; else if (x.status === 'skip') counts.skipped++; else counts.ok++;
    if (x.warnings.length && x.status !== 'skip') counts.warnings++;
  });
  return { results: results, items: items, counts: counts };
}

/** Dry-run: tells the app which rows are fine and which need fixing. */
function validateImport_(opts) {
  var p = importFromOpts_(opts);
  return { rows: p.results, counts: p.counts };
}

/** Rows pasted or uploaded in the app (no spreadsheet access needed) or, when absent, the Import sheet. */
function importFromOpts_(opts) {
  if (opts && Array.isArray(opts.rows)) {
    if (!opts.rows.length) throw userError_('Paste your rows first.');
    if (opts.rows.length > 5000) throw userError_('Please import up to 5,000 rows at a time.');
    var rows = opts.rows.map(function (r) {
      var out = [];
      for (var c = 0; c < 11; c++) { var v = Array.isArray(r) ? r[c] : ''; out.push(v == null ? '' : (typeof v === 'number' ? v : str_(v, 200))); }
      out.push('');
      return out;
    });
    var first = parseInt(opts.firstRow, 10) || 1;
    return parseImport_([IMPORT_HEADERS].concat(rows), first);
  }
  if (isMulti_()) throw userError_('Paste your rows first, or upload a CSV file.');
  return parseImport_();
}

/** Imports the valid rows: creates Products (matched by name/dosage/form/pack), Batches and one opening Delivery. */
function runImport_(opts) {
  var fromApp = !!(opts && Array.isArray(opts.rows));
  var parsed = importFromOpts_(opts);
  if (!parsed.items.length) throw userError_(parsed.counts.total ? 'There are no new valid rows to import.' : 'There is nothing to import. Paste your Excel rows first.');
  if (parsed.counts.errors && !(opts && opts.skipInvalid)) throw userError_(parsed.counts.errors + ' row(s) have problems. Fix them and check again, or choose "Import valid rows only".');
  return withLock_(function () {
    var today = todayYMD_(), now = nowISO_();
    var pt = readTable_(SH.PRODUCTS), bt = readTable_(SH.BATCHES);
    var pTaken = indexBy_(pt.rows, 'ProductID'), bTaken = indexBy_(bt.rows, 'BatchID'), dTaken = indexBy_(readTable_(SH.DELIVERIES).rows, 'DeliveryID');
    var pkey = function (x) { return [x.BrandName, x.Dosage, x.Form, x.PackSize].join('|').toLowerCase(); };
    var prodByKey = {};
    pt.rows.forEach(function (x) { prodByKey[pkey(x)] = x; });
    var lotExpiry = {};
    bt.rows.forEach(function (b) { lotExpiry[b.ProductID + '|' + b.LotNumber.toLowerCase()] = b.ExpiryDate; });

    var newProducts = [], newBatches = [], rowStatus = {};
    var delivery = { DeliveryID: uniqueId_('DEL', dTaken, ''), DeliveryDate: today, ReferenceNo: 'OPENING BALANCE', Notes: 'Imported from Excel on ' + fmtDate_(today), CreatedAt: now, RequestID: 'IMPORT-' + now };
    parsed.items.forEach(function (it) {
      var probe = { BrandName: it.brand, Dosage: it.dosage, Form: it.form, PackSize: it.pack };
      var prod = prodByKey[pkey(probe)];
      if (!prod) {
        prod = { ProductID: uniqueId_('PRD', pTaken, ''), BrandName: it.brand, GenericName: it.generic, Dosage: it.dosage, Form: it.form, PackSize: it.pack, Principal: it.principal, UnitCost: it.cost, SellingPrice: it.sell, ReorderLevel: 0, Active: true, CreatedAt: now, UpdatedAt: now };
        pTaken[prod.ProductID] = true;
        prodByKey[pkey(prod)] = prod;
        newProducts.push(prod);
      }
      var lk = prod.ProductID + '|' + it.lot.toLowerCase();
      if (lotExpiry[lk] && lotExpiry[lk] !== it.expiry) { rowStatus[it.row] = 'Skipped: lot already exists with another expiry'; return; }
      lotExpiry[lk] = it.expiry;
      var b = { BatchID: uniqueId_('BAT', bTaken, ''), ProductID: prod.ProductID, LotNumber: it.lot, ExpiryDate: it.expiry, QtyReceived: it.qty, QtyOnHand: it.qty, DeliveryID: delivery.DeliveryID, Status: '', CreatedAt: now, UpdatedAt: now };
      bTaken[b.BatchID] = true;
      b.Status = statusFor_(b, b.QtyOnHand, '', today);
      newBatches.push(b);
      rowStatus[it.row] = 'Imported ' + today;
    });
    if (newBatches.length) {
      appendRows_(SH.DELIVERIES, [delivery]);
      appendRows_(SH.PRODUCTS, newProducts);
      appendRows_(SH.BATCHES, newBatches);
    }
    var sheet = fromApp ? null : getSheet_(SH.IMPORT), last = fromApp ? 0 : sheet.getLastRow();
    if (last > 1) {
      var col = sheet.getRange(2, 12, last - 1, 1).getValues();
      Object.keys(rowStatus).forEach(function (r) { col[+r - 2][0] = rowStatus[r]; });
      parsed.results.forEach(function (x) { if (x.status === 'merged' && !col[x.row - 2][0]) col[x.row - 2][0] = 'Imported ' + today + ' (combined)'; });
      sheet.getRange(2, 12, last - 1, 1).setValues(col);
    }
    return { imported: newBatches.length, products: newProducts.length, skipped: parsed.counts.errors };
  });
}
