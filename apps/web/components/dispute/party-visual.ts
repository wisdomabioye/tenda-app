/**
 * The one role→colour mapping for web dispute surfaces (twin of mobile's
 * party-visual): the context header tints each party chip and the thread
 * stripes each incoming bubble with the SAME answer, so the two can never
 * drift into calling the poster one colour here and another there.
 */
import type { PartyRole } from '@tenda/shared'

export type PartyAccent = 'accent' | 'brand'

const ROLE_ACCENTS: Readonly<Record<PartyRole, PartyAccent>> = {
  creator: 'accent',
  counterparty: 'brand',
}

export function partyAccent(role: PartyRole): PartyAccent {
  return ROLE_ACCENTS[role]
}

/** Tailwind classes per accent, shared by the chip ring and bubble stripe. */
export const ACCENT_CLASSES: Record<PartyAccent, { ring: string; stripe: string }> = {
  accent: { ring: 'ring-accent-primary', stripe: 'border-l-accent-primary' },
  brand: { ring: 'ring-brand-primary', stripe: 'border-l-brand-primary' },
}
