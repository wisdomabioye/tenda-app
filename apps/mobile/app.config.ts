import { ExpoConfig, ConfigContext } from 'expo/config'

const apiHost = process.env.EXPO_PUBLIC_API_URL
  ? new URL(process.env.EXPO_PUBLIC_API_URL).host
  : ''

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
    bundleIdentifier: 'com.tendahq.mobile',
    // Stage 9C, Sign in with Apple entitlement (App Store 4.8: required
    // alongside Google sign-in). The expo-apple-authentication plugin adds it.
    usesAppleSignIn: true,
    icon: {
      light: './assets/images/icon.png',
      dark: './assets/images/ios-icon-dark.png',
      tinted: './assets/images/ios-icon-tinted.png',
    },
  },
  android: {
    // 'resize' pairs with the app-wide KeyboardAvoidingView idiom
    // (behavior={undefined} on Android): the window resizes so bottom-anchored
    // inputs (ChatInput on the chat + dispute threads) fully clear the keyboard.
    // 'pan' only guaranteed the cursor cleared it, leaving the input row's lower
    // edge tucked under the keyboard.
    softwareKeyboardLayoutMode: 'resize',
    adaptiveIcon: {
      // Navy from the brand badge; the foreground is glyph-only ("t" + dot) so
      // the OS mask (circle/squircle) produces the badge shape itself.
      backgroundColor: '#000B22',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    package: 'com.tendahq.mobile',
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    // Enabling this cause this app to exit from any screen
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: apiHost, pathPrefix: '/gig' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
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
    './plugins/with-wallet-queries',
    'expo-router',
    [
      'expo-notifications',
      {
        // Must be white-on-transparent: Android tints the small icon by alpha.
        icon: './assets/images/notification-icon.png',
        color: '#1250E3',
        defaultChannel: 'default',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#ffffff',
        image: './assets/images/splash-icon.png',
        imageWidth: 180,
        dark: {
          backgroundColor: '#1b1b1b',
          image: './assets/images/splash-icon-dark.png',
        },
      },
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
    // Stage 9C, Sign in with Apple (adds the iOS entitlement).
    'expo-apple-authentication',
    // Google sign-in's iOS build needs the reversed-client-id URL scheme. It's
    // only known once the Google OAuth client exists (USER ACTION), so the
    // plugin is added ONLY when GOOGLE_IOS_URL_SCHEME is set, keeps
    // `expo config` / the dev loop working before the credential is provisioned.
    ...(process.env.GOOGLE_IOS_URL_SCHEME
      ? [
          [
            '@react-native-google-signin/google-signin',
            { iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME },
          ] as [string, { iosUrlScheme: string }],
        ]
      : []),
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true
  }
})
