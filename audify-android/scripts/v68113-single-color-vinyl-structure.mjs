import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const playerPath=path.join(root,'android','app','src','main','java','com','nova','audify','NativePlayerActivity.java');
let src=await readFile(playerPath,'utf8');

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
  throw new Error(`V68.11.3 méthode introuvable: ${label}`);
}

// =============================================================================
// 1) THÈME STRICT : une SEULE couleur dominante par morceau.
//    On ne change que luminosité/saturation, jamais la teinte.
// =============================================================================
src=replaceMethod(src,
  ['    private void applyArtworkTheme(Bitmap bitmap) {','    private void applyArtworkTheme(Bitmap bitmap){'],
String.raw`    private void applyArtworkTheme(Bitmap bitmap){
        if(bitmap==null||root==null) return;
        int dominant=extractSingleThemeColorV68113(bitmap);
        float[] hsv=new float[3];
        Color.colorToHSV(dominant,hsv);

        // Une seule teinte sur tout l'écran. Seules profondeur et luminosité varient.
        float hue=hsv[0];
        float sat=Math.max(0.48f,Math.min(0.82f,hsv[1]));
        int nextTop=Color.HSVToColor(new float[]{hue,sat,Math.max(0.32f,Math.min(0.54f,hsv[2]*0.88f))});
        int nextMid=Color.HSVToColor(new float[]{hue,Math.max(0.40f,sat*0.90f),Math.max(0.22f,Math.min(0.39f,hsv[2]*0.64f))});
        int nextBottom=Color.HSVToColor(new float[]{hue,Math.max(0.32f,sat*0.78f),Math.max(0.09f,Math.min(0.19f,hsv[2]*0.34f))});
        animateGradient(nextTop,nextMid,nextBottom);
    }`,'applyArtworkTheme');

if(!src.includes('private int extractSingleThemeColorV68113(')){
  const marker='    private int extractDominantColor(Bitmap source) {';
  if(!src.includes(marker)) throw new Error('V68.11.3 marker extractDominantColor introuvable');
  const helper=String.raw`    private int extractSingleThemeColorV68113(Bitmap source){
        int fallback=Color.rgb(45,84,112);
        if(source==null) return fallback;
        Bitmap sample=source;
        try{
            if(source.getWidth()>72||source.getHeight()>72) sample=Bitmap.createScaledBitmap(source,72,72,true);
            final int bins=36;
            float[] score=new float[bins];
            float[] rr=new float[bins],gg=new float[bins],bb=new float[bins],ww=new float[bins];
            float[] hsv=new float[3];
            for(int y=0;y<sample.getHeight();y++){
                for(int x=0;x<sample.getWidth();x++){
                    int c=sample.getPixel(x,y);
                    if(Color.alpha(c)<160) continue;
                    int r=Color.red(c),g=Color.green(c),b=Color.blue(c);
                    Color.RGBToHSV(r,g,b,hsv);
                    float sat=hsv[1],val=hsv[2];
                    if(val<0.12f||val>0.97f) continue;
                    int bin=Math.min(bins-1,Math.max(0,(int)(hsv[0]/10f)));
                    // La présence réelle reste prioritaire; saturation modérée évite gris/noir.
                    float w=(0.42f+sat*1.45f)*(0.42f+val*0.82f);
                    if(sat<0.12f) w*=0.16f;
                    score[bin]+=w; rr[bin]+=r*w; gg[bin]+=g*w; bb[bin]+=b*w; ww[bin]+=w;
                }
            }
            int best=-1; float bestScore=-1f;
            for(int i=0;i<bins;i++) if(score[i]>bestScore){bestScore=score[i];best=i;}
            if(best<0||ww[best]<=0f) return fallback;
            int raw=Color.rgb(
                Math.max(0,Math.min(255,Math.round(rr[best]/ww[best]))),
                Math.max(0,Math.min(255,Math.round(gg[best]/ww[best]))),
                Math.max(0,Math.min(255,Math.round(bb[best]/ww[best])))
            );
            Color.colorToHSV(raw,hsv);
            hsv[1]=Math.max(0.50f,Math.min(0.80f,hsv[1]*1.10f));
            hsv[2]=Math.max(0.42f,Math.min(0.68f,hsv[2]*0.90f));
            return Color.HSVToColor(hsv);
        }catch(Throwable ignored){return fallback;}
        finally{if(sample!=null&&sample!=source) sample.recycle();}
    }

`;
  src=src.replace(marker,helper+marker);
}

// =============================================================================
// 2) VINYLE STRUCTUREL : plus exposé + sillons visibles + reflet de pochette.
// =============================================================================
// Le disque est volontairement davantage sorti de la sleeve.
if(src.includes('        discLp.rightMargin=dp(2);')){
  src=src.replace('        discLp.rightMargin=dp(2);','        discLp.rightMargin=-dp(18);');
}

// Renforce le disque noir lui-même, sans dépendre de l'image de pochette.
src=src.replace('        discBg.setColor(Color.rgb(5,7,10));','        discBg.setColor(Color.rgb(3,4,6));');
src=src.replace('        discBg.setStroke(dp(4),Color.argb(205,231,238,249));','        discBg.setStroke(dp(3),Color.argb(230,224,231,240));');

// L'image reste présente mais devient un reflet discret : le vinyle reste visuellement noir.
if(!src.includes('discImage.setAlpha(0.34f);')){
  src=src.replace(
    '        discImage.setScaleType(ImageView.ScaleType.CENTER_CROP);',
    '        discImage.setScaleType(ImageView.ScaleType.CENTER_CROP);\n        discImage.setAlpha(0.34f);'
  );
}

// Ajoute de vrais sillons au-dessus de l'image du disque.
if(!src.includes('vinylGroovesV68113')){
  const needle='        disc.addView(discImage,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));';
  if(!src.includes(needle)) throw new Error('V68.11.3 insertion discImage introuvable');
  const grooves=String.raw`        disc.addView(discImage,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        View vinylGroovesV68113=new View(this){
            private final android.graphics.Paint ringPaint=new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
            private final android.graphics.Paint labelPaint=new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
            @Override protected void onDraw(android.graphics.Canvas canvas){
                super.onDraw(canvas);
                float cx=getWidth()/2f,cy=getHeight()/2f;
                float max=Math.min(getWidth(),getHeight())/2f;
                ringPaint.setStyle(android.graphics.Paint.Style.STROKE);
                ringPaint.setStrokeWidth(Math.max(1f,dp(1)*0.72f));
                for(int i=0;i<9;i++){
                    float radius=max*(0.38f+i*0.065f);
                    int alpha=38+(i%3)*18;
                    ringPaint.setColor(Color.argb(alpha,235,241,248));
                    canvas.drawCircle(cx,cy,radius,ringPaint);
                }
                ringPaint.setStrokeWidth(dp(2));
                ringPaint.setColor(Color.argb(150,245,248,252));
                canvas.drawCircle(cx,cy,max-dp(4),ringPaint);
                labelPaint.setStyle(android.graphics.Paint.Style.FILL);
                labelPaint.setColor(Color.argb(185,12,15,20));
                canvas.drawCircle(cx,cy,max*0.20f,labelPaint);
                ringPaint.setColor(Color.argb(210,255,255,255));
                ringPaint.setStrokeWidth(dp(2));
                canvas.drawCircle(cx,cy,max*0.20f,ringPaint);
            }
        };
        vinylGroovesV68113.setClickable(false);
        disc.addView(vinylGroovesV68113,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));`;
  src=src.replace(needle,grooves);
}

// Sécurité permanente : position repos du disque légèrement vers la droite.
src=replaceMethod(src,
  ['    private void restoreVinylV68108(){','    private void restoreVinylV68108() {'],
String.raw`    private void restoreVinylV68108(){
        if(disc!=null){
            disc.setVisibility(View.VISIBLE);
            disc.setAlpha(1f);
            if(!artworkSwiping&&!artworkTransitioning){
                disc.animate().cancel();
                disc.setTranslationX(dp(18));
                disc.setTranslationY(0f);
                disc.setScaleX(1f);
                disc.setScaleY(1f);
            }
            disc.bringToFront();
        }
        if(discImage!=null){
            discImage.setVisibility(View.VISIBLE);
            discImage.setAlpha(0.34f);
            if(discImage.getDrawable()==null&&coverImage!=null&&coverImage.getDrawable()!=null){
                discImage.setImageDrawable(coverImage.getDrawable());
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
        if(disc!=null){
            disc.setVisibility(View.VISIBLE);
            disc.setAlpha(1f);
            if(!artworkSwiping&&!artworkTransitioning) disc.setTranslationX(dp(18));
        }
        if(discImage!=null){
            discImage.setVisibility(View.VISIBLE);
            discImage.setAlpha(0.34f);
            if(discImage.getDrawable()==null&&coverImage!=null&&coverImage.getDrawable()!=null){
                discImage.setImageDrawable(coverImage.getDrawable());
            }
        }
    }`,'ensureVinylVisibleV68111');

// Quand l'artwork charge, ne remonte pas l'alpha de l'image du disque à 1.
src=src.replace('                            discImage.setAlpha(1f);','                            discImage.setAlpha(0.34f);');

await writeFile(playerPath,src,'utf8');
console.log('Audify V68.11.3 : thème strict mono-couleur + vinyle structurel plus exposé avec sillons.');
