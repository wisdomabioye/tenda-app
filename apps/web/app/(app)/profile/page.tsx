'use client'

/**
 * Own profile — web port of mobile's profile tab: restriction banner,
 * hero (avatar/name/location), server-COUNT stats (posted excludes
 * drafts), quick links, linked sign-in methods.
 */
import { useEffect } from 'react'
import Link from 'next/link'
import { ClipboardList, Scale, Settings, UserPen, Wallet } from 'lucide-react'
import { displayName, formatFullName } from '@tenda/shared'
import { useAuthStore } from '@/stores/auth.store'
import { Avatar } from '@/components/ui/Avatar'
import { RestrictionBanner } from '@/components/profile'
import { useProfileStats } from '@/hooks/profile/useProfileStats'

const LINK_CLASS =
  'flex items-center gap-3 rounded-card border border-border-subtle bg-surface-card px-4 py-3 text-sm font-semibold text-content-primary transition-colors hover:bg-surface-inset'

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const identities = useAuthStore((s) => s.identities)
  const loadMethods = useAuthStore((s) => s.loadMethods)
  const stats = useProfileStats(user?.id)

  useEffect(() => {
    void loadMethods()
  }, [loadMethods])

  if (user === null) return null

  const fullName = formatFullName(user.first_name, user.last_name) || 'Anonymous'
  // v2 review_score is already a 0–5 average (numeric(3,2) → string).
  const reputation = user.review_score ? Number(user.review_score).toFixed(1) : '—'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <RestrictionBanner />

      <header className="flex items-center gap-4">
        <Avatar name={fullName} src={user.avatar_url} size="md" className="scale-125" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold text-content-primary">
            {displayName(user.first_name, user.last_name, user.id)}
          </h1>
          <p className="text-sm text-content-secondary">
            {[user.city, user.country].filter(Boolean).join(', ') || 'Location not set'}
            {user.is_seeker && ' · Seeker'}
          </p>
        </div>
        <Link href="/profile/edit" className={LINK_CLASS}>
          <UserPen size={16} /> Edit
        </Link>
      </header>

      <section className="grid grid-cols-3 gap-2" aria-label="Activity">
        {[
          { label: 'Posted', value: stats.loaded ? String(stats.posted) : '—' },
          { label: 'Completed', value: stats.loaded ? String(stats.completed) : '—' },
          { label: 'Rating', value: reputation },
        ].map((stat) => (
          <div key={stat.label} className="rounded-card border border-border-subtle bg-surface-card p-4 text-center">
            <p className="font-numeric text-xl font-bold text-content-primary">{stat.value}</p>
            <p className="text-xs text-content-tertiary">{stat.label}</p>
          </div>
        ))}
      </section>

      <nav className="flex flex-col gap-2" aria-label="Account">
        <Link href="/my-gigs" className={LINK_CLASS}>
          <ClipboardList size={16} /> My gigs
          {stats.active > 0 && <span className="ml-auto text-xs text-content-tertiary">{stats.active} active</span>}
        </Link>
        <Link href="/wallet" className={LINK_CLASS}>
          <Wallet size={16} /> Wallet
        </Link>
        <Link href="/disputes" className={LINK_CLASS}>
          <Scale size={16} /> My disputes
        </Link>
        <Link href="/settings" className={LINK_CLASS}>
          <Settings size={16} /> Settings
        </Link>
      </nav>

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
          Manage sign-in and wallets under{' '}
          <Link href="/settings/security" className="font-semibold text-brand-primary hover:underline">
            Settings → Security
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
