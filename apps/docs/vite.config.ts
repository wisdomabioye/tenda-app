import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs, so `dist/` serves from a domain root, a subdirectory
  // or the filesystem alike. The site is one page with in-page anchors for the
  // same reason: a client router would need a host rewrite rule to survive a
  // refresh, and that rule is the platform coupling this avoids.
  base: './',
  plugins: [react(), tailwindcss()],
  // Mirrors tsconfig.app.json and vitest.config.ts; a mismatch between the
  // three shows up as a resolution failure rather than a different bundle.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
