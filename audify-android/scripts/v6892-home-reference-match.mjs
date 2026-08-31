import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const homePath = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'nova', 'audify', 'NativeHomeActivity.java');
let home = await readFile(homePath, 'utf8');

function replaceBlock(startMarker, endMarker, replacement) {
  const start = home.indexOf(startMarker);
  const end = home.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Bloc Home introuvable: ${startMarker} -> ${endMarker}`);
  home = home.slice(0, start) + replacement + '\n\n' + home.slice(end);
}

// -----------------------------------------------------------------------------
// V68.9.2 — rapproche le Home Android des captures Audify Web :
// search pill sticky, hero favoris, grille compacte, grandes playlists,
// récents horizontaux et Pour toi, tout en gardant les vraies données natives.
// -----------------------------------------------------------------------------

replaceBlock(
  '    private LinearLayout buildStickySearchHeader(){',
  '    private void addSearchHeader(){',
String.raw`    private LinearLayout buildStickySearchHeader(){
        LinearLayout row=new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(12),dp(5),dp(7),dp(5));
        row.setBackground(round(Color.rgb(25,30,38),dp(1),Color.rgb(79,88,101),dp(34)));

        TextView hint=text("⌕  Rechercher un artiste ou un titre…",16f,false);
        hint.setTextColor(Color.rgb(151,159,173));
        hint.setMaxLines(1);
        hint.setEllipsize(TextUtils.TruncateAt.END);
        hint.setOnClickListener(v->openSearch());
        row.addView(hint,new LinearLayout.LayoutParams(0,dp(58),1f));

        Button search=greenButton("Rechercher");
        search.setTextSize(16f);
        search.setOnClickListener(v->openSearch());
        LinearLayout.LayoutParams searchLp=new LinearLayout.LayoutParams(dp(142),dp(54));
        searchLp.leftMargin=dp(6);
        row.addView(search,searchLp);
        return row;
    }`
);

replaceBlock(
  '    private void addRecentSection(){',
  '    private void addFavoritesIntro(){',
String.raw`    private void addRecentSection(){
        List<AudifyLibraryStore.Track> recents=store.getRecents();
        LinearLayout panel=sectionPanel();
        panel.setPadding(dp(14),dp(16),dp(14),dp(18));

        LinearLayout head=new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView title=text("Écoutés récemment",24f,true);
        head.addView(title,new LinearLayout.LayoutParams(0,dp(58),1f));
        Button all=pillButton("Tout voir");
        all.setTextSize(14f);
        all.setOnClickListener(v->showTrackPicker("Écoutés récemment",recents));
        head.addView(all,new LinearLayout.LayoutParams(dp(112),dp(50)));
        panel.addView(head,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(62)));

        if(recents.isEmpty()){
            TextView empty=text("Tes prochains morceaux écoutés apparaîtront ici.",15f,false);
            empty.setTextColor(Color.rgb(158,168,182));
            empty.setPadding(dp(2),dp(12),0,dp(18));
            panel.addView(empty);
        }else{
            HorizontalScrollView hsv=new HorizontalScrollView(this);
            hsv.setHorizontalScrollBarEnabled(false);
            hsv.setFillViewport(false);
            LinearLayout rail=new LinearLayout(this);
            rail.setOrientation(LinearLayout.HORIZONTAL);

            int screenW=getResources().getDisplayMetrics().widthPixels;
            int cardW=Math.min(dp(315),Math.max(dp(235),(int)(screenW*0.62f)));
            int cover=cardW-dp(22);

            for(int i=0;i<Math.min(12,recents.size());i++){
                AudifyLibraryStore.Track t=recents.get(i);
                LinearLayout card=new LinearLayout(this);
                card.setOrientation(LinearLayout.VERTICAL);
                card.setPadding(dp(10),dp(10),dp(10),dp(12));
                int stroke=i==0?Color.rgb(75,111,42):Color.rgb(44,52,63);
                card.setBackground(round(Color.rgb(10,15,22),dp(1),stroke,dp(23)));
                card.setOnClickListener(v->playTrack(t));

                ImageView art=artworkView();
                loadImage(art,t.thumbnail);
                card.addView(art,new LinearLayout.LayoutParams(cover,cover));

                TextView tt=text(t.title,18f,true);
                tt.setMaxLines(2);
                tt.setEllipsize(TextUtils.TruncateAt.END);
                tt.setPadding(dp(2),dp(11),0,0);
                card.addView(tt,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)));

                TextView aa=text(t.artist,14f,false);
                aa.setTextColor(Color.rgb(166,175,188));
                aa.setMaxLines(1);
                aa.setEllipsize(TextUtils.TruncateAt.END);
                aa.setPadding(dp(2),0,0,0);
                card.addView(aa,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(28)));

                LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(cardW,cover+dp(110));
                cp.rightMargin=dp(14);
                rail.addView(card,cp);
            }
            hsv.addView(rail,new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,ViewGroup.LayoutParams.WRAP_CONTENT));
            panel.addView(hsv,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        }
        addPanel(panel,dp(18));
    }`
);

replaceBlock(
  '    private void addFavoritesIntro(){',
  '    private void addLikesSection(){',
String.raw`    private void addFavoritesIntro(){
        LinearLayout intro=sectionPanel();
        intro.setPadding(dp(18),dp(18),dp(18),dp(20));

        TextView badge=text("AUDIFY HOME",12f,true);
        badge.setTextColor(ACCENT);
        badge.setGravity(Gravity.CENTER);
        badge.setLetterSpacing(0.13f);
        badge.setBackground(round(Color.rgb(30,49,24),0,Color.TRANSPARENT,dp(23)));
        intro.addView(badge,new LinearLayout.LayoutParams(dp(146),dp(42)));

        TextView h=text("Mes favoris",31f,true);
        LinearLayout.LayoutParams hlp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        hlp.topMargin=dp(16);
        intro.addView(h,hlp);

        TextView sub=text("Tous les titres que tu likes apparaissent ici automatiquement.",17f,false);
        sub.setTextColor(Color.rgb(180,189,202));
        sub.setLineSpacing(dp(1),1.08f);
        sub.setPadding(0,dp(9),0,dp(15));
        intro.addView(sub);

        Button install=pillButton("⇩  Installer Audify");
        install.setTextSize(16f);
        install.setTextColor(Color.rgb(226,255,203));
        install.setBackground(round(Color.rgb(25,44,24),dp(1),Color.rgb(76,126,38),dp(22)));
        install.setOnClickListener(v->Toast.makeText(this,"Audify est déjà installé sur cet appareil.",Toast.LENGTH_SHORT).show());
        intro.addView(install,new LinearLayout.LayoutParams(dp(190),dp(54)));

        addPanel(intro,dp(18));
    }`
);

replaceBlock(
  '    private void addLikesSection(){',
  '    private View likeCard(AudifyLibraryStore.Track t){',
String.raw`    private void addLikesSection(){
        List<AudifyLibraryStore.Track> likes=store.getLikes();
        LinearLayout panel=sectionPanel();
        panel.setPadding(dp(14),dp(14),dp(14),dp(18));

        LinearLayout head=new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView title=text("Titres likés",24f,true);
        head.addView(title);
        TextView count=text("  "+likes.size()+" favoris",14f,false);
        count.setTextColor(Color.rgb(173,183,197));
        head.addView(count,new LinearLayout.LayoutParams(0,dp(54),1f));
        Button all=pillButton("Voir tous les favoris");
        all.setTextSize(13f);
        all.setOnClickListener(v->showTrackPicker("Titres likés",likes));
        head.addView(all,new LinearLayout.LayoutParams(dp(172),dp(48)));
        panel.addView(head,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(62)));

        if(likes.isEmpty()){
            TextView empty=text("Aucun favori pour l’instant.",15f,false);
            empty.setTextColor(Color.rgb(155,165,178));
            panel.addView(empty,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(64)));
        }else{
            int shown=Math.min(6,likes.size());
            int screenW=getResources().getDisplayMetrics().widthPixels;
            boolean twoColumns=screenW>=dp(390);

            if(twoColumns){
                for(int i=0;i<shown;i+=2){
                    LinearLayout row=new LinearLayout(this);
                    row.setGravity(Gravity.CENTER_VERTICAL);
                    row.addView(likeCard(likes.get(i)),new LinearLayout.LayoutParams(0,dp(100),1f));
                    if(i+1<shown){
                        LinearLayout.LayoutParams second=new LinearLayout.LayoutParams(0,dp(100),1f);
                        second.leftMargin=dp(8);
                        row.addView(likeCard(likes.get(i+1)),second);
                    }else{
                        View blank=new View(this);
                        LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(0,dp(100),1f);
                        bp.leftMargin=dp(8);
                        row.addView(blank,bp);
                    }
                    LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(106));
                    rp.topMargin=dp(4);
                    panel.addView(row,rp);
                }
            }else{
                for(int i=0;i<shown;i++){
                    LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(98));
                    cp.topMargin=dp(6);
                    panel.addView(likeCard(likes.get(i)),cp);
                }
            }
        }
        addPanel(panel,dp(18));
    }`
);

replaceBlock(
  '    private View likeCard(AudifyLibraryStore.Track t){',
  '    private void addPlaylistsSection(){',
String.raw`    private View likeCard(AudifyLibraryStore.Track t){
        LinearLayout card=new LinearLayout(this);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(8),dp(8),dp(7),dp(8));
        card.setBackground(round(Color.rgb(11,16,23),dp(1),Color.rgb(44,52,63),dp(18)));

        ImageView art=artworkView();
        loadImage(art,t.thumbnail);
        card.addView(art,new LinearLayout.LayoutParams(dp(54),dp(54)));

        LinearLayout info=new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setPadding(dp(8),0,dp(4),0);
        info.setOnClickListener(v->playTrack(t));
        TextView tt=text(t.title,13.5f,true);
        tt.setMaxLines(2);
        tt.setEllipsize(TextUtils.TruncateAt.END);
        TextView aa=text(t.artist,11.5f,false);
        aa.setTextColor(Color.rgb(166,175,188));
        aa.setMaxLines(1);
        aa.setEllipsize(TextUtils.TruncateAt.END);
        info.addView(tt,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(38)));
        info.addView(aa,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(20)));
        card.addView(info,new LinearLayout.LayoutParams(0,dp(60),1f));

        LinearLayout actions=new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER);
        Button playlist=smallSquare("≡+");
        playlist.setTextSize(13f);
        playlist.setContentDescription("Ajouter à une playlist");
        playlist.setOnClickListener(v->showPlaylistPickerForTrack(t));
        Button heart=smallSquare("♥");
        heart.setTextSize(15f);
        heart.setTextColor(Color.rgb(255,79,119));
        heart.setContentDescription("Retirer des favoris");
        heart.setOnClickListener(v->{store.toggleLike(t);rebuildLibrary();});
        actions.addView(playlist,new LinearLayout.LayoutParams(dp(34),dp(34)));
        LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(dp(34),dp(34));
        hp.leftMargin=dp(4);
        actions.addView(heart,hp);
        card.addView(actions,new LinearLayout.LayoutParams(dp(74),dp(58)));
        return card;
    }`
);

replaceBlock(
  '    private void addPlaylistsSection(){',
  '    private void addForYouSection(){',
String.raw`    private void addPlaylistsSection(){
        List<String> names=store.getPlaylistNames();
        LinearLayout panel=sectionPanel();
        panel.setPadding(dp(14),dp(16),dp(14),dp(18));

        LinearLayout head=new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView title=text("Playlists",25f,true);
        head.addView(title,new LinearLayout.LayoutParams(0,dp(62),1f));
        Button create=greenButton("＋ Créer une playlist");
        create.setTextSize(14f);
        create.setOnClickListener(v->promptCreatePlaylist());
        head.addView(create,new LinearLayout.LayoutParams(dp(194),dp(54)));
        panel.addView(head,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(68)));

        if(names.isEmpty()){
            TextView empty=text("Crée ta première playlist pour la retrouver ici.",15f,false);
            empty.setTextColor(Color.rgb(155,165,178));
            panel.addView(empty,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(66)));
        }else{
            int screenW=getResources().getDisplayMetrics().widthPixels;
            int artH=Math.min(dp(285),Math.max(dp(205),(int)(screenW*0.49f)));
            for(String name:names){
                List<AudifyLibraryStore.Track> tracks=store.getPlaylist(name);
                LinearLayout card=new LinearLayout(this);
                card.setOrientation(LinearLayout.VERTICAL);
                card.setPadding(dp(12),dp(12),dp(12),dp(12));
                card.setBackground(round(Color.rgb(10,15,22),dp(1),Color.rgb(45,53,64),dp(25)));

                ImageView art=artworkView();
                if(!tracks.isEmpty()) loadImage(art,tracks.get(0).thumbnail);
                else art.setBackgroundColor(Color.rgb(31,37,47));
                card.addView(art,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,artH));

                TextView nameView=text(name,20f,true);
                nameView.setPadding(dp(4),dp(11),0,0);
                card.addView(nameView,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));

                TextView meta=text(tracks.size()+" titre"+(tracks.size()>1?"s":""),15f,false);
                meta.setTextColor(Color.rgb(177,186,199));
                meta.setPadding(dp(4),0,0,0);
                card.addView(meta,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(32)));

                Button open=pillButton("Ouvrir");
                open.setTextSize(17f);
                open.setOnClickListener(v->showPlaylist(name));
                LinearLayout.LayoutParams op=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58));
                op.topMargin=dp(8);
                card.addView(open,op);

                LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,artH+dp(174));
                cp.topMargin=dp(12);
                panel.addView(card,cp);
            }
        }
        addPanel(panel,dp(18));
    }`
);

replaceBlock(
  '    private void addForYouSection(){',
  '    private void showPlaylistPickerForTrack(AudifyLibraryStore.Track track){',
String.raw`    private void addForYouSection(){
        LinearLayout panel=sectionPanel();
        panel.setPadding(dp(14),dp(18),dp(14),dp(18));

        TextView eyebrow=text("AUDIFY POUR TOI",12f,true);
        eyebrow.setTextColor(ACCENT);
        eyebrow.setLetterSpacing(0.14f);
        panel.addView(eyebrow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30)));

        TextView title=text("Pour toi",31f,true);
        panel.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));

        TextView sub=text("Basé sur tes écoutes, tes likes et les artistes que tu gardes longtemps.",15f,false);
        sub.setTextColor(Color.rgb(178,187,201));
        sub.setPadding(0,0,0,dp(12));
        panel.addView(sub);

        java.util.LinkedHashMap<String,AudifyLibraryStore.Track> artists=new java.util.LinkedHashMap<>();
        for(AudifyLibraryStore.Track t:store.getRecents()){
            if(t!=null&&!t.artist.isEmpty()&&!artists.containsKey(t.artist)) artists.put(t.artist,t);
            if(artists.size()>=8) break;
        }
        if(artists.size()<8){
            for(AudifyLibraryStore.Track t:store.getLikes()){
                if(t!=null&&!t.artist.isEmpty()&&!artists.containsKey(t.artist)) artists.put(t.artist,t);
                if(artists.size()>=8) break;
            }
        }

        if(artists.isEmpty()){
            TextView empty=text("Écoute et like quelques titres pour construire tes recommandations.",14f,false);
            empty.setTextColor(Color.rgb(160,169,182));
            empty.setPadding(0,dp(8),0,dp(10));
            panel.addView(empty);
        }else{
            HorizontalScrollView hsv=new HorizontalScrollView(this);
            hsv.setHorizontalScrollBarEnabled(false);
            hsv.setFillViewport(false);
            LinearLayout rail=new LinearLayout(this);
            rail.setOrientation(LinearLayout.HORIZONTAL);

            int cardW=dp(244);
            int cover=dp(150);
            for(java.util.Map.Entry<String,AudifyLibraryStore.Track> entry:artists.entrySet()){
                String artist=entry.getKey();
                AudifyLibraryStore.Track sample=entry.getValue();
                LinearLayout card=new LinearLayout(this);
                card.setOrientation(LinearLayout.VERTICAL);
                card.setPadding(dp(9),dp(9),dp(9),dp(10));
                card.setBackground(round(Color.rgb(10,15,22),dp(1),Color.rgb(45,54,65),dp(21)));
                card.setOnClickListener(v->playTrack(sample));

                ImageView art=artworkView();
                loadImage(art,sample.thumbnail);
                card.addView(art,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,cover));

                TextView name=text(artist,17f,true);
                name.setMaxLines(1);
                name.setEllipsize(TextUtils.TruncateAt.END);
                name.setPadding(dp(2),dp(9),0,0);
                card.addView(name,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(38)));

                TextView desc=text("proche de tes écoutes",12f,false);
                desc.setTextColor(Color.rgb(166,176,190));
                desc.setPadding(dp(2),0,0,0);
                card.addView(desc,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(26)));

                LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(cardW,dp(238));
                cp.rightMargin=dp(12);
                rail.addView(card,cp);
            }
            hsv.addView(rail,new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,dp(240)));
            panel.addView(hsv,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(246)));
        }
        addPanel(panel,dp(18));
    }`
);

// Le Home doit garder l'ordre exact des captures : hero -> likes -> playlists -> récents -> pour toi.
const rebuildStart=home.indexOf('    private void rebuildLibrary(){');
const rebuildEnd=home.indexOf('    private LinearLayout buildStickySearchHeader(){',rebuildStart);
if(rebuildStart<0||rebuildEnd<0) throw new Error('rebuildLibrary V68.9.2 introuvable');
const rebuild=String.raw`    private void rebuildLibrary(){
        libraryContent.removeAllViews();
        addFavoritesIntro();
        addLikesSection();
        addPlaylistsSection();
        addRecentSection();
        addForYouSection();
    }

`;
home=home.slice(0,rebuildStart)+rebuild+home.slice(rebuildEnd);

// Un peu plus d'air sous la barre sticky et sous le mini-player.
home=home.replace('libraryContent.setPadding(dp(12),dp(14),dp(12),dp(155));','libraryContent.setPadding(dp(10),dp(10),dp(10),dp(164));');

await writeFile(homePath,home,'utf8');
console.log('Audify Android V68.9.2 : Home premium aligné sur les captures de référence.');
