import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const metaPath=path.join(pkgDir,'AudifyInstantAlbumMetadata.java');
const applePath=path.join(pkgDir,'AudifyAppleReleaseGraphResolver.java');

function mustReplace(src,from,to,label){
  if(!src.includes(from)) throw new Error('V68.16.6: missing '+label);
  return src.replace(from,to);
}
function mustRegex(src,re,to,label){
  if(!re.test(src)) throw new Error('V68.16.6: missing '+label);
  return src.replace(re,to);
}

// -----------------------------------------------------------------------------
// Fast Proof Pipeline: Apple Release Graph and Deezer Discography are independent
// proofs. Run them concurrently and return as soon as one produces the same
// already-required canonical multi-track album proof. No confidence gates are
// weakened and no artist/song/album mapping is hardcoded.
// -----------------------------------------------------------------------------
let meta=await readFile(metaPath,'utf8');

const markerAnchor='    static final String DIAGNOSTIC_MARKER="AUDIFY_V68164_ALBUM_DIAGNOSTIC_TRACE";';
if(!meta.includes('AUDIFY_V68166_FAST_PROOF_PIPELINE')){
  meta=mustReplace(
    meta,
    markerAnchor,
    markerAnchor+'\n    static final String FAST_PROOF_MARKER="AUDIFY_V68166_FAST_PROOF_PIPELINE";\n    static final String PARALLEL_PROOF_MARKER="AUDIFY_V68166_PARALLEL_RELEASE_PROOFS";\n    static final String BOUNDED_WAIT_MARKER="AUDIFY_V68166_BOUNDED_PROOF_WAIT";',
    'metadata marker anchor'
  );
}

const parallel=String.raw`        debug("FAST_PROOF_PIPELINE_START parallel Apple+Deezer");
        final String proofTitle=title,proofArtist=artist,proofHint=hint;
        final long proofDuration=durationMs;
        java.util.concurrent.ThreadFactory daemonFactory=r->{Thread t=new Thread(r,"audify-release-proof");t.setDaemon(true);return t;};
        java.util.concurrent.ExecutorService proofPool=java.util.concurrent.Executors.newFixedThreadPool(2,daemonFactory);
        java.util.concurrent.CompletionService<Album> proofCompletion=new java.util.concurrent.ExecutorCompletionService<>(proofPool);
        java.util.ArrayList<java.util.concurrent.Future<Album>> proofTasks=new java.util.ArrayList<>();
        proofTasks.add(proofCompletion.submit(()->{
            try{
                debug("APPLE_GRAPH_START_PARALLEL");
                Album a=AudifyAppleReleaseGraphResolver.identify(proofTitle,proofArtist,proofDuration,proofHint);
                if(a!=null&&a.tracks.size()>=4&&a.confidence>=90){debug("APPLE_GRAPH_ACCEPT "+diagSafe(a.title)+" tracks="+a.tracks.size()+" conf="+a.confidence);return a;}
                debug("APPLE_GRAPH_RETURNED_NULL_OR_WEAK");
            }catch(Throwable e){debug("APPLE_GRAPH_ERROR "+e.getClass().getSimpleName()+": "+diagSafe(e.getMessage()));}
            return null;
        }));
        proofTasks.add(proofCompletion.submit(()->{
            try{
                debug("DEEZER_DISCOGRAPHY_START_PARALLEL");
                Album d=AudifyReleasePreferenceResolver.identify(proofTitle,proofArtist,proofDuration,proofHint);
                if(d!=null&&d.tracks.size()>=4&&d.confidence>=90){debug("DEEZER_DISCOGRAPHY_ACCEPT "+diagSafe(d.title)+" tracks="+d.tracks.size()+" conf="+d.confidence);return d;}
                debug("DEEZER_DISCOGRAPHY_RETURNED_NULL_OR_WEAK");
            }catch(Throwable e){debug("DEEZER_DISCOGRAPHY_ERROR "+e.getClass().getSimpleName()+": "+diagSafe(e.getMessage()));}
            return null;
        }));
        try{
            long deadline=android.os.SystemClock.elapsedRealtime()+8500L;
            int completed=0;
            while(completed<2){
                long remaining=deadline-android.os.SystemClock.elapsedRealtime();
                if(remaining<=0L){debug("FAST_PROOF_TIMEOUT completed="+completed);break;}
                java.util.concurrent.Future<Album> f=proofCompletion.poll(remaining,java.util.concurrent.TimeUnit.MILLISECONDS);
                if(f==null){debug("FAST_PROOF_TIMEOUT completed="+completed);break;}
                completed++;
                Album candidate=null;
                try{candidate=f.get();}catch(Throwable e){debug("FAST_PROOF_FUTURE_ERROR "+e.getClass().getSimpleName()+": "+diagSafe(e.getMessage()));}
                if(candidate!=null&&candidate.tracks.size()>=4&&candidate.confidence>=90){
                    debug("FAST_PROOF_ACCEPT "+diagSafe(candidate.title)+" completed="+completed);
                    for(java.util.concurrent.Future<Album> task:proofTasks)try{task.cancel(true);}catch(Throwable ignored){}
                    return candidate;
                }
            }
        }catch(InterruptedException e){Thread.currentThread().interrupt();debug("FAST_PROOF_INTERRUPTED");}
        finally{
            for(java.util.concurrent.Future<Album> task:proofTasks)try{task.cancel(true);}catch(Throwable ignored){}
            proofPool.shutdownNow();
        }
        debug("FINAL_REJECT no reliable multi-track canonical album");
        return null;`;

// The diagnostic patch has changed whitespace/nearby branches over time, so use
// the stable runtime markers rather than one historical full-text block.
const proofRange=/        try\s*\{[\s\S]*?debug\("APPLE_GRAPH_START"\);[\s\S]*?debug\("FINAL_REJECT no reliable multi-track canonical album"\);\s*return null;/;
meta=mustRegex(meta,proofRange,parallel,'Apple-to-final proof range');
await writeFile(metaPath,meta,'utf8');

// -----------------------------------------------------------------------------
// Apple hint-first optimization: preserve deterministic query order and stop
// immediately after a canonical exact album+artist seed is found. This avoids
// making the remaining broad album searches when the official description has
// already named the release, while the existing tracklist verification remains
// mandatory before acceptance.
// -----------------------------------------------------------------------------
let apple=await readFile(applePath,'utf8');
const appleMarker='    static final String HINT_FIRST_MARKER="AUDIFY_V68165_APPLE_HINT_FIRST_LOOKUP";';
if(!apple.includes('AUDIFY_V68166_APPLE_HINT_EARLY_STOP')){
  apple=mustReplace(
    apple,
    appleMarker,
    appleMarker+'\n    static final String HINT_EARLY_STOP_MARKER="AUDIFY_V68166_APPLE_HINT_EARLY_STOP";',
    'Apple marker anchor'
  );
}

apple=mustRegex(
  apple,
  /        Set<String> queries=new HashSet<>\(\);\s*queries\.add\(hint\+" "\+artist\);\s*queries\.add\(artist\+" "\+hint\);\s*queries\.add\(hint\);/,
  '        Set<String> queries=new java.util.LinkedHashSet<>();\n        queries.add(hint+" "+artist);\n        queries.add(artist+" "+hint);\n        queries.add(hint);',
  'ordered hint queries'
);

const methodStart=apple.indexOf('    private static void collectHintAlbumSeeds(');
const methodEnd=apple.indexOf('    private static boolean hasStrongAlbumSeed',methodStart);
if(methodStart<0||methodEnd<0)throw new Error('V68.16.6: Apple hint method range missing');
let method=apple.slice(methodStart,methodEnd);
method=mustRegex(
  method,
  /\n\s*if\(!unique\.isEmpty\(\)\)break;/,
  '\n                for(Seed exact:unique.values()){\n                    if(norm(exact.collectionName).equals(norm(hint))&&artistMatch(artist,exact.artist)){\n                        AudifyInstantAlbumMetadata.debug("APPLE_HINT_EXACT_EARLY_STOP "+exact.collectionName+" | artist="+exact.artist);\n                        return;\n                    }\n                }\n            if(!unique.isEmpty())break;',
  'exact hint early stop'
);
apple=apple.slice(0,methodStart)+method+apple.slice(methodEnd);
await writeFile(applePath,apple,'utf8');

console.log('Audify V68.16.6: Fast Proof Pipeline enabled — Apple and Deezer proofs run in parallel, exact official album hints stop broad Apple searches early, and all canonical album/tracklist/confidence guards remain unchanged.');
