/**
 * Copy for §02 trust strip / proof band. Numerics that aren't chain-derived
 * (slot, settlement count) are placeholders pointing at M75–M77.
 */

export const TRUST_LABELS = {
  badge: 'Network · Live',
  identityName: 'tenda_escrow',
  programLabel: 'Program',
  slotLabel: 'Slot',
  explorer: 'Explorer',
  /** Mobile-only labels. */
  chainLabel: 'Chain',
  verifyLabel: 'Verify',
  verifyValue: 'Explorer ↗',
} as const

export const TRUST_PLACEHOLDERS = {
  /** Live Solana slot number — wire to /v1/public/stats/24h or block-height endpoint. */
  slot: { value: '324,581,902', issue: 'M75' },
} as const
