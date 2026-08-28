(()=>{
  'use strict';
  let lastTrackId='',handlersReady=false,lastPositionAt=0;
  const hasMS=()=>('mediaSession' in navigator)&&('MediaMetadata' in window);
  const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const current=()=>state()?.current||null;
  const player=()=>{const s=state();return s?.ready&&s?.p?s.p:null};
  const pstate=()=>{try{return player()?.getPlayerState?.()}catch{return -1}};
  const duration=()=>{try{return Number(player()?.getDuration?.()||0)}catch{return 0}};
  const time=()=>{try{return Number(player()?.getCurrentTime?.()||0)}catch{return 0}};

  function safeAction(name,fn){
    try{navigator.mediaSession.setActionHandler(name,fn)}catch{}
  }

  function bindHandlers(){
    if(!hasMS()||handlersReady)return;
    handlersReady=true;
    safeAction('play',()=>{try{player()?.playVideo?.()}catch{}});
    safeAction('pause',()=>{try{player()?.pauseVideo?.()}catch{}});
    safeAction('previoustrack',()=>{try{if(typeof prevTrack==='function')prevTrack();else if(typeof window.prevTrack==='function')window.prevTrack()}catch{}});
    safeAction('nexttrack',()=>{try{if(typeof nextTrack==='function')nextTrack();else if(typeof window.nextTrack==='function')window.nextTrack()}catch{}});
    safeAction('seekbackward',details=>{const p=player();if(!p)return;const step=Number(details?.seekOffset)||10;try{p.seekTo(Math.max(0,time()-step),true)}catch{}});
    safeAction('seekforward',details=>{const p=player();if(!p)return;const d=duration(),step=Number(details?.seekOffset)||10;try{p.seekTo(d?Math.min(d-.1,time()+step):time()+step,true)}catch{}});
    safeAction('seekto',details=>{const p=player();if(!p||!Number.isFinite(Number(details?.seekTime)))return;const d=duration(),target=Math.max(0,d?Math.min(d-.1,Number(details.seekTime)):Number(details.seekTime));try{p.seekTo(target,true)}catch{}});
    safeAction('stop',()=>{try{player()?.pauseVideo?.()}catch{}});
  }

  function artwork(t){
    const src=String(t?.thumbnail||'').trim();
    if(!src)return [];
    return [
      {src,sizes:'512x512'},
      {src,sizes:'256x256'},
      {src,sizes:'128x128'}
    ];
  }

  function syncMetadata(){
    if(!hasMS())return;
    const t=current();if(!t?.id)return;
    if(t.id===lastTrackId)return;
    lastTrackId=t.id;
    try{
      navigator.mediaSession.metadata=new MediaMetadata({
        title:t.title||'Audify',
        artist:t.artist||'YouTube',
        album:'Audify',
        artwork:artwork(t)
      });
    }catch{}
  }

  function syncPlaybackState(){
    if(!hasMS())return;
    const ps=pstate();
    try{
      navigator.mediaSession.playbackState=ps===1?'playing':(ps===2?'paused':'none');
    }catch{}
  }

  function syncPosition(force=false){
    if(!hasMS()||typeof navigator.mediaSession.setPositionState!=='function')return;
    const n=Date.now();if(!force&&n-lastPositionAt<700)return;lastPositionAt=n;
    const d=duration(),pos=time();
    if(!(d>0)||!Number.isFinite(pos)||pos<0)return;
    const safePos=Math.min(Math.max(0,pos),Math.max(0,d-.01));
    try{navigator.mediaSession.setPositionState({duration:d,playbackRate:1,position:safePos})}catch{}
  }

  function sync(){
    if(!hasMS())return;
    bindHandlers();syncMetadata();syncPlaybackState();syncPosition(false);
  }

  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v60.js',{scope:'./'}).catch(()=>{})}
  function boot(){
    registerSW();bindHandlers();sync();setInterval(sync,450);
    document.addEventListener('visibilitychange',()=>{syncMetadata();syncPlaybackState();syncPosition(true)});
    window.addEventListener('pageshow',()=>setTimeout(()=>{syncMetadata();syncPlaybackState();syncPosition(true)},120));
    window.addEventListener('focus',()=>setTimeout(()=>{syncMetadata();syncPlaybackState();syncPosition(true)},160));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();