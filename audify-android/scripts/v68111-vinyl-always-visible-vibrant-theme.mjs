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
  throw new Error(`V68.11.1 méthode introuvable: ${label}`);
}

// =============================================================================
// 1) VINYLE : visibilité garantie en permanence sur la page lecteur.
// =============================================================================
src=replaceMethod(src,
  ['    private void restoreVinylV68108(){','    private void restoreVinylV68108() {'],
String.raw`    private void restoreVinylV68108(){
        // V68.11.1 : le vinyle ne doit jamais disparaître de la page lecteur.
        if(disc!=null){
            disc.setVisibility(View.VISIBLE);
            disc.setAlpha(1f);
            if(!artworkSwiping&&!artworkTransitioning){
                disc.animate().cancel();
                disc.setTranslationX(0f);
                disc.setTranslationY(0f);
                disc.setScaleX(1f);
                disc.setScaleY(1f);
            }
            disc.bringToFront();
        }
        if(discImage!=null){
            discImage.setVisibility(View.VISIBLE);
            discImage.setAlpha(1f);
            if(discImage.getDrawable()==null&&coverImage!=null&&coverImage.getDrawable()!=null){
                discImage.setImageDrawable(coverImage.getDrawable());
            }
            discImage.invalidate();
        }
        if(coverImage!=null){
            coverImage.setVisibility(View.VISIBLE);
            coverImage.setAlpha(1f);
            coverImage.bringToFront();
        }
        if(disc!=null) disc.invalidate();
    }`,'restoreVinylV68108');

// Sécurité légère appelée par le ticker, même pendant un swipe : elle ne touche pas aux translations.
if(!src.includes('private void ensureVinylVisibleV68111()')){
  const marker='    private LinearLayout.LayoutParams weighted() {';
  if(!src.includes(marker)) throw new Error('V68.11.1 marker helper player introuvable');
  const helper=String.raw`    private void ensureVinylVisibleV68111(){
        if(disc!=null){disc.setVisibility(View.VISIBLE);disc.setAlpha(1f);}
        if(discImage!=null){
            discImage.setVisibility(View.VISIBLE);
            discImage.setAlpha(1f);
            if(discImage.getDrawable()==null&&coverImage!=null&&coverImage.getDrawable()!=null){
                discImage.setImageDrawable(coverImage.getDrawable());
            }
        }
    }

`;
  src=src.replace(marker,helper+marker);
}

src=src.replace(
  '    private void refreshFromPlayer() {\n        restoreVinylV68108();',
  '    private void refreshFromPlayer() {\n        ensureVinylVisibleV68111();\n        restoreVinylV68108();'
);
src=src.replace(
  '    private void refreshFromPlayer(){\n        restoreVinylV68108();',
  '    private void refreshFromPlayer(){\n        ensureVinylVisibleV68111();\n        restoreVinylV68108();'
);
src=src.replace(
  'uiHandler.postDelayed(()->artworkTransitioning=false,285L);',
  'uiHandler.postDelayed(()->{artworkTransitioning=false;restoreVinylV68108();},285L);'
);

// =============================================================================
// 2) CHARGEMENT POCHETTE : pochette + disque + thème recalculés ensemble.
// =============================================================================
src=replaceMethod(src,
  ['    private void loadArtwork(String rawUrl,String videoId){','    private void loadArtwork(String rawUrl, String videoId) {','    private void loadArtwork(String rawUrl, String videoId){'],
String.raw`    private void loadArtwork(String rawUrl,String videoId){
        final String imageUrl=rawUrl!=null&&!rawUrl.trim().isEmpty()
            ?rawUrl.trim()
            :(videoId==null||videoId.isEmpty()?"":"https://i.ytimg.com/vi/"+videoId+"/hqdefault.jpg");
        if(imageUrl.isEmpty()){
            ensureVinylVisibleV68111();
            return;
        }
        new Thread(()->{
            HttpURLConnection connection=null;
            try{
                connection=(HttpURLConnection)new URL(imageUrl).openConnection();
                connection.setConnectTimeout(7000);
                connection.setReadTimeout(7000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent","AudifyAndroid/68.11.1");
                try(InputStream input=connection.getInputStream()){
                    Bitmap bitmap=BitmapFactory.decodeStream(input);
                    if(bitmap!=null) runOnUiThread(()->{
                        if(coverImage!=null){
                            coverImage.setImageBitmap(bitmap);
                            coverImage.setVisibility(View.VISIBLE);
                            coverImage.setAlpha(1f);
                        }
                        if(discImage!=null){
                            discImage.setImageBitmap(bitmap);
                            discImage.setVisibility(View.VISIBLE);
                            discImage.setAlpha(1f);
                        }
                        applyArtworkTheme(bitmap);
                        restoreVinylV68108();
                    });
                }
            }catch(Throwable ignored){
                runOnUiThread(this::ensureVinylVisibleV68111);
            }finally{
                if(connection!=null) connection.disconnect();
            }
        },"audify-artwork-v68111").start();
    }`,'loadArtwork');

// =============================================================================
// 3) THÈME 3.0 : palette multi-couleurs beaucoup plus vive depuis la pochette.
// =============================================================================
src=replaceMethod(src,
  ['    private void applyArtworkTheme(Bitmap bitmap) {','    private void applyArtworkTheme(Bitmap bitmap){'],
String.raw`    private void applyArtworkTheme(Bitmap bitmap){
        if(bitmap==null||root==null) return;
        int[] palette=extractVibrantPaletteV68111(bitmap);
        int primary=palette[0];
        int secondary=palette[1];
        int tertiary=palette[2];

        // V68.11.1 : on garde volontairement beaucoup plus de couleur qu'avant.
        int nextTop=blendColor(primary,Color.BLACK,0.10f);
        int nextMid=blendColor(secondary,Color.BLACK,0.24f);
        int nextBottom=blendColor(tertiary,Color.BLACK,0.52f);
        animateGradient(nextTop,nextMid,nextBottom);
    }`,'applyArtworkTheme');

if(!src.includes('private int[] extractVibrantPaletteV68111(')){
  const marker='    private int extractDominantColor(Bitmap source) {';
  if(!src.includes(marker)) throw new Error('V68.11.1 marker palette introuvable');
  const paletteMethods=String.raw`    private int[] extractVibrantPaletteV68111(Bitmap source){
        int fallback=Color.rgb(42,74,108);
        if(source==null) return new int[]{fallback,Color.rgb(28,91,76),Color.rgb(40,48,88)};
        Bitmap sample=source;
        try{
            if(source.getWidth()>64||source.getHeight()>64){
                sample=Bitmap.createScaledBitmap(source,64,64,true);
            }
            final int binsCount=24;
            float[] score=new float[binsCount];
            float[] sumR=new float[binsCount];
            float[] sumG=new float[binsCount];
            float[] sumB=new float[binsCount];
            float[] sumW=new float[binsCount];
            float[] hsv=new float[3];

            for(int y=0;y<sample.getHeight();y++){
                for(int x=0;x<sample.getWidth();x++){
                    int c=sample.getPixel(x,y);
                    if(Color.alpha(c)<150) continue;
                    int r=Color.red(c),g=Color.green(c),b=Color.blue(c);
                    Color.RGBToHSV(r,g,b,hsv);
                    float sat=hsv[1],val=hsv[2];
                    if(val<0.10f||val>0.98f) continue;
                    int bin=Math.min(binsCount-1,Math.max(0,(int)(hsv[0]/15f)));
                    // Couleurs présentes + saturation + luminosité moyenne sont privilégiées.
                    float w=(0.18f+sat*1.95f)*(0.40f+Math.min(0.92f,val)*0.92f);
                    if(sat<0.16f) w*=0.32f;
                    score[bin]+=w;
                    sumR[bin]+=r*w; sumG[bin]+=g*w; sumB[bin]+=b*w; sumW[bin]+=w;
                }
            }

            int first=bestPaletteBinV68111(score,-1,0);
            int second=bestPaletteBinV68111(score,first,4);
            int third=bestPaletteBinV68111(score,first,7);
            if(second<0) second=bestPaletteBinV68111(score,first,2);
            if(third<0) third=bestPaletteBinV68111(score,second,3);
            if(first<0) return new int[]{fallback,Color.rgb(28,91,76),Color.rgb(40,48,88)};
            if(second<0) second=first;
            if(third<0) third=second;

            int c1=vibrantBinColorV68111(first,sumR,sumG,sumB,sumW);
            int c2=vibrantBinColorV68111(second,sumR,sumG,sumB,sumW);
            int c3=vibrantBinColorV68111(third,sumR,sumG,sumB,sumW);
            return new int[]{c1,c2,c3};
        }catch(Throwable ignored){
            return new int[]{fallback,Color.rgb(28,91,76),Color.rgb(40,48,88)};
        }finally{
            if(sample!=null&&sample!=source) sample.recycle();
        }
    }

    private int bestPaletteBinV68111(float[] score,int avoid,int minDistance){
        int best=-1; float bestScore=-1f;
        for(int i=0;i<score.length;i++){
            if(score[i]<=0f) continue;
            if(avoid>=0&&minDistance>0){
                int d=Math.abs(i-avoid); d=Math.min(d,score.length-d);
                if(d<minDistance) continue;
            }
            if(score[i]>bestScore){bestScore=score[i];best=i;}
        }
        return best;
    }

    private int vibrantBinColorV68111(int bin,float[] r,float[] g,float[] b,float[] w){
        if(bin<0||bin>=w.length||w[bin]<=0f) return Color.rgb(42,74,108);
        int raw=Color.rgb(
            Math.max(0,Math.min(255,Math.round(r[bin]/w[bin]))),
            Math.max(0,Math.min(255,Math.round(g[bin]/w[bin]))),
            Math.max(0,Math.min(255,Math.round(b[bin]/w[bin])))
        );
        float[] hsv=new float[3];
        Color.colorToHSV(raw,hsv);
        hsv[1]=Math.max(0.58f,Math.min(0.94f,hsv[1]*1.28f));
        hsv[2]=Math.max(0.48f,Math.min(0.86f,hsv[2]*1.10f));
        return Color.HSVToColor(hsv);
    }

`;
  src=src.replace(marker,paletteMethods+marker);
}

// Le dégradé lui-même devient plus présent, tout en gardant le bas lisible pour le lecteur.
src=src.replace(
  'getWindow().setStatusBarColor(blendColor(top, Color.BLACK, 0.38f));',
  'getWindow().setStatusBarColor(blendColor(top,Color.BLACK,0.28f));'
);

await writeFile(playerPath,src,'utf8');
console.log('Audify V68.11.1 : vinyle permanent + thème dynamique vibrant multi-couleurs restauré et renforcé.');
