'use client'

/**
 * The authed escrow detail — the workspace's dossier pane (Tier 2 comp,
 * lines 497-713), and the surface `EscrowDossier` was built for in #9.
 *
 * WHY A SECOND URL EXISTS FOR ONE ESCROW (user decision, 2026-08-17). The
 * public `/gig/[id]` stays the canonical, indexable, unfurlable address: it
 * server-renders the listing anonymously and its client island adds the party
 * half once a bearer loads. That page belongs to the PUBLIC shell, so a reader
 * who opened a gig from their own list left the workspace and the list column
 * went with them — a column that vanishes when you use it is not a column.
 *
 * The rules that keep the two from drifting:
 *   - both read the SAME endpoint through the same store, and the party half
 *     comes from the server's scoping, never from a local role check;
 *   - both render the same action island (`GigDetailAuthed`), so a transition
 *     offered here is the same one offered there;
 *   - this one is authed-only. `AuthGate` sends a signed-out visitor to
 *     /signin before this page renders at all, so nothing here is public and
 *     nothing crawls it. The address to SHARE is the public one; a
 *     /my-gigs/<id> link handed to someone signed out lands them on sign-in
 *     and — until the gate remembers where they were going (task #27) — not
 *     on the gig afterwards.
 */
import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { useGigsStore } from '@/stores/gigs.store'
import { EscrowDossier } from '@/components/escrow/dossier'
import { GigDetailAuthed } from '@/components/gig/detail/GigDetailApp'
import { Spinner } from '@/components/ui/Spinner'
import { TakedownNotice } from '@/components/gig/detail/TakedownNotice'
import { dossierFactsFor, dossierProofsFor } from '@/components/gig/my-gigs/dossier-facts'

export default function MyGigDetailPage() {
  const { escrowId } = useParams<{ escrowId: string }>()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const gig = useGigsStore((s) => s.selectedGig)
  const fetchGigDetail = useGigsStore((s) => s.fetchGigDetail)

  useEffect(() => {
    if (isAuthenticated) void fetchGigDetail(escrowId)
  }, [isAuthenticated, escrowId, fetchGigDetail])

  if (!isAuthenticated) return null

  // The store holds ONE selected gig; while a different one is still in it the
  // pane must not render the previous escrow's money under this one's URL.
  const current = gig?.escrow_id === escrowId ? gig : null
  if (current === null) {
    return (
      <div className="flex h-full items-center justify-center py-24">
        <Spinner />
      </div>
    )
  }

  return (
    <EscrowDossier
      title={current.title}
      amountRaw={current.amount_raw}
      asset={current.asset}
      escrow={current}
      facts={dossierFactsFor(current)}
      counterparty={current.counterparty}
      proofs={dossierProofsFor(current.proofs)}
      isAssigned={current.is_assigned}
      // Renders nothing when the escrow is visible, and the SHARED copy
      // derivation decides which audience's wording a party sees.
      banner={userId === null ? undefined : (
        <TakedownNotice escrow={current} subject="gig" viewerId={userId} />
      )}
    >
      {userId !== null && <GigDetailAuthed gig={current} userId={userId} />}
    </EscrowDossier>
  )
}
