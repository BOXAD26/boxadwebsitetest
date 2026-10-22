/* BOXAD. QR pages: counts the visit and each button tap, without cookies.
   COUNTER: the address of your GoatCounter site (free, no cookies). Create the account
   at goatcounter.com with the code "boxad"; if that code is taken, change it here.
   While it is empty nothing is counted (handy for previews). */
var COUNTER='https://boxad.goatcounter.com/count';
var CAMPAIGN=document.body.dataset.campaign||'senza-nome';
function count(path,title,isEvent){
  if(!COUNTER)return;
  var q='p='+encodeURIComponent(path)+'&t='+encodeURIComponent(title||path)+'&e='+(isEvent?'true':'false')+
    '&r='+encodeURIComponent(isEvent?'':document.referrer)+'&s='+encodeURIComponent(screen.width+','+screen.height+','+(window.devicePixelRatio||1))+
    '&rnd='+Math.random().toString(36).slice(2);
  var url=COUNTER+'?'+q;
  if(navigator.sendBeacon&&navigator.sendBeacon(url))return;
  new Image().src=url;
}
/* one visit = one scan (the page is only reachable from the QR or the short link under it) */
count(location.pathname,document.title,false);
/* each button: data-track="whatsapp|chiama|modulo|..." is counted as "<campaign>-<button>" */
document.querySelectorAll('[data-track]').forEach(function(a){
  a.addEventListener('click',function(e){
    count(CAMPAIGN+'-'+a.dataset.track,a.textContent.trim(),true);
    /* example page: buttons do not open a real number */
    if(document.body.dataset.demo!==undefined&&a.dataset.demoNote){
      e.preventDefault();
      var n=document.getElementById('demo-note');
      if(n){n.textContent=a.dataset.demoNote;n.hidden=false}
    }
  });
});
/* a sent form counts as a lead */
document.querySelectorAll('form[data-subject]').forEach(function(f){
  f.addEventListener('submit',function(){count(CAMPAIGN+'-richiesta-inviata','Richiesta inviata',true)});
});
