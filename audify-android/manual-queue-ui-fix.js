(()=>{
  'use strict';

  const getS=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  let touching=null;

  function manualIndexes(){
    const s=getS();
    if(!s||!Array.isArray(s.items))return new Set();
    const out=new Set();
    s.items.forEach((t,i)=>{if(t&&t.__v56Queued===true)out.add(i)});
    return out;
  }

  function ensureStyle(){
    if(document.querySelector('#v646QueueStyle'))return;
    const style=document.createElement('style');
    style.id='v646QueueStyle';
    style.textContent=`
#playerView .player{overflow:visible!important}
#v64QueueRail{
  position:absolute!important;
  z-index:12!important;
  left:50%!important;
  right:auto!important;
  top:auto!important;
  bottom:calc(100% + 8px)!important;
  transform:translateX(-50%)!important;
  width:min(700px,calc(100vw - 34px))!important;
  height:48px!important;
  display:flex!important;
  align-items:center!important;
  gap:5px!important;
  padding:5px 8px!important;
  margin:0!important;
  border-radius:16px!important;
  overflow-x:auto!important;
  overflow-y:visible!important;
  scroll-snap-type:x proximity!important;
  scroll-behavior:smooth;
  overscroll-behavior-x:contain!important;
  scrollbar-width:none!important;
  touch-action:pan-x!important;
  background:linear-gradient(135deg,rgba(255,255,255,.075),rgba(255,255,255,.025))!important;
  border:1px solid rgba(255,255,255,.10)!important;
  box-shadow:0 10px 30px rgba(0,0,0,.22)!important;
  backdrop-filter:blur(18px) saturate(145%)!important;
  -webkit-backdrop-filter:blur(18px) saturate(145%)!important;
}
#v64QueueRail::-webkit-scrollbar{display:none!important}
#v64QueueRail[hidden],#v64QueueRail[aria-hidden="true"]{display:none!important}
#v64QueueRail .v64-qitem{
  flex:0 0 30px!important;
  width:30px!important;
  height:30px!important;
  min-width:30px!important;
  min-height:30px!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
  border-radius:8px!important;
  overflow:hidden!important;
  opacity:.58!important;
  transform:scale(1)!important;
  transform-origin:center!important;
  transition:transform .16s cubic-bezier(.2,.8,.2,1),opacity .16s ease,filter .16s ease!important;
  scroll-snap-align:center!important;
  background:#11161d!important;
  box-shadow:0 3px 10px rgba(0,0,0,.24)!important;
  position:relative!important;
  z-index:1!important;
}
#v64QueueRail .v64-qitem img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;pointer-events:none!important}
#v64QueueRail .v64-qitem.active{opacity:1!important;outline:1.5px solid rgba(255,255,255,.92)!important;box-shadow:0 4px 14px rgba(0,0,0,.36)!important}
#v64QueueRail .v64-qitem.v646-touching{
  opacity:1!important;
  transform:scale(1.62)!important;
  z-index:20!important;
  filter:saturate(1.08) brightness(1.05)!important;
  box-shadow:0 8px 24px rgba(0,0,0,.48)!important;
}
@media(max-width:680px){
  #v64QueueRail{width:calc(100vw - 26px)!important;height:42px!important;gap:4px!important;padding:4px 7px!important;border-radius:14px!important;bottom:calc(100% + 6px)!important}
  #v64QueueRail .v64-qitem{flex-basis:27px!important;width:27px!important;height:27px!important;min-width:27px!important;min-height:27px!important;border-radius:7px!important}
  #v64QueueRail .v64-qitem.v646-touching{transform:scale(1.68)!important}
}
`;
    document.head.appendChild(style);
  }

  function clearTouch(){
    if(touching)touching.classList.remove('v646-touching');
    touching=null;
  }

  function setTouch(btn){
    if(touching===btn)return;
    clearTouch();
    if(btn){touching=btn;btn.classList.add('v646-touching')}
  }

  function wireHorizontalRail(rail){
    if(!rail||rail.dataset.v646Horizontal==='1')return rail;

    // Remplace le rail pour supprimer l'ancien listener vertical V64
    // qui sélectionnait automatiquement un titre à la fin du scroll.
    const fresh=rail.cloneNode(true);
    fresh.dataset.v646Horizontal='1';
    rail.replaceWith(fresh);

    fresh.addEventListener('click',e=>{
      const btn=e.target.closest('.v64-qitem');
      if(!btn||btn.hidden)return;
      const i=Number(btn.dataset.index),s=getS();
      if(Number.isInteger(i)&&s?.items?.[i]&&typeof window.playTrack==='function'){
        window.playTrack(s.items[i],i);
      }
    });

    fresh.addEventListener('pointerdown',e=>{
      const btn=e.target.closest('.v64-qitem');
      if(btn&&!btn.hidden)setTouch(btn);
    },{passive:true});

    fresh.addEventListener('pointermove',e=>{
      if(!touching)return;
      const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.v64-qitem');
      if(hit&&fresh.contains(hit)&&!hit.hidden)setTouch(hit);
    },{passive:true});

    fresh.addEventListener('pointerup',clearTouch,{passive:true});
    fresh.addEventListener('pointercancel',clearTouch,{passive:true});
    fresh.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')clearTouch()},{passive:true});
    return fresh;
  }

  function moveAbovePlayer(rail){
    const player=document.querySelector('#playerView .player');
    if(!rail||!player)return;
    if(rail.parentElement!==player)player.appendChild(rail);
  }

  function filterHorizontalQueue(){
    let rail=document.querySelector('#v64QueueRail');
    if(!rail)return;
    ensureStyle();
    rail=wireHorizontalRail(rail);
    moveAbovePlayer(rail);

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
      clearTouch();
      rail.hidden=true;
      rail.style.display='none';
      rail.setAttribute('aria-hidden','true');
      rail.dataset.manualCount='0';
      return;
    }

    rail.hidden=false;
    rail.style.removeProperty('display');
    rail.removeAttribute('aria-hidden');
    rail.dataset.manualCount=String(visible);

    const current=buttons.find(b=>!b.hidden&&b.classList.contains('active'));
    if(current&&rail.dataset.lastManualActive!==current.dataset.index){
      rail.dataset.lastManualActive=current.dataset.index||'';
      requestAnimationFrame(()=>current.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'}));
    }
  }

  function hideLegacy(){
    const b=document.querySelector('#v55QueueBtn');
    if(b)b.style.display='none';
    const o=document.querySelector('#v55QueueOverlay');
    if(o)o.classList.remove('show');
  }

  function boot(){
    ensureStyle();
    filterHorizontalQueue();
    hideLegacy();

    const observer=new MutationObserver(()=>{
      filterHorizontalQueue();
      hideLegacy();
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-index']});

    setInterval(()=>{
      filterHorizontalQueue();
      hideLegacy();
    },180);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
