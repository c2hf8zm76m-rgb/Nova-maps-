import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const targets=[
  path.join(pkgDir,'MainActivity.java'),
  path.join(pkgDir,'AudifyDiscoveryAgent.java')
];

const bad=String.raw`String marker="\\\"videoRenderer\\\":";`;
const good=String.raw`String marker="\"videoRenderer\":";`;
let fixed=0;

for(const file of targets){
  let src=await readFile(file,'utf8');
  if(!src.includes(bad)) throw new Error(`V68.11.7 marker YouTube incorrect introuvable dans ${path.basename(file)}`);
  src=src.replaceAll(bad,good);
  await writeFile(file,src,'utf8');
  fixed++;
}

if(fixed!==2) throw new Error(`V68.11.7 correction marker incomplète: ${fixed}/2`);
console.log('Audify V68.11.7 : marker videoRenderer corrigé, le parseur lit maintenant les vrais résultats YouTube Web.');
