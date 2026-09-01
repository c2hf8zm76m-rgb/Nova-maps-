import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const loginPath=path.join(pkgDir,'AudifyLoginActivity.java');
const storePath=path.join(pkgDir,'AudifyLibraryStore.java');
const affinityPath=path.join(pkgDir,'AudifyAffinityStore.java');

// =============================================================================
// 1) Moteur Cloud Sync — Google Drive appDataFolder, fusion non destructive.
// =============================================================================
const cloud=String.raw`package com.nova.audify;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/** Audify V68.12.4 — synchronisation privée dans Google Drive appDataFolder. */
public final class AudifyCloudSyncManager {
    private static final String LIB_PREFS="audify_native_library_v679";
    private static final String AFFINITY_PREFS="audify_affinity_v68100";
    private static final String CLOUD_PREFS="audify_cloud_v68124";
    private static final String FILE_NAME="audify-cloud-v68124.json";
    private static final String DIRTY="__cloud_dirty";
    private static final String LAST_SYNC="last_sync";
    private static final OkHttpClient HTTP=new OkHttpClient.Builder().build();

    public static final class Result {
        public final boolean ok;
        public final String message;
        public final long syncedAt;
        Result(boolean ok,String message,long syncedAt){this.ok=ok;this.message=message;this.syncedAt=syncedAt;}
        static Result ok(String message,long at){return new Result(true,message,at);}
        static Result error(String message){return new Result(false,message,0L);}
    }

    private AudifyCloudSyncManager(){}

    public static long getLastSync(Context context){
        return context.getApplicationContext().getSharedPreferences(CLOUD_PREFS,Context.MODE_PRIVATE).getLong(LAST_SYNC,0L);
    }

    public static boolean isDirty(Context context){
        Context app=context.getApplicationContext();
        return app.getSharedPreferences(CLOUD_PREFS,Context.MODE_PRIVATE).getBoolean(DIRTY,false)
            ||app.getSharedPreferences(LIB_PREFS,Context.MODE_PRIVATE).getBoolean(DIRTY,false)
            ||app.getSharedPreferences(AFFINITY_PREFS,Context.MODE_PRIVATE).getBoolean(DIRTY,false);
    }

    public static void markDirty(Context context){
        context.getApplicationContext().getSharedPreferences(CLOUD_PREFS,Context.MODE_PRIVATE).edit().putBoolean(DIRTY,true).commit();
    }

    public static Result sync(Context context,String accessToken,String email,String uid){
        if(accessToken==null||accessToken.trim().isEmpty())return Result.error("Autorisation Google Drive absente.");
        Context app=context.getApplicationContext();
        try{
            JSONObject local=new JSONObject();
            local.put("schema",1);
            local.put("email",email==null?"":email);
            local.put("uid",uid==null?"":uid);
            local.put("updatedAt",System.currentTimeMillis());
            local.put("library",snapshot(app,LIB_PREFS));
            local.put("affinity",snapshot(app,AFFINITY_PREFS));

            String fileId=findFile(accessToken);
            JSONObject remote=null;
            if(!fileId.isEmpty()){
                String raw=execute(new Request.Builder()
                    .url("https://www.googleapis.com/drive/v3/files/"+fileId+"?alt=media")
                    .header("Authorization","Bearer "+accessToken).get().build());
                if(raw!=null&&!raw.trim().isEmpty())try{remote=new JSONObject(raw);}catch(Exception ignored){}
            }

            JSONObject merged=mergePayload(local,remote);
            long now=System.currentTimeMillis();
            merged.put("updatedAt",now);
            merged.put("email",email==null?"":email);
            merged.put("uid",uid==null?"":uid);
            apply(app,LIB_PREFS,merged.optJSONObject("library"));
            apply(app,AFFINITY_PREFS,merged.optJSONObject("affinity"));
            upload(accessToken,fileId,merged.toString());

            app.getSharedPreferences(LIB_PREFS,Context.MODE_PRIVATE).edit().putBoolean(DIRTY,false).commit();
            app.getSharedPreferences(AFFINITY_PREFS,Context.MODE_PRIVATE).edit().putBoolean(DIRTY,false).commit();
            app.getSharedPreferences(CLOUD_PREFS,Context.MODE_PRIVATE).edit().putLong(LAST_SYNC,now).putBoolean(DIRTY,false).commit();
            return Result.ok(remote==null?"Bibliothèque sauvegardée dans le cloud.":"Bibliothèque fusionnée et synchronisée.",now);
        }catch(Exception e){
            String m=e.getMessage()==null?"Erreur inconnue":e.getMessage();
            if(m.length()>150)m=m.substring(0,150);
            return Result.error("Synchronisation impossible : "+m);
        }
    }

    private static JSONObject snapshot(Context context,String name){
        JSONObject out=new JSONObject();
        SharedPreferences p=context.getSharedPreferences(name,Context.MODE_PRIVATE);
        for(Map.Entry<String,?> entry:p.getAll().entrySet()){
            String key=entry.getKey();
            if(key==null||key.startsWith("__cloud_"))continue;
            Object value=entry.getValue();
            try{
                if(value instanceof String||value instanceof Boolean||value instanceof Integer||value instanceof Long||value instanceof Double)out.put(key,value);
                else if(value instanceof Float)out.put(key,((Float)value).doubleValue());
                else if(value instanceof Set){JSONArray a=new JSONArray();for(Object v:(Set<?>)value)a.put(String.valueOf(v));out.put(key,a);}
            }catch(Exception ignored){}
        }
        return out;
    }

    private static JSONObject mergePayload(JSONObject local,JSONObject remote){
        if(remote==null)return local;
        JSONObject out=new JSONObject();
        try{
            out.put("schema",Math.max(local.optInt("schema",1),remote.optInt("schema",1)));
            out.put("library",mergeLibrary(local.optJSONObject("library"),remote.optJSONObject("library")));
            out.put("affinity",mergeAffinity(local.optJSONObject("affinity"),remote.optJSONObject("affinity")));
        }catch(Exception ignored){}
        return out;
    }

    private static JSONObject mergeLibrary(JSONObject local,JSONObject remote){
        JSONObject l=local==null?new JSONObject():local;
        JSONObject r=remote==null?new JSONObject():remote;
        JSONObject out=new JSONObject();
        LinkedHashSet<String> keys=new LinkedHashSet<>();
        Iterator<String> li=l.keys();while(li.hasNext())keys.add(li.next());
        Iterator<String> ri=r.keys();while(ri.hasNext())keys.add(ri.next());
        for(String key:keys){
            try{
                Object lv=l.opt(key),rv=r.opt(key);
                if(lv instanceof String||rv instanceof String){
                    String ls=lv instanceof String?(String)lv:"";
                    String rs=rv instanceof String?(String)rv:"";
                    String merged;
                    if(key.toLowerCase().contains("playlist"))merged=mergePlaylistJson(ls,rs);
                    else merged=mergeTrackArrayJson(ls,rs,key.toLowerCase().contains("recent")?100:0);
                    if(merged==null)merged=!ls.isEmpty()?ls:rs;
                    out.put(key,merged);
                }else if(lv!=null&&lv!=JSONObject.NULL)out.put(key,lv);
                else if(rv!=null&&rv!=JSONObject.NULL)out.put(key,rv);
            }catch(Exception ignored){}
        }
        // Les copies de secours doivent suivre exactement les données fusionnées.
        try{
            Iterator<String> it=out.keys();java.util.ArrayList<String> base=new java.util.ArrayList<>();
            while(it.hasNext()){String k=it.next();if(!k.endsWith("_backup")&&out.opt(k) instanceof String)base.add(k);}
            for(String k:base){String v=out.optString(k,"");if(v.startsWith("[")||v.startsWith("{"))out.put(k+"_backup",v);}
        }catch(Exception ignored){}
        return out;
    }

    private static JSONObject mergeAffinity(JSONObject local,JSONObject remote){
        JSONObject l=local==null?new JSONObject():local;
        JSONObject r=remote==null?new JSONObject():remote;
        JSONObject out=new JSONObject();
        LinkedHashSet<String> keys=new LinkedHashSet<>();
        Iterator<String> li=l.keys();while(li.hasNext())keys.add(li.next());
        Iterator<String> ri=r.keys();while(ri.hasNext())keys.add(ri.next());
        for(String key:keys){
            try{
                Object lv=l.opt(key),rv=r.opt(key);
                if(lv instanceof Number&&rv instanceof Number){
                    int a=((Number)lv).intValue(),b=((Number)rv).intValue();
                    out.put(key,Math.abs(a)>=Math.abs(b)?a:b);
                }else if(lv!=null&&lv!=JSONObject.NULL)out.put(key,lv);
                else if(rv!=null&&rv!=JSONObject.NULL)out.put(key,rv);
            }catch(Exception ignored){}
        }
        return out;
    }

    private static String mergeTrackArrayJson(String local,String remote,int limit){
        try{
            JSONArray la=new JSONArray(local==null||local.trim().isEmpty()?"[]":local);
            JSONArray ra=new JSONArray(remote==null||remote.trim().isEmpty()?"[]":remote);
            JSONArray out=new JSONArray();LinkedHashSet<String> seen=new LinkedHashSet<>();
            appendTracks(out,seen,la,limit);appendTracks(out,seen,ra,limit);
            return out.toString();
        }catch(Exception ignored){return null;}
    }

    private static void appendTracks(JSONArray out,LinkedHashSet<String> seen,JSONArray source,int limit){
        for(int i=0;i<source.length();i++){
            if(limit>0&&out.length()>=limit)return;
            JSONObject o=source.optJSONObject(i);if(o==null)continue;
            String id=o.optString("id","").trim();
            String fingerprint=id.isEmpty()?(o.optString("title","")+"|"+o.optString("artist","")).toLowerCase():id;
            if(fingerprint.isEmpty()||seen.contains(fingerprint))continue;
            seen.add(fingerprint);out.put(o);
        }
    }

    private static String mergePlaylistJson(String local,String remote){
        try{
            JSONObject l=new JSONObject(local==null||local.trim().isEmpty()?"{}":local);
            JSONObject r=new JSONObject(remote==null||remote.trim().isEmpty()?"{}":remote);
            JSONObject out=new JSONObject();LinkedHashSet<String> names=new LinkedHashSet<>();
            Iterator<String> li=l.keys();while(li.hasNext())names.add(li.next());
            Iterator<String> ri=r.keys();while(ri.hasNext())names.add(ri.next());
            for(String name:names){
                JSONArray merged=new JSONArray();LinkedHashSet<String> seen=new LinkedHashSet<>();
                appendTracks(merged,seen,l.optJSONArray(name),0);appendTracks(merged,seen,r.optJSONArray(name),0);
                out.put(name,merged);
            }
            return out.toString();
        }catch(Exception ignored){return null;}
    }

    private static void appendTracks(JSONArray out,LinkedHashSet<String> seen,JSONArray source,int limit){
        if(source==null)return;
        for(int i=0;i<source.length();i++){
            if(limit>0&&out.length()>=limit)return;
            JSONObject o=source.optJSONObject(i);if(o==null)continue;
            String id=o.optString("id","").trim();
            String fingerprint=id.isEmpty()?(o.optString("title","")+"|"+o.optString("artist","")).toLowerCase():id;
            if(fingerprint.isEmpty()||seen.contains(fingerprint))continue;
            seen.add(fingerprint);out.put(o);
        }
    }

    private static void apply(Context context,String name,JSONObject values){
        if(values==null)return;
        SharedPreferences.Editor e=context.getSharedPreferences(name,Context.MODE_PRIVATE).edit();
        Iterator<String> it=values.keys();
        while(it.hasNext()){
            String key=it.next();Object v=values.opt(key);
            if(v==null||v==JSONObject.NULL)continue;
            if(v instanceof Boolean)e.putBoolean(key,(Boolean)v);
            else if(v instanceof Integer)e.putInt(key,(Integer)v);
            else if(v instanceof Long)e.putLong(key,(Long)v);
            else if(v instanceof Number)e.putInt(key,((Number)v).intValue());
            else if(v instanceof String)e.putString(key,(String)v);
            else if(v instanceof JSONArray){Set<String> s=new LinkedHashSet<>();JSONArray a=(JSONArray)v;for(int i=0;i<a.length();i++)s.add(a.optString(i,""));e.putStringSet(key,s);}
        }
        e.putBoolean(DIRTY,false).commit();
    }

    private static String findFile(String token)throws Exception{
        String q=URLEncoder.encode("name='"+FILE_NAME+"' and trashed=false",StandardCharsets.UTF_8.toString());
        String url="https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=10&fields=files(id,name,modifiedTime)&q="+q;
        JSONObject root=new JSONObject(execute(new Request.Builder().url(url).header("Authorization","Bearer "+token).get().build()));
        JSONArray files=root.optJSONArray("files");if(files==null||files.length()==0)return "";
        JSONObject f=files.optJSONObject(0);return f==null?"":f.optString("id","");
    }

    private static void upload(String token,String fileId,String payload)throws Exception{
        Request request;
        if(fileId!=null&&!fileId.isEmpty()){
            RequestBody body=RequestBody.create(MediaType.parse("application/json; charset=utf-8"),payload);
            request=new Request.Builder().url("https://www.googleapis.com/upload/drive/v3/files/"+fileId+"?uploadType=media&fields=id")
                .header("Authorization","Bearer "+token).patch(body).build();
        }else{
            String boundary="audify68124"+System.currentTimeMillis();
            String meta="{\"name\":\""+FILE_NAME+"\",\"parents\":[\"appDataFolder\"],\"mimeType\":\"application/json\"}";
            String multi="--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+meta+"\r\n--"+boundary+"\r\nContent-Type: application/json\r\n\r\n"+payload+"\r\n--"+boundary+"--";
            RequestBody body=RequestBody.create(MediaType.parse("multipart/related; boundary="+boundary),multi);
            request=new Request.Builder().url("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id")
                .header("Authorization","Bearer "+token).post(body).build();
        }
        execute(request);
    }

    private static String execute(Request request)throws Exception{
        try(Response response=HTTP.newCall(request).execute()){
            String body=response.body()==null?"":response.body().string();
            if(!response.isSuccessful())throw new IllegalStateException("Google Drive HTTP "+response.code());
            return body;
        }
    }
}
`;
// Fix duplicate helper declaration introduced intentionally by template reuse.
const fixedCloud=cloud.replace(/\n    private static void appendTracks\(JSONArray out,LinkedHashSet<String> seen,JSONArray source,int limit\)\{[\s\S]*?\n    \}\n\n    private static String mergePlaylistJson/,match=>{
  const first=match.slice(0,match.lastIndexOf('\n\n    private static String mergePlaylistJson'));
  return first+'\n\n    private static String mergePlaylistJson';
}).replace(/\n    private static void appendTracks\(JSONArray out,LinkedHashSet<String> seen,JSONArray source,int limit\)\{\n        if\(source==null\)return;[\s\S]*?\n    \}\n\n    private static void apply/, '\n\n    private static void apply');
await writeFile(path.join(pkgDir,'AudifyCloudSyncManager.java'),fixedCloud,'utf8');

// =============================================================================
// 2) Marquer la bibliothèque / l'affinité comme modifiées après chaque écriture.
// =============================================================================
let lib=await readFile(storePath,'utf8');
lib=lib.replace('prefs.edit().putString(key,json).putString(key+"_backup",json).commit();','prefs.edit().putString(key,json).putString(key+"_backup",json).putBoolean("__cloud_dirty",true).commit();');
lib=lib.replace('prefs.edit().putString(KEY_PLAYLISTS,json).putString(KEY_PLAYLISTS+"_backup",json).commit();','prefs.edit().putString(KEY_PLAYLISTS,json).putString(KEY_PLAYLISTS+"_backup",json).putBoolean("__cloud_dirty",true).commit();');
await writeFile(storePath,lib,'utf8');

let affinity=await readFile(affinityPath,'utf8');
affinity=affinity.replace('prefs.edit().putInt(key,next).commit();','prefs.edit().putInt(key,next).putBoolean("__cloud_dirty",true).commit();');
await writeFile(affinityPath,affinity,'utf8');

// =============================================================================
// 3) Profil : autorisation Drive, sync manuelle + sync silencieuse si déjà autorisée.
// =============================================================================
let login=await readFile(loginPath,'utf8');

if(!login.includes('import android.app.PendingIntent;'))login=login.replace('import android.content.Intent;','import android.content.Intent;\nimport android.app.PendingIntent;\nimport android.content.IntentSender;');
if(!login.includes('import com.google.android.gms.auth.api.identity.AuthorizationClient;'))login=login.replace('import com.google.android.gms.auth.api.signin.GoogleSignIn;',`import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.signin.GoogleSignIn;`);
if(!login.includes('import com.google.android.gms.common.api.Scope;'))login=login.replace('import com.google.android.gms.common.api.ApiException;','import com.google.android.gms.common.api.ApiException;\nimport com.google.android.gms.common.api.Scope;');
if(!login.includes('import java.util.Arrays;'))login=login.replace('import java.util.Date;','import java.util.Date;\nimport java.util.Arrays;\nimport java.util.concurrent.ExecutorService;\nimport java.util.concurrent.Executors;');

login=login.replace(
  '    private static final int RC_GOOGLE_SIGN_IN=68123;\n',
  '    private static final int RC_GOOGLE_SIGN_IN=68123;\n    private static final int RC_DRIVE_AUTH=68124;\n    private AuthorizationClient driveAuthClient;\n    private final ExecutorService cloudExecutor=Executors.newSingleThreadExecutor();\n    private TextView cloudStatus;\n    private Button cloudSyncButton;\n    private boolean cloudInteractive=false;\n'
);

login=login.replace(
  '        googleClient=GoogleSignIn.getClient(this,googleOptions);\n        styleWindow();',
  '        googleClient=GoogleSignIn.getClient(this,googleOptions);\n        driveAuthClient=Identity.getAuthorizationClient(this);\n        styleWindow();'
);

if(!login.includes('private void requestCloudSyncV68124(')){
  const marker='    private void beginGoogleSignInV68123(){';
  if(!login.includes(marker))throw new Error('V68.12.4 Google method marker introuvable');
  const methods=String.raw`    private void requestCloudSyncV68124(boolean interactive){
        if(!accounts.isSignedIn()||!"google".equals(accounts.getCurrentProvider())){
            updateCloudStatusV68124("La synchronisation Drive nécessite un compte Google.",false);
            return;
        }
        cloudInteractive=interactive;
        if(cloudSyncButton!=null){cloudSyncButton.setEnabled(false);cloudSyncButton.setAlpha(0.72f);}
        updateCloudStatusV68124("Connexion à Google Drive…",true);
        try{
            AuthorizationRequest request=AuthorizationRequest.builder()
                .setRequestedScopes(Arrays.asList(new Scope("https://www.googleapis.com/auth/drive.appdata")))
                .build();
            driveAuthClient.authorize(request)
                .addOnSuccessListener(this,result->{
                    if(result.hasResolution()){
                        PendingIntent pending=result.getPendingIntent();
                        if(!interactive){
                            updateCloudStatusV68124("Autorise Google Drive avec “Synchroniser maintenant”.",false);
                            enableCloudButtonV68124();
                            return;
                        }
                        if(pending==null){updateCloudStatusV68124("Google Drive demande une autorisation indisponible.",false);enableCloudButtonV68124();return;}
                        try{startIntentSenderForResult(pending.getIntentSender(),RC_DRIVE_AUTH,null,0,0,0);}
                        catch(IntentSender.SendIntentException e){updateCloudStatusV68124("Impossible d'ouvrir l'autorisation Google Drive.",false);enableCloudButtonV68124();}
                    }else handleDriveAuthorizationV68124(result);
                })
                .addOnFailureListener(this,e->{updateCloudStatusV68124("Autorisation Google Drive impossible.",false);enableCloudButtonV68124();});
        }catch(Exception e){updateCloudStatusV68124("Google Drive indisponible sur cet appareil.",false);enableCloudButtonV68124();}
    }

    private void handleDriveAuthorizationV68124(AuthorizationResult result){
        String token=result==null?null:result.getAccessToken();
        if(token==null||token.trim().isEmpty()){
            updateCloudStatusV68124("Google n'a pas fourni l'accès Drive nécessaire.",false);enableCloudButtonV68124();return;
        }
        updateCloudStatusV68124("Fusion de ta bibliothèque…",true);
        cloudExecutor.execute(()->{
            AudifyCloudSyncManager.Result r=AudifyCloudSyncManager.sync(this,token,accounts.getCurrentEmail(),accounts.getCurrentUid());
            runOnUiThread(()->{
                updateCloudStatusV68124(r.message,r.ok);
                enableCloudButtonV68124();
                if(r.ok&&cloudSyncButton!=null)cloudSyncButton.setText("✓ Synchronisé");
            });
        });
    }

    private void enableCloudButtonV68124(){
        if(cloudSyncButton!=null){cloudSyncButton.setEnabled(true);cloudSyncButton.setAlpha(1f);cloudSyncButton.setText("Synchroniser maintenant");}
    }

    private void updateCloudStatusV68124(String message,boolean positive){
        if(cloudStatus!=null){cloudStatus.setText(message);cloudStatus.setTextColor(positive?Color.rgb(181,255,145):Color.rgb(174,184,197));}
    }

    private String cloudSubtitleV68124(){
        long last=AudifyCloudSyncManager.getLastSync(this);
        if(last<=0L)return "Jamais synchronisé";
        String date=DateFormat.getDateTimeInstance(DateFormat.SHORT,DateFormat.SHORT).format(new Date(last));
        return "Dernière synchro : "+date+(AudifyCloudSyncManager.isDirty(this)?" · changements en attente":" · à jour");
    }

`;
  login=login.replace(marker,methods+marker);
}

login=login.replace(
  '        if(requestCode!=RC_GOOGLE_SIGN_IN)return;',
  `        if(requestCode==RC_DRIVE_AUTH){
            try{handleDriveAuthorizationV68124(driveAuthClient.getAuthorizationResultFromIntent(data));}
            catch(Exception e){updateCloudStatusV68124("Autorisation Google Drive annulée.",false);enableCloudButtonV68124();}
            return;
        }
        if(requestCode!=RC_GOOGLE_SIGN_IN)return;`
);

const oldCloud=String.raw`        LinearLayout cloud=new LinearLayout(this); cloud.setOrientation(LinearLayout.VERTICAL); cloud.setPadding(dp(15),dp(12),dp(15),dp(12)); cloud.setBackground(round(Color.rgb(17,27,22),dp(1),Color.rgb(55,89,43),dp(20)));
        TextView cloudTitle=text("Synchronisation cloud",14f,true); cloudTitle.setTextColor(ACCENT); cloud.addView(cloudTitle);
        TextView cloudText=text("Pas encore activée — ce noyau de compte sera relié au cloud dans une prochaine version.",13f,false); cloudText.setTextColor(Color.rgb(180,191,184)); cloud.addView(cloudText);
        LinearLayout.LayoutParams clp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT); clp.topMargin=dp(22); card.addView(cloud,clp);`;
const newCloud=String.raw`        LinearLayout cloud=new LinearLayout(this); cloud.setOrientation(LinearLayout.VERTICAL); cloud.setPadding(dp(15),dp(14),dp(15),dp(14)); cloud.setBackground(round(Color.rgb(17,27,22),dp(1),Color.rgb(55,89,43),dp(20)));
        TextView cloudTitle=text("Synchronisation cloud",14f,true); cloudTitle.setTextColor(ACCENT); cloud.addView(cloudTitle,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30)));
        boolean googleCloud="google".equals(accounts.getCurrentProvider());
        cloudStatus=text(googleCloud?cloudSubtitleV68124():"La synchronisation des comptes e-mail arrivera avec le backend Audify.",13f,false);
        cloudStatus.setTextColor(Color.rgb(180,191,184)); cloudStatus.setLineSpacing(dp(2),1.08f); cloud.addView(cloudStatus,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        cloudSyncButton=activeButton(googleCloud?"Synchroniser maintenant":"Cloud Google uniquement",false);
        cloudSyncButton.setEnabled(googleCloud); cloudSyncButton.setAlpha(googleCloud?1f:0.50f);
        if(googleCloud)cloudSyncButton.setOnClickListener(v->requestCloudSyncV68124(true));
        LinearLayout.LayoutParams cblp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(52));cblp.topMargin=dp(13);cloud.addView(cloudSyncButton,cblp);
        LinearLayout.LayoutParams clp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT); clp.topMargin=dp(22); card.addView(cloud,clp);
        if(googleCloud&&(AudifyCloudSyncManager.isDirty(this)||AudifyCloudSyncManager.getLastSync(this)==0L))cloudStatus.postDelayed(()->requestCloudSyncV68124(false),550L);`;
if(!login.includes(oldCloud))throw new Error('V68.12.4 bloc cloud profil introuvable');
login=login.replace(oldCloud,newCloud);

await writeFile(loginPath,login,'utf8');
console.log('Audify V68.12.4 : Google Drive appDataFolder Cloud Sync + fusion likes/playlists/recents/affinité.');
