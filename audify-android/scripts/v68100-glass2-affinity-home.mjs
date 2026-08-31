import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
const servicePath=path.join(pkgDir,'AudifyPlaybackService.java');
const wavesPath=path.join(pkgDir,'AudioWavesView.java');

function replaceMethod(source, signatures, replacement, label){
  for(const sig of signatures){
    const start=source.indexOf(sig);
    if(start<0) continue;
    const brace=source.indexOf('{',start);
    if(brace<0) continue;
    let depth=0,end=-1;
    for(let i=brace;i<source.length;i++){
      if(source[i]==='{') depth++;
      else if(source[i]==='}'){
        depth--;
        if(depth===0){end=i+1;break;}
      }
    }
    if(end>0) return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error(`V68.10.0 méthode introuvable: ${label}`);
}

function replaceRequired(source, needle, replacement, label){
  if(!source.includes(needle)) throw new Error(`V68.10.0 bloc introuvable: ${label}`);
  return source.replace(needle,replacement);
}

// =============================================================================
// 1) MOTEUR D'AFFINITÉ LOCAL — scores artistes / genres selon les interactions.
// =============================================================================
const affinityStore=String.raw`package com.nova.audify;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.Locale;
import java.util.Map;

/** Audify V68.10.0 — profil d'affinité musical local et privé. */
public final class AudifyAffinityStore {
    private static final String PREFS="audify_affinity_v68100";
    private static final String ARTIST_PREFIX="artist:";
    private static final String GENRE_PREFIX="genre:";
    private final SharedPreferences prefs;

    public AudifyAffinityStore(Context context){
        prefs=context.getApplicationContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE);
    }

    public void recordPlay(AudifyLibraryStore.Track t){ add(t,3); }
    public void recordReplay(AudifyLibraryStore.Track t){ add(t,5); }
    public void recordLike(AudifyLibraryStore.Track t,boolean liked){ add(t,liked?14:-10); }
    public void recordPlaylist(AudifyLibraryStore.Track t){ add(t,16); }
    public void recordRepeat(AudifyLibraryStore.Track t){ add(t,12); }
    public void recordSkip(AudifyLibraryStore.Track t){ add(t,-4); }

    private void add(AudifyLibraryStore.Track t,int delta){
        if(t==null||t.id.isEmpty()) return;
        String artist=normalize(t.artist);
        if(!artist.isEmpty()) increment(ARTIST_PREFIX+artist,delta);
        String genre=inferGenre(t);
        if(!genre.isEmpty()) increment(GENRE_PREFIX+genre,delta);
    }

    private void increment(String key,int delta){
        int next=Math.max(-1000,Math.min(10000,prefs.getInt(key,0)+delta));
        prefs.edit().putInt(key,next).apply();
    }

    public int artistScore(String artist){
        String key=normalize(artist);
        return key.isEmpty()?0:prefs.getInt(ARTIST_PREFIX+key,0);
    }

    public int scoreFor(AudifyLibraryStore.Track t){
        if(t==null) return 0;
        int score=artistScore(t.artist);
        String genre=inferGenre(t);
        if(!genre.isEmpty()) score+=Math.max(0,prefs.getInt(GENRE_PREFIX+genre,0))/3;
        return score;
    }

    public String topGenre(){
        String best=""; int bestScore=0;
        for(Map.Entry<String,?> e:prefs.getAll().entrySet()){
            String k=e.getKey();
            if(!k.startsWith(GENRE_PREFIX)||!(e.getValue() instanceof Integer)) continue;
            int score=(Integer)e.getValue();
            if(score>bestScore){ bestScore=score; best=k.substring(GENRE_PREFIX.length()); }
        }
        return bestScore>0?pretty(best):"";
    }

    private String inferGenre(AudifyLibraryStore.Track t){
        String text=((t.title==null?"":t.title)+" "+(t.artist==null?"":t.artist)).toLowerCase(Locale.ROOT);
        if(text.contains("drill")) return "drill";
        if(text.contains("rap")||text.contains("freestyle")||text.contains("hip hop")||text.contains("hip-hop")) return "hip-hop / rap";
        if(text.contains("afro")||text.contains("amapiano")) return "afro / amapiano";
        if(text.contains("r&b")||text.contains("rnb")) return "r&b";
        if(text.contains("pop")) return "pop";
        if(text.contains("rock")||text.contains("metal")) return "rock";
        if(text.contains("electro")||text.contains("techno")||text.contains("house")) return "électro";
        return "";
    }

    private String normalize(String s){ return s==null?"":s.trim().toLowerCase(Locale.ROOT); }
    private String pretty(String s){
        if(s==null||s.isEmpty()) return "";
        if(s.equals("hip-hop / rap")) return "Hip-Hop / Rap";
        if(s.equals("r&b")) return "R&B";
        if(s.equals("afro / amapiano")) return "Afro / Amapiano";
        if(s.equals("électro")) return "Électro";
        return Character.toUpperCase(s.charAt(0))+s.substring(1);
    }
}
`;
await writeFile(path.join(pkgDir,'AudifyAffinityStore.java'),affinityStore,'utf8');

// =============================================================================
// 2) PLAYER GLASS 2.0 — plus compact, plus vert, Repeat propre.
// =============================================================================
let player=await readFile(playerPath,'utf8');

if(!player.includes('private View repeatGlow;')){
  player=player.replace('    private Button repeatButton;','    private Button repeatButton;\n    private View repeatGlow;');
}

// Panneau principal : verre plus moderne avec une nuance Audify verte.
const controlsStart='        LinearLayout controls=new LinearLayout(this);';
const controlsEnd='        LinearLayout controlTop=new LinearLayout(this);';
const cs=player.indexOf(controlsStart), ce=player.indexOf(controlsEnd,cs);
if(cs<0||ce<0) throw new Error('V68.10.0 panneau controls introuvable');
player=player.slice(0,cs)+String.raw`        LinearLayout controls=new LinearLayout(this);
        controls.setOrientation(LinearLayout.VERTICAL);
        controls.setPadding(dp(13),dp(10),dp(13),dp(8));
        GradientDrawable controlsBg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{
                Color.argb(205,44,58,53),
                Color.argb(174,25,34,35),
                Color.argb(150,13,19,25)
            }
        );
        controlsBg.setStroke(dp(1),Color.argb(132,173,255,96));
        controlsBg.setCornerRadius(dp(31));
        controls.setBackground(controlsBg);
        controls.setElevation(dp(22));

`+player.slice(ce);

// Plus étroit sur tablette et légèrement moins haut.
const oldControlsLp='        FrameLayout.LayoutParams controlsLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(172),Gravity.BOTTOM);\n        controlsLp.setMargins(dp(16),0,dp(16),dp(56));';
const newControlsLp='        int controlsWidth=Math.min(screenW-dp(30),dp(560));\n        FrameLayout.LayoutParams controlsLp=new FrameLayout.LayoutParams(controlsWidth,dp(158),Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);\n        controlsLp.bottomMargin=dp(58);';
player=replaceRequired(player,oldControlsLp,newControlsLp,'taille lecteur principal');

// Repeat : host séparé. Le bouton ne tourne jamais ; le halo reste derrière.
const repeatStart=player.indexOf('        repeatButton=iconButton("↻");');
const repeatEndMarker='        timelineRow.addView(repeatButton,repeatLp);';
const repeatEndStart=player.indexOf(repeatEndMarker,repeatStart);
if(repeatStart<0||repeatEndStart<0) throw new Error('V68.10.0 repeat block introuvable');
const repeatEnd=repeatEndStart+repeatEndMarker.length;
player=player.slice(0,repeatStart)+String.raw`        FrameLayout repeatHost=new FrameLayout(this);
        repeatHost.setClipChildren(false);
        repeatHost.setClipToPadding(false);

        repeatGlow=new View(this);
        GradientDrawable repeatGlowBg=new GradientDrawable();
        repeatGlowBg.setShape(GradientDrawable.OVAL);
        repeatGlowBg.setColor(Color.argb(96,168,255,63));
        repeatGlow.setBackground(repeatGlowBg);
        repeatGlow.setAlpha(0f);
        repeatGlow.setScaleX(1.20f);
        repeatGlow.setScaleY(1.20f);
        repeatHost.addView(repeatGlow,new FrameLayout.LayoutParams(dp(52),dp(52),Gravity.CENTER));

        repeatButton=iconButton("↻");
        repeatButton.setTextSize(22f);
        repeatButton.setOnClickListener(v->{
            repeatOne=!repeatOne;
            try{
                startService(new Intent(this,AudifyPlaybackService.class)
                    .setAction(AudifyPlaybackService.ACTION_REPEAT)
                    .putExtra(AudifyPlaybackService.EXTRA_REPEAT,repeatOne));
            }catch(Exception ignored){}
            if(repeatOne && currentTrack!=null) new AudifyAffinityStore(this).recordRepeat(currentTrack);
            applyRepeatState();
            animateRepeatFeedback();
        });
        repeatHost.addView(repeatButton,new FrameLayout.LayoutParams(dp(52),dp(52),Gravity.CENTER));
        LinearLayout.LayoutParams repeatLp=new LinearLayout.LayoutParams(dp(62),dp(62));
        repeatLp.leftMargin=dp(7);
        timelineRow.addView(repeatHost,repeatLp);`+player.slice(repeatEnd);

player=replaceMethod(player,['    private void applyRepeatState() {','    private void applyRepeatState(){'],String.raw`    private void applyRepeatState() {
        if(repeatButton==null) return;
        int green=Color.rgb(168,255,63);
        repeatButton.setText("↻");
        repeatButton.setContentDescription(repeatOne ? "Lecture en boucle activée" : "Lecture en boucle désactivée");

        GradientDrawable bg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            repeatOne
                ? new int[]{Color.rgb(177,255,75),Color.rgb(112,218,38)}
                : new int[]{Color.argb(144,48,57,72),Color.argb(116,22,28,39)}
        );
        bg.setCornerRadius(dp(18));
        bg.setStroke(dp(1),repeatOne?Color.argb(245,221,255,187):Color.argb(88,235,242,252));
        repeatButton.setBackground(bg);
        repeatButton.setTextColor(repeatOne?Color.rgb(10,22,8):Color.WHITE);
        repeatButton.setElevation(repeatOne?dp(15):dp(5));

        if(repeatGlow!=null){
            repeatGlow.animate().cancel();
            if(repeatOne){
                repeatGlow.setAlpha(0f);
                repeatGlow.setScaleX(1.05f); repeatGlow.setScaleY(1.05f);
                repeatGlow.animate().alpha(0.72f).scaleX(1.46f).scaleY(1.46f).setDuration(250L).start();
            }else{
                repeatGlow.animate().alpha(0f).scaleX(1.10f).scaleY(1.10f).setDuration(220L).start();
            }
        }
    }`,'applyRepeatState');

player=replaceMethod(player,['    private void animateRepeatFeedback(){','    private void animateRepeatFeedback() {'],String.raw`    private void animateRepeatFeedback(){
        if(repeatButton==null) return;
        final int green=Color.rgb(168,255,63);
        // Le conteneur reste immobile : seule l'icône change brièvement d'orientation visuelle.
        emitHalo(repeatButton,repeatOne?green:Color.rgb(225,232,242));
        repeatButton.animate().cancel();
        repeatButton.animate().scaleX(0.90f).scaleY(0.90f).setDuration(70L).withEndAction(()->{
            repeatButton.setText("⟳");
            repeatButton.animate().scaleX(1.10f).scaleY(1.10f).setDuration(95L).withEndAction(()->{
                repeatButton.setText("↻");
                repeatButton.animate().scaleX(1f).scaleY(1f).setDuration(120L).start();
            }).start();
        }).start();
        showFloatingConfirmation(repeatOne?"↻  Lecture en boucle activée":"Boucle désactivée",repeatOne?green:Color.rgb(225,232,242));
    }`,'animateRepeatFeedback');

// Like et Playlist alimentent le profil d'affinité.
player=player.replace(
  '            applyLikeState(liked);\n            animateLikeFeedback(liked);',
  '            applyLikeState(liked);\n            new AudifyAffinityStore(this).recordLike(currentTrack,liked);\n            animateLikeFeedback(liked);'
);
player=player.replace(
  '                store.addToPlaylist(name,currentTrack);\n                animatePlaylistConfirmation(name);',
  '                store.addToPlaylist(name,currentTrack);\n                new AudifyAffinityStore(this).recordPlaylist(currentTrack);\n                animatePlaylistConfirmation(name);'
);
player=player.replace(
  '                store.addToPlaylist(name,currentTrack);\n                animatePlaylistConfirmation(name);',
  '                store.addToPlaylist(name,currentTrack);\n                new AudifyAffinityStore(this).recordPlaylist(currentTrack);\n                animatePlaylistConfirmation(name);'
);
await writeFile(playerPath,player,'utf8');

// =============================================================================
// 3) WAVES — suppression des anneaux/cercle sans toucher aux trois vraies ondes.
// =============================================================================
let waves=await readFile(wavesPath,'utf8');
waves=waves.replace(/\n\s*\/\/ Anneaux concentriques[^\n]*\n\s*float cx=w\*0\.82f;\n\s*float cy=h\*0\.50f;\n\s*float pulse=\(float\)Math\.sin\(phase\)\*dp\(2\.8f\);\n\s*canvas\.drawCircle\(cx,cy,dp\(58\)\+pulse,ring1\);\n\s*canvas\.drawCircle\(cx,cy,dp\(91\)\+pulse\*1\.10f,ring2\);\n\s*canvas\.drawCircle\(cx,cy,dp\(125\)\+pulse\*1\.18f,ring1\);\n\s*canvas\.drawCircle\(cx,cy,dp\(160\)\+pulse\*1\.28f,ring2\);/,
  '\n        // V68.10.0 : anneaux concentriques supprimés. Seules les waves Audify restent visibles.');
await writeFile(wavesPath,waves,'utf8');

// =============================================================================
// 4) SERVICE — chaque écoute renforce progressivement l'affinité artiste/genre.
// =============================================================================
let service=await readFile(servicePath,'utf8');
const recentBlock=String.raw`                    new AudifyLibraryStore(this).addRecent(
                        new AudifyLibraryStore.Track(snapshotVideoId,snapshotTitle,snapshotArtist,snapshotThumbnail)
                    );`;
if(service.includes(recentBlock) && !service.includes('new AudifyAffinityStore(this).recordPlay(')){
  service=service.replace(recentBlock,recentBlock+String.raw`
                    new AudifyAffinityStore(this).recordPlay(
                        new AudifyLibraryStore.Track(snapshotVideoId,snapshotTitle,snapshotArtist,snapshotThumbnail)
                    );`);
}
await writeFile(servicePath,service,'utf8');

// =============================================================================
// 5) HOME — récents hiérarchisés + vrai classement Pour toi par score d'affinité.
// =============================================================================
let home=await readFile(homePath,'utf8');

home=replaceMethod(home,['    private void addRecentSection(){','    private void addRecentSection() {'],String.raw`    private void addRecentSection(){
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
            rail.setGravity(Gravity.BOTTOM);

            int screenW=getResources().getDisplayMetrics().widthPixels;
            int activeW=Math.min(dp(330),Math.max(dp(245),(int)(screenW*0.57f)));
            int smallW=Math.max(dp(155),(int)(activeW*0.68f));

            for(int i=0;i<Math.min(10,recents.size());i++){
                AudifyLibraryStore.Track t=recents.get(i);
                boolean active=i==0;
                int cardW=active?activeW:smallW;
                int cover=active?cardW-dp(22):cardW-dp(18);

                LinearLayout card=new LinearLayout(this);
                card.setOrientation(LinearLayout.VERTICAL);
                card.setPadding(active?dp(10):dp(8),active?dp(10):dp(8),active?dp(10):dp(8),dp(10));
                card.setBackground(round(
                    active?Color.rgb(11,17,23):Color.rgb(9,14,20),
                    dp(active?2:1),
                    active?Color.rgb(103,163,49):Color.rgb(44,52,63),
                    dp(active?25:21)
                ));
                card.setElevation(active?dp(8):dp(2));
                card.setOnClickListener(v->playTrack(t));

                ImageView art=artworkView();
                loadImage(art,t.thumbnail);
                card.addView(art,new LinearLayout.LayoutParams(cover,cover));

                TextView tt=text(t.title,active?18f:14.5f,true);
                tt.setMaxLines(active?2:1);
                tt.setEllipsize(TextUtils.TruncateAt.END);
                tt.setPadding(dp(2),dp(active?11:8),0,0);
                card.addView(tt,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,active?dp(58):dp(38)));

                TextView aa=text(t.artist,active?14f:12f,false);
                aa.setTextColor(Color.rgb(166,175,188));
                aa.setMaxLines(1); aa.setEllipsize(TextUtils.TruncateAt.END);
                card.addView(aa,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,active?dp(28):dp(23)));

                LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(cardW,active?cover+dp(108):cover+dp(78));
                cp.rightMargin=dp(13);
                cp.bottomMargin=active?0:dp(18);
                rail.addView(card,cp);
            }
            hsv.addView(rail,new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,ViewGroup.LayoutParams.WRAP_CONTENT));
            panel.addView(hsv,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        }
        addPanel(panel,dp(18));
    }`,'addRecentSection');

home=replaceMethod(home,['    private void addForYouSection(){','    private void addForYouSection() {'],String.raw`    private void addForYouSection(){
        LinearLayout panel=sectionPanel();
        panel.setPadding(dp(14),dp(18),dp(14),dp(18));
        AudifyAffinityStore affinity=new AudifyAffinityStore(this);

        TextView eyebrow=text("AUDIFY POUR TOI",12f,true);
        eyebrow.setTextColor(ACCENT);
        eyebrow.setLetterSpacing(0.14f);
        panel.addView(eyebrow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30)));

        TextView title=text("Pour toi",31f,true);
        panel.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));

        String genre=affinity.topGenre();
        TextView sub=text(
            genre.isEmpty()
                ? "Basé sur tes écoutes, tes likes, tes playlists et tes répétitions."
                : "Ton profil penche vers "+genre+". Audify classe maintenant les artistes selon ton affinité.",
            15f,false
        );
        sub.setTextColor(Color.rgb(178,187,201));
        sub.setPadding(0,0,0,dp(12));
        panel.addView(sub);

        java.util.LinkedHashMap<String,AudifyLibraryStore.Track> unique=new java.util.LinkedHashMap<>();
        for(AudifyLibraryStore.Track t:store.getRecents()) if(t!=null&&!t.id.isEmpty()) unique.put(t.id,t);
        for(AudifyLibraryStore.Track t:store.getLikes()) if(t!=null&&!t.id.isEmpty()) unique.put(t.id,t);
        ArrayList<AudifyLibraryStore.Track> candidates=new ArrayList<>(unique.values());
        java.util.Collections.sort(candidates,(a,b)->Integer.compare(affinity.scoreFor(b),affinity.scoreFor(a)));

        if(candidates.isEmpty()){
            TextView empty=text("Écoute et like quelques titres pour construire ton score d’affinité.",14f,false);
            empty.setTextColor(Color.rgb(160,169,182));
            panel.addView(empty,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(66)));
        }else{
            HorizontalScrollView hsv=new HorizontalScrollView(this);
            hsv.setHorizontalScrollBarEnabled(false);
            LinearLayout rail=new LinearLayout(this);
            rail.setOrientation(LinearLayout.HORIZONTAL);

            int shown=Math.min(8,candidates.size());
            for(int i=0;i<shown;i++){
                AudifyLibraryStore.Track t=candidates.get(i);
                LinearLayout card=new LinearLayout(this);
                card.setGravity(Gravity.CENTER_VERTICAL);
                card.setPadding(dp(9),dp(8),dp(10),dp(8));
                card.setBackground(round(Color.rgb(15,22,28),dp(1),i==0?Color.rgb(94,145,48):Color.rgb(47,58,66),dp(22)));
                card.setOnClickListener(v->playTrack(t));

                ImageView art=artworkView();
                loadImage(art,t.thumbnail);
                card.addView(art,new LinearLayout.LayoutParams(dp(68),dp(68)));

                LinearLayout info=new LinearLayout(this);
                info.setOrientation(LinearLayout.VERTICAL);
                info.setPadding(dp(11),0,dp(5),0);
                TextView tt=text(t.title,15.5f,true);
                tt.setMaxLines(1); tt.setEllipsize(TextUtils.TruncateAt.END);
                TextView aa=text(t.artist,13f,false);
                aa.setTextColor(Color.rgb(171,181,194));
                aa.setMaxLines(1); aa.setEllipsize(TextUtils.TruncateAt.END);
                int score=Math.max(0,affinity.scoreFor(t));
                TextView why=text(score>0?"Affinité élevée":"Proche de tes écoutes",11.5f,false);
                why.setTextColor(i==0?ACCENT:Color.rgb(145,157,171));
                info.addView(tt,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(27)));
                info.addView(aa,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(22)));
                info.addView(why,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(19)));
                card.addView(info,new LinearLayout.LayoutParams(0,dp(70),1f));

                TextView arrow=text("›",27f,true);
                arrow.setTextColor(Color.rgb(179,190,202)); arrow.setGravity(Gravity.CENTER);
                card.addView(arrow,new LinearLayout.LayoutParams(dp(30),dp(68)));

                LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(dp(300),dp(88));
                cp.rightMargin=dp(12);
                rail.addView(card,cp);
            }
            hsv.addView(rail,new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,dp(92)));
            panel.addView(hsv,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(98)));
        }
        addPanel(panel,dp(18));
    }`,'addForYouSection');

await writeFile(homePath,home,'utf8');
console.log('Audify V68.10.0 : Glass Player 2.0, Repeat halo, waves nettoyées, récents hiérarchisés et moteur d’affinité appliqués.');
