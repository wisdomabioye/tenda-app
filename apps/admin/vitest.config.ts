import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// jsdom renders React 19 *client* components only. App Router server
// components / async pages are out of scope here (Playwright in Phase 2);
// see TEST_PLAN.md "Admin RSC limit".
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror tsconfig "paths": { "@/*": ["./*"] }.
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.tsx'],
    include: ['test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['lib/**/*.ts', 'app/**/*.tsx', 'components/**/*.tsx', 'api/**/*.ts'],
      // Excluded with reasons (G4): vendored shadcn UI primitives
      // (components/ui/** — upstream-maintained, not our logic), App-Router
      // layouts + the root redirect page (server components, not renderable
      // under jsdom — Playwright covers those in Phase 2), and type decls.
      exclude: ['**/*.d.ts', 'app/**/layout.tsx', 'app/page.tsx', 'components/ui/**'],
      thresholds: { lines: 90, branches: 85, functions: 90, statements: 90 },
    },
  },
})
