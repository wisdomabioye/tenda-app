'use client'

/**
 * The party-scoped half of the gig detail the anonymous SSR page never sees:
 * counterparty, live deadlines, submitted proofs and the dispute reason.
 *
 * Since the 2026-08-24 redesign (spec-correction #48) this composes the same
 * building blocks as the workspace dossier — PersonCard for the counterparty
 * (profile link + message-in-context, mobile's affordance), the dossier's
 * proof rows — so one escrow's party experience dresses one way on
 * /gig/[id], /home/gigs/[id] and /my-gigs/[id] alike.
 */
import Link from 'next/link'
import {
  STATUS_LABEL,
  formatDeadline,
  truncateWallet,
  type Dispute,
  type GigDetail,
} from '@tenda/shared'
import { DossierProofList, dossierProofsFor } from '@/components/escrow/dossier'
import { PersonCard } from '@/components/shared/PersonCard'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { GIG_DETAIL_COPY } from './copy'

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-content-secondary">{label}</span>
      <span className="text-right text-content-primary">{value}</span>
    </p>
  )
}

export function PartyPanel({ gig, userId }: { gig: GigDetail; userId: string }) {
  const isParty =
    userId === gig.creator.id ||
    userId === gig.counterparty?.id ||
    userId === gig.assigned_counterparty_id

  if (!isParty) return null

  const dispute: Dispute | null = gig.dispute
  const proofs = dossierProofsFor(gig.proofs)

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border-default bg-surface-card p-4">
      <Eyebrow as="h2">Your escrow</Eyebrow>
      {/* The shared label, never the raw enum — a row and a badge naming the
          same status differently reads as two facts. */}
      <Fact label="Status" value={STATUS_LABEL[gig.status]} />
      {/* The wire is viewer-relative (my_signer_address): each party is shown
          the wallet THEY are bound to — create-signer, accept-signer, or the
          invite's baked wallet — and nobody else's ever arrives. */}
      {gig.my_signer_address !== null && (
        <Fact label={GIG_DETAIL_COPY.yourWallet} value={truncateWallet(gig.my_signer_address)} />
      )}
      {gig.completion_deadline !== null && (
        <Fact label="Delivery deadline" value={formatDeadline(gig.completion_deadline)} />
      )}
      {gig.approval_deadline !== null && (
        <Fact label="Approval deadline" value={formatDeadline(gig.approval_deadline)} />
      )}

      {/* PersonCard, as the exchange and mobile draw a counterparty: profile
          link, rating, standing, and the message affordance carrying this
          escrow's chat context — the same query contract everywhere. */}
      {gig.counterparty !== null && (
        <PersonCard
          user={userId === gig.creator.id ? gig.counterparty : gig.creator}
          label={userId === gig.creator.id ? 'Worker' : 'Posted by'}
          currentUserId={userId}
          context={{ id: gig.escrow_id, title: gig.title, kind: 'gig' }}
        />
      )}

      {gig.proofs.length > 0 && proofs !== null && (
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
          <p className="text-sm font-semibold text-content-primary">Submitted proof</p>
          {/* The dossier's rows — one escrow's evidence dresses one way. */}
          <DossierProofList proofs={proofs} />
        </div>
      )}

      {dispute !== null && (
        <div className="flex flex-col gap-1 border-t border-border-subtle pt-3">
          <p className="text-sm font-semibold text-feedback-warning-base">Dispute raised</p>
          <p className="text-sm text-content-secondary">{dispute.reason}</p>
          <Link
            href={`/dispute/${gig.escrow_id}`}
            className="text-sm font-semibold text-brand-primary underline-offset-2 hover:underline"
          >
            Open the mediation thread
          </Link>
        </div>
      )}
    </section>
  )
}
