import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const metaPath=path.join(pkgDir,'AudifyInstantAlbumMetadata.java');
const resolverPath=path.join(pkgDir,'AudifyAppleReleaseGraphResolver.java');

const resolver=String.raw`package com.nova.audify;

import android.text.TextUtils;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * V68.16.1 — deep Apple/iTunes release graph.
 * Generic fallback for recordings that first appear as a single but are also present
 * on a canonical album. No artist/song/album mapping and no persistent cache.
 */
final class AudifyAppleReleaseGraphResolver {
    static final String MARKER="AUDIFY_V68161_APPLE_RELEASE_GRAPH";
    static final String VARIANT_MARKER="AUDIFY_V68161_MULTI_VARIANT_TITLE_SEARCH";
    static final String TRACKLIST_MARKER="AUDIFY_V68161_APPLE_TRACKLIST_RELATION_PROOF";
    static final String SINGLE_GUARD_MARKER="AUDIFY_V68161_AUTONOMOUS_SINGLE_STAYS_SINGLE";

    private static final String API="https://itunes.apple.com";

    private static final class Seed {
        long collectionId;
        String collectionName="",artist="",country="";
        int trackCount,score;
        long durationMs=-1L;
    }
    private static final class Result {
        AudifyInstantAlbumMetadata.Album album;
        int score;
        Result(AudifyInstantAlbumMetadata.Album a,int s){album=a;score=s;}
    }

    private AudifyAppleReleaseGraphResolver(){}

    static AudifyInstantAlbumMetadata.Album identify(String rawTitle,String rawArtist,long durationMs,String albumHint)throws Exception{
        String title=clean(rawTitle),artist=clean(rawArtist),hint=clean(albumHint);
        if(TextUtils.isEmpty(title)||TextUtils.isEmpty(artist))return null;
        String baseTitle=withoutFeaturing(title);

        Map<Long,Seed> unique=new HashMap<>();
        for(String country:new String[]{"FR","US"}){
            for(String q:new String[]{title+" "+artist,baseTitle+" "+artist}){
                collectSeeds(unique,q,country,title,baseTitle,artist,durationMs,hint);
            }
            if(hasStrongAlbumSeed(unique))break;
        }
        if(unique.isEmpty())return null;

        ArrayList<Seed> seeds=new ArrayList<>(unique.values());
        Collections.sort(seeds,(a,b)->Integer.compare(b.score,a.score));
        Result best=null;
        int probes=0;
        for(Seed seed:seeds){
            if(seed.collectionId<=0||seed.trackCount<4||seed.score<150)continue;
            if(probes++>=10)break;
            Result r;
            try{r=loadCollection(seed,title,baseTitle,artist,durationMs,hint);}catch(Throwable ignored){continue;}
            if(r==null||r.album==null)continue;
            if(best==null||r.score>best.score)best=r;
            if(r.album.confidence>=98&&r.score>=420)break;
        }
        return best!=null&&best.album.confidence>=90?best.album:null;
    }

    private static void collectSeeds(Map<Long,Seed> unique,String query,String country,String title,String baseTitle,String artist,long durationMs,String hint)throws Exception{
        JSONObject root=get(API+"/search?term="+enc(query)+"&country="+country+"&media=music&entity=song&limit=200");
        JSONArray rows=root.optJSONArray("results");if(rows==null)return;
        for(int i=0;i<rows.length();i++){
            JSONObject x=rows.optJSONObject(i);if(x==null||!"song".equalsIgnoreCase(x.optString("kind","")))continue;
            long cid=x.optLong("collectionId",0L);if(cid<=0)continue;
            String track=clean(x.optString("trackName",""));
            String gotArtist=clean(x.optString("artistName",""));
            String collection=clean(x.optString("collectionName",""));
            int count=x.optInt("trackCount",0);
            long td=x.optLong("trackTimeMillis",-1L);

            int titleScore=titleScore(title,baseTitle,track);
            if(titleScore<55)continue;
            if(!artistMatch(artist,gotArtist))continue;
            int s=titleScore+115+durationScore(durationMs,td);
            if(count>=7&&count<=30)s+=82;else if(count>=4&&count<=40)s+=55;else if(count<=2)s-=130;
            if(!TextUtils.isEmpty(collection))s+=12;
            if(AudifyInstantAlbumMetadata.similarity(collection,track)>=3)s-=55;
            String low=norm(collection);
            if(low.contains("single"))s-=110;
            if(low.contains("best of")||low.contains("greatest hits")||low.contains("compilation"))s-=110;
            if(!TextUtils.isEmpty(hint)){
                int hs=AudifyInstantAlbumMetadata.similarity(hint,collection);
                if(hs>=3)s+=95;else if(hs==2)s+=58;else if(hs==1)s+=16;
            }
            Seed old=unique.get(cid);
            if(old==null||s>old.score){
                Seed seed=new Seed();seed.collectionId=cid;seed.collectionName=collection;seed.artist=gotArtist;
                seed.country=country;seed.trackCount=count;seed.score=s;seed.durationMs=td;unique.put(cid,seed);
            }
        }
    }

    private static boolean hasStrongAlbumSeed(Map<Long,Seed> seeds){
        for(Seed s:seeds.values())if(s.trackCount>=7&&s.score>=320)return true;
        return false;
    }

    private static Result loadCollection(Seed seed,String title,String baseTitle,String artist,long durationMs,String hint)throws Exception{
        JSONObject root=get(API+"/lookup?id="+seed.collectionId+"&entity=song&limit=200&country="+seed.country);
        JSONArray rows=root.optJSONArray("results");if(rows==null||rows.length()<5)return null;

        JSONObject collectionRow=null;
        for(int i=0;i<rows.length();i++){
            JSONObject x=rows.optJSONObject(i);if(x==null)continue;
            if("collection".equalsIgnoreCase(x.optString("wrapperType",""))){collectionRow=x;break;}
        }
        String albumTitle=seed.collectionName,albumArtist=seed.artist,date="",cover="";
        int declared=seed.trackCount;
        if(collectionRow!=null){
            albumTitle=clean(collectionRow.optString("collectionName",albumTitle));
            albumArtist=clean(collectionRow.optString("artistName",albumArtist));
            date=collectionRow.optString("releaseDate","");
            declared=collectionRow.optInt("trackCount",declared);
            cover=art(collectionRow);
        }
        if(declared<4||declared>60)return null;
        if(genericCompilationArtist(albumArtist)||!artistMatch(artist,albumArtist))return null;

        AudifyInstantAlbumMetadata.Album album=new AudifyInstantAlbumMetadata.Album();
        album.releaseId="itunes-graph:"+seed.collectionId;
        album.groupId="itunes-graph:"+seed.collectionId;
        album.title=albumTitle;album.artist=albumArtist;album.date=date;album.type="Album";album.coverUrl=cover;
        album.source="Apple/iTunes Release Graph → Canonical Album";

        int bestIndex=-1,bestMatch=Integer.MIN_VALUE;
        int artistRows=0,artistHits=0;
        for(int i=0;i<rows.length();i++){
            JSONObject x=rows.optJSONObject(i);if(x==null||!"song".equalsIgnoreCase(x.optString("kind","")))continue;
            if(x.optLong("collectionId",0L)!=seed.collectionId)continue;
            String track=clean(x.optString("trackName",""));if(TextUtils.isEmpty(track))continue;
            String ta=clean(x.optString("artistName",""));
            long td=x.optLong("trackTimeMillis",-1L);

            AudifyInstantAlbumMetadata.Track t=new AudifyInstantAlbumMetadata.Track();
            t.position=x.optInt("trackNumber",album.tracks.size()+1);t.disc=x.optInt("discNumber",1);
            t.title=track;t.artist=TextUtils.isEmpty(ta)?albumArtist:ta;t.lengthMs=td;album.tracks.add(t);

            if(!TextUtils.isEmpty(ta)){artistRows++;if(artistMatch(artist,ta))artistHits++;}
            int m=titleScore(title,baseTitle,track);
            if(artistMatch(artist,ta))m+=110;else m-=70;
            m+=durationScore(durationMs,td);
            if(m>bestMatch){bestMatch=m;bestIndex=album.tracks.size()-1;}
            if(TextUtils.isEmpty(album.coverUrl))album.coverUrl=art(x);
        }
        if(album.tracks.size()<4||bestIndex<0||bestMatch<200)return null;
        if(artistRows>=4&&artistHits*100/artistRows<35)return null;
        album.current=bestIndex;

        int quality=bestMatch+seed.score;
        int count=album.tracks.size();
        if(count>=7&&count<=24)quality+=85;else if(count>=4&&count<=40)quality+=45;
        if(artistMatch(artist,album.artist))quality+=65;
        String low=norm(album.title);
        if(low.contains("best of")||low.contains("greatest hits")||low.contains("compilation"))return null;
        if(low.contains("deluxe")||low.contains("expanded")||low.contains("anniversary")||low.contains("collector"))quality-=18;
        if(AudifyInstantAlbumMetadata.similarity(album.title,title)>=3)quality-=35;
        if(!TextUtils.isEmpty(hint)){
            int hs=AudifyInstantAlbumMetadata.similarity(hint,album.title);
            if(hs>=3)quality+=95;else if(hs==2)quality+=60;else if(hs==1)quality+=15;
        }

        int conf=90;
        if(bestMatch>=320)conf+=5;else if(bestMatch>=270)conf+=3;
        if(count>=7&&count<=24)conf+=2;
        if(artistMatch(artist,album.artist))conf+=2;
        album.confidence=Math.min(99,conf);
        return new Result(album,quality);
    }

    private static int titleScore(String full,String base,String candidate){
        String c=norm(withoutFeaturing(candidate));
        String f=norm(withoutFeaturing(full)),b=norm(base);
        if(!TextUtils.isEmpty(b)&&b.equals(c))return 195;
        if(!TextUtils.isEmpty(f)&&f.equals(c))return 188;
        int sim=Math.max(AudifyInstantAlbumMetadata.similarity(base,candidate),AudifyInstantAlbumMetadata.similarity(full,candidate));
        if(sim>=3)return 145;if(sim==2)return 92;if(sim==1)return 48;return -120;
    }

    private static String withoutFeaturing(String value){
        if(TextUtils.isEmpty(value))return "";
        String s=value.replaceAll("(?i)\\s*[\\[(]\\s*(feat(?:uring)?|ft)\\.?\\s+[^\\])]+[\\])]\\s*"," ");
        s=s.replaceFirst("(?i)\\s+(feat(?:uring)?|ft)\\.?\\s+.+$","");
        return clean(s);
    }

    private static int durationScore(long expected,long actual){
        if(expected<=0||actual<=0)return 0;
        long d=Math.abs(expected-actual);
        if(d<=1800L)return 65;if(d<=4000L)return 52;if(d<=8000L)return 32;if(d<=15000L)return 10;
        if(d>=45000L)return -80;return -22;
    }

    private static boolean artistMatch(String wanted,String got){
        if(TextUtils.isEmpty(wanted)||TextUtils.isEmpty(got))return false;
        String a=norm(wanted),b=norm(got);if(a.equals(b))return true;
        if(a.length()>=4&&b.length()>=4&&(a.contains(b)||b.contains(a)))return true;
        Set<String> aa=tokens(a),bb=tokens(b);int hit=0;for(String x:aa)if(bb.contains(x))hit++;
        return hit>0&&hit*2>=Math.min(aa.size(),bb.size());
    }
    private static Set<String> tokens(String v){
        Set<String> s=new HashSet<>();for(String x:v.split("\\s+"))if(x.length()>=2&&!x.equals("feat")&&!x.equals("ft"))s.add(x);return s;
    }
    private static boolean genericCompilationArtist(String v){
        String n=norm(v);return n.equals("various artists")||n.equals("various artist")||n.equals("artistes varies")||n.equals("artistes divers")||n.equals("multiple artists");
    }
    private static String art(JSONObject x){
        String a=x.optString("artworkUrl100","");if(TextUtils.isEmpty(a))return "";
        return a.replace("100x100bb","1200x1200bb").replace("100x100-75","1200x1200-75");
    }
    private static String norm(String s){return AudifyInstantAlbumMetadata.norm(s==null?"":s);}
    private static String clean(String s){return s==null?"":s.trim().replaceAll("\\s+"," ");}
    private static String enc(String s)throws Exception{return URLEncoder.encode(s==null?"":s,"UTF-8");}

    private static JSONObject get(String url)throws Exception{
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(url).openConnection();c.setRequestMethod("GET");
            c.setRequestProperty("Accept","application/json");c.setRequestProperty("User-Agent","AudifyAndroid/68.16.1");
            c.setConnectTimeout(6500);c.setReadTimeout(9000);
            int code=c.getResponseCode();InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();
            String raw=in==null?"":read(in);if(code<200||code>=300)throw new java.io.IOException("Apple HTTP "+code);
            return new JSONObject(raw);
        }finally{if(c!=null)c.disconnect();}
    }
    private static String read(InputStream in)throws Exception{
        BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));
        StringBuilder b=new StringBuilder();String line;while((line=r.readLine())!=null)b.append(line);r.close();return b.toString();
    }
}
`;

await writeFile(resolverPath,resolver,'utf8');

let meta=await readFile(metaPath,'utf8');
const marker='static final String SINGLE_PROMOTION_MARKER="AUDIFY_V68160_SINGLE_TO_CANONICAL_ALBUM_PROMOTION";';
if(!meta.includes(marker))throw new Error('V68.16.1: V68.16 release preference marker missing');
meta=meta.replace(marker,marker+'\n    static final String APPLE_RELEASE_GRAPH_MARKER="AUDIFY_V68161_APPLE_RELEASE_GRAPH";\n    static final String APPLE_TRACKLIST_PROOF_MARKER="AUDIFY_V68161_APPLE_TRACKLIST_RELATION_PROOF";');

const anchor='        // V68.16 — only after all fast structural/catalogue paths fail, perform a deep';
if(!meta.includes(anchor))throw new Error('V68.16.1: deep fallback anchor missing');
const appleBlock=String.raw`        // V68.16.1 — Apple/iTunes deep release graph. Search several title variants,
        // enumerate every matching collection, then accept only a multi-track artist album
        // whose actual tracklist proves the recording. Standalone singles are never promoted alone.
        try{
            Album appleGraph=AudifyAppleReleaseGraphResolver.identify(title,artist,durationMs,hint);
            if(appleGraph!=null&&appleGraph.tracks.size()>=4&&appleGraph.confidence>=90)return appleGraph;
        }catch(Throwable ignored){}

`;
meta=meta.replace(anchor,appleBlock+anchor);
await writeFile(metaPath,meta,'utf8');
console.log('Audify V68.16.1: Apple/iTunes deep release graph enabled before Deezer discography fallback; multi-variant title search + verified album tracklist, no hard-coded mappings.');
