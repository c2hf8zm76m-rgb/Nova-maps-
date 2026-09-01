import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
const loginPath=path.join(pkgDir,'AudifyLoginActivity.java');

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
  throw new Error(`V68.12.2 méthode introuvable: ${label}`);
}

// =============================================================================
// 1) Account Core local : hash PBKDF2 + salt, session persistante, aucun mot de
//    passe en clair. Couche volontairement migrable vers un backend cloud.
// =============================================================================
const store=String.raw`package com.nova.audify;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import android.util.Patterns;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Locale;
import java.util.UUID;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/** Audify V68.12.2 — noyau de compte local sécurisé, prêt à migrer vers le cloud. */
public final class AudifyAccountStore {
    private static final String PREFS="audify_account_core_v68122";
    private static final String SESSION_EMAIL="session_email";
    private static final String SESSION_UID="session_uid";
    private static final int ITERATIONS=150000;
    private static final int KEY_BITS=256;
    private static final SecureRandom RANDOM=new SecureRandom();

    public static final class Result {
        public final boolean ok;
        public final String message;
        Result(boolean ok,String message){this.ok=ok;this.message=message;}
        public static Result ok(String message){return new Result(true,message);}
        public static Result error(String message){return new Result(false,message);}
    }

    private final SharedPreferences prefs;

    public AudifyAccountStore(Context context){
        prefs=context.getApplicationContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE);
    }

    public boolean isSignedIn(){
        return !prefs.getString(SESSION_EMAIL,"").isEmpty() && !prefs.getString(SESSION_UID,"").isEmpty();
    }

    public String getCurrentEmail(){return prefs.getString(SESSION_EMAIL,"");}
    public String getCurrentUid(){return prefs.getString(SESSION_UID,"");}

    public long getCreatedAt(){
        String email=getCurrentEmail();
        if(email.isEmpty()) return 0L;
        String record=prefs.getString(accountKey(email),"");
        String[] p=record.split("\\|",-1);
        if(p.length<4) return 0L;
        try{return Long.parseLong(p[3]);}catch(Exception ignored){return 0L;}
    }

    public Result createAccount(String rawEmail,String password){
        String email=normalizeEmail(rawEmail);
        Result validation=validate(email,password);
        if(!validation.ok) return validation;
        String key=accountKey(email);
        if(prefs.contains(key)) return Result.error("Un compte Audify existe déjà avec cette adresse e-mail.");
        try{
            byte[] salt=new byte[18];
            RANDOM.nextBytes(salt);
            byte[] hash=derive(password,salt);
            String uid=UUID.randomUUID().toString();
            long created=System.currentTimeMillis();
            String record=Base64.encodeToString(salt,Base64.NO_WRAP)+"|"+
                Base64.encodeToString(hash,Base64.NO_WRAP)+"|"+uid+"|"+created;
            boolean saved=prefs.edit()
                .putString(key,record)
                .putString(SESSION_EMAIL,email)
                .putString(SESSION_UID,uid)
                .commit();
            return saved?Result.ok("Compte créé. Bienvenue sur Audify."):Result.error("Impossible d'enregistrer le compte sur cet appareil.");
        }catch(Exception e){
            return Result.error("Impossible de créer le compte. Réessaie.");
        }
    }

    public Result signIn(String rawEmail,String password){
        String email=normalizeEmail(rawEmail);
        if(email.isEmpty()||password==null||password.isEmpty()) return Result.error("Entre ton adresse e-mail et ton mot de passe.");
        String record=prefs.getString(accountKey(email),"");
        if(record.isEmpty()) return Result.error("Aucun compte Audify trouvé avec cette adresse e-mail.");
        try{
            String[] p=record.split("\\|",-1);
            if(p.length<4) return Result.error("Ce compte local est illisible.");
            byte[] salt=Base64.decode(p[0],Base64.NO_WRAP);
            byte[] expected=Base64.decode(p[1],Base64.NO_WRAP);
            byte[] actual=derive(password,salt);
            if(!MessageDigest.isEqual(expected,actual)) return Result.error("Mot de passe incorrect.");
            prefs.edit().putString(SESSION_EMAIL,email).putString(SESSION_UID,p[2]).commit();
            return Result.ok("Connexion réussie.");
        }catch(Exception e){
            return Result.error("Impossible d'ouvrir cette session.");
        }
    }

    public void signOut(){
        prefs.edit().remove(SESSION_EMAIL).remove(SESSION_UID).commit();
    }

    private Result validate(String email,String password){
        if(email.isEmpty()||!Patterns.EMAIL_ADDRESS.matcher(email).matches()) return Result.error("Entre une adresse e-mail valide.");
        if(password==null||password.length()<8) return Result.error("Le mot de passe doit contenir au moins 8 caractères.");
        return Result.ok("");
    }

    private String normalizeEmail(String value){
        return value==null?"":value.trim().toLowerCase(Locale.ROOT);
    }

    private String accountKey(String email){
        try{
            byte[] digest=MessageDigest.getInstance("SHA-256").digest(normalizeEmail(email).getBytes(StandardCharsets.UTF_8));
            return "account_"+Base64.encodeToString(digest,Base64.NO_WRAP|Base64.URL_SAFE);
        }catch(Exception e){
            return "account_"+Integer.toHexString(normalizeEmail(email).hashCode());
        }
    }

    private byte[] derive(String password,byte[] salt)throws Exception{
        PBEKeySpec spec=new PBEKeySpec(password.toCharArray(),salt,ITERATIONS,KEY_BITS);
        try{return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();}
        finally{spec.clearPassword();}
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyAccountStore.java'),store,'utf8');

// =============================================================================
// 2) Login / Create / Profile : les boutons e-mail deviennent réels.
//    Google et Apple restent volontairement inactifs.
// =============================================================================
const login=String.raw`package com.nova.audify;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
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

/** Audify V68.12.2 — Account Core e-mail/mot de passe + profil + session persistante. */
public class AudifyLoginActivity extends AppCompatActivity {
    private static final int BG=Color.rgb(7,11,17);
    private static final int CARD=Color.rgb(13,19,27);
    private static final int FIELD=Color.rgb(18,25,34);
    private static final int BORDER=Color.rgb(55,66,79);
    private static final int MUTED=Color.rgb(156,166,180);
    private static final int ACCENT=Color.rgb(137,255,48);
    private AudifyAccountStore accounts;

    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        accounts=new AudifyAccountStore(this);
        styleWindow();
        render();
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
        LinearLayout page=basePage();
        TextView title=text("Se connecter",34f,true);
        page.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54)));
        TextView subtitle=text("Crée ton compte Audify ou reconnecte-toi. Ta session restera active sur cet appareil.",15.5f,false);
        subtitle.setTextColor(MUTED); subtitle.setLineSpacing(dp(2),1.08f);
        LinearLayout.LayoutParams subLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        subLp.bottomMargin=dp(28); page.addView(subtitle,subLp);

        LinearLayout card=new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(16),dp(18),dp(16),dp(18));
        card.setBackground(round(CARD,dp(1),Color.rgb(38,47,58),dp(28)));
        page.addView(card,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView mailLabel=text("Adresse e-mail",13.5f,true); mailLabel.setTextColor(Color.rgb(214,220,229));
        card.addView(mailLabel,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(32)));
        EditText email=field("nom@exemple.com"); email.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS); email.setSingleLine(true);
        card.addView(email,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));

        TextView passwordLabel=text("Mot de passe",13.5f,true); passwordLabel.setTextColor(Color.rgb(214,220,229));
        LinearLayout.LayoutParams plp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(38)); plp.topMargin=dp(12); card.addView(passwordLabel,plp);
        EditText password=field("8 caractères minimum"); password.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD); password.setSingleLine(true);
        card.addView(password,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));

        TextView status=text("",13f,true); status.setGravity(Gravity.CENTER); status.setVisibility(android.view.View.GONE);
        LinearLayout.LayoutParams statusLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT); statusLp.topMargin=dp(12);

        Button signIn=activeButton("Se connecter",true);
        LinearLayout.LayoutParams loginLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)); loginLp.topMargin=dp(22); card.addView(signIn,loginLp);
        card.addView(status,statusLp);

        Button create=activeButton("Créer un compte",false);
        LinearLayout.LayoutParams createLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(56)); createLp.topMargin=dp(18); card.addView(create,createLp);

        signIn.setOnClickListener(v->{
            hideKeyboard();
            AudifyAccountStore.Result r=accounts.signIn(email.getText().toString(),password.getText().toString());
            showStatus(status,r);
            if(r.ok) status.postDelayed(()->{renderProfile();},420L);
        });
        create.setOnClickListener(v->{
            hideKeyboard();
            AudifyAccountStore.Result r=accounts.createAccount(email.getText().toString(),password.getText().toString());
            showStatus(status,r);
            if(r.ok) status.postDelayed(()->{renderProfile();},420L);
        });

        TextView or=text("ou",13f,false); or.setTextColor(Color.rgb(113,125,140)); or.setGravity(Gravity.CENTER);
        card.addView(or,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(42)));

        Button google=inactiveButton("G   Se connecter avec Google");
        card.addView(google,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(56)));
        Button apple=inactiveButton("●   Se connecter avec Apple");
        LinearLayout.LayoutParams appleLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(56)); appleLp.topMargin=dp(10); card.addView(apple,appleLp);

        TextView note=text("Google et Apple seront activés dans les prochaines étapes.",12.5f,false);
        note.setTextColor(Color.rgb(124,136,150)); note.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams nlp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT); nlp.topMargin=dp(14); card.addView(note,nlp);
    }

    private void renderProfile(){
        LinearLayout page=basePage();
        TextView title=text("Ton compte",34f,true);
        page.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54)));
        TextView subtitle=text("Ta session Audify est active sur cet appareil.",15.5f,false); subtitle.setTextColor(MUTED);
        LinearLayout.LayoutParams slp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT); slp.bottomMargin=dp(26); page.addView(subtitle,slp);

        LinearLayout card=new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(18),dp(20),dp(18),dp(20));
        card.setBackground(round(CARD,dp(1),Color.rgb(45,57,67),dp(28)));
        page.addView(card,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView avatar=text(initial(accounts.getCurrentEmail()),30f,true); avatar.setGravity(Gravity.CENTER); avatar.setTextColor(Color.rgb(16,24,13)); avatar.setBackground(round(ACCENT,0,Color.TRANSPARENT,dp(34)));
        card.addView(avatar,new LinearLayout.LayoutParams(dp(68),dp(68)));

        TextView label=text("COMPTE AUDIFY",11.5f,true); label.setLetterSpacing(0.12f); label.setTextColor(ACCENT);
        LinearLayout.LayoutParams llp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(28)); llp.topMargin=dp(18); card.addView(label,llp);
        TextView email=text(accounts.getCurrentEmail(),20f,true); email.setTextColor(Color.WHITE); card.addView(email,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(42)));

        long created=accounts.getCreatedAt();
        String date=created>0?DateFormat.getDateInstance(DateFormat.MEDIUM).format(new Date(created)):"Aujourd'hui";
        TextView meta=text("Compte créé le "+date+"\nSession persistante activée",14f,false); meta.setTextColor(MUTED); meta.setLineSpacing(dp(2),1.12f);
        LinearLayout.LayoutParams mlp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT); mlp.topMargin=dp(4); card.addView(meta,mlp);

        LinearLayout cloud=new LinearLayout(this); cloud.setOrientation(LinearLayout.VERTICAL); cloud.setPadding(dp(15),dp(12),dp(15),dp(12)); cloud.setBackground(round(Color.rgb(17,27,22),dp(1),Color.rgb(55,89,43),dp(20)));
        TextView cloudTitle=text("Synchronisation cloud",14f,true); cloudTitle.setTextColor(ACCENT); cloud.addView(cloudTitle);
        TextView cloudText=text("Pas encore activée — ce noyau de compte sera relié au cloud dans une prochaine version.",13f,false); cloudText.setTextColor(Color.rgb(180,191,184)); cloud.addView(cloudText);
        LinearLayout.LayoutParams clp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT); clp.topMargin=dp(22); card.addView(cloud,clp);

        Button logout=activeButton("Se déconnecter",false); logout.setTextColor(Color.rgb(255,164,164)); logout.setBackground(round(Color.rgb(31,21,24),dp(1),Color.rgb(105,57,65),dp(22)));
        LinearLayout.LayoutParams lop=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)); lop.topMargin=dp(24); card.addView(logout,lop);
        logout.setOnClickListener(v->{accounts.signOut();renderAuth();});
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
`;
await writeFile(loginPath,login,'utf8');

// =============================================================================
// 3) Home : état du compte en direct (Se connecter -> Profil + email).
// =============================================================================
let home=await readFile(homePath,'utf8');
home=replaceMethod(home,['    private void addAccountEntryV68121(){','    private void addAccountEntryV68121() {'],String.raw`    private void addAccountEntryV68121(){
        AudifyAccountStore account=new AudifyAccountStore(this);
        LinearLayout panel=sectionPanel();
        panel.setGravity(Gravity.CENTER_VERTICAL);
        panel.setPadding(dp(16),dp(12),dp(12),dp(12));

        LinearLayout info=new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setGravity(Gravity.CENTER_VERTICAL);
        TextView eyebrow=text("COMPTE AUDIFY",11.5f,true);
        eyebrow.setTextColor(ACCENT); eyebrow.setLetterSpacing(0.12f);
        TextView sub=text(account.isSignedIn()?account.getCurrentEmail():"Connecte-toi à Audify",15f,true);
        sub.setTextColor(account.isSignedIn()?Color.rgb(215,255,195):Color.rgb(224,229,237));
        sub.setMaxLines(1); sub.setEllipsize(TextUtils.TruncateAt.END);
        info.addView(eyebrow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(23)));
        info.addView(sub,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(27)));
        panel.addView(info,new LinearLayout.LayoutParams(0,dp(54),1f));

        Button signIn=pillButton(account.isSignedIn()?"Profil":"Se connecter");
        signIn.setTextSize(14.5f); signIn.setTextColor(Color.rgb(12,18,12));
        signIn.setBackground(round(ACCENT,0,Color.TRANSPARENT,dp(24)));
        signIn.setOnClickListener(v->startActivity(new Intent(this,AudifyLoginActivity.class)));
        panel.addView(signIn,new LinearLayout.LayoutParams(dp(132),dp(50)));
        addPanel(panel,dp(12));
    }`,'addAccountEntryV68121');
await writeFile(homePath,home,'utf8');

console.log('Audify V68.12.2 : Account Core local sécurisé, création/connexion/session/profil/déconnexion actifs.');
