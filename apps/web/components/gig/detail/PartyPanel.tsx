'use client'

/**
 * The party-scoped half of the gig detail the anonymous SSR page never sees:
 * counterparty, live deadlines, submitted proofs and the dispute reason.
 * (The full mobile GigDetailBody parity — meta cards, reviews — lands with
 * the S6.7 sweep; this panel carries what the transitions REQUIRE a party
 * to see.)
 */
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import {
  displayName,
  formatDeadline,
  truncateWallet,
  type Dispute,
  type EscrowProof,
  type GigDetail,
} from '@tenda/shared'
import { escrowChatHref } from '@/lib/chat-href'
import { GIG_DETAIL_COPY } from './copy'

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-content-secondary">{label}</span>
      <span className="text-right text-content-primary">{value}</span>
    </p>
  )
}

function ProofRow({ proof }: { proof: EscrowProof }) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      {/* Open in a new tab — the Cloudinary URL is the media viewer for v1. */}
      <a
        href={proof.url}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 truncate text-brand-primary underline-offset-2 hover:underline"
      >
        {proof.type} proof
      </a>
      <span className="shrink-0 text-xs text-content-tertiary">
        {new Date(proof.uploaded_at).toLocaleString()}
      </span>
    </li>
  )
}

export function PartyPanel({ gig, userId }: { gig: GigDetail; userId: string }) {
  const isParty =
    userId === gig.creator.id ||
    userId === gig.counterparty?.id ||
    userId === gig.assigned_counterparty_id
  if (!isParty) return null

  const dispute: Dispute | null = gig.dispute

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border-default bg-surface-card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-content-tertiary">
        Your escrow
      </h2>
      <Fact label="Status" value={gig.status} />
      {/* The wire is viewer-relative (my_signer_address): each party is shown
          the wallet THEY are bound to — create-signer, accept-signer, or the
          invite's baked wallet — and nobody else's ever arrives. */}
      {gig.my_signer_address !== null && (
        <Fact label={GIG_DETAIL_COPY.yourWallet} value={truncateWallet(gig.my_signer_address)} />
      )}
      {gig.counterparty !== null && (
        <>
          <Fact
            label={userId === gig.creator.id ? 'Worker' : 'Posted by'}
            value={
              userId === gig.creator.id
                ? displayName(gig.counterparty.first_name, gig.counterparty.last_name)
                : displayName(gig.creator.first_name, gig.creator.last_name)
            }
          />
          {/* Contextual thread — same query contract as mobile's PersonCard link. */}
          <Link
            href={escrowChatHref(userId === gig.creator.id ? gig.counterparty.id : gig.creator.id, {
              id: gig.escrow_id,
              title: gig.title,
              kind: 'gig',
            })}
            className="flex items-center gap-1.5 text-sm font-semibold text-brand-primary underline-offset-2 hover:underline"
          >
            <MessageCircle size={15} /> Message {userId === gig.creator.id ? 'worker' : 'poster'}
          </Link>
        </>
      )}
      {gig.completion_deadline !== null && (
        <Fact label="Delivery deadline" value={formatDeadline(gig.completion_deadline)} />
      )}
      {gig.approval_deadline !== null && (
        <Fact label="Approval deadline" value={formatDeadline(gig.approval_deadline)} />
      )}

      {gig.proofs.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border-subtle pt-3">
          <p className="text-sm font-semibold text-content-primary">Submitted proof</p>
          <ul className="flex flex-col gap-1">
            {gig.proofs.map((proof) => (
              <ProofRow key={proof.id} proof={proof} />
            ))}
          </ul>
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
