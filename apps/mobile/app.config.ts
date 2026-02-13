import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tenda',
  slug: 'tenda-app',
  version: '0.0.1',
  scheme: ['tenda'],
  orientation: 'portrait',
  icon: './assets/images/tenda-dark.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/tenda-transparent-light.png',
    resizeMode: 'contain',
    backgroundColor: '#3b82f6',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.usetenda.app',
    // backgroundColor: '',
    // icon: '',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/tenda-transparent-light.png',
      backgroundColor: '#3b82f6',
      monochromeImage: './assets/images/tenda-monochrome.png',
    },
    package: 'com.usetenda.app',
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
      'expo-splash-screen',
      {
        image: './assets/images/tenda-dark.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000'
        }
      }
    ],
    'expo-secure-store',
    'expo-font',
    '@react-native-community/datetimepicker',
    'react-native-edge-to-edge'
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true
  }
})
