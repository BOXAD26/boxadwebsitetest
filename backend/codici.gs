/* BOXAD. gift codes: Google Apps Script backend for boxad.it/r/<campagna> and boxad.it/v/.
   It hands out single-use codes, lets the shop mark them used, and counts results.
   No personal data: only code, campaign, chosen gift, preferred time, source (pizzeria or friend), dates, spend band.

   SETUP (about 10 minutes, once):
   1. Create a Google Sheet called "BOXAD codici" with two tabs:
      - "Campagne", row 1: campagna | prefisso | pin | scadenza | soglia | attiva
        one row per campaign, e.g.: gomme | GOM | 482913 | 2027-01-31 | 200 | si
        (pin = 6 digits you give only to the shop; soglia = euro amount that splits small/big purchases)
      - "Codici", row 1: codice | campagna | regalo | quando | fonte | richiesto | usato | spesa | nuovo
        (nuovo = si/no: the shop says if the customer is new; added 23 Oct 2026, just type the header in I1)
   2. In the Sheet: Extensions > Apps Script, paste this whole file, save.
   3. Deploy > New deployment > type "Web app": execute as "Me", who has access "Anyone". Copy the /exec address.
   4. Paste that address in r/codici.js (CODES_API).
   Results are for BOXAD only: the shop page can check and mark codes but never sees campaign numbers.
   Read the numbers in the "Codici" tab, or call ?a=stats&camp=<campagna>&admin=<ADMIN_PIN>
   after setting ADMIN_PIN in Project Settings > Script properties. */

var ALPHABET = 'ACEFHJKMNPRTUVWXY3479'; // no 0/O, 1/I/L, 2/Z, 5/S, 6/G, 8/B: easy to read aloud
var MAX_CLAIMS_PER_MIN = 30;           // per campaign: stops scripted floods
var MAX_BAD_PINS = 5;                  // per campaign per 15 minutes

function doGet(e) {
  // the campaign travels as "camp": Google reserves "c" and "sid" in web app addresses
  var p = e.parameter || {}, out;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (p.a === 'claim') out = claim(p);
    else if (p.a === 'login') out = withPin(p, function (p, c) { return { ok: true, threshold: c.threshold }; });
    else if (p.a === 'check') out = withPin(p, check);
    else if (p.a === 'use') out = withPin(p, use);
    else if (p.a === 'spend') out = withPin(p, spend);
    else if (p.a === 'stats') out = adminOnly(p, stats);
    else out = { ok: false, err: 'azione', got: Object.keys(p) }; // shows which parameters arrived
  } catch (err) {
    out = { ok: false, err: 'errore', detail: String(err && err.message || err) };
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- sheet helpers ---------- */
function sheet(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function clean(v, max) {
  v = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').trim().slice(0, max || 60);
  return /^[=+\-@]/.test(v) ? "'" + v : v; // never let input become a spreadsheet formula
}
function campaign(name) {
  var rows = sheet('Campagne').getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === String(name).trim().toLowerCase()) {
      var exp = rows[i][3] instanceof Date ? rows[i][3] : new Date(String(rows[i][3]) + 'T23:59:59');
      if (rows[i][3] instanceof Date) exp.setHours(23, 59, 59);
      return {
        name: String(rows[i][0]).trim().toLowerCase(), prefix: String(rows[i][1]).trim().toUpperCase(),
        pin: String(rows[i][2]).trim(), expires: exp, threshold: Number(rows[i][4]) || 0,
        active: /^(si|sì|yes|true|1)$/i.test(String(rows[i][5]).trim())
      };
    }
  }
  return null;
}
function findCode(code) {
  var hit = sheet('Codici').getRange('A:A').createTextFinder(code).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}
function iso(d) { return d instanceof Date ? Utilities.formatDate(d, 'Europe/Rome', 'yyyy-MM-dd') : ''; }
function rowInfo(r, c) {
  var v = sheet('Codici').getRange(r, 1, 1, 9).getValues()[0];
  var used = v[6] instanceof Date;
  return {
    code: v[0], gift: v[2], when: v[3], source: v[4], claimed: iso(v[5]), used: iso(v[6]), spend: v[7], isNew: v[8],
    status: used ? 'usato' : (new Date() > c.expires ? 'scaduto' : 'valido'),
    threshold: c.threshold, expires: iso(c.expires)
  };
}

/* ---------- customer: get a code ---------- */
function claim(p) {
  var c = campaign(p.camp);
  if (!c || !c.active) return { ok: false, err: 'campagna' };
  if (new Date() > c.expires) return { ok: false, err: 'scaduta' };
  var cache = CacheService.getScriptCache(), key = 'claims-' + c.name;
  var n = Number(cache.get(key) || 0);
  if (n >= MAX_CLAIMS_PER_MIN) return { ok: false, err: 'troppi' };
  cache.put(key, String(n + 1), 60);
  var code;
  do {
    code = c.prefix + '-';
    for (var i = 0; i < 4; i++) code += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  } while (findCode(code));
  sheet('Codici').appendRow([code, c.name, clean(p.g), clean(p.w), clean(p.s, 20), new Date(), '', '']);
  return { ok: true, code: code, expires: iso(c.expires) };
}

/* ---------- shop: everything below needs the campaign PIN ---------- */
function withPin(p, fn) {
  var c = campaign(p.camp);
  if (!c) return { ok: false, err: 'campagna' };
  var cache = CacheService.getScriptCache(), key = 'badpin-' + c.name;
  var bad = Number(cache.get(key) || 0);
  if (bad >= MAX_BAD_PINS) return { ok: false, err: 'bloccato' };
  if (String(p.pin || '') !== c.pin) { cache.put(key, String(bad + 1), 900); return { ok: false, err: 'pin' }; }
  return fn(p, c);
}
function codeRow(p, c) {
  var code = String(p.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.indexOf(c.prefix) === 0) code = c.prefix + '-' + code.slice(c.prefix.length);
  var r = findCode(code);
  if (!r || String(sheet('Codici').getRange(r, 2).getValue()) !== c.name) return 0;
  return r;
}
function check(p, c) {
  var r = codeRow(p, c);
  if (!r) return { ok: true, status: 'inesistente' };
  var info = rowInfo(r, c); info.ok = true; return info;
}
function use(p, c) {
  var r = codeRow(p, c);
  if (!r) return { ok: true, status: 'inesistente' };
  var info = rowInfo(r, c);
  if (info.status !== 'valido') { info.ok = true; return info; }
  sheet('Codici').getRange(r, 7, 1, 3).setValues([[new Date(), spendBand(p.spend), newBand(p.nuovo)]]);
  info = rowInfo(r, c); info.ok = true; info.justUsed = true; return info;
}
function spend(p, c) {
  var r = codeRow(p, c);
  if (!r) return { ok: true, status: 'inesistente' };
  if (!(sheet('Codici').getRange(r, 7).getValue() instanceof Date)) return { ok: false, err: 'non-usato' };
  sheet('Codici').getRange(r, 8, 1, 2).setValues([[spendBand(p.spend), newBand(p.nuovo)]]);
  var info = rowInfo(r, c); info.ok = true; return info;
}
function spendBand(v) { return ['no', 'sotto', 'sopra'].indexOf(v) >= 0 ? v : ''; }
function newBand(v) { return ['si', 'no'].indexOf(v) >= 0 ? v : ''; }

/* ---------- report numbers: BOXAD only, never the shop ---------- */
function adminOnly(p, fn) {
  var admin = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  var c = campaign(p.camp);
  if (!c) return { ok: false, err: 'campagna' };
  var cache = CacheService.getScriptCache(), key = 'badadmin';
  var bad = Number(cache.get(key) || 0);
  if (bad >= MAX_BAD_PINS) return { ok: false, err: 'bloccato' };
  if (!admin || String(p.admin || '') !== admin) { cache.put(key, String(bad + 1), 900); return { ok: false, err: 'pin' }; }
  return fn(p, c);
}
function stats(p, c) {
  var rows = sheet('Codici').getDataRange().getValues(), s = {
    ok: true, claimed: 0, used: 0, spend: { no: 0, sotto: 0, sopra: 0, '': 0 }, isNew: { si: 0, no: 0, '': 0 },
    gift: {}, when: {}, source: {}, threshold: c.threshold, expires: iso(c.expires)
  };
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) !== c.name) continue;
    s.claimed++;
    tally(s.gift, rows[i][2]); tally(s.when, rows[i][3]); tally(s.source, rows[i][4] || 'diretto');
    if (rows[i][6] instanceof Date) { s.used++; s.spend[rows[i][7] || '']++; s.isNew[rows[i][8] || '']++; }
  }
  return s;
}
function tally(o, k) { k = String(k || '-'); o[k] = (o[k] || 0) + 1; }
