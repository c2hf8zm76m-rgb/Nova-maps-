import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const libraryPath=path.join(root,'android','app','src','main','java','com','nova','audify','NativeLibraryActivity.java');
let src=await readFile(libraryPath,'utf8');
if(!src.includes('import android.widget.Button;')) {
  if(src.includes('import android.app.AlertDialog;')) {
    src=src.replace('import android.app.AlertDialog;', 'import android.app.AlertDialog;\nimport android.widget.Button;');
  } else if(src.includes('import android.widget.AlertDialog;')) {
    src=src.replace('import android.widget.AlertDialog;', 'import android.widget.AlertDialog;\nimport android.widget.Button;');
  }
}
await writeFile(libraryPath,src,'utf8');
console.log('Audify V68.6.1 : import Button de la bibliothèque corrigé.');
