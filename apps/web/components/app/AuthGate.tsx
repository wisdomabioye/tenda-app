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
import { initCrossTabAuthSync, useAuthStore } from '@/stores/auth.store'

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
      router.replace('/signin')
    } else if (profileComplete === false) {
      router.replace('/onboarding/profile')
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
