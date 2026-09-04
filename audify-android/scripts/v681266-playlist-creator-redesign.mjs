import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');
const pickerPath=path.join(pkgDir,'AudifyPlaylistPicker.java');

function replaceMethod(source,signatures,replacement,label){
  for(const signature of signatures){
    const start=source.indexOf(signature);
    if(start<0) continue;
    const brace=source.indexOf('{',start);
    if(brace<0) continue;
    let depth=0,end=-1;
    for(let i=brace;i<source.length;i++){
      if(source[i]==='{') depth++;
      else if(source[i]==='}'){
        depth--;
        if(depth===0){end=i+1;break;}
      }
    }
    if(end>0) return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error(`V68.12.66 méthode introuvable: ${label}`);
}

const creator=String.raw`package com.nova.audify;

import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.List;
import java.util.Locale;

/** AUDIFY_V681266_PLAYLIST_CREATOR — création de playlist 100% Audify, sans AlertDialog Android. */
public final class AudifyCreatePlaylistDialog {
    private static final int ACCENT=Color.rgb(168,255,63);
    private static final int BG=Color.rgb(8,12,17);
    private static final int PANEL=Color.rgb(14,20,27);
    private static final int MUTED=Color.rgb(158,170,186);
    private static final int ERROR=Color.rgb(255,111,128);
    private static final int MAX_NAME=40;

    private AudifyCreatePlaylistDialog(){}

    public static void show(Activity a,AudifyLibraryStore store,AudifyLibraryStore.Track track,Dialog parent,Runnable changed){
        if(a==null||store==null||a.isFinishing()) return;

        final Dialog dialog=new Dialog(a);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setCancelable(true);
        dialog.setCanceledOnTouchOutside(true);

        LinearLayout card=new LinearLayout(a);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(a,20),dp(a,18),dp(a,20),dp(a,18));
        GradientDrawable cardBg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(19,27,28),Color.rgb(12,18,24),Color.rgb(7,11,16)}
        );
        cardBg.setCornerRadius(dp(a,30));
        cardBg.setStroke(dp(a,1),Color.argb(82,184,255,108));
        card.setBackground(cardBg);
        if(Build.VERSION.SDK_INT>=21) card.setElevation(dp(a,24));

        LinearLayout top=new LinearLayout(a);
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView badge=text(a,"NOUVELLE PLAYLIST",10.5f,ACCENT,true);
        badge.setLetterSpacing(.12f);
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(dp(a,10),dp(a,5),dp(a,10),dp(a,5));
        GradientDrawable badgeBg=new GradientDrawable();
        badgeBg.setColor(Color.argb(34,168,255,63));
        badgeBg.setCornerRadius(dp(a,18));
        badge.setBackground(badgeBg);
        top.addView(badge,new LinearLayout.LayoutParams(-2,dp(a,30)));
        top.addView(new View(a),new LinearLayout.LayoutParams(0,1,1f));

        TextView close=text(a,"×",25f,Color.rgb(220,228,238),false);
        close.setGravity(Gravity.CENTER);
        GradientDrawable closeBg=new GradientDrawable();
        closeBg.setColor(Color.argb(24,255,255,255));
        closeBg.setCornerRadius(dp(a,15));
        close.setBackground(closeBg);
        close.setContentDescription("Fermer");
        close.setOnClickListener(v->dialog.dismiss());
        top.addView(close,new LinearLayout.LayoutParams(dp(a,44),dp(a,44)));
        card.addView(top,new LinearLayout.LayoutParams(-1,dp(a,46)));

        LinearLayout hero=new LinearLayout(a);
        hero.setGravity(Gravity.CENTER_VERTICAL);
        hero.setPadding(0,dp(a,10),0,dp(a,8));

        TextView cover=text(a,"♫",32f,Color.rgb(10,20,9),true);
        cover.setGravity(Gravity.CENTER);
        GradientDrawable coverBg=new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(205,255,141),Color.rgb(154,244,70),Color.rgb(101,199,37)}
        );
        coverBg.setCornerRadius(dp(a,21));
        cover.setBackground(coverBg);
        if(Build.VERSION.SDK_INT>=21) cover.setElevation(dp(a,8));
        hero.addView(cover,new LinearLayout.LayoutParams(dp(a,82),dp(a,82)));

        LinearLayout heroCopy=new LinearLayout(a);
        heroCopy.setOrientation(LinearLayout.VERTICAL);
        heroCopy.setGravity(Gravity.CENTER_VERTICAL);
        heroCopy.setPadding(dp(a,15),0,0,0);
        TextView title=text(a,"Crée ta playlist",25f,Color.WHITE,true);
        title.setMaxLines(1);
        title.setEllipsize(TextUtils.TruncateAt.END);
        heroCopy.addView(title,new LinearLayout.LayoutParams(-1,dp(a,38)));
        String description=track==null
            ? "Donne-lui un nom. Tu pourras y ajouter tes morceaux juste après."
            : "Donne-lui un nom. Ce morceau y sera ajouté immédiatement.";
        TextView subtitle=text(a,description,13.2f,Color.rgb(174,185,199),false);
        subtitle.setMaxLines(3);
        subtitle.setLineSpacing(0,1.08f);
        heroCopy.addView(subtitle,new LinearLayout.LayoutParams(-1,dp(a,52)));
        hero.addView(heroCopy,new LinearLayout.LayoutParams(0,dp(a,88),1f));
        card.addView(hero,new LinearLayout.LayoutParams(-1,dp(a,108)));

        TextView fieldLabel=text(a,"NOM DE LA PLAYLIST",10.8f,Color.rgb(185,197,212),true);
        fieldLabel.setLetterSpacing(.10f);
        LinearLayout.LayoutParams flp=new LinearLayout.LayoutParams(-1,dp(a,30));
        flp.topMargin=dp(a,4);
        card.addView(fieldLabel,flp);

        LinearLayout inputBox=new LinearLayout(a);
        inputBox.setOrientation(LinearLayout.HORIZONTAL);
        inputBox.setGravity(Gravity.CENTER_VERTICAL);
        inputBox.setPadding(dp(a,15),0,dp(a,11),0);
        inputBox.setBackground(fieldBackground(a,false,false));

        TextView note=text(a,"♪",19f,Color.rgb(194,255,127),true);
        note.setGravity(Gravity.CENTER);
        inputBox.addView(note,new LinearLayout.LayoutParams(dp(a,30),dp(a,58)));

        EditText input=new EditText(a);
        input.setHint("Ex. Rap du soir");
        input.setHintTextColor(Color.rgb(103,116,132));
        input.setTextColor(Color.WHITE);
        input.setTextSize(16.5f);
        input.setSingleLine(true);
        input.setBackgroundColor(Color.TRANSPARENT);
        input.setPadding(dp(a,4),0,dp(a,8),0);
        input.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setImeOptions(EditorInfo.IME_ACTION_DONE);
        input.setFilters(new InputFilter[]{new InputFilter.LengthFilter(MAX_NAME)});
        inputBox.addView(input,new LinearLayout.LayoutParams(0,dp(a,62),1f));

        TextView counter=text(a,"0/"+MAX_NAME,11f,Color.rgb(116,129,145),false);
        counter.setGravity(Gravity.CENTER);
        inputBox.addView(counter,new LinearLayout.LayoutParams(dp(a,46),dp(a,62)));
        card.addView(inputBox,new LinearLayout.LayoutParams(-1,dp(a,62)));

        TextView error=text(a," ",12.2f,ERROR,false);
        error.setGravity(Gravity.START|Gravity.CENTER_VERTICAL);
        card.addView(error,new LinearLayout.LayoutParams(-1,dp(a,30)));

        input.setOnFocusChangeListener((v,focused)->{
            if(TextUtils.isEmpty(error.getText().toString().trim())) inputBox.setBackground(fieldBackground(a,false,focused));
        });
        input.addTextChangedListener(new TextWatcher(){
            @Override public void beforeTextChanged(CharSequence s,int start,int count,int after){}
            @Override public void onTextChanged(CharSequence s,int start,int before,int count){
                int length=s==null?0:s.length();
                counter.setText(length+"/"+MAX_NAME);
                counter.setTextColor(length>=MAX_NAME?Color.rgb(226,238,214):Color.rgb(116,129,145));
                String raw=s==null?"":s.toString().trim();
                cover.setText(raw.isEmpty()?"♫":raw.substring(0,1).toUpperCase(Locale.ROOT));
                error.setText(" ");
                inputBox.setBackground(fieldBackground(a,false,input.hasFocus()));
            }
            @Override public void afterTextChanged(Editable s){}
        });

        TextView info=text(a,track==null?"Playlist privée dans ta bibliothèque Audify":"Le titre actuel sera ajouté automatiquement",11.6f,Color.rgb(129,142,158),false);
        info.setGravity(Gravity.START|Gravity.CENTER_VERTICAL);
        card.addView(info,new LinearLayout.LayoutParams(-1,dp(a,28)));

        LinearLayout actions=new LinearLayout(a);
        actions.setGravity(Gravity.CENTER_VERTICAL);
        actions.setPadding(0,dp(a,8),0,0);

        TextView cancel=text(a,"Annuler",14.2f,Color.rgb(218,225,235),true);
        cancel.setGravity(Gravity.CENTER);
        GradientDrawable cancelBg=new GradientDrawable();
        cancelBg.setColor(Color.argb(28,255,255,255));
        cancelBg.setCornerRadius(dp(a,18));
        cancelBg.setStroke(dp(a,1),Color.argb(35,255,255,255));
        cancel.setBackground(cancelBg);
        cancel.setOnClickListener(v->dialog.dismiss());
        actions.addView(cancel,new LinearLayout.LayoutParams(0,dp(a,54),.38f));

        TextView create=text(a,"Créer la playlist",14.5f,Color.rgb(8,17,7),true);
        create.setGravity(Gravity.CENTER);
        GradientDrawable createBg=new GradientDrawable(
            GradientDrawable.Orientation.LEFT_RIGHT,
            new int[]{Color.rgb(188,255,111),Color.rgb(147,238,62)}
        );
        createBg.setCornerRadius(dp(a,18));
        create.setBackground(createBg);
        if(Build.VERSION.SDK_INT>=21) create.setElevation(dp(a,7));
        LinearLayout.LayoutParams createLp=new LinearLayout.LayoutParams(0,dp(a,54),.62f);
        createLp.leftMargin=dp(a,10);
        actions.addView(create,createLp);
        card.addView(actions,new LinearLayout.LayoutParams(-1,dp(a,66)));

        final Runnable submit=()->{
            String name=input.getText()==null?"":input.getText().toString().trim();
            if(name.isEmpty()){
                error.setText("Entre un nom pour créer ta playlist.");
                inputBox.setBackground(fieldBackground(a,true,true));
                input.requestFocus();
                return;
            }
            if(existingName(store,name)){
                error.setText("Une playlist porte déjà ce nom.");
                inputBox.setBackground(fieldBackground(a,true,true));
                input.requestFocus();
                return;
            }
            try{
                store.createPlaylist(name);
                if(track!=null&&!track.id.isEmpty()) store.addToPlaylist(name,track);
                if(changed!=null) changed.run();
                if(parent!=null&&parent.isShowing()) parent.dismiss();
                dialog.dismiss();
                Toast.makeText(a,track==null?"Playlist « "+name+" » créée":"Ajouté à « "+name+" »",Toast.LENGTH_SHORT).show();
            }catch(Throwable ex){
                error.setText("Impossible de créer la playlist. Réessaie.");
                inputBox.setBackground(fieldBackground(a,true,true));
            }
        };
        create.setOnClickListener(v->submit.run());
        input.setOnEditorActionListener((v,actionId,event)->{
            if(actionId==EditorInfo.IME_ACTION_DONE){submit.run();return true;}
            return false;
        });

        dialog.setContentView(card);
        dialog.setOnShowListener(x->{
            input.requestFocus();
            input.postDelayed(()->{
                try{
                    InputMethodManager imm=(InputMethodManager)a.getSystemService(Activity.INPUT_METHOD_SERVICE);
                    if(imm!=null) imm.showSoftInput(input,InputMethodManager.SHOW_IMPLICIT);
                }catch(Throwable ignored){}
            },220L);
        });
        dialog.show();

        Window w=dialog.getWindow();
        if(w!=null){
            w.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            w.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE|WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
            WindowManager.LayoutParams p=new WindowManager.LayoutParams();
            p.copyFrom(w.getAttributes());
            boolean wide=a.getResources().getDisplayMetrics().widthPixels>a.getResources().getDisplayMetrics().heightPixels;
            int max=dp(a,wide?520:500);
            p.width=Math.min(a.getResources().getDisplayMetrics().widthPixels-dp(a,20),max);
            p.height=WindowManager.LayoutParams.WRAP_CONTENT;
            p.gravity=wide?Gravity.CENTER:(Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);
            p.y=wide?0:dp(a,10);
            p.dimAmount=.74f;
            w.setAttributes(p);
        }
    }

    private static boolean existingName(AudifyLibraryStore store,String wanted){
        List<String> names=store.getPlaylistNames();
        if(names==null) return false;
        for(String n:names) if(n!=null&&n.trim().equalsIgnoreCase(wanted.trim())) return true;
        return false;
    }

    private static GradientDrawable fieldBackground(Activity a,boolean error,boolean focused){
        GradientDrawable g=new GradientDrawable();
        g.setColor(PANEL);
        g.setCornerRadius(dp(a,18));
        int stroke=error?ERROR:(focused?Color.rgb(168,255,63):Color.rgb(53,64,76));
        g.setStroke(dp(a,error||focused?2:1),stroke);
        return g;
    }

    private static TextView text(Activity a,String value,float sp,int color,boolean bold){
        TextView t=new TextView(a);
        t.setText(value);
        t.setTextSize(sp);
        t.setTextColor(color);
        if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        return t;
    }

    private static int dp(Activity a,int n){return Math.round(n*a.getResources().getDisplayMetrics().density);}
}
`;

await writeFile(path.join(pkgDir,'AudifyCreatePlaylistDialog.java'),creator,'utf8');

let home=await readFile(homePath,'utf8');
home=replaceMethod(
  home,
  ['    private void promptCreatePlaylist(){','    private void promptCreatePlaylist() {'],
  String.raw`    private void promptCreatePlaylist(){
        AudifyCreatePlaylistDialog.show(this,store,null,null,this::rebuildLibrary);
    }`,
  'NativeHomeActivity.promptCreatePlaylist'
);
await writeFile(homePath,home,'utf8');

let picker=await readFile(pickerPath,'utf8');
picker=replaceMethod(
  picker,
  [
    '    private static void showCreate(Activity a,AudifyLibraryStore store,AudifyLibraryStore.Track track,Dialog parent,Runnable changed){',
    '    private static void showCreate(Activity a, AudifyLibraryStore store, AudifyLibraryStore.Track track, Dialog parent, Runnable changed){'
  ],
  String.raw`    private static void showCreate(Activity a,AudifyLibraryStore store,AudifyLibraryStore.Track track,Dialog parent,Runnable changed){
        AudifyCreatePlaylistDialog.show(a,store,track,parent,changed);
    }`,
  'AudifyPlaylistPicker.showCreate'
);
await writeFile(pickerPath,picker,'utf8');

console.log('AUDIFY_V681266_PLAYLIST_CREATOR: création de playlist native sombre unifiée.');
