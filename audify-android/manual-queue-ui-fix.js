(()=>{
  'use strict';

  const getS=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};

  function manualIndexes(){
    const s=getS();
    if(!s||!Array.isArray(s.items))return new Set();
    const out=new Set();
    s.items.forEach((t,i)=>{if(t&&t.__v56Queued===true)out.add(i)});
    return out;
  }

  function filterVerticalQueue(){
    const rail=document.querySelector('#v64QueueRail');
    if(!rail)return;

    const allowed=manualIndexes();
    const buttons=Array.from(rail.querySelectorAll('.v64-qitem'));
    let visible=0;

    buttons.forEach(btn=>{
      const i=Number(btn.dataset.index);
      const show=Number.isInteger(i)&&allowed.has(i);
      btn.hidden=!show;
      btn.style.display=show?'block':'none';
      if(show)visible++;
    });

    if(visible===0){
      rail.hidden=true;
      rail.style.display='none';
      rail.setAttribute('aria-hidden','true');
      rail.dataset.manualCount='0';
      return;
    }

    rail.hidden=false;
    rail.style.display='block';
    rail.removeAttribute('aria-hidden');
    rail.dataset.manualCount=String(visible);

    // La file se compacte selon le nombre réel de morceaux ajoutés.
    const h=Math.min(520,Math.max(82,visible*72+20));
    rail.style.height=h+'px';

    const current=buttons.find(b=>!b.hidden&&b.classList.contains('active'));
    if(current&&rail.dataset.lastManualActive!==current.dataset.index){
      rail.dataset.lastManualActive=current.dataset.index||'';
      requestAnimationFrame(()=>current.scrollIntoView({block:'center',behavior:'smooth'}));
    }
  }

  function boot(){
    // L'ancienne fenêtre de file (V55) mélangeait les résultats de recherche.
    // Sur Android natif, la file verticale V64.2 devient la représentation officielle.
    const hideLegacy=()=>{
      const b=document.querySelector('#v55QueueBtn');
      if(b)b.style.display='none';
      const o=document.querySelector('#v55QueueOverlay');
      if(o)o.classList.remove('show');
    };

    filterVerticalQueue();
    hideLegacy();

    const observer=new MutationObserver(()=>{
      filterVerticalQueue();
      hideLegacy();
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-index']});

    setInterval(()=>{
      filterVerticalQueue();
      hideLegacy();
    },180);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
