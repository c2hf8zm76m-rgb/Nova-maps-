(()=>{
  'use strict';
  let lastTrackId='';
  let nativeMode=false;
  const getS=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const getPlayer=()=>{const s=getS();return s&&s.p?s.p:null};
  const track=()=>{const s=getS();return s&&s.current?s.current:null};
  const fmt=n=>{n=Math.max(0,Math.floor(Number(n)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};

  function pauseYoutube(){
    const p=getPlayer();
    try{p&&p.pauseVideo&&p.pauseVideo()}catch{}
  }

  function startNative(t){
    const bridge=window.AudifyNative;
    if(!bridge||typeof bridge.loadTrack!=='function'||!t||!t.id)return;
    nativeMode=true;
    lastTrackId=String(t.id);
    pauseYoutube();
    try{
      bridge.loadTrack(JSON.stringify({
        videoId:String(t.id||''),
        title:String(t.title||'Audify'),
        artist:String(t.artist||''),
        thumbnail:String(t.thumbnail||'')
      }));
    }catch{}
  }

  function readNative(){
    const bridge=window.AudifyNative;
    if(!bridge||typeof bridge.getState!=='function')return null;
    try{return JSON.parse(String(bridge.getState()||'{}'))}catch{return null}
  }

  function syncUi(){
    if(!nativeMode)return;
    const n=readNative();if(!n)return;
    const playing=!!n.playing;
    const loading=!!n.loading;
    const p=Math.max(0,Number(n.position||0));
    const d=Math.max(0,Number(n.duration||0));
    document.body.classList.toggle('playing',playing);
    const play=document.querySelector('#play');if(play)play.textContent=playing?'❚❚':'▶';
    const ct=document.querySelector('#ct');if(ct)ct.textContent=fmt(p);
    const dur=document.querySelector('#dur');if(dur&&d>0)dur.textContent=fmt(d);
    const prog=document.querySelector('#prog');if(prog&&d>0)prog.value=String(Math.round(Math.max(0,Math.min(1,p/d))*1000));
    const mini=document.querySelector('#v45MiniProgress');if(mini&&d>0)mini.value=String(Math.round(Math.max(0,Math.min(1,p/d))*1000));
    let badge=document.querySelector('#audifyNativeBadge');
    if(!badge){
      const copy=document.querySelector('.copy,.track-copy');
      if(copy){badge=document.createElement('div');badge.id='audifyNativeBadge';badge.style.cssText='margin-top:9px;font-size:12px;opacity:.72';copy.appendChild(badge)}
    }
    if(badge){
      if(n.error)badge.textContent='Native • erreur de lecture';
      else if(loading)badge.textContent='Native • préparation YouTube…';
      else badge.textContent='Native • ExoPlayer arrière-plan';
    }
  }

  function poll(){
    const t=track();
    if(t&&t.id&&String(t.id)!==lastTrackId)startNative(t);
    if(nativeMode)pauseYoutube();
    syncUi();
  }

  document.addEventListener('click',e=>{
    if(!nativeMode)return;
    const target=e.target&&e.target.closest?e.target.closest('button'):null;
    if(!target)return;
    const bridge=window.AudifyNative;if(!bridge)return;
    if(target.id==='play'){
      e.preventDefault();e.stopImmediatePropagation();
      const n=readNative();try{n&&n.playing?bridge.pause():bridge.resume()}catch{}
      setTimeout(syncUi,100);
    }
  },true);

  document.addEventListener('input',e=>{
    if(!nativeMode||!e.target)return;
    if(e.target.id!=='prog'&&e.target.id!=='v45MiniProgress')return;
    const bridge=window.AudifyNative;const n=readNative();
    if(!bridge||!n||!(Number(n.duration)>0))return;
    e.stopImmediatePropagation();e.preventDefault();
    const ratio=Number(e.target.value||0)/1000;
    try{bridge.seekTo(Math.max(0,Number(n.duration)*ratio))}catch{}
  },true);

  window.AudifyNativeControl={
    play(){try{window.AudifyNative&&window.AudifyNative.resume()}catch{}},
    pause(){try{window.AudifyNative&&window.AudifyNative.pause()}catch{}},
    next(){try{if(typeof nextTrack==='function')nextTrack()}catch{}},
    previous(){try{if(typeof prevTrack==='function')prevTrack()}catch{}}
  };

  document.addEventListener('visibilitychange',()=>{if(nativeMode)pauseYoutube()});
  setInterval(poll,300);
  setTimeout(poll,900);
})();
