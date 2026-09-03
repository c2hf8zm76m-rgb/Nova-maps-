package com.nova.audify;

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
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

final class AudifyInstantAlbumMetadata {
    static final String PREFS="audify_instant_albums_v681255";
    private static final long CACHE=30L*24L*60L*60L*1000L, MB_GAP=1100L;
    private static long lastMb;
    static final class Track {
        int position,disc; String title="",artist=""; long lengthMs=-1L;
        JSONObject json() throws Exception { JSONObject o=new JSONObject();o.put("p",position);o.put("d",disc);o.put("t",title);o.put("a",artist);o.put("l",lengthMs);return o; }
        static Track from(JSONObject o){if(o==null)return null;Track t=new Track();t.position=o.optInt("p");t.disc=o.optInt("d",1);t.title=o.optString("t","");t.artist=o.optString("a","");t.lengthMs=o.optLong("l",-1);return t;}
    }
    static final class Album {
        String releaseId="",groupId="",title="",artist="",date="",type="Album";int current=-1;final ArrayList<Track> tracks=new ArrayList<>();
        JSONObject json() throws Exception {JSONObject o=new JSONObject();o.put("release",releaseId);o.put("group",groupId);o.put("title",title);o.put("artist",artist);o.put("date",date);o.put("type",type);o.put("current",current);JSONArray a=new JSONArray();for(Track t:tracks)a.put(t.json());o.put("tracks",a);return o;}
        static Album from(JSONObject o){if(o==null)return null;Album a=new Album();a.releaseId=o.optString("release","");a.groupId=o.optString("group","");a.title=o.optString("title","");a.artist=o.optString("artist","");a.date=o.optString("date","");a.type=o.optString("type","Album");a.current=o.optInt("current",-1);JSONArray x=o.optJSONArray("tracks");if(x!=null)for(int i=0;i<x.length();i++){Track t=Track.from(x.optJSONObject(i));if(t!=null&&!TextUtils.isEmpty(t.title))a.tracks.add(t);}return a;}
    }
    private static final class Candidate {String id;int score,count;Candidate(String i,int s,int c){id=i;score=s;count=c;}}
    static Album cached(Context c,String key){try{SharedPreferences p=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);String r=p.getString("a_"+Integer.toHexString(key.hashCode()),null);if(TextUtils.isEmpty(r))return null;JSONObject o=new JSONObject(r);if(System.currentTimeMillis()-o.optLong("saved",0)>CACHE)return null;Album a=Album.from(o.optJSONObject("album"));return a!=null&&a.tracks.size()>1?a:null;}catch(Throwable e){return null;}}
    static void cache(Context c,String key,Album a){try{JSONObject o=new JSONObject();o.put("saved",System.currentTimeMillis());o.put("album",a.json());c.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString("a_"+Integer.toHexString(key.hashCode()),o.toString()).apply();}catch(Throwable ignored){}}
    static Album identify(String rawTitle,String rawArtist)throws Exception{
        String title=cleanTitle(rawTitle),artist=cleanArtist(rawArtist);if(TextUtils.isEmpty(title))return null;
        String q="recording:\""+lucene(title)+"\""+(TextUtils.isEmpty(artist)?"":" AND artist:\""+lucene(artist)+"\"");
        JSONObject root=get("https://musicbrainz.org/ws/2/recording/?query="+enc(q)+"&fmt=json&limit=8");JSONArray recs=root.optJSONArray("recordings");if(recs==null)return null;
        Candidate best=null;
        for(int i=0;i<recs.length();i++){JSONObject rec=recs.optJSONObject(i);if(rec==null)continue;int base=rec.optInt("score",0)+similarity(title,rec.optString("title",""))*30;String credited=credit(rec.optJSONArray("artist-credit"));if(!TextUtils.isEmpty(artist)&&contains(credited,artist))base+=20;JSONArray rels=rec.optJSONArray("releases");if(rels==null)continue;for(int j=0;j<rels.length();j++){JSONObject rel=rels.optJSONObject(j);if(rel==null||TextUtils.isEmpty(rel.optString("id")))continue;Candidate c=new Candidate(rel.optString("id"),base+releaseScore(rel,title),rel.optInt("track-count",0));if(best==null||c.score>best.score||(c.score==best.score&&prefer(c.count,best.count)))best=c;}}
        if(best==null||best.score<65)return null;
        JSONObject rel=get("https://musicbrainz.org/ws/2/release/"+path(best.id)+"?inc=recordings+artist-credits+release-groups&fmt=json");return parse(rel,title,artist);
    }
    private static int releaseScore(JSONObject rel,String song){int s=0;if("Official".equalsIgnoreCase(rel.optString("status","")))s+=28;JSONObject rg=rel.optJSONObject("release-group");String type=rg==null?"":rg.optString("primary-type","");if("Album".equalsIgnoreCase(type))s+=65;else if("EP".equalsIgnoreCase(type))s+=42;else if("Single".equalsIgnoreCase(type))s-=30;JSONArray sec=rg==null?null:rg.optJSONArray("secondary-types");if(sec!=null)for(int i=0;i<sec.length();i++){String v=sec.optString(i,"").toLowerCase(Locale.ROOT);if(v.contains("compilation"))s-=40;if(v.contains("live"))s-=25;if(v.contains("remix"))s-=25;}int n=rel.optInt("track-count",0);if(n>=6&&n<=24)s+=22;else if(n>=4&&n<=35)s+=12;else if(n>0&&n<=2)s-=25;String title=rel.optString("title","");if(!norm(title).equals(norm(song)))s+=8;String low=title.toLowerCase(Locale.ROOT);if(low.contains("deluxe")||low.contains("expanded")||low.contains("anniversary"))s-=7;return s;}
    private static Album parse(JSONObject r,String currentTitle,String currentArtist){if(r==null)return null;Album a=new Album();a.releaseId=r.optString("id","");a.title=r.optString("title","Album");a.artist=credit(r.optJSONArray("artist-credit"));if(TextUtils.isEmpty(a.artist))a.artist=currentArtist;a.date=r.optString("date","");JSONObject rg=r.optJSONObject("release-group");a.groupId=rg==null?"":rg.optString("id","");a.type=rg==null?"Album":rg.optString("primary-type","Album");JSONArray media=r.optJSONArray("media");if(media==null)return null;int pos=0;for(int m=0;m<media.length();m++){JSONObject med=media.optJSONObject(m);JSONArray tr=med==null?null:med.optJSONArray("tracks");if(tr==null)continue;for(int i=0;i<tr.length();i++){JSONObject o=tr.optJSONObject(i);if(o==null)continue;Track t=new Track();t.position=++pos;t.disc=m+1;t.title=o.optString("title","");t.lengthMs=o.optLong("length",-1);t.artist=credit(o.optJSONArray("artist-credit"));if(TextUtils.isEmpty(t.artist)){JSONObject rec=o.optJSONObject("recording");if(rec!=null)t.artist=credit(rec.optJSONArray("artist-credit"));}if(TextUtils.isEmpty(t.artist))t.artist=a.artist;if(!TextUtils.isEmpty(t.title))a.tracks.add(t);}}for(int i=0;i<a.tracks.size();i++)if(similarity(currentTitle,a.tracks.get(i).title)>=2){a.current=i;break;}return a.tracks.size()>1?a:null;}
    private static JSONObject get(String url)throws Exception{throttle();HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(7500);c.setReadTimeout(10000);c.setInstanceFollowRedirects(true);c.setRequestProperty("Accept","application/json");c.setRequestProperty("User-Agent","Audify/68.12.55 (https://github.com/c2hf8zm76m-rgb/Nova-maps-)");try{int code=c.getResponseCode();InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();if(in==null)throw new IllegalStateException("HTTP "+code);BufferedReader br=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();String line;while((line=br.readLine())!=null)b.append(line);br.close();if(code<200||code>=300)throw new IllegalStateException("HTTP "+code);return new JSONObject(b.toString());}finally{c.disconnect();}}
    private static synchronized void throttle()throws InterruptedException{long now=android.os.SystemClock.elapsedRealtime(),wait=MB_GAP-(now-lastMb);if(wait>0)Thread.sleep(wait);lastMb=android.os.SystemClock.elapsedRealtime();}
    static String key(Album a){return !TextUtils.isEmpty(a.releaseId)?a.releaseId:norm(a.title)+"|"+norm(a.artist);}
    static String savedKey(Album a){return !TextUtils.isEmpty(a.releaseId)?"release:"+a.releaseId:"album:"+norm(a.title)+"|"+norm(a.artist);}
    static String cover(Album a){return a==null||TextUtils.isEmpty(a.releaseId)?"":"https://coverartarchive.org/release/"+a.releaseId+"/front-500";}
    static String cleanArtist(String s){return s==null?"":s.replaceAll("(?i)\\s*-\\s*Topic$","").replaceAll("(?i)VEVO$","").replaceAll("(?i)\\s*Official$","").trim();}
    static String cleanTitle(String s){if(s==null)return "";String x=s.replaceAll("(?i)[\\[(](official( music)? video|official audio|lyrics?|lyric video|visuali[sz]er|audio)[\\])]","");x=x.replaceAll("(?i)\\s*[-|]\\s*(official( music)? video|official audio|lyrics?|visuali[sz]er).*$","");return x.replaceAll("\\s+"," ").trim();}
    static String norm(String s){if(s==null)return "";String n=Normalizer.normalize(s,Normalizer.Form.NFD).replaceAll("\\p{M}+","").toLowerCase(Locale.ROOT);n=n.replaceAll("(?i)\\b(feat|ft|featuring)\\.?\\b.*$","");return n.replaceAll("[^a-z0-9]+"," ").trim().replaceAll("\\s+"," ");}
    static int similarity(String a,String b){String x=norm(a),y=norm(b);if(TextUtils.isEmpty(x)||TextUtils.isEmpty(y))return 0;if(x.equals(y))return 3;if(x.contains(y)||y.contains(x))return 2;Set<String> ax=new HashSet<>(),by=new HashSet<>();for(String p:x.split(" "))if(p.length()>1)ax.add(p);for(String p:y.split(" "))if(p.length()>1)by.add(p);int c=0;for(String p:ax)if(by.contains(p))c++;return c>=Math.max(2,Math.min(ax.size(),by.size())*2/3)?1:0;}
    static boolean contains(String h,String n){String a=norm(h),b=norm(n);return !TextUtils.isEmpty(b)&&a.contains(b);}
    private static String credit(JSONArray a){if(a==null)return "";StringBuilder b=new StringBuilder();for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x==null)continue;String n=x.optString("name","");if(TextUtils.isEmpty(n)){JSONObject ar=x.optJSONObject("artist");if(ar!=null)n=ar.optString("name","");}if(!TextUtils.isEmpty(n)){if(b.length()>0)b.append(x.optString("joinphrase"," & "));b.append(n);}}return b.toString();}
    private static boolean prefer(int a,int b){if(a<=0)return false;if(b<=0)return true;return Math.abs(a-14)<Math.abs(b-14);}
    private static String lucene(String s){return s.replace("\\","\\\\").replace("\"","\\\"");}
    private static String enc(String s)throws Exception{return URLEncoder.encode(s,"UTF-8");}
    private static String path(String s)throws Exception{return URLEncoder.encode(s,"UTF-8").replace("+","%20");}
}
