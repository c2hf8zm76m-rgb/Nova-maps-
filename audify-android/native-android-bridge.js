(()=>{
  'use strict';
  const LOOP_KEY='audify_loop_v1';
  let nativeMode=false,lastQueueSig='',scrollTimer=0,scrubbing=false;
  const q=s=>document.querySelector(s);
  const getS=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const track=()=>getS()?.current||null;
  const bridge=()=>window.AudifyNative||null;
  const fmt=n=>{n=Math.max(0,Math.floor(Number(n)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
  const clean=t=>t&&t.id?{id:String(t.id),title:String(t.title||'Sans titre'),artist:String(t.artist||'YouTube'),thumbnail:String(t.thumbnail||'')}:null;
  const loopOn=()=>{try{return sessionStorage.getItem(LOOP_KEY)==='1'}catch{return false}};
  const setLoopLocal=v=>{try{sessionStorage.setItem(LOOP_KEY,v?'1':'0')}catch{}};

  function pauseYoutube(){
    const s=getS(),p=s&&s.p;
    try{p&&p.pauseVideo&&p.pauseVideo()}catch{}
  }

  function readNative(){
    const b=bridge();if(!b||typeof b.getState!=='function')return null;
    try{return JSON.parse(String(b.getState()||'{}'))}catch{return null}
  }

  function visualApply(t,i=-1){
    const s=getS();if(!s||!t)return;
    s.current=t;if(Number.isInteger(i)&&i>=0)s.i=i;
    const rv=q('#resultsView'),pv=q('#playerView');if(rv)rv.hidden=true;if(pv)pv.hidden=false;
    const title=q('#title');if(title){title.textContent=t.title||'Sans titre';try{typeof applyTitleSize==='function'&&applyTitleSize(t.title)}catch{}}
    const artist=q('#artist');if(artist)artist.textContent=t.artist||'YouTube';
    const cover=q('#cover');if(cover)cover.style.backgroundImage='url("'+String(t.thumbnail||'').replace(/"/g,'')+'")';
    const label=q('#vlabel');if(label)label.style.backgroundImage='url("'+String(t.thumbnail||'').replace(/"/g,'')+'")';
    try{typeof setAmbient==='function'&&setAmbient(t.thumbnail,t.id||t.title)}catch{}
    try{typeof syncLike==='function'&&syncLike()}catch{}
    q('#video')?.classList.remove('show');
    ensureQueueRail();renderQueueRail();
  }

  function queuePayload(){
    const s=getS();if(!s)return {items:[],index:-1};
    const items=(Array.isArray(s.items)?s.items:[]).map(clean).filter(Boolean);
    let index=Number.isInteger(s.i)?s.i:-1;
    const cur=track();
    if(cur&&(!items[index]||items[index].id!==String(cur.id)))index=items.findIndex(x=>x.id===String(cur.id));
    return {items,index};
  }

  function syncQueue(force=false){
    const b=bridge();if(!b||typeof b.setQueue!=='function')return;
    const payload=queuePayload();
    const sig=payload.index+'|'+payload.items.map(x=>x.id).join(',');
    if(!force&&sig===lastQueueSig)return;
    lastQueueSig=sig;
    try{b.setQueue(JSON.stringify(payload))}catch{}
    renderQueueRail();
  }

  function loadNative(t,i=-1){
    const b=bridge(),c=clean(t);if(!b||typeof b.loadTrack!=='function'||!c)return;
    nativeMode=true;
    visualApply(c,i);
    syncQueue(true);
    pauseYoutube();
    try{b.loadTrack(JSON.stringify({videoId:c.id,title:c.title,artist:c.artist,thumbnail:c.thumbnail}))}catch{}
  }

  function nativePlayTrack(t,i=-1){loadNative(t,i)}
  try{window.playTrack=nativePlayTrack}catch{}

  function step(delta){
    const b=bridge();if(!b)return;
    syncQueue(true);
    try{delta>0?b.next():b.previous()}catch{}
    setTimeout(syncUi,80);
  }

  function toggleLoop(){
    const b=bridge(),next=!loopOn();setLoopLocal(next);
    try{b&&b.setRepeat&&b.setRepeat(next)}catch{}
    syncLoopUi(next);
  }

  function syncLoopUi(on=loopOn()){
    ['#repeatBtn','#v45MiniLoop'].forEach(sel=>{const el=q(sel);if(!el)return;el.classList.toggle('active',on);el.setAttribute('aria-pressed',on?'true':'false')});
  }

  function syncUi(){
    if(!nativeMode)return;
    const n=readNative();if(!n)return;
    const s=getS();
    if(n.videoId&&s&&String(s.current?.id||'')!==String(n.videoId)){
      const items=Array.isArray(s.items)?s.items:[];
      const i=items.findIndex(x=>String(x?.id||'')===String(n.videoId));
      if(i>=0)visualApply(items[i],i);
    }
    const playing=!!n.playing,loading=!!n.loading;
    const pos=Math.max(0,Number(n.position||0)),dur=Math.max(0,Number(n.duration||0));
    q('#playerView')?.classList.toggle('playing',playing);
    document.body.classList.toggle('playing',playing);
    const play=q('#play');if(play)play.textContent=playing?'❚❚':'▶';
    const miniPlay=q('#v45MiniPlay');if(miniPlay)miniPlay.textContent=playing?'❚❚':'▶';
    const ct=q('#ct');if(ct)ct.textContent=fmt(pos);
    const du=q('#dur');if(du&&dur>0)du.textContent=fmt(dur);
    if(!scrubbing&&dur>0){
      const v=String(Math.round(Math.max(0,Math.min(1,pos/dur))*1000));
      const prog=q('#prog');if(prog)prog.value=v;
      const mp=q('#v45MiniProgress');if(mp)mp.value=v;
    }
    const vol=q('#vol');if(vol&&Number.isFinite(Number(n.volume)))vol.value=String(Math.round(Number(n.volume)*100));
    if(typeof n.repeatOne==='boolean'){setLoopLocal(n.repeatOne);syncLoopUi(n.repeatOne)}
    let badge=q('#audifyNativeBadge');
    if(!badge){const copy=q('.copy,.track-copy');if(copy){badge=document.createElement('div');badge.id='audifyNativeBadge';badge.style.cssText='margin-top:9px;font-size:12px;opacity:.72';copy.appendChild(badge)}}
    if(badge)badge.textContent=n.error?'Native • erreur de lecture':loading?'Native • préparation YouTube…':'Native • ExoPlayer arrière-plan';
    renderQueueRail();
  }

  function ensureQueueRail(){
    const pv=q('#playerView');if(!pv||q('#v64QueueRail'))return;
    const style=document.createElement('style');style.id='v64QueueStyle';style.textContent=`
#v64QueueRail{position:absolute;z-index:8;right:max(8px,env(safe-area-inset-right));top:50%;transform:translateY(-50%);height:min(58vh,520px);width:78px;padding:10px 6px;border-radius:26px;background:linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.13);backdrop-filter:blur(24px) saturate(150%);-webkit-backdrop-filter:blur(24px) saturate(150%);box-shadow:0 18px 58px rgba(0,0,0,.32);overflow-y:auto;overflow-x:hidden;scroll-snap-type:y mandatory;overscroll-behavior:contain;scrollbar-width:none}
#v64QueueRail::-webkit-scrollbar{display:none}.v64-qitem{display:block;width:58px;height:58px;margin:7px auto;border:0;padding:0;border-radius:15px;overflow:hidden;opacity:.5;transform:scale(.88);transition:.22s ease;scroll-snap-align:center;background:#161b22;box-shadow:0 7px 22px rgba(0,0,0,.28)}.v64-qitem img{width:100%;height:100%;object-fit:cover;display:block}.v64-qitem.active{opacity:1;transform:scale(1.08);outline:2px solid rgba(255,255,255,.92);box-shadow:0 10px 30px rgba(0,0,0,.48)}.v64-qitem.before,.v64-qitem.after{opacity:.68}
@media(max-width:680px){#v64QueueRail{right:5px;width:66px;height:48vh;padding:8px 4px;border-radius:22px}.v64-qitem{width:50px;height:50px;border-radius:13px;margin:6px auto}.copy{max-width:78vw}.stage{transform:translateX(-4vw)}}
`;document.head.appendChild(style);
    const rail=document.createElement('div');rail.id='v64QueueRail';rail.setAttribute('aria-label',"File d’attente verticale");pv.appendChild(rail);
    rail.addEventListener('click',e=>{const item=e.target.closest('.v64-qitem');if(!item)return;const i=Number(item.dataset.index),s=getS();if(Number.isInteger(i)&&s?.items?.[i])loadNative(s.items[i],i)});
    const chooseCentered=()=>{const items=[...rail.querySelectorAll('.v64-qitem')];if(!items.length)return;const rr=rail.getBoundingClientRect(),cy=rr.top+rr.height/2;let best=null,dist=1e9;for(const el of items){const r=el.getBoundingClientRect(),d=Math.abs((r.top+r.height/2)-cy);if(d<dist){dist=d;best=el}}if(best){const i=Number(best.dataset.index),s=getS();if(Number.isInteger(i)&&s?.items?.[i]&&i!==s.i)loadNative(s.items[i],i)}};
    rail.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(chooseCentered,240)},{passive:true});
  }

  function renderQueueRail(){
    const rail=q('#v64QueueRail'),s=getS();if(!rail||!s)return;
    const items=Array.isArray(s.items)?s.items:[];
    const cur=String(s.current?.id||'');
    const sig=items.map(x=>x?.id||'').join('|')+'@'+cur;
    if(rail.dataset.sig===sig)return;rail.dataset.sig=sig;
    rail.innerHTML=items.map((t,i)=>'<button class="v64-qitem '+(String(t?.id||'')===cur?'active':i<(s.i||0)?'before':'after')+'" data-index="'+i+'" type="button" title="'+String(t?.title||'').replace(/"/g,'&quot;')+'"><img src="'+String(t?.thumbnail||'').replace(/"/g,'&quot;')+'" alt=""></button>').join('');
    requestAnimationFrame(()=>rail.querySelector('.active')?.scrollIntoView({block:'center',behavior:'smooth'}));
  }

  function bindControls(){
    const b=bridge();if(!b)return;
    const play=q('#play');if(play)play.onclick=e=>{e.preventDefault();const n=readNative();try{n?.playing?b.pause():b.resume()}catch{}};
    const prev=q('#prev');if(prev)prev.onclick=e=>{e.preventDefault();step(-1)};
    const next=q('#next');if(next)next.onclick=e=>{e.preventDefault();step(1)};
    const prog=q('#prog');if(prog)prog.oninput=e=>{const n=readNative();if(!n||!(Number(n.duration)>0))return;try{b.seekTo(Number(n.duration)*(Number(e.target.value||0)/1000))}catch{}};
    const vol=q('#vol');if(vol)vol.oninput=e=>{try{b.setVolume(Number(e.target.value||0)/100)}catch{}};
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest('button');if(!btn||!nativeMode)return;
    const b=bridge();if(!b)return;
    if(btn.id==='v45MiniPlay'){e.preventDefault();e.stopImmediatePropagation();const n=readNative();try{n?.playing?b.pause():b.resume()}catch{}}
    else if(btn.id==='v45MiniLoop'||btn.id==='repeatBtn'){e.preventDefault();e.stopImmediatePropagation();toggleLoop()}
  },true);

  document.addEventListener('input',e=>{
    if(!nativeMode||!e.target)return;
    const b=bridge();if(!b)return;
    if(e.target.id==='v45MiniProgress'){e.preventDefault();e.stopImmediatePropagation();const n=readNative();if(n&&Number(n.duration)>0)try{b.seekTo(Number(n.duration)*(Number(e.target.value||0)/1000))}catch{}}
  },true);
  document.addEventListener('pointerdown',e=>{if(e.target?.id==='prog'||e.target?.id==='v45MiniProgress')scrubbing=true},true);
  document.addEventListener('pointerup',()=>{scrubbing=false},true);

  window.AudifyNativeControl={
    play(){try{bridge()?.resume()}catch{}},pause(){try{bridge()?.pause()}catch{}},
    next(){step(1)},previous(){step(-1)}
  };

  function boot(){
    nativeMode=!!bridge();
    ensureQueueRail();bindControls();syncLoopUi(loopOn());
    try{bridge()?.setRepeat?.(loopOn())}catch{}
    const t=track();if(t?.id)loadNative(t,getS()?.i??-1);
    setInterval(()=>{bindControls();syncQueue();pauseYoutube();syncUi()},280);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();