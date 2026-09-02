import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const java=path.join(root,'android','app','src','main','java','com','nova','audify');
const searchPath=path.join(java,'NativeSearchActivity.java');
const homePath=path.join(java,'NativeHomeActivity.java');
const manifestPath=path.join(root,'android','app','src','main','AndroidManifest.xml');
const gradlePath=path.join(root,'android','app','build.gradle');

const search=String.raw`package com.nova.audify;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.content.Intent;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/** V68.12.41: search screen without Capacitor/WebView. */
public final class NativeSearchActivity extends AppCompatActivity {
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ExecutorService searchExecutor=Executors.newSingleThreadExecutor();
    private final ExecutorService imageExecutor=Executors.newFixedThreadPool(4);
    private EditText input;
    private Button searchButton;
    private LinearLayout results;
    private TextView status;
    private int generation=0;

    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(5,8,12));
        getWindow().setNavigationBarColor(Color.rgb(5,8,12));
        setContentView(build());
        String query=getIntent().getStringExtra("query");
        if(query!=null&&!query.trim().isEmpty()){input.setText(query);submit();}
    }

    private View build(){
        FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(5,8,12));
        LinearLayout column=new LinearLayout(this);column.setOrientation(LinearLayout.VERTICAL);column.setPadding(dp(12),dp(12),dp(12),0);
        LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);
        Button back=new Button(this);back.setText("‹");back.setTextSize(32f);back.setTextColor(Color.WHITE);back.setAllCaps(false);back.setPadding(0,0,0,0);back.setStateListAnimator(null);back.setBackground(round(Color.rgb(29,36,46),1,Color.rgb(73,84,98),28));back.setOnClickListener(v->finish());
        top.addView(back,new LinearLayout.LayoutParams(dp(52),dp(52)));
        input=new EditText(this);input.setSingleLine(true);input.setTextColor(Color.WHITE);input.setHintTextColor(Color.rgb(145,153,166));input.setHint("Artiste ou titre…");input.setTextSize(17f);input.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_AUTO_CORRECT);input.setImeOptions(EditorInfo.IME_ACTION_SEARCH);input.setPadding(dp(18),0,dp(18),0);input.setBackground(round(Color.rgb(20,26,35),1,Color.rgb(62,72,83),34));
        LinearLayout.LayoutParams inputLp=new LinearLayout.LayoutParams(0,dp(58),1f);inputLp.leftMargin=dp(8);top.addView(input,inputLp);
        searchButton=new Button(this);searchButton.setText("Rechercher");searchButton.setAllCaps(false);searchButton.setTextSize(14f);searchButton.setTextColor(Color.rgb(8,16,6));searchButton.setPadding(dp(10),0,dp(10),0);searchButton.setStateListAnimator(null);searchButton.setBackground(round(Color.rgb(157,255,50),0,Color.TRANSPARENT,28));searchButton.setOnClickListener(v->submit());
        LinearLayout.LayoutParams buttonLp=new LinearLayout.LayoutParams(dp(122),dp(52));buttonLp.leftMargin=dp(8);top.addView(searchButton,buttonLp);
        column.addView(top,new LinearLayout.LayoutParams(-1,dp(64)));
        status=new TextView(this);status.setTextColor(Color.rgb(180,188,200));status.setTextSize(16f);status.setGravity(Gravity.CENTER);status.setPadding(dp(16),dp(26),dp(16),dp(18));column.addView(status,new LinearLayout.LayoutParams(-1,dp(86)));
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setClipToPadding(false);scroll.setVerticalScrollBarEnabled(false);results=new LinearLayout(this);results.setOrientation(LinearLayout.VERTICAL);results.setPadding(dp(2),0,dp(2),dp(32));scroll.addView(results,new ScrollView.LayoutParams(-1,-2));column.addView(scroll,new LinearLayout.LayoutParams(-1,0,1f));
        root.addView(column,new FrameLayout.LayoutParams(-1,-1));
        input.setOnEditorActionListener((v,id,event)->{if(id==EditorInfo.IME_ACTION_SEARCH){submit();return true;}return false;});
        return root;
    }

    private void submit(){
        if(input==null)return;String query=input.getText()==null?"":input.getText().toString().trim();if(query.isEmpty()){status.setText("Entre un artiste ou un titre.");results.removeAllViews();return;}
        final int ticket=++generation;searchButton.setEnabled(false);searchButton.setText("Recherche…");status.setText("Recherche musicale de « "+query+" »…");results.removeAllViews();
        InputMethodManager imm=(InputMethodManager)getSystemService(INPUT_METHOD_SERVICE);if(imm!=null)imm.hideSoftInputFromWindow(input.getWindowToken(),0);input.clearFocus();
        searchExecutor.execute(()->{try{ArrayList<AudifyYoutubeSearchEngine.Result> found=AudifyYoutubeSearchEngine.search(query);main.post(()->{if(ticket==generation)render(found,query);});}catch(Throwable error){main.post(()->{if(ticket==generation){status.setText("Recherche YouTube momentanément indisponible. Réessaie dans quelques secondes.");searchButton.setEnabled(true);searchButton.setText("Rechercher");}});}});
    }

    private void render(ArrayList<AudifyYoutubeSearchEngine.Result> found,String query){
        searchButton.setEnabled(true);searchButton.setText("Rechercher");results.removeAllViews();int count=found==null?0:Math.min(20,found.size());status.setText(count==0?"Aucun résultat pour « "+query+" ». ":count+" résultat"+(count>1?"s":"")+" pour « "+query+" »");
        if(count==0)return;final ArrayList<AudifyYoutubeSearchEngine.Result> queue=new ArrayList<>(found.subList(0,count));
        for(int i=0;i<count;i++){AudifyYoutubeSearchEngine.Result item=queue.get(i);results.addView(card(item,queue,i),new LinearLayout.LayoutParams(-1,dp(96)));}
    }

    private View card(AudifyYoutubeSearchEngine.Result item,ArrayList<AudifyYoutubeSearchEngine.Result> queue,int index){
        LinearLayout card=new LinearLayout(this);card.setGravity(Gravity.CENTER_VERTICAL);card.setPadding(dp(8),dp(7),dp(8),dp(7));card.setBackground(round(Color.rgb(17,23,31),1,Color.rgb(55,67,80),22));card.setClickable(true);card.setOnClickListener(v->play(queue,index));
        ImageView art=new ImageView(this);art.setScaleType(ImageView.ScaleType.CENTER_CROP);art.setBackgroundColor(Color.rgb(28,35,45));card.addView(art,new LinearLayout.LayoutParams(dp(104),dp(80)));loadImage(item.thumbnail,art);
        LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);info.setGravity(Gravity.CENTER_VERTICAL);info.setPadding(dp(11),0,dp(6),0);TextView title=text(item.title,15.5f,Color.WHITE,true);title.setMaxLines(2);TextView artist=text(item.artist+" · "+formatDuration(item.durationSeconds),12.5f,Color.rgb(177,188,202),false);artist.setMaxLines(1);info.addView(title,new LinearLayout.LayoutParams(-1,dp(48)));info.addView(artist,new LinearLayout.LayoutParams(-1,dp(24)));card.addView(info,new LinearLayout.LayoutParams(0,dp(80),1f));
        Button play=new Button(this);play.setText("▶");play.setTextSize(16f);play.setTextColor(Color.rgb(9,18,7));play.setAllCaps(false);play.setPadding(0,0,0,0);play.setStateListAnimator(null);play.setBackground(round(Color.rgb(168,255,63),0,Color.TRANSPARENT,24));play.setOnClickListener(v->play(queue,index));card.addView(play,new LinearLayout.LayoutParams(dp(44),dp(44)));return card;
    }

    private void play(ArrayList<AudifyYoutubeSearchEngine.Result> queue,int index){
        if(queue==null||index<0||index>=queue.size())return;AudifyYoutubeSearchEngine.Result chosen=queue.get(index);try{JSONArray arr=new JSONArray();for(AudifyYoutubeSearchEngine.Result item:queue)arr.put(new JSONObject().put("id",item.id).put("title",item.title).put("artist",item.artist).put("thumbnail",item.thumbnail));JSONObject root=new JSONObject().put("items",arr).put("index",index);startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_PREFETCH).putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,chosen.id));startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_SET_QUEUE).putExtra(AudifyPlaybackService.EXTRA_QUEUE_JSON,root.toString()));startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_LOAD).putExtra(AudifyPlaybackService.EXTRA_VIDEO_ID,chosen.id).putExtra(AudifyPlaybackService.EXTRA_TITLE,chosen.title).putExtra(AudifyPlaybackService.EXTRA_ARTIST,chosen.artist).putExtra(AudifyPlaybackService.EXTRA_THUMBNAIL,chosen.thumbnail));main.postDelayed(()->{try{startService(new Intent(this,AudifyPlaybackService.class).setAction(AudifyPlaybackService.ACTION_PLAY));}catch(Throwable ignored){}},120);startActivity(new Intent(this,NativePlayerActivity.class).putExtra("autoplayRequested",true).putExtra("videoId",chosen.id).putExtra("title",chosen.title).putExtra("artist",chosen.artist).putExtra("thumbnail",chosen.thumbnail));}catch(Throwable error){Toast.makeText(this,"Impossible de lancer ce titre",Toast.LENGTH_SHORT).show();}}

    private void loadImage(String url,ImageView target){if(url==null||url.isEmpty())return;imageExecutor.execute(()->{HttpURLConnection c=null;try{c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(8000);c.setReadTimeout(10000);c.setUseCaches(true);c.setRequestProperty("User-Agent","Mozilla/5.0 Audify/68.12.41");if(c.getResponseCode()>=200&&c.getResponseCode()<300){Bitmap bitmap=BitmapFactory.decodeStream(c.getInputStream());if(bitmap!=null)main.post(()->{if(!isFinishing()&&!isDestroyed())target.setImageBitmap(bitmap);});}}catch(Throwable ignored){}finally{if(c!=null)c.disconnect();}});}
    private TextView text(String value,float size,int color,boolean bold){TextView t=new TextView(this);t.setText(value==null?"":value);t.setTextSize(size);t.setTextColor(color);t.setGravity(Gravity.CENTER_VERTICAL);if(bold)t.setTypeface(t.getTypeface(),android.graphics.Typeface.BOLD);return t;}
    private String formatDuration(long seconds){if(seconds<0)return "durée inconnue";return (seconds/60)+":"+String.format(java.util.Locale.ROOT,"%02d",seconds%60);}
    private GradientDrawable round(int fill,int strokeWidth,int stroke,int radius){GradientDrawable d=new GradientDrawable();d.setColor(fill);if(strokeWidth>0)d.setStroke(dp(strokeWidth),stroke);d.setCornerRadius(dp(radius));return d;}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    @Override protected void onDestroy(){generation++;main.removeCallbacksAndMessages(null);searchExecutor.shutdownNow();imageExecutor.shutdownNow();super.onDestroy();}
}
`;

await writeFile(searchPath,search,'utf8');
let home=await readFile(homePath,'utf8');
const old='Intent i=new Intent(this,MainActivity.class); i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP); startActivity(i);';
const next='Intent i=new Intent(this,NativeSearchActivity.class); i.putExtra("query", ""); i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP); startActivity(i);';
if(home.includes(old)) home=home.replace(old,next);
else if(!home.includes('new Intent(this,NativeSearchActivity.class)')) throw new Error('V68.12.41 navigation recherche introuvable');
await writeFile(homePath,home,'utf8');
let manifest=await readFile(manifestPath,'utf8');
if(!manifest.includes('android:name=".NativeSearchActivity"')) manifest=manifest.replace('</application>','        <activity android:name=".NativeSearchActivity" android:exported="false" android:screenOrientation="unspecified" />\n</application>');
await writeFile(manifestPath,manifest,'utf8');
let gradle=await readFile(gradlePath,'utf8');
gradle=gradle.replace(/versionCode \d+/,'versionCode 681241').replace(/versionName "[^"]+"/,'versionName "68.12.41"');
await writeFile(gradlePath,gradle,'utf8');
console.log('Audify V68.12.41 : recherche 100 % native, sans ouverture de Capacitor/WebView depuis le Home.');
