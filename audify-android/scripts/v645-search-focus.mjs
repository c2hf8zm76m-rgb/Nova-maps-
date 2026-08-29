import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');

let main=await readFile(mainPath,'utf8');
if(!main.includes('import android.view.WindowManager;')){
  main=main.replace('import android.webkit.WebView;','import android.webkit.WebView;\nimport android.view.WindowManager;');
}

const marker='webView.setBackgroundColor(Color.rgb(7,10,15));';
const replacement=`webView.setBackgroundColor(Color.rgb(7,10,15));
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);`;
if(!main.includes(marker))throw new Error('Point WebView V64.5 introuvable');
main=main.replace(marker,replacement);

await writeFile(mainPath,main,'utf8');
console.log('Audify Android V64.5: focus WebView + clavier Android restaurés.');
