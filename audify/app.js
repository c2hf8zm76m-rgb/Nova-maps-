const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const KEY='AIzaSyDY2Lz5pnOkpwYuMN03DbkYtU4XJTACcJQ';
const S={player:null,ready:false,current:null,results:[],index:-1};

const fmt=n=>{n=Math.max(0,Math.floor(n||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1600)};
const videoIdFrom=v=>{const m=String(v).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);return m?.[1]||(/^[\w-]{11}$/.test(String(v))?String(v):null)};

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

async function search(){
  const q=$('#q').value.trim();if(!q)return;
  const r=$('#results');$('#resultsView').hidden=false;$('#nowPlaying').hidden=true;r.className='empty';r.innerHTML='Recherche…';
  const direct=videoIdFrom(q);
  if(direct){renderResults([{id:direct,title:'Vidéo YouTube',artist:'YouTube',thumbnail:`https://i.ytimg.com/vi/${direct}/hqdefault.jpg`}]);return}
  try{
    const u=new URL('https://www.googleapis.com/youtube/v3/search');
    const params={part:'snippet',type:'video',videoEmbeddable:'true',maxResults:'20',q,key:KEY};
    for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
    const res=await fetch(u.toString(),{headers:{accept:'application/json'}});
    const data=await res.json();
    if(!res.ok)throw new Error(data?.error?.message||`YouTube API HTTP ${res.status}`);
    const items=(data.items||[]).map(x=>({
      id:x?.id?.videoId,
      title:x?.snippet?.title||'Sans titre',
      artist:x?.snippet?.channelTitle||'YouTube',
      thumbnail:x?.snippet?.thumbnails?.high?.url||x?.snippet?.thumbnails?.medium?.url||x?.snippet?.thumbnails?.default?.url
    })).filter(x=>x.id);
    renderResults(items);
  }catch(e){
    r.className='empty';
    r.innerHTML='<b>Erreur de recherche YouTube</b><br><br>'+esc(e?.message||String(e));
  }
}

function playTrack(t,index=-1){
  S.current=t;if(index>=0)S.index=index;
  $('#resultsView').hidden=true;$('#nowPlaying').hidden=false;
  $('#title').textContent=t.title;$('#artist').textContent=t.artist;
  $('#cover').style.backgroundImage=`url("${String(t.thumbnail).replace(/"/g,'')}")`;
  $('#vinylLabel').style.backgroundImage=`url("${String(t.thumbnail).replace(/"/g,'')}")`;
  setAmbient(t.thumbnail,t.id||t.title);
  const stage=$('#artworkStage');stage.style.animation='none';void stage.offsetWidth;stage.style.animation='';
  $('#videoPanel').classList.add('show');$('#videoPanel').classList.remove('mini');
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

function collapseVideo(){
  const panel=$('#videoPanel');
  const playing=S.ready&&S.player.getPlayerState()===YT.PlayerState.PLAYING;
  if(playing){panel.classList.add('show','mini');return}
  panel.classList.remove('show','mini');
}
function expandVideo(){const panel=$('#videoPanel');panel.classList.add('show');panel.classList.remove('mini')}

$('#go').onclick=search;
$('#q').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search()}};
$('#play').onclick=()=>{if(!S.current)return toast('Choisis une musique');S.player.getPlayerState()===YT.PlayerState.PLAYING?S.player.pauseVideo():S.player.playVideo()};
$('#prev').onclick=prevTrack;$('#next').onclick=nextTrack;
$('#progress').oninput=e=>{if(S.ready)S.player.seekTo((S.player.getDuration()||0)*(+e.target.value/1000),true)};
$('#volume').oninput=e=>S.ready&&S.player.setVolume(+e.target.value);
$('#showVideo').onclick=()=>{const p=$('#videoPanel');p.classList.contains('show')&&!p.classList.contains('mini')?collapseVideo():expandVideo()};
$('#closeVideo').onclick=collapseVideo;