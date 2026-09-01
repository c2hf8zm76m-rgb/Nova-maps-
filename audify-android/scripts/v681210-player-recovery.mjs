import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
const mainPath=path.join(pkgDir,'MainActivity.java');

function replaceRequired(src,from,to,label){
  if(!src.includes(from)) throw new Error('V68.12.10 introuvable: '+label);
  return src.replace(from,to);
}

let service=await readFile(servicePath,'utf8');

if(!service.includes('import android.os.SystemClock;')){
  service=service.replace('import android.os.Looper;','import android.os.Looper;\nimport android.os.SystemClock;');
}

const fieldMarker='    private int queueIndexHint = -1;\n';
if(!service.includes('private static final long STALL_RECOVERY_MS')){
  service=replaceRequired(service,fieldMarker,fieldMarker+`
    private static final long STALL_RECOVERY_MS = 15000L;
    private static final long RECOVERY_COOLDOWN_MS = 3500L;
    private static final int MAX_RECOVERY_ATTEMPTS = 4;
    private long lastProgressPositionMs = -1L;
    private long lastProgressClockMs = 0L;
    private long lastRecoveryClockMs = 0L;
    private int recoveryAttempts = 0;
    private boolean recoveryScheduled = false;
`,'champs recovery');
}

service=replaceRequired(
  service,
  '            updateSnapshot();\n            if (mainHandler != null) mainHandler.postDelayed(this, 200);',
  '            updateSnapshot();\n            watchForPlaybackStall();\n            if (mainHandler != null) mainHandler.postDelayed(this, 200);',
  'watchdog ticker'
);

service=replaceRequired(
  service,
  '                if (state == Player.STATE_READY || state == Player.STATE_ENDED) snapshotLoading = false;\n                updateSnapshot();',
  '                if (state == Player.STATE_READY || state == Player.STATE_ENDED) snapshotLoading = false;\n                if (state == Player.STATE_READY && player != null && player.isPlaying()) { recoveryAttempts = 0; snapshotError = ""; }\n                updateSnapshot();',
  'listener playback state'
);

service=replaceRequired(
  service,
  '                snapshotError = error.getMessage() == null ? "Erreur de lecture native" : error.getMessage();\n                updateSnapshot();',
  '                snapshotError = error.getMessage() == null ? "Erreur de lecture native" : error.getMessage();\n                updateSnapshot();\n                schedulePlaybackRecovery("player_error");',
  'listener player error'
);

service=replaceRequired(
  service,
  '            } else if (ACTION_TOGGLE.equals(action)) {\n                if (player != null) {\n                    if (player.isPlaying()) player.pause(); else player.play();\n                }\n            } else if (ACTION_PLAY.equals(action)) {\n                if (player != null) player.play();',
  '            } else if (ACTION_TOGGLE.equals(action)) {\n                if (player != null) {\n                    if (player.getPlayWhenReady()) player.pause(); else ensurePlayableAndPlay();\n                }\n            } else if (ACTION_PLAY.equals(action)) {\n                ensurePlayableAndPlay();',
  'actions play toggle'
);

service=replaceRequired(
  service,
  '        snapshotError = "";\n\n        int index = -1;',
  '        snapshotError = "";\n        recoveryAttempts = 0;\n        recoveryScheduled = false;\n        lastProgressPositionMs = -1L;\n        lastProgressClockMs = SystemClock.elapsedRealtime();\n\n        int index = -1;',
  'reset recovery nouveau titre'
);

const helperMarker='    private void goNext() {';
if(!service.includes('private void ensurePlayableAndPlay()')){
  const helpers=`
    private void ensurePlayableAndPlay() {
        if (player == null || player.getMediaItemCount() == 0) return;
        snapshotError = "";
        int state = player.getPlaybackState();
        if (state == Player.STATE_IDLE || player.getPlayerError() != null) {
            snapshotLoading = true;
            try {
                player.prepare();
            } catch (Throwable ignored) {}
        }
        try {
            player.play();
        } catch (Throwable ignored) {
            schedulePlaybackRecovery("manual_play_failed");
        }
        updateSnapshot();
    }

    private void schedulePlaybackRecovery(String reason) {
        if (player == null || mainHandler == null || recoveryScheduled) return;
        if (player.getMediaItemCount() == 0) return;
        long now = SystemClock.elapsedRealtime();
        if (now - lastRecoveryClockMs < RECOVERY_COOLDOWN_MS) return;
        if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) return;
        recoveryScheduled = true;
        mainHandler.postDelayed(() -> {
            recoveryScheduled = false;
            recoverCurrentPlayback(reason);
        }, 550L);
    }

    private void recoverCurrentPlayback(String reason) {
        if (player == null || player.getMediaItemCount() == 0) return;
        long now = SystemClock.elapsedRealtime();
        if (now - lastRecoveryClockMs < RECOVERY_COOLDOWN_MS) return;
        if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) return;

        int index = player.getCurrentMediaItemIndex();
        if (index < 0 || index >= player.getMediaItemCount()) index = 0;
        long position = Math.max(0L, player.getCurrentPosition());

        recoveryAttempts++;
        lastRecoveryClockMs = now;
        snapshotLoading = true;
        snapshotError = "";
        try {
            player.stop();
            player.seekTo(index, position);
            player.prepare();
            player.play();
        } catch (Throwable error) {
            snapshotError = error.getMessage() == null ? "Relance de lecture impossible" : error.getMessage();
        }
        lastProgressPositionMs = position;
        lastProgressClockMs = now;
        updateSnapshot();
    }

    private void watchForPlaybackStall() {
        if (player == null || player.getMediaItemCount() == 0) return;
        long now = SystemClock.elapsedRealtime();
        long position = Math.max(0L, player.getCurrentPosition());

        if (lastProgressClockMs == 0L) {
            lastProgressClockMs = now;
            lastProgressPositionMs = position;
            return;
        }

        if (position > lastProgressPositionMs + 350L) {
            lastProgressPositionMs = position;
            lastProgressClockMs = now;
            if (player.isPlaying()) recoveryAttempts = 0;
            return;
        }

        int state = player.getPlaybackState();
        boolean shouldBeAdvancing = player.getPlayWhenReady()
            && (state == Player.STATE_BUFFERING || state == Player.STATE_IDLE);

        if (shouldBeAdvancing && now - lastProgressClockMs >= STALL_RECOVERY_MS) {
            lastProgressClockMs = now;
            schedulePlaybackRecovery("stall_" + state);
        }

        if (!player.getPlayWhenReady() || state == Player.STATE_ENDED) {
            lastProgressClockMs = now;
            lastProgressPositionMs = position;
        }
    }

`;
  service=replaceRequired(service,helperMarker,helpers+helperMarker,'insertion helpers recovery');
}

service=replaceRequired(
  service,
  '            player.seekToNextMediaItem();\n            player.prepare();\n            player.play();',
  '            player.seekToNextMediaItem();\n            recoveryAttempts = 0;\n            lastProgressClockMs = SystemClock.elapsedRealtime();\n            player.prepare();\n            player.play();',
  'next reset recovery'
);

service=replaceRequired(
  service,
  '            player.seekToPreviousMediaItem();\n            player.prepare();\n            player.play();',
  '            player.seekToPreviousMediaItem();\n            recoveryAttempts = 0;\n            lastProgressClockMs = SystemClock.elapsedRealtime();\n            player.prepare();\n            player.play();',
  'previous reset recovery'
);

await writeFile(servicePath,service,'utf8');

let main=await readFile(mainPath,'utf8');
main=main.replace(
  'if(AudifyPlaybackService.ACTION_TOGGLE.equals(action)){if(c.isPlaying())c.pause();else c.play();return true;}',
  'if(AudifyPlaybackService.ACTION_TOGGLE.equals(action)){if(c.getPlayWhenReady())c.pause();else c.play();return true;}'
);
await writeFile(mainPath,main,'utf8');

console.log('Audify V68.12.10 : récupération automatique du lecteur, anti-freeze et reprise manuelle robuste.');
