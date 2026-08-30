import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');
let main=await readFile(mainPath,'utf8');

const generationMarker='    private int audifySearchGenerationV672 = 0;';
if(!main.includes(generationMarker)) throw new Error('V67.3 search fields introuvables');
main=main.replace(generationMarker, `${generationMarker}\n    private final java.util.concurrent.ExecutorService audifyThumbExecutorV674 = java.util.concurrent.Executors.newFixedThreadPool(4);\n    private final android.util.LruCache<String, android.graphics.Bitmap> audifyThumbCacheV674 = new android.util.LruCache<>(40);`);

const renderStart=main.indexOf('    private void renderAudifyNativeResultsV672(');
const renderEnd=main.indexOf('    private String audifyReadHttpV673', renderStart);
if(renderStart<0 || renderEnd<0) throw new Error('renderAudifyNativeResultsV672 introuvable');

const replacement=String.raw`    private void audifyLoadThumbV674(String url, android.widget.ImageView target) {
        if (url == null || url.isEmpty() || target == null) return;
        android.graphics.Bitmap cached = audifyThumbCacheV674.get(url);
        if (cached != null) {
            target.setImageBitmap(cached);
            return;
        }
        final Object tag = new Object();
        target.setTag(tag);
        audifyThumbExecutorV674.execute(() -> {
            java.net.HttpURLConnection c = null;
            try {
                c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(10000);
                c.setUseCaches(true);
                c.setRequestProperty("User-Agent", "Mozilla/5.0 Audify/67.4");
                c.connect();
                if (c.getResponseCode() < 200 || c.getResponseCode() >= 300) return;
                android.graphics.Bitmap bitmap = android.graphics.BitmapFactory.decodeStream(c.getInputStream());
                if (bitmap == null) return;
                audifyThumbCacheV674.put(url, bitmap);
                runOnUiThread(() -> {
                    if (target.getTag() == tag) target.setImageBitmap(bitmap);
                });
            } catch (Throwable ignored) {
            } finally {
                if (c != null) c.disconnect();
            }
        });
    }

    private void audifyPlaySearchResultV674(java.util.List<AudifySearchItemV673> items, int selectedIndex) {
        if (items == null || selectedIndex < 0 || selectedIndex >= items.size()) return;
        try {
            org.json.JSONArray arr = new org.json.JSONArray();
            for (int i=0; i<items.size() && i<20; i++) {
                AudifySearchItemV673 t = items.get(i);
                org.json.JSONObject o = new org.json.JSONObject();
                o.put("id", t.id);
                o.put("title", t.title);
                o.put("artist", t.artist);
                o.put("thumbnail", t.thumbnail);
                arr.put(o);
            }
            org.json.JSONObject root = new org.json.JSONObject();
            root.put("items", arr);
            root.put("index", selectedIndex);
            startService(new android.content.Intent(this, AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_SET_QUEUE)
                .putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON, root.toString()));

            AudifySearchItemV673 chosen = items.get(selectedIndex);
            startService(new android.content.Intent(this, AudifyPlaybackService.class)
                .setAction(AudifyPlaybackService.ACTION_LOAD)
                .putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID, chosen.id)
                .putExtra(AudifyPlaybackService.EXTRA_TITLE, chosen.title)
                .putExtra(AudifyPlaybackService.EXTRA_ARTIST, chosen.artist)
                .putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL, chosen.thumbnail));

            android.widget.Toast.makeText(this, "Lecture : " + chosen.title, android.widget.Toast.LENGTH_SHORT).show();
        } catch (Throwable error) {
            android.widget.Toast.makeText(this, "Erreur lecture Audify", android.widget.Toast.LENGTH_SHORT).show();
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

        final java.util.ArrayList<AudifySearchItemV673> queueItems = new java.util.ArrayList<>(items);
        int displayIndex = 0;
        for (AudifySearchItemV673 item : items) {
            if (displayIndex >= 20) break;
            final int chosenIndex = displayIndex;
            displayIndex++;

            android.widget.LinearLayout card = new android.widget.LinearLayout(this);
            card.setOrientation(android.widget.LinearLayout.HORIZONTAL);
            card.setGravity(android.view.Gravity.CENTER_VERTICAL);
            card.setPadding(audifyDp(10), audifyDp(10), audifyDp(14), audifyDp(10));
            card.setClickable(true);
            card.setFocusable(true);

            android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
            bg.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
            bg.setColor(android.graphics.Color.rgb(18,23,31));
            bg.setStroke(audifyDp(1), android.graphics.Color.rgb(48,57,69));
            bg.setCornerRadius(audifyDp(18));
            android.content.res.ColorStateList rippleColor = android.content.res.ColorStateList.valueOf(android.graphics.Color.argb(58,168,255,63));
            card.setBackground(new android.graphics.drawable.RippleDrawable(rippleColor, bg, null));

            android.widget.ImageView image = new android.widget.ImageView(this);
            image.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);
            image.setBackgroundColor(android.graphics.Color.rgb(28,34,43));
            android.widget.LinearLayout.LayoutParams imageLp = new android.widget.LinearLayout.LayoutParams(audifyDp(128), audifyDp(72));
            imageLp.setMargins(0,0,audifyDp(14),0);
            card.addView(image, imageLp);
            audifyLoadThumbV674(item.thumbnail, image);

            android.widget.LinearLayout copy = new android.widget.LinearLayout(this);
            copy.setOrientation(android.widget.LinearLayout.VERTICAL);
            copy.setGravity(android.view.Gravity.CENTER_VERTICAL);
            android.widget.LinearLayout.LayoutParams copyLp = new android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
            card.addView(copy, copyLp);

            android.widget.TextView titleView = audifyResultTextV672(item.title, 17f, android.graphics.Color.WHITE);
            titleView.setPadding(0,0,0,audifyDp(6));
            titleView.setMaxLines(2);
            titleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
            copy.addView(titleView);

            android.widget.TextView metaView = audifyResultTextV672(item.artist, 13f, android.graphics.Color.rgb(170,178,190));
            metaView.setPadding(0,0,0,0);
            metaView.setMaxLines(1);
            metaView.setEllipsize(android.text.TextUtils.TruncateAt.END);
            copy.addView(metaView);

            android.widget.TextView playIcon = audifyResultTextV672("▶", 20f, android.graphics.Color.rgb(168,255,63));
            playIcon.setGravity(android.view.Gravity.CENTER);
            playIcon.setPadding(audifyDp(12),0,audifyDp(4),0);
            card.addView(playIcon, new android.widget.LinearLayout.LayoutParams(audifyDp(48), audifyDp(56)));

            card.setOnClickListener(v -> audifyPlaySearchResultV674(queueItems, chosenIndex));

            android.widget.LinearLayout.LayoutParams cardLp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            );
            cardLp.setMargins(0,0,0,audifyDp(10));
            audifySearchListV672.addView(card, cardLp);
        }
        audifySearchScrollV672.scrollTo(0,0);
    }

`;

main = main.slice(0, renderStart) + replacement + main.slice(renderEnd);

const shutdownMarker='        try { audifySearchExecutorV672.shutdownNow(); } catch (Exception ignored) {}';
if(main.includes(shutdownMarker) && !main.includes('audifyThumbExecutorV674.shutdownNow')) {
    main=main.replace(shutdownMarker, `${shutdownMarker}\n        try { audifyThumbExecutorV674.shutdownNow(); } catch (Exception ignored) {}`);
}

await writeFile(mainPath,main,'utf8');
console.log('Audify Android V67.4 : miniatures natives + cartes cliquables + lecture/queue ExoPlayer.');
