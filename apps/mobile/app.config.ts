import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tenda',
  slug: 'tenda-app',
  version: '0.0.1',
  scheme: ['tenda'],
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.usetenda.app',
    // backgroundColor: '',
    // icon: '',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#1b1b1b',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    package: 'com.usetenda.app',
    googleServicesFile: './google-services.json',
    // Enabling this cause this app to exit from any screen
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  extra: {
    APP_ENV: process.env.APP_ENV ?? 'development',
    eas: {
      projectId: '9428bdad-8f0c-4a7d-b0cb-20e6a3fc63de'
    }
  },
  plugins: [
    'expo-router',
    [
      'expo-notifications',
      {
        icon: './assets/images/splash-icon.png',
        color: '#1b1b1b',
        defaultChannel: 'default',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 350,
        resizeMode: 'contain',
        backgroundColor: '#1b1b1b',
        dark: {
          backgroundColor: '#1b1b1b',
        },
      }
    ],
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        project: 'tenda-mobile',
        organization: 'xpl-developers'
      }
    ],
    'expo-video',
    [
    'expo-media-library',
      {
        photosPermission: 'Allow Tenda to access your gallery to save proof files.',
        savePhotosPermission: 'Allow Tenda to save proof files to your gallery.',
        isAccessMediaLocationEnabled: true,
      },
    ],
    'expo-secure-store',
    'expo-location',
    'expo-font',
    '@react-native-community/datetimepicker',
    'react-native-edge-to-edge'
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true
  }
})
