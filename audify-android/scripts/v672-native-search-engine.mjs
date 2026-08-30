import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const repoRoot=path.resolve(root,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');
const webBasePath=path.join(repoRoot,'audify','index-v21.html');
let main=await readFile(mainPath,'utf8');
const webBase=await readFile(webBasePath,'utf8');

// Reuse the exact YouTube Data API key already used by the historical Audify search.
const keyMatch=webBase.match(/const KEY='([^']+)'/);
if(!keyMatch) throw new Error('Cle YouTube historique introuvable dans index-v21.html');
const youtubeKey=keyMatch[1];

const classMarker='public class MainActivity extends BridgeActivity {';
if(!main.includes(classMarker)) throw new Error('MainActivity introuvable pour V67.3');

const members=String.raw`
    // V67.3 — restauration du moteur de recherche historique Audify.
    // Recherche = YouTube Data API v3. Lecture = NewPipeExtractor + ExoPlayer.
    private static final String AUDIFY_YOUTUBE_DATA_KEY_V673 = "${youtubeKey}";
    private final java.util.concurrent.ExecutorService audifySearchExecutorV672 = java.util.concurrent.Executors.newSingleThreadExecutor();
    private android.widget.ScrollView audifySearchScrollV672;
    private android.widget.LinearLayout audifySearchListV672;
    private int audifySearchGenerationV672 = 0;

    private static final class AudifySearchItemV673 {
        final String id;
        final String title;
        final String artist;
        final String thumbnail;
        AudifySearchItemV673(String id, String title, String artist, String thumbnail) {
            this.id=id; this.title=title; this.artist=artist; this.thumbnail=thumbnail;
        }
    }

    private android.widget.TextView audifyResultTextV672(String text, float sp, int color) {
        android.widget.TextView v = new android.widget.TextView(this);
        v.setText(text);
        v.setTextSize(sp);
        v.setTextColor(color);
        v.setPadding(audifyDp(16), audifyDp(12), audifyDp(16), audifyDp(12));
        v.setGravity(android.view.Gravity.CENTER_VERTICAL);
        return v;
    }

    private void ensureAudifySearchResultsV672() {
        if (audifySearchScrollV672 != null) return;
        android.view.View rootView = findViewById(android.R.id.content);
        if (!(rootView instanceof android.widget.FrameLayout)) return;
        android.widget.FrameLayout content = (android.widget.FrameLayout) rootView;

        android.widget.ScrollView scroll = new android.widget.ScrollView(this);
        audifySearchScrollV672 = scroll;
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.setPadding(audifyDp(18), audifyDp(12), audifyDp(18), audifyDp(24));
        scroll.setBackgroundColor(android.graphics.Color.rgb(7,10,15));
        scroll.setVisibility(android.view.View.GONE);
        scroll.setElevation(audifyDp(20));

        android.widget.LinearLayout list = new android.widget.LinearLayout(this);
        audifySearchListV672 = list;
        list.setOrientation(android.widget.LinearLayout.VERTICAL);
        list.setPadding(0,0,0,audifyDp(24));
        scroll.addView(list, new android.widget.ScrollView.LayoutParams(
            android.widget.ScrollView.LayoutParams.MATCH_PARENT,
            android.widget.ScrollView.LayoutParams.WRAP_CONTENT
        ));

        android.widget.FrameLayout.LayoutParams lp = new android.widget.FrameLayout.LayoutParams(
            android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
            android.widget.FrameLayout.LayoutParams.MATCH_PARENT
        );
        lp.setMargins(0, audifyDp(92), 0, 0);
        content.addView(scroll, lp);
        scroll.bringToFront();
        if (audifyNativeSearchV670 != null) audifyNativeSearchV670.bringToFront();
        if (audifyNativeSearchButtonV671 != null) audifyNativeSearchButtonV671.bringToFront();
    }

    private void showAudifySearchStatusV672(String text, boolean error) {
        ensureAudifySearchResultsV672();
        if (audifySearchScrollV672 == null || audifySearchListV672 == null) return;
        audifySearchScrollV672.setVisibility(android.view.View.VISIBLE);
        audifySearchListV672.removeAllViews();
        android.widget.TextView status = audifyResultTextV672(
            text,
            error ? 16f : 17f,
            error ? android.graphics.Color.rgb(255,120,120) : android.graphics.Color.rgb(180,188,200)
        );
        status.setGravity(android.view.Gravity.CENTER);
        status.setPadding(audifyDp(20), audifyDp(70), audifyDp(20), audifyDp(40));
        audifySearchListV672.addView(status, new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        ));
    }

    private String audifyHtmlTextV673(String value) {
        if (value == null) return "";
        try {
            if (android.os.Build.VERSION.SDK_INT >= 24) {
                return android.text.Html.fromHtml(value, android.text.Html.FROM_HTML_MODE_LEGACY).toString();
            }
            return android.text.Html.fromHtml(value).toString();
        } catch (Throwable ignored) {
            return value;
        }
    }

    private void renderAudifyNativeResultsV672(java.util.List<AudifySearchItemV673> items, String query, int generation) {
        if (generation != audifySearchGenerationV672) return;
        ensureAudifySearchResultsV672();
        if (audifySearchScrollV672 == null || audifySearchListV672 == null) return;
        audifySearchScrollV672.setVisibility(android.view.View.VISIBLE);
        audifySearchListV672.removeAllViews();

        String headerText = items.isEmpty()
            ? "Aucun résultat YouTube pour « " + query + " »"
            : items.size() + " résultats YouTube pour « " + query + " »";
        android.widget.TextView header = audifyResultTextV672(headerText, 15f, android.graphics.Color.rgb(160,168,180));
        header.setPadding(audifyDp(8), audifyDp(10), audifyDp(8), audifyDp(18));
        audifySearchListV672.addView(header);

        int index = 0;
        for (AudifySearchItemV673 item : items) {
            if (index++ >= 20) break;

            android.widget.LinearLayout card = new android.widget.LinearLayout(this);
            card.setOrientation(android.widget.LinearLayout.VERTICAL);
            card.setPadding(audifyDp(18), audifyDp(15), audifyDp(18), audifyDp(15));

            android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
            bg.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
            bg.setColor(android.graphics.Color.rgb(18,23,31));
            bg.setStroke(audifyDp(1), android.graphics.Color.rgb(48,57,69));
            bg.setCornerRadius(audifyDp(18));
            card.setBackground(bg);

            android.widget.TextView titleView = audifyResultTextV672(item.title, 17f, android.graphics.Color.WHITE);
            titleView.setPadding(0,0,0,audifyDp(6));
            titleView.setMaxLines(2);
            titleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
            card.addView(titleView);

            android.widget.TextView metaView = audifyResultTextV672(item.artist, 13f, android.graphics.Color.rgb(170,178,190));
            metaView.setPadding(0,0,0,0);
            metaView.setMaxLines(1);
            metaView.setEllipsize(android.text.TextUtils.TruncateAt.END);
            card.addView(metaView);

            android.widget.LinearLayout.LayoutParams cardLp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            );
            cardLp.setMargins(0,0,0,audifyDp(10));
            audifySearchListV672.addView(card, cardLp);
        }
        audifySearchScrollV672.scrollTo(0,0);
    }

    private String audifyReadHttpV673(java.net.HttpURLConnection connection, int code) throws Exception {
        java.io.InputStream stream = code >= 200 && code < 300
            ? connection.getInputStream()
            : connection.getErrorStream();
        if (stream == null) return "";
        java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(stream, java.nio.charset.StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) out.append(line);
        reader.close();
        return out.toString();
    }

    private void runAudifyNativeSearchV672(String rawQuery) {
        final String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.isEmpty()) return;
        final int generation = ++audifySearchGenerationV672;
        showAudifySearchStatusV672("Recherche YouTube de « " + query + " »…", false);

        audifySearchExecutorV672.execute(() -> {
            java.net.HttpURLConnection connection = null;
            try {
                String encoded = java.net.URLEncoder.encode(query, "UTF-8");
                String endpoint = "https://www.googleapis.com/youtube/v3/search"
                    + "?part=snippet"
                    + "&type=video"
                    + "&videoEmbeddable=true"
                    + "&maxResults=20"
                    + "&q=" + encoded
                    + "&key=" + java.net.URLEncoder.encode(AUDIFY_YOUTUBE_DATA_KEY_V673, "UTF-8");

                connection = (java.net.HttpURLConnection) new java.net.URL(endpoint).openConnection();
                connection.setRequestMethod("GET");
                connection.setRequestProperty("Accept", "application/json");
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(16000);
                connection.setUseCaches(false);

                int code = connection.getResponseCode();
                String body = audifyReadHttpV673(connection, code);
                org.json.JSONObject root = body.isEmpty() ? new org.json.JSONObject() : new org.json.JSONObject(body);

                if (code < 200 || code >= 300) {
                    String message = "YouTube API HTTP " + code;
                    org.json.JSONObject error = root.optJSONObject("error");
                    if (error != null && !error.optString("message", "").isEmpty()) message = error.optString("message");
                    throw new IllegalStateException(message);
                }

                java.util.ArrayList<AudifySearchItemV673> results = new java.util.ArrayList<>();
                org.json.JSONArray arr = root.optJSONArray("items");
                if (arr != null) {
                    for (int i=0; i<arr.length() && results.size()<20; i++) {
                        org.json.JSONObject entry = arr.optJSONObject(i);
                        if (entry == null) continue;
                        org.json.JSONObject idObj = entry.optJSONObject("id");
                        org.json.JSONObject snippet = entry.optJSONObject("snippet");
                        if (idObj == null || snippet == null) continue;
                        String videoId = idObj.optString("videoId", "");
                        if (videoId.isEmpty()) continue;
                        String title = audifyHtmlTextV673(snippet.optString("title", "Sans titre"));
                        String artist = audifyHtmlTextV673(snippet.optString("channelTitle", "YouTube"));
                        String thumbnail = "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg";
                        org.json.JSONObject thumbs = snippet.optJSONObject("thumbnails");
                        if (thumbs != null) {
                            org.json.JSONObject chosen = thumbs.optJSONObject("high");
                            if (chosen == null) chosen = thumbs.optJSONObject("medium");
                            if (chosen == null) chosen = thumbs.optJSONObject("default");
                            if (chosen != null && !chosen.optString("url", "").isEmpty()) thumbnail = chosen.optString("url");
                        }
                        results.add(new AudifySearchItemV673(videoId, title, artist, thumbnail));
                    }
                }

                final java.util.ArrayList<AudifySearchItemV673> finalResults = results;
                runOnUiThread(() -> renderAudifyNativeResultsV672(finalResults, query, generation));
            } catch (Throwable error) {
                String message = error.getMessage();
                if (message == null || message.trim().isEmpty()) message = error.getClass().getSimpleName();
                final String finalMessage = message;
                runOnUiThread(() -> {
                    if (generation != audifySearchGenerationV672) return;
                    showAudifySearchStatusV672("Erreur recherche YouTube :\n" + finalMessage, true);
                });
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }
`;
main=main.replace(classMarker,classMarker+members);

const submitMarker='audifyPendingSearchV671 = query;';
if(!main.includes(submitMarker)) throw new Error('submitAudifyNativeSearchV671 introuvable pour V67.3');
main=main.replace(submitMarker, `${submitMarker}\n            runAudifyNativeSearchV672(query);`);

const destroyMarker='    @Override\n    protected void onDestroy() {';
if(main.includes(destroyMarker) && !main.includes('audifySearchExecutorV672.shutdownNow')){
  main=main.replace(destroyMarker, `${destroyMarker}\n        try { audifySearchExecutorV672.shutdownNow(); } catch (Exception ignored) {}`);
}

await writeFile(mainPath,main,'utf8');
console.log('Audify Android V67.3 : recherche historique YouTube Data API restauree en natif.');
