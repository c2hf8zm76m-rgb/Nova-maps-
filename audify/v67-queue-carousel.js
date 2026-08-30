(()=>{
  'use strict';

  let lastKey='';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const current=()=>state()?.current||null;
  const playerView=()=>document.querySelector('#playerView');

  function consumeCurrentManualFlag(){
    const s=state(),cur=current();
    if(!s||!cur||!Array.isArray(s.items))return;
    let i=Number.isInteger(s.i)?s.i:-1;
    if(i<0||i>=s.items.length||s.items[i]?.id!==cur.id)i=s.items.findIndex(x=>x?.id===cur.id);
    if(i>=0&&s.items[i]?.__v56Queued===true){
      try{delete s.items[i].__v56Queued}catch{s.items[i].__v56Queued=false}
      try{if(cur.__v56Queued===true)delete cur.__v56Queued}catch{}
      lastKey='';
    }
  }

  function manualQueue(){
    const s=state(),cur=current();
    if(!s||!cur||!Array.isArray(s.items))return [];
    let ci=Number.isInteger(s.i)?s.i:-1;
    if(ci<0||ci>=s.items.length||s.items[ci]?.id!==cur.id)ci=s.items.findIndex(x=>x?.id===cur.id);
    return s.items.map((item,index)=>({item,index}))
      .filter(x=>x.item&&x.item.id!==cur.id&&x.item.__v56Queued===true)
      .sort((a,b)=>{
        if(ci<0)return a.index-b.index;
        const da=(a.index-ci+s.items.length)%s.items.length;
        const db=(b.index-ci+s.items.length)%s.items.length;
        return da-db;
      });
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
      player.parentNode.insertBefore(sec,player);
    }
    return sec;
  }

  function playIndex(index){
    const s=state();
    if(!s||!Array.isArray(s.items)||!s.items[index])return;
    const t=s.items[index];
    try{
      if(typeof playTrack==='function')playTrack(t,index);
      else if(typeof window.playTrack==='function')window.playTrack(t,index);
    }catch(e){console.error('[Audify V67 queue carousel]',e)}
    setTimeout(()=>{lastKey='';sync()},80);
  }

  function render(items){
    const sec=ensure();if(!sec)return;
    const view=playerView();
    const key=items.map(x=>x.item.id+':'+x.index).join('|');
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
    row.innerHTML=items.map((x,n)=>{
      const t=x.item;
      return '<button type="button" class="v67-mq-card" data-v67-qindex="'+x.index+'" aria-label="Lire '+esc(t.title||'ce titre')+'"><span class="v67-mq-order">'+String(n+1).padStart(2,'0')+'</span><img src="'+esc(t.thumbnail||'')+'" alt=""><b>'+esc(t.title||'Sans titre')+'</b><span>'+esc(t.artist||'YouTube')+'</span></button>';
    }).join('');
    row.querySelectorAll('[data-v67-qindex]').forEach(b=>b.addEventListener('click',()=>playIndex(Number(b.dataset.v67Qindex))));
    requestAnimationFrame(()=>{try{row.scrollTo({left:0,behavior:'smooth'})}catch{row.scrollLeft=0}});
  }

  function sync(){
    const view=playerView();
    if(!view)return;
    consumeCurrentManualFlag();
    const open=!view.hidden;
    const q=manualQueue();
    if(!open){view.classList.remove('v67-has-manual-queue');return}
    render(q);
  }

  function boot(){
    ensure();sync();
    setInterval(sync,240);
    const view=playerView();
    if(view)new MutationObserver(sync).observe(view,{attributes:true,attributeFilter:['hidden']});
    window.AudifyManualQueueCarouselV67={refresh:()=>{lastKey='';sync()},items:()=>manualQueue().map(x=>x.item)};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
