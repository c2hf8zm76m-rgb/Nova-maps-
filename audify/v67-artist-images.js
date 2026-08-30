(()=>{
  'use strict';

  const CACHE_KEY='audify_artist_art_v67';
  const CACHE_TTL=1000*60*60*24*30;
  const FAILED_TTL=1000*60*60*24;
  const inflight=new Map();

  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const readCache=()=>{try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')||{}}catch{return {}}};
  const writeCache=v=>{try{localStorage.setItem(CACHE_KEY,JSON.stringify(v))}catch{}};
  let cache=readCache();

  function knownAudifyImage(name){
    try{
      const p=window.AudifyRecommendationsV65?.profile?.();
      const wanted=norm(name);
      for(const a of Object.values(p?.artists||{})){
        if(norm(a?.name)===wanted&&a?.thumbnail)return String(a.thumbnail);
      }
    }catch{}
    return '';
  }

  function upgradeArtwork(url){
    return String(url||'')
      .replace(/\/100x100bb(?=\.(?:jpg|png|webp))/i,'/420x420bb')
      .replace(/\/100x100bb(?=\/)/i,'/420x420bb');
  }

  async function fetchAppleArtwork(name){
    const endpoint='https://itunes.apple.com/search?media=music&entity=song&attribute=artistTerm&limit=12&country=FR&term='+encodeURIComponent(name);
    const r=await fetch(endpoint,{headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error('Apple Search '+r.status);
    const data=await r.json();
    const items=Array.isArray(data?.results)?data.results:[];
    const wanted=norm(name);
    let best=items.find(x=>norm(x?.artistName)===wanted);
    if(!best)best=items.find(x=>norm(x?.artistName).includes(wanted)||wanted.includes(norm(x?.artistName)));
    if(!best)best=items[0];
    return upgradeArtwork(best?.artworkUrl100||best?.artworkUrl60||best?.artworkUrl30||'');
  }

  async function resolveArt(name){
    const key=norm(name);if(!key)return '';
    const direct=knownAudifyImage(name);if(direct)return direct;
    const saved=cache[key];
    if(saved&&Date.now()-(saved.at||0)<(saved.url?CACHE_TTL:FAILED_TTL))return saved.url||'';
    if(inflight.has(key))return inflight.get(key);
    const p=(async()=>{
      let url='';
      try{url=await fetchAppleArtwork(name)}catch(e){console.warn('[Audify V67] image artiste indisponible',name,e)}
      cache[key]={url,at:Date.now()};writeCache(cache);return url;
    })().finally(()=>inflight.delete(key));
    inflight.set(key,p);return p;
  }

  async function decorate(card){
    if(!card||card.dataset.v67Art==='1')return;
    const name=card.dataset.v65Artist||card.querySelector('.v65-rec-copy b')?.textContent||'';
    const avatar=card.querySelector('.v65-avatar');
    if(!name||!avatar)return;
    card.dataset.v67Art='1';
    avatar.classList.add('v67-art-shell');
    const url=await resolveArt(name);
    if(!url)return;
    if(!document.documentElement.contains(card))return;
    const img=document.createElement('img');
    img.className='v67-art-img';
    img.alt='';
    img.decoding='async';
    img.loading='lazy';
    img.referrerPolicy='no-referrer';
    img.addEventListener('load',()=>avatar.classList.add('v67-art-ready'),{once:true});
    img.addEventListener('error',()=>{img.remove();avatar.classList.remove('v67-art-ready');card.dataset.v67Art='0';},{once:true});
    avatar.appendChild(img);
    img.src=url;
  }

  function scan(root=document){
    root.querySelectorAll?.('.v65-rec[data-v65-artist]').forEach(card=>decorate(card));
  }

  const observer=new MutationObserver(muts=>{
    for(const m of muts)for(const node of m.addedNodes){
      if(node.nodeType!==1)continue;
      if(node.matches?.('.v65-rec[data-v65-artist]'))decorate(node);
      scan(node);
    }
  });

  function boot(){
    scan();
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setInterval(scan,2500);
    window.AudifyArtistImagesV67={refresh:()=>{cache=readCache();scan()},clearCache:()=>{cache={};writeCache(cache);document.querySelectorAll('.v65-rec').forEach(x=>x.dataset.v67Art='0');scan()}};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
