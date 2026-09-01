import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const storePath=path.join(pkgDir,'AudifyAccountStore.java');
const loginPath=path.join(pkgDir,'AudifyLoginActivity.java');
const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');
const valuesDir=path.join(android,'app','src','main','res','values');

function replaceMethod(source,signatures,replacement,label){
  for(const signature of signatures){
    const start=source.indexOf(signature);
    if(start<0) continue;
    const brace=source.indexOf('{',start);
    if(brace<0) continue;
    let depth=0,end=-1;
    for(let i=brace;i<source.length;i++){
      if(source[i]==='{') depth++;
      else if(source[i]==='}'){
        depth--;
        if(depth===0){end=i+1;break;}
      }
    }
    if(end>0)return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error(`V68.12.5 méthode introuvable: ${label}`);
}

function xmlEscape(value){
  return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
}

// =============================================================================
// 1) Account Core : fournisseur Apple dans la même session Audify.
// =============================================================================
let store=await readFile(storePath,'utf8');
if(!store.includes('public Result signInWithApple(')){
  const marker='    public void signOut(){';
  if(!store.includes(marker))throw new Error('V68.12.5 signOut marker introuvable');
  const method=String.raw`    public Result signInWithApple(String rawEmail,String displayName,String appleSubject){
        String email=normalizeEmail(rawEmail);
        if(email.isEmpty()||!Patterns.EMAIL_ADDRESS.matcher(email).matches())return Result.error("Apple n'a pas renvoyé d'adresse e-mail valide.");
        String subject=appleSubject==null?"":appleSubject.trim();
        if(subject.isEmpty())return Result.error("Identifiant Apple invalide.");
        String uid="apple-"+subject;
        long created=System.currentTimeMillis();
        if(email.equals(getCurrentEmail())&&getCreatedAt()>0L)created=getCreatedAt();
        boolean saved=prefs.edit()
            .putString(SESSION_EMAIL,email)
            .putString(SESSION_UID,uid)
            .putString(SESSION_PROVIDER,"apple")
            .putString(SESSION_NAME,displayName==null?"":displayName.trim())
            .putString(SESSION_PHOTO,"")
            .putLong(SESSION_CREATED_AT,created)
            .commit();
        return saved?Result.ok("Compte Apple connecté à Audify."):Result.error("Impossible de mémoriser la session Apple.");
    }

`;
  store=store.replace(marker,method+marker);
}
await writeFile(storePath,store,'utf8');

// =============================================================================
// 2) Configuration publique du frontend Apple.
//    Les secrets Apple (clé .p8 / client secret) restent exclusivement serveur.
// =============================================================================
await mkdir(valuesDir,{recursive:true});
const authUrl=process.env.AUDIFY_APPLE_AUTH_URL||'';
const verifyUrl=process.env.AUDIFY_APPLE_VERIFY_URL||'';
const appleValues=`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="audify_apple_auth_url">${xmlEscape(authUrl)}</string>\n    <string name="audify_apple_verify_url">${xmlEscape(verifyUrl)}</string>\n</resources>\n`;
await writeFile(path.join(valuesDir,'audify_apple_auth.xml'),appleValues,'utf8');

// =============================================================================
// 3) Login : bouton Apple actif + lancement navigateur sécurisé vers backend.
// =============================================================================
let login=await readFile(loginPath,'utf8');
if(!login.includes('import android.net.Uri;'))login=login.replace('import android.os.Bundle;','import android.os.Bundle;\nimport android.net.Uri;');
if(!login.includes('import java.util.UUID;'))login=login.replace('import java.util.Date;','import java.util.Date;\nimport java.util.UUID;');

if(!login.includes('private void beginAppleSignInV68125()')){
  const marker='    private void beginGoogleSignInV68123(){';
  if(!login.includes(marker))throw new Error('V68.12.5 beginGoogle marker introuvable');
  const methods=String.raw`    private void beginAppleSignInV68125(){
        String authUrl=getString(R.string.audify_apple_auth_url).trim();
        String verifyUrl=getString(R.string.audify_apple_verify_url).trim();
        if(authUrl.isEmpty()||verifyUrl.isEmpty()){
            showAppleMessageV68125("Connexion Apple prête dans Audify, mais la configuration Apple Developer/serveur n'est pas encore renseignée.",false);
            return;
        }
        try{
            String state=UUID.randomUUID().toString();
            getSharedPreferences("audify_apple_auth_v68125",MODE_PRIVATE).edit().putString("pending_state",state).commit();
            Uri uri=Uri.parse(authUrl).buildUpon()
                .appendQueryParameter("state",state)
                .appendQueryParameter("return_uri","audify://auth/apple")
                .build();
            startActivity(new Intent(Intent.ACTION_VIEW,uri));
        }catch(Exception e){
            showAppleMessageV68125("Impossible d'ouvrir Se connecter avec Apple.",false);
        }
    }

    private void showAppleMessageV68125(String message,boolean ok){
        if(authStatus!=null){
            authStatus.setVisibility(android.view.View.VISIBLE);
            authStatus.setText(message==null?"":message);
            authStatus.setTextColor(ok?ACCENT:Color.rgb(255,108,118));
        }
    }

    private void consumeAppleResultV68125(){
        Intent source=getIntent();
        if(source==null)return;
        String error=source.getStringExtra("apple_error");
        if(error!=null&&!error.isEmpty())showAppleMessageV68125(error,false);
    }

`;
  login=login.replace(marker,methods+marker);
}

// Après render(), afficher une éventuelle erreur de retour Apple.
const onCreateNeedle='        styleWindow();\n        render();\n    }';
if(login.includes(onCreateNeedle))login=login.replace(onCreateNeedle,'        styleWindow();\n        render();\n        consumeAppleResultV68125();\n    }');

const appleOld='        Button apple=inactiveButton("●   Se connecter avec Apple");';
const appleNew=String.raw`        Button apple=activeButton("●   Se connecter avec Apple",false);
        apple.setTextColor(Color.rgb(242,244,248));
        apple.setBackground(round(Color.rgb(20,24,31),dp(1),Color.rgb(72,80,92),dp(22)));
        apple.setOnClickListener(v->beginAppleSignInV68125());`;
if(!login.includes(appleOld))throw new Error('V68.12.5 bouton Apple introuvable');
login=login.replace(appleOld,appleNew);
login=login.replace('Google est maintenant actif. Apple arrivera dans une prochaine étape.','Google est actif. Apple utilise maintenant le flux OAuth sécurisé Audify.');

login=login.replace(
  'TextView subtitle=text("google".equals(accounts.getCurrentProvider())?"Ton compte Google est connecté à Audify.":"Ta session Audify est active sur cet appareil.",15.5f,false);',
  'TextView subtitle=text("google".equals(accounts.getCurrentProvider())?"Ton compte Google est connecté à Audify.":("apple".equals(accounts.getCurrentProvider())?"Ton compte Apple est connecté à Audify.":"Ta session Audify est active sur cet appareil."),15.5f,false);'
);
login=login.replace(
  'TextView label=text("google".equals(accounts.getCurrentProvider())?"COMPTE GOOGLE · AUDIFY":"COMPTE AUDIFY",11.5f,true);',
  'TextView label=text("google".equals(accounts.getCurrentProvider())?"COMPTE GOOGLE · AUDIFY":("apple".equals(accounts.getCurrentProvider())?"COMPTE APPLE · AUDIFY":"COMPTE AUDIFY"),11.5f,true);'
);
await writeFile(loginPath,login,'utf8');

// =============================================================================
// 4) Callback Android : accepte uniquement un ticket opaque du backend.
//    Le ticket est ensuite vérifié côté serveur avant de créer la session Apple.
// =============================================================================
const callback=String.raw`package com.nova.audify;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/** Audify V68.12.5 — retour sécurisé du backend Sign in with Apple. */
public class AudifyAppleCallbackActivity extends AppCompatActivity {
    private static final OkHttpClient HTTP=new OkHttpClient.Builder().build();

    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        Uri data=getIntent()==null?null:getIntent().getData();
        if(data==null){finishWithError("Retour Apple invalide.");return;}
        String ticket=safe(data.getQueryParameter("ticket"));
        String returnedState=safe(data.getQueryParameter("state"));
        String expected=getSharedPreferences("audify_apple_auth_v68125",MODE_PRIVATE).getString("pending_state","");
        if(ticket.isEmpty()||returnedState.isEmpty()||expected.isEmpty()||!expected.equals(returnedState)){
            finishWithError("La vérification de sécurité Apple a échoué. Réessaie.");
            return;
        }
        String verifyUrl=getString(R.string.audify_apple_verify_url).trim();
        if(verifyUrl.isEmpty()){
            finishWithError("Le serveur Apple Audify n'est pas encore configuré.");
            return;
        }
        new Thread(()->verifyTicket(verifyUrl,ticket,returnedState)).start();
    }

    private void verifyTicket(String url,String ticket,String state){
        try{
            JSONObject bodyJson=new JSONObject();bodyJson.put("ticket",ticket);bodyJson.put("state",state);
            RequestBody body=RequestBody.create(MediaType.parse("application/json; charset=utf-8"),bodyJson.toString());
            Request request=new Request.Builder().url(url).post(body).build();
            try(Response response=HTTP.newCall(request).execute()){
                String raw=response.body()==null?"":response.body().string();
                if(!response.isSuccessful())throw new IllegalStateException("HTTP "+response.code());
                JSONObject result=new JSONObject(raw);
                if(!result.optBoolean("ok",false))throw new IllegalStateException(result.optString("message","Ticket Apple refusé"));
                String email=result.optString("email","");
                String name=result.optString("name","");
                String subject=result.optString("sub","");
                AudifyAccountStore.Result saved=new AudifyAccountStore(this).signInWithApple(email,name,subject);
                if(!saved.ok)throw new IllegalStateException(saved.message);
                getSharedPreferences("audify_apple_auth_v68125",MODE_PRIVATE).edit().remove("pending_state").commit();
                runOnUiThread(()->{
                    Intent i=new Intent(this,AudifyLoginActivity.class);
                    i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    startActivity(i);finish();
                });
            }
        }catch(Exception e){
            String message=e.getMessage()==null?"Connexion Apple impossible.":e.getMessage();
            finishWithError("Connexion Apple impossible : "+message);
        }
    }

    private void finishWithError(String message){
        runOnUiThread(()->{
            getSharedPreferences("audify_apple_auth_v68125",MODE_PRIVATE).edit().remove("pending_state").commit();
            Intent i=new Intent(this,AudifyLoginActivity.class);
            i.putExtra("apple_error",message);
            i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(i);finish();
        });
    }

    private String safe(String s){return s==null?"":s.trim();}
}
`;
await writeFile(path.join(pkgDir,'AudifyAppleCallbackActivity.java'),callback,'utf8');

// =============================================================================
// 5) Manifest : deep-link privé Audify utilisé après le retour HTTPS du backend.
// =============================================================================
let manifest=await readFile(manifestPath,'utf8');
if(!manifest.includes('android:name=".AudifyAppleCallbackActivity"')){
  const activity=`        <activity\n            android:name=".AudifyAppleCallbackActivity"\n            android:exported="true"\n            android:launchMode="singleTask">\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="audify" android:host="auth" android:path="/apple" />\n            </intent-filter>\n        </activity>\n`;
  manifest=manifest.replace('</application>',activity+'    </application>');
}
await writeFile(manifestPath,manifest,'utf8');

console.log(`Audify V68.12.5 : Apple Account OAuth intégré. Backend configuré: ${authUrl&&verifyUrl?'oui':'non (configuration requise)'}.`);
