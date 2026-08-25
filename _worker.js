const MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

function n(v){ const x=Number(v); return Number.isFinite(x)?x:null; }
function q4(x, step=0.01){ return Math.round(x/step)*step; }
function json(data,status=200,extra={}){
  return new Response(JSON.stringify(data),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'public, max-age=60, s-maxage=1800, stale-while-revalidate=21600',
    'permissions-policy':'geolocation=(self)',
    ...extra
  }});
}
async function staticResponse(request,env){
  const r=await env.ASSETS.fetch(request);
  const h=new Headers(r.headers);
  h.set('Permissions-Policy','geolocation=(self)');
  return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h});
}
function dedupe(a=[]){
  const seen=new Set(), out=[];
  for(const el of a){
    const lat=el.lat??el.center?.lat, lon=el.lon??el.center?.lon;
    const k=`${el.type||''}:${el.id||''}:${lat||''}:${lon||''}`;
    if(seen.has(k)) continue;
    seen.add(k); out.push(el);
  }
  return out;
}
async function overpass(query, deadlineMs=11000){
  const body='data='+encodeURIComponent(query);
  const deadline=Date.now()+deadlineMs;
  let last='';
  for(const mirror of MIRRORS){
    const remaining=deadline-Date.now();
    if(remaining<900) break;
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),Math.min(5200,remaining));
    try{
      const r=await fetch(mirror,{method:'POST',body,signal:ctl.signal,headers:{
        'content-type':'application/x-www-form-urlencoded;charset=UTF-8',
        'accept':'application/json',
        'user-agent':'NOVA-Maps/0.6.10.3 (Cloudflare POI cache)'
      }});
      if(!r.ok){ last=`${mirror} HTTP ${r.status}`; continue; }
      const data=await r.json();
      if(!Array.isArray(data.elements)){ last=`${mirror} réponse invalide`; continue; }
      return {elements:data.elements,source:mirror};
    }catch(err){ last=`${mirror} ${String(err?.name||err)}`; }
    finally{ clearTimeout(timer); }
  }
  throw new Error(last||'Overpass indisponible');
}

export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url);

    if(url.pathname==='/api/ip-location'){
      const cf=request.cf||{};
      const latitude=n(cf.latitude), longitude=n(cf.longitude);
      return json({
        ok:latitude!==null&&longitude!==null,
        latitude,longitude,
        city:cf.city||'',region:cf.region||'',country:cf.country||'',
        timezone:cf.timezone||'',colo:cf.colo||'',source:'cloudflare-network'
      },200,{'cache-control':'private, no-store'});
    }

    if(url.pathname!=='/api/pois') return staticResponse(request,env);

    const s=n(url.searchParams.get('s')), w=n(url.searchParams.get('w')),
          nn=n(url.searchParams.get('n')), e=n(url.searchParams.get('e'));
    if([s,w,nn,e].some(v=>v===null)||s>=nn||w>=e) return json({error:'bbox invalide'},400);
    if((nn-s)>.22||(e-w)>.28) return json({error:'zone trop grande'},400);

    const pad=.004;
    const S=q4(s-pad), W=q4(w-pad), N=q4(nn+pad), E=q4(e+pad);
    const box=`${S},${W},${N},${E}`;
    const base=`${url.origin}/__poi_v101/${S.toFixed(2)}/${W.toFixed(2)}/${N.toFixed(2)}/${E.toFixed(2)}`;
    const coreKey=new Request(base+'/core');
    const extraKey=new Request(base+'/extra');
    const cache=caches.default;

    const cachedCore=await cache.match(coreKey);
    const cachedExtra=await cache.match(extraKey);
    if(cachedCore){
      try{
        const coreData=await cachedCore.clone().json();
        if(cachedExtra){
          const extraData=await cachedExtra.clone().json();
          return json({elements:dedupe([...(coreData.elements||[]),...(extraData.elements||[])]),cached:true,tier:'merged'});
        }
        return json({elements:coreData.elements||[],cached:true,tier:'core'});
      }catch{}
    }

    const coreQuery=`[out:json][timeout:8];(nwr(${box})[name][amenity];nwr(${box})[name][shop];nwr(${box})[name][tourism];nwr(${box})[name][leisure];nwr(${box})[name][aeroway];nwr(${box})[name][railway];nwr(${box})[name][healthcare];nwr(${box})[name][public_transport];nwr(${box})[name][historic];);out center tags qt 650;`;
    const extraQuery=`[out:json][timeout:8];(nwr(${box})[name][emergency];nwr(${box})[name][sport];nwr(${box})[name][club];nwr(${box})[name][office];nwr(${box})[name][craft];nwr(${box})[name][natural=beach];);out center tags qt 300;`;

    try{
      const core=await overpass(coreQuery,11000);
      const coreResponse=json({elements:core.elements,source:core.source,cached:false,tier:'core'});
      ctx.waitUntil(cache.put(coreKey,coreResponse.clone()));

      ctx.waitUntil((async()=>{
        try{
          const extra=await overpass(extraQuery,9000);
          await cache.put(extraKey,json({elements:extra.elements,source:extra.source,cached:false,tier:'extra'}));
        }catch{}
      })());

      if(cachedExtra){
        try{
          const extraData=await cachedExtra.clone().json();
          return json({elements:dedupe([...core.elements,...(extraData.elements||[])]),source:core.source,cached:false,tier:'merged'});
        }catch{}
      }
      return coreResponse;
    }catch(err){
      if(cachedExtra){
        try{
          const extraData=await cachedExtra.clone().json();
          return json({elements:extraData.elements||[],cached:true,tier:'extra-fallback'});
        }catch{}
      }
      return json({error:'Overpass temporairement indisponible',detail:String(err?.message||err)},503,{'cache-control':'no-store'});
    }
  }
};
