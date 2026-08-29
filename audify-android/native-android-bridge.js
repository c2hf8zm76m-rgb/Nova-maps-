(()=>{
  'use strict';
  let last='';
  const getS=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const getPlayer=()=>{const s=getS();return s&&s.p?s.p:null};
  const safe=(fn,fallback)=>{try{return fn()}catch{return fallback}};

  function state(){
    const s=getS();
    const t=s&&s.current?s.current:{};
    const p=getPlayer();
    const ps=Number(safe(()=>p&&p.getPlayerState?p.getPlayerState():-1,-1));
    return {
      title:String(t.title||'Audify'),
      artist:String(t.artist||''),
      thumbnail:String(t.thumbnail||''),
      videoId:String(t.id||''),
      playing:ps===1,
      playerState:ps,
      currentTime:Number(safe(()=>p&&p.getCurrentTime?p.getCurrentTime():0,0))||0,
      duration:Number(safe(()=>p&&p.getDuration?p.getDuration():0,0))||0
    };
  }

  function push(force=false){
    const bridge=window.AudifyNative;
    if(!bridge||typeof bridge.updateState!=='function')return;
    const data=state();
    const compact=JSON.stringify(data);
    if(!force&&compact===last)return;
    last=compact;
    try{bridge.updateState(compact)}catch{}
  }

  window.AudifyNativeControl={
    play(){const p=getPlayer();try{p&&p.playVideo&&p.playVideo()}catch{};setTimeout(()=>push(true),120)},
    pause(){const p=getPlayer();try{p&&p.pauseVideo&&p.pauseVideo()}catch{};setTimeout(()=>push(true),120)},
    next(){try{if(typeof nextTrack==='function')nextTrack()}catch{};setTimeout(()=>push(true),250)},
    previous(){try{if(typeof prevTrack==='function')prevTrack()}catch{};setTimeout(()=>push(true),250)}
  };

  document.addEventListener('visibilitychange',()=>push(true));
  window.addEventListener('pageshow',()=>push(true));
  window.addEventListener('focus',()=>push(true));
  setInterval(push,500);
  setTimeout(()=>push(true),1200);
})();
