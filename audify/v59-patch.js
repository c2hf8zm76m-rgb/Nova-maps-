(()=>{
  'use strict';
  const KEY='audify_position_v59';
  let lastTrackId='',hiddenSnapshot=null,resumeGuardUntil=0,lastGoodTime=0,lastGoodWall=0,lastPlaying=false;
  const now=()=>Date.now();
  const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const cur=()=>state()?.current||null;
  const player=()=>{const s=state();return s?.ready&&s?.p?s.p:null};
  const fmtLocal=n=>{n=Math.max(0,Math.floor(Number(n)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};

  function read(){try{const x=JSON.parse(sessionStorage.getItem(KEY)||'null');return x&&typeof x==='object'?x:null}catch{return null}}
  function write(x){try{sessionStorage.setItem(KEY,JSON.stringify(x))}catch{}}
  function playerState(){try{return player()?.getPlayerState?.()}catch{return -1}}
  function duration(){try{return Number(player()?.getDuration?.()||0)}catch{return 0}}
  function actualTime(){try{return Number(player()?.getCurrentTime?.()||0)}catch{return 0}}

  function setUI(t){
    const d=duration();
    const ct=document.querySelector('#ct'),dur=document.querySelector('#dur'),prog=document.querySelector('#prog');
    if(ct)ct.textContent=fmtLocal(t);if(dur&&d)dur.textContent=fmtLocal(d);if(prog&&d)prog.value=String(Math.max(0,Math.min(1000,Math.round(t/d*1000))));
    const miniProg=document.querySelector('#v45MiniProgress');
    if(miniProg&&d)miniProg.value=String(Math.max(0,Math.min(1000,Math.round(t/d*1000))));
  }

  function snapshot(force=false){
    const t=cur(),p=player();if(!t?.id||!p)return null;
    let a=actualTime();const ps=playerState(),playing=ps===1||ps===3;
    const old=read();
    if(!force&&a<.4&&old?.id===t.id&&Number(old.time)>2)a=Number(old.time);
    const snap={id:t.id,time:Math.max(0,a),wall:now(),playing,duration:duration()||Number(old?.duration||0)};
    write(snap);lastGoodTime=snap.time;lastGoodWall=snap.wall;lastPlaying=playing;return snap;
  }

  function expectedFrom(snap){
    if(!snap)return 0;
    let t=Number(snap.time)||0;
    if(snap.playing)t+=(now()-(Number(snap.wall)||now()))/1000;
    const d=Number(snap.duration)||duration();
    if(d>0)t=Math.min(t,Math.max(0,d-.35));
    return Math.max(0,t);
  }

  function rememberSeek(range){
    const t=cur(),d=duration();if(!t?.id||!d)return;
    const target=d*(Number(range.value||0)/1000);
    const s={id:t.id,time:target,wall:now(),playing:playerState()===1,duration:d};write(s);lastGoodTime=target;lastGoodWall=s.wall;
  }

  async function restore(reason='resume'){
    const t=cur(),p=player();if(!t?.id||!p)return;
    const snap=hiddenSnapshot?.id===t.id?hiddenSnapshot:read();
    if(!snap||snap.id!==t.id||Number(snap.time)<1)return;
    const target=expectedFrom(snap);const d=duration()||Number(snap.duration)||0;
    if(d>0&&target>=d-1)return;
    resumeGuardUntil=now()+3800;
    setUI(target);
    const delays=[180,520,1000,1700];
    for(const ms of delays){
      await new Promise(r=>setTimeout(r,ms-(delays[delays.indexOf(ms)-1]||0)));
      if(cur()?.id!==snap.id)return;
      const a=actualTime();
      if(a>=target-2||a>3){lastGoodTime=a;lastGoodWall=now();setUI(a);snapshot(true);return}
    }
    const a=actualTime();
    if((a<2.2||target-a>4)&&target>2){
      try{p.seekTo(target,true);if(snap.playing)p.playVideo()}catch{}
      setUI(target);lastGoodTime=target;lastGoodWall=now();
      setTimeout(()=>snapshot(true),500);
    }
  }

  function onHidden(){hiddenSnapshot=snapshot(true)||read()}
  function onVisible(){setTimeout(()=>restore('visible'),120)}

  function tick(){
    const t=cur();if(!t?.id)return;
    if(t.id!==lastTrackId){lastTrackId=t.id;hiddenSnapshot=null;lastGoodTime=0;lastGoodWall=now();snapshot(true);return}
    if(document.hidden)return;
    const a=actualTime(),ps=playerState(),playing=ps===1||ps===3;
    if(a>.35){lastGoodTime=a;lastGoodWall=now();lastPlaying=playing;snapshot(true);setUI(a);return}
    if(now()<resumeGuardUntil&&lastGoodTime>1){
      const projected=lastGoodTime+(lastPlaying?(now()-lastGoodWall)/1000:0);setUI(projected);
    }
  }

  function bindRanges(){
    ['#prog','#v45MiniProgress'].forEach(sel=>{const el=document.querySelector(sel);if(el&&el.dataset.v59Bound!=='1'){el.dataset.v59Bound='1';el.addEventListener('input',()=>rememberSeek(el),{passive:true});el.addEventListener('change',()=>rememberSeek(el),{passive:true})}})
  }
  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v59.js',{scope:'./'}).catch(()=>{})}
  function boot(){registerSW();bindRanges();setInterval(()=>{bindRanges();tick()},260);document.addEventListener('visibilitychange',()=>{document.hidden?onHidden():onVisible()});window.addEventListener('pagehide',onHidden);window.addEventListener('pageshow',()=>setTimeout(()=>restore('pageshow'),160));window.addEventListener('focus',()=>setTimeout(()=>restore('focus'),220));document.addEventListener('freeze',onHidden);document.addEventListener('resume',()=>setTimeout(()=>restore('resume'),160));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();