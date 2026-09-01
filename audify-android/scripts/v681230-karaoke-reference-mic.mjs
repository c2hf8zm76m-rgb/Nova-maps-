import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const drawableDir=path.join(android,'app','src','main','res','drawable');
await mkdir(drawableDir,{recursive:true});

// Audify V68.12.30 — icône Karaoke redessinée d'après la référence validée :
// vrai micro de chant tenu à la main, incliné bas-gauche -> haut-droite,
// tête ronde, manche fin, petit interrupteur et rayons discrets autour de la tête.
// Le dessin reste vectoriel, monochrome blanc et très lisible dans le bouton glass 54x54.
const micVector=`<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="30dp"
    android:height="30dp"
    android:viewportWidth="32"
    android:viewportHeight="32">

    <!-- Corps du micro -->
    <path
        android:fillColor="#00000000"
        android:strokeColor="#FFFFFFFF"
        android:strokeWidth="1.9"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:pathData="M17.15,13.65 L8.65,24.15 C7.85,25.15 7.98,26.55 8.95,27.35 L9.45,27.75 C10.42,28.52 11.82,28.35 12.58,27.38 L21.05,16.85 Z" />

    <!-- Tête ronde du micro -->
    <path
        android:fillColor="#00000000"
        android:strokeColor="#FFFFFFFF"
        android:strokeWidth="1.9"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:pathData="M20.85,5.05 C24.05,5.05 26.65,7.65 26.65,10.85 C26.65,14.05 24.05,16.65 20.85,16.65 C19.22,16.65 17.75,15.98 16.70,14.90 C15.65,13.85 15.00,12.42 15.00,10.85 C15.00,7.65 17.62,5.05 20.85,5.05 Z" />

    <!-- Reflet / grille simplifiée sur la tête -->
    <path
        android:fillColor="#00000000"
        android:strokeColor="#FFFFFFFF"
        android:strokeWidth="1.55"
        android:strokeLineCap="round"
        android:pathData="M18.55,9.05 C19.35,8.28 20.48,7.92 21.55,8.05 C22.28,8.15 22.95,8.48 23.45,8.98" />

    <!-- Petit détail / interrupteur sur le manche -->
    <path
        android:fillColor="#00000000"
        android:strokeColor="#FFFFFFFF"
        android:strokeWidth="1.55"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:pathData="M12.85,20.45 L14.15,18.85 C14.47,18.45 15.08,18.38 15.48,18.70 C15.88,19.02 15.95,19.63 15.63,20.03 L14.33,21.63 C14.00,22.03 13.40,22.10 13.00,21.78 C12.60,21.45 12.53,20.85 12.85,20.45 Z" />

    <!-- Petit anneau de terminaison -->
    <path
        android:fillColor="#00000000"
        android:strokeColor="#FFFFFFFF"
        android:strokeWidth="1.7"
        android:strokeLineCap="round"
        android:pathData="M9.05,25.15 C7.70,24.72 6.25,25.45 5.82,26.80 C5.40,28.15 6.13,29.60 7.48,30.02 C8.62,30.38 9.85,29.90 10.45,28.90" />

    <!-- Rayons musicaux / éclat autour de la tête -->
    <path
        android:fillColor="#00000000"
        android:strokeColor="#FFFFFFFF"
        android:strokeWidth="1.65"
        android:strokeLineCap="round"
        android:pathData="M20.95,1.55 L20.95,3.15 M15.05,3.25 L16.25,4.45 M27.00,3.75 L25.80,4.95 M28.65,10.25 L30.35,10.25 M11.55,10.25 L13.20,10.25 M26.55,16.05 L27.85,17.35" />
</vector>
`;

await writeFile(path.join(drawableDir,'audify_ic_mic.xml'),micVector,'utf8');
console.log('Audify Android V68.12.30 : nouveau micro Karaoke inspiré de la référence validée, vectoriel blanc 30dp.');
