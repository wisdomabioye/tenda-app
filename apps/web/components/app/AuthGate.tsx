'use client'

/**
 * Client-side protection for the (app) group — consistent with decision #5
 * and apps/admin: no Edge middleware, because the token lives in localStorage
 * and the server render cannot see it. Renders a skeleton during bootstrap,
 * then redirects: unauthenticated → /signin, incomplete profile →
 * /onboarding/profile. Also wires cross-tab session sync for its lifetime.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { initCrossTabAuthSync } from '@/stores/auth/cross-tab'
import { currentReturnPath, returnPathFrom, withReturnPath } from '@/lib/auth/return-path'

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const isLoading = useAuthStore((s) => s.isLoading)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const profileComplete = useAuthStore((s) => s.profileComplete)
  const loadSession = useAuthStore((s) => s.loadSession)
  const bootstrapped = useRef(false)

  useEffect(() => {
    if (!bootstrapped.current) {
      bootstrapped.current = true
      if (useAuthStore.getState().isLoading) void loadSession()
    }
    return initCrossTabAuthSync()
  }, [loadSession])

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      // Carry where they were going, so signing in returns them to it instead
      // of dumping every deep link on /home (#27). Read from `window` for the
      // reason lib/auth/return-path gives: `useSearchParams` would cost this
      // component's whole subtree its static prerender.
      const here = `${window.location.pathname}${window.location.search}`
      router.replace(withReturnPath('/signin', returnPathFrom(here)))
    } else if (profileComplete === false) {
      // The profile step is a WAYPOINT, not the destination: hand the return
      // path along so it can finish the journey.
      router.replace(withReturnPath('/onboarding/profile', currentReturnPath()))
    }
  }, [isLoading, isAuthenticated, profileComplete, router])

  if (isLoading || !isAuthenticated || profileComplete === false) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <div className="h-8 w-40 animate-pulse rounded-control bg-surface-inset" />
      </div>
    )
  }
  return <>{children}</>
}
