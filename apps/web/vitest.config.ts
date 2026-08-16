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
        'components/gig/detail/**/*.{ts,tsx}',
        'components/gig/gig-form/**/*.{ts,tsx}',
        'components/gig/gig-applications/**/*.{ts,tsx}',
        'components/chat/**/*.{ts,tsx}',
        'components/notifications/**/*.{ts,tsx}',
        'components/auth/OtpCodeField.tsx',
        'components/auth/WalletSignInPanel.tsx',
        'components/settings/**/*.tsx',
        'components/ui/**/*.{ts,tsx}',
        'components/app/**/*.tsx',
        'components/public/HeaderSessionAction.tsx',
        'scripts/gen-web-tokens/core.ts',
      ],
      // *.types.ts are interface-only modules (no executable statements);
      // v8 still counts them and would dilute the gate with structural zeros.
      // wallet/adapters/types.ts is the same kind under its mobile-parity
      // name (the WalletAdapter interface, zero executable code).
      exclude: ['**/*.d.ts', '**/__tests__/**', '**/*.types.ts', 'wallet/adapters/types.ts'],
      thresholds: { lines: 90, branches: 85, functions: 85, statements: 90 },
    },
  },
})
