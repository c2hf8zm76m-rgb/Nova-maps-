import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const dsPath=path.join(pkgDir,'AudifyYoutubeDataSourceFactory.java');
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');

function req(src,from,to,label){
  if(!src.includes(from)) throw new Error('V68.15.4 playback continuity/timestamps: missing '+label);
  return src.replace(from,to);
}

// =============================================================================
// 1) YOUTUBE AUDIO RESOLVER — no global network lock, short-lived URLs, retries.
// =============================================================================
let ds=await readFile(dsPath,'utf8');

if(!ds.includes('AUDIFY_V68154_RESOLVER_CONTINUITY')){
  ds=req(
    ds,
    '    private static final String SCHEME = "audifyyt";\n',
    '    private static final String SCHEME = "audifyyt";\n    public static final String CONTINUITY_MARKER = "AUDIFY_V68154_RESOLVER_CONTINUITY";\n',
    'resolver marker anchor'
  );

  // Four minutes was too optimistic for a signed YouTube stream URL and made
  // recovery reuse the same failed URL. 45 seconds is enough for click preheat,
  // while a later retry/transition receives a genuinely fresh stream URL.
  ds=ds.replace(
    'private static final long STREAM_CACHE_TTL_MS = 4L * 60L * 1000L;',
    'private static final long STREAM_CACHE_TTL_MS = 45L * 1000L;'
  );

  const oldCached=`    private static String resolveCachedAudio(String videoId) throws Exception {\n        synchronized (STREAM_CACHE_LOCK) {\n            long now = System.currentTimeMillis();\n            CachedStream cached = STREAM_CACHE.get(videoId);\n            if (cached != null && now - cached.createdAt < STREAM_CACHE_TTL_MS) return cached.url;\n\n            String resolved = resolveAudio(videoId);\n            if (STREAM_CACHE.size() >= 10) STREAM_CACHE.clear();\n            STREAM_CACHE.put(videoId,new CachedStream(resolved,System.currentTimeMillis()));\n            return resolved;\n        }\n    }\n\n`;

  const newCached=`    private static String resolveCachedAudio(String videoId) throws Exception {\n        // Never keep STREAM_CACHE_LOCK while NewPipe performs network I/O.\n        // A slow prefetch must not be able to freeze song 2, 3, 4...\n        synchronized (STREAM_CACHE_LOCK) {\n            long now = System.currentTimeMillis();\n            CachedStream cached = STREAM_CACHE.get(videoId);\n            if (cached != null && now - cached.createdAt < STREAM_CACHE_TTL_MS) return cached.url;\n            if (cached != null) STREAM_CACHE.remove(videoId);\n        }\n\n        String resolved = resolveAudioWithRetryV68154(videoId);\n        synchronized (STREAM_CACHE_LOCK) {\n            if (STREAM_CACHE.size() >= 10) STREAM_CACHE.clear();\n            STREAM_CACHE.put(videoId,new CachedStream(resolved,System.currentTimeMillis()));\n        }\n        return resolved;\n    }\n\n    public static void invalidate(String videoId) {\n        if (videoId == null || videoId.trim().isEmpty()) return;\n        synchronized (STREAM_CACHE_LOCK) { STREAM_CACHE.remove(videoId.trim()); }\n    }\n\n    public static void invalidateAll() {\n        synchronized (STREAM_CACHE_LOCK) { STREAM_CACHE.clear(); }\n    }\n\n    private static String resolveAudioWithRetryV68154(String videoId) throws Exception {\n        Throwable last = null;\n        for (int attempt=0; attempt<3; attempt++) {\n            try {\n                return resolveAudio(videoId);\n            } catch (Throwable error) {\n                last = error;\n                if (attempt < 2) {\n                    try { Thread.sleep(180L * (attempt + 1L)); }\n                    catch (InterruptedException interrupted) {\n                        Thread.currentThread().interrupt();\n                        throw interrupted;\n                    }\n                }\n            }\n        }\n        if (last instanceof Exception) throw (Exception) last;\n        throw new Exception("Impossible de renouveler le flux YouTube", last);\n    }\n\n`;
  ds=req(ds,oldCached,newCached,'non-blocking stream cache');
}
await writeFile(dsPath,ds,'utf8');

// =============================================================================
// 2) MEDIA3 SERVICE — recover READY freezes and force a fresh MediaSource.
// =============================================================================
let service=await readFile(servicePath,'utf8');

if(!service.includes('AUDIFY_V68154_PLAYBACK_CONTINUITY')){
  service=req(
    service,
    '    private static final long STALL_RECOVERY_MS = 15000L;',
    '    private static final String PLAYBACK_CONTINUITY_MARKER = "AUDIFY_V68154_PLAYBACK_CONTINUITY";\n    private static final long STALL_RECOVERY_MS = 10000L;',
    'playback continuity marker'
  );
  service=service.replace('private static final int MAX_RECOVERY_ATTEMPTS = 4;','private static final int MAX_RECOVERY_ATTEMPTS = 3;');

  // A transition is a clean playback generation. Never carry a poisoned
  // recovery counter/error from the previous track into the next one.
  const oldTransition=`            public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {\n                snapshotVideoId = mediaItem == null ? "" : mediaItem.mediaId;\n                snapshotError = "";\n                updateSnapshot();\n            }`;
  const newTransition=`            public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {\n                snapshotVideoId = mediaItem == null ? "" : mediaItem.mediaId;\n                snapshotError = "";\n                snapshotLoading = false;\n                recoveryAttempts = 0;\n                recoveryScheduled = false;\n                lastProgressPositionMs = -1L;\n                lastProgressClockMs = SystemClock.elapsedRealtime();\n                updateSnapshot();\n            }`;
  service=req(service,oldTransition,newTransition,'media transition reset');

  // Recovery previously stopped/prepared the SAME resolved media source. When
  // a signed URL or resolver generation was bad this simply replayed the fault.
  const oldRecoveryTry=`        try {\n            player.stop();\n            player.seekTo(index, position);\n            player.prepare();\n            player.play();\n        } catch (Throwable error) {`;
  const newRecoveryTry=`        try {\n            forceFreshMediaTimelineV68154(index, position);\n        } catch (Throwable error) {`;
  service=req(service,oldRecoveryTry,newRecoveryTry,'fresh-source recovery');

  const watchMarker='    private void watchForPlaybackStall() {';
  const freshHelper=`    private void forceFreshMediaTimelineV68154(int wantedIndex,long wantedPosition) {\n        if (player == null || player.getMediaItemCount() == 0) return;\n        int count=player.getMediaItemCount();\n        int index=Math.max(0,Math.min(wantedIndex,count-1));\n        MediaItem current=player.getMediaItemAt(index);\n        String id=current==null ? "" : current.mediaId;\n        if (id!=null && !id.isEmpty()) AudifyYoutubeDataSourceFactory.invalidate(id);\n\n        // Rebuilding the timeline recreates MediaSources/ResolvingDataSources.\n        // This guarantees the next prepare cannot reuse the failed resolved URL.\n        ArrayList<MediaItem> fresh=new ArrayList<>();\n        for(int i=0;i<count;i++) fresh.add(player.getMediaItemAt(i));\n        player.stop();\n        player.setMediaItems(fresh,index,Math.max(0L,wantedPosition));\n        player.setRepeatMode(snapshotRepeatOne ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);\n        snapshotLoading=true;\n        player.prepare();\n        player.play();\n    }\n\n    private void skipBrokenCurrentAndContinueV68154(String reason) {\n        if (player == null || player.getMediaItemCount() == 0) return;\n        int index=player.getCurrentMediaItemIndex();\n        if(index>=0 && index<player.getMediaItemCount()) {\n            MediaItem item=player.getMediaItemAt(index);\n            if(item!=null) AudifyYoutubeDataSourceFactory.invalidate(item.mediaId);\n        }\n        if (player.hasNextMediaItem()) {\n            recoveryAttempts=0;\n            recoveryScheduled=false;\n            snapshotError="";\n            snapshotLoading=true;\n            lastProgressPositionMs=-1L;\n            lastProgressClockMs=SystemClock.elapsedRealtime();\n            goNext();\n        } else {\n            snapshotLoading=false;\n            snapshotError="Flux indisponible après plusieurs relances";\n            updateSnapshot();\n        }\n    }\n\n`;
  service=req(service,watchMarker,freshHelper+watchMarker,'fresh timeline helper');

  const oldAdvancing=`        boolean shouldBeAdvancing = player.getPlayWhenReady()\n            && (state == Player.STATE_BUFFERING || state == Player.STATE_IDLE);`;
  const newAdvancing=`        boolean shouldBeAdvancing = player.getPlayWhenReady()\n            && (state == Player.STATE_BUFFERING || state == Player.STATE_IDLE\n                || (state == Player.STATE_READY && !player.isPlaying()));`;
  service=req(service,oldAdvancing,newAdvancing,'READY freeze watchdog');

  // If the same track is truly broken, do not leave the whole player dead.
  // After three fresh-source attempts, continue with the next queued track.
  const scheduleStart=service.indexOf('    private void schedulePlaybackRecovery(String reason) {');
  const recoverStart=service.indexOf('    private void recoverCurrentPlayback(String reason) {');
  if(scheduleStart<0 || recoverStart<0) throw new Error('V68.15.4: recovery methods not found');
  let scheduleBlock=service.slice(scheduleStart,recoverStart);
  scheduleBlock=scheduleBlock.replace(
    '        if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) return;',
    '        if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) { skipBrokenCurrentAndContinueV68154(reason); return; }'
  );
  service=service.slice(0,scheduleStart)+scheduleBlock+service.slice(recoverStart);

  const recoverStart2=service.indexOf('    private void recoverCurrentPlayback(String reason) {');
  const freshStart=service.indexOf('    private void forceFreshMediaTimelineV68154',recoverStart2);
  if(freshStart<0) throw new Error('V68.15.4: fresh helper ordering invalid');
  let recoverBlock=service.slice(recoverStart2,freshStart);
  recoverBlock=recoverBlock.replace(
    '        if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) return;',
    '        if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) { skipBrokenCurrentAndContinueV68154(reason); return; }'
  );
  service=service.slice(0,recoverStart2)+recoverBlock+service.slice(freshStart);
}
await writeFile(servicePath,service,'utf8');

// =============================================================================
// 3) PLAYER UI — elapsed time on the left, exact total duration on the right.
// =============================================================================
let player=await readFile(playerPath,'utf8');

if(!player.includes('AUDIFY_V68154_PLAYER_TIMESTAMPS')){
  const classMarker='public class NativePlayerActivity extends AppCompatActivity {';
  player=req(
    player,
    classMarker,
    classMarker+'\n    private static final String TIMESTAMP_MARKER = "AUDIFY_V68154_PLAYER_TIMESTAMPS";',
    'player class marker'
  );

  const timelineField='    private SeekBar timeline;\n';
  player=req(
    player,
    timelineField,
    timelineField+'    private TextView elapsedTimeV68154;\n    private TextView totalTimeV68154;\n',
    'timeline field'
  );

  const handlerMarker='    private final Handler uiHandler = new Handler(Looper.getMainLooper());\n';
  const timestampTicker=`    private final Runnable timestampTickerV68154 = new Runnable() {\n        @Override public void run() {\n            refreshTimestampsV68154();\n            uiHandler.postDelayed(this,250L);\n        }\n    };\n`;
  player=req(player,handlerMarker,handlerMarker+timestampTicker,'timestamp ticker');

  const timelineAdd='        timelineShell.addView(timeline,new LinearLayout.LayoutParams(0,dp(42),1f));';
  const timelineWithTimes=`        elapsedTimeV68154=new TextView(this);\n        elapsedTimeV68154.setText("0:00");\n        elapsedTimeV68154.setTextColor(Color.rgb(211,218,228));\n        elapsedTimeV68154.setTextSize(11.5f);\n        elapsedTimeV68154.setGravity(Gravity.CENTER);\n        elapsedTimeV68154.setSingleLine(true);\n        elapsedTimeV68154.setTypeface(android.graphics.Typeface.MONOSPACE,android.graphics.Typeface.BOLD);\n        timelineShell.addView(elapsedTimeV68154,new LinearLayout.LayoutParams(dp(43),dp(42)));\n\n        LinearLayout.LayoutParams seekTimeLpV68154=new LinearLayout.LayoutParams(0,dp(42),1f);\n        seekTimeLpV68154.leftMargin=dp(3);\n        seekTimeLpV68154.rightMargin=dp(3);\n        timelineShell.addView(timeline,seekTimeLpV68154);\n\n        totalTimeV68154=new TextView(this);\n        totalTimeV68154.setText("--:--");\n        totalTimeV68154.setTextColor(Color.rgb(211,218,228));\n        totalTimeV68154.setTextSize(11.5f);\n        totalTimeV68154.setGravity(Gravity.CENTER);\n        totalTimeV68154.setSingleLine(true);\n        totalTimeV68154.setTypeface(android.graphics.Typeface.MONOSPACE,android.graphics.Typeface.BOLD);\n        timelineShell.addView(totalTimeV68154,new LinearLayout.LayoutParams(dp(47),dp(42)));`;
  player=req(player,timelineAdd,timelineWithTimes,'timeline timestamp layout');

  const emptyProgress='            @Override public void onProgressChanged(SeekBar s,int p,boolean fromUser){}';
  const previewProgress=`            @Override public void onProgressChanged(SeekBar s,int p,boolean fromUser){\n                if(fromUser && elapsedTimeV68154!=null){\n                    double preview=Math.max(0.0,lastDurationSeconds)*(p/1000.0);\n                    elapsedTimeV68154.setText(formatTimeV68154(preview));\n                }\n            }`;
  player=req(player,emptyProgress,previewProgress,'seek timestamp preview');

  const helperMarker='    private LinearLayout.LayoutParams weighted() {';
  const timestampHelpers=`    private void refreshTimestampsV68154() {\n        try {\n            JSONObject state=new JSONObject(AudifyPlaybackService.getStateJson());\n            double position=Math.max(0.0,state.optDouble("position",0.0));\n            double duration=Math.max(0.0,state.optDouble("duration",0.0));\n            if(totalTimeV68154!=null) totalTimeV68154.setText(duration>0.0 ? formatTimeV68154(duration) : "--:--");\n            if(!userSeeking && elapsedTimeV68154!=null) elapsedTimeV68154.setText(formatTimeV68154(position));\n        } catch(Throwable ignored) {}\n    }\n\n    private String formatTimeV68154(double rawSeconds) {\n        long total=Math.max(0L,(long)Math.floor(rawSeconds));\n        long hours=total/3600L;\n        long minutes=(total%3600L)/60L;\n        long seconds=total%60L;\n        if(hours>0L) return String.format(java.util.Locale.ROOT,"%d:%02d:%02d",hours,minutes,seconds);\n        return String.format(java.util.Locale.ROOT,"%d:%02d",minutes,seconds);\n    }\n\n`;
  player=req(player,helperMarker,timestampHelpers+helperMarker,'timestamp helpers');

  // Reuse the already established Activity lifecycle of the normal UI ticker.
  const startTicker='        uiHandler.post(uiTicker);';
  player=req(
    player,
    startTicker,
    startTicker+'\n        uiHandler.removeCallbacks(timestampTickerV68154);\n        uiHandler.post(timestampTickerV68154);',
    'timestamp lifecycle start'
  );

  // There can be several cleanup points; every normal UI ticker cleanup also
  // stops the timestamp ticker, so no hidden 250ms loop survives the player UI.
  player=player.replaceAll(
    '        uiHandler.removeCallbacks(uiTicker);',
    '        uiHandler.removeCallbacks(uiTicker);\n        uiHandler.removeCallbacks(timestampTickerV68154);'
  );
}
await writeFile(playerPath,player,'utf8');

console.log('Audify V68.15.4: playback continuity hardened (non-blocking resolver, fresh-source recovery, READY stall watchdog) + elapsed/total timestamps added to the main player.');
