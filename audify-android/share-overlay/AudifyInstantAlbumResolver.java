package com.nova.audify;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import org.json.JSONArray;
import org.json.JSONObject;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

final class AudifyInstantAlbumResolver {
    private static final String SERVICE="com.nova.audify.AudifyPlaybackService", ENGINE="com.nova.audify.AudifyYoutubeSearchEngine", PLAYER="com.nova.audify.NativePlayerActivity";
    private static final long CACHE=14L*24L*60L*60L*1000L;
    private static final Handler MAIN=new Handler(Looper.getMainLooper());
    private static final ExecutorService SEARCH=Executors.newFixedThreadPool(5,r->{Thread t=new Thread(r,"AudifyAlbumResolve");t.setDaemon(true);return t;});
    private static final Map<String,State> STATES=new ConcurrentHashMap<>();
    static final class Playable {
        String id="",title="",artist="",thumbnail="";
        JSONObject json()throws Exception{JSONObject o=new JSONObject();o.put("id",id);o.put("title",title);o.put("artist",artist);o.put("thumbnail",thumbnail);return o;}
        static Playable from(JSONObject o){if(o==null)return null;Playable p=new Playable();p.id=o.optString("id","");p.title=o.optString("title","");p.artist=o.optString("artist","");p.thumbnail=o.optString("thumbnail","");return TextUtils.isEmpty(p.id)?null:p;}
    }
    static final class State {
        final Context app;final AudifyInstantAlbumMetadata.Album album;final Playable[] slots;final Set<String> used=Collections.newSetFromMap(new ConcurrentHashMap<String,Boolean>());final AtomicBoolean started=new AtomicBoolean();final AtomicInteger pending=new AtomicInteger();volatile boolean complete,playing,refreshScheduled;
        State(Context c,AudifyInstantAlbumMetadata.Album a){app=c.getApplicationContext();album=a;slots=new Playable[a.tracks.size()];loadAlbumCache(app,a,slots,used);}
        synchronized Playable get(int i){return i>=0&&i<slots.length?slots[i]:null;}
        synchronized void put(int i,Playable p){if(p==null||i<0||i>=slots.length||slots[i]!=null||TextUtils.isEmpty(p.id)||!used.add(p.id))return;slots[i]=p;writeTrack(app,album.tracks.get(i),p);writeAlbumCache(app,album,slots);if(i==0)prefetch(app,p);refresh();}
        synchronized int readyCount(){int n=0;for(Playable p:slots)if(p!=null)n++;return n;}
        synchronized ArrayList<Playable> ready(){ArrayList<Playable> out=new ArrayList<>();for(Playable p:slots)if(p!=null)out.add(p);return out;}
        void absorb(String videoId,String title,String artist,String thumb){if(TextUtils.isEmpty(videoId))return;int idx=album.current;if(idx<0||idx>=album.tracks.size()||AudifyInstantAlbumMetadata.similarity(title,album.tracks.get(idx).title)<2){idx=-1;for(int i=0;i<album.tracks.size();i++)if(AudifyInstantAlbumMetadata.similarity(title,album.tracks.get(i).title)>=2){idx=i;break;}}if(idx>=0){Playable p=new Playable();p.id=videoId;p.title=album.tracks.get(idx).title;p.artist=TextUtils.isEmpty(album.tracks.get(idx).artist)?artist:album.tracks.get(idx).artist;p.thumbnail=thumb;put(idx,p);}}
        void start(){if(!started.compareAndSet(false,true))return;Playable first=get(0);if(first!=null)prefetch(app,first);if(readyCount()==slots.length){complete=true;return;}int warm=Math.min(4,album.tracks.size());for(int n=0;n<warm;n++){final int i=n;if(get(i)!=null)continue;SEARCH.execute(()->{try{Playable p=readTrack(app,album.tracks.get(i));if(p==null)p=resolve(album.tracks.get(i),album.title);if(p!=null)put(i,p);}catch(Throwable ignored){}});}SEARCH.execute(()->{try{batch(this);}catch(Throwable ignored){}missing();});}
        void missing(){ArrayList<Integer> m=new ArrayList<>();synchronized(this){for(int i=0;i<slots.length;i++)if(slots[i]==null)m.add(i);}if(m.isEmpty()){complete=true;return;}pending.set(m.size());for(Integer idx:m)SEARCH.execute(()->{try{Playable p=readTrack(app,album.tracks.get(idx));if(p==null)p=resolve(album.tracks.get(idx),album.title);if(p!=null)put(idx,p);}catch(Throwable ignored){}if(pending.decrementAndGet()==0){complete=true;writeAlbumCache(app,album,slots);refresh();}});}
        void markPlaying(){playing=true;refresh();}
        void refresh(){if(!playing||refreshScheduled)return;refreshScheduled=true;MAIN.postDelayed(()->{refreshScheduled=false;if(!playing)return;try{ArrayList<Playable> q=ready();if(!q.isEmpty())setQueue(app,q);}catch(Throwable ignored){}},900);}
    }
    static State ensure(Context c,AudifyInstantAlbumMetadata.Album a,String videoId,String title,String artist,String thumb){String k=AudifyInstantAlbumMetadata.key(a);State s=STATES.get(k);if(s==null){State n=new State(c,a),r=STATES.putIfAbsent(k,n);s=r==null?n:r;}s.absorb(videoId,title,artist,thumb);s.start();return s;}
    private static void batch(State s){try{Object e=engine();Method m=search(e);if(e==null||m==null)return;Object raw=m.invoke(e,(s.album.artist+" "+s.album.title+" album official audio").trim());if(!(raw instanceof List))return;for(Object r:(List<?>)raw){String id=field(r,"id");if(TextUtils.isEmpty(id)||s.used.contains(id))continue;int bi=-1,bs=49;for(int i=0;i<s.album.tracks.size();i++){if(s.get(i)!=null)continue;int sc=score(s.album.tracks.get(i),r);if(sc>bs){bs=sc;bi=i;}}if(bi>=0)s.put(bi,fromResult(s.album.tracks.get(bi),r));}}catch(Throwable ignored){}}
    private static Playable resolve(AudifyInstantAlbumMetadata.Track t,String album){try{Object e=engine();Method m=search(e);if(e==null||m==null)return null;Object raw=m.invoke(e,(t.title+" "+t.artist+" official audio").trim());if(!(raw instanceof List))return null;Object best=null;int bs=Integer.MIN_VALUE;for(Object r:(List<?>)raw){if(TextUtils.isEmpty(field(r,"id")))continue;int sc=score(t,r)+(AudifyInstantAlbumMetadata.contains(field(r,"title"),album)?5:0);if(sc>bs){bs=sc;best=r;}}return best!=null&&bs>=50?fromResult(t,best):null;}catch(Throwable e){return null;}}
    private static int score(AudifyInstantAlbumMetadata.Track t,Object r){String rt=field(r,"title"),ra=field(r,"artist");long dur=number(r,"durationSeconds")*1000L;int s=AudifyInstantAlbumMetadata.similarity(t.title,rt)*55;if(!TextUtils.isEmpty(t.artist)&&(AudifyInstantAlbumMetadata.contains(ra,t.artist)||AudifyInstantAlbumMetadata.contains(rt,t.artist)))s+=35;String low=(rt+" "+ra).toLowerCase(Locale.ROOT);if(low.contains("topic")||low.contains("official audio"))s+=12;if((low.contains("live")||low.contains("remix")||low.contains("sped up")||low.contains("slowed"))&&!AudifyInstantAlbumMetadata.norm(t.title).contains("live")&&!AudifyInstantAlbumMetadata.norm(t.title).contains("remix"))s-=25;if(t.lengthMs>0&&dur>0){long d=Math.abs(t.lengthMs-dur);if(d<8000)s+=25;else if(d<20000)s+=15;else if(d>60000)s-=20;}return s;}
    private static Playable fromResult(AudifyInstantAlbumMetadata.Track t,Object r){Playable p=new Playable();p.id=field(r,"id");p.title=t.title;p.artist=TextUtils.isEmpty(t.artist)?field(r,"artist"):t.artist;p.thumbnail=field(r,"thumbnail");return p;}
    private static Object engine(){try{Class<?> c=Class.forName(ENGINE);Constructor<?> x=c.getDeclaredConstructor();x.setAccessible(true);return x.newInstance();}catch(Throwable e){return null;}}
    private static Method search(Object e){if(e==null)return null;try{Method m=e.getClass().getDeclaredMethod("search",String.class);m.setAccessible(true);return m;}catch(Throwable x){return null;}}
    static void launch(Context c,List<Playable> q)throws Exception{setQueue(c,q);Class<?> s=Class.forName(SERVICE);Intent i=new Intent(c,s);i.setAction(stat(s,"ACTION_PLAY_QUEUE_INDEX","com.nova.audify.PLAY_QUEUE_INDEX"));i.putExtra(stat(s,"EXTRA_QUEUE_INDEX","queueIndex"),0);start(c,i);if(c instanceof android.app.Activity){Class<?> p=Class.forName(PLAYER);Intent open=new Intent(c,p);open.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT|Intent.FLAG_ACTIVITY_SINGLE_TOP);((android.app.Activity)c).startActivity(open);}}
    private static void setQueue(Context c,List<Playable> q)throws Exception{JSONArray a=new JSONArray();for(Playable p:q){JSONObject o=new JSONObject();o.put("id",p.id);o.put("title",p.title);o.put("artist",p.artist);o.put("thumbnail",p.thumbnail);a.put(o);}JSONObject root=new JSONObject();root.put("items",a);root.put("index",0);Class<?> s=Class.forName(SERVICE);Intent i=new Intent(c,s);i.setAction(stat(s,"ACTION_SET_QUEUE","com.nova.audify.SET_QUEUE"));i.putExtra(stat(s,"EXTRA_QUEUE_JSON","queueJson"),root.toString());start(c,i);}
    private static void prefetch(Context c,Playable p){try{Class<?> s=Class.forName(SERVICE);Intent i=new Intent(c,s);i.setAction(stat(s,"ACTION_PREFETCH","com.nova.audify.PREFETCH"));i.putExtra(stat(s,"EXTRA_VIDEO_ID","videoId"),p.id);i.putExtra(stat(s,"EXTRA_TITLE","title"),p.title);i.putExtra(stat(s,"EXTRA_ARTIST","artist"),p.artist);i.putExtra(stat(s,"EXTRA_THUMBNAIL","thumbnail"),p.thumbnail);start(c,i);}catch(Throwable ignored){}}
    private static void start(Context c,Intent i){try{if(Build.VERSION.SDK_INT>=26)c.startForegroundService(i);else c.startService(i);}catch(Throwable e){try{c.startService(i);}catch(Throwable ignored){}}}
    private static String stat(Class<?> c,String n,String f){try{Field x=c.getDeclaredField(n);x.setAccessible(true);Object v=x.get(null);String s=v==null?"":String.valueOf(v);return TextUtils.isEmpty(s)?f:s;}catch(Throwable e){return f;}}
    private static String field(Object o,String n){try{Field f=o.getClass().getDeclaredField(n);f.setAccessible(true);Object v=f.get(o);return v==null?"":String.valueOf(v);}catch(Throwable e){return "";}}
    private static long number(Object o,String n){try{Field f=o.getClass().getDeclaredField(n);f.setAccessible(true);Object v=f.get(o);return v instanceof Number?((Number)v).longValue():0;}catch(Throwable e){return 0;}}
    private static String trackKey(AudifyInstantAlbumMetadata.Track t){return "t_"+Integer.toHexString((AudifyInstantAlbumMetadata.norm(t.title)+"|"+AudifyInstantAlbumMetadata.norm(t.artist)).hashCode());}
    private static Playable readTrack(Context c,AudifyInstantAlbumMetadata.Track t){try{String r=c.getSharedPreferences(AudifyInstantAlbumMetadata.PREFS,Context.MODE_PRIVATE).getString(trackKey(t),null);if(TextUtils.isEmpty(r))return null;JSONObject o=new JSONObject(r);if(System.currentTimeMillis()-o.optLong("saved",0)>CACHE)return null;return Playable.from(o.optJSONObject("p"));}catch(Throwable e){return null;}}
    private static void writeTrack(Context c,AudifyInstantAlbumMetadata.Track t,Playable p){try{JSONObject o=new JSONObject();o.put("saved",System.currentTimeMillis());o.put("p",p.json());c.getSharedPreferences(AudifyInstantAlbumMetadata.PREFS,Context.MODE_PRIVATE).edit().putString(trackKey(t),o.toString()).apply();}catch(Throwable ignored){}}
    private static void loadAlbumCache(Context c,AudifyInstantAlbumMetadata.Album a,Playable[] slots,Set<String> used){try{String r=c.getSharedPreferences(AudifyInstantAlbumMetadata.PREFS,Context.MODE_PRIVATE).getString("q_"+Integer.toHexString(AudifyInstantAlbumMetadata.key(a).hashCode()),null);if(TextUtils.isEmpty(r))return;JSONObject root=new JSONObject(r);if(System.currentTimeMillis()-root.optLong("saved",0)>CACHE)return;JSONArray x=root.optJSONArray("items");if(x==null)return;for(int i=0;i<x.length();i++){JSONObject o=x.optJSONObject(i);if(o==null)continue;int pos=o.optInt("pos",-1);Playable p=Playable.from(o);if(pos>=0&&pos<slots.length&&p!=null&&used.add(p.id))slots[pos]=p;}}catch(Throwable ignored){}}
    private static void writeAlbumCache(Context c,AudifyInstantAlbumMetadata.Album a,Playable[] slots){try{JSONObject root=new JSONObject();root.put("saved",System.currentTimeMillis());JSONArray x=new JSONArray();for(int i=0;i<slots.length;i++){Playable p=slots[i];if(p!=null){JSONObject o=p.json();o.put("pos",i);x.put(o);}}root.put("items",x);c.getSharedPreferences(AudifyInstantAlbumMetadata.PREFS,Context.MODE_PRIVATE).edit().putString("q_"+Integer.toHexString(AudifyInstantAlbumMetadata.key(a).hashCode()),root.toString()).apply();}catch(Throwable ignored){}}
}
