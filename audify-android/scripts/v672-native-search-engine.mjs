import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');
let main=await readFile(mainPath,'utf8');

const classMarker='public class MainActivity extends BridgeActivity {';
if(!main.includes(classMarker)) throw new Error('MainActivity introuvable pour V67.2');

const members=String.raw`
    // V67.2 — moteur de recherche YouTube 100 % natif Android.
    // Aucune dépendance au DOM/WebView pour lancer ou afficher une recherche.
    private final java.util.concurrent.ExecutorService audifySearchExecutorV672 = java.util.concurrent.Executors.newSingleThreadExecutor();
    private android.widget.ScrollView audifySearchScrollV672;
    private android.widget.LinearLayout audifySearchListV672;
    private int audifySearchGenerationV672 = 0;

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

    private void renderAudifyNativeResultsV672(java.util.List<org.schabi.newpipe.extractor.stream.StreamInfoItem> items, String query, int generation) {
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
        for (org.schabi.newpipe.extractor.stream.StreamInfoItem item : items) {
            if (index++ >= 25) break;

            android.widget.LinearLayout card = new android.widget.LinearLayout(this);
            card.setOrientation(android.widget.LinearLayout.VERTICAL);
            card.setPadding(audifyDp(18), audifyDp(15), audifyDp(18), audifyDp(15));

            android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
            bg.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
            bg.setColor(android.graphics.Color.rgb(18,23,31));
            bg.setStroke(audifyDp(1), android.graphics.Color.rgb(48,57,69));
            bg.setCornerRadius(audifyDp(18));
            card.setBackground(bg);

            String title = item.getName() == null ? "Sans titre" : item.getName();
            String uploader = item.getUploaderName() == null ? "YouTube" : item.getUploaderName();
            long duration = item.getDuration();
            String durationText = duration > 0 ? "  •  " + (duration / 60) + ":" + String.format(java.util.Locale.US, "%02d", duration % 60) : "";

            android.widget.TextView titleView = audifyResultTextV672(title, 17f, android.graphics.Color.WHITE);
            titleView.setPadding(0,0,0,audifyDp(6));
            titleView.setMaxLines(2);
            titleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
            card.addView(titleView);

            android.widget.TextView metaView = audifyResultTextV672(uploader + durationText, 13f, android.graphics.Color.rgb(170,178,190));
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

    private void runAudifyNativeSearchV672(String rawQuery) {
        final String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.isEmpty()) return;
        final int generation = ++audifySearchGenerationV672;
        showAudifySearchStatusV672("Recherche YouTube de « " + query + " »…", false);

        audifySearchExecutorV672.execute(() -> {
            try {
                // Initialisation indépendante : la recherche fonctionne même avant le premier morceau joué.
                try { org.schabi.newpipe.extractor.NewPipe.init(new AudifyDownloader()); } catch (Throwable ignored) {}
                org.schabi.newpipe.extractor.search.SearchExtractor extractor =
                    org.schabi.newpipe.extractor.ServiceList.YouTube.getSearchExtractor(query);
                org.schabi.newpipe.extractor.search.SearchInfo info =
                    org.schabi.newpipe.extractor.search.SearchInfo.getInfo(extractor);

                java.util.ArrayList<org.schabi.newpipe.extractor.stream.StreamInfoItem> videos = new java.util.ArrayList<>();
                for (org.schabi.newpipe.extractor.InfoItem item : info.getRelatedItems()) {
                    if (item instanceof org.schabi.newpipe.extractor.stream.StreamInfoItem) {
                        org.schabi.newpipe.extractor.stream.StreamInfoItem stream = (org.schabi.newpipe.extractor.stream.StreamInfoItem) item;
                        if (!stream.isShortFormContent()) videos.add(stream);
                    }
                }
                runOnUiThread(() -> renderAudifyNativeResultsV672(videos, query, generation));
            } catch (Throwable error) {
                String message = error.getMessage();
                if (message == null || message.trim().isEmpty()) message = error.getClass().getSimpleName();
                final String finalMessage = message;
                runOnUiThread(() -> {
                    if (generation != audifySearchGenerationV672) return;
                    showAudifySearchStatusV672("Erreur recherche YouTube native :\n" + finalMessage, true);
                });
            }
        });
    }
`;
main=main.replace(classMarker,classMarker+members);

const submitMarker='audifyPendingSearchV671 = query;';
if(!main.includes(submitMarker)) throw new Error('submitAudifyNativeSearchV671 introuvable pour V67.2');
main=main.replace(submitMarker, `${submitMarker}\n            runAudifyNativeSearchV672(query);`);

const destroyMarker='    @Override\n    protected void onDestroy() {';
if(main.includes(destroyMarker) && !main.includes('audifySearchExecutorV672.shutdownNow')){
  main=main.replace(destroyMarker, `${destroyMarker}\n        try { audifySearchExecutorV672.shutdownNow(); } catch (Exception ignored) {}`);
}

await writeFile(mainPath,main,'utf8');
console.log('Audify Android V67.2 : moteur + résultats YouTube 100% natifs, sans WebView.');
