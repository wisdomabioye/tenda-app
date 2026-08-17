/**
 * The half of the dossier that only PARTIES may see (Tier 2 comp: "party-
 * scoped: only rendered here, never on the public page").
 *
 * Enforcement is the SERVER's — lib/escrow-detail-scope.ts nulls these fields
 * for anyone who is not a party, so the anonymous SSR render never receives
 * them. This component's job is to render nothing when they are absent and,
 * critically, never to synthesise a stand-in: an "Unknown counterparty" row
 * would tell an outsider that a counterparty exists, which is the very fact
 * being withheld.
 *
 * Reviews are deliberately NOT here. They are public on purpose.
 */
import type { ReactNode } from 'react'
import { displayName, formatRelativeDayWithTime } from '@tenda/shared'
import { Avatar } from '@/components/ui/Avatar'
import { DOSSIER_COPY } from './copy'

export interface DossierParty {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url?: string | null
}

export interface DossierProof {
  id: string
  label: string
  /** ISO; formatted for display by the section, never printed raw. */
  uploadedAt?: string | null
  /**
   * Where the file itself is. A party approving or disputing has to be able to
   * OPEN the evidence — a list that only says one exists is the half of the
   * information that cannot settle anything.
   */
  href?: string | null
}

export interface PartyScopedProps {
  /** Party-only. `null` for an outsider, and for the anonymous SSR render. */
  counterparty?: DossierParty | null
  proofs?: readonly DossierProof[] | null
  dispute?: ReactNode | null
  /**
   * True when a direct invite names someone. Party-only on the wire, so an
   * outsider gets `false` and sees nothing.
   */
  isAssigned?: boolean
  /** Shared with the timeline, so one escrow stamps its events one way. */
  formatStamp?: (iso: string) => string
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-4 font-numeric text-xs font-medium uppercase leading-4 tracking-[0.13em] text-content-tertiary">
      {children}
    </h3>
  )
}

export function PartyScopedSection({
  counterparty = null,
  proofs = null,
  dispute = null,
  isAssigned = false,
  formatStamp = formatRelativeDayWithTime,
}: PartyScopedProps) {
  const hasCounterparty = counterparty !== null && counterparty !== undefined
  const hasProofs = proofs !== null && proofs !== undefined
  const hasDispute = dispute !== null && dispute !== undefined

  // Nothing party-scoped survived the server's scoping: render NOTHING, not
  // an empty shell that leaks the shape of what is hidden.
  if (!hasCounterparty && !hasProofs && !hasDispute && !isAssigned) return null

  return (
    <section className="mt-9 border-t border-border-subtle pt-7" data-party-scoped>
      {hasCounterparty && (
        <div className="mb-7">
          <Heading>{DOSSIER_COPY.counterparty}</Heading>
          <div className="flex items-center gap-3.5 rounded-card border border-border-subtle bg-surface-card p-4.5 shadow-card">
            <Avatar
              size="sm"
              name={displayName(counterparty.first_name, counterparty.last_name, counterparty.id)}
              src={counterparty.avatar_url}
            />
            <span className="min-w-0 truncate font-display text-[15px] font-semibold text-content-primary">
              {displayName(counterparty.first_name, counterparty.last_name, counterparty.id)}
            </span>
          </div>
        </div>
      )}

      {/* Assigned but unnamed: a party may know the gig is taken without the
          assignee being resolvable on this wire. */}
      {!hasCounterparty && isAssigned && (
        <p className="mb-7 text-[13px] leading-[18px] text-content-secondary">
          {DOSSIER_COPY.assignedUnnamed}
        </p>
      )}

      {hasProofs && (
        <div className="mb-7">
          <Heading>{DOSSIER_COPY.proofs}</Heading>
          {proofs.length === 0 ? (
            <p className="text-[13px] leading-[18px] text-content-tertiary">
              {DOSSIER_COPY.noProofs}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {proofs.map((proof) => (
                <li
                  key={proof.id}
                  className="rounded-control border border-border-subtle bg-surface-card px-4 py-2.5 text-[13px] text-content-primary"
                >
                  {proof.href == null || proof.href === '' ? (
                    proof.label
                  ) : (
                    // New tab: the file is hosted media, and losing the
                    // escrow you are mid-decision on to open it is worse.
                    <a
                      href={proof.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-primary underline-offset-2 hover:underline"
                    >
                      {proof.label}
                    </a>
                  )}
                  {proof.uploadedAt != null && (
                    <span className="ml-2 font-numeric text-[11px] text-content-tertiary">
                      {formatStamp(proof.uploadedAt)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasDispute && (
        <div>
          <Heading>{DOSSIER_COPY.dispute}</Heading>
          {dispute}
        </div>
      )}
    </section>
  )
}
