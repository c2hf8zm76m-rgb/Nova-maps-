import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const themePath=path.join(root,'android','app','src','main','res','values-v31','audify_splash_theme.xml');
let xml=await readFile(themePath,'utf8');

// postSplashScreenTheme belongs to the AndroidX SplashScreen compat API, not to
// the android: namespace. Audify uses its own splash Activity, so this item is
// unnecessary and must not be emitted into values-v31.
xml=xml.replace(/\s*<item name="android:postSplashScreenTheme">[^<]*<\/item>/g,'');

if(xml.includes('android:postSplashScreenTheme')){
  throw new Error('Audify V68.13.2 Android 12 splash fix failed: invalid postSplashScreenTheme remains');
}
await writeFile(themePath,xml,'utf8');
console.log('Audify V68.13.2: Android 12 splash theme fixed; invalid postSplashScreenTheme removed.');
