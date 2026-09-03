(()=>{
  'use strict';
  const DETECT_CACHE_KEY='audify_album_detect_cache_v68';
  const LIB_KEY='audify_album_library_v68';
  const PLAYLIST_KEY='audify_playlists_v1';
  const PLAYABLE_CACHE_KEY='audify_album_playables_v68';
  const YT_KEY=(typeof KEY==='string'&&KEY)||'AIzaSyDY2Lz5pnOkpwYuMN03DbkYtU4XJTACcJQ';
  const DAY=86400000;
  let lastSig='';
  let detectSeq=0;
  let playSeq=0;
  let overlay=null;
  let tileWrap=null;
  let tileBtn=null;
  let activeAlbum=null;
  let activeStatusEl=null;

  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const st=()=>{try{return window.S||null}catch{return null}};
  const cur=()=>st()?.current||null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toastSafe=t=>{try{window.toast&&window.toast(t)}catch{}}
  const readJson=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??f}catch{return f}};
  const writeJson=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const uniq=(arr,keyFn)=>{const seen=new Set(),out=[];for(const x of arr||[]){const k=keyFn(x);if(!k||seen.has(k))continue;seen.add(k);out.push(x)}return out};
  function mbQuery(title,artist){return `recording:"${String(title||'').replace(/"/g,'')}" AND artist:"${String(artist||'').replace(/"/g,'')}"`}

  function ensureTile(){
    const pv=q('#playerView');const copy=pv?.querySelector('.copy');if(!pv||!copy)return null;
    tileWrap=q('#v68AlbumTileWrap');
    if(tileWrap)return tileWrap;
    tileWrap=document.createElement('div');
    tileWrap.id='v68AlbumTileWrap';
    tileWrap.hidden=true;
    tileWrap.innerHTML='<button id="v68AlbumTile" type="button" hidden aria-label="Ouvrir l’album détecté"><img alt="Album détecté"></button>';
    copy.appendChild(tileWrap);
    tileBtn=tileWrap.querySelector('#v68AlbumTile');
    tileBtn.addEventListener('click',()=>{ if(activeAlbum) openAlbum(activeAlbum,true); });
    return tileWrap;
  }
  function hideTile(){ensureTile(); if(tileWrap)tileWrap.hidden=true; if(tileBtn)tileBtn.hidden=true;}
  function showTile(album){
    ensureTile(); if(!tileBtn||!album?.cover)return;
    const img=tileBtn.querySelector('img'); img.src=album.cover; img.alt=album.title||'Album';
    tileBtn.title=album.title?`Album détecté : ${album.title}`:'Album détecté';
    tileWrap.hidden=false; tileBtn.hidden=false;
  }

  async function fetchJson(url, init){
    const res=await fetch(url, Object.assign({headers:{accept:'application/json'}}, init||{}));
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  function pickRelease(recordings){
    const candidates=[];
    for(const rec of recordings||[]){
      const recTitle=norm(rec.title);
      const artist=norm((rec['artist-credit']||[]).map(x=>x.name||x.artist?.name||'').join(' '));
      for(const rel of rec.releases||[]){
        const title=rel.title||'';
        const primary=(rel['release-group']?.['primary-type']||rel['release-group']?.primaryType||'').toLowerCase();
        const status=(rel.status||'').toLowerCase();
        const score=(Number(rec.score)||0)
          + (primary==='album'?35:0)
          + (status==='official'?18:0)
          + (String(rel.country||'').toUpperCase() ? 4 : 0)
          + (rel.date?6:0)
          + (!/single|ep|compilation|live|karaoke/.test(norm(title))?4:0)
          + (recTitle?5:0)
          + (artist?3:0);
        candidates.push({id:rel.id,title,date:rel.date||'',score,artist,primary});
      }
    }
    candidates.sort((a,b)=>b.score-a.score);
    return candidates[0]||null;
  }

  async function detectAlbum(track){
    const ttitle=String(track?.title||'').trim();
    const tartist=String(track?.artist||'').trim();
    if(!ttitle||!tartist)return null;
    const key=norm(tartist)+'|'+norm(ttitle);
    const cache=readJson(DETECT_CACHE_KEY,{});
    const hit=cache[key];
    if(hit&&Date.now()-Number(hit.savedAt||0)<7*DAY&&hit.album)return hit.album;
    const qstr=encodeURIComponent(mbQuery(ttitle,tartist));
    const recUrl=`https://musicbrainz.org/ws/2/recording?query=${qstr}&fmt=json&limit=6`;
    const recData=await fetchJson(recUrl,{headers:{accept:'application/json','user-agent':'Audify/68.12.56'}});
    const picked=pickRelease(recData.recordings||[]);
    if(!picked) return null;
    const relUrl=`https://musicbrainz.org/ws/2/release/${picked.id}?inc=recordings+artist-credits+release-groups&fmt=json`;
    const rel=await fetchJson(relUrl,{headers:{accept:'application/json','user-agent':'Audify/68.12.56'}});
    const medias=Array.isArray(rel.media)?rel.media:[];
    const tracks=uniq(medias.flatMap((m,mi)=> (Array.isArray(m.tracks)?m.tracks:[]).map((x,ti)=>({
      pos:(mi?`${mi+1}-`:'')+(x.number||String(ti+1)),
      title:x.title||`Titre ${ti+1}`,
      artist:((x['artist-credit']||rel['artist-credit']||[]).map(a=>a.name||a.artist?.name||'').join(', ')) || tartist
    }))),x=>norm(x.pos+'|'+x.title+'|'+x.artist));
    if(!tracks.length) return null;
    const album={
      id:rel.id,
      title:rel.title||picked.title||ttitle,
      artist:((rel['artist-credit']||[]).map(a=>a.name||a.artist?.name||'').join(', '))||tartist,
      year:String((rel.date||picked.date||'')).slice(0,4),
      trackCount:tracks.length,
      tracks,
      cover:`https://coverartarchive.org/release/${rel.id}/front-500`
    };
    cache[key]={savedAt:Date.now(),album}; writeJson(DETECT_CACHE_KEY,cache);
    return album;
  }

  function ensureOverlay(){
    overlay=q('#v68AlbumOverlay'); if(overlay) return overlay;
    overlay=document.createElement('div');
    overlay.id='v68AlbumOverlay';
    overlay.innerHTML='<section id="v68AlbumSheet" role="dialog" aria-modal="true" aria-label="Album"></section>';
    overlay.addEventListener('click',e=>{ if(e.target===overlay) closeAlbum(); });
    document.body.appendChild(overlay);
    return overlay;
  }
  function closeAlbum(){ overlay?.classList.remove('show'); activeStatusEl=null; }

  function trackStateText(track, album){
    const playable = album?._playables?.[track._idx];
    if(playable===null) return 'Introuvable';
    if(playable) return 'Prêt';
    if(album?._resolving) return 'Préparation…';
    return 'En attente';
  }

  function renderTrackRows(album){
    return (album.tracks||[]).map((t,i)=>{
      t._idx=i;
      const current=album?._currentIndex===i?' is-current':'';
      const state=trackStateText(t,album);
      const cls=state==='Prêt'?' ready':state==='Introuvable'?' fail':'';
      return `<div class="v68-track${current}" data-v68-track="${i}"><div class="v68-track-num">${esc(t.pos||String(i+1))}</div><div class="v68-track-meta"><b>${esc(t.title)}</b><span>${esc(t.artist||album.artist||'')}</span></div><div class="v68-track-state${cls}">${esc(state)}</div></div>`;
    }).join('');
  }

  function renderAlbumSheet(album){
    const sheet=ensureOverlay().querySelector('#v68AlbumSheet');
    const meta=[album.year, `${album.trackCount||album.tracks?.length||0} titres`].filter(Boolean);
    sheet.innerHTML=`<div class="v68-album-head"><div class="v68-cover"><img src="${esc(album.cover||'')}" alt="${esc(album.title||'Album')}"></div><div class="v68-head-copy"><div style="display:flex;gap:12px;align-items:start"><div><div class="v68-meta-row"><span class="v68-chip kicker">ALBUM</span>${meta.map(x=>`<span class="v68-chip">${esc(x)}</span>`).join('')}</div><h2>${esc(album.title||'Album')}</h2><p class="v68-sub">${esc(album.artist||'Artiste inconnu')}</p><div class="v68-actions"><button class="v68-btn primary" data-v68-play>▶ Lire maintenant</button><button class="v68-btn secondary" data-v68-save>＋ Enregistrer dans mes playlists</button></div><div class="v68-status" id="v68AlbumStatus"></div></div><button class="v68-btn secondary v68-close" type="button" data-v68-close aria-label="Fermer">×</button></div></div></div><section class="v68-tracklist"><div class="v68-tracklist-head"><h3>TRACKLIST</h3><div class="v68-library-sub">Lecture instantanée du 1er titre, puis construction du reste de la file en arrière-plan.</div></div><div class="v68-tracks" id="v68Tracks">${renderTrackRows(album)}</div></section>`;
    activeStatusEl=sheet.querySelector('#v68AlbumStatus');
    sheet.querySelector('[data-v68-close]').onclick=closeAlbum;
    sheet.querySelector('[data-v68-play]').onclick=()=>startAlbum(album);
    sheet.querySelector('[data-v68-save]').onclick=()=>saveAlbum(album);
  }

  function openAlbum(album, autoPlay=false){
    activeAlbum=album;
    renderAlbumSheet(album);
    ensureOverlay().classList.add('show');
    if(autoPlay) startAlbum(album);
  }

  function setStatus(text=''){ if(activeStatusEl) activeStatusEl.textContent=text||''; }

  async function ytSearch(query){
    const u=new URL('https://www.googleapis.com/youtube/v3/search');
    const params={part:'snippet',type:'video',videoEmbeddable:'true',maxResults:'8',q:query,key:YT_KEY};
    for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
    const data=await fetchJson(u.toString());
    return (data.items||[]).map(x=>({
      id:x?.id?.videoId,
      title:x?.snippet?.title||'Sans titre',
      artist:x?.snippet?.channelTitle||'YouTube',
      thumbnail:x?.snippet?.thumbnails?.high?.url||x?.snippet?.thumbnails?.medium?.url||x?.snippet?.thumbnails?.default?.url
    })).filter(x=>x.id);
  }

  function scoreCandidate(track, cand){
    const nt=norm(track.title), na=norm(track.artist), ct=norm(cand.title), ca=norm(cand.artist);
    let s=0;
    if(ct.includes(nt)) s+=30;
    if(ca.includes(na)) s+=16;
    if(/official|audio|topic|provided to youtube/i.test(cand.title+' '+cand.artist)) s+=10;
    if(/lyrics|sped up|slowed|nightcore|instrumental|karaoke|cover/i.test(cand.title)) s-=18;
    return s;
  }

  async function resolvePlayable(album, track){
    const cache=readJson(PLAYABLE_CACHE_KEY,{});
    const key=`${album.id}|${norm(track.title)}|${norm(track.artist)}`;
    const hit=cache[key];
    if(hit&&Date.now()-Number(hit.savedAt||0)<30*DAY) return hit.item;
    const q1=`${track.title} ${track.artist||album.artist} official audio`;
    const q2=`${track.artist||album.artist} ${track.title}`;
    let items=[];
    for(const q of [q1,q2]){ items=await ytSearch(q); if(items.length) break; }
    if(!items.length) return null;
    items.sort((a,b)=>scoreCandidate(track,b)-scoreCandidate(track,a));
    const best=items[0];
    const item={id:best.id,title:track.title,artist:track.artist||album.artist,thumbnail:best.thumbnail};
    cache[key]={savedAt:Date.now(),item}; writeJson(PLAYABLE_CACHE_KEY,cache);
    return item;
  }

  async function startAlbum(album){
    const seq=++playSeq;
    album._playables=album._playables||Array(album.tracks.length).fill(undefined);
    album._resolving=true;
    album._currentIndex=0;
    renderAlbumSheet(album);
    setStatus('Démarrage du premier titre…');
    let first=album._playables[0];
    if(first===undefined){
      try{ first=await resolvePlayable(album, album.tracks[0]); album._playables[0]=first||null; }
      catch{ album._playables[0]=null; first=null; }
    }
    if(seq!==playSeq) return;
    if(!first){ album._resolving=false; renderAlbumSheet(album); setStatus('Impossible de démarrer le premier titre.'); return; }
    try{
      const s=st(); if(s){ s.items=[first]; s.i=0; }
      window.playTrack(first,0);
    }catch{}
    renderAlbumSheet(album);
    setStatus('Lecture lancée. Préparation du reste de l’album…');
    buildRestOfAlbum(album, seq).catch(()=>{});
  }

  async function buildRestOfAlbum(album, seq){
    const s=st();
    const playables=album._playables||Array(album.tracks.length).fill(undefined);
    const limit=4;
    let cursor=1, done=1;
    async function worker(){
      while(cursor<album.tracks.length && seq===playSeq){
        const idx=cursor++; if(playables[idx]!==undefined){ done++; continue; }
        try{ playables[idx]=await resolvePlayable(album, album.tracks[idx])||null; }
        catch{ playables[idx]=null; }
        done++;
        album._playables=playables;
        if(seq===playSeq){
          const ready=playables.filter(Boolean);
          if(s) s.items=ready;
          renderAlbumSheet(album);
          setStatus(done>=album.tracks.length ? 'Album prêt.' : `Préparation ${done}/${album.tracks.length}…`);
          syncSavedAlbum(album);
        }
      }
    }
    const workers=[]; for(let i=0;i<Math.min(limit, Math.max(0,album.tracks.length-1));i++) workers.push(worker());
    await Promise.all(workers);
    album._resolving=false;
    if(seq===playSeq){
      renderAlbumSheet(album);
      setStatus('Album prêt.');
      syncSavedAlbum(album);
    }
  }

  function upsertPlaylistForAlbum(album){
    const lists=readJson(PLAYLIST_KEY,[]);
    const pid='album_'+album.id;
    const tracks=(album._playables||[]).filter(Boolean).map(t=>({id:t.id,title:t.title,artist:t.artist,thumbnail:t.thumbnail}));
    const entry={id:pid,name:album.title,tracks,isAlbum:true,cover:album.cover,albumArtist:album.artist,year:album.year,createdAt:Date.now()};
    const idx=lists.findIndex(x=>x.id===pid);
    if(idx>=0){ entry.createdAt=lists[idx].createdAt||entry.createdAt; lists[idx]=Object.assign({},lists[idx],entry); }
    else lists.unshift(entry);
    writeJson(PLAYLIST_KEY,lists);
  }

  function saveAlbum(album){
    const lib=readJson(LIB_KEY,[]);
    const slim={id:album.id,title:album.title,artist:album.artist,year:album.year,cover:album.cover,trackCount:album.trackCount,tracks:album.tracks,_playables:album._playables||[]};
    const idx=lib.findIndex(x=>x.id===slim.id);
    if(idx>=0) lib[idx]=Object.assign({},lib[idx],slim); else lib.unshift(slim);
    writeJson(LIB_KEY,lib.slice(0,100));
    upsertPlaylistForAlbum(album);
    renderAlbumsPanel();
    toastSafe('Album enregistré');
  }
  function syncSavedAlbum(album){
    const lib=readJson(LIB_KEY,[]); const idx=lib.findIndex(x=>x.id===album.id); if(idx<0) return;
    lib[idx]=Object.assign({},lib[idx],{_playables:album._playables||[]}); writeJson(LIB_KEY,lib); upsertPlaylistForAlbum(album);
  }

  function openSavedAlbum(id){
    const lib=readJson(LIB_KEY,[]); const album=lib.find(x=>x.id===id); if(!album) return;
    album._playables=album._playables||Array((album.tracks||[]).length).fill(undefined);
    openAlbum(album,false);
  }

  function renderAlbumsPanel(){
    const r=q('#results'); if(!r||!r.classList.contains('home-view')) return;
    const lib=readJson(LIB_KEY,[]);
    let sec=q('#v68AlbumsPanel');
    if(!sec){ sec=document.createElement('section'); sec.id='v68AlbumsPanel'; const before=q('#playlistsPanel'); if(before) before.before(sec); else r.appendChild(sec); }
    if(!lib.length){ sec.innerHTML=''; return; }
    sec.innerHTML=`<div class="v68-library-head"><div><h3>Albums</h3><div class="v68-library-sub">Les albums enregistrés gardent un visuel distinct des playlists classiques.</div></div></div><div class="v68-album-grid">${lib.map(a=>`<button class="v68-album-card" type="button" data-v68-open-album="${esc(a.id)}"><span class="v68-album-badge">ALBUM</span><img src="${esc(a.cover||'')}" alt="${esc(a.title||'Album')}"><b>${esc(a.title||'Album')}</b><span>${esc(a.artist||'Artiste')}</span></button>`).join('')}</div>`;
    qa('[data-v68-open-album]').forEach(b=>b.onclick=()=>openSavedAlbum(b.dataset.v68OpenAlbum));
  }

  function syncCurrentTrack(){
    ensureTile();
    renderAlbumsPanel();
    const t=cur();
    if(!t){ hideTile(); lastSig=''; return; }
    const sig=norm(t.title)+'|'+norm(t.artist);
    if(sig===lastSig) return;
    lastSig=sig; hideTile();
    const seq=++detectSeq;
    detectAlbum(t).then(album=>{ if(seq!==detectSeq) return; activeAlbum=album; if(album) showTile(album); else hideTile(); }).catch(()=>{ if(seq===detectSeq) hideTile(); });
  }

  function bind(){
    ensureTile(); ensureOverlay();
    const r=q('#results'); if(r&&!r.dataset.v68obs){ r.dataset.v68obs='1'; new MutationObserver(()=>queueMicrotask(renderAlbumsPanel)).observe(r,{attributes:true,attributeFilter:['class'],childList:true,subtree:false}); }
    setInterval(syncCurrentTrack,900);
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeAlbum(); });
    renderAlbumsPanel();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind); else bind();
  setTimeout(bind,800);
})();