import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');

function replaceRequired(source,needle,replacement,label){
  if(!source.includes(needle)) throw new Error(`V68.11.5 bloc introuvable: ${label}`);
  return source.replace(needle,replacement);
}

// =============================================================================
// 1) VRAI PICTURE-DISC : la miniature est réellement imprimée sur le vinyle.
// =============================================================================
const vinyl=String.raw`package com.nova.audify;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.SweepGradient;
import android.util.AttributeSet;
import android.view.View;

/** Audify V68.11.5 — picture-disc compact, miniature + sillons + reflets vinyle. */
public final class VinylRecordView extends View {
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke=new Paint(Paint.ANTI_ALIAS_FLAG);
    private Bitmap artworkBitmap;
    private int accent=Color.rgb(145,94,43);

    public VinylRecordView(Context c){super(c);init();}
    public VinylRecordView(Context c,AttributeSet a){super(c,a);init();}

    private void init(){
        setLayerType(View.LAYER_TYPE_SOFTWARE,null);
        setClickable(false);
        setFocusable(false);
    }

    public void setAccentColor(int color){accent=color;invalidate();}
    public void setArtworkBitmap(Bitmap bitmap){artworkBitmap=bitmap;invalidate();}

    @Override protected void onDraw(Canvas canvas){
        super.onDraw(canvas);
        float w=getWidth(),h=getHeight();
        float cx=w/2f,cy=h/2f;
        float r=Math.max(1f,Math.min(w,h)/2f-2f);

        // Bord / corps noir du vrai disque.
        paint.setStyle(Paint.Style.FILL);
        paint.setShader(new RadialGradient(cx-r*0.16f,cy-r*0.20f,r*1.26f,
            new int[]{Color.rgb(40,43,47),Color.rgb(15,17,20),Color.rgb(4,5,7),Color.BLACK},
            new float[]{0f,0.34f,0.79f,1f},Shader.TileMode.CLAMP));
        canvas.drawCircle(cx,cy,r,paint);
        paint.setShader(null);

        // La pochette devient un vrai picture-disc, tout en laissant un anneau noir externe.
        if(artworkBitmap!=null&&!artworkBitmap.isRecycled()){
            BitmapShader shader=new BitmapShader(artworkBitmap,Shader.TileMode.CLAMP,Shader.TileMode.CLAMP);
            float bw=Math.max(1f,artworkBitmap.getWidth());
            float bh=Math.max(1f,artworkBitmap.getHeight());
            float targetDiameter=r*1.78f;
            float scale=Math.max(targetDiameter/bw,targetDiameter/bh);
            Matrix matrix=new Matrix();
            matrix.setScale(scale,scale);
            float dx=cx-bw*scale/2f;
            float dy=cy-bh*scale/2f;
            matrix.postTranslate(dx,dy);
            shader.setLocalMatrix(matrix);
            paint.setShader(shader);
            paint.setAlpha(224);
            canvas.drawCircle(cx,cy,r*0.89f,paint);
            paint.setAlpha(255);
            paint.setShader(null);

            // Teinte noire légère : l'image reste lisible mais le matériau reste vinyle.
            paint.setColor(Color.argb(42,0,0,0));
            canvas.drawCircle(cx,cy,r*0.89f,paint);
        }

        // Sillons au-dessus de la miniature : ils doivent rester clairement visibles.
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(Math.max(1f,r*0.0048f));
        for(int i=0;i<31;i++){
            float rr=r*(0.28f+i*0.0205f);
            int alpha=(i%5==0)?92:((i%2==0)?56:38);
            stroke.setColor(Color.argb(alpha,238,241,245));
            canvas.drawCircle(cx,cy,rr,stroke);
        }

        // Reflets circulaires premium.
        SweepGradient sheen=new SweepGradient(cx,cy,
            new int[]{Color.TRANSPARENT,Color.argb(105,255,255,255),Color.TRANSPARENT,Color.argb(48,211,219,227),Color.TRANSPARENT},
            new float[]{0f,0.10f,0.24f,0.63f,1f});
        stroke.setShader(sheen);
        stroke.setStrokeWidth(r*0.068f);
        canvas.drawCircle(cx,cy,r*0.72f,stroke);
        stroke.setShader(null);

        // Anneau extérieur noir + bord métallique fin.
        stroke.setStrokeWidth(r*0.065f);
        stroke.setColor(Color.argb(210,2,3,5));
        canvas.drawCircle(cx,cy,r*0.955f,stroke);
        stroke.setStrokeWidth(Math.max(1.3f,r*0.009f));
        stroke.setColor(Color.argb(210,216,222,230));
        canvas.drawCircle(cx,cy,r-1.5f,stroke);

        // Label central discret, lié à la couleur dominante de la pochette.
        int label=blend(accent,Color.BLACK,0.64f);
        paint.setStyle(Paint.Style.FILL);
        paint.setShader(new RadialGradient(cx-r*0.04f,cy-r*0.05f,r*0.18f,
            new int[]{blend(label,Color.WHITE,0.10f),label,blend(label,Color.BLACK,0.40f)},
            new float[]{0f,0.62f,1f},Shader.TileMode.CLAMP));
        canvas.drawCircle(cx,cy,r*0.17f,paint);
        paint.setShader(null);
        stroke.setStrokeWidth(Math.max(1f,r*0.006f));
        stroke.setColor(Color.argb(175,238,241,245));
        canvas.drawCircle(cx,cy,r*0.17f,stroke);

        // Trou central.
        paint.setColor(Color.rgb(2,3,4));
        canvas.drawCircle(cx,cy,Math.max(2.4f,r*0.021f),paint);
        stroke.setColor(Color.argb(205,245,247,250));
        stroke.setStrokeWidth(Math.max(1f,r*0.005f));
        canvas.drawCircle(cx,cy,Math.max(2.4f,r*0.021f),stroke);
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
// 2) POSITION : disque plus petit, réellement derrière la pochette et à moitié rentré.
// =============================================================================
let src=await readFile(playerPath,'utf8');

src=replaceRequired(src,
  '        int realVinylSizeV68114=(int)(artworkSize*0.96f);',
  '        int realVinylSizeV68114=(int)(artworkSize*0.84f);',
  'taille du vinyle');

src=replaceRequired(src,
  '        vinylRecordV68114.setTranslationX(artworkSize*0.36f);',
  '        vinylRecordV68114.setTranslationX(artworkSize*0.45f);',
  'position du vinyle');

// Le vinyle doit être derrière la sleeve : pas d elevation supérieure au cover.
src=replaceRequired(src,
  '        vinylRecordV68114.setElevation(dp(2));',
  '        vinylRecordV68114.setElevation(0f);\n        artwork.setElevation(dp(3));',
  'z-order sleeve/vinyle');

// La miniature chargée est transmise directement au picture-disc à chaque morceau.
const themeNeedle='        if(vinylRecordV68114!=null) vinylRecordV68114.setAccentColor(dominant);';
if(!src.includes(themeNeedle)) throw new Error('V68.11.5 hook artwork theme introuvable');
src=src.replace(themeNeedle,
  '        if(vinylRecordV68114!=null){\n            vinylRecordV68114.setAccentColor(dominant);\n            vinylRecordV68114.setArtworkBitmap(bitmap);\n        }');

await writeFile(playerPath,src,'utf8');
console.log('Audify V68.11.5 : vinyle compact a demi rentre derriere la pochette + miniature picture-disc.');
