import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const target=path.join(root,'android','app','src','main','java','com','nova','audify','NativeLibraryActivity.java');
let src=await readFile(target,'utf8');
src=src.replace('import android.widget.AlertDialog;','import android.app.AlertDialog;');
await writeFile(target,src,'utf8');
console.log('Audify Android V67.9.1 : import AlertDialog bibliothèque corrigé.');
