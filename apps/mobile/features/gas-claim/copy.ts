/**
 * Every word the gas-claim surfaces say, in one place.
 *
 * Two surfaces render this feature — the wallet screen's card and the inline
 * prompt on a chain with no gas — and they must not describe the same state
 * two different ways. The states themselves come from the server
 * (`GasSeedState`, `GasSeedUnavailableReason`); this file only decides how each
 * one reads.
 *
 * The distinctions that are NOT cosmetic:
 *  - `in_progress` never says "already claimed". It covers the queued transfer
 *    AND the one that landed but could not be stamped, and a user who tapped
 *    twice has nothing in their wallet yet — telling them they already have it
 *    is the one sentence that would send them looking for money that is still
 *    on its way.
 *  - `claimed` never offers the claim again. They have it.
 *  - `funder_empty` is not the user's fault and must not read like it.
 */

import type { GasSeedState, GasSeedUnavailableReason } from '@tenda/shared'

export const GAS_CLAIM_COPY = {
  /** The card's own title, on the wallet screen. */
  title: 'Gas on us',
  /**
   * The action, when a claim is actually on offer.
   *
   * There is no separate "Claiming…" label: `Button` renders a spinner INSTEAD
   * of its children while `loading`, so a second string here would be one
   * nothing can display — checked, not assumed.
   */
  action: 'Claim gas',
  /** The inline prompt's lead-in, on a chain the user holds no gas on. */
  promptTitle: 'No gas on this chain',
  /**
   * The fallback when a claim fails with no message of its own — a dropped
   * connection, a timeout. The server's own message is preferred wherever there
   * is one, because it names the actual refusal ("verify your phone number").
   *
   * Without this the user got NOTHING back from a network failure: the button
   * stopped spinning and the card looked unchanged, which reads as a tap that
   * did not register.
   */
  failed: 'That did not go through. Try again in a moment.',
} as const

/** What each state says once a grant exists (or does not). */
export const GAS_CLAIM_STATE_COPY: Record<GasSeedState, string> = {
  unclaimed: 'A one-time gas grant, so you can transact without buying gas first.',
  // Covers queued, in flight, AND delivered-but-unstamped. All three mean the
  // same thing to the person reading it: it is coming, do not ask again.
  in_progress: 'On its way. This can take a moment to confirm on-chain.',
  claimed: 'Claimed. The gas is in your wallet.',
}

/**
 * Why the claim is not on offer.
 *
 * `mobile_only` is absent on purpose: this app always sends the client stamp,
 * so a session reaching these screens cannot be refused for it. Web renders
 * that case with its own copy. A reason with no entry falls back to
 * `unavailable`, which is why the map is Partial rather than exhaustive — a new
 * server-side reason should read as "not right now" until someone writes it a
 * sentence, never crash the card.
 */
export const GAS_CLAIM_REASON_COPY: Partial<Record<GasSeedUnavailableReason, string>> = {
  not_offered: 'No gas grant on this chain.',
  claims_disabled: 'Gas grants are paused on this chain right now.',
  funder_empty: 'Gas grants are temporarily out. Check back shortly.',
  no_wallet: 'Link a wallet on this chain to claim its gas grant.',
  phone_required: 'Verify your phone number to claim.',
  not_eligible: 'This account cannot claim a gas grant.',
}

export const GAS_CLAIM_UNAVAILABLE_FALLBACK = 'Not available right now.'

/** The sentence for one availability answer, whatever state it is in. */
export function gasClaimMessage(
  state: GasSeedState,
  reason: GasSeedUnavailableReason | null,
  available: boolean,
): string {
  if (available) return GAS_CLAIM_STATE_COPY.unclaimed
  // A grant that exists outranks any reason text: "on its way" and "claimed"
  // are what the user needs, and `already_granted` says nothing they can use.
  if (state !== 'unclaimed') return GAS_CLAIM_STATE_COPY[state]
  if (reason === null) return GAS_CLAIM_UNAVAILABLE_FALLBACK
  return GAS_CLAIM_REASON_COPY[reason] ?? GAS_CLAIM_UNAVAILABLE_FALLBACK
}
