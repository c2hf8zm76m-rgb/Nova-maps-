import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nova.audify',
  appName: 'Audify',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false,
    // V66.3 applique directement les vrais WindowInsets dans MainActivity.
    // On désactive donc l'ajustement Capacitor pour éviter doubles marges et variations WebView.
    adjustMarginsForEdgeToEdge: 'disable'
  }
};

export default config;
