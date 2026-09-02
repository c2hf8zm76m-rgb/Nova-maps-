import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const java = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'nova', 'audify');

function findMethod(source, signatures, label) {
  for (const signature of signatures) {
    const start = source.indexOf(signature);
    if (start < 0) continue;
    const brace = source.indexOf('{', start);
    if (brace < 0) continue;
    let depth = 0;
    for (let i = brace; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}' && --depth === 0) return { start, brace, end: i + 1 };
    }
  }
  throw new Error(`V68.12.42 méthode introuvable: ${label}`);
}

function replaceMethod(source, signatures, replacement, label) {
  const method = findMethod(source, signatures, label);
  return source.slice(0, method.start) + replacement + source.slice(method.end);
}

// -----------------------------------------------------------------------------
// 1) NativeHome: no Firebase/avatar/renderer exception may terminate launch.
//    The fallback intentionally uses only platform widgets and no cloud service.
// -----------------------------------------------------------------------------
const homePath = path.join(java, 'NativeHomeActivity.java');
let home = await readFile(homePath, 'utf8');
if (!home.includes('showStartupHardFallbackV681242')) {
  home = replaceMethod(home, [
    '    @Override protected void onCreate(Bundle savedInstanceState){',
    '    @Override protected void onCreate(Bundle savedInstanceState) {'
  ], `    @Override protected void onCreate(Bundle savedInstanceState){
        androidx.core.splashscreen.SplashScreen systemSplash=null;
        try{
            systemSplash=androidx.core.splashscreen.SplashScreen.installSplashScreen(this);
            super.onCreate(savedInstanceState);
            if(getSupportActionBar()!=null)getSupportActionBar().hide();
            getWindow().setStatusBarColor(Color.rgb(5,8,12));
            getWindow().setNavigationBarColor(Color.rgb(5,8,12));
            startupArtwork=new AudifyArtworkLoader(images);
            startup=new AudifyStartupController(this,()->buildPreparedHome(savedInstanceState),()->{
                try{AudifyFirebaseAvatar.get(this).addListener(avatarCloudRefreshV681240);}catch(Throwable ignored){}
                if(startup.isDegraded())rebuildLibrary();
                observeFirebaseHome();handler.removeCallbacks(ticker);handler.post(ticker);
            });
            if(systemSplash!=null)systemSplash.setOnExitAnimationListener(provider->provider.remove());
        }catch(Throwable startupFailureV681242){
            showStartupHardFallbackV681242(startupFailureV681242);
        }
    }

    private void showStartupHardFallbackV681242(Throwable error){
        try{
            android.util.Log.e("AudifyStartup","fatal native launch path",error);
            LinearLayout fallback=new LinearLayout(this);
            fallback.setOrientation(LinearLayout.VERTICAL);
            fallback.setGravity(Gravity.CENTER);
            fallback.setPadding(dp(28),dp(28),dp(28),dp(28));
            fallback.setBackgroundColor(Color.rgb(5,8,12));
            TextView mark=new TextView(this);mark.setText("A");mark.setTextSize(56f);mark.setTextColor(ACCENT);mark.setGravity(Gravity.CENTER);
            fallback.addView(mark,new LinearLayout.LayoutParams(-1,dp(90)));
            TextView title=new TextView(this);title.setText("Audify démarre en mode sécurisé");title.setTextSize(22f);title.setTextColor(Color.WHITE);title.setGravity(Gravity.CENTER);
            fallback.addView(title,new LinearLayout.LayoutParams(-1,dp(64)));
            TextView detail=new TextView(this);detail.setText("Une fonction de l’appareil n’est pas disponible. Tes données locales sont conservées.");detail.setTextSize(14f);detail.setTextColor(Color.rgb(176,187,200));detail.setGravity(Gravity.CENTER);detail.setPadding(0,dp(8),0,dp(20));
            fallback.addView(detail,new LinearLayout.LayoutParams(-1,dp(92)));
            Button retry=new Button(this);retry.setText("Réessayer");retry.setAllCaps(false);retry.setTextColor(Color.rgb(7,13,8));retry.setBackground(round(ACCENT,0,Color.TRANSPARENT,dp(26)));retry.setOnClickListener(v->recreate());
            fallback.addView(retry,new LinearLayout.LayoutParams(-1,dp(54)));
            setContentView(fallback);
        }catch(Throwable ignored){
            // Nothing else is allowed to be thrown from the launcher callback.
        }
    }`, 'NativeHomeActivity.onCreate');
}
await writeFile(homePath, home, 'utf8');

// -----------------------------------------------------------------------------
// 2) Startup controller: cloud/avatar failures become an honest local fallback.
// -----------------------------------------------------------------------------
const controllerPath = path.join(java, 'AudifyStartupController.java');
let controller = await readFile(controllerPath, 'utf8');
controller = controller.replace(
  '                        avatar=AudifyFirebaseAvatar.get(activity.getApplicationContext());\n                        checkpoint=sync.requestStartupCheckpoint();',
  '                        try{avatar=AudifyFirebaseAvatar.get(activity.getApplicationContext());}catch(Throwable ignored){avatar=null;}\n                        try{checkpoint=sync.requestStartupCheckpoint();}catch(Throwable cloudFailure){showError("Synchronisation cloud indisponible. Tes données locales restent disponibles.");return;}'
);
controller = controller.replace(
  '            boolean avatarReady=avatar==null||avatar.readyForStartup();',
  '            boolean avatarReady=true;\n            if(avatar!=null){try{avatarReady=avatar.readyForStartup();}catch(Throwable ignored){avatarReady=true;}}'
);
controller = controller.replace('            }catch(Exception|LinkageError error){main.post(()->{if(valid())showError("Audify n’a pas pu préparer votre bibliothèque. Vos données sont conservées.");});}', '            }catch(Throwable error){main.post(()->{if(valid())showError("Audify n’a pas pu préparer votre bibliothèque. Vos données sont conservées.");});}');
controller = controller.replace('                }catch(Exception|LinkageError failure){showError("Audify n’a pas pu préparer l’accueil. Vos données sont conservées.");}', '                }catch(Throwable failure){showError("Audify n’a pas pu préparer l’accueil. Vos données sont conservées.");}');
await writeFile(controllerPath, controller, 'utf8');

// -----------------------------------------------------------------------------
// 3) Firebase sync: missing/invalid configuration must fall back to guest mode.
// -----------------------------------------------------------------------------
const syncPath = path.join(java, 'AudifyFirebaseSync.java');
let sync = await readFile(syncPath, 'utf8');
if (!sync.includes('firebaseAvailableV681242')) {
  sync = sync.replace('    private String uid=null, error="";', '    private String uid=null, error="";\n    private boolean firebaseAvailableV681242=true;');
  sync = sync.replace(
    `    private AudifyFirebaseSync(Context context) {
        app=context;
        FirebaseApp.initializeApp(app);
        refreshSession();
        FirebaseAuth.getInstance().addAuthStateListener(auth->refreshSession());
    }`,
    `    private AudifyFirebaseSync(Context context) {
        app=context;
        try{
            FirebaseApp initialized=FirebaseApp.initializeApp(app);
            if(initialized==null)throw new IllegalStateException("Firebase options unavailable");
            refreshSession();
            FirebaseAuth.getInstance().addAuthStateListener(auth->refreshSession());
        }catch(Throwable unavailable){
            firebaseAvailableV681242=false;
            uid="";error="";writable=true;serverSeen=false;
            prefs=app.getSharedPreferences("audify_firebase_guest",Context.MODE_PRIVATE);
            try{state=new AudifySyncState(prefs.getString("state",""));}
            catch(Throwable ignored){try{state=new AudifySyncState("");}catch(Exception impossible){throw new IllegalStateException(impossible);}}
            android.util.Log.e("AudifyFirebase","Firebase indisponible; mode invité local",unavailable);
        }
    }`
  );
  sync = sync.replace('    public synchronized void refreshSession() {\n        FirebaseUser user=FirebaseAuth.getInstance().getCurrentUser();', '    public synchronized void refreshSession() {\n        if(!firebaseAvailableV681242)return;\n        FirebaseUser user=FirebaseAuth.getInstance().getCurrentUser();');
}
await writeFile(syncPath, sync, 'utf8');

// -----------------------------------------------------------------------------
// 4) Avatar transport: Storage errors are never allowed to escape a callback.
// -----------------------------------------------------------------------------
const avatarPath = path.join(java, 'AudifyFirebaseAvatar.java');
let avatar = await readFile(avatarPath, 'utf8');
if (!avatar.includes('refreshUnsafeV681242')) {
  const marker='    private void refresh(){';
  if(!avatar.includes(marker))throw new Error('V68.12.42 refresh avatar introuvable');
  avatar=avatar.replace(marker, `    private void refresh(){try{refreshUnsafeV681242();}catch(Throwable failure){uploading="";downloading="";message="Avatar cloud indisponible ; données locales conservées.";android.util.Log.e("AudifyAvatar","transport avatar indisponible",failure);}}\n    private void refreshUnsafeV681242(){`);
}
await writeFile(avatarPath, avatar, 'utf8');

// -----------------------------------------------------------------------------
// 5) Media session: opening a notification must return to the native Home.
//    Service creation is guarded so an OEM media-browser bind cannot kill Audify.
// -----------------------------------------------------------------------------
const servicePath = path.join(java, 'AudifyPlaybackService.java');
let service = await readFile(servicePath, 'utf8');
service = service.replace('new Intent(this, MainActivity.class)', 'new Intent(this, NativeHomeActivity.class)');
if (!service.includes('onCreateV681242Guarded')) {
  const method=findMethod(service,['    @Override\n    public void onCreate() {','    @Override\n    public void onCreate(){'],'AudifyPlaybackService.onCreate');
  let body=service.slice(method.brace+1,method.end-1);
  body=body.replace(/^\s*super\.onCreate\(\);\s*/, '\n');
  const replacement=`    @Override\n    public void onCreate() {\n        try{\n            super.onCreate();${body}\n        }catch(Throwable mediaFailure){\n            android.util.Log.e("AudifyPlayback","service initialization failed",mediaFailure);\n            snapshotError="Lecture audio indisponible sur cet appareil";\n            if(mainHandler!=null)mainHandler.removeCallbacks(stateTicker);\n            try{stopSelf();}catch(Throwable ignored){}\n        }\n    }\n\n    private boolean onCreateV681242Guarded(){return player!=null;}`;
  service=service.slice(0,method.start)+replacement+service.slice(method.end);
}
await writeFile(servicePath, service, 'utf8');

// -----------------------------------------------------------------------------
// 6) Keep the chroma logo on a software layer. It is small and this avoids a
//    device-specific hardware saveLayer/PorterDuff driver crash during splash.
// -----------------------------------------------------------------------------
const logoPath = path.join(java, 'AudifyChromaLogoView.java');
let logo = await readFile(logoPath, 'utf8');
logo = logo.replace(/(\s*setLayerType\(View\.LAYER_TYPE_SOFTWARE,null\);\n){2,}/g, '        setLayerType(View.LAYER_TYPE_SOFTWARE,null);\n');
logo = logo.replace('super(context);        setLayerType(View.LAYER_TYPE_SOFTWARE,null);', 'super(context);\n        setLayerType(View.LAYER_TYPE_SOFTWARE,null);');
if (!logo.includes('setLayerType(View.LAYER_TYPE_SOFTWARE,null);')) {
  logo = logo.replace('    public AudifyChromaLogoView(Context context){\n        super(context);', '    public AudifyChromaLogoView(Context context){\n        super(context);\n        setLayerType(View.LAYER_TYPE_SOFTWARE,null);');
}
await writeFile(logoPath, logo, 'utf8');

// -----------------------------------------------------------------------------
// 7) Bound the data copied into the startup Home. Full likes remain available
//    in NativeLikesActivity; only the first Home/discovery window is bounded.
// -----------------------------------------------------------------------------
const libraryPath = path.join(java, 'AudifyLibraryStore.java');
let library = await readFile(libraryPath, 'utf8');
if(!library.includes('getLikesForStartupV681242')){
  library=library.replace(/    public List<Track> getLikes\(\)\s*\{return tracks\("like",10000\);\}/, '    public List<Track> getLikes(){return tracks("like",10000);}\n    public List<Track> getLikesForStartupV681242(){return tracks("like",400);}\n    public List<String> getPlaylistNamesForStartupV681242(){List<String> all=getPlaylistNames();return all.size()>20?new ArrayList<>(all.subList(0,20)):all;}');
}
await writeFile(libraryPath, library, 'utf8');
home=await readFile(homePath,'utf8');
home=home.replaceAll('store\.getLikes\(\)', 'store.getLikesForStartupV681242()');
home=home.replaceAll('store\.getPlaylistNames\(\)', 'store.getPlaylistNamesForStartupV681242()');
home=home.replace('        AudifyFirebaseAvatar.get(this).removeListener(avatarCloudRefreshV681240);', '        try{AudifyFirebaseAvatar.get(this).removeListener(avatarCloudRefreshV681240);}catch(Throwable ignored){}');
await writeFile(homePath, home, 'utf8');
controller=await readFile(controllerPath,'utf8');
controller=controller.replace('library.getLikes();library.getRecents();library.getPlaylistNames();','library.getLikesForStartupV681242();library.getRecents();library.getPlaylistNamesForStartupV681242();');
await writeFile(controllerPath, controller, 'utf8');

let gradle=await readFile(path.join(root,'android','app','build.gradle'),'utf8');
gradle=gradle.replace(/versionCode \d+/,'versionCode 681242').replace(/versionName "[^"]+"/,'versionName "68.12.42"');
await writeFile(path.join(root,'android','app','build.gradle'),gradle,'utf8');
console.log('Audify V68.12.42 : démarrage blindé Firebase/avatar, Home natif, MediaSession et rendu GPU sécurisés.');
