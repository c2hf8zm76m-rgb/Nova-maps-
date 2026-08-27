(()=>{
  const CACHE_KEY='audify_lyrics_cache_v36';
  const POSITIVE_TTL=1000*60*60*24*30;
  const NEGATIVE_TTL=1000*60*60*12;
  const LOOKUP_LIMIT=4400;
  const CLIENT='Audify V36 (https://raw.githack.com/c2hf8zm76m-rgb/Nova-maps-/main/audify/index-v36.html)';
  const K={trackId:null,track:null,data:null,promise:null,open:false,raf:0,lastTick:0,lineIndex:-2,domLines:[],panel:null,button:null,scroll:null,subtitle:null,source:null};

  const safeToast=t=>{try{if(typeof toast==='function')toast(t)}catch{}};
  const currentTrack=()=>{try{return typeof S!=='undefined'?S.current:null}catch{return null}};
  const playerTime=()=>{try{return typeof S!=='undefined'&&S.ready&&S.p?S.p.getCurrentTime()||0:0}catch{return 0}};
  const playerDuration=()=>{try{return typeof S!=='undefined'&&S.ready&&S.p?S.p.getDuration()||0:0}catch{return 0}};
  const decode=s=>{const e=document.createElement('textarea');e.innerHTML=String(s||'');return e.value};
  const compact=s=>String(s||'').replace(/\s+/g,' ').trim();
  const norm=s=>compact(decode(s)).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\p{L}\p{N}]+/gu,' ').trim();
  const cleanChannel=s=>compact(decode(s)).replace(/\s*vevo$/i,'').replace(/\s*-\s*topic$/i,'').replace(/\s+officiel$/i,'').replace(/\s+official$/i,'').trim();
  const cleanTitle=s=>compact(decode(s))
    .replace(/\s*[\[(](?:clip\s*)?(?:officiel|official)(?:\s*(?:video|audio|music video))?|official\s*(?:video|audio)|visuali[sz]er|lyrics?|paroles|audio|music video|4k)[^\])]*[\])]/ig,'')
    .replace(/\s*[|•]\s*(?:official|officiel|visuali[sz]er|lyrics?|audio|video).*$/ig,'')
    .replace(/\s+/g,' ').trim();

  function metadata(track){
    let title=cleanTitle(track?.title||'');
    let artist=cleanChannel(track?.artist||'');
    const parts=title.split(/\s+[-–—]\s+/).map(compact).filter(Boolean);
    if(parts.length>=2&&parts[0].length<=55){
      const guessed=parts.shift();
      title=cleanTitle(parts.join(' - '));
      if(guessed)artist=guessed;
    }
    artist=artist.replace(/\s+(?:ft\.?|feat\.?|featuring)\s+.*$/i,'').trim();
    return {title:title||cleanTitle(track?.title||''),artist:artist||cleanChannel(track?.artist||'')};
  }

  function readCache(){
    try{
      const v=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');
      return v&&typeof v==='object'?v:{};
    }catch{return {}}
  }
  function writeCache(cache){
    try{
      const entries=Object.entries(cache).sort((a,b)=>(b[1]?.at||0)-(a[1]?.at||0)).slice(0,30);
      localStorage.setItem(CACHE_KEY,JSON.stringify(Object.fromEntries(entries)));
    }catch{}
  }
  function getCached(id){
    if(!id)return null;
    const c=readCache(),item=c[id];
    if(!item)return null;
    const ttl=item.notFound?NEGATIVE_TTL:POSITIVE_TTL;
    if(Date.now()-(item.at||0)>ttl){delete c[id];writeCache(c);return null}
    return item;
  }
  function putCached(id,item){if(!id)return;const c=readCache();c[id]={...item,at:Date.now()};writeCache(c)}

  function scoreRecord(r,meta,duration){
    let s=0;
    const rt=norm(r?.trackName||r?.name),ra=norm(r?.artistName),mt=norm(meta.title),ma=norm(meta.artist);
    if(rt===mt)s+=16;else if(rt.includes(mt)||mt.includes(rt))s+=8;
    if(ra===ma)s+=10;else if(ra.includes(ma)||ma.includes(ra))s+=5;
    if(r?.syncedLyrics)s+=12;else if(r?.plainLyrics)s+=3;
    const rd=Number(r?.duration)||0;
    if(duration&&rd){const diff=Math.abs(rd-duration);if(diff<=2.5)s+=8;else if(diff<=7)s+=4;else if(diff>25)s-=4}
    return s;
  }

  async function requestLyrics(track){
    const cached=getCached(track?.id);
    if(cached)return cached.notFound?null:cached;
    const meta=metadata(track),duration=playerDuration();
    if(!meta.title){putCached(track?.id,{notFound:true});return null}
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),LOOKUP_LIMIT);
    const started=Date.now();
    const call=async params=>{
      const u=new URL('https://lrclib.net/api/search');
      Object.entries(params).forEach(([k,v])=>{if(v)u.searchParams.set(k,v)});
      const res=await fetch(u.toString(),{signal:controller.signal,mode:'cors',headers:{Accept:'application/json','Lrclib-Client':CLIENT}});
      if(!res.ok)throw new Error('Lyrics HTTP '+res.status);
      const data=await res.json();
      return Array.isArray(data)?data:[];
    };
    try{
      let records=await call({track_name:meta.title,artist_name:meta.artist});
      if(!records.length&&Date.now()-started<3000){records=await call({q:compact(meta.title+' '+meta.artist)})}
      const ranked=records.filter(r=>r&&(r.syncedLyrics||r.plainLyrics)&&!r.instrumental).map(r=>({r,s:scoreRecord(r,meta,duration)})).sort((a,b)=>b.s-a.s);
      const best=ranked[0]?.r;
      if(!best){putCached(track?.id,{notFound:true});return null}
      const out={id:best.id,trackName:best.trackName||best.name||meta.title,artistName:best.artistName||meta.artist,duration:Number(best.duration)||0,syncedLyrics:best.syncedLyrics||null,plainLyrics:best.plainLyrics||null,source:'LRCLIB'};
      putCached(track?.id,out);
      return out;
    }catch(e){
      if(e?.name!=='AbortError')console.warn('[Audify Karaoke] lyrics lookup failed',e);
      return null;
    }finally{clearTimeout(timer)}
  }

  function parseLRC(src,duration){
    const out=[];
    for(const raw of String(src||'').split(/\r?\n/)){
      const re=/\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g;
      const times=[];let m;
      while((m=re.exec(raw)))times.push(Number(m[1])*60+Number(m[2]));
      if(!times.length)continue;
      const text=compact(raw.replace(re,''));
      if(!text)continue;
      times.forEach(time=>out.push({start:time,text}));
    }
    out.sort((a,b)=>a.start-b.start);
    for(let i=0;i<out.length;i++){
      const line=out[i],next=out[i+1];
      line.end=next?next.start:(duration||line.start+6);
      if(line.end<=line.start)line.end=line.start+2.5;
      const tokens=line.text.split(/\s+/).filter(Boolean);
      const activeDur=Math.min(Math.max(1.2,line.end-line.start),Math.max(1.7,tokens.length*.48));
      const weights=tokens.map(w=>Math.max(.72,Math.sqrt(String(w).replace(/[^\p{L}\p{N}]/gu,'').length||1)));
      const total=weights.reduce((a,b)=>a+b,0)||1;
      let cursor=line.start;
      line.words=tokens.map((word,idx)=>{
        const d=activeDur*(weights[idx]/total),obj={text:word,start:cursor,end:cursor+d};cursor+=d;return obj;
      });
    }
    return out;
  }

  function ensureUI(){
    const view=document.querySelector('#playerView'),player=document.querySelector('.player'),actions=player?.querySelector('.actions');
    if(!view||!player||!actions)return false;
    if(!K.button){
      const b=document.createElement('button');
      b.id='v36LyricsBtn';b.className='v36-lyrics-btn';b.type='button';b.setAttribute('aria-label','Afficher les paroles');b.innerHTML='<span class="v36-mic">🎤</span><span>Paroles</span>';
      const video=actions.querySelector('#videoBtn');actions.insertBefore(b,video||actions.firstChild);K.button=b;b.addEventListener('click',togglePanel);
    }
    if(!K.panel){
      const panel=document.createElement('section');panel.id='v36Karaoke';panel.className='v36-karaoke';panel.setAttribute('aria-label','Mode karaoké');
      panel.innerHTML='<div class="v36-karaoke-head"><div class="v36-karaoke-title"><b>Paroles</b><span id="v36LyricsMeta">Audify Karaoke</span></div><button id="v36LyricsClose" class="v36-close" type="button" aria-label="Fermer">×</button></div><div id="v36LyricsScroll" class="v36-lyrics-scroll"></div><div id="v36LyricsSource" class="v36-source">LRCLIB</div>';
      view.appendChild(panel);K.panel=panel;K.scroll=panel.querySelector('#v36LyricsScroll');K.subtitle=panel.querySelector('#v36LyricsMeta');K.source=panel.querySelector('#v36LyricsSource');panel.querySelector('#v36LyricsClose').addEventListener('click',closePanel);
    }
    return true;
  }

  function buttonState(type){
    if(!K.button)return;
    K.button.classList.toggle('v36-loading',type==='loading');
    K.button.classList.toggle('v36-ready',type==='ready');
    K.button.classList.toggle('v36-open',K.open);
    const label=K.button.querySelector('span:last-child');
    if(label)label.textContent=type==='loading'?'Chargement':type==='none'?'Paroles':'Paroles';
  }
  function stateView(icon,title,text){
    if(!K.scroll)return;
    K.scroll.innerHTML='';
    const s=document.createElement('div');s.className='v36-state';
    const inner=document.createElement('div');inner.className='v36-state-inner';
    const i=document.createElement('div');i.className='v36-state-icon';i.textContent=icon;
    const b=document.createElement('b');b.textContent=title;
    const p=document.createElement('p');p.textContent=text;
    inner.append(i,b,p);s.append(inner);K.scroll.append(s);
    K.domLines=[];K.lineIndex=-2;
  }

  function renderLyrics(data){
    if(!ensureUI()||!K.scroll)return;
    K.scroll.innerHTML='';K.domLines=[];K.lineIndex=-2;
    K.panel.classList.toggle('v36-nosync',!data?.syncedLyrics);
    K.subtitle.textContent=compact((data?.trackName||K.track?.title||'')+' • '+(data?.artistName||K.track?.artist||''));
    K.source.textContent=data?.source||'LRCLIB';
    if(data?.syncedLyrics){
      const lines=parseLRC(data.syncedLyrics,data.duration||playerDuration());
      if(!lines.length){stateView('♪','Synchronisation indisponible','Les paroles ont été trouvées, mais pas leurs repères temporels.');return}
      const frag=document.createDocumentFragment();
      lines.forEach((line,idx)=>{
        const el=document.createElement('div');el.className='v36-line';el.dataset.index=String(idx);el.title='Aller à ce passage';
        const wordEls=[];
        line.words.forEach(w=>{const span=document.createElement('span');span.className='v36-word';span.textContent=w.text;el.appendChild(span);wordEls.push(span)});
        el.addEventListener('click',()=>{try{if(typeof S!=='undefined'&&S.ready&&S.p)S.p.seekTo(line.start,true)}catch{}});
        frag.appendChild(el);K.domLines.push({el,line,wordEls});
      });
      K.scroll.appendChild(frag);startTicker();
    }else if(data?.plainLyrics){
      for(const txt of String(data.plainLyrics).split(/\r?\n/)){
        const t=compact(txt);if(!t)continue;const el=document.createElement('div');el.className='v36-plain-line';el.textContent=t;K.scroll.appendChild(el);
      }
      stopTicker();
    }else stateView('🎤','Paroles indisponibles','Aucune parole n’a été trouvée pour ce titre.');
  }

  function stopTicker(){if(K.raf)cancelAnimationFrame(K.raf);K.raf=0}
  function startTicker(){stopTicker();K.lastTick=0;const tick=now=>{if(!K.open||!K.data?.syncedLyrics){K.raf=0;return}K.raf=requestAnimationFrame(tick);if(now-K.lastTick<55)return;K.lastTick=now;updateWords(playerTime())};K.raf=requestAnimationFrame(tick)}
  function updateWords(t){
    if(!K.domLines.length)return;
    let idx=-1;
    for(let i=0;i<K.domLines.length;i++){if(t>=K.domLines[i].line.start)idx=i;else break}
    if(idx!==K.lineIndex){
      K.lineIndex=idx;
      K.domLines.forEach((x,i)=>{x.el.classList.toggle('v36-active',i===idx);x.el.classList.toggle('v36-past',i<idx);if(i>idx)x.wordEls.forEach(w=>w.style.setProperty('--v36-fill','0%'))});
      if(idx>=0)K.domLines[idx].el.scrollIntoView({block:'center',behavior:'smooth'});
    }
    if(idx<0)return;
    const x=K.domLines[idx];
    x.line.words.forEach((w,i)=>{const p=Math.max(0,Math.min(1,(t-w.start)/Math.max(.06,w.end-w.start)));x.wordEls[i]?.style.setProperty('--v36-fill',(p*100).toFixed(1)+'%')});
  }

  async function prepare(track){
    if(!track?.id)return null;
    if(K.trackId===track.id&&K.promise)return K.promise;
    K.track=track;K.trackId=track.id;K.data=null;K.lineIndex=-2;buttonState('loading');
    if(K.open){stateView('🎤','Recherche des paroles…','Audify cherche une version synchronisée. Cette étape est limitée à quelques secondes.');K.subtitle.textContent=compact((track.title||'')+' • '+(track.artist||''))}
    const thisId=track.id;
    K.promise=requestLyrics(track).then(data=>{
      if(K.trackId!==thisId)return data;
      K.data=data;buttonState(data?'ready':'none');
      if(K.open){if(data)renderLyrics(data);else stateView('♪','Paroles indisponibles','Aucune parole synchronisée n’a été trouvée pour ce titre en moins de 5 secondes.')}
      return data;
    }).catch(()=>{if(K.trackId===thisId){K.data=null;buttonState('none');if(K.open)stateView('♪','Paroles indisponibles','Impossible de charger les paroles pour ce titre.')}return null});
    return K.promise;
  }

  function openPanel(){
    if(!ensureUI())return;
    const track=currentTrack();if(!track){safeToast('Choisis une musique');return}
    K.open=true;K.panel.classList.add('v36-show');document.body.classList.add('v36-karaoke-open');buttonState(K.data?'ready':K.promise?'loading':'loading');
    document.querySelector('#video')?.classList.remove('show');
    if(K.data)renderLyrics(K.data);else{stateView('🎤','Recherche des paroles…','Audify prépare le mode karaoké.');prepare(track)}
  }
  function closePanel(){K.open=false;K.panel?.classList.remove('v36-show');document.body.classList.remove('v36-karaoke-open');buttonState(K.data?'ready':'none');stopTicker()}
  function togglePanel(){K.open?closePanel():openPanel()}

  function onTrack(track){
    if(!track?.id||track.id===K.trackId)return;
    K.track=track;K.trackId=null;K.promise=null;K.data=null;K.lineIndex=-2;stopTicker();
    if(K.open){stateView('🎤','Recherche des paroles…','Nouveau titre : Audify cherche les paroles synchronisées.');K.subtitle.textContent=compact((track.title||'')+' • '+(track.artist||''))}
    setTimeout(()=>prepare(track),120);
  }

  function wrapPlayback(){
    try{
      const original=window.playTrack;
      if(typeof original==='function'&&!original.__v36Wrapped){
        const wrapped=function(t){const r=original.apply(this,arguments);setTimeout(()=>onTrack(t||currentTrack()),60);return r};
        wrapped.__v36Wrapped=true;window.playTrack=wrapped;
      }
    }catch{}
  }

  function bind(){
    ensureUI();wrapPlayback();
    let last='';
    setInterval(()=>{ensureUI();wrapPlayback();const t=currentTrack();if(t?.id&&t.id!==last){last=t.id;onTrack(t)}if(document.querySelector('#playerView')?.hidden&&K.open)closePanel()},500);
    const t=currentTrack();if(t?.id)onTrack(t);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  setTimeout(bind,650);
})();
