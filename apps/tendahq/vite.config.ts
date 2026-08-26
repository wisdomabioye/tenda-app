import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Point at the shared package's TS SOURCE, not its CJS dist — linked
      // workspace packages skip Vite's CJS interop, so the dist build can't be
      // imported here. Bundling the source also drops the build-order coupling.
      '@tenda/shared/chains': fileURLToPath(
        new URL('../../packages/shared/src/chains/index.ts', import.meta.url),
      ),
      // Same source-not-dist rule for the shared brand facts.
      '@tenda/shared/app-info': fileURLToPath(
        new URL('../../packages/shared/src/constants/app-info.ts', import.meta.url),
      ),
      // And for the payout registry, so "which markets can trade fiat" is read
      // from the same specs the server validates against rather than retyped.
      '@tenda/shared/fiat/payout': fileURLToPath(
        new URL('../../packages/shared/src/fiat/payout/index.ts', import.meta.url),
      ),
      // And for the platform-config defaults, so the fee/window figures the
      // page prints while the live config loads are the SAME constants the
      // server falls back to — not literals retyped into marketing copy.
      '@tenda/shared/constants/platform': fileURLToPath(
        new URL('../../packages/shared/src/constants/platform.ts', import.meta.url),
      ),
      // And for asset display metadata, so "which tokens can you trade" is
      // read off the manifest's exchange roles instead of listed by hand.
      '@tenda/shared/constants/assets': fileURLToPath(
        new URL('../../packages/shared/src/constants/assets.ts', import.meta.url),
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
})
