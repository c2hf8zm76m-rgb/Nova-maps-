(()=>{
  'use strict';

  const STORE_KEY='audify_manual_queue_v67';
  const PENDING_KEY='audify_queue_pending_v56';
  const FAVORITES_KEY='audify_favorites_v1';
  const MAX_QUEUE=100;
  let lastKey='',lastCurrentId='';

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const current=()=>state()?.current||null;
  const playerView=()=>document.querySelector('#playerView');
  const clean=t=>t&&t.id?{id:String(t.id),title:t.title||'Sans titre',artist:t.artist||'YouTube',thumbnail:t.thumbnail||''}:null;
  const readList=k=>{try{const x=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(x)?x.filter(x=>x&&x.id):[]}catch{return []}};
  const readStore=()=>readList(STORE_KEY);
  const writeStore=v=>{try{localStorage.setItem(STORE_KEY,JSON.stringify((v||[]).filter(x=>x&&x.id).slice(0,MAX_QUEUE)))}catch{}};

  function remember(track){
    const t=clean(track);if(!t||t.id===String(current()?.id||''))return;
    const q=readStore().filter(x=>String(x.id)!==t.id);q.push(t);writeStore(q);lastKey='';
  }

  function recoverLegacyQueue(){
    const s=state();
    if(Array.isArray(s?.items))s.items.forEach(t=>{if(t?.__v56Queued===true)remember(t)});
    readList(PENDING_KEY).forEach(remember);
  }

  function consumeCurrent(){
    const id=String(current()?.id||'');if(!id||id===lastCurrentId)return;
    lastCurrentId=id;
    const before=readStore(),after=before.filter(x=>String(x.id)!==id);
    if(after.length!==before.length){writeStore(after);lastKey=''}
  }

  function manualQueue(){
    const id=String(current()?.id||'');
    return readStore().filter(x=>String(x.id)!==id);
  }

  function ensure(){
    const view=playerView(),player=view?.querySelector('.player');
    if(!view||!player)return null;
    let sec=view.querySelector('#v67ManualQueue');
    if(!sec){
      sec=document.createElement('section');
      sec.id='v67ManualQueue';
      sec.className='v67-manual-queue';
      sec.setAttribute('aria-label','File d’attente manuelle');
      sec.innerHTML='<div class="v67-mq-head"><div><span class="v67-mq-kicker">À SUIVRE</span><h3>File d’attente</h3></div><span id="v67MqCount" class="v67-mq-count"></span></div><div id="v67MqRow" class="v67-mq-row"></div>';
      const copy=view.querySelector('.copy');
      if(copy&&copy.parentNode===player.parentNode)copy.insertAdjacentElement('afterend',sec);
      else player.parentNode.insertBefore(sec,player);
    }
    return sec;
  }

  function trackFromQueueButton(btn){
    const s=state();
    const card=btn.closest('.card');
    if(card){
      const play=card.querySelector('[data-p]'),i=Number(play?.dataset.p);
      if(Number.isInteger(i)&&Array.isArray(s?.items)&&s.items[i])return s.items[i];
    }
    const fav=btn.closest('.fav-card');
    if(fav){
      const id=fav.querySelector('[data-fav-play]')?.dataset.favPlay;
      if(id){const list=readList(FAVORITES_KEY);const t=list.find(x=>String(x.id)===String(id));if(t)return t}
    }
    return null;
  }

  function playStored(id){
    const saved=readStore().find(x=>String(x.id)===String(id));if(!saved)return;
    const s=state();if(!s)return;
    let items=Array.isArray(s.items)?s.items.filter(Boolean):[];
    let i=items.findIndex(x=>String(x?.id)===String(id));
    if(i<0){items.push({...saved,__v56Queued:true});i=items.length-1;s.items=items}
    try{
      if(typeof playTrack==='function')playTrack(items[i],i);
      else if(typeof window.playTrack==='function')window.playTrack(items[i],i);
    }catch(e){console.error('[Audify V67 queue carousel]',e)}
    setTimeout(()=>{consumeCurrent();lastKey='';sync()},80);
  }

  function render(items){
    const sec=ensure();if(!sec)return;
    const view=playerView();
    const key=items.map(x=>x.id).join('|');
    if(!items.length){
      sec.hidden=true;
      view?.classList.remove('v67-has-manual-queue');
      lastKey='';
      return;
    }
    sec.hidden=false;
    view?.classList.add('v67-has-manual-queue');
    if(key===lastKey)return;
    lastKey=key;
    const count=sec.querySelector('#v67MqCount'),row=sec.querySelector('#v67MqRow');
    if(count)count.textContent=items.length+' titre'+(items.length>1?'s':'');
    row.innerHTML=items.map((t,n)=>'<button type="button" class="v67-mq-card" data-v67-qid="'+esc(t.id)+'" aria-label="Lire '+esc(t.title||'ce titre')+'"><span class="v67-mq-order">'+String(n+1).padStart(2,'0')+'</span><img src="'+esc(t.thumbnail||'')+'" alt=""><b>'+esc(t.title||'Sans titre')+'</b><span>'+esc(t.artist||'YouTube')+'</span></button>').join('');
    row.querySelectorAll('[data-v67-qid]').forEach(b=>b.addEventListener('click',()=>playStored(b.dataset.v67Qid)));
  }

  function sync(){
    const view=playerView();if(!view)return;
    recoverLegacyQueue();consumeCurrent();
    if(view.hidden){view.classList.remove('v67-has-manual-queue');return}
    render(manualQueue());
  }

  function boot(){
    window.addEventListener('audify:queue-added',e=>{
      const t=e?.detail?.track;
      if(t){remember(t);lastKey='';setTimeout(sync,0)}
    });
    document.addEventListener('click',e=>{
      const btn=e.target.closest('.v56-add-queue,.v57-add-queue');if(!btn)return;
      const t=trackFromQueueButton(btn);if(t){remember(t);setTimeout(sync,0)}
    },true);
    ensure();sync();setInterval(sync,240);
    const view=playerView();if(view)new MutationObserver(sync).observe(view,{attributes:true,attributeFilter:['hidden']});
    window.AudifyManualQueueCarouselV67={refresh:()=>{lastKey='';sync()},items:manualQueue,clear:()=>{writeStore([]);lastKey='';sync()}};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();