(()=>{
  'use strict';
  const AUDIUS='https://api.audius.co/v1';
  const JAMENDO='https://api.jamendo.com/v3.0';
  const JAM_KEY='audify_jamendo_client_id_v62';
  let audio=null,mode='youtube',source='youtube',candidate=null,resolving=0,lastTrackId='',basePlayTrack=null,baseNext=null,basePrev=null,lastMediaPush=0;
  const qs=s=>document.querySelector(s);
  const st=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
  const cur=()=>st()?.current||null;
  const yt=()=>{const s=st();return s?.ready&&s?.p?s.p:null};
  const ytime=()=>{try{return Number(yt()?.getCurrentTime?.()||0)}catch{return 0}};
  const ydur=()=>{try{return Number(yt()?.getDuration?.()||0)}catch{return 0}};
  const fmt=n=>{n=Math.max(0,Math.floor(Number(n)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
  const jamendoId=()=>{try{return localStorage.getItem(JAM_KEY)||''}catch{return ''}};

  function ensureAudio(){
    if(audio)return audio;
    audio=document.createElement('audio');
    audio.id='audifyV62Audio';audio.preload='auto';audio.setAttribute('playsinline','');audio.style.display='none';
    document.body.appendChild(audio);
    audio.addEventListener('play',()=>{if(mode==='audio'){syncButton();setSessionState('playing')}});
    audio.addEventListener('pause',()=>{if(mode==='audio'){syncButton();setSessionState('paused')}});
    audio.addEventListener('ended',()=>{if(mode==='audio'){try{nextTrack()}catch{}}});
    audio.addEventListener('error',()=>{if(mode==='audio')fallbackYouTube('flux indisponible')});
    return audio;
  }

  function ensureBadge(){
    let b=qs('#v62SourceBadge');if(b)return b;
    const old=qs('#v61SourceBadge');if(old)old.remove();
    const copy=qs('.copy,.track-copy');if(!copy)return null;
    b=document.createElement('button');b.id='v62SourceBadge';b.type='button';b.innerHTML='<span class="dot"></span><span class="txt">YouTube</span>';copy.appendChild(b);
    b.addEventListener('click',configureSources);
    return b;
  }
  function badge(text,m='youtube'){const b=ensureBadge();if(!b)return;b.dataset.mode=m;b.querySelector('.txt').textContent=text}

  function clean(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(official|music|video|audio|lyrics?|lyric|hd|hq|4k|visualizer|remaster(?:ed)?|live|version|clip|topic)\b/g,' ').replace(/\b(feat|ft)\.?\s+[^\-–—|]+/g,' ').replace(/[^a-z0-9]+/g,' ').trim()}
  function tokens(v){return new Set(clean(v).split(/\s+/).filter(x=>x.length>1))}
  function overlap(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return n/Math.max(A.size,B.size)}
  function scoreCandidate(title,artist,duration,t){
    const ts=overlap(title,t?.title),as=overlap(artist,t?.artist);
    if(ts<.45)return 0;
    let ds=.5;const yd=ydur(),ad=Number(duration||0);if(yd>10&&ad>10){const diff=Math.abs(yd-ad);ds=Math.max(0,1-diff/Math.max(yd,ad,1));}
    const exact=clean(title)===clean(t?.title)?1:0;
    return ts*.56+as*.26+ds*.13+exact*.05;
  }

  async function searchAudius(t,seq){
    badge('Recherche Audius…','search');
    const q=[t.artist,t.title].filter(Boolean).join(' ').slice(0,180);if(!q)return null;
    const u=new URL(AUDIUS+'/tracks/search');u.searchParams.set('query',q);u.searchParams.set('limit','10');u.searchParams.set('app_name','Audify');
    const r=await fetch(u.toString(),{headers:{accept:'application/json'},cache:'no-store'});if(seq!==resolving)return null;if(!r.ok)return null;
    const j=await r.json();const arr=Array.isArray(j?.data)?j.data:Array.isArray(j)?j:[];
    let best=null,bestScore=0;for(const x of arr){if(x?.access&&x.access.stream===false)continue;const s=scoreCandidate(x?.title,x?.user?.name||x?.artist,x?.duration,t);if(s>bestScore){bestScore=s;best=x}}
    if(!best||bestScore<.62)return null;
    const u2=new URL(AUDIUS+'/tracks/'+encodeURIComponent(best.id)+'/stream');u2.searchParams.set('app_name','Audify');
    return {source:'Audius',url:u2.toString(),title:best.title,artist:best?.user?.name||'',duration:best.duration,score:bestScore};
  }

  async function searchJamendo(t,seq){
    const id=jamendoId();if(!id)return null;
    badge('Recherche Jamendo…','search');
    const q=[t.artist,t.title].filter(Boolean).join(' ').slice(0,160);if(!q)return null;
    const u=new URL(JAMENDO+'/tracks/');u.searchParams.set('client_id',id);u.searchParams.set('format','json');u.searchParams.set('limit','15');u.searchParams.set('search',q);u.searchParams.set('type','single albumtrack');u.searchParams.set('audioformat','mp32');
    const r=await fetch(u.toString(),{headers:{accept:'application/json'},cache:'no-store'});if(seq!==resolving)return null;if(!r.ok)return null;
    const j=await r.json();const arr=Array.isArray(j?.results)?j.results:[];
    let best=null,bestScore=0;for(const x of arr){if(!x?.audio)continue;const s=scoreCandidate(x.name,x.artist_name,x.duration,t);if(s>bestScore){bestScore=s;best=x}}
    if(!best||bestScore<.64)return null;
    return {source:'Jamendo',url:best.audio,title:best.name,artist:best.artist_name,duration:best.duration,score:bestScore};
  }

  function iaQuery(t){
    const words=[clean(t?.artist),clean(t?.title)].filter(Boolean).join(' ').split(/\s+/).filter(Boolean).slice(0,8);
    return 'mediatype:audio AND '+words.map(w=>'('+w+')').join(' AND ');
  }
  function pickArchiveFile(meta,t){
    const itemTitle=meta?.metadata?.title||'',creator=meta?.metadata?.creator||'';let best=null,bestScore=0;
    for(const f of (meta?.files||[])){
      const name=String(f?.name||'');if(!/\.(mp3|m4a|ogg)$/i.test(name))continue;
      if(/(sample|preview|cover|spectrogram|thumb)/i.test(name))continue;
      const title=(f?.title||name.replace(/\.[^.]+$/,''));const duration=Number(f?.length||0);const s=scoreCandidate(title+' '+itemTitle,creator,duration,t);
      if(s>bestScore){bestScore=s;best=f}
    }
    return best&&bestScore>=.72?{file:best,score:bestScore}:null;
  }
  async function searchArchive(t,seq){
    badge('Recherche Archive.org…','search');
    const u=new URL('https://archive.org/advancedsearch.php');u.searchParams.set('q',iaQuery(t));u.searchParams.append('fl[]','identifier');u.searchParams.append('fl[]','title');u.searchParams.append('fl[]','creator');u.searchParams.set('rows','6');u.searchParams.set('page','1');u.searchParams.set('output','json');
    const r=await fetch(u.toString(),{cache:'no-store'});if(seq!==resolving)return null;if(!r.ok)return null;
    const j=await r.json();const docs=Array.isArray(j?.response?.docs)?j.response.docs:[];
    for(const d of docs.slice(0,5)){
      if(seq!==resolving)return null;
      const mr=await fetch('https://archive.org/metadata/'+encodeURIComponent(d.identifier),{cache:'no-store'});if(!mr.ok)continue;const m=await mr.json();const p=pickArchiveFile(m,t);if(!p)continue;
      const fileName=p.file.name;const url='https://archive.org/download/'+encodeURIComponent(d.identifier)+'/'+fileName.split('/').map(encodeURIComponent).join('/');
      return {source:'Archive.org',url,title:p.file.title||d.title||t.title,artist:d.creator||t.artist,duration:Number(p.file.length||0),score:p.score};
    }
    return null;
  }

  async function waitPlayable(a,timeout=5500){
    if(a.readyState>=2)return true;
    return await new Promise(resolve=>{let done=false;const finish=v=>{if(done)return;done=true;cleanup();resolve(v)};const ok=()=>finish(true),bad=()=>finish(false);const cleanup=()=>{a.removeEventListener('canplay',ok);a.removeEventListener('loadedmetadata',ok);a.removeEventListener('error',bad)};a.addEventListener('canplay',ok,{once:true});a.addEventListener('loadedmetadata',ok,{once:true});a.addEventListener('error',bad,{once:true});setTimeout(()=>finish(a.readyState>=1),timeout)});
  }
  async function activate(match,seq){
    if(seq!==resolving||!match?.url)return false;
    const a=ensureAudio(),seek=ytime();candidate=match;badge(match.source+' • préparation…','search');
    try{a.pause();a.src=match.url;a.load()}catch{return false}
    const ready=await waitPlayable(a);if(seq!==resolving||!ready)return false;
    if(seek>0&&Number.isFinite(a.duration)&&a.duration>seek+1){try{a.currentTime=seek}catch{}}
    try{await a.play()}catch{return false}
    try{yt()?.pauseVideo?.()}catch{}
    mode='audio';source=match.source;badge(match.source+' • audio arrière-plan','audio');setMetadata();bindMediaActions();syncButton();pushPosition(true);return true;
  }

  async function resolveCurrent(){
    const t=cur();if(!t?.id)return;const seq=++resolving;lastTrackId=t.id;mode='youtube';source='youtube';candidate=null;
    const a=ensureAudio();try{a.pause();a.removeAttribute('src');a.load()}catch{}
    const finders=[searchAudius,searchJamendo,searchArchive];
    for(const fn of finders){
      if(seq!==resolving)return;
      try{const m=await fn(t,seq);if(seq!==resolving)return;if(m&&await activate(m,seq))return}catch{}
    }
    if(seq===resolving){badge(jamendoId()?'YouTube • aucun audio BG trouvé':'YouTube • aucun audio BG • +Jamendo disponible','youtube');setMetadata();bindMediaActions();}
  }

  function fallbackYouTube(reason){
    if(mode!=='audio')return;const was=audio&&!audio.paused,pos=Number(audio?.currentTime||0);mode='youtube';source='youtube';candidate=null;try{audio.pause()}catch{};badge('YouTube • '+reason,'youtube');
    try{const p=yt();if(p){if(pos>0)p.seekTo(pos,true);if(was)p.playVideo()}}catch{};syncButton();setMetadata();bindMediaActions();
  }
  function syncButton(){const b=qs('#play');if(!b)return;if(mode==='audio')b.textContent=audio&&!audio.paused?'❚❚':'▶'}
  function setUI(){if(mode!=='audio'||!audio)return;const d=Number(audio.duration||0),p=Number(audio.currentTime||0);const ct=qs('#ct'),dur=qs('#dur'),prog=qs('#prog'),mini=qs('#v45MiniProgress');if(ct)ct.textContent=fmt(p);if(dur&&d)dur.textContent=fmt(d);if(prog&&d)prog.value=String(Math.round(Math.max(0,Math.min(1,p/d))*1000));if(mini&&d)mini.value=String(Math.round(Math.max(0,Math.min(1,p/d))*1000));syncButton();pushPosition()}
  function setSessionState(v){if('mediaSession' in navigator)try{navigator.mediaSession.playbackState=v}catch{}}
  function setMetadata(){if(!('mediaSession' in navigator)||typeof MediaMetadata==='undefined')return;const t=cur();if(!t)return;try{navigator.mediaSession.metadata=new MediaMetadata({title:t.title||candidate?.title||'Audify',artist:t.artist||candidate?.artist||'Audify',album:mode==='audio'?'Audify • '+source:'Audify • YouTube',artwork:t.thumbnail?[{src:t.thumbnail}]:[]})}catch{}}
  function pushPosition(force=false){if(mode!=='audio'||!audio||!('mediaSession' in navigator)||typeof navigator.mediaSession.setPositionState!=='function')return;if(!force&&Date.now()-lastMediaPush<700)return;const d=Number(audio.duration||0),p=Number(audio.currentTime||0);if(!(d>0))return;lastMediaPush=Date.now();try{navigator.mediaSession.setPositionState({duration:d,playbackRate:audio.playbackRate||1,position:Math.max(0,Math.min(p,d-.05))})}catch{}}
  function bindMediaActions(){if(!('mediaSession' in navigator))return;const bind=(n,f)=>{try{navigator.mediaSession.setActionHandler(n,f)}catch{}};bind('play',()=>{if(mode==='audio')audio.play().catch(()=>{});else try{yt()?.playVideo?.()}catch{}});bind('pause',()=>{if(mode==='audio')audio.pause();else try{yt()?.pauseVideo?.()}catch{}});bind('stop',()=>{if(mode==='audio')audio.pause();else try{yt()?.pauseVideo?.()}catch{}});bind('seekto',d=>{if(mode==='audio'&&typeof d.seekTime==='number')audio.currentTime=Math.max(0,Math.min(d.seekTime,(audio.duration||d.seekTime)-.05))});bind('seekbackward',d=>{if(mode==='audio')audio.currentTime=Math.max(0,audio.currentTime-(Number(d.seekOffset)||10))});bind('seekforward',d=>{if(mode==='audio')audio.currentTime=Math.min((audio.duration||Infinity)-.05,audio.currentTime+(Number(d.seekOffset)||10))});bind('previoustrack',()=>{try{prevTrack()}catch{}});bind('nexttrack',()=>{try{nextTrack()}catch{}})}

  function interceptControls(){
    const play=qs('#play');if(play&&play.dataset.v62!=='1'){play.dataset.v62='1';const old=play.onclick;play.onclick=e=>{if(mode==='audio'){e?.preventDefault?.();audio.paused?audio.play().catch(()=>{}):audio.pause();return}old?.call(play,e)}}
    const prog=qs('#prog');if(prog&&prog.dataset.v62!=='1'){prog.dataset.v62='1';const seek=e=>{if(mode!=='audio'||!audio||!(audio.duration>0))return;e.stopImmediatePropagation();e.preventDefault();audio.currentTime=audio.duration*(Number(prog.value||0)/1000);pushPosition(true)};prog.addEventListener('input',seek,true);prog.addEventListener('change',seek,true)}
  }
  function wrapNavigation(){
    if(typeof playTrack==='function'&&!basePlayTrack){basePlayTrack=playTrack;playTrack=function(t,i=-1){if(audio){try{audio.pause();audio.removeAttribute('src');audio.load()}catch{}}mode='youtube';source='youtube';candidate=null;const out=basePlayTrack(t,i);setTimeout(resolveCurrent,500);return out}}
    if(typeof nextTrack==='function'&&!baseNext){baseNext=nextTrack;nextTrack=function(){if(audio)try{audio.pause()}catch{};mode='youtube';source='youtube';candidate=null;return baseNext()}}
    if(typeof prevTrack==='function'&&!basePrev){basePrev=prevTrack;prevTrack=function(){if(audio)try{audio.pause()}catch{};mode='youtube';source='youtube';candidate=null;return basePrev()}}
  }
  function primeAudio(){const a=ensureAudio();if(a.dataset.primed==='1')return;a.dataset.primed='1';try{a.muted=true;a.src='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';const p=a.play();if(p&&p.then)p.then(()=>{a.pause();a.removeAttribute('src');a.load();a.muted=false}).catch(()=>{a.muted=false})}catch{a.muted=false}}
  function configureSources(){
    const old=jamendoId();const v=prompt('Jamendo Client ID (optionnel). Laisse vide pour désactiver Jamendo. Audius et Archive.org restent automatiques.',old);if(v===null)return;try{const x=String(v).trim();if(x)localStorage.setItem(JAM_KEY,x);else localStorage.removeItem(JAM_KEY)}catch{};resolveCurrent();
  }
  function boot(){ensureAudio();ensureBadge();wrapNavigation();interceptControls();bindMediaActions();document.addEventListener('pointerdown',primeAudio,{once:true,capture:true});document.addEventListener('touchstart',primeAudio,{once:true,capture:true});setInterval(()=>{wrapNavigation();interceptControls();const t=cur();if(t?.id&&t.id!==lastTrackId)setTimeout(resolveCurrent,120);if(mode==='audio')setUI()},260);document.addEventListener('visibilitychange',()=>{if(mode==='audio'){setMetadata();pushPosition(true)}});window.addEventListener('pageshow',()=>{setMetadata();bindMediaActions();if(mode==='audio')setUI()})}
  window.AudifyV62={get mode(){return mode},get source(){return source},get candidate(){return candidate},retry:resolveCurrent,configureSources};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
