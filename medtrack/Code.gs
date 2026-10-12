/**
 * MedTrack - Code.gs
 * Web app entry point, template include helper and the single API gateway
 * the front end talks to (google.script.run.api).
 */

/** Serves the single-page app. Access is restricted by the deployment ("Only myself"). */
function doGet() {
  var tpl = HtmlService.createTemplateFromFile('Index');
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
    validateImport: function () { return validateImport_(); },
    runImport: function (p) { return runImport_(p); }
  };
}

/**
 * Single entry point for the client. Always returns a JSON string:
 * {ok:true, ...result} or {ok:false, error:"human readable message"}.
 * Raw errors are logged but never shown to the user.
 */
function api(action, json) {
  try {
    var fn = actions_()[action];
    if (!fn) throw userError_('That action is not available.');
    if (action === 'loadAll') return loadAll_();
    var payload = json ? JSON.parse(json) : {};
    var out = fn(payload) || {};
    out.ok = true;
    return JSON.stringify(out);
  } catch (e) {
    if (!e || !e.isUser) console.error('api(' + action + ') failed: ' + (e && e.stack ? e.stack : e));
    var msg = e && e.isUser ? e.message : 'Something went wrong on our side. Your data is safe, please try again.';
    return JSON.stringify({ ok: false, error: msg });
  }
}
