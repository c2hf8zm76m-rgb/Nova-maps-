import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const metaPath=path.join(pkgDir,'AudifyInstantAlbumMetadata.java');
const deezerPath=path.join(pkgDir,'AudifyDeezerAlbumResolver.java');

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
 * V68.15.5 — independent canonical-album cross-check through Deezer's public catalogue.
 * No hard-coded artist/album mapping and no persistent cache.
 * A result is accepted only when the searched song is actually present in the album tracklist.
 */
final class AudifyDeezerAlbumResolver {
    static final String MARKER="AUDIFY_V68155_DEEZER_CANONICAL_ALBUM_CROSSCHECK";
    static final String TRACKLIST_MARKER="AUDIFY_V68155_DEEZER_TRACKLIST_PROOF";

    private static final String API="https://api.deezer.com";

    private static final class Candidate {
        long albumId;
        String title="",artist="",albumTitle="";
        long durationMs=-1L;
        int score;
    }

    private AudifyDeezerAlbumResolver(){}

    static AudifyInstantAlbumMetadata.Album identify(String rawTitle,String rawArtist,long sourceDurationMs)throws Exception{
        String title=clean(rawTitle),artist=clean(rawArtist);
        if(TextUtils.isEmpty(title))return null;

        ArrayList<Candidate> candidates=search(title,artist,sourceDurationMs,true);
        if(candidates.isEmpty())candidates=search(title,artist,sourceDurationMs,false);
        if(candidates.isEmpty())return null;
        Collections.sort(candidates,(a,b)->Integer.compare(b.score,a.score));

        Set<Long> albumSeen=new HashSet<>();
        AudifyInstantAlbumMetadata.Album best=null;
        int bestScore=Integer.MIN_VALUE;
        int probes=0;
        for(Candidate c:candidates){
            if(c.albumId<=0||!albumSeen.add(c.albumId))continue;
            if(c.score<115)continue;
            if(probes++>=5)break;
            AlbumResult r;
            try{r=loadAlbum(c,title,artist,sourceDurationMs);}catch(Throwable ignored){continue;}
            if(r==null||r.album==null)continue;
            int total=c.score+r.quality;
            if(total>bestScore){bestScore=total;best=r.album;}
            if(r.album.confidence>=97&&r.quality>=55)return r.album;
        }
        return best!=null&&best.confidence>=88?best:null;
    }

    private static final class AlbumResult {
        final AudifyInstantAlbumMetadata.Album album;
        final int quality;
        AlbumResult(AudifyInstantAlbumMetadata.Album a,int q){album=a;quality=q;}
    }

    private static ArrayList<Candidate> search(String title,String artist,long durationMs,boolean advanced)throws Exception{
        String q;
        if(advanced&&!TextUtils.isEmpty(artist))q="artist:\""+artist+"\" track:\""+title+"\"";
        else q=(artist+" "+title).trim();
        JSONObject root=get(API+"/search/track?q="+enc(q)+"&limit=25");
        JSONArray data=root.optJSONArray("data");
        ArrayList<Candidate> out=new ArrayList<>();
        if(data==null)return out;
        for(int i=0;i<data.length();i++){
            JSONObject row=data.optJSONObject(i);if(row==null)continue;
            JSONObject ar=row.optJSONObject("artist");
            JSONObject al=row.optJSONObject("album");
            if(al==null)continue;
            Candidate c=new Candidate();
            c.albumId=al.optLong("id",0L);
            c.title=clean(row.optString("title_short",row.optString("title","")));
            c.artist=clean(ar==null?"":ar.optString("name",""));
            c.albumTitle=clean(al.optString("title",""));
            c.durationMs=row.optLong("duration",-1L)*1000L;
            c.score=scoreCandidate(c,title,artist,durationMs);
            if(c.albumId>0&&c.score>=70)out.add(c);
        }
        return out;
    }

    private static int scoreCandidate(Candidate c,String wantedTitle,String wantedArtist,long wantedDuration){
        int s=0;
        String nt=norm(wantedTitle),ct=norm(c.title);
        if(nt.equals(ct))s+=145;
        else {
            int sim=AudifyInstantAlbumMetadata.similarity(wantedTitle,c.title);
            if(sim>=3)s+=112;else if(sim==2)s+=75;else if(sim==1)s+=28;else s-=110;
        }
        if(!TextUtils.isEmpty(wantedArtist)){
            if(artistMatch(wantedArtist,c.artist))s+=105;else s-=120;
        }
        s+=durationScore(wantedDuration,c.durationMs);
        if(!TextUtils.isEmpty(c.albumTitle))s+=12;
        String low=norm(c.albumTitle);
        if(low.contains("single"))s-=38;
        if(low.contains("best of")||low.contains("greatest hits")||low.contains("compilation"))s-=70;
        return s;
    }

    private static AlbumResult loadAlbum(Candidate seed,String wantedTitle,String wantedArtist,long wantedDuration)throws Exception{
        JSONObject root=get(API+"/album/"+seed.albumId);
        if(root.has("error"))return null;
        String albumTitle=clean(root.optString("title",seed.albumTitle));
        String recordType=clean(root.optString("record_type",""));
        JSONObject albumArtistObj=root.optJSONObject("artist");
        String albumArtist=clean(albumArtistObj==null?"":albumArtistObj.optString("name",""));
        int declaredCount=root.optInt("nb_tracks",0);
        if(declaredCount>40)return null;
        if(!TextUtils.isEmpty(wantedArtist)){
            if(genericCompilationArtist(albumArtist))return null;
            if(!TextUtils.isEmpty(albumArtist)&&!artistMatch(wantedArtist,albumArtist))return null;
        }
        if("single".equalsIgnoreCase(recordType)&&declaredCount<=3)return null;

        JSONObject tracksObj=root.optJSONObject("tracks");
        JSONArray tracks=tracksObj==null?null:tracksObj.optJSONArray("data");
        if(tracks==null||tracks.length()<3)return null;

        AudifyInstantAlbumMetadata.Album a=new AudifyInstantAlbumMetadata.Album();
        a.releaseId="deezer:"+seed.albumId;
        a.groupId="deezer:"+seed.albumId;
        a.title=TextUtils.isEmpty(albumTitle)?seed.albumTitle:albumTitle;
        a.artist=TextUtils.isEmpty(albumArtist)?wantedArtist:albumArtist;
        a.date=root.optString("release_date","");
        a.type=TextUtils.isEmpty(recordType)?"Album":recordType;
        a.coverUrl=first(root,"cover_xl","cover_big","cover_medium");
        a.source="Deezer Canonical Album";

        int bestIndex=-1,bestTrackScore=Integer.MIN_VALUE;
        int knownArtists=0,matchedArtists=0;
        for(int i=0;i<tracks.length();i++){
            JSONObject row=tracks.optJSONObject(i);if(row==null)continue;
            String tt=clean(row.optString("title_short",row.optString("title","")));
            if(TextUtils.isEmpty(tt))continue;
            JSONObject ar=row.optJSONObject("artist");
            String ta=clean(ar==null?"":ar.optString("name",""));
            long td=row.optLong("duration",-1L)*1000L;

            AudifyInstantAlbumMetadata.Track t=new AudifyInstantAlbumMetadata.Track();
            t.position=a.tracks.size()+1;t.disc=1;t.title=tt;t.artist=TextUtils.isEmpty(ta)?a.artist:ta;t.lengthMs=td;
            a.tracks.add(t);

            if(!TextUtils.isEmpty(ta)){
                knownArtists++;
                if(TextUtils.isEmpty(wantedArtist)||artistMatch(wantedArtist,ta))matchedArtists++;
            }

            int m=0;
            String nt=norm(wantedTitle),ntrack=norm(tt);
            if(nt.equals(ntrack))m+=170;
            else {
                int sim=AudifyInstantAlbumMetadata.similarity(wantedTitle,tt);
                if(sim>=3)m+=125;else if(sim==2)m+=80;else if(sim==1)m+=24;
            }
            if(!TextUtils.isEmpty(wantedArtist)){
                if(artistMatch(wantedArtist,ta))m+=100;else m-=90;
            }
            m+=durationScore(wantedDuration,td);
            if(m>bestTrackScore){bestTrackScore=m;bestIndex=a.tracks.size()-1;}
        }
        if(a.tracks.size()<3||bestIndex<0||bestTrackScore<150)return null;
        a.current=bestIndex;

        if(knownArtists>=3&&!TextUtils.isEmpty(wantedArtist)){
            int pct=(matchedArtists*100)/knownArtists;
            if(pct<35)return null;
            if(a.tracks.size()>24&&pct<60)return null;
        }

        int quality=0;
        int count=a.tracks.size();
        if(count>=7&&count<=24)quality+=58;
        else if(count>=4&&count<=35)quality+=32;
        else quality+=10;
        if(!TextUtils.isEmpty(wantedArtist)&&artistMatch(wantedArtist,a.artist))quality+=45;
        if(bestTrackScore>=300)quality+=48;else if(bestTrackScore>=250)quality+=36;else if(bestTrackScore>=200)quality+=22;
        String low=norm(a.title);
        if(low.contains("single"))quality-=45;
        if(low.contains("best of")||low.contains("greatest hits")||low.contains("compilation"))quality-=80;
        if("album".equalsIgnoreCase(recordType))quality+=24;

        int conf=84;
        if(bestTrackScore>=300)conf+=7;else if(bestTrackScore>=250)conf+=5;else if(bestTrackScore>=200)conf+=3;
        if(count>=7&&count<=24)conf+=4;
        if(!TextUtils.isEmpty(wantedArtist)&&artistMatch(wantedArtist,a.artist))conf+=3;
        a.confidence=Math.min(99,conf);
        return new AlbumResult(a,quality);
    }

    private static int durationScore(long expected,long actual){
        if(expected<=0||actual<=0)return 0;
        long d=Math.abs(expected-actual);
        if(d<=1800L)return 58;
        if(d<=4000L)return 45;
        if(d<=8000L)return 26;
        if(d<=15000L)return 8;
        if(d>=45000L)return -65;
        return -18;
    }

    private static boolean artistMatch(String wanted,String got){
        if(TextUtils.isEmpty(wanted)||TextUtils.isEmpty(got))return false;
        String a=norm(wanted),b=norm(got);
        if(a.equals(b))return true;
        if(a.length()>=4&&b.length()>=4&&(a.contains(b)||b.contains(a)))return true;
        Set<String> aa=tokens(a),bb=tokens(b);
        int hit=0;for(String x:aa)if(bb.contains(x))hit++;
        return hit>0&&hit*2>=Math.min(aa.size(),bb.size());
    }

    private static boolean genericCompilationArtist(String value){
        String n=norm(value);
        return n.equals("various artists")||n.equals("various artist")||n.equals("artistes varies")||
               n.equals("artistes divers")||n.equals("multi interpretes")||n.equals("multiple artists");
    }

    private static Set<String> tokens(String value){
        Set<String> s=new HashSet<>();
        for(String x:value.split("\\s+"))if(x.length()>=2&&!x.equals("feat")&&!x.equals("ft"))s.add(x);
        return s;
    }

    private static String norm(String s){return AudifyInstantAlbumMetadata.norm(s==null?"":s);}
    private static String clean(String s){return s==null?"":s.trim().replaceAll("\\s+"," ");}
    private static String first(JSONObject o,String... keys){for(String k:keys){String v=o.optString(k,"");if(!TextUtils.isEmpty(v))return v;}return "";}
    private static String enc(String s)throws Exception{return URLEncoder.encode(s==null?"":s,"UTF-8");}

    private static JSONObject get(String url)throws Exception{
        HttpURLConnection c=null;
        try{
            c=(HttpURLConnection)new URL(url).openConnection();
            c.setRequestMethod("GET");
            c.setRequestProperty("Accept","application/json");
            c.setRequestProperty("User-Agent","AudifyAndroid/68.15.5");
            c.setConnectTimeout(7000);c.setReadTimeout(9000);
            int code=c.getResponseCode();
            InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();
            String raw=in==null?"":read(in);
            if(code<200||code>=300)throw new java.io.IOException("Deezer HTTP "+code);
            return new JSONObject(raw);
        }finally{if(c!=null)c.disconnect();}
    }

    private static String read(InputStream in)throws Exception{
        BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));
        StringBuilder b=new StringBuilder();String line;
        while((line=r.readLine())!=null)b.append(line);
        r.close();return b.toString();
    }
}
`;

await writeFile(deezerPath,resolver,'utf8');

let meta=await readFile(metaPath,'utf8');
const marker='static final String CANONICAL_ALBUM_MARKER="AUDIFY_V68153_CANONICAL_ARTIST_ALBUM_GUARD";';
if(!meta.includes(marker))throw new Error('V68.15.5: canonical metadata marker missing');
if(!meta.includes('AUDIFY_V68155_DEEZER_CANONICAL_ALBUM_CROSSCHECK')){
  meta=meta.replace(marker,marker+'\n    static final String DEEZER_CROSSCHECK_MARKER="AUDIFY_V68155_DEEZER_CANONICAL_ALBUM_CROSSCHECK";');
}

const oldBlock=String.raw`        try{
            Album ytm=AudifyYoutubeMusicAlbumResolver.identify(title,artist,videoId,durationMs,hint);
            if(ytm!=null&&ytm.tracks.size()>1&&ytm.confidence>=86)return ytm;
        }catch(Throwable ignored){}`;

const newBlock=String.raw`        Album ytmCandidate=null;
        try{
            Album ytm=AudifyYoutubeMusicAlbumResolver.identify(title,artist,videoId,durationMs,hint);
            if(ytm!=null&&ytm.tracks.size()>1&&ytm.confidence>=86){
                // Direct structural YouTube Music proof at near-perfect confidence remains fastest.
                if(ytm.confidence>=98)return ytm;
                ytmCandidate=ytm;
            }
        }catch(Throwable ignored){}

        // V68.15.5 — independent catalogue proof. This is deliberately generic:
        // no Ninho/Jefe special case. Deezer must confirm song+artist+duration inside the real tracklist.
        try{
            Album dz=AudifyDeezerAlbumResolver.identify(title,artist,durationMs);
            if(dz!=null&&dz.tracks.size()>2&&dz.confidence>=88){
                if(ytmCandidate!=null&&albumFamilyMatch(ytmCandidate,dz)){
                    if(TextUtils.isEmpty(ytmCandidate.coverUrl))ytmCandidate.coverUrl=dz.coverUrl;
                    ytmCandidate.confidence=clamp(Math.max(ytmCandidate.confidence,dz.confidence)+2,0,100);
                    ytmCandidate.source="YouTube Music + Deezer Canonical";
                    return ytmCandidate;
                }
                if(ytmCandidate==null||dz.confidence>=94)return dz;
            }
        }catch(Throwable ignored){}
        if(ytmCandidate!=null)return ytmCandidate;`;

if(!meta.includes(oldBlock))throw new Error('V68.15.5: YouTube Music primary block missing');
meta=meta.replace(oldBlock,newBlock);
await writeFile(metaPath,meta,'utf8');

console.log('Audify V68.15.5: Deezer canonical album cross-check added — generic song/artist/duration/tracklist proof, no artist-specific mapping.');
