import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Stable preview config. google-services stays so FirebaseInitProvider has IDs.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'X-Relax',
  slug: 'x-relax',
  version: '1.0.11',
  orientation: 'portrait',
  icon: './assets/brand/app-icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'xrelax',
  owner: 'epicbda',
  splash: {
    image: './assets/brand/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#061428',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.xrelax.app',
    infoPlist: {
      UIBackgroundModes: ['audio'],
    },
  },
  android: {
    package: 'com.xrelax.app',
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/brand/app-icon.png',
      backgroundColor: '#061428',
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      'WAKE_LOCK',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    ],
  },
  notification: {
    icon: './assets/brand/notification-icon.png',
    color: '#FFFFFF',
  },
  web: {
    favicon: './assets/brand/favicon.png',
  },
  plugins: [
    'expo-system-ui',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#061428',
        image: './assets/brand/splash-icon.png',
        imageWidth: 200,
      },
    ],
    'expo-font',
    'expo-image',
    'expo-sharing',
    [
      'expo-audio',
      {
        microphonePermission: false,
        enableBackgroundPlayback: true,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/brand/notification-icon.png',
        color: '#FFFFFF',
        defaultChannel: 'default',
      },
    ],
  ],
  extra: {
    eas: {
      projectId: '9f446f0b-4c5c-4fa7-af20-5af03a841ed9',
    },
  },
});
