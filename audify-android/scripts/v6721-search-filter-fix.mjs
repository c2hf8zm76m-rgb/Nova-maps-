import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const mainPath=path.join(root,'android','app','src','main','java','com','nova','audify','MainActivity.java');
let main=await readFile(mainPath,'utf8');

const oldBlock=String.raw`                org.schabi.newpipe.extractor.search.SearchExtractor extractor =
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
                runOnUiThread(() -> renderAudifyNativeResultsV672(videos, query, generation));`;

if(!main.includes(oldBlock)) throw new Error('Bloc de recherche V67.2 introuvable');

const newBlock=String.raw`                // V67.2.1 : YouTube distingue explicitement les filtres de recherche.
                // On commence par les videos, puis YouTube Music, au lieu du filtre implicite "all".
                java.util.ArrayList<org.schabi.newpipe.extractor.stream.StreamInfoItem> videos = new java.util.ArrayList<>();
                java.util.HashSet<String> seenUrls = new java.util.HashSet<>();
                java.util.ArrayList<String> diagnostics = new java.util.ArrayList<>();
                String[] filters = new String[]{"videos", "music_songs", "music_videos", "all"};

                for (String filter : filters) {
                    try {
                        org.schabi.newpipe.extractor.search.SearchExtractor extractor =
                            org.schabi.newpipe.extractor.ServiceList.YouTube.getSearchExtractor(
                                query,
                                java.util.Collections.singletonList(filter),
                                ""
                            );
                        org.schabi.newpipe.extractor.search.SearchInfo info =
                            org.schabi.newpipe.extractor.search.SearchInfo.getInfo(extractor);

                        int before = videos.size();
                        int related = 0;
                        for (org.schabi.newpipe.extractor.InfoItem item : info.getRelatedItems()) {
                            related++;
                            if (item instanceof org.schabi.newpipe.extractor.stream.StreamInfoItem) {
                                org.schabi.newpipe.extractor.stream.StreamInfoItem stream =
                                    (org.schabi.newpipe.extractor.stream.StreamInfoItem) item;
                                String url = stream.getUrl();
                                String key = (url == null || url.isEmpty()) ? stream.getName() : url;
                                if (key == null) key = "item-" + related;
                                if (seenUrls.add(key)) videos.add(stream);
                            }
                        }
                        diagnostics.add(filter + ":" + related + "/" + (videos.size()-before));
                        if (!videos.isEmpty()) break;
                    } catch (Throwable filterError) {
                        diagnostics.add(filter + ":ERR-" + filterError.getClass().getSimpleName());
                    }
                }

                if (videos.isEmpty()) {
                    final String detail = android.text.TextUtils.join("  ", diagnostics);
                    runOnUiThread(() -> {
                        if (generation != audifySearchGenerationV672) return;
                        showAudifySearchStatusV672(
                            "Aucun resultat YouTube pour « " + query + " »\n\nDiagnostic NewPipe : " + detail,
                            false
                        );
                    });
                } else {
                    runOnUiThread(() -> renderAudifyNativeResultsV672(videos, query, generation));
                }`;

main=main.replace(oldBlock,newBlock);
await writeFile(mainPath,main,'utf8');
console.log('Audify Android V67.2.1 : filtres videos/music explicites + diagnostic NewPipe.');
