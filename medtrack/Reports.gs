/**
 * MedTrack - Reports.gs
 * Monthly report: stock on hand, distribution per account, consignment balances,
 * near-expiry / expired items and movement history. Renders to styled HTML (preview + PDF)
 * and to an Excel workbook.
 */

/** Validates the requested date range; defaults to the current month. */
function reportRange_(p) {
  var today = todayYMD_();
  var from = p.from || today.substring(0, 8) + '01';
  var to = p.to || today;
  if (!isValidYMD_(from) || !isValidYMD_(to)) throw userError_('Please choose a valid start and end date.');
  if (from > to) throw userError_('The start date must be before the end date.');
  if (daysBetween_(from, to) > 400) throw userError_('Please pick a range of 13 months or less.');
  return { from: from, to: to };
}

/** Collects every figure the report needs from one pass over the sheets. */
function buildReportData_(range) {
  var today = todayYMD_();
  var settings = getSettings_();
  var prod = readTable_(SH.PRODUCTS).rows, prodBy = indexBy_(prod, 'ProductID');
  var accRows = readTable_(SH.ACCOUNTS).rows, accBy = indexBy_(accRows, 'AccountID');
  var batches = readTable_(SH.BATCHES).rows, batchBy = indexBy_(batches, 'BatchID');
  var moves = readTable_(SH.MOVEMENTS).rows;
  var L = buildLedger_(moves);

  var stock = [], totals = { units: 0, consigned: 0, cost: 0, sell: 0 };
  batches.forEach(function (b) {
    var p = prodBy[b.ProductID] || { BrandName: '(unknown)', GenericName: '', Dosage: '', Form: '', PackSize: '', Principal: '', UnitCost: 0, SellingPrice: 0 };
    var cons = consignTotal_(L, b.BatchID), total = b.QtyOnHand + cons;
    if (total <= 0) return;
    var days = daysBetween_(today, b.ExpiryDate);
    stock.push({
      brand: p.BrandName, generic: p.GenericName, dosage: p.Dosage, form: p.Form, pack: p.PackSize, principal: p.Principal,
      lot: b.LotNumber, expiry: b.ExpiryDate, days: days, hand: b.QtyOnHand, consigned: cons, total: total,
      cost: total * p.UnitCost, sell: total * p.SellingPrice, status: statusFor_(b, total, L.last[b.BatchID], today)
    });
    totals.units += b.QtyOnHand; totals.consigned += cons; totals.cost += total * p.UnitCost; totals.sell += total * p.SellingPrice;
  });
  stock.sort(function (a, b) { return (a.brand + a.expiry).localeCompare(b.brand + b.expiry); });

  var nearExpiry = stock.filter(function (x) { return x.days <= 180; }).sort(function (a, b) { return a.days - b.days; });

  var consignment = [];
  Object.keys(L.consign).forEach(function (bid) {
    var b = batchBy[bid]; if (!b) return;
    var p = prodBy[b.ProductID] || { BrandName: '(unknown)', Dosage: '' };
    Object.keys(L.consign[bid]).forEach(function (aid) {
      var q = L.consign[bid][aid]; if (q <= 0) return;
      var a = accBy[aid] || { Name: '(unknown account)', Type: '' };
      consignment.push({ account: a.Name, type: a.Type, brand: p.BrandName, dosage: p.Dosage, lot: b.LotNumber, expiry: b.ExpiryDate, days: daysBetween_(today, b.ExpiryDate), qty: q, value: q * (p.SellingPrice || 0) });
    });
  });
  consignment.sort(function (a, b) { return a.account.localeCompare(b.account) || a.expiry.localeCompare(b.expiry); });

  var inRange = moves.filter(function (m) { return m.Date >= range.from && m.Date <= range.to; });
  var dist = {};
  inRange.forEach(function (m) {
    if (m.Type === 'Adjustment') return;
    var key = m.AccountID || '_none';
    var a = accBy[m.AccountID] || { Name: '(No account)', Type: '' };
    var d = dist[key] || (dist[key] = { account: a.Name, type: a.Type, samples: 0, consigned: 0, sold: 0, soldValue: 0, returned: 0, pulled: 0 });
    var e = movementEffect_(m.Type, m.Source, m.Qty);
    if (m.Type === 'Sample') d.samples += m.Qty;
    else if (m.Type === 'Consignment') d.consigned += m.Qty;
    else if (m.Type === 'Sale') { d.sold += m.Qty; d.soldValue += m.Qty * m.UnitPrice; }
    else if (m.Type === 'Return') d.returned += m.Qty;
    else if (m.Type === 'Pullout') d.pulled += m.Qty;
  });
  var distribution = Object.keys(dist).map(function (k) { return dist[k]; }).sort(function (a, b) { return a.account.localeCompare(b.account); });

  var history = inRange.slice().sort(function (a, b) { return a.Date.localeCompare(b.Date) || a.CreatedAt.localeCompare(b.CreatedAt); }).map(function (m) {
    var b = batchBy[m.BatchID] || {}, p = prodBy[b.ProductID] || { BrandName: '(unknown)', Dosage: '' }, a = accBy[m.AccountID];
    return { date: m.Date, type: m.Type, brand: p.BrandName, dosage: p.Dosage, lot: b.LotNumber || '', account: a ? a.Name : '', qty: m.Qty, price: m.UnitPrice, value: m.Qty * m.UnitPrice, source: m.Source, notes: m.Notes };
  });

  var generatedAt = Utilities.formatDate(new Date(), APP.TZ, 'd MMM yyyy, h:mm a');
  return {
    business: settings.BusinessName, brand: /^#[0-9A-Fa-f]{6}$/.test(settings.BrandColor || '') ? settings.BrandColor : '#0F2A44', accent: /^#[0-9A-Fa-f]{6}$/.test(settings.AccentColor || '') ? settings.AccentColor : '#0E9AA7', from: range.from, to: range.to, today: today, generatedAt: generatedAt,
    totals: totals, stock: stock, nearExpiry: nearExpiry, expiredCount: nearExpiry.filter(function (x) { return x.days < 0; }).length,
    consignment: consignment, distribution: distribution, history: history, productCount: prod.filter(function (x) { return x.Active; }).length
  };
}

/** Pill-style label used in the report for days left. */
function reportDays_(d) {
  if (d < 0) return '<span class="p r">Expired ' + Math.abs(d) + 'd ago</span>';
  var cls = d <= 30 ? 'r' : (d <= 90 ? 'a' : (d <= 180 ? 'b' : 'g'));
  return '<span class="p ' + cls + '">' + d + ' days</span>';
}

/** Renders the report as a self-contained, print-friendly HTML document. */
function buildReportHtml_(r) {
  var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>MedTrack Report</title><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#0F2A44;font-size:11px;margin:0;padding:24px;}' +
    'h1{font-size:22px;margin:0 0 2px;color:#0F2A44;}h2{font-size:14px;margin:22px 0 6px;padding-bottom:4px;border-bottom:2px solid ' + r.accent + ';color:#0F2A44;}' +
    '.sub{color:#5B6F83;font-size:11px;margin-bottom:12px;}.band{background:' + r.brand + ';color:#fff;padding:16px 18px;border-radius:8px;}.band .sub{color:#B9CADB;margin:2px 0 0;}' +
    'table{width:100%;border-collapse:collapse;margin-top:4px;}th{background:#EAF0F5;color:#0F2A44;text-align:left;font-size:10px;text-transform:uppercase;padding:6px 6px;border-bottom:1px solid #D3DEE8;}' +
    'td{padding:5px 6px;border-bottom:1px solid #E6EDF3;vertical-align:top;}td.n,th.n{text-align:right;}tr.tot td{font-weight:bold;background:#F5F8FB;}' +
    '.p{display:inline-block;padding:1px 7px;border-radius:9px;font-weight:bold;font-size:10px;}.r{background:#FDECEF;color:#B4233C;}.a{background:#FFF1CF;color:#8A5A00;}.b{background:#E6EEFC;color:#1F55B5;}.g{background:#E3F5EC;color:#12724A;}' +
    '.kpi td{border:0;padding:0 6px 0 0;width:25%;}.k{border:1px solid #D3DEE8;border-radius:8px;padding:10px 12px;}.k b{display:block;font-size:17px;margin-top:2px;}.k span{color:#5B6F83;font-size:10px;text-transform:uppercase;}' +
    '.foot{margin-top:26px;text-align:center;color:#7A8B9C;font-size:10px;}.empty{color:#7A8B9C;font-style:italic;padding:8px 0;}' +
    '</style></head><body>';
  h += '<div class="band"><h1 style="color:#fff">' + esc_(r.business) + '</h1><div class="sub">Inventory &amp; Expiry Report &middot; ' + esc_(fmtDate_(r.from)) + ' to ' + esc_(fmtDate_(r.to)) + '</div><div class="sub">Generated ' + esc_(r.generatedAt) + ' (Asia/Manila)</div></div>';
  h += '<table class="kpi" style="margin-top:12px"><tr>' +
    '<td><div class="k"><span>Units in hand</span><b>' + fmtInt_(r.totals.units) + '</b></div></td>' +
    '<td><div class="k"><span>On consignment</span><b>' + fmtInt_(r.totals.consigned) + '</b></div></td>' +
    '<td><div class="k"><span>Value at cost</span><b>' + peso_(r.totals.cost) + '</b></div></td>' +
    '<td><div class="k"><span>Value at selling</span><b>' + peso_(r.totals.sell) + '</b></div></td></tr></table>';

  h += '<h2>1. Near-expiry and expired items (' + r.nearExpiry.length + ')</h2>';
  if (!r.nearExpiry.length) h += '<div class="empty">No stock within 180 days of expiry. </div>';
  else {
    h += '<table><tr><th>Product</th><th>Lot</th><th>Expiry</th><th>Status</th><th class="n">In hand</th><th class="n">Consigned</th></tr>';
    r.nearExpiry.forEach(function (x) {
      h += '<tr><td><b>' + esc_(x.brand) + '</b> ' + esc_(x.dosage) + '<br><span style="color:#5B6F83">' + esc_(x.generic) + '</span></td><td>' + esc_(x.lot) + '</td><td>' + esc_(fmtDate_(x.expiry)) + '</td><td>' + reportDays_(x.days) + '</td><td class="n">' + fmtInt_(x.hand) + '</td><td class="n">' + fmtInt_(x.consigned) + '</td></tr>';
    });
    h += '</table>';
  }

  h += '<h2>2. Stock on hand (' + r.stock.length + ' batches)</h2>';
  if (!r.stock.length) h += '<div class="empty">No stock recorded.</div>';
  else {
    h += '<table><tr><th>Product</th><th>Lot</th><th>Expiry</th><th class="n">In hand</th><th class="n">Consigned</th><th class="n">Value at cost</th><th class="n">Value at selling</th></tr>';
    r.stock.forEach(function (x) {
      h += '<tr><td><b>' + esc_(x.brand) + '</b> ' + esc_(x.dosage) + ' <span style="color:#5B6F83">' + esc_(x.form) + '</span></td><td>' + esc_(x.lot) + '</td><td>' + esc_(fmtDate_(x.expiry)) + '</td><td class="n">' + fmtInt_(x.hand) + '</td><td class="n">' + fmtInt_(x.consigned) + '</td><td class="n">' + peso_(x.cost) + '</td><td class="n">' + peso_(x.sell) + '</td></tr>';
    });
    h += '<tr class="tot"><td colspan="3">Total</td><td class="n">' + fmtInt_(r.totals.units) + '</td><td class="n">' + fmtInt_(r.totals.consigned) + '</td><td class="n">' + peso_(r.totals.cost) + '</td><td class="n">' + peso_(r.totals.sell) + '</td></tr></table>';
  }

  h += '<h2>3. Distribution per account (' + esc_(fmtDate_(r.from)) + ' to ' + esc_(fmtDate_(r.to)) + ')</h2>';
  if (!r.distribution.length) h += '<div class="empty">No movements in this period.</div>';
  else {
    h += '<table><tr><th>Account</th><th>Type</th><th class="n">Samples</th><th class="n">Consigned</th><th class="n">Sold</th><th class="n">Sales value</th><th class="n">Returned</th><th class="n">Pulled out</th></tr>';
    r.distribution.forEach(function (d) {
      h += '<tr><td><b>' + esc_(d.account) + '</b></td><td>' + esc_(d.type) + '</td><td class="n">' + fmtInt_(d.samples) + '</td><td class="n">' + fmtInt_(d.consigned) + '</td><td class="n">' + fmtInt_(d.sold) + '</td><td class="n">' + peso_(d.soldValue) + '</td><td class="n">' + fmtInt_(d.returned) + '</td><td class="n">' + fmtInt_(d.pulled) + '</td></tr>';
    });
    h += '</table>';
  }

  h += '<h2>4. Consignment balances (as of ' + esc_(fmtDate_(r.today)) + ')</h2>';
  if (!r.consignment.length) h += '<div class="empty">Nothing is on consignment.</div>';
  else {
    h += '<table><tr><th>Account</th><th>Product</th><th>Lot</th><th>Expiry</th><th>Status</th><th class="n">Qty</th><th class="n">Value</th></tr>';
    r.consignment.forEach(function (c) {
      h += '<tr><td><b>' + esc_(c.account) + '</b></td><td>' + esc_(c.brand) + ' ' + esc_(c.dosage) + '</td><td>' + esc_(c.lot) + '</td><td>' + esc_(fmtDate_(c.expiry)) + '</td><td>' + reportDays_(c.days) + '</td><td class="n">' + fmtInt_(c.qty) + '</td><td class="n">' + peso_(c.value) + '</td></tr>';
    });
    h += '</table>';
  }

  h += '<h2>5. Movement history (' + r.history.length + ')</h2>';
  if (!r.history.length) h += '<div class="empty">No movements in this period.</div>';
  else {
    h += '<table><tr><th>Date</th><th>Type</th><th>Product</th><th>Lot</th><th>Account</th><th class="n">Qty</th><th class="n">Unit price</th><th>Notes</th></tr>';
    r.history.forEach(function (m) {
      h += '<tr><td>' + esc_(fmtDate_(m.date)) + '</td><td>' + esc_(m.type) + (m.source === 'Consignment' && (m.type === 'Sale' || m.type === 'Pullout') ? ' (consignment)' : '') + '</td><td>' + esc_(m.brand) + ' ' + esc_(m.dosage) + '</td><td>' + esc_(m.lot) + '</td><td>' + esc_(m.account) + '</td><td class="n">' + fmtInt_(m.qty) + '</td><td class="n">' + (m.price ? peso_(m.price) : '') + '</td><td>' + esc_(m.notes) + '</td></tr>';
    });
    h += '</table>';
  }
  h += '<div class="foot">Powered by <a href="' + APP.URL + '" style="color:#5B6F83;font-weight:bold;">LAYAW SYSTEM</a></div></body></html>';
  return h;
}

/** Report preview for the app: styled HTML plus headline numbers. */
function getReportPreview_(p) {
  var r = buildReportData_(reportRange_(p));
  return { html: buildReportHtml_(r), summary: { batches: r.stock.length, nearExpiry: r.nearExpiry.length, expired: r.expiredCount, accounts: r.distribution.length, movements: r.history.length } };
}

/** Saves a report file into the Drive folder chosen in Settings. Returns null (no folder set), {url, folder} or {error}. */
function saveReportFile_(blob) {
  var link = getSettings_().ReportFolderUrl;
  if (!link) return null;
  try {
    var folder = DriveApp.getFolderById(driveFolderId_(link));
    var file = folder.createFile(blob);
    return { url: file.getUrl(), folder: folder.getName() };
  } catch (e) {
    console.error('Report save to Drive failed: ' + e);
    return { error: 'The report could not be saved to your Drive folder. Please check the folder link in Settings.' };
  }
}

/** Generates the PDF from the styled HTML template and returns it as base64. */
function exportReportPdf_(p) {
  var range = reportRange_(p);
  var html = buildReportHtml_(buildReportData_(range));
  var pdf = Utilities.newBlob(html, 'text/html', 'report.html').getAs('application/pdf');
  var name = 'MedTrack-Report-' + range.from + '_to_' + range.to + '.pdf';
  pdf.setName(name);
  return { name: name, mime: 'application/pdf', base64: Utilities.base64Encode(pdf.getBytes()), drive: saveReportFile_(pdf) };
}

/** Builds the Excel workbook sheets from report data: [{name, header, rows}]. */
function reportSheets_(r) {
  return [
    { name: 'Summary', header: ['Item', 'Value'], rows: [
      ['Business', r.business], ['Period', fmtDate_(r.from) + ' to ' + fmtDate_(r.to)], ['Generated', r.generatedAt],
      ['Active products', r.productCount], ['Units in hand', r.totals.units], ['Units on consignment', r.totals.consigned],
      ['Value at cost', r.totals.cost], ['Value at selling price', r.totals.sell], ['Batches near expiry or expired', r.nearExpiry.length]] },
    { name: 'Near-Expiry', header: ['Brand', 'Generic', 'Dosage', 'Lot', 'Expiry', 'Days left', 'In hand', 'Consigned'],
      rows: r.nearExpiry.map(function (x) { return [x.brand, x.generic, x.dosage, x.lot, x.expiry, x.days, x.hand, x.consigned]; }) },
    { name: 'Stock on Hand', header: ['Brand', 'Generic', 'Dosage', 'Form', 'Pack', 'Principal', 'Lot', 'Expiry', 'Days left', 'In hand', 'Consigned', 'Value at cost', 'Value at selling'],
      rows: r.stock.map(function (x) { return [x.brand, x.generic, x.dosage, x.form, x.pack, x.principal, x.lot, x.expiry, x.days, x.hand, x.consigned, x.cost, x.sell]; }) },
    { name: 'Per Account', header: ['Account', 'Type', 'Samples', 'Consigned', 'Sold', 'Sales value', 'Returned', 'Pulled out'],
      rows: r.distribution.map(function (d) { return [d.account, d.type, d.samples, d.consigned, d.sold, d.soldValue, d.returned, d.pulled]; }) },
    { name: 'Consignment', header: ['Account', 'Type', 'Brand', 'Dosage', 'Lot', 'Expiry', 'Days left', 'Qty', 'Value'],
      rows: r.consignment.map(function (c) { return [c.account, c.type, c.brand, c.dosage, c.lot, c.expiry, c.days, c.qty, c.value]; }) },
    { name: 'Movements', header: ['Date', 'Type', 'Brand', 'Dosage', 'Lot', 'Account', 'Qty', 'Unit price', 'Value', 'Source', 'Notes'],
      rows: r.history.map(function (m) { return [m.date, m.type, m.brand, m.dosage, m.lot, m.account, m.qty, m.price, m.value, m.source, m.notes]; }) }
  ];
}

/** Builds a temporary Google Sheet of the report, exports it as .xlsx, trashes it and returns base64. */
function exportReportXlsx_(p) {
  var range = reportRange_(p);
  var r = buildReportData_(range);
  var tmp = SpreadsheetApp.create('MedTrack report (temporary)');
  try {
    var sheets = reportSheets_(r);
    sheets.forEach(function (s, i) {
      var sh = i === 0 ? tmp.getSheets()[0].setName(s.name) : tmp.insertSheet(s.name);
      var values = [s.header].concat(s.rows.length ? s.rows : []);
      sh.getRange(1, 1, 1, s.header.length).setFontWeight('bold').setBackground('#0F2A44').setFontColor('#FFFFFF');
      sh.getRange(1, 1, values.length, s.header.length).setValues(values);
      sh.setFrozenRows(1);
      sh.autoResizeColumns(1, s.header.length);
    });
    SpreadsheetApp.flush();
    var resp = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + tmp.getId() + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new Error('XLSX export failed with HTTP ' + resp.getResponseCode());
    var xname = 'MedTrack-Report-' + range.from + '_to_' + range.to + '.xlsx';
    var xblob = resp.getBlob().setName(xname);
    return { name: xname, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: Utilities.base64Encode(xblob.getBytes()), drive: saveReportFile_(xblob) };
  } finally {
    try { DriveApp.getFileById(tmp.getId()).setTrashed(true); } catch (e) { /* ignore */ }
  }
}
