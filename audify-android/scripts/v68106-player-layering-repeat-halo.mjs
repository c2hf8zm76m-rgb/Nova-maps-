import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');

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
  throw new Error(`V68.10.6 méthode introuvable: ${label}`);
}

function replaceRequired(source,needle,replacement,label){
  if(!source.includes(needle)) throw new Error(`V68.10.6 bloc introuvable: ${label}`);
  return source.replace(needle,replacement);
}

let player=await readFile(playerPath,'utf8');

// -----------------------------------------------------------------------------
// 1) La zone scrollable s'arrête AU-DESSUS du lecteur fixe.
//    Ainsi la file d'attente ne peut plus passer sous le panneau de contrôle.
// -----------------------------------------------------------------------------
player=replaceRequired(
  player,
  '        content.setPadding(dp(16), dp(12), dp(16), dp(190));',
  '        content.setPadding(dp(16), dp(12), dp(16), dp(34));',
  'padding contenu lecteur'
);

player=replaceRequired(
  player,
  '        root.addView(scroller,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));',
  `        FrameLayout.LayoutParams scrollerLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT);\n        // V68.10.6 : réserve physique pour le player Glass 2.0 fixe (158dp + marge basse + respiration).\n        scrollerLp.bottomMargin=dp(228);\n        root.addView(scroller,scrollerLp);`,
  'réservation verticale du lecteur fixe'
);

// Un peu plus de respiration après la file d'attente.
player=replaceRequired(
  player,
  '        queueLp.topMargin=dp(10);\n        content.addView(queueSection,queueLp);',
  '        queueLp.topMargin=dp(10);\n        queueLp.bottomMargin=dp(18);\n        content.addView(queueSection,queueLp);',
  'marge file d’attente'
);

// -----------------------------------------------------------------------------
// 2) Repeat : halo PERSISTANT. applyRepeatState() est appelé régulièrement par
//    le refresh du player, donc il ne doit jamais relancer une animation.
// -----------------------------------------------------------------------------
player=replaceMethod(
  player,
  ['    private void applyRepeatState() {','    private void applyRepeatState(){'],
  String.raw`    private void applyRepeatState() {
        if(repeatButton==null) return;
        int green=Color.rgb(168,255,63);
        repeatButton.setText("↻");
        repeatButton.setContentDescription(repeatOne ? "Lecture en boucle activée" : "Lecture en boucle désactivée");

        GradientDrawable bg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            repeatOne
                ? new int[]{Color.rgb(184,255,82),Color.rgb(110,220,38)}
                : new int[]{Color.argb(144,48,57,72),Color.argb(116,22,28,39)}
        );
        bg.setCornerRadius(dp(18));
        bg.setStroke(dp(1),repeatOne?Color.argb(245,226,255,194):Color.argb(88,235,242,252));
        repeatButton.setBackground(bg);
        repeatButton.setTextColor(repeatOne?Color.rgb(9,21,7):Color.WHITE);
        repeatButton.setElevation(repeatOne?dp(14):dp(5));

        if(repeatGlow!=null){
            // IMPORTANT : pas d'animate() ici. Cette méthode est rappelée par le ticker.
            repeatGlow.animate().cancel();
            repeatGlow.setAlpha(repeatOne?0.58f:0f);
            repeatGlow.setScaleX(repeatOne?1.42f:1.08f);
            repeatGlow.setScaleY(repeatOne?1.42f:1.08f);
            repeatGlow.setVisibility(repeatOne?View.VISIBLE:View.INVISIBLE);
        }
    }`,
  'applyRepeatState steady halo'
);

// L'animation au clic reste courte et ponctuelle, uniquement sur l'icône.
player=replaceMethod(
  player,
  ['    private void animateRepeatFeedback(){','    private void animateRepeatFeedback() {'],
  String.raw`    private void animateRepeatFeedback(){
        if(repeatButton==null) return;
        final int green=Color.rgb(168,255,63);
        repeatButton.animate().cancel();
        repeatButton.animate().scaleX(0.92f).scaleY(0.92f).setDuration(65L).withEndAction(()->{
            repeatButton.setText("⟳");
            repeatButton.animate().scaleX(1.07f).scaleY(1.07f).setDuration(90L).withEndAction(()->{
                repeatButton.setText("↻");
                repeatButton.animate().scaleX(1f).scaleY(1f).setDuration(105L).start();
            }).start();
        }).start();
        showFloatingConfirmation(repeatOne?"↻  Lecture en boucle activée":"Boucle désactivée",repeatOne?green:Color.rgb(225,232,242));
    }`,
  'repeat feedback ponctuel'
);

await writeFile(playerPath,player,'utf8');
console.log('Audify V68.10.6 : file d’attente séparée du player et halo Repeat stable.');
