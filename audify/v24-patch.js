(()=>{
  const KEY='audify_playlists_v1';
  const getLists=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}};
  const setLists=v=>{try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const uid=()=>`pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  const currentTrack=()=>{try{return S.current||null}catch{return null}};
  const say=t=>{try{toast(t)}catch{}};

  function createPlaylist(name='Ma playlist'){
    const lists=getLists();
    const clean=String(name||'').trim()||`Playlist ${lists.length+1}`;
    const p={id:uid(),name:clean,tracks:[],createdAt:Date.now()};
    lists.unshift(p); setLists(lists); return p;
  }

  function addTrackToPlaylist(listId,track){
    if(!track)return false;
    const lists=getLists(); const p=lists.find(x=>x.id===listId); if(!p)return false;
    p.tracks=Array.isArray(p.tracks)?p.tracks:[];
    if(p.tracks.some(x=>x.id===track.id)){say(`Déjà dans ${p.name}`);return false}
    p.tracks.unshift({id:track.id,title:track.title,artist:track.artist,thumbnail:track.thumbnail});
    setLists(lists); say(`Ajouté à ${p.name}`); return true;
  }

  function ensurePlaylistButton(){
    const view=document.querySelector('#playerView'); if(!view||document.querySelector('#playlistFloating'))return;
    const b=document.createElement('button');
    b.id='playlistFloating'; b.className='home-floating playlist-floating'; b.type='button'; b.title='Ajouter à une playlist'; b.setAttribute('aria-label','Ajouter à une playlist'); b.textContent='＋';
    b.addEventListener('click',addCurrentToPlaylist); view.appendChild(b);
  }

  function removeModal(){document.querySelector('#playlistModalBackdrop')?.remove()}
  function modalShell(inner){
    removeModal();
    const bg=document.createElement('div'); bg.id='playlistModalBackdrop'; bg.className='playlist-modal-backdrop';
    bg.innerHTML=`<div class="playlist-modal" role="dialog" aria-modal="true">${inner}</div>`;
    bg.addEventListener('click',e=>{if(e.target===bg)removeModal()}); document.body.appendChild(bg); return bg;
  }

  function askPlaylistForTrack(track){
    const lists=getLists();
    if(!lists.length){const p=createPlaylist('Ma playlist');addTrackToPlaylist(p.id,track);refreshHomePlaylists();return}
    if(lists.length===1){addTrackToPlaylist(lists[0].id,track);refreshHomePlaylists();return}
    const bg=modalShell(`<h3>Choisir une playlist</h3><p>Dans quelle playlist veux-tu ajouter ce titre ?</p><div class="playlist-options">${lists.map(p=>`<button class="playlist-option" data-pick-playlist="${esc(p.id)}"><span><b>${esc(p.name)}</b><small>${(p.tracks||[]).length} titre${(p.tracks||[]).length>1?'s':''}</small></span><span>＋</span></button>`).join('')}</div><div class="playlist-modal-actions"><button data-new-playlist>＋ Nouvelle playlist</button><button data-cancel>Annuler</button></div>`);
    bg.querySelectorAll('[data-pick-playlist]').forEach(b=>b.onclick=()=>{addTrackToPlaylist(b.dataset.pickPlaylist,track);removeModal();refreshHomePlaylists()});
    bg.querySelector('[data-new-playlist]').onclick=()=>openCreatePlaylistModal(p=>{addTrackToPlaylist(p.id,track);removeModal();refreshHomePlaylists()});
    bg.querySelector('[data-cancel]').onclick=removeModal;
  }

  function addCurrentToPlaylist(){
    const t=currentTrack(); if(!t){say('Choisis une musique');return} askPlaylistForTrack(t);
  }

  function openCreatePlaylistModal(onCreated){
    const bg=modalShell(`<h3>Nouvelle playlist</h3><p>Donne un nom à ta playlist.</p><input id="playlistNameInput" class="playlist-name-input" maxlength="40" placeholder="Ex. Rap français"><div class="playlist-modal-actions"><button class="primary" data-create>Créer</button><button data-cancel>Annuler</button></div>`);
    const input=bg.querySelector('#playlistNameInput'); input.focus();
    const create=()=>{const p=createPlaylist(input.value);removeModal();say(`${p.name} créée`);refreshHomePlaylists();if(onCreated)onCreated(p)};
    bg.querySelector('[data-create]').onclick=create; bg.querySelector('[data-cancel]').onclick=removeModal; input.addEventListener('keydown',e=>{if(e.key==='Enter')create()});
  }

  function playlistCard(p){
    const tracks=Array.isArray(p.tracks)?p.tracks:[]; const first=tracks[0];
    return `<article class="playlist-card"><div class="playlist-cover">${first?`<img src="${esc(first.thumbnail)}" alt="">`:'♫'}</div><div class="playlist-meta"><b>${esc(p.name)}</b><span>${tracks.length} titre${tracks.length>1?'s':''}</span></div><button class="playlist-open" data-open-playlist="${esc(p.id)}">Ouvrir</button></article>`;
  }

  function buildPlaylistsPanel(){
    const lists=getLists();
    return `<section class="playlists-panel" id="playlistsPanel"><div class="playlists-head"><h3>Playlists</h3><button class="playlist-create" data-create-playlist>＋ Créer une playlist</button></div>${lists.length?`<div class="playlist-grid">${lists.map(playlistCard).join('')}</div>`:'<div class="playlists-empty">Aucune playlist pour le moment. Ajoute un titre depuis le lecteur ou crée ta première playlist.</div>'}</section>`;
  }

  function bindPlaylistsPanel(root=document){
    root.querySelector('[data-create-playlist]')?.addEventListener('click',()=>openCreatePlaylistModal());
    root.querySelectorAll('[data-open-playlist]').forEach(b=>b.onclick=()=>openPlaylist(b.dataset.openPlaylist));
  }

  function refreshHomePlaylists(){
    const home=document.querySelector('.home-view'); if(!home)return;
    const old=document.querySelector('#playlistsPanel');
    if(old){old.outerHTML=buildPlaylistsPanel()}else home.insertAdjacentHTML('beforeend',buildPlaylistsPanel());
    bindPlaylistsPanel(home);
  }

  function openPlaylist(id){
    const lists=getLists(), p=lists.find(x=>x.id===id); if(!p)return;
    const r=document.querySelector('#results'),rv=document.querySelector('#resultsView'),pv=document.querySelector('#playerView'); if(!r||!rv||!pv)return;
    pv.hidden=true;rv.hidden=false;const tracks=Array.isArray(p.tracks)?p.tracks:[];
    r.className='playlist-view';
    r.innerHTML=`<section class="playlist-view-head"><div><h3>${esc(p.name)}</h3><p>${tracks.length} titre${tracks.length>1?'s':''}</p></div><div><button class="playlist-back" data-playlist-back>← Accueil</button> <button class="playlist-delete" data-delete-playlist>Supprimer</button></div></section>${tracks.length?`<section class="playlist-track-grid">${tracks.map(t=>`<article class="playlist-track"><img src="${esc(t.thumbnail)}" alt=""><div class="playlist-track-meta"><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div><div class="playlist-track-actions"><button class="playlist-track-play" data-playlist-track="${esc(t.id)}">▶ Lire</button><button class="playlist-track-remove" data-remove-track="${esc(t.id)}">✕</button></div></article>`).join('')}</section>`:'<div class="playlists-empty">Cette playlist est vide.</div>'}`;
    r.querySelector('[data-playlist-back]').onclick=()=>document.querySelector('#homeFloating')?.click();
    r.querySelector('[data-delete-playlist]').onclick=()=>{const next=getLists().filter(x=>x.id!==id);setLists(next);say('Playlist supprimée');document.querySelector('#homeFloating')?.click()};
    r.querySelectorAll('[data-playlist-track]').forEach(b=>b.onclick=()=>{const i=tracks.findIndex(x=>x.id===b.dataset.playlistTrack);if(i>=0){try{S.items=tracks;playTrack(tracks[i],i)}catch(e){console.error(e)}}});
    r.querySelectorAll('[data-remove-track]').forEach(b=>b.onclick=()=>{const lists2=getLists(),p2=lists2.find(x=>x.id===id);if(!p2)return;p2.tracks=(p2.tracks||[]).filter(x=>x.id!==b.dataset.removeTrack);setLists(lists2);say('Titre retiré');openPlaylist(id)});
  }

  function onHomeRendered(){
    const r=document.querySelector('#results'); if(!r||!r.classList.contains('home-view'))return;
    if(!document.querySelector('#playlistsPanel'))refreshHomePlaylists();
  }

  function bind(){
    ensurePlaylistButton();
    const r=document.querySelector('#results'); if(r&&!r.dataset.v24Obs){r.dataset.v24Obs='1';new MutationObserver(()=>queueMicrotask(onHomeRendered)).observe(r,{childList:true,subtree:false,attributes:true,attributeFilter:['class']})}
    setTimeout(onHomeRendered,50);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  setTimeout(bind,600);
})();