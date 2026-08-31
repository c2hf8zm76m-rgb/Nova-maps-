import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const playerPath=path.join(root,'android','app','src','main','java','com','nova','audify','NativePlayerActivity.java');
let src=await readFile(playerPath,'utf8');

const oldBlock=`                    float velocityX=dx/(float)elapsed;\n                    int delta=dx>0?1:-1;\n                    boolean available=prepareArtworkPreview(delta);\n                    float width=Math.max(dp(240),view.getWidth());\n                    boolean horizontal=Math.abs(dx)>Math.abs(dy)*1.15f;\n                    boolean distanceCommit=Math.abs(dx)>=width*0.24f;\n                    boolean flingCommit=Math.abs(dx)>=dp(32)&&Math.abs(velocityX)>=0.85f;\n                    boolean commit=event.getActionMasked()==MotionEvent.ACTION_UP && available && horizontal && (distanceCommit||flingCommit);`;
const newBlock=`                    float velocityX=dx/(float)elapsed;\n                    int releaseDelta=dx>0?1:-1;\n                    boolean releaseAvailable=prepareArtworkPreview(releaseDelta);\n                    float releaseWidth=Math.max(dp(240),view.getWidth());\n                    boolean horizontal=Math.abs(dx)>Math.abs(dy)*1.15f;\n                    boolean distanceCommit=Math.abs(dx)>=releaseWidth*0.24f;\n                    boolean flingCommit=Math.abs(dx)>=dp(32)&&Math.abs(velocityX)>=0.85f;\n                    boolean commit=event.getActionMasked()==MotionEvent.ACTION_UP && releaseAvailable && horizontal && (distanceCommit||flingCommit);`;
if(!src.includes(oldBlock)) throw new Error('V68.10.2 fix: bloc release swipe introuvable');
src=src.replace(oldBlock,newBlock);
src=src.replace('                    float sign=delta>0?1f:-1f;\n                    int screenWidth=getResources().getDisplayMetrics().widthPixels;',
                '                    float sign=releaseDelta>0?1f:-1f;\n                    int screenWidth=getResources().getDisplayMetrics().widthPixels;');
src=src.replace('                            startPlayerAction(delta>0?AudifyPlaybackService.ACTION_NEXT:AudifyPlaybackService.ACTION_PREVIOUS);',
                '                            startPlayerAction(releaseDelta>0?AudifyPlaybackService.ACTION_NEXT:AudifyPlaybackService.ACTION_PREVIOUS);');

await writeFile(playerPath,src,'utf8');
console.log('Audify V68.10.2 : portée des variables Swipe 2.0 corrigée.');
