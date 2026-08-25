(()=>{
  'use strict';
  let marker=null, accuracyCircle=null, running=false;
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

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
      if(!d.ok || !Number.isFinite(+d.latitude) || !Number.isFinite(+d.longitude)) return null;
      return {lat:+d.latitude,lon:+d.longitude,city:d.city||'',country:d.country||'',region:d.region||''};
    }catch{return null;}
  }

  function applyLocation(lat,lon,{accuracy=0,source='gps',label=''}={}){
    const map=window.NOVA_MAP;
    if(!map || !window.L) return false;
    const precise=source==='gps';
    const icon=L.divIcon({className:'',html:'<div class="user"></div>',iconSize:[18,18],iconAnchor:[9,9]});
    if(marker){
      marker.setLatLng([lat,lon]);
      marker.setTooltipContent(precise?'Vous':'Position approximative');
    }else{
      marker=L.marker([lat,lon],{icon}).addTo(map).bindTooltip(precise?'Vous':'Position approximative',{permanent:true,direction:'bottom'});
    }
    if(accuracyCircle){ map.removeLayer(accuracyCircle); accuracyCircle=null; }
    if(precise && accuracy>0 && accuracy<5000){
      accuracyCircle=L.circle([lat,lon],{radius:accuracy,weight:1,fillOpacity:.06,opacity:.3}).addTo(map);
    }
    map.flyTo([lat,lon],precise?17:12,{duration:.7});
    const title=$('title'),sub=$('sub');
    if(title && sub && title.textContent.trim()==='Explore le monde'){
      sub.textContent=precise
        ? `Position GPS détectée${accuracy?` • précision ±${Math.round(accuracy)} m`:''}`
        : `Position approximative par réseau${label?` • ${label}`:''} • VPN possible`;
    }
    return true;
  }

  async function compareWithNetwork(gps){
    const ip=await getIpLocation();
    if(!ip) return;
    const km=distanceKm({lat:gps.coords.latitude,lon:gps.coords.longitude},ip);
    if(km>150) toast('VPN possible détecté — position GPS conservée');
  }

  async function locateRobust(showFailure=true){
    if(running) return;
    running=true;
    try{
      let gps=null;
      try{
        gps=await getPosition({enableHighAccuracy:true,maximumAge:0,timeout:8000});
      }catch{
        try{gps=await getPosition({enableHighAccuracy:false,maximumAge:60000,timeout:6000});}catch{}
      }

      if(gps){
        applyLocation(gps.coords.latitude,gps.coords.longitude,{accuracy:gps.coords.accuracy||0,source:'gps'});
        compareWithNetwork(gps);
        return;
      }

      const ip=await getIpLocation();
      if(ip){
        const label=[ip.city,ip.country].filter(Boolean).join(', ');
        applyLocation(ip.lat,ip.lon,{source:'ip',label});
        toast('GPS indisponible — position réseau approximative (VPN possible)');
        return;
      }

      if(showFailure) toast('Position indisponible');
    }finally{
      running=false;
    }
  }

  async function init(){
    for(let i=0;i<40 && !window.NOVA_MAP;i++) await sleep(100);
    const button=$('loc');
    if(!button) return;

    // Le bouton reste la source unique de vérité pour la géolocalisation.
    button.onclick=()=>locateRobust(true);

    // Au lancement, NOVA effectue exactement le même chemin qu'un appui manuel.
    const autoPress=()=>setTimeout(()=>{
      if(!running && document.visibilityState!=='hidden') button.click();
    },450);

    if(document.readyState==='complete') autoPress();
    else window.addEventListener('load',autoPress,{once:true});

    // Si Safari restaure la page depuis son cache arrière, on relance le même bouton.
    window.addEventListener('pageshow',e=>{
      if(e.persisted) setTimeout(()=>{ if(!running) button.click(); },350);
    });
  }

  window.NOVA_LOCATE_ROBUST=locateRobust;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
