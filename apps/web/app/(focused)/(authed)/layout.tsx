import type { ReactNode } from 'react'
import { AuthGate } from '@/components/app/AuthGate'

/**
 * The guarded half of the focused shell.
 *
 * Composer routes need a session; /signin and /onboarding/profile are how you get one,
 * so they must stay reachable signed-out. A nested route group is the smallest
 * way to say that — it adds the gate without touching the URLs or the focused
 * shell's visual layer.
 */
export default function FocusedAuthedLayout({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>
}
