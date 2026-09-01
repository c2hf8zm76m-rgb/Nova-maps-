import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
const loginPath=path.join(pkgDir,'AudifyLoginActivity.java');

const home=await readFile(homePath,'utf8');
const login=await readFile(loginPath,'utf8');

const homeReady=home.includes('localPhotoV681226')&&home.includes('profilePhotoStampV681226');
const accountReady=login.includes('chooseProfilePhotoV681226')&&login.includes('saveProfilePhotoV681226');

if(homeReady&&accountReady){
  console.log('Audify V68.12.26.1 : photo de profil déjà appliquée, réapplication ignorée en sécurité.');
}else{
  await import('./v681226-custom-profile-photo.mjs');
}
