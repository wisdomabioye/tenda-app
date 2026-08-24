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
import { Eyebrow } from '@/components/ui/Eyebrow'
import { DossierProofList } from './DossierProofList'
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
    <Eyebrow as="h3" className="mb-4">
      {children}
    </Eyebrow>
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
          {/* Extracted rows (#48): the gig detail's party panel renders the
              same list, so one escrow's evidence dresses one way. */}
          <DossierProofList proofs={proofs} formatStamp={formatStamp} />
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
