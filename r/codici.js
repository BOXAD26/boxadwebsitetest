/* BOXAD. gift codes. Customer pages (r/<campagna>/): pick a gift, get a single-use code, book on WhatsApp with it.
   Shop page (v/): check a code and mark it used. Campaign numbers are for BOXAD only (Google Sheet), not shown to the shop.
   CODES_API: the Google Apps Script web app address (backend/codici.gs, setup steps there).
   While it is empty, or on a page with data-demo, everything runs as a demo in the browser and nothing is saved. */
var CODES_API='https://script.google.com/macros/s/AKfycbxfYjgZ6q8JHcadI1ZmcL9FNcVA68YD4_n4PQDDj7h67CToUMMGtcmvxPlKCRzZ5MSB8Q/exec';

function codesCall(params){
  var q=Object.keys(params).map(function(k){return k+'='+encodeURIComponent(params[k])}).join('&');
  return fetch(CODES_API+'?'+q).then(function(r){return r.json()});
}
function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k)||'null');if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v))}catch(e){return null}}
function fmtDate(s){if(!s)return '';var d=s.split('-');return d.length===3?d[2]+'/'+d[1]+'/'+d[0]:s}
function tick(fn){if(typeof count==='function')fn()}

/* ---------- customer page ---------- */
(function(){
  var form=document.querySelector('form[data-codes]');if(!form)return;
  var C=document.body.dataset.campaign,DEMO=document.body.dataset.demo!==undefined||!CODES_API;
  var ds=form.dataset,KEY='boxad-codice-'+C;
  var qs=new URLSearchParams(location.search);
  var source=qs.get('da')==='amico'?'amico':(qs.get('p')||'').replace(/[^a-z0-9-]/gi,'').slice(0,20);
  if(source)tick(function(){count(C+'-fonte-'+source,'Fonte: '+source,true)});
  var out=document.getElementById('codice'),err=document.getElementById('codice-errore'),btn=form.querySelector('button[type=submit]');

  function show(d,again){
    form.hidden=true;out.hidden=false;
    out.querySelector('[data-code]').textContent=d.code;
    out.querySelector('[data-gift]').textContent=d.gift;
    out.querySelector('[data-expires]').textContent=fmtDate(d.expires);
    out.querySelector('[data-again]').hidden=!again;
    var msg='Ciao! Ho il codice '+d.code+' dalla scatola della pizza. Vorrei: '+d.gift+'. Quando: '+d.when.toLowerCase()+'.';
    var wa=out.querySelector('[data-track=whatsapp]');
    if(wa)wa.href='https://wa.me/'+(ds.wa||'')+'?text='+encodeURIComponent(msg);
    var reset=out.querySelector('[data-reset]');if(reset)reset.hidden=!DEMO;
  }
  var saved=store(KEY);
  if(saved&&saved.expires&&new Date(saved.expires+'T23:59:59')>new Date())show(saved,true);

  form.addEventListener('submit',function(e){
    e.preventDefault();err.hidden=true;
    var g=form.querySelector('input[name=regalo]:checked'),w=form.querySelector('input[name=quando]:checked');
    if(!g||!w)return;
    var d={gift:g.value,when:w.value};
    function ok(code,expires){d.code=code;d.expires=expires;store(KEY,d);show(d,false);tick(function(){count(C+'-codice','Codice richiesto',true)});out.focus()}
    if(DEMO){
      var r='';for(var i=0;i<4;i++)r+='ACEFHJKMNPRTUVWXY3479'.charAt(Math.floor(Math.random()*21));
      ok((ds.prefix||'DEMO')+'-'+r,ds.expires||'');return;
    }
    btn.disabled=true;
    codesCall({a:'claim',c:C,g:d.gift,w:d.when,s:source})
      .then(function(j){
        if(j.ok)return ok(j.code,j.expires);
        err.textContent=j.err==='scaduta'||j.err==='campagna'?'Questa offerta è terminata. Puoi comunque scrivere o chiamare il negozio qui sotto.':
          j.err==='troppi'?'Tante richieste in questo momento: riprova tra un minuto.':'Non siamo riusciti a creare il codice. Riprova o scrivi al negozio qui sotto.';
        err.hidden=false;
      })
      .catch(function(){err.textContent='Connessione assente. Riprova tra poco o scrivi al negozio qui sotto.';err.hidden=false})
      .then(function(){btn.disabled=false});
  });

  var copy=out.querySelector('[data-copy]');
  if(copy)copy.addEventListener('click',function(){
    var code=out.querySelector('[data-code]').textContent;
    (navigator.clipboard?navigator.clipboard.writeText(code):Promise.reject()).then(function(){copy.textContent='Codice copiato'},function(){copy.textContent='Tieni premuto il codice per copiarlo'});
  });
  var friend=out.querySelector('[data-friend]');
  if(friend)friend.addEventListener('click',function(){
    var url=location.origin+location.pathname+'?da=amico';
    tick(function(){count(C+'-amico','Invita un amico',true)});
    if(navigator.share){navigator.share({title:document.title,text:ds.friendText||'Un regalo per te:',url:url}).catch(function(){});return}
    if(navigator.clipboard)navigator.clipboard.writeText(url).then(function(){friend.textContent='Link copiato: incollalo in chat'});
  });
  var reset=out.querySelector('[data-reset]');
  if(reset)reset.addEventListener('click',function(){store(KEY,null);out.hidden=true;form.hidden=false;form.reset()});
})();

/* ---------- shop page ---------- */
(function(){
  var app=document.querySelector('[data-shop]');if(!app)return;
  var qs=new URLSearchParams(location.search);
  var login=document.getElementById('accesso'),panel=document.getElementById('negozio'),checkF=document.getElementById('verifica');
  var res=document.getElementById('esito');
  var S={c:(qs.get('c')||'').toLowerCase().replace(/[^a-z0-9-]/g,''),pin:''};
  var demo=function(){return !CODES_API||S.c==='esempio'};
  if(S.c)login.querySelector('[name=c]').value=S.c;

  /* demo: codes made on boxad.it/r/esempio in this browser, plus any GOM-xxxx, kept only in this tab */
  var D={codes:{}};
  function demoCode(code){
    var mine=store('boxad-codice-esempio');
    if(!D.codes[code]&&/^GOM-[A-Z0-9]{4}$/.test(code))D.codes[code]={code:code,gift:mine&&mine.code===code?mine.gift:'Controllo gomme e freni gratis',when:mine&&mine.code===code?mine.when:'Questa settimana',source:'diretto',claimed:'',used:'',spend:'',status:'valido',threshold:200};
    return D.codes[code];
  }
  function api(p){
    if(!demo()){p.c=S.c;p.pin=S.pin;return codesCall(p)}
    var r,code=String(p.code||'').toUpperCase().replace(/\s/g,'');
    if(p.a==='login')return Promise.resolve({ok:true});
    r=demoCode(code);if(!r)return Promise.resolve({ok:true,status:'inesistente'});
    var today=new Date().toISOString().slice(0,10),just=false;
    if(p.a==='use'&&r.status==='valido'){r.status='usato';r.used=today;r.spend=p.spend||'';just=true}
    else if(p.a==='spend'&&r.used){r.spend=p.spend||''}
    return Promise.resolve(Object.assign({ok:true,justUsed:just},r));
  }
  function fail(j){
    res.hidden=false;
    res.innerHTML='';var p=document.createElement('p');p.className='shop-bad';
    p.textContent=j&&j.err==='pin'?'PIN sbagliato.':j&&j.err==='bloccato'?'Troppi tentativi: riprova tra 15 minuti.':j&&j.err==='campagna'?'Campagna non trovata.':'Connessione assente o errore. Riprova.';
    res.appendChild(p);
  }

  login.addEventListener('submit',function(e){
    e.preventDefault();
    S.c=login.querySelector('[name=c]').value.toLowerCase().replace(/[^a-z0-9-]/g,'');
    S.pin=login.querySelector('[name=pin]').value.trim();
    api({a:'login'}).then(function(j){
      if(!j.ok)return fail(j);
      if(login.querySelector('[name=ricorda]').checked)store('boxad-pin-'+S.c,S.pin);
      login.hidden=true;panel.hidden=false;res.hidden=true;
      panel.querySelector('[data-campaign-name]').textContent=S.c+(demo()?' (demo)':'');
      checkF.querySelector('input').focus();
    },fail);
  });
  if(S.c){var pin=store('boxad-pin-'+S.c);if(pin||demo()){login.querySelector('[name=pin]').value=pin||'0000';login.requestSubmit()}}
  document.getElementById('esci').addEventListener('click',function(){store('boxad-pin-'+S.c,null);location.href='v/'});

  function render(j){
    res.hidden=false;res.innerHTML='';
    var t=document.getElementById('tpl-esito').content.cloneNode(true);
    var head=t.querySelector('[data-head]'),info=t.querySelector('[data-info]'),act=t.querySelector('[data-act]');
    t.querySelector('[data-code]').textContent=j.code||checkF.querySelector('input').value.toUpperCase();
    if(j.status==='inesistente'){head.textContent='Codice non trovato. Controlla le lettere.';head.className='shop-bad';act.remove();info.remove()}
    else{
      head.textContent=j.status==='valido'?'Valido · mai usato':j.status==='usato'?(j.justUsed?'Fatto: segnato come usato':'Già usato il '+fmtDate(j.used)):'Scaduto il '+fmtDate(j.expires);
      head.className=j.status==='valido'||j.justUsed?'shop-ok':'shop-bad';
      info.textContent=j.gift+' · '+j.when+(j.claimed?' · richiesto il '+fmtDate(j.claimed):'')+(j.source&&j.source!=='diretto'?' · da '+j.source:'');
      var th=j.threshold?' €'+j.threshold:'';
      t.querySelector('[data-low]').textContent='Sotto'+th;t.querySelector('[data-high]').textContent='Sopra'+th;
      if(j.spend){var r=t.querySelector('input[value='+j.spend+']');if(r)r.checked=true}
      var go=t.querySelector('[data-go]');
      if(j.status==='scaduto'){act.remove()}
      else if(j.status==='usato'){go.textContent='Aggiorna acquisto';go.dataset.action='spend'}
      else{go.dataset.action='use'}
    }
    res.appendChild(t);
    var f=res.querySelector('form');
    if(f)f.addEventListener('submit',function(e){
      e.preventDefault();var sp=f.querySelector('input[name=spesa]:checked');
      api({a:f.querySelector('[data-go]').dataset.action,code:j.code,spend:sp?sp.value:''}).then(function(k){if(!k.ok)return fail(k);render(k)},fail);
    });
  }
  checkF.addEventListener('submit',function(e){
    e.preventDefault();
    api({a:'check',code:checkF.querySelector('input').value}).then(function(j){j.ok?render(j):fail(j)},fail);
  });
})();
