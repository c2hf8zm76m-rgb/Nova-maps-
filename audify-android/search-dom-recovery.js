(()=>{
  'use strict';
  let lastInput=null;

  function findSearchInput(){
    return document.querySelector('#q')
      || document.querySelector('.search input:not([type="range"])')
      || document.querySelector('.search-wrap input:not([type="range"])')
      || document.querySelector('input[inputmode="search"]')
      || [...document.querySelectorAll('input')].find(el=>el.type!=='range' && /recherch|artiste|titre/i.test(el.placeholder||''))
      || null;
  }

  function runSearch(){
    try{
      if(typeof window.search==='function'){ window.search(); return; }
    }catch{}
    try{
      const b=document.querySelector('#go');
      if(b && typeof b.onclick==='function') b.onclick();
    }catch{}
  }

  function repair(){
    const input=findSearchInput();
    if(!input)return false;

    // L'identité #q est le contrat utilisé par le moteur V21 et les patchs Audify.
    if(input.id!=='q'){
      const stale=document.querySelector('#q');
      if(stale && stale!==input) stale.removeAttribute('id');
      input.id='q';
    }
    input.disabled=false;
    input.readOnly=false;
    input.tabIndex=0;
    input.setAttribute('inputmode','search');
    input.style.pointerEvents='auto';
    input.style.touchAction='manipulation';
    input.style.userSelect='text';
    input.style.webkitUserSelect='text';

    if(input!==lastInput || input.dataset.audifyAndroidSearchBound!=='1'){
      lastInput=input;
      input.dataset.audifyAndroidSearchBound='1';
      input.addEventListener('keydown',e=>{
        if(e.key==='Enter'){
          e.preventDefault();
          runSearch();
        }
      });
    }

    const go=document.querySelector('#go') || document.querySelector('.search button');
    if(go){
      if(go.id!=='go')go.id='go';
      if(go.dataset.audifyAndroidSearchBound!=='1'){
        go.dataset.audifyAndroidSearchBound='1';
        // On ne remplace pas un onclick V21 existant ; on assure seulement un fallback.
        go.addEventListener('click',()=>{
          setTimeout(()=>{
            try{
              const r=document.querySelector('#results');
              if(input.value.trim() && r && /Recherche une musique pour commencer\.?/i.test(r.textContent||'')) runSearch();
            }catch{}
          },0);
        });
      }
    }
    return true;
  }

  window.AudifyEnsureSearchInput=repair;

  const boot=()=>{
    repair();
    const mo=new MutationObserver(()=>repair());
    mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['id','disabled','readonly']});
    setInterval(repair,300);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
