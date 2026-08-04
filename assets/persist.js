/* BlackBox widgets — salvataggio automatico valori (localStorage per widget) */
(function(){
  var page=(location.pathname.split('/').pop()||'w').replace('.html','');
  function K(s){return 'bb:'+page+':'+s;}
  var wired=new WeakSet(), btnWired=new WeakSet(), restored={}, idx=0;

  function wireInput(el){
    if(wired.has(el))return;
    var t=(el.getAttribute('type')||'').toLowerCase();
    if(el.tagName==='INPUT'&&(t==='button'||t==='submit'||t==='file'))return;
    wired.add(el);
    var key=el.id||el.name||el.getAttribute('data-k'); if(!key)key='f'+(idx++);
    var k=K('in:'+key);
    var saved=localStorage.getItem(k);
    if(saved!==null && el.value!==saved){
      el.value=saved;
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    }
    var ev=(el.tagName==='SELECT')?'change':'input';
    el.addEventListener(ev,function(){localStorage.setItem(k,el.value);});
  }
  function scanInputs(){ document.querySelectorAll('input,select,textarea').forEach(wireInput); }

  function wireToggles(){
    var groups=[].slice.call(document.querySelectorAll('.toggle,.modes'));
    groups.forEach(function(grp,gi){
      var k=K('tg:'+gi);
      var btns=[].slice.call(grp.querySelectorAll('button'));
      btns.forEach(function(b,bi){
        if(!btnWired.has(b)){ btnWired.add(b); b.addEventListener('click',function(){localStorage.setItem(k,bi);}); }
      });
      if(!restored[k]){
        var s=localStorage.getItem(k);
        if(s!==null && btns[+s]){ restored[k]=true; setTimeout(function(){btns[+s].click();},0); }
      }
    });
  }
  function run(){ scanInputs(); wireToggles(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  // input creati dinamicamente (es. preventivo) o ricostruiti (es. meteo)
  try{ new MutationObserver(function(){ scanInputs(); wireToggles(); }).observe(document.documentElement,{childList:true,subtree:true}); }catch(e){}
})();
