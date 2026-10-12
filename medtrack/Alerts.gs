/**
 * MedTrack - Alerts.gs
 * Daily expiry alert engine: recalculates statuses, finds batches that crossed a
 * threshold and were not yet alerted (per AlertLog), and sends ONE digest per channel.
 */

/* ----------------------------- Trigger ----------------------------- */

/** (Re)creates the daily time-driven trigger at the time saved in Settings. */
function installDailyTrigger_() {
  var t = (getSettings_().DailyAlertTime || '07:00').split(':');
  var hour = parseInt(t[0], 10), minute = parseInt(t[1], 10);
  if (isNaN(hour)) hour = 7;
  if (isNaN(minute)) minute = 0;
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'dailyAlertJob') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('dailyAlertJob').timeBased().everyDays(1).atHour(hour).nearMinute(minute).inTimezone(APP.TZ).create();
}

/** Entry point for the daily trigger: refresh statuses, then send the digest if anything is due. */
function dailyAlertJob() {
  try { recalcStatuses_(); } catch (e) { console.error('Status refresh failed: ' + e); }
  return runAlertEngine_();
}

/** Manual "Run check now" from Settings. */
function runAlertsNow_() {
  try { recalcStatuses_(); } catch (e) { console.error('Status refresh failed: ' + e); }
  var r = runAlertEngine_();
  return { result: r };
}

/* ------------------------------ Engine ------------------------------ */

/** Builds the list of batches (with stock in hand or on consignment) that crossed a threshold. */
function collectDueItems_(thresholds, today) {
  var prod = indexBy_(readTable_(SH.PRODUCTS).rows, 'ProductID');
  var acc = indexBy_(readTable_(SH.ACCOUNTS).rows, 'AccountID');
  var batches = readTable_(SH.BATCHES).rows;
  var L = buildLedger_(readTable_(SH.MOVEMENTS).rows);
  var items = [];
  batches.forEach(function (b) {
    var cons = consignTotal_(L, b.BatchID);
    if (b.QtyOnHand + cons <= 0) return;
    var days = daysBetween_(today, b.ExpiryDate);
    var label = null;
    if (days < 0) label = 'Expired';
    else for (var i = 0; i < thresholds.length; i++) { if (days <= thresholds[i]) { label = String(thresholds[i]); break; } }
    if (!label) return;
    var p = prod[b.ProductID] || { BrandName: '(unknown product)', GenericName: '', Dosage: '', Form: '' };
    var locs = [];
    if (b.QtyOnHand > 0) locs.push({ name: 'In hand', qty: b.QtyOnHand });
    var cm = L.consign[b.BatchID] || {};
    Object.keys(cm).forEach(function (aid) { if (cm[aid] > 0) locs.push({ name: acc[aid] ? acc[aid].Name : 'Unknown account', qty: cm[aid] }); });
    items.push({
      batchId: b.BatchID, threshold: label, days: days, brand: p.BrandName, generic: p.GenericName, dosage: p.Dosage, form: p.Form,
      lot: b.LotNumber, expiry: b.ExpiryDate, qty: b.QtyOnHand + cons, locs: locs
    });
  });
  items.sort(function (a, b) { return a.days - b.days; });
  return items;
}

/** Groups items by threshold label, most urgent first. */
function groupItems_(items) {
  var map = {};
  items.forEach(function (it) { (map[it.threshold] = map[it.threshold] || []).push(it); });
  return Object.keys(map).sort(function (a, b) {
    var x = a === 'Expired' ? -1 : parseInt(a, 10), y = b === 'Expired' ? -1 : parseInt(b, 10);
    return x - y;
  }).map(function (k) {
    var n = k === 'Expired' ? -1 : parseInt(k, 10);
    var tone = n <= 30 ? 'red' : (n <= 90 ? 'amber' : 'blue');
    return {
      key: k, tone: tone, items: map[k],
      title: k === 'Expired' ? 'Expired - pull out now' : 'Expiring within ' + k + ' days',
      color: tone === 'red' ? '#D92D4A' : (tone === 'amber' ? '#B7791F' : '#2F6FDB'),
      soft: tone === 'red' ? '#FDECEF' : (tone === 'amber' ? '#FFF4DB' : '#E8F0FD'),
      dot: tone === 'red' ? '🔴' : (tone === 'amber' ? '🟡' : '🔵')
    };
  });
}

/** Which channels are switched on and have what they need. Returns [{name, ready, why}]. */
function activeChannels_(s) {
  var props = PropertiesService.getScriptProperties();
  var out = [];
  if (toBool_(s.EmailEnabled)) out.push({ name: 'Email', ready: !!s.AlertEmail, why: 'No alert email address is set.' });
  if (toBool_(s.TelegramEnabled) && (props.getProperty('TELEGRAM_BOT_TOKEN') || s.TelegramChatId)) {
    out.push({ name: 'Telegram', ready: !!(props.getProperty('TELEGRAM_BOT_TOKEN') && s.TelegramChatId), why: 'Telegram bot token or chat ID is missing.' });
  }
  if (toBool_(s.SmsEnabled)) out.push({ name: 'SMS', ready: !!(props.getProperty('SMS_API_KEY') && s.SmsRecipient && s.SmsEndpoint), why: 'SMS key, number or provider address is missing.' });
  return out;
}

/**
 * Finds newly due alerts and sends one digest per channel. Holds the script lock for the whole
 * check-send-log cycle so the same threshold can never go out twice. Returns a summary object.
 */
function runAlertEngine_() {
  return withLock_(function () {
    var s = getSettings_(), today = todayYMD_();
    var thresholds = parseThresholds_(s.AlertThresholds);
    var channels = activeChannels_(s);
    var items = collectDueItems_(thresholds, today);
    var log = readTable_(SH.ALERTLOG).rows;
    var sentKey = {};
    log.forEach(function (a) { if (a.Status === 'Sent') sentKey[a.BatchID + '|' + a.Threshold + '|' + a.Channel] = true; });
    var summary = { date: today, due: 0, channels: [], note: '' };
    if (!channels.length) { summary.note = 'No alert channel is switched on.'; return summary; }

    var taken = indexBy_(log, 'AlertID');
    var newLog = [];
    var nowIso = nowISO_();
    channels.forEach(function (ch) {
      var due = items.filter(function (it) { return !sentKey[it.batchId + '|' + it.threshold + '|' + ch.name]; });
      if (!due.length) { summary.channels.push({ channel: ch.name, sent: 0, status: 'Nothing new' }); return; }
      summary.due = Math.max(summary.due, due.length);
      var res;
      if (!ch.ready) res = { ok: false, error: ch.why };
      else res = sendDigest_(ch.name, groupItems_(due), s, today);
      due.forEach(function (it) {
        newLog.push({ AlertID: uniqueId_('ALT', taken, ''), Date: nowIso, BatchID: it.batchId, Threshold: it.threshold, Channel: ch.name, Status: res.ok ? 'Sent' : 'Failed: ' + str_(res.error, 120) });
        taken[newLog[newLog.length - 1].AlertID] = true;
      });
      summary.channels.push({ channel: ch.name, sent: res.ok ? due.length : 0, status: res.ok ? 'Sent' : 'Failed: ' + res.error });
    });
    if (newLog.length) appendRows_(SH.ALERTLOG, newLog);
    if (!summary.due) summary.note = 'Nothing new to report today.';
    return summary;
  });
}

/** Dispatches a digest to a channel. Returns {ok, error}. */
function sendDigest_(channel, groups, s, today) {
  try {
    if (channel === 'Email') return sendEmail_(groups, s, today);
    if (channel === 'Telegram') return sendTelegram_(buildTelegramText_(groups, s, today), s);
    if (channel === 'SMS') return sendSms_(buildSmsText_(groups), s);
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e).substring(0, 160) };
  }
  return { ok: false, error: 'Unknown channel' };
}

/* ------------------------------ Messages ----------------------------- */

/** Counts items per tone for headlines. */
function digestCounts_(groups) {
  var c = { total: 0, expired: 0, d30: 0 };
  groups.forEach(function (g) {
    c.total += g.items.length;
    if (g.key === 'Expired') c.expired += g.items.length;
    else if (parseInt(g.key, 10) <= 30) c.d30 += g.items.length;
  });
  return c;
}

/** "In hand 12 - Botica Bayanihan 8" style location string. */
function locText_(locs) {
  return locs.map(function (l) { return l.name + ' ' + fmtInt_(l.qty); }).join(' · ');
}

/** Human days-left label. */
function daysLabel_(d) {
  if (d < 0) return Math.abs(d) + ' day' + (Math.abs(d) === 1 ? '' : 's') + ' ago';
  if (d === 0) return 'today';
  return d + ' day' + (d === 1 ? '' : 's') + ' left';
}

/** Product title line, e.g. "Amoxiflex 500 mg". */
function itemTitle_(it) {
  return (it.brand + (it.dosage ? ' ' + it.dosage : '')).trim();
}

/** Builds the branded, phone-friendly HTML email and sends it with MailApp. */
function sendEmail_(groups, s, today) {
  var c = digestCounts_(groups);
  var parts = [];
  if (c.expired) parts.push(c.expired + ' expired');
  if (c.d30) parts.push(c.d30 + ' within 30 days');
  var subject = 'MedTrack: ' + (parts.length ? parts.join(', ') : c.total + ' batch' + (c.total === 1 ? '' : 'es') + ' nearing expiry') + ' - ' + fmtDate_(today);
  var html = buildEmailHtml_(groups, s, today, c);
  var plain = buildPlainText_(groups, s, today);
  MailApp.sendEmail({ to: s.AlertEmail, subject: subject, htmlBody: html, body: plain, name: 'MedTrack' });
  return { ok: true };
}

/** Plain-text fallback for email clients that block HTML. */
function buildPlainText_(groups, s, today) {
  var out = [s.BusinessName + ' - Expiry digest - ' + fmtDate_(today), ''];
  groups.forEach(function (g) {
    out.push(g.title.toUpperCase() + ' (' + g.items.length + ')');
    g.items.forEach(function (it) {
      out.push('- ' + itemTitle_(it) + ' | Lot ' + it.lot + ' | Exp ' + fmtDate_(it.expiry) + ' (' + daysLabel_(it.days) + ') | Qty ' + fmtInt_(it.qty) + ' | ' + locText_(it.locs));
    });
    out.push('');
  });
  out.push('Powered by LAYAW SYSTEM - ' + APP.URL);
  return out.join('\n');
}

/** HTML email body with inline styles (works in Gmail, Outlook and phone clients). */
function buildEmailHtml_(groups, s, today, c) {
  var font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  var h = '';
  h += '<div style="background:#EEF3F7;padding:16px 8px;font-family:' + font + ';color:#0F2A44;">';
  h += '<div style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:18px;overflow:hidden;border:1px solid #E1E8EF;">';
  var brand = /^#[0-9A-Fa-f]{6}$/.test(s.BrandColor || '') ? s.BrandColor : '#0F2A44';
  var accent = /^#[0-9A-Fa-f]{6}$/.test(s.AccentColor || '') ? s.AccentColor : '#0E9AA7';
  h += '<div style="background:' + brand + ';background-image:linear-gradient(135deg,' + brand + ' 0%,' + accent + ' 100%);padding:26px 22px;color:#FFFFFF;">';
  h += '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.8;font-weight:600;">MedTrack · Expiry digest</div>';
  h += '<div style="font-size:24px;line-height:1.25;font-weight:800;margin-top:8px;">' + c.total + ' batch' + (c.total === 1 ? '' : 'es') + ' need' + (c.total === 1 ? 's' : '') + ' your attention</div>';
  h += '<div style="font-size:13px;opacity:.85;margin-top:6px;">' + esc_(fmtDate_(today)) + ' · ' + esc_(s.BusinessName) + '</div>';
  h += '</div>';
  h += '<div style="padding:16px 14px 4px;">';
  groups.forEach(function (g) {
    h += '<div style="margin:10px 0 22px;">';
    h += '<div style="display:inline-block;background:' + g.soft + ';color:' + g.color + ';font-weight:700;font-size:12px;letter-spacing:.04em;text-transform:uppercase;padding:6px 12px;border-radius:999px;">' + esc_(g.title) + ' · ' + g.items.length + '</div>';
    g.items.forEach(function (it) {
      h += '<div style="margin-top:10px;border:1px solid #E1E8EF;border-left:5px solid ' + g.color + ';border-radius:12px;padding:12px 14px;">';
      h += '<div style="font-size:16px;font-weight:700;line-height:1.3;">' + esc_(itemTitle_(it)) + '</div>';
      h += '<div style="font-size:13px;color:#5B6F83;margin-top:2px;">' + esc_([it.generic, it.form].filter(Boolean).join(' · ')) + '</div>';
      h += '<div style="margin-top:10px;font-size:13px;line-height:1.7;">';
      h += '<span style="color:#5B6F83;">Lot</span> <b>' + esc_(it.lot) + '</b> &nbsp;·&nbsp; <span style="color:#5B6F83;">Exp</span> <b>' + esc_(fmtDate_(it.expiry)) + '</b><br>';
      h += '<span style="display:inline-block;background:' + g.soft + ';color:' + g.color + ';font-weight:700;border-radius:999px;padding:2px 10px;font-size:12px;">' + esc_(daysLabel_(it.days)) + '</span> &nbsp; <span style="color:#5B6F83;">Qty</span> <b>' + fmtInt_(it.qty) + '</b><br>';
      h += '<span style="color:#5B6F83;">Where:</span> ' + esc_(locText_(it.locs));
      h += '</div></div>';
    });
    h += '</div>';
  });
  h += '</div>';
  var url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) { url = ''; }
  if (url) h += '<div style="text-align:center;padding:4px 14px 22px;"><a href="' + esc_(url) + '" style="display:inline-block;background:' + accent + ';color:#FFFFFF;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:12px;font-size:15px;">Open MedTrack</a></div>';
  h += '<div style="border-top:1px solid #E1E8EF;padding:14px;text-align:center;font-size:11px;color:#7A8B9C;">You get this digest once a day, only when something new crosses an alert threshold.<br>Powered by <a href="' + APP.URL + '" style="color:#5B6F83;font-weight:700;text-decoration:underline;">LAYAW SYSTEM</a></div>';
  h += '</div></div>';
  return h;
}

/** Escapes text for Telegram HTML parse mode. */
function tgEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Builds the Telegram digest (HTML parse mode). */
function buildTelegramText_(groups, s, today) {
  var c = digestCounts_(groups);
  var t = '<b>💊 MedTrack expiry digest</b>\n<i>' + tgEsc_(fmtDate_(today)) + ' · ' + tgEsc_(s.BusinessName) + '</i>\n';
  t += '<b>' + c.total + '</b> batch' + (c.total === 1 ? '' : 'es') + ' need attention\n';
  groups.forEach(function (g) {
    t += '\n' + g.dot + ' <b>' + tgEsc_(g.title.toUpperCase()) + ' (' + g.items.length + ')</b>\n';
    g.items.forEach(function (it) {
      t += '• <b>' + tgEsc_(itemTitle_(it)) + '</b>' + (it.generic ? ' <i>' + tgEsc_(it.generic) + '</i>' : '') + '\n';
      t += '   Lot ' + tgEsc_(it.lot) + ' · Exp ' + tgEsc_(fmtDate_(it.expiry)) + ' (' + tgEsc_(daysLabel_(it.days)) + ')\n';
      t += '   Qty ' + fmtInt_(it.qty) + ' — ' + tgEsc_(locText_(it.locs)) + '\n';
    });
  });
  t += '\n<i>Powered by <a href="' + APP.URL + '">LAYAW SYSTEM</a></i>';
  return t;
}

/** Sends a Telegram message, splitting at line breaks when it exceeds the 4096-character limit. */
function sendTelegram_(text, s) {
  var token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!token || !s.TelegramChatId) return { ok: false, error: 'Telegram bot token or chat ID is missing.' };
  var chunks = [], cur = '';
  text.split('\n').forEach(function (line) {
    if ((cur + line + '\n').length > 3800) { chunks.push(cur); cur = ''; }
    cur += line + '\n';
  });
  if (cur) chunks.push(cur);
  for (var i = 0; i < chunks.length; i++) {
    var resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ chat_id: s.TelegramChatId, text: chunks[i], parse_mode: 'HTML', disable_web_page_preview: true })
    });
    var body = {};
    try { body = JSON.parse(resp.getContentText()); } catch (e) { body = {}; }
    if (resp.getResponseCode() !== 200 || !body.ok) return { ok: false, error: 'Telegram said: ' + (body.description || ('HTTP ' + resp.getResponseCode())) };
  }
  return { ok: true };
}

/** Short SMS summary (kept under ~300 characters). */
function buildSmsText_(groups) {
  var c = digestCounts_(groups);
  var t = 'MedTrack: ' + c.total + ' batch' + (c.total === 1 ? '' : 'es') + ' need attention.';
  if (c.expired) t += ' ' + c.expired + ' expired.';
  if (c.d30) t += ' ' + c.d30 + ' expire within 30 days.';
  var first = groups[0] && groups[0].items[0];
  if (first) t += ' Most urgent: ' + itemTitle_(first) + ' lot ' + first.lot + ' (' + daysLabel_(first.days) + ').';
  return t.substring(0, 300);
}

/** Sends an SMS through any provider described by endpoint + body template in Settings. */
function sendSms_(text, s) {
  var key = PropertiesService.getScriptProperties().getProperty('SMS_API_KEY');
  if (!key || !s.SmsRecipient || !s.SmsEndpoint) return { ok: false, error: 'SMS key, number or provider address is missing.' };
  var isJson = s.SmsContentType === 'json';
  var vals = { apikey: key, number: s.SmsRecipient, message: text, sender: s.SmsSender || '' };
  var body = String(s.SmsBodyTemplate || '').replace(/\{\{(apikey|number|message|sender)\}\}/g, function (m, k) {
    return isJson ? JSON.stringify(vals[k]).slice(1, -1) : encodeURIComponent(vals[k]);
  });
  var resp = UrlFetchApp.fetch(s.SmsEndpoint, {
    method: 'post', contentType: isJson ? 'application/json' : 'application/x-www-form-urlencoded', payload: body, muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) return { ok: false, error: 'SMS provider replied HTTP ' + code };
  return { ok: true };
}

/* ------------------------------ Test & tools ------------------------- */

/** Sends a test alert to every switched-on channel and logs each result in AlertLog. */
function sendTestAlert_() {
  var s = getSettings_(), today = todayYMD_();
  var channels = activeChannels_(s);
  if (!channels.length) throw userError_('Switch on at least one alert channel (email, Telegram or SMS) and save first.');
  var items = collectDueItems_(parseThresholds_(s.AlertThresholds), today).slice(0, 3);
  var groups = items.length ? groupItems_(items) : [{ key: '180', tone: 'blue', title: 'Test alert', color: '#2F6FDB', soft: '#E8F0FD', dot: '🔵', items: [{ batchId: 'TEST', threshold: 'TEST', days: 120, brand: 'Sample Product', generic: 'This is only a test', dosage: '500 mg', form: 'Tablet', lot: 'TEST-001', expiry: addDaysYMD_(today, 120), qty: 10, locs: [{ name: 'In hand', qty: 10 }] }] }];
  var results = [];
  var rows = [];
  var taken = indexBy_(readTable_(SH.ALERTLOG).rows, 'AlertID');
  channels.forEach(function (ch) {
    var res = ch.ready ? sendDigest_(ch.name, groups, s, today) : { ok: false, error: ch.why };
    results.push({ channel: ch.name, ok: res.ok, detail: res.ok ? 'Sent' : res.error });
    var id = uniqueId_('ALT', taken, '');
    taken[id] = true;
    rows.push({ AlertID: id, Date: nowISO_(), BatchID: 'TEST', Threshold: 'TEST', Channel: ch.name, Status: res.ok ? 'Sent' : 'Failed: ' + str_(res.error, 120) });
  });
  withLock_(function () { appendRows_(SH.ALERTLOG, rows); });
  return { results: results };
}

/** Finds the Telegram chat ID after he sends a message to his bot. */
function detectTelegramChat_() {
  var token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) throw userError_('Save your Telegram bot token first, then try again.');
  var resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates', { muteHttpExceptions: true });
  var body = {};
  try { body = JSON.parse(resp.getContentText()); } catch (e) { body = {}; }
  if (!body.ok) throw userError_('Telegram did not accept the bot token. Please copy it again from BotFather.');
  var chat = null;
  (body.result || []).forEach(function (u) {
    var m = u.message || u.channel_post || (u.callback_query && u.callback_query.message);
    if (m && m.chat) chat = m.chat;
  });
  if (!chat) throw userError_('No message found yet. Open Telegram, send "hi" to your bot, then tap Detect again.');
  return { chatId: String(chat.id), name: chat.first_name || chat.title || chat.username || '' };
}
