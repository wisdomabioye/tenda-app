/**
 * Party-identity helpers shared by every dispute/escrow surface (admin
 * dossier, mediation-thread bubbles, mobile). The canonical structural
 * vocabulary is `creator | counterparty` — the SAME words the on-chain
 * `winner` enum and the resolve flow use — so one term threads end to end.
 * Human-facing labels are kind-aware and derived here, never hardcoded at
 * call sites.
 */
import type { EscrowKind } from '../types/escrow'
// Type-only, and deliberately so: `types/dossier` imports `PartyRole` from
// here, so a value import would close a runtime cycle. `import type` is erased.
import type { DossierParty } from '../types/dossier'

/** Structural party identity; mirrors the escrow columns and winner enum. */
export type PartyRole = 'creator' | 'counterparty'

const PARTY_LABELS: Readonly<Record<EscrowKind, Record<PartyRole, string>>> = {
  // A gig poster funds the job; the counterparty does the work.
  gig: { creator: 'Poster', counterparty: 'Worker' },
  // An exchange maker posts the offer; the counterparty takes it.
  exchange: { creator: 'Maker', counterparty: 'Taker' },
}

/** Human label for a party, e.g. ('gig','counterparty') → 'Worker'. */
export function partyRoleLabel(kind: EscrowKind, role: PartyRole): string {
  return PARTY_LABELS[kind][role]
}

/**
 * Human label for a dispute outcome. `creator`/`counterparty` reuse the
 * party labels; `split` returns the shared even-split wording. Single source
 * for the resolution UI so option lists never hardcode outcome copy.
 */
export function winnerLabel(kind: EscrowKind, winner: PartyRole | 'split'): string {
  return winner === 'split' ? 'Split evenly' : partyRoleLabel(kind, winner)
}

/**
 * Best-effort display name from the two nullable name columns. Falls back
 * to the shortened id so a party with no profile name is still referenceable.
 */
export function displayName(
  first_name: string | null,
  last_name: string | null,
  fallbackId?: string,
): string {
  const full = [first_name, last_name].filter((p) => p !== null && p.trim() !== '').join(' ').trim()
  if (full !== '') return full
  if (fallbackId !== undefined && fallbackId !== '') return `User ${fallbackId.slice(0, 8)}`
  return 'Unknown'
}

// ---------- dispute-thread sender identity -----------------------------------

/**
 * Who a dispute message came from, from ONE viewer's seat. `unknown` is not a
 * failure mode — it is the honest answer when the caller has no party list yet
 * (a `?after=` tail poll before the full load, or the admin dossier still in
 * flight), and it is why this cannot silently fall through to `mediator`.
 */
export type DisputeSenderKind = 'me' | 'party' | 'mediator' | 'unknown'

export interface DisputeSender {
  kind: DisputeSenderKind
  /** Structural role when the sender is a known party; null otherwise. */
  role: PartyRole | null
  /** Bubble label: 'You' | '<Role> · <Name>' | 'Mediator' | 'Participant'. */
  label: string
}

const SELF_LABEL = 'You'
const MEDIATOR_LABEL = 'Mediator'
/** A sender we cannot place, because the party list has not arrived. */
const UNPLACED_LABEL = 'Participant'
const ROLE_NAME_SEPARATOR = ' · '

export interface DisputeSenderArgs {
  senderId: string
  /** The reader. Empty string (signed-out / not yet hydrated) matches nobody. */
  viewerId: string
  /** Drives Poster/Worker vs Maker/Taker. Null ⇒ label falls back to the name. */
  kind: EscrowKind | null
  /** The escrow's parties. Empty ⇒ nothing can be placed but the viewer. */
  parties: readonly DossierParty[]
}

/**
 * Resolve one dispute-thread message to a labelled sender.
 *
 * Deliberately knows NOTHING about who currently holds the claim. Membership
 * of `parties` is what makes someone a disputant, and only parties or a
 * claim-holding admin can post (see the thread POST guard), so "not a party"
 * IS "mediator" — for the admin who wrote it as well as for one who has since
 * handed the claim on. Keying off the current assignee instead produced three
 * distinct mislabellings: a mediator saw both disputants under the first
 * party's name, a party who held the claim was dressed up as the neutral
 * mediator, and a previous mediator's messages were attributed to the reader's
 * opponent.
 */
export function resolveDisputeSender(args: DisputeSenderArgs): DisputeSender {
  const { senderId, viewerId, kind, parties } = args
  const party = parties.find((p) => p.user_id === senderId) ?? null

  // Self first: the viewer's own bubble is identifiable even with no context.
  if (viewerId !== '' && senderId === viewerId) {
    return { kind: 'me', role: party?.role ?? null, label: SELF_LABEL }
  }
  if (party !== null) {
    const name = displayName(party.first_name, party.last_name, party.user_id)
    return {
      kind: 'party',
      role: party.role,
      label: kind === null ? name : `${partyRoleLabel(kind, party.role)}${ROLE_NAME_SEPARATOR}${name}`,
    }
  }
  // No party list ⇒ we genuinely cannot tell a mediator from a disputant.
  if (parties.length === 0) {
    return { kind: 'unknown', role: null, label: UNPLACED_LABEL }
  }
  return { kind: 'mediator', role: null, label: MEDIATOR_LABEL }
}
