(()=>{
  'use strict';
  let btn=null,overlay=null,lastKey='';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const current=()=>state()?.current||null;
  const playerOpen=()=>{const p=document.querySelector('#playerView');return !!(p&&!p.hidden)};

  function queueData(){
    const s=state(),cur=current();if(!s||!cur)return {cur:null,next:[]};
    const items=Array.isArray(s.items)?s.items.filter(Boolean):[];
    let idx=Number.isInteger(s.i)?s.i:-1;
    if(idx<0||idx>=items.length||items[idx]?.id!==cur.id)idx=items.findIndex(x=>x?.id===cur.id);
    if(idx<0)return {cur,next:[]};
    const indexed=items.map((item,i)=>({item,index:i}));
    const next=indexed.slice(idx+1).concat(indexed.slice(0,idx)).filter(x=>x.item?.id!==cur.id);
    return {cur,next};
  }

  function ensureButton(){
    const tools=document.querySelector('#playerView .top-tools');if(!tools)return null;
    btn=document.querySelector('#v55QueueBtn');
    if(!btn){
      btn=document.createElement('button');btn.id='v55QueueBtn';btn.className='tool-btn v55-queue-btn';btn.type='button';btn.title='File d’attente';btn.setAttribute('aria-label','Ouvrir la file d’attente');
      btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10"/><path d="M4 11h10"/><path d="M4 16h6"/><path d="m16 14 5 3-5 3v-6Z"/></svg><span id="v55QueueBadge" class="v55-queue-badge" hidden>0</span>';
      btn.addEventListener('click',openQueue);tools.appendChild(btn);
    }
    return btn;
  }

  function ensureOverlay(){
    overlay=document.querySelector('#v55QueueOverlay');if(overlay)return overlay;
    overlay=document.createElement('div');overlay.id='v55QueueOverlay';overlay.className='v55-queue-overlay';
    overlay.innerHTML='<section class="v55-queue-sheet" role="dialog" aria-modal="true" aria-label="File d’attente"><div class="v55-queue-head"><div><h3>File d’attente</h3><p id="v55QueueSubtitle">À suivre</p></div><button class="v55-queue-close" type="button" aria-label="Fermer">×</button></div><div id="v55Now"></div><div class="v55-queue-label">À suivre</div><div id="v55QueueList" class="v55-queue-list"></div></section>';
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeQueue()});overlay.querySelector('.v55-queue-close').addEventListener('click',closeQueue);document.body.appendChild(overlay);return overlay;
  }

  function render(){
    ensureButton();const o=ensureOverlay(),data=queueData(),cur=data.cur,next=data.next;
    if(!btn)return;
    btn.hidden=!cur;
    const badge=btn.querySelector('#v55QueueBadge');if(badge){badge.textContent=String(next.length);badge.hidden=next.length===0}
    const key=(cur?.id||'')+'|'+next.map(x=>x.item?.id+':'+x.index).join('|');
    if(key===lastKey)return;lastKey=key;
    const now=o.querySelector('#v55Now'),list=o.querySelector('#v55QueueList'),sub=o.querySelector('#v55QueueSubtitle');
    if(!cur){now.innerHTML='';list.innerHTML='<div class="v55-queue-empty"><strong>Aucune musique</strong>Lance un morceau pour créer une file d’attente.</div>';if(sub)sub.textContent='Aucun titre';return}
    now.innerHTML='<div class="v55-now"><img src="'+esc(cur.thumbnail||'')+'" alt=""><div class="v55-now-meta"><b>'+esc(cur.title||'Sans titre')+'</b><span>'+esc(cur.artist||'YouTube')+'</span></div><span class="v55-playing-pill">EN COURS</span></div>';
    if(sub)sub.textContent=next.length?next.length+' titre'+(next.length>1?'s':'')+' à suivre':'Fin de la file';
    if(!next.length){list.innerHTML='<div class="v55-queue-empty"><strong>Rien après ce titre</strong>La file d’attente est terminée.</div>';return}
    list.innerHTML=next.map((x,n)=>'<button class="v55-queue-item" type="button" data-v55-index="'+x.index+'"><img src="'+esc(x.item.thumbnail||'')+'" alt=""><div class="v55-item-meta"><b>'+esc(x.item.title||'Sans titre')+'</b><span>'+esc(x.item.artist||'YouTube')+'</span></div><span class="v55-queue-num">'+String(n+1).padStart(2,'0')+'</span></button>').join('');
    list.querySelectorAll('[data-v55-index]').forEach(el=>el.addEventListener('click',()=>playIndex(Number(el.dataset.v55Index))));
  }

  function playIndex(i){
    const s=state();if(!s||!Array.isArray(s.items)||!s.items[i])return;const t=s.items[i];
    try{if(typeof playTrack==='function')playTrack(t,i);else if(typeof window.playTrack==='function')window.playTrack(t,i)}catch(e){console.error(e)}
    closeQueue();setTimeout(()=>{lastKey='';render()},120);
  }
  function openQueue(){if(!current())return;render();ensureOverlay().classList.add('show');document.body.classList.add('v55-queue-open')}
  function closeQueue(){overlay?.classList.remove('show');document.body.classList.remove('v55-queue-open')}
  function sync(){
    ensureButton();
    if(!playerOpen()&&overlay?.classList.contains('show'))closeQueue();
    const data=queueData();if(btn){btn.hidden=!data.cur;const badge=btn.querySelector('#v55QueueBadge');if(badge){badge.textContent=String(data.next.length);badge.hidden=data.next.length===0}}
    if(overlay?.classList.contains('show')){const k=(data.cur?.id||'')+'|'+data.next.map(x=>x.item?.id+':'+x.index).join('|');if(k!==lastKey)render()}
  }
  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v55.js',{scope:'./'}).catch(()=>{})}
  function boot(){ensureButton();ensureOverlay();registerSW();sync();setInterval(sync,420);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeQueue()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();