import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Vitest otherwise preserves an inherited NODE_ENV=production and loads
// React's production build, whose test renderer has no act(). Same guard as
// apps/admin/vitest.config.ts.
Object.assign(process.env, { NODE_ENV: 'test' })

// jsdom renders React 19 *client* components only. App Router server
// components / async pages are out of scope for this harness — the Stage-1
// SSR assertions (OG tags, party-field absence) run against a real `next
// start` instead.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror tsconfig "paths": { "@/*": ["./*"] }.
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    /**
     * Vitest defaults to one worker per core minus one — 11 on a 12-core box —
     * and this file previously declared no worker config at all, so that is
     * what it ran. `apps/mobile/jest.config.js` records the same number as
     * MEASURED-unstable for jest, with an A/B behind it; web was sitting at
     * exactly that width with nobody having checked.
     *
     * WHAT #34 ESTABLISHED, and what it did not.
     *
     * Reproduced, with the identity captured — the thing three earlier
     * occurrences lost to an output filter. Under a deliberate CPU load, one
     * COMPLETE run (213 s, 1884 of 1885 tests passing) failed exactly one:
     *     FeedRail > offers every category in the shared vocabulary…
     *     → Test timed out in 5000 ms, at 5399 ms
     * Two further runs failed the same test first (6180 / 5521 ms), but the
     * machine was degrading by then — the second showed unrelated tests at
     * 28-31 s — so they corroborate rather than measure.
     *
     * That test takes 330 ms running its own suite in isolation. So it is not
     * a slow test: it is a starved one, missing a deadline that already
     * carries ~15x headroom. Which is why the fix is FEWER WORKERS and not a
     * bigger timeout — raising the budget would only hide a test that
     * genuinely got slow. (The two GigWizard suites keep their scoped 20 s
     * bump: those really do drive five wizard steps.)
     *
     * STILL NOT MEASURED: that '50%' survives the same CPU LOAD the failure
     * was reproduced under. That run was stopped — it took the machine down —
     * and it must not be retaken on a machine anyone is using. The idle rows
     * BELOW are half of that comparison, not a substitute for it; what
     * carries the rest is mobile's A/B (11 workers failed 2 of 3 runs under
     * load, '50%' passed 10 of 10). If this flakes again, the loaded arm is
     * the first thing to go and get, on a machine nobody is using.
     *
     * WHAT THE CAP ACTUALLY BUYS, measured idle with no synthetic load —
     * the same full suite, run both ways:
     *
     *   wall clock   11 workers  102.1 / 80.3 / 87.6 s
     *                 6 workers   87.5 / 93.6 s
     *   canary SUITE 11 workers  8084 / 5154 / 7481 ms
     *                 6 workers  2999 / 4837 ms      (2690 ms in isolation)
     *
     * Wall clock is a WASH — the ranges overlap and there is no speed case
     * here, unlike mobile, where fewer workers was also faster. What does not
     * overlap is the second row: the heavy suite runs at roughly its isolated
     * speed at 6 workers and at ~3x inflation at 11. That is the whole point,
     * because the failure is a PER-TEST deadline, not a total: contention
     * inside a heavy suite is what eats a 5000 ms budget, and the cap is what
     * gives it back.
     *
     * PLAYWRIGHT NEEDS NO MATCHING CHANGE, checked rather than assumed: it
     * already reports "125 tests using 6 workers", i.e. the half-the-cores
     * default this now matches. The asymmetry #34 suspected was real and it
     * was one-sided — vitest at 11 beside playwright at 6.
     *
     * A percentage rather than a fixed count so a 2-core CI runner gets 1
     * worker instead of the 6 a fixed count would over-subscribe it with.
     */
    maxWorkers: '50%',
    globals: true,
    clearMocks: true,
    environment: 'jsdom',
    // The API host the way the bundler would inline it in a dev build.
    env: { NEXT_PUBLIC_API_URL: 'http://localhost:3000' },
    setupFiles: ['./test/setup.tsx'],
    // Tests are co-located in __tests__/ next to the code, the apps/mobile
    // convention — most of this app is ported mobile code, so the tests move
    // with their subjects.
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Ratcheting include list: every stage that ports a directory adds it
      // here WITH its tests, so the 90/85 gate stays honest instead of being
      // diluted by not-yet-tested surface. Root layout/page are server
      // components (not renderable under jsdom) and excluded like admin's.
      // scripts/gen-web-tokens/main.ts is excluded with reason: a thin CLI
      // (fs + argv + process.exit) whose full pipeline the CI drift gate runs
      // for real; the transforms it calls live in core.ts, which IS gated.
      include: [
        // Money math on a public page: it answers what the chain will charge,
        // so it is gated like any other fee path (joined during the #13 review).
        'app/(public)/support/escrow/FeeCalculator.tsx',
        'api/request.ts',
        // The WHOLE endpoint-description layer since #38, not the three files
        // that happened to have tests. Each method encodes a verb, a route
        // constant and a param shape — precisely what drifts from the server
        // with nothing noticing, as the `/v1/fiat/bank-accounts` vs
        // `/v1/bank-accounts` mistake did until it was caught by hand in #19.
        // Every component test mocks `@/api/client` wholesale, so these are
        // reachable only from tests written against them directly.
        'api/client/**/*.ts',
        'lib/**/*.ts',
        'hooks/**/*.ts',
        'stores/**/*.ts',
        'wallet/**/*.ts',
        'components/wallet/**/*.{ts,tsx}',
        'components/escrow/**/*.{ts,tsx}',
        'components/form/**/*.{ts,tsx}',
        'components/moderation/**/*.{ts,tsx}',
        'components/shared/**/*.{ts,tsx}',
        'components/gig/category-icons.ts',
        'components/gig/CategoryGrid.tsx',
        // Joined in #22's sweep: named individually because components/gig's
        // own root is a mix of ported components and folders already globbed
        // below, and a bare components/gig/*.tsx would re-add nothing else.
        'components/gig/CategoryBadge.tsx',
        'components/gig/GigCreatorLine.tsx',
        'components/gig/GigDetailCta.tsx',
        'components/gig/GigWizard.tsx',
        // Joined the ratchet during the #12 review: it kept a private copy of
        // the location rule that commit consolidated, and being uncovered is
        // how the copy survived.
        'components/gig/MyGigCard.tsx',
        'components/gig/detail/**/*.{ts,tsx}',
        'components/gig/feed/**/*.{ts,tsx}',
        'components/gig/gig-form/**/*.{ts,tsx}',
        'components/gig/gig-applications/**/*.{ts,tsx}',
        'components/chat/**/*.{ts,tsx}',
        'components/notifications/**/*.{ts,tsx}',
        'components/dispute/**/*.{ts,tsx}',
        // #17: the my-gigs and notification columns and their detail panes.
        'components/gig/my-gigs/**/*.{ts,tsx}',
        'components/notifications/**/*.{ts,tsx}',
        'lib/account-state.ts',
        'components/exchange/**/*.{ts,tsx}',
        'components/profile/**/*.{ts,tsx}',
        // #14 ported the focused shell; the whole auth folder joins the
        // ratchet with it rather than three files of it.
        'components/auth/**/*.{ts,tsx}',
        // #15's pre-account surfaces and the two whole-page states.
        'components/onboarding/**/*.{ts,tsx}',
        'components/app/status/**/*.{ts,tsx}',
        // #16: the inbox and disputes columns, the first surfaces to have one.
        'components/chat/**/*.{ts,tsx}',
        'components/dispute/**/*.{ts,tsx}',
        // #17: the my-gigs and notification columns and their detail panes.
        'components/gig/my-gigs/**/*.{ts,tsx}',
        'components/notifications/**/*.{ts,tsx}',
        // The auth STEPS carry real logic — two clocks, a completeness gate
        // that must match the server's, and the one place PII must not reach
        // the URL — so they are gated like any other (#14 review).
        'app/(focused)/signin/email/page.tsx',
        'app/(focused)/signin/verify/page.tsx',
        'app/(focused)/onboarding/profile/page.tsx',
        // {ts,tsx} like every sibling folder: the `.tsx`-only pattern left
        // settings/copy.ts — which carries the badge rule and its branch —
        // outside the gate, so a regression there could not move the number.
        'components/settings/**/*.{ts,tsx}',
        'components/ui/**/*.{ts,tsx}',
        'components/app/**/*.{ts,tsx}',
        'components/public/BrandMark.tsx',
        'components/public/NotFoundPanel.tsx',
        'components/public/foundations/**/*.{ts,tsx}',
        'components/public/support/**/*.{ts,tsx}',
        'components/public/HeaderSessionAction.tsx',
        'components/public/SiteFooter.tsx',
        'components/public/SiteHeader.tsx',
        'scripts/gen-web-tokens/core.ts',
      ],
      // *.types.ts are interface-only modules (no executable statements);
      // v8 still counts them and would dilute the gate with structural zeros.
      // wallet/adapters/types.ts is the same kind under its mobile-parity
      // name (the WalletAdapter interface, zero executable code).
      // lib/uploads/avatar.ts is excluded with reason: a browser canvas
      // pipeline (createImageBitmap → canvas.getContext('2d') → toBlob) that
      // jsdom does not implement — mocking all three would only test the
      // mocks. It is exercised by the avatar-upload flow on a real browser.
      exclude: [
        '**/*.d.ts',
        '**/__tests__/**',
        '**/*.types.ts',
        'wallet/adapters/types.ts',
        'lib/uploads/avatar.ts',
      ],
      thresholds: { lines: 90, branches: 85, functions: 85, statements: 90 },
    },
  },
})
