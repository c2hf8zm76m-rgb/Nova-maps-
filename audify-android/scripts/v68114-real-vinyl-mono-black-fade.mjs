import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');

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
    if(end>0) return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error(`V68.11.4 méthode introuvable: ${label}`);
}

function replaceRequired(source,needle,replacement,label){
  if(!source.includes(needle)) throw new Error(`V68.11.4 bloc introuvable: ${label}`);
  return source.replace(needle,replacement);
}

// =============================================================================
// 1) Nouveau vrai vinyle : indépendant de l'ancien disque/pochette.
// =============================================================================
const vinyl=String.raw`package com.nova.audify;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.SweepGradient;
import android.util.AttributeSet;
import android.view.View;

/** Audify V68.11.4 — vrai vinyle noir, sillons et reflets premium. */
public final class VinylRecordView extends View {
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke=new Paint(Paint.ANTI_ALIAS_FLAG);
    private int accent=Color.rgb(145,94,43);

    public VinylRecordView(Context c){super(c);init();}
    public VinylRecordView(Context c,AttributeSet a){super(c,a);init();}
    private void init(){
        setLayerType(View.LAYER_TYPE_SOFTWARE,null);
        setClickable(false);
        setFocusable(false);
    }

    public void setAccentColor(int color){accent=color;invalidate();}

    @Override protected void onDraw(Canvas canvas){
        super.onDraw(canvas);
        float w=getWidth(),h=getHeight();
        float cx=w/2f,cy=h/2f;
        float r=Math.max(1f,Math.min(w,h)/2f-2f);

        // Corps noir avec profondeur radiale — jamais une simple ombre.
        paint.setStyle(Paint.Style.FILL);
        paint.setShader(new RadialGradient(cx-r*0.18f,cy-r*0.20f,r*1.25f,
            new int[]{Color.rgb(43,46,50),Color.rgb(18,20,23),Color.rgb(5,6,8),Color.BLACK},
            new float[]{0f,0.34f,0.77f,1f},Shader.TileMode.CLAMP));
        canvas.drawCircle(cx,cy,r,paint);
        paint.setShader(null);

        // Sillons fins et nombreux.
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(Math.max(1f,r*0.0052f));
        for(int i=0;i<27;i++){
            float rr=r*(0.30f+i*0.0242f);
            int alpha=(i%4==0)?62:((i%2==0)?38:24);
            stroke.setColor(Color.argb(alpha,232,236,241));
            canvas.drawCircle(cx,cy,rr,stroke);
        }

        // Reflet métallique courbe qui tourne avec le disque.
        SweepGradient sheen=new SweepGradient(cx,cy,
            new int[]{Color.TRANSPARENT,Color.argb(92,255,255,255),Color.TRANSPARENT,Color.argb(38,196,205,214),Color.TRANSPARENT},
            new float[]{0f,0.12f,0.26f,0.62f,1f});
        stroke.setShader(sheen);
        stroke.setStrokeWidth(r*0.095f);
        canvas.drawCircle(cx,cy,r*0.70f,stroke);
        stroke.setShader(null);

        // Bord externe net.
        stroke.setStrokeWidth(Math.max(1.5f,r*0.010f));
        stroke.setColor(Color.argb(205,210,217,224));
        canvas.drawCircle(cx,cy,r-1.5f,stroke);

        // Label central : même couleur dominante que la pochette, fortement assombrie.
        int label=blend(accent,Color.BLACK,0.73f);
        paint.setStyle(Paint.Style.FILL);
        paint.setShader(new RadialGradient(cx-r*0.05f,cy-r*0.06f,r*0.255f,
            new int[]{blend(label,Color.WHITE,0.08f),label,blend(label,Color.BLACK,0.38f)},
            new float[]{0f,0.64f,1f},Shader.TileMode.CLAMP));
        canvas.drawCircle(cx,cy,r*0.245f,paint);
        paint.setShader(null);
        stroke.setStrokeWidth(Math.max(1f,r*0.007f));
        stroke.setColor(Color.argb(150,235,239,244));
        canvas.drawCircle(cx,cy,r*0.245f,stroke);

        // Trou central.
        paint.setColor(Color.rgb(2,3,4));
        canvas.drawCircle(cx,cy,Math.max(2.6f,r*0.026f),paint);
        stroke.setColor(Color.argb(190,240,242,245));
        stroke.setStrokeWidth(Math.max(1f,r*0.006f));
        canvas.drawCircle(cx,cy,Math.max(2.6f,r*0.026f),stroke);
    }

    private int blend(int from,int to,float amount){
        float t=Math.max(0f,Math.min(1f,amount));
        return Color.rgb(
            Math.round(Color.red(from)+(Color.red(to)-Color.red(from))*t),
            Math.round(Color.green(from)+(Color.green(to)-Color.green(from))*t),
            Math.round(Color.blue(from)+(Color.blue(to)-Color.blue(from))*t));
    }
}
`;
await writeFile(path.join(pkgDir,'VinylRecordView.java'),vinyl,'utf8');

// =============================================================================
// 2) Fond premium : UNE couleur extraite + noir, avec halo/fondu/vignette.
// =============================================================================
const backdrop=String.raw`package com.nova.audify;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.util.AttributeSet;
import android.view.View;

/** Audify V68.11.4 — mono-couleur + noir, jamais un aplat. */
public final class AudifyBackdropView extends View {
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private int dominant=Color.rgb(96,62,32);
    private ValueAnimator animator;

    public AudifyBackdropView(Context c){super(c);}
    public AudifyBackdropView(Context c,AttributeSet a){super(c,a);}

    public void setDominantColor(int target){
        int from=dominant;
        if(animator!=null) animator.cancel();
        animator=ValueAnimator.ofFloat(0f,1f);
        animator.setDuration(680L);
        animator.addUpdateListener(a->{
            dominant=blend(from,target,(Float)a.getAnimatedValue());
            invalidate();
        });
        animator.start();
    }

    @Override protected void onDraw(Canvas canvas){
        super.onDraw(canvas);
        float w=getWidth(),h=getHeight();
        if(w<=0||h<=0) return;

        canvas.drawColor(Color.rgb(2,3,4));

        // Même teinte dominante à plusieurs profondeurs, puis noir pur.
        int rich=boost(dominant,0.92f,0.88f);
        int deep=blend(rich,Color.BLACK,0.47f);
        int deeper=blend(rich,Color.BLACK,0.72f);
        LinearGradient vertical=new LinearGradient(0,0,0,h,
            new int[]{deep,rich,deeper,Color.rgb(2,3,4)},
            new float[]{0f,0.27f,0.67f,1f},Shader.TileMode.CLAMP);
        paint.setShader(vertical);
        canvas.drawRect(0,0,w,h,paint);

        // Halo doux autour de la pochette : toujours la MÊME couleur.
        int glow=Color.argb(150,Color.red(rich),Color.green(rich),Color.blue(rich));
        RadialGradient halo=new RadialGradient(w*0.70f,h*0.25f,Math.max(w,h)*0.48f,
            new int[]{glow,Color.argb(52,Color.red(rich),Color.green(rich),Color.blue(rich)),Color.TRANSPARENT},
            new float[]{0f,0.47f,1f},Shader.TileMode.CLAMP);
        paint.setShader(halo);
        canvas.drawRect(0,0,w,h,paint);

        // Vignette noire sur les bords et la partie basse pour le rendu cinématique.
        RadialGradient vignette=new RadialGradient(w*0.50f,h*0.42f,Math.max(w,h)*0.72f,
            new int[]{Color.TRANSPARENT,Color.argb(46,0,0,0),Color.argb(210,0,0,0)},
            new float[]{0.25f,0.68f,1f},Shader.TileMode.CLAMP);
        paint.setShader(vignette);
        canvas.drawRect(0,0,w,h,paint);
        paint.setShader(null);
    }

    private int boost(int c,float satScale,float valueScale){
        float[] hsv=new float[3];
        Color.colorToHSV(c,hsv);
        hsv[1]=Math.max(0.38f,Math.min(0.78f,hsv[1]*satScale));
        hsv[2]=Math.max(0.38f,Math.min(0.70f,hsv[2]*valueScale));
        return Color.HSVToColor(hsv);
    }

    private int blend(int from,int to,float amount){
        float t=Math.max(0f,Math.min(1f,amount));
        return Color.rgb(
            Math.round(Color.red(from)+(Color.red(to)-Color.red(from))*t),
            Math.round(Color.green(from)+(Color.green(to)-Color.green(from))*t),
            Math.round(Color.blue(from)+(Color.blue(to)-Color.blue(from))*t));
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyBackdropView.java'),backdrop,'utf8');

// =============================================================================
// 3) Intégration structurelle au lecteur.
// =============================================================================
let src=await readFile(playerPath,'utf8');

if(!src.includes('private VinylRecordView vinylRecordV68114;')){
  src=replaceRequired(src,
    '    private FrameLayout root;',
    '    private FrameLayout root;\n    private VinylRecordView vinylRecordV68114;\n    private AudifyBackdropView backdropV68114;',
    'champs vinyle/backdrop');
}

// Fond custom tout au fond du root.
const rootNeedle='        root = new FrameLayout(this);\n        applyGradient(themeTop, themeMid, themeBottom);';
if(src.includes(rootNeedle)&&!src.includes('backdropV68114 = new AudifyBackdropView(this);')){
  src=src.replace(rootNeedle,rootNeedle+String.raw`
        backdropV68114 = new AudifyBackdropView(this);
        root.addView(backdropV68114,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));`);
}
if(!src.includes('backdropV68114 = new AudifyBackdropView(this);')) throw new Error('V68.11.4 insertion backdrop impossible');

// Nouveau vinyle indépendant, placé dans le stage ENTRE waves et pochette.
const stageNeedle='        artworkStage.addView(artwork,artworkInnerLp);';
if(src.includes(stageNeedle)&&!src.includes('vinylRecordV68114 = new VinylRecordView(this);')){
  src=src.replace(stageNeedle,stageNeedle+String.raw`

        vinylRecordV68114 = new VinylRecordView(this);
        int realVinylSizeV68114=(int)(artworkSize*0.96f);
        FrameLayout.LayoutParams realVinylLpV68114=new FrameLayout.LayoutParams(realVinylSizeV68114,realVinylSizeV68114,Gravity.CENTER);
        vinylRecordV68114.setTranslationX(artworkSize*0.36f);
        vinylRecordV68114.setElevation(dp(2));
        // index 1 = au-dessus des waves, mais derrière la pochette (artwork passe index 2).
        artworkStage.addView(vinylRecordV68114,1,realVinylLpV68114);`);
}
if(!src.includes('vinylRecordV68114 = new VinylRecordView(this);')) throw new Error('V68.11.4 insertion vrai vinyle impossible');

// Supprime visuellement l'ancienne ombre et l'ancien faux disque.
src=src.replace(
  '        artwork.addView(shade, shadeLp);',
  '        artwork.addView(shade, shadeLp);\n        shade.setVisibility(View.GONE);'
);
src=src.replace(
  '        artwork.addView(disc, discLp);',
  '        artwork.addView(disc, discLp);\n        disc.setVisibility(View.GONE);'
);

src=replaceMethod(src,
  ['    private void setDiscPlaying(boolean playing) {','    private void setDiscPlaying(boolean playing){'],
String.raw`    private void setDiscPlaying(boolean playing){
        if(vinylRecordV68114==null) return;
        vinylRecordV68114.setVisibility(View.VISIBLE);
        vinylRecordV68114.setAlpha(1f);
        if(playing){
            if(discAnimator==null){
                discAnimator=ObjectAnimator.ofFloat(vinylRecordV68114,View.ROTATION,0f,360f);
                discAnimator.setDuration(12000L);
                discAnimator.setInterpolator(new LinearInterpolator());
                discAnimator.setRepeatCount(ValueAnimator.INFINITE);
                discAnimator.setRepeatMode(ValueAnimator.RESTART);
            }
            if(!discAnimator.isStarted()) discAnimator.start();
            else if(discAnimator.isPaused()) discAnimator.resume();
        }else if(discAnimator!=null&&discAnimator.isStarted()&&!discAnimator.isPaused()){
            discAnimator.pause();
        }
    }`,'setDiscPlaying');

src=replaceMethod(src,
  ['    private void restoreVinylV68108(){','    private void restoreVinylV68108() {'],
String.raw`    private void restoreVinylV68108(){
        // V68.11.4 : l'ancien disque reste désactivé; le nouveau est structurel dans artworkStage.
        if(disc!=null) disc.setVisibility(View.GONE);
        if(vinylRecordV68114!=null){
            vinylRecordV68114.setVisibility(View.VISIBLE);
            vinylRecordV68114.setAlpha(1f);
            if(!artworkSwiping&&!artworkTransitioning){
                vinylRecordV68114.animate().cancel();
                vinylRecordV68114.setTranslationY(0f);
                vinylRecordV68114.setScaleX(1f);
                vinylRecordV68114.setScaleY(1f);
            }
        }
        if(coverImage!=null){
            coverImage.setVisibility(View.VISIBLE);
            coverImage.setAlpha(1f);
            coverImage.bringToFront();
        }
    }`,'restoreVinylV68108');

src=replaceMethod(src,
  ['    private void ensureVinylVisibleV68111(){','    private void ensureVinylVisibleV68111() {'],
String.raw`    private void ensureVinylVisibleV68111(){
        if(disc!=null) disc.setVisibility(View.GONE);
        if(vinylRecordV68114!=null){
            vinylRecordV68114.setVisibility(View.VISIBLE);
            vinylRecordV68114.setAlpha(1f);
        }
    }`,'ensureVinylVisibleV68111');

// Mono-couleur riche + vrai noir. Le BackdropView ajoute le halo et la vignette.
src=replaceMethod(src,
  ['    private void applyArtworkTheme(Bitmap bitmap) {','    private void applyArtworkTheme(Bitmap bitmap){'],
String.raw`    private void applyArtworkTheme(Bitmap bitmap){
        if(bitmap==null||root==null) return;
        int dominant=extractSingleThemeColorV68113(bitmap);
        if(backdropV68114!=null) backdropV68114.setDominantColor(dominant);
        if(vinylRecordV68114!=null) vinylRecordV68114.setAccentColor(dominant);

        float[] hsv=new float[3];
        Color.colorToHSV(dominant,hsv);
        float hue=hsv[0];
        float sat=Math.max(0.40f,Math.min(0.76f,hsv[1]));
        int nextTop=Color.HSVToColor(new float[]{hue,sat,0.34f});
        int nextMid=Color.HSVToColor(new float[]{hue,Math.max(0.30f,sat*0.80f),0.17f});
        int nextBottom=Color.rgb(2,3,4);
        animateGradient(nextTop,nextMid,nextBottom);
    }`,'applyArtworkTheme');

await writeFile(playerPath,src,'utf8');
console.log('Audify V68.11.4 : vrai vinyle reconstruit + fond mono-couleur avec fondu profond vers noir.');
