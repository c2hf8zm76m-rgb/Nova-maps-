import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const gradlePath=path.join(root,'android','app','build.gradle');
let gradle=await readFile(gradlePath,'utf8');
const marker='// AUDIFY_V6812581_FULL_PACKAGE_RESTORE';
if(!gradle.includes(marker)){
  gradle += `\n\n${marker}\ndependencies {\n    // Restore the dependency families that were present in the stable V68.12.54 package.\n    implementation 'com.google.firebase:firebase-auth:24.2.0'\n    implementation 'com.google.firebase:firebase-firestore:26.6.0'\n    implementation 'com.google.firebase:firebase-storage:22.0.1'\n    implementation 'com.google.firebase:firebase-database:22.0.1'\n    implementation 'com.google.firebase:firebase-appcheck:19.4.1'\n    implementation 'com.google.firebase:firebase-appcheck-playintegrity:19.4.1'\n    implementation 'androidx.credentials:credentials:1.3.0'\n    implementation 'androidx.credentials:credentials-play-services-auth:1.3.0'\n    implementation 'com.google.android.libraries.identity.googleid:googleid:1.1.1'\n    implementation 'com.google.android.gms:play-services-auth:21.6.0'\n}\n`;
  await writeFile(gradlePath,gradle,'utf8');
}
console.log('Audify V68.12.58.1 full-package dependency restore applied');
