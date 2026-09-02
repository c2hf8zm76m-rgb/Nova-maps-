import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
const mainPath=path.join(pkgDir,'MainActivity.java');
const karaokePath=path.join(pkgDir,'NativeKaraokeActivity.java');

function findMethod(source,signatures,label){
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
    if(end>0) return {start,brace,end};
  }
  throw new Error(`V68.12.36 méthode introuvable: ${label}`);
}

function replaceToggleStatementInMethod(source,signatures,statementRegex,replacement,label){
  const f=findMethod(source,signatures,label);
  const method=source.slice(f.start,f.end);
  if(!statementRegex.test(method)) throw new Error(`V68.12.36 état Play/Pause introuvable: ${label}`);
  statementRegex.lastIndex=0;
  const next=method.replace(statementRegex,replacement);
  return source.slice(0,f.start)+next+source.slice(f.end);
}

// =============================================================================
// 1) HOME MINI PLAYER — même animation de chargement que le grand lecteur.
// =============================================================================
let home=await readFile(homePath,'utf8');
if(!home.includes('miniLoadingFrameV681236')){
  const marker='    private LinearLayout buildMiniPlayer';
  const p=home.indexOf(marker);
  if(p<0) throw new Error('V68.12.36 buildMiniPlayer Home introuvable');
  home=home.slice(0,p)+'    private int miniLoadingFrameV681236=0;\n\n'+home.slice(p);
}

home=replaceToggleStatementInMethod(
  home,
  ['    private void refreshMiniPlayer(){','    private void refreshMiniPlayer() {'],
  /miniToggle\.setText\([^;]+;/,
  String.raw`boolean loadingV681236=state.optBoolean("loading",false);
            boolean playingV681236=state.optBoolean("playing",false);
            if(loadingV681236){
                String[] framesV681236={"◐","◓","◑","◒"};
                miniToggle.setEnabled(false);
                miniToggle.setAlpha(0.94f);
                miniToggle.setText(framesV681236[miniLoadingFrameV681236++ % framesV681236.length]);
                miniToggle.setContentDescription("Chargement du morceau en cours");
            }else{
                miniLoadingFrameV681236=0;
                miniToggle.setEnabled(true);
                miniToggle.setAlpha(1f);
                miniToggle.setText(playingV681236?"Ⅱ":"▶");
                miniToggle.setContentDescription(playingV681236?"Mettre en pause":"Lire");
            }`,
  'refreshMiniPlayer Home'
);
await writeFile(homePath,home,'utf8');

// =============================================================================
// 2) SEARCH MINI PLAYER — même spinner, piloté par le vrai snapshot Media3.
// =============================================================================
let main=await readFile(mainPath,'utf8');
if(!main.includes('audifySearchMiniLoadingFrameV681236')){
  const classMarker='public class MainActivity extends BridgeActivity {';
  if(!main.includes(classMarker)) throw new Error('V68.12.36 classe MainActivity introuvable');
  main=main.replace(classMarker,classMarker+'\n    private int audifySearchMiniLoadingFrameV681236=0;');
}

main=replaceToggleStatementInMethod(
  main,
  ['    private void audifyRefreshSearchMiniV68104(){','    private void audifyRefreshSearchMiniV68104() {'],
  /audifySearchMiniToggleV68104\.setText\([^;]+;/,
  String.raw`boolean loadingV681236=state.optBoolean("loading",false);
            boolean playingV681236=state.optBoolean("playing",false);
            if(loadingV681236){
                String[] framesV681236={"◐","◓","◑","◒"};
                audifySearchMiniToggleV68104.setEnabled(false);
                audifySearchMiniToggleV68104.setAlpha(0.94f);
                audifySearchMiniToggleV68104.setText(framesV681236[audifySearchMiniLoadingFrameV681236++ % framesV681236.length]);
                audifySearchMiniToggleV68104.setContentDescription("Chargement du morceau en cours");
            }else{
                audifySearchMiniLoadingFrameV681236=0;
                audifySearchMiniToggleV68104.setEnabled(true);
                audifySearchMiniToggleV68104.setAlpha(1f);
                audifySearchMiniToggleV68104.setText(playingV681236?"Ⅱ":"▶");
                audifySearchMiniToggleV68104.setContentDescription(playingV681236?"Mettre en pause":"Lire");
            }`,
  'audifyRefreshSearchMiniV68104 Recherche'
);
await writeFile(mainPath,main,'utf8');

// =============================================================================
// 3) LYRICS / KARAOKE — bouton Play du mini lecteur Lyrics.
//    On vérifie aussi que le snapshot correspond au titre affiché dans Lyrics.
// =============================================================================
let karaoke=await readFile(karaokePath,'utf8');
if(!karaoke.includes('lyricsLoadingFrameV681236')){
  const classMarker='public class NativeKaraokeActivity extends AppCompatActivity {';
  if(!karaoke.includes(classMarker)) throw new Error('V68.12.36 classe NativeKaraokeActivity introuvable');
  karaoke=karaoke.replace(classMarker,classMarker+'\n    private int lyricsLoadingFrameV681236=0;');
}

karaoke=replaceToggleStatementInMethod(
  karaoke,
  ['    private void refresh(){','    private void refresh() {'],
  /toggle\.setText\(playing\?[^;]+;/,
  String.raw`String stateVideoIdV681236=state.optString("videoId","");
            boolean sameTrackV681236=videoId==null||videoId.isEmpty()||videoId.equals(stateVideoIdV681236);
            boolean loadingV681236=sameTrackV681236&&state.optBoolean("loading",false);
            if(loadingV681236){
                String[] framesV681236={"◐","◓","◑","◒"};
                toggle.setEnabled(false);
                toggle.setAlpha(0.94f);
                toggle.setText(framesV681236[lyricsLoadingFrameV681236++ % framesV681236.length]);
                toggle.setContentDescription("Chargement du morceau en cours");
            }else{
                lyricsLoadingFrameV681236=0;
                toggle.setEnabled(true);
                toggle.setAlpha(1f);
                toggle.setText(playing?"⏸":"▶");
                toggle.setContentDescription(playing?"Mettre en pause":"Lire");
            }`,
  'refresh Lyrics/Karaoke'
);
await writeFile(karaokePath,karaoke,'utf8');

console.log('Audify Android V68.12.36 : indicateur de chargement unifié sur Lyrics, mini Home et mini Recherche.');
