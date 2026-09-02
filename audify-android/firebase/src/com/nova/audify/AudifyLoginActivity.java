package com.nova.audify;

import android.content.Intent;
import android.app.PendingIntent;
import android.content.IntentSender;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.net.Uri;
import android.text.InputType;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import java.text.DateFormat;
import java.util.Date;
import java.util.UUID;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Audify V68.12.2 — Account Core e-mail/mot de passe + profil + session persistante. */
public class AudifyLoginActivity extends AppCompatActivity {
    private volatile String v681229ProfileMessage="";
    private static final int BG=Color.rgb(7,11,17);
    private static final int CARD=Color.rgb(13,19,27);
    private static final int FIELD=Color.rgb(18,25,34);
    private static final int BORDER=Color.rgb(55,66,79);
    private static final int MUTED=Color.rgb(156,166,180);
    private static final int ACCENT=Color.rgb(137,255,48);
    private AudifyAccountStore accounts;
    private boolean createModeV681215=false;
    private boolean authBusy=false;
    private volatile String photoWorkUid=null;
    private String photoPickerUid="";
    private final android.os.Handler firebaseUi=new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable firebaseTick=new Runnable(){public void run(){if(cloudStatus!=null&&accounts.isSignedIn())cloudStatus.setText(cloudSubtitleV68124());firebaseUi.postDelayed(this,1500);}};
    private TextView authStatus;
    private TextView cloudStatus;
    private Button cloudSyncButton;

    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        accounts=new AudifyAccountStore(this);
        styleWindow();
        render();

    }

    @Override protected void onStart(){super.onStart();AudifyFirebaseSync.get(this).retry();firebaseUi.post(firebaseTick);}
    @Override protected void onStop(){firebaseUi.removeCallbacks(firebaseTick);super.onStop();}
    @Override public void onBackPressed(){if(authBusy)return;super.onBackPressed();}
    private String cloudSubtitleV68124(){
        String avatar=AudifyFirebaseAvatar.get(this).status();
        return AudifyFirebaseSync.get(this).status()+(avatar.isEmpty()?"":"\n"+avatar);
    }
    private void beginGoogleSignInV68123(){
        if(authBusy)return;authBusy=true;
        AudifyGoogleSignIn.start(this,result->{authBusy=false;if(isFinishing()||isDestroyed())return;if(result.ok)renderProfile();else showStatus(authStatus,result);});
    }
    private void confirmImport(boolean guest){
        new androidx.appcompat.app.AlertDialog.Builder(this).setTitle(guest?"Importer le mode invité ?":"Importer l’ancienne bibliothèque ?")
            .setMessage("Ces données présentes sur cet appareil seront attribuées au compte "+accounts.getCurrentEmail()+". Confirme qu’elles t’appartiennent. Les originaux seront conservés.")
            .setNegativeButton("Annuler",null).setPositiveButton("Importer",(dialog,which)->{
                String message=AudifyLegacyImport.importLibrary(this,guest);
                android.widget.Toast.makeText(this,message,android.widget.Toast.LENGTH_LONG).show();
            }).show();
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==681226){
            if(resultCode==RESULT_OK&&data!=null&&data.getData()!=null&&photoPickerUid.equals(accounts.getCurrentUid())){
                final android.net.Uri selected=data.getData();
                try{
                    int flags=data.getFlags()&Intent.FLAG_GRANT_READ_URI_PERMISSION;
                    if(flags!=0)getContentResolver().takePersistableUriPermission(selected,flags);
                }catch(Exception ignored){}
                v681229ProfileMessage="";
                android.widget.Toast.makeText(this,"Préparation de l'avatar…",android.widget.Toast.LENGTH_SHORT).show();
                final String selectedOwner=photoPickerUid;
                if(photoWorkUid!=null)return;
                photoWorkUid=selectedOwner;
                new Thread(()->{
                    final boolean ok=saveProfilePhotoV681226(selected);
                    photoWorkUid=null;
                    final String custom=v681229ProfileMessage;
                    runOnUiThread(()->{
                        if(isFinishing()||isDestroyed()||!selectedOwner.equals(accounts.getCurrentUid()))return;
                        String message=!custom.isEmpty()?custom:(ok?"Photo de profil mise à jour.":"Impossible de lire cette image.");
                        android.widget.Toast.makeText(this,message,android.widget.Toast.LENGTH_LONG).show();
                        if(ok){AudifyFirebaseAvatar.get(this).queue(profilePhotoFileV681226());renderProfile();}
                    });
                },"Audify-Profile-Optimizer").start();
            }
            return;
        }
    }

    private void showGoogleErrorV68123(String message){
        if(authStatus!=null){
            authStatus.setVisibility(android.view.View.VISIBLE);
            authStatus.setText(message);
            authStatus.setTextColor(Color.rgb(255,108,118));
        }
    }

    private java.io.File profilePhotoFileV681226(){
        String uid=photoWorkUid!=null?photoWorkUid:(accounts==null?"":accounts.getCurrentUid());
        if(uid==null)uid="";
        String safe=uid.trim().replaceAll("[^A-Za-z0-9._-]","_");
        if(safe.isEmpty())safe="guest";
        java.io.File gif=new java.io.File(getFilesDir(),"audify_profile_"+safe+".gif");
        if(gif.isFile()&&gif.length()>0L)return gif;
        return new java.io.File(getFilesDir(),"audify_profile_"+safe+".jpg");
    }

    private java.io.File profilePhotoTypedFileV681228(String extension){
        String uid=photoWorkUid!=null?photoWorkUid:(accounts==null?"":accounts.getCurrentUid());
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
        final long sourceLimit=50L*1024L*1024L;
        java.io.File target=profilePhotoGifFileV681228();
        java.io.File jpg=profilePhotoJpgFileV681228();
        java.io.File sourceTemp=new java.io.File(getFilesDir(),target.getName()+".source.tmp");
        long total=0L;
        v681229ProfileMessage="";
        AudifyProfileMedia.clearSafe(target);
        try(java.io.InputStream in=getContentResolver().openInputStream(uri);
            java.io.FileOutputStream out=new java.io.FileOutputStream(sourceTemp,false)){
            if(in==null)return false;
            byte[] buffer=new byte[16384];int n;
            while((n=in.read(buffer))>0){
                total+=n;
                if(total>sourceLimit){
                    sourceTemp.delete();
                    v681229ProfileMessage="GIF trop volumineux : limite 50 Mo avant optimisation.";
                    return false;
                }
                out.write(buffer,0,n);
            }
            out.flush();
        }catch(Throwable e){sourceTemp.delete();return false;}
        if(total<=0L){sourceTemp.delete();return false;}

        // Toujours normaliser : 256 px, 8 i/s, 10 s max puis secours 192 px.
        boolean ok=optimizeLargeGifV681229(sourceTemp,target);
        sourceTemp.delete();
        if(ok){
            if(jpg.exists())jpg.delete();
            target.setLastModified(System.currentTimeMillis());
            AudifyProfileMedia.markSafe(target);
            v681229ProfileMessage="GIF optimisé et sécurisé pour Audify.";
            return true;
        }
        if(target.exists())target.delete();
        AudifyProfileMedia.clearSafe(target);
        v681229ProfileMessage="Impossible de sécuriser ce GIF. Essaie une autre animation.";
        return false;
    }

    private boolean encodeOptimizedGifV681229(java.io.File source,java.io.File output,int side,int fps,int maxDurationMs){
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

    private void chooseProfilePhotoV681226(){
        try{
            Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("image/*");
            photoPickerUid=accounts.getCurrentUid();
            startActivityForResult(pick,681226);
        }catch(Exception e){
            android.widget.Toast.makeText(this,"Impossible d'ouvrir la galerie.",android.widget.Toast.LENGTH_SHORT).show();
        }
    }

    private boolean saveProfilePhotoV681226(android.net.Uri uri){
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
    }

    private void deleteProfilePhotoV681226(){
        if(photoWorkUid!=null)return;
        if(!AudifyFirebaseAvatar.get(this).deleted()){android.widget.Toast.makeText(this,"Suppression non enregistrée. Réessaie.",android.widget.Toast.LENGTH_SHORT).show();return;}
        java.io.File jpg=profilePhotoJpgFileV681228();
        java.io.File gif=profilePhotoGifFileV681228();
        AudifyProfileMedia.clearSafe(jpg);
        AudifyProfileMedia.clearSafe(gif);
        boolean ok=true;
        if(jpg.exists()&&!jpg.delete())ok=false;
        if(gif.exists()&&!gif.delete())ok=false;
        if(!ok){
            android.widget.Toast.makeText(this,"Impossible de supprimer l'avatar.",android.widget.Toast.LENGTH_SHORT).show();
            return;
        }
        android.widget.Toast.makeText(this,"Photo de profil supprimée.",android.widget.Toast.LENGTH_SHORT).show();
        renderProfile();
    }

    private void styleWindow(){
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        if(android.os.Build.VERSION.SDK_INT>=35){
            Window w=getWindow();
            WindowInsetsController c=w.getInsetsController();
            if(c!=null)c.setSystemBarsAppearance(0,WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        }
    }

    private void render(){
        if(accounts.isSignedIn()) renderProfile(); else renderAuth();
    }

    private LinearLayout basePage(){
        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);
        LinearLayout page=new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(20),dp(18),dp(20),dp(34));
        scroll.addView(page,new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(scroll);

        Button back=button("‹",44f,true);
        back.setGravity(Gravity.CENTER);
        back.setTextColor(Color.WHITE);
        back.setBackground(round(CARD,dp(1),BORDER,dp(22)));
        back.setOnClickListener(v->finish());
        page.addView(back,new LinearLayout.LayoutParams(dp(50),dp(50)));

        TextView brand=text("AUDIFY",13f,true);
        brand.setTextColor(ACCENT); brand.setLetterSpacing(0.20f);
        LinearLayout.LayoutParams brandLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30));
        brandLp.topMargin=dp(34); page.addView(brand,brandLp);
        return page;
    }

    private void renderAuth(){
        cloudStatus=null;
        LinearLayout page=basePage();
        page.setPadding(dp(20),dp(18),dp(20),dp(42));

        LinearLayout hero=new LinearLayout(this);
        hero.setOrientation(LinearLayout.VERTICAL);
        hero.setPadding(dp(20),dp(20),dp(20),dp(20));
        hero.setBackground(authGradientV681217(
            createModeV681215?Color.rgb(22,35,29):Color.rgb(18,26,38),
            createModeV681215?Color.rgb(10,18,16):Color.rgb(8,13,20),
            dp(28)
        ));
        hero.setElevation(dp(3));
        LinearLayout.LayoutParams heroLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        heroLp.topMargin=dp(24);
        page.addView(hero,heroLp);

        LinearLayout heroTop=new LinearLayout(this);
        heroTop.setOrientation(LinearLayout.HORIZONTAL);
        heroTop.setGravity(Gravity.CENTER_VERTICAL);
        TextView musicBadge=text("♫",22f,true);
        musicBadge.setGravity(Gravity.CENTER);
        musicBadge.setTextColor(Color.rgb(18,28,13));
        musicBadge.setBackground(round(ACCENT,0,Color.TRANSPARENT,dp(22)));
        heroTop.addView(musicBadge,new LinearLayout.LayoutParams(dp(44),dp(44)));

        LinearLayout heroMeta=new LinearLayout(this);
        heroMeta.setOrientation(LinearLayout.VERTICAL);
        heroMeta.setPadding(dp(12),0,0,0);
        TextView eyebrow=text(createModeV681215?"NOUVEAU COMPTE":"ESPACE PERSONNEL",11.5f,true);
        eyebrow.setTextColor(ACCENT);
        eyebrow.setLetterSpacing(0.12f);
        TextView mini=text(createModeV681215?"Ton univers musical commence ici":"Retrouve ton univers Audify",13f,false);
        mini.setTextColor(Color.rgb(174,185,199));
        heroMeta.addView(eyebrow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(22)));
        heroMeta.addView(mini,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(24)));
        heroTop.addView(heroMeta,new LinearLayout.LayoutParams(0,dp(48),1f));
        hero.addView(heroTop,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));

        TextView title=text(createModeV681215?"Bienvenue parmi nous":"Bon retour parmi nous",31f,true);
        LinearLayout.LayoutParams titleLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(52));
        titleLp.topMargin=dp(14);
        hero.addView(title,titleLp);

        TextView subtitle=text(createModeV681215
            ?"Crée ton compte Audify pour retrouver ta bibliothèque, tes favoris et ton expérience sur tes appareils."
            :"Connecte-toi pour retrouver ta bibliothèque, tes favoris et ton expérience Audify.",15f,false);
        subtitle.setTextColor(Color.rgb(160,171,186));
        subtitle.setLineSpacing(dp(2),1.08f);
        hero.addView(subtitle,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout card=new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16),dp(18),dp(16),dp(18));
        card.setBackground(authGradientV681217(Color.rgb(16,23,32),Color.rgb(10,15,22),dp(28)));
        card.setElevation(dp(5));
        LinearLayout.LayoutParams cardLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        cardLp.topMargin=dp(16);
        page.addView(card,cardLp);

        TextView formTitle=text(createModeV681215?"Créer ton compte":"Connexion",17f,true);
        formTitle.setTextColor(Color.rgb(242,245,249));
        card.addView(formTitle,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30)));
        TextView formHint=text(createModeV681215?"Quelques secondes suffisent.":"Entre tes informations pour continuer.",12.5f,false);
        formHint.setTextColor(Color.rgb(123,136,153));
        LinearLayout.LayoutParams formHintLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(28));
        formHintLp.bottomMargin=dp(6);
        card.addView(formHint,formHintLp);

        EditText email=premiumFieldV681217(card,"@","Adresse e-mail","nom@exemple.com",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        EditText password=premiumFieldV681217(card,"●","Mot de passe","8 caractères minimum",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);

        final EditText confirmPasswordV681216;
        if(createModeV681215){
            confirmPasswordV681216=premiumFieldV681217(card,"✓","Confirmer le mot de passe","Répète ton mot de passe",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        }else{
            confirmPasswordV681216=null;
        }

        TextView status=text("",13f,true);
        status.setGravity(Gravity.CENTER);
        status.setVisibility(android.view.View.GONE);
        authStatus=status;
        LinearLayout.LayoutParams statusLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        statusLp.topMargin=dp(12);

        Button signIn=activeButton(createModeV681215?"Créer mon compte":"Se connecter",true);
        signIn.setTextSize(16f);
        signIn.setTextColor(Color.rgb(15,24,11));
        signIn.setBackground(authGradientV681217(Color.rgb(160,255,69),ACCENT,dp(22)));
        signIn.setElevation(dp(5));
        LinearLayout.LayoutParams loginLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58));
        loginLp.topMargin=dp(18);
        card.addView(signIn,loginLp);
        card.addView(status,statusLp);

        Button create=activeButton(createModeV681215?"J’ai déjà un compte":"Créer un compte",false);
        create.setTextColor(Color.rgb(226,232,240));
        create.setBackground(round(Color.rgb(18,26,36),dp(1),Color.rgb(58,72,87),dp(22)));
        LinearLayout.LayoutParams createLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54));
        createLp.topMargin=dp(14);
        card.addView(create,createLp);

        signIn.setOnClickListener(v->{
            hideKeyboard();
            if(createModeV681215){
                String firstPasswordV681216=password.getText().toString();
                String secondPasswordV681216=confirmPasswordV681216==null?"":confirmPasswordV681216.getText().toString();
                if(!firstPasswordV681216.equals(secondPasswordV681216)){
                    status.setVisibility(android.view.View.VISIBLE);
                    status.setText("Les mots de passe ne sont pas identiques.");
                    status.setTextColor(Color.rgb(255,108,118));
                    return;
                }
            }
            if(authBusy)return;authBusy=true;signIn.setEnabled(false);signIn.setText("Connexion…");
            AudifyAccountStore.Callback completed=result->{
                authBusy=false;if(isFinishing()||isDestroyed())return;
                signIn.setEnabled(true);signIn.setText(createModeV681215?"Créer mon compte":"Se connecter");
                showStatus(status,result);
                if(result.ok){password.setText("");if(confirmPasswordV681216!=null)confirmPasswordV681216.setText("");renderProfile();}
            };
            if(createModeV681215)accounts.createAccount(email.getText().toString(),password.getText().toString(),completed);
            else accounts.signIn(email.getText().toString(),password.getText().toString(),completed);
        });

        create.setOnClickListener(v->{
            if(authBusy)return;hideKeyboard();
            createModeV681215=!createModeV681215;
            renderAuth();
        });

        Button reset=activeButton("Mot de passe oublié",false);
        reset.setOnClickListener(v->{if(authBusy)return;authBusy=true;reset.setEnabled(false);accounts.resetPassword(email.getText().toString(),result->{authBusy=false;if(isFinishing()||isDestroyed())return;reset.setEnabled(true);showStatus(status,result);});});
        card.addView(reset,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));
        LinearLayout divider=new LinearLayout(this);
        divider.setOrientation(LinearLayout.HORIZONTAL);
        divider.setGravity(Gravity.CENTER_VERTICAL);
        android.view.View left=new android.view.View(this);
        left.setBackgroundColor(Color.rgb(45,56,69));
        android.view.View right=new android.view.View(this);
        right.setBackgroundColor(Color.rgb(45,56,69));
        TextView or=text("ou continuer avec",12f,false);
        or.setGravity(Gravity.CENTER);
        or.setTextColor(Color.rgb(114,127,143));
        divider.addView(left,new LinearLayout.LayoutParams(0,dp(1),1f));
        divider.addView(or,new LinearLayout.LayoutParams(dp(122),dp(38)));
        divider.addView(right,new LinearLayout.LayoutParams(0,dp(1),1f));
        LinearLayout.LayoutParams dividerLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(42));
        dividerLp.topMargin=dp(10);
        card.addView(divider,dividerLp);

        Button google=activeButton(createModeV681215?"G   Créer avec Google":"G   Se connecter avec Google",false);
        google.setTextColor(Color.rgb(241,244,248));
        google.setBackground(round(Color.rgb(22,30,40),dp(1),Color.rgb(69,82,98),dp(22)));
        google.setOnClickListener(v->beginGoogleSignInV68123());
        card.addView(google,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(56)));

        Button guest=activeButton("Continuer sans compte",false);
        guest.setTextColor(Color.rgb(201,211,222));
        guest.setBackground(round(Color.rgb(14,20,28),dp(1),Color.rgb(47,59,72),dp(22)));
        guest.setContentDescription("Continuer en mode invité, sans compte");
        guest.setOnClickListener(v->{
            if(authBusy)return;
            android.widget.Toast.makeText(this,"Mode invité · tes données restent sur cet appareil",android.widget.Toast.LENGTH_SHORT).show();
            finish();
        });
        LinearLayout.LayoutParams guestLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54));
        guestLp.topMargin=dp(10);
        card.addView(guest,guestLp);

        TextView privacy=text("AUDIFY  •  SESSION SÉCURISÉE",10.8f,true);
        privacy.setGravity(Gravity.CENTER);
        privacy.setLetterSpacing(0.10f);
        privacy.setTextColor(Color.rgb(95,111,127));
        LinearLayout.LayoutParams privacyLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(34));
        privacyLp.topMargin=dp(12);
        card.addView(privacy,privacyLp);

        hero.setAlpha(0f);
        hero.setTranslationY(dp(10));
        hero.animate().alpha(1f).translationY(0f).setDuration(260L).start();
        card.setAlpha(0f);
        card.setTranslationY(dp(16));
        card.animate().alpha(1f).translationY(0f).setStartDelay(70L).setDuration(300L).start();
    }

    private EditText premiumFieldV681217(LinearLayout parent,String icon,String label,String hint,int inputType){
        TextView fieldLabel=text(label,12.8f,true);
        fieldLabel.setTextColor(Color.rgb(199,208,219));
        LinearLayout.LayoutParams labelLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(28));
        labelLp.topMargin=dp(8);
        parent.addView(fieldLabel,labelLp);

        LinearLayout shell=new LinearLayout(this);
        shell.setOrientation(LinearLayout.HORIZONTAL);
        shell.setGravity(Gravity.CENTER_VERTICAL);
        shell.setPadding(dp(8),0,dp(10),0);
        shell.setBackground(round(Color.rgb(18,26,36),dp(1),Color.rgb(54,68,83),dp(18)));

        TextView glyph=text(icon,15f,true);
        glyph.setGravity(Gravity.CENTER);
        glyph.setTextColor(ACCENT);
        glyph.setBackground(round(Color.rgb(29,39,31),0,Color.TRANSPARENT,dp(15)));
        shell.addView(glyph,new LinearLayout.LayoutParams(dp(34),dp(34)));

        EditText input=new EditText(this);
        input.setHint(hint);
        input.setHintTextColor(Color.rgb(94,108,124));
        input.setTextColor(Color.WHITE);
        input.setTextSize(15.5f);
        input.setSingleLine(true);
        input.setInputType(inputType);
        input.setPadding(dp(12),0,dp(6),0);
        input.setBackgroundColor(Color.TRANSPARENT);
        input.setSelectAllOnFocus(false);
        shell.addView(input,new LinearLayout.LayoutParams(0,dp(58),1f));
        parent.addView(shell,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)));
        return input;
    }

    private GradientDrawable authGradientV681217(int start,int end,int radius){
        GradientDrawable d=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{start,end});
        d.setCornerRadius(radius);
        d.setStroke(dp(1),Color.rgb(42,54,66));
        return d;
    }

    private void renderProfile(){
        LinearLayout page=basePage();
        TextView title=text("Ton compte",34f,true);
        page.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54)));
        TextView subtitle=text("google".equals(accounts.getCurrentProvider())?"Ton compte Google est connecté à Audify.":("apple".equals(accounts.getCurrentProvider())?"Ton compte Apple est connecté à Audify.":"Ton compte Audify est connecté au cloud."),15.5f,false); subtitle.setTextColor(MUTED);
        LinearLayout.LayoutParams slp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT); slp.bottomMargin=dp(26); page.addView(subtitle,slp);

        LinearLayout card=new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(18),dp(20),dp(18),dp(20));
        card.setBackground(round(CARD,dp(1),Color.rgb(45,57,67),dp(28)));
        page.addView(card,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));

        String avatarSource=accounts.getCurrentDisplayName().isEmpty()?accounts.getCurrentEmail():accounts.getCurrentDisplayName();
        TextView avatar=text(initial(avatarSource),30f,true); avatar.setGravity(Gravity.CENTER); avatar.setTextColor(Color.rgb(16,24,13)); avatar.setBackground(round(ACCENT,0,Color.TRANSPARENT,dp(34)));
        card.addView(avatar,new LinearLayout.LayoutParams(dp(68),dp(68)));
        java.io.File profilePhotoV681226=profilePhotoFileV681226();
        final boolean hasProfilePhotoV681226=profilePhotoV681226.isFile()&&profilePhotoV681226.length()>0L;
        if(hasProfilePhotoV681226){
            if(AudifyProfileMedia.apply(this,avatar,profilePhotoV681226)){
                avatar.setText("");
                avatar.setContentDescription(AudifyProfileMedia.isGif(profilePhotoV681226)?"Changer mon GIF de profil Audify":"Changer ma photo de profil Audify");
            }else{
                avatar.setContentDescription("Avatar protégé · sélectionne de nouveau ce GIF pour l'optimiser");
            }
        }else{
            avatar.setContentDescription("Ajouter une photo ou un GIF de profil Audify");
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
        TextView photoHintV681226=text("Photo ou GIF animé · au-delà de 10 Mo, Audify optimise automatiquement le GIF.",12.2f,false);
        photoHintV681226.setTextColor(Color.rgb(126,139,153));
        LinearLayout.LayoutParams photoHintLpV681226=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        photoHintLpV681226.topMargin=dp(8);
        card.addView(photoHintV681226,photoHintLpV681226);

        TextView label=text("google".equals(accounts.getCurrentProvider())?"COMPTE GOOGLE · AUDIFY":("apple".equals(accounts.getCurrentProvider())?"COMPTE APPLE · AUDIFY":"COMPTE AUDIFY"),11.5f,true); label.setLetterSpacing(0.12f); label.setTextColor(ACCENT);
        LinearLayout.LayoutParams llp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(28)); llp.topMargin=dp(18); card.addView(label,llp);
        if(!accounts.getCurrentDisplayName().isEmpty()){TextView name=text(accounts.getCurrentDisplayName(),20f,true);name.setTextColor(Color.WHITE);card.addView(name,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(38)));}
        TextView email=text(accounts.getCurrentEmail(),accounts.getCurrentDisplayName().isEmpty()?20f:15f,accounts.getCurrentDisplayName().isEmpty()); email.setTextColor(accounts.getCurrentDisplayName().isEmpty()?Color.WHITE:MUTED); card.addView(email,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(42)));

        long created=accounts.getCreatedAt();
        String date=created>0?DateFormat.getDateInstance(DateFormat.MEDIUM).format(new Date(created)):"Aujourd'hui";
        TextView meta=text("Compte créé le "+date+"\nSession persistante activée",14f,false); meta.setTextColor(MUTED); meta.setLineSpacing(dp(2),1.12f);
        LinearLayout.LayoutParams mlp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT); mlp.topMargin=dp(4); card.addView(meta,mlp);

        LinearLayout cloud=new LinearLayout(this); cloud.setOrientation(LinearLayout.VERTICAL); cloud.setPadding(dp(15),dp(14),dp(15),dp(14)); cloud.setBackground(round(Color.rgb(17,27,22),dp(1),Color.rgb(55,89,43),dp(20)));
        TextView cloudTitle=text("Synchronisation cloud",14f,true); cloudTitle.setTextColor(ACCENT); cloud.addView(cloudTitle,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30)));
        cloudStatus=text(cloudSubtitleV68124(),13f,false);cloudStatus.setTextColor(Color.rgb(180,191,184));cloudStatus.setLineSpacing(dp(2),1.08f);cloud.addView(cloudStatus,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        cloudSyncButton=activeButton("Réessayer la synchronisation",false);
        cloudSyncButton.setOnClickListener(v->{AudifyFirebaseSync.get(this).retry();AudifyFirebaseAvatar.get(this).retry();cloudStatus.setText(cloudSubtitleV68124());});
        LinearLayout.LayoutParams cblp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(52));cblp.topMargin=dp(13);cloud.addView(cloudSyncButton,cblp);
        LinearLayout.LayoutParams clp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);clp.topMargin=dp(22);card.addView(cloud,clp);
        TextView verified=text(accounts.isEmailVerified()?"Adresse e-mail vérifiée":"Adresse e-mail à vérifier",13f,false);card.addView(verified);
        if(!accounts.isEmailVerified()){
            Button verify=activeButton("Renvoyer l’e-mail de vérification",false);
            verify.setOnClickListener(v->{verify.setEnabled(false);accounts.verifyEmail(result->{if(isFinishing()||isDestroyed())return;verify.setEnabled(true);android.widget.Toast.makeText(this,result.message,android.widget.Toast.LENGTH_LONG).show();});});card.addView(verify);
            Button refresh=activeButton("J’ai vérifié mon adresse",false);
            refresh.setOnClickListener(v->accounts.refresh(result->{if(!isFinishing()&&!isDestroyed())renderProfile();}));card.addView(refresh);
        }
        Button legacy=activeButton("Importer l’ancienne bibliothèque",false);legacy.setOnClickListener(v->confirmImport(false));card.addView(legacy);
        Button guestImport=activeButton("Importer mes données invité",false);guestImport.setOnClickListener(v->confirmImport(true));card.addView(guestImport);

        Button logout=activeButton("Se déconnecter",false); logout.setTextColor(Color.rgb(255,164,164)); logout.setBackground(round(Color.rgb(31,21,24),dp(1),Color.rgb(105,57,65),dp(22)));
        LinearLayout.LayoutParams lop=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)); lop.topMargin=dp(24); card.addView(logout,lop);
        logout.setOnClickListener(v->{
            if(photoWorkUid!=null){android.widget.Toast.makeText(this,"Patiente pendant la préparation de l’avatar.",android.widget.Toast.LENGTH_SHORT).show();return;}
            accounts.signOut();AudifyGoogleSignIn.clear(this);createModeV681215=false;renderAuth();
        });
    }

    private void showStatus(TextView status,AudifyAccountStore.Result r){
        status.setVisibility(android.view.View.VISIBLE); status.setText(r.message); status.setTextColor(r.ok?ACCENT:Color.rgb(255,108,118));
    }
    private void hideKeyboard(){try{((InputMethodManager)getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(getWindow().getDecorView().getWindowToken(),0);}catch(Exception ignored){}}
    private String initial(String email){if(email==null||email.isEmpty())return "A";return email.substring(0,1).toUpperCase();}

    private EditText field(String hint){EditText e=new EditText(this);e.setHint(hint);e.setHintTextColor(Color.rgb(102,114,129));e.setTextColor(Color.WHITE);e.setTextSize(16f);e.setPadding(dp(16),0,dp(16),0);e.setBackground(round(FIELD,dp(1),BORDER,dp(18)));return e;}
    private Button activeButton(String label,boolean accent){Button b=button(label,15.5f,true);b.setTextColor(accent?Color.rgb(22,31,18):Color.rgb(220,226,234));b.setBackground(accent?round(ACCENT,0,Color.TRANSPARENT,dp(22)):round(Color.rgb(20,27,36),dp(1),Color.rgb(58,68,81),dp(22)));return b;}
    private Button inactiveButton(String label){Button b=button(label,15.5f,true);b.setTextColor(Color.rgb(130,139,151));b.setBackground(round(Color.rgb(17,23,31),dp(1),Color.rgb(46,54,65),dp(22)));b.setEnabled(false);b.setAlpha(0.65f);return b;}
    private Button button(String value,float size,boolean bold){Button b=new Button(this);b.setAllCaps(false);b.setText(value);b.setTextSize(size);if(bold)b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);b.setPadding(0,0,0,0);b.setStateListAnimator(null);return b;}
    private TextView text(String value,float size,boolean bold){TextView t=new TextView(this);t.setText(value);t.setTextColor(Color.WHITE);t.setTextSize(size);if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);t.setGravity(Gravity.CENTER_VERTICAL);return t;}
    private GradientDrawable round(int fill,int strokeWidth,int stroke,int radius){GradientDrawable d=new GradientDrawable();d.setColor(fill);d.setCornerRadius(radius);if(strokeWidth>0)d.setStroke(strokeWidth,stroke);return d;}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
}
