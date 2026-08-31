import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const rootDir=path.resolve(here,'..');
const pkgDir=path.join(rootDir,'android','app','src','main','java','com','nova','audify');
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');

function replaceMethodIn(source, signatures, replacement, label){
  for(const signature of signatures){
    const start=source.indexOf(signature);
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
  throw new Error(`V68.9.4 méthode introuvable: ${label}`);
}

function replaceRequired(source,needle,replacement,label){
  if(!source.includes(needle)) throw new Error(`V68.9.4 bloc introuvable: ${label}`);
  return source.replace(needle,replacement);
}

// =============================================================================
// GRAND LECTEUR — centrage mathématique, position, glass et micro-interactions.
// =============================================================================
let src=await readFile(playerPath,'utf8');

if(!src.includes('private Button playlistActionButton;')){
  src=src.replace('    private Button likeButton;','    private Button likeButton;\n    private Button playlistActionButton;');
}

// La stage artwork occupe toute la largeur : la pochette elle-même est le repère central.
src=replaceRequired(
  src,
  '        FrameLayout.LayoutParams artworkInnerLp=new FrameLayout.LayoutParams(artworkCompositeW,artworkSize,Gravity.CENTER);',
  '        FrameLayout.LayoutParams artworkInnerLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,artworkSize,Gravity.CENTER);',
  'stage artwork plein écran'
);

// Disque centré sur l’écran puis translaté à droite. Il ne déplace donc plus jamais la pochette.
src=replaceRequired(
  src,
  '        FrameLayout.LayoutParams discShadowLp=new FrameLayout.LayoutParams(discSize+dp(22),discSize+dp(22),Gravity.CENTER_VERTICAL|Gravity.END);\n        artwork.addView(discShadow,discShadowLp);',
  '        FrameLayout.LayoutParams discShadowLp=new FrameLayout.LayoutParams(discSize+dp(22),discSize+dp(22),Gravity.CENTER);\n        artwork.addView(discShadow,discShadowLp);\n        discShadow.setTranslationX(artworkSize*0.34f);',
  'ombre vinyle centrée'
);
src=replaceRequired(
  src,
  '        FrameLayout.LayoutParams discLp=new FrameLayout.LayoutParams(discSize,discSize,Gravity.CENTER_VERTICAL|Gravity.END);\n        discLp.rightMargin=dp(2);\n        artwork.addView(disc,discLp);',
  '        FrameLayout.LayoutParams discLp=new FrameLayout.LayoutParams(discSize,discSize,Gravity.CENTER);\n        artwork.addView(disc,discLp);\n        disc.setTranslationX(artworkSize*0.34f);',
  'vinyle centré puis décalé'
);
src=replaceRequired(
  src,
  '        FrameLayout.LayoutParams coverLp=new FrameLayout.LayoutParams(artworkSize,artworkSize,Gravity.CENTER_VERTICAL|Gravity.START);\n        artwork.addView(coverImage,coverLp);',
  '        FrameLayout.LayoutParams coverLp=new FrameLayout.LayoutParams(artworkSize,artworkSize,Gravity.CENTER);\n        artwork.addView(coverImage,coverLp);',
  'pochette centrée mathématiquement'
);

// Encore plus bas que V68.9.3, mais le titre suit naturellement.
src=replaceRequired(
  src,
  '        LinearLayout.LayoutParams artLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,artworkSize+dp(34));\n        artLp.topMargin=dp(34);\n        content.addView(artworkStage,artLp);',
  '        LinearLayout.LayoutParams artLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,artworkSize+dp(48));\n        artLp.topMargin=dp(58);\n        content.addView(artworkStage,artLp);',
  'pochette plus basse'
);

// Le panneau principal remonte franchement et flotte au-dessus de la zone système.
src=replaceRequired(
  src,
  '        FrameLayout.LayoutParams controlsLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(172),Gravity.BOTTOM);\n        controlsLp.setMargins(dp(16),0,dp(16),dp(18));',
  '        FrameLayout.LayoutParams controlsLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(172),Gravity.BOTTOM);\n        controlsLp.setMargins(dp(16),0,dp(16),dp(56));',
  'lecteur principal remonté'
);

// Playlist : bouton mémorisé pour pouvoir confirmer visuellement l’ajout.
src=replaceRequired(
  src,
  '        Button playlistTop = iconButton("＋");\n        playlistTop.setContentDescription("Ajouter à une playlist");\n        playlistTop.setOnClickListener(v -> showPlaylistPicker());\n        LinearLayout.LayoutParams topIcon2=iconLp(); topIcon2.leftMargin=dp(9);\n        topActions.addView(playlistTop,topIcon2);',
  '        playlistActionButton = iconButton("＋");\n        playlistActionButton.setContentDescription("Ajouter à une playlist");\n        playlistActionButton.setOnClickListener(v -> {\n            animatePress(playlistActionButton);\n            showPlaylistPicker();\n        });\n        LinearLayout.LayoutParams topIcon2=iconLp(); topIcon2.leftMargin=dp(9);\n        topActions.addView(playlistActionButton,topIcon2);',
  'bouton playlist principal'
);

// Like : halo rose + contraction + rebond.
src=replaceRequired(
  src,
  '            boolean liked=store.toggleLike(currentTrack);\n            applyLikeState(liked);',
  '            boolean liked=store.toggleLike(currentTrack);\n            applyLikeState(liked);\n            animateLikeFeedback(liked);',
  'animation like'
);

// Play/Pause : micro-rebond tactile.
src=replaceRequired(
  src,
  '        playPauseButton.setOnClickListener(v->{\n            startPlayerAction(AudifyPlaybackService.ACTION_TOGGLE);',
  '        playPauseButton.setOnClickListener(v->{\n            animatePress(playPauseButton);\n            startPlayerAction(AudifyPlaybackService.ACTION_TOGGLE);',
  'animation play pause'
);

// Repeat : rotation, halo et état persistant vert.
src=replaceRequired(
  src,
  '            applyRepeatState();\n        });\n        LinearLayout.LayoutParams repeatLp=new LinearLayout.LayoutParams(dp(52),dp(52)); repeatLp.leftMargin=dp(7);',
  '            applyRepeatState();\n            animateRepeatFeedback();\n        });\n        LinearLayout.LayoutParams repeatLp=new LinearLayout.LayoutParams(dp(52),dp(52)); repeatLp.leftMargin=dp(7);',
  'animation boucle'
);

src=replaceMethodIn(src,['    private void showPlaylistPicker() {','    private void showPlaylistPicker(){'],String.raw`    private void showPlaylistPicker() {
        if (currentTrack == null || currentTrack.id.isEmpty()) {
            Toast.makeText(this,"Titre indisponible",Toast.LENGTH_SHORT).show();
            return;
        }
        List<String> existing=new ArrayList<>(store.getPlaylistNames());
        existing.add(0,"＋ Nouvelle playlist…");
        new AlertDialog.Builder(this)
            .setTitle("Ajouter à une playlist")
            .setItems(existing.toArray(new String[0]),(dialog,which)->{
                if(which==0){ promptNewPlaylist(); return; }
                String name=existing.get(which);
                store.addToPlaylist(name,currentTrack);
                animatePlaylistConfirmation(name);
            })
            .setNegativeButton("Annuler",null)
            .show();
    }`,'showPlaylistPicker');

src=replaceMethodIn(src,['    private void promptNewPlaylist() {','    private void promptNewPlaylist(){'],String.raw`    private void promptNewPlaylist() {
        EditText input=new EditText(this);
        input.setHint("Nom de la playlist");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        int pad=dp(20);
        input.setPadding(pad,pad,pad,pad);
        new AlertDialog.Builder(this)
            .setTitle("Nouvelle playlist")
            .setView(input)
            .setPositiveButton("Créer",(d,w)->{
                String name=input.getText()==null?"":input.getText().toString().trim();
                if(name.isEmpty()) name="Ma playlist";
                store.addToPlaylist(name,currentTrack);
                animatePlaylistConfirmation(name);
            })
            .setNegativeButton("Annuler",null)
            .show();
    }`,'promptNewPlaylist');

const playerHelperMarker='    private LinearLayout.LayoutParams weighted() {';
if(!src.includes(playerHelperMarker)) throw new Error('V68.9.4 helper marker player introuvable');
const playerHelpers=String.raw`    private void animatePress(View target){
        if(target==null) return;
        target.animate().cancel();
        target.animate().scaleX(0.90f).scaleY(0.90f).setDuration(75L).withEndAction(()->
            target.animate().scaleX(1.05f).scaleY(1.05f).setDuration(105L).withEndAction(()->
                target.animate().scaleX(1f).scaleY(1f).setDuration(110L).start()
            ).start()
        ).start();
    }

    private void emitHalo(View target,int color){
        if(target==null||root==null||target.getWidth()<=0||target.getHeight()<=0) return;
        int[] targetLoc=new int[2]; int[] rootLoc=new int[2];
        target.getLocationOnScreen(targetLoc); root.getLocationOnScreen(rootLoc);
        int size=Math.max(target.getWidth(),target.getHeight())+dp(30);
        View halo=new View(this);
        GradientDrawable haloBg=new GradientDrawable();
        haloBg.setShape(GradientDrawable.OVAL);
        haloBg.setColor(Color.argb(46,Color.red(color),Color.green(color),Color.blue(color)));
        haloBg.setStroke(dp(2),Color.argb(185,Color.red(color),Color.green(color),Color.blue(color)));
        halo.setBackground(haloBg);
        FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(size,size);
        lp.leftMargin=targetLoc[0]-rootLoc[0]+target.getWidth()/2-size/2;
        lp.topMargin=targetLoc[1]-rootLoc[1]+target.getHeight()/2-size/2;
        root.addView(halo,lp);
        halo.setScaleX(0.48f); halo.setScaleY(0.48f); halo.setAlpha(0.92f);
        halo.animate().scaleX(1.75f).scaleY(1.75f).alpha(0f).setDuration(430L).withEndAction(()->root.removeView(halo)).start();
    }

    private void animateLikeFeedback(boolean liked){
        if(likeButton==null) return;
        int pink=Color.rgb(255,79,124);
        emitHalo(likeButton,pink);
        likeButton.animate().cancel();
        likeButton.animate().scaleX(0.76f).scaleY(0.76f).rotation(liked?-9f:7f).setDuration(85L).withEndAction(()->
            likeButton.animate().scaleX(1.19f).scaleY(1.19f).rotation(liked?5f:-4f).setDuration(125L).withEndAction(()->
                likeButton.animate().scaleX(1f).scaleY(1f).rotation(0f).setDuration(150L).start()
            ).start()
        ).start();
    }

    private void animatePlaylistConfirmation(String playlistName){
        int green=Color.rgb(168,255,63);
        if(playlistActionButton!=null){
            emitHalo(playlistActionButton,green);
            animatePress(playlistActionButton);
            playlistActionButton.setText("✓");
            playlistActionButton.setTextColor(green);
            uiHandler.postDelayed(()->{
                if(playlistActionButton!=null){
                    playlistActionButton.setText("＋");
                    playlistActionButton.setTextColor(Color.rgb(239,244,252));
                }
            },850L);
        }
        showFloatingConfirmation("✓  Ajouté à « "+playlistName+" »",green);
    }

    private void animateRepeatFeedback(){
        if(repeatButton==null) return;
        int green=Color.rgb(168,255,63);
        emitHalo(repeatButton,repeatOne?green:Color.rgb(225,232,242));
        float nextRotation=repeatButton.getRotation()+(repeatOne?360f:-360f);
        repeatButton.animate().cancel();
        repeatButton.animate().scaleX(0.84f).scaleY(0.84f).rotation(nextRotation).setDuration(260L).withEndAction(()->
            repeatButton.animate().scaleX(1.08f).scaleY(1.08f).setDuration(90L).withEndAction(()->
                repeatButton.animate().scaleX(1f).scaleY(1f).setDuration(100L).start()
            ).start()
        ).start();
        showFloatingConfirmation(repeatOne?"↻  Lecture en boucle activée":"Boucle désactivée",repeatOne?green:Color.rgb(225,232,242));
    }

    private void showFloatingConfirmation(String message,int accent){
        if(root==null) return;
        TextView chip=new TextView(this);
        chip.setText(message);
        chip.setTextColor(Color.WHITE);
        chip.setTextSize(14f);
        chip.setGravity(Gravity.CENTER);
        chip.setPadding(dp(18),0,dp(18),0);
        chip.setTypeface(chip.getTypeface(),android.graphics.Typeface.BOLD);
        GradientDrawable bg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.argb(224,50,58,72),Color.argb(198,24,30,41)}
        );
        bg.setCornerRadius(dp(24));
        bg.setStroke(dp(1),Color.argb(185,Color.red(accent),Color.green(accent),Color.blue(accent)));
        chip.setBackground(bg);
        chip.setElevation(dp(24));
        FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,dp(50),Gravity.TOP|Gravity.CENTER_HORIZONTAL);
        lp.topMargin=dp(90);
        root.addView(chip,lp);
        chip.setAlpha(0f); chip.setTranslationY(dp(12));
        chip.animate().alpha(1f).translationY(0f).setDuration(180L).withEndAction(()->
            uiHandler.postDelayed(()->chip.animate().alpha(0f).translationY(-dp(10)).setDuration(260L).withEndAction(()->root.removeView(chip)).start(),760L)
        ).start();
    }

`;
src=src.replace(playerHelperMarker,playerHelpers+playerHelperMarker);
await writeFile(playerPath,src,'utf8');

// =============================================================================
// HOME — mini lecteur flottant glass cohérent avec le grand lecteur.
// =============================================================================
let home=await readFile(homePath,'utf8');

if(!home.includes('import android.content.res.ColorStateList;')){
  home=home.replace('import android.content.Intent;','import android.content.Intent;\nimport android.content.res.ColorStateList;');
}
if(!home.includes('private ImageView miniArtwork;')){
  home=home.replace('    private Button miniToggle;','    private Button miniToggle;\n    private ImageView miniArtwork;\n    private String miniArtworkId="";');
}

home=replaceRequired(
  home,
  '        FrameLayout.LayoutParams miniLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(130),Gravity.BOTTOM);\n        miniLp.setMargins(dp(10),0,dp(10),dp(8));',
  '        FrameLayout.LayoutParams miniLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(116),Gravity.BOTTOM);\n        miniLp.setMargins(dp(14),0,dp(14),dp(24));',
  'mini lecteur flottant position'
);

home=replaceMethodIn(home,['    private LinearLayout buildMiniPlayer(){','    private LinearLayout buildMiniPlayer() {'],String.raw`    private LinearLayout buildMiniPlayer(){
        LinearLayout card=new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(11),dp(9),dp(11),dp(7));
        GradientDrawable glass=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.argb(214,66,76,94),Color.argb(178,35,43,58),Color.argb(155,20,26,36)}
        );
        glass.setStroke(dp(1),Color.argb(115,244,248,255));
        glass.setCornerRadius(dp(29));
        card.setBackground(glass);
        card.setElevation(dp(20));
        card.setVisibility(View.GONE);
        card.setOnClickListener(v->openCurrentPlayer());

        LinearLayout top=new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);

        miniArtwork=new ImageView(this);
        miniArtwork.setScaleType(ImageView.ScaleType.CENTER_CROP);
        miniArtwork.setClipToOutline(true);
        miniArtwork.setOutlineProvider(new ViewOutlineProvider(){
            @Override public void getOutline(View view,Outline outline){ outline.setRoundRect(0,0,view.getWidth(),view.getHeight(),dp(15)); }
        });
        miniArtwork.setBackgroundColor(Color.rgb(25,31,41));
        miniArtwork.setOnClickListener(v->openCurrentPlayer());
        top.addView(miniArtwork,new LinearLayout.LayoutParams(dp(58),dp(58)));

        LinearLayout info=new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setGravity(Gravity.CENTER_VERTICAL);
        info.setPadding(dp(11),0,dp(8),0);
        info.setOnClickListener(v->openCurrentPlayer());
        miniTitle=text("",15.5f,true);
        miniTitle.setMaxLines(1);
        miniTitle.setEllipsize(TextUtils.TruncateAt.END);
        miniArtist=text("",12.5f,false);
        miniArtist.setTextColor(Color.rgb(190,199,212));
        miniArtist.setMaxLines(1);
        miniArtist.setEllipsize(TextUtils.TruncateAt.END);
        info.addView(miniTitle,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(29)));
        info.addView(miniArtist,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(23)));
        top.addView(info,new LinearLayout.LayoutParams(0,dp(58),1f));

        miniToggle=new Button(this);
        miniToggle.setAllCaps(false);
        miniToggle.setText("Ⅱ");
        miniToggle.setTextSize(20f);
        miniToggle.setTextColor(Color.rgb(8,11,16));
        miniToggle.setPadding(0,0,0,0);
        GradientDrawable toggleBg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(255,255,255),Color.rgb(226,233,244)}
        );
        toggleBg.setShape(GradientDrawable.OVAL);
        toggleBg.setStroke(dp(2),Color.argb(180,255,255,255));
        miniToggle.setBackground(toggleBg);
        miniToggle.setElevation(dp(9));
        miniToggle.setOnClickListener(v->{
            animateHomePress(miniToggle);
            try{startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_TOGGLE));}catch(Exception ignored){}
            handler.postDelayed(this::refreshMiniPlayer,70);
        });
        top.addView(miniToggle,new LinearLayout.LayoutParams(dp(56),dp(56)));
        card.addView(top,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(62)));

        miniTimeline=new SeekBar(this);
        miniTimeline.setMax(1000);
        miniTimeline.setPadding(0,0,0,0);
        miniTimeline.setProgressTintList(ColorStateList.valueOf(ACCENT));
        miniTimeline.setProgressBackgroundTintList(ColorStateList.valueOf(Color.argb(90,238,244,252)));
        miniTimeline.setThumbTintList(ColorStateList.valueOf(Color.rgb(248,250,255)));
        miniTimeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){
            @Override public void onProgressChanged(SeekBar s,int p,boolean fromUser){}
            @Override public void onStartTrackingTouch(SeekBar s){userSeeking=true;}
            @Override public void onStopTrackingTouch(SeekBar s){
                double seconds=Math.max(0.0,durationSeconds)*(s.getProgress()/1000.0);
                try{startService(new Intent(NativeHomeActivity.this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_SEEK).putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS,seconds));}catch(Exception ignored){}
                userSeeking=false;
                handler.postDelayed(NativeHomeActivity.this::refreshMiniPlayer,80);
            }
        });
        card.addView(miniTimeline,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(34)));
        return card;
    }`,'buildMiniPlayer');

home=home.replace('miniToggle.setText(playing?"Pause":"Lecture");','miniToggle.setText(playing?"Ⅱ":"▶");');
home=home.replace(
  'snapshotTrack=new AudifyLibraryStore.Track(id,title,artist,thumbnail);',
  'snapshotTrack=new AudifyLibraryStore.Track(id,title,artist,thumbnail);\n            if(miniArtwork!=null&&!id.equals(miniArtworkId)){ miniArtworkId=id; loadImage(miniArtwork,thumbnail); }'
);

// Même langage d’interaction sur les boutons des cartes du Home.
home=home.replace(
  'playlist.setOnClickListener(v->showPlaylistPickerForTrack(t));',
  'playlist.setOnClickListener(v->{animateHomeAction(playlist,ACCENT);showPlaylistPickerForTrack(t);});'
);
home=home.replace(
  'heart.setOnClickListener(v->{store.toggleLike(t);rebuildLibrary();});',
  'heart.setOnClickListener(v->{animateHomeAction(heart,Color.rgb(255,79,124));store.toggleLike(t);handler.postDelayed(this::rebuildLibrary,180L);});'
);

home=replaceMethodIn(home,['    private void showPlaylistPickerForTrack(AudifyLibraryStore.Track track){','    private void showPlaylistPickerForTrack(AudifyLibraryStore.Track track) {'],String.raw`    private void showPlaylistPickerForTrack(AudifyLibraryStore.Track track){
        if(track==null||track.id.isEmpty()) return;
        ArrayList<String> choices=new ArrayList<>(store.getPlaylistNames());
        choices.add(0,"＋ Nouvelle playlist…");
        new AlertDialog.Builder(this)
            .setTitle("Ajouter à une playlist")
            .setItems(choices.toArray(new String[0]),(dialog,which)->{
                if(which==0){ promptNewPlaylistForTrack(track); return; }
                String name=choices.get(which);
                store.addToPlaylist(name,track);
                showHomeConfirmation("✓  Ajouté à « "+name+" »");
                rebuildLibrary();
            })
            .setNegativeButton("Annuler",null)
            .show();
    }`,'showPlaylistPickerForTrack');

home=replaceMethodIn(home,['    private void promptNewPlaylistForTrack(AudifyLibraryStore.Track track){','    private void promptNewPlaylistForTrack(AudifyLibraryStore.Track track) {'],String.raw`    private void promptNewPlaylistForTrack(AudifyLibraryStore.Track track){
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
                showHomeConfirmation("✓  Ajouté à « "+name+" »");
                rebuildLibrary();
            })
            .setNegativeButton("Annuler",null)
            .show();
    }`,'promptNewPlaylistForTrack');

const homeHelperMarker='    private LinearLayout buildMiniPlayer(){';
if(!home.includes(homeHelperMarker)) throw new Error('V68.9.4 helper marker Home introuvable');
const homeHelpers=String.raw`    private void animateHomePress(View target){
        if(target==null) return;
        target.animate().cancel();
        target.animate().scaleX(0.90f).scaleY(0.90f).setDuration(70L).withEndAction(()->
            target.animate().scaleX(1.06f).scaleY(1.06f).setDuration(100L).withEndAction(()->
                target.animate().scaleX(1f).scaleY(1f).setDuration(100L).start()
            ).start()
        ).start();
    }

    private void animateHomeAction(View target,int accent){
        animateHomePress(target);
        if(target==null) return;
        target.setElevation(dp(12));
        handler.postDelayed(()->target.setElevation(dp(4)),360L);
    }

    private void showHomeConfirmation(String message){
        Toast.makeText(this,message,Toast.LENGTH_SHORT).show();
    }

`;
home=home.replace(homeHelperMarker,homeHelpers+homeHelperMarker);

await writeFile(homePath,home,'utf8');
console.log('Audify Android V68.9.4 : centrage parfait, lecteur remonté, mini-player glass et animations Like/Playlist/Repeat.');
