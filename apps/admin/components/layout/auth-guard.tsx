'use client'

/**
 * Client-side session guard (#90) — the deliberate replacement for Edge
 * middleware (open_issues A5): no token in localStorage → /login. This is
 * a UX convenience only; the API server independently authorizes every
 * request, and lib/api.ts bounces 401s back to /login.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/auth'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  // localStorage is unavailable during SSR — resolve after mount so the
  // server render and first client render agree (no hydration mismatch).
  const [status, setStatus] = useState<'checking' | 'authed'>('checking')

  useEffect(() => {
    if (getToken() === null) {
      router.replace('/login')
      return
    }
    setStatus('authed')
  }, [router])

  if (status === 'checking') return null
  return <>{children}</>
}
