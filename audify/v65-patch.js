(()=>{
  'use strict';

  const PROFILE_KEY='audify_reco_profile_v65';
  const META_KEY='audify_reco_artist_meta_v65';
  const RECS_KEY='audify_reco_results_v65';
  const FAVORITES_KEY='audify_favorites_v1';
  const META_TTL=1000*60*60*24*30;
  const RECS_TTL=1000*60*60*24*7;

  const GENRES={
    rap:['rap','hip hop','hip-hop','trap','drill','grime','boom bap','cloud rap','gangsta','french rap','rap français','rap francais'],
    pop:['pop','dance-pop','synthpop','electropop','teen pop','art pop','chanson pop'],
    rnb:['r&b','rnb','rhythm and blues','soul','neo soul','contemporary r&b'],
    funk:['funk','disco','boogie','p-funk','funk rock'],
    electronic:['electronic','electronica','house','techno','edm','dance','trance','dubstep','drum and bass','synthwave'],
    rock:['rock','alternative rock','indie rock','hard rock','garage rock','classic rock','pop rock'],
    metal:['metal','heavy metal','metalcore','death metal','black metal','nu metal'],
    punk:['punk','punk rock','post-punk','hardcore punk','pop punk'],
    afro:['afrobeat','afrobeats','afropop','amapiano','afro house'],
    reggae:['reggae','dancehall','dub','ska','ragga'],
    latin:['latin','reggaeton','latin pop','salsa','bachata','cumbia','urbano latino'],
    jazz:['jazz','bebop','smooth jazz','jazz fusion','swing'],
    classical:['classical','orchestral','opera','baroque','romantic'],
    folk:['folk','folk pop','singer-songwriter','acoustic','country'],
    indie:['indie','alternative','dream pop','shoegaze','lo-fi','lofi'],
    rai:['raï','rai','algerian rai','maghreb','chaabi','arabic pop'],
    kpop:['k-pop','kpop','korean pop'],
    soundtrack:['soundtrack','film score','video game music','anime']
  };
  const LABELS={rap:'Rap / Hip-Hop',pop:'Pop',rnb:'R&B / Soul',funk:'Funk / Disco',electronic:'Électro',rock:'Rock',metal:'Metal',punk:'Punk',afro:'Afro / Amapiano',reggae:'Reggae / Dancehall',latin:'Latin / Reggaeton',jazz:'Jazz',classical:'Classique',folk:'Folk / Acoustique',indie:'Indie / Alternative',rai:'Raï / Maghreb',kpop:'K-Pop',soundtrack:'Soundtrack'};
  const FALLBACK={
    rap:['Ninho','Gazo','Tiakola','Damso','Booba','Leto','Hamza','PLK'],
    pop:['Dua Lipa','Bruno Mars','Harry Styles','Ariana Grande','Sabrina Carpenter','Lady Gaga','Miley Cyrus'],
    rnb:['SZA','Frank Ocean','Bryson Tiller','PARTYNEXTDOOR','Giveon','Tyla','Jhené Aiko'],
    funk:['Anderson .Paak','Parcels','Vulfpeck','Jamiroquai','Chromeo','Tuxedo'],
    electronic:['Daft Punk','Fred again..','Calvin Harris','Disclosure','Justice','ODESZA','Kaytranada'],
    rock:['Arctic Monkeys','The Strokes','Foo Fighters','Muse','Royal Blood','Queens of the Stone Age'],
    metal:['Metallica','Bring Me The Horizon','Slipknot','Avenged Sevenfold','Deftones'],
    punk:['Green Day','Blink-182','The Offspring','Paramore','Sum 41'],
    afro:['Burna Boy','Rema','Ayra Starr','Wizkid','Asake','Tems','Omah Lay'],
    reggae:['Bob Marley & The Wailers','Sean Paul','Shaggy','Protoje','Koffee'],
    latin:['Bad Bunny','Feid','Rauw Alejandro','Karol G','Myke Towers','J Balvin'],
    jazz:['Miles Davis','Kamasi Washington','Chet Baker','Snarky Puppy','Robert Glasper'],
    classical:['Ludovico Einaudi','Max Richter','Ólafur Arnalds','Yiruma','Joep Beving'],
    folk:['Hozier','Noah Kahan','Bon Iver','Mumford & Sons','Vance Joy'],
    indie:['Tame Impala','The 1975','Cigarettes After Sex','Lana Del Rey','Mac DeMarco'],
    rai:['Cheb Khaled','Cheb Mami','Soolking','DYSTINCT','Douzi','Manal Benchlikha'],
    kpop:['NewJeans','LE SSERAFIM','aespa','Stray Kids','SEVENTEEN'],
    soundtrack:['Hans Zimmer','Ludwig Göransson','Ramin Djawadi','Joe Hisaishi','John Williams']
  };

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const cleanArtist=s=>String(s||'YouTube').replace(/\s*-\s*Topic$/i,'').replace(/\s*VEVO$/i,'').replace(/\s+Official$/i,'').replace(/\s+Officiel$/i,'').trim()||'YouTube';
  const read=(k,f)=>{try{const x=JSON.parse(localStorage.getItem(k)||'');return x&&typeof x==='object'?x:f}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const current=()=>{try{return typeof S!=='undefined'&&S?S.current:null}catch{return null}};

  let profile=read(PROFILE_KEY,{version:1,artists:{},likedIds:{},updatedAt:0});
  if(!profile.artists)profile.artists={};if(!profile.likedIds)profile.likedIds={};
  let metaCache=read(META_KEY,{}),recCache=read(RECS_KEY,{});
  let active=null,lastId='',lastRender='',mbChain=Promise.resolve(),mbNext=0,discovering=new Set();

  function nativeState(){
    try{if(window.AudifyNative?.getState)return JSON.parse(String(window.AudifyNative.getState()||'{}'))}catch{}
    return null;
  }
  function playback(){
    const n=nativeState();
    if(n)return {playing:!!n.playing,position:Number(n.position||0),duration:Number(n.duration||0)};
    try{if(typeof S!=='undefined'&&S?.ready&&S.p)return {playing:S.p.getPlayerState()===1,position:Number(S.p.getCurrentTime()||0),duration:Number(S.p.getDuration()||0)}}catch{}
    return {playing:false,position:0,duration:0};
  }

  function artistEntry(name,thumb=''){
    name=cleanArtist(name);const k=norm(name)||name.toLowerCase();
    let a=profile.artists[k];
    if(!a)a=profile.artists[k]={name,score:0,listens:0,likes:0,skips:0,lastAt:0,thumbnail:thumb||''};
    if(thumb&&!a.thumbnail)a.thumbnail=thumb;
    return a;
  }
  function bumpArtist(name,delta,kind,thumb=''){
    if(!name||cleanArtist(name)==='YouTube')return;
    const a=artistEntry(name,thumb);a.score=Math.max(-2,Math.min(100,(Number(a.score)||0)+delta));
    if(kind==='listen')a.listens=(a.listens||0)+1;
    if(kind==='like')a.likes=(a.likes||0)+1;
    if(kind==='skip')a.skips=(a.skips||0)+1;
    a.lastAt=Date.now();profile.updatedAt=Date.now();write(PROFILE_KEY,profile);lastRender='';
    classifyArtist(a.name).catch(()=>{});
  }

  function topArtists(){return Object.values(profile.artists).filter(a=>a&&a.score>0).sort((a,b)=>(b.score-a.score)||(b.lastAt-a.lastAt)).slice(0,8)};
  function bucketForTags(tags){
    const scores={};
    for(const raw of tags||[]){const t=norm(typeof raw==='string'?raw:raw?.name);if(!t)continue;for(const [bucket,words] of Object.entries(GENRES)){for(const w of words){const wn=norm(w);if(t===wn||t.includes(wn)){scores[bucket]=(scores[bucket]||0)+Math.max(1,Number(raw?.count)||1);break}}}}
    return Object.entries(scores).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  }
  function genreScores(){
    const scores={};
    for(const a of topArtists()){
      const m=metaCache[norm(a.name)];if(!m)continue;
      const buckets=m.buckets||[];buckets.slice(0,3).forEach((b,i)=>scores[b]=(scores[b]||0)+a.score*(i===0?1:.45));
    }
    return Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  }

  function mbFetch(url){
    const task=async()=>{
      const wait=Math.max(0,mbNext-Date.now());if(wait)await new Promise(r=>setTimeout(r,wait));
      mbNext=Date.now()+1150;
      const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('MusicBrainz '+r.status);return r.json();
    };
    const p=mbChain.then(task,task);mbChain=p.catch(()=>{});return p;
  }
  function lucene(v){return String(v||'').replace(/([+\-!(){}\[\]^"~*?:\\/]|&&|\|\|)/g,'\\$1');}

  async function classifyArtist(name){
    name=cleanArtist(name);const k=norm(name);if(!k||name==='YouTube')return null;
    const cached=metaCache[k];if(cached&&Date.now()-(cached.at||0)<META_TTL)return cached;
    if(discovering.has('m:'+k))return null;discovering.add('m:'+k);
    try{
      const query='artist:"'+lucene(name)+'"';
      const data=await mbFetch('https://musicbrainz.org/ws/2/artist/?fmt=json&limit=6&query='+encodeURIComponent(query));
      const artists=Array.isArray(data.artists)?data.artists:[];
      let best=artists.find(a=>norm(a.name)===k)||artists[0];if(!best)return null;
      let tags=[...(best.genres||[]),...(best.tags||[])];
      if(tags.length<2&&best.id){
        try{const d=await mbFetch('https://musicbrainz.org/ws/2/artist/'+encodeURIComponent(best.id)+'?inc=genres+tags&fmt=json');tags=[...(d.genres||[]),...(d.tags||[])];best=Object.assign({},best,d)}catch{}
      }
      const seen=new Set(),rawTags=[];
      tags.sort((a,b)=>(Number(b.count)||0)-(Number(a.count)||0)).forEach(t=>{const n=String(t?.name||'').trim();const nk=norm(n);if(n&&!seen.has(nk)){seen.add(nk);rawTags.push({name:n,count:Number(t?.count)||1})}});
      const buckets=bucketForTags(rawTags);
      const meta={name:best.name||name,mbid:best.id||'',country:best.country||'',rawTags:rawTags.slice(0,12),buckets,at:Date.now()};
      metaCache[k]=meta;write(META_KEY,metaCache);lastRender='';
      buildRecommendations(name,meta).catch(()=>{});return meta;
    }catch{return null}finally{discovering.delete('m:'+k)}
  }

  async function buildRecommendations(seedName,meta){
    const k=norm(seedName);if(!k||discovering.has('r:'+k))return;
    const old=recCache[k];if(old&&Date.now()-(old.at||0)<RECS_TTL&&old.items?.length)return;
    discovering.add('r:'+k);
    try{
      const specific=meta?.rawTags?.[0]?.name||'';const bucket=meta?.buckets?.[0]||'';
      let items=[];
      if(specific){
        let query='tag:"'+lucene(specific)+'"';if(meta.country)query+=' AND country:'+lucene(meta.country);
        try{
          const d=await mbFetch('https://musicbrainz.org/ws/2/artist/?fmt=json&limit=28&query='+encodeURIComponent(query));
          items=(d.artists||[]).filter(a=>a?.name&&norm(a.name)!==k&&Number(a.score||0)>=55).map(a=>({name:a.name,score:Number(a.score)||0,reason:specific}));
        }catch{}
        if(items.length<4){
          try{const d=await mbFetch('https://musicbrainz.org/ws/2/artist/?fmt=json&limit=28&query='+encodeURIComponent('tag:"'+lucene(specific)+'"'));items=items.concat((d.artists||[]).filter(a=>a?.name&&norm(a.name)!==k).map(a=>({name:a.name,score:Number(a.score)||0,reason:specific})))}catch{}
        }
      }
      const excluded=new Set(topArtists().map(a=>norm(a.name)));excluded.add(k);
      const unique=[];const used=new Set();
      for(const x of items.sort((a,b)=>b.score-a.score)){const nk=norm(x.name);if(!nk||used.has(nk)||excluded.has(nk))continue;used.add(nk);unique.push(x);if(unique.length>=8)break}
      if(unique.length<6&&bucket){for(const name of FALLBACK[bucket]||[]){const nk=norm(name);if(used.has(nk)||excluded.has(nk))continue;used.add(nk);unique.push({name,score:50,reason:LABELS[bucket]});if(unique.length>=8)break}}
      recCache[k]={seed:seedName,bucket,tag:specific,items:unique,at:Date.now()};write(RECS_KEY,recCache);lastRender='';
    }finally{discovering.delete('r:'+k)}
  }

  function recommendations(){
    const tops=topArtists();const out=[],seen=new Set();
    for(const seed of tops.slice(0,4)){
      const m=metaCache[norm(seed.name)];if(m&&!recCache[norm(seed.name)])buildRecommendations(seed.name,m).catch(()=>{});
      const r=recCache[norm(seed.name)];
      for(const x of r?.items||[]){const k=norm(x.name);if(!k||seen.has(k)||tops.some(a=>norm(a.name)===k))continue;seen.add(k);out.push({name:x.name,reason:x.reason||LABELS[r.bucket]||'Pour toi',seed:seed.name,bucket:r.bucket||m?.buckets?.[0]||''});if(out.length>=12)return out}
    }
    const gs=genreScores();
    for(const [bucket] of gs.slice(0,2))for(const name of FALLBACK[bucket]||[]){const k=norm(name);if(seen.has(k)||tops.some(a=>norm(a.name)===k))continue;seen.add(k);out.push({name,reason:LABELS[bucket],seed:tops[0]?.name||'',bucket});if(out.length>=12)return out}
    return out;
  }

  function syncFavorites(){
    let favs=[];try{favs=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]')||[]}catch{}
    let dirty=false;
    for(const t of favs){if(!t?.id||profile.likedIds[t.id])continue;profile.likedIds[t.id]=Date.now();const a=artistEntry(t.artist,t.thumbnail);a.score=Math.min(100,(a.score||0)+2.6);a.likes=(a.likes||0)+1;a.lastAt=Date.now();dirty=true;classifyArtist(a.name).catch(()=>{})}
    if(dirty){profile.updatedAt=Date.now();write(PROFILE_KEY,profile);lastRender=''}
  }

  function startTrack(t){
    if(active&&active.id!==t.id){if(active.listenSeconds<8&&!active.firstReward)bumpArtist(active.artist,-.22,'skip',active.thumbnail)}
    active={id:t.id,artist:cleanArtist(t.artist),thumbnail:t.thumbnail||'',listenSeconds:0,firstReward:false,longReward:false};
    lastId=t.id;classifyArtist(active.artist).catch(()=>{});
  }
  function learnTick(){
    const t=current();if(t?.id&&t.id!==lastId)startTrack(t);
    if(!t?.id||!active)return;
    const p=playback();if(p.playing)active.listenSeconds+=1;
    if(active.listenSeconds>=10&&!active.firstReward){active.firstReward=true;bumpArtist(active.artist,.8,'listen',active.thumbnail)}
    if(active.listenSeconds>=45&&!active.longReward){active.longReward=true;bumpArtist(active.artist,.75,'long',active.thumbnail)}
  }

  function goArtist(name){
    const q=document.querySelector('#q'),go=document.querySelector('#go');if(!q||!go)return;
    q.value=name;q.dispatchEvent(new Event('input',{bubbles:true}));q.dispatchEvent(new Event('change',{bubbles:true}));go.click();
  }
  function initials(name){return String(name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?'}
  function ensureSection(){
    const results=document.querySelector('#results');if(!results||!results.classList.contains('home-view'))return null;
    let sec=document.querySelector('#v65ForYou');if(!sec){sec=document.createElement('section');sec.id='v65ForYou';sec.className='v65-for-you';results.appendChild(sec)}
    return sec;
  }
  function render(){
    const sec=ensureSection();if(!sec)return;
    const tops=topArtists(),genres=genreScores(),recs=recommendations();
    const key=[tops.map(a=>a.name+':'+a.score.toFixed(1)).join('|'),genres.slice(0,4).map(x=>x[0]).join('|'),recs.map(x=>x.name).join('|')].join('::');
    if(key===lastRender&&sec.innerHTML)return;lastRender=key;
    if(!tops.length){sec.innerHTML='<div class="v65-head"><div><span class="v65-kicker">AUDIFY POUR TOI</span><h3>Découvre ton univers musical</h3><p>Écoute quelques morceaux et Audify apprendra les artistes et styles que tu préfères.</p></div></div>';return}
    const chips=genres.slice(0,4).map(([g])=>'<span class="v65-chip">'+esc(LABELS[g]||g)+'</span>').join('');
    const seed=tops[0]?.name||'';
    const cards=recs.length?recs.map(x=>'<button class="v65-rec" type="button" data-v65-artist="'+esc(x.name)+'"><span class="v65-avatar">'+esc(initials(x.name))+'</span><span class="v65-rec-copy"><b>'+esc(x.name)+'</b><small>'+esc(x.reason||'Pour toi')+(x.seed?' • proche de '+esc(x.seed):'')+'</small></span><span class="v65-arrow">›</span></button>').join(''):'<div class="v65-learning"><span class="v65-pulse"></span><div><b>Audify analyse '+esc(seed)+'</b><small>Les recommandations vont apparaître automatiquement.</small></div></div>';
    sec.innerHTML='<div class="v65-head"><div><span class="v65-kicker">AUDIFY POUR TOI</span><h3>Pour toi</h3><p>Basé sur tes écoutes, tes likes et les artistes que tu gardes longtemps.</p></div><div class="v65-profile">'+chips+'</div></div><div class="v65-rec-row">'+cards+'</div>';
    sec.querySelectorAll('[data-v65-artist]').forEach(b=>b.addEventListener('click',()=>goArtist(b.dataset.v65Artist)));
  }

  function boot(){
    syncFavorites();const t=current();if(t?.id)startTrack(t);
    setInterval(learnTick,1000);setInterval(syncFavorites,1800);setInterval(render,900);
    setTimeout(render,250);setTimeout(render,1200);
    window.AudifyRecommendationsV65={profile:()=>profile,metadata:()=>metaCache,recommendations};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
