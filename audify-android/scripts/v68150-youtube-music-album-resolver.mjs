import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const metadataPath=path.join(pkgDir,'AudifyInstantAlbumMetadata.java');

// Audify V68.15 — YouTube Music Primary Album Resolver.
// No persistent album identity cache: every resolution is performed on demand.
// YouTube Music's direct song -> album (MPRE browse id) relation is the primary proof.
// MusicBrainz + Apple/iTunes remain the fallback through Album Intelligence 2.0.
const resolver=String.raw`package com.nova.audify;

import android.text.TextUtils;
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
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * V68.15 — resolves a public YouTube/YouTube Music song to the album relation that
 * YouTube Music itself exposes. No album result is persisted by this class.
 */
final class AudifyYoutubeMusicAlbumResolver {
    static final String MARKER="AUDIFY_V6815_YTMUSIC_PRIMARY_RESOLVER";
    static final String DIRECT_MARKER="YTMUSIC_DIRECT_ALBUM_RELATION";
    static final String NO_CACHE_MARKER="AUDIFY_V6815_NO_PERSISTENT_ALBUM_CACHE";

    private static final String DOMAIN="https://music.youtube.com";
    private static final String FALLBACK_KEY="AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
    private static final Object CONFIG_LOCK=new Object();
    private static volatile String apiKey="",clientVersion="",visitorData="";
    private static volatile long configAt;

    private static final class Candidate {
        String videoId="",title="",artist="",albumId="",albumName="",videoType="";
        long durationMs=-1L;
        int score;
    }
    private static final class TrackRow {
        String videoId="",title="",artist="";
        long durationMs=-1L;
    }

    private AudifyYoutubeMusicAlbumResolver(){}

    static AudifyInstantAlbumMetadata.Album identify(String rawTitle,String rawArtist,String sourceVideoId,long sourceDurationMs,String albumHint)throws Exception{
        String title=clean(rawTitle),artist=clean(rawArtist);
        if(TextUtils.isEmpty(title))return null;

        ArrayList<Candidate> candidates=searchCandidates((title+" "+artist).trim(),title,artist,sourceVideoId,sourceDurationMs,albumHint);
        if(candidates.isEmpty()&&!TextUtils.isEmpty(artist))
            candidates=searchCandidates(title,title,artist,sourceVideoId,sourceDurationMs,albumHint);
        if(candidates.isEmpty())return null;

        Collections.sort(candidates,(a,b)->Integer.compare(b.score,a.score));
        AudifyInstantAlbumMetadata.Album best=null;
        int bestTotal=Integer.MIN_VALUE;
        int scans=Math.min(7,candidates.size());
        for(int i=0;i<scans;i++){
            Candidate c=candidates.get(i);
            if(TextUtils.isEmpty(c.albumId)||c.score<165)continue;
            AudifyInstantAlbumMetadata.Album album;
            try{album=loadAlbum(c,title,artist,sourceVideoId,sourceDurationMs);}catch(Throwable ignored){continue;}
            if(album==null||album.tracks.size()<3)continue;

            int quality=album.tracks.size()>=6?36:album.tracks.size()>=4?22:10;
            String low=(c.albumName+" "+album.title).toLowerCase(Locale.ROOT);
            if(low.contains("single"))quality-=45;
            if(low.contains("greatest hits")||low.contains("compilation"))quality-=28;
            if(low.contains("deluxe")||low.contains("expanded")||low.contains("anniversary"))quality-=5;
            int total=c.score+quality;
            if(total>bestTotal){bestTotal=total;best=album;}
        }
        return best;
    }

    private static ArrayList<Candidate> searchCandidates(String query,String wantedTitle,String wantedArtist,String sourceVideoId,long sourceDurationMs,String hint)throws Exception{
        JSONObject body=new JSONObject();
        body.put("context",context());
        body.put("query",query);
        JSONObject root=post("search",body);
        ArrayList<JSONObject> rows=new ArrayList<>();
        collectResponsiveRows(root,rows);
        ArrayList<Candidate> out=new ArrayList<>();
        Set<String> seen=new HashSet<>();
        for(JSONObject r:rows){
            Candidate c=parseCandidate(r);
            if(c==null||TextUtils.isEmpty(c.albumId)||TextUtils.isEmpty(c.title))continue;
            String dk=c.videoId+"|"+c.albumId+"|"+AudifyInstantAlbumMetadata.norm(c.title);
            if(!seen.add(dk))continue;
            c.score=score(c,wantedTitle,wantedArtist,sourceVideoId,sourceDurationMs,hint);
            if(c.score>=120)out.add(c);
        }
        return out;
    }

    private static Candidate parseCandidate(JSONObject r){
        try{
            Candidate c=new Candidate();
            c.title=columnText(r,0);
            c.videoId=findVideoId(r);
            c.durationMs=findClockMs(r);
            c.videoType=findStringByKey(r,"musicVideoType");
            String[] album=findAlbum(r);
            c.albumName=album[0];c.albumId=album[1];
            c.artist=findArtist(r,c.albumName);
            if(TextUtils.isEmpty(c.title)||TextUtils.isEmpty(c.albumId))return null;
            return c;
        }catch(Throwable e){return null;}
    }

    private static int score(Candidate c,String wantedTitle,String wantedArtist,String sourceVideoId,long sourceDurationMs,String hint){
        int s=0;
        if(!TextUtils.isEmpty(sourceVideoId)&&sourceVideoId.equals(c.videoId))s+=210;
        int ts=AudifyInstantAlbumMetadata.similarity(wantedTitle,c.title);
        if(ts==3)s+=110;else if(ts==2)s+=72;else if(ts==1)s+=28;else s-=90;
        s+=artistScore(wantedArtist,c.artist);
        s+=durationScore(sourceDurationMs,c.durationMs);
        if(!TextUtils.isEmpty(c.albumId)&&c.albumId.startsWith("MPRE"))s+=78;
        String vt=c.videoType==null?"":c.videoType;
        if(vt.contains("ATV"))s+=34;
        else if(vt.contains("OMV"))s+=22;
        else if(vt.contains("UGC"))s-=22;
        if(!TextUtils.isEmpty(hint)){
            int hs=AudifyInstantAlbumMetadata.similarity(hint,c.albumName);
            if(hs>=2)s+=32;else if(hs==1)s+=12;
        }
        String low=(c.title+" "+c.albumName).toLowerCase(Locale.ROOT);
        String wanted=(wantedTitle==null?"":wantedTitle).toLowerCase(Locale.ROOT);
        for(String bad:new String[]{" live"," remix","sped up","slowed","nightcore","karaoke"})
            if(low.contains(bad)&&!wanted.contains(bad.trim()))s-=55;
        if(AudifyInstantAlbumMetadata.similarity(c.albumName,c.title)>=3)s-=22;
        if(low.contains(" single"))s-=34;
        return s;
    }

    private static AudifyInstantAlbumMetadata.Album loadAlbum(Candidate c,String wantedTitle,String wantedArtist,String sourceVideoId,long sourceDurationMs)throws Exception{
        JSONObject body=new JSONObject();body.put("context",context());body.put("browseId",c.albumId);
        JSONObject root=post("browse",body);
        ArrayList<JSONObject> shelves=new ArrayList<>();collectShelves(root,shelves);
        ArrayList<TrackRow> bestRows=new ArrayList<>();
        for(JSONObject shelf:shelves){
            ArrayList<TrackRow> rows=parseShelf(shelf);
            if(rows.size()>bestRows.size())bestRows=rows;
        }
        if(bestRows.size()<3)return null;

        int current=-1,bestMatch=-1,bestMatchScore=Integer.MIN_VALUE;
        for(int i=0;i<bestRows.size();i++){
            TrackRow t=bestRows.get(i);
            int m=0;
            if(!TextUtils.isEmpty(c.videoId)&&c.videoId.equals(t.videoId))m+=120;
            if(!TextUtils.isEmpty(sourceVideoId)&&sourceVideoId.equals(t.videoId))m+=130;
            int sim=AudifyInstantAlbumMetadata.similarity(wantedTitle,t.title);
            if(sim==3)m+=70;else if(sim==2)m+=45;else if(sim==1)m+=15;
            m+=Math.max(0,artistScore(wantedArtist,t.artist)/2);
            m+=Math.max(0,durationScore(sourceDurationMs,t.durationMs)/2);
            if(m>bestMatchScore){bestMatchScore=m;bestMatch=i;}
        }
        // A structural album relation is accepted only when its tracklist confirms the song.
        if(bestMatch<0||bestMatchScore<58)return null;
        current=bestMatch;

        AudifyInstantAlbumMetadata.Album a=new AudifyInstantAlbumMetadata.Album();
        a.releaseId="";
        a.groupId="ytm:"+c.albumId;
        a.title=TextUtils.isEmpty(c.albumName)?"Album":c.albumName;
        a.artist=TextUtils.isEmpty(c.artist)?wantedArtist:c.artist;
        a.type="Album";
        a.coverUrl=findLargestThumbnail(root);
        a.current=current;
        for(int i=0;i<bestRows.size();i++){
            TrackRow row=bestRows.get(i);
            AudifyInstantAlbumMetadata.Track t=new AudifyInstantAlbumMetadata.Track();
            t.position=i+1;t.disc=1;t.title=row.title;
            t.artist=TextUtils.isEmpty(row.artist)?a.artist:row.artist;
            t.lengthMs=row.durationMs;
            a.tracks.add(t);
        }
        boolean exact=!TextUtils.isEmpty(sourceVideoId)&&sourceVideoId.equals(c.videoId);
        if(exact){a.confidence=99;a.source="YouTube Music Direct Relation";}
        else if(c.score>=275){a.confidence=97;a.source="YouTube Music Canonical Song";}
        else if(c.score>=235){a.confidence=94;a.source="YouTube Music Canonical Song";}
        else if(c.score>=195){a.confidence=91;a.source="YouTube Music Canonical Song";}
        else {a.confidence=87;a.source="YouTube Music Album Relation";}
        return a;
    }

    private static ArrayList<TrackRow> parseShelf(JSONObject shelf){
        ArrayList<TrackRow> out=new ArrayList<>();
        JSONArray contents=shelf.optJSONArray("contents");if(contents==null)return out;
        Set<String> seen=new HashSet<>();
        for(int i=0;i<contents.length();i++){
            JSONObject wrap=contents.optJSONObject(i);if(wrap==null)continue;
            JSONObject r=wrap.optJSONObject("musicResponsiveListItemRenderer");if(r==null)continue;
            String title=columnText(r,0);if(TextUtils.isEmpty(title))continue;
            String id=findVideoId(r);
            String key=!TextUtils.isEmpty(id)?id:AudifyInstantAlbumMetadata.norm(title)+"|"+i;
            if(!seen.add(key))continue;
            TrackRow t=new TrackRow();t.title=title;t.videoId=id;t.artist=findArtist(r,"");t.durationMs=findClockMs(r);
            out.add(t);
        }
        return out;
    }

    private static String columnText(JSONObject renderer,int index){
        JSONArray flex=renderer.optJSONArray("flexColumns");if(flex==null||index<0||index>=flex.length())return "";
        JSONObject col=flex.optJSONObject(index);if(col==null)return "";
        JSONObject x=col.optJSONObject("musicResponsiveListItemFlexColumnRenderer");
        return x==null?"":text(x.optJSONObject("text"));
    }

    private static String findArtist(JSONObject renderer,String albumName){
        JSONArray flex=renderer.optJSONArray("flexColumns");
        if(flex!=null&&flex.length()>1){
            JSONObject col=flex.optJSONObject(1);
            JSONObject x=col==null?null:col.optJSONObject("musicResponsiveListItemFlexColumnRenderer");
            JSONObject text=x==null?null:x.optJSONObject("text");
            JSONArray runs=text==null?null:text.optJSONArray("runs");
            if(runs!=null){
                for(int i=0;i<runs.length();i++){
                    JSONObject run=runs.optJSONObject(i);if(run==null)continue;
                    String label=run.optString("text","").trim();if(TextUtils.isEmpty(label)||label.equals("•")||label.equals("·"))continue;
                    String bid=browseId(run);
                    if(!TextUtils.isEmpty(bid)&&!bid.startsWith("MPRE")&&!bid.startsWith("VL")&&!label.equalsIgnoreCase(albumName))return label;
                }
            }
        }
        return "";
    }

    private static String[] findAlbum(Object node){
        String[] out=new String[]{"",""};findAlbumRec(node,out);return out;
    }
    private static boolean findAlbumRec(Object node,String[] out){
        if(node instanceof JSONObject){
            JSONObject o=(JSONObject)node;
            String bid=browseId(o);
            if(!TextUtils.isEmpty(bid)&&bid.startsWith("MPRE")){
                out[0]=o.optString("text","");out[1]=bid;return true;
            }
            JSONArray names=o.names();if(names!=null)for(int i=0;i<names.length();i++){
                Object v=o.opt(names.optString(i));if((v instanceof JSONObject||v instanceof JSONArray)&&findAlbumRec(v,out))return true;
            }
        }else if(node instanceof JSONArray){
            JSONArray a=(JSONArray)node;for(int i=0;i<a.length();i++)if(findAlbumRec(a.opt(i),out))return true;
        }
        return false;
    }

    private static String browseId(JSONObject run){
        try{
            JSONObject nav=run.optJSONObject("navigationEndpoint");
            JSONObject b=nav==null?null:nav.optJSONObject("browseEndpoint");
            return b==null?"":b.optString("browseId","");
        }catch(Throwable e){return "";}
    }

    private static String findVideoId(Object node){
        if(node instanceof JSONObject){
            JSONObject o=(JSONObject)node;
            JSONObject nav=o.optJSONObject("navigationEndpoint");
            JSONObject w=nav==null?null:nav.optJSONObject("watchEndpoint");
            String id=w==null?"":w.optString("videoId","");if(!TextUtils.isEmpty(id))return id;
            w=o.optJSONObject("watchEndpoint");id=w==null?"":w.optString("videoId","");if(!TextUtils.isEmpty(id))return id;
            JSONArray names=o.names();if(names!=null)for(int i=0;i<names.length();i++){
                Object v=o.opt(names.optString(i));if(v instanceof JSONObject||v instanceof JSONArray){String x=findVideoId(v);if(!TextUtils.isEmpty(x))return x;}
            }
        }else if(node instanceof JSONArray){JSONArray a=(JSONArray)node;for(int i=0;i<a.length();i++){String x=findVideoId(a.opt(i));if(!TextUtils.isEmpty(x))return x;}}
        return "";
    }

    private static long findClockMs(Object node){
        String c=findClock(node);if(TextUtils.isEmpty(c))return -1L;
        try{
            String[] p=c.split(":");long sec=0;for(String q:p)sec=sec*60+Long.parseLong(q.trim());return sec*1000L;
        }catch(Throwable e){return -1L;}
    }
    private static String findClock(Object node){
        if(node instanceof JSONObject){
            JSONObject o=(JSONObject)node;
            String direct=o.optString("text","");if(isClock(direct))return direct;
            String simple=o.optString("simpleText","");if(isClock(simple))return simple;
            JSONArray names=o.names();if(names!=null)for(int i=0;i<names.length();i++){
                Object v=o.opt(names.optString(i));if(v instanceof JSONObject||v instanceof JSONArray){String x=findClock(v);if(!TextUtils.isEmpty(x))return x;}
            }
        }else if(node instanceof JSONArray){JSONArray a=(JSONArray)node;for(int i=0;i<a.length();i++){String x=findClock(a.opt(i));if(!TextUtils.isEmpty(x))return x;}}
        return "";
    }
    private static boolean isClock(String s){return s!=null&&s.matches("\\d{1,2}:\\d{2}(:\\d{2})?");}

    private static String findStringByKey(Object node,String key){
        if(node instanceof JSONObject){
            JSONObject o=(JSONObject)node;String v=o.optString(key,"");if(!TextUtils.isEmpty(v))return v;
            JSONArray names=o.names();if(names!=null)for(int i=0;i<names.length();i++){
                Object x=o.opt(names.optString(i));if(x instanceof JSONObject||x instanceof JSONArray){String r=findStringByKey(x,key);if(!TextUtils.isEmpty(r))return r;}
            }
        }else if(node instanceof JSONArray){JSONArray a=(JSONArray)node;for(int i=0;i<a.length();i++){String r=findStringByKey(a.opt(i),key);if(!TextUtils.isEmpty(r))return r;}}
        return "";
    }

    private static String text(JSONObject text){
        if(text==null)return "";String s=text.optString("simpleText","");if(!TextUtils.isEmpty(s))return s;
        JSONArray runs=text.optJSONArray("runs");if(runs==null)return "";StringBuilder b=new StringBuilder();
        for(int i=0;i<runs.length();i++){JSONObject r=runs.optJSONObject(i);if(r!=null)b.append(r.optString("text",""));}
        return b.toString().trim();
    }

    private static void collectResponsiveRows(Object node,ArrayList<JSONObject> out){
        if(node==null||out.size()>120)return;
        if(node instanceof JSONObject){
            JSONObject o=(JSONObject)node;
            JSONObject r=o.optJSONObject("musicResponsiveListItemRenderer");if(r!=null)out.add(r);
            JSONArray names=o.names();if(names!=null)for(int i=0;i<names.length();i++){
                String k=names.optString(i);if("musicResponsiveListItemRenderer".equals(k))continue;
                Object v=o.opt(k);if(v instanceof JSONObject||v instanceof JSONArray)collectResponsiveRows(v,out);
            }
        }else if(node instanceof JSONArray){JSONArray a=(JSONArray)node;for(int i=0;i<a.length();i++)collectResponsiveRows(a.opt(i),out);}
    }

    private static void collectShelves(Object node,ArrayList<JSONObject> out){
        if(node==null||out.size()>30)return;
        if(node instanceof JSONObject){
            JSONObject o=(JSONObject)node;
            JSONObject shelf=o.optJSONObject("musicShelfRenderer");if(shelf!=null)out.add(shelf);
            JSONArray names=o.names();if(names!=null)for(int i=0;i<names.length();i++){
                String k=names.optString(i);if("musicShelfRenderer".equals(k))continue;
                Object v=o.opt(k);if(v instanceof JSONObject||v instanceof JSONArray)collectShelves(v,out);
            }
        }else if(node instanceof JSONArray){JSONArray a=(JSONArray)node;for(int i=0;i<a.length();i++)collectShelves(a.opt(i),out);}
    }

    private static String findLargestThumbnail(Object node){
        long[] best=new long[]{-1};String[] url=new String[]{""};findThumbRec(node,best,url);return url[0];
    }
    private static void findThumbRec(Object node,long[] best,String[] url){
        if(node instanceof JSONObject){
            JSONObject o=(JSONObject)node;
            if(o.has("url")){
                String u=o.optString("url","");long w=o.optLong("width",0),h=o.optLong("height",0),area=w*h;
                if(!TextUtils.isEmpty(u)&&area>best[0]&&(u.contains("googleusercontent")||u.contains("ytimg"))){best[0]=area;url[0]=u;}
            }
            JSONArray names=o.names();if(names!=null)for(int i=0;i<names.length();i++){
                Object v=o.opt(names.optString(i));if(v instanceof JSONObject||v instanceof JSONArray)findThumbRec(v,best,url);
            }
        }else if(node instanceof JSONArray){JSONArray a=(JSONArray)node;for(int i=0;i<a.length();i++)findThumbRec(a.opt(i),best,url);}
    }

    private static int artistScore(String wanted,String got){
        if(TextUtils.isEmpty(wanted))return 12;if(TextUtils.isEmpty(got))return 0;
        String a=AudifyInstantAlbumMetadata.norm(wanted),b=AudifyInstantAlbumMetadata.norm(got);
        if(a.equals(b))return 78;if(a.contains(b)||b.contains(a))return 56;
        Set<String> x=new HashSet<>(),y=new HashSet<>();
        for(String q:a.split(" "))if(q.length()>1)x.add(q);for(String q:b.split(" "))if(q.length()>1)y.add(q);
        int n=0;for(String q:x)if(y.contains(q))n++;return n>=1?26:-28;
    }
    private static int durationScore(long a,long b){
        if(a<=0||b<=0)return 0;long d=Math.abs(a-b);
        if(d<=2000)return 52;if(d<=6000)return 38;if(d<=12000)return 23;if(d<=25000)return 7;if(d<=45000)return -12;return -42;
    }
    private static String clean(String s){return s==null?"":s.trim();}

    private static JSONObject context()throws Exception{
        ensureConfig();
        JSONObject client=new JSONObject();client.put("clientName","WEB_REMIX");client.put("clientVersion",clientVersion);client.put("hl","fr");client.put("gl","FR");
        if(!TextUtils.isEmpty(visitorData))client.put("visitorData",visitorData);
        JSONObject context=new JSONObject();context.put("client",client);return context;
    }

    private static void ensureConfig()throws Exception{
        long now=System.currentTimeMillis();if(!TextUtils.isEmpty(apiKey)&&!TextUtils.isEmpty(clientVersion)&&now-configAt<6L*60L*60L*1000L)return;
        synchronized(CONFIG_LOCK){
            now=System.currentTimeMillis();if(!TextUtils.isEmpty(apiKey)&&!TextUtils.isEmpty(clientVersion)&&now-configAt<6L*60L*60L*1000L)return;
            String page="";try{page=get(DOMAIN+"/?hl=fr&gl=FR");}catch(Throwable ignored){}
            String key=configValue(page,"INNERTUBE_API_KEY");String ver=configValue(page,"INNERTUBE_CONTEXT_CLIENT_VERSION");String visitor=configValue(page,"VISITOR_DATA");
            if(TextUtils.isEmpty(key))key=FALLBACK_KEY;
            if(TextUtils.isEmpty(ver))ver="1."+new SimpleDateFormat("yyyyMMdd",Locale.US).format(new java.util.Date())+".01.00";
            apiKey=key;clientVersion=ver;visitorData=visitor;configAt=now;
        }
    }

    private static String configValue(String page,String key){
        if(TextUtils.isEmpty(page))return "";int p=page.indexOf(key);
        while(p>=0){
            int colon=page.indexOf(':',p+key.length());if(colon<0||colon-p>120)break;
            int q=page.indexOf('"',colon+1);if(q<0||q-colon>30)break;int e=q+1;
            while(e<page.length()){if(page.charAt(e)=='"'&&page.charAt(e-1)!='\\')break;e++;}
            if(e<page.length()){String v=page.substring(q+1,e);if(!TextUtils.isEmpty(v))return v.replace("\\/","/");}
            p=page.indexOf(key,p+key.length());
        }return "";
    }

    private static JSONObject post(String endpoint,JSONObject body)throws Exception{
        ensureConfig();String url=DOMAIN+"/youtubei/v1/"+endpoint+"?alt=json&key="+URLEncoder.encode(apiKey,"UTF-8");
        HttpURLConnection c=null;try{
            c=(HttpURLConnection)new URL(url).openConnection();c.setRequestMethod("POST");c.setDoOutput(true);headers(c);c.setRequestProperty("Content-Type","application/json; charset=UTF-8");
            c.setRequestProperty("Origin",DOMAIN);c.setRequestProperty("Referer",DOMAIN+"/");c.setRequestProperty("X-YouTube-Client-Name","67");c.setRequestProperty("X-YouTube-Client-Version",clientVersion);
            if(!TextUtils.isEmpty(visitorData))c.setRequestProperty("X-Goog-Visitor-Id",visitorData);
            c.setConnectTimeout(9000);c.setReadTimeout(14000);byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);c.setFixedLengthStreamingMode(bytes.length);
            OutputStream out=c.getOutputStream();out.write(bytes);out.close();int code=c.getResponseCode();InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();String raw=in==null?"":read(in);
            if(code<200||code>=300)throw new java.io.IOException("YTMusic HTTP "+code);return new JSONObject(raw);
        }finally{if(c!=null)c.disconnect();}
    }

    private static String get(String url)throws Exception{
        HttpURLConnection c=null;try{c=(HttpURLConnection)new URL(url).openConnection();c.setRequestMethod("GET");headers(c);c.setConnectTimeout(8000);c.setReadTimeout(10000);int code=c.getResponseCode();if(code<200||code>=300)throw new java.io.IOException("YTMusic config HTTP "+code);return read(c.getInputStream());}finally{if(c!=null)c.disconnect();}
    }
    private static void headers(HttpURLConnection c){c.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36");c.setRequestProperty("Accept-Language","fr-FR,fr;q=0.9,en;q=0.7");c.setRequestProperty("Accept-Encoding","identity");}
    private static String read(InputStream in)throws Exception{BufferedReader br=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();char[] buf=new char[8192];int n;while((n=br.read(buf))>=0)b.append(buf,0,n);br.close();return b.toString();}
}
`;

await writeFile(path.join(pkgDir,'AudifyYoutubeMusicAlbumResolver.java'),resolver,'utf8');

let src=await readFile(metadataPath,'utf8');

function replaceMethod(source,signatureStarts,replacement,label){
  for(const sig of signatureStarts){
    const start=source.indexOf(sig);
    if(start<0)continue;
    const brace=source.indexOf('{',start);if(brace<0)continue;
    let depth=0,end=-1;
    for(let i=brace;i<source.length;i++){
      if(source[i]==='{')depth++;
      else if(source[i]==='}'){
        depth--;if(depth===0){end=i+1;break;}
      }
    }
    if(end>0)return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error('V68.15: method not found '+label);
}

// Permanent album identity cache is intentionally disabled per product decision.
src=replaceMethod(src,
  ['    static Album cached(Context c,String key){','    static Album cached(Context c, String key){'],
  String.raw`    static Album cached(Context c,String key){ return null; }`,
  'cached');
src=replaceMethod(src,
  ['    static void cache(Context c,String key,Album a){','    static void cache(Context c, String key, Album a){'],
  String.raw`    static void cache(Context c,String key,Album a){ /* V68.15: no persistent album identity cache */ }`,
  'cache');

const marker='static final String RECALL_MARKER="AUDIFY_V68141_ALBUM_RECALL_FIX";';
if(!src.includes(marker))throw new Error('V68.15: recall marker missing');
src=src.replace(marker,marker+'\n    static final String YTMUSIC_MARKER="AUDIFY_V6815_YTMUSIC_PRIMARY_RESOLVER";\n    static final String NO_ALBUM_CACHE_MARKER="AUDIFY_V6815_NO_PERSISTENT_ALBUM_CACHE";');

const anchor='        String hint=cleanAlbumHint(yt.albumHint,title,artist);';
if(!src.includes(anchor))throw new Error('V68.15: identify anchor missing');
src=src.replace(anchor,anchor+String.raw`

        // V68.15 PRIMARY PATH: ask YouTube Music for its own song -> album relationship.
        // This is a structural MPRE relation, not a text-only guess. MusicBrainz/Apple run only as fallback.
        try{
            Album ytm=AudifyYoutubeMusicAlbumResolver.identify(title,artist,videoId,durationMs,hint);
            if(ytm!=null&&ytm.tracks.size()>1&&ytm.confidence>=86)return ytm;
        }catch(Throwable ignored){}`);

await writeFile(metadataPath,src,'utf8');
console.log('Audify V68.15: YouTube Music direct album relation enabled as primary resolver; persistent album identity cache disabled.');
