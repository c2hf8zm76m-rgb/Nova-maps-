package com.nova.audify;
import org.json.*;
public final class AudifySyncStateTest {
 static int passed=0; static void check(boolean v,String m){if(!v)throw new AssertionError(m);passed++;}
 static JSONObject track(String id)throws Exception{return new JSONObject().put("id",id).put("title","T").put("artist","A").put("thumbnail","");}
 public static void main(String[] x)throws Exception{
  AudifySyncState s=new AudifySyncState("");JSONObject first=s.change("like","song",track("song"),false,true);String doc=AudifySyncState.id("like","song");JSONObject second=s.change("like","song",track("song").put("title","new"),true,true);
  check(!s.acknowledge(doc,first.getString("opId")),"old completion cleared new edit");check(s.pendingCount()==1,"pending edit lost");check(s.acknowledge(doc,second.getString("opId")),"matching operation not acknowledged");check(s.pendingCount()==0,"outbox not empty");
  check(new AudifySyncState(s.save()).get("like","song").optBoolean("deleted"),"tombstone not durable");
  AudifySyncState conflict=new AudifySyncState("");JSONObject local=conflict.change("recent","x",track("x"),false,true);JSONObject remote=new JSONObject(local.toString()).put("opId","remote").put("serverTime",999);check(!conflict.acceptRemote(AudifySyncState.id("recent","x"),remote),"remote overwrote pending intent");
  AudifySyncState lib=new AudifySyncState("");String old=AudifyLibraryModel.create(lib,"Mix",false);AudifyLibraryModel.add(lib,"Mix",track("one"),false);AudifyLibraryModel.delete(lib,"Mix",false);String fresh=AudifyLibraryModel.create(lib,"Mix",false);check(!old.equals(fresh),"playlist id reused");check(AudifyLibraryModel.playlistTracks(lib,"Mix").isEmpty(),"deleted tracks resurrected");
  AudifySyncState a=new AudifySyncState(""),b=new AudifySyncState("");a.change("like","a",track("a"),false,false);b.change("like","b",track("b"),false,false);check(!b.contains("like","a")&&!a.contains("like","b"),"account isolation failed");
  boolean corrupt=false;try{new AudifySyncState("not json");}catch(Exception e){corrupt=true;}check(corrupt,"corruption silently accepted");System.out.println("AudifySyncStateTest: "+passed+" assertions passed");
 }
}
