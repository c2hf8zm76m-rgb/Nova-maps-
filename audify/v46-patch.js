(()=>{
  'use strict';
  function ensureV46(){
    const mini=document.querySelector('#v45MiniPlayer');
    if(!mini)return false;
    let cover=mini.querySelector('#v46MiniCover');
    let meta=mini.querySelector('#v46MiniMeta');
    if(!cover){
      cover=document.createElement('div');
      cover.id='v46MiniCover';
      cover.className='v46-mini-cover';
      mini.insertBefore(cover,mini.firstChild);
    }
    if(!meta){
      meta=document.createElement('div');
      meta.id='v46MiniMeta';
      meta.className='v46-mini-meta';
      meta.innerHTML='<div id="v46MiniTitle" class="v46-mini-title">Aucun titre</div><div id="v46MiniArtist" class="v46-mini-artist">—</div>';
      const play=mini.querySelector('#v45MiniPlay');
      mini.insertBefore(meta,play||mini.children[1]||null);
    }
    return true;
  }
  function current(){try{return (typeof S!=='undefined'&&S)?S.current:null}catch{return null}}
  function sync(){
    if(!ensureV46())return;
    const t=current();
    if(!t)return;
    const cover=document.querySelector('#v46MiniCover');
    const title=document.querySelector('#v46MiniTitle');
    const artist=document.querySelector('#v46MiniArtist');
    if(cover){
      const img=String(t.thumbnail||'').replace(/"/g,'');
      cover.style.backgroundImage=img?`url("${img}")`:'none';
    }
    if(title)title.textContent=t.title||'Aucun titre';
    if(artist)artist.textContent=t.artist||'—';
  }
  function boot(){ensureV46();sync();setInterval(sync,300)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
