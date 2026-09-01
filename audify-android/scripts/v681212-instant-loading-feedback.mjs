import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');

function replaceRequired(src,from,to,label){
  if(!src.includes(from)) throw new Error('V68.12.12 introuvable: '+label);
  return src.replace(from,to);
}

// -----------------------------------------------------------------------------
// 1) Petit cache de résolution YouTube + préchargement dès ACTION_DOWN.
//    Le but est de gagner le temps entre le toucher et le vrai clic sans lancer
//    plusieurs extractions NewPipe concurrentes pour le même titre.
// -----------------------------------------------------------------------------
const dsPath=path.join(pkgDir,'AudifyYoutubeDataSourceFactory.java');
let ds=await readFile(dsPath,'utf8');

if(!ds.includes('import java.util.HashMap;')){
  ds=ds.replace('import java.util.List;','import java.util.List;\nimport java.util.HashMap;\nimport java.util.HashSet;\nimport java.util.Map;\nimport java.util.Set;');
}

const schemeMarker='    private static final String SCHEME = "audifyyt";\n';
if(!ds.includes('STREAM_CACHE_TTL_MS')){
  ds=replaceRequired(ds,schemeMarker,schemeMarker+`    private static final long STREAM_CACHE_TTL_MS = 4L * 60L * 1000L;\n    private static final Object STREAM_CACHE_LOCK = new Object();\n    private static final Map<String, CachedStream> STREAM_CACHE = new HashMap<>();\n    private static final Set<String> PREFETCHING = new HashSet<>();\n\n    private static final class CachedStream {\n        final String url;\n        final long createdAt;\n        CachedStream(String url,long createdAt){ this.url=url; this.createdAt=createdAt; }\n    }\n`,'cache fields');
}

ds=replaceRequired(
  ds,
  '                String streamUrl = resolveAudio(videoId);',
  '                String streamUrl = resolveCachedAudio(videoId);',
  'resolver cached call'
);

const resolverMarker='    private static String resolveAudio(String videoId) throws Exception {';
if(!ds.includes('public static void prefetch(String videoId)')){
  const helpers=`    public static void prefetch(String videoId) {\n        if (videoId == null || videoId.trim().isEmpty()) return;\n        final String id = videoId.trim();\n        synchronized (STREAM_CACHE_LOCK) {\n            CachedStream cached = STREAM_CACHE.get(id);\n            long now = System.currentTimeMillis();\n            if (cached != null && now - cached.createdAt < STREAM_CACHE_TTL_MS) return;\n            if (PREFETCHING.contains(id)) return;\n            PREFETCHING.add(id);\n        }\n        new Thread(() -> {\n            try { resolveCachedAudio(id); }\n            catch (Throwable ignored) {}\n            finally { synchronized (STREAM_CACHE_LOCK) { PREFETCHING.remove(id); } }\n        }, "audify-preload-" + id).start();\n    }\n\n    private static String resolveCachedAudio(String videoId) throws Exception {\n        synchronized (STREAM_CACHE_LOCK) {\n            long now = System.currentTimeMillis();\n            CachedStream cached = STREAM_CACHE.get(videoId);\n            if (cached != null && now - cached.createdAt < STREAM_CACHE_TTL_MS) return cached.url;\n\n            String resolved = resolveAudio(videoId);\n            if (STREAM_CACHE.size() >= 10) STREAM_CACHE.clear();\n            STREAM_CACHE.put(videoId,new CachedStream(resolved,now));\n            return resolved;\n        }\n    }\n\n`;
  ds=replaceRequired(ds,resolverMarker,helpers+resolverMarker,'prefetch helpers');
}
await writeFile(dsPath,ds,'utf8');

// -----------------------------------------------------------------------------
// 2) Service Media3 : nouvelle action légère de préchargement.
// -----------------------------------------------------------------------------
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
let service=await readFile(servicePath,'utf8');

if(!service.includes('ACTION_PREFETCH')){
  service=replaceRequired(
    service,
    '    public static final String ACTION_LOAD = "com.nova.audify.LOAD";\n',
    '    public static final String ACTION_LOAD = "com.nova.audify.LOAD";\n    public static final String ACTION_PREFETCH = "com.nova.audify.PREFETCH";\n',
    'ACTION_PREFETCH constant'
  );
}

if(!service.includes('AudifyYoutubeDataSourceFactory.prefetch')){
  service=replaceRequired(
    service,
    '            if (ACTION_SET_QUEUE.equals(action)) {',
    '            if (ACTION_PREFETCH.equals(action)) {\n                AudifyYoutubeDataSourceFactory.prefetch(intent.getStringExtra(EXTRA_VIDEO_ID));\n            } else if (ACTION_SET_QUEUE.equals(action)) {',
    'ACTION_PREFETCH handler'
  );
}
await writeFile(servicePath,service,'utf8');

// -----------------------------------------------------------------------------
// 3) Recherche : préchargement au doigt posé, avant ACTION_UP / onClick.
// -----------------------------------------------------------------------------
const mainPath=path.join(pkgDir,'MainActivity.java');
let main=await readFile(mainPath,'utf8');

if(!main.includes('ACTION_PREFETCH).putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID, item.id)')){
  const focusMarker='            card.setFocusable(true);\n';
  const touch=`            card.setOnTouchListener((view,event) -> {\n                if (event.getActionMasked() == android.view.MotionEvent.ACTION_DOWN) {\n                    try {\n                        startService(new android.content.Intent(this,AudifyPlaybackService.class)\n                            .setAction(AudifyPlaybackService.ACTION_PREFETCH)\n                            .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,item.id));\n                    } catch (Throwable ignored) {}\n                }\n                return false;\n            });\n`;
  main=replaceRequired(main,focusMarker,focusMarker+touch,'prefetch sur carte recherche');
}

if(!main.includes('.putExtra("autoplayRequested", true)')){
  main=replaceRequired(
    main,
    '            startActivity(new android.content.Intent(this, NativePlayerActivity.class)\n                .putExtra("videoId", chosen.id)',
    '            startActivity(new android.content.Intent(this, NativePlayerActivity.class)\n                .putExtra("autoplayRequested", true)\n                .putExtra("videoId", chosen.id)',
    'flag autoplay lecteur'
  );
}
await writeFile(mainPath,main,'utf8');

// -----------------------------------------------------------------------------
// 4) Grand lecteur : feedback instantané pendant la résolution/buffering.
// -----------------------------------------------------------------------------
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
let player=await readFile(playerPath,'utf8');

if(!player.includes('loadingStatusV681212')){
  player=replaceRequired(
    player,
    '    private TextView artistView;\n',
    '    private TextView artistView;\n    private TextView loadingStatusV681212;\n    private boolean loadingV681212 = false;\n    private boolean autoplayWaitingV681212 = false;\n    private int loadingFrameV681212 = 0;\n',
    'champs loading UI'
  );

  const handlerMarker='    private final Handler uiHandler = new Handler(Looper.getMainLooper());\n';
  const ticker=`    private final Runnable loadingTickerV681212 = new Runnable() {\n        @Override public void run() {\n            updateLoadingFeedbackV681212();\n            uiHandler.postDelayed(this, 140L);\n        }\n    };\n`;
  player=replaceRequired(player,handlerMarker,handlerMarker+ticker,'loading ticker');

  const artistAnchor='        content.addView(artistView,artistLp);\n';
  const status=`\n        loadingStatusV681212=new TextView(this);\n        loadingStatusV681212.setText("◐  Chargement du morceau…");\n        loadingStatusV681212.setTextColor(Color.rgb(168,255,63));\n        loadingStatusV681212.setTextSize(13.5f);\n        loadingStatusV681212.setGravity(Gravity.CENTER);\n        loadingStatusV681212.setTypeface(loadingStatusV681212.getTypeface(),android.graphics.Typeface.BOLD);\n        loadingStatusV681212.setVisibility(View.GONE);\n        LinearLayout.LayoutParams loadingLpV681212=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(34));\n        loadingLpV681212.bottomMargin=dp(4);\n        content.addView(loadingStatusV681212,loadingLpV681212);\n`;
  player=replaceRequired(player,artistAnchor,artistAnchor+status,'status sous artiste');

  player=replaceRequired(
    player,
    '        setContentView(root);\n        loadArtwork(currentTrack.thumbnail,currentTrack.id);',
    '        setContentView(root);\n        autoplayWaitingV681212 = source != null && source.getBooleanExtra("autoplayRequested",false);\n        if (autoplayWaitingV681212) applyLoadingFeedbackV681212(true);\n        loadArtwork(currentTrack.thumbnail,currentTrack.id);',
    'feedback immédiat onCreate'
  );

  player=replaceRequired(
    player,
    '    private void applyPlayState(boolean playing) {\n',
    '    private void applyPlayState(boolean playing) {\n        if (loadingV681212) { lastPlaying = playing; return; }\n',
    'protection bouton pendant loading'
  );

  const helperMarker='    private LinearLayout.LayoutParams weighted() {';
  const helpers=`    private void applyLoadingFeedbackV681212(boolean loading) {\n        loadingV681212 = loading;\n        if (playPauseButton != null) {\n            playPauseButton.setEnabled(!loading);\n            playPauseButton.setAlpha(loading ? 0.94f : 1f);\n            if (loading) {\n                String[] frames={"◐","◓","◑","◒"};\n                String frame=frames[loadingFrameV681212++ % frames.length];\n                playPauseButton.setText(frame);\n                playPauseButton.setContentDescription("Chargement du morceau en cours");\n            } else {\n                applyPlayState(lastPlaying);\n            }\n        }\n        if (loadingStatusV681212 != null) {\n            if (loading) {\n                String[] frames={"◐","◓","◑","◒"};\n                String frame=frames[loadingFrameV681212 % frames.length];\n                loadingStatusV681212.setText(frame + "  Chargement du morceau…");\n                loadingStatusV681212.setVisibility(View.VISIBLE);\n            } else {\n                loadingStatusV681212.setVisibility(View.GONE);\n            }\n        }\n    }\n\n    private void updateLoadingFeedbackV681212() {\n        try {\n            JSONObject state=new JSONObject(AudifyPlaybackService.getStateJson());\n            String stateVideoId=state.optString("videoId","");\n            boolean same=currentTrack!=null && currentTrack.id!=null && currentTrack.id.equals(stateVideoId);\n            boolean playing=state.optBoolean("playing",false);\n            boolean buffering=state.optBoolean("loading",false);\n            String error=state.optString("error","");\n\n            if (same && playing) autoplayWaitingV681212=false;\n            if (same && error!=null && !error.isEmpty() && !buffering) autoplayWaitingV681212=false;\n            boolean show=same && (buffering || autoplayWaitingV681212);\n            applyLoadingFeedbackV681212(show);\n        } catch (Throwable ignored) {\n            if (autoplayWaitingV681212) applyLoadingFeedbackV681212(true);\n        }\n    }\n\n`;
  player=replaceRequired(player,helperMarker,helpers+helperMarker,'helpers loading');

  player=replaceRequired(
    player,
    '        uiHandler.post(uiTicker);',
    '        uiHandler.post(uiTicker);\n        uiHandler.removeCallbacks(loadingTickerV681212);\n        uiHandler.post(loadingTickerV681212);',
    'start loading ticker'
  );
  player=replaceRequired(
    player,
    '        uiHandler.removeCallbacks(uiTicker);\n        super.onStop();',
    '        uiHandler.removeCallbacks(uiTicker);\n        uiHandler.removeCallbacks(loadingTickerV681212);\n        super.onStop();',
    'stop loading ticker'
  );
}
await writeFile(playerPath,player,'utf8');

console.log('Audify V68.12.12 : feedback instantané de chargement + préchargement au toucher + cache court des flux.');
