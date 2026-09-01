import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');
let main=await readFile(mainPath,'utf8');

// V68.12.0.2 : la vieille MainActivity termine par onDestroy(). Le patch
// précédent utilisait une regex incapable de traverser correctement le try/catch
// existant. On reconstruit donc proprement cette dernière méthode jusqu'à
// l'accolade finale de la classe.
const marker='    @Override public void onDestroy()';
const start=main.lastIndexOf(marker);
const classEnd=main.lastIndexOf('}');
if(start<0 || classEnd<=start) throw new Error('V68.12.0.2 onDestroy final MainActivity introuvable');

const clean=`    @Override public void onDestroy(){
        audifyControllerV68120=null;
        if(audifyControllerFutureV68120!=null){
            try{ MediaController.releaseFuture(audifyControllerFutureV68120); }catch(Exception ignored){}
            audifyControllerFutureV68120=null;
        }
        super.onDestroy();
    }
`;

main=main.slice(0,start)+clean+'}\n';
await writeFile(mainPath,main,'utf8');
console.log('Audify V68.12.0.2 : lifecycle MediaController MainActivity corrigé.');
