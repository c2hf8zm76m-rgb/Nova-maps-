import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
const managerPath=path.join(pkgDir,'AudifyMonetizationManager.java');
const premiumPath=path.join(pkgDir,'AudifyPremiumActivity.java');

function findMethod(source,signatures,label){
  for(const signature of signatures){
    const start=source.indexOf(signature);
    if(start<0)continue;
    const brace=source.indexOf('{',start);
    if(brace<0)continue;
    let depth=0,end=-1;
    for(let i=brace;i<source.length;i++){
      if(source[i]==='{')depth++;
      else if(source[i]==='}'){
        depth--;
        if(depth===0){end=i+1;break;}
      }
    }
    if(end>0)return {start,brace,end};
  }
  throw new Error(`V68.12.35 méthode introuvable: ${label}`);
}
function replaceMethod(source,signatures,replacement,label){
  const f=findMethod(source,signatures,label);
  return source.slice(0,f.start)+replacement+source.slice(f.end);
}

// -----------------------------------------------------------------------------
// 1) HOME: zéro BillingClient pendant le lancement + parachute de démarrage.
// -----------------------------------------------------------------------------
let home=await readFile(homePath,'utf8');

home=replaceMethod(home,[
  '    private void addPremiumEntryV68129(){',
  '    private void addPremiumEntryV68129() {'
],String.raw`    private void addPremiumEntryV68129(){
        LinearLayout panel=sectionPanel();
        panel.setGravity(Gravity.CENTER_VERTICAL);
        panel.setPadding(dp(16),dp(10),dp(12),dp(10));
        // IMPORTANT V68.12.35 : lecture statique uniquement. Ne construit PAS
        // AudifyMonetizationManager et ne touche donc jamais Google Play Billing.
        boolean premiumV681235=AudifyMonetizationManager.isPremiumStatic(this);
        TextView label=text(premiumV681235?"Audify Premium actif":"Audify Premium · 9,99 € à vie",15f,true);
        panel.addView(label,new LinearLayout.LayoutParams(0,dp(50),1f));
        Button open=pillButton(premiumV681235?"Actif":"Découvrir");
        open.setOnClickListener(v->startActivity(new Intent(this,AudifyPremiumActivity.class)));
        panel.addView(open,new LinearLayout.LayoutParams(dp(118),dp(48)));
        addPanel(panel,dp(9));
    }`,'addPremiumEntryV68129');

// Transforme onCreate en noyau protégé. Toute exception Java/LinkageError dans le
// Home affiche un écran de secours au lieu de fermer brutalement l'application.
const create=findMethod(home,[
  '    @Override protected void onCreate(Bundle savedInstanceState){',
  '    @Override protected void onCreate(Bundle savedInstanceState) {'
],'NativeHomeActivity.onCreate');
let createBody=home.slice(create.brace+1,create.end-1);
createBody=createBody.replace(/\s*super\.onCreate\(savedInstanceState\);/,'');
const guardedCreate=String.raw`    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        try{
            onCreateAudifyV681235(savedInstanceState);
        }catch(Throwable startupV681235){
            showStartupFallbackV681235(startupV681235);
        }
    }

    private void onCreateAudifyV681235(Bundle savedInstanceState){${createBody}
    }

    private void showStartupFallbackV681235(Throwable error){
        try{
            if(getSupportActionBar()!=null)getSupportActionBar().hide();
            getWindow().setStatusBarColor(Color.rgb(5,8,12));
            getWindow().setNavigationBarColor(Color.rgb(4,7,11));
            LinearLayout fallback=new LinearLayout(this);
            fallback.setOrientation(LinearLayout.VERTICAL);
            fallback.setGravity(Gravity.CENTER);
            fallback.setPadding(dp(28),dp(28),dp(28),dp(28));
            fallback.setBackgroundColor(Color.rgb(5,8,12));
            TextView logo=text("A",34f,true);
            logo.setGravity(Gravity.CENTER);
            logo.setTextColor(Color.rgb(157,255,50));
            fallback.addView(logo,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(70)));
            TextView title=text("Audify a protégé le démarrage",22f,true);
            title.setGravity(Gravity.CENTER);
            fallback.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)));
            TextView info=text("Une fonction incompatible avec cet appareil a été neutralisée. Tes données sont conservées.",14f,false);
            info.setTextColor(Color.rgb(170,181,195));
            info.setGravity(Gravity.CENTER);
            info.setPadding(0,dp(8),0,dp(18));
            fallback.addView(info,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(100)));
            Button retry=greenButton("Réessayer");
            retry.setOnClickListener(v->recreate());
            fallback.addView(retry,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(56)));
            setContentView(fallback);
        }catch(Throwable ignored){
            // Dernier niveau: ne jamais relancer l'exception volontairement.
        }
    }`;
home=home.slice(0,create.start)+guardedCreate+home.slice(create.end);
await writeFile(homePath,home,'utf8');

// -----------------------------------------------------------------------------
// 2) BILLING: aucune initialisation dans le constructeur. Le SDK Play Billing
//    n'est touché qu'après ouverture volontaire de la page Premium.
// -----------------------------------------------------------------------------
let manager=await readFile(managerPath,'utf8');
if(!manager.includes('private boolean billingInitStarted=false;')){
  manager=manager.replace('    private boolean billingReady=false;',
    '    private boolean billingReady=false;\n    private boolean billingInitStarted=false;\n    private boolean billingInitFailed=false;');
}
manager=manager.replace(
  '        initBilling();\n        // V68.12.34 : AdMob désactivé temporairement.',
  '        // V68.12.35 : ni Billing ni AdMob au démarrage. Billing est lazy.\n        // AdMob reste désactivé temporairement.'
);

manager=replaceMethod(manager,[
  '    private void initBilling(){',
  '    private void initBilling() {'
],String.raw`    private synchronized void initBilling(){
        if(billingInitStarted||billingReady)return;
        billingInitStarted=true;
        billingInitFailed=false;
        try{
            billingClient=BillingClient.newBuilder(app).setListener(this).enablePendingPurchases().build();
            billingClient.startConnection(new BillingClientStateListener(){
                @Override public void onBillingSetupFinished(BillingResult result){
                    try{
                        billingReady=result!=null&&result.getResponseCode()==BillingClient.BillingResponseCode.OK;
                        billingInitFailed=!billingReady;
                        if(billingReady){queryPremiumProduct();restorePurchases();}
                    }catch(Throwable ignored){billingReady=false;billingInitFailed=true;}
                }
                @Override public void onBillingServiceDisconnected(){
                    billingReady=false;
                }
            });
        }catch(Throwable ignored){
            billingReady=false;
            billingInitFailed=true;
            billingClient=null;
        }
    }

    public void preparePremiumBilling(Activity activity){
        try{initBilling();}catch(Throwable ignored){}
    }`,'initBilling');

manager=replaceMethod(manager,[
  '    public void launchPremiumPurchase(Activity activity){',
  '    public void launchPremiumPurchase(Activity activity) {'
],String.raw`    public void launchPremiumPurchase(Activity activity){
        if(activity==null)return;
        if(isPremium()){
            Toast.makeText(activity,"Audify Premium est déjà actif",Toast.LENGTH_SHORT).show();
            return;
        }
        try{
            if(!billingInitStarted)initBilling();
            if(billingInitFailed){
                Toast.makeText(activity,"Google Play Billing n'est pas disponible sur cet appareil.",Toast.LENGTH_LONG).show();
                return;
            }
            if(!billingReady||premiumDetails==null){
                Toast.makeText(activity,"Connexion à Google Play en cours. Réessaie dans quelques secondes.",Toast.LENGTH_LONG).show();
                return;
            }
            BillingFlowParams.ProductDetailsParams pd=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(premiumDetails).build();
            BillingFlowParams flow=BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(pd)).build();
            billingClient.launchBillingFlow(activity,flow);
        }catch(Throwable ignored){
            Toast.makeText(activity,"Google Play Billing est indisponible sur cet appareil.",Toast.LENGTH_LONG).show();
        }
    }`,'launchPremiumPurchase');
await writeFile(managerPath,manager,'utf8');

// -----------------------------------------------------------------------------
// 3) PREMIUM: c'est seulement ici, après action volontaire, que Billing démarre.
//    L'état Premium initial est lu statiquement pour ne dépendre d'aucun service.
// -----------------------------------------------------------------------------
let premium=await readFile(premiumPath,'utf8');
premium=premium.replace(
  '        super.onCreate(state);',
  '        super.onCreate(state);\n        try{AudifyMonetizationManager.get(this).preparePremiumBilling(this);}catch(Throwable ignored){}'
);
premium=premium.replaceAll('AudifyMonetizationManager.get(this).isPremium()','AudifyMonetizationManager.isPremiumStatic(this)');
await writeFile(premiumPath,premium,'utf8');

console.log('Audify Android V68.12.35 : Device Compatibility Shield actif, Home sans Billing, Billing lazy/fail-safe, fallback anti-crash.');
