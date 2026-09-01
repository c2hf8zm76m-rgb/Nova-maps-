import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');
let main=await readFile(mainPath,'utf8');

function replaceMethod(source,signature,replacement){
  const start=source.indexOf(signature);
  if(start<0) throw new Error('V68.12.11 audifyPlaySearchResultV674 introuvable');
  const brace=source.indexOf('{',start);
  if(brace<0) throw new Error('V68.12.11 accolade méthode introuvable');
  let depth=0,end=-1;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{') depth++;
    else if(source[i]==='}'){
      depth--;
      if(depth===0){end=i+1;break;}
    }
  }
  if(end<0) throw new Error('V68.12.11 fin méthode introuvable');
  return source.slice(0,start)+replacement+source.slice(end);
}

const method=String.raw`    private void audifyPlaySearchResultV674(java.util.List<AudifySearchItemV673> items, int selectedIndex) {
        if (items == null || selectedIndex < 0 || selectedIndex >= items.size()) return;
        try {
            org.json.JSONArray arr = new org.json.JSONArray();
            for (int i=0; i<items.size() && i<20; i++) {
                AudifySearchItemV673 t = items.get(i);
                org.json.JSONObject o = new org.json.JSONObject();
                o.put("id", t.id);
                o.put("title", t.title);
                o.put("artist", t.artist);
                o.put("thumbnail", t.thumbnail);
                arr.put(o);
            }

            org.json.JSONObject root = new org.json.JSONObject();
            root.put("items", arr);
            root.put("index", selectedIndex);

            AudifySearchItemV673 chosen = items.get(selectedIndex);

            // V68.12.11 : un clic sur une carte signifie immédiatement "écouter".
            // 1) La file est installée pour que précédent/suivant soient prêts.
            startService(new android.content.Intent(this, AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_SET_QUEUE)
                .putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON, root.toString()));

            // 2) Le titre sélectionné est chargé. ACTION_LOAD prépare déjà ExoPlayer
            //    et demande la lecture dans le moteur Audify.
            startService(new android.content.Intent(this, AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_LOAD)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID, chosen.id)
                .putExtra(AudifyPlaybackService.EXTRA_TITLE, chosen.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST, chosen.artist)
                .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL, chosen.thumbnail));

            // 3) Sécurité supplémentaire : si le chargement asynchrone n'a pas encore
            //    propagé playWhenReady, on renvoie PLAY quelques millisecondes après.
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                try {
                    startService(new android.content.Intent(MainActivity.this, AudifyPlaybackService.class)
                        .setAction(AudifyPlaybackService.ACTION_PLAY));
                } catch (Throwable ignored) {}
            }, 120L);

            // 4) Le lecteur s'ouvre immédiatement avec le bon morceau déjà demandé
            //    en lecture. Aucun second clic sur Play n'est nécessaire.
            startActivity(new android.content.Intent(this, NativePlayerActivity.class)
                .putExtra("videoId", chosen.id)
                .putExtra("title", chosen.title)
                .putExtra("artist", chosen.artist)
                .putExtra("thumbnail", chosen.thumbnail));

        } catch (Throwable error) {
            android.widget.Toast.makeText(this, "Impossible de lancer ce titre", android.widget.Toast.LENGTH_SHORT).show();
        }
    }`;

main=replaceMethod(main,'    private void audifyPlaySearchResultV674(',method);
await writeFile(mainPath,main,'utf8');

console.log('Audify V68.12.11 : clic résultat = lecture immédiate + ouverture lecteur, sans second clic Play.');
