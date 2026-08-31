import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
await mkdir(pkgDir,{recursive:true});

const waves=String.raw`package com.nova.audify;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;
import android.view.animation.LinearInterpolator;

/**
 * Audify V68.8 — spectre/waves décoratives natives.
 * IMPORTANT : l'animation est totalement indépendante de la vitesse ExoPlayer.
 * Elle a une vitesse fixe et ne change d'état que sur Play/Pause.
 * Pause fige exactement la phase courante, reprise reprend depuis cette phase.
 */
public final class AudioWavesView extends View {
    private final Paint wave1=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint wave2=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint wave3=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint ring1=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint ring2=new Paint(Paint.ANTI_ALIAS_FLAG);
    private ValueAnimator animator;
    private float phase=0f;
    private boolean playing=false;
    private int accent=Color.rgb(108,132,166);

    public AudioWavesView(Context context){ super(context); init(); }

    private void init(){
        setWillNotDraw(false);
        setClickable(false);
        configurePaint(wave1,1.35f,72);
        configurePaint(wave2,1.05f,50);
        configurePaint(wave3,0.9f,34);
        configurePaint(ring1,2.0f,28);
        configurePaint(ring2,1.0f,18);
        updateColors();

        // Durée CONSTANTE : elle n'est jamais liée à playbackParameters/speed.
        animator=ValueAnimator.ofFloat(0f,(float)(Math.PI*2.0));
        animator.setDuration(4600L);
        animator.setInterpolator(new LinearInterpolator());
        animator.setRepeatCount(ValueAnimator.INFINITE);
        animator.setRepeatMode(ValueAnimator.RESTART);
        animator.addUpdateListener(a->{
            phase=(Float)a.getAnimatedValue();
            invalidate();
        });
    }

    private void configurePaint(Paint p,float widthDp,int alpha){
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(dp(widthDp));
        p.setStrokeCap(Paint.Cap.ROUND);
        p.setStrokeJoin(Paint.Join.ROUND);
        p.setAlpha(alpha);
    }

    public void setAccentColor(int color){
        accent=color;
        updateColors();
        invalidate();
    }

    private void updateColors(){
        int r=Color.red(accent),g=Color.green(accent),b=Color.blue(accent);
        wave1.setColor(Color.argb(78,r,g,b));
        wave2.setColor(Color.argb(55,clamp(r+16),clamp(g+22),clamp(b+30)));
        wave3.setColor(Color.argb(38,clamp(r-18),clamp(g-8),clamp(b+14)));
        ring1.setColor(Color.argb(31,r,g,b));
        ring2.setColor(Color.argb(18,clamp(r+28),clamp(g+32),clamp(b+36)));
    }

    /** Play = animation fixe. Pause = gel exact. Reprise = resume() exact. */
    public void setPlaying(boolean shouldPlay){
        if(playing==shouldPlay) return;
        playing=shouldPlay;
        if(shouldPlay){
            if(animator==null) return;
            if(animator.isPaused()) animator.resume();
            else if(!animator.isStarted()) animator.start();
        }else{
            if(animator!=null && animator.isStarted() && !animator.isPaused()) animator.pause();
        }
        invalidate();
    }

    @Override protected void onDetachedFromWindow(){
        super.onDetachedFromWindow();
        if(animator!=null) animator.cancel();
    }

    @Override protected void onDraw(Canvas canvas){
        super.onDraw(canvas);
        float w=getWidth(),h=getHeight();
        if(w<=0||h<=0) return;

        // Les trois waves traversent la zone de la pochette comme Audify Web.
        float centerY=h*0.355f;
        drawWave(canvas,w,centerY-dp(34),dp(27),phase,0.92f,wave3);
        drawWave(canvas,w,centerY,dp(38),phase+0.72f,1.08f,wave1);
        drawWave(canvas,w,centerY+dp(38),dp(25),phase+1.55f,1.31f,wave2);

        // Anneaux concentriques à droite. Leur mouvement vient seulement de phase.
        float cx=w*0.82f;
        float cy=h*0.335f;
        float pulse=(float)Math.sin(phase)*dp(2.8f);
        canvas.drawCircle(cx,cy,dp(58)+pulse,ring1);
        canvas.drawCircle(cx,cy,dp(91)+pulse*1.10f,ring2);
        canvas.drawCircle(cx,cy,dp(125)+pulse*1.18f,ring1);
        canvas.drawCircle(cx,cy,dp(160)+pulse*1.28f,ring2);
    }

    private void drawWave(Canvas canvas,float width,float baseY,float amp,float ph,float density,Paint paint){
        Path path=new Path();
        final int segments=46;
        float step=width/segments;
        float first=(float)(baseY+Math.sin(ph)*amp);
        path.moveTo(0f,first);
        for(int i=1;i<=segments;i++){
            float x=i*step;
            float angle=(i*0.37f*density)+ph;
            float y=(float)(baseY+Math.sin(angle)*amp + Math.sin(angle*0.47f+0.6f)*amp*0.22f);
            float px=(i-1)*step;
            float midAngle=((i-0.5f)*0.37f*density)+ph;
            float cy=(float)(baseY+Math.sin(midAngle)*amp + Math.sin(midAngle*0.47f+0.6f)*amp*0.22f);
            path.quadTo(px+step*0.5f,cy,x,y);
        }
        canvas.drawPath(path,paint);
    }

    private int clamp(int value){ return Math.max(0,Math.min(255,value)); }
    private float dp(float value){ return value*getResources().getDisplayMetrics().density; }
}
`;
await writeFile(path.join(pkgDir,'AudioWavesView.java'),waves,'utf8');

const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
let src=await readFile(playerPath,'utf8');

src=src.replace(
  'private FrameLayout root;',
  'private FrameLayout root;\n    private AudioWavesView audioWavesView;'
);

const rootNeedle=`        root = new FrameLayout(this);
        applyGradient(themeTop, themeMid, themeBottom);

        // Zone centrale scrollable`;
if(!src.includes(rootNeedle)) throw new Error('Root NativePlayerActivity V68.7 introuvable');
const rootReplacement=`        root = new FrameLayout(this);
        applyGradient(themeTop, themeMid, themeBottom);

        // Spectre/waves Audify derrière la pochette et le contenu.
        audioWavesView = new AudioWavesView(this);
        root.addView(audioWavesView,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        // Zone centrale scrollable`;
src=src.replace(rootNeedle,rootReplacement);

// Synchronisation STRICTEMENT sur le booléen playing. Aucune vitesse de lecture utilisée.
const playNeedle='        lastPlaying=playing;';
if(!src.includes(playNeedle)) throw new Error('applyPlayState V68.7 introuvable');
src=src.replace(playNeedle,'        lastPlaying=playing;\n        if(audioWavesView!=null) audioWavesView.setPlaying(playing);');

// Réutilise la couleur dominante déjà calculée pour le fond dynamique.
const themeNeedle='        int dominant = extractDominantColor(bitmap);';
if(!src.includes(themeNeedle)) throw new Error('Couleur dominante V68.3 introuvable');
src=src.replace(themeNeedle,'        int dominant = extractDominantColor(bitmap);\n        if(audioWavesView!=null) audioWavesView.setAccentColor(dominant);');

await writeFile(playerPath,src,'utf8');
console.log('Audify Android V68.8 : waves natives ajoutées, vitesse fixe, pause/resume exact sans lien avec playback speed.');
