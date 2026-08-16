/**
 * Web port of apps/mobile/hooks/useProfileStats.ts: profile activity
 * counts read as server-side COUNTs (`?mine=…&status=…&limit=1`, answer
 * off `total`) — never derived from a capped page of rows.
 *
 * "Posted" excludes drafts (POSTED_ESCROW_STATUSES): a draft is a
 * pre-signature staging row nobody can see; counting it would inflate the
 * number the user reads as "gigs I posted". Mobile's focus refetch
 * becomes mount (web pages remount per navigation).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { POSTED_ESCROW_STATUSES, type EscrowStatus } from '@tenda/shared'
import { api } from '@/api/client'

/** Statuses that mean "this gig still needs the poster's attention". */
const ACTIVE_STATUSES: EscrowStatus[] = ['open', 'accepted', 'submitted']

const POSTED_STATUSES: EscrowStatus[] = [...POSTED_ESCROW_STATUSES]

export interface ProfileStats {
  /** Gigs the user has posted on-chain — every status except `draft`. */
  posted: number
  /** Posted gigs still in flight — drives the "N active" affordance. */
  active: number
  /** Gigs the user worked through to completion. */
  completed: number
  /** False until the first load settles, so zeroes aren't rendered as fact. */
  loaded: boolean
  reload: () => void
}

const EMPTY = { posted: 0, active: 0, completed: 0 }

/** One count: smallest legal page, answer read off `total`. */
async function countOf(mine: 'created' | 'working', status?: EscrowStatus[]): Promise<number> {
  const { total } = await api.gigs.list({ mine, status, limit: 1 })
  return total
}

export function useProfileStats(userId: string | undefined): ProfileStats {
  const [stats, setStats] = useState(EMPTY)
  const [loaded, setLoaded] = useState(false)
  // Drops superseded responses, so a fast account switch can't leave one
  // user's counts on another user's profile.
  const genRef = useRef(0)

  const reload = useCallback(() => {
    if (userId === undefined) return
    const gen = ++genRef.current
    void (async () => {
      // A different account starts from zero rather than showing the previous
      // user's counts while the new ones load (async — never sync-in-effect).
      await Promise.resolve()
      if (gen !== genRef.current) return
      setStats(EMPTY)
      setLoaded(false)
      try {
        const [posted, active, completed] = await Promise.all([
          countOf('created', POSTED_STATUSES),
          countOf('created', ACTIVE_STATUSES),
          countOf('working', ['completed']),
        ])
        if (gen !== genRef.current) return
        setStats({ posted, active, completed })
        setLoaded(true)
      } catch {
        // Non-fatal: the profile still renders, counts keep their last value.
        if (gen === genRef.current) setLoaded(true)
      }
    })()
  }, [userId])

  useEffect(() => {
    reload()
  }, [userId, reload])

  return { ...stats, loaded, reload }
}
