import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');

let main=await readFile(mainPath,'utf8');

if(!main.includes('import android.view.ViewGroup;')){
  main=main.replace('import android.webkit.WebView;','import android.webkit.WebView;\nimport android.view.ViewGroup;\nimport android.view.WindowManager;');
}
if(!main.includes('import androidx.core.graphics.Insets;')){
  main=main.replace('import androidx.core.content.ContextCompat;',`import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;`);
}

const marker='webView.setBackgroundColor(Color.rgb(7,10,15));';
if(!main.includes(marker))throw new Error('Point WebView V66.3 introuvable');

const replacement=`webView.setBackgroundColor(Color.rgb(7,10,15));
        // V66.3 : Android 15+ peut dessiner la WebView sous les barres système.
        // On applique les vrais WindowInsets AU CONTENEUR WEBVIEW, côté natif :
        // la barre de recherche n'est donc plus seulement visible, elle reçoit réellement les touches.
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        ViewCompat.setOnApplyWindowInsetsListener(webView,(v,insets)->{
            Insets sys=insets.getInsets(
                WindowInsetsCompat.Type.statusBars()
                | WindowInsetsCompat.Type.navigationBars()
                | WindowInsetsCompat.Type.displayCutout());
            android.view.ViewGroup.LayoutParams raw=v.getLayoutParams();
            if(raw instanceof ViewGroup.MarginLayoutParams){
                ViewGroup.MarginLayoutParams lp=(ViewGroup.MarginLayoutParams)raw;
                if(lp.leftMargin!=sys.left||lp.topMargin!=sys.top||lp.rightMargin!=sys.right||lp.bottomMargin!=sys.bottom){
                    lp.setMargins(sys.left,sys.top,sys.right,sys.bottom);
                    v.setLayoutParams(lp);
                }
            }else{
                v.setPadding(sys.left,sys.top,sys.right,sys.bottom);
            }
            return insets;
        });
        ViewCompat.requestApplyInsets(webView);`;

main=main.replace(marker,replacement);
await writeFile(mainPath,main,'utf8');
console.log('Audify Android V66.3 : WindowInsets natifs appliqués au WebView.');
