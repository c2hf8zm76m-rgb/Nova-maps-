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

function replaceMethod(source,signatures,replacement,label){
  const found=findMethod(source,signatures,label);
  return source.slice(0,found.start)+replacement+source.slice(found.end);
}

let home=await readFile(homePath,'utf8');

const classMarker='public class NativeHomeActivity extends AppCompatActivity {';
if(!home.includes(classMarker)) throw new Error('V68.12.24 classe NativeHomeActivity introuvable');
if(!home.includes('private boolean v681224AccountState;')){
  home=home.replace(classMarker,classMarker+'\n    private boolean v681224AccountState;');
}

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

home=replaceMethod(home,[
  '    @Override protected void onResume(){',
  '    @Override protected void onResume() {'
],String.raw`    @Override protected void onResume(){
        super.onResume();

        boolean v681224Now=new AudifyAccountStore(this).isSignedIn();
        if(v681224Now!=v681224AccountState){
            v681224AccountState=v681224Now;
            android.view.View decor=getWindow()==null?null:getWindow().getDecorView();
            if(decor!=null){
                decor.post(()->{
                    if(!isFinishing()&&!isDestroyed()) recreate();
                });
            }
            return;
        }

        rebuildLibrary();
        handler.removeCallbacks(ticker);
        handler.post(ticker);
    }`,'onResume');

await writeFile(homePath,home,'utf8');
console.log('Audify Android V68.12.24/25 : rafraîchissement session Home sécurisé, super.onResume garanti et recreate différé.');

// V68.12.26 est chaînée ici afin que tous les futurs builds héritent du support
// de photo de profil sans dépendre d'une commande manuelle supplémentaire.
await import('./v681226-custom-profile-photo.mjs');
