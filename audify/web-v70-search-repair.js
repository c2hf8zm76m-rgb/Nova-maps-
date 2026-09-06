(()=>{
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const KEY={fav:'audify_favorites_v2',hist:'audify_history_v2',queue:'audify_queue_v2'};
let repairItems=[],repairIndex=-1,lastQuery='',activeMeta=null,searchSeq=0;
const go=$('#go'),input=$('#q'),content=$('#content');
if(!go||!input||!content)return;

// Le moteur YouTube officiel deja installe par web-v70-app.js reste le moteur principal.
const youtubeDirectSearch=go.onclick;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const validId=id=>/^[\w-]{11}$/.test(String(id||''));
const thumb=id=>`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
function say(t){const e=$('#toast');if(!e)return;e.textContent=t;e.classList.add('show');clearTimeout(say.t);say.t=setTimeout(()=>e.classList.remove('show'),2200)}
function isFav(id){return read(KEY.fav).some(x=>x.id===id)}
function toggleFav(t,btn){let a=read(KEY.fav),i=a.findIndex(x=>x.id===t.id);if(i>=0)a.splice(i,1);else a.unshift({...t,source:'youtube'});write(KEY.fav,a.slice(0,200));btn.textContent=i>=0?'♡':'♥';say(i>=0?'Retiré des favoris':'Ajouté aux favoris')}
function normalizeInv(x){if(!x||x.type!=='video'||!validId(x.videoId))return null;return{id:x.videoId,title:String(x.title||'Vidéo YouTube'),artist:String(x.author||'YouTube'),thumbnail:thumb(x.videoId),source:'youtube'}}
function normalizePiped(x){const id=(String(x?.url||'').match(/[?&]v=([\w-]{11})/)||[])[1]||x?.id||'';if(!validId(id))return null;return{id,title:String(x.title||'Vidéo YouTube'),artist:String(x.uploaderName||x.uploader||'YouTube'),thumbnail:thumb(id),source:'youtube'}}
async function fetchTimeout(url,ms=6500){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{signal:c.signal,headers:{accept:'application/json'}});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
async function firstSuccessful(tasks){return await Promise.any(tasks.map(async fn=>{const arr=await fn();if(!Array.isArray(arr)||!arr.length)throw Error('empty');return arr}))}
async function altSearch(q){
  const enc=encodeURIComponent(q);
  const invHosts=['https://inv.nadeko.net','https://invidious.nerdvpn.de','https://yt.chocolatemoo53.com'];
  const pipedHosts=['https://pipedapi.kavin.rocks','https://pipedapi.tokhmi.xyz','https://api-piped.mha.fi','https://piped-api.garudalinux.org'];
  try{
    const inv=await firstSuccessful(invHosts.map(h=>async()=>{const j=await fetchTimeout(`${h}/api/v1/search?q=${enc}&type=video&sort_by=relevance`,6000);return(j||[]).map(normalizeInv).filter(Boolean).slice(0,24)}));
    if(inv.length)return inv;
  }catch{}
  return await firstSuccessful(pipedHosts.map(h=>async()=>{const j=await fetchTimeout(`${h}/search?q=${enc}&filter=videos`,6500);return(j?.items||[]).map(normalizePiped).filter(Boolean).slice(0,24)}));
}
function card(t,i){return`<article class="card"><button class="coverBtn" data-repair-open="${i}" aria-label="Ouvrir ${esc(t.title)}"><img src="${esc(t.thumbnail)}" alt="${esc(t.title)}" referrerpolicy="no-referrer" loading="lazy" onerror="this.onerror=null;this.src='${thumb(t.id)}'"></button><b>${esc(t.title)}</b><span>${esc(t.artist)}</span><div class="row"><button class="play" data-repair-play="${i}">▶ Lire</button><button data-repair-fav="${i}">${isFav(t.id)?'♥':'♡'}</button></div></article>`}
function renderResults(arr){content.className='';content.innerHTML=`<div class="section-title"><h2>Résultats YouTube</h2><span>${arr.length}</span></div><div class="grid">${arr.map(card).join('')}</div>`;$$('[data-repair-open],[data-repair-play]').forEach(b=>b.onclick=()=>openTrack(arr[+(b.dataset.repairOpen??b.dataset.repairPlay)],+(b.dataset.repairOpen??b.dataset.repairPlay)));$$('[data-repair-fav]').forEach(b=>b.onclick=e=>toggleFav(arr[+b.dataset.repairFav],e.currentTarget))}
function correctStoredMeta(t){let h=read(KEY.hist);const hi=h.findIndex(x=>x.id===t.id);if(hi>=0)h[hi]={...h[hi],...t,at:h[hi].at||Date.now()};else h.unshift({...t,at:Date.now()});write(KEY.hist,h.slice(0,100));for(const k of [KEY.fav,KEY.queue]){let a=read(k),i=a.findIndex(x=>x.id===t.id);if(i>=0){a[i]={...a[i],...t};write(k,a)}}}
function applyMeta(t){activeMeta=t;for(const [s,v] of [['#bigTitle',t.title],['#bigArtist',t.artist],['#pn',t.title],['#pa',t.artist]]){const e=$(s);if(e)e.textContent=v}for(const s of ['#bigCover','#pt']){const e=$(s);if(e)e.src=t.thumbnail}const vinyl=$('#vinyl');if(vinyl)vinyl.style.setProperty('--vinyl-label',`url("${t.thumbnail.replace(/"/g,'')}")`);correctStoredMeta(t);try{if('mediaSession'in navigator&&typeof MediaMetadata!=='undefined')navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:t.artist,album:'Audify • YouTube',artwork:[{src:t.thumbnail}]})}catch{}window.dispatchEvent(new CustomEvent('audify:track-metadata',{detail:t}))}
async function openTrack(t,i){if(!t)return;repairIndex=i;activeMeta=t;const qBefore=lastQuery||input.value.trim();input.value=t.id;try{await Promise.resolve(youtubeDirectSearch?.call(go))}catch{}let tries=0;const timer=setInterval(()=>{tries++;const b=$('[data-play="0"]')||$('[data-open="0"]');if(b){clearInterval(timer);b.click();setTimeout(()=>{applyMeta(t);input.value=qBefore;renderResults(repairItems)},70)}else if(tries>35){clearInterval(timer);input.value=qBefore;say('Impossible d’ouvrir ce résultat YouTube')}},40)}
function hasDirectResults(){return $$('#content .card [data-play],#content .card [data-open]').length>0}
async function runYouTubeDirect(q,seq){
  if(typeof youtubeDirectSearch!=='function')return false;
  input.value=q;
  try{await Promise.resolve(youtubeDirectSearch.call(go))}catch{return false}
  if(seq!==searchSeq)return true;
  return hasDirectResults();
}
async function repairedSearch(){
  const q=input.value.trim();if(!q)return;
  lastQuery=q;const seq=++searchSeq;
  const direct=(String(q).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/)||[])[1]||(/^[\w-]{11}$/.test(q)?q:'');
  if(direct){repairItems=[];repairIndex=-1;return youtubeDirectSearch?.call(go)}

  $$('[data-tab]').forEach(x=>x.classList.toggle('on',x.dataset.tab==='home'));
  content.className='empty';content.innerHTML='<span class="audify-loader" style="margin-right:8px"></span> Recherche YouTube…';

  // 1) YouTube officiel / Data API : moteur principal d'Audify.
  const directOk=await runYouTubeDirect(q,seq);
  if(seq!==searchSeq)return;
  if(directOk){repairItems=[];repairIndex=-1;return}

  // 2) Seulement si YouTube direct echoue : moteurs de secours.
  content.className='empty';content.innerHTML='<span class="audify-loader" style="margin-right:8px"></span> YouTube direct indisponible, recherche de secours…';
  try{
    const arr=await altSearch(q);if(seq!==searchSeq)return;
    repairItems=arr;repairIndex=-1;
    if(!arr.length)throw Error('Aucun résultat');
    renderResults(arr);
  }catch(e){
    if(seq!==searchSeq)return;
    content.className='empty';
    content.innerHTML='<b>Recherche YouTube momentanément indisponible</b><br><br>Le moteur YouTube principal et les moteurs de secours n’ont pas répondu.';
    say('Recherche YouTube indisponible');
  }
}
go.onclick=repairedSearch;
input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();repairedSearch()}};
for(const [sel,dir] of [['#prev',-1],['#next',1]]){$(sel)?.addEventListener('click',e=>{if(repairItems.length<2||repairIndex<0)return;e.preventDefault();e.stopImmediatePropagation();repairIndex=(repairIndex+dir+repairItems.length)%repairItems.length;openTrack(repairItems[repairIndex],repairIndex)},true)}
['#likeTop','#likeMain','#addTop','#playlistBtn'].forEach(sel=>$(sel)?.addEventListener('click',()=>{if(activeMeta)setTimeout(()=>correctStoredMeta(activeMeta),0)}));
window.AudifySearchRepair={search:repairedSearch,getResults:()=>repairItems.slice(),getActive:()=>activeMeta,primary:'YouTube Data API',fallback:'Invidious/Piped'};
})();