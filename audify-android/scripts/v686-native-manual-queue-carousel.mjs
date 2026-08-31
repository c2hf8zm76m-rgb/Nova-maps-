import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');

// -----------------------------------------------------------------------------
// 1) Moteur ExoPlayer : vraie file manuelle append-only + lecture par index.
// -----------------------------------------------------------------------------
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
let service=await readFile(servicePath,'utf8');

service=service.replace(
  'public static final String ACTION_VOLUME = "com.nova.audify.VOLUME";',
  'public static final String ACTION_VOLUME = "com.nova.audify.VOLUME";\n    public static final String ACTION_ENQUEUE = "com.nova.audify.ENQUEUE";\n    public static final String ACTION_PLAY_QUEUE_INDEX = "com.nova.audify.PLAY_QUEUE_INDEX";'
);
service=service.replace(
  'public static final String EXTRA_VOLUME = "volume";',
  'public static final String EXTRA_VOLUME = "volume";\n    public static final String EXTRA_QUEUE_INDEX = "queueIndex";'
);

const actionNeedle=`            } else if (ACTION_VOLUME.equals(action)) {
                double volume = intent.getDoubleExtra(EXTRA_VOLUME, 1.0);
                if (player != null) player.setVolume((float) Math.max(0.0, Math.min(1.0, volume)));
            }
            updateSnapshot();`;
if(!service.includes(actionNeedle)) throw new Error('Bloc actions AudifyPlaybackService introuvable V68.6');
const actionReplacement=`            } else if (ACTION_VOLUME.equals(action)) {
                double volume = intent.getDoubleExtra(EXTRA_VOLUME, 1.0);
                if (player != null) player.setVolume((float) Math.max(0.0, Math.min(1.0, volume)));
            } else if (ACTION_ENQUEUE.equals(action)) {
                enqueueRequested(
                    intent.getStringExtra(EXTRA_VIDEO_ID),
                    intent.getStringExtra(EXTRA_TITLE),
                    intent.getStringExtra(EXTRA_ARTIST),
                    intent.getStringExtra(EXTRA_THUMBNAIL)
                );
            } else if (ACTION_PLAY_QUEUE_INDEX.equals(action)) {
                playQueueIndex(intent.getIntExtra(EXTRA_QUEUE_INDEX, -1));
            }
            updateSnapshot();`;
service=service.replace(actionNeedle,actionReplacement);

const playRequestedNeedle='    private void playRequested(String videoId, String title, String artist, String thumbnail) {';
if(!service.includes(playRequestedNeedle)) throw new Error('playRequested introuvable V68.6');
const queueMethods=String.raw`    private void enqueueRequested(String videoId, String title, String artist, String thumbnail) {
        if (player == null || videoId == null || videoId.isEmpty()) return;
        Track track = new Track(videoId, title, artist, thumbnail);
        queueSpec.add(track);
        player.addMediaItem(toMediaItem(track));
        if (player.getPlaybackState() == Player.STATE_IDLE) player.prepare();
        updateSnapshot();
    }

    private void playQueueIndex(int index) {
        if (player == null || index < 0 || index >= player.getMediaItemCount()) return;
        snapshotLoading = true;
        player.seekTo(index, 0L);
        player.prepare();
        player.play();
        updateSnapshot();
    }

`;
service=service.replace(playRequestedNeedle,queueMethods+playRequestedNeedle);

const stateNeedle='            state.put("engine", "Media3 ExoPlayer + native YouTube resolver");';
if(!service.includes(stateNeedle)) throw new Error('getStateJson moteur introuvable V68.6');
const stateQueue=String.raw`            JSONArray queueItems = new JSONArray();
            AudifyPlaybackService live = instance;
            if (live != null && live.player != null) {
                try {
                    for (int i = 0; i < live.player.getMediaItemCount(); i++) {
                        MediaItem item = live.player.getMediaItemAt(i);
                        JSONObject q = new JSONObject();
                        q.put("id", item.mediaId == null ? "" : item.mediaId);
                        q.put("title", item.mediaMetadata.title == null ? "Sans titre" : item.mediaMetadata.title.toString());
                        q.put("artist", item.mediaMetadata.artist == null ? "YouTube" : item.mediaMetadata.artist.toString());
                        q.put("thumbnail", item.mediaMetadata.artworkUri == null ? "" : item.mediaMetadata.artworkUri.toString());
                        q.put("absoluteIndex", i);
                        queueItems.put(q);
                    }
                } catch (Throwable ignored) {}
            }
            state.put("queue", queueItems);
` + stateNeedle;
service=service.replace(stateNeedle,stateQueue);
await writeFile(servicePath,service,'utf8');

// -----------------------------------------------------------------------------
// 2) Recherche native : ▶ crée une nouvelle file [morceau courant] seulement,
//    + bouton « + File » qui ajoute sans interrompre la lecture.
// -----------------------------------------------------------------------------
const mainPath=path.join(pkgDir,'MainActivity.java');
let main=await readFile(mainPath,'utf8');
const playStart=main.indexOf('    private void audifyPlaySearchResultV674(');
const renderStart=main.indexOf('    private void renderAudifyNativeResultsV672(', playStart);
if(playStart<0 || renderStart<0) throw new Error('Méthodes recherche V67.4 introuvables V68.6');
const newPlay=String.raw`    private void audifyPlaySearchResultV674(java.util.List<AudifySearchItemV673> items, int selectedIndex) {
        if (items == null || selectedIndex < 0 || selectedIndex >= items.size()) return;
        try {
            AudifySearchItemV673 chosen = items.get(selectedIndex);
            org.json.JSONArray arr = new org.json.JSONArray();
            org.json.JSONObject one = new org.json.JSONObject();
            one.put("id", chosen.id);
            one.put("title", chosen.title);
            one.put("artist", chosen.artist);
            one.put("thumbnail", chosen.thumbnail);
            arr.put(one);
            org.json.JSONObject root = new org.json.JSONObject();
            root.put("items", arr);
            root.put("index", 0);

            startService(new android.content.Intent(this, AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_SET_QUEUE)
                .putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON, root.toString()));
            startService(new android.content.Intent(this, AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_LOAD)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID, chosen.id)
                .putExtra(AudifyPlaybackService.EXTRA_TITLE, chosen.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST, chosen.artist)
                .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL, chosen.thumbnail));

            startActivity(new android.content.Intent(this, NativePlayerActivity.class)
                .putExtra("videoId", chosen.id)
                .putExtra("title", chosen.title)
                .putExtra("artist", chosen.artist)
                .putExtra("thumbnail", chosen.thumbnail));
        } catch (Throwable error) {
            android.widget.Toast.makeText(this, "Erreur lecture Audify", android.widget.Toast.LENGTH_SHORT).show();
        }
    }

    private void audifyEnqueueSearchResultV686(AudifySearchItemV673 item) {
        if (item == null || item.id == null || item.id.isEmpty()) return;
        try {
            startService(new android.content.Intent(this, AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_ENQUEUE)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID, item.id)
                .putExtra(AudifyPlaybackService.EXTRA_TITLE, item.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST, item.artist)
                .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL, item.thumbnail));
            android.widget.Toast.makeText(this, "Ajouté à la file : " + item.title, android.widget.Toast.LENGTH_SHORT).show();
        } catch (Throwable ignored) {}
    }

`;
main=main.slice(0,playStart)+newPlay+main.slice(renderStart);

const playIconNeedle=`            android.widget.TextView playIcon = audifyResultTextV672("▶", 20f, android.graphics.Color.rgb(168,255,63));
            playIcon.setGravity(android.view.Gravity.CENTER);
            playIcon.setPadding(audifyDp(12),0,audifyDp(4),0);
            card.addView(playIcon, new android.widget.LinearLayout.LayoutParams(audifyDp(48), audifyDp(56)));`;
if(!main.includes(playIconNeedle)) throw new Error('Icône lecture recherche introuvable V68.6');
const searchActions=String.raw`            android.widget.LinearLayout resultActions = new android.widget.LinearLayout(this);
            resultActions.setOrientation(android.widget.LinearLayout.VERTICAL);
            resultActions.setGravity(android.view.Gravity.CENTER);

            android.widget.Button queueButton = new android.widget.Button(this);
            queueButton.setAllCaps(false);
            queueButton.setText("＋ File");
            queueButton.setTextSize(11f);
            queueButton.setPadding(0,0,0,0);
            queueButton.setOnClickListener(v -> audifyEnqueueSearchResultV686(item));
            resultActions.addView(queueButton, new android.widget.LinearLayout.LayoutParams(audifyDp(88), audifyDp(40)));

            android.widget.TextView playIcon = audifyResultTextV672("▶", 20f, android.graphics.Color.rgb(168,255,63));
            playIcon.setGravity(android.view.Gravity.CENTER);
            resultActions.addView(playIcon, new android.widget.LinearLayout.LayoutParams(audifyDp(88), audifyDp(38)));
            card.addView(resultActions, new android.widget.LinearLayout.LayoutParams(audifyDp(94), android.widget.LinearLayout.LayoutParams.WRAP_CONTENT));`;
main=main.replace(playIconNeedle,searchActions);
await writeFile(mainPath,main,'utf8');

// -----------------------------------------------------------------------------
// 3) Home : boutons File sur les titres likés + lecture directe = nouvelle file
//    avec seulement le titre choisi.
// -----------------------------------------------------------------------------
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
let home=await readFile(homePath,'utf8');
const likesNeedle=String.raw`                Button card=trackButton(t);
                card.setOnClickListener(v -> playCollection(likes,index));
                LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(66));
                lp.topMargin=dp(7);
                libraryContent.addView(card,lp);`;
if(!home.includes(likesNeedle)) throw new Error('Cartes likes Home introuvables V68.6');
const likesReplacement=String.raw`                LinearLayout row=new LinearLayout(this);
                row.setGravity(Gravity.CENTER_VERTICAL);
                Button card=trackButton(t);
                card.setOnClickListener(v -> playCollection(likes,index));
                row.addView(card,new LinearLayout.LayoutParams(0,dp(66),1f));
                Button queue=button("＋ File");
                queue.setTextSize(12f);
                queue.setOnClickListener(v -> enqueueTrack(t));
                LinearLayout.LayoutParams qlp=new LinearLayout.LayoutParams(dp(100),dp(58));
                qlp.leftMargin=dp(6);
                row.addView(queue,qlp);
                LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(68));
                lp.topMargin=dp(7);
                libraryContent.addView(row,lp);`;
home=home.replace(likesNeedle,likesReplacement);

const playCollectionNeedle=`    private void playCollection(List<AudifyLibraryStore.Track> tracks,int index) {
        if(tracks==null || tracks.isEmpty() || index<0 || index>=tracks.size()) return;
        AudifyLibraryStore.Track chosen=tracks.get(index);
        try {
            startService(new Intent(this,AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_SET_QUEUE)
                .putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON,store.queueJson(tracks,index)));
            startService(new Intent(this,AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_LOAD)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,chosen.id)
                .putExtra(AudifyPlaybackService.EXTRA_TITLE,chosen.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST,chosen.artist)
                .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,chosen.thumbnail));
        } catch(Exception ignored) {}
        snapshotTrack=chosen;
        openCurrentPlayer();
    }`;
if(!home.includes(playCollectionNeedle)) throw new Error('playCollection Home introuvable V68.6');
const homePlayReplacement=String.raw`    private void enqueueTrack(AudifyLibraryStore.Track track) {
        if(track==null || track.id.isEmpty()) return;
        try {
            startService(new Intent(this,AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_ENQUEUE)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,track.id)
                .putExtra(AudifyPlaybackService.EXTRA_TITLE,track.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST,track.artist)
                .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,track.thumbnail));
            android.widget.Toast.makeText(this,"Ajouté à la file : " + track.title,android.widget.Toast.LENGTH_SHORT).show();
        } catch(Exception ignored) {}
    }

    private void playCollection(List<AudifyLibraryStore.Track> tracks,int index) {
        if(tracks==null || tracks.isEmpty() || index<0 || index>=tracks.size()) return;
        AudifyLibraryStore.Track chosen=tracks.get(index);
        try {
            java.util.ArrayList<AudifyLibraryStore.Track> single=new java.util.ArrayList<>();
            single.add(chosen);
            startService(new Intent(this,AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_SET_QUEUE)
                .putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON,store.queueJson(single,0)));
            startService(new Intent(this,AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_LOAD)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,chosen.id)
                .putExtra(AudifyPlaybackService.EXTRA_TITLE,chosen.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST,chosen.artist)
                .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,chosen.thumbnail));
        } catch(Exception ignored) {}
        snapshotTrack=chosen;
        openCurrentPlayer();
    }`;
home=home.replace(playCollectionNeedle,homePlayReplacement);
await writeFile(homePath,home,'utf8');

// -----------------------------------------------------------------------------
// 4) Ancienne page Bibliothèque : même bouton File sur les likes pour garder
//    le comportement cohérent partout.
// -----------------------------------------------------------------------------
const libraryPath=path.join(pkgDir,'NativeLibraryActivity.java');
let library=await readFile(libraryPath,'utf8');
if(!library.includes('import android.widget.Button;')) {
  library=library.replace('import android.widget.AlertDialog;', 'import android.widget.AlertDialog;\nimport android.widget.Button;');
}
const addRowStart=library.indexOf('    private void addTrackRow(');
const playMethodStart=library.indexOf('    private void play(',addRowStart);
if(addRowStart>=0 && playMethodStart>addRowStart) {
  const newAddRow=String.raw`    private void addTrackRow(LinearLayout root, List<AudifyLibraryStore.Track> tracks, int index) {
        AudifyLibraryStore.Track t = tracks.get(index);
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView info = label(t.title + "\n" + t.artist, 16f, Color.WHITE);
        info.setPadding(dp(14), dp(14), dp(14), dp(14));
        info.setBackgroundColor(Color.rgb(18,23,31));
        info.setOnClickListener(v -> play(tracks, index));
        row.addView(info,new LinearLayout.LayoutParams(0,dp(66),1f));
        Button queue = new Button(this);
        queue.setAllCaps(false);
        queue.setText("＋ File");
        queue.setOnClickListener(v -> enqueueTrack(t));
        LinearLayout.LayoutParams qlp=new LinearLayout.LayoutParams(dp(100),dp(60));
        qlp.leftMargin=dp(6);
        row.addView(queue,qlp);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(68));
        lp.bottomMargin = dp(8);
        root.addView(row, lp);
    }

    private void enqueueTrack(AudifyLibraryStore.Track t) {
        try {
            startService(new Intent(this, AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_ENQUEUE)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,t.id)
                .putExtra(AudifyPlaybackService.EXTRA_TITLE,t.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST,t.artist)
                .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,t.thumbnail));
            Toast.makeText(this,"Ajouté à la file : " + t.title,Toast.LENGTH_SHORT).show();
        } catch(Throwable ignored) {}
    }

`;
  library=library.slice(0,addRowStart)+newAddRow+library.slice(playMethodStart);
}
const libraryQueueNeedle='.putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON, store.queueJson(tracks,index))';
if(library.includes(libraryQueueNeedle)) {
  library=library.replace(libraryQueueNeedle, '.putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON, store.queueJson(java.util.Collections.singletonList(t),0))');
}
await writeFile(libraryPath,library,'utf8');

// -----------------------------------------------------------------------------
// 5) Grand lecteur : carrousel horizontal 0/current + 01/02/... à suivre.
// -----------------------------------------------------------------------------
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
let player=await readFile(playerPath,'utf8');
if(!player.includes('import android.widget.HorizontalScrollView;')) {
  player=player.replace('import android.widget.FrameLayout;', 'import android.widget.FrameLayout;\nimport android.widget.HorizontalScrollView;');
}
if(!player.includes('import org.json.JSONArray;')) {
  player=player.replace('import org.json.JSONObject;', 'import org.json.JSONArray;\nimport org.json.JSONObject;');
}
player=player.replace(
  'private SeekBar timeline;',
  'private SeekBar timeline;\n    private LinearLayout queueSection;\n    private LinearLayout queueRow;\n    private TextView queueCountView;\n    private String lastQueueSignature = "";'
);

const artistNeedle=`        content.addView(artistView, artistLp);

        timeline = new SeekBar(this);`;
if(!player.includes(artistNeedle)) throw new Error('Insertion carrousel après artiste introuvable V68.6');
const queueUi=String.raw`        content.addView(artistView, artistLp);

        queueSection = new LinearLayout(this);
        queueSection.setOrientation(LinearLayout.VERTICAL);
        queueSection.setPadding(dp(10),dp(8),dp(10),dp(8));
        GradientDrawable queueBg = new GradientDrawable();
        queueBg.setColor(Color.argb(150,10,14,20));
        queueBg.setCornerRadius(dp(20));
        queueBg.setStroke(dp(1),Color.argb(120,120,135,155));
        queueSection.setBackground(queueBg);
        queueSection.setVisibility(View.GONE);

        LinearLayout queueHeader = new LinearLayout(this);
        queueHeader.setGravity(Gravity.CENTER_VERTICAL);
        TextView queueLabel = new TextView(this);
        queueLabel.setText("À SUIVRE\nFile d’attente");
        queueLabel.setTextColor(Color.WHITE);
        queueLabel.setTextSize(14f);
        queueLabel.setTypeface(queueLabel.getTypeface(),android.graphics.Typeface.BOLD);
        queueHeader.addView(queueLabel,new LinearLayout.LayoutParams(0,dp(48),1f));
        queueCountView = new TextView(this);
        queueCountView.setTextColor(Color.rgb(165,175,188));
        queueCountView.setTextSize(12f);
        queueCountView.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        queueHeader.addView(queueCountView,new LinearLayout.LayoutParams(dp(100),dp(48)));
        queueSection.addView(queueHeader,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));

        HorizontalScrollView queueScroll = new HorizontalScrollView(this);
        queueScroll.setHorizontalScrollBarEnabled(false);
        queueScroll.setFillViewport(false);
        queueRow = new LinearLayout(this);
        queueRow.setOrientation(LinearLayout.HORIZONTAL);
        queueRow.setGravity(Gravity.CENTER_VERTICAL);
        queueScroll.addView(queueRow,new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,dp(112)));
        queueSection.addView(queueScroll,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(112)));
        LinearLayout.LayoutParams queueSectionLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(168));
        queueSectionLp.topMargin=dp(10);
        content.addView(queueSection,queueSectionLp);

        timeline = new SeekBar(this);`;
player=player.replace(artistNeedle,queueUi);

const refreshNeedle=`            repeatOne = state.optBoolean("repeatOne", false);
            applyPlayState(playing);`;
if(!player.includes(refreshNeedle)) throw new Error('refresh queue insertion introuvable V68.6');
player=player.replace(refreshNeedle,`            repeatOne = state.optBoolean("repeatOne", false);\n            refreshQueueCarousel(state);\n            applyPlayState(playing);`);

const playlistMethodNeedle='    private void showPlaylistPicker() {';
if(!player.includes(playlistMethodNeedle)) throw new Error('Méthodes player V68.6 insertion introuvable');
const queueMethodsPlayer=String.raw`    private void refreshQueueCarousel(JSONObject state) {
        if (queueSection == null || queueRow == null || state == null) return;
        JSONArray items = state.optJSONArray("queue");
        int currentIndex = state.optInt("queueIndex", -1);
        if (items == null || currentIndex < 0 || currentIndex >= items.length() || items.length() <= currentIndex + 1) {
            queueSection.setVisibility(View.GONE);
            lastQueueSignature = "";
            return;
        }

        StringBuilder signature = new StringBuilder();
        signature.append(currentIndex).append('|');
        for (int i=currentIndex;i<items.length();i++) {
            JSONObject item=items.optJSONObject(i);
            if(item!=null) signature.append(item.optString("id","")).append('@').append(i).append(';');
        }
        String nextSignature=signature.toString();
        if(nextSignature.equals(lastQueueSignature)) return;
        lastQueueSignature=nextSignature;

        int upcoming=Math.max(0,items.length()-currentIndex-1);
        queueCountView.setText(upcoming + (upcoming>1 ? " titres" : " titre"));
        queueRow.removeAllViews();

        for(int absolute=currentIndex;absolute<items.length();absolute++) {
            JSONObject item=items.optJSONObject(absolute);
            if(item==null) continue;
            final int targetIndex=absolute;
            int displayIndex=absolute-currentIndex;
            String id=item.optString("id","");
            String title=item.optString("title","Sans titre");
            String artist=item.optString("artist","YouTube");
            String thumbnail=item.optString("thumbnail","");

            LinearLayout card=new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(5),dp(5),dp(5),dp(5));
            card.setGravity(Gravity.CENTER_HORIZONTAL);
            GradientDrawable cardBg=new GradientDrawable();
            cardBg.setColor(Color.argb(150,19,24,32));
            cardBg.setCornerRadius(dp(14));
            cardBg.setStroke(dp(displayIndex==0?2:1),displayIndex==0?Color.rgb(168,255,63):Color.argb(110,120,130,145));
            card.setBackground(cardBg);

            FrameLayout imageWrap=new FrameLayout(this);
            ImageView thumb=new ImageView(this);
            thumb.setScaleType(ImageView.ScaleType.CENTER_CROP);
            thumb.setBackgroundColor(Color.rgb(25,30,38));
            imageWrap.addView(thumb,new FrameLayout.LayoutParams(dp(108),dp(64),Gravity.CENTER));
            TextView badge=new TextView(this);
            badge.setText(displayIndex==0?"0":(displayIndex<10?"0"+displayIndex:String.valueOf(displayIndex)));
            badge.setTextColor(displayIndex==0?Color.BLACK:Color.WHITE);
            badge.setTextSize(10f);
            badge.setGravity(Gravity.CENTER);
            GradientDrawable badgeBg=new GradientDrawable();
            badgeBg.setColor(displayIndex==0?Color.rgb(168,255,63):Color.rgb(30,34,42));
            badgeBg.setCornerRadius(dp(11));
            badge.setBackground(badgeBg);
            FrameLayout.LayoutParams badgeLp=new FrameLayout.LayoutParams(dp(30),dp(22),Gravity.TOP|Gravity.START);
            badgeLp.setMargins(dp(4),dp(4),0,0);
            imageWrap.addView(badge,badgeLp);
            card.addView(imageWrap,new LinearLayout.LayoutParams(dp(108),dp(64)));

            TextView titleText=new TextView(this);
            titleText.setText(title);
            titleText.setTextColor(Color.WHITE);
            titleText.setTextSize(12f);
            titleText.setMaxLines(1);
            titleText.setEllipsize(TextUtils.TruncateAt.END);
            titleText.setTypeface(titleText.getTypeface(),android.graphics.Typeface.BOLD);
            LinearLayout.LayoutParams titleCardLp=new LinearLayout.LayoutParams(dp(108),dp(26));
            titleCardLp.topMargin=dp(3);
            card.addView(titleText,titleCardLp);

            TextView artistText=new TextView(this);
            artistText.setText(artist);
            artistText.setTextColor(Color.rgb(158,168,181));
            artistText.setTextSize(10f);
            artistText.setMaxLines(1);
            artistText.setEllipsize(TextUtils.TruncateAt.END);
            card.addView(artistText,new LinearLayout.LayoutParams(dp(108),dp(20)));

            card.setOnClickListener(v -> {
                try {
                    startService(new Intent(this,AudifyPlaybackService.class)
                        .setAction(AudifyPlaybackService.ACTION_PLAY_QUEUE_INDEX)
                        .putExtra(AudifyPlaybackService.EXTRA_QUEUE_INDEX,targetIndex));
                    uiHandler.postDelayed(this::refreshFromPlayer,120L);
                } catch(Exception ignored) {}
            });
            loadQueueThumbnail(thumbnail,id,thumb);
            LinearLayout.LayoutParams cardLp=new LinearLayout.LayoutParams(dp(120),dp(116));
            cardLp.rightMargin=dp(7);
            queueRow.addView(card,cardLp);
        }
        queueSection.setVisibility(View.VISIBLE);
    }

    private void loadQueueThumbnail(String rawUrl,String videoId,ImageView target) {
        if(target==null) return;
        final String imageUrl=rawUrl!=null && !rawUrl.trim().isEmpty()
            ? rawUrl.trim()
            : (videoId==null || videoId.isEmpty()?"":"https://i.ytimg.com/vi/"+videoId+"/hqdefault.jpg");
        if(imageUrl.isEmpty()) return;
        new Thread(() -> {
            HttpURLConnection connection=null;
            try {
                connection=(HttpURLConnection)new URL(imageUrl).openConnection();
                connection.setConnectTimeout(6500);
                connection.setReadTimeout(6500);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent","AudifyAndroid/68.6");
                try(InputStream input=connection.getInputStream()) {
                    Bitmap bitmap=BitmapFactory.decodeStream(input);
                    if(bitmap!=null) runOnUiThread(() -> target.setImageBitmap(bitmap));
                }
            } catch(Throwable ignored) {
            } finally {
                if(connection!=null) connection.disconnect();
            }
        },"audify-queue-thumb").start();
    }

`;
player=player.replace(playlistMethodNeedle,queueMethodsPlayer+playlistMethodNeedle);
await writeFile(playerPath,player,'utf8');

console.log('Audify Android V68.6 : file manuelle native + boutons recherche/likes + carrousel pochette appliqués.');
