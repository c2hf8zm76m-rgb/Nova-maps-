// Preserve the validated V68.12.46 Media3 activation and legacy Redmi fixes.
import './v681246-premium-redmi-stable.mjs';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const android = path.join(root, 'android');
const javaDir = path.join(android, 'app', 'src', 'main', 'java', 'com', 'nova', 'audify');
// Premium is still a preview: do not migrate billing or enable purchases.
// These V68.12.47–52 sources come from main@e06ed4a and are now part of the
// regular APK build rather than an independently injected DEX overlay.
for (const name of ['AudifyShareBootstrapProvider', 'AudifyDeepLinkBridge',
  'AudifyAudioRouteIndicator', 'AudifyWidgetProvider', 'AudifyStatsTracker',
  'AudifyStatsOverlay', 'AudifyAlbumIdentifier']) {
  await copyFile(path.join(root, 'share-overlay', `${name}.java`), path.join(javaDir, `${name}.java`));
}
const mainDir = path.join(android, 'app', 'src', 'main');
for (const resource of ['layout/audify_widget.xml', 'xml/audify_widget_info.xml']) {
  const target = path.join(mainDir, 'res', resource);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, 'templates', 'premium-v681253', 'res', resource), target);
}

const manifestPath = path.join(mainDir, 'AndroidManifest.xml');
let manifest = await readFile(manifestPath, 'utf8');
if (!manifest.includes('android:name=".AudifyShareBootstrapProvider"')) {
  manifest = manifest.replace('</application>', `
        <provider android:name=".AudifyShareBootstrapProvider"
            android:authorities="com.nova.audify.sharebootstrap"
            android:exported="false" />
        <receiver android:name=".AudifyWidgetProvider" android:exported="false" android:label="Audify">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/audify_widget_info" />
        </receiver>
    </application>`);
}
if (!manifest.includes('android:scheme="audify"')) {
  const home = /(<activity\b[^>]*android:name="\.NativeHomeActivity"[^>]*>)([\s\S]*?)(<\/activity>)/;
  if (!home.test(manifest)) throw new Error('NativeHomeActivity manifest entry missing');
  manifest = manifest.replace(home, `$1$2
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="audify" android:host="song" />
            </intent-filter>
        $3`);
}
await writeFile(manifestPath, manifest, 'utf8');

const homePath = path.join(javaDir, 'NativeHomeActivity.java');
let home = await readFile(homePath, 'utf8');
if (!home.includes('onNewIntent(android.content.Intent')) {
  if (/void\s+onNewIntent\s*\(/.test(home)) throw new Error('Existing onNewIntent needs explicit integration');
  home = home.replace('public class NativeHomeActivity extends AppCompatActivity {', `public class NativeHomeActivity extends AppCompatActivity {
    @Override protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        try { AudifyDeepLinkBridge.handle(this); } catch (Throwable ignored) {}
    }
`);
  await writeFile(homePath, home, 'utf8');
}

const premium = await readFile(path.join(root, 'templates', 'AudifyPremiumActivityV681253.java.tpl'), 'utf8');
await writeFile(path.join(javaDir, 'AudifyPremiumActivity.java'), premium, 'utf8');

const gradlePath = path.join(android, 'app', 'build.gradle');
let gradle = await readFile(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode 681253')
  .replace(/versionName\s+["'][^"']+["']/, 'versionName "68.12.53"');
await writeFile(gradlePath, gradle, 'utf8');

console.log('Audify V68.12.53 : Premium néon en aperçu, ajouts V68.12.46–52 conservés, aucun achat activé.');
