import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const android = path.join(root, 'android');
const pkgDir = path.join(android, 'app', 'src', 'main', 'java', 'com', 'nova', 'audify');
const resDir = path.join(android, 'app', 'src', 'main', 'res');
const splashPath = path.join(pkgDir, 'AudifySplashActivity.java');
const marker = 'AUDIFY_V6812652_EXACT_GRADIENT_A_SPLASH';

// V68.12.65.2 restores the validated Audify launch reference exactly:
// black screen, rounded gradient A, animated waveform, then full lime-green A.
const splash = String.raw`package com.nova.audify;

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

/** Audify V68.12.65.2 — exact gradient-A splash restored from the validated reference. */
public class AudifySplashActivity extends AppCompatActivity {
    private static final int BG=Color.rgb(2,6,10);
    private static final int LIME=Color.rgb(137,255,48);
    private static final String BUILD_MARKER="${marker}";

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
        content.setPadding(dp(24),0,dp(24),0);

        mark=new AudifyGradientMarkView();
        mark.setTag(BUILD_MARKER);
        mark.setContentDescription("Logo Audify animé");
        content.addView(mark,new LinearLayout.LayoutParams(dp(190),dp(178)));

        TextView status=new TextView(this);
        status.setText("Audify prépare votre accueil");
        status.setTextColor(Color.rgb(218,223,231));
        status.setTextSize(16f);
        status.setGravity(Gravity.CENTER);
        status.setAlpha(0f);
        LinearLayout.LayoutParams statusLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54));
        statusLp.topMargin=dp(27);
        content.addView(status,statusLp);

        FrameLayout.LayoutParams contentLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT,Gravity.CENTER);
        contentLp.topMargin=-dp(42);
        root.addView(content,contentLp);
        setContentView(root);

        status.animate().alpha(1f).setStartDelay(180L).setDuration(360L).start();
        mark.start();

        // The color stream finishes by filling the complete A with Audify lime.
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
        try{
            Intent home=new Intent(this,NativeHomeActivity.class);
            home.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(home);
            overridePendingTransition(android.R.anim.fade_in,android.R.anim.fade_out);
            finish();
        }catch(Throwable ignored){
            opened=false;
        }
    }

    @Override protected void onDestroy(){
        handler.removeCallbacksAndMessages(null);
        if(mark!=null)mark.stop();
        super.onDestroy();
    }

    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}

    private int mix(int from,int to,float raw){
        float t=Math.max(0f,Math.min(1f,raw));
        return Color.argb(
            Math.round(Color.alpha(from)+(Color.alpha(to)-Color.alpha(from))*t),
            Math.round(Color.red(from)+(Color.red(to)-Color.red(from))*t),
            Math.round(Color.green(from)+(Color.green(to)-Color.green(from))*t),
            Math.round(Color.blue(from)+(Color.blue(to)-Color.blue(from))*t)
        );
    }

    private float smooth(float raw){
        float t=Math.max(0f,Math.min(1f,raw));
        return t*t*(3f-2f*t);
    }

    /** Draws the reference A directly, so no old square launcher artwork can appear. */
    private final class AudifyGradientMarkView extends View {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path aPath=new Path();
        private ValueAnimator animator;
        private float phase=0f;

        AudifyGradientMarkView(){
            super(AudifySplashActivity.this);
            setLayerType(View.LAYER_TYPE_SOFTWARE,null);
        }

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
            float w=getWidth();
            float h=getHeight();

            aPath.reset();
            aPath.moveTo(w*0.16f,h*0.80f);
            aPath.lineTo(w*0.435f,h*0.225f);
            aPath.quadTo(w*0.50f,h*0.105f,w*0.565f,h*0.225f);
            aPath.lineTo(w*0.84f,h*0.80f);

            float flow=Math.min(1f,phase/0.70f);
            float green=smooth((phase-0.67f)/0.31f);
            int purple=mix(Color.rgb(198,42,239),LIME,green);
            int pink=mix(Color.rgb(244,72,178),LIME,green);
            int peach=mix(Color.rgb(255,127,112),LIME,green);
            int orange=mix(Color.rgb(255,160,68),LIME,green);
            int silver=mix(Color.rgb(158,174,183),LIME,green);
            float start=-w*0.70f+flow*w*0.94f;

            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeJoin(Paint.Join.ROUND);
            paint.setStrokeWidth(h*0.135f);
            paint.setShader(new LinearGradient(
                start,0f,start+w*1.48f,h,
                new int[]{purple,pink,peach,orange,silver},
                new float[]{0f,0.23f,0.49f,0.72f,1f},
                Shader.TileMode.CLAMP
            ));
            paint.setShadowLayer(dp(8),0,dp(3),Color.argb(56,0,0,0));
            canvas.drawPath(aPath,paint);
            paint.clearShadowLayer();
            paint.setShader(null);

            float appear=smooth((phase-0.04f)/0.24f);
            float settle=phase<0.72f ? 1f : 1f-(green*0.05f);
            float centerX=w*0.50f;
            float centerY=h*0.62f;
            float gap=w*0.041f;
            float[] heights={0.28f,0.48f,0.70f,1.00f,0.70f,0.48f,0.28f};
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeWidth(w*0.026f);
            paint.setColor(mix(Color.rgb(255,143,87),LIME,green));
            for(int i=0;i<heights.length;i++){
                float live=0.88f+0.12f*(float)Math.sin(phase*Math.PI*8.0+i*0.72f);
                float bar=h*0.245f*heights[i]*live*appear*settle;
                float x=centerX+(i-3)*gap;
                canvas.drawLine(x,centerY-bar*0.5f,x,centerY+bar*0.5f,paint);
            }
        }
    }
}
`;

await writeFile(splashPath, splash, 'utf8');

// Android 12 pre-splash: same A and waveform silhouette, never the old square icon.
const drawableDir = path.join(resDir, 'drawable');
await mkdir(drawableDir, { recursive: true });
await writeFile(path.join(drawableDir, 'audify_gradient_mark.xml'), `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:fillColor="#00000000" android:strokeColor="#F45AA8"
        android:strokeWidth="12" android:strokeLineCap="round" android:strokeLineJoin="round"
        android:pathData="M21,82 L48,25 Q54,13 60,25 L87,82" />
    <path android:fillColor="#00000000" android:strokeColor="#FF9058"
        android:strokeWidth="4" android:strokeLineCap="round"
        android:pathData="M39,61 L39,67 M46,56 L46,72 M54,51 L54,77 M62,56 L62,72 M69,61 L69,67" />
</vector>
`, 'utf8');

const themePath = path.join(resDir, 'values-v31', 'audify_splash_theme.xml');
let theme = await readFile(themePath, 'utf8');
theme = theme.replace(/@drawable\/audify_(?:launcher|modern_mark)/g, '@drawable/audify_gradient_mark');
if (!theme.includes('@drawable/audify_gradient_mark')) {
  throw new Error('V68.12.65.2: Android 12 splash icon target not found');
}
await writeFile(themePath, theme, 'utf8');

console.log('Audify V68.12.65.2: exact animated gradient A, inner waveform, green finish and reference text restored.');
