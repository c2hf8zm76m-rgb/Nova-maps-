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
  throw new Error(`V68.12.23 méthode introuvable: ${label}`);
}

let home=await readFile(homePath,'utf8');

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
        final boolean signedIn=account.isSignedIn();
        Button avatar=new Button(this);
        avatar.setText("");
        avatar.setAllCaps(false);
        avatar.setGravity(Gravity.CENTER);
        avatar.setPadding(0,0,0,0);
        avatar.setMinWidth(0);
        avatar.setMinHeight(0);
        avatar.setContentDescription(signedIn?"Ouvrir mon compte Audify":"Se connecter à Audify");

        if(signedIn){
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
        }else{
            avatar.setBackground(round(Color.argb(214,22,28,36),dp(1),Color.rgb(88,101,116),dp(29)));
            android.graphics.drawable.Drawable profileIcon=getResources().getDrawable(R.drawable.audify_ic_profile,getTheme());
            if(profileIcon!=null){
                profileIcon=profileIcon.mutate();
                profileIcon.setTint(Color.WHITE);
                avatar.setForeground(profileIcon);
                avatar.setForegroundGravity(Gravity.CENTER);
            }
            avatar.setElevation(dp(5));
        }

        avatar.setOnClickListener(v->{
            avatar.animate().scaleX(0.92f).scaleY(0.92f).setDuration(70L)
                .withEndAction(()->avatar.animate().scaleX(1f).scaleY(1f).setDuration(120L).start()).start();
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

// A blanc géométrique + petite note musicale : avatar de marque Audify.
const musicalA=`<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="28dp"
    android:height="28dp"
    android:viewportWidth="28"
    android:viewportHeight="28">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M5.2,22.4 L11.4,5.2 C11.8,4.1 12.5,3.6 13.6,3.6 C14.7,3.6 15.5,4.1 15.9,5.2 L22.1,22.4 L18.2,22.4 L16.7,18.0 L10.3,18.0 L8.8,22.4 Z M11.5,14.6 L15.5,14.6 L13.5,8.7 Z" />
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M18.1,5.1 L23.6,3.7 L23.6,13.2 C23.0,12.8 22.3,12.6 21.5,12.6 C19.7,12.6 18.3,13.7 18.3,15.1 C18.3,16.5 19.7,17.6 21.5,17.6 C23.3,17.6 24.7,16.5 24.7,15.1 L24.7,6.1 L18.1,7.8 Z" />
</vector>
`;
await writeFile(path.join(drawableDir,'audify_ic_a_musical.xml'),musicalA,'utf8');

console.log('Audify Android V68.12.23 : avatar connecté vert Audify avec A musical blanc, avatar personne conservé hors connexion.');
