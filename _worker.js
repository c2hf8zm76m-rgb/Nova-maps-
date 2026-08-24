const MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

function n(v){ const x=Number(v); return Number.isFinite(x)?x:null; }
function q4(x, step=0.01){ return Math.round(x/step)*step; }
function json(data,status=200,extra={}){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=60, s-maxage=1800, stale-while-revalidate=21600',...extra}});
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/pois') return env.ASSETS.fetch(request);

    const s=n(url.searchParams.get('s')), w=n(url.searchParams.get('w')), nn=n(url.searchParams.get('n')), e=n(url.searchParams.get('e'));
    if([s,w,nn,e].some(v=>v===null) || s>=nn || w>=e) return json({error:'bbox invalide'},400);
    if((nn-s)>.22 || (e-w)>.28) return json({error:'zone trop grande'},400);

    const pad=.006;
    const S=q4(s-pad), W=q4(w-pad), N=q4(nn+pad), E=q4(e+pad);
    const key=new Request(`${url.origin}/__poi_cache/${S.toFixed(2)}/${W.toFixed(2)}/${N.toFixed(2)}/${E.toFixed(2)}`);
    const cache=caches.default;
    const cached=await cache.match(key);
    if(cached) return new Response(cached.body,{status:cached.status,headers:cached.headers});

    const box=`${S},${W},${N},${E}`;
    const query=`[out:json][timeout:10];(nwr(${box})[name][amenity];nwr(${box})[name][shop];nwr(${box})[name][tourism];nwr(${box})[name][leisure];nwr(${box})[name][aeroway];nwr(${box})[name][railway];nwr(${box})[name][office];nwr(${box})[name][healthcare];nwr(${box})[name][craft];nwr(${box})[name][public_transport];nwr(${box})[name][historic];);out center tags qt 650;`;
    const body='data='+encodeURIComponent(query);
    let last='';

    for(const mirror of MIRRORS){
      const ctl=new AbortController();
      const timer=setTimeout(()=>ctl.abort(),8500);
      try{
        const r=await fetch(mirror,{method:'POST',body,signal:ctl.signal,headers:{
          'content-type':'application/x-www-form-urlencoded;charset=UTF-8',
          'accept':'application/json',
          'user-agent':'NOVA-Maps/0.6.9.7 (Cloudflare POI cache)'
        }});
        if(!r.ok){ last=`${mirror} HTTP ${r.status}`; continue; }
        const text=await r.text();
        let data; try{data=JSON.parse(text)}catch{last=`${mirror} JSON invalide`;continue;}
        if(!Array.isArray(data.elements)){last=`${mirror} réponse invalide`;continue;}
        const out=json({elements:data.elements,source:mirror,cached:false},200,{'x-nova-poi-source':mirror});
        ctx.waitUntil(cache.put(key,out.clone()));
        return out;
      }catch(err){ last=`${mirror} ${String(err?.name||err)}`; }
      finally{clearTimeout(timer);}
    }
    return json({error:'Overpass temporairement indisponible',detail:last},503,{'cache-control':'no-store'});
  }
};
