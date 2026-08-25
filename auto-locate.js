(()=>{
  'use strict';

  let marker=null;
  let accuracyCircle=null;
  let startupWatchId=null;
  let hasExactFix=false;
  let comparedNetwork=false;

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

  function saveGps(lat,lon,accuracy=0){
    try{
      localStorage.setItem(LAST_KEY,JSON.stringify({lat,lon,accuracy,t:Date.now()}));
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

  function applyLocation(lat,lon,{accuracy=0,source='gps',label='',center=true}={}){
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

    if(accuracyCircle){
      map.removeLayer(accuracyCircle);
      accuracyCircle=null;
    }
    if(precise&&accuracy>0&&accuracy<5000){
      accuracyCircle=L.circle([lat,lon],{radius:accuracy,weight:1,fillOpacity:.06,opacity:.3}).addTo(map);
    }

    if(center){
      map.flyTo([lat,lon],precise?17:remembered?16:12,{duration:.7});
    }

    const title=$('title'),sub=$('sub');
    if(title&&sub&&title.textContent.trim()==='Explore le monde'){
      if(precise) sub.textContent=`Position GPS détectée${accuracy?` • précision ±${Math.round(accuracy)} m`:''}`;
      else if(remembered) sub.textContent='Dernière position GPS connue • recherche GPS en cours…';
      else sub.textContent=`Position approximative par réseau${label?` • ${label}`:''} • VPN possible`;
    }
    return true;
  }

  async function compareWithNetwork(lat,lon){
    if(comparedNetwork) return;
    comparedNetwork=true;
    const ip=await getIpLocation();
    if(!ip) return;
    const km=distanceKm({lat,lon},ip);
    if(km>150) toast('VPN possible détecté — position GPS conservée');
  }

  function acceptExactPosition(position,{forceCenter=false}={}){
    const c=position?.coords;
    if(!c||!Number.isFinite(+c.latitude)||!Number.isFinite(+c.longitude)) return false;

    const first=!hasExactFix;
    hasExactFix=true;
    const lat=+c.latitude,lon=+c.longitude,accuracy=+c.accuracy||0;
    saveGps(lat,lon,accuracy);
    applyLocation(lat,lon,{accuracy,source:'gps',center:first||forceCenter});
    if(first) compareWithNetwork(lat,lon);
    return true;
  }

  function startStartupWatch(){
    if(!navigator.geolocation||startupWatchId!==null) return;

    try{
      startupWatchId=navigator.geolocation.watchPosition(
        position=>{
          acceptExactPosition(position);
        },
        ()=>{
          // Le bouton manuel reste disponible. On ne remplace pas automatiquement
          // une vraie dernière position GPS par une position VPN approximative.
        },
        {
          enableHighAccuracy:true,
          maximumAge:0,
          timeout:30000
        }
      );
    }catch{}
  }

  async function manualLocate(){
    let gps=null;
    try{
      gps=await getPosition({enableHighAccuracy:true,maximumAge:0,timeout:15000});
    }catch{
      try{
        gps=await getPosition({enableHighAccuracy:false,maximumAge:30000,timeout:8000});
      }catch{}
    }

    if(gps){
      acceptExactPosition(gps,{forceCenter:true});
      return true;
    }

    const ip=await getIpLocation();
    if(ip){
      const label=[ip.city,ip.country].filter(Boolean).join(', ');
      applyLocation(ip.lat,ip.lon,{source:'ip',label,center:true});
      toast('GPS indisponible — position réseau approximative (VPN possible)');
      return false;
    }

    toast('Position GPS indisponible');
    return false;
  }

  async function init(){
    for(let i=0;i<50&&!window.NOVA_MAP;i++) await sleep(100);
    const button=$('loc');
    if(!button) return;

    // Le bouton manuel continue d'utiliser le chemin GPS qui fonctionne déjà.
    button.onclick=manualLocate;

    // Démarrage : on écoute réellement le GPS jusqu'au premier fix précis.
    startStartupWatch();

    // Si une vraie position GPS récente existe, on l'affiche pendant l'acquisition.
    const last=getLastGps();
    if(last&&!hasExactFix){
      applyLocation(last.lat,last.lon,{accuracy:last.accuracy,source:'last',center:true});
    }

    // Tentative getCurrentPosition complète, sans le timeout de 3,5 s de l'ancienne version.
    setTimeout(async()=>{
      if(hasExactFix) return;
      try{
        const gps=await getPosition({enableHighAccuracy:true,maximumAge:0,timeout:20000});
        acceptExactPosition(gps,{forceCenter:true});
      }catch{}
    },700);

    window.addEventListener('pageshow',e=>{
      if(e.persisted){
        startupWatchId=null;
        startStartupWatch();
      }
    });
  }

  window.NOVA_LOCATE_ROBUST=manualLocate;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
