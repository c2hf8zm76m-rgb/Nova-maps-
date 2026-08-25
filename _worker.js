const MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

const AUDIFY_SEARCH_MIRRORS = [
  'https://yewtu.be',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.chocolatemoo53.com'
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

async function fetchTimeout(url, ms=5000, headers={}){
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),ms);
  try{
    return await fetch(url,{signal:ctl.signal,headers});
  } finally { clearTimeout(timer); }
}

function textPart(v){
  return v?.simpleText || v?.runs?.map(x=>x?.text||'').join('') || '';
}

function collectVideoRenderers(node,out=[]){
  if(out.length>=28 || !node || typeof node!=='object') return out;
  if(Array.isArray(node)){
    for(const item of node){ collectVideoRenderers(item,out); if(out.length>=28) break; }
    return out;
  }
  if(node.videoRenderer?.videoId) out.push(node.videoRenderer);
  for(const key in node){
    if(out.length>=28) break;
    if(key!=='videoRenderer') collectVideoRenderers(node[key],out);
  }
  return out;
}

function extractJsonObject(text, marker){
  const p=text.indexOf(marker);
  if(p<0) return null;
  let i=text.indexOf('{',p);
  if(i<0) return null;
  const start=i;
  let depth=0, inString=false, escaped=false;
  for(;i<text.length;i++){
    const c=text[i];
    if(inString){
      if(escaped){escaped=false;continue;}
      if(c==='\\'){escaped=true;continue;}
      if(c==='"') inString=false;
      continue;
    }
    if(c==='"'){inString=true;continue;}
    if(c==='{') depth++;
    else if(c==='}'){
      depth--;
      if(depth===0) return text.slice(start,i+1);
    }
  }
  return null;
}

function normalizeVideo(id,title,artist){
  return {
    id,
    title:title||'Sans titre',
    artist:artist||'YouTube',
    thumbnail:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  };
}

async function searchInvidiousOne(base,q){
  const u=`${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video&hl=fr`;
  const r=await fetchTimeout(u,4800,{'accept':'application/json','user-agent':'Audify/1.0'});
  if(!r.ok) throw new Error(`${base} HTTP ${r.status}`);
  const data=await r.json();
  const items=(Array.isArray(data)?data:[])
    .filter(x=>x?.videoId)
    .slice(0,24)
    .map(x=>normalizeVideo(x.videoId,x.title,x.author));
  if(!items.length) throw new Error(`${base} sans résultat`);
  return items;
}

async function searchInvidious(q){
  const attempts=AUDIFY_SEARCH_MIRRORS.map(base=>searchInvidiousOne(base,q));
  if(typeof Promise.any==='function') return await Promise.any(attempts);
  const settled=await Promise.allSettled(attempts);
  const ok=settled.find(x=>x.status==='fulfilled');
  if(ok) return ok.value;
  throw new Error('Miroirs de recherche indisponibles');
}

async function searchYoutubeHtml(q){
  const u=`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=fr&gl=FR`;
  const r=await fetchTimeout(u,7500,{
    'accept':'text/html,application/xhtml+xml',
    'accept-language':'fr-FR,fr;q=0.9,en;q=0.7',
    'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'
  });
  if(!r.ok) throw new Error(`YouTube HTTP ${r.status}`);
  const html=await r.text();
  let raw=extractJsonObject(html,'var ytInitialData =');
  if(!raw) raw=extractJsonObject(html,'ytInitialData =');
  if(!raw) raw=extractJsonObject(html,'"ytInitialData":');
  if(!raw) throw new Error('Réponse YouTube sans données de recherche');
  const data=JSON.parse(raw);
  const items=collectVideoRenderers(data,[])
    .map(v=>normalizeVideo(v.videoId,textPart(v.title),textPart(v.ownerText)||textPart(v.longBylineText)))
    .filter(x=>x.id)
    .slice(0,24);
  if(!items.length) throw new Error('YouTube sans résultat');
  return items;
}

async function audifySearch(q){
  const errors=[];
  try{return {items:await searchInvidious(q),source:'invidious'};}
  catch(e){errors.push(String(e?.message||e));}
  try{return {items:await searchYoutubeHtml(q),source:'youtube-html'};}
  catch(e){errors.push(String(e?.message||e));}
  throw new Error(errors.join(' | ')||'Recherche indisponible');
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

    if(url.pathname==='/api/audify-search'){
      const cors={
        'access-control-allow-origin':'*',
        'access-control-allow-methods':'GET,OPTIONS',
        'access-control-allow-headers':'content-type',
        'cache-control':'public, max-age=60, s-maxage=180'
      };
      if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
      const q=(url.searchParams.get('q')||'').trim().slice(0,160);
      if(!q) return json({error:'Recherche vide',items:[]},400,cors);
      try{
        const result=await audifySearch(q);
        return json({ok:true,q,...result},200,cors);
      }catch(err){
        return json({ok:false,q,items:[],error:'Recherche temporairement indisponible',detail:String(err?.message||err)},503,cors);
      }
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