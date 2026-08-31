import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
const wavesPath=path.join(pkgDir,'AudioWavesView.java');

let src=await readFile(playerPath,'utf8');

// Retire la wave plein écran derrière le ScrollView : sur certains appareils elle est masquée.
src=src.replace(
`        // Spectre/waves Audify derrière la pochette et le contenu.
        audioWavesView = new AudioWavesView(this);
        root.addView(audioWavesView,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        // Zone centrale scrollable`,
`        // Zone centrale scrollable`
);

// Transforme la zone artwork en stage pleine largeur : waves visibles + artwork au-dessus.
const artworkNeedle=`        FrameLayout artwork=new FrameLayout(this);
        artwork.setClipChildren(false);
        artwork.setClipToPadding(false);

        coverImage=new ImageView(this);`;
if(!src.includes(artworkNeedle)) throw new Error('Artwork V68.7 introuvable pour correction waves');
const artworkReplacement=`        FrameLayout artworkStage=new FrameLayout(this);
        artworkStage.setClipChildren(false);
        artworkStage.setClipToPadding(false);

        audioWavesView=new AudioWavesView(this);
        FrameLayout.LayoutParams wavesLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT,Gravity.CENTER);
        artworkStage.addView(audioWavesView,wavesLp);

        FrameLayout artwork=new FrameLayout(this);
        artwork.setClipChildren(false);
        artwork.setClipToPadding(false);
        FrameLayout.LayoutParams artworkInnerLp=new FrameLayout.LayoutParams(artworkSize,artworkSize,Gravity.CENTER);
        artworkStage.addView(artwork,artworkInnerLp);

        coverImage=new ImageView(this);`;
src=src.replace(artworkNeedle,artworkReplacement);

const addNeedle=`        LinearLayout.LayoutParams artLp=new LinearLayout.LayoutParams(artworkSize,artworkSize);
        artLp.topMargin=dp(8);
        content.addView(artwork,artLp);`;
if(!src.includes(addNeedle)) throw new Error('Ajout artwork V68.7 introuvable');
const addReplacement=`        LinearLayout.LayoutParams artLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,artworkSize+dp(24));
        artLp.topMargin=dp(2);
        content.addView(artworkStage,artLp);`;
src=src.replace(addNeedle,addReplacement);

// Le tactile swipe reste sur la pochette elle-même, pas sur toute la zone waves.
await writeFile(playerPath,src,'utf8');

let waves=await readFile(wavesPath,'utf8');
// Visibilité renforcée mais toujours subtile.
waves=waves.replace('wave1.setColor(Color.argb(78,r,g,b));','wave1.setColor(Color.argb(132,r,g,b));');
waves=waves.replace('wave2.setColor(Color.argb(55,clamp(r+16),clamp(g+22),clamp(b+30)));','wave2.setColor(Color.argb(96,clamp(r+16),clamp(g+22),clamp(b+30)));');
waves=waves.replace('wave3.setColor(Color.argb(38,clamp(r-18),clamp(g-8),clamp(b+14)));','wave3.setColor(Color.argb(72,clamp(r-18),clamp(g-8),clamp(b+14)));');
waves=waves.replace('ring1.setColor(Color.argb(31,r,g,b));','ring1.setColor(Color.argb(74,r,g,b));');
waves=waves.replace('ring2.setColor(Color.argb(18,clamp(r+28),clamp(g+32),clamp(b+36)));','ring2.setColor(Color.argb(48,clamp(r+28),clamp(g+32),clamp(b+36)));');

// Centre les waves sur le stage artwork dédié et non plus sur la hauteur de toute l'Activity.
waves=waves.replace('float centerY=h*0.355f;','float centerY=h*0.50f;');
waves=waves.replace('float cy=h*0.335f;','float cy=h*0.50f;');
await writeFile(wavesPath,waves,'utf8');

console.log('Audify V68.8.1 : waves déplacées dans une stage dédiée autour de la pochette, visibilité renforcée.');
