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
if(!main.includes('import android.view.MotionEvent;')){
  main=main.replace('import android.view.ViewGroup;','import android.view.ViewGroup;\nimport android.view.MotionEvent;\nimport android.view.Gravity;\nimport android.widget.FrameLayout;\nimport android.widget.TextView;');
}
if(!main.includes('import androidx.core.graphics.Insets;')){
  main=main.replace('import androidx.core.content.ContextCompat;',`import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;`);
}

const classMarker='public class MainActivity extends BridgeActivity {';
if(!main.includes(classMarker))throw new Error('Classe MainActivity V66.4 introuvable');
const traceMembers=String.raw`
    private WebView audifyTraceWebView;
    private TextView audifyTraceView;
    private final StringBuilder audifyTraceLog=new StringBuilder();

    private String traceActionName(int action){
        if(action==MotionEvent.ACTION_DOWN)return "DOWN";
        if(action==MotionEvent.ACTION_UP)return "UP";
        if(action==MotionEvent.ACTION_CANCEL)return "CANCEL";
        return String.valueOf(action);
    }

    private void updateAudifyTrace(String line){
        runOnUiThread(()->{
            try{
                boolean ime=false;
                WindowInsetsCompat wi=audifyTraceWebView==null?null:ViewCompat.getRootWindowInsets(audifyTraceWebView);
                if(wi!=null)ime=wi.isVisible(WindowInsetsCompat.Type.ime());
                String full=line+" | IME="+(ime?"ON":"off");
                synchronized(audifyTraceLog){
                    if(audifyTraceLog.length()>0)audifyTraceLog.append("\n");
                    audifyTraceLog.append(full);
                    if(audifyTraceLog.length()>1800)audifyTraceLog.delete(0,audifyTraceLog.length()-1800);
                    if(audifyTraceView!=null)audifyTraceView.setText("AUDIFY TOUCH TRACE V66.4\n"+audifyTraceLog.toString());
                }
            }catch(Exception ignored){}
        });
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event){
        try{
            int a=event.getActionMasked();
            if(a==MotionEvent.ACTION_DOWN||a==MotionEvent.ACTION_UP||a==MotionEvent.ACTION_CANCEL){
                WebView w=audifyTraceWebView;
                boolean inside=false;
                String bounds="?";
                if(w!=null){
                    int[] loc=new int[2];w.getLocationOnScreen(loc);
                    int l=loc[0],t=loc[1],r=l+w.getWidth(),b=t+w.getHeight();
                    float x=event.getRawX(),y=event.getRawY();
                    inside=x>=l&&x<r&&y>=t&&y<b;
                    bounds=l+","+t+"-"+r+","+b;
                }
                updateAudifyTrace("ACTIVITY "+traceActionName(a)+" raw="+Math.round(event.getRawX())+","+Math.round(event.getRawY())+" web="+bounds+" inside="+inside);
            }
        }catch(Exception ignored){}
        return super.dispatchTouchEvent(event);
    }
`;
main=main.replace(classMarker,classMarker+traceMembers);

const marker='webView.setBackgroundColor(Color.rgb(7,10,15));';
if(!main.includes(marker))throw new Error('Point WebView V66.4 introuvable');

const replacement=`webView.setBackgroundColor(Color.rgb(7,10,15));
        audifyTraceWebView=webView;

        // V66.3 : vrais WindowInsets natifs autour de la WebView.
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
            updateAudifyTrace("INSETS sys="+sys.left+","+sys.top+","+sys.right+","+sys.bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(webView);

        // V66.4 : deuxième étage du traceur. Retourne false pour ne JAMAIS consommer le toucher.
        webView.setOnTouchListener((v,event)->{
            int a=event.getActionMasked();
            if(a==MotionEvent.ACTION_DOWN||a==MotionEvent.ACTION_UP||a==MotionEvent.ACTION_CANCEL){
                updateAudifyTrace("WEBVIEW "+traceActionName(a)+" local="+Math.round(event.getX())+","+Math.round(event.getY()));
            }
            return false;
        });

        // Panneau 100 % natif : il continue de fonctionner même si le HTML ne reçoit rien.
        audifyTraceView=new TextView(this);
        audifyTraceView.setText("AUDIFY TOUCH TRACE V66.4\\nPrêt — touche la barre de recherche");
        audifyTraceView.setTextColor(Color.rgb(150,255,120));
        audifyTraceView.setBackgroundColor(Color.argb(225,0,0,0));
        audifyTraceView.setTextSize(11f);
        audifyTraceView.setPadding(14,10,14,10);
        audifyTraceView.setClickable(false);
        audifyTraceView.setFocusable(false);
        audifyTraceView.setElevation(10000f);
        ViewGroup decor=(ViewGroup)getWindow().getDecorView();
        FrameLayout.LayoutParams traceLp=new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT,Gravity.BOTTOM);
        traceLp.setMargins(8,8,8,16);
        decor.addView(audifyTraceView,traceLp);`;

main=main.replace(marker,replacement);

const bridgeMarker='    private final class AudifyJsBridge {';
if(!main.includes(bridgeMarker))throw new Error('Bridge JS V66.4 introuvable');
main=main.replace(bridgeMarker,bridgeMarker+String.raw`
        @JavascriptInterface
        public void traceHtml(String json){
            updateAudifyTrace("HTML "+(json==null?"":json));
        }
`);

await writeFile(mainPath,main,'utf8');
console.log('Audify Android V66.4 : traceur ACTIVITY + WEBVIEW + HTML injecté.');
