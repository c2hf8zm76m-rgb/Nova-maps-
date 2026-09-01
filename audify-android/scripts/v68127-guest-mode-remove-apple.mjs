import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const loginPath=path.join(pkgDir,'AudifyLoginActivity.java');
const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');

let login=await readFile(loginPath,'utf8');

const appleBlock=String.raw`        Button apple=activeButton("●   Se connecter avec Apple",false);
        apple.setTextColor(Color.rgb(242,244,248));
        apple.setBackground(round(Color.rgb(20,24,31),dp(1),Color.rgb(72,80,92),dp(22)));
        apple.setOnClickListener(v->beginAppleSignInV68125());`;

const guestBlock=String.raw`        Button apple=activeButton("Continuer sans compte",false);
        apple.setTextColor(Color.rgb(225,231,239));
        apple.setBackground(round(Color.rgb(20,24,31),dp(1),Color.rgb(72,80,92),dp(22)));
        apple.setContentDescription("Continuer en mode invité, sans compte");
        apple.setOnClickListener(v->{
            android.widget.Toast.makeText(this,"Mode invité · tes données restent sur cet appareil",android.widget.Toast.LENGTH_SHORT).show();
            finish();
        });`;

if(!login.includes(appleBlock)) throw new Error('V68.12.7 bouton Apple final introuvable');
login=login.replace(appleBlock,guestBlock);

login=login.replace(
  'Google est actif. Apple utilise maintenant le flux OAuth sécurisé Audify.',
  'Google est actif. Tu peux aussi continuer sans compte et garder tes données uniquement sur cet appareil.'
);

// Aucun nouveau compte Apple n'est proposé. Les anciennes sessions éventuelles restent lisibles
// afin de ne jamais bloquer un utilisateur qui aurait déjà testé une ancienne version.
await writeFile(loginPath,login,'utf8');

let manifest=await readFile(manifestPath,'utf8');
manifest=manifest.replace(/\s*<activity\s+android:name="\.AudifyAppleCallbackActivity"[\s\S]*?<\/activity>\s*/m,'\n');
await writeFile(manifestPath,manifest,'utf8');

// Supprime les composants Apple générés par V68.12.5 : ils ne sont plus exposés dans l'APK.
for(const p of [
  path.join(pkgDir,'AudifyAppleCallbackActivity.java'),
  path.join(android,'app','src','main','res','values','audify_apple_auth.xml')
]){
  try{await unlink(p);}catch{}
}

console.log('Audify V68.12.7 : Sign in with Apple retiré, bouton remplacé par Continuer sans compte.');
