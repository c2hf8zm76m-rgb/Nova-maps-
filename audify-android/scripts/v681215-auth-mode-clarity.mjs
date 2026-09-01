import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const loginPath=path.join(pkgDir,'AudifyLoginActivity.java');

let login=await readFile(loginPath,'utf8');

function replaceRequired(oldValue,newValue,label){
  if(!login.includes(oldValue)) throw new Error('V68.12.15 repère introuvable: '+label);
  login=login.replace(oldValue,newValue);
}

// Deux vrais modes visuels : connexion et création. Le bouton secondaire ne
// crée plus le compte immédiatement : il bascule d'abord vers l'écran création.
replaceRequired(
  '    private AudifyAccountStore accounts;\n',
  '    private AudifyAccountStore accounts;\n    private boolean createModeV681215=false;\n',
  'champ createMode'
);

replaceRequired(
  `        TextView title=text("Se connecter",34f,true);\n        page.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54)));\n        TextView subtitle=text("Crée ton compte Audify ou reconnecte-toi. Ta session restera active sur cet appareil.",15.5f,false);`,
  `        TextView modeTag=text(createModeV681215?"CRÉATION DE COMPTE":"CONNEXION",11.5f,true);\n        modeTag.setTextColor(ACCENT);\n        modeTag.setLetterSpacing(0.14f);\n        LinearLayout.LayoutParams modeLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(28));\n        modeLp.topMargin=dp(2);\n        page.addView(modeTag,modeLp);\n\n        TextView title=text(createModeV681215?"Bienvenue parmi nous":"Bon retour parmi nous",34f,true);\n        page.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(54)));\n        TextView subtitle=text(createModeV681215\n            ?"Créons ton compte Audify. Entre ton adresse e-mail et choisis un mot de passe d’au moins 8 caractères."\n            :"Reconnecte-toi à ton compte Audify pour retrouver ta bibliothèque et ta session.",15.5f,false);`,
  'en-tête connexion/création'
);

replaceRequired(
  '        Button signIn=activeButton("Se connecter",true);',
  '        Button signIn=activeButton(createModeV681215?"Créer mon compte":"Se connecter",true);',
  'bouton principal'
);

replaceRequired(
  '        Button create=activeButton("Créer un compte",false);',
  '        Button create=activeButton(createModeV681215?"J’ai déjà un compte":"Créer un compte",false);',
  'bouton changement de mode'
);

replaceRequired(
  `        signIn.setOnClickListener(v->{\n            hideKeyboard();\n            AudifyAccountStore.Result r=accounts.signIn(email.getText().toString(),password.getText().toString());\n            showStatus(status,r);\n            if(r.ok) status.postDelayed(()->{renderProfile();},420L);\n        });\n        create.setOnClickListener(v->{\n            hideKeyboard();\n            AudifyAccountStore.Result r=accounts.createAccount(email.getText().toString(),password.getText().toString());\n            showStatus(status,r);\n            if(r.ok) status.postDelayed(()->{renderProfile();},420L);\n        });`,
  `        signIn.setOnClickListener(v->{\n            hideKeyboard();\n            AudifyAccountStore.Result r=createModeV681215\n                ?accounts.createAccount(email.getText().toString(),password.getText().toString())\n                :accounts.signIn(email.getText().toString(),password.getText().toString());\n            showStatus(status,r);\n            if(r.ok) status.postDelayed(()->{renderProfile();},420L);\n        });\n        create.setOnClickListener(v->{\n            hideKeyboard();\n            createModeV681215=!createModeV681215;\n            renderAuth();\n        });`,
  'actions connexion/création'
);

replaceRequired(
  '        Button google=activeButton("G   Se connecter avec Google",false);',
  '        Button google=activeButton(createModeV681215?"G   Créer avec Google":"G   Se connecter avec Google",false);',
  'libellé Google'
);

// Quand une session est fermée, on revient naturellement à l'écran Connexion.
replaceRequired(
  '            accounts.signOut();\n            if(google&&googleClient!=null){',
  '            accounts.signOut();\n            createModeV681215=false;\n            if(google&&googleClient!=null){',
  'retour mode connexion après déconnexion'
);

await writeFile(loginPath,login,'utf8');
console.log('Audify V68.12.15 : Connexion = Bon retour parmi nous ; Création = Bienvenue parmi nous, avec bascule visuelle réelle avant création du compte.');
