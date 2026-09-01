import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const resDir=path.join(android,'app','src','main','res');
const splashPath=path.join(pkgDir,'AudifySplashActivity.java');

// V68.12.18 remplace l'ancienne image splash plein écran par une scène native
// animée qui utilise le VRAI asset de marque Audify : audify_launcher.webp.
// Cet asset est copié en @drawable/audify_launcher par V68.10.2 juste avant.
const splash=String.raw`package com.nova.audify;

import android.animation.Animator;
import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
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
import android.view.animation.LinearInterpolator;
import android.view.animation.OvershootInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import java.util.ArrayList;
import java.util.List;

/** Audify V68.12.18 — Pulse Splash : vrai logo + halo + pulsations + equalizer. */
public class AudifySplashActivity extends AppCompatActivity {
    private static final int BG=Color.rgb(2,3,8);
    private static final int ACCENT=Color.rgb(137,255,48);
    private static final int SOFT=Color.rgb(191,201,214);

    private final Handler handler=new Handler(Looper.getMainLooper());
    private final List<Animator> running=new ArrayList<>();
    private boolean opened=false;
    private LinearLayout content;
    private EqualizerView equalizer;

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
        GradientDrawable rootBg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(2,3,8),Color.rgb(5,11,13),Color.rgb(2,4,9)}
        );
        root.setBackground(rootBg);

        AmbientGlowView ambient=new AmbientGlowView();
        root.addView(ambient,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        content=new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(24),dp(34),dp(24),dp(30));
        content.setAlpha(0f);
        content.setScaleX(0.97f);
        content.setScaleY(0.97f);
        FrameLayout.LayoutParams contentLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT,Gravity.CENTER);
        contentLp.topMargin=-dp(10);
        root.addView(content,contentLp);

        FrameLayout stage=new FrameLayout(this);
        stage.setAlpha(0f);
        stage.setScaleX(0.72f);
        stage.setScaleY(0.72f);
        content.addView(stage,new LinearLayout.LayoutParams(dp(210),dp(210)));

        View softGlow=new View(this);
        softGlow.setBackground(circle(Color.argb(32,137,255,48),0,Color.TRANSPARENT));
        FrameLayout.LayoutParams glowLp=new FrameLayout.LayoutParams(dp(182),dp(182),Gravity.CENTER);
        stage.addView(softGlow,glowLp);

        View outerRing=new View(this);
        outerRing.setBackground(circle(Color.TRANSPARENT,dp(1),Color.argb(86,137,255,48)));
        outerRing.setAlpha(0f);
        FrameLayout.LayoutParams outerLp=new FrameLayout.LayoutParams(dp(178),dp(178),Gravity.CENTER);
        stage.addView(outerRing,outerLp);

        View innerRing=new View(this);
        innerRing.setBackground(circle(Color.TRANSPARENT,dp(1),Color.argb(150,137,255,48)));
        innerRing.setAlpha(0f);
        FrameLayout.LayoutParams innerLp=new FrameLayout.LayoutParams(dp(154),dp(154),Gravity.CENTER);
        stage.addView(innerRing,innerLp);

        FrameLayout logoShell=new FrameLayout(this);
        GradientDrawable shellBg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(20,29,32),Color.rgb(9,14,20)}
        );
        shellBg.setCornerRadius(dp(34));
        shellBg.setStroke(dp(1),Color.argb(155,137,255,48));
        logoShell.setBackground(shellBg);
        logoShell.setElevation(dp(18));
        FrameLayout.LayoutParams shellLp=new FrameLayout.LayoutParams(dp(132),dp(132),Gravity.CENTER);
        stage.addView(logoShell,shellLp);

        ImageView logo=new ImageView(this);
        logo.setImageResource(R.drawable.audify_launcher);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        logo.setPadding(dp(9),dp(9),dp(9),dp(9));
        logo.setContentDescription("Logo Audify");
        logo.setAlpha(0f);
        logo.setScaleX(0.76f);
        logo.setScaleY(0.76f);
        logoShell.addView(logo,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        TextView brand=text("AUDIFY",30f,true);
        brand.setGravity(Gravity.CENTER);
        brand.setLetterSpacing(0.20f);
        brand.setAlpha(0f);
        brand.setTranslationY(dp(12));
        LinearLayout.LayoutParams brandLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48));
        brandLp.topMargin=dp(2);
        content.addView(brand,brandLp);

        TextView signature=text("VOTRE MUSIQUE PREND VIE",11.5f,true);
        signature.setTextColor(ACCENT);
        signature.setGravity(Gravity.CENTER);
        signature.setLetterSpacing(0.15f);
        signature.setAlpha(0f);
        content.addView(signature,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30)));

        equalizer=new EqualizerView();
        equalizer.setAlpha(0f);
        LinearLayout.LayoutParams eqLp=new LinearLayout.LayoutParams(dp(92),dp(34));
        eqLp.topMargin=dp(12);
        content.addView(equalizer,eqLp);

        TextView loading=text("Préparation de votre musique…",13.5f,false);
        loading.setTextColor(SOFT);
        loading.setGravity(Gravity.CENTER);
        loading.setAlpha(0f);
        LinearLayout.LayoutParams loadingLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(38));
        loadingLp.topMargin=dp(5);
        content.addView(loading,loadingLp);

        setContentView(root);

        // Entrée douce de toute la composition.
        content.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(330L).setInterpolator(new DecelerateInterpolator()).start();
        stage.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(650L).setInterpolator(new OvershootInterpolator(0.72f)).start();
        logo.animate().alpha(1f).scaleX(1f).scaleY(1f).setStartDelay(115L).setDuration(590L).setInterpolator(new OvershootInterpolator(0.62f)).start();
        brand.animate().alpha(1f).translationY(0f).setStartDelay(260L).setDuration(420L).setInterpolator(new DecelerateInterpolator()).start();
        signature.animate().alpha(1f).setStartDelay(390L).setDuration(380L).start();
        equalizer.animate().alpha(1f).setStartDelay(500L).setDuration(300L).start();
        loading.animate().alpha(1f).setStartDelay(590L).setDuration(340L).start();

        startRingPulse(outerRing,0L,1180L,0.50f);
        startRingPulse(innerRing,360L,1080L,0.62f);
        startLogoBreathing(logo);
        equalizer.start();

        // Le splash reste court : il donne une vraie identité sans ralentir l'accès à Audify.
        handler.postDelayed(()->{
            if(opened||isFinishing())return;
            content.animate().alpha(0f).scaleX(1.035f).scaleY(1.035f).setDuration(250L).setInterpolator(new DecelerateInterpolator()).start();
            ambient.animate().alpha(0f).setDuration(260L).start();
            handler.postDelayed(this::openAudify,215L);
        },1560L);
    }

    private void startRingPulse(View ring,long delay,long duration,float maxAlpha){
        ObjectAnimator sx=ObjectAnimator.ofFloat(ring,View.SCALE_X,0.80f,1.22f);
        ObjectAnimator sy=ObjectAnimator.ofFloat(ring,View.SCALE_Y,0.80f,1.22f);
        ObjectAnimator a=ObjectAnimator.ofFloat(ring,View.ALPHA,0f,maxAlpha,0f);
        AnimatorSet set=new AnimatorSet();
        set.playTogether(sx,sy,a);
        set.setStartDelay(delay);
        set.setDuration(duration);
        set.setInterpolator(new DecelerateInterpolator());
        set.addListener(new android.animation.AnimatorListenerAdapter(){
            @Override public void onAnimationEnd(Animator animation){
                if(!opened&&!isFinishing()){
                    handler.postDelayed(()->startRingPulse(ring,0L,duration,maxAlpha),90L);
                }
            }
        });
        running.add(set);
        set.start();
    }

    private void startLogoBreathing(ImageView logo){
        ObjectAnimator sx=ObjectAnimator.ofFloat(logo,View.SCALE_X,1f,1.035f,1f);
        ObjectAnimator sy=ObjectAnimator.ofFloat(logo,View.SCALE_Y,1f,1.035f,1f);
        AnimatorSet set=new AnimatorSet();
        set.playTogether(sx,sy);
        set.setStartDelay(720L);
        set.setDuration(880L);
        set.setInterpolator(new DecelerateInterpolator());
        running.add(set);
        set.start();
    }

    private void openAudify(){
        if(opened||isFinishing())return;
        opened=true;
        if(equalizer!=null)equalizer.stop();
        startActivity(new Intent(this,MainActivity.class));
        overridePendingTransition(android.R.anim.fade_in,android.R.anim.fade_out);
        finish();
    }

    @Override protected void onDestroy(){
        handler.removeCallbacksAndMessages(null);
        if(equalizer!=null)equalizer.stop();
        for(Animator animator:running){try{animator.cancel();}catch(Throwable ignored){}}
        running.clear();
        super.onDestroy();
    }

    private TextView text(String value,float size,boolean bold){
        TextView t=new TextView(this);
        t.setText(value);
        t.setTextColor(Color.WHITE);
        t.setTextSize(size);
        if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        return t;
    }

    private GradientDrawable circle(int fill,int strokeWidth,int stroke){
        GradientDrawable d=new GradientDrawable();
        d.setShape(GradientDrawable.OVAL);
        d.setColor(fill);
        if(strokeWidth>0)d.setStroke(strokeWidth,stroke);
        return d;
    }

    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}

    private final class AmbientGlowView extends View {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        AmbientGlowView(){super(AudifySplashActivity.this);setAlpha(0.90f);}
        @Override protected void onDraw(Canvas canvas){
            super.onDraw(canvas);
            float cx=getWidth()*0.50f;
            float cy=getHeight()*0.43f;
            float radius=Math.max(getWidth(),getHeight())*0.48f;
            paint.setShader(new RadialGradient(cx,cy,radius,
                new int[]{Color.argb(38,137,255,48),Color.argb(14,54,140,87),Color.TRANSPARENT},
                new float[]{0f,0.38f,1f},Shader.TileMode.CLAMP));
            canvas.drawCircle(cx,cy,radius,paint);
            paint.setShader(new LinearGradient(0,getHeight(),getWidth(),0,
                Color.argb(14,80,240,142),Color.TRANSPARENT,Shader.TileMode.CLAMP));
            canvas.drawRect(0,0,getWidth(),getHeight(),paint);
            paint.setShader(null);
        }
    }

    private final class EqualizerView extends View {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        private ValueAnimator animator;
        private float phase=0f;
        EqualizerView(){
            super(AudifySplashActivity.this);
            paint.setColor(ACCENT);
        }
        void start(){
            stop();
            animator=ValueAnimator.ofFloat(0f,(float)(Math.PI*2.0));
            animator.setDuration(920L);
            animator.setRepeatCount(ValueAnimator.INFINITE);
            animator.setInterpolator(new LinearInterpolator());
            animator.addUpdateListener(a->{phase=(Float)a.getAnimatedValue();invalidate();});
            animator.start();
        }
        void stop(){if(animator!=null){animator.cancel();animator=null;}}
        @Override protected void onDraw(Canvas canvas){
            super.onDraw(canvas);
            int count=5;
            float gap=dp(5);
            float bar=dp(6);
            float total=count*bar+(count-1)*gap;
            float x=(getWidth()-total)*0.5f;
            float center=getHeight()*0.5f;
            for(int i=0;i<count;i++){
                float wave=0.5f+0.5f*(float)Math.sin(phase+i*0.92f);
                float h=dp(7)+(getHeight()-dp(8))*wave*0.82f;
                float top=center-h*0.5f;
                float bottom=center+h*0.5f;
                paint.setAlpha(150+(int)(105*wave));
                canvas.drawRoundRect(x,top,x+bar,bottom,bar*0.5f,bar*0.5f,paint);
                x+=bar+gap;
            }
            paint.setAlpha(255);
        }
    }
}
`;

await writeFile(splashPath,splash,'utf8');

// Le pré-splash Android 12+ utilise lui aussi le vrai logo Audify afin d'éviter
// toute icône générique avant l'arrivée de notre animation native.
const valuesDir=path.join(resDir,'values');
const values31Dir=path.join(resDir,'values-v31');
await mkdir(valuesDir,{recursive:true});
await mkdir(values31Dir,{recursive:true});

await writeFile(path.join(valuesDir,'audify_splash_theme.xml'),`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="AudifySplashTheme" parent="Theme.AppCompat.DayNight.NoActionBar">\n        <item name="android:windowActionModeOverlay">true</item>\n        <item name="android:windowLightStatusBar">false</item>\n        <item name="android:forceDarkAllowed">false</item>\n        <item name="android:statusBarColor">#020308</item>\n        <item name="android:navigationBarColor">#020308</item>\n        <item name="android:windowBackground">#020308</item>\n    </style>\n</resources>\n`,'utf8');

await writeFile(path.join(values31Dir,'audify_splash_theme.xml'),`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="AudifySplashTheme" parent="Theme.AppCompat.DayNight.NoActionBar">\n        <item name="android:windowLightStatusBar">false</item>\n        <item name="android:forceDarkAllowed">false</item>\n        <item name="android:statusBarColor">#020308</item>\n        <item name="android:navigationBarColor">#020308</item>\n        <item name="android:windowBackground">#020308</item>\n        <item name="android:windowSplashScreenBackground">#020308</item>\n        <item name="android:windowSplashScreenAnimatedIcon">@drawable/audify_launcher</item>\n        <item name="android:windowSplashScreenIconBackgroundColor">#020308</item>\n        <item name="android:windowSplashScreenAnimationDuration">180</item>\n    </style>\n</resources>\n`,'utf8');

console.log('Audify V68.12.18 : Pulse Splash natif avec vrai logo Audify, halo, anneaux, respiration et equalizer animé.');
