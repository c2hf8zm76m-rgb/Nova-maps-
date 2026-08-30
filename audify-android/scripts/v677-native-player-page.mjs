import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
await mkdir(pkgDir,{recursive:true});

const activity=String.raw`package com.nova.audify;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Audify V67.7 — première vraie page de lecture 100% Android native.
 * Pour cette étape volontairement minimale, elle ne contient qu'un bouton Pause.
 */
public class NativePlayerActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(7,10,15));
        getWindow().setNavigationBarColor(Color.rgb(7,10,15));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(7,10,15));

        Button pause = new Button(this);
        pause.setText("Pause");
        pause.setTextSize(20f);
        pause.setAllCaps(false);
        pause.setOnClickListener(v -> {
            try {
                startService(new Intent(this, AudifyPlaybackService.class)
                    .setAction(AudifyPlaybackService.ACTION_PAUSE));
            } catch (Exception ignored) {}
        });

        int width = (int) (190 * getResources().getDisplayMetrics().density);
        int height = (int) (64 * getResources().getDisplayMetrics().density);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(width, height);
        lp.gravity = Gravity.CENTER;
        root.addView(pause, lp);

        setContentView(root, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
    }
}
`;
await writeFile(path.join(pkgDir,'NativePlayerActivity.java'),activity,'utf8');

const mainPath=path.join(pkgDir,'MainActivity.java');
let main=await readFile(mainPath,'utf8');
const marker='            android.widget.Toast.makeText(this, "Lecture : " + chosen.title, android.widget.Toast.LENGTH_SHORT).show();';
if(!main.includes(marker)) throw new Error('Point lecture natif V67.4 introuvable');
main=main.replace(marker, String.raw`            try {
                startActivity(new android.content.Intent(this, NativePlayerActivity.class));
            } catch (Throwable error) {
                android.widget.Toast.makeText(this, "Impossible d'ouvrir le lecteur natif", android.widget.Toast.LENGTH_SHORT).show();
            }`);
await writeFile(mainPath,main,'utf8');

const manifestPath=path.join(root,'android','app','src','main','AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
if(!manifest.includes('android:name=".NativePlayerActivity"')){
  manifest=manifest.replace('</application>', `        <activity
            android:name=".NativePlayerActivity"
            android:exported="false"
            android:screenOrientation="unspecified" />
    </application>`);
}
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify Android V67.7 : lecture -> vraie page native Android avec bouton Pause uniquement.');
