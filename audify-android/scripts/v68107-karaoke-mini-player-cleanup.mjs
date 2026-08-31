import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const karaokePath=path.join(pkgDir,'NativeKaraokeActivity.java');

let src=await readFile(karaokePath,'utf8');

if(!src.includes('import android.widget.ImageView;')){
  src=src.replace('import android.widget.FrameLayout;','import android.widget.FrameLayout;\nimport android.widget.ImageView;');
}
if(!src.includes('import android.view.View;')){
  src=src.replace('import android.view.Gravity;','import android.view.Gravity;\nimport android.view.View;');
}

// Conserver la miniature du morceau pour le mini-lecteur Karaoké.
if(!src.includes('String thumbnail=in==null?"":safe(in.getStringExtra("thumbnail"));')){
  src=src.replace(
    '        videoId=in==null?"":safe(in.getStringExtra("videoId"));',
    '        videoId=in==null?"":safe(in.getStringExtra("videoId"));\n        String thumbnail=in==null?"":safe(in.getStringExtra("thumbnail"));'
  );
}

// Bouton de sortie : une vraie croix + Lecteur.
src=src.replace('        Button back=smallButton("‹ Lecteur");','        Button back=smallButton("✕  Lecteur");');
src=src.replace('        header.addView(back,new LinearLayout.LayoutParams(dp(112),dp(48)));',String.raw`        GradientDrawable backBg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.argb(185,56,66,82),Color.argb(150,28,35,47)}
        );
        backBg.setCornerRadius(dp(18));
        backBg.setStroke(dp(1),Color.argb(120,235,242,252));
        back.setBackground(backBg);
        back.setTextSize(14f);
        back.setElevation(dp(5));
        header.addView(back,new LinearLayout.LayoutParams(dp(132),dp(48)));`);

// Les mentions KARAOKÉ AUDIFY / LRCLIB restent techniquement disponibles pour le moteur,
// mais ne prennent plus la moindre place visuelle.
src=src.replace(
  '        modeView=text("PAROLES AUDIFY",12f,true,Color.rgb(168,255,63));',
  '        modeView=text("PAROLES AUDIFY",12f,true,Color.rgb(168,255,63));\n        modeView.setVisibility(View.GONE);'
);
src=src.replace(
  '        statusView=text("Recherche intelligente des paroles…",13f,false,Color.rgb(165,175,188));',
  '        statusView=text("Recherche intelligente des paroles…",13f,false,Color.rgb(165,175,188));\n        statusView.setVisibility(View.GONE);'
);

// Plus d’espace vertical utile pour les paroles.
src=src.replace('        page.setPadding(dp(18),dp(12),dp(18),dp(154));','        page.setPadding(dp(18),dp(12),dp(18),dp(136));');

// Remplace le grand lecteur Karaoké par le même langage visuel que le mini-player Home.
const controlsStart=src.indexOf('        LinearLayout controls=new LinearLayout(this);');
const setContent=src.indexOf('        setContentView(root);',controlsStart);
if(controlsStart<0||setContent<0) throw new Error('V68.10.7 bloc lecteur karaoke introuvable');

const mini=String.raw`        LinearLayout miniPlayer=new LinearLayout(this);
        miniPlayer.setOrientation(LinearLayout.VERTICAL);
        miniPlayer.setPadding(dp(11),dp(9),dp(11),dp(7));
        GradientDrawable miniGlass=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.argb(214,66,76,94),Color.argb(178,35,43,58),Color.argb(155,20,26,36)}
        );
        miniGlass.setStroke(dp(1),Color.argb(125,168,255,63));
        miniGlass.setCornerRadius(dp(29));
        miniPlayer.setBackground(miniGlass);
        miniPlayer.setElevation(dp(20));

        LinearLayout miniTop=new LinearLayout(this);
        miniTop.setGravity(Gravity.CENTER_VERTICAL);

        ImageView miniArtwork=new ImageView(this);
        miniArtwork.setScaleType(ImageView.ScaleType.CENTER_CROP);
        miniArtwork.setBackgroundColor(Color.rgb(25,31,41));
        miniArtwork.setClipToOutline(true);
        miniArtwork.setOutlineProvider(new android.view.ViewOutlineProvider(){
            @Override public void getOutline(View view,android.graphics.Outline outline){
                outline.setRoundRect(0,0,view.getWidth(),view.getHeight(),dp(15));
            }
        });
        miniArtwork.setOnClickListener(v->finish());
        miniTop.addView(miniArtwork,new LinearLayout.LayoutParams(dp(58),dp(58)));
        loadMiniArtwork(miniArtwork,thumbnail);

        LinearLayout miniInfo=new LinearLayout(this);
        miniInfo.setOrientation(LinearLayout.VERTICAL);
        miniInfo.setGravity(Gravity.CENTER_VERTICAL);
        miniInfo.setPadding(dp(11),0,dp(8),0);
        miniInfo.setOnClickListener(v->finish());
        TextView miniTitle=text(resolvedMeta.title,15.5f,true,Color.WHITE);
        miniTitle.setMaxLines(1); miniTitle.setEllipsize(TextUtils.TruncateAt.END);
        TextView miniArtist=text(resolvedMeta.artist,12.5f,false,Color.rgb(190,199,212));
        miniArtist.setMaxLines(1); miniArtist.setEllipsize(TextUtils.TruncateAt.END);
        miniInfo.addView(miniTitle,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(29)));
        miniInfo.addView(miniArtist,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(23)));
        miniTop.addView(miniInfo,new LinearLayout.LayoutParams(0,dp(58),1f));

        toggle=roundPlay("⏸");
        toggle.setTextSize(20f);
        toggle.setElevation(dp(9));
        toggle.setOnClickListener(v->{
            try{ startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_TOGGLE)); }catch(Exception ignored){}
            handler.postDelayed(this::refresh,70L);
        });
        miniTop.addView(toggle,new LinearLayout.LayoutParams(dp(56),dp(56)));
        miniPlayer.addView(miniTop,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(62)));

        timeline=new SeekBar(this);
        timeline.setMax(1000);
        timeline.setPadding(0,0,0,0);
        timeline.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.rgb(168,255,63)));
        timeline.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.argb(90,238,244,252)));
        timeline.setThumbTintList(android.content.res.ColorStateList.valueOf(Color.rgb(248,250,255)));
        timeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){
            @Override public void onProgressChanged(SeekBar s,int p,boolean fromUser){}
            @Override public void onStartTrackingTouch(SeekBar s){userSeeking=true;}
            @Override public void onStopTrackingTouch(SeekBar s){
                double seconds=Math.max(0.0,duration)*(s.getProgress()/1000.0);
                try{
                    startService(new Intent(NativeKaraokeActivity.this,AudifyPlaybackService.class)
                        .setAction(AudifyPlaybackService.ACTION_SEEK)
                        .putExtra(AudifyPlaybackService.EXTRA_SEEK_SECONDS,seconds));
                }catch(Exception ignored){}
                userSeeking=false;
                handler.postDelayed(NativeKaraokeActivity.this::refresh,80L);
            }
        });
        miniPlayer.addView(timeline,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(34)));

        int miniWidth=Math.min(getResources().getDisplayMetrics().widthPixels-dp(28),dp(560));
        FrameLayout.LayoutParams miniLp=new FrameLayout.LayoutParams(miniWidth,dp(112),Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);
        miniLp.bottomMargin=dp(18);
        root.addView(miniPlayer,miniLp);

`;
src=src.slice(0,controlsStart)+mini+src.slice(setContent);

// Chargeur ultra-léger pour la pochette du mini-player.
if(!src.includes('private void loadMiniArtwork(ImageView target,String raw)')){
  const marker='    private String pathPart(String s) throws Exception {';
  if(!src.includes(marker)) throw new Error('V68.10.7 helper marker introuvable');
  const helper=String.raw`    private void loadMiniArtwork(ImageView target,String raw){
        String url=safe(raw);
        if(url.isEmpty()||target==null) return;
        new Thread(()->{
            HttpURLConnection c=null;
            try{
                c=(HttpURLConnection)new URL(url).openConnection();
                c.setConnectTimeout(6000); c.setReadTimeout(7000); c.setUseCaches(true);
                try(InputStream in=c.getInputStream()){
                    final android.graphics.Bitmap bmp=android.graphics.BitmapFactory.decodeStream(in);
                    if(bmp!=null) runOnUiThread(()->target.setImageBitmap(bmp));
                }
            }catch(Exception ignored){}finally{if(c!=null)c.disconnect();}
        },"AudifyKaraokeArtwork").start();
    }

`;
  src=src.replace(marker,helper+marker);
}

await writeFile(karaokePath,src,'utf8');
console.log('Audify V68.10.7 : Karaoke nettoyé, bouton ✕ Lecteur et mini-player Home-style appliqués.');
