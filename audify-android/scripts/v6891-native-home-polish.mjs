import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const homePath=path.join(root,'android','app','src','main','java','com','nova','audify','NativeHomeActivity.java');
let home=await readFile(homePath,'utf8');

// -----------------------------------------------------------------------------
// 1) La barre de recherche devient réellement sticky au-dessus du ScrollView.
// -----------------------------------------------------------------------------
const scrollNeedle='        root.addView(scroll,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));';
if(!home.includes(scrollNeedle)) throw new Error('Scroll root Home V68.9 introuvable');
home=home.replace(scrollNeedle,`        FrameLayout.LayoutParams scrollLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT);\n        scrollLp.topMargin=dp(82);\n        root.addView(scroll,scrollLp);\n\n        LinearLayout stickySearch=buildStickySearchHeader();\n        FrameLayout.LayoutParams stickyLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(70),Gravity.TOP);\n        stickyLp.setMargins(dp(10),dp(6),dp(10),0);\n        stickySearch.setElevation(dp(16));\n        root.addView(stickySearch,stickyLp);`);

// -----------------------------------------------------------------------------
// 2) Ordre visuel conforme aux captures Web.
// -----------------------------------------------------------------------------
const rebuildStart=home.indexOf('    private void rebuildLibrary(){');
const searchMethodStart=home.indexOf('    private void addSearchHeader(){',rebuildStart);
if(rebuildStart<0||searchMethodStart<0) throw new Error('rebuildLibrary Home V68.9 introuvable');
const rebuilt=String.raw`    private void rebuildLibrary(){
        libraryContent.removeAllViews();
        addFavoritesIntro();
        addLikesSection();
        addPlaylistsSection();
        addRecentSection();
        addForYouSection();
    }

    private LinearLayout buildStickySearchHeader(){
        LinearLayout row=new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(14),dp(6),dp(8),dp(6));
        row.setBackground(round(Color.rgb(29,34,42),dp(1),Color.rgb(83,91,103),dp(31)));

        TextView hint=text("⌕  Rechercher un artiste ou un titre…",16f,false);
        hint.setTextColor(Color.rgb(160,168,181));
        hint.setMaxLines(1);
        hint.setEllipsize(TextUtils.TruncateAt.END);
        hint.setOnClickListener(v->openSearch());
        row.addView(hint,new LinearLayout.LayoutParams(0,dp(58),1f));

        Button search=greenButton("Rechercher");
        search.setOnClickListener(v->openSearch());
        row.addView(search,new LinearLayout.LayoutParams(dp(138),dp(52)));
        return row;
    }

`;
home=home.slice(0,rebuildStart)+rebuilt+home.slice(searchMethodStart);

// -----------------------------------------------------------------------------
// 3) Carte d'introduction Mes favoris avec badge AUDIFY HOME.
// -----------------------------------------------------------------------------
const introStart=home.indexOf('    private void addFavoritesIntro(){');
const likesStart=home.indexOf('    private void addLikesSection(){',introStart);
if(introStart<0||likesStart<0) throw new Error('addFavoritesIntro Home V68.9 introuvable');
const intro=String.raw`    private void addFavoritesIntro(){
        LinearLayout intro=sectionPanel();

        TextView badge=text("AUDIFY HOME",12f,true);
        badge.setTextColor(ACCENT);
        badge.setGravity(Gravity.CENTER);
        badge.setLetterSpacing(0.12f);
        badge.setBackground(round(Color.rgb(32,52,27),0,Color.TRANSPARENT,dp(22)));
        intro.addView(badge,new LinearLayout.LayoutParams(dp(142),dp(38)));

        TextView h=text("Mes favoris",29f,true);
        LinearLayout.LayoutParams hlp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);
        hlp.topMargin=dp(12);
        intro.addView(h,hlp);

        TextView sub=text("Tous les titres que tu likes apparaissent ici automatiquement.",16f,false);
        sub.setTextColor(Color.rgb(178,187,201));
        sub.setPadding(0,dp(7),0,dp(4));
        intro.addView(sub);
        addPanel(intro,dp(12));
    }

`;
home=home.slice(0,introStart)+intro+home.slice(likesStart);

// -----------------------------------------------------------------------------
// 4) Dans les petites cartes de favoris : vrai bouton Playlist + Like.
// -----------------------------------------------------------------------------
const oldCompact=`        Button queue=smallSquare("≡+"); queue.setContentDescription("Ajouter à la file"); queue.setOnClickListener(v->enqueueTrack(t));\n        Button heart=smallSquare("♥"); heart.setTextColor(Color.rgb(255,79,119)); heart.setContentDescription("Retirer des favoris");\n        heart.setOnClickListener(v->{store.toggleLike(t);rebuildLibrary();});\n        actions.addView(queue,new LinearLayout.LayoutParams(dp(44),dp(40))); actions.addView(heart,new LinearLayout.LayoutParams(dp(44),dp(40)));`;
if(!home.includes(oldCompact)) throw new Error('Actions cartes favoris V68.9 introuvables');
const newCompact=`        Button playlist=smallSquare("≡+"); playlist.setContentDescription("Ajouter à une playlist"); playlist.setOnClickListener(v->showPlaylistPickerForTrack(t));\n        Button heart=smallSquare("♥"); heart.setTextColor(Color.rgb(255,79,119)); heart.setContentDescription("Retirer des favoris");\n        heart.setOnClickListener(v->{store.toggleLike(t);rebuildLibrary();});\n        actions.addView(playlist,new LinearLayout.LayoutParams(dp(44),dp(40))); actions.addView(heart,new LinearLayout.LayoutParams(dp(44),dp(40)));`;
home=home.replace(oldCompact,newCompact);

// -----------------------------------------------------------------------------
// 5) Section Pour toi : suggestions horizontales inspirées du Web.
// -----------------------------------------------------------------------------
const miniMarker='    private LinearLayout buildMiniPlayer(){';
if(!home.includes(miniMarker)) throw new Error('buildMiniPlayer Home V68.9 introuvable');
const forYou=String.raw`    private void addForYouSection(){
        LinearLayout panel=sectionPanel();

        TextView eyebrow=text("AUDIFY POUR TOI",12f,true);
        eyebrow.setTextColor(ACCENT);
        eyebrow.setLetterSpacing(0.13f);
        panel.addView(eyebrow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30)));

        TextView title=text("Pour toi",29f,true);
        panel.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(46)));

        TextView sub=text("Basé sur tes écoutes, tes likes et les artistes que tu gardes longtemps.",15f,false);
        sub.setTextColor(Color.rgb(178,187,201));
        sub.setPadding(0,0,0,dp(10));
        panel.addView(sub);

        LinearLayout chips=new LinearLayout(this);
        chips.setGravity(Gravity.START|Gravity.CENTER_VERTICAL);
        TextView rap=text("Rap / Hip-Hop",13f,true);
        rap.setGravity(Gravity.CENTER);
        rap.setTextColor(Color.rgb(230,236,226));
        rap.setBackground(round(Color.rgb(24,40,24),dp(1),Color.rgb(72,116,38),dp(22)));
        chips.addView(rap,new LinearLayout.LayoutParams(dp(132),dp(42)));
        TextView pop=text("Pop",13f,true);
        pop.setGravity(Gravity.CENTER);
        pop.setTextColor(Color.rgb(230,236,226));
        pop.setBackground(round(Color.rgb(24,40,24),dp(1),Color.rgb(72,116,38),dp(22)));
        LinearLayout.LayoutParams popLp=new LinearLayout.LayoutParams(dp(72),dp(42)); popLp.leftMargin=dp(10);
        chips.addView(pop,popLp);
        panel.addView(chips,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54)));

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

            for(java.util.Map.Entry<String,AudifyLibraryStore.Track> entry:artists.entrySet()){
                String artist=entry.getKey();
                AudifyLibraryStore.Track sample=entry.getValue();
                LinearLayout card=new LinearLayout(this);
                card.setGravity(Gravity.CENTER_VERTICAL);
                card.setPadding(dp(10),dp(8),dp(10),dp(8));
                card.setBackground(round(Color.rgb(26,31,39),dp(1),Color.rgb(55,63,75),dp(20)));
                card.setOnClickListener(v->playTrack(sample));

                TextView avatar=text(artist.isEmpty()?"A":artist.substring(0,1).toUpperCase(),22f,true);
                avatar.setTextColor(Color.rgb(10,15,10));
                avatar.setGravity(Gravity.CENTER);
                avatar.setBackground(round(Color.rgb(189,255,119),0,Color.TRANSPARENT,dp(18)));
                card.addView(avatar,new LinearLayout.LayoutParams(dp(58),dp(58)));

                LinearLayout info=new LinearLayout(this);
                info.setOrientation(LinearLayout.VERTICAL);
                info.setPadding(dp(12),0,dp(8),0);
                TextView name=text(artist,17f,true);
                name.setMaxLines(1); name.setEllipsize(TextUtils.TruncateAt.END);
                info.addView(name,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(31)));
                TextView desc=text("proche de tes écoutes",12f,false);
                desc.setTextColor(Color.rgb(166,176,190));
                info.addView(desc,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(25)));
                card.addView(info,new LinearLayout.LayoutParams(0,dp(60),1f));

                TextView arrow=text("›",28f,true); arrow.setTextColor(Color.rgb(150,160,174)); arrow.setGravity(Gravity.CENTER);
                card.addView(arrow,new LinearLayout.LayoutParams(dp(28),dp(58)));

                LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(dp(270),dp(86));
                cp.rightMargin=dp(12);
                rail.addView(card,cp);
            }
            hsv.addView(rail,new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,dp(90)));
            panel.addView(hsv,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(98)));
        }
        addPanel(panel,dp(16));
    }

    private void showPlaylistPickerForTrack(AudifyLibraryStore.Track track){
        if(track==null||track.id.isEmpty()) return;
        ArrayList<String> choices=new ArrayList<>(store.getPlaylistNames());
        choices.add(0,"＋ Nouvelle playlist…");
        new AlertDialog.Builder(this)
            .setTitle("Ajouter à une playlist")
            .setItems(choices.toArray(new String[0]),(dialog,which)->{
                if(which==0){ promptNewPlaylistForTrack(track); return; }
                String name=choices.get(which);
                store.addToPlaylist(name,track);
                Toast.makeText(this,"Ajouté à « "+name+" »",Toast.LENGTH_SHORT).show();
                rebuildLibrary();
            })
            .setNegativeButton("Annuler",null)
            .show();
    }

    private void promptNewPlaylistForTrack(AudifyLibraryStore.Track track){
        EditText input=new EditText(this);
        input.setHint("Nom de la playlist");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setPadding(dp(18),dp(16),dp(18),dp(16));
        new AlertDialog.Builder(this)
            .setTitle("Nouvelle playlist")
            .setView(input)
            .setPositiveButton("Créer",(dialog,which)->{
                String name=input.getText()==null?"":input.getText().toString().trim();
                if(name.isEmpty()) name="Ma playlist";
                store.createPlaylist(name);
                store.addToPlaylist(name,track);
                Toast.makeText(this,"Ajouté à « "+name+" »",Toast.LENGTH_SHORT).show();
                rebuildLibrary();
            })
            .setNegativeButton("Annuler",null)
            .show();
    }

`;
home=home.replace(miniMarker,forYou+miniMarker);

await writeFile(homePath,home,'utf8');
console.log('Audify Android V68.9.1 : Home Web-style poli (sticky search, ordre sections, Playlist+Like, Pour toi).');
