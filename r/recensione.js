/* BOXAD. review page (recensione/ and en/review/): clients and pizzerias rate the service and the results.
   Send the link after the results report: boxad.it/recensione/?camp=<campagna> (pizzerias: add &tipo=pizzeria).
   Reviews land in the "Recensioni" tab of the BOXAD codici Sheet (backend/codici.gs). Nothing is published by itself.
   GOOGLE_REVIEW_URL: once the Google Business profile exists, paste its "ask for reviews" link here.
   The thank-you shows it to EVERYONE, whatever the stars: asking only happy clients breaks Google's rules.
   Add ?demo=1 to try the page without saving anything. */
var REVIEWS_API='https://script.google.com/macros/s/AKfycbxfYjgZ6q8JHcadI1ZmcL9FNcVA68YD4_n4PQDDj7h67CToUMMGtcmvxPlKCRzZ5MSB8Q/exec';
var GOOGLE_REVIEW_URL='';

(function(){
  var f=document.querySelector('form[data-review]');if(!f)return;
  var EN=document.documentElement.lang==='en',qs=new URLSearchParams(location.search);
  var DEMO=qs.has('demo')||!REVIEWS_API,PIZ=qs.get('tipo')==='pizzeria';
  document.body.classList.toggle('is-pizzeria',PIZ);
  document.querySelectorAll('[data-for]').forEach(function(el){el.hidden=el.dataset.for!==(PIZ?'pizzeria':'cliente')});
  var demo=document.getElementById('demo-tag');if(demo)demo.hidden=!DEMO;
  var err=f.querySelector('[data-error]'),btn=f.querySelector('button[type=submit]'),done=document.getElementById('grazie');
  var T=EN?{
    stars:'Please give both star ratings.',fields:'Please fill in your name, business and a couple of lines about how it went.',pub:'Please tell us whether we may publish your review.',busy:'Many reviews right now: please try again in a minute.',
    ko:'We could not send your review. Please try again or write to info@boxad.it.',off:'No connection. Please try again shortly.'
  }:{
    stars:'Dai un voto con le stelle a entrambe le domande.',fields:'Scrivi nome, attività e due righe su com\'è andata.',pub:'Dicci se possiamo pubblicare la recensione.',busy:'Tante recensioni in questo momento: riprova tra un minuto.',
    ko:'Non siamo riusciti a inviare la recensione. Riprova o scrivi a info@boxad.it.',off:'Connessione assente. Riprova tra poco.'
  };
  function fail(m){err.textContent=m;err.hidden=false;err.scrollIntoView({block:'center'})}
  function thanks(){
    f.hidden=true;done.hidden=false;document.querySelectorAll('.qr-hero .lead').forEach(function(l){l.hidden=true});
    var g=done.querySelector('[data-google]');
    if(g&&GOOGLE_REVIEW_URL){g.href=GOOGLE_REVIEW_URL;g.closest('[data-google-box]').hidden=false}
    done.focus();window.scrollTo(0,0);
  }
  f.addEventListener('submit',function(e){
    e.preventDefault();err.hidden=true;
    var v=function(n){var x=f.querySelector('[name="'+n+'"]:checked')||f.querySelector('[name="'+n+'"]:not([type=radio])');return x?x.value.trim():''};
    if(!v('nome')||!v('att')||!v('txt'))return fail(T.fields);
    if(!v('s1')||!v('s2'))return fail(T.stars);
    if(!v('pub'))return fail(T.pub); /* consent is never pre-ticked */
    var p={a:'review',tipo:PIZ?'pizzeria':'cliente',l:EN?'en':'it',camp:(qs.get('camp')||'').replace(/[^a-z0-9-]/gi,'').slice(0,40),
      nome:v('nome'),att:v('att'),s1:v('s1'),s2:v('s2'),ri:v('ri'),txt:v('txt'),meglio:v('meglio'),pub:v('pub'),hp:v('sito')};
    if(DEMO)return thanks();
    btn.disabled=true;
    var q=Object.keys(p).map(function(k){return k+'='+encodeURIComponent(p[k])}).join('&');
    fetch(REVIEWS_API+'?'+q).then(function(r){return r.json()})
      .then(function(j){if(j.ok)return thanks();fail(j.err==='troppi'?T.busy:T.ko)})
      .catch(function(){fail(T.off)})
      .then(function(){btn.disabled=false});
  });
})();
