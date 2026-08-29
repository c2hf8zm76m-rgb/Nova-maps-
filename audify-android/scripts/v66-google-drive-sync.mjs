import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');
const gradlePath=path.join(root,'android','app','build.gradle');

let main=await readFile(mainPath,'utf8');

if(!main.includes('import android.accounts.Account;'))main=main.replace('import android.Manifest;','import android.Manifest;\nimport android.accounts.Account;\nimport android.app.PendingIntent;\nimport android.content.IntentSender;');
if(!main.includes('import com.google.android.gms.auth.api.identity.AuthorizationClient;'))main=main.replace('import com.getcapacitor.BridgeActivity;',`import com.getcapacitor.BridgeActivity;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.ClearTokenRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.RevokeAccessRequest;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.common.api.Scope;`);
if(!main.includes('import org.json.JSONArray;'))main=main.replace('import org.json.JSONObject;','import org.json.JSONArray;\nimport org.json.JSONObject;');
if(!main.includes('import java.net.URLEncoder;'))main=main.replace('import org.json.JSONObject;',`import org.json.JSONObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;`);

const classMarker='public class MainActivity extends BridgeActivity {';
if(!main.includes(classMarker))throw new Error('MainActivity marker V66 introuvable');
main=main.replace(classMarker,`${classMarker}
    private static final int GOOGLE_AUTH_REQUEST=6601;
    private static final String GOOGLE_FILE_NAME="audify-sync-v66.json";
    private final List<Scope> googleScopes=Arrays.asList(
        new Scope("https://www.googleapis.com/auth/drive.appdata"),
        new Scope("openid"),new Scope("email"),new Scope("profile")
    );
    private AuthorizationClient googleAuthClient;
    private OkHttpClient googleHttp;
    private final ExecutorService googleExecutor=Executors.newSingleThreadExecutor();
    private volatile String googleAccessToken="";
    private volatile String googleName="";
    private volatile String googleEmail="";
    private volatile String googlePicture="";
    private volatile boolean googleAutoSyncAfterAuth=false;
    private volatile Account googleAccount=null;
`);

const jsMarker='webView.addJavascriptInterface(new AudifyJsBridge(),"AudifyNative");';
if(!main.includes(jsMarker))throw new Error('Bridge add marker V66 introuvable');
main=main.replace(jsMarker,`${jsMarker}
        googleAuthClient=Identity.getAuthorizationClient(this);
        googleHttp=new OkHttpClient.Builder().build();`);

const bridgeMarker='    private final class AudifyJsBridge {';
if(!main.includes(bridgeMarker))throw new Error('AudifyJsBridge marker V66 introuvable');
const methods=String.raw`
    private void notifyGoogle(String type,JSONObject extra){
        try{
            JSONObject d=extra==null?new JSONObject():extra;
            d.put("type",type);
            String js="window.dispatchEvent(new CustomEvent('audify-google-native',{detail:"+d.toString()+"}));";
            runOnUiThread(()->{try{getBridge().getWebView().evaluateJavascript(js,null);}catch(Exception ignored){}});
        }catch(Exception ignored){}
    }

    private void googleError(String message){
        try{JSONObject d=new JSONObject();d.put("message",message==null?"Erreur Google":message);notifyGoogle("error",d);}catch(Exception ignored){}
    }

    private void authorizeGoogle(boolean autoSync){
        googleAutoSyncAfterAuth=autoSync;
        try{
            AuthorizationRequest request=AuthorizationRequest.builder().setRequestedScopes(googleScopes).build();
            googleAuthClient.authorize(request)
                .addOnSuccessListener(this,result->{
                    if(result.hasResolution()){
                        PendingIntent p=result.getPendingIntent();
                        if(p==null){googleError("Google n'a pas fourni de fenêtre d'autorisation.");return;}
                        try{startIntentSenderForResult(p.getIntentSender(),GOOGLE_AUTH_REQUEST,null,0,0,0);}catch(IntentSender.SendIntentException e){googleError("Impossible d'ouvrir Google : "+e.getMessage());}
                    }else handleGoogleAuthorization(result);
                })
                .addOnFailureListener(this,e->googleError("Autorisation Google impossible. Vérifie la configuration OAuth Android (package + SHA-1). "+(e.getMessage()==null?"":e.getMessage())));
        }catch(Exception e){googleError("Google Identity indisponible : "+e.getMessage());}
    }

    private void handleGoogleAuthorization(AuthorizationResult result){
        try{
            String token=result.getAccessToken();
            if(token==null||token.isEmpty()){googleError("Google n'a pas renvoyé de jeton Drive.");return;}
            googleAccessToken=token;
            try{
                GoogleSignInAccount s=result.toGoogleSignInAccount();
                if(s!=null)googleAccount=s.getAccount();
            }catch(Exception ignored){}
            googleExecutor.execute(()->{
                fetchGoogleUser();
                try{
                    JSONObject d=new JSONObject();d.put("name",googleName);d.put("email",googleEmail);d.put("picture",googlePicture);d.put("autoSync",googleAutoSyncAfterAuth);notifyGoogle("connected",d);
                }catch(Exception ignored){}
            });
        }catch(Exception e){googleError("Connexion Google incomplète : "+e.getMessage());}
    }

    @Override
    protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode!=GOOGLE_AUTH_REQUEST)return;
        try{handleGoogleAuthorization(googleAuthClient.getAuthorizationResultFromIntent(data));}
        catch(Exception e){googleError("Autorisation Google refusée ou annulée.");}
    }

    private Request.Builder googleRequest(String url){return new Request.Builder().url(url).header("Authorization","Bearer "+googleAccessToken);}

    private String executeText(Request request)throws Exception{
        try(Response response=googleHttp.newCall(request).execute()){
            String body=response.body()==null?"":response.body().string();
            if(!response.isSuccessful()){
                if(response.code()==401)googleAccessToken="";
                throw new IllegalStateException("Google HTTP "+response.code()+" "+body.substring(0,Math.min(120,body.length())));
            }
            return body;
        }
    }

    private void fetchGoogleUser(){
        try{
            String body=executeText(googleRequest("https://www.googleapis.com/oauth2/v3/userinfo").get().build());
            JSONObject o=new JSONObject(body);googleName=o.optString("name","");googleEmail=o.optString("email","");googlePicture=o.optString("picture","");
        }catch(Exception ignored){}
    }

    private String findDriveFileId()throws Exception{
        String q=URLEncoder.encode("name='"+GOOGLE_FILE_NAME+"' and trashed=false",StandardCharsets.UTF_8);
        String url="https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=10&fields=files(id,name,modifiedTime)&q="+q;
        JSONObject root=new JSONObject(executeText(googleRequest(url).get().build()));JSONArray files=root.optJSONArray("files");
        if(files==null||files.length()==0)return "";JSONObject f=files.optJSONObject(0);return f==null?"":f.optString("id","");
    }

    private String readDriveFile(String fileId)throws Exception{
        if(fileId==null||fileId.isEmpty())return "";
        return executeText(googleRequest("https://www.googleapis.com/drive/v3/files/"+fileId+"?alt=media").get().build());
    }

    private void startGoogleSync(String localPayload){
        if(googleAccessToken==null||googleAccessToken.isEmpty()){
            runOnUiThread(()->authorizeGoogle(true));return;
        }
        googleExecutor.execute(()->{
            try{
                String fileId=findDriveFileId();String remote=readDriveFile(fileId);
                JSONObject d=new JSONObject();d.put("payload",remote);d.put("fileId",fileId);notifyGoogle("remote",d);
            }catch(Exception e){googleError("Synchronisation Drive impossible : "+e.getMessage());}
        });
    }

    private void uploadGooglePayload(String payload,String fileId){
        if(googleAccessToken==null||googleAccessToken.isEmpty()){googleError("Session Google expirée. Reconnecte le compte.");return;}
        googleExecutor.execute(()->{
            try{
                Request request;
                if(fileId!=null&&!fileId.isEmpty()){
                    RequestBody body=RequestBody.create(MediaType.parse("application/json; charset=utf-8"),payload);
                    request=googleRequest("https://www.googleapis.com/upload/drive/v3/files/"+fileId+"?uploadType=media&fields=id").patch(body).build();
                }else{
                    String boundary="audifyv66"+System.currentTimeMillis();
                    String meta="{\"name\":\""+GOOGLE_FILE_NAME+"\",\"parents\":[\"appDataFolder\"],\"mimeType\":\"application/json\"}";
                    String multi="--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+meta+"\r\n--"+boundary+"\r\nContent-Type: application/json\r\n\r\n"+payload+"\r\n--"+boundary+"--";
                    RequestBody body=RequestBody.create(MediaType.parse("multipart/related; boundary="+boundary),multi);
                    request=googleRequest("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id").post(body).build();
                }
                executeText(request);notifyGoogle("synced",new JSONObject());
            }catch(Exception e){googleError("Envoi Drive impossible : "+e.getMessage());}
        });
    }

    private String googleStatusJson(){
        JSONObject o=new JSONObject();try{o.put("connected",googleAccessToken!=null&&!googleAccessToken.isEmpty());o.put("name",googleName);o.put("email",googleEmail);o.put("picture",googlePicture);}catch(Exception ignored){}return o.toString();
    }

    private void finishGoogleDisconnect(){
        googleAccessToken="";googleName="";googleEmail="";googlePicture="";googleAccount=null;notifyGoogle("disconnected",new JSONObject());
    }

    private void disconnectGoogle(){
        String token=googleAccessToken;
        if(googleAccount!=null){
            try{
                RevokeAccessRequest req=RevokeAccessRequest.builder().setAccount(googleAccount).setScopes(googleScopes).build();
                googleAuthClient.revokeAccess(req).addOnCompleteListener(t->finishGoogleDisconnect());return;
            }catch(Exception ignored){}
        }
        if(token!=null&&!token.isEmpty()){
            try{googleAuthClient.clearToken(ClearTokenRequest.builder().setToken(token).build()).addOnCompleteListener(t->finishGoogleDisconnect());return;}catch(Exception ignored){}
        }
        finishGoogleDisconnect();
    }

`;
main=main.replace(bridgeMarker,methods+bridgeMarker);

const stateMarker='@JavascriptInterface public String getState(){return AudifyPlaybackService.getStateJson();}';
if(!main.includes(stateMarker))throw new Error('getState marker V66 introuvable');
main=main.replace(stateMarker,`@JavascriptInterface public void googleConnect(){runOnUiThread(()->authorizeGoogle(false));}
        @JavascriptInterface public void googleSync(String payload){startGoogleSync(payload);}
        @JavascriptInterface public void googleUpload(String payload,String fileId){uploadGooglePayload(payload,fileId);}
        @JavascriptInterface public String googleStatus(){return googleStatusJson();}
        @JavascriptInterface public void googleDisconnect(){runOnUiThread(()->disconnectGoogle());}
        ${stateMarker}`);

const destroy='@Override public void onDestroy(){super.onDestroy();}';
if(main.includes(destroy))main=main.replace(destroy,'@Override public void onDestroy(){try{googleExecutor.shutdownNow();}catch(Exception ignored){}super.onDestroy();}');

await writeFile(mainPath,main,'utf8');

let gradle=await readFile(gradlePath,'utf8');
if(!gradle.includes('com.google.android.gms:play-services-auth:21.6.0'))gradle=gradle.replace(/dependencies\s*\{/,`dependencies {\n    implementation "com.google.android.gms:play-services-auth:21.6.0"`);
await writeFile(gradlePath,gradle,'utf8');

console.log('Audify Android V66: Google Identity Services + Drive appDataFolder sync appliqués.');
