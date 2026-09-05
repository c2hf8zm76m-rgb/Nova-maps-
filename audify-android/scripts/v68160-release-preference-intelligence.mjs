import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const metaPath=path.join(pkgDir,'AudifyInstantAlbumMetadata.java');
const resolverPath=path.join(pkgDir,'AudifyReleasePreferenceResolver.java');

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
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * V68.16 — deep release preference fallback.
 * If a recording exists both as a standalone single and inside a real artist album,
 * prefer the canonical album. If it only exists as a single, return null.
 * No artist/song mapping and no persistent cache.
 */
final class AudifyReleasePreferenceResolver {
    static final String MARKER="AUDIFY_V68160_RELEASE_PREFERENCE_INTELLIGENCE";
    static final String SINGLE_TO_ALBUM_MARKER="AUDIFY_V68160_SINGLE_TO_CANONICAL_ALBUM_PROMOTION";
    static final String AUTONOMOUS_SINGLE_MARKER="AUDIFY_V68160_AUTONOMOUS_SINGLE_GUARD";
    static final String DISCOGRAPHY_MARKER="AUDIFY_V68160_ARTIST_DISCOGRAPHY_PROOF";

    private static final String API="https://api.deezer.com";

    private static final class ArtistSeed {
        long id;
        String name="";
        int score;
    }
    private static final class AlbumSeed {
        long id;
        String title="",type="";
        int score;
    }
    private static final class AlbumResult {
        AudifyInstantAlbumMetadata.Album album;
        int score;
        AlbumResult(AudifyInstantAlbumMetadata.Album a,int s){album=a;score=s;}
    }

    private AudifyReleasePreferenceResolver(){}

    static AudifyInstantAlbumMetadata.Album identify(String rawTitle,String rawArtist,long durationMs,String albumHint)throws Exception{
        String title=clean(rawTitle),artist=clean(rawArtist),hint=clean(albumHint);
        if(TextUtils.isEmpty(title)||TextUtils.isEmpty(artist))return null;

        ArrayList<ArtistSeed> artists=findArtistSeeds(title,artist,durationMs);
        if(artists.isEmpty())return null;
        Collections.sort(artists,(a,b)->Integer.compare(b.score,a.score));

        AudifyInstantAlbumMetadata.Album best=null;
        int bestScore=Integer.MIN_VALUE;
        int artistScans=Math.min(2,artists.size());
        for(int i=0;i<artistScans;i++){
            ArtistSeed seed=artists.get(i);
            if(seed.id<=0||seed.score<175)continue;
            AlbumResult r=scanDiscography(seed.id,title,artist,durationMs,hint);
            if(r!=null&&r.album!=null&&r.score>bestScore){bestScore=r.score;best=r.album;}
            if(best!=null&&best.confidence>=97)break;
        }
        return best!=null&&best.confidence>=90?best:null;
    }

    private static ArrayList<ArtistSeed> findArtistSeeds(String title,String artist,long durationMs)throws Exception{
        ArrayList<ArtistSeed> out=new ArrayList<>();
        Set<Long> seen=new HashSet<>();
        for(String query:new String[]{"artist:\""+artist+"\" track:\""+title+"\"",artist+" "+title}){
            JSONObject root=get(API+"/search/track?q="+enc(query)+"&limit=50");
            JSONArray data=root.optJSONArray("data");if(data==null)continue;
            for(int i=0;i<data.length();i++){
                JSONObject row=data.optJSONObject(i);if(row==null)continue;
                JSONObject ar=row.optJSONObject("artist");if(ar==null)continue;
                long id=ar.optLong("id",0L);if(id<=0)continue;
                String gotTitle=clean(row.optString("title_short",row.optString("title","")));
                String gotArtist=clean(ar.optString("name",""));
                int s=0;
                String nt=norm(title),gt=norm(gotTitle);
                if(nt.equals(gt))s+=150;
                else {int sim=AudifyInstantAlbumMetadata.similarity(title,gotTitle);if(sim>=3)s+=118;else if(sim==2)s+=74;else if(sim==1)s+=25;else s-=120;}
                if(artistMatch(artist,gotArtist))s+=115;else s-=135;
                s+=durationScore(durationMs,row.optLong("duration",-1L)*1000L);
                if(s<150)continue;
                if(seen.add(id)){
                    ArtistSeed a=new ArtistSeed();a.id=id;a.name=gotArtist;a.score=s;out.add(a);
                }else{
                    for(ArtistSeed a:out)if(a.id==id&&s>a.score){a.score=s;a.name=gotArtist;}
                }
            }
            if(!out.isEmpty())break;
        }
        return out;
    }

    private static AlbumResult scanDiscography(long artistId,String title,String artist,long durationMs,String hint)throws Exception{
        JSONObject root=get(API+"/artist/"+artistId+"/albums?limit=100");
        JSONArray data=root.optJSONArray("data");if(data==null)return null;
        ArrayList<AlbumSeed> albums=new ArrayList<>();
        Set<Long> seen=new HashSet<>();
        for(int i=0;i<data.length();i++){
            JSONObject row=data.optJSONObject(i);if(row==null)continue;
            long id=row.optLong("id",0L);if(id<=0||!seen.add(id))continue;
            String type=clean(row.optString("record_type",""));
            String albumTitle=clean(row.optString("title",""));
            String low=norm(albumTitle),typeLow=norm(type);
            if(typeLow.equals("single")||typeLow.equals("compilation"))continue;
            int s=0;
            if(typeLow.equals("album"))s+=80;
            else if(typeLow.equals("ep"))s+=18;
            else if(TextUtils.isEmpty(typeLow))s+=35;
            if(!TextUtils.isEmpty(hint)){
                int hs=AudifyInstantAlbumMetadata.similarity(hint,albumTitle);
                if(hs>=3)s+=135;else if(hs==2)s+=90;else if(hs==1)s+=28;
            }
            if(AudifyInstantAlbumMetadata.similarity(albumTitle,title)>=3)s-=32;
            if(low.contains("best of")||low.contains("greatest hits")||low.contains("compilation"))s-=120;
            if(low.contains("deluxe")||low.contains("expanded")||low.contains("anniversary")||low.contains("collector"))s-=12;
            AlbumSeed a=new AlbumSeed();a.id=id;a.title=albumTitle;a.type=type;a.score=s;albums.add(a);
        }
        Collections.sort(albums,(a,b)->Integer.compare(b.score,a.score));

        AlbumResult best=null;
        int probes=0;
        for(AlbumSeed seed:albums){
            if(probes++>=18)break;
            AlbumResult r;
            try{r=loadAlbum(seed,title,artist,durationMs,hint);}catch(Throwable ignored){continue;}
            if(r==null||r.album==null)continue;
            r.score+=seed.score;
            if(best==null||r.score>best.score)best=r;
            if(r.album.confidence>=98&&r.score>=360)break;
        }
        return best;
    }

    private static AlbumResult loadAlbum(AlbumSeed seed,String wantedTitle,String wantedArtist,long wantedDuration,String hint)throws Exception{
        JSONObject root=get(API+"/album/"+seed.id);
        if(root.has("error"))return null;
        String recordType=clean(root.optString("record_type",seed.type));
        String typeNorm=norm(recordType);
        int count=root.optInt("nb_tracks",0);
        // This resolver is deliberately an album-promotion pass, never a single creator.
        if(typeNorm.equals("single")||typeNorm.equals("compilation")||count<4||count>40)return null;

        JSONObject ar=root.optJSONObject("artist");
        String albumArtist=clean(ar==null?"":ar.optString("name",""));
        if(genericCompilationArtist(albumArtist))return null;
        if(!TextUtils.isEmpty(albumArtist)&&!artistMatch(wantedArtist,albumArtist))return null;

        JSONObject tracksObj=root.optJSONObject("tracks");
        JSONArray tracks=tracksObj==null?null:tracksObj.optJSONArray("data");
        if(tracks==null||tracks.length()<4)return null;

        AudifyInstantAlbumMetadata.Album album=new AudifyInstantAlbumMetadata.Album();
        album.releaseId="deezer-promotion:"+seed.id;
        album.groupId="deezer-promotion:"+seed.id;
        album.title=clean(root.optString("title",seed.title));
        album.artist=TextUtils.isEmpty(albumArtist)?wantedArtist:albumArtist;
        album.date=root.optString("release_date","");
        album.type="Album";
        album.coverUrl=first(root,"cover_xl","cover_big","cover_medium");
        album.source="Deezer Artist Discography → Canonical Album";

        int bestIndex=-1,bestTrackScore=Integer.MIN_VALUE;
        int artistRows=0,artistHits=0;
        for(int i=0;i<tracks.length();i++){
            JSONObject row=tracks.optJSONObject(i);if(row==null)continue;
            String tt=clean(row.optString("title_short",row.optString("title","")));
            if(TextUtils.isEmpty(tt))continue;
            JSONObject taObj=row.optJSONObject("artist");
            String ta=clean(taObj==null?"":taObj.optString("name",""));
            long td=row.optLong("duration",-1L)*1000L;

            AudifyInstantAlbumMetadata.Track t=new AudifyInstantAlbumMetadata.Track();
            t.position=album.tracks.size()+1;t.disc=1;t.title=tt;t.artist=TextUtils.isEmpty(ta)?album.artist:ta;t.lengthMs=td;
            album.tracks.add(t);

            if(!TextUtils.isEmpty(ta)){artistRows++;if(artistMatch(wantedArtist,ta))artistHits++;}

            int m=0;
            String a=norm(wantedTitle),b=norm(tt);
            if(a.equals(b))m+=190;
            else {int sim=AudifyInstantAlbumMetadata.similarity(wantedTitle,tt);if(sim>=3)m+=140;else if(sim==2)m+=88;else if(sim==1)m+=24;}
            if(artistMatch(wantedArtist,ta))m+=105;else if(!TextUtils.isEmpty(ta))m-=80;
            m+=durationScore(wantedDuration,td);
            if(m>bestTrackScore){bestTrackScore=m;bestIndex=album.tracks.size()-1;}
        }
        if(album.tracks.size()<4||bestIndex<0||bestTrackScore<185)return null;
        if(artistRows>=4&&artistHits*100/artistRows<35)return null;
        album.current=bestIndex;

        int quality=0;
        if(count>=7&&count<=24)quality+=70;else if(count>=4&&count<=35)quality+=40;
        if(artistMatch(wantedArtist,album.artist))quality+=55;
        if(bestTrackScore>=320)quality+=70;else if(bestTrackScore>=270)quality+=52;else if(bestTrackScore>=220)quality+=32;
        if(!TextUtils.isEmpty(hint)){
            int hs=AudifyInstantAlbumMetadata.similarity(hint,album.title);
            if(hs>=3)quality+=95;else if(hs==2)quality+=60;else if(hs==1)quality+=18;
        }
        String low=norm(album.title);
        if(low.contains("best of")||low.contains("greatest hits")||low.contains("compilation"))return null;
        if(low.contains("deluxe")||low.contains("expanded")||low.contains("anniversary")||low.contains("collector"))quality-=12;

        int conf=90;
        if(bestTrackScore>=320)conf+=5;else if(bestTrackScore>=270)conf+=3;
        if(count>=7&&count<=24)conf+=2;
        if(artistMatch(wantedArtist,album.artist))conf+=2;
        if(!TextUtils.isEmpty(hint)&&AudifyInstantAlbumMetadata.similarity(hint,album.title)>=2)conf+=2;
        album.confidence=Math.min(99,conf);
        return new AlbumResult(album,quality+bestTrackScore);
    }

    private static int durationScore(long expected,long actual){
        if(expected<=0||actual<=0)return 0;
        long d=Math.abs(expected-actual);
        if(d<=1800L)return 60;
        if(d<=4000L)return 48;
        if(d<=8000L)return 30;
        if(d<=15000L)return 10;
        if(d>=45000L)return -70;
        return -20;
    }

    private static boolean artistMatch(String wanted,String got){
        if(TextUtils.isEmpty(wanted)||TextUtils.isEmpty(got))return false;
        String a=norm(wanted),b=norm(got);
        if(a.equals(b))return true;
        if(a.length()>=4&&b.length()>=4&&(a.contains(b)||b.contains(a)))return true;
        Set<String> aa=tokens(a),bb=tokens(b);int hit=0;
        for(String x:aa)if(bb.contains(x))hit++;
        return hit>0&&hit*2>=Math.min(aa.size(),bb.size());
    }
    private static Set<String> tokens(String v){
        Set<String> s=new HashSet<>();for(String x:v.split("\\s+"))if(x.length()>=2&&!x.equals("feat")&&!x.equals("ft"))s.add(x);return s;
    }
    private static boolean genericCompilationArtist(String v){
        String n=norm(v);return n.equals("various artists")||n.equals("various artist")||n.equals("artistes varies")||n.equals("artistes divers")||n.equals("multiple artists");
    }
    private static String norm(String s){return AudifyInstantAlbumMetadata.norm(s==null?"":s);}
    private static String clean(String s){return s==null?"":s.trim().replaceAll("\\s+"," ");}
    private static String first(JSONObject o,String... keys){for(String k:keys){String v=o.optString(k,"");if(!TextUtils.isEmpty(v))return v;}return "";}
    private static String enc(String s)throws Exception{return URLEncoder.encode(s==null?"":s,"UTF-8");}

    private static JSONObject get(String url)throws Exception{
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(url).openConnection();
            c.setRequestMethod("GET");c.setRequestProperty("Accept","application/json");
            c.setRequestProperty("User-Agent","AudifyAndroid/68.16");
            c.setConnectTimeout(6500);c.setReadTimeout(8500);
            int code=c.getResponseCode();
            InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();
            String raw=in==null?"":read(in);
            if(code<200||code>=300)throw new java.io.IOException("Deezer HTTP "+code);
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
const marker='static final String CHANNEL_ALIAS_MARKER="AUDIFY_V68159_CHANNEL_ALIAS_INDEPENDENCE";';
if(!meta.includes(marker))throw new Error('V68.16: Artist Identity Fusion marker missing');
meta=meta.replace(marker,marker+'\n    static final String RELEASE_PREFERENCE_MARKER="AUDIFY_V68160_RELEASE_PREFERENCE_INTELLIGENCE";\n    static final String SINGLE_PROMOTION_MARKER="AUDIFY_V68160_SINGLE_TO_CANONICAL_ALBUM_PROMOTION";');

const finalBlock=`        Album chosen=chooseConsensus(mb,apple,yt,hint);\n        if(chosen==null||chosen.tracks.size()<2||chosen.confidence<64)return null;\n        return chosen;`;
const replacement=`        Album chosen=chooseConsensus(mb,apple,yt,hint);\n        if(chosen!=null&&chosen.tracks.size()>1&&chosen.confidence>=64)return chosen;\n\n        // V68.16 — only after all fast structural/catalogue paths fail, perform a deep\n        // artist-discography pass. This promotes a recording from its standalone single\n        // to a real album only when the exact song is proven inside that album tracklist.\n        // Autonomous singles remain unresolved instead of receiving an invented album.\n        try{\n            Album promoted=AudifyReleasePreferenceResolver.identify(title,artist,durationMs,hint);\n            if(promoted!=null&&promoted.tracks.size()>=4&&promoted.confidence>=90)return promoted;\n        }catch(Throwable ignored){}\n        return null;`;
if(!meta.includes(finalBlock))throw new Error('V68.16: final consensus block missing');
meta=meta.replace(finalBlock,replacement);
await writeFile(metaPath,meta,'utf8');

console.log('Audify V68.16: Release Preference Intelligence enabled — album membership outranks standalone single when proven through the artist discography; autonomous singles remain unassigned; no hard-coded releases.');
