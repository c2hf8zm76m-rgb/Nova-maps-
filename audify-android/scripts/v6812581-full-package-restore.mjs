import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const gradlePath=path.join(root,'android','app','build.gradle');
let gradle=await readFile(gradlePath,'utf8');
const marker='// AUDIFY_V6812581_FULL_PACKAGE_RESTORE';
if(!gradle.includes(marker)){
  gradle += `\n\n${marker}\ndependencies {\n    // Firebase BoM is already configured by Audify's account/cloud patches.\n    // Do not pin Firebase module versions here: the BoM keeps the graph coherent.\n    implementation 'com.google.firebase:firebase-auth'\n    implementation 'com.google.firebase:firebase-firestore'\n    implementation 'com.google.firebase:firebase-storage'\n    implementation 'com.google.firebase:firebase-database'\n    implementation 'com.google.firebase:firebase-appcheck'\n    implementation 'com.google.firebase:firebase-appcheck-playintegrity'\n\n    // Stable V68.12.54 contained AndroidX Credentials + DataStore 1.1.7, including\n    // libdatastore_shared_counter.so for all four Android ABIs.\n    implementation 'androidx.credentials:credentials:1.3.0'\n    implementation 'androidx.credentials:credentials-play-services-auth:1.3.0'\n    implementation 'androidx.datastore:datastore:1.1.7'\n    implementation 'androidx.datastore:datastore-preferences:1.1.7'\n    implementation 'com.google.android.libraries.identity.googleid:googleid:1.1.1'\n    implementation 'com.google.android.gms:play-services-auth:21.6.0'\n}\n`;
  await writeFile(gradlePath,gradle,'utf8');
}
console.log('Audify V68.12.58.1 full-package dependency restore applied (BoM-compatible)');
