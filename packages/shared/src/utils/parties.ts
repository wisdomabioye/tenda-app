/**
 * Party-identity helpers shared by every dispute/escrow surface (admin
 * dossier, mediation-thread bubbles, mobile). The canonical structural
 * vocabulary is `creator | counterparty` — the SAME words the on-chain
 * `winner` enum and the resolve flow use — so one term threads end to end.
 * Human-facing labels are kind-aware and derived here, never hardcoded at
 * call sites.
 */
import type { EscrowKind } from '../types/escrow'

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
