import { CHAIN_MANIFEST } from '@tenda/shared/chains'
import { apiConfig } from '@/lib/api-config'
import { PlatformProbe } from './platform-probe'
import { getEnv } from '@/lib/env'

/**
 * Stage-0 placeholder. Stage 1 replaces this with the entry redirect
 * (public /gigs for anonymous visitors, /home for a signed-in session).
 * The shared import is deliberate: it proves the @tenda/shared seam in
 * both `next dev` and `next build` (stage-0 task 0.2).
 */
export default function RootPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Tenda Web</h1>
      <p className="text-sm opacity-70">
        Stage 0 — foundation. Supported chains:{' '}
        {CHAIN_MANIFEST.map((chain) => chain.id).join(' · ')}
      </p>
      <p className="text-sm opacity-70">
        API target ({getEnv()}): {apiConfig[getEnv()].baseUrl || 'NOT CONFIGURED'}
      </p>
      <PlatformProbe />
    </main>
  )
}
