import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const file=path.join(root,'android','app','src','main','java','com','nova','audify','AudifyYoutubeMusicAlbumResolver.java');
let s=await readFile(file,'utf8');

function req(a,b,label){
  if(!s.includes(a)) throw new Error('V68.15.2 session stability: missing '+label);
  s=s.replace(a,b);
}

req(
  'static final String COHERENCE_MARKER="AUDIFY_V68151_YTMUSIC_COHERENCE_GUARD";',
  'static final String COHERENCE_MARKER="AUDIFY_V68151_YTMUSIC_COHERENCE_GUARD";\n    static final String STABILITY_MARKER="AUDIFY_V68152_YTMUSIC_SESSION_STABILITY";',
  'stability marker'
);

req(
  'private static final Object CONFIG_LOCK=new Object();\n    private static volatile String apiKey="",clientVersion="",visitorData="";\n    private static volatile long configAt;',
  'private static final Object CONFIG_LOCK=new Object();\n    private static final Object NETWORK_PACE_LOCK=new Object();\n    private static volatile String apiKey="",clientVersion="",visitorData="";\n    private static volatile long configAt;\n    private static volatile long lastNetworkAt;',
  'network pacing fields'
);

req(
  'int scans=Math.min(7,candidates.size());',
  'int scans=Math.min(3,candidates.size());',
  'candidate scan cap'
);

req(
`            if(album==null||album.tracks.size()<3)continue;\n\n            int quality=album.tracks.size()>=6?36:album.tracks.size()>=4?22:10;`,
`            if(album==null||album.tracks.size()<3)continue;\n\n            // Strong structural proof: do not keep opening unrelated album candidates.\n            // This dramatically reduces YouTube Music request bursts during normal playback.\n            boolean exactVideo=!TextUtils.isEmpty(sourceVideoId)&&sourceVideoId.equals(c.videoId);\n            if(exactVideo&&album.confidence>=94)return album;\n            if(c.score>=265&&album.confidence>=94)return album;\n\n            int quality=album.tracks.size()>=6?36:album.tracks.size()>=4?22:10;`,
  'early strong result return'
);

const oldPost=`    private static JSONObject post(String endpoint,JSONObject body)throws Exception{\n        ensureConfig();String url=DOMAIN+"/youtubei/v1/"+endpoint+"?alt=json&key="+URLEncoder.encode(apiKey,"UTF-8");\n        HttpURLConnection c=null;try{\n            c=(HttpURLConnection)new URL(url).openConnection();c.setRequestMethod("POST");c.setDoOutput(true);headers(c);c.setRequestProperty("Content-Type","application/json; charset=UTF-8");\n            c.setRequestProperty("Origin",DOMAIN);c.setRequestProperty("Referer",DOMAIN+"/");c.setRequestProperty("X-YouTube-Client-Name","67");c.setRequestProperty("X-YouTube-Client-Version",clientVersion);\n            if(!TextUtils.isEmpty(visitorData))c.setRequestProperty("X-Goog-Visitor-Id",visitorData);\n            c.setConnectTimeout(9000);c.setReadTimeout(14000);byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);c.setFixedLengthStreamingMode(bytes.length);\n            OutputStream out=c.getOutputStream();out.write(bytes);out.close();int code=c.getResponseCode();InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();String raw=in==null?"":read(in);\n            if(code<200||code>=300)throw new java.io.IOException("YTMusic HTTP "+code);return new JSONObject(raw);\n        }finally{if(c!=null)c.disconnect();}\n    }`;

const newPost=`    private static JSONObject post(String endpoint,JSONObject body)throws Exception{\n        java.io.IOException transientError=null;\n        for(int attempt=0;attempt<2;attempt++){\n            if(attempt>0){\n                resetConfig();\n                try{Thread.sleep(520L);}catch(InterruptedException ie){Thread.currentThread().interrupt();}\n            }\n            ensureConfig();\n            paceNetwork();\n            String url=DOMAIN+"/youtubei/v1/"+endpoint+"?alt=json&key="+URLEncoder.encode(apiKey,"UTF-8");\n            HttpURLConnection c=null;\n            try{\n                c=(HttpURLConnection)new URL(url).openConnection();c.setRequestMethod("POST");c.setDoOutput(true);headers(c);c.setRequestProperty("Content-Type","application/json; charset=UTF-8");\n                c.setRequestProperty("Origin",DOMAIN);c.setRequestProperty("Referer",DOMAIN+"/");c.setRequestProperty("X-YouTube-Client-Name","67");c.setRequestProperty("X-YouTube-Client-Version",clientVersion);\n                if(!TextUtils.isEmpty(visitorData))c.setRequestProperty("X-Goog-Visitor-Id",visitorData);\n                c.setConnectTimeout(9000);c.setReadTimeout(14000);byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);c.setFixedLengthStreamingMode(bytes.length);\n                OutputStream out=c.getOutputStream();out.write(bytes);out.close();int code=c.getResponseCode();InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();String raw=in==null?"":read(in);\n                if(code>=200&&code<300)return new JSONObject(raw);\n                java.io.IOException e=new java.io.IOException("YTMusic HTTP "+code);\n                boolean retryable=code==403||code==408||code==429||code>=500;\n                if(attempt==0&&retryable){\n                    transientError=e;\n                    if(code==429)try{Thread.sleep(850L);}catch(InterruptedException ie){Thread.currentThread().interrupt();}\n                    continue;\n                }\n                throw e;\n            }finally{if(c!=null)c.disconnect();}\n        }\n        if(transientError!=null)throw transientError;\n        throw new java.io.IOException("YTMusic temporary failure");\n    }\n\n    private static void paceNetwork(){\n        synchronized(NETWORK_PACE_LOCK){\n            long now=System.currentTimeMillis();\n            long wait=210L-(now-lastNetworkAt);\n            if(wait>0){try{Thread.sleep(wait);}catch(InterruptedException ie){Thread.currentThread().interrupt();}}\n            lastNetworkAt=System.currentTimeMillis();\n        }\n    }\n\n    private static void resetConfig(){\n        synchronized(CONFIG_LOCK){\n            apiKey="";clientVersion="";visitorData="";configAt=0L;\n        }\n    }`;
req(oldPost,newPost,'resilient post');

await writeFile(file,s,'utf8');
console.log('Audify V68.15.2: YouTube Music session stability applied — early strong-result stop, max 3 album probes, paced requests, transient retry with config refresh, no persistent cache.');
