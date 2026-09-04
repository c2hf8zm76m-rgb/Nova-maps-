import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const splashPath=path.join(root,'android','app','src','main','java','com','nova','audify','AudifySplashActivity.java');
const splash=await readFile(splashPath,'utf8');

const REQUIRED=[
  'AUDIFY_V6812652_EXACT_GRADIENT_A_SPLASH',
  'AudifyGradientMarkView',
  'Audify prépare votre accueil'
];
const FORBIDDEN=[
  'VOTRE MUSIQUE PREND VIE',
  'Préparation de votre musique',
  'R.drawable.audify_launcher',
  'startRingPulse',
  'EqualizerView',
  'outerRing',
  'innerRing',
  'logoShell'
];

for(const marker of REQUIRED){
  if(!splash.includes(marker)) throw new Error('AUDIFY SPLASH LOCK: required real V68.13 marker missing: '+marker);
}
for(const bad of FORBIDDEN){
  if(splash.includes(bad)) throw new Error('AUDIFY SPLASH LOCK: forbidden Pulse Splash element detected: '+bad);
}

console.log('AUDIFY SPLASH LOCK OK: real Gradient-A splash present; forbidden Pulse Splash absent.');
