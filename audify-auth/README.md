# Audify Auth — Sign in with Apple

Backend serverless sécurisé pour la connexion Apple de l'APK Audify.

## URL publique prévue

- Start: `https://audify-auth-alo12230-6256s-projects.vercel.app/api/apple/start`
- Callback Apple: `https://audify-auth-alo12230-6256s-projects.vercel.app/api/apple/callback`
- Verify APK: `https://audify-auth-alo12230-6256s-projects.vercel.app/api/apple/verify`
- Health: `https://audify-auth-alo12230-6256s-projects.vercel.app/api/health`

## Variables serveur obligatoires

Ne jamais les mettre dans l'APK ni les committer.

- `AUDIFY_AUTH_SECRET` — secret aléatoire de 32 caractères minimum
- `AUDIFY_APPLE_SERVICE_ID` — Services ID créé dans Apple Developer
- `AUDIFY_APPLE_REDIRECT_URI` — exactement `https://audify-auth-alo12230-6256s-projects.vercel.app/api/apple/callback`
- `AUDIFY_APPLE_TEAM_ID` — Team ID Apple Developer
- `AUDIFY_APPLE_KEY_ID` — Key ID de la clé Sign in with Apple
- `AUDIFY_APPLE_PRIVATE_KEY` — contenu de la clé privée `.p8`

## Sécurité

Le backend utilise un `state` signé, un nonce OIDC, valide l'`id_token` avec les clés publiques Apple, génère le `client_secret` Apple côté serveur et renvoie à l'APK uniquement un ticket Audify signé et expirant en 5 minutes. La clé `.p8` Apple ne doit jamais quitter le serveur.
