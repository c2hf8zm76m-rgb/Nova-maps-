(()=>{
  const getFavs=()=>{try{return JSON.parse(localStorage.getItem('audify_favorites_v1')||'[]')}catch{return []}};
  const setFavs=v=>{try{localStorage.setItem('audify_favorites_v1',JSON.stringify(v))}catch{}};
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function ensureHomeButton(){
    const view=document.querySelector('#playerView');
    if(!view||document.querySelector('#homeFloating')) return;
    const b=document.createElement('button');
    b.id='homeFloating'; b.className='home-floating'; b.type='button'; b.title='Accueil'; b.setAttribute('aria-label','Retour à l’accueil'); b.textContent='⌂';
    b.addEventListener('click',renderHome);
    view.appendChild(b);
  }
  function bindFavoriteCards(){
    document.querySelectorAll('[data-fav-play]').forEach(b=>b.onclick=()=>{
      const favs=getFavs(); const id=b.dataset.favPlay; const i=favs.findIndex(x=>x.id===id); if(i<0)return;
      try{S.items=favs; playTrack(favs[i],i)}catch(e){console.error(e)}
    });
    document.querySelectorAll('[data-fav-remove]').forEach(b=>b.onclick=()=>{
      const id=b.dataset.favRemove; const favs=getFavs().filter(x=>x.id!==id); setFavs(favs);
      try{if(S.current?.id===id) syncLike()}catch{}
      renderHome();
      try{toast('Retiré des favoris')}catch{}
    });
  }
  function renderHome(){
    const rv=document.querySelector('#resultsView'), pv=document.querySelector('#playerView'), r=document.querySelector('#results');
    if(!rv||!pv||!r)return;
    pv.hidden=true; rv.hidden=false;
    const favs=getFavs();
    const cards=favs.map(t=>`<article class="fav-card"><img src="${escapeHtml(t.thumbnail)}" alt="${escapeHtml(t.title)}"><div class="fav-meta"><b>${escapeHtml(t.title)}</b><span>${escapeHtml(t.artist)}</span></div><div class="fav-actions"><button class="fav-play" data-fav-play="${escapeHtml(t.id)}">▶ Lire</button><button class="fav-remove" data-fav-remove="${escapeHtml(t.id)}" aria-label="Retirer des favoris">♥</button></div></article>`).join('');
    r.className='home-view';
    r.innerHTML=`<section class="home-hero"><span class="home-kicker">AUDIFY HOME</span><h2>Mes favoris</h2><p>Tous les titres que tu likes apparaissent ici automatiquement.</p></section><section class="favorites-panel"><div class="favorites-head"><h3>Titres likés</h3><span>${favs.length} favori${favs.length>1?'s':''}</span></div>${favs.length?`<div class="favorite-grid">${cards}</div>`:'<div class="favorites-empty">Aucun titre liké pour le moment.</div>'}</section>`;
    bindFavoriteCards();
  }
  function bind(){ensureHomeButton(); if(!document.body.dataset.v23Home){document.body.dataset.v23Home='1'; renderHome();}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind); else bind();
  setTimeout(bind,500);
})();