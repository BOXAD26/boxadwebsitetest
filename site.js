/* BOXAD. site scripts */
/* FORMS. Paste the address of your form service between the quotes below, e.g. Formspree:
   var FORM_ENDPOINT='https://formspree.io/f/xxxxxxxx';
   While it is empty the forms open the visitor's email app instead (no lead is lost, but it is less reliable).
   Web3Forms also works: use 'https://api.web3forms.com/submit' and put your key in FORM_EXTRA, e.g. {access_key:'YOUR_KEY'}. */
var FORM_ENDPOINT='https://formspree.io/f/mzedyjlg';
var FORM_EXTRA={};
var EN=document.documentElement.lang==='en';
var MSG={
  ok:EN?'Thank you! We have received your request and will reply within a day.':'Grazie! Abbiamo ricevuto la tua richiesta e ti rispondiamo entro un giorno.',
  ko:EN?'We could not send the form. Please write to info@boxad.it.':'Non siamo riusciti a inviare il modulo. Scrivici a info@boxad.it.'
};
document.querySelectorAll('form[data-subject]').forEach(function(f){
  /* spam trap: a field people never see; bots fill it in */
  var trap=document.createElement('input');
  trap.type='text';trap.name='_gotcha';trap.tabIndex=-1;trap.autocomplete='off';trap.setAttribute('aria-hidden','true');
  trap.style.cssText='position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
  f.appendChild(trap);
  /* the "your email app opens" note only applies without a form service */
  if(FORM_ENDPOINT){f.querySelectorAll('.note').forEach(function(n){if(/app di posta|email app/i.test(n.textContent))n.hidden=true})}
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var thanks=f.querySelector('.thanks'),btn=f.querySelector('button[type=submit]');
    function done(msg,bad){if(thanks){if(msg)thanks.textContent=msg;thanks.hidden=false;thanks.setAttribute('role','status');thanks.dataset.state=bad?'error':'ok'}}
    if(trap.value){done(MSG.ok);return}
    if(FORM_ENDPOINT){
      var fd=new FormData(f);fd.delete('_gotcha');
      fd.append('_subject',f.dataset.subject);fd.append('subject',f.dataset.subject);
      var em=f.querySelector('input[type=email]');if(em&&em.value)fd.append('_replyto',em.value);
      Object.keys(FORM_EXTRA).forEach(function(k){fd.append(k,FORM_EXTRA[k])});
      if(btn)btn.disabled=true;
      fetch(FORM_ENDPOINT,{method:'POST',body:fd,headers:{Accept:'application/json'}})
        .then(function(r){return r.json().catch(function(){return {}}).then(function(d){if(!r.ok||d.success===false||d.error||d.errors)throw new Error(r.status)})})
        .then(function(){f.reset();done(MSG.ok)})
        .catch(function(){done(MSG.ko,true)})
        .then(function(){if(btn)btn.disabled=false});
      return;
    }
    var o={};new FormData(f).forEach(function(v,k){if(v&&k!=='_gotcha'){o[k]=o[k]?o[k]+', '+v:v}});
    var b=Object.keys(o).map(function(k){return k+': '+o[k]}).join('\n');
    location.href='mailto:info@boxad.it?subject='+encodeURIComponent(f.dataset.subject)+'&body='+encodeURIComponent(b);
    done();
  });
});
var PREF='input[name="Contatto preferito"],input[name="Preferred contact"]';
document.querySelectorAll(PREF).forEach(function(r){
  r.addEventListener('change',function(){
    var w=document.querySelector(PREF.split(',').map(function(s){return s+':checked'}).join(',')).value==='WhatsApp',c=document.querySelector('input[name="Cellulare"],input[name="Mobile"]');
    if(!c)return;c.required=w;var q=c.closest('label').querySelector('.req');if(q)q.hidden=!w;
  });
});
var tp=document.querySelector('.tpause');
if(tp){tp.addEventListener('click',function(){var t=tp.closest('.ticker'),p=t.classList.toggle('paused');tp.setAttribute('aria-pressed',p);tp.textContent=p?(EN?'Resume':'Riprendi'):(EN?'Pause':'Pausa')})}
document.querySelectorAll('[data-open]').forEach(function(b){b.addEventListener('click',function(){var d=document.getElementById(b.dataset.open);if(d)d.showModal()})});
document.querySelectorAll('dialog').forEach(function(d){d.addEventListener('click',function(e){if(e.target===d)d.close()});var x=d.querySelector('.x');if(x)x.addEventListener('click',function(){d.close()})});

(function(){
var root=document.querySelector('[data-fc]');if(!root)return;
var EN=document.documentElement.lang.indexOf('en')===0,loc=EN?'en-GB':'it-IT';
var S=EN?{lP:'The pilot is the smallest way to try it: 2,000 boxes, measured, with a goal written down before we start. Enter what a new customer is worth to you.',lC:'Pick the number of boxes and enter what a new customer is worth to you. We show the total and how many customers you need to break even.',ktP:'Pilot total',ktC:'Campaign total',ntP:'One flat price, everything included. €1.00 per box, same as any campaign.',ntC:'One flat price, everything included.',cu:['customer','customers'],nb:function(p,c){return 'That is <b>1 customer per '+p+' boxes</b>, about <b>'+c+'%</b> of dinners. Anything beyond that is your margin.'},fp:function(b,v){return 'Format: pilot, '+b+' boxes (€'+b+'). Value of a new customer: €'+v+'.'},fc:function(b,v){return 'Format: campaign, '+b+' boxes (€'+b+'). Value of a new customer: €'+v+'.'}}
 :{lP:'Il pilota è il modo più piccolo per provare: 2.000 scatole, misurate, con un obiettivo scritto prima di partire. Inserisci quanto vale per te un cliente nuovo.',lC:'Scegli le scatole e inserisci quanto vale per te un cliente nuovo. Ti diciamo il totale e quanti clienti servono per rientrare.',ktP:'Totale pilota',ktC:'Totale campagna',ntP:'Un prezzo unico, tutto compreso. €1,00 a scatola, come in ogni campagna.',ntC:'Un prezzo unico, tutto compreso.',cu:['cliente','clienti'],nb:function(p,c){return 'Cioè <b>1 cliente ogni '+p+' scatole</b>, circa lo <b>'+c+'%</b> delle cene. Tutto quello che arriva oltre è margine tuo.'},fp:function(b,v){return 'Formato: pilota, '+b+' scatole (€'+b+'). Valore di un cliente nuovo: €'+v+'.'},fc:function(b,v){return 'Formato: campagna, '+b+' scatole (€'+b+'). Valore di un cliente nuovo: €'+v+'.'}};
var $=function(s){return root.querySelector(s)};
var boxes=$('#fc-boxes'),val=$('#fc-value'),mode='pilot',PILOT=2000;
var nf=function(n){return new Intl.NumberFormat(loc).format(n)};
var pf=function(p){return new Intl.NumberFormat(loc,{minimumFractionDigits:p<1?1:0,maximumFractionDigits:p<1?2:1}).format(p)};
function state(){var isP=mode==='pilot',b=isP?PILOT:(+boxes.value||3000),v=Math.max(1,+val.value||1);return{isP:isP,b:b,v:v}}
function render(){
 var s=state(),need=Math.ceil(s.b/s.v),per=Math.round(s.b/need);
 $('[data-fc-boxes]').textContent=nf(s.b);
 $('[data-fc-total]').textContent='€'+nf(s.b);
 $('[data-fc-dinners]').textContent=nf(s.b);
 $('[data-fc-be]').textContent=nf(need)+' '+S.cu[need===1?0:1];
 $('[data-fc-nb]').innerHTML=S.nb(nf(per),pf(need/s.b*100));
 $('[data-fc-people]').textContent=nf(Math.round(s.b*1.5/100)*100)+' – '+nf(Math.round(s.b*2.5/100)*100);
}
function setMode(){
 var isP=mode==='pilot';
 $('[data-fc-lead]').textContent=isP?S.lP:S.lC;
 $('[data-fc-kt]').textContent=isP?S.ktP:S.ktC;
 $('[data-fc-nt]').textContent=isP?S.ntP:S.ntC;
 $('[data-fc-slider]').hidden=isP;$('[data-fc-fixed]').hidden=!isP;$('[data-fc-pilot]').hidden=!isP;
 root.querySelectorAll('.fc-mode button').forEach(function(x){x.setAttribute('aria-pressed',x.dataset.m===mode?'true':'false')});
 render();
}
boxes.addEventListener('input',render);val.addEventListener('input',render);
root.querySelectorAll('.fc-chips button').forEach(function(c){c.addEventListener('click',function(){val.value=c.dataset.v;render()})});
root.querySelectorAll('.fc-mode button').forEach(function(x){x.addEventListener('click',function(){mode=x.dataset.m;setMode()})});
var go=$('[data-fc-go]');
if(go)go.addEventListener('click',function(){
 var ta=document.querySelector('#proposta textarea[name="Messaggio"],#proposta textarea[name="Message"]');if(!ta)return;
 if(ta.value&&ta.dataset.auto!=='1')return;
 var s=state();ta.value=(s.isP?S.fp:S.fc)(nf(s.b),nf(s.v));ta.dataset.auto='1';
});
setMode();
})();
