(()=>{
  'use strict';
  const API='https://api.audius.co/v1';
  const KEY_STORE='audify_audius_api_key_v61';
  let audio=null,mode='youtube',candidate=null,resolving=0,lastTrackId='',basePlayTrack=null,baseNext=null,basePrev=null,lastMediaPush=0;
  const qs=s=>document.querySelector(s);
  const st=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const cur=()=>st()?.current||null;
  const yt=()=>{const s=st();return s?.ready&&s?.p?s.p:null};
  const apiKey=()=>{try{return localStorage.getItem(KEY_STORE)||''}catch{return ''}};
  const ytime=()=>{try{return Number(yt()?.getCurrentTime?.()||0)}catch{return 0}};
  const ydur=()=>{try{return Number(yt()?.getDuration?.()||0)}catch{return 0}};
  const fmt=n=>{n=Math.max(0,Math.floor(Number(n)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};

  function ensureAudio(){
    if(audio)return audio;
    audio=document.createElement('audio');
    audio.id='audifyV61Audio';audio.preload='auto';audio.setAttribute('playsinline','');audio.style.display='none';
    document.body.appendChild(audio);
    audio.addEventListener('play',()=>{if(mode==='audio'){syncButton();setSessionState('playing')}});
    audio.addEventListener('pause',()=>{if(mode==='audio'){syncButton();setSessionState('paused')}});
    audio.addEventListener('ended',()=>{if(mode==='audio'){try{nextTrack()}catch{}}});
    audio.addEventListener('error',()=>{if(mode==='audio')fallbackYouTube('Flux audio indisponible')});
    return audio;
  }

  function ensureBadge(){
    let b=qs('#v61SourceBadge');if(b)return b;
    const copy=qs('.copy,.track-copy');if(!copy)return null;
    b=document.createElement('div');b.id='v61SourceBadge';b.innerHTML='<span class="dot"></span><span class="txt">YouTube</span>';copy.appendChild(b);return b;
  }
  function badge(text,m='youtube'){const b=ensureBadge();if(!b)return;b.dataset.mode=m;b.querySelector('.txt').textContent=text}

  function clean(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(official|music|video|audio|lyrics?|lyric|hd|hq|4k|visualizer|remaster(?:ed)?|live|version|clip|topic)\b/g,' ').replace(/\b(feat|ft)\.?\s+[^\-–—|]+/g,' ').replace(/[^a-z0-9]+/g,' ').trim()}
  function tokens(v){return new Set(clean(v).split(/\s+/).filter(x=>x.length>1))}
  function overlap(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return n/Math.max(A.size,B.size)}
  function score(item,t){
    const title=overlap(item?.title,t?.title),artist=overlap(item?.user?.name||item?.artist,t?.artist);
    let durationScore=.5;const yd=ydur(),ad=Number(item?.duration||0);if(yd>10&&ad>10){const diff=Math.abs(yd-ad);durationScore=Math.max(0,1-diff/Math.max(yd,ad,1));}
    const exactTitle=clean(item?.title)===clean(t?.title)?1:0;
    return title*.52+artist*.28+durationScore*.15+exactTitle*.05;
  }

  async function searchAudius(t,seq){
    const q=[t.artist,t.title].filter(Boolean).join(' ').slice(0,180);if(!q)return null;
    const u=new URL(API+'/tracks/search');u.searchParams.set('query',q);u.searchParams.set('limit','10');u.searchParams.set('app_name','Audify');
    const headers={accept:'application/json'};const k=apiKey();if(k)headers['x-api-key']=k;
    const r=await fetch(u.toString(),{headers,cache:'no-store'});if(seq!==resolving)return null;if(!r.ok)throw new Error('Audius HTTP '+r.status);
    const j=await r.json();const arr=Array.isArray(j?.data)?j.data:Array.isArray(j)?j:[];
    let best=null,bestScore=0;for(const x of arr){if(x?.access&&x.access.stream===false)continue;const s=score(x,t);if(s>bestScore){bestScore=s;best=x}}
    return best&&bestScore>=.56?{track:best,score:bestScore}:null;
  }

  function streamUrl(id){const u=new URL(API+'/tracks/'+encodeURIComponent(id)+'/stream');u.searchParams.set('app_name','Audify');const k=apiKey();if(k)u.searchParams.set('api_key',k);return u.toString()}

  async function activateAudio(match,seq){
    if(seq!==resolving||!match?.track?.id)return false;
    const a=ensureAudio(),t=cur();candidate=match.track;
    badge('Audius • préparation…','audio');
    a.src=streamUrl(match.track.id);a.load();
    const seek=ytime();
    const ready=new Promise((resolve,reject)=>{const ok=()=>{cleanup();resolve()};const bad=()=>{cleanup();reject(new Error('audio load'))};const cleanup=()=>{a.removeEventListener('loadedmetadata',ok);a.removeEventListener('canplay',ok);a.removeEventListener('error',bad)};a.addEventListener('loadedmetadata',ok,{once:true});a.addEventListener('canplay',ok,{once:true});a.addEventListener('error',bad,{once:true});setTimeout(()=>{cleanup();resolve()},4000)});
    await ready;if(seq!==resolving)return false;
    if(Number.isFinite(seek)&&seek>0&&Number.isFinite(a.duration)&&a.duration>seek+1){try{a.currentTime=seek}catch{}}
    try{yt()?.pauseVideo?.()}catch{}
    mode='audio';
    try{await a.play()}catch(e){mode='youtube';candidate=null;badge('YouTube • audio BG bloqué','youtube');try{yt()?.playVideo?.()}catch{};return false}
    badge('Audius • audio arrière-plan','audio');setMetadata();bindMediaActions();syncButton();return true;
  }

  async function resolveCurrent(){
    const t=cur();if(!t?.id)return;const seq=++resolving;lastTrackId=t.id;mode='youtube';candidate=null;const a=ensureAudio();try{a.pause();a.removeAttribute('src');a.load()}catch{}
    badge('YouTube • recherche audio BG…','youtube');
    try{const m=await searchAudius(t,seq);if(seq!==resolving)return;if(m)await activateAudio(m,seq);else badge('YouTube • pas d’équivalent BG','youtube')}catch(e){if(seq===resolving)badge('YouTube • source BG indisponible','youtube')}
  }

  function fallbackYouTube(reason){
    if(mode!=='audio')return;const was=!audio.paused;const pos=audio.currentTime||0;mode='youtube';candidate=null;try{audio.pause()}catch{};badge('YouTube • '+reason,'youtube');
    try{const p=yt();if(p){if(pos>0)p.seekTo(pos,true);if(was)p.playVideo()}}catch{};syncButton();setMetadata();
  }

  function syncButton(){const b=qs('#play');if(!b)return;if(mode==='audio')b.textContent=audio&&!audio.paused?'❚❚':'▶'}
  function setUI(){if(mode!=='audio'||!audio)return;const d=Number(audio.duration||0),p=Number(audio.currentTime||0);const ct=qs('#ct'),dur=qs('#dur'),prog=qs('#prog'),mini=qs('#v45MiniProgress');if(ct)ct.textContent=fmt(p);if(dur&&d)dur.textContent=fmt(d);if(prog&&d)prog.value=String(Math.round(Math.max(0,Math.min(1,p/d))*1000));if(mini&&d)mini.value=String(Math.round(Math.max(0,Math.min(1,p/d))*1000));syncButton();pushPosition()}

  function setSessionState(v){if('mediaSession' in navigator)try{navigator.mediaSession.playbackState=v}catch{}}
  function setMetadata(){if(!('mediaSession' in navigator)||typeof MediaMetadata==='undefined')return;const t=cur();if(!t)return;try{navigator.mediaSession.metadata=new MediaMetadata({title:t.title||candidate?.title||'Audify',artist:t.artist||candidate?.user?.name||'Audify',album:mode==='audio'?'Audify • Audius':'Audify • YouTube',artwork:t.thumbnail?[{src:t.thumbnail}]:[]})}catch{}}
  function pushPosition(force=false){if(mode!=='audio'||!audio||!('mediaSession' in navigator)||typeof navigator.mediaSession.setPositionState!=='function')return;if(!force&&Date.now()-lastMediaPush<700)return;const d=Number(audio.duration||0),p=Number(audio.currentTime||0);if(!(d>0))return;lastMediaPush=Date.now();try{navigator.mediaSession.setPositionState({duration:d,playbackRate:audio.playbackRate||1,position:Math.max(0,Math.min(p,d-.05))})}catch{}}
  function bindMediaActions(){if(!('mediaSession' in navigator))return;const bind=(n,f)=>{try{navigator.mediaSession.setActionHandler(n,f)}catch{}};bind('play',()=>{if(mode==='audio')audio.play().catch(()=>{});else tryPlayYT()});bind('pause',()=>{if(mode==='audio')audio.pause();else tryPauseYT()});bind('stop',()=>{if(mode==='audio')audio.pause();else tryPauseYT()});bind('seekto',d=>{if(mode==='audio'&&typeof d.seekTime==='number')audio.currentTime=Math.max(0,Math.min(d.seekTime,(audio.duration||d.seekTime)-.05))});bind('seekbackward',d=>{if(mode==='audio')audio.currentTime=Math.max(0,audio.currentTime-(Number(d.seekOffset)||10))});bind('seekforward',d=>{if(mode==='audio')audio.currentTime=Math.min((audio.duration||Infinity)-.05,audio.currentTime+(Number(d.seekOffset)||10))});bind('previoustrack',()=>{try{prevTrack()}catch{}});bind('nexttrack',()=>{try{nextTrack()}catch{}})}
  function tryPlayYT(){try{yt()?.playVideo?.()}catch{}}function tryPauseYT(){try{yt()?.pauseVideo?.()}catch{}}

  function interceptControls(){
    const play=qs('#play');if(play&&play.dataset.v61!=='1'){play.dataset.v61='1';const old=play.onclick;play.onclick=e=>{if(mode==='audio'){e?.preventDefault?.();audio.paused?audio.play().catch(()=>{}):audio.pause();return}old?.call(play,e)}}
    const prog=qs('#prog');if(prog&&prog.dataset.v61!=='1'){prog.dataset.v61='1';const seek=e=>{if(mode!=='audio'||!audio||!(audio.duration>0))return;e.stopImmediatePropagation();e.preventDefault();audio.currentTime=audio.duration*(Number(prog.value||0)/1000);pushPosition(true)};prog.addEventListener('input',seek,true);prog.addEventListener('change',seek,true)}
  }

  function wrapNavigation(){
    if(typeof playTrack==='function'&&!basePlayTrack){basePlayTrack=playTrack;playTrack=function(t,i=-1){if(audio){try{audio.pause();audio.removeAttribute('src');audio.load()}catch{}}mode='youtube';candidate=null;const out=basePlayTrack(t,i);setTimeout(resolveCurrent,250);return out}}
    if(typeof nextTrack==='function'&&!baseNext){baseNext=nextTrack;nextTrack=function(){if(audio)try{audio.pause()}catch{};mode='youtube';candidate=null;return baseNext()}}
    if(typeof prevTrack==='function'&&!basePrev){basePrev=prevTrack;prevTrack=function(){if(audio)try{audio.pause()}catch{};mode='youtube';candidate=null;return basePrev()}}
  }

  function primeAudio(){const a=ensureAudio();if(a.dataset.primed==='1')return;a.dataset.primed='1';try{a.muted=true;a.src='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';const p=a.play();if(p&&p.then)p.then(()=>{a.pause();a.removeAttribute('src');a.load();a.muted=false}).catch(()=>{a.muted=false})}catch{a.muted=false}}

  function boot(){
    ensureAudio();ensureBadge();wrapNavigation();interceptControls();bindMediaActions();
    document.addEventListener('pointerdown',primeAudio,{once:true,capture:true});document.addEventListener('touchstart',primeAudio,{once:true,capture:true});
    setInterval(()=>{wrapNavigation();interceptControls();const t=cur();if(t?.id&&t.id!==lastTrackId)setTimeout(resolveCurrent,100);if(mode==='audio')setUI()},260);
    document.addEventListener('visibilitychange',()=>{if(mode==='audio'){setMetadata();pushPosition(true)}});
    window.addEventListener('pageshow',()=>{if(mode==='audio'){setMetadata();bindMediaActions();setUI()}});
  }

  window.AudifyV61={
    get mode(){return mode},get candidate(){return candidate},
    setAudiusApiKey(k){try{localStorage.setItem(KEY_STORE,String(k||''))}catch{};resolveCurrent()},
    clearAudiusApiKey(){try{localStorage.removeItem(KEY_STORE)}catch{};resolveCurrent()},
    retry(){resolveCurrent()}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
