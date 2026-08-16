import type { AppEnv } from '@tenda/shared'

/**
 * Web replacement for apps/mobile/lib/env.ts (expo-constants → NEXT_PUBLIC_*).
 * Same module path on purpose: api/request.ts imports '@/lib/config/env' unchanged.
 *
 * NEXT_PUBLIC_APP_ENV is inlined at build time, so it is identical on the
 * server and in the browser — a server component and the hydrated client
 * always target the same API host.
 */
export function getEnv(): AppEnv {
  const env = process.env.NEXT_PUBLIC_APP_ENV
  if (env === 'staging' || env === 'production') return env
  // A production build without an explicit APP_ENV would silently point every
  // request at the dev server — flag it loudly, mirroring the mobile guard.
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[env] NEXT_PUBLIC_APP_ENV is not set in this build, falling back to "development". ' +
        'Set NEXT_PUBLIC_APP_ENV=staging or NEXT_PUBLIC_APP_ENV=production in the build environment.',
    )
  }
  return 'development'
}
