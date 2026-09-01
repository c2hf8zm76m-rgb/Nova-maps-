import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const loginPath=path.join(pkgDir,'AudifyLoginActivity.java');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
await mkdir(pkgDir,{recursive:true});

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
  throw new Error(`V68.12.28 méthode introuvable: ${label}`);
}
function replaceMethod(source,signatures,replacement,label){
  const f=findMethod(source,signatures,label);
  return source.slice(0,f.start)+replacement+source.slice(f.end);
}

// Drawable unique pour photo fixe OU GIF animé. Android 9+ anime nativement les GIF;
// sur Android plus ancien, Audify affiche proprement la première frame sans crash.
const media=String.raw`package com.nova.audify;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.graphics.drawable.Animatable;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.view.Gravity;
import android.view.View;

import java.io.File;

/** Audify V68.12.28 — rendu d'avatar fixe ou GIF animé. */
public final class AudifyProfileMedia {
    private AudifyProfileMedia(){}

    public static boolean isGif(File file){
        return file!=null&&file.isFile()&&file.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".gif");
    }

    public static boolean apply(Context context,View view,File file){
        if(context==null||view==null||file==null||!file.isFile())return false;
        try{
            Drawable drawable;
            if(isGif(file)&&Build.VERSION.SDK_INT>=28){
                drawable=decodeApi28(file);
            }else{
                Bitmap bitmap=BitmapFactory.decodeFile(file.getAbsolutePath());
                if(bitmap==null)return false;
                drawable=new BitmapDrawable(context.getResources(),bitmap);
            }
            if(drawable==null)return false;
            view.setForeground(drawable);
            view.setForegroundGravity(Gravity.FILL);
            view.setClipToOutline(true);
            if(drawable instanceof Animatable)((Animatable)drawable).start();
            return true;
        }catch(Throwable ignored){
            try{
                Bitmap bitmap=BitmapFactory.decodeFile(file.getAbsolutePath());
                if(bitmap==null)return false;
                view.setForeground(new BitmapDrawable(context.getResources(),bitmap));
                view.setForegroundGravity(Gravity.FILL);
                view.setClipToOutline(true);
                return true;
            }catch(Throwable ignoredAgain){return false;}
        }
    }

    @android.annotation.TargetApi(28)
    private static Drawable decodeApi28(File file)throws Exception{
        ImageDecoder.Source source=ImageDecoder.createSource(file);
        return ImageDecoder.decodeDrawable(source,(decoder,info,src)->decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE));
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyProfileMedia.java'),media,'utf8');

let login=await readFile(loginPath,'utf8');

// Un compte possède au maximum un média de profil actif : .gif prioritaire, sinon .jpg.
login=replaceMethod(login,[
  '    private java.io.File profilePhotoFileV681226(){',
  '    private java.io.File profilePhotoFileV681226() {'
],String.raw`    private java.io.File profilePhotoFileV681226(){
        String uid=accounts==null?"":accounts.getCurrentUid();
        if(uid==null)uid="";
        String safe=uid.trim().replaceAll("[^A-Za-z0-9._-]","_");
        if(safe.isEmpty())safe="guest";
        java.io.File gif=new java.io.File(getFilesDir(),"audify_profile_"+safe+".gif");
        if(gif.isFile()&&gif.length()>0L)return gif;
        return new java.io.File(getFilesDir(),"audify_profile_"+safe+".jpg");
    }`,'profilePhotoFileV681226 login');

const chooseMarker='    private void chooseProfilePhotoV681226(){';
if(!login.includes('private java.io.File profilePhotoGifFileV681228()')){
  const helpers=String.raw`    private java.io.File profilePhotoTypedFileV681228(String extension){
        String uid=accounts==null?"":accounts.getCurrentUid();
        if(uid==null)uid="";
        String safe=uid.trim().replaceAll("[^A-Za-z0-9._-]","_");
        if(safe.isEmpty())safe="guest";
        return new java.io.File(getFilesDir(),"audify_profile_"+safe+extension);
    }

    private java.io.File profilePhotoGifFileV681228(){return profilePhotoTypedFileV681228(".gif");}
    private java.io.File profilePhotoJpgFileV681228(){return profilePhotoTypedFileV681228(".jpg");}

    private boolean isGifUriV681228(android.net.Uri uri){
        if(uri==null)return false;
        try{
            String type=getContentResolver().getType(uri);
            if(type!=null&&type.toLowerCase(java.util.Locale.ROOT).contains("gif"))return true;
        }catch(Exception ignored){}
        try(java.io.InputStream in=getContentResolver().openInputStream(uri)){
            if(in==null)return false;
            byte[] head=new byte[6];
            int n=in.read(head);
            if(n!=6)return false;
            String magic=new String(head,java.nio.charset.StandardCharsets.US_ASCII);
            return "GIF87a".equals(magic)||"GIF89a".equals(magic);
        }catch(Exception ignored){return false;}
    }

    private boolean saveGifProfileV681228(android.net.Uri uri){
        final long max=10L*1024L*1024L;
        java.io.File target=profilePhotoGifFileV681228();
        java.io.File jpg=profilePhotoJpgFileV681228();
        java.io.File temp=new java.io.File(getFilesDir(),target.getName()+".tmp");
        long total=0L;
        try(java.io.InputStream in=getContentResolver().openInputStream(uri);
            java.io.FileOutputStream out=new java.io.FileOutputStream(temp,false)){
            if(in==null)return false;
            byte[] buffer=new byte[16384];
            int n;
            while((n=in.read(buffer))>0){
                total+=n;
                if(total>max){temp.delete();return false;}
                out.write(buffer,0,n);
            }
            out.flush();
        }catch(Exception e){temp.delete();return false;}
        if(total<=0L){temp.delete();return false;}
        if(target.exists())target.delete();
        if(!temp.renameTo(target)){
            try(java.io.FileInputStream in=new java.io.FileInputStream(temp);
                java.io.FileOutputStream out=new java.io.FileOutputStream(target,false)){
                byte[] b=new byte[16384];int n;while((n=in.read(b))>0)out.write(b,0,n);out.flush();
            }catch(Exception e){temp.delete();target.delete();return false;}
            temp.delete();
        }
        if(jpg.exists())jpg.delete();
        target.setLastModified(System.currentTimeMillis());
        return true;
    }

`;
  if(!login.includes(chooseMarker))throw new Error('V68.12.28 repère chooseProfile introuvable');
  login=login.replace(chooseMarker,helpers+chooseMarker);
}

// Sauvegarde : GIF = fichier original préservé (10 Mo max). Photo fixe = pipeline carré JPEG actuel.
login=replaceMethod(login,[
  '    private boolean saveProfilePhotoV681226(android.net.Uri uri){',
  '    private boolean saveProfilePhotoV681226(android.net.Uri uri) {'
],String.raw`    private boolean saveProfilePhotoV681226(android.net.Uri uri){
        if(uri==null||accounts==null||!accounts.isSignedIn())return false;
        if(isGifUriV681228(uri))return saveGifProfileV681228(uri);
        android.graphics.Bitmap decoded=null;
        android.graphics.Bitmap cropped=null;
        android.graphics.Bitmap scaled=null;
        try{
            android.graphics.BitmapFactory.Options bounds=new android.graphics.BitmapFactory.Options();
            bounds.inJustDecodeBounds=true;
            try(java.io.InputStream in=getContentResolver().openInputStream(uri)){
                if(in==null)return false;
                android.graphics.BitmapFactory.decodeStream(in,null,bounds);
            }
            int sample=1;
            int largest=Math.max(bounds.outWidth,bounds.outHeight);
            while(largest/sample>1600)sample*=2;
            android.graphics.BitmapFactory.Options opts=new android.graphics.BitmapFactory.Options();
            opts.inSampleSize=Math.max(1,sample);
            opts.inPreferredConfig=android.graphics.Bitmap.Config.ARGB_8888;
            try(java.io.InputStream in=getContentResolver().openInputStream(uri)){
                if(in==null)return false;
                decoded=android.graphics.BitmapFactory.decodeStream(in,null,opts);
            }
            if(decoded==null)return false;
            int side=Math.min(decoded.getWidth(),decoded.getHeight());
            int left=Math.max(0,(decoded.getWidth()-side)/2);
            int top=Math.max(0,(decoded.getHeight()-side)/2);
            cropped=android.graphics.Bitmap.createBitmap(decoded,left,top,side,side);
            scaled=android.graphics.Bitmap.createScaledBitmap(cropped,512,512,true);
            java.io.File outFile=profilePhotoJpgFileV681228();
            try(java.io.FileOutputStream out=new java.io.FileOutputStream(outFile,false)){
                if(!scaled.compress(android.graphics.Bitmap.CompressFormat.JPEG,90,out))return false;
                out.flush();
            }
            java.io.File gif=profilePhotoGifFileV681228();
            if(gif.exists())gif.delete();
            outFile.setLastModified(System.currentTimeMillis());
            return true;
        }catch(Exception ignored){
            return false;
        }finally{
            if(scaled!=null&&scaled!=cropped&&!scaled.isRecycled())scaled.recycle();
            if(cropped!=null&&cropped!=decoded&&!cropped.isRecycled())cropped.recycle();
            if(decoded!=null&&!decoded.isRecycled())decoded.recycle();
        }
    }`,'saveProfilePhotoV681226');

login=replaceMethod(login,[
  '    private void deleteProfilePhotoV681226(){',
  '    private void deleteProfilePhotoV681226() {'
],String.raw`    private void deleteProfilePhotoV681226(){
        java.io.File jpg=profilePhotoJpgFileV681228();
        java.io.File gif=profilePhotoGifFileV681228();
        boolean ok=true;
        if(jpg.exists()&&!jpg.delete())ok=false;
        if(gif.exists()&&!gif.delete())ok=false;
        if(!ok){
            android.widget.Toast.makeText(this,"Impossible de supprimer l'avatar.",android.widget.Toast.LENGTH_SHORT).show();
            return;
        }
        android.widget.Toast.makeText(this,"Photo de profil supprimée.",android.widget.Toast.LENGTH_SHORT).show();
        renderProfile();
    }`,'deleteProfilePhotoV681226');

const oldProfileRender=String.raw`        if(hasProfilePhotoV681226){
            android.graphics.Bitmap profileBitmapV681226=android.graphics.BitmapFactory.decodeFile(profilePhotoV681226.getAbsolutePath());
            if(profileBitmapV681226!=null){
                avatar.setText("");
                avatar.setForeground(new android.graphics.drawable.BitmapDrawable(getResources(),profileBitmapV681226));
                avatar.setForegroundGravity(Gravity.FILL);
                avatar.setClipToOutline(true);
                avatar.setContentDescription("Changer ma photo de profil Audify");
            }
        }else{
            avatar.setContentDescription("Ajouter une photo de profil Audify");
        }`;
const newProfileRender=String.raw`        if(hasProfilePhotoV681226){
            avatar.setText("");
            if(AudifyProfileMedia.apply(this,avatar,profilePhotoV681226)){
                avatar.setContentDescription(AudifyProfileMedia.isGif(profilePhotoV681226)?"Changer mon GIF de profil Audify":"Changer ma photo de profil Audify");
            }
        }else{
            avatar.setContentDescription("Ajouter une photo ou un GIF de profil Audify");
        }`;
if(!login.includes(oldProfileRender))throw new Error('V68.12.28 rendu avatar Compte introuvable');
login=login.replace(oldProfileRender,newProfileRender);
login=login.replace(
  'Ta photo reste privée sur cet appareil. Appuie sur l’avatar pour la modifier.',
  'Photo ou GIF animé · 10 Mo max. Ton avatar reste privé sur cet appareil.'
);

await writeFile(loginPath,login,'utf8');

let home=await readFile(homePath,'utf8');
home=replaceMethod(home,[
  '    private java.io.File profilePhotoFileV681226(){',
  '    private java.io.File profilePhotoFileV681226() {'
],String.raw`    private java.io.File profilePhotoFileV681226(){
        String uid=new AudifyAccountStore(this).getCurrentUid();
        if(uid==null)uid="";
        String safe=uid.trim().replaceAll("[^A-Za-z0-9._-]","_");
        if(safe.isEmpty())safe="guest";
        java.io.File gif=new java.io.File(getFilesDir(),"audify_profile_"+safe+".gif");
        if(gif.isFile()&&gif.length()>0L)return gif;
        return new java.io.File(getFilesDir(),"audify_profile_"+safe+".jpg");
    }`,'profilePhotoFileV681226 home');

const oldHomeRender=String.raw`            java.io.File localPhotoV681226=profilePhotoFileV681226();
            android.graphics.Bitmap localBitmapV681226=localPhotoV681226.isFile()?android.graphics.BitmapFactory.decodeFile(localPhotoV681226.getAbsolutePath()):null;
            if(localBitmapV681226!=null){
                avatar.setForeground(new android.graphics.drawable.BitmapDrawable(getResources(),localBitmapV681226));
                avatar.setForegroundGravity(Gravity.FILL);
                avatar.setClipToOutline(true);
                avatar.setContentDescription("Ouvrir mon compte Audify · photo personnalisée");
            }else{
                android.graphics.drawable.Drawable audifyAvatar=getResources().getDrawable(R.drawable.audify_ic_a_musical,getTheme());`;
const newHomeRender=String.raw`            java.io.File localPhotoV681226=profilePhotoFileV681226();
            boolean customAvatarV681228=localPhotoV681226.isFile()&&AudifyProfileMedia.apply(this,avatar,localPhotoV681226);
            if(customAvatarV681228){
                avatar.setContentDescription(AudifyProfileMedia.isGif(localPhotoV681226)?"Ouvrir mon compte Audify · GIF animé":"Ouvrir mon compte Audify · photo personnalisée");
            }else{
                android.graphics.drawable.Drawable audifyAvatar=getResources().getDrawable(R.drawable.audify_ic_a_musical,getTheme());`;
if(!home.includes(oldHomeRender))throw new Error('V68.12.28 rendu avatar Home introuvable');
home=home.replace(oldHomeRender,newHomeRender);
await writeFile(homePath,home,'utf8');

console.log('Audify Android V68.12.28 : GIF de profil animés, 10 Mo max, rendu Compte + Home, photos fixes conservées.');
