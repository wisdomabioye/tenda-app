import type { ReactNode } from 'react'
import { AuthGate } from '@/components/app/AuthGate'
import { AppShell } from '@/components/app/AppShell'

/**
 * Authed workspace group. Protection is CLIENT-side (AuthGate; decision #5 —
 * the bearer lives in localStorage, invisible to the server render). A server
 * layout may render client components directly, so no client wrapper file.
 */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  )
}
