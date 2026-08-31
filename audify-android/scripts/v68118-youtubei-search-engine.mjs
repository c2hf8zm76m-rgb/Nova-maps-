import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const mainPath=path.join(pkgDir,'MainActivity.java');
const discoveryPath=path.join(pkgDir,'AudifyDiscoveryAgent.java');
const enginePath=path.join(pkgDir,'AudifyYoutubeSearchEngine.java');

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
  throw new Error(`V68.11.8 méthode introuvable: ${label}`);
}

const engine=String.raw`package com.nova.audify;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Set;

final class AudifyYoutubeSearchEngine {
    static final class Result {
        final String id;
        final String title;
        final String artist;
        final String thumbnail;
        final long durationSeconds;
        Result(String id,String title,String artist,String thumbnail,long durationSeconds){
            this.id=id==null?"":id;
            this.title=title==null?"":title;
            this.artist=artist==null?"":artist;
            this.thumbnail=thumbnail==null?"":thumbnail;
            this.durationSeconds=durationSeconds;
        }
    }

    private static final Object CONFIG_LOCK=new Object();
    private static volatile String apiKey="";
    private static volatile String clientVersion="";
    private static volatile String visitorData="";
    private static volatile long configLoadedAt=0L;
    private static final long CONFIG_TTL=6L*60L*60L*1000L;

    private AudifyYoutubeSearchEngine(){}

    static ArrayList<Result> search(String rawQuery) throws Exception{
        String query=rawQuery==null?"":rawQuery.trim();
        ArrayList<Result> empty=new ArrayList<>();
        if(query.isEmpty()) return empty;

        String page="";
        try{ page=fetchSearchPage(query); }catch(Throwable ignored){}

        // 1) YouTube fournit souvent directement ytInitialData dans la page.
        if(!page.isEmpty()){
            JSONObject initial=extractInitialData(page);
            if(initial!=null){
                ArrayList<Result> direct=resultsFromJson(initial);
                if(!direct.isEmpty()) return direct;
            }
        }

        // 2) Backend Innertube public utilisé par le site Web YouTube.
        ensureConfig(page);
        JSONObject response=postYoutubei(query);
        ArrayList<Result> internal=resultsFromJson(response);
        if(!internal.isEmpty()) return internal;

        // 3) Une réponse valide mais vide reste une vraie recherche vide.
        return internal;
    }

    private static String fetchSearchPage(String query) throws Exception{
        String endpoint="https://www.youtube.com/results?search_query="+URLEncoder.encode(query,"UTF-8")+"&hl=fr&persist_hl=1";
        return get(endpoint);
    }

    private static String get(String endpoint) throws Exception{
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(endpoint).openConnection();
            c.setRequestMethod("GET");
            applyHeaders(c);
            c.setConnectTimeout(12000);
            c.setReadTimeout(18000);
            c.setUseCaches(false);
            int code=c.getResponseCode();
            if(code<200||code>=300) throw new java.io.IOException("YouTube HTTP "+code);
            return read(c.getInputStream());
        }finally{ if(c!=null)c.disconnect(); }
    }

    private static void applyHeaders(HttpURLConnection c){
        c.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36");
        c.setRequestProperty("Accept-Language","fr-FR,fr;q=0.9,en;q=0.7");
        c.setRequestProperty("Accept","text/html,application/json;q=0.9,*/*;q=0.8");
        c.setRequestProperty("Accept-Encoding","identity");
        c.setRequestProperty("Cookie","SOCS=CAI; PREF=hl=fr");
    }

    private static String read(InputStream stream) throws Exception{
        BufferedReader br=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8));
        StringBuilder out=new StringBuilder();
        char[] buf=new char[8192];
        int n;
        while((n=br.read(buf))>=0) out.append(buf,0,n);
        br.close();
        return out.toString();
    }

    private static JSONObject extractInitialData(String page){
        String[] markers=new String[]{
            "var ytInitialData =",
            "window[\"ytInitialData\"] =",
            "ytInitialData =",
            "\"ytInitialData\":"
        };
        for(String marker:markers){
            String raw=extractBalancedObjectAfter(page,marker);
            if(raw.isEmpty()) continue;
            try{return new JSONObject(raw);}catch(Throwable ignored){}
        }
        return null;
    }

    private static String extractBalancedObjectAfter(String text,String marker){
        if(text==null||text.isEmpty()) return "";
        int at=text.indexOf(marker);
        if(at<0) return "";
        int start=text.indexOf('{',at+marker.length());
        if(start<0) return "";
        int depth=0;
        boolean quoted=false,escaped=false;
        for(int i=start;i<text.length();i++){
            char ch=text.charAt(i);
            if(quoted){
                if(escaped){escaped=false;continue;}
                if(ch==92){escaped=true;continue;}
                if(ch=='\"') quoted=false;
                continue;
            }
            if(ch=='\"'){quoted=true;continue;}
            if(ch=='{') depth++;
            else if(ch=='}'){
                depth--;
                if(depth==0) return text.substring(start,i+1);
            }
        }
        return "";
    }

    private static void ensureConfig(String firstPage) throws Exception{
        long now=System.currentTimeMillis();
        if(!apiKey.isEmpty()&&!clientVersion.isEmpty()&&(now-configLoadedAt)<CONFIG_TTL) return;
        synchronized(CONFIG_LOCK){
            now=System.currentTimeMillis();
            if(!apiKey.isEmpty()&&!clientVersion.isEmpty()&&(now-configLoadedAt)<CONFIG_TTL) return;
            String page=firstPage==null?"":firstPage;
            String key=configValue(page,"INNERTUBE_API_KEY");
            String version=configValue(page,"INNERTUBE_CONTEXT_CLIENT_VERSION");
            String visitor=configValue(page,"VISITOR_DATA");
            if(key.isEmpty()||version.isEmpty()){
                String home=get("https://www.youtube.com/?hl=fr&persist_hl=1");
                if(key.isEmpty()) key=configValue(home,"INNERTUBE_API_KEY");
                if(version.isEmpty()) version=configValue(home,"INNERTUBE_CONTEXT_CLIENT_VERSION");
                if(visitor.isEmpty()) visitor=configValue(home,"VISITOR_DATA");
            }
            // Clé Web publique de secours, uniquement si YouTube masque sa config dans la page reçue.
            if(key.isEmpty()) key="AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
            if(version.isEmpty()) version="2.20260831.00.00";
            apiKey=key;
            clientVersion=version;
            visitorData=visitor;
            configLoadedAt=now;
        }
    }

    private static String configValue(String page,String key){
        if(page==null||page.isEmpty()) return "";
        int p=page.indexOf(key);
        while(p>=0){
            int colon=page.indexOf(':',p+key.length());
            if(colon<0||colon-p>120) break;
            int quote=page.indexOf('"',colon+1);
            if(quote<0||quote-colon>24) break;
            boolean escapedContainer=quote>0&&page.charAt(quote-1)==92;
            int end=-1;
            for(int i=quote+1;i<page.length();i++){
                if(page.charAt(i)!='"') continue;
                boolean prevSlash=i>0&&page.charAt(i-1)==92;
                if((escapedContainer&&prevSlash)||(!escapedContainer&&!prevSlash)){end=i;break;}
            }
            if(end>quote){
                String value=page.substring(quote+1,end);
                if(!value.isEmpty()) return value.replace("\\/","/");
            }
            p=page.indexOf(key,p+key.length());
        }
        return "";
    }

    private static JSONObject postYoutubei(String query) throws Exception{
        JSONObject client=new JSONObject();
        client.put("clientName","WEB");
        client.put("clientVersion",clientVersion);
        client.put("hl","fr");
        client.put("gl","FR");
        if(!visitorData.isEmpty()) client.put("visitorData",visitorData);
        JSONObject context=new JSONObject();
        context.put("client",client);
        JSONObject body=new JSONObject();
        body.put("context",context);
        body.put("query",query);

        String endpoint="https://www.youtube.com/youtubei/v1/search?prettyPrint=false&key="+URLEncoder.encode(apiKey,"UTF-8");
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(endpoint).openConnection();
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            applyHeaders(c);
            c.setRequestProperty("Content-Type","application/json; charset=UTF-8");
            c.setRequestProperty("Origin","https://www.youtube.com");
            c.setRequestProperty("Referer","https://www.youtube.com/");
            c.setRequestProperty("X-YouTube-Client-Name","1");
            c.setRequestProperty("X-YouTube-Client-Version",clientVersion);
            c.setConnectTimeout(12000);
            c.setReadTimeout(18000);
            byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
            c.setFixedLengthStreamingMode(bytes.length);
            OutputStream out=c.getOutputStream();
            out.write(bytes); out.flush(); out.close();
            int code=c.getResponseCode();
            InputStream stream=(code>=200&&code<300)?c.getInputStream():c.getErrorStream();
            String response=stream==null?"":read(stream);
            if(code<200||code>=300) throw new java.io.IOException("YouTubei HTTP "+code+" "+response.substring(0,Math.min(180,response.length())));
            return new JSONObject(response);
        }finally{if(c!=null)c.disconnect();}
    }

    private static ArrayList<Result> resultsFromJson(Object root){
        ArrayList<JSONObject> renderers=new ArrayList<>();
        collectRenderers(root,renderers,new LinkedHashSet<String>());
        ArrayList<Result> results=new ArrayList<>();
        Set<String> seen=new LinkedHashSet<>();
        for(JSONObject renderer:renderers){
            if(results.size()>=24) break;
            String id=renderer.optString("videoId","");
            if(id.isEmpty()||seen.contains(id)) continue;
            long seconds=clockSeconds(text(renderer,"lengthText"));
            // Filtre qualité Audify : uniquement 1:00 à 6:00 inclus.
            if(seconds<60L||seconds>360L) continue;
            String title=text(renderer,"title");
            if(title.isEmpty()) continue;
            String artist=text(renderer,"ownerText");
            if(artist.isEmpty()) artist=text(renderer,"longBylineText");
            if(artist.isEmpty()) artist=text(renderer,"shortBylineText");
            if(artist.isEmpty()) artist="YouTube";
            seen.add(id);
            results.add(new Result(id,title,artist,"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg",seconds));
        }
        return results;
    }

    private static void collectRenderers(Object node,ArrayList<JSONObject> out,Set<String> seen){
        if(node==null||out.size()>=100) return;
        if(node instanceof JSONObject){
            JSONObject obj=(JSONObject)node;
            JSONObject renderer=obj.optJSONObject("videoRenderer");
            if(renderer!=null){
                String id=renderer.optString("videoId","");
                String key=id.isEmpty()?Integer.toHexString(System.identityHashCode(renderer)):id;
                if(seen.add(key)) out.add(renderer);
            }
            JSONArray names=obj.names();
            if(names==null) return;
            for(int i=0;i<names.length();i++){
                String name=names.optString(i,"");
                if("videoRenderer".equals(name)) continue;
                Object child=obj.opt(name);
                if(child instanceof JSONObject||child instanceof JSONArray) collectRenderers(child,out,seen);
            }
        }else if(node instanceof JSONArray){
            JSONArray arr=(JSONArray)node;
            for(int i=0;i<arr.length();i++) collectRenderers(arr.opt(i),out,seen);
        }
    }

    private static String text(JSONObject renderer,String key){
        if(renderer==null) return "";
        JSONObject obj=renderer.optJSONObject(key);
        if(obj==null) return "";
        String simple=obj.optString("simpleText","");
        if(!simple.isEmpty()) return simple;
        JSONArray runs=obj.optJSONArray("runs");
        if(runs==null) return "";
        StringBuilder out=new StringBuilder();
        for(int i=0;i<runs.length();i++){
            JSONObject run=runs.optJSONObject(i);
            if(run!=null) out.append(run.optString("text",""));
        }
        return out.toString();
    }

    private static long clockSeconds(String raw){
        if(raw==null) return -1L;
        try{
            String[] p=raw.trim().split(":");
            if(p.length==2) return Long.parseLong(p[0].trim())*60L+Long.parseLong(p[1].trim());
            if(p.length==3) return Long.parseLong(p[0].trim())*3600L+Long.parseLong(p[1].trim())*60L+Long.parseLong(p[2].trim());
        }catch(Throwable ignored){}
        return -1L;
    }
}
`;
await writeFile(enginePath,engine,'utf8');

let main=await readFile(mainPath,'utf8');
main=replaceMethod(main,
  ['    private void runAudifyNativeSearchV672(String rawQuery) {','    private void runAudifyNativeSearchV672(String rawQuery){'],
String.raw`    private void runAudifyNativeSearchV672(String rawQuery){
        final String query=rawQuery==null?"":rawQuery.trim();
        if(query.isEmpty()) return;
        final int generation=++audifySearchGenerationV672;
        showAudifySearchStatusV672("Recherche musicale de « "+query+" »…",false);
        audifySearchExecutorV672.execute(()->{
            try{
                java.util.ArrayList<AudifyYoutubeSearchEngine.Result> raw=AudifyYoutubeSearchEngine.search(query);
                final java.util.ArrayList<AudifySearchItemV673> results=new java.util.ArrayList<>();
                for(AudifyYoutubeSearchEngine.Result r:raw){
                    results.add(new AudifySearchItemV673(r.id,r.title,r.artist,r.thumbnail));
                }
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
    }`,'recherche principale Youtubei');
await writeFile(mainPath,main,'utf8');

let discovery=await readFile(discoveryPath,'utf8');
discovery=discovery.replace('private static final String PREFS="audify_discovery_v68116";','private static final String PREFS="audify_discovery_v68118";');
discovery=replaceMethod(discovery,
  ['    private void collectSearch(String query,AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,'],
String.raw`    private void collectSearch(String query,AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,
                               LinkedHashMap<String,AudifyLibraryStore.Track> sameOut,LinkedHashMap<String,AudifyLibraryStore.Track> others,int mode) throws Exception{
        if(query==null||query.trim().isEmpty()) return;
        String seedArtist=canonicalArtist(seed.title,seed.artist);
        for(AudifyYoutubeSearchEngine.Result r:AudifyYoutubeSearchEngine.search(query)){
            if((sameOut.size()+others.size())>=22) break;
            String id=r.id;
            if(id.isEmpty()||id.equals(seed.id)||sameOut.containsKey(id)||others.containsKey(id)) continue;
            String title=r.title;
            String channel=r.artist;
            if(!looksLikeMusic(title)||isBadVariant(title,channel)) continue;
            String work=songKey(title);
            if(work.isEmpty()||selectedSongs.contains(work)) continue;
            String candidateArtist=canonicalArtist(title,channel);
            if(candidateArtist.isEmpty()||looksGenericArtist(candidateArtist)) continue;
            boolean sameSeed=sameArtist(candidateArtist,seedArtist);
            if(mode==MODE_SEED_ONLY&&!sameSeed) continue;
            if(mode==MODE_OTHERS_ONLY&&sameSeed) continue;
            AudifyLibraryStore.Track track=new AudifyLibraryStore.Track(id,title,channel,r.thumbnail);
            if(sameSeed){
                if(sameOut.size()>=2) continue;
                sameOut.put(id,track); selectedSongs.add(work); continue;
            }
            if(containsArtist(known,candidateArtist)) continue;
            String compact=compactArtist(candidateArtist);
            if(otherArtists.contains(compact)) continue;
            otherArtists.add(compact); others.put(id,track); selectedSongs.add(work);
        }
    }`,'Discovery collectSearch Youtubei');

discovery=replaceMethod(discovery,
  ['    private void collectRelated(AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,'],
String.raw`    private void collectRelated(AudifyLibraryStore.Track seed,Set<String> known,Set<String> selectedSongs,Set<String> otherArtists,
                                LinkedHashMap<String,AudifyLibraryStore.Track> sameOut,LinkedHashMap<String,AudifyLibraryStore.Track> others,int mode) throws Exception{
        String artist=seedArtistDisplay(seed);
        String query=(artist==null||artist.trim().isEmpty()) ? seed.title+" music" : artist+" radio similar music";
        collectSearch(query,seed,known,selectedSongs,otherArtists,sameOut,others,mode);
    }`,'Discovery collectRelated Youtubei');
await writeFile(discoveryPath,discovery,'utf8');

console.log('Audify V68.11.8 : moteur YouTubei + ytInitialData robuste, sans quota Search Queries, filtre 1-6 min.');
