/* BOXAD. results report: one click fills the client report and the case study from
   GoatCounter (visits and taps on boxad.it/r/<campagna>/) and the "Codici" tab (codes claimed, used, spend).
   Lives in the same Apps Script project as codici.gs (it reuses campaign() and stats()). No redeploy needed:
   the web app keeps working as it is; this only runs from the Sheet menu.

   SETUP (about 10 minutes, once):
   1. Apps Script editor: + (Add a file) > Script, name it "report", paste this whole file, save.
   2. GoatCounter: boxad.goatcounter.com > your name (top right) > API > New API key,
      tick only "Read statistics". Copy the key.
   3. Apps Script: Project Settings > Script properties > Add: GOATCOUNTER_TOKEN = the key.
   4. Google Drive: upload the three BOXAD-report-modello-*.docx files (cliente, caso-studio, caso-studio-fondatrice),
      open each one, File > Save as Google Docs. Keep the three Google Docs links.
   5. Reload the Sheet: a "BOXAD" menu appears. BOXAD > Prepara tab Report (once), paste the three links
      in the "modello" rows, then fill the white cells for the campaign and run BOXAD > Crea report.
   If the Report tab was made before 23 Oct 2026, delete it and run Prepara tab Report again (new rows).
   The first run asks for permission (Drive, Docs, outside connections): that is this script, say yes. */

var GC_API = 'https://boxad.goatcounter.com/api/v0';
var REPORT_FIELDS = [
  ['campagna', 'Nome campagna, come in Campagne (es. gomme)'],
  ['cliente', 'Nome del cliente'],
  ['nome nel caso studio', 'si = il caso studio usa il nome del cliente (solo con il suo permesso), no = usa la categoria'],
  ['categoria', 'Per il caso studio senza nome (es. Un gommista)'],
  ['zona', 'Es. Santa Maria del Rovere, Treviso'],
  ['pizzerie', 'Fonte=nome, separati da ; (es. 01=Da Mario; 02=Bella Napoli)'],
  ['scatole', 'Scatole consegnate (numero)'],
  ['investimento', 'Quanto ha pagato il cliente a BOXAD, in euro (0 = campagna gratuita)'],
  ['valore cliente', 'Quanto vale per il cliente un cliente nuovo, in euro: chiederlo all\'inizio'],
  ['inizio', 'Primo giorno della campagna (data)'],
  ['fine', 'Ultimo giorno della campagna (data)'],
  ['conteggio fino a', 'Ultimo giorno da contare (vuoto = scadenza dei codici)'],
  ['dichiarati', 'Clienti che hanno detto «dalla scatola della pizza» (dal cliente, facoltativo)'],
  ['verdetto', 'Una frase in cima al report (vuoto = la scrive lo script dai numeri)'],
  ['obiettivo', 'Per il caso studio: cosa voleva ottenere il cliente, una frase'],
  ['foto', 'Link Google Drive di una foto della scatola (facoltativo)'],
  ['prossimo passo', 'Una o due frasi per il report cliente'],
  ['testimonianza', 'Frase del cliente con nome e ruolo (solo con il suo permesso)'],
  ['campagna fondatrice', 'si = caso studio «fondatrice» (racconta come è stata fatta, pochi numeri)'],
  ['modello cliente', 'Link Google Docs del modello cliente'],
  ['modello caso studio', 'Link Google Docs del modello caso studio'],
  ['modello fondatrice', 'Link Google Docs del modello caso studio fondatrice']
];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('BOXAD')
    .addItem('Crea report', 'creaReport')
    .addItem('Prepara tab Report', 'preparaReport')
    .addToUi();
}

/* ---------- the "Report" tab: inputs in column B, numbers written in columns D:E ---------- */
function preparaReport() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName('Report') || ss.insertSheet('Report');
  if (sh.getRange('A1').getValue()) { SpreadsheetApp.getUi().alert('Il tab Report esiste già.'); return; }
  sh.getRange(1, 1, 1, 5).setValues([['campo', 'valore', 'cosa scrivere', 'numero', 'valore']]).setFontWeight('bold');
  sh.getRange(2, 1, REPORT_FIELDS.length, 1).setValues(REPORT_FIELDS.map(function (f) { return [f[0]]; }));
  sh.getRange(2, 3, REPORT_FIELDS.length, 1).setValues(REPORT_FIELDS.map(function (f) { return [f[1]]; })).setFontColor('#6B625B');
  sh.getRange(2, 2, REPORT_FIELDS.length, 1).setBackground('#FFF9EE');
  sh.setColumnWidth(1, 150); sh.setColumnWidth(2, 260); sh.setColumnWidth(3, 330); sh.setColumnWidth(4, 160);
}
function readInputs(sh) {
  var rows = sh.getRange(2, 1, REPORT_FIELDS.length, 2).getValues(), o = {};
  rows.forEach(function (r) { o[String(r[0]).trim()] = r[1]; });
  return o;
}

/* ---------- GoatCounter ---------- */
function gcHits(start, end) {
  var token = PropertiesService.getScriptProperties().getProperty('GOATCOUNTER_TOKEN');
  if (!token) throw new Error('Manca GOATCOUNTER_TOKEN nelle Script properties (vedi SETUP).');
  var url = GC_API + '/stats/hits?limit=100&start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end);
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('GoatCounter ha risposto ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  var j = JSON.parse(res.getContentText());
  if (j.more) throw new Error('GoatCounter: più di 100 pagine nel periodo. Accorcia le date o chiedi a Claude di aggiungere la paginazione.');
  return j.hits || [];
}
/* visits = the page /r/<campagna>/; taps = events "<campagna>-<button>"; weekly = visits per 7 days from the start */
function gcCampaign(camp, from, to) {
  var start = Utilities.formatDate(from, 'Europe/Rome', "yyyy-MM-dd'T'00:00:00'Z'");
  var end = Utilities.formatDate(new Date(to.getTime() + 864e5), 'Europe/Rome', "yyyy-MM-dd'T'00:00:00'Z'");
  var page = new RegExp('^/r/' + camp + '(/|/index\\.html)?$'), out = { visits: 0, events: {}, weeks: [0, 0, 0, 0, 0] };
  gcHits(start, end).forEach(function (h) {
    if (!h.event && page.test(h.path)) {
      out.visits += h.count;
      (h.stats || []).forEach(function (d) {
        var n = d.daily || 0; if (!n) return;
        var w = Math.floor((new Date(d.day + 'T12:00:00Z') - from) / (7 * 864e5));
        out.weeks[Math.max(0, Math.min(4, w))] += n;
      });
    } else if (h.event && h.path.indexOf(camp + '-') === 0) {
      out.events[h.path.slice(camp.length + 1)] = (out.events[h.path.slice(camp.length + 1)] || 0) + h.count;
    }
  });
  return out;
}

/* ---------- numbers in Italian ---------- */
function n0(x) { return String(Math.round(Number(x) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function eur(x) { return x == null ? '—' : '€' + n0(Math.round(x)); }
function pct(a, b) { return b ? String(Math.round(a / b * 1000) / 10).replace('.', ',') + '%' : '—'; }
function day(d) { return Utilities.formatDate(d, 'Europe/Rome', 'd MMMM yyyy').replace(/\b[a-z]+\b/i, function (m) { return MESI[m.toLowerCase()] || m; }); }
var MESI = { january: 'gennaio', february: 'febbraio', march: 'marzo', april: 'aprile', may: 'maggio', june: 'giugno',
  july: 'luglio', august: 'agosto', september: 'settembre', october: 'ottobre', november: 'novembre', december: 'dicembre' };
function list(o, names) {
  var keys = Object.keys(o).sort(function (a, b) { return o[b] - o[a]; });
  return keys.length ? keys.map(function (k) { return (names && names[k] || k) + ' ' + o[k]; }).join('  ·  ') : '—';
}
function bar(n, max) { return n ? new Array(Math.max(1, Math.round(n / max * 30)) + 1).join('█') : ''; }
function top(o) {
  var k = Object.keys(o).sort(function (a, b) { return o[b] - o[a]; })[0];
  return k ? { key: k, n: o[k] } : null;
}
function yes(v) { return /^(si|sì|yes|true|1)$/i.test(String(v).trim()); }
function asDate(v, label) {
  var d = v instanceof Date ? v : new Date(String(v) + 'T00:00:00');
  if (isNaN(d)) throw new Error('Data mancante o sbagliata: ' + label);
  return d;
}

/* ---------- the button ---------- */
function creaReport() {
  var ui = SpreadsheetApp.getUi(), sh = SpreadsheetApp.getActive().getSheetByName('Report');
  if (!sh) { ui.alert('Prima: BOXAD > Prepara tab Report.'); return; }
  try {
    var v = readInputs(sh), camp = String(v['campagna']).trim().toLowerCase(), c = campaign(camp);
    if (!c) throw new Error('Campagna "' + camp + '" non trovata nel tab Campagne.');
    var from = asDate(v['inizio'], 'inizio'), to = asDate(v['fine'], 'fine');
    var until = v['conteggio fino a'] ? asDate(v['conteggio fino a'], 'conteggio fino a') : c.expires;
    var gc = gcCampaign(camp, from, until), s = stats({}, c);

    var names = {};
    String(v['pizzerie'] || '').split(';').forEach(function (p) {
      var kv = p.split('='); if (kv.length === 2) names[kv[0].trim()] = kv[1].trim();
    });
    var byPizzeria = {};
    Object.keys(gc.events).forEach(function (e) { if (e.indexOf('fonte-') === 0 && e !== 'fonte-amico') byPizzeria[e.slice(6)] = gc.events[e]; });

    var boxes = Number(v['scatole']) || 0, paid = Number(v['investimento']) || 0, worth = Number(v['valore cliente']) || 0;
    var contacts = (gc.events.whatsapp || 0) + (gc.events.chiama || 0) + (gc.events['richiesta-inviata'] || 0);
    var bought = s.spend.sotto + s.spend.sopra, maxWeek = Math.max.apply(null, gc.weeks) || 1;
    var soglia = c.threshold ? '€' + n0(c.threshold) : 'soglia';
    var nPizz = Object.keys(names).length;

    // new customers: what the shop ticked at the till; if it never ticked, fall back to all codes used
    var answered = s.isNew.si + s.isNew.no, base = answered ? s.isNew.si : s.used;
    var who = (base === 1 ? 'cliente ' : 'clienti ') + (answered ? (base === 1 ? 'nuovo' : 'nuovi') : 'con il codice');
    var even = paid && worth ? Math.ceil(paid / worth) : 0;
    var evenLine = !paid ? 'campagna gratuita: ogni cliente arrivato è un guadagno'
      : !worth ? 'diteci quanto vale per voi un cliente nuovo e calcoliamo se la campagna si è ripagata'
      : 'valore stimato di ' + base + ' ' + who + ' a ' + eur(worth) + '. Per ripagare i ' + eur(paid) + ' ' +
        (base >= even ? 'ne bastavano ' : 'ne servivano ') + even + '.';
    var verdict = String(v['verdetto'] || '').trim() ||
      (even ? (base >= even
        ? 'Campagna ripagata: ' + base + ' ' + who + ' in negozio, ne bastavano ' + even + ' per rientrare dell\'investimento.'
        : 'Campagna non ancora ripagata: ' + base + ' ' + who + ' in negozio, ne servivano ' + even + '. Qui sotto vedete cosa cambiare.')
        : n0(gc.visits) + ' persone hanno aperto la vostra offerta dalla scatola e ' + n0(s.used) + ' sono venute in negozio con il codice.');

    // "Cosa fare adesso": moves taken from their own numbers
    var g = top(s.gift), w = top(s.when), pz = top(byPizzeria), noShow = s.claimed - s.used, acts = [];
    if (!s.claimed) acts.push('Nessuno ha chiesto il codice: il regalo non ha convinto. Alla prossima campagna proviamo un regalo più forte e più semplice da capire.');
    if (g) acts.push('«' + g.key + '» è il regalo più scelto (' + g.n + ' su ' + s.claimed + '): usatelo come offerta d\'ingresso anche in negozio e sui social.');
    if (w) acts.push('Il momento più scelto è «' + w.key + '» (' + w.n + ' su ' + s.claimed + '): preparate personale e magazzino per quel periodo.');
    if (noShow > 0) acts.push((noShow === 1 ? '1 persona ha chiesto il codice ma non è venuta.' : noShow + ' persone hanno chiesto il codice ma non sono venute.') + ' Chi vi ha scritto su WhatsApp vi ha lasciato il numero: un promemoria prima del ' + day(c.expires) + ' può riportarne qualcuna.');
    if (pz && Object.keys(byPizzeria).length > 1) acts.push((names[pz.key] || 'La pizzeria ' + pz.key) + ' ha portato più visite (' + pz.n + '): alla prossima campagna mettiamo lì più scatole.');
    acts.push('Continuate a chiedere «come ci ha conosciuto?» ai clienti nuovi: conta anche chi è arrivato senza codice.');
    if (!answered && s.used) acts.push('In negozio, quando segnate un codice, toccate anche «cliente nuovo?»: è il numero che dice se la campagna vi ha portato gente nuova.');

    var D = {
      cliente: v['cliente'], nome_caso: yes(v['nome nel caso studio']) ? v['cliente'] : v['categoria'], zona: v['zona'],
      periodo: day(from) + ' – ' + day(to), data_report: day(new Date()),
      scatole: n0(boxes), n_pizzerie: nPizz === 1 ? '1 pizzeria' : (nPizz || '—') + ' pizzerie',
      pizzerie: Object.keys(names).map(function (k) { return names[k]; }).join(', ') || '—',
      reach: n0(Math.round(boxes * 1.5 / 100) * 100) + '–' + n0(Math.round(boxes * 2.5 / 100) * 100),
      scansioni: n0(gc.visits), pct_scan: pct(gc.visits, boxes),
      whatsapp: n0(gc.events.whatsapp), chiamate: n0(gc.events.chiama), moduli: n0(gc.events['richiesta-inviata']),
      codici: n0(s.claimed), usati: n0(s.used), nuovi: answered ? n0(s.isNew.si) : 'non registrato',
      acquisti: n0(bought), sotto: n0(s.spend.sotto), sopra: n0(s.spend.sopra), soglia: soglia,
      spesa_minima: eur(s.spend.sopra * c.threshold), investimento: paid ? eur(paid) : 'campagna gratuita',
      valore_cliente: worth ? eur(worth) : 'non indicato', pareggio: even ? String(even) : '—',
      // a free campaign has no cost per customer: say so instead of printing €0
      costo_nuovo: paid && base ? eur(paid / base) : '—',
      valore_generato: worth ? eur(base * worth) : '—',
      ritorno: paid && worth ? '€' + (base * worth / paid).toFixed(2).replace('.', ',') : '—',
      pareggio_frase: evenLine, verdetto: verdict,
      azione1: acts[0] || '', azione2: acts[1] || '', azione3: acts[2] || '', azione4: acts[3] || '',
      regali: list(s.gift), orari: list(s.when), per_pizzeria: list(byPizzeria, names), amici: n0(s.source.amico),
      sett1: n0(gc.weeks[0]), sett2: n0(gc.weeks[1]), sett3: n0(gc.weeks[2]), sett4: n0(gc.weeks[3]), dopo: n0(gc.weeks[4]),
      bar1: bar(gc.weeks[0], maxWeek), bar2: bar(gc.weeks[1], maxWeek), bar3: bar(gc.weeks[2], maxWeek),
      bar4: bar(gc.weeks[3], maxWeek), bar5: bar(gc.weeks[4], maxWeek),
      dichiarati: v['dichiarati'] === '' ? 'non comunicato' : n0(v['dichiarati']),
      // the client's own review link, business already filled in (boxad.it/recensione/, see r/recensione.js)
      link_recensione: 'boxad.it/recensione/?camp=' + camp + '&att=' + encodeURIComponent(String(v['cliente'])).replace(/%20/g, '+'),
      prossimo_passo: v['prossimo passo'] || '', testimonianza: v['testimonianza'] || '—', obiettivo: v['obiettivo'] || '',
      passo1: n0(boxes) + ' scatole stampate con la pubblicità del negozio e un QR, consegnate da ' +
        (nPizz === 1 ? '1 pizzeria' : nPizz + ' pizzerie') + ' a ' + v['zona'] + ' dal ' + day(from) + ' al ' + day(to) + '.',
      passo2: 'Il QR apre una pagina con ' + (Object.keys(s.gift).length > 1 ? Object.keys(s.gift).length + ' regali' : 'un regalo') +
        ' a scelta: chi sceglie riceve un codice personale, valido una volta sola, e prenota su WhatsApp.',
      passo3: 'In negozio il codice viene segnato come usato: sappiamo chi è arrivato dalla scatola, senza raccogliere nomi o numeri.'
    };

    // the numbers also go in the tab, so they can be checked before sending anything
    var keys = Object.keys(D).filter(function (k) { return k.indexOf('bar') !== 0; });
    sh.getRange(2, 4, Math.max(sh.getLastRow(), keys.length + 6), 2).clearContent();
    sh.getRange(2, 4, keys.length, 2).setValues(keys.map(function (k) { return [k, String(D[k])]; }));

    var links = [], stamp = Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd');
    var caseTpl = yes(v['campagna fondatrice']) ? 'modello fondatrice' : 'modello caso studio';
    [['modello cliente', 'BOXAD report ' + v['cliente']], [caseTpl, 'BOXAD caso studio ' + D.nome_caso]].forEach(function (t) {
      if (!v[t[0]]) return;
      var doc = fillTemplate(v[t[0]], t[1] + ' ' + stamp, D, v['foto']);
      links.push([t[1] + ' (Doc)', doc.doc], [t[1] + ' (PDF)', doc.pdf]);
    });
    var at = keys.length + 3;
    if (links.length) sh.getRange(at, 4, links.length, 2).setValues(links);
    ui.alert(links.length ? 'Fatto. Controlla i numeri nelle colonne D:E e apri i link sotto.' : 'Numeri aggiornati (colonne D:E). Per i documenti, incolla i link dei modelli.');
  } catch (err) {
    ui.alert('Report non creato: ' + (err && err.message || err));
  }
}

function fileId(link) { return (String(link).match(/[-\w]{25,}/) || [])[0]; }
function fillTemplate(link, name, D, photo) {
  var id = fileId(link);
  if (!id) throw new Error('Link del modello non valido: ' + link);
  var tpl = DriveApp.getFileById(id), folder = tpl.getParents().hasNext() ? tpl.getParents().next() : DriveApp.getRootFolder();
  var copy = tpl.makeCopy(name, folder), doc = DocumentApp.openById(copy.getId()), body = doc.getBody();
  Object.keys(D).forEach(function (k) {
    body.replaceText('\\{\\{' + k + '\\}\\}', String(D[k] == null ? '' : D[k]));
  });
  placePhoto(body, photo);
  doc.saveAndClose();
  var pdf = folder.createFile(copy.getAs('application/pdf')).setName(name + '.pdf');
  return { doc: copy.getUrl(), pdf: pdf.getUrl() };
}

/* {{foto}} becomes the box photo from Drive, or disappears when there is none */
function placePhoto(body, link) {
  var hit = body.findText('\\{\\{foto\\}\\}');
  if (!hit) return;
  var p = hit.getElement().getParent().asParagraph(), id = link && fileId(link);
  if (!id) { p.removeFromParent(); return; }
  p.clear();
  var img = p.appendInlineImage(DriveApp.getFileById(id).getBlob()), w = 430;
  img.setHeight(Math.round(img.getHeight() * w / img.getWidth())).setWidth(w);
}
