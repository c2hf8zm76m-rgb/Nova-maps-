import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const playerPath=path.join(pkgDir,'NativePlayerActivity.java');
const albumsPath=path.join(pkgDir,'AudifyInstantAlbums.java');

function replaceMethod(src,signature,replacement,label){
  const start=src.indexOf(signature);
  if(start<0)throw new Error('V68.17: missing '+label+' signature');
  const brace=src.indexOf('{',start);
  if(brace<0)throw new Error('V68.17: missing '+label+' opening brace');
  let depth=0,end=-1;
  for(let i=brace;i<src.length;i++){
    if(src[i]==='{')depth++;
    else if(src[i]==='}'){
      depth--;
      if(depth===0){end=i+1;break;}
    }
  }
  if(end<0)throw new Error('V68.17: missing '+label+' closing brace');
  return src.slice(0,start)+replacement+src.slice(end);
}

// -----------------------------------------------------------------------------
// 1) Player UI: a single small, native "Voir album" pill directly below the
//    main artwork. It is GONE by default, so no empty space is reserved while
//    album identification is pending or when the track is a standalone single.
// -----------------------------------------------------------------------------
let player=await readFile(playerPath,'utf8');
const playerMarker='AUDIFY_V68170_VOIR_ALBUM_BUTTON_UI';
if(!player.includes(playerMarker)){
  const anchors=[
    '        content.addView(artworkStage,artLp);',
    '        content.addView(artwork,artLp);'
  ];
  const anchor=anchors.find(x=>player.includes(x));
  if(!anchor)throw new Error('V68.17: artwork layout anchor missing');

  const cta=String.raw`

        // AUDIFY_V68170_VOIR_ALBUM_BUTTON_UI
        TextView albumCta=new TextView(this);
        albumCta.setTag("AUDIFY_ALBUM_CTA_V68170");
        albumCta.setText("Voir album");
        albumCta.setTextSize(13.5f);
        albumCta.setTextColor(Color.rgb(248,250,255));
        albumCta.setGravity(Gravity.CENTER);
        albumCta.setSingleLine(true);
        albumCta.setPadding(dp(17),0,dp(17),0);
        albumCta.setVisibility(View.GONE);
        albumCta.setAlpha(0f);
        albumCta.setClickable(true);
        albumCta.setFocusable(true);
        albumCta.setElevation(dp(5));
        GradientDrawable albumCtaBg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.argb(92,55,62,75),Color.argb(72,25,31,42)}
        );
        albumCtaBg.setCornerRadius(dp(20));
        albumCtaBg.setStroke(dp(1),Color.argb(104,239,244,252));
        albumCta.setBackground(albumCtaBg);
        LinearLayout.LayoutParams albumCtaLp=new LinearLayout.LayoutParams(dp(116),dp(38));
        albumCtaLp.gravity=Gravity.CENTER_HORIZONTAL;
        albumCtaLp.topMargin=dp(7);
        albumCtaLp.bottomMargin=dp(1);
        content.addView(albumCta,albumCtaLp);`;

  player=player.replace(anchor,anchor+cta);
  await writeFile(playerPath,player,'utf8');
}

// -----------------------------------------------------------------------------
// 2) Album indicator: remove the old 84x84 artwork tile completely. The album
//    resolver now only reveals the button already integrated in the player.
//    The full album sheet keeps its artwork/tracklist exactly as before.
// -----------------------------------------------------------------------------
let albums=await readFile(albumsPath,'utf8');
const tagAnchor='    private static final String TILE=TAG+"_TILE";';
if(!albums.includes('AUDIFY_V68170_NO_ALBUM_PREVIEW_IMAGES')){
  if(!albums.includes(tagAnchor))throw new Error('V68.17: album tag anchor missing');
  albums=albums.replace(tagAnchor,tagAnchor+'\n    private static final String ALBUM_CTA="AUDIFY_ALBUM_CTA_V68170";\n    private static final String V68170_UI="AUDIFY_V68170_VOIR_ALBUM_BUTTON_UI";\n    private static final String V68170_NO_PREVIEW="AUDIFY_V68170_NO_ALBUM_PREVIEW_IMAGES";\n    private static final String V68170_HIDDEN="AUDIFY_V68170_ALBUM_BUTTON_HIDDEN_UNTIL_RESOLVED";');
}

albums=replaceMethod(albums,'    private static void install(Activity a)',String.raw`    private static void install(Activity a){
        View c=a.findViewById(android.R.id.content);
        if(!(c instanceof ViewGroup))return;
        View found=((ViewGroup)c).findViewWithTag(ALBUM_CTA);
        if(!(found instanceof TextView))return;
        TextView button=(TextView)found;
        button.setText("Voir album");
        button.setContentDescription("Voir album");
        button.setVisibility(View.GONE);
        button.setAlpha(0f);
        button.setScaleX(1f);
        button.setScaleY(1f);
        button.setOnClickListener(v->{
            Snap s=snap();
            if(current!=null&&current.tracks.size()>1&&key(s).equals(albumFor)){
                showAlbum(a,current,s,false);
            }
        });
    }`,'install');

albums=replaceMethod(albums,'    private static void showCard(Activity a,AudifyInstantAlbumMetadata.Album album,Snap s)',String.raw`    private static void showCard(Activity a,AudifyInstantAlbumMetadata.Album album,Snap s){
        if(album==null||album.tracks.size()<2)return;
        View c=a.findViewById(android.R.id.content);if(!(c instanceof ViewGroup))return;
        View v=((ViewGroup)c).findViewWithTag(ALBUM_CTA);if(!(v instanceof TextView))return;
        TextView button=(TextView)v;
        button.setText("Voir album");
        if(button.getVisibility()!=View.VISIBLE){
            button.animate().cancel();
            button.setVisibility(View.VISIBLE);
            button.setAlpha(0f);
            button.setTranslationY(dp(a,4));
            button.animate().alpha(1f).translationY(0f).setDuration(180).start();
        }
    }`,'showCard');

albums=replaceMethod(albums,'    private static void hide(Activity a)',String.raw`    private static void hide(Activity a){
        View c=a.findViewById(android.R.id.content);if(!(c instanceof ViewGroup))return;
        View v=((ViewGroup)c).findViewWithTag(ALBUM_CTA);
        if(v!=null&&v.getVisibility()==View.VISIBLE){
            v.animate().cancel();
            v.animate().alpha(0f).translationY(dp(a,3)).setDuration(110).withEndAction(()->{
                v.setVisibility(View.GONE);
                v.setTranslationY(0f);
            }).start();
        }else if(v!=null){
            v.setVisibility(View.GONE);
            v.setAlpha(0f);
        }
    }`,'hide');

if(albums.includes('tile.setTag(TILE)')||albums.includes('host.addView(tile')){
  throw new Error('V68.17: legacy square album tile still present after patch');
}
if(!albums.includes('showAlbum(a,current,s,false)')){
  throw new Error('V68.17: Voir album click must open album without auto-start');
}
await writeFile(albumsPath,albums,'utf8');

console.log('Audify V68.17: old album-found image tile removed; compact Voir album button is hidden until a verified album resolves, then opens the existing album sheet without auto-starting playback.');
