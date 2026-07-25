/**
 * jest-expo harness (#101). Strategy: heavy native transports (Solana MWA,
 * @solana/web3.js, WalletConnect/Reown) and storage (AsyncStorage,
 * expo-secure-store) are MOCKED in jest.setup.js / per-test, so the suite
 * exercises OUR logic, not the SDKs, which also sidesteps having to transform
 * those packages. `transformIgnorePatterns` therefore only needs to whitelist
 * the RN/Expo/UI packages our components actually render.
 *
 * pnpm caveat: real packages resolve through node_modules/.pnpm/<pkg>@<ver>/…,
 * so the whitelist matches on the `.pnpm/<pkg>@` segment, not a bare
 * `node_modules/<pkg>` prefix.
 */
const WHITELIST = [
  '(jest-)?react-native',
  '@react-native',
  '@react-native-community',
  'react-native-.*',
  '@react-navigation',
  'expo',
  'expo-.*',
  '@expo',
  '@expo-google-fonts',
  'lucide-react-native',
  '@tenda',
].join('|')

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // pnpm can give RTL its own nested React copy; even at the same version,
    // two React instances break act()'s shared dispatcher ("not wrapped in
    // act" → unmounted renderer). Force every `react` import to the app's
    // single instance.
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
  },
  transformIgnorePatterns: [
    `node_modules/\\.pnpm/(?!(${WHITELIST})@)`,
    `node_modules/(?!(\\.pnpm|${WHITELIST}))`,
  ],
  clearMocks: true,
  collectCoverageFrom: [
    'wallet/**/*.{ts,tsx}',
    'stores/auth.store.ts',
    'app/(auth)/connect-wallet.tsx',
    'app/settings/linked-wallets.tsx',
    '!wallet/**/*.d.ts',
    // Message-attachment feature (chat + dispute).
    'lib/attachments.ts',
    'lib/media-download.ts',
    'hooks/useAttachmentUpload.ts',
    'components/shared/AttachSheet.tsx',
    'components/shared/media/AttachmentPreview.tsx',
    // Notification permission flow (primer tiers + throttled nudge).
    'lib/notifications/*.ts',
    // Pure re-export barrel, nothing to exercise.
    '!lib/notifications/index.ts',
    'stores/notification-prompt.store.ts',
    'stores/notification-permission.store.ts',
    'hooks/useNotificationPermission.ts',
    'hooks/usePushToken.ts',
    'components/notifications/NotificationPrimer.tsx',
    'components/notifications/NotificationPrimerHost.tsx',
    'components/notifications/NotificationNudgeBanner.tsx',
    'components/notifications/primerCopy.ts',
    // Pagination + chain filter (feed / order book / my gigs / my trades).
    'lib/pagination/*.ts',
    '!lib/pagination/index.ts',
    'hooks/usePaginatedList.ts',
    'hooks/useDebouncedValue.ts',
    'hooks/useGigsFeedPolling.ts',
    'hooks/useHomeFeed.ts',
    'hooks/useMyGigs.ts',
    'hooks/useMyDisputes.ts',
    'hooks/useExchangeScreen.ts',
    'components/ui/PaginatedList.tsx',
    'components/filters/*.tsx',
    'components/navigation/PagerTabBar.tsx',
  ],
}
