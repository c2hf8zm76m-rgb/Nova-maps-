import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const albumPath=path.join(root,'android','app','src','main','java','com','nova','audify','AudifyInstantAlbums.java');
let src=await readFile(albumPath,'utf8');

const marker='AUDIFY_V68164_VISIBLE_FAILURE_DIAGNOSTIC_UI';
if(src.includes(marker)){
  console.log('Audify V68.16.4: visible diagnostic UI already installed.');
  process.exit(0);
}

const stateAnchor='    private static volatile String observed="",albumFor="";';
if(!src.includes(stateAnchor))throw new Error('V68.16.4 UI: album state anchor missing');
src=src.replace(stateAnchor,stateAnchor+'\n    private static volatile String diagnosticShownFor="";\n    private static final String DIAGNOSTIC_UI_MARKER="'+marker+'";');

const detectAnchor='        String k=key(s);if(TextUtils.isEmpty(k))return;';
if(!src.includes(detectAnchor))throw new Error('V68.16.4 UI: detect key anchor missing');
src=src.replace(detectAnchor,detectAnchor+'\n        scheduleFailureDiagnostic(a,k);');

const methodAnchor='    private static void showCard(Activity a,AudifyInstantAlbumMetadata.Album album,Snap s){';
if(!src.includes(methodAnchor))throw new Error('V68.16.4 UI: showCard method anchor missing');
const helper=String.raw`    private static void scheduleFailureDiagnostic(Activity a,String expectedKey){
        final long started=android.os.SystemClock.elapsedRealtime();
        MAIN.postDelayed(new Runnable(){public void run(){
            Activity x=active.get();
            if(x==null||x.isFinishing()||(Build.VERSION.SDK_INT>=17&&x.isDestroyed()))return;
            if(!expectedKey.equals(key(snap())))return;
            if(current!=null&&expectedKey.equals(albumFor))return;
            String trace=AudifyInstantAlbumMetadata.diagnostic();
            long age=android.os.SystemClock.elapsedRealtime()-started;
            boolean finished=!TextUtils.isEmpty(trace)&&(trace.contains("FINAL_REJECT")||trace.contains("_ACCEPT "));
            if(!finished&&age<45000L){MAIN.postDelayed(this,850L);return;}
            if(TextUtils.isEmpty(trace))trace="Aucune trace reçue du moteur album après "+age+" ms.";
            if(expectedKey.equals(diagnosticShownFor))return;
            diagnosticShownFor=expectedKey;
            final String shown=trace.length()>4200?trace.substring(trace.length()-4200):trace;
            try{android.util.Log.e("AUDIFY_ALBUM_TRACE","VISIBLE FAILURE DIAGNOSTIC\n"+shown);}catch(Throwable ignored){}
            new AlertDialog.Builder(x)
                .setTitle("Diagnostic album V68.16.4")
                .setMessage(shown)
                .setPositiveButton("Fermer",null)
                .setNeutralButton("Copier",(dd,which)->{
                    try{
                        android.content.ClipboardManager cm=(android.content.ClipboardManager)x.getSystemService(android.content.Context.CLIPBOARD_SERVICE);
                        if(cm!=null)cm.setPrimaryClip(android.content.ClipData.newPlainText("Audify album diagnostic",shown));
                        Toast.makeText(x,"Diagnostic copié",Toast.LENGTH_SHORT).show();
                    }catch(Throwable ignored){}
                })
                .show();
        }},1800L);
    }

`;
src=src.replace(methodAnchor,helper+methodAnchor);
await writeFile(albumPath,src,'utf8');
console.log('Audify V68.16.4: robust visible failure diagnostic installed without depending on historical Toast branches.');
