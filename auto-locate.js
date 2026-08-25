(()=>{
  'use strict';
  let marker=null, accuracyCircle=null, gpsSeq=0;
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const LAST_KEY='novaLastGps';
  const LAST_MAX_AGE=6*60*60*1000;

  function toast(text){
    const e=$('toast');
    if(!e) return;
    e.textContent=text;
    e.style.display='block';
    clearTimeout(e._geoTimer);
    e._geoTimer=setTimeout(()=>e.style.display='none',3200);
  }

  function getPosition(options){
    return new Promise((resolve,reject)=>{
      if(!navigator.geolocation) return reject(new Error('geolocation unavailable'));
      navigator.geolocation.getCurrentPosition(resolve,reject,options);
    });
  }

  function saveLastGps(gps){
    try{
      localStorage.setItem(LAST_KEY,JSON.stringify({
        lat:gps.coords.latitude,
        lon:gps.coords.longitude,
        accuracy:gps.coords.accuracy||0,
        t:Date.now()
      }));
    }catch{}
  }

  function getLastGps(){
    try{
      const d=JSON.parse(localStorage.getItem(LAST_KEY)||'null');
      if(!d||!Number.isFinite(+d.lat)||!Number.isFinite(+d.lon)||Date.now()-Number(d.t)>LAST_MAX_AGE) return null;
      return {lat:+d.lat,lon:+d.lon,accuracy:+d.accuracy||0,t:+d.t};
    }catch{return null;}
  }

  function distanceKm(a,b){
    const R=6371,toRad=x=>x*Math.PI/180;
    const dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon);
    const q=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(q));
  }

  async function getIpLocation(){
    try{
      const r=await fetch('/api/ip-location',{cache:'no-store'});
      if(!r.ok) return null;
      const d=await r.json();
      if(!d.ok||!Number.isFinite(+d.latitude)||!Number.isFinite(+d.longitude)) return null;
      return {lat:+d.latitude,lon:+d.longitude,city:d.city||'',country:d.country||'',region:d.region||''};
    }catch{return null;}
  }

  function applyLocation(lat,lon,{accuracy=0,source='gps',label=''}={}){
    const map=window.NOVA_MAP;
    if(!map||!window.L) return false;
    const precise=source==='gps';
    const remembered=source==='last';
    const tooltip=precise?'Vous':remembered?'Dernière position':'Position approximative';
    const icon=L.divIcon({className:'',html:'<div class="user"></div>',iconSize:[18,18],iconAnchor:[9,9]});
    if(marker){
      marker.setLatLng([lat,lon]);
      marker.setTooltipContent(tooltip);
    }else{
      marker=L.marker([lat,lon],{icon}).addTo(map).bindTooltip(tooltip,{permanent:true,direction:'bottom'});
    }
    if(accuracyCircle){map.removeLayer(accuracyCircle);accuracyCircle=null;}
    if(precise&&accuracy>0&&accuracy<5000){
      accuracyCircle=L.circle([lat,lon],{radius:accuracy,weight:1,fillOpacity:.06,opacity:.3}).addTo(map);
    }
    map.flyTo([lat,lon],precise?17:remembered?16:12,{duration:.7});
    const title=$('title'),sub=$('sub');
    if(title&&sub&&title.textContent.trim()==='Explore le monde'){
      if(precise) sub.textContent=`Position GPS détectée${accuracy?` • précision ±${Math.round(accuracy)} m`:''}`;
      else if(remembered) sub.textContent='Dernière position GPS connue • actualisation au prochain toucher';
      else sub.textContent=`Position approximative par réseau${label?` • ${label}`:''} • VPN possible`;
    }
    return true;
  }

  async function compareWithNetwork(gps){
    const ip=await getIpLocation();
    if(!ip) return;
    const km=distanceKm({lat:gps.coords.latitude,lon:gps.coords.longitude},ip);
    if(km>150) toast('VPN possible détecté — position GPS conservée');
  }

  async function requestPrecise({showFailure=false,fallbackToIp=false,automatic=false}={}){
    const id=++gpsSeq;
    let gps=null;
    try{
      gps=await getPosition({enableHighAccuracy:true,maximumAge:automatic?30000:0,timeout:automatic?3500:8000});
    }catch{
      if(!automatic){
        try{gps=await getPosition({enableHighAccuracy:false,maximumAge:60000,timeout:6000});}catch{}
      }
    }
    if(id!==gpsSeq&&automatic) return false;
    if(gps){
      saveLastGps(gps);
      applyLocation(gps.coords.latitude,gps.coords.longitude,{accuracy:gps.coords.accuracy||0,source:'gps'});
      compareWithNetwork(gps);
      return true;
    }
    if(fallbackToIp){
      const ip=await getIpLocation();
      if(ip){
        const label=[ip.city,ip.country].filter(Boolean).join(', ');
        applyLocation(ip.lat,ip.lon,{source:'ip',label});
        toast('GPS indisponible — position réseau approximative (VPN possible)');
        return false;
      }
    }
    if(showFailure) toast('Position GPS indisponible');
    return false;
  }

  async function showBestImmediateFallback(){
    const last=getLastGps();
    if(last){
      applyLocation(last.lat,last.lon,{accuracy:last.accuracy,source:'last'});
      return;
    }
    const ip=await getIpLocation();
    if(ip){
      const label=[ip.city,ip.country].filter(Boolean).join(', ');
      applyLocation(ip.lat,ip.lon,{source:'ip',label});
    }
  }

  function armFirstTrustedGesture(){
    let fired=false;
    const events=['pointerdown','touchstart','keydown'];
    const run=()=>{
      if(fired) return;
      fired=true;
      for(const type of events) window.removeEventListener(type,run,true);
      // Important iOS/WebView : l'appel geolocation démarre pendant le vrai geste utilisateur.
      requestPrecise({showFailure:false,fallbackToIp:false,automatic:false});
    };
    for(const type of events) window.addEventListener(type,run,{capture:true,passive:true,once:false});
  }

  async function init(){
    for(let i=0;i<40&&!window.NOVA_MAP;i++) await sleep(100);
    const button=$('loc');
    if(!button) return;

    // Le bouton reste le chemin manuel fiable et complet.
    button.onclick=()=>requestPrecise({showFailure:true,fallbackToIp:true,automatic:false});

    // Centre immédiatement la carte sans attendre une autorisation GPS.
    showBestImmediateFallback();

    // Si le navigateur a déjà mémorisé l'autorisation, ceci peut réussir sans interaction.
    setTimeout(()=>requestPrecise({showFailure:false,fallbackToIp:false,automatic:true}),250);

    // Sur iPhone / WebView, un vrai geste peut être requis : le premier toucher n'importe où suffit.
    armFirstTrustedGesture();

    window.addEventListener('pageshow',e=>{
      if(e.persisted){
        showBestImmediateFallback();
        armFirstTrustedGesture();
      }
    });
  }

  window.NOVA_LOCATE_ROBUST=()=>requestPrecise({showFailure:true,fallbackToIp:true,automatic:false});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
