import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const java=path.join(root,'android','app','src','main','java','com','nova','audify');
const logoPath=path.join(java,'AudifyChromaLogoView.java');
let logo=await readFile(logoPath,'utf8');

// Porter-Duff alpha masking is rendered correctly by the hardware canvas. The
// software fallback made Android draw the full gradient bitmap as a square.
logo=logo.replace(/setLayerType\(View\.LAYER_TYPE_SOFTWARE,null\);/g,'setLayerType(View.LAYER_TYPE_HARDWARE,null);');
if(!logo.includes('setLayerType(View.LAYER_TYPE_HARDWARE,null);')){
  logo=logo.replace('    public AudifyChromaLogoView(Context context){\n        super(context);', '    public AudifyChromaLogoView(Context context){\n        super(context);\n        setLayerType(View.LAYER_TYPE_HARDWARE,null);');
}
await writeFile(logoPath,logo,'utf8');

let gradle=await readFile(path.join(root,'android','app','build.gradle'),'utf8');
gradle=gradle.replace(/versionCode \d+/,'versionCode 681244').replace(/versionName "[^"]+"/,'versionName "68.12.44"');
await writeFile(path.join(root,'android','app','build.gradle'),gradle,'utf8');
console.log('Audify V68.12.44 : masque alpha du logo splash restauré, sans carré de dégradé.');
