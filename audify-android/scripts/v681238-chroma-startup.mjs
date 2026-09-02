import {readFile,writeFile,copyFile,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const java=path.join(root,'android/app/src/main/java/com/nova/audify');
const res=path.join(root,'android/app/src/main/res');
const source=path.join(root,'startup/src/com/nova/audify');
const replace=(s,from,to)=>{if(!s.includes(from))throw Error('Chroma startup missing anchor: '+from.slice(0,100));return s.replace(from,to);};
function method(s,signature){
 const start=s.indexOf(signature);if(start<0)throw Error('Chroma startup missing method: '+signature);
 const brace=s.indexOf('{',start);let depth=0;
 for(let i=brace;i<s.length;i++){if(s[i]==='{')depth++;else if(s[i]==='}'&&--depth===0)return {start,brace,end:i+1};}
 throw Error('Unclosed method '+signature);
}
function replaceMethod(s,signature,body){const m=method(s,signature);return s.slice(0,m.start)+body+s.slice(m.end);}
for(const file of await readdir(source))if(file.endsWith('.java'))await copyFile(path.join(source,file),path.join(java,file));
// Copy the canonical services as well; no new Firebase credentials or rules.
for(const file of ['AudifyFirebaseSync.java','AudifyFirebaseAvatar.java','AudifyApplication.java'])
 await copyFile(path.join(root,'firebase/src/com/nova/audify',file),path.join(java,file));
await mkdir(path.join(res,'drawable-nodpi'),{recursive:true});
for(const [input,output] of [['audify_mark.png','audify_mark.png'],['audify_startup_icon.png','audify_startup_icon.png']])
 await copyFile(path.join(root,'branding',input),path.join(res,'drawable-nodpi',output));

const homePath=path.join(java,'NativeHomeActivity.java');
let home=await readFile(homePath,'utf8');
if(!home.includes('// CHROMA_STARTUP_V681238')){
 // Firebase's earlier patch is additive. Strip its Home hook before installing a lifecycle-aware one.
 home=home.replace(/    private String firebaseScreenUid=null;[\s\S]*?@Override protected void onStop\(\)\{AudifyFirebaseSync\.get\(this\)\.removeListener\(firebaseRefresh\);super\.onStop\(\);\}\s*/g,'');
 const start=method(home,'    @Override protected void onCreate(Bundle savedInstanceState)');
 let body;
 if(home.includes('private void onCreateAudifyV681235(')){
  const original=method(home,'    private void onCreateAudifyV681235(Bundle savedInstanceState)');
  body=home.slice(original.brace+1,original.end-1);
  home=home.slice(0,original.start)+home.slice(original.end);
 }else body=home.slice(start.brace+1,start.end-1).replace(/\s*super\.onCreate\(savedInstanceState\);/,'');
 body=replace(body,'setContentView(root);','startup.mountHome(root);');
 home=replaceMethod(home,'    @Override protected void onCreate(Bundle savedInstanceState)',`    // CHROMA_STARTUP_V681238
    private AudifyStartupController startup;
    private AudifyArtworkLoader startupArtwork;
    private String firebaseScreenUid;
    private boolean firebaseObserved,firebaseHomeClosing;
    private final Runnable firebaseRefresh=()->{
        if(isFinishing()||isDestroyed()||firebaseHomeClosing||startup==null||!startup.isRevealed()||libraryContent==null)return;
        String uid=AudifyFirebaseSync.get(this).uid();
        if(firebaseScreenUid!=null&&!firebaseScreenUid.equals(uid)){firebaseHomeClosing=true;recreate();return;}
        rebuildLibrary();
    };
    private void observeFirebaseHome(){
        if(firebaseObserved||firebaseHomeClosing)return;
        String currentUid=AudifyFirebaseSync.get(this).uid();
        if(firebaseScreenUid!=null&&!firebaseScreenUid.equals(currentUid)){firebaseHomeClosing=true;recreate();return;}
        firebaseScreenUid=currentUid;
        AudifyFirebaseSync.get(this).addListener(firebaseRefresh);firebaseObserved=true;
    }
    @Override protected void onCreate(Bundle savedInstanceState){
        androidx.core.splashscreen.SplashScreen systemSplash=androidx.core.splashscreen.SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        if(getSupportActionBar()!=null)getSupportActionBar().hide();
        getWindow().setStatusBarColor(Color.rgb(5,8,12));
        getWindow().setNavigationBarColor(Color.rgb(5,8,12));
        startupArtwork=new AudifyArtworkLoader(images);
        startup=new AudifyStartupController(this,()->buildPreparedHome(savedInstanceState),()->{
            if(startup.isDegraded())rebuildLibrary();
            observeFirebaseHome();handler.removeCallbacks(ticker);handler.post(ticker);
        });
        systemSplash.setOnExitAnimationListener(provider->provider.remove());
    }
    private void buildPreparedHome(Bundle savedInstanceState){${body}
    }
    @Override protected void onStart(){
        super.onStart();
        if(startup!=null){startup.onStart();if(startup.isRevealed()){observeFirebaseHome();firebaseRefresh.run();}}
    }
    @Override protected void onStop(){
        if(startup!=null)startup.onStop();
        if(firebaseObserved){AudifyFirebaseSync.get(this).removeListener(firebaseRefresh);firebaseObserved=false;}
        super.onStop();
    }`);
 if(home.includes('private void showStartupFallbackV681235('))home=replaceMethod(home,'    private void showStartupFallbackV681235(Throwable error)',`    private void showStartupFallbackV681235(Throwable error){
        if(startup!=null)startup.homeFailure(error);
    }`);
 home=replace(home,'        super.onResume();','        super.onResume();\n        if(startup==null||!startup.isRevealed()||libraryContent==null)return;');
 home=replaceMethod(home,'    @Override protected void onDestroy()',`    @Override protected void onDestroy(){
        handler.removeCallbacksAndMessages(null);
        if(startup!=null)startup.dispose();
        if(startupArtwork!=null)startupArtwork.close();
        images.shutdownNow();super.onDestroy();
    }`);
 home=replaceMethod(home,'    private void loadImage(ImageView view,String url)',`    private void loadImage(ImageView view,String url){
        int ticket=startup==null?-1:startup.assetStarted();
        if(startup!=null&&startup.isPreparing()&&startup.isOffline()){
            startupArtwork.loadCached(view,url,ok->startup.assetFinished(ticket,ok));return;
        }
        startupArtwork.load(view,url,ok->{if(startup!=null)startup.assetFinished(ticket,ok);});
    }`);
 // Uncached recommendations are real startup work. Cached refreshes may happen later.
 home=replace(home,'        discovery.ensureRecommendations(seed,known,genre,changed->{\n            if(changed&&!isFinishing()) runOnUiThread(this::rebuildLibrary);\n        });',`        final boolean offlineStartup=startup!=null&&startup.isPreparing()&&startup.isOffline();
        final int recommendationsTicket=!offlineStartup&&startup!=null&&startup.isPreparing()&&cached.isEmpty()?startup.assetStarted():-1;
        if(!offlineStartup)discovery.ensureRecommendations(seed,known,genre,changed->runOnUiThread(()->{
            if(isFinishing()||isDestroyed())return;
            if(changed&&(recommendationsTicket>=0||startup==null||startup.isRevealed()))rebuildLibrary();
            if(startup!=null)startup.assetFinished(recommendationsTicket,changed||!discovery.getCached(seed.id).isEmpty());
        }));`);
 home=home.replace('TextView loading=text("Recherche de nouvelles recommandations…",15f,true);',
  'TextView loading=text(startup!=null&&startup.isOffline()?"Recommandations disponibles avec une connexion":startup!=null&&startup.isDegraded()?"Recommandations indisponibles pour le moment":"Recherche de nouvelles recommandations…",15f,true);');
 // Resolve the local avatar while covered instead of a 550 ms post-splash replacement.
 home=home.replace('avatar.postDelayed(()->{','final int avatarTicket=startup==null?-1:startup.assetStarted();\n                avatar.post(()->{');
 home=home.replace('if(AudifyProfileMedia.apply(this,avatar,localProfileV681234)){','boolean avatarLoaded=AudifyProfileMedia.apply(this,avatar,localProfileV681234);\n                    if(avatarLoaded){');
 home=home.replace('                },550L);','                    if(startup!=null)startup.assetFinished(avatarTicket,avatarLoaded);\n                });');
 await writeFile(homePath,home);
}

let discovery=await readFile(path.join(java,'AudifyDiscoveryAgent.java'),'utf8');
discovery=discovery.replace('if(!IN_FLIGHT.compareAndSet(false,true)) return;','if(!IN_FLIGHT.compareAndSet(false,true)){if(callback!=null)callback.onFinished(false);return;}');
discovery=discovery.replace('if(!IN_FLIGHT.compareAndSet(false,true))return;','if(!IN_FLIGHT.compareAndSet(false,true)){if(callback!=null)callback.onFinished(false);return;}');
await writeFile(path.join(java,'AudifyDiscoveryAgent.java'),discovery);

let manifest=await readFile(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
manifest=manifest.replace(/\s*<activity\s[^>]*android:name="\.AudifySplashActivity"[\s\S]*?<\/activity>/,'');
manifest=manifest.replace(/<activity\s+android:name="\.NativeHomeActivity"[^>]*\/>/,`<activity android:name=".NativeHomeActivity" android:exported="true" android:theme="@style/AudifyStartupTheme" android:screenOrientation="unspecified">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>`);
if((manifest.match(/android.intent.category.LAUNCHER/g)||[]).length!==1||manifest.includes('android:name=".AudifySplashActivity"'))throw Error('Expected one native launcher');
await writeFile(path.join(root,'android/app/src/main/AndroidManifest.xml'),manifest);
// Keep an internal redirect only for old explicit intents; never another splash.
await writeFile(path.join(java,'AudifySplashActivity.java'),`package com.nova.audify;
public final class AudifySplashActivity extends android.app.Activity {
 @Override protected void onCreate(android.os.Bundle state){super.onCreate(state);startActivity(new android.content.Intent(this,NativeHomeActivity.class));finish();}
}`);
await writeFile(path.join(res,'values/audify_startup_theme.xml'),`<?xml version="1.0" encoding="utf-8"?>
<resources>
 <style name="AudifyHomeTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
  <item name="android:windowBackground">#05080C</item>
  <item name="android:statusBarColor">#05080C</item>
  <item name="android:navigationBarColor">#05080C</item>
  <item name="android:windowLightStatusBar">false</item>
  <item name="android:windowLightNavigationBar">false</item>
  <item name="android:windowActionModeOverlay">true</item>
  <item name="colorAccent">#9DFF32</item>
 </style>
 <style name="AudifyStartupTheme" parent="Theme.SplashScreen">
  <item name="windowSplashScreenBackground">#05080C</item>
  <item name="windowSplashScreenAnimatedIcon">@drawable/audify_startup_icon</item>
  <item name="postSplashScreenTheme">@style/AudifyHomeTheme</item>
  <item name="android:statusBarColor">#05080C</item>
  <item name="android:navigationBarColor">#05080C</item>
  <item name="android:windowLightStatusBar">false</item>
  <item name="android:windowLightNavigationBar">false</item>
 </style>
</resources>`);
let gradle=await readFile(path.join(root,'android/app/build.gradle'),'utf8');
gradle=gradle.replace(/versionCode \d+/,'versionCode 681238').replace(/versionName "[^"]+"/,'versionName "68.12.38"');
await writeFile(path.join(root,'android/app/build.gradle'),gradle);
const tests=path.join(root,'android/app/src/test/java/com/nova/audify');await mkdir(tests,{recursive:true});
await copyFile(path.join(root,'startup/tests/AudifyStartupStateTest.java'),path.join(tests,'AudifyStartupStateTest.java'));
await writeFile(path.join(tests,'StartupModelTest.java'),'package com.nova.audify; public class StartupModelTest { @org.junit.Test public void onlyRealReadinessReleasesSplash(){ AudifyStartupStateTest.main(new String[0]); } }');
console.log('Audify 68.12.38: Chroma logo, real readiness barriers and one native Home launcher installed.');
