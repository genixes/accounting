/*************************************************************
 * SALT & PADDLE — FINANCIAL REPORTS (Financials.gs)
 * NEW file. Add it to the Apps Script project next to Code.gs / Api.gs.
 * It only READS the Bookings sheet and reuses helpers that already exist in
 * Code.gs: getSettings_, getCourts_, ownerPinOk_, rowCells_, asDateStr_.
 * Nothing in the existing backend is changed.
 *
 * How sales are counted
 *   - Sales   = Confirmed bookings.   Pending = on hold (shown separately).
 *   - Cancelled bookings are never counted as sales.
 *   - basis 'PLAY' : money is counted on the day(s) the court is played.
 *                    A multi-day booking is split across its days by hours.
 *   - basis 'PAID' : the whole booking is counted on the day it was submitted.
 *************************************************************/

function getFinancials(pin, from, to, basis) {
  if (!ownerPinOk_(pin)) return { ok: false, auth: false };

  from = String(from || '').trim();
  to = String(to || '').trim();
  var ISO = /^\d{4}-\d{2}-\d{2}$/;
  if (!ISO.test(from) || !ISO.test(to)) return { ok: false, msg: 'Please choose a valid date range.' };
  if (from > to) return { ok: false, msg: 'Start date must be on or before the end date.' };
  var span = finDaysBetween_(from, to) + 1;
  if (span > 800) return { ok: false, msg: 'Please choose a range of about 2 years or less.' };
  basis = String(basis || '').toUpperCase() === 'PAID' ? 'PAID' : 'PLAY';

  var s = getSettings_();
  var slotHrs = (parseInt(s['Slot Minutes'], 10) || 60) / 60;
  var nameMap = {};
  getCourts_().forEach(function (c) { nameMap[c.id] = c.name; });

  // ---- 1) flatten every booking into per-slot "entries" -------------------
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Bookings');
  var rows = sh.getDataRange().getValues();
  var entries = [];
  var cancelled = [];                         // {id, date, amount}
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var id = String(r[0]).trim();
    if (!id) continue;
    var status = String(r[13]).trim();
    if (status !== 'Confirmed' && status !== 'Pending' && status !== 'Cancelled') continue;
    var amount = Number(r[11]) || 0;
    var cells = rowCells_(r);
    var bookingDate = asDateStr_(r[5]);
    var paidDate = asDateStr_(r[1]);
    if (!ISO.test(paidDate)) paidDate = bookingDate;
    var member = String(r[10]).trim().toUpperCase() === 'YES';
    var email = String(r[4] || '').trim().toLowerCase();
    var name = String(r[2] || '').trim();

    if (!cells.length) {                      // very old / damaged row: use the summary columns
      cells = [{ date: bookingDate, court: String(r[8] || ''), start: asTimeStr_(r[6]) }];
    }
    var share = amount / cells.length;
    for (var k = 0; k < cells.length; k++) {
      var c = cells[k];
      var day = basis === 'PAID' ? paidDate : (c.date || bookingDate);
      var e = {
        id: id, status: status, date: day, share: share, hours: slotHrs,
        court: nameMap[c.court] || String(c.court || '—'),
        start: String(c.start || '').slice(0, 2),
        member: member, email: email, name: name
      };
      if (status === 'Cancelled') { cancelled.push(e); } else { entries.push(e); }
    }
  }

  // ---- 2) aggregate a date window -----------------------------------------
  function aggregate(a, b) {
    var out = {
      sales: 0, pending: 0, hours: 0, memberSales: 0,
      confIds: {}, pendIds: {}, cancelIds: {}, cancelledAmount: 0,
      monthly: {}, daily: {}, courts: {}, starts: {}, customers: {}
    };
    entries.forEach(function (e) {
      if (e.date < a || e.date > b) return;
      var isConf = e.status === 'Confirmed';
      var mKey = e.date.slice(0, 7);
      var m = out.monthly[mKey] || (out.monthly[mKey] = { sales: 0, pending: 0, ids: {} });
      var d = out.daily[e.date] || (out.daily[e.date] = { sales: 0, pending: 0 });
      if (isConf) {
        out.sales += e.share; out.hours += e.hours; out.confIds[e.id] = 1;
        if (e.member) out.memberSales += e.share;
        m.sales += e.share; m.ids[e.id] = 1; d.sales += e.share;
        var ct = out.courts[e.court] || (out.courts[e.court] = { sales: 0, hours: 0 });
        ct.sales += e.share; ct.hours += e.hours;
        var st = out.starts[e.start] || (out.starts[e.start] = 0);
        out.starts[e.start] = st + e.hours;
        var key = e.email || e.name;
        var cu = out.customers[key] || (out.customers[key] = { name: e.name || e.email, sales: 0, ids: {} });
        cu.sales += e.share; cu.ids[e.id] = 1;
      } else {
        out.pending += e.share; out.pendIds[e.id] = 1;
        m.pending += e.share; d.pending += e.share;
      }
    });
    cancelled.forEach(function (e) {
      if (e.date < a || e.date > b) return;
      out.cancelIds[e.id] = 1; out.cancelledAmount += e.share;
    });
    return out;
  }

  var cur = aggregate(from, to);
  var prevTo = finAddDays_(from, -1);
  var prevFrom = finAddDays_(from, -span);
  var prev = aggregate(prevFrom, prevTo);

  var bookings = Object.keys(cur.confIds).length;
  var money = function (n) { return Math.round(n * 100) / 100; };

  // ---- 3) shape the response ----------------------------------------------
  var monthly = [];
  var ym = from.slice(0, 7), lastYm = to.slice(0, 7), guard = 0;
  while (ym <= lastYm && guard++ < 40) {
    var mm = cur.monthly[ym] || { sales: 0, pending: 0, ids: {} };
    monthly.push({ month: ym, sales: money(mm.sales), pending: money(mm.pending), bookings: Object.keys(mm.ids).length });
    ym = finNextMonth_(ym);
  }

  var daily = null;
  if (span <= 92) {
    daily = [];
    for (var n = 0; n < span; n++) {
      var ds = finAddDays_(from, n);
      var dd = cur.daily[ds] || { sales: 0, pending: 0 };
      daily.push({ date: ds, sales: money(dd.sales), pending: money(dd.pending) });
    }
  }

  var courtsOut = Object.keys(cur.courts).map(function (k) {
    return { name: k, sales: money(cur.courts[k].sales), hours: money(cur.courts[k].hours) };
  }).sort(function (x, y) { return y.sales - x.sales; });

  var startsOut = Object.keys(cur.starts).sort().map(function (k) {
    return { start: k, hours: money(cur.starts[k]) };
  });

  var customersOut = Object.keys(cur.customers).map(function (k) {
    var c = cur.customers[k];
    return { name: c.name, sales: money(c.sales), bookings: Object.keys(c.ids).length };
  }).sort(function (x, y) { return y.sales - x.sales; }).slice(0, 5);

  return {
    ok: true, from: from, to: to, basis: basis, prevFrom: prevFrom, prevTo: prevTo,
    summary: {
      sales: money(cur.sales),
      pending: money(cur.pending),
      pendingBookings: Object.keys(cur.pendIds).length,
      bookings: bookings,
      hours: money(cur.hours),
      avgBooking: bookings ? money(cur.sales / bookings) : 0,
      avgHour: cur.hours ? money(cur.sales / cur.hours) : 0,
      memberSales: money(cur.memberSales),
      cancelledCount: Object.keys(cur.cancelIds).length,
      cancelledAmount: money(cur.cancelledAmount),
      prevSales: money(prev.sales),
      prevBookings: Object.keys(prev.confIds).length
    },
    monthly: monthly,
    daily: daily,
    courts: courtsOut,
    hoursByStart: startsOut,
    customers: customersOut
  };
}

/* ---- small date helpers (pure string/UTC math, no timezone surprises) ---- */
function finParse_(ymd) { var p = String(ymd).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
function finFmt_(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
function finDaysBetween_(a, b) { return Math.round((finParse_(b) - finParse_(a)) / 86400000); }
function finAddDays_(ymd, n) { return finFmt_(finParse_(ymd) + n * 86400000); }
function finNextMonth_(ym) {
  var y = +ym.slice(0, 4), m = +ym.slice(5, 7) + 1;
  if (m > 12) { m = 1; y++; }
  return y + '-' + ('0' + m).slice(-2);
}
