import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const mainPath=path.join(pkgDir,'MainActivity.java');
const discoveryPath=path.join(pkgDir,'AudifyDiscoveryAgent.java');

function replaceMethod(source,signatures,replacement,label){
  for(const signature of signatures){
    const start=source.indexOf(signature);
    if(start<0) continue;
    const brace=source.indexOf('{',start);
    if(brace<0) continue;
    let depth=0,end=-1;
    for(let i=brace;i<source.length;i++){
      if(source[i]==='{') depth++;
      else if(source[i]==='}'){
        depth--;
        if(depth===0){end=i+1;break;}
      }
    }
    if(end>0) return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error(`V68.11.6 méthode introuvable: ${label}`);
}

// =============================================================================
// 1) RECHERCHE MANUELLE : page YouTube publique, sans quota Search Queries.
// =============================================================================
let main=await readFile(mainPath,'utf8');

if(!main.includes('audifyWebSearchV68116(')){
  const marker='    private void runAudifyNativeSearchV672(String rawQuery) {';
  if(!main.includes(marker)) throw new Error('V68.11.6 marker recherche manuelle introuvable');
  const helpers=String.raw`    private String audifyRendererTextV68116(org.json.JSONObject renderer,String key){
        if(renderer==null) return "";
        org.json.JSONObject obj=renderer.optJSONObject(key);
        if(obj==null) return "";
        String simple=obj.optString("simpleText","");
        if(!simple.isEmpty()) return audifyHtmlTextV673(simple);
        org.json.JSONArray runs=obj.optJSONArray("runs");
        if(runs!=null){
            StringBuilder out=new StringBuilder();
            for(int i=0;i<runs.length();i++){
                org.json.JSONObject run=runs.optJSONObject(i); if(run==null) continue;
                String text=run.optString("text",""); if(!text.isEmpty()) out.append(text);
            }
            return audifyHtmlTextV673(out.toString());
        }
        return "";
    }

    private long audifyClockSecondsV68116(String raw){
        if(raw==null) return -1L;
        String s=raw.trim();
        if(s.isEmpty()) return -1L;
        try{
            String[] parts=s.split(":");
            if(parts.length==2) return Long.parseLong(parts[0].trim())*60L+Long.parseLong(parts[1].trim());
            if(parts.length==3) return Long.parseLong(parts[0].trim())*3600L+Long.parseLong(parts[1].trim())*60L+Long.parseLong(parts[2].trim());
        }catch(Throwable ignored){}
        return -1L;
    }

    private java.util.ArrayList<org.json.JSONObject> audifyVideoRenderersV68116(String html){
        java.util.ArrayList<org.json.JSONObject> out=new java.util.ArrayList<>();
        if(html==null||html.isEmpty()) return out;
        String marker="\\\"videoRenderer\\\":";
        int pos=0;
        while(pos<html.length()&&out.size()<60){
            int hit=html.indexOf(marker,pos);
            if(hit<0) break;
            int brace=html.indexOf('{',hit+marker.length());
            if(brace<0) break;
            int depth=0,end=-1; boolean quoted=false,escaped=false;
            for(int i=brace;i<html.length();i++){
                char ch=html.charAt(i);
                if(quoted){
                    if(escaped){escaped=false;continue;}
                    if(ch=='\\\\'){escaped=true;continue;}
                    if(ch=='\"') quoted=false;
                    continue;
                }
                if(ch=='\"'){quoted=true;continue;}
                if(ch=='{') depth++;
                else if(ch=='}'){
                    depth--;
                    if(depth==0){end=i+1;break;}
                }
            }
            pos=Math.max(brace+1,end>0?end:brace+1);
            if(end<=brace) continue;
            try{out.add(new org.json.JSONObject(html.substring(brace,end)));}catch(Throwable ignored){}
        }
        return out;
    }

    private String audifyYoutubeSearchHtmlV68116(String query) throws Exception{
        java.net.HttpURLConnection c=null;
        try{
            String endpoint="https://www.youtube.com/results?search_query="+java.net.URLEncoder.encode(query,"UTF-8")+"&hl=fr";
            c=(java.net.HttpURLConnection)new java.net.URL(endpoint).openConnection();
            c.setRequestMethod("GET");
            c.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36");
            c.setRequestProperty("Accept-Language","fr-FR,fr;q=0.9,en;q=0.7");
            c.setRequestProperty("Accept","text/html,application/xhtml+xml");
            c.setConnectTimeout(12000); c.setReadTimeout(18000); c.setUseCaches(false);
            int code=c.getResponseCode();
            if(code<200||code>=300) throw new java.io.IOException("YouTube Web HTTP "+code);
            return audifyReadHttpV673(c,code);
        }finally{if(c!=null)c.disconnect();}
    }

    private java.util.ArrayList<AudifySearchItemV673> audifyWebSearchV68116(String query) throws Exception{
        java.util.ArrayList<AudifySearchItemV673> results=new java.util.ArrayList<>();
        java.util.LinkedHashSet<String> seen=new java.util.LinkedHashSet<>();
        String html=audifyYoutubeSearchHtmlV68116(query);
        for(org.json.JSONObject renderer:audifyVideoRenderersV68116(html)){
            if(results.size()>=20) break;
            String id=renderer.optString("videoId","");
            if(id.isEmpty()||seen.contains(id)) continue;
            long seconds=audifyClockSecondsV68116(audifyRendererTextV68116(renderer,"lengthText"));
            // Audify : Shorts/extraits < 1 min et longues vidéos > 6 min sont exclus.
            if(seconds<60L||seconds>360L) continue;
            String title=audifyRendererTextV68116(renderer,"title");
            if(title.isEmpty()) title="Sans titre";
            String artist=audifyRendererTextV68116(renderer,"ownerText");
            if(artist.isEmpty()) artist=audifyRendererTextV68116(renderer,"longBylineText");
            if(artist.isEmpty()) artist=audifyRendererTextV68116(renderer,"shortBylineText");
            if(artist.isEmpty()) artist="YouTube";
            seen.add(id);
            results.add(new AudifySearchItemV673(id,title,artist,"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg"));
        }
        return results;
    }

`;
  main=main.replace(marker,helpers+marker);
}

main=replaceMethod(main,
  ['    private void runAudifyNativeSearchV672(String rawQuery) {','    private void runAudifyNativeSearchV672(String rawQuery){'],
String.raw`    private void runAudifyNativeSearchV672(String rawQuery){
        final String query=rawQuery==null?"":rawQuery.trim();
        if(query.isEmpty()) return;
        final int generation=++audifySearchGenerationV672;
        showAudifySearchStatusV672("Recherche musicale de « "+query+" »…",false);
        audifySearchExecutorV672.execute(()->{
            try{
                final java.util.ArrayList<AudifySearchItemV673> results=audifyWebSearchV68116(query);
                runOnUiThread(()->{
                    if(generation!=audifySearchGenerationV672) return;
                    renderAudifyNativeResultsV672(results,query,generation);
                });
            }catch(Throwable error){
                runOnUiThread(()->{
                    if(generation!=audifySearchGenerationV672) return;
                    showAudifySearchStatusV672("Recherche YouTube momentanément indisponible. Réessaie dans quelques secondes.",true);
                });
            }
        });
    }`,'runAudifyNativeSearchV672 web primary');

await writeFile(mainPath,main,'utf8');

// =============================================================================
// 2) DISCOVERY AGENT : même moteur Web, même filtre durée, zéro Search Queries.
// =============================================================================
let discovery=await readFile(discoveryPath,'utf8');
discovery=discovery.replace('private static final String PREFS="audify_discovery_v68112";','private static final String PREFS="audify_discovery_v68116";');

if(!discovery.includes('private ArrayList<JSONObject> webVideoRenderersV68116(')){
  const marker='    private boolean containsArtist(Set<String> known,String candidate){';
  if(!discovery.includes(marker)) throw new Error('V68.11.6 marker discovery helpers introuvable');
  const helpers=String.raw`    private String rendererTextV68116(JSONObject renderer,String key){
        if(renderer==null) return "";
        JSONObject obj=renderer.optJSONObject(key); if(obj==null) return "";
        String simple=obj.optString("simpleText",""); if(!simple.isEmpty()) return html(simple);
        JSONArray runs=obj.optJSONArray("runs");
        if(runs!=null){
            StringBuilder out=new StringBuilder();
            for(int i=0;i<runs.length();i++){JSONObject run=runs.optJSONObject(i);if(run!=null)out.append(run.optString("text",""));}
            return html(out.toString());
        }
        return "";
    }

    private long clockSecondsV68116(String raw){
        if(raw==null) return -1L;
        try{
            String[] p=raw.trim().split(":");
            if(p.length==2) return Long.parseLong(p[0].trim())*60L+Long.parseLong(p[1].trim());
            if(p.length==3) return Long.parseLong(p[0].trim())*3600L+Long.parseLong(p[1].trim())*60L+Long.parseLong(p[2].trim());
        }catch(Throwable ignored){}
        return -1L;
    }

    private ArrayList<JSONObject> webVideoRenderersV68116(String query) throws Exception{
        ArrayList<JSONObject> out=new ArrayList<>();
        HttpURLConnection c=null;
        try{
            String endpoint="https://www.youtube.com/results?search_query="+enc(query)+"&hl=fr";
            c=(HttpURLConnection)new URL(endpoint).openConnection();
            c.setRequestMethod("GET");
            c.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36");
            c.setRequestProperty("Accept-Language","fr-FR,fr;q=0.9,en;q=0.7");
            c.setRequestProperty("Accept","text/html,application/xhtml+xml");
            c.setConnectTimeout(10000); c.setReadTimeout(15000); c.setUseCaches(false);
            int code=c.getResponseCode(); if(code<200||code>=300) return out;
            String page=read(c.getInputStream());
            String marker="\\\"videoRenderer\\\":"; int pos=0;
            while(pos<page.length()&&out.size()<60){
                int hit=page.indexOf(marker,pos); if(hit<0) break;
                int brace=page.indexOf('{',hit+marker.length()); if(brace<0) break;
                int depth=0,end=-1; boolean quoted=false,escaped=false;
                for(int i=brace;i<page.length();i++){
                    char ch=page.charAt(i);
                    if(quoted){if(escaped){escaped=false;continue;}if(ch=='\\\\'){escaped=true;continue;}if(ch=='\"')quoted=false;continue;}
                    if(ch=='\"'){quoted=true;continue;}
                    if(ch=='{')depth++; else if(ch=='}'){depth--;if(depth==0){end=i+1;break;}}
                }
                pos=Math.max(brace+1,end>0?end:brace+1);
                if(end<=brace) continue;
                try{out.add(new JSONObject(page.substring(brace,end)));}catch(Throwable ignored){}
            }
        }finally{if(c!=null)c.disconnect();}
        return out;
    }

    private void collectWebSearchV68116(String query,AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,
                                        LinkedHashMap<String,AudifyLibraryStore.Track> sameOut,LinkedHashMap<String,AudifyLibraryStore.Track> others,int mode) throws Exception{
        if(query==null||query.trim().isEmpty()) return;
        String seedArtist=canonicalArtist(seed.title,seed.artist);
        for(JSONObject renderer:webVideoRenderersV68116(query)){
            if((sameOut.size()+others.size())>=22) break;
            String id=renderer.optString("videoId","");
            if(id.isEmpty()||id.equals(seed.id)||sameOut.containsKey(id)||others.containsKey(id)) continue;
            long duration=clockSecondsV68116(rendererTextV68116(renderer,"lengthText"));
            if(duration<60L||duration>360L) continue;
            String title=rendererTextV68116(renderer,"title"); if(title.isEmpty()) continue;
            String channel=rendererTextV68116(renderer,"ownerText");
            if(channel.isEmpty()) channel=rendererTextV68116(renderer,"longBylineText");
            if(channel.isEmpty()) channel=rendererTextV68116(renderer,"shortBylineText");
            if(channel.isEmpty()) channel="YouTube";
            if(!looksLikeMusic(title)||isBadVariant(title,channel)) continue;
            String work=songKey(title);
            if(work.isEmpty()||selectedSongs.contains(work)) continue;
            String candidateArtist=canonicalArtist(title,channel);
            if(candidateArtist.isEmpty()||looksGenericArtist(candidateArtist)) continue;
            boolean sameSeed=sameArtist(candidateArtist,seedArtist);
            if(mode==MODE_SEED_ONLY&&!sameSeed) continue;
            if(mode==MODE_OTHERS_ONLY&&sameSeed) continue;
            AudifyLibraryStore.Track track=new AudifyLibraryStore.Track(id,title,channel,"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg");
            if(sameSeed){
                if(sameOut.size()>=2) continue;
                sameOut.put(id,track); selectedSongs.add(work); continue;
            }
            if(containsArtist(known,candidateArtist)) continue;
            String compact=compactArtist(candidateArtist);
            if(otherArtists.contains(compact)) continue;
            otherArtists.add(compact); others.put(id,track); selectedSongs.add(work);
        }
    }

`;
  discovery=discovery.replace(marker,helpers+marker);
}

discovery=replaceMethod(discovery,
  ['    private void collectSearch(String query,AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,'],
String.raw`    private void collectSearch(String query,AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,
                               LinkedHashMap<String,AudifyLibraryStore.Track> sameOut,LinkedHashMap<String,AudifyLibraryStore.Track> others,int mode) throws Exception{
        collectWebSearchV68116(query,seed,known,selectedSongs,otherArtists,sameOut,others,mode);
    }`,'discovery collectSearch');

discovery=replaceMethod(discovery,
  ['    private void collectRelated(AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,'],
String.raw`    private void collectRelated(AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,
                                LinkedHashMap<String,AudifyLibraryStore.Track> sameOut,LinkedHashMap<String,AudifyLibraryStore.Track> others,int mode) throws Exception{
        String artist=seedArtistDisplay(seed);
        String query=(artist==null||artist.trim().isEmpty()) ? seed.title+" music" : artist+" radio similar music";
        collectWebSearchV68116(query,seed,known,selectedSongs,otherArtists,sameOut,others,mode);
    }`,'discovery collectRelated');

await writeFile(discoveryPath,discovery,'utf8');
console.log('Audify V68.11.6 : recherche YouTube Web sans quota + Discovery Agent sans Search Queries, filtre 1-6 min conservé.');
