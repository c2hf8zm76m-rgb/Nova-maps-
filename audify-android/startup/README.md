# Audify 68.12.38 — Chroma startup

[Prototype Figma](https://www.figma.com/design/tu17i8Cu3wiZDjRkpQ53HN?node-id=2-2)

Le A original et ses barres sont extraits de `branding/audify_launcher.webp`.
Le symbole reste immobile. Un dégradé bleu, violet, rose et orange se déplace
dans son masque alpha ; aucun anneau, halo, slogan, égaliseur ajouté ou faux pourcentage.
Le fond `#05080C` et le vert final `#9DFF32` reprennent l'accueil Android.

## Contrat des états

| Texte | Travail réel qui doit terminer |
| --- | --- |
| Audify prépare votre bibliothèque | Restauration et lecture du cache privé du bon utilisateur, hors thread UI |
| Audify synchronise votre compte | Lecture Firestore `Source.SERVER`, application locale, file d'envoi et écritures en vol vides ; transfert d'avatar terminé s'il existe |
| Audify prépare votre accueil | Construction de l'accueil réel, recommandations initiales non mises en cache, chargement des pochettes demandées et première frame dessinée |
| Audify est prêt | Toutes les barrières précédentes sont franchies |

Les invités ne passent pas par une synchronisation fictive. Les erreurs gardent
le splash ouvert. Après une attente réseau prolongée, l'utilisateur peut
réessayer ou choisir explicitement les données locales. Des visuels manquants
nécessitent une confirmation pour ouvrir avec les espaces de remplacement.
Ces sorties sont nommées « hors connexion » / « visuels différés » et ne prétendent
pas avoir synchronisé le compte. Aucun compte ni document de production n'est
créé par les tests.

« Prêt » concerne l'écran d'accueil et le compte : les fichiers audio, toutes les
paroles et tous les résultats de recherche ne sont pas pré-téléchargés au démarrage.
Les recommandations déjà en cache peuvent s'actualiser après l'ouverture.

## Animation

- Flux chromatique : boucle continue de 6,2 s, sans rotation du logo.
- Vert : transition de 460 ms **déclenchée par la disponibilité**, jamais par un délai de lancement.
- Disparition : fondu de 300 ms sur l'accueil déjà présent dans la même activité.
- Animation système Android raccordée au même logo et au même fond.
- Respect des animations désactivées, arrêt en arrière-plan et nettoyage à la destruction.
- Le prototype utilise une chronologie illustrative ; ses temps de chargement ne sont pas utilisés dans l'application.

## Sources et vérification

Les fichiers de `startup/src` sont canoniques. Le dernier patch
`scripts/v681238-chroma-startup.mjs` les copie dans le projet Capacitor généré,
retire l'ancien lancement à deux activités, puis installe les hooks Home.
Ne pas modifier les Java générés comme source principale.

```sh
npm run android:patch
npm run test:startup
cd android
./gradlew testDebugUnitTest assembleDebug
```

Le test Java sans Android vérifie notamment le cache non confirmé, les écritures
encore en attente, le premier dessin, les ressources lentes, l'ouverture hors
connexion explicite et les callbacks après destruction.

À vérifier sur BlueStacks/appareil : ouverture à froid, compte invité/connecté,
réseau coupé et revenu, erreur de règles Firestore, arrière-plan pendant chaque
phase, rotation, grandes polices, animations système désactivées, pochettes lentes.
Ne pas confondre compilation/maquette et validation visuelle sur appareil.
