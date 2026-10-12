/**
 * MedTrack - Config.gs
 * Central constants, sheet schema, defaults and small shared helpers.
 * Only function declarations and plain `var` data live at top level so that
 * file load order never matters.
 */

var APP = {
  NAME: 'MedTrack',
  TZ: 'Asia/Manila',
  VERSION: '1.0.0',
  CACHE_TTL: 21600,      // seconds (6 hours, the CacheService maximum)
  CACHE_CHUNK: 30000,    // characters per cache entry (safe under the 100 KB limit)
  MAX_LINES: 100,        // max line items per delivery
  MAX_QTY: 1000000
};

var SH = {
  PRODUCTS: 'Products',
  BATCHES: 'Batches',
  DELIVERIES: 'Deliveries',
  ACCOUNTS: 'Accounts',
  MOVEMENTS: 'Movements',
  ALERTLOG: 'AlertLog',
  SETTINGS: 'Settings',
  IMPORT: 'Import'
};

/**
 * Column schema per table: [header, type].
 * Types: s=string, n=number, d=date (yyyy-MM-dd text), t=timestamp (ISO text), b=boolean.
 * Movements and Deliveries carry two trailing helper columns (RequestID, Source)
 * that make saves idempotent and let consignment sales be told apart from direct sales.
 */
var SCHEMA = {
  Products: [['ProductID','s'],['BrandName','s'],['GenericName','s'],['Dosage','s'],['Form','s'],['PackSize','s'],['Principal','s'],['UnitCost','n'],['SellingPrice','n'],['ReorderLevel','n'],['Active','b'],['CreatedAt','t'],['UpdatedAt','t']],
  Batches: [['BatchID','s'],['ProductID','s'],['LotNumber','s'],['ExpiryDate','d'],['QtyReceived','n'],['QtyOnHand','n'],['DeliveryID','s'],['Status','s'],['CreatedAt','t'],['UpdatedAt','t']],
  Deliveries: [['DeliveryID','s'],['DeliveryDate','d'],['ReferenceNo','s'],['Notes','s'],['CreatedAt','t'],['RequestID','s']],
  Accounts: [['AccountID','s'],['Name','s'],['Type','s'],['Address','s'],['ContactPerson','s'],['ContactNo','s'],['Active','b']],
  Movements: [['MovementID','s'],['Date','d'],['BatchID','s'],['AccountID','s'],['Type','s'],['Qty','n'],['UnitPrice','n'],['Notes','s'],['CreatedAt','t'],['RequestID','s'],['Source','s']],
  AlertLog: [['AlertID','s'],['Date','t'],['BatchID','s'],['Threshold','s'],['Channel','s'],['Status','s']],
  Settings: [['Key','s'],['Value','s'],['Description','s']]
};

var MOVEMENT_TYPES = ['Sample','Consignment','Sale','Return','Pullout','Adjustment'];
var ACCOUNT_TYPES = ['Doctor','Pharmacy','Hospital','Clinic'];
var BATCH_STATUSES = ['Active','Near Expiry','Expired','Pulled Out','Depleted'];
var ID_PREFIX = { Products: 'PRD', Batches: 'BAT', Deliveries: 'DEL', Accounts: 'ACC', Movements: 'MOV', AlertLog: 'ALT' };

/** Default Settings rows: [key, value, description]. Secrets are NOT here (Script Properties). */
var DEFAULT_SETTINGS = [
  ['BusinessName', 'My Pharma Territory', 'Name shown on reports and alerts'],
  ['AlertEmail', '', 'Where expiry alert emails are sent'],
  ['EmailEnabled', 'TRUE', 'Send alerts by email'],
  ['TelegramEnabled', 'TRUE', 'Send alerts to Telegram (needs bot token in Script Properties)'],
  ['TelegramChatId', '', 'Your Telegram chat ID'],
  ['AlertThresholds', '180,90,60,30', 'Days before expiry that trigger an alert'],
  ['DailyAlertTime', '07:00', 'Time of the daily check (Asia/Manila), HH:mm'],
  ['SmsEnabled', 'FALSE', 'Optional paid SMS alerts'],
  ['SmsEndpoint', 'https://api.semaphore.co/api/v4/messages', 'SMS provider URL (swap for any provider)'],
  ['SmsRecipient', '', 'Mobile number for SMS, e.g. 09171234567'],
  ['SmsSender', '', 'SMS sender name (if the provider supports it)'],
  ['SmsContentType', 'form', 'form or json'],
  ['SmsBodyTemplate', 'apikey={{apikey}}&number={{number}}&message={{message}}&sendername={{sender}}', 'Request body; placeholders: {{apikey}} {{number}} {{message}} {{sender}}']
];

/** Columns of the Import sheet (paste Excel data under these headers). */
var IMPORT_HEADERS = ['BrandName','GenericName','Dosage','Form','PackSize','Principal','LotNumber','ExpiryDate','Quantity','UnitCost','SellingPrice','ImportStatus'];

/** Creates an Error that is safe to show to the user as-is. */
function userError_(msg) {
  var e = new Error(msg);
  e.isUser = true;
  return e;
}

var SS_MEMO_ = null;

/** Returns the bound spreadsheet (falls back to the ID saved by runSetup). Memoised per execution. */
function getSS_() {
  if (SS_MEMO_) return SS_MEMO_;
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty('SS_ID');
    if (!id) throw userError_('MedTrack is not set up yet. Open the Google Sheet and run runSetup first.');
    ss = SpreadsheetApp.openById(id);
  }
  SS_MEMO_ = ss;
  return ss;
}

/** Today's date in Asia/Manila as yyyy-MM-dd. */
function todayYMD_() {
  return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd');
}

/** Current timestamp in Asia/Manila (ISO 8601 with offset). */
function nowISO_() {
  return Utilities.formatDate(new Date(), APP.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/** Converts yyyy-MM-dd to a whole-day number (days since 1970-01-01). */
function ymdToDays_(ymd) {
  var p = String(ymd).split('-');
  return Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
}

/** Whole days from one yyyy-MM-dd to another (positive when `to` is later). */
function daysBetween_(from, to) {
  return ymdToDays_(to) - ymdToDays_(from);
}

/** Adds (or subtracts) whole days to a yyyy-MM-dd string. */
function addDaysYMD_(ymd, n) {
  var d = new Date((ymdToDays_(ymd) + n) * 86400000);
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

/** Validates a yyyy-MM-dd string including real calendar dates (rejects 2026-02-31). */
function isValidYMD_(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var p = s.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  return d.getUTCFullYear() === +p[0] && d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2] && +p[0] >= 2000 && +p[0] <= 2100;
}

/** Formats yyyy-MM-dd as "12 Oct 2026" for messages and reports. */
function fmtDate_(ymd) {
  if (!ymd) return '';
  var p = String(ymd).split('-');
  var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (+p[2]) + ' ' + m[+p[1] - 1] + ' ' + p[0];
}

/** Formats a number as Philippine peso, e.g. "₱1,250.00". */
function peso_(n) {
  var v = Number(n) || 0;
  var s = Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (v < 0 ? '-' : '') + '₱' + s;
}

/** Formats an integer with thousands separators. */
function fmtInt_(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Escapes text for safe inclusion in HTML. */
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Generates a unique-looking ID such as "BAT-7K3M9Q2A". */
function newId_(prefix) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < 8; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return prefix + '-' + out;
}

/** True when an ID looks like one this system would generate for the prefix. */
function isValidId_(id, prefix) {
  return typeof id === 'string' && new RegExp('^' + prefix + '-[A-Z0-9]{8}$').test(id);
}

/** Loose boolean parser for sheet values (true/'TRUE'/1/'yes'). */
function toBool_(v) {
  if (typeof v === 'boolean') return v;
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1' || s === 'y';
}

/** Trims a value to a string with a max length. */
function str_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return max && s.length > max ? s.substring(0, max) : s;
}

/** Normalises any date-ish sheet value to yyyy-MM-dd ('' when not a date). */
function toYMD_(v) {
  if (v === '' || v == null) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    return Utilities.formatDate(v, APP.TZ, 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}
