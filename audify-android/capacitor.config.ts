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
    // Android 15 / target SDK 35 dessine les apps edge-to-edge.
    // Sans marge native, la barre Audify visible en haut peut se retrouver
    // sous la zone système : elle est visible mais Android intercepte le toucher.
    // Capacitor applique ici les vrais insets système au WebView.
    adjustMarginsForEdgeToEdge: 'force'
  }
};

export default config;
