/**
 * MedTrack - Auth.gs
 * Multi-user mode: own login per medrep, temporary password, forced password change,
 * "forgot password" by email, sessions, an admin screen, and one private spreadsheet per medrep
 * (created in the owner's Drive). The master sheet only holds Users, Sessions and ResetTokens.
 * Passwords are never stored in plain text: only a salted, repeatedly hashed value.
 */

var PW_ITER = 1500;
var SESSION_DAYS = 30;
var RESET_MINUTES = 60;

/* ------------------------------ Helpers ------------------------------ */

/** The master spreadsheet (the one this script is attached to). */
function masterSS_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  if (!id) throw userError_('MedTrack is not set up yet.');
  return SpreadsheetApp.openById(id);
}

/** Random string of safe characters (no look-alikes). */
function randomString_(len) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789', out = '';
  var seed = (Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid()).replace(/[^0-9a-f]/g, '');
  for (var i = 0; i < len; i++) out += chars.charAt(parseInt(seed.substr((i * 2) % (seed.length - 1), 2), 16) % chars.length);
  return out;
}

/** SHA-256 of a string as hex. */
function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** Salted, iterated password hash. */
function hashPw_(pw, salt) {
  var h = sha_(salt + ':' + pw);
  for (var i = 0; i < PW_ITER; i++) h = sha_(h + salt + pw);
  return h;
}

/** Constant-time string compare. */
function safeEq_(a, b) {
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Human-readable temporary password such as "K7mQ-x3Rt". */
function tempPassword_() { return randomString_(4) + '-' + randomString_(4) + '7'; }

/** Returns a friendly problem with a new password, or '' when it is acceptable. */
function pwProblem_(pw, email) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Your new password needs at least 8 characters.';
  if (pw.length > 100) return 'That password is too long.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use at least one letter and one number.';
  if (email && pw.toLowerCase() === String(email).toLowerCase()) return 'Your password cannot be your email address.';
  return '';
}

function normEmail_(e) { return str_(e, 120).toLowerCase(); }
function validEmail_(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

/** Counts attempts in cache; throws a friendly error when over the limit. */
function rateCheck_(key, max) {
  var n = parseInt(CacheService.getScriptCache().get(key), 10) || 0;
  if (n >= max) throw userError_('Too many tries. Please wait a few minutes, or use "Forgot password".');
}
function rateHit_(key, seconds) {
  var c = CacheService.getScriptCache(), n = (parseInt(c.get(key), 10) || 0) + 1;
  c.put(key, String(n), seconds);
}

/** Safe public view of a user record. */
function publicUser_(u) { return { uid: u.UserID, name: u.Name, email: u.Email, role: u.Role, mustChange: !!u.MustChange, sub: subInfo_(u) }; }

/** Points all data functions at one medrep's spreadsheet, cache and secrets. */
function setTenant_(user) {
  SS_MEMO_ = SpreadsheetApp.openById(user.SpreadsheetID);
  TENANT_ID_ = user.UserID;
  CACHE_PFX_ = 'MT_' + user.UserID + '_';
}
function clearTenant_() { SS_MEMO_ = null; TENANT_ID_ = ''; CACHE_PFX_ = 'MT_'; }

function authError_() { var e = new Error('Please sign in again.'); e.isUser = true; e.code = 'AUTH'; return e; }

/**
 * The link medreps should open. Uses the live /exec address whenever the app is opened through its real
 * deployment (and remembers it); otherwise the remembered or admin-set address. Never returns a /dev test link
 * when something better is known.
 */
function appUrl_() {
  var props = PropertiesService.getScriptProperties(), cur = '';
  try { cur = ScriptApp.getService().getUrl() || ''; } catch (e) { cur = ''; }
  if (/\/exec$/.test(cur) && props.getProperty('EXEC_URL') !== cur) props.setProperty('EXEC_URL', cur);
  return props.getProperty('APP_URL') || props.getProperty('EXEC_URL') || cur;
}

/** Admin sets the official app link by hand (used when the app was only opened through a test link). */
function adminSetAppUrl_(p, user) {
  requireAdmin_(user);
  var u = str_(p.url, 300);
  if (!/^https:\/\/[^\s]+$/.test(u) || /\/dev(\?.*)?$/.test(u)) throw userError_('Please paste the address medreps should open: your website (for example https://medtrack.yourdomain.com) or the Web app link ending with /exec. A test link (/dev) will not work.');
  PropertiesService.getScriptProperties().setProperty('APP_URL', u);
  return { url: u };
}

/* ----------------------------- Sessions ------------------------------ */

/** Creates a session and returns the raw token (only its hash is stored). */
function createSession_(userId) {
  var raw = randomString_(40), now = Date.now();
  withLock_(function () {
    var m = masterSS_(), t = readTable_(SESSIONS, m);
    var keep = t.rows.filter(function (s) { return s.ExpiresAt > now; });
    if (keep.length !== t.rows.length) { t.sheet.getRange(2, 1, t.sheet.getMaxRows() - 1, 4).clearContent(); if (keep.length) rewriteTable_(SESSIONS, keep, m); }
    appendRows_(SESSIONS, [{ TokenHash: sha_(raw), UserID: userId, CreatedAt: nowISO_(), ExpiresAt: now + SESSION_DAYS * 86400000 }], m);
  });
  return raw;
}

/** Validates a session token, switches to that user's data and returns the user. Throws AUTH when invalid. */
function authenticate_(token) {
  if (typeof token !== 'string' || token.length < 30) throw authError_();
  var hash = sha_(token), m = masterSS_(), now = Date.now();
  var s = readTable_(SESSIONS, m).rows.filter(function (x) { return x.TokenHash === hash && x.ExpiresAt > now; })[0];
  if (!s) throw authError_();
  var u = readTable_(USERS, m).rows.filter(function (x) { return x.UserID === s.UserID; })[0];
  if (!u || !u.Active) throw authError_();
  assertAccess_(u);
  setTenant_(u);
  return u;
}

/** Removes sessions of a user (all, or all except one hash). */
function dropSessions_(userId, exceptHash) {
  withLock_(function () {
    var m = masterSS_(), t = readTable_(SESSIONS, m);
    var keep = t.rows.filter(function (s) { return s.UserID !== userId || (exceptHash && s.TokenHash === exceptHash); });
    if (keep.length === t.rows.length) return;
    t.sheet.getRange(2, 1, t.sheet.getMaxRows() - 1, 4).clearContent();
    if (keep.length) rewriteTable_(SESSIONS, keep, m);
  });
}

/* ------------------------------ Actions ------------------------------ */

/** Email + password sign-in. Returns a session token and the user. */
function login_(p) {
  var email = normEmail_(p.email), pw = typeof p.password === 'string' ? p.password : '';
  if (!validEmail_(email) || !pw) throw userError_('Please enter your email and password.');
  var rk = 'RL_L_' + sha_(email).substr(0, 20);
  rateCheck_(rk, 6);
  var m = masterSS_();
  var u = readTable_(USERS, m).rows.filter(function (x) { return x.Email === email; })[0];
  var ok = false;
  if (u && u.Active) ok = safeEq_(hashPw_(pw, u.Salt), u.PasswordHash);
  else hashPw_(pw, 'x'); // similar timing for unknown emails
  if (!ok) { rateHit_(rk, 900); throw userError_('The email or password is not correct.'); }
  CacheService.getScriptCache().remove(rk);
  assertAccess_(u);
  var token = createSession_(u.UserID);
  withLock_(function () {
    var row = readTable_(USERS, m).rows.filter(function (x) { return x.UserID === u.UserID; })[0];
    if (row) { row.LastLoginAt = nowISO_(); updateRow_(USERS, row, m); }
  });
  return { token: token, user: publicUser_(u) };
}

/** Signs out the current session. */
function logout_(p, user, token) {
  if (!token) return {};
  var hash = sha_(token);
  withLock_(function () {
    var m = masterSS_(), t = readTable_(SESSIONS, m);
    var keep = t.rows.filter(function (s) { return s.TokenHash !== hash; });
    if (keep.length === t.rows.length) return;
    t.sheet.getRange(2, 1, t.sheet.getMaxRows() - 1, 4).clearContent();
    if (keep.length) rewriteTable_(SESSIONS, keep, m);
  });
  return {};
}

/** Sets a new password for a user row (hash + salt) and clears the must-change flag. */
function setPassword_(userId, pw, mustChange) {
  withLock_(function () {
    var m = masterSS_(), u = readTable_(USERS, m).rows.filter(function (x) { return x.UserID === userId; })[0];
    if (!u) throw userError_('That account could not be found.');
    u.Salt = randomString_(24);
    u.PasswordHash = hashPw_(pw, u.Salt);
    u.MustChange = !!mustChange;
    updateRow_(USERS, u, m);
  });
}

/** Signed-in user changes their own password (needs the current/temporary one). */
function changePassword_(p, user, token) {
  var rk = 'RL_C_' + user.UserID;
  rateCheck_(rk, 6);
  if (!safeEq_(hashPw_(String(p.current || ''), user.Salt), user.PasswordHash)) { rateHit_(rk, 900); throw userError_('Your current password is not correct.'); }
  var prob = pwProblem_(p.password, user.Email);
  if (prob) throw userError_(prob);
  if (String(p.password) === String(p.current)) throw userError_('Please choose a different password from the temporary one.');
  setPassword_(user.UserID, p.password, false);
  dropSessions_(user.UserID, sha_(token));
  var fresh = readTable_(USERS, masterSS_()).rows.filter(function (x) { return x.UserID === user.UserID; })[0];
  return { user: publicUser_(fresh) };
}

/** "Forgot password": emails a one-time link. Always answers the same, so emails cannot be guessed. */
function requestReset_(p) {
  var email = normEmail_(p.email);
  if (!validEmail_(email)) throw userError_('Please enter a valid email address.');
  var rk = 'RL_R_' + sha_(email).substr(0, 20);
  rateCheck_(rk, 3);
  rateHit_(rk, 3600);
  var m = masterSS_();
  var u = readTable_(USERS, m).rows.filter(function (x) { return x.Email === email && x.Active; })[0];
  if (u) {
    var raw = randomString_(40);
    withLock_(function () {
      var t = readTable_(RESETS, m), now = Date.now();
      var keep = t.rows.filter(function (r) { return r.ExpiresAt > now && !r.Used; });
      if (keep.length !== t.rows.length) { t.sheet.getRange(2, 1, t.sheet.getMaxRows() - 1, 5).clearContent(); if (keep.length) rewriteTable_(RESETS, keep, m); }
      appendRows_(RESETS, [{ TokenHash: sha_(raw), UserID: u.UserID, ExpiresAt: now + RESET_MINUTES * 60000, Used: false, CreatedAt: nowISO_() }], m);
    });
    var url = appUrl_();
    var link = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'reset=' + raw;
    simpleMail_(u.Email, 'Reset your MedTrack password', 'Reset your password', 'Hi ' + esc_(u.Name) + ', tap the button to choose a new password. The link works once and expires in ' + RESET_MINUTES + ' minutes.', 'Choose a new password', link, 'If you did not ask for this, you can ignore this email. Your password stays the same.');
  }
  return { sent: true };
}

/** Finishes a password reset using the emailed one-time token. */
function resetPassword_(p) {
  var token = String(p.token || '');
  if (!/^[A-Za-z0-9]{30,64}$/.test(token)) throw userError_('This reset link is not valid. Please request a new one.');
  var hash = sha_(token), m = masterSS_(), now = Date.now();
  var r = readTable_(RESETS, m).rows.filter(function (x) { return x.TokenHash === hash; })[0];
  if (!r || r.Used || r.ExpiresAt < now) throw userError_('This reset link has expired or was already used. Please request a new one.');
  var u = readTable_(USERS, m).rows.filter(function (x) { return x.UserID === r.UserID && x.Active; })[0];
  if (!u) throw userError_('This account is not active. Please contact your administrator.');
  var rk = 'RL_X_' + hash.substr(0, 16);
  rateCheck_(rk, 6);
  if (normEmail_(p.email) !== u.Email) { rateHit_(rk, 900); throw userError_('That email does not match this reset link. Please type the email you registered with.'); }
  var prob = pwProblem_(p.password, u.Email);
  if (prob) throw userError_(prob);
  setPassword_(u.UserID, p.password, false);
  withLock_(function () {
    var row = readTable_(RESETS, m).rows.filter(function (x) { return x.TokenHash === hash; })[0];
    if (row) { row.Used = true; updateRow_(RESETS, row, m); }
  });
  dropSessions_(u.UserID);
  return {};
}

/* ----------------------------- Self sign-up ---------------------------- */

var SIGNUPS = 'Signups', SIGNUP_HOURS = 24;

/** What the sign-in page may know before anyone is signed in. */
function publicInfo_() {
  var b = getBilling_();
  return { signupOpen: !!b.signupOpen, trialDays: b.trialDays };
}

/** Counts something per day in Script Properties (CacheService only lasts 6 hours). Throws when over the limit. */
function dayBump_(kind, max) {
  var key = 'DAY_' + kind, today = todayYMD_(), props = PropertiesService.getScriptProperties(), over = false;
  withLock_(function () {
    var v = String(props.getProperty(key) || '').split(':'), n = v[0] === today ? (parseInt(v[1], 10) || 0) : 0;
    if (n >= max) over = true; else props.setProperty(key, today + ':' + (n + 1));
  });
  if (over) { var b = getBilling_(); throw userError_('We have a lot of sign-ups today. Please try again tomorrow' + (b.contact ? ', or contact ' + b.contact : '') + '.'); }
}

/** A small branded email (title, a line, an optional button). */
function simpleMail_(to, subject, title, leadHtml, btnLabel, btnUrl, note) {
  try {
    var brand = '#0F2A44', accent = '#0E9AA7';
    var html = '<div style="background:#F3F6F9;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif"><div style="max-width:520px;margin:auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(15,42,68,.10)">' +
      emailHeader_(brand, accent, 'INVENTORY &amp; EXPIRY MONITORING') +
      '<div style="padding:28px"><h2 style="margin:0 0 10px;color:#0F2A44;font-size:20px">' + esc_(title) + '</h2><p style="margin:0 0 18px;color:#334A60;font-size:14.5px;line-height:1.55">' + leadHtml + '</p>' +
      (btnUrl ? '<p style="margin:22px 0"><a href="' + esc_(btnUrl) + '" style="background:' + accent + ';color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;display:inline-block">' + esc_(btnLabel) + '</a></p><p style="margin:0 0 6px;color:#5B6F83;font-size:12.5px;word-break:break-all">Button not working? Open this address:<br><a href="' + esc_(btnUrl) + '" style="color:' + accent + '">' + esc_(btnUrl) + '</a></p>' : '') +
      (note ? '<p style="margin:16px 0 0;color:#7A8B9C;font-size:12.5px;line-height:1.5">' + esc_(note) + '</p>' : '') +
      '</div><div style="padding:14px 28px;background:#F8FAFC;color:#7A8B9C;font-size:11.5px;text-align:center">Powered by <a href="' + APP.URL + '" style="color:#5B6F83;font-weight:700;text-decoration:none">LAYAW SYSTEM</a></div></div></div>';
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, body: title + '\n\n' + leadHtml.replace(/<[^>]+>/g, '') + (btnUrl ? '\n\n' + btnLabel + ': ' + btnUrl : '') + (note ? '\n\n' + note : '') + '\n\nPowered by LAYAW SYSTEM', name: 'MedTrack' });
    return true;
  } catch (e) { console.error('Mail failed: ' + e); return false; }
}

/**
 * A medrep signs themselves up. Nothing is created yet: we store a pending request (with the password
 * already hashed) and email a confirmation link. The account and its private spreadsheet are only made
 * when the link is opened, which also proves the email is theirs.
 */
function requestSignup_(p) {
  var b = getBilling_();
  if (!b.signupOpen) throw userError_('Sign-up is closed right now.' + (b.contact ? ' Please contact ' + b.contact + '.' : ''));
  if (String(p.website || '') !== '') return { sent: true };
  var name = str_(p.name, 80), email = normEmail_(p.email), pw = typeof p.password === 'string' ? p.password : '';
  if (!name) throw userError_('Please enter your name.');
  if (!validEmail_(email)) throw userError_('Please enter a valid email address.');
  var prob = pwProblem_(pw, email); if (prob) throw userError_(prob);
  var rk = 'RL_S_' + sha_(email).substr(0, 20); rateCheck_(rk, 3); rateHit_(rk, 3600);
  dayBump_('SUREQ', Math.max(10, b.signupDailyCap * 3));
  var m = masterSS_(), url = appUrl_();
  if (readTable_(USERS, m).rows.some(function (x) { return x.Email === email; })) {
    simpleMail_(email, 'You already have a MedTrack account', 'You already have an account', 'Hi ' + esc_(name) + ', this email is already registered with MedTrack. Just sign in. If you forgot your password, tap &ldquo;Forgot password&rdquo; on the sign-in page.', 'Open MedTrack', url, 'If this was not you, you can ignore this email.');
    return { sent: true };
  }
  var raw = randomString_(40), salt = randomString_(24), now = Date.now();
  withLock_(function () {
    var t = readTable_(SIGNUPS, m);
    var keep = t.rows.filter(function (r) { return !r.Used && r.ExpiresAt > now && r.Email !== email; });
    if (keep.length !== t.rows.length) { t.sheet.getRange(2, 1, t.sheet.getMaxRows() - 1, 8).clearContent(); if (keep.length) rewriteTable_(SIGNUPS, keep, m); }
    appendRows_(SIGNUPS, [{ TokenHash: sha_(raw), Email: email, Name: name, PasswordHash: hashPw_(pw, salt), Salt: salt, ExpiresAt: now + SIGNUP_HOURS * 3600000, Used: false, CreatedAt: nowISO_() }], m);
  });
  var link = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'verify=' + raw;
  var ok = simpleMail_(email, 'Confirm your email to start your MedTrack trial', 'Confirm your email', 'Hi ' + esc_(name) + ', thanks for signing up! Tap the button to confirm your email and start your <b>' + b.trialDays + '-day free trial</b>. The link works once and expires in ' + SIGNUP_HOURS + ' hours.', 'Confirm my email', link, 'If you did not sign up, you can ignore this email. Nothing will be created.');
  if (!ok) throw userError_('We could not send the confirmation email. Please check the address and try again in a few minutes.');
  return { sent: true };
}

/** Opens the confirmation link: creates the account, the private spreadsheet and the trial, then signs the person in. */
function verifySignup_(p) {
  var token = String(p.token || '');
  if (!/^[A-Za-z0-9]{30,64}$/.test(token)) throw userError_('This confirmation link is not valid. Please sign up again.');
  var hash = sha_(token), m = masterSS_(), now = Date.now(), req = null, why = '';
  withLock_(function () {
    var r = readTable_(SIGNUPS, m).rows.filter(function (x) { return x.TokenHash === hash; })[0];
    if (!r || r.Used || r.ExpiresAt < now) { why = 'gone'; return; }
    if (readTable_(USERS, m).rows.some(function (x) { return x.Email === r.Email; })) { why = 'exists'; return; }
    r.Used = true; updateRow_(SIGNUPS, r, m); req = r;
  });
  if (why === 'exists') throw userError_('This email is already registered. Please sign in.');
  if (!req) throw userError_('This confirmation link has expired or was already used. If you have not signed in yet, please sign up again.');
  var b = getBilling_();
  try { dayBump_('SUNEW', b.signupDailyCap); }
  catch (e) { withLock_(function () { var r = readTable_(SIGNUPS, m).rows.filter(function (x) { return x.TokenHash === hash; })[0]; if (r) { r.Used = false; updateRow_(SIGNUPS, r, m); } }); throw e; }
  var id, trialEnds = addDaysYMD_(todayYMD_(), b.trialDays), row;
  try {
    id = uniqueId_('USR', indexBy_(readTable_(USERS, m).rows, 'UserID'), '');
    var saved = { SS_MEMO_: SS_MEMO_, T: TENANT_ID_, C: CACHE_PFX_ };
    var ts = createTenantSpreadsheet_(req.Name, req.Email, id);
    SS_MEMO_ = saved.SS_MEMO_; TENANT_ID_ = saved.T; CACHE_PFX_ = saved.C;
    row = { UserID: id, Email: req.Email, Name: req.Name, Role: 'Rep', Active: true, PasswordHash: req.PasswordHash, Salt: req.Salt, MustChange: false, SpreadsheetID: ts.getId(), CreatedAt: nowISO_(), LastLoginAt: nowISO_(), AlertHour: 7, LastAlertDate: '', Plan: 'Trial', TrialEnds: trialEnds, Source: 'Self' };
    withLock_(function () { appendRows_(USERS, [row], m); });
  } catch (e) {
    console.error('Sign-up failed: ' + e);
    withLock_(function () { var r = readTable_(SIGNUPS, m).rows.filter(function (x) { return x.TokenHash === hash; })[0]; if (r) { r.Used = false; updateRow_(SIGNUPS, r, m); } });
    throw userError_('We could not create your account just now. Please open the link again in a minute.');
  }
  var owner = ''; try { owner = normEmail_(Session.getEffectiveUser().getEmail()); } catch (e2) { owner = ''; }
  if (owner) simpleMail_(owner, 'New MedTrack sign-up: ' + req.Name, 'New sign-up', '<b>' + esc_(req.Name) + '</b> (' + esc_(req.Email) + ') confirmed their email and started a free trial until <b>' + esc_(fmtDate_(trialEnds)) + '</b>.', '', '', 'See them in MedTrack > Subscribers.');
  var tok = createSession_(id);
  return { token: tok, user: publicUser_(row) };
}

/* ------------------------------- Admin ------------------------------- */

function requireAdmin_(user) { if (!user || user.Role !== 'Admin') throw userError_('Only the administrator can do that.'); }

/** Lists all users with their subscription, plus the dashboard numbers (admin). */
function adminListUsers_(p, user) {
  requireAdmin_(user);
  var owner = '';
  try { owner = normEmail_(Session.getEffectiveUser().getEmail()); } catch (e) { owner = ''; }
  var isOwner = !!owner && normEmail_(user.Email) === owner;
  var m = masterSS_(), bill = getBilling_(), today = todayYMD_();
  var s = { pending: 0, total: 0, trial: 0, paying: 0, soon: 0, expired: 0, off: 0, free: 0, mrr: 0, month: 0, year: 0 };
  var rows = readTable_(USERS, m).rows.map(function (u) {
    var a = accessState_(u, bill, today), rep = u.Role !== 'Admin';
    var price = u.Plan === 'Yearly' ? (u.Amount || bill.yearlyPrice) / 12 : (u.Amount || bill.monthlyPrice);
    if (rep) {
      s.total++;
      if (!u.Active) s.off++;
      else if (a.state === 'expired') s.expired++;
      else if (a.state === 'free') s.free++;
      else {
        if (a.plan === 'Trial') s.trial++; else { s.paying++; s.mrr += price; }
        if (a.daysLeft != null && a.daysLeft <= (a.plan === 'Trial' ? bill.trialRemindDays : bill.remindDays)) s.soon++;
      }
    }
    return { uid: u.UserID, name: u.Name, email: u.Email, role: u.Role, active: u.Active, mustChange: u.MustChange, lastLogin: u.LastLoginAt, created: u.CreatedAt,
      source: u.Source || 'Admin', plan: a.plan, state: a.state, endsOn: a.endsOn, daysLeft: a.daysLeft, amount: u.Amount || (u.Plan === 'Yearly' ? bill.yearlyPrice : u.Plan === 'Monthly' ? bill.monthlyPrice : 0),
      sheetUrl: isOwner && u.SpreadsheetID ? 'https://docs.google.com/spreadsheets/d/' + u.SpreadsheetID + '/edit' : '' };
  });
  rows.sort(function (x, y) { return x.name.localeCompare(y.name); });
  var names = {}; rows.forEach(function (r) { names[r.uid] = r.name; });
  var ym = today.slice(0, 7), yy = today.slice(0, 4);
  var pays = readTable_(PAYMENTS, m).rows;
  pays.forEach(function (x) { if (String(x.PaidOn).slice(0, 7) === ym) s.month += x.Amount; if (String(x.PaidOn).slice(0, 4) === yy) s.year += x.Amount; });
  pays.sort(function (x, y) { return String(y.RecordedAt).localeCompare(String(x.RecordedAt)); });
  var recent = pays.slice(0, 15).map(function (x) { return { id: x.PaymentID, uid: x.UserID, name: names[x.UserID] || '', paidOn: x.PaidOn, plan: x.Plan, amount: x.Amount, until: x.PeriodEnd, method: x.Method, note: x.Note }; });
  s.mrr = Math.round(s.mrr * 100) / 100;
  var nowMs = Date.now(); s.pending = readTable_(SIGNUPS, m).rows.filter(function (x) { return !x.Used && x.ExpiresAt > nowMs; }).length;
  return { users: rows, appUrl: appUrl_(), summary: s, billing: bill, payments: recent, qrReady: !!driveFileId_(bill.qrUrl) };
}

/** Creates the medrep's private spreadsheet inside the owner's "MedTrack Clients" folder and sets it up. */
function createTenantSpreadsheet_(name, email, id) {
  var ss = SpreadsheetApp.create('MedTrack - ' + name + ' (' + id + ')');
  try {
    var fid = PropertiesService.getScriptProperties().getProperty('CLIENT_FOLDER_ID');
    if (fid) DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(fid));
  } catch (e) { console.error('Could not move spreadsheet to the clients folder: ' + e); }
  setupSpreadsheet_(ss, { email: email, businessName: name, tenant: true });
  return ss;
}

/** The logo picture for emails: only available when the website (not a script.google.com link) is the app address. */
function logoUrl_() {
  var u = ''; try { u = appUrl_(); } catch (e) { u = ''; }
  var m = String(u).match(/^(https:\/\/[^\/?#]+)/);
  return m && !/script\.google\.com|googleusercontent\.com/.test(m[1]) ? m[1] + '/logo-mark.png' : '';
}

/** Header band used by every MedTrack email: logo (when available) + name + a small caption. */
function emailHeader_(brand, accent, caption) {
  var img = logoUrl_();
  return '<div style="background:' + brand + ';padding:22px 28px"><table role="presentation" cellspacing="0" cellpadding="0"><tr>' +
    (img ? '<td style="padding-right:14px;vertical-align:middle"><img src="' + esc_(img) + '" width="46" height="46" alt="" style="display:block;border:0;border-radius:11px"></td>' : '') +
    '<td style="vertical-align:middle"><div style="color:#fff;font-size:22px;font-weight:800;line-height:1.1">MedTrack</div><div style="color:' + accent + ';font-size:11px;font-weight:700;letter-spacing:.12em;margin-top:3px">' + caption + '</div></td></tr></table></div>';
}

/**
 * Branded welcome / new-password email with the sign-in details. Returns true when it was sent.
 * kind: 'welcome' (new account) or 'reset' (admin issued a new temporary password).
 */
function sendCredentialEmail_(name, email, temp, url, kind, trialEnds) {
  try {
    var s = (typeof getSettings_ === 'function') ? getSettings_() : {};
    var brand = /^#[0-9A-Fa-f]{6}$/.test(String(s.BrandColor || '')) ? s.BrandColor : '#0F2A44';
    var accent = /^#[0-9A-Fa-f]{6}$/.test(String(s.AccentColor || '')) ? s.AccentColor : '#0E9AA7';
    var welcome = kind !== 'reset';
    var title = welcome ? 'Your MedTrack account is ready' : 'Your new MedTrack password';
    var intro = welcome ? 'Welcome! Your account has been created. Use the details below to sign in.' : 'Your administrator reset your password. Use the temporary password below to sign in.';
    var row = function (k, v, big) { return '<tr><td style="padding:12px 16px;border-bottom:1px solid #E6ECF2;color:#5B6F83;font-size:13px;width:38%">' + k + '</td><td style="padding:12px 16px;border-bottom:1px solid #E6ECF2;color:#0F2A44;font-weight:700;' + (big ? 'font-size:20px;letter-spacing:.06em;font-family:Consolas,Menlo,monospace;' : 'font-size:14px;') + 'word-break:break-all">' + v + '</td></tr>'; };
    var html = '<div style="background:#F3F6F9;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">' +
      '<div style="max-width:520px;margin:auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(15,42,68,.10)">' +
      emailHeader_(brand, accent, 'INVENTORY &amp; EXPIRY MONITORING') +
      '<div style="padding:28px">' +
      '<h2 style="margin:0 0 8px;color:#0F2A44;font-size:20px">' + title + '</h2>' +
      '<p style="margin:0 0 18px;color:#334A60;font-size:14.5px;line-height:1.55">Hi ' + esc_(name) + ', ' + intro + (trialEnds ? ' Your <b>free trial</b> runs until <b>' + esc_(fmtDate_(trialEnds)) + '</b>.' : '') + '</p>' +
      '<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border:1px solid #E6ECF2;border-radius:12px;border-collapse:separate;overflow:hidden">' +
      row('Sign-in email', esc_(email)) + row('Temporary password', esc_(temp), true) + '</table>' +
      '<p style="margin:24px 0"><a href="' + esc_(url) + '" style="background:' + accent + ';color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;display:inline-block">Open MedTrack</a></p>' +
      '<p style="margin:0 0 6px;color:#5B6F83;font-size:12.5px;word-break:break-all">Button not working? Open this address: <a href="' + esc_(url) + '" style="color:' + accent + '">' + esc_(url) + '</a></p>' +
      '<div style="margin-top:18px;padding:14px 16px;background:#F3F6F9;border-radius:12px;color:#334A60;font-size:13px;line-height:1.55"><b>What happens next</b><br>1. Open the link and sign in with the details above.<br>2. You will be asked to choose your own password.<br>3. Forgot it later? Tap &ldquo;Forgot password&rdquo; on the sign-in page.</div>' +
      '<p style="margin:18px 0 0;color:#7A8B9C;font-size:12px">For your security, please do not share this email.</p>' +
      '</div><div style="padding:14px 28px;background:#F8FAFC;color:#7A8B9C;font-size:11.5px;text-align:center">Powered by <a href="' + APP.URL + '" style="color:#5B6F83;font-weight:700;text-decoration:none">LAYAW SYSTEM</a></div></div></div>';
    var plain = title + '\n\nHi ' + name + ', ' + intro + '\n\nLink: ' + url + '\nEmail: ' + email + '\nTemporary password: ' + temp + '\n\nYou will be asked to choose your own password the first time you sign in.\n\nPowered by LAYAW SYSTEM';
    MailApp.sendEmail({ to: email, subject: welcome ? 'Your MedTrack account is ready' : 'Your new MedTrack password', htmlBody: html, body: plain, name: 'MedTrack' });
    return true;
  } catch (e) { console.error('Credential email failed: ' + e); return false; }
}

/** Creates a medrep account with a temporary password (shown once to the admin). */
function adminCreateUser_(p, user) {
  requireAdmin_(user);
  var name = str_(p.name, 80), email = normEmail_(p.email), role = p.role === 'Admin' ? 'Admin' : 'Rep', free = role === 'Admin' || p.plan === 'Free';
  if (!name) throw userError_('Please enter the medrep\'s name.');
  if (!validEmail_(email)) throw userError_('Please enter a valid email address.');
  var m = masterSS_();
  if (readTable_(USERS, m).rows.some(function (x) { return x.Email === email; })) throw userError_('That email is already registered.');
  var taken = indexBy_(readTable_(USERS, m).rows, 'UserID');
  var id = uniqueId_('USR', taken, '');
  var temp = tempPassword_(), salt = randomString_(24);
  var saved = { SS_MEMO_: SS_MEMO_, T: TENANT_ID_, C: CACHE_PFX_ };
  var tenantSS = createTenantSpreadsheet_(name, email, id);
  SS_MEMO_ = saved.SS_MEMO_; TENANT_ID_ = saved.T; CACHE_PFX_ = saved.C;
  var row = { UserID: id, Email: email, Name: name, Role: role, Active: true, PasswordHash: hashPw_(temp, salt), Salt: salt, MustChange: true, SpreadsheetID: tenantSS.getId(), CreatedAt: nowISO_(), LastLoginAt: '', AlertHour: 7, LastAlertDate: '', Source: 'Admin', Plan: free ? 'Free' : 'Trial', TrialEnds: free ? '' : addDaysYMD_(todayYMD_(), getBilling_().trialDays) };
  withLock_(function () { appendRows_(USERS, [row], m); });
  var url = appUrl_(), emailed = p.notify === false ? false : sendCredentialEmail_(name, email, temp, url, 'welcome', row.TrialEnds);
  return { user: { uid: id, name: name, email: email, role: role }, temp: temp, url: url, emailed: emailed, trialEnds: row.TrialEnds };
}

/** Admin resets a user's password to a new temporary one. */
function adminResetPassword_(p, user) {
  requireAdmin_(user);
  var u = readTable_(USERS, masterSS_()).rows.filter(function (x) { return x.UserID === p.uid; })[0];
  if (!u) throw userError_('That user could not be found.');
  var temp = tempPassword_();
  setPassword_(u.UserID, temp, true);
  dropSessions_(u.UserID);
  var url = appUrl_(), emailed = p.notify === false ? false : sendCredentialEmail_(u.Name, u.Email, temp, url, 'reset');
  return { temp: temp, email: u.Email, name: u.Name, url: url, emailed: emailed };
}

/** Admin switches a user on or off (their data is kept). */
function adminSetActive_(p, user) {
  requireAdmin_(user);
  if (p.uid === user.UserID) throw userError_('You cannot switch off your own account.');
  withLock_(function () {
    var m = masterSS_(), u = readTable_(USERS, m).rows.filter(function (x) { return x.UserID === p.uid; })[0];
    if (!u) throw userError_('That user could not be found.');
    u.Active = !!p.active; updateRow_(USERS, u, m);
  });
  if (!p.active) dropSessions_(p.uid);
  return {};
}

/* ------------------------- Alerts for everyone ------------------------ */

/** Keeps the master's AlertHour in step with the medrep's own "daily check time" setting. */
function syncAlertHour_() {
  var hour = parseInt(String(getSettings_().DailyAlertTime || '07:00').split(':')[0], 10);
  if (isNaN(hour)) hour = 7;
  var tid = TENANT_ID_;
  withLock_(function () {
    var m = masterSS_(), u = readTable_(USERS, m).rows.filter(function (x) { return x.UserID === tid; })[0];
    if (u) { u.AlertHour = hour; u.LastAlertDate = ''; updateRow_(USERS, u, m); }
  });
}

/** Hourly trigger body: for every active medrep whose check time has come and who has not been done today. */
function multiAlertJob_() {
  try { subscriptionReminders_(); } catch (e) { console.error('Reminders failed: ' + e); }
  var m = masterSS_(), today = todayYMD_(), hour = parseInt(Utilities.formatDate(new Date(), APP.TZ, 'H'), 10), t0 = Date.now();
  var users = readTable_(USERS, m).rows.filter(function (u) { return u.Active && u.LastAlertDate !== today && hour >= u.AlertHour && accessState_(u).state !== 'expired'; });
  var done = 0;
  users.forEach(function (u) {
    if (Date.now() - t0 > 270000) return;
    try {
      setTenant_(u);
      recalcStatuses_();
      runAlertEngine_();
      clearTenant_();
      withLock_(function () {
        var row = readTable_(USERS, m).rows.filter(function (x) { return x.UserID === u.UserID; })[0];
        if (row) { row.LastAlertDate = today; updateRow_(USERS, row, m); }
      });
      done++;
    } catch (e) { clearTenant_(); console.error('Alert run failed for ' + u.Email + ': ' + e); }
  });
  clearTenant_();
  return { users: users.length, done: done };
}

/** Hourly trigger for multi-user mode. */
function installMultiTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (tr) { if (tr.getHandlerFunction() === 'dailyAlertJob') ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger('dailyAlertJob').timeBased().everyHours(1).create();
}

/* ------------------------------- Setup ------------------------------- */

/**
 * Turns on multi-user mode. Run once from the editor. Creates the Users/Sessions/ResetTokens tabs, a
 * "MedTrack Clients" Drive folder, the first administrator (the owner's Google email) with a temporary
 * password, and the hourly alert trigger.
 */
function runMultiUserSetup() {
  var m = masterSS_(), props = PropertiesService.getScriptProperties();
  props.setProperty('SS_ID', m.getId());
  m.setSpreadsheetTimeZone(APP.TZ);
  Object.keys(MASTER_SCHEMA).forEach(function (name) {
    var cols = MASTER_SCHEMA[name], sh = m.getSheetByName(name) || m.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c[0]; })]).setBackground('#5B6F83').setFontColor('#FFFFFF').setFontWeight('bold');
    sh.setFrozenRows(1);
    var fmt = [], row = cols.map(function (c) { return c[1] === 'n' || c[1] === 'b' ? 'General' : '@'; });
    for (var i = 0; i < 2000; i++) fmt.push(row);
    if (sh.getMaxRows() < 2001) sh.insertRowsAfter(sh.getMaxRows(), 2001 - sh.getMaxRows());
    sh.getRange(2, 1, 2000, cols.length).setNumberFormats(fmt);
    try { sh.hideSheet(); } catch (e) { /* ignore */ }
  });
  if (!props.getProperty('CLIENT_FOLDER_ID')) props.setProperty('CLIENT_FOLDER_ID', DriveApp.createFolder('MedTrack Clients').getId());
  props.setProperty('MULTI_USER', '1');
  var email = normEmail_(Session.getEffectiveUser().getEmail());
  if (!validEmail_(email)) throw userError_('Could not read your Google email. Sign in to Google and try again.');
  var msg;
  if (readTable_(USERS, m).rows.some(function (u) { return u.Email === email; })) {
    msg = 'Multi-user mode is on. Your admin account (' + email + ') already exists. To get a new temporary password, use the "Reset password" button in MedTrack > Manage users, or delete your row in the hidden Users tab and run this again.';
  } else {
    var id = uniqueId_('USR', indexBy_(readTable_(USERS, m).rows, 'UserID'), ''), temp = tempPassword_(), salt = randomString_(24);
    var ts = createTenantSpreadsheet_('Admin', email, id);
    SS_MEMO_ = null; TENANT_ID_ = ''; CACHE_PFX_ = 'MT_';
    appendRows_(USERS, [{ UserID: id, Email: email, Name: 'Administrator', Role: 'Admin', Active: true, PasswordHash: hashPw_(temp, salt), Salt: salt, MustChange: true, SpreadsheetID: ts.getId(), CreatedAt: nowISO_(), LastLoginAt: '', AlertHour: 7, LastAlertDate: '', Plan: 'Free', Source: 'Admin' }], m);
    msg = 'Multi-user mode is ON.\n\nAdmin login\nEmail: ' + email + '\nTemporary password: ' + temp + '\n\nDeploy the web app with "Who has access: Anyone" and sign in. You will be asked to choose your own password.';
  }
  installMultiTrigger_();
  notify_(msg);
}

/**
 * Gives the owner (admin) a NEW temporary password. Run this from the editor if the admin password is lost.
 * The password is shown in the Execution log; the admin must choose their own at the next sign-in.
 */
function resetAdminPassword() {
  var m = masterSS_(), email = normEmail_(Session.getEffectiveUser().getEmail());
  var u = readTable_(USERS, m).rows.filter(function (x) { return x.Email === email; })[0];
  if (!u) { notify_('No admin account found for ' + email + '. Run runMultiUserSetup first.'); return; }
  var temp = tempPassword_();
  setPassword_(u.UserID, temp, true);
  dropSessions_(u.UserID);
  notify_('New admin password ready.\n\nEmail: ' + email + '\nTemporary password: ' + temp + '\n\nSign in with these. You will be asked to choose your own password.');
}

/** Turns multi-user mode off again (back to the single-user app). Data of the medreps is kept in Drive. */
function stopMultiUser() {
  PropertiesService.getScriptProperties().deleteProperty('MULTI_USER');
  notify_('Multi-user mode is OFF. The app is single-user again. Remember to set the deployment back to "Only myself".');
}
