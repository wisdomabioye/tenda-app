'use client'

/**
 * Ends the session. Rendered on /profile, where mobile puts it
 * (apps/mobile/app/(tabs)/profile.tsx), and on /settings, where the Settings
 * comp puts it. The comps' rail carries no sign-out, so without those two the
 * workspace shell would leave it unreachable. One component, one label, two
 * placements — the comp's longer "Sign out of this device" is not adopted,
 * see spec-corrections.md.
 *
 * No confirm dialog: mobile signs out directly, and the action is cheap to
 * undo by signing back in. Copy stays web's shipped "Sign out" rather than
 * mobile's "Disconnect", which on web reads as disconnecting a wallet.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { showToast } from '@/components/ui/Toast'

/** Where a signed-out reader lands: the public feed, as the old shell did. */
const SIGNED_OUT_ROUTE = '/gigs'

export function SignOutButton() {
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    // The second click is blocked by `disabled` below, not by an `if (busy)`
    // guard — that would read a stale closure value and protect nothing.
    setBusy(true)
    try {
      await logout()
      router.replace(SIGNED_OUT_ROUTE)
    } catch {
      // Caught, not rethrown: an uncaught rejection here becomes a browser
      // unhandledrejection (and a dev-overlay error) that tells the reader
      // nothing. A toast says what happened and the button re-enables so
      // they can retry.
      showToast('error', 'Could not sign out. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={busy}
      className="flex items-center justify-center gap-2 rounded-card border border-feedback-danger-border px-4 py-3 text-sm font-semibold text-feedback-danger-text transition-colors duration-(--motion-fast) ease-(--motion-ease-standard) hover:bg-feedback-danger-surface disabled:opacity-60"
    >
      <LogOut size={16} aria-hidden />
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
