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
  if(!login.includes(oldValue)) throw new Error('V68.12.16 repère introuvable: '+label);
  login=login.replace(oldValue,newValue);
}

replaceRequired(
  '?"Créons ton compte Audify. Entre ton adresse e-mail et choisis un mot de passe d’au moins 8 caractères."',
  '?"Créons ton compte Audify. Entre ton adresse e-mail, choisis un mot de passe d’au moins 8 caractères puis confirme-le."',
  'sous-titre création'
);

replaceRequired(
  `        EditText password=field("8 caractères minimum"); password.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD); password.setSingleLine(true);\n        card.addView(password,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));\n\n        TextView status=text("",13f,true);`,
  `        EditText password=field("8 caractères minimum"); password.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD); password.setSingleLine(true);\n        card.addView(password,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));\n\n        final EditText confirmPasswordV681216;\n        if(createModeV681215){\n            TextView confirmLabel=text("Confirmer le mot de passe",13.5f,true);\n            confirmLabel.setTextColor(Color.rgb(214,220,229));\n            LinearLayout.LayoutParams confirmLabelLp=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(38));\n            confirmLabelLp.topMargin=dp(12);\n            card.addView(confirmLabel,confirmLabelLp);\n\n            confirmPasswordV681216=field("Répète ton mot de passe");\n            confirmPasswordV681216.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);\n            confirmPasswordV681216.setSingleLine(true);\n            card.addView(confirmPasswordV681216,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));\n        }else{\n            confirmPasswordV681216=null;\n        }\n\n        TextView status=text("",13f,true);`,
  'champ confirmation mot de passe'
);

replaceRequired(
  `        signIn.setOnClickListener(v->{\n            hideKeyboard();\n            AudifyAccountStore.Result r=createModeV681215`,
  `        signIn.setOnClickListener(v->{\n            hideKeyboard();\n            if(createModeV681215){\n                String firstPasswordV681216=password.getText().toString();\n                String secondPasswordV681216=confirmPasswordV681216==null?"":confirmPasswordV681216.getText().toString();\n                if(!firstPasswordV681216.equals(secondPasswordV681216)){\n                    status.setVisibility(android.view.View.VISIBLE);\n                    status.setText("Les mots de passe ne sont pas identiques.");\n                    status.setTextColor(Color.rgb(255,108,118));\n                    return;\n                }\n            }\n            AudifyAccountStore.Result r=createModeV681215`,
  'validation confirmation'
);

await writeFile(loginPath,login,'utf8');
console.log('Audify V68.12.16 : connexion à 2 champs ; création avec mot de passe + confirmation obligatoire et validation d’égalité.');
