(()=>{
  'use strict';

  const FILE_NAME='audify-sync-v66.json';
  const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.appdata';
  const ID_SCOPES='openid email profile';
  const SYNC_KEYS=['audify_favorites_v1','audify_recent_v48','audify_reco_profile_v65','audify_reco_artist_meta_v65','audify_reco_results_v65','audify_lyrics_sync_v40'];
  const DEVICE_KEY='audify_sync_device_v66';
  const LAST_SYNC_KEY='audify_sync_last_v66';
  let webToken='',webTokenUntil=0,webUser=null,webTokenClient=null;
  let connected=false,syncing=false,lastError='',nativeUser=null,pendingReload=false;

  const native=()=>{try{return window.AudifyNative||null}catch{return null}};
  const isNative=()=>!!native()?.googleConnect;
  const parse=s=>{try{return JSON.parse(String(s||''))}catch{return null}};
  const readJSON=(k,f=null)=>{try{const s=localStorage.getItem(k);return s==null?f:JSON.parse(s)}catch{return f}};
  const writeJSON=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const now=()=>Date.now();

  function deviceId(){
    let id='';try{id=localStorage.getItem(DEVICE_KEY)||''}catch{}
    if(!id){id='dev-'+Math.random().toString(36).slice(2)+Date.now().toString(36);try{localStorage.setItem(DEVICE_KEY,id)}catch{}}
    return id;
  }

  function buildPayload(){
    const data={};
    for(const k of SYNC_KEYS){const v=readJSON(k,undefined);if(v!==undefined)data[k]=v}
    return {version:66,updatedAt:now(),deviceId:deviceId(),data};
  }

  function mergeArrayById(a,b,max=100){
    const out=[],seen=new Set();
    for(const x of [...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])]){
      const id=String(x?.id||'');if(!id||seen.has(id))continue;seen.add(id);out.push(x);if(out.length>=max)break;
    }
    return out;
  }

  function mergeProfile(a,b){
    a=a&&typeof a==='object'?a:{};b=b&&typeof b==='object'?b:{};
    const out={version:1,artists:{},likedIds:{},updatedAt:Math.max(Number(a.updatedAt)||0,Number(b.updatedAt)||0)};
    const keys=new Set([...Object.keys(a.artists||{}),...Object.keys(b.artists||{})]);
    for(const k of keys){
      const x=a.artists?.[k]||{},y=b.artists?.[k]||{};
      const newer=(Number(x.lastAt)||0)>=(Number(y.lastAt)||0)?x:y;
      out.artists[k]={
        name:newer.name||x.name||y.name||k,
        score:Math.max(Number(x.score)||0,Number(y.score)||0),
        listens:Math.max(Number(x.listens)||0,Number(y.listens)||0),
        likes:Math.max(Number(x.likes)||0,Number(y.likes)||0),
        skips:Math.max(Number(x.skips)||0,Number(y.skips)||0),
        lastAt:Math.max(Number(x.lastAt)||0,Number(y.lastAt)||0),
        thumbnail:newer.thumbnail||x.thumbnail||y.thumbnail||''
      };
    }
    for(const src of [a.likedIds||{},b.likedIds||{}])for(const [k,v] of Object.entries(src))out.likedIds[k]=Math.max(Number(out.likedIds[k])||0,Number(v)||0);
    return out;
  }

  function mergeTimedMap(a,b){
    a=a&&typeof a==='object'?a:{};b=b&&typeof b==='object'?b:{};const out={};
    for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
      const x=a[k],y=b[k];
      if(x==null){out[k]=y;continue}if(y==null){out[k]=x;continue}
      out[k]=(Number(x?.at)||0)>=(Number(y?.at)||0)?x:y;
    }
    return out;
  }

  function mergePayload(local,remote){
    local=local&&typeof local==='object'?local:buildPayload();remote=remote&&typeof remote==='object'?remote:{data:{}};
    const ld=local.data||{},rd=remote.data||{},data={};
    data.audify_favorites_v1=mergeArrayById(ld.audify_favorites_v1,rd.audify_favorites_v1,300);
    data.audify_recent_v48=mergeArrayById(ld.audify_recent_v48,rd.audify_recent_v48,50);
    data.audify_reco_profile_v65=mergeProfile(ld.audify_reco_profile_v65,rd.audify_reco_profile_v65);
    data.audify_reco_artist_meta_v65=mergeTimedMap(ld.audify_reco_artist_meta_v65,rd.audify_reco_artist_meta_v65);
    data.audify_reco_results_v65=mergeTimedMap(ld.audify_reco_results_v65,rd.audify_reco_results_v65);
    data.audify_lyrics_sync_v40=Object.assign({},rd.audify_lyrics_sync_v40||{},ld.audify_lyrics_sync_v40||{});
    return {version:66,updatedAt:now(),deviceId:deviceId(),data};
  }

  function applyPayload(p){
    if(!p?.data)return false;let changed=false;
    for(const [k,v] of Object.entries(p.data)){
      const before=localStorage.getItem(k);const after=JSON.stringify(v);
      if(before!==after){try{localStorage.setItem(k,after);changed=true}catch{}}
    }
    try{localStorage.setItem(LAST_SYNC_KEY,String(now()))}catch{}
    return changed;
  }

  function statusText(){
    if(syncing)return 'Synchronisation avec Google Drive…';
    if(lastError)return lastError;
    if(connected){const t=Number(localStorage.getItem(LAST_SYNC_KEY)||0);return t?'Synchronisé • '+new Date(t).toLocaleString():'Compte Google connecté • prêt à synchroniser';}
    if(!isNative()&&!String(window.AUDIFY_GOOGLE_WEB_CLIENT_ID||'').trim())return 'Mode local • ajoute un client OAuth Web pour activer Google sur navigateur';
    return 'Mode local • connexion Google facultative';
  }

  function ensureCard(){
    const r=document.querySelector('#results');if(!r||!r.classList.contains('home-view'))return null;
    let sec=document.querySelector('#v66Account');
    if(!sec){
      sec=document.createElement('section');sec.id='v66Account';sec.className='v66-account';
      sec.innerHTML='<div class="v66-account-head"><div class="v66-account-copy"><small>Synchronisation</small><h3>Compte Google</h3><p>Audify reste local-first. Google Drive sert seulement de sauvegarde privée et de synchronisation entre tes appareils.</p></div><div class="v66-actions"><div id="v66User" class="v66-account-user"><img id="v66Avatar" class="v66-avatar" alt=""><div class="v66-usertext"><b id="v66Name"></b><span id="v66Email"></span></div></div><button id="v66Connect" class="v66-btn primary" type="button">Connecter Google</button><button id="v66Sync" class="v66-btn" type="button">Synchroniser</button><button id="v66Disconnect" class="v66-btn danger" type="button">Déconnecter</button></div></div><div id="v66Status" class="v66-status"><span class="v66-dot"></span><span id="v66StatusText"></span></div>';
      const fy=document.querySelector('#v65ForYou');if(fy?.parentNode===r)r.insertBefore(sec,fy);else r.appendChild(sec);
      sec.querySelector('#v66Connect').addEventListener('click',connect);
      sec.querySelector('#v66Sync').addEventListener('click',syncNow);
      sec.querySelector('#v66Disconnect').addEventListener('click',disconnect);
    }
    renderCard();return sec;
  }

  function renderCard(){
    const sec=document.querySelector('#v66Account');if(!sec)return;
    const u=nativeUser||webUser;const user=sec.querySelector('#v66User');
    user.classList.toggle('show',!!u);
    sec.querySelector('#v66Name').textContent=u?.name||'Compte Google';sec.querySelector('#v66Email').textContent=u?.email||'';
    const av=sec.querySelector('#v66Avatar');if(u?.picture){av.src=u.picture;av.style.visibility='visible'}else{av.removeAttribute('src');av.style.visibility='hidden'}
    const connectBtn=sec.querySelector('#v66Connect'),syncBtn=sec.querySelector('#v66Sync'),disc=sec.querySelector('#v66Disconnect');
    connectBtn.style.display=connected?'none':'';syncBtn.style.display=connected?'':'none';disc.style.display=connected?'':'none';syncBtn.disabled=syncing;
    const st=sec.querySelector('#v66Status');st.classList.toggle('connected',connected&&!syncing&&!lastError);st.classList.toggle('syncing',syncing);st.classList.toggle('error',!!lastError);sec.querySelector('#v66StatusText').textContent=statusText();
  }

  function emitError(msg){lastError=String(msg||'Erreur Google');syncing=false;renderCard();try{toast(lastError)}catch{}}
  function emitConnected(user){connected=true;lastError='';if(user){if(isNative())nativeUser=user;else webUser=user}renderCard();}

  async function loadGIS(){
    if(window.google?.accounts?.oauth2)return;
    await new Promise((resolve,reject)=>{const old=document.querySelector('script[data-audify-gis]');if(old){old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return}const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;s.dataset.audifyGis='1';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  }

  async function fetchUserInfo(token){
    try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+token}});if(!r.ok)return null;const j=await r.json();return {name:j.name||'',email:j.email||'',picture:j.picture||''}}catch{return null}
  }

  async function connectWeb(){
    const cid=String(window.AUDIFY_GOOGLE_WEB_CLIENT_ID||'').trim();
    if(!cid){emitError('Connexion Google Web non configurée : ajoute l’ID client OAuth Web dans google-sync-config.js.');return}
    try{
      await loadGIS();
      if(!webTokenClient)webTokenClient=google.accounts.oauth2.initTokenClient({client_id:cid,scope:DRIVE_SCOPE+' '+ID_SCOPES,callback:async r=>{
        if(r.error){emitError('Google : '+r.error);return}webToken=r.access_token||'';webTokenUntil=now()+(Number(r.expires_in)||3600)*1000-60000;webUser=await fetchUserInfo(webToken);emitConnected(webUser);syncWeb().catch(e=>emitError(e.message));
      }});
      webTokenClient.requestAccessToken({prompt:webToken?'':'consent'});
    }catch(e){emitError('Google indisponible : '+(e?.message||e))}
  }

  async function driveFetch(url,opt={}){
    if(!webToken||now()>webTokenUntil)throw new Error('Session Google expirée, reconnecte-toi.');
    opt.headers=Object.assign({},opt.headers||{},{Authorization:'Bearer '+webToken});const r=await fetch(url,opt);if(!r.ok){const t=await r.text().catch(()=>String(r.status));throw new Error('Google Drive '+r.status+' '+t.slice(0,100))}return r;
  }

  async function webFindFile(){
    const q=encodeURIComponent("name='"+FILE_NAME+"' and trashed=false");
    const r=await driveFetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=10&fields=files(id,name,modifiedTime)&q='+q);const j=await r.json();return j.files?.[0]||null;
  }
  async function webRead(file){if(!file)return null;const r=await driveFetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.id)+'?alt=media');return parse(await r.text())}
  async function webWrite(payload,file){
    const body=JSON.stringify(payload);
    if(file){await driveFetch('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(file.id)+'?uploadType=media&fields=id',{method:'PATCH',headers:{'Content-Type':'application/json'},body});return}
    const boundary='audifyv66'+Math.random().toString(36).slice(2);const meta=JSON.stringify({name:FILE_NAME,parents:['appDataFolder'],mimeType:'application/json'});
    const multipart='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+body+'\r\n--'+boundary+'--';
    await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body:multipart});
  }

  async function syncWeb(){
    if(syncing)return;syncing=true;lastError='';renderCard();
    try{const file=await webFindFile();const remote=await webRead(file);const merged=mergePayload(buildPayload(),remote);const changed=applyPayload(merged);await webWrite(merged,file);syncing=false;connected=true;renderCard();try{toast('Audify synchronisé avec Google Drive')}catch{}if(changed){pendingReload=true;setTimeout(()=>location.reload(),450)}}catch(e){emitError(e.message)}
  }

  function connect(){
    lastError='';renderCard();
    if(isNative()){try{native().googleConnect()}catch(e){emitError(e.message)};return}
    connectWeb();
  }
  function syncNow(){
    if(syncing)return;
    if(!connected){connect();return}
    if(isNative()){
      syncing=true;lastError='';renderCard();
      try{native().googleSync(JSON.stringify(buildPayload()))}catch(e){emitError(e.message)}
    }else syncWeb();
  }
  function disconnect(){
    if(isNative()){try{native().googleDisconnect()}catch{}nativeUser=null;connected=false;lastError='';renderCard();return}
    try{if(webToken&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(webToken,()=>{})}catch{}
    webToken='';webTokenUntil=0;webUser=null;connected=false;lastError='';renderCard();
  }

  function nativeEvent(ev){
    const d=ev?.detail||{};
    if(d.type==='connected'){nativeUser={name:d.name||'',email:d.email||'',picture:d.picture||''};emitConnected(nativeUser);if(d.autoSync)syncNow();return}
    if(d.type==='remote'){
      try{const remote=parse(d.payload);const merged=mergePayload(buildPayload(),remote);const changed=applyPayload(merged);pendingReload=pendingReload||changed;native().googleUpload(JSON.stringify(merged),String(d.fileId||''));}catch(e){emitError(e.message)}return;
    }
    if(d.type==='synced'){syncing=false;connected=true;lastError='';try{localStorage.setItem(LAST_SYNC_KEY,String(now()))}catch{}renderCard();try{toast('Audify synchronisé avec Google Drive')}catch{}if(pendingReload){pendingReload=false;setTimeout(()=>location.reload(),450)}return;
    if(d.type==='disconnected'){nativeUser=null;connected=false;syncing=false;lastError='';renderCard();return}
    if(d.type==='error'){emitError(d.message||'Erreur Google');return}
  }
  window.addEventListener('audify-google-native',nativeEvent);

  function probeNative(){
    if(!isNative())return;
    try{const s=parse(native().googleStatus());if(s?.connected){connected=true;nativeUser={name:s.name||'',email:s.email||'',picture:s.picture||''}}}catch{}
  }

  let lastSignature='';
  function dataSignature(){return SYNC_KEYS.map(k=>{try{return localStorage.getItem(k)||''}catch{return ''}}).join('|').length+':'+String(readJSON('audify_reco_profile_v65',{})?.updatedAt||0)+':'+String(readJSON('audify_favorites_v1',[])?.length||0)}
  function autoSync(){
    if(!connected||syncing)return;const sig=dataSignature();if(!lastSignature){lastSignature=sig;return}if(sig===lastSignature)return;lastSignature=sig;syncNow();
  }

  function boot(){probeNative();ensureCard();setInterval(ensureCard,600);setInterval(autoSync,10*60*1000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')autoSync()});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
