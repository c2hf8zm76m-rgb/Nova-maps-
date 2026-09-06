(()=>{
'use strict';

const ENGINE_VERSION='70.5.8-web-karaoke-v1';
const CACHE_KEY='audify_lyrics_cache_v681231';
const POS_TTL=7*24*60*60*1000;
const NEG_TTL=4*60*60*1000;
const ACCEPT_SCORE=62;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let overlay=null, currentResult=null, currentTrackSig='', activeIndex=-1, ticker=0, searchSeq=0;

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const tokens=s=>new Set(norm(s).split(' ').filter(Boolean));
const uniq=(arr,keyFn=x=>norm(x))=>{const out=[],seen=new Set();for(const x of arr||[]){const k=keyFn(x);if(!k||seen.has(k))continue;seen.add(k);out.push(x)}return out};
const readCache=()=>{try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')}catch{return{}}};
const writeCache=o=>{try{localStorage.setItem(CACHE_KEY,JSON.stringify(o))}catch{}};

function parseClock(s){const p=String(s||'').trim().split(':').map(Number);if(!p.length||p.some(Number.isNaN))return 0;if(p.length===3)return p[0]*3600+p[1]*60+p[2];if(p.length===2)return p[0]*60+p[1];return p[0]||0}
function playerTime(){return parseClock($('#curTime')?.textContent||'0:00')}
function playerDuration(){return parseClock($('#durTime')?.textContent||'0:00')}
async function waitForDuration(){for(let i=0;i<8;i++){const d=playerDuration();if(d>5)return d;await new Promise(r=>setTimeout(r,250))}return playerDuration()||0}

function stripNoise(s){
  let x=String(s||'').replace(/[“”«»]/g,'"').replace(/[’]/g,"'").trim();
  x=x.replace(/\s*#(?:music|lyrics?|official|video)\b/ig,' ');
  x=x.replace(/\s*[\[(][^\])]*(?:official|officiel|clip|music\s*video|video|audio|visuali[sz]er|lyrics?|paroles|4k|hd|mv)[^\])]*[\])]\s*/ig,' ');
  x=x.replace(/\s*[-|]\s*(?:official(?:\s+music)?\s+video|official\s+audio|lyrics?|lyric\s+video|visuali[sz]er|clip\s+officiel|vid[eé]o\s+officielle?|audio\s+officiel).*$/ig,' ');
  x=x.replace(/\s*\|\s*(?:official|officiel|video|audio|visuali[sz]er|lyrics?).*$/ig,' ');
  x=x.replace(/\b(?:official\s+(?:music\s+)?video|clip\s+officiel|official\s+audio|audio\s+officiel|official\s+visualizer|visualizer|lyrics?\s+video|paroles)\b/ig,' ');
  return x.replace(/\s+/g,' ').replace(/^[-–—|:]+|[-–—|:]+$/g,'').trim();
}
function stripVersion(s){return stripNoise(s).replace(/\s*[\[(](?:remaster(?:ed)?.*|live.*|acoustic.*|radio\s+edit|single\s+version|album\s+version|original\s+mix|sped\s+up|slowed(?:\s+down)?|nightcore)[\])]\s*$/ig,' ').replace(/\s+/g,' ').trim()}
function cleanArtist(s){return stripNoise(s).replace(/\s*-\s*(?:topic|official(?:\s+(?:music|artist|channel))?)$/ig,'').replace(/\bvevo\b$/ig,'').replace(/\s+(?:official|officiel)$/ig,'').replace(/\s+/g,' ').trim()}
function firstArtist(s){return cleanArtist(s).split(/\s*(?:,|&|\bx\b|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b)\s*/i).filter(Boolean)[0]||cleanArtist(s)}
function splitTitle(raw){const s=stripNoise(raw);const m=s.match(/^(.{2,80}?)\s+[-–—]\s+(.{2,140})$/);if(!m)return null;return{artist:cleanArtist(m[1]),title:stripVersion(m[2])}}
function removeFeat(s){return stripVersion(s).replace(/\s*[\[(]?\s*(?:feat\.?|ft\.?|featuring)\s+[^\])]+[\])]?\s*$/ig,'').replace(/\s+/g,' ').trim()}

function similarity(a,b){
  const na=norm(a),nb=norm(b);if(!na||!nb)return 0;if(na===nb)return 1;
  const shorter=Math.min(na.length,nb.length),longer=Math.max(na.length,nb.length);
  if(shorter>=5&&(na.includes(nb)||nb.includes(na))&&shorter/longer>=.56)return .9;
  const A=tokens(na),B=tokens(nb);if(!A.size||!B.size)return 0;let inter=0;for(const x of A)if(B.has(x))inter++;
  const union=new Set([...A,...B]).size;const j=union?inter/union:0;const overlap=inter/Math.min(A.size,B.size);
  return Math.max(0,Math.min(1,j*.55+overlap*.45));
}

function getVideoId(){
  const imgs=[$('#bigCover')?.src,$('#pt')?.src];
  for(const u of imgs){const m=String(u||'').match(/\/vi\/([\w-]{11})\//);if(m)return m[1]}
  const iframe=$('#ytDock iframe,#ytEngine iframe,iframe[src*="youtube.com/embed/"]');
  const m=String(iframe?.src||'').match(/\/embed\/([\w-]{11})/);return m?.[1]||'';
}
function currentTrack(){
  const rawTitle=($('#bigTitle')?.textContent||$('#pn')?.textContent||'').trim();
  const rawArtist=($('#bigArtist')?.textContent||$('#pa')?.textContent||'').trim();
  if(!rawTitle||rawTitle==='—')return null;
  const split=splitTitle(rawTitle);
  const title=removeFeat(split?.title||rawTitle)||stripVersion(rawTitle);
  let artist=cleanArtist(split?.artist||rawArtist);
  if(!artist||/^youtube$/i.test(artist))artist=cleanArtist(rawArtist);
  const videoId=getVideoId();
  const thumbnail=$('#bigCover')?.src||$('#pt')?.src||'';
  return{videoId,rawTitle,rawArtist,title,artist,thumbnail,split};
}
function variants(track){
  const out=[];const push=(title,artist,why)=>{title=removeFeat(title);artist=cleanArtist(artist);if(title&&artist)out.push({title,artist,why})};
  push(track.title,track.artist,'clean');
  push(stripVersion(track.title),track.artist,'core-title');
  push(track.title,firstArtist(track.artist),'first-artist');
  push(stripVersion(track.title),firstArtist(track.artist),'core+first');
  if(track.split){push(track.split.title,track.split.artist,'youtube-title-split');push(removeFeat(track.split.title),firstArtist(track.split.artist),'youtube-split-core')}
  return uniq(out,x=>norm(x.title)+'|'+norm(x.artist)).slice(0,7);
}

function scoreCandidate(r,v,duration){
  if(!r||r.instrumental||(!r.syncedLyrics&&!r.plainLyrics))return-999;
  const rt=r.trackName||r.name||'',ra=r.artistName||'',ts=similarity(rt,v.title),as=similarity(ra,v.artist);
  let s=ts*72+as*34;
  if(norm(rt)===norm(v.title))s+=8;if(norm(ra)===norm(v.artist))s+=7;if(r.syncedLyrics)s+=6;
  if(duration>0&&Number(r.duration)>0){const diff=Math.abs(Number(r.duration)-duration);if(diff<=2.125)s+=18;else if(diff<=5.5)s+=12;else if(diff<=12)s+=6;else if(diff>44)s-=10}
  if(ts<.30)s-=34;if(as<.22&&ts<.82)s-=24;
  return Math.round(s*10)/10;
}

async function fetchJson(url,ms=5200){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{signal:c.signal,mode:'cors',headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(timer)}}
async function lrclibExact(v,duration){
  const u=new URL('https://lrclib.net/api/get');u.searchParams.set('track_name',v.title);u.searchParams.set('artist_name',v.artist);if(duration>0)u.searchParams.set('duration',String(Math.round(duration)));
  try{const x=await fetchJson(u.toString(),4300);return x?[x]:[]}catch{return[]}
}
async function lrclibSearch(v){
  const u=new URL('https://lrclib.net/api/search');u.searchParams.set('track_name',v.title);u.searchParams.set('artist_name',v.artist);
  try{return (await fetchJson(u.toString(),5000))||[]}catch{return[]}
}
async function lrclibBroad(v){
  const u=new URL('https://lrclib.net/api/search');u.searchParams.set('q',`${v.title} ${v.artist}`);
  try{return (await fetchJson(u.toString(),5000))||[]}catch{return[]}
}

async function resolveLrclib(track,duration,onStatus){
  const vv=variants(track), pool=[];let best=null,bestScore=-999,bestVariant=null;
  for(let i=0;i<vv.length;i++){
    const v=vv[i];onStatus?.(`Recherche LRCLIB • ${i+1}/${vv.length}`);
    const exact=await lrclibExact(v,duration);pool.push(...exact);
    const normal=await lrclibSearch(v);pool.push(...normal);
    if(i<3||pool.length<5)pool.push(...await lrclibBroad(v));
    const ded=uniq(pool,x=>String(x?.id||norm((x?.trackName||x?.name)+'|'+x?.artistName+'|'+x?.duration))).slice(0,18);
    for(const r of ded){for(const variant of vv.slice(0,i+1)){const sc=scoreCandidate(r,variant,duration);if(sc>bestScore){best=r;bestScore=sc;bestVariant=variant}}}
    if(best&&bestScore>=104&&best.syncedLyrics)break;
  }
  if(!best||bestScore<ACCEPT_SCORE)return null;
  return{source:'LRCLIB',id:best.id||null,trackName:best.trackName||best.name||bestVariant?.title||track.title,artistName:best.artistName||bestVariant?.artist||track.artist,duration:Number(best.duration)||duration||0,syncedLyrics:best.syncedLyrics||null,plainLyrics:best.plainLyrics||null,score:bestScore,validated:true,engineVersion:ENGINE_VERSION,variant:bestVariant?.why||'clean'};
}

async function resolveLyricsOvh(track,onStatus){
  const vv=variants(track);onStatus?.('Recherche de secours…');
  for(const v of vv){
    try{const u=`https://api.lyrics.ovh/v1/${encodeURIComponent(v.artist)}/${encodeURIComponent(v.title)}`;const j=await fetchJson(u,5200);const text=String(j?.lyrics||'').trim();if(text&&text.split(/\r?\n/).filter(Boolean).length>=3)return{source:'lyrics.ovh',id:null,trackName:v.title,artistName:v.artist,duration:0,syncedLyrics:null,plainLyrics:text,score:null,validated:true,engineVersion:ENGINE_VERSION,variant:v.why}}
    catch{}
  }
  return null;
}

function cacheKey(track){return track.videoId?`yt:${track.videoId}`:`meta:${norm(track.artist)}|${norm(track.title)}`}
function getCached(track){const all=readCache(),hit=all[cacheKey(track)];if(!hit)return null;const ttl=hit.notFound?NEG_TTL:POS_TTL;if(Date.now()-Number(hit.savedAt||0)>ttl)return null;if(hit.engineVersion&&hit.engineVersion!==ENGINE_VERSION)return null;return hit.notFound?{notFound:true}:hit.result||null}
function putCached(track,result){const all=readCache(),key=cacheKey(track);all[key]=result?{savedAt:Date.now(),engineVersion:ENGINE_VERSION,validated:true,videoId:track.videoId||'',trackName:result.trackName||track.title,artistName:result.artistName||track.artist,source:result.source,lrclibId:result.id||null,result}:{savedAt:Date.now(),engineVersion:ENGINE_VERSION,notFound:true,videoId:track.videoId||'',trackName:track.title,artistName:track.artist};const keys=Object.keys(all);if(keys.length>120)keys.sort((a,b)=>(all[b]?.savedAt||0)-(all[a]?.savedAt||0)).slice(120).forEach(k=>delete all[k]);writeCache(all)}

function parseLrc(text){
  const out=[];let globalOffset=0;
  for(const raw of String(text||'').split(/\r?\n/)){
    const off=raw.match(/^\[offset:([+-]?\d+)\]/i);if(off){globalOffset=Number(off[1]||0)/1000;continue}
    const tags=[...raw.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];if(!tags.length)continue;
    const txt=raw.replace(/\[[^\]]+\]/g,'').trim();if(!txt)continue;
    for(const m of tags){let frac=String(m[3]||'0');let ms=frac.length===1?Number(frac)*100:frac.length===2?Number(frac)*10:Number(frac.slice(0,3));out.push({time:Number(m[1])*60+Number(m[2])+ms/1000+globalOffset,text:txt})}
  }
  return out.filter(x=>Number.isFinite(x.time)&&x.time>=0).sort((a,b)=>a.time-b.time);
}

function ensureStyles(){if($('#audifyKaraoke758Style'))return;const s=document.createElement('style');s.id='audifyKaraoke758Style';s.textContent=`
.aud-karaoke{position:fixed;inset:0;z-index:240;display:none;color:#fff;background:#050607;overflow:hidden}.aud-karaoke.show{display:block;animation:audKIn .28s ease}@keyframes audKIn{from{opacity:0}to{opacity:1}}
.aud-k-bg{position:absolute;inset:-8%;background-size:cover;background-position:center;filter:blur(72px) saturate(.85);opacity:.28;transform:scale(1.15)}.aud-k-shade{position:absolute;inset:0;background:radial-gradient(circle at 30% 15%,rgba(var(--ambient-rgb),.45),transparent 42%),linear-gradient(180deg,rgba(4,5,6,.45),rgba(4,5,6,.92) 70%)}
.aud-k-page{position:relative;z-index:2;height:100%;max-width:1050px;margin:auto;display:grid;grid-template-rows:auto auto minmax(0,1fr);padding:18px 22px 22px}.aud-k-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.aud-k-brand{display:flex;align-items:center;gap:11px;min-width:0}.aud-k-brand img{width:48px;height:48px;border-radius:13px;object-fit:cover;box-shadow:0 8px 26px #0008}.aud-k-brand div{min-width:0}.aud-k-brand b,.aud-k-brand span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.aud-k-brand span{font-size:12px;color:#b8bec8;margin-top:3px}.aud-k-close{width:48px;height:48px;border-radius:16px;border:1px solid #ffffff25;background:#ffffff0d;color:#fff;font-size:24px}
.aud-k-head{text-align:center;padding:18px 0 8px}.aud-k-mode{font-size:11px;letter-spacing:.2em;font-weight:950;color:#e9bc84}.aud-k-status{margin-top:7px;color:#b9c0ca;font-size:12px}.aud-k-source{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:6px 10px;border:1px solid #ffffff17;border-radius:999px;background:#ffffff08;font-size:11px;color:#d7dbe2}.aud-k-dot{width:7px;height:7px;border-radius:50%;background:#fff}.aud-k-confidence{color:#fff;font-weight:800}
.aud-k-scroll{position:relative;overflow:auto;scrollbar-width:none;padding:24vh 7vw 38vh;mask-image:linear-gradient(to bottom,transparent 0,#000 16%,#000 82%,transparent 100%)}.aud-k-scroll::-webkit-scrollbar{display:none}.aud-k-line{max-width:820px;margin:0 auto 24px;font-size:clamp(24px,4.3vw,54px);line-height:1.16;font-weight:850;color:#ffffff42;transform-origin:center;transition:color .28s,opacity .28s,transform .28s,filter .28s;cursor:pointer;text-align:center;text-wrap:balance}.aud-k-line.past{color:#ffffff32}.aud-k-line.active{color:#fff;opacity:1;transform:scale(1.055);filter:drop-shadow(0 6px 26px rgba(0,0,0,.45))}.aud-k-line.future{color:#ffffff50}.aud-k-plain{max-width:820px;margin:0 auto 19px;font-size:clamp(21px,3.2vw,37px);line-height:1.35;font-weight:750;color:#ffffffe0;text-align:center;text-wrap:balance}
.aud-k-center{height:100%;display:grid;place-items:center;text-align:center;padding:28px}.aud-k-center h2{margin:0 0 8px;font-size:26px}.aud-k-center p{margin:0;color:#aeb5c0;max-width:520px}.aud-k-spinner{width:38px;height:38px;border-radius:50%;border:4px solid #ffffff20;border-top-color:#fff;animation:audKSpin .72s linear infinite;margin:0 auto 17px}@keyframes audKSpin{to{transform:rotate(360deg)}}
.aud-k-retry{margin-top:18px;border:0;border-radius:14px;padding:11px 16px;background:#fff;color:#090b0e;font-weight:900}.aud-karaoke-btn-busy{position:relative}.aud-karaoke-btn-busy:after{content:'';position:absolute;inset:12px;border-radius:50%;border:3px solid #ffffff38;border-top-color:currentColor;animation:audKSpin .72s linear infinite}.aud-karaoke-btn-busy{font-size:0!important}
@media(max-width:650px){.aud-k-page{padding:12px 12px 16px}.aud-k-brand img{width:43px;height:43px}.aud-k-scroll{padding-left:10px;padding-right:10px}.aud-k-line{margin-bottom:21px}.aud-k-head{padding-top:13px}}
`;document.head.appendChild(s)}

function ensureOverlay(){if(overlay)return overlay;ensureStyles();overlay=document.createElement('section');overlay.className='aud-karaoke';overlay.id='audifyKaraoke758';overlay.setAttribute('aria-hidden','true');overlay.innerHTML=`<div class="aud-k-bg"></div><div class="aud-k-shade"></div><div class="aud-k-page"><header class="aud-k-top"><div class="aud-k-brand"><img data-k-cover alt=""><div><b data-k-title>—</b><span data-k-artist>—</span></div></div><button class="aud-k-close" data-k-close aria-label="Fermer">×</button></header><div class="aud-k-head"><div class="aud-k-mode" data-k-mode>KARAOKÉ AUDIFY</div><div class="aud-k-status" data-k-status></div><div class="aud-k-source" data-k-source style="display:none"><i class="aud-k-dot"></i><span data-k-source-text></span></div></div><div class="aud-k-scroll" data-k-scroll></div></div>`;document.body.appendChild(overlay);overlay.querySelector('[data-k-close]').onclick=closeKaraoke;return overlay}
function setButtonBusy(on){const b=$('#karaokeBtn');if(!b)return;b.classList.toggle('aud-karaoke-btn-busy',!!on);b.classList.toggle('active',!!on||overlay?.classList.contains('show'))}
function showLoading(track,msg='Analyse des métadonnées…'){const o=ensureOverlay(),scroll=o.querySelector('[data-k-scroll]');o.classList.add('show');o.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';o.querySelector('[data-k-cover]').src=track.thumbnail||'';o.querySelector('[data-k-title]').textContent=track.rawTitle||track.title;o.querySelector('[data-k-artist]').textContent=track.rawArtist||track.artist;o.querySelector('.aud-k-bg').style.backgroundImage=track.thumbnail?`url("${track.thumbnail.replace(/"/g,'')}")`:'none';o.querySelector('[data-k-mode]').textContent='KARAOKÉ AUDIFY';o.querySelector('[data-k-status]').textContent=msg;o.querySelector('[data-k-source]').style.display='none';scroll.innerHTML='<div class="aud-k-center"><div><div class="aud-k-spinner"></div><h2>Recherche des paroles</h2><p>Audify vérifie le titre, l’artiste et la durée pour éviter les mauvaises paroles.</p></div></div>';setButtonBusy(true)}
function setStatus(msg){ensureOverlay().querySelector('[data-k-status]').textContent=msg||''}
function showNotFound(track){const o=ensureOverlay(),scroll=o.querySelector('[data-k-scroll]');o.querySelector('[data-k-mode]').textContent='PAROLES AUDIFY';o.querySelector('[data-k-status]').textContent='Aucune correspondance assez fiable';o.querySelector('[data-k-source]').style.display='none';scroll.innerHTML='<div class="aud-k-center"><div><h2>Paroles indisponibles</h2><p>Audify n’a trouvé aucune version suffisamment fiable pour ce morceau. Il préfère ne rien afficher plutôt que de montrer les mauvaises paroles.</p><button class="aud-k-retry" data-k-retry>Réessayer</button></div></div>';scroll.querySelector('[data-k-retry]').onclick=()=>openKaraoke(track,true);setButtonBusy(false)}
function renderResult(track,result){
  const o=ensureOverlay(),scroll=o.querySelector('[data-k-scroll]');currentResult=result;activeIndex=-1;stopTicker();
  o.querySelector('[data-k-mode]').textContent=result.syncedLyrics?'KARAOKÉ AUDIFY':'PAROLES AUDIFY';o.querySelector('[data-k-status]').textContent=result.syncedLyrics?'Paroles synchronisées avec la lecture':'Paroles trouvées sans synchronisation temporelle';
  const src=o.querySelector('[data-k-source]');src.style.display='inline-flex';o.querySelector('[data-k-source-text]').innerHTML=`${esc(result.source)}${result.score!=null?` • <span class="aud-k-confidence">${Math.round(result.score)} pts</span>`:''}`;
  if(result.syncedLyrics){const lines=parseLrc(result.syncedLyrics);if(!lines.length){result={...result,syncedLyrics:null};return renderResult(track,result)}scroll.innerHTML=lines.map((l,i)=>`<div class="aud-k-line future" data-k-line="${i}" data-time="${l.time}">${esc(l.text)}</div>`).join('');$$('[data-k-line]').filter(x=>o.contains(x)).forEach(el=>el.onclick=()=>seekTo(Number(el.dataset.time)||0));startTicker(lines)}
  else{const rows=String(result.plainLyrics||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);scroll.innerHTML=rows.length?rows.map(x=>`<div class="aud-k-plain">${esc(x)}</div>`).join(''):'<div class="aud-k-center"><div><h2>Paroles indisponibles</h2></div></div>'}
  setButtonBusy(false);
}
function seekTo(sec){const iframe=$('#ytDock iframe,#ytEngine iframe,iframe[src*="youtube.com/embed/"]');try{iframe?.contentWindow?.postMessage(JSON.stringify({event:'command',func:'seekTo',args:[Math.max(0,sec),true]}),'*')}catch{}}
function startTicker(lines){stopTicker();const tick=()=>{if(!overlay?.classList.contains('show')||!currentResult?.syncedLyrics)return;const t=playerTime();let idx=-1;for(let i=0;i<lines.length;i++){if(lines[i].time<=t+.08)idx=i;else break}if(idx!==activeIndex){activeIndex=idx;const els=$$('[data-k-line]').filter(x=>overlay.contains(x));els.forEach((el,i)=>{el.classList.toggle('active',i===idx);el.classList.toggle('past',i<idx);el.classList.toggle('future',i>idx)});if(idx>=0){const el=els[idx];el?.scrollIntoView({behavior:'smooth',block:'center'})}}ticker=setTimeout(tick,220)};tick()}
function stopTicker(){clearTimeout(ticker);ticker=0}
function closeKaraoke(){if(!overlay)return;overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');document.body.style.overflow='';stopTicker();setButtonBusy(false);$('#karaokeBtn')?.classList.remove('active');$('#karaokeSheet')?.classList.remove('show')}

async function openKaraoke(trackOverride=null,force=false){
  const track=trackOverride||currentTrack();if(!track)return;const my=++searchSeq,currentSig=cacheKey(track);currentTrackSig=currentSig;showLoading(track);
  if(!force){const cached=getCached(track);if(cached?.notFound){showNotFound(track);return}if(cached){renderResult(track,cached);return}}
  const duration=await waitForDuration();if(my!==searchSeq)return;setStatus('Recherche LRCLIB…');
  let result=await resolveLrclib(track,duration,msg=>{if(my===searchSeq)setStatus(msg)});if(my!==searchSeq)return;
  if(!result){setStatus('Recherche de secours…');result=await resolveLyricsOvh(track,msg=>{if(my===searchSeq)setStatus(msg)})}
  if(my!==searchSeq)return;putCached(track,result);if(result)renderResult(track,result);else showNotFound(track)
}

function install(){
  ensureStyles();ensureOverlay();const btn=$('#karaokeBtn');if(!btn)return;
  btn.onclick=null;btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();$('#karaokeSheet')?.classList.remove('show');openKaraoke()});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay?.classList.contains('show'))closeKaraoke()});
  const title=$('#bigTitle'),artist=$('#bigArtist');const obs=new MutationObserver(()=>{if(!overlay?.classList.contains('show'))return;const t=currentTrack();if(t&&cacheKey(t)!==currentTrackSig)openKaraoke(t)});if(title)obs.observe(title,{childList:true,subtree:true,characterData:true});if(artist)obs.observe(artist,{childList:true,subtree:true,characterData:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.AudifyKaraoke758={open:()=>openKaraoke(),close:closeKaraoke,current:()=>currentResult,engineVersion:ENGINE_VERSION,parseLrc,scoreCandidate};
})();
