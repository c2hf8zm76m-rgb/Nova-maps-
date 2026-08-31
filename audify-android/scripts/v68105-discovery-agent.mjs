import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkgDir=path.join(root,'android','app','src','main','java','com','nova','audify');
const affinityPath=path.join(pkgDir,'AudifyAffinityStore.java');
const homePath=path.join(pkgDir,'NativeHomeActivity.java');

function replaceMethod(source, signatures, replacement, label){
  for(const sig of signatures){
    const start=source.indexOf(sig); if(start<0) continue;
    const brace=source.indexOf('{',start); let depth=0,end=-1;
    for(let i=brace;i<source.length;i++){ if(source[i]==='{') depth++; else if(source[i]==='}'&&--depth===0){end=i+1;break;} }
    if(end>0) return source.slice(0,start)+replacement+source.slice(end);
  }
  throw new Error('V68.10.5 méthode introuvable: '+label);
}

let affinity=await readFile(affinityPath,'utf8');
if(!affinity.includes('public boolean isKnownArtist(')){
  const marker='    public int scoreFor(AudifyLibraryStore.Track t){';
  const insert=`    public boolean isKnownArtist(String artist){
        String target=normalizeArtist(artist);
        if(target.isEmpty()) return false;
        for(Map.Entry<String,?> e:prefs.getAll().entrySet()){
            if(!e.getKey().startsWith(ARTIST_PREFIX) || !(e.getValue() instanceof Integer)) continue;
            if(((Integer)e.getValue())<=0) continue;
            if(normalizeArtist(e.getKey().substring(ARTIST_PREFIX.length())).equals(target)) return true;
        }
        return false;
    }

    public String normalizeArtist(String raw){
        if(raw==null) return "";
        String s=raw.toLowerCase(Locale.ROOT).trim();
        s=s.replace("–","-").replace("—","-");
        s=s.replaceAll("\\\\s+-\\\\s+topic$","");
        s=s.replaceAll("\\\\s+official$","");
        s=s.replaceAll("\\\\s+officiel$","");
        s=s.replaceAll("\\\\s+vevo$","");
        s=s.replaceAll("[^\\\\p{L}\\\\p{N}]+"," ").trim();
        return s.replaceAll("\\\\s+"," ");
    }

`;
  if(!affinity.includes(marker)) throw new Error('scoreFor marker absent');
  affinity=affinity.replace(marker,insert+marker);
}
await writeFile(affinityPath,affinity,'utf8');

let home=await readFile(homePath,'utf8');
home=replaceMethod(home,['    private void addForYouSection(){','    private void addForYouSection() {'],String.raw`    private void addForYouSection(){
        LinearLayout panel=sectionPanel();
        panel.setPadding(dp(14),dp(18),dp(14),dp(18));
        AudifyAffinityStore affinity=new AudifyAffinityStore(this);

        TextView eyebrow=text("AUDIFY DISCOVERY AGENT",12f,true);
        eyebrow.setTextColor(ACCENT); eyebrow.setLetterSpacing(0.14f);
        panel.addView(eyebrow,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(30)));
        TextView title=text("Pour toi",31f,true);
        panel.addView(title,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(48)));

        String genre=affinity.topGenre();
        TextView sub=text(genre.isEmpty()
            ?"L’agent apprend tes goûts puis cherche de nouveaux artistes, sans te resservir ceux que tu connais déjà."
            :"Tu écoutes surtout "+genre+". L’agent privilégie maintenant de nouveaux artistes proches de ce profil.",15f,false);
        sub.setTextColor(Color.rgb(178,187,201)); sub.setPadding(0,0,0,dp(12)); panel.addView(sub);

        java.util.LinkedHashSet<String> knownArtists=new java.util.LinkedHashSet<>();
        for(AudifyLibraryStore.Track t:store.getRecents()) if(t!=null) knownArtists.add(affinity.normalizeArtist(t.artist));
        for(AudifyLibraryStore.Track t:store.getLikes()) if(t!=null) knownArtists.add(affinity.normalizeArtist(t.artist));

        java.util.LinkedHashMap<String,AudifyLibraryStore.Track> byArtist=new java.util.LinkedHashMap<>();
        java.util.ArrayList<AudifyLibraryStore.Track> pool=new java.util.ArrayList<>();
        pool.addAll(store.getRecents()); pool.addAll(store.getLikes());
        for(AudifyLibraryStore.Track t:pool){
            if(t==null||t.id.isEmpty()) continue;
            String a=affinity.normalizeArtist(t.artist);
            if(a.isEmpty()||knownArtists.contains(a)||affinity.isKnownArtist(t.artist)) continue;
            if(!byArtist.containsKey(a)) byArtist.put(a,t);
        }
        ArrayList<AudifyLibraryStore.Track> candidates=new ArrayList<>(byArtist.values());
        java.util.Collections.sort(candidates,(a,b)->Integer.compare(affinity.scoreFor(b),affinity.scoreFor(a)));

        if(candidates.isEmpty()){
            TextView empty=text("Profil prêt"+(genre.isEmpty()?"":" · "+genre)+". Audify doit maintenant découvrir des artistes différents de ceux déjà écoutés.",14f,false);
            empty.setTextColor(Color.rgb(160,169,182)); panel.addView(empty,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(66)));
        }else{
            HorizontalScrollView hsv=new HorizontalScrollView(this); hsv.setHorizontalScrollBarEnabled(false);
            LinearLayout rail=new LinearLayout(this); rail.setOrientation(LinearLayout.HORIZONTAL);
            for(int i=0;i<Math.min(8,candidates.size());i++){
                AudifyLibraryStore.Track t=candidates.get(i);
                LinearLayout card=new LinearLayout(this); card.setGravity(Gravity.CENTER_VERTICAL); card.setPadding(dp(9),dp(8),dp(10),dp(8));
                card.setBackground(round(Color.rgb(15,22,28),dp(1),i==0?Color.rgb(94,145,48):Color.rgb(47,58,66),dp(22)));
                card.setOnClickListener(v->playTrack(t));
                ImageView art=artworkView(); loadImage(art,t.thumbnail); card.addView(art,new LinearLayout.LayoutParams(dp(68),dp(68)));
                LinearLayout info=new LinearLayout(this); info.setOrientation(LinearLayout.VERTICAL); info.setPadding(dp(11),0,dp(5),0);
                TextView tt=text(t.title,15.5f,true); tt.setMaxLines(1); tt.setEllipsize(TextUtils.TruncateAt.END);
                TextView aa=text(t.artist,13f,false); aa.setTextColor(Color.rgb(171,181,194)); aa.setMaxLines(1); aa.setEllipsize(TextUtils.TruncateAt.END);
                TextView why=text("Nouvel artiste · proche de tes goûts",11.5f,false); why.setTextColor(ACCENT);
                info.addView(tt,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(27)));
                info.addView(aa,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(22)));
                info.addView(why,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(19)));
                card.addView(info,new LinearLayout.LayoutParams(0,dp(70),1f));
                TextView arrow=text("›",27f,true); arrow.setTextColor(Color.rgb(179,190,202)); arrow.setGravity(Gravity.CENTER);
                card.addView(arrow,new LinearLayout.LayoutParams(dp(30),dp(68)));
                LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(dp(300),dp(88)); cp.rightMargin=dp(12); rail.addView(card,cp);
            }
            hsv.addView(rail,new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,dp(92)));
            panel.addView(hsv,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(98)));
        }
        addPanel(panel,dp(18));
    }`,'addForYouSection');
await writeFile(homePath,home,'utf8');
console.log('Audify V68.10.5 Discovery Agent: anti-doublon artiste strict appliqué.');
