(()=>{
  'use strict';
  const WANT_KEY='audify_bg_wanted_v60';
  let wanted=false,lastTrackId='',lastMediaState='',lastPositionPush=0,hideSeq=0;
  const now=()=>Date.now();
  const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const track=()=>state()?.current||null;
  const player=()=>{const s=state();return s?.ready&&s?.p?s.p:null};
  const pstate=()=>{try{return Number(player()?.getPlayerState?.())}catch{return -1}};
  const ptime=()=>{try{return Number(player()?.getCurrentTime?.()||0)}catch{return 0}};
  const pdur=()=>{try{return Number(player()?.getDuration?.()||0)}catch{return 0}};
  const rememberWanted=v=>{wanted=!!v;try{sessionStorage.setItem(WANT_KEY,wanted?'1':'0')}catch{};syncPlaybackState()};

  function syncPlaybackState(){
    if(!('mediaSession' in navigator))return;
    const s=wanted?'playing':'paused';
    if(s===lastMediaState)return;
    lastMediaState=s;try{navigator.mediaSession.playbackState=s}catch{}
  }

  function setMetadata(){
    if(!('mediaSession' in navigator)||typeof MediaMetadata==='undefined')return;
    const t=track();if(!t?.id)return;
    try{navigator.mediaSession.metadata=new MediaMetadata({title:t.title||'Audify',artist:t.artist||'YouTube',album:'Audify',artwork:t.thumbnail?[{src:t.thumbnail}]:[]})}catch{}
  }

  function pushPosition(force=false){
    if(!('mediaSession' in navigator)||typeof navigator.mediaSession.setPositionState!=='function')return;
    if(!force&&now()-lastPositionPush<650)return;
    const d=pdur(),p=ptime();if(!(d>0)||!Number.isFinite(p))return;
    lastPositionPush=now();
    try{navigator.mediaSession.setPositionState({duration:d,playbackRate:1,position:Math.max(0,Math.min(p,d-.05))})}catch{}
  }

  function safePlay(){
    if(!wanted)return;
    const p=player();if(!p||!track())return;
    const s=pstate();if(s===1||s===3)return;
    try{p.playVideo()}catch{}
  }
  function safePause(){const p=player();if(!p)return;try{p.pauseVideo()}catch{}}
  function seekTo(sec){const p=player(),d=pdur();if(!p||!(d>0))return;const v=Math.max(0,Math.min(Number(sec)||0,d-.05));try{p.seekTo(v,true)}catch{};setTimeout(()=>pushPosition(true),120)}

  function bindMediaActions(){
    if(!('mediaSession' in navigator))return;
    const bind=(name,fn)=>{try{navigator.mediaSession.setActionHandler(name,fn)}catch{}};
    bind('play',()=>{rememberWanted(true);safePlay()});
    bind('pause',()=>{rememberWanted(false);safePause()});
    bind('stop',()=>{rememberWanted(false);safePause()});
    bind('seekto',d=>{if(typeof d.seekTime==='number')seekTo(d.seekTime)});
    bind('seekbackward',d=>seekTo(ptime()-(Number(d.seekOffset)||10)));
    bind('seekforward',d=>seekTo(ptime()+(Number(d.seekOffset)||10)));
    bind('previoustrack',()=>{rememberWanted(true);try{if(typeof prevTrack==='function')prevTrack()}catch{}});
    bind('nexttrack',()=>{rememberWanted(true);try{if(typeof nextTrack==='function')nextTrack()}catch{}});
  }

  function strengthenIframe(){
    const f=document.querySelector('iframe#yt,#yt iframe');if(!f)return;
    const old=f.getAttribute('allow')||'';
    const vals=new Set(old.split(';').map(x=>x.trim()).filter(Boolean));['autoplay','encrypted-media','picture-in-picture'].forEach(x=>vals.add(x));
    f.setAttribute('allow',[...vals].join('; '));f.setAttribute('playsinline','');f.setAttribute('allowfullscreen','');
  }

  function backgroundKick(){
    const seq=++hideSeq;if(!wanted)return;
    safePlay();
    [120,360,900,1800].forEach(ms=>setTimeout(()=>{if(seq===hideSeq&&document.hidden&&wanted)safePlay()},ms));
  }

  function onVisibility(){
    if(document.hidden){
      const s=pstate();rememberWanted(s===1||s===3||wanted);pushPosition(true);backgroundKick();
    }else{
      hideSeq++;setTimeout(()=>{if(wanted)safePlay();pushPosition(true)},120);
    }
  }

  function sync(){
    strengthenIframe();
    const t=track();if(!t?.id)return;
    if(t.id!==lastTrackId){lastTrackId=t.id;setMetadata();setTimeout(()=>pushPosition(true),450)}
    const s=pstate();
    if(!document.hidden){
      if(s===1||s===3)rememberWanted(true);
      else if(s===2)rememberWanted(false);
    }else if(wanted&&(s===2||s===5||s===-1))safePlay();
    syncPlaybackState();pushPosition(false);
  }

  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v60.js',{scope:'./'}).catch(()=>{})}
  function boot(){
    try{wanted=sessionStorage.getItem(WANT_KEY)==='1'}catch{}
    registerSW();bindMediaActions();sync();
    document.addEventListener('visibilitychange',onVisibility);
    window.addEventListener('pagehide',()=>{pushPosition(true);if(wanted)backgroundKick()});
    window.addEventListener('pageshow',()=>setTimeout(()=>{if(wanted)safePlay();sync()},140));
    window.addEventListener('focus',()=>setTimeout(()=>{if(wanted)safePlay();sync()},180));
    setInterval(sync,420);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
