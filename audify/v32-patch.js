(()=>{
  'use strict';
  const MIN_MS=1700;
  const MAX_MS=7000;
  let startedAt=0,closing=false;

  function buildIntro(){
    if(document.querySelector('#v32Intro'))return document.querySelector('#v32Intro');
    const el=document.createElement('div');
    el.id='v32Intro';
    el.className='v32-intro';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.innerHTML='<div class="v32-wrap"><div class="v32-core"><div class="v32-orb"></div><div class="v32-logo">A</div></div><div class="v32-name">AUDIFY</div><div class="v32-sub">Chargement de ton univers musical</div></div>';
    document.body.appendChild(el);
    return el;
  }

  function appReady(){
    const shell=!!(document.querySelector('#resultsView')&&document.querySelector('#playerView')&&document.querySelector('#q')&&document.querySelector('#go'));
    const stateReady=(()=>{try{return typeof S!=='undefined'&&!!S}catch{return false}})();
    return shell&&stateReady&&document.readyState!=='loading';
  }

  function hideIntro(){
    if(closing)return;
    closing=true;
    const el=document.querySelector('#v32Intro');
    if(!el)return;
    document.body.style.overflow='';
    el.classList.add('v32-hide');
    setTimeout(()=>el.remove(),650);
  }

  function waitUntilReady(){
    const elapsed=Date.now()-startedAt;
    if(elapsed>=MIN_MS&&(appReady()||elapsed>=MAX_MS)){
      hideIntro();
      return;
    }
    setTimeout(waitUntilReady,90);
  }

  function showIntro(){
    startedAt=Date.now();
    buildIntro();
    document.body.style.overflow='hidden';
    waitUntilReady();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showIntro,{once:true});else showIntro();
})();
