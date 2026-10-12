/**
 * MedTrack - Data.gs
 * Sheet I/O, cache, locking, the stock ledger engine and every write operation.
 * Rules: one getDataRange().getValues() per sheet read, batched setValues() writes,
 * LockService around every write, cache invalidated after every write.
 */

/* ----------------------------- Sheet I/O ----------------------------- */

/** Returns a sheet by name or throws a friendly error if setup was not run. */
function getSheet_(name) {
  var sh = getSS_().getSheetByName(name);
  if (!sh) throw userError_('The "' + name + '" sheet is missing. Please run runSetup from the Apps Script editor.');
  return sh;
}

/** Converts one raw cell value to the column's declared type. */
function convertCell_(v, type) {
  switch (type) {
    case 'n':
      if (v === '' || v == null) return 0;
      var n = Number(v);
      return isNaN(n) ? 0 : n;
    case 'd': return toYMD_(v);
    case 't':
      if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, APP.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
      return v == null ? '' : String(v);
    case 'b': return toBool_(v);
    default: return v == null ? '' : String(v);
  }
}

/** Reads a whole table with ONE getDataRange().getValues() call. Returns {sheet, rows}; each row has _row (sheet row number). */
function readTable_(name) {
  var sheet = getSheet_(name);
  var cols = SCHEMA[name];
  var values = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (r[0] === '' || r[0] == null) continue;
    var o = { _row: i + 1 };
    for (var c = 0; c < cols.length; c++) o[cols[c][0]] = convertCell_(r[c], cols[c][1]);
    rows.push(o);
  }
  return { sheet: sheet, rows: rows };
}

/** Converts an object to a row array in schema order. */
function objToRow_(name, o) {
  return SCHEMA[name].map(function (c) {
    var v = o[c[0]];
    if (v == null) return c[1] === 'n' ? 0 : (c[1] === 'b' ? false : '');
    return v;
  });
}

/** Appends many rows with a single setValues() call and sets their _row numbers. */
function appendRows_(name, objs) {
  if (!objs.length) return;
  var sheet = getSheet_(name);
  var start = sheet.getLastRow() + 1;
  if (start + objs.length - 1 > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), Math.max(objs.length, 500));
  var values = objs.map(function (o) { return objToRow_(name, o); });
  sheet.getRange(start, 1, values.length, SCHEMA[name].length).setValues(values);
  objs.forEach(function (o, i) { o._row = start + i; });
}

/** Overwrites one existing row (object must carry _row). */
function updateRow_(name, o) {
  getSheet_(name).getRange(o._row, 1, 1, SCHEMA[name].length).setValues([objToRow_(name, o)]);
}

/** Overwrites a whole table's body in one call (used for bulk status refresh). */
function rewriteTable_(name, objs) {
  if (!objs.length) return;
  var sheet = getSheet_(name);
  var values = objs.map(function (o) { return objToRow_(name, o); });
  sheet.getRange(2, 1, values.length, SCHEMA[name].length).setValues(values);
}

/** Strips internal fields when serialising. */
function jsonReplacer_(k, v) { return k === '_row' ? undefined : v; }

/** Returns an ID not present in the given lookup (client-supplied IDs are honoured when valid). */
function uniqueId_(prefix, taken, wanted) {
  if (wanted && isValidId_(wanted, prefix) && !taken[wanted]) return wanted;
  var id;
  do { id = newId_(prefix); } while (taken[id]);
  return id;
}

/** Indexes rows by a key field. */
function indexBy_(rows, key) {
  var m = {};
  rows.forEach(function (r) { m[r[key]] = r; });
  return m;
}

/* ------------------------------ Cache ------------------------------- */

/** Stores a large string in CacheService, split into safe-sized chunks. */
function cachePut_(str) {
  try {
    var c = CacheService.getScriptCache();
    var n = Math.ceil(str.length / APP.CACHE_CHUNK);
    if (n > 90) return;
    var o = { MT_N: String(n) };
    for (var i = 0; i < n; i++) o['MT_C' + i] = str.substr(i * APP.CACHE_CHUNK, APP.CACHE_CHUNK);
    c.putAll(o, APP.CACHE_TTL);
  } catch (e) { /* caching is an optimisation only */ }
}

/** Reads the cached dataset string (null when missing or incomplete). */
function cacheGet_() {
  try {
    var c = CacheService.getScriptCache();
    var n = parseInt(c.get('MT_N'), 10);
    if (!n) return null;
    var keys = [];
    for (var i = 0; i < n; i++) keys.push('MT_C' + i);
    var got = c.getAll(keys);
    var out = '';
    for (var j = 0; j < n; j++) {
      if (got['MT_C' + j] == null) return null;
      out += got['MT_C' + j];
    }
    return out;
  } catch (e) { return null; }
}

/** Drops the cached dataset. Called after every write. */
function invalidateCache_() {
  try {
    var c = CacheService.getScriptCache();
    var n = parseInt(c.get('MT_N'), 10) || 0;
    var keys = ['MT_N'];
    for (var i = 0; i < Math.max(n, 0); i++) keys.push('MT_C' + i);
    c.removeAll(keys);
  } catch (e) { /* ignore */ }
}

/** Runs fn while holding the script lock; invalidates the cache afterwards. */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw userError_('MedTrack is busy saving something else. Please try again in a few seconds.');
  try {
    return fn();
  } finally {
    try { SpreadsheetApp.flush(); } catch (e) { /* ignore */ }
    invalidateCache_();
    lock.releaseLock();
  }
}

/* ----------------------------- Settings ----------------------------- */

/** Returns all settings as a {key: value} map with defaults filled in. */
function getSettings_() {
  var map = {};
  DEFAULT_SETTINGS.forEach(function (d) { map[d[0]] = d[1]; });
  var t = readTable_(SH.SETTINGS);
  t.rows.forEach(function (r) { if (r.Key) map[r.Key] = r.Value; });
  if (!map.AlertEmail) {
    try { map.AlertEmail = Session.getEffectiveUser().getEmail() || ''; } catch (e) { /* ignore */ }
  }
  return map;
}

/** Parses "180, 90,60" into an ascending list of valid day thresholds. */
function parseThresholds_(s) {
  var seen = {}, out = [];
  String(s || '').split(/[,\s;]+/).forEach(function (x) {
    var n = parseInt(x, 10);
    if (n > 0 && n <= 730 && !seen[n]) { seen[n] = true; out.push(n); }
  });
  if (!out.length) out = [30, 60, 90, 180];
  return out.sort(function (a, b) { return a - b; });
}

/** Validates and stores settings and secrets. Secrets go to Script Properties, never the sheet. */
function saveSettings_(p) {
  var s = p.settings || {};
  var clean = {};
  if ('BusinessName' in s) { clean.BusinessName = str_(s.BusinessName, 80); if (!clean.BusinessName) throw userError_('Please enter your business name.'); }
  if ('AlertEmail' in s) {
    clean.AlertEmail = str_(s.AlertEmail, 120);
    if (clean.AlertEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.AlertEmail)) throw userError_('That email address does not look right.');
  }
  if ('TelegramChatId' in s) {
    clean.TelegramChatId = str_(s.TelegramChatId, 40);
    if (clean.TelegramChatId && !/^(-?\d{5,20}|@[A-Za-z0-9_]{4,})$/.test(clean.TelegramChatId)) throw userError_('The Telegram chat ID should be a number like 123456789.');
  }
  if ('ReportFolderUrl' in s) {
    clean.ReportFolderUrl = str_(s.ReportFolderUrl, 300);
    if (clean.ReportFolderUrl) {
      var fid = driveFolderId_(clean.ReportFolderUrl);
      if (!fid) throw userError_('That does not look like a Google Drive folder link. Open the folder in Google Drive, copy the address from the browser and paste it here.');
      try { DriveApp.getFolderById(fid).getName(); } catch (e) { throw userError_('We cannot open that folder. Make sure it exists and that it is in the same Google account that owns MedTrack.'); }
    }
  }
  ['AccentColor', 'BrandColor'].forEach(function (k) {
    if (k in s) {
      var c = str_(s[k], 7).toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(c)) throw userError_('Please pick a valid color.');
      clean[k] = c;
    }
  });
  ['EmailEnabled', 'TelegramEnabled', 'SmsEnabled'].forEach(function (k) { if (k in s) clean[k] = toBool_(s[k]) ? 'TRUE' : 'FALSE'; });
  if ('AlertThresholds' in s) clean.AlertThresholds = parseThresholds_(s.AlertThresholds).slice().reverse().join(',');
  if ('DailyAlertTime' in s) {
    var tm = str_(s.DailyAlertTime, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(tm)) throw userError_('Please enter the alert time like 07:00.');
    clean.DailyAlertTime = tm;
  }
  if ('SmsEndpoint' in s) {
    clean.SmsEndpoint = str_(s.SmsEndpoint, 300);
    if (clean.SmsEndpoint && !/^https:\/\/[^\s]+$/.test(clean.SmsEndpoint)) throw userError_('The SMS provider address must start with https://');
  }
  if ('SmsRecipient' in s) {
    clean.SmsRecipient = str_(s.SmsRecipient, 20);
    if (clean.SmsRecipient && !/^\+?\d{7,15}$/.test(clean.SmsRecipient.replace(/[\s-]/g, ''))) throw userError_('The SMS mobile number does not look right.');
    clean.SmsRecipient = clean.SmsRecipient.replace(/[\s-]/g, '');
  }
  if ('SmsSender' in s) clean.SmsSender = str_(s.SmsSender, 20);
  if ('SmsContentType' in s) clean.SmsContentType = (s.SmsContentType === 'json') ? 'json' : 'form';
  if ('SmsBodyTemplate' in s) clean.SmsBodyTemplate = str_(s.SmsBodyTemplate, 600);

  var props = PropertiesService.getScriptProperties();
  var secrets = p.secrets || {};
  if (typeof secrets.telegramToken === 'string' && secrets.telegramToken) {
    if (secrets.telegramToken === '__REMOVE__') props.deleteProperty('TELEGRAM_BOT_TOKEN');
    else if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(secrets.telegramToken.trim())) throw userError_('That Telegram bot token does not look right. Copy it again from BotFather.');
    else props.setProperty('TELEGRAM_BOT_TOKEN', secrets.telegramToken.trim());
  }
  if (typeof secrets.smsApiKey === 'string' && secrets.smsApiKey) {
    if (secrets.smsApiKey === '__REMOVE__') props.deleteProperty('SMS_API_KEY');
    else props.setProperty('SMS_API_KEY', secrets.smsApiKey.trim());
  }

  var timeChanged = false;
  withLock_(function () {
    var t = readTable_(SH.SETTINGS);
    var byKey = indexBy_(t.rows, 'Key');
    if (clean.DailyAlertTime && (!byKey.DailyAlertTime || byKey.DailyAlertTime.Value !== clean.DailyAlertTime)) timeChanged = true;
    var merged = [];
    var seen = {};
    DEFAULT_SETTINGS.forEach(function (d) {
      var cur = byKey[d[0]] ? byKey[d[0]].Value : d[1];
      merged.push({ Key: d[0], Value: (d[0] in clean) ? clean[d[0]] : cur, Description: d[2] });
      seen[d[0]] = true;
    });
    t.rows.forEach(function (r) { if (!seen[r.Key]) merged.push({ Key: r.Key, Value: r.Value, Description: r.Description }); });
    var sheet = t.sheet;
    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).clearContent();
    sheet.getRange(2, 1, merged.length, 3).setValues(merged.map(function (m) { return [m.Key, m.Value, m.Description]; }));
  });
  if (timeChanged) installDailyTrigger_();
  return { settings: getSettings_(), flags: secretFlags_() };
}

/** Extracts the folder ID from a Google Drive folder link (or a bare ID). '' when not recognised. */
function driveFolderId_(u) {
  var s = str_(u, 300);
  if (!s) return '';
  var m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : '';
}

/** Tells the client which secrets exist without ever returning them. */
function secretFlags_() {
  var props = PropertiesService.getScriptProperties();
  return { telegramTokenSet: !!props.getProperty('TELEGRAM_BOT_TOKEN'), smsKeySet: !!props.getProperty('SMS_API_KEY') };
}

/* ------------------------------ Ledger ------------------------------ */

/**
 * Effect of one movement on [stock in his hands, stock at the account on consignment].
 * Sample/Consignment/Sale(hand)/Pullout(hand) reduce his stock; Consignment adds to the account;
 * Sale/Pullout from consignment reduce only the account; Return moves units back to his hands.
 */
function movementEffect_(type, source, qty) {
  var q = Number(qty) || 0;
  var fromConsign = source === 'Consignment';
  switch (type) {
    case 'Sample': return { hand: -q, consign: 0 };
    case 'Consignment': return { hand: -q, consign: q };
    case 'Sale': return fromConsign ? { hand: 0, consign: -q } : { hand: -q, consign: 0 };
    case 'Return': return { hand: q, consign: -q };
    case 'Pullout': return fromConsign ? { hand: 0, consign: -q } : { hand: -q, consign: 0 };
    case 'Adjustment': return { hand: q, consign: 0 };
    default: return { hand: 0, consign: 0 };
  }
}

/** Normalises the Source for a movement type. */
function normalizeSource_(type, source) {
  if (type === 'Return') return 'Consignment';
  if (type === 'Sale' || type === 'Pullout') return source === 'Consignment' ? 'Consignment' : 'Hand';
  return 'Hand';
}

/** Builds hand deltas, consignment balances per batch/account and last movement type per batch. */
function buildLedger_(movements) {
  var L = { hand: {}, consign: {}, last: {} };
  movements.forEach(function (m) {
    var e = movementEffect_(m.Type, m.Source || normalizeSource_(m.Type, ''), m.Qty);
    L.hand[m.BatchID] = (L.hand[m.BatchID] || 0) + e.hand;
    if (e.consign && m.AccountID) {
      var c = L.consign[m.BatchID] || (L.consign[m.BatchID] = {});
      c[m.AccountID] = (c[m.AccountID] || 0) + e.consign;
    }
    L.last[m.BatchID] = m.Type;
  });
  return L;
}

/** Total units of a batch sitting on consignment across all accounts. */
function consignTotal_(L, batchId) {
  var c = L.consign[batchId], t = 0;
  if (c) for (var k in c) if (c[k] > 0) t += c[k];
  return t;
}

/** Derives a batch's status from stock, expiry and the last movement. */
function statusFor_(batch, stockTotal, lastType, today) {
  if (stockTotal <= 0) return lastType === 'Pullout' ? 'Pulled Out' : 'Depleted';
  var d = daysBetween_(today, batch.ExpiryDate);
  if (d < 0) return 'Expired';
  if (d <= 180) return 'Near Expiry';
  return 'Active';
}

/** Recalculates every batch's Status (daily job and integrity tools). Returns {changed, total}. */
function recalcStatuses_() {
  return withLock_(function () {
    var b = readTable_(SH.BATCHES), m = readTable_(SH.MOVEMENTS);
    var L = buildLedger_(m.rows), today = todayYMD_(), now = nowISO_(), changed = 0;
    b.rows.forEach(function (x) {
      var st = statusFor_(x, x.QtyOnHand + consignTotal_(L, x.BatchID), L.last[x.BatchID], today);
      if (st !== x.Status) { x.Status = st; x.UpdatedAt = now; changed++; }
    });
    if (changed) rewriteTable_(SH.BATCHES, b.rows);
    return { changed: changed, total: b.rows.length };
  });
}

/** Checks QtyOnHand against the Movements ledger; optionally repairs mismatches. */
function reconcile_(fix) {
  return withLock_(function () {
    var b = readTable_(SH.BATCHES), m = readTable_(SH.MOVEMENTS), p = readTable_(SH.PRODUCTS);
    var pm = indexBy_(p.rows, 'ProductID');
    var L = buildLedger_(m.rows), today = todayYMD_(), now = nowISO_();
    var bad = [], fixed = 0;
    b.rows.forEach(function (x) {
      var expected = x.QtyReceived + (L.hand[x.BatchID] || 0);
      if (expected !== x.QtyOnHand) {
        bad.push({ batchId: x.BatchID, product: pm[x.ProductID] ? pm[x.ProductID].BrandName : x.ProductID, lot: x.LotNumber, recorded: x.QtyOnHand, expected: expected });
        if (fix) {
          x.QtyOnHand = expected;
          x.Status = statusFor_(x, expected + consignTotal_(L, x.BatchID), L.last[x.BatchID], today);
          x.UpdatedAt = now;
          fixed++;
        }
      }
    });
    if (fixed) rewriteTable_(SH.BATCHES, b.rows);
    var negative = [];
    for (var bid in L.consign) for (var aid in L.consign[bid]) if (L.consign[bid][aid] < 0) negative.push({ batchId: bid, accountId: aid, qty: L.consign[bid][aid] });
    return { checked: b.rows.length, mismatches: bad, negativeConsignments: negative, fixed: fixed, movements: m.rows.length };
  });
}

/* ------------------------------ Dataset ------------------------------ */

/** Reads every table once and returns the client dataset object. */
function buildDataset_() {
  var d = {};
  d.products = readTable_(SH.PRODUCTS).rows;
  d.batches = readTable_(SH.BATCHES).rows;
  d.deliveries = readTable_(SH.DELIVERIES).rows;
  d.accounts = readTable_(SH.ACCOUNTS).rows;
  d.movements = readTable_(SH.MOVEMENTS).rows;
  var alerts = readTable_(SH.ALERTLOG).rows;
  d.alerts = alerts.slice(-150);
  d.settings = getSettings_();
  return d;
}

/** Returns the full dataset as a JSON string (cached). One call powers the whole app. */
function loadAll_() {
  var json = cacheGet_();
  if (!json) {
    json = JSON.stringify(buildDataset_(), jsonReplacer_);
    cachePut_(json);
  }
  var ss = getSS_();
  var imp = ss.getSheetByName(SH.IMPORT);
  var flags = secretFlags_();
  flags.sheetUrl = ss.getUrl() + (imp ? '#gid=' + imp.getSheetId() : '');
  flags.version = APP.VERSION;
  var appUrl = '';
  try { appUrl = ScriptApp.getService().getUrl() || ''; } catch (e) { /* ignore */ }
  flags.appUrl = appUrl;
  return '{"ok":true,"today":"' + todayYMD_() + '","flags":' + JSON.stringify(flags) + ',"data":' + json + '}';
}

/* ------------------------- Products / Accounts ------------------------ */

/** Parses a number from user input, tolerating ₱ and commas. NaN when invalid. */
function num_(v) {
  if (typeof v === 'number') return v;
  var s = String(v == null ? '' : v).replace(/[₱,\s]/g, '');
  if (s === '') return NaN;
  return Number(s);
}

/** Validates product input and returns a clean copy. */
function cleanProduct_(p) {
  var o = {
    BrandName: str_(p.brandName, 120), GenericName: str_(p.genericName, 120), Dosage: str_(p.dosage, 60),
    Form: str_(p.form, 40), PackSize: str_(p.packSize, 60), Principal: str_(p.principal, 80)
  };
  if (!o.BrandName) throw userError_('Please enter the brand name.');
  if (!o.GenericName) throw userError_('Please enter the generic name.');
  var cost = p.unitCost === '' || p.unitCost == null ? 0 : num_(p.unitCost);
  var sell = p.sellingPrice === '' || p.sellingPrice == null ? 0 : num_(p.sellingPrice);
  var reorder = p.reorderLevel === '' || p.reorderLevel == null ? 0 : num_(p.reorderLevel);
  if (isNaN(cost) || cost < 0 || cost > 10000000) throw userError_('Unit cost must be a number, 0 or more.');
  if (isNaN(sell) || sell < 0 || sell > 10000000) throw userError_('Selling price must be a number, 0 or more.');
  if (isNaN(reorder) || reorder < 0 || reorder > APP.MAX_QTY || Math.floor(reorder) !== reorder) throw userError_('Reorder level must be a whole number, 0 or more.');
  o.UnitCost = Math.round(cost * 100) / 100;
  o.SellingPrice = Math.round(sell * 100) / 100;
  o.ReorderLevel = reorder;
  return o;
}

/** Creates or updates a product. Archiving is done with setActive_, never deletion. */
function saveProduct_(p) {
  var c = cleanProduct_(p);
  return withLock_(function () {
    var t = readTable_(SH.PRODUCTS), now = nowISO_();
    var byId = indexBy_(t.rows, 'ProductID');
    var key = function (x) { return [x.BrandName, x.Dosage, x.Form, x.PackSize].join('|').toLowerCase(); };
    var existing = p.productId ? byId[p.productId] : null;
    var clash = t.rows.filter(function (x) { return x.ProductID !== (existing && existing.ProductID) && key(x) === key(c); })[0];
    if (clash) throw userError_(c.BrandName + ' ' + c.Dosage + ' (' + c.Form + ', ' + c.PackSize + ') is already in your product list.');
    var obj;
    if (existing) {
      obj = existing;
      for (var k in c) obj[k] = c[k];
      obj.UpdatedAt = now;
      updateRow_(SH.PRODUCTS, obj);
    } else {
      obj = c;
      obj.ProductID = uniqueId_('PRD', byId, p.productId);
      obj.Active = true; obj.CreatedAt = now; obj.UpdatedAt = now;
      appendRows_(SH.PRODUCTS, [obj]);
    }
    return { changes: { products: [obj] } };
  });
}

/** Archives or restores a product (never deletes). */
function setProductActive_(p) {
  return withLock_(function () {
    var t = readTable_(SH.PRODUCTS);
    var obj = indexBy_(t.rows, 'ProductID')[p.productId];
    if (!obj) throw userError_('That product could not be found.');
    obj.Active = !!p.active; obj.UpdatedAt = nowISO_();
    updateRow_(SH.PRODUCTS, obj);
    return { changes: { products: [obj] } };
  });
}

/** Creates or updates an account (doctor, pharmacy, hospital, clinic). */
function saveAccount_(p) {
  var o = { Name: str_(p.name, 120), Type: str_(p.type, 20), Address: str_(p.address, 200), ContactPerson: str_(p.contactPerson, 100), ContactNo: str_(p.contactNo, 40) };
  if (!o.Name) throw userError_('Please enter the account name.');
  if (ACCOUNT_TYPES.indexOf(o.Type) < 0) throw userError_('Please choose the account type.');
  if (o.ContactNo && !/^[0-9+()\-\s\/]{5,40}$/.test(o.ContactNo)) throw userError_('The contact number should only have digits, spaces, + or -.');
  return withLock_(function () {
    var t = readTable_(SH.ACCOUNTS);
    var byId = indexBy_(t.rows, 'AccountID');
    var existing = p.accountId ? byId[p.accountId] : null;
    var obj;
    if (existing) {
      obj = existing;
      for (var k in o) obj[k] = o[k];
      updateRow_(SH.ACCOUNTS, obj);
    } else {
      obj = o;
      obj.AccountID = uniqueId_('ACC', byId, p.accountId);
      obj.Active = true;
      appendRows_(SH.ACCOUNTS, [obj]);
    }
    return { changes: { accounts: [obj] } };
  });
}

/** Archives or restores an account (never deletes). */
function setAccountActive_(p) {
  return withLock_(function () {
    var t = readTable_(SH.ACCOUNTS);
    var obj = indexBy_(t.rows, 'AccountID')[p.accountId];
    if (!obj) throw userError_('That account could not be found.');
    obj.Active = !!p.active;
    updateRow_(SH.ACCOUNTS, obj);
    return { changes: { accounts: [obj] } };
  });
}

/* ------------------------------ Deliveries ---------------------------- */

/** Logs a delivery with several line items; creates one batch per line. All-or-nothing. */
function receiveDelivery_(p) {
  var today = todayYMD_();
  var date = p.deliveryDate || today;
  if (!isValidYMD_(date)) throw userError_('Please choose a valid delivery date.');
  if (daysBetween_(today, date) > 0) throw userError_('The delivery date cannot be in the future.');
  var ref = str_(p.referenceNo, 60), notes = str_(p.notes, 500);
  var lines = p.lines;
  if (!Array.isArray(lines) || !lines.length) throw userError_('Add at least one item to the delivery.');
  if (lines.length > APP.MAX_LINES) throw userError_('A delivery can have up to ' + APP.MAX_LINES + ' items. Please split it.');

  var clean = lines.map(function (l, i) {
    var n = i + 1;
    var lot = str_(l.lotNumber, 40), qty = num_(l.qty);
    if (!l.productId) throw userError_('Item ' + n + ': please choose a product.');
    if (!lot) throw userError_('Item ' + n + ': please enter the lot number.');
    if (!isValidYMD_(l.expiryDate)) throw userError_('Item ' + n + ': please enter a valid expiry date.');
    if (daysBetween_(today, l.expiryDate) <= 0) throw userError_('Item ' + n + ': the expiry date must be in the future. Expired stock should not be received.');
    if (isNaN(qty) || qty < 1 || qty > APP.MAX_QTY || Math.floor(qty) !== qty) throw userError_('Item ' + n + ': quantity must be a whole number, 1 or more.');
    return { productId: l.productId, lot: lot, expiry: l.expiryDate, qty: qty, batchId: l.batchId };
  });

  return withLock_(function () {
    var dt = readTable_(SH.DELIVERIES);
    if (p.requestId) {
      var dup = dt.rows.filter(function (d) { return d.RequestID === p.requestId; })[0];
      if (dup) return { changes: {}, duplicate: true, warnings: [] };
    }
    var pt = readTable_(SH.PRODUCTS), bt = readTable_(SH.BATCHES);
    var prodById = indexBy_(pt.rows, 'ProductID');
    var batchById = indexBy_(bt.rows, 'BatchID');
    var delById = indexBy_(dt.rows, 'DeliveryID');
    var lotExpiry = {};
    bt.rows.forEach(function (b) { lotExpiry[b.ProductID + '|' + b.LotNumber.toLowerCase()] = b.ExpiryDate; });

    var warnings = [];
    clean.forEach(function (l, i) {
      var prod = prodById[l.productId];
      if (!prod) throw userError_('Item ' + (i + 1) + ': that product could not be found.');
      if (!prod.Active) throw userError_('Item ' + (i + 1) + ': ' + prod.BrandName + ' is archived. Restore it first.');
      var key = l.productId + '|' + l.lot.toLowerCase();
      if (lotExpiry[key] && lotExpiry[key] !== l.expiry) throw userError_('Item ' + (i + 1) + ': lot ' + l.lot + ' of ' + prod.BrandName + ' is already recorded with expiry ' + fmtDate_(lotExpiry[key]) + '. A lot has one expiry date, please check it.');
      lotExpiry[key] = l.expiry;
      var left = daysBetween_(today, l.expiry);
      if (left <= 180) warnings.push(prod.BrandName + ' lot ' + l.lot + ' arrived with only ' + left + ' days left.');
    });

    var now = nowISO_();
    var delivery = { DeliveryID: uniqueId_('DEL', delById, p.deliveryId), DeliveryDate: date, ReferenceNo: ref, Notes: notes, CreatedAt: now, RequestID: p.requestId || '' };
    var newBatches = [];
    clean.forEach(function (l) {
      var id = uniqueId_('BAT', batchById, l.batchId);
      batchById[id] = true;
      var left = daysBetween_(today, l.expiry);
      newBatches.push({ BatchID: id, ProductID: l.productId, LotNumber: l.lot, ExpiryDate: l.expiry, QtyReceived: l.qty, QtyOnHand: l.qty, DeliveryID: delivery.DeliveryID, Status: left <= 180 ? 'Near Expiry' : 'Active', CreatedAt: now, UpdatedAt: now });
    });
    appendRows_(SH.DELIVERIES, [delivery]);
    appendRows_(SH.BATCHES, newBatches);
    return { changes: { deliveries: [delivery], batches: newBatches }, warnings: warnings };
  });
}

/* ------------------------------ Movements ----------------------------- */

/** Records one stock movement and updates the batch quantity in the same locked step. */
function recordMovement_(p) {
  var today = todayYMD_();
  var type = p.type;
  if (MOVEMENT_TYPES.indexOf(type) < 0) throw userError_('Please choose what kind of movement this is.');
  var date = p.date || today;
  if (!isValidYMD_(date)) throw userError_('Please choose a valid date.');
  if (daysBetween_(today, date) > 0) throw userError_('The date cannot be in the future.');
  var qty = num_(p.qty);
  if (isNaN(qty) || Math.floor(qty) !== qty || qty === 0 || Math.abs(qty) > APP.MAX_QTY) throw userError_('Quantity must be a whole number.');
  if (type !== 'Adjustment' && qty < 0) throw userError_('Quantity must be 1 or more.');
  var price = p.unitPrice === '' || p.unitPrice == null ? 0 : num_(p.unitPrice);
  if (isNaN(price) || price < 0 || price > 10000000) throw userError_('Unit price must be a number, 0 or more.');
  var notes = str_(p.notes, 500);
  if (type === 'Adjustment' && !notes) throw userError_('Please add a short reason for the adjustment.');
  var source = normalizeSource_(type, p.source);
  if (!p.batchId) throw userError_('Please choose the batch.');
  var needsAccount = ['Sample', 'Consignment', 'Sale', 'Return'].indexOf(type) >= 0 || source === 'Consignment';
  if (needsAccount && !p.accountId) throw userError_('Please choose the account.');

  return withLock_(function () {
    var mt = readTable_(SH.MOVEMENTS);
    if (p.requestId) {
      var dup = mt.rows.filter(function (m) { return m.RequestID === p.requestId; })[0];
      if (dup) return { changes: {}, duplicate: true };
    }
    var bt = readTable_(SH.BATCHES), at = readTable_(SH.ACCOUNTS), pt = readTable_(SH.PRODUCTS);
    var batch = indexBy_(bt.rows, 'BatchID')[p.batchId];
    if (!batch) throw userError_('That batch could not be found.');
    var prod = indexBy_(pt.rows, 'ProductID')[batch.ProductID] || { BrandName: 'This product' };
    var account = null;
    if (p.accountId) {
      account = indexBy_(at.rows, 'AccountID')[p.accountId];
      if (!account) throw userError_('That account could not be found.');
      if (!account.Active && type !== 'Return' && type !== 'Pullout') throw userError_(account.Name + ' is archived. Restore it first.');
    }
    var L = buildLedger_(mt.rows);
    var eff = movementEffect_(type, source, qty);
    var left = daysBetween_(today, batch.ExpiryDate);
    if (left < 0 && ['Sample', 'Consignment', 'Sale'].indexOf(type) >= 0) {
      throw userError_('Lot ' + batch.LotNumber + ' of ' + prod.BrandName + ' expired on ' + fmtDate_(batch.ExpiryDate) + '. Expired stock can not be given out. Record a Pullout instead.');
    }
    var newHand = batch.QtyOnHand + eff.hand;
    if (newHand < 0) {
      throw userError_('Only ' + fmtInt_(batch.QtyOnHand) + ' unit' + (batch.QtyOnHand === 1 ? ' is' : 's are') + ' in your hands for lot ' + batch.LotNumber + ' of ' + prod.BrandName + '. You can not record ' + fmtInt_(Math.abs(eff.hand)) + '.');
    }
    if (eff.consign < 0) {
      var have = ((L.consign[batch.BatchID] || {})[p.accountId]) || 0;
      if (have + eff.consign < 0) {
        throw userError_((account ? account.Name : 'That account') + ' only has ' + fmtInt_(have) + ' unit' + (have === 1 ? '' : 's') + ' of lot ' + batch.LotNumber + ' on consignment.');
      }
    }
    var now = nowISO_();
    var takenIds = indexBy_(mt.rows, 'MovementID');
    var mv = {
      MovementID: uniqueId_('MOV', takenIds, p.movementId), Date: date, BatchID: batch.BatchID, AccountID: p.accountId || '',
      Type: type, Qty: qty, UnitPrice: Math.round(price * 100) / 100, Notes: notes, CreatedAt: now, RequestID: p.requestId || '', Source: source
    };
    appendRows_(SH.MOVEMENTS, [mv]);
    batch.QtyOnHand = newHand;
    var L2 = buildLedger_(mt.rows.concat([mv]));
    batch.Status = statusFor_(batch, newHand + consignTotal_(L2, batch.BatchID), type, today);
    batch.UpdatedAt = now;
    updateRow_(SH.BATCHES, batch);
    return { changes: { movements: [mv], batches: [batch] } };
  });
}
