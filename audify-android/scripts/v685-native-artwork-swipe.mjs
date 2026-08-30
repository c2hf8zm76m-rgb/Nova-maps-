import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const activityPath=path.join(root,'android','app','src','main','java','com','nova','audify','NativePlayerActivity.java');
let src=await readFile(activityPath,'utf8');

// Import tactile natif.
if(!src.includes('import android.view.MotionEvent;')) {
  src=src.replace('import android.view.Gravity;','import android.view.Gravity;\nimport android.view.MotionEvent;');
}

// Etat du swipe + suivi du morceau actuellement affiché.
src=src.replace(
  'private boolean userSeeking = false;',
  'private boolean userSeeking = false;\n    private float artworkTouchStartX = 0f;\n    private float artworkTouchStartY = 0f;\n    private boolean artworkSwiping = false;\n    private String displayedVideoId = "";'
);

// Mémoriser immédiatement le titre reçu à l’ouverture.
const trackNeedle=`        currentTrack = new AudifyLibraryStore.Track(\n            source == null ? "" : source.getStringExtra("videoId"),\n            source == null ? "Sans titre" : source.getStringExtra("title"),\n            source == null ? "YouTube" : source.getStringExtra("artist"),\n            source == null ? "" : source.getStringExtra("thumbnail")\n        );`;
if(src.includes(trackNeedle)) {
  src=src.replace(trackNeedle, trackNeedle+'\n        displayedVideoId = currentTrack.id;');
}

// Swipe directement sur la pochette complète. Sens demandé par l’utilisateur :
// droite = suivant, gauche = précédent.
const artworkNeedle='        content.addView(artwork, new LinearLayout.LayoutParams(artworkSize, artworkSize));';
if(!src.includes(artworkNeedle)) throw new Error('Pochette NativePlayerActivity introuvable pour V68.5');
const swipeCode=String.raw`        artwork.setClickable(true);
        artwork.setOnTouchListener((view, event) -> {
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    artworkTouchStartX = event.getRawX();
                    artworkTouchStartY = event.getRawY();
                    artworkSwiping = true;
                    view.animate().cancel();
                    return true;

                case MotionEvent.ACTION_MOVE:
                    if (!artworkSwiping) return true;
                    float liveDx = event.getRawX() - artworkTouchStartX;
                    float liveDy = event.getRawY() - artworkTouchStartY;
                    if (Math.abs(liveDx) > Math.abs(liveDy)) {
                        view.setTranslationX(liveDx * 0.22f);
                    }
                    return true;

                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    if (!artworkSwiping) return true;
                    artworkSwiping = false;
                    float dx = event.getRawX() - artworkTouchStartX;
                    float dy = event.getRawY() - artworkTouchStartY;
                    boolean horizontal = Math.abs(dx) >= dp(70) && Math.abs(dx) > Math.abs(dy) * 1.25f;
                    view.animate().translationX(0f).setDuration(180L).start();
                    if (horizontal) {
                        // Convention Audify : droite = prochain, gauche = précédent.
                        startPlayerAction(dx > 0
                            ? AudifyPlaybackService.ACTION_NEXT
                            : AudifyPlaybackService.ACTION_PREVIOUS);
                        uiHandler.postDelayed(this::refreshFromPlayer, 120L);
                        uiHandler.postDelayed(this::refreshFromPlayer, 320L);
                    }
                    return true;
            }
            return true;
        });

` + artworkNeedle;
src=src.replace(artworkNeedle, swipeCode);

// A chaque transition ExoPlayer, synchroniser toute la page native : titre,
// artiste, pochette/disque, fond dynamique et état Like.
const refreshNeedle=`            boolean playing = state.optBoolean("playing", false);`;
if(!src.includes(refreshNeedle)) throw new Error('refreshFromPlayer introuvable pour V68.5');
const refreshInsert=String.raw`            String activeId = state.optString("videoId", "");
            if (!activeId.isEmpty() && !activeId.equals(displayedVideoId)) {
                displayedVideoId = activeId;
                String activeTitle = state.optString("title", "Sans titre");
                String activeArtist = state.optString("artist", "YouTube");
                String activeThumbnail = state.optString("thumbnail", "");
                currentTrack = new AudifyLibraryStore.Track(activeId, activeTitle, activeArtist, activeThumbnail);
                titleView.setText(currentTrack.title);
                artistView.setText(currentTrack.artist);
                applyLikeState(store.isLiked(currentTrack.id));
                timeline.setProgress(0);
                loadArtwork(currentTrack.thumbnail, currentTrack.id);
            }
` + refreshNeedle;
src=src.replace(refreshNeedle,refreshInsert);

await writeFile(activityPath,src,'utf8');
console.log('Audify Android V68.5 : swipe natif pochette droite=suivant, gauche=précédent + UI synchronisée.');
