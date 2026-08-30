import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');

let main=await readFile(mainPath,'utf8');
const classMarker='public class MainActivity extends BridgeActivity {';
if(!main.includes(classMarker))throw new Error('Classe MainActivity V66.5 introuvable');

const probeMethods=String.raw`
    private void probeChromiumAt(String label,float localX,float localY){
        WebView w=audifyTraceWebView;
        if(w==null)return;
        int ww=Math.max(1,w.getWidth()),wh=Math.max(1,w.getHeight());
        String safe=(label==null?"touch":label).replace("\\","\\\\").replace("'","\\'");
        String js="(function(){try{"+
            "var q=document.querySelector('#q'),vw=window.innerWidth||1,vh=window.innerHeight||1;"+
            "var x="+localX+"*vw/"+ww+",y="+localY+"*vh/"+wh+";"+
            "var d=function(e){if(!e)return 'null';var s=(e.tagName||'').toLowerCase();if(e.id)s+='#'+e.id;if(e.classList&&e.classList.length)s+='.'+Array.from(e.classList).slice(0,3).join('.');return s||String(e.nodeName||'node');};"+
            "var hit=document.elementFromPoint(x,y),stack=document.elementsFromPoint?document.elementsFromPoint(x,y).slice(0,8).map(d):[d(hit)],r=q?q.getBoundingClientRect():null,cs=q?getComputedStyle(q):null,a=document.activeElement;"+
            "return JSON.stringify({label:'"+safe+"',css:[Math.round(x),Math.round(y)],hit:d(hit),stack:stack,qRect:r?[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]:null,active:d(a),qFocused:a===q,disabled:q?!!q.disabled:null,readOnly:q?!!q.readOnly:null,pe:cs?cs.pointerEvents:null,display:cs?cs.display:null,visibility:cs?cs.visibility:null});"+
            "}catch(e){return 'ERR:'+e.message}})()";
        runOnUiThread(()->w.evaluateJavascript(js,value->updateAudifyTrace("DOM "+value)));
    }

    private void probeQCenter(){
        WebView w=audifyTraceWebView;
        if(w==null)return;
        String js="(function(){try{"+
            "var q=document.querySelector('#q');if(!q)return JSON.stringify({label:'Q-CENTER',q:'missing'});"+
            "var r=q.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;"+
            "var d=function(e){if(!e)return 'null';var s=(e.tagName||'').toLowerCase();if(e.id)s+='#'+e.id;if(e.classList&&e.classList.length)s+='.'+Array.from(e.classList).slice(0,3).join('.');return s||String(e.nodeName||'node');};"+
            "var hit=document.elementFromPoint(x,y),stack=document.elementsFromPoint?document.elementsFromPoint(x,y).slice(0,10).map(d):[d(hit)],cs=getComputedStyle(q),a=document.activeElement;"+
            "return JSON.stringify({label:'Q-CENTER',xy:[Math.round(x),Math.round(y)],hit:d(hit),stack:stack,qRect:[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)],active:d(a),qFocused:a===q,disabled:!!q.disabled,readOnly:!!q.readOnly,pe:cs.pointerEvents,display:cs.display,visibility:cs.visibility,z:cs.zIndex});"+
            "}catch(e){return 'ERR:'+e.message}})()";
        runOnUiThread(()->w.evaluateJavascript(js,value->updateAudifyTrace("DOM "+value)));
    }
`;
main=main.replace(classMarker,classMarker+probeMethods);

const oldTouch=`        webView.setOnTouchListener((v,event)->{\n            int a=event.getActionMasked();\n            if(a==MotionEvent.ACTION_DOWN||a==MotionEvent.ACTION_UP||a==MotionEvent.ACTION_CANCEL){\n                updateAudifyTrace(\"WEBVIEW \"+traceActionName(a)+\" local=\"+Math.round(event.getX())+\",\"+Math.round(event.getY()));\n            }\n            return false;\n        });`;
const newTouch=`        webView.setOnTouchListener((v,event)->{\n            int a=event.getActionMasked();\n            if(a==MotionEvent.ACTION_DOWN||a==MotionEvent.ACTION_UP||a==MotionEvent.ACTION_CANCEL){\n                updateAudifyTrace(\"WEBVIEW \"+traceActionName(a)+\" local=\"+Math.round(event.getX())+\",\"+Math.round(event.getY()));\n                if(a==MotionEvent.ACTION_DOWN)probeChromiumAt(\"TOUCH\",event.getX(),event.getY());\n            }\n            return false;\n        });`;
if(!main.includes(oldTouch))throw new Error('Listener WebView V66.4 introuvable');
main=main.replace(oldTouch,newTouch);

const panelMarker='decor.addView(audifyTraceView,traceLp);';
if(!main.includes(panelMarker))throw new Error('Panneau trace V66.4 introuvable');
main=main.replace(panelMarker,`${panelMarker}\n        webView.postDelayed(()->probeQCenter(),700);\n        webView.postDelayed(()->probeQCenter(),1800);`);
main=main.replace(/AUDIFY TOUCH TRACE V66\.4/g,'AUDIFY TOUCH TRACE V66.5');
main=main.replace('audifyTraceView.setTextSize(11f);','audifyTraceView.setTextSize(9f);');

await writeFile(mainPath,main,'utf8');
console.log('Audify Android V66.5 : sonde Chromium directe elementFromPoint/elementsFromPoint appliquée.');
