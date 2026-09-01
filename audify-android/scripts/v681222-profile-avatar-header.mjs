import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
const drawableDir=path.join(android,'app','src','main','res','drawable');
await mkdir(drawableDir,{recursive:true});

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
  throw new Error(`V68.12.22 méthode introuvable: ${label}`);
}

let home=await readFile(homePath,'utf8');

// Le gros panneau Profil disparaît totalement : l'accès au compte est désormais
// l'avatar rond compact placé dans le header de recherche.
home=replaceMethod(
  home,
  ['    private void addAccountEntryV68121(){','    private void addAccountEntryV68121() {'],
  String.raw`    private void addAccountEntryV68121(){
        // V68.12.22 : plus de carte Profil dédiée sur le Home.
        // L'accès au compte vit maintenant dans l'avatar du header.
    }`,
  'addAccountEntryV68121'
);

home=replaceMethod(
  home,
  ['    private LinearLayout buildStickySearchHeader(){','    private LinearLayout buildStickySearchHeader() {'],
  String.raw`    private LinearLayout buildStickySearchHeader(){
        LinearLayout outer=new LinearLayout(this);
        outer.setGravity(Gravity.CENTER_VERTICAL);
        outer.setPadding(0,0,0,0);

        LinearLayout searchShell=new LinearLayout(this);
        searchShell.setGravity(Gravity.CENTER_VERTICAL);
        searchShell.setPadding(dp(12),dp(5),dp(7),dp(5));
        searchShell.setBackground(round(Color.rgb(25,30,38),dp(1),Color.rgb(79,88,101),dp(34)));

        TextView hint=text("⌕  Rechercher un artiste ou un titre…",15.5f,false);
        hint.setTextColor(Color.rgb(151,159,173));
        hint.setMaxLines(1);
        hint.setEllipsize(TextUtils.TruncateAt.END);
        hint.setOnClickListener(v->openSearch());
        searchShell.addView(hint,new LinearLayout.LayoutParams(0,dp(58),1f));

        Button search=greenButton("Rechercher");
        search.setTextSize(14.5f);
        search.setOnClickListener(v->openSearch());
        LinearLayout.LayoutParams searchLp=new LinearLayout.LayoutParams(dp(118),dp(52));
        searchLp.leftMargin=dp(5);
        searchShell.addView(search,searchLp);

        outer.addView(searchShell,new LinearLayout.LayoutParams(0,dp(64),1f));

        AudifyAccountStore account=new AudifyAccountStore(this);
        Button avatar=new Button(this);
        avatar.setText("");
        avatar.setAllCaps(false);
        avatar.setGravity(Gravity.CENTER);
        avatar.setPadding(0,0,0,0);
        avatar.setMinWidth(0);
        avatar.setMinHeight(0);
        avatar.setContentDescription(account.isSignedIn()?"Ouvrir mon compte Audify":"Se connecter à Audify");
        avatar.setBackground(round(
            Color.argb(214,22,28,36),
            dp(1),
            account.isSignedIn()?Color.rgb(132,180,94):Color.rgb(88,101,116),
            dp(29)
        ));
        android.graphics.drawable.Drawable profileIcon=getResources().getDrawable(R.drawable.audify_ic_profile,getTheme());
        if(profileIcon!=null){
            profileIcon=profileIcon.mutate();
            profileIcon.setTint(Color.WHITE);
            avatar.setForeground(profileIcon);
            avatar.setForegroundGravity(Gravity.CENTER);
        }
        avatar.setElevation(dp(5));
        avatar.setOnClickListener(v->{
            animatePress(avatar);
            startActivity(new Intent(this,AudifyLoginActivity.class));
        });

        LinearLayout.LayoutParams avatarLp=new LinearLayout.LayoutParams(dp(56),dp(56));
        avatarLp.leftMargin=dp(10);
        outer.addView(avatar,avatarLp);
        return outer;
    }`,
  'buildStickySearchHeader'
);

await writeFile(homePath,home,'utf8');

const profileVector=`<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M12,12c2.49,0 4.5,-2.01 4.5,-4.5S14.49,3 12,3 7.5,5.01 7.5,7.5 9.51,12 12,12z" />
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M12,14c-4.14,0 -7.5,2.24 -7.5,5v1.25c0,0.41 0.34,0.75 0.75,0.75h13.5c0.41,0 0.75,-0.34 0.75,-0.75V19c0,-2.76 -3.36,-5 -7.5,-5z" />
</vector>
`;
await writeFile(path.join(drawableDir,'audify_ic_profile.xml'),profileVector,'utf8');

console.log('Audify Android V68.12.22 : carte Profil supprimée, avatar rond du compte intégré à droite du header de recherche.');
