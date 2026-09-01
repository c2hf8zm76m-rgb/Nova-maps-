import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');

// Media3 1.11.0 exige compileSdk 36. Android recommande AGP >= 8.9.1 pour API 36.
const rootGradlePath=path.join(android,'build.gradle');
let rootGradle=await readFile(rootGradlePath,'utf8');
const beforeAgp=rootGradle;
rootGradle=rootGradle.replace(
  /com\.android\.tools\.build:gradle:[0-9A-Za-z.\-]+/g,
  'com.android.tools.build:gradle:8.9.1'
);
if(rootGradle===beforeAgp || !rootGradle.includes('com.android.tools.build:gradle:8.9.1')){
  throw new Error('V68.12.0 AGP généré introuvable pour migration 8.9.1');
}
await writeFile(rootGradlePath,rootGradle,'utf8');

const variablesPath=path.join(android,'variables.gradle');
let variables=await readFile(variablesPath,'utf8');
const beforeVariables=variables;
variables=variables.replace(/compileSdkVersion\s*=\s*35/g,'compileSdkVersion = 36');
if(variables===beforeVariables || !/compileSdkVersion\s*=\s*36/.test(variables)){
  throw new Error('V68.12.0 compileSdkVersion généré introuvable pour migration API 36');
}
// On conserve volontairement targetSdk tel quel : compiler avec API 36 ne change pas les règles runtime existantes.
await writeFile(variablesPath,variables,'utf8');

// Sécurité si Capacitor change un jour le template et écrit compileSdk directement dans app/build.gradle.
const appGradlePath=path.join(android,'app','build.gradle');
let appGradle=await readFile(appGradlePath,'utf8');
appGradle=appGradle.replace(/compileSdk\s+35/g,'compileSdk 36');
appGradle=appGradle.replace(/compileSdkVersion\s+35/g,'compileSdkVersion 36');
await writeFile(appGradlePath,appGradle,'utf8');

console.log('Audify V68.12.0 : toolchain API 36 appliqué (AGP 8.9.1 + compileSdk 36, targetSdk inchangé).');
