import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');

let main=await readFile(mainPath,'utf8');

if(!main.includes('import android.content.Context;')){
  main=main.replace('import android.content.Intent;','import android.content.Context;\nimport android.content.Intent;');
}
if(!main.includes('import android.view.MotionEvent;')){
  main=main.replace('import android.view.WindowManager;','import android.view.WindowManager;\nimport android.view.MotionEvent;\nimport android.view.inputmethod.InputMethodManager;');
}

const focusMarker='getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);';
if(!main.includes(focusMarker))throw new Error('Point focus V64.7 introuvable');
main=main.replace(focusMarker,`${focusMarker}
        webView.requestFocus();
        webView.setOnTouchListener((v,event)->{
            if(event.getAction()==MotionEvent.ACTION_UP){
                float density=getResources().getDisplayMetrics().density;
                float yDp=event.getY()/Math.max(1f,density);
                float xRatio=webView.getWidth()>0?event.getX()/webView.getWidth():1f;
                // Filet de sécurité natif : la barre Audify est toujours tout en haut.
                // Même si un listener DOM échoue, le WebView reçoit ce toucher.
                if(yDp<=96f && xRatio<0.78f){
                    webView.postDelayed(this::focusSearchInput,30);
                }
            }
            return false;
        });`);

const bridgeMarker='    private final class AudifyJsBridge {';
if(!main.includes(bridgeMarker))throw new Error('AudifyJsBridge introuvable V64.7');
const focusMethod=`    private void focusSearchInput(){
        try{
            WebView webView=getBridge().getWebView();
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            webView.requestFocusFromTouch();
            webView.requestFocus();
            webView.evaluateJavascript(
                "(function(){var q=document.getElementById('q');if(!q)return false;q.disabled=false;q.readOnly=false;q.focus();try{var n=q.value.length;q.setSelectionRange(n,n);}catch(e){}return true;})()",
                value->{
                    Runnable showIme=()->{
                        try{
                            InputMethodManager imm=(InputMethodManager)getSystemService(Context.INPUT_METHOD_SERVICE);
                            if(imm!=null){
                                imm.restartInput(webView);
                                imm.showSoftInput(webView,InputMethodManager.SHOW_IMPLICIT);
                            }
                        }catch(Exception ignored){}
                    };
                    webView.postDelayed(showIme,70);
                    webView.postDelayed(showIme,190);
                }
            );
        }catch(Exception ignored){}
    }

`;
main=main.replace(bridgeMarker,focusMethod+bridgeMarker);

const stateMarker='        @JavascriptInterface public String getState(){return AudifyPlaybackService.getStateJson();}';
if(!main.includes(stateMarker))throw new Error('Point bridge getState introuvable V64.7');
main=main.replace(stateMarker,`        @JavascriptInterface public void focusSearch(){runOnUiThread(()->focusSearchInput());}
        ${stateMarker.trim()}`);

await writeFile(mainPath,main,'utf8');
console.log('Audify Android V64.7: focus HTML + InputMethodManager natif + fallback tactile appliqués.');
