import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
const loginPath=path.join(pkgDir,'AudifyLoginActivity.java');
const profileMediaPath=path.join(pkgDir,'AudifyProfileMedia.java');
const applicationPath=path.join(pkgDir,'AudifyApplication.java');
const monetizationPath=path.join(pkgDir,'AudifyMonetizationManager.java');

function findMethod(source,signatures,label){
  for(const signature of signatures){
    const start=source.indexOf(signature);
    if(start<0)continue;
    const brace=source.indexOf('{',start);
    if(brace<0)continue;
    let depth=0,end=-1;
    for(let i=brace;i<source.length;i++){
      if(source[i]==='{')depth++;
      else if(source[i]==='}'){
        depth--;
        if(depth===0){end=i+1;break;}
      }
    }
    if(end>0)return {start,brace,end};
  }
  throw new Error(`V68.12.34 méthode introuvable: ${label}`);
}
function replaceMethod(source,signatures,replacement,label){
  const f=findMethod(source,signatures,label);
  return source.slice(0,f.start)+replacement+source.slice(f.end);
}

// =============================================================================
// 1) PROFILE MEDIA SHIELD
//    - aucun GIF historique non normalisé n'est décodé au démarrage ;
//    - tout GIF nouvellement choisi est réencodé en petit avatar mobile ;
//    - les images sont décodées avec une taille mémoire bornée ;
//    - les OutOfMemoryError sont absorbées et le badge Audify reste visible.
// =============================================================================
const profileMedia=String.raw`package com.nova.audify;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.graphics.drawable.Animatable;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.view.Gravity;
import android.view.View;

import java.io.File;
import java.io.FileOutputStream;

/** Audify V68.12.34 — décodage d'avatar borné et fail-safe. */
public final class AudifyProfileMedia {
    private static final long MAX_SAFE_GIF_BYTES=10L*1024L*1024L;
    private static final long MAX_SAFE_JPG_BYTES=5L*1024L*1024L;
    private AudifyProfileMedia(){}

    public static boolean isGif(File file){
        return file!=null&&file.isFile()&&file.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".gif");
    }

    private static File safeMarker(File file){
        return file==null?null:new File(file.getAbsolutePath()+".v681234.safe");
    }

    public static boolean markSafe(File file){
        if(file==null||!file.isFile())return false;
        File marker=safeMarker(file);
        try(FileOutputStream out=new FileOutputStream(marker,false)){
            out.write("AUDIFY_PROFILE_SAFE_V681234".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            out.flush();
            return true;
        }catch(Throwable ignored){return false;}
    }

    public static void clearSafe(File file){
        try{File marker=safeMarker(file);if(marker!=null&&marker.exists())marker.delete();}catch(Throwable ignored){}
    }

    public static boolean isSafeForDecode(File file){
        if(file==null||!file.isFile()||file.length()<=0L)return false;
        if(isGif(file)){
            File marker=safeMarker(file);
            return file.length()<=MAX_SAFE_GIF_BYTES&&marker!=null&&marker.isFile();
        }
        return file.length()<=MAX_SAFE_JPG_BYTES;
    }

    public static boolean apply(Context context,View view,File file){
        if(context==null||view==null||!isSafeForDecode(file))return false;
        try{
            Drawable drawable=isGif(file)?decodeGif(context,file):decodeStill(context,file);
            if(drawable==null)return false;
            view.setForeground(drawable);
            view.setForegroundGravity(Gravity.FILL);
            view.setClipToOutline(true);
            if(drawable instanceof Animatable)((Animatable)drawable).start();
            return true;
        }catch(OutOfMemoryError memory){
            try{view.setForeground(null);}catch(Throwable ignored){}
            return false;
        }catch(Throwable ignored){
            return false;
        }
    }

    private static Drawable decodeStill(Context context,File file){
        try{
            BitmapFactory.Options bounds=new BitmapFactory.Options();
            bounds.inJustDecodeBounds=true;
            BitmapFactory.decodeFile(file.getAbsolutePath(),bounds);
            if(bounds.outWidth<=0||bounds.outHeight<=0)return null;
            int sample=1;
            int largest=Math.max(bounds.outWidth,bounds.outHeight);
            while(largest/sample>512)sample*=2;
            BitmapFactory.Options opts=new BitmapFactory.Options();
            opts.inSampleSize=Math.max(1,sample);
            opts.inPreferredConfig=Bitmap.Config.ARGB_8888;
            Bitmap bitmap=BitmapFactory.decodeFile(file.getAbsolutePath(),opts);
            return bitmap==null?null:new BitmapDrawable(context.getResources(),bitmap);
        }catch(Throwable ignored){return null;}
    }

    private static Drawable decodeGif(Context context,File file)throws Exception{
        if(Build.VERSION.SDK_INT<28)return decodeStill(context,file);
        return decodeGifApi28(file);
    }

    @android.annotation.TargetApi(28)
    private static Drawable decodeGifApi28(File file)throws Exception{
        ImageDecoder.Source source=ImageDecoder.createSource(file);
        return ImageDecoder.decodeDrawable(source,(decoder,info,src)->{
            decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
            decoder.setMemorySizePolicy(ImageDecoder.MEMORY_POLICY_LOW_RAM);
            int w=Math.max(1,info.getSize().getWidth());
            int h=Math.max(1,info.getSize().getHeight());
            int max=Math.max(w,h);
            if(max>256){
                float scale=256f/max;
                decoder.setTargetSize(Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale)));
            }
        });
    }
}
`;
await writeFile(profileMediaPath,profileMedia,'utf8');

let login=await readFile(loginPath,'utf8');

// Tous les GIF, même <10 Mo, passent désormais par l'optimiseur mobile.
login=replaceMethod(login,[
  '    private boolean saveGifProfileV681228(android.net.Uri uri){',
  '    private boolean saveGifProfileV681228(android.net.Uri uri) {'
],String.raw`    private boolean saveGifProfileV681228(android.net.Uri uri){
        final long sourceLimit=50L*1024L*1024L;
        java.io.File target=profilePhotoGifFileV681228();
        java.io.File jpg=profilePhotoJpgFileV681228();
        java.io.File sourceTemp=new java.io.File(getFilesDir(),target.getName()+".source.tmp");
        long total=0L;
        v681229ProfileMessage="";
        AudifyProfileMedia.clearSafe(target);
        try(java.io.InputStream in=getContentResolver().openInputStream(uri);
            java.io.FileOutputStream out=new java.io.FileOutputStream(sourceTemp,false)){
            if(in==null)return false;
            byte[] buffer=new byte[16384];int n;
            while((n=in.read(buffer))>0){
                total+=n;
                if(total>sourceLimit){
                    sourceTemp.delete();
                    v681229ProfileMessage="GIF trop volumineux : limite 50 Mo avant optimisation.";
                    return false;
                }
                out.write(buffer,0,n);
            }
            out.flush();
        }catch(Throwable e){sourceTemp.delete();return false;}
        if(total<=0L){sourceTemp.delete();return false;}

        // Toujours normaliser : 256 px, 8 i/s, 10 s max puis secours 192 px.
        boolean ok=optimizeLargeGifV681229(sourceTemp,target);
        sourceTemp.delete();
        if(ok){
            if(jpg.exists())jpg.delete();
            target.setLastModified(System.currentTimeMillis());
            AudifyProfileMedia.markSafe(target);
            v681229ProfileMessage="GIF optimisé et sécurisé pour Audify.";
            return true;
        }
        if(target.exists())target.delete();
        AudifyProfileMedia.clearSafe(target);
        v681229ProfileMessage="Impossible de sécuriser ce GIF. Essaie une autre animation.";
        return false;
    }`,'saveGifProfileV681228');

// Nettoyage du marqueur de sécurité avec la suppression de l'avatar.
login=replaceMethod(login,[
  '    private void deleteProfilePhotoV681226(){',
  '    private void deleteProfilePhotoV681226() {'
],String.raw`    private void deleteProfilePhotoV681226(){
        java.io.File jpg=profilePhotoJpgFileV681228();
        java.io.File gif=profilePhotoGifFileV681228();
        AudifyProfileMedia.clearSafe(jpg);
        AudifyProfileMedia.clearSafe(gif);
        boolean ok=true;
        if(jpg.exists()&&!jpg.delete())ok=false;
        if(gif.exists()&&!gif.delete())ok=false;
        if(!ok){
            android.widget.Toast.makeText(this,"Impossible de supprimer l'avatar.",android.widget.Toast.LENGTH_SHORT).show();
            return;
        }
        android.widget.Toast.makeText(this,"Photo de profil supprimée.",android.widget.Toast.LENGTH_SHORT).show();
        renderProfile();
    }`,'deleteProfilePhotoV681226');

// Ne jamais vider visuellement l'avatar si un ancien GIF n'est pas encore sûr.
const unsafeProfileBlock=String.raw`        if(hasProfilePhotoV681226){
            avatar.setText("");
            if(AudifyProfileMedia.apply(this,avatar,profilePhotoV681226)){
                avatar.setContentDescription(AudifyProfileMedia.isGif(profilePhotoV681226)?"Changer mon GIF de profil Audify":"Changer ma photo de profil Audify");
            }
        }else{
            avatar.setContentDescription("Ajouter une photo ou un GIF de profil Audify");
        }`;
const safeProfileBlock=String.raw`        if(hasProfilePhotoV681226){
            if(AudifyProfileMedia.apply(this,avatar,profilePhotoV681226)){
                avatar.setText("");
                avatar.setContentDescription(AudifyProfileMedia.isGif(profilePhotoV681226)?"Changer mon GIF de profil Audify":"Changer ma photo de profil Audify");
            }else{
                avatar.setContentDescription("Avatar protégé · sélectionne de nouveau ce GIF pour l'optimiser");
            }
        }else{
            avatar.setContentDescription("Ajouter une photo ou un GIF de profil Audify");
        }`;
if(login.includes(unsafeProfileBlock))login=login.replace(unsafeProfileBlock,safeProfileBlock);
await writeFile(loginPath,login,'utf8');

// =============================================================================
// 2) HOME STARTUP SHIELD
//    Le Home construit d'abord l'UI et le badge Audify. Le média de profil n'est
//    appliqué qu'après le premier rendu, et uniquement s'il passe le garde-fou.
// =============================================================================
let home=await readFile(homePath,'utf8');
const homeClass='public class NativeHomeActivity extends AppCompatActivity {';
if(!home.includes(homeClass))throw new Error('V68.12.34 classe Home introuvable');
if(!home.includes('private boolean v681234RefreshScheduled=false;')){
  home=home.replace(homeClass,homeClass+'\n    private boolean v681234RefreshScheduled=false;');
}

home=replaceMethod(home,[
  '    private LinearLayout buildStickySearchHeader(){',
  '    private LinearLayout buildStickySearchHeader() {'
],String.raw`    private LinearLayout buildStickySearchHeader(){
        LinearLayout outer=new LinearLayout(this);
        outer.setGravity(Gravity.CENTER_VERTICAL);
        outer.setPadding(0,0,0,0);

        LinearLayout searchShell=new LinearLayout(this);
        searchShell.setGravity(Gravity.CENTER_VERTICAL);
        searchShell.setPadding(dp(12),dp(5),dp(7),dp(5));
        searchShell.setBackground(round(Color.rgb(25,30,38),dp(1),Color.rgb(79,88,101),dp(34)));

        TextView hint=text("⌕  Rechercher un artiste ou un titre…",15.5f,false);
        hint.setTextColor(Color.rgb(151,159,173));
        hint.setMaxLines(1);
        hint.setEllipsize(TextUtils.TruncateAt.END);
        hint.setOnClickListener(v->openSearch());
        searchShell.addView(hint,new LinearLayout.LayoutParams(0,dp(58),1f));

        Button search=greenButton("Rechercher");
        search.setTextSize(14.5f);
        search.setOnClickListener(v->openSearch());
        LinearLayout.LayoutParams searchLp=new LinearLayout.LayoutParams(dp(118),dp(52));
        searchLp.leftMargin=dp(5);
        searchShell.addView(search,searchLp);
        outer.addView(searchShell,new LinearLayout.LayoutParams(0,dp(64),1f));

        AudifyAccountStore account=new AudifyAccountStore(this);
        final boolean signedIn=account.isSignedIn();
        Button avatar=new Button(this);
        avatar.setText("");
        avatar.setAllCaps(false);
        avatar.setGravity(Gravity.CENTER);
        avatar.setPadding(0,0,0,0);
        avatar.setMinWidth(0);
        avatar.setMinHeight(0);
        avatar.setContentDescription(signedIn?"Ouvrir mon compte Audify":"Se connecter à Audify");

        if(signedIn){
            // Fallback immédiat : zéro décodage média pendant la création du Home.
            avatar.setBackground(round(Color.rgb(137,255,48),0,Color.TRANSPARENT,dp(29)));
            android.graphics.drawable.Drawable audifyAvatar=getResources().getDrawable(R.drawable.audify_ic_a_musical,getTheme());
            if(audifyAvatar!=null){
                audifyAvatar=audifyAvatar.mutate();
                audifyAvatar.setTint(Color.WHITE);
                avatar.setForeground(audifyAvatar);
                avatar.setForegroundGravity(Gravity.CENTER);
            }
            avatar.setElevation(dp(7));

            final java.io.File localProfileV681234=profilePhotoFileV681226();
            if(localProfileV681234.isFile()){
                avatar.postDelayed(()->{
                    if(isFinishing()||isDestroyed())return;
                    if(AudifyProfileMedia.apply(this,avatar,localProfileV681234)){
                        avatar.setContentDescription(AudifyProfileMedia.isGif(localProfileV681234)
                            ?"Ouvrir mon compte Audify · GIF optimisé"
                            :"Ouvrir mon compte Audify · photo personnalisée");
                    }
                },550L);
            }
        }else{
            avatar.setBackground(round(Color.argb(214,22,28,36),dp(1),Color.rgb(88,101,116),dp(29)));
            android.graphics.drawable.Drawable profileIcon=getResources().getDrawable(R.drawable.audify_ic_profile,getTheme());
            if(profileIcon!=null){
                profileIcon=profileIcon.mutate();
                profileIcon.setTint(Color.WHITE);
                avatar.setForeground(profileIcon);
                avatar.setForegroundGravity(Gravity.CENTER);
            }
            avatar.setElevation(dp(5));
        }

        avatar.setOnClickListener(v->{
            avatar.animate().scaleX(0.92f).scaleY(0.92f).setDuration(70L)
                .withEndAction(()->avatar.animate().scaleX(1f).scaleY(1f).setDuration(120L).start()).start();
            startActivity(new Intent(this,AudifyLoginActivity.class));
        });

        LinearLayout.LayoutParams avatarLp=new LinearLayout.LayoutParams(dp(56),dp(56));
        avatarLp.leftMargin=dp(10);
        outer.addView(avatar,avatarLp);
        return outer;
    }`,'buildStickySearchHeader');

// Un seul onResume final : super() toujours premier, détection session + avatar,
// recréation différée au maximum une fois, puis ticker normal.
home=replaceMethod(home,[
  '    @Override protected void onResume(){',
  '    @Override protected void onResume() {'
],String.raw`    @Override protected void onResume(){
        super.onResume();

        boolean nowSignedInV681234=new AudifyAccountStore(this).isSignedIn();
        long nowProfileStampV681234=profilePhotoStampV681226();
        boolean changedV681234=nowSignedInV681234!=v681224AccountState||nowProfileStampV681234!=v681226ProfilePhotoStamp;
        v681224AccountState=nowSignedInV681234;
        v681226ProfilePhotoStamp=nowProfileStampV681234;

        if(changedV681234&&!v681234RefreshScheduled){
            v681234RefreshScheduled=true;
            android.view.View decor=getWindow()==null?null:getWindow().getDecorView();
            if(decor!=null){
                decor.post(()->{
                    if(!isFinishing()&&!isDestroyed())recreate();
                });
            }
            return;
        }

        rebuildLibrary();
        handler.removeCallbacks(ticker);
        handler.post(ticker);
    }`,'onResume');
await writeFile(homePath,home,'utf8');

// =============================================================================
// 3) ADMOB OFF POUR V68.12.34
//    On garde les classes/dépendances pour ne pas casser la chaîne historique,
//    mais aucun initialize/load/show AdMob n'est exécuté dans cette version.
//    Google Play Billing Premium reste indépendant et actif.
// =============================================================================
let application=await readFile(applicationPath,'utf8');
application=replaceMethod(application,[
  '    public void onCreate() {',
  '    public void onCreate(){'
],String.raw`    public void onCreate() {
        super.onCreate();
        processStartedAt = android.os.SystemClock.elapsedRealtime();
        launchOpportunityConsumed = true;
        // V68.12.34 : AdMob entièrement désactivé. Le garde réseau reste actif.
        try { AudifyNetworkGuard.install(this); } catch (Throwable ignored) {}
    }`,'AudifyApplication.onCreate');
await writeFile(applicationPath,application,'utf8');

let monetization=await readFile(monetizationPath,'utf8');
monetization=monetization.replace(
  '        initBilling();\n        preloadSearchInterstitial();',
  '        initBilling();\n        // V68.12.34 : AdMob désactivé temporairement.'
);
monetization=replaceMethod(monetization,[
  '    public void showSearchInterstitial(Activity activity,Runnable after){',
  '    public void showSearchInterstitial(Activity activity, Runnable after){'
],String.raw`    public void showSearchInterstitial(Activity activity,Runnable after){
        runSearchAfter(activity,after);
    }`,'showSearchInterstitial');
monetization=replaceMethod(monetization,[
  '    private void preloadSearchInterstitial(){',
  '    private void preloadSearchInterstitial() {'
],String.raw`    private void preloadSearchInterstitial(){
        // AdMob OFF V68.12.34.
    }`,'preloadSearchInterstitial');
monetization=replaceMethod(monetization,[
  '    public void askRewardedPlaylist(Activity activity,Runnable reward){',
  '    public void askRewardedPlaylist(Activity activity, Runnable reward){'
],String.raw`    public void askRewardedPlaylist(Activity activity,Runnable reward){
        if(activity!=null&&reward!=null)reward.run();
    }`,'askRewardedPlaylist');
monetization=replaceMethod(monetization,[
  '    private void loadRewarded(Activity activity,String id,Runnable reward){',
  '    private void loadRewarded(Activity activity, String id, Runnable reward){'
],String.raw`    private void loadRewarded(Activity activity,String id,Runnable reward){
        if(activity!=null&&reward!=null)reward.run();
    }`,'loadRewarded');
monetization=replaceMethod(monetization,[
  '    public void insertNativeSearchAd(Activity activity,LinearLayout parent){',
  '    public void insertNativeSearchAd(Activity activity, LinearLayout parent){'
],String.raw`    public void insertNativeSearchAd(Activity activity,LinearLayout parent){
        // AdMob OFF V68.12.34 : aucune annonce native chargée.
    }`,'insertNativeSearchAd');
await writeFile(monetizationPath,monetization,'utf8');

console.log('Audify Android V68.12.34 : Startup Shield actif, GIF bornés/différés, onResume unifié, AdMob totalement désactivé pour cette version.');
