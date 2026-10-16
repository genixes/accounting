/**
 * MedTrack - Billing.gs
 * Subscriptions for the owner (admin): free trial, monthly / yearly plans, payment records, access
 * that ends by itself, and branded reminder emails (with the owner's payment QR) 5 days before a
 * payment is due. The owner is copied on every reminder. All of this lives in the master sheet
 * (Users + Payments tabs) and in Script Properties; medreps never see any of it.
 */

var PAYMENTS = 'Payments';

var BILLING_DEFAULTS = { trialDays: 7, graceDays: 3, remindDays: 5, trialRemindDays: 2, monthlyPrice: 0, yearlyPrice: 0, payeeName: '', instructions: '', qrUrl: '', contact: '', signupOpen: true, signupDailyCap: 20 };
var PLANS_ = { Trial: 1, Monthly: 1, Yearly: 1, Free: 1 };

/* ------------------------------ Settings ------------------------------ */

/** Billing settings (defaults filled in). */
function getBilling_() {
  var raw = PropertiesService.getScriptProperties().getProperty('BILLING'), o = {};
  try { o = raw ? JSON.parse(raw) : {}; } catch (e) { o = {}; }
  var b = {};
  Object.keys(BILLING_DEFAULTS).forEach(function (k) { b[k] = o[k] == null ? BILLING_DEFAULTS[k] : o[k]; });
  return b;
}

/** Extracts a Drive file id from a share link (or accepts a bare id). */
function driveFileId_(s) {
  s = String(s || '');
  var m = s.match(/\/d\/([-\w]{20,})/) || s.match(/[?&]id=([-\w]{20,})/) || s.match(/^([-\w]{25,})$/);
  return m ? m[1] : '';
}

function intIn_(v, lo, hi, what) {
  var n = parseInt(v, 10);
  if (isNaN(n) || n < lo || n > hi) throw userError_(what + ' must be a whole number from ' + lo + ' to ' + hi + '.');
  return n;
}
function moneyIn_(v, what) {
  var n = Number(v === '' || v == null ? 0 : v);
  if (isNaN(n) || n < 0 || n > 10000000) throw userError_(what + ' must be a number, 0 or more.');
  return Math.round(n * 100) / 100;
}

/** Admin saves billing settings. */
function adminSaveBilling_(p, user) {
  requireAdmin_(user);
  var cur = getBilling_();
  var b = {
    trialDays: intIn_(p.trialDays, 1, 90, 'Trial days'),
    graceDays: intIn_(p.graceDays, 0, 60, 'Grace days'),
    remindDays: intIn_(p.remindDays, 1, 30, 'Reminder days'),
    trialRemindDays: intIn_(p.trialRemindDays, 1, 30, 'Trial reminder days'),
    monthlyPrice: moneyIn_(p.monthlyPrice, 'Monthly price'),
    yearlyPrice: moneyIn_(p.yearlyPrice, 'Yearly price'),
    payeeName: str_(p.payeeName, 80),
    instructions: str_(p.instructions, 600),
    contact: str_(p.contact, 120),
    qrUrl: str_(p.qrUrl, 400),
    signupOpen: p.signupOpen == null ? cur.signupOpen : (p.signupOpen === true || p.signupOpen === 'true'),
    signupDailyCap: intIn_(p.signupDailyCap == null || p.signupDailyCap === '' ? cur.signupDailyCap : p.signupDailyCap, 1, 500, 'Daily sign-up limit')
  };
  if (b.qrUrl) {
    var id = driveFileId_(b.qrUrl);
    if (!id) throw userError_('Paste the Google Drive link of your payment QR picture (Drive > right-click the picture > Share > Copy link).');
    try {
      var f = DriveApp.getFileById(id);
      if (String(f.getMimeType()).indexOf('image/') !== 0) throw new Error('not an image');
    } catch (e) { throw userError_('That Drive link is not a picture, or this account cannot open it. Upload your QR as a PNG/JPG to your own Drive and copy its link.'); }
  }
  PropertiesService.getScriptProperties().setProperty('BILLING', JSON.stringify(b));
  return { billing: b };
}

/* ------------------------------ Access ------------------------------- */

function addMonthsYMD_(ymd, n) {
  var p = String(ymd).split('-'), y = +p[0], mo = +p[1] - 1 + n, d = +p[2];
  y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
  var last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  return y + '-' + ('0' + (mo + 1)).slice(-2) + '-' + ('0' + Math.min(d, last)).slice(-2);
}

/**
 * Where a user stands. state: free | trial | active | due | grace | expired.
 * "due" = a paid plan inside the reminder window, "grace" = past the date but still allowed in.
 */
function accessState_(u, bill, today) {
  bill = bill || getBilling_(); today = today || todayYMD_();
  var plan = u.Role === 'Admin' ? 'Free' : (PLANS_[u.Plan] ? u.Plan : 'Free');
  if (plan === 'Free') return { plan: 'Free', state: 'free', endsOn: '', daysLeft: null };
  var endsOn = plan === 'Trial' ? u.TrialEnds : u.PaidUntil;
  if (!endsOn) return { plan: plan, state: 'expired', endsOn: '', daysLeft: -999 };
  var days = daysBetween_(today, endsOn), grace = plan === 'Trial' ? 0 : bill.graceDays, state;
  if (days < -grace) state = 'expired';
  else if (days < 0) state = 'grace';
  else if (plan === 'Trial') state = 'trial';
  else state = days <= bill.remindDays ? 'due' : 'active';
  return { plan: plan, state: state, endsOn: endsOn, daysLeft: days };
}

/** Throws the friendly "access ended" error (code EXPIRED) when the account may not sign in. */
function assertAccess_(u) {
  var a = accessState_(u);
  if (a.state !== 'expired') return a;
  var b = getBilling_();
  var e = userError_(a.plan === 'Trial'
    ? 'Your free trial has ended. To keep using MedTrack, please subscribe' + (b.contact ? ': ' + b.contact : ' by contacting your administrator') + '.'
    : 'Your subscription has ended. Please renew to continue' + (b.contact ? ': ' + b.contact : ' by contacting your administrator') + '.');
  e.code = 'EXPIRED';
  throw e;
}

/** Small summary for the app's own banner (what the medrep sees about their plan). */
function subInfo_(u) {
  var a = accessState_(u), b = getBilling_();
  return { plan: a.plan, state: a.state, endsOn: a.endsOn, daysLeft: a.daysLeft, contact: b.contact };
}

/* ------------------------------ Payments ------------------------------ */

/** Admin records a payment: extends the plan, stores a payment row, emails a receipt. */
function adminConfirmPayment_(p, user) {
  requireAdmin_(user);
  var plan = p.plan === 'Yearly' ? 'Yearly' : 'Monthly', bill = getBilling_(), m = masterSS_();
  var paidOn = isValidYMD_(String(p.paidOn || '')) ? p.paidOn : todayYMD_();
  var amount = moneyIn_(p.amount === '' || p.amount == null ? (plan === 'Yearly' ? bill.yearlyPrice : bill.monthlyPrice) : p.amount, 'Amount');
  var out = null;
  withLock_(function () {
    var u = readTable_(USERS, m).rows.filter(function (x) { return x.UserID === p.uid; })[0];
    if (!u) throw userError_('That user could not be found.');
    if (u.Role === 'Admin') throw userError_('The administrator account does not need a plan.');
    var paidPlan = u.Plan === 'Monthly' || u.Plan === 'Yearly';
    var base = paidOn;
    if (paidPlan && u.PaidUntil && daysBetween_(paidOn, u.PaidUntil) >= -bill.graceDays) base = u.PaidUntil;
    var until = plan === 'Yearly' ? addMonthsYMD_(base, 12) : addMonthsYMD_(base, 1);
    u.Plan = plan; u.PaidUntil = until; u.Amount = amount; u.Active = true; u.LastReminderFor = '';
    updateRow_(USERS, u, m);
    var taken = indexBy_(readTable_(PAYMENTS, m).rows, 'PaymentID');
    appendRows_(PAYMENTS, [{ PaymentID: uniqueId_('PAY', taken, ''), UserID: u.UserID, PaidOn: paidOn, Plan: plan, Amount: amount, PeriodStart: base, PeriodEnd: until, Method: str_(p.method, 40), Note: str_(p.note, 120), RecordedAt: nowISO_() }], m);
    out = { user: u, until: until, amount: amount, plan: plan };
  });
  var emailed = p.receipt === false ? false : sendBillingEmail_(out.user, 'receipt', accessState_(out.user), bill, { amount: amount, until: out.until, plan: plan });
  return { until: out.until, plan: plan, amount: amount, emailed: emailed };
}

/** Admin changes a plan directly (extend a trial, set a date, make an account free). */
function adminUpdateSubscription_(p, user) {
  requireAdmin_(user);
  var plan = PLANS_[p.plan] ? p.plan : '', bill = getBilling_(), m = masterSS_(), today = todayYMD_();
  if (!plan) throw userError_('Please choose a plan.');
  var out = null;
  withLock_(function () {
    var u = readTable_(USERS, m).rows.filter(function (x) { return x.UserID === p.uid; })[0];
    if (!u) throw userError_('That user could not be found.');
    if (u.Role === 'Admin') throw userError_('The administrator account does not need a plan.');
    var d = String(p.endsOn || '');
    if (plan === 'Free') { u.Plan = 'Free'; }
    else {
      if (d && !isValidYMD_(d)) throw userError_('Please pick a valid date.');
      if (plan === 'Trial') {
        u.Plan = 'Trial';
        var live = u.TrialEnds && daysBetween_(today, u.TrialEnds) >= 0 ? u.TrialEnds : '';
        if (p.extendDays) u.TrialEnds = addDaysYMD_(live || today, intIn_(p.extendDays, 1, 90, 'Extra days'));
        else u.TrialEnds = d || live || addDaysYMD_(today, bill.trialDays);
      } else {
        if (u.Plan !== plan) u.Amount = 0;
        u.Plan = plan;
        u.PaidUntil = d || u.PaidUntil || (plan === 'Yearly' ? addMonthsYMD_(today, 12) : addMonthsYMD_(today, 1));
        if (p.amount !== '' && p.amount != null) u.Amount = moneyIn_(p.amount, 'Amount');
      }
    }
    u.LastReminderFor = '';
    updateRow_(USERS, u, m);
    out = u;
  });
  return { sub: accessState_(out) };
}

/** Admin sends the reminder now (to the medrep, copy to the owner). */
function adminSendReminder_(p, user) {
  requireAdmin_(user);
  var m = masterSS_(), bill = getBilling_();
  var u = readTable_(USERS, m).rows.filter(function (x) { return x.UserID === p.uid; })[0];
  if (!u) throw userError_('That user could not be found.');
  var a = accessState_(u, bill);
  if (a.state === 'free') throw userError_('This account has no plan to remind about. Set a plan first.');
  var kind = a.daysLeft < 0 ? 'overdue' : (a.plan === 'Trial' ? 'trial' : 'reminder');
  var ok = sendBillingEmail_(u, kind, a, bill);
  if (!ok) throw userError_('The email could not be sent. Check your daily email limit and try again.');
  return { sent: true };
}

/* ------------------------------ Reminders ----------------------------- */

/**
 * Runs from the hourly trigger (once a day after 8am Manila time): emails each medrep whose trial or
 * payment is due soon (5 days for payments, 2 days for trials), and once more when it has lapsed.
 * A medrep is only reminded once per due date.
 */
function subscriptionReminders_(force) {
  var props = PropertiesService.getScriptProperties(), today = todayYMD_();
  var hour = parseInt(Utilities.formatDate(new Date(), APP.TZ, 'H'), 10);
  if (!force && (props.getProperty('SUB_LAST') === today || hour < 8)) return { sent: 0 };
  var bill = getBilling_(), m = masterSS_(), sent = 0, failed = 0;
  readTable_(USERS, m).rows.forEach(function (u) {
    if (!u.Active || u.Role === 'Admin') return;
    var a = accessState_(u, bill, today);
    if (a.state === 'free') return;
    var days = a.daysLeft, win = a.plan === 'Trial' ? bill.trialRemindDays : bill.remindDays, kind = null, key = a.plan + ':' + a.endsOn;
    if (days >= 0 && days <= win) kind = a.plan === 'Trial' ? 'trial' : 'reminder';
    else if (days < 0 && days >= -(bill.graceDays + 14)) { kind = 'overdue'; key = 'X:' + key; }
    if (!kind || u.LastReminderFor === key) return;
    try { if (MailApp.getRemainingDailyQuota() < 4) { failed++; return; } } catch (e) { /* ignore */ }
    if (sendBillingEmail_(u, kind, a, bill)) {
      withLock_(function () {
        var row = readTable_(USERS, m).rows.filter(function (x) { return x.UserID === u.UserID; })[0];
        if (row) { row.LastReminderFor = key; updateRow_(USERS, row, m); }
      });
      sent++;
    } else failed++;
  });
  if (!failed) props.setProperty('SUB_LAST', today);
  return { sent: sent, failed: failed };
}

/** Run from the editor to send due reminders right now. */
function sendSubscriptionRemindersNow() {
  var r = subscriptionReminders_(true);
  notify_('Reminders sent: ' + r.sent + (r.failed ? '. Could not send: ' + r.failed : '') + '.');
}

/* -------------------------------- Email ------------------------------- */

function nl2br_(s) { return esc_(s).replace(/\r?\n/g, '<br>'); }

/**
 * Branded billing email. kind: reminder | trial | overdue | receipt. The owner is copied; replies go to the owner.
 * The payment QR (a picture in the owner's Drive) is embedded so it shows without "load images".
 */
function sendBillingEmail_(u, kind, a, bill, extra) {
  try {
    extra = extra || {};
    var owner = '';
    try { owner = normEmail_(Session.getEffectiveUser().getEmail()); } catch (e) { owner = ''; }
    var brand = '#0F2A44', accent = '#0E9AA7', url = appUrl_();
    var plan = extra.plan || a.plan;
    var amount = extra.amount != null ? extra.amount : (u.Amount || (plan === 'Yearly' ? bill.yearlyPrice : plan === 'Monthly' ? bill.monthlyPrice : 0));
    var due = extra.until || a.endsOn, days = a.daysLeft;
    var title, lead, subject, showPay = kind !== 'receipt';
    if (kind === 'receipt') {
      title = 'Payment received. Thank you!'; subject = 'Payment received for MedTrack';
      lead = 'We received your payment. Your ' + plan + ' plan is active until <b>' + esc_(fmtDate_(due)) + '</b>.';
    } else if (kind === 'trial') {
      title = 'Your free trial ends ' + (days <= 0 ? 'today' : 'in ' + days + (days === 1 ? ' day' : ' days')); subject = 'Your MedTrack trial ends on ' + fmtDate_(due);
      lead = 'Your free trial runs until <b>' + esc_(fmtDate_(due)) + '</b>. To keep using MedTrack without interruption, please subscribe before then.';
    } else if (kind === 'overdue') {
      title = a.plan === 'Trial' ? 'Your free trial has ended' : 'Your payment is overdue'; subject = a.plan === 'Trial' ? 'Your MedTrack trial has ended' : 'MedTrack payment overdue (was due ' + fmtDate_(due) + ')';
      lead = a.plan === 'Trial' ? 'Your free trial ended on <b>' + esc_(fmtDate_(due)) + '</b>. Subscribe to get back in. Your data is kept safe.' : 'Your ' + esc_(plan) + ' payment was due on <b>' + esc_(fmtDate_(due)) + '</b>. Please pay to keep your access. Your data is kept safe.';
    } else {
      title = 'Payment reminder'; subject = 'Payment reminder: MedTrack ' + plan + ' is due on ' + fmtDate_(due);
      lead = 'Your MedTrack <b>' + esc_(plan) + '</b> plan is due ' + (days <= 0 ? '<b>today</b>' : 'in <b>' + days + (days === 1 ? ' day' : ' days') + '</b>') + ', on <b>' + esc_(fmtDate_(due)) + '</b>.';
    }
    var row = function (k, v, strong) { return '<tr><td style="padding:11px 16px;border-bottom:1px solid #E6ECF2;color:#5B6F83;font-size:13px;width:40%">' + k + '</td><td style="padding:11px 16px;border-bottom:1px solid #E6ECF2;color:#0F2A44;font-weight:700;font-size:' + (strong ? '18' : '14') + 'px">' + v + '</td></tr>'; };
    var rows = row('Plan', esc_(plan === 'Trial' ? 'Free trial' : plan));
    if (kind !== 'receipt' || amount) rows += (amount ? row('Amount', esc_(peso_(amount)), true) : '');
    rows += row(kind === 'receipt' ? 'Active until' : (a.plan === 'Trial' ? 'Trial ends' : 'Due date'), esc_(fmtDate_(due)));
    var inline = {}, qr = '';
    if (showPay) {
      var id = driveFileId_(bill.qrUrl);
      if (id) {
        try { inline.payqr = DriveApp.getFileById(id).getBlob().setName('payment-qr'); qr = '<div style="text-align:center;margin:22px 0 4px"><div style="font-size:13px;color:#5B6F83;margin-bottom:8px">Scan to pay' + (bill.payeeName ? ' <b style="color:#0F2A44">' + esc_(bill.payeeName) + '</b>' : '') + '</div><img src="cid:payqr" alt="Payment QR code" width="220" style="width:220px;max-width:70%;height:auto;border:1px solid #E6ECF2;border-radius:14px;padding:8px;background:#fff"></div>'; }
        catch (e) { console.error('QR image not available: ' + e); }
      }
    }
    var how = showPay ? '<div style="margin-top:16px;padding:14px 16px;background:#F3F6F9;border-radius:12px;color:#334A60;font-size:13px;line-height:1.55">' + (bill.instructions ? nl2br_(bill.instructions) + '<br><br>' : '') + 'After paying, just <b>reply to this email</b> with your reference number or a screenshot. We confirm it quickly.</div>' : '';
    var html = '<div style="background:#F3F6F9;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif"><div style="max-width:520px;margin:auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(15,42,68,.10)">' +
      emailHeader_(brand, accent, 'SUBSCRIPTION') +
      '<div style="padding:28px"><h2 style="margin:0 0 8px;color:#0F2A44;font-size:20px">' + esc_(title) + '</h2>' +
      '<p style="margin:0 0 18px;color:#334A60;font-size:14.5px;line-height:1.55">Hi ' + esc_(u.Name) + ', ' + lead + '</p>' +
      '<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border:1px solid #E6ECF2;border-radius:12px;border-collapse:separate;overflow:hidden">' + rows + '</table>' +
      qr + how +
      (url ? '<p style="margin:24px 0 0;text-align:center"><a href="' + esc_(url) + '" style="background:' + accent + ';color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 28px;border-radius:12px;display:inline-block">Open MedTrack</a></p>' : '') +
      (bill.contact ? '<p style="margin:18px 0 0;color:#7A8B9C;font-size:12px;text-align:center">Questions? ' + esc_(bill.contact) + '</p>' : '') +
      '</div><div style="padding:14px 28px;background:#F8FAFC;color:#7A8B9C;font-size:11.5px;text-align:center">Powered by <a href="' + APP.URL + '" style="color:#5B6F83;font-weight:700;text-decoration:none">LAYAW SYSTEM</a></div></div></div>';
    var plain = title + '\n\nHi ' + u.Name + ',\n' + lead.replace(/<[^>]+>/g, '') + '\n\nPlan: ' + plan + (amount ? '\nAmount: ' + peso_(amount) : '') + '\n' + (kind === 'receipt' ? 'Active until: ' : 'Due: ') + fmtDate_(due) + (showPay ? '\n\n' + (bill.instructions ? bill.instructions + '\n\n' : '') + 'After paying, reply to this email with your reference number or a screenshot.' : '') + (url ? '\n\nOpen MedTrack: ' + url : '') + '\n\nPowered by LAYAW SYSTEM';
    var opt = { to: u.Email, subject: subject, htmlBody: html, body: plain, name: 'MedTrack' };
    if (owner && owner !== normEmail_(u.Email)) { opt.cc = owner; opt.replyTo = owner; }
    if (inline.payqr) opt.inlineImages = inline;
    MailApp.sendEmail(opt);
    return true;
  } catch (e) { console.error('Billing email failed for ' + (u && u.Email) + ': ' + e); return false; }
}
