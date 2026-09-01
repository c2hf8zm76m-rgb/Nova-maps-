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

// V68.12.20 — Karaoke devient une action iconique minimale, identique aux actions
// Home / Playlist / Like : carré glass, contour neutre et micro monochrome blanc.
const oldButton='        Button karaokeButton=pillButton("🎤  Paroles");\n        applyKaraokeGlassStyle(karaokeButton);';
const newButton='        Button karaokeButton=iconButton("");\n        applyKaraokeMicIcon(karaokeButton);';
if(!src.includes(oldButton)) throw new Error('V68.12.20 : création bouton Karaoke V68.12.19 introuvable');
src=src.replace(oldButton,newButton);

const oldLayout='        controlTop.addView(karaokeButton,new LinearLayout.LayoutParams(dp(165),dp(58)));';
const newLayout='        controlTop.addView(karaokeButton,new LinearLayout.LayoutParams(dp(54),dp(54)));';
if(!src.includes(oldLayout)) throw new Error('V68.12.20 : layout bouton Karaoke introuvable');
src=src.replace(oldLayout,newLayout);

const marker='    private LinearLayout.LayoutParams weighted() {';
if(!src.includes(marker)) throw new Error('V68.12.20 : point insertion helper introuvable');
const helper=String.raw`    private void applyKaraokeMicIcon(Button button) {
        if(button==null) return;
        button.setText("");
        button.setTextColor(Color.WHITE);
        button.setGravity(Gravity.CENTER);
        button.setPadding(0,0,0,0);
        button.setContentDescription("Ouvrir le mode Karaoké");
        button.setCompoundDrawablePadding(0);
        button.setCompoundDrawablesWithIntrinsicBounds(R.drawable.audify_ic_mic,0,0,0);
        android.graphics.drawable.Drawable[] ds=button.getCompoundDrawables();
        if(ds!=null && ds.length>0 && ds[0]!=null){
            ds[0].mutate().setTint(Color.WHITE);
        }
    }

`;
src=src.replace(marker,helper+marker);
await writeFile(playerPath,src,'utf8');

const micVector=`<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M12,14c1.66,0 3,-1.34 3,-3V5c0,-1.66 -1.34,-3 -3,-3S9,3.34 9,5v6c0,1.66 1.34,3 3,3zM17.3,11c0,3 -2.54,5.1 -5.3,5.1S6.7,14 6.7,11H5c0,3.41 2.72,6.23 6,6.72V21H9v2h6v-2h-2v-3.28c3.28,-0.48 6,-3.3 6,-6.72h-1.7z" />
</vector>
`;
await writeFile(path.join(drawableDir,'audify_ic_mic.xml'),micVector,'utf8');
console.log('Audify Android V68.12.20 : Karaoke réduit à un micro monochrome glass 54x54.');
