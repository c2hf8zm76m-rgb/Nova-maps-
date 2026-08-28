(()=>{
  'use strict';
  const PENDING_KEY='audify_queue_pending_v56';
  const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h9"/><path d="M4 11h7"/><path d="M4 16h6"/><path d="M17 10v8"/><path d="M13 14h8"/></svg>';
  let toastTimer=0;
  const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const current=()=>state()?.current||null;
  const clean=t=>t&&t.id?{id:t.id,title:t.title||'Sans titre',artist:t.artist||'YouTube',thumbnail:t.thumbnail||''}:null;
  const readPending=()=>{try{const x=JSON.parse(localStorage.getItem(PENDING_KEY)||'[]');return Array.isArray(x)?x.filter(x=>x&&x.id):[]}catch{return []}};
  const writePending=v=>{try{localStorage.setItem(PENDING_KEY,JSON.stringify(v.slice(0,100)))}catch{}};

  function showToast(track,pending=false){
    let el=document.querySelector('#v56QueueToast');
    if(!el){el=document.createElement('div');el.id='v56QueueToast';el.className='v56-queue-toast';document.body.appendChild(el)}
    el.textContent=pending?'Ajouté à la file · démarrera après la prochaine lecture':'Ajouté à la file · '+(track?.title||'Titre');
    el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1700);
  }
  function pulse(btn){btn.classList.remove('v57-added');void btn.offsetWidth;btn.classList.add('v57-added');setTimeout(()=>btn.classList.remove('v57-added'),620)}

  function addActive(track){
    const s=state(),cur=current(),t=clean(track);if(!s||!cur||!t)return false;
    let items=Array.isArray(s.items)?s.items.filter(Boolean):[];
    let ci=items.findIndex(x=>x?.id===cur.id);
    if(ci<0){items.unshift(clean(cur));ci=0}
    if(t.id===cur.id)return true;
    const existing=items.findIndex((x,i)=>i!==ci&&x?.id===t.id);
    if(existing>=0){items.splice(existing,1);if(existing<ci)ci--}
    let pos=ci+1;while(pos<items.length&&items[pos]?.__v56Queued===true)pos++;
    items.splice(pos,0,{...t,__v56Queued:true});
    s.items=items;s.i=ci;
    return true;
  }
  function add(track,btn){
    const t=clean(track);if(!t)return;
    pulse(btn);
    if(current()&&addActive(t)){showToast(t,false);return}
    let q=readPending().filter(x=>x.id!==t.id);q.push(t);writePending(q);showToast(t,true);
  }
  function getTrack(card){
    const play=card.querySelector('[data-p]');if(!play)return null;
    const i=Number(play.dataset.p),s=state();
    return Number.isInteger(i)&&Array.isArray(s?.items)&&s.items[i]?s.items[i]:null;
  }
  function makeButton(card){
    const b=document.createElement('button');b.type='button';b.className='v57-add-queue';b.title='Ajouter à la file d’attente';b.setAttribute('aria-label','Ajouter à la file d’attente');b.innerHTML=icon;
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();add(getTrack(card),b)});
    return b;
  }
  function decorate(){
    document.querySelectorAll('#results .card').forEach(card=>{
      if(card.querySelector('.v56-add-queue,.v57-add-queue'))return;
      const play=card.querySelector(':scope > [data-p], .card-actions [data-p]');if(!play)return;
      let actions=card.querySelector('.card-actions');
      if(actions){
        const b=makeButton(card);const fav=actions.querySelector('[data-fav]');fav?actions.insertBefore(b,fav):actions.appendChild(b);return;
      }
      actions=document.createElement('div');actions.className='v57-search-actions';
      play.parentNode.insertBefore(actions,play);actions.appendChild(play);actions.appendChild(makeButton(card));
    });
  }
  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v57.js',{scope:'./'}).catch(()=>{})}
  function boot(){registerSW();decorate();setInterval(decorate,260)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
