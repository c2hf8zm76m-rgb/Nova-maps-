import { copyFile, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');
const resDir=path.join(android,'app','src','main','res');
const brandingDir=path.join(root,'branding');

function replaceRequired(source,needle,replacement,label){
  if(!source.includes(needle)) throw new Error(`V68.10.2 introuvable: ${label}`);
  return source.replace(needle,replacement);
}

// =============================================================================
// 1) ARTWORK SWIPE 2.0 — suivi direct, preview, inertie, rebond et haptique.
// =============================================================================
let service=await readFile(servicePath,'utf8');
if(!service.includes('public static String getNeighborJson(int delta)')){
  const stateMarker='    public static String getStateJson() {';
  if(!service.includes(stateMarker)) throw new Error('V68.10.2 getStateJson service introuvable');
  const neighbor=String.raw`    public static String getNeighborJson(int delta) {
        JSONObject out=new JSONObject();
        AudifyPlaybackService s=instance;
        try{
            if(s==null||s.player==null||delta==0) return out.toString();
            int index=s.player.getCurrentMediaItemIndex()+delta;
            if(index<0||index>=s.queueSpec.size()) return out.toString();
            Track t=s.queueSpec.get(index);
            out.put("videoId",t.id);
            out.put("title",t.title);
            out.put("artist",t.artist);
            out.put("thumbnail",t.thumbnail);
            out.put("index",index);
        }catch(Throwable ignored){}
        return out.toString();
    }

`;
  service=service.replace(stateMarker,neighbor+stateMarker);
}
await writeFile(servicePath,service,'utf8');

let player=await readFile(playerPath,'utf8');

if(!player.includes('private ImageView artworkPreview;')){
  player=player.replace('    private ImageView coverImage;','    private ImageView coverImage;\n    private ImageView artworkPreview;');
}
if(!player.includes('private boolean artworkTransitioning = false;')){
  player=player.replace(
    '    private boolean artworkSwiping = false;',
    '    private boolean artworkSwiping = false;\n    private boolean artworkTransitioning = false;\n    private boolean artworkThresholdHaptic = false;\n    private long artworkTouchStartTime = 0L;\n    private String artworkPreviewId = "";\n    private String artworkPreviewTitle = "";\n    private String artworkPreviewArtist = "";\n    private String artworkPreviewThumbnail = "";\n    private int artworkPreviewDelta = 0;'
  );
}

const stageMarker='        artworkStage.addView(audioWavesView,wavesLp);\n\n        FrameLayout artwork=new FrameLayout(this);';
if(!player.includes(stageMarker)) throw new Error('V68.10.2 artworkStage introuvable');
player=player.replace(stageMarker,String.raw`        artworkStage.addView(audioWavesView,wavesLp);

        artworkPreview=new ImageView(this);
        artworkPreview.setScaleType(ImageView.ScaleType.CENTER_CROP);
        artworkPreview.setBackgroundColor(Color.rgb(18,23,31));
        artworkPreview.setClipToOutline(true);
        artworkPreview.setOutlineProvider(new ViewOutlineProvider(){
            @Override public void getOutline(View view,Outline outline){
                outline.setRoundRect(0,0,view.getWidth(),view.getHeight(),dp(27));
            }
        });
        artworkPreview.setAlpha(0f);
        artworkPreview.setScaleX(0.90f);
        artworkPreview.setScaleY(0.90f);
        artworkPreview.setVisibility(View.INVISIBLE);
        artworkStage.addView(artworkPreview,new FrameLayout.LayoutParams(artworkSize,artworkSize,Gravity.CENTER));

        FrameLayout artwork=new FrameLayout(this);`);

const swipeStart=player.indexOf('        artwork.setClickable(true);');
const artLpStart=player.indexOf('        LinearLayout.LayoutParams artLp=',swipeStart);
if(swipeStart<0||artLpStart<0) throw new Error('V68.10.2 bloc swipe artwork introuvable');
const swipe2=String.raw`        artwork.setClickable(true);
        artwork.setOnTouchListener((view,event)->{
            if(artworkTransitioning) return true;
            switch(event.getActionMasked()){
                case MotionEvent.ACTION_DOWN:
                    artworkTouchStartX=event.getRawX();
                    artworkTouchStartY=event.getRawY();
                    artworkTouchStartTime=event.getEventTime();
                    artworkSwiping=true;
                    artworkThresholdHaptic=false;
                    view.animate().cancel();
                    if(artworkPreview!=null) artworkPreview.animate().cancel();
                    return true;

                case MotionEvent.ACTION_MOVE:
                    if(!artworkSwiping) return true;
                    float liveDx=event.getRawX()-artworkTouchStartX;
                    float liveDy=event.getRawY()-artworkTouchStartY;
                    if(Math.abs(liveDy)>Math.abs(liveDx)*1.35f && Math.abs(liveDy)>dp(18)){
                        return true;
                    }
                    if(Math.abs(liveDx)<dp(3)) return true;

                    int delta=liveDx>0?1:-1; // Convention Audify : droite = suivant, gauche = précédent.
                    boolean available=prepareArtworkPreview(delta);
                    float width=Math.max(dp(240),view.getWidth());
                    float progress=Math.min(1f,Math.abs(liveDx)/(width*0.30f));
                    float move=liveDx*(available?0.86f:0.18f);

                    view.setTranslationX(move);
                    view.setRotation(Math.max(-4.2f,Math.min(4.2f,move/width*5.3f)));
                    float scale=1f-(available?0.055f:0.018f)*progress;
                    view.setScaleX(scale); view.setScaleY(scale);
                    view.setAlpha(1f-(available?0.16f:0.04f)*progress);
                    if(disc!=null) disc.setTranslationX(-liveDx*(available?0.075f:0.025f));

                    if(available && artworkPreview!=null){
                        float sign=delta>0?1f:-1f;
                        artworkPreview.setVisibility(View.VISIBLE);
                        artworkPreview.setAlpha(0.18f+0.82f*progress);
                        artworkPreview.setScaleX(0.90f+0.10f*progress);
                        artworkPreview.setScaleY(0.90f+0.10f*progress);
                        artworkPreview.setTranslationX(-sign*width*0.34f*(1f-progress));
                    }

                    boolean crossed=available && Math.abs(liveDx)>=width*0.24f;
                    if(crossed&&!artworkThresholdHaptic){
                        artworkThresholdHaptic=true;
                        view.performHapticFeedback(android.view.HapticFeedbackConstants.CLOCK_TICK);
                    }else if(!crossed){
                        artworkThresholdHaptic=false;
                    }
                    return true;

                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    if(!artworkSwiping) return true;
                    artworkSwiping=false;
                    float dx=event.getRawX()-artworkTouchStartX;
                    float dy=event.getRawY()-artworkTouchStartY;
                    long elapsed=Math.max(1L,event.getEventTime()-artworkTouchStartTime);
                    float velocityX=dx/(float)elapsed;
                    int delta=dx>0?1:-1;
                    boolean available=prepareArtworkPreview(delta);
                    float width=Math.max(dp(240),view.getWidth());
                    boolean horizontal=Math.abs(dx)>Math.abs(dy)*1.15f;
                    boolean distanceCommit=Math.abs(dx)>=width*0.24f;
                    boolean flingCommit=Math.abs(dx)>=dp(32)&&Math.abs(velocityX)>=0.85f;
                    boolean commit=event.getActionMasked()==MotionEvent.ACTION_UP && available && horizontal && (distanceCommit||flingCommit);

                    if(!commit){
                        view.animate().cancel();
                        view.animate().translationX(0f).rotation(0f).scaleX(1f).scaleY(1f).alpha(1f)
                            .setDuration(250L)
                            .setInterpolator(new android.view.animation.OvershootInterpolator(0.72f)).start();
                        if(disc!=null) disc.animate().translationX(0f).setDuration(220L).start();
                        hideArtworkPreview(210L);
                        return true;
                    }

                    artworkTransitioning=true;
                    view.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS);
                    float sign=delta>0?1f:-1f;
                    int screenWidth=getResources().getDisplayMetrics().widthPixels;
                    if(artworkPreview!=null){
                        artworkPreview.setVisibility(View.VISIBLE);
                        artworkPreview.animate().cancel();
                        artworkPreview.animate().translationX(0f).scaleX(1f).scaleY(1f).alpha(1f)
                            .setDuration(185L).setInterpolator(new android.view.animation.DecelerateInterpolator()).start();
                    }
                    if(disc!=null) disc.animate().translationX(-sign*dp(12)).setDuration(150L).start();
                    view.animate().translationX(sign*screenWidth*0.92f).rotation(sign*5.5f)
                        .scaleX(0.92f).scaleY(0.92f).alpha(0.08f)
                        .setDuration(190L).setInterpolator(new android.view.animation.AccelerateInterpolator())
                        .withEndAction(()->{
                            startPlayerAction(delta>0?AudifyPlaybackService.ACTION_NEXT:AudifyPlaybackService.ACTION_PREVIOUS);
                            uiHandler.postDelayed(this::refreshFromPlayer,85L);
                            view.setTranslationX(-sign*Math.min(screenWidth*0.34f,dp(170)));
                            view.setRotation(-sign*2.8f);
                            view.setScaleX(0.96f); view.setScaleY(0.96f); view.setAlpha(0f);
                            if(disc!=null) disc.setTranslationX(0f);
                            uiHandler.postDelayed(()->{
                                refreshFromPlayer();
                                view.animate().translationX(0f).rotation(0f).scaleX(1f).scaleY(1f).alpha(1f)
                                    .setDuration(270L)
                                    .setInterpolator(new android.view.animation.OvershootInterpolator(0.52f)).start();
                                hideArtworkPreview(230L);
                                uiHandler.postDelayed(()->artworkTransitioning=false,285L);
                            },245L);
                        }).start();
                    return true;
            }
            return true;
        });

`;
player=player.slice(0,swipeStart)+swipe2+player.slice(artLpStart);

const helperMarker='    private LinearLayout.LayoutParams weighted() {';
if(!player.includes(helperMarker)) throw new Error('V68.10.2 helper player introuvable');
const helpers=String.raw`    private boolean prepareArtworkPreview(int delta){
        if(artworkPreview==null||delta==0) return false;
        try{
            JSONObject o=new JSONObject(AudifyPlaybackService.getNeighborJson(delta));
            String id=o.optString("videoId","");
            if(id.isEmpty()){
                artworkPreview.setVisibility(View.INVISIBLE);
                artworkPreview.setAlpha(0f);
                artworkPreviewId="";
                artworkPreviewDelta=0;
                return false;
            }
            if(!id.equals(artworkPreviewId)||delta!=artworkPreviewDelta){
                artworkPreviewId=id;
                artworkPreviewDelta=delta;
                artworkPreviewTitle=o.optString("title","Sans titre");
                artworkPreviewArtist=o.optString("artist","YouTube");
                artworkPreviewThumbnail=o.optString("thumbnail","");
                artworkPreview.setImageDrawable(null);
                loadPreviewArtwork(artworkPreviewThumbnail,artworkPreviewId);
            }
            return true;
        }catch(Throwable ignored){ return false; }
    }

    private void loadPreviewArtwork(String rawUrl,String videoId){
        final String imageUrl=rawUrl!=null&&!rawUrl.trim().isEmpty()
            ? rawUrl.trim()
            : (videoId==null||videoId.isEmpty()?"":"https://i.ytimg.com/vi/"+videoId+"/hqdefault.jpg");
        if(imageUrl.isEmpty()||artworkPreview==null) return;
        final String expectedId=videoId==null?"":videoId;
        new Thread(()->{
            HttpURLConnection connection=null;
            try{
                connection=(HttpURLConnection)new URL(imageUrl).openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent","AudifyAndroid/68.10.2");
                try(InputStream input=connection.getInputStream()){
                    Bitmap bitmap=BitmapFactory.decodeStream(input);
                    if(bitmap!=null) runOnUiThread(()->{
                        if(artworkPreview!=null&&expectedId.equals(artworkPreviewId)) artworkPreview.setImageBitmap(bitmap);
                    });
                }
            }catch(Throwable ignored){}finally{ if(connection!=null) connection.disconnect(); }
        },"audify-artwork-preview").start();
    }

    private void hideArtworkPreview(long duration){
        if(artworkPreview==null) return;
        artworkPreview.animate().cancel();
        artworkPreview.animate().alpha(0f).scaleX(0.90f).scaleY(0.90f).setDuration(Math.max(80L,duration))
            .withEndAction(()->{
                if(artworkPreview==null) return;
                artworkPreview.setVisibility(View.INVISIBLE);
                artworkPreview.setTranslationX(0f);
                artworkPreviewId="";
                artworkPreviewDelta=0;
            }).start();
    }

`;
player=player.replace(helperMarker,helpers+helperMarker);
await writeFile(playerPath,player,'utf8');

// =============================================================================
// 2) NOUVELLE ICÔNE AUDIFY — launcher classique + adaptive icon Android 8+.
// =============================================================================
const launcherSource=path.join(brandingDir,'audify_launcher.webp');
const splashSource=path.join(brandingDir,'audify_splash.webp');
const drawableNodpi=path.join(resDir,'drawable-nodpi');
await mkdir(drawableNodpi,{recursive:true});
await copyFile(launcherSource,path.join(drawableNodpi,'audify_launcher.webp'));
await copyFile(splashSource,path.join(drawableNodpi,'audify_splash.webp'));

for(const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']){
  const dir=path.join(resDir,`mipmap-${density}`);
  await mkdir(dir,{recursive:true});
  for(const name of await readdir(dir)){
    if(/^ic_launcher(?:_round)?\./.test(name)){
      try{ await unlink(path.join(dir,name)); }catch{}
    }
  }
  await copyFile(launcherSource,path.join(dir,'ic_launcher.webp'));
  await copyFile(launcherSource,path.join(dir,'ic_launcher_round.webp'));
}

const adaptiveDir=path.join(resDir,'mipmap-anydpi-v26');
await mkdir(adaptiveDir,{recursive:true});
const adaptive=`<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@android:color/white" />\n    <foreground android:drawable="@drawable/audify_launcher" />\n</adaptive-icon>\n`;
await writeFile(path.join(adaptiveDir,'ic_launcher.xml'),adaptive,'utf8');
await writeFile(path.join(adaptiveDir,'ic_launcher_round.xml'),adaptive,'utf8');

// =============================================================================
// 3) SPLASH SCREEN AUDIFY — image validée + transition douce vers l'app.
// =============================================================================
const splashActivity=String.raw`package com.nova.audify;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;

import androidx.appcompat.app.AppCompatActivity;

public class AudifySplashActivity extends AppCompatActivity {
    private final Handler handler=new Handler(Looper.getMainLooper());
    private boolean opened=false;

    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setStatusBarColor(Color.rgb(2,3,8));
        getWindow().setNavigationBarColor(Color.rgb(2,3,8));
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        FrameLayout root=new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(2,3,8));
        ImageView splash=new ImageView(this);
        splash.setImageResource(R.drawable.audify_splash);
        splash.setScaleType(ImageView.ScaleType.CENTER_CROP);
        splash.setAlpha(0f);
        splash.setScaleX(0.985f);
        splash.setScaleY(0.985f);
        root.addView(splash,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        splash.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(430L).start();
        handler.postDelayed(this::openAudify,1120L);
    }

    private void openAudify(){
        if(opened||isFinishing()) return;
        opened=true;
        startActivity(new Intent(this,MainActivity.class));
        overridePendingTransition(android.R.anim.fade_in,android.R.anim.fade_out);
        finish();
    }

    @Override protected void onDestroy(){ handler.removeCallbacksAndMessages(null); super.onDestroy(); }
}
`;
await writeFile(path.join(pkgDir,'AudifySplashActivity.java'),splashActivity,'utf8');

const valuesDir=path.join(resDir,'values');
await mkdir(valuesDir,{recursive:true});
await writeFile(path.join(valuesDir,'audify_splash_theme.xml'),`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="AudifySplashTheme" parent="Theme.AppCompat.DayNight.NoActionBar">\n        <item name="android:windowActionModeOverlay">true</item>\n        <item name="android:windowLightStatusBar">false</item>\n        <item name="android:statusBarColor">#020308</item>\n        <item name="android:navigationBarColor">#020308</item>\n        <item name="android:windowBackground">#020308</item>\n    </style>\n</resources>\n`,'utf8');

const values31=path.join(resDir,'values-v31');
await mkdir(values31,{recursive:true});
await writeFile(path.join(values31,'audify_splash_theme.xml'),`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="AudifySplashTheme" parent="Theme.AppCompat.DayNight.NoActionBar">\n        <item name="android:windowLightStatusBar">false</item>\n        <item name="android:statusBarColor">#020308</item>\n        <item name="android:navigationBarColor">#020308</item>\n        <item name="android:windowBackground">#020308</item>\n        <item name="android:windowSplashScreenBackground">#020308</item>\n        <item name="android:windowSplashScreenAnimatedIcon">@drawable/audify_launcher</item>\n        <item name="android:windowSplashScreenIconBackgroundColor">#020308</item>\n        <item name="android:windowSplashScreenAnimationDuration">260</item>\n    </style>\n</resources>\n`,'utf8');

let manifest=await readFile(manifestPath,'utf8');
manifest=manifest.replace(/android:icon="[^"]+"/,'android:icon="@mipmap/ic_launcher"');
if(/android:roundIcon="[^"]+"/.test(manifest)) manifest=manifest.replace(/android:roundIcon="[^"]+"/,'android:roundIcon="@mipmap/ic_launcher_round"');
else manifest=manifest.replace('<application','<application\n        android:roundIcon="@mipmap/ic_launcher_round"');

const mainName=manifest.indexOf('android:name=".MainActivity"');
if(mainName<0) throw new Error('V68.10.2 MainActivity manifest introuvable');
const activityStart=manifest.lastIndexOf('<activity',mainName);
const activityEndStart=manifest.indexOf('</activity>',mainName);
if(activityStart<0||activityEndStart<0) throw new Error('V68.10.2 bloc MainActivity manifest invalide');
const activityEnd=activityEndStart+'</activity>'.length;
let mainBlock=manifest.slice(activityStart,activityEnd);
mainBlock=mainBlock.replace(/\s*<intent-filter>[\s\S]*?<action\s+android:name="android\.intent\.action\.MAIN"\s*\/>[\s\S]*?<category\s+android:name="android\.intent\.category\.LAUNCHER"\s*\/>[\s\S]*?<\/intent-filter>/,'');
manifest=manifest.slice(0,activityStart)+mainBlock+manifest.slice(activityEnd);

if(!manifest.includes('android:name=".AudifySplashActivity"')){
  manifest=manifest.replace('</application>',`        <activity\n            android:name=".AudifySplashActivity"\n            android:exported="true"\n            android:theme="@style/AudifySplashTheme">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>`);
}
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify Android V68.10.2 : Artwork Swipe 2.0 + nouvelle icône officielle + splash screen appliqués.');
