import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const file=path.join(root,'android','app','src','main','java','com','nova','audify','AudifyYoutubeMusicAlbumResolver.java');
let s=await readFile(file,'utf8');

function req(a,b,label){
  if(!s.includes(a)) throw new Error('V68.15.1 coherence guard: missing '+label);
  s=s.replace(a,b);
}

req(
  'static final String NO_CACHE_MARKER="AUDIFY_V6815_NO_PERSISTENT_ALBUM_CACHE";',
  'static final String NO_CACHE_MARKER="AUDIFY_V6815_NO_PERSISTENT_ALBUM_CACHE";\n    static final String COHERENCE_MARKER="AUDIFY_V68151_YTMUSIC_COHERENCE_GUARD";',
  'marker'
);

req(
`            String[] album=findAlbum(r);\n            c.albumName=album[0];c.albumId=album[1];\n            c.artist=findArtist(r,c.albumName);\n            if(TextUtils.isEmpty(c.title)||TextUtils.isEmpty(c.albumId))return null;`,
`            String[] album=findAlbum(r);\n            c.albumName=album[0];c.albumId=album[1];\n            c.artist=findArtist(r,c.albumName);\n            if(TextUtils.isEmpty(c.title)||TextUtils.isEmpty(c.albumId)||!saneAlbumName(c.albumName))return null;`,
  'candidate sanity gate'
);

const oldShelf=`        ArrayList<JSONObject> shelves=new ArrayList<>();collectShelves(root,shelves);\n        ArrayList<TrackRow> bestRows=new ArrayList<>();\n        for(JSONObject shelf:shelves){\n            ArrayList<TrackRow> rows=parseShelf(shelf);\n            if(rows.size()>bestRows.size())bestRows=rows;\n        }\n        if(bestRows.size()<3)return null;\n\n        int current=-1,bestMatch=-1,bestMatchScore=Integer.MIN_VALUE;\n        for(int i=0;i<bestRows.size();i++){\n            TrackRow t=bestRows.get(i);\n            int m=0;\n            if(!TextUtils.isEmpty(c.videoId)&&c.videoId.equals(t.videoId))m+=120;\n            if(!TextUtils.isEmpty(sourceVideoId)&&sourceVideoId.equals(t.videoId))m+=130;\n            int sim=AudifyInstantAlbumMetadata.similarity(wantedTitle,t.title);\n            if(sim==3)m+=70;else if(sim==2)m+=45;else if(sim==1)m+=15;\n            m+=Math.max(0,artistScore(wantedArtist,t.artist)/2);\n            m+=Math.max(0,durationScore(sourceDurationMs,t.durationMs)/2);\n            if(m>bestMatchScore){bestMatchScore=m;bestMatch=i;}\n        }\n        // A structural album relation is accepted only when its tracklist confirms the song.\n        if(bestMatch<0||bestMatchScore<58)return null;\n        current=bestMatch;`;

const newShelf=`        ArrayList<JSONObject> shelves=new ArrayList<>();collectShelves(root,shelves);\n        ArrayList<TrackRow> bestRows=new ArrayList<>();\n        int bestShelfEvidence=Integer.MIN_VALUE;\n        int current=-1,bestMatch=-1,bestMatchScore=Integer.MIN_VALUE;\n        // Never pick the biggest shelf. Album pages also contain recommendations.\n        // Pick the shelf whose rows actually contain the requested recording.\n        for(JSONObject shelf:shelves){\n            ArrayList<TrackRow> rows=parseShelf(shelf);\n            if(rows.size()<3)continue;\n            int localIndex=-1,localMatch=Integer.MIN_VALUE;\n            for(int i=0;i<rows.size();i++){\n                int m=trackMatchScore(rows.get(i),c,wantedTitle,wantedArtist,sourceVideoId,sourceDurationMs);\n                if(m>localMatch){localMatch=m;localIndex=i;}\n            }\n            if(localIndex<0||localMatch<72)continue;\n            int evidence=localMatch+Math.min(28,rows.size());\n            if(evidence>bestShelfEvidence){\n                bestShelfEvidence=evidence;bestRows=rows;bestMatch=localIndex;bestMatchScore=localMatch;\n            }\n        }\n        if(bestRows.size()<3||bestMatch<0||bestMatchScore<72)return null;\n        current=bestMatch;`;
req(oldShelf,newShelf,'tracklist shelf selection');

const oldFind=`    private static String[] findAlbum(Object node){\n        String[] out=new String[]{"",""};findAlbumRec(node,out);return out;\n    }\n    private static boolean findAlbumRec(Object node,String[] out){\n        if(node instanceof JSONObject){\n            JSONObject o=(JSONObject)node;\n            String bid=browseId(o);\n            if(!TextUtils.isEmpty(bid)&&bid.startsWith("MPRE")){\n                out[0]=o.optString("text","");out[1]=bid;return true;\n            }\n            JSONArray names=o.names();if(names!=null)for(int i=0;i<names.length();i++){\n                Object v=o.opt(names.optString(i));if((v instanceof JSONObject||v instanceof JSONArray)&&findAlbumRec(v,out))return true;\n            }\n        }else if(node instanceof JSONArray){\n            JSONArray a=(JSONArray)node;for(int i=0;i<a.length();i++)if(findAlbumRec(a.opt(i),out))return true;\n        }\n        return false;\n    }`;

const newFind=`    private static String[] findAlbum(JSONObject renderer){\n        String[] out=new String[]{"",""};\n        JSONArray flex=renderer.optJSONArray("flexColumns");\n        if(flex==null)return out;\n        // Only accept an MPRE browse id attached to a visible text run in this song row.\n        // Deep recursive MPRE scanning can hit menus/recommendations and produced bogus albums.\n        for(int c=1;c<flex.length();c++){\n            JSONObject col=flex.optJSONObject(c);\n            JSONObject x=col==null?null:col.optJSONObject("musicResponsiveListItemFlexColumnRenderer");\n            JSONObject tx=x==null?null:x.optJSONObject("text");\n            JSONArray runs=tx==null?null:tx.optJSONArray("runs");\n            if(runs==null)continue;\n            for(int i=0;i<runs.length();i++){\n                JSONObject run=runs.optJSONObject(i);if(run==null)continue;\n                String bid=browseId(run);\n                String label=run.optString("text","").trim();\n                if(!TextUtils.isEmpty(bid)&&bid.startsWith("MPRE")&&saneAlbumName(label)){\n                    out[0]=label;out[1]=bid;return out;\n                }\n            }\n        }\n        return out;\n    }\n\n    private static boolean saneAlbumName(String value){\n        if(TextUtils.isEmpty(value))return false;\n        String v=value.trim();\n        if(v.length()<1||v.length()>120)return false;\n        String l=v.toLowerCase(Locale.ROOT);\n        if(v.contains("{")||v.contains("}")||v.contains("[\\\"")||v.contains("\\\":")||\n           l.contains("\\\"runs\\\"")||l.contains("navigationendpoint")||l.contains("browseendpoint")||\n           l.contains("accéder à")||l.contains("access to")||l.contains("musicresponsivelistitem"))return false;\n        return true;\n    }\n\n    private static int trackMatchScore(TrackRow t,Candidate c,String wantedTitle,String wantedArtist,String sourceVideoId,long sourceDurationMs){\n        int m=0;\n        if(!TextUtils.isEmpty(sourceVideoId)&&sourceVideoId.equals(t.videoId))m+=190;\n        if(!TextUtils.isEmpty(c.videoId)&&c.videoId.equals(t.videoId))m+=165;\n        int sim=AudifyInstantAlbumMetadata.similarity(wantedTitle,t.title);\n        if(sim==3)m+=82;else if(sim==2)m+=48;else if(sim==1)m+=12;else m-=45;\n        int as=artistScore(wantedArtist,t.artist);\n        if(!TextUtils.isEmpty(wantedArtist)){\n            if(as>0)m+=Math.min(42,as);else if(!TextUtils.isEmpty(t.artist))m-=40;\n        }\n        m+=Math.max(-25,Math.min(35,durationScore(sourceDurationMs,t.durationMs)));\n        return m;\n    }`;
req(oldFind,newFind,'structured album relation');

req(
  'a.title=TextUtils.isEmpty(c.albumName)?"Album":c.albumName;',
  'if(!saneAlbumName(c.albumName))return null;\n        a.title=c.albumName;',
  'final album title sanity'
);

await writeFile(file,s,'utf8');
console.log('Audify V68.15.1: YouTube Music coherence guard applied — structured MPRE relation, sane album names, song-confirmed tracklist shelf.');
