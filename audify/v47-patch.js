(()=>{
  'use strict';
  function bind(){
    const b=document.querySelector('#v45MiniLoop');
    if(!b||b.dataset.v47Bound==='1')return false;
    b.dataset.v47Bound='1';
    b.addEventListener('click',()=>{
      setTimeout(()=>{
        const on=b.classList.contains('active') || b.getAttribute('aria-pressed')==='true';
        b.classList.remove('v47-loop-on','v47-loop-off');
        void b.offsetWidth;
        b.classList.add(on?'v47-loop-on':'v47-loop-off');
        setTimeout(()=>b.classList.remove('v47-loop-on','v47-loop-off'),780);
      },0);
    },true);
    return true;
  }
  function boot(){
    let tries=0;
    const t=setInterval(()=>{if(bind()||++tries>80)clearInterval(t)},120);
    setTimeout(bind,500);
    setTimeout(bind,1400);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
