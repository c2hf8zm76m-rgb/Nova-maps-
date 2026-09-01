import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const homePath=path.join(root,'android','app','src','main','java','com','nova','audify','NativeHomeActivity.java');

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
  throw new Error(`V68.12.24 méthode introuvable: ${label}`);
}

let home=await readFile(homePath,'utf8');

// La barre sticky (recherche + avatar) est construite hors de libraryContent.
// rebuildLibrary() ne peut donc pas mettre l'avatar à jour quand la session change.
const classMarker='public class NativeHomeActivity extends AppCompatActivity {';
if(!home.includes(classMarker)) throw new Error('V68.12.24 classe NativeHomeActivity introuvable');
if(!home.includes('private boolean v681224AccountState;')){
  home=home.replace(classMarker,classMarker+'\n    private boolean v681224AccountState;');
}

// Mémorise l'état réellement affiché lors de la construction du Home.
const onCreate=findMethod(home,[
  '    @Override protected void onCreate(Bundle savedInstanceState){',
  '    @Override protected void onCreate(Bundle savedInstanceState) {'
],'onCreate');
let onCreateBody=home.slice(onCreate.brace+1,onCreate.end-1);
if(!onCreateBody.includes('v681224AccountState=new AudifyAccountStore(this).isSignedIn();')){
  const superNeedle='        super.onCreate(savedInstanceState);';
  const local=onCreateBody.indexOf(superNeedle);
  if(local<0) throw new Error('V68.12.24 super.onCreate introuvable');
  onCreateBody=onCreateBody.slice(0,local+superNeedle.length)+
    '\n        v681224AccountState=new AudifyAccountStore(this).isSignedIn();'+
    onCreateBody.slice(local+superNeedle.length);
  home=home.slice(0,onCreate.brace+1)+onCreateBody+home.slice(onCreate.end-1);
}

// Au retour de la page Compte, compare la session réelle avec l'état qui a servi
// à dessiner l'avatar. Si elle a changé, recrée uniquement le Home une fois.
const onResume=findMethod(home,[
  '    @Override protected void onResume(){',
  '    @Override protected void onResume() {'
],'onResume');
let onResumeBody=home.slice(onResume.brace+1,onResume.end-1);
if(!onResumeBody.includes('boolean v681224Now=')){
  const check=`\n        boolean v681224Now=new AudifyAccountStore(this).isSignedIn();\n        if(v681224Now!=v681224AccountState){\n            v681224AccountState=v681224Now;\n            recreate();\n            return;\n        }`;
  onResumeBody=check+onResumeBody;
  home=home.slice(0,onResume.brace+1)+onResumeBody+home.slice(onResume.end-1);
}

await writeFile(homePath,home,'utf8');
console.log('Audify Android V68.12.24 : le Home relit la session compte au retour et reconstruit immédiatement l avatar sticky si connexion/déconnexion a changé.');
