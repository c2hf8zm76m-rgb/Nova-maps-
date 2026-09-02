import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const enginePath = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'nova', 'audify', 'AudifyYoutubeSearchEngine.java');
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');

function replaceMethod(source, signatures, replacement, label) {
  for (const signature of signatures) {
    const start = source.indexOf(signature);
    if (start < 0) continue;
    const brace = source.indexOf('{', start);
    if (brace < 0) continue;
    let depth = 0;
    for (let i = brace; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) return source.slice(0, start) + replacement + source.slice(i + 1);
      }
    }
  }
  throw new Error(`V68.12.39 méthode introuvable: ${label}`);
}

let src = await readFile(enginePath, 'utf8');

src = replaceMethod(src,
  ['    static ArrayList<Result> search(String rawQuery) throws Exception{', '    static ArrayList<Result> search(String rawQuery) throws Exception {', '    static ArrayList<Result> search(String rawQuery){'],
String.raw`    static ArrayList<Result> search(String rawQuery) throws Exception{
        String query=rawQuery==null?"":rawQuery.trim();
        ArrayList<Result> empty=new ArrayList<>();
        if(query.isEmpty()) return empty;

        String page="";
        Throwable pageFailure=null;
        try{ page=fetchSearchPage(query); }catch(Throwable error){ pageFailure=error; }

        // Le HTML public est le chemin principal. YouTube change parfois le nom
        // de la variable globale, mais les videoRenderer restent présents dans
        // le JSON embarqué : on essaie les deux formes avant Innertube.
        if(!page.isEmpty()){
            JSONObject initial=extractInitialData(page);
            if(initial!=null){
                ArrayList<Result> direct=resultsFromJson(initial);
                if(!direct.isEmpty()) return direct;
            }
            ArrayList<Result> embedded=resultsFromEmbeddedPage(page);
            if(!embedded.isEmpty()) return embedded;
        }

        // Innertube reste un secours, mais une page YouTube valide sans résultat
        // ne doit jamais être transformée en erreur réseau dans l'interface.
        try{
            ensureConfig(page);
            JSONObject response=postYoutubei(query);
            return resultsFromJson(response);
        }catch(Throwable youtubeiFailure){
            if(!page.isEmpty()) return empty;
            if(pageFailure instanceof Exception) throw (Exception)pageFailure;
            if(youtubeiFailure instanceof Exception) throw (Exception)youtubeiFailure;
            throw new Exception(youtubeiFailure);
        }
    }`,'search principal');

src = replaceMethod(src,
  ['    private static String fetchSearchPage(String query) throws Exception{', '    private static String fetchSearchPage(String query) throws Exception {'],
String.raw`    private static String fetchSearchPage(String query) throws Exception{
        String encoded=URLEncoder.encode(query,"UTF-8");
        String[] endpoints=new String[]{
            "https://www.youtube.com/results?search_query="+encoded+"&hl=fr&gl=FR&persist_hl=1",
            "https://m.youtube.com/results?search_query="+encoded+"&hl=fr&gl=FR",
            "https://www.youtube.com/results?search_query="+encoded+"&hl=en&gl=US"
        };
        Exception last=null;
        for(String endpoint:endpoints){
            try{
                String body=get(endpoint);
                if(body!=null&&!body.isEmpty()) return body;
            }catch(Exception error){ last=error; }
        }
        if(last!=null) throw last;
        throw new java.io.IOException("YouTube page vide");
    }`,'transport HTML');

const collectMarker = '    private static void collectRenderers(Object node,ArrayList<JSONObject> out,Set<String> seen){';
if (!src.includes('private static ArrayList<Result> resultsFromEmbeddedPage(')) {
  const helpers = String.raw`    private static ArrayList<Result> resultsFromEmbeddedPage(String page){
        ArrayList<JSONObject> renderers=new ArrayList<>();
        Set<String> seen=new LinkedHashSet<>();
        String[] markers=new String[]{"videoRenderer"};
        for(String marker:markers){
            int pos=0;
            while(pos<page.length()&&renderers.size()<100){
                int hit=page.indexOf(marker,pos);
                if(hit<0) break;
                int brace=page.indexOf('{',hit+marker.length());
                if(brace<0) break;
                int depth=0; boolean quoted=false,escaped=false; int end=-1;
                for(int i=brace;i<page.length();i++){
                    char ch=page.charAt(i);
                    if(quoted){
                        if(escaped){escaped=false;continue;}
                        if(ch==92){escaped=true;continue;}
                        if(ch==34) quoted=false;
                        continue;
                    }
                    if(ch==34){quoted=true;continue;}
                    if(ch=='{') depth++;
                    else if(ch=='}'){depth--;if(depth==0){end=i+1;break;}}
                }
                pos=Math.max(brace+1,end>0?end:brace+1);
                if(end<=brace) continue;
                try{
                    JSONObject renderer=new JSONObject(page.substring(brace,end));
                    String id=renderer.optString("videoId","");
                    if(!id.isEmpty()&&seen.add(id)) renderers.add(renderer);
                }catch(Throwable ignored){}
            }
        }
        return resultsFromRenderers(renderers);
    }

    private static ArrayList<Result> resultsFromRenderers(ArrayList<JSONObject> renderers){
        ArrayList<Result> results=new ArrayList<>();
        Set<String> seen=new LinkedHashSet<>();
        for(JSONObject renderer:renderers){
            if(results.size()>=24) break;
            String id=renderer.optString("videoId","");
            if(id.isEmpty()||seen.contains(id)) continue;
            long seconds=clockSeconds(durationText(renderer));
            if(seconds<60L||seconds>360L) continue;
            String title=text(renderer,"title");
            if(title.isEmpty()) continue;
            String artist=text(renderer,"ownerText");
            if(artist.isEmpty()) artist=text(renderer,"longBylineText");
            if(artist.isEmpty()) artist=text(renderer,"shortBylineText");
            if(artist.isEmpty()) artist="YouTube";
            seen.add(id);
            results.add(new Result(id,title,artist,"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg",seconds));
        }
        return results;
    }

    private static String durationText(JSONObject renderer){
        String direct=text(renderer,"lengthText");
        if(!direct.isEmpty()) return direct;
        JSONArray overlays=renderer==null?null:renderer.optJSONArray("thumbnailOverlays");
        if(overlays!=null){
            for(int i=0;i<overlays.length();i++){
                JSONObject overlay=overlays.optJSONObject(i); if(overlay==null) continue;
                JSONObject status=overlay.optJSONObject("thumbnailOverlayTimeStatusRenderer");
                String value=text(status,"text"); if(!value.isEmpty()) return value;
            }
        }
        return "";
    }

`;
  src = src.replace(collectMarker, helpers + collectMarker);
}

src = src.replace('long seconds=clockSeconds(text(renderer,"lengthText"));', 'long seconds=clockSeconds(durationText(renderer));');
src = src.replace('            long seconds=clockSeconds(text(renderer,"lengthText"));', '            long seconds=clockSeconds(durationText(renderer));');
src = src.replace(`            c=(HttpURLConnection)new URL(endpoint).openConnection();
            c.setRequestMethod("GET");`, `            c=(HttpURLConnection)new URL(endpoint).openConnection();
            c.setInstanceFollowRedirects(true);
            c.setRequestMethod("GET");`);
if (!src.includes('V68.12.39')) src = src.replace('final class AudifyYoutubeSearchEngine {', 'final class AudifyYoutubeSearchEngine {\n    // V68.12.39 : recherche HTML YouTube résiliente aux pages consentement/locale.');

await writeFile(enginePath, src, 'utf8');
let gradle = await readFile(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode \d+/, 'versionCode 681239').replace(/versionName "[^"]+"/, 'versionName "68.12.39"');
await writeFile(gradlePath, gradle, 'utf8');
console.log('Audify V68.12.39 : transport YouTube multi-locale, parseur videoRenderer embarqué et erreurs réseau distinguées des recherches vides.');
