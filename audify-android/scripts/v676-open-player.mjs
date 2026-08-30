import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');
let main=await readFile(mainPath,'utf8');

const marker='            android.widget.Toast.makeText(this, "Lecture : " + chosen.title, android.widget.Toast.LENGTH_SHORT).show();';
if(!main.includes(marker)) throw new Error('Point lecture V67.4 introuvable');

const replacement=String.raw`            if (audifySearchScrollV672 != null) {
                audifySearchScrollV672.setVisibility(android.view.View.GONE);
            }

            try {
                org.json.JSONObject uiTrack = new org.json.JSONObject();
                uiTrack.put("id", chosen.id);
                uiTrack.put("title", chosen.title);
                uiTrack.put("artist", chosen.artist);
                uiTrack.put("thumbnail", chosen.thumbnail);

                final String js = "window.AudifyAndroidOpenTrack && window.AudifyAndroidOpenTrack("
                    + org.json.JSONObject.quote(uiTrack.toString()) + ","
                    + org.json.JSONObject.quote(root.toString()) + ");";
                final android.webkit.WebView audifyWebView = getBridge().getWebView();
                audifyWebView.post(() -> audifyWebView.evaluateJavascript(js, null));
            } catch (Throwable ignored) {}

            android.widget.Toast.makeText(this, "Lecture : " + chosen.title, android.widget.Toast.LENGTH_SHORT).show();`;

main=main.replace(marker,replacement);
await writeFile(mainPath,main,'utf8');
console.log('Audify Android V67.6 : un clic resultat ouvre maintenant le lecteur Web complet en plus d ExoPlayer.');
