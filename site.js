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
document.querySelectorAll('[data-open]').forEach(function(b){b.addEventListener('click',function(){var d=document.getElementById(b.dataset.open);if(d)d.showModal()})});
document.querySelectorAll('dialog').forEach(function(d){d.addEventListener('click',function(e){if(e.target===d)d.close()});var x=d.querySelector('.x');if(x)x.addEventListener('click',function(){d.close()})});
