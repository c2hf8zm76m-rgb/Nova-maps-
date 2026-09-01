import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const loginPath=path.join(pkgDir,'AudifyLoginActivity.java');

let login=await readFile(loginPath,'utf8');

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
  throw new Error('V68.12.17 méthode introuvable: '+label);
}

const renderAuth=String.raw`    private void renderAuth(){
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
            AudifyAccountStore.Result r=createModeV681215
                ?accounts.createAccount(email.getText().toString(),password.getText().toString())
                :accounts.signIn(email.getText().toString(),password.getText().toString());
            showStatus(status,r);
            if(r.ok)status.postDelayed(()->renderProfile(),420L);
        });

        create.setOnClickListener(v->{
            hideKeyboard();
            createModeV681215=!createModeV681215;
            renderAuth();
        });

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
    }`;

login=replaceMethod(login,['    private void renderAuth(){','    private void renderAuth() {'],renderAuth,'renderAuth');

if(!login.includes('private EditText premiumFieldV681217(')){
  const marker='    private void renderProfile(){';
  if(!login.includes(marker)) throw new Error('V68.12.17 repère renderProfile introuvable');
  const helpers=String.raw`    private EditText premiumFieldV681217(LinearLayout parent,String icon,String label,String hint,int inputType){
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

`;
  login=login.replace(marker,helpers+marker);
}

await writeFile(loginPath,login,'utf8');
console.log('Audify V68.12.17 : redesign premium des écrans Connexion/Création avec hero musical, champs iconisés, carte dégradée, CTA premium et micro-animations.');
