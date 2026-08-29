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
      wrap.style.zIndex='220';
    }

    if(q.dataset.androidFocusFix==='2')return true;
    q.dataset.androidFocusFix='2';

    const focusInput=()=>{
      try{q.focus({preventScroll:true})}catch{try{q.focus()}catch{}}
      try{
        if(window.AudifyNative&&typeof window.AudifyNative.focusSearch==='function'){
          window.AudifyNative.focusSearch();
        }
      }catch{}
    };

    // On déclenche le focus au relâchement du doigt : Android peut alors
    // ouvrir explicitement son IME après que WebView a identifié le champ.
    q.addEventListener('pointerup',focusInput,true);
    q.addEventListener('click',focusInput,true);
    q.addEventListener('touchend',focusInput,{capture:true,passive:true});

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
      if(++tries>80)clearInterval(timer);
    },250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
