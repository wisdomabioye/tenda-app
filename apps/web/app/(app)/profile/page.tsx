'use client'

/**
 * Own profile, stage-2 cut: identity + linked sign-in methods. The full
 * reputation surface (reviews, standing, avatar editor) is Stage 6.
 */
import { useEffect } from 'react'
import { displayName } from '@tenda/shared'
import { useAuthStore } from '@/stores/auth.store'

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const identities = useAuthStore((s) => s.identities)
  const loadMethods = useAuthStore((s) => s.loadMethods)

  useEffect(() => {
    void loadMethods()
  }, [loadMethods])

  if (user === null) return null

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold text-content-primary">
          {displayName(user.first_name, user.last_name, user.id)}
        </h1>
        <p className="text-sm text-content-secondary">
          {[user.city, user.country].filter(Boolean).join(', ') || 'Location not set'}
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
          Sign-in methods
        </h2>
        {identities.length === 0 ? (
          <p className="text-sm text-content-secondary">No linked sign-in methods to show yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {identities.map((identity) => (
              <li key={`${identity.kind}:${identity.identifier}`} className="flex items-center gap-3 text-sm">
                <span className="rounded-full bg-surface-inset px-3 py-1 text-xs font-semibold uppercase text-content-secondary">
                  {identity.kind}
                </span>
                <span className="text-content-primary">{identity.email ?? identity.identifier}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-content-tertiary">
          Wallet linking and full sign-in management arrive with Stages 3 and 6.
        </p>
      </section>
    </div>
  )
}
