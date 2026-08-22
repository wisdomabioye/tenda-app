'use client'

import { useCallback, useEffect } from 'react'
import type { GigDetail } from '@tenda/shared'
import { RotateCw } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useGigsStore } from '@/stores/gigs.store'
import { GigBrief } from '@/components/gig/detail/GigBrief'
import { GigDetailHeader } from '@/components/gig/detail/GigDetailHeader'
import { GigDetailSection } from '@/components/gig/detail/GigDetailSection'
import { GigEscrowAside } from '@/components/gig/detail/GigEscrowAside'
import { GigPosterCard } from '@/components/gig/detail/GigPosterCard'
import { GigProofList } from '@/components/gig/detail/GigProofList'
import { GigTerms } from '@/components/gig/detail/GigTerms'
import { GigDetailAuthed } from '@/components/gig/detail/GigDetailApp'
import { GIG_DETAIL_COPY } from '@/components/gig/detail/copy'
import { AlertPanel, ALERT_ACTION_CLASS } from '@/components/ui/AlertPanel'
import { Spinner } from '@/components/ui/Spinner'

export function HomeGigDetail({ escrowId }: { escrowId: string }) {
  const userId = useAuthStore((state) => state.user?.id ?? null)
  const selected = useGigsStore((state) => state.selectedGig)
  const error = useGigsStore((state) => state.error)
  const fetchGigDetail = useGigsStore((state) => state.fetchGigDetail)
  const load = useCallback(() => { void fetchGigDetail(escrowId) }, [escrowId, fetchGigDetail])
  useEffect(load, [load])
  const gig = selected?.escrow_id === escrowId ? selected : null

  if (gig === null && error?.id === escrowId) return <div className="p-6"><AlertPanel title={GIG_DETAIL_COPY.unavailableTitle} body={GIG_DETAIL_COPY.unavailableBody} action={<button type="button" onClick={load} className={ALERT_ACTION_CLASS}><RotateCw size={16} aria-hidden />{GIG_DETAIL_COPY.unavailableAction}</button>} /></div>
  if (gig === null) return <div className="flex h-full items-center justify-center"><Spinner /></div>
  return <HomeGigBody gig={gig} userId={userId} />
}

function HomeGigBody({ gig, userId }: { gig: GigDetail; userId: string | null }) {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 pb-16 pt-8 lg:px-8">
      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article><GigDetailHeader gig={gig} /><GigDetailSection title={GIG_DETAIL_COPY.brief}><GigBrief description={gig.description} /></GigDetailSection><GigDetailSection title={GIG_DETAIL_COPY.terms}><GigTerms gig={gig} /></GigDetailSection><GigDetailSection title={GIG_DETAIL_COPY.proof}><GigProofList requirements={gig.proof_requirements} /></GigDetailSection><GigDetailSection title={GIG_DETAIL_COPY.postedBy}><GigPosterCard creator={gig.creator} /></GigDetailSection></article>
        <div className="flex flex-col gap-4"><GigEscrowAside gig={gig} />{userId !== null && <GigDetailAuthed gig={gig} userId={userId} />}</div>
      </div>
    </div>
  )
}
