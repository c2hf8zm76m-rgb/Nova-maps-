import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');

function addImport(src, anchor, line){
  if(src.includes(line)) return src;
  if(!src.includes(anchor)) throw new Error('V68.12.46 import anchor introuvable: '+anchor);
  return src.replace(anchor, anchor+'\n'+line);
}

// -----------------------------------------------------------------------------
// 1) MEDIA3 — reproduire le mécanisme qui a été validé sur téléphone réel
//    avec UMIHI-SESSION-ACTIVE-V2 : le Home natif ouvre une connexion
//    SessionToken -> MediaController vers AudifyPlaybackService.
//    Ne modifie PAS onStartCommand / Karaoke / moteur de recherche.
// -----------------------------------------------------------------------------
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
let home=await readFile(homePath,'utf8');
if(!home.includes('import android.Manifest;')){
  home=addImport(home,'import android.app.AlertDialog;','import android.Manifest;');
}
home=addImport(home,'import android.Manifest;','import android.content.ComponentName;');
if(!home.includes('import android.content.pm.PackageManager;')){
  home=addImport(home,'import android.content.Intent;','import android.content.pm.PackageManager;');
}
if(!home.includes('import android.os.Build;')){
  home=addImport(home,'import android.os.Bundle;','import android.os.Build;');
}
if(!home.includes('import androidx.core.app.ActivityCompat;')){
  home=addImport(home,'import androidx.appcompat.app.AppCompatActivity;','import androidx.core.app.ActivityCompat;');
}
if(!home.includes('import androidx.core.content.ContextCompat;')){
  home=addImport(home,'import androidx.core.app.ActivityCompat;','import androidx.core.content.ContextCompat;');
}
if(!home.includes('import androidx.media3.session.MediaController;')){
  home=addImport(home,'import androidx.core.content.ContextCompat;','import androidx.media3.session.MediaController;');
}
if(!home.includes('import androidx.media3.session.SessionToken;')){
  home=addImport(home,'import androidx.media3.session.MediaController;','import androidx.media3.session.SessionToken;');
}

if(!home.includes('activateAudifyMediaSessionV681246')){
  const classMarker='public class NativeHomeActivity extends AppCompatActivity {';
  if(!home.includes(classMarker)) throw new Error('V68.12.46 NativeHomeActivity class marker introuvable');
  const mediaHelpers=String.raw`
    // V68.12.46 — même activation de session que l'APK UMIHI-SESSION-ACTIVE-V2
    // validé sur téléphone réel. Le Future est volontairement laissé à Media3 :
    // la demande de contrôleur suffit à enregistrer la MediaLibrarySession auprès
    // du gestionnaire système de notification/lockscreen.
    private void activateAudifyMediaSessionV681246(){
        try{
            SessionToken tokenV681246=new SessionToken(
                this,
                new ComponentName(this,AudifyPlaybackService.class)
            );
            new MediaController.Builder(this,tokenV681246).buildAsync();
        }catch(Throwable ignored){}
    }

    private void requestAudifyNotificationPermissionV681246(){
        try{
            if(Build.VERSION.SDK_INT>=33
                && ContextCompat.checkSelfPermission(this,Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED){
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    681246
                );
            }
        }catch(Throwable ignored){}
    }
`;
  home=home.replace(classMarker,classMarker+mediaHelpers);

  const createNeedle='        super.onCreate(savedInstanceState);';
  if(!home.includes(createNeedle)) throw new Error('V68.12.46 NativeHomeActivity super.onCreate introuvable');
  home=home.replace(createNeedle,createNeedle+'\n        requestAudifyNotificationPermissionV681246();\n        activateAudifyMediaSessionV681246();');
}

// Le panneau Home annonce maintenant le futur abonnement mensuel.
home=home.replaceAll('Audify Premium · 9,99 € à vie','Audify Premium · 10 € / mois');
home=home.replaceAll('Audify Premium · 9,99€ à vie','Audify Premium · 10 € / mois');
await writeFile(homePath,home,'utf8');

// Laisser Media3 utiliser son provider système par défaut, exactement comme la
// version UMIHI-MEDIA-CORE qui précède la V2 validée.
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
let service=await readFile(servicePath,'utf8');
service=service.replace(/^\s*setMediaNotificationProvider\(mediaNotificationProvider\);\s*$/m,'        // V68.12.46: Media3 default notification provider (Umihi parity).');
await writeFile(servicePath,service,'utf8');

// -----------------------------------------------------------------------------
// 2) REDMI / ANCIENS ANDROID — supprimer l'ActionBar native qui mange la barre
//    de recherche. Les WindowInsets V66.6 restent intégralement conservés.
// -----------------------------------------------------------------------------
const mainPath=path.join(pkgDir,'MainActivity.java');
let main=await readFile(mainPath,'utf8');
if(!main.includes('hideLegacyActionBarV681246')){
  const classMarker='public class MainActivity extends BridgeActivity {';
  if(!main.includes(classMarker)) throw new Error('V68.12.46 MainActivity class marker introuvable');
  main=main.replace(classMarker,classMarker+String.raw`
    private void hideLegacyActionBarV681246(){
        try{ if(getSupportActionBar()!=null)getSupportActionBar().hide(); }catch(Throwable ignored){}
    }
`);
  const createNeedle='        super.onCreate(savedInstanceState);';
  if(!main.includes(createNeedle)) throw new Error('V68.12.46 MainActivity super.onCreate introuvable');
  main=main.replace(createNeedle,createNeedle+'\n        hideLegacyActionBarV681246();');
}
await writeFile(mainPath,main,'utf8');

const stylesPath=path.join(android,'app','src','main','res','values','styles.xml');
let styles=await readFile(stylesPath,'utf8');
if(!styles.includes('name="AppTheme.NoActionBar"')){
  if(!styles.includes('</resources>')) throw new Error('V68.12.46 styles.xml invalide');
  styles=styles.replace('</resources>',String.raw`    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionModeOverlay">true</item>
        <item name="android:windowNoTitle">true</item>
        <item name="windowNoTitle">true</item>
        <item name="android:colorAccent">#9DFF32</item>
    </style>
</resources>`);
}
await writeFile(stylesPath,styles,'utf8');

const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
const activityRegex=/<activity\b(?=[^>]*android:name="\.MainActivity")[^>]*>/m;
const activityMatch=manifest.match(activityRegex);
if(!activityMatch) throw new Error('V68.12.46 MainActivity manifest introuvable');
let mainTag=activityMatch[0];
if(/android:theme="[^"]*"/.test(mainTag)){
  mainTag=mainTag.replace(/android:theme="[^"]*"/,'android:theme="@style/AppTheme.NoActionBar"');
}else{
  mainTag=mainTag.replace('android:name=".MainActivity"','android:name=".MainActivity"\n            android:theme="@style/AppTheme.NoActionBar"');
}
manifest=manifest.replace(activityMatch[0],mainTag);
await writeFile(manifestPath,manifest,'utf8');

// -----------------------------------------------------------------------------
// 3) REFONTE PREMIUM — page 10 €/mois très visuelle, animée et transparente :
//    aucun paiement n'est déclenché tant que les avantages ne sont pas livrés.
// -----------------------------------------------------------------------------
const premiumPath=path.join(pkgDir,'AudifyPremiumActivity.java');
const premium=String.raw`package com.nova.audify;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Audify Premium V68.12.46 — vitrine native 10 €/mois.
 * Les avantages sont une prévisualisation de la roadmap : le CTA n'ouvre aucun
 * achat tant que les fonctions Premium ne sont pas réellement activées.
 */
public class AudifyPremiumActivity extends AppCompatActivity {
    private static final int BG=Color.rgb(5,7,17);
    private static final int TEXT=Color.rgb(247,247,252);
    private static final int MUTED=Color.rgb(174,177,199);
    private static final int PINK=Color.rgb(255,55,179);
    private static final int VIOLET=Color.rgb(137,72,255);
    private static final int ORANGE=Color.rgb(255,137,69);
    private static final int BLUE=Color.rgb(66,98,255);

    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        try{ if(getSupportActionBar()!=null)getSupportActionBar().hide(); }catch(Throwable ignored){}
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);

        FrameLayout root=new FrameLayout(this);
        root.setBackgroundColor(BG);
        root.addView(new PremiumBackdrop(this),new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        LinearLayout page=new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(18),dp(16),dp(18),dp(42));
        scroll.addView(page,new ScrollView.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll,new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        LinearLayout header=new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        Button back=ghostButton("‹");
        back.setContentDescription("Retour");
        back.setOnClickListener(v->finish());
        header.addView(back,new LinearLayout.LayoutParams(dp(48),dp(48)));
        TextView spacer=new TextView(this);
        header.addView(spacer,new LinearLayout.LayoutParams(0,dp(48),1f));
        TextView premiumBadge=text("◆  PREMIUM",12f,true,TEXT);
        premiumBadge.setGravity(Gravity.CENTER);
        premiumBadge.setLetterSpacing(0.08f);
        premiumBadge.setBackground(gradient(PINK,ORANGE,dp(24),1,Color.argb(130,255,177,223)));
        header.addView(premiumBadge,new LinearLayout.LayoutParams(dp(132),dp(46)));
        page.addView(header,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(50)));

        LinearLayout hero=new LinearLayout(this);
        hero.setOrientation(LinearLayout.VERTICAL);
        hero.setGravity(Gravity.CENTER_HORIZONTAL);
        hero.setPadding(dp(18),dp(22),dp(18),dp(24));
        hero.setBackground(gradient(Color.rgb(24,13,41),Color.rgb(10,13,31),dp(30),1,Color.argb(120,181,96,255)));
        hero.setElevation(dp(5));
        LinearLayout.LayoutParams heroLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        heroLp.topMargin=dp(12);
        page.addView(hero,heroLp);

        TextView mark=text("A",42f,true,TEXT);
        mark.setGravity(Gravity.CENTER);
        mark.setTextColor(Color.rgb(255,150,222));
        mark.setBackground(gradient(PINK,BLUE,dp(30),1,Color.argb(180,255,255,255)));
        hero.addView(mark,new LinearLayout.LayoutParams(dp(68),dp(68)));

        TextView eyebrow=text("AUDIFY PREMIUM",11.5f,true,Color.rgb(255,173,224));
        eyebrow.setGravity(Gravity.CENTER);
        eyebrow.setLetterSpacing(0.15f);
        LinearLayout.LayoutParams eyebrowLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30));
        eyebrowLp.topMargin=dp(8);
        hero.addView(eyebrow,eyebrowLp);

        TextView title=text("Passez à\nAudify Premium",34f,true,TEXT);
        title.setGravity(Gravity.CENTER);
        title.setLineSpacing(dp(1),0.96f);
        hero.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(92)));

        TextView sub=text("Votre musique, votre profil et vos amis — avec une expérience Audify encore plus personnelle.",14.7f,false,MUTED);
        sub.setGravity(Gravity.CENTER);
        sub.setLineSpacing(dp(2),1.07f);
        hero.addView(sub,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(70)));

        LinearLayout price=new LinearLayout(this);
        price.setGravity(Gravity.CENTER);
        price.setPadding(dp(18),0,dp(18),0);
        price.setBackground(gradient(Color.rgb(62,25,80),Color.rgb(21,28,67),dp(26),1,Color.argb(175,255,105,220)));
        TextView amount=text("10 €",42f,true,TEXT);
        amount.setGravity(Gravity.CENTER_VERTICAL|Gravity.END);
        price.addView(amount,new LinearLayout.LayoutParams(0,dp(82),1f));
        TextView month=text("/ mois",17f,false,Color.rgb(231,190,224));
        month.setGravity(Gravity.CENTER_VERTICAL|Gravity.START);
        price.addView(month,new LinearLayout.LayoutParams(dp(92),dp(82)));
        LinearLayout.LayoutParams priceLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(82));
        priceLp.topMargin=dp(12);
        hero.addView(price,priceLp);

        TextView coming=text("PRÉVISUALISATION · ABONNEMENT BIENTÔT DISPONIBLE",10.2f,true,Color.rgb(170,255,84));
        coming.setGravity(Gravity.CENTER);
        coming.setLetterSpacing(0.07f);
        LinearLayout.LayoutParams comingLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(36));
        comingLp.topMargin=dp(8);
        hero.addView(coming,comingLp);

        TextView benefitsTitle=text("Vos avantages Premium",22f,true,TEXT);
        LinearLayout.LayoutParams benefitsTitleLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(52));
        benefitsTitleLp.topMargin=dp(20);
        page.addView(benefitsTitle,benefitsTitleLp);

        TextView benefitsSub=text("Une version d’Audify pensée pour aller plus loin que la simple suppression des pubs.",13.2f,false,MUTED);
        benefitsSub.setLineSpacing(dp(2),1.04f);
        LinearLayout.LayoutParams benefitsSubLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58));
        benefitsSubLp.bottomMargin=dp(6);
        page.addView(benefitsSub,benefitsSubLp);

        int delay=80;
        delay=feature(page,"⊘","Plus de pubs","Écoutez votre musique sans interruption publicitaire Audify.",PINK,delay);
        delay=feature(page,"♪","Karaoké sans pub","Profitez du Karaoké débloqué sans coupure publicitaire.",VIOLET,delay);
        delay=feature(page,"▰","Bannière de profil","Créez une bannière qui reflète vraiment votre univers musical.",ORANGE,delay);
        delay=feature(page,"GIF","Photo de profil GIF","Importez un GIF et donnez vie à votre identité Audify.",PINK,delay);
        delay=feature(page,"◉","Lecteur personnalisable","Personnalisez la pochette, le disque/vinyle et le style du lecteur.",BLUE,delay);
        delay=feature(page,"∞","Playlists partagées","Invitez vos amis et construisez ensemble une playlist liée à vos comptes.",VIOLET,delay);
        delay=feature(page,"♥","Réactions entre amis","Réagissez aux morceaux d’une playlist partagée avec vos amis.",PINK,delay);
        delay=feature(page,"✦","Audify Party","Créez une session par lien ou QR code et partagez la file d’écoute en groupe.",ORANGE,delay);

        LinearLayout partySpot=new LinearLayout(this);
        partySpot.setOrientation(LinearLayout.VERTICAL);
        partySpot.setPadding(dp(18),dp(18),dp(18),dp(18));
        partySpot.setBackground(gradient(Color.rgb(29,18,60),Color.rgb(11,18,42),dp(28),1,Color.argb(145,126,94,255)));
        LinearLayout.LayoutParams partyLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        partyLp.topMargin=dp(14);
        page.addView(partySpot,partyLp);
        TextView partyEyebrow=text("✦  AUDIFY PARTY",11.5f,true,Color.rgb(255,178,215));
        partyEyebrow.setLetterSpacing(0.12f);
        partySpot.addView(partyEyebrow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(28)));
        TextView partyTitle=text("La musique devient sociale.",22f,true,TEXT);
        partySpot.addView(partyTitle,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(42)));
        TextView partyText=text("Un ami rejoint la session, propose un morceau, vote ou réagit — tout le monde reste dans la même ambiance.",13.5f,false,MUTED);
        partyText.setLineSpacing(dp(2),1.05f);
        partySpot.addView(partyText,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(78)));
        LinearLayout avatars=new LinearLayout(this);
        avatars.setGravity(Gravity.CENTER_VERTICAL);
        avatars.addView(avatar("A",PINK),new LinearLayout.LayoutParams(dp(44),dp(44)));
        avatars.addView(avatar("K",VIOLET),new LinearLayout.LayoutParams(dp(44),dp(44)));
        avatars.addView(avatar("S",ORANGE),new LinearLayout.LayoutParams(dp(44),dp(44)));
        TextView joined=text("  + amis connectés",13f,true,Color.rgb(220,225,239));
        avatars.addView(joined,new LinearLayout.LayoutParams(0,dp(44),1f));
        partySpot.addView(avatars,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));

        Button cta=gradientButton("S’abonner · 10 € / mois");
        LinearLayout.LayoutParams ctaLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(66));
        ctaLp.topMargin=dp(22);
        page.addView(cta,ctaLp);

        boolean alreadyPremium=false;
        try{ alreadyPremium=AudifyMonetizationManager.isPremiumStatic(this); }catch(Throwable ignored){}
        final boolean premiumActive=alreadyPremium;
        if(premiumActive){
            cta.setText("Premium déjà actif");
            cta.setEnabled(false);
        }else{
            cta.setOnClickListener(v->Toast.makeText(
                this,
                "Audify Premium arrive prochainement. Aucun paiement n’est effectué aujourd’hui.",
                Toast.LENGTH_LONG
            ).show());
        }

        TextView note=text("Les avantages ci-dessus présentent la roadmap Premium. Nous activerons l’abonnement lorsque les fonctions correspondantes seront disponibles.",11.5f,false,Color.rgb(126,132,157));
        note.setGravity(Gravity.CENTER);
        note.setLineSpacing(dp(2),1.04f);
        LinearLayout.LayoutParams noteLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(78));
        noteLp.topMargin=dp(8);
        page.addView(note,noteLp);

        hero.setAlpha(0f);
        hero.setTranslationY(dp(16));
        hero.animate().alpha(1f).translationY(0f).setDuration(420L).start();
        benefitsTitle.setAlpha(0f);
        benefitsTitle.animate().alpha(1f).setStartDelay(160L).setDuration(320L).start();
        partySpot.setAlpha(0f);
        partySpot.setTranslationY(dp(16));
        partySpot.animate().alpha(1f).translationY(0f).setStartDelay(delay+60L).setDuration(380L).start();
        cta.setAlpha(0f);
        cta.setScaleX(0.96f);
        cta.setScaleY(0.96f);
        cta.animate().alpha(1f).scaleX(1f).scaleY(1f).setStartDelay(delay+150L).setDuration(420L).start();
    }

    private int feature(LinearLayout parent,String glyph,String title,String description,int accent,int delay){
        LinearLayout card=new LinearLayout(this);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(12),dp(12),dp(12),dp(12));
        card.setBackground(gradient(Color.rgb(21,23,44),Color.rgb(11,14,30),dp(24),1,Color.argb(120,132,111,185)));

        TextView icon=text(glyph,glyph.length()>1?12f:22f,true,TEXT);
        icon.setGravity(Gravity.CENTER);
        icon.setTextColor(accent);
        icon.setBackground(round(Color.argb(45,Color.red(accent),Color.green(accent),Color.blue(accent)),1,Color.argb(150,Color.red(accent),Color.green(accent),Color.blue(accent)),dp(18)));
        card.addView(icon,new LinearLayout.LayoutParams(dp(58),dp(58)));

        LinearLayout copy=new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(13),0,dp(4),0);
        TextView t=text(title,16f,true,TEXT);
        TextView d=text(description,12.5f,false,Color.rgb(175,180,201));
        d.setMaxLines(3);
        d.setLineSpacing(dp(1),1.03f);
        copy.addView(t,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(28)));
        copy.addView(d,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));
        card.addView(copy,new LinearLayout.LayoutParams(0,dp(78),1f));

        TextView arrow=text("›",28f,false,Color.rgb(224,226,239));
        arrow.setGravity(Gravity.CENTER);
        card.addView(arrow,new LinearLayout.LayoutParams(dp(28),dp(72)));

        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(94));
        lp.topMargin=dp(8);
        parent.addView(card,lp);

        card.setAlpha(0f);
        card.setTranslationY(dp(12));
        card.animate().alpha(1f).translationY(0f).setStartDelay(delay).setDuration(330L).start();
        return delay+55;
    }

    private TextView avatar(String label,int accent){
        TextView a=text(label,15f,true,TEXT);
        a.setGravity(Gravity.CENTER);
        a.setBackground(round(Color.argb(70,Color.red(accent),Color.green(accent),Color.blue(accent)),1,accent,dp(22)));
        return a;
    }

    private Button gradientButton(String label){
        Button b=new Button(this);
        b.setAllCaps(false);
        b.setText(label);
        b.setTextSize(17f);
        b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        b.setTextColor(Color.WHITE);
        b.setBackground(gradient(PINK,BLUE,dp(28),1,Color.argb(180,255,172,226)));
        b.setElevation(dp(7));
        return b;
    }

    private Button ghostButton(String label){
        Button b=new Button(this);
        b.setAllCaps(false);
        b.setText(label);
        b.setTextSize(28f);
        b.setTypeface(Typeface.DEFAULT,Typeface.NORMAL);
        b.setTextColor(Color.WHITE);
        b.setPadding(0,0,0,dp(3));
        b.setBackground(round(Color.argb(115,24,27,50),1,Color.argb(145,97,100,132),dp(24)));
        return b;
    }

    private TextView text(String value,float sp,boolean bold,int color){
        TextView t=new TextView(this);
        t.setText(value);
        t.setTextSize(sp);
        t.setTextColor(color);
        if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        t.setGravity(Gravity.CENTER_VERTICAL);
        return t;
    }

    private GradientDrawable gradient(int start,int end,int radius,int stroke,int strokeColor){
        GradientDrawable d=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{start,end});
        d.setCornerRadius(radius);
        if(stroke>0)d.setStroke(dp(stroke),strokeColor);
        return d;
    }

    private GradientDrawable round(int fill,int stroke,int strokeColor,int radius){
        GradientDrawable d=new GradientDrawable();
        d.setColor(fill);
        d.setCornerRadius(radius);
        if(stroke>0)d.setStroke(dp(stroke),strokeColor);
        return d;
    }

    private int dp(int value){
        return Math.round(value*getResources().getDisplayMetrics().density);
    }

    private static final class PremiumBackdrop extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        PremiumBackdrop(android.content.Context context){ super(context); p.setStyle(Paint.Style.FILL); }
        @Override protected void onDraw(Canvas canvas){
            super.onDraw(canvas);
            float w=getWidth(),h=getHeight();
            if(w<=0||h<=0)return;
            long now=SystemClock.uptimeMillis();
            float phase=(now%9000L)/9000f;
            drawOrb(canvas,w*0.18f,h*(0.16f+0.015f*(float)Math.sin(phase*Math.PI*2)),w*0.34f,255,34,174,32);
            drawOrb(canvas,w*0.87f,h*(0.33f+0.018f*(float)Math.cos(phase*Math.PI*2)),w*0.38f,74,77,255,30);
            drawOrb(canvas,w*0.42f,h*(0.72f+0.012f*(float)Math.sin(phase*Math.PI*4)),w*0.42f,155,50,255,22);
            for(int i=0;i<18;i++){
                float x=((i*73)%101)/101f*w;
                float y=((i*47+17)%103)/103f*h;
                float twinkle=0.35f+0.65f*(float)Math.abs(Math.sin((phase*6.283f)+(i*0.71f)));
                p.setColor(Color.argb((int)(42*twinkle),255,205,244));
                canvas.drawCircle(x,y,1.2f+(i%3)*0.45f,p);
            }
            postInvalidateDelayed(40L);
        }
        private void drawOrb(Canvas c,float x,float y,float r,int red,int green,int blue,int alpha){
            p.setColor(Color.argb(alpha,red,green,blue));
            c.drawCircle(x,y,r,p);
            p.setColor(Color.argb(Math.max(8,alpha/2),red,green,blue));
            c.drawCircle(x,y,r*0.64f,p);
        }
    }
}
`;
await writeFile(premiumPath,premium,'utf8');

console.log('Audify V68.12.46 : Premium 10€/mois redesign + 8 avantages + animations + Redmi NoActionBar + activation Media3 V2 stable.');
