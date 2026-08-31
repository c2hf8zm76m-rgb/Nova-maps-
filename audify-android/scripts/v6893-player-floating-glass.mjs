import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const playerPath = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'nova', 'audify', 'NativePlayerActivity.java');
let src = await readFile(playerPath, 'utf8');

function replaceOnce(needle, replacement, label) {
  if (!src.includes(needle)) throw new Error(`V68.9.3 introuvable: ${label}`);
  src = src.replace(needle, replacement);
}

function replaceRange(startMarker, endMarker, replacement, label) {
  const start = src.indexOf(startMarker);
  const endStart = src.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || endStart < 0) throw new Error(`V68.9.3 bloc introuvable: ${label}`);
  const end = endStart + endMarker.length;
  src = src.slice(0, start) + replacement + src.slice(end);
}

function replaceMethod(signature, replacement) {
  const start = src.indexOf(signature);
  if (start < 0) return false;
  let brace = src.indexOf('{', start);
  if (brace < 0) return false;
  let depth = 0;
  let end = -1;
  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) return false;
  src = src.slice(0, start) + replacement + src.slice(end);
  return true;
}

// Timeline moderne : vert Audify, piste translucide, poignée blanche.
if (!src.includes('import android.content.res.ColorStateList;')) {
  src = src.replace('import android.content.Intent;', 'import android.content.Intent;\nimport android.content.res.ColorStateList;');
}
replaceOnce(
  '        timeline.setProgress(0);',
  `        timeline.setProgress(0);\n        timeline.setProgressTintList(ColorStateList.valueOf(Color.rgb(168,255,63)));\n        timeline.setProgressBackgroundTintList(ColorStateList.valueOf(Color.argb(105,235,241,250)));\n        timeline.setThumbTintList(ColorStateList.valueOf(Color.rgb(248,250,255)));`,
  'timeline'
);

// Artwork plus bas et plus centré, avec place réservée au vinyle qui sort de la pochette.
replaceOnce(
  '        int artworkSize=Math.max(dp(230),Math.min(dp(350),Math.min(screenW-dp(54),(int)(screenH*0.36f))));\n        int discSize=(int)(artworkSize*0.72f);',
  `        int artworkSize=Math.max(dp(240),Math.min(dp(330),Math.min((int)(screenW*0.72f),(int)(screenH*0.34f))));\n        int discSize=(int)(artworkSize*0.80f);\n        int artworkCompositeW=artworkSize+Math.round(discSize*0.44f);`,
  'dimensions artwork'
);
replaceOnce(
  '        FrameLayout.LayoutParams artworkInnerLp=new FrameLayout.LayoutParams(artworkSize,artworkSize,Gravity.CENTER);',
  '        FrameLayout.LayoutParams artworkInnerLp=new FrameLayout.LayoutParams(artworkCompositeW,artworkSize,Gravity.CENTER);',
  'largeur composite artwork'
);

replaceRange(
  '        coverImage=new ImageView(this);',
  '        disc.addView(spindle,new FrameLayout.LayoutParams(dp(27),dp(27),Gravity.CENTER));',
String.raw`        // Vinyle derrière la pochette : environ la moitié reste visible à droite.
        View discShadow=new View(this);
        GradientDrawable discShadowBg=new GradientDrawable();
        discShadowBg.setShape(GradientDrawable.OVAL);
        discShadowBg.setColor(Color.argb(72,0,0,0));
        discShadow.setBackground(discShadowBg);
        FrameLayout.LayoutParams discShadowLp=new FrameLayout.LayoutParams(discSize+dp(22),discSize+dp(22),Gravity.CENTER_VERTICAL|Gravity.END);
        artwork.addView(discShadow,discShadowLp);

        disc=new FrameLayout(this);
        GradientDrawable discBg=new GradientDrawable();
        discBg.setShape(GradientDrawable.OVAL);
        discBg.setColor(Color.rgb(5,7,10));
        discBg.setStroke(dp(4),Color.argb(205,231,238,249));
        disc.setBackground(discBg);
        disc.setPadding(dp(10),dp(10),dp(10),dp(10));
        disc.setElevation(dp(5));
        FrameLayout.LayoutParams discLp=new FrameLayout.LayoutParams(discSize,discSize,Gravity.CENTER_VERTICAL|Gravity.END);
        discLp.rightMargin=dp(2);
        artwork.addView(disc,discLp);

        discImage=new ImageView(this);
        discImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
        discImage.setClipToOutline(true);
        discImage.setOutlineProvider(new ViewOutlineProvider(){
            @Override public void getOutline(View view,Outline outline){ outline.setOval(0,0,view.getWidth(),view.getHeight()); }
        });
        disc.addView(discImage,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        View spindle=new View(this);
        GradientDrawable spindleBg=new GradientDrawable();
        spindleBg.setShape(GradientDrawable.OVAL);
        spindleBg.setColor(Color.rgb(8,10,14));
        spindleBg.setStroke(dp(3),Color.argb(235,255,255,255));
        spindle.setBackground(spindleBg);
        disc.addView(spindle,new FrameLayout.LayoutParams(dp(27),dp(27),Gravity.CENTER));

        // Pochette au premier plan : elle masque une partie du disque comme une vraie sleeve.
        coverImage=new ImageView(this);
        coverImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
        coverImage.setBackgroundColor(Color.rgb(18,23,31));
        coverImage.setClipToOutline(true);
        coverImage.setOutlineProvider(new ViewOutlineProvider(){
            @Override public void getOutline(View view,Outline outline){
                outline.setRoundRect(0,0,view.getWidth(),view.getHeight(),dp(27));
            }
        });
        coverImage.setElevation(dp(12));
        FrameLayout.LayoutParams coverLp=new FrameLayout.LayoutParams(artworkSize,artworkSize,Gravity.CENTER_VERTICAL|Gravity.START);
        artwork.addView(coverImage,coverLp);`,
  'pochette et vinyle'
);

replaceOnce(
  '        LinearLayout.LayoutParams artLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,artworkSize+dp(24));\n        artLp.topMargin=dp(2);\n        content.addView(artworkStage,artLp);',
  `        LinearLayout.LayoutParams artLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,artworkSize+dp(34));\n        artLp.topMargin=dp(34);\n        content.addView(artworkStage,artLp);`,
  'position verticale pochette'
);
replaceOnce('        titleLp.topMargin=dp(20);', '        titleLp.topMargin=dp(24);', 'marge titre');

// File d'attente elle aussi légèrement vitrée et flottante.
src = src.replace('queueBg.setColor(Color.argb(165,7,11,17));', 'queueBg.setColor(Color.argb(138,18,24,34));');
src = src.replace('queueBg.setStroke(dp(1),Color.argb(110,130,145,165));', 'queueBg.setStroke(dp(1),Color.argb(82,236,242,250));');
src = src.replace('queueBg.setCornerRadius(dp(22));', 'queueBg.setCornerRadius(dp(26));');
src = src.replace('        queueSection.setBackground(queueBg);', '        queueSection.setBackground(queueBg);\n        queueSection.setElevation(dp(8));');

// Grand lecteur Audify : verre semi-transparent, halo fin et vraie sensation de flottement.
replaceRange(
  '        LinearLayout controls=new LinearLayout(this);',
  '        LinearLayout controlTop=new LinearLayout(this);',
String.raw`        LinearLayout controls=new LinearLayout(this);
        controls.setOrientation(LinearLayout.VERTICAL);
        controls.setPadding(dp(14),dp(12),dp(14),dp(10));
        GradientDrawable controlsBg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{
                Color.argb(190,62,70,86),
                Color.argb(150,30,36,48),
                Color.argb(126,17,22,31)
            }
        );
        controlsBg.setStroke(dp(1),Color.argb(105,244,248,255));
        controlsBg.setCornerRadius(dp(32));
        controls.setBackground(controlsBg);
        controls.setElevation(dp(20));

        LinearLayout controlTop=new LinearLayout(this);`,
  'panneau lecteur glass'
);

replaceRange(
  '        playPauseButton=new Button(this);',
  '        controlTop.addView(playPauseButton,new LinearLayout.LayoutParams(dp(82),dp(82)));',
String.raw`        playPauseButton=new Button(this);
        playPauseButton.setAllCaps(false);
        playPauseButton.setText("Ⅱ");
        playPauseButton.setTextSize(25f);
        playPauseButton.setTextColor(Color.rgb(8,11,16));
        playPauseButton.setPadding(0,0,0,0);
        GradientDrawable playBg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(255,255,255),Color.rgb(226,233,244)}
        );
        playBg.setShape(GradientDrawable.OVAL);
        playBg.setStroke(dp(2),Color.argb(180,255,255,255));
        playPauseButton.setBackground(playBg);
        playPauseButton.setElevation(dp(12));
        playPauseButton.setOnClickListener(v->{
            startPlayerAction(AudifyPlaybackService.ACTION_TOGGLE);
            lastPlaying=!lastPlaying;
            applyPlayState(lastPlaying);
            uiHandler.postDelayed(this::refreshFromPlayer,80);
        });
        controlTop.addView(playPauseButton,new LinearLayout.LayoutParams(dp(84),dp(84)));`,
  'bouton play pause'
);

// Modernise tous les boutons pill du lecteur (Paroles / Vidéo s'ils sont présents).
replaceMethod(
  '    private Button pillButton(String label) {',
String.raw`    private Button pillButton(String label) {
        Button b=new Button(this);
        b.setAllCaps(false);
        b.setText(label);
        b.setTextSize(14.5f);
        b.setTextColor(Color.rgb(246,249,255));
        b.setTypeface(b.getTypeface(),android.graphics.Typeface.BOLD);
        b.setPadding(dp(12),0,dp(12),0);
        GradientDrawable bg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.argb(138,54,63,79),Color.argb(105,27,34,46)}
        );
        bg.setStroke(dp(1),Color.argb(92,239,244,252));
        bg.setCornerRadius(dp(28));
        b.setBackground(bg);
        b.setElevation(dp(6));
        return b;
    }`
);

// Boutons Home / Playlist / Like et Repeat en mini glass moderne.
replaceMethod(
  '    private Button iconButton(String label) {',
String.raw`    private Button iconButton(String label) {
        Button b=new Button(this);
        b.setAllCaps(false);
        b.setText(label);
        b.setTextSize(20f);
        b.setTextColor(Color.rgb(239,244,252));
        b.setPadding(0,0,0,0);
        GradientDrawable bg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.argb(136,48,57,72),Color.argb(104,22,28,39)}
        );
        bg.setStroke(dp(1),Color.argb(88,235,242,252));
        bg.setCornerRadius(dp(18));
        b.setBackground(bg);
        b.setElevation(dp(5));
        return b;
    }`
);

// Le symbole de pause est plus minimal si applyPlayState le réécrit.
src = src.replace('playPauseButton.setText(playing ? "⏸" : "▶");', 'playPauseButton.setText(playing ? "Ⅱ" : "▶");');

// Lecteur légèrement décollé des bords, plus haut de gamme.
src = src.replace(
  '        FrameLayout.LayoutParams controlsLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(164),Gravity.BOTTOM);\n        controlsLp.setMargins(dp(12),0,dp(12),dp(10));',
  '        FrameLayout.LayoutParams controlsLp=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(172),Gravity.BOTTOM);\n        controlsLp.setMargins(dp(16),0,dp(16),dp(18));'
);

await writeFile(playerPath,src,'utf8');
console.log('Audify Android V68.9.3 : lecteur flottant glass, pochette abaissée et vinyle semi-avalé appliqués.');
