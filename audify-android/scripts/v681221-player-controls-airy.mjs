import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const playerPath=path.join(android,'app','src','main','java','com','nova','audify','NativePlayerActivity.java');
const drawableDir=path.join(android,'app','src','main','res','drawable');
await mkdir(drawableDir,{recursive:true});

let src=await readFile(playerPath,'utf8');

// -----------------------------------------------------------------------------
// V68.12.21 — Le micro Karaoke devient un vrai micro de scène incliné et son
// dessin est centré via le foreground du bouton (plus de décalage de baseline).
// -----------------------------------------------------------------------------
const helperStart=src.indexOf('    private void applyKaraokeMicIcon(Button button) {');
const weightedMarker='    private LinearLayout.LayoutParams weighted() {';
const weightedStart=src.indexOf(weightedMarker,helperStart);
if(helperStart<0 || weightedStart<0) throw new Error('V68.12.21 : helper Karaoke/weighted introuvable');

const helper=String.raw`    private void applyKaraokeMicIcon(Button button) {
        if(button==null) return;
        button.setText("");
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        button.setPadding(0,0,0,0);
        button.setMinWidth(0);
        button.setMinHeight(0);
        button.setContentDescription("Ouvrir le mode Karaoké");
        button.setCompoundDrawables(null,null,null,null);
        android.graphics.drawable.Drawable mic=getResources().getDrawable(R.drawable.audify_ic_mic,getTheme());
        if(mic!=null){
            mic=mic.mutate();
            mic.setTint(Color.WHITE);
            button.setForeground(mic);
            button.setForegroundGravity(Gravity.CENTER);
        }
    }

`;
src=src.slice(0,helperStart)+helper+src.slice(weightedStart);

// -----------------------------------------------------------------------------
// 2) Décompactage du gros lecteur :
//    - ligne haute = Play à gauche, Karaoke + Repeat à droite ;
//    - timeline seule dans sa propre capsule glass interne ;
//    - panneau global moins haut et plus respirant.
// -----------------------------------------------------------------------------
const controlStart=src.indexOf('        LinearLayout controlTop=new LinearLayout(this);');
if(controlStart<0) throw new Error('V68.12.21 : début controlTop introuvable');

const timelineAddRe=/        controls\.addView\(timelineRow,new LinearLayout\.LayoutParams\(ViewGroup\.LayoutParams\.MATCH_PARENT,dp\(\d+\)\)\);/g;
timelineAddRe.lastIndex=controlStart;
const timelineEndMatch=timelineAddRe.exec(src);
if(!timelineEndMatch) throw new Error('V68.12.21 : fin ancien bloc timeline introuvable');
const controlEnd=timelineEndMatch.index+timelineEndMatch[0].length;

const newControls=String.raw`        LinearLayout controlTop=new LinearLayout(this);
        controlTop.setGravity(Gravity.CENTER_VERTICAL);

        playPauseButton=new Button(this);
        playPauseButton.setAllCaps(false);
        playPauseButton.setText("Ⅱ");
        playPauseButton.setTextSize(24f);
        playPauseButton.setTextColor(Color.rgb(8,11,16));
        playPauseButton.setPadding(0,0,0,0);
        GradientDrawable playBg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(255,255,255),Color.rgb(226,233,244)}
        );
        playBg.setShape(GradientDrawable.OVAL);
        playBg.setStroke(dp(2),Color.argb(180,255,255,255));
        playPauseButton.setBackground(playBg);
        playPauseButton.setElevation(dp(10));
        playPauseButton.setOnClickListener(v->{
            animatePress(playPauseButton);
            startPlayerAction(AudifyPlaybackService.ACTION_TOGGLE);
            lastPlaying=!lastPlaying;
            applyPlayState(lastPlaying);
            uiHandler.postDelayed(this::refreshFromPlayer,80);
        });
        controlTop.addView(playPauseButton,new LinearLayout.LayoutParams(dp(70),dp(70)));

        View spacer=new View(this);
        controlTop.addView(spacer,new LinearLayout.LayoutParams(0,1,1f));

        Button karaokeButton=iconButton("");
        applyKaraokeMicIcon(karaokeButton);
        karaokeButton.setOnClickListener(v->openKaraoke());
        controlTop.addView(karaokeButton,new LinearLayout.LayoutParams(dp(54),dp(54)));

        FrameLayout repeatHost=new FrameLayout(this);
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
        LinearLayout.LayoutParams repeatTopLp=new LinearLayout.LayoutParams(dp(62),dp(62));
        repeatTopLp.leftMargin=dp(8);
        controlTop.addView(repeatHost,repeatTopLp);
        controls.addView(controlTop,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(72)));

        // Timeline isolée : une vraie sous-section interne, plus lisible et moins compacte.
        LinearLayout timelineShell=new LinearLayout(this);
        timelineShell.setGravity(Gravity.CENTER_VERTICAL);
        timelineShell.setPadding(dp(11),0,dp(11),0);
        GradientDrawable timelineShellBg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.argb(120,13,19,25),Color.argb(84,7,12,17)}
        );
        timelineShellBg.setStroke(dp(1),Color.argb(74,225,235,244));
        timelineShellBg.setCornerRadius(dp(18));
        timelineShell.setBackground(timelineShellBg);

        timeline=new SeekBar(this);
        timeline.setMax(1000);
        timeline.setProgress(0);
        timeline.setPadding(0,0,0,0);
        timeline.setProgressTintList(ColorStateList.valueOf(Color.rgb(168,255,63)));
        timeline.setProgressBackgroundTintList(ColorStateList.valueOf(Color.argb(88,235,241,250)));
        timeline.setThumbTintList(ColorStateList.valueOf(Color.rgb(248,250,255)));
        timeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){
            @Override public void onProgressChanged(SeekBar s,int p,boolean fromUser){}
            @Override public void onStartTrackingTouch(SeekBar s){ userSeeking=true; }
            @Override public void onStopTrackingTouch(SeekBar s){
                double seconds=Math.max(0.0,lastDurationSeconds)*(s.getProgress()/1000.0);
                try{
                    startService(new Intent(NativePlayerActivity.this,AudifyPlaybackService.class)
                        .setAction(AudifyPlaybackService.ACTION_SEEK)
                        .putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS,seconds));
                }catch(Exception ignored){}
                userSeeking=false;
                uiHandler.postDelayed(NativePlayerActivity.this::refreshFromPlayer,80);
            }
        });
        timelineShell.addView(timeline,new LinearLayout.LayoutParams(0,dp(42),1f));
        LinearLayout.LayoutParams timelineShellLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(44));
        timelineShellLp.topMargin=dp(6);
        controls.addView(timelineShell,timelineShellLp);`;

src=src.slice(0,controlStart)+newControls+src.slice(controlEnd);

// Allège légèrement le verre principal maintenant que la timeline possède sa propre couche.
src=src.replace('controls.setPadding(dp(13),dp(10),dp(13),dp(8));','controls.setPadding(dp(12),dp(8),dp(12),dp(8));');
src=src.replace('Color.argb(205,44,58,53),\n                Color.argb(174,25,34,35),\n                Color.argb(150,13,19,25)','Color.argb(182,39,52,48),\n                Color.argb(150,23,31,33),\n                Color.argb(128,12,18,24)');
src=src.replace('controlsBg.setStroke(dp(1),Color.argb(132,173,255,96));','controlsBg.setStroke(dp(1),Color.argb(88,209,236,218));');

// Les versions V68.10.8+ ont rendu le lecteur plus étroit (82/455 au lieu de 30/560).
// On ne dépend donc plus de ces valeurs : on conserve la largeur finale et on ne
// modifie que la hauteur du panneau principal.
const controlsLpRe=/FrameLayout\.LayoutParams\s+controlsLp\s*=\s*new FrameLayout\.LayoutParams\(\s*([^,\n]+)\s*,\s*dp\(\d+\)\s*,\s*(Gravity\.BOTTOM(?:\|Gravity\.CENTER_HORIZONTAL)?)\s*\);/;
const controlsLpMatch=src.match(controlsLpRe);
if(!controlsLpMatch) throw new Error('V68.12.21 : déclaration controlsLp introuvable');
src=src.replace(controlsLpRe,`FrameLayout.LayoutParams controlsLp=new FrameLayout.LayoutParams(${controlsLpMatch[1].trim()},dp(142),${controlsLpMatch[2]});`);

// Conserve la marge basse choisie par les versions précédentes et raccourcit
// simplement la réserve de la zone scrollable, si elle est présente.
src=src.replace(/scrollerLp\.bottomMargin=dp\(\d+\);/,'scrollerLp.bottomMargin=dp(210);');

await writeFile(playerPath,src,'utf8');

// Micro de scène / karaoke : tête grillagée + long manche, incliné comme un micro chant.
const micVector=`<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="25dp"
    android:height="25dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <group
        android:rotation="-42"
        android:pivotX="12"
        android:pivotY="12">
        <path
            android:fillColor="#FFFFFFFF"
            android:pathData="M8,2.4h8c1.55,0 2.8,1.25 2.8,2.8v2.2c0,1.55 -1.25,2.8 -2.8,2.8H8c-1.55,0 -2.8,-1.25 -2.8,-2.8V5.2C5.2,3.65 6.45,2.4 8,2.4z" />
        <path
            android:fillColor="#FF171D24"
            android:pathData="M7.1,5.15h9.8v0.9H7.1zM7.1,7.15h9.8v0.9H7.1z" />
        <path
            android:fillColor="#FFFFFFFF"
            android:pathData="M10,9.5h4l1.05,11.4c0.05,0.55 -0.38,1.05 -0.94,1.05h-4.22c-0.56,0 -0.99,-0.5 -0.94,-1.05L10,9.5z" />
    </group>
</vector>
`;
await writeFile(path.join(drawableDir,'audify_ic_mic.xml'),micVector,'utf8');
console.log('Audify Android V68.12.21 : micro karaoke scène centré + timeline isolée dans une sous-section glass.');
