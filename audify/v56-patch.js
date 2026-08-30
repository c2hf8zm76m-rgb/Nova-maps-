(()=>{
  'use strict';
  const PENDING_KEY='audify_queue_pending_v56';
  const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h9"/><path d="M4 11h7"/><path d="M4 16h6"/><path d="M17 10v8"/><path d="M13 14h8"/></svg>';
  let toastTimer=0,lastCurrent='';
  const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const current=()=>state()?.current||null;
  const clean=t=>t&&t.id?{id:t.id,title:t.title||'Sans titre',artist:t.artist||'YouTube',thumbnail:t.thumbnail||''}:null;
  const readPending=()=>{try{const x=JSON.parse(localStorage.getItem(PENDING_KEY)||'[]');return Array.isArray(x)?x.filter(x=>x&&x.id):[]}catch{return []}};
  const writePending=v=>{try{localStorage.setItem(PENDING_KEY,JSON.stringify(v.slice(0,100)))}catch{}};
  const favorites=()=>{try{const x=JSON.parse(localStorage.getItem('audify_favorites_v1')||'[]');return Array.isArray(x)?x:[]}catch{return []}};

  function showToast(track,pending=false){
    let el=document.querySelector('#v56QueueToast');if(!el){el=document.createElement('div');el.id='v56QueueToast';el.className='v56-queue-toast';document.body.appendChild(el)}
    el.textContent=pending?'Ajouté à la file · démarrera après la prochaine lecture':'Ajouté à la file · '+(track?.title||'Titre');
    el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1700);
  }
  function pulse(btn){btn.classList.remove('v56-added');void btn.offsetWidth;btn.classList.add('v56-added');setTimeout(()=>btn.classList.remove('v56-added'),620)}
  function emitQueueAdded(track,mode){
    const t=clean(track);if(!t)return;
    try{window.dispatchEvent(new CustomEvent('audify:queue-added',{detail:{track:t,mode:mode||'active'}}))}catch{}
  }

  function addActive(track){
    const s=state(),cur=current(),t=clean(track);if(!s||!cur||!t)return false;
    let items=Array.isArray(s.items)?s.items.filter(Boolean):[];
    let ci=items.findIndex(x=>x?.id===cur.id);
    if(ci<0){items.unshift(clean(cur));ci=0}
    if(t.id===cur.id)return true;
    const existing=items.findIndex((x,i)=>i!==ci&&x?.id===t.id);
    if(existing>=0){items.splice(existing,1);if(existing<ci)ci--}
    let pos=ci+1;while(pos<items.length&&items[pos]?.__v56Queued===true)pos++;
    const queued={...t,__v56Queued:true};items.splice(pos,0,queued);
    s.items=items;s.i=ci;
    return true;
  }
  function add(track,btn){
    const t=clean(track);if(!t)return;
    pulse(btn);
    if(current()&&addActive(t)){
      emitQueueAdded(t,'active');
      showToast(t,false);
      return;
    }
    let q=readPending().filter(x=>x.id!==t.id);q.push(t);writePending(q);
    emitQueueAdded(t,'pending');
    showToast(t,true);
  }
  function mergePending(){
    const cur=current();if(!cur)return;
    const q=readPending();if(!q.length)return;
    q.forEach(addActive);writePending([]);
  }

  function searchTrack(btn){
    const play=btn.closest('.card')?.querySelector('[data-p]');if(!play)return null;
    const i=Number(play.dataset.p),s=state();return Number.isInteger(i)&&Array.isArray(s?.items)?s.items[i]:null;
  }
  function favTrack(btn){
    const play=btn.closest('.fav-card')?.querySelector('[data-fav-play]');if(!play)return null;
    return favorites().find(x=>x.id===play.dataset.favPlay)||null;
  }
  function makeButton(kind){
    const b=document.createElement('button');b.type='button';b.className='v56-add-queue';b.title='Ajouter à la file d’attente';b.setAttribute('aria-label','Ajouter à la file d’attente');b.innerHTML=icon;
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const t=kind==='fav'?favTrack(b):searchTrack(b);add(t,b)});
    return b;
  }
  function decorateSearch(){
    document.querySelectorAll('.card .card-actions').forEach(actions=>{
      if(actions.querySelector('.v56-add-queue'))return;
      const play=actions.querySelector('[data-p]');if(!play)return;
      actions.classList.add('v56-actions');
      const b=makeButton('search');
      const fav=actions.querySelector('[data-fav]');fav?actions.insertBefore(b,fav):actions.appendChild(b);
    });
  }
  function decorateFavs(){
    document.querySelectorAll('.fav-card .fav-actions').forEach(actions=>{
      if(actions.querySelector('.v56-add-queue'))return;
      const play=actions.querySelector('[data-fav-play]');if(!play)return;
      actions.classList.add('v56-fav-actions');actions.closest('.fav-card')?.querySelector('.fav-meta')?.classList.add('v56-room');
      const b=makeButton('fav'),remove=actions.querySelector('[data-fav-remove]');remove?actions.insertBefore(b,remove):actions.appendChild(b);
    });
  }
  function sync(){
    decorateSearch();decorateFavs();
    const id=current()?.id||'';if(id&&id!==lastCurrent){lastCurrent=id;mergePending()}else if(id)mergePending();
  }
  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v56.js',{scope:'./'}).catch(()=>{})}
  function boot(){registerSW();sync();setInterval(sync,320)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();