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
// Jest only supplies "test" when NODE_ENV is absent. Release shells export
// "production", which makes Babel transform the suite as production code
// before setupFiles run (no Jest mock hoisting) and selects React's renderer
// without `act`. Set it while the config itself is loading, before transforms.
process.env.NODE_ENV = 'test'

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
  /**
   * Jest defaults to one worker per core minus one — 11 on a 12-core box — and
   * at that width the workers starve each other badly enough to fail tests.
   *
   * The failures did NOT look like contention, which is why they read as
   * flakiness for so long. RTL's `waitFor` deadline is 1000ms
   * (asyncUtilTimeout, five times tighter than jest's 5000ms testTimeout), and
   * on expiry it rethrows its LAST ASSERTION rather than a timeout message. A
   * starved worker therefore reports
   *     expect(received).toBe(expected)  Expected: false  Received: true
   * from a `waitFor(() => expect(result.current.loading).toBe(false))` — an
   * assertion that looks like a logic race, in whichever test happened to be
   * running. Reproduced exactly by setting asyncUtilTimeout to 1ms.
   *
   * MEASURED on a 12-core box, full suite (180 suites / 1548 tests):
   *   workers   wall time        runs failed
   *   11 (dflt) 20.9 – 34.7 s    1 / 5
   *    8        13.3 – 22.3 s    0 / 3
   *    6 (50%)  11.0 – 12.2 s    0 / 3
   *    4        10.8 – 12.6 s    0 / 5
   *    3        12.3 – 12.8 s    0 / 3
   *    2        14.6 – 15.0 s    0 / 3
   * Fewer workers is both FASTER and stable; the knee is 4–6. `'50%'` rather
   * than a fixed count because jest floors a percentage to at least 1 worker
   * (jest-config/getMaxWorkers), so a 2-core CI runner gets 1 instead of the
   * 4 a fixed count would over-subscribe it with.
   *
   * CONFIRMED with this config, no flags: 10/10 green in 9.8 – 12.0 s idle.
   * Then a controlled A/B under 8 CPU hogs (load avg ~23–30), same load both
   * ways: 11 workers failed 2 of 3 runs, '50%' passed 10 of 10.
   *
   * The timeouts are deliberately NOT raised. The four suites that failed run
   * in 2.3s TOTAL when not starved, so the 1000ms deadline already carries
   * ~100x headroom — raising it would only hide a test that genuinely got slow.
   */
  maxWorkers: '50%',
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
  /**
   * An ALLOW-LIST: a file that is not matched here contributes nothing to the
   * figures below, however well tested it is. That is deliberate — mobile has
   * screens and native-adjacent modules that are impractical to cover, and a
   * catch-all pattern over every ts/tsx file would drop the global far under
   * 90 and force a threshold cut, which is a worse number than an honest
   * narrow one.
   *
   * What is NOT deliberate is a file quietly staying outside it. #49, #51 and
   * #56 each found one by accident. __tests__/coverage-gate.test.ts now fails
   * when a suite lands on an unlisted module, and test-support/
   * coverage-ungated.ts records the 109 that are outside it today. That list
   * cannot grow without someone editing it in a reviewed diff.
   *
   * The same test also fails on a pattern here that matches NOTHING. #58 found
   * seven, every one of them a module that had moved into @tenda/shared with
   * its pattern left behind — the failure mode to expect, since a module
   * leaving the app looks exactly like a module that was never listed.
   *
   * Before adding a file here, MEASURE with it listed. Every entry below that
   * says "measured" earned it that way — and re-measure before trusting one,
   * because stores/realtime.store.ts sat out of the gate on a reading that had
   * stopped being true.
   */
  collectCoverageFrom: [
    // The notification centre: the feed store and the screen that reads it.
    // Added in #57 with the cases that fix the empty-state blink; measured
    // before listing, and the gate holds (branches 90.57 -> 90.46, still above
    // the 90 threshold) with the store at 97.91 and the screen's refresh and
    // end-reached paths now driven rather than left dark.
    'stores/notifications.store.ts',
    'app/notifications/index.tsx',
    // The open-thread register and the read-sync debounce (#56). Added with its
    // first suite; measured before listing, and it RAISES the gate (branches
    // 90.46 -> 90.57).
    'hooks/useChatRealtime.ts',
    // Its sibling, added in #58 after RE-measuring. #56 left this file out on
    // a measurement of 89.96% branches against a threshold of 90, and #58
    // seeded it into the ungated register on the strength of that number. The
    // number had gone stale: #57 raised the branch floor, and gating this file
    // now reads 90.21 — it holds. Recording the reason and then not re-taking
    // the measurement is how an exemption outlives its cause.
    //
    // The file itself is 72.72 / 70.45 / 73.68 / 74.07: its chat half is
    // covered and its escrow, gig-feed, notification and connection channels
    // are not, so the 0.21 of headroom here is genuinely thin. #70 is the task
    // that widens it — filed off this file's uncovered lines, which only
    // became visible once it was gated. Until it lands, a change that costs
    // more than 0.21 of branch coverage fails the gate, which is the gate
    // working.
    'stores/realtime.store.ts',
    // The optimistic-send state machine (#59). It had no suite at all and sat
    // outside this list too, so both halves of #58's problem applied to the
    // trickiest state in the app. Measured before listing: the file reads
    // 100/100/100/100 and the global branch figure goes UP, 90.21 -> 90.57.
    'stores/chat.store.ts',
    // The budget field: fiat/asset entry, the rate-arrival conversion (#49) and
    // the base-unit string it emits. Added in the #49 re-audit — the task gave
    // it a 17-case suite and left the file outside this allow-list, so none of
    // those cases could move the number. Including it costs nothing: the file
    // measures 100/97.5/100/100, its one uncovered branch being a Pressable's
    // press-state opacity. (95 branch until #66 covered the unknown-asset
    // symbol fallback.)
    'components/form/PaymentInput.tsx',
    // Its money, split out when #66 took the component past 300 lines: the two
    // fiat<->base-unit converters, the rate derivation, and the effect that
    // restates the field when the denomination changes. Measured before
    // listing, per the rule above: 100/100/100/100, and the global figures went
    // UP — statements 92.4 -> 92.53, branches 90.81 -> 91.04 (measured with the
    // line removed and restored, not recalled).
    'components/form/payment-input/payment-input.fiat.ts',
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
    // `lib/pagination/*.ts` and its index exclusion headed this block until
    // #58: 623a79c moved that directory to packages/shared/src/pagination,
    // where shared's own suite covers it, and both patterns had been matching
    // nothing here ever since.
    'hooks/usePaginatedList.ts',
    // The hook's two extracted halves (#54). Listed explicitly because the
    // gate is an allow-list: splitting a covered file into an unlisted folder
    // silently REMOVES its code from the measurement, and the parent then
    // reports a better number for doing less — measured, usePaginatedList.ts
    // read 100/100/100/100 with the branchy half no longer inside it.
    'hooks/pagination/*.ts',
    // Types only, nothing to exercise.
    '!hooks/pagination/paginated-list.types.ts',
    'hooks/useDebouncedValue.ts',
    'hooks/useGigsFeedPolling.ts',
    'hooks/useHomeFeed.ts',
    'features/gig-feed/*.ts',
    '!features/gig-feed/index.ts',
    'hooks/useMyGigs.ts',
    'hooks/useMyDisputes.ts',
    'hooks/useExchangeScreen.ts',
    'components/ui/PaginatedList.tsx',
    'components/gig/GigListSkeleton.tsx',
    'components/filters/*.tsx',
    'components/navigation/PagerTabBar.tsx',
    // MB1/MB2: server-backed wallet totals + profile counts.
    'hooks/useWalletScreen.ts',
    'hooks/useProfileStats.ts',
    // Live moderation hints while composing a gig. Web's twin has been covered
    // since S6; this one had no suite at all until #51, so it was invisible
    // here too — a gate that cannot see a file cannot report it regressing.
    'hooks/useModerationPreview.ts',
    // Stage 10: gig acceptance modes. The CTA branch resolution is the part
    // that matters — it is where the mode-blind "Accept Gig" bug lived, and it
    // is pure, so it is covered directly rather than through eight renders.
    'components/gig/gig-cta/*.{ts,tsx}',
    // A `gig-cta/branches/*.ts` entry sat here until #58. 686cb76 deleted that
    // directory when mobile started consuming the shared S4.0 modules, so the
    // pattern had been matching nothing since.
    '!components/gig/gig-cta/index.ts',
    '!components/gig/gig-cta/types.ts',
    'components/gig/GigCTABar.tsx',
    // The whole approval surface, not a hand-picked list of it: naming files
    // individually is how ApplicantList, ApplicantRow, ApplySheet and
    // MyApplicationCard sat at 0% while the folder reported healthy numbers.
    'components/gig/gig-applications/*.{ts,tsx}',
    '!components/gig/gig-applications/index.ts',
    'components/gig/gig-form/AcceptanceModePicker.tsx',
    'components/gig/GigDetailGate.tsx',
    'components/shared/ReviewScore.tsx',
    'stores/gigs.store.ts',
    // CO1 takedown enforcement: the hooks that act on a refusal, where the
    // server is the first to know a listing was pulled and the screen has to
    // be told by its own failure.
    //
    // `lib/detail-load-error.ts` and `lib/takedown-refusal.ts` headed this
    // block until #58. Both were deleted in 686cb76 as superseded local copies
    // of shared modules; neither pattern had matched anything since.
    'components/gig/gig-applications/useApplications.ts',
    'hooks/useExchangeDetail.ts',
    'components/ui/NoticeBanner.tsx',
    'components/reputation/RestrictionBanner.tsx',
    'components/escrow/takedown/*.{ts,tsx}',
    '!components/escrow/takedown/index.ts',
    'components/exchange/ExchangeCTA.tsx',
    // Dispute mediation. Named as WHOLE folders, not a hand-picked list: the
    // thread screen sat at 0% while its neighbours reported healthy numbers,
    // which is how a mediator seeing both disputants under one name shipped.
    'app/dispute/*.tsx',
    'components/dispute/*.{ts,tsx}',
    // `lib/dispute-thread.ts` (moved to shared in 623a79c) and
    // `lib/dispute-send-error.ts` (deleted in 686cb76) were listed here and
    // had been matching nothing since (#58).
    'hooks/useDisputeThread.ts',
    // Build identity. Small, but it is the surface that spent months telling
    // users the app was v1.0.0 when it had never been.
    'lib/app-version.ts',
    'components/ui/AppVersion.tsx',
    // Escrow convergence. Include the orchestration itself so tests cannot
    // pass by merely asserting mocked callbacks around the former race.
    'hooks/escrow-sync/*.ts',
    '!hooks/escrow-sync/index.ts',
    '!hooks/escrow-sync/types.ts',
    'hooks/escrow-live/*.ts',
    '!hooks/escrow-live/index.ts',
    // `lib/escrow-sync.ts` was listed below this line. 623a79c moved it to
    // packages/shared/src/utils, which grew its own suite for it in the same
    // commit; the mobile pattern stayed and matched nothing (#58).
    // The per-chain balance rows (#64). Added with their first suite: the
    // component printed '0 USDC' for a chain it had NO reading for, which is
    // the conflation web's grid has always avoided. Measured before listing —
    // the file reads 100/100/100/100 and every global figure went up.
    'components/wallet/WalletBalanceRows.tsx',
    'components/feedback/TransactionMonitor.tsx',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
}
