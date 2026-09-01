import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const homePath=path.join(root,'android','app','src','main','java','com','nova','audify','NativeHomeActivity.java');

function replaceMethod(source,signatures,replacement,label){
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
        if(depth===0){ end=i+1; break; }
      }
    }
    if(end>0) return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error(`V68.12.25 méthode introuvable: ${label}`);
}

let home=await readFile(homePath,'utf8');

// V68.12.24 pouvait appeler recreate() puis return AVANT super.onResume().
// Android peut alors lever SuperNotCalledException et tuer l'Activity.
// V68.12.25 garantit d'abord le cycle de vie, puis programme la recréation
// après la fin de onResume afin de rafraîchir l'avatar sans crash.
home=replaceMethod(
  home,
  ['    @Override protected void onResume(){','    @Override protected void onResume() {'],
  String.raw`    @Override protected void onResume(){
        super.onResume();

        boolean v681225Now=new AudifyAccountStore(this).isSignedIn();
        if(v681225Now!=v681224AccountState){
            v681224AccountState=v681225Now;
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
    }`,
  'onResume'
);

await writeFile(homePath,home,'utf8');
console.log('Audify Android V68.12.25 : correction crash retour Compte -> Home (super.onResume garanti + recreate différé).');
