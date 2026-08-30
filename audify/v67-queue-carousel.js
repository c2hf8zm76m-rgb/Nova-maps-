(()=>{
  'use strict';

  const STORE_KEY='audify_manual_queue_v67';
  const PENDING_KEY='audify_queue_pending_v56';
  const FAVORITES_KEY='audify_favorites_v1';
  const MAX_QUEUE=100;
  let lastKey='',lastCurrentId='',selectedId='';
  let externalIntent=false,queuePlayTarget='',touchStart=null;

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const current=()=>state()?.current||null;
  const playerView=()=>document.querySelector('#playerView');
  const clean=t=>t&&t.id?{id:String(t.id),title:t.title||'Sans titre',artist:t.artist||'YouTube',thumbnail:t.thumbnail||''}:null;
  const readList=k=>{try{const x=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(x)?x.filter(x=>x&&x.id):[]}catch{return []}};
  const readStore=()=>readList(STORE_KEY);
  const writeStore=v=>{try{localStorage.setItem(STORE_KEY,JSON.stringify((v||[]).filter(x=>x&&x.id).slice(0,MAX_QUEUE)))}catch{}};
  const writePending=v=>{try{localStorage.setItem(PENDING_KEY,JSON.stringify((v||[]).filter(x=>x&&x.id).slice(0,MAX_QUEUE)))}catch{}};

  function remember(track){
    const t=clean(track);if(!t||t.id===String(current()?.id||''))return;
    const q=readStore().filter(x=>String(x.id)!==t.id);q.push(t);writeStore(q);lastKey='';
  }

  function clearEphemeralQueue(preserveId=''){
    preserveId=String(preserveId||'');
    const ids=new Set([...readStore(),...readList(PENDING_KEY)].map(x=>String(x.id)));
    writeStore([]);writePending([]);
    const s=state();
    if(Array.isArray(s?.items)){
      const kept=[];
      for(const t of s.items){
        if(!t)continue;
        const id=String(t.id||'');
        const wasQueued=t.__v56Queued===true||ids.has(id);
        if(wasQueued&&id!==preserveId)continue;
        if(t.__v56Queued===true){try{delete t.__v56Queued}catch{t.__v56Queued=false}}
        kept.push(t);
      }
      s.items=kept;
      if(preserveId){const i=kept.findIndex(x=>String(x?.id||'')===preserveId);if(i>=0)s.i=i}
    }
    selectedId='';lastKey='';
    const view=playerView();
    view?.classList.remove('v67-has-manual-queue');
    const sec=view?.querySelector('#v67ManualQueue');if(sec)sec.hidden=true;
  }

  function recoverLegacyQueue(){
    const s=state();
    if(Array.isArray(s?.items))s.items.forEach(t=>{if(t?.__v56Queued===true)remember(t)});
    readList(PENDING_KEY).forEach(remember);
  }

  function consumeCurrent(){
    const id=String(current()?.id||'');if(!id)return;
    if(!lastCurrentId){lastCurrentId=id;return}
    if(id===lastCurrentId)return;

    const before=readStore();
    const isQueued=before.some(x=>String(x.id)===id);
    const fromQueue=queuePlayTarget===id||(!externalIntent&&isQueued);

    if(before.length||readList(PENDING_KEY).length){
      if(externalIntent||!fromQueue){
        clearEphemeralQueue(id);
      }else{
        writeStore(before.filter(x=>String(x.id)!==id));
        const s=state(),cur=current();
        if(cur?.__v56Queued===true){try{delete cur.__v56Queued}catch{cur.__v56Queued=false}}
        if(Array.isArray(s?.items)){
          const hit=s.items.find(x=>String(x?.id||'')===id);
          if(hit?.__v56Queued===true){try{delete hit.__v56Queued}catch{hit.__v56Queued=false}}
        }
        lastKey='';
      }
    }

    if(selectedId===id)selectedId='';
    lastCurrentId=id;
    externalIntent=false;
    queuePlayTarget='';
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
    id=String(id||'');
    const saved=readStore().find(x=>String(x.id)===id);if(!saved)return;
    const s=state();if(!s)return;
    let items=Array.isArray(s.items)?s.items.filter(Boolean):[];
    let i=items.findIndex(x=>String(x?.id)===id);
    if(i<0){items.push({...saved,__v56Queued:true});i=items.length-1;s.items=items}
    queuePlayTarget=id;externalIntent=false;
    try{
      if(typeof playTrack==='function')playTrack(items[i],i);
      else if(typeof window.playTrack==='function')window.playTrack(items[i],i);
    }catch(e){console.error('[Audify V67 queue carousel]',e)}
    selectedId='';
    setTimeout(()=>{consumeCurrent();lastKey='';sync()},80);
  }

  function selectOrPlay(id){
    id=String(id||'');if(!id)return;
    if(selectedId!==id){
      selectedId=id;lastKey='';render(manualQueue());
      requestAnimationFrame(()=>{
        const row=document.querySelector('#v67MqRow');
        const card=[...(row?.querySelectorAll('[data-v67-qid]')||[])].find(el=>String(el.dataset.v67Qid)===id);
        if(card)try{card.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})}catch{}
      });
      return;
    }
    playStored(id);
  }

  function render(items){
    const sec=ensure();if(!sec)return;
    const view=playerView();
    if(selectedId&&!items.some(x=>String(x.id)===selectedId))selectedId='';
    const key=items.map(x=>x.id).join('|')+'|selected:'+selectedId;
    if(!items.length){
      sec.hidden=true;
      view?.classList.remove('v67-has-manual-queue');
      selectedId='';lastKey='';
      return;
    }
    sec.hidden=false;
    view?.classList.add('v67-has-manual-queue');
    if(key===lastKey)return;
    lastKey=key;
    const count=sec.querySelector('#v67MqCount'),row=sec.querySelector('#v67MqRow');
    if(count)count.textContent=items.length+' titre'+(items.length>1?'s':'');
    row.innerHTML=items.map((t,n)=>{
      const active=String(t.id)===selectedId;
      return '<button type="button" class="v67-mq-card'+(active?' is-selected':'')+'" data-v67-qid="'+esc(t.id)+'" aria-pressed="'+(active?'true':'false')+'" aria-label="'+(active?'Lire ':'Sélectionner ')+esc(t.title||'ce titre')+'"><span class="v67-mq-order">'+String(n+1).padStart(2,'0')+'</span><img src="'+esc(t.thumbnail||'')+'" alt=""><b>'+esc(t.title||'Sans titre')+'</b><span>'+esc(t.artist||'YouTube')+'</span></button>';
    }).join('');
    row.querySelectorAll('[data-v67-qid]').forEach(b=>b.addEventListener('click',()=>selectOrPlay(b.dataset.v67Qid)));
  }

  function sync(){
    const view=playerView();if(!view)return;
    recoverLegacyQueue();consumeCurrent();
    if(view.hidden){view.classList.remove('v67-has-manual-queue');return}
    render(manualQueue());
  }

  function markExternalIntent(){
    if(!readStore().length&&!readList(PENDING_KEY).length)return;
    externalIntent=true;queuePlayTarget='';
  }

  function boot(){
    window.addEventListener('audify:queue-added',e=>{
      const t=e?.detail?.track;
      if(t){remember(t);lastKey='';setTimeout(sync,0)}
    });
    window.addEventListener('audify:external-play-intent',()=>markExternalIntent());

    document.addEventListener('click',e=>{
      const target=e.target;
      const queueBtn=target.closest('.v56-add-queue,.v57-add-queue');
      if(queueBtn){const t=trackFromQueueButton(queueBtn);if(t){remember(t);setTimeout(sync,0)}return}
      if(target.closest('#v67ManualQueue'))return;
      if(target.closest('[data-p],[data-play],[data-fav-play],.v48-recent-card,.v50-sheet-item,#prev,#next'))markExternalIntent();
    },true);

    document.addEventListener('touchstart',e=>{
      if(!e.target.closest('#playerView')||e.target.closest('#v67ManualQueue')){touchStart=null;return}
      const t=e.touches?.[0];touchStart=t?{x:t.clientX,y:t.clientY}:null;
    },{passive:true,capture:true});
    document.addEventListener('touchend',e=>{
      if(!touchStart)return;
      const t=e.changedTouches?.[0];
      if(t){const dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.25)markExternalIntent()}
      touchStart=null;
    },{passive:true,capture:true});

    ensure();sync();setInterval(sync,240);
    const view=playerView();if(view)new MutationObserver(sync).observe(view,{attributes:true,attributeFilter:['hidden']});
    window.AudifyManualQueueCarouselV67={refresh:()=>{lastKey='';sync()},items:manualQueue,clear:()=>{clearEphemeralQueue(String(current()?.id||''));sync()}};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();