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
function publicUser_(u) { return { uid: u.UserID, name: u.Name, email: u.Email, role: u.Role, mustChange: !!u.MustChange }; }

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
  if (/\/exec$/.test(cur)) {
    if (props.getProperty('APP_URL') !== cur) props.setProperty('APP_URL', cur);
    return cur;
  }
  return props.getProperty('APP_URL') || cur;
}

/** Admin sets the official app link by hand (used when the app was only opened through a test link). */
function adminSetAppUrl_(p, user) {
  requireAdmin_(user);
  var u = str_(p.url, 300);
  if (!/^https:\/\/[^\s]+$/.test(u) || /\/dev(\?.*)?$/.test(u)) throw userError_('Please paste the Web app link that ends with /exec. Copy it from Deploy > Manage deployments.');
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
    var html = '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0F2A44">' +
      '<h2 style="margin:0 0 8px">Reset your MedTrack password</h2><p>Hi ' + esc_(u.Name) + ', tap the button to choose a new password. The link works once and expires in ' + RESET_MINUTES + ' minutes.</p>' +
      '<p style="margin:22px 0"><a href="' + esc_(link) + '" style="background:#0E9AA7;color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:12px;display:inline-block">Choose a new password</a></p>' +
      '<p style="color:#5B6F83;font-size:12px;word-break:break-all">Button not working? Copy this address into your browser:<br>' + esc_(link) + '</p>' +
      '<p style="color:#5B6F83;font-size:13px">If you did not ask for this, you can ignore this email. Your password stays the same.</p>' +
      '<p style="color:#7A8B9C;font-size:11px;margin-top:24px">Powered by <a href="' + APP.URL + '" style="color:#5B6F83">LAYAW SYSTEM</a></p></div>';
    try { MailApp.sendEmail({ to: u.Email, subject: 'Reset your MedTrack password', htmlBody: html, body: 'Reset your MedTrack password: ' + link + '\n(Works once, expires in ' + RESET_MINUTES + ' minutes.)', name: 'MedTrack' }); }
    catch (e) { console.error('Reset email failed: ' + e); }
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

/* ------------------------------- Admin ------------------------------- */

function requireAdmin_(user) { if (!user || user.Role !== 'Admin') throw userError_('Only the administrator can do that.'); }

/** Lists all users (admin). */
function adminListUsers_(p, user) {
  requireAdmin_(user);
  var rows = readTable_(USERS, masterSS_()).rows.map(function (u) { return { uid: u.UserID, name: u.Name, email: u.Email, role: u.Role, active: u.Active, mustChange: u.MustChange, lastLogin: u.LastLoginAt, created: u.CreatedAt, sheetUrl: u.SpreadsheetID ? 'https://docs.google.com/spreadsheets/d/' + u.SpreadsheetID + '/edit' : '' }; });
  rows.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return { users: rows, appUrl: appUrl_() };
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

/** Creates a medrep account with a temporary password (shown once to the admin). */
function adminCreateUser_(p, user) {
  requireAdmin_(user);
  var name = str_(p.name, 80), email = normEmail_(p.email), role = p.role === 'Admin' ? 'Admin' : 'Rep';
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
  var row = { UserID: id, Email: email, Name: name, Role: role, Active: true, PasswordHash: hashPw_(temp, salt), Salt: salt, MustChange: true, SpreadsheetID: tenantSS.getId(), CreatedAt: nowISO_(), LastLoginAt: '', AlertHour: 7, LastAlertDate: '' };
  withLock_(function () { appendRows_(USERS, [row], m); });
  return { user: { uid: id, name: name, email: email, role: role }, temp: temp, url: appUrl_() };
}

/** Admin resets a user's password to a new temporary one. */
function adminResetPassword_(p, user) {
  requireAdmin_(user);
  var u = readTable_(USERS, masterSS_()).rows.filter(function (x) { return x.UserID === p.uid; })[0];
  if (!u) throw userError_('That user could not be found.');
  var temp = tempPassword_();
  setPassword_(u.UserID, temp, true);
  dropSessions_(u.UserID);
  return { temp: temp, email: u.Email, name: u.Name, url: appUrl_() };
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
  var m = masterSS_(), today = todayYMD_(), hour = parseInt(Utilities.formatDate(new Date(), APP.TZ, 'H'), 10), t0 = Date.now();
  var users = readTable_(USERS, m).rows.filter(function (u) { return u.Active && u.LastAlertDate !== today && hour >= u.AlertHour; });
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
    appendRows_(USERS, [{ UserID: id, Email: email, Name: 'Administrator', Role: 'Admin', Active: true, PasswordHash: hashPw_(temp, salt), Salt: salt, MustChange: true, SpreadsheetID: ts.getId(), CreatedAt: nowISO_(), LastLoginAt: '', AlertHour: 7, LastAlertDate: '' }], m);
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
