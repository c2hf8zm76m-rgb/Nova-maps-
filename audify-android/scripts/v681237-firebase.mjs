import {readFile,writeFile,copyFile,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const java=path.join(root,'android/app/src/main/java/com/nova/audify');
const sources=path.join(root,'firebase/src/com/nova/audify');
const replace=(s,from,to)=>{if(!s.includes(from))throw Error(`Firebase patch missing anchor: ${from.slice(0,100)}`);return s.replace(from,to);};
for(const file of await readdir(sources))if(file.endsWith('.java'))await copyFile(path.join(sources,file),path.join(java,file));
await copyFile(path.join(root,'google-services.json'),path.join(root,'android/app/google-services.json'));
let gradle=await readFile(path.join(root,'android/app/build.gradle'),'utf8');
gradle=gradle.replace(/versionCode \d+/,'versionCode 681237').replace(/versionName "[^"]+"/,'versionName "68.12.37"');
if(!gradle.includes('firebase-bom'))gradle=replace(gradle,'dependencies {',`dependencies {
    implementation platform('com.google.firebase:firebase-bom:34.18.0')
    testImplementation 'org.json:json:20240303'
    implementation 'com.google.firebase:firebase-auth'
    implementation 'com.google.firebase:firebase-firestore'
    implementation 'com.google.firebase:firebase-storage'
    implementation 'androidx.credentials:credentials:1.3.0'
    implementation 'androidx.credentials:credentials-play-services-auth:1.3.0'
    implementation 'com.google.android.libraries.identity.googleid:googleid:1.1.1'`);
await writeFile(path.join(root,'android/app/build.gradle'),gradle);
if(!gradle.includes('protobuf-javalite:4.26.1')){
  gradle=replace(gradle,"apply from: 'capacitor.build.gradle'",`// Firebase's protolite-well-known-types still collides with protobuf-javalite >= 4.27.
// Keep the compatible 4.26.1 runtime until the upstream SDKs remove that overlap.
configurations.configureEach {
    resolutionStrategy.force 'com.google.protobuf:protobuf-javalite:4.26.1'
}

apply from: 'capacitor.build.gradle'`);
  await writeFile(path.join(root,'android/app/build.gradle'),gradle);
}
let manifest=await readFile(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
if(!manifest.includes('android:name=".AudifyApplication"'))
  manifest=replace(manifest,'<application','<application android:name=".AudifyApplication"');
manifest=manifest.replace('android:allowBackup="true"','android:allowBackup="false"');
await writeFile(path.join(root,'android/app/src/main/AndroidManifest.xml'),manifest);
let discovery=await readFile(path.join(java,'AudifyDiscoveryAgent.java'),'utf8');
if(!discovery.includes('PREFS+"_"+AudifyFirebaseSync.get(app).scope()'))
  discovery=replace(discovery,'app.getSharedPreferences(PREFS,Context.MODE_PRIVATE)','app.getSharedPreferences(PREFS+"_"+AudifyFirebaseSync.get(app).scope(),Context.MODE_PRIVATE)');
await writeFile(path.join(java,'AudifyDiscoveryAgent.java'),discovery);
let service=await readFile(path.join(java,'AudifyPlaybackService.java'),'utf8');
service=replace(service,'    private static volatile AudifyPlaybackService instance;',`    public static void resetForAccountChange(){
        Runnable reset=()->{
            AudifyPlaybackService s=instance;
            if(s!=null){
                s.queueSpec.clear();s.lastRecentVideoId="";
                if(s.player!=null){s.player.pause();s.player.clearMediaItems();s.player.setRepeatMode(Player.REPEAT_MODE_OFF);}
            }
            snapshotPlaying=false;snapshotLoading=false;snapshotVideoId="";snapshotTitle="";snapshotArtist="";snapshotThumbnail="";
            snapshotPosition=0;snapshotDuration=0;snapshotQueueSize=0;snapshotQueueIndex=-1;snapshotRepeatOne=false;snapshotError="";
        };
        if(android.os.Looper.myLooper()==android.os.Looper.getMainLooper())reset.run();
        else new android.os.Handler(android.os.Looper.getMainLooper()).post(reset);
    }
    private static volatile AudifyPlaybackService instance;`);
await writeFile(path.join(java,'AudifyPlaybackService.java'),service);
for(const [name,refresh] of [['NativeHomeActivity','rebuildLibrary()'],['NativeLikesActivity','rebuild()'],['NativeLibraryActivity','render()'],['NativePlaylistActivity','rebuild()']]){
    let source=await readFile(path.join(java,name+'.java'),'utf8');
    const declaration=new RegExp(`(public (?:final )?class ${name}[^\\{]+\\{)`);
    if(!declaration.test(source))throw Error('Firebase screen anchor missing: '+name);
    source=source.replace(declaration,`$1
    private String firebaseScreenUid=null;
    private boolean firebaseScreenClosing=false;
    private final Runnable firebaseRefresh=()->{
        if(isFinishing()||isDestroyed()||firebaseScreenClosing)return;
        String current=AudifyFirebaseSync.get(this).uid();
        if(firebaseScreenUid!=null&&!current.equals(firebaseScreenUid)){
            firebaseScreenClosing=true;
            ${name==='NativeHomeActivity'?'recreate();':'finish();'}return;
        }
        ${refresh};
    };
    @Override protected void onStart(){super.onStart();if(firebaseScreenUid==null)firebaseScreenUid=AudifyFirebaseSync.get(this).uid();AudifyFirebaseSync.get(this).addListener(firebaseRefresh);firebaseRefresh.run();AudifyFirebaseSync.get(this).retry();}
    @Override protected void onStop(){AudifyFirebaseSync.get(this).removeListener(firebaseRefresh);super.onStop();}
`);
    await writeFile(path.join(java,name+'.java'),source);
}
let main=await readFile(path.join(java,'MainActivity.java'),'utf8');
if(main.includes('@JavascriptInterface public void googleConnect(){runOnUiThread(()->authorizeGoogle(false));}')) main=replace(main,'@JavascriptInterface public void googleConnect(){runOnUiThread(()->authorizeGoogle(false));}', '@JavascriptInterface public void googleConnect(){runOnUiThread(()->startActivity(new Intent(MainActivity.this,AudifyLoginActivity.class)));}');
if(main.includes('@JavascriptInterface public void googleSync(String payload){startGoogleSync(payload);}')) main=replace(main,'@JavascriptInterface public void googleSync(String payload){startGoogleSync(payload);}','@JavascriptInterface public void googleSync(String payload){AudifyFirebaseSync.get(MainActivity.this).retry();}');
if(main.includes('@JavascriptInterface public void googleUpload(String payload,String fileId){uploadGooglePayload(payload,fileId);}')) main=replace(main,'@JavascriptInterface public void googleUpload(String payload,String fileId){uploadGooglePayload(payload,fileId);}','@JavascriptInterface public void googleUpload(String payload,String fileId){googleError("La bibliothèque se synchronise depuis les écrans natifs Audify.");}');
if(main.includes('@JavascriptInterface public String googleStatus(){return googleStatusJson();}')) main=replace(main,'@JavascriptInterface public String googleStatus(){return googleStatusJson();}','@JavascriptInterface public String googleStatus(){return "{\\"connected\\":false}";}');
if(main.includes('@JavascriptInterface public void googleDisconnect(){runOnUiThread(()->disconnectGoogle());}')) main=replace(main,'@JavascriptInterface public void googleDisconnect(){runOnUiThread(()->disconnectGoogle());}','@JavascriptInterface public void googleDisconnect(){runOnUiThread(()->startActivity(new Intent(MainActivity.this,AudifyLoginActivity.class)));}');
await writeFile(path.join(java,'MainActivity.java'),main);
console.log('Audify 68.12.37: Firebase accounts, per-user library and private avatar transport installed.');

const tests=path.join(root,'android/app/src/test/java/com/nova/audify');
await mkdir(tests,{recursive:true});
await copyFile(path.join(root,'firebase/tests/AudifySyncStateTest.java'),path.join(tests,'AudifySyncStateTest.java'));
await writeFile(path.join(tests,'FirebaseModelTest.java'),'package com.nova.audify; public class FirebaseModelTest { @org.junit.Test public void preservesOfflineAndDeletionSemantics() throws Exception { AudifySyncStateTest.main(new String[0]); } }');
