# Audify Firebase 68.12.37

Le code utilise le projet `audify-753ce` déclaré dans `google-services.json`.

## Activation à faire dans Firebase Console

1. Dans **Authentication > Sign-in method**, activer **Email/Password**. Pour Google, activer **Google**, ajouter le SHA-1 et le SHA-256 de la signature de distribution Audify, puis télécharger un nouveau `google-services.json` contenant `oauth_client`.
2. Créer la base **Cloud Firestore** et publier `firestore.rules`.
3. Pour les avatars, activer **Cloud Storage** et publier `storage.rules`. Depuis février 2026, Firebase demande le plan Blaze pour les nouveaux buckets Storage ; le code continue à fonctionner sans Storage et conserve l’avatar localement.
4. Ne pas modifier les règles pour autoriser une lecture croisée : chaque document est sous `users/{uid}/entries` et chaque fichier sous `users/{uid}/avatars`.

## Modèle et garanties

La bibliothèque est découpée en documents `like`, `recent`, `playlist`, `playlistItem`, `affinity` et `profile`. Chaque écriture locale est d’abord enregistrée dans un outbox par UID, puis envoyée individuellement. Les tombstones de suppression sont conservés ; une confirmation ancienne ne peut pas effacer une modification récente. Firestore garde son cache hors ligne, tandis que l’outbox Audify garantit qu’un arrêt de l’application ne transforme pas une écriture non confirmée en « synchronisée ».

Les anciennes données locales ne sont jamais importées automatiquement. Après connexion, l’utilisateur confirme **Importer l’ancienne bibliothèque** ou **Importer mes données invité**. Les mots de passe locaux et les données Premium ne sont pas copiés dans Firestore.

## Vérification locale

```bash
npm run test:rules --prefix firebase
```

Cette commande lance les émulateurs Firestore/Storage et vérifie l’isolation entre Alice, Bob et un utilisateur non connecté, les tombstones, les identifiants de documents, les champs inconnus et les types d’avatar.
