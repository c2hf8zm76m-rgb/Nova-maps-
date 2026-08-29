(()=>{
  'use strict';

  function bind(){
    const q=document.querySelector('#q');
    const search=document.querySelector('.search');
    if(!q||!search)return false;

    q.disabled=false;
    q.readOnly=false;
    q.tabIndex=0;
    q.setAttribute('inputmode','search');
    q.setAttribute('enterkeyhint','search');
    q.style.pointerEvents='auto';
    q.style.touchAction='manipulation';
    q.style.userSelect='text';
    q.style.webkitUserSelect='text';

    search.style.pointerEvents='auto';
    search.style.touchAction='manipulation';
    const wrap=search.closest('.search-wrap');
    if(wrap){
      wrap.style.pointerEvents='auto';
      wrap.style.zIndex='100';
    }

    if(q.dataset.androidFocusFix==='1')return true;
    q.dataset.androidFocusFix='1';

    const focusInput=()=>{
      try{
        q.focus({preventScroll:true});
      }catch{
        try{q.focus()}catch{}
      }
    };

    q.addEventListener('pointerdown',focusInput,true);
    q.addEventListener('touchstart',focusInput,{capture:true,passive:true});
    q.addEventListener('click',focusInput,true);

    search.addEventListener('pointerup',e=>{
      if(e.target.closest('button'))return;
      focusInput();
    },true);
    search.addEventListener('click',e=>{
      if(e.target.closest('button'))return;
      focusInput();
    },true);

    return true;
  }

  function boot(){
    bind();
    let tries=0;
    const timer=setInterval(()=>{
      bind();
      if(++tries>40)clearInterval(timer);
    },250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
