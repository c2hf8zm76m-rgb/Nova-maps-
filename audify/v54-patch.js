(()=>{
  'use strict';
  let overlay=null,checking=false,bufferingSince=0,lastTrackId='',trackSince=0,lastProbeAt=0;
  const now=()=>Date.now();
  const current=()=>{try{return (typeof S!=='undefined'&&S)?S.current:null}catch{return null}};
  const player=()=>{try{return (typeof S!=='undefined'&&S&&S.ready&&S.p)?S.p:null}catch{return null}};

  function ensureUI(){
    if(overlay&&overlay.isConnected)return overlay;
    overlay=document.querySelector('#v54NetOverlay');
    if(!overlay){
      overlay=document.createElement('div');overlay.id='v54NetOverlay';overlay.className='v54-net-overlay';
      overlay.innerHTML='<div class="v54-net-card"><div class="v54-sad-wifi" aria-hidden="true"><span class="v54-wifi-arc a1"></span><span class="v54-wifi-arc a2"></span><span class="v54-wifi-arc a3"></span><span class="v54-wifi-dot"></span><div class="v54-wifi-face"><i class="v54-eye e1"></i><i class="v54-eye e2"></i><i class="v54-mouth"></i></div></div><div class="v54-ground"></div><h3>Pas de connexion internet</h3><p id="v54NetText">Audify ne reçoit plus Internet. Vérifie le Wi‑Fi ou les données mobiles, puis réessaie.</p><span class="v54-net-badge"><i></i> HORS LIGNE</span><div class="v54-net-actions"><button id="v54NetRetry" class="v54-net-retry" type="button">Réessayer</button><button id="v54NetClose" class="v54-net-close" type="button">Fermer</button></div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('#v54NetRetry').addEventListener('click',retry);
      overlay.querySelector('#v54NetClose').addEventListener('click',hide);
    }
    return overlay;
  }
  function show(msg){const o=ensureUI();const p=o.querySelector('#v54NetText');if(msg&&p)p.textContent=msg;o.classList.add('show');}
  function hide(){ensureUI().classList.remove('show')}

  function oneProbe(url){
    return new Promise(resolve=>{
      const ctrl=new AbortController();const timer=setTimeout(()=>{try{ctrl.abort()}catch{};resolve(false)},3200);
      fetch(url+(url.includes('?')?'&':'?')+'audify='+now(),{mode:'no-cors',cache:'no-store',signal:ctrl.signal})
        .then(()=>{clearTimeout(timer);resolve(true)})
        .catch(()=>{clearTimeout(timer);resolve(false)});
    });
  }
  async function probe(){
    if(!navigator.onLine)return false;
    if(checking)return null;
    checking=true;lastProbeAt=now();
    try{
      const r=await Promise.all([oneProbe('https://www.gstatic.com/generate_204'),oneProbe('https://www.cloudflare.com/cdn-cgi/trace')]);
      return r.some(Boolean);
    }finally{checking=false}
  }
  async function confirmOffline(message){
    if(!navigator.onLine){show(message);return true}
    const ok=await probe();
    if(ok===false){show(message);return true}
    if(ok===true)hide();
    return false;
  }
  async function retry(){
    const b=ensureUI().querySelector('#v54NetRetry');const old=b.textContent;b.disabled=true;b.textContent='Vérification…';
    const ok=await probe();b.disabled=false;b.textContent=old;
    if(ok){hide();try{if(typeof toast==='function')toast('Connexion rétablie')}catch{};const p=player();try{if(p&&current())p.playVideo()}catch{}}
    else show('Toujours aucune connexion. Vérifie le Wi‑Fi ou les données mobiles, puis réessaie.');
  }

  function inspectPlayer(){
    const t=current(),p=player();
    if(t?.id!==lastTrackId){lastTrackId=t?.id||'';trackSince=t?now():0;bufferingSince=0}
    if(!t||!p)return;
    let state;try{state=p.getPlayerState()}catch{return}
    if(state===1){bufferingSince=0;hide();return}
    if(state===3){
      if(!bufferingSince)bufferingSince=now();
      if(now()-bufferingSince>2800&&now()-lastProbeAt>4500)confirmOffline('La musique n’arrive pas à charger car Audify ne reçoit plus Internet. Vérifie ta connexion puis réessaie.');
    }else bufferingSince=0;
    if(trackSince&&now()-trackSince>5200&&(state===-1||state===5)&&now()-lastProbeAt>4500){
      confirmOffline('Cette musique ne démarre pas et Audify ne détecte pas de connexion Internet. Vérifie ton réseau puis réessaie.');
    }
  }

  function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw-v54.js',{scope:'./'}).catch(()=>{})}
  function boot(){
    ensureUI();registerSW();
    if(!navigator.onLine)show('Audify est hors ligne. Vérifie le Wi‑Fi ou les données mobiles pour rechercher et écouter de la musique.');
    window.addEventListener('offline',()=>show('Connexion perdue. Audify ne peut plus charger de nouvelles musiques tant que le réseau n’est pas revenu.'));
    window.addEventListener('online',()=>setTimeout(()=>probe().then(ok=>{if(ok){hide();try{if(typeof toast==='function')toast('Connexion rétablie')}catch{}}}),350));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!navigator.onLine)show('Audify est hors ligne. Vérifie ta connexion Internet puis réessaie.')});
    document.addEventListener('click',e=>{
      const launch=e.target.closest('#go,[data-p],[data-play],[data-fav-play],.v48-recent-card,.v50-sheet-item');
      if(launch&&!navigator.onLine){e.preventDefault();e.stopImmediatePropagation();show('Aucune connexion Internet détectée. Reconnecte-toi avant de lancer cette action.');}
    },true);
    setInterval(inspectPlayer,650);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();