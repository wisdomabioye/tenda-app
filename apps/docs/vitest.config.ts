import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * What is worth testing on a page that writes nothing of its own: that it
 * renders what the DOCUMENT says, and that the copy baked into the bundle is
 * still that document. The markup is not the subject — the derivation is.
 *
 * The alias mirrors vite.config.ts and tsconfig.app.json; a mismatch shows up
 * here as a resolution failure rather than as a silently different bundle.
 */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // The generated document is data, and main.tsx is the DOM handshake —
      // neither carries logic a test could hold to anything.
      exclude: ['src/generated/**', 'src/main.tsx'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
})
