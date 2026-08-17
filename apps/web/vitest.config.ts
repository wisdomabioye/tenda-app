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
        'api/client/escrows.ts',
        'api/client/timeouts.ts',
        'lib/**/*.ts',
        'hooks/**/*.ts',
        'stores/**/*.ts',
        'wallet/**/*.ts',
        'components/wallet/**/*.tsx',
        'components/escrow/**/*.tsx',
        'components/form/**/*.tsx',
        'components/moderation/**/*.tsx',
        'components/shared/**/*.tsx',
        'components/gig/category-icons.ts',
        'components/gig/CategoryGrid.tsx',
        'components/gig/GigForm.tsx',
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
        // The auth STEPS carry real logic — two clocks, a completeness gate
        // that must match the server's, and the one place PII must not reach
        // the URL — so they are gated like any other (#14 review).
        'app/(focused)/signin/email/page.tsx',
        'app/(focused)/signin/verify/page.tsx',
        'app/(focused)/onboarding/profile/page.tsx',
        'components/settings/**/*.tsx',
        'components/ui/**/*.{ts,tsx}',
        'components/app/**/*.{ts,tsx}',
        'components/public/BrandMark.tsx',
        'components/public/NotFoundPanel.tsx',
        'components/public/foundations/**/*.tsx',
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
