/**
 * MedTrack - Code.gs
 * Web app entry point, template include helper and the single API gateway
 * the front end talks to (google.script.run.api).
 */

/** Serves the single-page app. Access is restricted by the deployment ("Only myself"). */
function doGet(e) {
  // Connection check: open <web app link>?ping=1 to confirm the deployment itself is reachable (shows plain text, no data).
  if (e && e.parameter && e.parameter.ping) return ContentService.createTextOutput('MedTrack is online. Version ' + APP.VERSION + (isMulti_() ? ' (multi-user)' : ' (single-user)'));
  var tpl = HtmlService.createTemplateFromFile('Index');
  var reset = e && e.parameter && /^[A-Za-z0-9]{30,64}$/.test(e.parameter.reset || '') ? e.parameter.reset : '';
  try { appUrl_(); } catch (err) { /* remembering the live link is best-effort */ }
  tpl.multiJson = isMulti_() ? 'true' : 'false';
  tpl.resetJson = JSON.stringify(reset);
  return tpl.evaluate()
    .setTitle('MedTrack')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Template helper: <?!= include('Styles') ?> pastes another HTML file in place. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Table of actions the client may call. Built lazily so file load order never matters. */
function actions_() {
  return {
    loadAll: function () { return null; },
    saveProduct: saveProduct_,
    setProductActive: setProductActive_,
    saveAccount: saveAccount_,
    setAccountActive: setAccountActive_,
    receiveDelivery: receiveDelivery_,
    recordMovement: recordMovement_,
    saveSettings: saveSettings_,
    sendTestAlert: function () { return sendTestAlert_(); },
    runAlertsNow: function () { return runAlertsNow_(); },
    detectTelegramChat: function () { return detectTelegramChat_(); },
    reconcile: function (p) { return reconcile_(!!p.fix); },
    getReport: function (p) { return getReportPreview_(p); },
    exportPdf: function (p) { return exportReportPdf_(p); },
    exportXlsx: function (p) { return exportReportXlsx_(p); },
    validateImport: function (p) { return validateImport_(p); },
    runImport: function (p) { return runImport_(p); },
    seedDemo: function () { seedDemoData_(); return {}; },
    clearAllData: function () { clearAllData_(); return {}; },
    login: login_,
    logout: logout_,
    changePassword: changePassword_,
    requestReset: requestReset_,
    resetPassword: resetPassword_,
    adminListUsers: adminListUsers_,
    adminCreateUser: adminCreateUser_,
    adminResetPassword: adminResetPassword_,
    adminSetActive: adminSetActive_,
    adminSetAppUrl: adminSetAppUrl_
  };
}

/** Actions that work before sign-in (multi-user mode). */
var PUBLIC_ACTIONS_ = { login: 1, requestReset: 1, resetPassword: 1 };

/**
 * Single entry point for the client. Always returns a JSON string:
 * {ok:true, ...result} or {ok:false, error:"human readable message", code?:"AUTH"}.
 * In multi-user mode every action except login/reset needs a valid session token, and all data
 * access is switched to that user's own spreadsheet. Raw errors are logged, never shown.
 */
function api(action, json, token) {
  try {
    var fn = actions_()[action];
    if (!fn) throw userError_('That action is not available.');
    var user = null;
    if (isMulti_() && !PUBLIC_ACTIONS_[action]) {
      user = authenticate_(token);
      if (user.MustChange && action !== 'changePassword' && action !== 'logout') { var ce = userError_('Please choose your own password first.'); ce.code = 'CHANGE'; throw ce; }
    }
    if (action === 'loadAll') return loadAll_(user);
    var payload = json ? JSON.parse(json) : {};
    var out = fn(payload, user, token) || {};
    out.ok = true;
    return JSON.stringify(out);
  } catch (e) {
    if (!e || !e.isUser) console.error('api(' + action + ') failed: ' + (e && e.stack ? e.stack : e));
    var msg = e && e.isUser ? e.message : 'Something went wrong on our side. Your data is safe, please try again.';
    var res = { ok: false, error: msg };
    if (e && e.code) res.code = e.code;
    return JSON.stringify(res);
  }
}
