import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');

// Audify V68.14 — Album Intelligence 2.0
// Goals:
// - enrich the seed from the exact YouTube video page (duration, channel, Art Track description)
// - use YouTube Art Track album hints as evidence, never as the only proof
// - try an exact MusicBrainz URL relationship for Topic/Art Track videos
// - score MusicBrainz + Apple candidates with title, artist, duration, album hint and edition quality
// - require consensus when the catalogues disagree
// - remove the old synthetic "Autour de ..." collection from album recognition
// - keep the resolver focused on official/topic versions with stronger duration matching

const metadata=String.raw`package com.nova.audify;

import android.content.Context;
import android.content.SharedPreferences;
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
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

final class AudifyInstantAlbumMetadata {
    static final String MARKER="AUDIFY_V6814_ALBUM_INTELLIGENCE_2";
    static final String PREFS="audify_instant_albums_v6814";
    private static final long CACHE=30L*24L*60L*60L*1000L;
    private static final long MB_GAP=1100L;
    private static long lastMb;

    static final class Track {
        int position,disc;
        String title="",artist="";
        long lengthMs=-1L;
        JSONObject json() throws Exception {
            JSONObject o=new JSONObject();
            o.put("p",position);o.put("d",disc);o.put("t",title);o.put("a",artist);o.put("l",lengthMs);
            return o;
        }
        static Track from(JSONObject o){
            if(o==null)return null;
            Track t=new Track();
            t.position=o.optInt("p");t.disc=o.optInt("d",1);t.title=o.optString("t","");
            t.artist=o.optString("a","");t.lengthMs=o.optLong("l",-1L);
            return t;
        }
    }

    static final class Album {
        String releaseId="",groupId="",title="",artist="",date="",type="Album",coverUrl="",source="";
        int current=-1,confidence=0;
        final ArrayList<Track> tracks=new ArrayList<>();
        JSONObject json() throws Exception {
            JSONObject o=new JSONObject();
            o.put("release",releaseId);o.put("group",groupId);o.put("title",title);o.put("artist",artist);
            o.put("date",date);o.put("type",type);o.put("cover",coverUrl);o.put("source",source);
            o.put("confidence",confidence);o.put("current",current);
            JSONArray a=new JSONArray();for(Track t:tracks)a.put(t.json());o.put("tracks",a);
            return o;
        }
        static Album from(JSONObject o){
            if(o==null)return null;
            Album a=new Album();
            a.releaseId=o.optString("release","");a.groupId=o.optString("group","");a.title=o.optString("title","");
            a.artist=o.optString("artist","");a.date=o.optString("date","");a.type=o.optString("type","Album");
            a.coverUrl=o.optString("cover","");a.source=o.optString("source","");a.confidence=o.optInt("confidence",0);
            a.current=o.optInt("current",-1);
            JSONArray x=o.optJSONArray("tracks");
            if(x!=null)for(int i=0;i<x.length();i++){Track t=Track.from(x.optJSONObject(i));if(t!=null&&!TextUtils.isEmpty(t.title))a.tracks.add(t);}
            return a;
        }
    }

    private static final class Resolution {
        Album album;int score;boolean exact;
        Resolution(Album a,int s){album=a;score=s;}
        Resolution(Album a,int s,boolean x){album=a;score=s;exact=x;}
    }
    private static final class Rec {
        String id="";int score;
        Rec(String i,int s){id=i;score=s;}
    }
    private static final class YoutubeEvidence {
        String title="",artist="",channelId="",description="",albumHint="";
        long durationMs=-1L;
        boolean topic=false;
    }

    static Album cached(Context c,String key){
        try{
            SharedPreferences p=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
            String r=p.getString("a_"+Integer.toHexString(key.hashCode()),null);
            if(TextUtils.isEmpty(r))return null;
            JSONObject o=new JSONObject(r);
            if(System.currentTimeMillis()-o.optLong("saved",0)>CACHE)return null;
            Album a=Album.from(o.optJSONObject("album"));
            return a!=null&&a.tracks.size()>1&&a.confidence>=72?a:null;
        }catch(Throwable e){return null;}
    }

    static void cache(Context c,String key,Album a){
        if(c==null||a==null||a.confidence<72)return;
        try{
            JSONObject o=new JSONObject();o.put("saved",System.currentTimeMillis());o.put("album",a.json());
            c.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString("a_"+Integer.toHexString(key.hashCode()),o.toString()).apply();
        }catch(Throwable ignored){}
    }

    static Album identify(String rawTitle,String rawArtist)throws Exception{
        return identify(rawTitle,rawArtist,"");
    }

    static Album identify(String rawTitle,String rawArtist,String videoId)throws Exception{
        YoutubeEvidence yt=new YoutubeEvidence();
        try{if(!TextUtils.isEmpty(videoId))yt=youtubeEvidence(videoId);}catch(Throwable ignored){}

        String artist=cleanArtist(rawArtist);
        if((TextUtils.isEmpty(artist)||looksGenericArtist(artist))&&!TextUtils.isEmpty(yt.artist))artist=cleanArtist(yt.artist);
        String title=stripArtistPrefix(cleanTitle(rawTitle),artist);
        String ytTitle=stripArtistPrefix(cleanTitle(yt.title),artist);
        if(TextUtils.isEmpty(title)&&!TextUtils.isEmpty(ytTitle))title=ytTitle;
        else if(!TextUtils.isEmpty(ytTitle)&&similarity(title,ytTitle)>=2)title=shorterUseful(title,ytTitle);
        if(TextUtils.isEmpty(title))return null;

        long durationMs=yt.durationMs;
        String hint=cleanAlbumHint(yt.albumHint,title,artist);

        // Exact external URL relationship: very strong when a YouTube Art Track is linked in MusicBrainz.
        if(yt.topic&&!TextUtils.isEmpty(videoId)){
            try{
                Resolution exact=musicBrainzByYoutubeUrl(videoId,title,artist,durationMs,hint);
                if(exact!=null&&exact.album!=null&&exact.album.tracks.size()>1){
                    exact.album.confidence=99;
                    exact.album.source="MusicBrainz URL + YouTube Art Track";
                    return exact.album;
                }
            }catch(Throwable ignored){}
        }

        Resolution mb=null,apple=null;
        try{mb=musicBrainzDeep(title,artist,durationMs,hint);}catch(Throwable ignored){}
        try{apple=appleBest(title,artist,durationMs,hint);}catch(Throwable ignored){}

        Album chosen=chooseConsensus(mb,apple,yt,hint);
        if(chosen==null||chosen.tracks.size()<2||chosen.confidence<72)return null;
        return chosen;
    }

    private static Album chooseConsensus(Resolution mb,Resolution apple,YoutubeEvidence yt,String hint){
        if(mb==null&&apple==null)return null;
        if(mb!=null&&mb.exact){mb.album.confidence=99;return mb.album;}

        if(mb!=null&&apple!=null){
            Album ma=mb.album,aa=apple.album;
            boolean same=albumFamilyMatch(ma,aa);
            if(same){
                Album out=ma;
                if(TextUtils.isEmpty(out.coverUrl))out.coverUrl=aa.coverUrl;
                int bonus=9;
                int dc=Math.abs(ma.tracks.size()-aa.tracks.size());
                if(dc==0)bonus+=5;else if(dc<=2)bonus+=2;
                int agreement=trackAgreement(ma,aa);
                if(agreement>=4)bonus+=5;else if(agreement>=2)bonus+=2;
                if(!TextUtils.isEmpty(hint)&&similarity(out.title,hint)>=2)bonus+=4;
                if(yt.topic)bonus+=2;
                out.confidence=clamp(Math.max(ma.confidence,aa.confidence)+bonus,0,100);
                out.source="MusicBrainz + Apple/iTunes"+(yt.topic?" + YouTube Art Track":" + YouTube");
                return out;
            }

            int delta=ma.confidence-aa.confidence;
            // Disagreement is intentionally conservative: only a clearly stronger catalogue may win.
            if(delta>=12&&ma.confidence>=88){ma.source="MusicBrainz (Apple disagreement)";return ma;}
            if(delta<=-12&&aa.confidence>=88){aa.source="Apple/iTunes (MusicBrainz disagreement)";return aa;}
            return null;
        }

        Album single=mb!=null?mb.album:apple.album;
        if(single==null)return null;
        if(yt.topic)single.confidence=clamp(single.confidence+3,0,100);
        if(!TextUtils.isEmpty(hint)&&similarity(single.title,hint)>=2)single.confidence=clamp(single.confidence+5,0,100);
        if(single.confidence<78)return null;
        single.source=(mb!=null?"MusicBrainz":"Apple/iTunes")+(yt.topic?" + YouTube Art Track":" + YouTube");
        return single;
    }

    private static Resolution musicBrainzByYoutubeUrl(String videoId,String title,String artist,long durationMs,String hint)throws Exception{
        String resource="https://www.youtube.com/watch?v="+videoId;
        JSONObject u;
        try{u=mbGet("https://musicbrainz.org/ws/2/url?resource="+enc(resource)+"&fmt=json");}
        catch(Throwable first){
            resource="https://youtu.be/"+videoId;
            u=mbGet("https://musicbrainz.org/ws/2/url?resource="+enc(resource)+"&fmt=json");
        }
        String uid=u.optString("id","");if(TextUtils.isEmpty(uid))return null;
        JSONObject full=mbGet("https://musicbrainz.org/ws/2/url/"+path(uid)+"?inc=recording-rels&fmt=json");
        JSONArray rels=full.optJSONArray("relations");if(rels==null)return null;
        for(int i=0;i<rels.length();i++){
            JSONObject rel=rels.optJSONObject(i);if(rel==null)continue;
            JSONObject rec=rel.optJSONObject("recording");
            if(rec==null)continue;
            String rid=rec.optString("id","");if(TextUtils.isEmpty(rid))continue;
            Resolution r=releaseFromRecording(rid,title,artist,durationMs,hint,120);
            if(r!=null){r.exact=true;r.score+=120;r.album.confidence=99;return r;}
        }
        return null;
    }

    private static Resolution musicBrainzDeep(String title,String artist,long durationMs,String hint)throws Exception{
        String q="recording:\""+lucene(title)+"\""+(TextUtils.isEmpty(artist)?"":" AND artist:\""+lucene(artist)+"\"");
        JSONObject root=mbGet("https://musicbrainz.org/ws/2/recording/?query="+enc(q)+"&fmt=json&limit=12");
        JSONArray recs=root.optJSONArray("recordings");if(recs==null)return null;
        ArrayList<Rec> ranked=new ArrayList<>();
        for(int i=0;i<recs.length();i++){
            JSONObject r=recs.optJSONObject(i);if(r==null||TextUtils.isEmpty(r.optString("id","")))continue;
            String credited=credit(r.optJSONArray("artist-credit"));
            int s=r.optInt("score",0)+similarity(title,r.optString("title",""))*42;
            if(!TextUtils.isEmpty(artist)&&artistMatch(credited,artist))s+=44;
            else if(!TextUtils.isEmpty(artist))s-=22;
            s+=durationScore(durationMs,r.optLong("length",-1L));
            ranked.add(new Rec(r.optString("id"),s));
        }
        Collections.sort(ranked,(a,b)->Integer.compare(b.score,a.score));
        Resolution best=null;
        int scans=Math.min(2,ranked.size());
        for(int i=0;i<scans;i++){
            Rec rec=ranked.get(i);
            Resolution candidate=releaseFromRecording(rec.id,title,artist,durationMs,hint,rec.score);
            if(candidate!=null&&(best==null||candidate.score>best.score))best=candidate;
            if(best!=null&&best.score>=335)break;
        }
        if(best==null||best.score<205)return null;
        best.album.confidence=clamp(68+(best.score-205)/7,68,98);
        best.album.source="MusicBrainz Deep";
        return best;
    }

    private static Resolution releaseFromRecording(String recordingId,String title,String artist,long durationMs,String hint,int base)throws Exception{
        JSONObject browse=mbGet("https://musicbrainz.org/ws/2/release?recording="+path(recordingId)+"&inc=release-groups+artist-credits+recordings&fmt=json&limit=100");
        JSONArray releases=browse.optJSONArray("releases");if(releases==null)return null;
        JSONObject bestRelease=null;int bestScore=Integer.MIN_VALUE;
        for(int i=0;i<releases.length();i++){
            JSONObject rel=releases.optJSONObject(i);if(rel==null||TextUtils.isEmpty(rel.optString("id","")))continue;
            int s=base+releaseScore(rel,title,artist,hint);
            if(s>bestScore){bestScore=s;bestRelease=rel;}
        }
        if(bestRelease==null)return null;
        JSONObject full=bestRelease;
        if(full.optJSONArray("media")==null||trackCount(full)==0){
            full=mbGet("https://musicbrainz.org/ws/2/release/"+path(bestRelease.optString("id"))+"?inc=recordings+artist-credits+release-groups&fmt=json");
        }
        Album a=parseMb(full,title,artist);if(a==null)return null;
        return new Resolution(a,bestScore);
    }

    private static int releaseScore(JSONObject rel,String song,String artist,String hint){
        int s=0;
        if("Official".equalsIgnoreCase(rel.optString("status","")))s+=28;
        JSONObject rg=rel.optJSONObject("release-group");
        String type=rg==null?"":rg.optString("primary-type","");
        if("Album".equalsIgnoreCase(type))s+=82;
        else if("EP".equalsIgnoreCase(type))s+=34;
        else if("Single".equalsIgnoreCase(type))s-=58;
        JSONArray sec=rg==null?null:rg.optJSONArray("secondary-types");
        if(sec!=null)for(int i=0;i<sec.length();i++){
            String v=sec.optString(i,"").toLowerCase(Locale.ROOT);
            if(v.contains("compilation"))s-=45;
            if(v.contains("live"))s-=35;
            if(v.contains("remix"))s-=38;
            if(v.contains("soundtrack"))s-=12;
        }
        int n=trackCount(rel);
        if(n>=7&&n<=30)s+=31;else if(n>=4&&n<=40)s+=17;else if(n>0&&n<=2)s-=38;
        String rt=rel.optString("title","");
        if(!TextUtils.isEmpty(hint)){
            int hs=similarity(rt,hint);
            if(hs>=2)s+=68;else if(hs==1)s+=25;else s-=18;
        }
        if(!TextUtils.isEmpty(artist)&&artistMatch(credit(rel.optJSONArray("artist-credit")),artist))s+=18;
        String low=rt.toLowerCase(Locale.ROOT);
        if(low.contains("deluxe")||low.contains("expanded")||low.contains("anniversary")||low.contains("collector"))s-=13;
        if(low.contains("instrumental")&&!norm(song).contains("instrumental"))s-=28;
        return s;
    }

    private static Album parseMb(JSONObject r,String currentTitle,String currentArtist){
        if(r==null)return null;
        Album a=new Album();a.releaseId=r.optString("id","");a.title=r.optString("title","Album");
        a.artist=credit(r.optJSONArray("artist-credit"));if(TextUtils.isEmpty(a.artist))a.artist=currentArtist;
        a.date=r.optString("date","");JSONObject rg=r.optJSONObject("release-group");
        a.groupId=rg==null?"":rg.optString("id","");a.type=rg==null?"Album":rg.optString("primary-type","Album");
        JSONArray media=r.optJSONArray("media");if(media==null)return null;
        int pos=0;
        for(int m=0;m<media.length();m++){
            JSONObject med=media.optJSONObject(m);JSONArray tr=med==null?null:med.optJSONArray("tracks");if(tr==null)continue;
            for(int i=0;i<tr.length();i++){
                JSONObject o=tr.optJSONObject(i);if(o==null)continue;
                Track t=new Track();t.position=++pos;t.disc=m+1;t.title=o.optString("title","");t.lengthMs=o.optLong("length",-1L);
                t.artist=credit(o.optJSONArray("artist-credit"));
                if(TextUtils.isEmpty(t.artist)){JSONObject rec=o.optJSONObject("recording");if(rec!=null)t.artist=credit(rec.optJSONArray("artist-credit"));}
                if(TextUtils.isEmpty(t.artist))t.artist=a.artist;
                if(!TextUtils.isEmpty(t.title))a.tracks.add(t);
            }
        }
        locateCurrent(a,currentTitle);
        return a.tracks.size()>1?a:null;
    }

    private static Resolution appleBest(String title,String artist,long durationMs,String hint)throws Exception{
        Resolution fr=appleAlbum(title,artist,"FR",durationMs,hint);
        if(fr!=null&&fr.score>=285)return fr;
        Resolution us=appleAlbum(title,artist,"US",durationMs,hint);
        Resolution best=fr==null?us:(us==null?fr:(us.score>fr.score?us:fr));
        if(best==null||best.score<170)return null;
        best.album.confidence=clamp(66+(best.score-170)/5,66,96);
        best.album.source="Apple/iTunes";
        return best;
    }

    private static Resolution appleAlbum(String title,String artist,String country,long durationMs,String hint)throws Exception{
        JSONArray rows=appleSearch(title+" "+artist,country,50);if(rows==null)return null;
        JSONObject best=null;int bestScore=Integer.MIN_VALUE;
        for(int i=0;i<rows.length();i++){
            JSONObject x=rows.optJSONObject(i);if(x==null||!"song".equalsIgnoreCase(x.optString("kind","")))continue;
            String tn=x.optString("trackName",""),an=x.optString("artistName",""),cn=x.optString("collectionName","");
            if(TextUtils.isEmpty(cn)||x.optLong("collectionId",0L)<=0)continue;
            int sim=similarity(title,tn);if(sim==0)continue;
            int s=sim*48;
            if(artistMatch(an,artist))s+=54;else if(!TextUtils.isEmpty(artist))s-=32;
            s+=durationScore(durationMs,x.optLong("trackTimeMillis",-1L));
            int count=x.optInt("trackCount",0);
            if(count>=7&&count<=35)s+=38;else if(count>=4)s+=22;else if(count<=2)s-=52;
            if(!TextUtils.isEmpty(hint)){
                int hs=similarity(cn,hint);if(hs>=2)s+=72;else if(hs==1)s+=25;else s-=20;
            }
            if(!norm(cn).equals(norm(tn)))s+=10;
            String low=cn.toLowerCase(Locale.ROOT);
            if(low.contains("single"))s-=34;
            if(low.contains("compilation")||low.contains("greatest hits"))s-=28;
            if(low.contains("deluxe")||low.contains("expanded")||low.contains("anniversary"))s-=11;
            if(s>bestScore){bestScore=s;best=x;}
        }
        if(best==null||bestScore<155)return null;
        long collectionId=best.optLong("collectionId",0L);
        JSONObject lookup=httpJson("https://itunes.apple.com/lookup?id="+collectionId+"&entity=song&country="+country+"&limit=200",false);
        Album a=parseAppleAlbum(lookup,collectionId,title,artist,best);if(a==null)return null;
        a.confidence=clamp(66+(bestScore-170)/5,66,96);
        return new Resolution(a,bestScore);
    }

    private static JSONArray appleSearch(String query,String country,int limit)throws Exception{
        JSONObject root=httpJson("https://itunes.apple.com/search?term="+enc(query)+"&entity=song&country="+country+"&limit="+limit,false);
        return root.optJSONArray("results");
    }

    private static Album parseAppleAlbum(JSONObject root,long collectionId,String currentTitle,String currentArtist,JSONObject seed){
        JSONArray rs=root==null?null:root.optJSONArray("results");if(rs==null)return null;
        Album a=new Album();a.groupId="itunes:"+collectionId;a.title=seed.optString("collectionName","Album");
        a.artist=seed.optString("collectionArtistName",seed.optString("artistName",currentArtist));
        a.date=seed.optString("releaseDate","");a.type="Album";a.coverUrl=appleArt(seed);
        ArrayList<JSONObject> songs=new ArrayList<>();
        for(int i=0;i<rs.length();i++){
            JSONObject x=rs.optJSONObject(i);if(x==null||!"song".equalsIgnoreCase(x.optString("kind","")))continue;
            if(x.optLong("collectionId",0L)==collectionId)songs.add(x);
        }
        Collections.sort(songs,(x,y)->{
            int d=Integer.compare(x.optInt("discNumber",1),y.optInt("discNumber",1));
            return d!=0?d:Integer.compare(x.optInt("trackNumber",999),y.optInt("trackNumber",999));
        });
        int pos=0;
        for(JSONObject x:songs){
            Track t=new Track();t.position=++pos;t.disc=x.optInt("discNumber",1);t.title=x.optString("trackName","");
            t.artist=x.optString("artistName",a.artist);t.lengthMs=x.optLong("trackTimeMillis",-1L);
            if(!TextUtils.isEmpty(t.title))a.tracks.add(t);
            if(TextUtils.isEmpty(a.coverUrl))a.coverUrl=appleArt(x);
        }
        locateCurrent(a,currentTitle);
        return a.tracks.size()>1?a:null;
    }

    private static YoutubeEvidence youtubeEvidence(String videoId)throws Exception{
        YoutubeEvidence y=new YoutubeEvidence();
        if(TextUtils.isEmpty(videoId))return y;
        String page=httpText("https://www.youtube.com/watch?v="+enc(videoId)+"&hl=fr&persist_hl=1");
        String[] markers=new String[]{"var ytInitialPlayerResponse =","ytInitialPlayerResponse =","\"ytInitialPlayerResponse\":"};
        JSONObject player=null;
        for(String marker:markers){
            String raw=balancedObjectAfter(page,marker);
            if(TextUtils.isEmpty(raw))continue;
            try{player=new JSONObject(raw);break;}catch(Throwable ignored){}
        }
        if(player==null)return y;
        JSONObject vd=player.optJSONObject("videoDetails");
        if(vd!=null){
            y.title=vd.optString("title","");y.artist=vd.optString("author","");y.channelId=vd.optString("channelId","");
            y.description=vd.optString("shortDescription","");
            try{y.durationMs=Long.parseLong(vd.optString("lengthSeconds","-1"))*1000L;}catch(Throwable ignored){}
        }
        String lowArtist=y.artist.toLowerCase(Locale.ROOT),lowDesc=y.description.toLowerCase(Locale.ROOT);
        y.topic=lowArtist.endsWith(" - topic")||lowArtist.endsWith(" topic")||lowDesc.contains("provided to youtube by")||lowDesc.contains("auto-generated by youtube");
        y.albumHint=parseAlbumHint(y.description,cleanTitle(y.title),cleanArtist(y.artist));
        return y;
    }

    private static String parseAlbumHint(String description,String title,String artist){
        if(TextUtils.isEmpty(description))return "";
        String[] lines=description.replace('\r','\n').split("\\n+");
        for(String raw:lines){
            String l=raw.trim();
            String low=l.toLowerCase(Locale.ROOT);
            if(low.startsWith("album:")||low.startsWith("album ·")){
                String out=l.substring(l.indexOf(':')>=0?l.indexOf(':')+1:Math.min(l.length(),7)).trim();
                if(isUsefulAlbumHint(out,title,artist))return out;
            }
        }
        int provided=-1;
        for(int i=0;i<lines.length;i++)if(lines[i].toLowerCase(Locale.ROOT).contains("provided to youtube by")){provided=i;break;}
        if(provided<0)return "";
        int musicalLines=0;
        for(int i=provided+1;i<Math.min(lines.length,provided+12);i++){
            String l=lines[i].trim();if(l.isEmpty())continue;
            String low=l.toLowerCase(Locale.ROOT);
            if(low.startsWith("℗")||low.startsWith("©")||low.startsWith("released on")||low.startsWith("producer")||low.startsWith("composer")||low.startsWith("auto-generated"))continue;
            if(similarity(l,title)>=2)continue;
            if(l.contains(" · ")&&(contains(l,artist)||musicalLines==0)){musicalLines++;continue;}
            if(isUsefulAlbumHint(l,title,artist))return l;
            musicalLines++;
        }
        return "";
    }

    private static boolean isUsefulAlbumHint(String value,String title,String artist){
        if(TextUtils.isEmpty(value)||value.length()>120)return false;
        String low=value.toLowerCase(Locale.ROOT);
        if(low.startsWith("http")||low.contains("youtube")||low.startsWith("released on")||low.startsWith("provided to"))return false;
        if(similarity(value,title)>=2)return false;
        return !(norm(value).equals(norm(artist)));
    }

    private static String cleanAlbumHint(String raw,String title,String artist){
        String h=raw==null?"":raw.trim();
        return isUsefulAlbumHint(h,title,artist)?h:"";
    }

    private static int durationScore(long expected,long actual){
        if(expected<=0||actual<=0)return 0;
        long d=Math.abs(expected-actual);
        if(d<=2500L)return 36;
        if(d<=6000L)return 30;
        if(d<=12000L)return 22;
        if(d<=22000L)return 12;
        if(d<=45000L)return 2;
        if(d<=75000L)return -28;
        return -48;
    }

    private static boolean albumFamilyMatch(Album a,Album b){
        if(a==null||b==null)return false;
        if(similarity(a.title,b.title)<2)return false;
        return artistMatch(a.artist,b.artist);
    }

    private static int trackAgreement(Album a,Album b){
        int n=Math.min(Math.min(a.tracks.size(),b.tracks.size()),6),ok=0;
        for(int i=0;i<n;i++)if(similarity(a.tracks.get(i).title,b.tracks.get(i).title)>=2)ok++;
        return ok;
    }

    private static int trackCount(JSONObject rel){
        int n=rel.optInt("track-count",0);if(n>0)return n;
        JSONArray media=rel.optJSONArray("media");if(media==null)return 0;
        int c=0;
        for(int i=0;i<media.length();i++){
            JSONObject m=media.optJSONObject(i);if(m==null)continue;
            JSONArray t=m.optJSONArray("tracks");if(t!=null)c+=t.length();else c+=m.optInt("track-count",0);
        }
        return c;
    }

    private static void locateCurrent(Album a,String title){
        if(a==null)return;
        int best=-1,score=0;
        for(int i=0;i<a.tracks.size();i++){
            int s=similarity(title,a.tracks.get(i).title);
            if(s>score){score=s;best=i;}
        }
        if(score>=2)a.current=best;
    }

    private static JSONObject mbGet(String url)throws Exception{return httpJson(url,true);}

    private static JSONObject httpJson(String url,boolean musicBrainz)throws Exception{
        String text=http(url,musicBrainz,true);
        return new JSONObject(text);
    }

    private static String httpText(String url)throws Exception{return http(url,false,false);}

    private static String http(String endpoint,boolean musicBrainz,boolean json)throws Exception{
        if(musicBrainz)throttleMb();
        HttpURLConnection c=(HttpURLConnection)new URL(endpoint).openConnection();
        c.setConnectTimeout(8000);c.setReadTimeout(11500);c.setInstanceFollowRedirects(true);c.setUseCaches(false);
        c.setRequestProperty("User-Agent",musicBrainz?"Audify/68.14 (https://github.com/c2hf8zm76m-rgb/Nova-maps-)":"Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36");
        c.setRequestProperty("Accept-Language","fr-FR,fr;q=0.9,en;q=0.7");
        c.setRequestProperty("Accept",json?"application/json":"text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.7");
        c.setRequestProperty("Accept-Encoding","identity");
        try{
            int code=c.getResponseCode();InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();
            if(in==null)throw new IllegalStateException("HTTP "+code);
            BufferedReader br=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));
            StringBuilder b=new StringBuilder();char[] buf=new char[8192];int n;
            while((n=br.read(buf))>=0)b.append(buf,0,n);br.close();
            if(code<200||code>=300)throw new IllegalStateException("HTTP "+code);
            return b.toString();
        }finally{c.disconnect();}
    }

    private static synchronized void throttleMb()throws InterruptedException{
        long now=android.os.SystemClock.elapsedRealtime(),wait=MB_GAP-(now-lastMb);
        if(wait>0)Thread.sleep(wait);
        lastMb=android.os.SystemClock.elapsedRealtime();
    }

    private static String balancedObjectAfter(String text,String marker){
        if(TextUtils.isEmpty(text))return "";
        int at=text.indexOf(marker);if(at<0)return "";
        int start=text.indexOf('{',at+marker.length());if(start<0)return "";
        int depth=0;boolean quoted=false,escaped=false;
        for(int i=start;i<text.length();i++){
            char ch=text.charAt(i);
            if(quoted){
                if(escaped){escaped=false;continue;}
                if(ch=='\\'){escaped=true;continue;}
                if(ch=='\"')quoted=false;
                continue;
            }
            if(ch=='\"'){quoted=true;continue;}
            if(ch=='{')depth++;
            else if(ch=='}'){depth--;if(depth==0)return text.substring(start,i+1);}
        }
        return "";
    }

    static String key(Album a){
        if(a==null)return "";
        if(!TextUtils.isEmpty(a.releaseId))return "mb:"+a.releaseId;
        if(!TextUtils.isEmpty(a.groupId))return a.groupId;
        return norm(a.title)+"|"+norm(a.artist);
    }
    static String savedKey(Album a){
        if(a==null)return "";
        if(!TextUtils.isEmpty(a.releaseId))return "release:"+a.releaseId;
        if(!TextUtils.isEmpty(a.groupId))return "group:"+a.groupId;
        return "album:"+norm(a.title)+"|"+norm(a.artist);
    }
    static String cover(Album a){
        if(a==null)return "";
        if(!TextUtils.isEmpty(a.coverUrl))return a.coverUrl;
        return TextUtils.isEmpty(a.releaseId)?"":"https://coverartarchive.org/release/"+a.releaseId+"/front-500";
    }

    static String cleanArtist(String s){
        return s==null?"":s.replaceAll("(?i)\\s*-\\s*Topic$","").replaceAll("(?i)\\s+Topic$","")
            .replaceAll("(?i)VEVO$","").replaceAll("(?i)\\s*Official$","").trim();
    }
    static String cleanTitle(String s){
        if(s==null)return "";
        String x=s.replaceAll("(?i)[\\[(](official( music)? video|official audio|lyrics?|lyric video|visuali[sz]er|audio|clip officiel)[\\])]","");
        x=x.replaceAll("(?i)\\s*[-|]\\s*(official( music)? video|official audio|lyrics?|visuali[sz]er|clip officiel).*$","");
        return x.replaceAll("\\s+"," ").trim();
    }
    private static String stripArtistPrefix(String title,String artist){
        if(TextUtils.isEmpty(title)||TextUtils.isEmpty(artist))return title;
        String[] separators=new String[]{" - "," – "," — "," : "};
        for(String sep:separators){
            int p=title.indexOf(sep);
            if(p>0&&p<Math.min(80,title.length())){
                String left=title.substring(0,p).trim();
                if(artistMatch(left,artist))return title.substring(p+sep.length()).trim();
            }
        }
        return title;
    }
    private static String shorterUseful(String a,String b){
        if(TextUtils.isEmpty(a))return b;if(TextUtils.isEmpty(b))return a;
        return a.length()<=b.length()?a:b;
    }
    static String norm(String s){
        if(s==null)return "";
        String n=Normalizer.normalize(s,Normalizer.Form.NFD).replaceAll("\\p{M}+","").toLowerCase(Locale.ROOT);
        n=n.replaceAll("(?i)\\b(feat|ft|featuring)\\.?\\b.*$","");
        return n.replaceAll("[^a-z0-9]+"," ").trim().replaceAll("\\s+"," ");
    }
    static int similarity(String a,String b){
        String x=norm(a),y=norm(b);if(TextUtils.isEmpty(x)||TextUtils.isEmpty(y))return 0;
        if(x.equals(y))return 3;if(x.contains(y)||y.contains(x))return 2;
        Set<String> ax=new HashSet<>(),by=new HashSet<>();
        for(String p:x.split(" "))if(p.length()>1)ax.add(p);for(String p:y.split(" "))if(p.length()>1)by.add(p);
        int c=0;for(String p:ax)if(by.contains(p))c++;
        return c>=Math.max(2,Math.min(ax.size(),by.size())*2/3)?1:0;
    }
    static boolean contains(String h,String n){String a=norm(h),b=norm(n);return !TextUtils.isEmpty(b)&&a.contains(b);}
    private static boolean artistMatch(String a,String b){
        if(TextUtils.isEmpty(b))return true;
        String x=norm(a),y=norm(b);return x.equals(y)||x.contains(y)||y.contains(x);
    }
    private static boolean looksGenericArtist(String a){
        String n=norm(a);return TextUtils.isEmpty(n)||n.equals("youtube")||n.equals("various artists")||n.equals("music");
    }
    private static String credit(JSONArray a){
        if(a==null)return "";StringBuilder b=new StringBuilder();
        for(int i=0;i<a.length();i++){
            JSONObject x=a.optJSONObject(i);if(x==null)continue;String n=x.optString("name","");
            if(TextUtils.isEmpty(n)){JSONObject ar=x.optJSONObject("artist");if(ar!=null)n=ar.optString("name","");}
            if(!TextUtils.isEmpty(n)){if(b.length()>0)b.append(x.optString("joinphrase"," & "));b.append(n);}
        }
        return b.toString();
    }
    private static String appleArt(JSONObject o){
        String u=o==null?"":o.optString("artworkUrl100","");
        return u.replace("100x100bb","600x600bb").replace("100x100-75","600x600-75");
    }
    private static int clamp(int v,int lo,int hi){return Math.max(lo,Math.min(hi,v));}
    private static String lucene(String s){return s.replace("\\","\\\\").replace("\"","\\\"");}
    private static String enc(String s)throws Exception{return URLEncoder.encode(s,"UTF-8");}
    private static String path(String s)throws Exception{return URLEncoder.encode(s,"UTF-8").replace("+","%20");}
}
`;

await writeFile(path.join(pkgDir,'AudifyInstantAlbumMetadata.java'),metadata,'utf8');

// Feed the exact YouTube video id into Album Intelligence 2.0.
const albumsPath=path.join(pkgDir,'AudifyInstantAlbums.java');
let albums=await readFile(albumsPath,'utf8');
const oldIdentify='AudifyInstantAlbumMetadata.identify(s.title,s.artist)';
if(!albums.includes(oldIdentify)&&!albums.includes('AudifyInstantAlbumMetadata.identify(s.title,s.artist,s.id)')){
  throw new Error('V68.14: AudifyInstantAlbums identify call not found');
}
albums=albums.replace(oldIdentify,'AudifyInstantAlbumMetadata.identify(s.title,s.artist,s.id)');
await writeFile(albumsPath,albums,'utf8');

// Stronger YouTube resolver: query with album context and make duration/officialness decisive.
const resolverPath=path.join(pkgDir,'AudifyInstantAlbumResolver.java');
let resolver=await readFile(resolverPath,'utf8');
resolver=resolver.replace('(t.title+" "+t.artist+" official audio").trim()','(t.title+" "+t.artist+" "+album+" official audio").trim()');

function replaceMethod(source,signature,replacement,label){
  const start=source.indexOf(signature);
  if(start<0)throw new Error('V68.14 method not found: '+label);
  const brace=source.indexOf('{',start);if(brace<0)throw new Error('V68.14 brace not found: '+label);
  let depth=0,end=-1;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'){
      depth--;if(depth===0){end=i+1;break;}
    }
  }
  if(end<0)throw new Error('V68.14 method end not found: '+label);
  return source.slice(0,start)+replacement+source.slice(end);
}

resolver=replaceMethod(resolver,'    private static int score(AudifyInstantAlbumMetadata.Track t,Object r)',String.raw`    private static int score(AudifyInstantAlbumMetadata.Track t,Object r){
        String rt=field(r,"title"),ra=field(r,"artist");
        long dur=number(r,"durationSeconds")*1000L;
        int s=AudifyInstantAlbumMetadata.similarity(t.title,rt)*62;
        if(!TextUtils.isEmpty(t.artist)&&(AudifyInstantAlbumMetadata.contains(ra,t.artist)||AudifyInstantAlbumMetadata.contains(rt,t.artist)))s+=42;
        else if(!TextUtils.isEmpty(t.artist))s-=20;
        String low=(rt+" "+ra).toLowerCase(Locale.ROOT);
        if(low.contains("topic"))s+=26;
        if(low.contains("official audio"))s+=20;
        if(low.contains("official video"))s+=8;
        if((low.contains("live")||low.contains("remix")||low.contains("sped up")||low.contains("slowed")||low.contains("nightcore")||low.contains("8d audio"))
            &&!AudifyInstantAlbumMetadata.norm(t.title).contains("live")&&!AudifyInstantAlbumMetadata.norm(t.title).contains("remix"))s-=42;
        if(t.lengthMs>0&&dur>0){
            long d=Math.abs(t.lengthMs-dur);
            if(d<=2500)s+=38;else if(d<=6000)s+=31;else if(d<=12000)s+=23;else if(d<=22000)s+=12;else if(d>75000)s-=50;else if(d>45000)s-=30;
        }
        return s;
    }`,'resolver score');
await writeFile(resolverPath,resolver,'utf8');

console.log('Audify V68.14: Album Intelligence 2.0 installed — YouTube evidence + duration + MB URL + MB/Apple consensus; synthetic album fallback removed.');
