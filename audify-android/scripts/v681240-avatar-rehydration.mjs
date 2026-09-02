import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const generated=path.join(root,'android/app/src/main/java/com/nova/audify');
const sources=path.join(root,'firebase/src/com/nova/audify');

function insertOnce(source,anchor,text,label){
  if(source.includes(text.trim())) return source;
  const at=source.indexOf(anchor);
  if(at<0) throw new Error(`V68.12.40 ancre introuvable: ${label}`);
  return source.slice(0,at)+text+source.slice(at);
}
function replaceOnce(source,from,to,label){
  if(!source.includes(from)) throw new Error(`V68.12.40 remplacement introuvable: ${label}`);
  return source.replace(from,to);
}

async function patchAvatar(file){
  let src=await readFile(file,'utf8');
  src=src.replace('import java.util.UUID;','import java.util.UUID;\nimport java.util.HashSet;\nimport java.util.Set;');
  src=insertOnce(src,'    private long retryAfter=0;','    private final Set<Runnable> listeners=new HashSet<>();\n','listeners avatar');
  src=insertOnce(src,'    /** Transport readiness, not merely presence of a local fallback portrait. */',`    public synchronized void addListener(Runnable listener){if(listener!=null)listeners.add(listener);}\n    public synchronized void removeListener(Runnable listener){listeners.remove(listener);}\n    private void changed(){java.util.ArrayList<Runnable> copy; synchronized(this){copy=new java.util.ArrayList<>(listeners);} main.post(()->{for(Runnable listener:copy)try{listener.run();}catch(Throwable ignored){}});}\n\n`,'API listeners avatar');
  src=src.replace('        return path.isEmpty()||(path.equals(p.getString("localPath",""))&&local(uid,ext).isFile());',
    '        if(path.isEmpty())return true;\n        File cached=local(uid,ext);\n        if(cached.isFile()&&cached.length()>0L){if(!path.equals(p.getString("localPath","")))p.edit().putString("localPath",path).apply();return true;}\n        return false;');
  src=src.replace('        message="Suppression de l’avatar en attente du cloud";retryAfter=0;return true;',
    '        message="Suppression de l’avatar en attente du cloud";retryAfter=0;changed();return true;');
  src=src.replace('if(saved){p.edit().remove("pending").remove("pendingFile").putString("localPath",path).commit();file.delete();message="Avatar envoyé ; synchronisation du profil en cours";}',
    'if(saved){p.edit().remove("pending").remove("pendingFile").putString("localPath",path).commit();file.delete();message="Avatar envoyé ; synchronisation du profil en cours";changed();}');
  src=src.replace('p.edit().putString("localPath",path).commit();message="Avatar disponible dans le cloud";',
    'p.edit().putString("localPath",path).commit();message="Avatar disponible dans le cloud";changed();');
  await writeFile(file,src,'utf8');
}
await patchAvatar(path.join(sources,'AudifyFirebaseAvatar.java'));
await patchAvatar(path.join(generated,'AudifyFirebaseAvatar.java'));

let home=await readFile(path.join(generated,'NativeHomeActivity.java'),'utf8');
home=insertOnce(home,'    private boolean firebaseObserved,firebaseHomeClosing;',
`    private final Runnable avatarCloudRefreshV681240=()->{\n        if(isFinishing()||isDestroyed()||startup==null||!startup.isRevealed()||libraryContent==null)return;\n        long stamp=profilePhotoStampV681226();\n        if(stamp==v681226ProfilePhotoStamp)return;\n        v681226ProfilePhotoStamp=stamp;\n        rebuildLibrary();\n    };\n`,'Home avatar refresh');
home=replaceOnce(home,'        startupArtwork=new AudifyArtworkLoader(images);',
  '        startupArtwork=new AudifyArtworkLoader(images);\n        AudifyFirebaseAvatar.get(this).addListener(avatarCloudRefreshV681240);','register avatar listener');
home=replaceOnce(home,'        if(startupArtwork!=null)startupArtwork.close();\n        images.shutdownNow();super.onDestroy();',
  '        if(startupArtwork!=null)startupArtwork.close();\n        AudifyFirebaseAvatar.get(this).removeListener(avatarCloudRefreshV681240);\n        images.shutdownNow();super.onDestroy();','unregister avatar listener');
await writeFile(path.join(generated,'NativeHomeActivity.java'),home,'utf8');

let gradle=await readFile(path.join(root,'android/app/build.gradle'),'utf8');
gradle=gradle.replace(/versionCode \d+/,'versionCode 681240').replace(/versionName "[^"]+"/,'versionName "68.12.40"');
await writeFile(path.join(root,'android/app/build.gradle'),gradle,'utf8');
console.log('Audify V68.12.40 : avatar cloud réhydraté après téléchargement, signal de rafraîchissement Home et migration du cache local.');

