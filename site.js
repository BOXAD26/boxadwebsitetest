/* BOXAD. site scripts */
/* FORMS: paste the URL of your form service here (Formspree, Web3Forms, ...).
   Leave it empty to keep the current behaviour: the form opens the visitor's email app. */
var FORM_ENDPOINT='';
/* Extra fields some services need, e.g. {access_key:'YOUR_KEY'} */
var FORM_EXTRA={};
var EN=document.documentElement.lang==='en';
document.querySelectorAll('form[data-subject]').forEach(function(f){
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var thanks=f.querySelector('.thanks'),btn=f.querySelector('button[type=submit]');
    function done(msg){if(thanks){if(msg)thanks.textContent=msg;thanks.hidden=false}}
    if(FORM_ENDPOINT){
      var fd=new FormData(f);fd.append('_subject',f.dataset.subject);
      Object.keys(FORM_EXTRA).forEach(function(k){fd.append(k,FORM_EXTRA[k])});
      if(btn)btn.disabled=true;
      fetch(FORM_ENDPOINT,{method:'POST',body:fd,headers:{Accept:'application/json'}})
        .then(function(r){if(!r.ok)throw new Error(r.status);f.reset();done(EN?'Thank you! We have received your request and will reply within a day.':'Grazie! Abbiamo ricevuto la tua richiesta e ti rispondiamo entro un giorno.')})
        .catch(function(){done(EN?'We could not send the form. Please write to info@boxad.it.':'Non siamo riusciti a inviare il modulo. Scrivici a info@boxad.it.')})
        .then(function(){if(btn)btn.disabled=false});
      return;
    }
    var o={};new FormData(f).forEach(function(v,k){if(v){o[k]=o[k]?o[k]+', '+v:v}});
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
