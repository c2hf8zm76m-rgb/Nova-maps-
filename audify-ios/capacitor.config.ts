import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.novaos.audify',
  appName: 'Audify',
  webDir: 'www',
  server: {
    iosScheme: 'https',
    allowNavigation: [
      'www.googleapis.com',
      'youtube.com',
      '*.youtube.com',
      'youtu.be',
      '*.ytimg.com'
    ]
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile'
  }
};

export default config;
