import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');

// -----------------------------------------------------------------------------
// 1) Rendre les waves réellement visibles sur tous les fonds dynamiques.
// -----------------------------------------------------------------------------
const wavesPath=path.join(pkgDir,'AudioWavesView.java');
let waves=await readFile(wavesPath,'utf8');

waves=waves.replace('configurePaint(wave1,1.35f,72);','configurePaint(wave1,1.75f,150);');
waves=waves.replace('configurePaint(wave2,1.05f,50);','configurePaint(wave2,1.35f,112);');
waves=waves.replace('configurePaint(wave3,0.9f,34);','configurePaint(wave3,1.15f,82);');
waves=waves.replace('configurePaint(ring1,2.0f,28);','configurePaint(ring1,2.15f,72);');
waves=waves.replace('configurePaint(ring2,1.0f,18);','configurePaint(ring2,1.25f,48);');

const updateOld=`        wave1.setColor(Color.argb(78,r,g,b));
        wave2.setColor(Color.argb(55,clamp(r+16),clamp(g+22),clamp(b+30)));
        wave3.setColor(Color.argb(38,clamp(r-18),clamp(g-8),clamp(b+14)));
        ring1.setColor(Color.argb(31,r,g,b));
        ring2.setColor(Color.argb(18,clamp(r+28),clamp(g+32),clamp(b+36)));`;
const updateNew=`        // Mélange avec une base claire pour rester visible même si la pochette est très sombre.
        int r1=clamp((int)(r*0.62f+255*0.38f));
        int g1=clamp((int)(g*0.62f+255*0.38f));
        int b1=clamp((int)(b*0.62f+255*0.38f));
        wave1.setColor(Color.argb(165,r1,g1,b1));
        wave2.setColor(Color.argb(118,clamp(r1+12),clamp(g1+16),clamp(b1+22)));
        wave3.setColor(Color.argb(86,clamp(r1-22),clamp(g1-12),clamp(b1+8)));
        ring1.setColor(Color.argb(74,r1,g1,b1));
        ring2.setColor(Color.argb(48,clamp(r1+20),clamp(g1+22),clamp(b1+26)));`;
if(!waves.includes(updateOld)) throw new Error('Bloc couleur waves V68.8 introuvable');
waves=waves.replace(updateOld,updateNew);

// Un peu plus de présence autour de la pochette.
waves=waves.replace('float centerY=h*0.355f;','float centerY=h*0.365f;');
waves=waves.replace('dp(27),phase,0.92f,wave3','dp(30),phase,0.92f,wave3');
waves=waves.replace('dp(38),phase+0.72f,1.08f,wave1','dp(43),phase+0.72f,1.08f,wave1');
waves=waves.replace('dp(25),phase+1.55f,1.31f,wave2','dp(29),phase+1.55f,1.31f,wave2');

await writeFile(wavesPath,waves,'utf8');

// -----------------------------------------------------------------------------
// 2) Mettre les waves AU-DESSUS du ScrollView/pochette pour qu'elles traversent
//    réellement la composition, mais AVANT le bloc de contrôle fixe du bas.
// -----------------------------------------------------------------------------
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
let player=await readFile(playerPath,'utf8');

const oldLayer=`        // Spectre/waves Audify derrière la pochette et le contenu.
        audioWavesView = new AudioWavesView(this);
        root.addView(audioWavesView,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        // Zone centrale scrollable`;
const newLayer=`        // Spectre/waves Audify. Créé ici puis ajouté après le ScrollView afin
        // d'être réellement visible au-dessus de la pochette, sans capter les touchs.
        audioWavesView = new AudioWavesView(this);
        audioWavesView.setClickable(false);
        audioWavesView.setFocusable(false);
        audioWavesView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);

        // Zone centrale scrollable`;
if(!player.includes(oldLayer)) throw new Error('Layer waves V68.8 introuvable');
player=player.replace(oldLayer,newLayer);

const scrollNeedle='        root.addView(scroller,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));';
if(!player.includes(scrollNeedle)) throw new Error('ScrollView root V68.7 introuvable');
player=player.replace(scrollNeedle,scrollNeedle+`\n\n        // Couche de waves au-dessus de la pochette, sous les contrôles ajoutés plus bas.\n        FrameLayout.LayoutParams wavesLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT);\n        root.addView(audioWavesView,wavesLp);`);

await writeFile(playerPath,player,'utf8');
console.log('Audify Android V68.9 : waves renforcées et placées au-dessus de la pochette.');
