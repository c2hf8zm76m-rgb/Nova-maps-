import { cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const overlay=path.join(root,'share-overlay');

for(const name of [
  'AudifyAlbumIdentifier.java',
  'AudifyInstantAlbums.java',
  'AudifyInstantAlbumMetadata.java',
  'AudifyInstantAlbumResolver.java',
  'AudifyInstantAlbumArtwork.java',
  'AudifyInstantAlbumLibrary.java'
]){
  await cp(path.join(overlay,name),path.join(pkgDir,name));
}

const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
let player=await readFile(playerPath,'utf8');
if(!player.includes('AudifyAlbumIdentifier.attach(this);')){
  const resumeMatch=/protected\s+void\s+onResume\s*\(\s*\)\s*\{/.exec(player);
  if(resumeMatch){
    const start=resumeMatch.index+resumeMatch[0].length;
    const superCall=player.indexOf('super.onResume();',start);
    if(superCall>=0){
      const insert=superCall+'super.onResume();'.length;
      player=player.slice(0,insert)+'\n        try { AudifyAlbumIdentifier.attach(this); } catch (Throwable ignored) {}'+player.slice(insert);
    }else{
      player=player.slice(0,start)+'\n        try { AudifyAlbumIdentifier.attach(this); } catch (Throwable ignored) {}'+player.slice(start);
    }
  }else{
    const method=`\n    @Override\n    protected void onResume() {\n        super.onResume();\n        try { AudifyAlbumIdentifier.attach(this); } catch (Throwable ignored) {}\n    }\n`;
    const last=player.lastIndexOf('\n}');
    if(last<0) throw new Error('NativePlayerActivity closing brace not found');
    player=player.slice(0,last)+method+player.slice(last);
  }
  await writeFile(playerPath,player,'utf8');
}

console.log('Audify V68.12.56: native square album cover + instant album sheet integrated into NativePlayerActivity.');
