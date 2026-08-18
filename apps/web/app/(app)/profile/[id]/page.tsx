'use client'

/**
 * Another user's profile (auth-gated — GET /v1/users/:id requires a
 * bearer): identity, standing chip, their public reviews. Reviews are
 * PUBLIC ON PURPOSE (deliberate exemption from party scoping — do not
 * "fix"); the list endpoint serves bare rows, so reviewers render
 * anonymously here.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { formatFullName, type PublicUser, type Review } from '@tenda/shared'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { ProfileRating, ReviewCard, StandingBadge } from '@/components/profile'

type ProfileState =
  | { phase: 'loading' }
  | {
      phase: 'ready'
      user: PublicUser
      reviews: Review[]
      /** Server total, not `reviews.length` — the page shows only a first page. */
      reviewCount: number
    }
  | { phase: 'error' }

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>()
  const myId = useAuthStore((s) => s.user?.id ?? null)
  const [state, setState] = useState<ProfileState>({ phase: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // Async reset (not sync-in-effect): the lint forbids cascading renders,
      // and a microtask-deferred loading phase is indistinguishable here.
      await Promise.resolve()
      if (cancelled) return
      setState({ phase: 'loading' })
      try {
        const [user, reviews] = await Promise.all([
          api.users.get({ id }),
          api.users.reviews({ id }, { limit: 20 }),
        ])
        if (!cancelled) {
          setState({ phase: 'ready', user, reviews: reviews.data, reviewCount: reviews.total })
        }
      } catch {
        if (!cancelled) setState({ phase: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  if (state.phase === 'loading') {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }
  if (state.phase === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 px-8 py-24 text-center">
        <p className="font-semibold text-content-primary">Could not load this profile</p>
        <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>Try again</Button>
      </div>
    )
  }

  const { user, reviews, reviewCount } = state
  const fullName = formatFullName(user.first_name, user.last_name) || 'Anonymous'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header className="flex items-center gap-4">
        <Avatar name={fullName} src={user.avatar_url} size="md" className="scale-125" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold text-content-primary">{fullName}</h1>
          <p className="text-sm text-content-secondary">
            {[user.city, user.country].filter(Boolean).join(', ') || 'Location not set'}
          </p>
          {/* The average with its denominator, exactly as on your own profile.
              It matters more here: this is the page where someone decides
              whether to trade with a stranger, and "4.8" from one review reads
              identically to "4.8" from forty. */}
          <ProfileRating score={user.review_score} reviews={reviewCount} loaded />
          <div className="mt-1.5">
            <StandingBadge userId={user.id} />
          </div>
        </div>
        {myId !== null && myId !== user.id && (
          <Link
            href={`/chat/${user.id}`}
            className="flex items-center gap-1.5 rounded-control bg-brand-solid px-4 py-2 text-sm font-semibold text-brand-on-primary"
          >
            <MessageCircle size={15} /> Message
          </Link>
        )}
      </header>

      {user.bio !== null && user.bio !== '' && (
        <p className="text-sm leading-6 text-content-secondary">{user.bio}</p>
      )}

      <section aria-label="Reviews">
        <h2 className="pb-1 text-lg font-bold text-content-primary">
          Reviews
          {/* Says how many exist, not how many fitted on the first page. */}
          {reviewCount > reviews.length && (
            <span className="ml-2 font-numeric text-xs font-medium text-content-tertiary">
              showing {reviews.length} of {reviewCount}
            </span>
          )}
        </h2>
        {reviews.length === 0 ? (
          <p className="py-6 text-sm text-content-tertiary">No reviews yet.</p>
        ) : (
          reviews.map((review) => <ReviewCard key={review.id} review={review} />)
        )}
      </section>
    </div>
  )
}
