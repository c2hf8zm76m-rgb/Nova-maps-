import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const homePath=path.join(root,'android','app','src','main','java','com','nova','audify','NativeHomeActivity.java');
let home=await readFile(homePath,'utf8');

function replaceRequired(source,needle,replacement,label){
  if(!source.includes(needle)) throw new Error(`V68.10.3 introuvable: ${label}`);
  return source.replace(needle,replacement);
}

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
  throw new Error(`V68.10.3 méthode introuvable: ${label}`);
}

// Barre sticky moins large, centrée et mieux séparée du haut de l'écran.
home=replaceRequired(
  home,
  '        scrollLp.topMargin=dp(82);',
  '        scrollLp.topMargin=dp(94);',
  'marge contenu sous recherche'
);
home=replaceRequired(
  home,
  '        FrameLayout.LayoutParams stickyLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(70),Gravity.TOP);\n        stickyLp.setMargins(dp(10),dp(6),dp(10),0);\n        stickySearch.setElevation(dp(16));\n        root.addView(stickySearch,stickyLp);',
  '        int stickyWidth=Math.min(getResources().getDisplayMetrics().widthPixels-dp(42),dp(620));\n        FrameLayout.LayoutParams stickyLp=new FrameLayout.LayoutParams(stickyWidth,dp(68),Gravity.TOP|Gravity.CENTER_HORIZONTAL);\n        stickyLp.topMargin=dp(16);\n        stickySearch.setElevation(dp(16));\n        root.addView(stickySearch,stickyLp);',
  'position barre recherche'
);

home=replaceMethod(home,['    private LinearLayout buildStickySearchHeader(){','    private LinearLayout buildStickySearchHeader() {'],String.raw`    private LinearLayout buildStickySearchHeader(){
        LinearLayout row=new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(12),dp(5),dp(7),dp(5));
        row.setBackground(round(Color.rgb(25,30,38),dp(1),Color.rgb(79,88,101),dp(34)));
        row.setClickable(true);
        row.setFocusable(true);

        TextView hint=text("⌕  Rechercher un artiste ou un titre…",15.5f,false);
        hint.setTextColor(Color.rgb(151,159,173));
        hint.setMaxLines(1);
        hint.setEllipsize(TextUtils.TruncateAt.END);
        hint.setOnClickListener(v->openSearchAnimated(row));
        row.addView(hint,new LinearLayout.LayoutParams(0,dp(56),1f));

        Button search=greenButton("Rechercher");
        search.setTextSize(15f);
        search.setOnClickListener(v->openSearchAnimated(row));
        LinearLayout.LayoutParams searchLp=new LinearLayout.LayoutParams(dp(124),dp(52));
        searchLp.leftMargin=dp(6);
        row.addView(search,searchLp);

        row.setOnClickListener(v->openSearchAnimated(row));
        return row;
    }`,'buildStickySearchHeader');

// Mini lecteur du Home légèrement moins large et parfaitement centré.
home=replaceRequired(
  home,
  '        FrameLayout.LayoutParams miniLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(116),Gravity.BOTTOM);\n        miniLp.setMargins(dp(14),0,dp(14),dp(24));',
  '        int miniWidth=Math.min(getResources().getDisplayMetrics().widthPixels-dp(50),dp(520));\n        FrameLayout.LayoutParams miniLp=new FrameLayout.LayoutParams(miniWidth,dp(116),Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);\n        miniLp.bottomMargin=dp(24);',
  'largeur mini lecteur'
);

const helperMarker='    private LinearLayout.LayoutParams weighted() {';
if(!home.includes(helperMarker)) throw new Error('V68.10.3 helper Home introuvable');
const helper=String.raw`    private boolean searchOpening=false;

    private void openSearchAnimated(View searchBar){
        if(searchOpening) return;
        searchOpening=true;
        if(searchBar==null){
            openSearch();
            searchOpening=false;
            return;
        }
        searchBar.animate().cancel();
        searchBar.animate()
            .scaleX(1.035f).scaleY(1.045f)
            .translationY(dp(1))
            .setDuration(115L)
            .setInterpolator(new android.view.animation.DecelerateInterpolator())
            .withEndAction(()->{
                searchBar.animate()
                    .scaleX(1f).scaleY(1f).translationY(0f)
                    .setDuration(150L)
                    .setInterpolator(new android.view.animation.OvershootInterpolator(0.35f))
                    .start();
                openSearch();
                searchBar.postDelayed(()->searchOpening=false,320L);
            }).start();
    }

`;
home=home.replace(helperMarker,helper+helperMarker);

await writeFile(homePath,home,'utf8');
console.log('Audify Android V68.10.3 : recherche plus compacte/décollée avec animation d’ouverture + mini lecteur plus étroit.');
