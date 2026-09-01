import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const loginPath=path.join(pkgDir,'AudifyLoginActivity.java');
const gradlePath=path.join(android,'app','build.gradle');

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
  throw new Error(`V68.12.29 méthode introuvable: ${label}`);
}
function replaceMethod(source,signatures,replacement,label){
  const f=findMethod(source,signatures,label);
  return source.slice(0,f.start)+replacement+source.slice(f.end);
}

// Encodeur GIF pur Java, compatible Android : utilisé seulement pour les GIF > 10 Mo.
let gradle=await readFile(gradlePath,'utf8');
if(!gradle.includes('com.squareup:gifencoder:0.10.1')){
  const marker='dependencies {';
  if(!gradle.includes(marker))throw new Error('V68.12.29 bloc dependencies introuvable');
  gradle=gradle.replace(marker,marker+'\n    implementation "com.squareup:gifencoder:0.10.1"');
  await writeFile(gradlePath,gradle,'utf8');
}

let login=await readFile(loginPath,'utf8');
const classMarker='public class AudifyLoginActivity extends AppCompatActivity {';
if(!login.includes(classMarker))throw new Error('V68.12.29 classe compte introuvable');
if(!login.includes('v681229ProfileMessage')){
  login=login.replace(classMarker,classMarker+'\n    private volatile String v681229ProfileMessage="";');
}

const chooseMarker='    private void chooseProfilePhotoV681226(){';
if(!login.includes(chooseMarker))throw new Error('V68.12.29 repère galerie introuvable');
if(!login.includes('encodeOptimizedGifV681229')){
  const helpers=String.raw`    private boolean encodeOptimizedGifV681229(java.io.File source,java.io.File output,int side,int fps,int maxDurationMs){
        android.graphics.Movie movie=null;
        android.graphics.Bitmap frame=null;
        try{
            movie=android.graphics.Movie.decodeFile(source.getAbsolutePath());
            if(movie==null||movie.width()<=0||movie.height()<=0)return false;
            int originalDuration=movie.duration();
            if(originalDuration<=0)originalDuration=1000;
            int duration=Math.max(125,Math.min(originalDuration,maxDurationMs));
            int delay=Math.max(80,1000/Math.max(1,fps));
            int frameCount=Math.max(1,(int)Math.ceil(duration/(double)delay));

            if(output.exists())output.delete();
            try(java.io.FileOutputStream stream=new java.io.FileOutputStream(output,false)){
                com.squareup.gifencoder.GifEncoder encoder=new com.squareup.gifencoder.GifEncoder(stream,side,side,0);
                com.squareup.gifencoder.ImageOptions options=new com.squareup.gifencoder.ImageOptions();
                options.setDelay(delay,java.util.concurrent.TimeUnit.MILLISECONDS);
                frame=android.graphics.Bitmap.createBitmap(side,side,android.graphics.Bitmap.Config.ARGB_8888);
                android.graphics.Canvas canvas=new android.graphics.Canvas(frame);
                android.graphics.Paint paint=new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG|android.graphics.Paint.FILTER_BITMAP_FLAG);
                float scale=Math.max(side/(float)movie.width(),side/(float)movie.height());
                float tx=(side-movie.width()*scale)/2f;
                float ty=(side-movie.height()*scale)/2f;
                int[] pixels=new int[side*side];
                for(int index=0;index<frameCount;index++){
                    frame.eraseColor(android.graphics.Color.rgb(7,11,17));
                    canvas.save();
                    canvas.translate(tx,ty);
                    canvas.scale(scale,scale);
                    int time=Math.min(Math.max(0,index*delay),Math.max(0,duration-1));
                    movie.setTime(time);
                    movie.draw(canvas,0f,0f,paint);
                    canvas.restore();

                    frame.getPixels(pixels,0,side,0,0,side,side);
                    int[][] rgb=new int[side][side];
                    for(int y=0;y<side;y++){
                        int row=y*side;
                        for(int x=0;x<side;x++)rgb[y][x]=pixels[row+x]&0x00FFFFFF;
                    }
                    encoder.addImage(rgb,options);
                }
                encoder.finishEncoding();
                stream.flush();
            }
            return output.isFile()&&output.length()>0L;
        }catch(Throwable ignored){
            if(output.exists())output.delete();
            return false;
        }finally{
            if(frame!=null&&!frame.isRecycled())frame.recycle();
        }
    }

    private boolean optimizeLargeGifV681229(java.io.File source,java.io.File target){
        final long max=10L*1024L*1024L;
        java.io.File optimized=new java.io.File(getFilesDir(),target.getName()+".optimized.tmp");
        try{
            // Profil mobile : 256 px est largement supérieur à l'avatar affiché.
            // 8 i/s et 10 s max réduisent fortement la taille sans perdre l'effet animé.
            boolean ok=encodeOptimizedGifV681229(source,optimized,256,8,10000);
            if(!ok)return false;
            if(optimized.length()>max){
                optimized.delete();
                // Secours pour les animations extrêmement complexes.
                ok=encodeOptimizedGifV681229(source,optimized,192,5,6000);
                if(!ok||optimized.length()>max){optimized.delete();return false;}
            }
            if(target.exists()&&!target.delete()){optimized.delete();return false;}
            if(!optimized.renameTo(target)){
                try(java.io.FileInputStream in=new java.io.FileInputStream(optimized);
                    java.io.FileOutputStream out=new java.io.FileOutputStream(target,false)){
                    byte[] b=new byte[16384];int n;while((n=in.read(b))>0)out.write(b,0,n);out.flush();
                }
                optimized.delete();
            }
            return target.isFile()&&target.length()>0L&&target.length()<=max;
        }catch(Throwable ignored){
            optimized.delete();
            return false;
        }
    }

`;
  login=login.replace(chooseMarker,helpers+chooseMarker);
}

// V68.12.28 refusait dès 10 Mo. V68.12.29 garde le fichier intact <=10 Mo,
// puis optimise automatiquement jusqu'à 50 Mo d'entrée.
login=replaceMethod(login,[
  '    private boolean saveGifProfileV681228(android.net.Uri uri){',
  '    private boolean saveGifProfileV681228(android.net.Uri uri) {'
],String.raw`    private boolean saveGifProfileV681228(android.net.Uri uri){
        final long accepted=10L*1024L*1024L;
        final long sourceLimit=50L*1024L*1024L;
        java.io.File target=profilePhotoGifFileV681228();
        java.io.File jpg=profilePhotoJpgFileV681228();
        java.io.File sourceTemp=new java.io.File(getFilesDir(),target.getName()+".source.tmp");
        long total=0L;
        v681229ProfileMessage="";
        try(java.io.InputStream in=getContentResolver().openInputStream(uri);
            java.io.FileOutputStream out=new java.io.FileOutputStream(sourceTemp,false)){
            if(in==null)return false;
            byte[] buffer=new byte[16384];int n;
            while((n=in.read(buffer))>0){
                total+=n;
                if(total>sourceLimit){
                    sourceTemp.delete();
                    v681229ProfileMessage="GIF trop volumineux : Audify accepte jusqu'à 50 Mo avant optimisation.";
                    return false;
                }
                out.write(buffer,0,n);
            }
            out.flush();
        }catch(Exception e){sourceTemp.delete();return false;}
        if(total<=0L){sourceTemp.delete();return false;}

        boolean ok=false;
        if(total<=accepted){
            try{
                if(target.exists())target.delete();
                if(!sourceTemp.renameTo(target)){
                    try(java.io.FileInputStream in=new java.io.FileInputStream(sourceTemp);
                        java.io.FileOutputStream out=new java.io.FileOutputStream(target,false)){
                        byte[] b=new byte[16384];int n;while((n=in.read(b))>0)out.write(b,0,n);out.flush();
                    }
                    sourceTemp.delete();
                }
                ok=target.isFile()&&target.length()>0L;
                if(ok)v681229ProfileMessage="GIF de profil mis à jour.";
            }catch(Exception ignored){ok=false;}
        }else{
            v681229ProfileMessage="Ce GIF dépasse 10 Mo : optimisation automatique en cours…";
            ok=optimizeLargeGifV681229(sourceTemp,target);
            sourceTemp.delete();
            if(ok)v681229ProfileMessage="GIF optimisé automatiquement pour Audify.";
            else v681229ProfileMessage="Impossible d'optimiser ce GIF sous 10 Mo.";
        }

        if(ok){
            if(jpg.exists())jpg.delete();
            target.setLastModified(System.currentTimeMillis());
        }else if(sourceTemp.exists())sourceTemp.delete();
        return ok;
    }`,'saveGifProfileV681228');

// Le réencodage peut prendre quelques secondes : aucune opération lourde sur l'UI.
const onResult=findMethod(login,[
  '    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){',
  '    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data){'
],'onActivityResult');
let body=login.slice(onResult.brace+1,onResult.end-1);
const oldBlock=String.raw`
        if(requestCode==681226){
            if(resultCode==RESULT_OK&&data!=null&&data.getData()!=null){
                boolean ok=saveProfilePhotoV681226(data.getData());
                android.widget.Toast.makeText(this,ok?"Photo de profil mise à jour.":"Impossible de lire cette image.",android.widget.Toast.LENGTH_SHORT).show();
                if(ok)renderProfile();
            }
            return;
        }`;
const newBlock=String.raw`
        if(requestCode==681226){
            if(resultCode==RESULT_OK&&data!=null&&data.getData()!=null){
                final android.net.Uri selected=data.getData();
                try{
                    int flags=data.getFlags()&Intent.FLAG_GRANT_READ_URI_PERMISSION;
                    if(flags!=0)getContentResolver().takePersistableUriPermission(selected,flags);
                }catch(Exception ignored){}
                v681229ProfileMessage="";
                android.widget.Toast.makeText(this,"Préparation de l'avatar…",android.widget.Toast.LENGTH_SHORT).show();
                new Thread(()->{
                    final boolean ok=saveProfilePhotoV681226(selected);
                    final String custom=v681229ProfileMessage;
                    runOnUiThread(()->{
                        if(isFinishing()||isDestroyed())return;
                        String message=!custom.isEmpty()?custom:(ok?"Photo de profil mise à jour.":"Impossible de lire cette image.");
                        android.widget.Toast.makeText(this,message,android.widget.Toast.LENGTH_LONG).show();
                        if(ok)renderProfile();
                    });
                },"Audify-Profile-Optimizer").start();
            }
            return;
        }`;
if(!body.includes(oldBlock))throw new Error('V68.12.29 bloc résultat photo introuvable');
body=body.replace(oldBlock,newBlock);
login=login.slice(0,onResult.brace+1)+body+login.slice(onResult.end-1);

login=login.replace(
  'Photo ou GIF animé · 10 Mo max. Ton avatar reste privé sur cet appareil.',
  'Photo ou GIF animé · au-delà de 10 Mo, Audify optimise automatiquement le GIF.'
);

await writeFile(loginPath,login,'utf8');
console.log('Audify Android V68.12.29 : GIF >10 Mo optimisés automatiquement en arrière-plan, durée/résolution/FPS adaptés, limite source 50 Mo.');
