import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const storePath=path.join(pkgDir,'AudifyAccountStore.java');
const loginPath=path.join(pkgDir,'AudifyLoginActivity.java');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');

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
    if(end>0)return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error(`V68.12.3 méthode introuvable: ${label}`);
}

// =============================================================================
// 1) Account Store : fournisseur Google dans le même noyau de session.
// =============================================================================
let store=await readFile(storePath,'utf8');

store=store.replace(
  '    private static final String SESSION_UID="session_uid";\n',
  '    private static final String SESSION_UID="session_uid";\n    private static final String SESSION_PROVIDER="session_provider";\n    private static final String SESSION_NAME="session_name";\n    private static final String SESSION_PHOTO="session_photo";\n    private static final String SESSION_CREATED_AT="session_created_at";\n'
);

store=store.replace(
  '    public String getCurrentEmail(){return prefs.getString(SESSION_EMAIL,"");}\n    public String getCurrentUid(){return prefs.getString(SESSION_UID,"");}\n',
  '    public String getCurrentEmail(){return prefs.getString(SESSION_EMAIL,"");}\n    public String getCurrentUid(){return prefs.getString(SESSION_UID,"");}\n    public String getCurrentProvider(){return prefs.getString(SESSION_PROVIDER,"email");}\n    public String getCurrentDisplayName(){return prefs.getString(SESSION_NAME,"");}\n    public String getCurrentPhotoUrl(){return prefs.getString(SESSION_PHOTO,"");}\n'
);

store=replaceMethod(store,['    public long getCreatedAt(){','    public long getCreatedAt() {'],String.raw`    public long getCreatedAt(){
        long direct=prefs.getLong(SESSION_CREATED_AT,0L);
        if(direct>0L)return direct;
        String email=getCurrentEmail();
        if(email.isEmpty())return 0L;
        String record=prefs.getString(accountKey(email),"");
        String[] p=record.split("\\|",-1);
        if(p.length<4)return 0L;
        try{return Long.parseLong(p[3]);}catch(Exception ignored){return 0L;}
    }`,'getCreatedAt');

store=replaceMethod(store,['    public Result createAccount(String rawEmail,String password){','    public Result createAccount(String rawEmail, String password){'],String.raw`    public Result createAccount(String rawEmail,String password){
        String email=normalizeEmail(rawEmail);
        Result validation=validate(email,password);
        if(!validation.ok)return validation;
        String key=accountKey(email);
        if(prefs.contains(key))return Result.error("Un compte Audify existe déjà avec cette adresse e-mail.");
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
                .putString(SESSION_PROVIDER,"email")
                .putString(SESSION_NAME,"")
                .putString(SESSION_PHOTO,"")
                .putLong(SESSION_CREATED_AT,created)
                .commit();
            return saved?Result.ok("Compte créé. Bienvenue sur Audify."):Result.error("Impossible d'enregistrer le compte sur cet appareil.");
        }catch(Exception e){
            return Result.error("Impossible de créer le compte. Réessaie.");
        }
    }`,'createAccount');

store=replaceMethod(store,['    public Result signIn(String rawEmail,String password){','    public Result signIn(String rawEmail, String password){'],String.raw`    public Result signIn(String rawEmail,String password){
        String email=normalizeEmail(rawEmail);
        if(email.isEmpty()||password==null||password.isEmpty())return Result.error("Entre ton adresse e-mail et ton mot de passe.");
        String record=prefs.getString(accountKey(email),"");
        if(record.isEmpty())return Result.error("Aucun compte Audify trouvé avec cette adresse e-mail.");
        try{
            String[] p=record.split("\\|",-1);
            if(p.length<4)return Result.error("Ce compte local est illisible.");
            byte[] salt=Base64.decode(p[0],Base64.NO_WRAP);
            byte[] expected=Base64.decode(p[1],Base64.NO_WRAP);
            byte[] actual=derive(password,salt);
            if(!MessageDigest.isEqual(expected,actual))return Result.error("Mot de passe incorrect.");
            long created=0L;try{created=Long.parseLong(p[3]);}catch(Exception ignored){}
            prefs.edit()
                .putString(SESSION_EMAIL,email)
                .putString(SESSION_UID,p[2])
                .putString(SESSION_PROVIDER,"email")
                .putString(SESSION_NAME,"")
                .putString(SESSION_PHOTO,"")
                .putLong(SESSION_CREATED_AT,created)
                .commit();
            return Result.ok("Connexion réussie.");
        }catch(Exception e){
            return Result.error("Impossible d'ouvrir cette session.");
        }
    }`,'signIn');

const signOutMarker='    public void signOut(){';
if(!store.includes('public Result signInWithGoogle(')){
  const googleMethod=String.raw`    public Result signInWithGoogle(String rawEmail,String displayName,String googleId,String photoUrl){
        String email=normalizeEmail(rawEmail);
        if(email.isEmpty()||!Patterns.EMAIL_ADDRESS.matcher(email).matches())return Result.error("Google n'a pas renvoyé d'adresse e-mail valide.");
        String uid=(googleId==null||googleId.trim().isEmpty())?("google-"+UUID.randomUUID()):("google-"+googleId.trim());
        long created=System.currentTimeMillis();
        String previousEmail=getCurrentEmail();
        if(email.equals(previousEmail)&&getCreatedAt()>0L)created=getCreatedAt();
        boolean saved=prefs.edit()
            .putString(SESSION_EMAIL,email)
            .putString(SESSION_UID,uid)
            .putString(SESSION_PROVIDER,"google")
            .putString(SESSION_NAME,displayName==null?"":displayName.trim())
            .putString(SESSION_PHOTO,photoUrl==null?"":photoUrl.trim())
            .putLong(SESSION_CREATED_AT,created)
            .commit();
        return saved?Result.ok("Compte Google connecté à Audify."):Result.error("Impossible de mémoriser la session Google.");
    }

`;
  if(!store.includes(signOutMarker))throw new Error('V68.12.3 signOut marker introuvable');
  store=store.replace(signOutMarker,googleMethod+signOutMarker);
}

store=replaceMethod(store,['    public void signOut(){','    public void signOut() {'],String.raw`    public void signOut(){
        prefs.edit()
            .remove(SESSION_EMAIL)
            .remove(SESSION_UID)
            .remove(SESSION_PROVIDER)
            .remove(SESSION_NAME)
            .remove(SESSION_PHOTO)
            .remove(SESSION_CREATED_AT)
            .commit();
    }`,'signOut');

await writeFile(storePath,store,'utf8');

// =============================================================================
// 2) Login Activity : Google Sign-In réel via Google Play Services.
// =============================================================================
let login=await readFile(loginPath,'utf8');

if(!login.includes('import com.google.android.gms.auth.api.signin.GoogleSignIn;')){
  login=login.replace('import androidx.appcompat.app.AppCompatActivity;','import androidx.appcompat.app.AppCompatActivity;\n\nimport com.google.android.gms.auth.api.signin.GoogleSignIn;\nimport com.google.android.gms.auth.api.signin.GoogleSignInAccount;\nimport com.google.android.gms.auth.api.signin.GoogleSignInClient;\nimport com.google.android.gms.auth.api.signin.GoogleSignInOptions;\nimport com.google.android.gms.common.api.ApiException;\nimport com.google.android.gms.tasks.Task;');
}

login=login.replace(
  '    private AudifyAccountStore accounts;\n',
  '    private AudifyAccountStore accounts;\n    private GoogleSignInClient googleClient;\n    private TextView authStatus;\n    private static final int RC_GOOGLE_SIGN_IN=68123;\n'
);

login=login.replace(
  '        accounts=new AudifyAccountStore(this);\n        styleWindow();',
  '        accounts=new AudifyAccountStore(this);\n        GoogleSignInOptions googleOptions=new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN).requestEmail().build();\n        googleClient=GoogleSignIn.getClient(this,googleOptions);\n        styleWindow();'
);

if(!login.includes('private void beginGoogleSignInV68123()')){
  const marker='    private void styleWindow(){';
  if(!login.includes(marker))throw new Error('V68.12.3 styleWindow marker introuvable');
  const googleMethods=String.raw`    private void beginGoogleSignInV68123(){
        if(googleClient==null){
            showGoogleErrorV68123("Google Play Services n'est pas disponible.");
            return;
        }
        try{
            startActivityForResult(googleClient.getSignInIntent(),RC_GOOGLE_SIGN_IN);
        }catch(Exception e){
            showGoogleErrorV68123("Impossible d'ouvrir Google sur cet appareil.");
        }
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode!=RC_GOOGLE_SIGN_IN)return;
        try{
            Task<GoogleSignInAccount> task=GoogleSignIn.getSignedInAccountFromIntent(data);
            GoogleSignInAccount account=task.getResult(ApiException.class);
            if(account==null||account.getEmail()==null||account.getEmail().trim().isEmpty()){
                showGoogleErrorV68123("Google n'a pas renvoyé ton adresse e-mail.");
                return;
            }
            String photo=account.getPhotoUrl()==null?"":account.getPhotoUrl().toString();
            AudifyAccountStore.Result result=accounts.signInWithGoogle(account.getEmail(),account.getDisplayName(),account.getId(),photo);
            if(authStatus!=null)showStatus(authStatus,result);
            if(result.ok){
                if(authStatus!=null)authStatus.postDelayed(()->renderProfile(),350L);
                else renderProfile();
            }
        }catch(ApiException e){
            String message=e.getStatusCode()==10
                ?"Google n'est pas encore configuré pour cette signature APK (OAuth Android / SHA-1)."
                :"Connexion Google annulée ou impossible (code "+e.getStatusCode()+").";
            showGoogleErrorV68123(message);
        }catch(Exception e){
            showGoogleErrorV68123("Connexion Google impossible. Réessaie.");
        }
    }

    private void showGoogleErrorV68123(String message){
        if(authStatus!=null){
            authStatus.setVisibility(android.view.View.VISIBLE);
            authStatus.setText(message);
            authStatus.setTextColor(Color.rgb(255,108,118));
        }
    }

`;
  login=login.replace(marker,googleMethods+marker);
}

login=login.replace(
  '        TextView status=text("",13f,true); status.setGravity(Gravity.CENTER); status.setVisibility(android.view.View.GONE);',
  '        TextView status=text("",13f,true); status.setGravity(Gravity.CENTER); status.setVisibility(android.view.View.GONE); authStatus=status;'
);

const oldGoogle=String.raw`        Button google=inactiveButton("G   Se connecter avec Google");
        card.addView(google,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(56)));
        Button apple=inactiveButton("●   Se connecter avec Apple");
        LinearLayout.LayoutParams appleLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(56)); appleLp.topMargin=dp(10); card.addView(apple,appleLp);

        TextView note=text("Google et Apple seront activés dans les prochaines étapes.",12.5f,false);`;
const newGoogle=String.raw`        Button google=activeButton("G   Se connecter avec Google",false);
        google.setTextColor(Color.rgb(236,240,245));
        google.setBackground(round(Color.rgb(22,29,38),dp(1),Color.rgb(73,84,98),dp(22)));
        google.setOnClickListener(v->beginGoogleSignInV68123());
        card.addView(google,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(56)));
        Button apple=inactiveButton("●   Se connecter avec Apple");
        LinearLayout.LayoutParams appleLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(56)); appleLp.topMargin=dp(10); card.addView(apple,appleLp);

        TextView note=text("Google est maintenant actif. Apple arrivera dans une prochaine étape.",12.5f,false);`;
if(!login.includes(oldGoogle))throw new Error('V68.12.3 bloc Google/Apple introuvable');
login=login.replace(oldGoogle,newGoogle);

login=login.replace(
  '        TextView subtitle=text("Ta session Audify est active sur cet appareil.",15.5f,false); subtitle.setTextColor(MUTED);',
  '        TextView subtitle=text("google".equals(accounts.getCurrentProvider())?"Ton compte Google est connecté à Audify.":"Ta session Audify est active sur cet appareil.",15.5f,false); subtitle.setTextColor(MUTED);'
);

login=login.replace(
  '        TextView avatar=text(initial(accounts.getCurrentEmail()),30f,true);',
  '        String avatarSource=accounts.getCurrentDisplayName().isEmpty()?accounts.getCurrentEmail():accounts.getCurrentDisplayName();\n        TextView avatar=text(initial(avatarSource),30f,true);'
);

login=login.replace(
  '        TextView label=text("COMPTE AUDIFY",11.5f,true); label.setLetterSpacing(0.12f); label.setTextColor(ACCENT);',
  '        TextView label=text("google".equals(accounts.getCurrentProvider())?"COMPTE GOOGLE · AUDIFY":"COMPTE AUDIFY",11.5f,true); label.setLetterSpacing(0.12f); label.setTextColor(ACCENT);'
);

login=login.replace(
  '        TextView email=text(accounts.getCurrentEmail(),20f,true); email.setTextColor(Color.WHITE); card.addView(email,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(42)));',
  '        if(!accounts.getCurrentDisplayName().isEmpty()){TextView name=text(accounts.getCurrentDisplayName(),20f,true);name.setTextColor(Color.WHITE);card.addView(name,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(38)));}\n        TextView email=text(accounts.getCurrentEmail(),accounts.getCurrentDisplayName().isEmpty()?20f:15f,accounts.getCurrentDisplayName().isEmpty()); email.setTextColor(accounts.getCurrentDisplayName().isEmpty()?Color.WHITE:MUTED); card.addView(email,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(42)));'
);

const oldLogout='        logout.setOnClickListener(v->{accounts.signOut();renderAuth();});';
const newLogout=String.raw`        logout.setOnClickListener(v->{
            boolean google="google".equals(accounts.getCurrentProvider());
            accounts.signOut();
            if(google&&googleClient!=null){
                googleClient.signOut().addOnCompleteListener(t->renderAuth());
            }else renderAuth();
        });`;
if(!login.includes(oldLogout))throw new Error('V68.12.3 logout marker introuvable');
login=login.replace(oldLogout,newLogout);

await writeFile(loginPath,login,'utf8');

// =============================================================================
// 3) Home : indique le fournisseur Google quand il est actif.
// =============================================================================
let home=await readFile(homePath,'utf8');
home=home.replace(
  '        TextView eyebrow=text("COMPTE AUDIFY",11.5f,true);',
  '        TextView eyebrow=text(account.isSignedIn()&&"google".equals(account.getCurrentProvider())?"COMPTE GOOGLE · AUDIFY":"COMPTE AUDIFY",11.5f,true);'
);
await writeFile(homePath,home,'utf8');

console.log('Audify V68.12.3 : Google Account actif dans Account Core, Apple reste désactivé.');
