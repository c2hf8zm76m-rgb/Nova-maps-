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

let total=0;
for(const file of targets){
  let src=await readFile(file,'utf8');
  const before=src;
  // V68.11.6.1: avoid Java backslash char-literal escaping entirely.
  src=src.replaceAll("if(ch=='\\\\\\\\'){escaped=true;continue;}","if(ch==92){escaped=true;continue;}");
  if(src!==before){
    total++;
    await writeFile(file,src,'utf8');
  }
}
if(total!==2) throw new Error(`V68.11.6.1 correction escaping incomplète: ${total}/2 fichiers corrigés`);
console.log('Audify V68.11.6.1 : échappement du parseur YouTube Web corrigé dans MainActivity et Discovery Agent.');
