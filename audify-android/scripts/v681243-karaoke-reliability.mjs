import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');

function findMethod(source,signatures,label){
  for(const signature of signatures){
    const start=source.indexOf(signature);
    if(start<0)continue;
    const brace=source.indexOf('{',start);
    if(brace<0)continue;
    let depth=0;
    for(let i=brace;i<source.length;i++){
      if(source[i]==='{')depth++;
      else if(source[i]==='}'&&--depth===0)return {start,brace,end:i+1};
    }
  }
  throw new Error(`V68.12.43 méthode introuvable: ${label}`);
}

function replaceMethod(source,signatures,replacement,label){
  const method=findMethod(source,signatures,label);
  return source.slice(0,method.start)+replacement+source.slice(method.end);
}

// -----------------------------------------------------------------------------
// 1) The Karaoke button must never silently do nothing when the player activity
//    has stale/missing Intent extras. Read the authoritative Media3 snapshot.
// -----------------------------------------------------------------------------
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
let player=await readFile(playerPath,'utf8');
if(!player.includes('hydrateCurrentTrackV681243')){
  const open=replaceMethod(player,['    private void openKaraoke(){','    private void openKaraoke() {'],`    private void openKaraoke(){
        try{
            if(!hydrateCurrentTrackV681243()){
                Toast.makeText(this,"Aucun morceau actif pour le karaoké",Toast.LENGTH_SHORT).show();
                return;
            }
            AudifyMonetizationManager.get(this).askRewardedKaraoke(this,this::openKaraokeUnlockedV68129);
        }catch(Throwable failure){
            Toast.makeText(this,"Le karaoké est momentanément indisponible",Toast.LENGTH_SHORT).show();
            android.util.Log.e("AudifyKaraoke","ouverture du karaoké impossible",failure);
        }
    }

    private boolean hydrateCurrentTrackV681243(){
        if(currentTrack!=null&&!currentTrack.id.isEmpty())return true;
        try{
            JSONObject state=new JSONObject(AudifyPlaybackService.getStateJson());
            String id=state.optString("videoId","").trim();
            if(id.isEmpty())return false;
            currentTrack=new AudifyLibraryStore.Track(id,state.optString("title","Sans titre"),state.optString("artist","YouTube"),state.optString("thumbnail",""));
            displayedVideoId=id;
            return true;
        }catch(Throwable failure){
            android.util.Log.e("AudifyKaraoke","état du lecteur illisible",failure);
            return false;
        }
    }`,'NativePlayerActivity.openKaraoke');
  player=open;
}
await writeFile(playerPath,player,'utf8');

// -----------------------------------------------------------------------------
// 2) Karaoke activity: isolate every launch/UI failure and recover metadata
//    from the service when an OEM recreates the activity without extras.
// -----------------------------------------------------------------------------
const karaokePath=path.join(pkgDir,'NativeKaraokeActivity.java');
let karaoke=await readFile(karaokePath,'utf8');
if(!karaoke.includes('import android.widget.Toast;'))karaoke=karaoke.replace('import android.widget.TextView;','import android.widget.TextView;\nimport android.widget.Toast;');
if(!karaoke.includes('showKaraokeHardFallbackV681243')){
  const method=findMethod(karaoke,['    @Override protected void onCreate(Bundle state){','    @Override protected void onCreate(Bundle state) {'],'NativeKaraokeActivity.onCreate');
  const body=karaoke.slice(method.brace+1,method.end-1);
  const replacement=`    @Override protected void onCreate(Bundle state){
        try{${body}
        }catch(Throwable karaokeFailure){
            showKaraokeHardFallbackV681243(karaokeFailure);
        }
    }

    private void showKaraokeHardFallbackV681243(Throwable failure){
        try{
            android.util.Log.e("AudifyKaraoke","fatal karaoke launch path",failure);
            LinearLayout fallback=new LinearLayout(this);
            fallback.setOrientation(LinearLayout.VERTICAL);
            fallback.setGravity(Gravity.CENTER);
            fallback.setPadding(dp(24),dp(24),dp(24),dp(24));
            fallback.setBackgroundColor(Color.rgb(5,8,12));
            TextView title=text("Karaoké Audify",25f,true,Color.WHITE);
            title.setGravity(Gravity.CENTER);
            fallback.addView(title,new LinearLayout.LayoutParams(-1,dp(60)));
            TextView detail=text("Le lecteur reste disponible. Les paroles n’ont pas pu être ouvertes sur cet appareil.",15f,false,Color.rgb(180,190,202));
            detail.setGravity(Gravity.CENTER);
            fallback.addView(detail,new LinearLayout.LayoutParams(-1,dp(90)));
            Button back=smallButton("‹ Retour au lecteur");
            back.setOnClickListener(v->finish());
            fallback.addView(back,new LinearLayout.LayoutParams(-1,dp(54)));
            setContentView(fallback);
        }catch(Throwable ignored){finish();}
    }`;
  karaoke=karaoke.slice(0,method.start)+replacement+karaoke.slice(method.end);
}

const metadataNeedle='Intent in=getIntent(); rawTitle=in==null?"":safe(in.getStringExtra("title")); rawArtist=in==null?"":safe(in.getStringExtra("artist")); videoId=in==null?"":safe(in.getStringExtra("videoId")); resolvedMeta=resolveMetadata(rawTitle,rawArtist);';
const metadataReplacement=`Intent in=getIntent(); rawTitle=in==null?"":safe(in.getStringExtra("title")); rawArtist=in==null?"":safe(in.getStringExtra("artist")); videoId=in==null?"":safe(in.getStringExtra("videoId"));
        if(videoId.trim().isEmpty()||rawTitle.trim().isEmpty()||rawArtist.trim().isEmpty()){
            try{
                JSONObject playback=new JSONObject(AudifyPlaybackService.getStateJson());
                if(videoId.trim().isEmpty())videoId=playback.optString("videoId","");
                if(rawTitle.trim().isEmpty())rawTitle=playback.optString("title","");
                if(rawArtist.trim().isEmpty())rawArtist=playback.optString("artist","");
            }catch(Throwable ignored){}
        }
        resolvedMeta=resolveMetadata(rawTitle,rawArtist);`;
if(karaoke.includes(metadataNeedle))karaoke=karaoke.replace(metadataNeedle,metadataReplacement);

// -----------------------------------------------------------------------------
// 3) Network/UI callbacks are lifecycle-safe. A delayed lyrics response must
//    not update a destroyed activity or crash the main thread.
// -----------------------------------------------------------------------------
if(!karaoke.includes('postKaraokeUiV681243')){
  karaoke=replaceMethod(karaoke,['    private void fetchLyrics(){','    private void fetchLyrics() {'],`    private void fetchLyrics(){
        if(statusView==null||lyricsBox==null)return;
        try{statusView.setText("Nettoyage du titre et recherche…");}catch(Throwable ignored){}
        LyricsResult cached=readCache();
        if(cached!=null&&cached.hasLyrics()){
            postKaraokeUiV681243(()->applyLyrics(cached,true));
            return;
        }
        new Thread(()->{
            try{
                double trackDuration=waitForDuration();
                postKaraokeUiV681243(()->statusView.setText("Recherche LRCLIB…"));
                LyricsResult result=resolveFromLrclib(resolvedMeta,trackDuration);
                if(result==null||!result.hasLyrics()){
                    postKaraokeUiV681243(()->statusView.setText("Recherche de secours…"));
                    result=resolveFromLyricsOvh(resolvedMeta);
                }
                if(result!=null&&result.hasLyrics()){
                    writeCache(result);
                    LyricsResult finalResult=result;
                    postKaraokeUiV681243(()->applyLyrics(finalResult,false));
                }else{
                    postKaraokeUiV681243(()->showFailure("Paroles introuvables après plusieurs recherches."));
                }
            }catch(Throwable failure){
                android.util.Log.e("AudifyKaraoke","résolution des paroles échouée",failure);
                postKaraokeUiV681243(()->showFailure("Impossible de récupérer les paroles pour le moment."));
            }
        },"audify-lyrics-resolver").start();
    }

    private void postKaraokeUiV681243(Runnable action){
        if(action==null)return;
        try{runOnUiThread(()->{
            if(isFinishing()||isDestroyed())return;
            try{action.run();}catch(Throwable failure){android.util.Log.e("AudifyKaraoke","mise à jour UI paroles échouée",failure);}
        });}catch(Throwable ignored){}
    }`,'NativeKaraokeActivity.fetchLyrics');
}

karaoke=karaoke.replace(
  'toggle.setOnClickListener(v->{startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_TOGGLE));handler.postDelayed(this::refresh,70);});',
  'toggle.setOnClickListener(v->{try{startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_TOGGLE));}catch(Throwable failure){android.util.Log.e("AudifyKaraoke","commande lecture impossible",failure);Toast.makeText(this,"Le lecteur audio est momentanément indisponible",Toast.LENGTH_SHORT).show();}handler.postDelayed(this::refresh,70);});'
);

// Accept both common LRC fractional separators (dot and colon).
karaoke=karaoke.replace('Pattern.compile("\\\\[(\\\\d{1,2}):(\\\\d{2})(?:\\\\.(\\\\d{1,3}))?\\\\]\\\\s*(.*)")','Pattern.compile("\\\\[(\\\\d{1,2}):(\\\\d{2})(?:[\\\\.:](\\\\d{1,3}))?\\\\]\\\\s*(.*)")');
await writeFile(karaokePath,karaoke,'utf8');

let gradle=await readFile(path.join(root,'android','app','build.gradle'),'utf8');
gradle=gradle.replace(/versionCode \d+/,'versionCode 681243').replace(/versionName "[^"]+"/,'versionName "68.12.43"');
await writeFile(path.join(root,'android','app','build.gradle'),gradle,'utf8');
console.log('Audify V68.12.43 : karaoké fiabilisé sans modifier le moteur stable.');
