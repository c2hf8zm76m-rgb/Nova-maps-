(()=>{
  'use strict';
  // Audify V66 — configuration OAuth Web.
  // Android n'utilise pas cette valeur : il passe par Google Identity Services natif.
  // Pour activer la synchronisation sur la version navigateur, renseigner ici
  // l'ID client OAuth 2.0 de type "Application Web" créé dans Google Cloud Console.
  window.AUDIFY_GOOGLE_WEB_CLIENT_ID=window.AUDIFY_GOOGLE_WEB_CLIENT_ID||'';
})();
