import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');

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
        if(depth===0){ end=i+1; break; }
      }
    }
    if(end>0) return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error(`V68.12.1 méthode introuvable: ${label}`);
}

// -----------------------------------------------------------------------------
// 1) HOME : bouton Compte Audify / Se connecter en haut du contenu.
// -----------------------------------------------------------------------------
let home=await readFile(homePath,'utf8');
home=replaceMethod(home,['    private void rebuildLibrary(){','    private void rebuildLibrary() {'],String.raw`    private void rebuildLibrary(){
        libraryContent.removeAllViews();
        addAccountEntryV68121();
        addForYouSection();
        addRecentSection();
        addFavoritesIntro();
        addLikesSection();
        addPlaylistsSection();
    }`,'rebuildLibrary');

if(!home.includes('private void addAccountEntryV68121(')){
  const marker='    private void addForYouSection(){';
  if(!home.includes(marker)) throw new Error('V68.12.1 point insertion Compte introuvable');
  const helper=String.raw`    private void addAccountEntryV68121(){
        LinearLayout panel=sectionPanel();
        panel.setGravity(Gravity.CENTER_VERTICAL);
        panel.setPadding(dp(16),dp(12),dp(12),dp(12));

        LinearLayout info=new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setGravity(Gravity.CENTER_VERTICAL);
        TextView eyebrow=text("COMPTE AUDIFY",11.5f,true);
        eyebrow.setTextColor(ACCENT);
        eyebrow.setLetterSpacing(0.12f);
        TextView sub=text("Connecte-toi à Audify",15f,true);
        sub.setTextColor(Color.rgb(224,229,237));
        info.addView(eyebrow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(23)));
        info.addView(sub,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(27)));
        panel.addView(info,new LinearLayout.LayoutParams(0,dp(54),1f));

        Button signIn=pillButton("Se connecter");
        signIn.setTextSize(14.5f);
        signIn.setTextColor(Color.rgb(12,18,12));
        signIn.setBackground(round(ACCENT,0,Color.TRANSPARENT,dp(24)));
        signIn.setOnClickListener(v->startActivity(new Intent(this,AudifyLoginActivity.class)));
        panel.addView(signIn,new LinearLayout.LayoutParams(dp(132),dp(50)));
        addPanel(panel,dp(12));
    }

`;
  home=home.replace(marker,helper+marker);
}
await writeFile(homePath,home,'utf8');

// -----------------------------------------------------------------------------
// 2) ÉCRAN DE CONNEXION : interface uniquement, aucune authentification active.
// -----------------------------------------------------------------------------
const login=String.raw`package com.nova.audify;

import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

/** Audify V68.12.1 — écran de connexion visuel, sans backend/authentification. */
public class AudifyLoginActivity extends AppCompatActivity {
    private static final int BG=Color.rgb(7,11,17);
    private static final int CARD=Color.rgb(13,19,27);
    private static final int FIELD=Color.rgb(18,25,34);
    private static final int BORDER=Color.rgb(55,66,79);
    private static final int MUTED=Color.rgb(156,166,180);
    private static final int ACCENT=Color.rgb(137,255,48);

    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        if(android.os.Build.VERSION.SDK_INT>=35){
            Window w=getWindow();
            WindowInsetsController c=w.getInsetsController();
            if(c!=null) c.setSystemBarsAppearance(0,WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        }

        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);

        LinearLayout page=new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(20),dp(18),dp(20),dp(34));
        scroll.addView(page,new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));

        Button back=button("‹",44f,true);
        back.setGravity(Gravity.CENTER);
        back.setTextColor(Color.WHITE);
        back.setBackground(round(Color.rgb(13,19,27),dp(1),BORDER,dp(22)));
        back.setOnClickListener(v->finish());
        page.addView(back,new LinearLayout.LayoutParams(dp(50),dp(50)));

        TextView brand=text("AUDIFY",13f,true);
        brand.setTextColor(ACCENT);
        brand.setLetterSpacing(0.20f);
        LinearLayout.LayoutParams brandLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30));
        brandLp.topMargin=dp(34);
        page.addView(brand,brandLp);

        TextView title=text("Se connecter",34f,true);
        page.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54)));

        TextView subtitle=text("Retrouve bientôt ton compte et ta bibliothèque Audify sur tous tes appareils.",15.5f,false);
        subtitle.setTextColor(MUTED);
        subtitle.setLineSpacing(dp(2),1.08f);
        LinearLayout.LayoutParams subLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        subLp.bottomMargin=dp(28);
        page.addView(subtitle,subLp);

        LinearLayout card=new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16),dp(18),dp(16),dp(18));
        card.setBackground(round(CARD,dp(1),Color.rgb(38,47,58),dp(28)));
        page.addView(card,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView mailLabel=text("Adresse e-mail",13.5f,true);
        mailLabel.setTextColor(Color.rgb(214,220,229));
        card.addView(mailLabel,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(32)));

        EditText email=field("nom@exemple.com");
        email.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        email.setSingleLine(true);
        card.addView(email,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));

        TextView passwordLabel=text("Mot de passe",13.5f,true);
        passwordLabel.setTextColor(Color.rgb(214,220,229));
        LinearLayout.LayoutParams passLabelLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(38));
        passLabelLp.topMargin=dp(12);
        card.addView(passwordLabel,passLabelLp);

        EditText password=field("••••••••");
        password.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        password.setSingleLine(true);
        card.addView(password,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));

        Button login=disabledButton("Se connecter",true);
        LinearLayout.LayoutParams loginLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58));
        loginLp.topMargin=dp(22);
        card.addView(login,loginLp);

        TextView future=text("Les boutons seront activés lors de la prochaine étape du système de compte.",12.5f,false);
        future.setTextColor(Color.rgb(124,136,150));
        future.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams futureLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        futureLp.topMargin=dp(10);
        card.addView(future,futureLp);

        Button create=disabledButton("Créer un compte",false);
        LinearLayout.LayoutParams createLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(56));
        createLp.topMargin=dp(22);
        card.addView(create,createLp);

        TextView or=text("ou",13f,false);
        or.setTextColor(Color.rgb(113,125,140));
        or.setGravity(Gravity.CENTER);
        card.addView(or,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(42)));

        Button google=disabledButton("G   Se connecter avec Google",false);
        card.addView(google,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(56)));

        Button apple=disabledButton("●   Se connecter avec Apple",false);
        LinearLayout.LayoutParams appleLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(56));
        appleLp.topMargin=dp(10);
        card.addView(apple,appleLp);

        setContentView(scroll);
    }

    private EditText field(String hint){
        EditText e=new EditText(this);
        e.setHint(hint);
        e.setHintTextColor(Color.rgb(102,114,129));
        e.setTextColor(Color.WHITE);
        e.setTextSize(16f);
        e.setPadding(dp(16),0,dp(16),0);
        e.setBackground(round(FIELD,dp(1),BORDER,dp(18)));
        e.setSelectAllOnFocus(false);
        return e;
    }

    private Button disabledButton(String label,boolean accent){
        Button b=button(label,15.5f,true);
        b.setAllCaps(false);
        b.setTextColor(accent?Color.rgb(22,31,18):Color.rgb(205,212,222));
        b.setBackground(accent
            ?round(ACCENT,0,Color.TRANSPARENT,dp(22))
            :round(Color.rgb(20,27,36),dp(1),Color.rgb(58,68,81),dp(22)));
        // Étape V68.12.1 : aucune action d'authentification n'est volontairement câblée.
        b.setEnabled(false);
        b.setAlpha(accent?0.72f:0.58f);
        return b;
    }

    private Button button(String value,float size,boolean bold){
        Button b=new Button(this);
        b.setAllCaps(false);
        b.setText(value);
        b.setTextSize(size);
        if(bold) b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        b.setPadding(0,0,0,0);
        b.setStateListAnimator(null);
        return b;
    }

    private TextView text(String value,float size,boolean bold){
        TextView t=new TextView(this);
        t.setText(value);
        t.setTextColor(Color.WHITE);
        t.setTextSize(size);
        if(bold) t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        t.setGravity(Gravity.CENTER_VERTICAL);
        return t;
    }

    private GradientDrawable round(int fill,int strokeWidth,int stroke,int radius){
        GradientDrawable d=new GradientDrawable();
        d.setColor(fill);
        d.setCornerRadius(radius);
        if(strokeWidth>0) d.setStroke(strokeWidth,stroke);
        return d;
    }

    private int dp(int value){
        return Math.round(value*getResources().getDisplayMetrics().density);
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyLoginActivity.java'),login,'utf8');

// -----------------------------------------------------------------------------
// 3) Manifest : activité interne, non exportée.
// -----------------------------------------------------------------------------
let manifest=await readFile(manifestPath,'utf8');
if(!manifest.includes('android:name=".AudifyLoginActivity"')){
  const activity=`        <activity\n            android:name=".AudifyLoginActivity"\n            android:exported="false"\n            android:screenOrientation="portrait" />\n`;
  manifest=manifest.replace('</application>',activity+'    </application>');
}
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify V68.12.1 : bouton Se connecter + écran login visuel (email/mot de passe saisissables, actions désactivées).');
