(()=>{
  'use strict';
  const DETECT_CACHE_KEY='audify_album_detect_cache_v68';
  const LIB_KEY='audify_album_library_v68';
  const PLAYABLE_CACHE_KEY='audify_album_playables_v68';
  const DAY=86400000;
  let lastSig='', detectSeq=0, activeAlbum=null, overlay=null, tile=null, ytKeyPromise=null;

  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const readJson=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??f}catch{return f}};
  const writeJson=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const uniq=(arr,keyFn)=>{const seen=new Set(),out=[];for(const x of arr||[]){const k=keyFn(x);if(!k||seen.has(k))continue;seen.add(k);out.push(x)}return out};
  const mbQuery=(title,artist)=>`recording:"${String(title||'').replace(/"/g,'')}" AND artist:"${String(artist||'').replace(/"/g,'')}"`;
  const toast=t=>{const e=q('#toast');if(!e)return;e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2200)};

  function ensureStyles(){
    if(q('#audifyAlbumRecognitionStyle'))return;
    const st=document.createElement('style'); st.id='audifyAlbumRecognitionStyle';
    st.textContent=`
      .aud-album-detect{max-width:820px;margin:14px auto 0;display:none}.aud-album-detect.show{display:block;animation:audAlbumIn .35s ease}
      @keyframes audAlbumIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      .aud-album-tile{width:100%;display:grid;grid-template-columns:68px minmax(0,1fr) auto;gap:13px;align-items:center;padding:10px 12px;border:1px solid #ffffff1d;border-radius:22px;background:linear-gradient(135deg,#ffffff0d,#ffffff06);backdrop-filter:blur(20px);text-align:left;box-shadow:inset 0 1px #ffffff08,0 14px 34px #0005}
      .aud-album-tile:hover{border-color:#ffffff35;transform:translateY(-1px)}.aud-album-tile img{width:68px;height:68px;object-fit:cover;border-radius:16px;background:#13161b}.aud-album-copy{min-width:0}.aud-album-copy small{display:block;color:#e4b577;font-weight:900;letter-spacing:.12em;font-size:10px;margin-bottom:4px}.aud-album-copy b,.aud-album-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.aud-album-copy b{font-size:17px}.aud-album-copy span{font-size:12px;color:#b6bcc5;margin-top:3px}.aud-album-arrow{font-size:27px;color:#fff9}
      .aud-album-loading{max-width:820px;margin:14px auto 0;display:none;align-items:center;gap:10px;color:#cfd4dc;font-size:12px}.aud-album-loading.show{display:flex}.aud-album-spinner{width:17px;height:17px;border:2px solid #ffffff20;border-top-color:#fff;border-radius:50%;animation:audAlbSpin .7s linear infinite}@keyframes audAlbSpin{to{transform:rotate(360deg)}}
      .aud-album-overlay{position:fixed;inset:0;z-index:190;display:none;overflow:auto;background:rgba(4,5,7,.76);backdrop-filter:blur(24px);padding:24px}.aud-album-overlay.show{display:block;animation:audAlbumOverlay .25s ease}@keyframes audAlbumOverlay{from{opacity:0}to{opacity:1}}
      .aud-album-sheet{width:min(950px,100%);margin:4vh auto;background:linear-gradient(160deg,#171a20f5,#090b0ff8);border:1px solid #ffffff20;border-radius:34px;box-shadow:0 40px 100px #000c;overflow:hidden}.aud-album-head{position:relative;display:grid;grid-template-columns:minmax(220px,330px) minmax(0,1fr);gap:26px;padding:24px;background:radial-gradient(circle at 10% 0%,rgba(var(--ambient-rgb),.35),transparent 55%),#0c0f14}.aud-album-cover{aspect-ratio:1;border-radius:24px;overflow:hidden;border:1px solid #ffffff22;box-shadow:0 24px 60px #000a}.aud-album-cover img{width:100%;height:100%;object-fit:cover}.aud-album-meta{align-self:end}.aud-album-kicker{font-size:11px;font-weight:950;letter-spacing:.18em;color:#e4b577}.aud-album-meta h2{font-size:clamp(30px,5vw,54px);line-height:1;margin:8px 0}.aud-album-meta p{margin:0;color:#c1c7d0;font-size:18px}.aud-album-chips{display:flex;gap:7px;flex-wrap:wrap;margin:13px 0 18px}.aud-album-chip{padding:6px 9px;border:1px solid #ffffff1a;border-radius:999px;background:#ffffff08;color:#d9dde4;font-size:11px}.aud-album-actions{display:flex;gap:9px;flex-wrap:wrap}.aud-album-btn{border:1px solid #ffffff1c;border-radius:14px;padding:11px 14px;background:#ffffff0b;color:#fff;font-weight:800}.aud-album-btn.primary{background:#f6f8fb;color:#090b0e;border-color:#fff}.aud-album-close{position:absolute;right:18px;top:18px;width:44px;height:44px;padding:0;border-radius:15px;font-size:24px}
      .aud-album-list{padding:22px}.aud-album-list-head{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:12px}.aud-album-list-head h3{margin:0}.aud-album-list-head span{font-size:12px;color:#969eaa}.aud-album-track{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px;border-top:1px solid #ffffff0e}.aud-album-track:first-child{border-top:0}.aud-album-num{color:#9fa7b2;font-variant-numeric:tabular-nums}.aud-album-track b,.aud-album-track span{display:block}.aud-album-track span{font-size:11px;color:#9fa7b2;margin-top:3px}.aud-album-track button{border:1px solid #ffffff15;border-radius:12px;padding:8px 10px;background:#ffffff0b;color:#fff}.aud-album-track button.loading{font-size:0;width:40px;height:36px;position:relative}.aud-album-track button.loading:after{content:'';position:absolute;inset:10px 12px;border:2px solid #ffffff30;border-top-color:#fff;border-radius:50%;animation:audAlbSpin .7s linear infinite}
      .aud-album-empty{padding:22px;color:#aab2bd;text-align:center}
      @media(max-width:700px){.aud-album-overlay{padding:10px}.aud-album-sheet{margin:2vh auto;border-radius:26px}.aud-album-head{grid-template-columns:1fr;padding:18px}.aud-album-cover{width:min(72vw,360px);justify-self:center}.aud-album-meta{text-align:center}.aud-album-actions,.aud-album-chips{justify-content:center}.aud-album-list{padding:14px}.aud-album-tile{grid-template-columns:56px minmax(0,1fr) auto}.aud-album-tile img{width:56px;height:56px}}
    `;
    document.head.appendChild(st);
  }

  function currentTrack(){
    const title=(q('#bigTitle')?.textContent||q('#pn')?.textContent||'').trim();
    const artist=(q('#bigArtist')?.textContent||q('#pa')?.textContent||'').trim();
    if(!title||title==='—'||!artist||artist==='—')return null;
    const cover=q('#bigCover')?.src||q('#pt')?.src||'';
    const id=(cover.match(/\/vi\/([\w-]{11})\//)||[])[1]||'';
    return {id,title,artist,thumbnail:cover};
  }

  function ensureTile(){
    ensureStyles();
    let host=q('#audifyAlbumDetectHost'); if(host)return host;
    host=document.createElement('div'); host.id='audifyAlbumDetectHost'; host.className='aud-album-detect';
    host.innerHTML=`<button id="audifyAlbumTile" class="aud-album-tile" type="button"><img alt="Album détecté"><div class="aud-album-copy"><small>ALBUM DÉTECTÉ</small><b>—</b><span>—</span></div><div class="aud-album-arrow">›</div></button><div id="audifyAlbumLoading" class="aud-album-loading"><i class="aud-album-spinner"></i><span>Recherche de l’album officiel…</span></div>`;
    const anchor=q('.track-meta')||q('.control-panel'); if(anchor) anchor.insertAdjacentElement('afterend',host); else q('.player-page')?.appendChild(host);
    tile=q('#audifyAlbumTile'); tile?.addEventListener('click',()=>activeAlbum&&openAlbum(activeAlbum));
    return host;
  }
  function setDetectLoading(on){const host=ensureTile(),loading=q('#audifyAlbumLoading'); host?.classList.toggle('show',!!on); if(tile)tile.style.display=on?'none':'grid'; loading?.classList.toggle('show',!!on)}
  function hideTile(){const h=ensureTile();h?.classList.remove('show');if(tile)tile.style.display='none';q('#audifyAlbumLoading')?.classList.remove('show')}
  function showTile(album){const h=ensureTile(); if(!h||!album)return; const img=tile.querySelector('img'),b=tile.querySelector('b'),s=tile.querySelector('span'); img.src=album.cover; img.onerror=()=>{img.onerror=null; img.src=currentTrack()?.thumbnail||''}; b.textContent=album.title||'Album'; s.textContent=[album.artist,album.year,`${album.trackCount||album.tracks?.length||0} titres`].filter(Boolean).join(' • '); tile.style.display='grid'; q('#audifyAlbumLoading')?.classList.remove('show'); h.classList.add('show')}

  async function fetchJson(url,init){const res=await fetch(url,Object.assign({headers:{accept:'application/json'}},init||{}));if(!res.ok)throw new Error(`HTTP ${res.status}`);return await res.json()}
  function pickRelease(recordings){
    const candidates=[];
    for(const rec of recordings||[]){
      const recTitle=norm(rec.title);
      const artist=norm((rec['artist-credit']||[]).map(x=>x.name||x.artist?.name||'').join(' '));
      for(const rel of rec.releases||[]){
        const title=rel.title||'';
        const primary=(rel['release-group']?.['primary-type']||rel['release-group']?.primaryType||'').toLowerCase();
        const status=(rel.status||'').toLowerCase();
        const score=(Number(rec.score)||0)+(primary==='album'?35:0)+(status==='official'?18:0)+(String(rel.country||'').toUpperCase()?4:0)+(rel.date?6:0)+(!/single|ep|compilation|live|karaoke/.test(norm(title))?4:0)+(recTitle?5:0)+(artist?3:0);
        candidates.push({id:rel.id,title,date:rel.date||'',score,artist,primary});
      }
    }
    candidates.sort((a,b)=>b.score-a.score); return candidates[0]||null;
  }
  async function detectAlbum(track){
    const ttitle=String(track?.title||'').trim(), tartist=String(track?.artist||'').trim(); if(!ttitle||!tartist)return null;
    const key=norm(tartist)+'|'+norm(ttitle), cache=readJson(DETECT_CACHE_KEY,{}), hit=cache[key];
    if(hit&&Date.now()-Number(hit.savedAt||0)<7*DAY&&hit.album)return hit.album;
    const recUrl=`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(mbQuery(ttitle,tartist))}&fmt=json&limit=6`;
    const recData=await fetchJson(recUrl,{headers:{accept:'application/json'}}); const picked=pickRelease(recData.recordings||[]); if(!picked)return null;
    const rel=await fetchJson(`https://musicbrainz.org/ws/2/release/${picked.id}?inc=recordings+artist-credits+release-groups&fmt=json`,{headers:{accept:'application/json'}});
    const medias=Array.isArray(rel.media)?rel.media:[];
    const tracks=uniq(medias.flatMap((m,mi)=>(Array.isArray(m.tracks)?m.tracks:[]).map((x,ti)=>({pos:(mi?`${mi+1}-`:'')+(x.number||String(ti+1)),title:x.title||`Titre ${ti+1}`,artist:((x['artist-credit']||rel['artist-credit']||[]).map(a=>a.name||a.artist?.name||'').join(', '))||tartist}))),x=>norm(x.pos+'|'+x.title+'|'+x.artist));
    if(!tracks.length)return null;
    const album={id:rel.id,title:rel.title||picked.title||ttitle,artist:((rel['artist-credit']||[]).map(a=>a.name||a.artist?.name||'').join(', '))||tartist,year:String(rel.date||picked.date||'').slice(0,4),trackCount:tracks.length,tracks,cover:`https://coverartarchive.org/release/${rel.id}/front-500`};
    cache[key]={savedAt:Date.now(),album}; writeJson(DETECT_CACHE_KEY,cache); return album;
  }

  function ensureOverlay(){
    if(overlay)return overlay; ensureStyles(); overlay=document.createElement('div'); overlay.className='aud-album-overlay'; overlay.id='audifyAlbumOverlay'; overlay.innerHTML='<section class="aud-album-sheet" role="dialog" aria-modal="true" aria-label="Album"></section>'; overlay.addEventListener('click',e=>{if(e.target===overlay)closeAlbum()}); document.body.appendChild(overlay); return overlay;
  }
  function closeAlbum(){overlay?.classList.remove('show')}
  function renderAlbum(album){
    const sheet=ensureOverlay().querySelector('.aud-album-sheet'); const count=album.trackCount||album.tracks?.length||0;
    sheet.innerHTML=`<div class="aud-album-head"><div class="aud-album-cover"><img src="${esc(album.cover||'')}" alt="${esc(album.title||'Album')}"></div><div class="aud-album-meta"><button class="aud-album-btn aud-album-close" data-album-close>×</button><div class="aud-album-kicker">ALBUM RECONNU</div><h2>${esc(album.title||'Album')}</h2><p>${esc(album.artist||'Artiste inconnu')}</p><div class="aud-album-chips"><span class="aud-album-chip">MusicBrainz</span>${album.year?`<span class="aud-album-chip">${esc(album.year)}</span>`:''}<span class="aud-album-chip">${count} titres</span></div><div class="aud-album-actions"><button class="aud-album-btn primary" data-album-play>▶ Lire le premier titre</button><button class="aud-album-btn" data-album-save>＋ Enregistrer l’album</button></div></div></div><div class="aud-album-list"><div class="aud-album-list-head"><h3>Tracklist</h3><span>Album officiel reconnu automatiquement</span></div>${(album.tracks||[]).map((t,i)=>`<div class="aud-album-track"><div class="aud-album-num">${esc(t.pos||String(i+1))}</div><div><b>${esc(t.title)}</b><span>${esc(t.artist||album.artist||'')}</span></div><button data-album-track="${i}">▶</button></div>`).join('')||'<div class="aud-album-empty">Tracklist indisponible.</div>'}</div>`;
    sheet.querySelector('[data-album-close]').onclick=closeAlbum; sheet.querySelector('[data-album-save]').onclick=()=>saveAlbum(album); sheet.querySelector('[data-album-play]').onclick=e=>playAlbumTrack(album,0,e.currentTarget); qa('[data-album-track]').forEach(b=>b.onclick=e=>playAlbumTrack(album,+b.dataset.albumTrack,e.currentTarget));
  }
  function openAlbum(album){activeAlbum=album; renderAlbum(album); ensureOverlay().classList.add('show')}
  function saveAlbum(album){const lib=readJson(LIB_KEY,[]), slim={id:album.id,title:album.title,artist:album.artist,year:album.year,cover:album.cover,trackCount:album.trackCount,tracks:album.tracks};const i=lib.findIndex(x=>x.id===slim.id);if(i>=0)lib[i]=Object.assign({},lib[i],slim);else lib.unshift(slim);writeJson(LIB_KEY,lib.slice(0,100));toast('Album enregistré')}

  async function getYTKey(){
    if(ytKeyPromise)return ytKeyPromise;
    ytKeyPromise=fetch('./web-v70-app.js',{cache:'force-cache'}).then(r=>r.text()).then(t=>{const m=t.match(/const\s+YT_KEY\s*=\s*['"]([^'"]+)['"]/);return m?.[1]||''}).catch(()=> '');
    return ytKeyPromise;
  }
  async function ytSearch(query){const key=await getYTKey();if(!key)throw new Error('YouTube key unavailable');const u=new URL('https://www.googleapis.com/youtube/v3/search');for(const [k,v] of Object.entries({part:'snippet',type:'video',videoEmbeddable:'true',maxResults:'8',q:query,key}))u.searchParams.set(k,v);const data=await fetchJson(u.toString());return (data.items||[]).map(x=>({id:x?.id?.videoId,title:x?.snippet?.title||'Sans titre',artist:x?.snippet?.channelTitle||'YouTube',thumbnail:x?.snippet?.thumbnails?.high?.url||x?.snippet?.thumbnails?.medium?.url||x?.snippet?.thumbnails?.default?.url})).filter(x=>x.id)}
  function scoreCandidate(track,cand){const nt=norm(track.title),na=norm(track.artist),ct=norm(cand.title),ca=norm(cand.artist);let s=0;if(ct.includes(nt))s+=30;if(ca.includes(na))s+=16;if(/official|audio|topic|provided to youtube/i.test(cand.title+' '+cand.artist))s+=10;if(/lyrics|sped up|slowed|nightcore|instrumental|karaoke|cover/i.test(cand.title))s-=18;return s}
  async function resolvePlayable(album,track){const cache=readJson(PLAYABLE_CACHE_KEY,{}),key=`${album.id}|${norm(track.title)}|${norm(track.artist)}`,hit=cache[key];if(hit&&Date.now()-Number(hit.savedAt||0)<30*DAY)return hit.item;let found=[];for(const query of [`${track.title} ${track.artist||album.artist} official audio`,`${track.artist||album.artist} ${track.title}`]){found=await ytSearch(query);if(found.length)break}if(!found.length)return null;found.sort((a,b)=>scoreCandidate(track,b)-scoreCandidate(track,a));const best=found[0],item={id:best.id,title:track.title,artist:track.artist||album.artist,thumbnail:best.thumbnail};cache[key]={savedAt:Date.now(),item};writeJson(PLAYABLE_CACHE_KEY,cache);return item}
  async function playAlbumTrack(album,index,btn){const track=album.tracks?.[index];if(!track)return;btn?.classList.add('loading');try{const item=await resolvePlayable(album,track);if(!item)throw new Error('introuvable');closeAlbum();const input=q('#q'),go=q('#go');if(!input||!go)throw new Error('search unavailable');input.value=`${item.title} ${item.artist}`;go.click();let tries=0;const timer=setInterval(()=>{tries++;const cards=qa('.card');const exact=cards.find(c=>String(c.querySelector('img')?.src||'').includes(`/vi/${item.id}/`));const target=exact?.querySelector('[data-play]')||cards[0]?.querySelector('[data-play]');if(target){clearInterval(timer);target.click()}else if(tries>35){clearInterval(timer);toast('Le titre a été trouvé, mais le lecteur ne répond pas.')}},120)}catch{toast('Impossible de trouver ce titre sur YouTube')}finally{btn?.classList.remove('loading')}}

  async function syncCurrent(){
    ensureTile(); const t=currentTrack(); if(!t){hideTile();lastSig='';return} const sig=norm(t.title)+'|'+norm(t.artist); if(sig===lastSig)return; lastSig=sig; activeAlbum=null; setDetectLoading(true); const seq=++detectSeq;
    try{const album=await detectAlbum(t); if(seq!==detectSeq)return; activeAlbum=album; if(album)showTile(album);else hideTile()}catch{if(seq===detectSeq)hideTile()}
  }
  function bind(){ensureTile();ensureOverlay();setInterval(syncCurrent,900);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay?.classList.contains('show'))closeAlbum()});syncCurrent()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.AudifyAlbumRecognition={detectAlbum,openAlbum,getCurrentAlbum:()=>activeAlbum};
})();