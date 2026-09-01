import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const loginPath=path.join(pkgDir,'AudifyLoginActivity.java');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');

function findMethod(source,signatures,label){
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
    if(end>0)return {start,brace,end};
  }
  throw new Error(`V68.12.26 méthode introuvable: ${label}`);
}

function replaceMethod(source,signatures,replacement,label){
  const found=findMethod(source,signatures,label);
  return source.slice(0,found.start)+replacement+source.slice(found.end);
}

// =============================================================================
// 1) PAGE COMPTE : import d'une image depuis la galerie, copie privée locale,
//    avatar rond, changement/suppression sans permission stockage globale.
// =============================================================================
let login=await readFile(loginPath,'utf8');

const styleMarker='    private void styleWindow(){';
if(!login.includes(styleMarker))throw new Error('V68.12.26 repère styleWindow introuvable');
if(!login.includes('private java.io.File profilePhotoFileV681226()')){
  const helpers=String.raw`    private java.io.File profilePhotoFileV681226(){
        String uid=accounts==null?"":accounts.getCurrentUid();
        if(uid==null)uid="";
        String safe=uid.trim().replaceAll("[^A-Za-z0-9._-]","_");
        if(safe.isEmpty())safe="guest";
        return new java.io.File(getFilesDir(),"audify_profile_"+safe+".jpg");
    }

    private void chooseProfilePhotoV681226(){
        try{
            Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("image/*");
            startActivityForResult(pick,681226);
        }catch(Exception e){
            android.widget.Toast.makeText(this,"Impossible d'ouvrir la galerie.",android.widget.Toast.LENGTH_SHORT).show();
        }
    }

    private boolean saveProfilePhotoV681226(android.net.Uri uri){
        if(uri==null||accounts==null||!accounts.isSignedIn())return false;
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
            java.io.File outFile=profilePhotoFileV681226();
            try(java.io.FileOutputStream out=new java.io.FileOutputStream(outFile,false)){
                if(!scaled.compress(android.graphics.Bitmap.CompressFormat.JPEG,90,out))return false;
                out.flush();
            }
            outFile.setLastModified(System.currentTimeMillis());
            return true;
        }catch(Exception ignored){
            return false;
        }finally{
            if(scaled!=null&&scaled!=cropped&&!scaled.isRecycled())scaled.recycle();
            if(cropped!=null&&cropped!=decoded&&!cropped.isRecycled())cropped.recycle();
            if(decoded!=null&&!decoded.isRecycled())decoded.recycle();
        }
    }

    private void deleteProfilePhotoV681226(){
        java.io.File photo=profilePhotoFileV681226();
        if(photo.exists()&&!photo.delete()){
            android.widget.Toast.makeText(this,"Impossible de supprimer la photo.",android.widget.Toast.LENGTH_SHORT).show();
            return;
        }
        android.widget.Toast.makeText(this,"Photo de profil supprimée.",android.widget.Toast.LENGTH_SHORT).show();
        renderProfile();
    }

`;
  login=login.replace(styleMarker,helpers+styleMarker);
}

// Le flux Google/Drive possède déjà un onActivityResult : on ajoute notre code
// avant leurs request codes pour ne rien casser.
const activityResult=findMethod(login,[
  '    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){',
  '    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data){'
],'onActivityResult');
let activityBody=login.slice(activityResult.brace+1,activityResult.end-1);
if(!activityBody.includes('requestCode==681226')){
  const superNeedle='        super.onActivityResult(requestCode,resultCode,data);';
  const pos=activityBody.indexOf(superNeedle);
  if(pos<0)throw new Error('V68.12.26 super.onActivityResult introuvable');
  const profileResult=String.raw`
        if(requestCode==681226){
            if(resultCode==RESULT_OK&&data!=null&&data.getData()!=null){
                boolean ok=saveProfilePhotoV681226(data.getData());
                android.widget.Toast.makeText(this,ok?"Photo de profil mise à jour.":"Impossible de lire cette image.",android.widget.Toast.LENGTH_SHORT).show();
                if(ok)renderProfile();
            }
            return;
        }`;
  activityBody=activityBody.slice(0,pos+superNeedle.length)+profileResult+activityBody.slice(pos+superNeedle.length);
  login=login.slice(0,activityResult.brace+1)+activityBody+login.slice(activityResult.end-1);
}

const avatarAdd='        card.addView(avatar,new LinearLayout.LayoutParams(dp(68),dp(68)));';
if(!login.includes(avatarAdd))throw new Error('V68.12.26 avatar profil introuvable');
if(!login.includes('Button photoButtonV681226=')){
  const profileUi=String.raw`
        java.io.File profilePhotoV681226=profilePhotoFileV681226();
        final boolean hasProfilePhotoV681226=profilePhotoV681226.isFile()&&profilePhotoV681226.length()>0L;
        if(hasProfilePhotoV681226){
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
        }
        avatar.setOnClickListener(v->chooseProfilePhotoV681226());

        LinearLayout photoActionsV681226=new LinearLayout(this);
        photoActionsV681226.setOrientation(LinearLayout.HORIZONTAL);
        photoActionsV681226.setGravity(Gravity.CENTER_VERTICAL);
        Button photoButtonV681226=activeButton(hasProfilePhotoV681226?"Changer la photo":"Ajouter une photo",false);
        photoButtonV681226.setTextColor(Color.rgb(228,235,243));
        photoButtonV681226.setBackground(round(Color.rgb(18,27,36),dp(1),Color.rgb(67,82,96),dp(19)));
        photoButtonV681226.setOnClickListener(v->chooseProfilePhotoV681226());
        photoActionsV681226.addView(photoButtonV681226,new LinearLayout.LayoutParams(0,dp(48),1f));
        if(hasProfilePhotoV681226){
            Button removePhotoV681226=activeButton("Supprimer",false);
            removePhotoV681226.setTextColor(Color.rgb(255,158,164));
            removePhotoV681226.setBackground(round(Color.rgb(31,21,24),dp(1),Color.rgb(105,57,65),dp(19)));
            removePhotoV681226.setOnClickListener(v->deleteProfilePhotoV681226());
            LinearLayout.LayoutParams removeLpV681226=new LinearLayout.LayoutParams(dp(112),dp(48));
            removeLpV681226.leftMargin=dp(10);
            photoActionsV681226.addView(removePhotoV681226,removeLpV681226);
        }
        LinearLayout.LayoutParams photoActionsLpV681226=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48));
        photoActionsLpV681226.topMargin=dp(14);
        card.addView(photoActionsV681226,photoActionsLpV681226);
        TextView photoHintV681226=text("Ta photo reste privée sur cet appareil. Appuie sur l’avatar pour la modifier.",12.2f,false);
        photoHintV681226.setTextColor(Color.rgb(126,139,153));
        LinearLayout.LayoutParams photoHintLpV681226=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        photoHintLpV681226.topMargin=dp(8);
        card.addView(photoHintV681226,photoHintLpV681226);`;
  login=login.replace(avatarAdd,avatarAdd+profileUi);
}

await writeFile(loginPath,login,'utf8');

// =============================================================================
// 2) HOME : la photo locale remplace le A musical lorsqu'elle existe.
//    L'état visuel se rafraîchit aussi après modification/suppression de la photo.
// =============================================================================
let home=await readFile(homePath,'utf8');

const classMarker='public class NativeHomeActivity extends AppCompatActivity {';
if(!home.includes(classMarker))throw new Error('V68.12.26 classe Home introuvable');
if(!home.includes('private long v681226ProfilePhotoStamp;')){
  home=home.replace(classMarker,classMarker+'\n    private long v681226ProfilePhotoStamp;');
}

const stickyMarker='    private LinearLayout buildStickySearchHeader(){';
if(!home.includes(stickyMarker))throw new Error('V68.12.26 buildStickySearchHeader introuvable');
if(!home.includes('private java.io.File profilePhotoFileV681226()')){
  const homeHelpers=String.raw`    private java.io.File profilePhotoFileV681226(){
        String uid=new AudifyAccountStore(this).getCurrentUid();
        if(uid==null)uid="";
        String safe=uid.trim().replaceAll("[^A-Za-z0-9._-]","_");
        if(safe.isEmpty())safe="guest";
        return new java.io.File(getFilesDir(),"audify_profile_"+safe+".jpg");
    }

    private long profilePhotoStampV681226(){
        java.io.File f=profilePhotoFileV681226();
        return f.isFile()?(f.lastModified()^f.length()):0L;
    }

`;
  home=home.replace(stickyMarker,homeHelpers+stickyMarker);
}

const oldSigned=String.raw`        if(signedIn){
            // V68.12.23 : l'avatar connecté devient un vrai badge Audify vert.
            avatar.setBackground(round(Color.rgb(137,255,48),0,Color.TRANSPARENT,dp(29)));
            android.graphics.drawable.Drawable audifyAvatar=getResources().getDrawable(R.drawable.audify_ic_a_musical,getTheme());
            if(audifyAvatar!=null){
                audifyAvatar=audifyAvatar.mutate();
                audifyAvatar.setTint(Color.WHITE);
                avatar.setForeground(audifyAvatar);
                avatar.setForegroundGravity(Gravity.CENTER);
            }
            avatar.setElevation(dp(7));
        }else{`;
const newSigned=String.raw`        if(signedIn){
            avatar.setBackground(round(Color.rgb(137,255,48),0,Color.TRANSPARENT,dp(29)));
            java.io.File localPhotoV681226=profilePhotoFileV681226();
            android.graphics.Bitmap localBitmapV681226=localPhotoV681226.isFile()?android.graphics.BitmapFactory.decodeFile(localPhotoV681226.getAbsolutePath()):null;
            if(localBitmapV681226!=null){
                avatar.setForeground(new android.graphics.drawable.BitmapDrawable(getResources(),localBitmapV681226));
                avatar.setForegroundGravity(Gravity.FILL);
                avatar.setClipToOutline(true);
                avatar.setContentDescription("Ouvrir mon compte Audify · photo personnalisée");
            }else{
                android.graphics.drawable.Drawable audifyAvatar=getResources().getDrawable(R.drawable.audify_ic_a_musical,getTheme());
                if(audifyAvatar!=null){
                    audifyAvatar=audifyAvatar.mutate();
                    audifyAvatar.setTint(Color.WHITE);
                    avatar.setForeground(audifyAvatar);
                    avatar.setForegroundGravity(Gravity.CENTER);
                }
            }
            avatar.setElevation(dp(7));
        }else{`;
if(!home.includes(oldSigned))throw new Error('V68.12.26 bloc avatar connecté introuvable');
home=home.replace(oldSigned,newSigned);

// Init du cache de photo à la création du Home.
const createMethod=findMethod(home,[
  '    @Override protected void onCreate(Bundle savedInstanceState){',
  '    @Override protected void onCreate(Bundle savedInstanceState) {'
],'onCreate');
let createBody=home.slice(createMethod.brace+1,createMethod.end-1);
if(!createBody.includes('v681226ProfilePhotoStamp=profilePhotoStampV681226();')){
  const accountInit='        v681224AccountState=new AudifyAccountStore(this).isSignedIn();';
  const p=createBody.indexOf(accountInit);
  if(p<0)throw new Error('V68.12.26 init session V68.12.24 introuvable');
  createBody=createBody.slice(0,p+accountInit.length)+'\n        v681226ProfilePhotoStamp=profilePhotoStampV681226();'+createBody.slice(p+accountInit.length);
  home=home.slice(0,createMethod.brace+1)+createBody+home.slice(createMethod.end-1);
}

// Le Home doit se rafraîchir si la photo change même si la session reste connectée.
home=replaceMethod(home,[
  '    @Override protected void onResume(){',
  '    @Override protected void onResume() {'
],String.raw`    @Override protected void onResume(){
        super.onResume();

        boolean v681224Now=new AudifyAccountStore(this).isSignedIn();
        long v681226NowStamp=profilePhotoStampV681226();
        if(v681224Now!=v681224AccountState||v681226NowStamp!=v681226ProfilePhotoStamp){
            v681224AccountState=v681224Now;
            v681226ProfilePhotoStamp=v681226NowStamp;
            android.view.View decor=getWindow()==null?null:getWindow().getDecorView();
            if(decor!=null){
                decor.post(()->{
                    if(!isFinishing()&&!isDestroyed())recreate();
                });
            }
            return;
        }

        rebuildLibrary();
        handler.removeCallbacks(ticker);
        handler.post(ticker);
    }`,'onResume');

await writeFile(homePath,home,'utf8');
console.log('Audify Android V68.12.26 : photo de profil personnalisée depuis la galerie, stockage privé local, affichage Compte + Home et suppression avec fallback A Audify.');
