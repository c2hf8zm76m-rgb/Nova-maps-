import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const android=path.join(root,'android');
const pkgDir=path.join(android,'app','src','main','java','com','nova','audify');
const config=JSON.parse(await readFile(path.join(root,'ads-config.json'),'utf8'));

function validAd(id){ return /^ca-app-pub-\d+\/\d+$/.test(String(id||'')); }
for(const k of ['interstitialAdUnitId','nativeAdUnitId','rewardedKaraokeAdUnitId','rewardedPlaylistAdUnitId']){
  if(!validAd(config[k])) throw new Error('V68.12.9 identifiant AdMob invalide: '+k);
}
const premiumProductId=String(config.premiumProductId||'audify_premium_lifetime').trim();
if(!premiumProductId) throw new Error('V68.12.9 premiumProductId manquant');

const gradlePath=path.join(android,'app','build.gradle');
let gradle=await readFile(gradlePath,'utf8');
if(!gradle.includes('com.android.billingclient:billing:6.2.1')){
  gradle=gradle.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'com.android.billingclient:billing:6.2.1'");
}
await writeFile(gradlePath,gradle,'utf8');

let manager=await readFile(path.join(root,'templates','AudifyMonetizationManager.java.tpl'),'utf8');
manager=manager
  .replace('__INTERSTITIAL__',String(config.interstitialAdUnitId))
  .replace('__NATIVE__',String(config.nativeAdUnitId))
  .replace('__KARAOKE__',String(config.rewardedKaraokeAdUnitId))
  .replace('__PLAYLIST__',String(config.rewardedPlaylistAdUnitId))
  .replace('__PREMIUM__',premiumProductId.replace(/"/g,''));
await writeFile(path.join(pkgDir,'AudifyMonetizationManager.java'),manager,'utf8');

const premium=await readFile(path.join(root,'templates','AudifyPremiumActivity.java.tpl'),'utf8');
await writeFile(path.join(pkgDir,'AudifyPremiumActivity.java'),premium,'utf8');

function extractMethod(src,signatures){
  for(const sig of signatures){
    const start=src.indexOf(sig);
    if(start<0) continue;
    const brace=src.indexOf('{',start);
    if(brace<0) continue;
    let depth=0;
    for(let i=brace;i<src.length;i++){
      if(src[i]==='{') depth++;
      else if(src[i]==='}'){
        depth--;
        if(depth===0) return {start,end:i+1,text:src.slice(start,i+1)};
      }
    }
  }
  return null;
}

function wrapMethod(src,signatures,newName,wrapper){
  const m=extractMethod(src,signatures);
  if(!m) return src;
  const renamed=m.text.replace(/private void\s+\w+\s*\(/,'private void '+newName+'(');
  return src.slice(0,m.start)+wrapper+'\n\n'+renamed+src.slice(m.end);
}

const homePath=path.join(pkgDir,'NativeHomeActivity.java');
let home=await readFile(homePath,'utf8');

if(!home.includes('openSearchAfterAdV68129')){
  home=wrapMethod(
    home,
    ['    private void openSearch(){','    private void openSearch() {'],
    'openSearchAfterAdV68129',
    '    private void openSearch(){ AudifyMonetizationManager.get(this).showSearchInterstitial(this,this::openSearchAfterAdV68129); }'
  );
}

if(home.includes('addAccountEntryV68121();') && !home.includes('addPremiumEntryV68129();')){
  home=home.replace('addAccountEntryV68121();','addAccountEntryV68121();\n        addPremiumEntryV68129();');
}

if(!home.includes('private void addPremiumEntryV68129()')){
  const marker='    private void addForYouSection(){';
  const helper=[
    '    private void addPremiumEntryV68129(){',
    '        LinearLayout panel=sectionPanel();',
    '        panel.setGravity(Gravity.CENTER_VERTICAL);',
    '        panel.setPadding(dp(16),dp(10),dp(12),dp(10));',
    '        TextView label=text(AudifyMonetizationManager.get(this).isPremium()?"Audify Premium actif":"Audify Premium · 9,99 € à vie",15f,true);',
    '        panel.addView(label,new LinearLayout.LayoutParams(0,dp(50),1f));',
    '        Button open=pillButton(AudifyMonetizationManager.get(this).isPremium()?"Actif":"Découvrir");',
    '        open.setOnClickListener(v->startActivity(new Intent(this,AudifyPremiumActivity.class)));',
    '        panel.addView(open,new LinearLayout.LayoutParams(dp(118),dp(48)));',
    '        addPanel(panel,dp(9));',
    '    }',
    ''
  ].join('\n');
  if(home.includes(marker)) home=home.replace(marker,helper+marker);
}
await writeFile(homePath,home,'utf8');

const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
let player=await readFile(playerPath,'utf8');
if(!player.includes('openKaraokeUnlockedV68129')){
  player=wrapMethod(
    player,
    ['    private void openKaraoke(){','    private void openKaraoke() {'],
    'openKaraokeUnlockedV68129',
    '    private void openKaraoke(){ AudifyMonetizationManager.get(this).askRewardedKaraoke(this,this::openKaraokeUnlockedV68129); }'
  );
}
await writeFile(playerPath,player,'utf8');

for(const name of await readdir(pkgDir)){
  if(!name.endsWith('.java')) continue;
  const p=path.join(pkgDir,name);
  let src=await readFile(p,'utf8');
  if(src.includes('promptNewPlaylistUnlockedV68129')) continue;
  const before=src;
  src=wrapMethod(
    src,
    ['    private void promptNewPlaylist(){','    private void promptNewPlaylist() {'],
    'promptNewPlaylistUnlockedV68129',
    '    private void promptNewPlaylist(){ AudifyMonetizationManager.get(this).askRewardedPlaylist(this,this::promptNewPlaylistUnlockedV68129); }'
  );
  if(src!==before) await writeFile(p,src,'utf8');
}

const mainPath=path.join(pkgDir,'MainActivity.java');
let main=await readFile(mainPath,'utf8');
const nativeNeedle='audifySearchListV672.addView(queryView);';
if(main.includes(nativeNeedle) && !main.includes('insertNativeSearchAd(this,audifySearchListV672)')){
  main=main.replace(nativeNeedle,nativeNeedle+' AudifyMonetizationManager.get(this).insertNativeSearchAd(this,audifySearchListV672);');
}
await writeFile(mainPath,main,'utf8');

const appPath=path.join(pkgDir,'AudifyApplication.java');
let app=await readFile(appPath,'utf8');
if(!app.includes('isPremiumStatic(this)')){
  app=app.replace(
    '    private void loadAppOpenAd() {',
    '    private void loadAppOpenAd() {\n        if (AudifyMonetizationManager.isPremiumStatic(this)) { launchOpportunityConsumed = true; return; }'
  );
  app=app.replace(
    '    private void showIfLaunchIsStillActive() {',
    '    private void showIfLaunchIsStillActive() {\n        if (AudifyMonetizationManager.isPremiumStatic(this)) { launchOpportunityConsumed = true; appOpenAd = null; return; }'
  );
}
await writeFile(appPath,app,'utf8');

const manifestPath=path.join(android,'app','src','main','AndroidManifest.xml');
let manifest=await readFile(manifestPath,'utf8');
if(!manifest.includes('android:name=".AudifyPremiumActivity"')){
  manifest=manifest.replace(
    '</application>',
    '        <activity android:name=".AudifyPremiumActivity" android:exported="false" android:screenOrientation="portrait" />\n    </application>'
  );
}
await writeFile(manifestPath,manifest,'utf8');

console.log('Audify V68.12.9 : base complète de monétisation intégrée.');
