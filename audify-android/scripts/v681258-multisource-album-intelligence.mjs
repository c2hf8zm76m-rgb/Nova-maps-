import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');

// V68.12.58 — Multi-Source Album Intelligence
// MusicBrainz deep browse + Apple/iTunes catalog confirmation + Audify synthetic collections.
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
import java.util.Comparator;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

final class AudifyInstantAlbumMetadata {
    static final String PREFS="audify_instant_albums_v681258";
    private static final long CACHE=30L*24L*60L*60L*1000L;
    private static final long MB_GAP=1100L;
    private static long lastMb;

    static final class Track {
        int position,disc; String title="",artist=""; long lengthMs=-1L;
        JSONObject json() throws Exception {JSONObject o=new JSONObject();o.put("p",position);o.put("d",disc);o.put("t",title);o.put("a",artist);o.put("l",lengthMs);return o;}
        static Track from(JSONObject o){if(o==null)return null;Track t=new Track();t.position=o.optInt("p");t.disc=o.optInt("d",1);t.title=o.optString("t","");t.artist=o.optString("a","");t.lengthMs=o.optLong("l",-1L);return t;}
    }

    static final class Album {
        String releaseId="",groupId="",title="",artist="",date="",type="Album",coverUrl="",source="";
        int current=-1,confidence=0;
        final ArrayList<Track> tracks=new ArrayList<>();
        JSONObject json() throws Exception {JSONObject o=new JSONObject();o.put("release",releaseId);o.put("group",groupId);o.put("title",title);o.put("artist",artist);o.put("date",date);o.put("type",type);o.put("cover",coverUrl);o.put("source",source);o.put("confidence",confidence);o.put("current",current);JSONArray a=new JSONArray();for(Track t:tracks)a.put(t.json());o.put("tracks",a);return o;}
        static Album from(JSONObject o){if(o==null)return null;Album a=new Album();a.releaseId=o.optString("release","");a.groupId=o.optString("group","");a.title=o.optString("title","");a.artist=o.optString("artist","");a.date=o.optString("date","");a.type=o.optString("type","Album");a.coverUrl=o.optString("cover","");a.source=o.optString("source","");a.confidence=o.optInt("confidence",0);a.current=o.optInt("current",-1);JSONArray x=o.optJSONArray("tracks");if(x!=null)for(int i=0;i<x.length();i++){Track t=Track.from(x.optJSONObject(i));if(t!=null&&!TextUtils.isEmpty(t.title))a.tracks.add(t);}return a;}
    }

    private static final class Resolution {Album album;int score;Resolution(Album a,int s){album=a;score=s;}}
    private static final class Rec {String id="";int score;Rec(String i,int s){id=i;score=s;}}

    static Album cached(Context c,String key){try{SharedPreferences p=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);String r=p.getString("a_"+Integer.toHexString(key.hashCode()),null);if(TextUtils.isEmpty(r))return null;JSONObject o=new JSONObject(r);if(System.currentTimeMillis()-o.optLong("saved",0)>CACHE)return null;Album a=Album.from(o.optJSONObject("album"));return a!=null&&a.tracks.size()>1?a:null;}catch(Throwable e){return null;}}
    static void cache(Context c,String key,Album a){try{JSONObject o=new JSONObject();o.put("saved",System.currentTimeMillis());o.put("album",a.json());c.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString("a_"+Integer.toHexString(key.hashCode()),o.toString()).apply();}catch(Throwable ignored){}}

    static Album identify(String rawTitle,String rawArtist)throws Exception{
        String title=cleanTitle(rawTitle),artist=cleanArtist(rawArtist);
        if(TextUtils.isEmpty(title))return null;
        Resolution mb=null,apple=null;
        try{mb=musicBrainzDeep(title,artist);}catch(Throwable ignored){}
        try{apple=appleAlbum(title,artist,"FR");if(apple==null)apple=appleAlbum(title,artist,"US");}catch(Throwable ignored){}
        Album chosen=choose(mb,apple);
        if(chosen!=null&&chosen.tracks.size()>1)return chosen;
        try{return syntheticCollection(title,artist);}catch(Throwable ignored){return null;}
    }

    private static Album choose(Resolution mb,Resolution apple){
        if(mb==null)return apple==null?null:apple.album;
        if(apple==null)return mb.album;
        Album ma=mb.album,aa=apple.album;
        boolean same=similarity(ma.title,aa.title)>=2&&artistMatch(ma.artist,aa.artist);
        if(same){
            if(TextUtils.isEmpty(ma.coverUrl))ma.coverUrl=aa.coverUrl;
            ma.source="MusicBrainz + Apple/iTunes";
            ma.confidence=Math.min(100,Math.max(ma.confidence,aa.confidence)+7);
            return ma;
        }
        return apple.score>mb.score+8?aa:ma;
    }

    private static Resolution musicBrainzDeep(String title,String artist)throws Exception{
        String q="recording:\""+lucene(title)+"\""+(TextUtils.isEmpty(artist)?"":" AND artist:\""+lucene(artist)+"\"");
        JSONObject root=mbGet("https://musicbrainz.org/ws/2/recording/?query="+enc(q)+"&fmt=json&limit=12");
        JSONArray recs=root.optJSONArray("recordings");if(recs==null)return null;
        ArrayList<Rec> ranked=new ArrayList<>();
        for(int i=0;i<recs.length();i++){
            JSONObject r=recs.optJSONObject(i);if(r==null||TextUtils.isEmpty(r.optString("id")))continue;
            String credited=credit(r.optJSONArray("artist-credit"));
            int s=r.optInt("score",0)+similarity(title,r.optString("title",""))*35;
            if(!TextUtils.isEmpty(artist)&&artistMatch(credited,artist))s+=32;
            ranked.add(new Rec(r.optString("id"),s));
        }
        Collections.sort(ranked,(a,b)->Integer.compare(b.score,a.score));
        JSONObject bestRelease=null;int bestScore=Integer.MIN_VALUE;
        int scans=Math.min(2,ranked.size());
        for(int n=0;n<scans;n++){
            Rec rc=ranked.get(n);
            JSONObject browse=mbGet("https://musicbrainz.org/ws/2/release?recording="+path(rc.id)+"&inc=release-groups+artist-credits+recordings&fmt=json&limit=100");
            JSONArray releases=browse.optJSONArray("releases");if(releases==null)continue;
            for(int i=0;i<releases.length();i++){
                JSONObject rel=releases.optJSONObject(i);if(rel==null||TextUtils.isEmpty(rel.optString("id")))continue;
                int s=rc.score+releaseScore(rel,title,artist);
                if(s>bestScore){bestScore=s;bestRelease=rel;}
            }
            if(bestRelease!=null&&bestScore>=205)break;
        }
        if(bestRelease==null||bestScore<130)return null;
        JSONObject full=bestRelease;
        if(full.optJSONArray("media")==null){full=mbGet("https://musicbrainz.org/ws/2/release/"+path(bestRelease.optString("id"))+"?inc=recordings+artist-credits+release-groups&fmt=json");}
        Album a=parseMb(full,title,artist);
        if(a==null)return null;
        a.source="MusicBrainz Deep";a.confidence=clamp((bestScore-105)/2,62,99);
        return new Resolution(a,bestScore);
    }

    private static int releaseScore(JSONObject rel,String song,String artist){
        int s=0;
        if("Official".equalsIgnoreCase(rel.optString("status","")))s+=30;
        JSONObject rg=rel.optJSONObject("release-group");
        String type=rg==null?"":rg.optString("primary-type","");
        if("Album".equalsIgnoreCase(type))s+=82;else if("EP".equalsIgnoreCase(type))s+=34;else if("Single".equalsIgnoreCase(type))s-=48;
        JSONArray sec=rg==null?null:rg.optJSONArray("secondary-types");
        if(sec!=null)for(int i=0;i<sec.length();i++){String v=sec.optString(i,"").toLowerCase(Locale.ROOT);if(v.contains("compilation"))s-=38;if(v.contains("live"))s-=24;if(v.contains("remix"))s-=24;}
        int n=trackCount(rel);if(n>=6&&n<=30)s+=28;else if(n>=4&&n<=40)s+=16;else if(n>0&&n<=2)s-=32;
        String rt=rel.optString("title","");if(!norm(rt).equals(norm(song)))s+=10;
        if(!TextUtils.isEmpty(artist)&&artistMatch(credit(rel.optJSONArray("artist-credit")),artist))s+=16;
        String low=rt.toLowerCase(Locale.ROOT);if(low.contains("deluxe")||low.contains("expanded")||low.contains("anniversary"))s-=6;
        return s;
    }

    private static int trackCount(JSONObject rel){int n=rel.optInt("track-count",0);if(n>0)return n;JSONArray media=rel.optJSONArray("media");if(media==null)return 0;int c=0;for(int i=0;i<media.length();i++){JSONObject m=media.optJSONObject(i);if(m==null)continue;JSONArray t=m.optJSONArray("tracks");if(t!=null)c+=t.length();else c+=m.optInt("track-count",0);}return c;}

    private static Album parseMb(JSONObject r,String currentTitle,String currentArtist){
        if(r==null)return null;Album a=new Album();a.releaseId=r.optString("id","");a.title=r.optString("title","Album");a.artist=credit(r.optJSONArray("artist-credit"));if(TextUtils.isEmpty(a.artist))a.artist=currentArtist;a.date=r.optString("date","");JSONObject rg=r.optJSONObject("release-group");a.groupId=rg==null?"":rg.optString("id","");a.type=rg==null?"Album":rg.optString("primary-type","Album");
        JSONArray media=r.optJSONArray("media");if(media==null)return null;int pos=0;
        for(int m=0;m<media.length();m++){JSONObject med=media.optJSONObject(m);JSONArray tr=med==null?null:med.optJSONArray("tracks");if(tr==null)continue;for(int i=0;i<tr.length();i++){JSONObject o=tr.optJSONObject(i);if(o==null)continue;Track t=new Track();t.position=++pos;t.disc=m+1;t.title=o.optString("title","");t.lengthMs=o.optLong("length",-1L);t.artist=credit(o.optJSONArray("artist-credit"));if(TextUtils.isEmpty(t.artist)){JSONObject rec=o.optJSONObject("recording");if(rec!=null)t.artist=credit(rec.optJSONArray("artist-credit"));}if(TextUtils.isEmpty(t.artist))t.artist=a.artist;if(!TextUtils.isEmpty(t.title))a.tracks.add(t);}}
        locateCurrent(a,currentTitle);return a.tracks.size()>1?a:null;
    }

    private static Resolution appleAlbum(String title,String artist,String country)throws Exception{
        JSONArray rows=appleSearch(title+" "+artist,country,50);if(rows==null)return null;
        JSONObject best=null;int bestScore=Integer.MIN_VALUE;
        for(int i=0;i<rows.length();i++){
            JSONObject x=rows.optJSONObject(i);if(x==null||!"song".equalsIgnoreCase(x.optString("kind","")))continue;
            String tn=x.optString("trackName",""),an=x.optString("artistName",""),cn=x.optString("collectionName","");
            if(TextUtils.isEmpty(cn)||x.optLong("collectionId",0L)<=0)continue;
            int sim=similarity(title,tn);if(sim==0)continue;
            int s=sim*45;
            if(artistMatch(an,artist))s+=50;else if(!TextUtils.isEmpty(artist))s-=28;
            int count=x.optInt("trackCount",0);if(count>=6&&count<=35)s+=38;else if(count>=4)s+=24;else if(count<=2)s-=48;
            if(!norm(cn).equals(norm(tn)))s+=13;
            String low=cn.toLowerCase(Locale.ROOT);if(low.contains("single"))s-=18;if(low.contains("compilation")||low.contains("greatest hits"))s-=20;
            if(s>bestScore){bestScore=s;best=x;}
        }
        if(best==null||bestScore<125)return null;
        long collectionId=best.optLong("collectionId",0L);
        JSONObject lookup=httpGet("https://itunes.apple.com/lookup?id="+collectionId+"&entity=song&country="+country+"&limit=200",false);
        Album a=parseAppleAlbum(lookup,collectionId,title,artist,best);if(a==null)return null;
        a.source="Apple/iTunes";a.confidence=clamp((bestScore-75)/2,65,98);
        return new Resolution(a,bestScore);
    }

    private static Album parseAppleAlbum(JSONObject root,long collectionId,String currentTitle,String currentArtist,JSONObject seed){
        JSONArray rs=root==null?null:root.optJSONArray("results");if(rs==null)return null;
        Album a=new Album();a.groupId="itunes:"+collectionId;a.title=seed.optString("collectionName","Album");a.artist=seed.optString("collectionArtistName",seed.optString("artistName",currentArtist));a.date=seed.optString("releaseDate","");a.type="Album";a.coverUrl=art(seed);
        ArrayList<JSONObject> songs=new ArrayList<>();
        for(int i=0;i<rs.length();i++){JSONObject x=rs.optJSONObject(i);if(x==null||!"song".equalsIgnoreCase(x.optString("kind","")))continue;if(x.optLong("collectionId",0L)!=collectionId)continue;songs.add(x);}
        Collections.sort(songs,(x,y)->{int d=Integer.compare(x.optInt("discNumber",1),y.optInt("discNumber",1));return d!=0?d:Integer.compare(x.optInt("trackNumber",999),y.optInt("trackNumber",999));});
        int pos=0;for(JSONObject x:songs){Track t=new Track();t.position=++pos;t.disc=x.optInt("discNumber",1);t.title=x.optString("trackName","");t.artist=x.optString("artistName",a.artist);t.lengthMs=x.optLong("trackTimeMillis",-1L);if(!TextUtils.isEmpty(t.title))a.tracks.add(t);if(TextUtils.isEmpty(a.coverUrl))a.coverUrl=art(x);}
        locateCurrent(a,currentTitle);return a.tracks.size()>1?a:null;
    }

    private static Album syntheticCollection(String title,String artist)throws Exception{
        if(TextUtils.isEmpty(artist))return null;
        JSONArray rows=appleSearch(artist,"FR",50);if(rows==null||rows.length()==0)rows=appleSearch(artist,"US",50);if(rows==null)return null;
        ArrayList<JSONObject> candidates=new ArrayList<>();Set<String> seen=new HashSet<>();JSONObject seed=null;
        for(int i=0;i<rows.length();i++){
            JSONObject x=rows.optJSONObject(i);if(x==null||!"song".equalsIgnoreCase(x.optString("kind","")))continue;
            if(!artistMatch(x.optString("artistName",""),artist))continue;
            String tn=x.optString("trackName","");String nk=norm(tn);if(TextUtils.isEmpty(nk)||!seen.add(nk))continue;
            if(similarity(title,tn)>=2)seed=x;
            candidates.add(x);
        }
        if(candidates.isEmpty())return null;
        final String anchor=seed==null?"":seed.optString("releaseDate","");
        Collections.sort(candidates,(x,y)->{int sx=syntheticScore(x,title,anchor),sy=syntheticScore(y,title,anchor);return Integer.compare(sy,sx);});
        Album a=new Album();a.title="Autour de « "+title+" »";a.artist=artist;a.type="Collection Audify";a.source="Audify + Apple/iTunes";a.confidence=72;a.groupId="audify:"+norm(artist)+"|"+norm(title);a.coverUrl=seed==null?art(candidates.get(0)):art(seed);a.date=seed==null?"":seed.optString("releaseDate","");
        Track current=new Track();current.position=1;current.disc=1;current.title=title;current.artist=artist;current.lengthMs=seed==null?-1L:seed.optLong("trackTimeMillis",-1L);a.tracks.add(current);a.current=0;
        Set<String> used=new HashSet<>();used.add(norm(title));int pos=1;
        for(JSONObject x:candidates){if(a.tracks.size()>=12)break;String tn=x.optString("trackName","");String nk=norm(tn);if(TextUtils.isEmpty(nk)||!used.add(nk))continue;Track t=new Track();t.position=++pos;t.disc=1;t.title=tn;t.artist=x.optString("artistName",artist);t.lengthMs=x.optLong("trackTimeMillis",-1L);a.tracks.add(t);}
        return a.tracks.size()>1?a:null;
    }

    private static int syntheticScore(JSONObject x,String current,String anchor){int s=similarity(current,x.optString("trackName",""))*55;String d=x.optString("releaseDate","");if(!TextUtils.isEmpty(anchor)&&anchor.length()>=4&&d.length()>=4){try{int a=Integer.parseInt(anchor.substring(0,4)),b=Integer.parseInt(d.substring(0,4));s+=Math.max(0,24-Math.abs(a-b)*5);}catch(Throwable ignored){}}if(x.optInt("trackCount",0)>2)s+=8;return s;}

    private static JSONArray appleSearch(String term,String country,int limit)throws Exception{JSONObject o=httpGet("https://itunes.apple.com/search?term="+enc(term)+"&media=music&entity=song&country="+country+"&limit="+limit,false);return o.optJSONArray("results");}
    private static String art(JSONObject x){String u=x==null?"":x.optString("artworkUrl100","");if(TextUtils.isEmpty(u))u=x==null?"":x.optString("artworkUrl60","");if(TextUtils.isEmpty(u))return "";u=u.replace("http://","https://");return u.replace("100x100bb","600x600bb").replace("100x100-75","600x600-75");}
    private static void locateCurrent(Album a,String title){a.current=-1;for(int i=0;i<a.tracks.size();i++)if(similarity(title,a.tracks.get(i).title)>=2){a.current=i;break;}}

    private static JSONObject mbGet(String url)throws Exception{return httpGet(url,true);}
    private static JSONObject httpGet(String url,boolean musicBrainz)throws Exception{
        if(musicBrainz)throttleMb();HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(7000);c.setReadTimeout(10000);c.setInstanceFollowRedirects(true);c.setRequestProperty("Accept","application/json");c.setRequestProperty("User-Agent","Audify/68.12.58 (https://github.com/c2hf8zm76m-rgb/Nova-maps-)");
        try{int code=c.getResponseCode();InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();if(in==null)throw new IllegalStateException("HTTP "+code);BufferedReader br=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();String line;while((line=br.readLine())!=null)b.append(line);br.close();if(code<200||code>=300)throw new IllegalStateException("HTTP "+code);return new JSONObject(b.toString());}finally{c.disconnect();}
    }
    private static synchronized void throttleMb()throws InterruptedException{long now=android.os.SystemClock.elapsedRealtime(),wait=MB_GAP-(now-lastMb);if(wait>0)Thread.sleep(wait);lastMb=android.os.SystemClock.elapsedRealtime();}

    static String key(Album a){if(a==null)return "";if(!TextUtils.isEmpty(a.releaseId))return "mb:"+a.releaseId;if(!TextUtils.isEmpty(a.groupId))return a.groupId;return norm(a.title)+"|"+norm(a.artist);}
    static String savedKey(Album a){if(a==null)return "";if(!TextUtils.isEmpty(a.releaseId))return "release:"+a.releaseId;if(!TextUtils.isEmpty(a.groupId))return "group:"+a.groupId;return "album:"+norm(a.title)+"|"+norm(a.artist);}
    static String cover(Album a){if(a==null)return "";if(!TextUtils.isEmpty(a.coverUrl))return a.coverUrl;return TextUtils.isEmpty(a.releaseId)?"":"https://coverartarchive.org/release/"+a.releaseId+"/front-500";}
    static String cleanArtist(String s){return s==null?"":s.replaceAll("(?i)\\s*-\\s*Topic$","").replaceAll("(?i)VEVO$","").replaceAll("(?i)\\s*Official$","").trim();}
    static String cleanTitle(String s){if(s==null)return "";String x=s.replaceAll("(?i)[\\[(](official( music)? video|official audio|lyrics?|lyric video|visuali[sz]er|audio)[\\])]","");x=x.replaceAll("(?i)\\s*[-|]\\s*(official( music)? video|official audio|lyrics?|visuali[sz]er).*$","");return x.replaceAll("\\s+"," ").trim();}
    static String norm(String s){if(s==null)return "";String n=Normalizer.normalize(s,Normalizer.Form.NFD).replaceAll("\\p{M}+","").toLowerCase(Locale.ROOT);n=n.replaceAll("(?i)\\b(feat|ft|featuring)\\.?\\b.*$","");return n.replaceAll("[^a-z0-9]+"," ").trim().replaceAll("\\s+"," ");}
    static int similarity(String a,String b){String x=norm(a),y=norm(b);if(TextUtils.isEmpty(x)||TextUtils.isEmpty(y))return 0;if(x.equals(y))return 3;if(x.contains(y)||y.contains(x))return 2;Set<String> ax=new HashSet<>(),by=new HashSet<>();for(String p:x.split(" "))if(p.length()>1)ax.add(p);for(String p:y.split(" "))if(p.length()>1)by.add(p);int c=0;for(String p:ax)if(by.contains(p))c++;return c>=Math.max(2,Math.min(ax.size(),by.size())*2/3)?1:0;}
    static boolean contains(String h,String n){String a=norm(h),b=norm(n);return !TextUtils.isEmpty(b)&&a.contains(b);}
    private static boolean artistMatch(String a,String b){if(TextUtils.isEmpty(b))return true;String x=norm(a),y=norm(b);return x.equals(y)||x.contains(y)||y.contains(x);}
    private static String credit(JSONArray a){if(a==null)return "";StringBuilder b=new StringBuilder();for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x==null)continue;String n=x.optString("name","");if(TextUtils.isEmpty(n)){JSONObject ar=x.optJSONObject("artist");if(ar!=null)n=ar.optString("name","");}if(!TextUtils.isEmpty(n)){if(b.length()>0)b.append(x.optString("joinphrase"," & "));b.append(n);}}return b.toString();}
    private static String lucene(String s){return s.replace("\\","\\\\").replace("\"","\\\"");}
    private static String enc(String s)throws Exception{return URLEncoder.encode(s,"UTF-8");}
    private static String path(String s)throws Exception{return URLEncoder.encode(s,"UTF-8").replace("+","%20");}
    private static int clamp(int v,int lo,int hi){return Math.max(lo,Math.min(hi,v));}
}
`;

await writeFile(path.join(pkgDir,'AudifyInstantAlbumMetadata.java'),metadata,'utf8');

// Make the real native page disclose synthetic Audify collections instead of pretending they are official albums.
const albumsPath=path.join(pkgDir,'AudifyInstantAlbums.java');
let albums=await readFile(albumsPath,'utf8');
albums=albums.replace('private static final String TAG="AUDIFY_INSTANT_ALBUMS_V681256";','private static final String TAG="AUDIFY_INSTANT_ALBUMS_V681258";');
albums=albums.replace('TextView badge=text(a,"ALBUM",10.5f,Color.rgb(202,255,148),true);','TextView badge=text(a,"Collection Audify".equalsIgnoreCase(album.type)?"COLLECTION AUDIFY":"ALBUM",10.5f,Color.rgb(202,255,148),true);');
albums=albums.replace('else if(manual)Toast.makeText(x,"Aucun album fiable trouvé pour ce morceau.",Toast.LENGTH_SHORT).show();','else if(manual)Toast.makeText(x,"Audify n’a pas encore assez de données pour construire une collection fiable.",Toast.LENGTH_SHORT).show();');
await writeFile(albumsPath,albums,'utf8');

console.log('Audify V68.12.58 multi-source album intelligence applied');
