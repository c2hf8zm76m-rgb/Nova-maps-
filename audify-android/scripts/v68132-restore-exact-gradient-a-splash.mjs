import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const resDir=path.join(android,'app','src','main','res');
const splashPath=path.join(pkgDir,'AudifySplashActivity.java');

// V68.13.2 — restore the real Audify V68.13 startup identity.
// Grounded from the original V68.13 APK marker:
// AUDIFY_V6812652_EXACT_GRADIENT_A_SPLASH
// This deliberately replaces the old Pulse Splash (square launcher icon, green rings,
// VOTRE MUSIQUE PREND VIE, equalizer bars), which is forbidden in shipped builds.
const splash=String.raw`package com.nova.audify;

import android.animation.ValueAnimator;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Shader;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

/** Audify exact Gradient-A splash restored from the validated V68.13 behavior. */
public class AudifySplashActivity extends AppCompatActivity {
    private static final int BG=Color.rgb(2,6,10);
    private static final int LIME=Color.rgb(137,255,48);
    private final Handler handler=new Handler(Looper.getMainLooper());
    private boolean opened=false;
    private AudifyGradientMarkView mark;

    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
        if(android.os.Build.VERSION.SDK_INT>=30){
            WindowInsetsController c=getWindow().getInsetsController();
            if(c!=null)c.setSystemBarsAppearance(0,WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        }

        FrameLayout root=new FrameLayout(this);
        root.setBackgroundColor(BG);

        LinearLayout content=new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(24),dp(34),dp(24),dp(30));

        mark=new AudifyGradientMarkView();
        mark.setTag("AUDIFY_V6812652_EXACT_GRADIENT_A_SPLASH");
        mark.setContentDescription("Logo Audify animé");
        content.addView(mark,new LinearLayout.LayoutParams(dp(190),dp(178)));

        TextView loading=new TextView(this);
        loading.setText("Audify prépare votre accueil");
        loading.setTextColor(Color.rgb(218,231,223));
        loading.setTextSize(17f);
        loading.setGravity(Gravity.CENTER);
        loading.setAlpha(0f);
        LinearLayout.LayoutParams loadingLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54));
        loadingLp.topMargin=dp(27);
        content.addView(loading,loadingLp);

        FrameLayout.LayoutParams contentLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT,Gravity.CENTER);
        contentLp.topMargin=-dp(42);
        root.addView(content,contentLp);
        setContentView(root);

        loading.animate().alpha(1f).setStartDelay(180L).setDuration(360L).start();
        mark.start();

        handler.postDelayed(()->{
            if(opened||isFinishing())return;
            content.animate().alpha(0f).setDuration(210L).setInterpolator(new DecelerateInterpolator()).start();
            handler.postDelayed(this::openAudify,190L);
        },2380L);
    }

    private void openAudify(){
        if(opened||isFinishing())return;
        opened=true;
        if(mark!=null)mark.stop();
        Intent i=new Intent(this,NativeHomeActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(i);
        overridePendingTransition(android.R.anim.fade_in,android.R.anim.fade_out);
        finish();
    }

    @Override protected void onDestroy(){
        handler.removeCallbacksAndMessages(null);
        if(mark!=null)mark.stop();
        super.onDestroy();
    }

    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private static float smooth(float x){x=Math.max(0f,Math.min(1f,x));return x*x*(3f-2f*x);}
    private static int mix(int a,int b,float t){
        t=Math.max(0f,Math.min(1f,t));
        int aa=Math.round(Color.alpha(a)+(Color.alpha(b)-Color.alpha(a))*t);
        int rr=Math.round(Color.red(a)+(Color.red(b)-Color.red(a))*t);
        int gg=Math.round(Color.green(a)+(Color.green(b)-Color.green(a))*t);
        int bb=Math.round(Color.blue(a)+(Color.blue(b)-Color.blue(a))*t);
        return Color.argb(aa,rr,gg,bb);
    }

    private final class AudifyGradientMarkView extends View {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path aPath=new Path();
        private ValueAnimator animator;
        private float phase=0f;

        AudifyGradientMarkView(){super(AudifySplashActivity.this);setLayerType(View.LAYER_TYPE_SOFTWARE,null);}

        void start(){
            stop();
            animator=ValueAnimator.ofFloat(0f,1f);
            animator.setDuration(2180L);
            animator.setInterpolator(new DecelerateInterpolator());
            animator.addUpdateListener(a->{phase=(Float)a.getAnimatedValue();invalidate();});
            animator.start();
        }
        void stop(){if(animator!=null){animator.cancel();animator=null;}}
        @Override protected void onDetachedFromWindow(){stop();super.onDetachedFromWindow();}

        @Override protected void onDraw(Canvas canvas){
            super.onDraw(canvas);
            float w=getWidth(),h=getHeight();
            if(w<=0||h<=0)return;

            aPath.reset();
            aPath.moveTo(w*0.16f,h*0.80f);
            aPath.lineTo(w*0.435f,h*0.225f);
            aPath.quadTo(w*0.50f,h*0.105f,w*0.565f,h*0.225f);
            aPath.lineTo(w*0.84f,h*0.80f);

            float reveal=Math.min(1f,phase/0.70f);
            float tint=smooth((phase-0.31f)/0.67f);
            int c1=mix(Color.rgb(198,42,239),LIME,tint*0.18f);
            int c2=mix(Color.rgb(244,72,178),LIME,tint*0.15f);
            int c3=mix(Color.rgb(255,127,112),LIME,tint*0.12f);
            int c4=mix(Color.rgb(255,160,68),LIME,tint*0.10f);
            int c5=mix(Color.rgb(158,174,183),LIME,tint*0.22f);

            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeJoin(Paint.Join.ROUND);
            paint.setStrokeWidth(Math.min(w,h)*0.135f);
            paint.setShader(new LinearGradient(w*0.10f,0f,w*1.48f,h,new int[]{c1,c2,c3,c4,c5},new float[]{0f,0.24f,0.48f,0.74f,1f},Shader.TileMode.CLAMP));
            paint.setShadowLayer(dp(8),0,dp(3),Color.argb(56,0,0,0));

            canvas.save();
            canvas.clipRect(0,0,w*reveal,h);
            canvas.drawPath(aPath,paint);
            canvas.restore();
            paint.clearShadowLayer();
            paint.setShader(null);

            // Animated inner waveform that belongs to the original Gradient-A mark.
            float barsReveal=smooth((phase-0.04f)/0.24f);
            float settle=smooth((phase-0.72f)/0.05f);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeWidth(Math.min(w,h)*0.026f);
            paint.setColor(mix(Color.rgb(255,143,87),LIME,settle));
            int count=7;
            float span=w*0.245f;
            float left=w*0.3775f;
            float centerY=h*0.62f;
            for(int i=0;i<count;i++){
                float local=i/(float)(count-1);
                float wave=0.50f+0.50f*(float)Math.sin((phase*7.0f)+(i*0.88f));
                float max=h*(0.12f+0.12f*(1f-Math.abs(local-0.5f)*2f));
                float bh=max*(0.45f+0.55f*wave)*barsReveal;
                float x=left+span*local;
                canvas.drawLine(x,centerY-bh*0.5f,x,centerY+bh*0.5f,paint);
            }
        }
    }
}
`;

await writeFile(splashPath,splash,'utf8');

const valuesDir=path.join(resDir,'values');
const values31Dir=path.join(resDir,'values-v31');
await mkdir(valuesDir,{recursive:true});
await mkdir(values31Dir,{recursive:true});
const baseTheme=`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="AudifySplashTheme" parent="Theme.AppCompat.DayNight.NoActionBar">\n        <item name="android:windowActionModeOverlay">true</item>\n        <item name="android:windowLightStatusBar">false</item>\n        <item name="android:forceDarkAllowed">false</item>\n        <item name="android:statusBarColor">#02060A</item>\n        <item name="android:navigationBarColor">#02060A</item>\n        <item name="android:windowBackground">#02060A</item>\n    </style>\n</resources>\n`;
await writeFile(path.join(valuesDir,'audify_splash_theme.xml'),baseTheme,'utf8');
await writeFile(path.join(values31Dir,'audify_splash_theme.xml'),`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="AudifySplashTheme" parent="Theme.AppCompat.DayNight.NoActionBar">\n        <item name="android:windowSplashScreenBackground">#02060A</item>\n        <item name="android:windowSplashScreenAnimatedIcon">@drawable/audify_gradient_mark</item>\n        <item name="android:postSplashScreenTheme">@style/AppTheme.NoActionBar</item>\n        <item name="android:windowLightStatusBar">false</item>\n        <item name="android:statusBarColor">#02060A</item>\n        <item name="android:navigationBarColor">#02060A</item>\n    </style>\n</resources>\n`,'utf8');

// Android 12 pre-splash icon: simple vector A, never the square launcher icon.
const drawableDir=path.join(resDir,'drawable');
await mkdir(drawableDir,{recursive:true});
await writeFile(path.join(drawableDir,'audify_gradient_mark.xml'),`<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n    <path android:fillColor="@android:color/transparent" android:strokeColor="#89FF30" android:strokeWidth="10" android:strokeLineCap="round" android:strokeLineJoin="round" android:pathData="M22,82 L47,28 Q54,16 61,28 L86,82"/>\n    <path android:fillColor="@android:color/transparent" android:strokeColor="#FF8F57" android:strokeWidth="5" android:strokeLineCap="round" android:pathData="M43,63 L43,69 M49,58 L49,74 M55,55 L55,77 M61,59 L61,73 M67,63 L67,69"/>\n</vector>\n`,'utf8');

console.log('Audify V68.13.2: restored exact Gradient-A startup family from original V68.13 APK.');
