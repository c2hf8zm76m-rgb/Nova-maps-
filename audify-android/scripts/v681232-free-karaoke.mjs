import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');

function replaceMethod(source,signature,replacement,label){
  const start=source.indexOf(signature);
  if(start<0) throw new Error(`V68.12.32 : méthode introuvable ${label}`);
  const brace=source.indexOf('{',start);
  if(brace<0) throw new Error(`V68.12.32 : accolade introuvable ${label}`);
  let depth=0,end=-1;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{') depth++;
    else if(source[i]==='}'){
      depth--;
      if(depth===0){ end=i+1; break; }
    }
  }
  if(end<0) throw new Error(`V68.12.32 : fin méthode introuvable ${label}`);
  return source.slice(0,start)+replacement+source.slice(end);
}

// 1) Le bouton Karaoke ouvre désormais directement la page, sans passer par AdMob.
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
let player=await readFile(playerPath,'utf8');
player=replaceMethod(
  player,
  '    private void openKaraoke(){',
  `    private void openKaraoke(){\n        openKaraokeUnlockedV68129();\n    }`,
  'NativePlayerActivity.openKaraoke'
);
if(player.includes('askRewardedKaraoke(this,this::openKaraokeUnlockedV68129)')){
  throw new Error('V68.12.32 : le verrou publicitaire Karaoke est encore présent dans le player');
}
await writeFile(playerPath,player,'utf8');

// 2) Sécurité supplémentaire : même si un ancien appel utilise encore le manager,
// askRewardedKaraoke devient un simple pass-through gratuit et ne charge aucune pub.
const managerPath=path.join(pkgDir,'AudifyMonetizationManager.java');
let manager=await readFile(managerPath,'utf8');
manager=replaceMethod(
  manager,
  '    public void askRewardedKaraoke(Activity activity,Runnable reward){',
  `    public void askRewardedKaraoke(Activity activity,Runnable reward){\n        if(activity==null) return;\n        if(reward!=null) reward.run();\n    }`,
  'AudifyMonetizationManager.askRewardedKaraoke'
);
if(manager.includes('Débloquer le Karaoké')||manager.includes('ouvrir le Karaoké de ce titre')){
  throw new Error('V68.12.32 : texte de pub Karaoke encore présent dans le manager');
}
await writeFile(managerPath,manager,'utf8');

// 3) Premium ne doit plus vendre le Karaoke comme avantage payant.
const premiumPath=path.join(pkgDir,'AudifyPremiumActivity.java');
let premium=await readFile(premiumPath,'utf8');
premium=premium.replace(
  'Un achat unique pour profiter d’Audify sans les publicités Audify et sans déblocage publicitaire pour le Karaoké ou la création de playlists.',
  'Un achat unique pour profiter d’Audify sans les publicités Audify et créer de nouvelles playlists sans déblocage publicitaire. Le Karaoké est gratuit pour tout le monde.'
);
if(premium.includes('déblocage publicitaire pour le Karaoké')){
  throw new Error('V68.12.32 : Premium présente encore le Karaoke comme fonctionnalité payante');
}
await writeFile(premiumPath,premium,'utf8');

// 4) Marqueur de décision produit : aucun futur patch ne doit remettre une pub devant Karaoke.
const lockDir=path.join(root,'locks');
await mkdir(lockDir,{recursive:true});
await writeFile(path.join(lockDir,'karaoke-free-v681232.lock.json'),JSON.stringify({
  feature:'Audify Karaoke',
  lockedVersion:'V68.12.32',
  status:'LOCKED_FREE_FEATURE',
  policy:'Karaoke must open directly for every user, Premium or free. Do not reintroduce rewarded ads, paywalls, coins, timers, or subscription gates unless the user explicitly requests it.',
  monetizationImpact:{
    rewardedKaraoke:'disabled',
    premiumBypassRequired:false,
    otherAds:'unchanged',
    rewardedPlaylist:'unchanged'
  }
},null,2)+'\n','utf8');

console.log('Audify V68.12.32 : Karaoke gratuit, accès direct et verrouillé comme fonctionnalité gratuite.');
