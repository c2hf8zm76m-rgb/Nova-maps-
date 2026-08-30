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

const classMarker='public class MainActivity extends BridgeActivity {';
if(!main.includes(classMarker))throw new Error('Classe MainActivity V66.6 introuvable');
const runtimeMembers=String.raw`
    private static final String AUDIFY_RUNTIME_PREFS = "audify_native_runtime";
    private static final String AUDIFY_RUNTIME_PURGE_V666 = "legacy_sw_purged_v666";
    private WebView audifyRuntimeWebView;

    private void purgeLegacyAudifyRuntime(WebView webView) {
        audifyRuntimeWebView = webView;
        try {
            if (getSharedPreferences(AUDIFY_RUNTIME_PREFS, MODE_PRIVATE)
                    .getBoolean(AUDIFY_RUNTIME_PURGE_V666, false)) return;

            webView.postDelayed(() -> {
                try {
                    String js = "(async function(){try{" +
                        "if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations){" +
                        "var rs=await navigator.serviceWorker.getRegistrations();" +
                        "await Promise.all(rs.map(function(r){return r.unregister().catch(function(){return false;});}));}" +
                        "if(window.caches&&caches.keys){var ks=await caches.keys();" +
                        "await Promise.all(ks.filter(function(k){return /^audify-/i.test(k);}).map(function(k){return caches.delete(k);}));}" +
                        "}catch(e){}finally{setTimeout(function(){try{AudifyNative.runtimePurgeDone();}catch(e){}},120);}})();";
                    webView.evaluateJavascript(js, null);
                } catch (Exception ignored) {}
            }, 900);
        } catch (Exception ignored) {}
    }

    private void finishLegacyAudifyRuntimePurge() {
        runOnUiThread(() -> {
            try {
                if (getSharedPreferences(AUDIFY_RUNTIME_PREFS, MODE_PRIVATE)
                        .getBoolean(AUDIFY_RUNTIME_PURGE_V666, false)) return;
                getSharedPreferences(AUDIFY_RUNTIME_PREFS, MODE_PRIVATE)
                    .edit().putBoolean(AUDIFY_RUNTIME_PURGE_V666, true).apply();
                WebView webView = audifyRuntimeWebView;
                if (webView != null) {
                    webView.clearCache(true);
                    webView.loadUrl("https://localhost/index.html?audify_native_v666=1");
                }
            } catch (Exception ignored) {}
        });
    }
`;
main=main.replace(classMarker,classMarker+runtimeMembers);

const marker='webView.setBackgroundColor(Color.rgb(7,10,15));';
if(!main.includes(marker))throw new Error('Point WebView V66.6 introuvable');
const replacement=`webView.setBackgroundColor(Color.rgb(7,10,15));
        audifyRuntimeWebView=webView;

        // V66.6 : le navigateur embarqué ne doit plus être piloté par les vieux shells PWA.
        // Cette purge est native : elle fonctionne même si un ancien Service Worker a servi la page initiale.
        purgeLegacyAudifyRuntime(webView);

        // Conserve les vrais insets Android autour de la WebView, sans hack de focus/IME.
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

const bridgeMarker='    private final class AudifyJsBridge {';
if(!main.includes(bridgeMarker))throw new Error('Bridge JS V66.6 introuvable');
main=main.replace(bridgeMarker,bridgeMarker+String.raw`
        @JavascriptInterface
        public void runtimePurgeDone() {
            finishLegacyAudifyRuntimePurge();
        }
`);

await writeFile(mainPath,main,'utf8');
console.log('Audify Android V66.6 : purge native SW/cache + WindowInsets propres appliqués.');
