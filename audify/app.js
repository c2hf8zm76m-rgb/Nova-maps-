const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const S={player:null,ready:false,current:null,results:[],index:-1};

// Moteur principal vérifié le 25/08/2026 : HTTP 200 + JSON + CORS *.
const PIPED_APIS=['https://api.piped.private.coffee'];
const SEARCH_INSTANCES=['https://yewtu.be','https://inv.nadeko.net','https://invidious.nerdvpn.de','https://yt.chocolatemoo53.com'];
const SEARCH_WRAPPERS=[
  {name:'allorigins',wrap:u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`},
  {name:'corsproxy',wrap:u=>`https://corsproxy.io/?url=${encodeURIComponent(u)}`},
  {name:'direct',wrap:u=>u}
];

const fmt=n=>{n=Math.max(0,Math.floor(n||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1600)};
const videoIdFrom=v=>{const m=String(v).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);return m?.[1]||(/^[\w-]{11}$/.test(String(v))?String(v):null)};
const textFrom=t=>t?.simpleText||t?.runs?.map(r=>r.text).join('')||'';

window.onYouTubeIframeAPIReady=()=>{
  S.player=new YT.Player('yt',{
    width:194,height:194,
    playerVars:{playsinline:1,controls:0,cc_load_policy:0,fs:0,disablekb:1,iv_load_policy:3,rel:0,enablejsapi:1,origin:location.origin},
    events:{
      onReady:()=>{S.ready=true;S.player.setVolume(80)},
      onStateChange:e=>{
        const np=$('#nowPlaying');
        if(e.data===YT.PlayerState.PLAYING){np.classList.add('playing');$('#play').textContent='❚❚'}
        if(e.data===YT.PlayerState.PAUSED||e.data===YT.PlayerState.CUED){np.classList.remove('playing');$('#play').textContent='▶'}
        if(e.data===YT.PlayerState.ENDED){np.classList.remove('playing');nextTrack()}
      }
    }
  });
};

setInterval(()=>{
  if(!S.ready||!S.current)return;
  const d=S.player.getDuration()||0,c=S.player.getCurrentTime()||0;
  $('#ct').textContent=fmt(c);$('#dur').textContent=fmt(d);$('#progress').value=d?Math.round(c/d*1000):0;
},350);

function renderResults(items){
  S.results=items;S.index=-1;
  $('#nowPlaying').hidden=true;
  $('#resultsView').hidden=false;
  const r=$('#results');
  if(!items.length){r.className='empty';r.innerHTML='Aucun résultat.';return}
  r.className='results-grid';
  r.innerHTML=items.map((t,i)=>`<article class="song-card"><div class="song-cover"><img src="${esc(t.thumbnail)}" alt="${esc(t.title)}"></div><div class="song-meta"><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div><button data-play="${i}">▶ Lire</button></article>`).join('');
  $$('[data-play]').forEach(b=>b.onclick=()=>playTrack(items[+b.dataset.play],+b.dataset.play));
}

async function fetchText(url,timeout=6500){
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),timeout);
  try{
    const res=await fetch(url,{signal:ctl.signal,headers:{accept:'application/json,text/plain,text/html,*/*'}});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }finally{clearTimeout(timer)}
}

function pipedVideoId(item){
  if(item?.videoId&&/^[\w-]{11}$/.test(item.videoId)) return item.videoId;
  const m=String(item?.url||'').match(/[?&]v=([A-Za-z0-9_-]{11})/);
  return m?.[1]||null;
}

async function searchViaPiped(q){
  let last='';
  for(const base of PIPED_APIS){
    try{
      const raw=await fetchText(`${base}/search?q=${encodeURIComponent(q)}&filter=videos`,8000);
      const data=JSON.parse(raw);
      const source=Array.isArray(data?.items)?data.items:[];
      const items=source
        .filter(x=>!x?.type||x.type==='stream'||x.type==='video')
        .map(x=>{
          const id=pipedVideoId(x);
          return id?{
            id,
            title:x.title||'Sans titre',
            artist:x.uploaderName||x.uploader||x.author||x.channelName||'YouTube',
            thumbnail:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`
          }:null;
        })
        .filter(Boolean)
        .slice(0,20);
      if(items.length)return items;
      last='Piped n’a renvoyé aucune vidéo';
    }catch(e){last=e?.message||String(e)}
  }
  throw new Error(last||'Piped indisponible');
}

async function searchViaInvidious(q){
  let last='';
  for(const instance of SEARCH_INSTANCES){
    const target=`${instance}/api/v1/search?q=${encodeURIComponent(q)}&type=video&hl=fr`;
    for(const wrapper of SEARCH_WRAPPERS){
      try{
        const raw=await fetchText(wrapper.wrap(target),5500);
        const data=JSON.parse(raw);
        const items=(Array.isArray(data)?data:[])
          .filter(x=>x&&x.videoId)
          .slice(0,20)
          .map(x=>({id:x.videoId,title:x.title||'Sans titre',artist:x.author||'YouTube',thumbnail:`https://i.ytimg.com/vi/${x.videoId}/hqdefault.jpg`}));
        if(items.length)return items;
        last=`Aucun résultat via ${wrapper.name}`;
      }catch(e){last=`${wrapper.name}: ${e?.message||'erreur'}`}
    }
  }
  throw new Error(last||'Échec du moteur de secours');
}

function collectVideoRenderers(node,out=[]){
  if(!node||typeof node!=='object')return out;
  if(Array.isArray(node)){for(const v of node)collectVideoRenderers(v,out);return out}
  if(node.videoRenderer)out.push(node.videoRenderer);
  for(const k in node)collectVideoRenderers(node[k],out);
  return out;
}

async function searchViaYoutubeHtml(q){
  const target=`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=fr`;
  let html='',last='';
  for(const wrapper of SEARCH_WRAPPERS){
    try{html=await fetchText(wrapper.wrap(target),6500);if(html&&/ytInitialData|videoRenderer/.test(html))break}catch(e){last=`${wrapper.name}: ${e?.message||'erreur'}`}
  }
  if(!html)throw new Error(last||'Impossible de récupérer YouTube');
  const m=html.match(/var ytInitialData = (\{.*?\});<\/script>/s)||html.match(/"ytInitialData"\s*[:=]\s*(\{.*?\})\s*;?<\/script>/s);
  if(!m)throw new Error('Données YouTube introuvables');
  let data;try{data=JSON.parse(m[1])}catch{throw new Error('Données YouTube illisibles')}
  const items=collectVideoRenderers(data,[]).slice(0,20).map(v=>({id:v.videoId,title:textFrom(v.title)||'Sans titre',artist:textFrom(v.ownerText)||textFrom(v.longBylineText)||'YouTube',thumbnail:`https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`})).filter(x=>x.id);
  if(items.length)return items;
  throw new Error('Aucune vidéo trouvée');
}

async function search(){
  const q=$('#q').value.trim();if(!q)return;
  const r=$('#results');$('#resultsView').hidden=false;$('#nowPlaying').hidden=true;r.className='empty';r.innerHTML='Recherche…';
  const direct=videoIdFrom(q);
  if(direct){renderResults([{id:direct,title:'Vidéo YouTube',artist:'YouTube',thumbnail:`https://i.ytimg.com/vi/${direct}/hqdefault.jpg`}]);return}

  const methods=[searchViaPiped,searchViaInvidious,searchViaYoutubeHtml];
  let last='';
  for(const method of methods){
    try{const items=await method(q);if(items?.length){renderResults(items);return}}catch(e){last=e?.message||String(e)}
  }
  r.className='empty';r.innerHTML='<b>Recherche temporairement indisponible</b><br><br>'+esc(last||'Réessaie dans quelques secondes.');
}

function playTrack(t,index=-1){
  S.current=t;if(index>=0)S.index=index;
  $('#resultsView').hidden=true;$('#nowPlaying').hidden=false;
  $('#title').textContent=t.title;$('#artist').textContent=t.artist;
  $('#cover').style.backgroundImage=`url("${String(t.thumbnail).replace(/"/g,'')}")`;
  $('#vinylLabel').style.backgroundImage=`url("${String(t.thumbnail).replace(/"/g,'')}")`;
  setAmbient(t.thumbnail,t.id||t.title);
  const stage=$('#artworkStage');stage.style.animation='none';void stage.offsetWidth;stage.style.animation='';
  $('#videoPanel').classList.add('show');
  const load=()=>S.ready?S.player.loadVideoById(t.id):setTimeout(load,100);load();
}

function nextTrack(){if(!S.results.length)return;const i=S.index<0?0:(S.index+1)%S.results.length;playTrack(S.results[i],i)}
function prevTrack(){if(!S.results.length){if(S.ready)S.player.seekTo(0,true);return}const i=S.index<=0?S.results.length-1:S.index-1;playTrack(S.results[i],i)}

function fallbackColor(seed){let h=0;for(const c of String(seed||''))h=(h*31+c.charCodeAt(0))>>>0;return `hsl(${h%360} 38% 22%)`}
function lighter(rgb){const m=String(rgb).match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);if(!m)return rgb;const a=m.slice(1).map(Number).map(v=>Math.min(255,Math.round(v*1.28+18)));return `rgb(${a[0]},${a[1]},${a[2]})`}
function setAmbient(url,seed){
  const img=new Image();img.crossOrigin='anonymous';img.referrerPolicy='no-referrer';
  img.onload=()=>{try{const c=document.createElement('canvas'),x=c.getContext('2d',{willReadFrequently:true});c.width=36;c.height=24;x.drawImage(img,0,0,36,24);const d=x.getImageData(0,0,36,24).data,bins=new Map();for(let i=0;i<d.length;i+=4){let r=d[i],g=d[i+1],b=d[i+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b),lum=(r+g+b)/3,sat=mx-mn;if(lum<25||lum>235||sat<16)continue;r=Math.round(r/32)*32;g=Math.round(g/32)*32;b=Math.round(b/32)*32;const k=`${r},${g},${b}`;bins.set(k,(bins.get(k)||0)+1+sat/100)}const best=[...bins.entries()].sort((a,b)=>b[1]-a[1])[0];applyAmbient(best?`rgb(${best[0]})`:fallbackColor(seed))}catch{applyAmbient(fallbackColor(seed))}};
  img.onerror=()=>applyAmbient(fallbackColor(seed));img.src=url;
}
function applyAmbient(c){document.documentElement.style.setProperty('--ambient',c);document.documentElement.style.setProperty('--ambient2',lighter(c))}

$('#go').onclick=search;
$('#q').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search()}};
$('#play').onclick=()=>{if(!S.current)return toast('Choisis une musique');S.player.getPlayerState()===YT.PlayerState.PLAYING?S.player.pauseVideo():S.player.playVideo()};
$('#prev').onclick=prevTrack;$('#next').onclick=nextTrack;
$('#progress').oninput=e=>{if(S.ready)S.player.seekTo((S.player.getDuration()||0)*(+e.target.value/1000),true)};
$('#volume').oninput=e=>S.ready&&S.player.setVolume(+e.target.value);
$('#showVideo').onclick=()=>$('#videoPanel').classList.add('show');
$('#closeVideo').onclick=()=>{if(S.ready&&S.player.getPlayerState()===YT.PlayerState.PLAYING)return toast('Mets en pause avant de masquer la vidéo');$('#videoPanel').classList.remove('show')};